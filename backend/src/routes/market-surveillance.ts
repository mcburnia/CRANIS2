/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

/**
 * Market Surveillance Authorities — Route Handlers
 *
 * Public endpoints (no auth):
 *   GET  /api/market-surveillance-authorities           — list/search/filter
 *   GET  /api/market-surveillance-authorities/countries — country summary
 *   GET  /api/market-surveillance-authorities/:id       — single authority detail
 *
 * Admin endpoints (platform admin only):
 *   POST   /api/admin/market-surveillance-authorities           — create
 *   PUT    /api/admin/market-surveillance-authorities/:id        — update
 *   DELETE /api/admin/market-surveillance-authorities/:id        — delete
 *
 * Product-scoped endpoints (authenticated):
 *   GET    /api/products/:productId/ms-registration  — get registration
 *   POST   /api/products/:productId/ms-registration  — create/start tracking
 *   PUT    /api/products/:productId/ms-registration  — update status
 *   DELETE /api/products/:productId/ms-registration  — remove
 */

import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
import { requirePlatformAdmin } from '../middleware/requirePlatformAdmin.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';

// ─── Constants ────────────────────────────────────────────────

const VALID_REGISTRATION_STATUSES = [
  'planning', 'preparing', 'submitted',
  'acknowledged', 'registered', 'rejected',
] as const;
type RegistrationStatus = typeof VALID_REGISTRATION_STATUSES[number];

const VALID_COMPETENCE_AREAS = [
  'cybersecurity', 'consumer_electronics', 'industrial',
  'iot', 'medical', 'automotive', 'energy', 'financial',
  'telecoms', 'networking', 'general',
] as const;

// EU-27 + EEA countries
const VALID_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO', // EEA
] as const;

// ─── Public router ────────────────────────────────────────────

export const publicMarketSurveillanceRouter = Router();

/**
 * GET /api/market-surveillance-authorities
 * Public — list with optional filters: country, competence_area, cra_designated, search
 */
publicMarketSurveillanceRouter.get('/', async (req: Request, res: Response) => {
  try {
    const country = req.query.country as string | undefined;
    const competence_area = req.query.competence_area as string | undefined;
    const cra_designated = req.query.cra_designated as string | undefined;
    const search = req.query.search as string | undefined;

    let sql = 'SELECT * FROM market_surveillance_authorities WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (country) {
      sql += ` AND country = $${idx++}`;
      params.push(country.toUpperCase());
    }

    if (competence_area) {
      sql += ` AND competence_areas @> $${idx++}::jsonb`;
      params.push(JSON.stringify([competence_area.toLowerCase()]));
    }

    if (cra_designated !== undefined) {
      sql += ` AND cra_designated = $${idx++}`;
      params.push(cra_designated === 'true');
    }

    if (search && search.trim().length > 0) {
      sql += ` AND LOWER(name) LIKE $${idx}`;
      params.push(`%${search.trim().toLowerCase()}%`);
      idx++;
    }

    sql += ' ORDER BY country, name';

    const result = await pool.query(sql, params);
    res.json({
      authorities: result.rows,
      total: result.rows.length,
      filters: { country, competence_area, cra_designated, search },
    });
  } catch (err: any) {
    console.error('[MARKET-SURVEILLANCE] List error:', err.message);
    res.status(500).json({ error: 'Failed to list market surveillance authorities' });
  }
});

/**
 * GET /api/market-surveillance-authorities/countries
 * Public — returns list of countries that have at least one authority
 */
publicMarketSurveillanceRouter.get('/countries', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT country, COUNT(*) as count
       FROM market_surveillance_authorities
       GROUP BY country
       ORDER BY country`
    );
    res.json({ countries: result.rows });
  } catch (err: any) {
    console.error('[MARKET-SURVEILLANCE] Countries error:', err.message);
    res.status(500).json({ error: 'Failed to list countries' });
  }
});

/**
 * GET /api/market-surveillance-authorities/:id
 * Public — single authority detail
 */
publicMarketSurveillanceRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM market_surveillance_authorities WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Market surveillance authority not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('[MARKET-SURVEILLANCE] Get error:', err.message);
    res.status(500).json({ error: 'Failed to fetch market surveillance authority' });
  }
});

// ─── Admin router ─────────────────────────────────────────────

export const adminMarketSurveillanceRouter = Router();

/**
 * POST /api/admin/market-surveillance-authorities
 * Admin — create a new market surveillance authority entry
 */
adminMarketSurveillanceRouter.post(
  '/market-surveillance-authorities',
  requirePlatformAdmin,
  async (req: Request, res: Response) => {
    try {
      const {
        name, country, website, email, phone, address,
        competence_areas, cra_designated, contact_portal_url, notes,
      } = req.body;

      // Validation
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }
      if (!country || !VALID_COUNTRIES.includes(country.toUpperCase() as any)) {
        res.status(400).json({ error: 'Country must be a valid EU-27/EEA code (e.g. DE, FR)' });
        return;
      }
      if (competence_areas && !Array.isArray(competence_areas)) {
        res.status(400).json({ error: 'competence_areas must be an array' });
        return;
      }

      const result = await pool.query(
        `INSERT INTO market_surveillance_authorities
         (name, country, website, email, phone, address,
          competence_areas, cra_designated, contact_portal_url, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          name.trim(),
          country.toUpperCase(),
          website || null,
          email || null,
          phone || null,
          address || null,
          JSON.stringify(competence_areas || []),
          cra_designated === true,
          contact_portal_url || null,
          notes || null,
        ]
      );

      const adminUserId = (req as any).userId;
      const adminEmail = (req as any).email;
      const reqData = extractRequestData(req);
      await recordEvent({
        userId: adminUserId,
        email: adminEmail,
        eventType: 'market_surveillance_authority_created',
        ...reqData,
        metadata: { authorityId: result.rows[0].id, name: name.trim(), country: country.toUpperCase() },
      });

      res.status(201).json(result.rows[0]);
    } catch (err: any) {
      console.error('[MARKET-SURVEILLANCE] Create error:', err.message);
      res.status(500).json({ error: 'Failed to create market surveillance authority' });
    }
  }
);

/**
 * PUT /api/admin/market-surveillance-authorities/:id
 * Admin — update an existing market surveillance authority
 */
adminMarketSurveillanceRouter.put(
  '/market-surveillance-authorities/:id',
  requirePlatformAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const existing = await pool.query(
        'SELECT id FROM market_surveillance_authorities WHERE id = $1',
        [id]
      );
      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Market surveillance authority not found' });
        return;
      }

      const {
        name, country, website, email, phone, address,
        competence_areas, cra_designated, contact_portal_url, notes,
      } = req.body;

      // Validation
      if (country && !VALID_COUNTRIES.includes(country.toUpperCase() as any)) {
        res.status(400).json({ error: 'Invalid country code' });
        return;
      }
      if (competence_areas && !Array.isArray(competence_areas)) {
        res.status(400).json({ error: 'competence_areas must be an array' });
        return;
      }

      // Dynamic SET clause
      const setClauses: string[] = ['updated_at = NOW()'];
      const params: any[] = [];
      let idx = 1;

      const addField = (field: string, value: any) => {
        if (value !== undefined) {
          setClauses.push(`${field} = $${idx++}`);
          params.push(value);
        }
      };

      addField('name', name?.trim());
      addField('country', country?.toUpperCase());
      addField('website', website);
      addField('email', email);
      addField('phone', phone);
      addField('address', address);
      if (competence_areas !== undefined) {
        setClauses.push(`competence_areas = $${idx++}`);
        params.push(JSON.stringify(competence_areas));
      }
      if (cra_designated !== undefined) {
        setClauses.push(`cra_designated = $${idx++}`);
        params.push(cra_designated === true);
      }
      addField('contact_portal_url', contact_portal_url);
      addField('notes', notes);

      params.push(id);

      const result = await pool.query(
        `UPDATE market_surveillance_authorities SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
        params
      );

      const adminUserId = (req as any).userId;
      const adminEmail = (req as any).email;
      const reqData = extractRequestData(req);
      await recordEvent({
        userId: adminUserId,
        email: adminEmail,
        eventType: 'market_surveillance_authority_updated',
        ...reqData,
        metadata: { authorityId: id },
      });

      res.json(result.rows[0]);
    } catch (err: any) {
      console.error('[MARKET-SURVEILLANCE] Update error:', err.message);
      res.status(500).json({ error: 'Failed to update market surveillance authority' });
    }
  }
);

/**
 * DELETE /api/admin/market-surveillance-authorities/:id
 * Admin — remove a market surveillance authority entry
 */
adminMarketSurveillanceRouter.delete(
  '/market-surveillance-authorities/:id',
  requirePlatformAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        'DELETE FROM market_surveillance_authorities WHERE id = $1 RETURNING id, name',
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Market surveillance authority not found' });
        return;
      }

      const adminUserId = (req as any).userId;
      const adminEmail = (req as any).email;
      const reqData = extractRequestData(req);
      await recordEvent({
        userId: adminUserId,
        email: adminEmail,
        eventType: 'market_surveillance_authority_deleted',
        ...reqData,
        metadata: { authorityId: id, name: result.rows[0].name },
      });

      res.json({ deleted: true, id });
    } catch (err: any) {
      console.error('[MARKET-SURVEILLANCE] Delete error:', err.message);
      res.status(500).json({ error: 'Failed to delete market surveillance authority' });
    }
  }
);

// ─── Product-scoped registration tracking ─────────────────────

export const productMsRegistrationRouter = Router();

async function requireAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  try {
    const payload = verifySessionToken(authHeader.split(' ')[1]);
    if (!payload) { res.status(401).json({ error: 'Invalid token' }); return; }
    (req as any).userId = payload.userId;
    (req as any).email = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

async function getUserOrgId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.org_id || null;
}

async function verifyProductAccess(orgId: string, productId: string): Promise<boolean> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      'MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId}) RETURN p.id AS id',
      { orgId, productId }
    );
    return result.records.length > 0;
  } finally {
    await session.close();
  }
}

/**
 * GET /:productId/ms-registration
 * Get the current market surveillance registration for a product (if any).
 * Joins with market_surveillance_authorities to include authority details.
 */
productMsRegistrationRouter.get(
  '/:productId/ms-registration',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params as { productId: string };
      const orgId = await getUserOrgId((req as any).userId);
      if (!orgId) { res.status(400).json({ error: 'No organisation context' }); return; }
      if (!(await verifyProductAccess(orgId, productId))) { res.status(404).json({ error: 'Product not found' }); return; }

      const result = await pool.query(
        `SELECT msr.*,
                msa.name AS msa_name, msa.country AS msa_country,
                msa.website AS msa_website, msa.contact_portal_url AS msa_portal
         FROM market_surveillance_registrations msr
         LEFT JOIN market_surveillance_authorities msa ON msr.authority_id = msa.id
         WHERE msr.product_id = $1 AND msr.org_id = $2`,
        [productId, orgId]
      );

      if (result.rows.length === 0) {
        res.json({ registration: null });
        return;
      }

      res.json({ registration: result.rows[0] });
    } catch (err: any) {
      console.error('[MS-REGISTRATION] Get error:', err.message);
      res.status(500).json({ error: 'Failed to fetch registration' });
    }
  }
);

/**
 * POST /:productId/ms-registration
 * Create or start tracking a market surveillance registration.
 * One per product (UNIQUE constraint).
 */
productMsRegistrationRouter.post(
  '/:productId/ms-registration',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params as { productId: string };
      const orgId = await getUserOrgId((req as any).userId);
      if (!orgId) { res.status(400).json({ error: 'No organisation context' }); return; }
      if (!(await verifyProductAccess(orgId, productId))) { res.status(404).json({ error: 'Product not found' }); return; }

      const {
        authority_id, status, authority_name, authority_country,
        registration_number, registration_date, submission_date,
        renewal_date, notes,
      } = req.body;

      if (status && !VALID_REGISTRATION_STATUSES.includes(status as RegistrationStatus)) {
        res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_REGISTRATION_STATUSES.join(', ')}` });
        return;
      }

      // Check for existing registration
      const existing = await pool.query(
        'SELECT id FROM market_surveillance_registrations WHERE org_id = $1 AND product_id = $2',
        [orgId, productId]
      );
      if (existing.rows.length > 0) {
        res.status(409).json({ error: 'Registration already exists for this product. Use PUT to update.' });
        return;
      }

      // Validate authority if provided
      if (authority_id) {
        const msaCheck = await pool.query(
          'SELECT id, name, country FROM market_surveillance_authorities WHERE id = $1',
          [authority_id]
        );
        if (msaCheck.rows.length === 0) {
          res.status(400).json({ error: 'Market surveillance authority not found' });
          return;
        }
      }

      const result = await pool.query(
        `INSERT INTO market_surveillance_registrations
         (org_id, product_id, authority_id, status, authority_name, authority_country,
          registration_number, registration_date, submission_date, renewal_date, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          orgId, productId,
          authority_id || null,
          status || 'planning',
          authority_name || null,
          authority_country || null,
          registration_number || null,
          registration_date || null,
          submission_date || null,
          renewal_date || null,
          notes || null,
        ]
      );

      res.status(201).json({ registration: result.rows[0] });
    } catch (err: any) {
      console.error('[MS-REGISTRATION] Create error:', err.message);
      res.status(500).json({ error: 'Failed to create registration' });
    }
  }
);

/**
 * PUT /:productId/ms-registration
 * Update the registration status, dates, authority, or registration number.
 */
productMsRegistrationRouter.put(
  '/:productId/ms-registration',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params as { productId: string };
      const orgId = await getUserOrgId((req as any).userId);
      if (!orgId) { res.status(400).json({ error: 'No organisation context' }); return; }
      if (!(await verifyProductAccess(orgId, productId))) { res.status(404).json({ error: 'Product not found' }); return; }

      const existing = await pool.query(
        'SELECT id FROM market_surveillance_registrations WHERE org_id = $1 AND product_id = $2',
        [orgId, productId]
      );
      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'No registration found for this product' });
        return;
      }

      const {
        authority_id, status, authority_name, authority_country,
        registration_number, registration_date, submission_date,
        renewal_date, notes,
      } = req.body;

      if (status && !VALID_REGISTRATION_STATUSES.includes(status as RegistrationStatus)) {
        res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_REGISTRATION_STATUSES.join(', ')}` });
        return;
      }

      const setClauses: string[] = ['updated_at = NOW()'];
      const params: any[] = [];
      let idx = 1;

      const addField = (field: string, value: any) => {
        if (value !== undefined) {
          setClauses.push(`${field} = $${idx++}`);
          params.push(value);
        }
      };

      if (authority_id !== undefined) {
        addField('authority_id', authority_id || null);
      }
      addField('status', status);
      addField('authority_name', authority_name);
      addField('authority_country', authority_country);
      addField('registration_number', registration_number);
      addField('registration_date', registration_date);
      addField('submission_date', submission_date);
      addField('renewal_date', renewal_date);
      addField('notes', notes);

      params.push(orgId, productId);

      const result = await pool.query(
        `UPDATE market_surveillance_registrations SET ${setClauses.join(', ')}
         WHERE org_id = $${idx} AND product_id = $${idx + 1}
         RETURNING *`,
        params
      );

      res.json({ registration: result.rows[0] });
    } catch (err: any) {
      console.error('[MS-REGISTRATION] Update error:', err.message);
      res.status(500).json({ error: 'Failed to update registration' });
    }
  }
);

/**
 * DELETE /:productId/ms-registration
 * Remove registration tracking for a product.
 */
productMsRegistrationRouter.delete(
  '/:productId/ms-registration',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params as { productId: string };
      const orgId = await getUserOrgId((req as any).userId);
      if (!orgId) { res.status(400).json({ error: 'No organisation context' }); return; }
      if (!(await verifyProductAccess(orgId, productId))) { res.status(404).json({ error: 'Product not found' }); return; }

      const result = await pool.query(
        'DELETE FROM market_surveillance_registrations WHERE org_id = $1 AND product_id = $2 RETURNING id',
        [orgId, productId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'No registration found for this product' });
        return;
      }

      res.json({ deleted: true });
    } catch (err: any) {
      console.error('[MS-REGISTRATION] Delete error:', err.message);
      res.status(500).json({ error: 'Failed to delete registration' });
    }
  }
);

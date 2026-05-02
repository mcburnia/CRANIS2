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
 * Notified Bodies Directory — Route Handlers
 *
 * Public endpoints (no auth):
 *   GET  /api/notified-bodies           — list/search/filter
 *   GET  /api/notified-bodies/countries — country summary
 *   GET  /api/notified-bodies/:id       — single body detail
 *
 * Admin endpoints (platform admin only):
 *   POST   /api/admin/notified-bodies           — create
 *   PUT    /api/admin/notified-bodies/:id        — update
 *   DELETE /api/admin/notified-bodies/:id        — delete
 *
 * Product-scoped endpoints (authenticated):
 *   GET    /api/products/:productId/nb-assessment  — get assessment
 *   POST   /api/products/:productId/nb-assessment  — create/start tracking
 *   PUT    /api/products/:productId/nb-assessment  — update status
 *   DELETE /api/products/:productId/nb-assessment  — remove
 */

import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
import { requirePlatformAdmin } from '../middleware/requirePlatformAdmin.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';

// ─── Constants ────────────────────────────────────────────────

const VALID_STATUSES = ['active', 'suspended', 'withdrawn'] as const;
type AccreditationStatus = typeof VALID_STATUSES[number];

const VALID_MODULES = ['B', 'C', 'H'] as const;

const VALID_ASSESSMENT_STATUSES = [
  'planning', 'submitted', 'under_review',
  'additional_info_requested', 'approved', 'rejected',
] as const;
type AssessmentStatus = typeof VALID_ASSESSMENT_STATUSES[number];

const VALID_SECTORS = [
  'networking',
  'industrial',
  'iot',
  'medical',
  'automotive',
  'energy',
  'financial',
  'telecoms',
  'general',
] as const;

// EU-27 + EEA countries
const VALID_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO', // EEA
] as const;

// ─── Public router ────────────────────────────────────────────

export const publicNotifiedBodiesRouter = Router();

/**
 * GET /api/notified-bodies
 * Public — list with optional filters: country, module, sector, status, search
 */
publicNotifiedBodiesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const country = req.query.country as string | undefined;
    const module = req.query.module as string | undefined;
    const sector = req.query.sector as string | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    let sql = 'SELECT * FROM notified_bodies WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (country) {
      sql += ` AND country = $${idx++}`;
      params.push(country.toUpperCase());
    }

    if (module && VALID_MODULES.includes(module.toUpperCase() as any)) {
      sql += ` AND cra_modules @> $${idx++}::jsonb`;
      params.push(JSON.stringify([module.toUpperCase()]));
    }

    if (sector) {
      sql += ` AND sectors @> $${idx++}::jsonb`;
      params.push(JSON.stringify([sector.toLowerCase()]));
    }

    if (status && VALID_STATUSES.includes(status as AccreditationStatus)) {
      sql += ` AND accreditation_status = $${idx++}`;
      params.push(status);
    }

    if (search && search.trim().length > 0) {
      sql += ` AND (LOWER(name) LIKE $${idx} OR LOWER(nando_number) LIKE $${idx})`;
      params.push(`%${search.trim().toLowerCase()}%`);
      idx++;
    }

    sql += ' ORDER BY country, name';

    const result = await pool.query(sql, params);
    res.json({
      bodies: result.rows,
      total: result.rows.length,
      filters: { country, module, sector, status, search },
    });
  } catch (err: any) {
    console.error('[NOTIFIED-BODIES] List error:', err.message);
    res.status(500).json({ error: 'Failed to list notified bodies' });
  }
});

/**
 * GET /api/notified-bodies/countries
 * Public — returns list of countries that have at least one notified body
 */
publicNotifiedBodiesRouter.get('/countries', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT country, COUNT(*) as count
       FROM notified_bodies
       WHERE accreditation_status = 'active'
       GROUP BY country
       ORDER BY country`
    );
    res.json({ countries: result.rows });
  } catch (err: any) {
    console.error('[NOTIFIED-BODIES] Countries error:', err.message);
    res.status(500).json({ error: 'Failed to list countries' });
  }
});

/**
 * GET /api/notified-bodies/:id
 * Public — single body detail
 */
publicNotifiedBodiesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM notified_bodies WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Notified body not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('[NOTIFIED-BODIES] Get error:', err.message);
    res.status(500).json({ error: 'Failed to fetch notified body' });
  }
});

// ─── Admin router ─────────────────────────────────────────────

export const adminNotifiedBodiesRouter = Router();

/**
 * POST /api/admin/notified-bodies
 * Admin — create a new notified body entry
 */
adminNotifiedBodiesRouter.post(
  '/notified-bodies',
  requirePlatformAdmin,
  async (req: Request, res: Response) => {
    try {
      const {
        name, country, nando_number, website, email, phone, address,
        cra_modules, sectors, accreditation_status, accreditation_date, notes,
      } = req.body;

      // Validation
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }
      if (!country || !VALID_COUNTRIES.includes(country.toUpperCase() as any)) {
        res.status(400).json({ error: `Country must be a valid EU-27/EEA code (e.g. DE, FR)` });
        return;
      }
      if (cra_modules && !Array.isArray(cra_modules)) {
        res.status(400).json({ error: 'cra_modules must be an array of module codes (B, C, H)' });
        return;
      }
      if (cra_modules) {
        const invalid = cra_modules.filter((m: string) => !VALID_MODULES.includes(m.toUpperCase() as any));
        if (invalid.length > 0) {
          res.status(400).json({ error: `Invalid modules: ${invalid.join(', ')}. Valid: ${VALID_MODULES.join(', ')}` });
          return;
        }
      }
      if (accreditation_status && !VALID_STATUSES.includes(accreditation_status as AccreditationStatus)) {
        res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
        return;
      }

      const result = await pool.query(
        `INSERT INTO notified_bodies
         (name, country, nando_number, website, email, phone, address,
          cra_modules, sectors, accreditation_status, accreditation_date, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          name.trim(),
          country.toUpperCase(),
          nando_number || null,
          website || null,
          email || null,
          phone || null,
          address || null,
          JSON.stringify((cra_modules || []).map((m: string) => m.toUpperCase())),
          JSON.stringify(sectors || []),
          accreditation_status || 'active',
          accreditation_date || null,
          notes || null,
        ]
      );

      const adminUserId = (req as any).userId;
      const adminEmail = (req as any).email;
      const reqData = extractRequestData(req);
      await recordEvent({
        userId: adminUserId,
        email: adminEmail,
        eventType: 'notified_body_created',
        ...reqData,
        metadata: { notifiedBodyId: result.rows[0].id, name: name.trim(), country: country.toUpperCase() },
      });

      res.status(201).json(result.rows[0]);
    } catch (err: any) {
      console.error('[NOTIFIED-BODIES] Create error:', err.message);
      res.status(500).json({ error: 'Failed to create notified body' });
    }
  }
);

/**
 * PUT /api/admin/notified-bodies/:id
 * Admin — update an existing notified body
 */
adminNotifiedBodiesRouter.put(
  '/notified-bodies/:id',
  requirePlatformAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Check exists
      const existing = await pool.query('SELECT id FROM notified_bodies WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Notified body not found' });
        return;
      }

      const {
        name, country, nando_number, website, email, phone, address,
        cra_modules, sectors, accreditation_status, accreditation_date, notes,
      } = req.body;

      // Validation
      if (country && !VALID_COUNTRIES.includes(country.toUpperCase() as any)) {
        res.status(400).json({ error: 'Invalid country code' });
        return;
      }
      if (cra_modules && !Array.isArray(cra_modules)) {
        res.status(400).json({ error: 'cra_modules must be an array' });
        return;
      }
      if (accreditation_status && !VALID_STATUSES.includes(accreditation_status as AccreditationStatus)) {
        res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
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
      addField('nando_number', nando_number);
      addField('website', website);
      addField('email', email);
      addField('phone', phone);
      addField('address', address);
      if (cra_modules !== undefined) {
        setClauses.push(`cra_modules = $${idx++}`);
        params.push(JSON.stringify(cra_modules.map((m: string) => m.toUpperCase())));
      }
      if (sectors !== undefined) {
        setClauses.push(`sectors = $${idx++}`);
        params.push(JSON.stringify(sectors));
      }
      addField('accreditation_status', accreditation_status);
      addField('accreditation_date', accreditation_date);
      addField('notes', notes);

      params.push(id);

      const result = await pool.query(
        `UPDATE notified_bodies SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
        params
      );

      const adminUserId = (req as any).userId;
      const adminEmail = (req as any).email;
      const reqData = extractRequestData(req);
      await recordEvent({
        userId: adminUserId,
        email: adminEmail,
        eventType: 'notified_body_updated',
        ...reqData,
        metadata: { notifiedBodyId: id },
      });

      res.json(result.rows[0]);
    } catch (err: any) {
      console.error('[NOTIFIED-BODIES] Update error:', err.message);
      res.status(500).json({ error: 'Failed to update notified body' });
    }
  }
);

/**
 * DELETE /api/admin/notified-bodies/:id
 * Admin — remove a notified body entry
 */
adminNotifiedBodiesRouter.delete(
  '/notified-bodies/:id',
  requirePlatformAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        'DELETE FROM notified_bodies WHERE id = $1 RETURNING id, name',
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Notified body not found' });
        return;
      }

      const adminUserId = (req as any).userId;
      const adminEmail = (req as any).email;
      const reqData = extractRequestData(req);
      await recordEvent({
        userId: adminUserId,
        email: adminEmail,
        eventType: 'notified_body_deleted',
        ...reqData,
        metadata: { notifiedBodyId: id, name: result.rows[0].name },
      });

      res.json({ deleted: true, id });
    } catch (err: any) {
      console.error('[NOTIFIED-BODIES] Delete error:', err.message);
      res.status(500).json({ error: 'Failed to delete notified body' });
    }
  }
);

// ─── Product-scoped assessment tracking ───────────────────────

export const productNbAssessmentRouter = Router();

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
 * GET /:productId/nb-assessment
 * Get the current notified body assessment for a product (if any).
 * Joins with notified_bodies to include body details.
 */
productNbAssessmentRouter.get(
  '/:productId/nb-assessment',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params as { productId: string };
      const orgId = await getUserOrgId((req as any).userId);
      if (!orgId) { res.status(400).json({ error: 'No organisation context' }); return; }
      if (!(await verifyProductAccess(orgId, productId))) { res.status(404).json({ error: 'Product not found' }); return; }

      const result = await pool.query(
        `SELECT nba.*,
                nb.name AS body_name, nb.country AS body_country,
                nb.website AS body_website, nb.cra_modules AS body_modules
         FROM notified_body_assessments nba
         LEFT JOIN notified_bodies nb ON nba.notified_body_id = nb.id
         WHERE nba.product_id = $1 AND nba.org_id = $2`,
        [productId, orgId]
      );

      if (result.rows.length === 0) {
        res.json({ assessment: null });
        return;
      }

      res.json({ assessment: result.rows[0] });
    } catch (err: any) {
      console.error('[NB-ASSESSMENT] Get error:', err.message);
      res.status(500).json({ error: 'Failed to fetch assessment' });
    }
  }
);

/**
 * POST /:productId/nb-assessment
 * Create or start tracking a notified body assessment.
 * One per product (UNIQUE constraint).
 */
productNbAssessmentRouter.post(
  '/:productId/nb-assessment',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params as { productId: string };
      const orgId = await getUserOrgId((req as any).userId);
      if (!orgId) { res.status(400).json({ error: 'No organisation context' }); return; }
      if (!(await verifyProductAccess(orgId, productId))) { res.status(404).json({ error: 'Product not found' }); return; }

      const { notified_body_id, module, status, submitted_date, expected_completion, notes } = req.body;

      if (!module || !VALID_MODULES.includes(module.toUpperCase() as any)) {
        res.status(400).json({ error: `Module is required. Must be one of: ${VALID_MODULES.join(', ')}` });
        return;
      }
      if (status && !VALID_ASSESSMENT_STATUSES.includes(status as AssessmentStatus)) {
        res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_ASSESSMENT_STATUSES.join(', ')}` });
        return;
      }

      // Check for existing assessment
      const existing = await pool.query(
        'SELECT id FROM notified_body_assessments WHERE org_id = $1 AND product_id = $2',
        [orgId, productId]
      );
      if (existing.rows.length > 0) {
        res.status(409).json({ error: 'Assessment already exists for this product. Use PUT to update.' });
        return;
      }

      // Validate notified body if provided
      if (notified_body_id) {
        const nbCheck = await pool.query('SELECT id FROM notified_bodies WHERE id = $1', [notified_body_id]);
        if (nbCheck.rows.length === 0) {
          res.status(400).json({ error: 'Notified body not found' });
          return;
        }
      }

      const result = await pool.query(
        `INSERT INTO notified_body_assessments
         (org_id, product_id, notified_body_id, module, status, submitted_date, expected_completion, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          orgId, productId,
          notified_body_id || null,
          module.toUpperCase(),
          status || 'planning',
          submitted_date || null,
          expected_completion || null,
          notes || null,
        ]
      );

      res.status(201).json({ assessment: result.rows[0] });
    } catch (err: any) {
      console.error('[NB-ASSESSMENT] Create error:', err.message);
      res.status(500).json({ error: 'Failed to create assessment' });
    }
  }
);

/**
 * PUT /:productId/nb-assessment
 * Update the assessment status, dates, certificate, or notified body.
 */
productNbAssessmentRouter.put(
  '/:productId/nb-assessment',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params as { productId: string };
      const orgId = await getUserOrgId((req as any).userId);
      if (!orgId) { res.status(400).json({ error: 'No organisation context' }); return; }
      if (!(await verifyProductAccess(orgId, productId))) { res.status(404).json({ error: 'Product not found' }); return; }

      const existing = await pool.query(
        'SELECT id FROM notified_body_assessments WHERE org_id = $1 AND product_id = $2',
        [orgId, productId]
      );
      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'No assessment found for this product' });
        return;
      }

      const { notified_body_id, module, status, submitted_date, expected_completion, certificate_number, certificate_expiry, notes } = req.body;

      if (status && !VALID_ASSESSMENT_STATUSES.includes(status as AssessmentStatus)) {
        res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_ASSESSMENT_STATUSES.join(', ')}` });
        return;
      }
      if (module && !VALID_MODULES.includes(module.toUpperCase() as any)) {
        res.status(400).json({ error: `Invalid module. Must be one of: ${VALID_MODULES.join(', ')}` });
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

      if (notified_body_id !== undefined) {
        addField('notified_body_id', notified_body_id || null);
      }
      if (module) addField('module', module.toUpperCase());
      addField('status', status);
      addField('submitted_date', submitted_date);
      addField('expected_completion', expected_completion);
      addField('certificate_number', certificate_number);
      addField('certificate_expiry', certificate_expiry);
      addField('notes', notes);

      params.push(orgId, productId);

      const result = await pool.query(
        `UPDATE notified_body_assessments SET ${setClauses.join(', ')}
         WHERE org_id = $${idx} AND product_id = $${idx + 1}
         RETURNING *`,
        params
      );

      res.json({ assessment: result.rows[0] });
    } catch (err: any) {
      console.error('[NB-ASSESSMENT] Update error:', err.message);
      res.status(500).json({ error: 'Failed to update assessment' });
    }
  }
);

/**
 * DELETE /:productId/nb-assessment
 * Remove assessment tracking for a product.
 */
productNbAssessmentRouter.delete(
  '/:productId/nb-assessment',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params as { productId: string };
      const orgId = await getUserOrgId((req as any).userId);
      if (!orgId) { res.status(400).json({ error: 'No organisation context' }); return; }
      if (!(await verifyProductAccess(orgId, productId))) { res.status(404).json({ error: 'Product not found' }); return; }

      const result = await pool.query(
        'DELETE FROM notified_body_assessments WHERE org_id = $1 AND product_id = $2 RETURNING id',
        [orgId, productId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'No assessment found for this product' });
        return;
      }

      res.json({ deleted: true });
    } catch (err: any) {
      console.error('[NB-ASSESSMENT] Delete error:', err.message);
      res.status(500).json({ error: 'Failed to delete assessment' });
    }
  }
);

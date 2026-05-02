/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';
import { DEFAULT_TRIAL_DAYS, BONUS_TRIAL_DAYS } from '../services/billing.js';

const router = Router();

// Middleware to verify auth token
async function requireAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  (req as any).userId = payload.userId;
  (req as any).email = payload.email;
  next();
}

// POST /api/org – Create organisation
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const { name, country, companySize, craRole, industry } = req.body;
  const userId = (req as any).userId;
  const userEmail = (req as any).email;

  // Validation
  if (!name || !country || !companySize || !craRole) {
    res.status(400).json({ error: 'Name, country, company size, and CRA role are required' });
    return;
  }

  const validSizes = ['micro', 'small', 'medium', 'large'];
  if (!validSizes.includes(companySize)) {
    res.status(400).json({ error: 'Invalid company size. Must be: micro, small, medium, or large' });
    return;
  }

  const validRoles = ['manufacturer', 'importer', 'distributor', 'open_source_steward'];
  if (!validRoles.includes(craRole)) {
    res.status(400).json({ error: 'Invalid CRA role' });
    return;
  }

  try {
    // Check if user already has an org. Also pull the bonus code captured at
    // registration so we can apply the right trial duration and write the
    // affiliate attribution row.
    const existingUser = await pool.query(
      'SELECT org_id, bonus_code_used FROM users WHERE id = $1',
      [userId]
    );
    if (existingUser.rows[0]?.org_id) {
      res.status(409).json({ error: 'User already belongs to an organisation' });
      return;
    }
    const userBonusCode: string | null = existingUser.rows[0]?.bonus_code_used || null;

    // Resolve the affiliate behind the bonus code (if any). If the code was
    // valid at register time but the affiliate has since been disabled, treat
    // it as no code (default trial), but keep the code on record.
    let resolvedAffiliate: { id: string; commission_window_months: number } | null = null;
    if (userBonusCode) {
      const lookup = await pool.query(
        `SELECT id, commission_window_months FROM affiliates
         WHERE LOWER(bonus_code) = LOWER($1) AND enabled = TRUE LIMIT 1`,
        [userBonusCode]
      );
      if (lookup.rows.length > 0) {
        resolvedAffiliate = lookup.rows[0];
      }
    }
    const trialDays = resolvedAffiliate ? BONUS_TRIAL_DAYS : DEFAULT_TRIAL_DAYS;

    const orgId = uuidv4();

    // Create Organisation node in Neo4j and link to User
    const neo4jSession = getDriver().session();
    try {
      await neo4jSession.run(
        `CREATE (o:Organisation {
          id: $id,
          name: $name,
          country: $country,
          companySize: $companySize,
          craRole: $craRole,
          industry: $industry,
          createdAt: datetime(),
          updatedAt: datetime()
        })
        WITH o
        MATCH (u:User {id: $userId})
        MERGE (u)-[:ADMIN_OF]->(o)
        MERGE (u)-[:BELONGS_TO]->(o)
        RETURN o`,
        { id: orgId, name, country, companySize, craRole, industry: industry || '', userId }
      );
    } finally {
      await neo4jSession.close();
    }

    // Link user to org in Postgres
    await pool.query(
      'UPDATE users SET org_id = $1, org_role = $2, updated_at = NOW() WHERE id = $3',
      [orgId, 'admin', userId]
    );

    // Initialise billing record for the new org (free trial). Trial length
    // depends on whether a valid bonus code was captured at registration.
    await pool.query(
      `INSERT INTO org_billing (org_id, status, trial_ends_at, trial_duration_days)
       VALUES ($1, 'trial', NOW() + ($2::int * INTERVAL '1 day'), $2)`,
      [orgId, trialDays]
    );

    // Record affiliate attribution if the bonus code resolved to a live affiliate.
    if (resolvedAffiliate) {
      await pool.query(
        `INSERT INTO affiliate_attributions
           (affiliate_id, org_id, bonus_code_used, commission_window_ends_at)
         VALUES ($1, $2, $3, NOW() + ($4::int * INTERVAL '1 month'))`,
        [resolvedAffiliate.id, orgId, userBonusCode, resolvedAffiliate.commission_window_months]
      );
    }

    // Record org creation event
    const reqData = extractRequestData(req);
    await recordEvent({
      userId,
      email: userEmail,
      eventType: 'org_created',
      ipAddress: reqData.ipAddress,
      userAgent: reqData.userAgent,
      acceptLanguage: reqData.acceptLanguage,
      metadata: {
        orgId, orgName: name, country, companySize, craRole, industry: industry || '',
        trialDays,
        bonusCodeUsed: userBonusCode,
        affiliateId: resolvedAffiliate?.id ?? null,
      },
    });

    res.status(201).json({
      id: orgId,
      name,
      country,
      companySize,
      craRole,
      industry: industry || '',
      userRole: 'admin',
    });
  } catch (err) {
    console.error('Failed to create organisation:', err);
    res.status(500).json({ error: 'Failed to create organisation' });
  }
});

// GET /api/org – Get current user's organisation
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  try {
    const userResult = await pool.query(
      'SELECT org_id, org_role FROM users WHERE id = $1',
      [userId]
    );

    const orgId = userResult.rows[0]?.org_id;
    if (!orgId) {
      res.status(404).json({ error: 'No organisation found' });
      return;
    }

    // Fetch org from Neo4j
    const neo4jSession = getDriver().session();
    try {
      const result = await neo4jSession.run(
        'MATCH (o:Organisation {id: $id}) RETURN o',
        { id: orgId }
      );

      if (result.records.length === 0) {
        res.status(404).json({ error: 'Organisation not found in graph' });
        return;
      }

      const org = result.records[0].get('o').properties;
      res.json({
        id: org.id,
        name: org.name,
        country: org.country,
        companySize: org.companySize,
        craRole: org.craRole,
        industry: org.industry,
        website: org.website || '',
        contactEmail: org.contactEmail || '',
        contactPhone: org.contactPhone || '',
        street: org.street || '',
        city: org.city || '',
        postcode: org.postcode || '',
        userRole: userResult.rows[0].org_role,
      });
    } finally {
      await neo4jSession.close();
    }
  } catch (err) {
    console.error('Failed to fetch organisation:', err);
    res.status(500).json({ error: 'Failed to fetch organisation' });
  }
});

// PUT /api/org – Update organisation details
router.put('/', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).email;

  try {
    const userResult = await pool.query(
      'SELECT org_id, org_role FROM users WHERE id = $1',
      [userId]
    );

    const orgId = userResult.rows[0]?.org_id;
    if (!orgId) {
      res.status(404).json({ error: 'No organisation found' });
      return;
    }

    // Only admins can update org
    if (userResult.rows[0].org_role !== 'admin') {
      res.status(403).json({ error: 'Only org admins can update organisation details' });
      return;
    }

    const {
      name, country, companySize, craRole, industry,
      website, contactEmail, contactPhone,
      street, city, postcode,
    } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ error: 'Organisation name is required' });
      return;
    }

    const neo4jSession = getDriver().session();
    try {
      const result = await neo4jSession.run(
        `MATCH (o:Organisation {id: $orgId})
         SET o.name = $name,
             o.country = $country,
             o.companySize = $companySize,
             o.craRole = $craRole,
             o.industry = $industry,
             o.website = $website,
             o.contactEmail = $contactEmail,
             o.contactPhone = $contactPhone,
             o.street = $street,
             o.city = $city,
             o.postcode = $postcode,
             o.updatedAt = datetime()
         RETURN o`,
        {
          orgId,
          name: name.trim(),
          country: country || '',
          companySize: companySize || '',
          craRole: craRole || '',
          industry: industry || '',
          website: website?.trim() || '',
          contactEmail: contactEmail?.trim() || '',
          contactPhone: contactPhone?.trim() || '',
          street: street?.trim() || '',
          city: city?.trim() || '',
          postcode: postcode?.trim() || '',
        }
      );

      if (result.records.length === 0) {
        res.status(404).json({ error: 'Organisation not found' });
        return;
      }

      const org = result.records[0].get('o').properties;

      // Record telemetry
      const reqData = extractRequestData(req);
      await recordEvent({
        userId,
        email: userEmail,
        eventType: 'org_updated',
        ipAddress: reqData.ipAddress,
        userAgent: reqData.userAgent,
        metadata: { orgId, orgName: name.trim() },
      });

      res.json({
        id: org.id,
        name: org.name,
        country: org.country,
        companySize: org.companySize,
        craRole: org.craRole,
        industry: org.industry,
        website: org.website || '',
        contactEmail: org.contactEmail || '',
        contactPhone: org.contactPhone || '',
        street: org.street || '',
        city: org.city || '',
        postcode: org.postcode || '',
        userRole: userResult.rows[0].org_role,
      });
    } finally {
      await neo4jSession.close();
    }
  } catch (err) {
    console.error('Failed to update organisation:', err);
    res.status(500).json({ error: 'Failed to update organisation' });
  }
});

// GET /api/org/members – Get all members of the current user's organisation
router.get('/members', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  try {
    const userResult = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
    const orgId = userResult.rows[0]?.org_id;

    if (!orgId) {
      res.status(404).json({ error: 'No organisation found' });
      return;
    }

    const members = await pool.query(
      `SELECT id, email, org_role, preferred_language, created_at
       FROM users WHERE org_id = $1 ORDER BY created_at`,
      [orgId]
    );

    res.json({
      members: members.rows.map(m => ({
        id: m.id,
        email: m.email,
        orgRole: m.org_role,
        preferredLanguage: m.preferred_language,
        createdAt: m.created_at,
      })),
    });
  } catch (err) {
    console.error('Failed to fetch org members:', err);
    res.status(500).json({ error: 'Failed to fetch org members' });
  }
});

export default router;

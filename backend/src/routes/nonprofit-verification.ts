/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

/**
 * Non-Profit Verification — Route Handlers
 *
 * User endpoints (authenticated):
 *   POST /api/org/nonprofit-application       — submit application
 *   GET  /api/org/nonprofit-application        — check status
 *
 * Admin endpoints (platform admin):
 *   GET  /api/admin/nonprofit-applications      — list all applications
 *   GET  /api/admin/nonprofit-applications/:id  — single application detail
 *   PUT  /api/admin/nonprofit-applications/:id  — approve/reject/request info
 */

import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { verifySessionToken } from '../utils/token.js';
import { requirePlatformAdmin } from '../middleware/requirePlatformAdmin.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';
import { setClassificationManually, type TrustClassification } from '../services/trust-classification.js';

// ─── User-facing router ──────────────────────────────────────

export const nonprofitUserRouter = Router();

async function requireAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) { res.status(401).json({ error: 'No token provided' }); return; }
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

const VALID_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO', // EEA
  'GB', 'CH', 'US', 'CA', 'AU', 'NZ', 'JP', 'KR', 'IN', 'BR', // Common non-EU
] as const;

/**
 * POST /api/org/nonprofit-application
 * Submit a non-profit verification application.
 */
nonprofitUserRouter.post(
  '/nonprofit-application',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId((req as any).userId);
      if (!orgId) { res.status(400).json({ error: 'No organisation context' }); return; }

      const { organisation_name, country, registration_number, website } = req.body;

      if (!organisation_name || typeof organisation_name !== 'string' || organisation_name.trim().length === 0) {
        res.status(400).json({ error: 'Organisation name is required' }); return;
      }
      if (!country || !VALID_COUNTRIES.includes(country.toUpperCase() as any)) {
        res.status(400).json({ error: 'Valid country code is required' }); return;
      }
      if (!registration_number || typeof registration_number !== 'string' || registration_number.trim().length === 0) {
        res.status(400).json({ error: 'Registration number is required' }); return;
      }

      // Check for existing pending application
      const existing = await pool.query(
        `SELECT id, status FROM nonprofit_applications WHERE org_id = $1 AND status IN ('pending', 'info_requested') ORDER BY created_at DESC LIMIT 1`,
        [orgId]
      );
      if (existing.rows.length > 0) {
        res.status(409).json({
          error: 'An application is already pending',
          applicationId: existing.rows[0].id,
          status: existing.rows[0].status,
        });
        return;
      }

      const result = await pool.query(
        `INSERT INTO nonprofit_applications
         (org_id, organisation_name, country, registration_number, website)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          orgId,
          organisation_name.trim(),
          country.toUpperCase(),
          registration_number.trim(),
          website || null,
        ]
      );

      const reqData = extractRequestData(req);
      await recordEvent({
        userId: (req as any).userId,
        email: (req as any).email,
        eventType: 'nonprofit_application_submitted',
        ...reqData,
        metadata: { applicationId: result.rows[0].id, orgId },
      });

      res.status(201).json({ application: result.rows[0] });
    } catch (err: any) {
      console.error('[NONPROFIT] Submit error:', err.message);
      res.status(500).json({ error: 'Failed to submit application' });
    }
  }
);

/**
 * GET /api/org/nonprofit-application
 * Check current application status for the user's organisation.
 */
nonprofitUserRouter.get(
  '/nonprofit-application',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const orgId = await getUserOrgId((req as any).userId);
      if (!orgId) { res.status(400).json({ error: 'No organisation context' }); return; }

      const result = await pool.query(
        `SELECT * FROM nonprofit_applications WHERE org_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [orgId]
      );

      res.json({ application: result.rows[0] || null });
    } catch (err: any) {
      console.error('[NONPROFIT] Status error:', err.message);
      res.status(500).json({ error: 'Failed to fetch application status' });
    }
  }
);

// ─── Admin router ─────────────────────────────────────────────

export const nonprofitAdminRouter = Router();

const VALID_ADMIN_STATUSES = ['approved', 'rejected', 'info_requested'] as const;

/**
 * GET /api/admin/nonprofit-applications
 * List all non-profit applications (optionally filtered by status).
 */
nonprofitAdminRouter.get(
  '/nonprofit-applications',
  requirePlatformAdmin,
  async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      let sql = 'SELECT * FROM nonprofit_applications';
      const params: any[] = [];

      if (status && VALID_ADMIN_STATUSES.includes(status as any) || status === 'pending') {
        sql += ' WHERE status = $1';
        params.push(status);
      }

      sql += ' ORDER BY created_at DESC';

      const result = await pool.query(sql, params);
      res.json({ applications: result.rows, total: result.rows.length });
    } catch (err: any) {
      console.error('[NONPROFIT] Admin list error:', err.message);
      res.status(500).json({ error: 'Failed to list applications' });
    }
  }
);

/**
 * GET /api/admin/nonprofit-applications/:id
 * Single application detail.
 */
nonprofitAdminRouter.get(
  '/nonprofit-applications/:id',
  requirePlatformAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await pool.query('SELECT * FROM nonprofit_applications WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Application not found' }); return;
      }
      res.json(result.rows[0]);
    } catch (err: any) {
      console.error('[NONPROFIT] Admin get error:', err.message);
      res.status(500).json({ error: 'Failed to fetch application' });
    }
  }
);

/**
 * PUT /api/admin/nonprofit-applications/:id
 * Approve, reject, or request additional information.
 * On approval, sets the org's trust_classification to verified_nonprofit.
 */
nonprofitAdminRouter.put(
  '/nonprofit-applications/:id',
  requirePlatformAdmin,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, admin_notes } = req.body;

      if (!status || !VALID_ADMIN_STATUSES.includes(status as any)) {
        res.status(400).json({ error: `Status must be one of: ${VALID_ADMIN_STATUSES.join(', ')}` }); return;
      }

      const existing = await pool.query('SELECT * FROM nonprofit_applications WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Application not found' }); return;
      }

      const application = existing.rows[0];

      const result = await pool.query(
        `UPDATE nonprofit_applications SET
           status = $1, admin_notes = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
         WHERE id = $4 RETURNING *`,
        [status, admin_notes || null, (req as any).userId, id]
      );

      // On approval, update org trust classification
      if (status === 'approved') {
        await setClassificationManually(
          application.org_id,
          'verified_nonprofit' as TrustClassification,
          `Non-profit application approved (${application.organisation_name}, ${application.country}, reg: ${application.registration_number})`
        );
      }

      const reqData = extractRequestData(req);
      await recordEvent({
        userId: (req as any).userId,
        email: (req as any).email,
        eventType: `nonprofit_application_${status}`,
        ...reqData,
        metadata: { applicationId: id, orgId: application.org_id, status },
      });

      res.json({ application: result.rows[0] });
    } catch (err: any) {
      console.error('[NONPROFIT] Admin review error:', err.message);
      res.status(500).json({ error: 'Failed to review application' });
    }
  }
);

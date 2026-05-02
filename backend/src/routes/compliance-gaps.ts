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
 * Compliance Gap Narrator Routes
 *
 * GET /:productId/compliance-gaps – Deterministic gap analysis for a product
 *
 * Mount at: app.use('/api/products', complianceGapsRoutes)
 */

import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { verifySessionToken } from '../utils/token.js';
import { analyseComplianceGaps } from '../services/compliance-gaps.js';

const router = Router();

async function requireAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) { res.status(401).json({ error: 'No token provided' }); return; }
  const token = authHeader.split(' ')[1];
  try {
    const payload = verifySessionToken(token);
    if (!payload) { res.status(401).json({ error: 'Invalid token' }); return; }
    (req as any).userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

async function getUserOrgId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.org_id || null;
}

/**
 * GET /:productId/compliance-gaps
 * Returns a prioritised list of compliance gaps with recommended actions
 */
router.get(
  '/:productId/compliance-gaps',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params as { productId: string };
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);

      if (!orgId) return res.status(400).json({ error: 'No organisation context' });

      const result = await analyseComplianceGaps(productId, orgId);
      if (!result) return res.status(404).json({ error: 'Product not found' });

      res.json(result);
    } catch (error) {
      console.error('[COMPLIANCE-GAPS] Error:', error);
      res.status(500).json({ error: 'Failed to analyse compliance gaps' });
    }
  }
);

export default router;

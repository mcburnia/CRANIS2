/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

import { Request, Response } from 'express';
import pool from '../db/pool.js';
import { isFreeClassification, type TrustClassification } from '../services/trust-classification.js';

const TIER_RANK: Record<string, number> = { standard: 1, pro: 2, enterprise: 3 };

/**
 * Route-level middleware that checks the org's subscription plan.
 * Must run AFTER requireAuth (needs `(req as any).userId`).
 * Exempt orgs always pass. Fails open on errors.
 */
export function requirePlan(minPlan: string) {
  const minRank = TIER_RANK[minPlan] || 0;

  return async (req: Request, res: Response, next: Function) => {
    const userId = (req as any).userId;
    if (!userId) { res.status(401).json({ error: 'Not authenticated' }); return; }

    try {
      const userResult = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
      const orgId = userResult.rows[0]?.org_id;
      if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

      const billing = await pool.query(
        'SELECT plan, exempt, trust_classification FROM org_billing WHERE org_id = $1',
        [orgId]
      );
      const row = billing.rows[0];

      // No billing record or exempt → allow
      if (!row || row.exempt) { next(); return; }

      // Free trust classifications get standard-tier features
      // (they bypass billing charges but do not get Pro features unless explicitly set)
      const effectivePlan = row.trust_classification && isFreeClassification(row.trust_classification as TrustClassification)
        ? (row.plan || 'standard')  // Use their actual plan if set, otherwise standard
        : (row.plan || 'standard');

      const orgRank = TIER_RANK[effectivePlan] || 1;
      if (orgRank >= minRank) { next(); return; }

      res.status(403).json({
        error: 'feature_requires_plan',
        requiredPlan: minPlan,
        currentPlan: row.plan || 'standard',
        message: `This feature requires the ${minPlan} plan or higher.`,
      });
    } catch (err) {
      console.error('[REQUIRE-PLAN] Error checking plan:', err);
      // Fail open
      next();
    }
  };
}

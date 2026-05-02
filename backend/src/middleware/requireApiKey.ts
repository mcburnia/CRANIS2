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
 * API Key Authentication Middleware
 *
 * Validates the X-API-Key header against the api_keys table.
 * Sets req.orgId and req.apiKeyScopes on success.
 */

import { Request, Response, NextFunction } from 'express';
import { validateApiKey } from '../services/api-keys.js';
import pool from '../db/pool.js';

export function requireApiKey(requiredScope?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'] as string | undefined;
    if (!apiKey) {
      return res.status(401).json({ error: 'Missing X-API-Key header' });
    }

    const result = await validateApiKey(apiKey);
    if (!result) {
      return res.status(401).json({ error: 'Invalid or revoked API key' });
    }

    if (requiredScope && !result.scopes.includes(requiredScope)) {
      return res.status(403).json({ error: `Insufficient scope – requires ${requiredScope}` });
    }

    // Belt-and-braces: verify the org still has a Pro plan
    try {
      const billing = await pool.query(
        'SELECT plan, exempt FROM org_billing WHERE org_id = $1',
        [result.orgId]
      );
      const row = billing.rows[0];
      if (row && !row.exempt) {
        const plan = row.plan || 'standard';
        if (plan === 'standard') {
          return res.status(403).json({
            error: 'feature_requires_plan',
            requiredPlan: 'pro',
            currentPlan: plan,
            message: 'The Public API requires the Pro plan or higher.',
          });
        }
      }
    } catch (err) {
      console.error('[REQUIRE-API-KEY] Plan check error:', err);
      // Fail open – key is valid, don't block on billing query failure
    }

    (req as any).orgId = result.orgId;
    (req as any).apiKeyId = result.keyId;
    (req as any).apiKeyScopes = result.scopes;
    next();
  };
}

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
 * Bonus Code Route — /api/bonus-code
 *
 * Public, unauthenticated endpoint used by the signup form to validate a
 * bonus code before submission and show the prospect who's referring them.
 *
 * Returns no PII beyond the affiliate's display name. Self-referral checks
 * happen at register time (we don't know the prospect's email here).
 */

import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';

const router = Router();

// GET /api/bonus-code/validate?code=XXX
router.get('/validate', async (req: Request, res: Response) => {
  const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
  if (!code) {
    res.status(400).json({ valid: false, error: 'No code supplied' });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT bonus_code, display_name FROM affiliates
       WHERE LOWER(bonus_code) = LOWER($1) AND enabled = TRUE LIMIT 1`,
      [code]
    );

    if (result.rows.length === 0) {
      res.json({ valid: false });
      return;
    }

    res.json({
      valid: true,
      canonicalCode: result.rows[0].bonus_code,
      displayName: result.rows[0].display_name,
    });
  } catch (err) {
    console.error('[BONUS_CODE] Validation failed:', err);
    res.status(500).json({ valid: false, error: 'Validation failed' });
  }
});

export default router;

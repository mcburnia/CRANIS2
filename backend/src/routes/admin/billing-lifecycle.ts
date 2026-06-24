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
 * Admin Billing Lifecycle Route — /api/admin/billing/run-lifecycle
 *
 * Manual trigger for the trial/lapse/win-back lifecycle checks that normally
 * run from the daily scheduler. Useful for ops (force a pass after a config
 * change) and as the integration-test entry point for the lifecycle engine.
 *
 * Platform admin access required. The underlying sends are deduped per
 * (org, stage) in lifecycle_emails, so re-running is safe and idempotent.
 */

import { Router, Request, Response } from 'express';
import { requirePlatformAdmin } from '../../middleware/requirePlatformAdmin.js';
import { checkTrialExpiry, checkPaymentGrace } from '../../services/billing.js';

const router = Router();

router.post('/billing/run-lifecycle', requirePlatformAdmin, async (_req: Request, res: Response) => {
  try {
    await checkTrialExpiry();
    await checkPaymentGrace();
    res.json({ ran: true });
  } catch (err: any) {
    console.error('[ADMIN] Billing lifecycle run failed:', err.message);
    res.status(500).json({ error: 'Billing lifecycle run failed' });
  }
});

export default router;

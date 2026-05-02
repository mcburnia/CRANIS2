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
 * GRC/Audit Tool Bridge – PARKED (P4 #23)
 * Stub router to prevent build errors. Implementation deferred to post-launch.
 */
import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ status: 'parked', message: 'GRC bridge integration is not yet available' });
});

export default router;

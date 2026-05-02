/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

import { Router } from 'express';
import oauthRoutes from './oauth.js';
import syncRoutes from './sync.js';
import webhookRoutes from './webhook.js';

const router = Router();

router.use(oauthRoutes);
router.use(syncRoutes);
router.use(webhookRoutes);

export default router;

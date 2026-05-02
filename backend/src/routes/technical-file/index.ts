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
import sectionRoutes from './sections.js';
import docPdfRoutes from './doc-pdf.js';
import cvdPdfRoutes from './cvd-pdf.js';
import batchFillRoutes from './batch-fill.js';

const router = Router();

router.use(sectionRoutes);
router.use(docPdfRoutes);
router.use(cvdPdfRoutes);
router.use(batchFillRoutes);

export default router;

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

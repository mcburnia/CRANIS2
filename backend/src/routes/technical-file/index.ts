import { Router } from 'express';
import sectionRoutes from './sections.js';
import docPdfRoutes from './doc-pdf.js';
import cvdPdfRoutes from './cvd-pdf.js';

const router = Router();

router.use(sectionRoutes);
router.use(docPdfRoutes);
router.use(cvdPdfRoutes);

export default router;

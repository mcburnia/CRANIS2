import { Router } from 'express';
import dashboardRoutes from './dashboard.js';
import orgsRoutes from './orgs.js';
import usersRoutes from './users.js';
import auditLogRoutes from './audit-log.js';
import systemRoutes from './system.js';
import vulnScanRoutes from './vuln-scan.js';
import copilotRoutes from './copilot.js';

const router = Router();

router.use(dashboardRoutes);
router.use(orgsRoutes);
router.use(usersRoutes);
router.use(auditLogRoutes);
router.use(systemRoutes);
router.use(vulnScanRoutes);
router.use(copilotRoutes);

export default router;

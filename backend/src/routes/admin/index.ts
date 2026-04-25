import { Router } from 'express';
import dashboardRoutes from './dashboard.js';
import orgsRoutes from './orgs.js';
import usersRoutes from './users.js';
import auditLogRoutes from './audit-log.js';
import systemRoutes from './system.js';
import vulnScanRoutes from './vuln-scan.js';
import copilotRoutes from './copilot.js';
import retentionLedgerRoutes from './retention-ledger.js';
import analyticsRoutes from './analytics.js';
import welcomeLeadsRoutes from './welcome-leads.js';
import dataRetentionRoutes from './data-retention.js';
import affiliatesRoutes from './affiliates.js';
import { adminNotifiedBodiesRouter } from '../notified-bodies.js';
import { adminMarketSurveillanceRouter } from '../market-surveillance.js';
import { nonprofitAdminRouter } from '../nonprofit-verification.js';

const router = Router();

router.use(dashboardRoutes);
router.use(orgsRoutes);
router.use(usersRoutes);
router.use(auditLogRoutes);
router.use(systemRoutes);
router.use(vulnScanRoutes);
router.use(copilotRoutes);
router.use(retentionLedgerRoutes);
router.use(analyticsRoutes);
router.use(welcomeLeadsRoutes);
router.use(dataRetentionRoutes);
router.use(affiliatesRoutes);
router.use(adminNotifiedBodiesRouter);
router.use(adminMarketSurveillanceRouter);
router.use(nonprofitAdminRouter);

export default router;

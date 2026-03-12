import { Router } from 'express';
import oauthRoutes from './oauth.js';
import syncRoutes from './sync.js';
import webhookRoutes from './webhook.js';

const router = Router();

router.use(oauthRoutes);
router.use(syncRoutes);
router.use(webhookRoutes);

export default router;

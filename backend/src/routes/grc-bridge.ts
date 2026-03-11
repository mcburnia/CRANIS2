/**
 * GRC/Audit Tool Bridge — PARKED (P4 #23)
 * Stub router to prevent build errors. Implementation deferred to post-launch.
 */
import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ status: 'parked', message: 'GRC bridge integration is not yet available' });
});

export default router;

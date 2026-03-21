/**
 * Admin Data Retention Route — /api/admin/data-retention
 *
 * Manual trigger for the data retention cleanup job.
 * Enforces the retention periods documented in the Privacy Policy.
 *
 * Platform admin access required.
 */

import { Router, Request, Response } from 'express';
import pool from '../../db/pool.js';
import { requirePlatformAdmin } from '../../middleware/requirePlatformAdmin.js';
import { runRetentionCleanup, RetentionCleanupResponse } from '../account.js';

const router = Router();

/**
 * Manually trigger the data retention cleanup job.
 *
 * Deletes records that have exceeded their documented retention period:
 * - user_events > 90 days
 * - feedback > 2 years
 * - Expired verification tokens
 * - copilot_cache > 24 hours
 *
 * Logs the cleanup run and results to the audit trail.
 *
 * @route POST /api/admin/data-retention/run
 * @auth Platform admin required
 * @returns {RetentionCleanupResponse} 200 — Cleanup summary
 */
router.post('/data-retention/run', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const result: RetentionCleanupResponse = await runRetentionCleanup();

    // Audit trail — record that a retention cleanup was triggered
    try {
      await pool.query(
        `INSERT INTO product_activity_log
         (product_id, org_id, user_id, user_email, action, entity_type, entity_id, summary, metadata)
         VALUES ('_platform', '00000000-0000-0000-0000-000000000000', $1, $2,
                 'retention_cleanup', 'system', NULL, $3, $4)`,
        [
          (req as any).userId,
          (req as any).email,
          `Data retention cleanup completed. Deleted: ${result.deleted.expiredTelemetry} telemetry, ${result.deleted.expiredFeedback} feedback, ${result.deleted.expiredVerificationTokens} tokens, ${result.deleted.expiredCopilotCache} cache entries.`,
          JSON.stringify(result.deleted),
        ]
      );
    } catch (auditErr: any) {
      console.error('[ADMIN] Retention cleanup audit log failed:', auditErr.message);
    }

    res.json(result);
  } catch (err: any) {
    console.error('[ADMIN] Data retention cleanup failed:', err.message);
    res.status(500).json({ error: 'Data retention cleanup failed' });
  }
});

export default router;

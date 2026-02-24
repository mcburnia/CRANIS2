import pool from '../db/pool.js';
import type { GapBreakdown } from './hash-enrichment.js';

export interface CreateNotification {
  orgId: string;
  userId?: string | null;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  body: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a notification record in Postgres.
 * Non-blocking — failures are logged but never thrown.
 */
export async function createNotification(data: CreateNotification): Promise<string | null> {
  try {
    const result = await pool.query(
      `INSERT INTO notifications (org_id, user_id, type, severity, title, body, link, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        data.orgId,
        data.userId || null,
        data.type,
        data.severity,
        data.title,
        data.body,
        data.link || null,
        JSON.stringify(data.metadata || {}),
      ]
    );
    return result.rows[0]?.id || null;
  } catch (err) {
    console.error('[NOTIFICATIONS] Failed to create notification:', err);
    return null;
  }
}

/**
 * Get unread count for a user's org.
 * Returns notifications where user_id IS NULL (broadcast) OR user_id = userId.
 */
export async function getUnreadCount(orgId: string, userId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) AS cnt FROM notifications
     WHERE org_id = $1 AND is_read = FALSE
       AND (user_id IS NULL OR user_id = $2)`,
    [orgId, userId]
  );
  return parseInt(result.rows[0]?.cnt) || 0;
}

/**
 * Send compliance gap notifications to product stakeholders.
 *
 * Follows the same pattern as vulnerability scanner notifications:
 * - Targets product-level security_contact + org-level compliance_officer
 * - Sends user-specific notifications to stakeholders who are platform users
 * - Sends broadcast notification for all org members
 * - Debounces: skips if same gap count within 24 hours
 *
 * Never throws — logs warnings and continues on failure.
 */
export async function sendComplianceGapNotification(
  productId: string,
  orgId: string,
  productName: string,
  gaps: GapBreakdown,
  totalDeps: number
): Promise<void> {
  try {
    const totalGaps = gaps.noVersion + gaps.unsupportedEcosystem + gaps.notFound + gaps.fetchError;
    if (totalGaps === 0) return; // No gaps, no notification needed

    const gapPercentage = totalDeps > 0 ? Math.round((totalGaps / totalDeps) * 100) : 0;
    const severity: 'critical' | 'high' | 'medium' | 'low' | 'info' = gapPercentage > 20 ? 'high' : 'medium';

    // Debounce: check for recent notification with same gap count
    const recent = await pool.query(
      `SELECT metadata FROM notifications
       WHERE type = 'sbom_compliance_gap'
         AND metadata->>'productId' = $1
         AND created_at > NOW() - INTERVAL '24 hours'
       ORDER BY created_at DESC LIMIT 1`,
      [productId]
    );

    if (recent.rows.length > 0) {
      const lastMeta = recent.rows[0].metadata;
      if (lastMeta?.totalGaps === totalGaps) {
        console.log(`[COMPLIANCE] Skipping duplicate notification for ${productName} (${totalGaps} gaps unchanged)`);
        return;
      }
    }

    // Build notification body with categorised breakdown
    const parts: string[] = [];
    if (gaps.noVersion > 0) parts.push(`${gaps.noVersion} missing versions`);
    if (gaps.unsupportedEcosystem > 0) parts.push(`${gaps.unsupportedEcosystem} unsupported ecosystems`);
    if (gaps.notFound > 0) parts.push(`${gaps.notFound} not found in registry`);
    if (gaps.fetchError > 0) parts.push(`${gaps.fetchError} registry errors`);

    const title = `SBOM compliance gaps in ${productName}`;
    const body = `${totalGaps} of ${totalDeps} components (${gapPercentage}%) have compliance gaps: ${parts.join(', ')}. CRA Article 13 requires complete SBOMs with cryptographic hashes.`;
    const link = `/products/${productId}?tab=sbom`;
    const metadata = {
      productId,
      productName,
      totalGaps,
      totalDeps,
      gapPercentage,
      noVersion: gaps.noVersion,
      unsupportedEcosystem: gaps.unsupportedEcosystem,
      notFound: gaps.notFound,
      fetchError: gaps.fetchError,
    };

    // Query targeted stakeholders (security_contact + compliance_officer)
    const stakeholders = await pool.query(
      `SELECT DISTINCT s.email, s.role_key FROM stakeholders s
       WHERE (s.product_id = $1 AND s.role_key = 'security_contact')
          OR (s.org_id = $2 AND s.product_id IS NULL AND s.role_key = 'compliance_officer')`,
      [productId, orgId]
    );

    const notifiedUserIds = new Set<string>();

    // Send targeted notifications to stakeholders who are platform users
    for (const sh of stakeholders.rows) {
      if (!sh.email) continue;

      const userResult = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND org_id = $2',
        [sh.email, orgId]
      );

      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].id;
        if (!notifiedUserIds.has(userId)) {
          await createNotification({
            orgId,
            userId,
            type: 'sbom_compliance_gap',
            severity,
            title,
            body,
            link,
            metadata,
          });
          notifiedUserIds.add(userId);
        }
      }
    }

    // Broadcast notification for all org members
    await createNotification({
      orgId,
      userId: null,
      type: 'sbom_compliance_gap',
      severity,
      title,
      body,
      link,
      metadata,
    });

    console.log(`[COMPLIANCE] Sent gap notifications for ${productName}: ${totalGaps} gaps (${gapPercentage}%), ${notifiedUserIds.size} targeted + 1 broadcast`);
  } catch (err) {
    console.error('[COMPLIANCE] Failed to send gap notifications:', (err as Error).message);
  }
}

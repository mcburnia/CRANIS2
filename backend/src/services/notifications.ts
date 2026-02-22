import pool from '../db/pool.js';

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

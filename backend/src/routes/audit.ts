import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { verifySessionToken } from '../utils/token.js';

const router = Router();

// Middleware to verify auth token
async function requireAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  (req as any).userId = payload.userId;
  (req as any).email = payload.email;
  next();
}

// GET /api/audit-log — Get audit events for the user's organisation
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  try {
    // Get the user's org_id
    const userResult = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
    const orgId = userResult.rows[0]?.org_id;

    if (!orgId) {
      res.status(403).json({ error: 'No organisation found' });
      return;
    }

    // Query params for filtering
    const eventType = req.query.event_type as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    // Build query — get events for all users in the same org
    let query = `
      SELECT
        e.id,
        e.event_type,
        e.ip_address,
        e.user_agent,
        e.accept_language,
        e.browser_language,
        e.browser_timezone,
        e.referrer,
        e.metadata,
        e.created_at,
        u.email as user_email
      FROM user_events e
      JOIN users u ON e.user_id = u.id
      WHERE u.org_id = $1
    `;
    const params: unknown[] = [orgId];
    let paramIdx = 2;

    if (eventType) {
      query += ` AND e.event_type = $${paramIdx}`;
      params.push(eventType);
      paramIdx++;
    }

    query += ` ORDER BY e.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM user_events e
      JOIN users u ON e.user_id = u.id
      WHERE u.org_id = $1
    `;
    const countParams: unknown[] = [orgId];

    if (eventType) {
      countQuery += ` AND e.event_type = $2`;
      countParams.push(eventType);
    }

    const countResult = await pool.query(countQuery, countParams);

    // Get distinct event types for filter dropdown
    const typesResult = await pool.query(`
      SELECT DISTINCT e.event_type
      FROM user_events e
      JOIN users u ON e.user_id = u.id
      WHERE u.org_id = $1
      ORDER BY e.event_type
    `, [orgId]);

    res.json({
      events: result.rows.map(row => ({
        id: row.id,
        eventType: row.event_type,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        acceptLanguage: row.accept_language,
        browserLanguage: row.browser_language,
        browserTimezone: row.browser_timezone,
        referrer: row.referrer,
        metadata: row.metadata,
        createdAt: row.created_at,
        userEmail: row.user_email,
      })),
      total: parseInt(countResult.rows[0].total),
      eventTypes: typesResult.rows.map(r => r.event_type),
    });
  } catch (err) {
    console.error('Failed to fetch audit log:', err);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

export default router;

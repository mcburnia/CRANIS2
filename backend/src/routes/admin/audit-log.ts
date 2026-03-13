import { Router, Request, Response } from 'express';
import pool from '../../db/pool.js';
import { getDriver } from '../../db/neo4j.js';
import { requirePlatformAdmin } from '../../middleware/requirePlatformAdmin.js';

const router = Router();

// GET /api/admin/audit-log – Cross-org audit log with filtering + pagination
router.get('/audit-log', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;
    const eventType = (req.query.eventType as string) || '';
    const email = (req.query.email as string) || '';

    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (eventType) {
      whereConditions.push(`e.event_type = $${paramIndex}`);
      params.push(eventType);
      paramIndex++;
    }
    if (email) {
      whereConditions.push(`LOWER(u.email) LIKE $${paramIndex}`);
      params.push(`%${email.toLowerCase()}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Count total
    const countResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM user_events e
       LEFT JOIN users u ON e.user_id = u.id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Fetch page
    const eventsResult = await pool.query(
      `SELECT e.id, e.event_type, e.ip_address, e.user_agent, e.metadata, e.created_at,
              COALESCE(u.email, 'system') AS user_email, u.org_id
       FROM user_events e
       LEFT JOIN users u ON e.user_id = u.id
       ${whereClause}
       ORDER BY e.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    // Get org names for the events
    const orgIds = [...new Set(eventsResult.rows.map((r: any) => r.org_id).filter(Boolean))];
    let orgNameMap: Record<string, string> = {};
    if (orgIds.length > 0) {
      const driver = getDriver();
      const session = driver.session();
      try {
        const orgResult = await session.run(
          'MATCH (o:Organisation) WHERE o.id IN $orgIds RETURN o.id AS id, o.name AS name',
          { orgIds }
        );
        for (const record of orgResult.records) {
          orgNameMap[record.get('id')] = record.get('name');
        }
      } finally {
        await session.close();
      }
    }

    // Get distinct event types for filter dropdown
    const typesResult = await pool.query(
      'SELECT DISTINCT event_type FROM user_events ORDER BY event_type'
    );
    const eventTypes = typesResult.rows.map((r: any) => r.event_type);

    const events = eventsResult.rows.map((r: any) => ({
      id: r.id,
      eventType: r.event_type,
      ipAddress: r.ip_address,
      userAgent: r.user_agent,
      metadata: r.metadata,
      createdAt: r.created_at,
      userEmail: r.user_email,
      orgName: r.org_id ? (orgNameMap[r.org_id] || null) : null,
    }));

    res.json({
      events,
      eventTypes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (err) {
    console.error('Admin audit log error:', err);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

export default router;

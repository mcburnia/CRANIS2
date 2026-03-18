import { Router, Request, Response } from 'express';
import pool from '../../db/pool.js';
import { requirePlatformAdmin } from '../../middleware/requirePlatformAdmin.js';

const router = Router();

// GET /api/admin/contact-submissions – List contact form submissions with pagination
router.get('/contact-submissions', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;
    const status = (req.query.status as string) || '';
    const email = (req.query.email as string) || '';

    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (status) {
      whereConditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }
    if (email) {
      whereConditions.push(`LOWER(email) LIKE $${paramIndex}`);
      params.push(`%${email.toLowerCase()}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM contact_submissions ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const dataResult = await pool.query(
      `SELECT id, name, email, position, status, lead_notified, lead_notify_error,
              ip, country, user_agent, created_at, verified_at, updated_at
       FROM contact_submissions
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    // Summary stats
    const statsResult = await pool.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status = 'pending_verification') AS pending,
         COUNT(*) FILTER (WHERE status = 'verified') AS verified,
         COUNT(*) FILTER (WHERE status = 'lead_notified') AS notified,
         COUNT(*) FILTER (WHERE status = 'lead_failed') AS failed
       FROM contact_submissions`
    );

    res.json({
      submissions: dataResult.rows,
      stats: statsResult.rows[0],
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Admin contact submissions error:', err);
    res.status(500).json({ error: 'Failed to fetch contact submissions.' });
  }
});

// GET /api/admin/disposable-email-log – List disposable email honeypot entries
router.get('/disposable-email-log', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;
    const source = (req.query.source as string) || '';

    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (source) {
      whereConditions.push(`source = $${paramIndex}`);
      params.push(source);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM disposable_email_log ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const dataResult = await pool.query(
      `SELECT id, email, name, domain, ip, country, user_agent, source, created_at
       FROM disposable_email_log
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    // Domain summary
    const domainStats = await pool.query(
      `SELECT domain, COUNT(*) AS count
       FROM disposable_email_log
       GROUP BY domain
       ORDER BY count DESC
       LIMIT 20`
    );

    res.json({
      entries: dataResult.rows,
      domainStats: domainStats.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Admin disposable email log error:', err);
    res.status(500).json({ error: 'Failed to fetch disposable email log.' });
  }
});

export default router;

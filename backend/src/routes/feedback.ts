import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { verifySessionToken } from '../utils/token.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';

const router = Router();

async function requireAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) { res.status(401).json({ error: 'No token provided' }); return; }
  const token = authHeader.split(' ')[1];
  try {
    const payload = verifySessionToken(token);
    if (!payload) { res.status(401).json({ error: 'Invalid token' }); return; }
    (req as any).userId = payload.userId;
    (req as any).email = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

async function getOrgId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.org_id || null;
}

// POST /api/feedback — Submit feedback or bug report
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const email = (req as any).email;
  const { category, subject, body, pageUrl } = req.body;

  if (!subject || !body) {
    res.status(400).json({ error: 'Subject and description are required' });
    return;
  }

  if (!['feedback', 'bug', 'feature'].includes(category || 'feedback')) {
    res.status(400).json({ error: 'Invalid category' });
    return;
  }

  try {
    const orgId = await getOrgId(userId);
    const userAgent = req.headers['user-agent'] || null;

    const result = await pool.query(
      'INSERT INTO feedback (user_id, org_id, email, category, subject, body, page_url, user_agent) ' +
      'VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, created_at',
      [userId, orgId, email, category || 'feedback', subject, body, pageUrl || null, userAgent]
    );

    const reqData = extractRequestData(req);
    await recordEvent({
      userId,
      email,
      eventType: 'feedback_submitted',
      ...reqData,
      metadata: { feedbackId: result.rows[0].id, category: category || 'feedback' },
    });

    res.json({ id: result.rows[0].id, createdAt: result.rows[0].created_at });
  } catch (err) {
    console.error('Failed to submit feedback:', err);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

export default router;

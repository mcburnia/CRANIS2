/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { verifySessionToken } from '../utils/token.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';
import {
  sendFeedbackNotification,
  FeedbackNotificationData,
} from '../services/email.js';

const router = Router();

const DEV_SKIP_EMAIL = process.env.DEV_SKIP_EMAIL === 'true';

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

// POST /api/feedback – Submit feedback or bug report
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

    // Support notification — fire-and-forget. Failures (Resend outage,
    // misconfigured domain, missing API key) MUST NOT bubble up to the
    // submitter; we log instead. Skipped in dev/test mode for the same
    // reason sendVerificationEmail is skipped — regression runs would
    // otherwise blast support@cranis2.com on every test feedback row.
    if (!DEV_SKIP_EMAIL) {
      const context = await pool.query<{
        display_name: string | null;
        org_role: string | null;
        company_name: string | null;
        plan: string | null;
        status: string | null;
      }>(
        `SELECT u.display_name, u.org_role,
                ob.company_name, ob.plan, ob.status
           FROM users u
           LEFT JOIN org_billing ob ON ob.org_id = u.org_id::text
          WHERE u.id = $1`,
        [userId],
      ).catch(() => ({ rows: [] as Array<{
        display_name: string | null;
        org_role: string | null;
        company_name: string | null;
        plan: string | null;
        status: string | null;
      }> }));

      const ctx = context.rows[0] || {
        display_name: null, org_role: null, company_name: null, plan: null, status: null,
      };
      const now = new Date();
      const submittedAtLocal = new Intl.DateTimeFormat('en-IE', {
        timeZone: 'Europe/Dublin',
        dateStyle: 'medium',
        timeStyle: 'long',
      }).format(now);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';

      const notifyData: FeedbackNotificationData = {
        category: (category || 'feedback') as FeedbackNotificationData['category'],
        subject,
        body,
        submitterEmail: email,
        submitterDisplayName: ctx.display_name,
        submitterOrgRole: ctx.org_role,
        companyName: ctx.company_name,
        plan: ctx.plan,
        billingStatus: ctx.status,
        pageUrl: pageUrl || null,
        adminFeedbackUrl: `${frontendUrl}/admin/feedback`,
        submittedAtIso: now.toISOString(),
        submittedAtLocal,
      };
      sendFeedbackNotification(notifyData).catch((err) => {
        console.error('[feedback-notify] failed to send support notification:', err);
      });
    }

    res.json({ id: result.rows[0].id, createdAt: result.rows[0].created_at });
  } catch (err) {
    console.error('Failed to submit feedback:', err);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { verifySessionToken } from '../utils/token.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';
import {
  countActiveContributors,
  getOrgBillingStatus,
  ensureOrgBilling,
  updateBillingStatus,
  createCheckoutSession,
  createPortalSession,
  processWebhookEvent,
  constructWebhookEvent,
} from '../services/billing.js';
import { requirePlatformAdmin } from '../middleware/requirePlatformAdmin.js';

const router = Router();

// ── Auth middleware (per-route pattern) ──

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

// ═══════════════════════════════════════════════
// PUBLIC — Stripe Webhook (no auth, signature only)
// ═══════════════════════════════════════════════

router.post('/webhook', async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'] as string;
  if (!signature) {
    res.status(400).json({ error: 'Missing Stripe signature' });
    return;
  }

  const rawBody = (req as any).rawBody;
  if (!rawBody) {
    res.status(400).json({ error: 'Missing raw body' });
    return;
  }

  try {
    const event = constructWebhookEvent(rawBody, signature);
    console.log(`[BILLING WEBHOOK] Received: ${event.type} (${event.id})`);
    await processWebhookEvent(event);
    res.json({ received: true });
  } catch (err: any) {
    console.error('[BILLING WEBHOOK] Error:', err.message);
    res.status(400).json({ error: 'Webhook signature verification failed' });
  }
});

// ═══════════════════════════════════════════════
// AUTHENTICATED — Billing status & operations
// ═══════════════════════════════════════════════

// GET /api/billing/status — Current org billing status
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const billing = await ensureOrgBilling(orgId);

    // Get live contributor count
    const counts = await countActiveContributors(orgId);

    // Calculate days remaining for trial
    let trialDaysRemaining: number | null = null;
    if (billing.status === 'trial' && billing.trialEndsAt) {
      const now = new Date();
      const trialEnd = new Date(billing.trialEndsAt);
      trialDaysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }

    res.json({
      ...billing,
      contributorCounts: counts,
      trialDaysRemaining,
      monthlyAmountCents: counts.active * 600,
      pricePerContributor: 600,
    });
  } catch (err) {
    console.error('Failed to fetch billing status:', err);
    res.status(500).json({ error: 'Failed to fetch billing status' });
  }
});

// GET /api/billing/contributors — Contributor roster with categories
router.get('/contributors', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const counts = await countActiveContributors(orgId);
    res.json(counts);
  } catch (err) {
    console.error('Failed to fetch contributors:', err);
    res.status(500).json({ error: 'Failed to fetch contributors' });
  }
});

// POST /api/billing/checkout — Create Stripe Checkout session
router.post('/checkout', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const email = (req as any).email;
  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const url = await createCheckoutSession(orgId, email);

    const reqData = extractRequestData(req);
    await recordEvent({
      userId, email, eventType: 'billing_checkout_started', ...reqData,
      metadata: { orgId },
    });

    res.json({ url });
  } catch (err) {
    console.error('Failed to create checkout session:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/billing/portal — Create Stripe Customer Portal session
router.post('/portal', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const url = await createPortalSession(orgId);
    res.json({ url });
  } catch (err: any) {
    console.error('Failed to create portal session:', err);
    res.status(500).json({ error: err.message || 'Failed to create portal session' });
  }
});

// POST /api/billing/contributors/:login/departed — Mark contributor as departed
router.post('/contributors/:login/departed', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const login = req.params.login as string;
  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    // Check user is org admin
    const user = await pool.query('SELECT org_role FROM users WHERE id = $1', [userId]);
    if (user.rows[0]?.org_role !== 'admin') {
      res.status(403).json({ error: 'Only organisation admins can mark contributors as departed' });
      return;
    }

    await pool.query(
      `INSERT INTO departed_contributors (org_id, github_login, marked_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (org_id, github_login) DO NOTHING`,
      [orgId, login, userId]
    );

    const reqData = extractRequestData(req);
    await recordEvent({
      userId, email: (req as any).email, eventType: 'contributor_marked_departed', ...reqData,
      metadata: { orgId, githubLogin: login },
    });

    res.json({ success: true, login });
  } catch (err) {
    console.error('Failed to mark contributor as departed:', err);
    res.status(500).json({ error: 'Failed to mark contributor as departed' });
  }
});

// DELETE /api/billing/contributors/:login/departed — Un-mark contributor
router.delete('/contributors/:login/departed', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const login = req.params.login as string;
  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const user = await pool.query('SELECT org_role FROM users WHERE id = $1', [userId]);
    if (user.rows[0]?.org_role !== 'admin') {
      res.status(403).json({ error: 'Only organisation admins can manage contributor status' });
      return;
    }

    await pool.query(
      'DELETE FROM departed_contributors WHERE org_id = $1 AND github_login = $2',
      [orgId, login]
    );

    res.json({ success: true, login });
  } catch (err) {
    console.error('Failed to un-mark contributor:', err);
    res.status(500).json({ error: 'Failed to un-mark contributor' });
  }
});

// ═══════════════════════════════════════════════
// ADMIN — Platform admin billing controls
// ═══════════════════════════════════════════════

// GET /api/billing/admin/overview — All orgs billing overview
router.get('/admin/overview', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT ob.*, o_users.user_count
      FROM org_billing ob
      LEFT JOIN (
        SELECT org_id, COUNT(*) AS user_count
        FROM users
        WHERE org_id IS NOT NULL
        GROUP BY org_id
      ) o_users ON ob.org_id = o_users.org_id::text
      ORDER BY ob.created_at DESC
    `);

    // Also get org names from Neo4j
    const { getDriver } = await import('../db/neo4j.js');
    const driver = getDriver();
    const session = driver.session();
    let orgNames = new Map<string, string>();
    try {
      const neo4jResult = await session.run('MATCH (o:Organisation) RETURN o.id AS id, o.name AS name');
      for (const r of neo4jResult.records) {
        orgNames.set(r.get('id'), r.get('name'));
      }
    } finally {
      await session.close();
    }

    const orgs = result.rows.map(row => ({
      orgId: row.org_id,
      orgName: orgNames.get(row.org_id) || 'Unknown',
      status: row.status,
      stripeCustomerId: row.stripe_customer_id,
      contributorCount: row.contributor_count,
      monthlyAmountCents: row.monthly_amount_cents,
      trialEndsAt: row.trial_ends_at,
      trialDurationDays: row.trial_duration_days,
      currentPeriodEnd: row.current_period_end,
      exempt: row.exempt,
      exemptReason: row.exempt_reason,
      paymentPauseUntil: row.payment_pause_until,
      cancelledAt: row.cancelled_at,
      userCount: row.user_count || 0,
      createdAt: row.created_at,
    }));

    // Calculate totals
    const paying = orgs.filter(o => o.status === 'active');
    const trials = orgs.filter(o => o.status === 'trial');
    const pastDue = orgs.filter(o => ['past_due', 'read_only', 'suspended'].includes(o.status));
    const mrr = paying.reduce((sum, o) => sum + o.monthlyAmountCents, 0);

    res.json({
      orgs,
      totals: {
        totalOrgs: orgs.length,
        paying: paying.length,
        trials: trials.length,
        pastDue: pastDue.length,
        exempt: orgs.filter(o => o.exempt).length,
        cancelled: orgs.filter(o => o.status === 'cancelled').length,
        mrr,
      },
    });
  } catch (err) {
    console.error('Failed to fetch admin billing overview:', err);
    res.status(500).json({ error: 'Failed to fetch billing overview' });
  }
});

// PUT /api/billing/admin/:orgId/trial — Extend/modify trial
router.put('/admin/:orgId/trial', requirePlatformAdmin, async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const { daysToAdd, newEndDate } = req.body;
  try {
    if (newEndDate) {
      await updateBillingStatus(orgId as string, { trialEndsAt: newEndDate, graceEndsAt: null });
    } else if (daysToAdd) {
      await pool.query(
        `UPDATE org_billing SET trial_ends_at = COALESCE(trial_ends_at, NOW()) + INTERVAL '1 day' * $1,
         grace_ends_at = NULL, status = 'trial', updated_at = NOW()
         WHERE org_id = $2`,
        [daysToAdd, orgId]
      );
    }

    const reqData = extractRequestData(req);
    await recordEvent({
      userId: (req as any).userId, email: (req as any).email,
      eventType: 'admin_trial_extended', ...reqData,
      metadata: { orgId, daysToAdd, newEndDate },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to update trial:', err);
    res.status(500).json({ error: 'Failed to update trial' });
  }
});

// PUT /api/billing/admin/:orgId/exempt — Toggle billing exemption
router.put('/admin/:orgId/exempt', requirePlatformAdmin, async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const { exempt, reason } = req.body;
  try {
    await updateBillingStatus(orgId as string, {
      exempt: !!exempt,
      exemptReason: reason || null,
      status: exempt ? 'exempt' : 'trial',
    });

    const reqData = extractRequestData(req);
    await recordEvent({
      userId: (req as any).userId, email: (req as any).email,
      eventType: exempt ? 'admin_org_exempted' : 'admin_org_unexempted', ...reqData,
      metadata: { orgId, reason },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to update exemption:', err);
    res.status(500).json({ error: 'Failed to update exemption' });
  }
});

// PUT /api/billing/admin/:orgId/pause — Payment pause
router.put('/admin/:orgId/pause', requirePlatformAdmin, async (req: Request, res: Response) => {
  const { orgId } = req.params;
  const { days, reason } = req.body;
  try {
    const pauseUntil = new Date();
    pauseUntil.setDate(pauseUntil.getDate() + (days || 30));

    await updateBillingStatus(orgId as string, {
      paymentPauseUntil: pauseUntil.toISOString(),
      paymentPauseReason: reason || null,
    });

    const reqData = extractRequestData(req);
    await recordEvent({
      userId: (req as any).userId, email: (req as any).email,
      eventType: 'admin_payment_paused', ...reqData,
      metadata: { orgId, days, reason, pauseUntil: pauseUntil.toISOString() },
    });

    res.json({ success: true, pauseUntil: pauseUntil.toISOString() });
  } catch (err) {
    console.error('Failed to apply payment pause:', err);
    res.status(500).json({ error: 'Failed to apply payment pause' });
  }
});

export default router;

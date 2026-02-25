import Stripe from 'stripe';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { createNotification } from './notifications.js';
import {
  sendTrialExpiryWarning, sendTrialExpired, sendTrialGraceEnded,
  sendPaymentFailed, sendAccessRestricted, sendSubscriptionCancelled,
} from './billing-emails.js';

// ── Stripe client (lazy init to avoid crash when key not set) ──
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = new Stripe(key, { apiVersion: '2025-01-27.acacia' as any });
  }
  return _stripe;
}

const PRICE_ID = process.env.STRIPE_PRICE_ID || '';
const APP_BASE_URL = process.env.FRONTEND_URL || 'https://dev.cranis2.dev';
const PRICE_PER_CONTRIBUTOR_CENTS = 600; // €6.00

// ── Bot detection ──
const BOT_SUFFIXES = ['[bot]', '-bot', '_bot'];
const BOT_NAMES = new Set([
  'dependabot', 'renovate', 'github-actions', 'snyk-bot', 'codecov-bot',
  'greenkeeper', 'depfu', 'imgbot', 'allcontributors', 'semantic-release-bot',
  'mergify', 'codeclimate', 'sonarcloud', 'deepsource-autofix',
]);

function isBot(login: string): boolean {
  const lower = login.toLowerCase();
  if (BOT_NAMES.has(lower)) return true;
  return BOT_SUFFIXES.some(suffix => lower.endsWith(suffix));
}

// ── Contributor Counting ──

export interface ContributorInfo {
  githubLogin: string;
  githubId: number;
  avatarUrl: string;
  contributions: number;
  lastCommitAt: string | null;
  category: 'active' | 'bot' | 'departed' | 'inactive';
}

export interface ContributorCounts {
  active: number;
  bots: number;
  departed: number;
  inactive: number;
  total: number;
  contributors: ContributorInfo[];
}

export async function countActiveContributors(orgId: string): Promise<ContributorCounts> {
  const driver = getDriver();
  const session = driver.session();

  let allContributors: any[] = [];
  try {
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product)
             -[:HAS_REPO]->(r:GitHubRepo)-[:HAS_CONTRIBUTOR]->(c:Contributor)
       RETURN DISTINCT c.githubLogin AS login, c.githubId AS githubId,
              c.avatarUrl AS avatarUrl, c.contributions AS contributions,
              c.type AS type
       ORDER BY c.contributions DESC`,
      { orgId }
    );
    allContributors = result.records.map(r => ({
      login: r.get('login'),
      githubId: typeof r.get('githubId') === 'object'
        ? (r.get('githubId') as any).toNumber?.() ?? r.get('githubId')
        : r.get('githubId'),
      avatarUrl: r.get('avatarUrl') || '',
      contributions: typeof r.get('contributions') === 'object'
        ? (r.get('contributions') as any).toNumber?.() ?? r.get('contributions')
        : r.get('contributions') || 0,
      type: r.get('type') || 'User',
    }));
  } finally {
    await session.close();
  }

  // Get departed contributors
  const departedResult = await pool.query(
    'SELECT github_login FROM departed_contributors WHERE org_id = $1',
    [orgId]
  );
  const departedLogins = new Set(departedResult.rows.map(r => r.github_login));

  // Categorise
  const contributors: ContributorInfo[] = allContributors.map(c => {
    let category: ContributorInfo['category'];
    if (isBot(c.login) || c.type === 'Bot') {
      category = 'bot';
    } else if (departedLogins.has(c.login)) {
      category = 'departed';
    } else {
      // TODO: When we have lastCommitAt on Contributor nodes, use 90-day window
      // For now, all non-bot non-departed contributors are 'active'
      category = 'active';
    }

    return {
      githubLogin: c.login,
      githubId: c.githubId,
      avatarUrl: c.avatarUrl,
      contributions: c.contributions,
      lastCommitAt: null,
      category,
    };
  });

  const active = contributors.filter(c => c.category === 'active').length;
  const bots = contributors.filter(c => c.category === 'bot').length;
  const departed = contributors.filter(c => c.category === 'departed').length;
  const inactive = contributors.filter(c => c.category === 'inactive').length;

  return { active, bots, departed, inactive, total: contributors.length, contributors };
}

// ── Billing Status ──

export interface BillingStatus {
  orgId: string;
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  trialEndsAt: string | null;
  trialDurationDays: number;
  graceEndsAt: string | null;
  currentPeriodEnd: string | null;
  contributorCount: number;
  monthlyAmountCents: number;
  billingEmail: string | null;
  companyName: string | null;
  billingAddress: any;
  vatNumber: string | null;
  paymentPauseUntil: string | null;
  paymentPauseReason: string | null;
  exempt: boolean;
  exemptReason: string | null;
  cancelledAt: string | null;
}

export async function getOrgBillingStatus(orgId: string): Promise<BillingStatus | null> {
  const result = await pool.query(
    'SELECT * FROM org_billing WHERE org_id = $1',
    [orgId]
  );
  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    orgId: row.org_id,
    status: row.status,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    trialEndsAt: row.trial_ends_at,
    trialDurationDays: row.trial_duration_days,
    graceEndsAt: row.grace_ends_at,
    currentPeriodEnd: row.current_period_end,
    contributorCount: row.contributor_count,
    monthlyAmountCents: row.monthly_amount_cents,
    billingEmail: row.billing_email,
    companyName: row.company_name,
    billingAddress: row.billing_address,
    vatNumber: row.vat_number,
    paymentPauseUntil: row.payment_pause_until,
    paymentPauseReason: row.payment_pause_reason,
    exempt: row.exempt,
    exemptReason: row.exempt_reason,
    cancelledAt: row.cancelled_at,
  };
}

// ── Ensure billing record exists (auto-create trial for new orgs) ──

export async function ensureOrgBilling(orgId: string): Promise<BillingStatus> {
  const existing = await getOrgBillingStatus(orgId);
  if (existing) return existing;

  // Auto-create a trial record
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 90);

  await pool.query(
    `INSERT INTO org_billing (org_id, status, trial_ends_at, trial_duration_days)
     VALUES ($1, 'trial', $2, 90)
     ON CONFLICT (org_id) DO NOTHING`,
    [orgId, trialEnd.toISOString()]
  );

  await logBillingEvent(orgId, 'trial_started', { trialDays: 90 });
  console.log(`[BILLING] Auto-created trial for org ${orgId}, expires ${trialEnd.toISOString()}`);

  return (await getOrgBillingStatus(orgId))!;
}

export async function updateBillingStatus(orgId: string, updates: Record<string, any>): Promise<void> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const values: any[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    // Convert camelCase to snake_case
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    setClauses.push(`${snakeKey} = $${paramIndex}`);
    values.push(value);
    paramIndex++;
  }

  values.push(orgId);
  await pool.query(
    `UPDATE org_billing SET ${setClauses.join(', ')} WHERE org_id = $${paramIndex}`,
    values
  );
}

// ── Stripe Operations ──

export async function createCheckoutSession(orgId: string, email: string): Promise<string> {
  // Count contributors to set initial quantity
  const counts = await countActiveContributors(orgId);
  const quantity = Math.max(1, counts.active); // Minimum 1 contributor

  // Get or create Stripe customer
  const billing = await getOrgBillingStatus(orgId);
  let customerId = billing?.stripeCustomerId;

  if (!customerId) {
    const customer = await getStripe().customers.create({
      email,
      metadata: { orgId },
    });
    customerId = customer.id;
    await updateBillingStatus(orgId, { stripeCustomerId: customerId });
  }

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{
      price: PRICE_ID,
      quantity,
    }],
    subscription_data: {
      metadata: { orgId },
    },
    automatic_tax: { enabled: true },
    tax_id_collection: { enabled: true },
    billing_address_collection: 'required',
    success_url: `${APP_BASE_URL}/billing?success=true`,
    cancel_url: `${APP_BASE_URL}/billing?cancelled=true`,
    metadata: { orgId },
  });

  return session.url || '';
}

export async function createPortalSession(orgId: string): Promise<string> {
  const billing = await getOrgBillingStatus(orgId);
  if (!billing?.stripeCustomerId) {
    throw new Error('No Stripe customer found for this organisation');
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: billing.stripeCustomerId,
    return_url: `${APP_BASE_URL}/billing`,
  });

  return session.url;
}

// ── Webhook Processing ──

export async function processWebhookEvent(event: Stripe.Event): Promise<void> {
  // Idempotency check
  const existing = await pool.query(
    'SELECT id FROM billing_events WHERE stripe_event_id = $1',
    [event.id]
  );
  if (existing.rows.length > 0) {
    console.log(`[BILLING] Duplicate webhook event ${event.id}, skipping`);
    return;
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.orgId;
      if (!orgId) break;

      await updateBillingStatus(orgId, {
        status: 'active',
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: session.subscription as string,
      });

      // Get subscription details for period end
      if (session.subscription) {
        const sub = await getStripe().subscriptions.retrieve(session.subscription as string) as any;
        await updateBillingStatus(orgId, {
          currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
          contributorCount: sub.items.data[0]?.quantity || 1,
          monthlyAmountCents: (sub.items.data[0]?.quantity || 1) * PRICE_PER_CONTRIBUTOR_CENTS,
        });
      }

      // Store billing details from checkout
      if (session.customer_details) {
        const details: Record<string, any> = {};
        if (session.customer_details.email) details.billingEmail = session.customer_details.email;
        if (session.customer_details.name) details.companyName = session.customer_details.name;
        if (session.customer_details.address) {
          details.billingAddress = JSON.stringify(session.customer_details.address);
        }
        if (session.customer_details.tax_ids && session.customer_details.tax_ids.length > 0) {
          details.vatNumber = session.customer_details.tax_ids[0].value;
        }
        if (Object.keys(details).length > 0) {
          await updateBillingStatus(orgId, details);
        }
      }

      await logBillingEvent(orgId, 'subscription_created', { sessionId: session.id }, event.id);

      // Send welcome notification
      await createNotification({
        orgId,
        type: 'billing',
        severity: 'info',
        title: 'Subscription activated',
        body: 'Your CRANIS2 Standard subscription is now active. Thank you!',
        link: '/billing',
      });
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as any;
      const orgId = sub.metadata?.orgId;
      if (!orgId) break;

      const newStatus = sub.status === 'active' ? 'active'
        : sub.status === 'past_due' ? 'past_due'
        : sub.status === 'canceled' ? 'cancelled'
        : sub.status === 'unpaid' ? 'suspended'
        : 'active';

      await updateBillingStatus(orgId, {
        status: newStatus,
        currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
        contributorCount: sub.items.data[0]?.quantity || 1,
        monthlyAmountCents: (sub.items.data[0]?.quantity || 1) * PRICE_PER_CONTRIBUTOR_CENTS,
      });

      await logBillingEvent(orgId, 'subscription_updated', {
        stripeStatus: sub.status,
        quantity: sub.items.data[0]?.quantity,
      }, event.id);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.orgId;
      if (!orgId) break;

      await updateBillingStatus(orgId, {
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
      });

      await logBillingEvent(orgId, 'subscription_cancelled', {}, event.id);

      await createNotification({
        orgId,
        type: 'billing',
        severity: 'medium',
        title: 'Subscription cancelled',
        body: 'Your subscription has been cancelled. Access continues until the end of your paid period.',
        link: '/billing',
      });
      const orgCancel = await getOrgInfoForEmail(orgId);
      const cancelBilling = await getOrgBillingStatus(orgId);
      const accessUntil = cancelBilling?.currentPeriodEnd || new Date().toISOString();
      await sendSubscriptionCancelled(orgCancel, accessUntil).catch(e => console.error('[BILLING] Email error (cancelled):', e.message));
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      const orgBilling = await pool.query(
        'SELECT org_id FROM org_billing WHERE stripe_customer_id = $1',
        [customerId]
      );
      const orgId = orgBilling.rows[0]?.org_id;
      if (!orgId) break;

      // Clear any grace period — payment succeeded
      await updateBillingStatus(orgId, {
        status: 'active',
        graceEndsAt: null,
      });

      await logBillingEvent(orgId, 'invoice_paid', {
        invoiceId: invoice.id,
        amountPaid: invoice.amount_paid,
      }, event.id);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      const orgBilling = await pool.query(
        'SELECT org_id FROM org_billing WHERE stripe_customer_id = $1',
        [customerId]
      );
      const orgId = orgBilling.rows[0]?.org_id;
      if (!orgId) break;

      // Set grace period (7 days)
      const graceEnd = new Date();
      graceEnd.setDate(graceEnd.getDate() + 7);

      await updateBillingStatus(orgId, {
        status: 'past_due',
        graceEndsAt: graceEnd.toISOString(),
      });

      await logBillingEvent(orgId, 'payment_failed', {
        invoiceId: invoice.id,
        attemptCount: invoice.attempt_count,
      }, event.id);

      // Notify org admins
      const admins = await pool.query(
        "SELECT id FROM users WHERE org_id = $1 AND org_role = 'admin'",
        [orgId]
      );
      for (const admin of admins.rows) {
        await createNotification({
          orgId,
          userId: admin.id,
          type: 'billing',
          severity: 'medium',
          title: 'Payment failed',
          body: 'Your monthly payment failed. Please update your payment method to avoid access restrictions.',
          link: '/billing',
        });
      }
      const orgPayFail = await getOrgInfoForEmail(orgId);
      await sendPaymentFailed(orgPayFail).catch(e => console.error('[BILLING] Email error (payment_failed):', e.message));
      break;
    }
  }
}

// ── Billing Event Logging ──

async function logBillingEvent(
  orgId: string, eventType: string, details: any, stripeEventId?: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO billing_events (org_id, event_type, details, stripe_event_id)
       VALUES ($1, $2, $3, $4)`,
      [orgId, eventType, JSON.stringify(details), stripeEventId || null]
    );
  } catch (err) {
    console.error('[BILLING] Failed to log billing event:', err);
  }
}


// ── Org info helper for emails ──

async function getOrgInfoForEmail(orgId: string) {
  const billing = await getOrgBillingStatus(orgId);
  // Get org name from Neo4j
  const driver = getDriver();
  const session = driver.session();
  let orgName = 'your organisation';
  try {
    const result = await session.run('MATCH (o:Organisation {id: $orgId}) RETURN o.name AS name', { orgId });
    if (result.records.length > 0) orgName = result.records[0].get('name') || orgName;
  } finally {
    await session.close();
  }
  // Billing email fallback to first admin email
  let billingEmail = billing?.billingEmail;
  if (!billingEmail) {
    const adminResult = await pool.query(
      "SELECT email FROM users WHERE org_id = $1 AND org_role = 'admin' ORDER BY created_at ASC LIMIT 1",
      [orgId]
    );
    billingEmail = adminResult.rows[0]?.email || null;
  }
  return { orgId, orgName, billingEmail: billingEmail || undefined };
}

// ── Trial & Grace Period Checks (called by scheduler) ──

export async function checkTrialExpiry(): Promise<void> {
  console.log('[BILLING] Checking trial expiry...');

  // Find orgs approaching trial end (14 days warning)
  const warning14d = await pool.query(
    `SELECT org_id FROM org_billing
     WHERE status = 'trial'
       AND trial_ends_at BETWEEN NOW() + INTERVAL '13 days' AND NOW() + INTERVAL '14 days'`
  );
  for (const row of warning14d.rows) {
    await createNotification({
      orgId: row.org_id,
      type: 'billing',
      severity: 'medium',
      title: 'Trial ending in 14 days',
      body: 'Your free trial ends in 14 days. Upgrade to Standard to continue using CRANIS2.',
      link: '/billing',
    });
    const org14d = await getOrgInfoForEmail(row.org_id);
    await sendTrialExpiryWarning(org14d, 14).catch(e => console.error('[BILLING] Email error (14d):', e.message));
  }

  // 7 days warning
  const warning7d = await pool.query(
    `SELECT org_id FROM org_billing
     WHERE status = 'trial'
       AND trial_ends_at BETWEEN NOW() + INTERVAL '6 days' AND NOW() + INTERVAL '7 days'`
  );
  for (const row of warning7d.rows) {
    await createNotification({
      orgId: row.org_id,
      type: 'billing',
      severity: 'medium',
      title: 'Trial ending in 7 days',
      body: 'Your free trial ends in 7 days. Upgrade now to avoid losing access.',
      link: '/billing',
    });
    const org7d = await getOrgInfoForEmail(row.org_id);
    await sendTrialExpiryWarning(org7d, 7).catch(e => console.error('[BILLING] Email error (7d):', e.message));
  }

  // Trial just expired — start 7-day grace
  const justExpired = await pool.query(
    `SELECT org_id FROM org_billing
     WHERE status = 'trial'
       AND trial_ends_at < NOW()`
  );
  for (const row of justExpired.rows) {
    const graceEnd = new Date();
    graceEnd.setDate(graceEnd.getDate() + 7);
    await updateBillingStatus(row.org_id, {
      status: 'trial',  // Keep as trial during grace
      graceEndsAt: graceEnd.toISOString(),
    });
    await createNotification({
      orgId: row.org_id,
      type: 'billing',
      severity: 'critical',
      title: 'Trial expired',
      body: 'Your free trial has ended. Upgrade within 7 days to maintain full access.',
      link: '/billing',
    });
    await logBillingEvent(row.org_id, 'trial_expired', { graceEndsAt: graceEnd.toISOString() });
    const orgExpired = await getOrgInfoForEmail(row.org_id);
    await sendTrialExpired(orgExpired).catch(e => console.error('[BILLING] Email error (expired):', e.message));
  }

  // Grace period ended — move to read_only
  const graceExpired = await pool.query(
    `SELECT org_id FROM org_billing
     WHERE status = 'trial'
       AND grace_ends_at IS NOT NULL
       AND grace_ends_at < NOW()`
  );
  for (const row of graceExpired.rows) {
    await updateBillingStatus(row.org_id, { status: 'read_only' });
    await createNotification({
      orgId: row.org_id,
      type: 'billing',
      severity: 'critical',
      title: 'Account restricted',
      body: 'Your account is now read-only. Upgrade to Standard to restore full access.',
      link: '/billing',
    });
    await logBillingEvent(row.org_id, 'trial_grace_expired', {});
    const orgGrace = await getOrgInfoForEmail(row.org_id);
    await sendTrialGraceEnded(orgGrace).catch(e => console.error('[BILLING] Email error (grace):', e.message));
  }

  // Read-only for 60+ days — suspend
  const readOnlyExpired = await pool.query(
    `SELECT org_id FROM org_billing
     WHERE status = 'read_only'
       AND updated_at < NOW() - INTERVAL '60 days'`
  );
  for (const row of readOnlyExpired.rows) {
    await updateBillingStatus(row.org_id, { status: 'suspended' });
    await logBillingEvent(row.org_id, 'account_suspended', {});
  }

  console.log(`[BILLING] Trial check complete: ${warning14d.rows.length} warnings(14d), ${warning7d.rows.length} warnings(7d), ${justExpired.rows.length} expired, ${graceExpired.rows.length} grace ended`);
}

export async function checkPaymentGrace(): Promise<void> {
  console.log('[BILLING] Checking payment grace periods...');

  // Past due with grace period ended — move to read_only
  const pastDueExpired = await pool.query(
    `SELECT org_id FROM org_billing
     WHERE status = 'past_due'
       AND grace_ends_at IS NOT NULL
       AND grace_ends_at < NOW()
       AND (payment_pause_until IS NULL OR payment_pause_until < NOW())`
  );
  for (const row of pastDueExpired.rows) {
    await updateBillingStatus(row.org_id, { status: 'read_only' });
    await createNotification({
      orgId: row.org_id,
      type: 'billing',
      severity: 'critical',
      title: 'Account restricted — payment overdue',
      body: 'Your account is now read-only due to non-payment. Update your payment method to restore access.',
      link: '/billing',
    });
    await logBillingEvent(row.org_id, 'payment_grace_expired', {});
    const orgPayGrace = await getOrgInfoForEmail(row.org_id);
    await sendAccessRestricted(orgPayGrace).catch(e => console.error('[BILLING] Email error (restricted):', e.message));
  }

  // Read-only for 30+ days due to payment failure — suspend
  const readOnlyLong = await pool.query(
    `SELECT org_id FROM org_billing
     WHERE status = 'read_only'
       AND updated_at < NOW() - INTERVAL '30 days'
       AND cancelled_at IS NULL
       AND (payment_pause_until IS NULL OR payment_pause_until < NOW())`
  );
  for (const row of readOnlyLong.rows) {
    await updateBillingStatus(row.org_id, { status: 'suspended' });
    await logBillingEvent(row.org_id, 'account_suspended_nonpayment', {});
  }

  console.log(`[BILLING] Payment grace check: ${pastDueExpired.rows.length} restricted, ${readOnlyLong.rows.length} suspended`);
}

// ── Verify Stripe Webhook Signature ──

export function constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  return getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
}

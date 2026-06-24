/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import Stripe from 'stripe';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { createNotification } from './notifications.js';
import {
  sendTrialExpiryWarning,
  sendPaymentFailed, sendAccessRestricted, sendSubscriptionCancelled,
  sendTrialLastChance, sendSorryToSeeYouGo,
  sendWinbackOneMonth, sendWinbackSixMonth,
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

const INITIAL_PRICE_ID = process.env.STRIPE_PRICE_ID || '';
const APP_BASE_URL = process.env.FRONTEND_URL || 'https://dev.cranis2.dev';

// ── Platform Settings helpers ──

export async function getPlatformSetting(key: string): Promise<any> {
  const result = await pool.query('SELECT value FROM platform_settings WHERE key = $1', [key]);
  return result.rows[0]?.value ?? null;
}

export async function setPlatformSetting(key: string, value: any, userId?: string): Promise<void> {
  await pool.query(
    `INSERT INTO platform_settings (key, value, updated_by) VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW(), updated_by = $3`,
    [key, JSON.stringify(value), userId || null]
  );
}

export async function getPricingConfig(): Promise<{
  contributorPriceCents: number;
  proProductPriceCents: number;
  stripeContributorPriceId: string | null;
  stripeProProductPriceId: string | null;
}> {
  const result = await pool.query(
    `SELECT key, value FROM platform_settings WHERE key LIKE 'billing.%'`
  );
  const settings: Record<string, any> = {};
  for (const row of result.rows) settings[row.key] = row.value;
  return {
    contributorPriceCents: settings['billing.contributor_price_cents'] ?? 600,
    proProductPriceCents: settings['billing.pro_product_price_cents'] ?? 2000,
    stripeContributorPriceId: settings['billing.stripe_contributor_price_id'] || null,
    stripeProProductPriceId: settings['billing.stripe_pro_product_price_id'] || null,
  };
}

// ── Stripe Price Auto-Creation ──

export async function ensureStripePrices(): Promise<void> {
  try {
    const stripe = getStripe();
    const config = await getPricingConfig();

    // Ensure contributor price exists
    if (!config.stripeContributorPriceId && INITIAL_PRICE_ID) {
      await setPlatformSetting('billing.stripe_contributor_price_id', INITIAL_PRICE_ID);
      console.log('[STRIPE] Stored initial contributor price ID:', INITIAL_PRICE_ID);
    }

    // Ensure pro product price exists
    if (!config.stripeProProductPriceId) {
      const product = await stripe.products.create({
        name: 'CRANIS2 Pro – Per Product',
        description: 'CRA compliance with AI Copilot, per-product monthly charge',
      });
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: config.proProductPriceCents,
        currency: 'eur',
        recurring: { interval: 'month' },
      });
      await setPlatformSetting('billing.stripe_pro_product_price_id', price.id);
      console.log('[STRIPE] Created pro product price:', price.id);
    }
  } catch (err: any) {
    console.error('[STRIPE] Failed to ensure prices (non-fatal):', err.message);
  }
}

// ── Product Counting ──

export async function countProducts(orgId: string): Promise<number> {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product) RETURN count(p) AS cnt`,
      { orgId }
    );
    const cnt = result.records[0]?.get('cnt');
    return typeof cnt === 'object' ? (cnt as any).toNumber?.() ?? 0 : Number(cnt) || 0;
  } finally {
    await session.close();
  }
}

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
             -[:HAS_REPO]->(r:Repository)-[:HAS_CONTRIBUTOR]->(c:Contributor)
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
  plan: string;
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
    plan: row.plan || 'standard',
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

// Trial-duration policy. Bonus code at signup grants the longer trial.
export const DEFAULT_TRIAL_DAYS = 30;
export const BONUS_TRIAL_DAYS = 90;

export async function ensureOrgBilling(orgId: string, trialDays: number = DEFAULT_TRIAL_DAYS): Promise<BillingStatus> {
  const existing = await getOrgBillingStatus(orgId);
  if (existing) return existing;

  // Auto-create a trial record
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + trialDays);

  await pool.query(
    `INSERT INTO org_billing (org_id, status, trial_ends_at, trial_duration_days)
     VALUES ($1, 'trial', $2, $3)
     ON CONFLICT (org_id) DO NOTHING`,
    [orgId, trialEnd.toISOString(), trialDays]
  );

  await logBillingEvent(orgId, 'trial_started', { trialDays });
  console.log(`[BILLING] Auto-created trial for org ${orgId} (${trialDays} days), expires ${trialEnd.toISOString()}`);

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

export async function createCheckoutSession(orgId: string, email: string, plan: 'standard' | 'pro' = 'standard'): Promise<string> {
  const config = await getPricingConfig();

  // Count contributors to set initial quantity
  const counts = await countActiveContributors(orgId);
  const contributorQty = Math.max(1, counts.active); // Minimum 1 contributor

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

  // Build line items based on plan
  const lineItems: Array<{ price: string; quantity: number }> = [];

  const contributorPriceId = config.stripeContributorPriceId || INITIAL_PRICE_ID;
  if (!contributorPriceId) throw new Error('Stripe contributor price not configured');
  lineItems.push({ price: contributorPriceId, quantity: contributorQty });

  if (plan === 'pro') {
    if (!config.stripeProProductPriceId) throw new Error('Stripe Pro product price not configured. Run ensureStripePrices() first.');
    const productQty = Math.max(1, await countProducts(orgId));
    lineItems.push({ price: config.stripeProProductPriceId, quantity: productQty });
  }

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: lineItems,
    subscription_data: {
      metadata: { orgId, plan },
    },
    customer_update: { address: 'auto', name: 'auto' },
    automatic_tax: { enabled: true },
    tax_id_collection: { enabled: true },
    billing_address_collection: 'required',
    success_url: `${APP_BASE_URL}/billing?success=true`,
    cancel_url: `${APP_BASE_URL}/billing?cancelled=true`,
    metadata: { orgId, plan },
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

// ── Plan Upgrade / Downgrade ──

export async function upgradeToProPlan(orgId: string): Promise<void> {
  const billing = await getOrgBillingStatus(orgId);
  if (!billing?.stripeSubscriptionId) throw new Error('No active subscription found');

  const config = await getPricingConfig();
  if (!config.stripeProProductPriceId) throw new Error('Pro product price not configured');

  const productQty = Math.max(1, await countProducts(orgId));
  const stripe = getStripe();

  // Add pro product line item to existing subscription
  await stripe.subscriptionItems.create({
    subscription: billing.stripeSubscriptionId,
    price: config.stripeProProductPriceId,
    quantity: productQty,
    proration_behavior: 'create_prorations',
  });

  await updateBillingStatus(orgId, { plan: 'pro' });
  await logBillingEvent(orgId, 'plan_upgraded', { from: 'standard', to: 'pro', productCount: productQty });
}

export async function downgradeToStandardPlan(orgId: string): Promise<void> {
  const billing = await getOrgBillingStatus(orgId);
  if (!billing?.stripeSubscriptionId) throw new Error('No active subscription found');

  const config = await getPricingConfig();
  const stripe = getStripe();

  // Find and remove the pro product line item
  const sub = await stripe.subscriptions.retrieve(billing.stripeSubscriptionId);
  const proItem = sub.items.data.find((item: any) =>
    item.price.id === config.stripeProProductPriceId
  );

  if (proItem) {
    await stripe.subscriptionItems.del(proItem.id, { proration_behavior: 'create_prorations' });
  }

  await updateBillingStatus(orgId, { plan: 'standard' });
  await logBillingEvent(orgId, 'plan_downgraded', { from: 'pro', to: 'standard' });
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

      const checkoutPlan = session.metadata?.plan || 'standard';

      await updateBillingStatus(orgId, {
        status: 'active',
        plan: checkoutPlan,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: session.subscription as string,
      });

      // Get subscription details for period end
      if (session.subscription) {
        const sub = await getStripe().subscriptions.retrieve(session.subscription as string) as any;
        // Sum total monthly amount from all line items
        let totalMonthly = 0;
        let contributorCount = 1;
        for (const item of (sub.items?.data || [])) {
          const qty = item.quantity || 1;
          const unitAmount = item.price?.unit_amount || 0;
          totalMonthly += qty * unitAmount;
          // First line item is always contributors
          if (item === sub.items.data[0]) contributorCount = qty;
        }
        await updateBillingStatus(orgId, {
          currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
          contributorCount,
          monthlyAmountCents: totalMonthly,
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

      await logBillingEvent(orgId, 'subscription_created', { sessionId: session.id, plan: checkoutPlan }, event.id);

      const planLabel = checkoutPlan === 'pro' ? 'Pro' : 'Standard';
      await createNotification({
        orgId,
        type: 'billing',
        severity: 'info',
        title: 'Subscription activated',
        body: `Your CRANIS2 ${planLabel} subscription is now active. Thank you!`,
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

      // Sum total monthly amount from all line items
      let totalMonthly = 0;
      let contributorCount = 1;
      for (const item of (sub.items?.data || [])) {
        const qty = item.quantity || 1;
        const unitAmount = item.price?.unit_amount || 0;
        totalMonthly += qty * unitAmount;
        if (item === sub.items.data[0]) contributorCount = qty;
      }

      // Detect plan from line item count (2+ items = pro)
      const plan = (sub.items?.data?.length || 1) > 1 ? 'pro' : 'standard';

      await updateBillingStatus(orgId, {
        status: newStatus,
        plan,
        currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
        contributorCount,
        monthlyAmountCents: totalMonthly,
      });

      await logBillingEvent(orgId, 'subscription_updated', {
        stripeStatus: sub.status,
        plan,
        itemCount: sub.items?.data?.length || 1,
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

      // Clear any grace period – payment succeeded
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

// ── Lifecycle email dedup ──────────────────────────────────────────────────
//
// Each lifecycle email must be sent exactly once per org. We claim the slot
// atomically via INSERT … ON CONFLICT DO NOTHING; only the run that actually
// inserts the row gets to send. This survives backend restarts and concurrent
// scheduler ticks — the bug that caused the daily "trial ended" spam was that
// the old code re-sent on every run with no such guard.

export type LifecycleEmailType =
  | 'trial_30d' | 'trial_7d' | 'trial_last_chance'
  | 'sorry_to_see_you_go' | 'winback_1mo' | 'winback_6mo';

/**
 * Claim the (org, type) slot. Returns true exactly once — for the caller that
 * won the insert. Returns false if the email was already sent (or claimed).
 */
async function claimLifecycleEmail(orgId: string, type: LifecycleEmailType): Promise<boolean> {
  const res = await pool.query(
    `INSERT INTO lifecycle_emails (org_id, email_type) VALUES ($1, $2)
     ON CONFLICT (org_id, email_type) DO NOTHING`,
    [orgId, type]
  );
  return (res.rowCount || 0) > 0;
}

/** Has this lifecycle email already been sent? When, if so. */
async function lifecycleEmailSentAt(orgId: string, type: LifecycleEmailType): Promise<Date | null> {
  const res = await pool.query(
    `SELECT sent_at FROM lifecycle_emails WHERE org_id = $1 AND email_type = $2`,
    [orgId, type]
  );
  return res.rows[0]?.sent_at ? new Date(res.rows[0].sent_at) : null;
}

/**
 * Send a lifecycle email at most once. If the send throws we release the claim
 * so a later run can retry, rather than silently dropping the email forever.
 */
async function sendLifecycleOnce(
  orgId: string, type: LifecycleEmailType, send: () => Promise<void>
): Promise<boolean> {
  if (!(await claimLifecycleEmail(orgId, type))) return false;
  try {
    await send();
    return true;
  } catch (e: any) {
    console.error(`[BILLING] Lifecycle email '${type}' failed for ${orgId}:`, e?.message);
    await pool.query(
      `DELETE FROM lifecycle_emails WHERE org_id = $1 AND email_type = $2`,
      [orgId, type]
    ).catch(() => {});
    return false;
  }
}

/** Lazily mint (and persist) the opaque forget-me token for an org. */
async function getForgetToken(orgId: string): Promise<string> {
  const existing = await pool.query(
    `SELECT forget_token FROM org_billing WHERE org_id = $1`, [orgId]
  );
  if (existing.rows[0]?.forget_token) return existing.rows[0].forget_token;
  const minted = await pool.query(
    `UPDATE org_billing SET forget_token = gen_random_uuid()
     WHERE org_id = $1 AND forget_token IS NULL
     RETURNING forget_token`,
    [orgId]
  );
  if (minted.rows[0]?.forget_token) return minted.rows[0].forget_token;
  // Lost the race — re-read.
  const again = await pool.query(`SELECT forget_token FROM org_billing WHERE org_id = $1`, [orgId]);
  return again.rows[0]?.forget_token;
}

// ── Trial & Grace Period Checks (called by scheduler) ──

export async function checkTrialExpiry(): Promise<void> {
  console.log('[BILLING] Checking trial lifecycle...');
  const counts = { d30: 0, d7: 0, lastChance: 0, sorry: 0, winback1: 0, winback6: 0, suspended: 0 };

  // ── Stage 1: 30-day reminder ───────────────────────────────────────────
  const warning30d = await pool.query(
    `SELECT org_id FROM org_billing
     WHERE status = 'trial'
       AND trial_ends_at BETWEEN NOW() + INTERVAL '29 days' AND NOW() + INTERVAL '30 days'`
  );
  for (const row of warning30d.rows) {
    const sent = await sendLifecycleOnce(row.org_id, 'trial_30d', async () => {
      const org = await getOrgInfoForEmail(row.org_id);
      await sendTrialExpiryWarning(org, 30);
    });
    if (sent) {
      counts.d30++;
      await createNotification({
        orgId: row.org_id, type: 'billing', severity: 'medium',
        title: 'Trial ending in 30 days',
        body: 'Your free trial ends in 30 days. Upgrade to Standard to continue using CRANIS2.',
        link: '/billing',
      });
    }
  }

  // ── Stage 2: 7-day reminder ────────────────────────────────────────────
  const warning7d = await pool.query(
    `SELECT org_id FROM org_billing
     WHERE status = 'trial'
       AND trial_ends_at BETWEEN NOW() + INTERVAL '6 days' AND NOW() + INTERVAL '7 days'`
  );
  for (const row of warning7d.rows) {
    const sent = await sendLifecycleOnce(row.org_id, 'trial_7d', async () => {
      const org = await getOrgInfoForEmail(row.org_id);
      await sendTrialExpiryWarning(org, 7);
    });
    if (sent) {
      counts.d7++;
      await createNotification({
        orgId: row.org_id, type: 'billing', severity: 'medium',
        title: 'Trial ending in 7 days',
        body: 'Your free trial ends in 7 days. Upgrade now to avoid losing access.',
        link: '/billing',
      });
    }
  }

  // ── Stage 3: last chance — trial expired, open the 7-day grace ONCE ─────
  // Only orgs that have NOT yet entered grace (grace_ends_at IS NULL) — so an
  // org already mid-grace or grace-expired is never re-armed here. This, plus
  // the trial_last_chance claim, is the fix for the self-re-arming grace that
  // caused the daily spam.
  const justExpired = await pool.query(
    `SELECT org_id FROM org_billing
     WHERE status = 'trial' AND trial_ends_at < NOW() AND grace_ends_at IS NULL`
  );
  for (const row of justExpired.rows) {
    const sent = await sendLifecycleOnce(row.org_id, 'trial_last_chance', async () => {
      const org = await getOrgInfoForEmail(row.org_id);
      await sendTrialLastChance(org);
    });
    if (sent) {
      counts.lastChance++;
      const graceEnd = new Date();
      graceEnd.setDate(graceEnd.getDate() + 7);
      await updateBillingStatus(row.org_id, { status: 'trial', graceEndsAt: graceEnd.toISOString() });
      await logBillingEvent(row.org_id, 'trial_expired', { graceEndsAt: graceEnd.toISOString() });
      await createNotification({
        orgId: row.org_id, type: 'billing', severity: 'critical',
        title: 'Trial expired',
        body: 'Your free trial has ended. Upgrade within 7 days to maintain full access.',
        link: '/billing',
      });
    }
  }

  // ── Stage 4: grace ended → read-only + "sorry to see you go" (anchor) ───
  const graceExpired = await pool.query(
    `SELECT org_id FROM org_billing
     WHERE status = 'trial'
       AND grace_ends_at IS NOT NULL
       AND grace_ends_at < NOW()`
  );
  for (const row of graceExpired.rows) {
    await updateBillingStatus(row.org_id, { status: 'read_only' });
    await logBillingEvent(row.org_id, 'trial_grace_expired', {});
    await createNotification({
      orgId: row.org_id, type: 'billing', severity: 'critical',
      title: 'Account restricted',
      body: 'Your account is now read-only. Upgrade to Standard to restore full access.',
      link: '/billing',
    });
    const sent = await sendLifecycleOnce(row.org_id, 'sorry_to_see_you_go', async () => {
      const org = await getOrgInfoForEmail(row.org_id);
      await sendSorryToSeeYouGo(org);
    });
    if (sent) counts.sorry++;
  }

  // ── Stage 5 & 6: win-backs (run for any lapsed-or-closed org) ──────────
  await checkWinbackEmails(counts);

  // ── Housekeeping: read-only for 60+ days → suspend (no email) ──────────
  const readOnlyExpired = await pool.query(
    `SELECT org_id FROM org_billing
     WHERE status = 'read_only'
       AND updated_at < NOW() - INTERVAL '60 days'`
  );
  for (const row of readOnlyExpired.rows) {
    await updateBillingStatus(row.org_id, { status: 'suspended' });
    await logBillingEvent(row.org_id, 'account_suspended', {});
    counts.suspended++;
  }

  console.log(`[BILLING] Lifecycle complete: 30d=${counts.d30}, 7d=${counts.d7}, lastChance=${counts.lastChance}, sorry=${counts.sorry}, winback1mo=${counts.winback1}, winback6mo=${counts.winback6}, suspended=${counts.suspended}`);
}

/**
 * Win-back schedule, anchored to the "sorry to see you go" send date:
 *   • winback_1mo: 1 month after "sorry"
 *   • winback_6mo: 6 months after winback_1mo (i.e. ~7 months after "sorry")
 * Skips orgs that opted out (do_not_contact) or are exempt. Win-backs carry a
 * one-click forget-me link, so they always send unless suppressed.
 */
async function checkWinbackEmails(counts: { winback1: number; winback6: number }): Promise<void> {
  const frontendUrl = process.env.FRONTEND_URL || APP_BASE_URL;

  // Win-back #1 — "sorry" sent ≥ 1 month ago, not yet won back, not opted out.
  const dueWinback1 = await pool.query(
    `SELECT le.org_id FROM lifecycle_emails le
     JOIN org_billing b ON b.org_id = le.org_id
     WHERE le.email_type = 'sorry_to_see_you_go'
       AND le.sent_at < NOW() - INTERVAL '1 month'
       AND b.do_not_contact = FALSE
       AND b.exempt = FALSE
       AND NOT EXISTS (
         SELECT 1 FROM lifecycle_emails x
         WHERE x.org_id = le.org_id AND x.email_type = 'winback_1mo')`
  );
  for (const row of dueWinback1.rows) {
    const sent = await sendLifecycleOnce(row.org_id, 'winback_1mo', async () => {
      const org = await getOrgInfoForEmail(row.org_id);
      const token = await getForgetToken(row.org_id);
      await sendWinbackOneMonth(org, `${frontendUrl}/forget-me?token=${token}`);
    });
    if (sent) counts.winback1++;
  }

  // Win-back #2 — win-back #1 sent ≥ 6 months ago, not yet sent, not opted out.
  const dueWinback6 = await pool.query(
    `SELECT le.org_id FROM lifecycle_emails le
     JOIN org_billing b ON b.org_id = le.org_id
     WHERE le.email_type = 'winback_1mo'
       AND le.sent_at < NOW() - INTERVAL '6 months'
       AND b.do_not_contact = FALSE
       AND b.exempt = FALSE
       AND NOT EXISTS (
         SELECT 1 FROM lifecycle_emails x
         WHERE x.org_id = le.org_id AND x.email_type = 'winback_6mo')`
  );
  for (const row of dueWinback6.rows) {
    const sent = await sendLifecycleOnce(row.org_id, 'winback_6mo', async () => {
      const org = await getOrgInfoForEmail(row.org_id);
      const token = await getForgetToken(row.org_id);
      await sendWinbackSixMonth(org, `${frontendUrl}/forget-me?token=${token}`);
    });
    if (sent) counts.winback6++;
  }
}

export async function checkPaymentGrace(): Promise<void> {
  console.log('[BILLING] Checking payment grace periods...');

  // Past due with grace period ended – move to read_only
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
      title: 'Account restricted – payment overdue',
      body: 'Your account is now read-only due to non-payment. Update your payment method to restore access.',
      link: '/billing',
    });
    await logBillingEvent(row.org_id, 'payment_grace_expired', {});
    const orgPayGrace = await getOrgInfoForEmail(row.org_id);
    await sendAccessRestricted(orgPayGrace).catch(e => console.error('[BILLING] Email error (restricted):', e.message));
  }

  // Read-only for 30+ days due to payment failure – suspend
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

// ── Account closure (soft) — cancel billing, retain data 12 months ──────────
//
// The self-service "Close account" path. Cancels any live Stripe subscription,
// drops the org to read-only, stops all trial nagging, and fires the
// "sorry to see you go" email (which anchors the win-back schedule). Data is
// retained for 12 months so the customer can resubscribe and resume. This is
// reversible — a subsequent checkout reactivates the org.
export async function closeAccount(orgId: string): Promise<{ status: string; accessUntil: string | null }> {
  const billing = await getOrgBillingStatus(orgId);

  // Cancel any live Stripe subscription (best-effort — trials have none).
  if (billing?.stripeSubscriptionId) {
    try {
      await getStripe().subscriptions.cancel(billing.stripeSubscriptionId);
    } catch (e: any) {
      console.error(`[BILLING] Stripe cancel failed for ${orgId}:`, e?.message);
    }
  }

  await updateBillingStatus(orgId, {
    status: 'read_only',
    cancelledAt: new Date().toISOString(),
    stripeSubscriptionId: null,
  });
  await logBillingEvent(orgId, 'account_closed', { self_service: true });
  await createNotification({
    orgId, type: 'billing', severity: 'high',
    title: 'Account closed',
    body: 'Your account is now read-only. Your data is retained for 12 months — resubscribe any time to restore full access.',
    link: '/billing',
  });

  // Anchor the win-back schedule (idempotent — only the first close sends it).
  await sendLifecycleOnce(orgId, 'sorry_to_see_you_go', async () => {
    const org = await getOrgInfoForEmail(orgId);
    await sendSorryToSeeYouGo(org);
  });

  const updated = await getOrgBillingStatus(orgId);
  return { status: 'closed', accessUntil: updated?.currentPeriodEnd || null };
}

// ── "Forget me" — GDPR Art. 17 erasure driven by the win-back email link ────
//
// Resolves the opaque forget-me token to an org, then erases personal data and
// ceases all contact. Records mandated by EU law are ANONYMISED and retained,
// not deleted (Art. 17(3)(b)): CRA Art. 13(10) audit trail (10 yrs) and tax
// records (7 yrs). After this the org can never re-enter the email funnel.
export async function getOrgByForgetToken(token: string): Promise<{ orgId: string; orgName: string } | null> {
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return null;
  const res = await pool.query(
    `SELECT org_id FROM org_billing WHERE forget_token = $1`, [token]
  );
  if (res.rows.length === 0) return null;
  const orgId = res.rows[0].org_id;
  const info = await getOrgInfoForEmail(orgId);
  return { orgId, orgName: info.orgName };
}

export async function forgetOrg(token: string): Promise<{ erased: boolean } | null> {
  const found = await getOrgByForgetToken(token);
  if (!found) return null;
  const { orgId } = found;

  // Suppress all future contact immediately (the legal core of "forget me").
  await pool.query(
    `UPDATE org_billing SET do_not_contact = TRUE, forgotten_at = NOW(), updated_at = NOW()
     WHERE org_id = $1`,
    [orgId]
  );
  await eraseOrgData(orgId);
  await logBillingEvent(orgId, 'forget_me_erasure', { via: 'winback_link' });
  return { erased: true };
}

/**
 * Org-scoped erasure. Deletes personal & operational data for every user in
 * the org and the org's Neo4j graph, while anonymising legally-retained
 * records. Shared by the forget-me link and the permanent-delete UI action.
 */
export async function eraseOrgData(orgId: string): Promise<void> {
  // Anonymise the CRA audit trail (10-year retention) — keep the record,
  // strip the person from it.
  await pool.query(
    `UPDATE product_activity_log
       SET user_id = NULL, user_email = 'erased-' || left(md5(org_id), 12)
     WHERE org_id = $1`,
    [orgId]
  ).catch(e => console.error('[FORGET] audit anonymise:', e.message));

  // Anonymise the billing/tax record (7-year retention) — keep the row.
  await pool.query(
    `UPDATE org_billing
       SET billing_email = 'erased-' || left(md5(org_id), 12),
           company_name = NULL, billing_address = NULL, vat_number = NULL,
           stripe_customer_id = NULL, stripe_subscription_id = NULL,
           updated_at = NOW()
     WHERE org_id = $1`,
    [orgId]
  ).catch(e => console.error('[FORGET] billing anonymise:', e.message));

  // Null FK references held by this org's users, then delete the PII rows.
  const nullUserRefs = [
    ['cra_reports', 'created_by'], ['cra_report_stages', 'submitted_by'],
    ['ip_proof_snapshots', 'created_by'], ['license_findings', 'acknowledged_by'],
    ['category_recommendations', 'user_id'], ['recommendation_access_log', 'user_id'],
    ['supplier_questionnaires', 'created_by'], ['departed_contributors', 'marked_by'],
    ['doc_pages', 'updated_by'], ['escrow_users', 'invited_by'],
    ['repo_connections', 'connected_by_user_id'],
  ];
  for (const [table, col] of nullUserRefs) {
    await pool.query(
      `UPDATE ${table} SET ${col} = NULL
       WHERE ${col} IN (SELECT id FROM users WHERE org_id = $1::uuid)`,
      [orgId]
    ).catch(e => console.error(`[FORGET] null ${table}.${col}:`, e.message));
  }

  // Delete org-scoped personal / operational data.
  const orgDeletes = [
    'DELETE FROM notifications WHERE org_id = $1',
    'DELETE FROM copilot_cache WHERE org_id = $1',
    'DELETE FROM feedback WHERE user_id IN (SELECT id FROM users WHERE org_id = $1::uuid)',
    'DELETE FROM user_events WHERE user_id IN (SELECT id FROM users WHERE org_id = $1::uuid)',
    'DELETE FROM copilot_usage WHERE user_id IN (SELECT id FROM users WHERE org_id = $1::uuid)',
    'DELETE FROM api_keys WHERE org_id = $1',
  ];
  for (const sql of orgDeletes) {
    await pool.query(sql, [orgId]).catch(e => console.error('[FORGET] delete:', e.message));
  }

  // Delete the user accounts themselves.
  await pool.query('DELETE FROM users WHERE org_id = $1::uuid', [orgId])
    .catch(e => console.error('[FORGET] delete users:', e.message));

  // Detach-delete the org graph (Organisation, its Users, Products, SBOMs…).
  const session = getDriver().session();
  try {
    await session.run(
      `MATCH (o:Organisation {id: $orgId})
       OPTIONAL MATCH (o)<-[:BELONGS_TO|ADMIN_OF]-(u:User)
       OPTIONAL MATCH (o)-[*1..3]-(p:Product)
       OPTIONAL MATCH (p)-[*1..2]-(child)
       DETACH DELETE o, u, p, child`,
      { orgId }
    );
  } catch (e: any) {
    console.error('[FORGET] neo4j erase:', e?.message);
  } finally {
    await session.close();
  }
}

// ── Verify Stripe Webhook Signature ──

export function constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  return getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
}

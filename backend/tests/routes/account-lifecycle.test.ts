/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

/**
 * Account Lifecycle — trial reminders, lapse, win-backs, close & forget-me.
 *
 * Exercises the lifecycle email state machine (via the admin run-lifecycle
 * trigger), the per-stage dedup that fixes the daily "trial ended" spam, the
 * self-service account close, and the public "forget me" GDPR erasure.
 *
 * All test orgs use the `00000000-…` UUID space so they never collide with
 * seeded data, and are torn down in afterAll.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getAppPool, loginTestUser, TEST_USERS, TEST_PASSWORD, api } from '../setup/test-helpers.js';

const ORG = {
  d30: '00000000-0000-0000-0000-00000000d300',
  d7: '00000000-0000-0000-0000-0000000000d7',
  expired: '00000000-0000-0000-0000-0000000e0001',
  graceDone: '00000000-0000-0000-0000-000000067ace',
  forget: '00000000-0000-0000-0000-0000000f0601',
  close: '00000000-0000-0000-0000-00000000c105',
};
const ALL_ORGS = Object.values(ORG);
const FORGET_TOKEN = '11111111-1111-1111-1111-111111111111';
const CLOSE_EMAIL = 'lc-close-admin@lifecycle.test';

async function cleanup() {
  const pool = getAppPool();
  await pool.query(`DELETE FROM lifecycle_emails WHERE org_id = ANY($1)`, [ALL_ORGS]);
  await pool.query(`DELETE FROM billing_events WHERE org_id = ANY($1)`, [ALL_ORGS]);
  await pool.query(`DELETE FROM notifications WHERE org_id = ANY($1)`, [ALL_ORGS]);
  // Drop the disposable admin and the rows that reference it (login telemetry etc.).
  const u = await pool.query(`SELECT id FROM users WHERE email = $1`, [CLOSE_EMAIL]);
  if (u.rows[0]) {
    const uid = u.rows[0].id;
    for (const t of ['user_events', 'notifications', 'feedback', 'copilot_usage']) {
      await pool.query(`DELETE FROM ${t} WHERE user_id = $1`, [uid]).catch(() => {});
    }
    await pool.query(`DELETE FROM users WHERE id = $1`, [uid]);
  }
  await pool.query(`DELETE FROM org_billing WHERE org_id = ANY($1)`, [ALL_ORGS]);
}

async function seedBilling(orgId: string, fields: Record<string, any>): Promise<void> {
  const pool = getAppPool();
  await pool.query(
    `INSERT INTO org_billing
       (org_id, status, trial_ends_at, grace_ends_at, billing_email,
        forget_token, do_not_contact, plan, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'standard', NOW(), NOW())
     ON CONFLICT (org_id) DO UPDATE SET
       status = $2, trial_ends_at = $3, grace_ends_at = $4, billing_email = $5,
       forget_token = $6, do_not_contact = $7, updated_at = NOW()`,
    [
      orgId, fields.status, fields.trialEndsAt || null, fields.graceEndsAt || null,
      fields.billingEmail || null, fields.forgetToken || null, fields.doNotContact || false,
    ]
  );
}

async function emailExists(orgId: string, type: string): Promise<number> {
  const pool = getAppPool();
  const res = await pool.query(
    `SELECT COUNT(*)::int AS n FROM lifecycle_emails WHERE org_id = $1 AND email_type = $2`,
    [orgId, type]
  );
  return res.rows[0].n;
}

async function billingRow(orgId: string): Promise<any> {
  const pool = getAppPool();
  const res = await pool.query(`SELECT * FROM org_billing WHERE org_id = $1`, [orgId]);
  return res.rows[0];
}

describe('Account Lifecycle — emails, close & forget-me', () => {
  let platformToken: string;

  beforeAll(async () => {
    const pool = getAppPool();
    platformToken = await loginTestUser(TEST_USERS.platformAdmin);
    await cleanup();

    // Lifecycle-stage orgs (no users → emails skip the actual send, dedup persists).
    await seedBilling(ORG.d30, { status: 'trial', trialEndsAt: new Date(Date.now() + 29.5 * 86400000).toISOString() });
    await seedBilling(ORG.d7, { status: 'trial', trialEndsAt: new Date(Date.now() + 6.5 * 86400000).toISOString() });
    await seedBilling(ORG.expired, { status: 'trial', trialEndsAt: new Date(Date.now() - 86400000).toISOString() });
    await seedBilling(ORG.graceDone, {
      status: 'trial',
      trialEndsAt: new Date(Date.now() - 10 * 86400000).toISOString(),
      graceEndsAt: new Date(Date.now() - 86400000).toISOString(),
    });
    await seedBilling(ORG.forget, {
      status: 'read_only', billingEmail: 'forget@lifecycle.test', forgetToken: FORGET_TOKEN,
    });

    // Close-test org needs a real, loginable admin user.
    await seedBilling(ORG.close, { status: 'trial', trialEndsAt: new Date(Date.now() + 5 * 86400000).toISOString() });
    await pool.query(
      `INSERT INTO users (id, email, password_hash, email_verified, org_id, org_role, is_platform_admin, created_at, updated_at)
       SELECT gen_random_uuid(), $1, password_hash, TRUE, $2::uuid, 'admin', FALSE, NOW(), NOW()
       FROM users WHERE email = $3
       ON CONFLICT (email) DO NOTHING`,
      [CLOSE_EMAIL, ORG.close, TEST_USERS.mfgAdmin]
    );
  });

  afterAll(async () => {
    await cleanup();
  });

  it('platform admin can trigger the lifecycle run', async () => {
    const res = await api.post('/api/admin/billing/run-lifecycle', { auth: platformToken });
    expect(res.status).toBe(200);
    expect(res.body.ran).toBe(true);
  });

  it('sends each trial-stage email exactly once', async () => {
    expect(await emailExists(ORG.d30, 'trial_30d')).toBe(1);
    expect(await emailExists(ORG.d7, 'trial_7d')).toBe(1);
    expect(await emailExists(ORG.expired, 'trial_last_chance')).toBe(1);
  });

  it('arms a 7-day grace once when the trial expires', async () => {
    const row = await billingRow(ORG.expired);
    expect(row.grace_ends_at).not.toBeNull();
    const days = (new Date(row.grace_ends_at).getTime() - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(6);
    expect(days).toBeLessThan(8);
  });

  it('moves a grace-expired org to read-only and sends "sorry to see you go"', async () => {
    const row = await billingRow(ORG.graceDone);
    expect(row.status).toBe('read_only');
    expect(await emailExists(ORG.graceDone, 'sorry_to_see_you_go')).toBe(1);
  });

  it('NEVER re-sends or re-arms on a second run (the spam regression)', async () => {
    const before = await billingRow(ORG.expired);
    const graceBefore = before.grace_ends_at;

    // Run the whole lifecycle again — the old bug re-fired every run.
    const res = await api.post('/api/admin/billing/run-lifecycle', { auth: platformToken });
    expect(res.status).toBe(200);

    // No duplicate emails…
    expect(await emailExists(ORG.expired, 'trial_last_chance')).toBe(1);
    expect(await emailExists(ORG.graceDone, 'sorry_to_see_you_go')).toBe(1);
    expect(await emailExists(ORG.d30, 'trial_30d')).toBe(1);
    // …and the grace window is NOT re-armed.
    const after = await billingRow(ORG.expired);
    expect(new Date(after.grace_ends_at).getTime()).toBe(new Date(graceBefore).getTime());
  });

  it('forget-me: previews the org for a valid token, 404s for a bad one', async () => {
    const ok = await api.get('/api/account/forget-me', { query: { token: FORGET_TOKEN } });
    expect(ok.status).toBe(200);
    expect(typeof ok.body.orgName).toBe('string');

    const bad = await api.get('/api/account/forget-me', { query: { token: 'not-a-real-token' } });
    expect(bad.status).toBe(404);
  });

  it('forget-me: erases personal data and ceases contact', async () => {
    const res = await api.post('/api/account/forget-me', { body: { token: FORGET_TOKEN } });
    expect(res.status).toBe(200);

    const row = await billingRow(ORG.forget);
    expect(row.do_not_contact).toBe(true);
    expect(row.forgotten_at).not.toBeNull();
    // Billing/tax record retained but anonymised.
    expect(row.billing_email).toMatch(/^erased-/);
  });

  it('close account: rejects a wrong password', async () => {
    const token = await loginTestUser(CLOSE_EMAIL);
    const res = await api.post('/api/account/close', { auth: token, body: { password: 'WrongPassword!1' } });
    expect(res.status).toBe(401);
    // Untouched.
    expect((await billingRow(ORG.close)).status).toBe('trial');
  });

  it('close account: cancels billing and goes read-only with the right password', async () => {
    const token = await loginTestUser(CLOSE_EMAIL);
    const res = await api.post('/api/account/close', { auth: token, body: { password: TEST_PASSWORD } });
    expect(res.status).toBe(200);

    const row = await billingRow(ORG.close);
    expect(row.status).toBe('read_only');
    expect(row.cancelled_at).not.toBeNull();

    const pool = getAppPool();
    const ev = await pool.query(
      `SELECT COUNT(*)::int AS n FROM billing_events WHERE org_id = $1 AND event_type = 'account_closed'`,
      [ORG.close]
    );
    expect(ev.rows[0].n).toBeGreaterThanOrEqual(1);
  });
});

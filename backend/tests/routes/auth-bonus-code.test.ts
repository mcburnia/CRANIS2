/**
 * Auth + Bonus Code Tests — POST /api/auth/register with bonusCode
 *
 * Verifies: optional bonusCode parameter validation, self-referral block,
 * and that the canonical code is persisted on users.bonus_code_used so
 * org creation can apply the 90-day trial.
 *
 * Trial-days propagation through to org_billing is covered by the
 * affiliate-statements service test against pre-seeded attributions.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, getAppPool } from '../setup/test-helpers.js';
import { randomUUID } from 'crypto';

describe('/api/auth/register with bonusCode', () => {
  const testCode = `AUTHBC${Math.floor(Math.random() * 100000)}`;
  const affiliateEmail = `auth-bc-${Date.now()}@example.com`;
  let affiliateId: string;
  const createdEmails: string[] = [];

  beforeAll(async () => {
    const pool = getAppPool();
    affiliateId = randomUUID();
    await pool.query(
      `INSERT INTO affiliates (id, bonus_code, display_name, contact_email, commission_rate, enabled)
       VALUES ($1, $2, 'Auth BC Test', $3, 0.20, TRUE)`,
      [affiliateId, testCode, affiliateEmail]
    );
  });

  afterAll(async () => {
    const pool = getAppPool();
    if (createdEmails.length > 0) {
      // user_events FK-references users — must delete events first.
      await pool.query(
        `DELETE FROM user_events WHERE user_id IN (SELECT id FROM users WHERE email = ANY($1))`,
        [createdEmails]
      );
      await pool.query(`DELETE FROM users WHERE email = ANY($1)`, [createdEmails]);
    }
    await pool.query(`DELETE FROM affiliates WHERE id = $1`, [affiliateId]);
  });

  function uniqEmail(label: string): string {
    const e = `auth-bc-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
    createdEmails.push(e);
    return e;
  }

  it('register without bonusCode succeeds (existing path)', async () => {
    const email = uniqEmail('plain');
    const res = await api.post('/api/auth/register', {
      body: { email, password: 'TestPass123!' },
    });
    expect([200, 201]).toContain(res.status);
  });

  it('register with valid bonusCode succeeds and persists canonical code', async () => {
    const email = uniqEmail('valid');
    const res = await api.post('/api/auth/register', {
      body: { email, password: 'TestPass123!', bonusCode: testCode.toLowerCase() },
    });
    expect([200, 201]).toContain(res.status);

    const pool = getAppPool();
    const row = await pool.query('SELECT bonus_code_used FROM users WHERE email = $1', [email]);
    expect(row.rows[0]?.bonus_code_used).toBe(testCode);
  });

  it('register with unknown bonusCode rejected (400, no user created)', async () => {
    const email = `auth-bc-bad-${Date.now()}@example.com`;
    const res = await api.post('/api/auth/register', {
      body: { email, password: 'TestPass123!', bonusCode: 'NOTREAL_CODE_XYZ' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not recognised/i);

    const pool = getAppPool();
    const row = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
    expect(row.rows.length).toBe(0);
  });

  it('rejects self-referral when registration email matches affiliate contact', async () => {
    const res = await api.post('/api/auth/register', {
      body: { email: affiliateEmail, password: 'TestPass123!', bonusCode: testCode },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/own bonus code/i);
  });

  it('register with empty bonusCode treated as no code', async () => {
    const email = uniqEmail('empty');
    const res = await api.post('/api/auth/register', {
      body: { email, password: 'TestPass123!', bonusCode: '' },
    });
    expect([200, 201]).toContain(res.status);

    const pool = getAppPool();
    const row = await pool.query('SELECT bonus_code_used FROM users WHERE email = $1', [email]);
    expect(row.rows[0]?.bonus_code_used).toBeNull();
  });
});

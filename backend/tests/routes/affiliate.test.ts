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
 * Affiliate Self-Service Route Tests — /api/affiliate
 *
 * The current user's affiliate is resolved via affiliates.user_id = req.userId.
 * Tests cover: 401 unauth, 403 not-an-affiliate, full data shape when bound,
 * referral anonymisation, and invoice submission with duplicate-block.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginTestUser, TEST_USERS, getAppPool } from '../setup/test-helpers.js';
import { randomUUID } from 'crypto';

describe('/api/affiliate', () => {
  let affToken: string;       // user bound to the test affiliate
  let nonAffToken: string;    // user not bound to any affiliate
  const testCode = `AFFTEST${Math.floor(Math.random() * 100000)}`;
  let affiliateId: string;

  beforeAll(async () => {
    affToken = await loginTestUser(TEST_USERS.mfgMember1);
    nonAffToken = await loginTestUser(TEST_USERS.impAdmin);

    // Look up the actual user_id by email rather than hardcoding — seed UUIDs
    // can drift, and the test fails opaquely (403) if they ever do.
    const pool = getAppPool();
    const userRow = await pool.query(`SELECT id FROM users WHERE email = $1`, [TEST_USERS.mfgMember1]);
    const linkedUserId = userRow.rows[0]?.id;
    if (!linkedUserId) throw new Error(`Could not find user_id for ${TEST_USERS.mfgMember1}`);

    affiliateId = randomUUID();
    await pool.query(
      `INSERT INTO affiliates (id, user_id, bonus_code, display_name, contact_email, commission_rate, commission_window_months, enabled)
       VALUES ($1, $2, $3, 'Aff Test', 'aff-test@example.com', 0.20, 12, TRUE)`,
      [affiliateId, linkedUserId, testCode]
    );
  });

  afterAll(async () => {
    const pool = getAppPool();
    await pool.query(`DELETE FROM affiliate_ledger_entries WHERE affiliate_id = $1`, [affiliateId]);
    await pool.query(`DELETE FROM affiliate_attributions WHERE affiliate_id = $1`, [affiliateId]);
    await pool.query(`DELETE FROM affiliates WHERE id = $1`, [affiliateId]);
  });

  describe('Auth guards', () => {
    it('GET /me returns 401 without auth', async () => {
      const res = await api.get('/api/affiliate/me');
      expect(res.status).toBe(401);
    });
    it('GET /me returns 403 for users not bound to an affiliate', async () => {
      const res = await api.get('/api/affiliate/me', { auth: nonAffToken });
      expect(res.status).toBe(403);
    });
    it('GET /statements, /ledger, /referrals all require an affiliate', async () => {
      for (const path of ['/api/affiliate/statements', '/api/affiliate/ledger', '/api/affiliate/referrals']) {
        const res = await api.get(path, { auth: nonAffToken });
        expect(res.status).toBe(403);
      }
    });
  });

  describe('GET /me', () => {
    it('returns affiliate + totals + referral counts', async () => {
      const res = await api.get('/api/affiliate/me', { auth: affToken });
      expect(res.status).toBe(200);
      expect(res.body.affiliate.bonusCode).toBe(testCode);
      expect(res.body.affiliate.commissionRate).toBe(0.20);
      expect(res.body.totals).toMatchObject({
        earnedEur: 0, invoicedEur: 0, paidEur: 0,
        accruedBalanceEur: 0, outstandingPayableEur: 0,
      });
      expect(res.body.referrals).toMatchObject({ active: 0, total: 0 });
    });

    it('returns 403 when affiliate is disabled', async () => {
      const pool = getAppPool();
      await pool.query(`UPDATE affiliates SET enabled = FALSE WHERE id = $1`, [affiliateId]);
      try {
        const res = await api.get('/api/affiliate/me', { auth: affToken });
        expect(res.status).toBe(403);
      } finally {
        // Always re-enable so subsequent tests see the active affiliate.
        await pool.query(`UPDATE affiliates SET enabled = TRUE WHERE id = $1`, [affiliateId]);
      }
    });
  });

  describe('GET /referrals (anonymised)', () => {
    it('returns pseudo-IDs (R-001 etc.) and never raw org_id or member data', async () => {
      const pool = getAppPool();
      await pool.query(
        `INSERT INTO affiliate_attributions (affiliate_id, org_id, bonus_code_used, commission_window_ends_at)
         VALUES ($1, 'fake-org-anon-${Date.now()}', $2, NOW() + INTERVAL '12 months')`,
        [affiliateId, testCode]
      );

      const res = await api.get('/api/affiliate/referrals', { auth: affToken });
      expect(res.status).toBe(200);
      const r = res.body.referrals[0];
      expect(r.ref).toMatch(/^R-\d{3}$/);
      expect(r.orgId).toBeUndefined();
      expect(r.email).toBeUndefined();
      expect(r.inWindow).toBeDefined();
    });
  });

  describe('POST /invoice', () => {
    it('records an invoice_received ledger entry', async () => {
      const invoiceNumber = `INV-T-${Date.now()}`;
      const res = await api.post('/api/affiliate/invoice', {
        auth: affToken,
        body: { amountEur: 50.00, invoiceNumber, periodLabel: 'Test' },
      });
      expect(res.status).toBe(201);
      expect(res.body.entry.entry_type).toBe('invoice_received');
    });

    it('rejects duplicate invoice number (409)', async () => {
      const invoiceNumber = `INV-T-DUP-${Date.now()}`;
      const first = await api.post('/api/affiliate/invoice', {
        auth: affToken,
        body: { amountEur: 75.00, invoiceNumber },
      });
      expect(first.status).toBe(201);

      const second = await api.post('/api/affiliate/invoice', {
        auth: affToken,
        body: { amountEur: 75.00, invoiceNumber },
      });
      expect(second.status).toBe(409);
    });

    it('rejects non-positive amount (400)', async () => {
      const res = await api.post('/api/affiliate/invoice', {
        auth: affToken,
        body: { amountEur: 0, invoiceNumber: `INV-T-ZERO-${Date.now()}` },
      });
      expect(res.status).toBe(400);
    });

    it('rejects missing invoice number (400)', async () => {
      const res = await api.post('/api/affiliate/invoice', {
        auth: affToken,
        body: { amountEur: 50, invoiceNumber: '' },
      });
      expect(res.status).toBe(400);
    });
  });
});

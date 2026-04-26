/**
 * Admin Affiliates Route Tests — /api/admin/affiliates
 *
 * Covers: list with computed totals, create with duplicate-block, detail
 * with full nested response, edit, manual ledger entry, link-user (with
 * conflict guard), regenerate-statement (idempotent skip + force).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginTestUser, TEST_USERS, getAppPool } from '../setup/test-helpers.js';

describe('/api/admin/affiliates', () => {
  let adminToken: string;
  let mfgToken: string;
  const createdIds: string[] = [];
  const linkedUserIds: string[] = [];

  beforeAll(async () => {
    adminToken = await loginTestUser(TEST_USERS.platformAdmin);
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
  });

  afterAll(async () => {
    const pool = getAppPool();
    if (createdIds.length > 0) {
      await pool.query(`DELETE FROM affiliate_ledger_entries WHERE affiliate_id = ANY($1)`, [createdIds]);
      await pool.query(`DELETE FROM affiliate_attributions WHERE affiliate_id = ANY($1)`, [createdIds]);
      await pool.query(`DELETE FROM affiliate_monthly_statements WHERE affiliate_id = ANY($1)`, [createdIds]);
      await pool.query(`DELETE FROM affiliates WHERE id = ANY($1)`, [createdIds]);
    }
  });

  function uniqCode(prefix: string): string {
    return `${prefix}${Math.floor(Math.random() * 1_000_000)}`;
  }

  describe('Auth guards', () => {
    it('rejects non-platform-admin (mfgAdmin gets 403)', async () => {
      const res = await api.get('/api/admin/affiliates', { auth: mfgToken });
      expect([401, 403]).toContain(res.status);
    });
    it('rejects unauthenticated (401)', async () => {
      const res = await api.get('/api/admin/affiliates');
      expect(res.status).toBe(401);
    });
  });

  describe('POST + GET list', () => {
    it('creates an affiliate then sees it in the list', async () => {
      const code = uniqCode('A');
      const create = await api.post('/api/admin/affiliates', {
        auth: adminToken,
        body: { bonusCode: code, displayName: 'Admin Test', contactEmail: 'admin-aff@example.com', commissionRate: 0.25 },
      });
      expect(create.status).toBe(201);
      createdIds.push(create.body.affiliate.id);

      const list = await api.get('/api/admin/affiliates', { auth: adminToken });
      expect(list.status).toBe(200);
      const found = list.body.affiliates.find((a: any) => a.bonusCode === code);
      expect(found).toBeDefined();
      expect(found.commissionRate).toBe(0.25);
      expect(found.activeReferrals).toBe(0);
      expect(found.earnedEur).toBe(0);
    });

    it('rejects duplicate code (case-insensitive 409)', async () => {
      const code = uniqCode('A');
      const first = await api.post('/api/admin/affiliates', {
        auth: adminToken,
        body: { bonusCode: code, displayName: 'X', contactEmail: 'x@example.com' },
      });
      createdIds.push(first.body.affiliate.id);

      const dupe = await api.post('/api/admin/affiliates', {
        auth: adminToken,
        body: { bonusCode: code.toLowerCase(), displayName: 'Y', contactEmail: 'y@example.com' },
      });
      expect(dupe.status).toBe(409);
    });

    it('rejects bad commission rate (400)', async () => {
      const res = await api.post('/api/admin/affiliates', {
        auth: adminToken,
        body: { bonusCode: uniqCode('A'), displayName: 'Z', contactEmail: 'z@example.com', commissionRate: 1.5 },
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /:id detail + PUT edit', () => {
    let aid: string;

    beforeAll(async () => {
      const create = await api.post('/api/admin/affiliates', {
        auth: adminToken,
        body: { bonusCode: uniqCode('AD'), displayName: 'Detail', contactEmail: 'detail@example.com' },
      });
      aid = create.body.affiliate.id;
      createdIds.push(aid);
    });

    it('returns full nested response (totals/ledger/statements/referrals)', async () => {
      const res = await api.get(`/api/admin/affiliates/${aid}`, { auth: adminToken });
      expect(res.status).toBe(200);
      expect(res.body.affiliate).toBeDefined();
      expect(res.body.totals).toBeDefined();
      expect(Array.isArray(res.body.ledger)).toBe(true);
      expect(Array.isArray(res.body.statements)).toBe(true);
      expect(Array.isArray(res.body.referrals)).toBe(true);
    });

    it('PUT updates rate + enabled flag', async () => {
      const res = await api.put(`/api/admin/affiliates/${aid}`, {
        auth: adminToken,
        body: { commissionRate: 0.30, enabled: false },
      });
      expect(res.status).toBe(200);
      const detail = await api.get(`/api/admin/affiliates/${aid}`, { auth: adminToken });
      expect(detail.body.affiliate.commissionRate).toBe(0.30);
      expect(detail.body.affiliate.enabled).toBe(false);
    });
  });

  describe('Ledger entry + balance computation', () => {
    let aid: string;

    beforeAll(async () => {
      const create = await api.post('/api/admin/affiliates', {
        auth: adminToken,
        body: { bonusCode: uniqCode('AL'), displayName: 'Ledger', contactEmail: 'ledger@example.com' },
      });
      aid = create.body.affiliate.id;
      createdIds.push(aid);
    });

    it('records invoice_received and payment_made; balances reconcile', async () => {
      const inv = await api.post(`/api/admin/affiliates/${aid}/ledger`, {
        auth: adminToken,
        body: { entryType: 'invoice_received', amountEur: 100, reference: 'INV-1' },
      });
      expect(inv.status).toBe(201);

      const pay = await api.post(`/api/admin/affiliates/${aid}/ledger`, {
        auth: adminToken,
        body: { entryType: 'payment_made', amountEur: 100, reference: 'BANK-1' },
      });
      expect(pay.status).toBe(201);

      const detail = await api.get(`/api/admin/affiliates/${aid}`, { auth: adminToken });
      expect(detail.body.totals.invoicedEur).toBe(100);
      expect(detail.body.totals.paidEur).toBe(100);
      expect(detail.body.totals.outstandingPayableEur).toBe(0);
    });

    it('rejects entryType=commission_accrued from admin (scheduler-only)', async () => {
      const res = await api.post(`/api/admin/affiliates/${aid}/ledger`, {
        auth: adminToken,
        body: { entryType: 'commission_accrued', amountEur: 50 },
      });
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /:id/link-user', () => {
    let aid: string;

    beforeAll(async () => {
      const create = await api.post('/api/admin/affiliates', {
        auth: adminToken,
        body: { bonusCode: uniqCode('AU'), displayName: 'Linker', contactEmail: 'linker@example.com' },
      });
      aid = create.body.affiliate.id;
      createdIds.push(aid);
    });

    it('links by email, surfaces in detail, and unlinks with email:null', async () => {
      const link = await api.put(`/api/admin/affiliates/${aid}/link-user`, {
        auth: adminToken,
        body: { email: TEST_USERS.mfgAdmin },
      });
      expect(link.status).toBe(200);
      expect(link.body.linked).toBe(true);
      linkedUserIds.push(link.body.userId);

      const detail = await api.get(`/api/admin/affiliates/${aid}`, { auth: adminToken });
      expect(detail.body.affiliate.linkedUserEmail).toBe(TEST_USERS.mfgAdmin);

      const unlink = await api.put(`/api/admin/affiliates/${aid}/link-user`, {
        auth: adminToken,
        body: { email: null },
      });
      expect(unlink.status).toBe(200);
      expect(unlink.body.linked).toBe(false);
    });

    it('returns 404 for unknown email', async () => {
      const res = await api.put(`/api/admin/affiliates/${aid}/link-user`, {
        auth: adminToken,
        body: { email: 'nobody-such@example.com' },
      });
      expect(res.status).toBe(404);
    });

    it('returns 409 when another affiliate already owns the user', async () => {
      // Link mfgAdmin to first affiliate
      const link1 = await api.put(`/api/admin/affiliates/${aid}/link-user`, {
        auth: adminToken,
        body: { email: TEST_USERS.mfgAdmin },
      });
      expect(link1.status).toBe(200);

      // Create a second affiliate
      const second = await api.post('/api/admin/affiliates', {
        auth: adminToken,
        body: { bonusCode: uniqCode('AU2'), displayName: 'Second', contactEmail: 'second@example.com' },
      });
      createdIds.push(second.body.affiliate.id);

      // Try to link the same user to it
      const res = await api.put(`/api/admin/affiliates/${second.body.affiliate.id}/link-user`, {
        auth: adminToken,
        body: { email: TEST_USERS.mfgAdmin },
      });
      expect(res.status).toBe(409);

      // Cleanup: unlink first
      await api.put(`/api/admin/affiliates/${aid}/link-user`, {
        auth: adminToken, body: { email: null },
      });
    });
  });

  describe('Statement regeneration', () => {
    let aid: string;

    beforeAll(async () => {
      const create = await api.post('/api/admin/affiliates', {
        auth: adminToken,
        body: { bonusCode: uniqCode('AS'), displayName: 'Stmt', contactEmail: 'stmt@example.com' },
      });
      aid = create.body.affiliate.id;
      createdIds.push(aid);
    });

    it('rejects malformed period (400)', async () => {
      const res = await api.post(`/api/admin/affiliates/${aid}/regenerate-statement`, {
        auth: adminToken,
        body: { period: 'invalid' },
      });
      expect(res.status).toBe(400);
    });

    it('first run generates, second run skips, force=true regenerates', async () => {
      const first = await api.post(`/api/admin/affiliates/${aid}/regenerate-statement`, {
        auth: adminToken,
        body: { period: '2026-01' },
      });
      expect(first.status).toBe(200);
      expect(first.body.statementId).toBeDefined();
      const firstId = first.body.statementId;

      const second = await api.post(`/api/admin/affiliates/${aid}/regenerate-statement`, {
        auth: adminToken,
        body: { period: '2026-01' },
      });
      expect(second.status).toBe(200);
      expect(second.body.skipped).toBe('exists');
      expect(second.body.statementId).toBe(firstId);

      const forced = await api.post(`/api/admin/affiliates/${aid}/regenerate-statement`, {
        auth: adminToken,
        body: { period: '2026-01', force: true },
      });
      expect(forced.status).toBe(200);
      expect(forced.body.skipped).toBeNull();
      expect(forced.body.statementId).not.toBe(firstId);
    });
  });
});

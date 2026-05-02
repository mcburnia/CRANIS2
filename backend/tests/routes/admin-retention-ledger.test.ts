/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

/**
 * Admin Retention Ledger — Integration Tests
 *
 * Tests:
 *   GET /api/admin/retention-ledger
 *   GET /api/admin/retention-ledger/summary
 *   GET /api/admin/retention-ledger/expiry-warnings
 *   GET /api/admin/retention-ledger/cost-forecast
 *   GET /api/admin/retention-ledger/snapshots
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

let adminToken: string;
let memberToken: string;

beforeAll(async () => {
  adminToken = await loginTestUser(TEST_USERS.platformAdmin);
  memberToken = await loginTestUser(TEST_USERS.mfgMember1);
}, 15000);

describe('Admin Retention Ledger', () => {
  describe('Auth & access control', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await api.get('/api/admin/retention-ledger');
      expect(res.status).toBe(401);
    });

    it('rejects non-admin users', async () => {
      const res = await api.get('/api/admin/retention-ledger', { auth: memberToken });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/retention-ledger', () => {
    it('returns ledger entries for admin', async () => {
      const res = await api.get('/api/admin/retention-ledger', { auth: adminToken });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/admin/retention-ledger/summary', () => {
    it('returns ledger summary', async () => {
      const res = await api.get('/api/admin/retention-ledger/summary', { auth: adminToken });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/admin/retention-ledger/expiry-warnings', () => {
    it('returns expiry warnings', async () => {
      const res = await api.get('/api/admin/retention-ledger/expiry-warnings', { auth: adminToken });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/admin/retention-ledger/cost-forecast', () => {
    it('returns cost forecast', async () => {
      const res = await api.get('/api/admin/retention-ledger/cost-forecast', { auth: adminToken });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/admin/retention-ledger/snapshots', () => {
    it('returns snapshot list', async () => {
      const res = await api.get('/api/admin/retention-ledger/snapshots', { auth: adminToken });
      expect(res.status).toBe(200);
    });
  });
});

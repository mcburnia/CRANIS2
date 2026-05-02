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
 * Admin System — Integration Tests
 *
 * Tests:
 *   GET  /api/admin/system
 *   GET  /api/admin/feedback
 *   PUT  /api/admin/feedback/:id
 *   GET  /api/admin/test-results
 *   GET  /api/admin/webhook-health
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

let adminToken: string;
let memberToken: string;

beforeAll(async () => {
  adminToken = await loginTestUser(TEST_USERS.platformAdmin);
  memberToken = await loginTestUser(TEST_USERS.mfgMember1);
}, 15000);

describe('Admin System', () => {
  describe('Auth & access control', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await api.get('/api/admin/system');
      expect(res.status).toBe(401);
    });

    it('rejects non-admin users', async () => {
      const res = await api.get('/api/admin/system', { auth: memberToken });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/system', () => {
    it('returns system health stats', async () => {
      const res = await api.get('/api/admin/system', { auth: adminToken });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/admin/feedback', () => {
    it('returns feedback list', async () => {
      const res = await api.get('/api/admin/feedback', { auth: adminToken });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/admin/test-results', () => {
    it('returns test results', async () => {
      const res = await api.get('/api/admin/test-results', { auth: adminToken });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/admin/webhook-health', () => {
    it('returns webhook health data', async () => {
      const res = await api.get('/api/admin/webhook-health', { auth: adminToken });
      expect(res.status).toBe(200);
    });
  });
});

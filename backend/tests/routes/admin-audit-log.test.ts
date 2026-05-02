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
 * Admin Audit Log — Integration Tests
 *
 * Tests:
 *   GET /api/admin/audit-log
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

let adminToken: string;
let memberToken: string;

beforeAll(async () => {
  adminToken = await loginTestUser(TEST_USERS.platformAdmin);
  memberToken = await loginTestUser(TEST_USERS.mfgMember1);
}, 15000);

describe('GET /api/admin/audit-log', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await api.get('/api/admin/audit-log');
    expect(res.status).toBe(401);
  });

  it('rejects non-admin users', async () => {
    const res = await api.get('/api/admin/audit-log', { auth: memberToken });
    expect(res.status).toBe(403);
  });

  it('returns cross-org audit log for admin', async () => {
    const res = await api.get('/api/admin/audit-log', { auth: adminToken });
    expect(res.status).toBe(200);
    expect(res.body.events).toBeDefined();
    expect(Array.isArray(res.body.events)).toBe(true);
  });

  it('supports pagination', async () => {
    const res = await api.get('/api/admin/audit-log', {
      auth: adminToken,
      query: { page: '1', limit: '5' },
    });
    expect(res.status).toBe(200);
  });

  it('supports event type filter', async () => {
    const res = await api.get('/api/admin/audit-log', {
      auth: adminToken,
      query: { eventType: 'login' },
    });
    expect(res.status).toBe(200);
  });

  it('supports email filter', async () => {
    const res = await api.get('/api/admin/audit-log', {
      auth: adminToken,
      query: { email: TEST_USERS.mfgAdmin },
    });
    expect(res.status).toBe(200);
  });
});

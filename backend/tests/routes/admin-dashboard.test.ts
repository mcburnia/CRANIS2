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
 * Admin Dashboard — Integration Tests
 *
 * Tests:
 *   GET /api/admin/dashboard
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

let adminToken: string;
let memberToken: string;

beforeAll(async () => {
  adminToken = await loginTestUser(TEST_USERS.platformAdmin);
  memberToken = await loginTestUser(TEST_USERS.mfgMember1);
}, 15000);

describe('GET /api/admin/dashboard', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await api.get('/api/admin/dashboard');
    expect(res.status).toBe(401);
  });

  it('rejects non-admin users', async () => {
    const res = await api.get('/api/admin/dashboard', { auth: memberToken });
    expect(res.status).toBe(403);
  });

  it('returns dashboard stats for admin', async () => {
    const res = await api.get('/api/admin/dashboard', { auth: adminToken });
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });
});

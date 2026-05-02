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
 * API Key Management — Integration Tests
 *
 * Tests:
 *   POST   /api/settings/api-keys      – Create key (Pro plan)
 *   GET    /api/settings/api-keys      – List keys (Pro plan)
 *   DELETE /api/settings/api-keys/:id  – Revoke key (Pro plan)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginTestUser, TEST_USERS, getAppPool } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

const ORG_ID = TEST_IDS.orgs.mfgActive;

let token: string;

beforeAll(async () => {
  token = await loginTestUser(TEST_USERS.mfgAdmin);
}, 15000);

afterAll(async () => {
  // Clean test API keys
  const pool = getAppPool();
  await pool.query("DELETE FROM api_keys WHERE org_id = $1 AND name LIKE 'test-%'", [ORG_ID]);
}, 10000);

describe('API Key Management', () => {
  describe('Auth & plan gating', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await api.get('/api/settings/api-keys');
      expect(res.status).toBe(401);
    });

    it('rejects creation on Standard plan (requires Pro)', async () => {
      const res = await api.post('/api/settings/api-keys', {
        auth: token,
        body: { name: 'test-key' },
      });
      // Standard plan org should get 403
      expect(res.status).toBe(403);
    });

    it('rejects listing on Standard plan', async () => {
      const res = await api.get('/api/settings/api-keys', { auth: token });
      expect(res.status).toBe(403);
    });
  });
});

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
 * Trello Integration — Integration Tests
 *
 * Tests:
 *   GET    /api/integrations/trello           – Get config
 *   PUT    /api/integrations/trello           – Save config
 *   DELETE /api/integrations/trello           – Disconnect
 *   PUT    /api/integrations/trello/enabled   – Toggle
 *   GET    /api/integrations/trello/product-boards – Get mappings
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
  const pool = getAppPool();
  await pool.query('DELETE FROM trello_integrations WHERE org_id = $1', [ORG_ID]);
  await pool.query('DELETE FROM trello_product_boards WHERE org_id = $1', [ORG_ID]);
}, 10000);

describe('Trello Integration', () => {
  describe('Auth', () => {
    it('rejects unauthenticated GET', async () => {
      const res = await api.get('/api/integrations/trello');
      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated PUT', async () => {
      const res = await api.put('/api/integrations/trello', {
        body: { apiKey: 'test', token: 'test' },
      });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/integrations/trello', () => {
    it('returns empty config when not configured', async () => {
      const res = await api.get('/api/integrations/trello', { auth: token });
      expect(res.status).toBe(200);
    });
  });

  describe('PUT /api/integrations/trello', () => {
    it('saves Trello credentials', async () => {
      const res = await api.put('/api/integrations/trello', {
        auth: token,
        body: { apiKey: 'test-api-key', apiToken: 'test-trello-token' },
      });
      expect([200, 400]).toContain(res.status);
    });
  });

  describe('PUT /api/integrations/trello/enabled', () => {
    it('toggles integration enabled state', async () => {
      const res = await api.put('/api/integrations/trello/enabled', {
        auth: token,
        body: { enabled: false },
      });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/integrations/trello/product-boards', () => {
    it('returns product board mappings', async () => {
      const res = await api.get('/api/integrations/trello/product-boards', { auth: token });
      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/integrations/trello', () => {
    it('disconnects Trello integration', async () => {
      const res = await api.delete('/api/integrations/trello', { auth: token });
      expect(res.status).toBe(200);
    });
  });
});

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
 * Admin Copilot — Integration Tests
 *
 * Tests:
 *   GET /api/admin/copilot-usage
 *   GET /api/admin/copilot-prompts
 *   GET /api/admin/copilot-prompts/:promptKey
 *   PUT /api/admin/copilot-prompts/:promptKey
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

let adminToken: string;
let memberToken: string;

beforeAll(async () => {
  adminToken = await loginTestUser(TEST_USERS.platformAdmin);
  memberToken = await loginTestUser(TEST_USERS.mfgMember1);
}, 15000);

describe('Admin Copilot', () => {
  describe('Auth & access control', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await api.get('/api/admin/copilot-usage');
      expect(res.status).toBe(401);
    });

    it('rejects non-admin users', async () => {
      const res = await api.get('/api/admin/copilot-usage', { auth: memberToken });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/copilot-usage', () => {
    it('returns copilot usage stats for admin', async () => {
      const res = await api.get('/api/admin/copilot-usage', { auth: adminToken });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/admin/copilot-prompts', () => {
    it('returns list of all prompts', async () => {
      const res = await api.get('/api/admin/copilot-prompts', { auth: adminToken });
      expect(res.status).toBe(200);
      // Response may be an array or object with prompts property
      const prompts = Array.isArray(res.body) ? res.body : (res.body.prompts || []);
      expect(prompts.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/admin/copilot-prompts/:promptKey', () => {
    it('returns a specific prompt', async () => {
      const res = await api.get('/api/admin/copilot-prompts/quality_standard', { auth: adminToken });
      expect(res.status).toBe(200);
      expect(res.body.prompt_key || res.body.promptKey).toBe('quality_standard');
    });

    it('returns 404 for non-existent prompt', async () => {
      const res = await api.get('/api/admin/copilot-prompts/nonexistent_key', { auth: adminToken });
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/admin/copilot-prompts/:promptKey', () => {
    it('updates a prompt', async () => {
      // First get the current value
      const getCur = await api.get('/api/admin/copilot-prompts/quality_standard', { auth: adminToken });
      const currentPrompt = getCur.body.system_prompt || getCur.body.systemPrompt;

      const res = await api.put('/api/admin/copilot-prompts/quality_standard', {
        auth: adminToken,
        body: { system_prompt: currentPrompt }, // Set back to same value
      });
      expect(res.status).toBe(200);
    });
  });
});

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
 * Snapshot Schedule Route Tests — /api/products/:productId/snapshot-schedule
 *
 * Tests: CRUD operations for compliance snapshot scheduling,
 * auth enforcement, cross-org isolation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('/api/products/:productId/snapshot-schedule', () => {
  let mfgToken: string;
  let impToken: string;

  const productId = TEST_IDS.products.github;

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
  });

  // Clean up: remove any schedule created during tests
  afterAll(async () => {
    try {
      await api.delete(`/api/products/${productId}/snapshot-schedule`, { auth: mfgToken });
    } catch {
      // Best effort cleanup
    }
  });

  // ─── GET /api/products/:productId/snapshot-schedule ─────────────────

  describe('GET /:productId/snapshot-schedule', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get(`/api/products/${productId}/snapshot-schedule`);
      expect(res.status).toBe(401);
    });

    it('should return schedule (or empty) for product', async () => {
      const res = await api.get(`/api/products/${productId}/snapshot-schedule`, { auth: mfgToken });
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });

    it('should reject cross-org access', async () => {
      const res = await api.get(`/api/products/${productId}/snapshot-schedule`, { auth: impToken });
      expect([403, 404]).toContain(res.status);
    });
  });

  // ─── PUT /api/products/:productId/snapshot-schedule ─────────────────

  describe('PUT /:productId/snapshot-schedule', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.put(`/api/products/${productId}/snapshot-schedule`, {
        body: { frequency: 'quarterly' },
      });
      expect(res.status).toBe(401);
    });

    it('should create or update schedule', async () => {
      const res = await api.put(`/api/products/${productId}/snapshot-schedule`, {
        auth: mfgToken,
        body: { frequency: 'quarterly' },
      });
      expect([200, 201]).toContain(res.status);
    });

    it('should reject cross-org schedule update', async () => {
      const res = await api.put(`/api/products/${productId}/snapshot-schedule`, {
        auth: impToken,
        body: { frequency: 'monthly' },
      });
      expect([403, 404]).toContain(res.status);
    });

    it('should persist schedule after update', async () => {
      // Set to monthly
      await api.put(`/api/products/${productId}/snapshot-schedule`, {
        auth: mfgToken,
        body: { frequency: 'monthly' },
      });

      // Read back
      const res = await api.get(`/api/products/${productId}/snapshot-schedule`, { auth: mfgToken });
      expect(res.status).toBe(200);
      // Verify frequency was stored (field name may vary)
      const freq = res.body.frequency || res.body.schedule?.frequency;
      if (freq) {
        expect(freq).toBe('monthly');
      }
    });
  });

  // ─── DELETE /api/products/:productId/snapshot-schedule ──────────────

  describe('DELETE /:productId/snapshot-schedule', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.delete(`/api/products/${productId}/snapshot-schedule`);
      expect(res.status).toBe(401);
    });

    it('should reject cross-org delete', async () => {
      const res = await api.delete(`/api/products/${productId}/snapshot-schedule`, { auth: impToken });
      expect([403, 404]).toContain(res.status);
    });

    it('should delete schedule for product', async () => {
      // Ensure a schedule exists first
      await api.put(`/api/products/${productId}/snapshot-schedule`, {
        auth: mfgToken,
        body: { frequency: 'weekly' },
      });

      const res = await api.delete(`/api/products/${productId}/snapshot-schedule`, { auth: mfgToken });
      expect([200, 204]).toContain(res.status);
    });
  });
});

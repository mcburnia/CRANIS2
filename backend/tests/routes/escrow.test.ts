/**
 * Escrow Route Tests — /api/escrow
 *
 * Tests: config retrieval, deposit listing, auth, cross-org isolation
 *
 * API response formats (from probing):
 * - GET /api/escrow/:productId/config returns { configured: false } (or true with full config)
 * - GET /api/escrow/:productId/deposits returns { deposits: [], pagination: { page, limit, total, totalPages } }
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('/api/escrow', () => {
  let mfgToken: string;
  let impToken: string;

  const mfgProductId = TEST_IDS.products.github; // c0000001-0000-0000-0000-000000000001

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
  });

  // ─── GET /:productId/config ───────────────────────────────────────────

  describe('GET /:productId/config', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get(`/api/escrow/${mfgProductId}/config`);
      expect(res.status).toBe(401);
    });

    it('should return escrow config for product', async () => {
      const res = await api.get(`/api/escrow/${mfgProductId}/config`, { auth: mfgToken });
      expect(res.status).toBe(200);
      // Response always includes a configured boolean
      expect(res.body).toHaveProperty('configured');
      expect(typeof res.body.configured).toBe('boolean');
    });

    it('should return 404 for non-existent product', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await api.get(`/api/escrow/${fakeId}/config`, { auth: mfgToken });
      expect([403, 404]).toContain(res.status);
    });
  });

  // ─── GET /:productId/deposits ─────────────────────────────────────────

  describe('GET /:productId/deposits', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get(`/api/escrow/${mfgProductId}/deposits`);
      expect(res.status).toBe(401);
    });

    it('should return deposits array with pagination', async () => {
      const res = await api.get(`/api/escrow/${mfgProductId}/deposits`, { auth: mfgToken });
      expect(res.status).toBe(200);

      // Deposits array
      expect(res.body).toHaveProperty('deposits');
      expect(Array.isArray(res.body.deposits)).toBe(true);

      // Pagination metadata
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.pagination).toHaveProperty('page');
      expect(res.body.pagination).toHaveProperty('limit');
      expect(res.body.pagination).toHaveProperty('total');
      expect(res.body.pagination).toHaveProperty('totalPages');
      expect(typeof res.body.pagination.page).toBe('number');
      expect(typeof res.body.pagination.limit).toBe('number');
      expect(typeof res.body.pagination.total).toBe('number');
      expect(typeof res.body.pagination.totalPages).toBe('number');
    });

    it('should return 404 for non-existent product', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await api.get(`/api/escrow/${fakeId}/deposits`, { auth: mfgToken });
      expect([403, 404]).toContain(res.status);
    });
  });

  // ─── Cross-org isolation ──────────────────────────────────────────────

  describe('Cross-org isolation', () => {
    it('should not allow impAdmin to access mfg product escrow config', async () => {
      const res = await api.get(`/api/escrow/${mfgProductId}/config`, { auth: impToken });
      expect([403, 404]).toContain(res.status);
    });

    it('should not allow impAdmin to access mfg product escrow deposits', async () => {
      const res = await api.get(`/api/escrow/${mfgProductId}/deposits`, { auth: impToken });
      expect([403, 404]).toContain(res.status);
    });

    it('should allow impAdmin to access their own product escrow config', async () => {
      const impProductId = TEST_IDS.products.impGithub;
      const res = await api.get(`/api/escrow/${impProductId}/config`, { auth: impToken });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('configured');
    });
  });
});

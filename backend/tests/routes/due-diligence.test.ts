/**
 * Due Diligence Route Tests — /api/due-diligence
 *
 * Tests: preview data retrieval, auth, cross-org isolation
 *
 * API response format (from probing):
 * - GET /api/due-diligence/:productId/preview returns {
 *     product, organisation, dependencies, licenseScan,
 *     licenseFindings, vulnerabilities, ...
 *   }
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('/api/due-diligence', () => {
  let mfgToken: string;
  let impToken: string;

  const mfgProductId = TEST_IDS.products.github; // c0000001-0000-0000-0000-000000000001

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
  });

  // ─── GET /:productId/preview ──────────────────────────────────────────

  describe('GET /:productId/preview', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get(`/api/due-diligence/${mfgProductId}/preview`);
      expect(res.status).toBe(401);
    });

    it('should return preview data for product', async () => {
      const res = await api.get(`/api/due-diligence/${mfgProductId}/preview`, {
        auth: mfgToken,
      });
      expect(res.status).toBe(200);

      // Core product identification
      expect(res.body).toHaveProperty('product');
      expect(res.body).toHaveProperty('organisation');
    });

    it('should include product details in response', async () => {
      const res = await api.get(`/api/due-diligence/${mfgProductId}/preview`, {
        auth: mfgToken,
      });
      expect(res.status).toBe(200);

      // Product object should have identifying info
      expect(res.body.product).toBeTruthy();
      expect(typeof res.body.product).toBe('object');
    });

    it('should include organisation details in response', async () => {
      const res = await api.get(`/api/due-diligence/${mfgProductId}/preview`, {
        auth: mfgToken,
      });
      expect(res.status).toBe(200);

      // Organisation object should be present
      expect(res.body.organisation).toBeTruthy();
      expect(typeof res.body.organisation).toBe('object');
    });

    it('should return 404 for non-existent product', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await api.get(`/api/due-diligence/${fakeId}/preview`, {
        auth: mfgToken,
      });
      expect([403, 404]).toContain(res.status);
    });
  });

  // ─── Cross-org isolation ──────────────────────────────────────────────

  describe('Cross-org isolation', () => {
    it('should not allow impAdmin to access mfg product preview', async () => {
      const res = await api.get(`/api/due-diligence/${mfgProductId}/preview`, {
        auth: impToken,
      });
      expect([403, 404]).toContain(res.status);
    });

    it('should allow impAdmin to access their own product preview', async () => {
      const impProductId = TEST_IDS.products.impGithub;
      const res = await api.get(`/api/due-diligence/${impProductId}/preview`, {
        auth: impToken,
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('product');
      expect(res.body).toHaveProperty('organisation');
    });
  });
});

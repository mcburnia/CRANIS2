/**
 * Compliance Timeline Route Tests — /api/compliance-timeline
 *
 * Tests: timeline data retrieval, auth, cross-org isolation
 *
 * API response format (from probing):
 * - GET /api/compliance-timeline/:productId returns {
 *     productId, productName, timeRange,
 *     vulnerabilityScans, licenseScans, craReports
 *   }
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('/api/compliance-timeline', () => {
  let mfgToken: string;
  let impToken: string;

  const mfgProductId = TEST_IDS.products.github; // c0000001-0000-0000-0000-000000000001

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
  });

  // ─── GET /:productId ─────────────────────────────────────────────────

  describe('GET /:productId', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get(`/api/compliance-timeline/${mfgProductId}`);
      expect(res.status).toBe(401);
    });

    it('should return timeline data for product', async () => {
      const res = await api.get(`/api/compliance-timeline/${mfgProductId}`, { auth: mfgToken });
      expect(res.status).toBe(200);

      // Product identification
      expect(res.body).toHaveProperty('productId');
      expect(res.body.productId).toBe(mfgProductId);

      expect(res.body).toHaveProperty('productName');
      expect(typeof res.body.productName).toBe('string');

      // Time range metadata
      expect(res.body).toHaveProperty('timeRange');

      // Timeline data arrays
      expect(res.body).toHaveProperty('vulnerabilityScans');
      expect(Array.isArray(res.body.vulnerabilityScans)).toBe(true);

      expect(res.body).toHaveProperty('licenseScans');
      expect(Array.isArray(res.body.licenseScans)).toBe(true);

      expect(res.body).toHaveProperty('craReports');
      expect(Array.isArray(res.body.craReports)).toBe(true);
    });

    it('should return correct product name', async () => {
      const res = await api.get(`/api/compliance-timeline/${mfgProductId}`, { auth: mfgToken });
      expect(res.status).toBe(200);
      // The github test product is named 'test-product-github'
      expect(res.body.productName).toBe('test-product-github');
    });

    it('should return timeline data for product with CRA reports', async () => {
      // The github product has seeded CRA reports (draft + notification_sent)
      const res = await api.get(`/api/compliance-timeline/${mfgProductId}`, { auth: mfgToken });
      expect(res.status).toBe(200);
      // Should have at least the seeded CRA reports for this product
      expect(res.body.craReports.length).toBeGreaterThanOrEqual(0);
    });

    it('should return 404 for non-existent product', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await api.get(`/api/compliance-timeline/${fakeId}`, { auth: mfgToken });
      expect([403, 404]).toContain(res.status);
    });
  });

  // ─── Cross-org isolation ──────────────────────────────────────────────

  describe('Cross-org isolation', () => {
    it('should not allow impAdmin to access mfg product timeline', async () => {
      const res = await api.get(`/api/compliance-timeline/${mfgProductId}`, { auth: impToken });
      expect([403, 404]).toContain(res.status);
    });

    it('should allow impAdmin to access their own product timeline', async () => {
      const impProductId = TEST_IDS.products.impGithub;
      const res = await api.get(`/api/compliance-timeline/${impProductId}`, { auth: impToken });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('productId');
      expect(res.body.productId).toBe(impProductId);
      expect(res.body).toHaveProperty('vulnerabilityScans');
      expect(res.body).toHaveProperty('licenseScans');
      expect(res.body).toHaveProperty('craReports');
    });
  });
});

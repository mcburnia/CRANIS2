/**
 * Product Reports Tests — /api/products/:productId/reports
 *
 * Tests the three standalone per-product export endpoints:
 * - GET /api/products/:productId/reports/vulnerabilities?format=md|csv
 * - GET /api/products/:productId/reports/licences?format=md|csv
 * - GET /api/products/:productId/reports/obligations?format=md|csv
 *
 * All endpoints require auth, verify product ownership, and support Markdown + CSV.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

const PRODUCT_ID = TEST_IDS.products.github;
const FAKE_PRODUCT_ID = '00000000-0000-0000-0000-000000000000';

describe('/api/products/:productId/reports', () => {
  let mfgToken: string;
  let impToken: string;

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // VULNERABILITY FINDINGS REPORT
  // ═══════════════════════════════════════════════════════════════════════

  describe('GET /:productId/reports/vulnerabilities', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get(`/api/products/${PRODUCT_ID}/reports/vulnerabilities`);
      expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent product', async () => {
      const res = await api.get(`/api/products/${FAKE_PRODUCT_ID}/reports/vulnerabilities`, { auth: mfgToken });
      expect(res.status).toBe(404);
    });

    it('should return 404 for cross-org product', async () => {
      const res = await api.get(`/api/products/${PRODUCT_ID}/reports/vulnerabilities`, { auth: impToken });
      expect(res.status).toBe(404);
    });

    it('should return Markdown by default', async () => {
      const res = await api.get(`/api/products/${PRODUCT_ID}/reports/vulnerabilities`, { auth: mfgToken });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/markdown');
      const body = typeof res.body === 'string' ? res.body : Buffer.from(res.body).toString('utf-8');
      expect(body).toMatch(/^#/);
    });

    it('should return Markdown with Content-Disposition', async () => {
      const res = await api.get(`/api/products/${PRODUCT_ID}/reports/vulnerabilities`, {
        auth: mfgToken,
        query: { format: 'md' },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-disposition')).toContain('attachment');
      expect(res.headers.get('content-disposition')).toContain('vuln-report');
    });

    it('should return CSV with expected headers', async () => {
      const res = await api.get(`/api/products/${PRODUCT_ID}/reports/vulnerabilities`, {
        auth: mfgToken,
        query: { format: 'csv' },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
      expect(typeof res.body).toBe('string');
      expect(res.body).toContain('Severity');
      expect(res.body).toContain('Source ID');
      expect(res.body).toContain('Title');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // LICENCE COMPLIANCE REPORT
  // ═══════════════════════════════════════════════════════════════════════

  describe('GET /:productId/reports/licences', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get(`/api/products/${PRODUCT_ID}/reports/licences`);
      expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent product', async () => {
      const res = await api.get(`/api/products/${FAKE_PRODUCT_ID}/reports/licences`, { auth: mfgToken });
      expect(res.status).toBe(404);
    });

    it('should return 404 for cross-org product', async () => {
      const res = await api.get(`/api/products/${PRODUCT_ID}/reports/licences`, { auth: impToken });
      expect(res.status).toBe(404);
    });

    it('should return Markdown by default', async () => {
      const res = await api.get(`/api/products/${PRODUCT_ID}/reports/licences`, { auth: mfgToken });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/markdown');
      const body = typeof res.body === 'string' ? res.body : Buffer.from(res.body).toString('utf-8');
      expect(body).toMatch(/^#/);
    });

    it('should return Markdown with Content-Disposition', async () => {
      const res = await api.get(`/api/products/${PRODUCT_ID}/reports/licences`, {
        auth: mfgToken,
        query: { format: 'md' },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-disposition')).toContain('attachment');
      expect(res.headers.get('content-disposition')).toContain('licence-report');
    });

    it('should return CSV with expected headers', async () => {
      const res = await api.get(`/api/products/${PRODUCT_ID}/reports/licences`, {
        auth: mfgToken,
        query: { format: 'csv' },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
      expect(typeof res.body).toBe('string');
      expect(res.body).toContain('Dependency');
      expect(res.body).toContain('Licence');
      expect(res.body).toContain('Category');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // OBLIGATION STATUS REPORT
  // ═══════════════════════════════════════════════════════════════════════

  describe('GET /:productId/reports/obligations', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get(`/api/products/${PRODUCT_ID}/reports/obligations`);
      expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent product', async () => {
      const res = await api.get(`/api/products/${FAKE_PRODUCT_ID}/reports/obligations`, { auth: mfgToken });
      expect(res.status).toBe(404);
    });

    it('should return 404 for cross-org product', async () => {
      const res = await api.get(`/api/products/${PRODUCT_ID}/reports/obligations`, { auth: impToken });
      expect(res.status).toBe(404);
    });

    it('should return Markdown by default', async () => {
      const res = await api.get(`/api/products/${PRODUCT_ID}/reports/obligations`, { auth: mfgToken });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/markdown');
      const body = typeof res.body === 'string' ? res.body : Buffer.from(res.body).toString('utf-8');
      expect(body).toMatch(/^#/);
    });

    it('should return Markdown with Content-Disposition', async () => {
      const res = await api.get(`/api/products/${PRODUCT_ID}/reports/obligations`, {
        auth: mfgToken,
        query: { format: 'md' },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-disposition')).toContain('attachment');
      expect(res.headers.get('content-disposition')).toContain('obligations-report');
    });

    it('should return CSV with expected headers', async () => {
      const res = await api.get(`/api/products/${PRODUCT_ID}/reports/obligations`, {
        auth: mfgToken,
        query: { format: 'csv' },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
      expect(typeof res.body).toBe('string');
      expect(res.body).toContain('Article');
      expect(res.body).toContain('Title');
      expect(res.body).toContain('Effective Status');
    });
  });
});

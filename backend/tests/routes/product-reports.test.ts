/**
 * Product Reports Tests — /api/products/:productId/reports
 *
 * Tests the three standalone per-product export endpoints:
 * - GET /api/products/:productId/reports/vulnerabilities?format=pdf|csv
 * - GET /api/products/:productId/reports/licences?format=pdf|csv
 * - GET /api/products/:productId/reports/obligations?format=pdf|csv
 *
 * All endpoints require auth, verify product ownership, and support PDF + CSV.
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

    it('should return a PDF by default', async () => {
      const res = await api.get(`/api/products/${PRODUCT_ID}/reports/vulnerabilities`, { auth: mfgToken });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/pdf');
      const buf = Buffer.from(res.body);
      expect(buf.slice(0, 4).toString('ascii')).toBe('%PDF');
    });

    it('should return a PDF with Content-Disposition', async () => {
      const res = await api.get(`/api/products/${PRODUCT_ID}/reports/vulnerabilities`, {
        auth: mfgToken,
        query: { format: 'pdf' },
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

    it('should return a PDF by default', async () => {
      const res = await api.get(`/api/products/${PRODUCT_ID}/reports/licences`, { auth: mfgToken });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/pdf');
      const buf = Buffer.from(res.body);
      expect(buf.slice(0, 4).toString('ascii')).toBe('%PDF');
    });

    it('should return a PDF with Content-Disposition', async () => {
      const res = await api.get(`/api/products/${PRODUCT_ID}/reports/licences`, {
        auth: mfgToken,
        query: { format: 'pdf' },
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

    it('should return a PDF by default', async () => {
      const res = await api.get(`/api/products/${PRODUCT_ID}/reports/obligations`, { auth: mfgToken });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/pdf');
      const buf = Buffer.from(res.body);
      expect(buf.slice(0, 4).toString('ascii')).toBe('%PDF');
    });

    it('should return a PDF with Content-Disposition', async () => {
      const res = await api.get(`/api/products/${PRODUCT_ID}/reports/obligations`, {
        auth: mfgToken,
        query: { format: 'pdf' },
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

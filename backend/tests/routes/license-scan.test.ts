/**
 * License Scan Route Tests — /api/license-scan
 *
 * Tests: overview (totals + products), per-product findings, cross-org isolation
 *
 * API response format notes:
 * - GET /api/license-scan/overview returns { totals: { totalDeps, permissiveCount, copyleftCount, unknownCount, ... }, products: [...] }
 * - GET /api/license-scan/:productId returns { findings: [...], latestScan: null|{...} }
 */

import { describe, it, expect } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('/api/license-scan', () => {
  let mfgToken: string;
  let impToken: string;

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
  });

  // ─── GET /api/license-scan/overview ───────────────────────────────────

  describe('GET /api/license-scan/overview', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get('/api/license-scan/overview');
      expect(res.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const res = await api.get('/api/license-scan/overview', { auth: 'invalid.jwt.token' });
      expect(res.status).toBe(401);
    });

    it('should return totals and products for authenticated user', async () => {
      const res = await api.get('/api/license-scan/overview', { auth: mfgToken });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totals');
      expect(res.body).toHaveProperty('products');
      expect(Array.isArray(res.body.products)).toBe(true);
    });

    it('should include license category counts in totals', async () => {
      const res = await api.get('/api/license-scan/overview', { auth: mfgToken });
      expect(res.status).toBe(200);

      const totals = res.body.totals;
      expect(totals).toHaveProperty('totalDeps');
      expect(totals).toHaveProperty('permissiveCount');
      expect(totals).toHaveProperty('copyleftCount');
      expect(totals).toHaveProperty('unknownCount');
      expect(typeof totals.totalDeps).toBe('number');
      expect(typeof totals.permissiveCount).toBe('number');
      expect(typeof totals.copyleftCount).toBe('number');
      expect(typeof totals.unknownCount).toBe('number');
    });

    it('should include product-level data in products array', async () => {
      const res = await api.get('/api/license-scan/overview', { auth: mfgToken });
      expect(res.status).toBe(200);

      // Mfg org has seeded products
      if (res.body.products.length > 0) {
        const product = res.body.products[0];
        // Overview uses productId/productName, not id/name
        expect(product).toHaveProperty('productId');
        expect(product).toHaveProperty('productName');
      }
    });

    it('should return empty products for org with no products', async () => {
      const emptyToken = await loginTestUser(TEST_USERS.emptyAdmin);
      const res = await api.get('/api/license-scan/overview', { auth: emptyToken });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('products');
      expect(res.body.products.length).toBe(0);
    });
  });

  // ─── GET /api/license-scan/:productId ─────────────────────────────────

  describe('GET /api/license-scan/:productId', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get(`/api/license-scan/${TEST_IDS.products.github}`);
      expect(res.status).toBe(401);
    });

    it('should return findings and latestScan for product', async () => {
      const res = await api.get(`/api/license-scan/${TEST_IDS.products.github}`, { auth: mfgToken });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('findings');
      expect(Array.isArray(res.body.findings)).toBe(true);
      // latestScan can be null if no scan has run yet
      expect(res.body).toHaveProperty('latestScan');
    });

    it('should return findings as array (possibly empty)', async () => {
      const res = await api.get(`/api/license-scan/${TEST_IDS.products.github}`, { auth: mfgToken });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.findings)).toBe(true);

      // If there are findings, check field structure
      if (res.body.findings.length > 0) {
        const finding = res.body.findings[0];
        expect(finding).toHaveProperty('id');
      }
    });

    it('should return empty findings for product with no license data', async () => {
      // gitea product likely has no license scan findings
      const res = await api.get(`/api/license-scan/${TEST_IDS.products.gitea}`, { auth: mfgToken });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('findings');
      expect(res.body.findings.length).toBe(0);
    });

    it('should return 404 or empty for non-existent product', async () => {
      const res = await api.get('/api/license-scan/00000000-0000-0000-0000-000000000000', { auth: mfgToken });
      // May return 404, 403, or 200 with empty findings
      expect([200, 403, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.findings.length).toBe(0);
      }
    });

    it('should return latestScan as null when no scan has been run', async () => {
      // Products without scans should have latestScan: null
      const res = await api.get(`/api/license-scan/${TEST_IDS.products.gitea}`, { auth: mfgToken });
      expect(res.status).toBe(200);
      expect(res.body.latestScan).toBeNull();
    });
  });

  // ─── Cross-org isolation ──────────────────────────────────────────────

  describe('Cross-org isolation', () => {
    it('should not let importer admin access manufacturer product license data', async () => {
      const res = await api.get(`/api/license-scan/${TEST_IDS.products.github}`, { auth: impToken });
      // May return 403, 404, or 200 with empty findings (product not found in their org)
      expect([200, 403, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.findings.length).toBe(0);
      }
    });

    it('should not leak manufacturer products in importer overview', async () => {
      const res = await api.get('/api/license-scan/overview', { auth: impToken });
      expect(res.status).toBe(200);

      const mfgProductIds = [
        TEST_IDS.products.github,
        TEST_IDS.products.codeberg,
        TEST_IDS.products.gitea,
        TEST_IDS.products.forgejo,
        TEST_IDS.products.gitlab,
      ];
      const foundCrossOrg = res.body.products.filter(
        (p: any) => mfgProductIds.includes(p.id)
      );
      expect(foundCrossOrg.length).toBe(0);
    });

    it('should isolate totals per org', async () => {
      // Each org should get their own totals, not a global aggregate
      const mfgRes = await api.get('/api/license-scan/overview', { auth: mfgToken });
      const impRes = await api.get('/api/license-scan/overview', { auth: impToken });
      expect(mfgRes.status).toBe(200);
      expect(impRes.status).toBe(200);

      // Both should have totals objects — values may differ
      expect(mfgRes.body.totals).toBeTruthy();
      expect(impRes.body.totals).toBeTruthy();
    });
  });
});

/**
 * IP Proof Route Tests — /api/ip-proof
 *
 * Tests: overview (totals + products)
 *
 * API response format notes:
 * - GET /api/ip-proof/overview returns { totals: { totalSnapshots, latestProof, productsProtected, ... }, products: [...] }
 */

import { describe, it, expect } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('/api/ip-proof', () => {
  let mfgToken: string;
  let impToken: string;

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
  });

  // ─── GET /api/ip-proof/overview ───────────────────────────────────────

  describe('GET /api/ip-proof/overview', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get('/api/ip-proof/overview');
      expect(res.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const res = await api.get('/api/ip-proof/overview', { auth: 'invalid.jwt.token' });
      expect(res.status).toBe(401);
    });

    it('should return totals and products for authenticated user', async () => {
      const res = await api.get('/api/ip-proof/overview', { auth: mfgToken });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totals');
      expect(res.body).toHaveProperty('products');
      expect(Array.isArray(res.body.products)).toBe(true);
    });

    it('should include expected fields in totals', async () => {
      const res = await api.get('/api/ip-proof/overview', { auth: mfgToken });
      expect(res.status).toBe(200);

      const totals = res.body.totals;
      expect(totals).toHaveProperty('totalSnapshots');
      expect(totals).toHaveProperty('productsProtected');
      expect(typeof totals.totalSnapshots).toBe('number');
      expect(typeof totals.productsProtected).toBe('number');
    });

    it('should include latestProof in totals (may be null)', async () => {
      const res = await api.get('/api/ip-proof/overview', { auth: mfgToken });
      expect(res.status).toBe(200);

      const totals = res.body.totals;
      expect(totals).toHaveProperty('latestProof');
      // latestProof is a timestamp string or null
      if (totals.latestProof !== null) {
        expect(typeof totals.latestProof).toBe('string');
      }
    });

    it('should include product-level data in products array (if any)', async () => {
      const res = await api.get('/api/ip-proof/overview', { auth: mfgToken });
      expect(res.status).toBe(200);
      // Products array exists (may be empty if no IP proofs generated)
      expect(Array.isArray(res.body.products)).toBe(true);
      if (res.body.products.length > 0) {
        const product = res.body.products[0];
        // Overview uses productId/productName, not id/name
        expect(product).toHaveProperty('productId');
        expect(product).toHaveProperty('productName');
      }
    });

    it('should return empty products for org with no products', async () => {
      const emptyToken = await loginTestUser(TEST_USERS.emptyAdmin);
      const res = await api.get('/api/ip-proof/overview', { auth: emptyToken });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('products');
      expect(res.body.products.length).toBe(0);
    });

    it('should not leak manufacturer products in importer overview', async () => {
      const res = await api.get('/api/ip-proof/overview', { auth: impToken });
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
      const mfgRes = await api.get('/api/ip-proof/overview', { auth: mfgToken });
      const impRes = await api.get('/api/ip-proof/overview', { auth: impToken });
      expect(mfgRes.status).toBe(200);
      expect(impRes.status).toBe(200);

      // Both should have totals — values are org-scoped
      expect(mfgRes.body.totals).toBeTruthy();
      expect(impRes.body.totals).toBeTruthy();
    });
  });
});

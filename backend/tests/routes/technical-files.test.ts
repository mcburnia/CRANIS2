/**
 * Technical Files Route Tests — /api/technical-files
 *
 * Tests: overview (products with sections), per-product detail (returns 404)
 *
 * API response format notes:
 * - GET /api/technical-files/overview returns { products: [...] }
 *   Each product has: id, name, craCategory, sections: [{ sectionKey, title, status, craReference, updatedAt }]
 * - GET /api/technical-files/:productId returns 404 (per-product detail uses a different pattern)
 */

import { describe, it, expect } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('/api/technical-files', () => {
  let mfgToken: string;
  let impToken: string;

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
  });

  // ─── GET /api/technical-files/overview ────────────────────────────────

  describe('GET /api/technical-files/overview', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get('/api/technical-files/overview');
      expect(res.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const res = await api.get('/api/technical-files/overview', { auth: 'invalid.jwt.token' });
      expect(res.status).toBe(401);
    });

    it('should return products array for authenticated user', async () => {
      const res = await api.get('/api/technical-files/overview', { auth: mfgToken });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('products');
      expect(Array.isArray(res.body.products)).toBe(true);
    });

    it('should include product metadata on each product', async () => {
      const res = await api.get('/api/technical-files/overview', { auth: mfgToken });
      expect(res.status).toBe(200);

      expect(res.body.products.length).toBeGreaterThanOrEqual(1);
      const product = res.body.products[0];
      expect(product).toHaveProperty('id');
      expect(product).toHaveProperty('name');
      expect(product).toHaveProperty('craCategory');
    });

    it('should include sections array on each product', async () => {
      const res = await api.get('/api/technical-files/overview', { auth: mfgToken });
      expect(res.status).toBe(200);

      for (const product of res.body.products) {
        expect(product).toHaveProperty('sections');
        expect(Array.isArray(product.sections)).toBe(true);
      }
    });

    it('should have expected fields on each section', async () => {
      const res = await api.get('/api/technical-files/overview', { auth: mfgToken });
      expect(res.status).toBe(200);

      // Find a product with sections
      const productWithSections = res.body.products.find(
        (p: any) => p.sections && p.sections.length > 0
      );
      if (productWithSections) {
        const section = productWithSections.sections[0];
        expect(section).toHaveProperty('sectionKey');
        expect(section).toHaveProperty('title');
        expect(section).toHaveProperty('status');
        expect(section).toHaveProperty('craReference');
        expect(typeof section.sectionKey).toBe('string');
        expect(typeof section.title).toBe('string');
        expect(typeof section.status).toBe('string');
      }
    });

    it('should contain a known seeded product', async () => {
      const res = await api.get('/api/technical-files/overview', { auth: mfgToken });
      expect(res.status).toBe(200);

      const githubProduct = res.body.products.find(
        (p: any) => p.id === TEST_IDS.products.github
      );
      expect(githubProduct).toBeTruthy();
      expect(githubProduct.name).toBe('test-product-github');
    });

    it('should return empty products for org with no products', async () => {
      const emptyToken = await loginTestUser(TEST_USERS.emptyAdmin);
      const res = await api.get('/api/technical-files/overview', { auth: emptyToken });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('products');
      expect(res.body.products.length).toBe(0);
    });
  });

  // ─── GET /api/technical-files/:productId ──────────────────────────────

  describe('GET /api/technical-files/:productId', () => {
    it('should return 404 (per-product detail uses different pattern)', async () => {
      const res = await api.get(`/api/technical-files/${TEST_IDS.products.github}`, { auth: mfgToken });
      expect(res.status).toBe(404);
    });
  });

  // ─── Cross-org isolation ──────────────────────────────────────────────

  describe('Cross-org isolation', () => {
    it('should not leak manufacturer products in importer overview', async () => {
      const res = await api.get('/api/technical-files/overview', { auth: impToken });
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

    it('should only return products belonging to the authenticated org', async () => {
      const res = await api.get('/api/technical-files/overview', { auth: impToken });
      expect(res.status).toBe(200);

      // None of the manufacturer products should appear
      const mfgProductIds = [
        TEST_IDS.products.github,
        TEST_IDS.products.codeberg,
        TEST_IDS.products.gitea,
        TEST_IDS.products.forgejo,
        TEST_IDS.products.gitlab,
      ];
      for (const product of res.body.products) {
        expect(mfgProductIds).not.toContain(product.id);
      }
    });
  });
});

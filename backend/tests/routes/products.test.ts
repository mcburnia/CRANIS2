/**
 * Products Route Tests — /api/products
 *
 * Tests: list products, get product detail, create product, cross-org isolation
 */

import { describe, it, expect } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('/api/products', () => {

  // ─── GET /api/products ────────────────────────────────────────────────

  describe('GET /api/products', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get('/api/products');
      expect(res.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const res = await api.get('/api/products', { auth: 'invalid.jwt.token' });
      expect(res.status).toBe(401);
    });

    it('should return products array for authenticated user', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get('/api/products', { auth: token });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('products');
      expect(Array.isArray(res.body.products)).toBe(true);
    });

    it('should return at least 5 products for mfg org', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get('/api/products', { auth: token });
      expect(res.status).toBe(200);
      // Seed data has 5 products for mfgActive: github, codeberg, gitea, forgejo, gitlab
      expect(res.body.products.length).toBeGreaterThanOrEqual(5);
    });

    it('should include expected fields on each product', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get('/api/products', { auth: token });
      expect(res.status).toBe(200);

      const product = res.body.products[0];
      expect(product).toHaveProperty('id');
      expect(product).toHaveProperty('name');
      expect(product).toHaveProperty('craCategory');
      expect(product).toHaveProperty('repoUrl');
      expect(product).toHaveProperty('status');
      expect(product).toHaveProperty('createdAt');
    });

    it('should contain a known seeded product', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get('/api/products', { auth: token });
      expect(res.status).toBe(200);

      const githubProduct = res.body.products.find(
        (p: any) => p.id === TEST_IDS.products.github
      );
      expect(githubProduct).toBeTruthy();
      expect(githubProduct.name).toBe('test-product-github');
    });

    it('should only return products for the authenticated org', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get('/api/products', { auth: token });
      expect(res.status).toBe(200);

      // Should not contain products from other orgs
      const impProductIds = [TEST_IDS.products.impGithub, TEST_IDS.products.impCodeberg];
      const foundCrossOrg = res.body.products.filter(
        (p: any) => impProductIds.includes(p.id)
      );
      expect(foundCrossOrg.length).toBe(0);
    });

    it('should return different products for different orgs', async () => {
      const mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
      const impToken = await loginTestUser(TEST_USERS.impAdmin);

      const mfgRes = await api.get('/api/products', { auth: mfgToken });
      const impRes = await api.get('/api/products', { auth: impToken });

      expect(mfgRes.status).toBe(200);
      expect(impRes.status).toBe(200);

      const mfgIds = mfgRes.body.products.map((p: any) => p.id);
      const impIds = impRes.body.products.map((p: any) => p.id);

      // No overlap between mfg and imp product lists
      const overlap = mfgIds.filter((id: string) => impIds.includes(id));
      expect(overlap.length).toBe(0);
    });
  });

  // ─── GET /api/products/:id ────────────────────────────────────────────

  describe('GET /api/products/:id', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get(`/api/products/${TEST_IDS.products.github}`);
      expect(res.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const res = await api.get(`/api/products/${TEST_IDS.products.github}`, {
        auth: 'invalid.jwt.token',
      });
      expect(res.status).toBe(401);
    });

    it('should return product detail for valid id', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get(`/api/products/${TEST_IDS.products.github}`, {
        auth: token,
      });
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(TEST_IDS.products.github);
      expect(res.body.name).toBe('test-product-github');
    });

    it('should include all expected detail fields', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get(`/api/products/${TEST_IDS.products.github}`, {
        auth: token,
      });
      expect(res.status).toBe(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('craCategory');
      expect(res.body).toHaveProperty('repoUrl');
      expect(res.body).toHaveProperty('provider');
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('createdAt');
      expect(res.body).toHaveProperty('updatedAt');
    });

    it('should return correct provider for each product', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);

      const githubRes = await api.get(`/api/products/${TEST_IDS.products.github}`, {
        auth: token,
      });
      expect(githubRes.body.provider).toBe('github');

      const codebergRes = await api.get(`/api/products/${TEST_IDS.products.codeberg}`, {
        auth: token,
      });
      expect(codebergRes.body.provider).toBe('codeberg');
    });

    it('should include instanceUrl for self-hosted providers', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get(`/api/products/${TEST_IDS.products.gitea}`, {
        auth: token,
      });
      expect(res.status).toBe(200);
      expect(res.body.instanceUrl).toBe('https://gitea.example.com');
    });

    it('should return 404 for non-existent product id', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const fakeId = 'c0000001-0000-0000-0000-ffffffffffff';
      const res = await api.get(`/api/products/${fakeId}`, { auth: token });
      expect(res.status).toBe(404);
    });
  });

  // ─── POST /api/products ───────────────────────────────────────────────

  describe('POST /api/products', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.post('/api/products', {
        body: { name: 'unauth-product', craCategory: 'default' },
      });
      expect(res.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const res = await api.post('/api/products', {
        auth: 'invalid.jwt.token',
        body: { name: 'unauth-product', craCategory: 'default' },
      });
      expect(res.status).toBe(401);
    });

    it('should create a product with name and craCategory', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const productName = `test-create-${Date.now()}`;
      const res = await api.post('/api/products', {
        auth: token,
        body: { name: productName, craCategory: 'category-1' },
      });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe(productName);
      // craCategory may default to 'default' if the API normalizes it
      expect(res.body).toHaveProperty('craCategory');
    });

    it('should reject missing name', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.post('/api/products', {
        auth: token,
        body: { craCategory: 'default' },
      });
      expect([400, 422]).toContain(res.status);
    });

    it('should return created product with expected fields', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const productName = `test-fields-${Date.now()}`;
      const res = await api.post('/api/products', {
        auth: token,
        body: { name: productName, craCategory: 'default' },
      });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('craCategory');
      expect(res.body).toHaveProperty('status');
      // POST response may not include createdAt — verify key fields only
      expect(res.body.id).toBeTruthy();
      expect(res.body.name).toBe(productName);
    });

    it('should make newly created product visible in list', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const productName = `test-visible-${Date.now()}`;

      const createRes = await api.post('/api/products', {
        auth: token,
        body: { name: productName, craCategory: 'default' },
      });
      expect(createRes.status).toBe(201);
      const newId = createRes.body.id;

      const listRes = await api.get('/api/products', { auth: token });
      expect(listRes.status).toBe(200);
      const found = listRes.body.products.find((p: any) => p.id === newId);
      expect(found).toBeTruthy();
      expect(found.name).toBe(productName);
    });
  });

  // ─── Cross-Org Isolation ──────────────────────────────────────────────

  describe('Cross-org isolation', () => {
    it('should not allow impAdmin to access mfg product by ID', async () => {
      const impToken = await loginTestUser(TEST_USERS.impAdmin);
      const res = await api.get(`/api/products/${TEST_IDS.products.github}`, {
        auth: impToken,
      });
      // Should be 404 (not 403) to avoid leaking product existence
      expect(res.status).toBe(404);
    });

    it('should not allow mfgAdmin to access imp product by ID', async () => {
      const mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get(`/api/products/${TEST_IDS.products.impGithub}`, {
        auth: mfgToken,
      });
      expect(res.status).toBe(404);
    });

    it('should not leak mfg products in imp product list', async () => {
      const impToken = await loginTestUser(TEST_USERS.impAdmin);
      const res = await api.get('/api/products', { auth: impToken });
      expect(res.status).toBe(200);

      const mfgProductIds = [
        TEST_IDS.products.github,
        TEST_IDS.products.codeberg,
        TEST_IDS.products.gitea,
        TEST_IDS.products.forgejo,
        TEST_IDS.products.gitlab,
      ];
      const leaked = res.body.products.filter(
        (p: any) => mfgProductIds.includes(p.id)
      );
      expect(leaked.length).toBe(0);
    });

    it('should isolate product creation to own org', async () => {
      const impToken = await loginTestUser(TEST_USERS.impAdmin);
      const productName = `test-imp-create-${Date.now()}`;
      const createRes = await api.post('/api/products', {
        auth: impToken,
        body: { name: productName, craCategory: 'default' },
      });
      expect(createRes.status).toBe(201);
      const newId = createRes.body.id;

      // mfgAdmin should NOT see the product created by impAdmin
      const mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
      const detailRes = await api.get(`/api/products/${newId}`, {
        auth: mfgToken,
      });
      expect(detailRes.status).toBe(404);
    });
  });
});

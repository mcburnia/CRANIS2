/**
 * Repos Overview Route Tests — GET /api/repos/overview
 *
 * Tests: response shape (products, totals), numeric fields,
 *        cross-org isolation, empty org handling
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('GET /api/repos/overview', () => {
  let mfgToken: string;
  let impToken: string;
  let emptyToken: string;

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
    emptyToken = await loginTestUser(TEST_USERS.emptyAdmin);
  });

  // ─── Authentication ──────────────────────────────────────────────────

  it('should reject unauthenticated request with 401', async () => {
    const res = await api.get('/api/repos/overview');
    expect(res.status).toBe(401);
  });

  // ─── Response Shape ──────────────────────────────────────────────────

  it('should return 200 with expected top-level shape (products, totals)', async () => {
    const res = await api.get('/api/repos/overview', { auth: mfgToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('products');
    expect(Array.isArray(res.body.products)).toBe(true);
    expect(res.body).toHaveProperty('totals');
  });

  it('should include id, name, and repo (possibly null) on each product entry', async () => {
    const res = await api.get('/api/repos/overview', { auth: mfgToken });
    expect(res.status).toBe(200);

    for (const product of res.body.products) {
      expect(product).toHaveProperty('id');
      expect(typeof product.id).toBe('string');
      expect(product).toHaveProperty('name');
      expect(typeof product.name).toBe('string');
      expect(product).toHaveProperty('repo');
      // repo may be null (disconnected) or an object
      if (product.repo !== null) {
        expect(typeof product.repo).toBe('object');
      }
    }
  });

  it('should have numeric fields in totals', async () => {
    const res = await api.get('/api/repos/overview', { auth: mfgToken });
    expect(res.status).toBe(200);

    const { totals } = res.body;
    expect(typeof totals.totalProducts).toBe('number');
    expect(typeof totals.connectedRepos).toBe('number');
    expect(typeof totals.disconnectedProducts).toBe('number');
    expect(typeof totals.totalOpenIssues).toBe('number');
    expect(totals.totalProducts).toBeGreaterThanOrEqual(0);
    expect(totals.connectedRepos).toBeGreaterThanOrEqual(0);
    expect(totals.disconnectedProducts).toBeGreaterThanOrEqual(0);
    expect(totals.totalOpenIssues).toBeGreaterThanOrEqual(0);
  });

  // ─── Cross-org Isolation ─────────────────────────────────────────────

  it('should not leak manufacturer products to importer org', async () => {
    const res = await api.get('/api/repos/overview', { auth: impToken });
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

  // ─── Empty Org ───────────────────────────────────────────────────────

  it('should return empty products array for org with no products', async () => {
    const res = await api.get('/api/repos/overview', { auth: emptyToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('products');
    expect(res.body.products).toHaveLength(0);
  });
});

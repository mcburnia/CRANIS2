/**
 * Technical Files Overview Route Tests — GET /api/technical-files/overview
 *
 * Tests: response shape (products with sections and progress, totals),
 *        section fields, numeric totals, cross-org isolation, empty org handling
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('GET /api/technical-files/overview (detailed)', () => {
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
    const res = await api.get('/api/technical-files/overview');
    expect(res.status).toBe(401);
  });

  // ─── Response Shape ──────────────────────────────────────────────────

  it('should return 200 with expected top-level shape (products, totals)', async () => {
    const res = await api.get('/api/technical-files/overview', { auth: mfgToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('products');
    expect(Array.isArray(res.body.products)).toBe(true);
    expect(res.body).toHaveProperty('totals');
  });

  it('should include id, name, sections array, and progress object on each product', async () => {
    const res = await api.get('/api/technical-files/overview', { auth: mfgToken });
    expect(res.status).toBe(200);

    for (const product of res.body.products) {
      expect(product).toHaveProperty('id');
      expect(typeof product.id).toBe('string');
      expect(product).toHaveProperty('name');
      expect(typeof product.name).toBe('string');
      expect(product).toHaveProperty('sections');
      expect(Array.isArray(product.sections)).toBe(true);
      expect(product).toHaveProperty('progress');
      expect(typeof product.progress).toBe('object');
    }
  });

  it('should include sectionKey, title, and status on each section', async () => {
    const res = await api.get('/api/technical-files/overview', { auth: mfgToken });
    expect(res.status).toBe(200);

    // Find a product that has sections populated
    const productWithSections = res.body.products.find(
      (p: any) => p.sections && p.sections.length > 0
    );
    if (productWithSections) {
      for (const section of productWithSections.sections) {
        expect(section).toHaveProperty('sectionKey');
        expect(typeof section.sectionKey).toBe('string');
        expect(section).toHaveProperty('title');
        expect(typeof section.title).toBe('string');
        expect(section).toHaveProperty('status');
        expect(typeof section.status).toBe('string');
      }
    }
  });

  it('should have numeric fields in totals', async () => {
    const res = await api.get('/api/technical-files/overview', { auth: mfgToken });
    expect(res.status).toBe(200);

    const { totals } = res.body;
    expect(typeof totals.totalSections).toBe('number');
    expect(typeof totals.completed).toBe('number');
    expect(typeof totals.inProgress).toBe('number');
    expect(typeof totals.notStarted).toBe('number');
    expect(totals.totalSections).toBeGreaterThanOrEqual(0);
    expect(totals.completed).toBeGreaterThanOrEqual(0);
    expect(totals.inProgress).toBeGreaterThanOrEqual(0);
    expect(totals.notStarted).toBeGreaterThanOrEqual(0);
  });

  // ─── Cross-org Isolation ─────────────────────────────────────────────

  it('should not leak manufacturer products to importer org', async () => {
    const res = await api.get('/api/technical-files/overview', { auth: impToken });
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

  it('should return empty products and zero totals for org with no products', async () => {
    const res = await api.get('/api/technical-files/overview', { auth: emptyToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('products');
    expect(res.body.products).toHaveLength(0);
    expect(res.body).toHaveProperty('totals');
    expect(res.body.totals.totalSections).toBe(0);
    expect(res.body.totals.completed).toBe(0);
    expect(res.body.totals.inProgress).toBe(0);
    expect(res.body.totals.notStarted).toBe(0);
  });
});

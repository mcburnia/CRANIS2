/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

/**
 * Contributors Overview Route Tests — GET /api/contributors/overview
 *
 * Tests: response shape (products, totals), numeric fields,
 *        cross-org isolation, empty org handling
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('GET /api/contributors/overview', () => {
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
    const res = await api.get('/api/contributors/overview');
    expect(res.status).toBe(401);
  });

  // ─── Response Shape ──────────────────────────────────────────────────

  it('should return 200 with expected top-level shape (products, totals)', async () => {
    const res = await api.get('/api/contributors/overview', { auth: mfgToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('products');
    expect(Array.isArray(res.body.products)).toBe(true);
    expect(res.body).toHaveProperty('totals');
  });

  it('should include id, name, and contributors array on each product entry', async () => {
    const res = await api.get('/api/contributors/overview', { auth: mfgToken });
    expect(res.status).toBe(200);

    for (const product of res.body.products) {
      expect(product).toHaveProperty('id');
      expect(typeof product.id).toBe('string');
      expect(product).toHaveProperty('name');
      expect(typeof product.name).toBe('string');
      expect(product).toHaveProperty('contributors');
      expect(Array.isArray(product.contributors)).toBe(true);
    }
  });

  it('should have numeric fields in totals', async () => {
    const res = await api.get('/api/contributors/overview', { auth: mfgToken });
    expect(res.status).toBe(200);

    const { totals } = res.body;
    expect(typeof totals.totalContributors).toBe('number');
    expect(typeof totals.totalContributions).toBe('number');
    expect(typeof totals.productsWithRepos).toBe('number');
    expect(typeof totals.totalProducts).toBe('number');
    expect(totals.totalContributors).toBeGreaterThanOrEqual(0);
    expect(totals.totalContributions).toBeGreaterThanOrEqual(0);
    expect(totals.productsWithRepos).toBeGreaterThanOrEqual(0);
    expect(totals.totalProducts).toBeGreaterThanOrEqual(0);
  });

  // ─── Cross-org Isolation ─────────────────────────────────────────────

  it('should not leak manufacturer products to importer org', async () => {
    const res = await api.get('/api/contributors/overview', { auth: impToken });
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
    const res = await api.get('/api/contributors/overview', { auth: emptyToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('products');
    expect(res.body.products).toHaveLength(0);
  });
});

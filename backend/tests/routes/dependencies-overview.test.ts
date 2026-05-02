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
 * Dependencies Overview Route Tests — GET /api/dependencies/overview
 *
 * Tests: response shape (products, totals, licenseRisk), numeric fields,
 *        cross-org isolation, empty org handling
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('GET /api/dependencies/overview', () => {
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
    const res = await api.get('/api/dependencies/overview');
    expect(res.status).toBe(401);
  });

  // ─── Response Shape ──────────────────────────────────────────────────

  it('should return 200 with expected top-level shape (products, totals, licenseRisk)', async () => {
    const res = await api.get('/api/dependencies/overview', { auth: mfgToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('products');
    expect(Array.isArray(res.body.products)).toBe(true);
    expect(res.body).toHaveProperty('totals');
    expect(res.body).toHaveProperty('licenseRisk');
  });

  it('should include id, name, and dependencies array on each product entry', async () => {
    const res = await api.get('/api/dependencies/overview', { auth: mfgToken });
    expect(res.status).toBe(200);

    for (const product of res.body.products) {
      expect(product).toHaveProperty('id');
      expect(typeof product.id).toBe('string');
      expect(product).toHaveProperty('name');
      expect(typeof product.name).toBe('string');
      expect(product).toHaveProperty('dependencies');
      expect(Array.isArray(product.dependencies)).toBe(true);
    }
  });

  it('should have numeric fields in totals', async () => {
    const res = await api.get('/api/dependencies/overview', { auth: mfgToken });
    expect(res.status).toBe(200);

    const { totals } = res.body;
    expect(typeof totals.totalDependencies).toBe('number');
    expect(typeof totals.totalPackages).toBe('number');
    expect(typeof totals.ecosystemCount).toBe('number');
    expect(typeof totals.licenseCount).toBe('number');
    expect(typeof totals.staleSboms).toBe('number');
    expect(totals.totalDependencies).toBeGreaterThanOrEqual(0);
    expect(totals.totalPackages).toBeGreaterThanOrEqual(0);
    expect(totals.ecosystemCount).toBeGreaterThanOrEqual(0);
    expect(totals.licenseCount).toBeGreaterThanOrEqual(0);
    expect(totals.staleSboms).toBeGreaterThanOrEqual(0);
  });

  // ─── Cross-org Isolation ─────────────────────────────────────────────

  it('should not leak manufacturer products to importer org', async () => {
    const res = await api.get('/api/dependencies/overview', { auth: impToken });
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
    const res = await api.get('/api/dependencies/overview', { auth: emptyToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('products');
    expect(res.body.products).toHaveLength(0);
  });
});

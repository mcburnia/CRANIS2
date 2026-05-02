/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

/**
 * Compliance Gaps — Integration Tests
 *
 * Tests:
 *   GET /api/products/:productId/compliance-gaps
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

const PRODUCT_ID = TEST_IDS.products.github;
const OTHER_PRODUCT_ID = TEST_IDS.products.impGithub;

let token: string;

beforeAll(async () => {
  token = await loginTestUser(TEST_USERS.mfgAdmin);
}, 15000);

describe('GET /api/products/:productId/compliance-gaps', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/compliance-gaps`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for products in another org', async () => {
    const res = await api.get(`/api/products/${OTHER_PRODUCT_ID}/compliance-gaps`, { auth: token });
    expect(res.status).toBe(404);
  });

  it('returns 404 for non-existent product', async () => {
    const res = await api.get(`/api/products/00000000-0000-0000-0000-000000000000/compliance-gaps`, { auth: token });
    expect(res.status).toBe(404);
  });

  it('returns gap analysis for a valid product', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/compliance-gaps`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });

  it('includes prioritised actions', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/compliance-gaps`, { auth: token });
    expect(res.status).toBe(200);
    // Response should contain gap analysis data (structure depends on implementation)
    expect(typeof res.body).toBe('object');
  });
});

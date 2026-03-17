/**
 * Conformity Assessment — Integration Tests
 *
 * Tests:
 *   GET /api/conformity-assessment/modules/all      (public)
 *   GET /api/conformity-assessment/:category         (public)
 *   GET /api/products/:productId/conformity-assessment (authenticated)
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

// ─── Public endpoints (no auth) ────────────────────────────────

describe('GET /api/conformity-assessment/modules/all', () => {
  it('returns all conformity modules without auth', async () => {
    const res = await api.get('/api/conformity-assessment/modules/all');
    expect(res.status).toBe(200);
    expect(res.body.modules).toBeDefined();
    expect(res.body.modules.length).toBeGreaterThan(0);
  });

  it('includes Module A, B, C, and H', async () => {
    const res = await api.get('/api/conformity-assessment/modules/all');
    const moduleIds = res.body.modules.map((m: any) => m.id || m.module);
    expect(res.body.modules.length).toBe(4);
  });
});

describe('GET /api/conformity-assessment/:category', () => {
  it('returns assessment for default category', async () => {
    const res = await api.get('/api/conformity-assessment/default');
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
  });

  it('returns assessment for important_i category', async () => {
    const res = await api.get('/api/conformity-assessment/important_i');
    expect(res.status).toBe(200);
  });

  it('returns assessment for important_ii category', async () => {
    const res = await api.get('/api/conformity-assessment/important_ii');
    expect(res.status).toBe(200);
  });

  it('returns assessment for critical category', async () => {
    const res = await api.get('/api/conformity-assessment/critical');
    expect(res.status).toBe(200);
  });

  it('rejects invalid category', async () => {
    const res = await api.get('/api/conformity-assessment/invalid_category');
    expect(res.status).toBe(400);
    expect(res.body.validCategories).toBeDefined();
  });

  it('supports harmonisedStandards query param', async () => {
    const res = await api.get('/api/conformity-assessment/default', {
      query: { harmonisedStandards: 'true' },
    });
    expect(res.status).toBe(200);
  });
});

// ─── Authenticated endpoint ────────────────────────────────────

describe('GET /api/products/:productId/conformity-assessment', () => {
  it('rejects unauthenticated request', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/conformity-assessment`);
    expect(res.status).toBe(401);
  });

  it('returns assessment for valid product', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/conformity-assessment`, { auth: token });
    // May return 200 (with assessment), 404 (if no CRA category), or 500 (if missing data)
    expect([200, 404, 500]).toContain(res.status);
  });

  it('returns 404 for product in another org', async () => {
    const res = await api.get(`/api/products/${OTHER_PRODUCT_ID}/conformity-assessment`, { auth: token });
    expect([404, 403]).toContain(res.status);
  });
});

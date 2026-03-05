/**
 * Product Activity Route Tests — /api/products/:productId/activity
 *
 * Tests: authentication, cross-org isolation, response shape, pagination,
 * filter query params, non-existent product handling
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

const PRODUCT_ID = TEST_IDS.products.github;         // belongs to mfgActive org
const IMP_PRODUCT_ID = TEST_IDS.products.impGithub;  // belongs to impTrial org

describe('/api/products/:productId/activity', () => {
  let mfgToken: string;
  let impToken: string;

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
  });

  // ═══════════════════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════════════════

  it('should reject unauthenticated request', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/activity`);
    expect(res.status).toBe(401);
  });

  // ═══════════════════════════════════════════════════════
  // CROSS-ORG ISOLATION
  // ═══════════════════════════════════════════════════════

  it('should return 404 for product belonging to another org', async () => {
    // impAdmin tries to access mfgActive's product
    const res = await api.get(`/api/products/${PRODUCT_ID}/activity`, { auth: impToken });
    expect(res.status).toBe(404);
  });

  // ═══════════════════════════════════════════════════════
  // RESPONSE SHAPE
  // ═══════════════════════════════════════════════════════

  it('should return 200 with expected shape', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/activity`, { auth: mfgToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('activities');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('limit');
    expect(res.body).toHaveProperty('offset');
    expect(res.body).toHaveProperty('filters');
  });

  it('activities should be an array', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/activity`, { auth: mfgToken });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.activities)).toBe(true);
  });

  it('should include filters object with actions and entityTypes arrays', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/activity`, { auth: mfgToken });
    expect(res.status).toBe(200);
    expect(res.body.filters).toHaveProperty('actions');
    expect(res.body.filters).toHaveProperty('entityTypes');
    expect(Array.isArray(res.body.filters.actions)).toBe(true);
    expect(Array.isArray(res.body.filters.entityTypes)).toBe(true);
  });

  // ═══════════════════════════════════════════════════════
  // PAGINATION
  // ═══════════════════════════════════════════════════════

  it('should reflect limit and offset in response', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/activity`, {
      auth: mfgToken,
      query: { limit: '10', offset: '5' },
    });
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(10);
    expect(res.body.offset).toBe(5);
  });

  // ═══════════════════════════════════════════════════════
  // NON-EXISTENT PRODUCT
  // ═══════════════════════════════════════════════════════

  it('should return 404 for non-existent product ID', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await api.get(`/api/products/${fakeId}/activity`, { auth: mfgToken });
    expect(res.status).toBe(404);
  });

  // ═══════════════════════════════════════════════════════
  // QUERY PARAM FILTERS
  // ═══════════════════════════════════════════════════════

  it('should accept action filter without error', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/activity`, {
      auth: mfgToken,
      query: { action: 'created' },
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.activities)).toBe(true);
  });

  it('should accept entity_type filter without error', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/activity`, {
      auth: mfgToken,
      query: { entity_type: 'product' },
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.activities)).toBe(true);
  });
});

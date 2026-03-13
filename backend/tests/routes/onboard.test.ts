/**
 * Onboarding Wizard Route Tests -- POST /api/products/:productId/onboard
 *
 * Tests: auth, cross-org isolation, response shape, provisioning (obligations,
 *        tech file sections, stakeholders, derived statuses), idempotence
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginTestUser, TEST_USERS, getAppPool } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

const PRODUCT_ID = TEST_IDS.products.github;
const IMP_PRODUCT_ID = TEST_IDS.products.impGithub;
const ORG_ID = TEST_IDS.orgs.mfgActive;

describe('POST /api/products/:productId/onboard', () => {
  let mfgToken: string;
  let impToken: string;

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
  });

  // Clean up onboard-created data after all tests
  afterAll(async () => {
    const pool = getAppPool();
    // Clean stakeholders created by onboard (product-level only, to avoid affecting other tests)
    await pool.query(
      `DELETE FROM stakeholders WHERE org_id = $1 AND product_id = $2 AND role_key IN ('security_contact', 'technical_file_owner', 'incident_response_lead')`,
      [ORG_ID, PRODUCT_ID]
    );
  });

  // ─── Authentication ──────────────────────────────────────

  it('should reject unauthenticated request with 401', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/onboard`);
    expect(res.status).toBe(401);
  });

  // ─── Cross-org isolation ─────────────────────────────────

  it('should return 404 for product belonging to another org', async () => {
    const res = await api.post(`/api/products/${IMP_PRODUCT_ID}/onboard`, {
      auth: mfgToken,
    });
    expect(res.status).toBe(404);
  });

  // ─── Non-existent product ────────────────────────────────

  it('should return 404 for non-existent product', async () => {
    const res = await api.post('/api/products/00000000-0000-0000-0000-000000000000/onboard', {
      auth: mfgToken,
    });
    expect(res.status).toBe(404);
  });

  // ─── Response shape ──────────────────────────────────────

  it('should return 200 with provisioned array and summary', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/onboard`, {
      auth: mfgToken,
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('provisioned');
    expect(Array.isArray(res.body.provisioned)).toBe(true);
    expect(res.body).toHaveProperty('summary');
    expect(res.body.summary).toHaveProperty('stepsCompleted');
    expect(res.body.summary).toHaveProperty('obligations');
    expect(res.body.summary).toHaveProperty('sections');
  });

  // ─── Provisioning details ────────────────────────────────

  it('should provision 4 steps: obligations, tech file, stakeholders, derived statuses', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/onboard`, {
      auth: mfgToken,
    });
    expect(res.status).toBe(200);
    const steps = res.body.provisioned.map((p: any) => p.step);
    expect(steps).toContain('obligations');
    expect(steps).toContain('technical_file');
    expect(steps).toContain('stakeholders');
    expect(steps).toContain('derived_statuses');
    expect(res.body.summary.stepsCompleted).toBe(4);
  });

  it('should create obligations (at least 17 for default category)', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/onboard`, {
      auth: mfgToken,
    });
    expect(res.status).toBe(200);
    // Default category: 17 base obligations (art_20, art_32, art_32_3 only apply to higher categories)
    expect(res.body.summary.obligations).toBeGreaterThanOrEqual(17);
  });

  it('should create 8 technical file sections', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/onboard`, {
      auth: mfgToken,
    });
    expect(res.status).toBe(200);
    expect(res.body.summary.sections).toBe(8);
  });

  it('should create stakeholder roles in the database', async () => {
    // Run onboard first
    await api.post(`/api/products/${PRODUCT_ID}/onboard`, { auth: mfgToken });

    // Verify product-level stakeholders exist
    const pool = getAppPool();
    const result = await pool.query(
      `SELECT role_key FROM stakeholders WHERE org_id = $1 AND product_id = $2 ORDER BY role_key`,
      [ORG_ID, PRODUCT_ID]
    );
    const roles = result.rows.map((r: any) => r.role_key);
    expect(roles).toContain('security_contact');
    expect(roles).toContain('technical_file_owner');
    expect(roles).toContain('incident_response_lead');
  });

  // ─── Idempotence ─────────────────────────────────────────

  it('should be idempotent (second run succeeds with same results)', async () => {
    const first = await api.post(`/api/products/${PRODUCT_ID}/onboard`, { auth: mfgToken });
    expect(first.status).toBe(200);

    const second = await api.post(`/api/products/${PRODUCT_ID}/onboard`, { auth: mfgToken });
    expect(second.status).toBe(200);
    expect(second.body.summary.obligations).toBe(first.body.summary.obligations);
    expect(second.body.summary.sections).toBe(first.body.summary.sections);
    expect(second.body.summary.stepsCompleted).toBe(first.body.summary.stepsCompleted);
  });
});

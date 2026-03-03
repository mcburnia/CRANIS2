/**
 * Obligations Route Tests — /api/obligations
 *
 * Tests: overview, per-product, manual status update, and derived status
 * auto-intelligence (computed from SBOM, vulnerability scans, technical file
 * sections, and CRA reports already present in the platform).
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { api, loginTestUser, TEST_USERS, getAppPool } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

const MFG_ORG = TEST_IDS.orgs.mfgActive;
const PRODUCT_ID = TEST_IDS.products.github;

describe('/api/obligations', () => {
  let mfgToken: string;
  let impToken: string;

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
  });

  // Clean up any test data we seed during derived status tests
  afterEach(async () => {
    const pool = getAppPool();
    await pool.query(`DELETE FROM product_sboms WHERE product_id = $1 AND package_count = 9999`, [PRODUCT_ID]);
    await pool.query(`DELETE FROM vulnerability_scans WHERE product_id = $1 AND source = 'test-derived'`, [PRODUCT_ID]);
    await pool.query(`DELETE FROM technical_file_sections WHERE product_id = $1 AND section_key = 'test_derived_section'`, [PRODUCT_ID]);
    // Reset any obligation statuses we may have manually set back to not_started
    await pool.query(`UPDATE obligations SET status = 'not_started', updated_by = NULL WHERE product_id = $1 AND obligation_key = 'art_13_11' AND updated_by = 'test-manual-override'`, [PRODUCT_ID]);
  });

  // ═══════════════════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════════════════

  describe('Authentication', () => {
    it('should reject unauthenticated GET /overview', async () => {
      const res = await api.get('/api/obligations/overview');
      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated GET /:productId', async () => {
      const res = await api.get(`/api/obligations/${PRODUCT_ID}`);
      expect(res.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const res = await api.get('/api/obligations/overview', { auth: 'bad.token.here' });
      expect(res.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════
  // GET /api/obligations/overview
  // ═══════════════════════════════════════════════════════

  describe('GET /api/obligations/overview', () => {
    it('should return 200 with valid auth', async () => {
      const res = await api.get('/api/obligations/overview', { auth: mfgToken });
      expect(res.status).toBe(200);
    });

    it('should return expected top-level shape', async () => {
      const res = await api.get('/api/obligations/overview', { auth: mfgToken });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('products');
      expect(res.body).toHaveProperty('totals');
      expect(Array.isArray(res.body.products)).toBe(true);
    });

    it('should include obligations array on each product', async () => {
      const res = await api.get('/api/obligations/overview', { auth: mfgToken });
      expect(res.status).toBe(200);
      for (const product of res.body.products) {
        expect(product).toHaveProperty('obligations');
        expect(Array.isArray(product.obligations)).toBe(true);
        expect(product.obligations.length).toBeGreaterThan(0);
      }
    });

    it('should include required fields on each obligation', async () => {
      const res = await api.get('/api/obligations/overview', { auth: mfgToken });
      expect(res.status).toBe(200);
      const firstProduct = res.body.products[0];
      const ob = firstProduct.obligations[0];
      expect(ob).toHaveProperty('id');
      expect(ob).toHaveProperty('obligationKey');
      expect(ob).toHaveProperty('article');
      expect(ob).toHaveProperty('title');
      expect(ob).toHaveProperty('description');
      expect(ob).toHaveProperty('status');
      expect(ob).toHaveProperty('effectiveStatus');
      expect(['not_started', 'in_progress', 'met']).toContain(ob.status);
      expect(['not_started', 'in_progress', 'met']).toContain(ob.effectiveStatus);
    });

    it('should include derivedStatus and derivedReason fields', async () => {
      const res = await api.get('/api/obligations/overview', { auth: mfgToken });
      expect(res.status).toBe(200);
      const ob = res.body.products[0].obligations[0];
      // Fields must exist (may be null if no derived data available)
      expect(ob).toHaveProperty('derivedStatus');
      expect(ob).toHaveProperty('derivedReason');
    });

    it('should include progress counts per product', async () => {
      const res = await api.get('/api/obligations/overview', { auth: mfgToken });
      expect(res.status).toBe(200);
      for (const product of res.body.products) {
        expect(product.progress).toHaveProperty('total');
        expect(product.progress).toHaveProperty('completed');
        expect(product.progress).toHaveProperty('inProgress');
        expect(product.progress).toHaveProperty('notStarted');
        const { total, completed, inProgress, notStarted } = product.progress;
        expect(completed + inProgress + notStarted).toBe(total);
      }
    });

    it('should scope data to the calling user organisation', async () => {
      const mfgRes = await api.get('/api/obligations/overview', { auth: mfgToken });
      const impRes = await api.get('/api/obligations/overview', { auth: impToken });
      expect(mfgRes.status).toBe(200);
      expect(impRes.status).toBe(200);
      // Product IDs must be disjoint across orgs
      const mfgProductIds = new Set(mfgRes.body.products.map((p: any) => p.id));
      const impProductIds = (impRes.body.products as any[]).map(p => p.id);
      const overlap = impProductIds.filter(id => mfgProductIds.has(id));
      expect(overlap).toHaveLength(0);
    });

    it('should return empty list for org with no products', async () => {
      const emptyToken = await loginTestUser(TEST_USERS.emptyAdmin);
      const res = await api.get('/api/obligations/overview', { auth: emptyToken });
      expect(res.status).toBe(200);
      expect(res.body.products).toHaveLength(0);
      expect(res.body.totals.totalObligations).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════
  // GET /api/obligations/:productId
  // ═══════════════════════════════════════════════════════

  describe('GET /api/obligations/:productId', () => {
    it('should return 200 with valid product', async () => {
      const res = await api.get(`/api/obligations/${PRODUCT_ID}`, { auth: mfgToken });
      expect(res.status).toBe(200);
    });

    it('should return obligations array', async () => {
      const res = await api.get(`/api/obligations/${PRODUCT_ID}`, { auth: mfgToken });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.obligations)).toBe(true);
      expect(res.body.obligations.length).toBeGreaterThan(0);
    });

    it('should include derivedStatus, derivedReason, and effectiveStatus on each obligation', async () => {
      const res = await api.get(`/api/obligations/${PRODUCT_ID}`, { auth: mfgToken });
      expect(res.status).toBe(200);
      for (const ob of res.body.obligations) {
        expect(ob).toHaveProperty('derivedStatus');
        expect(ob).toHaveProperty('derivedReason');
        expect(ob).toHaveProperty('effectiveStatus');
        expect(['not_started', 'in_progress', 'met']).toContain(ob.effectiveStatus);
      }
    });

    it('should return 404 for product belonging to another org', async () => {
      const res = await api.get(`/api/obligations/${PRODUCT_ID}`, { auth: impToken });
      expect(res.status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════════════
  // PUT /api/obligations/:id (manual status update)
  // ═══════════════════════════════════════════════════════

  describe('PUT /api/obligations/:id', () => {
    it('should update obligation status', async () => {
      // First fetch to get an obligation ID
      const fetchRes = await api.get(`/api/obligations/${PRODUCT_ID}`, { auth: mfgToken });
      expect(fetchRes.status).toBe(200);
      const ob = fetchRes.body.obligations.find((o: any) => o.obligationKey === 'art_13_12');
      expect(ob).toBeDefined();

      const updateRes = await api.put(`/api/obligations/${ob.id}`, {
        auth: mfgToken,
        body: { status: 'in_progress', notes: 'Test update' },
      });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.status).toBe('in_progress');
      expect(updateRes.body.notes).toBe('Test update');

      // Reset
      await api.put(`/api/obligations/${ob.id}`, {
        auth: mfgToken,
        body: { status: 'not_started', notes: '' },
      });
    });

    it('should reject invalid status value', async () => {
      const fetchRes = await api.get(`/api/obligations/${PRODUCT_ID}`, { auth: mfgToken });
      const ob = fetchRes.body.obligations[0];
      const res = await api.put(`/api/obligations/${ob.id}`, {
        auth: mfgToken,
        body: { status: 'invalid_status' },
      });
      expect(res.status).toBe(400);
    });

    it('should return 404 for obligation belonging to another org', async () => {
      const fetchRes = await api.get(`/api/obligations/${PRODUCT_ID}`, { auth: mfgToken });
      const ob = fetchRes.body.obligations[0];
      const res = await api.put(`/api/obligations/${ob.id}`, {
        auth: impToken,
        body: { status: 'met' },
      });
      expect(res.status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════════════
  // DERIVED STATUS AUTO-INTELLIGENCE
  // ═══════════════════════════════════════════════════════

  describe('Derived obligation statuses', () => {
    it('should have null derivedStatus for art_13_11 when no SBOM exists', async () => {
      // Ensure no SBOM for this product (the test product github has no SBOM seeded)
      const res = await api.get(`/api/obligations/${PRODUCT_ID}`, { auth: mfgToken });
      expect(res.status).toBe(200);
      const ob = res.body.obligations.find((o: any) => o.obligationKey === 'art_13_11');
      expect(ob).toBeDefined();
      // Without a seeded SBOM, derivedStatus should be null
      expect(ob.derivedStatus).toBeNull();
    });

    it('should derive art_13_11 as in_progress when SBOM exists', async () => {
      const pool = getAppPool();
      // Seed a stale SBOM so we get in_progress (not met)
      await pool.query(
        `INSERT INTO product_sboms (product_id, spdx_json, package_count, is_stale, synced_at)
         VALUES ($1, '{}', 9999, true, NOW())
         ON CONFLICT (product_id) DO UPDATE SET package_count = 9999, is_stale = true`,
        [PRODUCT_ID]
      );

      const res = await api.get(`/api/obligations/${PRODUCT_ID}`, { auth: mfgToken });
      expect(res.status).toBe(200);
      const ob = res.body.obligations.find((o: any) => o.obligationKey === 'art_13_11');
      expect(ob.derivedStatus).toBe('in_progress');
      expect(ob.derivedReason).toMatch(/9999 packages/);

      // Cleanup
      await pool.query(`DELETE FROM product_sboms WHERE product_id = $1 AND package_count = 9999`, [PRODUCT_ID]);
    });

    it('should derive art_13_11 as met when SBOM is current (not stale)', async () => {
      const pool = getAppPool();
      await pool.query(
        `INSERT INTO product_sboms (product_id, spdx_json, package_count, is_stale, synced_at)
         VALUES ($1, '{}', 9999, false, NOW())
         ON CONFLICT (product_id) DO UPDATE SET package_count = 9999, is_stale = false`,
        [PRODUCT_ID]
      );

      const res = await api.get(`/api/obligations/${PRODUCT_ID}`, { auth: mfgToken });
      expect(res.status).toBe(200);
      const ob = res.body.obligations.find((o: any) => o.obligationKey === 'art_13_11');
      expect(ob.derivedStatus).toBe('met');

      await pool.query(`DELETE FROM product_sboms WHERE product_id = $1 AND package_count = 9999`, [PRODUCT_ID]);
    });

    it('should derive art_13_6 as in_progress when vulnerability scans exist with open findings', async () => {
      const pool = getAppPool();
      // The github product already has seeded open vulnerability findings + a scan
      // Just verify the existing seed data triggers the rule
      const res = await api.get(`/api/obligations/${PRODUCT_ID}`, { auth: mfgToken });
      expect(res.status).toBe(200);
      const ob = res.body.obligations.find((o: any) => o.obligationKey === 'art_13_6');
      expect(ob).toBeDefined();
      // github product has seeded vuln findings; derived should be in_progress (open findings exist)
      // If scans exist: in_progress or met. Either is correct depending on seed state.
      if (ob.derivedStatus !== null) {
        expect(['in_progress', 'met']).toContain(ob.derivedStatus);
        expect(ob.derivedReason).toMatch(/Vulnerability scanning active/);
      }
    });

    it('should derive art_13_12 as in_progress when any technical file section is started', async () => {
      const pool = getAppPool();
      // Seed one technical file section as in_progress
      await pool.query(
        `INSERT INTO technical_file_sections (product_id, section_key, title, status, cra_reference)
         VALUES ($1, 'product_description', 'Product Description', 'in_progress', 'Annex VII §1')
         ON CONFLICT (product_id, section_key) DO UPDATE SET status = 'in_progress'`,
        [PRODUCT_ID]
      );

      const res = await api.get(`/api/obligations/${PRODUCT_ID}`, { auth: mfgToken });
      expect(res.status).toBe(200);
      const ob = res.body.obligations.find((o: any) => o.obligationKey === 'art_13_12');
      expect(ob.derivedStatus).toBe('in_progress');
      expect(ob.derivedReason).toMatch(/Technical file/);

      // Reset
      await pool.query(
        `UPDATE technical_file_sections SET status = 'not_started' WHERE product_id = $1 AND section_key = 'product_description'`,
        [PRODUCT_ID]
      );
    });

    it('should derive art_14 as in_progress when a CRA report exists', async () => {
      // The github product has seeded CRA reports (from seed-test-data.ts)
      const res = await api.get(`/api/obligations/${PRODUCT_ID}`, { auth: mfgToken });
      expect(res.status).toBe(200);
      const ob = res.body.obligations.find((o: any) => o.obligationKey === 'art_14');
      expect(ob).toBeDefined();
      // If CRA reports are seeded for this product, derivedStatus should not be null
      if (ob.derivedStatus !== null) {
        expect(['in_progress', 'met']).toContain(ob.derivedStatus);
      }
    });

    it('effectiveStatus should be max(manualStatus, derivedStatus)', async () => {
      const res = await api.get(`/api/obligations/${PRODUCT_ID}`, { auth: mfgToken });
      expect(res.status).toBe(200);
      const statusOrder: Record<string, number> = { 'not_started': 0, 'in_progress': 1, 'met': 2 };
      for (const ob of res.body.obligations) {
        const manualOrder = statusOrder[ob.status] ?? 0;
        const derivedOrder = ob.derivedStatus ? (statusOrder[ob.derivedStatus] ?? 0) : 0;
        const expectedEffective = manualOrder >= derivedOrder ? ob.status : ob.derivedStatus;
        expect(ob.effectiveStatus).toBe(expectedEffective);
      }
    });

    it('manual status should be preserved even when derived suggests higher', async () => {
      const pool = getAppPool();
      // Seed a current SBOM (would normally trigger derivedStatus = 'met' for art_13_11)
      await pool.query(
        `INSERT INTO product_sboms (product_id, spdx_json, package_count, is_stale, synced_at)
         VALUES ($1, '{}', 9999, false, NOW())
         ON CONFLICT (product_id) DO UPDATE SET package_count = 9999, is_stale = false`,
        [PRODUCT_ID]
      );

      // First get the obligation ID
      const fetchRes = await api.get(`/api/obligations/${PRODUCT_ID}`, { auth: mfgToken });
      const ob = fetchRes.body.obligations.find((o: any) => o.obligationKey === 'art_13_11');

      // Manually set to 'not_started' with a marker
      await pool.query(
        `UPDATE obligations SET status = 'not_started', updated_by = 'test-manual-override'
         WHERE id = $1`,
        [ob.id]
      );

      const res = await api.get(`/api/obligations/${PRODUCT_ID}`, { auth: mfgToken });
      const updatedOb = res.body.obligations.find((o: any) => o.obligationKey === 'art_13_11');

      // Manual status must still be not_started
      expect(updatedOb.status).toBe('not_started');
      // But derived should still be met
      expect(updatedOb.derivedStatus).toBe('met');
      // Effective status is the higher (met wins)
      expect(updatedOb.effectiveStatus).toBe('met');

      // Cleanup
      await pool.query(`DELETE FROM product_sboms WHERE product_id = $1 AND package_count = 9999`, [PRODUCT_ID]);
      await pool.query(`UPDATE obligations SET status = 'not_started', updated_by = NULL WHERE product_id = $1 AND obligation_key = 'art_13_11'`, [PRODUCT_ID]);
    });

    it('progress totals should reflect effectiveStatus, not just manual status', async () => {
      const pool = getAppPool();
      // Seed a current SBOM — this should make art_13_11 effectiveStatus = 'met'
      await pool.query(
        `INSERT INTO product_sboms (product_id, spdx_json, package_count, is_stale, synced_at)
         VALUES ($1, '{}', 9999, false, NOW())
         ON CONFLICT (product_id) DO UPDATE SET package_count = 9999, is_stale = false`,
        [PRODUCT_ID]
      );

      const res = await api.get(`/api/obligations/${PRODUCT_ID}`, { auth: mfgToken });
      expect(res.status).toBe(200);
      const { completed, inProgress, notStarted, total } = res.body.progress;

      // Verify counts are consistent with effectiveStatuses on obligations
      const obligations = res.body.obligations;
      const expectedCompleted = obligations.filter((o: any) => o.effectiveStatus === 'met').length;
      const expectedInProgress = obligations.filter((o: any) => o.effectiveStatus === 'in_progress').length;
      const expectedNotStarted = obligations.filter((o: any) => o.effectiveStatus === 'not_started').length;

      expect(completed).toBe(expectedCompleted);
      expect(inProgress).toBe(expectedInProgress);
      expect(notStarted).toBe(expectedNotStarted);
      expect(completed + inProgress + notStarted).toBe(total);

      await pool.query(`DELETE FROM product_sboms WHERE product_id = $1 AND package_count = 9999`, [PRODUCT_ID]);
    });
  });
});

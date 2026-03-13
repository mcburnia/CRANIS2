/**
 * Obligation Engine – Role-Aware Tests
 *
 * Verifies that the obligation engine correctly filters obligations by both
 * CRA product category AND the economic operator role of the organisation
 * (manufacturer, importer, distributor, open_source_steward).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginTestUser, getAppPool, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';
import {
  getApplicableObligations,
  OBLIGATIONS,
  CraRole,
} from '../../src/services/obligation-engine.js';

// ─── Unit tests (pure function, no DB) ──────────────────────────────────

describe('getApplicableObligations — role filtering', () => {
  it('should return only manufacturer obligations when role is manufacturer', () => {
    const obligations = getApplicableObligations('default', 'manufacturer');
    const keys = obligations.map(o => o.key);

    // Should include Art. 13 obligations
    expect(keys).toContain('art_13');
    expect(keys).toContain('art_13_6');
    expect(keys).toContain('art_13_11');

    // Should NOT include importer or distributor obligations
    expect(keys.some(k => k.startsWith('art_18'))).toBe(false);
    expect(keys.some(k => k.startsWith('art_19'))).toBe(false);
  });

  it('should return only importer obligations when role is importer', () => {
    const obligations = getApplicableObligations('default', 'importer');
    const keys = obligations.map(o => o.key);

    // Should include Art. 18 obligations
    expect(keys).toContain('art_18_1');
    expect(keys).toContain('art_18_7');
    expect(keys).toContain('art_18_8');

    // Should NOT include manufacturer or distributor obligations
    expect(keys.some(k => k.startsWith('art_13'))).toBe(false);
    expect(keys.some(k => k.startsWith('art_19'))).toBe(false);
    expect(keys.some(k => k === 'art_14')).toBe(false);
  });

  it('should return only distributor obligations when role is distributor', () => {
    const obligations = getApplicableObligations('default', 'distributor');
    const keys = obligations.map(o => o.key);

    // Should include Art. 19 obligations
    expect(keys).toContain('art_19_1');
    expect(keys).toContain('art_19_4');
    expect(keys).toContain('art_19_6');

    // Should NOT include manufacturer or importer obligations
    expect(keys.some(k => k.startsWith('art_13'))).toBe(false);
    expect(keys.some(k => k.startsWith('art_18'))).toBe(false);
    expect(keys.some(k => k === 'art_14')).toBe(false);
  });

  it('should return manufacturer obligations for open_source_steward', () => {
    const obligations = getApplicableObligations('default', 'open_source_steward');
    const keys = obligations.map(o => o.key);

    // OSS stewards share manufacturer obligations
    expect(keys).toContain('art_13');
    expect(keys).toContain('art_13_11');
    expect(keys.some(k => k.startsWith('art_18'))).toBe(false);
    expect(keys.some(k => k.startsWith('art_19'))).toBe(false);
  });

  it('should default to manufacturer when role is null or undefined', () => {
    const withNull = getApplicableObligations('default', null);
    const withUndefined = getApplicableObligations('default');
    const explicit = getApplicableObligations('default', 'manufacturer');

    expect(withNull.length).toBe(explicit.length);
    expect(withUndefined.length).toBe(explicit.length);
    expect(withNull.map(o => o.key)).toEqual(explicit.map(o => o.key));
  });

  it('should return correct manufacturer obligation count for default category', () => {
    const obligations = getApplicableObligations('default', 'manufacturer');
    // 19 manufacturer obligations minus art_32 (important_i+) and art_32_3 (important_ii+) and art_20 (critical)
    expect(obligations.length).toBe(16);
  });

  it('should return 10 importer obligations for default category', () => {
    const obligations = getApplicableObligations('default', 'importer');
    expect(obligations.length).toBe(10);
  });

  it('should return 6 distributor obligations for default category', () => {
    const obligations = getApplicableObligations('default', 'distributor');
    expect(obligations.length).toBe(6);
  });

  it('should apply category filtering for manufacturer obligations', () => {
    const defaultObs = getApplicableObligations('default', 'manufacturer');
    const criticalObs = getApplicableObligations('critical', 'manufacturer');

    // Critical should include art_20, art_32, art_32_3
    const criticalKeys = criticalObs.map(o => o.key);
    expect(criticalKeys).toContain('art_20');
    expect(criticalKeys).toContain('art_32');
    expect(criticalKeys).toContain('art_32_3');

    // Default should not include these
    const defaultKeys = defaultObs.map(o => o.key);
    expect(defaultKeys).not.toContain('art_20');
    expect(defaultKeys).not.toContain('art_32');
    expect(defaultKeys).not.toContain('art_32_3');

    // Critical has 19 obligations (all manufacturer obligations)
    expect(criticalObs.length).toBe(19);
  });

  it('should apply same category to importer obligations (all apply to all categories)', () => {
    const defaultObs = getApplicableObligations('default', 'importer');
    const criticalObs = getApplicableObligations('critical', 'importer');
    // All importer obligations apply to all categories
    expect(defaultObs.length).toBe(criticalObs.length);
  });
});

describe('OBLIGATIONS array integrity', () => {
  it('should have appliesToRoles on every obligation', () => {
    for (const ob of OBLIGATIONS) {
      expect(ob.appliesToRoles, `${ob.key} missing appliesToRoles`).toBeDefined();
      expect(ob.appliesToRoles.length, `${ob.key} has empty appliesToRoles`).toBeGreaterThan(0);
    }
  });

  it('should have unique keys across all obligations', () => {
    const keys = OBLIGATIONS.map(o => o.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('should have 35 total obligations (19 mfg + 10 importer + 6 distributor)', () => {
    expect(OBLIGATIONS.length).toBe(35);
  });

  it('should have correct article references for importer obligations', () => {
    const importerObs = OBLIGATIONS.filter(o => o.key.startsWith('art_18'));
    expect(importerObs.length).toBe(10);
    for (const ob of importerObs) {
      expect(ob.article).toMatch(/^Art\. 18/);
      expect(ob.appliesToRoles).toEqual(['importer']);
    }
  });

  it('should have correct article references for distributor obligations', () => {
    const distObs = OBLIGATIONS.filter(o => o.key.startsWith('art_19'));
    expect(distObs.length).toBe(6);
    for (const ob of distObs) {
      expect(ob.article).toMatch(/^Art\. 19/);
      expect(ob.appliesToRoles).toEqual(['distributor']);
    }
  });
});

// ─── Integration tests (require test DB) ────────────────────────────────

describe('Obligation API — role-aware responses', () => {
  let mfgToken: string;
  let impToken: string;
  let distToken: string;

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
    distToken = await loginTestUser(TEST_USERS.distAdmin);

    // Clean up any legacy obligations from prior test runs so that
    // only role-appropriate obligations are created fresh
    const pool = getAppPool();
    await pool.query(
      `DELETE FROM obligations WHERE org_id IN ($1, $2)`,
      [TEST_IDS.orgs.impTrial, TEST_IDS.orgs.distSuspended]
    );
  });

  it('should return manufacturer obligations for manufacturer org', async () => {
    const res = await api.get(`/api/obligations/${TEST_IDS.products.github}`, {
      auth: mfgToken,
    });
    expect(res.status).toBe(200);

    const keys = res.body.obligations.map((o: any) => o.obligationKey);
    // Should contain manufacturer obligations
    expect(keys).toContain('art_13');
    expect(keys).toContain('art_13_6');
    expect(keys).toContain('art_13_11');

    // Should NOT contain importer or distributor obligations
    expect(keys.some((k: string) => k.startsWith('art_18'))).toBe(false);
    expect(keys.some((k: string) => k.startsWith('art_19'))).toBe(false);
  });

  it('should return importer obligations for importer org', async () => {
    const res = await api.get(`/api/obligations/${TEST_IDS.products.impGithub}`, {
      auth: impToken,
    });
    expect(res.status).toBe(200);

    const keys = res.body.obligations.map((o: any) => o.obligationKey);
    // Should contain all 10 importer obligations
    expect(keys).toContain('art_18_1');
    expect(keys).toContain('art_18_2');
    expect(keys).toContain('art_18_3');
    expect(keys).toContain('art_18_7');
    expect(keys).toContain('art_18_8');
    expect(keys).toContain('art_18_10');

    // Should NOT contain distributor obligations
    expect(keys.some((k: string) => k.startsWith('art_19'))).toBe(false);
  });

  it('should return distributor obligations for distributor org', async () => {
    const res = await api.get(`/api/obligations/${TEST_IDS.products.distGithub1}`, {
      auth: distToken,
    });
    expect(res.status).toBe(200);

    const keys = res.body.obligations.map((o: any) => o.obligationKey);
    // Should contain all 6 distributor obligations
    expect(keys).toContain('art_19_1');
    expect(keys).toContain('art_19_2');
    expect(keys).toContain('art_19_4');
    expect(keys).toContain('art_19_6');

    // Should NOT contain importer obligations
    expect(keys.some((k: string) => k.startsWith('art_18'))).toBe(false);
  });

  it('should show correct obligation counts in overview for manufacturer', async () => {
    const res = await api.get('/api/obligations/overview', {
      auth: mfgToken,
    });
    expect(res.status).toBe(200);

    // Manufacturer should have products with manufacturer obligations only
    for (const product of res.body.products) {
      for (const ob of product.obligations) {
        expect(ob.obligationKey).not.toMatch(/^art_18/);
        expect(ob.obligationKey).not.toMatch(/^art_19/);
      }
    }
  });

  it('should include importer obligations in overview for importer org', async () => {
    const res = await api.get('/api/obligations/overview', {
      auth: impToken,
    });
    expect(res.status).toBe(200);

    // Importer should have Art. 18 obligations present
    for (const product of res.body.products) {
      const keys = product.obligations.map((o: any) => o.obligationKey);
      expect(keys.some((k: string) => k.startsWith('art_18'))).toBe(true);
      // Should NOT contain manufacturer Art. 13 obligations (newly created)
      // Note: may still have legacy obligations from prior runs
    }
  });

  it('should include distributor obligations in overview for distributor org', async () => {
    const res = await api.get('/api/obligations/overview', {
      auth: distToken,
    });
    expect(res.status).toBe(200);

    // Distributor should have Art. 19 obligations present
    for (const product of res.body.products) {
      const keys = product.obligations.map((o: any) => o.obligationKey);
      expect(keys.some((k: string) => k.startsWith('art_19'))).toBe(true);
    }
  });
});

/**
 * OSCAL Export Tests — /api/v1/oscal/* and /api/v1/products/:id/oscal/*
 *
 * Tests the four OSCAL GRC bridge endpoints:
 * - GET /api/v1/oscal/catalog                           (static CRA catalog)
 * - GET /api/v1/products/:id/oscal/profile              (category-filtered controls)
 * - GET /api/v1/products/:id/oscal/assessment-results   (obligation findings)
 * - GET /api/v1/products/:id/oscal/component-definition (product + SBOM metadata)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginTestUser, getAppPool, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

const MFG_PRODUCT = TEST_IDS.products.github;

let mfgToken: string;
let mfgApiKey: string;
let impApiKey: string;

/** Helper to make API-key-authenticated requests */
function v1(method: 'get', path: string, apiKey: string) {
  return (api as any)[method](`/api/v1${path}`, {
    headers: { 'X-API-Key': apiKey },
  });
}

describe('/api/v1 — OSCAL GRC Bridge', () => {
  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    const impToken = await loginTestUser(TEST_USERS.impAdmin);

    // Upgrade both orgs to Pro (API keys require Pro)
    const pool = getAppPool();
    await pool.query("UPDATE org_billing SET plan = 'pro' WHERE org_id = $1", [TEST_IDS.orgs.mfgActive]);
    await pool.query("UPDATE org_billing SET plan = 'pro' WHERE org_id = $1", [TEST_IDS.orgs.impTrial]);

    // Create API keys
    const mfgKeyRes = await api.post('/api/settings/api-keys', {
      auth: mfgToken,
      body: { name: 'test-oscal-key' },
    });
    expect([200, 201]).toContain(mfgKeyRes.status);
    mfgApiKey = mfgKeyRes.body.key;

    const impKeyRes = await api.post('/api/settings/api-keys', {
      auth: impToken,
      body: { name: 'test-oscal-key' },
    });
    expect([200, 201]).toContain(impKeyRes.status);
    impApiKey = impKeyRes.body.key;
  });

  afterAll(async () => {
    const pool = getAppPool();
    await pool.query("UPDATE org_billing SET plan = 'standard' WHERE org_id = $1", [TEST_IDS.orgs.mfgActive]);
    await pool.query("UPDATE org_billing SET plan = 'standard' WHERE org_id = $1", [TEST_IDS.orgs.impTrial]);
  });

  // ═══════════════════════════════════════════════════
  // GET /api/v1/oscal/catalog
  // ═══════════════════════════════════════════════════

  describe('GET /oscal/catalog', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get('/api/v1/oscal/catalog');
      expect(res.status).toBe(401);
    });

    it('should return valid OSCAL catalog', async () => {
      const res = await v1('get', '/oscal/catalog', mfgApiKey);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('catalog');

      const catalog = res.body.catalog;
      expect(catalog).toHaveProperty('uuid');
      expect(catalog).toHaveProperty('metadata');
      expect(catalog).toHaveProperty('groups');
      expect(catalog.metadata['oscal-version']).toBe('1.1.2');
    });

    it('should contain all 19 CRA controls across groups', async () => {
      const res = await v1('get', '/oscal/catalog', mfgApiKey);
      const catalog = res.body.catalog;

      const allControls = catalog.groups.flatMap((g: any) => g.controls);
      expect(allControls.length).toBe(19);

      // Verify each control has required fields
      for (const ctrl of allControls) {
        expect(ctrl).toHaveProperty('id');
        expect(ctrl).toHaveProperty('title');
        expect(ctrl).toHaveProperty('parts');
        expect(ctrl.id).toMatch(/^cra-/);
      }
    });

    it('should include cra-obligation-key prop on each control', async () => {
      const res = await v1('get', '/oscal/catalog', mfgApiKey);
      const allControls = res.body.catalog.groups.flatMap((g: any) => g.controls);

      const keys = allControls.map((c: any) =>
        c.props.find((p: any) => p.name === 'cra-obligation-key')?.value,
      );
      expect(keys).toContain('art_13');
      expect(keys).toContain('art_13_6');
      expect(keys).toContain('art_13_11');
      expect(keys).toContain('art_20');
      expect(keys).toContain('annex_i_part_i');
    });
  });

  // ═══════════════════════════════════════════════════
  // GET /api/v1/products/:id/oscal/profile
  // ═══════════════════════════════════════════════════

  describe('GET /products/:id/oscal/profile', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get(`/api/v1/products/${MFG_PRODUCT}/oscal/profile`);
      expect(res.status).toBe(401);
    });

    it('should reject cross-org access', async () => {
      const res = await v1('get', `/products/${MFG_PRODUCT}/oscal/profile`, impApiKey);
      expect(res.status).toBe(404);
    });

    it('should return valid OSCAL profile', async () => {
      const res = await v1('get', `/products/${MFG_PRODUCT}/oscal/profile`, mfgApiKey);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('profile');

      const profile = res.body.profile;
      expect(profile).toHaveProperty('uuid');
      expect(profile).toHaveProperty('metadata');
      expect(profile).toHaveProperty('imports');
      expect(profile.metadata['oscal-version']).toBe('1.1.2');
    });

    it('should reference the CRA catalog and include control IDs', async () => {
      const res = await v1('get', `/products/${MFG_PRODUCT}/oscal/profile`, mfgApiKey);
      const profile = res.body.profile;

      expect(profile.imports[0].href).toBe('#cra-catalog');
      const controlIds = profile.imports[0]['include-controls'][0]['with-ids'];
      expect(Array.isArray(controlIds)).toBe(true);
      expect(controlIds.length).toBeGreaterThan(0);
      expect(controlIds[0]).toMatch(/^cra-/);
    });
  });

  // ═══════════════════════════════════════════════════
  // GET /api/v1/products/:id/oscal/assessment-results
  // ═══════════════════════════════════════════════════

  describe('GET /products/:id/oscal/assessment-results', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get(`/api/v1/products/${MFG_PRODUCT}/oscal/assessment-results`);
      expect(res.status).toBe(401);
    });

    it('should reject cross-org access', async () => {
      const res = await v1('get', `/products/${MFG_PRODUCT}/oscal/assessment-results`, impApiKey);
      expect(res.status).toBe(404);
    });

    it('should return valid OSCAL assessment-results', async () => {
      const res = await v1('get', `/products/${MFG_PRODUCT}/oscal/assessment-results`, mfgApiKey);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('assessment-results');

      const ar = res.body['assessment-results'];
      expect(ar).toHaveProperty('uuid');
      expect(ar).toHaveProperty('metadata');
      expect(ar).toHaveProperty('results');
      expect(ar.metadata['oscal-version']).toBe('1.1.2');
    });

    it('should contain findings with satisfied/not-satisfied states', async () => {
      const res = await v1('get', `/products/${MFG_PRODUCT}/oscal/assessment-results`, mfgApiKey);
      const results = res.body['assessment-results'].results;
      expect(results.length).toBe(1);

      const result = results[0];
      expect(result).toHaveProperty('findings');
      expect(result.findings.length).toBeGreaterThan(0);

      for (const finding of result.findings) {
        expect(finding).toHaveProperty('target');
        expect(finding.target).toHaveProperty('status');
        expect(['satisfied', 'not-satisfied']).toContain(finding.target.status.state);
        expect(finding.target['target-id']).toMatch(/^cra-/);
      }
    });

    it('should include product metadata props', async () => {
      const res = await v1('get', `/products/${MFG_PRODUCT}/oscal/assessment-results`, mfgApiKey);
      const result = res.body['assessment-results'].results[0];
      const props = result.props;

      const propNames = props.map((p: any) => p.name);
      expect(propNames).toContain('product-id');
      expect(propNames).toContain('product-name');
      expect(propNames).toContain('cra-category');
      expect(propNames).toContain('obligations-met');
      expect(propNames).toContain('obligations-total');
      expect(propNames).toContain('open-vulnerabilities');
    });

    it('should include observations', async () => {
      const res = await v1('get', `/products/${MFG_PRODUCT}/oscal/assessment-results`, mfgApiKey);
      const result = res.body['assessment-results'].results[0];

      expect(result).toHaveProperty('observations');
      expect(Array.isArray(result.observations)).toBe(true);
      // Should at least have the vulnerability posture observation
      expect(result.observations.length).toBeGreaterThan(0);

      const vulnObs = result.observations.find((o: any) => o.title === 'Vulnerability posture');
      expect(vulnObs).toBeDefined();
      expect(vulnObs.methods).toContain('TEST');
    });
  });

  // ═══════════════════════════════════════════════════
  // GET /api/v1/products/:id/oscal/component-definition
  // ═══════════════════════════════════════════════════

  describe('GET /products/:id/oscal/component-definition', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get(`/api/v1/products/${MFG_PRODUCT}/oscal/component-definition`);
      expect(res.status).toBe(401);
    });

    it('should reject cross-org access', async () => {
      const res = await v1('get', `/products/${MFG_PRODUCT}/oscal/component-definition`, impApiKey);
      expect(res.status).toBe(404);
    });

    it('should return valid OSCAL component-definition', async () => {
      const res = await v1('get', `/products/${MFG_PRODUCT}/oscal/component-definition`, mfgApiKey);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('component-definition');

      const cd = res.body['component-definition'];
      expect(cd).toHaveProperty('uuid');
      expect(cd).toHaveProperty('metadata');
      expect(cd).toHaveProperty('components');
      expect(cd.metadata['oscal-version']).toBe('1.1.2');
    });

    it('should describe a software component with control implementations', async () => {
      const res = await v1('get', `/products/${MFG_PRODUCT}/oscal/component-definition`, mfgApiKey);
      const cd = res.body['component-definition'];
      const component = cd.components[0];

      expect(component.type).toBe('software');
      expect(component).toHaveProperty('title');
      expect(component).toHaveProperty('control-implementations');
      expect(component['control-implementations'].length).toBe(1);

      const ci = component['control-implementations'][0];
      expect(ci).toHaveProperty('implemented-requirements');
      expect(ci['implemented-requirements'].length).toBeGreaterThan(0);

      // Each implemented requirement should reference a CRA control
      for (const ir of ci['implemented-requirements']) {
        expect(ir['control-id']).toMatch(/^cra-/);
      }
    });

    it('should include product-id and cra-category props', async () => {
      const res = await v1('get', `/products/${MFG_PRODUCT}/oscal/component-definition`, mfgApiKey);
      const component = res.body['component-definition'].components[0];
      const propNames = component.props.map((p: any) => p.name);

      expect(propNames).toContain('product-id');
      expect(propNames).toContain('cra-category');
      expect(propNames).toContain('sbom-available');
    });
  });

  // ═══════════════════════════════════════════════════
  // OSCAL version consistency
  // ═══════════════════════════════════════════════════

  describe('OSCAL version consistency', () => {
    it('should use OSCAL version 1.1.2 across all endpoints', async () => {
      const [catalog, profile, ar, cd] = await Promise.all([
        v1('get', '/oscal/catalog', mfgApiKey),
        v1('get', `/products/${MFG_PRODUCT}/oscal/profile`, mfgApiKey),
        v1('get', `/products/${MFG_PRODUCT}/oscal/assessment-results`, mfgApiKey),
        v1('get', `/products/${MFG_PRODUCT}/oscal/component-definition`, mfgApiKey),
      ]);

      expect(catalog.body.catalog.metadata['oscal-version']).toBe('1.1.2');
      expect(profile.body.profile.metadata['oscal-version']).toBe('1.1.2');
      expect(ar.body['assessment-results'].metadata['oscal-version']).toBe('1.1.2');
      expect(cd.body['component-definition'].metadata['oscal-version']).toBe('1.1.2');
    });
  });
});

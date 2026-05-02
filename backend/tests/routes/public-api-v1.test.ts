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
 * Public API v1 Tests — /api/v1
 *
 * Tests the API-key authenticated endpoints including the new
 * MCP-supporting endpoints: sync, scan status, and finding resolve.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginTestUser, getAppPool, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

const MFG_PRODUCT = TEST_IDS.products.github;
const IMP_PRODUCT = TEST_IDS.products.impGithub;

let mfgToken: string;
let mfgApiKey: string;
let impToken: string;
let impApiKey: string;

/** Helper to make API-key-authenticated requests */
function v1(method: 'get' | 'post' | 'put', path: string, apiKey: string, body?: any) {
  return (api as any)[method](`/api/v1${path}`, {
    headers: { 'X-API-Key': apiKey },
    ...(body ? { body } : {}),
  });
}

describe('/api/v1 — Public API', () => {
  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);

    // Upgrade both test orgs to Pro plan (API keys require Pro)
    const pool = getAppPool();
    await pool.query("UPDATE org_billing SET plan = 'pro' WHERE org_id = $1", [TEST_IDS.orgs.mfgActive]);
    await pool.query("UPDATE org_billing SET plan = 'pro' WHERE org_id = $1", [TEST_IDS.orgs.impTrial]);

    // Create API keys for both orgs
    const mfgKeyRes = await api.post('/api/settings/api-keys', {
      auth: mfgToken,
      body: { name: 'test-mcp-key' },
    });
    expect([200, 201]).toContain(mfgKeyRes.status);
    mfgApiKey = mfgKeyRes.body.key;

    const impKeyRes = await api.post('/api/settings/api-keys', {
      auth: impToken,
      body: { name: 'test-mcp-key' },
    });
    expect([200, 201]).toContain(impKeyRes.status);
    impApiKey = impKeyRes.body.key;
  });

  afterAll(async () => {
    // Restore billing plans to standard so other test files aren't affected
    const pool = getAppPool();
    await pool.query("UPDATE org_billing SET plan = 'standard' WHERE org_id = $1", [TEST_IDS.orgs.mfgActive]);
    await pool.query("UPDATE org_billing SET plan = 'standard' WHERE org_id = $1", [TEST_IDS.orgs.impTrial]);
  });

  // ═══════════════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════════════

  describe('Authentication', () => {
    it('should reject requests without API key', async () => {
      const res = await api.get('/api/v1/products');
      expect(res.status).toBe(401);
    });

    it('should reject invalid API key', async () => {
      const res = await v1('get', '/products', 'cranis2_invalidkey12345678901234567890');
      expect(res.status).toBe(401);
    });

    it('should accept valid API key', async () => {
      const res = await v1('get', '/products', mfgApiKey);
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════
  // GET /api/v1/products
  // ═══════════════════════════════════════════════════

  describe('GET /products', () => {
    it('should list products for the org', async () => {
      const res = await v1('get', '/products', mfgApiKey);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('products');
      expect(Array.isArray(res.body.products)).toBe(true);
      expect(res.body.products.length).toBeGreaterThan(0);
    });

    it('should return expected product shape', async () => {
      const res = await v1('get', '/products', mfgApiKey);
      const product = res.body.products[0];
      expect(product).toHaveProperty('id');
      expect(product).toHaveProperty('name');
      expect(product).toHaveProperty('craCategory');
      expect(product).toHaveProperty('status');
    });

    it('should isolate products per org', async () => {
      const mfgRes = await v1('get', '/products', mfgApiKey);
      const impRes = await v1('get', '/products', impApiKey);
      const mfgIds = mfgRes.body.products.map((p: any) => p.id);
      const impIds = impRes.body.products.map((p: any) => p.id);
      const overlap = mfgIds.filter((id: string) => impIds.includes(id));
      expect(overlap.length).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════
  // GET /api/v1/products/:id
  // ═══════════════════════════════════════════════════

  describe('GET /products/:id', () => {
    it('should return product detail', async () => {
      const res = await v1('get', `/products/${MFG_PRODUCT}`, mfgApiKey);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', MFG_PRODUCT);
      expect(res.body).toHaveProperty('name');
    });

    it('should reject cross-org product access', async () => {
      const res = await v1('get', `/products/${MFG_PRODUCT}`, impApiKey);
      expect(res.status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════════
  // GET /api/v1/products/:id/vulnerabilities
  // ═══════════════════════════════════════════════════

  describe('GET /products/:id/vulnerabilities', () => {
    it('should return vulnerability findings', async () => {
      const res = await v1('get', `/products/${MFG_PRODUCT}/vulnerabilities`, mfgApiKey);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('productId', MFG_PRODUCT);
      expect(res.body).toHaveProperty('findings');
      expect(Array.isArray(res.body.findings)).toBe(true);
      expect(res.body).toHaveProperty('total');
    });

    it('should reject cross-org vulnerability access', async () => {
      const res = await v1('get', `/products/${MFG_PRODUCT}/vulnerabilities`, impApiKey);
      expect(res.status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════════
  // GET /api/v1/products/:id/compliance-status
  // ═══════════════════════════════════════════════════

  describe('GET /products/:id/compliance-status', () => {
    it('should return compliance status with pass/fail', async () => {
      const res = await v1('get', `/products/${MFG_PRODUCT}/compliance-status`, mfgApiKey);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('pass');
      expect(res.body).toHaveProperty('threshold');
      expect(res.body).toHaveProperty('summary');
      expect(typeof res.body.pass).toBe('boolean');
    });

    it('should respect threshold parameter', async () => {
      const critical = await v1('get', `/products/${MFG_PRODUCT}/compliance-status?threshold=critical`, mfgApiKey);
      const low = await v1('get', `/products/${MFG_PRODUCT}/compliance-status?threshold=low`, mfgApiKey);
      expect(critical.status).toBe(200);
      expect(low.status).toBe(200);
      expect(critical.body.threshold).toBe('critical');
      expect(low.body.threshold).toBe('low');
    });
  });

  // ═══════════════════════════════════════════════════
  // POST /api/v1/products/:id/sync (MCP endpoint)
  // ═══════════════════════════════════════════════════

  describe('POST /products/:id/sync', () => {
    it('should reject cross-org sync', async () => {
      const res = await v1('post', `/products/${MFG_PRODUCT}/sync`, impApiKey);
      expect(res.status).toBe(404);
    });

    it('should accept valid API key with write:findings scope', async () => {
      // Default keys include write:findings — this should succeed or return
      // a legitimate error (not 401/403)
      const res = await v1('post', `/products/${MFG_PRODUCT}/sync`, mfgApiKey);
      // May succeed (200) or conflict (409) if scan running, or 500 if no repo connected
      // The important thing is it's NOT 401 or 403
      expect([200, 409, 500]).toContain(res.status);
    });
  });

  // ═══════════════════════════════════════════════════
  // GET /api/v1/products/:id/scans/:scanId
  // ═══════════════════════════════════════════════════

  describe('GET /products/:id/scans/:scanId', () => {
    it('should return 404 for non-existent scan', async () => {
      const res = await v1('get', `/products/${MFG_PRODUCT}/scans/00000000-0000-0000-0000-000000000000`, mfgApiKey);
      expect(res.status).toBe(404);
    });

    it('should reject cross-org scan access', async () => {
      const res = await v1('get', `/products/${MFG_PRODUCT}/scans/00000000-0000-0000-0000-000000000000`, impApiKey);
      expect(res.status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════════
  // PUT /api/v1/products/:id/findings/:fid/resolve
  // ═══════════════════════════════════════════════════

  describe('PUT /products/:id/findings/:findingId/resolve', () => {
    let testFindingId: string;

    beforeAll(async () => {
      // Insert a test finding directly into the DB
      const pool = getAppPool();
      const orgId = TEST_IDS.orgs.mfgActive;

      const insertResult = await pool.query(
        `INSERT INTO vulnerability_findings (org_id, product_id, source, source_id, severity, title, dependency_name, dependency_version, dependency_ecosystem, fixed_version, status)
         VALUES ($1, $2, 'osv', 'TEST-MCP-001', 'high', 'Test MCP vulnerability', 'test-pkg', '1.0.0', 'npm', '1.0.1', 'open')
         RETURNING id`,
        [orgId, MFG_PRODUCT],
      );
      testFindingId = insertResult.rows[0].id;
    });

    it('should resolve a finding with evidence', async () => {
      const res = await v1('put', `/products/${MFG_PRODUCT}/findings/${testFindingId}/resolve`, mfgApiKey, {
        evidence: {
          resolution: 'package_updated',
          packageName: 'test-pkg',
          previousVersion: '1.0.0',
          newVersion: '1.0.1',
          verifiedBy: 'mcp-ide-assistant',
        },
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Finding marked as resolved');
      expect(res.body).toHaveProperty('previousStatus', 'open');
    });

    it('should handle already-resolved finding gracefully', async () => {
      const res = await v1('put', `/products/${MFG_PRODUCT}/findings/${testFindingId}/resolve`, mfgApiKey, {
        evidence: {},
      });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('already resolved');
    });

    it('should reject cross-org finding resolve', async () => {
      const res = await v1('put', `/products/${MFG_PRODUCT}/findings/${testFindingId}/resolve`, impApiKey, {
        evidence: {},
      });
      expect(res.status).toBe(404);
    });

    it('should return 404 for non-existent finding', async () => {
      const res = await v1('put', `/products/${MFG_PRODUCT}/findings/00000000-0000-0000-0000-000000000000/resolve`, mfgApiKey, {
        evidence: {},
      });
      expect(res.status).toBe(404);
    });
  });
});

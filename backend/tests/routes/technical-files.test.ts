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
 * Technical Files Route Tests — /api/technical-files
 *
 * Tests: overview (products with sections), per-product detail (returns 404)
 *
 * API response format notes:
 * - GET /api/technical-files/overview returns { products: [...] }
 *   Each product has: id, name, craCategory, sections: [{ sectionKey, title, status, craReference, updatedAt }]
 * - GET /api/technical-files/:productId returns 404 (per-product detail uses a different pattern)
 * - GET /api/technical-file/:productId/suggestions returns { sections: { product_description, vulnerability_handling, standards_applied, test_reports } }
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { api, loginTestUser, TEST_USERS, getAppPool } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

const PRODUCT_ID = TEST_IDS.products.github;

describe('/api/technical-files', () => {
  let mfgToken: string;
  let impToken: string;

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
  });

  // ─── GET /api/technical-files/overview ────────────────────────────────

  describe('GET /api/technical-files/overview', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get('/api/technical-files/overview');
      expect(res.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const res = await api.get('/api/technical-files/overview', { auth: 'invalid.jwt.token' });
      expect(res.status).toBe(401);
    });

    it('should return products array for authenticated user', async () => {
      const res = await api.get('/api/technical-files/overview', { auth: mfgToken });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('products');
      expect(Array.isArray(res.body.products)).toBe(true);
    });

    it('should include product metadata on each product', async () => {
      const res = await api.get('/api/technical-files/overview', { auth: mfgToken });
      expect(res.status).toBe(200);

      expect(res.body.products.length).toBeGreaterThanOrEqual(1);
      const product = res.body.products[0];
      expect(product).toHaveProperty('id');
      expect(product).toHaveProperty('name');
      expect(product).toHaveProperty('craCategory');
    });

    it('should include sections array on each product', async () => {
      const res = await api.get('/api/technical-files/overview', { auth: mfgToken });
      expect(res.status).toBe(200);

      for (const product of res.body.products) {
        expect(product).toHaveProperty('sections');
        expect(Array.isArray(product.sections)).toBe(true);
      }
    });

    it('should have expected fields on each section', async () => {
      const res = await api.get('/api/technical-files/overview', { auth: mfgToken });
      expect(res.status).toBe(200);

      // Find a product with sections
      const productWithSections = res.body.products.find(
        (p: any) => p.sections && p.sections.length > 0
      );
      if (productWithSections) {
        const section = productWithSections.sections[0];
        expect(section).toHaveProperty('sectionKey');
        expect(section).toHaveProperty('title');
        expect(section).toHaveProperty('status');
        expect(section).toHaveProperty('craReference');
        expect(typeof section.sectionKey).toBe('string');
        expect(typeof section.title).toBe('string');
        expect(typeof section.status).toBe('string');
      }
    });

    it('should contain a known seeded product', async () => {
      const res = await api.get('/api/technical-files/overview', { auth: mfgToken });
      expect(res.status).toBe(200);

      const githubProduct = res.body.products.find(
        (p: any) => p.id === TEST_IDS.products.github
      );
      expect(githubProduct).toBeTruthy();
      expect(githubProduct.name).toBe('test-product-github');
    });

    it('should return empty products for org with no products', async () => {
      const emptyToken = await loginTestUser(TEST_USERS.emptyAdmin);
      const res = await api.get('/api/technical-files/overview', { auth: emptyToken });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('products');
      expect(res.body.products.length).toBe(0);
    });
  });

  // ─── GET /api/technical-files/:productId ──────────────────────────────

  describe('GET /api/technical-files/:productId', () => {
    it('should return 404 (per-product detail uses different pattern)', async () => {
      const res = await api.get(`/api/technical-files/${TEST_IDS.products.github}`, { auth: mfgToken });
      expect(res.status).toBe(404);
    });
  });

  // ─── Cross-org isolation ──────────────────────────────────────────────

  describe('Cross-org isolation', () => {
    it('should not leak manufacturer products in importer overview', async () => {
      const res = await api.get('/api/technical-files/overview', { auth: impToken });
      expect(res.status).toBe(200);

      const mfgProductIds = [
        TEST_IDS.products.github,
        TEST_IDS.products.codeberg,
        TEST_IDS.products.gitea,
        TEST_IDS.products.forgejo,
        TEST_IDS.products.gitlab,
      ];
      const foundCrossOrg = res.body.products.filter(
        (p: any) => mfgProductIds.includes(p.id)
      );
      expect(foundCrossOrg.length).toBe(0);
    });

    it('should only return products belonging to the authenticated org', async () => {
      const res = await api.get('/api/technical-files/overview', { auth: impToken });
      expect(res.status).toBe(200);

      // None of the manufacturer products should appear
      const mfgProductIds = [
        TEST_IDS.products.github,
        TEST_IDS.products.codeberg,
        TEST_IDS.products.gitea,
        TEST_IDS.products.forgejo,
        TEST_IDS.products.gitlab,
      ];
      for (const product of res.body.products) {
        expect(mfgProductIds).not.toContain(product.id);
      }
    });
  });
});

// ─── EU Declaration of Conformity Markdown endpoint ──────────────────────────

describe('/api/technical-file/:productId/declaration-of-conformity/pdf', () => {
  let mfgToken: string;
  let impToken: string;

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
  });

  it('should reject unauthenticated request', async () => {
    const res = await api.get(`/api/technical-file/${PRODUCT_ID}/declaration-of-conformity/pdf`);
    expect(res.status).toBe(401);
  });

  it('should return 404 for a product belonging to another org', async () => {
    const res = await api.get(`/api/technical-file/${PRODUCT_ID}/declaration-of-conformity/pdf`, { auth: impToken });
    expect(res.status).toBe(404);
  });

  it('should return 200 with Content-Type text/markdown', async () => {
    const res = await api.get(`/api/technical-file/${PRODUCT_ID}/declaration-of-conformity/pdf`, { auth: mfgToken });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/markdown/);
  });

  it('should return valid Markdown content', async () => {
    const res = await api.get(`/api/technical-file/${PRODUCT_ID}/declaration-of-conformity/pdf`, { auth: mfgToken });
    expect(res.status).toBe(200);
    const body = typeof res.body === 'string' ? res.body : Buffer.from(res.body as ArrayBuffer).toString('utf-8');
    expect(body).toContain('# ');
  });

  it('should include Content-Disposition attachment header', async () => {
    const res = await api.get(`/api/technical-file/${PRODUCT_ID}/declaration-of-conformity/pdf`, { auth: mfgToken });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toMatch(/attachment/);
    expect(res.headers.get('content-disposition')).toMatch(/\.md/);
  });
});

// ─── CVD Policy Markdown endpoint ─────────────────────────────────────────────

describe('/api/technical-file/:productId/cvd-policy/pdf', () => {
  let mfgToken: string;
  let impToken: string;

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
  });

  it('should reject unauthenticated request', async () => {
    const res = await api.get(`/api/technical-file/${PRODUCT_ID}/cvd-policy/pdf`);
    expect(res.status).toBe(401);
  });

  it('should return 404 for a product belonging to another org', async () => {
    const res = await api.get(`/api/technical-file/${PRODUCT_ID}/cvd-policy/pdf`, { auth: impToken });
    expect(res.status).toBe(404);
  });

  it('should return 200 with Content-Type text/markdown', async () => {
    const res = await api.get(`/api/technical-file/${PRODUCT_ID}/cvd-policy/pdf`, { auth: mfgToken });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/markdown/);
  });

  it('should return valid Markdown content', async () => {
    const res = await api.get(`/api/technical-file/${PRODUCT_ID}/cvd-policy/pdf`, { auth: mfgToken });
    expect(res.status).toBe(200);
    const body = typeof res.body === 'string' ? res.body : Buffer.from(res.body as ArrayBuffer).toString('utf-8');
    expect(body).toContain('# ');
  });

  it('should include Content-Disposition attachment header', async () => {
    const res = await api.get(`/api/technical-file/${PRODUCT_ID}/cvd-policy/pdf`, { auth: mfgToken });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toMatch(/attachment/);
    expect(res.headers.get('content-disposition')).toMatch(/cvd-policy/);
  });
});

// ─── Technical file auto-population suggestions endpoint ─────────────────────

describe('/api/technical-file/:productId/suggestions', () => {
  let mfgToken: string;
  let impToken: string;

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
  });

  afterEach(async () => {
    // Clean up any scans seeded during this suite
    const pool = getAppPool();
    await pool.query("DELETE FROM vulnerability_scans WHERE source = 'test-suggestions'");
  });

  it('should reject unauthenticated request', async () => {
    const res = await api.get(`/api/technical-file/${PRODUCT_ID}/suggestions`);
    expect(res.status).toBe(401);
  });

  it('should return 404 for a product belonging to another org', async () => {
    const res = await api.get(`/api/technical-file/${PRODUCT_ID}/suggestions`, { auth: impToken });
    expect(res.status).toBe(404);
  });

  it('should return 200 with a sections object', async () => {
    const res = await api.get(`/api/technical-file/${PRODUCT_ID}/suggestions`, { auth: mfgToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('sections');
    expect(typeof res.body.sections).toBe('object');
  });

  it('should include all four section keys', async () => {
    const res = await api.get(`/api/technical-file/${PRODUCT_ID}/suggestions`, { auth: mfgToken });
    expect(res.status).toBe(200);
    const sections = res.body.sections;
    expect(sections).toHaveProperty('product_description');
    expect(sections).toHaveProperty('vulnerability_handling');
    expect(sections).toHaveProperty('standards_applied');
    expect(sections).toHaveProperty('test_reports');
  });

  it('should include non-empty field suggestions for product_description', async () => {
    const res = await api.get(`/api/technical-file/${PRODUCT_ID}/suggestions`, { auth: mfgToken });
    expect(res.status).toBe(200);
    const fields = res.body.sections.product_description?.fields;
    expect(fields).toBeDefined();
    expect(typeof fields.intended_purpose).toBe('string');
    expect(fields.intended_purpose.length).toBeGreaterThan(0);
    expect(typeof fields.versions_affecting_compliance).toBe('string');
    expect(fields.versions_affecting_compliance.length).toBeGreaterThan(0);
  });

  it('should return only 2 standards for a default-category product', async () => {
    // github test product has craCategory = 'default' → only 2 base standards
    const res = await api.get(`/api/technical-file/${PRODUCT_ID}/suggestions`, { auth: mfgToken });
    expect(res.status).toBe(200);
    const standards = res.body.sections.standards_applied?.standards;
    expect(Array.isArray(standards)).toBe(true);
    expect(standards.length).toBe(2);
    expect(standards[0]).toHaveProperty('name');
    expect(standards[0]).toHaveProperty('reference');
  });

  it('should include at least one test report entry', async () => {
    const res = await api.get(`/api/technical-file/${PRODUCT_ID}/suggestions`, { auth: mfgToken });
    expect(res.status).toBe(200);
    const reports = res.body.sections.test_reports?.reports;
    expect(Array.isArray(reports)).toBe(true);
    expect(reports.length).toBeGreaterThanOrEqual(1);
    expect(reports[0]).toHaveProperty('type');
    expect(reports[0]).toHaveProperty('date');
    expect(reports[0]).toHaveProperty('summary');
  });

  it('should include scan details in test reports when a completed scan exists', async () => {
    // Seed a completed scan for the github product
    const pool = getAppPool();
    await pool.query(
      `INSERT INTO vulnerability_scans (product_id, org_id, status, started_at, completed_at, findings_count, source)
       VALUES ($1, $2, 'completed', NOW() - INTERVAL '1 hour', NOW(), 3, 'test-suggestions')`,
      [PRODUCT_ID, TEST_IDS.orgs.mfgActive]
    );

    const res = await api.get(`/api/technical-file/${PRODUCT_ID}/suggestions`, { auth: mfgToken });
    expect(res.status).toBe(200);
    const reports = res.body.sections.test_reports?.reports;
    expect(Array.isArray(reports)).toBe(true);

    // Should have the seeded scan as a report entry
    const scanReport = reports.find((r: any) => r.summary.includes('3 total finding'));
    expect(scanReport).toBeTruthy();
    expect(scanReport.type).toBe('Automated Vulnerability Scan');
  });
});

/**
 * Integration Test — Cross-Org Data Isolation
 *
 * End-to-end verification that data from one organisation
 * is never leaked to another, across all major endpoints.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('Integration: Cross-Org Data Isolation', () => {
  let mfgToken: string;
  let impToken: string;
  let emptyToken: string;

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
    emptyToken = await loginTestUser(TEST_USERS.emptyAdmin);
  });

  const mfgProductIds = [
    TEST_IDS.products.github,
    TEST_IDS.products.codeberg,
    TEST_IDS.products.gitea,
    TEST_IDS.products.forgejo,
    TEST_IDS.products.gitlab,
  ];

  const impProductIds = [
    TEST_IDS.products.impGithub,
    TEST_IDS.products.impCodeberg,
  ];

  // ─── Product isolation ──────────────────────────────────────────────

  describe('Product isolation', () => {
    it('importer cannot see manufacturer products in list', async () => {
      const res = await api.get('/api/products', { auth: impToken });
      expect(res.status).toBe(200);
      const products = res.body.products || res.body;
      for (const p of products) {
        expect(mfgProductIds).not.toContain(p.id);
      }
    });

    it('manufacturer cannot see importer products in list', async () => {
      const res = await api.get('/api/products', { auth: mfgToken });
      expect(res.status).toBe(200);
      const products = res.body.products || res.body;
      for (const p of products) {
        expect(impProductIds).not.toContain(p.id);
      }
    });

    it('importer cannot access manufacturer product by ID', async () => {
      const res = await api.get(`/api/products/${TEST_IDS.products.github}`, { auth: impToken });
      expect([403, 404]).toContain(res.status);
    });

    it('manufacturer cannot access importer product by ID', async () => {
      const res = await api.get(`/api/products/${TEST_IDS.products.impGithub}`, { auth: mfgToken });
      expect([403, 404]).toContain(res.status);
    });
  });

  // ─── CRA report isolation ──────────────────────────────────────────

  describe('CRA report isolation', () => {
    it('importer cannot see manufacturer CRA reports', async () => {
      const res = await api.get('/api/cra-reports', { auth: impToken });
      expect(res.status).toBe(200);
      const reports = res.body.reports || res.body;
      for (const r of reports) {
        expect(r.org_id || r.orgId).not.toBe(TEST_IDS.orgs.mfgActive);
      }
    });

    it('importer cannot access manufacturer report by ID', async () => {
      const res = await api.get(`/api/cra-reports/${TEST_IDS.reports.draft}`, { auth: impToken });
      expect([403, 404]).toContain(res.status);
    });
  });

  // ─── Vulnerability/risk finding isolation ───────────────────────────

  describe('Vulnerability data isolation', () => {
    it('importer overview should not contain manufacturer products', async () => {
      const res = await api.get('/api/risk-findings/overview', { auth: impToken });
      expect(res.status).toBe(200);
      const products = res.body.products || [];
      for (const p of products) {
        expect(mfgProductIds).not.toContain(p.id || p.productId);
      }
    });

    it('importer cannot access manufacturer product findings', async () => {
      const res = await api.get(`/api/risk-findings/${TEST_IDS.products.github}`, { auth: impToken });
      expect([200, 403, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.findings.length).toBe(0);
      }
    });
  });

  // ─── License scan isolation ─────────────────────────────────────────

  describe('License scan isolation', () => {
    it('importer overview should not contain manufacturer products', async () => {
      const res = await api.get('/api/license-scan/overview', { auth: impToken });
      expect(res.status).toBe(200);
      for (const p of res.body.products) {
        expect(mfgProductIds).not.toContain(p.id || p.productId);
      }
    });
  });

  // ─── SBOM export isolation ──────────────────────────────────────────

  describe('SBOM export isolation', () => {
    it('importer cannot access manufacturer SBOM status', async () => {
      const res = await api.get(`/api/sbom/${TEST_IDS.products.github}/export/status`, { auth: impToken });
      expect([403, 404]).toContain(res.status);
    });
  });

  // ─── Technical files isolation ──────────────────────────────────────

  describe('Technical files isolation', () => {
    it('importer overview should not contain manufacturer products', async () => {
      const res = await api.get('/api/technical-files/overview', { auth: impToken });
      expect(res.status).toBe(200);
      for (const p of res.body.products) {
        expect(mfgProductIds).not.toContain(p.id);
      }
    });
  });

  // ─── Notification isolation ─────────────────────────────────────────

  describe('Notification isolation', () => {
    it('each org only sees their own notifications', async () => {
      const mfgRes = await api.get('/api/notifications', { auth: mfgToken });
      const impRes = await api.get('/api/notifications', { auth: impToken });

      expect(mfgRes.status).toBe(200);
      expect(impRes.status).toBe(200);

      const mfgNotifs = mfgRes.body.notifications || [];
      const impNotifs = impRes.body.notifications || [];

      // No notification IDs should overlap (different orgs)
      const mfgIds = new Set(mfgNotifs.map((n: any) => n.id));
      for (const n of impNotifs) {
        expect(mfgIds.has(n.id)).toBe(false);
      }
    });
  });

  // ─── Org data isolation ─────────────────────────────────────────────

  describe('Org data isolation', () => {
    it('each user sees only their own org', async () => {
      const mfgRes = await api.get('/api/org', { auth: mfgToken });
      const impRes = await api.get('/api/org', { auth: impToken });

      expect(mfgRes.status).toBe(200);
      expect(impRes.status).toBe(200);

      expect(mfgRes.body.id).toBe(TEST_IDS.orgs.mfgActive);
      expect(impRes.body.id).toBe(TEST_IDS.orgs.impTrial);
      expect(mfgRes.body.id).not.toBe(impRes.body.id);
    });

    it('each user sees only their own org members', async () => {
      const mfgRes = await api.get('/api/org/members', { auth: mfgToken });
      const impRes = await api.get('/api/org/members', { auth: impToken });

      const mfgMembers = mfgRes.body.members || mfgRes.body;
      const impMembers = impRes.body.members || impRes.body;

      // No member email should appear in the other org's list
      const mfgEmails = new Set(mfgMembers.map((m: any) => m.email));
      for (const m of impMembers) {
        expect(mfgEmails.has(m.email)).toBe(false);
      }
    });
  });

  // ─── Due diligence isolation ────────────────────────────────────────

  describe('Due diligence isolation', () => {
    it('importer cannot preview manufacturer product due diligence', async () => {
      const res = await api.get(`/api/due-diligence/${TEST_IDS.products.github}/preview`, { auth: impToken });
      expect([403, 404]).toContain(res.status);
    });
  });

  // ─── Empty org sees nothing ─────────────────────────────────────────

  describe('Empty org isolation', () => {
    it('empty org sees zero products', async () => {
      const res = await api.get('/api/products', { auth: emptyToken });
      expect(res.status).toBe(200);
      const products = res.body.products || res.body;
      expect(products.length).toBe(0);
    });

    it('empty org sees zero CRA reports', async () => {
      const res = await api.get('/api/cra-reports', { auth: emptyToken });
      expect(res.status).toBe(200);
      const reports = res.body.reports || res.body;
      expect(reports.length).toBe(0);
    });
  });
});

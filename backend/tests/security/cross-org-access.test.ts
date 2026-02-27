/**
 * Security Tests — Cross-Organisation Access Control
 *
 * Tests that users cannot access data belonging to other organisations.
 */

import { describe, it, expect } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('Cross-Organisation Access Control', () => {
  let mfgToken: string;
  let impToken: string;

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
  });

  // ─── Products ─────────────────────────────────────────────────────────

  describe('Product isolation', () => {
    it('should not list products from other org', async () => {
      const res = await api.get('/api/products', { auth: impToken });
      expect(res.status).toBe(200);
      const products = Array.isArray(res.body) ? res.body : res.body.products || [];
      for (const p of products) {
        // Should NOT contain mfg org products
        expect(p.id).not.toBe(TEST_IDS.products.github);
        expect(p.id).not.toBe(TEST_IDS.products.codeberg);
      }
    });

    it('should not access product by ID from other org', async () => {
      const res = await api.get(`/api/products/${TEST_IDS.products.github}`, { auth: impToken });
      expect([403, 404]).toContain(res.status);
    });
  });

  // ─── Vulnerability Findings ───────────────────────────────────────────

  describe('Vulnerability findings isolation', () => {
    it('should not show vulnerability findings from other org products', async () => {
      const res = await api.get(`/api/risk-findings/${TEST_IDS.products.github}`, { auth: impToken });
      expect([403, 404]).toContain(res.status);
    });
  });

  // ─── SBOM Export ──────────────────────────────────────────────────────

  describe('SBOM export isolation', () => {
    it('should not export SBOM from other org product', async () => {
      const res = await api.get(`/api/sbom/${TEST_IDS.products.github}/export/cyclonedx`, { auth: impToken });
      expect([403, 404]).toContain(res.status);
    });

    it('should not access SBOM status from other org product', async () => {
      const res = await api.get(`/api/sbom/${TEST_IDS.products.github}/export/status`, { auth: impToken });
      expect([403, 404]).toContain(res.status);
    });
  });

  // ─── Due Diligence ────────────────────────────────────────────────────

  describe('Due diligence isolation', () => {
    it('should not preview due diligence from other org', async () => {
      const res = await api.get(`/api/due-diligence/${TEST_IDS.products.github}/preview`, { auth: impToken });
      expect([403, 404]).toContain(res.status);
    });

    it('should not export due diligence from other org', async () => {
      const res = await api.get(`/api/due-diligence/${TEST_IDS.products.github}/export`, { auth: impToken });
      expect([403, 404]).toContain(res.status);
    });
  });

  // ─── CRA Reports ─────────────────────────────────────────────────────

  describe('CRA reports isolation', () => {
    it('should not access CRA report from other org', async () => {
      const res = await api.get(`/api/cra-reports/${TEST_IDS.reports.draft}`, { auth: impToken });
      expect([403, 404]).toContain(res.status);
    });

    it('should not submit stage to other org report', async () => {
      const res = await api.post(`/api/cra-reports/${TEST_IDS.reports.draft}/stages`, {
        auth: impToken,
        body: { stage: 'early_warning', content: { summary: 'Hacking attempt' } },
      });
      expect([403, 404]).toContain(res.status);
    });
  });

  // ─── Escrow ───────────────────────────────────────────────────────────

  describe('Escrow isolation', () => {
    it('should not access escrow config from other org', async () => {
      const res = await api.get(`/api/escrow/${TEST_IDS.products.github}/config`, { auth: impToken });
      expect([403, 404]).toContain(res.status);
    });
  });

  // ─── Org Members ──────────────────────────────────────────────────────

  describe('Org members isolation', () => {
    it('should only list own org members', async () => {
      const res = await api.get('/api/org/members', { auth: impToken });
      expect(res.status).toBe(200);
      const members = Array.isArray(res.body) ? res.body : res.body.members || [];
      for (const m of members) {
        expect(m.email).not.toBe(TEST_USERS.mfgAdmin);
        expect(m.email).not.toBe(TEST_USERS.mfgMember1);
      }
    });
  });
});

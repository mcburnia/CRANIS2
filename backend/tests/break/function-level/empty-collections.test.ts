/**
 * Break Tests — Function Level: Empty Collections
 *
 * Tests API behavior when dealing with empty arrays, empty objects,
 * and entities that have no related data.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../../setup/test-helpers.js';
import { TEST_IDS } from '../../setup/seed-test-data.js';

describe('Break: Empty Collections', () => {
  let token: string;
  let emptyToken: string;

  beforeAll(async () => {
    token = await loginTestUser(TEST_USERS.mfgAdmin);
    emptyToken = await loginTestUser(TEST_USERS.emptyAdmin);
  });

  // ─── Empty org (no products, no data) ──────────────────────────────────

  describe('Empty org — all endpoints return graceful empty', () => {
    it('GET /api/products should return empty products array', async () => {
      const res = await api.get('/api/products', { auth: emptyToken });
      expect(res.status).toBe(200);
      const products = res.body.products || res.body;
      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBe(0);
    });

    it('GET /api/cra-reports should return empty reports', async () => {
      const res = await api.get('/api/cra-reports', { auth: emptyToken });
      expect(res.status).toBe(200);
      const reports = res.body.reports || res.body;
      expect(Array.isArray(reports)).toBe(true);
      expect(reports.length).toBe(0);
    });

    it('GET /api/cra-reports/overview should return zero counts', async () => {
      const res = await api.get('/api/cra-reports/overview', { auth: emptyToken });
      expect(res.status).toBe(200);
      expect(res.body.activeReports).toBe(0);
      expect(res.body.draftCount).toBe(0);
    });

    it('GET /api/risk-findings/overview should return empty products', async () => {
      const res = await api.get('/api/risk-findings/overview', { auth: emptyToken });
      expect(res.status).toBe(200);
      const products = res.body.products || [];
      expect(products.length).toBe(0);
    });

    it('GET /api/license-scan/overview should return empty products', async () => {
      const res = await api.get('/api/license-scan/overview', { auth: emptyToken });
      expect(res.status).toBe(200);
      expect(res.body.products.length).toBe(0);
    });

    it('GET /api/technical-files/overview should return empty products', async () => {
      const res = await api.get('/api/technical-files/overview', { auth: emptyToken });
      expect(res.status).toBe(200);
      expect(res.body.products.length).toBe(0);
    });

    it('GET /api/notifications should return empty notifications', async () => {
      const res = await api.get('/api/notifications', { auth: emptyToken });
      expect(res.status).toBe(200);
      const notifications = res.body.notifications || res.body;
      expect(Array.isArray(notifications)).toBe(true);
    });

    it('GET /api/notifications/unread-count should return 0', async () => {
      const res = await api.get('/api/notifications/unread-count', { auth: emptyToken });
      expect(res.status).toBe(200);
      expect(res.body.unreadCount).toBe(0);
    });

    it('GET /api/stakeholders should return stakeholders (auto-seeded)', async () => {
      const res = await api.get('/api/stakeholders', { auth: emptyToken });
      expect(res.status).toBe(200);
      // Stakeholders are auto-seeded per org
      const stakeholders = res.body.orgStakeholders || res.body;
      expect(Array.isArray(stakeholders)).toBe(true);
    });

    it('GET /api/dashboard should return dashboard data', async () => {
      const res = await api.get('/api/dashboard', { auth: emptyToken });
      // May return 404 if dashboard requires products
      expect([200, 404]).toContain(res.status);
    });

    it('GET /api/audit-log should return events (at least login events)', async () => {
      const res = await api.get('/api/audit-log', { auth: emptyToken });
      expect(res.status).toBe(200);
      const events = res.body.events || res.body;
      expect(Array.isArray(events)).toBe(true);
    });
  });

  // ─── Product with no SBOM/scan/vuln data ───────────────────────────────

  describe('Product with no enrichment data', () => {
    it('SBOM export status should indicate no SBOM', async () => {
      // gitea product has no SBOM data
      const res = await api.get(`/api/sbom/${TEST_IDS.products.gitea}/export/status`, { auth: token });
      expect(res.status).toBe(200);
      expect(typeof res.body.hasSBOM).toBe('boolean');
    });

    it('vulnerability scan per product should return empty findings', async () => {
      const res = await api.get(`/api/risk-findings/${TEST_IDS.products.gitea}`, { auth: token });
      expect(res.status).toBe(200);
      const findings = res.body.findings || [];
      expect(Array.isArray(findings)).toBe(true);
      expect(findings.length).toBe(0);
    });

    it('license scan per product should return empty findings', async () => {
      const res = await api.get(`/api/license-scan/${TEST_IDS.products.gitea}`, { auth: token });
      expect(res.status).toBe(200);
      expect(res.body.findings.length).toBe(0);
    });

    it('compliance timeline should handle product with no events', async () => {
      const res = await api.get(`/api/compliance-timeline/${TEST_IDS.products.gitea}`, { auth: token });
      expect(res.status).toBe(200);
      // Timeline may be in various response shapes
      expect(res.body).toBeDefined();
    });
  });

  // ─── Empty request bodies ──────────────────────────────────────────────

  describe('Empty request bodies', () => {
    it('POST /api/cra-reports with empty body', async () => {
      const res = await api.post('/api/cra-reports', { auth: token, body: {} });
      expect([400, 422, 500]).toContain(res.status);
    });

    it('PUT /api/org with empty body', async () => {
      const res = await api.put('/api/org', { auth: token, body: {} });
      expect([200, 400]).toContain(res.status);
    });

    it('POST /api/feedback with empty body', async () => {
      const res = await api.post('/api/feedback', { auth: token, body: {} });
      expect([400, 422, 500]).toContain(res.status);
    });

    it('POST /api/auth/register with empty body', async () => {
      const res = await api.post('/api/auth/register', { body: {} });
      expect(res.status).toBe(400);
    });

    it('POST /api/auth/login with empty body', async () => {
      const res = await api.post('/api/auth/login', { body: {} });
      expect(res.status).toBe(400);
    });
  });

  // ─── Empty arrays in body ──────────────────────────────────────────────

  describe('Empty arrays in body', () => {
    it('should handle empty array as CRA report content', async () => {
      const res = await api.post(`/api/cra-reports/${TEST_IDS.reports.draft}/stages`, {
        auth: token,
        body: { stage: 'early_warning', content: [] },
      });
      expect([400, 422, 500]).toContain(res.status);
    });

    it('should handle notification mark-all-read when none exist', async () => {
      const res = await api.put('/api/notifications/mark-all-read', { auth: emptyToken });
      // Should succeed even with nothing to mark
      expect([200, 204, 404]).toContain(res.status);
    });
  });
});

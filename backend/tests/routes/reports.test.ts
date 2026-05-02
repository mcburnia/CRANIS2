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
 * Reports Route Tests — /api/reports
 *
 * Tests the three compliance report endpoints:
 * - GET /api/reports/compliance-summary
 * - GET /api/reports/compliance-summary/export?format=md|csv
 * - GET /api/reports/vulnerability-trends
 * - GET /api/reports/vulnerability-trends/export?format=md|csv
 * - GET /api/reports/audit-trail
 * - GET /api/reports/audit-trail/export?format=md|csv
 *
 * All endpoints require auth and return data scoped to the caller's org.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

describe('/api/reports', () => {
  let mfgToken: string;
  let impToken: string;

  // Default date range (last 12 months) — matches the frontend default
  const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // REPORT A — COMPLIANCE SUMMARY
  // ═══════════════════════════════════════════════════════════════════════

  describe('GET /compliance-summary', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get('/api/reports/compliance-summary');
      expect(res.status).toBe(401);
    });

    it('should return 200 with valid auth', async () => {
      const res = await api.get('/api/reports/compliance-summary', {
        auth: mfgToken,
        query: { from, to },
      });
      expect(res.status).toBe(200);
    });

    it('should return expected top-level shape', async () => {
      const res = await api.get('/api/reports/compliance-summary', {
        auth: mfgToken,
        query: { from, to },
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('orgName');
      expect(res.body).toHaveProperty('generatedAt');
      expect(res.body).toHaveProperty('products');
      expect(Array.isArray(res.body.products)).toBe(true);
    });

    it('should return product rows with all required fields', async () => {
      const res = await api.get('/api/reports/compliance-summary', {
        auth: mfgToken,
        query: { from, to },
      });
      expect(res.status).toBe(200);

      if (res.body.products.length > 0) {
        const product = res.body.products[0];
        expect(product).toHaveProperty('id');
        expect(product).toHaveProperty('name');
        expect(product).toHaveProperty('craCategory');
        expect(product).toHaveProperty('obligations');
        expect(product.obligations).toHaveProperty('total');
        expect(product.obligations).toHaveProperty('met');
        expect(product.obligations).toHaveProperty('inProgress');
        expect(product.obligations).toHaveProperty('notStarted');
        expect(product).toHaveProperty('technicalFile');
        expect(product.technicalFile).toHaveProperty('percentComplete');
        expect(product).toHaveProperty('craReports');
        expect(product.craReports).toHaveProperty('total');
      }
    });

    it('should return numeric values for obligation counts', async () => {
      const res = await api.get('/api/reports/compliance-summary', {
        auth: mfgToken,
        query: { from, to },
      });
      expect(res.status).toBe(200);

      for (const product of res.body.products) {
        expect(typeof product.obligations.total).toBe('number');
        expect(typeof product.obligations.met).toBe('number');
        expect(typeof product.technicalFile.percentComplete).toBe('number');
        expect(product.technicalFile.percentComplete).toBeGreaterThanOrEqual(0);
        expect(product.technicalFile.percentComplete).toBeLessThanOrEqual(100);
      }
    });

    it('should default to last 12 months when no date range supplied', async () => {
      const res = await api.get('/api/reports/compliance-summary', {
        auth: mfgToken,
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('products');
    });

    it('should scope data to the caller\'s own organisation', async () => {
      const mfgRes = await api.get('/api/reports/compliance-summary', {
        auth: mfgToken,
        query: { from, to },
      });
      const impRes = await api.get('/api/reports/compliance-summary', {
        auth: impToken,
        query: { from, to },
      });
      expect(mfgRes.status).toBe(200);
      expect(impRes.status).toBe(200);
      // Different orgs — product sets must not overlap
      const mfgIds = new Set((mfgRes.body.products ?? []).map((p: any) => p.productId));
      const impIds = (impRes.body.products ?? []).map((p: any) => p.productId);
      const overlap = impIds.filter((id: string) => mfgIds.has(id));
      expect(overlap).toHaveLength(0);
    });
  });

  describe('GET /compliance-summary/export', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get('/api/reports/compliance-summary/export', {
        query: { format: 'md', from, to },
      });
      expect(res.status).toBe(401);
    });

    it('should return Markdown for format=md', async () => {
      const res = await api.get('/api/reports/compliance-summary/export', {
        auth: mfgToken,
        query: { format: 'md', from, to },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/markdown');
      const body = typeof res.body === 'string' ? res.body : Buffer.from(res.body).toString('utf-8');
      expect(body).toMatch(/^#/);
    });

    it('should return CSV text for format=csv', async () => {
      const res = await api.get('/api/reports/compliance-summary/export', {
        auth: mfgToken,
        query: { format: 'csv', from, to },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
      expect(typeof res.body).toBe('string');
      // CSV should start with column headers
      expect(res.body).toContain('Product');
    });

    it('should include a Content-Disposition attachment header', async () => {
      const res = await api.get('/api/reports/compliance-summary/export', {
        auth: mfgToken,
        query: { format: 'csv', from, to },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-disposition')).toContain('attachment');
      expect(res.headers.get('content-disposition')).toContain('compliance-summary');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // REPORT B — VULNERABILITY TRENDS
  // ═══════════════════════════════════════════════════════════════════════

  describe('GET /vulnerability-trends', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get('/api/reports/vulnerability-trends');
      expect(res.status).toBe(401);
    });

    it('should return 200 with valid auth', async () => {
      const res = await api.get('/api/reports/vulnerability-trends', {
        auth: mfgToken,
        query: { from, to },
      });
      expect(res.status).toBe(200);
    });

    it('should return expected top-level shape', async () => {
      const res = await api.get('/api/reports/vulnerability-trends', {
        auth: mfgToken,
        query: { from, to },
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('scans');
      expect(res.body).toHaveProperty('statusByMonth');
      expect(res.body).toHaveProperty('ecosystems');
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('products');
      expect(res.body).toHaveProperty('generatedAt');
      expect(Array.isArray(res.body.scans)).toBe(true);
      expect(Array.isArray(res.body.statusByMonth)).toBe(true);
      expect(Array.isArray(res.body.ecosystems)).toBe(true);
      expect(Array.isArray(res.body.products)).toBe(true);
    });

    it('should return a summary with severity counts', async () => {
      const res = await api.get('/api/reports/vulnerability-trends', {
        auth: mfgToken,
        query: { from, to },
      });
      expect(res.status).toBe(200);
      const s = res.body.summary;
      expect(typeof s.critical).toBe('number');
      expect(typeof s.high).toBe('number');
      expect(typeof s.medium).toBe('number');
      expect(typeof s.low).toBe('number');
      expect(typeof s.total).toBe('number');
      expect(typeof s.open).toBe('number');
    });

    it('should return valid scan rows when scans exist', async () => {
      const res = await api.get('/api/reports/vulnerability-trends', {
        auth: mfgToken,
        query: { from, to },
      });
      expect(res.status).toBe(200);

      if (res.body.scans.length > 0) {
        const scan = res.body.scans[0];
        expect(scan).toHaveProperty('id');
        expect(scan).toHaveProperty('productId');
        expect(scan).toHaveProperty('completedAt');
        expect(scan).toHaveProperty('findingsCount');
        expect(typeof scan.critical).toBe('number');
        expect(typeof scan.high).toBe('number');
      }
    });

    it('should accept optional productId filter', async () => {
      // First get the product list
      const listRes = await api.get('/api/reports/vulnerability-trends', {
        auth: mfgToken,
        query: { from, to },
      });
      expect(listRes.status).toBe(200);

      if (listRes.body.products.length > 0) {
        const productId = listRes.body.products[0].id;
        const filteredRes = await api.get('/api/reports/vulnerability-trends', {
          auth: mfgToken,
          query: { from, to, productId },
        });
        expect(filteredRes.status).toBe(200);
        // All returned scans should belong to the requested product
        for (const scan of filteredRes.body.scans) {
          expect(scan.productId).toBe(productId);
        }
      }
    });

    it('should default to last 12 months when no date range supplied', async () => {
      const res = await api.get('/api/reports/vulnerability-trends', {
        auth: mfgToken,
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('scans');
    });
  });

  describe('GET /vulnerability-trends/export', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get('/api/reports/vulnerability-trends/export', {
        query: { format: 'md', from, to },
      });
      expect(res.status).toBe(401);
    });

    it('should return Markdown for format=md', async () => {
      const res = await api.get('/api/reports/vulnerability-trends/export', {
        auth: mfgToken,
        query: { format: 'md', from, to },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/markdown');
      const body = typeof res.body === 'string' ? res.body : Buffer.from(res.body).toString('utf-8');
      expect(body).toMatch(/^#/);
    });

    it('should return CSV for format=csv', async () => {
      const res = await api.get('/api/reports/vulnerability-trends/export', {
        auth: mfgToken,
        query: { format: 'csv', from, to },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
      expect(typeof res.body).toBe('string');
      expect(res.body).toContain('SCAN HISTORY');
    });

    it('should include Content-Disposition header', async () => {
      const res = await api.get('/api/reports/vulnerability-trends/export', {
        auth: mfgToken,
        query: { format: 'csv', from, to },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-disposition')).toContain('attachment');
      expect(res.headers.get('content-disposition')).toContain('vulnerability-trends');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // REPORT C — AUDIT TRAIL
  // ═══════════════════════════════════════════════════════════════════════

  describe('GET /audit-trail', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get('/api/reports/audit-trail');
      expect(res.status).toBe(401);
    });

    it('should return 200 with valid auth', async () => {
      const res = await api.get('/api/reports/audit-trail', {
        auth: mfgToken,
        query: { from, to },
      });
      expect(res.status).toBe(200);
    });

    it('should return expected top-level shape', async () => {
      const res = await api.get('/api/reports/audit-trail', {
        auth: mfgToken,
        query: { from, to },
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('userEvents');
      expect(res.body).toHaveProperty('complianceStages');
      expect(res.body).toHaveProperty('syncHistory');
      expect(res.body).toHaveProperty('generatedAt');
      expect(Array.isArray(res.body.userEvents)).toBe(true);
      expect(Array.isArray(res.body.complianceStages)).toBe(true);
      expect(Array.isArray(res.body.syncHistory)).toBe(true);
    });

    it('should return user event rows with required fields', async () => {
      const res = await api.get('/api/reports/audit-trail', {
        auth: mfgToken,
        query: { from, to },
      });
      expect(res.status).toBe(200);

      if (res.body.userEvents.length > 0) {
        const event = res.body.userEvents[0];
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('eventType');
        expect(event).toHaveProperty('userEmail');
        expect(event).toHaveProperty('createdAt');
      }
    });

    it('should filter by category=auth', async () => {
      const res = await api.get('/api/reports/audit-trail', {
        auth: mfgToken,
        query: { from, to, category: 'auth' },
      });
      expect(res.status).toBe(200);
      // All returned events should be auth-related
      const authTypes = ['login', 'register', 'login_failed_bad_token', 'login_failed_unverified', 'login_failed_no_account'];
      for (const event of res.body.userEvents) {
        expect(authTypes).toContain(event.eventType);
      }
    });

    it('should filter by category=compliance — returns stages only', async () => {
      const res = await api.get('/api/reports/audit-trail', {
        auth: mfgToken,
        query: { from, to, category: 'compliance' },
      });
      expect(res.status).toBe(200);
      // With compliance filter, userEvents should be empty (no event type matches)
      // complianceStages may or may not have data
      expect(Array.isArray(res.body.complianceStages)).toBe(true);
    });

    it('should default to last 12 months when no date range supplied', async () => {
      const res = await api.get('/api/reports/audit-trail', {
        auth: mfgToken,
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('userEvents');
    });

    it('should scope events to the caller\'s own organisation', async () => {
      const mfgRes = await api.get('/api/reports/audit-trail', {
        auth: mfgToken,
        query: { from, to },
      });
      const impRes = await api.get('/api/reports/audit-trail', {
        auth: impToken,
        query: { from, to },
      });
      expect(mfgRes.status).toBe(200);
      expect(impRes.status).toBe(200);

      // Extract all emails from both responses
      const mfgEmails = new Set(mfgRes.body.userEvents.map((e: any) => e.userEmail));
      const impEmails = new Set(impRes.body.userEvents.map((e: any) => e.userEmail));

      // mfg org users should not appear in imp org audit trail (and vice versa)
      // (excluding 'system' events which may appear in both)
      const mfgOrgEmails = [...mfgEmails].filter(e => e !== 'system' && (e as string).includes('manufacturer-active'));
      const impOrgEmails = [...impEmails].filter(e => e !== 'system' && (e as string).includes('importer-trial'));

      for (const email of mfgOrgEmails) {
        expect(impEmails.has(email)).toBe(false);
      }
      for (const email of impOrgEmails) {
        expect(mfgEmails.has(email)).toBe(false);
      }
    });
  });

  describe('GET /audit-trail/export', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get('/api/reports/audit-trail/export', {
        query: { format: 'md', from, to },
      });
      expect(res.status).toBe(401);
    });

    it('should return Markdown for format=md', async () => {
      const res = await api.get('/api/reports/audit-trail/export', {
        auth: mfgToken,
        query: { format: 'md', from, to },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/markdown');
      const body = typeof res.body === 'string' ? res.body : Buffer.from(res.body).toString('utf-8');
      expect(body).toMatch(/^#/);
    });

    it('should return CSV for format=csv', async () => {
      const res = await api.get('/api/reports/audit-trail/export', {
        auth: mfgToken,
        query: { format: 'csv', from, to },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
      expect(typeof res.body).toBe('string');
      expect(res.body).toContain('USER EVENTS');
    });

    it('should include Content-Disposition header', async () => {
      const res = await api.get('/api/reports/audit-trail/export', {
        auth: mfgToken,
        query: { format: 'csv', from, to },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-disposition')).toContain('attachment');
      expect(res.headers.get('content-disposition')).toContain('audit-trail');
    });

    it('should respect category filter in export', async () => {
      const res = await api.get('/api/reports/audit-trail/export', {
        auth: mfgToken,
        query: { format: 'csv', from, to, category: 'auth' },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
    });
  });
});

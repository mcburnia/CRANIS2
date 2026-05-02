/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

/**
 * Risk Findings Regression Tests — Status Display & Open-Only Counts
 *
 * Regression suite to prevent recurrence of bugs where:
 * 1. Severity stat cards showed total counts instead of open-only
 * 2. Product detail page only recognised 'dismissed' status (not resolved/mitigated/acknowledged)
 * 3. Invalid 'closed' status was used instead of 'resolved'
 *
 * Seed data (github product): 7 findings across all 5 statuses:
 *   open(2), acknowledged(1), mitigated(1), resolved(1), dismissed(1), open(1)
 *
 * @tags @regression
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('Risk findings regression — status display & open-only counts', () => {
  let mfgToken: string;

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
  });

  // ─── Overview open-only severity fields ────────────────────────────────

  describe('GET /api/risk-findings/overview — open-only severity counts', () => {
    it('should include openCritical, openHigh, openMedium, openLow in totals', async () => {
      const res = await api.get('/api/risk-findings/overview', { auth: mfgToken });
      expect(res.status).toBe(200);

      const totals = res.body.totals;
      expect(totals).toBeDefined();
      expect(totals).toHaveProperty('openCritical');
      expect(totals).toHaveProperty('openHigh');
      expect(totals).toHaveProperty('openMedium');
      expect(totals).toHaveProperty('openLow');
      // Values must be numbers (not NaN or undefined)
      expect(Number.isFinite(totals.openCritical)).toBe(true);
      expect(Number.isFinite(totals.openHigh)).toBe(true);
      expect(Number.isFinite(totals.openMedium)).toBe(true);
      expect(Number.isFinite(totals.openLow)).toBe(true);
    });

    it('should include openCritical, openHigh, openMedium, openLow per product', async () => {
      const res = await api.get('/api/risk-findings/overview', { auth: mfgToken });
      expect(res.status).toBe(200);

      const githubProduct = res.body.products.find(
        (p: any) => p.id === TEST_IDS.products.github
      );
      expect(githubProduct, 'GitHub product should exist in overview').toBeTruthy();

      const findings = githubProduct.findings;
      expect(findings).toHaveProperty('openCritical');
      expect(findings).toHaveProperty('openHigh');
      expect(findings).toHaveProperty('openMedium');
      expect(findings).toHaveProperty('openLow');
    });

    it('open-only counts should exclude resolved/mitigated/dismissed findings', async () => {
      const res = await api.get('/api/risk-findings/overview', { auth: mfgToken });
      expect(res.status).toBe(200);

      const githubProduct = res.body.products.find(
        (p: any) => p.id === TEST_IDS.products.github
      );
      expect(githubProduct).toBeTruthy();

      const f = githubProduct.findings;
      // Total counts should be >= open-only counts
      expect(f.critical).toBeGreaterThanOrEqual(f.openCritical);
      expect(f.high).toBeGreaterThanOrEqual(f.openHigh);
      expect(f.medium).toBeGreaterThanOrEqual(f.openMedium);
      expect(f.low).toBeGreaterThanOrEqual(f.openLow);

      // Seed data: github has resolved(high), mitigated(medium), dismissed(medium)
      // So open-only counts should be strictly less than totals for high and medium
      expect(f.high).toBeGreaterThan(f.openHigh);
      // medium total >= 2 (1 mitigated + 1 dismissed), openMedium should be 0
      expect(f.openMedium).toBe(0);
    });

    it('acknowledged findings should be included in open-only counts', async () => {
      const res = await api.get('/api/risk-findings/overview', { auth: mfgToken });
      expect(res.status).toBe(200);

      const githubProduct = res.body.products.find(
        (p: any) => p.id === TEST_IDS.products.github
      );
      expect(githubProduct).toBeTruthy();

      // Seed data: 1 acknowledged high finding — should count toward openHigh
      // openHigh = open highs (1: CVE-2024-0002) + acknowledged highs (1: CVE-2024-0007) = 2
      expect(githubProduct.findings.openHigh).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── Per-product findings — summary status fields ──────────────────────

  describe('GET /api/risk-findings/:productId — summary status breakdown', () => {
    it('should return summary with all 5 status counts', async () => {
      const res = await api.get(`/api/risk-findings/${TEST_IDS.products.github}`, { auth: mfgToken });
      expect(res.status).toBe(200);

      const summary = res.body.summary;
      expect(summary).toBeDefined();
      expect(summary).toHaveProperty('open');
      expect(summary).toHaveProperty('dismissed');
      expect(summary).toHaveProperty('acknowledged');
      expect(summary).toHaveProperty('mitigated');
      expect(summary).toHaveProperty('resolved');
      expect(summary).toHaveProperty('total');
      expect(summary).toHaveProperty('critical');
      expect(summary).toHaveProperty('high');
      expect(summary).toHaveProperty('medium');
      expect(summary).toHaveProperty('low');
    });

    it('status counts should sum to total', async () => {
      const res = await api.get(`/api/risk-findings/${TEST_IDS.products.github}`, { auth: mfgToken });
      expect(res.status).toBe(200);

      const s = res.body.summary;
      const statusSum = s.open + s.dismissed + s.acknowledged + s.mitigated + s.resolved;
      expect(statusSum, `Status sum (${statusSum}) should equal total (${s.total}). If not, there are findings with invalid statuses like "closed"`).toBe(s.total);
    });

    it('should have findings in all 5 statuses (seed data regression)', async () => {
      const res = await api.get(`/api/risk-findings/${TEST_IDS.products.github}`, { auth: mfgToken });
      expect(res.status).toBe(200);

      const s = res.body.summary;
      // Seed data includes all 5 statuses for the github product
      expect(s.open, 'Should have open findings').toBeGreaterThanOrEqual(1);
      expect(s.mitigated, 'Should have mitigated findings').toBeGreaterThanOrEqual(1);
      expect(s.resolved, 'Should have resolved findings').toBeGreaterThanOrEqual(1);
      expect(s.dismissed, 'Should have dismissed findings').toBeGreaterThanOrEqual(1);
      expect(s.acknowledged, 'Should have acknowledged findings').toBeGreaterThanOrEqual(1);
    });

    it('each finding should have a valid status (no "closed")', async () => {
      const res = await api.get(`/api/risk-findings/${TEST_IDS.products.github}`, { auth: mfgToken });
      expect(res.status).toBe(200);

      const validStatuses = ['open', 'dismissed', 'acknowledged', 'mitigated', 'resolved'];
      for (const finding of res.body.findings) {
        expect(
          validStatuses,
          `Finding ${finding.source_id || finding.id} has invalid status "${finding.status}" — "closed" is NOT a valid status`
        ).toContain(finding.status);
      }
    });

    it('should filter findings by status query parameter', async () => {
      // Filter for open findings — seed has multiple open findings so this is robust
      // against concurrent test modifications to other statuses
      const res = await api.get(`/api/risk-findings/${TEST_IDS.products.github}?status=open`, { auth: mfgToken });
      expect(res.status).toBe(200);
      expect(res.body.findings.length).toBeGreaterThanOrEqual(1);
      for (const f of res.body.findings) {
        expect(f.status).toBe('open');
      }
    });

    it('should filter findings by severity query parameter', async () => {
      const res = await api.get(`/api/risk-findings/${TEST_IDS.products.github}?severity=critical`, { auth: mfgToken });
      expect(res.status).toBe(200);
      for (const f of res.body.findings) {
        expect(f.severity).toBe('critical');
      }
    });
  });

  // ─── PUT /api/risk-findings/:findingId — triage status transitions ─────

  describe('PUT /api/risk-findings/:findingId — triage status transitions', () => {
    let testFindingId: string;

    beforeAll(async () => {
      // Get a finding to test status changes
      const res = await api.get(`/api/risk-findings/${TEST_IDS.products.github}`, { auth: mfgToken });
      // Use the first open finding for testing
      const openFinding = res.body.findings.find((f: any) => f.status === 'open');
      expect(openFinding, 'Need at least one open finding for triage tests').toBeTruthy();
      testFindingId = openFinding.id;
    });

    it('should transition open → acknowledged', async () => {
      const res = await api.put(`/api/risk-findings/${testFindingId}`, {
        auth: mfgToken,
        body: { status: 'acknowledged' },
      });
      expect(res.status).toBe(200);

      // Verify status changed
      const check = await api.get(`/api/risk-findings/${TEST_IDS.products.github}`, { auth: mfgToken });
      const updated = check.body.findings.find((f: any) => f.id === testFindingId);
      expect(updated.status).toBe('acknowledged');
    });

    it('should transition acknowledged → mitigated with notes', async () => {
      const res = await api.put(`/api/risk-findings/${testFindingId}`, {
        auth: mfgToken,
        body: { status: 'mitigated', mitigationNotes: 'Applied workaround in config' },
      });
      expect(res.status).toBe(200);

      const check = await api.get(`/api/risk-findings/${TEST_IDS.products.github}`, { auth: mfgToken });
      const updated = check.body.findings.find((f: any) => f.id === testFindingId);
      expect(updated.status).toBe('mitigated');
    });

    it('should transition mitigated → resolved', async () => {
      const res = await api.put(`/api/risk-findings/${testFindingId}`, {
        auth: mfgToken,
        body: { status: 'resolved' },
      });
      expect(res.status).toBe(200);

      const check = await api.get(`/api/risk-findings/${TEST_IDS.products.github}`, { auth: mfgToken });
      const updated = check.body.findings.find((f: any) => f.id === testFindingId);
      expect(updated.status).toBe('resolved');
    });

    it('should transition resolved → dismissed with reason', async () => {
      const res = await api.put(`/api/risk-findings/${testFindingId}`, {
        auth: mfgToken,
        body: { status: 'dismissed', reason: 'False positive — not applicable to our usage' },
      });
      expect(res.status).toBe(200);

      const check = await api.get(`/api/risk-findings/${TEST_IDS.products.github}`, { auth: mfgToken });
      const updated = check.body.findings.find((f: any) => f.id === testFindingId);
      expect(updated.status).toBe('dismissed');
    });

    it('should transition dismissed → open (re-open)', async () => {
      const res = await api.put(`/api/risk-findings/${testFindingId}`, {
        auth: mfgToken,
        body: { status: 'open' },
      });
      expect(res.status).toBe(200);

      const check = await api.get(`/api/risk-findings/${TEST_IDS.products.github}`, { auth: mfgToken });
      const updated = check.body.findings.find((f: any) => f.id === testFindingId);
      expect(updated.status).toBe('open');
    });

    it('should reject invalid status value "closed"', async () => {
      const res = await api.put(`/api/risk-findings/${testFindingId}`, {
        auth: mfgToken,
        body: { status: 'closed' },
      });
      // Should reject — 'closed' is not a valid triage status
      expect(res.status).toBe(400);
    });
  });

  // ─── Product with no open findings — "all handled" scenario ────────────

  describe('Product with no open findings — overview aggregation', () => {
    it('products with only resolved/dismissed findings should have zero open-only counts', async () => {
      const res = await api.get('/api/risk-findings/overview', { auth: mfgToken });
      expect(res.status).toBe(200);

      // Find products that have findings but none are open
      for (const product of res.body.products) {
        const f = product.findings;
        // Skip products with no findings at all
        if (f.total === 0) continue;

        if (f.open === 0 && f.acknowledged === 0) {
          expect(f.openCritical, `${product.name}: openCritical should be 0 when no open findings`).toBe(0);
          expect(f.openHigh, `${product.name}: openHigh should be 0 when no open findings`).toBe(0);
          expect(f.openMedium, `${product.name}: openMedium should be 0 when no open findings`).toBe(0);
          expect(f.openLow, `${product.name}: openLow should be 0 when no open findings`).toBe(0);
        }
      }
    });

    it('totals openCritical/openHigh/openMedium/openLow should not be NaN', async () => {
      const res = await api.get('/api/risk-findings/overview', { auth: mfgToken });
      expect(res.status).toBe(200);

      const t = res.body.totals;
      expect(Number.isNaN(t.openCritical), 'openCritical should not be NaN').toBe(false);
      expect(Number.isNaN(t.openHigh), 'openHigh should not be NaN').toBe(false);
      expect(Number.isNaN(t.openMedium), 'openMedium should not be NaN').toBe(false);
      expect(Number.isNaN(t.openLow), 'openLow should not be NaN').toBe(false);
    });
  });
});

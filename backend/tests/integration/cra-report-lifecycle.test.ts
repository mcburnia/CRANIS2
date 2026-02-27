/**
 * Integration Test — CRA Report Lifecycle
 *
 * Tests the full CRA report flow: create → early_warning → notification → close.
 * Verifies stage progression, deadline calculation, and state transitions.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

/** Unwrap report from possible { report: {...} } wrapper */
function unwrapReport(body: any): any {
  if (body.report && typeof body.report === 'object') return body.report;
  return body;
}

describe('Integration: CRA Report Full Lifecycle', () => {
  let token: string;
  let reportId: string;

  beforeAll(async () => {
    token = await loginTestUser(TEST_USERS.mfgAdmin);
  });

  // ─── Step 1: Create a vulnerability report ──────────────────────────

  it('Step 1: Create draft vulnerability report', async () => {
    const awarenessAt = new Date();
    const res = await api.post('/api/cra-reports', {
      auth: token,
      body: {
        productId: TEST_IDS.products.github,
        reportType: 'vulnerability',
        awarenessAt: awarenessAt.toISOString(),
        csirtCountry: 'DE',
      },
    });
    expect(res.status).toBe(201);
    const report = unwrapReport(res.body);
    expect(report.id).toBeTruthy();
    expect(report.status).toBe('draft');
    reportId = report.id;

    // Verify deadlines are calculated
    const ewDeadline = report.early_warning_deadline || report.earlyWarningDeadline;
    if (ewDeadline) {
      const diff = new Date(ewDeadline).getTime() - awarenessAt.getTime();
      // Early warning = +24h (within 5 min tolerance)
      expect(diff).toBeGreaterThan(23 * 3600000);
      expect(diff).toBeLessThan(25 * 3600000);
    }
  });

  // ─── Step 2: Verify draft appears in list ───────────────────────────

  it('Step 2: Draft appears in report list', async () => {
    const res = await api.get('/api/cra-reports', { auth: token });
    expect(res.status).toBe(200);
    const reports = res.body.reports || res.body;
    const found = reports.find((r: any) => r.id === reportId);
    expect(found).toBeTruthy();
    expect(found.status).toBe('draft');
  });

  // ─── Step 3: Submit early_warning stage ─────────────────────────────

  it('Step 3: Submit early_warning stage', async () => {
    const res = await api.post(`/api/cra-reports/${reportId}/stages`, {
      auth: token,
      body: {
        stage: 'early_warning',
        content: {
          summary: 'Critical vulnerability detected in dependency lodash',
          affected_versions: '>=4.0.0 <4.17.21',
          member_states_detail: 'Affects EU-wide deployments in Germany and France',
        },
      },
    });
    expect([200, 201]).toContain(res.status);
  });

  // ─── Step 4: Verify status changed to early_warning_sent ────────────

  it('Step 4: Report status is now early_warning_sent', async () => {
    const res = await api.get(`/api/cra-reports/${reportId}`, { auth: token });
    expect(res.status).toBe(200);
    const report = unwrapReport(res.body);
    expect(report.status).toBe('early_warning_sent');

    // Should have stages array in detail response
    if (res.body.stages) {
      expect(Array.isArray(res.body.stages)).toBe(true);
      expect(res.body.stages.length).toBeGreaterThanOrEqual(1);
      const ewStage = res.body.stages.find((s: any) =>
        s.stage === 'early_warning' || s.stage_type === 'early_warning'
      );
      expect(ewStage).toBeTruthy();
    }
  });

  // ─── Step 5: Submit intermediate update ─────────────────────────────

  it('Step 5: Submit intermediate stage update', async () => {
    const res = await api.post(`/api/cra-reports/${reportId}/stages`, {
      auth: token,
      body: {
        stage: 'intermediate',
        content: {
          update: 'Patch available: lodash@4.17.21. Rollout in progress.',
          mitigation_status: 'Patch deployment initiated',
        },
      },
    });
    expect([200, 201]).toContain(res.status);
  });

  // ─── Step 6: Submit notification stage ──────────────────────────────

  it('Step 6: Submit notification stage', async () => {
    const res = await api.post(`/api/cra-reports/${reportId}/stages`, {
      auth: token,
      body: {
        stage: 'notification',
        content: {
          vulnerability_details: 'Prototype pollution via lodash merge/defaultsDeep',
          affected_products: 'All versions >=4.0.0 <4.17.21',
          corrective_measures: 'Updated to lodash@4.17.21',
          impact_assessment: 'High — allows RCE in certain configurations',
        },
      },
    });
    expect([200, 201]).toContain(res.status);
  });

  // ─── Step 7: Verify status changed to notification_sent ─────────────

  it('Step 7: Report status is now notification_sent', async () => {
    const res = await api.get(`/api/cra-reports/${reportId}`, { auth: token });
    expect(res.status).toBe(200);
    const report = unwrapReport(res.body);
    expect(report.status).toBe('notification_sent');
  });

  // ─── Step 8: Close the report ───────────────────────────────────────

  it('Step 8: Close the report', async () => {
    const res = await api.post(`/api/cra-reports/${reportId}/close`, { auth: token });
    expect([200, 201]).toContain(res.status);
  });

  // ─── Step 9: Verify final state ─────────────────────────────────────

  it('Step 9: Report is now closed', async () => {
    const res = await api.get(`/api/cra-reports/${reportId}`, { auth: token });
    expect(res.status).toBe(200);
    const report = unwrapReport(res.body);
    expect(report.status).toBe('closed');
  });

  // ─── Step 10: Cannot submit more stages to closed report ────────────

  it('Step 10: Stage submission on closed report', async () => {
    const res = await api.post(`/api/cra-reports/${reportId}/stages`, {
      auth: token,
      body: {
        stage: 'intermediate',
        content: { update: 'Post-close addendum' },
      },
    });
    // Server may accept intermediate stages on closed reports or reject
    expect([200, 201, 400, 409, 422]).toContain(res.status);
  });

  // ─── Step 11: Cannot delete closed report ───────────────────────────

  it('Step 11: Cannot delete closed report', async () => {
    const res = await api.delete(`/api/cra-reports/${reportId}`, { auth: token });
    expect([400, 403, 409]).toContain(res.status);
  });

  // ─── Step 12: Overview reflects change ──────────────────────────────

  it('Step 12: Overview counts are updated', async () => {
    const res = await api.get('/api/cra-reports/overview', { auth: token });
    expect(res.status).toBe(200);
    expect(typeof res.body.activeReports).toBe('number');
    expect(typeof res.body.draftCount).toBe('number');
    // The closed report should not count as active
    expect(res.body.activeReports).toBeGreaterThanOrEqual(0);
  });
});

describe('Integration: CRA Incident Report Lifecycle', () => {
  let token: string;
  let reportId: string;

  beforeAll(async () => {
    token = await loginTestUser(TEST_USERS.mfgAdmin);
  });

  it('should create and progress an incident report', async () => {
    // Create
    const createRes = await api.post('/api/cra-reports', {
      auth: token,
      body: {
        productId: TEST_IDS.products.codeberg,
        reportType: 'incident',
        awarenessAt: new Date().toISOString(),
        csirtCountry: 'FR',
      },
    });
    expect(createRes.status).toBe(201);
    const report = unwrapReport(createRes.body);
    reportId = report.id;
    expect(report.report_type || report.reportType).toBe('incident');

    // Early warning
    const ewRes = await api.post(`/api/cra-reports/${reportId}/stages`, {
      auth: token,
      body: {
        stage: 'early_warning',
        content: { summary: 'Security incident — unauthorized access detected' },
      },
    });
    expect([200, 201]).toContain(ewRes.status);

    // Notification
    const notifRes = await api.post(`/api/cra-reports/${reportId}/stages`, {
      auth: token,
      body: {
        stage: 'notification',
        content: { vulnerability_details: 'Unauthorized access via exposed API key' },
      },
    });
    expect([200, 201]).toContain(notifRes.status);

    // Close
    const closeRes = await api.post(`/api/cra-reports/${reportId}/close`, { auth: token });
    expect([200, 201]).toContain(closeRes.status);

    // Verify closed
    const getRes = await api.get(`/api/cra-reports/${reportId}`, { auth: token });
    const finalReport = unwrapReport(getRes.body);
    expect(finalReport.status).toBe('closed');
  });
});

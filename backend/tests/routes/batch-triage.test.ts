/**
 * Batch Triage Wizard Route Tests -- POST /api/risk-findings/:productId/batch-triage
 *
 * Tests: auth, cross-org isolation, validation, response shape, status updates,
 *        skip handling, idempotence
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginTestUser, TEST_USERS, getAppPool } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

const PRODUCT_ID = TEST_IDS.products.github;
const IMP_PRODUCT_ID = TEST_IDS.products.impGithub;
const ORG_ID = TEST_IDS.orgs.mfgActive;

// We will seed test findings and clean them up
const TEST_FINDING_IDS = [
  'd0000001-0000-0000-0000-000000000001',
  'd0000001-0000-0000-0000-000000000002',
  'd0000001-0000-0000-0000-000000000003',
];

describe('POST /api/risk-findings/:productId/batch-triage', () => {
  let mfgToken: string;
  let impToken: string;

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);

    // Seed test vulnerability findings
    const pool = getAppPool();
    for (let i = 0; i < TEST_FINDING_IDS.length; i++) {
      const severity = ['critical', 'high', 'low'][i];
      const fixVersion = i === 0 ? '2.0.0' : null;
      await pool.query(
        `INSERT INTO vulnerability_findings (id, org_id, product_id, source, source_id, severity, title, description, dependency_name, dependency_version, dependency_purl, status, fixed_version)
         VALUES ($1, $2, $3, 'osv', $4, $5, $6, 'Test desc', 'test-dep', '1.0.0', $7, 'open', $8)
         ON CONFLICT (id) DO UPDATE SET status = 'open', dismissed_by = NULL, dismissed_at = NULL, dismissed_reason = NULL, mitigation_notes = NULL, resolved_at = NULL, resolved_by = NULL`,
        [TEST_FINDING_IDS[i], ORG_ID, PRODUCT_ID, `TEST-${i}`, severity, `Test finding ${i}`, `pkg:npm/test-dep-${i}@1.0.0`, fixVersion]
      );
    }
  });

  afterAll(async () => {
    const pool = getAppPool();
    await pool.query(
      `DELETE FROM vulnerability_findings WHERE id = ANY($1)`,
      [TEST_FINDING_IDS]
    );
  });

  // ─── Authentication ──────────────────────────────────────

  it('should reject unauthenticated request with 401', async () => {
    const res = await api.post(`/api/risk-findings/${PRODUCT_ID}/batch-triage`, {
      body: { decisions: [] },
    });
    expect(res.status).toBe(401);
  });

  // ─── Cross-org isolation ─────────────────────────────────

  it('should return 404 for product belonging to another org', async () => {
    const res = await api.post(`/api/risk-findings/${IMP_PRODUCT_ID}/batch-triage`, {
      auth: mfgToken,
      body: { decisions: [{ findingId: TEST_FINDING_IDS[0], action: 'dismiss' }] },
    });
    expect(res.status).toBe(404);
  });

  // ─── Validation ──────────────────────────────────────────

  it('should return 400 when decisions array is missing', async () => {
    const res = await api.post(`/api/risk-findings/${PRODUCT_ID}/batch-triage`, {
      auth: mfgToken,
      body: {},
    });
    expect(res.status).toBe(400);
  });

  it('should return 400 when decisions array is empty', async () => {
    const res = await api.post(`/api/risk-findings/${PRODUCT_ID}/batch-triage`, {
      auth: mfgToken,
      body: { decisions: [] },
    });
    expect(res.status).toBe(400);
  });

  // ─── Response shape ──────────────────────────────────────

  it('should return 200 with results array and summary', async () => {
    const res = await api.post(`/api/risk-findings/${PRODUCT_ID}/batch-triage`, {
      auth: mfgToken,
      body: { decisions: [{ findingId: TEST_FINDING_IDS[0], action: 'skip' }] },
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('results');
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body).toHaveProperty('summary');
    expect(res.body.summary).toHaveProperty('applied');
    expect(res.body.summary).toHaveProperty('skipped');
    expect(res.body.summary).toHaveProperty('total');
  });

  // ─── Skip handling ───────────────────────────────────────

  it('should count skipped findings correctly', async () => {
    const res = await api.post(`/api/risk-findings/${PRODUCT_ID}/batch-triage`, {
      auth: mfgToken,
      body: {
        decisions: [
          { findingId: TEST_FINDING_IDS[0], action: 'skip' },
          { findingId: TEST_FINDING_IDS[1], action: 'skip' },
        ],
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.summary.applied).toBe(0);
    expect(res.body.summary.skipped).toBe(2);
  });

  // ─── Status updates ──────────────────────────────────────

  it('should dismiss a finding with reason', async () => {
    const res = await api.post(`/api/risk-findings/${PRODUCT_ID}/batch-triage`, {
      auth: mfgToken,
      body: {
        decisions: [{ findingId: TEST_FINDING_IDS[0], action: 'dismiss', reason: 'Not applicable to our deployment' }],
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.summary.applied).toBe(1);

    // Verify in DB
    const pool = getAppPool();
    const check = await pool.query('SELECT status, dismissed_reason FROM vulnerability_findings WHERE id = $1', [TEST_FINDING_IDS[0]]);
    expect(check.rows[0].status).toBe('dismissed');
    expect(check.rows[0].dismissed_reason).toBe('Not applicable to our deployment');

    // Reset
    await pool.query('UPDATE vulnerability_findings SET status = $1, dismissed_by = NULL, dismissed_at = NULL, dismissed_reason = NULL WHERE id = $2', ['open', TEST_FINDING_IDS[0]]);
  });

  it('should acknowledge a finding', async () => {
    const res = await api.post(`/api/risk-findings/${PRODUCT_ID}/batch-triage`, {
      auth: mfgToken,
      body: {
        decisions: [{ findingId: TEST_FINDING_IDS[1], action: 'acknowledge' }],
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.summary.applied).toBe(1);

    const pool = getAppPool();
    const check = await pool.query('SELECT status FROM vulnerability_findings WHERE id = $1', [TEST_FINDING_IDS[1]]);
    expect(check.rows[0].status).toBe('acknowledged');

    // Reset
    await pool.query('UPDATE vulnerability_findings SET status = $1, dismissed_by = NULL, dismissed_at = NULL WHERE id = $2', ['open', TEST_FINDING_IDS[1]]);
  });

  it('should mitigate a finding with notes', async () => {
    const res = await api.post(`/api/risk-findings/${PRODUCT_ID}/batch-triage`, {
      auth: mfgToken,
      body: {
        decisions: [{ findingId: TEST_FINDING_IDS[2], action: 'mitigate', reason: 'Updated to fixed version' }],
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.summary.applied).toBe(1);

    const pool = getAppPool();
    const check = await pool.query('SELECT status, mitigation_notes FROM vulnerability_findings WHERE id = $1', [TEST_FINDING_IDS[2]]);
    expect(check.rows[0].status).toBe('mitigated');
    expect(check.rows[0].mitigation_notes).toBe('Updated to fixed version');

    // Reset
    await pool.query('UPDATE vulnerability_findings SET status = $1, mitigation_notes = NULL, dismissed_by = NULL WHERE id = $2', ['open', TEST_FINDING_IDS[2]]);
  });

  // ─── Mixed decisions ─────────────────────────────────────

  it('should handle mixed actions in one batch', async () => {
    const res = await api.post(`/api/risk-findings/${PRODUCT_ID}/batch-triage`, {
      auth: mfgToken,
      body: {
        decisions: [
          { findingId: TEST_FINDING_IDS[0], action: 'dismiss', reason: 'False positive' },
          { findingId: TEST_FINDING_IDS[1], action: 'acknowledge' },
          { findingId: TEST_FINDING_IDS[2], action: 'skip' },
        ],
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.summary.applied).toBe(2);
    expect(res.body.summary.skipped).toBe(1);
    expect(res.body.summary.total).toBe(3);

    // Verify
    const pool = getAppPool();
    const checks = await pool.query('SELECT id, status FROM vulnerability_findings WHERE id = ANY($1) ORDER BY id', [TEST_FINDING_IDS]);
    const statusMap: Record<string, string> = {};
    for (const row of checks.rows) statusMap[row.id] = row.status;
    expect(statusMap[TEST_FINDING_IDS[0]]).toBe('dismissed');
    expect(statusMap[TEST_FINDING_IDS[1]]).toBe('acknowledged');
    expect(statusMap[TEST_FINDING_IDS[2]]).toBe('open'); // skipped, unchanged

    // Reset all
    await pool.query('UPDATE vulnerability_findings SET status = $1, dismissed_by = NULL, dismissed_at = NULL, dismissed_reason = NULL, mitigation_notes = NULL WHERE id = ANY($2)', ['open', TEST_FINDING_IDS]);
  });

  // ─── Non-existent finding ────────────────────────────────

  it('should report applied=false for non-existent finding', async () => {
    const res = await api.post(`/api/risk-findings/${PRODUCT_ID}/batch-triage`, {
      auth: mfgToken,
      body: {
        decisions: [{ findingId: '00000000-0000-0000-0000-000000000000', action: 'dismiss' }],
      },
    });
    expect(res.status).toBe(200);
    const result = res.body.results[0];
    expect(result.applied).toBe(false);
    expect(res.body.summary.applied).toBe(0);
  });

  // ─── Invalid action ──────────────────────────────────────

  it('should skip invalid actions gracefully', async () => {
    const res = await api.post(`/api/risk-findings/${PRODUCT_ID}/batch-triage`, {
      auth: mfgToken,
      body: {
        decisions: [{ findingId: TEST_FINDING_IDS[0], action: 'invalid_action' }],
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.results[0].applied).toBe(false);
    expect(res.body.summary.skipped).toBe(1);
  });
});

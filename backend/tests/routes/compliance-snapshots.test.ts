/**
 * Compliance Snapshots Route Tests — /api/products/:productId/compliance-snapshots
 *
 * Tests: authentication, cross-org isolation,
 * snapshot generation, listing, download, deletion, status polling,
 * cold storage columns, expired file handling
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginTestUser, TEST_USERS, getAppPool } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

const MFG_PRODUCT = TEST_IDS.products.github;
const IMP_PRODUCT = TEST_IDS.products.impGithub;

let mfgToken: string;
let impToken: string;

describe('/api/products/:productId/compliance-snapshots', () => {
  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
  });

  afterAll(async () => {
    // Clean up test snapshots
    const pool = getAppPool();
    await pool.query("DELETE FROM compliance_snapshots WHERE product_id = $1", [MFG_PRODUCT]);
  });

  // ═══════════════════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════════════════

  it('should reject unauthenticated GET request', async () => {
    const res = await api.get(`/api/products/${MFG_PRODUCT}/compliance-snapshots`);
    expect(res.status).toBe(401);
  });

  it('should reject unauthenticated POST request', async () => {
    const res = await api.post(`/api/products/${MFG_PRODUCT}/compliance-snapshots`);
    expect(res.status).toBe(401);
  });

  // ═══════════════════════════════════════════════════════
  // CROSS-ORG ISOLATION
  // ═══════════════════════════════════════════════════════

  it('should return 404 for product belonging to another org (GET)', async () => {
    const res = await api.get(`/api/products/${IMP_PRODUCT}/compliance-snapshots`, { auth: mfgToken });
    expect(res.status).toBe(404);
  });

  // ═══════════════════════════════════════════════════════
  // LISTING (empty state)
  // ═══════════════════════════════════════════════════════

  it('should return empty snapshots list initially', async () => {
    const res = await api.get(`/api/products/${MFG_PRODUCT}/compliance-snapshots`, { auth: mfgToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('snapshots');
    expect(Array.isArray(res.body.snapshots)).toBe(true);
  });

  // ═══════════════════════════════════════════════════════
  // SNAPSHOT GENERATION
  // ═══════════════════════════════════════════════════════

  let snapshotId: string;

  it('should accept POST and return 202 with snapshot ID', async () => {
    const res = await api.post(`/api/products/${MFG_PRODUCT}/compliance-snapshots`, { auth: mfgToken });
    expect(res.status).toBe(202);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('status');
    expect(res.body.status).toBe('generating');
    snapshotId = res.body.id;
  });

  it('should complete generation within 10 seconds', async () => {
    // Poll until complete or timeout
    let status = 'generating';
    let attempts = 0;
    while (status === 'generating' && attempts < 20) {
      await new Promise(r => setTimeout(r, 500));
      const res = await api.get(
        `/api/products/${MFG_PRODUCT}/compliance-snapshots/${snapshotId}/status`,
        { auth: mfgToken }
      );
      expect(res.status).toBe(200);
      status = res.body.status;
      attempts++;
    }
    expect(status).toBe('complete');
  }, 15000);

  // ═══════════════════════════════════════════════════════
  // LISTING (with data)
  // ═══════════════════════════════════════════════════════

  it('should list the generated snapshot', async () => {
    const res = await api.get(`/api/products/${MFG_PRODUCT}/compliance-snapshots`, { auth: mfgToken });
    expect(res.status).toBe(200);
    expect(res.body.snapshots.length).toBeGreaterThanOrEqual(1);

    const snapshot = res.body.snapshots.find((s: any) => s.id === snapshotId);
    expect(snapshot).toBeDefined();
    expect(snapshot.status).toBe('complete');
    expect(snapshot.filename).toMatch(/\.zip$/);
    expect(snapshot.size_bytes).toBeGreaterThan(0);
    expect(snapshot.content_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(snapshot.metadata).toBeDefined();
  });

  it('snapshot metadata should contain expected summary fields', async () => {
    const res = await api.get(`/api/products/${MFG_PRODUCT}/compliance-snapshots`, { auth: mfgToken });
    const snapshot = res.body.snapshots.find((s: any) => s.id === snapshotId);
    expect(snapshot.metadata).toHaveProperty('techFile');
    expect(snapshot.metadata).toHaveProperty('obligations');
    expect(snapshot.metadata).toHaveProperty('vulns');
    expect(snapshot.metadata).toHaveProperty('generatedAt');
  });

  it('should include cold_storage_status in listing', async () => {
    const res = await api.get(`/api/products/${MFG_PRODUCT}/compliance-snapshots`, { auth: mfgToken });
    const snapshot = res.body.snapshots.find((s: any) => s.id === snapshotId);
    expect(snapshot).toHaveProperty('cold_storage_status');
    // In test env (placeholder credentials), cold storage upload is skipped — status stays 'pending'
    expect(['pending', 'archived', 'failed']).toContain(snapshot.cold_storage_status);
  });

  // ═══════════════════════════════════════════════════════
  // DOWNLOAD
  // ═══════════════════════════════════════════════════════

  it('should download the snapshot ZIP', async () => {
    const res = await api.get(
      `/api/products/${MFG_PRODUCT}/compliance-snapshots/${snapshotId}/download`,
      { auth: mfgToken }
    );
    expect(res.status).toBe(200);
    expect(res.raw.headers.get('content-type')).toBe('application/zip');
    expect(res.raw.headers.get('content-disposition')).toMatch(/attachment.*\.zip/);
  });

  it('should return 404 for download of non-existent snapshot', async () => {
    const fakeId = 'f0000000-0000-0000-0000-000000000099';
    const res = await api.get(
      `/api/products/${MFG_PRODUCT}/compliance-snapshots/${fakeId}/download`,
      { auth: mfgToken }
    );
    expect(res.status).toBe(404);
  });

  // ═══════════════════════════════════════════════════════
  // EXPIRED LOCAL FILE (410 Gone)
  // ═══════════════════════════════════════════════════════

  it('should return 410 Gone when local file has been deleted', async () => {
    // Generate a second snapshot, then manually delete the local file
    const genRes = await api.post(`/api/products/${MFG_PRODUCT}/compliance-snapshots`, { auth: mfgToken });
    expect(genRes.status).toBe(202);
    const tempId = genRes.body.id;

    // Wait for generation to complete
    let status = 'generating';
    let attempts = 0;
    while (status === 'generating' && attempts < 20) {
      await new Promise(r => setTimeout(r, 500));
      const statusRes = await api.get(
        `/api/products/${MFG_PRODUCT}/compliance-snapshots/${tempId}/status`,
        { auth: mfgToken }
      );
      status = statusRes.body.status;
      attempts++;
    }
    expect(status).toBe('complete');

    // Simulate the local file being purged (24-hour cleanup) by pointing
    // the DB record at a non-existent filename
    const pool = getAppPool();
    await pool.query(
      "UPDATE compliance_snapshots SET filename = 'purged-snapshot.zip' WHERE id = $1",
      [tempId]
    );

    // Try to download — should get 410
    const dlRes = await api.get(
      `/api/products/${MFG_PRODUCT}/compliance-snapshots/${tempId}/download`,
      { auth: mfgToken }
    );
    expect(dlRes.status).toBe(410);
    expect(dlRes.body.error).toBe('Snapshot expired');

    // Clean up
    await pool.query('DELETE FROM compliance_snapshots WHERE id = $1', [tempId]);
  }, 15000);

  // ═══════════════════════════════════════════════════════
  // STATUS POLLING
  // ═══════════════════════════════════════════════════════

  it('should return status for a completed snapshot', async () => {
    const res = await api.get(
      `/api/products/${MFG_PRODUCT}/compliance-snapshots/${snapshotId}/status`,
      { auth: mfgToken }
    );
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('complete');
    expect(res.body.filename).toMatch(/\.zip$/);
  });

  it('should include cold_storage_status in status response', async () => {
    const res = await api.get(
      `/api/products/${MFG_PRODUCT}/compliance-snapshots/${snapshotId}/status`,
      { auth: mfgToken }
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('cold_storage_status');
  });

  it('should return 404 for status of non-existent snapshot', async () => {
    const fakeId = 'f0000000-0000-0000-0000-000000000099';
    const res = await api.get(
      `/api/products/${MFG_PRODUCT}/compliance-snapshots/${fakeId}/status`,
      { auth: mfgToken }
    );
    expect(res.status).toBe(404);
  });

  // ═══════════════════════════════════════════════════════
  // DELETE
  // ═══════════════════════════════════════════════════════

  it('should delete a snapshot', async () => {
    const res = await api.delete(
      `/api/products/${MFG_PRODUCT}/compliance-snapshots/${snapshotId}`,
      { auth: mfgToken }
    );
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should no longer list the deleted snapshot', async () => {
    const res = await api.get(`/api/products/${MFG_PRODUCT}/compliance-snapshots`, { auth: mfgToken });
    expect(res.status).toBe(200);
    const found = res.body.snapshots.find((s: any) => s.id === snapshotId);
    expect(found).toBeUndefined();
  });

  it('should return 404 when deleting non-existent snapshot', async () => {
    const fakeId = 'f0000000-0000-0000-0000-000000000099';
    const res = await api.delete(
      `/api/products/${MFG_PRODUCT}/compliance-snapshots/${fakeId}`,
      { auth: mfgToken }
    );
    expect(res.status).toBe(404);
  });
});

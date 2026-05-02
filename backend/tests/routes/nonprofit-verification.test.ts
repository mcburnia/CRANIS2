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
 * Non-Profit Verification — Integration Tests
 *
 * Tests:
 *   POST /api/org/nonprofit-application            — submit
 *   GET  /api/org/nonprofit-application             — check status
 *   GET  /api/admin/nonprofit-applications          — admin list
 *   GET  /api/admin/nonprofit-applications/:id      — admin detail
 *   PUT  /api/admin/nonprofit-applications/:id      — admin review (approve/reject/info)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginTestUser, TEST_USERS, getAppPool } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

const ORG_ID = TEST_IDS.orgs.mfgActive;

let userToken: string;
let adminToken: string;
let applicationId: string;

beforeAll(async () => {
  userToken = await loginTestUser(TEST_USERS.mfgAdmin);
  adminToken = await loginTestUser(TEST_USERS.platformAdmin);

  // Clean any test applications
  const pool = getAppPool();
  await pool.query("DELETE FROM nonprofit_applications WHERE org_id = $1", [ORG_ID]);
  // Reset trust classification
  await pool.query(
    `UPDATE org_billing SET trust_classification = 'commercial', classification_source = 'automatic' WHERE org_id = $1`,
    [ORG_ID]
  );
}, 15000);

afterAll(async () => {
  const pool = getAppPool();
  await pool.query("DELETE FROM nonprofit_applications WHERE org_id = $1", [ORG_ID]);
  await pool.query(
    `UPDATE org_billing SET trust_classification = 'commercial', classification_source = 'automatic' WHERE org_id = $1`,
    [ORG_ID]
  );
}, 10000);

// ─── Auth ────────────────────────────────────────────────────

describe('Auth', () => {
  it('rejects unauthenticated POST', async () => {
    const res = await api.post('/api/org/nonprofit-application', {
      body: { organisation_name: 'Test', country: 'DE', registration_number: '123' },
    });
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated GET', async () => {
    const res = await api.get('/api/org/nonprofit-application');
    expect(res.status).toBe(401);
  });
});

// ─── Submit application ─────────────────────────────────────

describe('POST /api/org/nonprofit-application', () => {
  it('rejects missing organisation name', async () => {
    const res = await api.post('/api/org/nonprofit-application', {
      auth: userToken,
      body: { country: 'DE', registration_number: '123' },
    });
    expect(res.status).toBe(400);
  });

  it('rejects missing country', async () => {
    const res = await api.post('/api/org/nonprofit-application', {
      auth: userToken,
      body: { organisation_name: 'Test Charity', registration_number: '123' },
    });
    expect(res.status).toBe(400);
  });

  it('rejects missing registration number', async () => {
    const res = await api.post('/api/org/nonprofit-application', {
      auth: userToken,
      body: { organisation_name: 'Test Charity', country: 'DE' },
    });
    expect(res.status).toBe(400);
  });

  it('creates an application', async () => {
    const res = await api.post('/api/org/nonprofit-application', {
      auth: userToken,
      body: {
        organisation_name: 'Test Open Source Foundation',
        country: 'DE',
        registration_number: 'VR-12345',
        website: 'https://test-foundation.org',
      },
    });
    expect(res.status).toBe(201);
    expect(res.body.application).toBeTruthy();
    expect(res.body.application.status).toBe('pending');
    expect(res.body.application.organisation_name).toBe('Test Open Source Foundation');
    applicationId = res.body.application.id;
  });

  it('rejects duplicate pending application', async () => {
    const res = await api.post('/api/org/nonprofit-application', {
      auth: userToken,
      body: {
        organisation_name: 'Another Foundation',
        country: 'FR',
        registration_number: 'W-99999',
      },
    });
    expect(res.status).toBe(409);
  });
});

// ─── Check status ───────────────────────────────────────────

describe('GET /api/org/nonprofit-application', () => {
  it('returns current application', async () => {
    const res = await api.get('/api/org/nonprofit-application', { auth: userToken });
    expect(res.status).toBe(200);
    expect(res.body.application).toBeTruthy();
    expect(res.body.application.id).toBe(applicationId);
    expect(res.body.application.status).toBe('pending');
  });
});

// ─── Admin list ─────────────────────────────────────────────

describe('GET /api/admin/nonprofit-applications', () => {
  it('rejects non-admin', async () => {
    const res = await api.get('/api/admin/nonprofit-applications', { auth: userToken });
    expect(res.status).toBe(403);
  });

  it('lists all applications', async () => {
    const res = await api.get('/api/admin/nonprofit-applications', { auth: adminToken });
    expect(res.status).toBe(200);
    expect(res.body.applications.length).toBeGreaterThanOrEqual(1);
    expect(res.body.applications.some((a: any) => a.id === applicationId)).toBe(true);
  });

  it('filters by status', async () => {
    const res = await api.get('/api/admin/nonprofit-applications', { auth: adminToken, query: { status: 'pending' } });
    expect(res.status).toBe(200);
    for (const a of res.body.applications) {
      expect(a.status).toBe('pending');
    }
  });
});

// ─── Admin detail ───────────────────────────────────────────

describe('GET /api/admin/nonprofit-applications/:id', () => {
  it('returns application detail', async () => {
    const res = await api.get(`/api/admin/nonprofit-applications/${applicationId}`, { auth: adminToken });
    expect(res.status).toBe(200);
    expect(res.body.organisation_name).toBe('Test Open Source Foundation');
    expect(res.body.country).toBe('DE');
    expect(res.body.registration_number).toBe('VR-12345');
  });

  it('returns 404 for non-existent', async () => {
    const res = await api.get('/api/admin/nonprofit-applications/00000000-0000-0000-0000-000000000000', { auth: adminToken });
    expect(res.status).toBe(404);
  });
});

// ─── Admin review ───────────────────────────────────────────

describe('PUT /api/admin/nonprofit-applications/:id', () => {
  it('rejects non-admin', async () => {
    const res = await api.put(`/api/admin/nonprofit-applications/${applicationId}`, {
      auth: userToken,
      body: { status: 'approved' },
    });
    expect(res.status).toBe(403);
  });

  it('rejects invalid status', async () => {
    const res = await api.put(`/api/admin/nonprofit-applications/${applicationId}`, {
      auth: adminToken,
      body: { status: 'invalid' },
    });
    expect(res.status).toBe(400);
  });

  it('requests additional information', async () => {
    const res = await api.put(`/api/admin/nonprofit-applications/${applicationId}`, {
      auth: adminToken,
      body: { status: 'info_requested', admin_notes: 'Please provide charity registration certificate' },
    });
    expect(res.status).toBe(200);
    expect(res.body.application.status).toBe('info_requested');
    expect(res.body.application.admin_notes).toContain('certificate');
    expect(res.body.application.reviewed_at).toBeTruthy();
  });

  it('approves the application and sets trust classification', async () => {
    const res = await api.put(`/api/admin/nonprofit-applications/${applicationId}`, {
      auth: adminToken,
      body: { status: 'approved', admin_notes: 'Verified — legitimate charity' },
    });
    expect(res.status).toBe(200);
    expect(res.body.application.status).toBe('approved');

    // Verify trust classification was updated
    const trustRes = await api.get(`/api/admin/orgs/${ORG_ID}/trust`, { auth: adminToken });
    expect(trustRes.status).toBe(200);
    expect(trustRes.body.trust_classification).toBe('verified_nonprofit');
    expect(trustRes.body.classification_source).toBe('manual');
  });

  it('returns 404 for non-existent application', async () => {
    const res = await api.put('/api/admin/nonprofit-applications/00000000-0000-0000-0000-000000000000', {
      auth: adminToken,
      body: { status: 'rejected' },
    });
    expect(res.status).toBe(404);
  });
});

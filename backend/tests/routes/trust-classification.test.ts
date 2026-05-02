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
 * Trust Classification — Integration Tests
 *
 * Tests:
 *   GET  /api/admin/orgs/:orgId/trust            — get classification
 *   POST /api/admin/orgs/:orgId/trust/evaluate    — trigger evaluation
 *   PUT  /api/admin/orgs/:orgId/trust             — manual classification
 *   Service: evaluateOrganisation(), isFreeClassification()
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginTestUser, TEST_USERS, getAppPool } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

const ORG_ID = TEST_IDS.orgs.mfgActive;

let adminToken: string;
let userToken: string;

beforeAll(async () => {
  adminToken = await loginTestUser(TEST_USERS.platformAdmin);
  userToken = await loginTestUser(TEST_USERS.mfgAdmin);

  // Ensure trust columns exist with defaults
  const pool = getAppPool();
  await pool.query(
    `UPDATE org_billing SET trust_classification = 'commercial', trust_score = 0,
     commercial_signal_score = 0, classification_source = 'automatic'
     WHERE org_id = $1`,
    [ORG_ID]
  );
}, 15000);

afterAll(async () => {
  // Reset classification to commercial
  const pool = getAppPool();
  await pool.query(
    `UPDATE org_billing SET trust_classification = 'commercial', trust_score = 0,
     commercial_signal_score = 0, classification_source = 'automatic',
     provisional_expires_at = NULL
     WHERE org_id = $1`,
    [ORG_ID]
  );
}, 10000);

// ─── Auth ────────────────────────────────────────────────────

describe('Auth & access control', () => {
  it('rejects non-admin user from GET trust', async () => {
    const res = await api.get(`/api/admin/orgs/${ORG_ID}/trust`, { auth: userToken });
    expect(res.status).toBe(403);
  });

  it('rejects non-admin user from POST evaluate', async () => {
    const res = await api.post(`/api/admin/orgs/${ORG_ID}/trust/evaluate`, { auth: userToken });
    expect(res.status).toBe(403);
  });

  it('rejects non-admin user from PUT trust', async () => {
    const res = await api.put(`/api/admin/orgs/${ORG_ID}/trust`, {
      auth: userToken,
      body: { classification: 'trusted_open_source', reason: 'test' },
    });
    expect(res.status).toBe(403);
  });
});

// ─── GET trust ──────────────────────────────────────────────

describe('GET /api/admin/orgs/:orgId/trust', () => {
  it('returns current classification', async () => {
    const res = await api.get(`/api/admin/orgs/${ORG_ID}/trust`, { auth: adminToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('trust_classification');
    expect(res.body).toHaveProperty('trust_score');
    expect(res.body).toHaveProperty('commercial_signal_score');
    expect(res.body).toHaveProperty('classification_source');
    expect(res.body.trust_classification).toBe('commercial');
  });

  it('returns 404 for non-existent org', async () => {
    const res = await api.get('/api/admin/orgs/00000000-0000-0000-0000-000000000000/trust', { auth: adminToken });
    expect(res.status).toBe(404);
  });
});

// ─── POST evaluate ──────────────────────────────────────────

describe('POST /api/admin/orgs/:orgId/trust/evaluate', () => {
  it('evaluates and returns classification result', async () => {
    const res = await api.post(`/api/admin/orgs/${ORG_ID}/trust/evaluate`, { auth: adminToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('evaluation');
    expect(res.body.evaluation).toHaveProperty('classification');
    expect(res.body.evaluation).toHaveProperty('trustScore');
    expect(res.body.evaluation).toHaveProperty('commercialSignalScore');
    expect(res.body.evaluation).toHaveProperty('reasons');
    expect(res.body.evaluation).toHaveProperty('repoStats');
    expect(Array.isArray(res.body.evaluation.reasons)).toBe(true);

    // Verify repoStats structure
    const stats = res.body.evaluation.repoStats;
    expect(stats).toHaveProperty('totalRepos');
    expect(stats).toHaveProperty('publicRepos');
    expect(stats).toHaveProperty('privateRepos');
    expect(stats).toHaveProperty('totalStars');
    expect(stats).toHaveProperty('totalForks');
    expect(stats).toHaveProperty('totalContributors');
    expect(stats).toHaveProperty('osiLicenceCount');
  });

  it('persists evaluation result to database', async () => {
    const res = await api.get(`/api/admin/orgs/${ORG_ID}/trust`, { auth: adminToken });
    expect(res.status).toBe(200);
    expect(res.body.classification_last_review).toBeTruthy();
    expect(res.body.classification_source).toBe('automatic');
  });

  it('returns 404 for non-existent org', async () => {
    const res = await api.post('/api/admin/orgs/00000000-0000-0000-0000-000000000000/trust/evaluate', { auth: adminToken });
    expect(res.status).toBe(404);
  });
});

// ─── PUT manual classification ──────────────────────────────

describe('PUT /api/admin/orgs/:orgId/trust', () => {
  it('rejects invalid classification', async () => {
    const res = await api.put(`/api/admin/orgs/${ORG_ID}/trust`, {
      auth: adminToken,
      body: { classification: 'invalid', reason: 'test' },
    });
    expect(res.status).toBe(400);
  });

  it('rejects missing reason', async () => {
    const res = await api.put(`/api/admin/orgs/${ORG_ID}/trust`, {
      auth: adminToken,
      body: { classification: 'trusted_open_source' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Reason');
  });

  it('sets classification manually', async () => {
    const res = await api.put(`/api/admin/orgs/${ORG_ID}/trust`, {
      auth: adminToken,
      body: { classification: 'trusted_open_source', reason: 'Verified by admin — legitimate open-source project' },
    });
    expect(res.status).toBe(200);
    expect(res.body.classification.trust_classification).toBe('trusted_open_source');
    expect(res.body.classification.classification_source).toBe('manual');
  });

  it('can reclassify to commercial', async () => {
    const res = await api.put(`/api/admin/orgs/${ORG_ID}/trust`, {
      auth: adminToken,
      body: { classification: 'commercial', reason: 'Reclassified — commercial usage detected' },
    });
    expect(res.status).toBe(200);
    expect(res.body.classification.trust_classification).toBe('commercial');
  });

  it('can set review_required', async () => {
    const res = await api.put(`/api/admin/orgs/${ORG_ID}/trust`, {
      auth: adminToken,
      body: { classification: 'review_required', reason: 'Needs further review' },
    });
    expect(res.status).toBe(200);
    expect(res.body.classification.trust_classification).toBe('review_required');
  });

  it('returns 404 for non-existent org', async () => {
    const res = await api.put('/api/admin/orgs/00000000-0000-0000-0000-000000000000/trust', {
      auth: adminToken,
      body: { classification: 'commercial', reason: 'test' },
    });
    expect(res.status).toBe(404);
  });
});

// ─── Admin orgs list includes trust data ────────────────────

describe('GET /api/admin/orgs (trust fields)', () => {
  it('returns trust classification in org list', async () => {
    const res = await api.get('/api/admin/orgs', { auth: adminToken });
    expect(res.status).toBe(200);
    const org = res.body.orgs.find((o: any) => o.id === ORG_ID);
    expect(org).toBeTruthy();
    expect(org).toHaveProperty('trustClassification');
    expect(org).toHaveProperty('trustScore');
    expect(org).toHaveProperty('commercialSignalScore');
  });
});

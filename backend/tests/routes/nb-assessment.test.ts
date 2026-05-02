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
 * Notified Body Assessment Tracking — Integration Tests
 *
 * Tests:
 *   GET    /api/products/:productId/nb-assessment  — get assessment
 *   POST   /api/products/:productId/nb-assessment  — create
 *   PUT    /api/products/:productId/nb-assessment   — update
 *   DELETE /api/products/:productId/nb-assessment   — delete
 *
 * Also tests obligation engine wiring (art_32_3 derivation).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginTestUser, TEST_USERS, getAppPool } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

// important_ii product — requires notified body (Module B+C)
const PRODUCT_ID = TEST_IDS.products.codeberg;
const ORG_ID = TEST_IDS.orgs.mfgActive;

let token: string;
let notifiedBodyId: string;

beforeAll(async () => {
  token = await loginTestUser(TEST_USERS.mfgAdmin);

  // Clean stale assessments
  const pool = getAppPool();
  await pool.query('DELETE FROM notified_body_assessments WHERE product_id = $1 AND org_id = $2', [PRODUCT_ID, ORG_ID]);

  // Get a notified body ID for testing
  const bodies = await pool.query('SELECT id FROM notified_bodies LIMIT 1');
  if (bodies.rows.length > 0) {
    notifiedBodyId = bodies.rows[0].id;
  }
}, 15000);

afterAll(async () => {
  const pool = getAppPool();
  await pool.query('DELETE FROM notified_body_assessments WHERE product_id = $1 AND org_id = $2', [PRODUCT_ID, ORG_ID]);
}, 10000);

// ─── Auth ────────────────────────────────────────────────────

describe('Auth & access control', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/nb-assessment`);
    expect(res.status).toBe(401);
  });

  it('rejects access to products in another org', async () => {
    const impToken = await loginTestUser(TEST_USERS.impAdmin);
    const res = await api.get(`/api/products/${PRODUCT_ID}/nb-assessment`, { auth: impToken });
    expect(res.status).toBe(404);
  });
});

// ─── GET (empty state) ──────────────────────────────────────

describe('GET (no assessment)', () => {
  it('returns null assessment when none exists', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/nb-assessment`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.assessment).toBeNull();
  });
});

// ─── POST ───────────────────────────────────────────────────

describe('POST (create assessment)', () => {
  it('rejects missing module', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/nb-assessment`, {
      auth: token,
      body: {},
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Module');
  });

  it('rejects invalid module', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/nb-assessment`, {
      auth: token,
      body: { module: 'Z' },
    });
    expect(res.status).toBe(400);
  });

  it('rejects invalid status', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/nb-assessment`, {
      auth: token,
      body: { module: 'B', status: 'invalid' },
    });
    expect(res.status).toBe(400);
  });

  it('creates an assessment with module only', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/nb-assessment`, {
      auth: token,
      body: { module: 'B' },
    });
    expect(res.status).toBe(201);
    expect(res.body.assessment).toBeTruthy();
    expect(res.body.assessment.module).toBe('B');
    expect(res.body.assessment.status).toBe('planning');
    expect(res.body.assessment.product_id).toBe(PRODUCT_ID);
  });

  it('rejects duplicate assessment', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/nb-assessment`, {
      auth: token,
      body: { module: 'H' },
    });
    expect(res.status).toBe(409);
  });
});

// ─── GET (with assessment) ──────────────────────────────────

describe('GET (with assessment)', () => {
  it('returns the assessment with body details when set', async () => {
    // First link a notified body
    if (notifiedBodyId) {
      await api.put(`/api/products/${PRODUCT_ID}/nb-assessment`, {
        auth: token,
        body: { notified_body_id: notifiedBodyId },
      });
    }

    const res = await api.get(`/api/products/${PRODUCT_ID}/nb-assessment`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.assessment).toBeTruthy();
    expect(res.body.assessment.module).toBe('B');
    if (notifiedBodyId) {
      expect(res.body.assessment.body_name).toBeTruthy();
      expect(res.body.assessment.body_country).toBeTruthy();
    }
  });
});

// ─── PUT ────────────────────────────────────────────────────

describe('PUT (update assessment)', () => {
  it('updates status', async () => {
    const res = await api.put(`/api/products/${PRODUCT_ID}/nb-assessment`, {
      auth: token,
      body: { status: 'submitted', submitted_date: '2026-03-14' },
    });
    expect(res.status).toBe(200);
    expect(res.body.assessment.status).toBe('submitted');
    expect(res.body.assessment.submitted_date).toContain('2026-03-14');
  });

  it('updates to approved with certificate', async () => {
    const res = await api.put(`/api/products/${PRODUCT_ID}/nb-assessment`, {
      auth: token,
      body: {
        status: 'approved',
        certificate_number: 'EU-TC-2026-0042',
        certificate_expiry: '2031-03-14',
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.assessment.status).toBe('approved');
    expect(res.body.assessment.certificate_number).toBe('EU-TC-2026-0042');
  });

  it('rejects invalid status', async () => {
    const res = await api.put(`/api/products/${PRODUCT_ID}/nb-assessment`, {
      auth: token,
      body: { status: 'bogus' },
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 for product without assessment', async () => {
    const githubProduct = TEST_IDS.products.github;
    const res = await api.put(`/api/products/${githubProduct}/nb-assessment`, {
      auth: token,
      body: { status: 'submitted' },
    });
    expect(res.status).toBe(404);
  });
});

// ─── Obligation engine wiring ───────────────────────────────

describe('Obligation engine (art_32_3)', () => {
  it('derives art_32_3 as met when assessment is approved', async () => {
    // Assessment is currently 'approved' from prior test
    const res = await api.get(`/api/obligations/${PRODUCT_ID}`, { auth: token });
    expect(res.status).toBe(200);

    const art323 = res.body.obligations?.find((o: any) => o.obligationKey === 'art_32_3');
    if (art323) {
      expect(art323.derivedStatus).toBe('met');
      expect(art323.derivedReason).toContain('approved');
    }
  });

  it('derives art_32_3 as in_progress when assessment is under_review', async () => {
    await api.put(`/api/products/${PRODUCT_ID}/nb-assessment`, {
      auth: token,
      body: { status: 'under_review' },
    });

    const res = await api.get(`/api/obligations/${PRODUCT_ID}`, { auth: token });
    expect(res.status).toBe(200);

    const art323 = res.body.obligations?.find((o: any) => o.obligationKey === 'art_32_3');
    if (art323) {
      expect(art323.derivedStatus).toBe('in_progress');
    }
  });
});

// ─── DELETE ─────────────────────────────────────────────────

describe('DELETE (remove assessment)', () => {
  it('deletes the assessment', async () => {
    const res = await api.delete(`/api/products/${PRODUCT_ID}/nb-assessment`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
  });

  it('returns 404 when already deleted', async () => {
    const res = await api.delete(`/api/products/${PRODUCT_ID}/nb-assessment`, { auth: token });
    expect(res.status).toBe(404);
  });

  it('GET returns null after deletion', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/nb-assessment`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.assessment).toBeNull();
  });
});

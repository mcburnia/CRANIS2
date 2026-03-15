/**
 * Market Surveillance Registration Tracking — Integration Tests
 *
 * Tests:
 *   GET    /api/products/:productId/ms-registration  — get registration
 *   POST   /api/products/:productId/ms-registration  — create
 *   PUT    /api/products/:productId/ms-registration   — update
 *   DELETE /api/products/:productId/ms-registration   — delete
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginTestUser, TEST_USERS, getAppPool } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

// Use codeberg product (important_ii) for CRUD tests —
// category enforcement is in the obligation engine, not the registration API
const PRODUCT_ID = TEST_IDS.products.codeberg;
const ORG_ID = TEST_IDS.orgs.mfgActive;

let token: string;
let authorityId: string;

beforeAll(async () => {
  token = await loginTestUser(TEST_USERS.mfgAdmin);

  // Clean stale registrations
  const pool = getAppPool();
  await pool.query('DELETE FROM market_surveillance_registrations WHERE product_id = $1 AND org_id = $2', [PRODUCT_ID, ORG_ID]);

  // Get an authority ID for testing
  const authorities = await pool.query('SELECT id FROM market_surveillance_authorities LIMIT 1');
  if (authorities.rows.length > 0) {
    authorityId = authorities.rows[0].id;
  }
}, 15000);

afterAll(async () => {
  const pool = getAppPool();
  await pool.query('DELETE FROM market_surveillance_registrations WHERE product_id = $1 AND org_id = $2', [PRODUCT_ID, ORG_ID]);
}, 10000);

// ─── Auth ────────────────────────────────────────────────────

describe('Auth & access control', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/ms-registration`);
    expect(res.status).toBe(401);
  });

  it('rejects access to products in another org', async () => {
    const impToken = await loginTestUser(TEST_USERS.impAdmin);
    const res = await api.get(`/api/products/${PRODUCT_ID}/ms-registration`, { auth: impToken });
    expect(res.status).toBe(404);
  });
});

// ─── GET (empty state) ──────────────────────────────────────

describe('GET (no registration)', () => {
  it('returns null registration when none exists', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/ms-registration`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.registration).toBeNull();
  });
});

// ─── POST ───────────────────────────────────────────────────

describe('POST (create registration)', () => {
  it('rejects invalid status', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/ms-registration`, {
      auth: token,
      body: { status: 'invalid' },
    });
    expect(res.status).toBe(400);
  });

  it('rejects invalid authority_id', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/ms-registration`, {
      auth: token,
      body: { authority_id: '00000000-0000-0000-0000-000000000000' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('not found');
  });

  it('creates a registration with defaults', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/ms-registration`, {
      auth: token,
      body: {
        authority_name: 'BNetzA',
        authority_country: 'DE',
        notes: 'Initial registration tracking',
      },
    });
    expect(res.status).toBe(201);
    expect(res.body.registration).toBeTruthy();
    expect(res.body.registration.status).toBe('planning');
    expect(res.body.registration.product_id).toBe(PRODUCT_ID);
    expect(res.body.registration.authority_name).toBe('BNetzA');
  });

  it('rejects duplicate registration', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/ms-registration`, {
      auth: token,
      body: { authority_name: 'ANSSI' },
    });
    expect(res.status).toBe(409);
  });
});

// ─── GET (with registration) ────────────────────────────────

describe('GET (with registration)', () => {
  it('returns the registration with authority details when linked', async () => {
    // Link an authority from the directory
    if (authorityId) {
      await api.put(`/api/products/${PRODUCT_ID}/ms-registration`, {
        auth: token,
        body: { authority_id: authorityId },
      });
    }

    const res = await api.get(`/api/products/${PRODUCT_ID}/ms-registration`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.registration).toBeTruthy();
    expect(res.body.registration.authority_name).toBe('BNetzA');
    if (authorityId) {
      expect(res.body.registration.msa_name).toBeTruthy();
      expect(res.body.registration.msa_country).toBeTruthy();
    }
  });
});

// ─── PUT ────────────────────────────────────────────────────

describe('PUT (update registration)', () => {
  it('updates status to submitted', async () => {
    const res = await api.put(`/api/products/${PRODUCT_ID}/ms-registration`, {
      auth: token,
      body: { status: 'submitted', submission_date: '2026-03-15' },
    });
    expect(res.status).toBe(200);
    expect(res.body.registration.status).toBe('submitted');
    expect(res.body.registration.submission_date).toContain('2026-03-15');
  });

  it('updates to registered with registration number', async () => {
    const res = await api.put(`/api/products/${PRODUCT_ID}/ms-registration`, {
      auth: token,
      body: {
        status: 'registered',
        registration_number: 'MS-EU-2026-0042',
        registration_date: '2026-03-20',
        renewal_date: '2027-03-20',
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.registration.status).toBe('registered');
    expect(res.body.registration.registration_number).toBe('MS-EU-2026-0042');
  });

  it('rejects invalid status', async () => {
    const res = await api.put(`/api/products/${PRODUCT_ID}/ms-registration`, {
      auth: token,
      body: { status: 'bogus' },
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 for product without registration', async () => {
    const githubProduct = TEST_IDS.products.github;
    const res = await api.put(`/api/products/${githubProduct}/ms-registration`, {
      auth: token,
      body: { status: 'submitted' },
    });
    expect(res.status).toBe(404);
  });
});

// ─── DELETE ─────────────────────────────────────────────────

describe('DELETE (remove registration)', () => {
  it('deletes the registration', async () => {
    const res = await api.delete(`/api/products/${PRODUCT_ID}/ms-registration`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
  });

  it('returns 404 when already deleted', async () => {
    const res = await api.delete(`/api/products/${PRODUCT_ID}/ms-registration`, { auth: token });
    expect(res.status).toBe(404);
  });

  it('GET returns null after deletion', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/ms-registration`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.registration).toBeNull();
  });
});

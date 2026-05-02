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
 * Market Surveillance Authorities Directory — Integration Tests
 *
 * Tests:
 *   GET    /api/market-surveillance-authorities              — public list/search/filter
 *   GET    /api/market-surveillance-authorities/countries     — public country summary
 *   GET    /api/market-surveillance-authorities/:id           — public single detail
 *   POST   /api/admin/market-surveillance-authorities         — admin create
 *   PUT    /api/admin/market-surveillance-authorities/:id     — admin update
 *   DELETE /api/admin/market-surveillance-authorities/:id     — admin delete
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginTestUser, TEST_USERS, getAppPool } from '../setup/test-helpers.js';

let adminToken: string;
let userToken: string;
let createdAuthorityId: string;

beforeAll(async () => {
  adminToken = await loginTestUser(TEST_USERS.platformAdmin);
  userToken = await loginTestUser(TEST_USERS.mfgAdmin);

  // Clean any test-created authorities from prior runs
  const pool = getAppPool();
  await pool.query("DELETE FROM market_surveillance_authorities WHERE name LIKE 'Test Authority%'");
}, 15000);

afterAll(async () => {
  const pool = getAppPool();
  await pool.query("DELETE FROM market_surveillance_authorities WHERE name LIKE 'Test Authority%'");
}, 10000);

// ─── Public endpoints ─────────────────────────────────────────

describe('GET /api/market-surveillance-authorities (public list)', () => {
  it('returns a list of authorities without authentication', async () => {
    const res = await api.get('/api/market-surveillance-authorities');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('authorities');
    expect(res.body).toHaveProperty('total');
    expect(Array.isArray(res.body.authorities)).toBe(true);
  });

  it('returns seeded authorities with expected fields', async () => {
    const res = await api.get('/api/market-surveillance-authorities');
    expect(res.status).toBe(200);
    if (res.body.total > 0) {
      const authority = res.body.authorities[0];
      expect(authority).toHaveProperty('id');
      expect(authority).toHaveProperty('name');
      expect(authority).toHaveProperty('country');
      expect(authority).toHaveProperty('competence_areas');
      expect(authority).toHaveProperty('cra_designated');
    }
  });

  it('filters by country', async () => {
    const res = await api.get('/api/market-surveillance-authorities', { query: { country: 'DE' } });
    expect(res.status).toBe(200);
    for (const authority of res.body.authorities) {
      expect(authority.country).toBe('DE');
    }
  });

  it('filters by competence area', async () => {
    const res = await api.get('/api/market-surveillance-authorities', { query: { competence_area: 'cybersecurity' } });
    expect(res.status).toBe(200);
    for (const authority of res.body.authorities) {
      expect(authority.competence_areas).toContain('cybersecurity');
    }
  });

  it('filters by CRA designation', async () => {
    const res = await api.get('/api/market-surveillance-authorities', { query: { cra_designated: 'true' } });
    expect(res.status).toBe(200);
    for (const authority of res.body.authorities) {
      expect(authority.cra_designated).toBe(true);
    }
  });

  it('filters by search term', async () => {
    const res = await api.get('/api/market-surveillance-authorities', { query: { search: 'BSI' } });
    expect(res.status).toBe(200);
    for (const authority of res.body.authorities) {
      expect(authority.name.toLowerCase()).toContain('bsi');
    }
  });

  it('returns empty array for non-matching filter', async () => {
    const res = await api.get('/api/market-surveillance-authorities', { query: { country: 'XX' } });
    expect(res.status).toBe(200);
    expect(res.body.authorities).toHaveLength(0);
  });
});

describe('GET /api/market-surveillance-authorities/countries', () => {
  it('returns country summary', async () => {
    const res = await api.get('/api/market-surveillance-authorities/countries');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('countries');
    expect(Array.isArray(res.body.countries)).toBe(true);
    if (res.body.countries.length > 0) {
      expect(res.body.countries[0]).toHaveProperty('country');
      expect(res.body.countries[0]).toHaveProperty('count');
    }
  });
});

describe('GET /api/market-surveillance-authorities/:id', () => {
  it('returns a single authority', async () => {
    // Get an ID from the list first
    const list = await api.get('/api/market-surveillance-authorities');
    if (list.body.total > 0) {
      const id = list.body.authorities[0].id;
      const res = await api.get(`/api/market-surveillance-authorities/${id}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('country');
    }
  });

  it('returns 404 for non-existent ID', async () => {
    const res = await api.get('/api/market-surveillance-authorities/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});

// ─── Admin endpoints ──────────────────────────────────────────

describe('POST /api/admin/market-surveillance-authorities', () => {
  it('rejects non-admin users', async () => {
    const res = await api.post('/api/admin/market-surveillance-authorities', {
      auth: userToken,
      body: { name: 'Test Authority Rejected', country: 'DE' },
    });
    expect(res.status).toBe(403);
  });

  it('rejects missing name', async () => {
    const res = await api.post('/api/admin/market-surveillance-authorities', {
      auth: adminToken,
      body: { country: 'DE' },
    });
    expect(res.status).toBe(400);
  });

  it('rejects invalid country', async () => {
    const res = await api.post('/api/admin/market-surveillance-authorities', {
      auth: adminToken,
      body: { name: 'Test Authority Invalid', country: 'XX' },
    });
    expect(res.status).toBe(400);
  });

  it('rejects non-array competence_areas', async () => {
    const res = await api.post('/api/admin/market-surveillance-authorities', {
      auth: adminToken,
      body: { name: 'Test Authority Bad', country: 'DE', competence_areas: 'not-an-array' },
    });
    expect(res.status).toBe(400);
  });

  it('creates a market surveillance authority', async () => {
    const res = await api.post('/api/admin/market-surveillance-authorities', {
      auth: adminToken,
      body: {
        name: 'Test Authority Alpha',
        country: 'LU',
        website: 'https://test.lu',
        email: 'test@test.lu',
        phone: '+352 123 456',
        address: 'Luxembourg City',
        competence_areas: ['cybersecurity', 'iot'],
        cra_designated: true,
        contact_portal_url: 'https://portal.test.lu',
        notes: 'Test entry',
      },
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test Authority Alpha');
    expect(res.body.country).toBe('LU');
    expect(res.body.cra_designated).toBe(true);
    expect(res.body.competence_areas).toContain('cybersecurity');
    createdAuthorityId = res.body.id;
  });
});

describe('PUT /api/admin/market-surveillance-authorities/:id', () => {
  it('rejects non-admin users', async () => {
    const res = await api.put(`/api/admin/market-surveillance-authorities/${createdAuthorityId}`, {
      auth: userToken,
      body: { name: 'Updated' },
    });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent ID', async () => {
    const res = await api.put('/api/admin/market-surveillance-authorities/00000000-0000-0000-0000-000000000000', {
      auth: adminToken,
      body: { name: 'Ghost' },
    });
    expect(res.status).toBe(404);
  });

  it('rejects invalid country', async () => {
    const res = await api.put(`/api/admin/market-surveillance-authorities/${createdAuthorityId}`, {
      auth: adminToken,
      body: { country: 'XX' },
    });
    expect(res.status).toBe(400);
  });

  it('updates authority fields', async () => {
    const res = await api.put(`/api/admin/market-surveillance-authorities/${createdAuthorityId}`, {
      auth: adminToken,
      body: {
        name: 'Test Authority Alpha Updated',
        cra_designated: false,
        notes: 'Updated notes',
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Test Authority Alpha Updated');
    expect(res.body.cra_designated).toBe(false);
    expect(res.body.notes).toBe('Updated notes');
  });
});

describe('DELETE /api/admin/market-surveillance-authorities/:id', () => {
  it('rejects non-admin users', async () => {
    const res = await api.delete(`/api/admin/market-surveillance-authorities/${createdAuthorityId}`, {
      auth: userToken,
    });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent ID', async () => {
    const res = await api.delete('/api/admin/market-surveillance-authorities/00000000-0000-0000-0000-000000000000', {
      auth: adminToken,
    });
    expect(res.status).toBe(404);
  });

  it('deletes the authority', async () => {
    const res = await api.delete(`/api/admin/market-surveillance-authorities/${createdAuthorityId}`, {
      auth: adminToken,
    });
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
  });

  it('confirms deletion via GET', async () => {
    const res = await api.get(`/api/market-surveillance-authorities/${createdAuthorityId}`);
    expect(res.status).toBe(404);
  });
});

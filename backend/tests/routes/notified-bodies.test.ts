/**
 * Notified Bodies Directory — Integration Tests
 *
 * Tests:
 *   GET    /api/notified-bodies              — public list/search/filter
 *   GET    /api/notified-bodies/countries     — public country summary
 *   GET    /api/notified-bodies/:id           — public single detail
 *   POST   /api/admin/notified-bodies         — admin create
 *   PUT    /api/admin/notified-bodies/:id     — admin update
 *   DELETE /api/admin/notified-bodies/:id     — admin delete
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginTestUser, TEST_USERS, getAppPool } from '../setup/test-helpers.js';

let adminToken: string;
let userToken: string;
let createdBodyId: string;

beforeAll(async () => {
  adminToken = await loginTestUser(TEST_USERS.platformAdmin);
  userToken = await loginTestUser(TEST_USERS.mfgAdmin);

  // Clean any test-created bodies from prior runs
  const pool = getAppPool();
  await pool.query("DELETE FROM notified_bodies WHERE name LIKE 'Test Body%'");
}, 15000);

afterAll(async () => {
  const pool = getAppPool();
  await pool.query("DELETE FROM notified_bodies WHERE name LIKE 'Test Body%'");
}, 10000);

// ─── Public endpoints ─────────────────────────────────────────

describe('GET /api/notified-bodies (public list)', () => {
  it('returns a list of notified bodies without authentication', async () => {
    const res = await api.get('/api/notified-bodies');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('bodies');
    expect(res.body).toHaveProperty('total');
    expect(Array.isArray(res.body.bodies)).toBe(true);
  });

  it('returns seeded bodies with expected fields', async () => {
    const res = await api.get('/api/notified-bodies');
    expect(res.status).toBe(200);
    if (res.body.total > 0) {
      const body = res.body.bodies[0];
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('name');
      expect(body).toHaveProperty('country');
      expect(body).toHaveProperty('cra_modules');
      expect(body).toHaveProperty('sectors');
      expect(body).toHaveProperty('accreditation_status');
    }
  });

  it('filters by country', async () => {
    const res = await api.get('/api/notified-bodies', { query: { country: 'DE' } });
    expect(res.status).toBe(200);
    for (const body of res.body.bodies) {
      expect(body.country).toBe('DE');
    }
  });

  it('filters by CRA module', async () => {
    const res = await api.get('/api/notified-bodies', { query: { module: 'H' } });
    expect(res.status).toBe(200);
    for (const body of res.body.bodies) {
      expect(body.cra_modules).toContain('H');
    }
  });

  it('filters by sector', async () => {
    const res = await api.get('/api/notified-bodies', { query: { sector: 'iot' } });
    expect(res.status).toBe(200);
    for (const body of res.body.bodies) {
      expect(body.sectors).toContain('iot');
    }
  });

  it('filters by search term', async () => {
    const res = await api.get('/api/notified-bodies', { query: { search: 'BSI' } });
    expect(res.status).toBe(200);
    // Should find at least BSI if seeded
    if (res.body.total > 0) {
      const names = res.body.bodies.map((b: any) => b.name.toLowerCase());
      expect(names.some((n: string) => n.includes('bsi'))).toBe(true);
    }
  });

  it('supports multiple filters simultaneously', async () => {
    const res = await api.get('/api/notified-bodies', {
      query: { country: 'DE', module: 'B' },
    });
    expect(res.status).toBe(200);
    for (const body of res.body.bodies) {
      expect(body.country).toBe('DE');
      expect(body.cra_modules).toContain('B');
    }
  });
});

describe('GET /api/notified-bodies/countries', () => {
  it('returns country list without authentication', async () => {
    const res = await api.get('/api/notified-bodies/countries');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('countries');
    expect(Array.isArray(res.body.countries)).toBe(true);
    if (res.body.countries.length > 0) {
      expect(res.body.countries[0]).toHaveProperty('country');
      expect(res.body.countries[0]).toHaveProperty('count');
    }
  });
});

describe('GET /api/notified-bodies/:id', () => {
  it('returns 404 for non-existent body', async () => {
    const res = await api.get('/api/notified-bodies/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('returns a single body by ID', async () => {
    // First get a valid ID from the list
    const listRes = await api.get('/api/notified-bodies');
    if (listRes.body.total === 0) return; // skip if no bodies seeded

    const id = listRes.body.bodies[0].id;
    const res = await api.get(`/api/notified-bodies/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body).toHaveProperty('name');
    expect(res.body).toHaveProperty('country');
  });
});

// ─── Admin endpoints ──────────────────────────────────────────

describe('POST /api/admin/notified-bodies (admin create)', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await api.post('/api/admin/notified-bodies', {
      body: { name: 'Test Body Unauth', country: 'DE' },
    });
    expect(res.status).toBe(401);
  });

  it('rejects non-admin users', async () => {
    const res = await api.post('/api/admin/notified-bodies', {
      auth: userToken,
      body: { name: 'Test Body NonAdmin', country: 'DE' },
    });
    expect(res.status).toBe(403);
  });

  it('rejects missing name', async () => {
    const res = await api.post('/api/admin/notified-bodies', {
      auth: adminToken,
      body: { country: 'DE' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Name');
  });

  it('rejects invalid country code', async () => {
    const res = await api.post('/api/admin/notified-bodies', {
      auth: adminToken,
      body: { name: 'Test Body InvalidCountry', country: 'XX' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Country');
  });

  it('rejects invalid CRA modules', async () => {
    const res = await api.post('/api/admin/notified-bodies', {
      auth: adminToken,
      body: { name: 'Test Body InvalidMod', country: 'DE', cra_modules: ['Z'] },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid modules');
  });

  it('creates a notified body with all fields', async () => {
    const res = await api.post('/api/admin/notified-bodies', {
      auth: adminToken,
      body: {
        name: 'Test Body Full',
        country: 'DE',
        nando_number: 'NB-9999',
        website: 'https://example.com',
        email: 'test@example.com',
        phone: '+49 123 456',
        address: '123 Test Street, Berlin',
        cra_modules: ['B', 'C'],
        sectors: ['iot', 'networking'],
        accreditation_status: 'active',
        accreditation_date: '2025-01-15',
        notes: 'Test entry',
      },
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test Body Full');
    expect(res.body.country).toBe('DE');
    expect(res.body.nando_number).toBe('NB-9999');
    expect(res.body.cra_modules).toEqual(['B', 'C']);
    expect(res.body.sectors).toEqual(['iot', 'networking']);
    expect(res.body.accreditation_status).toBe('active');
    createdBodyId = res.body.id;
  });

  it('creates with minimal fields (name + country only)', async () => {
    const res = await api.post('/api/admin/notified-bodies', {
      auth: adminToken,
      body: { name: 'Test Body Minimal', country: 'FR' },
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test Body Minimal');
    expect(res.body.country).toBe('FR');
    expect(res.body.cra_modules).toEqual([]);
    expect(res.body.accreditation_status).toBe('active');
  });

  it('normalises country code to uppercase', async () => {
    const res = await api.post('/api/admin/notified-bodies', {
      auth: adminToken,
      body: { name: 'Test Body Lowercase', country: 'nl' },
    });
    expect(res.status).toBe(201);
    expect(res.body.country).toBe('NL');
  });
});

describe('PUT /api/admin/notified-bodies/:id (admin update)', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await api.put(`/api/admin/notified-bodies/${createdBodyId}`, {
      body: { name: 'Updated' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent body', async () => {
    const res = await api.put('/api/admin/notified-bodies/00000000-0000-0000-0000-000000000000', {
      auth: adminToken,
      body: { name: 'Ghost' },
    });
    expect(res.status).toBe(404);
  });

  it('updates name and status', async () => {
    const res = await api.put(`/api/admin/notified-bodies/${createdBodyId}`, {
      auth: adminToken,
      body: {
        name: 'Test Body Updated',
        accreditation_status: 'suspended',
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Test Body Updated');
    expect(res.body.accreditation_status).toBe('suspended');
  });

  it('updates CRA modules', async () => {
    const res = await api.put(`/api/admin/notified-bodies/${createdBodyId}`, {
      auth: adminToken,
      body: { cra_modules: ['B', 'C', 'H'] },
    });
    expect(res.status).toBe(200);
    expect(res.body.cra_modules).toEqual(['B', 'C', 'H']);
  });

  it('rejects invalid status', async () => {
    const res = await api.put(`/api/admin/notified-bodies/${createdBodyId}`, {
      auth: adminToken,
      body: { accreditation_status: 'invalid' },
    });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/admin/notified-bodies/:id (admin delete)', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await api.delete(`/api/admin/notified-bodies/${createdBodyId}`);
    expect(res.status).toBe(401);
  });

  it('rejects non-admin users', async () => {
    const res = await api.delete(`/api/admin/notified-bodies/${createdBodyId}`, {
      auth: userToken,
    });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent body', async () => {
    const res = await api.delete('/api/admin/notified-bodies/00000000-0000-0000-0000-000000000000', {
      auth: adminToken,
    });
    expect(res.status).toBe(404);
  });

  it('deletes an existing body', async () => {
    const res = await api.delete(`/api/admin/notified-bodies/${createdBodyId}`, {
      auth: adminToken,
    });
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);

    // Verify it is gone
    const getRes = await api.get(`/api/notified-bodies/${createdBodyId}`);
    expect(getRes.status).toBe(404);
  });
});

// ─── Seed data verification ──────────────────────────────────

describe('Seed data', () => {
  it('has seeded notified bodies from multiple countries', async () => {
    const res = await api.get('/api/notified-bodies/countries');
    expect(res.status).toBe(200);
    // Seed includes DE, FR, NL, ES, IT, SE, FI, AT, PL, DK, CZ, NO
    expect(res.body.countries.length).toBeGreaterThanOrEqual(5);
  });

  it('all seeded bodies have valid CRA modules', async () => {
    const res = await api.get('/api/notified-bodies');
    expect(res.status).toBe(200);
    const validModules = ['B', 'C', 'H'];
    for (const body of res.body.bodies) {
      for (const mod of body.cra_modules) {
        expect(validModules).toContain(mod);
      }
    }
  });
});

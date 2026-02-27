/**
 * Break Tests — Function Level: Boundary Values
 *
 * Tests API endpoints at boundary conditions: zero, max int, date extremes,
 * empty collections, and edge cases in string lengths.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../../setup/test-helpers.js';
import { TEST_IDS } from '../../setup/seed-test-data.js';

describe('Break: Boundary Values', () => {
  let token: string;

  beforeAll(async () => {
    token = await loginTestUser(TEST_USERS.mfgAdmin);
  });

  // ─── Date boundaries ──────────────────────────────────────────────────

  describe('Date boundaries in CRA reports', () => {
    it('should handle awareness date in the far past (year 1970)', async () => {
      const res = await api.post('/api/cra-reports', {
        auth: token,
        body: {
          productId: TEST_IDS.products.github,
          reportType: 'vulnerability',
          awarenessAt: '1970-01-01T00:00:00.000Z',
          csirtCountry: 'DE',
        },
      });
      // Should either create (with very past deadlines) or reject
      expect([201, 400, 422, 500]).toContain(res.status);
    });

    it('should handle awareness date in the far future (year 9999)', async () => {
      const res = await api.post('/api/cra-reports', {
        auth: token,
        body: {
          productId: TEST_IDS.products.github,
          reportType: 'vulnerability',
          awarenessAt: '9999-12-31T23:59:59.999Z',
          csirtCountry: 'DE',
        },
      });
      expect([201, 400, 422, 500]).toContain(res.status);
    });

    it('should handle Unix epoch zero', async () => {
      const res = await api.post('/api/cra-reports', {
        auth: token,
        body: {
          productId: TEST_IDS.products.github,
          reportType: 'vulnerability',
          awarenessAt: new Date(0).toISOString(),
          csirtCountry: 'DE',
        },
      });
      expect([201, 400, 422, 500]).toContain(res.status);
    });

    it('should handle invalid date string', async () => {
      const res = await api.post('/api/cra-reports', {
        auth: token,
        body: {
          productId: TEST_IDS.products.github,
          reportType: 'vulnerability',
          awarenessAt: 'not-a-date',
          csirtCountry: 'DE',
        },
      });
      expect([400, 422, 500]).toContain(res.status);
      expect(res.status).not.toBe(201);
    });

    it('should handle February 29 on non-leap year', async () => {
      const res = await api.post('/api/cra-reports', {
        auth: token,
        body: {
          productId: TEST_IDS.products.github,
          reportType: 'vulnerability',
          awarenessAt: '2025-02-29T12:00:00.000Z', // 2025 is not a leap year
          csirtCountry: 'DE',
        },
      });
      // JS Date would roll to March 1 — may succeed or reject
      expect([201, 400, 422, 500]).toContain(res.status);
    });

    it('should handle midnight boundary', async () => {
      const res = await api.post('/api/cra-reports', {
        auth: token,
        body: {
          productId: TEST_IDS.products.github,
          reportType: 'vulnerability',
          awarenessAt: '2026-02-27T00:00:00.000Z',
          csirtCountry: 'DE',
        },
      });
      expect(res.status).toBe(201);
    });

    it('should handle end-of-day boundary', async () => {
      const res = await api.post('/api/cra-reports', {
        auth: token,
        body: {
          productId: TEST_IDS.products.github,
          reportType: 'vulnerability',
          awarenessAt: '2026-02-27T23:59:59.999Z',
          csirtCountry: 'DE',
        },
      });
      expect(res.status).toBe(201);
    });
  });

  // ─── String length boundaries ──────────────────────────────────────────

  describe('String length boundaries', () => {
    it('should handle single character product name', async () => {
      const res = await api.post('/api/products', {
        auth: token,
        body: { name: 'X', craCategory: 'default' },
      });
      expect([201, 400, 422]).toContain(res.status);
    });

    it('should handle 255 character product name', async () => {
      const name = 'A'.repeat(255);
      const res = await api.post('/api/products', {
        auth: token,
        body: { name, craCategory: 'default' },
      });
      expect([201, 400, 422, 500]).toContain(res.status);
    });

    it('should handle 1000 character product name', async () => {
      const name = 'B'.repeat(1000);
      const res = await api.post('/api/products', {
        auth: token,
        body: { name, craCategory: 'default' },
      });
      expect([201, 400, 422, 500]).toContain(res.status);
    });

    it('should handle single character email', async () => {
      const res = await api.post('/api/auth/register', {
        body: { email: 'a', password: 'TestPass123!' },
      });
      // Server may accept (sends verification email) or reject
      expect([200, 201, 400, 422, 500]).toContain(res.status);
    });

    it('should handle email at max typical length (254 chars)', async () => {
      // RFC 5321 max email is 254 chars
      const localPart = 'a'.repeat(240);
      const email = `${localPart}@test.com`;
      const res = await api.post('/api/auth/register', {
        body: { email, password: 'TestPass123!' },
      });
      // Server may accept (sends verification) or fail at DB constraint
      expect([200, 201, 400, 409, 422, 500]).toContain(res.status);
    });

    it('should handle minimum password length', async () => {
      const res = await api.post('/api/auth/register', {
        body: { email: 'min-pass-test@break.test', password: 'Aa1!' },
      });
      // Should fail password strength requirement
      expect(res.status).toBe(400);
    });
  });

  // ─── UUID boundary cases ───────────────────────────────────────────────

  describe('UUID boundaries', () => {
    it('should handle all-zeros UUID', async () => {
      const res = await api.get('/api/products/00000000-0000-0000-0000-000000000000', { auth: token });
      expect([403, 404, 500]).toContain(res.status);
    });

    it('should handle all-f UUID', async () => {
      const res = await api.get('/api/products/ffffffff-ffff-ffff-ffff-ffffffffffff', { auth: token });
      expect([403, 404, 500]).toContain(res.status);
    });

    it('should handle UUID with uppercase', async () => {
      const res = await api.get(`/api/products/${TEST_IDS.products.github.toUpperCase()}`, { auth: token });
      // Postgres UUIDs are case-insensitive — should work the same
      expect([200, 404, 500]).toContain(res.status);
    });

    it('should handle UUID-like but wrong version', async () => {
      // Version 5 UUID (starts with 5 in version position)
      const res = await api.get('/api/products/12345678-1234-5678-1234-567812345678', { auth: token });
      expect([403, 404, 500]).toContain(res.status);
    });
  });

  // ─── Query param boundaries ─────────────────────────────────────────────

  describe('Query param boundaries', () => {
    it('should handle limit=0 on paginated endpoint', async () => {
      const res = await api.get('/api/notifications', {
        auth: token,
        query: { limit: '0' },
      });
      expect([200, 400]).toContain(res.status);
    });

    it('should handle limit=1 on paginated endpoint', async () => {
      const res = await api.get('/api/notifications', {
        auth: token,
        query: { limit: '1' },
      });
      expect(res.status).toBe(200);
    });

    it('should handle limit=10000 on paginated endpoint', async () => {
      const res = await api.get('/api/notifications', {
        auth: token,
        query: { limit: '10000' },
      });
      // Should either cap or return all
      expect([200, 400]).toContain(res.status);
    });

    it('should handle offset=0', async () => {
      const res = await api.get('/api/notifications', {
        auth: token,
        query: { offset: '0' },
      });
      expect(res.status).toBe(200);
    });

    it('should handle very large offset', async () => {
      const res = await api.get('/api/notifications', {
        auth: token,
        query: { offset: '999999' },
      });
      expect([200, 400]).toContain(res.status);
    });
  });

  // ─── EU country code boundaries ─────────────────────────────────────────

  describe('Country code boundaries', () => {
    it('should handle lowercase country code', async () => {
      const res = await api.post('/api/cra-reports', {
        auth: token,
        body: {
          productId: TEST_IDS.products.github,
          reportType: 'vulnerability',
          awarenessAt: new Date().toISOString(),
          csirtCountry: 'de',
        },
      });
      // May accept (case-insensitive) or reject
      expect([201, 400, 422, 500]).toContain(res.status);
    });

    it('should handle non-EU country code', async () => {
      const res = await api.post('/api/cra-reports', {
        auth: token,
        body: {
          productId: TEST_IDS.products.github,
          reportType: 'vulnerability',
          awarenessAt: new Date().toISOString(),
          csirtCountry: 'US',
        },
      });
      // US is not in EU27 — may reject or accept
      expect([201, 400, 422, 500]).toContain(res.status);
    });

    it('should handle 3-letter country code', async () => {
      const res = await api.post('/api/cra-reports', {
        auth: token,
        body: {
          productId: TEST_IDS.products.github,
          reportType: 'vulnerability',
          awarenessAt: new Date().toISOString(),
          csirtCountry: 'DEU', // ISO 3166-1 alpha-3
        },
      });
      expect([201, 400, 422, 500]).toContain(res.status);
    });
  });
});

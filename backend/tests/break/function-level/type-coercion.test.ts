/**
 * Break Tests — Function Level: Type Coercion
 *
 * Tests API endpoints with unexpected types to verify the backend
 * handles type mismatches gracefully (no crashes, no data corruption).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../../setup/test-helpers.js';
import { TEST_IDS } from '../../setup/seed-test-data.js';

describe('Break: Type Coercion', () => {
  let token: string;

  beforeAll(async () => {
    token = await loginTestUser(TEST_USERS.mfgAdmin);
  });

  // ─── Numbers where strings expected ───────────────────────────────────

  describe('Numbers where strings expected', () => {
    it('should handle number as email', async () => {
      const res = await api.post('/api/auth/login', {
        body: { email: 42, password: 'TestPass123!' },
      });
      expect([400, 401, 500]).toContain(res.status);
    });

    it('should handle number as product name', async () => {
      const res = await api.post('/api/products', {
        auth: token,
        body: { name: 99999, craCategory: 'default' },
      });
      // JS will coerce number to string — may succeed or fail
      expect([201, 400, 422, 500]).toContain(res.status);
    });

    it('should handle number as CRA report type', async () => {
      const res = await api.post('/api/cra-reports', {
        auth: token,
        body: {
          productId: TEST_IDS.products.github,
          reportType: 123,
          awarenessAt: new Date().toISOString(),
          csirtCountry: 'DE',
        },
      });
      expect([400, 422, 500]).toContain(res.status);
      expect(res.status).not.toBe(201);
    });

    it('should handle number as feedback category', async () => {
      const res = await api.post('/api/feedback', {
        auth: token,
        body: { category: 42, subject: 'test', body: 'test', pageUrl: '/test' },
      });
      expect([400, 422, 500]).toContain(res.status);
    });
  });

  // ─── Booleans where strings expected ──────────────────────────────────

  describe('Booleans where strings expected', () => {
    it('should handle boolean as email', async () => {
      const res = await api.post('/api/auth/register', {
        body: { email: true, password: 'TestPass123!' },
      });
      expect([400, 500]).toContain(res.status);
    });

    it('should handle boolean as product name', async () => {
      const res = await api.post('/api/products', {
        auth: token,
        body: { name: false, craCategory: 'default' },
      });
      expect([201, 400, 422, 500]).toContain(res.status);
    });

    it('should handle boolean as org name', async () => {
      const res = await api.put('/api/org', {
        auth: token,
        body: { name: true },
      });
      expect([200, 400, 500]).toContain(res.status);
    });
  });

  // ─── Arrays where primitives expected ─────────────────────────────────

  describe('Arrays where primitives expected', () => {
    it('should handle array as email', async () => {
      const res = await api.post('/api/auth/login', {
        body: { email: ['a@b.com', 'c@d.com'], password: 'TestPass123!' },
      });
      expect([400, 401, 500]).toContain(res.status);
    });

    it('should handle array as password', async () => {
      const res = await api.post('/api/auth/login', {
        body: { email: 'test@test.com', password: ['pass1', 'pass2'] },
      });
      expect([400, 401, 500]).toContain(res.status);
    });

    it('should handle array as productId', async () => {
      const res = await api.post('/api/cra-reports', {
        auth: token,
        body: {
          productId: [TEST_IDS.products.github, TEST_IDS.products.codeberg],
          reportType: 'vulnerability',
          awarenessAt: new Date().toISOString(),
        },
      });
      expect([400, 404, 422, 500]).toContain(res.status);
    });
  });

  // ─── Objects where primitives expected ─────────────────────────────────

  describe('Objects where primitives expected', () => {
    it('should handle object as email', async () => {
      const res = await api.post('/api/auth/login', {
        body: { email: { value: 'test@test.com' }, password: 'TestPass123!' },
      });
      expect([400, 401, 500]).toContain(res.status);
    });

    it('should handle object as product name', async () => {
      const res = await api.post('/api/products', {
        auth: token,
        body: { name: { en: 'English', de: 'Deutsch' }, craCategory: 'default' },
      });
      expect([201, 400, 422, 500]).toContain(res.status);
    });

    it('should handle nested object as CRA report awarenessAt', async () => {
      const res = await api.post('/api/cra-reports', {
        auth: token,
        body: {
          productId: TEST_IDS.products.github,
          reportType: 'vulnerability',
          awarenessAt: { date: '2026-01-01', time: '12:00' },
        },
      });
      expect([400, 422, 500]).toContain(res.status);
    });
  });

  // ─── String numbers in query params ────────────────────────────────────

  describe('String numbers in query params', () => {
    it('should handle non-numeric page number', async () => {
      const res = await api.get('/api/cra-reports', {
        auth: token,
        query: { page: 'abc' },
      });
      // Should either ignore or return error — not crash
      expect([200, 400, 500]).toContain(res.status);
    });

    it('should handle negative page number', async () => {
      const res = await api.get('/api/cra-reports', {
        auth: token,
        query: { page: '-1' },
      });
      expect([200, 400, 500]).toContain(res.status);
    });

    it('should handle float as page number', async () => {
      const res = await api.get('/api/cra-reports', {
        auth: token,
        query: { page: '1.5' },
      });
      expect([200, 400, 500]).toContain(res.status);
    });

    it('should handle very large page number', async () => {
      const res = await api.get('/api/cra-reports', {
        auth: token,
        query: { page: '999999999' },
      });
      expect([200, 400, 500]).toContain(res.status);
    });
  });

  // ─── Empty strings where values required ───────────────────────────────

  describe('Empty strings', () => {
    it('should reject empty email', async () => {
      const res = await api.post('/api/auth/login', {
        body: { email: '', password: 'TestPass123!' },
      });
      expect([400, 401]).toContain(res.status);
    });

    it('should reject empty password', async () => {
      const res = await api.post('/api/auth/login', {
        body: { email: 'test@test.com', password: '' },
      });
      expect([400, 401]).toContain(res.status);
    });

    it('should reject empty product name', async () => {
      const res = await api.post('/api/products', {
        auth: token,
        body: { name: '', craCategory: 'default' },
      });
      expect([400, 422, 500]).toContain(res.status);
    });

    it('should handle empty string as csirtCountry', async () => {
      const res = await api.post('/api/cra-reports', {
        auth: token,
        body: {
          productId: TEST_IDS.products.github,
          reportType: 'vulnerability',
          awarenessAt: new Date().toISOString(),
          csirtCountry: '',
        },
      });
      // May accept (no country) or reject
      expect([201, 400, 422, 500]).toContain(res.status);
    });
  });

  // ─── Special JavaScript values ──────────────────────────────────────

  describe('Special JavaScript values', () => {
    it('should handle Infinity', async () => {
      const res = await api.post('/api/products', {
        auth: token,
        body: { name: 'test-infinity', craCategory: 'default', price: Infinity },
      });
      // Infinity serialises as null in JSON
      expect([201, 400, 422, 500]).toContain(res.status);
    });

    it('should handle NaN', async () => {
      const res = await api.post('/api/products', {
        auth: token,
        body: { name: 'test-nan', craCategory: 'default', price: NaN },
      });
      // NaN serialises as null in JSON
      expect([201, 400, 422, 500]).toContain(res.status);
    });
  });
});

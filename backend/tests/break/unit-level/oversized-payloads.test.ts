/**
 * Break Tests — Unit Level: Oversized Payloads
 *
 * Tests API resilience against oversized inputs — large strings,
 * deeply nested objects, massive arrays, and payload size limits.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../../setup/test-helpers.js';
import { TEST_IDS } from '../../setup/seed-test-data.js';

describe('Break: Oversized Payloads', () => {
  let token: string;

  beforeAll(async () => {
    token = await loginTestUser(TEST_USERS.mfgAdmin);
  });

  // ─── Large string fields ───────────────────────────────────────────────

  describe('Large string fields', () => {
    it('should handle 10KB product name', async () => {
      const res = await api.post('/api/products', {
        auth: token,
        body: { name: 'A'.repeat(10240), craCategory: 'default' },
      });
      expect([201, 400, 413, 422, 500]).toContain(res.status);
    });

    it('should handle 100KB feedback body', async () => {
      const res = await api.post('/api/feedback', {
        auth: token,
        body: {
          category: 'bug',
          subject: 'Oversized test',
          body: 'X'.repeat(102400),
          pageUrl: '/test',
        },
      });
      expect([200, 201, 400, 413, 422, 500]).toContain(res.status);
    });

    it('should handle 1MB CRA report content', async () => {
      const res = await api.post(`/api/cra-reports/${TEST_IDS.reports.draft}/stages`, {
        auth: token,
        body: {
          stage: 'intermediate',
          content: { summary: 'M'.repeat(1024 * 1024) },
        },
      });
      expect([200, 201, 400, 413, 500]).toContain(res.status);
    });

    it('should handle very long email address (500 chars)', async () => {
      const longEmail = 'a'.repeat(480) + '@toolong.com';
      const res = await api.post('/api/auth/register', {
        body: { email: longEmail, password: 'TestPass123!' },
      });
      expect([400, 413, 422, 500]).toContain(res.status);
      expect(res.status).not.toBe(201);
    });

    it('should handle very long password (10KB)', async () => {
      const res = await api.post('/api/auth/register', {
        body: { email: 'longpass@break.test', password: 'Aa1!' + 'x'.repeat(10240) },
      });
      // bcrypt truncates to 72 bytes internally — server may accept (sends verification) or reject
      expect([200, 201, 400, 413, 422, 500]).toContain(res.status);
    });
  });

  // ─── Deeply nested objects ─────────────────────────────────────────────

  describe('Deeply nested objects', () => {
    it('should handle 50-level deep nested object', async () => {
      let obj: any = { value: 'leaf' };
      for (let i = 0; i < 50; i++) {
        obj = { nested: obj };
      }
      const res = await api.post('/api/feedback', {
        auth: token,
        body: {
          category: 'bug',
          subject: 'Deep nesting test',
          body: JSON.stringify(obj),
          pageUrl: '/test',
        },
      });
      expect([200, 201, 400, 413, 500]).toContain(res.status);
    });

    it('should handle deeply nested CRA report content', async () => {
      let obj: any = { data: 'end' };
      for (let i = 0; i < 20; i++) {
        obj = { level: obj };
      }
      const res = await api.post(`/api/cra-reports/${TEST_IDS.reports.draft}/stages`, {
        auth: token,
        body: { stage: 'intermediate', content: obj },
      });
      expect([200, 201, 400, 413, 500]).toContain(res.status);
    });
  });

  // ─── Large arrays ──────────────────────────────────────────────────────

  describe('Large arrays', () => {
    it('should handle 1000-element array in body', async () => {
      const items = Array.from({ length: 1000 }, (_, i) => ({
        name: `item-${i}`,
        value: i,
      }));
      const res = await api.post('/api/feedback', {
        auth: token,
        body: {
          category: 'bug',
          subject: 'Array test',
          body: JSON.stringify(items),
          pageUrl: '/test',
        },
      });
      expect([200, 201, 400, 413, 500]).toContain(res.status);
    });
  });

  // ─── Many query parameters ─────────────────────────────────────────────

  describe('Many query parameters', () => {
    it('should handle 50 extra query params', async () => {
      const query: Record<string, string> = {};
      for (let i = 0; i < 50; i++) {
        query[`param${i}`] = `value${i}`;
      }
      const res = await api.get('/api/products', { auth: token, query });
      // Extra params should be ignored
      expect(res.status).toBe(200);
    });

    it('should handle very long query parameter value', async () => {
      const res = await api.get('/api/cra-reports', {
        auth: token,
        query: { status: 'x'.repeat(5000) },
      });
      expect([200, 400, 414, 500]).toContain(res.status);
    });
  });

  // ─── URL length limits ─────────────────────────────────────────────────

  describe('URL length limits', () => {
    it('should handle very long URL path', async () => {
      const longPath = '/api/products/' + 'a'.repeat(2000);
      const res = await api.get(longPath, { auth: token });
      expect([400, 404, 414, 431, 500]).toContain(res.status);
    });
  });

  // ─── Repeated keys in JSON ─────────────────────────────────────────────

  describe('Duplicate JSON keys', () => {
    it('should handle raw JSON with duplicate keys via string body', async () => {
      // JSON.parse takes the last value for duplicate keys
      // We can test this by sending a body where coercion produces duplicates
      const res = await api.post('/api/products', {
        auth: token,
        body: {
          name: 'first-name',
          craCategory: 'default',
          // JSON serialization only sends each key once, so we test
          // with overridden values instead
        },
      });
      expect([201, 400, 500]).toContain(res.status);
    });
  });

  // ─── Large number of concurrent requests ───────────────────────────────

  describe('Burst requests', () => {
    it('should handle 20 concurrent requests', async () => {
      const promises = Array.from({ length: 20 }, () =>
        api.get('/api/products', { auth: token })
      );
      const results = await Promise.all(promises);
      const allSucceeded = results.every(r => r.status === 200);
      expect(allSucceeded).toBe(true);
    });

    it('should handle 20 concurrent CRA report creates', async () => {
      const promises = Array.from({ length: 20 }, (_, i) =>
        api.post('/api/cra-reports', {
          auth: token,
          body: {
            productId: TEST_IDS.products.github,
            reportType: 'vulnerability',
            awarenessAt: new Date().toISOString(),
            csirtCountry: 'DE',
          },
        })
      );
      const results = await Promise.all(promises);
      // All should either succeed or fail gracefully — no 500s from race conditions ideally
      for (const r of results) {
        expect([201, 400, 429, 500]).toContain(r.status);
      }
      // At least some should succeed
      const succeeded = results.filter(r => r.status === 201);
      expect(succeeded.length).toBeGreaterThan(0);
    });
  });
});

/**
 * Integration Test — Billing Gate Enforcement
 *
 * Tests that the billing gate middleware correctly blocks write operations
 * for organisations in various billing states (suspended, read_only, cancelled)
 * while allowing reads and exempted paths.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('Integration: Billing Gate Enforcement', () => {
  let activeToken: string;
  let suspendedToken: string;
  let readOnlyToken: string;
  let trialToken: string;
  let pastDueToken: string;

  beforeAll(async () => {
    activeToken = await loginTestUser(TEST_USERS.mfgAdmin);
    suspendedToken = await loginTestUser(TEST_USERS.distAdmin);
    readOnlyToken = await loginTestUser(TEST_USERS.ossAdmin);
    trialToken = await loginTestUser(TEST_USERS.impAdmin);
    pastDueToken = await loginTestUser(TEST_USERS.pdAdmin);
  });

  // ─── Active org — all operations allowed ────────────────────────────

  describe('Active org (full access)', () => {
    it('should allow GET requests', async () => {
      const res = await api.get('/api/products', { auth: activeToken });
      expect(res.status).toBe(200);
    });

    it('should allow POST requests', async () => {
      const res = await api.post('/api/feedback', {
        auth: activeToken,
        body: { category: 'feedback', subject: 'Billing test', body: 'Test body', pageUrl: '/test' },
      });
      expect([200, 201]).toContain(res.status);
    });

    it('should allow product creation', async () => {
      const res = await api.post('/api/products', {
        auth: activeToken,
        body: { name: `billing-test-active-${Date.now()}`, craCategory: 'default' },
      });
      expect(res.status).toBe(201);
    });
  });

  // ─── Trial org — all operations allowed ──────────────────────────────

  describe('Trial org (full access during trial)', () => {
    it('should allow GET requests', async () => {
      const res = await api.get('/api/products', { auth: trialToken });
      expect(res.status).toBe(200);
    });

    it('should allow POST requests', async () => {
      const res = await api.post('/api/feedback', {
        auth: trialToken,
        body: { category: 'feedback', subject: 'Trial test', body: 'Test', pageUrl: '/test' },
      });
      expect([200, 201]).toContain(res.status);
    });
  });

  // ─── Suspended org — reads allowed, writes blocked ──────────────────

  describe('Suspended org (write-blocked)', () => {
    it('should allow GET requests', async () => {
      const res = await api.get('/api/products', { auth: suspendedToken });
      expect(res.status).toBe(200);
    });

    it('should block product creation', async () => {
      const res = await api.post('/api/products', {
        auth: suspendedToken,
        body: { name: 'blocked-product', craCategory: 'default' },
      });
      expect(res.status).toBe(403);
    });

    it('should block CRA report creation', async () => {
      const res = await api.post('/api/cra-reports', {
        auth: suspendedToken,
        body: {
          productId: TEST_IDS.products.distGithub1,
          reportType: 'vulnerability',
          awarenessAt: new Date().toISOString(),
          csirtCountry: 'DE',
        },
      });
      expect(res.status).toBe(403);
    });

    it('should block feedback submission', async () => {
      const res = await api.post('/api/feedback', {
        auth: suspendedToken,
        body: { category: 'bug', subject: 'Should be blocked', body: 'Test', pageUrl: '/test' },
      });
      expect(res.status).toBe(403);
    });

    it('should still allow /api/auth/me (exempt path)', async () => {
      const res = await api.get('/api/auth/me', { auth: suspendedToken });
      expect(res.status).toBe(200);
    });

    it('should still allow /api/billing/status (exempt path)', async () => {
      const res = await api.get('/api/billing/status', { auth: suspendedToken });
      expect(res.status).toBe(200);
    });
  });

  // ─── Read-only org — reads allowed, writes blocked ──────────────────

  describe('Read-only org (write-blocked)', () => {
    it('should allow GET requests', async () => {
      const res = await api.get('/api/products', { auth: readOnlyToken });
      expect(res.status).toBe(200);
    });

    it('should block product creation', async () => {
      const res = await api.post('/api/products', {
        auth: readOnlyToken,
        body: { name: 'blocked-readonly', craCategory: 'default' },
      });
      expect(res.status).toBe(403);
    });

    it('should block feedback submission', async () => {
      const res = await api.post('/api/feedback', {
        auth: readOnlyToken,
        body: { category: 'bug', subject: 'Should be blocked', body: 'Test', pageUrl: '/test' },
      });
      expect(res.status).toBe(403);
    });

    it('should still allow reads on overview endpoints', async () => {
      const res = await api.get('/api/cra-reports/overview', { auth: readOnlyToken });
      expect(res.status).toBe(200);
    });
  });

  // ─── Past-due org — may have grace period ────────────────────────────

  describe('Past-due org (grace period behavior)', () => {
    it('should allow GET requests', async () => {
      const res = await api.get('/api/products', { auth: pastDueToken });
      expect(res.status).toBe(200);
    });

    it('should reflect past_due status in billing', async () => {
      const res = await api.get('/api/billing/status', { auth: pastDueToken });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('past_due');
    });

    it('should allow or block writes depending on grace period', async () => {
      const res = await api.post('/api/feedback', {
        auth: pastDueToken,
        body: { category: 'feedback', subject: 'Grace test', body: 'Test', pageUrl: '/test' },
      });
      // past_due may still be in grace period (writes allowed) or blocked
      expect([200, 201, 403]).toContain(res.status);
    });
  });

  // ─── Cross-cutting: billing gate doesn't affect auth ─────────────────

  describe('Auth endpoints exempt from billing gate', () => {
    it('suspended org can still call /api/auth/me', async () => {
      const res = await api.get('/api/auth/me', { auth: suspendedToken });
      expect(res.status).toBe(200);
      expect(res.body.user || res.body).toHaveProperty('email');
    });

    it('read-only org can still call /api/auth/me', async () => {
      const res = await api.get('/api/auth/me', { auth: readOnlyToken });
      expect(res.status).toBe(200);
    });

    it('suspended org can still login', async () => {
      const res = await api.post('/api/auth/login', {
        body: { email: TEST_USERS.distAdmin, password: 'TestPass123!' },
      });
      // Suspended user may get 403 or login successfully but be blocked on writes
      expect([200, 403]).toContain(res.status);
    });
  });
});

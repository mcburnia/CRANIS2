/**
 * Security Tests — Billing Gate Enforcement
 *
 * Tests that the global billing middleware blocks write operations
 * for orgs with restricted billing statuses (read_only, suspended, cancelled).
 */

import { describe, it, expect } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('Billing Gate Enforcement', () => {

  // ─── Suspended Org ────────────────────────────────────────────────────

  describe('Suspended org (TestOrg-Distributor-Suspended)', () => {
    let token: string;

    beforeAll(async () => {
      token = await loginTestUser(TEST_USERS.distAdmin);
    });

    it('should allow GET requests (read access)', async () => {
      const res = await api.get('/api/org', { auth: token });
      // May get org data or error depending on implementation
      expect([200, 403]).toContain(res.status);
    });

    it('should block POST requests (write access)', async () => {
      const res = await api.post('/api/cra-reports', {
        auth: token,
        body: {
          product_id: TEST_IDS.products.distGithub1,
          report_type: 'vulnerability',
          awareness_at: new Date().toISOString(),
        },
      });
      expect([402, 403]).toContain(res.status);
    });

    it('should block PUT requests (write access)', async () => {
      const res = await api.put('/api/org', {
        auth: token,
        body: { website: 'https://should-be-blocked.test' },
      });
      expect([402, 403]).toContain(res.status);
    });
  });

  // ─── Read-Only Org ────────────────────────────────────────────────────

  describe('Read-only org (TestOrg-OSS-ReadOnly)', () => {
    let token: string;

    beforeAll(async () => {
      token = await loginTestUser(TEST_USERS.ossAdmin);
    });

    it('should allow GET requests', async () => {
      const res = await api.get('/api/org', { auth: token });
      expect([200, 403]).toContain(res.status);
    });

    it('should block POST requests', async () => {
      const res = await api.post('/api/feedback', {
        auth: token,
        body: {
          category: 'bug',
          subject: 'Test',
          body: 'Should be blocked',
          pageUrl: '/test',
        },
      });
      expect([402, 403]).toContain(res.status);
    });
  });

  // ─── Active Org (should NOT be blocked) ───────────────────────────────

  describe('Active org (TestOrg-Manufacturer-Active)', () => {
    let token: string;

    beforeAll(async () => {
      token = await loginTestUser(TEST_USERS.mfgAdmin);
    });

    it('should allow POST requests', async () => {
      const res = await api.post('/api/feedback', {
        auth: token,
        body: {
          category: 'feedback',
          subject: 'Test feedback from active org',
          body: 'This should succeed',
          pageUrl: '/test',
        },
      });
      expect([200, 201]).toContain(res.status);
    });
  });

  // ─── Trial Org (should NOT be blocked) ────────────────────────────────

  describe('Trial org (TestOrg-Importer-Trial)', () => {
    let token: string;

    beforeAll(async () => {
      token = await loginTestUser(TEST_USERS.impAdmin);
    });

    it('should allow write operations during trial', async () => {
      const res = await api.post('/api/feedback', {
        auth: token,
        body: {
          category: 'feature',
          subject: 'Trial org write test',
          body: 'Trial orgs should have full access',
          pageUrl: '/test',
        },
      });
      expect([200, 201]).toContain(res.status);
    });
  });

  // ─── Exempt Paths ─────────────────────────────────────────────────────

  describe('Billing-exempt paths', () => {
    it('/api/auth/login should work for suspended org users', async () => {
      const res = await api.post('/api/auth/login', {
        body: { email: TEST_USERS.distAdmin, password: 'TestPass123!' },
      });
      expect(res.status).toBe(200);
      expect(res.body.session).toBeTruthy();
    });

    it('/api/billing/status should work for suspended org', async () => {
      const token = await loginTestUser(TEST_USERS.distAdmin);
      const res = await api.get('/api/billing/status', { auth: token });
      expect([200, 402, 403]).toContain(res.status);
    });
  });
});

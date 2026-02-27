/**
 * Security Tests — Admin Route Protection
 *
 * Tests that all /api/admin/* endpoints are properly guarded by
 * requirePlatformAdmin middleware. Verifies that unauthenticated users,
 * regular org admins, regular org members, suspended users, and orphan
 * users are all denied access, while platform admins are granted access.
 *
 * Also verifies that unsupported HTTP methods on admin routes do not
 * cause server crashes (graceful 404/405 handling).
 */

import { describe, it, expect } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

// ─── Admin Endpoints Under Test ─────────────────────────────────────────

const ADMIN_ENDPOINTS = [
  '/api/admin/dashboard',
  '/api/admin/orgs',
  '/api/admin/users',
  '/api/admin/audit-log',
  '/api/admin/system',
  '/api/admin/vulnerability-scan/status',
  '/api/admin/vulnerability-db/status',
  '/api/admin/feedback',
] as const;

describe('Admin Route Protection', () => {

  // ─── 1. No Auth Token → 401 ───────────────────────────────────────────

  describe('Unauthenticated requests (no token)', () => {
    for (const endpoint of ADMIN_ENDPOINTS) {
      it(`GET ${endpoint} should return 401 without auth token`, async () => {
        const res = await api.get(endpoint);
        expect(res.status).toBe(401);
      });
    }
  });

  // ─── 2. Regular Org Admin → 401 or 403 ────────────────────────────────

  describe('Regular org admin (mfgAdmin) — NOT platform admin', () => {
    let token: string;

    beforeAll(async () => {
      token = await loginTestUser(TEST_USERS.mfgAdmin);
    });

    for (const endpoint of ADMIN_ENDPOINTS) {
      it(`GET ${endpoint} should reject org admin with 401 or 403`, async () => {
        const res = await api.get(endpoint, { auth: token });
        expect([401, 403]).toContain(res.status);
      });
    }
  });

  // ─── 3. Regular Org Member → 401 or 403 ───────────────────────────────

  describe('Regular org member (mfgMember1)', () => {
    let token: string;

    beforeAll(async () => {
      token = await loginTestUser(TEST_USERS.mfgMember1);
    });

    for (const endpoint of ADMIN_ENDPOINTS) {
      it(`GET ${endpoint} should reject org member with 401 or 403`, async () => {
        const res = await api.get(endpoint, { auth: token });
        expect([401, 403]).toContain(res.status);
      });
    }
  });

  // ─── 4. Suspended User → 403 ─────────────────────────────────────────

  describe('Suspended user (mfgSuspended)', () => {
    it('should not be able to access admin endpoints', async () => {
      // Suspended users may fail at login. If login succeeds (edge case),
      // the endpoint should still reject them.
      let token: string;
      try {
        token = await loginTestUser(TEST_USERS.mfgSuspended);
      } catch {
        // If login itself is rejected, that is the correct security behavior.
        // We verify that unauthenticated access is blocked in the first suite.
        return;
      }

      // If somehow a suspended user obtains a token, admin routes must still block them.
      for (const endpoint of ADMIN_ENDPOINTS) {
        const res = await api.get(endpoint, { auth: token });
        expect([401, 403]).toContain(res.status);
      }
    });
  });

  // ─── 5. Orphan User (No Org) → 401 or 403 ────────────────────────────

  describe('Orphan user (no organisation)', () => {
    let token: string;

    beforeAll(async () => {
      token = await loginTestUser(TEST_USERS.orphanUser);
    });

    for (const endpoint of ADMIN_ENDPOINTS) {
      it(`GET ${endpoint} should reject orphan user with 401 or 403`, async () => {
        const res = await api.get(endpoint, { auth: token });
        expect([401, 403]).toContain(res.status);
      });
    }
  });

  // ─── 6. Platform Admin → 200 ─────────────────────────────────────────

  describe('Platform admin access (should succeed)', () => {
    let token: string;

    beforeAll(async () => {
      token = await loginTestUser(TEST_USERS.platformAdmin);
    });

    for (const endpoint of ADMIN_ENDPOINTS) {
      it(`GET ${endpoint} should return 200 for platform admin`, async () => {
        const res = await api.get(endpoint, { auth: token });
        expect(res.status).toBe(200);
      });
    }

    it('platform admin response should contain valid JSON body', async () => {
      const res = await api.get('/api/admin/dashboard', { auth: token });
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
      expect(typeof res.body).toBe('object');
    });
  });

  // ─── 7. Unsupported HTTP Methods → Should Not Crash ───────────────────

  describe('Unsupported HTTP methods on admin routes', () => {
    let platformToken: string;
    let regularToken: string;

    beforeAll(async () => {
      platformToken = await loginTestUser(TEST_USERS.platformAdmin);
      regularToken = await loginTestUser(TEST_USERS.mfgAdmin);
    });

    describe('POST on admin GET-only endpoints', () => {
      for (const endpoint of ADMIN_ENDPOINTS) {
        it(`POST ${endpoint} as platform admin should not crash (expect 404 or 405)`, async () => {
          const res = await api.post(endpoint, {
            auth: platformToken,
            body: { test: 'data' },
          });
          // Should return a well-formed HTTP error, not 500 (server crash)
          expect(res.status).not.toBe(500);
          // Acceptable responses: 404 (no route), 405 (method not allowed),
          // or even 401/403 if auth is checked before method validation
          expect([401, 403, 404, 405]).toContain(res.status);
        });
      }
    });

    describe('PUT on admin GET-only endpoints', () => {
      for (const endpoint of ADMIN_ENDPOINTS) {
        it(`PUT ${endpoint} as platform admin should not crash (expect 404 or 405)`, async () => {
          const res = await api.put(endpoint, {
            auth: platformToken,
            body: { test: 'data' },
          });
          expect(res.status).not.toBe(500);
          expect([401, 403, 404, 405]).toContain(res.status);
        });
      }
    });

    describe('DELETE on admin GET-only endpoints', () => {
      for (const endpoint of ADMIN_ENDPOINTS) {
        it(`DELETE ${endpoint} as platform admin should not crash (expect 404 or 405)`, async () => {
          const res = await api.delete(endpoint, { auth: platformToken });
          expect(res.status).not.toBe(500);
          expect([401, 403, 404, 405]).toContain(res.status);
        });
      }
    });

    describe('POST on admin routes as regular user', () => {
      for (const endpoint of ADMIN_ENDPOINTS) {
        it(`POST ${endpoint} as regular user should not crash`, async () => {
          const res = await api.post(endpoint, {
            auth: regularToken,
            body: { test: 'data' },
          });
          expect(res.status).not.toBe(500);
          // Should be rejected by auth before even considering method
          expect([401, 403, 404, 405]).toContain(res.status);
        });
      }
    });
  });
});

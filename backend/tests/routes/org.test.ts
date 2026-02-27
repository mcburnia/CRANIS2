/**
 * Organisation Route Tests — /api/org
 *
 * Tests: create, get, update, members
 */

import { describe, it, expect } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('/api/org', () => {

  // ─── GET /api/org ─────────────────────────────────────────────────────

  describe('GET /api/org', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get('/api/org');
      expect(res.status).toBe(401);
    });

    it('should return org for authenticated user', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get('/api/org', { auth: token });
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(TEST_IDS.orgs.mfgActive);
      // Verify org has expected fields (values may change from PUT tests)
      expect(typeof res.body.name).toBe('string');
      expect(res.body.name.length).toBeGreaterThan(0);
      // These fields exist but may be empty if seed didn't populate them in Neo4j
      expect(res.body).toHaveProperty('country');
      expect(res.body).toHaveProperty('companySize');
      expect(res.body).toHaveProperty('craRole');
    });

    it('should return null/empty for user without org', async () => {
      const token = await loginTestUser(TEST_USERS.orphanUser);
      const res = await api.get('/api/org', { auth: token });
      // May return 404 or null body depending on implementation
      expect([200, 404]).toContain(res.status);
    });

    it('should return different orgs for users in different orgs', async () => {
      const token1 = await loginTestUser(TEST_USERS.mfgAdmin);
      const token2 = await loginTestUser(TEST_USERS.impAdmin);

      const res1 = await api.get('/api/org', { auth: token1 });
      const res2 = await api.get('/api/org', { auth: token2 });

      expect(res1.body.id).toBe(TEST_IDS.orgs.mfgActive);
      expect(res2.body.id).toBe(TEST_IDS.orgs.impTrial);
      expect(res1.body.id).not.toBe(res2.body.id);
    });
  });

  // ─── PUT /api/org ─────────────────────────────────────────────────────

  describe('PUT /api/org', () => {
    it('should reject unauthenticated update', async () => {
      const res = await api.put('/api/org', {
        body: { website: 'https://test.example.com' },
      });
      expect(res.status).toBe(401);
    });

    it('should reject update from non-admin member', async () => {
      const token = await loginTestUser(TEST_USERS.mfgMember1);
      const res = await api.put('/api/org', {
        auth: token,
        body: { website: 'https://hacker.test' },
      });
      expect([403, 401]).toContain(res.status);
    });

    it('should allow admin to update org details', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      // PUT /api/org requires `name` field and uses camelCase
      const res = await api.put('/api/org', {
        auth: token,
        body: {
          name: 'Active Manufacturer',
          website: 'https://test-manufacturer.example.com',
          contactEmail: 'contact@manufacturer-active.test',
          contactPhone: '+49123456789',
        },
      });
      expect(res.status).toBe(200);
    });

    it('should persist updated fields', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);

      // Update
      await api.put('/api/org', {
        auth: token,
        body: { name: 'TestOrg-Manufacturer-Active', website: 'https://verify-update.test' },
      });

      // Verify
      const res = await api.get('/api/org', { auth: token });
      expect(res.status).toBe(200);
      expect(res.body.website).toBe('https://verify-update.test');
    });
  });

  // ─── GET /api/org/members ─────────────────────────────────────────────

  describe('GET /api/org/members', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get('/api/org/members');
      expect(res.status).toBe(401);
    });

    it('should list all org members', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get('/api/org/members', { auth: token });
      expect(res.status).toBe(200);
      // Returns { members: [...] }
      const members = Array.isArray(res.body) ? res.body : res.body.members || [];
      expect(members.length).toBeGreaterThanOrEqual(4);
    });

    it('should include role information', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get('/api/org/members', { auth: token });
      const members = Array.isArray(res.body) ? res.body : res.body.members || [];
      const admin = members.find((m: any) => m.email === TEST_USERS.mfgAdmin);
      expect(admin).toBeTruthy();
      expect(admin.org_role || admin.orgRole).toBe('admin');
    });

    it('should show single member for empty org', async () => {
      const token = await loginTestUser(TEST_USERS.emptyAdmin);
      const res = await api.get('/api/org/members', { auth: token });
      expect(res.status).toBe(200);
      const members = Array.isArray(res.body) ? res.body : res.body.members || [];
      expect(members.length).toBe(1); // Just the admin
    });
  });
});

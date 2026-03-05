/**
 * Admin Org Actions Tests — /api/admin/orgs
 *
 * Tests: PUT /orgs/:orgId/plan (change plan), DELETE /orgs/:orgId (delete org)
 * Uses validation-only tests for DELETE to avoid destroying shared test data.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

describe('/api/admin/orgs — actions', () => {
  let regularToken: string;
  let platformAdminToken: string;
  let testOrgId: string;

  beforeAll(async () => {
    regularToken = await loginTestUser(TEST_USERS.mfgAdmin);
    platformAdminToken = await loginTestUser(TEST_USERS.platformAdmin);

    // Get a real org ID from the orgs list (use importer-trial org for plan tests)
    const orgsRes = await api.get('/api/admin/orgs', { auth: platformAdminToken });
    const importerOrg = orgsRes.body.orgs.find((o: any) => o.name?.includes('Importer'));
    testOrgId = importerOrg?.id || orgsRes.body.orgs[0]?.id;
  });

  // ── GET /api/admin/orgs — enriched with plan + billing status ──

  describe('GET /api/admin/orgs — plan + billing data', () => {
    it('should include plan and billingStatus in each org', async () => {
      const res = await api.get('/api/admin/orgs', { auth: platformAdminToken });
      expect(res.status).toBe(200);
      expect(res.body.orgs.length).toBeGreaterThan(0);
      for (const org of res.body.orgs) {
        expect(org).toHaveProperty('plan');
        expect(org).toHaveProperty('billingStatus');
        expect(['standard', 'pro']).toContain(org.plan);
      }
    });
  });

  // ── PUT /api/admin/orgs/:orgId/plan ──

  describe('PUT /api/admin/orgs/:orgId/plan', () => {
    it('should reject without auth', async () => {
      const res = await api.put(`/api/admin/orgs/${testOrgId}/plan`, {
        body: { plan: 'pro' },
      });
      expect([401, 403]).toContain(res.status);
    });

    it('should reject non-admin user', async () => {
      const res = await api.put(`/api/admin/orgs/${testOrgId}/plan`, {
        auth: regularToken,
        body: { plan: 'pro' },
      });
      expect([401, 403]).toContain(res.status);
    });

    it('should reject invalid plan value', async () => {
      const res = await api.put(`/api/admin/orgs/${testOrgId}/plan`, {
        auth: platformAdminToken,
        body: { plan: 'enterprise' },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid plan');
    });

    it('should reject missing plan value', async () => {
      const res = await api.put(`/api/admin/orgs/${testOrgId}/plan`, {
        auth: platformAdminToken,
        body: {},
      });
      expect(res.status).toBe(400);
    });

    it('should change plan to pro', async () => {
      const res = await api.put(`/api/admin/orgs/${testOrgId}/plan`, {
        auth: platformAdminToken,
        body: { plan: 'pro' },
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.plan).toBe('pro');
    });

    it('should change plan back to standard', async () => {
      const res = await api.put(`/api/admin/orgs/${testOrgId}/plan`, {
        auth: platformAdminToken,
        body: { plan: 'standard' },
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.plan).toBe('standard');
    });

    it('should return 404 for non-existent org', async () => {
      const res = await api.put('/api/admin/orgs/00000000-0000-0000-0000-000000000000/plan', {
        auth: platformAdminToken,
        body: { plan: 'pro' },
      });
      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /api/admin/orgs/:orgId — validation guards only ──

  describe('DELETE /api/admin/orgs/:orgId', () => {
    it('should reject without auth', async () => {
      const res = await api.delete(`/api/admin/orgs/${testOrgId}`);
      expect([401, 403]).toContain(res.status);
    });

    it('should reject non-admin user', async () => {
      const res = await api.delete(`/api/admin/orgs/${testOrgId}`, {
        auth: regularToken,
      });
      expect([401, 403]).toContain(res.status);
    });

    it('should reject deleting own organisation', async () => {
      // Platform admin belongs to an org — trying to delete it should fail
      const meRes = await api.get('/api/auth/me', { auth: platformAdminToken });
      const adminOrgId = meRes.body.orgId;
      if (adminOrgId) {
        const res = await api.delete(`/api/admin/orgs/${adminOrgId}`, {
          auth: platformAdminToken,
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Cannot delete your own');
      }
    });

    it('should return 404 for non-existent org', async () => {
      const res = await api.delete('/api/admin/orgs/00000000-0000-0000-0000-000000000000', {
        auth: platformAdminToken,
      });
      expect(res.status).toBe(404);
    });
  });
});

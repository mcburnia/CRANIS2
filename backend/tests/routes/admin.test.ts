/**
 * Admin Route Tests — /api/admin
 *
 * Tests: access control (non-admin vs platform admin) across all admin endpoints
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

describe('/api/admin', () => {
  let regularToken: string;
  let platformAdminToken: string;

  beforeAll(async () => {
    regularToken = await loginTestUser(TEST_USERS.mfgAdmin);
    platformAdminToken = await loginTestUser(TEST_USERS.platformAdmin);
  });

  const adminEndpoints = [
    '/api/admin/dashboard',
    '/api/admin/orgs',
    '/api/admin/users',
    '/api/admin/audit-log',
    '/api/admin/system',
    '/api/admin/vulnerability-scan/status',
    '/api/admin/vulnerability-db/status',
    '/api/admin/feedback',
  ];

  describe('access control — non-admin user', () => {
    it.each(adminEndpoints)(
      'should reject non-admin on %s',
      async (endpoint) => {
        const res = await api.get(endpoint, { auth: regularToken });
        expect([401, 403]).toContain(res.status);
      }
    );
  });

  describe('access control — platform admin', () => {
    it.each(adminEndpoints)(
      'should allow platform admin on %s',
      async (endpoint) => {
        const res = await api.get(endpoint, { auth: platformAdminToken });
        expect(res.status).toBe(200);
      }
    );
  });

  describe('GET /api/admin/dashboard', () => {
    it('should return dashboard data for platform admin', async () => {
      const res = await api.get('/api/admin/dashboard', { auth: platformAdminToken });
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });
  });

  describe('GET /api/admin/orgs', () => {
    it('should return orgs list for platform admin', async () => {
      const res = await api.get('/api/admin/orgs', { auth: platformAdminToken });
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });
  });

  describe('GET /api/admin/users', () => {
    it('should return users list for platform admin', async () => {
      const res = await api.get('/api/admin/users', { auth: platformAdminToken });
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });
  });
});

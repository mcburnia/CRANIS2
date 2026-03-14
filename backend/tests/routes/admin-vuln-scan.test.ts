/**
 * Admin Vulnerability Scan Route Tests — /api/admin/vulnerability-scan
 *
 * Tests: scan trigger, status, history, DB sync, auth enforcement
 *
 * All endpoints require platform admin role.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

describe('/api/admin/vulnerability-scan', () => {
  let platformToken: string;
  let adminToken: string;

  beforeAll(async () => {
    platformToken = await loginTestUser(TEST_USERS.platformAdmin);
    adminToken = await loginTestUser(TEST_USERS.mfgAdmin);
  });

  // ─── POST /api/admin/vulnerability-scan ─────────────────────────────

  describe('POST /api/admin/vulnerability-scan', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.post('/api/admin/vulnerability-scan');
      expect(res.status).toBe(401);
    });

    it('should reject non-platform-admin request', async () => {
      const res = await api.post('/api/admin/vulnerability-scan', { auth: adminToken });
      expect([401, 403]).toContain(res.status);
    });

    it('should trigger scan for platform admin', async () => {
      const res = await api.post('/api/admin/vulnerability-scan', { auth: platformToken });
      // May return 200/202 on success or 409 if scan already running
      expect([200, 202, 409]).toContain(res.status);
    });
  });

  // ─── GET /api/admin/vulnerability-scan/status ───────────────────────

  describe('GET /api/admin/vulnerability-scan/status', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get('/api/admin/vulnerability-scan/status');
      expect(res.status).toBe(401);
    });

    it('should reject non-platform-admin request', async () => {
      const res = await api.get('/api/admin/vulnerability-scan/status', { auth: adminToken });
      expect([401, 403]).toContain(res.status);
    });

    it('should return scan status for platform admin', async () => {
      const res = await api.get('/api/admin/vulnerability-scan/status', { auth: platformToken });
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });
  });

  // ─── GET /api/admin/vulnerability-scan/history ──────────────────────

  describe('GET /api/admin/vulnerability-scan/history', () => {
    it('should reject non-platform-admin request', async () => {
      const res = await api.get('/api/admin/vulnerability-scan/history', { auth: adminToken });
      expect([401, 403]).toContain(res.status);
    });

    it('should return scan history for platform admin', async () => {
      const res = await api.get('/api/admin/vulnerability-scan/history', { auth: platformToken });
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
      // Should be an array or paginated object
      const history = Array.isArray(res.body) ? res.body : res.body.runs;
      expect(Array.isArray(history)).toBe(true);
    });
  });

  // ─── POST /api/admin/vulnerability-db/sync ──────────────────────────

  describe('POST /api/admin/vulnerability-db/sync', () => {
    it('should reject non-platform-admin request', async () => {
      const res = await api.post('/api/admin/vulnerability-db/sync', { auth: adminToken });
      expect([401, 403]).toContain(res.status);
    });

    it('should trigger DB sync for platform admin', async () => {
      const res = await api.post('/api/admin/vulnerability-db/sync', { auth: platformToken });
      // May return 200/202 on success or 409 if already syncing
      expect([200, 202, 409]).toContain(res.status);
    });
  });

  // ─── GET /api/admin/vulnerability-db/status ─────────────────────────

  describe('GET /api/admin/vulnerability-db/status', () => {
    it('should reject non-platform-admin request', async () => {
      const res = await api.get('/api/admin/vulnerability-db/status', { auth: adminToken });
      expect([401, 403]).toContain(res.status);
    });

    it('should return DB sync status for platform admin', async () => {
      const res = await api.get('/api/admin/vulnerability-db/status', { auth: platformToken });
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });
  });
});

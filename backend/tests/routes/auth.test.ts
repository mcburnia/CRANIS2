/**
 * Auth Route Tests — /api/auth
 *
 * Tests: register, login, me, verify-email, accept-invite
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, BASE_URL, TEST_USERS, TEST_PASSWORD, getTestToken, loginTestUser } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('/api/auth', () => {

  // ─── POST /register ──────────────────────────────────────────────────

  describe('POST /register', () => {
    it('should reject missing email', async () => {
      const res = await api.post('/api/auth/register', {
        body: { password: TEST_PASSWORD },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('should reject missing password', async () => {
      const res = await api.post('/api/auth/register', {
        body: { email: 'test-nopass@register.test' },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('should reject weak password (no uppercase)', async () => {
      const res = await api.post('/api/auth/register', {
        body: { email: 'test-weak@register.test', password: 'weakpass1!' },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('strength');
    });

    it('should reject weak password (no special char)', async () => {
      const res = await api.post('/api/auth/register', {
        body: { email: 'test-weak2@register.test', password: 'WeakPass1' },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('strength');
    });

    it('should reject weak password (too short)', async () => {
      const res = await api.post('/api/auth/register', {
        body: { email: 'test-weak3@register.test', password: 'Aa1!' },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('strength');
    });

    it('should reject duplicate email for verified user', async () => {
      const res = await api.post('/api/auth/register', {
        body: { email: TEST_USERS.mfgAdmin, password: TEST_PASSWORD },
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already exists');
    });

    it('should register new user', async () => {
      const email = `test-newuser-${Date.now()}@register.test`;
      const res = await api.post('/api/auth/register', {
        body: { email, password: TEST_PASSWORD },
      });
      expect(res.status).toBe(201);
      // In dev mode: returns { session, devMode: true }
      // In prod mode: returns { message: "Verification email sent" }
      expect(res.body.session || res.body.message).toBeTruthy();
    });
  });

  // ─── POST /login ─────────────────────────────────────────────────────

  describe('POST /login', () => {
    it('should reject missing credentials', async () => {
      const res = await api.post('/api/auth/login', { body: {} });
      expect(res.status).toBe(400);
    });

    it('should reject non-existent email', async () => {
      const res = await api.post('/api/auth/login', {
        body: { email: 'doesnotexist@nowhere.test', password: TEST_PASSWORD },
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid');
    });

    it('should reject wrong password', async () => {
      const res = await api.post('/api/auth/login', {
        body: { email: TEST_USERS.mfgAdmin, password: 'WrongPass123!' },
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid');
    });

    it('should reject suspended user', async () => {
      const res = await api.post('/api/auth/login', {
        body: { email: TEST_USERS.mfgSuspended, password: TEST_PASSWORD },
      });
      expect(res.status).toBe(403);
      expect(res.body.error.toLowerCase()).toContain('suspended');
    });

    it('should login valid user and return session', async () => {
      const res = await api.post('/api/auth/login', {
        body: { email: TEST_USERS.mfgAdmin, password: TEST_PASSWORD },
      });
      expect(res.status).toBe(200);
      expect(res.body.session).toBeTruthy();
      expect(res.body.email).toBe(TEST_USERS.mfgAdmin);
    });
  });

  // ─── GET /me ──────────────────────────────────────────────────────────

  describe('GET /me', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const res = await api.get('/api/auth/me', { auth: 'invalid.jwt.token' });
      expect(res.status).toBe(401);
    });

    it('should return user info for valid token', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get('/api/auth/me', { auth: token });
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(TEST_USERS.mfgAdmin);
      expect(res.body.user.orgId).toBe(TEST_IDS.orgs.mfgActive);
      expect(res.body.user.orgRole).toBe('admin');
    });

    it('should return null orgId for orphan user', async () => {
      const token = await loginTestUser(TEST_USERS.orphanUser);
      const res = await api.get('/api/auth/me', { auth: token });
      expect(res.status).toBe(200);
      expect(res.body.user.orgId).toBeNull();
    });

    it('should return isPlatformAdmin for platform admin', async () => {
      const token = await loginTestUser(TEST_USERS.platformAdmin);
      const res = await api.get('/api/auth/me', { auth: token });
      expect(res.status).toBe(200);
      expect(res.body.user.isPlatformAdmin).toBe(true);
    });
  });
});

/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

/**
 * Account Settings Tests — CRAN-30
 *
 * Covers the new /api/account self-service endpoints:
 *   - GET    /api/account
 *   - PUT    /api/account/profile
 *   - PUT    /api/account/password
 *   - PUT    /api/account/email
 *   - POST   /api/account/email/confirm
 */

import { describe, it, expect } from 'vitest';
import { api, registerTestUser, getAppPool, loginTestUser } from '../setup/test-helpers.js';

const TEST_PASSWORD = 'TestPass123!';

async function cleanupUser(email: string): Promise<void> {
  const pool = getAppPool();
  await pool.query('DELETE FROM auth_security_events WHERE user_id IN (SELECT id FROM users WHERE email = $1)', [email]);
  await pool.query('DELETE FROM password_reset_tokens WHERE user_id IN (SELECT id FROM users WHERE email = $1)', [email]);
  await pool.query('DELETE FROM user_events WHERE user_id IN (SELECT id FROM users WHERE email = $1)', [email]);
  await pool.query('DELETE FROM users WHERE email = $1', [email]);
}

describe('CRAN-30: Account settings', () => {

  // ─── GET /api/account ────────────────────────────────────────────────

  describe('GET /api/account', () => {
    it('returns 401 without auth', async () => {
      const res = await api.get('/api/account');
      expect(res.status).toBe(401);
    });

    it('returns the authenticated user profile', async () => {
      const email = 'cran30-get@cranis2.test';
      await cleanupUser(email);
      const token = await registerTestUser(email, TEST_PASSWORD);

      const res = await api.get('/api/account', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      expect(res.body.email).toBe(email);
      expect(res.body.emailVerified).toBe(true);
      expect(res.body.pendingEmail).toBeNull();

      await cleanupUser(email);
    });
  });

  // ─── PUT /api/account/profile ────────────────────────────────────────

  describe('PUT /api/account/profile', () => {
    it('updates display_name and preferred_language', async () => {
      const email = 'cran30-profile@cranis2.test';
      await cleanupUser(email);
      const token = await registerTestUser(email, TEST_PASSWORD);

      const res = await api.put('/api/account/profile', {
        headers: { Authorization: `Bearer ${token}` },
        body: { displayName: 'Test User', preferredLanguage: 'fr' },
      });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const get = await api.get('/api/account', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(get.body.displayName).toBe('Test User');
      expect(get.body.preferredLanguage).toBe('fr');

      // Audit-log entry should exist.
      const pool = getAppPool();
      const events = await pool.query(
        `SELECT event_type FROM auth_security_events
          WHERE user_id IN (SELECT id FROM users WHERE email = $1)
            AND event_type = 'profile_updated'`,
        [email]
      );
      expect(events.rows.length).toBe(1);

      await cleanupUser(email);
    });

    it('rejects an unsupported language code', async () => {
      const email = 'cran30-badlang@cranis2.test';
      await cleanupUser(email);
      const token = await registerTestUser(email, TEST_PASSWORD);

      const res = await api.put('/api/account/profile', {
        headers: { Authorization: `Bearer ${token}` },
        body: { preferredLanguage: 'klingon' },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('language');

      await cleanupUser(email);
    });

    it('accepts locale-style codes (e.g. en-GB) and normalises to the base', async () => {
      // Older signup records carry navigator.language values like "en-GB" in
      // preferred_language. The validator must accept these and store the
      // bare base ("en") so the column converges on a consistent shape.
      const email = 'cran30-locale@cranis2.test';
      await cleanupUser(email);
      const token = await registerTestUser(email, TEST_PASSWORD);

      const res = await api.put('/api/account/profile', {
        headers: { Authorization: `Bearer ${token}` },
        body: { preferredLanguage: 'en-GB' },
      });
      expect(res.status).toBe(200);

      const profile = await api.get('/api/account', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(profile.body.preferredLanguage).toBe('en');

      await cleanupUser(email);
    });

    it('rejects locale-style codes whose base is unsupported (e.g. xx-YY)', async () => {
      const email = 'cran30-badlocale@cranis2.test';
      await cleanupUser(email);
      const token = await registerTestUser(email, TEST_PASSWORD);

      const res = await api.put('/api/account/profile', {
        headers: { Authorization: `Bearer ${token}` },
        body: { preferredLanguage: 'xx-YY' },
      });
      expect(res.status).toBe(400);

      await cleanupUser(email);
    });

    it('rejects an oversized display name', async () => {
      const email = 'cran30-bigname@cranis2.test';
      await cleanupUser(email);
      const token = await registerTestUser(email, TEST_PASSWORD);

      const longName = 'x'.repeat(150);
      const res = await api.put('/api/account/profile', {
        headers: { Authorization: `Bearer ${token}` },
        body: { displayName: longName },
      });
      expect(res.status).toBe(400);

      await cleanupUser(email);
    });

    it('rejects empty payload', async () => {
      const email = 'cran30-empty@cranis2.test';
      await cleanupUser(email);
      const token = await registerTestUser(email, TEST_PASSWORD);

      const res = await api.put('/api/account/profile', {
        headers: { Authorization: `Bearer ${token}` },
        body: {},
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('No fields');

      await cleanupUser(email);
    });
  });

  // ─── PUT /api/account/password ───────────────────────────────────────

  describe('PUT /api/account/password', () => {
    const NEW = 'BrandNewPass789!';

    it('changes the password when the current password is correct', async () => {
      const email = 'cran30-pwok@cranis2.test';
      await cleanupUser(email);
      const token = await registerTestUser(email, TEST_PASSWORD);

      const res = await api.put('/api/account/password', {
        headers: { Authorization: `Bearer ${token}` },
        body: { currentPassword: TEST_PASSWORD, newPassword: NEW, confirmPassword: NEW },
      });
      expect(res.status).toBe(200);

      // Old password no longer logs in.
      const oldLogin = await api.post('/api/auth/login', { body: { email, password: TEST_PASSWORD } });
      expect(oldLogin.status).toBe(401);

      // New password does.
      const newLogin = await api.post('/api/auth/login', { body: { email, password: NEW } });
      expect(newLogin.status).toBe(200);

      await cleanupUser(email);
    });

    it('rejects with wrong currentPassword', async () => {
      const email = 'cran30-pwwrong@cranis2.test';
      await cleanupUser(email);
      const token = await registerTestUser(email, TEST_PASSWORD);

      const res = await api.put('/api/account/password', {
        headers: { Authorization: `Bearer ${token}` },
        body: { currentPassword: 'wrong-password', newPassword: NEW, confirmPassword: NEW },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Current password');

      await cleanupUser(email);
    });

    it('rejects when newPassword and confirmPassword differ', async () => {
      const email = 'cran30-pwmismatch@cranis2.test';
      await cleanupUser(email);
      const token = await registerTestUser(email, TEST_PASSWORD);

      const res = await api.put('/api/account/password', {
        headers: { Authorization: `Bearer ${token}` },
        body: { currentPassword: TEST_PASSWORD, newPassword: NEW, confirmPassword: 'different' },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('do not match');

      await cleanupUser(email);
    });

    it('rejects a weak new password', async () => {
      const email = 'cran30-pwweak@cranis2.test';
      await cleanupUser(email);
      const token = await registerTestUser(email, TEST_PASSWORD);

      const res = await api.put('/api/account/password', {
        headers: { Authorization: `Bearer ${token}` },
        body: { currentPassword: TEST_PASSWORD, newPassword: 'weak', confirmPassword: 'weak' },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('strength');

      await cleanupUser(email);
    });

    it('invalidates the old session and writes an audit-log entry', async () => {
      const email = 'cran30-pwwatermark@cranis2.test';
      await cleanupUser(email);
      const oldToken = await registerTestUser(email, TEST_PASSWORD);

      // Old token works against /api/account/* before the change.
      const before = await api.get('/api/account', { headers: { Authorization: `Bearer ${oldToken}` } });
      expect(before.status).toBe(200);

      // Change password.
      await api.put('/api/account/password', {
        headers: { Authorization: `Bearer ${oldToken}` },
        body: { currentPassword: TEST_PASSWORD, newPassword: NEW, confirmPassword: NEW },
      });

      // Old token rejected by watermark.
      const after = await api.get('/api/account', { headers: { Authorization: `Bearer ${oldToken}` } });
      expect(after.status).toBe(401);

      // Audit-log: password_changed event.
      const pool = getAppPool();
      const events = await pool.query(
        `SELECT event_type FROM auth_security_events
          WHERE user_id IN (SELECT id FROM users WHERE email = $1)
            AND event_type = 'password_changed'`,
        [email]
      );
      expect(events.rows.length).toBe(1);

      await cleanupUser(email);
    });
  });

  // ─── PUT /api/account/email ──────────────────────────────────────────

  describe('PUT /api/account/email', () => {
    it('initiates a verification flow without changing the live email', async () => {
      const email = 'cran30-email-old@cranis2.test';
      const newEmail = 'cran30-email-new@cranis2.test';
      await cleanupUser(email);
      await cleanupUser(newEmail);
      const token = await registerTestUser(email, TEST_PASSWORD);

      const res = await api.put('/api/account/email', {
        headers: { Authorization: `Bearer ${token}` },
        body: { newEmail },
      });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      // DEV_MODE returns the token directly so the test can confirm it.
      expect(typeof res.body.devToken).toBe('string');

      // Account stays on old email until confirmation.
      const profile = await api.get('/api/account', { headers: { Authorization: `Bearer ${token}` } });
      expect(profile.body.email).toBe(email);
      expect(profile.body.pendingEmail).toBe(newEmail);

      await cleanupUser(email);
      await cleanupUser(newEmail);
    });

    it('rejects an email already in use by another account', async () => {
      const email = 'cran30-email-self@cranis2.test';
      const taken = 'cran30-email-taken@cranis2.test';
      await cleanupUser(email);
      await cleanupUser(taken);
      const token = await registerTestUser(email, TEST_PASSWORD);
      await registerTestUser(taken, TEST_PASSWORD);

      const res = await api.put('/api/account/email', {
        headers: { Authorization: `Bearer ${token}` },
        body: { newEmail: taken },
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already in use');

      await cleanupUser(email);
      await cleanupUser(taken);
    });

    it('rejects when newEmail equals current email', async () => {
      const email = 'cran30-email-same@cranis2.test';
      await cleanupUser(email);
      const token = await registerTestUser(email, TEST_PASSWORD);

      const res = await api.put('/api/account/email', {
        headers: { Authorization: `Bearer ${token}` },
        body: { newEmail: email },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('differ');

      await cleanupUser(email);
    });

    it('finalises the change when /email/confirm is called with the right token', async () => {
      const email = 'cran30-email-confirm-old@cranis2.test';
      const newEmail = 'cran30-email-confirm-new@cranis2.test';
      await cleanupUser(email);
      await cleanupUser(newEmail);
      const token = await registerTestUser(email, TEST_PASSWORD);

      const reqRes = await api.put('/api/account/email', {
        headers: { Authorization: `Bearer ${token}` },
        body: { newEmail },
      });
      const changeToken = reqRes.body.devToken as string;

      const confirm = await api.post('/api/account/email/confirm', {
        headers: { Authorization: `Bearer ${token}` },
        body: { token: changeToken },
      });
      expect(confirm.status).toBe(200);
      expect(confirm.body.email).toBe(newEmail);

      // Profile should now reflect the new email; old session continues to work
      // because email change does not advance the session-invalidation watermark.
      const profile = await api.get('/api/account', { headers: { Authorization: `Bearer ${token}` } });
      expect(profile.body.email).toBe(newEmail);
      expect(profile.body.pendingEmail).toBeNull();

      // Login with the new email + original password works.
      const newLogin = await api.post('/api/auth/login', { body: { email: newEmail, password: TEST_PASSWORD } });
      expect(newLogin.status).toBe(200);

      await cleanupUser(newEmail);
    });

    it('rejects /email/confirm with the wrong token', async () => {
      const email = 'cran30-email-badtoken@cranis2.test';
      const newEmail = 'cran30-email-badtoken-new@cranis2.test';
      await cleanupUser(email);
      await cleanupUser(newEmail);
      const token = await registerTestUser(email, TEST_PASSWORD);

      await api.put('/api/account/email', {
        headers: { Authorization: `Bearer ${token}` },
        body: { newEmail },
      });

      const confirm = await api.post('/api/account/email/confirm', {
        headers: { Authorization: `Bearer ${token}` },
        body: { token: 'totally-wrong' },
      });
      expect(confirm.status).toBe(400);

      await cleanupUser(email);
      await cleanupUser(newEmail);
    });
  });
});

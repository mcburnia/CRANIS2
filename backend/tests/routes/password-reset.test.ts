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
 * Password Reset Tests — CRAN-29
 *
 * Covers:
 *   - POST /api/auth/password-reset-request (issuance + enumeration defence)
 *   - POST /api/auth/password-reset (token validation + password update)
 *   - Session-invalidation watermark enforcement on /api/account/*
 *   - Audit-log entries (auth_security_events)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import { api, registerTestUser, getAppPool } from '../setup/test-helpers.js';

const TEST_EMAIL_BASE = 'cran29-pwreset';
const TEST_PASSWORD = 'TestPass123!';
const NEW_PASSWORD = 'NewSecurePass456!';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function cleanupUser(email: string): Promise<void> {
  const pool = getAppPool();
  // Drain anything that FKs to users(id) before deleting the row.
  // user_events is the one created by registration telemetry.
  await pool.query('DELETE FROM auth_security_events WHERE user_id IN (SELECT id FROM users WHERE email = $1)', [email]);
  await pool.query('DELETE FROM password_reset_tokens WHERE user_id IN (SELECT id FROM users WHERE email = $1)', [email]);
  await pool.query('DELETE FROM user_events WHERE user_id IN (SELECT id FROM users WHERE email = $1)', [email]);
  await pool.query('DELETE FROM users WHERE email = $1', [email]);
}

describe('CRAN-29: Password reset', () => {

  // ─── Request issuance ───────────────────────────────────────────────────

  describe('POST /api/auth/password-reset-request', () => {

    it('returns ok for a known email and persists a hashed token', async () => {
      const email = `${TEST_EMAIL_BASE}-known@cranis2.test`;
      await cleanupUser(email);
      await registerTestUser(email, TEST_PASSWORD);

      const res = await api.post('/api/auth/password-reset-request', {
        body: { email },
      });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      // DEV_MODE returns the raw token so the dev flow works without Resend.
      expect(typeof res.body.devToken).toBe('string');
      expect(res.body.devToken.length).toBeGreaterThan(20);

      // The DB must hold the HASH of the token, never the raw token itself.
      const pool = getAppPool();
      const tokenHash = hashToken(res.body.devToken);
      const dbRow = await pool.query(
        `SELECT t.token_hash, t.expires_at, t.used_at
           FROM password_reset_tokens t JOIN users u ON u.id = t.user_id
          WHERE u.email = $1 ORDER BY t.created_at DESC LIMIT 1`,
        [email]
      );
      expect(dbRow.rows[0].token_hash).toBe(tokenHash);
      expect(dbRow.rows[0].used_at).toBeNull();
      // Expiry should be ~60 minutes in the future.
      const ttlMs = new Date(dbRow.rows[0].expires_at).getTime() - Date.now();
      expect(ttlMs).toBeGreaterThan(50 * 60 * 1000);
      expect(ttlMs).toBeLessThan(70 * 60 * 1000);

      await cleanupUser(email);
    });

    it('returns ok for an unknown email and does not persist any token (enumeration defence)', async () => {
      const unknownEmail = `${TEST_EMAIL_BASE}-unknown@cranis2.test`;
      await cleanupUser(unknownEmail);

      const res = await api.post('/api/auth/password-reset-request', {
        body: { email: unknownEmail },
      });

      // Same shape as the known-email path.
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      // No devToken because no user matched.
      expect(res.body.devToken).toBeUndefined();

      const pool = getAppPool();
      const tokens = await pool.query(
        `SELECT t.id FROM password_reset_tokens t
           LEFT JOIN users u ON u.id = t.user_id
          WHERE u.email = $1`,
        [unknownEmail]
      );
      expect(tokens.rows.length).toBe(0);
    });

    it('rejects requests with no email', async () => {
      const res = await api.post('/api/auth/password-reset-request', {
        body: {},
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Email');
    });

    it('rejects requests with malformed email', async () => {
      const res = await api.post('/api/auth/password-reset-request', {
        body: { email: 'not-an-email' },
      });
      expect(res.status).toBe(400);
    });

    it('records an audit-log entry on a known-email request', async () => {
      const email = `${TEST_EMAIL_BASE}-audit-req@cranis2.test`;
      await cleanupUser(email);
      await registerTestUser(email, TEST_PASSWORD);

      await api.post('/api/auth/password-reset-request', { body: { email } });

      const pool = getAppPool();
      const events = await pool.query(
        `SELECT event_type FROM auth_security_events
          WHERE user_id IN (SELECT id FROM users WHERE email = $1)
          ORDER BY created_at DESC LIMIT 1`,
        [email]
      );
      expect(events.rows[0].event_type).toBe('password_reset_requested');

      await cleanupUser(email);
    });
  });

  // ─── Token confirmation ─────────────────────────────────────────────────

  describe('POST /api/auth/password-reset', () => {

    it('updates the password and marks the token used on success', async () => {
      const email = `${TEST_EMAIL_BASE}-confirm-ok@cranis2.test`;
      await cleanupUser(email);
      await registerTestUser(email, TEST_PASSWORD);

      const reqRes = await api.post('/api/auth/password-reset-request', { body: { email } });
      const token = reqRes.body.devToken as string;

      const res = await api.post('/api/auth/password-reset', {
        body: { token, password: NEW_PASSWORD },
      });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      // Old password should no longer work.
      const oldLogin = await api.post('/api/auth/login', { body: { email, password: TEST_PASSWORD } });
      expect(oldLogin.status).toBe(401);

      // New password should work.
      const newLogin = await api.post('/api/auth/login', { body: { email, password: NEW_PASSWORD } });
      expect(newLogin.status).toBe(200);

      // Token should be marked used.
      const pool = getAppPool();
      const tokenRow = await pool.query(
        `SELECT used_at FROM password_reset_tokens
          WHERE user_id IN (SELECT id FROM users WHERE email = $1)
          ORDER BY created_at DESC LIMIT 1`,
        [email]
      );
      expect(tokenRow.rows[0].used_at).not.toBeNull();

      // Audit-log: password_reset_completed.
      const events = await pool.query(
        `SELECT event_type FROM auth_security_events
          WHERE user_id IN (SELECT id FROM users WHERE email = $1)
            AND event_type = 'password_reset_completed'`,
        [email]
      );
      expect(events.rows.length).toBe(1);

      await cleanupUser(email);
    });

    it('rejects a token that was already used', async () => {
      const email = `${TEST_EMAIL_BASE}-replay@cranis2.test`;
      await cleanupUser(email);
      await registerTestUser(email, TEST_PASSWORD);

      const reqRes = await api.post('/api/auth/password-reset-request', { body: { email } });
      const token = reqRes.body.devToken as string;

      const first = await api.post('/api/auth/password-reset', { body: { token, password: NEW_PASSWORD } });
      expect(first.status).toBe(200);

      const replay = await api.post('/api/auth/password-reset', { body: { token, password: 'EvenNewer789!' } });
      expect(replay.status).toBe(400);
      expect(replay.body.error).toContain('invalid or has expired');

      await cleanupUser(email);
    });

    it('rejects an expired token', async () => {
      const email = `${TEST_EMAIL_BASE}-expired@cranis2.test`;
      await cleanupUser(email);
      await registerTestUser(email, TEST_PASSWORD);

      const reqRes = await api.post('/api/auth/password-reset-request', { body: { email } });
      const token = reqRes.body.devToken as string;

      // Force-expire the token in DB.
      const pool = getAppPool();
      await pool.query(
        `UPDATE password_reset_tokens SET expires_at = NOW() - INTERVAL '1 minute'
          WHERE user_id IN (SELECT id FROM users WHERE email = $1)`,
        [email]
      );

      const res = await api.post('/api/auth/password-reset', { body: { token, password: NEW_PASSWORD } });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('invalid or has expired');

      await cleanupUser(email);
    });

    it('rejects an unknown / forged token', async () => {
      const fakeToken = crypto.randomBytes(32).toString('base64url');
      const res = await api.post('/api/auth/password-reset', {
        body: { token: fakeToken, password: NEW_PASSWORD },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('invalid or has expired');
    });

    it('rejects a weak new password', async () => {
      const email = `${TEST_EMAIL_BASE}-weak@cranis2.test`;
      await cleanupUser(email);
      await registerTestUser(email, TEST_PASSWORD);

      const reqRes = await api.post('/api/auth/password-reset-request', { body: { email } });
      const token = reqRes.body.devToken as string;

      const res = await api.post('/api/auth/password-reset', {
        body: { token, password: 'tooweak' },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('strength');

      await cleanupUser(email);
    });

    it('invalidates pre-reset session tokens against /api/account/*', async () => {
      const email = `${TEST_EMAIL_BASE}-watermark@cranis2.test`;
      await cleanupUser(email);
      const oldSession = await registerTestUser(email, TEST_PASSWORD);

      // Old session token initially works against an account-gated endpoint.
      const before = await api.get('/api/account/data-export', {
        headers: { Authorization: `Bearer ${oldSession}` },
      });
      expect(before.status).toBe(200);

      // Trigger reset.
      const reqRes = await api.post('/api/auth/password-reset-request', { body: { email } });
      const token = reqRes.body.devToken as string;
      await api.post('/api/auth/password-reset', { body: { token, password: NEW_PASSWORD } });

      // Same old session token must now be rejected by the watermark check.
      const after = await api.get('/api/account/data-export', {
        headers: { Authorization: `Bearer ${oldSession}` },
      });
      expect(after.status).toBe(401);
      expect(after.body.error).toContain('invalidated');

      await cleanupUser(email);
    });

    it('rejects requests missing token or password', async () => {
      const noToken = await api.post('/api/auth/password-reset', { body: { password: NEW_PASSWORD } });
      expect(noToken.status).toBe(400);

      const noPw = await api.post('/api/auth/password-reset', { body: { token: 'something' } });
      expect(noPw.status).toBe(400);
    });

    it('marks email_verified=TRUE on successful reset (user proved inbox access)', async () => {
      // Simulate a user who registered but never clicked the verification
      // email — then forgot their password. Without auto-verify-on-reset,
      // they would be permanently locked out: reset succeeds but login
      // fails with "verify email". Auto-verify treats the click of the
      // reset link as proof of inbox access.
      const email = `${TEST_EMAIL_BASE}-unverified-reset@cranis2.test`;
      await cleanupUser(email);
      await registerTestUser(email, TEST_PASSWORD);

      // Force the user back to unverified state, as if they'd never clicked
      // the original signup verification link.
      const pool = getAppPool();
      await pool.query('UPDATE users SET email_verified = FALSE WHERE email = $1', [email]);

      const reqRes = await api.post('/api/auth/password-reset-request', { body: { email } });
      const token = reqRes.body.devToken as string;

      const reset = await api.post('/api/auth/password-reset', {
        body: { token, password: NEW_PASSWORD },
      });
      expect(reset.status).toBe(200);

      // Email is now considered verified — user can log in with the new
      // password without hitting the "Please verify your email" wall.
      const loginRes = await api.post('/api/auth/login', { body: { email, password: NEW_PASSWORD } });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.session).toBeTruthy();

      const verifyCheck = await pool.query<{ email_verified: boolean }>(
        'SELECT email_verified FROM users WHERE email = $1',
        [email]
      );
      expect(verifyCheck.rows[0].email_verified).toBe(true);

      await cleanupUser(email);
    });
  });
});

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
 * Password Reset Service — CRAN-29
 *
 * Implements the user self-service password recovery flow.
 *
 * Threat-model decisions:
 *   - 256-bit URL-safe random token (44 chars base64url).
 *   - Token is hashed (SHA-256) at rest; the DB never holds working tokens.
 *   - 60-minute hard expiry.
 *   - One-time-use enforced by used_at timestamp.
 *   - On successful reset, all existing sessions are invalidated by setting
 *     users.sessions_invalidated_before = NOW(). Token verification rejects
 *     any session token issued before that watermark.
 *   - Email enumeration defence is in the route layer (constant-time
 *     response regardless of whether the email maps to a real user).
 */

import crypto from 'crypto';
import pool from '../db/pool.js';
import { hashPassword } from '../utils/password.js';
import { sendPasswordResetEmail } from './email.js';

const TOKEN_BYTES = 32;            // 256-bit
const TOKEN_TTL_MS = 60 * 60_000;  // 60 minutes

const DEV_MODE = process.env.DEV_SKIP_EMAIL === 'true';

function generateToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString('base64url');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export interface RequestResetOutcome {
  /** Always returned, even if email not found, to prevent enumeration. */
  ok: true;
  /** In DEV_MODE only, the raw token is returned so the dev flow can simulate "click the link". */
  devToken?: string;
}

/**
 * Issue a password-reset token for the given email if a user exists.
 * Always behaves the same externally regardless of whether the email is known.
 */
export async function requestPasswordReset(
  email: string,
  requestingIp: string | null
): Promise<RequestResetOutcome> {
  const normalised = email.toLowerCase().trim();

  // Look up the user — but treat "not found" as a silent no-op.
  const userResult = await pool.query<{ id: string; email: string }>(
    'SELECT id, email FROM users WHERE email = $1 AND suspended_at IS NULL',
    [normalised]
  );

  if (userResult.rows.length === 0) {
    return { ok: true };
  }

  const user = userResult.rows[0];
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, requesting_ip, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [user.id, tokenHash, requestingIp, expiresAt]
  );

  await recordSecurityEvent(user.id, 'password_reset_requested', { email: user.email }, requestingIp, null);

  if (DEV_MODE) {
    // In dev, we don't go via Resend. Caller surfaces the token in the response.
    return { ok: true, devToken: token };
  }

  await sendPasswordResetEmail(user.email, token);

  return { ok: true };
}

export interface ConfirmResetResult {
  success: boolean;
  /** Set when success === false. */
  reason?: 'invalid_token' | 'expired' | 'already_used' | 'weak_password';
}

/**
 * Verify a reset token and update the user's password. Invalidates all
 * existing sessions on success.
 */
export async function confirmPasswordReset(
  token: string,
  newPassword: string,
  requestingIp: string | null,
  userAgent: string | null
): Promise<ConfirmResetResult> {
  if (!isPasswordStrong(newPassword)) {
    return { success: false, reason: 'weak_password' };
  }

  const tokenHash = hashToken(token);

  const tokenRow = await pool.query<{
    id: string;
    user_id: string;
    expires_at: Date;
    used_at: Date | null;
  }>(
    `SELECT id, user_id, expires_at, used_at
       FROM password_reset_tokens
      WHERE token_hash = $1`,
    [tokenHash]
  );

  if (tokenRow.rows.length === 0) {
    return { success: false, reason: 'invalid_token' };
  }

  const row = tokenRow.rows[0];

  if (row.used_at) {
    return { success: false, reason: 'already_used' };
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { success: false, reason: 'expired' };
  }

  const newHash = await hashPassword(newPassword);

  await pool.query('BEGIN');
  try {
    // Watermark is rounded up to the next whole second. JWT `iat` is
    // whole-second precision; rounding up means any token issued in the
    // same second as the reset is reliably rejected (iat < watermarkSec),
    // while a new token issued in the *next* second is accepted.
    await pool.query(
      `UPDATE users
          SET password_hash = $1,
              sessions_invalidated_before = date_trunc('second', NOW()) + INTERVAL '1 second',
              updated_at = NOW()
        WHERE id = $2`,
      [newHash, row.user_id]
    );
    await pool.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
      [row.id]
    );
    await pool.query('COMMIT');
  } catch (err) {
    await pool.query('ROLLBACK');
    throw err;
  }

  await recordSecurityEvent(
    row.user_id,
    'password_reset_completed',
    {},
    requestingIp,
    userAgent
  );

  return { success: true };
}

export function isPasswordStrong(pw: string): boolean {
  if (typeof pw !== 'string') return false;
  if (pw.length < 8) return false;
  return /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d/.test(pw) && /[^A-Za-z0-9]/.test(pw);
}

export async function recordSecurityEvent(
  userId: string | null,
  eventType: string,
  eventData: Record<string, unknown>,
  ip: string | null,
  userAgent: string | null
): Promise<void> {
  await pool.query(
    `INSERT INTO auth_security_events
       (user_id, event_type, event_data, ip_address, user_agent)
     VALUES ($1, $2, $3::jsonb, $4, $5)`,
    [userId, eventType, JSON.stringify(eventData), ip, userAgent]
  );
}

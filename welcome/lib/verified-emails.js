/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

// Shared module for remembering verified email addresses across all welcome site flows.
// Once an email is verified through any flow (assessment, contact, subscribe),
// subsequent flows skip the verification step for 90 days.

const { getPool } = require('./database');

const VERIFICATION_TTL_DAYS = 90;

/**
 * Check whether an email has been verified recently.
 * Checks the welcome site's verified_emails table first, then falls back
 * to the main app's users table (read-only, shared Postgres instance).
 *
 * @param {string} email
 * @returns {Promise<{ verified: boolean, source: string | null }>}
 */
async function isEmailVerified(email) {
  const pool = getPool();
  if (!pool || !email) return { verified: false, source: null };

  const lowerEmail = email.toLowerCase().trim();

  try {
    // Check welcome site verified_emails table
    const { rows } = await pool.query(
      `SELECT source FROM verified_emails
       WHERE email = $1 AND verified_until > NOW()`,
      [lowerEmail]
    );
    if (rows.length > 0) {
      return { verified: true, source: rows[0].source };
    }

    // Check main app users table (read-only — shared Postgres instance)
    const { rows: userRows } = await pool.query(
      `SELECT 1 FROM users WHERE email = $1 AND email_verified = TRUE`,
      [lowerEmail]
    );
    if (userRows.length > 0) {
      return { verified: true, source: 'main_app' };
    }
  } catch (err) {
    // Non-fatal — if the check fails, fall through to normal verification
    console.error('[VERIFIED-EMAILS] Check failed:', err.message);
  }

  return { verified: false, source: null };
}

/**
 * Mark an email as verified with a 90-day TTL.
 * Uses ON CONFLICT to refresh the TTL if the email is already verified.
 *
 * @param {string} email
 * @param {string} source — which flow verified this email (cra, nis2, importer, pqc, contact, subscribe)
 */
async function markEmailVerified(email, source) {
  const pool = getPool();
  if (!pool || !email) return;

  const lowerEmail = email.toLowerCase().trim();

  try {
    await pool.query(
      `INSERT INTO verified_emails (email, verified_until, source)
       VALUES ($1, NOW() + INTERVAL '${VERIFICATION_TTL_DAYS} days', $2)
       ON CONFLICT (email) DO UPDATE SET
         verified_at = NOW(),
         verified_until = NOW() + INTERVAL '${VERIFICATION_TTL_DAYS} days'`,
      [lowerEmail, source]
    );
  } catch (err) {
    // Non-fatal — verification still worked, just the persistence failed
    console.error('[VERIFIED-EMAILS] Mark failed:', err.message);
  }
}

module.exports = { isEmailVerified, markEmailVerified };

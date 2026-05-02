/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

/**
 * API Key Service
 *
 * Handles generation, validation, and management of API keys
 * for the public API (v1). Keys are stored hashed (SHA-256).
 */

import crypto from 'crypto';
import pool from '../db/pool.js';

const KEY_PREFIX = 'cranis2_';

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/** Generate a new API key. Returns the full key (shown once) and the DB row. */
export async function createApiKey(
  orgId: string,
  name: string,
  createdBy: string,
  scopes: string[] = ['read:products', 'read:vulnerabilities', 'read:obligations', 'read:compliance', 'write:findings'],
): Promise<{ key: string; id: string; keyPrefix: string; name: string; scopes: string[]; createdAt: string }> {
  const random = crypto.randomBytes(20).toString('hex'); // 40 hex chars
  const fullKey = `${KEY_PREFIX}${random}`;
  const keyHash = hashKey(fullKey);
  const keyPrefix = fullKey.slice(0, 12); // "cranis2_xxxx"

  const result = await pool.query(
    `INSERT INTO api_keys (org_id, key_hash, key_prefix, name, scopes, created_by)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)
     RETURNING id, created_at`,
    [orgId, keyHash, keyPrefix, name, JSON.stringify(scopes), createdBy],
  );

  return {
    key: fullKey,
    id: result.rows[0].id,
    keyPrefix,
    name,
    scopes,
    createdAt: result.rows[0].created_at,
  };
}

/** Validate an API key. Returns org_id and scopes if valid, null otherwise. */
export async function validateApiKey(
  key: string,
): Promise<{ orgId: string; keyId: string; scopes: string[] } | null> {
  if (!key.startsWith(KEY_PREFIX)) return null;

  const keyHash = hashKey(key);
  const result = await pool.query(
    `SELECT id, org_id, scopes FROM api_keys
     WHERE key_hash = $1 AND revoked_at IS NULL`,
    [keyHash],
  );

  if (result.rows.length === 0) return null;

  // Update last_used_at (non-blocking)
  pool.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [result.rows[0].id]).catch(() => {});

  return {
    orgId: result.rows[0].org_id,
    keyId: result.rows[0].id,
    scopes: result.rows[0].scopes,
  };
}

/** List all API keys for an org (no secrets exposed). */
export async function listApiKeys(orgId: string) {
  const result = await pool.query(
    `SELECT k.id, k.key_prefix, k.name, k.scopes, k.created_at, k.last_used_at, k.revoked_at,
            u.email AS created_by_email
     FROM api_keys k
     LEFT JOIN users u ON u.id = k.created_by
     WHERE k.org_id = $1
     ORDER BY k.created_at DESC`,
    [orgId],
  );
  return result.rows;
}

/** Revoke an API key. */
export async function revokeApiKey(orgId: string, keyId: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE api_keys SET revoked_at = NOW()
     WHERE id = $1 AND org_id = $2 AND revoked_at IS NULL`,
    [keyId, orgId],
  );
  return (result.rowCount ?? 0) > 0;
}

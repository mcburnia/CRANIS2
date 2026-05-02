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
 * Copilot Response Cache
 *
 * Caches AI responses keyed by a SHA-256 hash of the product context.
 * When the underlying data changes, the hash changes and the old cache is bypassed.
 * Entries expire after 24 hours (cleaned up on read).
 */

import crypto from 'crypto';
import pool from '../db/pool.js';

const CACHE_TTL_HOURS = 24;

/**
 * Compute a deterministic hash of the context object.
 * We JSON.stringify with sorted keys for consistency.
 */
function hashContext(context: unknown): string {
  const json = JSON.stringify(context, Object.keys(context as any).sort());
  return crypto.createHash('sha256').update(json).digest('hex');
}

/**
 * Check if a cached response exists for this context.
 * Returns null if no cache hit or if the entry has expired.
 */
export async function checkCopilotCache(
  orgId: string,
  productId: string,
  endpoint: string,
  context: unknown
): Promise<{ response: any; inputTokens: number; outputTokens: number } | null> {
  try {
    const contextHash = hashContext(context);
    const result = await pool.query(
      `SELECT response, input_tokens, output_tokens, created_at
       FROM copilot_cache
       WHERE org_id = $1 AND product_id = $2 AND endpoint = $3 AND context_hash = $4
       ORDER BY created_at DESC LIMIT 1`,
      [orgId, productId, endpoint, contextHash]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const age = Date.now() - new Date(row.created_at).getTime();
    if (age > CACHE_TTL_HOURS * 60 * 60 * 1000) {
      // Expired – clean up asynchronously
      pool.query(
        `DELETE FROM copilot_cache WHERE org_id = $1 AND product_id = $2 AND endpoint = $3 AND context_hash = $4`,
        [orgId, productId, endpoint, contextHash]
      ).catch(() => {});
      return null;
    }

    return {
      response: row.response,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
    };
  } catch (err) {
    console.error('[COPILOT-CACHE] Check error:', err);
    return null;
  }
}

/**
 * Store a response in the cache.
 */
export async function storeCopilotCache(
  orgId: string,
  productId: string,
  endpoint: string,
  context: unknown,
  response: unknown,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  const contextHash = hashContext(context);
  await pool.query(
    `INSERT INTO copilot_cache (org_id, product_id, endpoint, context_hash, response, input_tokens, output_tokens)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
     ON CONFLICT (org_id, product_id, endpoint, context_hash)
     DO UPDATE SET response = $5::jsonb, input_tokens = $6, output_tokens = $7, created_at = NOW()`,
    [orgId, productId, endpoint, contextHash, JSON.stringify(response), inputTokens, outputTokens]
  );
}

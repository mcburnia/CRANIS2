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
 * HKDF Key Derivation — PQC Readiness (WS2)
 *
 * Derives purpose-specific keys from master secrets using HKDF-SHA256.
 * This provides cryptographic domain separation: even if one derived key
 * is compromised, the others remain safe.
 *
 * HKDF (RFC 5869) is quantum-safe — it relies on SHA-256 which is
 * resistant to Grover's algorithm at 256-bit security.
 *
 * Usage:
 *   deriveKey('master-hex-string', 'cranis2-jwt-v1', 32)
 *   deriveKey('master-hex-string', 'cranis2-encryption-v1', 32)
 */

import { hkdfSync } from 'node:crypto';

/**
 * Fixed salt for HKDF. Using a constant salt (rather than no salt) ensures
 * the extract step produces a strong PRK even if the input keying material
 * has low entropy in some positions. This salt is not secret.
 */
const HKDF_SALT = Buffer.from('cranis2-hkdf-salt-v1', 'utf-8');

/**
 * Derive a purpose-specific key from a master secret using HKDF-SHA256.
 *
 * @param masterKeyHex - The master key as a hex string (from env var)
 * @param info - Purpose string (e.g. 'cranis2-jwt-v1', 'cranis2-encryption-v1')
 * @param length - Desired output key length in bytes (default: 32)
 * @returns Derived key as a Buffer
 */
export function deriveKey(
  masterKeyHex: string,
  info: string,
  length: number = 32
): Buffer {
  const ikm = Buffer.from(masterKeyHex, 'hex');

  return Buffer.from(
    hkdfSync('sha256', ikm, HKDF_SALT, info, length)
  );
}

/**
 * Derive a JWT signing secret from the master JWT_SECRET.
 * Returns a hex string suitable for use with jsonwebtoken.
 */
export function deriveJwtSecret(masterKeyHex: string): string {
  return deriveKey(masterKeyHex, 'cranis2-jwt-v1', 32).toString('hex');
}

/**
 * Derive an encryption key from the master GITHUB_ENCRYPTION_KEY.
 * Returns a Buffer suitable for use with AES-256-GCM.
 */
export function deriveEncryptionKey(masterKeyHex: string): Buffer {
  return deriveKey(masterKeyHex, 'cranis2-encryption-v1', 32);
}

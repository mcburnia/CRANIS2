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
 * AES-256-GCM Encryption with versioned key derivation.
 *
 * Format history:
 *   v1 (legacy):  iv:tag:ciphertext           — raw master key
 *   v2 (current): v2:iv:tag:ciphertext        — HKDF-derived key
 *
 * New encryptions always use v2. Decryption auto-detects the version
 * and uses the correct key, so existing v1 data decrypts without migration.
 */

import crypto from 'crypto';
import { deriveEncryptionKey } from './key-derivation.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/** Current encryption version — all new data uses this. */
const CURRENT_VERSION = 'v2';

function getMasterKeyHex(): string {
  const key = process.env.GITHUB_ENCRYPTION_KEY;
  if (!key) throw new Error('GITHUB_ENCRYPTION_KEY not configured');
  return key;
}

/** Legacy v1 key: raw master key bytes. */
function getLegacyKey(): Buffer {
  return Buffer.from(getMasterKeyHex(), 'hex');
}

/** v2 key: HKDF-derived from master key with purpose binding. */
function getDerivedKey(): Buffer {
  return deriveEncryptionKey(getMasterKeyHex());
}

/**
 * Encrypt a string using AES-256-GCM with HKDF-derived key (v2).
 * Returns: v2:iv:tag:ciphertext (all hex-encoded)
 */
export function encrypt(plaintext: string): string {
  const key = getDerivedKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return `${CURRENT_VERSION}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a string encrypted with encrypt().
 * Auto-detects version:
 *   v2:iv:tag:ciphertext  → HKDF-derived key
 *   iv:tag:ciphertext     → legacy raw key (v1)
 */
export function decrypt(encrypted: string): string {
  const parts = encrypted.split(':');

  let key: Buffer;
  let iv: Buffer;
  let tag: Buffer;
  let ciphertext: string;

  if (parts[0] === 'v2' && parts.length === 4) {
    // v2 format: v2:iv:tag:ciphertext
    key = getDerivedKey();
    iv = Buffer.from(parts[1], 'hex');
    tag = Buffer.from(parts[2], 'hex');
    ciphertext = parts[3];
  } else if (parts.length === 3) {
    // v1 legacy format: iv:tag:ciphertext
    key = getLegacyKey();
    iv = Buffer.from(parts[0], 'hex');
    tag = Buffer.from(parts[1], 'hex');
    ciphertext = parts[2];
  } else {
    throw new Error('Invalid encrypted format');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

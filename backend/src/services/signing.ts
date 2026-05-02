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
 * Document Signing Service – P8 Phase C + PQC Hybrid (WS2)
 *
 * Signs compliance archives with CRANIS2's key pairs:
 *   - Ed25519 (classical) – fast, compact 64-byte signatures
 *   - ML-DSA-65 (post-quantum, FIPS 204) – 3,309-byte signatures,
 *     resistant to quantum computing attacks
 *
 * Hybrid signing produces both signatures. Verification requires both
 * to pass (AND logic), so a quantum attacker who breaks Ed25519 still
 * cannot forge the ML-DSA-65 signature.
 *
 * Key management:
 *   - Ed25519 private key:  CRANIS2_SIGNING_KEY env var (base64-encoded PEM)
 *   - ML-DSA-65 private key: CRANIS2_SIGNING_KEY_MLDSA env var (base64-encoded PEM)
 *   - Public keys: Derived from private keys, served at /.well-known/
 *
 * Graceful degradation:
 *   - Both keys configured → hybrid signing (Ed25519 + ML-DSA-65)
 *   - Only Ed25519 configured → classical signing only
 *   - Neither configured → signing disabled
 *
 * Verification:
 *   # Classical (Ed25519)
 *   openssl pkeyutl -verify -pubin -inkey cranis2-signing-key.pem \
 *     -sigfile archive.sig -rawin -in archive.zip
 *
 *   # Post-quantum (ML-DSA-65)
 *   openssl pkeyutl -verify -pubin -inkey cranis2-signing-key-mldsa.pem \
 *     -sigfile archive.sig.mldsa -rawin -in archive.zip
 */

import {
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
  createHash,
  KeyObject,
} from 'node:crypto';

// ── Ed25519 key cache ───────────────────────────────────────────────

let cachedEd25519Private: KeyObject | null = null;
let cachedEd25519Public: KeyObject | null = null;
let cachedEd25519KeyId: string | null = null;

function getEd25519PrivateKey(): KeyObject | null {
  if (cachedEd25519Private) return cachedEd25519Private;

  const encoded = process.env.CRANIS2_SIGNING_KEY;
  if (!encoded) return null;

  try {
    const pem = Buffer.from(encoded, 'base64').toString('utf-8');
    cachedEd25519Private = createPrivateKey({ key: pem, format: 'pem' });
    return cachedEd25519Private;
  } catch (err: any) {
    console.error('[SIGNING] Failed to load Ed25519 signing key:', err.message);
    return null;
  }
}

function getEd25519PublicKey(): KeyObject | null {
  if (cachedEd25519Public) return cachedEd25519Public;

  const privKey = getEd25519PrivateKey();
  if (!privKey) return null;

  cachedEd25519Public = createPublicKey(privKey);
  return cachedEd25519Public;
}

function getEd25519KeyId(): string | null {
  if (cachedEd25519KeyId) return cachedEd25519KeyId;

  const pubKey = getEd25519PublicKey();
  if (!pubKey) return null;

  const pem = pubKey.export({ type: 'spki', format: 'pem' }) as string;
  cachedEd25519KeyId = createHash('sha256').update(pem).digest('hex').substring(0, 8);
  return cachedEd25519KeyId;
}

// ── ML-DSA-65 key cache ─────────────────────────────────────────────

let cachedMldsaPrivate: KeyObject | null = null;
let cachedMldsaPublic: KeyObject | null = null;
let cachedMldsaKeyId: string | null = null;

function getMldsaPrivateKey(): KeyObject | null {
  if (cachedMldsaPrivate) return cachedMldsaPrivate;

  const encoded = process.env.CRANIS2_SIGNING_KEY_MLDSA;
  if (!encoded) return null;

  try {
    const pem = Buffer.from(encoded, 'base64').toString('utf-8');
    cachedMldsaPrivate = createPrivateKey({ key: pem, format: 'pem' });
    return cachedMldsaPrivate;
  } catch (err: any) {
    console.error('[SIGNING] Failed to load ML-DSA-65 signing key:', err.message);
    return null;
  }
}

function getMldsaPublicKey(): KeyObject | null {
  if (cachedMldsaPublic) return cachedMldsaPublic;

  const privKey = getMldsaPrivateKey();
  if (!privKey) return null;

  cachedMldsaPublic = createPublicKey(privKey);
  return cachedMldsaPublic;
}

function getMldsaKeyId(): string | null {
  if (cachedMldsaKeyId) return cachedMldsaKeyId;

  const pubKey = getMldsaPublicKey();
  if (!pubKey) return null;

  const pem = pubKey.export({ type: 'spki', format: 'pem' }) as string;
  cachedMldsaKeyId = createHash('sha256').update(pem).digest('hex').substring(0, 8);
  return cachedMldsaKeyId;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Check if document signing is configured (at minimum Ed25519).
 */
export function isSigningConfigured(): boolean {
  return getEd25519PrivateKey() !== null;
}

/**
 * Check if hybrid (PQC) signing is configured (Ed25519 + ML-DSA-65).
 */
export function isHybridSigningConfigured(): boolean {
  return getEd25519PrivateKey() !== null && getMldsaPrivateKey() !== null;
}

/**
 * Get the Ed25519 public key as PEM text (for /.well-known/).
 */
export function getPublicKeyPem(): string | null {
  const pubKey = getEd25519PublicKey();
  if (!pubKey) return null;
  return pubKey.export({ type: 'spki', format: 'pem' }) as string;
}

/**
 * Get the ML-DSA-65 public key as PEM text (for /.well-known/).
 */
export function getMldsaPublicKeyPem(): string | null {
  const pubKey = getMldsaPublicKey();
  if (!pubKey) return null;
  return pubKey.export({ type: 'spki', format: 'pem' }) as string;
}

/** Return type for signDocument. */
export interface SignResult {
  /** Ed25519 signature (64 bytes) */
  signature: Buffer;
  /** ML-DSA-65 signature (~3,309 bytes), or null if PQC key not configured */
  mldsaSignature: Buffer | null;
  /** 'Ed25519+ML-DSA-65' if hybrid, 'Ed25519' if classical only */
  algorithm: string;
  /** Ed25519 key ID (first 8 hex chars of SHA-256 of public key PEM) */
  keyId: string;
  /** ML-DSA-65 key ID, or null if PQC key not configured */
  mldsaKeyId: string | null;
}

/**
 * Sign a document with CRANIS2's key pair(s).
 *
 * If both Ed25519 and ML-DSA-65 keys are configured, produces a hybrid
 * signature (both algorithms). Otherwise, falls back to Ed25519 only.
 *
 * @param content - The content to sign (typically a ZIP file or its SHA-256 hash)
 * @returns Signature result, or null if signing is not configured
 */
export function signDocument(content: Buffer): SignResult | null {
  const ed25519Key = getEd25519PrivateKey();
  const ed25519KeyId = getEd25519KeyId();
  if (!ed25519Key || !ed25519KeyId) return null;

  // Classical signature (always produced)
  const ed25519Sig = sign(null, content, ed25519Key);

  // Post-quantum signature (if configured)
  const mldsaKey = getMldsaPrivateKey();
  const mldsaKeyId = getMldsaKeyId();
  let mldsaSig: Buffer | null = null;

  if (mldsaKey) {
    mldsaSig = sign(null, content, mldsaKey);
  }

  return {
    signature: ed25519Sig,
    mldsaSignature: mldsaSig,
    algorithm: mldsaSig ? 'Ed25519+ML-DSA-65' : 'Ed25519',
    keyId: ed25519KeyId,
    mldsaKeyId: mldsaKeyId,
  };
}

/**
 * Verify an Ed25519 signature against CRANIS2's public key.
 * Use this for legacy archives signed before the PQC upgrade.
 */
export function verifySignature(content: Buffer, signature: Buffer): boolean {
  const pubKey = getEd25519PublicKey();
  if (!pubKey) return false;

  try {
    return verify(null, content, pubKey, signature);
  } catch {
    return false;
  }
}

/**
 * Verify a hybrid signature (Ed25519 + ML-DSA-65).
 * Both signatures must be valid for the verification to pass.
 *
 * @param content - The original content that was signed
 * @param ed25519Sig - The Ed25519 signature
 * @param mldsaSig - The ML-DSA-65 signature
 * @returns true if BOTH signatures are valid
 */
export function verifyHybridSignature(
  content: Buffer,
  ed25519Sig: Buffer,
  mldsaSig: Buffer
): boolean {
  const ed25519Key = getEd25519PublicKey();
  const mldsaKey = getMldsaPublicKey();

  if (!ed25519Key || !mldsaKey) return false;

  try {
    const ed25519Valid = verify(null, content, ed25519Key, ed25519Sig);
    const mldsaValid = verify(null, content, mldsaKey, mldsaSig);
    return ed25519Valid && mldsaValid;
  } catch {
    return false;
  }
}

/**
 * Document Signing Service – P8 Phase C
 *
 * Signs compliance archives with CRANIS2's Ed25519 key pair,
 * proving they were issued by the CRANIS2 platform.
 *
 * Key management:
 *   - Private key: CRANIS2_SIGNING_KEY env var (base64-encoded PEM)
 *   - Public key:  Derived from the private key, served at /.well-known/cranis2-signing-key.pem
 *   - Algorithm:   Ed25519 (EdDSA) – fast, compact 64-byte signatures
 *
 * Verification:
 *   openssl pkeyutl -verify -pubin -inkey cranis2-signing-key.pem \
 *     -sigfile archive.sig -rawin -in archive.zip
 */

import { createPrivateKey, createPublicKey, sign, verify, KeyObject } from 'node:crypto';

// ── Key ID: first 8 chars of SHA-256 of the public key PEM ──
import { createHash } from 'node:crypto';

let cachedPrivateKey: KeyObject | null = null;
let cachedPublicKey: KeyObject | null = null;
let cachedKeyId: string | null = null;

/**
 * Load the Ed25519 private key from the environment.
 * The env var holds a base64-encoded PEM string.
 */
function getPrivateKey(): KeyObject | null {
  if (cachedPrivateKey) return cachedPrivateKey;

  const encoded = process.env.CRANIS2_SIGNING_KEY;
  if (!encoded) return null;

  try {
    const pem = Buffer.from(encoded, 'base64').toString('utf-8');
    cachedPrivateKey = createPrivateKey({ key: pem, format: 'pem' });
    return cachedPrivateKey;
  } catch (err: any) {
    console.error('[SIGNING] Failed to load signing key:', err.message);
    return null;
  }
}

/**
 * Derive the public key from the private key.
 */
function getPublicKey(): KeyObject | null {
  if (cachedPublicKey) return cachedPublicKey;

  const privKey = getPrivateKey();
  if (!privKey) return null;

  cachedPublicKey = createPublicKey(privKey);
  return cachedPublicKey;
}

/**
 * Get the key ID – first 8 hex chars of SHA-256(public key PEM).
 * Used to identify which key signed a document.
 */
function getKeyId(): string | null {
  if (cachedKeyId) return cachedKeyId;

  const pubKey = getPublicKey();
  if (!pubKey) return null;

  const pem = pubKey.export({ type: 'spki', format: 'pem' }) as string;
  cachedKeyId = createHash('sha256').update(pem).digest('hex').substring(0, 8);
  return cachedKeyId;
}

/**
 * Check if document signing is configured.
 */
export function isSigningConfigured(): boolean {
  return getPrivateKey() !== null;
}

/**
 * Get the public key as PEM text (for the /.well-known/ endpoint).
 * Returns null if signing is not configured.
 */
export function getPublicKeyPem(): string | null {
  const pubKey = getPublicKey();
  if (!pubKey) return null;
  return pubKey.export({ type: 'spki', format: 'pem' }) as string;
}

/**
 * Sign a document (Buffer) with CRANIS2's Ed25519 key.
 *
 * @param content - The content to sign (typically a ZIP file or its SHA-256 hash)
 * @returns The signature, algorithm identifier, and key ID – or null if signing is not configured
 */
export function signDocument(content: Buffer): {
  signature: Buffer;
  algorithm: string;
  keyId: string;
} | null {
  const privKey = getPrivateKey();
  const keyId = getKeyId();
  if (!privKey || !keyId) return null;

  const signature = sign(null, content, privKey);

  return {
    signature,
    algorithm: 'Ed25519',
    keyId,
  };
}

/**
 * Verify a document signature against CRANIS2's public key.
 *
 * @param content - The original content that was signed
 * @param signature - The Ed25519 signature to verify
 * @returns true if valid, false otherwise
 */
export function verifySignature(content: Buffer, signature: Buffer): boolean {
  const pubKey = getPublicKey();
  if (!pubKey) return false;

  try {
    return verify(null, content, pubKey, signature);
  } catch {
    return false;
  }
}

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
 * Hybrid Signing Tests — WS2 Part 2
 *
 * Tests for:
 *   1. ML-DSA-65 key generation, signing, and verification
 *   2. Hybrid (Ed25519 + ML-DSA-65) sign/verify
 *   3. Cross-algorithm isolation (Ed25519 sig doesn't verify with ML-DSA key)
 *   4. Backwards compatibility (Ed25519-only verify for legacy archives)
 *   5. Backend endpoints (.well-known, signing key generation script)
 *   6. Node.js 24 + Docker image verification
 */

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const TEST_BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3011';
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

// ml-dsa-65 is a post-quantum key type requiring Node.js 23+ (stabilised in 24).
// Host Node versions below 23 throw at generateKeyPairSync; skip the suite cleanly instead.
const ML_DSA_SUPPORTED = (() => {
  try { crypto.generateKeyPairSync('ml-dsa-65' as any); return true; }
  catch { return false; }
})();

// ── ML-DSA-65 Availability ─────────────────────────────────────────

describe.skipIf(!ML_DSA_SUPPORTED)('ML-DSA-65 availability', () => {
  it('Node.js supports ml-dsa-65 key generation', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ml-dsa-65' as any);
    expect(publicKey).toBeTruthy();
    expect(privateKey).toBeTruthy();
  });

  it('ml-dsa-65 sign and verify round-trip works', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ml-dsa-65' as any);
    const data = Buffer.from('CRANIS2 test document');

    const signature = crypto.sign(null, data, privateKey);
    expect(signature.length).toBeGreaterThan(3000); // ML-DSA-65 sigs are ~3309 bytes

    const valid = crypto.verify(null, data, publicKey, signature);
    expect(valid).toBe(true);
  });

  it('ml-dsa-65 rejects tampered data', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ml-dsa-65' as any);
    const data = Buffer.from('original data');
    const tampered = Buffer.from('tampered data');

    const signature = crypto.sign(null, data, privateKey);
    const valid = crypto.verify(null, tampered, publicKey, signature);
    expect(valid).toBe(false);
  });

  it('ml-dsa-65 rejects wrong key', () => {
    const keyPair1 = crypto.generateKeyPairSync('ml-dsa-65' as any);
    const keyPair2 = crypto.generateKeyPairSync('ml-dsa-65' as any);
    const data = Buffer.from('test data');

    const signature = crypto.sign(null, data, keyPair1.privateKey);
    const valid = crypto.verify(null, data, keyPair2.publicKey, signature);
    expect(valid).toBe(false);
  });

  it('ml-dsa-65 keys can be exported and re-imported as PEM', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ml-dsa-65' as any);

    const pubPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
    const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

    expect(pubPem).toContain('BEGIN PUBLIC KEY');
    expect(privPem).toContain('BEGIN PRIVATE KEY');

    // Re-import and verify
    const reimportedPriv = crypto.createPrivateKey({ key: privPem, format: 'pem' });
    const reimportedPub = crypto.createPublicKey({ key: pubPem, format: 'pem' });

    const data = Buffer.from('round-trip test');
    const sig = crypto.sign(null, data, reimportedPriv);
    expect(crypto.verify(null, data, reimportedPub, sig)).toBe(true);
  });

  it('ml-dsa-65 private key can be base64-encoded and decoded (env var pattern)', () => {
    const { privateKey } = crypto.generateKeyPairSync('ml-dsa-65' as any);
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

    // Simulate env var storage
    const b64 = Buffer.from(pem).toString('base64');
    const decoded = Buffer.from(b64, 'base64').toString('utf-8');

    expect(decoded).toBe(pem);

    // Verify the decoded key works
    const restored = crypto.createPrivateKey({ key: decoded, format: 'pem' });
    const data = Buffer.from('env var round-trip');
    const sig = crypto.sign(null, data, restored);
    expect(sig.length).toBeGreaterThan(3000);
  });
});

// ── Hybrid Signing Logic ────────────────────────────────────────────

describe.skipIf(!ML_DSA_SUPPORTED)('Hybrid signing logic', () => {
  // Generate test key pairs
  const ed25519 = crypto.generateKeyPairSync('ed25519');
  const mldsa = ML_DSA_SUPPORTED ? crypto.generateKeyPairSync('ml-dsa-65' as any) : { privateKey: null, publicKey: null };
  const data = Buffer.from('CRANIS2 compliance archive content');

  it('hybrid sign produces both signatures', () => {
    const ed25519Sig = crypto.sign(null, data, ed25519.privateKey);
    const mldsaSig = crypto.sign(null, data, mldsa.privateKey);

    expect(ed25519Sig.length).toBe(64);
    expect(mldsaSig.length).toBeGreaterThan(3000);
  });

  it('hybrid verify succeeds when both signatures are valid', () => {
    const ed25519Sig = crypto.sign(null, data, ed25519.privateKey);
    const mldsaSig = crypto.sign(null, data, mldsa.privateKey);

    const ed25519Valid = crypto.verify(null, data, ed25519.publicKey, ed25519Sig);
    const mldsaValid = crypto.verify(null, data, mldsa.publicKey, mldsaSig);

    expect(ed25519Valid && mldsaValid).toBe(true);
  });

  it('hybrid verify fails if Ed25519 signature is invalid', () => {
    const mldsaSig = crypto.sign(null, data, mldsa.privateKey);
    const fakeEd25519Sig = Buffer.alloc(64, 0); // Invalid signature

    const ed25519Valid = crypto.verify(null, data, ed25519.publicKey, fakeEd25519Sig);
    const mldsaValid = crypto.verify(null, data, mldsa.publicKey, mldsaSig);

    expect(ed25519Valid && mldsaValid).toBe(false);
  });

  it('hybrid verify fails if ML-DSA-65 signature is invalid', () => {
    const ed25519Sig = crypto.sign(null, data, ed25519.privateKey);
    const fakeMldsaSig = Buffer.alloc(3309, 0); // Invalid signature

    const ed25519Valid = crypto.verify(null, data, ed25519.publicKey, ed25519Sig);
    let mldsaValid = false;
    try {
      mldsaValid = crypto.verify(null, data, mldsa.publicKey, fakeMldsaSig);
    } catch {
      mldsaValid = false;
    }

    expect(ed25519Valid && mldsaValid).toBe(false);
  });

  it('Ed25519 signature cannot be verified with ML-DSA-65 key', () => {
    const ed25519Sig = crypto.sign(null, data, ed25519.privateKey);

    let valid = false;
    try {
      valid = crypto.verify(null, data, mldsa.publicKey, ed25519Sig);
    } catch {
      valid = false;
    }
    expect(valid).toBe(false);
  });

  it('ML-DSA-65 signature cannot be verified with Ed25519 key', () => {
    const mldsaSig = crypto.sign(null, data, mldsa.privateKey);

    let valid = false;
    try {
      valid = crypto.verify(null, data, ed25519.publicKey, mldsaSig);
    } catch {
      valid = false;
    }
    expect(valid).toBe(false);
  });
});

// ── Signature Sizes ─────────────────────────────────────────────────

describe('Signature sizes', () => {
  it('Ed25519 signature is exactly 64 bytes', () => {
    const { privateKey } = crypto.generateKeyPairSync('ed25519');
    const sig = crypto.sign(null, Buffer.from('test'), privateKey);
    expect(sig.length).toBe(64);
  });

  it.skipIf(!ML_DSA_SUPPORTED)('ML-DSA-65 signature is approximately 3309 bytes', () => {
    const { privateKey } = crypto.generateKeyPairSync('ml-dsa-65' as any);
    const sig = crypto.sign(null, Buffer.from('test'), privateKey);
    // FIPS 204 ML-DSA-65 signature is exactly 3309 bytes
    expect(sig.length).toBe(3309);
  });
});

// ── Backend Endpoints ───────────────────────────────────────────────

describe('Backend signing endpoints', () => {
  it('Ed25519 .well-known endpoint exists', async () => {
    const res = await fetch(`${TEST_BASE_URL}/.well-known/cranis2-signing-key.pem`);
    // 200 if key configured, 404 if not — both are valid
    expect([200, 404]).toContain(res.status);

    if (res.status === 200) {
      const body = await res.text();
      expect(body).toContain('BEGIN PUBLIC KEY');
    }
  });

  it('ML-DSA-65 .well-known endpoint exists', async () => {
    const res = await fetch(`${TEST_BASE_URL}/.well-known/cranis2-signing-key-mldsa.pem`);
    // 200 if key configured, 404 if not — both are valid
    expect([200, 404]).toContain(res.status);

    if (res.status === 200) {
      const body = await res.text();
      expect(body).toContain('BEGIN PUBLIC KEY');
    }
  });
});

// ── Key Generation Script ───────────────────────────────────────────

describe('Key generation script', () => {
  const scriptPath = path.join(PROJECT_ROOT, 'scripts/generate-signing-keys.sh');

  it('script exists and is executable', () => {
    expect(fs.existsSync(scriptPath)).toBe(true);
    const stats = fs.statSync(scriptPath);
    expect((stats.mode & 0o100) !== 0).toBe(true);
  });

  it('has valid bash syntax', () => {
    execSync(`bash -n ${scriptPath}`, { encoding: 'utf-8' });
    expect(true).toBe(true);
  });
});

// ── Dockerfile ──────────────────────────────────────────────────────

describe('Dockerfile Node.js version', () => {
  it('Dockerfile uses node:24-alpine', () => {
    const dockerfile = fs.readFileSync(
      path.join(PROJECT_ROOT, 'backend/Dockerfile'),
      'utf-8'
    );
    expect(dockerfile).toContain('node:24-alpine');
    expect(dockerfile).not.toContain('node:22-alpine');
  });
});

// ── Signing Module Structure ────────────────────────────────────────

describe('Signing module exports', () => {
  it('signing.ts exports hybrid signing functions', () => {
    const content = fs.readFileSync(
      path.join(PROJECT_ROOT, 'backend/src/services/signing.ts'),
      'utf-8'
    );
    expect(content).toContain('export function signDocument');
    expect(content).toContain('export function verifySignature');
    expect(content).toContain('export function verifyHybridSignature');
    expect(content).toContain('export function isHybridSigningConfigured');
    expect(content).toContain('export function getMldsaPublicKeyPem');
    expect(content).toContain('mldsaSignature');
    expect(content).toContain('ML-DSA-65');
  });

  it('compliance-snapshot writes .sig.mldsa file', () => {
    const content = fs.readFileSync(
      path.join(PROJECT_ROOT, 'backend/src/services/compliance-snapshot.ts'),
      'utf-8'
    );
    expect(content).toContain('.sig.mldsa');
    expect(content).toContain('mldsaSignature');
  });

  it('retention-certificate supports mldsaSignature', () => {
    const content = fs.readFileSync(
      path.join(PROJECT_ROOT, 'backend/src/services/retention-certificate.ts'),
      'utf-8'
    );
    expect(content).toContain('mldsaSignature');
  });

  it('index.ts serves both .well-known endpoints', () => {
    const content = fs.readFileSync(
      path.join(PROJECT_ROOT, 'backend/src/index.ts'),
      'utf-8'
    );
    expect(content).toContain('cranis2-signing-key.pem');
    expect(content).toContain('cranis2-signing-key-mldsa.pem');
    expect(content).toContain('getMldsaPublicKeyPem');
  });
});

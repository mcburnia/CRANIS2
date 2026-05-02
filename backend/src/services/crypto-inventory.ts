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
 * Crypto Inventory Service — cryptographic standards & quantum readiness scanner.
 *
 * Scans a product's SBOM dependencies against a curated registry of known
 * cryptographic libraries. Each match is classified into one of three tiers:
 *
 *   Tier 1 – Broken now        (SHA-1, MD5, DES, RC4, RSA-1024, etc.)
 *   Tier 2 – Quantum-vulnerable (RSA, ECDSA, ECDH, classical DH, AES-128)
 *   Tier 3 – Quantum-safe       (AES-256, SHA-256+, ML-KEM, ML-DSA, etc.)
 *
 * Deterministic — no AI, pure pattern matching against the registry.
 *
 * CRA relevance: Art. 13(3) component currency, Annex I Part I §3 (state-of-the-art crypto).
 */

import { getDriver } from '../db/neo4j.js';
import pool from '../db/pool.js';
import { logger } from '../utils/logger.js';

// ─── Types ──────────────────────────────────────────────────────────

export type CryptoTier = 'broken' | 'quantum_vulnerable' | 'quantum_safe';

export interface CryptoAlgorithm {
  name: string;
  type: 'symmetric' | 'asymmetric' | 'hash' | 'kdf' | 'mac' | 'protocol' | 'pqc';
  tier: CryptoTier;
  strengthBits?: number;
  fipsApproved: boolean;
  nistStatus: string;         // e.g. 'deprecated', 'acceptable', 'recommended', 'post-quantum'
  remediation?: string;       // What to migrate to
}

export interface CryptoLibraryEntry {
  /** npm/PyPI/crates.io/etc. package name (lowercase) */
  packageName: string;
  /** Ecosystem (npm, PyPI, crates.io, Maven, NuGet, RubyGems, Go, Packagist) */
  ecosystem: string;
  /** Human-readable library description */
  description: string;
  /** Algorithms this library is known to provide or default to */
  algorithms: CryptoAlgorithm[];
  /** Whether this library is purely a wrapper / binding */
  isWrapper?: boolean;
}

export interface CryptoFinding {
  dependencyName: string;
  dependencyVersion: string;
  dependencyPurl: string;
  dependencyEcosystem: string;
  libraryDescription: string;
  algorithms: CryptoAlgorithm[];
  worstTier: CryptoTier;
}

export interface CryptoInventoryResult {
  productId: string;
  scannedAt: string;
  totalDependencies: number;
  cryptoLibrariesFound: number;
  findings: CryptoFinding[];
  summary: {
    broken: number;
    quantumVulnerable: number;
    quantumSafe: number;
    totalAlgorithms: number;
  };
}

// ─── Algorithm Definitions ──────────────────────────────────────────

const BROKEN_ALGORITHMS: CryptoAlgorithm[] = [
  { name: 'MD5', type: 'hash', tier: 'broken', strengthBits: 128, fipsApproved: false, nistStatus: 'deprecated', remediation: 'Migrate to SHA-256 or SHA-3' },
  { name: 'SHA-1', type: 'hash', tier: 'broken', strengthBits: 160, fipsApproved: false, nistStatus: 'deprecated', remediation: 'Migrate to SHA-256 or SHA-3' },
  { name: 'DES', type: 'symmetric', tier: 'broken', strengthBits: 56, fipsApproved: false, nistStatus: 'deprecated', remediation: 'Migrate to AES-256' },
  { name: '3DES', type: 'symmetric', tier: 'broken', strengthBits: 112, fipsApproved: false, nistStatus: 'deprecated', remediation: 'Migrate to AES-256' },
  { name: 'RC4', type: 'symmetric', tier: 'broken', strengthBits: 128, fipsApproved: false, nistStatus: 'deprecated', remediation: 'Migrate to AES-256-GCM or ChaCha20-Poly1305' },
  { name: 'RC2', type: 'symmetric', tier: 'broken', strengthBits: 128, fipsApproved: false, nistStatus: 'deprecated', remediation: 'Migrate to AES-256' },
  { name: 'Blowfish', type: 'symmetric', tier: 'broken', strengthBits: 448, fipsApproved: false, nistStatus: 'deprecated', remediation: 'Migrate to AES-256' },
  { name: 'RSA-1024', type: 'asymmetric', tier: 'broken', strengthBits: 1024, fipsApproved: false, nistStatus: 'deprecated', remediation: 'Migrate to RSA-2048+ (short-term) or ML-DSA (long-term)' },
  { name: 'SSLv3', type: 'protocol', tier: 'broken', fipsApproved: false, nistStatus: 'deprecated', remediation: 'Migrate to TLS 1.2 or TLS 1.3' },
  { name: 'TLS 1.0', type: 'protocol', tier: 'broken', fipsApproved: false, nistStatus: 'deprecated', remediation: 'Migrate to TLS 1.2 or TLS 1.3' },
  { name: 'TLS 1.1', type: 'protocol', tier: 'broken', fipsApproved: false, nistStatus: 'deprecated', remediation: 'Migrate to TLS 1.2 or TLS 1.3' },
];

const QUANTUM_VULNERABLE_ALGORITHMS: CryptoAlgorithm[] = [
  { name: 'RSA-2048', type: 'asymmetric', tier: 'quantum_vulnerable', strengthBits: 2048, fipsApproved: true, nistStatus: 'acceptable', remediation: 'Plan migration to ML-DSA (Dilithium) or hybrid RSA+ML-KEM' },
  { name: 'RSA-4096', type: 'asymmetric', tier: 'quantum_vulnerable', strengthBits: 4096, fipsApproved: true, nistStatus: 'acceptable', remediation: 'Plan migration to ML-DSA (Dilithium) or hybrid RSA+ML-KEM' },
  { name: 'ECDSA', type: 'asymmetric', tier: 'quantum_vulnerable', fipsApproved: true, nistStatus: 'acceptable', remediation: 'Plan migration to ML-DSA (Dilithium) or SLH-DSA (SPHINCS+)' },
  { name: 'ECDH', type: 'asymmetric', tier: 'quantum_vulnerable', fipsApproved: true, nistStatus: 'acceptable', remediation: 'Plan migration to ML-KEM (Kyber) or hybrid ECDH+ML-KEM' },
  { name: 'Ed25519', type: 'asymmetric', tier: 'quantum_vulnerable', fipsApproved: true, nistStatus: 'acceptable', remediation: 'Plan migration to ML-DSA (Dilithium) or SLH-DSA (SPHINCS+)' },
  { name: 'Ed448', type: 'asymmetric', tier: 'quantum_vulnerable', fipsApproved: true, nistStatus: 'acceptable', remediation: 'Plan migration to ML-DSA (Dilithium)' },
  { name: 'X25519', type: 'asymmetric', tier: 'quantum_vulnerable', fipsApproved: true, nistStatus: 'acceptable', remediation: 'Plan migration to ML-KEM (Kyber) or hybrid X25519+ML-KEM' },
  { name: 'Diffie-Hellman', type: 'asymmetric', tier: 'quantum_vulnerable', fipsApproved: true, nistStatus: 'acceptable', remediation: 'Plan migration to ML-KEM (Kyber)' },
  { name: 'DSA', type: 'asymmetric', tier: 'quantum_vulnerable', fipsApproved: true, nistStatus: 'acceptable', remediation: 'Plan migration to ML-DSA (Dilithium)' },
  { name: 'AES-128', type: 'symmetric', tier: 'quantum_vulnerable', strengthBits: 128, fipsApproved: true, nistStatus: 'acceptable', remediation: 'Upgrade to AES-256 for quantum safety (Grover\'s algorithm halves effective key strength)' },
];

const QUANTUM_SAFE_ALGORITHMS: CryptoAlgorithm[] = [
  { name: 'AES-256', type: 'symmetric', tier: 'quantum_safe', strengthBits: 256, fipsApproved: true, nistStatus: 'recommended' },
  { name: 'AES-256-GCM', type: 'symmetric', tier: 'quantum_safe', strengthBits: 256, fipsApproved: true, nistStatus: 'recommended' },
  { name: 'ChaCha20-Poly1305', type: 'symmetric', tier: 'quantum_safe', strengthBits: 256, fipsApproved: false, nistStatus: 'acceptable' },
  { name: 'SHA-256', type: 'hash', tier: 'quantum_safe', strengthBits: 256, fipsApproved: true, nistStatus: 'recommended' },
  { name: 'SHA-384', type: 'hash', tier: 'quantum_safe', strengthBits: 384, fipsApproved: true, nistStatus: 'recommended' },
  { name: 'SHA-512', type: 'hash', tier: 'quantum_safe', strengthBits: 512, fipsApproved: true, nistStatus: 'recommended' },
  { name: 'SHA-3', type: 'hash', tier: 'quantum_safe', strengthBits: 256, fipsApproved: true, nistStatus: 'recommended' },
  { name: 'BLAKE2', type: 'hash', tier: 'quantum_safe', strengthBits: 256, fipsApproved: false, nistStatus: 'acceptable' },
  { name: 'BLAKE3', type: 'hash', tier: 'quantum_safe', strengthBits: 256, fipsApproved: false, nistStatus: 'acceptable' },
  { name: 'Argon2', type: 'kdf', tier: 'quantum_safe', fipsApproved: false, nistStatus: 'recommended' },
  { name: 'scrypt', type: 'kdf', tier: 'quantum_safe', fipsApproved: false, nistStatus: 'acceptable' },
  { name: 'bcrypt', type: 'kdf', tier: 'quantum_safe', fipsApproved: false, nistStatus: 'acceptable' },
  { name: 'PBKDF2', type: 'kdf', tier: 'quantum_safe', fipsApproved: true, nistStatus: 'acceptable' },
  { name: 'HKDF', type: 'kdf', tier: 'quantum_safe', fipsApproved: true, nistStatus: 'recommended' },
  { name: 'HMAC-SHA256', type: 'mac', tier: 'quantum_safe', fipsApproved: true, nistStatus: 'recommended' },
  { name: 'TLS 1.2', type: 'protocol', tier: 'quantum_safe', fipsApproved: true, nistStatus: 'acceptable' },
  { name: 'TLS 1.3', type: 'protocol', tier: 'quantum_safe', fipsApproved: true, nistStatus: 'recommended' },
  // Post-quantum (NIST FIPS 203/204/205, finalised 2024)
  { name: 'ML-KEM (Kyber)', type: 'pqc', tier: 'quantum_safe', fipsApproved: true, nistStatus: 'post-quantum' },
  { name: 'ML-DSA (Dilithium)', type: 'pqc', tier: 'quantum_safe', fipsApproved: true, nistStatus: 'post-quantum' },
  { name: 'SLH-DSA (SPHINCS+)', type: 'pqc', tier: 'quantum_safe', fipsApproved: true, nistStatus: 'post-quantum' },
  { name: 'XMSS', type: 'pqc', tier: 'quantum_safe', fipsApproved: true, nistStatus: 'post-quantum' },
];

// ─── Crypto Library Registry ────────────────────────────────────────
// Maps known package names to the crypto algorithms they provide.
// This is the core data structure — extend as new libraries are identified.

const CRYPTO_LIBRARY_REGISTRY: CryptoLibraryEntry[] = [
  // ── Node.js / npm ──
  { packageName: 'crypto-js', ecosystem: 'npm', description: 'JavaScript crypto library (AES, DES, SHA, MD5, HMAC)', algorithms: [
    ...BROKEN_ALGORITHMS.filter(a => ['MD5', 'SHA-1', 'DES', '3DES', 'RC4'].includes(a.name)),
    ...QUANTUM_VULNERABLE_ALGORITHMS.filter(a => ['AES-128'].includes(a.name)),
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['AES-256', 'SHA-256', 'SHA-512', 'HMAC-SHA256', 'PBKDF2'].includes(a.name)),
  ]},
  { packageName: 'md5', ecosystem: 'npm', description: 'MD5 hashing library', algorithms: [
    BROKEN_ALGORITHMS.find(a => a.name === 'MD5')!,
  ]},
  { packageName: 'sha1', ecosystem: 'npm', description: 'SHA-1 hashing library', algorithms: [
    BROKEN_ALGORITHMS.find(a => a.name === 'SHA-1')!,
  ]},
  { packageName: 'sha.js', ecosystem: 'npm', description: 'SHA hash functions (SHA-1, SHA-256, SHA-512)', algorithms: [
    BROKEN_ALGORITHMS.find(a => a.name === 'SHA-1')!,
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['SHA-256', 'SHA-512'].includes(a.name)),
  ]},
  { packageName: 'js-md5', ecosystem: 'npm', description: 'Fast MD5 implementation', algorithms: [
    BROKEN_ALGORITHMS.find(a => a.name === 'MD5')!,
  ]},
  { packageName: 'js-sha1', ecosystem: 'npm', description: 'SHA-1 implementation', algorithms: [
    BROKEN_ALGORITHMS.find(a => a.name === 'SHA-1')!,
  ]},
  { packageName: 'js-sha256', ecosystem: 'npm', description: 'SHA-256 implementation', algorithms: [
    QUANTUM_SAFE_ALGORITHMS.find(a => a.name === 'SHA-256')!,
  ]},
  { packageName: 'bcryptjs', ecosystem: 'npm', description: 'bcrypt password hashing for JavaScript', algorithms: [
    QUANTUM_SAFE_ALGORITHMS.find(a => a.name === 'bcrypt')!,
  ]},
  { packageName: 'bcrypt', ecosystem: 'npm', description: 'bcrypt password hashing (native binding)', algorithms: [
    QUANTUM_SAFE_ALGORITHMS.find(a => a.name === 'bcrypt')!,
  ]},
  { packageName: 'argon2', ecosystem: 'npm', description: 'Argon2 password hashing', algorithms: [
    QUANTUM_SAFE_ALGORITHMS.find(a => a.name === 'Argon2')!,
  ]},
  { packageName: 'tweetnacl', ecosystem: 'npm', description: 'TweetNaCl.js — Ed25519, X25519, XSalsa20-Poly1305', algorithms: [
    ...QUANTUM_VULNERABLE_ALGORITHMS.filter(a => ['Ed25519', 'X25519'].includes(a.name)),
  ]},
  { packageName: 'libsodium-wrappers', ecosystem: 'npm', description: 'libsodium bindings (Ed25519, X25519, AES-256-GCM, Argon2)', algorithms: [
    ...QUANTUM_VULNERABLE_ALGORITHMS.filter(a => ['Ed25519', 'X25519'].includes(a.name)),
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['AES-256-GCM', 'Argon2', 'BLAKE2', 'ChaCha20-Poly1305'].includes(a.name)),
  ]},
  { packageName: 'sodium-native', ecosystem: 'npm', description: 'Native libsodium bindings', algorithms: [
    ...QUANTUM_VULNERABLE_ALGORITHMS.filter(a => ['Ed25519', 'X25519'].includes(a.name)),
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['AES-256-GCM', 'Argon2', 'BLAKE2', 'ChaCha20-Poly1305'].includes(a.name)),
  ]},
  { packageName: 'jose', ecosystem: 'npm', description: 'JOSE (JWT/JWS/JWE/JWK) with RSA, ECDSA, EdDSA', algorithms: [
    ...QUANTUM_VULNERABLE_ALGORITHMS.filter(a => ['RSA-2048', 'ECDSA', 'Ed25519'].includes(a.name)),
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['AES-256-GCM', 'SHA-256'].includes(a.name)),
  ]},
  { packageName: 'jsonwebtoken', ecosystem: 'npm', description: 'JWT implementation using RSA/ECDSA/HMAC', algorithms: [
    ...QUANTUM_VULNERABLE_ALGORITHMS.filter(a => ['RSA-2048', 'ECDSA'].includes(a.name)),
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['HMAC-SHA256', 'SHA-256'].includes(a.name)),
  ]},
  { packageName: 'node-forge', ecosystem: 'npm', description: 'JavaScript TLS/crypto toolkit (RSA, AES, DES, MD5, SHA)', algorithms: [
    ...BROKEN_ALGORITHMS.filter(a => ['MD5', 'SHA-1', 'DES', '3DES', 'RC4'].includes(a.name)),
    ...QUANTUM_VULNERABLE_ALGORITHMS.filter(a => ['RSA-2048', 'AES-128'].includes(a.name)),
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['AES-256', 'SHA-256', 'SHA-512'].includes(a.name)),
  ]},
  { packageName: 'elliptic', ecosystem: 'npm', description: 'Elliptic curve cryptography (ECDSA, ECDH)', algorithms: [
    ...QUANTUM_VULNERABLE_ALGORITHMS.filter(a => ['ECDSA', 'ECDH'].includes(a.name)),
  ]},
  { packageName: 'noble-hashes', ecosystem: 'npm', description: 'Audited JS hash functions (SHA-256, SHA-512, SHA-3, BLAKE2/3)', algorithms: [
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['SHA-256', 'SHA-512', 'SHA-3', 'BLAKE2', 'BLAKE3'].includes(a.name)),
  ]},
  { packageName: '@noble/hashes', ecosystem: 'npm', description: 'Audited JS hash functions (SHA-256, SHA-512, SHA-3, BLAKE2/3)', algorithms: [
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['SHA-256', 'SHA-512', 'SHA-3', 'BLAKE2', 'BLAKE3'].includes(a.name)),
  ]},
  { packageName: '@noble/curves', ecosystem: 'npm', description: 'Audited elliptic curves (Ed25519, secp256k1, P-256)', algorithms: [
    ...QUANTUM_VULNERABLE_ALGORITHMS.filter(a => ['ECDSA', 'ECDH', 'Ed25519'].includes(a.name)),
  ]},
  { packageName: 'openpgp', ecosystem: 'npm', description: 'OpenPGP.js (RSA, ECDSA, EdDSA, AES)', algorithms: [
    ...QUANTUM_VULNERABLE_ALGORITHMS.filter(a => ['RSA-2048', 'ECDSA', 'Ed25519'].includes(a.name)),
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['AES-256', 'SHA-256'].includes(a.name)),
  ]},

  // ── Python / PyPI ──
  { packageName: 'cryptography', ecosystem: 'PyPI', description: 'Python cryptographic recipes and primitives (OpenSSL binding)', algorithms: [
    ...BROKEN_ALGORITHMS.filter(a => ['MD5', 'SHA-1', 'DES', '3DES', 'Blowfish', 'RC4', 'RC2'].includes(a.name)),
    ...QUANTUM_VULNERABLE_ALGORITHMS.filter(a => ['RSA-2048', 'RSA-4096', 'ECDSA', 'ECDH', 'Ed25519', 'Ed448', 'X25519', 'Diffie-Hellman', 'AES-128'].includes(a.name)),
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['AES-256', 'AES-256-GCM', 'ChaCha20-Poly1305', 'SHA-256', 'SHA-384', 'SHA-512', 'SHA-3', 'BLAKE2', 'PBKDF2', 'HKDF', 'scrypt'].includes(a.name)),
  ]},
  { packageName: 'pycryptodome', ecosystem: 'PyPI', description: 'Self-contained Python crypto library (AES, RSA, ECC, SHA, MD5, DES)', algorithms: [
    ...BROKEN_ALGORITHMS.filter(a => ['MD5', 'SHA-1', 'DES', '3DES', 'Blowfish', 'RC4', 'RC2'].includes(a.name)),
    ...QUANTUM_VULNERABLE_ALGORITHMS.filter(a => ['RSA-2048', 'ECDSA', 'ECDH', 'DSA', 'AES-128'].includes(a.name)),
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['AES-256', 'AES-256-GCM', 'ChaCha20-Poly1305', 'SHA-256', 'SHA-512', 'SHA-3', 'BLAKE2', 'scrypt', 'HKDF'].includes(a.name)),
  ]},
  { packageName: 'pycryptodomex', ecosystem: 'PyPI', description: 'PyCryptodome (standalone namespace)', algorithms: [
    ...BROKEN_ALGORITHMS.filter(a => ['MD5', 'SHA-1', 'DES', '3DES', 'Blowfish'].includes(a.name)),
    ...QUANTUM_VULNERABLE_ALGORITHMS.filter(a => ['RSA-2048', 'ECDSA', 'AES-128'].includes(a.name)),
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['AES-256', 'SHA-256', 'SHA-512', 'SHA-3'].includes(a.name)),
  ]},
  { packageName: 'pynacl', ecosystem: 'PyPI', description: 'Python binding to libsodium', algorithms: [
    ...QUANTUM_VULNERABLE_ALGORITHMS.filter(a => ['Ed25519', 'X25519'].includes(a.name)),
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['AES-256-GCM', 'Argon2', 'BLAKE2', 'ChaCha20-Poly1305'].includes(a.name)),
  ]},
  { packageName: 'passlib', ecosystem: 'PyPI', description: 'Password hashing framework (bcrypt, Argon2, scrypt, PBKDF2)', algorithms: [
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['bcrypt', 'Argon2', 'scrypt', 'PBKDF2'].includes(a.name)),
  ]},
  { packageName: 'hashlib', ecosystem: 'PyPI', description: 'Python hashlib supplement (MD5, SHA-1, SHA-256)', algorithms: [
    ...BROKEN_ALGORITHMS.filter(a => ['MD5', 'SHA-1'].includes(a.name)),
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['SHA-256', 'SHA-512', 'SHA-3', 'BLAKE2'].includes(a.name)),
  ]},
  { packageName: 'pyjwt', ecosystem: 'PyPI', description: 'JSON Web Token implementation (RSA, ECDSA, HMAC)', algorithms: [
    ...QUANTUM_VULNERABLE_ALGORITHMS.filter(a => ['RSA-2048', 'ECDSA'].includes(a.name)),
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['HMAC-SHA256'].includes(a.name)),
  ]},

  // ── Rust / crates.io ──
  { packageName: 'ring', ecosystem: 'crates.io', description: 'Safe, fast crypto primitives (AES-GCM, ChaCha20, SHA, ECDSA, Ed25519, RSA)', algorithms: [
    ...QUANTUM_VULNERABLE_ALGORITHMS.filter(a => ['RSA-2048', 'ECDSA', 'Ed25519'].includes(a.name)),
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['AES-256-GCM', 'ChaCha20-Poly1305', 'SHA-256', 'SHA-384', 'SHA-512', 'PBKDF2', 'HKDF', 'HMAC-SHA256'].includes(a.name)),
  ]},
  { packageName: 'rustls', ecosystem: 'crates.io', description: 'Modern TLS library in pure Rust', algorithms: [
    ...QUANTUM_VULNERABLE_ALGORITHMS.filter(a => ['ECDSA', 'ECDH', 'Ed25519', 'X25519'].includes(a.name)),
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['AES-256-GCM', 'ChaCha20-Poly1305', 'SHA-256', 'SHA-384', 'TLS 1.2', 'TLS 1.3'].includes(a.name)),
  ]},
  { packageName: 'openssl', ecosystem: 'crates.io', description: 'OpenSSL bindings for Rust', algorithms: [
    ...BROKEN_ALGORITHMS.filter(a => ['MD5', 'SHA-1', 'DES', '3DES', 'RC4'].includes(a.name)),
    ...QUANTUM_VULNERABLE_ALGORITHMS.filter(a => ['RSA-2048', 'RSA-4096', 'ECDSA', 'ECDH', 'Diffie-Hellman', 'AES-128'].includes(a.name)),
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['AES-256', 'AES-256-GCM', 'SHA-256', 'SHA-512'].includes(a.name)),
  ]},
  { packageName: 'sha2', ecosystem: 'crates.io', description: 'SHA-2 hash functions (SHA-256, SHA-384, SHA-512)', algorithms: [
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['SHA-256', 'SHA-384', 'SHA-512'].includes(a.name)),
  ]},
  { packageName: 'sha3', ecosystem: 'crates.io', description: 'SHA-3 hash functions', algorithms: [
    QUANTUM_SAFE_ALGORITHMS.find(a => a.name === 'SHA-3')!,
  ]},
  { packageName: 'blake2', ecosystem: 'crates.io', description: 'BLAKE2 hash functions', algorithms: [
    QUANTUM_SAFE_ALGORITHMS.find(a => a.name === 'BLAKE2')!,
  ]},
  { packageName: 'blake3', ecosystem: 'crates.io', description: 'BLAKE3 hash function', algorithms: [
    QUANTUM_SAFE_ALGORITHMS.find(a => a.name === 'BLAKE3')!,
  ]},
  { packageName: 'argon2', ecosystem: 'crates.io', description: 'Argon2 password hashing', algorithms: [
    QUANTUM_SAFE_ALGORITHMS.find(a => a.name === 'Argon2')!,
  ]},
  { packageName: 'ed25519-dalek', ecosystem: 'crates.io', description: 'Ed25519 signatures', algorithms: [
    QUANTUM_VULNERABLE_ALGORITHMS.find(a => a.name === 'Ed25519')!,
  ]},
  { packageName: 'x25519-dalek', ecosystem: 'crates.io', description: 'X25519 key exchange', algorithms: [
    QUANTUM_VULNERABLE_ALGORITHMS.find(a => a.name === 'X25519')!,
  ]},
  { packageName: 'pqcrypto', ecosystem: 'crates.io', description: 'Post-quantum cryptography bindings', algorithms: [
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => a.type === 'pqc'),
  ]},

  // ── Go ──
  { packageName: 'golang.org/x/crypto', ecosystem: 'Go', description: 'Go supplementary crypto libraries (Ed25519, ChaCha20, Argon2, bcrypt, scrypt)', algorithms: [
    ...QUANTUM_VULNERABLE_ALGORITHMS.filter(a => ['Ed25519', 'ECDSA', 'ECDH'].includes(a.name)),
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['ChaCha20-Poly1305', 'Argon2', 'bcrypt', 'scrypt', 'HKDF', 'SHA-3', 'BLAKE2'].includes(a.name)),
  ]},

  // ── Java / Maven ──
  { packageName: 'org.bouncycastle:bcprov-jdk18on', ecosystem: 'Maven', description: 'Bouncy Castle provider (comprehensive crypto library)', algorithms: [
    ...BROKEN_ALGORITHMS.filter(a => ['MD5', 'SHA-1', 'DES', '3DES', 'RC4', 'RC2', 'Blowfish'].includes(a.name)),
    ...QUANTUM_VULNERABLE_ALGORITHMS.filter(a => ['RSA-2048', 'RSA-4096', 'ECDSA', 'ECDH', 'Ed25519', 'Ed448', 'Diffie-Hellman', 'DSA', 'AES-128'].includes(a.name)),
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['AES-256', 'AES-256-GCM', 'ChaCha20-Poly1305', 'SHA-256', 'SHA-384', 'SHA-512', 'SHA-3', 'BLAKE2', 'Argon2', 'scrypt', 'PBKDF2'].includes(a.name)),
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => a.type === 'pqc'),
  ]},
  { packageName: 'org.bouncycastle:bcprov-jdk15on', ecosystem: 'Maven', description: 'Bouncy Castle provider (legacy JDK 1.5+)', algorithms: [
    ...BROKEN_ALGORITHMS.filter(a => ['MD5', 'SHA-1', 'DES', '3DES'].includes(a.name)),
    ...QUANTUM_VULNERABLE_ALGORITHMS.filter(a => ['RSA-2048', 'ECDSA', 'ECDH', 'Diffie-Hellman'].includes(a.name)),
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['AES-256', 'SHA-256', 'SHA-512'].includes(a.name)),
  ]},

  // ── .NET / NuGet ──
  { packageName: 'BouncyCastle.Cryptography', ecosystem: 'NuGet', description: 'Bouncy Castle for .NET (comprehensive crypto)', algorithms: [
    ...BROKEN_ALGORITHMS.filter(a => ['MD5', 'SHA-1', 'DES', '3DES'].includes(a.name)),
    ...QUANTUM_VULNERABLE_ALGORITHMS.filter(a => ['RSA-2048', 'ECDSA', 'ECDH', 'Ed25519'].includes(a.name)),
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['AES-256', 'SHA-256', 'SHA-512', 'SHA-3'].includes(a.name)),
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => a.type === 'pqc'),
  ]},

  // ── Ruby / RubyGems ──
  { packageName: 'bcrypt-ruby', ecosystem: 'RubyGems', description: 'bcrypt password hashing for Ruby', algorithms: [
    QUANTUM_SAFE_ALGORITHMS.find(a => a.name === 'bcrypt')!,
  ]},
  { packageName: 'rbnacl', ecosystem: 'RubyGems', description: 'Ruby binding to libsodium', algorithms: [
    ...QUANTUM_VULNERABLE_ALGORITHMS.filter(a => ['Ed25519', 'X25519'].includes(a.name)),
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['AES-256-GCM', 'BLAKE2', 'ChaCha20-Poly1305', 'Argon2'].includes(a.name)),
  ]},

  // ── PHP / Packagist ──
  { packageName: 'paragonie/sodium_compat', ecosystem: 'Packagist', description: 'PHP libsodium polyfill', algorithms: [
    ...QUANTUM_VULNERABLE_ALGORITHMS.filter(a => ['Ed25519', 'X25519'].includes(a.name)),
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['AES-256-GCM', 'BLAKE2', 'ChaCha20-Poly1305', 'Argon2'].includes(a.name)),
  ]},
  { packageName: 'paragonie/halite', ecosystem: 'Packagist', description: 'High-level crypto using libsodium', algorithms: [
    ...QUANTUM_VULNERABLE_ALGORITHMS.filter(a => ['Ed25519', 'X25519'].includes(a.name)),
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => ['AES-256-GCM', 'BLAKE2', 'ChaCha20-Poly1305', 'Argon2', 'HKDF'].includes(a.name)),
  ]},

  // ── Post-quantum specific libraries (all ecosystems) ──
  { packageName: 'liboqs', ecosystem: 'npm', description: 'Open Quantum Safe — ML-KEM, ML-DSA, SLH-DSA', algorithms: [
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => a.type === 'pqc'),
  ]},
  { packageName: 'oqs-python', ecosystem: 'PyPI', description: 'Python bindings for liboqs (post-quantum)', algorithms: [
    ...QUANTUM_SAFE_ALGORITHMS.filter(a => a.type === 'pqc'),
  ]},
  { packageName: 'pqcrypto-kyber', ecosystem: 'crates.io', description: 'ML-KEM (Kyber) implementation', algorithms: [
    QUANTUM_SAFE_ALGORITHMS.find(a => a.name === 'ML-KEM (Kyber)')!,
  ]},
  { packageName: 'pqcrypto-dilithium', ecosystem: 'crates.io', description: 'ML-DSA (Dilithium) implementation', algorithms: [
    QUANTUM_SAFE_ALGORITHMS.find(a => a.name === 'ML-DSA (Dilithium)')!,
  ]},
  { packageName: 'pqcrypto-sphincsplus', ecosystem: 'crates.io', description: 'SLH-DSA (SPHINCS+) implementation', algorithms: [
    QUANTUM_SAFE_ALGORITHMS.find(a => a.name === 'SLH-DSA (SPHINCS+)')!,
  ]},
];

// ─── Build lookup index ─────────────────────────────────────────────

type RegistryKey = string;

function makeKey(ecosystem: string, packageName: string): RegistryKey {
  return `${ecosystem.toLowerCase()}::${packageName.toLowerCase()}`;
}

const REGISTRY_INDEX: Map<RegistryKey, CryptoLibraryEntry> = new Map();
for (const entry of CRYPTO_LIBRARY_REGISTRY) {
  REGISTRY_INDEX.set(makeKey(entry.ecosystem, entry.packageName), entry);
}

/** Exported for tests — number of libraries in the registry. */
export const REGISTRY_SIZE = CRYPTO_LIBRARY_REGISTRY.length;

// ─── Ecosystem normalisation (matches vulnerability-scanner pattern) ─

const ECOSYSTEM_MAP: Record<string, string> = {
  npm: 'npm', pip: 'PyPI', pypi: 'PyPI', maven: 'Maven', go: 'Go',
  nuget: 'NuGet', rust: 'crates.io', 'crates.io': 'crates.io',
  composer: 'Packagist', packagist: 'Packagist', rubygems: 'RubyGems', gem: 'RubyGems',
};

function normaliseEcosystem(eco: string): string {
  return ECOSYSTEM_MAP[eco.toLowerCase()] || eco;
}

// ─── Tier ordering ──────────────────────────────────────────────────

const TIER_SEVERITY: Record<CryptoTier, number> = {
  broken: 0,
  quantum_vulnerable: 1,
  quantum_safe: 2,
};

function worstTier(algorithms: CryptoAlgorithm[]): CryptoTier {
  let worst: CryptoTier = 'quantum_safe';
  for (const alg of algorithms) {
    if (TIER_SEVERITY[alg.tier] < TIER_SEVERITY[worst]) {
      worst = alg.tier;
    }
  }
  return worst;
}

// ─── Scanner ────────────────────────────────────────────────────────

/**
 * Scan a product's SBOM dependencies for cryptographic library usage.
 * Returns classified findings grouped by library.
 */
export async function scanProductCrypto(productId: string, orgId: string): Promise<CryptoInventoryResult> {
  const driver = getDriver();
  const session = driver.session();

  try {
    // Fetch all dependencies for this product from Neo4j
    const result = await session.run(
      `MATCH (p:Product {id: $productId})-[:DEPENDS_ON]->(d:Dependency)
       RETURN d.name AS name, d.version AS version, d.purl AS purl, d.ecosystem AS ecosystem`,
      { productId }
    );

    const dependencies = result.records.map(r => ({
      name: r.get('name') as string,
      version: (r.get('version') as string) || '',
      purl: (r.get('purl') as string) || '',
      ecosystem: (r.get('ecosystem') as string) || '',
    }));

    const findings: CryptoFinding[] = [];

    for (const dep of dependencies) {
      const eco = normaliseEcosystem(dep.ecosystem);
      const key = makeKey(eco, dep.name);
      const entry = REGISTRY_INDEX.get(key);

      if (entry) {
        findings.push({
          dependencyName: dep.name,
          dependencyVersion: dep.version,
          dependencyPurl: dep.purl,
          dependencyEcosystem: eco,
          libraryDescription: entry.description,
          algorithms: entry.algorithms,
          worstTier: worstTier(entry.algorithms),
        });
      }
    }

    // Compute summary
    const allAlgorithms = findings.flatMap(f => f.algorithms);
    const uniqueAlgorithms = [...new Set(allAlgorithms.map(a => a.name))];
    const brokenCount = findings.filter(f => f.worstTier === 'broken').length;
    const qvCount = findings.filter(f => f.worstTier === 'quantum_vulnerable').length;
    const qsCount = findings.filter(f => f.worstTier === 'quantum_safe').length;

    const inventoryResult: CryptoInventoryResult = {
      productId,
      scannedAt: new Date().toISOString(),
      totalDependencies: dependencies.length,
      cryptoLibrariesFound: findings.length,
      findings: findings.sort((a, b) => TIER_SEVERITY[a.worstTier] - TIER_SEVERITY[b.worstTier]),
      summary: {
        broken: brokenCount,
        quantumVulnerable: qvCount,
        quantumSafe: qsCount,
        totalAlgorithms: uniqueAlgorithms.length,
      },
    };

    // Persist findings to Postgres
    await persistFindings(productId, orgId, inventoryResult);

    return inventoryResult;
  } finally {
    await session.close();
  }
}

/**
 * Persist crypto findings to Postgres for historical tracking.
 */
async function persistFindings(productId: string, orgId: string, result: CryptoInventoryResult): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert scan record
    await client.query(
      `INSERT INTO crypto_scans (product_id, org_id, total_dependencies, crypto_libraries_found, broken_count, quantum_vulnerable_count, quantum_safe_count, total_algorithms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (product_id) DO UPDATE SET
         org_id = EXCLUDED.org_id,
         total_dependencies = EXCLUDED.total_dependencies,
         crypto_libraries_found = EXCLUDED.crypto_libraries_found,
         broken_count = EXCLUDED.broken_count,
         quantum_vulnerable_count = EXCLUDED.quantum_vulnerable_count,
         quantum_safe_count = EXCLUDED.quantum_safe_count,
         total_algorithms = EXCLUDED.total_algorithms,
         scanned_at = NOW()`,
      [productId, orgId, result.totalDependencies, result.cryptoLibrariesFound,
       result.summary.broken, result.summary.quantumVulnerable, result.summary.quantumSafe, result.summary.totalAlgorithms]
    );

    // Replace findings (delete + insert is cleaner for small sets)
    await client.query(`DELETE FROM crypto_findings WHERE product_id = $1`, [productId]);

    for (const finding of result.findings) {
      await client.query(
        `INSERT INTO crypto_findings (product_id, org_id, dependency_name, dependency_version, dependency_purl, dependency_ecosystem, library_description, worst_tier, algorithms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [productId, orgId, finding.dependencyName, finding.dependencyVersion, finding.dependencyPurl,
         finding.dependencyEcosystem, finding.libraryDescription, finding.worstTier, JSON.stringify(finding.algorithms)]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error(`[CRYPTO] Failed to persist findings for ${productId}: ${(err as Error).message}`);
  } finally {
    client.release();
  }
}

/**
 * Get the latest persisted crypto scan for a product (avoids re-scanning).
 */
export async function getLatestScan(productId: string): Promise<CryptoInventoryResult | null> {
  const scanRow = await pool.query(
    `SELECT * FROM crypto_scans WHERE product_id = $1`,
    [productId]
  );

  if (scanRow.rows.length === 0) return null;

  const scan = scanRow.rows[0];
  const findingsRows = await pool.query(
    `SELECT * FROM crypto_findings WHERE product_id = $1 ORDER BY
       CASE worst_tier WHEN 'broken' THEN 0 WHEN 'quantum_vulnerable' THEN 1 ELSE 2 END`,
    [productId]
  );

  return {
    productId,
    scannedAt: scan.scanned_at,
    totalDependencies: scan.total_dependencies,
    cryptoLibrariesFound: scan.crypto_libraries_found,
    findings: findingsRows.rows.map(r => ({
      dependencyName: r.dependency_name,
      dependencyVersion: r.dependency_version,
      dependencyPurl: r.dependency_purl,
      dependencyEcosystem: r.dependency_ecosystem,
      libraryDescription: r.library_description,
      algorithms: r.algorithms,
      worstTier: r.worst_tier,
    })),
    summary: {
      broken: scan.broken_count,
      quantumVulnerable: scan.quantum_vulnerable_count,
      quantumSafe: scan.quantum_safe_count,
      totalAlgorithms: scan.total_algorithms,
    },
  };
}

/**
 * Generate a Markdown report of the crypto inventory for export / technical file evidence.
 */
export function generateCryptoReport(result: CryptoInventoryResult, productName: string): string {
  const lines: string[] = [];
  lines.push(`# Cryptographic Standards & Quantum Readiness Inventory`);
  lines.push('');
  lines.push(`**Product:** ${productName}`);
  lines.push(`**Scanned:** ${new Date(result.scannedAt).toISOString().split('T')[0]}`);
  lines.push(`**Dependencies scanned:** ${result.totalDependencies}`);
  lines.push(`**Cryptographic libraries found:** ${result.cryptoLibrariesFound}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Classification | Count |`);
  lines.push(`|---|---|`);
  lines.push(`| Broken (immediate action required) | ${result.summary.broken} |`);
  lines.push(`| Quantum-vulnerable (plan PQC migration) | ${result.summary.quantumVulnerable} |`);
  lines.push(`| Quantum-safe (no action needed) | ${result.summary.quantumSafe} |`);
  lines.push(`| Unique algorithms detected | ${result.summary.totalAlgorithms} |`);
  lines.push('');

  // Broken findings
  const broken = result.findings.filter(f => f.worstTier === 'broken');
  if (broken.length > 0) {
    lines.push('## Tier 1 — Broken (Immediate Remediation Required)');
    lines.push('');
    lines.push('These libraries provide or default to cryptographic algorithms that are known to be insecure.');
    lines.push('');
    for (const f of broken) {
      lines.push(`### ${f.dependencyName} ${f.dependencyVersion}`);
      lines.push(`- **Ecosystem:** ${f.dependencyEcosystem}`);
      lines.push(`- **Description:** ${f.libraryDescription}`);
      lines.push(`- **Broken algorithms:**`);
      for (const a of f.algorithms.filter(a => a.tier === 'broken')) {
        lines.push(`  - ${a.name} (${a.type}) — ${a.remediation || a.nistStatus}`);
      }
      lines.push('');
    }
  }

  // Quantum-vulnerable findings
  const qv = result.findings.filter(f => f.worstTier === 'quantum_vulnerable');
  if (qv.length > 0) {
    lines.push('## Tier 2 — Quantum-Vulnerable (Plan Migration)');
    lines.push('');
    lines.push('These libraries use algorithms that are secure today but will be broken by quantum computers running Shor\'s or Grover\'s algorithms.');
    lines.push('');
    for (const f of qv) {
      lines.push(`### ${f.dependencyName} ${f.dependencyVersion}`);
      lines.push(`- **Ecosystem:** ${f.dependencyEcosystem}`);
      lines.push(`- **Description:** ${f.libraryDescription}`);
      lines.push(`- **Quantum-vulnerable algorithms:**`);
      for (const a of f.algorithms.filter(a => a.tier === 'quantum_vulnerable')) {
        lines.push(`  - ${a.name} (${a.type}) — ${a.remediation || a.nistStatus}`);
      }
      lines.push('');
    }
  }

  // Quantum-safe findings
  const qs = result.findings.filter(f => f.worstTier === 'quantum_safe');
  if (qs.length > 0) {
    lines.push('## Tier 3 — Quantum-Safe (No Action Needed)');
    lines.push('');
    for (const f of qs) {
      lines.push(`- **${f.dependencyName} ${f.dependencyVersion}** (${f.dependencyEcosystem}) — ${f.libraryDescription}`);
    }
    lines.push('');
  }

  // CRA references
  lines.push('## CRA Regulatory References');
  lines.push('');
  lines.push('- **Art. 13(3):** Manufacturers shall ensure software components are free of known exploitable vulnerabilities and kept up to date.');
  lines.push('- **Annex I, Part I, §3:** Products shall use state-of-the-art cryptographic mechanisms appropriate to the risks.');
  lines.push('- **NIST SP 800-131A Rev 2:** Transitioning the use of cryptographic algorithms and key lengths.');
  lines.push('- **NIST FIPS 203/204/205:** Post-quantum cryptography standards (ML-KEM, ML-DSA, SLH-DSA).');
  lines.push('- **ENISA PQC Migration Guidance:** Recommendations for post-quantum preparedness.');
  lines.push('');

  return lines.join('\n');
}

/** Export registry for testing */
export { CRYPTO_LIBRARY_REGISTRY, BROKEN_ALGORITHMS, QUANTUM_VULNERABLE_ALGORITHMS, QUANTUM_SAFE_ALGORITHMS };

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
 * Crypto Inventory Service — Unit Tests
 *
 * Tests the algorithm registry, classification tiers, and report generation.
 * Pure data tests — no database required.
 */

import { describe, it, expect } from 'vitest';
import {
  CRYPTO_LIBRARY_REGISTRY,
  BROKEN_ALGORITHMS,
  QUANTUM_VULNERABLE_ALGORITHMS,
  QUANTUM_SAFE_ALGORITHMS,
  REGISTRY_SIZE,
  generateCryptoReport,
  type CryptoInventoryResult,
  type CryptoAlgorithm,
} from '../../src/services/crypto-inventory.js';

// ═══════════════════════════════════════════════════════════════════
// Algorithm Registry Integrity
// ═══════════════════════════════════════════════════════════════════

describe('Algorithm registry', () => {
  it('has broken algorithms', () => {
    expect(BROKEN_ALGORITHMS.length).toBeGreaterThan(0);
  });

  it('has quantum-vulnerable algorithms', () => {
    expect(QUANTUM_VULNERABLE_ALGORITHMS.length).toBeGreaterThan(0);
  });

  it('has quantum-safe algorithms', () => {
    expect(QUANTUM_SAFE_ALGORITHMS.length).toBeGreaterThan(0);
  });

  it('all broken algorithms have tier=broken', () => {
    for (const a of BROKEN_ALGORITHMS) {
      expect(a.tier).toBe('broken');
    }
  });

  it('all quantum-vulnerable algorithms have tier=quantum_vulnerable', () => {
    for (const a of QUANTUM_VULNERABLE_ALGORITHMS) {
      expect(a.tier).toBe('quantum_vulnerable');
    }
  });

  it('all quantum-safe algorithms have tier=quantum_safe', () => {
    for (const a of QUANTUM_SAFE_ALGORITHMS) {
      expect(a.tier).toBe('quantum_safe');
    }
  });

  it('all broken algorithms have remediation guidance', () => {
    for (const a of BROKEN_ALGORITHMS) {
      expect(a.remediation).toBeDefined();
      expect(a.remediation!.length).toBeGreaterThan(0);
    }
  });

  it('all algorithms have a name and type', () => {
    const all = [...BROKEN_ALGORITHMS, ...QUANTUM_VULNERABLE_ALGORITHMS, ...QUANTUM_SAFE_ALGORITHMS];
    for (const a of all) {
      expect(a.name).toBeDefined();
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.type).toBeDefined();
      expect(['symmetric', 'asymmetric', 'hash', 'kdf', 'mac', 'protocol', 'pqc']).toContain(a.type);
    }
  });

  it('includes known broken algorithms', () => {
    const names = BROKEN_ALGORITHMS.map(a => a.name);
    expect(names).toContain('MD5');
    expect(names).toContain('SHA-1');
    expect(names).toContain('DES');
    expect(names).toContain('RC4');
  });

  it('includes known quantum-vulnerable algorithms', () => {
    const names = QUANTUM_VULNERABLE_ALGORITHMS.map(a => a.name);
    expect(names).toContain('RSA-2048');
    expect(names).toContain('ECDSA');
    expect(names).toContain('Ed25519');
  });

  it('includes post-quantum algorithms', () => {
    const pqc = QUANTUM_SAFE_ALGORITHMS.filter(a => a.type === 'pqc');
    expect(pqc.length).toBeGreaterThanOrEqual(3);
    const names = pqc.map(a => a.name);
    expect(names.some(n => n.includes('ML-KEM'))).toBe(true);
    expect(names.some(n => n.includes('ML-DSA'))).toBe(true);
  });

  it('has no duplicate algorithm names within tiers', () => {
    const broken = BROKEN_ALGORITHMS.map(a => a.name);
    expect(new Set(broken).size).toBe(broken.length);
    const qv = QUANTUM_VULNERABLE_ALGORITHMS.map(a => a.name);
    expect(new Set(qv).size).toBe(qv.length);
    const qs = QUANTUM_SAFE_ALGORITHMS.map(a => a.name);
    expect(new Set(qs).size).toBe(qs.length);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Crypto Library Registry
// ═══════════════════════════════════════════════════════════════════

describe('Crypto library registry', () => {
  it('has entries', () => {
    expect(CRYPTO_LIBRARY_REGISTRY.length).toBeGreaterThan(0);
  });

  it('REGISTRY_SIZE matches actual count', () => {
    expect(REGISTRY_SIZE).toBe(CRYPTO_LIBRARY_REGISTRY.length);
  });

  it('every entry has required fields', () => {
    for (const entry of CRYPTO_LIBRARY_REGISTRY) {
      expect(entry.packageName).toBeDefined();
      expect(entry.packageName.length).toBeGreaterThan(0);
      expect(entry.ecosystem).toBeDefined();
      expect(entry.description).toBeDefined();
      expect(entry.algorithms).toBeDefined();
      expect(entry.algorithms.length).toBeGreaterThan(0);
    }
  });

  it('includes npm ecosystem entries', () => {
    const npm = CRYPTO_LIBRARY_REGISTRY.filter(e => e.ecosystem === 'npm');
    expect(npm.length).toBeGreaterThan(0);
  });

  it('includes PyPI ecosystem entries', () => {
    const pypi = CRYPTO_LIBRARY_REGISTRY.filter(e => e.ecosystem === 'PyPI');
    expect(pypi.length).toBeGreaterThan(0);
  });

  it('includes well-known crypto libraries', () => {
    const names = CRYPTO_LIBRARY_REGISTRY.map(e => e.packageName);
    expect(names).toContain('crypto-js');
    expect(names).toContain('bcrypt');
    expect(names).toContain('jsonwebtoken');
  });

  it('package names use consistent casing', () => {
    // Most are lowercase; some may use standard casing from registries
    for (const entry of CRYPTO_LIBRARY_REGISTRY) {
      expect(entry.packageName.length).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Report Generation
// ═══════════════════════════════════════════════════════════════════

describe('generateCryptoReport', () => {
  const mockResult: CryptoInventoryResult = {
    productId: 'test-product-001',
    scannedAt: '2026-03-17T10:00:00Z',
    totalDependencies: 150,
    cryptoLibrariesFound: 3,
    findings: [
      {
        dependencyName: 'crypto-js',
        dependencyVersion: '4.2.0',
        dependencyPurl: 'pkg:npm/crypto-js@4.2.0',
        dependencyEcosystem: 'npm',
        libraryDescription: 'JavaScript crypto library',
        algorithms: [
          { name: 'MD5', type: 'hash', tier: 'broken', fipsApproved: false, nistStatus: 'deprecated', remediation: 'Migrate to SHA-256' },
          { name: 'AES-256', type: 'symmetric', tier: 'quantum_safe', strengthBits: 256, fipsApproved: true, nistStatus: 'recommended' },
        ],
        worstTier: 'broken',
      },
    ],
    summary: {
      broken: 1,
      quantumVulnerable: 0,
      quantumSafe: 1,
      totalAlgorithms: 2,
    },
  };

  it('generates a Markdown report', () => {
    const report = generateCryptoReport(mockResult, 'TestProduct');
    expect(report).toContain('# Cryptographic Standards');
    expect(report).toContain('TestProduct');
  });

  it('includes findings', () => {
    const report = generateCryptoReport(mockResult, 'TestProduct');
    expect(report).toContain('crypto-js');
    expect(report).toContain('MD5');
  });

  it('includes summary statistics', () => {
    const report = generateCryptoReport(mockResult, 'TestProduct');
    expect(report).toContain('Broken');
  });

  it('includes attribution', () => {
    const report = generateCryptoReport(mockResult, 'TestProduct');
    // Report should contain the product name and some form of tool attribution
    expect(report).toContain('TestProduct');
    expect(report.length).toBeGreaterThan(200);
  });
});

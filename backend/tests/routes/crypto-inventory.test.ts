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
 * Crypto Inventory — Integration Tests
 *
 * Tests the cryptographic standards & quantum readiness scanning endpoints:
 *   GET  /api/products/:productId/crypto-inventory
 *   POST /api/products/:productId/crypto-inventory/scan
 *   GET  /api/products/:productId/crypto-inventory/export
 *
 * Seeds crypto-relevant dependencies (crypto-js, bcrypt, elliptic) into Neo4j
 * for the test product, then verifies scanning, persistence, and export.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginTestUser, TEST_USERS, getNeo4jDriver, getAppPool } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

const PRODUCT_ID = TEST_IDS.products.github;
const ORG_ID = TEST_IDS.orgs.mfgActive;

let token: string;

// ─── Setup: seed crypto-relevant dependencies ────────────────────────

beforeAll(async () => {
  token = await loginTestUser(TEST_USERS.mfgAdmin);

  // Clean any stale crypto scan data from prior runs
  const pool = getAppPool();
  await pool.query('DELETE FROM crypto_findings WHERE product_id = $1', [PRODUCT_ID]);
  await pool.query('DELETE FROM crypto_scans WHERE product_id = $1', [PRODUCT_ID]);

  // Seed some known crypto library dependencies into Neo4j
  const driver = getNeo4jDriver();
  const session = driver.session();
  try {
    // Create dependencies and link to the test product
    const cryptoDeps = [
      { name: 'crypto-js', version: '4.2.0', ecosystem: 'npm', purl: 'pkg:npm/crypto-js@4.2.0' },
      { name: 'bcrypt', version: '5.1.1', ecosystem: 'npm', purl: 'pkg:npm/bcrypt@5.1.1' },
      { name: 'elliptic', version: '6.5.4', ecosystem: 'npm', purl: 'pkg:npm/elliptic@6.5.4' },
      { name: 'md5', version: '2.3.0', ecosystem: 'npm', purl: 'pkg:npm/md5@2.3.0' },
      { name: 'argon2', version: '0.31.2', ecosystem: 'npm', purl: 'pkg:npm/argon2@0.31.2' },
      { name: 'lodash', version: '4.17.21', ecosystem: 'npm', purl: 'pkg:npm/lodash@4.17.21' }, // non-crypto, should not match
    ];

    for (const dep of cryptoDeps) {
      await session.run(
        `MERGE (d:Dependency {purl: $purl})
         ON CREATE SET d.name = $name, d.version = $version, d.ecosystem = $ecosystem, d.id = $purl
         WITH d
         MATCH (p:Product {id: $productId})
         MERGE (p)-[:DEPENDS_ON]->(d)`,
        { ...dep, productId: PRODUCT_ID }
      );
    }
  } finally {
    await session.close();
  }
}, 30000);

afterAll(async () => {
  // Clean up seeded dependencies
  const driver = getNeo4jDriver();
  const session = driver.session();
  try {
    await session.run(
      `MATCH (p:Product {id: $productId})-[r:DEPENDS_ON]->(d:Dependency)
       WHERE d.purl STARTS WITH 'pkg:npm/crypto-js' OR d.purl STARTS WITH 'pkg:npm/bcrypt@'
         OR d.purl STARTS WITH 'pkg:npm/elliptic' OR d.purl STARTS WITH 'pkg:npm/md5'
         OR d.purl STARTS WITH 'pkg:npm/argon2' OR d.purl STARTS WITH 'pkg:npm/lodash'
       DELETE r`,
      { productId: PRODUCT_ID }
    );
  } finally {
    await session.close();
  }
}, 15000);

// ─── Tests ───────────────────────────────────────────────────────────

describe('Crypto Inventory API', () => {
  // Auth tests
  it('GET should return 401 without auth', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/crypto-inventory`);
    expect(res.status).toBe(401);
  });

  it('POST scan should return 401 without auth', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/crypto-inventory/scan`);
    expect(res.status).toBe(401);
  });

  it('GET export should return 401 without auth', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/crypto-inventory/export`);
    expect(res.status).toBe(401);
  });

  // Cross-org isolation
  it('should return 404 for product in different org', async () => {
    const impToken = await loginTestUser(TEST_USERS.impAdmin);
    const res = await api.get(`/api/products/${PRODUCT_ID}/crypto-inventory`, { auth: impToken });
    expect(res.status).toBe(404);
  });

  // GET before scanning
  it('GET should return scanned:false before first scan', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/crypto-inventory`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.scanned).toBe(false);
    expect(res.body.registrySize).toBeGreaterThan(0);
  });

  // POST scan
  it('POST scan should scan dependencies and return findings', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/crypto-inventory/scan`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.scanned).toBe(true);
    expect(res.body.productId).toBe(PRODUCT_ID);
    expect(res.body.totalDependencies).toBeGreaterThanOrEqual(6);
    expect(res.body.cryptoLibrariesFound).toBeGreaterThanOrEqual(4); // crypto-js, bcrypt, elliptic, md5, argon2 — not lodash
    expect(res.body.findings).toBeInstanceOf(Array);
    expect(res.body.findings.length).toBeGreaterThanOrEqual(4);

    // Summary should have counts
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.broken).toBeGreaterThanOrEqual(1);           // md5 and/or crypto-js
    expect(res.body.summary.quantumVulnerable).toBeGreaterThanOrEqual(1); // elliptic
    expect(res.body.summary.quantumSafe).toBeGreaterThanOrEqual(1);       // bcrypt, argon2
    expect(res.body.summary.totalAlgorithms).toBeGreaterThanOrEqual(3);
  });

  // Verify finding structure
  it('findings should have correct structure', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/crypto-inventory`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.scanned).toBe(true);

    const finding = res.body.findings[0];
    expect(finding).toHaveProperty('dependencyName');
    expect(finding).toHaveProperty('dependencyVersion');
    expect(finding).toHaveProperty('dependencyPurl');
    expect(finding).toHaveProperty('dependencyEcosystem');
    expect(finding).toHaveProperty('libraryDescription');
    expect(finding).toHaveProperty('algorithms');
    expect(finding).toHaveProperty('worstTier');
    expect(['broken', 'quantum_vulnerable', 'quantum_safe']).toContain(finding.worstTier);
  });

  // Verify specific libraries detected
  it('should detect md5 as broken tier', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/crypto-inventory`, { auth: token });
    const md5Finding = res.body.findings.find((f: any) => f.dependencyName === 'md5');
    expect(md5Finding).toBeDefined();
    expect(md5Finding.worstTier).toBe('broken');
  });

  it('should detect elliptic as quantum-vulnerable', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/crypto-inventory`, { auth: token });
    const ellipticFinding = res.body.findings.find((f: any) => f.dependencyName === 'elliptic');
    expect(ellipticFinding).toBeDefined();
    expect(ellipticFinding.worstTier).toBe('quantum_vulnerable');
  });

  it('should detect argon2 as quantum-safe', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/crypto-inventory`, { auth: token });
    const argon2Finding = res.body.findings.find((f: any) => f.dependencyName === 'argon2');
    expect(argon2Finding).toBeDefined();
    expect(argon2Finding.worstTier).toBe('quantum_safe');
  });

  it('should NOT detect lodash as a crypto library', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/crypto-inventory`, { auth: token });
    const lodashFinding = res.body.findings.find((f: any) => f.dependencyName === 'lodash');
    expect(lodashFinding).toBeUndefined();
  });

  // Findings should be sorted by severity (broken first)
  it('findings should be sorted worst-first (broken, then quantum-vulnerable, then quantum-safe)', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/crypto-inventory`, { auth: token });
    const tiers = res.body.findings.map((f: any) => f.worstTier);
    const tierOrder: Record<string, number> = { broken: 0, quantum_vulnerable: 1, quantum_safe: 2 };
    for (let i = 1; i < tiers.length; i++) {
      expect(tierOrder[tiers[i]]).toBeGreaterThanOrEqual(tierOrder[tiers[i - 1]]);
    }
  });

  // Algorithms should include remediation for broken/quantum-vulnerable
  it('broken algorithms should include remediation guidance', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/crypto-inventory`, { auth: token });
    const brokenFinding = res.body.findings.find((f: any) => f.worstTier === 'broken');
    expect(brokenFinding).toBeDefined();
    const brokenAlg = brokenFinding.algorithms.find((a: any) => a.tier === 'broken');
    expect(brokenAlg).toBeDefined();
    expect(brokenAlg.remediation).toBeTruthy();
  });

  // Export test
  it('GET export should return Markdown content', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/crypto-inventory/export`, { auth: token });
    expect(res.status).toBe(200);
    // Check the raw response has the right content type
    const contentType = res.headers.get('content-type');
    expect(contentType).toContain('text/markdown');

    // Body should be a string containing Markdown headers
    const body = typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
    expect(body).toContain('Cryptographic Standards');
    expect(body).toContain('Quantum');
  });

  // Idempotent re-scan
  it('POST scan should be idempotent (re-scan updates, does not duplicate)', async () => {
    const res1 = await api.post(`/api/products/${PRODUCT_ID}/crypto-inventory/scan`, { auth: token });
    expect(res1.status).toBe(200);
    const count1 = res1.body.cryptoLibrariesFound;

    const res2 = await api.post(`/api/products/${PRODUCT_ID}/crypto-inventory/scan`, { auth: token });
    expect(res2.status).toBe(200);
    expect(res2.body.cryptoLibrariesFound).toBe(count1);
  });

  // Registry size exposed
  it('should expose registry size in response', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/crypto-inventory`, { auth: token });
    expect(res.body.registrySize).toBeGreaterThan(30); // We have 40+ libraries in the registry
  });
});

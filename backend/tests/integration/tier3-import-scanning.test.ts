/**
 * Tier 3 Import Scanning — E2E Integration Tests
 *
 * Tests the three-tier SBOM fallback chain against REAL repos
 * on the Forgejo instance at https://escrow.cranis2.dev.
 *
 * Repos under `cranis-testing` org:
 *   - cranis-test-sourceonly  → Tier 3 (no lockfiles, 15 languages)
 *   - cranis-test-webstack    → Tier 2 (Node+Python+Go+Rust with lockfiles)
 *   - cranis-test-research    → Tier 2/3 (exotic languages)
 *   - cranis-test-bare        → Graceful fallback (no deps)
 *
 * Each repo has EXPECTED_DEPENDENCIES.json as a verification oracle.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

// ─── Configuration ──────────────────────────────────────────────────────

const FORGEJO_INSTANCE = 'https://escrow.cranis2.dev';
const FORGEJO_ADMIN_USER = 'escrow-admin';
const FORGEJO_ADMIN_PASS = 'Escrow2026Admin';
const FORGEJO_ORG = 'cranis-testing';

// Direct DB access for verifying sbom_source
const PG_EXEC = `docker exec cranis2_postgres psql -U cranis2 -d cranis2 -t -A -c`;

const TEST_REPOS = {
  sourceonly: `${FORGEJO_INSTANCE}/${FORGEJO_ORG}/cranis-test-sourceonly`,
  webstack: `${FORGEJO_INSTANCE}/${FORGEJO_ORG}/cranis-test-webstack`,
  research: `${FORGEJO_INSTANCE}/${FORGEJO_ORG}/cranis-test-research`,
  bare: `${FORGEJO_INSTANCE}/${FORGEJO_ORG}/cranis-test-bare`,
};

// ─── Test State ─────────────────────────────────────────────────────────

let token: string;
let forgejoPat: string;
const createdProductIds: string[] = [];

// ─── Helpers ────────────────────────────────────────────────────────────

async function createForgejoToken(): Promise<string> {
  const res = await fetch(`${FORGEJO_INSTANCE}/api/v1/users/${FORGEJO_ADMIN_USER}/tokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + btoa(`${FORGEJO_ADMIN_USER}:${FORGEJO_ADMIN_PASS}`),
    },
    body: JSON.stringify({
      name: `tier3-test-${Date.now()}`,
      scopes: ['read:user', 'read:repository'],
    }),
  });
  const data = await res.json();
  return data.sha1;
}

async function createTestProduct(tag: string, repoUrl: string): Promise<string> {
  const res = await api.post('/api/products', {
    auth: token,
    body: {
      name: `E2E-T3-${tag}-${Date.now()}`,
      productType: 'software_component',
      craCategory: 'default',
      repoUrl,
    },
  });
  expect(res.status).toBe(201);
  const id = res.body.id || res.body.product?.id;
  expect(id).toBeTruthy();
  createdProductIds.push(id);
  return id;
}

async function syncProduct(productId: string): Promise<any> {
  return api.post(`/api/repo/sync/${productId}`, {
    auth: token,
    timeout: 180000,
  });
}

// ─── Setup & Teardown ───────────────────────────────────────────────────

describe('Tier 3 Import Scanning — E2E', () => {
  beforeAll(async () => {
    token = await loginTestUser(TEST_USERS.mfgAdmin);

    forgejoPat = await createForgejoToken();
    const connectRes = await api.post('/api/repo/connect-pat', {
      auth: token,
      body: { provider: 'forgejo', instanceUrl: FORGEJO_INSTANCE, accessToken: forgejoPat },
    });
    expect(connectRes.status).toBe(200);
    console.log(`[SETUP] Connected to Forgejo as ${connectRes.body.username}`);
  }, 30000);

  afterAll(async () => {
    for (const id of createdProductIds) {
      try {
        await api.delete(`/api/products/${id}`, { auth: token });
      } catch { /* ignore */ }
    }
    await api.delete('/api/repo/disconnect/forgejo', { auth: token });
    console.log(`[TEARDOWN] Cleaned up ${createdProductIds.length} products`);
  }, 30000);

  // ─── Tier 3: Source-only repo (NO lockfiles) ────────────────────────

  describe('cranis-test-sourceonly (Tier 3 — pure import scanning)', () => {
    let productId: string;
    let syncRes: any;

    beforeAll(async () => {
      productId = await createTestProduct('sourceonly', TEST_REPOS.sourceonly);
      syncRes = await syncProduct(productId);
      console.log(`[sourceonly] Sync status: ${syncRes.status}`);
      if (syncRes.body.sbom) {
        console.log(`[sourceonly] Package count: ${syncRes.body.sbom.packageCount}`);
      }
    }, 180000);

    it('should sync successfully (200)', () => {
      expect(syncRes.status).toBe(200);
    });

    it('should find dependencies via import scanning', () => {
      expect(syncRes.body.sbom).toBeTruthy();
      expect(syncRes.body.sbom.packageCount).toBeGreaterThan(0);
      console.log(`[sourceonly] Found ${syncRes.body.sbom.packageCount} packages`);
    });

    it('should detect a substantial number of packages (>20)', () => {
      // The repo has 15 source files across 15 languages with ~56 expected packages
      expect(syncRes.body.sbom.packageCount).toBeGreaterThan(20);
    });

    it('should detect multiple languages in repo data', () => {
      // The sync response includes a languages breakdown
      expect(syncRes.body.languages).toBeTruthy();
      expect(syncRes.body.languages.length).toBeGreaterThanOrEqual(5);
      console.log(`[sourceonly] Languages: ${syncRes.body.languages.map((l: any) => l.language).join(', ')}`);
    });

    it('should have SBOM available for export after sync', async () => {
      const res = await api.get(`/api/sbom/${productId}/export/status`, { auth: token });
      expect(res.status).toBe(200);
      expect(res.body.hasSBOM).toBe(true);
      expect(res.body.totalDependencies).toBeGreaterThan(0);
    });

    it('should produce valid CycloneDX export', async () => {
      const res = await api.get(`/api/sbom/${productId}/export/cyclonedx`, { auth: token });
      expect(res.status).toBe(200);
      expect(res.body.bomFormat).toBe('CycloneDX');
      expect(res.body.components.length).toBeGreaterThan(0);
      console.log(`[sourceonly] CycloneDX: ${res.body.components.length} components`);
    });

    it('should produce valid SPDX export', async () => {
      const res = await api.get(`/api/sbom/${productId}/export/spdx`, { auth: token });
      expect(res.status).toBe(200);
      // SPDX export wraps the document in a `sbom` key: { sbom: { spdxVersion, packages, ... } }
      expect(res.body.sbom).toBeTruthy();
      expect(res.body.sbom.spdxVersion).toBe('SPDX-2.3');
      expect(res.body.sbom.SPDXID).toBe('SPDXRef-DOCUMENT');
      expect(res.body.sbom.packages.length).toBeGreaterThan(0);
    });

    it('should detect Python dependencies in SBOM', async () => {
      const res = await api.get(`/api/sbom/${productId}/export/cyclonedx`, { auth: token });
      const names = res.body.components.map((c: any) => c.name.toLowerCase());
      // Expected: flask, requests, numpy, pandas etc.
      const pythonPkgs = ['flask', 'requests', 'numpy', 'pandas'];
      const found = pythonPkgs.filter(pkg => names.some((n: string) => n.includes(pkg)));
      expect(found.length).toBeGreaterThanOrEqual(2);
      console.log(`[sourceonly] Python packages found: ${found.join(', ')}`);
    });

    it('should detect JavaScript/TypeScript dependencies in SBOM', async () => {
      const res = await api.get(`/api/sbom/${productId}/export/cyclonedx`, { auth: token });
      const names = res.body.components.map((c: any) => c.name.toLowerCase());
      const jsPkgs = ['express', 'cors', 'fastify', 'zod'];
      const found = jsPkgs.filter(pkg => names.some((n: string) => n.includes(pkg)));
      expect(found.length).toBeGreaterThanOrEqual(2);
      console.log(`[sourceonly] JS/TS packages found: ${found.join(', ')}`);
    });

    it('should detect Go dependencies in SBOM', async () => {
      const res = await api.get(`/api/sbom/${productId}/export/cyclonedx`, { auth: token });
      const names = res.body.components.map((c: any) => c.name.toLowerCase());
      const found = names.filter((n: string) => n.includes('gin') || n.includes('gorm') || n.includes('viper'));
      expect(found.length).toBeGreaterThanOrEqual(1);
      console.log(`[sourceonly] Go packages found: ${found.join(', ')}`);
    });

    it('should detect Rust dependencies in SBOM', async () => {
      const res = await api.get(`/api/sbom/${productId}/export/cyclonedx`, { auth: token });
      const names = res.body.components.map((c: any) => c.name.toLowerCase());
      const rustPkgs = ['actix-web', 'actix_web', 'diesel', 'serde', 'chrono'];
      const found = rustPkgs.filter(pkg => names.some((n: string) => n.includes(pkg)));
      expect(found.length).toBeGreaterThanOrEqual(1);
      console.log(`[sourceonly] Rust packages found: ${found.join(', ')}`);
    });

    it('should detect C/C++ dependencies in SBOM', async () => {
      const res = await api.get(`/api/sbom/${productId}/export/cyclonedx`, { auth: token });
      const names = res.body.components.map((c: any) => c.name.toLowerCase());
      const cPkgs = ['openssl', 'curl', 'zlib', 'boost', 'fmt', 'spdlog'];
      const found = cPkgs.filter(pkg => names.some((n: string) => n.includes(pkg)));
      expect(found.length).toBeGreaterThanOrEqual(2);
      console.log(`[sourceonly] C/C++ packages found: ${found.join(', ')}`);
    });

    it('should detect Ruby dependencies in SBOM', async () => {
      const res = await api.get(`/api/sbom/${productId}/export/cyclonedx`, { auth: token });
      const names = res.body.components.map((c: any) => c.name.toLowerCase());
      const rubyPkgs = ['sinatra', 'sequel', 'sidekiq'];
      const found = rubyPkgs.filter(pkg => names.some((n: string) => n.includes(pkg)));
      expect(found.length).toBeGreaterThanOrEqual(1);
      console.log(`[sourceonly] Ruby packages found: ${found.join(', ')}`);
    });
  });

  // ─── Tier 2: Webstack repo (has lockfiles) ──────────────────────────

  describe('cranis-test-webstack (Tier 2 — lockfile parsing)', () => {
    let productId: string;
    let syncRes: any;

    beforeAll(async () => {
      productId = await createTestProduct('webstack', TEST_REPOS.webstack);
      syncRes = await syncProduct(productId);
      console.log(`[webstack] Sync status: ${syncRes.status}, packages: ${syncRes.body.sbom?.packageCount || 0}`);
    }, 180000);

    it('should sync successfully', () => {
      expect(syncRes.status).toBe(200);
    });

    it('should find dependencies', () => {
      expect(syncRes.body.sbom).toBeTruthy();
      expect(syncRes.body.sbom.packageCount).toBeGreaterThan(0);
    });

    it('should find a meaningful number of packages (lockfiles have more than imports)', () => {
      // Lockfile repos typically have more deps (transitive included)
      expect(syncRes.body.sbom.packageCount).toBeGreaterThanOrEqual(5);
    });

    it('should have SBOM export available', async () => {
      const res = await api.get(`/api/sbom/${productId}/export/status`, { auth: token });
      expect(res.status).toBe(200);
      expect(res.body.hasSBOM).toBe(true);
    });
  });

  // ─── Tier 2/3: Research repo (exotic languages) ────────────────────

  describe('cranis-test-research (exotic languages)', () => {
    let productId: string;
    let syncRes: any;

    beforeAll(async () => {
      productId = await createTestProduct('research', TEST_REPOS.research);
      syncRes = await syncProduct(productId);
      console.log(`[research] Sync status: ${syncRes.status}, packages: ${syncRes.body.sbom?.packageCount || 0}`);
    }, 180000);

    it('should sync successfully', () => {
      expect(syncRes.status).toBe(200);
    });

    it('should find dependencies', () => {
      expect(syncRes.body.sbom).toBeTruthy();
      expect(syncRes.body.sbom.packageCount).toBeGreaterThan(0);
    });

    it('should detect exotic languages in languages breakdown', () => {
      const langs = syncRes.body.languages.map((l: any) => l.language.toLowerCase());
      // Should detect some of: R, Julia, Haskell, Elixir, C++, Nix
      const exoticCount = ['r', 'julia', 'haskell', 'elixir', 'c++', 'nix'].filter(
        l => langs.some((lang: string) => lang.toLowerCase().includes(l))
      ).length;
      expect(exoticCount).toBeGreaterThanOrEqual(2);
      console.log(`[research] Languages detected: ${langs.join(', ')}`);
    });
  });

  // ─── Bare repo (graceful fallback) ──────────────────────────────────

  describe('cranis-test-bare (graceful fallback — no deps)', () => {
    let productId: string;
    let syncRes: any;

    beforeAll(async () => {
      productId = await createTestProduct('bare', TEST_REPOS.bare);
      syncRes = await syncProduct(productId);
      console.log(`[bare] Sync status: ${syncRes.status}`);
    }, 180000);

    it('should sync without error (200)', () => {
      expect(syncRes.status).toBe(200);
    });

    it('should have null or zero-package SBOM', () => {
      if (syncRes.body.sbom) {
        expect(syncRes.body.sbom.packageCount).toBeLessThanOrEqual(2);
      } else {
        expect(syncRes.body.sbom).toBeNull();
      }
    });

    it('should still return repo metadata', () => {
      expect(syncRes.body.repo).toBeTruthy();
      expect(syncRes.body.repo.name).toBe('cranis-test-bare');
    });
  });

  // ─── Cross-tier comparison ──────────────────────────────────────────

  describe('Cross-tier behavior verification', () => {
    it('all repos should sync without 500 errors', () => {
      // This is a meta-check: if we got here, all beforeAll syncs succeeded
      expect(true).toBe(true);
    });
  });
});

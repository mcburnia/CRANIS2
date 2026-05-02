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
 * Webhook Integration E2E Tests (P2 #12)
 *
 * End-to-end tests for the full webhook pipeline:
 *
 * Category A — Simulated push events with valid HMAC signatures.
 *   Verifies the entire downstream chain: SBOM marked stale, push event stored,
 *   notification created, telemetry event logged. Tests both GitHub and Forgejo
 *   provider headers.
 *
 * Category B — Real Forgejo round-trip.
 *   Creates a repo on the local Forgejo instance (port 3003), connects it to a
 *   CRANIS2 product, triggers sync (auto-registers webhook), pushes a commit,
 *   and verifies the callback fires. Also tests idempotent re-sync and disconnect
 *   cleanup.
 *
 * Prerequisites:
 * - Backend running with GITHUB_WEBHOOK_SECRET and CODEBERG_WEBHOOK_SECRET set
 * - Forgejo running on port 3003 (for Category B only)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  api, loginTestUser, getNeo4jSession, getAppPool,
  TEST_USERS, BASE_URL,
} from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

// ─── Load secrets from .env ──────────────────────────────────────────────

function loadEnvSecrets(): Record<string, string> {
  const secrets: Record<string, string> = {};
  // Try multiple paths to find .env
  const candidates = [
    resolve(process.cwd(), '.env'),                  // e.g. /home/mcburnia/cranis2/.env
    resolve(process.cwd(), '../.env'),                // if cwd is backend/tests
    resolve(process.cwd(), '../../.env'),             // if cwd is deeper
  ];
  // Also try relative to this file via import.meta.url
  try {
    const thisDir = dirname(fileURLToPath(import.meta.url));
    candidates.push(resolve(thisDir, '../../.env'));   // tests/routes -> backend -> cranis2
    candidates.push(resolve(thisDir, '../../../.env'));
  } catch { /* import.meta.url not available */ }

  for (const envPath of candidates) {
    try {
      const lines = readFileSync(envPath, 'utf-8').split('\n');
      for (const line of lines) {
        const match = line.match(/^([A-Z_]+)=(.+)$/);
        if (match) secrets[match[1]] = match[2].trim();
      }
      if (Object.keys(secrets).length > 0) break; // found a valid .env
    } catch { /* try next */ }
  }
  return secrets;
}

const ENV = loadEnvSecrets();
const GITHUB_SECRET = process.env.GITHUB_WEBHOOK_SECRET || ENV.GITHUB_WEBHOOK_SECRET || '';
const CODEBERG_SECRET = process.env.CODEBERG_WEBHOOK_SECRET || ENV.CODEBERG_WEBHOOK_SECRET || '';
const FORGEJO_TOKEN = ENV.FORGEJO_ADMIN_TOKEN || '60ea5f69d7f928fa2d285418bde830f238d0679e';
const FORGEJO_API = 'http://localhost:3003/api/v1';
const FORGEJO_INSTANCE_URL = 'https://escrow.cranis2.dev';
const WEBHOOK_URL = `${BASE_URL}/api/github/webhook`;
const REPO_WEBHOOK_URL = `${BASE_URL}/api/repo/webhook`;

// ─── Helpers ─────────────────────────────────────────────────────────────

function computeSignature(secret: string, body: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

async function sendSignedWebhook(
  url: string,
  body: object,
  headers: Record<string, string>,
): Promise<{ status: number; body: any }> {
  const rawBody = JSON.stringify(body);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: rawBody,
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let parsed: any;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

function buildPushPayload(repoUrl: string, opts: {
  branch?: string; commits?: number; message?: string; pusherName?: string;
} = {}): object {
  const branch = opts.branch || 'main';
  const commitCount = opts.commits || 1;
  const message = opts.message || 'test commit';
  const commits = Array.from({ length: commitCount }, (_, i) => ({
    id: crypto.randomBytes(20).toString('hex'),
    message: i === 0 ? message : `commit ${i + 1}`,
  }));
  return {
    ref: `refs/heads/${branch}`,
    after: commits[0].id,
    repository: {
      html_url: repoUrl,
      full_name: repoUrl.replace(/^https?:\/\/[^/]+\//, ''),
    },
    pusher: { name: opts.pusherName || 'webhook-e2e-tester', email: 'e2e@test.local' },
    head_commit: { id: commits[0].id, message },
    commits,
  };
}

async function forgejoApi(method: string, path: string, body?: any): Promise<any> {
  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `token ${FORGEJO_TOKEN}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${FORGEJO_API}${path}`, opts);
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) }; } catch { return { status: res.status, body: text }; }
}

async function waitFor(
  check: () => Promise<boolean>,
  timeoutMs: number = 5000,
  intervalMs: number = 500,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return true;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}

async function isForgejoReachable(): Promise<boolean> {
  try {
    const res = await forgejoApi('GET', '/user');
    // Any HTTP response means Forgejo is up; 200 means token is valid too
    return res.status === 200;
  } catch { return false; }
}

// ─── Category A — Push event E2E with valid signatures ───────────────────

const hasSecrets = !!GITHUB_SECRET && !!CODEBERG_SECRET;
const describeA = hasSecrets ? describe : describe.skip;

describeA('Category A — Push event E2E (valid signatures)', () => {
  const pool = getAppPool();
  const GITHUB_REPO_URL = 'https://github.com/webhook-e2e/test-repo';
  const FORGEJO_REPO_URL = 'https://escrow.cranis2.dev/webhook-e2e/forgejo-sim-repo';
  const productGithub = TEST_IDS.products.github;
  const productForgejo = TEST_IDS.products.forgejo;
  const orgId = TEST_IDS.orgs.mfgActive;

  // Track what we created for cleanup
  let createdSbomGithub = false;
  let createdSbomForgejo = false;

  beforeAll(async () => {
    const session = getNeo4jSession();
    try {
      // Create Repository nodes linked to test products
      await session.run(
        `MATCH (p:Product {id: $pid})
         MERGE (r:Repository {url: $url})
         ON CREATE SET r.owner = 'webhook-e2e', r.name = 'test-repo',
           r.provider = 'github', r.createdAt = datetime()
         MERGE (p)-[:HAS_REPO]->(r)`,
        { pid: productGithub, url: GITHUB_REPO_URL },
      );
      await session.run(
        `MATCH (p:Product {id: $pid})
         MERGE (r:Repository {url: $url})
         ON CREATE SET r.owner = 'webhook-e2e', r.name = 'forgejo-sim-repo',
           r.provider = 'codeberg', r.createdAt = datetime()
         MERGE (p)-[:HAS_REPO]->(r)`,
        { pid: productForgejo, url: FORGEJO_REPO_URL },
      );
    } finally {
      await session.close();
    }

    // Insert SBOM rows so we can verify the stale flip
    const ghCheck = await pool.query(
      'SELECT 1 FROM product_sboms WHERE product_id = $1', [productGithub],
    );
    if (ghCheck.rows.length === 0) {
      await pool.query(
        `INSERT INTO product_sboms (product_id, spdx_json, package_count, is_stale)
         VALUES ($1, '{}', 0, FALSE)`,
        [productGithub],
      );
      createdSbomGithub = true;
    } else {
      await pool.query('UPDATE product_sboms SET is_stale = FALSE WHERE product_id = $1', [productGithub]);
    }

    const fjCheck = await pool.query(
      'SELECT 1 FROM product_sboms WHERE product_id = $1', [productForgejo],
    );
    if (fjCheck.rows.length === 0) {
      await pool.query(
        `INSERT INTO product_sboms (product_id, spdx_json, package_count, is_stale)
         VALUES ($1, '{}', 0, FALSE)`,
        [productForgejo],
      );
      createdSbomForgejo = true;
    } else {
      await pool.query('UPDATE product_sboms SET is_stale = FALSE WHERE product_id = $1', [productForgejo]);
    }
  });

  afterAll(async () => {
    const session = getNeo4jSession();
    try {
      await session.run(
        'MATCH (r:Repository) WHERE r.url IN [$u1, $u2] DETACH DELETE r',
        { u1: GITHUB_REPO_URL, u2: FORGEJO_REPO_URL },
      );
    } finally {
      await session.close();
    }

    // Clean up Postgres test artefacts
    await pool.query(
      'DELETE FROM repo_push_events WHERE product_id IN ($1, $2)',
      [productGithub, productForgejo],
    );
    await pool.query(
      `DELETE FROM notifications WHERE org_id = $1 AND type = 'sbom_stale'
       AND metadata->>'productId' IN ($2, $3)`,
      [orgId, productGithub, productForgejo],
    );
    await pool.query(
      `DELETE FROM user_events WHERE event_type = 'webhook_sbom_stale'
       AND (metadata->>'productId' IN ($1, $2))`,
      [productGithub, productForgejo],
    );

    if (createdSbomGithub) {
      await pool.query('DELETE FROM product_sboms WHERE product_id = $1', [productGithub]);
    }
    if (createdSbomForgejo) {
      await pool.query('DELETE FROM product_sboms WHERE product_id = $1', [productForgejo]);
    }
  });

  // ── A1–A5: GitHub push ──────────────────────────────────────────

  describe('GitHub push event', () => {
    let webhookResponse: { status: number; body: any };

    beforeAll(async () => {
      // Reset SBOM stale state
      await pool.query('UPDATE product_sboms SET is_stale = FALSE WHERE product_id = $1', [productGithub]);
      // Clear any prior push events for this product
      await pool.query('DELETE FROM repo_push_events WHERE product_id = $1', [productGithub]);

      const payload = buildPushPayload(GITHUB_REPO_URL, {
        branch: 'main', commits: 3, message: 'feat: e2e test commit',
        pusherName: 'e2e-pusher',
      });
      const rawBody = JSON.stringify(payload);
      const sig = computeSignature(GITHUB_SECRET, rawBody);
      webhookResponse = await sendSignedWebhook(WEBHOOK_URL, payload, {
        'X-GitHub-Event': 'push',
        'X-Hub-Signature-256': sig,
      });
    });

    it('A1 — should return 200 with status ok', () => {
      expect(webhookResponse.status).toBe(200);
      expect(webhookResponse.body.status).toBe('ok');
      expect(webhookResponse.body.productsUpdated).toBe(1);
    });

    it('A2 — should mark SBOM as stale in Postgres', async () => {
      const result = await pool.query(
        'SELECT is_stale FROM product_sboms WHERE product_id = $1', [productGithub],
      );
      expect(result.rows[0]?.is_stale).toBe(true);
    });

    it('A3 — should create a push event record', async () => {
      const result = await pool.query(
        `SELECT pusher_name, branch, commit_count, provider
         FROM repo_push_events WHERE product_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [productGithub],
      );
      expect(result.rows.length).toBeGreaterThan(0);
      const row = result.rows[0];
      expect(row.pusher_name).toBe('e2e-pusher');
      expect(row.branch).toBe('main');
      expect(row.commit_count).toBe(3);
      expect(row.provider).toBe('github');
    });

    it('A4 — should create a stale SBOM notification', async () => {
      const result = await pool.query(
        `SELECT title, body FROM notifications
         WHERE org_id = $1 AND type = 'sbom_stale' AND metadata->>'productId' = $2
         ORDER BY created_at DESC LIMIT 1`,
        [orgId, productGithub],
      );
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].title).toContain('test-product-github');
      expect(result.rows[0].body).toContain('GitHub');
    });

    it('A5 — should record a user event', async () => {
      const result = await pool.query(
        `SELECT metadata FROM user_events
         WHERE event_type = 'webhook_sbom_stale'
         AND metadata->>'productId' = $1
         ORDER BY created_at DESC LIMIT 1`,
        [productGithub],
      );
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].metadata.repoUrl).toBe(GITHUB_REPO_URL);
    });
  });

  // ── A6–A8: Forgejo push ─────────────────────────────────────────

  describe('Forgejo push event', () => {
    let webhookResponse: { status: number; body: any };

    beforeAll(async () => {
      await pool.query('UPDATE product_sboms SET is_stale = FALSE WHERE product_id = $1', [productForgejo]);
      await pool.query('DELETE FROM repo_push_events WHERE product_id = $1', [productForgejo]);

      const payload = buildPushPayload(FORGEJO_REPO_URL, {
        branch: 'main', commits: 1, message: 'chore: forgejo e2e',
        pusherName: 'forgejo-e2e-pusher',
      });
      const rawBody = JSON.stringify(payload);
      const sig = computeSignature(CODEBERG_SECRET, rawBody);
      webhookResponse = await sendSignedWebhook(WEBHOOK_URL, payload, {
        'X-Forgejo-Event': 'push',
        'X-Forgejo-Signature': sig,
      });
    });

    it('A6 — should return 200 with status ok', () => {
      expect(webhookResponse.status).toBe(200);
      expect(webhookResponse.body.status).toBe('ok');
    });

    it('A7 — push event should have provider=codeberg', async () => {
      const result = await pool.query(
        `SELECT provider FROM repo_push_events WHERE product_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [productForgejo],
      );
      expect(result.rows[0]?.provider).toBe('codeberg');
    });

    it('A8 — notification should mention Codeberg', async () => {
      const result = await pool.query(
        `SELECT body FROM notifications
         WHERE org_id = $1 AND type = 'sbom_stale' AND metadata->>'productId' = $2
         ORDER BY created_at DESC LIMIT 1`,
        [orgId, productForgejo],
      );
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].body).toContain('Codeberg');
    });
  });

  // ── A9–A13: Edge cases ──────────────────────────────────────────

  describe('Edge cases', () => {
    it('A9 — invalid signature should be rejected', async () => {
      const payload = buildPushPayload(GITHUB_REPO_URL);
      const rawBody = JSON.stringify(payload);
      const badSig = computeSignature('wrong-secret-entirely', rawBody);
      const res = await sendSignedWebhook(WEBHOOK_URL, payload, {
        'X-GitHub-Event': 'push',
        'X-Hub-Signature-256': badSig,
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('signature');
    });

    it('A10 — missing signature should be rejected', async () => {
      const payload = buildPushPayload(GITHUB_REPO_URL);
      const res = await sendSignedWebhook(WEBHOOK_URL, payload, {
        'X-GitHub-Event': 'push',
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('signature');
    });

    it('A11 — non-push event should be ignored', async () => {
      const payload = { action: 'opened', issue: { title: 'test' } };
      const rawBody = JSON.stringify(payload);
      const sig = computeSignature(GITHUB_SECRET, rawBody);
      const res = await sendSignedWebhook(WEBHOOK_URL, payload, {
        'X-GitHub-Event': 'issues',
        'X-Hub-Signature-256': sig,
      });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ignored');
      expect(res.body.event).toBe('issues');
    });

    it('A12 — unknown repo URL should return no_match', async () => {
      const payload = buildPushPayload('https://github.com/completely-unknown/repo-xyz-no-match');
      const rawBody = JSON.stringify(payload);
      const sig = computeSignature(GITHUB_SECRET, rawBody);
      const res = await sendSignedWebhook(WEBHOOK_URL, payload, {
        'X-GitHub-Event': 'push',
        'X-Hub-Signature-256': sig,
      });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('no_match');
    });

    it('A13 — /api/repo/webhook path should work identically', async () => {
      const payload = buildPushPayload('https://github.com/completely-unknown/alt-route-test');
      const rawBody = JSON.stringify(payload);
      const sig = computeSignature(GITHUB_SECRET, rawBody);
      const res = await sendSignedWebhook(REPO_WEBHOOK_URL, payload, {
        'X-GitHub-Event': 'push',
        'X-Hub-Signature-256': sig,
      });
      expect(res.status).toBe(200);
      // Route exists and processes (no_match is fine — proves it didn't 404)
      expect(res.body.status).toBe('no_match');
    });
  });
});

// ─── Category B — Forgejo real round-trip ─────────────────────────────────

describe('Category B — Forgejo real round-trip', () => {
  const pool = getAppPool();
  let forgejoReachable = false;
  let token: string;
  let testProductId: string;
  let forgejoOwner: string;
  let forgejoRepoName: string;
  let forgejoRepoHtmlUrl: string;
  let storedWebhookId: string | null = null;

  const REPO_NAME = `webhook-e2e-${Date.now()}`;

  beforeAll(async () => {
    forgejoReachable = hasSecrets && await isForgejoReachable();
    if (!forgejoReachable) return;

    token = await loginTestUser(TEST_USERS.mfgAdmin);

    // 1. Create repo in Forgejo
    const createRes = await forgejoApi('POST', '/user/repos', {
      name: REPO_NAME,
      auto_init: false,
      private: false,
    });
    expect(createRes.status).toBe(201);
    forgejoOwner = createRes.body.owner.login;
    forgejoRepoName = createRes.body.name;
    forgejoRepoHtmlUrl = createRes.body.html_url;

    // 2. Initialise with a README (creates a commit so sync has something to fetch)
    const initRes = await forgejoApi(
      'POST',
      `/repos/${forgejoOwner}/${forgejoRepoName}/contents/README.md`,
      {
        content: Buffer.from('# Webhook E2E Test Repo\n').toString('base64'),
        message: 'Initial commit',
      },
    );
    expect(initRes.status).toBe(201);

    // 3. Create CRANIS2 product pointing to the Forgejo repo
    const prodRes = await api.post('/api/products', {
      auth: token,
      body: {
        name: `e2e-webhook-${REPO_NAME}`,
        repoUrl: forgejoRepoHtmlUrl,
        autoAssignContacts: false,
      },
    });
    expect(prodRes.status).toBe(201);
    testProductId = prodRes.body.product?.id || prodRes.body.id;
    expect(testProductId).toBeTruthy();

    // 4. Connect PAT for Forgejo provider
    const patRes = await api.post('/api/repo/connect-pat', {
      auth: token,
      body: {
        provider: 'forgejo',
        instanceUrl: FORGEJO_INSTANCE_URL,
        accessToken: FORGEJO_TOKEN,
      },
    });
    expect(patRes.status).toBe(200);
  });

  afterAll(async () => {
    if (!forgejoReachable) return;

    // Delete Forgejo repo
    try {
      await forgejoApi('DELETE', `/repos/${forgejoOwner}/${forgejoRepoName}`);
    } catch { /* best effort */ }

    // Delete CRANIS2 product + Neo4j nodes
    if (testProductId) {
      const session = getNeo4jSession();
      try {
        await session.run(
          `MATCH (p:Product {id: $pid})
           OPTIONAL MATCH (p)-[:HAS_REPO]->(r:Repository)
           OPTIONAL MATCH (p)-[:HAS_SBOM]->(s:SBOM)
           DETACH DELETE p, r, s`,
          { pid: testProductId },
        );
      } finally {
        await session.close();
      }

      // Clean Postgres
      await pool.query('DELETE FROM repo_push_events WHERE product_id = $1', [testProductId]);
      await pool.query('DELETE FROM product_sboms WHERE product_id = $1', [testProductId]);
      await pool.query('DELETE FROM technical_file_sections WHERE product_id = $1', [testProductId]);
      await pool.query('DELETE FROM obligations WHERE product_id = $1', [testProductId]);
      await pool.query(
        `DELETE FROM notifications WHERE metadata->>'productId' = $1`,
        [testProductId],
      );
      await pool.query(
        `DELETE FROM user_events WHERE event_type = 'webhook_sbom_stale'
         AND metadata->>'productId' = $1`,
        [testProductId],
      );
    }

    // Clean up Forgejo PAT connection (restore previous state)
    try {
      await api.delete('/api/repo/disconnect/forgejo', { auth: token });
    } catch { /* no-op if already disconnected */ }
  });

  // ── B1–B3: Sync + auto-registration ────────────────────────────

  describe('Webhook auto-registration', () => {
    it('B1 — sync should succeed', async () => {
      if (!forgejoReachable) return; // skip when Forgejo unreachable
      const res = await api.post(`/api/repo/sync/${testProductId}`, { auth: token, timeout: 30000 });
      expect(res.status).toBe(200);
    }, 35000);

    it('B2 — webhookId should be stored on Neo4j Repository node', async () => {
      if (!forgejoReachable) return; // skip when Forgejo unreachable
      // ensureWebhook is non-blocking — poll for up to 5s
      const found = await waitFor(async () => {
        const session = getNeo4jSession();
        try {
          const result = await session.run(
            `MATCH (p:Product {id: $pid})-[:HAS_REPO]->(r:Repository)
             RETURN r.webhookId AS webhookId`,
            { pid: testProductId },
          );
          const wid = result.records[0]?.get('webhookId');
          if (wid) { storedWebhookId = String(wid); return true; }
          return false;
        } finally {
          await session.close();
        }
      }, 5000);
      expect(found).toBe(true);
      expect(storedWebhookId).toBeTruthy();
    }, 10000);

    it('B3 — webhook should exist in Forgejo', async () => {
      if (!forgejoReachable) return; // skip when Forgejo unreachable
      const res = await forgejoApi('GET', `/repos/${forgejoOwner}/${forgejoRepoName}/hooks`);
      expect(res.status).toBe(200);
      const hooks = res.body;
      expect(Array.isArray(hooks)).toBe(true);
      const matching = hooks.filter((h: any) =>
        h.config?.url?.includes('/api/github/webhook'),
      );
      expect(matching.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── B4: Idempotent re-sync ─────────────────────────────────────

  describe('Idempotent re-sync', () => {
    it('B4 — re-sync should preserve same webhookId and not duplicate hooks', async () => {
      if (!forgejoReachable) return; // skip when Forgejo unreachable
      // Re-sync
      const res = await api.post(`/api/repo/sync/${testProductId}`, { auth: token, timeout: 30000 });
      expect(res.status).toBe(200);

      // Wait briefly for any async webhook registration
      await new Promise(r => setTimeout(r, 2000));

      // Check webhookId unchanged
      const session = getNeo4jSession();
      try {
        const result = await session.run(
          'MATCH (p:Product {id: $pid})-[:HAS_REPO]->(r:Repository) RETURN r.webhookId AS webhookId',
          { pid: testProductId },
        );
        const wid = result.records[0]?.get('webhookId');
        expect(String(wid)).toBe(storedWebhookId);
      } finally {
        await session.close();
      }

      // Check only 1 webhook in Forgejo
      const hookRes = await forgejoApi('GET', `/repos/${forgejoOwner}/${forgejoRepoName}/hooks`);
      const matching = hookRes.body.filter((h: any) =>
        h.config?.url?.includes('/api/github/webhook'),
      );
      expect(matching.length).toBe(1);
    }, 40000);
  });

  // ── B5–B6: Push triggers webhook callback ──────────────────────

  describe('Push event delivery', () => {
    it('B5 — pushing a file should trigger webhook and create push event record', async () => {
      if (!forgejoReachable) return; // skip when Forgejo unreachable

      // Insert SBOM row so we can check stale flip
      const sbomCheck = await pool.query(
        'SELECT 1 FROM product_sboms WHERE product_id = $1', [testProductId],
      );
      if (sbomCheck.rows.length === 0) {
        await pool.query(
          `INSERT INTO product_sboms (product_id, spdx_json, package_count, is_stale)
           VALUES ($1, '{}', 0, FALSE)`,
          [testProductId],
        );
      } else {
        await pool.query('UPDATE product_sboms SET is_stale = FALSE WHERE product_id = $1', [testProductId]);
      }

      // Record initial push event count
      const before = await pool.query(
        'SELECT count(*) AS cnt FROM repo_push_events WHERE product_id = $1',
        [testProductId],
      );
      const beforeCount = parseInt(before.rows[0].cnt);

      // Push a file via Forgejo API
      const pushRes = await forgejoApi(
        'POST',
        `/repos/${forgejoOwner}/${forgejoRepoName}/contents/e2e-test-${Date.now()}.txt`,
        {
          content: Buffer.from('webhook round-trip test\n').toString('base64'),
          message: 'chore: webhook e2e round-trip push',
        },
      );
      expect(pushRes.status).toBe(201);

      // Poll for push event to appear (webhook callback may take a few seconds)
      const delivered = await waitFor(async () => {
        const after = await pool.query(
          'SELECT count(*) AS cnt FROM repo_push_events WHERE product_id = $1',
          [testProductId],
        );
        return parseInt(after.rows[0].cnt) > beforeCount;
      }, 20000, 1000);
      expect(delivered).toBe(true);
    }, 30000);

    it('B6 — SBOM should be marked stale after push', async () => {
      if (!forgejoReachable) return; // skip when Forgejo unreachable
      const result = await pool.query(
        'SELECT is_stale FROM product_sboms WHERE product_id = $1',
        [testProductId],
      );
      expect(result.rows[0]?.is_stale).toBe(true);
    });
  });

  // ── B7–B8: Disconnect cleanup ──────────────────────────────────

  describe('Disconnect cleanup', () => {
    it('B7 — disconnect should clear webhookId from Neo4j', async () => {
      if (!forgejoReachable) return; // skip when Forgejo unreachable
      const res = await api.delete('/api/repo/disconnect/forgejo', { auth: token });
      expect(res.status).toBe(200);

      // Wait briefly for async cleanup
      await new Promise(r => setTimeout(r, 2000));

      const session = getNeo4jSession();
      try {
        const result = await session.run(
          'MATCH (p:Product {id: $pid})-[:HAS_REPO]->(r:Repository) RETURN r.webhookId AS webhookId',
          { pid: testProductId },
        );
        const wid = result.records[0]?.get('webhookId');
        expect(wid).toBeFalsy();
      } finally {
        await session.close();
      }
    }, 10000);

    it('B8 — webhook should be removed from Forgejo', async () => {
      if (!forgejoReachable) return; // skip when Forgejo unreachable
      const res = await forgejoApi('GET', `/repos/${forgejoOwner}/${forgejoRepoName}/hooks`);
      expect(res.status).toBe(200);
      const matching = res.body.filter((h: any) =>
        h.config?.url?.includes('/api/github/webhook'),
      );
      expect(matching.length).toBe(0);
    });
  });
});

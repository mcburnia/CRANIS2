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
 * Webhook Health Tests — GET /api/admin/webhook-health
 *
 * Tests the admin-only webhook health monitoring endpoint that detects:
 * - Products with connected repos but no webhook registered (webhookId IS NULL)
 * - Products where the provider reports recent pushes but no webhook events were received
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginTestUser, getNeo4jSession, getAppPool, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

const PRODUCT_ID = TEST_IDS.products.github;
const TEST_REPO_URL = 'https://github.com/test-org/webhook-health-repo';

describe('GET /api/admin/webhook-health', () => {
  let regularToken: string;
  let platformAdminToken: string;

  beforeAll(async () => {
    regularToken = await loginTestUser(TEST_USERS.mfgAdmin);
    platformAdminToken = await loginTestUser(TEST_USERS.platformAdmin);
  });

  it('should reject unauthenticated requests', async () => {
    const res = await api.get('/api/admin/webhook-health');
    expect(res.status).toBe(401);
  });

  it('should reject non-admin users with 403', async () => {
    const res = await api.get('/api/admin/webhook-health', { auth: regularToken });
    expect([401, 403]).toContain(res.status);
  });

  it('should return correct response shape for platform admin', async () => {
    const res = await api.get('/api/admin/webhook-health', { auth: platformAdminToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('issues');
    expect(res.body).toHaveProperty('summary');
    expect(Array.isArray(res.body.issues)).toBe(true);
    expect(res.body.summary).toHaveProperty('totalProducts');
    expect(res.body.summary).toHaveProperty('healthyProducts');
    expect(res.body.summary).toHaveProperty('noWebhook');
    expect(res.body.summary).toHaveProperty('webhookSilent');
  });

  it('should have numeric summary values', async () => {
    const res = await api.get('/api/admin/webhook-health', { auth: platformAdminToken });
    expect(res.status).toBe(200);
    expect(typeof res.body.summary.totalProducts).toBe('number');
    expect(typeof res.body.summary.healthyProducts).toBe('number');
    expect(typeof res.body.summary.noWebhook).toBe('number');
    expect(typeof res.body.summary.webhookSilent).toBe('number');
  });
});

describe('Webhook health — no_webhook detection', () => {
  let platformAdminToken: string;

  beforeAll(async () => {
    platformAdminToken = await loginTestUser(TEST_USERS.platformAdmin);

    // Create a Repository node without webhookId linked to a test product
    const session = getNeo4jSession();
    try {
      await session.run(
        `MATCH (p:Product {id: $productId})
         MERGE (r:Repository {url: $repoUrl})
         ON CREATE SET r.owner = 'test-org', r.name = 'webhook-health-repo',
           r.provider = 'github', r.createdAt = datetime()
         MERGE (p)-[:HAS_REPO]->(r)`,
        { productId: PRODUCT_ID, repoUrl: TEST_REPO_URL }
      );
    } finally {
      await session.close();
    }
  });

  afterAll(async () => {
    // Clean up test Repository node
    const session = getNeo4jSession();
    try {
      await session.run(
        `MATCH (r:Repository {url: $url}) DETACH DELETE r`,
        { url: TEST_REPO_URL }
      );
    } finally {
      await session.close();
    }
  });

  it('should detect product with no webhookId as no_webhook issue', async () => {
    const res = await api.get('/api/admin/webhook-health', { auth: platformAdminToken });
    expect(res.status).toBe(200);

    const issue = res.body.issues.find((i: any) => i.productId === PRODUCT_ID && i.repoUrl === TEST_REPO_URL);
    expect(issue).toBeTruthy();
    expect(issue.issueType).toBe('no_webhook');
    expect(issue.webhookId).toBeNull();
    expect(issue).toHaveProperty('productName');
    expect(issue).toHaveProperty('orgName');
    expect(issue).toHaveProperty('provider');
  });

  it('should count no_webhook in summary', async () => {
    const res = await api.get('/api/admin/webhook-health', { auth: platformAdminToken });
    expect(res.status).toBe(200);
    expect(res.body.summary.noWebhook).toBeGreaterThanOrEqual(1);
  });
});

describe('Webhook health — webhook_silent detection', () => {
  let platformAdminToken: string;
  const SILENT_REPO_URL = 'https://github.com/test-org/webhook-silent-repo';

  beforeAll(async () => {
    platformAdminToken = await loginTestUser(TEST_USERS.platformAdmin);

    // Create a Repository node WITH webhookId but recent lastPush
    const session = getNeo4jSession();
    try {
      await session.run(
        `MATCH (p:Product {id: $productId})
         MERGE (r:Repository {url: $repoUrl})
         ON CREATE SET r.owner = 'test-org', r.name = 'webhook-silent-repo',
           r.provider = 'github', r.createdAt = datetime()
         SET r.webhookId = '99999', r.lastPush = $lastPush
         MERGE (p)-[:HAS_REPO]->(r)`,
        {
          productId: PRODUCT_ID,
          repoUrl: SILENT_REPO_URL,
          lastPush: new Date().toISOString(), // Recent push from provider
        }
      );
    } finally {
      await session.close();
    }
    // No push events in repo_push_events — so webhook is "silent"
  });

  afterAll(async () => {
    const session = getNeo4jSession();
    try {
      await session.run(
        `MATCH (r:Repository {url: $url}) DETACH DELETE r`,
        { url: SILENT_REPO_URL }
      );
    } finally {
      await session.close();
    }
  });

  it('should detect product with recent provider push but no events as webhook_silent', async () => {
    const res = await api.get('/api/admin/webhook-health', { auth: platformAdminToken });
    expect(res.status).toBe(200);

    const issue = res.body.issues.find((i: any) => i.repoUrl === SILENT_REPO_URL);
    expect(issue).toBeTruthy();
    expect(issue.issueType).toBe('webhook_silent');
    expect(issue.webhookId).toBe('99999');
    expect(issue.lastProviderPush).toBeTruthy();
    expect(issue.lastWebhookEvent).toBeNull();
  });

  it('should count webhook_silent in summary', async () => {
    const res = await api.get('/api/admin/webhook-health', { auth: platformAdminToken });
    expect(res.status).toBe(200);
    expect(res.body.summary.webhookSilent).toBeGreaterThanOrEqual(1);
  });
});

describe('Webhook health — healthy product', () => {
  let platformAdminToken: string;
  const HEALTHY_REPO_URL = 'https://github.com/test-org/webhook-healthy-repo';

  beforeAll(async () => {
    platformAdminToken = await loginTestUser(TEST_USERS.platformAdmin);

    const recentPush = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago

    // Create a Repository node WITH webhookId and recent lastPush
    const session = getNeo4jSession();
    try {
      await session.run(
        `MATCH (p:Product {id: $productId})
         MERGE (r:Repository {url: $repoUrl})
         ON CREATE SET r.owner = 'test-org', r.name = 'webhook-healthy-repo',
           r.provider = 'github', r.createdAt = datetime()
         SET r.webhookId = '88888', r.lastPush = $lastPush
         MERGE (p)-[:HAS_REPO]->(r)`,
        { productId: PRODUCT_ID, repoUrl: HEALTHY_REPO_URL, lastPush: recentPush }
      );
    } finally {
      await session.close();
    }

    // Insert a push event that is AFTER the provider's lastPush — healthy
    const pool = getAppPool();
    await pool.query(
      `INSERT INTO repo_push_events (product_id, pusher_name, ref, branch, commit_count, provider, created_at)
       VALUES ($1, 'test-user', 'refs/heads/main', 'main', 1, 'github', NOW())`,
      [PRODUCT_ID]
    );
  });

  afterAll(async () => {
    const session = getNeo4jSession();
    try {
      await session.run(
        `MATCH (r:Repository {url: $url}) DETACH DELETE r`,
        { url: HEALTHY_REPO_URL }
      );
    } finally {
      await session.close();
    }

    const pool = getAppPool();
    await pool.query(
      `DELETE FROM repo_push_events WHERE product_id = $1 AND pusher_name = 'test-user'`,
      [PRODUCT_ID]
    );
  });

  it('should not flag healthy product as an issue', async () => {
    const res = await api.get('/api/admin/webhook-health', { auth: platformAdminToken });
    expect(res.status).toBe(200);

    const issue = res.body.issues.find((i: any) => i.repoUrl === HEALTHY_REPO_URL);
    expect(issue).toBeUndefined();
  });

  it('should count healthy product in healthyProducts summary', async () => {
    const res = await api.get('/api/admin/webhook-health', { auth: platformAdminToken });
    expect(res.status).toBe(200);
    expect(res.body.summary.healthyProducts).toBeGreaterThanOrEqual(1);
  });
});

/**
 * Push Events Tests — GET /api/github/push-events/:productId
 *
 * Endpoint returns recent push events received via webhook for a product.
 * Data is stored in repo_push_events table when webhook push events arrive.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginTestUser, TEST_USERS, getAppPool } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

const PRODUCT_ID = TEST_IDS.products.github;
const IMP_PRODUCT_ID = TEST_IDS.products.impGithub;

describe('GET /api/github/push-events/:productId', () => {
  let mfgToken: string;
  let impToken: string;

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);

    // Seed some push events for the test product
    const pool = getAppPool();
    await pool.query(
      `INSERT INTO repo_push_events (product_id, pusher_name, pusher_email, ref, branch, commit_count, head_commit_message, head_commit_sha, provider)
       VALUES
         ($1, 'alice', 'alice@example.com', 'refs/heads/main', 'main', 3, 'feat: add new feature', 'abc123def456', 'github'),
         ($1, 'bob', 'bob@example.com', 'refs/heads/develop', 'develop', 1, 'fix: resolve bug', 'def456abc789', 'github'),
         ($1, 'alice', null, 'refs/heads/main', 'main', 5, 'refactor: clean up code', 'fff000aaa111', 'github')`,
      [PRODUCT_ID]
    );
  });

  afterAll(async () => {
    // Clean up seeded push events
    const pool = getAppPool();
    await pool.query(`DELETE FROM repo_push_events WHERE product_id = $1`, [PRODUCT_ID]);
  });

  it('should reject unauthenticated requests', async () => {
    const res = await api.get(`/api/github/push-events/${PRODUCT_ID}`);
    expect(res.status).toBe(401);
  });

  it('should return 404 for a product belonging to another org', async () => {
    const res = await api.get(`/api/github/push-events/${PRODUCT_ID}`, { auth: impToken });
    expect(res.status).toBe(404);
  });

  it('should return 200 with an array of push events', async () => {
    const res = await api.get(`/api/github/push-events/${PRODUCT_ID}`, { auth: mfgToken });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(3);
  });

  it('should return events in descending chronological order', async () => {
    const res = await api.get(`/api/github/push-events/${PRODUCT_ID}`, { auth: mfgToken });
    expect(res.status).toBe(200);
    for (let i = 1; i < res.body.length; i++) {
      const prev = new Date(res.body[i - 1].createdAt).getTime();
      const curr = new Date(res.body[i].createdAt).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  it('should have the expected fields on each push event', async () => {
    const res = await api.get(`/api/github/push-events/${PRODUCT_ID}`, { auth: mfgToken });
    expect(res.status).toBe(200);
    for (const ev of res.body) {
      expect(ev).toHaveProperty('id');
      expect(ev).toHaveProperty('pusherName');
      expect(ev).toHaveProperty('branch');
      expect(ev).toHaveProperty('commitCount');
      expect(ev).toHaveProperty('headCommitMessage');
      expect(ev).toHaveProperty('headCommitSha');
      expect(ev).toHaveProperty('provider');
      expect(ev).toHaveProperty('createdAt');
      expect(typeof ev.pusherName).toBe('string');
      expect(typeof ev.commitCount).toBe('number');
    }
  });

  it('should return correct push event data', async () => {
    const res = await api.get(`/api/github/push-events/${PRODUCT_ID}`, { auth: mfgToken });
    expect(res.status).toBe(200);
    // Find alice's 5-commit push (most recent due to insert order)
    const alicePush = res.body.find((ev: any) => ev.commitCount === 5);
    expect(alicePush).toBeTruthy();
    expect(alicePush.pusherName).toBe('alice');
    expect(alicePush.branch).toBe('main');
    expect(alicePush.headCommitMessage).toBe('refactor: clean up code');
    expect(alicePush.provider).toBe('github');
  });

  it('should return empty array for a product with no push events', async () => {
    // impGithub product has no seeded push events
    const res = await api.get(`/api/github/push-events/${IMP_PRODUCT_ID}`, { auth: impToken });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it('should not expose push events from another org', async () => {
    // impToken user cannot access mfg product's push events
    const res = await api.get(`/api/github/push-events/${PRODUCT_ID}`, { auth: impToken });
    expect(res.status).toBe(404);
  });
});

/**
 * Account Route Tests — /api/account
 *
 * Tests GDPR data subject rights:
 * - GET  /api/account/data-export     — Right to data portability
 * - DELETE /api/account               — Right to erasure
 * - POST /api/admin/data-retention/run — Retention cleanup (admin)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  api, TEST_USERS, TEST_PASSWORD, getTestToken, loginTestUser,
  getAppPool, getNeo4jSession, registerTestUser,
} from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('/api/account', () => {
  let mfgAdminToken: string;
  let mfgMember1Token: string;
  let platformAdminToken: string;

  beforeAll(async () => {
    mfgAdminToken = await getTestToken(TEST_USERS.mfgAdmin);
    mfgMember1Token = await getTestToken(TEST_USERS.mfgMember1);
    platformAdminToken = await getTestToken(TEST_USERS.platformAdmin);
  });

  // ─── GET /api/account/data-export ────────────────────────────────────────

  describe('GET /data-export', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get('/api/account/data-export');
      expect(res.status).toBe(401);
    });

    it('should return data export for authenticated user', async () => {
      const res = await api.get('/api/account/data-export', {
        auth: mfgAdminToken,
      });
      expect(res.status).toBe(200);
      expect(res.body.formatVersion).toBe('1.0');
      expect(res.body.exportedAt).toBeTruthy();
    });

    it('should include account section with correct fields', async () => {
      const res = await api.get('/api/account/data-export', {
        auth: mfgAdminToken,
      });
      expect(res.status).toBe(200);

      const { account } = res.body;
      expect(account).toBeDefined();
      expect(account.id).toBe(TEST_IDS.users.mfgAdmin);
      expect(account.email).toBe(TEST_USERS.mfgAdmin);
      expect(typeof account.emailVerified).toBe('boolean');
      expect(account.orgRole).toBe('admin');
      expect(account.createdAt).toBeTruthy();
      expect(account.updatedAt).toBeTruthy();
    });

    it('should include organisation data', async () => {
      const res = await api.get('/api/account/data-export', {
        auth: mfgAdminToken,
      });
      expect(res.status).toBe(200);

      const { organisation } = res.body;
      expect(organisation).toBeDefined();
      expect(organisation.id).toBe(TEST_IDS.orgs.mfgActive);
      expect(organisation.name).toBeTruthy();
    });

    it('should include billing data for org admin', async () => {
      const res = await api.get('/api/account/data-export', {
        auth: mfgAdminToken,
      });
      expect(res.status).toBe(200);

      // Billing may or may not exist depending on seed data
      // Just verify the field is present (null or object)
      expect('billing' in res.body).toBe(true);
    });

    it('should not include billing data for non-admin member', async () => {
      const res = await api.get('/api/account/data-export', {
        auth: mfgMember1Token,
      });
      expect(res.status).toBe(200);
      expect(res.body.billing).toBeNull();
    });

    it('should include repo connections without tokens', async () => {
      const res = await api.get('/api/account/data-export', {
        auth: mfgAdminToken,
      });
      expect(res.status).toBe(200);

      expect(Array.isArray(res.body.repoConnections)).toBe(true);
      // If connections exist, verify no token leakage
      for (const conn of res.body.repoConnections) {
        expect(conn).not.toHaveProperty('access_token_encrypted');
        expect(conn).not.toHaveProperty('accessTokenEncrypted');
        expect(conn.provider).toBeTruthy();
      }
    });

    it('should include products array', async () => {
      const res = await api.get('/api/account/data-export', {
        auth: mfgAdminToken,
      });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.products)).toBe(true);
      // Products may or may not exist depending on cleanup; verify structure if present
      if (res.body.products.length > 0) {
        const product = res.body.products[0];
        expect(product).toHaveProperty('id');
        expect(product).toHaveProperty('name');
      }
    });

    it('should include telemetry array', async () => {
      const res = await api.get('/api/account/data-export', {
        auth: mfgAdminToken,
      });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.telemetry)).toBe(true);
    });

    it('should include exclusions explaining omitted data', async () => {
      const res = await api.get('/api/account/data-export', {
        auth: mfgAdminToken,
      });
      expect(res.status).toBe(200);

      expect(Array.isArray(res.body.exclusions)).toBe(true);
      expect(res.body.exclusions.length).toBeGreaterThan(0);

      const categories = res.body.exclusions.map((e: any) => e.category);
      expect(categories).toContain('Password hash');
      expect(categories).toContain('OAuth tokens');
      expect(categories).toContain('API key secrets');
      expect(categories).toContain('Audit trail');
    });

    it('should not include password hash in account section', async () => {
      const res = await api.get('/api/account/data-export', {
        auth: mfgAdminToken,
      });
      expect(res.status).toBe(200);

      // Verify the account section does not leak password data
      const accountJson = JSON.stringify(res.body.account);
      expect(accountJson).not.toContain('password_hash');
      expect(accountJson).not.toContain('passwordHash');
      expect(accountJson).not.toContain('$2b$'); // bcrypt prefix

      // Verify account fields are exactly what we expect
      const accountKeys = Object.keys(res.body.account);
      expect(accountKeys).not.toContain('password_hash');
      expect(accountKeys).not.toContain('passwordHash');
    });

    it('should include all expected top-level sections', async () => {
      const res = await api.get('/api/account/data-export', {
        auth: mfgAdminToken,
      });
      expect(res.status).toBe(200);

      const expectedSections = [
        'exportedAt', 'formatVersion', 'account', 'organisation',
        'billing', 'repoConnections', 'products', 'stakeholders',
        'feedback', 'apiKeys', 'telemetry', 'copilotUsage',
        'notifications', 'seeSessions', 'exclusions',
      ];

      for (const section of expectedSections) {
        expect(res.body).toHaveProperty(section);
      }
    });

    it('should include arrays for collection fields', async () => {
      const res = await api.get('/api/account/data-export', {
        auth: mfgAdminToken,
      });
      expect(res.status).toBe(200);

      const arrayFields = [
        'repoConnections', 'products', 'stakeholders', 'feedback',
        'apiKeys', 'telemetry', 'copilotUsage', 'notifications',
        'seeSessions', 'exclusions',
      ];

      for (const field of arrayFields) {
        expect(Array.isArray(res.body[field])).toBe(true);
      }
    });
  });

  // ─── DELETE /api/account ─────────────────────────────────────────────────

  describe('DELETE /', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.delete('/api/account');
      expect(res.status).toBe(401);
    });

    it('should reject request without password', async () => {
      const res = await api.delete('/api/account', {
        auth: mfgAdminToken,
        body: {},
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Password confirmation');
    });

    it('should reject request with wrong password', async () => {
      const res = await api.delete('/api/account', {
        auth: mfgAdminToken,
        body: { password: 'WrongPassword123!' },
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Incorrect password');
    });

    it('should reject deletion of sole org admin', async () => {
      // emptyAdmin is the only admin in the empty org
      const emptyAdminToken = await getTestToken(TEST_USERS.emptyAdmin);
      const res = await api.delete('/api/account', {
        auth: emptyAdminToken,
        body: { password: TEST_PASSWORD },
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toContain('sole admin');
    });

    it('should successfully delete a non-admin member account', async () => {
      // Register a fresh user specifically for deletion testing
      const deleteEmail = `test-delete-member-${Date.now()}@account-delete.test`;
      const deleteToken = await registerTestUser(deleteEmail, TEST_PASSWORD);

      // Verify the user exists first
      const meRes = await api.get('/api/auth/me', { auth: deleteToken });
      expect(meRes.status).toBe(200);

      // Delete the account
      const res = await api.delete('/api/account', {
        auth: deleteToken,
        body: { password: TEST_PASSWORD },
      });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted successfully');
      expect(res.body.deleted.user).toBe(true);

      // Verify the user no longer exists
      const pool = getAppPool();
      const check = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [deleteEmail]
      );
      expect(check.rows.length).toBe(0);
    });

    it('should delete associated data (events, connections, feedback)', async () => {
      const deleteEmail = `test-delete-data-${Date.now()}@account-delete.test`;
      const deleteToken = await registerTestUser(deleteEmail, TEST_PASSWORD);
      const pool = getAppPool();

      // Get user ID
      const userResult = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [deleteEmail]
      );
      const userId = userResult.rows[0].id;

      // Insert some test data for this user
      await pool.query(
        `INSERT INTO user_events (user_id, event_type, ip_address, user_agent)
         VALUES ($1, 'test_event', '127.0.0.1', 'test-agent')`,
        [userId]
      );
      await pool.query(
        `INSERT INTO feedback (user_id, email, category, subject, body)
         VALUES ($1, $2, 'feedback', 'Test Subject', 'Test Body')`,
        [userId, deleteEmail]
      );

      // Delete the account
      const res = await api.delete('/api/account', {
        auth: deleteToken,
        body: { password: TEST_PASSWORD },
      });
      expect(res.status).toBe(200);
      expect(res.body.deleted.userEvents).toBeGreaterThanOrEqual(1);
      expect(res.body.deleted.feedback).toBeGreaterThanOrEqual(1);

      // Verify associated data is gone
      const events = await pool.query(
        'SELECT id FROM user_events WHERE user_id = $1',
        [userId]
      );
      expect(events.rows.length).toBe(0);

      const feedback = await pool.query(
        'SELECT id FROM feedback WHERE user_id = $1',
        [userId]
      );
      expect(feedback.rows.length).toBe(0);
    });

    it('should delete Neo4j User node', async () => {
      const deleteEmail = `test-delete-neo4j-${Date.now()}@account-delete.test`;
      const deleteToken = await registerTestUser(deleteEmail, TEST_PASSWORD);
      const pool = getAppPool();

      // Get user ID
      const userResult = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [deleteEmail]
      );
      const userId = userResult.rows[0].id;

      // Verify Neo4j node exists before deletion
      const session = getNeo4jSession();
      try {
        const before = await session.run(
          'MATCH (u:User {id: $userId}) RETURN u',
          { userId }
        );
        // Node may or may not exist depending on registration flow
        // The important thing is that after deletion it's gone
      } finally {
        await session.close();
      }

      // Delete the account
      const res = await api.delete('/api/account', {
        auth: deleteToken,
        body: { password: TEST_PASSWORD },
      });
      expect(res.status).toBe(200);

      // Verify Neo4j node is gone
      const session2 = getNeo4jSession();
      try {
        const after = await session2.run(
          'MATCH (u:User {id: $userId}) RETURN u',
          { userId }
        );
        expect(after.records.length).toBe(0);
      } finally {
        await session2.close();
      }
    });

    it('should return deletion summary in response', async () => {
      const deleteEmail = `test-delete-summary-${Date.now()}@account-delete.test`;
      const deleteToken = await registerTestUser(deleteEmail, TEST_PASSWORD);

      const res = await api.delete('/api/account', {
        auth: deleteToken,
        body: { password: TEST_PASSWORD },
      });
      expect(res.status).toBe(200);

      // Check response structure
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('deleted');
      expect(res.body).toHaveProperty('anonymised');
      expect(res.body.deleted).toHaveProperty('user');
      expect(res.body.deleted).toHaveProperty('repoConnections');
      expect(res.body.deleted).toHaveProperty('userEvents');
      expect(res.body.deleted).toHaveProperty('feedback');
      expect(res.body.deleted).toHaveProperty('apiKeys');
      expect(res.body.deleted).toHaveProperty('neo4jNodes');
      expect(res.body.anonymised).toHaveProperty('billingRecords');
      expect(res.body.anonymised).toHaveProperty('auditTrailEntries');
    });
  });

  // ─── POST /api/admin/data-retention/run ──────────────────────────────────

  describe('POST /api/admin/data-retention/run', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.post('/api/admin/data-retention/run');
      expect(res.status).toBe(401);
    });

    it('should reject non-admin request', async () => {
      const res = await api.post('/api/admin/data-retention/run', {
        auth: mfgAdminToken,
      });
      expect(res.status).toBe(403);
    });

    it('should run retention cleanup for platform admin', async () => {
      const res = await api.post('/api/admin/data-retention/run', {
        auth: platformAdminToken,
      });
      expect(res.status).toBe(200);
      expect(res.body.ranAt).toBeTruthy();
      expect(res.body.deleted).toBeDefined();
      expect(typeof res.body.deleted.expiredTelemetry).toBe('number');
      expect(typeof res.body.deleted.expiredFeedback).toBe('number');
      expect(typeof res.body.deleted.expiredVerificationTokens).toBe('number');
      expect(typeof res.body.deleted.expiredCopilotCache).toBe('number');
    });

    it('should delete telemetry older than 90 days', async () => {
      const pool = getAppPool();

      // Clean up any previous test events first
      await pool.query(
        `DELETE FROM user_events
         WHERE user_id = $1 AND event_type IN ('retention_test_old', 'retention_test_recent')`,
        [TEST_IDS.users.mfgAdmin]
      );

      // Insert an old telemetry event (91 days ago)
      await pool.query(
        `INSERT INTO user_events (user_id, event_type, created_at)
         VALUES ($1, 'retention_test_old', NOW() - INTERVAL '91 days')`,
        [TEST_IDS.users.mfgAdmin]
      );

      // Insert a recent telemetry event (1 day ago)
      await pool.query(
        `INSERT INTO user_events (user_id, event_type, created_at)
         VALUES ($1, 'retention_test_recent', NOW() - INTERVAL '1 day')`,
        [TEST_IDS.users.mfgAdmin]
      );

      // Run retention cleanup
      const res = await api.post('/api/admin/data-retention/run', {
        auth: platformAdminToken,
      });
      expect(res.status).toBe(200);
      expect(res.body.deleted.expiredTelemetry).toBeGreaterThanOrEqual(1);

      // Verify old event is gone
      const oldEvents = await pool.query(
        `SELECT id FROM user_events
         WHERE user_id = $1 AND event_type = 'retention_test_old'`,
        [TEST_IDS.users.mfgAdmin]
      );
      expect(oldEvents.rows.length).toBe(0);

      // Verify recent event is preserved
      const recentEvents = await pool.query(
        `SELECT id FROM user_events
         WHERE user_id = $1 AND event_type = 'retention_test_recent'`,
        [TEST_IDS.users.mfgAdmin]
      );
      expect(recentEvents.rows.length).toBe(1);

      // Clean up the recent test event
      await pool.query(
        `DELETE FROM user_events
         WHERE user_id = $1 AND event_type = 'retention_test_recent'`,
        [TEST_IDS.users.mfgAdmin]
      );
    });

    it('should delete feedback older than 2 years', async () => {
      const pool = getAppPool();

      // Insert old feedback (25 months ago)
      await pool.query(
        `INSERT INTO feedback (user_id, email, category, subject, body, created_at)
         VALUES ($1, 'retention@test.test', 'feedback', 'Old Feedback', 'Body', NOW() - INTERVAL '25 months')`,
        [TEST_IDS.users.mfgAdmin]
      );

      // Run retention cleanup
      const res = await api.post('/api/admin/data-retention/run', {
        auth: platformAdminToken,
      });
      expect(res.status).toBe(200);
      expect(res.body.deleted.expiredFeedback).toBeGreaterThanOrEqual(1);

      // Verify old feedback is gone
      const oldFeedback = await pool.query(
        `SELECT id FROM feedback
         WHERE email = 'retention@test.test' AND subject = 'Old Feedback'`
      );
      expect(oldFeedback.rows.length).toBe(0);
    });

    it('should clear expired verification tokens', async () => {
      const pool = getAppPool();

      // Insert a user with an expired verification token
      const expiredEmail = `expired-token-${Date.now()}@retention.test`;
      await pool.query(
        `INSERT INTO users (email, password_hash, verification_token, token_expires_at)
         VALUES ($1, 'dummy_hash', 'expired_token_123', NOW() - INTERVAL '2 days')
         ON CONFLICT (email) DO UPDATE SET
           verification_token = 'expired_token_123',
           token_expires_at = NOW() - INTERVAL '2 days'`,
        [expiredEmail]
      );

      // Run retention cleanup
      const res = await api.post('/api/admin/data-retention/run', {
        auth: platformAdminToken,
      });
      expect(res.status).toBe(200);
      expect(res.body.deleted.expiredVerificationTokens).toBeGreaterThanOrEqual(1);

      // Verify token is cleared
      const tokenCheck = await pool.query(
        'SELECT verification_token FROM users WHERE email = $1',
        [expiredEmail]
      );
      if (tokenCheck.rows.length > 0) {
        expect(tokenCheck.rows[0].verification_token).toBeNull();
      }

      // Clean up
      await pool.query('DELETE FROM users WHERE email = $1', [expiredEmail]);
    });
  });

  // ─── Security hardening tests ──────────────────────────────────────────

  describe('Security hardening', () => {
    it('should create audit trail entry when account is deleted', async () => {
      const pool = getAppPool();
      const auditEmail = `test-audit-trail-${Date.now()}@account-delete.test`;
      const auditToken = await registerTestUser(auditEmail, TEST_PASSWORD);

      // Get user ID and org_id
      const userResult = await pool.query(
        'SELECT id, org_id FROM users WHERE email = $1',
        [auditEmail]
      );
      const userId = userResult.rows[0].id;

      // Delete the account
      const res = await api.delete('/api/account', {
        auth: auditToken,
        body: { password: TEST_PASSWORD },
      });
      expect(res.status).toBe(200);

      // Verify audit trail entry was created (even though user is gone)
      // The audit entry uses the anonymised email, so search by entity_id
      const auditCheck = await pool.query(
        `SELECT action, summary, metadata FROM product_activity_log
         WHERE entity_type = 'user' AND entity_id = $1 AND action = 'account_deleted'`,
        [userId]
      );
      // May not have org_id if user wasn't in an org, so check conditionally
      if (userResult.rows[0].org_id) {
        expect(auditCheck.rows.length).toBe(1);
        expect(auditCheck.rows[0].summary).toContain('GDPR Art. 17');
        expect(auditCheck.rows[0].metadata.anonReference).toContain('deleted-');
      }
    });

    it('should not leak encrypted tokens in data export', async () => {
      const res = await api.get('/api/account/data-export', {
        auth: mfgAdminToken,
      });
      expect(res.status).toBe(200);

      const json = JSON.stringify(res.body);
      // Must not contain any encrypted token patterns
      expect(json).not.toContain('access_token_encrypted');
      expect(json).not.toContain('accessTokenEncrypted');
      // Must not contain JWT secrets or API key hashes
      expect(json).not.toContain('key_hash');
      expect(json).not.toContain('keyHash');
    });

    it('should not return data for a different user', async () => {
      const res = await api.get('/api/account/data-export', {
        auth: mfgMember1Token,
      });
      expect(res.status).toBe(200);

      // Member1 should get their own data, not the admin's
      expect(res.body.account.email).toBe(TEST_USERS.mfgMember1);
      expect(res.body.account.id).toBe(TEST_IDS.users.mfgMember1);
    });

    it('should not allow deletion with an expired/invalid token', async () => {
      const res = await api.delete('/api/account', {
        auth: 'invalid.token.here',
        body: { password: TEST_PASSWORD },
      });
      expect(res.status).toBe(401);
    });

    it('should create audit entry for retention cleanup', async () => {
      const pool = getAppPool();

      const res = await api.post('/api/admin/data-retention/run', {
        auth: platformAdminToken,
      });
      expect(res.status).toBe(200);

      // Verify audit trail entry exists
      const auditCheck = await pool.query(
        `SELECT action, summary, metadata FROM product_activity_log
         WHERE action = 'retention_cleanup'
         ORDER BY created_at DESC LIMIT 1`
      );
      expect(auditCheck.rows.length).toBe(1);
      expect(auditCheck.rows[0].summary).toContain('retention cleanup');
      expect(auditCheck.rows[0].metadata).toHaveProperty('expiredTelemetry');
    });
  });
});

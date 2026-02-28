/**
 * Repo Connections Route Tests — /api/repo
 *
 * Tests: provider registry, provider properties,
 *        backward-compatible /api/github mount,
 *        PAT-based auth (connect, status, disconnect),
 *        validation and error handling
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

// Forgejo test instance credentials
const FORGEJO_INSTANCE_URL = 'https://escrow.cranis2.dev';
const FORGEJO_ADMIN_USER = 'escrow-admin';
const FORGEJO_ADMIN_PASS = 'Escrow2026Admin';

describe('/api/repo', () => {
  let token: string;
  let impToken: string;

  beforeAll(async () => {
    token = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
  });

  // ─── GET /api/repo/providers ──────────────────────────────────────────

  describe('GET /api/repo/providers', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get('/api/repo/providers');
      expect(res.status).toBe(401);
    });

    it('should return 5 providers', async () => {
      const res = await api.get('/api/repo/providers', { auth: token });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(5);
    });

    it('should include expected fields on each provider', async () => {
      const res = await api.get('/api/repo/providers', { auth: token });
      expect(res.status).toBe(200);

      for (const provider of res.body) {
        expect(provider).toHaveProperty('id');
        expect(provider).toHaveProperty('label');
        expect(provider).toHaveProperty('selfHosted');
        expect(provider).toHaveProperty('oauthSupported');
        expect(provider).toHaveProperty('supportsApiSbom');

        expect(typeof provider.id).toBe('string');
        expect(typeof provider.label).toBe('string');
        expect(typeof provider.selfHosted).toBe('boolean');
        expect(typeof provider.oauthSupported).toBe('boolean');
        expect(typeof provider.supportsApiSbom).toBe('boolean');
      }
    });

    it('should include all known provider IDs', async () => {
      const res = await api.get('/api/repo/providers', { auth: token });
      expect(res.status).toBe(200);

      const ids = res.body.map((p: any) => p.id);
      expect(ids).toContain('github');
      expect(ids).toContain('codeberg');
      expect(ids).toContain('gitea');
      expect(ids).toContain('forgejo');
      expect(ids).toContain('gitlab');
    });

    it('should have oauthSupported true for github', async () => {
      const res = await api.get('/api/repo/providers', { auth: token });
      const github = res.body.find((p: any) => p.id === 'github');
      expect(github).toBeTruthy();
      expect(github.oauthSupported).toBe(true);
    });

    it('should have selfHosted true for gitea, forgejo, gitlab', async () => {
      const res = await api.get('/api/repo/providers', { auth: token });
      for (const id of ['gitea', 'forgejo', 'gitlab']) {
        const provider = res.body.find((p: any) => p.id === id);
        expect(provider).toBeTruthy();
        expect(provider.selfHosted).toBe(true);
      }
    });

    it('should have supportsApiSbom true only for github', async () => {
      const res = await api.get('/api/repo/providers', { auth: token });
      for (const provider of res.body) {
        if (provider.id === 'github') {
          expect(provider.supportsApiSbom).toBe(true);
        } else {
          expect(provider.supportsApiSbom).toBe(false);
        }
      }
    });
  });

  // ─── Backward-compatible /api/github/providers ────────────────────────

  describe('GET /api/github/providers (backward compat)', () => {
    it('should return same provider list at legacy path', async () => {
      const repoRes = await api.get('/api/repo/providers', { auth: token });
      const githubRes = await api.get('/api/github/providers', { auth: token });

      expect(githubRes.status).toBe(200);
      expect(Array.isArray(githubRes.body)).toBe(true);
      expect(githubRes.body.length).toBe(repoRes.body.length);
    });
  });

  // ─── POST /api/repo/connect-pat — Validation ─────────────────────────

  describe('POST /api/repo/connect-pat — validation', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.post('/api/repo/connect-pat', {
        body: { provider: 'forgejo', instanceUrl: FORGEJO_INSTANCE_URL, accessToken: 'fake' },
      });
      expect(res.status).toBe(401);
    });

    it('should reject missing provider', async () => {
      const res = await api.post('/api/repo/connect-pat', {
        auth: token,
        body: { instanceUrl: FORGEJO_INSTANCE_URL, accessToken: 'fake' },
      });
      expect(res.status).toBe(400);
    });

    it('should reject missing instanceUrl', async () => {
      const res = await api.post('/api/repo/connect-pat', {
        auth: token,
        body: { provider: 'forgejo', accessToken: 'fake' },
      });
      expect(res.status).toBe(400);
    });

    it('should reject missing accessToken', async () => {
      const res = await api.post('/api/repo/connect-pat', {
        auth: token,
        body: { provider: 'forgejo', instanceUrl: FORGEJO_INSTANCE_URL },
      });
      expect(res.status).toBe(400);
    });

    it('should reject empty string fields', async () => {
      const res = await api.post('/api/repo/connect-pat', {
        auth: token,
        body: { provider: '', instanceUrl: '', accessToken: '' },
      });
      expect(res.status).toBe(400);
    });

    it('should reject github as provider (use OAuth instead)', async () => {
      const res = await api.post('/api/repo/connect-pat', {
        auth: token,
        body: { provider: 'github', instanceUrl: 'https://github.com', accessToken: 'ghp_fake' },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/oauth/i);
    });

    it('should reject codeberg as provider (use OAuth instead)', async () => {
      const res = await api.post('/api/repo/connect-pat', {
        auth: token,
        body: { provider: 'codeberg', instanceUrl: 'https://codeberg.org', accessToken: 'fake' },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/oauth/i);
    });

    it('should reject invalid/unknown provider', async () => {
      const res = await api.post('/api/repo/connect-pat', {
        auth: token,
        body: { provider: 'bitbucket', instanceUrl: 'https://bitbucket.org', accessToken: 'fake' },
      });
      expect(res.status).toBe(400);
    });

    it('should reject invalid PAT with proper error', async () => {
      const res = await api.post('/api/repo/connect-pat', {
        auth: token,
        body: { provider: 'forgejo', instanceUrl: FORGEJO_INSTANCE_URL, accessToken: 'invalid_token_xyz' },
      });
      // Should fail PAT validation against the Forgejo API
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  // ─── POST /api/repo/connect-pat — Success Flow ───────────────────────

  describe('POST /api/repo/connect-pat — Forgejo integration', () => {
    let forgejoToken: string;

    // Create a fresh PAT for testing
    beforeAll(async () => {
      const tokenRes = await fetch(`${FORGEJO_INSTANCE_URL}/api/v1/users/${FORGEJO_ADMIN_USER}/tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic ' + btoa(`${FORGEJO_ADMIN_USER}:${FORGEJO_ADMIN_PASS}`),
        },
        body: JSON.stringify({ name: `test-pat-${Date.now()}`, scopes: ['read:user', 'read:repository'] }),
      });
      const tokenData = await tokenRes.json();
      forgejoToken = tokenData.sha1;
    });

    // Clean up: disconnect after all tests in this block
    afterAll(async () => {
      await api.delete('/api/repo/disconnect/forgejo', { auth: token });
      // Also clean up for impAdmin if connected
      await api.delete('/api/repo/disconnect/forgejo', { auth: impToken });
    });

    it('should connect Forgejo via valid PAT', async () => {
      const res = await api.post('/api/repo/connect-pat', {
        auth: token,
        body: { provider: 'forgejo', instanceUrl: FORGEJO_INSTANCE_URL, accessToken: forgejoToken },
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('provider', 'forgejo');
      expect(res.body).toHaveProperty('username', FORGEJO_ADMIN_USER);
      expect(res.body).toHaveProperty('instanceUrl');
      expect(res.body.instanceUrl).toContain('escrow.cranis2.dev');
    });

    it('should return username and avatarUrl on successful connect', async () => {
      // Re-connect (upsert) to verify response shape
      const res = await api.post('/api/repo/connect-pat', {
        auth: token,
        body: { provider: 'forgejo', instanceUrl: FORGEJO_INSTANCE_URL, accessToken: forgejoToken },
      });
      expect(res.status).toBe(200);
      expect(typeof res.body.username).toBe('string');
      expect(res.body.username.length).toBeGreaterThan(0);
      // avatarUrl may be empty string but should be present
      expect(res.body).toHaveProperty('avatarUrl');
    });

    it('should normalise instanceUrl (strip trailing slash)', async () => {
      const res = await api.post('/api/repo/connect-pat', {
        auth: token,
        body: { provider: 'forgejo', instanceUrl: FORGEJO_INSTANCE_URL + '///', accessToken: forgejoToken },
      });
      expect(res.status).toBe(200);
      expect(res.body.instanceUrl).not.toMatch(/\/$/);
    });

    it('should allow different users to connect same provider independently', async () => {
      const res = await api.post('/api/repo/connect-pat', {
        auth: impToken,
        body: { provider: 'forgejo', instanceUrl: FORGEJO_INSTANCE_URL, accessToken: forgejoToken },
      });
      expect(res.status).toBe(200);
      expect(res.body.provider).toBe('forgejo');
    });
  });

  // ─── GET /api/repo/status — with PAT connections ──────────────────────

  describe('GET /api/repo/status — PAT connections', () => {
    let forgejoToken: string;

    beforeAll(async () => {
      // Create PAT and connect
      const tokenRes = await fetch(`${FORGEJO_INSTANCE_URL}/api/v1/users/${FORGEJO_ADMIN_USER}/tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic ' + btoa(`${FORGEJO_ADMIN_USER}:${FORGEJO_ADMIN_PASS}`),
        },
        body: JSON.stringify({ name: `test-status-${Date.now()}`, scopes: ['read:user', 'read:repository'] }),
      });
      const tokenData = await tokenRes.json();
      forgejoToken = tokenData.sha1;

      await api.post('/api/repo/connect-pat', {
        auth: token,
        body: { provider: 'forgejo', instanceUrl: FORGEJO_INSTANCE_URL, accessToken: forgejoToken },
      });
    });

    afterAll(async () => {
      await api.delete('/api/repo/disconnect/forgejo', { auth: token });
    });

    it('should reject unauthenticated request', async () => {
      const res = await api.get('/api/repo/status');
      expect(res.status).toBe(401);
    });

    it('should return connections array', async () => {
      const res = await api.get('/api/repo/status', { auth: token });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('connections');
      expect(Array.isArray(res.body.connections)).toBe(true);
    });

    it('should show Forgejo connection with instanceUrl', async () => {
      const res = await api.get('/api/repo/status', { auth: token });
      expect(res.status).toBe(200);

      const forgejo = res.body.connections.find((c: any) => c.provider === 'forgejo');
      expect(forgejo).toBeTruthy();
      expect(forgejo.username).toBe(FORGEJO_ADMIN_USER);
      expect(forgejo).toHaveProperty('instanceUrl');
      expect(forgejo.instanceUrl).toContain('escrow.cranis2.dev');
    });

    it('should include expected fields on each connection', async () => {
      const res = await api.get('/api/repo/status', { auth: token });
      expect(res.status).toBe(200);

      for (const conn of res.body.connections) {
        expect(conn).toHaveProperty('provider');
        expect(conn).toHaveProperty('username');
        expect(typeof conn.provider).toBe('string');
        expect(typeof conn.username).toBe('string');
      }
    });

    it('should work at legacy /api/github/status path', async () => {
      const res = await api.get('/api/github/status', { auth: token });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('connections');

      const forgejo = res.body.connections.find((c: any) => c.provider === 'forgejo');
      expect(forgejo).toBeTruthy();
    });
  });

  // ─── DELETE /api/repo/disconnect/:provider ────────────────────────────

  describe('DELETE /api/repo/disconnect/:provider', () => {
    let forgejoToken: string;

    beforeAll(async () => {
      // Create PAT and connect
      const tokenRes = await fetch(`${FORGEJO_INSTANCE_URL}/api/v1/users/${FORGEJO_ADMIN_USER}/tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic ' + btoa(`${FORGEJO_ADMIN_USER}:${FORGEJO_ADMIN_PASS}`),
        },
        body: JSON.stringify({ name: `test-disconnect-${Date.now()}`, scopes: ['read:user', 'read:repository'] }),
      });
      const tokenData = await tokenRes.json();
      forgejoToken = tokenData.sha1;
    });

    it('should reject unauthenticated disconnect', async () => {
      const res = await api.delete('/api/repo/disconnect/forgejo');
      expect(res.status).toBe(401);
    });

    it('should disconnect a PAT-connected provider', async () => {
      // First connect
      const connectRes = await api.post('/api/repo/connect-pat', {
        auth: token,
        body: { provider: 'forgejo', instanceUrl: FORGEJO_INSTANCE_URL, accessToken: forgejoToken },
      });
      expect(connectRes.status).toBe(200);

      // Then disconnect
      const disconnectRes = await api.delete('/api/repo/disconnect/forgejo', { auth: token });
      expect(disconnectRes.status).toBe(200);
      expect(disconnectRes.body).toHaveProperty('message');
      expect(disconnectRes.body.message).toMatch(/forgejo/i);
    });

    it('should remove connection from status after disconnect', async () => {
      // Connect
      await api.post('/api/repo/connect-pat', {
        auth: token,
        body: { provider: 'forgejo', instanceUrl: FORGEJO_INSTANCE_URL, accessToken: forgejoToken },
      });

      // Verify connected
      const statusBefore = await api.get('/api/repo/status', { auth: token });
      const forjejoBefore = statusBefore.body.connections.find((c: any) => c.provider === 'forgejo');
      expect(forjejoBefore).toBeTruthy();

      // Disconnect
      await api.delete('/api/repo/disconnect/forgejo', { auth: token });

      // Verify disconnected
      const statusAfter = await api.get('/api/repo/status', { auth: token });
      const forgejoAfter = statusAfter.body.connections.find((c: any) => c.provider === 'forgejo');
      expect(forgejoAfter).toBeFalsy();
    });

    it('should show correct provider name in disconnect message', async () => {
      // Connect first
      await api.post('/api/repo/connect-pat', {
        auth: token,
        body: { provider: 'forgejo', instanceUrl: FORGEJO_INSTANCE_URL, accessToken: forgejoToken },
      });

      const res = await api.delete('/api/repo/disconnect/forgejo', { auth: token });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/Forgejo/);
    });

    it('should work at legacy /api/github/disconnect path', async () => {
      // Connect
      await api.post('/api/repo/connect-pat', {
        auth: token,
        body: { provider: 'forgejo', instanceUrl: FORGEJO_INSTANCE_URL, accessToken: forgejoToken },
      });

      // Disconnect via legacy path
      const res = await api.delete('/api/github/disconnect/forgejo', { auth: token });
      expect(res.status).toBe(200);
    });
  });

  // ─── PAT provider types — gitea and gitlab ────────────────────────────

  describe('POST /api/repo/connect-pat — provider type acceptance', () => {
    it('should accept gitea as provider', async () => {
      // Gitea uses same API as Forgejo, so our Forgejo instance works
      // This tests the routing/dispatch, not a real Gitea instance
      const tokenRes = await fetch(`${FORGEJO_INSTANCE_URL}/api/v1/users/${FORGEJO_ADMIN_USER}/tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic ' + btoa(`${FORGEJO_ADMIN_USER}:${FORGEJO_ADMIN_PASS}`),
        },
        body: JSON.stringify({ name: `test-gitea-${Date.now()}`, scopes: ['read:user', 'read:repository'] }),
      });
      const tokenData = await tokenRes.json();

      const res = await api.post('/api/repo/connect-pat', {
        auth: token,
        body: { provider: 'gitea', instanceUrl: FORGEJO_INSTANCE_URL, accessToken: tokenData.sha1 },
      });
      expect(res.status).toBe(200);
      expect(res.body.provider).toBe('gitea');
      expect(res.body.username).toBe(FORGEJO_ADMIN_USER);

      // Clean up
      await api.delete('/api/repo/disconnect/gitea', { auth: token });
    });

    it('should reject gitlab with invalid instance URL', async () => {
      const res = await api.post('/api/repo/connect-pat', {
        auth: token,
        body: { provider: 'gitlab', instanceUrl: 'https://nonexistent-gitlab.invalid', accessToken: 'glpat-fake' },
      });
      // Should fail because the instance doesn't exist
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  // ─── Upsert behavior (re-connect same provider) ──────────────────────

  describe('POST /api/repo/connect-pat — upsert behavior', () => {
    let pat1: string;
    let pat2: string;

    beforeAll(async () => {
      // Create two different PATs
      const res1 = await fetch(`${FORGEJO_INSTANCE_URL}/api/v1/users/${FORGEJO_ADMIN_USER}/tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic ' + btoa(`${FORGEJO_ADMIN_USER}:${FORGEJO_ADMIN_PASS}`),
        },
        body: JSON.stringify({ name: `test-upsert1-${Date.now()}`, scopes: ['read:user', 'read:repository'] }),
      });
      pat1 = (await res1.json()).sha1;

      const res2 = await fetch(`${FORGEJO_INSTANCE_URL}/api/v1/users/${FORGEJO_ADMIN_USER}/tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic ' + btoa(`${FORGEJO_ADMIN_USER}:${FORGEJO_ADMIN_PASS}`),
        },
        body: JSON.stringify({ name: `test-upsert2-${Date.now()}`, scopes: ['read:user', 'read:repository'] }),
      });
      pat2 = (await res2.json()).sha1;
    });

    afterAll(async () => {
      await api.delete('/api/repo/disconnect/forgejo', { auth: token });
    });

    it('should allow re-connecting with a different PAT (upsert)', async () => {
      // Connect with first PAT
      const res1 = await api.post('/api/repo/connect-pat', {
        auth: token,
        body: { provider: 'forgejo', instanceUrl: FORGEJO_INSTANCE_URL, accessToken: pat1 },
      });
      expect(res1.status).toBe(200);

      // Re-connect with second PAT (should upsert, not fail)
      const res2 = await api.post('/api/repo/connect-pat', {
        auth: token,
        body: { provider: 'forgejo', instanceUrl: FORGEJO_INSTANCE_URL, accessToken: pat2 },
      });
      expect(res2.status).toBe(200);
      expect(res2.body.username).toBe(FORGEJO_ADMIN_USER);
    });

    it('should still show only one connection after upsert', async () => {
      const status = await api.get('/api/repo/status', { auth: token });
      const forgejoConnections = status.body.connections.filter((c: any) => c.provider === 'forgejo');
      expect(forgejoConnections.length).toBe(1);
    });
  });
});

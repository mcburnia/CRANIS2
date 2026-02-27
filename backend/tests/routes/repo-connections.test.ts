/**
 * Repo Connections Route Tests — /api/repo
 *
 * Tests: provider registry, provider properties,
 *        backward-compatible /api/github mount
 */

import { describe, it, expect } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

describe('/api/repo', () => {
  let token: string;

  beforeAll(async () => {
    token = await loginTestUser(TEST_USERS.mfgAdmin);
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
});

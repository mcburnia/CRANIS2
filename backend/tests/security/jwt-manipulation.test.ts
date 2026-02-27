/**
 * Security Tests — JWT Manipulation
 *
 * Tests that the backend rejects tampered, forged, and malformed JWTs.
 * Covers algorithm confusion, payload tampering, expired tokens,
 * signature stripping, and token isolation between users.
 */

import { describe, it, expect } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Base64url encode (no padding, URL-safe). */
function b64url(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Decode a base64url string. */
function b64urlDecode(input: string): string {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

/** Build a fake JWT from header, payload, and signature parts. */
function buildJwt(header: object, payload: object, signature: string = ''): string {
  return `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}.${signature}`;
}

/** Split a real JWT into its three decoded parts. */
function splitJwt(token: string): { header: any; payload: any; signature: string } {
  const [h, p, s] = token.split('.');
  return {
    header: JSON.parse(b64urlDecode(h)),
    payload: JSON.parse(b64urlDecode(p)),
    signature: s,
  };
}

/** A protected endpoint that returns user-specific data. */
const PROTECTED_ENDPOINT = '/api/org';

// ─── Tests ───────────────────────────────────────────────────────────────

describe('JWT Manipulation', () => {

  // ─── 1. Expired Token ────────────────────────────────────────────────

  describe('Expired token', () => {
    it('should reject a token with iat far in the past (simulating expiry)', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const { header, payload } = splitJwt(token);

      // Set iat to 10 years ago and exp to 9 years ago
      payload.iat = Math.floor(Date.now() / 1000) - 315360000; // 10 years ago
      payload.exp = Math.floor(Date.now() / 1000) - 283824000; // 9 years ago

      const forgedToken = buildJwt(header, payload, 'forged-signature');
      const res = await api.get(PROTECTED_ENDPOINT, { auth: forgedToken });

      expect(res.status).not.toBe(200);
      expect([401, 500]).toContain(res.status);
    });
  });

  // ─── 2. Tampered Payload (userId changed) ───────────────────────────

  describe('Tampered payload — userId changed', () => {
    it('should reject a token where userId has been altered', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const parts = token.split('.');

      // Decode payload, change userId, re-encode — but keep original signature
      const payload = JSON.parse(b64urlDecode(parts[1]));
      payload.userId = '00000000-0000-0000-0000-000000000000';
      const tamperedPayload = b64url(JSON.stringify(payload));

      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
      const res = await api.get(PROTECTED_ENDPOINT, { auth: tamperedToken });

      expect(res.status).not.toBe(200);
      expect([401, 500]).toContain(res.status);
    });
  });

  // ─── 3. Algorithm "none" Attack ──────────────────────────────────────

  describe('Algorithm "none" attack', () => {
    it('should reject a token with alg: "none" and no signature', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const { payload } = splitJwt(token);

      const forgedToken = buildJwt({ alg: 'none', typ: 'JWT' }, payload, '');
      const res = await api.get(PROTECTED_ENDPOINT, { auth: forgedToken });

      expect(res.status).not.toBe(200);
      expect([401, 500]).toContain(res.status);
    });

    it('should reject a token with alg: "None" (case variation)', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const { payload } = splitJwt(token);

      const forgedToken = buildJwt({ alg: 'None', typ: 'JWT' }, payload, '');
      const res = await api.get(PROTECTED_ENDPOINT, { auth: forgedToken });

      expect(res.status).not.toBe(200);
      expect([401, 500]).toContain(res.status);
    });

    it('should reject a token with alg: "NONE" (uppercase)', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const { payload } = splitJwt(token);

      const forgedToken = buildJwt({ alg: 'NONE', typ: 'JWT' }, payload, '');
      const res = await api.get(PROTECTED_ENDPOINT, { auth: forgedToken });

      expect(res.status).not.toBe(200);
      expect([401, 500]).toContain(res.status);
    });
  });

  // ─── 4. Empty Signature ──────────────────────────────────────────────

  describe('Empty signature', () => {
    it('should reject a token with the signature stripped', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const parts = token.split('.');

      // Keep original header and payload but remove signature
      const strippedToken = `${parts[0]}.${parts[1]}.`;
      const res = await api.get(PROTECTED_ENDPOINT, { auth: strippedToken });

      expect(res.status).not.toBe(200);
      expect([401, 500]).toContain(res.status);
    });

    it('should reject a two-part token (no signature segment)', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const parts = token.split('.');

      const twoPartToken = `${parts[0]}.${parts[1]}`;
      const res = await api.get(PROTECTED_ENDPOINT, { auth: twoPartToken });

      expect(res.status).not.toBe(200);
      expect([401, 500]).toContain(res.status);
    });
  });

  // ─── 5. Algorithm Confusion (RS256 vs HS256) ────────────────────────

  describe('Algorithm confusion — RS256 header with HS256 server', () => {
    it('should reject a token claiming RS256 algorithm', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const { payload } = splitJwt(token);

      // Forge a token claiming RS256 but signed with nothing useful
      const forgedToken = buildJwt(
        { alg: 'RS256', typ: 'JWT' },
        payload,
        'fake-rsa-signature'
      );
      const res = await api.get(PROTECTED_ENDPOINT, { auth: forgedToken });

      expect(res.status).not.toBe(200);
      expect([401, 500]).toContain(res.status);
    });

    it('should reject a token claiming ES256 algorithm', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const { payload } = splitJwt(token);

      const forgedToken = buildJwt(
        { alg: 'ES256', typ: 'JWT' },
        payload,
        'fake-ec-signature'
      );
      const res = await api.get(PROTECTED_ENDPOINT, { auth: forgedToken });

      expect(res.status).not.toBe(200);
      expect([401, 500]).toContain(res.status);
    });
  });

  // ─── 6. Very Long Token (10KB) ──────────────────────────────────────

  describe('Oversized token (10KB)', () => {
    it('should reject a token padded to 10KB', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const { header, payload } = splitJwt(token);

      // Add a massive claim to bloat the payload
      payload.padding = 'A'.repeat(10 * 1024);

      const bloatedToken = buildJwt(header, payload, 'bloated-signature');
      const res = await api.get(PROTECTED_ENDPOINT, { auth: bloatedToken });

      expect(res.status).not.toBe(200);
      expect([400, 401, 500, 413, 431]).toContain(res.status);
    });
  });

  // ─── 7. Extra Claims (privilege escalation) ─────────────────────────

  describe('Extra claims — privilege escalation attempts', () => {
    it('should not honour an injected isAdmin: true claim', async () => {
      const token = await loginTestUser(TEST_USERS.mfgMember1);
      const parts = token.split('.');

      const payload = JSON.parse(b64urlDecode(parts[1]));
      payload.isAdmin = true;
      payload.role = 'admin';
      payload.is_platform_admin = true;
      const tamperedPayload = b64url(JSON.stringify(payload));

      // Re-assemble with original signature (signature mismatch)
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
      const res = await api.get('/api/admin/dashboard', { auth: tamperedToken });

      expect(res.status).not.toBe(200);
      expect([401, 403, 500]).toContain(res.status);
    });

    it('should reject a forged token with role: "platform_admin"', async () => {
      const token = await loginTestUser(TEST_USERS.mfgMember1);
      const { header, payload } = splitJwt(token);

      payload.role = 'platform_admin';
      payload.isAdmin = true;

      const forgedToken = buildJwt(header, payload, 'forged-escalation');
      const res = await api.get('/api/admin/dashboard', { auth: forgedToken });

      expect(res.status).not.toBe(200);
      expect([401, 403, 500]).toContain(res.status);
    });
  });

  // ─── 8. Modified Email ───────────────────────────────────────────────

  describe('Modified email in payload', () => {
    it('should reject a token with email changed to another user', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const parts = token.split('.');

      const payload = JSON.parse(b64urlDecode(parts[1]));
      payload.email = TEST_USERS.impAdmin; // Change to importer admin's email
      const tamperedPayload = b64url(JSON.stringify(payload));

      // Signature no longer matches
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
      const res = await api.get(PROTECTED_ENDPOINT, { auth: tamperedToken });

      expect(res.status).not.toBe(200);
      expect([401, 500]).toContain(res.status);
    });

    it('should reject a token with email changed to non-existent user', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const parts = token.split('.');

      const payload = JSON.parse(b64urlDecode(parts[1]));
      payload.email = 'attacker@evil.com';
      const tamperedPayload = b64url(JSON.stringify(payload));

      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
      const res = await api.get(PROTECTED_ENDPOINT, { auth: tamperedToken });

      expect(res.status).not.toBe(200);
      expect([401, 500]).toContain(res.status);
    });
  });

  // ─── 9. Base64-Encoded Garbage ───────────────────────────────────────

  describe('Base64-encoded garbage as token', () => {
    it('should reject random base64url garbage in three-part format', async () => {
      const garbage = `${b64url('{"not":"jwt"}')}.${b64url('garbage-payload')}.garbage-sig`;
      const res = await api.get(PROTECTED_ENDPOINT, { auth: garbage });

      expect(res.status).not.toBe(200);
      expect([401, 500]).toContain(res.status);
    });

    it('should reject completely random bytes as token', async () => {
      const randomBytes = Buffer.from(
        Array.from({ length: 128 }, () => Math.floor(Math.random() * 256))
      ).toString('base64url');

      const res = await api.get(PROTECTED_ENDPOINT, { auth: randomBytes });

      expect(res.status).not.toBe(200);
      expect([401, 500]).toContain(res.status);
    });

    it('should reject a token with valid header but garbage payload and signature', async () => {
      const validHeader = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const garbagePayload = b64url('!!!not-json!!!');
      const garbageSig = 'AAAA';

      const garbageToken = `${validHeader}.${garbagePayload}.${garbageSig}`;
      const res = await api.get(PROTECTED_ENDPOINT, { auth: garbageToken });

      expect(res.status).not.toBe(200);
      expect([401, 500]).toContain(res.status);
    });

    it('should reject an empty string', async () => {
      const res = await api.get(PROTECTED_ENDPOINT, { auth: '' });
      expect(res.status).toBe(401);
    });

    it('should reject whitespace-only token', async () => {
      const res = await api.get(PROTECTED_ENDPOINT, { auth: '   ' });

      expect(res.status).not.toBe(200);
      expect([401, 500]).toContain(res.status);
    });
  });

  // ─── 10. Token Isolation Between Users ───────────────────────────────

  describe('Token isolation — each token returns its own user data', () => {
    it('mfgAdmin token should return manufacturer org data, not importer data', async () => {
      const mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
      const impToken = await loginTestUser(TEST_USERS.impAdmin);

      // Fetch org data with each token
      const mfgRes = await api.get(PROTECTED_ENDPOINT, { auth: mfgToken });
      const impRes = await api.get(PROTECTED_ENDPOINT, { auth: impToken });

      expect(mfgRes.status).toBe(200);
      expect(impRes.status).toBe(200);

      // Each user should see their own org — the two should differ
      expect(mfgRes.body).toBeDefined();
      expect(impRes.body).toBeDefined();

      // Org names or IDs must be different (they belong to different orgs)
      const mfgOrg = mfgRes.body.org || mfgRes.body;
      const impOrg = impRes.body.org || impRes.body;

      if (mfgOrg.id && impOrg.id) {
        expect(mfgOrg.id).not.toBe(impOrg.id);
      }
      if (mfgOrg.name && impOrg.name) {
        expect(mfgOrg.name).not.toBe(impOrg.name);
      }
    });

    it('mfgAdmin token should not return impAdmin user info on /api/auth/me', async () => {
      const mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);

      const res = await api.get('/api/auth/me', { auth: mfgToken });
      expect(res.status).toBe(200);

      // The returned email should match mfgAdmin, not impAdmin
      const user = res.body.user || res.body;
      expect(user.email).toBe(TEST_USERS.mfgAdmin);
      expect(user.email).not.toBe(TEST_USERS.impAdmin);
    });

    it('impAdmin token should return impAdmin user info on /api/auth/me', async () => {
      const impToken = await loginTestUser(TEST_USERS.impAdmin);

      const res = await api.get('/api/auth/me', { auth: impToken });
      expect(res.status).toBe(200);

      const user = res.body.user || res.body;
      expect(user.email).toBe(TEST_USERS.impAdmin);
      expect(user.email).not.toBe(TEST_USERS.mfgAdmin);
    });

    it('swapping tokens should not grant cross-org access', async () => {
      const mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);

      // Use mfgAdmin token to get their org
      const mfgOrgRes = await api.get(PROTECTED_ENDPOINT, { auth: mfgToken });
      expect(mfgOrgRes.status).toBe(200);

      const mfgOrg = mfgOrgRes.body.org || mfgOrgRes.body;

      // The org returned should be the manufacturer org, not the importer
      // We verify by checking the /api/auth/me endpoint confirms identity
      const meRes = await api.get('/api/auth/me', { auth: mfgToken });
      expect(meRes.status).toBe(200);

      const user = meRes.body.user || meRes.body;
      expect(user.email).toBe(TEST_USERS.mfgAdmin);

      // If org has a name, it should contain "manufacturer" (from seed data naming)
      if (mfgOrg.name) {
        expect(mfgOrg.name.toLowerCase()).not.toContain('importer');
      }
    });
  });
});

/**
 * Break Tests — Unit Level: Malformed JSON
 *
 * Tests API resilience against malformed, truncated, and invalid JSON bodies.
 * Uses raw fetch to send non-JSON payloads the helper client would reject.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS, BASE_URL } from '../../setup/test-helpers.js';

describe('Break: Malformed JSON', () => {
  let token: string;

  beforeAll(async () => {
    token = await loginTestUser(TEST_USERS.mfgAdmin);
  });

  // ─── Raw fetch helper for sending invalid JSON ─────────────────────────

  async function rawPost(path: string, rawBody: string, auth?: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (auth) headers['Authorization'] = `Bearer ${auth}`;

    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: rawBody,
      signal: AbortSignal.timeout(15000),
    });
    return { status: res.status };
  }

  // ─── Truncated JSON ────────────────────────────────────────────────────

  describe('Truncated JSON', () => {
    it('should handle truncated JSON object', async () => {
      const res = await rawPost('/api/auth/login', '{"email":"test@test.com","pass');
      expect([400, 500]).toContain(res.status);
    });

    it('should handle JSON missing closing brace', async () => {
      const res = await rawPost('/api/auth/login', '{"email":"test@test.com","password":"pass"');
      expect([400, 500]).toContain(res.status);
    });

    it('should handle JSON missing closing bracket', async () => {
      const res = await rawPost('/api/cra-reports', '{"productId":"test","stages":[{"stage":"test"', token);
      expect([400, 422, 500]).toContain(res.status);
    });
  });

  // ─── Invalid JSON syntax ───────────────────────────────────────────────

  describe('Invalid JSON syntax', () => {
    it('should handle single quotes instead of double', async () => {
      const res = await rawPost('/api/auth/login', "{'email':'test@test.com','password':'pass'}");
      expect([400, 500]).toContain(res.status);
    });

    it('should handle trailing comma', async () => {
      const res = await rawPost('/api/auth/login', '{"email":"test@test.com","password":"pass",}');
      expect([400, 500]).toContain(res.status);
    });

    it('should handle unquoted keys', async () => {
      const res = await rawPost('/api/auth/login', '{email:"test@test.com",password:"pass"}');
      expect([400, 500]).toContain(res.status);
    });

    it('should handle JavaScript (not JSON) object', async () => {
      const res = await rawPost('/api/auth/login', '{email: "test@test.com", password: "pass"}');
      expect([400, 500]).toContain(res.status);
    });

    it('should handle comments in JSON', async () => {
      const res = await rawPost('/api/auth/login', '{"email":"test@test.com"/* comment */,"password":"pass"}');
      expect([400, 500]).toContain(res.status);
    });
  });

  // ─── Wrong root type ───────────────────────────────────────────────────

  describe('Wrong root type', () => {
    it('should handle JSON array instead of object', async () => {
      const res = await rawPost('/api/auth/login', '["test@test.com","pass"]');
      expect([400, 500]).toContain(res.status);
    });

    it('should handle JSON string instead of object', async () => {
      const res = await rawPost('/api/auth/login', '"just a string"');
      expect([400, 500]).toContain(res.status);
    });

    it('should handle JSON number instead of object', async () => {
      const res = await rawPost('/api/auth/login', '42');
      expect([400, 500]).toContain(res.status);
    });

    it('should handle JSON null instead of object', async () => {
      const res = await rawPost('/api/auth/login', 'null');
      expect([400, 500]).toContain(res.status);
    });

    it('should handle JSON boolean instead of object', async () => {
      const res = await rawPost('/api/auth/login', 'true');
      expect([400, 500]).toContain(res.status);
    });
  });

  // ─── Non-JSON content with JSON Content-Type ───────────────────────────

  describe('Non-JSON content', () => {
    it('should handle plain text with JSON content-type', async () => {
      const res = await rawPost('/api/auth/login', 'this is not json');
      expect([400, 500]).toContain(res.status);
    });

    it('should handle XML with JSON content-type', async () => {
      const res = await rawPost('/api/auth/login', '<root><email>test@test.com</email></root>');
      expect([400, 500]).toContain(res.status);
    });

    it('should handle URL-encoded form data with JSON content-type', async () => {
      const res = await rawPost('/api/auth/login', 'email=test@test.com&password=pass');
      expect([400, 500]).toContain(res.status);
    });

    it('should handle empty string', async () => {
      const res = await rawPost('/api/auth/login', '');
      expect([400, 500]).toContain(res.status);
    });

    it('should handle whitespace only', async () => {
      const res = await rawPost('/api/auth/login', '   \n\t  ');
      expect([400, 500]).toContain(res.status);
    });

    it('should handle binary content', async () => {
      const binary = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD]).toString();
      const res = await rawPost('/api/auth/login', binary);
      expect([400, 500]).toContain(res.status);
    });
  });

  // ─── Unicode edge cases in JSON ────────────────────────────────────────

  describe('Unicode edge cases in JSON', () => {
    it('should handle null bytes in JSON string', async () => {
      const res = await rawPost('/api/auth/login', '{"email":"test\\u0000@test.com","password":"pass"}');
      expect([400, 401, 500]).toContain(res.status);
    });

    it('should handle BOM (byte order mark)', async () => {
      const res = await rawPost('/api/auth/login', '\uFEFF{"email":"test@test.com","password":"pass"}');
      expect([400, 401, 500]).toContain(res.status);
    });

    it('should handle control characters', async () => {
      const res = await rawPost('/api/auth/login', '{"email":"test\\u0007@test.com","password":"pass"}');
      expect([400, 401, 500]).toContain(res.status);
    });
  });

  // ─── Content-Type variations ───────────────────────────────────────────

  describe('Content-Type variations', () => {
    it('should handle multipart/form-data content type', async () => {
      const headers: Record<string, string> = {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${token}`,
      };
      const res = await fetch(`${BASE_URL}/api/products`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'test', craCategory: 'default' }),
        signal: AbortSignal.timeout(15000),
      });
      expect([400, 415, 422, 500]).toContain(res.status);
    });

    it('should handle application/xml content type', async () => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/xml',
        'Authorization': `Bearer ${token}`,
      };
      const res = await fetch(`${BASE_URL}/api/products`, {
        method: 'POST',
        headers,
        body: '<product><name>test</name></product>',
        signal: AbortSignal.timeout(15000),
      });
      expect([400, 415, 422, 500]).toContain(res.status);
    });

    it('should handle missing Content-Type header on POST', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {},
        body: JSON.stringify({ email: 'test@test.com', password: 'pass' }),
        signal: AbortSignal.timeout(15000),
      });
      expect([400, 401, 415, 500]).toContain(res.status);
    });
  });
});

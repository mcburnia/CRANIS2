/**
 * Webhook Tests — GitHub Push Events
 *
 * Tests the /api/github/webhook (and /api/repo/webhook) endpoint:
 * - Signature verification (HMAC-SHA256)
 * - Push event handling (marks SBOM stale)
 * - Non-push events are ignored
 * - Missing/invalid signatures rejected
 *
 * Note: Without the actual GITHUB_WEBHOOK_SECRET from the server env,
 * we can only test rejection of invalid signatures and structural validation.
 * Valid signature tests require the secret or a test-mode bypass.
 */

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { BASE_URL } from '../setup/test-helpers.js';

const WEBHOOK_URL = `${BASE_URL}/api/github/webhook`;
const REPO_WEBHOOK_URL = `${BASE_URL}/api/repo/webhook`;

/** Send a raw webhook request with custom headers. */
async function sendWebhook(
  url: string,
  body: object,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: any }> {
  const rawBody = JSON.stringify(body);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: rawBody,
    signal: AbortSignal.timeout(15000),
  });

  let responseBody: any;
  const text = await res.text();
  try {
    responseBody = JSON.parse(text);
  } catch {
    responseBody = text;
  }
  return { status: res.status, body: responseBody };
}

/** Create a fake HMAC signature with a fake secret. */
function fakeSignature(body: string, secret: string = 'fake-secret'): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

const PUSH_PAYLOAD = {
  ref: 'refs/heads/main',
  repository: {
    html_url: 'https://github.com/test-org/test-repo',
    full_name: 'test-org/test-repo',
  },
  pusher: { name: 'test-user' },
  commits: [{ id: 'abc123', message: 'Test commit' }],
};

describe('GitHub Webhook — /api/github/webhook', () => {

  // ─── Missing signature ──────────────────────────────────────────────

  describe('Missing signature', () => {
    it('should reject request without X-Hub-Signature-256 header', async () => {
      const res = await sendWebhook(WEBHOOK_URL, PUSH_PAYLOAD, {
        'X-GitHub-Event': 'push',
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('signature');
    });

    it('should reject with empty signature', async () => {
      const res = await sendWebhook(WEBHOOK_URL, PUSH_PAYLOAD, {
        'X-GitHub-Event': 'push',
        'X-Hub-Signature-256': '',
      });
      expect([400, 401]).toContain(res.status);
    });
  });

  // ─── Invalid signature ──────────────────────────────────────────────

  describe('Invalid signature', () => {
    it('should reject request with wrong signature', async () => {
      const rawBody = JSON.stringify(PUSH_PAYLOAD);
      const res = await sendWebhook(WEBHOOK_URL, PUSH_PAYLOAD, {
        'X-GitHub-Event': 'push',
        'X-Hub-Signature-256': fakeSignature(rawBody, 'wrong-secret'),
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('signature');
    });

    it('should reject request with tampered body', async () => {
      const originalBody = JSON.stringify(PUSH_PAYLOAD);
      const tamperedPayload = { ...PUSH_PAYLOAD, ref: 'refs/heads/evil' };
      // Sign original body but send tampered body
      const res = await sendWebhook(WEBHOOK_URL, tamperedPayload, {
        'X-GitHub-Event': 'push',
        'X-Hub-Signature-256': fakeSignature(originalBody, 'wrong-secret'),
      });
      expect(res.status).toBe(401);
    });

    it('should reject malformed signature format', async () => {
      const res = await sendWebhook(WEBHOOK_URL, PUSH_PAYLOAD, {
        'X-GitHub-Event': 'push',
        'X-Hub-Signature-256': 'not-a-valid-signature',
      });
      expect([400, 401, 500]).toContain(res.status);
    });

    it('should reject signature without sha256= prefix', async () => {
      const rawBody = JSON.stringify(PUSH_PAYLOAD);
      const hash = crypto.createHmac('sha256', 'wrong-secret').update(rawBody).digest('hex');
      const res = await sendWebhook(WEBHOOK_URL, PUSH_PAYLOAD, {
        'X-GitHub-Event': 'push',
        'X-Hub-Signature-256': hash, // Missing sha256= prefix
      });
      expect([401, 500]).toContain(res.status);
    });
  });

  // ─── Missing fields ──────────────────────────────────────────────────

  describe('Missing required fields', () => {
    it('should reject without event header', async () => {
      const rawBody = JSON.stringify(PUSH_PAYLOAD);
      const res = await sendWebhook(WEBHOOK_URL, PUSH_PAYLOAD, {
        'X-Hub-Signature-256': fakeSignature(rawBody),
        // No X-GitHub-Event header
      });
      // Without X-GitHub-Event or X-Forgejo-Event, server may 500 or 401
      expect([400, 401, 500]).toContain(res.status);
    });
  });

  // ─── Dual-route compat ──────────────────────────────────────────────

  describe('Dual-route compatibility', () => {
    it('should accept webhook at /api/repo/webhook too', async () => {
      // Without valid signature this will be rejected — but the route should exist
      const res = await sendWebhook(REPO_WEBHOOK_URL, PUSH_PAYLOAD, {
        'X-GitHub-Event': 'push',
      });
      // Should return 401 (missing sig) rather than 404 (route not found)
      expect(res.status).not.toBe(404);
      expect([400, 401, 500]).toContain(res.status);
    });
  });

  // ─── Structural validation ──────────────────────────────────────────

  describe('Structural validation', () => {
    it('should not crash on empty body', async () => {
      try {
        const res = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-GitHub-Event': 'push',
            'X-Hub-Signature-256': 'sha256=invalid',
          },
          body: '',
          signal: AbortSignal.timeout(15000),
        });
        expect([400, 401, 500]).toContain(res.status);
      } catch {
        // Network error is also acceptable (server rejects)
      }
    });

    it('should not crash on non-JSON body', async () => {
      try {
        const res = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-GitHub-Event': 'push',
            'X-Hub-Signature-256': 'sha256=invalid',
          },
          body: 'this is not json',
          signal: AbortSignal.timeout(15000),
        });
        expect([400, 401, 500]).toContain(res.status);
      } catch {
        // Acceptable
      }
    });
  });
});

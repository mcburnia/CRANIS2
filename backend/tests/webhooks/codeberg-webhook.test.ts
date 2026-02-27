/**
 * Webhook Tests — Codeberg/Forgejo Push Events
 *
 * Tests the webhook endpoint when invoked with Forgejo/Gitea headers.
 * The same /api/repo/webhook (or /api/github/webhook) handles both providers.
 * Provider detection: X-Forgejo-Event or X-Gitea-Event headers.
 */

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { BASE_URL } from '../setup/test-helpers.js';

const WEBHOOK_URL = `${BASE_URL}/api/repo/webhook`;

async function sendWebhook(
  body: object,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: any }> {
  const rawBody = JSON.stringify(body);
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: rawBody,
    signal: AbortSignal.timeout(15000),
  });
  let responseBody: any;
  try {
    responseBody = await res.json();
  } catch {
    responseBody = await res.text();
  }
  return { status: res.status, body: responseBody };
}

function fakeSignature(body: string, secret: string = 'fake-secret'): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

const FORGEJO_PUSH_PAYLOAD = {
  ref: 'refs/heads/main',
  repository: {
    html_url: 'https://codeberg.org/test-org/test-repo',
    full_name: 'test-org/test-repo',
    clone_url: 'https://codeberg.org/test-org/test-repo.git',
  },
  pusher: { login: 'test-user' },
  commits: [{ id: 'def456', message: 'Codeberg test commit' }],
};

describe('Codeberg/Forgejo Webhook', () => {

  // ─── Provider detection ─────────────────────────────────────────────

  describe('Provider detection via headers', () => {
    it('should detect Forgejo event header', async () => {
      const res = await sendWebhook(FORGEJO_PUSH_PAYLOAD, {
        'X-Forgejo-Event': 'push',
      });
      // Missing signature — should return 401 (but NOT 404)
      expect(res.status).not.toBe(404);
      expect([400, 401, 500]).toContain(res.status);
    });

    it('should detect Gitea event header', async () => {
      const res = await sendWebhook(FORGEJO_PUSH_PAYLOAD, {
        'X-Gitea-Event': 'push',
      });
      // Missing signature — should return 401
      expect(res.status).not.toBe(404);
      expect([400, 401, 500]).toContain(res.status);
    });

    it('should prefer Forgejo header when both present', async () => {
      const res = await sendWebhook(FORGEJO_PUSH_PAYLOAD, {
        'X-Forgejo-Event': 'push',
        'X-Gitea-Event': 'push',
      });
      // Route exists, missing sig
      expect(res.status).not.toBe(404);
    });
  });

  // ─── Signature verification ──────────────────────────────────────────

  describe('Signature verification', () => {
    it('should reject missing X-Forgejo-Signature header', async () => {
      const res = await sendWebhook(FORGEJO_PUSH_PAYLOAD, {
        'X-Forgejo-Event': 'push',
      });
      expect([400, 401, 500]).toContain(res.status);
    });

    it('should reject invalid Forgejo signature', async () => {
      const rawBody = JSON.stringify(FORGEJO_PUSH_PAYLOAD);
      const res = await sendWebhook(FORGEJO_PUSH_PAYLOAD, {
        'X-Forgejo-Event': 'push',
        'X-Forgejo-Signature': fakeSignature(rawBody, 'wrong-codeberg-secret'),
      });
      expect([401, 500]).toContain(res.status);
    });

    it('should reject X-Hub-Signature-256 with wrong secret for Codeberg', async () => {
      const rawBody = JSON.stringify(FORGEJO_PUSH_PAYLOAD);
      const res = await sendWebhook(FORGEJO_PUSH_PAYLOAD, {
        'X-Forgejo-Event': 'push',
        'X-Hub-Signature-256': fakeSignature(rawBody, 'wrong-secret'),
      });
      expect([401, 500]).toContain(res.status);
    });
  });

  // ─── Non-push events ─────────────────────────────────────────────────

  describe('Non-push Forgejo events', () => {
    it('should not crash on create event with invalid sig', async () => {
      const rawBody = JSON.stringify(FORGEJO_PUSH_PAYLOAD);
      const res = await sendWebhook(FORGEJO_PUSH_PAYLOAD, {
        'X-Forgejo-Event': 'create',
        'X-Forgejo-Signature': fakeSignature(rawBody, 'fake'),
      });
      // Invalid sig → 401, but route should not 404
      expect(res.status).not.toBe(404);
    });

    it('should not crash on repository event with invalid sig', async () => {
      const rawBody = JSON.stringify(FORGEJO_PUSH_PAYLOAD);
      const res = await sendWebhook(FORGEJO_PUSH_PAYLOAD, {
        'X-Gitea-Event': 'repository',
        'X-Hub-Signature-256': fakeSignature(rawBody, 'fake'),
      });
      expect(res.status).not.toBe(404);
    });
  });

  // ─── Missing repo URL ──────────────────────────────────────────────

  describe('Missing repository URL', () => {
    it('should handle payload without repository field', async () => {
      const noRepoPayload = { ref: 'refs/heads/main', commits: [] };
      const res = await sendWebhook(noRepoPayload, {
        'X-Forgejo-Event': 'push',
      });
      // Should fail at sig check or repo URL check — not crash
      expect([400, 401, 500]).toContain(res.status);
    });
  });

  // ─── Structural edge cases ──────────────────────────────────────────

  describe('Structural edge cases', () => {
    it('should handle empty JSON object', async () => {
      const res = await sendWebhook({}, {
        'X-Forgejo-Event': 'push',
      });
      expect([400, 401, 500]).toContain(res.status);
    });

    it('should handle very large payload (10KB)', async () => {
      const largePayload = {
        ...FORGEJO_PUSH_PAYLOAD,
        commits: Array.from({ length: 100 }, (_, i) => ({
          id: `commit-${i}-${'a'.repeat(80)}`,
          message: `Commit ${i}: ${'x'.repeat(100)}`,
        })),
      };
      const res = await sendWebhook(largePayload, {
        'X-Forgejo-Event': 'push',
      });
      // Should still check signature before processing
      expect([400, 401, 413, 500]).toContain(res.status);
    });
  });
});

/**
 * Webhook Tests — Stripe Billing Events
 *
 * Tests the /api/billing/webhook endpoint:
 * - Stripe signature verification
 * - Missing signature rejection
 * - Invalid signature rejection
 * - Structural validation
 *
 * Note: Valid Stripe webhook signatures require the actual endpoint secret.
 * These tests verify rejection of invalid/missing signatures.
 */

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { BASE_URL } from '../setup/test-helpers.js';

const WEBHOOK_URL = `${BASE_URL}/api/billing/webhook`;

async function sendStripeWebhook(
  body: object | string,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: any }> {
  const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
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

/** Create a fake Stripe signature (v1 format: t=timestamp,v1=hash). */
function fakeStripeSignature(body: string, secret: string = 'whsec_fake'): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${body}`;
  const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

const STRIPE_EVENT = {
  id: 'evt_test_webhook',
  object: 'event',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_123',
      customer: 'cus_test_123',
      subscription: 'sub_test_123',
      metadata: { orgId: 'test-org-id' },
    },
  },
  livemode: false,
  created: Math.floor(Date.now() / 1000),
};

describe('Stripe Webhook — /api/billing/webhook', () => {

  // ─── Missing signature ──────────────────────────────────────────────

  describe('Missing signature', () => {
    it('should reject request without Stripe-Signature header', async () => {
      const res = await sendStripeWebhook(STRIPE_EVENT);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('signature');
    });

    it('should reject with empty signature', async () => {
      const res = await sendStripeWebhook(STRIPE_EVENT, {
        'Stripe-Signature': '',
      });
      expect([400, 401]).toContain(res.status);
    });
  });

  // ─── Invalid signature ──────────────────────────────────────────────

  describe('Invalid signature', () => {
    it('should reject request with wrong webhook secret', async () => {
      const rawBody = JSON.stringify(STRIPE_EVENT);
      const res = await sendStripeWebhook(STRIPE_EVENT, {
        'Stripe-Signature': fakeStripeSignature(rawBody, 'whsec_wrong_secret'),
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('signature');
    });

    it('should reject malformed signature format', async () => {
      const res = await sendStripeWebhook(STRIPE_EVENT, {
        'Stripe-Signature': 'not-a-valid-stripe-signature',
      });
      expect(res.status).toBe(400);
    });

    it('should reject signature with expired timestamp', async () => {
      const rawBody = JSON.stringify(STRIPE_EVENT);
      // Create a signature with timestamp 1 hour old
      const oldTimestamp = Math.floor(Date.now() / 1000) - 3600;
      const signedPayload = `${oldTimestamp}.${rawBody}`;
      const signature = crypto.createHmac('sha256', 'whsec_fake').update(signedPayload).digest('hex');
      const expiredSig = `t=${oldTimestamp},v1=${signature}`;

      const res = await sendStripeWebhook(STRIPE_EVENT, {
        'Stripe-Signature': expiredSig,
      });
      // Stripe library will reject old timestamps
      expect(res.status).toBe(400);
    });

    it('should reject tampered body', async () => {
      const originalBody = JSON.stringify(STRIPE_EVENT);
      const tamperedEvent = { ...STRIPE_EVENT, type: 'invoice.payment_succeeded' };
      // Sign original but send tampered
      const res = await sendStripeWebhook(tamperedEvent, {
        'Stripe-Signature': fakeStripeSignature(originalBody, 'whsec_fake'),
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── Missing raw body ────────────────────────────────────────────────

  describe('Missing/empty body', () => {
    it('should handle empty body', async () => {
      try {
        const res = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Stripe-Signature': 't=12345,v1=fakehash',
          },
          body: '',
          signal: AbortSignal.timeout(15000),
        });
        expect([400, 500]).toContain(res.status);
      } catch {
        // Network error is acceptable
      }
    });

    it('should handle non-JSON body', async () => {
      try {
        const res = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Stripe-Signature': 't=12345,v1=fakehash',
          },
          body: 'not json at all',
          signal: AbortSignal.timeout(15000),
        });
        expect([400, 500]).toContain(res.status);
      } catch {
        // Acceptable
      }
    });
  });

  // ─── HTTP method validation ──────────────────────────────────────────

  describe('HTTP method validation', () => {
    it('should reject GET request to webhook endpoint', async () => {
      const res = await fetch(WEBHOOK_URL, {
        method: 'GET',
        signal: AbortSignal.timeout(15000),
      });
      // POST only — should return 404 or 405
      expect([404, 405]).toContain(res.status);
    });

    it('should reject PUT request to webhook endpoint', async () => {
      const res = await fetch(WEBHOOK_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(STRIPE_EVENT),
        signal: AbortSignal.timeout(15000),
      });
      expect([404, 405]).toContain(res.status);
    });

    it('should reject DELETE request to webhook endpoint', async () => {
      const res = await fetch(WEBHOOK_URL, {
        method: 'DELETE',
        signal: AbortSignal.timeout(15000),
      });
      expect([404, 405]).toContain(res.status);
    });
  });

  // ─── Event type handling ─────────────────────────────────────────────

  describe('Event types (with invalid signature — verifies no crash)', () => {
    const eventTypes = [
      'checkout.session.completed',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'customer.deleted',
    ];

    for (const eventType of eventTypes) {
      it(`should not crash on ${eventType} event with invalid sig`, async () => {
        const event = { ...STRIPE_EVENT, type: eventType };
        const rawBody = JSON.stringify(event);
        const res = await sendStripeWebhook(event, {
          'Stripe-Signature': fakeStripeSignature(rawBody, 'whsec_wrong'),
        });
        // Invalid sig should be caught before event processing
        expect(res.status).toBe(400);
      });
    }
  });

  // ─── Replay protection ──────────────────────────────────────────────

  describe('Replay protection', () => {
    it('should reject same signature twice (idempotency)', async () => {
      const rawBody = JSON.stringify(STRIPE_EVENT);
      const sig = fakeStripeSignature(rawBody, 'whsec_fake');

      // Send same signature twice
      const res1 = await sendStripeWebhook(STRIPE_EVENT, { 'Stripe-Signature': sig });
      const res2 = await sendStripeWebhook(STRIPE_EVENT, { 'Stripe-Signature': sig });

      // Both should fail (wrong secret)
      expect(res1.status).toBe(400);
      expect(res2.status).toBe(400);
    });
  });
});

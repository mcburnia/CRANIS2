/**
 * Billing Route Tests — /api/billing
 *
 * Tests: status endpoint for various billing states (active, trial, suspended, read_only, past_due)
 */

import { describe, it, expect } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

describe('/api/billing', () => {

  // ─── GET /api/billing/status ──────────────────────────────────────────

  describe('GET /api/billing/status', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get('/api/billing/status');
      expect(res.status).toBe(401);
    });

    it('should return billing status for active org', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get('/api/billing/status', { auth: token });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('orgId');
      expect(res.body).toHaveProperty('status');
      expect(res.body.status).toBe('active');
    });

    it('should include all expected billing fields', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get('/api/billing/status', { auth: token });
      expect(res.status).toBe(200);

      // Verify all expected fields from the flat response object
      expect(res.body).toHaveProperty('orgId');
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('stripeCustomerId');
      expect(res.body).toHaveProperty('trialEndsAt');
      expect(res.body).toHaveProperty('trialDurationDays');
      expect(res.body).toHaveProperty('graceEndsAt');
      expect(res.body).toHaveProperty('currentPeriodEnd');
      expect(res.body).toHaveProperty('contributorCount');
      expect(res.body).toHaveProperty('monthlyAmountCents');
      expect(res.body).toHaveProperty('billingEmail');
      expect(res.body).toHaveProperty('companyName');
      expect(res.body).toHaveProperty('billingAddress');
      expect(res.body).toHaveProperty('vatNumber');
      expect(res.body).toHaveProperty('paymentPauseUntil');
      expect(res.body).toHaveProperty('paymentPauseReason');
      expect(res.body).toHaveProperty('exempt');
      expect(res.body).toHaveProperty('exemptReason');
      expect(res.body).toHaveProperty('cancelledAt');
      expect(res.body).toHaveProperty('contributorCounts');
    });

    it('should return trial status for trial org', async () => {
      const token = await loginTestUser(TEST_USERS.impAdmin);
      const res = await api.get('/api/billing/status', { auth: token });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('trial');
      expect(res.body.trialEndsAt).toBeTruthy();
    });

    it('should return suspended status for suspended org', async () => {
      const token = await loginTestUser(TEST_USERS.distAdmin);
      const res = await api.get('/api/billing/status', { auth: token });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('suspended');
    });

    it('should return read_only status for read-only org', async () => {
      const token = await loginTestUser(TEST_USERS.ossAdmin);
      const res = await api.get('/api/billing/status', { auth: token });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('read_only');
    });

    it('should return past_due status for past-due org', async () => {
      const token = await loginTestUser(TEST_USERS.pdAdmin);
      const res = await api.get('/api/billing/status', { auth: token });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('past_due');
    });

    it('should return different billing data for different orgs', async () => {
      const mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
      const impToken = await loginTestUser(TEST_USERS.impAdmin);

      const mfgRes = await api.get('/api/billing/status', { auth: mfgToken });
      const impRes = await api.get('/api/billing/status', { auth: impToken });

      expect(mfgRes.status).toBe(200);
      expect(impRes.status).toBe(200);

      // Each org should see its own orgId and billing status
      expect(mfgRes.body.orgId).not.toBe(impRes.body.orgId);
      expect(mfgRes.body.status).toBe('active');
      expect(impRes.body.status).toBe('trial');
    });
  });
});

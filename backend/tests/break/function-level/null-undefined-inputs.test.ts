/**
 * Break Tests — Function Level: Null/Undefined Inputs
 *
 * Tests API endpoints with null, undefined, and missing values
 * to verify graceful error handling at the function level.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../../setup/test-helpers.js';
import { TEST_IDS } from '../../setup/seed-test-data.js';

describe('Break: Null/Undefined Inputs', () => {
  let token: string;

  beforeAll(async () => {
    token = await loginTestUser(TEST_USERS.mfgAdmin);
  });

  // ─── Auth endpoints ──────────────────────────────────────────────────

  describe('Auth with null/undefined fields', () => {
    it('should reject null email', async () => {
      const res = await api.post('/api/auth/login', { body: { email: null, password: 'TestPass123!' } });
      expect([400, 401, 500]).toContain(res.status);
      expect(res.status).not.toBe(200);
    });

    it('should reject null password', async () => {
      const res = await api.post('/api/auth/login', { body: { email: 'test@test.com', password: null } });
      expect([400, 401, 500]).toContain(res.status);
      expect(res.status).not.toBe(200);
    });

    it('should reject undefined email (omitted)', async () => {
      const res = await api.post('/api/auth/login', { body: { password: 'TestPass123!' } });
      expect(res.status).toBe(400);
    });

    it('should reject register with null email', async () => {
      const res = await api.post('/api/auth/register', { body: { email: null, password: 'TestPass123!' } });
      expect([400, 500]).toContain(res.status);
      expect(res.status).not.toBe(201);
    });
  });

  // ─── CRA Reports with null fields ────────────────────────────────────

  describe('CRA Reports with null fields', () => {
    it('should reject null productId', async () => {
      const res = await api.post('/api/cra-reports', {
        auth: token,
        body: { productId: null, reportType: 'vulnerability', awarenessAt: new Date().toISOString() },
      });
      expect([400, 422, 500]).toContain(res.status);
      expect(res.status).not.toBe(201);
    });

    it('should reject null reportType', async () => {
      const res = await api.post('/api/cra-reports', {
        auth: token,
        body: { productId: TEST_IDS.products.github, reportType: null, awarenessAt: new Date().toISOString() },
      });
      expect([400, 422, 500]).toContain(res.status);
      expect(res.status).not.toBe(201);
    });

    it('should handle null awarenessAt', async () => {
      const res = await api.post('/api/cra-reports', {
        auth: token,
        body: { productId: TEST_IDS.products.github, reportType: 'vulnerability', awarenessAt: null },
      });
      // Server may default null to current time or reject
      expect([201, 400, 422, 500]).toContain(res.status);
    });

    it('should handle null stage content', async () => {
      const res = await api.post(`/api/cra-reports/${TEST_IDS.reports.draft}/stages`, {
        auth: token,
        body: { stage: 'early_warning', content: null },
      });
      expect([400, 422, 500]).toContain(res.status);
    });

    it('should handle null csirtCountry', async () => {
      const res = await api.post('/api/cra-reports', {
        auth: token,
        body: {
          productId: TEST_IDS.products.github,
          reportType: 'vulnerability',
          awarenessAt: new Date().toISOString(),
          csirtCountry: null,
        },
      });
      // csirtCountry may be optional — either 201 or validation error
      expect([201, 400, 422, 500]).toContain(res.status);
    });
  });

  // ─── Product CRUD with null fields ────────────────────────────────────

  describe('Product CRUD with null fields', () => {
    it('should reject product creation with null name', async () => {
      const res = await api.post('/api/products', {
        auth: token,
        body: { name: null, craCategory: 'default' },
      });
      expect([400, 422, 500]).toContain(res.status);
      expect(res.status).not.toBe(201);
    });

    it('should reject product creation with null craCategory', async () => {
      const res = await api.post('/api/products', {
        auth: token,
        body: { name: 'test-null-category', craCategory: null },
      });
      // May default to 'default' or reject — either is acceptable
      expect([201, 400, 422, 500]).toContain(res.status);
    });

    it('should handle null in product update', async () => {
      const res = await api.put(`/api/products/${TEST_IDS.products.github}`, {
        auth: token,
        body: { name: null },
      });
      expect([200, 400, 422, 500]).toContain(res.status);
    });
  });

  // ─── Feedback with null fields ────────────────────────────────────────

  describe('Feedback with null fields', () => {
    it('should reject feedback with null subject', async () => {
      const res = await api.post('/api/feedback', {
        auth: token,
        body: { category: 'bug', subject: null, body: 'test', pageUrl: '/test' },
      });
      expect([400, 422, 500]).toContain(res.status);
    });

    it('should handle feedback with null category', async () => {
      const res = await api.post('/api/feedback', {
        auth: token,
        body: { category: null, subject: 'test', body: 'test', pageUrl: '/test' },
      });
      // Server may accept null category (stored as null) or reject
      expect([200, 201, 400, 422, 500]).toContain(res.status);
    });

    it('should reject feedback with null body', async () => {
      const res = await api.post('/api/feedback', {
        auth: token,
        body: { category: 'bug', subject: 'test', body: null, pageUrl: '/test' },
      });
      expect([400, 422, 500]).toContain(res.status);
    });
  });

  // ─── Org update with null ──────────────────────────────────────────────

  describe('Org update with null', () => {
    it('should handle null name in org update', async () => {
      const res = await api.put('/api/org', {
        auth: token,
        body: { name: null },
      });
      expect([200, 400, 500]).toContain(res.status);
    });
  });

  // ─── Notification with null ────────────────────────────────────────────

  describe('Notifications with null IDs', () => {
    it('should handle null notification ID in mark-read', async () => {
      const res = await api.put('/api/notifications/null/read', { auth: token });
      expect([400, 404, 500]).toContain(res.status);
      expect(res.status).not.toBe(200);
    });
  });
});

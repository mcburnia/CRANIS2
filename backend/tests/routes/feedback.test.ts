/**
 * Feedback Route Tests — /api/feedback
 *
 * Tests: submit feedback with valid/invalid categories, missing fields
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

describe('/api/feedback', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginTestUser(TEST_USERS.mfgAdmin);
  });

  describe('POST /api/feedback', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.post('/api/feedback', {
        body: {
          category: 'bug',
          subject: 'Test bug report',
          body: 'This is a test bug report.',
          pageUrl: '/dashboard',
        },
      });
      expect(res.status).toBe(401);
    });

    it('should create feedback with valid category bug', async () => {
      const res = await api.post('/api/feedback', {
        auth: adminToken,
        body: {
          category: 'bug',
          subject: 'Test bug from route tests',
          body: 'Automated test — verifying feedback submission works.',
          pageUrl: '/dashboard',
        },
      });
      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('createdAt');
    });

    it('should reject invalid category', async () => {
      const res = await api.post('/api/feedback', {
        auth: adminToken,
        body: {
          category: 'general',
          subject: 'Invalid category test',
          body: 'This should be rejected.',
          pageUrl: '/settings',
        },
      });
      expect(res.status).toBe(400);
    });

    it('should reject missing subject', async () => {
      const res = await api.post('/api/feedback', {
        auth: adminToken,
        body: {
          category: 'feature',
          body: 'Missing subject field.',
          pageUrl: '/products',
        },
      });
      expect(res.status).toBe(400);
    });
  });
});

/**
 * Marketplace Route Tests — /api/marketplace
 *
 * Tests: marketplace profile retrieval and expected shape
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

describe('/api/marketplace', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginTestUser(TEST_USERS.mfgAdmin);
  });

  describe('GET /api/marketplace/profile', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get('/api/marketplace/profile');
      expect(res.status).toBe(401);
    });

    it('should return marketplace profile for org', async () => {
      const res = await api.get('/api/marketplace/profile', { auth: adminToken });
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });

    it('should have expected profile fields', async () => {
      const res = await api.get('/api/marketplace/profile', { auth: adminToken });
      expect(res.status).toBe(200);

      expect(res.body).toHaveProperty('listed');
      expect(res.body).toHaveProperty('tagline');
      expect(res.body).toHaveProperty('description');
      expect(res.body).toHaveProperty('logoUrl');
      expect(res.body).toHaveProperty('categories');
      expect(res.body).toHaveProperty('featuredProductIds');
      expect(res.body).toHaveProperty('complianceBadges');
      expect(res.body).toHaveProperty('products');
    });
  });
});

/**
 * Dashboard Route Tests — /api/dashboard
 */

import { describe, it, expect } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

describe('/api/dashboard', () => {
  describe('GET /api/dashboard/summary', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get('/api/dashboard/summary');
      expect(res.status).toBe(401);
    });

    it('should return dashboard summary for active org', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get('/api/dashboard/summary', { auth: token });
      expect(res.status).toBe(200);
      // Should have product count, dependency count, etc.
      expect(res.body).toHaveProperty('products');
    });

    it('should return empty/zero stats for empty org', async () => {
      const token = await loginTestUser(TEST_USERS.emptyAdmin);
      const res = await api.get('/api/dashboard/summary', { auth: token });
      expect(res.status).toBe(200);
    });
  });
});

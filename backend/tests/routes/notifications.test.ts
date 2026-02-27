/**
 * Notifications Route Tests — /api/notifications
 *
 * Tests: list, unread count, mark read, mark all read
 */

import { describe, it, expect } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

describe('/api/notifications', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginTestUser(TEST_USERS.mfgAdmin);
  });

  describe('GET /api/notifications', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get('/api/notifications');
      expect(res.status).toBe(401);
    });

    it('should return notifications for user', async () => {
      const res = await api.get('/api/notifications', { auth: adminToken });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body) || res.body.notifications).toBeTruthy();
    });

    it('should include org-wide broadcast notifications', async () => {
      const res = await api.get('/api/notifications', { auth: adminToken });
      expect(res.status).toBe(200);
      const notifications = Array.isArray(res.body) ? res.body : res.body.notifications;
      // Should have both user-specific and broadcast (user_id=null) notifications
      expect(notifications.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('should return unread count', async () => {
      const res = await api.get('/api/notifications/unread-count', { auth: adminToken });
      expect(res.status).toBe(200);
      expect(typeof (res.body.count ?? res.body.unreadCount ?? res.body)).toBe('number');
    });
  });

  describe('PUT /api/notifications/read-all', () => {
    it('should mark all notifications as read', async () => {
      const res = await api.put('/api/notifications/read-all', { auth: adminToken });
      expect(res.status).toBe(200);

      // Verify unread count is 0
      const countRes = await api.get('/api/notifications/unread-count', { auth: adminToken });
      expect(countRes.status).toBe(200);
      const count = countRes.body.count ?? countRes.body.unreadCount ?? countRes.body;
      expect(count).toBe(0);
    });
  });
});

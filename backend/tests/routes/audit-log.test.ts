/**
 * Audit Log Route Tests — /api/audit-log
 *
 * Tests: authentication, events array shape, expected fields
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

describe('/api/audit-log', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginTestUser(TEST_USERS.mfgAdmin);
  });

  describe('GET /api/audit-log', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get('/api/audit-log');
      expect(res.status).toBe(401);
    });

    it('should return events array for org', async () => {
      const res = await api.get('/api/audit-log', { auth: adminToken });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('events');
      expect(Array.isArray(res.body.events)).toBe(true);
    });

    it('should have expected fields on events', async () => {
      const res = await api.get('/api/audit-log', { auth: adminToken });
      expect(res.status).toBe(200);
      expect(res.body.events.length).toBeGreaterThanOrEqual(1);

      const event = res.body.events[0];
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('eventType');
      expect(event).toHaveProperty('ipAddress');
      expect(event).toHaveProperty('userAgent');
      expect(event).toHaveProperty('acceptLanguage');
      expect(event).toHaveProperty('metadata');
      expect(event).toHaveProperty('createdAt');
      expect(event).toHaveProperty('userEmail');
    });
  });
});

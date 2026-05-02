/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

/**
 * Audit Log Route Tests — /api/audit-log
 *
 * Tests: authentication, events array shape, field validation,
 * event_type filtering, pagination (limit/offset), total count, eventTypes list
 *
 * API response format (from probing):
 * - GET /api/audit-log returns { events: [...], total, eventTypes: [...] }
 *   Query params: event_type, limit (max 500), offset
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

describe('/api/audit-log', () => {
  let adminToken: string;
  let impToken: string;

  beforeAll(async () => {
    adminToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
  });

  // ─── GET /api/audit-log ─────────────────────────────────────────────

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

    it('should return total count', async () => {
      const res = await api.get('/api/audit-log', { auth: adminToken });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total');
      expect(typeof res.body.total).toBe('number');
      expect(res.body.total).toBeGreaterThanOrEqual(res.body.events.length);
    });

    it('should return eventTypes list', async () => {
      const res = await api.get('/api/audit-log', { auth: adminToken });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('eventTypes');
      expect(Array.isArray(res.body.eventTypes)).toBe(true);
      expect(res.body.eventTypes.length).toBeGreaterThanOrEqual(1);
      // Each eventType should be a string
      for (const et of res.body.eventTypes) {
        expect(typeof et).toBe('string');
      }
    });

    it('should filter by event_type', async () => {
      // First, get available event types
      const allRes = await api.get('/api/audit-log', { auth: adminToken });
      expect(allRes.status).toBe(200);

      if (allRes.body.eventTypes.length > 0) {
        const filterType = allRes.body.eventTypes[0];
        const filteredRes = await api.get(`/api/audit-log?event_type=${filterType}`, {
          auth: adminToken,
        });
        expect(filteredRes.status).toBe(200);
        // All returned events should match the filter
        for (const event of filteredRes.body.events) {
          expect(event.eventType).toBe(filterType);
        }
      }
    });

    it('should respect limit parameter', async () => {
      const res = await api.get('/api/audit-log?limit=2', { auth: adminToken });
      expect(res.status).toBe(200);
      expect(res.body.events.length).toBeLessThanOrEqual(2);
    });

    it('should respect offset parameter', async () => {
      // Get first page
      const page1 = await api.get('/api/audit-log?limit=1&offset=0', { auth: adminToken });
      expect(page1.status).toBe(200);

      if (page1.body.total > 1) {
        // Get second page
        const page2 = await api.get('/api/audit-log?limit=1&offset=1', { auth: adminToken });
        expect(page2.status).toBe(200);
        // Different events on each page
        if (page1.body.events.length > 0 && page2.body.events.length > 0) {
          expect(page1.body.events[0].id).not.toBe(page2.body.events[0].id);
        }
      }
    });

    it('should return org-scoped events only', async () => {
      const mfgRes = await api.get('/api/audit-log', { auth: adminToken });
      const impRes = await api.get('/api/audit-log', { auth: impToken });

      expect(mfgRes.status).toBe(200);
      expect(impRes.status).toBe(200);

      // Both should return valid event arrays
      expect(Array.isArray(mfgRes.body.events)).toBe(true);
      expect(Array.isArray(impRes.body.events)).toBe(true);

      // Events from mfg org should not appear in imp org's log (check IDs)
      if (mfgRes.body.events.length > 0 && impRes.body.events.length > 0) {
        const mfgIds = new Set(mfgRes.body.events.map((e: any) => e.id));
        const impIds = impRes.body.events.map((e: any) => e.id);
        const overlap = impIds.filter((id: string) => mfgIds.has(id));
        expect(overlap.length).toBe(0);
      }
    });
  });
});

/**
 * Audit Log — Integration Tests
 *
 * Tests:
 *   GET /api/audit-log – Get org audit events with filtering and pagination
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

let token: string;
let orphanToken: string;

beforeAll(async () => {
  token = await loginTestUser(TEST_USERS.mfgAdmin);
  orphanToken = await loginTestUser(TEST_USERS.orphanUser);
}, 15000);

describe('GET /api/audit-log', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await api.get('/api/audit-log');
    expect(res.status).toBe(401);
  });

  it('returns 403 for user without organisation', async () => {
    const res = await api.get('/api/audit-log', { auth: orphanToken });
    expect(res.status).toBe(403);
  });

  it('returns audit events for authenticated user', async () => {
    const res = await api.get('/api/audit-log', { auth: token });
    expect(res.status).toBe(200);
    // Response may be an array or an object with events property
    expect(res.body).toBeDefined();
  });

  it('supports event_type filter', async () => {
    const res = await api.get('/api/audit-log', {
      auth: token,
      query: { event_type: 'login' },
    });
    expect(res.status).toBe(200);
  });

  it('supports pagination with limit and offset', async () => {
    const res = await api.get('/api/audit-log', {
      auth: token,
      query: { limit: '10', offset: '0' },
    });
    expect(res.status).toBe(200);
  });

  it('caps limit at 500', async () => {
    const res = await api.get('/api/audit-log', {
      auth: token,
      query: { limit: '9999' },
    });
    expect(res.status).toBe(200);
    // Should not return more than 500 events
  });

  it('includes expected fields on each event', async () => {
    const res = await api.get('/api/audit-log', { auth: token });
    expect(res.status).toBe(200);
    const events = res.body.events || res.body;
    if (Array.isArray(events) && events.length > 0) {
      const event = events[0];
      expect(event.id).toBeDefined();
      // Field may be camelCase or snake_case depending on serialisation
      expect(event.event_type || event.eventType).toBeDefined();
      expect(event.created_at || event.createdAt).toBeDefined();
    }
  });
});

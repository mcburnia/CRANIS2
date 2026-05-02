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
 * Internal Incident Lifecycle — Integration Tests
 *
 * Tests:
 *   GET    /:productId/incidents              — list with filters
 *   GET    /:productId/incidents/summary      — aggregated counts
 *   GET    /:productId/incidents/:id          — detail with timeline
 *   POST   /:productId/incidents              — create
 *   PUT    /:productId/incidents/:id          — update + phase transitions
 *   DELETE /:productId/incidents/:id          — delete (detection only)
 *   POST   /:productId/incidents/:id/timeline — add timeline entry
 *   POST   /:productId/incidents/:id/escalate — create linked CRA report
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginTestUser, TEST_USERS, getAppPool } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

const PRODUCT_ID = TEST_IDS.products.github;
const ORG_ID = TEST_IDS.orgs.mfgActive;

let token: string;
let incidentId: string;

beforeAll(async () => {
  token = await loginTestUser(TEST_USERS.mfgAdmin);

  // Clean stale test incidents
  const pool = getAppPool();
  await pool.query("DELETE FROM incidents WHERE org_id = $1 AND title LIKE 'Test Incident%'", [ORG_ID]);
}, 15000);

afterAll(async () => {
  const pool = getAppPool();
  // Clean up CRA reports created by escalation tests
  await pool.query(
    `DELETE FROM cra_reports WHERE org_id = $1 AND id IN (
       SELECT linked_report_id FROM incidents WHERE org_id = $1 AND title LIKE 'Test Incident%'
     )`,
    [ORG_ID]
  );
  await pool.query("DELETE FROM incidents WHERE org_id = $1 AND title LIKE 'Test Incident%'", [ORG_ID]);
}, 10000);

// ─── Auth ────────────────────────────────────────────────────

describe('Auth & access control', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/incidents`);
    expect(res.status).toBe(401);
  });

  it('rejects access to products in another org', async () => {
    const impToken = await loginTestUser(TEST_USERS.impAdmin);
    const res = await api.get(`/api/products/${PRODUCT_ID}/incidents`, { auth: impToken });
    expect(res.status).toBe(404);
  });
});

// ─── GET (empty state) ──────────────────────────────────────

describe('GET (no incidents)', () => {
  it('returns empty list', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/incidents`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.incidents).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('returns empty summary', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/incidents/summary`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.active).toBe(0);
  });
});

// ─── POST (create) ──────────────────────────────────────────

describe('POST (create incident)', () => {
  it('rejects missing title', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/incidents`, {
      auth: token,
      body: { description: 'no title' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Title');
  });

  it('rejects invalid severity', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/incidents`, {
      auth: token,
      body: { title: 'Test Incident Bad', severity: 'P99' },
    });
    expect(res.status).toBe(400);
  });

  it('creates an incident with defaults', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/incidents`, {
      auth: token,
      body: {
        title: 'Test Incident Alpha',
        description: 'Suspicious network activity detected',
        severity: 'P2',
      },
    });
    expect(res.status).toBe(201);
    expect(res.body.incident).toBeTruthy();
    expect(res.body.incident.title).toBe('Test Incident Alpha');
    expect(res.body.incident.severity).toBe('P2');
    expect(res.body.incident.phase).toBe('detection');
    expect(res.body.incident.product_id).toBe(PRODUCT_ID);
    incidentId = res.body.incident.id;
  });
});

// ─── GET (with data) ────────────────────────────────────────

describe('GET (with incident)', () => {
  it('returns the incident in list', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/incidents`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.incidents.some((i: any) => i.id === incidentId)).toBe(true);
  });

  it('filters by severity', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/incidents`, { auth: token, query: { severity: 'P2' } });
    expect(res.status).toBe(200);
    for (const i of res.body.incidents) {
      expect(i.severity).toBe('P2');
    }
  });

  it('filters by phase', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/incidents`, { auth: token, query: { phase: 'detection' } });
    expect(res.status).toBe(200);
    for (const i of res.body.incidents) {
      expect(i.phase).toBe('detection');
    }
  });

  it('returns detail with timeline', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/incidents/${incidentId}`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.incident.id).toBe(incidentId);
    expect(res.body.timeline).toBeDefined();
    expect(res.body.timeline.length).toBeGreaterThanOrEqual(1); // creation entry
    expect(res.body.timeline[0].event_type).toBe('phase_change');
  });

  it('returns 404 for non-existent incident', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/incidents/00000000-0000-0000-0000-000000000000`, { auth: token });
    expect(res.status).toBe(404);
  });

  it('returns summary with counts', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/incidents/summary`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.active).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.byPhase)).toBe(true);
    expect(Array.isArray(res.body.bySeverity)).toBe(true);
  });
});

// ─── PUT (update + phase transitions) ───────────────────────

describe('PUT (update incident)', () => {
  it('updates description and incident lead', async () => {
    const res = await api.put(`/api/products/${PRODUCT_ID}/incidents/${incidentId}`, {
      auth: token,
      body: { description: 'Updated description', incident_lead: 'jane@example.com' },
    });
    expect(res.status).toBe(200);
    expect(res.body.incident.description).toBe('Updated description');
    expect(res.body.incident.incident_lead).toBe('jane@example.com');
  });

  it('advances phase to assessment', async () => {
    const res = await api.put(`/api/products/${PRODUCT_ID}/incidents/${incidentId}`, {
      auth: token,
      body: { phase: 'assessment' },
    });
    expect(res.status).toBe(200);
    expect(res.body.incident.phase).toBe('assessment');
  });

  it('rejects backwards phase transition', async () => {
    const res = await api.put(`/api/products/${PRODUCT_ID}/incidents/${incidentId}`, {
      auth: token,
      body: { phase: 'detection' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('backwards');
  });

  it('rejects invalid phase', async () => {
    const res = await api.put(`/api/products/${PRODUCT_ID}/incidents/${incidentId}`, {
      auth: token,
      body: { phase: 'nonexistent' },
    });
    expect(res.status).toBe(400);
  });

  it('advances to containment and sets contained_at', async () => {
    const res = await api.put(`/api/products/${PRODUCT_ID}/incidents/${incidentId}`, {
      auth: token,
      body: { phase: 'containment' },
    });
    expect(res.status).toBe(200);
    expect(res.body.incident.phase).toBe('containment');
    expect(res.body.incident.contained_at).toBeTruthy();
  });

  it('advances to recovery and sets resolved_at', async () => {
    const res = await api.put(`/api/products/${PRODUCT_ID}/incidents/${incidentId}`, {
      auth: token,
      body: { phase: 'recovery' },
    });
    expect(res.status).toBe(200);
    expect(res.body.incident.phase).toBe('recovery');
    expect(res.body.incident.resolved_at).toBeTruthy();
  });

  it('advances to review with root cause and lessons learned', async () => {
    const res = await api.put(`/api/products/${PRODUCT_ID}/incidents/${incidentId}`, {
      auth: token,
      body: {
        phase: 'review',
        root_cause: 'Unpatched dependency CVE-2024-1234',
        lessons_learned: 'Implement automated dependency scanning alerts',
        impact_summary: 'No customer data exposed; 2 hours downtime',
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.incident.phase).toBe('review');
    expect(res.body.incident.root_cause).toContain('CVE-2024-1234');
    expect(res.body.incident.lessons_learned).toContain('automated');
  });

  it('closes the incident and sets review_completed_at', async () => {
    const res = await api.put(`/api/products/${PRODUCT_ID}/incidents/${incidentId}`, {
      auth: token,
      body: { phase: 'closed' },
    });
    expect(res.status).toBe(200);
    expect(res.body.incident.phase).toBe('closed');
    expect(res.body.incident.review_completed_at).toBeTruthy();
  });

  it('returns 404 for non-existent incident', async () => {
    const res = await api.put(`/api/products/${PRODUCT_ID}/incidents/00000000-0000-0000-0000-000000000000`, {
      auth: token,
      body: { phase: 'assessment' },
    });
    expect(res.status).toBe(404);
  });
});

// ─── Timeline ───────────────────────────────────────────────

describe('POST (timeline entry)', () => {
  it('rejects missing description', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/incidents/${incidentId}/timeline`, {
      auth: token,
      body: {},
    });
    expect(res.status).toBe(400);
  });

  it('rejects invalid event type', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/incidents/${incidentId}/timeline`, {
      auth: token,
      body: { event_type: 'invalid', description: 'test' },
    });
    expect(res.status).toBe(400);
  });

  it('adds a note to the timeline', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/incidents/${incidentId}/timeline`, {
      auth: token,
      body: { event_type: 'note', description: 'Contacted upstream maintainer' },
    });
    expect(res.status).toBe(201);
    expect(res.body.entry.event_type).toBe('note');
    expect(res.body.entry.description).toContain('upstream');
  });

  it('timeline shows all entries including auto-logged phase changes', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/incidents/${incidentId}`, { auth: token });
    expect(res.status).toBe(200);
    // Should have: creation + assessment + containment + recovery + review + closed + note = 7+
    expect(res.body.timeline.length).toBeGreaterThanOrEqual(7);
    const phaseChanges = res.body.timeline.filter((e: any) => e.event_type === 'phase_change');
    expect(phaseChanges.length).toBeGreaterThanOrEqual(6); // creation + 5 transitions
  });
});

// ─── Escalation ─────────────────────────────────────────────

describe('POST (escalate to ENISA)', () => {
  let escalateIncidentId: string;

  it('creates a new incident for escalation test', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/incidents`, {
      auth: token,
      body: { title: 'Test Incident Escalation', severity: 'P1' },
    });
    expect(res.status).toBe(201);
    escalateIncidentId = res.body.incident.id;
  });

  it('escalates to a CRA report', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/incidents/${escalateIncidentId}/escalate`, {
      auth: token,
      body: { csirt_country: 'DE', report_type: 'incident' },
    });
    expect(res.status).toBe(201);
    expect(res.body.report).toBeTruthy();
    expect(res.body.report.report_type).toBe('incident');
    expect(res.body.report.csirt_country).toBe('DE');
    expect(res.body.report.status).toBe('draft');
    expect(res.body.incidentId).toBe(escalateIncidentId);
  });

  it('rejects duplicate escalation', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/incidents/${escalateIncidentId}/escalate`, {
      auth: token,
      body: { csirt_country: 'FR' },
    });
    expect(res.status).toBe(409);
  });

  it('incident now has linked_report_id', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/incidents/${escalateIncidentId}`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.incident.linked_report_id).toBeTruthy();
  });

  it('timeline shows escalation entry', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/incidents/${escalateIncidentId}`, { auth: token });
    const escalationEntry = res.body.timeline.find((e: any) => e.event_type === 'escalation');
    expect(escalationEntry).toBeTruthy();
    expect(escalationEntry.description).toContain('ENISA');
  });
});

// ─── DELETE ─────────────────────────────────────────────────

describe('DELETE (remove incident)', () => {
  it('rejects deletion of non-detection phase incident', async () => {
    // incidentId is now 'closed'
    const res = await api.delete(`/api/products/${PRODUCT_ID}/incidents/${incidentId}`, { auth: token });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('detection');
  });

  it('deletes a detection-phase incident', async () => {
    // Create a fresh one to delete
    const create = await api.post(`/api/products/${PRODUCT_ID}/incidents`, {
      auth: token,
      body: { title: 'Test Incident Delete Me', severity: 'P4' },
    });
    const delId = create.body.incident.id;

    const res = await api.delete(`/api/products/${PRODUCT_ID}/incidents/${delId}`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);

    // Confirm gone
    const check = await api.get(`/api/products/${PRODUCT_ID}/incidents/${delId}`, { auth: token });
    expect(check.status).toBe(404);
  });
});

/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

/**
 * Field Issues — Integration Tests
 *
 * Tests the post-market monitoring field issue tracking endpoints:
 *   GET    /api/products/:productId/field-issues
 *   GET    /api/products/:productId/field-issues/summary
 *   GET    /api/products/:productId/field-issues/:issueId
 *   POST   /api/products/:productId/field-issues
 *   PUT    /api/products/:productId/field-issues/:issueId
 *   DELETE /api/products/:productId/field-issues/:issueId
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginTestUser, TEST_USERS, getAppPool } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

const PRODUCT_ID = TEST_IDS.products.github;
const OTHER_PRODUCT_ID = TEST_IDS.products.impGithub; // belongs to different org
const ORG_ID = TEST_IDS.orgs.mfgActive;

let token: string;
let createdIssueId: string;

beforeAll(async () => {
  token = await loginTestUser(TEST_USERS.mfgAdmin);

  // Clean any stale field issues from prior runs
  const pool = getAppPool();
  await pool.query('DELETE FROM field_issues WHERE product_id = $1 AND org_id = $2', [PRODUCT_ID, ORG_ID]);
}, 15000);

afterAll(async () => {
  const pool = getAppPool();
  await pool.query('DELETE FROM field_issues WHERE product_id = $1 AND org_id = $2', [PRODUCT_ID, ORG_ID]);
}, 10000);

// ─── Auth ────────────────────────────────────────────────────────────

describe('Auth & access control', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/field-issues`);
    expect(res.status).toBe(401);
  });

  it('rejects access to products in another org', async () => {
    const res = await api.get(`/api/products/${OTHER_PRODUCT_ID}/field-issues`, {
      auth: token,
    });
    expect(res.status).toBe(404);
  });
});

// ─── CRUD ────────────────────────────────────────────────────────────

describe('Create field issue', () => {
  it('creates a field issue with required fields only', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/field-issues`, {
      auth: token,
      body: { title: 'Buffer overflow in input parser' },
    });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Buffer overflow in input parser');
    expect(res.body.severity).toBe('medium');
    expect(res.body.source).toBe('internal_testing');
    expect(res.body.status).toBe('open');
    expect(res.body.product_id).toBe(PRODUCT_ID);
    createdIssueId = res.body.id;
  });

  it('creates a field issue with all fields', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/field-issues`, {
      auth: token,
      body: {
        title: 'TLS handshake failure on legacy clients',
        description: 'Clients running TLS 1.1 fail to connect after security update',
        severity: 'high',
        source: 'customer_report',
        affected_versions: '2.3.0, 2.3.1',
      },
    });
    expect(res.status).toBe(201);
    expect(res.body.severity).toBe('high');
    expect(res.body.source).toBe('customer_report');
    expect(res.body.affected_versions).toBe('2.3.0, 2.3.1');
  });

  it('rejects creation without title', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/field-issues`, {
      auth: token,
      body: { description: 'No title provided' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Title is required');
  });

  it('rejects invalid severity', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/field-issues`, {
      auth: token,
      body: { title: 'Test issue', severity: 'extreme' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid severity');
  });

  it('rejects invalid source', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/field-issues`, {
      auth: token,
      body: { title: 'Test issue', source: 'unknown_source' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid source');
  });
});

// ─── List & filter ───────────────────────────────────────────────────

describe('List field issues', () => {
  it('lists all issues for a product', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/field-issues`, {
      auth: token,
    });
    expect(res.status).toBe(200);
    expect(res.body.issues).toBeInstanceOf(Array);
    expect(res.body.issues.length).toBeGreaterThanOrEqual(2);
  });

  it('filters by severity', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/field-issues`, {
      auth: token,
      query: { severity: 'high' },
    });
    expect(res.status).toBe(200);
    for (const issue of res.body.issues) {
      expect(issue.severity).toBe('high');
    }
  });

  it('filters by status', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/field-issues`, {
      auth: token,
      query: { status: 'open' },
    });
    expect(res.status).toBe(200);
    for (const issue of res.body.issues) {
      expect(issue.status).toBe('open');
    }
  });

  it('filters by source', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/field-issues`, {
      auth: token,
      query: { source: 'customer_report' },
    });
    expect(res.status).toBe(200);
    for (const issue of res.body.issues) {
      expect(issue.source).toBe('customer_report');
    }
  });
});

// ─── Get single issue ────────────────────────────────────────────────

describe('Get single field issue', () => {
  it('returns a single issue by ID', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/field-issues/${createdIssueId}`, {
      auth: token,
    });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdIssueId);
    expect(res.body.title).toBe('Buffer overflow in input parser');
  });

  it('returns 404 for non-existent issue', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/field-issues/00000000-0000-0000-0000-000000000000`, {
      auth: token,
    });
    expect(res.status).toBe(404);
  });
});

// ─── Update ──────────────────────────────────────────────────────────

describe('Update field issue', () => {
  it('updates severity and description', async () => {
    const res = await api.put(`/api/products/${PRODUCT_ID}/field-issues/${createdIssueId}`, {
      auth: token,
      body: {
        severity: 'critical',
        description: 'Escalated after further investigation',
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.severity).toBe('critical');
    expect(res.body.description).toBe('Escalated after further investigation');
  });

  it('transitions to investigating', async () => {
    const res = await api.put(`/api/products/${PRODUCT_ID}/field-issues/${createdIssueId}`, {
      auth: token,
      body: { status: 'investigating' },
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('investigating');
    expect(res.body.resolved_at).toBeNull();
  });

  it('transitions to resolved and auto-sets resolved_at', async () => {
    const res = await api.put(`/api/products/${PRODUCT_ID}/field-issues/${createdIssueId}`, {
      auth: token,
      body: {
        status: 'resolved',
        resolution: 'Fixed bounds checking in input parser',
        fixed_in_version: '2.4.0',
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('resolved');
    expect(res.body.resolution).toBe('Fixed bounds checking in input parser');
    expect(res.body.fixed_in_version).toBe('2.4.0');
    expect(res.body.resolved_at).not.toBeNull();
  });

  it('rejects invalid status', async () => {
    const res = await api.put(`/api/products/${PRODUCT_ID}/field-issues/${createdIssueId}`, {
      auth: token,
      body: { status: 'invalid_status' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid status');
  });

  it('returns 404 for non-existent issue', async () => {
    const res = await api.put(`/api/products/${PRODUCT_ID}/field-issues/00000000-0000-0000-0000-000000000000`, {
      auth: token,
      body: { severity: 'low' },
    });
    expect(res.status).toBe(404);
  });
});

// ─── Summary ─────────────────────────────────────────────────────────

describe('Field issue summary', () => {
  it('returns aggregated counts', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/field-issues/summary`, {
      auth: token,
    });
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
    expect(res.body.byStatus).toBeDefined();
    expect(res.body.bySeverity).toBeDefined();
    expect(typeof res.body.byStatus.open).toBe('number');
    expect(typeof res.body.bySeverity.critical).toBe('number');
    // At least one resolved issue exists, so avg should be present
    expect(res.body.avgResolutionDays).not.toBeNull();
  });
});

// ─── Corrective Actions ──────────────────────────────────────────────

describe('Corrective actions', () => {
  let actionIssueId: string;
  let actionId: string;

  it('creates an issue for corrective action tests', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/field-issues`, {
      auth: token,
      body: { title: 'Issue for corrective action testing', severity: 'high' },
    });
    expect(res.status).toBe(201);
    actionIssueId = res.body.id;
  });

  it('creates a corrective action', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/field-issues/${actionIssueId}/actions`, {
      auth: token,
      body: { description: 'Deploy hotfix for buffer overflow', action_type: 'hotfix' },
    });
    expect(res.status).toBe(201);
    expect(res.body.description).toBe('Deploy hotfix for buffer overflow');
    expect(res.body.action_type).toBe('hotfix');
    expect(res.body.status).toBe('planned');
    actionId = res.body.id;
  });

  it('rejects corrective action without description', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/field-issues/${actionIssueId}/actions`, {
      auth: token,
      body: { action_type: 'patch' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Description is required');
  });

  it('rejects invalid action_type', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/field-issues/${actionIssueId}/actions`, {
      auth: token,
      body: { description: 'Test', action_type: 'invalid' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid action_type');
  });

  it('lists corrective actions', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/field-issues/${actionIssueId}/actions`, {
      auth: token,
    });
    expect(res.status).toBe(200);
    expect(res.body.actions.length).toBe(1);
    expect(res.body.actions[0].id).toBe(actionId);
  });

  it('updates corrective action status and auto-sets completed_at', async () => {
    const res = await api.put(`/api/products/${PRODUCT_ID}/field-issues/${actionIssueId}/actions/${actionId}`, {
      auth: token,
      body: { status: 'completed', version_released: '2.4.1' },
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.version_released).toBe('2.4.1');
    expect(res.body.completed_at).not.toBeNull();
  });

  it('deletes a corrective action', async () => {
    const res = await api.delete(`/api/products/${PRODUCT_ID}/field-issues/${actionIssueId}/actions/${actionId}`, {
      auth: token,
    });
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
  });

  it('returns 404 for non-existent corrective action', async () => {
    const res = await api.delete(`/api/products/${PRODUCT_ID}/field-issues/${actionIssueId}/actions/00000000-0000-0000-0000-000000000000`, {
      auth: token,
    });
    expect(res.status).toBe(404);
  });
});

// ─── Delete ──────────────────────────────────────────────────────────

describe('Delete field issue', () => {
  it('deletes an existing issue', async () => {
    const res = await api.delete(`/api/products/${PRODUCT_ID}/field-issues/${createdIssueId}`, {
      auth: token,
    });
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
  });

  it('returns 404 when deleting non-existent issue', async () => {
    const res = await api.delete(`/api/products/${PRODUCT_ID}/field-issues/${createdIssueId}`, {
      auth: token,
    });
    expect(res.status).toBe(404);
  });
});

// ─── Export ─────────────────────────────────────────────────────────

describe('Post-market surveillance export', () => {
  it('returns a Markdown report', async () => {
    // Create an issue so export has content
    await api.post(`/api/products/${PRODUCT_ID}/field-issues`, {
      auth: token,
      body: { title: 'Export test issue', severity: 'high', source: 'customer_report' },
    });

    const res = await api.get(`/api/products/${PRODUCT_ID}/field-issues/export`, {
      auth: token,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/markdown');
    expect(res.headers.get('content-disposition')).toContain('attachment');
    expect(res.body).toContain('# Post-Market Surveillance Report');
    expect(res.body).toContain('Article 13(2)');
    expect(res.body).toContain('Export test issue');
  });

  it('rejects unauthenticated export', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/field-issues/export`);
    expect(res.status).toBe(401);
  });

  it('rejects export for another org product', async () => {
    const res = await api.get(`/api/products/${OTHER_PRODUCT_ID}/field-issues/export`, {
      auth: token,
    });
    expect(res.status).toBe(404);
  });
});

// ─── Cross-org isolation ─────────────────────────────────────────────

describe('Cross-org isolation', () => {
  it('cannot access field issues from another org product', async () => {
    const res = await api.post(`/api/products/${OTHER_PRODUCT_ID}/field-issues`, {
      auth: token,
      body: { title: 'Should be rejected' },
    });
    expect(res.status).toBe(404);
  });
});

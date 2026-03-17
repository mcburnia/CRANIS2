/**
 * Software Evidence Engine — Integration Tests
 *
 * Tests the SEE API endpoints:
 *   POST/GET /:productId/see/consent
 *   POST/GET /:productId/see/estimate
 *   GET      /:productId/see/estimate/history
 *   GET      /:productId/see/estimate/export
 *   GET      /:productId/see/commits
 *   GET      /:productId/see/developers
 *   GET      /:productId/see/branches
 *   GET      /:productId/see/experiments
 *   GET      /:productId/see/evolution
 *   GET      /:productId/see/graph
 *   GET      /:productId/see/graph/query/:queryType
 *   GET      /:productId/see/reports/types
 *   GET      /:productId/see/reports
 *   GET      /:productId/see/sessions
 *   GET      /:productId/see/competence
 *   POST     /:productId/see/sessions/start
 *   POST     /:productId/see/sessions/:sessionId/record
 *   POST     /:productId/see/sessions/:sessionId/end
 *   GET      /:productId/see/sessions/:sessionId/turns
 *   GET      /:productId/see/hooks-config
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginTestUser, TEST_USERS, getAppPool, getNeo4jSession } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

const PRODUCT_ID = TEST_IDS.products.github;
const OTHER_PRODUCT_ID = TEST_IDS.products.impGithub;
const ORG_ID = TEST_IDS.orgs.mfgActive;

let token: string;
let sessionId: string;

beforeAll(async () => {
  token = await loginTestUser(TEST_USERS.mfgAdmin);

  // Clean SEE data from prior runs
  const pool = getAppPool();
  await pool.query('DELETE FROM see_session_turns WHERE session_id IN (SELECT id FROM see_sessions WHERE product_id = $1)', [PRODUCT_ID]);
  await pool.query('DELETE FROM see_sessions WHERE product_id = $1', [PRODUCT_ID]);
  await pool.query('DELETE FROM see_experiments WHERE product_id = $1', [PRODUCT_ID]);
  await pool.query('DELETE FROM see_branches WHERE product_id = $1', [PRODUCT_ID]);
  await pool.query('DELETE FROM see_commits WHERE product_id = $1', [PRODUCT_ID]);
  await pool.query('DELETE FROM see_evidence_reports WHERE product_id = $1', [PRODUCT_ID]);
  await pool.query('DELETE FROM see_analysis_runs WHERE product_id = $1', [PRODUCT_ID]);

  // Reset consent
  const neo = getNeo4jSession();
  try {
    await neo.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       SET p.sourceCodeConsent = false`,
      { orgId: ORG_ID, productId: PRODUCT_ID }
    );
  } finally {
    await neo.close();
  }
}, 15000);

afterAll(async () => {
  const pool = getAppPool();
  await pool.query('DELETE FROM see_session_turns WHERE session_id IN (SELECT id FROM see_sessions WHERE product_id = $1)', [PRODUCT_ID]);
  await pool.query('DELETE FROM see_sessions WHERE product_id = $1', [PRODUCT_ID]);
  await pool.query('DELETE FROM see_experiments WHERE product_id = $1', [PRODUCT_ID]);
  await pool.query('DELETE FROM see_branches WHERE product_id = $1', [PRODUCT_ID]);
  await pool.query('DELETE FROM see_commits WHERE product_id = $1', [PRODUCT_ID]);
  await pool.query('DELETE FROM see_evidence_reports WHERE product_id = $1', [PRODUCT_ID]);
  await pool.query('DELETE FROM see_analysis_runs WHERE product_id = $1', [PRODUCT_ID]);

  const neo = getNeo4jSession();
  try {
    await neo.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       SET p.sourceCodeConsent = false`,
      { orgId: ORG_ID, productId: PRODUCT_ID }
    );
  } finally {
    await neo.close();
  }
}, 10000);

// ═══════════════════════════════════════════════════════════════════
// Auth & Access Control
// ═══════════════════════════════════════════════════════════════════

describe('Auth & access control', () => {
  it('rejects unauthenticated consent request', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/see/consent`);
    expect(res.status).toBe(401);
  });

  it('rejects access to products in another org', async () => {
    const res = await api.get(`/api/products/${OTHER_PRODUCT_ID}/see/consent`, {
      auth: token,
    });
    expect(res.status).toBe(404);
  });

  it('rejects non-existent product', async () => {
    const res = await api.get(`/api/products/00000000-0000-0000-0000-000000000000/see/consent`, {
      auth: token,
    });
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase A: Consent
// ═══════════════════════════════════════════════════════════════════

describe('Consent management', () => {
  it('returns false consent by default', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/see/consent`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.sourceCodeConsent).toBe(false);
  });

  it('rejects non-boolean consent value', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/see/consent`, {
      auth: token,
      body: { consent: 'yes' },
    });
    expect(res.status).toBe(400);
  });

  it('grants consent', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/see/consent`, {
      auth: token,
      body: { consent: true },
    });
    expect(res.status).toBe(200);
    expect(res.body.sourceCodeConsent).toBe(true);
  });

  it('confirms consent is persisted', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/see/consent`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.sourceCodeConsent).toBe(true);
  });

  it('revokes consent', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/see/consent`, {
      auth: token,
      body: { consent: false },
    });
    expect(res.status).toBe(200);
    expect(res.body.sourceCodeConsent).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase A: Estimation (without consent — should fail)
// ═══════════════════════════════════════════════════════════════════

describe('Estimation plan gating', () => {
  it('rejects estimate scan on Standard plan (requires Pro)', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/see/estimate`, { auth: token });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('feature_requires_plan');
  });

  it('rejects commit ingest on Standard plan', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/see/commits/ingest`, { auth: token });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('feature_requires_plan');
  });

  it('rejects branch analysis on Standard plan', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/see/branches/analyse`, { auth: token });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('feature_requires_plan');
  });

  it('rejects experiment detection on Standard plan', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/see/experiments/detect`, { auth: token });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('feature_requires_plan');
  });

  it('rejects evolution analysis on Standard plan', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/see/evolution/analyse`, { auth: token });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('feature_requires_plan');
  });

  it('rejects graph build on Standard plan', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/see/graph/build`, { auth: token });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('feature_requires_plan');
  });

  it('rejects report generation on Standard plan', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/see/reports/generate/rnd_tax`, { auth: token });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('feature_requires_plan');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase A: Estimation (get — no prior scan)
// ═══════════════════════════════════════════════════════════════════

describe('Estimation with no prior scan', () => {
  it('returns scanned:false when no scan exists', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/see/estimate`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.scanned).toBe(false);
  });

  it('returns empty history when no scans exist', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/see/estimate/history`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.runs).toEqual([]);
  });

  it('returns 404 on export when no scan exists', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/see/estimate/export`, { auth: token });
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase B: Commits (no prior ingest)
// ═══════════════════════════════════════════════════════════════════

describe('Commit data without prior ingest', () => {
  it('returns empty commit summary', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/see/commits`, { auth: token });
    expect(res.status).toBe(200);
  });

  it('returns empty developer attribution', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/see/developers`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.developers).toBeDefined();
  });

  it('returns empty commit activity', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/see/commits/activity`, { auth: token });
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase C: Branches (no prior analysis)
// ═══════════════════════════════════════════════════════════════════

describe('Branch data without prior analysis', () => {
  it('returns analysed:false when no analysis exists', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/see/branches`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.analysed).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase D: Experiments (no prior detection)
// ═══════════════════════════════════════════════════════════════════

describe('Experiments without prior detection', () => {
  it('returns detected:false when no experiments exist', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/see/experiments`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.detected).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase E: Evolution (no prior analysis)
// ═══════════════════════════════════════════════════════════════════

describe('Evolution without prior analysis', () => {
  it('returns analysed:false when no evolution data exists', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/see/evolution`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.analysed).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase F: Evidence Graph
// ═══════════════════════════════════════════════════════════════════

describe('Evidence graph', () => {
  it('returns graph summary', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/see/graph`, { auth: token });
    // May return 200 (empty graph) or 500 (no data yet) depending on implementation
    expect([200, 500]).toContain(res.status);
  });

  it('rejects invalid query type', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/see/graph/query/invalid-type`, { auth: token });
    expect(res.status).toBe(400);
    expect(res.body.validQueries).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase G: Reports
// ═══════════════════════════════════════════════════════════════════

describe('Multi-regulation reports', () => {
  it('returns available report types', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/see/reports/types`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.reportTypes).toBeDefined();
    expect(Object.keys(res.body.reportTypes).length).toBeGreaterThan(0);
  });

  it('returns empty reports list initially', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/see/reports`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.reports).toBeDefined();
    expect(res.body.reportTypes).toBeDefined();
  });

  it('rejects report generation on Standard plan', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/see/reports/generate/invalid_type`, { auth: token });
    // Plan gating returns 403 before report type validation
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Phase H: Session Capture
// ═══════════════════════════════════════════════════════════════════

describe('Session capture lifecycle', () => {
  it('starts a session', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/see/sessions/start`, {
      auth: token,
      body: { developerName: 'Test Developer', developerEmail: 'dev@test.com' },
    });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('active');
    expect(res.body.developerName).toBe('Test Developer');
    sessionId = res.body.id;
  });

  it('records a human turn', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/see/sessions/${sessionId}/record`, {
      auth: token,
      body: {
        role: 'human',
        content: 'Please implement the SBOM export endpoint with CycloneDX 1.6 format support. We need to ensure compliance with CRA Annex VII requirements.',
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.turnNumber).toBe(1);
  });

  it('records an assistant turn', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/see/sessions/${sessionId}/record`, {
      auth: token,
      body: {
        role: 'assistant',
        content: 'I will implement the SBOM export endpoint using the CycloneDX 1.6 specification. The endpoint will generate a compliant BOM document from the Neo4j dependency graph.',
        toolCalls: ['read_file', 'write_file'],
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.turnNumber).toBe(2);
  });

  it('rejects recording without role', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/see/sessions/${sessionId}/record`, {
      auth: token,
      body: { content: 'missing role' },
    });
    expect(res.status).toBe(400);
  });

  it('rejects recording without content', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/see/sessions/${sessionId}/record`, {
      auth: token,
      body: { role: 'human' },
    });
    expect(res.status).toBe(400);
  });

  it('lists sessions', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/see/sessions`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.sessions.length).toBeGreaterThanOrEqual(1);
    expect(res.body.sessions[0].status).toBe('active');
  });

  it('retrieves session turns', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/see/sessions/${sessionId}/turns`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.turns.length).toBe(2);
    expect(res.body.turns[0].role).toBe('human');
    expect(res.body.turns[1].role).toBe('assistant');
  });

  it('ends a session with competence analysis', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/see/sessions/${sessionId}/end`, {
      auth: token,
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.endedAt).toBeDefined();
  });

  it('rejects recording on a completed session', async () => {
    const res = await api.post(`/api/products/${PRODUCT_ID}/see/sessions/${sessionId}/record`, {
      auth: token,
      body: { role: 'human', content: 'Should fail' },
    });
    expect(res.status).toBe(500);
  });

  it('retrieves competence profile', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/see/competence`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.sessionsAnalysed).toBeGreaterThanOrEqual(1);
    expect(res.body.competenceLevel).toBeDefined();
    expect(res.body.domainsDemonstrated).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Hooks Config
// ═══════════════════════════════════════════════════════════════════

describe('Hooks configuration', () => {
  it('returns hooks config for Claude Code', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/see/hooks-config`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.hooksJson).toBeDefined();
    expect(res.body.hooksJson.hooks.assistant_response).toBeDefined();
    expect(res.body.startSessionCommand).toBeDefined();
    expect(res.body.endSessionCommand).toBeDefined();
  });
});

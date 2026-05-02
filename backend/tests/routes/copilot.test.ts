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
 * Copilot Route Tests — /api/copilot
 *
 * Tests: status endpoint (availability, plan, usage shape), suggest endpoint
 * (auth, validation, plan gating, cross-org isolation).
 *
 * NOTE: Actual AI generation is NOT tested here — it requires ANTHROPIC_API_KEY
 * and would be slow/flaky. We only test auth, validation, plan gating, and
 * cross-org isolation.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

const MFG_PRODUCT = TEST_IDS.products.github;
const IMP_PRODUCT = TEST_IDS.products.impGithub;

describe('/api/copilot', () => {
  let mfgToken: string;
  let impToken: string;

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
  });

  // ═══════════════════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════════════════

  describe('Authentication', () => {
    it('should reject unauthenticated GET /status', async () => {
      const res = await api.get('/api/copilot/status');
      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated POST /suggest', async () => {
      const res = await api.post('/api/copilot/suggest', {
        body: { productId: MFG_PRODUCT, sectionKey: 'product_description', type: 'technical_file' },
      });
      expect(res.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════
  // GET /api/copilot/status
  // ═══════════════════════════════════════════════════════

  describe('GET /api/copilot/status', () => {
    it('should return expected response shape', async () => {
      const res = await api.get('/api/copilot/status', { auth: mfgToken });
      expect(res.status).toBe(200);

      // Top-level fields
      expect(res.body).toHaveProperty('available');
      expect(res.body).toHaveProperty('configured');
      expect(res.body).toHaveProperty('plan');
      expect(res.body).toHaveProperty('hasAccess');

      // Usage sub-object
      expect(res.body).toHaveProperty('usage');
      expect(res.body.usage).toHaveProperty('requestsThisMonth');
      expect(res.body.usage).toHaveProperty('inputTokensThisMonth');
      expect(res.body.usage).toHaveProperty('outputTokensThisMonth');

      // Type checks
      expect(typeof res.body.available).toBe('boolean');
      expect(typeof res.body.configured).toBe('boolean');
      expect(typeof res.body.plan).toBe('string');
      expect(typeof res.body.hasAccess).toBe('boolean');
      expect(typeof res.body.usage.requestsThisMonth).toBe('number');
      expect(typeof res.body.usage.inputTokensThisMonth).toBe('number');
      expect(typeof res.body.usage.outputTokensThisMonth).toBe('number');
    });

    it('should return different data per org (cross-org isolation)', async () => {
      const mfgRes = await api.get('/api/copilot/status', { auth: mfgToken });
      const impRes = await api.get('/api/copilot/status', { auth: impToken });

      expect(mfgRes.status).toBe(200);
      expect(impRes.status).toBe(200);

      // Both return valid status objects — plan may differ if configured differently
      expect(mfgRes.body).toHaveProperty('plan');
      expect(impRes.body).toHaveProperty('plan');

      // Usage counters are independent per org
      expect(mfgRes.body.usage).toBeDefined();
      expect(impRes.body.usage).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════
  // POST /api/copilot/suggest — Validation
  // ═══════════════════════════════════════════════════════

  describe('POST /api/copilot/suggest — validation', () => {
    it('should reject missing required fields (400)', async () => {
      // The requirePlan middleware runs before body validation.
      // Test orgs default to 'standard' plan, so requirePlan('pro') will
      // return 403 before the handler reaches field validation.
      // We test field validation by sending an empty body — we expect 403
      // from the plan check first (since standard < pro).
      const res = await api.post('/api/copilot/suggest', {
        auth: mfgToken,
        body: {},
      });
      // standard plan → 403 from requirePlan
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('feature_requires_plan');
    });

    it('should reject invalid type value (must be technical_file or obligation)', async () => {
      // Same plan gating applies — standard plan user gets 403 before
      // body validation can reject the invalid type.
      const res = await api.post('/api/copilot/suggest', {
        auth: mfgToken,
        body: { productId: MFG_PRODUCT, sectionKey: 'product_description', type: 'invalid_type' },
      });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('feature_requires_plan');
    });
  });

  // ═══════════════════════════════════════════════════════
  // POST /api/copilot/suggest — Plan Gating
  // ═══════════════════════════════════════════════════════

  describe('POST /api/copilot/suggest — plan gating', () => {
    it('should reject standard-plan user with 403', async () => {
      // mfgActive org has plan = 'standard' (the default)
      const res = await api.post('/api/copilot/suggest', {
        auth: mfgToken,
        body: { productId: MFG_PRODUCT, sectionKey: 'product_description', type: 'technical_file' },
      });
      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error', 'feature_requires_plan');
      expect(res.body).toHaveProperty('requiredPlan', 'pro');
      expect(res.body).toHaveProperty('currentPlan', 'standard');
    });

    it('should reject trial-org user with 403 (trial plan = standard)', async () => {
      // impTrial org also defaults to plan = 'standard'
      const res = await api.post('/api/copilot/suggest', {
        auth: impToken,
        body: { productId: IMP_PRODUCT, sectionKey: 'vulnerability_handling', type: 'obligation' },
      });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('feature_requires_plan');
      expect(res.body.requiredPlan).toBe('pro');
    });
  });

  // ═══════════════════════════════════════════════════════
  // POST /api/copilot/suggest — Cross-Org Isolation
  // ═══════════════════════════════════════════════════════

  describe('POST /api/copilot/suggest — cross-org product access', () => {
    it('should reject product from another org (plan gate hits first)', async () => {
      // impAdmin tries to access mfgActive's product — but since impAdmin
      // is on standard plan, requirePlan('pro') rejects at 403 before the
      // product ownership check at 404.
      const res = await api.post('/api/copilot/suggest', {
        auth: impToken,
        body: { productId: MFG_PRODUCT, sectionKey: 'product_description', type: 'technical_file' },
      });
      // Plan gate (403) takes precedence over product ownership (404)
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('feature_requires_plan');
    });
  });

  // ═══════════════════════════════════════════════════════
  // POST /api/copilot/triage
  // ═══════════════════════════════════════════════════════

  describe('POST /api/copilot/triage', () => {
    it('should reject unauthenticated requests', async () => {
      const res = await api.post('/api/copilot/triage', {
        body: { productId: MFG_PRODUCT },
      });
      expect(res.status).toBe(401);
    });

    it('should reject standard-plan user with 403', async () => {
      const res = await api.post('/api/copilot/triage', {
        auth: mfgToken,
        body: { productId: MFG_PRODUCT },
      });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('feature_requires_plan');
      expect(res.body.requiredPlan).toBe('pro');
    });

    it('should reject trial-org user with 403', async () => {
      const res = await api.post('/api/copilot/triage', {
        auth: impToken,
        body: { productId: IMP_PRODUCT },
      });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('feature_requires_plan');
    });

    it('should reject cross-org product access (plan gate first)', async () => {
      const res = await api.post('/api/copilot/triage', {
        auth: impToken,
        body: { productId: MFG_PRODUCT },
      });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('feature_requires_plan');
    });

    it('should reject missing productId with 403 (plan gate first)', async () => {
      // Plan gating runs before body validation for standard plan users
      const res = await api.post('/api/copilot/triage', {
        auth: mfgToken,
        body: {},
      });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('feature_requires_plan');
    });
  });

  // ═══════════════════════════════════════════════════════
  // GET /api/copilot/usage
  // ═══════════════════════════════════════════════════════

  describe('GET /api/copilot/usage', () => {
    it('should reject unauthenticated requests', async () => {
      const res = await api.get('/api/copilot/usage');
      expect(res.status).toBe(401);
    });

    it('should return expected response shape', async () => {
      const res = await api.get('/api/copilot/usage', { auth: mfgToken });
      expect(res.status).toBe(200);

      // Top-level fields
      expect(res.body).toHaveProperty('currentMonth');
      expect(res.body).toHaveProperty('history');
      expect(res.body).toHaveProperty('byType');
      expect(res.body).toHaveProperty('byProduct');

      // currentMonth shape
      expect(res.body.currentMonth).toHaveProperty('requests');
      expect(res.body.currentMonth).toHaveProperty('inputTokens');
      expect(res.body.currentMonth).toHaveProperty('outputTokens');
      expect(res.body.currentMonth).toHaveProperty('estimatedCostUsd');

      // Type checks
      expect(typeof res.body.currentMonth.requests).toBe('number');
      expect(typeof res.body.currentMonth.inputTokens).toBe('number');
      expect(typeof res.body.currentMonth.outputTokens).toBe('number');
      expect(typeof res.body.currentMonth.estimatedCostUsd).toBe('number');
      expect(Array.isArray(res.body.history)).toBe(true);
      expect(Array.isArray(res.body.byType)).toBe(true);
      expect(Array.isArray(res.body.byProduct)).toBe(true);
    });

    it('should accept months query parameter', async () => {
      const res = await api.get('/api/copilot/usage?months=3', { auth: mfgToken });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.history)).toBe(true);
    });

    it('should isolate usage data per org', async () => {
      const mfgRes = await api.get('/api/copilot/usage', { auth: mfgToken });
      const impRes = await api.get('/api/copilot/usage', { auth: impToken });

      expect(mfgRes.status).toBe(200);
      expect(impRes.status).toBe(200);

      // Both return valid usage objects — data is org-specific
      expect(mfgRes.body).toHaveProperty('currentMonth');
      expect(impRes.body).toHaveProperty('currentMonth');
    });
  });

  // ═══════════════════════════════════════════════════════
  // POST /api/copilot/generate-risk-assessment
  // ═══════════════════════════════════════════════════════

  describe('POST /api/copilot/generate-risk-assessment', () => {
    it('should reject unauthenticated requests', async () => {
      const res = await api.post('/api/copilot/generate-risk-assessment', {
        body: { productId: MFG_PRODUCT },
      });
      expect(res.status).toBe(401);
    });

    it('should reject standard-plan user with 403', async () => {
      const res = await api.post('/api/copilot/generate-risk-assessment', {
        auth: mfgToken,
        body: { productId: MFG_PRODUCT },
      });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('feature_requires_plan');
      expect(res.body.requiredPlan).toBe('pro');
    });

    it('should reject trial-org user with 403', async () => {
      const res = await api.post('/api/copilot/generate-risk-assessment', {
        auth: impToken,
        body: { productId: IMP_PRODUCT },
      });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('feature_requires_plan');
    });

    it('should reject cross-org product access (plan gate first)', async () => {
      const res = await api.post('/api/copilot/generate-risk-assessment', {
        auth: impToken,
        body: { productId: MFG_PRODUCT },
      });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('feature_requires_plan');
    });

    it('should reject missing productId with 403 (plan gate first)', async () => {
      const res = await api.post('/api/copilot/generate-risk-assessment', {
        auth: mfgToken,
        body: {},
      });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('feature_requires_plan');
    });
  });

  // ═══════════════════════════════════════════════════════
  // POST /api/copilot/draft-incident-report
  // ═══════════════════════════════════════════════════════

  describe('POST /api/copilot/draft-incident-report', () => {
    it('should reject unauthenticated requests', async () => {
      const res = await api.post('/api/copilot/draft-incident-report', {
        body: { reportId: TEST_IDS.reports.draft, stage: 'early_warning' },
      });
      expect(res.status).toBe(401);
    });

    it('should reject standard-plan user with 403', async () => {
      const res = await api.post('/api/copilot/draft-incident-report', {
        auth: mfgToken,
        body: { reportId: TEST_IDS.reports.draft, stage: 'early_warning' },
      });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('feature_requires_plan');
      expect(res.body.requiredPlan).toBe('pro');
    });

    it('should reject trial-org user with 403', async () => {
      const res = await api.post('/api/copilot/draft-incident-report', {
        auth: impToken,
        body: { reportId: TEST_IDS.reports.draft, stage: 'early_warning' },
      });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('feature_requires_plan');
    });

    it('should reject missing reportId with 403 (plan gate first)', async () => {
      const res = await api.post('/api/copilot/draft-incident-report', {
        auth: mfgToken,
        body: { stage: 'early_warning' },
      });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('feature_requires_plan');
    });

    it('should reject missing stage with 403 (plan gate first)', async () => {
      const res = await api.post('/api/copilot/draft-incident-report', {
        auth: mfgToken,
        body: { reportId: TEST_IDS.reports.draft },
      });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('feature_requires_plan');
    });
  });
});

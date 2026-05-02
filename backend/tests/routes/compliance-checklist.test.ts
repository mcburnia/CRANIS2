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
 * Compliance Checklist Tests — GET /api/products/:productId/compliance-checklist
 *
 * Endpoint returns 7 sequenced checklist steps with completion status derived
 * from existing platform data: SBOM, vuln scans, technical file sections,
 * stakeholders, and telemetry events.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

const PRODUCT_ID = TEST_IDS.products.github;

describe('GET /api/products/:productId/compliance-checklist', () => {
  let mfgToken: string;
  let impToken: string;

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
  });

  it('should reject unauthenticated requests', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/compliance-checklist`);
    expect(res.status).toBe(401);
  });

  it('should return 404 for a product belonging to another org', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/compliance-checklist`, { auth: impToken });
    expect(res.status).toBe(404);
  });

  it('should return 200 with the expected top-level shape', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/compliance-checklist`, { auth: mfgToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('productId', PRODUCT_ID);
    expect(res.body).toHaveProperty('productName');
    expect(res.body).toHaveProperty('stepsComplete');
    expect(res.body).toHaveProperty('stepsTotal', 7);
    expect(res.body).toHaveProperty('complete');
    expect(res.body).toHaveProperty('deadlines');
    expect(res.body).toHaveProperty('steps');
  });

  it('should return exactly 7 steps', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/compliance-checklist`, { auth: mfgToken });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.steps)).toBe(true);
    expect(res.body.steps.length).toBe(7);
  });

  it('should have the expected fields on each step', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/compliance-checklist`, { auth: mfgToken });
    expect(res.status).toBe(200);
    for (const step of res.body.steps) {
      expect(step).toHaveProperty('id');
      expect(step).toHaveProperty('step');
      expect(step).toHaveProperty('title');
      expect(step).toHaveProperty('description');
      expect(step).toHaveProperty('complete');
      expect(step).toHaveProperty('actionLabel');
      expect(typeof step.complete).toBe('boolean');
    }
  });

  it('should include 2 CRA deadline entries', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/compliance-checklist`, { auth: mfgToken });
    expect(res.status).toBe(200);
    expect(res.body.deadlines.length).toBe(2);
    const ids = res.body.deadlines.map((d: any) => d.id);
    expect(ids).toContain('incident_reporting');
    expect(ids).toContain('full_compliance');
    // Both deadlines should be in the future (test date: 2026-03-03)
    for (const d of res.body.deadlines) {
      expect(d.daysRemaining).toBeGreaterThan(0);
    }
  });

  it('should mark step 2 (set CRA category) complete for the seeded github product', async () => {
    // github product has craCategory = 'important_i' (non-null) → step 2 complete
    const res = await api.get(`/api/products/${PRODUCT_ID}/compliance-checklist`, { auth: mfgToken });
    expect(res.status).toBe(200);
    const step2 = res.body.steps.find((s: any) => s.id === 'set_category');
    expect(step2).toBeTruthy();
    expect(step2.complete).toBe(true);
  });

  it('should mark step 3 (triage findings) incomplete when open findings exist', async () => {
    // github product has seeded open vulnerability findings → step 3 not complete
    const res = await api.get(`/api/products/${PRODUCT_ID}/compliance-checklist`, { auth: mfgToken });
    expect(res.status).toBe(200);
    const step3 = res.body.steps.find((s: any) => s.id === 'triage_findings');
    expect(step3).toBeTruthy();
    expect(step3.complete).toBe(false);
  });

  it('should report stepsComplete consistent with individual step states', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/compliance-checklist`, { auth: mfgToken });
    expect(res.status).toBe(200);
    const calculatedComplete = res.body.steps.filter((s: any) => s.complete).length;
    expect(res.body.stepsComplete).toBe(calculatedComplete);
    // complete flag should match
    expect(res.body.complete).toBe(calculatedComplete === 7);
  });

  it('should not expose data from another org product', async () => {
    // impToken user has their own product — verify they cannot access mfg product
    const res = await api.get(`/api/products/${PRODUCT_ID}/compliance-checklist`, { auth: impToken });
    expect(res.status).toBe(404);
  });

  // ─── Notified Body Assessment Step (Phase D) ──────────────────────

  describe('NB assessment step for important_ii products', () => {
    const CODEBERG_ID = TEST_IDS.products.codeberg; // important_ii

    it('should return 8 steps (including nb_assessment) for important_ii product', async () => {
      const res = await api.get(`/api/products/${CODEBERG_ID}/compliance-checklist`, { auth: mfgToken });
      expect(res.status).toBe(200);
      expect(res.body.stepsTotal).toBe(8);
      expect(res.body.steps.length).toBe(8);
    });

    it('should include nb_assessment step with correct description', async () => {
      const res = await api.get(`/api/products/${CODEBERG_ID}/compliance-checklist`, { auth: mfgToken });
      expect(res.status).toBe(200);
      const nbStep = res.body.steps.find((s: any) => s.id === 'nb_assessment');
      expect(nbStep).toBeTruthy();
      expect(nbStep.title).toContain('notified body');
      expect(nbStep.description).toContain('Module B+C');
    });

    it('should still return 7 steps for important_i product (no NB required)', async () => {
      const res = await api.get(`/api/products/${PRODUCT_ID}/compliance-checklist`, { auth: mfgToken });
      expect(res.status).toBe(200);
      expect(res.body.stepsTotal).toBe(7);
      const nbStep = res.body.steps.find((s: any) => s.id === 'nb_assessment');
      expect(nbStep).toBeUndefined();
    });

    it('should place compliance_package as step 8 for important_ii', async () => {
      const res = await api.get(`/api/products/${CODEBERG_ID}/compliance-checklist`, { auth: mfgToken });
      expect(res.status).toBe(200);
      const pkg = res.body.steps.find((s: any) => s.id === 'compliance_package');
      expect(pkg).toBeTruthy();
      expect(pkg.step).toBe(8);
    });
  });
});

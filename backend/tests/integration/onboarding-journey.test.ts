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
 * Integration Test: Onboarding Journey
 *
 * Simulates the path a new user takes after signing in:
 * 1. View dashboard — verify summary loads with product list
 * 2. View product detail — verify product fields
 * 3. Check obligations are seeded for the product
 * 4. Check SBOM export status
 * 5. Check technical file sections are auto-created
 * 6. Check audit log records the login event
 *
 * Uses the seeded manufacturer admin who already has products,
 * since we cannot create new users via the test stack.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('Onboarding Journey', () => {
  let token: string;
  const productId = TEST_IDS.products.github;

  beforeAll(async () => {
    token = await loginTestUser(TEST_USERS.mfgAdmin);
  });

  // ─── Step 1: Dashboard loads with products ──────────────────────────

  describe('Step 1 — Dashboard summary', () => {
    it('should return dashboard summary with products', async () => {
      const res = await api.get('/api/dashboard/summary', { auth: token });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('products');
      expect(Array.isArray(res.body.products)).toBe(true);
      expect(res.body.products.length).toBeGreaterThanOrEqual(1);
    });

    it('should include stats overview', async () => {
      const res = await api.get('/api/dashboard/summary', { auth: token });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('stats');
      expect(res.body.stats).toHaveProperty('totalProducts');
      expect(res.body.stats).toHaveProperty('connectedRepos');
      expect(res.body.stats).toHaveProperty('totalContributors');
      expect(typeof res.body.stats.totalProducts).toBe('number');
    });

    it('should include risk findings summary', async () => {
      const res = await api.get('/api/dashboard/summary', { auth: token });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('riskFindings');
      expect(res.body.riskFindings).toHaveProperty('total');
      expect(res.body.riskFindings).toHaveProperty('critical');
      expect(res.body.riskFindings).toHaveProperty('high');
    });

    it('should include overall readiness percentage', async () => {
      const res = await api.get('/api/dashboard/summary', { auth: token });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('overallReadiness');
      expect(typeof res.body.overallReadiness).toBe('number');
      expect(res.body.overallReadiness).toBeGreaterThanOrEqual(0);
      expect(res.body.overallReadiness).toBeLessThanOrEqual(100);
    });
  });

  // ─── Step 2: View a product ─────────────────────────────────────────

  describe('Step 2 — Product detail', () => {
    it('should return product detail with expected fields', async () => {
      const res = await api.get(`/api/products/${productId}`, { auth: token });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', productId);
      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('craCategory');
      expect(res.body).toHaveProperty('lifecycleStatus');
    });

    it('should show product in dashboard products list', async () => {
      const res = await api.get('/api/dashboard/summary', { auth: token });
      const productIds = res.body.products.map((p: any) => p.id);
      expect(productIds).toContain(productId);
    });
  });

  // ─── Step 3: Obligations are seeded ─────────────────────────────────

  describe('Step 3 — Obligations exist for product', () => {
    it('should return obligations for the product', async () => {
      const res = await api.get(`/api/obligations/${productId}`, { auth: token });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('obligations');
      expect(Array.isArray(res.body.obligations)).toBe(true);
      expect(res.body.obligations.length).toBeGreaterThanOrEqual(10);
    });

    it('should include progress summary', async () => {
      const res = await api.get(`/api/obligations/${productId}`, { auth: token });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('progress');
      expect(res.body.progress).toHaveProperty('total');
      expect(res.body.progress).toHaveProperty('completed');
      expect(res.body.progress).toHaveProperty('inProgress');
      expect(res.body.progress).toHaveProperty('notStarted');
      expect(res.body.progress.total).toBe(res.body.obligations.length);
    });

    it('should have manufacturer obligations (Art. 13)', async () => {
      const res = await api.get(`/api/obligations/${productId}`, { auth: token });
      const keys = res.body.obligations.map((o: any) => o.obligationKey || o.obligation_key);
      expect(keys).toContain('art_13');
      expect(keys).toContain('art_13_6');
      expect(keys).toContain('art_13_11');
    });
  });

  // ─── Step 4: SBOM export status ─────────────────────────────────────

  describe('Step 4 — SBOM status available', () => {
    it('should return SBOM export status', async () => {
      const res = await api.get(`/api/sbom/${productId}/export/status`, { auth: token });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('hasSBOM');
      expect(typeof res.body.hasSBOM).toBe('boolean');
      expect(res.body).toHaveProperty('totalDependencies');
      expect(typeof res.body.totalDependencies).toBe('number');
    });
  });

  // ─── Step 5: Technical file sections auto-created ───────────────────

  describe('Step 5 — Technical file sections', () => {
    it('should return technical file with auto-created sections', async () => {
      const res = await api.get(`/api/technical-file/${productId}`, { auth: token });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('sections');
      expect(Array.isArray(res.body.sections)).toBe(true);
      expect(res.body.sections.length).toBeGreaterThanOrEqual(1);
    });

    it('should include progress tracking', async () => {
      const res = await api.get(`/api/technical-file/${productId}`, { auth: token });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('progress');
      expect(res.body.progress).toHaveProperty('total');
      expect(res.body.progress).toHaveProperty('completed');
    });

    it('should have section keys and titles', async () => {
      const res = await api.get(`/api/technical-file/${productId}`, { auth: token });
      const section = res.body.sections[0];
      expect(section).toHaveProperty('sectionKey');
      expect(section).toHaveProperty('title');
      expect(section).toHaveProperty('status');
    });
  });

  // ─── Step 6: Audit log records activity ─────────────────────────────

  describe('Step 6 — Audit log records login', () => {
    it('should have audit events including login', async () => {
      const res = await api.get('/api/audit-log', { auth: token });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('events');
      expect(res.body.events.length).toBeGreaterThanOrEqual(1);

      // Should have at least one login event
      const eventTypes = res.body.events.map((e: any) => e.eventType);
      expect(eventTypes).toContain('login');
    });
  });
});

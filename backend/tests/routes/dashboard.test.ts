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
 * Dashboard Route Tests — /api/dashboard
 *
 * Tests: summary endpoint (products, stats, risk findings, recent activity, CRA readiness)
 */

import { describe, it, expect } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

describe('/api/dashboard', () => {
  describe('GET /api/dashboard/summary', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get('/api/dashboard/summary');
      expect(res.status).toBe(401);
    });

    it('should return dashboard summary for active org', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get('/api/dashboard/summary', { auth: token });
      expect(res.status).toBe(200);
      // Should have product count, dependency count, etc.
      expect(res.body).toHaveProperty('products');
    });

    it('should return empty/zero stats for empty org', async () => {
      const token = await loginTestUser(TEST_USERS.emptyAdmin);
      const res = await api.get('/api/dashboard/summary', { auth: token });
      expect(res.status).toBe(200);
    });
  });

  // ─── CRA Readiness Scorecard ──────────────────────────────────────

  describe('CRA Readiness Scorecard', () => {
    it('should include overallReadiness in dashboard summary', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get('/api/dashboard/summary', { auth: token });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('overallReadiness');
      expect(typeof res.body.overallReadiness).toBe('number');
      expect(res.body.overallReadiness).toBeGreaterThanOrEqual(0);
      expect(res.body.overallReadiness).toBeLessThanOrEqual(100);
    });

    it('should include craReadiness on each product', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get('/api/dashboard/summary', { auth: token });
      expect(res.status).toBe(200);
      for (const product of res.body.products) {
        expect(product).toHaveProperty('craReadiness');
        expect(product.craReadiness).toHaveProperty('met');
        expect(product.craReadiness).toHaveProperty('total');
        expect(product.craReadiness).toHaveProperty('readiness');
        expect(typeof product.craReadiness.readiness).toBe('number');
        expect(product.craReadiness.readiness).toBeGreaterThanOrEqual(0);
        expect(product.craReadiness.readiness).toBeLessThanOrEqual(100);
      }
    });

    it('should return 0 overallReadiness for empty org', async () => {
      const token = await loginTestUser(TEST_USERS.emptyAdmin);
      const res = await api.get('/api/dashboard/summary', { auth: token });
      expect(res.status).toBe(200);
      expect(res.body.overallReadiness).toBe(0);
    });

    it('readiness should match round(met/total * 100) for each product', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get('/api/dashboard/summary', { auth: token });
      expect(res.status).toBe(200);
      for (const product of res.body.products) {
        const { met, total, readiness } = product.craReadiness;
        const expected = total > 0 ? Math.round((met / total) * 100) : 0;
        expect(readiness).toBe(expected);
      }
    });

    it('overallReadiness should be weighted average across products', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get('/api/dashboard/summary', { auth: token });
      expect(res.status).toBe(200);
      const products = res.body.products;
      if (products.length === 0) return;
      const totalMet = products.reduce((sum: number, p: any) => sum + p.craReadiness.met, 0);
      const totalObs = products.reduce((sum: number, p: any) => sum + p.craReadiness.total, 0);
      const expected = totalObs > 0 ? Math.round((totalMet / totalObs) * 100) : 0;
      expect(res.body.overallReadiness).toBe(expected);
    });

    it('met should never exceed total for any product', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get('/api/dashboard/summary', { auth: token });
      expect(res.status).toBe(200);
      for (const product of res.body.products) {
        expect(product.craReadiness.met).toBeLessThanOrEqual(product.craReadiness.total);
      }
    });
  });

  // ─── Support Status ──────────────────────────────────────────────

  describe('Support Status', () => {
    it('should include supportStatus on each product', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get('/api/dashboard/summary', { auth: token });
      expect(res.status).toBe(200);
      for (const product of res.body.products) {
        expect(product).toHaveProperty('supportStatus');
        expect(product.supportStatus).toHaveProperty('status');
        expect(product.supportStatus).toHaveProperty('daysRemaining');
        expect(product.supportStatus).toHaveProperty('endDate');
      }
    });

    it('supportStatus.status should be a valid value', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get('/api/dashboard/summary', { auth: token });
      expect(res.status).toBe(200);
      const validStatuses = ['active', 'ending_soon', 'ended', 'not_set'];
      for (const product of res.body.products) {
        expect(validStatuses).toContain(product.supportStatus.status);
      }
    });

    it('should return not_set with null daysRemaining when no end date', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get('/api/dashboard/summary', { auth: token });
      expect(res.status).toBe(200);
      const notSetProducts = res.body.products.filter(
        (p: any) => p.supportStatus.status === 'not_set'
      );
      for (const p of notSetProducts) {
        expect(p.supportStatus.daysRemaining).toBeNull();
        expect(p.supportStatus.endDate).toBeNull();
      }
    });

    it('should return supportStatus for empty org without error', async () => {
      const token = await loginTestUser(TEST_USERS.emptyAdmin);
      const res = await api.get('/api/dashboard/summary', { auth: token });
      expect(res.status).toBe(200);
      expect(res.body.products).toHaveLength(0);
    });
  });

  // ─── NB Assessment (Phase D) ───────────────────────────────────────

  describe('NB Assessment', () => {
    it('should include nbAssessment field on each product', async () => {
      const token = await loginTestUser(TEST_USERS.mfgAdmin);
      const res = await api.get('/api/dashboard/summary', { auth: token });
      expect(res.status).toBe(200);
      for (const product of res.body.products) {
        expect(product).toHaveProperty('nbAssessment');
        // nbAssessment is either null or an object with status/module/certificateNumber
        if (product.nbAssessment !== null) {
          expect(product.nbAssessment).toHaveProperty('status');
          expect(product.nbAssessment).toHaveProperty('module');
          expect(product.nbAssessment).toHaveProperty('certificateNumber');
        }
      }
    });

    it('should return null nbAssessment for empty org', async () => {
      const token = await loginTestUser(TEST_USERS.emptyAdmin);
      const res = await api.get('/api/dashboard/summary', { auth: token });
      expect(res.status).toBe(200);
      expect(res.body.products).toHaveLength(0);
    });
  });
});

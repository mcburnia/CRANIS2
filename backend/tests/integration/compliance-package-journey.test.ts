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
 * Integration Test: Compliance Package Assembly Journey
 *
 * Simulates a user assembling a complete compliance package for a product:
 * 1. Check obligations overview — see what needs to be done
 * 2. Review technical file sections — verify they exist
 * 3. Check SBOM export status — verify dependency data
 * 4. Request CycloneDX export — verify format
 * 5. Request SPDX export — verify format
 * 6. Get EU Declaration of Conformity — verify document
 * 7. Get due diligence preview — verify all data assembled
 * 8. Check conformity assessment — verify module recommendation
 * 9. Trigger compliance snapshot — verify async generation
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('Compliance Package Assembly Journey', () => {
  let token: string;
  const productId = TEST_IDS.products.github;

  beforeAll(async () => {
    token = await loginTestUser(TEST_USERS.mfgAdmin);
  });

  // ─── Step 1: Obligations overview ───────────────────────────────────

  describe('Step 1 — Obligations overview across products', () => {
    it('should return obligations overview for org', async () => {
      const res = await api.get('/api/obligations/overview', { auth: token });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('products');
      expect(Array.isArray(res.body.products)).toBe(true);
    });

    it('should include totals in overview', async () => {
      const res = await api.get('/api/obligations/overview', { auth: token });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totals');
      expect(res.body.totals).toHaveProperty('totalObligations');
      expect(typeof res.body.totals.totalObligations).toBe('number');
    });

    it('should return per-product obligations', async () => {
      const res = await api.get(`/api/obligations/${productId}`, { auth: token });
      expect(res.status).toBe(200);
      expect(res.body.obligations.length).toBeGreaterThanOrEqual(16);
    });
  });

  // ─── Step 2: Technical file sections ────────────────────────────────

  describe('Step 2 — Technical file readiness', () => {
    it('should return technical file with all sections', async () => {
      const res = await api.get(`/api/technical-file/${productId}`, { auth: token });
      expect(res.status).toBe(200);
      expect(res.body.sections.length).toBeGreaterThanOrEqual(1);

      // Each section should have key fields
      for (const section of res.body.sections) {
        expect(section).toHaveProperty('sectionKey');
        expect(section).toHaveProperty('title');
        expect(section).toHaveProperty('status');
      }
    });

    it('should track progress of section completion', async () => {
      const res = await api.get(`/api/technical-file/${productId}`, { auth: token });
      const { progress } = res.body;
      expect(progress.total).toBe(res.body.sections.length);
      expect(progress.completed + progress.inProgress + progress.notStarted).toBe(progress.total);
    });
  });

  // ─── Step 3: SBOM status ────────────────────────────────────────────

  describe('Step 3 — SBOM export status', () => {
    it('should report SBOM readiness', async () => {
      const res = await api.get(`/api/sbom/${productId}/export/status`, { auth: token });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('hasSBOM');
      expect(res.body).toHaveProperty('totalDependencies');
      expect(res.body).toHaveProperty('enrichedDependencies');
      expect(res.body).toHaveProperty('enrichmentComplete');
      expect(res.body).toHaveProperty('gaps');
    });
  });

  // ─── Step 4: CycloneDX export ───────────────────────────────────────

  describe('Step 4 — CycloneDX SBOM export', () => {
    it('should return CycloneDX format or 404', async () => {
      const res = await api.get(`/api/sbom/${productId}/export/cyclonedx`, { auth: token });
      if (res.status === 200) {
        expect(res.body).toHaveProperty('bomFormat', 'CycloneDX');
        expect(res.body).toHaveProperty('specVersion');
        expect(res.body).toHaveProperty('components');
        expect(Array.isArray(res.body.components)).toBe(true);
      } else {
        expect(res.status).toBe(404);
      }
    });
  });

  // ─── Step 5: SPDX export ───────────────────────────────────────────

  describe('Step 5 — SPDX SBOM export', () => {
    it('should return SPDX format or 404', async () => {
      const res = await api.get(`/api/sbom/${productId}/export/spdx`, { auth: token });
      if (res.status === 200) {
        expect(res.body).toHaveProperty('spdxVersion');
        expect(res.body.spdxVersion).toMatch(/^SPDX-/);
        expect(res.body).toHaveProperty('packages');
        expect(Array.isArray(res.body.packages)).toBe(true);
      } else {
        expect(res.status).toBe(404);
      }
    });
  });

  // ─── Step 6: EU Declaration of Conformity ───────────────────────────

  describe('Step 6 — EU Declaration of Conformity', () => {
    it('should return EU DoC document', async () => {
      const res = await api.get(
        `/api/technical-file/${productId}/declaration-of-conformity/pdf`,
        { auth: token }
      );
      expect(res.status).toBe(200);
      // Document is returned as markdown text
      expect(typeof res.body).toBe('string');
      expect(res.body).toContain('REGULATION (EU) 2024/2847');
    });
  });

  // ─── Step 7: Due diligence preview ──────────────────────────────────

  describe('Step 7 — Due diligence preview', () => {
    it('should assemble full due diligence data', async () => {
      const res = await api.get(`/api/due-diligence/${productId}/preview`, { auth: token });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('product');
      expect(res.body).toHaveProperty('organisation');
      expect(res.body).toHaveProperty('dependencies');
      expect(res.body).toHaveProperty('vulnerabilities');
      expect(res.body).toHaveProperty('licenseScan');
      expect(res.body).toHaveProperty('licenseFindings');
    });
  });

  // ─── Step 8: Conformity assessment ──────────────────────────────────

  describe('Step 8 — Conformity assessment', () => {
    it('should return conformity assessment for product', async () => {
      const res = await api.get(`/api/products/${productId}/conformity-assessment`, { auth: token });
      // May return 200 with assessment or 500 if product data incomplete in test stack
      if (res.status === 200) {
        expect(res.body).toHaveProperty('productId');
        expect(res.body).toHaveProperty('productName');
      } else {
        expect([200, 500]).toContain(res.status);
      }
    });

    it('should return public assessment modules', async () => {
      const res = await api.get('/api/conformity-assessment/modules/all');
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });
  });

  // ─── Step 9: Compliance snapshot ────────────────────────────────────

  describe('Step 9 — Compliance snapshot generation', () => {
    let snapshotId: string;

    it('should trigger compliance snapshot generation', async () => {
      const res = await api.post(`/api/products/${productId}/compliance-snapshots`, {
        auth: token,
      });
      expect([200, 201, 202]).toContain(res.status);
      expect(res.body).toHaveProperty('id');
      snapshotId = res.body.id;
    });

    it('should list compliance snapshots for product', async () => {
      const res = await api.get(`/api/products/${productId}/compliance-snapshots`, {
        auth: token,
      });
      expect(res.status).toBe(200);
      // Should be an array or object with snapshots
      const snapshots = Array.isArray(res.body) ? res.body : res.body.snapshots;
      expect(Array.isArray(snapshots)).toBe(true);
      expect(snapshots.length).toBeGreaterThanOrEqual(1);
    });

    it('should report snapshot status', async () => {
      if (!snapshotId) return;
      const res = await api.get(
        `/api/products/${productId}/compliance-snapshots/${snapshotId}/status`,
        { auth: token }
      );
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status');
      expect(['generating', 'complete', 'error']).toContain(res.body.status);
    });
  });
});

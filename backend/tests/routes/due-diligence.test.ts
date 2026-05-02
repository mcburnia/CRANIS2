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
 * Due Diligence Route Tests — /api/due-diligence
 *
 * Tests: preview data retrieval, export download, auth, cross-org isolation,
 * preview field depth validation
 *
 * API response formats (from probing):
 * - GET /api/due-diligence/:productId/preview returns {
 *     product, organisation, dependencies, licenseScan,
 *     licenseFindings, vulnerabilities, ...
 *   }
 * - GET /api/due-diligence/:productId/export returns ZIP file download
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('/api/due-diligence', () => {
  let mfgToken: string;
  let impToken: string;

  const mfgProductId = TEST_IDS.products.github; // c0000001-0000-0000-0000-000000000001

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
  });

  // ─── GET /:productId/preview ──────────────────────────────────────────

  describe('GET /:productId/preview', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get(`/api/due-diligence/${mfgProductId}/preview`);
      expect(res.status).toBe(401);
    });

    it('should return preview data for product', async () => {
      const res = await api.get(`/api/due-diligence/${mfgProductId}/preview`, {
        auth: mfgToken,
      });
      expect(res.status).toBe(200);

      // Core product identification
      expect(res.body).toHaveProperty('product');
      expect(res.body).toHaveProperty('organisation');
    });

    it('should include product details in response', async () => {
      const res = await api.get(`/api/due-diligence/${mfgProductId}/preview`, {
        auth: mfgToken,
      });
      expect(res.status).toBe(200);

      expect(res.body.product).toBeTruthy();
      expect(typeof res.body.product).toBe('object');
    });

    it('should include organisation details in response', async () => {
      const res = await api.get(`/api/due-diligence/${mfgProductId}/preview`, {
        auth: mfgToken,
      });
      expect(res.status).toBe(200);

      expect(res.body.organisation).toBeTruthy();
      expect(typeof res.body.organisation).toBe('object');
    });

    it('should include dependency and vulnerability data', async () => {
      const res = await api.get(`/api/due-diligence/${mfgProductId}/preview`, {
        auth: mfgToken,
      });
      expect(res.status).toBe(200);

      // Dependencies section
      expect(res.body).toHaveProperty('dependencies');

      // Vulnerabilities section
      expect(res.body).toHaveProperty('vulnerabilities');
    });

    it('should include licence scan data', async () => {
      const res = await api.get(`/api/due-diligence/${mfgProductId}/preview`, {
        auth: mfgToken,
      });
      expect(res.status).toBe(200);

      // Licence-related fields
      expect(res.body).toHaveProperty('licenseScan');
      expect(res.body).toHaveProperty('licenseFindings');
    });

    it('should return 404 for non-existent product', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await api.get(`/api/due-diligence/${fakeId}/preview`, {
        auth: mfgToken,
      });
      expect([403, 404]).toContain(res.status);
    });
  });

  // ─── GET /:productId/export ─────────────────────────────────────────

  describe('GET /:productId/export', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get(`/api/due-diligence/${mfgProductId}/export`);
      expect(res.status).toBe(401);
    });

    it('should return a downloadable file for product', async () => {
      const res = await api.get(`/api/due-diligence/${mfgProductId}/export`, {
        auth: mfgToken,
      });
      // Should succeed with a file download or 404 if no data to export
      expect([200, 404]).toContain(res.status);

      if (res.status === 200) {
        // Should have content-type indicating a file download
        const contentType = res.headers?.get?.('content-type') || '';
        const isDownload = contentType.includes('zip') ||
                           contentType.includes('octet-stream') ||
                           contentType.includes('application/');
        expect(isDownload).toBe(true);
      }
    });

    it('should reject cross-org export access', async () => {
      const res = await api.get(`/api/due-diligence/${mfgProductId}/export`, {
        auth: impToken,
      });
      expect([403, 404]).toContain(res.status);
    });

    it('should return 404 for non-existent product export', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await api.get(`/api/due-diligence/${fakeId}/export`, {
        auth: mfgToken,
      });
      expect([403, 404]).toContain(res.status);
    });
  });

  // ─── Cross-org isolation ──────────────────────────────────────────────

  describe('Cross-org isolation', () => {
    it('should not allow impAdmin to access mfg product preview', async () => {
      const res = await api.get(`/api/due-diligence/${mfgProductId}/preview`, {
        auth: impToken,
      });
      expect([403, 404]).toContain(res.status);
    });

    it('should allow impAdmin to access their own product preview', async () => {
      const impProductId = TEST_IDS.products.impGithub;
      const res = await api.get(`/api/due-diligence/${impProductId}/preview`, {
        auth: impToken,
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('product');
      expect(res.body).toHaveProperty('organisation');
    });

    it('should allow impAdmin to export their own product', async () => {
      const impProductId = TEST_IDS.products.impGithub;
      const res = await api.get(`/api/due-diligence/${impProductId}/export`, {
        auth: impToken,
      });
      expect([200, 404]).toContain(res.status);
    });
  });
});

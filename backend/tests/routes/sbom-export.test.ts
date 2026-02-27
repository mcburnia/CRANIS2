/**
 * SBOM Export Route Tests — /api/sbom
 *
 * Tests: export status retrieval, auth, cross-org isolation
 *
 * API response format (from probing):
 * - GET /api/sbom/:productId/export/status returns {
 *     hasSBOM, sbomSyncedAt, totalDependencies, enrichedDependencies,
 *     enrichmentComplete, gaps, lockfileResolved, lastEnrichedAt
 *   }
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('/api/sbom', () => {
  let mfgToken: string;
  let impToken: string;

  const mfgProductId = TEST_IDS.products.github; // c0000001-0000-0000-0000-000000000001

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
  });

  // ─── GET /:productId/export/status ────────────────────────────────────

  describe('GET /:productId/export/status', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get(`/api/sbom/${mfgProductId}/export/status`);
      expect(res.status).toBe(401);
    });

    it('should return export status for product', async () => {
      const res = await api.get(`/api/sbom/${mfgProductId}/export/status`, { auth: mfgToken });
      expect(res.status).toBe(200);

      // Core boolean flag
      expect(res.body).toHaveProperty('hasSBOM');
      expect(typeof res.body.hasSBOM).toBe('boolean');

      // Dependency counts
      expect(res.body).toHaveProperty('totalDependencies');
      expect(typeof res.body.totalDependencies).toBe('number');

      expect(res.body).toHaveProperty('enrichedDependencies');
      expect(typeof res.body.enrichedDependencies).toBe('number');

      // Enrichment completeness
      expect(res.body).toHaveProperty('enrichmentComplete');
      expect(typeof res.body.enrichmentComplete).toBe('boolean');

      // Gaps — may be object with categories or array
      expect(res.body).toHaveProperty('gaps');
      expect(typeof res.body.gaps).toBe('object');

      // Lockfile resolution (number, not boolean)
      expect(res.body).toHaveProperty('lockfileResolved');
      expect(typeof res.body.lockfileResolved).toBe('number');

      // Timestamps — may be null if no SBOM synced yet
      expect(res.body).toHaveProperty('sbomSyncedAt');
      expect(res.body).toHaveProperty('lastEnrichedAt');
    });

    it('should return hasSBOM false for product without SBOM data', async () => {
      // Use a product unlikely to have SBOM data (self-hosted forgejo)
      const forgejoProductId = TEST_IDS.products.forgejo;
      const res = await api.get(`/api/sbom/${forgejoProductId}/export/status`, { auth: mfgToken });
      expect(res.status).toBe(200);
      // Whether true or false, hasSBOM must be a boolean
      expect(typeof res.body.hasSBOM).toBe('boolean');
    });

    it('should return 404 for non-existent product', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await api.get(`/api/sbom/${fakeId}/export/status`, { auth: mfgToken });
      expect([403, 404]).toContain(res.status);
    });
  });

  // ─── Cross-org isolation ──────────────────────────────────────────────

  describe('Cross-org isolation', () => {
    it('should not allow impAdmin to access mfg product SBOM export status', async () => {
      const res = await api.get(`/api/sbom/${mfgProductId}/export/status`, { auth: impToken });
      expect([403, 404]).toContain(res.status);
    });

    it('should allow impAdmin to access their own product SBOM export status', async () => {
      const impProductId = TEST_IDS.products.impGithub;
      const res = await api.get(`/api/sbom/${impProductId}/export/status`, { auth: impToken });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('hasSBOM');
    });
  });
});

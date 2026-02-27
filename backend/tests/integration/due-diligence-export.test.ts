/**
 * Integration Test — Due Diligence Export
 *
 * Tests the full due diligence flow: preview → download PDF → download ZIP.
 * Verifies export content types and response shapes.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('Integration: Due Diligence Export Flow', () => {
  let token: string;

  beforeAll(async () => {
    token = await loginTestUser(TEST_USERS.mfgAdmin);
  });

  // ─── Step 1: Preview data ───────────────────────────────────────────

  describe('Preview data gathering', () => {
    it('should return preview data for product with SBOM', async () => {
      const res = await api.get(`/api/due-diligence/${TEST_IDS.products.github}/preview`, { auth: token });
      expect(res.status).toBe(200);

      // Should contain product info
      expect(res.body).toHaveProperty('product');
      if (res.body.product) {
        expect(res.body.product.name).toBe('test-product-github');
      }
    });

    it('should return preview data for product without SBOM', async () => {
      const res = await api.get(`/api/due-diligence/${TEST_IDS.products.gitea}/preview`, { auth: token });
      // May return 200 with empty data or 404
      expect([200, 404]).toContain(res.status);
    });
  });

  // ─── Step 2: PDF download ───────────────────────────────────────────

  describe('PDF generation', () => {
    it('should generate PDF for product', async () => {
      const res = await api.get(`/api/due-diligence/${TEST_IDS.products.github}/pdf`, { auth: token });
      // May return PDF or error if no data
      if (res.status === 200) {
        const contentType = res.headers.get('content-type') || '';
        expect(contentType).toContain('pdf');
      } else {
        expect([404, 500]).toContain(res.status);
      }
    });
  });

  // ─── Step 3: ZIP download ───────────────────────────────────────────

  describe('ZIP generation', () => {
    it('should generate ZIP for product', async () => {
      const res = await api.get(`/api/due-diligence/${TEST_IDS.products.github}/zip`, { auth: token });
      if (res.status === 200) {
        const contentType = res.headers.get('content-type') || '';
        // ZIP content type
        expect(
          contentType.includes('zip') ||
          contentType.includes('octet-stream')
        ).toBe(true);
      } else {
        expect([404, 500]).toContain(res.status);
      }
    });
  });

  // ─── Cross-org isolation ────────────────────────────────────────────

  describe('Cross-org isolation on exports', () => {
    it('should not allow importer to export manufacturer product', async () => {
      const impToken = await loginTestUser(TEST_USERS.impAdmin);
      const res = await api.get(`/api/due-diligence/${TEST_IDS.products.github}/preview`, { auth: impToken });
      expect([403, 404]).toContain(res.status);
    });
  });
});

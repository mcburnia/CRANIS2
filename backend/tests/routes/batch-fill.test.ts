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
 * Batch Fill Wizard Route Tests
 *
 * Tests for:
 *   POST /api/technical-file/:productId/batch-fill  — deterministic auto-fill of tech file sections
 *   POST /api/obligations/:productId/batch-evidence — deterministic evidence notes for obligations
 *
 * Both endpoints use only platform data (no AI) and apply non-destructive merges
 * (never overwrite existing content).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginTestUser, TEST_USERS, getAppPool } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

const PRODUCT_ID = TEST_IDS.products.github;
const IMP_PRODUCT_ID = TEST_IDS.products.impGithub;

describe('Batch Fill Wizard', () => {
  let mfgToken: string;
  let impToken: string;

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
  });

  // Clean up any sections/obligations we may have modified
  afterAll(async () => {
    const pool = getAppPool();
    // Reset tech file sections we may have auto-filled back to empty
    await pool.query(
      `UPDATE technical_file_sections SET content = '{}', status = 'not_started'
       WHERE product_id = $1 AND section_key IN ('product_description', 'vulnerability_handling', 'standards_applied', 'test_reports')`,
      [PRODUCT_ID]
    );
    // Clear any batch-generated obligation notes
    await pool.query(
      `UPDATE obligations SET notes = NULL
       WHERE product_id = $1 AND org_id = $2 AND notes LIKE '%batch evidence wizard%'`,
      [PRODUCT_ID, TEST_IDS.orgs.mfgActive]
    );
  });

  // ═══════════════════════════════════════════════════════
  // POST /api/technical-file/:productId/batch-fill
  // ═══════════════════════════════════════════════════════

  describe('POST /api/technical-file/:productId/batch-fill', () => {

    // ─── Authentication ────────────────────────────────────

    it('should reject unauthenticated request with 401', async () => {
      const res = await api.post(`/api/technical-file/${PRODUCT_ID}/batch-fill`);
      expect(res.status).toBe(401);
    });

    // ─── Cross-org isolation ───────────────────────────────

    it('should return 404 for product belonging to another org', async () => {
      const res = await api.post(`/api/technical-file/${IMP_PRODUCT_ID}/batch-fill`, {
        auth: mfgToken,
      });
      expect(res.status).toBe(404);
    });

    // ─── Non-existent product ──────────────────────────────

    it('should return 404 for non-existent product', async () => {
      const res = await api.post('/api/technical-file/00000000-0000-0000-0000-000000000000/batch-fill', {
        auth: mfgToken,
      });
      expect(res.status).toBe(404);
    });

    // ─── Response shape ────────────────────────────────────

    it('should return 200 with results array, summary, and progress', async () => {
      const res = await api.post(`/api/technical-file/${PRODUCT_ID}/batch-fill`, {
        auth: mfgToken,
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('results');
      expect(Array.isArray(res.body.results)).toBe(true);
      expect(res.body).toHaveProperty('summary');
      expect(res.body.summary).toHaveProperty('sectionsFilled');
      expect(res.body.summary).toHaveProperty('totalFieldsPopulated');
      expect(res.body.summary).toHaveProperty('sectionsSkipped');
      expect(res.body).toHaveProperty('progress');
      expect(res.body.progress).toHaveProperty('total');
    });

    it('should include sectionKey and action on each result entry', async () => {
      const res = await api.post(`/api/technical-file/${PRODUCT_ID}/batch-fill`, {
        auth: mfgToken,
      });
      expect(res.status).toBe(200);
      for (const r of res.body.results) {
        expect(r).toHaveProperty('sectionKey');
        expect(typeof r.sectionKey).toBe('string');
        expect(r).toHaveProperty('action');
        expect(typeof r.action).toBe('string');
        expect(r).toHaveProperty('fieldsPopulated');
        expect(typeof r.fieldsPopulated).toBe('number');
      }
    });

    it('should cover all four auto-fill eligible sections', async () => {
      const res = await api.post(`/api/technical-file/${PRODUCT_ID}/batch-fill`, {
        auth: mfgToken,
      });
      expect(res.status).toBe(200);
      const keys = res.body.results.map((r: any) => r.sectionKey);
      expect(keys).toContain('product_description');
      expect(keys).toContain('vulnerability_handling');
      expect(keys).toContain('standards_applied');
      expect(keys).toContain('test_reports');
    });

    // ─── Exclude sections ──────────────────────────────────

    it('should skip sections listed in excludeSections', async () => {
      const res = await api.post(`/api/technical-file/${PRODUCT_ID}/batch-fill`, {
        auth: mfgToken,
        body: { excludeSections: ['product_description', 'standards_applied'] },
      });
      expect(res.status).toBe(200);
      const skipped = res.body.results.filter((r: any) => r.action === 'skipped');
      const skippedKeys = skipped.map((r: any) => r.sectionKey);
      expect(skippedKeys).toContain('product_description');
      expect(skippedKeys).toContain('standards_applied');
    });

    // ─── Non-destructive behaviour ─────────────────────────

    it('should not overwrite sections that already have content', async () => {
      const pool = getAppPool();

      // Pre-populate product_description with existing content
      await pool.query(
        `UPDATE technical_file_sections
         SET content = $1, status = 'in_progress'
         WHERE product_id = $2 AND section_key = 'product_description'`,
        [JSON.stringify({ fields: { intended_purpose: 'Existing purpose text' } }), PRODUCT_ID]
      );

      const res = await api.post(`/api/technical-file/${PRODUCT_ID}/batch-fill`, {
        auth: mfgToken,
      });
      expect(res.status).toBe(200);

      // Verify the existing field was preserved
      const sectionResult = await pool.query(
        `SELECT content FROM technical_file_sections WHERE product_id = $1 AND section_key = 'product_description'`,
        [PRODUCT_ID]
      );
      const content = typeof sectionResult.rows[0].content === 'string'
        ? JSON.parse(sectionResult.rows[0].content)
        : sectionResult.rows[0].content;
      expect(content.fields.intended_purpose).toBe('Existing purpose text');

      // Clean up
      await pool.query(
        `UPDATE technical_file_sections SET content = '{}', status = 'not_started'
         WHERE product_id = $1 AND section_key = 'product_description'`,
        [PRODUCT_ID]
      );
    });

    // ─── Second run idempotence ────────────────────────────

    it('should report no_empty_fields on second run (idempotent)', async () => {
      // First run: fills empty sections
      const first = await api.post(`/api/technical-file/${PRODUCT_ID}/batch-fill`, {
        auth: mfgToken,
      });
      expect(first.status).toBe(200);

      // Second run: all fields already populated
      const second = await api.post(`/api/technical-file/${PRODUCT_ID}/batch-fill`, {
        auth: mfgToken,
      });
      expect(second.status).toBe(200);

      // Field-based sections should report no_empty_fields
      const fieldResults = second.body.results.filter(
        (r: any) => ['product_description', 'vulnerability_handling'].includes(r.sectionKey)
      );
      for (const r of fieldResults) {
        expect(r.fieldsPopulated).toBe(0);
      }

      // Clean up
      const pool = getAppPool();
      await pool.query(
        `UPDATE technical_file_sections SET content = '{}', status = 'not_started'
         WHERE product_id = $1 AND section_key IN ('product_description', 'vulnerability_handling', 'standards_applied', 'test_reports')`,
        [PRODUCT_ID]
      );
    });
  });

  // ═══════════════════════════════════════════════════════
  // POST /api/obligations/:productId/batch-evidence
  // ═══════════════════════════════════════════════════════

  describe('POST /api/obligations/:productId/batch-evidence', () => {

    // ─── Authentication ────────────────────────────────────

    it('should reject unauthenticated request with 401', async () => {
      const res = await api.post(`/api/obligations/${PRODUCT_ID}/batch-evidence`);
      expect(res.status).toBe(401);
    });

    // ─── Cross-org isolation ───────────────────────────────

    it('should return 404 for product belonging to another org', async () => {
      const res = await api.post(`/api/obligations/${IMP_PRODUCT_ID}/batch-evidence`, {
        auth: mfgToken,
      });
      expect(res.status).toBe(404);
    });

    // ─── Non-existent product ──────────────────────────────

    it('should return 404 for non-existent product', async () => {
      const res = await api.post('/api/obligations/00000000-0000-0000-0000-000000000000/batch-evidence', {
        auth: mfgToken,
      });
      expect(res.status).toBe(404);
    });

    // ─── Response shape ────────────────────────────────────

    it('should return 200 with results array and summary', async () => {
      const res = await api.post(`/api/obligations/${PRODUCT_ID}/batch-evidence`, {
        auth: mfgToken,
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('results');
      expect(Array.isArray(res.body.results)).toBe(true);
      expect(res.body).toHaveProperty('summary');
      expect(res.body.summary).toHaveProperty('obligationsFilled');
      expect(typeof res.body.summary.obligationsFilled).toBe('number');
      expect(res.body.summary).toHaveProperty('obligationsSkipped');
      expect(typeof res.body.summary.obligationsSkipped).toBe('number');
    });

    it('should include obligationKey and action on each result entry', async () => {
      const res = await api.post(`/api/obligations/${PRODUCT_ID}/batch-evidence`, {
        auth: mfgToken,
      });
      expect(res.status).toBe(200);
      for (const r of res.body.results) {
        expect(r).toHaveProperty('obligationKey');
        expect(typeof r.obligationKey).toBe('string');
        expect(r).toHaveProperty('action');
        expect(typeof r.action).toBe('string');
      }
    });

    // ─── Exclude keys ──────────────────────────────────────

    it('should skip obligations listed in excludeKeys', async () => {
      const res = await api.post(`/api/obligations/${PRODUCT_ID}/batch-evidence`, {
        auth: mfgToken,
        body: { excludeKeys: ['art_13', 'art_14'] },
      });
      expect(res.status).toBe(200);
      const skipped = res.body.results.filter((r: any) => r.action === 'skipped');
      const skippedKeys = skipped.map((r: any) => r.obligationKey);
      expect(skippedKeys).toContain('art_13');
      expect(skippedKeys).toContain('art_14');
    });

    // ─── Non-destructive behaviour ─────────────────────────

    it('should not overwrite obligations that already have notes', async () => {
      const pool = getAppPool();

      // Pre-populate an obligation with existing notes
      await pool.query(
        `UPDATE obligations SET notes = 'Existing evidence notes — do not overwrite'
         WHERE product_id = $1 AND org_id = $2 AND obligation_key = 'art_13'`,
        [PRODUCT_ID, TEST_IDS.orgs.mfgActive]
      );

      const res = await api.post(`/api/obligations/${PRODUCT_ID}/batch-evidence`, {
        auth: mfgToken,
      });
      expect(res.status).toBe(200);

      // The art_13 result should show 'has_notes', not 'filled'
      const art13 = res.body.results.find((r: any) => r.obligationKey === 'art_13');
      expect(art13).toBeDefined();
      expect(art13.action).toBe('has_notes');

      // Verify notes were not overwritten
      const noteResult = await pool.query(
        `SELECT notes FROM obligations WHERE product_id = $1 AND org_id = $2 AND obligation_key = 'art_13'`,
        [PRODUCT_ID, TEST_IDS.orgs.mfgActive]
      );
      expect(noteResult.rows[0]?.notes).toBe('Existing evidence notes — do not overwrite');

      // Clean up
      await pool.query(
        `UPDATE obligations SET notes = NULL
         WHERE product_id = $1 AND org_id = $2 AND obligation_key = 'art_13'`,
        [PRODUCT_ID, TEST_IDS.orgs.mfgActive]
      );
    });

    // ─── Second run idempotence ────────────────────────────

    it('should report has_notes on second run (idempotent)', async () => {
      // First run: generates evidence
      const first = await api.post(`/api/obligations/${PRODUCT_ID}/batch-evidence`, {
        auth: mfgToken,
      });
      expect(first.status).toBe(200);
      const filledCount = first.body.summary.obligationsFilled;

      // Second run: all obligations already have notes
      const second = await api.post(`/api/obligations/${PRODUCT_ID}/batch-evidence`, {
        auth: mfgToken,
      });
      expect(second.status).toBe(200);

      // Everything that was filled should now report has_notes
      const filledOnSecond = second.body.summary.obligationsFilled;
      expect(filledOnSecond).toBe(0);

      // Clean up
      const pool = getAppPool();
      await pool.query(
        `UPDATE obligations SET notes = NULL
         WHERE product_id = $1 AND org_id = $2`,
        [PRODUCT_ID, TEST_IDS.orgs.mfgActive]
      );
    });
  });
});

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
 * Supplier Due Diligence Questionnaire — Integration Tests
 *
 * Tests the supplier questionnaire API endpoints.
 * Does NOT test AI generation (Claude API) — only CRUD, auth, export, and org isolation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  api,
  getTestToken,
  getAppPool,
  getNeo4jSession,
  TEST_USERS,
  TEST_PASSWORD,
} from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

const MFG_PRODUCT = TEST_IDS.products.github;
const MFG_ORG = TEST_IDS.orgs.mfgActive;
const MFG_USER = TEST_IDS.users.mfgAdmin;
const IMP_PRODUCT = TEST_IDS.products.impGithub;

describe('/api/products/:productId/supplier-questionnaires', () => {
  let mfgToken: string;
  let impToken: string;
  const seededQuestionnaireIds: string[] = [];

  beforeAll(async () => {
    mfgToken = await getTestToken(TEST_USERS.mfgAdmin);
    impToken = await getTestToken(TEST_USERS.impAdmin);

    // Seed a test questionnaire directly in the DB
    const pool = getAppPool();
    const result = await pool.query(`
      INSERT INTO supplier_questionnaires (
        org_id, product_id, dependency_name, dependency_version, dependency_purl,
        dependency_ecosystem, dependency_license, dependency_supplier,
        risk_flags, questionnaire_content, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'generated', $11)
      RETURNING id
    `, [
      MFG_ORG,
      MFG_PRODUCT,
      'test-risky-dep',
      '1.0.0',
      'pkg:npm/test-risky-dep@1.0.0',
      'npm',
      'GPL-3.0',
      null,
      JSON.stringify([{ type: 'copyleft_license', detail: 'Copyleft licence: GPL-3.0' }]),
      JSON.stringify({
        summary: 'Test dependency with copyleft licence requires due diligence.',
        riskAssessment: 'GPL-3.0 copyleft obligations may conflict with proprietary distribution.',
        questions: [
          {
            id: 'q1',
            category: 'licence_compliance',
            question: 'Does the component require derivative works to be distributed under GPL-3.0?',
            rationale: 'CRA compliance requires understanding licence obligations for distributed software.',
            craReference: 'Art. 13(5)',
          },
          {
            id: 'q2',
            category: 'vulnerability_management',
            question: 'What is your process for disclosing and patching security vulnerabilities?',
            rationale: 'CRA Art. 13(6) requires documented vulnerability handling.',
            craReference: 'Art. 13(6)',
          },
        ],
        recommendedActions: ['Review GPL-3.0 compatibility with distribution model', 'Document licence compliance evidence'],
      }),
      MFG_USER,
    ]);
    seededQuestionnaireIds.push(result.rows[0].id);

    // Seed a second questionnaire
    const result2 = await pool.query(`
      INSERT INTO supplier_questionnaires (
        org_id, product_id, dependency_name, dependency_version,
        dependency_ecosystem, dependency_license,
        risk_flags, questionnaire_content, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'sent', $9)
      RETURNING id
    `, [
      MFG_ORG,
      MFG_PRODUCT,
      'vulnerable-lib',
      '2.3.1',
      'npm',
      'MIT',
      JSON.stringify([{ type: 'high_severity_vuln', detail: '2 critical vulnerabilities' }]),
      JSON.stringify({
        summary: 'Library with known critical vulnerabilities.',
        riskAssessment: 'Critical vulnerabilities pose immediate supply chain risk.',
        questions: [
          {
            id: 'q1',
            category: 'security_practices',
            question: 'What is your security development lifecycle?',
            rationale: 'Understanding supplier security practices per CRA Art. 13(3).',
            craReference: 'Art. 13(3)',
          },
        ],
        recommendedActions: ['Upgrade to patched version', 'Monitor for new CVEs'],
      }),
      MFG_USER,
    ]);
    seededQuestionnaireIds.push(result2.rows[0].id);
  });

  afterAll(async () => {
    const pool = getAppPool();
    if (seededQuestionnaireIds.length > 0) {
      await pool.query(
        `DELETE FROM supplier_questionnaires WHERE id = ANY($1)`,
        [seededQuestionnaireIds]
      );
    }
  });

  // ── Auth ──

  describe('Authentication', () => {
    it('should reject unauthenticated GET', async () => {
      const res = await api.get(`/api/products/${MFG_PRODUCT}/supplier-questionnaires`);
      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated POST', async () => {
      const res = await api.post(`/api/products/${MFG_PRODUCT}/supplier-questionnaires/generate`);
      expect(res.status).toBe(401);
    });
  });

  // ── List ──

  describe('GET /:productId/supplier-questionnaires', () => {
    it('should return questionnaires for product', async () => {
      const res = await api.get(`/api/products/${MFG_PRODUCT}/supplier-questionnaires`, {
        auth: mfgToken,
      });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);

      const q = res.body.find((q: any) => q.dependencyName === 'test-risky-dep');
      expect(q).toBeDefined();
      expect(q.dependencyVersion).toBe('1.0.0');
      expect(q.dependencyEcosystem).toBe('npm');
      expect(q.dependencyLicense).toBe('GPL-3.0');
      expect(q.status).toBe('generated');
      expect(q.riskFlags).toHaveLength(1);
      expect(q.riskFlags[0].type).toBe('copyleft_license');
    });

    it('should return questionnaire with full content structure', async () => {
      const res = await api.get(`/api/products/${MFG_PRODUCT}/supplier-questionnaires`, {
        auth: mfgToken,
      });
      const q = res.body.find((q: any) => q.dependencyName === 'test-risky-dep');
      expect(q.questionnaireContent).toBeDefined();
      expect(q.questionnaireContent.summary).toBeTruthy();
      expect(q.questionnaireContent.riskAssessment).toBeTruthy();
      expect(q.questionnaireContent.questions).toHaveLength(2);
      expect(q.questionnaireContent.questions[0].category).toBe('licence_compliance');
      expect(q.questionnaireContent.questions[0].craReference).toBe('Art. 13(5)');
      expect(q.questionnaireContent.recommendedActions).toHaveLength(2);
    });

    it('should return 404 for non-existent product', async () => {
      const res = await api.get('/api/products/non-existent-product/supplier-questionnaires', {
        auth: mfgToken,
      });
      expect(res.status).toBe(404);
    });
  });

  // ── Get Single ──

  describe('GET /:productId/supplier-questionnaires/:id', () => {
    it('should return a single questionnaire', async () => {
      const res = await api.get(
        `/api/products/${MFG_PRODUCT}/supplier-questionnaires/${seededQuestionnaireIds[0]}`,
        { auth: mfgToken }
      );
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(seededQuestionnaireIds[0]);
      expect(res.body.dependencyName).toBe('test-risky-dep');
    });

    it('should return 404 for non-existent questionnaire', async () => {
      const res = await api.get(
        `/api/products/${MFG_PRODUCT}/supplier-questionnaires/00000000-0000-0000-0000-000000000000`,
        { auth: mfgToken }
      );
      expect(res.status).toBe(404);
    });
  });

  // ── Status Update ──

  describe('PATCH /:productId/supplier-questionnaires/:id/status', () => {
    it('should update status to sent', async () => {
      const res = await api.patch(
        `/api/products/${MFG_PRODUCT}/supplier-questionnaires/${seededQuestionnaireIds[0]}/status`,
        { auth: mfgToken, body: { status: 'sent' } }
      );
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('sent');
    });

    it('should update status to responded', async () => {
      const res = await api.patch(
        `/api/products/${MFG_PRODUCT}/supplier-questionnaires/${seededQuestionnaireIds[0]}/status`,
        { auth: mfgToken, body: { status: 'responded' } }
      );
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('responded');
    });

    it('should update status to reviewed', async () => {
      const res = await api.patch(
        `/api/products/${MFG_PRODUCT}/supplier-questionnaires/${seededQuestionnaireIds[0]}/status`,
        { auth: mfgToken, body: { status: 'reviewed' } }
      );
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('reviewed');
    });

    it('should reject invalid status', async () => {
      const res = await api.patch(
        `/api/products/${MFG_PRODUCT}/supplier-questionnaires/${seededQuestionnaireIds[0]}/status`,
        { auth: mfgToken, body: { status: 'invalid' } }
      );
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent questionnaire', async () => {
      const res = await api.patch(
        `/api/products/${MFG_PRODUCT}/supplier-questionnaires/00000000-0000-0000-0000-000000000000/status`,
        { auth: mfgToken, body: { status: 'sent' } }
      );
      expect(res.status).toBe(404);
    });
  });

  // ── Markdown Export ──

  describe('GET /:productId/supplier-questionnaires/export/pdf', () => {
    it('should return Markdown', async () => {
      const res = await api.get(
        `/api/products/${MFG_PRODUCT}/supplier-questionnaires/export/pdf`,
        { auth: mfgToken }
      );
      expect(res.status).toBe(200);
      const body = typeof res.body === 'string' ? res.body : Buffer.from(res.body).toString('utf-8');
      expect(body).toMatch(/^#/);
    });
  });

  // ── CSV Export ──

  describe('GET /:productId/supplier-questionnaires/export/csv', () => {
    it('should return CSV with headers', async () => {
      const res = await api.get(
        `/api/products/${MFG_PRODUCT}/supplier-questionnaires/export/csv`,
        { auth: mfgToken }
      );
      expect(res.status).toBe(200);
      expect(typeof res.body).toBe('string');
      const lines = res.body.split('\n');
      expect(lines[0]).toContain('Dependency');
      expect(lines[0]).toContain('Risk Flags');
      expect(lines[0]).toContain('Question');
      expect(lines[0]).toContain('CRA Reference');
      // Should have data rows
      expect(lines.length).toBeGreaterThan(1);
    });

    it('should include questionnaire data in CSV', async () => {
      const res = await api.get(
        `/api/products/${MFG_PRODUCT}/supplier-questionnaires/export/csv`,
        { auth: mfgToken }
      );
      expect(res.body).toContain('test-risky-dep');
      expect(res.body).toContain('GPL-3.0');
      expect(res.body).toContain('Art. 13(5)');
    });
  });

  // ── Cross-org isolation ──

  describe('Cross-org isolation', () => {
    it('should not allow importer to view manufacturer questionnaires', async () => {
      const res = await api.get(`/api/products/${MFG_PRODUCT}/supplier-questionnaires`, {
        auth: impToken,
      });
      expect(res.status).toBe(404);
    });

    it('should not allow importer to update manufacturer questionnaire status', async () => {
      const res = await api.patch(
        `/api/products/${MFG_PRODUCT}/supplier-questionnaires/${seededQuestionnaireIds[0]}/status`,
        { auth: impToken, body: { status: 'reviewed' } }
      );
      // Will get 404 because product check fails for wrong org
      expect(res.status).toBe(404);
    });

    it('should not allow importer to export manufacturer questionnaires', async () => {
      const res = await api.get(
        `/api/products/${MFG_PRODUCT}/supplier-questionnaires/export/pdf`,
        { auth: impToken }
      );
      expect(res.status).toBe(404);
    });
  });
});

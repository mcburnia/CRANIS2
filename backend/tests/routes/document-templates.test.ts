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
 * Document Templates Route Tests — /api/document-templates
 *
 * Tests: list templates, download raw template, generate product-specific
 * template, auth enforcement
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('/api/document-templates', () => {
  let adminToken: string;
  let impToken: string;

  const productId = TEST_IDS.products.github;

  beforeAll(async () => {
    adminToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
  });

  // ─── GET /api/document-templates ────────────────────────────────────

  describe('GET /api/document-templates', () => {
    it('should reject unauthenticated request', async () => {
      const res = await api.get('/api/document-templates');
      expect(res.status).toBe(401);
    });

    it('should return template catalogue', async () => {
      const res = await api.get('/api/document-templates', { auth: adminToken });
      expect(res.status).toBe(200);
      const templates = Array.isArray(res.body) ? res.body : res.body.templates;
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThanOrEqual(1);
    });

    it('should have expected template fields', async () => {
      const res = await api.get('/api/document-templates', { auth: adminToken });
      const templates = Array.isArray(res.body) ? res.body : res.body.templates;
      if (templates.length > 0) {
        const t = templates[0];
        expect(t).toHaveProperty('id');
        expect(t).toHaveProperty('title');
        expect(t).toHaveProperty('description');
        expect(t).toHaveProperty('craArticle');
      }
    });
  });

  // ─── GET /api/document-templates/:id/download ───────────────────────

  describe('GET /api/document-templates/:id/download', () => {
    let templateId: string;

    beforeAll(async () => {
      const res = await api.get('/api/document-templates', { auth: adminToken });
      const templates = Array.isArray(res.body) ? res.body : res.body.templates;
      if (templates.length > 0) {
        templateId = templates[0].id;
      }
    });

    it('should reject unauthenticated request', async () => {
      if (!templateId) return;
      const res = await api.get(`/api/document-templates/${templateId}/download`);
      expect(res.status).toBe(401);
    });

    it('should return raw template content', async () => {
      if (!templateId) return;
      const res = await api.get(`/api/document-templates/${templateId}/download`, { auth: adminToken });
      expect(res.status).toBe(200);
      // Template content should be text/markdown or similar
      expect(res.body).toBeDefined();
    });

    it('should return 404 for non-existent template', async () => {
      const res = await api.get('/api/document-templates/non-existent-id/download', { auth: adminToken });
      expect([404, 400]).toContain(res.status);
    });
  });

  // ─── GET /api/document-templates/:id/generate ───────────────────────

  describe('GET /api/document-templates/:id/generate', () => {
    let templateId: string;

    beforeAll(async () => {
      const res = await api.get('/api/document-templates', { auth: adminToken });
      const templates = Array.isArray(res.body) ? res.body : res.body.templates;
      if (templates.length > 0) {
        templateId = templates[0].id;
      }
    });

    it('should reject unauthenticated request', async () => {
      if (!templateId) return;
      const res = await api.get(`/api/document-templates/${templateId}/generate?productId=${productId}`);
      expect(res.status).toBe(401);
    });

    it('should generate product-specific template', async () => {
      if (!templateId) return;
      const res = await api.get(
        `/api/document-templates/${templateId}/generate?productId=${productId}`,
        { auth: adminToken }
      );
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });

    it('should reject cross-org product template generation', async () => {
      if (!templateId) return;
      // impToken trying to generate template for mfg product
      const res = await api.get(
        `/api/document-templates/${templateId}/generate?productId=${productId}`,
        { auth: impToken }
      );
      expect([403, 404]).toContain(res.status);
    });

    it('should reject generation without productId', async () => {
      if (!templateId) return;
      const res = await api.get(`/api/document-templates/${templateId}/generate`, { auth: adminToken });
      expect([400, 422]).toContain(res.status);
    });
  });
});

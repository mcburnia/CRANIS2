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
 * Category Recommendation Route Tests — /api/products/:productId/category-recommendation
 *
 * Tests: deterministic scoring, recommendation history, user actions (accept/override/dismiss),
 * auth guards, validation, cross-org isolation.
 *
 * NOTE: Actual AI augmentation (Claude API) is NOT tested here — it requires ANTHROPIC_API_KEY
 * and would be slow/flaky. We test the deterministic scoring path and API contract only.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginTestUser, TEST_USERS, getAppPool, getNeo4jSession } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

const MFG_PRODUCT = TEST_IDS.products.github;
const IMP_PRODUCT = TEST_IDS.products.impGithub;

describe('/api/products/:productId/category-recommendation', () => {
  let mfgToken: string;
  let impToken: string;
  let emptyToken: string;
  let recommendationId: string;

  beforeAll(async () => {
    mfgToken = await loginTestUser(TEST_USERS.mfgAdmin);
    impToken = await loginTestUser(TEST_USERS.impAdmin);
    emptyToken = await loginTestUser(TEST_USERS.emptyAdmin);
  });

  // Clean up any recommendations created during tests
  afterAll(async () => {
    const pool = getAppPool();
    await pool.query(
      `DELETE FROM recommendation_access_log WHERE recommendation_id IN (
        SELECT id FROM category_recommendations WHERE product_id = $1
      )`,
      [MFG_PRODUCT]
    );
    await pool.query(
      `DELETE FROM category_recommendations WHERE product_id = $1`,
      [MFG_PRODUCT]
    );
  });

  // ═══════════════════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════════════════

  describe('Authentication', () => {
    it('should reject unauthenticated POST /category-recommendation', async () => {
      const res = await api.post(`/api/products/${MFG_PRODUCT}/category-recommendation`, {
        body: { attributeValues: {} },
      });
      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated GET /category-recommendation-history', async () => {
      const res = await api.get(`/api/products/${MFG_PRODUCT}/category-recommendation-history`);
      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated POST /action', async () => {
      const res = await api.post(
        `/api/products/${MFG_PRODUCT}/category-recommendation/fake-id/action`,
        { body: { action: 'accepted' } }
      );
      expect(res.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════
  // POST — Get recommendation
  // ═══════════════════════════════════════════════════════

  describe('POST /:productId/category-recommendation', () => {
    it('should return a deterministic recommendation with default attribute values', async () => {
      const res = await api.post(`/api/products/${MFG_PRODUCT}/category-recommendation`, {
        auth: mfgToken,
        body: { attributeValues: {} },
      });
      expect(res.status).toBe(200);

      // Response shape
      expect(res.body).toHaveProperty('recommendation');
      expect(res.body).toHaveProperty('actionUrl');

      const rec = res.body.recommendation;
      expect(rec).toHaveProperty('totalScore');
      expect(rec).toHaveProperty('attributeScores');
      expect(rec).toHaveProperty('recommendedCategory');
      expect(rec).toHaveProperty('reasoning');

      // totalScore should be a number between 0 and 1
      expect(typeof rec.totalScore).toBe('number');
      expect(rec.totalScore).toBeGreaterThanOrEqual(0);
      expect(rec.totalScore).toBeLessThanOrEqual(1);

      // Should have attribute scores (4 seed attributes)
      expect(Array.isArray(rec.attributeScores)).toBe(true);
      expect(rec.attributeScores.length).toBe(4);

      // Each attribute score should have expected fields
      for (const score of rec.attributeScores) {
        expect(score).toHaveProperty('attributeKey');
        expect(score).toHaveProperty('attributeName');
        expect(score).toHaveProperty('selectedValueId');
        expect(score).toHaveProperty('selectedLabel');
        expect(score).toHaveProperty('score');
        expect(typeof score.score).toBe('number');
        expect(score.score).toBeGreaterThanOrEqual(0);
        expect(score.score).toBeLessThanOrEqual(1);
      }

      // recommendedCategory should be a valid CRA category
      const validCategories = ['default', 'important_i', 'important_ii', 'critical'];
      expect(validCategories).toContain(rec.recommendedCategory);

      // actionUrl should contain the product ID
      expect(res.body.actionUrl).toContain(MFG_PRODUCT);
      expect(res.body.actionUrl).toContain('/action');
    });

    it('should return a high-risk recommendation with high-risk attribute values', async () => {
      const res = await api.post(`/api/products/${MFG_PRODUCT}/category-recommendation`, {
        auth: mfgToken,
        body: {
          attributeValues: {
            dist_scope: 'Mass market / internet-facing',
            data_sensitivity: 'Government secrets or critical infrastructure data',
            network_connectivity: 'Internet-facing public service',
            user_criticality: 'Critical infrastructure / government systems',
          },
        },
      });
      expect(res.status).toBe(200);

      const rec = res.body.recommendation;
      // With all high-risk attributes, score should be high
      expect(rec.totalScore).toBeGreaterThan(0.5);
      // Should recommend important_ii or critical
      expect(['important_ii', 'critical']).toContain(rec.recommendedCategory);
    });

    it('should return a low-risk recommendation with low-risk attribute values', async () => {
      const res = await api.post(`/api/products/${MFG_PRODUCT}/category-recommendation`, {
        auth: mfgToken,
        body: {
          attributeValues: {
            dist_scope: 'Internal/Limited use (< 5 orgs)',
            data_sensitivity: 'Non-sensitive data only',
            network_connectivity: 'Offline-only / air-gapped',
            user_criticality: 'Utility / convenience product',
          },
        },
      });
      expect(res.status).toBe(200);

      const rec = res.body.recommendation;
      // With all low-risk attributes, score should be low
      expect(rec.totalScore).toBeLessThan(0.5);
      expect(rec.recommendedCategory).toBe('default');
    });

    it('should return 404 for product not in org', async () => {
      const res = await api.post(`/api/products/${IMP_PRODUCT}/category-recommendation`, {
        auth: mfgToken,
        body: { attributeValues: {} },
      });
      expect(res.status).toBe(404);
    });

    it('should return 404 for non-existent product', async () => {
      const res = await api.post(`/api/products/00000000-0000-0000-0000-000000000000/category-recommendation`, {
        auth: mfgToken,
        body: { attributeValues: {} },
      });
      expect(res.status).toBe(404);
    });

    it('should store recommendation in audit trail', async () => {
      const res = await api.post(`/api/products/${MFG_PRODUCT}/category-recommendation`, {
        auth: mfgToken,
        body: { attributeValues: {} },
      });
      expect(res.status).toBe(200);

      // Extract recommendation ID from actionUrl
      const actionUrl = res.body.actionUrl;
      const idMatch = actionUrl.match(/category-recommendation\/([^/]+)\/action/);
      expect(idMatch).toBeTruthy();
      recommendationId = idMatch[1];

      // Verify it appears in history
      const historyRes = await api.get(`/api/products/${MFG_PRODUCT}/category-recommendation-history`, {
        auth: mfgToken,
      });
      expect(historyRes.status).toBe(200);
      expect(Array.isArray(historyRes.body)).toBe(true);

      const stored = historyRes.body.find((r: any) => r.id === recommendationId);
      expect(stored).toBeTruthy();
      expect(stored.productId).toBe(MFG_PRODUCT);
      expect(stored.userAction).toBe('pending');
    });
  });

  // ═══════════════════════════════════════════════════════
  // GET — Recommendation history
  // ═══════════════════════════════════════════════════════

  describe('GET /:productId/category-recommendation-history', () => {
    it('should return an array of recommendations', async () => {
      const res = await api.get(`/api/products/${MFG_PRODUCT}/category-recommendation-history`, {
        auth: mfgToken,
      });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      if (res.body.length > 0) {
        const rec = res.body[0];
        expect(rec).toHaveProperty('id');
        expect(rec).toHaveProperty('orgId');
        expect(rec).toHaveProperty('productId');
        expect(rec).toHaveProperty('deterministicScore');
        expect(rec).toHaveProperty('recommendedCategory');
        expect(rec).toHaveProperty('userAction');
        expect(rec).toHaveProperty('createdAt');
      }
    });

    it('should respect the limit query parameter', async () => {
      const res = await api.get(`/api/products/${MFG_PRODUCT}/category-recommendation-history`, {
        auth: mfgToken,
        query: { limit: '1' },
      });
      expect(res.status).toBe(200);
      expect(res.body.length).toBeLessThanOrEqual(1);
    });

    it('should return 404 for product not in org', async () => {
      const res = await api.get(`/api/products/${IMP_PRODUCT}/category-recommendation-history`, {
        auth: mfgToken,
      });
      expect(res.status).toBe(404);
    });

    it('should return empty array for product with no recommendations', async () => {
      // Use a product that has no recommendations yet
      const res = await api.get(
        `/api/products/${TEST_IDS.products.codeberg}/category-recommendation-history`,
        { auth: mfgToken }
      );
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════
  // POST — User action (accept/override/dismiss)
  // ═══════════════════════════════════════════════════════

  describe('POST /:productId/category-recommendation/:recId/action', () => {
    let actionRecId: string;

    beforeAll(async () => {
      // Create a fresh recommendation to act on
      const res = await api.post(`/api/products/${MFG_PRODUCT}/category-recommendation`, {
        auth: mfgToken,
        body: { attributeValues: {} },
      });
      const actionUrl = res.body.actionUrl;
      const idMatch = actionUrl.match(/category-recommendation\/([^/]+)\/action/);
      actionRecId = idMatch[1];
    });

    it('should accept a recommendation', async () => {
      // Create another recommendation for this specific test
      const createRes = await api.post(`/api/products/${MFG_PRODUCT}/category-recommendation`, {
        auth: mfgToken,
        body: { attributeValues: {} },
      });
      const url = createRes.body.actionUrl;
      const id = url.match(/category-recommendation\/([^/]+)\/action/)[1];

      const res = await api.post(
        `/api/products/${MFG_PRODUCT}/category-recommendation/${id}/action`,
        {
          auth: mfgToken,
          body: { action: 'accepted', finalCategory: 'default' },
        }
      );
      expect(res.status).toBe(200);
      expect(res.body.userAction).toBe('accepted');
      expect(res.body.finalCategory).toBe('default');
      expect(res.body.finalizedAt).toBeTruthy();
    });

    it('should override a recommendation with a different category', async () => {
      const createRes = await api.post(`/api/products/${MFG_PRODUCT}/category-recommendation`, {
        auth: mfgToken,
        body: { attributeValues: {} },
      });
      const url = createRes.body.actionUrl;
      const id = url.match(/category-recommendation\/([^/]+)\/action/)[1];

      const res = await api.post(
        `/api/products/${MFG_PRODUCT}/category-recommendation/${id}/action`,
        {
          auth: mfgToken,
          body: { action: 'overridden', finalCategory: 'important_i' },
        }
      );
      expect(res.status).toBe(200);
      expect(res.body.userAction).toBe('overridden');
      expect(res.body.finalCategory).toBe('important_i');
    });

    it('should dismiss a recommendation', async () => {
      const res = await api.post(
        `/api/products/${MFG_PRODUCT}/category-recommendation/${actionRecId}/action`,
        {
          auth: mfgToken,
          body: { action: 'dismissed' },
        }
      );
      expect(res.status).toBe(200);
      expect(res.body.userAction).toBe('dismissed');
    });

    it('should reject invalid action value', async () => {
      const createRes = await api.post(`/api/products/${MFG_PRODUCT}/category-recommendation`, {
        auth: mfgToken,
        body: { attributeValues: {} },
      });
      const url = createRes.body.actionUrl;
      const id = url.match(/category-recommendation\/([^/]+)\/action/)[1];

      const res = await api.post(
        `/api/products/${MFG_PRODUCT}/category-recommendation/${id}/action`,
        {
          auth: mfgToken,
          body: { action: 'invalid_action' },
        }
      );
      expect(res.status).toBe(400);
    });

    it('should return 404 for recommendation not in org', async () => {
      const res = await api.post(
        `/api/products/${MFG_PRODUCT}/category-recommendation/00000000-0000-0000-0000-000000000000/action`,
        {
          auth: mfgToken,
          body: { action: 'accepted', finalCategory: 'default' },
        }
      );
      expect(res.status).toBe(404);
    });

    it('should update product cra_category when accepting', async () => {
      const createRes = await api.post(`/api/products/${MFG_PRODUCT}/category-recommendation`, {
        auth: mfgToken,
        body: { attributeValues: {} },
      });
      const url = createRes.body.actionUrl;
      const id = url.match(/category-recommendation\/([^/]+)\/action/)[1];

      await api.post(
        `/api/products/${MFG_PRODUCT}/category-recommendation/${id}/action`,
        {
          auth: mfgToken,
          body: { action: 'accepted', finalCategory: 'important_ii' },
        }
      );

      // Verify via Neo4j that product category was updated
      const session = getNeo4jSession();
      try {
        const result = await session.run(
          `MATCH (p:Product {id: $id}) RETURN p.craCategory AS category`,
          { id: MFG_PRODUCT }
        );
        expect(result.records[0].get('category')).toBe('important_ii');

        // Reset product category back to default
        await session.run(
          `MATCH (p:Product {id: $id}) SET p.craCategory = 'default'`,
          { id: MFG_PRODUCT }
        );
      } finally {
        await session.close();
      }
    });
  });

  // ═══════════════════════════════════════════════════════
  // CROSS-ORG ISOLATION
  // ═══════════════════════════════════════════════════════

  describe('Cross-org isolation', () => {
    it('manufacturer cannot get recommendation for importer product', async () => {
      const res = await api.post(`/api/products/${IMP_PRODUCT}/category-recommendation`, {
        auth: mfgToken,
        body: { attributeValues: {} },
      });
      expect(res.status).toBe(404);
    });

    it('importer cannot get recommendation for manufacturer product', async () => {
      const res = await api.post(`/api/products/${MFG_PRODUCT}/category-recommendation`, {
        auth: impToken,
        body: { attributeValues: {} },
      });
      expect(res.status).toBe(404);
    });

    it('manufacturer cannot view importer recommendation history', async () => {
      const res = await api.get(`/api/products/${IMP_PRODUCT}/category-recommendation-history`, {
        auth: mfgToken,
      });
      expect(res.status).toBe(404);
    });

    it('importer cannot view manufacturer recommendation history', async () => {
      const res = await api.get(`/api/products/${MFG_PRODUCT}/category-recommendation-history`, {
        auth: impToken,
      });
      expect(res.status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════════════
  // DETERMINISTIC SCORING CONSISTENCY
  // ═══════════════════════════════════════════════════════

  describe('Deterministic scoring consistency', () => {
    it('same inputs should produce same score', async () => {
      const attrs = {
        dist_scope: 'Moderate distribution (5-100 orgs)',
        data_sensitivity: 'Health, financial or critical PII',
        network_connectivity: 'Internet-connected with firewalls',
        user_criticality: 'Healthcare, finance or communications',
      };

      const res1 = await api.post(`/api/products/${MFG_PRODUCT}/category-recommendation`, {
        auth: mfgToken,
        body: { attributeValues: attrs },
      });

      const res2 = await api.post(`/api/products/${MFG_PRODUCT}/category-recommendation`, {
        auth: mfgToken,
        body: { attributeValues: attrs },
      });

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body.recommendation.totalScore).toBe(res2.body.recommendation.totalScore);
      expect(res1.body.recommendation.recommendedCategory).toBe(res2.body.recommendation.recommendedCategory);
    });

    it('all 4 seed attributes should be present in scores', async () => {
      const res = await api.post(`/api/products/${MFG_PRODUCT}/category-recommendation`, {
        auth: mfgToken,
        body: { attributeValues: {} },
      });
      expect(res.status).toBe(200);

      const keys = res.body.recommendation.attributeScores.map((s: any) => s.attributeKey);
      expect(keys).toContain('dist_scope');
      expect(keys).toContain('data_sensitivity');
      expect(keys).toContain('network_connectivity');
      expect(keys).toContain('user_criticality');
    });

    it('reasoning object should have entries for all attributes', async () => {
      const res = await api.post(`/api/products/${MFG_PRODUCT}/category-recommendation`, {
        auth: mfgToken,
        body: { attributeValues: {} },
      });
      expect(res.status).toBe(200);

      const reasoning = res.body.recommendation.reasoning;
      expect(reasoning).toHaveProperty('dist_scope');
      expect(reasoning).toHaveProperty('data_sensitivity');
      expect(reasoning).toHaveProperty('network_connectivity');
      expect(reasoning).toHaveProperty('user_criticality');

      // Each reasoning entry should have expected fields
      for (const key of Object.keys(reasoning)) {
        expect(reasoning[key]).toHaveProperty('selectedValue');
        expect(reasoning[key]).toHaveProperty('score');
        expect(reasoning[key]).toHaveProperty('reasoning');
      }
    });
  });
});

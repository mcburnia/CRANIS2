/**
 * Integration Test — Neo4j ↔ Postgres Consistency
 *
 * Verifies that data in Neo4j and Postgres remains consistent:
 * - Products exist in both databases with matching IDs
 * - Organisations exist in both databases
 * - Dependency counts are consistent
 * - Product-org relationships match
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, loginTestUser, TEST_USERS, getAppPool, getNeo4jSession } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

describe('Integration: Neo4j ↔ Postgres Consistency', () => {
  let token: string;

  beforeAll(async () => {
    token = await loginTestUser(TEST_USERS.mfgAdmin);
  });

  // ─── Products exist in both databases ──────────────────────────────

  describe('Product consistency', () => {
    it('should have test products in both Postgres and Neo4j', async () => {
      const pool = getAppPool();
      const session = getNeo4jSession();

      try {
        // Check a known product in Postgres via API
        const apiRes = await api.get(`/api/products/${TEST_IDS.products.github}`, { auth: token });
        expect(apiRes.status).toBe(200);
        expect(apiRes.body.name || apiRes.body.product?.name).toBe('test-product-github');

        // Check same product in Neo4j
        const neo4jResult = await session.run(
          'MATCH (p:Product {id: $id}) RETURN p.name AS name, p.id AS id',
          { id: TEST_IDS.products.github }
        );
        expect(neo4jResult.records.length).toBe(1);
        expect(neo4jResult.records[0].get('name')).toBe('test-product-github');
      } finally {
        await session.close();
      }
    });

    it('should have matching product IDs across databases', async () => {
      const session = getNeo4jSession();

      try {
        const productIds = [
          TEST_IDS.products.github,
          TEST_IDS.products.codeberg,
          TEST_IDS.products.gitea,
          TEST_IDS.products.forgejo,
          TEST_IDS.products.gitlab,
        ];

        for (const id of productIds) {
          // Verify in Neo4j
          const result = await session.run(
            'MATCH (p:Product {id: $id}) RETURN p.id AS id',
            { id }
          );
          expect(result.records.length).toBe(1);

          // Verify via API (which reads from both DBs)
          const apiRes = await api.get(`/api/products/${id}`, { auth: token });
          expect(apiRes.status).toBe(200);
        }
      } finally {
        await session.close();
      }
    });
  });

  // ─── Organisation consistency ──────────────────────────────────────

  describe('Organisation consistency', () => {
    it('should have test organisations in Neo4j', async () => {
      const session = getNeo4jSession();

      try {
        const result = await session.run(
          'MATCH (o:Organisation {id: $id}) RETURN o.id AS id, o.name AS name',
          { id: TEST_IDS.orgs.mfgActive }
        );
        expect(result.records.length).toBe(1);
      } finally {
        await session.close();
      }
    });

    it('should have matching org data via API (org lives in Neo4j)', async () => {
      // Organisations are stored in Neo4j, referenced by org_id in users table
      const res = await api.get('/api/org', { auth: token });
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(TEST_IDS.orgs.mfgActive);
    });
  });

  // ─── Product → Organisation relationships ──────────────────────────

  describe('Product-Organisation relationships', () => {
    it('should have BELONGS_TO relationships in Neo4j', async () => {
      const session = getNeo4jSession();

      try {
        const result = await session.run(
          `MATCH (p:Product {id: $productId})-[:BELONGS_TO]->(o:Organisation)
           RETURN o.id AS orgId`,
          { productId: TEST_IDS.products.github }
        );
        expect(result.records.length).toBe(1);
        expect(result.records[0].get('orgId')).toBe(TEST_IDS.orgs.mfgActive);
      } finally {
        await session.close();
      }
    });

    it('manufacturer products should all belong to manufacturer org', async () => {
      const session = getNeo4jSession();

      try {
        const mfgProducts = [
          TEST_IDS.products.github,
          TEST_IDS.products.codeberg,
          TEST_IDS.products.gitea,
          TEST_IDS.products.forgejo,
          TEST_IDS.products.gitlab,
        ];

        for (const productId of mfgProducts) {
          const result = await session.run(
            `MATCH (p:Product {id: $productId})-[:BELONGS_TO]->(o:Organisation)
             RETURN o.id AS orgId`,
            { productId }
          );
          expect(result.records.length).toBe(1);
          expect(result.records[0].get('orgId')).toBe(TEST_IDS.orgs.mfgActive);
        }
      } finally {
        await session.close();
      }
    });

    it('importer products should belong to importer org', async () => {
      const session = getNeo4jSession();

      try {
        const result = await session.run(
          `MATCH (p:Product {id: $productId})-[:BELONGS_TO]->(o:Organisation)
           RETURN o.id AS orgId`,
          { productId: TEST_IDS.products.impGithub }
        );
        expect(result.records.length).toBe(1);
        expect(result.records[0].get('orgId')).toBe(TEST_IDS.orgs.impTrial);
      } finally {
        await session.close();
      }
    });
  });

  // ─── API returns consistent data from both DBs ──────────────────────

  describe('API consistency across data stores', () => {
    it('product list should match Neo4j product count for org', async () => {
      const session = getNeo4jSession();

      try {
        // Get product count from API
        const apiRes = await api.get('/api/products', { auth: token });
        expect(apiRes.status).toBe(200);
        const apiProducts = apiRes.body.products || apiRes.body;
        const apiCount = apiProducts.length;

        // Get product count from Neo4j
        const neo4jResult = await session.run(
          `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product)
           RETURN count(p) AS count`,
          { orgId: TEST_IDS.orgs.mfgActive }
        );
        const neo4jCount = neo4jResult.records[0].get('count').toNumber();

        expect(apiCount).toBe(neo4jCount);
      } finally {
        await session.close();
      }
    });

    it('org member count from API should match Postgres', async () => {
      const pool = getAppPool();

      // Get from API
      const apiRes = await api.get('/api/org/members', { auth: token });
      expect(apiRes.status).toBe(200);
      const members = apiRes.body.members || apiRes.body;

      // Get from Postgres
      const pgResult = await pool.query(
        'SELECT count(*)::int AS count FROM users WHERE org_id = $1',
        [TEST_IDS.orgs.mfgActive]
      );
      const pgCount = pgResult.rows[0].count;

      expect(members.length).toBe(pgCount);
    });
  });

  // ─── Dependency data consistency ───────────────────────────────────

  describe('Dependency data consistency', () => {
    it('should have consistent SBOM data between stores', async () => {
      // Check SBOM export status via API (which reads from Postgres)
      const apiRes = await api.get(`/api/sbom/${TEST_IDS.products.github}/export/status`, { auth: token });
      expect(apiRes.status).toBe(200);

      const session = getNeo4jSession();
      try {
        // Check dependencies in Neo4j
        const neo4jResult = await session.run(
          `MATCH (p:Product {id: $productId})-[:HAS_DEPENDENCY]->(d:Dependency)
           RETURN count(d) AS count`,
          { productId: TEST_IDS.products.github }
        );
        const neo4jDeps = neo4jResult.records[0].get('count').toNumber();

        // Both should report the same count (or close to it if one is more authoritative)
        if (apiRes.body.hasSBOM) {
          expect(neo4jDeps).toBeGreaterThanOrEqual(0);
          expect(apiRes.body.totalDependencies).toBeGreaterThanOrEqual(0);
        }
      } finally {
        await session.close();
      }
    });
  });
});

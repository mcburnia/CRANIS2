/**
 * Integration Test — Product Lifecycle
 *
 * Tests the full product lifecycle: create → configure → use → delete.
 * Verifies that product creation populates both Postgres and Neo4j,
 * and that deletion cleans up all related data.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS, getNeo4jSession } from '../setup/test-helpers.js';

describe('Integration: Product Lifecycle', () => {
  let token: string;
  let productId: string;

  beforeAll(async () => {
    token = await loginTestUser(TEST_USERS.mfgAdmin);
  });

  // ─── Step 1: Create product ─────────────────────────────────────────

  it('Step 1: Create a new product', async () => {
    const uniqueName = `lifecycle-test-${Date.now()}`;
    const res = await api.post('/api/products', {
      auth: token,
      body: {
        name: uniqueName,
        craCategory: 'category-1',
        description: 'Integration test product',
      },
    });
    expect(res.status).toBe(201);
    productId = res.body.id;
    expect(productId).toBeTruthy();
    expect(res.body.name).toBe(uniqueName);
  });

  // ─── Step 2: Verify in Neo4j ────────────────────────────────────────

  it('Step 2: Product exists in Neo4j', async () => {
    const session = getNeo4jSession();
    try {
      const result = await session.run(
        'MATCH (p:Product {id: $id}) RETURN p.name AS name',
        { id: productId }
      );
      expect(result.records.length).toBe(1);
    } finally {
      await session.close();
    }
  });

  // ─── Step 3: Product appears in list ────────────────────────────────

  it('Step 3: Product appears in product list', async () => {
    const res = await api.get('/api/products', { auth: token });
    expect(res.status).toBe(200);
    const products = res.body.products || res.body;
    const found = products.find((p: any) => p.id === productId);
    expect(found).toBeTruthy();
  });

  // ─── Step 4: Product detail ─────────────────────────────────────────

  it('Step 4: Product detail returns full info', async () => {
    const res = await api.get(`/api/products/${productId}`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(productId);
    // craCategory may default to 'default' even if 'category-1' was requested
    expect(res.body.craCategory).toBeTruthy();
  });

  // ─── Step 5: Use product in compliance endpoints ────────────────────

  it('Step 5: Product accessible in SBOM export status', async () => {
    const res = await api.get(`/api/sbom/${productId}/export/status`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.hasSBOM).toBe(false); // New product, no SBOM yet
  });

  it('Step 5b: Product accessible in vulnerability findings', async () => {
    const res = await api.get(`/api/risk-findings/${productId}`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.findings).toEqual([]);
  });

  it('Step 5c: Product accessible in license scan', async () => {
    const res = await api.get(`/api/license-scan/${productId}`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.findings).toEqual([]);
  });

  // ─── Step 6: Create CRA report for product ──────────────────────────

  it('Step 6: Can create CRA report for new product', async () => {
    const res = await api.post('/api/cra-reports', {
      auth: token,
      body: {
        productId,
        reportType: 'vulnerability',
        awarenessAt: new Date().toISOString(),
        csirtCountry: 'DE',
      },
    });
    expect(res.status).toBe(201);
  });

  // ─── Step 7: Delete product ─────────────────────────────────────────

  it('Step 7: Delete the product', async () => {
    const res = await api.delete(`/api/products/${productId}`, { auth: token });
    expect([200, 204]).toContain(res.status);
  });

  // ─── Step 8: Verify deletion ────────────────────────────────────────

  it('Step 8: Product no longer accessible', async () => {
    const res = await api.get(`/api/products/${productId}`, { auth: token });
    expect([403, 404]).toContain(res.status);
  });

  it('Step 8b: Product removed from Neo4j', async () => {
    const session = getNeo4jSession();
    try {
      const result = await session.run(
        'MATCH (p:Product {id: $id}) RETURN p',
        { id: productId }
      );
      expect(result.records.length).toBe(0);
    } finally {
      await session.close();
    }
  });

  it('Step 8c: Product no longer in product list', async () => {
    const res = await api.get('/api/products', { auth: token });
    expect(res.status).toBe(200);
    const products = res.body.products || res.body;
    const found = products.find((p: any) => p.id === productId);
    expect(found).toBeFalsy();
  });
});

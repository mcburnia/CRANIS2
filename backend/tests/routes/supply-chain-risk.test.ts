/**
 * Supply Chain Risk Scorecard — Integration Tests
 *
 * Tests:
 *   GET /:productId/supply-chain-risk         — full scorecard
 *   GET /:productId/supply-chain-risk/summary — lightweight summary
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';
import { TEST_IDS } from '../setup/seed-test-data.js';

const PRODUCT_ID = TEST_IDS.products.github;

let token: string;

beforeAll(async () => {
  token = await loginTestUser(TEST_USERS.mfgAdmin);
}, 15000);

// ─── Auth ────────────────────────────────────────────────────

describe('Auth & access control', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/supply-chain-risk`);
    expect(res.status).toBe(401);
  });

  it('rejects access to products in another org', async () => {
    const impToken = await loginTestUser(TEST_USERS.impAdmin);
    const res = await api.get(`/api/products/${PRODUCT_ID}/supply-chain-risk`, { auth: impToken });
    expect(res.status).toBe(404);
  });
});

// ─── Full scorecard ─────────────────────────────────────────

describe('GET /:productId/supply-chain-risk', () => {
  it('returns a valid scorecard structure', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/supply-chain-risk`, { auth: token });
    expect(res.status).toBe(200);

    // Overall score
    expect(res.body).toHaveProperty('overallScore');
    expect(typeof res.body.overallScore).toBe('number');
    expect(res.body.overallScore).toBeGreaterThanOrEqual(0);
    expect(res.body.overallScore).toBeLessThanOrEqual(100);

    // Risk level
    expect(res.body).toHaveProperty('riskLevel');
    expect(['low', 'medium', 'high', 'critical']).toContain(res.body.riskLevel);

    // Areas
    expect(res.body).toHaveProperty('areas');
    expect(Array.isArray(res.body.areas)).toBe(true);
    expect(res.body.areas.length).toBe(5);
    for (const area of res.body.areas) {
      expect(area).toHaveProperty('area');
      expect(area).toHaveProperty('label');
      expect(area).toHaveProperty('score');
      expect(area).toHaveProperty('maxScore');
      expect(area).toHaveProperty('details');
      expect(typeof area.score).toBe('number');
    }

    // Area names
    const areaNames = res.body.areas.map((a: any) => a.area);
    expect(areaNames).toContain('sbom');
    expect(areaNames).toContain('vulnerabilities');
    expect(areaNames).toContain('licence');
    expect(areaNames).toContain('supplier');
    expect(areaNames).toContain('concentration');

    // Weights sum to 100
    const totalWeight = res.body.areas.reduce((sum: number, a: any) => sum + a.maxScore, 0);
    expect(totalWeight).toBe(100);

    // Top risks
    expect(res.body).toHaveProperty('topRisks');
    expect(Array.isArray(res.body.topRisks)).toBe(true);
    for (const risk of res.body.topRisks) {
      expect(risk).toHaveProperty('name');
      expect(risk).toHaveProperty('riskScore');
      expect(risk).toHaveProperty('flags');
      expect(Array.isArray(risk.flags)).toBe(true);
    }

    // Stats
    expect(res.body).toHaveProperty('stats');
    expect(res.body.stats).toHaveProperty('totalDependencies');
    expect(res.body.stats).toHaveProperty('withKnownSupplier');
    expect(res.body.stats).toHaveProperty('withVulnerabilities');
    expect(res.body.stats).toHaveProperty('withCopyleftLicence');
    expect(res.body.stats).toHaveProperty('withUnknownLicence');
    expect(res.body.stats).toHaveProperty('sbomFresh');
    expect(res.body.stats).toHaveProperty('sbomExists');
  });

  it('returns top risks sorted by risk score descending', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/supply-chain-risk`, { auth: token });
    expect(res.status).toBe(200);
    const risks = res.body.topRisks;
    for (let i = 1; i < risks.length; i++) {
      expect(risks[i].riskScore).toBeLessThanOrEqual(risks[i - 1].riskScore);
    }
  });

  it('limits top risks to 10', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/supply-chain-risk`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.topRisks.length).toBeLessThanOrEqual(10);
  });
});

// ─── Summary ────────────────────────────────────────────────

describe('GET /:productId/supply-chain-risk/summary', () => {
  it('returns lightweight summary', async () => {
    const res = await api.get(`/api/products/${PRODUCT_ID}/supply-chain-risk/summary`, { auth: token });
    expect(res.status).toBe(200);

    expect(res.body).toHaveProperty('overallScore');
    expect(res.body).toHaveProperty('riskLevel');
    expect(res.body).toHaveProperty('totalDependencies');
    expect(res.body).toHaveProperty('withVulnerabilities');

    // Should NOT include full areas or topRisks
    expect(res.body).not.toHaveProperty('areas');
    expect(res.body).not.toHaveProperty('topRisks');
  });

  it('summary score matches full scorecard', async () => {
    const [full, summary] = await Promise.all([
      api.get(`/api/products/${PRODUCT_ID}/supply-chain-risk`, { auth: token }),
      api.get(`/api/products/${PRODUCT_ID}/supply-chain-risk/summary`, { auth: token }),
    ]);
    expect(full.status).toBe(200);
    expect(summary.status).toBe(200);
    expect(summary.body.overallScore).toBe(full.body.overallScore);
    expect(summary.body.riskLevel).toBe(full.body.riskLevel);
  });
});

// ─── Product without dependencies ───────────────────────────

describe('Product without dependencies', () => {
  it('returns a valid scorecard for product with no deps', async () => {
    // gitea product may have no dependencies in test data
    const giteaId = TEST_IDS.products.gitea;
    const res = await api.get(`/api/products/${giteaId}/supply-chain-risk`, { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.stats.totalDependencies).toBeGreaterThanOrEqual(0);
    expect(res.body.areas.length).toBe(5);
  });
});

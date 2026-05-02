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
 * Risk Findings — Integration Tests
 *
 * Tests:
 *   GET /api/risk-findings/overview           – Cross-product vulnerability overview
 *   GET /api/risk-findings/platform-scan/latest – Latest platform-wide scan
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { api, loginTestUser, TEST_USERS } from '../setup/test-helpers.js';

let token: string;

beforeAll(async () => {
  token = await loginTestUser(TEST_USERS.mfgAdmin);
}, 15000);

describe('GET /api/risk-findings/overview', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await api.get('/api/risk-findings/overview');
    expect(res.status).toBe(401);
  });

  it('returns overview with products and totals', async () => {
    const res = await api.get('/api/risk-findings/overview', { auth: token });
    expect(res.status).toBe(200);
    expect(res.body.products).toBeDefined();
    expect(Array.isArray(res.body.products)).toBe(true);
    expect(res.body.totals).toBeDefined();
    expect(typeof res.body.totals.totalFindings).toBe('number');
    expect(typeof res.body.totals.critical).toBe('number');
    expect(typeof res.body.totals.high).toBe('number');
    expect(typeof res.body.totals.medium).toBe('number');
    expect(typeof res.body.totals.low).toBe('number');
  });

  it('includes product-level finding breakdowns', async () => {
    const res = await api.get('/api/risk-findings/overview', { auth: token });
    expect(res.status).toBe(200);
    if (res.body.products.length > 0) {
      const product = res.body.products[0];
      expect(product.id).toBeDefined();
      expect(product.name).toBeDefined();
      expect(product.findings).toBeDefined();
    }
  });
});

describe('GET /api/risk-findings/platform-scan/latest', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await api.get('/api/risk-findings/platform-scan/latest');
    expect(res.status).toBe(401);
  });

  it('returns latest scan info (or null)', async () => {
    const res = await api.get('/api/risk-findings/platform-scan/latest', { auth: token });
    expect(res.status).toBe(200);
    // latestScan may be null if no scan has ever run
    expect(res.body).toHaveProperty('latestScan');
  });
});

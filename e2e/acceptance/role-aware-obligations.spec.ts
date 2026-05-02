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
 * Acceptance Test: Role-Aware Obligation Rendering
 *
 * Verifies that the product detail Obligations tab renders the correct
 * CRA obligations based on the organisation's economic operator role:
 * - Manufacturer orgs see Art. 13 obligations (not Art. 18/19)
 * - Importer orgs see Art. 18 obligations
 * - Distributor orgs see Art. 19 obligations
 *
 * Note: The live DB may have legacy obligations from prior runs (ON CONFLICT
 * DO NOTHING means old data persists). Tests assert that the correct
 * role-specific obligations are present and that newly created obligations
 * match the role, rather than asserting exact absence of other articles.
 *
 * @tags @acceptance
 */
import { test, expect } from '@playwright/test';
import { TEST_USERS, TEST_PASSWORD, TEST_IDS } from '../helpers/test-data.js';
import { apiLogin, apiGet } from '../helpers/api-client.js';

const BASE_URL = process.env.E2E_BASE_URL || 'https://dev.cranis2.dev';

test.describe('Role-Aware Obligations @acceptance', () => {
  let mfgToken: string;
  let impToken: string;
  let distToken: string;

  test.beforeAll(async () => {
    // Log in as all three role personas
    // Note: distributor org is seeded as 'suspended' but login and GET
    // requests still work — only write operations are blocked by billing gate
    mfgToken = await apiLogin(TEST_USERS.mfgAdmin, TEST_PASSWORD);
    impToken = await apiLogin(TEST_USERS.impAdmin, TEST_PASSWORD);
    distToken = await apiLogin(TEST_USERS.distAdmin, TEST_PASSWORD);
  });

  test.describe('API — obligation keys by role', () => {
    test('manufacturer org API returns Art. 13 obligations', async () => {
      const res = await apiGet(
        `/api/obligations/${TEST_IDS.products.github}`,
        mfgToken
      );

      expect(res.obligations).toBeDefined();
      const keys: string[] = res.obligations.map((o: any) => o.obligationKey);

      // Should contain manufacturer obligations (Art. 13)
      expect(keys).toContain('art_13');
      expect(keys).toContain('art_13_6');
      expect(keys).toContain('art_13_11');

      // Manufacturer org should NOT have importer or distributor obligations
      expect(keys.some((k: string) => k.startsWith('art_18'))).toBe(false);
      expect(keys.some((k: string) => k.startsWith('art_19'))).toBe(false);
    });

    test('importer org API returns Art. 18 obligations', async () => {
      const res = await apiGet(
        `/api/obligations/${TEST_IDS.products.impGithub}`,
        impToken
      );

      expect(res.obligations).toBeDefined();
      const keys: string[] = res.obligations.map((o: any) => o.obligationKey);

      // Should contain importer obligations (Art. 18)
      expect(keys).toContain('art_18_1');
      expect(keys).toContain('art_18_2');
      expect(keys).toContain('art_18_7');
      expect(keys).toContain('art_18_8');
      expect(keys).toContain('art_18_10');

      // Should NOT contain distributor obligations
      expect(keys.some((k: string) => k.startsWith('art_19'))).toBe(false);
    });

    test('distributor org API returns Art. 19 obligations', async () => {
      const res = await apiGet(
        `/api/obligations/${TEST_IDS.products.distGithub1}`,
        distToken
      );

      expect(res.obligations).toBeDefined();
      const keys: string[] = res.obligations.map((o: any) => o.obligationKey);

      // Should contain distributor obligations (Art. 19)
      expect(keys).toContain('art_19_1');
      expect(keys).toContain('art_19_2');
      expect(keys).toContain('art_19_4');

      // Should NOT contain importer obligations
      expect(keys.some((k: string) => k.startsWith('art_18'))).toBe(false);
    });
  });

  test.describe('UI — Obligations tab renders correct articles', () => {
    test('manufacturer product shows Art. 13 on Obligations tab', async ({ page }) => {
      // Inject manufacturer token
      await page.goto(BASE_URL);
      await page.evaluate((t) => localStorage.setItem('session_token', t), mfgToken);

      await page.goto(`${BASE_URL}/products/${TEST_IDS.products.github}?tab=obligations`);
      await page.waitForLoadState('networkidle');

      // Wait for obligations to render
      await page.waitForSelector('text=Art. 13', { timeout: 15000 });

      const body = await page.textContent('body');

      // Should display manufacturer obligations
      expect(body).toContain('Art. 13');

      // Should NOT display importer or distributor obligations
      expect(body).not.toContain('Art. 18');
      expect(body).not.toContain('Art. 19');
    });

    test('importer product shows Art. 18 on Obligations tab', async ({ page }) => {
      // Inject importer token
      await page.goto(BASE_URL);
      await page.evaluate((t) => localStorage.setItem('session_token', t), impToken);

      await page.goto(`${BASE_URL}/products/${TEST_IDS.products.impGithub}?tab=obligations`);
      await page.waitForLoadState('networkidle');

      // Wait for obligations to render
      await page.waitForSelector('text=Art. 18', { timeout: 15000 });

      const body = await page.textContent('body');

      // Must display importer obligations
      expect(body).toContain('Art. 18');
      // Count Art. 18 occurrences to ensure they dominate
      const art18Count = (body!.match(/Art\. 18/g) || []).length;
      expect(art18Count).toBeGreaterThanOrEqual(5);
    });

    test('distributor product shows Art. 19 on Obligations tab', async ({ page }) => {
      // Inject distributor token
      await page.goto(BASE_URL);
      await page.evaluate((t) => localStorage.setItem('session_token', t), distToken);

      await page.goto(`${BASE_URL}/products/${TEST_IDS.products.distGithub1}?tab=obligations`);
      await page.waitForLoadState('networkidle');

      // Wait for obligations to render
      await page.waitForSelector('text=Art. 19', { timeout: 15000 });

      const body = await page.textContent('body');

      // Must display distributor obligations
      expect(body).toContain('Art. 19');
      // Count Art. 19 occurrences to ensure they dominate
      const art19Count = (body!.match(/Art\. 19/g) || []).length;
      expect(art19Count).toBeGreaterThanOrEqual(3);
    });
  });

  test.describe('API — Obligation counts include role-specific articles', () => {
    test('manufacturer product has at least 16 obligations', async () => {
      const res = await apiGet(
        `/api/obligations/${TEST_IDS.products.github}`,
        mfgToken
      );
      const keys: string[] = res.obligations.map((o: any) => o.obligationKey);
      // At least 16 manufacturer obligations for default category
      expect(res.obligations.length).toBeGreaterThanOrEqual(16);
      // All should be manufacturer obligations (no importer/distributor)
      expect(keys.some((k: string) => k.startsWith('art_18'))).toBe(false);
      expect(keys.some((k: string) => k.startsWith('art_19'))).toBe(false);
    });

    test('importer product has at least 10 Art. 18 obligations', async () => {
      const res = await apiGet(
        `/api/obligations/${TEST_IDS.products.impGithub}`,
        impToken
      );
      const art18Keys = res.obligations
        .map((o: any) => o.obligationKey)
        .filter((k: string) => k.startsWith('art_18'));
      // Should have all 10 importer obligations
      expect(art18Keys.length).toBe(10);
    });

    test('distributor product has at least 6 Art. 19 obligations', async () => {
      const res = await apiGet(
        `/api/obligations/${TEST_IDS.products.distGithub1}`,
        distToken
      );
      const art19Keys = res.obligations
        .map((o: any) => o.obligationKey)
        .filter((k: string) => k.startsWith('art_19'));
      // Should have all 6 distributor obligations
      expect(art19Keys.length).toBe(6);
    });
  });

  test.describe('UI — No console errors on role-specific pages', () => {
    test('no console errors on importer product detail', async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto(BASE_URL);
      await page.evaluate((t) => localStorage.setItem('session_token', t), impToken);
      await page.goto(`${BASE_URL}/products/${TEST_IDS.products.impGithub}?tab=obligations`);
      await page.waitForLoadState('networkidle');

      const realErrors = consoleErrors.filter(
        (err) => !err.includes('favicon') && !err.includes('404') && !err.includes('Failed to load resource')
      );
      expect(realErrors, `Console errors: ${realErrors.join(', ')}`).toHaveLength(0);
    });

    test('no console errors on distributor product detail', async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto(BASE_URL);
      await page.evaluate((t) => localStorage.setItem('session_token', t), distToken);
      await page.goto(`${BASE_URL}/products/${TEST_IDS.products.distGithub1}?tab=obligations`);
      await page.waitForLoadState('networkidle');

      const realErrors = consoleErrors.filter(
        (err) => !err.includes('favicon') && !err.includes('404') && !err.includes('Failed to load resource')
      );
      expect(realErrors, `Console errors: ${realErrors.join(', ')}`).toHaveLength(0);
    });
  });
});

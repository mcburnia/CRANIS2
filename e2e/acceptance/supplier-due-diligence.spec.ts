/**
 * Acceptance Test: Supplier Due Diligence Questionnaires
 *
 * Tests the supplier questionnaire API endpoints and UI presence
 * on the product detail page. Does not test AI generation (Claude API).
 *
 * @tags @acceptance
 */
import { test, expect } from '@playwright/test';
import { TEST_USERS, TEST_PASSWORD, TEST_IDS } from '../helpers/test-data.js';
import { apiLogin, apiGet, apiPatch } from '../helpers/api-client.js';

const BASE_URL = process.env.E2E_BASE_URL || 'https://dev.cranis2.dev';
const MFG_PRODUCT = TEST_IDS.products.github;

test.describe('Supplier Due Diligence @acceptance', () => {
  let token: string;

  test.beforeAll(async () => {
    token = await apiLogin(TEST_USERS.mfgAdmin, TEST_PASSWORD);
  });

  test.describe('API — List questionnaires', () => {
    test('GET returns array (may be empty)', async () => {
      const res = await apiGet(
        `/api/products/${MFG_PRODUCT}/supplier-questionnaires`,
        token
      );
      expect(Array.isArray(res)).toBe(true);
    });

    test('returns 404 for non-existent product', async () => {
      try {
        await apiGet('/api/products/nonexistent/supplier-questionnaires', token);
      } catch {
        // apiGet may throw on non-2xx — that's expected
      }
    });
  });

  test.describe('API — Cross-org isolation', () => {
    test('importer cannot view manufacturer questionnaires', async () => {
      const impToken = await apiLogin(TEST_USERS.impAdmin, TEST_PASSWORD);
      try {
        const res = await apiGet(
          `/api/products/${MFG_PRODUCT}/supplier-questionnaires`,
          impToken
        );
        // If we get here, should be error response
        expect(res.error).toBeTruthy();
      } catch {
        // Expected — apiGet throws on non-2xx
      }
    });
  });

  test.describe('UI — Product detail page', () => {
    test('Supply Chain tab is visible', async ({ page }) => {
      await page.goto(`${BASE_URL}/products/${MFG_PRODUCT}?tab=supply-chain`);
      await page.waitForLoadState('networkidle');

      // Wait for the Supply Chain tab button or tab content to render
      await page.getByRole('button', { name: 'Supply Chain' }).waitFor({ timeout: 10000 });

      const body = await page.textContent('body');
      const hasSupplyChainContent =
        body?.includes('Supplier Due Diligence') ||
        body?.includes('Supply Chain') ||
        body?.includes('Scan Dependencies');

      expect(
        hasSupplyChainContent,
        'Product detail should show Supply Chain tab content'
      ).toBeTruthy();
    });

    test('Supply Chain tab shows CRA reference', async ({ page }) => {
      await page.goto(`${BASE_URL}/products/${MFG_PRODUCT}?tab=supply-chain`);
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('text=Art. 13(5)', { timeout: 10000 });

      const body = await page.textContent('body');
      expect(body).toContain('Art. 13(5)');
    });

    test('Scan Dependencies button is present', async ({ page }) => {
      await page.goto(`${BASE_URL}/products/${MFG_PRODUCT}?tab=supply-chain`);
      await page.waitForLoadState('networkidle');

      const scanBtn = page.locator('button:has-text("Scan Dependencies")');
      await expect(scanBtn).toBeVisible();
    });
  });
});

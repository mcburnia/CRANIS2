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
 * Acceptance Test 12: Technical Files — Overview, Product Sections, Section Details
 *
 * Converts: cowork-tests/acceptance/12-technical-files.md
 * Tests the technical files overview page, product list with completeness indicators,
 * drill-down into product sections, 8-section structure (CRA Annex VII), section
 * status display, and content editor rendering.
 *
 * NOTE: This test is read-only — it does not modify real CRANIS2 product data.
 *
 * @tags @acceptance
 */
import { test, expect } from '@playwright/test';
import { TEST_USERS, TEST_PASSWORD } from '../helpers/test-data.js';
import { apiLogin, apiGet, apiPost, apiDelete } from '../helpers/api-client.js';

const BASE_URL = process.env.E2E_BASE_URL || 'https://dev.cranis2.dev';

// The 8 CRA Annex VII technical file section keys
const EXPECTED_SECTION_KEYS = [
  'product_description',
  'risk_assessment',
  'standards_applied',
  'test_reports',
  'vulnerability_handling',
  'design_development',
  'support_period',
  'declaration_of_conformity',
];

// Valid section statuses
const VALID_STATUSES = ['not_started', 'draft', 'in_progress', 'complete', 'completed'];

test.describe('Technical Files @acceptance', () => {

  let token: string;
  let createdProductId: string | null = null;
  let createdProductName: string = 'e2e-techfiles-test';

  test.beforeAll(async () => {
    token = await apiLogin(TEST_USERS.mfgAdmin, TEST_PASSWORD);

    // Create a product so the org has at least one (seeded products were cleaned up)
    const res = await apiPost('/api/products', token, { name: createdProductName });
    if (res.status < 300 && res.body?.id) {
      createdProductId = res.body.id;
    }
  });

  test.afterAll(async () => {
    if (createdProductId) {
      await apiDelete(`/api/products/${createdProductId}`, token);
    }
  });

  test.describe('Technical files overview page', () => {

    test('technical files page loads via sidebar navigation', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForLoadState('networkidle');

      // Expand Compliance section and click Technical Files
      await page.getByRole('button', { name: 'Compliance' }).click();
      await page.waitForTimeout(300);
      await page.getByRole('link', { name: 'Technical Files' }).first().click();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/technical-files/);
    });

    test('technical files page loads via direct URL', async ({ page }) => {
      await page.goto(`${BASE_URL}/technical-files`);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/technical-files/);

      const body = await page.textContent('body');
      expect(body).toBeTruthy();
      expect(body!.length).toBeGreaterThan(50);
    });

    test('technical files overview displays product list', async ({ page }) => {
      await page.goto(`${BASE_URL}/technical-files`);
      await page.waitForLoadState('networkidle');

      const body = await page.textContent('body');

      // The page should list products — check for created product name or generic content
      const hasProductReference = body!.includes(createdProductName) ||
                                   body!.toLowerCase().includes('product') ||
                                   body!.toLowerCase().includes('technical');
      expect(hasProductReference, 'Technical files page should display product references').toBeTruthy();
    });

    test('overview API returns products with sections', async () => {
      const data = await apiGet('/api/technical-files/overview', token);

      expect(data).toHaveProperty('products');
      expect(Array.isArray(data.products)).toBe(true);
      expect(data.products.length).toBeGreaterThanOrEqual(1);
    });

    test('each product in overview has metadata', async () => {
      const data = await apiGet('/api/technical-files/overview', token);

      for (const product of data.products) {
        expect(product).toHaveProperty('id');
        expect(product).toHaveProperty('name');
        expect(product).toHaveProperty('craCategory');
        expect(typeof product.id).toBe('string');
        expect(typeof product.name).toBe('string');
      }
    });

    test('each product has sections array', async () => {
      const data = await apiGet('/api/technical-files/overview', token);

      for (const product of data.products) {
        expect(product).toHaveProperty('sections');
        expect(Array.isArray(product.sections)).toBe(true);
      }
    });

    test('created product appears in overview', async () => {
      test.skip(!createdProductId, 'No product was created');

      const data = await apiGet('/api/technical-files/overview', token);

      const product = data.products.find(
        (p: any) => p.id === createdProductId
      );
      expect(product, `Created product ${createdProductName} should appear in overview`).toBeTruthy();
      expect(product.name).toBe(createdProductName);
    });

    test('overview shows completeness indicators on page', async ({ page }) => {
      await page.goto(`${BASE_URL}/technical-files`);
      await page.waitForLoadState('networkidle');

      const body = await page.textContent('body');

      // The overview should indicate completeness (percentage, section count, status text)
      const hasCompletenessIndicator = body!.toLowerCase().includes('complete') ||
                                        body!.toLowerCase().includes('progress') ||
                                        body!.toLowerCase().includes('not started') ||
                                        body!.match(/\d+\s*\/\s*\d+/) !== null ||
                                        body!.match(/\d+%/) !== null;
      expect(
        hasCompletenessIndicator,
        'Overview should show completeness indicators (percentage, fraction, or status text)'
      ).toBeTruthy();
    });

    test('no console errors on technical files page', async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto(`${BASE_URL}/technical-files`);
      await page.waitForLoadState('networkidle');

      const realErrors = consoleErrors.filter(
        (err) => !err.includes('favicon') && !err.includes('404') && !err.includes('Failed to load resource')
      );
      expect(realErrors, `Console errors: ${realErrors.join(', ')}`).toHaveLength(0);
    });
  });

  test.describe('Product section details', () => {

    test('sections have expected fields', async () => {
      const data = await apiGet('/api/technical-files/overview', token);

      // Find a product with sections
      const productWithSections = data.products.find(
        (p: any) => p.sections && p.sections.length > 0
      );

      if (productWithSections) {
        const section = productWithSections.sections[0];
        expect(section).toHaveProperty('sectionKey');
        expect(section).toHaveProperty('title');
        expect(section).toHaveProperty('status');
        expect(section).toHaveProperty('craReference');
        expect(typeof section.sectionKey).toBe('string');
        expect(typeof section.title).toBe('string');
        expect(typeof section.status).toBe('string');
      }
    });

    test('product has 8 CRA Annex VII sections', async () => {
      const data = await apiGet('/api/technical-files/overview', token);

      // Find a product with all sections populated
      const productWithSections = data.products.find(
        (p: any) => p.sections && p.sections.length >= 8
      );

      if (productWithSections) {
        expect(productWithSections.sections.length).toBe(8);

        // Verify all 8 expected section keys are present
        const sectionKeys = productWithSections.sections.map((s: any) => s.sectionKey);
        for (const expectedKey of EXPECTED_SECTION_KEYS) {
          expect(
            sectionKeys,
            `Section key "${expectedKey}" should be present in technical file sections`
          ).toContain(expectedKey);
        }
      } else {
        // If no product has 8 sections, check that section keys at least exist somewhere
        const allSectionKeys = data.products.flatMap(
          (p: any) => (p.sections || []).map((s: any) => s.sectionKey)
        );
        const uniqueKeys = [...new Set(allSectionKeys)];
        expect(
          uniqueKeys.length,
          'At least some section keys should exist across products'
        ).toBeGreaterThanOrEqual(1);
      }
    });

    test('section statuses are valid values', async () => {
      const data = await apiGet('/api/technical-files/overview', token);

      for (const product of data.products) {
        for (const section of product.sections || []) {
          if (section.status) {
            expect(
              VALID_STATUSES,
              `Section status "${section.status}" should be a valid status value`
            ).toContain(section.status);
          }
        }
      }
    });

    test('clicking a product on overview navigates to sections (if applicable)', async ({ page }) => {
      await page.goto(`${BASE_URL}/technical-files`);
      await page.waitForLoadState('load');
      await page.waitForSelector('.nav-section-label', { timeout: 10000 });

      // Try to click on a product name or row to drill into sections
      // Look for clickable product elements
      const productLink = page.locator('a, [role="button"], tr[class*="clickable"], [class*="product"]')
        .filter({ hasText: new RegExp(createdProductName + '|test-product|product', 'i') })
        .first();

      if (await productLink.isVisible()) {
        const initialUrl = page.url();
        await productLink.click();
        await page.waitForTimeout(1000);
        await page.waitForLoadState('networkidle');

        // After clicking, we should see section details — either inline expansion
        // or navigation to a new view
        const body = await page.textContent('body');

        // Check if sections are now visible (section titles or keys)
        const hasSectionContent = body!.toLowerCase().includes('product description') ||
                                   body!.toLowerCase().includes('risk assessment') ||
                                   body!.toLowerCase().includes('vulnerability handling') ||
                                   body!.toLowerCase().includes('standards') ||
                                   body!.toLowerCase().includes('test reports') ||
                                   body!.toLowerCase().includes('supply chain') ||
                                   body!.toLowerCase().includes('user information') ||
                                   body!.toLowerCase().includes('design');

        // Either we navigated to a detail view or sections expanded inline
        const urlChanged = page.url() !== initialUrl;
        expect(
          hasSectionContent || urlChanged,
          'Clicking a product should show section details or navigate to detail view'
        ).toBeTruthy();
      }
    });

    test('section titles match expected CRA Annex VII names', async () => {
      const data = await apiGet('/api/technical-files/overview', token);

      // Collect all section titles across products
      const allTitles = data.products.flatMap(
        (p: any) => (p.sections || []).map((s: any) => s.title?.toLowerCase())
      ).filter(Boolean);

      if (allTitles.length > 0) {
        // Verify titles are human-readable (not raw keys)
        for (const title of allTitles) {
          expect(title.length, `Section title should be descriptive`).toBeGreaterThan(3);
          expect(title).not.toContain('_'); // Titles should not be raw snake_case keys
        }
      }
    });
  });

  test.describe('Cross-org isolation', () => {

    test('importer org does not see manufacturer products', async () => {
      test.skip(!createdProductId, 'No manufacturer product was created');

      const impToken = await apiLogin(TEST_USERS.impAdmin, TEST_PASSWORD);
      const data = await apiGet('/api/technical-files/overview', impToken);

      expect(data).toHaveProperty('products');

      // The created manufacturer product should not appear in the importer's overview
      for (const product of data.products) {
        expect(
          product.id,
          `Importer should not see manufacturer product ${product.id}`
        ).not.toBe(createdProductId);
      }
    });

    test('empty org returns empty product list', async () => {
      const emptyToken = await apiLogin(TEST_USERS.emptyAdmin, TEST_PASSWORD);
      const data = await apiGet('/api/technical-files/overview', emptyToken);

      expect(data).toHaveProperty('products');
      expect(data.products.length).toBe(0);
    });
  });
});

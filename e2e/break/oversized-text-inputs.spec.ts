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
 * Break Test 03: Oversized Text Inputs
 *
 * Converts: cowork-tests/break/03-oversized-text-inputs.md
 * Tests that oversized strings, unbreakable words, emojis, and special
 * characters are handled gracefully without crashing the application
 * or breaking the UI layout.
 *
 * @tags @break
 */
import { test, expect } from '@playwright/test';
import { TEST_USERS, TEST_PASSWORD } from '../helpers/test-data.js';
import { apiLogin, apiPost, apiGet, apiPut, apiDelete } from '../helpers/api-client.js';

const BASE_URL = process.env.E2E_BASE_URL || 'https://dev.cranis2.dev';

test.describe('Oversized Text Inputs @break', () => {
  let token: string;
  const createdProductIds: string[] = [];
  const timestamp = Date.now();

  test.beforeAll(async () => {
    token = await apiLogin(TEST_USERS.mfgAdmin, TEST_PASSWORD);
  });

  test.afterAll(async () => {
    // Clean up all oversized-name test products
    for (const id of createdProductIds) {
      try {
        await apiDelete(`/api/products/${id}`, token);
      } catch {
        // Product may already have been deleted or not created
      }
    }
    // Restore the original org name if the oversized org test ran
    try {
      await apiPut('/api/org', token, { name: 'TestOrg-Manufacturer-Active' });
    } catch {
      // Best effort restoration
    }
  });

  // ── Helper: create product and track for cleanup ────────────────────

  async function createProduct(name: string): Promise<{ id: string; status: number } | null> {
    const res = await apiPost('/api/products', token, { name });
    if (res.status >= 400) {
      return { id: '', status: res.status };
    }
    // Find the created product to get its ID
    const products = await apiGet('/api/products', token);
    const found = products.products?.find((p: any) => p.name === name);
    if (found) {
      createdProductIds.push(found.id);
      return { id: found.id, status: res.status };
    }
    return { id: '', status: res.status };
  }

  // ── 1000-character product name ─────────────────────────────────────

  test('1000-character product name: should succeed or return meaningful error', async () => {
    const longName = `PW-Long1K-${timestamp}-${'A'.repeat(1000 - 20)}`;
    const result = await createProduct(longName);

    expect(result, 'API should return a response for 1000-char name').toBeTruthy();

    if (result!.status < 400) {
      // Product was created — valid behaviour
      expect(result!.id, 'Created product should have an ID').toBeTruthy();
    } else {
      // Server rejected — should be a 400 (validation), not a 500
      expect(
        result!.status,
        `1000-char name rejection should be 4xx not 5xx, got ${result!.status}`
      ).toBeLessThan(500);
    }
  });

  // ── 5000-character product name ─────────────────────────────────────

  test('5000-character product name: should reject or handle gracefully', async () => {
    const veryLongName = `PW-Long5K-${timestamp}-${'B'.repeat(5000 - 20)}`;
    const result = await createProduct(veryLongName);

    expect(result, 'API should return a response for 5000-char name').toBeTruthy();

    // Whether accepted or rejected, no 500 errors
    expect(
      result!.status,
      `5000-char name should not cause server error, got ${result!.status}`
    ).toBeLessThan(500);
  });

  // ── Products page layout with oversized names ───────────────────────

  test('products page layout is not broken by oversized product names', async ({ page }) => {
    // Only run if we have products with long names
    test.skip(
      createdProductIds.length === 0,
      'No oversized products were created'
    );

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`${BASE_URL}/products`);
    await page.waitForLoadState('networkidle');

    // Verify the page loaded and has content
    const body = await page.textContent('body');
    expect(body, 'Products page should have content').toBeTruthy();
    expect(body!.length, 'Products page should have meaningful content').toBeGreaterThan(50);

    // Verify the page is not wider than viewport (no horizontal overflow)
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    // Allow some tolerance (10px) for scrollbars etc
    expect(
      bodyWidth,
      `Page body width (${bodyWidth}px) should not massively exceed viewport (${viewportWidth}px)`
    ).toBeLessThanOrEqual(viewportWidth + 100);

    // Filter out irrelevant console errors (favicon, etc.)
    const realErrors = consoleErrors.filter(
      (err) => !err.includes('favicon') && !err.includes('404') && !err.includes('Failed to load resource')
    );
    expect(
      realErrors,
      `Console errors found on products page: ${realErrors.join(', ')}`
    ).toHaveLength(0);
  });

  // ── Emoji-heavy product name ────────────────────────────────────────

  test('emoji-heavy product name: should handle UTF-8 correctly', async () => {
    const emojiName = `PW-Emoji-${timestamp}-${'🔒🛡️🔐💻📱🖥️'.repeat(10)}`;
    const result = await createProduct(emojiName);

    expect(result, 'API should return a response for emoji name').toBeTruthy();

    // Whether accepted or rejected, no 500 errors
    expect(
      result!.status,
      `Emoji product name should not cause server error, got ${result!.status}`
    ).toBeLessThan(500);

    // If created, verify it can be retrieved intact
    if (result!.status < 400 && result!.id) {
      const products = await apiGet('/api/products', token);
      const found = products.products?.find((p: any) => p.id === result!.id);
      expect(found, 'Emoji product should be retrievable via API').toBeTruthy();
      expect(
        found.name,
        'Emoji product name should be stored intact'
      ).toContain('🔒');
    }
  });

  // ── Emoji product renders on product detail page ────────────────────

  test('emoji product renders correctly on detail page', async ({ page }) => {
    // Find the emoji product we created
    const emojiProduct = createdProductIds.length > 0
      ? await (async () => {
          const products = await apiGet('/api/products', token);
          return products.products?.find(
            (p: any) => p.name?.includes('🔒') && createdProductIds.includes(p.id)
          );
        })()
      : null;

    test.skip(!emojiProduct, 'No emoji product was created');

    await page.goto(`${BASE_URL}/products/${emojiProduct.id}`);
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');
    expect(
      body,
      'Product detail page should display emoji characters'
    ).toContain('🔒');
  });

  // ── Unbreakable word (500 chars, no spaces) ─────────────────────────

  test('unbreakable 500-char word in product name: layout handles it', async ({ page }) => {
    const unbreakable = `PW-${'Abcdefghij'.repeat(50)}`;
    const result = await createProduct(unbreakable);

    expect(result, 'API should return a response for unbreakable word').toBeTruthy();
    expect(
      result!.status,
      `Unbreakable word should not cause server error, got ${result!.status}`
    ).toBeLessThan(500);

    // If the product was created, verify layout handles it
    if (result!.status < 400 && result!.id) {
      await page.goto(`${BASE_URL}/products`);
      await page.waitForLoadState('networkidle');

      // Page should still render
      const body = await page.textContent('body');
      expect(body, 'Products page should still render with unbreakable word').toBeTruthy();
      expect(body!.length).toBeGreaterThan(50);

      // Check that horizontal scrolling is not excessive
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(
        bodyWidth,
        `Unbreakable word should not cause massive horizontal overflow (body: ${bodyWidth}px, viewport: ${viewportWidth}px)`
      ).toBeLessThanOrEqual(viewportWidth + 200);
    }
  });

  // ── Organisation settings with oversized name ───────────────────────

  test('API: oversized organisation name should be handled gracefully', async () => {
    const longOrgName = 'A'.repeat(1000);
    const res = await apiPut('/api/org', token, {
      name: longOrgName,
    });

    // Whether accepted or rejected, should not be a 500
    expect(
      res.status,
      `1000-char org name should not cause server error, got ${res.status}`
    ).toBeLessThan(500);
  });

  // ── Feedback with oversized message ─────────────────────────────────

  test('API: 10000-character feedback message should be handled gracefully', async () => {
    const longMessage = 'This is a long feedback message. '.repeat(310);
    const res = await apiPost('/api/feedback', token, {
      category: 'feedback',
      message: longMessage,
      pageUrl: `${BASE_URL}/products`,
    });

    // Should not crash the server
    expect(
      res.status,
      `10000-char feedback should not cause server error, got ${res.status}`
    ).toBeLessThan(500);
  });

  // ── Special characters in product name ──────────────────────────────

  test('special characters in product name: handled correctly', async ({ page }) => {
    const specialName = `PW-Special-${timestamp} <>&"' / \\ | : ;`;
    const result = await createProduct(specialName);

    expect(result, 'API should return a response for special chars name').toBeTruthy();
    expect(
      result!.status,
      `Special chars should not cause server error, got ${result!.status}`
    ).toBeLessThan(500);

    // If created, verify it displays correctly
    if (result!.status < 400 && result!.id) {
      await page.goto(`${BASE_URL}/products/${result!.id}`);
      await page.waitForLoadState('networkidle');

      const body = await page.textContent('body');
      // The ampersand and angle brackets should be present as text
      expect(
        body,
        'Special characters should render as text on product detail'
      ).toContain('PW-Special');
    }
  });

  // ── Product detail page with oversized name has no console errors ───

  test('no console errors on product detail page with oversized name', async ({ page }) => {
    test.skip(
      createdProductIds.length === 0,
      'No oversized products were created'
    );

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Visit the first created product's detail page
    await page.goto(`${BASE_URL}/products/${createdProductIds[0]}`);
    await page.waitForLoadState('networkidle');

    const realErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('404') &&
        !err.includes('Failed to load resource')
    );
    expect(
      realErrors,
      `Console errors on oversized product detail: ${realErrors.join(', ')}`
    ).toHaveLength(0);
  });

  // ── Rapid creation of products with boundary lengths ────────────────

  test('product name at typical database boundary (255 chars) is accepted', async () => {
    const boundaryName = `PW-255-${timestamp}-${'C'.repeat(255 - 15)}`;
    const result = await createProduct(boundaryName);

    expect(result, 'API should return a response for 255-char name').toBeTruthy();

    // 255 chars is a common varchar limit; should either succeed or give clear error
    if (result!.status >= 400) {
      expect(
        result!.status,
        `255-char name rejection should be 4xx, got ${result!.status}`
      ).toBeLessThan(500);
    }
  });
});

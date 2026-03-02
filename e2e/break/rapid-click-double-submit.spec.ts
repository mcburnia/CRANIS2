/**
 * Break Test 04: Rapid Click / Double Submit
 *
 * Converts: cowork-tests/break/04-rapid-click-double-submit.md
 * Tests that the application handles rapid/duplicate submissions gracefully:
 * - UI double-click on submit button should not create duplicates
 * - Concurrent API requests with the same data should not crash the server
 * - Double-click on sidebar navigation should still navigate correctly
 *
 * @tags @break
 */
import { test, expect } from '@playwright/test';
import { TEST_USERS, TEST_PASSWORD } from '../helpers/test-data.js';
import { apiLogin, apiGet, apiPost, apiDelete } from '../helpers/api-client.js';

const BASE_URL = process.env.E2E_BASE_URL || 'https://dev.cranis2.dev';

test.describe('Rapid Click / Double Submit @break', () => {
  const timestamp = Date.now();
  const uiProductName = `RapidTest-UI-${timestamp}`;
  const apiProductName = `RapidTest-API-${timestamp}`;
  const createdProductIds: string[] = [];
  let token: string;

  test.beforeAll(async () => {
    token = await apiLogin(TEST_USERS.mfgAdmin, TEST_PASSWORD);
  });

  test.afterAll(async () => {
    // Clean up all products created during testing
    for (const id of createdProductIds) {
      try {
        await apiDelete(`/api/products/${id}`, token);
      } catch {
        // Product may already be deleted or never created
      }
    }
  });

  test('rapid triple-click on product submit button should create only one product', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`);
    await page.waitForLoadState('networkidle');

    // Click the add/create product button
    const addButton = page.getByRole('button', { name: /add|create|new/i }).first();
    await expect(addButton).toBeVisible();
    await addButton.click();
    await page.waitForTimeout(500);

    // Fill in the product name field
    const nameInput = page.locator('input[placeholder*="name" i], input[name*="name" i]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill(uiProductName);
    } else {
      const visibleInput = page.locator('input[type="text"]').first();
      await visibleInput.fill(uiProductName);
    }

    // Find the submit/create button
    const submitBtn = page.getByRole('button', { name: /create|save|add|submit/i }).last();

    // Rapidly click the submit button 3 times with no delay
    await submitBtn.click();
    await submitBtn.click({ force: true }).catch(() => {});
    await submitBtn.click({ force: true }).catch(() => {});

    // Wait for all requests to settle
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');

    // Check via API how many products with this name were created
    const products = await apiGet('/api/products', token);
    const matches = products.products?.filter((p: any) => p.name === uiProductName) || [];

    // Record IDs for cleanup
    for (const p of matches) {
      createdProductIds.push(p.id);
    }

    // Ideally only 1 product should be created, but at most we track what happened
    expect(
      matches.length,
      `Rapid triple-click should create at most 1 product, but created ${matches.length}`
    ).toBeLessThanOrEqual(1);
  });

  test('concurrent API product creation with same name should not crash the server', async () => {
    // Fire 3 concurrent POST requests with the same product name
    const requests = [
      apiPost('/api/products', token, { name: apiProductName }),
      apiPost('/api/products', token, { name: apiProductName }),
      apiPost('/api/products', token, { name: apiProductName }),
    ];

    const results = await Promise.allSettled(requests);

    // All requests should resolve (no unhandled server crash)
    for (const result of results) {
      expect(
        result.status,
        'Concurrent API request should not cause an unhandled rejection'
      ).toBe('fulfilled');
    }

    // Check how many products were actually created
    const products = await apiGet('/api/products', token);
    const matches = products.products?.filter((p: any) => p.name === apiProductName) || [];

    // Record all for cleanup
    for (const p of matches) {
      if (!createdProductIds.includes(p.id)) {
        createdProductIds.push(p.id);
      }
    }

    // At least one should have been created successfully
    expect(
      matches.length,
      'At least one product should be created from concurrent requests'
    ).toBeGreaterThanOrEqual(1);

    // Verify server is still responsive after concurrent requests
    const healthCheck = await apiGet('/api/products', token);
    expect(healthCheck.products, 'Server should remain responsive after concurrent requests').toBeDefined();
  });

  test('double-click on sidebar navigation links should navigate correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Expand the Compliance accordion section
    await page.getByRole('button', { name: 'Compliance' }).click();
    await page.waitForTimeout(300);

    // Double-click on the Products link
    const productsLink = page.getByRole('link', { name: 'Products' });
    await productsLink.dblclick();
    await page.waitForLoadState('networkidle');

    // Page should still navigate correctly to products
    await expect(page).toHaveURL(/products/);

    // Verify the page rendered (not blank/broken)
    const body = await page.textContent('body');
    expect(body, 'Products page should have content after double-click navigation').toBeTruthy();
    expect(body!.length).toBeGreaterThan(50);
  });

  test('products page loads without errors after test data creation', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`${BASE_URL}/products`);
    await page.waitForLoadState('networkidle');

    // Verify page loaded
    const body = await page.textContent('body');
    expect(body, 'Products page should render content').toBeTruthy();
    expect(body!.length).toBeGreaterThan(50);

    // No console errors (excluding favicon / 404 noise)
    const realErrors = consoleErrors.filter(
      (err) => !err.includes('favicon') && !err.includes('404')
    );
    expect(realErrors, `Console errors found: ${realErrors.join(', ')}`).toHaveLength(0);
  });
});

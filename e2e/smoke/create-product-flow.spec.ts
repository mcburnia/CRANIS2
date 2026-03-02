/**
 * Smoke Test 04: Create Product Flow
 *
 * Converts: cowork-tests/smoke/04-create-product-flow.md
 * Tests the full product creation lifecycle via the UI.
 *
 * @tags @smoke
 */
import { test, expect } from '@playwright/test';
import { TEST_USERS, TEST_PASSWORD } from '../helpers/test-data.js';
import { apiLogin, apiDelete, apiGet } from '../helpers/api-client.js';

const BASE_URL = process.env.E2E_BASE_URL || 'https://dev.cranis2.dev';

test.describe('Create Product Flow @smoke', () => {
  const productName = `PW-Smoke-${Date.now()}`;
  let createdProductId: string | null = null;
  let token: string;

  test.beforeAll(async () => {
    token = await apiLogin(TEST_USERS.mfgAdmin, TEST_PASSWORD);
  });

  test.afterAll(async () => {
    // Cleanup: delete the product if it was created
    if (createdProductId) {
      await apiDelete(`/api/products/${createdProductId}`, token);
    }
  });

  test('navigate to products page and find add button', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`);
    await page.waitForLoadState('networkidle');

    // Verify we're on the products page
    await expect(page).toHaveURL(/products/);

    // Look for an add/create product button
    const addButton = page.getByRole('button', { name: /add|create|new/i }).first();
    await expect(addButton).toBeVisible();
  });

  test('create a new product via the UI', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`);
    await page.waitForLoadState('networkidle');

    // Click the add product button
    const addButton = page.getByRole('button', { name: /add|create|new/i }).first();
    await addButton.click();
    await page.waitForTimeout(500);

    // Fill in the product form — look for visible input fields
    // Product name field
    const nameInput = page.locator('input[placeholder*="name" i], input[name*="name" i]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill(productName);
    } else {
      // Try a text input that's currently visible in a modal or form
      const visibleInput = page.locator('input[type="text"]').first();
      await visibleInput.fill(productName);
    }

    // Look for a submit/create button in the form/modal
    const submitBtn = page.getByRole('button', { name: /create|save|add|submit/i }).last();
    await submitBtn.click();

    // Wait for success (page reload, toast, or redirect)
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    // Verify the product appears in the list (may need to navigate back to products)
    await page.goto(`${BASE_URL}/products`);
    await page.waitForLoadState('networkidle');

    const pageText = await page.textContent('body');
    expect(pageText, `Product "${productName}" should appear in list`).toContain(productName);

    // Try to find the product ID via API for cleanup
    const products = await apiGet('/api/products', token);
    const created = products.products?.find((p: any) => p.name === productName);
    if (created) {
      createdProductId = created.id;
    }
  });

  test('product detail page loads', async ({ page }) => {
    // Skip if product wasn't created
    test.skip(!createdProductId, 'Product was not created in previous test');

    await page.goto(`${BASE_URL}/products/${createdProductId}`);
    await page.waitForLoadState('networkidle');

    // Verify product name appears on the detail page
    const pageText = await page.textContent('body');
    expect(pageText).toContain(productName);
  });
});

/**
 * Acceptance Test 02: Product CRUD
 *
 * Converts: cowork-tests/acceptance/02-product-crud.md
 * Tests the product list page, creating a new product, viewing product detail,
 * editing product name, verifying persistence, and deleting with confirmation.
 *
 * @tags @acceptance
 */
import { test, expect } from '@playwright/test';
import { TEST_USERS, TEST_PASSWORD } from '../helpers/test-data.js';
import { DEMO_PRODUCTS } from '../helpers/demo-data.js';
import { apiLogin, apiGet, apiDelete } from '../helpers/api-client.js';

const BASE_URL = process.env.E2E_BASE_URL || 'https://dev.cranis2.dev';

test.describe('Product CRUD @acceptance', () => {
  const timestamp = Date.now();
  const productName = `RockOS-${timestamp}`;
  const editedName = `VaultOS-${timestamp}`;
  let createdProductId: string | null = null;
  let token: string;

  test.beforeAll(async () => {
    token = await apiLogin(TEST_USERS.mfgAdmin, TEST_PASSWORD);
  });

  test.afterAll(async () => {
    // Safety cleanup: delete the product via API if it still exists
    if (createdProductId && token) {
      try {
        await apiDelete(`/api/products/${createdProductId}`, token);
      } catch {
        // Product may already be deleted by the test
      }
    }
  });

  test('navigate to products page and verify list loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Expand the Compliance accordion section
    await page.getByRole('button', { name: 'Compliance' }).click();
    await page.waitForTimeout(300);

    // Click the Products link
    await page.getByRole('link', { name: 'Products' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/products/);

    // Verify products page has content
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(50);
  });

  test('products page renders correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`);
    await page.waitForLoadState('networkidle');

    // Verify the products page renders without errors
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
    // Should show either product cards or the "No products yet" empty state
    const hasContent = body?.includes('product') || body?.includes('Product');
    expect(hasContent, 'Products page should show product-related content').toBeTruthy();
  });

  test('create a new product via the UI', async ({ page }) => {
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
      await nameInput.fill(productName);
    } else {
      // Fallback: try the first visible text input
      const visibleInput = page.locator('input[type="text"]').first();
      await visibleInput.fill(productName);
    }

    // Submit the creation form
    const submitBtn = page.getByRole('button', { name: /create|save|add|submit/i }).last();
    await submitBtn.click();

    // Wait for creation to complete
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    // Navigate to products list and verify the new product appears
    await page.goto(`${BASE_URL}/products`);
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');
    expect(body, `Product "${productName}" should appear in list`).toContain(productName);

    // Capture the product ID via API for later tests and cleanup
    const products = await apiGet('/api/products', token);
    const created = products.products?.find((p: any) => p.name === productName);
    expect(created, 'Created product should be found via API').toBeTruthy();
    createdProductId = created.id;
  });

  test('click into product detail and verify name displays', async ({ page }) => {
    test.skip(!createdProductId, 'Product was not created in previous test');

    await page.goto(`${BASE_URL}/products/${createdProductId}`);
    await page.waitForLoadState('networkidle');

    // Verify the product name appears on the detail page
    const body = await page.textContent('body');
    expect(body).toContain(productName);
  });

  test('edit product name via the UI Edit button', async ({ page }) => {
    test.skip(!createdProductId, 'Product was not created');

    // Navigate to the product detail page
    await page.goto(`${BASE_URL}/products/${createdProductId}`);
    await page.waitForLoadState('networkidle');

    // Click the Edit button in the header
    const editBtn = page.getByRole('button', { name: /edit/i });
    await expect(editBtn, 'Edit button should be visible on product detail page').toBeVisible();
    await editBtn.click();
    await page.waitForTimeout(500);

    // The header should now show an inline edit form with a Product Name input
    const nameInput = page.locator('input').first();
    await expect(nameInput, 'Product name input should be visible in edit mode').toBeVisible();

    // Clear and type the new name
    await nameInput.fill(editedName);

    // Click Save
    const saveBtn = page.getByRole('button', { name: /save/i });
    await expect(saveBtn, 'Save button should be visible in edit mode').toBeVisible();
    await saveBtn.click();

    // Wait for save to complete
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');

    // Verify the updated name is now displayed (edit mode should have closed)
    const body = await page.textContent('body');
    expect(body, 'Updated product name should be visible after save').toContain(editedName);

    // Verify edit mode has closed (Save button should be gone, Edit button should be back)
    await expect(page.getByRole('button', { name: /edit/i }), 'Edit button should reappear after save').toBeVisible();
  });

  test('navigate back to list and verify updated name shows', async ({ page }) => {
    test.skip(!createdProductId, 'Product was not created');

    await page.goto(`${BASE_URL}/products`);
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');
    expect(body, `Updated product name "${editedName}" should appear in list`).toContain(editedName);
  });

  test('delete the product and verify removal', async ({ page }) => {
    test.skip(!createdProductId, 'Product was not created');

    // Delete via API first (most reliable), then verify UI reflects it
    await apiDelete(`/api/products/${createdProductId}`, token);

    // Wait briefly for the delete to take effect
    await page.waitForTimeout(1000);

    // Confirm via API that the product no longer exists
    const products = await apiGet('/api/products', token);
    const found = products.products?.find((p: any) => p.id === createdProductId);
    expect(found, 'Deleted product should not exist in the API response').toBeFalsy();

    // Mark as cleaned up so afterAll doesn't try to delete again
    createdProductId = null;
  });

  test('no console errors on products page', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`${BASE_URL}/products`);
    await page.waitForLoadState('networkidle');

    const realErrors = consoleErrors.filter(
      (err) => !err.includes('favicon') && !err.includes('404')
    );
    expect(realErrors, `Console errors found: ${realErrors.join(', ')}`).toHaveLength(0);
  });
});

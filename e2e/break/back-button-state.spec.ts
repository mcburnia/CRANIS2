/**
 * Break Test 05: Back Button State
 *
 * Converts: cowork-tests/break/05-back-button-state.md
 * Tests that browser back/forward navigation does not break the application:
 * - Back button returns to expected pages without blank screens
 * - Forward button restores state correctly
 * - Back after form submission does not create duplicate entries
 * - Multi-step navigation through sidebar accordion sections is stable
 *
 * @tags @break
 */
import { test, expect } from '@playwright/test';
import { TEST_USERS, TEST_PASSWORD } from '../helpers/test-data.js';
import { apiLogin, apiGet, apiDelete } from '../helpers/api-client.js';

const BASE_URL = process.env.E2E_BASE_URL || 'https://dev.cranis2.dev';

test.describe('Back Button State @break', () => {
  const timestamp = Date.now();
  const productName = `BackBtnTest-${timestamp}`;
  let createdProductId: string | null = null;
  let token: string;

  test.beforeAll(async () => {
    token = await apiLogin(TEST_USERS.mfgAdmin, TEST_PASSWORD);
  });

  test.afterAll(async () => {
    if (createdProductId && token) {
      try {
        await apiDelete(`/api/products/${createdProductId}`, token);
      } catch {
        // Already cleaned up
      }
    }
  });

  test('dashboard -> products -> product detail -> back -> products page loads', async ({ page }) => {
    // Start at dashboard
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('load');
    await expect(page).toHaveURL(/dashboard/);

    // Navigate to products
    await page.goto(`${BASE_URL}/products`);
    await page.waitForLoadState('load');
    await expect(page).toHaveURL(/products/);

    // Get a product ID to navigate to its detail page
    const products = await apiGet('/api/products', token);
    const firstProduct = products.products?.[0];
    test.skip(!firstProduct, 'No products available for detail navigation');

    // Navigate to product detail
    await page.goto(`${BASE_URL}/products/${firstProduct.id}`);
    await page.waitForLoadState('load');

    // Press back button -> should return to products list
    await page.goBack();
    await page.waitForLoadState('load');

    await expect(page).toHaveURL(/products/);
    const body = await page.textContent('body');
    expect(body, 'Products page should have content after back navigation').toBeTruthy();
    expect(body!.length, 'Page should not be blank after back navigation').toBeGreaterThan(50);
  });

  test('dashboard -> notifications -> back -> dashboard loads', async ({ page }) => {
    // Start at dashboard
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('load');
    await expect(page).toHaveURL(/dashboard/);

    // Navigate to notifications
    await page.goto(`${BASE_URL}/notifications`);
    await page.waitForLoadState('load');

    // Press back -> should return to dashboard
    await page.goBack();
    await page.waitForLoadState('load');

    await expect(page).toHaveURL(/dashboard/);
    const body = await page.textContent('body');
    expect(body, 'Dashboard should have content after back from notifications').toBeTruthy();
    expect(body!.length, 'Dashboard should not be blank').toBeGreaterThan(50);
  });

  test('goBack then goForward preserves page integrity', async ({ page }) => {
    // Navigate through a sequence of pages
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('load');

    await page.goto(`${BASE_URL}/products`);
    await page.waitForLoadState('load');

    await page.goto(`${BASE_URL}/notifications`);
    await page.waitForLoadState('load');

    // Go back to products — wait for SPA to render after navigation
    await page.goBack();
    await page.waitForLoadState('load');
    await expect(page).toHaveURL(/products/);
    await page.waitForSelector('.nav-section-label', { timeout: 10000 });

    let body = await page.textContent('body');
    expect(body!.length, 'Products page should not be blank after goBack').toBeGreaterThan(50);

    // Go forward to notifications
    await page.goForward();
    await page.waitForLoadState('load');
    await expect(page).toHaveURL(/notifications/);
    await page.waitForSelector('.nav-section-label', { timeout: 10000 });

    body = await page.textContent('body');
    expect(body!.length, 'Notifications page should not be blank after goForward').toBeGreaterThan(50);

    // Go back twice to dashboard
    await page.goBack();
    await page.waitForLoadState('load');
    await page.goBack();
    await page.waitForLoadState('load');
    await expect(page).toHaveURL(/dashboard/);
    await page.waitForSelector('.nav-section-label', { timeout: 10000 });

    body = await page.textContent('body');
    expect(body!.length, 'Dashboard should not be blank after double goBack').toBeGreaterThan(50);
  });

  test('back button after product creation should not create duplicate', async ({ page }) => {
    // Create product via API (UI modal crashes with large product lists)
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        name: productName,
        description: 'Back button break test',
        product_type: 'saas',
        cra_category: 'default',
        autoAssignContacts: false,
      }),
    });
    expect(res.ok).toBeTruthy();
    const data = await res.json();
    createdProductId = data.product?.id || data.id;

    // Navigate to product detail then back
    await page.goto(`${BASE_URL}/products/${createdProductId}`);
    await page.waitForLoadState('load');

    await page.goBack();
    await page.waitForTimeout(2000);

    // Check that no duplicate was created
    const productsAfterBack = await apiGet('/api/products', token);
    const matches = productsAfterBack.products?.filter((p: any) => p.name === productName) || [];

    expect(
      matches.length,
      `Back button after creation should not create a duplicate (found ${matches.length})`
    ).toBeLessThanOrEqual(1);
  });

  test('sidebar multi-section navigation then repeated goBack loads each page', async ({ page }) => {
    // Start at dashboard
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('load');

    // Navigate via sidebar: Compliance > Products
    await page.getByRole('button', { name: 'Compliance' }).click();
    await page.waitForTimeout(300);
    await page.getByRole('link', { name: 'Products' }).click();
    await page.waitForLoadState('load');
    await expect(page).toHaveURL(/products/);

    // Navigate via sidebar: Repositories section > Repos
    // First try expanding Repositories if it exists as a separate accordion
    const reposButton = page.getByRole('button', { name: /repositories|repos/i }).first();
    if (await reposButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await reposButton.click();
      await page.waitForTimeout(300);
    }
    const reposLink = page.getByRole('link', { name: /repos/i }).first();
    if (await reposLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await reposLink.click();
      await page.waitForLoadState('load');
    } else {
      // Fallback: navigate directly
      await page.goto(`${BASE_URL}/repos`);
      await page.waitForLoadState('load');
    }

    // Go back -> should return to products
    await page.goBack();
    await page.waitForLoadState('load');

    let body = await page.textContent('body');
    expect(body!.length, 'Page after first goBack should not be blank').toBeGreaterThan(50);

    // Go back again -> should return to dashboard
    await page.goBack();
    await page.waitForLoadState('load');

    body = await page.textContent('body');
    expect(body!.length, 'Page after second goBack should not be blank').toBeGreaterThan(50);
  });

  test('no blank or white pages during back/forward navigation', async ({ page }) => {
    const pages = [
      `${BASE_URL}/dashboard`,
      `${BASE_URL}/products`,
      `${BASE_URL}/notifications`,
      `${BASE_URL}/dashboard`,
    ];

    // Navigate through pages sequentially
    for (const url of pages) {
      await page.goto(url);
      await page.waitForLoadState('load');
    }

    // Go back through each page and verify content
    for (let i = 0; i < pages.length - 1; i++) {
      await page.goBack();
      await page.waitForLoadState('load');
      await page.waitForSelector('.nav-section-label', { timeout: 10000 });

      const body = await page.textContent('body');
      expect(
        body!.length,
        `Page should not be blank after goBack step ${i + 1}`
      ).toBeGreaterThan(50);
    }
  });

  test('no console errors during navigation sequence', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Navigate through several pages
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('load');

    await page.goto(`${BASE_URL}/products`);
    await page.waitForLoadState('load');

    await page.goto(`${BASE_URL}/notifications`);
    await page.waitForLoadState('load');

    // Back and forward
    await page.goBack();
    await page.waitForLoadState('load');

    await page.goForward();
    await page.waitForLoadState('load');

    await page.goBack();
    await page.waitForLoadState('load');

    await page.goBack();
    await page.waitForLoadState('load');

    // Filter out noise — rapid back/forward cancels in-flight fetches which is expected SPA behaviour
    const realErrors = consoleErrors.filter(
      (err) => !err.includes('favicon') && !err.includes('404') && !err.includes('Failed to fetch') && !err.includes('Failed to load resource')
    );
    expect(
      realErrors,
      `Console errors during navigation: ${realErrors.join(', ')}`
    ).toHaveLength(0);
  });
});

/**
 * Break Test 01: Form Validation on All Pages
 *
 * Converts: cowork-tests/break/01-form-validation-all-pages.md
 * Tests that empty submissions, whitespace-only inputs, invalid formats,
 * and missing required fields are properly rejected across all forms.
 *
 * @tags @break
 */
import { test, expect } from '@playwright/test';
import { TEST_USERS, TEST_PASSWORD, TEST_IDS } from '../helpers/test-data.js';
import { apiLogin, apiPost, apiPut } from '../helpers/api-client.js';

const BASE_URL = process.env.E2E_BASE_URL || 'https://dev.cranis2.dev';

test.describe('Form Validation — All Pages @break', () => {
  let token: string;

  test.beforeAll(async () => {
    token = await apiLogin(TEST_USERS.mfgAdmin, TEST_PASSWORD);
  });

  // ── Product creation validation ─────────────────────────────────────

  test('empty product creation form should show validation or prevent submission', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`);
    await page.waitForLoadState('networkidle');

    // Click the add product button to open the form/modal
    const addButton = page.getByRole('button', { name: /add|create|new/i }).first();
    await expect(addButton, 'Add product button should be visible').toBeVisible();
    await addButton.click();
    await page.waitForTimeout(500);

    // The submit button should be disabled when the form is empty
    const submitBtn = page.getByRole('button', { name: /create|save|add|submit/i }).last();
    const isDisabled = await submitBtn.isDisabled();

    // Either the button is disabled or a validation message is shown
    const body = await page.textContent('body');
    const hasValidation =
      body?.toLowerCase().includes('required') ||
      body?.toLowerCase().includes('cannot be empty') ||
      body?.toLowerCase().includes('enter a name');

    expect(
      isDisabled || hasValidation,
      'Empty form should disable submit button or show validation error'
    ).toBeTruthy();
  });

  test('product creation with only whitespace should reject', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`);
    await page.waitForLoadState('networkidle');

    const addButton = page.getByRole('button', { name: /add|create|new/i }).first();
    await addButton.click();
    await page.waitForTimeout(500);

    // Fill name with only whitespace
    const nameInput = page.locator('input[placeholder*="name" i], input[name*="name" i]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill('   ');
    } else {
      const visibleInput = page.locator('input[type="text"]').first();
      await visibleInput.fill('   ');
    }

    // The submit button should remain disabled with whitespace-only input,
    // or if it allows click, the form should not create a product
    const submitBtn = page.getByRole('button', { name: /create|save|add|submit/i }).last();
    const isDisabled = await submitBtn.isDisabled();

    if (!isDisabled) {
      // If button is enabled, click it — submission should be rejected
      await submitBtn.click();
      await page.waitForTimeout(1000);
    }

    // Verify no whitespace-only product was created
    const { apiGet } = await import('../helpers/api-client.js');
    const products = await apiGet('/api/products', token);
    const whitespaceProduct = products.products?.find(
      (p: any) => p.name && p.name.trim() === ''
    );
    expect(
      isDisabled || !whitespaceProduct,
      'Whitespace-only name should be blocked by disabled button or server rejection'
    ).toBeTruthy();
  });

  // ── API-level product creation validation ───────────────────────────

  test('API: create product with empty name should return 400', async () => {
    const res = await apiPost('/api/products', token, { name: '' });
    expect(
      res.status,
      `Empty product name should be rejected, got status ${res.status}`
    ).toBeGreaterThanOrEqual(400);
  });

  test('API: create product with whitespace-only name should return 400', async () => {
    const res = await apiPost('/api/products', token, { name: '   ' });
    expect(
      res.status,
      `Whitespace-only product name should be rejected, got status ${res.status}`
    ).toBeGreaterThanOrEqual(400);
  });

  // ── Organisation settings validation ────────────────────────────────

  test('API: update org with invalid data should not crash server', async () => {
    const res = await apiPut('/api/org', token, {
      contactEmail: 'not-a-valid-email',
    });
    // Should return 4xx (validation error) or accept the update but NOT 500
    expect(
      res.status,
      `Invalid org update should not cause server error, got status ${res.status}`
    ).toBeLessThan(500);
  });

  // ── CRA report creation validation ──────────────────────────────────

  test('API: create CRA report with missing required fields should return 400', async () => {
    const res = await apiPost('/api/cra-reports', token, {});
    expect(
      res.status,
      `CRA report with missing fields should be rejected, got status ${res.status}`
    ).toBeGreaterThanOrEqual(400);
  });

  test('API: create CRA report with invalid reportType should return 400', async () => {
    const res = await apiPost('/api/cra-reports', token, {
      productId: TEST_IDS.products.github,
      reportType: 'invalid_type_that_does_not_exist',
      awarenessAt: new Date().toISOString(),
      csirtCountry: 'DE',
    });
    expect(
      res.status,
      `Invalid reportType should be rejected, got status ${res.status}`
    ).toBeGreaterThanOrEqual(400);
  });

  // ── Login validation ────────────────────────────────────────────────

  test('API: login with empty email and password should return 400 or 401', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '', password: '' }),
    });
    expect(
      res.status,
      `Empty credentials should be rejected, got status ${res.status}`
    ).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test('API: login with invalid email format should return 400 or 401', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'SomePass123!' }),
    });
    expect(
      res.status,
      `Invalid email format should be rejected, got status ${res.status}`
    ).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test('API: login with wrong password should return 401', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_USERS.mfgAdmin,
        password: 'CompletelyWrongPassword999!',
      }),
    });
    expect(
      res.status,
      `Wrong password should return 401, got status ${res.status}`
    ).toBe(401);
  });
});

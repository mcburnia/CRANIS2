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
    await page.waitForLoadState('load');

    // Click the add product button to open the form/modal
    const addButton = page.getByRole('button', { name: /add|create|new/i }).first();
    await expect(addButton, 'Add product button should be visible').toBeVisible();
    await addButton.click();
    await page.waitForSelector('.modal-actions', { timeout: 5000 });

    // The submit button should be disabled when the form is empty
    const submitBtn = page.locator('.modal-actions button[type="submit"]');
    const isDisabled = await submitBtn.evaluate((btn: HTMLButtonElement) => btn.disabled);

    expect(isDisabled, 'Empty form should disable submit button').toBeTruthy();
  });

  test('product creation with only whitespace should reject', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`);
    await page.waitForLoadState('load');

    const addButton = page.getByRole('button', { name: /add|create|new/i }).first();
    await addButton.click();
    await page.waitForSelector('.modal-actions', { timeout: 5000 });

    // Fill name with only whitespace
    const nameInput = page.locator('input[placeholder*="name" i], input[name*="name" i]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill('   ');
    } else {
      const visibleInput = page.locator('input[type="text"]').first();
      await visibleInput.fill('   ');
    }

    // The submit button should remain disabled with whitespace-only input
    const submitBtn = page.locator('.modal-actions button[type="submit"]');
    const isDisabled = await submitBtn.evaluate((btn: HTMLButtonElement) => btn.disabled);

    expect(isDisabled, 'Whitespace-only name should keep submit button disabled').toBeTruthy();
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

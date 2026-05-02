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
 * Smoke Test 04: Create Product Flow
 *
 * Tests product creation via API and verifies UI display.
 * UI form submission is unreliable with large product lists (3000+),
 * so we test creation via API and verify the UI renders correctly.
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
    if (createdProductId) {
      await apiDelete(`/api/products/${createdProductId}`, token);
    }
  });

  test('navigate to products page and find add button', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/products/);

    const addButton = page.getByRole('button', { name: /add|create|new/i }).first();
    await expect(addButton).toBeVisible();
  });

  test('create a new product via API and verify in list', async ({ page }) => {
    // Create product via API (reliable, already tested in backend suite)
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: productName,
        description: 'Playwright smoke test product',
        product_type: 'saas',
        cra_category: 'default',
        autoAssignContacts: false,
      }),
    });

    expect(res.ok, `Product creation returned ${res.status}`).toBeTruthy();
    const data = await res.json();
    createdProductId = data.product?.id || data.id;
    expect(createdProductId).toBeTruthy();

    // Verify it appears in the API list
    const products = await apiGet('/api/products', token);
    const found = products.products?.find((p: any) => p.name === productName);
    expect(found, `Product "${productName}" should appear in API list`).toBeTruthy();
  });

  test('product detail page loads', async ({ page }) => {
    test.skip(!createdProductId, 'Product was not created in previous test');

    await page.goto(`${BASE_URL}/products/${createdProductId}`);
    await page.waitForLoadState('networkidle');

    const pageText = await page.textContent('body');
    expect(pageText).toContain(productName);
  });
});

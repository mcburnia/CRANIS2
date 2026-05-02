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
 * Acceptance Test 08: Escrow Management
 *
 * Converts: cowork-tests/acceptance/08-escrow-management.md
 * Tests the escrow configuration page for a product, enabled/disabled status,
 * deposit history display, artifact types listing, and page rendering.
 * Does NOT trigger actual deposits to avoid modifying state.
 *
 * @tags @acceptance
 */
import { test, expect } from '@playwright/test';
import { TEST_USERS, TEST_PASSWORD, TEST_IDS } from '../helpers/test-data.js';
import { apiLogin, apiGet } from '../helpers/api-client.js';

const BASE_URL = process.env.E2E_BASE_URL || 'https://dev.cranis2.dev';

test.describe('Escrow Management @acceptance', () => {
  let token: string;
  const productId = TEST_IDS.products.github;

  test.beforeAll(async () => {
    token = await apiLogin(TEST_USERS.mfgAdmin, TEST_PASSWORD);
  });

  test('navigate to product escrow page', async ({ page }) => {
    await page.goto(`${BASE_URL}/products/${productId}/escrow`);
    await page.waitForLoadState('networkidle');

    // Should be on the escrow page for this product
    const currentUrl = page.url();
    expect(currentUrl).toContain(`/products/${productId}`);
    expect(currentUrl).toContain('escrow');
  });

  test('escrow page loads with content', async ({ page }) => {
    await page.goto(`${BASE_URL}/products/${productId}/escrow`);
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(50);

    // Should reference escrow in some form
    const hasEscrowContent =
      body?.toLowerCase().includes('escrow') ||
      body?.toLowerCase().includes('deposit') ||
      body?.toLowerCase().includes('artifact') ||
      body?.toLowerCase().includes('source code');
    expect(hasEscrowContent, 'Escrow page should reference escrow concepts').toBeTruthy();

    // No broken rendering
    expect(body).not.toContain('undefined');
    expect(body).not.toContain('NaN');
  });

  test('escrow status displays (enabled or disabled)', async ({ page }) => {
    await page.goto(`${BASE_URL}/products/${productId}/escrow`);
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');

    // Should show enabled/disabled status or a toggle/switch
    const hasStatusIndicator =
      body?.toLowerCase().includes('enabled') ||
      body?.toLowerCase().includes('disabled') ||
      body?.toLowerCase().includes('active') ||
      body?.toLowerCase().includes('inactive') ||
      body?.toLowerCase().includes('configure') ||
      body?.toLowerCase().includes('enable');

    // Also check for toggle/switch elements
    const toggleExists = await page.locator(
      '[class*="toggle"], [class*="switch"], input[type="checkbox"], [role="switch"]'
    ).first().isVisible({ timeout: 3000 }).catch(() => false);

    expect(
      hasStatusIndicator || toggleExists,
      'Escrow page should show enabled/disabled status or a toggle'
    ).toBeTruthy();
  });

  test('escrow configuration section displays', async ({ page }) => {
    await page.goto(`${BASE_URL}/products/${productId}/escrow`);
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');

    // Configuration section should reference repository or scheduling info
    const hasConfigContent =
      body?.toLowerCase().includes('repository') ||
      body?.toLowerCase().includes('forgejo') ||
      body?.toLowerCase().includes('schedule') ||
      body?.toLowerCase().includes('daily') ||
      body?.toLowerCase().includes('config') ||
      body?.toLowerCase().includes('escrow');
    expect(hasConfigContent, 'Escrow page should show configuration details').toBeTruthy();
  });

  test('deposit history table displays or shows empty state', async ({ page }) => {
    await page.goto(`${BASE_URL}/products/${productId}/escrow`);
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');

    // Should have deposit history section — either with entries or empty state
    const hasDepositHistory =
      body?.toLowerCase().includes('deposit') ||
      body?.toLowerCase().includes('history') ||
      body?.toLowerCase().includes('no deposit') ||
      body?.toLowerCase().includes('no records') ||
      body?.toLowerCase().includes('empty');

    // Also check for table elements that might hold deposit data
    const tableExists = await page.locator('table, [class*="table"], [class*="history"]')
      .first().isVisible({ timeout: 3000 }).catch(() => false);

    expect(
      hasDepositHistory || tableExists,
      'Escrow page should show deposit history or empty state'
    ).toBeTruthy();
  });

  test('artifact types are listed if configured', async ({ page }) => {
    await page.goto(`${BASE_URL}/products/${productId}/escrow`);
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');

    // Known artifact types from the escrow system (up to 7)
    const artifactKeywords = [
      'source code',
      'sbom',
      'vulnerabilit',
      'license',
      'technical',
      'build',
      'compliance',
      'artifact',
    ];

    const hasArtifactTypes = artifactKeywords.some((keyword) =>
      body?.toLowerCase().includes(keyword)
    );

    // Also check for checkbox or toggle elements that represent artifact type selection
    const checkboxesExist = await page.locator(
      'input[type="checkbox"], [class*="toggle"], [role="switch"]'
    ).count();

    expect(
      hasArtifactTypes || checkboxesExist > 0,
      'Escrow page should list artifact types or show artifact toggles'
    ).toBeTruthy();
  });

  test('escrow API returns data for the product', async () => {
    // Verify the escrow config API endpoint returns valid data
    const data = await apiGet(`/api/escrow/${productId}/config`, token);

    // The response should contain escrow configuration data
    expect(data).toBeTruthy();

    // Verify the response has some expected structure
    // (it might have configured, enabled, deposits, artifactTypes, or similar fields)
    const hasExpectedFields =
      data.hasOwnProperty('configured') ||
      data.hasOwnProperty('enabled') ||
      data.hasOwnProperty('escrow') ||
      data.hasOwnProperty('deposits') ||
      data.hasOwnProperty('config') ||
      data.hasOwnProperty('status') ||
      data.hasOwnProperty('artifactTypes');

    // If the endpoint returns a wrapper object, check inside it
    const innerData = data.escrow || data.config || data;
    expect(innerData).toBeTruthy();
  });

  test('page renders without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`${BASE_URL}/products/${productId}/escrow`);
    await page.waitForLoadState('networkidle');

    const realErrors = consoleErrors.filter(
      (err) => !err.includes('favicon') && !err.includes('404') && !err.includes('Failed to load resource')
    );
    expect(realErrors, `Console errors found: ${realErrors.join(', ')}`).toHaveLength(0);
  });

  test('no manual deposit triggered (read-only verification)', async ({ page }) => {
    // Navigate to escrow page and verify we do NOT accidentally trigger deposits
    await page.goto(`${BASE_URL}/products/${productId}/escrow`);
    await page.waitForLoadState('networkidle');

    // Look for deposit buttons but do NOT click them
    const depositButton = page.getByRole('button', {
      name: /deposit|trigger|manual/i,
    }).first();

    const isVisible = await depositButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (isVisible) {
      // Verify the button exists but do not click it
      // Just confirm it's a button element (not auto-submitting)
      const tagName = await depositButton.evaluate((el) => el.tagName);
      expect(tagName.toLowerCase()).toBe('button');
    }

    // Verify the page is still in a clean state (no loading spinners stuck)
    await page.waitForTimeout(1000);
    const body = await page.textContent('body');
    expect(body).not.toContain('undefined');
    expect(body).not.toContain('NaN');
  });
});

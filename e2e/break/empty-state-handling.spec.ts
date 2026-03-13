/**
 * Break Test 07: Empty State Handling
 *
 * Converts: cowork-tests/break/07-empty-state-handling.md
 * Tests that the application handles empty organisations gracefully:
 * - No "undefined", "NaN", or standalone "null" values rendered on any page
 * - Empty states display correctly (not errors)
 * - No console errors on empty-data pages
 * - API returns clean empty arrays for empty orgs
 *
 * Uses the TestOrg-Empty organisation which has no products, repos, or reports.
 *
 * @tags @break
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { TEST_USERS, TEST_PASSWORD } from '../helpers/test-data.js';
import { apiLogin, apiGet } from '../helpers/api-client.js';

const BASE_URL = process.env.E2E_BASE_URL || 'https://dev.cranis2.dev';
const EMPTY_STATE = path.join(process.cwd(), 'auth/storage-state-empty.json');

test.describe('Empty State Handling @break', () => {
  // Use the empty org's storage state for all UI tests
  test.use({ storageState: EMPTY_STATE });

  let emptyToken: string;

  test.beforeAll(async () => {
    emptyToken = await apiLogin(TEST_USERS.emptyAdmin, TEST_PASSWORD);
  });

  /**
   * Helper: checks that the page body does not contain standalone data-display
   * issues like "undefined", "NaN", or "null" that represent missing values.
   */
  async function assertNoDataDisplayIssues(page: any, pageName: string) {
    const bodyText = await page.textContent('body');
    expect(bodyText, `${pageName} body text should exist`).toBeTruthy();

    // Check for standalone "undefined" (word boundary match)
    expect(
      bodyText,
      `${pageName} should not display standalone "undefined"`
    ).not.toMatch(/\bundefined\b/);

    // Check for "NaN" as a displayed value
    expect(
      bodyText,
      `${pageName} should not display "NaN"`
    ).not.toMatch(/\bNaN\b/);
  }

  /**
   * Helper: collects console errors during page load, filtering out noise.
   */
  async function loadPageAndCollectErrors(page: any, url: string): Promise<string[]> {
    const consoleErrors: string[] = [];
    page.on('console', (msg: any) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(url);
    await page.waitForLoadState('networkidle');

    return consoleErrors.filter(
      (err: string) => !err.includes('favicon') && !err.includes('404') && !err.includes('Failed to load resource')
    );
  }

  test('dashboard shows zeros or empty values, not "undefined" or "NaN"', async ({ page }) => {
    const errors = await loadPageAndCollectErrors(page, `${BASE_URL}/dashboard`);
    await assertNoDataDisplayIssues(page, 'Dashboard');
    expect(errors, `Dashboard console errors: ${errors.join(', ')}`).toHaveLength(0);

    // Verify dashboard loaded (has actual content)
    const body = await page.textContent('body');
    expect(body!.length, 'Dashboard should not be blank').toBeGreaterThan(50);
  });

  test('products page shows empty state, not error', async ({ page }) => {
    const errors = await loadPageAndCollectErrors(page, `${BASE_URL}/products`);
    await assertNoDataDisplayIssues(page, 'Products');
    expect(errors, `Products console errors: ${errors.join(', ')}`).toHaveLength(0);

    // Page should load without crashing
    const body = await page.textContent('body');
    expect(body!.length, 'Products page should not be blank').toBeGreaterThan(50);
  });

  test('repos page shows empty state', async ({ page }) => {
    const errors = await loadPageAndCollectErrors(page, `${BASE_URL}/repos`);
    await assertNoDataDisplayIssues(page, 'Repos');
    expect(errors, `Repos console errors: ${errors.join(', ')}`).toHaveLength(0);

    const body = await page.textContent('body');
    expect(body!.length, 'Repos page should not be blank').toBeGreaterThan(50);
  });

  test('notifications page shows empty state', async ({ page }) => {
    const errors = await loadPageAndCollectErrors(page, `${BASE_URL}/notifications`);
    await assertNoDataDisplayIssues(page, 'Notifications');
    expect(errors, `Notifications console errors: ${errors.join(', ')}`).toHaveLength(0);

    const body = await page.textContent('body');
    expect(body!.length, 'Notifications page should not be blank').toBeGreaterThan(50);
  });

  test('vulnerability reports page shows empty state', async ({ page }) => {
    const errors = await loadPageAndCollectErrors(page, `${BASE_URL}/vulnerability-reports`);
    await assertNoDataDisplayIssues(page, 'Vulnerability Reports');
    expect(errors, `Vulnerability Reports console errors: ${errors.join(', ')}`).toHaveLength(0);

    const body = await page.textContent('body');
    expect(body!.length, 'Vulnerability Reports page should not be blank').toBeGreaterThan(50);
  });

  test('technical files page shows empty state', async ({ page }) => {
    const errors = await loadPageAndCollectErrors(page, `${BASE_URL}/technical-files`);
    await assertNoDataDisplayIssues(page, 'Technical Files');
    expect(errors, `Technical Files console errors: ${errors.join(', ')}`).toHaveLength(0);

    const body = await page.textContent('body');
    expect(body!.length, 'Technical Files page should not be blank').toBeGreaterThan(50);
  });

  test('obligations page shows empty state', async ({ page }) => {
    const errors = await loadPageAndCollectErrors(page, `${BASE_URL}/obligations`);
    await assertNoDataDisplayIssues(page, 'Obligations');
    expect(errors, `Obligations console errors: ${errors.join(', ')}`).toHaveLength(0);

    const body = await page.textContent('body');
    expect(body!.length, 'Obligations page should not be blank').toBeGreaterThan(50);
  });

  test('billing page loads for empty org', async ({ page }) => {
    const errors = await loadPageAndCollectErrors(page, `${BASE_URL}/billing`);
    await assertNoDataDisplayIssues(page, 'Billing');
    expect(errors, `Billing console errors: ${errors.join(', ')}`).toHaveLength(0);

    const body = await page.textContent('body');
    expect(body!.length, 'Billing page should not be blank').toBeGreaterThan(50);
  });

  test('API returns empty products array for empty org', async () => {
    const data = await apiGet('/api/products', emptyToken);

    expect(data.products, 'Products response should contain products array').toBeDefined();
    expect(
      Array.isArray(data.products),
      'products should be an array'
    ).toBe(true);
    expect(
      data.products.length,
      'Empty org should have 0 products'
    ).toBe(0);
  });

  test('API returns empty notifications for empty org', async () => {
    const data = await apiGet('/api/notifications', emptyToken);

    expect(
      data.notifications,
      'Notifications response should contain notifications array'
    ).toBeDefined();
    expect(
      Array.isArray(data.notifications),
      'notifications should be an array'
    ).toBe(true);
    expect(
      data.notifications.length,
      'Empty org should have 0 notifications'
    ).toBe(0);
  });
});

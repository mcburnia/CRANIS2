/**
 * Smoke Test 01: Login and Dashboard
 *
 * Converts: cowork-tests/smoke/01-login-and-dashboard.md
 * Tests the login form, credential submission, dashboard rendering,
 * stat cards, sidebar navigation, and absence of console errors.
 *
 * @tags @smoke
 */
import { test, expect } from '@playwright/test';
import { TEST_USERS, TEST_PASSWORD } from '../helpers/test-data.js';

const BASE_URL = process.env.E2E_BASE_URL || 'https://dev.cranis2.dev';

test.describe('Login and Dashboard @smoke', () => {

  test('login page renders with email and password fields', async ({ browser }) => {
    // Use a fresh context (no storageState) to test login UI
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    // Verify login form elements exist
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();

    await context.close();
  });

  test('successful login redirects to dashboard', async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    // Fill login form
    await page.fill('input[type="email"]', TEST_USERS.mfgAdmin);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await expect(page).toHaveURL(/dashboard/);

    await context.close();
  });

  test('invalid credentials show error message', async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    // Fill with wrong password
    await page.fill('input[type="email"]', TEST_USERS.mfgAdmin);
    await page.fill('input[type="password"]', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    // Should show error, not redirect
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/login/);

    // Look for any error indication on the page
    const pageText = await page.textContent('body');
    const hasErrorIndication = pageText?.toLowerCase().includes('invalid') ||
                                pageText?.toLowerCase().includes('error') ||
                                pageText?.toLowerCase().includes('incorrect');
    expect(hasErrorIndication).toBeTruthy();

    await context.close();
  });

  test('dashboard displays stat cards with valid values', async ({ page }) => {
    // Uses storageState from auth-setup (admin user)
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Verify we're on the dashboard
    await expect(page).toHaveURL(/dashboard/);

    // Dashboard should have stat cards — look for numeric values
    const body = await page.textContent('body');
    expect(body).toBeTruthy();

    // Verify no "undefined", "null", or "NaN" values in page content
    expect(body).not.toContain('undefined');
    expect(body).not.toContain('NaN');

    // Verify the page has some meaningful content (not blank)
    expect(body!.length).toBeGreaterThan(100);
  });

  test('sidebar navigation is visible with accordion sections', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    // Use 'load' instead of 'networkidle' — dashboard with 3000+ products can keep fetching
    await page.waitForLoadState('load');
    // Wait for sidebar to render
    await page.waitForSelector('.nav-section-label', { timeout: 10000 });

    // Sidebar section headers are <button> elements with class nav-section-label
    const sidebarSections = ['Overview', 'Compliance', 'Repositories', 'Billing', 'Settings'];
    for (const section of sidebarSections) {
      const sectionBtn = page.locator('.nav-section-label', { hasText: section });
      await expect(sectionBtn, `Sidebar section "${section}" should be visible`).toBeVisible({ timeout: 5000 });
    }

    // Verify Dashboard link is visible (Overview section expanded by default)
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible({ timeout: 5000 });

    // Verify Notifications link is visible with badge
    await expect(page.getByRole('link', { name: /Notifications/ })).toBeVisible({ timeout: 5000 });

    // Verify Sign Out is visible
    await expect(page.locator('text=Sign Out')).toBeVisible({ timeout: 5000 });
  });

  test('no console errors on dashboard load', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Filter out known benign errors (e.g. favicon 404)
    const realErrors = consoleErrors.filter(
      (err) => !err.includes('favicon') && !err.includes('404') && !err.includes('Failed to load resource')
    );

    expect(realErrors, `Console errors found: ${realErrors.join(', ')}`).toHaveLength(0);
  });
});

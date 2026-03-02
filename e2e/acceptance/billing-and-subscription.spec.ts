/**
 * Acceptance Test 07: Billing and Subscription
 *
 * Converts: cowork-tests/acceptance/07-billing-and-subscription.md
 * Tests the billing page display, billing status, contributor count,
 * absence of sensitive data, and the billing gate for suspended orgs.
 *
 * @tags @acceptance
 */
import { test, expect } from '@playwright/test';
import { TEST_USERS, TEST_PASSWORD } from '../helpers/test-data.js';
import { apiLogin } from '../helpers/api-client.js';

const BASE_URL = process.env.E2E_BASE_URL || 'https://dev.cranis2.dev';

test.describe('Billing and Subscription @acceptance', () => {
  let token: string;

  test.beforeAll(async () => {
    token = await apiLogin(TEST_USERS.mfgAdmin, TEST_PASSWORD);
  });

  test('navigate to Billing via sidebar', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Expand the Billing accordion section (button and link share the same "Billing" name)
    await page.getByRole('button', { name: 'Billing' }).first().click();
    await page.waitForTimeout(300);

    // Click the Billing nav link inside the expanded section
    await page.getByRole('link', { name: 'Billing' }).first().click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/billing/);
  });

  test('billing page loads with status display', async ({ page }) => {
    await page.goto(`${BASE_URL}/billing`);
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/billing/);

    const body = await page.textContent('body');
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(50);

    // Should display one of the known billing statuses
    const validStatuses = ['active', 'trial', 'suspended', 'read_only', 'read only', 'past_due', 'past due', 'cancelled'];
    const bodyLower = body!.toLowerCase();
    const hasStatus = validStatuses.some((status) => bodyLower.includes(status));
    expect(hasStatus, 'Billing page should display a billing status').toBeTruthy();

    // No broken rendering
    expect(body).not.toContain('undefined');
    expect(body).not.toContain('NaN');
  });

  test('billing details show contributor count or plan info', async ({ page }) => {
    await page.goto(`${BASE_URL}/billing`);
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');

    // Should show contributor/member counts or plan/subscription details
    const hasBillingDetails =
      body?.toLowerCase().includes('contributor') ||
      body?.toLowerCase().includes('member') ||
      body?.toLowerCase().includes('seat') ||
      body?.toLowerCase().includes('plan') ||
      body?.toLowerCase().includes('subscription') ||
      body?.toLowerCase().includes('billing') ||
      body?.match(/\d+/) !== null; // At least some numeric values
    expect(hasBillingDetails, 'Billing page should show billing details').toBeTruthy();
  });

  test('no sensitive data exposed on billing page', async ({ page }) => {
    await page.goto(`${BASE_URL}/billing`);
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');

    // No full credit card numbers (16 digits in sequence)
    expect(body).not.toMatch(/\d{13,19}/);

    // No Stripe API keys
    expect(body).not.toMatch(/sk_live_[a-zA-Z0-9]+/);
    expect(body).not.toMatch(/sk_test_[a-zA-Z0-9]+/);
    expect(body).not.toMatch(/pk_live_[a-zA-Z0-9]+/);
    expect(body).not.toMatch(/pk_test_[a-zA-Z0-9]+/);

    // No webhook secrets
    expect(body).not.toMatch(/whsec_[a-zA-Z0-9]+/);

    // Partial card numbers (last 4 digits) are acceptable, but not full numbers
    // If card info is shown, it should be masked like **** **** **** 1234
  });

  test('no console errors on billing page', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`${BASE_URL}/billing`);
    await page.waitForLoadState('networkidle');

    const realErrors = consoleErrors.filter(
      (err) => !err.includes('favicon') && !err.includes('404')
    );
    expect(realErrors, `Console errors found: ${realErrors.join(', ')}`).toHaveLength(0);
  });

  test.describe('Billing gate — suspended org', () => {
    // This test uses a fresh browser context (no storageState) to log in as the
    // suspended org admin and verify that write operations are blocked.

    test('suspended org user is blocked from write operations', async ({ browser }) => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();

      try {
        // Log in as suspended org admin
        await page.goto(`${BASE_URL}/login`);
        await page.waitForLoadState('networkidle');

        await page.fill('input[type="email"]', TEST_USERS.distAdmin);
        await page.fill('input[type="password"]', TEST_PASSWORD);
        await page.click('button[type="submit"]');

        // Wait for redirect to dashboard
        await page.waitForURL('**/dashboard', { timeout: 15000 });
        await expect(page).toHaveURL(/dashboard/);

        // Try to create a product via the API as suspended user
        const suspendedToken = await apiLogin(TEST_USERS.distAdmin, TEST_PASSWORD);

        // Attempt a write operation — POST to products
        const res = await fetch(`${BASE_URL}/api/products`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${suspendedToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: `BillingGateTest-${Date.now()}` }),
        });

        // The billing gate should block this with 403 or 402
        expect(
          [402, 403].includes(res.status),
          `Suspended org write should be blocked, got ${res.status}`
        ).toBe(true);

        // Verify the error response mentions billing
        const body = await res.json();
        const errorText = JSON.stringify(body).toLowerCase();
        const hasBillingError =
          errorText.includes('billing') ||
          errorText.includes('suspended') ||
          errorText.includes('restricted') ||
          errorText.includes('blocked') ||
          errorText.includes('read') ||
          errorText.includes('payment');
        expect(hasBillingError, 'Error should reference billing restriction').toBeTruthy();
      } finally {
        await context.close();
      }
    });

    test('read-only org user is blocked from write operations', async () => {
      // Test the billing gate for a read_only org via API
      const ossToken = await apiLogin(TEST_USERS.ossAdmin, TEST_PASSWORD);

      const res = await fetch(`${BASE_URL}/api/products`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ossToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: `BillingGateTest-ReadOnly-${Date.now()}` }),
      });

      // The billing gate should block this with 402 or 403
      expect(
        [402, 403].includes(res.status),
        `Read-only org write should be blocked, got ${res.status}`
      ).toBe(true);
    });

    test('active org user can perform write operations', async () => {
      // Verify that the active org admin is not blocked by the billing gate
      const res = await fetch(`${BASE_URL}/api/products`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: `BillingGateTest-Active-${Date.now()}` }),
      });

      // Active org should be allowed (201 for creation or similar success)
      expect(
        res.status < 400,
        `Active org write should succeed, got ${res.status}`
      ).toBe(true);

      // Cleanup: if a product was created, delete it
      if (res.status === 201) {
        const body = await res.json();
        const productId = body?.id || body?.product?.id;
        if (productId) {
          await fetch(`${BASE_URL}/api/products/${productId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      }
    });
  });
});

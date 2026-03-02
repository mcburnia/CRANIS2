/**
 * Acceptance Test 09: Admin Panel — Dashboard, Orgs, Users, System Status
 *
 * Converts: cowork-tests/acceptance/09-admin-panel.md
 * Tests platform admin access to dashboard statistics, organisation listing,
 * user listing, system health, and access control for non-admin users.
 *
 * @tags @acceptance
 */
import { test, expect } from '@playwright/test';
import { TEST_USERS, TEST_PASSWORD } from '../helpers/test-data.js';
import { apiLogin } from '../helpers/api-client.js';
import path from 'path';

const PLATFORM_STATE = path.join(process.cwd(), 'auth/storage-state-platform.json');
const MEMBER_STATE = path.join(process.cwd(), 'auth/storage-state-member.json');
const BASE_URL = process.env.E2E_BASE_URL || 'https://dev.cranis2.dev';

// ── Platform Admin Tests ──────────────────────────────────────────────────────

test.describe('Admin Panel @acceptance', () => {

  test.describe('Platform admin — dashboard and navigation', () => {
    test.use({ storageState: PLATFORM_STATE });

    test('admin dashboard loads with platform-wide statistics', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/dashboard`);
      await page.waitForLoadState('networkidle');

      // Verify we're on the admin dashboard (not redirected)
      await expect(page).toHaveURL(/admin\/dashboard/);

      // Verify admin layout elements are present
      const body = await page.textContent('body');
      expect(body).toBeTruthy();
      expect(body).not.toContain('undefined');
      expect(body).not.toContain('NaN');

      // Verify the page has Platform Admin branding
      await expect(page.getByText('Platform Admin', { exact: true })).toBeVisible();
    });

    test('admin dashboard displays stat cards with org, user, and product counts', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/dashboard`);
      await page.waitForLoadState('networkidle');

      // The admin dashboard should show stat cards or summary sections
      // Check for numeric values that represent counts (orgs, users, products)
      const body = await page.textContent('body');
      expect(body!.length).toBeGreaterThan(100);

      // Verify known stat-related text appears (labels for counts)
      // The dashboard API returns: users.total, organisations.total, products.total
      const hasOrgsReference = body!.toLowerCase().includes('org') ||
                                body!.toLowerCase().includes('organisation');
      const hasUsersReference = body!.toLowerCase().includes('user');
      const hasProductsReference = body!.toLowerCase().includes('product');

      expect(hasOrgsReference, 'Dashboard should reference organisations').toBeTruthy();
      expect(hasUsersReference, 'Dashboard should reference users').toBeTruthy();
      expect(hasProductsReference, 'Dashboard should reference products').toBeTruthy();
    });

    test('admin dashboard API returns valid statistics', async ({ request }) => {
      const token = await apiLogin(TEST_USERS.platformAdmin, TEST_PASSWORD);
      const response = await request.get(`${BASE_URL}/api/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status()).toBe(200);
      const data = await response.json();

      // Verify top-level keys from the dashboard response
      expect(data).toHaveProperty('users');
      expect(data).toHaveProperty('organisations');
      expect(data).toHaveProperty('products');
      expect(data).toHaveProperty('vulnerabilities');
      expect(data).toHaveProperty('compliance');
      expect(data).toHaveProperty('recentActivity');

      // Verify counts are non-negative numbers
      expect(data.users.total).toBeGreaterThanOrEqual(1);
      expect(data.organisations.total).toBeGreaterThanOrEqual(1);
      expect(data.products.total).toBeGreaterThanOrEqual(0);
    });

    test('admin sidebar shows all admin navigation items', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/dashboard`);
      await page.waitForLoadState('networkidle');

      // Admin sidebar sections from AdminLayout.tsx
      const expectedLinks = [
        'Dashboard',
        'Organisations',
        'Users',
        'Audit Log',
        'System Health',
        'Vuln Scanning',
        'Vuln Database',
        'Test Results',
        'Billing',
        'User Feedback',
      ];

      for (const label of expectedLinks) {
        await expect(
          page.getByRole('link', { name: label }).first(),
          `Admin sidebar should contain "${label}" link`
        ).toBeVisible();
      }

      // Verify "Back to App" button is present
      await expect(page.getByText('Back to App')).toBeVisible();
    });

    test('admin orgs page lists organisations', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/orgs`);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/admin\/orgs/);

      const body = await page.textContent('body');
      expect(body).toBeTruthy();
      expect(body!.length).toBeGreaterThan(50);

      // The seeded test orgs should appear — at least "manufacturer-active"
      // (org names come from Neo4j; check for partial match)
      const hasOrg = body!.toLowerCase().includes('manufacturer') ||
                     body!.toLowerCase().includes('importer') ||
                     body!.toLowerCase().includes('distributor');
      expect(hasOrg, 'Orgs page should list at least one seeded organisation').toBeTruthy();
    });

    test('admin orgs API returns org list', async ({ request }) => {
      const token = await apiLogin(TEST_USERS.platformAdmin, TEST_PASSWORD);
      const response = await request.get(`${BASE_URL}/api/admin/orgs`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status()).toBe(200);
      const data = await response.json();

      // Response should contain an array of orgs
      const orgs = Array.isArray(data) ? data : data.orgs;
      expect(orgs).toBeTruthy();
      expect(orgs.length).toBeGreaterThanOrEqual(1);

      // Each org should have basic fields
      const firstOrg = orgs[0];
      expect(firstOrg).toHaveProperty('name');
    });

    test('admin users page lists users', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/users`);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/admin\/users/);

      const body = await page.textContent('body');
      expect(body).toBeTruthy();
      expect(body!.length).toBeGreaterThan(50);

      // Test users should appear in the user list
      const hasTestUser = body!.includes('testadmin@manufacturer-active.test') ||
                          body!.includes('testmember1@manufacturer-active.test') ||
                          body!.includes('testplatformadmin@cranis2.test') ||
                          body!.includes('manufacturer-active');
      expect(hasTestUser, 'Users page should list at least one seeded user').toBeTruthy();
    });

    test('admin users API returns user list', async ({ request }) => {
      const token = await apiLogin(TEST_USERS.platformAdmin, TEST_PASSWORD);
      const response = await request.get(`${BASE_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status()).toBe(200);
      const data = await response.json();

      const users = Array.isArray(data) ? data : data.users;
      expect(users).toBeTruthy();
      expect(users.length).toBeGreaterThanOrEqual(1);

      // Each user should have email and role info
      const firstUser = users[0];
      expect(firstUser).toHaveProperty('email');
    });

    test('admin system health page loads', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/system`);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/admin\/system/);

      const body = await page.textContent('body');
      expect(body).toBeTruthy();
      expect(body!.length).toBeGreaterThan(50);

      // System health should reference backend services or status info
      const hasHealthInfo = body!.toLowerCase().includes('health') ||
                            body!.toLowerCase().includes('status') ||
                            body!.toLowerCase().includes('database') ||
                            body!.toLowerCase().includes('service') ||
                            body!.toLowerCase().includes('postgres') ||
                            body!.toLowerCase().includes('neo4j');
      expect(hasHealthInfo, 'System page should display health/status info').toBeTruthy();
    });

    test('no console errors on admin pages', async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      // Visit all key admin pages in sequence
      const adminPages = ['/admin/dashboard', '/admin/orgs', '/admin/users', '/admin/system'];
      for (const adminPage of adminPages) {
        await page.goto(`${BASE_URL}${adminPage}`);
        await page.waitForLoadState('networkidle');
      }

      const realErrors = consoleErrors.filter(
        (err) => !err.includes('favicon') && !err.includes('404')
      );
      expect(realErrors, `Console errors on admin pages: ${realErrors.join(', ')}`).toHaveLength(0);
    });
  });

  // ── Access Control ──────────────────────────────────────────────────────────

  test.describe('Access control — non-admin user blocked from admin panel', () => {

    test('regular member is redirected away from admin dashboard', async ({ browser }) => {
      // Use member storageState for a non-admin user
      const context = await browser.newContext({
        storageState: MEMBER_STATE,
        ignoreHTTPSErrors: true,
      });
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/admin/dashboard`);
      await page.waitForLoadState('networkidle');

      // AdminLayout redirects non-platform-admin to /dashboard
      // (or shows access denied)
      const url = page.url();
      const isRedirected = !url.includes('/admin/');
      const body = await page.textContent('body');
      const hasAccessDenied = body?.toLowerCase().includes('access denied') ||
                              body?.toLowerCase().includes('unauthorised') ||
                              body?.toLowerCase().includes('unauthorized') ||
                              body?.toLowerCase().includes('forbidden');

      expect(
        isRedirected || hasAccessDenied,
        'Non-admin user should be redirected or shown access denied'
      ).toBeTruthy();

      await context.close();
    });

    test('admin API returns 403 for non-admin user', async ({ request }) => {
      const token = await apiLogin(TEST_USERS.mfgMember1, TEST_PASSWORD);
      const response = await request.get(`${BASE_URL}/api/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Platform admin middleware returns 403 for non-admin users
      expect(response.status()).toBe(403);
    });

    test('admin sidebar items are not visible to regular member', async ({ browser }) => {
      const context = await browser.newContext({
        storageState: MEMBER_STATE,
        ignoreHTTPSErrors: true,
      });
      const page = await context.newPage();

      // Navigate to normal dashboard (not admin)
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForLoadState('networkidle');

      const body = await page.textContent('body');

      // The normal sidebar should NOT contain admin-specific navigation
      // (Admin section is only in AdminLayout, not AuthenticatedLayout)
      const hasAdminNav = body?.includes('Vuln Scanning') ||
                          body?.includes('Vuln Database') ||
                          body?.includes('User Feedback');

      expect(hasAdminNav, 'Regular member sidebar should not show admin navigation').toBeFalsy();

      await context.close();
    });
  });
});

/**
 * Playwright auth setup — runs before all test projects.
 *
 * Logs in as each required user persona via the API, injects the JWT
 * into localStorage, and saves the storageState for reuse.
 */
import { test as setup, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'https://dev.cranis2.dev';

const users = [
  {
    email: 'testadmin@manufacturer-active.test',
    password: 'TestPass123!',
    stateFile: 'auth/storage-state-admin.json',
    label: 'admin (active org)',
  },
  {
    email: 'testmember1@manufacturer-active.test',
    password: 'TestPass123!',
    stateFile: 'auth/storage-state-member.json',
    label: 'member (active org)',
  },
  {
    email: 'testplatformadmin@cranis2.test',
    password: 'TestPass123!',
    stateFile: 'auth/storage-state-platform.json',
    label: 'platform admin',
  },
  {
    email: 'testadmin@empty-org.test',
    password: 'TestPass123!',
    stateFile: 'auth/storage-state-empty.json',
    label: 'admin (empty org)',
  },
];

for (const user of users) {
  setup(`authenticate as ${user.label} (${user.email})`, async ({ page }) => {
    // 1. Login via API to get JWT
    const response = await page.request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: user.email, password: user.password },
    });
    expect(response.ok(), `Login failed for ${user.email}: ${response.status()}`).toBeTruthy();

    const body = await response.json();
    expect(body.session, `No session token returned for ${user.email}`).toBeTruthy();

    // 2. Navigate to app and inject token into localStorage
    await page.goto(BASE_URL);
    await page.evaluate((token) => {
      localStorage.setItem('session_token', token);
    }, body.session);

    // 3. Verify auth works by navigating to dashboard
    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page).toHaveURL(/dashboard/);

    // 4. Save storage state for reuse by test projects
    await page.context().storageState({ path: user.stateFile });
  });
}

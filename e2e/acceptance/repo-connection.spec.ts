/**
 * Acceptance Test 03: Repository Connection
 *
 * Converts: cowork-tests/acceptance/03-repo-connection.md
 * Tests the repos page UI: provider connections panel, provider list,
 * self-hosted PAT form fields (instance URL, token), and OAuth connect
 * buttons. Does NOT connect to any real provider (UI-only verification).
 *
 * @tags @acceptance
 */
import { test, expect } from '@playwright/test';
import { TEST_USERS, TEST_PASSWORD } from '../helpers/test-data.js';
import { apiLogin, apiPost, apiDelete } from '../helpers/api-client.js';

const BASE_URL = process.env.E2E_BASE_URL || 'https://dev.cranis2.dev';

test.describe('Repository Connection @acceptance', () => {
  let token: string;
  let createdProductId: string | null = null;

  test.beforeAll(async () => {
    token = await apiLogin(TEST_USERS.mfgAdmin, TEST_PASSWORD);

    // Create a product so the org has at least one (seeded products were cleaned up)
    const res = await apiPost('/api/products', token, { name: 'e2e-repo-conn-test' });
    if (res.status < 300 && res.body?.id) {
      createdProductId = res.body.id;
    }
  });

  test.afterAll(async () => {
    if (createdProductId) {
      await apiDelete(`/api/products/${createdProductId}`, token);
    }
  });

  test('navigate to Repos page via sidebar', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Expand the Repositories accordion section
    await page.getByRole('button', { name: 'Repositories' }).click();
    await page.waitForTimeout(300);

    // Click the Repos link
    await page.getByRole('link', { name: 'Repos' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/repos/);
  });

  test('repos page loads with stat cards and content', async ({ page }) => {
    await page.goto(`${BASE_URL}/repos`);
    await page.waitForLoadState('networkidle');

    // Verify the page title area
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(100);

    // No broken rendering
    expect(body).not.toContain('undefined');
    expect(body).not.toContain('NaN');

    // Should show stat cards: Products, Connected, Disconnected, Open Issues
    const hasStatContent =
      body?.includes('Products') &&
      body?.includes('Connected') &&
      body?.includes('Disconnected');
    expect(hasStatContent, 'Stat cards should display Products, Connected, and Disconnected').toBeTruthy();
  });

  test('Provider Connections panel is visible', async ({ page }) => {
    await page.goto(`${BASE_URL}/repos`);
    await page.waitForLoadState('networkidle');

    // The Provider Connections accordion header should be visible
    await expect(page.getByText('Provider Connections')).toBeVisible();
  });

  test('expand Provider Connections panel and verify content', async ({ page }) => {
    await page.goto(`${BASE_URL}/repos`);
    await page.waitForLoadState('networkidle');

    // Click to expand the Provider Connections accordion
    const connHeader = page.getByText('Provider Connections');
    await connHeader.click();
    await page.waitForTimeout(500);

    // After expanding, the "Connect Self-Hosted Provider (PAT)" button should appear
    const patButton = page.getByRole('button', { name: /Connect Self-Hosted Provider/i });
    await expect(patButton).toBeVisible();
  });

  test('PAT form shows provider selector with self-hosted providers', async ({ page }) => {
    await page.goto(`${BASE_URL}/repos`);
    await page.waitForLoadState('networkidle');

    // Expand the Provider Connections panel
    await page.getByText('Provider Connections').click();
    await page.waitForTimeout(500);

    // Click the "Connect Self-Hosted Provider (PAT)" button to open the form
    const patButton = page.getByRole('button', { name: /Connect Self-Hosted Provider/i });
    await patButton.click();
    await page.waitForTimeout(500);

    // Verify the PAT form header
    await expect(page.getByText('Connect with Personal Access Token')).toBeVisible();

    // Verify the provider selector (dropdown) is visible
    const providerSelect = page.locator('select');
    await expect(providerSelect).toBeVisible();

    // Get all options from the provider selector
    const options = providerSelect.locator('option');
    const optionTexts = await options.allTextContents();

    // Should include the self-hosted providers: Gitea, Forgejo, GitLab
    const hasGitea = optionTexts.some(t => t.toLowerCase().includes('gitea'));
    const hasForgejo = optionTexts.some(t => t.toLowerCase().includes('forgejo'));
    const hasGitlab = optionTexts.some(t => t.toLowerCase().includes('gitlab'));

    expect(hasGitea, 'Provider selector should include Gitea').toBeTruthy();
    expect(hasForgejo, 'Provider selector should include Forgejo').toBeTruthy();
    expect(hasGitlab, 'Provider selector should include GitLab').toBeTruthy();
  });

  test('PAT form shows Instance URL and Token fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/repos`);
    await page.waitForLoadState('networkidle');

    // Expand Provider Connections and open the PAT form
    await page.getByText('Provider Connections').click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /Connect Self-Hosted Provider/i }).click();
    await page.waitForTimeout(500);

    // Verify Instance URL field exists
    const urlInput = page.locator('input[type="url"]');
    await expect(urlInput).toBeVisible();

    // Verify placeholder text on the URL field
    const urlPlaceholder = await urlInput.getAttribute('placeholder');
    expect(urlPlaceholder).toContain('https://');

    // Verify Personal Access Token field exists
    const tokenInput = page.locator('input[type="password"]');
    await expect(tokenInput).toBeVisible();

    // Verify the "Test & Connect" button exists
    await expect(page.getByRole('button', { name: /Test & Connect/i })).toBeVisible();
  });

  test('PAT form submit button is disabled without required fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/repos`);
    await page.waitForLoadState('networkidle');

    // Expand and open PAT form
    await page.getByText('Provider Connections').click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /Connect Self-Hosted Provider/i }).click();
    await page.waitForTimeout(500);

    // The "Test & Connect" button should be disabled when URL and token are empty
    const submitBtn = page.getByRole('button', { name: /Test & Connect/i });
    await expect(submitBtn).toBeDisabled();
  });

  test('PAT form can be closed', async ({ page }) => {
    await page.goto(`${BASE_URL}/repos`);
    await page.waitForLoadState('networkidle');

    // Open the PAT form
    await page.getByText('Provider Connections').click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /Connect Self-Hosted Provider/i }).click();
    await page.waitForTimeout(500);

    // Verify form is visible
    await expect(page.getByText('Connect with Personal Access Token')).toBeVisible();

    // Close the form via the X button
    const closeButton = page.locator('.rp-pat-close');
    await closeButton.click();
    await page.waitForTimeout(300);

    // Form header should no longer be visible
    await expect(page.getByText('Connect with Personal Access Token')).not.toBeVisible();

    // The "Connect Self-Hosted Provider (PAT)" button should reappear
    await expect(page.getByRole('button', { name: /Connect Self-Hosted Provider/i })).toBeVisible();
  });

  test('API returns 5 supported providers', async () => {
    const response = await fetch(`${BASE_URL}/api/repo/providers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.ok).toBe(true);

    const providers = await response.json();
    expect(Array.isArray(providers)).toBe(true);

    // Should have 5 providers: github, codeberg, gitea, forgejo, gitlab
    const providerIds = providers.map((p: any) => p.id);
    expect(providerIds).toContain('github');
    expect(providerIds).toContain('codeberg');
    expect(providerIds).toContain('gitea');
    expect(providerIds).toContain('forgejo');
    expect(providerIds).toContain('gitlab');
    expect(providers.length).toBe(5);

    // Verify self-hosted flags
    const selfHosted = providers.filter((p: any) => p.selfHosted);
    expect(selfHosted.length).toBe(3); // gitea, forgejo, gitlab

    const oauthProviders = providers.filter((p: any) => p.oauthSupported);
    expect(oauthProviders.length).toBeGreaterThanOrEqual(2); // at least github, codeberg
  });

  test('filter bar displays provider options', async ({ page }) => {
    await page.goto(`${BASE_URL}/repos`);
    await page.waitForLoadState('networkidle');

    // The filter bar should show filter buttons inside .rp-filter-bar
    const filterBar = page.locator('.rp-filter-bar');
    const filterBarVisible = await filterBar.isVisible({ timeout: 5000 }).catch(() => false);

    if (filterBarVisible) {
      // Verify filter buttons exist within the filter bar
      const filterButtons = filterBar.locator('button');
      const count = await filterButtons.count();
      expect(count, 'Filter bar should have at least 3 filter buttons').toBeGreaterThanOrEqual(3);

      // Verify button labels contain expected filter text
      const allText = await filterBar.textContent();
      expect(allText).toContain('All');
      expect(allText).toContain('Connected');
      expect(allText).toContain('GitHub');
    } else {
      // If no filter bar, verify page has product data (filter bar only shows when products exist)
      const body = await page.textContent('body');
      expect(body).toBeTruthy();
      // The page should at least have stat cards or a no-products message
      const hasContent = body!.includes('Products') || body!.includes('No products');
      expect(hasContent, 'Repos page should have product-related content').toBeTruthy();
    }
  });

  test('no console errors on repos page', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`${BASE_URL}/repos`);
    await page.waitForLoadState('networkidle');

    const realErrors = consoleErrors.filter(
      (err) => !err.includes('favicon') && !err.includes('404') && !err.includes('Failed to load resource')
    );
    expect(realErrors, `Console errors found: ${realErrors.join(', ')}`).toHaveLength(0);
  });
});

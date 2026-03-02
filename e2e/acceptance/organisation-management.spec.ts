/**
 * Acceptance Test 01: Organisation Management
 *
 * Converts: cowork-tests/acceptance/01-organisation-management.md
 * Tests the organisation settings page, org details display, member list,
 * manufacturer details editing (website, contact), and revert.
 *
 * @tags @acceptance
 */
import { test, expect } from '@playwright/test';
import { TEST_USERS, TEST_PASSWORD } from '../helpers/test-data.js';
import { DEMO_ORGS } from '../helpers/demo-data.js';
import { apiLogin, apiGet, apiPut } from '../helpers/api-client.js';

const BASE_URL = process.env.E2E_BASE_URL || 'https://dev.cranis2.dev';

test.describe('Organisation Management @acceptance', () => {
  let token: string;
  let originalOrg: any;

  test.beforeAll(async () => {
    token = await apiLogin(TEST_USERS.mfgAdmin, TEST_PASSWORD);
    // Capture original org state so we can revert in afterAll
    originalOrg = await apiGet('/api/org', token);
  });

  test.afterAll(async () => {
    // Revert all org fields to their original values
    if (originalOrg && token) {
      await apiPut('/api/org', token, {
        name: originalOrg.name,
        country: originalOrg.country,
        companySize: originalOrg.companySize,
        craRole: originalOrg.craRole,
        industry: originalOrg.industry,
        website: originalOrg.website,
        contactEmail: originalOrg.contactEmail,
        contactPhone: originalOrg.contactPhone,
        street: originalOrg.street,
        city: originalOrg.city,
        postcode: originalOrg.postcode,
      });
    }
  });

  test('navigate to Organisation via sidebar', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Expand the Settings accordion section
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.waitForTimeout(300);

    // Click the Organisation link
    await page.getByRole('link', { name: 'Organisation' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/organisation/);
  });

  test('organisation details page displays org name', async ({ page }) => {
    await page.goto(`${BASE_URL}/organisation`);
    await page.waitForLoadState('networkidle');

    // Verify the org name "TestOrg-Manufacturer-Active" is displayed
    const body = await page.textContent('body');
    expect(body).toContain('TestOrg-Manufacturer-Active');
  });

  test('organisation details page shows org fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/organisation`);
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');
    expect(body).toBeTruthy();

    // Should show "Organisation Details" card header
    await expect(page.getByText('Organisation Details')).toBeVisible();

    // Should display key fields: Name, Country, Company Size, CRA Role
    await expect(page.getByText('Name')).toBeVisible();
    await expect(page.getByText('Country')).toBeVisible();
    await expect(page.getByText('Company Size')).toBeVisible();
    await expect(page.getByText('CRA Role')).toBeVisible();

    // No broken rendering
    expect(body).not.toContain('undefined');
    expect(body).not.toContain('NaN');
  });

  test('member list shows test users with roles', async ({ page }) => {
    await page.goto(`${BASE_URL}/organisation`);
    await page.waitForLoadState('networkidle');

    // The Members card should be visible with a count
    await expect(page.getByText(/Members \(\d+\)/)).toBeVisible();

    // Verify the admin user email is in the members table
    const body = await page.textContent('body');
    expect(body).toContain(TEST_USERS.mfgAdmin);

    // Verify at least one member user is listed
    expect(body).toContain(TEST_USERS.mfgMember1);

    // Verify role labels are displayed
    expect(body).toContain('admin');
    expect(body).toContain('member');
  });

  test('edit manufacturer details: update website', async ({ page }) => {
    await page.goto(`${BASE_URL}/organisation`);
    await page.waitForLoadState('networkidle');

    // Click the Edit button on the Manufacturer Details card
    const editButton = page.getByRole('button', { name: /Edit/ });
    await expect(editButton).toBeVisible();
    await editButton.click();

    // Wait for the edit form to appear
    await page.waitForTimeout(300);

    // Fill in the website field
    const websiteInput = page.locator('input[type="url"]');
    await expect(websiteInput).toBeVisible();
    await websiteInput.fill('https://bedrock-industries.example.com');

    // Click Save
    const saveButton = page.getByRole('button', { name: /Save/ });
    await saveButton.click();

    // Wait for save to complete (form should close)
    await page.waitForTimeout(1000);

    // Verify the website is now displayed in non-edit mode
    await expect(page.getByText('https://bedrock-industries.example.com')).toBeVisible();
  });

  test('website update persists after reload', async ({ page }) => {
    // Navigate to organisation page (website was set in previous test)
    await page.goto(`${BASE_URL}/organisation`);
    await page.waitForLoadState('networkidle');

    // Verify the website we set in the previous test is still there
    await expect(page.getByText('https://bedrock-industries.example.com')).toBeVisible();
  });

  test('edit manufacturer details: update contact email', async ({ page }) => {
    await page.goto(`${BASE_URL}/organisation`);
    await page.waitForLoadState('networkidle');

    // Click the Edit button
    const editButton = page.getByRole('button', { name: /Edit/ });
    await editButton.click();
    await page.waitForTimeout(300);

    // Fill in the contact email field
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
    await emailInput.fill('fred@bedrock-industries.example.com');

    // Click Save
    const saveButton = page.getByRole('button', { name: /Save/ });
    await saveButton.click();
    await page.waitForTimeout(1000);

    // Verify the contact email is displayed
    await expect(page.getByText('fred@bedrock-industries.example.com')).toBeVisible();
  });

  test('revert manufacturer details via API', async () => {
    // Revert to original values via API
    const revertRes = await apiPut('/api/org', token, {
      name: originalOrg.name,
      country: originalOrg.country,
      companySize: originalOrg.companySize,
      craRole: originalOrg.craRole,
      industry: originalOrg.industry,
      website: originalOrg.website,
      contactEmail: originalOrg.contactEmail,
      contactPhone: originalOrg.contactPhone,
      street: originalOrg.street,
      city: originalOrg.city,
      postcode: originalOrg.postcode,
    });

    expect(revertRes.status).toBe(200);

    // Verify via API that original values are restored
    const current = await apiGet('/api/org', token);
    expect(current.name).toBe(originalOrg.name);
    expect(current.website).toBe(originalOrg.website);
    expect(current.contactEmail).toBe(originalOrg.contactEmail);
  });

  test('no console errors on organisation page', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`${BASE_URL}/organisation`);
    await page.waitForLoadState('networkidle');

    const realErrors = consoleErrors.filter(
      (err) => !err.includes('favicon') && !err.includes('404')
    );
    expect(realErrors, `Console errors found: ${realErrors.join(', ')}`).toHaveLength(0);
  });
});

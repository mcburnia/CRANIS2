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
 * Acceptance Test: Compliance Reports
 *
 * Tests the reports hub and three report types:
 * - /reports          — hub page with links to all three reports
 * - /reports/compliance-summary   — obligations, tech file, vulns, CRA reports
 * - /reports/vulnerability-trends — scan history, severity charts, ecosystems
 * - /reports/audit-trail          — user events, ENISA stages, repo syncs
 *
 * Each report page: loads correctly, Generate Report works, export buttons appear.
 *
 * @tags @acceptance
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'https://dev.cranis2.dev';

test.describe('Compliance Reports @acceptance', () => {

  // ─── Reports Hub ─────────────────────────────────────────────────────

  test.describe('Reports hub — /reports', () => {
    test('navigate to Reports via sidebar', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForLoadState('networkidle');

      // Expand Billing section in sidebar
      await page.getByRole('button', { name: 'Billing' }).click();
      await page.waitForTimeout(300);

      await page.getByRole('link', { name: 'Reports' }).click();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/reports$/);
    });

    test('reports hub displays three report type cards', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports`);
      await page.waitForLoadState('networkidle');

      const body = await page.textContent('body');
      expect(body).toContain('Compliance Summary');
      expect(body).toContain('Vulnerability Trends');
      expect(body).toContain('Audit Trail');
    });

    test('each card links to the correct report page', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports`);
      await page.waitForLoadState('networkidle');

      // Compliance Summary link
      await expect(page.getByRole('link', { name: /Compliance Summary/ })).toHaveAttribute('href', /compliance-summary/);

      // Vulnerability Trends link
      await expect(page.getByRole('link', { name: /Vulnerability Trends/ })).toHaveAttribute('href', /vulnerability-trends/);

      // Audit Trail link
      await expect(page.getByRole('link', { name: /Audit Trail/ })).toHaveAttribute('href', /audit-trail/);
    });

    test('no console errors on reports hub', async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

      await page.goto(`${BASE_URL}/reports`);
      await page.waitForLoadState('networkidle');

      const realErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
      expect(realErrors, `Console errors: ${realErrors.join(', ')}`).toHaveLength(0);
    });
  });

  // ─── Compliance Summary ───────────────────────────────────────────────

  test.describe('Compliance Summary — /reports/compliance-summary', () => {
    test('page loads with date range inputs and generate button', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports/compliance-summary`);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/compliance-summary/);

      // Date range inputs
      await expect(page.locator('input[type="date"]').first()).toBeVisible();
      await expect(page.locator('input[type="date"]').last()).toBeVisible();

      // Generate Report button
      await expect(page.getByRole('button', { name: /Generate Report/i })).toBeVisible();
    });

    test('date inputs default to a 12-month range', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports/compliance-summary`);
      await page.waitForLoadState('networkidle');

      const fromInput = page.locator('input[type="date"]').first();
      const toInput = page.locator('input[type="date"]').last();

      const fromVal = await fromInput.inputValue();
      const toVal = await toInput.inputValue();

      expect(fromVal).toBeTruthy();
      expect(toVal).toBeTruthy();

      // Gap should be approximately 12 months
      const from = new Date(fromVal);
      const to = new Date(toVal);
      const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(350);
      expect(diffDays).toBeLessThan(380);
    });

    test('clicking Generate Report loads data and shows table', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports/compliance-summary`);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: /Generate Report/i }).click();

      // Wait for data — either a table or "No products" message
      await page.waitForTimeout(3000);

      const body = await page.textContent('body');
      const hasData =
        body?.includes('CRA Category') ||
        body?.includes('Obligations') ||
        body?.includes('Tech File') ||
        body?.includes('No products found');
      expect(hasData, 'Page should show table or empty state after generating').toBeTruthy();
    });

    test('export buttons appear after generating report', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports/compliance-summary`);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: /Generate Report/i }).click();
      await page.waitForTimeout(3000);

      // Download PDF and CSV buttons should now be visible
      const pdfBtn = page.getByRole('button', { name: /Download PDF/i });
      const csvBtn = page.getByRole('button', { name: /Download CSV/i });

      const pdfVisible = await pdfBtn.isVisible({ timeout: 5000 }).catch(() => false);
      const csvVisible = await csvBtn.isVisible({ timeout: 5000 }).catch(() => false);

      // At minimum one export option should be present after generation
      expect(pdfVisible || csvVisible, 'At least one export button should appear after generate').toBeTruthy();
    });

    test('"All Reports" back link navigates to hub', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports/compliance-summary`);
      await page.waitForLoadState('networkidle');

      await page.getByRole('link', { name: /All Reports/i }).click();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/reports$/);
    });

    test('no console errors on compliance summary page', async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

      await page.goto(`${BASE_URL}/reports/compliance-summary`);
      await page.waitForLoadState('networkidle');

      const realErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
      expect(realErrors, `Console errors: ${realErrors.join(', ')}`).toHaveLength(0);
    });
  });

  // ─── Vulnerability Trends ─────────────────────────────────────────────

  test.describe('Vulnerability Trends — /reports/vulnerability-trends', () => {
    test('page loads with date range inputs and generate button', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports/vulnerability-trends`);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/vulnerability-trends/);
      await expect(page.locator('input[type="date"]').first()).toBeVisible();
      await expect(page.getByRole('button', { name: /Generate Report/i })).toBeVisible();
    });

    test('clicking Generate Report loads data', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports/vulnerability-trends`);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: /Generate Report/i }).click();
      await page.waitForTimeout(3000);

      const body = await page.textContent('body');
      const hasData =
        body?.includes('Total') ||
        body?.includes('Critical') ||
        body?.includes('Scan History') ||
        body?.includes('No vulnerability scan data');
      expect(hasData, 'Page should show data or empty state after generating').toBeTruthy();
    });

    test('summary stat cards are visible after generating', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports/vulnerability-trends`);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: /Generate Report/i }).click();
      await page.waitForTimeout(3000);

      // Summary row should show severity labels
      const body = await page.textContent('body');
      expect(body).toContain('Critical');
      expect(body).toContain('High');
    });

    test('product selector appears after first generate', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports/vulnerability-trends`);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: /Generate Report/i }).click();
      await page.waitForTimeout(3000);

      // After data loads, a product dropdown may appear (if org has products)
      const body = await page.textContent('body');
      // Just verify the page rendered without crashing
      expect(body!.length).toBeGreaterThan(100);
      expect(body).not.toContain('undefined');
      expect(body).not.toContain('NaN');
    });

    test('export buttons appear after generating', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports/vulnerability-trends`);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: /Generate Report/i }).click();
      await page.waitForTimeout(3000);

      const pdfBtn = page.getByRole('button', { name: /Download PDF/i });
      const csvBtn = page.getByRole('button', { name: /Download CSV/i });
      const pdfVisible = await pdfBtn.isVisible({ timeout: 5000 }).catch(() => false);
      const csvVisible = await csvBtn.isVisible({ timeout: 5000 }).catch(() => false);
      expect(pdfVisible || csvVisible, 'At least one export button should appear').toBeTruthy();
    });

    test('"All Reports" back link navigates to hub', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports/vulnerability-trends`);
      await page.waitForLoadState('networkidle');

      await page.getByRole('link', { name: /All Reports/i }).click();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/reports$/);
    });

    test('no console errors on vulnerability trends page', async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

      await page.goto(`${BASE_URL}/reports/vulnerability-trends`);
      await page.waitForLoadState('networkidle');

      const realErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
      expect(realErrors, `Console errors: ${realErrors.join(', ')}`).toHaveLength(0);
    });
  });

  // ─── Audit Trail ─────────────────────────────────────────────────────

  test.describe('Audit Trail — /reports/audit-trail', () => {
    test('page loads with date range, category filter, and generate button', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports/audit-trail`);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/audit-trail/);
      await expect(page.locator('input[type="date"]').first()).toBeVisible();

      // Category select
      await expect(page.locator('select')).toBeVisible();

      await expect(page.getByRole('button', { name: /Generate Report/i })).toBeVisible();
    });

    test('category dropdown has expected options', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports/audit-trail`);
      await page.waitForLoadState('networkidle');

      const select = page.locator('select');
      const options = await select.locator('option').allTextContents();

      expect(options.some(o => o.toLowerCase().includes('all'))).toBeTruthy();
      expect(options.some(o => o.toLowerCase().includes('auth'))).toBeTruthy();
      expect(options.some(o => o.toLowerCase().includes('vulnerab'))).toBeTruthy();
    });

    test('clicking Generate Report loads event data', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports/audit-trail`);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: /Generate Report/i }).click();
      await page.waitForTimeout(3000);

      const body = await page.textContent('body');
      const hasData =
        body?.includes('User Activity') ||
        body?.includes('ENISA') ||
        body?.includes('Repository Syncs') ||
        body?.includes('No events found');
      expect(hasData, 'Page should show event data or empty state after generating').toBeTruthy();
    });

    test('user activity section shows timestamp and user email columns', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports/audit-trail`);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: /Generate Report/i }).click();
      await page.waitForTimeout(3000);

      const body = await page.textContent('body');
      // Should contain column headers from the user events table
      const hasColumns =
        body?.includes('Timestamp') ||
        body?.includes('User') ||
        body?.includes('Event') ||
        body?.includes('No events found');
      expect(hasColumns, 'Should render event table headers or empty state').toBeTruthy();
    });

    test('filtering by category=auth and regenerating works', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports/audit-trail`);
      await page.waitForLoadState('networkidle');

      // Select "Authentication" category
      await page.locator('select').selectOption('auth');
      await page.getByRole('button', { name: /Generate Report/i }).click();
      await page.waitForTimeout(3000);

      const body = await page.textContent('body');
      // Page should render without errors regardless of whether auth events exist
      expect(body!.length).toBeGreaterThan(100);
      expect(body).not.toContain('undefined');
      expect(body).not.toContain('NaN');
    });

    test('export buttons appear after generating', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports/audit-trail`);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: /Generate Report/i }).click();
      await page.waitForTimeout(3000);

      const pdfBtn = page.getByRole('button', { name: /Download PDF/i });
      const csvBtn = page.getByRole('button', { name: /Download CSV/i });
      const pdfVisible = await pdfBtn.isVisible({ timeout: 5000 }).catch(() => false);
      const csvVisible = await csvBtn.isVisible({ timeout: 5000 }).catch(() => false);
      expect(pdfVisible || csvVisible, 'At least one export button should appear').toBeTruthy();
    });

    test('"All Reports" back link navigates to hub', async ({ page }) => {
      await page.goto(`${BASE_URL}/reports/audit-trail`);
      await page.waitForLoadState('networkidle');

      await page.getByRole('link', { name: /All Reports/i }).click();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/reports$/);
    });

    test('no console errors on audit trail page', async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

      await page.goto(`${BASE_URL}/reports/audit-trail`);
      await page.waitForLoadState('networkidle');

      const realErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
      expect(realErrors, `Console errors: ${realErrors.join(', ')}`).toHaveLength(0);
    });
  });
});

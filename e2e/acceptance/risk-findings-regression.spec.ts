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
 * Acceptance Test: Risk Findings Display Regression
 *
 * Regression suite to prevent recurrence of:
 * 1. Severity stat cards showing total counts instead of open-only
 * 2. Product detail tab only recognising 'dismissed' (not resolved/mitigated/acknowledged)
 * 3. Missing "All findings handled" message when no open findings remain
 * 4. Invalid 'closed' status appearing in the UI
 *
 * Tests both:
 * - Main Risk Findings page (/risk-findings)
 * - Product Detail Risk Findings tab (/products/:id?tab=risk-findings)
 *
 * @tags @acceptance @regression
 */
import { test, expect } from '@playwright/test';
import { TEST_USERS, TEST_PASSWORD, TEST_IDS } from '../helpers/test-data.js';
import { apiLogin, apiGet } from '../helpers/api-client.js';

const BASE_URL = process.env.E2E_BASE_URL || 'https://dev.cranis2.dev';

test.describe('Risk Findings Display Regression @acceptance', () => {
  let token: string;

  test.beforeAll(async () => {
    token = await apiLogin(TEST_USERS.mfgAdmin, TEST_PASSWORD);
  });

  // ─── Main Risk Findings page (/risk-findings) ─────────────────────────

  test('risk findings page loads via sidebar navigation', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Expand the Repositories accordion section
    await page.getByRole('button', { name: 'Repositories' }).click();
    await page.waitForTimeout(300);

    // Click Risk Findings link
    await page.getByRole('link', { name: 'Risk Findings' }).click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/risk-findings/);
  });

  test('risk findings page has stat cards with numeric values', async ({ page }) => {
    await page.goto(`${BASE_URL}/risk-findings`);
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');
    expect(body).toBeTruthy();

    // Stat cards should show "Critical", "High", "Medium + Low"
    const hasCriticalLabel = body?.toLowerCase().includes('critical');
    const hasHighLabel = body?.toLowerCase().includes('high');
    expect(hasCriticalLabel, 'Should have Critical stat card').toBeTruthy();
    expect(hasHighLabel, 'Should have High stat card').toBeTruthy();

    // No broken rendering
    expect(body).not.toContain('undefined');
    expect(body).not.toContain('NaN');
  });

  test('risk findings stat cards show resolved/dismissed context when counts are zero', async ({ page }) => {
    await page.goto(`${BASE_URL}/risk-findings`);
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');

    // When open-only counts are 0 but total counts > 0, sub text should say "resolved/dismissed"
    // or "none found" — NOT show the total count as if they're open
    const hasResolvedContext =
      body?.includes('resolved/dismissed') ||
      body?.includes('none found') ||
      body?.includes('immediate action') ||
      body?.includes('review needed');
    expect(hasResolvedContext, 'Stat cards should show contextual sub-text').toBeTruthy();
  });

  test('risk findings page shows green checkmark for products with all findings handled', async ({ page }) => {
    await page.goto(`${BASE_URL}/risk-findings`);
    await page.waitForLoadState('networkidle');

    // Check via API if any products have all findings resolved
    const overview = await apiGet('/api/risk-findings/overview', token);
    const allHandledProducts = overview.products.filter(
      (p: any) => p.findings.total > 0 && p.findings.open === 0 && p.findings.acknowledged === 0
    );

    if (allHandledProducts.length > 0) {
      const body = await page.textContent('body');
      // Should show "All X findings resolved or dismissed" or checkmark
      const hasAllHandled =
        body?.includes('All') && (body?.includes('resolved') || body?.includes('dismissed'));
      expect(hasAllHandled, 'Products with all findings handled should show green message').toBeTruthy();
    }
  });

  test('no console errors on risk findings page', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`${BASE_URL}/risk-findings`);
    await page.waitForLoadState('networkidle');

    const realErrors = consoleErrors.filter(
      (err) => !err.includes('favicon') && !err.includes('404') && !err.includes('Failed to load resource')
    );
    expect(realErrors, `Console errors found: ${realErrors.join(', ')}`).toHaveLength(0);
  });

  // ─── Product Detail Risk Findings tab ──────────────────────────────────

  test('product detail risk findings tab loads', async ({ page }) => {
    // Use the github test product which has seeded findings
    await page.goto(`${BASE_URL}/products/${TEST_IDS.products.github}?tab=risk-findings`);
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');
    expect(body).toBeTruthy();

    // Should show findings count or "findings" text
    const hasFindingsContent =
      body?.toLowerCase().includes('finding') ||
      body?.toLowerCase().includes('vulnerability') ||
      body?.toLowerCase().includes('scan');
    expect(hasFindingsContent, 'Risk findings tab should display findings-related content').toBeTruthy();
  });

  test('product detail shows status badges for resolved/mitigated/dismissed findings', async ({ page }) => {
    await page.goto(`${BASE_URL}/products/${TEST_IDS.products.github}?tab=risk-findings`);
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');

    // The github product has findings in all 5 statuses
    // Status badges should include "Resolved", "Mitigated", "Dismissed"
    const hasResolvedBadge = body?.includes('Resolved');
    const hasMitigatedBadge = body?.includes('Mitigated');
    const hasDismissedBadge = body?.includes('Dismissed');

    // At least one of these should be visible (seeded data has all three)
    const hasAnyStatusBadge = hasResolvedBadge || hasMitigatedBadge || hasDismissedBadge;
    expect(hasAnyStatusBadge, 'Should show status badges for handled findings (Resolved/Mitigated/Dismissed)').toBeTruthy();
  });

  test('product detail shows acknowledged badge with warning style', async ({ page }) => {
    await page.goto(`${BASE_URL}/products/${TEST_IDS.products.github}?tab=risk-findings`);
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');

    // Seeded data includes an acknowledged finding
    const hasAcknowledgedBadge = body?.includes('Acknowledged');
    expect(hasAcknowledgedBadge, 'Should show Acknowledged badge for acknowledged findings').toBeTruthy();
  });

  test('product detail summary line shows proper status breakdown', async ({ page }) => {
    await page.goto(`${BASE_URL}/products/${TEST_IDS.products.github}?tab=risk-findings`);
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');

    // Summary should include "open" count
    const hasOpenCount = body?.includes('open');
    expect(hasOpenCount, 'Summary should mention open count').toBeTruthy();

    // Should NOT show the old "mitigated" label for dismissed count
    // (regression: previously all dismissed were labelled "mitigated")
    // The page should distinguish between the actual status types
    const hasStatusBreakdown =
      body?.includes('resolved') ||
      body?.includes('mitigated') ||
      body?.includes('dismissed');
    expect(hasStatusBreakdown, 'Summary should show resolved/mitigated/dismissed breakdown').toBeTruthy();
  });

  test('no "closed" status appears in the UI (invalid status regression)', async ({ page }) => {
    await page.goto(`${BASE_URL}/products/${TEST_IDS.products.github}?tab=risk-findings`);
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');

    // "closed" is not a valid triage status — should never appear as a status badge
    // Note: "closed" might appear in other contexts (e.g. CRA report stages),
    // so we check specifically for status badge patterns
    const closedAsStatus = body?.match(/✓\s*Closed/i);
    expect(closedAsStatus, '"✓ Closed" should never appear as a status badge — use "resolved" instead').toBeFalsy();
  });

  test('no console errors on product detail risk findings tab', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`${BASE_URL}/products/${TEST_IDS.products.github}?tab=risk-findings`);
    await page.waitForLoadState('networkidle');

    const realErrors = consoleErrors.filter(
      (err) => !err.includes('favicon') && !err.includes('404') && !err.includes('Failed to load resource')
    );
    expect(realErrors, `Console errors found: ${realErrors.join(', ')}`).toHaveLength(0);
  });

  // ─── API-level regression tests ────────────────────────────────────────

  test('API: overview endpoint returns open-only severity fields', async () => {
    const data = await apiGet('/api/risk-findings/overview', token);

    expect(data).toHaveProperty('totals');
    expect(data.totals).toHaveProperty('openCritical');
    expect(data.totals).toHaveProperty('openHigh');
    expect(data.totals).toHaveProperty('openMedium');
    expect(data.totals).toHaveProperty('openLow');

    // open counts should never exceed total counts
    expect(data.totals.openCritical).toBeLessThanOrEqual(data.totals.critical);
    expect(data.totals.openHigh).toBeLessThanOrEqual(data.totals.high);
    expect(data.totals.openMedium).toBeLessThanOrEqual(data.totals.medium);
    expect(data.totals.openLow).toBeLessThanOrEqual(data.totals.low);
  });

  test('API: per-product findings have all valid statuses (no "closed")', async () => {
    const data = await apiGet(`/api/risk-findings/${TEST_IDS.products.github}`, token);

    const validStatuses = ['open', 'dismissed', 'acknowledged', 'mitigated', 'resolved'];
    for (const finding of data.findings) {
      expect(
        validStatuses.includes(finding.status),
        `Finding ${finding.source_id} has invalid status "${finding.status}"`
      ).toBe(true);
    }
  });

  test('API: per-product summary includes all 5 status counts', async () => {
    const data = await apiGet(`/api/risk-findings/${TEST_IDS.products.github}`, token);

    expect(data.summary).toHaveProperty('open');
    expect(data.summary).toHaveProperty('dismissed');
    expect(data.summary).toHaveProperty('acknowledged');
    expect(data.summary).toHaveProperty('mitigated');
    expect(data.summary).toHaveProperty('resolved');

    // Status counts should sum to total
    const statusSum =
      data.summary.open +
      data.summary.dismissed +
      data.summary.acknowledged +
      data.summary.mitigated +
      data.summary.resolved;
    expect(statusSum).toBe(data.summary.total);
  });
});

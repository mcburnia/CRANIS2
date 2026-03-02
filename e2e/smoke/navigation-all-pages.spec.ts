/**
 * Smoke Test 02: Navigation — All Pages
 *
 * Converts: cowork-tests/smoke/02-navigation-all-pages.md
 * Navigates to every sidebar page and verifies each loads with content and no errors.
 *
 * @tags @smoke
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'https://dev.cranis2.dev';

// All authenticated pages accessible from the sidebar
const SIDEBAR_PAGES = [
  // Overview section (expanded by default)
  { name: 'Dashboard', url: '/dashboard' },
  { name: 'Notifications', url: '/notifications' },

  // Compliance section
  { name: 'Products', url: '/products', section: 'Compliance' },
  { name: 'Obligations', url: '/obligations', section: 'Compliance' },
  { name: 'Technical Files', url: '/technical-files', section: 'Compliance' },
  { name: 'ENISA Reporting', url: '/vulnerability-reports', section: 'Compliance' },
  { name: 'Licenses', url: '/license-compliance', section: 'Compliance' },
  { name: 'IP Proof', url: '/ip-proof', section: 'Compliance' },
  { name: 'Due Diligence', url: '/due-diligence', section: 'Compliance' },

  // Repositories section
  { name: 'Repos', url: '/repos', section: 'Repositories' },
  { name: 'Contributors', url: '/contributors', section: 'Repositories' },
  { name: 'Dependencies', url: '/dependencies', section: 'Repositories' },
  { name: 'Risk Findings', url: '/risk-findings', section: 'Repositories' },

  // Billing section
  { name: 'Billing', url: '/billing', section: 'Billing' },
  { name: 'Reports', url: '/reports', section: 'Billing' },

  // Settings section
  { name: 'Stakeholders', url: '/stakeholders', section: 'Settings' },
  { name: 'Organisation', url: '/organisation', section: 'Settings' },
  { name: 'Audit Log', url: '/audit-log', section: 'Settings' },
  { name: 'Marketplace', url: '/marketplace/settings', section: 'Settings' },
];

test.describe('Navigation — All Pages @smoke', () => {

  for (const page_def of SIDEBAR_PAGES) {
    test(`${page_def.name} page loads at ${page_def.url}`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      // If this page is in a collapsed section, expand it first
      if (page_def.section) {
        await page.goto(`${BASE_URL}/dashboard`);
        await page.waitForLoadState('networkidle');
        await page.getByRole('button', { name: page_def.section }).click();
        await page.waitForTimeout(300);
        await page.getByRole('link', { name: page_def.name }).first().click();
      } else {
        await page.goto(`${BASE_URL}${page_def.url}`);
      }

      await page.waitForLoadState('networkidle');

      // Verify we're on the expected page (URL should contain the path)
      const currentUrl = page.url();
      expect(currentUrl, `Expected URL to contain ${page_def.url}`).toContain(page_def.url);

      // Verify page has meaningful content (not blank or error page)
      const body = await page.textContent('body');
      expect(body, `Page ${page_def.name} should have content`).toBeTruthy();
      expect(body!.length, `Page ${page_def.name} should not be empty`).toBeGreaterThan(50);

      // Verify no "404" or "Not Found" in the main content
      // (sidebar might contain unrelated text, so check main area)
      expect(body).not.toMatch(/Page Not Found/i);

      // Check for console errors (filter benign ones)
      const realErrors = consoleErrors.filter(
        (err) => !err.includes('favicon') && !err.includes('404')
      );
      expect(realErrors, `Console errors on ${page_def.name}: ${realErrors.join(', ')}`).toHaveLength(0);
    });
  }
});

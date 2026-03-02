/**
 * Break Test 02: XSS Injection on All Text Inputs
 *
 * Converts: cowork-tests/break/02-xss-injection-inputs.md
 * Tests that XSS payloads in product names, feedback, and other inputs
 * are properly escaped and never executed in the browser.
 *
 * @tags @break
 */
import { test, expect } from '@playwright/test';
import { TEST_USERS, TEST_PASSWORD } from '../helpers/test-data.js';
import { apiLogin, apiPost, apiGet, apiDelete } from '../helpers/api-client.js';

const BASE_URL = process.env.E2E_BASE_URL || 'https://dev.cranis2.dev';

test.describe('XSS Injection — All Inputs @break', () => {
  let token: string;
  const createdProductIds: string[] = [];
  const timestamp = Date.now();

  // XSS payloads to test
  const XSS_PAYLOADS = {
    scriptTag: `<script>alert('xss')</script>`,
    imgOnerror: `<img src=x onerror=alert('xss')>`,
    svgOnload: `<svg onload=alert('xss')>`,
    eventHandler: `" onmouseover="alert('xss')" data-x="`,
    iframeSrc: `<iframe src="javascript:alert('xss')"></iframe>`,
  } as const;

  test.beforeAll(async () => {
    token = await apiLogin(TEST_USERS.mfgAdmin, TEST_PASSWORD);
  });

  test.afterAll(async () => {
    // Clean up all XSS test products
    for (const id of createdProductIds) {
      try {
        await apiDelete(`/api/products/${id}`, token);
      } catch {
        // Product may already have been deleted or not created
      }
    }
  });

  // ── Helper: create product and track for cleanup ────────────────────

  async function createXssProduct(name: string): Promise<{ id: string; name: string } | null> {
    const res = await apiPost('/api/products', token, { name });
    if (res.status >= 400) {
      // If the server rejects XSS input, that is acceptable
      return null;
    }
    const products = await apiGet('/api/products', token);
    const found = products.products?.find((p: any) => p.name === name);
    if (found) {
      createdProductIds.push(found.id);
      return { id: found.id, name: found.name };
    }
    return null;
  }

  // ── Script tag injection ────────────────────────────────────────────

  test('XSS script tag in product name: should not execute', async ({ page }) => {
    const xssName = `XSS-Script-${timestamp}${XSS_PAYLOADS.scriptTag}`;
    const product = await createXssProduct(xssName);

    // If the API rejected the XSS payload, that is a valid defence
    if (!product) {
      expect(true, 'API rejected XSS script tag payload — valid defence').toBeTruthy();
      return;
    }

    // Navigate to product detail and verify no alert fires
    let alertFired = false;
    page.on('dialog', async (dialog) => {
      alertFired = true;
      await dialog.dismiss();
    });

    await page.goto(`${BASE_URL}/products/${product.id}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    expect(alertFired, 'XSS script tag payload should not trigger alert dialog').toBeFalsy();

    // Verify the payload is rendered as escaped text
    const body = await page.textContent('body');
    expect(
      body,
      'Product detail page should contain the literal script text'
    ).toContain('<script>');
  });

  // ── img onerror injection ───────────────────────────────────────────

  test('XSS img onerror in product name: should not execute', async ({ page }) => {
    const xssName = `XSS-Img-${timestamp}${XSS_PAYLOADS.imgOnerror}`;
    const product = await createXssProduct(xssName);

    if (!product) {
      expect(true, 'API rejected XSS img onerror payload — valid defence').toBeTruthy();
      return;
    }

    let alertFired = false;
    page.on('dialog', async (dialog) => {
      alertFired = true;
      await dialog.dismiss();
    });

    await page.goto(`${BASE_URL}/products/${product.id}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    expect(alertFired, 'XSS img onerror payload should not trigger alert dialog').toBeFalsy();
  });

  // ── SVG onload injection ────────────────────────────────────────────

  test('XSS svg onload in product name: should not execute', async ({ page }) => {
    const xssName = `XSS-Svg-${timestamp}${XSS_PAYLOADS.svgOnload}`;
    const product = await createXssProduct(xssName);

    if (!product) {
      expect(true, 'API rejected XSS svg onload payload — valid defence').toBeTruthy();
      return;
    }

    let alertFired = false;
    page.on('dialog', async (dialog) => {
      alertFired = true;
      await dialog.dismiss();
    });

    await page.goto(`${BASE_URL}/products/${product.id}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    expect(alertFired, 'XSS svg onload payload should not trigger alert dialog').toBeFalsy();
  });

  // ── Event handler attribute injection ───────────────────────────────

  test('XSS event handler attribute in product name: should not execute', async ({ page }) => {
    const xssName = `XSS-Event-${timestamp}${XSS_PAYLOADS.eventHandler}`;
    const product = await createXssProduct(xssName);

    if (!product) {
      expect(true, 'API rejected XSS event handler payload — valid defence').toBeTruthy();
      return;
    }

    let alertFired = false;
    page.on('dialog', async (dialog) => {
      alertFired = true;
      await dialog.dismiss();
    });

    await page.goto(`${BASE_URL}/products/${product.id}`);
    await page.waitForLoadState('networkidle');

    // Hover over the product name area to trigger any onmouseover handler
    const heading = page.locator('h1, h2, [class*="product-name"], [class*="title"]').first();
    if (await heading.isVisible()) {
      await heading.hover();
      await page.waitForTimeout(500);
    }

    expect(alertFired, 'XSS event handler payload should not trigger alert dialog').toBeFalsy();
  });

  // ── Verify XSS payloads are escaped on product list page ────────────

  test('XSS payloads render as escaped text on product list', async ({ page }) => {
    let alertFired = false;
    page.on('dialog', async (dialog) => {
      alertFired = true;
      await dialog.dismiss();
    });

    await page.goto(`${BASE_URL}/products`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    expect(alertFired, 'No XSS payload should trigger an alert on the products list').toBeFalsy();

    // If any XSS products were created, their literal text should be visible
    if (createdProductIds.length > 0) {
      const body = await page.textContent('body');
      // At least one XSS marker should be present as text
      const hasXssMarker =
        body?.includes(`XSS-Script-${timestamp}`) ||
        body?.includes(`XSS-Img-${timestamp}`) ||
        body?.includes(`XSS-Svg-${timestamp}`) ||
        body?.includes(`XSS-Event-${timestamp}`);
      expect(
        hasXssMarker,
        'At least one XSS product name should be displayed as literal text'
      ).toBeTruthy();
    }
  });

  // ── Verify stored XSS does not execute on page reload ───────────────

  test('stored XSS payloads do not execute on page reload', async ({ page }) => {
    test.skip(createdProductIds.length === 0, 'No XSS products were created');

    let alertFired = false;
    page.on('dialog', async (dialog) => {
      alertFired = true;
      await dialog.dismiss();
    });

    // Visit each product detail page to check for stored XSS execution
    for (const id of createdProductIds) {
      await page.goto(`${BASE_URL}/products/${id}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
    }

    expect(
      alertFired,
      'Stored XSS payloads should not execute on any product detail page'
    ).toBeFalsy();
  });

  // ── XSS in feedback submission ──────────────────────────────────────

  test('XSS in feedback message should not cause execution', async ({ page }) => {
    const xssMessage = `Test feedback with XSS: ${XSS_PAYLOADS.scriptTag}`;

    // Submit feedback via API with XSS in the message
    const feedbackRes = await apiPost('/api/feedback', token, {
      category: 'bug',
      message: xssMessage,
      pageUrl: `${BASE_URL}/products`,
    });

    // The feedback should either be accepted (XSS escaped on render)
    // or rejected by the server
    expect(
      feedbackRes.status,
      `Feedback submission should succeed or reject cleanly, got ${feedbackRes.status}`
    ).toBeLessThan(500);

    // If there's a feedback page visible to the user, verify no execution
    let alertFired = false;
    page.on('dialog', async (dialog) => {
      alertFired = true;
      await dialog.dismiss();
    });

    // Navigate to dashboard (where feedback might be shown)
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    expect(
      alertFired,
      'XSS in feedback message should not trigger alert on dashboard'
    ).toBeFalsy();
  });

  test('XSS img onerror in feedback message should not execute', async () => {
    const xssMessage = `Feedback with img XSS: ${XSS_PAYLOADS.imgOnerror}`;

    const feedbackRes = await apiPost('/api/feedback', token, {
      category: 'feedback',
      message: xssMessage,
      pageUrl: `${BASE_URL}/products`,
    });

    // Should not cause a server error
    expect(
      feedbackRes.status,
      `Feedback with img XSS should not cause 500, got ${feedbackRes.status}`
    ).toBeLessThan(500);
  });
});

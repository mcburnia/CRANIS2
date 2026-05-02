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
 * Break Test 06: Session Expiry Behaviour
 *
 * Converts: cowork-tests/break/06-session-expiry-behaviour.md
 * Tests that the application handles missing, corrupted, and expired sessions:
 * - Removed session token redirects to login
 * - Corrupted/invalid token redirects to login
 * - Expired JWT redirects to login
 * - Direct URL access without session redirects to login
 * - API calls without auth return 401
 * - API calls with invalid/malformed tokens return 401
 * - Login form is functional after redirect
 *
 * @tags @break
 */
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'https://dev.cranis2.dev';

test.describe('Session Expiry Behaviour @break', () => {

  test('removed session token redirects to login', async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    // Navigate to the app and set a valid-looking token first
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      localStorage.setItem('session_token', 'temporary-token');
    });

    // Now remove the token
    await page.evaluate(() => {
      localStorage.removeItem('session_token');
    });

    // Navigate to a protected page
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Should be redirected to login
    expect(page.url(), 'Should redirect to login when session token is removed').toContain('login');

    await context.close();
  });

  test('corrupted/invalid token redirects to login', async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    // Navigate to app and set a corrupted token
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      localStorage.setItem('session_token', 'this-is-not-a-valid-jwt-token-at-all');
    });

    // Try to access a protected page
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Should redirect to login
    expect(page.url(), 'Should redirect to login with corrupted token').toContain('login');

    await context.close();
  });

  test('expired JWT token redirects to login', async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    // Craft a JWT with an expired timestamp
    // Header: {"alg":"HS256","typ":"JWT"} = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
    // Payload: {"sub":"fake","exp":1000000000} (expired in 2001)
    // Signature: invalid but structurally correct
    const expiredToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      'eyJzdWIiOiJmYWtlLXVzZXIiLCJleHAiOjEwMDAwMDAwMDB9.' +
      'invalid-signature-placeholder';

    await page.goto(BASE_URL);
    await page.evaluate((token) => {
      localStorage.setItem('session_token', token);
    }, expiredToken);

    // Try to access protected page
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Should redirect to login
    expect(page.url(), 'Should redirect to login with expired JWT').toContain('login');

    await context.close();
  });

  test('direct URL access without any session redirects to login', async ({ browser }) => {
    // Explicitly create a context with NO storageState to ensure no session leaks
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();

    // Verify no session_token exists
    await page.goto(BASE_URL);
    const token = await page.evaluate(() => localStorage.getItem('session_token'));
    expect(token, 'Fresh context should have no session_token').toBeNull();

    // Navigate to a protected page
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Should be redirected to login
    expect(page.url(), 'Should redirect to login without any session').toContain('login');

    await context.close();
  });

  test('API call with no auth header returns 401', async () => {
    const res = await fetch(`${BASE_URL}/api/products`, {
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status, 'API call without Authorization header should return 401').toBe(401);
  });

  test('API call with invalid token returns 401', async () => {
    const res = await fetch(`${BASE_URL}/api/products`, {
      headers: {
        Authorization: 'Bearer completely-fake-token-12345',
        'Content-Type': 'application/json',
      },
    });

    expect(res.status, 'API call with invalid token should return 401').toBe(401);
  });

  test('API call with malformed Bearer header returns 401', async () => {
    const res = await fetch(`${BASE_URL}/api/products`, {
      headers: {
        Authorization: 'Bearer invalid.token.here',
        'Content-Type': 'application/json',
      },
    });

    expect(res.status, 'API call with malformed Bearer token should return 401').toBe(401);
  });

  test('login form is functional at login page', async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    // Navigate directly to the login page
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    // Verify login form elements are visible and functional
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    await expect(emailInput, 'Email input should be visible on login page').toBeVisible();
    await expect(passwordInput, 'Password input should be visible on login page').toBeVisible();

    // Verify inputs are interactable (not disabled or readonly)
    await emailInput.fill('test@example.com');
    const emailValue = await emailInput.inputValue();
    expect(emailValue, 'Email input should accept text input').toBe('test@example.com');

    await passwordInput.fill('testpassword');
    const passwordValue = await passwordInput.inputValue();
    expect(passwordValue, 'Password input should accept text input').toBe('testpassword');

    // Verify submit button exists
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton, 'Login submit button should be visible').toBeVisible();

    await context.close();
  });
});

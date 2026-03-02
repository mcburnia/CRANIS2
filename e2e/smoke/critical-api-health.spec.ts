/**
 * Smoke Test 03: Critical API Health
 *
 * Converts: cowork-tests/smoke/03-critical-api-health.md
 * Checks API endpoint health using page.request (not browser navigation).
 *
 * @tags @smoke
 */
import { test, expect } from '@playwright/test';
import { TEST_USERS, TEST_PASSWORD } from '../helpers/test-data.js';
import { apiLogin } from '../helpers/api-client.js';

const BASE_URL = process.env.E2E_BASE_URL || 'https://dev.cranis2.dev';

test.describe('Critical API Health @smoke', () => {
  let token: string;

  test.beforeAll(async () => {
    token = await apiLogin(TEST_USERS.mfgAdmin, TEST_PASSWORD);
  });

  const endpoints = [
    { path: '/api/auth/me', description: 'Auth session', responseKey: 'user' },
    { path: '/api/products', description: 'Product list', responseKey: 'products' },
    { path: '/api/cra-reports', description: 'CRA reports', responseKey: null },
    { path: '/api/notifications', description: 'Notifications', responseKey: null },
    { path: '/api/org', description: 'Organisation', responseKey: null },
    { path: '/api/obligations/overview', description: 'Obligations overview', responseKey: null },
    { path: '/api/stakeholders', description: 'Stakeholders', responseKey: null },
  ];

  for (const endpoint of endpoints) {
    test(`${endpoint.description} (${endpoint.path}) returns 200`, async ({ request }) => {
      // Some endpoints are slow with large datasets (e.g. 1000+ products)
      test.setTimeout(60_000);

      const response = await request.get(`${BASE_URL}${endpoint.path}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 45_000,
      });

      // Verify HTTP 200
      expect(response.status(), `${endpoint.path} should return 200`).toBe(200);

      // Verify JSON response
      const contentType = response.headers()['content-type'];
      expect(contentType, `${endpoint.path} should return JSON`).toContain('application/json');

      // Verify response body is valid JSON
      const body = await response.json();
      expect(body, `${endpoint.path} should return non-null body`).toBeTruthy();

      // If a specific response key is expected, verify it exists
      if (endpoint.responseKey) {
        expect(body[endpoint.responseKey], `${endpoint.path} should contain '${endpoint.responseKey}'`).toBeDefined();
      }
    });
  }

  test('unauthenticated request returns 401', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/products`, {
      headers: {},
    });
    expect(response.status()).toBe(401);
  });

  test('invalid token returns 401', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/products`, {
      headers: { Authorization: 'Bearer invalid-token-12345' },
    });
    expect(response.status()).toBe(401);
  });
});

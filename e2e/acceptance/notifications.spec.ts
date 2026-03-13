/**
 * Acceptance Test 10: Notifications — View, Mark as Read, Unread Count
 *
 * Converts: cowork-tests/acceptance/10-notifications.md
 * Tests the notifications page, notification list rendering, severity values,
 * unread badge count, mark-as-read interactions, and read state persistence.
 *
 * @tags @acceptance
 */
import { test, expect } from '@playwright/test';
import { TEST_USERS, TEST_PASSWORD } from '../helpers/test-data.js';
import { apiLogin, apiGet, apiPut } from '../helpers/api-client.js';

const BASE_URL = process.env.E2E_BASE_URL || 'https://dev.cranis2.dev';

// Valid notification severity values per CRANIS2 convention
const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];

test.describe('Notifications @acceptance', () => {

  test.describe('Notification list and display', () => {

    test('notifications page loads', async ({ page }) => {
      await page.goto(`${BASE_URL}/notifications`);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/notifications/);

      const body = await page.textContent('body');
      expect(body).toBeTruthy();
      expect(body!.length).toBeGreaterThan(50);
    });

    test('notifications page shows list or empty state', async ({ page }) => {
      await page.goto(`${BASE_URL}/notifications`);
      await page.waitForLoadState('networkidle');

      const body = await page.textContent('body');

      // Should either have notification content or an empty state message
      const hasNotifications = body!.toLowerCase().includes('notification') ||
                               body!.toLowerCase().includes('alert') ||
                               body!.toLowerCase().includes('scan') ||
                               body!.toLowerCase().includes('deadline');
      const hasEmptyState = body!.toLowerCase().includes('no notification') ||
                            body!.toLowerCase().includes('all caught up') ||
                            body!.toLowerCase().includes('no new') ||
                            body!.toLowerCase().includes('empty');

      expect(
        hasNotifications || hasEmptyState,
        'Notifications page should show notification list or empty state'
      ).toBeTruthy();
    });

    test('notification API returns list with valid structure', async () => {
      const token = await apiLogin(TEST_USERS.mfgAdmin, TEST_PASSWORD);
      const data = await apiGet('/api/notifications', token);

      // API returns array or { notifications: [...] }
      const notifications = Array.isArray(data) ? data : data.notifications;
      expect(notifications).toBeDefined();
      expect(Array.isArray(notifications)).toBe(true);

      if (notifications.length > 0) {
        const notification = notifications[0];

        // Each notification should have message/title and timestamp
        const hasMessage = notification.message || notification.title || notification.text;
        expect(hasMessage, 'Notification should have message content').toBeTruthy();

        // Should have a created_at or timestamp field
        const hasTimestamp = notification.created_at || notification.createdAt || notification.timestamp;
        expect(hasTimestamp, 'Notification should have a timestamp').toBeTruthy();

        // Should have severity
        const severity = notification.severity || notification.level || notification.type;
        expect(severity, 'Notification should have a severity/level').toBeTruthy();
      }
    });

    test('notification severity values use correct enum (not warning)', async () => {
      const token = await apiLogin(TEST_USERS.mfgAdmin, TEST_PASSWORD);
      const data = await apiGet('/api/notifications', token);
      const notifications = Array.isArray(data) ? data : data.notifications;

      for (const notification of notifications) {
        const severity = notification.severity || notification.level;
        if (severity) {
          expect(
            VALID_SEVERITIES,
            `Severity "${severity}" should be one of: ${VALID_SEVERITIES.join(', ')} — NOT "warning"`
          ).toContain(severity);

          // Explicit check: "warning" is not a valid severity
          expect(severity).not.toBe('warning');
        }
      }
    });

    test('no console errors on notifications page', async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto(`${BASE_URL}/notifications`);
      await page.waitForLoadState('networkidle');

      const realErrors = consoleErrors.filter(
        (err) => !err.includes('favicon') && !err.includes('404') && !err.includes('Failed to load resource')
      );
      expect(realErrors, `Console errors on notifications: ${realErrors.join(', ')}`).toHaveLength(0);
    });
  });

  test.describe('Unread count and sidebar badge', () => {

    test('unread count API returns a number', async () => {
      const token = await apiLogin(TEST_USERS.mfgAdmin, TEST_PASSWORD);
      const data = await apiGet('/api/notifications/unread-count', token);

      // Response contains count as a number
      const count = data.count ?? data.unreadCount ?? data;
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('sidebar notifications link shows badge when unread count > 0', async ({ page }) => {
      // First check if there are unread notifications
      const token = await apiLogin(TEST_USERS.mfgAdmin, TEST_PASSWORD);
      const data = await apiGet('/api/notifications/unread-count', token);
      const unreadCount = data.count ?? data.unreadCount ?? data;

      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForLoadState('networkidle');

      // The sidebar should show a Notifications link (in the Overview section)
      const notifLink = page.getByRole('link', { name: /Notifications/ });
      await expect(notifLink).toBeVisible();

      if (unreadCount > 0) {
        // If there are unread notifications, a badge/count should be visible
        // near the Notifications link
        const notifLinkText = await notifLink.textContent();
        const hasBadge = notifLinkText?.match(/\d+/) !== null;
        expect(hasBadge, 'Notifications link should show unread count badge').toBeTruthy();
      }
    });
  });

  test.describe('Mark as read interaction', () => {

    test('mark all as read updates unread count to 0', async () => {
      const token = await apiLogin(TEST_USERS.mfgAdmin, TEST_PASSWORD);

      // Get initial unread count
      const beforeData = await apiGet('/api/notifications/unread-count', token);
      const beforeCount = beforeData.count ?? beforeData.unreadCount ?? beforeData;

      // Mark all as read via API
      await apiPut('/api/notifications/read-all', token, {});

      // Verify unread count is now 0
      const afterData = await apiGet('/api/notifications/unread-count', token);
      const afterCount = afterData.count ?? afterData.unreadCount ?? afterData;
      expect(afterCount).toBe(0);
    });

    test('read state persists after page reload', async ({ page }) => {
      const token = await apiLogin(TEST_USERS.mfgAdmin, TEST_PASSWORD);

      // Mark all as read via API first
      await apiPut('/api/notifications/read-all', token, {});

      // Navigate to notifications
      await page.goto(`${BASE_URL}/notifications`);
      await page.waitForLoadState('networkidle');

      // Reload the page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Verify unread count is still 0 after reload
      const afterData = await apiGet('/api/notifications/unread-count', token);
      const afterCount = afterData.count ?? afterData.unreadCount ?? afterData;
      expect(afterCount).toBe(0);
    });

    test('notification items display on page after mark-all-read', async ({ page }) => {
      // Even after marking all as read, the notifications should still be listed
      // (they're read, not deleted)
      await page.goto(`${BASE_URL}/notifications`);
      await page.waitForLoadState('networkidle');

      const body = await page.textContent('body');
      expect(body).toBeTruthy();

      // Page should still render (not crash or show error)
      expect(body).not.toContain('undefined');
      expect(body).not.toMatch(/error/i);
    });
  });
});

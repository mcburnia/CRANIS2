import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const BASE_URL = process.env.E2E_BASE_URL || 'https://dev.cranis2.dev';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: {
      mode: 'on',
      size: { width: 1280, height: 720 },
    },
    launchOptions: {
      slowMo: 400,
    },
    ignoreHTTPSErrors: true,
  },

  projects: [
    // ── Auth setup — runs first, generates storageState files ──
    // No slowMo for auth setup — API logins don't need visual pacing
    {
      name: 'auth-setup',
      testMatch: 'auth/setup.ts',
      use: {
        launchOptions: { slowMo: 0 },
      },
    },

    // ── Smoke tests ──
    {
      name: 'smoke',
      testMatch: 'smoke/**/*.spec.ts',
      dependencies: ['auth-setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.resolve(__dirname, 'auth/storage-state-admin.json'),
      },
    },

    // ── Acceptance tests ──
    {
      name: 'acceptance',
      testMatch: 'acceptance/**/*.spec.ts',
      dependencies: ['auth-setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.resolve(__dirname, 'auth/storage-state-admin.json'),
      },
    },

    // ── Break tests ──
    {
      name: 'break',
      testMatch: 'break/**/*.spec.ts',
      dependencies: ['auth-setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.resolve(__dirname, 'auth/storage-state-admin.json'),
      },
    },
  ],
});

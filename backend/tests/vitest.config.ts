import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30000,
    hookTimeout: 60000,
    reporters: ['verbose', 'json'],
    outputFile: {
      json: './test-results.json',
    },
    pool: 'forks',
    fileParallelism: false, // Run suites sequentially to avoid test data conflicts
    include: [
      'unit/**/*.test.ts',
      'routes/**/*.test.ts',
      'services/**/*.test.ts',
      'integration/**/*.test.ts',
      'security/**/*.test.ts',
      'break/**/*.test.ts',
      'webhooks/**/*.test.ts',
    ],
    setupFiles: ['./setup/global-setup.ts'],
  },
});

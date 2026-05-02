/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

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
    globalSetup: ['./setup/global-setup.ts'],   // Runs ONCE: seed + rate-limit cleanup
    setupFiles: ['./setup/per-file-setup.ts'],   // Runs per-file: connection cleanup
    include: [
      'unit/**/*.test.ts',
      'routes/**/*.test.ts',
      'services/**/*.test.ts',
      'integration/**/*.test.ts',
      'security/**/*.test.ts',
      'break/**/*.test.ts',
      'webhooks/**/*.test.ts',
    ],
  },
});

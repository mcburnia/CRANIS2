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
 * Vitest globalSetup — runs ONCE before the entire test suite.
 *
 * Seeds test data and cleans stale rate-limit rows so tests start
 * from a known state. This file exports setup/teardown functions
 * (not beforeAll/afterAll — those only work in setupFiles/workers).
 */

import { closeAllConnections, BASE_URL } from './test-helpers.js';
import { seedAllTestData } from './seed-test-data.js';
import { cleanTestRateLimits } from './clean-rate-limits.js';

export async function setup(): Promise<void> {
  console.log('\n=== CRANIS2 Test Suite Starting ===');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  console.log('Seeding test data...');
  await seedAllTestData();

  console.log('Cleaning stale rate-limit rows for test orgs...');
  await cleanTestRateLimits();

  await closeAllConnections();
  console.log('');
}

export async function teardown(): Promise<void> {
  console.log('\n=== CRANIS2 Test Suite Complete ===\n');
}

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

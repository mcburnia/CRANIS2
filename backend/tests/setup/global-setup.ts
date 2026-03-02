import { beforeAll, afterAll } from 'vitest';
import { closeAllConnections } from './test-helpers.js';
import { seedAllTestData } from './seed-test-data.js';

beforeAll(async () => {
  console.log('\n=== CRANIS2 Test Suite Starting ===');
  console.log(`Target: ${process.env.TEST_BASE_URL || 'https://dev.cranis2.dev'}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  // Auto-seed test data (idempotent — safe to run every time)
  console.log('Seeding test data...');
  await seedAllTestData();
});

afterAll(async () => {
  await closeAllConnections();
  console.log('\n=== CRANIS2 Test Suite Complete ===\n');
});

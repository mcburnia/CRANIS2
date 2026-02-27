import { beforeAll, afterAll } from 'vitest';
import { closeAllConnections } from './test-helpers.js';

beforeAll(async () => {
  console.log('\n=== CRANIS2 Test Suite Starting ===');
  console.log(`Target: ${process.env.TEST_BASE_URL || 'https://dev.cranis2.dev'}`);
  console.log(`Time: ${new Date().toISOString()}\n`);
});

afterAll(async () => {
  await closeAllConnections();
  console.log('\n=== CRANIS2 Test Suite Complete ===\n');
});

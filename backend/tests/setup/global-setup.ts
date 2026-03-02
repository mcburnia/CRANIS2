import { beforeAll, afterAll } from 'vitest';
import { closeAllConnections, BASE_URL } from './test-helpers.js';

// Track whether seed has been called this process (avoid re-seeding per file)
let seeded = false;

beforeAll(async () => {
  console.log('\n=== CRANIS2 Test Suite Starting ===');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  // Seed test data via the dev API endpoint (runs server-side, idempotent)
  if (!seeded) {
    try {
      const res = await fetch(`${BASE_URL}/api/dev/seed-test-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        const body = await res.json();
        console.log('[SETUP] Test data seeded:', body.counts);
      } else {
        const text = await res.text();
        console.warn(`[SETUP] Seed endpoint returned ${res.status}: ${text}`);
      }
    } catch (err: any) {
      console.warn('[SETUP] Could not seed test data (endpoint may not exist):', err.message);
    }
    seeded = true;
  }
});

afterAll(async () => {
  await closeAllConnections();
  console.log('\n=== CRANIS2 Test Suite Complete ===\n');
});

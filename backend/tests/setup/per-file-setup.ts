/**
 * Vitest setupFiles — runs in each worker/fork before its test file.
 *
 * Lightweight: only handles connection cleanup after each file finishes.
 * Heavy work (seeding, rate-limit cleanup) is in globalSetup.
 */

import { afterAll } from 'vitest';
import { closeAllConnections, clearTokenCache } from './test-helpers.js';

afterAll(async () => {
  clearTokenCache();
  await closeAllConnections();
});

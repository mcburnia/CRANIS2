/**
 * Clean stale copilot_usage rows for test org IDs.
 *
 * This ensures rate-limit counters start fresh for each test run,
 * preventing 429 errors caused by rows left over from previous runs.
 */

import { getAppPool } from './test-helpers.js';
import { TEST_IDS } from './seed-test-data.js';

export async function cleanTestRateLimits(): Promise<void> {
  const pool = getAppPool();
  const testOrgIds = Object.values(TEST_IDS.orgs);

  const result = await pool.query(
    `DELETE FROM copilot_usage WHERE org_id = ANY($1::uuid[])`,
    [testOrgIds]
  );

  console.log(`  Cleaned ${result.rowCount} copilot_usage rows for test orgs`);
}

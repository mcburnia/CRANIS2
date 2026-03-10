/**
 * Clean stale test data before each suite run.
 *
 * - copilot_usage: prevents 429 rate-limit errors from previous runs
 * - vulnerability_findings: removes duplicates from old random-UUID seeds
 * - org_billing plan: resets to 'standard' (tests like public-api-v1 upgrade to pro)
 */

import { getAppPool } from './test-helpers.js';
import { TEST_IDS } from './seed-test-data.js';

const FINDING_IDS = [
  'e0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000002',
  'e0000001-0000-0000-0000-000000000003', 'e0000001-0000-0000-0000-000000000004',
  'e0000001-0000-0000-0000-000000000005', 'e0000001-0000-0000-0000-000000000006',
  'e0000001-0000-0000-0000-000000000007', 'e0000001-0000-0000-0000-000000000008',
  'e0000001-0000-0000-0000-000000000009', 'e0000001-0000-0000-0000-00000000000a',
  'e0000001-0000-0000-0000-00000000000b', 'e0000001-0000-0000-0000-00000000000c',
];

export async function cleanTestRateLimits(): Promise<void> {
  const pool = getAppPool();
  const testOrgIds = Object.values(TEST_IDS.orgs);

  // 1. Clean copilot rate-limit rows
  const rl = await pool.query(
    `DELETE FROM copilot_usage WHERE org_id = ANY($1::uuid[])`,
    [testOrgIds]
  );
  console.log(`  Cleaned ${rl.rowCount} copilot_usage rows`);

  // 2. Remove duplicate vulnerability findings (from old random-UUID seeds)
  //    Keep only the deterministic IDs seeded by seed-test-data.ts
  const vf = await pool.query(
    `DELETE FROM vulnerability_findings
     WHERE org_id = ANY($1::uuid[])
       AND NOT (id = ANY($2::uuid[]))`,
    [testOrgIds, FINDING_IDS]
  );
  console.log(`  Cleaned ${vf.rowCount} duplicate vulnerability findings`);

  // 3. Reset billing plans to standard (some tests upgrade to pro)
  await pool.query(
    `UPDATE org_billing SET plan = 'standard' WHERE org_id = ANY($1::text[])`,
    [testOrgIds]
  );
  console.log(`  Reset billing plans to standard for test orgs`);
}

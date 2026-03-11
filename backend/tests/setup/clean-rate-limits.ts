/**
 * Clean stale test data before each suite run.
 *
 * - copilot_usage: prevents 429 rate-limit errors from previous runs
 * - vulnerability_findings: removes duplicates from old random-UUID seeds
 * - org_billing plan: resets to 'standard' (tests like public-api-v1 upgrade to pro)
 */

import { getAppPool, getNeo4jSession } from './test-helpers.js';
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

  // Safety: verify we're operating on the test database, not live
  const dbResult = await pool.query('SELECT current_database()');
  const currentDb = dbResult.rows[0].current_database;
  if (currentDb !== 'cranis2_test') {
    throw new Error(
      `SAFETY: cleanTestRateLimits would modify "${currentDb}" — expected "cranis2_test". Aborting.`
    );
  }

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

  // 4. Clean orphan test products from Neo4j (created by POST /api/products tests)
  //    Seeded products use deterministic IDs starting with 'c0000001-'; anything else is an orphan.
  const seededProductIds = Object.values(TEST_IDS.products);
  const neo = getNeo4jSession();
  try {
    const delResult = await neo.run(
      `MATCH (o:Organisation)<-[:BELONGS_TO]-(p:Product)
       WHERE o.id IN $orgIds AND NOT p.id IN $seededIds
       DETACH DELETE p
       RETURN count(p) AS deleted`,
      { orgIds: testOrgIds, seededIds: seededProductIds }
    );
    const deleted = delResult.records[0]?.get('deleted')?.toNumber?.() ?? delResult.records[0]?.get('deleted') ?? 0;
    if (deleted > 0) console.log(`  Cleaned ${deleted} orphan test products from Neo4j`);
  } finally {
    await neo.close();
  }

  // 5. Clean corresponding orphan Postgres rows (obligations, stakeholders)
  const op = await pool.query(
    `DELETE FROM obligations WHERE org_id::text = ANY($1::text[]) AND NOT (product_id::text = ANY($2::text[]))`,
    [testOrgIds, seededProductIds]
  );
  const sp = await pool.query(
    `DELETE FROM stakeholders WHERE org_id::text = ANY($1::text[]) AND product_id IS NOT NULL AND NOT (product_id::text = ANY($2::text[]))`,
    [testOrgIds, seededProductIds]
  );
  if ((op.rowCount ?? 0) > 0 || (sp.rowCount ?? 0) > 0) {
    console.log(`  Cleaned ${op.rowCount} orphan obligations + ${sp.rowCount} orphan stakeholders from Postgres`);
  }
}

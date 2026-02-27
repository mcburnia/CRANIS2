/**
 * CRANIS2 Test Data Cleanup
 *
 * Removes all test data from app databases using the test_data_registry.
 * Safe: only deletes data created by the test harness.
 *
 * Run standalone: npx tsx backend/tests/setup/cleanup.ts
 */

import {
  getAppPool, getNeo4jSession, getTestPool,
  closeAllConnections,
} from './test-helpers.js';

// ─── Cleanup by Entity Type ─────────────────────────────────────────────

const PG_CLEANUP_ORDER: Array<{ entityType: string; table: string; idColumn: string }> = [
  // Child tables first (respects foreign keys)
  { entityType: 'cra_report_stage', table: 'cra_report_stages', idColumn: 'id' },
  { entityType: 'cra_report', table: 'cra_reports', idColumn: 'id' },
  { entityType: 'vulnerability_finding', table: 'vulnerability_findings', idColumn: 'id' },
  { entityType: 'license_finding', table: 'license_findings', idColumn: 'id' },
  { entityType: 'license_scan', table: 'license_scans', idColumn: 'id' },
  { entityType: 'vulnerability_scan', table: 'vulnerability_scans', idColumn: 'id' },
  { entityType: 'product_sbom', table: 'product_sboms', idColumn: 'id' },
  { entityType: 'product_version', table: 'product_versions', idColumn: 'id' },
  { entityType: 'sync_history', table: 'sync_history', idColumn: 'id' },
  { entityType: 'ip_proof_snapshot', table: 'ip_proof_snapshots', idColumn: 'id' },
  { entityType: 'technical_file_section', table: 'technical_file_sections', idColumn: 'id' },
  { entityType: 'obligation', table: 'obligations', idColumn: 'id' },
  { entityType: 'obligation_stage', table: 'obligation_stages', idColumn: 'id' },
  { entityType: 'stakeholder', table: 'stakeholders', idColumn: 'id' },
  { entityType: 'notification', table: 'notifications', idColumn: 'id' },
  { entityType: 'feedback', table: 'feedback', idColumn: 'id' },
  { entityType: 'escrow_deposit', table: 'escrow_deposits', idColumn: 'id' },
  { entityType: 'escrow_user', table: 'escrow_users', idColumn: 'id' },
  { entityType: 'escrow_config', table: 'escrow_configs', idColumn: 'id' },
  { entityType: 'marketplace_contact', table: 'marketplace_contacts', idColumn: 'id' },
  { entityType: 'marketplace_profile', table: 'marketplace_profiles', idColumn: 'id' },
  { entityType: 'billing_event', table: 'billing_events', idColumn: 'id' },
  { entityType: 'org_billing', table: 'org_billing', idColumn: 'org_id' },
  { entityType: 'repo_connection', table: 'repo_connections', idColumn: 'id' },
  { entityType: 'departed_contributor', table: 'departed_contributors', idColumn: 'id' },
  { entityType: 'user_event', table: 'user_events', idColumn: 'id' },
  { entityType: 'user', table: 'users', idColumn: 'id' },
];

async function cleanupPostgres(): Promise<number> {
  const appPool = getAppPool();
  const testPool = getTestPool();
  let totalDeleted = 0;

  for (const { entityType, table, idColumn } of PG_CLEANUP_ORDER) {
    const registry = await testPool.query(
      'SELECT entity_id FROM test_data_registry WHERE entity_type = $1 AND database = $2',
      [entityType, 'postgres']
    );

    if (registry.rows.length === 0) continue;

    const ids = registry.rows.map(r => r.entity_id);

    try {
      // Cast to uuid[] for UUID columns, text[] for varchar columns
      const castType = (idColumn === 'org_id' && table === 'org_billing') ? 'text[]' : 'uuid[]';
      const result = await appPool.query(
        `DELETE FROM ${table} WHERE ${idColumn} = ANY($1::${castType})`,
        [ids]
      );
      totalDeleted += result.rowCount || 0;
      if (result.rowCount && result.rowCount > 0) {
        console.log(`  Deleted ${result.rowCount} rows from ${table}`);
      }
    } catch (err: any) {
      // Table might not exist or FK constraint — log and continue
      console.warn(`  Warning cleaning ${table}: ${err.message}`);
    }
  }

  // Also clean up users that match test email patterns (safety net)
  try {
    const result = await appPool.query(
      `DELETE FROM users WHERE email LIKE '%.test' AND email LIKE 'test%'`
    );
    if (result.rowCount && result.rowCount > 0) {
      console.log(`  Safety net: deleted ${result.rowCount} test users by email pattern`);
      totalDeleted += result.rowCount;
    }
  } catch (err: any) {
    console.warn(`  Warning on safety net cleanup: ${err.message}`);
  }

  return totalDeleted;
}

async function cleanupNeo4j(): Promise<number> {
  const testPool = getTestPool();
  const session = getNeo4jSession();
  let totalDeleted = 0;

  try {
    // Get all Neo4j test entity IDs
    const registry = await testPool.query(
      "SELECT entity_type, entity_id FROM test_data_registry WHERE database = 'neo4j'"
    );

    // Delete products first (detach deletes relationships)
    const productIds = registry.rows
      .filter(r => r.entity_type === 'product')
      .map(r => r.entity_id);

    if (productIds.length > 0) {
      const result = await session.run(
        'MATCH (p:Product) WHERE p.id IN $ids DETACH DELETE p RETURN count(p) as deleted',
        { ids: productIds }
      );
      const deleted = result.records[0]?.get('deleted')?.toNumber?.() || result.records[0]?.get('deleted') || 0;
      totalDeleted += deleted;
      console.log(`  Deleted ${deleted} Product nodes`);
    }

    // Delete user nodes
    const userIds = registry.rows
      .filter(r => r.entity_type === 'user_neo4j')
      .map(r => r.entity_id);

    if (userIds.length > 0) {
      const result = await session.run(
        'MATCH (u:User) WHERE u.id IN $ids DETACH DELETE u RETURN count(u) as deleted',
        { ids: userIds }
      );
      const deleted = result.records[0]?.get('deleted')?.toNumber?.() || result.records[0]?.get('deleted') || 0;
      totalDeleted += deleted;
      console.log(`  Deleted ${deleted} User nodes`);
    }

    // Delete organisation nodes
    const orgIds = registry.rows
      .filter(r => r.entity_type === 'organisation')
      .map(r => r.entity_id);

    if (orgIds.length > 0) {
      const result = await session.run(
        'MATCH (o:Organisation) WHERE o.id IN $ids DETACH DELETE o RETURN count(o) as deleted',
        { ids: orgIds }
      );
      const deleted = result.records[0]?.get('deleted')?.toNumber?.() || result.records[0]?.get('deleted') || 0;
      totalDeleted += deleted;
      console.log(`  Deleted ${deleted} Organisation nodes`);
    }

    // Safety net: delete any nodes with test naming pattern
    const safetyResult = await session.run(
      `MATCH (n) WHERE n.name STARTS WITH 'test-' OR n.name STARTS WITH 'TestOrg-'
       DETACH DELETE n RETURN count(n) as deleted`
    );
    const safetyDeleted = safetyResult.records[0]?.get('deleted')?.toNumber?.() || safetyResult.records[0]?.get('deleted') || 0;
    if (safetyDeleted > 0) {
      console.log(`  Safety net: deleted ${safetyDeleted} Neo4j nodes by name pattern`);
      totalDeleted += safetyDeleted;
    }
  } finally {
    await session.close();
  }

  return totalDeleted;
}

async function cleanupTestRegistry(): Promise<void> {
  const testPool = getTestPool();
  await testPool.query('DELETE FROM test_data_registry');
  console.log('  Cleared test_data_registry');
}

// ─── Main Cleanup ────────────────────────────────────────────────────────

export async function cleanupAllTestData(): Promise<void> {
  console.log('\n=== Cleaning Up CRANIS2 Test Data ===\n');

  try {
    const pgDeleted = await cleanupPostgres();
    const neo4jDeleted = await cleanupNeo4j();
    await cleanupTestRegistry();

    console.log(`\n=== Cleanup Complete: ${pgDeleted} Postgres rows, ${neo4jDeleted} Neo4j nodes ===\n`);
  } catch (err) {
    console.error('Cleanup error:', err);
    throw err;
  }
}

// Run standalone
if (process.argv[1]?.endsWith('cleanup.ts') || process.argv[1]?.endsWith('cleanup.js')) {
  cleanupAllTestData()
    .then(() => closeAllConnections())
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

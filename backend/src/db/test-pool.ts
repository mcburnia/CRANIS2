/**
 * Separate connection pool for the cranis2_test database.
 * Used by admin endpoints to query test suite metadata and results.
 */

import pg from 'pg';

let testPool: pg.Pool | null = null;

export function getTestPool(): pg.Pool {
  if (!testPool) {
    testPool = new pg.Pool({
      host: process.env.PGHOST || 'postgres',
      port: parseInt(process.env.PGPORT || '5432', 10),
      database: 'cranis2_test',
      user: process.env.PGUSER || 'cranis2',
      password: process.env.PGPASSWORD || 'cranis2_dev_2026',
      max: 3,
    });
  }
  return testPool;
}

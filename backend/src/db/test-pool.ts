/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

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

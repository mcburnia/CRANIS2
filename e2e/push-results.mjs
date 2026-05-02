#!/usr/bin/env node
/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

/**
 * Push Playwright E2E test results to the cranis2_test database.
 *
 * Reads the JSON report produced by Playwright's JSON reporter
 * (test-results/results.json) and inserts/updates suites, test cases,
 * and results into the same database tables used by the Vitest backend tests.
 *
 * The results then appear on the Admin > Test Results page in the app.
 *
 * Requirements:
 *   - SSH tunnel to server Postgres must be running:
 *     ssh -N -L 5433:localhost:5432 mcburnia@10.0.0.122
 *   - Or use E2E_PGHOST / E2E_PGPORT env vars
 *
 * Usage:
 *   node push-results.mjs                     # default: localhost:5433
 *   E2E_PGPORT=5432 node push-results.mjs     # direct connection
 */

import { readFileSync, existsSync } from 'fs';
import pg from 'pg';

// ─── Configuration ──────────────────────────────────────────────────────────

const RESULTS_FILE = 'test-results/results.json';
const DB_CONFIG = {
  host: process.env.E2E_PGHOST || 'localhost',
  port: parseInt(process.env.E2E_PGPORT || '5433', 10),
  database: 'cranis2_test',
  user: process.env.E2E_PGUSER || 'cranis2',
  password: process.env.E2E_PGPASSWORD || 'cranis2_dev_2026',
};

// Map Playwright project names to test_suites categories
const CATEGORY_MAP = {
  'smoke': 'integration',      // smoke tests are integration-level
  'acceptance': 'route',        // acceptance tests verify routes/features
  'break': 'break',             // break tests map directly
  'auth-setup': 'integration',  // auth setup is infrastructure
};

// Priority mapping based on test type
const PRIORITY_MAP = {
  'smoke': 'critical',
  'acceptance': 'high',
  'break': 'medium',
  'auth-setup': 'low',
};

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  // 1. Read the JSON report
  if (!existsSync(RESULTS_FILE)) {
    console.error(`No results file found at ${RESULTS_FILE}`);
    console.error('Run "npm test" first to generate results, then push them.');
    process.exit(1);
  }

  const report = JSON.parse(readFileSync(RESULTS_FILE, 'utf-8'));
  console.log(`Read ${RESULTS_FILE}: ${report.suites?.length || 0} top-level suites`);

  // 2. Connect to the test database
  const pool = new pg.Pool(DB_CONFIG);
  try {
    await pool.query('SELECT 1');
    console.log(`Connected to cranis2_test at ${DB_CONFIG.host}:${DB_CONFIG.port}`);
  } catch (err) {
    console.error(`Cannot connect to cranis2_test at ${DB_CONFIG.host}:${DB_CONFIG.port}`);
    console.error('Make sure the SSH tunnel is running:');
    console.error('  ssh -N -L 5433:localhost:5432 mcburnia@10.0.0.122');
    console.error(err.message);
    process.exit(1);
  }

  // 3. Flatten all test specs from the Playwright report
  const specs = flattenSpecs(report.suites || []);
  console.log(`Found ${specs.length} test specs across all suites`);

  // 4. Group specs by their source file (= our suite)
  const suiteGroups = groupByFile(specs);
  console.log(`Grouped into ${Object.keys(suiteGroups).length} test suites`);

  // 5. Start a test run
  const runLabel = `Playwright E2E — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
  const runResult = await pool.query(
    `INSERT INTO test_runs (run_label, executor) VALUES ($1, $2) RETURNING id`,
    [runLabel, 'claude_code']
  );
  const runId = runResult.rows[0].id;
  console.log(`Started test run: ${runLabel} (${runId})`);

  // 6. Process each suite
  let totalPushed = 0;
  for (const [filePath, tests] of Object.entries(suiteGroups)) {
    const { suiteName, category, priority } = parseSuiteInfo(filePath);

    // Upsert the suite
    const suiteResult = await pool.query(
      `INSERT INTO test_suites (name, category, executor, description)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO UPDATE SET category = $2, executor = $3, description = $4
       RETURNING id`,
      [suiteName, category, 'claude_code', `Playwright E2E: ${filePath}`]
    );
    const suiteId = suiteResult.rows[0].id;

    // Upsert each test case and record result
    for (const test of tests) {
      const status = mapStatus(test.status);
      const durationMs = test.duration || 0;
      const errorMessage = test.errors?.map(e => e.message).join('\n') || null;

      // Upsert test case
      const caseResult = await pool.query(
        `INSERT INTO test_cases (suite_id, name, description, test_steps, expected_result, priority, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (suite_id, name) DO UPDATE SET
           description = $3, test_steps = $4, expected_result = $5, priority = $6, tags = $7
         RETURNING id`,
        [
          suiteId,
          test.title,
          test.titlePath?.join(' > ') || test.title,
          `Automated Playwright test: ${test.title}`,
          status === 'passed' ? 'Test passes' : 'Test should pass',
          priority,
          test.tags || null,
        ]
      );
      const caseId = caseResult.rows[0].id;

      // Record the result
      await pool.query(
        `INSERT INTO test_results (run_id, test_case_id, status, duration_ms, error_message)
         VALUES ($1, $2, $3, $4, $5)`,
        [runId, caseId, status, durationMs, errorMessage]
      );

      totalPushed++;
    }
  }

  // 7. Complete the test run
  await pool.query(
    `UPDATE test_runs SET
       completed_at = NOW(),
       total_tests = (SELECT COUNT(*) FROM test_results WHERE run_id = $1),
       passed = (SELECT COUNT(*) FROM test_results WHERE run_id = $1 AND status = 'passed'),
       failed = (SELECT COUNT(*) FROM test_results WHERE run_id = $1 AND status = 'failed'),
       skipped = (SELECT COUNT(*) FROM test_results WHERE run_id = $1 AND status = 'skipped')
     WHERE id = $1`,
    [runId]
  );

  // 8. Print summary
  const summary = await pool.query(
    `SELECT total_tests, passed, failed, skipped FROM test_runs WHERE id = $1`,
    [runId]
  );
  const s = summary.rows[0];
  console.log('\n── Results pushed to cranis2_test ──');
  console.log(`  Run:     ${runLabel}`);
  console.log(`  Total:   ${s.total_tests}`);
  console.log(`  Passed:  ${s.passed}`);
  console.log(`  Failed:  ${s.failed}`);
  console.log(`  Skipped: ${s.skipped}`);
  console.log(`\nResults are now visible at: https://dev.cranis2.dev/admin/test-results`);

  await pool.end();
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Recursively flatten the Playwright JSON report tree into individual test specs.
 */
function flattenSpecs(suites, parentTitlePath = []) {
  const specs = [];

  for (const suite of suites) {
    const titlePath = [...parentTitlePath, suite.title].filter(Boolean);

    // Process specs (leaf tests) in this suite
    for (const spec of (suite.specs || [])) {
      for (const test of (spec.tests || [])) {
        // Get the result from the last attempt
        const lastResult = test.results?.[test.results.length - 1];
        specs.push({
          title: spec.title,
          titlePath: [...titlePath, spec.title],
          file: suite.file || spec.file,
          status: test.status || lastResult?.status || 'unknown',
          duration: lastResult?.duration || 0,
          projectName: test.projectName || test.projectId,
          errors: lastResult?.errors || [],
          tags: spec.tags || [],
        });
      }
    }

    // Recurse into child suites
    if (suite.suites?.length) {
      specs.push(...flattenSpecs(suite.suites, titlePath));
    }
  }

  return specs;
}

/**
 * Group flattened specs by their source file.
 */
function groupByFile(specs) {
  const groups = {};
  for (const spec of specs) {
    // Use file path or project name as grouping key
    const key = spec.file || 'unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push(spec);
  }
  return groups;
}

/**
 * Parse suite info from a file path like "smoke/login-and-dashboard.spec.ts"
 */
function parseSuiteInfo(filePath) {
  const parts = filePath.split('/');
  const projectType = parts[0]; // smoke, acceptance, break, auth
  const fileName = parts[parts.length - 1]?.replace('.spec.ts', '').replace('.ts', '') || 'unknown';

  // Build a readable suite name
  const suiteName = `E2E: ${projectType}/${fileName}`;
  const category = CATEGORY_MAP[projectType] || 'integration';
  const priority = PRIORITY_MAP[projectType] || 'medium';

  return { suiteName, category, priority };
}

/**
 * Map Playwright status to our test_results status enum.
 */
function mapStatus(pwStatus) {
  switch (pwStatus) {
    case 'expected': return 'passed';
    case 'passed': return 'passed';
    case 'unexpected': return 'failed';
    case 'failed': return 'failed';
    case 'skipped': return 'skipped';
    case 'timedOut': return 'failed';
    case 'interrupted': return 'error';
    default: return 'skipped';
  }
}

// ─── Run ────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

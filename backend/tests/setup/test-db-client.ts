/**
 * CRANIS2 Test Database Client
 *
 * Records test definitions and results in cranis2_test database.
 * Used by the test runner to persist results across sessions.
 */

import { getTestPool } from './test-helpers.js';

// ─── Suite Management ────────────────────────────────────────────────────

export async function ensureSuite(
  name: string,
  category: string,
  executor: 'claude_code' | 'claude_cowork',
  description?: string
): Promise<string> {
  const pool = getTestPool();

  // Upsert suite
  const result = await pool.query(
    `INSERT INTO test_suites (name, category, executor, description)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (name) DO UPDATE SET category = $2, executor = $3, description = $4
     RETURNING id`,
    [name, category, executor, description || null]
  );

  return result.rows[0].id;
}

export async function ensureTestCase(
  suiteId: string,
  name: string,
  opts: {
    description?: string;
    preconditions?: string;
    testSteps: string;
    expectedResult: string;
    priority?: 'critical' | 'high' | 'medium' | 'low';
    tags?: string[];
  }
): Promise<string> {
  const pool = getTestPool();

  const result = await pool.query(
    `INSERT INTO test_cases (suite_id, name, description, preconditions, test_steps, expected_result, priority, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (suite_id, name) DO UPDATE SET
       description = $3, preconditions = $4, test_steps = $5,
       expected_result = $6, priority = $7, tags = $8
     RETURNING id`,
    [
      suiteId, name, opts.description || null, opts.preconditions || null,
      opts.testSteps, opts.expectedResult,
      opts.priority || 'medium', opts.tags || null,
    ]
  );

  return result.rows[0].id;
}

// ─── Run Management ──────────────────────────────────────────────────────

export async function startTestRun(
  label: string,
  executor: 'claude_code' | 'claude_cowork'
): Promise<string> {
  const pool = getTestPool();

  const result = await pool.query(
    `INSERT INTO test_runs (run_label, executor)
     VALUES ($1, $2) RETURNING id`,
    [label, executor]
  );

  return result.rows[0].id;
}

export async function recordTestResult(
  runId: string,
  testCaseId: string,
  status: 'passed' | 'failed' | 'skipped' | 'error' | 'blocked',
  opts?: {
    durationMs?: number;
    actualResult?: string;
    errorMessage?: string;
    screenshotUrl?: string;
  }
): Promise<void> {
  const pool = getTestPool();

  await pool.query(
    `INSERT INTO test_results (run_id, test_case_id, status, duration_ms, actual_result, error_message, screenshot_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      runId, testCaseId, status,
      opts?.durationMs || null,
      opts?.actualResult || null,
      opts?.errorMessage || null,
      opts?.screenshotUrl || null,
    ]
  );
}

export async function completeTestRun(runId: string): Promise<void> {
  const pool = getTestPool();

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
}

// ─── Reporting ───────────────────────────────────────────────────────────

export async function getRunSummary(runId: string): Promise<{
  label: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: string;
}> {
  const pool = getTestPool();

  const result = await pool.query(
    `SELECT run_label, total_tests, passed, failed, skipped,
            completed_at - started_at as duration
     FROM test_runs WHERE id = $1`,
    [runId]
  );

  const row = result.rows[0];
  return {
    label: row.run_label,
    total: row.total_tests,
    passed: row.passed,
    failed: row.failed,
    skipped: row.skipped,
    duration: row.duration || 'in progress',
  };
}

export async function getFailedTests(runId: string): Promise<Array<{
  testName: string;
  suiteName: string;
  errorMessage: string;
  actualResult: string;
}>> {
  const pool = getTestPool();

  const result = await pool.query(
    `SELECT tc.name as test_name, ts.name as suite_name,
            tr.error_message, tr.actual_result
     FROM test_results tr
     JOIN test_cases tc ON tr.test_case_id = tc.id
     JOIN test_suites ts ON tc.suite_id = ts.id
     WHERE tr.run_id = $1 AND tr.status = 'failed'
     ORDER BY ts.name, tc.name`,
    [runId]
  );

  return result.rows.map(r => ({
    testName: r.test_name,
    suiteName: r.suite_name,
    errorMessage: r.error_message,
    actualResult: r.actual_result,
  }));
}

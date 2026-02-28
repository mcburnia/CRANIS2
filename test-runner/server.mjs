import express from 'express';
import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import path from 'path';
import pg from 'pg';

const app = express();
const PORT = 3004;
const MAX_OUTPUT_LINES = 500;
const MAX_RUN_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const TESTS_DIR = path.resolve('/app/tests');

// ─── Database pool (cranis2_test) ────────────────────────────────────────

const testPool = new pg.Pool({
  host: process.env.TEST_PG_HOST || 'postgres',
  port: parseInt(process.env.TEST_PG_PORT || '5432', 10),
  database: 'cranis2_test',
  user: process.env.TEST_PG_USER || 'cranis2',
  password: process.env.TEST_PG_PASSWORD || 'cranis2_dev_2026',
  max: 3,
});

// ─── In-memory state ─────────────────────────────────────────────────────

let state = {
  status: 'idle',       // idle | running | completed | failed
  startedAt: null,
  completedAt: null,
  output: [],
  exitCode: null,
  error: null,
  triggeredBy: '',
  summary: null,
};

let activeProcess = null;
let timeoutHandle = null;

// ─── Map vitest file path to suite name + category ───────────────────────

function parseTestFile(filePath) {
  // e.g. "/app/tests/routes/auth.test.ts" or "routes/auth.test.ts"
  const rel = filePath.replace(/^.*\/tests\//, '');
  const parts = rel.split('/');
  const dir = parts.length > 1 ? parts[0] : 'misc';
  const file = parts[parts.length - 1]
    .replace(/\.test\.ts$/, '')
    .replace(/\.test\.js$/, '');

  // Category from directory
  const categoryMap = {
    routes: 'route',
    security: 'security',
    break: 'break',
    webhooks: 'webhook',
    integration: 'integration',
    unit: 'unit',
    services: 'service',
  };
  const category = categoryMap[dir] || 'misc';

  // Suite name: "Route: Auth", "Security: JWT Manipulation", etc.
  const label = category.charAt(0).toUpperCase() + category.slice(1);
  const name = file
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  const suiteName = `${label}: ${name}`;

  return { suiteName, category };
}

// ─── Generate human-readable test description ────────────────────────────

function generateTestDescription(assertion, category) {
  const ancestors = assertion.ancestorTitles || [];
  const title = assertion.title || '';

  // Build context from ancestor titles (skip the top-level describe which is the file-level)
  const context = ancestors.slice(1).join(' > ');

  // Category labels
  const categoryDescriptions = {
    route: 'API endpoint test',
    security: 'Security validation test',
    break: 'Robustness/break test',
    webhook: 'Webhook integration test',
    integration: 'Integration test',
    unit: 'Unit test',
    service: 'Service test',
  };
  const categoryLabel = categoryDescriptions[category] || 'Test';

  // Parse the test title to build explanation
  let explanation = '';
  if (title.startsWith('should ')) {
    explanation = `Verifies that the system ${title.replace(/^should /, '')}.`;
  } else if (title.match(/^(GET|POST|PUT|DELETE|PATCH)\s/)) {
    explanation = `Tests the ${title.split(' ')[0]} request to ensure correct behaviour.`;
  } else {
    explanation = `${categoryLabel} that validates: ${title}.`;
  }

  // Build full description
  const parts = [];
  parts.push(`Category: ${categoryLabel}`);
  if (context) {
    parts.push(`Context: ${context}`);
  }
  parts.push(`What it tests: ${explanation}`);

  // Add NIS2/security relevance based on common patterns
  if (title.includes('401') || title.includes('unauthenticated') || title.includes('reject')) {
    parts.push('Why it matters: Ensures unauthorised access is blocked, supporting NIS2 Article 21(2)(e) access control requirements.');
  } else if (title.includes('403') || title.includes('forbidden') || title.includes('not own')) {
    parts.push('Why it matters: Validates proper authorisation boundaries between users/organisations.');
  } else if (title.includes('400') || title.includes('invalid') || title.includes('missing')) {
    parts.push('Why it matters: Confirms input validation prevents malformed or malicious data from being processed.');
  } else if (title.includes('SQL') || title.includes('XSS') || title.includes('injection') || title.includes('script')) {
    parts.push('Why it matters: Protects against injection attacks, a critical security requirement under NIS2 Article 21(2)(e).');
  } else if (title.includes('password') || title.includes('hash') || title.includes('bcrypt')) {
    parts.push('Why it matters: Ensures credentials are handled securely per NIS2 cryptographic requirements.');
  } else if (title.includes('rate') || title.includes('limit') || title.includes('brute')) {
    parts.push('Why it matters: Rate limiting protects against denial-of-service and brute-force attacks.');
  } else if (title.includes('webhook') || title.includes('signature') || title.includes('HMAC')) {
    parts.push('Why it matters: Validates webhook authenticity, ensuring only legitimate events are processed.');
  } else if (title.includes('200') || title.includes('returns') || title.includes('success')) {
    parts.push('Why it matters: Confirms the feature works correctly under normal operating conditions.');
  } else if (title.includes('overflow') || title.includes('too long') || title.includes('large') || title.includes('max')) {
    parts.push('Why it matters: Tests boundary conditions to prevent buffer overflows and resource exhaustion.');
  } else if (category === 'security') {
    parts.push('Why it matters: Security validation supporting NIS2 Article 21(2)(e) and (f) requirements.');
  } else if (category === 'break') {
    parts.push('Why it matters: Robustness testing ensures the system handles edge cases gracefully without crashing.');
  }

  return parts.join('\n');
}

function generateExpectedResult(assertion) {
  const title = assertion.title || '';
  if (title.startsWith('should ')) {
    return title.charAt(0).toUpperCase() + title.slice(1);
  }
  return `Test passes: ${title}`;
}

function generateTestSteps(assertion, category) {
  const ancestors = assertion.ancestorTitles || [];
  const title = assertion.title || '';
  const steps = [];

  // Step 1: Setup
  if (category === 'route' || category === 'security') {
    steps.push('1. Authenticate as the appropriate test user');
  } else if (category === 'webhook') {
    steps.push('1. Construct webhook payload with appropriate headers');
  } else if (category === 'break') {
    steps.push('1. Prepare malformed or edge-case input data');
  } else {
    steps.push('1. Set up test prerequisites');
  }

  // Step 2: Action
  const httpMatch = title.match(/(GET|POST|PUT|DELETE|PATCH)\s+(\/\S+)/);
  const ancestorHttp = ancestors.find(a => a.match(/(GET|POST|PUT|DELETE|PATCH)\s/));
  if (httpMatch) {
    steps.push(`2. Send ${httpMatch[1]} request to ${httpMatch[2]}`);
  } else if (ancestorHttp) {
    const m = ancestorHttp.match(/(GET|POST|PUT|DELETE|PATCH)\s+(\/\S+)/);
    if (m) steps.push(`2. Send ${m[1]} request to ${m[2]}`);
    else steps.push('2. Execute the test action');
  } else {
    steps.push('2. Execute the test action');
  }

  // Step 3: Assert
  const statusMatch = title.match(/(\d{3})/);
  if (statusMatch) {
    steps.push(`3. Verify response status is ${statusMatch[1]}`);
  } else if (title.includes('reject') || title.includes('block') || title.includes('prevent')) {
    steps.push('3. Verify the action is rejected');
  } else if (title.includes('return') || title.includes('include') || title.includes('contain')) {
    steps.push('3. Verify the response contains expected data');
  } else {
    steps.push('3. Verify expected outcome');
  }

  return steps.join('\n');
}

// ─── Record vitest results to cranis2_test database ──────────────────────

async function recordResultsToDatabase(vitestResults, startedAt, completedAt, triggeredBy) {
  const client = await testPool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create test_run
    const runRes = await client.query(
      `INSERT INTO test_runs (run_label, executor, started_at, completed_at, total_tests, passed, failed, skipped, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        'Automated test run',
        'test_runner',
        startedAt,
        completedAt,
        vitestResults.numTotalTests || 0,
        vitestResults.numPassedTests || 0,
        vitestResults.numFailedTests || 0,
        vitestResults.numPendingTests || 0,
        `Triggered by ${triggeredBy}`,
      ]
    );
    const runId = runRes.rows[0].id;

    let totalRecorded = 0;

    // 2. Process each test file
    for (const testFile of (vitestResults.testResults || [])) {
      const { suiteName, category } = parseTestFile(testFile.name);

      // Upsert suite
      const suiteRes = await client.query(
        `INSERT INTO test_suites (name, category, executor, description)
         VALUES ($1, $2, 'test_runner', $3)
         ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category
         RETURNING id`,
        [suiteName, category, `Automated: ${testFile.name.replace(/^.*\/tests\//, '')}`]
      );
      const suiteId = suiteRes.rows[0].id;

      // 3. Process each test case in this file
      for (const assertion of (testFile.assertionResults || [])) {
        const caseName = assertion.fullName || assertion.title || 'Unknown test';

        // Map vitest status to our schema
        let caseStatus;
        if (assertion.status === 'passed') caseStatus = 'passed';
        else if (assertion.status === 'failed') caseStatus = 'failed';
        else if (assertion.status === 'pending' || assertion.status === 'skipped' || assertion.status === 'todo') caseStatus = 'skipped';
        else caseStatus = 'error';

        // Generate description, steps, expected result
        const description = generateTestDescription(assertion, category);
        const testSteps = generateTestSteps(assertion, category);
        const expectedResult = generateExpectedResult(assertion);

        // Upsert test case
        const caseRes = await client.query(
          `INSERT INTO test_cases (suite_id, name, priority, description, test_steps, expected_result)
           VALUES ($1, $2, 'medium', $3, $4, $5)
           ON CONFLICT (suite_id, name) DO UPDATE SET
             description = EXCLUDED.description,
             test_steps = EXCLUDED.test_steps,
             expected_result = EXCLUDED.expected_result
           RETURNING id`,
          [suiteId, caseName.substring(0, 500), description, testSteps, expectedResult]
        );
        const caseId = caseRes.rows[0].id;

        // Error message from failure
        const errorMsg = (assertion.failureMessages && assertion.failureMessages.length > 0)
          ? assertion.failureMessages.join('\n').substring(0, 2000)
          : null;

        // Record result
        await client.query(
          `INSERT INTO test_results (run_id, test_case_id, status, duration_ms, error_message, executed_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [runId, caseId, caseStatus, assertion.duration != null ? Math.round(assertion.duration) : null, errorMsg, completedAt]
        );
        totalRecorded++;
      }
    }

    await client.query('COMMIT');
    console.log(`Recorded ${totalRecorded} test results to database (run: ${runId})`);
    return { runId, totalRecorded };

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to record test results to database:', err.message);
    return null;
  } finally {
    client.release();
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────

app.post('/run', (req, res) => {
  if (activeProcess) {
    return res.json({ status: 'already_running', startedAt: state.startedAt });
  }

  const triggeredBy = req.headers['x-triggered-by'] || 'admin';

  // Reset state
  state = {
    status: 'running',
    startedAt: new Date().toISOString(),
    completedAt: null,
    output: [],
    exitCode: null,
    error: null,
    triggeredBy,
    summary: null,
  };

  // Spawn vitest
  const child = spawn('npx', ['vitest', 'run', '--config', 'vitest.config.ts'], {
    cwd: TESTS_DIR,
    env: {
      ...process.env,
      NODE_OPTIONS: '--max-old-space-size=350',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  activeProcess = child;

  // Capture stdout
  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        state.output.push(line);
        if (state.output.length > MAX_OUTPUT_LINES) {
          state.output.shift();
        }
      }
    }
  });

  // Capture stderr
  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        state.output.push(line);
        if (state.output.length > MAX_OUTPUT_LINES) {
          state.output.shift();
        }
      }
    }
  });

  // Handle exit
  child.on('exit', async (code) => {
    activeProcess = null;
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }

    state.exitCode = code;
    state.completedAt = new Date().toISOString();
    state.status = code === 0 ? 'completed' : 'failed';

    // Parse vitest JSON output for summary + record to database
    try {
      const jsonPath = path.join(TESTS_DIR, 'test-results.json');
      const raw = await readFile(jsonPath, 'utf-8');
      const results = JSON.parse(raw);
      state.summary = {
        totalTests: results.numTotalTests || 0,
        passed: results.numPassedTests || 0,
        failed: results.numFailedTests || 0,
        duration: results.testResults
          ? results.testResults.reduce((sum, r) => sum + (r.endTime - r.startTime), 0)
          : 0,
      };

      // Record results to cranis2_test database
      await recordResultsToDatabase(results, state.startedAt, state.completedAt, state.triggeredBy);
    } catch (err) {
      console.error('Failed to parse/record test results:', err.message);
      state.summary = null;
    }

    console.log(`Test run finished: exit=${code}, status=${state.status}`);
  });

  // Handle spawn error
  child.on('error', (err) => {
    activeProcess = null;
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
    state.status = 'failed';
    state.error = err.message;
    state.completedAt = new Date().toISOString();
    console.error('Test spawn error:', err.message);
  });

  // Timeout guard
  timeoutHandle = setTimeout(() => {
    if (activeProcess) {
      console.log('Test run timed out after 10 minutes, killing process');
      activeProcess.kill('SIGTERM');
      state.error = 'Test run timed out after 10 minutes';
    }
  }, MAX_RUN_TIMEOUT_MS);

  res.json({ status: 'started' });
});

app.get('/status', (req, res) => {
  res.json({
    status: state.status,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    triggeredBy: state.triggeredBy,
    exitCode: state.exitCode,
    error: state.error,
    summary: state.summary,
    output: state.output.slice(-50),
    totalOutputLines: state.output.length,
  });
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// ─── Start ───────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Test runner listening on port ${PORT}`);
});

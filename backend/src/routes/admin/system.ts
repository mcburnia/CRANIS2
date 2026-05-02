/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import { Router, Request, Response } from 'express';
import { readFileSync } from 'fs';
import pool from '../../db/pool.js';
import { getTestPool } from '../../db/test-pool.js';
import { getDriver } from '../../db/neo4j.js';
import { requirePlatformAdmin } from '../../middleware/requirePlatformAdmin.js';
import { toISOString } from './utils.js';

const router = Router();

// GET /api/admin/system – System health metrics
router.get('/system', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    // Total events
    const eventsResult = await pool.query('SELECT COUNT(*) AS total FROM user_events');
    const totalEvents = parseInt(eventsResult.rows[0].total);

    // Events today
    const todayResult = await pool.query(
      "SELECT COUNT(*) AS cnt FROM user_events WHERE created_at > CURRENT_DATE"
    );
    const eventsToday = parseInt(todayResult.rows[0].cnt);

    // Scan stats (per-product scans)
    const scanStatsResult = await pool.query(`
      SELECT
        COUNT(*) AS total_scans,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_scans,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed_scans,
        COUNT(*) FILTER (WHERE created_at > CURRENT_DATE) AS scans_today,
        AVG(duration_seconds) FILTER (WHERE status = 'completed') AS avg_duration,
        AVG(osv_duration_ms) FILTER (WHERE status = 'completed') AS avg_osv_ms,
        AVG(github_duration_ms) FILTER (WHERE status = 'completed') AS avg_github_ms,
        AVG(nvd_duration_ms) FILTER (WHERE status = 'completed') AS avg_nvd_ms
      FROM vulnerability_scans
    `);

    // Avg local DB latency (from platform_scan_runs where the column lives)
    const localDbAvgResult = await pool.query(`
      SELECT AVG(local_db_duration_ms) FILTER (WHERE status = 'completed') AS avg_local_db_ms
      FROM platform_scan_runs
    `);
    const scanStats = scanStatsResult.rows[0];

    // Error rate
    const totalScans = parseInt(scanStats.total_scans) || 0;
    const failedScans = parseInt(scanStats.failed_scans) || 0;
    const errorRate = totalScans > 0 ? ((failedScans / totalScans) * 100).toFixed(1) : '0.0';

    // Recent scans with performance data (join platform_scan_runs for local DB fields)
    const recentScansResult = await pool.query(`
      SELECT vs.id, vs.product_id, vs.started_at, vs.completed_at, vs.status,
             vs.findings_count, vs.duration_seconds, vs.dependency_count,
             vs.osv_duration_ms, vs.osv_findings,
             vs.github_duration_ms, vs.github_findings,
             vs.nvd_duration_ms, vs.nvd_findings,
             psr.local_db_duration_ms, psr.local_db_findings,
             vs.triggered_by, vs.error_message
      FROM vulnerability_scans vs
      LEFT JOIN platform_scan_runs psr ON vs.platform_scan_run_id = psr.id
      ORDER BY vs.started_at DESC
      LIMIT 20
    `);

    // Get product names for recent scans
    const productIds = [...new Set(recentScansResult.rows.map((r: any) => r.product_id))];
    let productNameMap: Record<string, string> = {};
    if (productIds.length > 0) {
      const driver = getDriver();
      const session = driver.session();
      try {
        const prodResult = await session.run(
          'MATCH (p:Product) WHERE p.id IN $productIds RETURN p.id AS id, p.name AS name',
          { productIds }
        );
        for (const record of prodResult.records) {
          productNameMap[record.get('id')] = record.get('name');
        }
      } finally {
        await session.close();
      }
    }

    const recentScans = recentScansResult.rows.map((r: any) => ({
      id: r.id,
      productName: productNameMap[r.product_id] || r.product_id,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      status: r.status,
      findingsCount: r.findings_count,
      durationSeconds: r.duration_seconds ? parseFloat(r.duration_seconds) : null,
      dependencyCount: r.dependency_count,
      osvDurationMs: r.osv_duration_ms,
      osvFindings: r.osv_findings,
      githubDurationMs: r.github_duration_ms,
      githubFindings: r.github_findings,
      nvdDurationMs: r.nvd_duration_ms,
      nvdFindings: r.nvd_findings,
      localDbDurationMs: r.local_db_duration_ms,
      localDbFindings: r.local_db_findings,
      triggeredBy: r.triggered_by,
      errorMessage: r.error_message,
    }));

    // DB table row counts
    const tableCountsResult = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM user_events) AS events,
        (SELECT COUNT(*) FROM vulnerability_findings) AS findings,
        (SELECT COUNT(*) FROM vulnerability_scans) AS scans,
        (SELECT COUNT(*) FROM product_sboms) AS sboms,
        (SELECT COUNT(*) FROM technical_file_sections) AS tech_sections,
        (SELECT COUNT(*) FROM obligations) AS obligations,
        (SELECT COUNT(*) FROM stakeholders) AS stakeholders,
        (SELECT COUNT(*) FROM repo_connections) AS repo_connections,
        (SELECT COUNT(*) FROM sync_history) AS sync_records,
        (SELECT COUNT(*) FROM vuln_db_advisories) AS vuln_db_advisories,
        (SELECT COUNT(*) FROM vuln_db_nvd) AS vuln_db_nvd
    `);
    const tableCounts = tableCountsResult.rows[0];

    // Read CPU temperature
    let cpuTempC: number | null = null;
    try {
      const raw = readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf-8').trim();
      cpuTempC = Math.round(parseInt(raw) / 1000);
    } catch { /* not available */ }

    res.json({
      overview: {
        totalEvents: totalEvents,
        eventsToday: eventsToday,
        scansToday: parseInt(scanStats.scans_today) || 0,
        avgScanDuration: scanStats.avg_duration ? parseFloat(scanStats.avg_duration).toFixed(1) : null,
        errorRate: parseFloat(errorRate),
        cpuTemp: cpuTempC,
      },
      scanPerformance: {
        totalScans,
        completedScans: parseInt(scanStats.completed_scans) || 0,
        failedScans,
        avgOsvMs: scanStats.avg_osv_ms ? Math.round(parseFloat(scanStats.avg_osv_ms)) : null,
        avgGithubMs: scanStats.avg_github_ms ? Math.round(parseFloat(scanStats.avg_github_ms)) : null,
        avgNvdMs: scanStats.avg_nvd_ms ? Math.round(parseFloat(scanStats.avg_nvd_ms)) : null,
        avgLocalDbMs: localDbAvgResult.rows[0]?.avg_local_db_ms ? Math.round(parseFloat(localDbAvgResult.rows[0].avg_local_db_ms)) : null,
      },
      recentScans,
      tableCounts: Object.fromEntries(
        Object.entries(tableCounts).map(([k, v]) => [k, parseInt(v as string)])
      ),
    });

  } catch (err) {
    console.error('Admin system health error:', err);
    res.status(500).json({ error: 'Failed to fetch system health data' });
  }
});

// GET /api/admin/feedback – List all feedback submissions
router.get('/feedback', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM feedback';
    const params: any[] = [];
    let paramIdx = 1;

    if (status) {
      query += ' WHERE status = $' + paramIdx;
      params.push(status);
      paramIdx++;
    }

    query += ' ORDER BY created_at DESC LIMIT $' + paramIdx + ' OFFSET $' + (paramIdx + 1);
    params.push(limit, offset);

    const result = await pool.query(query, params);

    let countQuery = 'SELECT COUNT(*) AS total FROM feedback';
    const countParams: any[] = [];
    if (status) {
      countQuery += ' WHERE status = $1';
      countParams.push(status);
    }
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    // Summary counts
    const summaryResult = await pool.query(
      "SELECT status, COUNT(*) AS cnt FROM feedback GROUP BY status"
    );
    const summary: Record<string, number> = { new: 0, reviewed: 0, resolved: 0 };
    for (const row of summaryResult.rows) {
      summary[row.status] = parseInt(row.cnt);
    }

    res.json({
      feedback: result.rows,
      summary,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Failed to fetch feedback:', err);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// PUT /api/admin/feedback/:id – Update feedback status/notes
router.put('/feedback/:id', requirePlatformAdmin, async (req: Request, res: Response) => {
  const feedbackId = req.params.id as string;
  const { status, adminNotes } = req.body;

  if (status && !['new', 'reviewed', 'resolved'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  try {
    const updates: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let idx = 1;

    if (status) { updates.push('status = $' + idx); params.push(status); idx++; }
    if (adminNotes !== undefined) { updates.push('admin_notes = $' + idx); params.push(adminNotes); idx++; }

    params.push(feedbackId);
    const result = await pool.query(
      'UPDATE feedback SET ' + updates.join(', ') + ' WHERE id = $' + idx + ' RETURNING *',
      params
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Feedback not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to update feedback:', err);
    res.status(500).json({ error: 'Failed to update feedback' });
  }
});

// =====================================================================
// Test Results endpoints (queries cranis2_test database)
// =====================================================================

const SCHEDULE_INTERVAL_DAYS = 7;

// GET /api/admin/test-results – All suites with aggregated results
router.get('/test-results', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const testPool = getTestPool();

    // All suites with case counts
    const suitesResult = await testPool.query(`
      SELECT
        ts.id, ts.name, ts.category, ts.executor, ts.description, ts.created_at,
        COUNT(DISTINCT tc.id)::int AS total_cases
      FROM test_suites ts
      LEFT JOIN test_cases tc ON tc.suite_id = ts.id
      GROUP BY ts.id
      ORDER BY ts.category, ts.name
    `);

    // For each suite, get first run, last run, and last run's pass/fail counts
    const suiteIds = suitesResult.rows.map((s: any) => s.id);

    // Earliest and latest result timestamps per suite
    let runStatsMap: Record<string, { firstRunAt: string | null; lastRunAt: string | null; lastPassed: number; lastFailed: number }> = {};

    if (suiteIds.length > 0) {
      // First and last run dates
      const rangeResult = await testPool.query(`
        SELECT
          tc.suite_id,
          MIN(tr.executed_at) AS first_run_at,
          MAX(tr.executed_at) AS last_run_at
        FROM test_results tr
        JOIN test_cases tc ON tr.test_case_id = tc.id
        WHERE tc.suite_id = ANY($1)
        GROUP BY tc.suite_id
      `, [suiteIds]);

      for (const row of rangeResult.rows) {
        runStatsMap[row.suite_id] = {
          firstRunAt: row.first_run_at,
          lastRunAt: row.last_run_at,
          lastPassed: 0,
          lastFailed: 0,
        };
      }

      // For suites that have results, get the latest run's pass/fail
      // Using DISTINCT ON to get the most recent result per test case per suite
      const lastRunStatsResult = await testPool.query(`
        WITH latest_per_case AS (
          SELECT DISTINCT ON (tc.suite_id, tr.test_case_id)
            tc.suite_id,
            tr.status
          FROM test_results tr
          JOIN test_cases tc ON tr.test_case_id = tc.id
          WHERE tc.suite_id = ANY($1)
          ORDER BY tc.suite_id, tr.test_case_id, tr.executed_at DESC
        )
        SELECT
          suite_id,
          COUNT(*) FILTER (WHERE status = 'passed')::int AS passed,
          COUNT(*) FILTER (WHERE status IN ('failed', 'error'))::int AS failed
        FROM latest_per_case
        GROUP BY suite_id
      `, [suiteIds]);

      for (const row of lastRunStatsResult.rows) {
        if (runStatsMap[row.suite_id]) {
          runStatsMap[row.suite_id].lastPassed = row.passed;
          runStatsMap[row.suite_id].lastFailed = row.failed;
        }
      }
    }

    // Build suite list
    const suites = suitesResult.rows.map((s: any) => {
      const stats = runStatsMap[s.id];
      const totalCases = s.total_cases;
      const lastPassed = stats?.lastPassed ?? 0;
      const lastFailed = stats?.lastFailed ?? 0;
      const passRate = (lastPassed + lastFailed) > 0
        ? Math.round((lastPassed / (lastPassed + lastFailed)) * 100)
        : null;

      let status: string;
      if (!stats?.lastRunAt) status = 'never_run';
      else if (lastFailed === 0 && lastPassed > 0) status = 'passing';
      else if (lastPassed === 0 && lastFailed > 0) status = 'failing';
      else status = 'mixed';

      const nextDueAt = stats?.lastRunAt
        ? new Date(new Date(stats.lastRunAt).getTime() + SCHEDULE_INTERVAL_DAYS * 86400000).toISOString()
        : null;

      return {
        id: s.id,
        name: s.name,
        category: s.category,
        executor: s.executor,
        description: s.description,
        totalCases,
        firstRunAt: stats?.firstRunAt || null,
        lastRunAt: stats?.lastRunAt || null,
        lastPassed,
        lastFailed,
        passRate,
        status,
        nextDueAt,
      };
    });

    // Summary
    const totalSuites = suites.length;
    const totalCases = suites.reduce((sum: number, s: any) => sum + s.totalCases, 0);
    const totalPassed = suites.reduce((sum: number, s: any) => sum + s.lastPassed, 0);
    const totalFailed = suites.reduce((sum: number, s: any) => sum + s.lastFailed, 0);
    const overallPassRate = (totalPassed + totalFailed) > 0
      ? Math.round((totalPassed / (totalPassed + totalFailed)) * 100)
      : null;

    // Last run info
    const lastRunResult = await testPool.query(`
      SELECT run_label, started_at FROM test_runs ORDER BY started_at DESC LIMIT 1
    `);
    const lastRun = lastRunResult.rows[0];

    res.json({
      summary: {
        totalSuites,
        totalCases,
        totalPassed,
        totalFailed,
        passRate: overallPassRate,
        lastRunAt: lastRun?.started_at || null,
        lastRunLabel: lastRun?.run_label || null,
      },
      suites,
      scheduleIntervalDays: SCHEDULE_INTERVAL_DAYS,
    });

  } catch (err) {
    console.error('Admin test results error:', err);
    res.status(500).json({ error: 'Failed to fetch test results' });
  }
});

// POST /api/admin/test-results/run – Trigger a test run (proxies to test-runner service)
router.post('/test-results/run', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const adminEmail = (req as any).email || 'admin';
    const upstream = await fetch('http://test-runner:3004/run', {
      method: 'POST',
      headers: { 'X-Triggered-By': adminEmail },
    });
    const data = await upstream.json();
    res.json(data);
  } catch (err) {
    console.error('Admin test run trigger error:', err);
    res.status(502).json({ error: 'Test runner service unavailable' });
  }
});

// GET /api/admin/test-results/run-status – Poll test run status (proxies to test-runner service)
router.get('/test-results/run-status', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const upstream = await fetch('http://test-runner:3004/status');
    const data = await upstream.json();
    res.json(data);
  } catch (err) {
    console.error('Admin test run status error:', err);
    res.status(502).json({ error: 'Test runner service unavailable' });
  }
});

// GET /api/admin/test-results/:suiteId – Drill-down into suite's test cases
router.get('/test-results/:suiteId', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { suiteId } = req.params;
    const testPool = getTestPool();

    // Suite info
    const suiteResult = await testPool.query(
      'SELECT id, name, category, executor, description FROM test_suites WHERE id = $1',
      [suiteId as string]
    );
    if (suiteResult.rows.length === 0) {
      res.status(404).json({ error: 'Suite not found' });
      return;
    }

    // Test cases with latest result
    const casesResult = await testPool.query(`
      SELECT
        tc.id, tc.name, tc.priority, tc.tags, tc.description, tc.test_steps, tc.expected_result,
        latest.status AS last_status,
        latest.duration_ms AS last_duration_ms,
        latest.executed_at AS last_run_at,
        latest.error_message
      FROM test_cases tc
      LEFT JOIN LATERAL (
        SELECT tr.status, tr.duration_ms, tr.executed_at, tr.error_message
        FROM test_results tr
        WHERE tr.test_case_id = tc.id
        ORDER BY tr.executed_at DESC
        LIMIT 1
      ) latest ON true
      WHERE tc.suite_id = $1
      ORDER BY tc.priority DESC, tc.name
    `, [suiteId as string]);

    res.json({
      suite: suiteResult.rows[0],
      cases: casesResult.rows.map((c: any) => ({
        id: c.id,
        name: c.name,
        priority: c.priority,
        tags: c.tags,
        description: c.description,
        lastStatus: c.last_status || 'never_run',
        lastDurationMs: c.last_duration_ms,
        lastRunAt: c.last_run_at,
        errorMessage: c.error_message,
        testSteps: c.test_steps,
        expectedResult: c.expected_result,
      })),
    });

  } catch (err) {
    console.error('Admin test results suite detail error:', err);
    res.status(500).json({ error: 'Failed to fetch suite details' });
  }
});

// GET /api/admin/webhook-health – Webhook pipeline health status
router.get('/webhook-health', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const driver = getDriver();
    const session = driver.session();

    let records: any[] = [];
    try {
      const result = await session.run(
        `MATCH (p:Product)-[:BELONGS_TO]->(o:Organisation), (p)-[:HAS_REPO]->(r:Repository)
         RETURN p.id AS productId, p.name AS productName, o.name AS orgName,
                r.url AS repoUrl, r.webhookId AS webhookId,
                r.lastPush AS lastPush, r.provider AS provider`
      );
      records = result.records;
    } finally {
      await session.close();
    }

    if (records.length === 0) {
      return res.json({
        issues: [],
        summary: { totalProducts: 0, healthyProducts: 0, noWebhook: 0, webhookSilent: 0 },
      });
    }

    // Get most recent push event per product from Postgres
    const productIds = records.map((r: any) => r.get('productId'));
    const pushEventsResult = await pool.query(
      `SELECT product_id, MAX(created_at) AS last_event
       FROM repo_push_events
       WHERE product_id = ANY($1)
       GROUP BY product_id`,
      [productIds]
    );
    const lastEventMap = new Map<string, string>();
    for (const row of pushEventsResult.rows) {
      lastEventMap.set(row.product_id, row.last_event);
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const issues: any[] = [];
    let noWebhook = 0;
    let webhookSilent = 0;

    for (const record of records) {
      const productId = record.get('productId');
      const webhookId = record.get('webhookId');
      const lastPushRaw = record.get('lastPush');
      const lastPushStr = lastPushRaw ? (typeof lastPushRaw === 'string' ? lastPushRaw : toISOString(lastPushRaw)) : null;
      const lastEventStr = lastEventMap.get(productId) || null;

      if (!webhookId) {
        noWebhook++;
        issues.push({
          productId,
          productName: record.get('productName') || 'Unknown',
          orgName: record.get('orgName') || 'Unknown',
          repoUrl: record.get('repoUrl'),
          provider: record.get('provider') || 'unknown',
          issueType: 'no_webhook',
          webhookId: null,
          lastProviderPush: lastPushStr,
          lastWebhookEvent: lastEventStr,
        });
        continue;
      }

      // Check for silent webhook
      if (lastPushStr) {
        const lastPush = new Date(lastPushStr);
        if (lastPush > sevenDaysAgo) {
          const lastEvent = lastEventStr ? new Date(lastEventStr) : null;
          if (!lastEvent || lastEvent < lastPush) {
            webhookSilent++;
            issues.push({
              productId,
              productName: record.get('productName') || 'Unknown',
              orgName: record.get('orgName') || 'Unknown',
              repoUrl: record.get('repoUrl'),
              provider: record.get('provider') || 'unknown',
              issueType: 'webhook_silent',
              webhookId,
              lastProviderPush: lastPushStr,
              lastWebhookEvent: lastEventStr,
            });
          }
        }
      }
    }

    const healthyProducts = records.length - issues.length;

    res.json({
      issues,
      summary: {
        totalProducts: records.length,
        healthyProducts,
        noWebhook,
        webhookSilent,
      },
    });
  } catch (err) {
    console.error('Admin webhook health error:', err);
    res.status(500).json({ error: 'Failed to fetch webhook health' });
  }
});

export default router;

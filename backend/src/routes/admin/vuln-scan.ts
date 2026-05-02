/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

import { Router, Request, Response } from 'express';
import pool from '../../db/pool.js';
import { getDriver } from '../../db/neo4j.js';
import { requirePlatformAdmin } from '../../middleware/requirePlatformAdmin.js';
import { recordEvent, extractRequestData } from '../../services/telemetry.js';
import { runPlatformScan } from '../../services/vulnerability-scanner.js';
import { syncVulnDatabases, getVulnDbStats } from '../../services/vuln-db-sync.js';

const router = Router();

// POST /api/admin/vulnerability-scan
router.post('/vulnerability-scan', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const adminEmail = (req as any).email;
    const adminUserId = (req as any).userId;

    // Check no scan already running
    const running = await pool.query(
      "SELECT id FROM platform_scan_runs WHERE status = 'running'"
    );
    if (running.rows.length > 0) {
      res.json({ status: 'already_running', runId: running.rows[0].id });
      return;
    }

    // Record telemetry
    const reqData = extractRequestData(req);
    await recordEvent({
      userId: adminUserId,
      email: adminEmail,
      eventType: 'platform_vulnerability_scan_triggered',
      ...reqData,
      metadata: { triggerType: 'manual' },
    });

    // Start scan async, respond immediately
    runPlatformScan(adminEmail, 'manual').catch(err => {
      console.error('[ADMIN] Platform scan failed:', err);
    });

    // Small delay to let the record get created
    await new Promise(resolve => setTimeout(resolve, 200));

    const latestRunning = await pool.query(
      "SELECT id FROM platform_scan_runs WHERE status = 'running' ORDER BY started_at DESC LIMIT 1"
    );

    res.json({ status: 'started', runId: latestRunning.rows[0]?.id || null });
  } catch (err) {
    console.error('Admin vulnerability scan trigger error:', err);
    res.status(500).json({ error: 'Failed to trigger vulnerability scan' });
  }
});

// GET /api/admin/vulnerability-scan/status
router.get('/vulnerability-scan/status', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const runResult = await pool.query(
      'SELECT id, status, triggered_by, trigger_type, total_products, total_unique_dependencies, ' +
      'total_findings, critical_count, high_count, medium_count, low_count, new_findings_count, ' +
      'started_at, completed_at, duration_seconds, ' +
      'osv_duration_ms, osv_findings, github_duration_ms, github_findings, ' +
      'nvd_duration_ms, nvd_findings, local_db_duration_ms, local_db_findings, error_message ' +
      'FROM platform_scan_runs ORDER BY started_at DESC LIMIT 1'
    );

    if (runResult.rows.length === 0) {
      res.json({ run: null, products: [] });
      return;
    }

    const run = runResult.rows[0];

    const productsResult = await pool.query(
      'SELECT vs.product_id, vs.findings_count, vs.critical_count, vs.high_count, ' +
      'vs.medium_count, vs.low_count, vs.duration_seconds ' +
      'FROM vulnerability_scans vs ' +
      'WHERE vs.platform_scan_run_id = $1 ' +
      'ORDER BY vs.critical_count DESC, vs.high_count DESC, vs.findings_count DESC',
      [run.id]
    );

    const productIds = productsResult.rows.map((r: any) => r.product_id);
    let productNameMap: Record<string, string> = {};
    if (productIds.length > 0) {
      const driver = getDriver();
      const session = driver.session();
      try {
        const nameResult = await session.run(
          'MATCH (p:Product) WHERE p.id IN $productIds RETURN p.id AS id, p.name AS name',
          { productIds }
        );
        for (const record of nameResult.records) {
          productNameMap[record.get('id')] = record.get('name');
        }
      } finally {
        await session.close();
      }
    }

    res.json({
      run: {
        id: run.id,
        status: run.status,
        triggeredBy: run.triggered_by,
        triggerType: run.trigger_type,
        totalProducts: run.total_products,
        totalUniqueDependencies: run.total_unique_dependencies,
        totalFindings: run.total_findings,
        criticalCount: run.critical_count,
        highCount: run.high_count,
        mediumCount: run.medium_count,
        lowCount: run.low_count,
        newFindingsCount: run.new_findings_count,
        startedAt: run.started_at,
        completedAt: run.completed_at,
        durationSeconds: run.duration_seconds ? parseFloat(run.duration_seconds) : null,
        osvDurationMs: run.osv_duration_ms,
        osvFindings: run.osv_findings,
        githubDurationMs: run.github_duration_ms,
        githubFindings: run.github_findings,
        nvdDurationMs: run.nvd_duration_ms,
        nvdFindings: run.nvd_findings,
        localDbDurationMs: run.local_db_duration_ms,
        localDbFindings: run.local_db_findings,
        errorMessage: run.error_message,
      },
      products: productsResult.rows.map((r: any) => ({
        productId: r.product_id,
        productName: productNameMap[r.product_id] || r.product_id,
        findingsCount: r.findings_count,
        criticalCount: r.critical_count,
        highCount: r.high_count,
        mediumCount: r.medium_count,
        lowCount: r.low_count,
        durationSeconds: r.duration_seconds ? parseFloat(r.duration_seconds) : null,
      })),
    });
  } catch (err) {
    console.error('Admin vulnerability scan status error:', err);
    res.status(500).json({ error: 'Failed to fetch vulnerability scan status' });
  }
});

// GET /api/admin/vulnerability-scan/history
router.get('/vulnerability-scan/history', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) AS total FROM platform_scan_runs');
    const total = parseInt(countResult.rows[0].total);

    const runsResult = await pool.query(
      'SELECT id, status, triggered_by, trigger_type, total_products, total_unique_dependencies, ' +
      'total_findings, critical_count, high_count, medium_count, low_count, new_findings_count, ' +
      'started_at, completed_at, duration_seconds, ' +
      'osv_duration_ms, osv_findings, github_duration_ms, github_findings, ' +
      'nvd_duration_ms, nvd_findings, local_db_duration_ms, local_db_findings, error_message ' +
      'FROM platform_scan_runs ORDER BY started_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    res.json({
      runs: runsResult.rows.map((row: any) => ({
        id: row.id,
        status: row.status,
        triggeredBy: row.triggered_by,
        triggerType: row.trigger_type,
        totalProducts: row.total_products,
        totalUniqueDependencies: row.total_unique_dependencies,
        totalFindings: row.total_findings,
        criticalCount: row.critical_count,
        highCount: row.high_count,
        mediumCount: row.medium_count,
        lowCount: row.low_count,
        newFindingsCount: row.new_findings_count,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        durationSeconds: row.duration_seconds ? parseFloat(row.duration_seconds) : null,
        osvDurationMs: row.osv_duration_ms,
        osvFindings: row.osv_findings,
        githubDurationMs: row.github_duration_ms,
        githubFindings: row.github_findings,
        nvdDurationMs: row.nvd_duration_ms,
        nvdFindings: row.nvd_findings,
        localDbDurationMs: row.local_db_duration_ms,
        localDbFindings: row.local_db_findings,
        errorMessage: row.error_message,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Admin vulnerability scan history error:', err);
    res.status(500).json({ error: 'Failed to fetch vulnerability scan history' });
  }
});


// POST /api/admin/vulnerability-db/sync – trigger manual vulnerability database sync
router.post('/vulnerability-db/sync', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    // Run async – don't block the response
    syncVulnDatabases().catch(err => {
      console.error('Manual vuln DB sync failed:', err);
    });
    res.json({ message: 'Vulnerability database sync started' });
  } catch (err) {
    console.error('Admin vuln DB sync trigger error:', err);
    res.status(500).json({ error: 'Failed to trigger vulnerability database sync' });
  }
});

// GET /api/admin/vulnerability-db/status – get sync status per ecosystem
router.get('/vulnerability-db/status', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await getVulnDbStats();
    res.json(stats);
  } catch (err) {
    console.error('Admin vuln DB status error:', err);
    res.status(500).json({ error: 'Failed to fetch vulnerability database status' });
  }
});

export default router;

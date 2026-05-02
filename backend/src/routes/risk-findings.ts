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
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';
import { runProductScan } from '../services/vulnerability-scanner.js';

const router = Router();

async function requireAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) { res.status(401).json({ error: 'No token provided' }); return; }
  const token = authHeader.split(' ')[1];
  try {
    const payload = verifySessionToken(token);
    if (!payload) { res.status(401).json({ error: 'Invalid token' }); return; }
    (req as any).userId = payload.userId;
    (req as any).email = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

async function getOrgId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.org_id || null;
}

// GET /api/risk-findings/overview – Cross-product vulnerability overview
router.get('/overview', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    // Get products from Neo4j
    const driver = getDriver();
    const session = driver.session();
    let products: { id: string; name: string; craCategory: string | null }[] = [];
    try {
      const result = await session.run(
        'MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product) ' +
        'RETURN p.id AS id, p.name AS name, p.craCategory AS craCategory ' +
        'ORDER BY p.name',
        { orgId }
      );
      products = result.records.map(r => ({
        id: r.get('id'),
        name: r.get('name'),
        craCategory: r.get('craCategory') || null,
      }));
    } finally {
      await session.close();
    }

    if (products.length === 0) {
      res.json({ products: [], totals: { totalFindings: 0, critical: 0, high: 0, medium: 0, low: 0, openFindings: 0 } });
      return;
    }

    const productIds = products.map(p => p.id);

    // Get latest scan per product
    const scansResult = await pool.query(
      'SELECT DISTINCT ON (product_id) id, product_id, status, completed_at, findings_count, ' +
      'critical_count, high_count, medium_count, low_count ' +
      'FROM vulnerability_scans ' +
      'WHERE product_id = ANY($1) AND org_id = $2 ' +
      'ORDER BY product_id, started_at DESC',
      [productIds, orgId]
    );
    const scanMap = new Map(scansResult.rows.map(r => [r.product_id, r]));

    // Get finding counts by status per product
    const findingsResult = await pool.query(
      'SELECT product_id, severity, status, count(*) as cnt ' +
      'FROM vulnerability_findings ' +
      'WHERE product_id = ANY($1) AND org_id = $2 ' +
      'GROUP BY product_id, severity, status',
      [productIds, orgId]
    );

    const findingsMap = new Map<string, any>();
    for (const row of findingsResult.rows) {
      if (!findingsMap.has(row.product_id)) {
        findingsMap.set(row.product_id, { critical: 0, high: 0, medium: 0, low: 0, total: 0, open: 0, dismissed: 0, acknowledged: 0, mitigated: 0, resolved: 0, openCritical: 0, openHigh: 0, openMedium: 0, openLow: 0 });
      }
      const pf = findingsMap.get(row.product_id);
      const count = parseInt(row.cnt);
      pf[row.severity] = (pf[row.severity] || 0) + count;
      pf.total += count;
      if (row.status === 'open') pf.open += count;
      else if (row.status === 'dismissed') pf.dismissed += count;
      else if (row.status === 'acknowledged') pf.acknowledged += count;
      else if (row.status === 'mitigated') pf.mitigated += count;
      else if (row.status === 'resolved' || row.status === 'auto_resolved') pf.resolved += count;
      // Track open-only severity for stat cards
      if (row.status === 'open' || row.status === 'acknowledged') {
        if (row.severity === 'critical') pf.openCritical += count;
        if (row.severity === 'high') pf.openHigh += count;
        if (row.severity === 'medium') pf.openMedium += count;
        if (row.severity === 'low') pf.openLow += count;
      }
    }

    // Build response
    let totalCritical = 0, totalHigh = 0, totalMedium = 0, totalLow = 0, totalOpen = 0, totalAll = 0;
    let openCritical = 0, openHigh = 0, openMedium = 0, openLow = 0;

    const enrichedProducts = products.map(p => {
      const scan = scanMap.get(p.id);
      const findings = findingsMap.get(p.id) || { critical: 0, high: 0, medium: 0, low: 0, total: 0, open: 0, dismissed: 0, acknowledged: 0, mitigated: 0, resolved: 0, openCritical: 0, openHigh: 0, openMedium: 0, openLow: 0 };

      totalCritical += findings.critical;
      totalHigh += findings.high;
      totalMedium += findings.medium;
      totalLow += findings.low;
      totalOpen += findings.open;
      totalAll += findings.total;
      openCritical += findings.openCritical;
      openHigh += findings.openHigh;
      openMedium += findings.openMedium;
      openLow += findings.openLow;

      return {
        id: p.id,
        name: p.name,
        craCategory: p.craCategory,
        lastScan: scan ? {
          id: scan.id,
          status: scan.status,
          completedAt: scan.completed_at,
          findingsCount: scan.findings_count,
        } : null,
        findings,
      };
    });

    res.json({
      products: enrichedProducts,
      totals: {
        totalFindings: totalAll,
        critical: totalCritical,
        high: totalHigh,
        medium: totalMedium,
        low: totalLow,
        openFindings: totalOpen,
        openCritical,
        openHigh,
        openMedium,
        openLow,
      },
    });
  } catch (err) {
    console.error('Failed to fetch risk findings overview:', err);
    res.status(500).json({ error: 'Failed to fetch risk findings overview' });
  }
});

// GET /api/risk-findings/platform-scan/latest – Latest platform-wide scan info
router.get('/platform-scan/latest', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, status, triggered_by, trigger_type, total_products, total_unique_dependencies, ' +
      'total_findings, critical_count, high_count, medium_count, low_count, new_findings_count, ' +
      'started_at, completed_at, duration_seconds, ' +
      'osv_duration_ms, osv_findings, github_duration_ms, github_findings, ' +
      'nvd_duration_ms, nvd_findings, error_message ' +
      'FROM platform_scan_runs ORDER BY started_at DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      res.json({ latestScan: null });
      return;
    }

    const row = result.rows[0];
    res.json({
      latestScan: {
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
        errorMessage: row.error_message,
      },
    });
  } catch (err) {
    console.error('Failed to fetch latest platform scan:', err);
    res.status(500).json({ error: 'Failed to fetch latest platform scan' });
  }
});

// GET /api/risk-findings/scan/:scanId – Poll scan status
router.get('/scan/:scanId', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const scanId = req.params.scanId as string;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const result = await pool.query(
      'SELECT id, product_id, status, started_at, completed_at, findings_count, ' +
      'critical_count, high_count, medium_count, low_count, error_message, ' +
      'duration_seconds, dependency_count, osv_duration_ms, osv_findings, ' +
      'github_duration_ms, github_findings, nvd_duration_ms, nvd_findings, ' +
      'triggered_by ' +
      'FROM vulnerability_scans ' +
      'WHERE id = $1 AND org_id = $2',
      [scanId, orgId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Scan not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to get scan status:', err);
    res.status(500).json({ error: 'Failed to get scan status' });
  }
});

// GET /api/risk-findings/:productId – Per-product findings list
router.get('/:productId', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const productId = req.params.productId as string;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    // Verify product belongs to org
    const driver = getDriver();
    const session = driver.session();
    try {
      const check = await session.run(
        'MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId}) ' +
        'RETURN p.id',
        { orgId, productId }
      );
      if (check.records.length === 0) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
    } finally {
      await session.close();
    }

    // Get query params for filtering
    const severity = req.query.severity as string | undefined;
    const status = req.query.status as string | undefined;

    let query = 'SELECT * FROM vulnerability_findings WHERE product_id = $1 AND org_id = $2';
    const params: any[] = [productId, orgId];
    let paramIdx = 3;

    if (severity) {
      query += ' AND severity = $' + paramIdx;
      params.push(severity);
      paramIdx++;
    }
    if (status) {
      query += ' AND status = $' + paramIdx;
      params.push(status);
      paramIdx++;
    }

    query += " ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END, created_at DESC";

    const result = await pool.query(query, params);

    // Get latest scan
    const scanResult = await pool.query(
      'SELECT id, status, started_at, completed_at, findings_count ' +
      'FROM vulnerability_scans ' +
      'WHERE product_id = $1 AND org_id = $2 ' +
      'ORDER BY started_at DESC LIMIT 1',
      [productId, orgId]
    );

    // Summary counts – FR-1: include all 5 statuses
    const summary = { critical: 0, high: 0, medium: 0, low: 0, total: 0, open: 0, dismissed: 0, acknowledged: 0, mitigated: 0, resolved: 0 };
    for (const row of result.rows) {
      summary[row.severity as keyof typeof summary] = (summary[row.severity as keyof typeof summary] || 0) + 1;
      summary.total++;
      if (row.status === 'open') summary.open++;
      else if (row.status === 'dismissed') summary.dismissed++;
      else if (row.status === 'acknowledged') summary.acknowledged++;
      else if (row.status === 'mitigated') summary.mitigated++;
      else if (row.status === 'resolved' || row.status === 'auto_resolved') summary.resolved++;
    }

    // Normalise auto_resolved → resolved on the wire. The DB keeps the
    // audit distinction (resolved_by IS NULL on auto_resolved rows), but
    // the UI treats both as "resolved" for display + counting.
    const findings = result.rows.map(r => r.status === 'auto_resolved' ? { ...r, status: 'resolved' } : r);

    res.json({
      findings,
      lastScan: scanResult.rows[0] || null,
      summary,
    });
  } catch (err) {
    console.error('Failed to fetch risk findings:', err);
    res.status(500).json({ error: 'Failed to fetch risk findings' });
  }
});

// GET /api/risk-findings/:productId/scan-history – Scan performance history
router.get('/:productId/scan-history', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const productId = req.params.productId as string;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const result = await pool.query(
      'SELECT id, status, started_at, completed_at, findings_count, ' +
      'critical_count, high_count, medium_count, low_count, ' +
      'duration_seconds, dependency_count, ' +
      'osv_duration_ms, osv_findings, ' +
      'github_duration_ms, github_findings, ' +
      'nvd_duration_ms, nvd_findings, ' +
      'triggered_by, error_message, source ' +
      'FROM vulnerability_scans ' +
      'WHERE product_id = $1 AND org_id = $2 ' +
      'ORDER BY started_at DESC ' +
      'LIMIT 50',
      [productId, orgId]
    );

    const stats = await pool.query(
      'SELECT ' +
      'COUNT(*) as total_scans, ' +
      'ROUND(AVG(duration_seconds)::numeric, 2) as avg_duration, ' +
      'ROUND(MIN(duration_seconds)::numeric, 2) as min_duration, ' +
      'ROUND(MAX(duration_seconds)::numeric, 2) as max_duration, ' +
      'ROUND(AVG(osv_duration_ms)::numeric, 0) as avg_osv_ms, ' +
      'ROUND(AVG(github_duration_ms)::numeric, 0) as avg_github_ms, ' +
      'ROUND(AVG(nvd_duration_ms)::numeric, 0) as avg_nvd_ms, ' +
      'ROUND(AVG(dependency_count)::numeric, 0) as avg_deps, ' +
      "COUNT(*) FILTER (WHERE status = 'failed') as error_count " +
      'FROM vulnerability_scans ' +
      'WHERE product_id = $1 AND org_id = $2 AND duration_seconds IS NOT NULL',
      [productId, orgId]
    );

    res.json({
      history: result.rows.map((row: any) => ({
        id: row.id,
        status: row.status,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        durationSeconds: row.duration_seconds ? parseFloat(row.duration_seconds) : null,
        dependencyCount: row.dependency_count,
        findingsCount: row.findings_count,
        criticalCount: row.critical_count,
        highCount: row.high_count,
        mediumCount: row.medium_count,
        lowCount: row.low_count,
        osvDurationMs: row.osv_duration_ms,
        osvFindings: row.osv_findings,
        githubDurationMs: row.github_duration_ms,
        githubFindings: row.github_findings,
        nvdDurationMs: row.nvd_duration_ms,
        nvdFindings: row.nvd_findings,
        triggeredBy: row.triggered_by,
        errorMessage: row.error_message,
        source: row.source,
      })),
      stats: stats.rows[0] ? {
        totalScans: parseInt(stats.rows[0].total_scans),
        avgDuration: parseFloat(stats.rows[0].avg_duration) || 0,
        minDuration: parseFloat(stats.rows[0].min_duration) || 0,
        maxDuration: parseFloat(stats.rows[0].max_duration) || 0,
        avgOsvMs: parseInt(stats.rows[0].avg_osv_ms) || 0,
        avgGithubMs: parseInt(stats.rows[0].avg_github_ms) || 0,
        avgNvdMs: parseInt(stats.rows[0].avg_nvd_ms) || 0,
        avgDeps: parseInt(stats.rows[0].avg_deps) || 0,
        errorCount: parseInt(stats.rows[0].error_count),
      } : null,
    });
  } catch (err) {
    console.error('Failed to fetch scan history:', err);
    res.status(500).json({ error: 'Failed to fetch scan history' });
  }
});

// POST /api/risk-findings/:productId/scan – Trigger per-product vulnerability scan (FR-2)
router.post('/:productId/scan', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const email = (req as any).email;
  const productId = req.params.productId as string;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    // Verify product belongs to org
    const driver = getDriver();
    const session = driver.session();
    try {
      const check = await session.run(
        'MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId}) RETURN p.id',
        { orgId, productId }
      );
      if (check.records.length === 0) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
    } finally {
      await session.close();
    }

    // Reject if a scan is already running for this product
    const running = await pool.query(
      "SELECT id FROM vulnerability_scans WHERE product_id = $1 AND status = 'running' LIMIT 1",
      [productId]
    );
    if (running.rows.length > 0) {
      res.status(409).json({ error: 'A scan is already running for this product', scanId: running.rows[0].id });
      return;
    }

    // Run scan
    const scanPromise = runProductScan(productId, orgId, email);

    // Wait briefly to get the scanId from the initial INSERT
    const result = await scanPromise;

    // Record telemetry
    const reqData = extractRequestData(req);
    await recordEvent({
      userId,
      email,
      eventType: 'product_vulnerability_scan_triggered',
      ...reqData,
      metadata: { productId, scanId: result.scanId, totalFindings: result.totalFindings },
    });

    res.json({ scanId: result.scanId, totalFindings: result.totalFindings });
  } catch (err) {
    console.error('Failed to trigger product scan:', err);
    res.status(500).json({ error: 'Failed to trigger vulnerability scan' });
  }
});

// POST /api/risk-findings/:productId/batch-triage – Batch triage decisions from wizard
// Accepts an array of { findingId, action, reason? } and applies them in one pass.
// Valid actions: dismiss, acknowledge, mitigate, resolve, skip (no-op).
router.post('/:productId/batch-triage', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const email = (req as any).email;
  const productId = req.params.productId as string;
  const { decisions } = req.body || {};

  if (!Array.isArray(decisions) || decisions.length === 0) {
    res.status(400).json({ error: 'decisions array is required' });
    return;
  }

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    // Verify product belongs to org
    const driver = getDriver();
    const session = driver.session();
    try {
      const check = await session.run(
        'MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId}) RETURN p.id',
        { orgId, productId }
      );
      if (check.records.length === 0) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
    } finally {
      await session.close();
    }

    const validActions = ['dismiss', 'acknowledge', 'mitigate', 'resolve', 'skip'];
    const results: { findingId: string; action: string; applied: boolean }[] = [];
    let applied = 0;
    let skipped = 0;

    for (const dec of decisions) {
      const { findingId, action, reason } = dec;

      if (!findingId || !action || !validActions.includes(action)) {
        results.push({ findingId: findingId || 'unknown', action: action || 'invalid', applied: false });
        skipped++;
        continue;
      }

      if (action === 'skip') {
        results.push({ findingId, action: 'skip', applied: false });
        skipped++;
        continue;
      }

      // Map wizard actions to finding statuses
      const statusMap: Record<string, string> = {
        dismiss: 'dismissed',
        acknowledge: 'acknowledged',
        mitigate: 'mitigated',
        resolve: 'resolved',
      };
      const newStatus = statusMap[action];

      let query: string;
      let params: any[];

      if (newStatus === 'dismissed') {
        query = 'UPDATE vulnerability_findings SET status = $1, dismissed_by = $2, dismissed_at = NOW(), dismissed_reason = $3, updated_at = NOW() WHERE id = $4 AND org_id = $5 AND product_id = $6 RETURNING id';
        params = [newStatus, email, reason || 'Batch triage wizard', findingId, orgId, productId];
      } else if (newStatus === 'acknowledged') {
        query = 'UPDATE vulnerability_findings SET status = $1, dismissed_by = $2, dismissed_at = NOW(), updated_at = NOW() WHERE id = $3 AND org_id = $4 AND product_id = $5 RETURNING id';
        params = [newStatus, email, findingId, orgId, productId];
      } else if (newStatus === 'mitigated') {
        query = 'UPDATE vulnerability_findings SET status = $1, mitigation_notes = $2, dismissed_by = $3, updated_at = NOW() WHERE id = $4 AND org_id = $5 AND product_id = $6 RETURNING id';
        params = [newStatus, reason || null, email, findingId, orgId, productId];
      } else if (newStatus === 'resolved') {
        query = 'UPDATE vulnerability_findings SET status = $1, resolved_at = NOW(), resolved_by = $2, updated_at = NOW() WHERE id = $3 AND org_id = $4 AND product_id = $5 RETURNING id';
        params = [newStatus, email, findingId, orgId, productId];
      } else {
        results.push({ findingId, action, applied: false });
        skipped++;
        continue;
      }

      const result = await pool.query(query, params);
      if (result.rows.length > 0) {
        results.push({ findingId, action, applied: true });
        applied++;
      } else {
        results.push({ findingId, action, applied: false });
        skipped++;
      }
    }

    // Telemetry
    const reqData = extractRequestData(req);
    recordEvent({
      userId, email,
      eventType: 'batch_triage_completed',
      ...reqData,
      metadata: { productId, applied, skipped, total: decisions.length },
    }).catch(() => {});

    res.json({
      results,
      summary: { applied, skipped, total: decisions.length },
    });
  } catch (err) {
    console.error('Failed to batch triage findings:', err);
    res.status(500).json({ error: 'Failed to apply batch triage decisions' });
  }
});

// PUT /api/risk-findings/:findingId – Update finding status (FR-1: full triage workflow)
router.put('/:findingId', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const email = (req as any).email;
  const findingId = req.params.findingId as string;
  const { status, reason, mitigationNotes } = req.body;

  // FR-1: Full triage – open, acknowledged, mitigated, resolved, dismissed
  const validStatuses = ['open', 'dismissed', 'acknowledged', 'mitigated', 'resolved'];
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid status. Must be: ' + validStatuses.join(', ') });
    return;
  }

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    // Build dynamic update based on status
    let query: string;
    let params: any[];

    if (status === 'open') {
      // Re-open: clear all triage fields
      query = 'UPDATE vulnerability_findings SET status = $1, dismissed_by = NULL, dismissed_at = NULL, dismissed_reason = NULL, mitigation_notes = NULL, resolved_at = NULL, resolved_by = NULL, updated_at = NOW() WHERE id = $2 AND org_id = $3 RETURNING *';
      params = [status, findingId, orgId];
    } else if (status === 'dismissed') {
      query = 'UPDATE vulnerability_findings SET status = $1, dismissed_by = $2, dismissed_at = NOW(), dismissed_reason = $3, updated_at = NOW() WHERE id = $4 AND org_id = $5 RETURNING *';
      params = [status, email, reason || null, findingId, orgId];
    } else if (status === 'acknowledged') {
      query = 'UPDATE vulnerability_findings SET status = $1, dismissed_by = $2, dismissed_at = NOW(), updated_at = NOW() WHERE id = $3 AND org_id = $4 RETURNING *';
      params = [status, email, findingId, orgId];
    } else if (status === 'mitigated') {
      // FR-4: Save mitigation notes
      query = 'UPDATE vulnerability_findings SET status = $1, mitigation_notes = $2, dismissed_by = $3, updated_at = NOW() WHERE id = $4 AND org_id = $5 RETURNING *';
      params = [status, mitigationNotes || null, email, findingId, orgId];
    } else if (status === 'resolved') {
      query = 'UPDATE vulnerability_findings SET status = $1, resolved_at = NOW(), resolved_by = $2, updated_at = NOW() WHERE id = $3 AND org_id = $4 RETURNING *';
      params = [status, email, findingId, orgId];
    } else {
      res.status(400).json({ error: 'Unexpected status' }); return;
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Finding not found' });
      return;
    }

    // Record telemetry
    const reqData = extractRequestData(req);
    await recordEvent({
      userId,
      email,
      eventType: 'vulnerability_finding_updated',
      ...reqData,
      metadata: { findingId, status, reason, mitigationNotes },
    });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to update finding:', err);
    res.status(500).json({ error: 'Failed to update finding' });
  }
});

export default router;

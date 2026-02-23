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

// GET /api/risk-findings/overview — Cross-product vulnerability overview
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
        findingsMap.set(row.product_id, { critical: 0, high: 0, medium: 0, low: 0, total: 0, open: 0, dismissed: 0, acknowledged: 0 });
      }
      const pf = findingsMap.get(row.product_id);
      const count = parseInt(row.cnt);
      pf[row.severity] = (pf[row.severity] || 0) + count;
      pf.total += count;
      if (row.status === 'open') pf.open += count;
      else if (row.status === 'dismissed') pf.dismissed += count;
      else if (row.status === 'acknowledged') pf.acknowledged += count;
    }

    // Build response
    let totalCritical = 0, totalHigh = 0, totalMedium = 0, totalLow = 0, totalOpen = 0, totalAll = 0;

    const enrichedProducts = products.map(p => {
      const scan = scanMap.get(p.id);
      const findings = findingsMap.get(p.id) || { critical: 0, high: 0, medium: 0, low: 0, total: 0, open: 0, dismissed: 0, acknowledged: 0 };

      totalCritical += findings.critical;
      totalHigh += findings.high;
      totalMedium += findings.medium;
      totalLow += findings.low;
      totalOpen += findings.open;
      totalAll += findings.total;

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
      },
    });
  } catch (err) {
    console.error('Failed to fetch risk findings overview:', err);
    res.status(500).json({ error: 'Failed to fetch risk findings overview' });
  }
});

// GET /api/risk-findings/platform-scan/latest — Latest platform-wide scan info
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

// GET /api/risk-findings/scan/:scanId — Poll scan status
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

// GET /api/risk-findings/:productId — Per-product findings list
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

    // Summary counts
    const summary = { critical: 0, high: 0, medium: 0, low: 0, total: 0, open: 0, dismissed: 0 };
    for (const row of result.rows) {
      summary[row.severity as keyof typeof summary] = (summary[row.severity as keyof typeof summary] || 0) + 1;
      summary.total++;
      if (row.status === 'open') summary.open++;
      if (row.status === 'dismissed') summary.dismissed++;
    }

    res.json({
      findings: result.rows,
      lastScan: scanResult.rows[0] || null,
      summary,
    });
  } catch (err) {
    console.error('Failed to fetch risk findings:', err);
    res.status(500).json({ error: 'Failed to fetch risk findings' });
  }
});

// GET /api/risk-findings/:productId/scan-history — Scan performance history
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

// POST /api/risk-findings/:productId/scan — Trigger per-product vulnerability scan
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

// PUT /api/risk-findings/:findingId — Dismiss/acknowledge a finding
router.put('/:findingId', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const findingId = req.params.findingId as string;
  const { status, reason } = req.body;

  if (!status || !['open', 'dismissed', 'acknowledged'].includes(status)) {
    res.status(400).json({ error: 'Invalid status. Must be: open, dismissed, acknowledged' });
    return;
  }

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const result = await pool.query(
      'UPDATE vulnerability_findings ' +
      "SET status = $1, dismissed_by = $2, dismissed_at = CASE WHEN $1 = 'dismissed' THEN NOW() ELSE NULL END, " +
      'dismissed_reason = $3, updated_at = NOW() ' +
      'WHERE id = $4 AND org_id = $5 ' +
      'RETURNING *',
      [status, status === 'open' ? null : (req as any).email, reason || null, findingId, orgId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Finding not found' });
      return;
    }

    // Record telemetry
    const reqData = extractRequestData(req);
    await recordEvent({
      userId,
      email: (req as any).email,
      eventType: 'vulnerability_finding_updated',
      ...reqData,
      metadata: { findingId, status, reason },
    });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to update finding:', err);
    res.status(500).json({ error: 'Failed to update finding' });
  }
});

export default router;

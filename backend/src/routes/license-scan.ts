import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { verifySessionToken } from '../utils/token.js';
import { scanProductLicenses, classifyLicense } from '../services/license-scanner.js';
import neo4j from 'neo4j-driver';

const router = Router();

const neo4jDriver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://neo4j:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'cranis2_dev_2026'
  )
);

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
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

async function getOrgId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.org_id || null;
}

// GET /overview — cross-product license compliance summary
router.get('/overview', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(400).json({ error: 'No organisation' }); return; }

    // Get all products for this org from Neo4j
    const session = neo4jDriver.session({ defaultAccessMode: neo4j.session.READ });
    let products: Array<{ id: string; name: string }> = [];
    try {
      const result = await session.run(
        `MATCH (p:Product)-[:BELONGS_TO]->(o:Organisation {id: $orgId}) RETURN p.id AS id, p.name AS name`,
        { orgId }
      );
      products = result.records.map(r => ({ id: r.get('id'), name: r.get('name') }));
    } finally {
      await session.close();
    }

    // Get latest scan per product (now includes direct_count and transitive_count)
    const productIds = products.map(p => p.id);
    const scansResult = await pool.query(
      `SELECT DISTINCT ON (product_id)
         product_id, id AS scan_id, total_deps, permissive_count, copyleft_count,
         unknown_count, critical_count, direct_count, transitive_count,
         completed_at, status
       FROM license_scans
       WHERE org_id = $1 AND status = 'completed'
       ORDER BY product_id, completed_at DESC`,
      [orgId]
    );

    const scansByProduct = new Map(scansResult.rows.map(r => [r.product_id, r]));

    // Get finding counts per product
    const findingsResult = await pool.query(
      `SELECT product_id,
         COUNT(*) FILTER (WHERE risk_level = 'critical') AS critical,
         COUNT(*) FILTER (WHERE risk_level = 'warning') AS warning,
         COUNT(*) FILTER (WHERE risk_level = 'ok') AS ok,
         COUNT(*) FILTER (WHERE status = 'open') AS open_count
       FROM license_findings
       WHERE org_id = $1
       GROUP BY product_id`,
      [orgId]
    );

    const findingsByProduct = new Map(findingsResult.rows.map(r => [r.product_id, r]));

    // Aggregate totals
    let totalDeps = 0, totalPermissive = 0, totalCopyleft = 0, totalUnknown = 0, totalCritical = 0;
    let totalDirect = 0, totalTransitive = 0;

    const productSummaries = products.map(p => {
      const scan = scansByProduct.get(p.id);
      const findings = findingsByProduct.get(p.id);

      if (scan) {
        totalDeps += parseInt(scan.total_deps) || 0;
        totalPermissive += parseInt(scan.permissive_count) || 0;
        totalCopyleft += parseInt(scan.copyleft_count) || 0;
        totalUnknown += parseInt(scan.unknown_count) || 0;
        totalCritical += parseInt(scan.critical_count) || 0;
        totalDirect += parseInt(scan.direct_count) || 0;
        totalTransitive += parseInt(scan.transitive_count) || 0;
      }

      return {
        productId: p.id,
        productName: p.name,
        totalDeps: scan ? parseInt(scan.total_deps) : 0,
        permissiveCount: scan ? parseInt(scan.permissive_count) : 0,
        copyleftCount: scan ? parseInt(scan.copyleft_count) : 0,
        unknownCount: scan ? parseInt(scan.unknown_count) : 0,
        criticalCount: scan ? parseInt(scan.critical_count) : 0,
        directCount: scan ? parseInt(scan.direct_count) : 0,
        transitiveCount: scan ? parseInt(scan.transitive_count) : 0,
        openFindings: findings ? parseInt(findings.open_count) : 0,
        lastScanAt: scan?.completed_at || null,
        scanStatus: scan?.status || 'never'
      };
    });

    res.json({
      totals: {
        totalDeps,
        permissiveCount: totalPermissive,
        copyleftCount: totalCopyleft,
        unknownCount: totalUnknown,
        criticalCount: totalCritical,
        directCount: totalDirect,
        transitiveCount: totalTransitive,
        permissivePercent: totalDeps > 0 ? Math.round((totalPermissive / totalDeps) * 100) : 0,
        productCount: products.length,
        scannedCount: scansResult.rows.length
      },
      products: productSummaries
    });
  } catch (err) {
    console.error('Failed to get license overview:', err);
    res.status(500).json({ error: 'Failed to get license overview' });
  }
});

// POST /:productId/scan — trigger license scan for a product
router.post('/:productId/scan', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(400).json({ error: 'No organisation' }); return; }

    const productId = req.params.productId as string;

    // Verify product belongs to org
    const session = neo4jDriver.session({ defaultAccessMode: neo4j.session.READ });
    try {
      const check = await session.run(
        `MATCH (p:Product {id: $productId})-[:BELONGS_TO]->(o:Organisation {id: $orgId}) RETURN p.id`,
        { productId, orgId }
      );
      if (check.records.length === 0) { res.status(404).json({ error: 'Product not found' }); return; }
    } finally {
      await session.close();
    }

    // Check for running scan
    const running = await pool.query(
      `SELECT id FROM license_scans WHERE product_id = $1 AND status = 'running'`,
      [productId]
    );
    if (running.rows.length > 0) {
      res.status(409).json({ error: 'Scan already running', scanId: running.rows[0].id });
      return;
    }

    // Run scan (fire and forget, return scan ID immediately)
    const result = await scanProductLicenses(productId, orgId, userId);

    res.json({
      scanId: result.scanId,
      totalDeps: result.totalDeps,
      criticalCount: result.criticalCount
    });
  } catch (err) {
    console.error('Failed to trigger license scan:', err);
    res.status(500).json({ error: 'Failed to trigger scan' });
  }
});

// GET /:productId — list license findings for a product
router.get('/:productId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(400).json({ error: 'No organisation' }); return; }

    const productId = req.params.productId as string;
    const riskFilter = req.query.risk as string | undefined;
    const statusFilter = req.query.status as string | undefined;

    let query = `SELECT * FROM license_findings WHERE product_id = $1 AND org_id = $2`;
    const params: any[] = [productId, orgId];

    if (riskFilter && ['ok', 'warning', 'critical'].includes(riskFilter)) {
      params.push(riskFilter);
      query += ` AND risk_level = $${params.length}`;
    }

    if (statusFilter && ['open', 'acknowledged', 'waived'].includes(statusFilter)) {
      params.push(statusFilter);
      query += ` AND status = $${params.length}`;
    }

    query += ` ORDER BY CASE risk_level WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, dependency_name`;

    const findings = await pool.query(query, params);

    // Get latest scan info
    const scanResult = await pool.query(
      `SELECT * FROM license_scans WHERE product_id = $1 AND org_id = $2 ORDER BY started_at DESC LIMIT 1`,
      [productId, orgId]
    );

    res.json({
      findings: findings.rows,
      latestScan: scanResult.rows[0] || null
    });
  } catch (err) {
    console.error('Failed to get license findings:', err);
    res.status(500).json({ error: 'Failed to get findings' });
  }
});

// PUT /finding/:findingId — acknowledge or waive a finding
router.put('/finding/:findingId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(400).json({ error: 'No organisation' }); return; }

    const findingId = req.params.findingId as string;
    const { status, waiverReason } = req.body;

    if (!status || !['acknowledged', 'waived', 'open'].includes(status)) {
      res.status(400).json({ error: 'Invalid status. Must be: acknowledged, waived, or open' });
      return;
    }

    const updateFields: string[] = ['status = $3', 'updated_at = NOW()'];
    const params: any[] = [findingId, orgId, status];

    if (status === 'acknowledged' || status === 'waived') {
      updateFields.push(`acknowledged_by = $${params.length + 1}`);
      params.push(userId);
      updateFields.push(`acknowledged_at = NOW()`);
    }

    if (status === 'waived' && waiverReason) {
      updateFields.push(`waiver_reason = $${params.length + 1}`);
      params.push(waiverReason);
    }

    if (status === 'open') {
      updateFields.push('acknowledged_by = NULL', 'acknowledged_at = NULL', 'waiver_reason = NULL');
    }

    const result = await pool.query(
      `UPDATE license_findings SET ${updateFields.join(', ')} WHERE id = $1 AND org_id = $2 RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Finding not found' });
      return;
    }

    res.json({ finding: result.rows[0] });
  } catch (err) {
    console.error('Failed to update finding:', err);
    res.status(500).json({ error: 'Failed to update finding' });
  }
});

export default router;

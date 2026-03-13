/**
 * Public API v1 Routes (API-key authenticated)
 *
 * GET  /api/v1/products                              – List products
 * GET  /api/v1/products/:id                          – Product detail
 * GET  /api/v1/products/:id/vulnerabilities          – Vulnerability findings
 * GET  /api/v1/products/:id/obligations              – Obligation statuses
 * GET  /api/v1/products/:id/compliance-status        – Pass/fail compliance summary
 * POST /api/v1/products/:id/sync                     – Trigger SBOM sync + vulnerability rescan
 * PUT  /api/v1/products/:id/findings/:fid/resolve    – Mark finding as resolved with evidence
 * GET  /api/v1/products/:id/scans/:scanId            – Poll scan status
 */

import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { requireApiKey } from '../middleware/requireApiKey.js';
import {
  ensureObligations,
  computeDerivedStatuses,
  enrichObligation,
  getApplicableObligations,
} from '../services/obligation-engine.js';
import { analyseComplianceGaps } from '../services/compliance-gaps.js';
import { runProductScan } from '../services/vulnerability-scanner.js';

const router = Router();

/** Convert Neo4j DateTime to ISO string */
function toISOString(dt: any): string | null {
  if (!dt) return null;
  if (typeof dt === 'string') return dt;
  if (dt.year) {
    const y = dt.year.low ?? dt.year;
    const m = String(dt.month.low ?? dt.month).padStart(2, '0');
    const d = String(dt.day.low ?? dt.day).padStart(2, '0');
    const h = String(dt.hour.low ?? dt.hour).padStart(2, '0');
    const min = String(dt.minute.low ?? dt.minute).padStart(2, '0');
    const s = String(dt.second.low ?? dt.second).padStart(2, '0');
    return `${y}-${m}-${d}T${h}:${min}:${s}Z`;
  }
  return null;
}

/** Helper: verify product belongs to the API key's org */
async function verifyProductOrg(orgId: string, productId: string): Promise<any | null> {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p`,
      { orgId, productId },
    );
    if (result.records.length === 0) return null;
    return result.records[0].get('p').properties;
  } finally {
    await session.close();
  }
}

// ── GET /api/v1/products ──
router.get('/products', requireApiKey('read:products'), async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId;
    const driver = getDriver();
    const session = driver.session();
    try {
      const result = await session.run(
        `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product)
         RETURN p ORDER BY p.createdAt DESC`,
        { orgId },
      );
      const products = result.records.map(r => {
        const p = r.get('p').properties;
        return {
          id: p.id,
          name: p.name,
          version: p.version || null,
          craCategory: p.craCategory || 'default',
          productType: p.productType || null,
          distributionModel: p.distributionModel || null,
          status: p.status || 'active',
          createdAt: toISOString(p.createdAt),
        };
      });
      res.json({ products });
    } finally {
      await session.close();
    }
  } catch (error) {
    console.error('[API-V1] GET /products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/v1/products/:id ──
router.get('/products/:id', requireApiKey('read:products'), async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId;
    const product = await verifyProductOrg(orgId, req.params.id as string);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    res.json({
      id: product.id,
      name: product.name,
      description: product.description || null,
      version: product.version || null,
      craCategory: product.craCategory || 'default',
      productType: product.productType || null,
      distributionModel: product.distributionModel || null,
      status: product.status || 'active',
      repoUrl: product.repoUrl || null,
      createdAt: toISOString(product.createdAt),
    });
  } catch (error) {
    console.error('[API-V1] GET /products/:id error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/v1/products/:id/vulnerabilities ──
router.get('/products/:id/vulnerabilities', requireApiKey('read:vulnerabilities'), async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId;
    const productId = req.params.id as string;
    const product = await verifyProductOrg(orgId, productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Optional filters
    const severityFilter = req.query.severity as string | undefined;
    const statusFilter = req.query.status as string | undefined;

    let query = `SELECT id, source_id, source, severity, status,
                        dependency_name, dependency_version, dependency_ecosystem,
                        references_url, title, description,
                        dismissed_by, dismissed_reason, dismissed_at,
                        cvss_score, fixed_version,
                        created_at, updated_at
                 FROM vulnerability_findings
                 WHERE product_id = $1 AND org_id = $2`;
    const params: any[] = [productId, orgId];

    if (severityFilter) {
      params.push(severityFilter);
      query += ` AND severity = $${params.length}`;
    }
    if (statusFilter) {
      params.push(statusFilter);
      query += ` AND status = $${params.length}`;
    }

    query += ` ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2
               WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END, created_at DESC`;

    const findings = await pool.query(query, params);

    // Latest scan info
    const scan = await pool.query(
      `SELECT id, status, started_at, completed_at, findings_count,
              critical_count, high_count, medium_count, low_count
       FROM vulnerability_scans
       WHERE product_id = $1 AND org_id = $2
       ORDER BY started_at DESC LIMIT 1`,
      [productId, orgId],
    );

    res.json({
      productId,
      latestScan: scan.rows[0] || null,
      total: findings.rows.length,
      findings: findings.rows,
    });
  } catch (error) {
    console.error('[API-V1] GET /products/:id/vulnerabilities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/v1/products/:id/obligations ──
router.get('/products/:id/obligations', requireApiKey('read:obligations'), async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId;
    const productId = req.params.id as string;
    const product = await verifyProductOrg(orgId, productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const craCategory = product.craCategory || 'default';

    // Ensure obligations exist
    await ensureObligations(orgId, productId, craCategory);

    // Fetch obligations
    const obResult = await pool.query(
      `SELECT id, obligation_key, status, notes, updated_at
       FROM obligations
       WHERE org_id = $1 AND product_id = $2
       ORDER BY created_at ASC`,
      [orgId, productId],
    );

    // Compute derived statuses
    const categoryMap: Record<string, string | null> = { [productId]: craCategory };
    const derivedMap = await computeDerivedStatuses([productId], orgId, categoryMap);
    const productDerived = derivedMap[productId] || {};

    const obligations = obResult.rows.map(row => {
      const derived = productDerived[row.obligation_key];
      return enrichObligation(row, derived);
    });

    // Applicable obligations for this category
    const applicable = getApplicableObligations(craCategory);

    res.json({
      productId,
      craCategory,
      applicableCount: applicable.length,
      obligations,
    });
  } catch (error) {
    console.error('[API-V1] GET /products/:id/obligations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/v1/products/:id/compliance-status ──
router.get('/products/:id/compliance-status', requireApiKey('read:compliance'), async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId;
    const productId = req.params.id as string;
    const product = await verifyProductOrg(orgId, productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const gapResult = await analyseComplianceGaps(productId, orgId);
    if (!gapResult) return res.status(404).json({ error: 'Product not found' });

    // Threshold: "critical" (default), "high", "medium", "low", "any"
    const threshold = (req.query.threshold as string || 'high').toLowerCase();
    let pass: boolean;
    switch (threshold) {
      case 'critical':
        pass = gapResult.summary.critical === 0;
        break;
      case 'high':
        pass = gapResult.summary.critical === 0 && gapResult.summary.high === 0;
        break;
      case 'medium':
        pass = gapResult.summary.critical === 0 && gapResult.summary.high === 0 && gapResult.summary.medium === 0;
        break;
      case 'low':
      case 'any':
        pass = gapResult.summary.total === 0;
        break;
      default:
        pass = gapResult.summary.critical === 0 && gapResult.summary.high === 0;
    }

    res.json({
      productId,
      productName: gapResult.productName,
      craCategory: gapResult.craCategory,
      pass,
      threshold,
      generatedAt: gapResult.generatedAt,
      summary: gapResult.summary,
      progress: gapResult.progress,
      gaps: gapResult.gaps,
    });
  } catch (error) {
    console.error('[API-V1] GET /products/:id/compliance-status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/v1/products/:id/sync – Trigger SBOM sync + vulnerability rescan ──
router.post('/products/:id/sync', requireApiKey('write:findings'), async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId;
    const productId = req.params.id as string;
    const product = await verifyProductOrg(orgId, productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Check for already-running scan
    const running = await pool.query(
      "SELECT id FROM vulnerability_scans WHERE product_id = $1 AND status = 'running' LIMIT 1",
      [productId],
    );
    if (running.rows.length > 0) {
      return res.status(409).json({
        error: 'A scan is already running for this product',
        scanId: running.rows[0].id,
      });
    }

    // Fire-and-forget: run scan in background so the API responds immediately.
    // The MCP client polls GET /scans/:scanId for status.
    runProductScan(productId, orgId, 'api-key').catch(err => {
      console.error('[API-V1] Background scan failed:', err);
    });

    // Brief pause to let the scan record be created
    await new Promise(resolve => setTimeout(resolve, 200));

    // Fetch the newly created scan record
    const newScan = await pool.query(
      "SELECT id FROM vulnerability_scans WHERE product_id = $1 AND org_id = $2 ORDER BY started_at DESC LIMIT 1",
      [productId, orgId],
    );

    res.json({ scanId: newScan.rows[0]?.id || null, status: 'running' });
  } catch (error) {
    console.error('[API-V1] POST /products/:id/sync error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/v1/products/:id/scans/:scanId – Poll scan status ──
router.get('/products/:id/scans/:scanId', requireApiKey('read:vulnerabilities'), async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId;
    const productId = req.params.id as string;
    const scanId = req.params.scanId as string;

    const product = await verifyProductOrg(orgId, productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const result = await pool.query(
      `SELECT id, status, started_at, completed_at, findings_count,
              critical_count, high_count, medium_count, low_count
       FROM vulnerability_scans
       WHERE id = $1 AND product_id = $2 AND org_id = $3`,
      [scanId, productId, orgId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('[API-V1] GET /products/:id/scans/:scanId error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PUT /api/v1/products/:id/findings/:findingId/resolve – Mark finding as resolved ──
router.put('/products/:id/findings/:findingId/resolve', requireApiKey('write:findings'), async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).orgId;
    const productId = req.params.id as string;
    const findingId = req.params.findingId as string;

    const product = await verifyProductOrg(orgId, productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Verify finding belongs to this product and org
    const finding = await pool.query(
      'SELECT id, status, dependency_name, dependency_version FROM vulnerability_findings WHERE id = $1 AND product_id = $2 AND org_id = $3',
      [findingId, productId, orgId],
    );
    if (finding.rows.length === 0) {
      return res.status(404).json({ error: 'Finding not found' });
    }

    if (finding.rows[0].status === 'resolved') {
      return res.json({ message: 'Finding is already resolved', finding: finding.rows[0] });
    }

    const evidence = req.body.evidence || {};

    await pool.query(
      `UPDATE vulnerability_findings
       SET status = 'resolved',
           mitigation = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [
        JSON.stringify({
          resolvedVia: 'mcp-ide-assistant',
          ...evidence,
        }),
        findingId,
      ],
    );

    res.json({
      message: 'Finding marked as resolved',
      findingId,
      previousStatus: finding.rows[0].status,
    });
  } catch (error) {
    console.error('[API-V1] PUT /products/:id/findings/:findingId/resolve error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

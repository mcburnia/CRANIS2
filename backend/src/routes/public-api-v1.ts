/**
 * Public API v1 Routes (API-key authenticated)
 *
 * GET /api/v1/products                          — List products
 * GET /api/v1/products/:id                      — Product detail
 * GET /api/v1/products/:id/vulnerabilities      — Vulnerability findings
 * GET /api/v1/products/:id/obligations          — Obligation statuses
 * GET /api/v1/products/:id/compliance-status    — Pass/fail compliance summary
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

    const pass = gapResult.summary.critical === 0 && gapResult.summary.high === 0;

    res.json({
      productId,
      productName: gapResult.productName,
      craCategory: gapResult.craCategory,
      pass,
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

export default router;

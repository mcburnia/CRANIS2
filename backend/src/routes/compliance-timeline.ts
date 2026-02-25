import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';

const router = Router();

// Auth middleware (per-route file, follows project pattern)
async function requireAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifySessionToken(token);
    if (!payload) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    (req as any).userId = payload.userId;
    (req as any).email = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Helper: get user's org_id
async function getOrgId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.org_id || null;
}

// Helper: verify product belongs to org and get product name
async function getProductIfOwned(orgId: string, productId: string): Promise<string | null> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId}) RETURN p.name AS name`,
      { orgId, productId }
    );
    if (result.records.length === 0) return null;
    return result.records[0].get('name') as string;
  } finally {
    await session.close();
  }
}

// ─── GET /:productId ────────────────────────────────────────────────
// Returns aggregated compliance timeline data for a single product
router.get('/:productId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(400).json({ error: 'No organisation' }); return; }

    const productId = req.params.productId as string;

    const productName = await getProductIfOwned(orgId, productId);
    if (!productName) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Run all 5 queries in parallel
    const [vulnScans, licenseScans, craReports, ipSnapshots, versions] = await Promise.all([
      // 1. Vulnerability scans
      pool.query(
        `SELECT id, started_at, completed_at, status, findings_count,
                critical_count, high_count, medium_count, low_count,
                source, triggered_by
         FROM vulnerability_scans
         WHERE product_id = $1 AND org_id = $2 AND status = 'completed'
         ORDER BY completed_at ASC`,
        [productId, orgId]
      ),

      // 2. License scans
      pool.query(
        `SELECT id, started_at, completed_at, status,
                total_deps, permissive_count, copyleft_count,
                unknown_count, critical_count
         FROM license_scans
         WHERE product_id = $1 AND org_id = $2 AND status = 'completed'
         ORDER BY completed_at ASC`,
        [productId, orgId]
      ),

      // 3. CRA reports with stages
      pool.query(
        `SELECT r.id, r.report_type, r.status, r.awareness_at, r.created_at,
                r.early_warning_deadline, r.notification_deadline, r.final_report_deadline,
                json_agg(json_build_object(
                  'stage', s.stage,
                  'submittedAt', s.submitted_at
                ) ORDER BY s.submitted_at) FILTER (WHERE s.id IS NOT NULL) AS stages
         FROM cra_reports r
         LEFT JOIN cra_report_stages s ON s.report_id = r.id
         WHERE r.product_id = $1 AND r.org_id = $2
         GROUP BY r.id
         ORDER BY r.created_at ASC`,
        [productId, orgId]
      ),

      // 4. IP proof snapshots
      pool.query(
        `SELECT id, snapshot_type, content_hash, verified, created_at
         FROM ip_proof_snapshots
         WHERE product_id = $1 AND org_id = $2
         ORDER BY created_at ASC`,
        [productId, orgId]
      ),

      // 5. Product versions
      pool.query(
        `SELECT id, cranis_version, github_tag, source, created_at
         FROM product_versions
         WHERE product_id = $1
         ORDER BY created_at ASC`,
        [productId]
      ),
    ]);

    // Compute time range from all timestamps
    const allDates: string[] = [];
    for (const row of vulnScans.rows) allDates.push(row.completed_at);
    for (const row of licenseScans.rows) allDates.push(row.completed_at);
    for (const row of craReports.rows) allDates.push(row.created_at);
    for (const row of ipSnapshots.rows) allDates.push(row.created_at);
    for (const row of versions.rows) allDates.push(row.created_at);

    const timestamps = allDates.filter(Boolean).map(d => new Date(d).getTime());
    const earliest = timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : null;
    const latest = timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;

    res.json({
      productId,
      productName,
      timeRange: { earliest, latest },

      vulnerabilityScans: vulnScans.rows.map(r => ({
        id: r.id,
        completedAt: r.completed_at,
        findingsCount: r.findings_count,
        criticalCount: r.critical_count,
        highCount: r.high_count,
        mediumCount: r.medium_count,
        lowCount: r.low_count,
        source: r.source,
        triggeredBy: r.triggered_by,
      })),

      licenseScans: licenseScans.rows.map(r => ({
        id: r.id,
        completedAt: r.completed_at,
        totalDeps: r.total_deps,
        permissiveCount: r.permissive_count,
        copyleftCount: r.copyleft_count,
        unknownCount: r.unknown_count,
        criticalCount: r.critical_count,
      })),

      craReports: craReports.rows.map(r => ({
        id: r.id,
        reportType: r.report_type,
        status: r.status,
        awarenessAt: r.awareness_at,
        createdAt: r.created_at,
        earlyWarningDeadline: r.early_warning_deadline,
        notificationDeadline: r.notification_deadline,
        finalReportDeadline: r.final_report_deadline,
        stages: r.stages,
      })),

      ipProofSnapshots: ipSnapshots.rows.map(r => ({
        id: r.id,
        snapshotType: r.snapshot_type,
        verified: r.verified,
        createdAt: r.created_at,
      })),

      versions: versions.rows.map(r => ({
        id: r.id,
        cranisVersion: r.cranis_version,
        githubTag: r.github_tag,
        source: r.source,
        createdAt: r.created_at,
      })),
    });

  } catch (err) {
    console.error('Compliance timeline failed:', err);
    res.status(500).json({ error: 'Failed to load compliance timeline' });
  }
});

export default router;

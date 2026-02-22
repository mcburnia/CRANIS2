import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';

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

// GET /api/dashboard/summary
router.get('/summary', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) {
      res.status(403).json({ error: 'No organisation found' });
      return;
    }

    const driver = getDriver();
    const session = driver.session();

    let products: any[] = [];
    let totalContributors = 0;

    try {
      const productResult = await session.run(
        `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product)
         OPTIONAL MATCH (p)-[:HAS_REPO]->(r:GitHubRepo)
         OPTIONAL MATCH (p)-[:HAS_SBOM]->(s:SBOM)
         OPTIONAL MATCH (r)-[:HAS_CONTRIBUTOR]->(c:Contributor)
         RETURN p.id AS id, p.name AS name, p.craCategory AS category,
                r.fullName AS repoFullName, r IS NOT NULL AS repoConnected,
                s.packageCount AS sbomPackageCount, s.isStale AS sbomIsStale,
                count(DISTINCT c) AS contributorCount`,
        { orgId }
      );

      products = productResult.records.map(record => ({
        id: record.get('id'),
        name: record.get('name'),
        category: record.get('category') || null,
        repoConnected: record.get('repoConnected'),
        repoFullName: record.get('repoFullName') || null,
        sbomPackageCount: record.get('sbomPackageCount')?.toNumber?.() ?? record.get('sbomPackageCount') ?? 0,
        sbomIsStale: record.get('sbomIsStale') ?? false,
        contributorCount: record.get('contributorCount')?.toNumber?.() ?? record.get('contributorCount') ?? 0,
      }));

      const contribResult = await session.run(
        `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product)-[:HAS_REPO]->(r:GitHubRepo)-[:HAS_CONTRIBUTOR]->(c:Contributor)
         RETURN count(DISTINCT c) AS total`,
        { orgId }
      );
      totalContributors = contribResult.records[0]?.get('total')?.toNumber?.() ?? 0;

    } finally {
      await session.close();
    }

    const productIds = products.map(p => p.id);

    // --- Postgres: total dependencies from product_sboms.package_count ---
    // Uses the same source as the product detail page for consistency
    let totalDependencies = 0;
    if (productIds.length > 0) {
      const depResult = await pool.query(
        `SELECT COALESCE(SUM(package_count), 0) AS total FROM product_sboms WHERE product_id = ANY($1)`,
        [productIds]
      );
      totalDependencies = parseInt(depResult.rows[0]?.total) || 0;
    }

    // --- Postgres: tech file sections ---
    let techFileMap: Record<string, { total: number; completed: number }> = {};
    if (productIds.length > 0) {
      const tfResult = await pool.query(
        `SELECT product_id, section_key, status FROM technical_file_sections WHERE product_id = ANY($1)`,
        [productIds]
      );
      for (const row of tfResult.rows) {
        if (!techFileMap[row.product_id]) {
          techFileMap[row.product_id] = { total: 0, completed: 0 };
        }
        techFileMap[row.product_id].total++;
        if (row.status === 'complete') {
          techFileMap[row.product_id].completed++;
        }
      }
    }

    // --- Postgres: last sync per product ---
    let lastSyncMap: Record<string, string> = {};
    if (productIds.length > 0) {
      const syncResult = await pool.query(
        `SELECT product_id, MAX(started_at) AS last_sync FROM sync_history WHERE product_id = ANY($1) AND status = 'success' GROUP BY product_id`,
        [productIds]
      );
      for (const row of syncResult.rows) {
        lastSyncMap[row.product_id] = row.last_sync;
      }
    }

    const enrichedProducts = products.map(p => {
      const tf = techFileMap[p.id] || { total: 8, completed: 0 };
      const progress = tf.total > 0 ? Math.round((tf.completed / tf.total) * 100) : 0;
      return {
        ...p,
        techFileProgress: progress,
        techFileSections: tf,
        lastSync: lastSyncMap[p.id] || null,
      };
    });

    const connectedRepos = products.filter(p => p.repoConnected).length;
    const staleSboms = products.filter(p => p.sbomIsStale).length;

    const activityResult = await pool.query(
      `SELECT
        e.event_type,
        e.metadata,
        e.created_at,
        COALESCE(u.email, 'system') AS user_email
      FROM user_events e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE (u.org_id = $1 OR e.user_id IS NULL)
      ORDER BY e.created_at DESC
      LIMIT 10`,
      [orgId]
    );

    const recentActivity = activityResult.rows.map(row => ({
      eventType: row.event_type,
      userEmail: row.user_email,
      createdAt: row.created_at,
      metadata: row.metadata,
    }));

    // --- Postgres: vulnerability findings summary ---
    let riskFindings = { total: 0, critical: 0, high: 0, medium: 0, low: 0, open: 0, dismissed: 0, lastScanAt: null as string | null };
    let productRiskMap: Record<string, { total: number; critical: number; high: number; open: number }> = {};
    if (productIds.length > 0) {
      const vulnResult = await pool.query(
        `SELECT product_id, severity, status, count(*) as cnt
         FROM vulnerability_findings
         WHERE org_id = $1
         GROUP BY product_id, severity, status`,
        [orgId]
      );
      for (const row of vulnResult.rows) {
        const cnt = parseInt(row.cnt);
        riskFindings.total += cnt;
        if (row.severity === 'critical') riskFindings.critical += cnt;
        if (row.severity === 'high') riskFindings.high += cnt;
        if (row.severity === 'medium') riskFindings.medium += cnt;
        if (row.severity === 'low') riskFindings.low += cnt;
        if (row.status === 'open') riskFindings.open += cnt;
        if (row.status === 'dismissed') riskFindings.dismissed += cnt;

        if (!productRiskMap[row.product_id]) productRiskMap[row.product_id] = { total: 0, critical: 0, high: 0, open: 0 };
        productRiskMap[row.product_id].total += cnt;
        if (row.severity === 'critical') productRiskMap[row.product_id].critical += cnt;
        if (row.severity === 'high') productRiskMap[row.product_id].high += cnt;
        if (row.status === 'open') productRiskMap[row.product_id].open += cnt;
      }

      const lastScanResult = await pool.query(
        `SELECT MAX(completed_at) as last_scan
         FROM vulnerability_scans
         WHERE org_id = $1 AND status = 'completed'`,
        [orgId]
      );
      riskFindings.lastScanAt = lastScanResult.rows[0]?.last_scan || null;
    }

    // Enrich products with risk data
    const finalProducts = enrichedProducts.map(p => ({
      ...p,
      riskFindings: productRiskMap[p.id] || { total: 0, critical: 0, high: 0, open: 0 },
    }));

    res.json({
      products: finalProducts,
      stats: {
        totalProducts: products.length,
        connectedRepos,
        totalContributors,
        totalDependencies,
        staleSboms,
      },
      riskFindings,
      recentActivity,
    });

  } catch (err) {
    console.error('Failed to fetch dashboard summary:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

export default router;

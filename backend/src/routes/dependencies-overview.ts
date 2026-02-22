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

// GET /api/dependencies/overview
router.get('/overview', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const driver = getDriver();
    const session = driver.session();
    let products: any[] = [];
    try {
      // Get products with their dependencies
      const result = await session.run(
        `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product)
         OPTIONAL MATCH (p)-[:DEPENDS_ON]->(d:Dependency)
         RETURN p.id AS id, p.name AS name, p.craCategory AS craCategory,
                collect(CASE WHEN d IS NOT NULL THEN {
                  name: d.name, version: d.version, ecosystem: d.ecosystem,
                  license: d.license, purl: d.purl, supplier: d.supplier
                } ELSE NULL END) AS dependencies
         ORDER BY p.name`,
        { orgId }
      );
      products = result.records.map(r => ({
        id: r.get('id'),
        name: r.get('name'),
        craCategory: r.get('craCategory') || null,
        dependencies: r.get('dependencies').filter((d: any) => d !== null),
      }));
    } finally {
      await session.close();
    }

    // Get SBOM data from Postgres
    const productIds = products.map(p => p.id);
    let sbomMap = new Map<string, any>();
    if (productIds.length > 0) {
      const sbomResult = await pool.query(
        `SELECT product_id, spdx_version, package_count, is_stale, synced_at
         FROM product_sboms
         WHERE product_id = ANY($1)`,
        [productIds]
      );
      sbomMap = new Map(sbomResult.rows.map(r => [r.product_id, {
        spdxVersion: r.spdx_version,
        packageCount: r.package_count,
        isStale: r.is_stale,
        syncedAt: r.synced_at,
      }]));
    }

    // Enrich products with SBOM data
    for (const product of products) {
      product.sbom = sbomMap.get(product.id) || null;
    }

    // Calculate totals across all products
    const allDeps = products.flatMap(p => p.dependencies);
    const ecosystems: Record<string, number> = {};
    const licenseBreakdown: Record<string, number> = {};
    const uniqueDeps = new Map<string, any>();

    for (const dep of allDeps) {
      const eco = dep.ecosystem || 'unknown';
      ecosystems[eco] = (ecosystems[eco] || 0) + 1;
      
      const lic = dep.license || 'Unknown';
      licenseBreakdown[lic] = (licenseBreakdown[lic] || 0) + 1;
      
      // Deduplicate by purl for unique count
      if (dep.purl) uniqueDeps.set(dep.purl, dep);
      else uniqueDeps.set(`${dep.name}@${dep.version}`, dep);
    }

    // Identify license risks
    const copyleftLicenses = ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0', 'LGPL-2.1', 'LGPL-3.0', 'GPL-2.0-only', 'GPL-3.0-only', 'AGPL-3.0-only'];
    const unknownCount = licenseBreakdown['Unknown'] || licenseBreakdown['NOASSERTION'] || 0;
    const copyleftCount = Object.entries(licenseBreakdown)
      .filter(([lic]) => copyleftLicenses.some(cl => lic.includes(cl)))
      .reduce((sum, [, count]) => sum + count, 0);

    const totalPackages = products.reduce((sum, p) => sum + (p.sbom?.packageCount || 0), 0);
    const staleSboms = products.filter(p => p.sbom?.isStale).length;

    // Sort license breakdown by count desc
    const sortedLicenses = Object.fromEntries(
      Object.entries(licenseBreakdown).sort((a, b) => b[1] - a[1])
    );

    res.json({
      products,
      totals: {
        totalDependencies: uniqueDeps.size,
        totalPackages,
        ecosystems,
        ecosystemCount: Object.keys(ecosystems).length,
        licenseBreakdown: sortedLicenses,
        licenseCount: Object.keys(licenseBreakdown).length,
        staleSboms,
      },
      licenseRisk: {
        unknown: unknownCount,
        copyleft: copyleftCount,
      },
    });
  } catch (err) {
    console.error('Failed to fetch dependencies overview:', err);
    res.status(500).json({ error: 'Failed to fetch dependencies overview' });
  }
});

export default router;

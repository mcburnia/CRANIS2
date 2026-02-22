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

// GET /api/repos/overview
router.get('/overview', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    // Get all products with their repos from Neo4j
    const driver = getDriver();
    const session = driver.session();
    let products: any[] = [];
    try {
      const result = await session.run(
        `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product)
         OPTIONAL MATCH (p)-[:HAS_REPO]->(r:GitHubRepo)
         OPTIONAL MATCH (r)-[:HAS_CONTRIBUTOR]->(c:Contributor)
         RETURN p.id AS id, p.name AS name, p.craCategory AS craCategory,
                r.fullName AS repoFullName, r.url AS repoUrl, r.language AS language,
                r.stars AS stars, r.forks AS forks, r.openIssues AS openIssues,
                r.visibility AS visibility, r.defaultBranch AS defaultBranch,
                r.lastPush AS lastPush, r.syncedAt AS syncedAt, r.isPrivate AS isPrivate,
                r.languages AS languages, r.description AS repoDescription,
                count(c) AS contributorCount
         ORDER BY p.name`,
        { orgId }
      );
      products = result.records.map(r => ({
        id: r.get('id'),
        name: r.get('name'),
        craCategory: r.get('craCategory') || null,
        repo: r.get('repoFullName') ? {
          fullName: r.get('repoFullName'),
          url: r.get('repoUrl'),
          description: r.get('repoDescription') || '',
          language: r.get('language') || '',
          languages: r.get('languages') || '{}',
          stars: typeof r.get('stars') === 'object' ? (r.get('stars') as any).toNumber?.() ?? r.get('stars') : r.get('stars') || 0,
          forks: typeof r.get('forks') === 'object' ? (r.get('forks') as any).toNumber?.() ?? r.get('forks') : r.get('forks') || 0,
          openIssues: typeof r.get('openIssues') === 'object' ? (r.get('openIssues') as any).toNumber?.() ?? r.get('openIssues') : r.get('openIssues') || 0,
          visibility: r.get('visibility') || 'unknown',
          defaultBranch: r.get('defaultBranch') || 'main',
          lastPush: r.get('lastPush') || null,
          syncedAt: r.get('syncedAt') || null,
          isPrivate: r.get('isPrivate') || false,
          contributorCount: typeof r.get('contributorCount') === 'object' ? (r.get('contributorCount') as any).toNumber?.() ?? 0 : r.get('contributorCount') || 0,
        } : null,
      }));
    } finally {
      await session.close();
    }

    // Get last sync info from Postgres for products with repos
    const productIds = products.filter(p => p.repo).map(p => p.id);
    if (productIds.length > 0) {
      const syncResult = await pool.query(
        `SELECT DISTINCT ON (product_id) product_id, duration_seconds, started_at, status
         FROM sync_history
         WHERE product_id = ANY($1)
         ORDER BY product_id, started_at DESC`,
        [productIds]
      );
      const syncMap = new Map(syncResult.rows.map(r => [r.product_id, r]));
      for (const product of products) {
        if (product.repo) {
          const sync = syncMap.get(product.id);
          if (sync) {
            product.repo.lastSyncDuration = parseFloat(sync.duration_seconds);
            product.repo.lastSyncAt = sync.started_at;
            product.repo.lastSyncStatus = sync.status;
          }
        }
      }
    }

    // Calculate totals
    const connectedRepos = products.filter(p => p.repo).length;
    const totalOpenIssues = products.reduce((sum, p) => sum + (p.repo?.openIssues || 0), 0);

    res.json({
      products,
      totals: {
        totalProducts: products.length,
        connectedRepos,
        disconnectedProducts: products.length - connectedRepos,
        totalOpenIssues,
      },
    });
  } catch (err) {
    console.error('Failed to fetch repos overview:', err);
    res.status(500).json({ error: 'Failed to fetch repos overview' });
  }
});

export default router;

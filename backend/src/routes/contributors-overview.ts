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

// GET /api/contributors/overview
router.get('/overview', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const driver = getDriver();
    const session = driver.session();
    let products: any[] = [];
    try {
      const result = await session.run(
        `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product)
         OPTIONAL MATCH (p)-[:HAS_REPO]->(r:Repository)
         OPTIONAL MATCH (r)-[:HAS_CONTRIBUTOR]->(c:Contributor)
         RETURN p.id AS id, p.name AS name, p.craCategory AS craCategory,
                r.fullName AS repoFullName,
                collect(CASE WHEN c IS NOT NULL THEN {
                  githubLogin: c.githubLogin,
                  githubId: c.githubId,
                  avatarUrl: c.avatarUrl,
                  profileUrl: c.profileUrl,
                  contributions: c.contributions
                } ELSE NULL END) AS contributors
         ORDER BY p.name`,
        { orgId }
      );
      products = result.records.map(r => {
        const rawContribs = r.get('contributors').filter((c: any) => c !== null);
        const contributors = rawContribs.map((c: any) => ({
          githubLogin: c.githubLogin,
          githubId: typeof c.githubId === 'object' ? (c.githubId as any).toNumber?.() ?? c.githubId : c.githubId,
          avatarUrl: c.avatarUrl,
          profileUrl: c.profileUrl,
          contributions: typeof c.contributions === 'object' ? (c.contributions as any).toNumber?.() ?? c.contributions : c.contributions || 0,
        }));
        // Sort by contributions desc
        contributors.sort((a: any, b: any) => b.contributions - a.contributions);
        
        return {
          id: r.get('id'),
          name: r.get('name'),
          craCategory: r.get('craCategory') || null,
          repoFullName: r.get('repoFullName') || null,
          contributors,
        };
      });
    } finally {
      await session.close();
    }

    // Calculate totals — deduplicate contributors across products by githubId
    const uniqueContributors = new Map<number, any>();
    let totalContributions = 0;
    let productsWithRepos = 0;

    for (const product of products) {
      if (product.repoFullName) productsWithRepos++;
      for (const c of product.contributors) {
        totalContributions += c.contributions;
        if (!uniqueContributors.has(c.githubId)) {
          uniqueContributors.set(c.githubId, c);
        }
      }
    }

    res.json({
      products,
      totals: {
        totalContributors: uniqueContributors.size,
        totalContributions,
        productsWithRepos,
        totalProducts: products.length,
      },
    });
  } catch (err) {
    console.error('Failed to fetch contributors overview:', err);
    res.status(500).json({ error: 'Failed to fetch contributors overview' });
  }
});

export default router;

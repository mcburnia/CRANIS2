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

// Default section definitions (same as technical-file.ts)
const DEFAULT_SECTIONS = [
  { section_key: 'product_description', title: 'Product Description', cra_reference: 'Annex VII \u00a71', content: '{}' },
  { section_key: 'design_development', title: 'Design & Development', cra_reference: 'Annex VII \u00a72(a)', content: '{}' },
  { section_key: 'vulnerability_handling', title: 'Vulnerability Handling', cra_reference: 'Annex VII \u00a72(b)', content: '{}' },
  { section_key: 'risk_assessment', title: 'Cybersecurity Risk Assessment', cra_reference: 'Annex VII \u00a73', content: '{}' },
  { section_key: 'support_period', title: 'Support Period', cra_reference: 'Annex VII \u00a74', content: '{}' },
  { section_key: 'standards_applied', title: 'Standards & Specifications Applied', cra_reference: 'Annex VII \u00a75', content: '{}' },
  { section_key: 'test_reports', title: 'Test Reports', cra_reference: 'Annex VII \u00a76', content: '{}' },
  { section_key: 'declaration_of_conformity', title: 'EU Declaration of Conformity', cra_reference: 'Annex VII \u00a77', content: '{}' },
];

async function ensureSections(productId: string): Promise<void> {
  for (const section of DEFAULT_SECTIONS) {
    await pool.query(
      `INSERT INTO technical_file_sections (product_id, section_key, title, content, cra_reference)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (product_id, section_key) DO NOTHING`,
      [productId, section.section_key, section.title, section.content, section.cra_reference]
    );
  }
}

// GET /api/technical-files/overview
router.get('/overview', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    // Get all products from Neo4j
    const driver = getDriver();
    const session = driver.session();
    let products: { id: string; name: string; craCategory: string | null }[] = [];
    try {
      const result = await session.run(
        `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product)
         RETURN p.id AS id, p.name AS name, p.craCategory AS craCategory
         ORDER BY p.name`,
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
      res.json({ products: [], totals: { totalSections: 0, completed: 0, inProgress: 0, notStarted: 0 } });
      return;
    }

    // Auto-create sections for all products
    for (const product of products) {
      await ensureSections(product.id);
    }

    // Get all sections for these products
    const productIds = products.map(p => p.id);
    const sectionsResult = await pool.query(
      `SELECT product_id, section_key, title, status, cra_reference, updated_at
       FROM technical_file_sections
       WHERE product_id = ANY($1)
       ORDER BY created_at ASC`,
      [productIds]
    );

    // Group sections by product
    const sectionsByProduct: Record<string, any[]> = {};
    for (const row of sectionsResult.rows) {
      if (!sectionsByProduct[row.product_id]) sectionsByProduct[row.product_id] = [];
      sectionsByProduct[row.product_id].push({
        sectionKey: row.section_key,
        title: row.title,
        status: row.status,
        craReference: row.cra_reference,
        updatedAt: row.updated_at,
      });
    }

    // Build response
    let totalCompleted = 0;
    let totalInProgress = 0;
    let totalNotStarted = 0;

    const enrichedProducts = products.map(p => {
      const sections = sectionsByProduct[p.id] || [];
      const completed = sections.filter(s => s.status === 'completed').length;
      const inProgress = sections.filter(s => s.status === 'in_progress').length;
      const notStarted = sections.filter(s => s.status === 'not_started').length;

      totalCompleted += completed;
      totalInProgress += inProgress;
      totalNotStarted += notStarted;

      return {
        id: p.id,
        name: p.name,
        craCategory: p.craCategory,
        sections,
        progress: { total: sections.length, completed, inProgress, notStarted },
      };
    });

    const totalSections = totalCompleted + totalInProgress + totalNotStarted;

    res.json({
      products: enrichedProducts,
      totals: { totalSections, completed: totalCompleted, inProgress: totalInProgress, notStarted: totalNotStarted },
    });

  } catch (err) {
    console.error('Failed to fetch technical files overview:', err);
    res.status(500).json({ error: 'Failed to fetch technical files overview' });
  }
});

export default router;

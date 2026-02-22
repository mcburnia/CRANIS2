import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';

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

// ─── Obligation definitions ──────────────────────────────────
const OBLIGATIONS = [
  { key: 'art_13', article: 'Art. 13', title: 'Obligations of Manufacturers', description: 'Ensure products are designed and developed in accordance with essential cybersecurity requirements.', appliesTo: ['default', 'important_i', 'important_ii', 'critical'] },
  { key: 'art_13_6', article: 'Art. 13(6)', title: 'Vulnerability Handling', description: 'Identify and document vulnerabilities, provide security updates for at least 5 years.', appliesTo: ['default', 'important_i', 'important_ii', 'critical'] },
  { key: 'art_13_11', article: 'Art. 13(11)', title: 'SBOM (Software Bill of Materials)', description: 'Identify and document components contained in the product, including an SBOM in machine-readable format.', appliesTo: ['default', 'important_i', 'important_ii', 'critical'] },
  { key: 'art_13_12', article: 'Art. 13(12)', title: 'Technical Documentation', description: 'Draw up technical documentation before placing the product on the market.', appliesTo: ['default', 'important_i', 'important_ii', 'critical'] },
  { key: 'art_13_14', article: 'Art. 13(14)', title: 'Conformity Assessment', description: 'Carry out a conformity assessment of the product.', appliesTo: ['default', 'important_i', 'important_ii', 'critical'] },
  { key: 'art_13_15', article: 'Art. 13(15)', title: 'EU Declaration of Conformity', description: 'Draw up the EU declaration of conformity and affix the CE marking.', appliesTo: ['default', 'important_i', 'important_ii', 'critical'] },
  { key: 'art_14', article: 'Art. 14', title: 'Vulnerability Reporting', description: 'Report actively exploited vulnerabilities and severe incidents to ENISA within 24 hours.', appliesTo: ['default', 'important_i', 'important_ii', 'critical'] },
  { key: 'annex_i_part_i', article: 'Annex I, Part I', title: 'Security by Design', description: 'Products shall be designed and developed with appropriate level of cybersecurity based on risks.', appliesTo: ['default', 'important_i', 'important_ii', 'critical'] },
  { key: 'annex_i_part_ii', article: 'Annex I, Part II', title: 'Vulnerability Handling Requirements', description: 'Implement vulnerability handling processes including coordinated disclosure policy.', appliesTo: ['default', 'important_i', 'important_ii', 'critical'] },
  { key: 'art_32', article: 'Art. 32', title: 'Harmonised Standards', description: 'Where harmonised standards exist, conformity assessment shall reference them.', appliesTo: ['important_i', 'important_ii', 'critical'] },
  { key: 'art_32_3', article: 'Art. 32(3)', title: 'Third-Party Assessment', description: 'Critical products require third-party conformity assessment by a notified body.', appliesTo: ['important_ii', 'critical'] },
];

function getApplicableObligations(craCategory: string | null): typeof OBLIGATIONS {
  const cat = craCategory || 'default';
  return OBLIGATIONS.filter(o => o.appliesTo.includes(cat));
}

async function ensureObligations(orgId: string, productId: string, craCategory: string | null): Promise<void> {
  const applicable = getApplicableObligations(craCategory);
  for (const ob of applicable) {
    await pool.query(
      `INSERT INTO obligations (org_id, product_id, obligation_key)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [orgId, productId, ob.key]
    );
  }
}

function enrichObligation(row: any) {
  const def = OBLIGATIONS.find(o => o.key === row.obligation_key);
  return {
    id: row.id,
    obligationKey: row.obligation_key,
    article: def?.article || row.obligation_key,
    title: def?.title || row.obligation_key,
    description: def?.description || '',
    status: row.status,
    notes: row.notes || '',
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

// ─── GET /api/obligations/overview ───────────────────────────
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
      res.json({ products: [], totals: { totalObligations: 0, completed: 0, inProgress: 0, notStarted: 0 } });
      return;
    }

    // Auto-create obligations for all products
    for (const p of products) {
      await ensureObligations(orgId, p.id, p.craCategory);
    }

    // Fetch all obligations
    const productIds = products.map(p => p.id);
    const obResult = await pool.query(
      `SELECT id, product_id, obligation_key, status, notes, updated_by, updated_at
       FROM obligations WHERE org_id = $1 AND product_id = ANY($2)
       ORDER BY created_at ASC`,
      [orgId, productIds]
    );

    // Group by product
    const obByProduct: Record<string, any[]> = {};
    for (const row of obResult.rows) {
      if (!obByProduct[row.product_id]) obByProduct[row.product_id] = [];
      obByProduct[row.product_id].push(enrichObligation(row));
    }

    let totalCompleted = 0, totalInProgress = 0, totalNotStarted = 0;

    const enrichedProducts = products.map(p => {
      const obligations = obByProduct[p.id] || [];
      const completed = obligations.filter(o => o.status === 'met').length;
      const inProgress = obligations.filter(o => o.status === 'in_progress').length;
      const notStarted = obligations.filter(o => o.status === 'not_started').length;
      totalCompleted += completed;
      totalInProgress += inProgress;
      totalNotStarted += notStarted;

      return {
        id: p.id,
        name: p.name,
        craCategory: p.craCategory,
        obligations,
        progress: { total: obligations.length, completed, inProgress, notStarted },
      };
    });

    res.json({
      products: enrichedProducts,
      totals: { totalObligations: totalCompleted + totalInProgress + totalNotStarted, completed: totalCompleted, inProgress: totalInProgress, notStarted: totalNotStarted },
    });

  } catch (err) {
    console.error('Failed to fetch obligations overview:', err);
    res.status(500).json({ error: 'Failed to fetch obligations overview' });
  }
});

// ─── GET /api/obligations/:productId ─────────────────────────
router.get('/:productId', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const productId = req.params.productId as string;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    // Verify product belongs to org and get category
    const driver = getDriver();
    const session = driver.session();
    let craCategory: string | null = null;
    try {
      const result = await session.run(
        `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
         RETURN p.craCategory AS craCategory`,
        { orgId, productId }
      );
      if (result.records.length === 0) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      craCategory = result.records[0].get('craCategory') || null;
    } finally {
      await session.close();
    }

    // Auto-create
    await ensureObligations(orgId, productId, craCategory);

    // Fetch
    const obResult = await pool.query(
      `SELECT id, product_id, obligation_key, status, notes, updated_by, updated_at
       FROM obligations WHERE org_id = $1 AND product_id = $2
       ORDER BY created_at ASC`,
      [orgId, productId]
    );

    const obligations = obResult.rows.map(enrichObligation);
    const completed = obligations.filter(o => o.status === 'met').length;
    const inProgress = obligations.filter(o => o.status === 'in_progress').length;
    const notStarted = obligations.filter(o => o.status === 'not_started').length;

    res.json({
      obligations,
      progress: { total: obligations.length, completed, inProgress, notStarted },
    });

  } catch (err) {
    console.error('Failed to fetch product obligations:', err);
    res.status(500).json({ error: 'Failed to fetch product obligations' });
  }
});

// ─── PUT /api/obligations/:id ────────────────────────────────
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).email;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const obligationId = req.params.id as string;
    const { status, notes } = req.body;

    if (status && !['not_started', 'in_progress', 'met'].includes(status)) {
      res.status(400).json({ error: 'Invalid status. Must be: not_started, in_progress, or met' });
      return;
    }

    // Verify belongs to org
    const check = await pool.query(
      `SELECT id, obligation_key, product_id FROM obligations WHERE id = $1 AND org_id = $2`,
      [obligationId, orgId]
    );
    if (check.rows.length === 0) {
      res.status(404).json({ error: 'Obligation not found' });
      return;
    }

    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (status !== undefined) { updates.push(`status = $${idx}`); params.push(status); idx++; }
    if (notes !== undefined) { updates.push(`notes = $${idx}`); params.push(notes); idx++; }
    updates.push(`updated_by = $${idx}`); params.push(userEmail); idx++;
    updates.push(`updated_at = NOW()`);
    params.push(obligationId);

    const result = await pool.query(
      `UPDATE obligations SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    // Telemetry
    const reqData = extractRequestData(req);
    await recordEvent({
      userId,
      email: userEmail,
      eventType: 'obligation_updated',
      ...reqData,
      metadata: {
        obligationId,
        obligationKey: check.rows[0].obligation_key,
        productId: check.rows[0].product_id,
        newStatus: status,
      },
    });

    res.json(enrichObligation(result.rows[0]));

  } catch (err) {
    console.error('Failed to update obligation:', err);
    res.status(500).json({ error: 'Failed to update obligation' });
  }
});

export default router;

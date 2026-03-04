import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';
import {
  ensureObligations, computeDerivedStatuses, enrichObligation,
} from '../services/obligation-engine.js';

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

    // Fetch all obligations and derived statuses in parallel
    const productIds = products.map(p => p.id);
    const categoryMap: Record<string, string | null> = {};
    for (const p of products) categoryMap[p.id] = p.craCategory;
    const [obResult, derivedMap] = await Promise.all([
      pool.query(
        `SELECT id, product_id, obligation_key, status, notes, updated_by, updated_at
         FROM obligations WHERE org_id = $1 AND product_id = ANY($2)
         ORDER BY created_at ASC`,
        [orgId, productIds]
      ),
      computeDerivedStatuses(productIds, orgId, categoryMap),
    ]);

    // Group by product
    const obByProduct: Record<string, any[]> = {};
    for (const row of obResult.rows) {
      if (!obByProduct[row.product_id]) obByProduct[row.product_id] = [];
      const derived = derivedMap[row.product_id]?.[row.obligation_key] ?? null;
      obByProduct[row.product_id].push(enrichObligation(row, derived));
    }

    let totalCompleted = 0, totalInProgress = 0, totalNotStarted = 0;

    const enrichedProducts = products.map(p => {
      const obligations = obByProduct[p.id] || [];
      // Use effectiveStatus (max of manual and derived) for counts
      const completed = obligations.filter(o => o.effectiveStatus === 'met').length;
      const inProgress = obligations.filter(o => o.effectiveStatus === 'in_progress').length;
      const notStarted = obligations.filter(o => o.effectiveStatus === 'not_started').length;
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

    // Auto-create obligations and fetch derived statuses in parallel
    await ensureObligations(orgId, productId, craCategory);

    const [obResult, derivedMap] = await Promise.all([
      pool.query(
        `SELECT id, product_id, obligation_key, status, notes, updated_by, updated_at
         FROM obligations WHERE org_id = $1 AND product_id = $2
         ORDER BY created_at ASC`,
        [orgId, productId]
      ),
      computeDerivedStatuses([productId], orgId, { [productId]: craCategory }),
    ]);

    const productDerived = derivedMap[productId] ?? {};
    const obligations = obResult.rows.map(row => enrichObligation(row, productDerived[row.obligation_key] ?? null));

    // Use effectiveStatus for counts
    const completed = obligations.filter(o => o.effectiveStatus === 'met').length;
    const inProgress = obligations.filter(o => o.effectiveStatus === 'in_progress').length;
    const notStarted = obligations.filter(o => o.effectiveStatus === 'not_started').length;

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

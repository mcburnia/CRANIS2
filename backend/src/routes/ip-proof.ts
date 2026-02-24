import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { verifySessionToken } from '../utils/token.js';
import { createSnapshot, verifySnapshot, exportProofPackage } from '../services/ip-proof.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';
import neo4j from 'neo4j-driver';

const router = Router();

const neo4jDriver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://neo4j:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'cranis2_dev_2026'
  )
);

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
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

async function getOrgId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.org_id || null;
}

// GET /overview — cross-product IP proof summary
router.get('/overview', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(400).json({ error: 'No organisation' }); return; }

    // Get all products from Neo4j
    const session = neo4jDriver.session({ defaultAccessMode: neo4j.session.READ });
    let products: Array<{ id: string; name: string }> = [];
    try {
      const result = await session.run(
        `MATCH (p:Product)-[:BELONGS_TO]->(o:Organisation {id: $orgId}) RETURN p.id AS id, p.name AS name`,
        { orgId }
      );
      products = result.records.map(r => ({ id: r.get('id'), name: r.get('name') }));
    } finally {
      await session.close();
    }

    // Get snapshot counts and latest per product
    const snapshotsResult = await pool.query(
      `SELECT product_id,
         COUNT(*) AS total_snapshots,
         MAX(created_at) AS latest_snapshot,
         COUNT(*) FILTER (WHERE verified = TRUE) AS verified_count,
         COUNT(*) FILTER (WHERE rfc3161_token IS NOT NULL) AS rfc3161_count,
         COUNT(*) FILTER (WHERE ots_bitcoin_block IS NOT NULL) AS ots_confirmed_count
       FROM ip_proof_snapshots
       WHERE org_id = $1
       GROUP BY product_id`,
      [orgId]
    );

    const snapshotsByProduct = new Map(snapshotsResult.rows.map(r => [r.product_id, r]));

    // Aggregate totals
    let totalSnapshots = 0, totalVerified = 0, totalRfc3161 = 0, totalOtsConfirmed = 0;
    let latestProof: string | null = null;
    let productsProtected = 0;

    const productSummaries = products.map(p => {
      const snap = snapshotsByProduct.get(p.id);
      if (snap) {
        const count = parseInt(snap.total_snapshots);
        totalSnapshots += count;
        totalVerified += parseInt(snap.verified_count);
        totalRfc3161 += parseInt(snap.rfc3161_count);
        totalOtsConfirmed += parseInt(snap.ots_confirmed_count);
        if (count > 0) productsProtected++;
        if (!latestProof || snap.latest_snapshot > latestProof) {
          latestProof = snap.latest_snapshot;
        }
      }

      return {
        productId: p.id,
        productName: p.name,
        totalSnapshots: snap ? parseInt(snap.total_snapshots) : 0,
        latestSnapshot: snap?.latest_snapshot || null,
        hasRfc3161: snap ? parseInt(snap.rfc3161_count) > 0 : false,
        otsConfirmed: snap ? parseInt(snap.ots_confirmed_count) > 0 : false,
        verifiedCount: snap ? parseInt(snap.verified_count) : 0
      };
    });

    res.json({
      totals: {
        totalSnapshots,
        latestProof,
        productsProtected,
        totalRfc3161,
        totalOtsConfirmed,
        totalVerified
      },
      products: productSummaries
    });
  } catch (err) {
    console.error('Failed to get IP proof overview:', err);
    res.status(500).json({ error: 'Failed to get overview' });
  }
});

// POST /:productId/snapshot — create timestamped snapshot
router.post('/:productId/snapshot', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const email = (req as any).email;
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(400).json({ error: 'No organisation' }); return; }

    const productId = req.params.productId as string;
    const { snapshotType } = req.body;

    // Verify product belongs to org
    const session = neo4jDriver.session({ defaultAccessMode: neo4j.session.READ });
    try {
      const check = await session.run(
        `MATCH (p:Product {id: $productId})-[:BELONGS_TO]->(o:Organisation {id: $orgId}) RETURN p.id`,
        { productId, orgId }
      );
      if (check.records.length === 0) { res.status(404).json({ error: 'Product not found' }); return; }
    } finally {
      await session.close();
    }

    const result = await createSnapshot(
      productId,
      orgId,
      userId,
      snapshotType || 'manual'
    );

    const reqData = extractRequestData(req);
    await recordEvent({
      userId, email,
      eventType: 'ip_proof_created',
      ...reqData,
      metadata: { snapshotId: result.snapshotId, productId, contentHash: result.contentHash }
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('Failed to create snapshot:', err);
    res.status(500).json({ error: 'Failed to create snapshot' });
  }
});

// GET /:productId/snapshots — list snapshots for a product
router.get('/:productId/snapshots', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(400).json({ error: 'No organisation' }); return; }

    const productId = req.params.productId as string;

    const result = await pool.query(
      `SELECT id, snapshot_type, content_hash, content_summary,
              rfc3161_tsa_url, rfc3161_token IS NOT NULL AS has_rfc3161,
              ots_bitcoin_block, ots_confirmed_at,
              verified, created_at, created_by
       FROM ip_proof_snapshots
       WHERE product_id = $1 AND org_id = $2
       ORDER BY created_at DESC`,
      [productId, orgId]
    );

    // Enrich with creator names
    const userIds = [...new Set(result.rows.map(r => r.created_by).filter(Boolean))];
    let userMap = new Map<string, string>();
    if (userIds.length > 0) {
      const users = await pool.query(`SELECT id, email FROM users WHERE id = ANY($1)`, [userIds]);
      userMap = new Map(users.rows.map(u => [u.id, u.email]));
    }

    const snapshots = result.rows.map(r => ({
      ...r,
      createdByEmail: userMap.get(r.created_by) || null
    }));

    res.json({ snapshots });
  } catch (err) {
    console.error('Failed to list snapshots:', err);
    res.status(500).json({ error: 'Failed to list snapshots' });
  }
});

// GET /snapshot/:id — snapshot detail (static route before :productId)
router.get('/snapshot/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(400).json({ error: 'No organisation' }); return; }

    const snapshotId = req.params.id as string;

    const result = await pool.query(
      `SELECT id, product_id, snapshot_type, content_hash, content_summary,
              rfc3161_tsa_url, rfc3161_token IS NOT NULL AS has_rfc3161,
              LENGTH(rfc3161_token) AS rfc3161_size,
              ots_bitcoin_block, ots_confirmed_at, ots_proof IS NOT NULL AS has_ots,
              verified, created_at, created_by
       FROM ip_proof_snapshots
       WHERE id = $1 AND org_id = $2`,
      [snapshotId, orgId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Snapshot not found' });
      return;
    }

    // Get product name
    const session = neo4jDriver.session({ defaultAccessMode: neo4j.session.READ });
    let productName = '';
    try {
      const pResult = await session.run(
        `MATCH (p:Product {id: $productId}) RETURN p.name AS name`,
        { productId: result.rows[0].product_id }
      );
      productName = pResult.records[0]?.get('name') || '';
    } finally {
      await session.close();
    }

    // Get creator email
    let createdByEmail = null;
    if (result.rows[0].created_by) {
      const user = await pool.query(`SELECT email FROM users WHERE id = $1`, [result.rows[0].created_by]);
      createdByEmail = user.rows[0]?.email || null;
    }

    res.json({
      snapshot: {
        ...result.rows[0],
        productName,
        createdByEmail
      }
    });
  } catch (err) {
    console.error('Failed to get snapshot detail:', err);
    res.status(500).json({ error: 'Failed to get snapshot' });
  }
});

// POST /snapshot/:id/verify — re-verify a snapshot
router.post('/snapshot/:id/verify', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(400).json({ error: 'No organisation' }); return; }

    const snapshotId = req.params.id as string;

    // Verify ownership
    const check = await pool.query(
      `SELECT id FROM ip_proof_snapshots WHERE id = $1 AND org_id = $2`,
      [snapshotId, orgId]
    );
    if (check.rows.length === 0) { res.status(404).json({ error: 'Snapshot not found' }); return; }

    const result = await verifySnapshot(snapshotId);

    res.json(result);
  } catch (err) {
    console.error('Failed to verify snapshot:', err);
    res.status(500).json({ error: 'Failed to verify snapshot' });
  }
});

// GET /snapshot/:id/export — download proof package ZIP
router.get('/snapshot/:id/export', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const email = (req as any).email;
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(400).json({ error: 'No organisation' }); return; }

    const snapshotId = req.params.id as string;

    // Verify ownership
    const check = await pool.query(
      `SELECT id, content_hash FROM ip_proof_snapshots WHERE id = $1 AND org_id = $2`,
      [snapshotId, orgId]
    );
    if (check.rows.length === 0) { res.status(404).json({ error: 'Snapshot not found' }); return; }

    const zipBuffer = await exportProofPackage(snapshotId);
    if (!zipBuffer) { res.status(404).json({ error: 'Failed to generate proof package' }); return; }

    const reqData = extractRequestData(req);
    await recordEvent({
      userId, email,
      eventType: 'ip_proof_exported',
      ...reqData,
      metadata: { snapshotId }
    });

    const hash = check.rows[0].content_hash.substring(0, 8);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="ip-proof-${hash}.zip"`);
    res.send(zipBuffer);
  } catch (err) {
    console.error('Failed to export proof package:', err);
    res.status(500).json({ error: 'Failed to export proof package' });
  }
});

export default router;

/**
 * Compliance Snapshots API — P8 #40
 *
 * POST   /api/products/:productId/compliance-snapshots          — generate a new snapshot
 * GET    /api/products/:productId/compliance-snapshots          — list snapshots
 * GET    /api/products/:productId/compliance-snapshots/:id/download — download ZIP
 * DELETE /api/products/:productId/compliance-snapshots/:id      — delete snapshot
 */

import { Router, Request, Response } from 'express';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
import { generateComplianceSnapshot, deleteSnapshotFile, getSnapshotPath } from '../services/compliance-snapshot.js';
import { logProductActivity } from '../services/activity-log.js';

const router = Router();

// ─── Auth middleware ──────────────────────────────────────────
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

async function verifyProductOwnership(orgId: string, productId: string): Promise<string | null> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p.name AS name`,
      { orgId, productId }
    );
    return result.records.length > 0 ? result.records[0].get('name') : null;
  } finally {
    await session.close();
  }
}

// ─── POST /api/products/:productId/compliance-snapshots ──────
// Generate a new compliance snapshot
router.post('/:productId/compliance-snapshots', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).email;
  const productId = req.params.productId as string;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const productName = await verifyProductOwnership(orgId, productId);
    if (!productName) { res.status(404).json({ error: 'Product not found' }); return; }

    // Create the snapshot record first (status = 'generating')
    const insertResult = await pool.query(
      `INSERT INTO compliance_snapshots (org_id, product_id, created_by, filename, status)
       VALUES ($1, $2, $3, 'pending', 'generating')
       RETURNING id, created_at`,
      [orgId, productId, userId]
    );
    const snapshotId = insertResult.rows[0].id;
    const createdAt = insertResult.rows[0].created_at;

    // Return immediately with the snapshot record — generation happens async
    res.status(202).json({
      id: snapshotId,
      productId,
      status: 'generating',
      createdAt,
    });

    // Generate in the background
    try {
      const result = await generateComplianceSnapshot(orgId, productId, userId, snapshotId);

      await pool.query(
        `UPDATE compliance_snapshots
         SET filename = $1, size_bytes = $2, content_hash = $3, status = 'complete', metadata = $4
         WHERE id = $5`,
        [result.filename, result.sizeBytes, result.contentHash, JSON.stringify(result.metadata), snapshotId]
      );

      // Activity log
      logProductActivity({
        productId, orgId, userId, userEmail,
        action: 'compliance_snapshot_generated',
        entityType: 'compliance_snapshot',
        entityId: snapshotId,
        summary: `Generated compliance snapshot (${(result.sizeBytes / 1024).toFixed(0)} KB)`,
        metadata: { filename: result.filename, sizeBytes: result.sizeBytes, contentHash: result.contentHash },
      }).catch(() => {});

    } catch (err: any) {
      console.error('[COMPLIANCE-SNAPSHOT] Generation failed:', err);
      await pool.query(
        `UPDATE compliance_snapshots SET status = 'failed', error_message = $1 WHERE id = $2`,
        [err.message || 'Unknown error', snapshotId]
      );
    }
  } catch (err: any) {
    console.error('[COMPLIANCE-SNAPSHOT] Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to initiate snapshot generation' });
    }
  }
});

// ─── GET /api/products/:productId/compliance-snapshots ───────
// List all snapshots for a product
router.get('/:productId/compliance-snapshots', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const productId = req.params.productId as string;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const productName = await verifyProductOwnership(orgId, productId);
    if (!productName) { res.status(404).json({ error: 'Product not found' }); return; }

    const result = await pool.query(
      `SELECT cs.id, cs.filename, cs.size_bytes, cs.content_hash, cs.status, cs.error_message,
              cs.metadata, cs.created_at, u.email AS created_by_email
       FROM compliance_snapshots cs
       LEFT JOIN users u ON u.id = cs.created_by
       WHERE cs.product_id = $1 AND cs.org_id = $2
       ORDER BY cs.created_at DESC`,
      [productId, orgId]
    );

    res.json({ snapshots: result.rows });
  } catch (err: any) {
    console.error('[COMPLIANCE-SNAPSHOT] List error:', err);
    res.status(500).json({ error: 'Failed to list snapshots' });
  }
});

// ─── GET /api/products/:productId/compliance-snapshots/:id/download ──
// Download a snapshot ZIP
router.get('/:productId/compliance-snapshots/:snapshotId/download', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const productId = req.params.productId as string;
  const snapshotId = req.params.snapshotId as string;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const productName = await verifyProductOwnership(orgId, productId);
    if (!productName) { res.status(404).json({ error: 'Product not found' }); return; }

    const result = await pool.query(
      `SELECT filename, status FROM compliance_snapshots
       WHERE id = $1 AND product_id = $2 AND org_id = $3`,
      [snapshotId, productId, orgId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Snapshot not found' });
      return;
    }

    const { filename, status } = result.rows[0];
    if (status !== 'complete') {
      res.status(409).json({ error: 'Snapshot is not ready for download', status });
      return;
    }

    const filepath = getSnapshotPath(orgId, productId, filename);

    try {
      const fileStats = await stat(filepath);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', fileStats.size);

      const readStream = createReadStream(filepath);
      readStream.pipe(res);
      readStream.on('error', (err) => {
        console.error('[COMPLIANCE-SNAPSHOT] File read error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to read snapshot file' });
        }
      });
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        res.status(404).json({ error: 'Snapshot file not found on disk' });
      } else {
        throw err;
      }
    }
  } catch (err: any) {
    console.error('[COMPLIANCE-SNAPSHOT] Download error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download snapshot' });
    }
  }
});

// ─── GET /api/products/:productId/compliance-snapshots/:id/status ──
// Check generation status (for polling)
router.get('/:productId/compliance-snapshots/:snapshotId/status', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const productId = req.params.productId as string;
  const snapshotId = req.params.snapshotId as string;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const result = await pool.query(
      `SELECT id, status, filename, size_bytes, content_hash, error_message, metadata, created_at
       FROM compliance_snapshots
       WHERE id = $1 AND product_id = $2 AND org_id = $3`,
      [snapshotId, productId, orgId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Snapshot not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('[COMPLIANCE-SNAPSHOT] Status error:', err);
    res.status(500).json({ error: 'Failed to check snapshot status' });
  }
});

// ─── DELETE /api/products/:productId/compliance-snapshots/:id ──
// Delete a snapshot (record + file)
router.delete('/:productId/compliance-snapshots/:snapshotId', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).email;
  const productId = req.params.productId as string;
  const snapshotId = req.params.snapshotId as string;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const productName = await verifyProductOwnership(orgId, productId);
    if (!productName) { res.status(404).json({ error: 'Product not found' }); return; }

    const result = await pool.query(
      'SELECT filename FROM compliance_snapshots WHERE id = $1 AND product_id = $2 AND org_id = $3',
      [snapshotId, productId, orgId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Snapshot not found' });
      return;
    }

    const { filename } = result.rows[0];

    // Delete file from disk
    await deleteSnapshotFile(orgId, productId, filename);

    // Delete DB record
    await pool.query('DELETE FROM compliance_snapshots WHERE id = $1', [snapshotId]);

    // Activity log
    logProductActivity({
      productId, orgId, userId, userEmail,
      action: 'compliance_snapshot_deleted',
      entityType: 'compliance_snapshot',
      entityId: snapshotId,
      summary: `Deleted compliance snapshot ${filename}`,
    }).catch(() => {});

    res.json({ success: true });
  } catch (err: any) {
    console.error('[COMPLIANCE-SNAPSHOT] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete snapshot' });
  }
});

export default router;

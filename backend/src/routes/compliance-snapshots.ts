/**
 * Compliance Snapshots API – P8 #40 + #42
 *
 * POST   /api/products/:productId/compliance-snapshots          – generate a new snapshot
 * GET    /api/products/:productId/compliance-snapshots          – list snapshots
 * GET    /api/products/:productId/compliance-snapshots/:id/download – download ZIP
 * GET    /api/products/:productId/compliance-snapshots/:id/status   – poll generation status
 * DELETE /api/products/:productId/compliance-snapshots/:id      – delete snapshot
 */

import { Router, Request, Response } from 'express';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
import { generateComplianceSnapshot, deleteSnapshotFile, getSnapshotPath } from '../services/compliance-snapshot.js';
import { uploadToGlacier, deleteFromGlacier } from '../services/cold-storage.js';
import { logProductActivity } from '../services/activity-log.js';
import { createLedgerEntry } from '../services/retention-ledger.js';
import { logger } from '../utils/logger.js';

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

    // Return immediately with the snapshot record – generation happens async
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
         SET filename = $1, size_bytes = $2, content_hash = $3, status = 'complete', metadata = $4,
             rfc3161_token = $6, rfc3161_tsa_url = $7, rfc3161_timestamp = CASE WHEN $6 IS NOT NULL THEN NOW() ELSE NULL END,
             signature = $8, signature_algorithm = $9, signature_key_id = $10
         WHERE id = $5`,
        [result.filename, result.sizeBytes, result.contentHash, JSON.stringify(result.metadata), snapshotId,
         result.rfc3161Token, result.rfc3161TsaUrl,
         result.signature, result.signatureAlgorithm, result.signatureKeyId]
      );

      // Activity log
      logProductActivity({
        productId, orgId, userId, userEmail,
        action: 'compliance_snapshot_generated',
        entityType: 'compliance_snapshot',
        entityId: snapshotId,
        summary: `Generated compliance snapshot (${(result.sizeBytes / 1024).toFixed(0)} KB)${result.rfc3161Token ? ' – RFC 3161 timestamped' : ''}${result.signature ? ' – CRANIS2 signed' : ''}`,
        metadata: { filename: result.filename, sizeBytes: result.sizeBytes, contentHash: result.contentHash, rfc3161: !!result.rfc3161Token, signed: !!result.signature },
      }).catch(() => {});

      // Upload to Glacier cold storage in background (non-blocking)
      uploadToGlacier(orgId, productId, result.filename, result.filepath, snapshotId)
        .catch(err => console.error('[COMPLIANCE-SNAPSHOT] Glacier upload failed:', err));

      // Create retention reserve ledger entry + funding certificate (non-blocking)
      createLedgerEntry({
        orgId, productId, snapshotId,
        archiveHash: result.contentHash,
        archiveSizeBytes: result.sizeBytes,
        releaseVersion: null,
        coldStorageKey: `${orgId}/${productId}/${result.filename}`,
      }).catch(err => console.error('[COMPLIANCE-SNAPSHOT] Ledger entry failed:', err));

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
              cs.metadata, cs.cold_storage_status, cs.cold_storage_uploaded_at,
              cs.rfc3161_tsa_url, cs.rfc3161_timestamp,
              cs.trigger_type, cs.release_version,
              cs.signature_algorithm, cs.signature_key_id,
              cs.retention_end_date, cs.legal_hold,
              cs.created_at, u.email AS created_by_email
       FROM compliance_snapshots cs
       LEFT JOIN users u ON u.id = cs.created_by
       WHERE cs.product_id = $1 AND cs.org_id = $2
       ORDER BY cs.created_at DESC`,
      [productId, orgId]
    );

    const snapshots = result.rows.map(row => ({
      ...row,
      rfc3161_timestamped: !!row.rfc3161_timestamp,
      cranis2_signed: !!row.signature_algorithm,
      retention_active: row.retention_end_date ? new Date(row.retention_end_date) > new Date() : false,
    }));

    res.json({ snapshots });
  } catch (err: any) {
    console.error('[COMPLIANCE-SNAPSHOT] List error:', err);
    res.status(500).json({ error: 'Failed to list snapshots' });
  }
});

// ─── GET /api/products/:productId/compliance-snapshots/:id/download ──
// Download a snapshot ZIP (available for 24 hours after generation)
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
        // Local file has been purged (24-hour expiry) – archived to cold storage
        res.status(410).json({
          error: 'Snapshot expired',
          message: 'This snapshot is no longer available for download. Local copies are retained for 24 hours after generation. The archive has been preserved in cold storage for audit purposes. Please generate a new snapshot if needed.',
        });
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
      `SELECT id, status, filename, size_bytes, content_hash, error_message, metadata,
              cold_storage_status, cold_storage_uploaded_at,
              rfc3161_tsa_url, rfc3161_timestamp,
              signature_algorithm, signature_key_id,
              retention_end_date, legal_hold,
              created_at
       FROM compliance_snapshots
       WHERE id = $1 AND product_id = $2 AND org_id = $3`,
      [snapshotId, productId, orgId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Snapshot not found' });
      return;
    }

    const row = result.rows[0];
    res.json({
      ...row,
      rfc3161_timestamped: !!row.rfc3161_timestamp,
      cranis2_signed: !!row.signature_algorithm,
      retention_active: row.retention_end_date ? new Date(row.retention_end_date) > new Date() : false,
    });
  } catch (err: any) {
    console.error('[COMPLIANCE-SNAPSHOT] Status error:', err);
    res.status(500).json({ error: 'Failed to check snapshot status' });
  }
});

// ─── DELETE /api/products/:productId/compliance-snapshots/:id ──
// Delete a snapshot (record + local file + cold storage)
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
      'SELECT filename, cold_storage_status, retention_end_date, legal_hold FROM compliance_snapshots WHERE id = $1 AND product_id = $2 AND org_id = $3',
      [snapshotId, productId, orgId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Snapshot not found' });
      return;
    }

    const { filename, cold_storage_status, retention_end_date, legal_hold } = result.rows[0];

    // Block deletion if under legal hold
    if (legal_hold) {
      res.status(409).json({
        error: 'Snapshot under legal hold',
        message: 'This compliance snapshot is under legal hold and cannot be deleted. Contact a platform administrator to release the hold.',
      });
      return;
    }

    // Block deletion if retention period is still active
    if (retention_end_date) {
      const endDate = new Date(retention_end_date);
      if (endDate > new Date()) {
        res.status(409).json({
          error: 'Retention period active',
          message: `This compliance snapshot is protected under CRA Art. 13(10) retention until ${endDate.toISOString().split('T')[0]}. Deletion is not permitted while the retention period is active.`,
          retentionEndDate: endDate.toISOString().split('T')[0],
        });
        return;
      }
    }

    // Delete local file (best-effort – may already be purged)
    await deleteSnapshotFile(orgId, productId, filename);

    // Delete from Glacier if uploaded
    if (cold_storage_status === 'archived') {
      deleteFromGlacier(orgId, productId, filename)
        .catch(err => console.error('[COMPLIANCE-SNAPSHOT] Glacier delete failed:', err));
    }

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

// ─── GET /api/products/:productId/snapshot-schedule ──────────
// Get the snapshot schedule for a product
router.get('/:productId/snapshot-schedule', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const productId = req.params.productId as string;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const productName = await verifyProductOwnership(orgId, productId);
    if (!productName) { res.status(404).json({ error: 'Product not found' }); return; }

    const result = await pool.query(
      `SELECT id, schedule_type, enabled, next_run_date, last_run_at, last_snapshot_id, created_at, updated_at
       FROM snapshot_schedules
       WHERE org_id = $1 AND product_id = $2`,
      [orgId, productId]
    );

    res.json({ schedule: result.rows[0] || null });
  } catch (err: any) {
    console.error('[SNAPSHOT-SCHEDULE] Get error:', err);
    res.status(500).json({ error: 'Failed to get snapshot schedule' });
  }
});

// ─── PUT /api/products/:productId/snapshot-schedule ──────────
// Create or update the snapshot schedule for a product
router.put('/:productId/snapshot-schedule', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const productId = req.params.productId as string;
  const { schedule_type, enabled } = req.body;

  const validTypes = ['quarterly', 'monthly', 'weekly'];
  if (schedule_type && !validTypes.includes(schedule_type)) {
    res.status(400).json({ error: `Invalid schedule_type. Must be one of: ${validTypes.join(', ')}` });
    return;
  }

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const productName = await verifyProductOwnership(orgId, productId);
    if (!productName) { res.status(404).json({ error: 'Product not found' }); return; }

    const type = schedule_type || 'quarterly';
    const isEnabled = enabled !== false;
    const nextRunDate = calculateNextRunDate(type);

    const result = await pool.query(
      `INSERT INTO snapshot_schedules (org_id, product_id, schedule_type, enabled, next_run_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (org_id, product_id) DO UPDATE
       SET schedule_type = $3, enabled = $4,
           next_run_date = CASE WHEN EXCLUDED.enabled THEN $5 ELSE snapshot_schedules.next_run_date END,
           updated_at = NOW()
       RETURNING id, schedule_type, enabled, next_run_date, last_run_at, last_snapshot_id, created_at, updated_at`,
      [orgId, productId, type, isEnabled, nextRunDate, userId]
    );

    logProductActivity({
      productId, orgId, userId, userEmail: (req as any).email || '',
      action: 'snapshot_schedule_updated',
      entityType: 'snapshot_schedule',
      entityId: result.rows[0].id,
      summary: `${isEnabled ? 'Enabled' : 'Disabled'} ${type} compliance snapshot schedule`,
      metadata: { scheduleType: type, enabled: isEnabled, nextRunDate },
    }).catch(() => {});

    res.json({ schedule: result.rows[0] });
  } catch (err: any) {
    console.error('[SNAPSHOT-SCHEDULE] Update error:', err);
    res.status(500).json({ error: 'Failed to update snapshot schedule' });
  }
});

// ─── DELETE /api/products/:productId/snapshot-schedule ────────
// Remove the snapshot schedule for a product
router.delete('/:productId/snapshot-schedule', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const productId = req.params.productId as string;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const productName = await verifyProductOwnership(orgId, productId);
    if (!productName) { res.status(404).json({ error: 'Product not found' }); return; }

    const result = await pool.query(
      'DELETE FROM snapshot_schedules WHERE org_id = $1 AND product_id = $2 RETURNING id',
      [orgId, productId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'No schedule found' });
      return;
    }

    logProductActivity({
      productId, orgId, userId, userEmail: (req as any).email || '',
      action: 'snapshot_schedule_deleted',
      entityType: 'snapshot_schedule',
      entityId: result.rows[0].id,
      summary: 'Removed compliance snapshot schedule',
    }).catch(() => {});

    res.json({ success: true });
  } catch (err: any) {
    console.error('[SNAPSHOT-SCHEDULE] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete snapshot schedule' });
  }
});

/** Calculate the next run date for a given schedule type */
function calculateNextRunDate(scheduleType: string): string {
  const now = new Date();
  switch (scheduleType) {
    case 'weekly': {
      const next = new Date(now);
      next.setDate(next.getDate() + 7);
      return next.toISOString().split('T')[0];
    }
    case 'monthly': {
      const next = new Date(now);
      next.setMonth(next.getMonth() + 1);
      next.setDate(1); // 1st of next month
      return next.toISOString().split('T')[0];
    }
    case 'quarterly':
    default: {
      const next = new Date(now);
      const currentQuarter = Math.floor(next.getMonth() / 3);
      next.setMonth((currentQuarter + 1) * 3); // 1st month of next quarter
      next.setDate(1);
      return next.toISOString().split('T')[0];
    }
  }
}

export { calculateNextRunDate };

export default router;

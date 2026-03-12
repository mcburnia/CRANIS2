/**
 * Admin Retention Ledger API — P8 Phase D
 *
 * GET    /api/admin/retention-ledger          — list all ledger entries (filterable)
 * GET    /api/admin/retention-ledger/summary  — aggregate totals
 * PUT    /api/admin/retention-ledger/:id/wise-ref — record Wise transaction reference
 * GET    /api/admin/retention-ledger/:id/certificate — download funding certificate
 */

import { Router, Request, Response } from 'express';
import pool from '../../db/pool.js';
import { requirePlatformAdmin } from '../../middleware/requirePlatformAdmin.js';

const router = Router();

// ─── GET /api/admin/retention-ledger ──────────────────────────
// List all retention ledger entries, with optional filters
router.get('/retention-ledger', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { org_id, product_id, status } = req.query;

    let query = `
      SELECT rl.*,
             cs.filename AS snapshot_filename,
             cs.cold_storage_status
      FROM retention_reserve_ledger rl
      LEFT JOIN compliance_snapshots cs ON cs.id = rl.snapshot_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (org_id) {
      params.push(org_id);
      query += ` AND rl.org_id = $${params.length}`;
    }
    if (product_id) {
      params.push(product_id);
      query += ` AND rl.product_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND rl.status = $${params.length}`;
    }

    query += ` ORDER BY rl.created_at DESC`;

    const result = await pool.query(query, params);
    res.json({ entries: result.rows, total: result.rows.length });
  } catch (err: any) {
    console.error('[ADMIN-RETENTION] List error:', err);
    res.status(500).json({ error: 'Failed to list retention ledger' });
  }
});

// ─── GET /api/admin/retention-ledger/summary ──────────────────
// Aggregate summary: total allocated, total funded, outstanding
router.get('/retention-ledger/summary', requirePlatformAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) AS total_entries,
        COUNT(*) FILTER (WHERE status = 'allocated') AS allocated_count,
        COUNT(*) FILTER (WHERE status = 'funded') AS funded_count,
        COUNT(*) FILTER (WHERE status = 'released') AS released_count,
        COALESCE(SUM(estimated_cost_eur), 0) AS total_estimated_cost,
        COALESCE(SUM(funded_amount_eur), 0) AS total_funded_amount,
        COALESCE(SUM(funded_amount_eur) FILTER (WHERE status = 'allocated'), 0) AS outstanding_amount,
        COALESCE(SUM(funded_amount_eur) FILTER (WHERE wise_transaction_ref IS NOT NULL), 0) AS transferred_amount,
        COALESCE(SUM(archive_size_bytes), 0) AS total_archive_bytes,
        COUNT(DISTINCT org_id) AS org_count,
        COUNT(DISTINCT product_id) AS product_count
      FROM retention_reserve_ledger
    `);

    const row = result.rows[0];
    res.json({
      totalEntries: parseInt(row.total_entries),
      allocatedCount: parseInt(row.allocated_count),
      fundedCount: parseInt(row.funded_count),
      releasedCount: parseInt(row.released_count),
      totalEstimatedCost: parseFloat(row.total_estimated_cost),
      totalFundedAmount: parseFloat(row.total_funded_amount),
      outstandingAmount: parseFloat(row.outstanding_amount),
      transferredAmount: parseFloat(row.transferred_amount),
      totalArchiveBytes: parseInt(row.total_archive_bytes),
      orgCount: parseInt(row.org_count),
      productCount: parseInt(row.product_count),
    });
  } catch (err: any) {
    console.error('[ADMIN-RETENTION] Summary error:', err);
    res.status(500).json({ error: 'Failed to get retention summary' });
  }
});

// ─── PUT /api/admin/retention-ledger/:id/wise-ref ─────────────
// Record a Wise transaction reference after manual quarterly transfer
router.put('/retention-ledger/:id/wise-ref', requirePlatformAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { wise_transaction_ref, notes } = req.body;

  if (!wise_transaction_ref) {
    res.status(400).json({ error: 'wise_transaction_ref is required' });
    return;
  }

  try {
    const result = await pool.query(
      `UPDATE retention_reserve_ledger
       SET wise_transaction_ref = $1, status = 'funded', notes = COALESCE($2, notes), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [wise_transaction_ref, notes || null, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Ledger entry not found' });
      return;
    }

    res.json({ entry: result.rows[0] });
  } catch (err: any) {
    console.error('[ADMIN-RETENTION] Update wise ref error:', err);
    res.status(500).json({ error: 'Failed to update Wise reference' });
  }
});

// ─── GET /api/admin/retention-ledger/:id/certificate ──────────
// Download the funding certificate for a ledger entry
router.get('/retention-ledger/:id/certificate', requirePlatformAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT rl.*, cs.filename AS snapshot_filename
       FROM retention_reserve_ledger rl
       LEFT JOIN compliance_snapshots cs ON cs.id = rl.snapshot_id
       WHERE rl.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Ledger entry not found' });
      return;
    }

    const entry = result.rows[0];

    if (!entry.certificate_hash) {
      res.status(404).json({ error: 'No certificate generated for this entry' });
      return;
    }

    // Regenerate the certificate from the stored data
    // (The certificate content is deterministic from the ledger entry data,
    //  but for now we return the metadata. Full certificate re-generation
    //  would require storing the certificate content or regenerating it.)
    res.json({
      ledgerId: entry.id,
      certificateHash: entry.certificate_hash,
      orgId: entry.org_id,
      productId: entry.product_id,
      snapshotId: entry.snapshot_id,
      archiveHash: entry.archive_hash,
      archiveSizeBytes: parseInt(entry.archive_size_bytes),
      estimatedCostEur: parseFloat(entry.estimated_cost_eur),
      fundedAmountEur: parseFloat(entry.funded_amount_eur),
      costingModelVersion: entry.costing_model_version,
      retentionStartDate: entry.retention_start_date,
      retentionEndDate: entry.retention_end_date,
      wiseTransactionRef: entry.wise_transaction_ref,
      status: entry.status,
      createdAt: entry.created_at,
    });
  } catch (err: any) {
    console.error('[ADMIN-RETENTION] Certificate error:', err);
    res.status(500).json({ error: 'Failed to get certificate' });
  }
});

export default router;

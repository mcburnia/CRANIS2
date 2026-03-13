/**
 * Admin Retention Ledger API — P8 Phase D
 *
 * GET    /api/admin/retention-ledger          — list all ledger entries (filterable)
 * GET    /api/admin/retention-ledger/summary  — aggregate totals
 * PUT    /api/admin/retention-ledger/:id/wise-ref — record Wise transaction reference
 * PUT    /api/admin/retention-ledger/bulk-fund — bulk-fund multiple allocated entries
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

// ─── PUT /api/admin/retention-ledger/bulk-fund ────────────────
// Bulk-fund multiple allocated entries with a single Wise transaction reference
router.put('/retention-ledger/bulk-fund', requirePlatformAdmin, async (req: Request, res: Response) => {
  const { entry_ids, wise_transaction_ref } = req.body;

  if (!wise_transaction_ref || typeof wise_transaction_ref !== 'string' || !wise_transaction_ref.trim()) {
    res.status(400).json({ error: 'wise_transaction_ref is required' });
    return;
  }
  if (!Array.isArray(entry_ids) || entry_ids.length === 0) {
    res.status(400).json({ error: 'entry_ids must be a non-empty array' });
    return;
  }
  if (entry_ids.length > 500) {
    res.status(400).json({ error: 'Maximum 500 entries per bulk operation' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE retention_reserve_ledger
       SET wise_transaction_ref = $1, status = 'funded', updated_at = NOW()
       WHERE id = ANY($2::uuid[]) AND status = 'allocated'
       RETURNING id`,
      [wise_transaction_ref.trim(), entry_ids]
    );

    await client.query('COMMIT');

    res.json({
      funded: result.rows.length,
      requested: entry_ids.length,
      wise_transaction_ref: wise_transaction_ref.trim(),
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[ADMIN-RETENTION] Bulk fund error:', err);
    res.status(500).json({ error: 'Failed to bulk-fund entries' });
  } finally {
    client.release();
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

// ─── PUT /api/admin/retention-ledger/:snapshotId/legal-hold ───
// Toggle legal hold on a compliance snapshot
router.put('/retention-ledger/:snapshotId/legal-hold', requirePlatformAdmin, async (req: Request, res: Response) => {
  const { snapshotId } = req.params;
  const { legal_hold } = req.body;

  if (typeof legal_hold !== 'boolean') {
    res.status(400).json({ error: 'legal_hold must be a boolean' });
    return;
  }

  try {
    const result = await pool.query(
      `UPDATE compliance_snapshots SET legal_hold = $1 WHERE id = $2
       RETURNING id, product_id, org_id, legal_hold, retention_end_date`,
      [legal_hold, snapshotId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Snapshot not found' });
      return;
    }

    res.json({ snapshot: result.rows[0] });
  } catch (err: any) {
    console.error('[ADMIN-RETENTION] Legal hold error:', err);
    res.status(500).json({ error: 'Failed to update legal hold' });
  }
});

// ─── GET /api/admin/retention-ledger/expiry-warnings ─────────
// Snapshots with retention ending within 90 days
router.get('/retention-ledger/expiry-warnings', requirePlatformAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT cs.id, cs.product_id, cs.org_id, cs.filename, cs.retention_end_date,
              cs.legal_hold, cs.cold_storage_status, cs.status, cs.created_at,
              rl.estimated_cost_eur, rl.funded_amount_eur, rl.status AS ledger_status
       FROM compliance_snapshots cs
       LEFT JOIN retention_reserve_ledger rl ON rl.snapshot_id = cs.id
       WHERE cs.retention_end_date IS NOT NULL
         AND cs.retention_end_date <= CURRENT_DATE + INTERVAL '90 days'
         AND cs.retention_end_date >= CURRENT_DATE
         AND cs.status = 'complete'
       ORDER BY cs.retention_end_date ASC`
    );

    res.json({
      warnings: result.rows.map(row => ({
        ...row,
        days_until_expiry: Math.ceil((new Date(row.retention_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      })),
      total: result.rows.length,
    });
  } catch (err: any) {
    console.error('[ADMIN-RETENTION] Expiry warnings error:', err);
    res.status(500).json({ error: 'Failed to get expiry warnings' });
  }
});

// ─── GET /api/admin/retention-ledger/cost-forecast ───────────
// Projected quarterly costs for the next 2 years
router.get('/retention-ledger/cost-forecast', requirePlatformAdmin, async (_req: Request, res: Response) => {
  try {
    // Get all active ledger entries
    const entries = await pool.query(
      `SELECT archive_size_bytes, retention_start_date, retention_end_date, estimated_cost_eur
       FROM retention_reserve_ledger
       WHERE status IN ('allocated', 'funded')`
    );

    // Calculate quarterly costs: how many entries are active in each quarter
    const now = new Date();
    const quarters: Array<{ quarter: string; activeEntries: number; totalBytes: number; estimatedCostEur: number }> = [];

    for (let q = 0; q < 8; q++) {
      const quarterStart = new Date(now);
      quarterStart.setMonth(quarterStart.getMonth() + q * 3);
      quarterStart.setDate(1);
      const quarterEnd = new Date(quarterStart);
      quarterEnd.setMonth(quarterEnd.getMonth() + 3);

      const quarterLabel = `Q${Math.floor(quarterStart.getMonth() / 3) + 1} ${quarterStart.getFullYear()}`;

      let activeCount = 0;
      let totalBytes = 0;

      for (const entry of entries.rows) {
        const start = new Date(entry.retention_start_date || entry.created_at);
        const end = new Date(entry.retention_end_date);
        if (start <= quarterEnd && end >= quarterStart) {
          activeCount++;
          totalBytes += parseInt(entry.archive_size_bytes);
        }
      }

      // Scaleway Glacier rate: €0.00254/GB/month × 3 months × 2x buffer
      const costPerQuarter = (totalBytes / (1024 * 1024 * 1024)) * 0.00254 * 3 * 2;

      quarters.push({
        quarter: quarterLabel,
        activeEntries: activeCount,
        totalBytes,
        estimatedCostEur: Math.round(costPerQuarter * 100) / 100,
      });
    }

    res.json({ forecast: quarters });
  } catch (err: any) {
    console.error('[ADMIN-RETENTION] Cost forecast error:', err);
    res.status(500).json({ error: 'Failed to get cost forecast' });
  }
});

// ─── GET /api/admin/retention-ledger/snapshots ───────────────
// All snapshots with retention/legal hold info (for dashboard)
router.get('/retention-ledger/snapshots', requirePlatformAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT cs.id, cs.product_id, cs.org_id, cs.filename, cs.size_bytes, cs.status,
              cs.retention_end_date, cs.legal_hold, cs.cold_storage_status,
              cs.trigger_type, cs.created_at,
              rl.estimated_cost_eur, rl.funded_amount_eur, rl.wise_transaction_ref,
              rl.status AS ledger_status
       FROM compliance_snapshots cs
       LEFT JOIN retention_reserve_ledger rl ON rl.snapshot_id = cs.id
       WHERE cs.status IN ('complete', 'retention_complete')
       ORDER BY cs.created_at DESC
       LIMIT 200`
    );

    res.json({ snapshots: result.rows, total: result.rows.length });
  } catch (err: any) {
    console.error('[ADMIN-RETENTION] Snapshots list error:', err);
    res.status(500).json({ error: 'Failed to list snapshots' });
  }
});

export default router;

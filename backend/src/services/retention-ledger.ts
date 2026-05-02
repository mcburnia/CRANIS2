/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

/**
 * Retention Ledger Service – P8 Phase D
 *
 * Creates ledger entries and funding certificates when compliance
 * archives are generated. Called from snapshot routes after successful
 * archive generation.
 */

import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { calculateRetentionCost, calculateRetentionMonths } from './retention-costing.js';
import { generateRetentionCertificate } from './retention-certificate.js';

interface CreateLedgerEntryInput {
  orgId: string;
  productId: string;
  snapshotId: string;
  archiveHash: string;
  archiveSizeBytes: number;
  releaseVersion: string | null;
  coldStorageKey: string | null;
}

/**
 * Create a retention reserve ledger entry for a completed compliance snapshot.
 * Also generates and stores a Retention Funding Certificate.
 *
 * This is called after a snapshot is successfully generated and (optionally)
 * uploaded to Glacier. It is non-blocking – failures are logged but do not
 * prevent the snapshot from being usable.
 */
export async function createLedgerEntry(input: CreateLedgerEntryInput): Promise<string | null> {
  try {
    // Fetch product details from Neo4j for retention calculation
    const session = getDriver().session();
    let marketPlacementDate: string | null = null;
    let productName = 'Unknown';
    let orgName = 'Unknown';

    try {
      const result = await session.run(
        `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
         RETURN p.name AS productName, p.marketPlacementDate AS marketPlacementDate, o.name AS orgName`,
        { orgId: input.orgId, productId: input.productId }
      );
      if (result.records.length > 0) {
        productName = result.records[0].get('productName') || 'Unknown';
        marketPlacementDate = result.records[0].get('marketPlacementDate') || null;
        orgName = result.records[0].get('orgName') || 'Unknown';
      }
    } finally {
      await session.close();
    }

    // Fetch support end date from technical file
    const supportResult = await pool.query(
      `SELECT content->'fields'->>'end_date' AS end_date
       FROM technical_file_sections WHERE product_id = $1 AND section_key = 'support_period'`,
      [input.productId]
    );
    const supportEndDate = supportResult.rows[0]?.end_date || null;

    // Calculate retention period and cost
    const retentionMonths = calculateRetentionMonths(marketPlacementDate, supportEndDate);
    const costEstimate = calculateRetentionCost(input.archiveSizeBytes, retentionMonths);

    // Calculate retention dates
    let retentionStartDate: string | null = marketPlacementDate;
    let retentionEndDate: string | null = null;
    if (marketPlacementDate) {
      const tenYears = new Date(marketPlacementDate);
      tenYears.setFullYear(tenYears.getFullYear() + 10);
      if (supportEndDate) {
        const supportEnd = new Date(supportEndDate);
        retentionEndDate = (supportEnd > tenYears ? supportEnd : tenYears).toISOString().split('T')[0];
      } else {
        retentionEndDate = tenYears.toISOString().split('T')[0];
      }
    }

    // Insert ledger entry
    const ledgerResult = await pool.query(
      `INSERT INTO retention_reserve_ledger (
         org_id, product_id, snapshot_id,
         archive_hash, archive_size_bytes,
         estimated_cost_eur, funded_amount_eur,
         costing_model_version,
         retention_start_date, retention_end_date
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        input.orgId, input.productId, input.snapshotId,
        input.archiveHash, input.archiveSizeBytes,
        costEstimate.estimatedCostBeforeBuffer, costEstimate.fundedAmount,
        costEstimate.costingModelVersion,
        retentionStartDate, retentionEndDate,
      ]
    );

    const ledgerId = ledgerResult.rows[0].id;

    // Generate Retention Funding Certificate
    try {
      const certResult = await generateRetentionCertificate({
        ledgerId,
        orgName,
        orgId: input.orgId,
        productName,
        productId: input.productId,
        releaseVersion: input.releaseVersion,
        archiveHash: input.archiveHash,
        archiveSizeBytes: input.archiveSizeBytes,
        coldStorageKey: input.coldStorageKey,
        retentionStartDate,
        retentionEndDate,
        costEstimate,
        snapshotId: input.snapshotId,
      });

      // Store certificate hash in ledger
      await pool.query(
        `UPDATE retention_reserve_ledger SET certificate_hash = $1 WHERE id = $2`,
        [certResult.contentHash, ledgerId]
      );

      console.log(`[RETENTION-LEDGER] Entry created: ${ledgerId} (funded: €${costEstimate.fundedAmount}, cert: ${certResult.contentHash.substring(0, 8)}...)`);
    } catch (certErr: any) {
      console.error('[RETENTION-LEDGER] Certificate generation failed (ledger entry still valid):', certErr.message);
    }

    // Backfill retention_end_date on the snapshot itself (for lifecycle enforcement)
    if (retentionEndDate) {
      await pool.query(
        `UPDATE compliance_snapshots SET retention_end_date = $1 WHERE id = $2`,
        [retentionEndDate, input.snapshotId]
      ).catch(err => console.error('[RETENTION-LEDGER] Failed to set snapshot retention_end_date:', err.message));
    }

    return ledgerId;
  } catch (err: any) {
    console.error('[RETENTION-LEDGER] Failed to create ledger entry (non-blocking):', err.message);
    return null;
  }
}

/**
 * Extend retention dates for existing snapshots when a product's support
 * end date is updated to a date later than the current retention end.
 *
 * CRA Art. 13(10): retention = max(market placement + 10y, support end date).
 * Retention can only be extended, never shortened – once a retention obligation
 * exists, reducing the support period does not reduce the obligation.
 *
 * Called from the technical file section save handler when `support_period`
 * content changes. Non-blocking – failures are logged but do not affect
 * the section save.
 */
export async function extendRetentionForSupportDate(
  productId: string,
  newSupportEndDate: string
): Promise<{ extended: number }> {
  const newEnd = new Date(newSupportEndDate);
  if (isNaN(newEnd.getTime())) {
    return { extended: 0 };
  }

  const newEndStr = newEnd.toISOString().split('T')[0];

  try {
    // Extend snapshots where current retention_end_date < new support end date
    const snapshotResult = await pool.query(
      `UPDATE compliance_snapshots
       SET retention_end_date = $1
       WHERE product_id = $2
         AND retention_end_date IS NOT NULL
         AND retention_end_date < $1::date
       RETURNING id`,
      [newEndStr, productId]
    );

    // Extend matching ledger entries
    const ledgerResult = await pool.query(
      `UPDATE retention_reserve_ledger
       SET retention_end_date = $1, updated_at = NOW()
       WHERE product_id = $2
         AND retention_end_date IS NOT NULL
         AND retention_end_date < $1::date`,
      [newEndStr, productId]
    );

    const extended = snapshotResult.rowCount || 0;
    if (extended > 0) {
      console.log(`[RETENTION-LEDGER] Extended retention to ${newEndStr} for ${extended} snapshot(s) of product ${productId} (support period update)`);
    }

    return { extended };
  } catch (err: any) {
    console.error('[RETENTION-LEDGER] Failed to extend retention dates:', err.message);
    return { extended: 0 };
  }
}

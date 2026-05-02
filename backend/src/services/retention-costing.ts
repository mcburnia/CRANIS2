/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

/**
 * Retention Costing Service – P8 Phase D
 *
 * Calculates the 10-year storage cost for a compliance archive.
 * Uses Scaleway Glacier pricing with a 2x buffer multiplier to
 * cover pricing changes, retrieval costs, and operational overhead.
 *
 * Costing model is versioned for auditability – each ledger entry
 * records which model was used.
 */

// ── Costing model constants ──
// These define the current pricing model. When Scaleway changes pricing,
// increment the version and update the rates. Historical ledger entries
// retain the old version for traceability.

export const COSTING_MODEL = {
  version: '2026-03-v1',
  storageRatePerGbPerMonth: 0.00254,  // Scaleway Glacier: €0.00254/GB/month
  retrievalRatePerGb: 0.009,           // Scaleway Glacier: €0.009/GB retrieval
  bufferMultiplier: 2.0,               // 2x buffer for price changes + operational overhead
  expectedRetrievals: 2,               // Assume 2 full retrievals over the retention period
  currency: 'EUR',
};

export interface RetentionCostEstimate {
  /** Estimated bare storage cost over the retention period (no buffer) */
  estimatedStorageCost: number;
  /** Estimated retrieval cost (based on expected retrievals) */
  estimatedRetrievalCost: number;
  /** Total estimated cost before buffer */
  estimatedCostBeforeBuffer: number;
  /** Total funded amount (with buffer multiplier applied) */
  fundedAmount: number;
  /** Costing model version used */
  costingModelVersion: string;
  /** Date of calculation */
  calculationDate: string;
  /** Input: archive size in bytes */
  archiveSizeBytes: number;
  /** Input: retention duration in months */
  retentionMonths: number;
}

/**
 * Calculate the retention cost for an archive.
 *
 * @param archiveSizeBytes - Size of the archive in bytes
 * @param retentionMonths - Duration of retention in months (typically 120 = 10 years)
 * @returns Cost estimate with full breakdown
 */
export function calculateRetentionCost(
  archiveSizeBytes: number,
  retentionMonths: number = 120,
): RetentionCostEstimate {
  const sizeGb = archiveSizeBytes / (1024 * 1024 * 1024);

  const estimatedStorageCost = sizeGb * COSTING_MODEL.storageRatePerGbPerMonth * retentionMonths;
  const estimatedRetrievalCost = sizeGb * COSTING_MODEL.retrievalRatePerGb * COSTING_MODEL.expectedRetrievals;
  const estimatedCostBeforeBuffer = estimatedStorageCost + estimatedRetrievalCost;
  const fundedAmount = estimatedCostBeforeBuffer * COSTING_MODEL.bufferMultiplier;

  return {
    estimatedStorageCost: Math.round(estimatedStorageCost * 10000) / 10000,
    estimatedRetrievalCost: Math.round(estimatedRetrievalCost * 10000) / 10000,
    estimatedCostBeforeBuffer: Math.round(estimatedCostBeforeBuffer * 10000) / 10000,
    fundedAmount: Math.round(fundedAmount * 100) / 100,  // Round to cents
    costingModelVersion: COSTING_MODEL.version,
    calculationDate: new Date().toISOString().split('T')[0],
    archiveSizeBytes,
    retentionMonths,
  };
}

/**
 * Calculate retention months from market placement date and support end date.
 * Rule: max(marketPlacement + 10 years, supportEndDate) - now
 */
export function calculateRetentionMonths(
  marketPlacementDate: string | null,
  supportEndDate: string | null,
): number {
  if (!marketPlacementDate) return 120; // Default 10 years if no date set

  const tenYears = new Date(marketPlacementDate);
  tenYears.setFullYear(tenYears.getFullYear() + 10);

  let retentionEnd = tenYears;
  if (supportEndDate) {
    const supportEnd = new Date(supportEndDate);
    if (supportEnd > tenYears) retentionEnd = supportEnd;
  }

  const now = new Date();
  const diffMs = retentionEnd.getTime() - now.getTime();
  const months = Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30.44)); // Average month length

  return Math.max(months, 1); // At least 1 month
}

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
 * Affiliate Statement Generator
 *
 * Once a month, for each enabled affiliate, build a snapshot of their
 * referral activity for the previous calendar month, write a ledger
 * `commission_accrued` entry, and notify the affiliate.
 *
 * Idempotent: re-runs for the same (affiliate, period_start) are skipped
 * via the UNIQUE constraint on affiliate_monthly_statements. Use
 * regenerateStatement() from the admin route to force-recompute.
 *
 * Revenue source: until Stripe invoice/paid events are recorded into
 * billing_events, gross_revenue_eur defaults to 0. The admin can use the
 * manual ledger (Phase 2) to top up commissions in the meantime.
 */

import pool from '../db/pool.js';
import { sendAffiliateStatementEmail } from './email.js';
import { logger } from '../utils/logger.js';

export interface MonthlyMetrics {
  activeReferredOrgs: number;
  newSignupsThisMonth: number;
  churnedThisMonth: number;
  grossRevenueEur: number;
  commissionRateSnapshot: number;
  commissionEarnedEur: number;
}

/** Returns first/last instant of the month immediately before `reference`. */
export function getPreviousMonthBounds(reference: Date = new Date()): { periodStart: Date; periodEnd: Date } {
  const periodStart = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - 1, 1, 0, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1, 0, 0, 0, 0));
  return { periodStart, periodEnd };
}

interface AffiliateRow {
  id: string;
  bonus_code: string;
  display_name: string;
  contact_email: string;
  commission_rate: number;
  enabled: boolean;
  user_id: string | null;
}

/**
 * Compute previous-month metrics for one affiliate.
 *
 * - activeReferredOrgs: orgs where commission window is still open at periodEnd
 * - newSignupsThisMonth: attributions whose attributed_at is within the period
 * - churnedThisMonth: orgs that became read_only/suspended/cancelled during the period
 * - grossRevenueEur: sum of paid invoices for referred orgs in window during period
 *                   (currently 0 — billing_events doesn't track invoice events yet)
 * - commissionEarnedEur: grossRevenueEur * commission_rate
 */
export async function computeMetrics(affiliateId: string, commissionRate: number, periodStart: Date, periodEnd: Date): Promise<MonthlyMetrics> {
  const activeRes = await pool.query(
    `SELECT COUNT(*)::int AS n
     FROM affiliate_attributions
     WHERE affiliate_id = $1
       AND attributed_at < $2
       AND commission_window_ends_at > $2`,
    [affiliateId, periodEnd]
  );
  const newRes = await pool.query(
    `SELECT COUNT(*)::int AS n
     FROM affiliate_attributions
     WHERE affiliate_id = $1
       AND attributed_at >= $2 AND attributed_at < $3`,
    [affiliateId, periodStart, periodEnd]
  );
  const churnRes = await pool.query(
    `SELECT COUNT(DISTINCT ob.org_id)::int AS n
     FROM affiliate_attributions a
     JOIN org_billing ob ON ob.org_id = a.org_id
     WHERE a.affiliate_id = $1
       AND ob.status IN ('read_only', 'suspended', 'cancelled')
       AND ob.updated_at >= $2 AND ob.updated_at < $3`,
    [affiliateId, periodStart, periodEnd]
  );
  // Revenue placeholder — wire up when billing_events records paid invoices.
  const grossRevenueEur = 0;
  const commissionEarnedEur = Number((grossRevenueEur * commissionRate).toFixed(2));

  return {
    activeReferredOrgs: activeRes.rows[0]?.n ?? 0,
    newSignupsThisMonth: newRes.rows[0]?.n ?? 0,
    churnedThisMonth: churnRes.rows[0]?.n ?? 0,
    grossRevenueEur,
    commissionRateSnapshot: commissionRate,
    commissionEarnedEur,
  };
}

/**
 * Generate (or regenerate) a single affiliate's statement for the given period.
 * Returns the new statement id, or null if a statement already exists and
 * `force` is false.
 *
 * Inside a transaction:
 *   1. Insert the ledger row of type 'commission_accrued' (only if amount > 0)
 *   2. Insert the affiliate_monthly_statements row referencing the ledger row
 *   3. (Outside the txn) fire notifications + email
 */
export async function generateStatementForAffiliate(
  affiliate: AffiliateRow,
  periodStart: Date,
  periodEnd: Date,
  options: { force?: boolean } = {}
): Promise<{ statementId: string | null; metrics: MonthlyMetrics | null; skipped?: 'exists' }> {
  if (!affiliate.enabled) {
    return { statementId: null, metrics: null, skipped: 'exists' };
  }

  const existing = await pool.query(
    `SELECT id FROM affiliate_monthly_statements
     WHERE affiliate_id = $1 AND period_start = $2`,
    [affiliate.id, periodStart]
  );
  if (existing.rows.length > 0 && !options.force) {
    return { statementId: existing.rows[0].id, metrics: null, skipped: 'exists' };
  }

  const metrics = await computeMetrics(affiliate.id, affiliate.commission_rate, periodStart, periodEnd);

  // periodEnd is the start of the next month; for the human-readable period_end we
  // store the last day of the period (1 second before next month).
  const humanPeriodEnd = new Date(periodEnd.getTime() - 1);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Forced regeneration: clear out any prior ledger entry tied to this period
    if (options.force && existing.rows.length > 0) {
      await client.query(
        `DELETE FROM affiliate_ledger_entries
         WHERE id IN (
           SELECT ledger_entry_id FROM affiliate_monthly_statements
           WHERE id = $1 AND ledger_entry_id IS NOT NULL
         )`,
        [existing.rows[0].id]
      );
      await client.query(
        `DELETE FROM affiliate_monthly_statements WHERE id = $1`,
        [existing.rows[0].id]
      );
    }

    let ledgerEntryId: string | null = null;
    if (metrics.commissionEarnedEur > 0) {
      const ledgerRes = await client.query(
        `INSERT INTO affiliate_ledger_entries
           (affiliate_id, entry_type, amount_eur, period_start, period_end, notes)
         VALUES ($1, 'commission_accrued', $2, $3, $4, $5)
         RETURNING id`,
        [
          affiliate.id,
          metrics.commissionEarnedEur,
          periodStart,
          humanPeriodEnd,
          `Auto-generated for ${periodStart.toISOString().slice(0, 7)}`,
        ]
      );
      ledgerEntryId = ledgerRes.rows[0].id;
    }

    const stmtRes = await client.query(
      `INSERT INTO affiliate_monthly_statements
         (affiliate_id, period_start, period_end, active_referred_orgs,
          new_signups_this_month, churned_this_month, gross_revenue_eur,
          commission_rate_snapshot, commission_earned_eur, ledger_entry_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        affiliate.id, periodStart, humanPeriodEnd,
        metrics.activeReferredOrgs, metrics.newSignupsThisMonth, metrics.churnedThisMonth,
        metrics.grossRevenueEur, metrics.commissionRateSnapshot, metrics.commissionEarnedEur,
        ledgerEntryId,
      ]
    );

    await client.query('COMMIT');

    const statementId = stmtRes.rows[0].id;

    // Side effects outside the txn — failure to email shouldn't roll back the row.
    await fireStatementNotifications(affiliate, statementId, periodStart, metrics);

    return { statementId, metrics };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function fireStatementNotifications(
  affiliate: AffiliateRow,
  statementId: string,
  periodStart: Date,
  metrics: MonthlyMetrics
): Promise<void> {
  const periodLabel = periodStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  // In-app notification: only if the affiliate has a CRANIS2 user account
  // attached to an org (notifications.org_id is NOT NULL). Phase 4 wires the
  // affiliate user account flow; until then, email-only.
  if (affiliate.user_id) {
    try {
      const userRow = await pool.query(
        `SELECT org_id FROM users WHERE id = $1 AND org_id IS NOT NULL`,
        [affiliate.user_id]
      );
      if (userRow.rows.length > 0) {
        await pool.query(
          `INSERT INTO notifications (org_id, user_id, type, severity, title, body, link, metadata)
           VALUES ($1::uuid, $2, 'affiliate_statement', 'info', $3, $4, $5, $6)`,
          [
            userRow.rows[0].org_id,
            affiliate.user_id,
            `Your CRANIS2 affiliate statement for ${periodLabel} is ready`,
            `${metrics.commissionEarnedEur.toFixed(2)} EUR is now invoiceable. ${metrics.activeReferredOrgs} active referrals · ${metrics.newSignupsThisMonth} new this month.`,
            `/affiliate/statements/${statementId}`,
            JSON.stringify({ statementId, periodStart: periodStart.toISOString().slice(0, 10) }),
          ]
        );
        await pool.query(
          `UPDATE affiliate_monthly_statements SET notification_sent_at = NOW() WHERE id = $1`,
          [statementId]
        );
      }
    } catch (err: any) {
      logger.error(`[AFFILIATE-STATEMENT] In-app notification failed for ${affiliate.bonus_code}: ${err.message}`);
    }
  }

  // Email
  try {
    await sendAffiliateStatementEmail({
      to: affiliate.contact_email,
      displayName: affiliate.display_name,
      bonusCode: affiliate.bonus_code,
      periodLabel,
      activeReferredOrgs: metrics.activeReferredOrgs,
      newSignupsThisMonth: metrics.newSignupsThisMonth,
      churnedThisMonth: metrics.churnedThisMonth,
      grossRevenueEur: metrics.grossRevenueEur,
      commissionRateSnapshot: metrics.commissionRateSnapshot,
      commissionEarnedEur: metrics.commissionEarnedEur,
    });
    await pool.query(
      `UPDATE affiliate_monthly_statements SET email_sent_at = NOW() WHERE id = $1`,
      [statementId]
    );
  } catch (err: any) {
    logger.error(`[AFFILIATE-STATEMENT] Email failed for ${affiliate.bonus_code}: ${err.message}`);
  }
}

/**
 * Run for every enabled affiliate. Called from the scheduler on the 1st of
 * each month at 06:00 UTC. Idempotent within the same calendar month.
 */
export async function generateAffiliateMonthlyStatements(): Promise<{ generated: number; skipped: number; failed: number }> {
  const now = new Date();
  const { periodStart, periodEnd } = getPreviousMonthBounds(now);
  const periodLabel = periodStart.toISOString().slice(0, 7);

  logger.info(`[AFFILIATE-STATEMENT] Starting monthly run for period ${periodLabel}`);

  const affiliates = await pool.query<AffiliateRow>(
    `SELECT id, bonus_code, display_name, contact_email, commission_rate, enabled, user_id
     FROM affiliates WHERE enabled = TRUE`
  );

  let generated = 0, skipped = 0, failed = 0;
  for (const a of affiliates.rows) {
    try {
      const result = await generateStatementForAffiliate(a, periodStart, periodEnd);
      if (result.skipped === 'exists') {
        skipped++;
      } else {
        generated++;
        logger.info(`[AFFILIATE-STATEMENT] ${a.bonus_code}: €${result.metrics?.commissionEarnedEur.toFixed(2)} earned, ${result.metrics?.activeReferredOrgs} active`);
      }
    } catch (err: any) {
      failed++;
      logger.error(`[AFFILIATE-STATEMENT] ${a.bonus_code} failed: ${err.message}`);
    }
  }

  logger.info(`[AFFILIATE-STATEMENT] Monthly run complete: ${generated} generated, ${skipped} skipped, ${failed} failed`);
  return { generated, skipped, failed };
}

/** Called by the scheduler tick. Time-gated to 06:00 UTC on the 1st. */
let lastAffiliateStatementMonth: string | null = null;

export async function runMonthlyAffiliateStatements(): Promise<void> {
  const now = new Date();
  if (now.getUTCDate() !== 1) return;
  if (now.getUTCHours() < 6) return;

  const monthStr = now.toISOString().slice(0, 7); // YYYY-MM
  if (lastAffiliateStatementMonth === monthStr) return;
  lastAffiliateStatementMonth = monthStr;

  await generateAffiliateMonthlyStatements();
}

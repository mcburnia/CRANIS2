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
 * Affiliate Self-Service Route — /api/affiliate
 *
 * Lets a logged-in user who is bound to an affiliate (via affiliates.user_id)
 * see their referral activity, statements, ledger, and submit invoices.
 *
 * Authentication: requireAuth (per-route pattern). Each handler resolves the
 * current user's affiliate via SELECT ... WHERE user_id = $userId. Returns 403
 * if the user is not an affiliate.
 *
 * Anonymisation: referrals show the org_id only (no member emails or PII)
 * to avoid leaking customer data to affiliates.
 */

import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { verifySessionToken } from '../utils/token.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';

const router = Router();

// ── Auth middleware ──

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

async function getAffiliateForUser(userId: string): Promise<{ id: string; bonusCode: string } | null> {
  const result = await pool.query(
    `SELECT id, bonus_code FROM affiliates WHERE user_id = $1 AND enabled = TRUE LIMIT 1`,
    [userId]
  );
  if (result.rows.length === 0) return null;
  return { id: result.rows[0].id, bonusCode: result.rows[0].bonus_code };
}

// ── GET /api/affiliate/me — affiliate record + totals ──

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    const result = await pool.query(
      `SELECT id, bonus_code, display_name, contact_email, commission_rate,
              commission_window_months, enabled, payout_method, created_at, updated_at
       FROM affiliates WHERE user_id = $1 AND enabled = TRUE LIMIT 1`,
      [userId]
    );
    if (result.rows.length === 0) {
      res.status(403).json({ error: 'You are not registered as a CRANIS2 affiliate' });
      return;
    }
    const a = result.rows[0];

    // Totals from the ledger
    const ledger = await pool.query(
      `SELECT entry_type, COALESCE(SUM(amount_eur), 0)::numeric(10,2) AS total
       FROM affiliate_ledger_entries WHERE affiliate_id = $1 GROUP BY entry_type`,
      [a.id]
    );
    let earned = 0, invoiced = 0, paid = 0, adjustments = 0;
    for (const row of ledger.rows) {
      const v = Number(row.total);
      if (row.entry_type === 'commission_accrued') earned = v;
      else if (row.entry_type === 'invoice_received') invoiced = v;
      else if (row.entry_type === 'payment_made') paid = v;
      else if (row.entry_type === 'adjustment') adjustments = v;
    }
    const totalEarned = earned + adjustments;

    // Active referrals
    const referralCount = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE commission_window_ends_at > NOW())::int AS active,
         COUNT(*)::int AS total
       FROM affiliate_attributions WHERE affiliate_id = $1`,
      [a.id]
    );

    res.json({
      affiliate: {
        id: a.id,
        bonusCode: a.bonus_code,
        displayName: a.display_name,
        contactEmail: a.contact_email,
        commissionRate: Number(a.commission_rate),
        commissionWindowMonths: a.commission_window_months,
        enabled: a.enabled,
        payoutMethod: a.payout_method,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
      },
      totals: {
        earnedEur: totalEarned,
        invoicedEur: invoiced,
        paidEur: paid,
        accruedBalanceEur: totalEarned - invoiced,
        outstandingPayableEur: invoiced - paid,
        totalLiabilityEur: totalEarned - paid,
      },
      referrals: {
        active: referralCount.rows[0]?.active ?? 0,
        total: referralCount.rows[0]?.total ?? 0,
      },
    });
  } catch (err) {
    console.error('[AFFILIATE] /me failed:', err);
    res.status(500).json({ error: 'Failed to load affiliate' });
  }
});

// ── GET /api/affiliate/statements ──

router.get('/statements', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const a = await getAffiliateForUser(userId);
  if (!a) { res.status(403).json({ error: 'Not an affiliate' }); return; }

  try {
    const result = await pool.query(
      `SELECT id, period_start, period_end, active_referred_orgs,
              new_signups_this_month, churned_this_month, gross_revenue_eur,
              commission_rate_snapshot, commission_earned_eur,
              notification_sent_at, email_sent_at, generated_at
       FROM affiliate_monthly_statements
       WHERE affiliate_id = $1
       ORDER BY period_start DESC`,
      [a.id]
    );
    res.json({
      statements: result.rows.map(r => ({
        id: r.id,
        periodStart: r.period_start,
        periodEnd: r.period_end,
        activeReferredOrgs: r.active_referred_orgs,
        newSignupsThisMonth: r.new_signups_this_month,
        churnedThisMonth: r.churned_this_month,
        grossRevenueEur: Number(r.gross_revenue_eur),
        commissionRateSnapshot: Number(r.commission_rate_snapshot),
        commissionEarnedEur: Number(r.commission_earned_eur),
        notificationSentAt: r.notification_sent_at,
        emailSentAt: r.email_sent_at,
        generatedAt: r.generated_at,
      })),
    });
  } catch (err) {
    console.error('[AFFILIATE] /statements failed:', err);
    res.status(500).json({ error: 'Failed to load statements' });
  }
});

// ── GET /api/affiliate/ledger ──

router.get('/ledger', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const a = await getAffiliateForUser(userId);
  if (!a) { res.status(403).json({ error: 'Not an affiliate' }); return; }

  try {
    const result = await pool.query(
      `SELECT id, entry_type, amount_eur, period_start, period_end,
              reference, notes, created_at
       FROM affiliate_ledger_entries
       WHERE affiliate_id = $1
       ORDER BY created_at DESC`,
      [a.id]
    );
    res.json({
      ledger: result.rows.map(r => ({
        id: r.id,
        entryType: r.entry_type,
        amountEur: Number(r.amount_eur),
        periodStart: r.period_start,
        periodEnd: r.period_end,
        reference: r.reference,
        notes: r.notes,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error('[AFFILIATE] /ledger failed:', err);
    res.status(500).json({ error: 'Failed to load ledger' });
  }
});

// ── GET /api/affiliate/referrals — anonymised ──
// Affiliates only see anonymised org IDs and timing, never member data.

router.get('/referrals', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const a = await getAffiliateForUser(userId);
  if (!a) { res.status(403).json({ error: 'Not an affiliate' }); return; }

  try {
    const result = await pool.query(
      `SELECT a.attributed_at, a.commission_window_ends_at,
              (a.commission_window_ends_at > NOW()) AS in_window,
              ob.status AS billing_status
       FROM affiliate_attributions a
       LEFT JOIN org_billing ob ON ob.org_id = a.org_id
       WHERE a.affiliate_id = $1
       ORDER BY a.attributed_at DESC`,
      [a.id]
    );
    res.json({
      referrals: result.rows.map((r, idx) => ({
        // Use a non-PII pseudo-identifier so the affiliate can refer back
        // to a specific row if they have questions, without leaking org_id.
        ref: `R-${String(idx + 1).padStart(3, '0')}`,
        attributedAt: r.attributed_at,
        commissionWindowEndsAt: r.commission_window_ends_at,
        inWindow: r.in_window,
        billingStatus: r.billing_status || 'pending',
      })),
    });
  } catch (err) {
    console.error('[AFFILIATE] /referrals failed:', err);
    res.status(500).json({ error: 'Failed to load referrals' });
  }
});

// ── POST /api/affiliate/invoice — submit an invoice ──

router.post('/invoice', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const a = await getAffiliateForUser(userId);
  if (!a) { res.status(403).json({ error: 'Not an affiliate' }); return; }

  const { amountEur, invoiceNumber, periodLabel, notes } = req.body;
  const amount = Number(amountEur);
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: 'amountEur must be positive' });
    return;
  }
  if (typeof invoiceNumber !== 'string' || invoiceNumber.trim().length === 0) {
    res.status(400).json({ error: 'invoiceNumber is required' });
    return;
  }

  try {
    // Block obvious duplicates: same affiliate + same invoice number, any time.
    const dupe = await pool.query(
      `SELECT id FROM affiliate_ledger_entries
       WHERE affiliate_id = $1 AND entry_type = 'invoice_received' AND reference = $2 LIMIT 1`,
      [a.id, invoiceNumber.trim()]
    );
    if (dupe.rows.length > 0) {
      res.status(409).json({ error: 'An invoice with that number is already on file' });
      return;
    }

    const fullNotes = [periodLabel ? `Period: ${periodLabel}` : null, notes].filter(Boolean).join(' \u2014 ');

    const result = await pool.query(
      `INSERT INTO affiliate_ledger_entries
         (affiliate_id, entry_type, amount_eur, reference, notes, created_by)
       VALUES ($1, 'invoice_received', $2, $3, $4, $5)
       RETURNING id, entry_type, amount_eur, reference, notes, created_at`,
      [a.id, amount, invoiceNumber.trim(), fullNotes || null, userId]
    );

    const reqData = extractRequestData(req);
    await recordEvent({
      userId, email: (req as any).email,
      eventType: 'affiliate_invoice_submitted', ...reqData,
      metadata: { affiliateId: a.id, bonusCode: a.bonusCode, amountEur: amount, invoiceNumber: invoiceNumber.trim() },
    });

    res.status(201).json({ entry: result.rows[0] });
  } catch (err) {
    console.error('[AFFILIATE] /invoice failed:', err);
    res.status(500).json({ error: 'Failed to submit invoice' });
  }
});

// ── PUT /api/affiliate/payout-method ──

router.put('/payout-method', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const a = await getAffiliateForUser(userId);
  if (!a) { res.status(403).json({ error: 'Not an affiliate' }); return; }

  const { payoutMethod } = req.body;
  if (typeof payoutMethod !== 'object' || payoutMethod === null) {
    res.status(400).json({ error: 'payoutMethod must be an object' });
    return;
  }

  try {
    await pool.query(
      `UPDATE affiliates SET payout_method = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(payoutMethod), a.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[AFFILIATE] /payout-method failed:', err);
    res.status(500).json({ error: 'Failed to update payout method' });
  }
});

export default router;

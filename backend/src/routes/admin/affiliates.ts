/**
 * Admin Affiliates Route — /api/admin/affiliates
 *
 * Platform-admin management of affiliate accounts and their financial state.
 * Reads from the append-only ledger to compute live balances.
 *
 * Flow:
 *   GET    /api/admin/affiliates                     — list with summary stats
 *   POST   /api/admin/affiliates                     — create affiliate
 *   GET    /api/admin/affiliates/:id                 — full detail incl. ledger + statements
 *   PUT    /api/admin/affiliates/:id                 — edit name/email/rate/window/enabled
 *   POST   /api/admin/affiliates/:id/ledger          — record manual ledger entry
 *
 * The affiliate's user account is created later (Phase 4 — affiliate dashboard).
 * Phase 2 just registers the affiliate record so codes can be issued.
 */

import { Router, Request, Response } from 'express';
import pool from '../../db/pool.js';
import { requirePlatformAdmin } from '../../middleware/requirePlatformAdmin.js';
import { recordEvent, extractRequestData } from '../../services/telemetry.js';

const router = Router();

const VALID_ENTRY_TYPES = ['invoice_received', 'payment_made', 'adjustment'] as const;
type EntryType = typeof VALID_ENTRY_TYPES[number];

// ── GET /api/admin/affiliates — list with summary ──

router.get('/affiliates', requirePlatformAdmin, async (_req: Request, res: Response) => {
  try {
    // One query, computed totals from the ledger and attribution count.
    const result = await pool.query(`
      SELECT
        a.id, a.bonus_code, a.display_name, a.contact_email,
        a.commission_rate, a.commission_window_months, a.enabled,
        a.created_at, a.updated_at,
        COALESCE(att.active_referrals, 0)              AS active_referrals,
        COALESCE(att.total_referrals,  0)              AS total_referrals,
        COALESCE(led.earned_eur,       0)::numeric(10,2) AS earned_eur,
        COALESCE(led.invoiced_eur,     0)::numeric(10,2) AS invoiced_eur,
        COALESCE(led.paid_eur,         0)::numeric(10,2) AS paid_eur,
        COALESCE(led.adjustments_eur,  0)::numeric(10,2) AS adjustments_eur
      FROM affiliates a
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE commission_window_ends_at > NOW()) AS active_referrals,
          COUNT(*)                                                   AS total_referrals
        FROM affiliate_attributions WHERE affiliate_id = a.id
      ) att ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          SUM(amount_eur) FILTER (WHERE entry_type = 'commission_accrued') AS earned_eur,
          SUM(amount_eur) FILTER (WHERE entry_type = 'invoice_received')   AS invoiced_eur,
          SUM(amount_eur) FILTER (WHERE entry_type = 'payment_made')       AS paid_eur,
          SUM(amount_eur) FILTER (WHERE entry_type = 'adjustment')         AS adjustments_eur
        FROM affiliate_ledger_entries WHERE affiliate_id = a.id
      ) led ON TRUE
      ORDER BY a.created_at DESC
    `);

    const affiliates = result.rows.map(r => {
      const earned = Number(r.earned_eur) + Number(r.adjustments_eur);
      const invoiced = Number(r.invoiced_eur);
      const paid = Number(r.paid_eur);
      return {
        id: r.id,
        bonusCode: r.bonus_code,
        displayName: r.display_name,
        contactEmail: r.contact_email,
        commissionRate: Number(r.commission_rate),
        commissionWindowMonths: r.commission_window_months,
        enabled: r.enabled,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        activeReferrals: Number(r.active_referrals),
        totalReferrals: Number(r.total_referrals),
        earnedEur: earned,
        invoicedEur: invoiced,
        paidEur: paid,
        accruedBalanceEur: earned - invoiced,    // earned but not yet invoiced
        outstandingPayableEur: invoiced - paid,  // invoiced but not yet paid
        totalLiabilityEur: earned - paid,        // total still owed
      };
    });

    res.json({ affiliates });
  } catch (err) {
    console.error('[ADMIN AFFILIATES] List failed:', err);
    res.status(500).json({ error: 'Failed to list affiliates' });
  }
});

// ── POST /api/admin/affiliates — create ──

router.post('/affiliates', requirePlatformAdmin, async (req: Request, res: Response) => {
  const {
    bonusCode, displayName, contactEmail,
    commissionRate, commissionWindowMonths,
  } = req.body;

  if (!bonusCode || !displayName || !contactEmail) {
    res.status(400).json({ error: 'bonusCode, displayName and contactEmail are required' });
    return;
  }
  const code = String(bonusCode).trim().toUpperCase();
  if (!/^[A-Z0-9]{3,32}$/.test(code)) {
    res.status(400).json({ error: 'Bonus code must be 3–32 letters/digits (A–Z, 0–9)' });
    return;
  }

  const rate = commissionRate !== undefined ? Number(commissionRate) : 0.20;
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    res.status(400).json({ error: 'commissionRate must be between 0 and 1' });
    return;
  }
  const windowMonths = commissionWindowMonths !== undefined ? parseInt(commissionWindowMonths, 10) : 12;
  if (!Number.isInteger(windowMonths) || windowMonths < 1 || windowMonths > 60) {
    res.status(400).json({ error: 'commissionWindowMonths must be an integer 1–60' });
    return;
  }

  try {
    // Reject duplicate codes (case-insensitive). Using LOWER() index.
    const dupe = await pool.query(
      `SELECT id FROM affiliates WHERE LOWER(bonus_code) = LOWER($1) LIMIT 1`,
      [code]
    );
    if (dupe.rows.length > 0) {
      res.status(409).json({ error: 'Bonus code already in use' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO affiliates (bonus_code, display_name, contact_email, commission_rate, commission_window_months)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, bonus_code, display_name, contact_email, commission_rate, commission_window_months, enabled, created_at`,
      [code, displayName, contactEmail, rate, windowMonths]
    );

    const reqData = extractRequestData(req);
    await recordEvent({
      userId: (req as any).userId, email: (req as any).email,
      eventType: 'admin_affiliate_created', ...reqData,
      metadata: { affiliateId: result.rows[0].id, bonusCode: code, commissionRate: rate },
    });

    res.status(201).json({ affiliate: result.rows[0] });
  } catch (err) {
    console.error('[ADMIN AFFILIATES] Create failed:', err);
    res.status(500).json({ error: 'Failed to create affiliate' });
  }
});

// ── GET /api/admin/affiliates/:id — detail ──

router.get('/affiliates/:id', requirePlatformAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const affResult = await pool.query(
      `SELECT id, bonus_code, display_name, contact_email, commission_rate,
              commission_window_months, enabled, payout_method, invite_sent_at,
              created_at, updated_at
       FROM affiliates WHERE id = $1`,
      [id]
    );
    if (affResult.rows.length === 0) {
      res.status(404).json({ error: 'Affiliate not found' });
      return;
    }
    const a = affResult.rows[0];

    const ledgerResult = await pool.query(
      `SELECT id, entry_type, amount_eur, period_start, period_end,
              reference, notes, created_at, created_by
       FROM affiliate_ledger_entries
       WHERE affiliate_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    const stmtResult = await pool.query(
      `SELECT id, period_start, period_end, active_referred_orgs,
              new_signups_this_month, churned_this_month, gross_revenue_eur,
              commission_rate_snapshot, commission_earned_eur,
              notification_sent_at, email_sent_at, generated_at
       FROM affiliate_monthly_statements
       WHERE affiliate_id = $1
       ORDER BY period_start DESC`,
      [id]
    );

    const referralResult = await pool.query(
      `SELECT org_id, bonus_code_used, attributed_at, commission_window_ends_at,
              (commission_window_ends_at > NOW()) AS in_window
       FROM affiliate_attributions
       WHERE affiliate_id = $1
       ORDER BY attributed_at DESC`,
      [id]
    );

    // Compute totals from the ledger
    let earned = 0, invoiced = 0, paid = 0, adjustments = 0;
    for (const r of ledgerResult.rows) {
      const v = Number(r.amount_eur);
      if (r.entry_type === 'commission_accrued') earned += v;
      else if (r.entry_type === 'invoice_received') invoiced += v;
      else if (r.entry_type === 'payment_made') paid += v;
      else if (r.entry_type === 'adjustment') adjustments += v;
    }
    const totalEarned = earned + adjustments;

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
        inviteSentAt: a.invite_sent_at,
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
      ledger: ledgerResult.rows.map(r => ({
        id: r.id,
        entryType: r.entry_type,
        amountEur: Number(r.amount_eur),
        periodStart: r.period_start,
        periodEnd: r.period_end,
        reference: r.reference,
        notes: r.notes,
        createdAt: r.created_at,
        createdBy: r.created_by,
      })),
      statements: stmtResult.rows.map(r => ({
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
      referrals: referralResult.rows.map(r => ({
        orgId: r.org_id,
        bonusCodeUsed: r.bonus_code_used,
        attributedAt: r.attributed_at,
        commissionWindowEndsAt: r.commission_window_ends_at,
        inWindow: r.in_window,
      })),
    });
  } catch (err) {
    console.error('[ADMIN AFFILIATES] Detail failed:', err);
    res.status(500).json({ error: 'Failed to fetch affiliate' });
  }
});

// ── PUT /api/admin/affiliates/:id — edit ──

router.put('/affiliates/:id', requirePlatformAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { displayName, contactEmail, commissionRate, commissionWindowMonths, enabled } = req.body;

  const sets: string[] = ['updated_at = NOW()'];
  const vals: any[] = [];
  let i = 1;

  if (displayName !== undefined) {
    sets.push(`display_name = $${i++}`); vals.push(displayName);
  }
  if (contactEmail !== undefined) {
    sets.push(`contact_email = $${i++}`); vals.push(contactEmail);
  }
  if (commissionRate !== undefined) {
    const rate = Number(commissionRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
      res.status(400).json({ error: 'commissionRate must be between 0 and 1' });
      return;
    }
    sets.push(`commission_rate = $${i++}`); vals.push(rate);
  }
  if (commissionWindowMonths !== undefined) {
    const months = parseInt(commissionWindowMonths, 10);
    if (!Number.isInteger(months) || months < 1 || months > 60) {
      res.status(400).json({ error: 'commissionWindowMonths must be 1–60' });
      return;
    }
    sets.push(`commission_window_months = $${i++}`); vals.push(months);
  }
  if (enabled !== undefined) {
    sets.push(`enabled = $${i++}`); vals.push(!!enabled);
  }
  if (sets.length === 1) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  vals.push(id);
  try {
    const result = await pool.query(
      `UPDATE affiliates SET ${sets.join(', ')} WHERE id = $${i} RETURNING id`,
      vals
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Affiliate not found' });
      return;
    }

    const reqData = extractRequestData(req);
    await recordEvent({
      userId: (req as any).userId, email: (req as any).email,
      eventType: 'admin_affiliate_updated', ...reqData,
      metadata: { affiliateId: id, fields: Object.keys(req.body) },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN AFFILIATES] Update failed:', err);
    res.status(500).json({ error: 'Failed to update affiliate' });
  }
});

// ── POST /api/admin/affiliates/:id/ledger — record manual entry ──

router.post('/affiliates/:id/ledger', requirePlatformAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { entryType, amountEur, reference, notes, periodStart, periodEnd } = req.body;

  if (!entryType || !VALID_ENTRY_TYPES.includes(entryType as EntryType)) {
    res.status(400).json({ error: `entryType must be one of: ${VALID_ENTRY_TYPES.join(', ')}` });
    return;
  }
  const amount = Number(amountEur);
  if (!Number.isFinite(amount)) {
    res.status(400).json({ error: 'amountEur must be a number' });
    return;
  }
  // commission_accrued is created only by the scheduler; admin can't backdoor it.
  // adjustment can be signed (positive or negative); invoice/payment must be > 0.
  if (entryType !== 'adjustment' && amount <= 0) {
    res.status(400).json({ error: 'amountEur must be positive for invoice/payment entries' });
    return;
  }

  try {
    const exists = await pool.query('SELECT id FROM affiliates WHERE id = $1', [id]);
    if (exists.rows.length === 0) {
      res.status(404).json({ error: 'Affiliate not found' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO affiliate_ledger_entries
         (affiliate_id, entry_type, amount_eur, reference, notes, period_start, period_end, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, entry_type, amount_eur, reference, notes, period_start, period_end, created_at`,
      [id, entryType, amount, reference || null, notes || null, periodStart || null, periodEnd || null, (req as any).userId]
    );

    const reqData = extractRequestData(req);
    await recordEvent({
      userId: (req as any).userId, email: (req as any).email,
      eventType: 'admin_affiliate_ledger_entry', ...reqData,
      metadata: { affiliateId: id, entryType, amountEur: amount, reference },
    });

    res.status(201).json({ entry: result.rows[0] });
  } catch (err) {
    console.error('[ADMIN AFFILIATES] Ledger entry failed:', err);
    res.status(500).json({ error: 'Failed to record ledger entry' });
  }
});

export default router;

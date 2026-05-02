/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserCheck, Copy, FileText, Loader, AlertCircle, X, CheckCircle2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import { usePageMeta } from '../hooks/usePageMeta';
import './AffiliatePage.css';

interface AffiliateMe {
  id: string;
  bonusCode: string;
  displayName: string;
  contactEmail: string;
  commissionRate: number;
  commissionWindowMonths: number;
  enabled: boolean;
  payoutMethod: any;
  createdAt: string;
}

interface MeResponse {
  affiliate: AffiliateMe;
  totals: {
    earnedEur: number;
    invoicedEur: number;
    paidEur: number;
    accruedBalanceEur: number;
    outstandingPayableEur: number;
    totalLiabilityEur: number;
  };
  referrals: { active: number; total: number };
}

interface Statement {
  id: string;
  periodStart: string;
  periodEnd: string;
  activeReferredOrgs: number;
  newSignupsThisMonth: number;
  churnedThisMonth: number;
  grossRevenueEur: number;
  commissionRateSnapshot: number;
  commissionEarnedEur: number;
  emailSentAt: string | null;
}

interface LedgerEntry {
  id: string;
  entryType: 'commission_accrued' | 'invoice_received' | 'payment_made' | 'adjustment';
  amountEur: number;
  reference: string | null;
  notes: string | null;
  createdAt: string;
}

interface Referral {
  ref: string;
  attributedAt: string;
  commissionWindowEndsAt: string;
  inWindow: boolean;
  billingStatus: string;
}

const ENTRY_LABEL: Record<LedgerEntry['entryType'], string> = {
  commission_accrued: 'Commission accrued',
  invoice_received: 'Invoice submitted',
  payment_made: 'Payment received',
  adjustment: 'Adjustment',
};

function fmtEur(n: number): string {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(n);
}
function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtMonth(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export default function AffiliatePage() {
  usePageMeta();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Invoice modal
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');
  const [invoiceSuccess, setInvoiceSuccess] = useState('');
  const [invoiceForm, setInvoiceForm] = useState({
    amountEur: '',
    invoiceNumber: '',
    periodLabel: '',
    notes: '',
  });

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('session_token');
      const headers = { Authorization: `Bearer ${token}` };
      const [meRes, stmtRes, ledgerRes, refRes] = await Promise.all([
        fetch('/api/affiliate/me', { headers }),
        fetch('/api/affiliate/statements', { headers }),
        fetch('/api/affiliate/ledger', { headers }),
        fetch('/api/affiliate/referrals', { headers }),
      ]);

      if (meRes.status === 403) {
        setError('not_affiliate');
        return;
      }
      if (!meRes.ok) throw new Error();
      const meData: MeResponse = await meRes.json();
      setMe(meData);

      if (stmtRes.ok) setStatements((await stmtRes.json()).statements || []);
      if (ledgerRes.ok) setLedger((await ledgerRes.json()).ledger || []);
      if (refRes.ok) setReferrals((await refRes.json()).referrals || []);
    } catch {
      setError('Failed to load affiliate dashboard');
    } finally {
      setLoading(false);
    }
  }

  async function copyShareUrl() {
    if (!me) return;
    const url = `${window.location.origin}/?ref=${me.affiliate.bonusCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  async function submitInvoice() {
    setInvoiceBusy(true);
    setInvoiceError('');
    setInvoiceSuccess('');
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch('/api/affiliate/invoice', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountEur: Number(invoiceForm.amountEur),
          invoiceNumber: invoiceForm.invoiceNumber.trim(),
          periodLabel: invoiceForm.periodLabel.trim() || undefined,
          notes: invoiceForm.notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInvoiceError(data.error || 'Failed to submit invoice');
        return;
      }
      setInvoiceSuccess(`Invoice ${invoiceForm.invoiceNumber} submitted. CRANIS2 will mark it received once processed.`);
      setInvoiceForm({ amountEur: '', invoiceNumber: '', periodLabel: '', notes: '' });
      await load();
    } catch {
      setInvoiceError('Network error');
    } finally {
      setInvoiceBusy(false);
    }
  }

  if (loading) {
    return <div className="aff-page"><div className="aff-state"><Loader size={20} className="aff-spin" /> Loading...</div></div>;
  }
  if (error === 'not_affiliate') {
    return (
      <div className="aff-page">
        <div className="aff-state aff-no-account">
          <UserCheck size={32} />
          <h2>You're not registered as a CRANIS2 affiliate</h2>
          <p>If you believe this is a mistake, contact <a href="mailto:info@cranis2.com">info@cranis2.com</a> with your account email.</p>
          <Link to="/dashboard" className="aff-btn-secondary">Back to dashboard</Link>
        </div>
      </div>
    );
  }
  if (error || !me) {
    return <div className="aff-page"><div className="aff-state aff-error"><AlertCircle size={16} /> {error || 'Not found'}</div></div>;
  }

  const a = me.affiliate;
  const t = me.totals;
  const shareUrl = `${window.location.origin}/?ref=${a.bonusCode}`;

  return (
    <div className="aff-page">
      <PageHeader title="Affiliate dashboard">
        <button className="aff-btn-primary" onClick={() => { setInvoiceOpen(true); setInvoiceError(''); setInvoiceSuccess(''); }}>
          <FileText size={14} /> Submit invoice
        </button>
      </PageHeader>

      <div className="aff-hero">
        <div className="aff-hero-left">
          <p className="aff-hero-label">Your bonus code</p>
          <code className="aff-hero-code">{a.bonusCode}</code>
          <p className="aff-hero-rate">{(a.commissionRate * 100).toFixed(1)}% commission · {a.commissionWindowMonths}-month window</p>
        </div>
        <div className="aff-hero-right">
          <p className="aff-hero-label">Share this link</p>
          <div className="aff-hero-link">
            <code>{shareUrl}</code>
            <button className="aff-btn-icon" onClick={copyShareUrl} title="Copy link">
              {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <p className="aff-hero-hint">Anyone who enters <code>{a.bonusCode}</code> at signup gets 90 days free trial instead of 30.</p>
        </div>
      </div>

      <div className="aff-stats">
        <StatCard label="Active referrals" value={me.referrals.active} sub={`${me.referrals.total} total`} color="blue" />
        <StatCard label="Earned" value={fmtEur(t.earnedEur)} color="green" />
        <StatCard label="Accrued (invoiceable)" value={fmtEur(t.accruedBalanceEur)} color={t.accruedBalanceEur > 0 ? 'amber' : 'green'} />
        <StatCard label="Outstanding from CRANIS2" value={fmtEur(t.outstandingPayableEur)} color={t.outstandingPayableEur > 0 ? 'amber' : 'green'} />
      </div>

      {t.accruedBalanceEur > 0 && (
        <div className="aff-callout">
          <strong>{fmtEur(t.accruedBalanceEur)}</strong> is now invoiceable. Click <em>Submit invoice</em> to log it &mdash; CRANIS2 will mark it received and pay it through your usual settlement window.
        </div>
      )}

      <div className="aff-section">
        <h3>Monthly statements ({statements.length})</h3>
        {statements.length === 0 ? (
          <div className="aff-empty">No statements yet. The first will arrive on the 1st of next month for any referrals you've already brought in.</div>
        ) : (
          <table className="aff-table">
            <thead><tr><th>Period</th><th>Active orgs</th><th>New / Churned</th><th>Gross revenue</th><th>Rate</th><th>Earned</th></tr></thead>
            <tbody>
              {statements.map(s => (
                <tr key={s.id}>
                  <td>{fmtMonth(s.periodStart)}</td>
                  <td>{s.activeReferredOrgs}</td>
                  <td>+{s.newSignupsThisMonth} / −{s.churnedThisMonth}</td>
                  <td>{fmtEur(s.grossRevenueEur)}</td>
                  <td>{(s.commissionRateSnapshot * 100).toFixed(1)}%</td>
                  <td className="aff-amount">{fmtEur(s.commissionEarnedEur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="aff-section">
        <h3>Ledger ({ledger.length})</h3>
        {ledger.length === 0 ? (
          <div className="aff-empty">Your account ledger will fill in once monthly accruals run and you submit invoices.</div>
        ) : (
          <table className="aff-table">
            <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Reference</th><th>Notes</th></tr></thead>
            <tbody>
              {ledger.map(l => (
                <tr key={l.id}>
                  <td>{fmtDate(l.createdAt)}</td>
                  <td><span className={`aff-pill aff-pill-${l.entryType}`}>{ENTRY_LABEL[l.entryType]}</span></td>
                  <td className="aff-amount">{fmtEur(l.amountEur)}</td>
                  <td>{l.reference || '—'}</td>
                  <td className="aff-notes">{l.notes || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="aff-section">
        <h3>Referrals ({referrals.length})</h3>
        {referrals.length === 0 ? (
          <div className="aff-empty">No-one has redeemed your code yet. Share <code>{a.bonusCode}</code> or your link above and they'll show up here as soon as they sign up.</div>
        ) : (
          <table className="aff-table">
            <thead><tr><th>Ref</th><th>Signed up</th><th>Window ends</th><th>Status</th></tr></thead>
            <tbody>
              {referrals.map(r => (
                <tr key={r.ref}>
                  <td className="aff-ref">{r.ref}</td>
                  <td>{fmtDate(r.attributedAt)}</td>
                  <td>{fmtDate(r.commissionWindowEndsAt)}</td>
                  <td>
                    <span className={`aff-pill ${r.inWindow ? 'aff-pill-in_window' : 'aff-pill-expired'}`}>
                      {r.inWindow ? 'In window' : 'Expired'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="aff-anonymisation-note">
          Referrals are anonymised — we don't share customer identities. CRANIS2 reconciles your statements against the originating bonus code.
        </p>
      </div>

      <div className="aff-section">
        <h3>Payment</h3>
        <div className="aff-payment">
          <p>To get paid for accrued commissions, send invoices to <a href="mailto:info@cranis2.com">info@cranis2.com</a>, or click <em>Submit invoice</em> above to log them on the platform. Reference your bonus code <code>{a.bonusCode}</code> on every invoice.</p>
          <p className="aff-payment-detail">Contact email on file: {a.contactEmail}. Need to update your details? Reply to your most recent affiliate statement email.</p>
        </div>
      </div>

      {invoiceOpen && (
        <div className="aff-modal-overlay" onClick={() => !invoiceBusy && setInvoiceOpen(false)}>
          <div className="aff-modal" onClick={(e) => e.stopPropagation()}>
            <div className="aff-modal-head">
              <h3>Submit invoice</h3>
              <button className="aff-modal-close" onClick={() => setInvoiceOpen(false)} disabled={invoiceBusy}><X size={18} /></button>
            </div>
            <div className="aff-form">
              <p className="aff-form-intro">
                Logs your invoice to CRANIS2 for processing. The amount you've accrued is <strong>{fmtEur(t.accruedBalanceEur)}</strong>.
              </p>
              <div className="aff-field">
                <label>Invoice number</label>
                <input
                  type="text"
                  value={invoiceForm.invoiceNumber}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
                  placeholder="e.g. INV-2026-001"
                />
              </div>
              <div className="aff-field-row">
                <div className="aff-field">
                  <label>Amount (EUR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={invoiceForm.amountEur}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, amountEur: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="aff-field">
                  <label>Period covered</label>
                  <input
                    type="text"
                    value={invoiceForm.periodLabel}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, periodLabel: e.target.value })}
                    placeholder="e.g. April 2026"
                  />
                </div>
              </div>
              <div className="aff-field">
                <label>Notes (optional)</label>
                <textarea
                  value={invoiceForm.notes}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                  rows={3}
                  placeholder="Anything CRANIS2 should know about this invoice..."
                />
              </div>
              {invoiceError && <div className="aff-error"><AlertCircle size={14} /> {invoiceError}</div>}
              {invoiceSuccess && <div className="aff-success"><CheckCircle2 size={14} /> {invoiceSuccess}</div>}
              <div className="aff-actions">
                <button className="aff-btn-secondary" onClick={() => setInvoiceOpen(false)} disabled={invoiceBusy}>Close</button>
                <button
                  className="aff-btn-primary"
                  onClick={submitInvoice}
                  disabled={invoiceBusy || !invoiceForm.invoiceNumber.trim() || !invoiceForm.amountEur}
                >
                  {invoiceBusy ? 'Submitting...' : 'Submit invoice'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

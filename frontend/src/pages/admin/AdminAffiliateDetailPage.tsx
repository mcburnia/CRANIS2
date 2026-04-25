import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader, Plus, X, AlertCircle, Edit2, ChevronDown } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { usePageMeta } from '../../hooks/usePageMeta';
import './AdminAffiliateDetailPage.css';

interface Affiliate {
  id: string;
  bonusCode: string;
  displayName: string;
  contactEmail: string;
  commissionRate: number;
  commissionWindowMonths: number;
  enabled: boolean;
  inviteSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LedgerEntry {
  id: string;
  entryType: 'commission_accrued' | 'invoice_received' | 'payment_made' | 'adjustment';
  amountEur: number;
  periodStart: string | null;
  periodEnd: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
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
  notificationSentAt: string | null;
  emailSentAt: string | null;
  generatedAt: string;
}

interface Referral {
  orgId: string;
  bonusCodeUsed: string;
  attributedAt: string;
  commissionWindowEndsAt: string;
  inWindow: boolean;
}

interface Detail {
  affiliate: Affiliate;
  totals: {
    earnedEur: number;
    invoicedEur: number;
    paidEur: number;
    accruedBalanceEur: number;
    outstandingPayableEur: number;
    totalLiabilityEur: number;
  };
  ledger: LedgerEntry[];
  statements: Statement[];
  referrals: Referral[];
}

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

const ENTRY_LABEL: Record<LedgerEntry['entryType'], string> = {
  commission_accrued: 'Commission accrued',
  invoice_received: 'Invoice received',
  payment_made: 'Payment made',
  adjustment: 'Adjustment',
};

export default function AdminAffiliateDetailPage() {
  usePageMeta();
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Ledger entry modal
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryBusy, setEntryBusy] = useState(false);
  const [entryError, setEntryError] = useState('');
  const [entryForm, setEntryForm] = useState({
    entryType: 'invoice_received' as 'invoice_received' | 'payment_made' | 'adjustment',
    amountEur: '',
    reference: '',
    notes: '',
  });

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');
  const [editForm, setEditForm] = useState({
    displayName: '',
    contactEmail: '',
    commissionRate: '',
    commissionWindowMonths: '',
    enabled: true,
  });

  useEffect(() => { if (id) void load(); }, [id]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`/api/admin/affiliates/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDetail(data);
      setEditForm({
        displayName: data.affiliate.displayName,
        contactEmail: data.affiliate.contactEmail,
        commissionRate: String(data.affiliate.commissionRate),
        commissionWindowMonths: String(data.affiliate.commissionWindowMonths),
        enabled: data.affiliate.enabled,
      });
    } catch {
      setError('Failed to load affiliate');
    } finally {
      setLoading(false);
    }
  }

  async function recordEntry() {
    setEntryBusy(true);
    setEntryError('');
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`/api/admin/affiliates/${id}/ledger`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryType: entryForm.entryType,
          amountEur: Number(entryForm.amountEur),
          reference: entryForm.reference || undefined,
          notes: entryForm.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEntryError(data.error || 'Failed to record');
        return;
      }
      setEntryOpen(false);
      setEntryForm({ entryType: 'invoice_received', amountEur: '', reference: '', notes: '' });
      await load();
    } catch {
      setEntryError('Network error');
    } finally {
      setEntryBusy(false);
    }
  }

  async function saveEdits() {
    setEditBusy(true);
    setEditError('');
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`/api/admin/affiliates/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: editForm.displayName,
          contactEmail: editForm.contactEmail,
          commissionRate: Number(editForm.commissionRate),
          commissionWindowMonths: parseInt(editForm.commissionWindowMonths, 10),
          enabled: editForm.enabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || 'Failed to save');
        return;
      }
      setEditOpen(false);
      await load();
    } catch {
      setEditError('Network error');
    } finally {
      setEditBusy(false);
    }
  }

  if (loading) {
    return <div className="aad-page"><div className="aad-state"><Loader size={20} className="aad-spin" /> Loading...</div></div>;
  }
  if (error || !detail) {
    return <div className="aad-page"><div className="aad-state aad-error"><AlertCircle size={16} /> {error || 'Not found'}</div></div>;
  }

  const a = detail.affiliate;
  const t = detail.totals;

  return (
    <div className="aad-page">
      <Link to="/admin/affiliates" className="aad-back">
        <ArrowLeft size={14} /> Back to affiliates
      </Link>

      <PageHeader title={a.displayName}>
        <button className="aad-btn-secondary" onClick={() => setEditOpen(true)}>
          <Edit2 size={14} /> Edit
        </button>
        <button className="aad-btn-primary" onClick={() => setEntryOpen(true)}>
          <Plus size={14} /> Record entry
        </button>
      </PageHeader>

      <div className="aad-meta">
        <div><span className="aad-meta-label">Code</span><code className="aad-code">{a.bonusCode}</code></div>
        <div><span className="aad-meta-label">Email</span> {a.contactEmail}</div>
        <div><span className="aad-meta-label">Rate</span> {(a.commissionRate * 100).toFixed(1)}%</div>
        <div><span className="aad-meta-label">Window</span> {a.commissionWindowMonths} months</div>
        <div><span className="aad-meta-label">Status</span>
          <span className={`aad-pill ${a.enabled ? 'aad-pill-on' : 'aad-pill-off'}`}>{a.enabled ? 'Enabled' : 'Disabled'}</span>
        </div>
      </div>

      <div className="aad-stats">
        <StatCard label="Earned" value={fmtEur(t.earnedEur)} color="green" />
        <StatCard label="Invoiced" value={fmtEur(t.invoicedEur)} color="blue" />
        <StatCard label="Paid" value={fmtEur(t.paidEur)} color="green" />
        <StatCard label="Accrued (uninvoiced)" value={fmtEur(t.accruedBalanceEur)} color={t.accruedBalanceEur > 0 ? 'amber' : 'green'} />
        <StatCard label="Outstanding to pay" value={fmtEur(t.outstandingPayableEur)} color={t.outstandingPayableEur > 0 ? 'red' : 'green'} />
        <StatCard label="Total liability" value={fmtEur(t.totalLiabilityEur)} color="blue" />
      </div>

      <div className="aad-section">
        <h3>Ledger ({detail.ledger.length})</h3>
        {detail.ledger.length === 0 ? (
          <div className="aad-empty">No ledger entries yet. Monthly accruals appear here once the scheduler runs.</div>
        ) : (
          <table className="aad-table">
            <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Reference</th><th>Period</th><th>Notes</th></tr></thead>
            <tbody>
              {detail.ledger.map(l => (
                <tr key={l.id}>
                  <td>{fmtDate(l.createdAt)}</td>
                  <td><span className={`aad-pill aad-pill-${l.entryType}`}>{ENTRY_LABEL[l.entryType]}</span></td>
                  <td className="aad-amount">{fmtEur(l.amountEur)}</td>
                  <td>{l.reference || '—'}</td>
                  <td>{l.periodStart ? fmtMonth(l.periodStart) : '—'}</td>
                  <td className="aad-notes">{l.notes || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="aad-section">
        <h3>Monthly statements ({detail.statements.length})</h3>
        {detail.statements.length === 0 ? (
          <div className="aad-empty">No statements generated yet. The 1st-of-month scheduler will populate these.</div>
        ) : (
          <table className="aad-table">
            <thead><tr><th>Period</th><th>Active orgs</th><th>New / Churned</th><th>Gross revenue</th><th>Rate</th><th>Earned</th><th>Notified</th></tr></thead>
            <tbody>
              {detail.statements.map(s => (
                <tr key={s.id}>
                  <td>{fmtMonth(s.periodStart)}</td>
                  <td>{s.activeReferredOrgs}</td>
                  <td>+{s.newSignupsThisMonth} / −{s.churnedThisMonth}</td>
                  <td>{fmtEur(s.grossRevenueEur)}</td>
                  <td>{(s.commissionRateSnapshot * 100).toFixed(1)}%</td>
                  <td>{fmtEur(s.commissionEarnedEur)}</td>
                  <td>{s.notificationSentAt ? fmtDate(s.notificationSentAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="aad-section">
        <h3>Referrals ({detail.referrals.length})</h3>
        {detail.referrals.length === 0 ? (
          <div className="aad-empty">No referrals yet. Once a prospect signs up with this code, they'll appear here.</div>
        ) : (
          <table className="aad-table">
            <thead><tr><th>Org ID</th><th>Code used</th><th>Attributed</th><th>Window ends</th><th>Status</th></tr></thead>
            <tbody>
              {detail.referrals.map(r => (
                <tr key={r.orgId}>
                  <td className="aad-mono">{r.orgId}</td>
                  <td><code className="aad-code">{r.bonusCodeUsed}</code></td>
                  <td>{fmtDate(r.attributedAt)}</td>
                  <td>{fmtDate(r.commissionWindowEndsAt)}</td>
                  <td>
                    <span className={`aad-pill ${r.inWindow ? 'aad-pill-on' : 'aad-pill-off'}`}>
                      {r.inWindow ? 'In window' : 'Expired'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {entryOpen && (
        <div className="aad-modal-overlay" onClick={() => !entryBusy && setEntryOpen(false)}>
          <div className="aad-modal" onClick={(e) => e.stopPropagation()}>
            <div className="aad-modal-head">
              <h3>Record ledger entry</h3>
              <button className="aad-modal-close" onClick={() => setEntryOpen(false)} disabled={entryBusy}><X size={18} /></button>
            </div>
            <div className="aad-form">
              <div className="aad-field">
                <label>Type</label>
                <div className="aad-select-wrap">
                  <select
                    value={entryForm.entryType}
                    onChange={(e) => setEntryForm({ ...entryForm, entryType: e.target.value as any })}
                  >
                    <option value="invoice_received">Invoice received</option>
                    <option value="payment_made">Payment made</option>
                    <option value="adjustment">Adjustment</option>
                  </select>
                  <ChevronDown size={14} className="aad-select-icon" />
                </div>
                <span className="aad-hint">
                  {entryForm.entryType === 'adjustment'
                    ? 'Signed value: positive credits the affiliate, negative debits.'
                    : 'Positive amount.'}
                </span>
              </div>
              <div className="aad-field">
                <label>Amount (EUR)</label>
                <input
                  type="number"
                  step="0.01"
                  value={entryForm.amountEur}
                  onChange={(e) => setEntryForm({ ...entryForm, amountEur: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="aad-field">
                <label>Reference</label>
                <input
                  type="text"
                  value={entryForm.reference}
                  onChange={(e) => setEntryForm({ ...entryForm, reference: e.target.value })}
                  placeholder="Invoice number, payment ref, etc."
                />
              </div>
              <div className="aad-field">
                <label>Notes</label>
                <textarea
                  value={entryForm.notes}
                  onChange={(e) => setEntryForm({ ...entryForm, notes: e.target.value })}
                  rows={3}
                />
              </div>
              {entryError && <div className="aad-error"><AlertCircle size={14} /> {entryError}</div>}
              <div className="aad-actions">
                <button className="aad-btn-secondary" onClick={() => setEntryOpen(false)} disabled={entryBusy}>Cancel</button>
                <button className="aad-btn-primary" onClick={recordEntry} disabled={entryBusy || !entryForm.amountEur}>
                  {entryBusy ? 'Recording...' : 'Record entry'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="aad-modal-overlay" onClick={() => !editBusy && setEditOpen(false)}>
          <div className="aad-modal" onClick={(e) => e.stopPropagation()}>
            <div className="aad-modal-head">
              <h3>Edit affiliate</h3>
              <button className="aad-modal-close" onClick={() => setEditOpen(false)} disabled={editBusy}><X size={18} /></button>
            </div>
            <div className="aad-form">
              <div className="aad-field">
                <label>Display name</label>
                <input type="text" value={editForm.displayName} onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })} />
              </div>
              <div className="aad-field">
                <label>Contact email</label>
                <input type="email" value={editForm.contactEmail} onChange={(e) => setEditForm({ ...editForm, contactEmail: e.target.value })} />
              </div>
              <div className="aad-field-row">
                <div className="aad-field">
                  <label>Commission rate</label>
                  <input type="number" step="0.01" min="0" max="1" value={editForm.commissionRate} onChange={(e) => setEditForm({ ...editForm, commissionRate: e.target.value })} />
                  <span className="aad-hint">= {(Number(editForm.commissionRate) * 100).toFixed(1)}%</span>
                </div>
                <div className="aad-field">
                  <label>Window (months)</label>
                  <input type="number" min="1" max="60" value={editForm.commissionWindowMonths} onChange={(e) => setEditForm({ ...editForm, commissionWindowMonths: e.target.value })} />
                </div>
              </div>
              <div className="aad-field">
                <label className="aad-toggle">
                  <input type="checkbox" checked={editForm.enabled} onChange={(e) => setEditForm({ ...editForm, enabled: e.target.checked })} />
                  Enabled — affiliate's bonus code can be redeemed at signup
                </label>
              </div>
              {editError && <div className="aad-error"><AlertCircle size={14} /> {editError}</div>}
              <div className="aad-actions">
                <button className="aad-btn-secondary" onClick={() => setEditOpen(false)} disabled={editBusy}>Cancel</button>
                <button className="aad-btn-primary" onClick={saveEdits} disabled={editBusy}>
                  {editBusy ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

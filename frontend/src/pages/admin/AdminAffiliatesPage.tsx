/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserCheck, Plus, X, Loader, Search, ExternalLink, AlertCircle } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { usePageMeta } from '../../hooks/usePageMeta';
import './AdminAffiliatesPage.css';

interface Affiliate {
  id: string;
  bonusCode: string;
  displayName: string;
  contactEmail: string;
  commissionRate: number;
  commissionWindowMonths: number;
  enabled: boolean;
  createdAt: string;
  activeReferrals: number;
  totalReferrals: number;
  earnedEur: number;
  invoicedEur: number;
  paidEur: number;
  accruedBalanceEur: number;
  outstandingPayableEur: number;
  totalLiabilityEur: number;
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(n);
}

export default function AdminAffiliatesPage() {
  usePageMeta();
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState('');
  const [form, setForm] = useState({
    bonusCode: '',
    displayName: '',
    contactEmail: '',
    commissionRate: '0.20',
    commissionWindowMonths: '12',
  });

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch('/api/admin/affiliates', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAffiliates(data.affiliates || []);
    } catch {
      setError('Failed to load affiliates');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    setCreateBusy(true);
    setCreateError('');
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch('/api/admin/affiliates', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bonusCode: form.bonusCode.trim().toUpperCase(),
          displayName: form.displayName.trim(),
          contactEmail: form.contactEmail.trim(),
          commissionRate: Number(form.commissionRate),
          commissionWindowMonths: parseInt(form.commissionWindowMonths, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || 'Failed to create');
        return;
      }
      setCreateOpen(false);
      setForm({ bonusCode: '', displayName: '', contactEmail: '', commissionRate: '0.20', commissionWindowMonths: '12' });
      await load();
    } catch {
      setCreateError('Network error');
    } finally {
      setCreateBusy(false);
    }
  }

  const visible = affiliates.filter(a => {
    if (!search) return true;
    const s = search.toLowerCase();
    return a.bonusCode.toLowerCase().includes(s) ||
           a.displayName.toLowerCase().includes(s) ||
           a.contactEmail.toLowerCase().includes(s);
  });

  const totals = affiliates.reduce(
    (acc, a) => ({
      earned: acc.earned + a.earnedEur,
      outstanding: acc.outstanding + a.outstandingPayableEur,
      accrued: acc.accrued + a.accruedBalanceEur,
      activeRefs: acc.activeRefs + a.activeReferrals,
    }),
    { earned: 0, outstanding: 0, accrued: 0, activeRefs: 0 }
  );

  return (
    <div className="aa-page">
      <PageHeader title="Affiliates">
        <button className="aa-btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus size={16} /> Create affiliate
        </button>
      </PageHeader>

      <div className="aa-stats">
        <StatCard label="Affiliates" value={affiliates.length} color="blue" />
        <StatCard label="Active referrals" value={totals.activeRefs} color="blue" />
        <StatCard label="Total earned" value={fmtEur(totals.earned)} color="green" />
        <StatCard label="Accrued (uninvoiced)" value={fmtEur(totals.accrued)} color={totals.accrued > 0 ? 'amber' : 'green'} />
        <StatCard label="Outstanding to pay" value={fmtEur(totals.outstanding)} color={totals.outstanding > 0 ? 'red' : 'green'} />
      </div>

      <div className="aa-search">
        <Search size={16} className="aa-search-icon" />
        <input
          type="text"
          placeholder="Search by code, name, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && <div className="aa-state"><Loader size={20} className="aa-spin" /> Loading...</div>}
      {error && <div className="aa-state aa-error"><AlertCircle size={16} /> {error}</div>}
      {!loading && !error && visible.length === 0 && (
        <div className="aa-state">
          <UserCheck size={32} />
          <p>No affiliates yet. Create the first one to start tracking referrals.</p>
        </div>
      )}

      {!loading && !error && visible.length > 0 && (
        <table className="aa-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Active / Total</th>
              <th>Rate</th>
              <th>Earned</th>
              <th>Accrued</th>
              <th>Outstanding</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map(a => (
              <tr key={a.id} className={!a.enabled ? 'aa-disabled' : ''}>
                <td><code className="aa-code">{a.bonusCode}</code></td>
                <td>
                  <div className="aa-name">{a.displayName}</div>
                  <div className="aa-email">{a.contactEmail}</div>
                </td>
                <td>{a.activeReferrals} / {a.totalReferrals}</td>
                <td>{(a.commissionRate * 100).toFixed(1)}%</td>
                <td>{fmtEur(a.earnedEur)}</td>
                <td className={a.accruedBalanceEur > 0 ? 'aa-amber' : ''}>{fmtEur(a.accruedBalanceEur)}</td>
                <td className={a.outstandingPayableEur > 0 ? 'aa-red' : ''}>{fmtEur(a.outstandingPayableEur)}</td>
                <td>
                  <span className={`aa-pill ${a.enabled ? 'aa-pill-on' : 'aa-pill-off'}`}>
                    {a.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td>
                  <Link to={`/admin/affiliates/${a.id}`} className="aa-link">
                    Open <ExternalLink size={12} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {createOpen && (
        <div className="aa-modal-overlay" onClick={() => !createBusy && setCreateOpen(false)}>
          <div className="aa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="aa-modal-head">
              <h3>Create affiliate</h3>
              <button className="aa-modal-close" onClick={() => setCreateOpen(false)} disabled={createBusy}>
                <X size={18} />
              </button>
            </div>
            <div className="aa-form">
              <div className="aa-field">
                <label>Bonus code</label>
                <input
                  type="text"
                  value={form.bonusCode}
                  onChange={(e) => setForm({ ...form, bonusCode: e.target.value.toUpperCase() })}
                  placeholder="e.g. SAMK"
                  maxLength={32}
                />
                <span className="aa-hint">3–32 letters and digits. Customer-facing.</span>
              </div>
              <div className="aa-field">
                <label>Display name</label>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  placeholder="Sam Kynaston"
                />
              </div>
              <div className="aa-field">
                <label>Contact email</label>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  placeholder="sam@example.com"
                />
              </div>
              <div className="aa-field-row">
                <div className="aa-field">
                  <label>Commission rate</label>
                  <div className="aa-rate-input">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={form.commissionRate}
                      onChange={(e) => setForm({ ...form, commissionRate: e.target.value })}
                    />
                    <span>= {(Number(form.commissionRate) * 100).toFixed(1)}%</span>
                  </div>
                </div>
                <div className="aa-field">
                  <label>Window (months)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={form.commissionWindowMonths}
                    onChange={(e) => setForm({ ...form, commissionWindowMonths: e.target.value })}
                  />
                </div>
              </div>
              {createError && <div className="aa-error"><AlertCircle size={14} /> {createError}</div>}
              <div className="aa-actions">
                <button className="aa-btn-secondary" onClick={() => setCreateOpen(false)} disabled={createBusy}>
                  Cancel
                </button>
                <button
                  className="aa-btn-primary"
                  onClick={handleCreate}
                  disabled={createBusy || !form.bonusCode || !form.displayName || !form.contactEmail}
                >
                  {createBusy ? 'Creating...' : 'Create affiliate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

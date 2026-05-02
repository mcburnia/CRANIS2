/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import { useState, useEffect, useCallback } from 'react';
import { Clock, DollarSign, Building2, AlertTriangle, ChevronDown, X, Settings, Save, Loader2, Cpu } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { usePageMeta } from '../../hooks/usePageMeta';
import './AdminBillingPage.css';

interface OrgBilling {
  orgId: string;
  orgName: string;
  status: string;
  stripeCustomerId: string | null;
  contributorCount: number;
  monthlyAmountCents: number;
  trialEndsAt: string | null;
  trialDurationDays: number;
  currentPeriodEnd: string | null;
  exempt: boolean;
  exemptReason: string | null;
  paymentPauseUntil: string | null;
  cancelledAt: string | null;
  userCount: number;
  createdAt: string;
}

interface BillingOverview {
  orgs: OrgBilling[];
  totals: {
    totalOrgs: number;
    paying: number;
    trials: number;
    pastDue: number;
    exempt: number;
    cancelled: number;
    mrr: number;
  };
}

const STATUS_COLORS: Record<string, string> = {
  trial: 'abill-badge-blue',
  active: 'abill-badge-green',
  past_due: 'abill-badge-amber',
  read_only: 'abill-badge-red',
  suspended: 'abill-badge-red',
  cancelled: 'abill-badge-muted',
  exempt: 'abill-badge-green',
};

export default function AdminBillingPage() {
  usePageMeta();
  const [data, setData] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionOrgId, setActionOrgId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState('');
  const [modalType, setModalType] = useState<string | null>(null);
  const [modalOrgId, setModalOrgId] = useState<string | null>(null);
  const [modalValue, setModalValue] = useState('');
  const [modalReason, setModalReason] = useState('');
  const [pricingContributor, setPricingContributor] = useState('');
  const [pricingProProduct, setPricingProProduct] = useState('');
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingSaved, setPricingSaved] = useState(false);
  const [copilotUsage, setCopilotUsage] = useState<any>(null);

  const token = localStorage.getItem('session_token');

  const fetchData = useCallback(async () => {
    try {
      const [overviewRes, pricingRes, copilotRes] = await Promise.all([
        fetch('/api/billing/admin/overview', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/billing/admin/pricing', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/copilot-usage?months=3', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!overviewRes.ok) throw new Error('Failed to load billing overview');
      const d = await overviewRes.json();
      setData(d);

      if (pricingRes.ok) {
        const p = await pricingRes.json();
        setPricingContributor((p.contributorPriceCents / 100).toFixed(2));
        setPricingProProduct((p.proProductPriceCents / 100).toFixed(2));
      }
      if (copilotRes.ok) setCopilotUsage(await copilotRes.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSavePricing() {
    setPricingLoading(true);
    setPricingSaved(false);
    try {
      const res = await fetch('/api/billing/admin/pricing', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contributorPriceCents: Math.round(parseFloat(pricingContributor) * 100),
          proProductPriceCents: Math.round(parseFloat(pricingProProduct) * 100),
        }),
      });
      if (!res.ok) throw new Error('Failed to update pricing');
      setPricingSaved(true);
      setTimeout(() => setPricingSaved(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPricingLoading(false);
    }
  }

  async function handleAction(orgId: string, action: string, body: any) {
    setActionLoading(`${action}-${orgId}`);
    try {
      const res = await fetch(`/api/billing/admin/${orgId}/${action}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Failed to ${action}`);
      await fetchData();
      setModalType(null);
      setModalOrgId(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading('');
    }
  }

  function openModal(type: string, orgId: string) {
    setModalType(type);
    setModalOrgId(orgId);
    setModalValue('');
    setModalReason('');
    setActionOrgId(null);
  }

  function formatDate(d: string | null) {
    if (!d) return '–';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Billing Management" />
        <div className="abill-loading">Loading billing data...</div>
      </>
    );
  }

  const totals = data?.totals;
  const orgs = data?.orgs || [];
  const mrr = totals ? (totals.mrr / 100).toFixed(2) : '0.00';

  function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }
  const TYPE_LABELS: Record<string, string> = {
    technical_file: 'Technical File',
    obligation: 'Obligation',
    vulnerability_triage: 'Vulnerability Triage',
  };

  return (
    <>
      <PageHeader title="Billing Management" />

      {error && (
        <div className="abill-error">
          <AlertTriangle size={16} />
          {error}
          <button onClick={() => setError('')}>&times;</button>
        </div>
      )}

      <div className="stats">
        <StatCard label="Monthly Revenue" value={`\u20ac${mrr}`} color="green" sub="MRR" />
        <StatCard label="Paying Orgs" value={totals?.paying || 0} color="green" />
        <StatCard label="Trials" value={totals?.trials || 0} color="blue" />
        <StatCard label="Past Due" value={totals?.pastDue || 0} color={totals?.pastDue ? 'red' : 'green'} />
      </div>

      {/* Pricing Configuration */}
      <section className="abill-pricing-section">
        <h2><Settings size={18} /> Pricing Configuration</h2>
        <div className="abill-pricing-grid">
          <div className="abill-pricing-field">
            <label>Standard – per contributor/month</label>
            <div className="abill-pricing-input-group">
              <span className="abill-pricing-currency">&euro;</span>
              <input
                type="number"
                step="0.01"
                min="0"
                className="abill-pricing-input"
                value={pricingContributor}
                onChange={e => setPricingContributor(e.target.value)}
              />
            </div>
          </div>
          <div className="abill-pricing-field">
            <label>Pro – per product/month (+ contributor fee)</label>
            <div className="abill-pricing-input-group">
              <span className="abill-pricing-currency">&euro;</span>
              <input
                type="number"
                step="0.01"
                min="0"
                className="abill-pricing-input"
                value={pricingProProduct}
                onChange={e => setPricingProProduct(e.target.value)}
              />
            </div>
          </div>
          <div className="abill-pricing-actions">
            <button className="abill-btn abill-btn-primary" onClick={handleSavePricing} disabled={pricingLoading}>
              {pricingLoading ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
              {pricingLoading ? 'Saving…' : pricingSaved ? 'Saved!' : 'Save Pricing'}
            </button>
            <span className="abill-pricing-note">Changes apply to new subscriptions only.</span>
          </div>
        </div>
      </section>

      {/* AI Copilot Usage */}
      {copilotUsage && (
        <section className="abill-section">
          <h2><Cpu size={18} /> AI Copilot Usage – Platform</h2>

          <div className="stats" style={{ marginBottom: '1.25rem' }}>
            <StatCard label="AI Requests" value={copilotUsage.currentMonth.requests} color="blue" sub="this month" />
            <StatCard label="Active Orgs" value={copilotUsage.currentMonth.activeOrgs} color="green" sub="using copilot" />
            <StatCard label="Total Tokens" value={formatTokens(copilotUsage.currentMonth.inputTokens + copilotUsage.currentMonth.outputTokens)} color="amber" sub={`${formatTokens(copilotUsage.currentMonth.inputTokens)} in / ${formatTokens(copilotUsage.currentMonth.outputTokens)} out`} />
            <StatCard label="Estimated Cost" value={`$${copilotUsage.currentMonth.estimatedCostUsd.toFixed(2)}`} color="green" sub="USD this month" />
          </div>

          {/* Per-Org Usage */}
          {copilotUsage.byOrg.length > 0 && (
            <div className="abill-table-wrap" style={{ marginBottom: '1rem' }}>
              <table className="abill-table">
                <thead>
                  <tr>
                    <th>Organisation</th>
                    <th>Requests</th>
                    <th>Input Tokens</th>
                    <th>Output Tokens</th>
                    <th>Est. Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {copilotUsage.byOrg.map((o: any) => (
                    <tr key={o.orgId}>
                      <td>{o.orgName}</td>
                      <td>{o.requests}</td>
                      <td>{formatTokens(o.inputTokens)}</td>
                      <td>{formatTokens(o.outputTokens)}</td>
                      <td>${o.estimatedCostUsd.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* By Type */}
          {copilotUsage.byType.length > 0 && (
            <div className="abill-table-wrap">
              <table className="abill-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Requests</th>
                    <th>Tokens</th>
                    <th>Est. Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {copilotUsage.byType.map((t: any) => (
                    <tr key={t.type}>
                      <td>{TYPE_LABELS[t.type] || t.type}</td>
                      <td>{t.requests}</td>
                      <td>{formatTokens(t.inputTokens + t.outputTokens)}</td>
                      <td>${t.estimatedCostUsd.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {copilotUsage.currentMonth.requests === 0 && (
            <div className="abill-empty">No AI Copilot usage this month.</div>
          )}
        </section>
      )}

      <section className="abill-section">
        <h2>All Organisations</h2>
        <div className="abill-table-wrap">
          <table className="abill-table">
            <thead>
              <tr>
                <th>Organisation</th>
                <th>Status</th>
                <th>Contributors</th>
                <th>Monthly</th>
                <th>Trial / Period End</th>
                <th>Users</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map(org => (
                <tr key={org.orgId}>
                  <td>
                    <div className="abill-org-name">{org.orgName}</div>
                  </td>
                  <td>
                    <span className={`abill-badge ${STATUS_COLORS[org.status] || 'abill-badge-muted'}`}>
                      {org.status.replace('_', ' ')}
                    </span>
                    {org.exempt && <span className="abill-badge abill-badge-green abill-badge-sm">exempt</span>}
                    {org.paymentPauseUntil && new Date(org.paymentPauseUntil) > new Date() && (
                      <span className="abill-badge abill-badge-blue abill-badge-sm">paused</span>
                    )}
                  </td>
                  <td>{org.contributorCount}</td>
                  <td>&euro;{(org.monthlyAmountCents / 100).toFixed(2)}</td>
                  <td>
                    {org.status === 'trial'
                      ? formatDate(org.trialEndsAt)
                      : formatDate(org.currentPeriodEnd)}
                  </td>
                  <td>{org.userCount}</td>
                  <td>
                    <div className="abill-actions-cell">
                      <button
                        className="abill-action-btn"
                        onClick={() => setActionOrgId(actionOrgId === org.orgId ? null : org.orgId)}
                      >
                        <ChevronDown size={16} />
                      </button>
                      {actionOrgId === org.orgId && (
                        <div className="abill-dropdown">
                          <button onClick={() => openModal('trial', org.orgId)}>
                            <Clock size={14} /> Extend Trial
                          </button>
                          <button onClick={() => openModal('exempt', org.orgId)}>
                            <DollarSign size={14} /> {org.exempt ? 'Remove Exemption' : 'Exempt'}
                          </button>
                          <button onClick={() => openModal('pause', org.orgId)}>
                            <Building2 size={14} /> Payment Pause
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orgs.length === 0 && (
                <tr>
                  <td colSpan={7} className="abill-empty">No organisations found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Action modals */}
      {modalType && modalOrgId && (
        <div className="abill-modal-overlay" onClick={() => setModalType(null)}>
          <div className="abill-modal" onClick={e => e.stopPropagation()}>
            <div className="abill-modal-header">
              <h3>
                {modalType === 'trial' && 'Extend Trial'}
                {modalType === 'exempt' && 'Toggle Exemption'}
                {modalType === 'pause' && 'Payment Pause'}
              </h3>
              <button className="abill-modal-close" onClick={() => setModalType(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="abill-modal-body">
              {modalType === 'trial' && (
                <>
                  <label>Days to add:</label>
                  <input
                    type="number"
                    value={modalValue}
                    onChange={e => setModalValue(e.target.value)}
                    placeholder="30"
                    min="1"
                    max="365"
                  />
                </>
              )}
              {modalType === 'exempt' && (
                <>
                  <label>Reason:</label>
                  <input
                    type="text"
                    value={modalReason}
                    onChange={e => setModalReason(e.target.value)}
                    placeholder="e.g., Internal testing, Partner account"
                  />
                </>
              )}
              {modalType === 'pause' && (
                <>
                  <label>Pause duration (days):</label>
                  <input
                    type="number"
                    value={modalValue}
                    onChange={e => setModalValue(e.target.value)}
                    placeholder="30"
                    min="1"
                    max="180"
                  />
                  <label>Reason:</label>
                  <input
                    type="text"
                    value={modalReason}
                    onChange={e => setModalReason(e.target.value)}
                    placeholder="e.g., Customer on holiday, financial hardship"
                  />
                </>
              )}
            </div>
            <div className="abill-modal-actions">
              <button className="abill-btn-cancel" onClick={() => setModalType(null)}>Cancel</button>
              <button
                className="abill-btn-confirm"
                disabled={!!actionLoading}
                onClick={() => {
                  if (modalType === 'trial') {
                    handleAction(modalOrgId!, 'trial', { daysToAdd: parseInt(modalValue) || 30 });
                  } else if (modalType === 'exempt') {
                    const org = orgs.find(o => o.orgId === modalOrgId);
                    handleAction(modalOrgId!, 'exempt', { exempt: !org?.exempt, reason: modalReason });
                  } else if (modalType === 'pause') {
                    handleAction(modalOrgId!, 'pause', { days: parseInt(modalValue) || 30, reason: modalReason });
                  }
                }}
              >
                {actionLoading ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

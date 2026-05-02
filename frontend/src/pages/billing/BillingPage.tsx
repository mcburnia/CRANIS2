/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, ExternalLink, UserMinus, UserPlus, RefreshCw, CheckCircle2, AlertTriangle, Sparkles, Loader2, Cpu, Globe, Save } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { usePageMeta } from '../../hooks/usePageMeta';
import './BillingPage.css';

interface ContributorInfo {
  githubLogin: string;
  githubId: number;
  avatarUrl: string;
  contributions: number;
  lastCommitAt: string | null;
  category: 'active' | 'bot' | 'departed' | 'inactive';
}

interface BillingStatus {
  status: string;
  plan: string;
  trialEndsAt: string | null;
  trialDaysRemaining: number | null;
  currentPeriodEnd: string | null;
  contributorCounts: {
    active: number;
    bots: number;
    departed: number;
    inactive: number;
    total: number;
    contributors: ContributorInfo[];
  };
  productCount: number;
  monthlyAmountCents: number;
  pricePerContributor: number;
  pricing: {
    contributorPriceCents: number;
    proProductPriceCents: number;
  };
  standardMonthlyCents: number;
  proMonthlyCents: number;
  stripeCustomerId: string | null;
  exempt: boolean;
  exemptReason: string | null;
  cancelledAt: string | null;
  graceEndsAt: string | null;
  billingEmail: string | null;
  companyName: string | null;
  vatNumber: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: 'green' | 'amber' | 'red' | 'blue' }> = {
  trial: { label: 'Free Trial', color: 'blue' },
  active: { label: 'Active', color: 'green' },
  past_due: { label: 'Past Due', color: 'amber' },
  read_only: { label: 'Read Only', color: 'red' },
  suspended: { label: 'Suspended', color: 'red' },
  cancelled: { label: 'Cancelled', color: 'red' },
  exempt: { label: 'Exempt', color: 'green' },
  none: { label: 'No Plan', color: 'blue' },
};

export default function BillingPage() {
  usePageMeta();
  const [searchParams] = useSearchParams();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [copilotUsage, setCopilotUsage] = useState<any>(null);
  const [csirtCountry, setCsirtCountry] = useState('');
  const [csirtSaving, setCsirtSaving] = useState(false);
  const [csirtSaved, setCsirtSaved] = useState(false);

  const token = localStorage.getItem('session_token');

  const fetchCopilotUsage = useCallback(async () => {
    try {
      const res = await fetch('/api/copilot/usage?months=3', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setCopilotUsage(await res.json());
    } catch { /* non-critical */ }
  }, [token]);

  const fetchBilling = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load billing');
      const data = await res.json();
      setBilling(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchBilling();
    fetchCopilotUsage();
    // Fetch org CSIRT country
    fetch('/api/billing/csirt-country', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.csirtCountry) setCsirtCountry(data.csirtCountry); })
      .catch(() => {});
  }, [fetchBilling, fetchCopilotUsage]);

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setSuccessMessage('Subscription activated successfully! Welcome to CRANIS2.');
      window.history.replaceState({}, '', '/billing');
    }
    if (searchParams.get('cancelled') === 'true') {
      window.history.replaceState({}, '', '/billing');
    }
  }, [searchParams]);

  async function handleCheckout(plan: 'standard' | 'pro' = 'standard') {
    setActionLoading(`checkout-${plan}`);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) throw new Error('Failed to create checkout');
      const { url } = await res.json();
      window.location.href = url;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading('');
    }
  }

  async function handleUpgrade() {
    setActionLoading('upgrade');
    try {
      const res = await fetch('/api/billing/upgrade', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to upgrade');
      }
      setSuccessMessage('Upgraded to Pro! AI Copilot features are now available.');
      await fetchBilling();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading('');
    }
  }

  async function handleDowngrade() {
    if (!confirm('Downgrade to Standard? You will lose access to AI Copilot features.')) return;
    setActionLoading('downgrade');
    try {
      const res = await fetch('/api/billing/downgrade', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to downgrade');
      }
      setSuccessMessage('Downgraded to Standard.');
      await fetchBilling();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading('');
    }
  }

  async function handlePortal() {
    setActionLoading('portal');
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to open billing portal');
      const { url } = await res.json();
      window.location.href = url;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading('');
    }
  }

  async function handleMarkDeparted(login: string) {
    setActionLoading(`depart-${login}`);
    try {
      const res = await fetch(`/api/billing/contributors/${login}/departed`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to mark contributor');
      await fetchBilling();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading('');
    }
  }

  async function handleUnmarkDeparted(login: string) {
    setActionLoading(`undepart-${login}`);
    try {
      const res = await fetch(`/api/billing/contributors/${login}/departed`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to un-mark contributor');
      await fetchBilling();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading('');
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Billing" />
        <div className="bill-loading">Loading billing information...</div>
      </>
    );
  }

  if (error && !billing) {
    return (
      <>
        <PageHeader title="Billing" />
        <div className="bill-error">{error}</div>
      </>
    );
  }

  const status = billing?.status || 'none';
  const plan = billing?.plan || 'standard';
  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS.none;
  const monthlyCost = billing ? (billing.monthlyAmountCents / 100).toFixed(2) : '0.00';
  const nextInvoice = billing?.currentPeriodEnd
    ? new Date(billing.currentPeriodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'N/A';
  const contributors = billing?.contributorCounts?.contributors || [];
  const activeCount = billing?.contributorCounts?.active || 0;
  const productCount = billing?.productCount || 0;
  const contribPrice = billing?.pricing?.contributorPriceCents ?? 600;
  const proProductPrice = billing?.pricing?.proProductPriceCents ?? 2000;
  const planLabel = plan === 'pro' ? 'Pro' : 'Standard';
  const hasCopilotAccess = billing?.exempt || plan === 'pro' || plan === 'enterprise';

  function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  const TYPE_LABELS: Record<string, string> = {
    technical_file: 'Technical File',
    obligation: 'Obligation',
    vulnerability_triage: 'Vulnerability Triage',
    incident_report_draft: 'Incident Report Draft',
    risk_assessment: 'Risk Assessment',
  };

  const EU_COUNTRIES: Record<string, string> = {
    AT: 'Austria', BE: 'Belgium', BG: 'Bulgaria', HR: 'Croatia',
    CY: 'Cyprus', CZ: 'Czechia', DK: 'Denmark', EE: 'Estonia',
    FI: 'Finland', FR: 'France', DE: 'Germany', GR: 'Greece',
    HU: 'Hungary', IE: 'Ireland', IT: 'Italy', LV: 'Latvia',
    LT: 'Lithuania', LU: 'Luxembourg', MT: 'Malta', NL: 'Netherlands',
    PL: 'Poland', PT: 'Portugal', RO: 'Romania', SK: 'Slovakia',
    SI: 'Slovenia', ES: 'Spain', SE: 'Sweden',
  };

  async function handleSaveCsirt() {
    setCsirtSaving(true);
    setCsirtSaved(false);
    try {
      const res = await fetch('/api/billing/csirt-country', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ csirtCountry: csirtCountry || null }),
      });
      if (res.ok) {
        setCsirtSaved(true);
        setTimeout(() => setCsirtSaved(false), 3000);
      }
    } catch { /* ignore */ }
    finally { setCsirtSaving(false); }
  }

  return (
    <>
      <PageHeader title="Billing">
        {billing?.stripeCustomerId && (
          <button
            className="bill-btn bill-btn-secondary"
            onClick={handlePortal}
            disabled={!!actionLoading}
          >
            <CreditCard size={16} />
            {actionLoading === 'portal' ? 'Opening...' : 'Manage Billing'}
            <ExternalLink size={14} />
          </button>
        )}
      </PageHeader>

      {/* Success banner */}
      {successMessage && (
        <div className="bill-banner bill-banner-success">
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage('')}>&times;</button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="bill-banner bill-banner-error">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button onClick={() => setError('')}>&times;</button>
        </div>
      )}

      {/* Trial banner */}
      {status === 'trial' && billing?.trialDaysRemaining !== null && (
        <div className={`bill-banner ${(billing?.trialDaysRemaining ?? 0) <= 7 ? 'bill-banner-warning' : 'bill-banner-info'}`}>
          <span>
            You&apos;re on a <strong>free trial</strong>.{' '}
            {billing?.graceEndsAt
              ? 'Your trial has ended. Upgrade within the grace period to keep full access.'
              : `${billing?.trialDaysRemaining} days remaining.`}
          </span>
          <button className="bill-btn bill-btn-primary bill-btn-sm" onClick={() => handleCheckout('standard')} disabled={!!actionLoading}>
            {actionLoading ? 'Processing...' : 'Choose a Plan'}
          </button>
        </div>
      )}

      {/* Past due banner */}
      {status === 'past_due' && (
        <div className="bill-banner bill-banner-warning">
          <AlertTriangle size={18} />
          <span>
            <strong>Payment issue.</strong> Your last payment failed.
            {billing?.graceEndsAt && ` Grace period ends ${new Date(billing.graceEndsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.`}
          </span>
          <button className="bill-btn bill-btn-primary bill-btn-sm" onClick={handlePortal} disabled={!!actionLoading}>
            Update Payment Method
          </button>
        </div>
      )}

      {/* Read only / suspended banner */}
      {(status === 'read_only' || status === 'suspended') && (
        <div className="bill-banner bill-banner-error">
          <AlertTriangle size={18} />
          <span>
            <strong>Account {status === 'read_only' ? 'restricted' : 'suspended'}.</strong>{' '}
            {status === 'read_only'
              ? 'Your account is in read-only mode due to a billing issue.'
              : 'Your account has been suspended. Please subscribe to restore access.'}
          </span>
          {billing?.stripeCustomerId ? (
            <button className="bill-btn bill-btn-primary bill-btn-sm" onClick={handlePortal} disabled={!!actionLoading}>
              Update Payment
            </button>
          ) : (
            <button className="bill-btn bill-btn-primary bill-btn-sm" onClick={() => handleCheckout('standard')} disabled={!!actionLoading}>
              Subscribe Now
            </button>
          )}
        </div>
      )}

      {/* Stat cards */}
      <div className="stats">
        <StatCard
          label="Plan"
          value={status === 'active' ? planLabel : statusInfo.label}
          color={statusInfo.color}
          sub={status === 'active' ? 'subscription' : undefined}
        />
        <StatCard
          label="Contributors"
          value={activeCount}
          color="blue"
          sub="billable this month"
        />
        <StatCard
          label="Monthly Cost"
          value={`\u20ac${monthlyCost}`}
          color="green"
          sub={status === 'active' ? `next invoice ${nextInvoice}` : undefined}
        />
        <StatCard
          label="Status"
          value={statusInfo.label}
          color={statusInfo.color}
        />
      </div>

      {/* Contributor roster */}
      <section className="bill-section">
        <div className="bill-section-header">
          <h2>Contributor Roster</h2>
          <button className="bill-btn bill-btn-ghost" onClick={fetchBilling} title="Refresh">
            <RefreshCw size={16} />
          </button>
        </div>
        <p className="bill-section-desc">
          Active contributors are billed at <strong>&euro;{(contribPrice / 100).toFixed(2)}/month</strong> each.
          Bots and departed contributors are excluded from billing.
        </p>
        {contributors.length === 0 ? (
          <div className="bill-empty">No contributors found. Sync a product with a GitHub repository to see contributors.</div>
        ) : (
          <div className="bill-table-wrap">
            <table className="bill-table">
              <thead>
                <tr>
                  <th>Contributor</th>
                  <th>Contributions</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contributors.map(c => (
                  <tr key={c.githubLogin} className={c.category !== 'active' ? 'bill-row-muted' : ''}>
                    <td>
                      <div className="bill-contributor">
                        {c.avatarUrl && <img src={c.avatarUrl} alt="" className="bill-avatar" />}
                        <span className="bill-login">{c.githubLogin}</span>
                      </div>
                    </td>
                    <td>{c.contributions}</td>
                    <td>
                      <span className={`bill-badge bill-badge-${c.category}`}>
                        {c.category === 'active' ? 'Active' :
                         c.category === 'bot' ? 'Bot' :
                         c.category === 'departed' ? 'Departed' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      {c.category === 'active' && (
                        <button
                          className="bill-btn bill-btn-ghost bill-btn-sm"
                          onClick={() => handleMarkDeparted(c.githubLogin)}
                          disabled={actionLoading === `depart-${c.githubLogin}`}
                          title="Mark as departed"
                        >
                          <UserMinus size={14} />
                          {actionLoading === `depart-${c.githubLogin}` ? '...' : 'Mark Departed'}
                        </button>
                      )}
                      {c.category === 'departed' && (
                        <button
                          className="bill-btn bill-btn-ghost bill-btn-sm"
                          onClick={() => handleUnmarkDeparted(c.githubLogin)}
                          disabled={actionLoading === `undepart-${c.githubLogin}`}
                          title="Restore contributor"
                        >
                          <UserPlus size={14} />
                          {actionLoading === `undepart-${c.githubLogin}` ? '...' : 'Restore'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Plan section */}
      <section className="bill-section">
        <h2>Subscription</h2>

        {/* Trial or Cancelled – show both plan cards */}
        {(status === 'trial' || status === 'cancelled' || status === 'read_only' || status === 'suspended') && (
          <>
            {status === 'cancelled' && (
              <div className="bill-plan-cancelled-notice">
                {billing?.currentPeriodEnd
                  ? `Access continues until ${nextInvoice}. After that, your account will become read-only.`
                  : 'Your account will become read-only soon.'}
                {' '}Your data will be retained for 12 months.
              </div>
            )}
            <div className="bill-plans-grid">
              {/* Standard Plan */}
              <div className="bill-plan-card">
                <div className="bill-plan-info">
                  <h3>Standard</h3>
                  <div className="bill-plan-price">
                    <span className="bill-plan-amount">&euro;{(contribPrice / 100).toFixed(2)}</span>
                    <span className="bill-plan-unit">/ contributor / month</span>
                  </div>
                  <p className="bill-plan-estimate">
                    Estimated: <strong>&euro;{((billing?.standardMonthlyCents ?? 0) / 100).toFixed(2)}/month</strong>
                    {' '}({activeCount} contributor{activeCount !== 1 ? 's' : ''})
                  </p>
                  <ul className="bill-plan-features">
                    <li>Unlimited products &amp; repositories</li>
                    <li>Full CRA/NIS2 compliance tooling</li>
                    <li>Automatic vulnerability scanning</li>
                    <li>IP proof timestamping</li>
                    <li>Due diligence report exports</li>
                    <li>Automatic VAT/tax handling</li>
                  </ul>
                </div>
                <button
                  className="bill-btn bill-btn-secondary"
                  onClick={() => handleCheckout('standard')}
                  disabled={!!actionLoading}
                >
                  {actionLoading === 'checkout-standard' ? <Loader2 size={14} className="spin" /> : null}
                  {actionLoading === 'checkout-standard' ? 'Processing…' : status === 'cancelled' ? 'Resubscribe Standard' : 'Subscribe to Standard'}
                </button>
              </div>

              {/* Pro Plan */}
              <div className="bill-plan-card bill-plan-card-pro">
                <div className="bill-plan-recommended">Recommended</div>
                <div className="bill-plan-info">
                  <h3><Sparkles size={16} /> Pro</h3>
                  <div className="bill-plan-price">
                    <span className="bill-plan-amount">&euro;{(proProductPrice / 100).toFixed(2)}</span>
                    <span className="bill-plan-unit">/ product / month</span>
                  </div>
                  <div className="bill-plan-price-sub">
                    + &euro;{(contribPrice / 100).toFixed(2)} / contributor / month
                  </div>
                  <p className="bill-plan-estimate">
                    Estimated: <strong>&euro;{((billing?.proMonthlyCents ?? 0) / 100).toFixed(2)}/month</strong>
                    {' '}({productCount} product{productCount !== 1 ? 's' : ''} + {activeCount} contributor{activeCount !== 1 ? 's' : ''})
                  </p>
                  <ul className="bill-plan-features">
                    <li>Everything in Standard</li>
                    <li><strong>AI Copilot</strong> – AI-generated technical file drafts</li>
                    <li><strong>AI Copilot</strong> – AI-generated obligation evidence</li>
                    <li>Priority support</li>
                  </ul>
                </div>
                <button
                  className="bill-btn bill-btn-primary"
                  onClick={() => handleCheckout('pro')}
                  disabled={!!actionLoading}
                >
                  {actionLoading === 'checkout-pro' ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                  {actionLoading === 'checkout-pro' ? 'Processing…' : status === 'cancelled' ? 'Resubscribe Pro' : 'Subscribe to Pro'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Active – show current plan with upgrade/downgrade */}
        {status === 'active' && (
          <div className={`bill-plan-card ${plan === 'pro' ? 'bill-plan-card-pro' : ''}`}>
            <div className="bill-plan-info">
              <h3>{plan === 'pro' && <Sparkles size={16} />} {planLabel} Plan – Active</h3>
              {plan === 'pro' ? (
                <p>
                  {productCount} product{productCount !== 1 ? 's' : ''} &times; &euro;{(proProductPrice / 100).toFixed(2)}/month
                  {' '}+ {activeCount} contributor{activeCount !== 1 ? 's' : ''} &times; &euro;{(contribPrice / 100).toFixed(2)}/month
                  {' '}= <strong>&euro;{monthlyCost}/month</strong>
                </p>
              ) : (
                <p>
                  {activeCount} contributor{activeCount !== 1 ? 's' : ''} &times; &euro;{(contribPrice / 100).toFixed(2)}/month = <strong>&euro;{monthlyCost}/month</strong>
                </p>
              )}
              {billing?.currentPeriodEnd && (
                <p className="bill-plan-period">Current period ends {nextInvoice}</p>
              )}
            </div>
            <div className="bill-plan-actions">
              <button
                className="bill-btn bill-btn-secondary"
                onClick={handlePortal}
                disabled={!!actionLoading}
              >
                <CreditCard size={16} />
                {actionLoading === 'portal' ? 'Opening...' : 'Manage Subscription'}
                <ExternalLink size={14} />
              </button>
              {plan === 'standard' && (
                <button
                  className="bill-btn bill-btn-primary"
                  onClick={handleUpgrade}
                  disabled={!!actionLoading}
                >
                  {actionLoading === 'upgrade' ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                  {actionLoading === 'upgrade' ? 'Upgrading…' : 'Upgrade to Pro'}
                </button>
              )}
              {plan === 'pro' && (
                <button
                  className="bill-btn bill-btn-ghost bill-btn-sm"
                  onClick={handleDowngrade}
                  disabled={!!actionLoading}
                >
                  {actionLoading === 'downgrade' ? 'Downgrading…' : 'Downgrade to Standard'}
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Enterprise section */}
      <section className="bill-section">
        <h2>Enterprise</h2>
        <div className="bill-plan-card bill-plan-enterprise">
          <div className="bill-plan-info">
            <h3>Need more?</h3>
            <p>
              For teams requiring custom SLAs, dedicated support, on-premise deployment,
              or compliance consulting, contact our sales team.
            </p>
          </div>
          <a href="mailto:sales@cranis2.com" className="bill-btn bill-btn-secondary">
            Contact Sales
          </a>
        </div>
      </section>

      {/* ENISA / CSIRT Settings */}
      <section className="bill-section">
        <div className="bill-section-header">
          <h2><Globe size={18} /> ENISA Reporting Settings</h2>
        </div>
        <p className="bill-section-desc">
          Set your organisation&apos;s designated CSIRT country (CRA Article 14). This will be pre-selected when creating new ENISA reports.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.75rem' }}>
          <select
            value={csirtCountry}
            onChange={e => { setCsirtCountry(e.target.value); setCsirtSaved(false); }}
            style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.875rem', minWidth: '220px' }}
          >
            <option value="">No default CSIRT</option>
            {Object.entries(EU_COUNTRIES).sort((a, b) => a[1].localeCompare(b[1])).map(([code, name]) => (
              <option key={code} value={code}>{name} ({code})</option>
            ))}
          </select>
          <button className="bill-btn bill-btn-primary bill-btn-sm" onClick={handleSaveCsirt} disabled={csirtSaving}>
            {csirtSaving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
            {csirtSaving ? 'Saving…' : 'Save'}
          </button>
          {csirtSaved && <span style={{ fontSize: '0.8rem', color: 'var(--green)' }}>Saved</span>}
        </div>
      </section>

      {/* AI Copilot Usage */}
      {hasCopilotAccess && copilotUsage && (
        <section className="bill-section">
          <div className="bill-section-header">
            <h2><Cpu size={18} /> AI Copilot Usage</h2>
          </div>
          <p className="bill-section-desc">
            Token usage and estimated cost for AI Copilot features this month.
            Cost estimates based on Anthropic Sonnet pricing.
          </p>

          <div className="stats" style={{ marginBottom: '1.25rem' }}>
            <StatCard label="AI Requests" value={copilotUsage.currentMonth.requests} color="blue" sub="this month" />
            <StatCard label="Tokens Used" value={formatTokens(copilotUsage.currentMonth.inputTokens + copilotUsage.currentMonth.outputTokens)} color="amber" sub={`${formatTokens(copilotUsage.currentMonth.inputTokens)} in / ${formatTokens(copilotUsage.currentMonth.outputTokens)} out`} />
            <StatCard label="Estimated Cost" value={`$${copilotUsage.currentMonth.estimatedCostUsd.toFixed(2)}`} color="green" sub="USD this month" />
          </div>

          {/* By Type */}
          {copilotUsage.byType.length > 0 && (
            <div className="bill-table-wrap" style={{ marginBottom: '1rem' }}>
              <table className="bill-table">
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

          {/* By Product */}
          {copilotUsage.byProduct.length > 0 && (
            <div className="bill-table-wrap">
              <table className="bill-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Requests</th>
                    <th>Tokens</th>
                    <th>Est. Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {copilotUsage.byProduct.map((p: any) => (
                    <tr key={p.productId}>
                      <td>{p.productName}</td>
                      <td>{p.requests}</td>
                      <td>{formatTokens(p.inputTokens + p.outputTokens)}</td>
                      <td>${p.estimatedCostUsd.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* History */}
          {copilotUsage.history.length > 1 && (
            <div className="bill-table-wrap" style={{ marginTop: '1rem' }}>
              <table className="bill-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Requests</th>
                    <th>Tokens</th>
                    <th>Est. Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {copilotUsage.history.map((h: any) => (
                    <tr key={h.month}>
                      <td>{new Date(h.month).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</td>
                      <td>{h.requests}</td>
                      <td>{formatTokens(h.inputTokens + h.outputTokens)}</td>
                      <td>${h.estimatedCostUsd.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}

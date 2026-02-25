import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, ExternalLink, UserMinus, UserPlus, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
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
  monthlyAmountCents: number;
  pricePerContributor: number;
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
  const [searchParams] = useSearchParams();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const token = localStorage.getItem('session_token');

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
  }, [fetchBilling]);

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setSuccessMessage('Subscription activated successfully! Welcome to CRANIS2 Standard.');
      // Clear the URL param
      window.history.replaceState({}, '', '/billing');
    }
    if (searchParams.get('cancelled') === 'true') {
      // User cancelled checkout — no message needed
      window.history.replaceState({}, '', '/billing');
    }
  }, [searchParams]);

  async function handleCheckout() {
    setActionLoading('checkout');
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
  const statusInfo = STATUS_LABELS[status] || STATUS_LABELS.none;
  const monthlyCost = billing ? (billing.monthlyAmountCents / 100).toFixed(2) : '0.00';
  const nextInvoice = billing?.currentPeriodEnd
    ? new Date(billing.currentPeriodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'N/A';
  const contributors = billing?.contributorCounts?.contributors || [];
  const activeCount = billing?.contributorCounts?.active || 0;

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
          <button className="bill-btn bill-btn-primary bill-btn-sm" onClick={handleCheckout} disabled={!!actionLoading}>
            {actionLoading === 'checkout' ? 'Processing...' : 'Upgrade to Standard'}
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
            <button className="bill-btn bill-btn-primary bill-btn-sm" onClick={handleCheckout} disabled={!!actionLoading}>
              Subscribe Now
            </button>
          )}
        </div>
      )}

      {/* Stat cards */}
      <div className="stats">
        <StatCard
          label="Plan"
          value={statusInfo.label}
          color={statusInfo.color}
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
          Active contributors are billed at <strong>&euro;6/month</strong> each.
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
        {status === 'trial' && (
          <div className="bill-plan-card">
            <div className="bill-plan-info">
              <h3>Standard Plan</h3>
              <p>&euro;6 per active contributor per month</p>
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
              className="bill-btn bill-btn-primary"
              onClick={handleCheckout}
              disabled={!!actionLoading}
            >
              {actionLoading === 'checkout' ? 'Processing...' : 'Upgrade to Standard'}
            </button>
          </div>
        )}
        {status === 'active' && (
          <div className="bill-plan-card">
            <div className="bill-plan-info">
              <h3>Standard Plan — Active</h3>
              <p>
                {activeCount} contributor{activeCount !== 1 ? 's' : ''} &times; &euro;6/month = <strong>&euro;{monthlyCost}/month</strong>
              </p>
              {billing?.currentPeriodEnd && (
                <p className="bill-plan-period">Current period ends {nextInvoice}</p>
              )}
            </div>
            <button
              className="bill-btn bill-btn-secondary"
              onClick={handlePortal}
              disabled={!!actionLoading}
            >
              <CreditCard size={16} />
              {actionLoading === 'portal' ? 'Opening...' : 'Manage Subscription'}
              <ExternalLink size={14} />
            </button>
          </div>
        )}
        {status === 'cancelled' && (
          <div className="bill-plan-card bill-plan-cancelled">
            <div className="bill-plan-info">
              <h3>Subscription Cancelled</h3>
              <p>
                {billing?.currentPeriodEnd
                  ? `Access continues until ${nextInvoice}. After that, your account will become read-only.`
                  : 'Your account will become read-only soon.'}
              </p>
              <p>Your data will be retained for 12 months.</p>
            </div>
            <button
              className="bill-btn bill-btn-primary"
              onClick={handleCheckout}
              disabled={!!actionLoading}
            >
              {actionLoading === 'checkout' ? 'Processing...' : 'Resubscribe'}
            </button>
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
    </>
  );
}

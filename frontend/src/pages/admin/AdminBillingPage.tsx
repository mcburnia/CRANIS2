import { useState, useEffect, useCallback } from 'react';
import { Clock, DollarSign, Building2, AlertTriangle, ChevronDown, X } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
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
  const [data, setData] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionOrgId, setActionOrgId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState('');
  const [modalType, setModalType] = useState<string | null>(null);
  const [modalOrgId, setModalOrgId] = useState<string | null>(null);
  const [modalValue, setModalValue] = useState('');
  const [modalReason, setModalReason] = useState('');

  const token = localStorage.getItem('session_token');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/admin/overview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load billing overview');
      const d = await res.json();
      setData(d);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
    if (!d) return '—';
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

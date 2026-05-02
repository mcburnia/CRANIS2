/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import { useState, useEffect } from 'react';
import { Building2, Users, Package, AlertTriangle, ChevronDown, ChevronRight, Shield, FileText, Loader, Search, ExternalLink, CheckCircle, MoreVertical, Trash2, Crown, Calendar, RefreshCw, Tag } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { usePageMeta } from '../../hooks/usePageMeta';
import './AdminOrgsPage.css';

interface OrgVulns { total: number; critical: number; high: number; open: number }
interface OrgObligations { total: number; met: number }

interface Org {
  id: string;
  name: string;
  country: string | null;
  craRole: string | null;
  industry: string | null;
  companySize: string | null;
  createdAt: string | null;
  productCount: number;
  repoCount: number;
  userCount: number;
  lastActivity: string | null;
  vulnerabilities: OrgVulns;
  obligations: OrgObligations;
  plan: string;
  billingStatus: string;
  trustClassification: string;
  trustScore: number;
  commercialSignalScore: number;
}

interface OrgDetailUser {
  id: string;
  email: string;
  orgRole: string;
  emailVerified: boolean;
  isPlatformAdmin: boolean;
  createdAt: string;
}

interface OrgDetailProduct {
  id: string;
  name: string;
  category: string;
  lifecycle: string | null;
  repoFullName: string | null;
  hasRepo: boolean;
  contributors: number;
  dependencies: number;
  vulnerabilities: OrgVulns;
  techFile: { total: number; completed: number };
}

interface OrgDetail {
  org: { id: string; name: string; country: string; craRole: string; industry: string; companySize: string; createdAt: string };
  users: OrgDetailUser[];
  products: OrgDetailProduct[];
  recentEvents: { eventType: string; createdAt: string; userEmail: string; metadata: any }[];
}

const CRA_ROLE_LABELS: Record<string, string> = {
  manufacturer: 'Manufacturer',
  importer: 'Importer',
  distributor: 'Distributor',
  open_source_steward: 'Open Source Steward',
};

const CATEGORY_LABELS: Record<string, string> = {
  default: 'Default',
  important_i: 'Important I',
  important_ii: 'Important II',
  critical: 'Critical',
};

const TRUST_LABELS: Record<string, { label: string; colour: string }> = {
  commercial: { label: 'Commercial', colour: '#6b7280' },
  provisional_open_source: { label: 'Provisional OSS', colour: '#f59e0b' },
  trusted_open_source: { label: 'Trusted OSS', colour: '#22c55e' },
  community_project: { label: 'Community', colour: '#3b82f6' },
  verified_nonprofit: { label: 'Non-Profit', colour: '#8b5cf6' },
  review_required: { label: 'Review', colour: '#ef4444' },
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AdminOrgsPage() {
  usePageMeta();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [totals, setTotals] = useState({ totalOrgs: 0, totalUsers: 0, totalProducts: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [orgDetail, setOrgDetail] = useState<OrgDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ orgId: string; orgName: string; action: 'change_plan' | 'extend_trial' | 'delete' | 'evaluate_trust' | 'set_trust' } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'standard' | 'pro'>('standard');
  const [trialDays, setTrialDays] = useState(30);
  const [selectedTrust, setSelectedTrust] = useState('commercial');
  const [trustReason, setTrustReason] = useState('');

  useEffect(() => { fetchOrgs(); }, []);

  async function fetchOrgs() {
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch('/api/admin/orgs', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setOrgs(data.orgs);
      setTotals(data.totals);
    } catch {
      setError('Failed to load organisations');
    } finally {
      setLoading(false);
    }
  }

  async function toggleOrg(orgId: string) {
    if (expandedOrg === orgId) {
      setExpandedOrg(null);
      setOrgDetail(null);
      return;
    }
    setExpandedOrg(orgId);
    setDetailLoading(true);
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`/api/admin/orgs/${orgId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setOrgDetail(data);
    } catch {
      setOrgDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  function openAction(orgId: string, orgName: string, action: 'change_plan' | 'extend_trial' | 'delete' | 'evaluate_trust' | 'set_trust') {
    const org = orgs.find(o => o.id === orgId);
    if (action === 'change_plan' && org) setSelectedPlan(org.plan === 'pro' ? 'pro' : 'standard');
    if (action === 'extend_trial') setTrialDays(30);
    setConfirmAction({ orgId, orgName, action });
    setActionMenuId(null);
    setActionError('');
  }

  async function handleChangePlan() {
    if (!confirmAction) return;
    setActionLoading(true);
    setActionError('');
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`/api/admin/orgs/${confirmAction.orgId}/plan`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selectedPlan }),
      });
      if (!res.ok) { const d = await res.json(); setActionError(d.error || 'Failed'); return; }
      setConfirmAction(null);
      await fetchOrgs();
    } catch { setActionError('Network error'); }
    finally { setActionLoading(false); }
  }

  async function handleExtendTrial() {
    if (!confirmAction) return;
    setActionLoading(true);
    setActionError('');
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`/api/billing/admin/${confirmAction.orgId}/trial`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysToAdd: trialDays }),
      });
      if (!res.ok) { const d = await res.json(); setActionError(d.error || 'Failed'); return; }
      setConfirmAction(null);
      await fetchOrgs();
    } catch { setActionError('Network error'); }
    finally { setActionLoading(false); }
  }

  async function handleDeleteOrg() {
    if (!confirmAction) return;
    setActionLoading(true);
    setActionError('');
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`/api/admin/orgs/${confirmAction.orgId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const d = await res.json(); setActionError(d.error || 'Failed'); return; }
      setConfirmAction(null);
      setExpandedOrg(null);
      setOrgDetail(null);
      await fetchOrgs();
    } catch { setActionError('Network error'); }
    finally { setActionLoading(false); }
  }

  async function handleEvaluateTrust() {
    if (!confirmAction) return;
    setActionLoading(true);
    setActionError('');
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`/api/admin/orgs/${confirmAction.orgId}/trust/evaluate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const d = await res.json(); setActionError(d.error || 'Failed'); return; }
      setConfirmAction(null);
      await fetchOrgs();
    } catch { setActionError('Network error'); }
    finally { setActionLoading(false); }
  }

  async function handleSetTrust() {
    if (!confirmAction || !trustReason.trim()) { setActionError('Reason is required'); return; }
    setActionLoading(true);
    setActionError('');
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`/api/admin/orgs/${confirmAction.orgId}/trust`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ classification: selectedTrust, reason: trustReason.trim() }),
      });
      if (!res.ok) { const d = await res.json(); setActionError(d.error || 'Failed'); return; }
      setConfirmAction(null);
      await fetchOrgs();
    } catch { setActionError('Network error'); }
    finally { setActionLoading(false); }
  }

  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    (o.country || '').toLowerCase().includes(search.toLowerCase()) ||
    (o.craRole || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="ao-loading"><Loader size={32} className="ao-spinner" /></div>;
  if (error) return <div className="ao-error">{error}</div>;

  return (
    <div className="admin-orgs">
      <PageHeader title="Organisation Management" />

      <div className="ao-stat-cards">
        <StatCard label="Organisations" value={totals.totalOrgs} color="blue" />
        <StatCard label="Total Users" value={totals.totalUsers} />
        <StatCard label="Total Products" value={totals.totalProducts} />
      </div>

      <div className="ao-search-bar">
        <Search size={16} className="ao-search-icon" />
        <input
          type="text"
          placeholder="Search by name, country, or CRA role..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ao-search-input"
        />
      </div>

      <div className="ao-org-list">
        {filtered.length === 0 && (
          <div className="ao-empty">No organisations found</div>
        )}
        {filtered.map(org => (
          <div key={org.id} className={`ao-org-card ${expandedOrg === org.id ? 'ao-expanded' : ''}`}>
            <div className="ao-org-header" onClick={() => toggleOrg(org.id)}>
              <div className="ao-org-expand">
                {expandedOrg === org.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </div>
              <div className="ao-org-info">
                <div className="ao-org-name">
                  <Building2 size={16} />
                  {org.name}
                  <span className={`ao-badge-plan ao-plan-${org.plan || 'standard'}`}>{org.plan === 'pro' ? 'Pro' : 'Standard'}</span>
                  {org.billingStatus && org.billingStatus !== 'active' && (
                    <span className={`ao-badge-status ao-status-${org.billingStatus}`}>{org.billingStatus.replace(/_/g, ' ')}</span>
                  )}
                  {org.trustClassification && org.trustClassification !== 'commercial' && (() => {
                    const t = TRUST_LABELS[org.trustClassification] || TRUST_LABELS.commercial;
                    return <span className="ao-badge-trust" style={{ background: t.colour + '1a', color: t.colour, borderColor: t.colour + '40' }}>{t.label}</span>;
                  })()}
                </div>
                <div className="ao-org-meta">
                  {org.craRole && <span className="ao-tag ao-tag-role">{CRA_ROLE_LABELS[org.craRole] || org.craRole}</span>}
                  {org.country && <span className="ao-tag">{org.country}</span>}
                  {org.industry && <span className="ao-tag">{org.industry}</span>}
                  {org.companySize && <span className="ao-tag">{org.companySize}</span>}
                </div>
              </div>
              <div className="ao-org-stats">
                <div className="ao-mini-stat" title="Users">
                  <Users size={14} /> {org.userCount}
                </div>
                <div className="ao-mini-stat" title="Products">
                  <Package size={14} /> {org.productCount}
                </div>
                {org.vulnerabilities.open > 0 && (
                  <div className="ao-mini-stat ao-vuln-stat" title="Open vulnerabilities">
                    <AlertTriangle size={14} /> {org.vulnerabilities.open}
                  </div>
                )}
                <div className="ao-mini-stat ao-activity" title="Last activity">
                  {timeAgo(org.lastActivity)}
                </div>
              </div>
              <div className="ao-action-menu-wrap" onClick={e => e.stopPropagation()}>
                <button className="ao-action-trigger" onClick={() => setActionMenuId(actionMenuId === org.id ? null : org.id)}>
                  <MoreVertical size={16} />
                </button>
                {actionMenuId === org.id && (
                  <div className="ao-action-dropdown">
                    <button onClick={() => openAction(org.id, org.name, 'change_plan')}>
                      <Crown size={13} /> Change Plan
                    </button>
                    <button onClick={() => openAction(org.id, org.name, 'extend_trial')}>
                      <Calendar size={13} /> Extend Trial
                    </button>
                    <button onClick={() => openAction(org.id, org.name, 'evaluate_trust')}>
                      <RefreshCw size={13} /> Evaluate Trust
                    </button>
                    <button onClick={() => { setSelectedTrust(org.trustClassification || 'commercial'); setTrustReason(''); openAction(org.id, org.name, 'set_trust'); }}>
                      <Tag size={13} /> Set Classification
                    </button>
                    <button className="ao-delete-action" onClick={() => openAction(org.id, org.name, 'delete')}>
                      <Trash2 size={13} /> Delete Organisation
                    </button>
                  </div>
                )}
              </div>
            </div>

            {expandedOrg === org.id && (
              <div className="ao-org-detail">
                {detailLoading ? (
                  <div className="ao-detail-loading"><Loader size={20} className="ao-spinner" /></div>
                ) : orgDetail ? (
                  <div className="ao-detail-grid">
                    {/* Users section */}
                    <div className="ao-detail-section">
                      <h4><Users size={16} /> Users ({orgDetail.users.length})</h4>
                      <div className="ao-detail-table">
                        {orgDetail.users.map(u => (
                          <div key={u.id} className="ao-user-row">
                            <span className="ao-user-email">{u.email}</span>
                            <span className="ao-user-role">{u.orgRole}</span>
                            {u.isPlatformAdmin && <span className="ao-badge ao-badge-admin"><Shield size={12} /> Admin</span>}
                            {u.emailVerified && <span className="ao-badge ao-badge-verified"><CheckCircle size={12} /></span>}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Products section */}
                    <div className="ao-detail-section">
                      <h4><Package size={16} /> Products ({orgDetail.products.length})</h4>
                      <div className="ao-detail-table">
                        {orgDetail.products.map(p => (
                          <div key={p.id} className="ao-product-row">
                            <div className="ao-product-main">
                              <span className="ao-product-name">{p.name}</span>
                              <span className={`ao-cat-badge ao-cat-${p.category}`}>{CATEGORY_LABELS[p.category] || p.category}</span>
                              {p.lifecycle && <span className="ao-tag ao-tag-sm">{p.lifecycle}</span>}
                            </div>
                            <div className="ao-product-stats">
                              {p.hasRepo && (
                                <span className="ao-ps-item" title="Repository">
                                  <ExternalLink size={12} /> {p.repoFullName}
                                </span>
                              )}
                              <span className="ao-ps-item" title="Contributors">{p.contributors} contrib</span>
                              <span className="ao-ps-item" title="Dependencies">{p.dependencies} deps</span>
                              <span className="ao-ps-item" title="Tech file progress">
                                <FileText size={12} /> {p.techFile.completed}/{p.techFile.total}
                              </span>
                              {p.vulnerabilities.open > 0 && (
                                <span className="ao-ps-item ao-ps-vuln">
                                  <AlertTriangle size={12} /> {p.vulnerabilities.open} open
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                        {orgDetail.products.length === 0 && (
                          <div className="ao-empty-detail">No products registered</div>
                        )}
                      </div>
                    </div>

                    {/* Recent events */}
                    <div className="ao-detail-section ao-detail-full">
                      <h4>Recent Activity ({orgDetail.recentEvents.length})</h4>
                      <div className="ao-events-list">
                        {orgDetail.recentEvents.slice(0, 10).map((ev, i) => (
                          <div key={i} className="ao-event-row">
                            <span className="ao-event-type">{ev.eventType.replace(/_/g, ' ')}</span>
                            <span className="ao-event-user">{ev.userEmail}</span>
                            <span className="ao-event-time">{timeAgo(ev.createdAt)}</span>
                          </div>
                        ))}
                        {orgDetail.recentEvents.length === 0 && (
                          <div className="ao-empty-detail">No recent activity</div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="ao-detail-loading">Failed to load details</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Action modals */}
      {confirmAction && confirmAction.action === 'change_plan' && (
        <div className="ao-modal-overlay" onClick={() => setConfirmAction(null)}>
          <div className="ao-modal" onClick={e => e.stopPropagation()}>
            <h3>Change Plan</h3>
            <p>Update the plan for <strong>{confirmAction.orgName}</strong>.</p>
            <div className="ao-plan-radio">
              <label className={selectedPlan === 'standard' ? 'ao-radio-active' : ''}>
                <input type="radio" name="plan" value="standard" checked={selectedPlan === 'standard'} onChange={() => setSelectedPlan('standard')} />
                Standard
              </label>
              <label className={selectedPlan === 'pro' ? 'ao-radio-active' : ''}>
                <input type="radio" name="plan" value="pro" checked={selectedPlan === 'pro'} onChange={() => setSelectedPlan('pro')} />
                Pro
              </label>
            </div>
            {actionError && <div className="ao-action-error">{actionError}</div>}
            <div className="ao-modal-actions">
              <button className="ao-btn-cancel" onClick={() => setConfirmAction(null)} disabled={actionLoading}>Cancel</button>
              <button className="ao-btn-confirm ao-btn-grant" onClick={handleChangePlan} disabled={actionLoading}>
                {actionLoading ? 'Updating...' : 'Update Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && confirmAction.action === 'extend_trial' && (
        <div className="ao-modal-overlay" onClick={() => setConfirmAction(null)}>
          <div className="ao-modal" onClick={e => e.stopPropagation()}>
            <h3>Extend Trial</h3>
            <p>Add days to the trial period for <strong>{confirmAction.orgName}</strong>.</p>
            <div className="ao-trial-input">
              <label>Days to add</label>
              <input type="number" min={1} max={365} value={trialDays} onChange={e => setTrialDays(parseInt(e.target.value) || 0)} />
            </div>
            {actionError && <div className="ao-action-error">{actionError}</div>}
            <div className="ao-modal-actions">
              <button className="ao-btn-cancel" onClick={() => setConfirmAction(null)} disabled={actionLoading}>Cancel</button>
              <button className="ao-btn-confirm ao-btn-grant" onClick={handleExtendTrial} disabled={actionLoading}>
                {actionLoading ? 'Extending...' : 'Extend Trial'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && confirmAction.action === 'delete' && (
        <div className="ao-modal-overlay" onClick={() => setConfirmAction(null)}>
          <div className="ao-modal" onClick={e => e.stopPropagation()}>
            <h3>Delete Organisation</h3>
            <p>Permanently delete <strong>{confirmAction.orgName}</strong>? This removes all users, products, and data. This cannot be undone.</p>
            {actionError && <div className="ao-action-error">{actionError}</div>}
            <div className="ao-modal-actions">
              <button className="ao-btn-cancel" onClick={() => setConfirmAction(null)} disabled={actionLoading}>Cancel</button>
              <button className="ao-btn-confirm ao-btn-revoke" onClick={handleDeleteOrg} disabled={actionLoading}>
                {actionLoading ? 'Deleting...' : 'Delete Organisation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && confirmAction.action === 'evaluate_trust' && (
        <div className="ao-modal-overlay" onClick={() => setConfirmAction(null)}>
          <div className="ao-modal" onClick={e => e.stopPropagation()}>
            <h3>Evaluate Trust Classification</h3>
            <p>Re-evaluate trust classification for <strong>{confirmAction.orgName}</strong> based on current repository metadata, dependency licences, and behavioural signals.</p>
            {actionError && <div className="ao-action-error">{actionError}</div>}
            <div className="ao-modal-actions">
              <button className="ao-btn-cancel" onClick={() => setConfirmAction(null)} disabled={actionLoading}>Cancel</button>
              <button className="ao-btn-confirm ao-btn-grant" onClick={handleEvaluateTrust} disabled={actionLoading}>
                {actionLoading ? 'Evaluating...' : 'Run Evaluation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && confirmAction.action === 'set_trust' && (
        <div className="ao-modal-overlay" onClick={() => setConfirmAction(null)}>
          <div className="ao-modal" onClick={e => e.stopPropagation()}>
            <h3>Set Trust Classification</h3>
            <p>Manually set trust classification for <strong>{confirmAction.orgName}</strong>.</p>
            <div className="ao-trial-input">
              <label>Classification</label>
              <select value={selectedTrust} onChange={e => setSelectedTrust(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                {Object.entries(TRUST_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div className="ao-trial-input" style={{ marginTop: 12 }}>
              <label>Reason (required)</label>
              <input type="text" value={trustReason} onChange={e => setTrustReason(e.target.value)}
                placeholder="e.g. Verified open-source project" style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border)' }} />
            </div>
            {actionError && <div className="ao-action-error">{actionError}</div>}
            <div className="ao-modal-actions">
              <button className="ao-btn-cancel" onClick={() => setConfirmAction(null)} disabled={actionLoading}>Cancel</button>
              <button className="ao-btn-confirm ao-btn-grant" onClick={handleSetTrust} disabled={actionLoading}>
                {actionLoading ? 'Saving...' : 'Set Classification'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

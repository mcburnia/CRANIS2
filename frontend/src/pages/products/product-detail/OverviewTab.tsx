import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, Shield, AlertTriangle, GitBranch,
  CheckCircle2, Circle, Clock, ChevronRight, ExternalLink, Star,
  GitFork, Eye, RefreshCw, Unplug, Loader2, Sparkles, Activity, ArrowRight, Rocket, Building2, Plus, X,
} from 'lucide-react';
import OnboardingWizard from '../../../components/OnboardingWizard';
import ConformityAssessmentCard from '../../../components/ConformityAssessmentCard';
import type {
  Product, GitHubStatus, GitHubData, SBOMData, VersionEntry, SyncHistoryEntry,
  SyncStats, PushEvent, RepoConnection,
} from './shared';
import {
  LANGUAGE_COLORS, TYPE_LABELS,
  providerLabel, formatDateTime, timeAgo,
} from './shared';
import ProviderIcon from './ProviderIcon';

interface ChecklistStepPD {
  id: string;
  step: number;
  title: string;
  description: string;
  complete: boolean;
  actionLabel: string;
  actionTab: string | null;
  actionPath: string | null;
}

interface ProductChecklistPD {
  stepsComplete: number;
  stepsTotal: number;
  complete: boolean;
  deadlines: { id: string; label: string; date: string; daysRemaining: number }[];
  steps: ChecklistStepPD[];
}

export default function OverviewTab({ product, catInfo, ghStatus, ghData, sbomData: _sbomData, techFileProgress: _techFileProgress, versionHistory, syncHistory, syncStats, pushEvents, onConnect, onSync, syncing, onDisconnect, repoProvider, isProviderConnected, providerConnection, onSwitchTab, onNavigate }: {
  product: Product; catInfo: { label: string; color: string; desc: string };
  ghStatus: GitHubStatus; ghData: GitHubData; sbomData: SBOMData;
  techFileProgress: { total: number; completed: number; inProgress: number; notStarted: number };
  versionHistory: VersionEntry[];
  syncHistory: SyncHistoryEntry[];
  syncStats: SyncStats | null;
  pushEvents: PushEvent[];
  onConnect: (provider?: string) => void; onSync: () => void; syncing: boolean; onDisconnect: (provider?: string) => void;
  repoProvider: string;
  isProviderConnected: boolean;
  providerConnection?: RepoConnection;
  onSwitchTab: (tab: string) => void;
  onNavigate: (path: string) => void;
}) {
  const pLabel = providerLabel(repoProvider);
  const [checklist, setChecklist] = useState<ProductChecklistPD | null>(null);
  const [copilotUsage, setCopilotUsage] = useState<any>(null);
  const [complianceGaps, setComplianceGaps] = useState<any>(null);
  const [nbAssessment, setNbAssessment] = useState<any>(null);
  const [showNbForm, setShowNbForm] = useState(false);
  const [nbBodies, setNbBodies] = useState<any[]>([]);
  const [msRegistration, setMsRegistration] = useState<any>(null);
  const [showMsForm, setShowMsForm] = useState(false);
  const [msAuthorities, setMsAuthorities] = useState<any[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    fetch(`/api/products/${product.id}/compliance-checklist`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setChecklist(d); })
      .catch(() => {});
    // Fetch copilot usage for this product
    fetch('/api/copilot/usage', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          const productUsage = d.byProduct?.find((p: any) => p.productId === product.id);
          if (productUsage) setCopilotUsage(productUsage);
        }
      })
      .catch(() => {});
    // Fetch compliance gaps
    fetch(`/api/products/${product.id}/compliance-gaps`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setComplianceGaps(d); })
      .catch(() => {});
    // Fetch notified body assessment (if any)
    const needsNB = ['important_ii', 'critical'].includes(product.craCategory || '');
    if (needsNB) {
      fetch(`/api/products/${product.id}/nb-assessment`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setNbAssessment(d.assessment); })
        .catch(() => {});
    }
    // Fetch market surveillance registration (critical only)
    if (product.craCategory === 'critical') {
      fetch(`/api/products/${product.id}/ms-registration`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setMsRegistration(d.registration); })
        .catch(() => {});
    }
  }, [product.id, product.craCategory]);
  return (
    <div className="pd-overview-grid">
      {/* GitHub Repo Card – only if synced */}
      {ghData.synced && ghData.repo && (
        <div className="pd-card pd-card-github">
          <div className="pd-card-header">
            <ProviderIcon provider={repoProvider} size={18} />
            <h3>Repository</h3>
            <a href={ghData.repo.url} target="_blank" rel="noopener noreferrer" className="pd-card-external">
              <ExternalLink size={14} />
            </a>
          </div>
          <div className="gh-repo-name">{ghData.repo.fullName}</div>
          {ghData.repo.description && <div className="gh-repo-desc">{ghData.repo.description}</div>}
          <div className="gh-repo-stats">
            <span className="gh-stat"><Star size={14} /> {ghData.repo.stars}</span>
            <span className="gh-stat"><GitFork size={14} /> {ghData.repo.forks}</span>
            <span className="gh-stat"><AlertTriangle size={14} /> {ghData.repo.openIssues} issues</span>
            <span className={`gh-visibility ${ghData.repo.isPrivate ? 'private' : 'public'}`}>
              <Eye size={12} /> {ghData.repo.visibility}
            </span>
          </div>
          <div className="pd-class-details">
            {ghData.repo.language && (
              <div className="pd-detail-row">
                <span className="pd-detail-label">Primary Language</span>
                <span className="pd-detail-value">
                  <span className="gh-lang-dot" style={{ background: LANGUAGE_COLORS[ghData.repo.language] || '#8b8d98' }}></span>
                  {ghData.repo.language}
                </span>
              </div>
            )}
            <div className="pd-detail-row">
              <span className="pd-detail-label">Default Branch</span>
              <span className="pd-detail-value">{ghData.repo.defaultBranch}</span>
            </div>
            <div className="pd-detail-row">
              <span className="pd-detail-label">Last Push</span>
              <span className="pd-detail-value">{timeAgo(ghData.repo.lastPush)}</span>
            </div>
            {ghData.repo.syncedAt && (
              <div className="pd-detail-row">
                <span className="pd-detail-label">Last Synced</span>
                <span className="pd-detail-value">{formatDateTime(ghData.repo.syncedAt)}</span>
              </div>
            )}
          </div>
          {/* Repo account info */}
          {isProviderConnected && (
            <div className="gh-account-row">
              {(providerConnection?.avatarUrl || ghStatus.githubAvatarUrl) && <img src={providerConnection?.avatarUrl || ghStatus.githubAvatarUrl || ''} alt="" className="gh-account-avatar" />}
              <span className="gh-account-name">Connected as {providerConnection?.username || ghStatus.githubUsername}</span>
              <button className="gh-disconnect-btn" onClick={() => onDisconnect(repoProvider)} title={`Disconnect ${pLabel}`}>
                <Unplug size={12} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Repo Connect Card – if not connected and has repoUrl */}
      {!isProviderConnected && product.repoUrl && (
        <div className="pd-card pd-card-connect">
          <div className="pd-card-header">
            <ProviderIcon provider={repoProvider} size={18} />
            <h3>Connect {pLabel}</h3>
          </div>
          <p className="gh-connect-desc">Connect your {pLabel} account to sync repository data, discover contributors, and analyse dependencies.</p>
          <button className="btn btn-primary gh-connect-btn" onClick={() => onConnect(repoProvider)}>
            <ProviderIcon provider={repoProvider} size={16} /> Connect {pLabel}
          </button>
          <p className="gh-connect-note">Read-only access. CRANIS2 will never write to your repositories.</p>
        </div>
      )}

      {/* Repo Sync Prompt – if connected but not synced */}
      {isProviderConnected && !ghData.synced && product.repoUrl && (
        <div className="pd-card pd-card-connect">
          <div className="pd-card-header">
            <ProviderIcon provider={repoProvider} size={18} />
            <h3>Sync Repository</h3>
          </div>
          <p className="gh-connect-desc">Your {pLabel} account is connected. Sync to pull repository metadata, contributors, and language data.</p>
          <button className="btn btn-primary gh-connect-btn" onClick={onSync} disabled={syncing}>
            {syncing ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      )}

      {/* CRA Classification Card */}
      <div className="pd-card">
        <div className="pd-card-header">
          <Shield size={18} />
          <h3>CRA Classification</h3>
        </div>
        <div className="pd-classification">
          <div className="pd-class-badge-large" style={{ color: catInfo.color, borderColor: catInfo.color }}>
            {catInfo.label}
          </div>
          <p className="pd-class-desc">{catInfo.desc}</p>
        </div>
        <div className="pd-class-details">
          <div className="pd-detail-row">
            <span className="pd-detail-label">Conformity Assessment</span>
            <span className="pd-detail-value">
              {product.craCategory === 'critical' ? 'Third-party required' :
               product.craCategory === 'important_ii' ? 'Third-party may be required' :
               product.craCategory === 'important_i' ? 'Self-assessment possible' : 'Self-assessment'}
            </span>
          </div>
          <div className="pd-detail-row">
            <span className="pd-detail-label">Vulnerability Handling</span>
            <span className="pd-detail-value">Required (5 years post-market)</span>
          </div>
          <div className="pd-detail-row">
            <span className="pd-detail-label">SBOM Required</span>
            <span className="pd-detail-value">Yes</span>
          </div>
          <div className="pd-detail-row">
            <span className="pd-detail-label">Incident Reporting</span>
            <span className="pd-detail-value">Within 24 hours to ENISA</span>
          </div>
        </div>
      </div>

      {/* Version History Card */}
      {versionHistory.length > 0 && (
        <div className="pd-card">
          <div className="pd-card-header">
            <GitBranch size={18} />
            <h3>Version History</h3>
          </div>
          <div className="vh-list">
            {versionHistory.slice(0, 8).map((v, i) => (
              <div key={i} className={`vh-item ${i === 0 ? 'vh-latest' : ''}`}>
                <div className="vh-version">
                  <span className="vh-cranis">{v.cranisVersion}</span>
                  {v.githubTag && <span className="vh-tag">{v.githubTag}</span>}
                  {v.isPrerelease && <span className="vh-prerelease">pre-release</span>}
                </div>
                <div className="vh-meta">
                  <span className={`vh-source vh-source-${v.source}`}>{v.source === 'sync' ? 'Sync' : v.source === 'github_release' ? 'Release' : 'Manual'}</span>
                  <span className="vh-date">{new Date(v.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pushEvents.length > 0 && (
        <div className="pd-card">
          <div className="pd-card-header">
            <Activity size={18} />
            <h3>Repo Activity</h3>
            <span className="pd-card-badge">{pushEvents.length} push{pushEvents.length !== 1 ? 'es' : ''}</span>
          </div>
          <div className="pd-activity-list">
            {pushEvents.slice(0, 8).map((ev) => (
              <div key={ev.id} className="pd-activity-item">
                <div className="pd-activity-top">
                  <span className="pd-activity-pusher">{ev.pusherName}</span>
                  {ev.branch && <span className="pd-activity-branch">{ev.branch}</span>}
                  <span className="pd-activity-commits">{ev.commitCount} commit{ev.commitCount !== 1 ? 's' : ''}</span>
                  <span className="pd-activity-time">{timeAgo(ev.createdAt)}</span>
                </div>
                {ev.headCommitMessage && (
                  <div className="pd-activity-message">{ev.headCommitMessage.split('\n')[0].slice(0, 120)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {syncHistory.length > 0 && (
        <div className="pd-card">
          <div className="pd-card-header">
            <Clock size={18} />
            <h3>Sync Performance</h3>
          </div>
          {syncStats && (
            <div className="sh-stats">
              <div className="sh-stat">
                <span className="sh-stat-value">{syncStats.avgDuration.toFixed(1)}s</span>
                <span className="sh-stat-label">Avg Duration</span>
              </div>
              <div className="sh-stat">
                <span className="sh-stat-value">{syncStats.totalSyncs}</span>
                <span className="sh-stat-label">Total Syncs</span>
              </div>
              <div className="sh-stat">
                <span className="sh-stat-value">{syncStats.minDuration.toFixed(1)}s</span>
                <span className="sh-stat-label">Fastest</span>
              </div>
              <div className="sh-stat">
                <span className="sh-stat-value">{syncStats.maxDuration.toFixed(1)}s</span>
                <span className="sh-stat-label">Slowest</span>
              </div>
            </div>
          )}
          <div className="sh-list">
            {syncHistory.slice(0, 8).map((s, i) => (
              <div key={i} className={`sh-item ${s.status === 'error' ? 'sh-error' : ''}`}>
                <div className="sh-duration">
                  <span className="sh-seconds">{s.durationSeconds.toFixed(1)}s</span>
                  <span className={`sh-type sh-type-${s.syncType}`}>{s.syncType === 'manual' ? 'Manual' : 'Auto'}</span>
                </div>
                <div className="sh-meta">
                  {s.cranisVersion && <span className="sh-version">{s.cranisVersion}</span>}
                  <span className="sh-packages">{s.packageCount} pkgs</span>
                  <span className="sh-date">{new Date(s.startedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product Details Card */}
      <div className="pd-card">
        <div className="pd-card-header">
          <Package size={18} />
          <h3>Product Details</h3>
        </div>
        <div className="pd-class-details">
          <div className="pd-detail-row">
            <span className="pd-detail-label">Product ID</span>
            <span className="pd-detail-value pd-mono">{product.id}</span>
          </div>
          <div className="pd-detail-row">
            <span className="pd-detail-label">Product Type</span>
            <span className="pd-detail-value">{TYPE_LABELS[product.productType] || product.productType}</span>
          </div>
          <div className="pd-detail-row">
            <span className="pd-detail-label">Version</span>
            <span className="pd-detail-value">{product.version || '–'}</span>
          </div>
          <div className="pd-detail-row">
            <span className="pd-detail-label">Repository</span>
            <span className="pd-detail-value">
              {product.repoUrl ? (
                <a href={product.repoUrl} target="_blank" rel="noopener noreferrer" className="pd-repo-detail-link">
                  {product.repoUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\.git$/, '')} <ExternalLink size={10} />
                </a>
              ) : '–'}
            </span>
          </div>
          <div className="pd-detail-row">
            <span className="pd-detail-label">Status</span>
            <span className="pd-detail-value">{product.status}</span>
          </div>
          <div className="pd-detail-row">
            <span className="pd-detail-label">Created</span>
            <span className="pd-detail-value">{formatDateTime(product.createdAt)}</span>
          </div>
          <div className="pd-detail-row">
            <span className="pd-detail-label">Last Updated</span>
            <span className="pd-detail-value">{formatDateTime(product.updatedAt)}</span>
          </div>
        </div>
      </div>

      {/* AI Copilot Usage Card */}
      {copilotUsage && (
        <div className="pd-card" style={{ borderColor: 'rgba(139, 92, 246, 0.2)' }}>
          <div className="pd-card-header">
            <Sparkles size={18} style={{ color: '#a78bfa' }} />
            <h3>AI Copilot Usage</h3>
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--muted)' }}>this month</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', padding: '0.75rem 0 0.25rem' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Requests</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text)' }}>{copilotUsage.requests}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Tokens</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text)' }}>
                {copilotUsage.inputTokens + copilotUsage.outputTokens >= 1000
                  ? `${((copilotUsage.inputTokens + copilotUsage.outputTokens) / 1000).toFixed(1)}K`
                  : copilotUsage.inputTokens + copilotUsage.outputTokens}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Est. Cost</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--green)' }}>${copilotUsage.estimatedCostUsd.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}

      {/* CRA Compliance Checklist Card */}
      <div className="pd-card pd-card-checklist">
        <div className="pd-card-header">
          <CheckCircle2 size={18} />
          <h3>CRA Compliance Checklist</h3>
          {checklist && (
            <>
              <span className="pd-cl-count">{checklist.stepsComplete}/{checklist.stepsTotal}</span>
              {!checklist.complete && (
                <button className="ob-setup-btn" onClick={() => setShowOnboarding(true)}>
                  <Rocket size={13} /> Quick Setup
                </button>
              )}
            </>
          )}
        </div>

        {/* Deadlines */}
        {checklist && (
          <div className="pd-cl-deadlines">
            {checklist.deadlines.map(d => (
              <div key={d.id} className={`pd-cl-deadline ${d.daysRemaining < 180 ? 'urgent' : ''}`}>
                <span className="pd-cl-dl-days">{d.daysRemaining}d</span>
                <span className="pd-cl-dl-label">{d.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Steps */}
        <div className="pd-cl-steps">
          {checklist ? checklist.steps.map(step => {
            return (
              <div key={step.id} className={`pd-cl-step ${step.complete ? 'done' : 'todo'}`}>
                <div className="pd-cl-step-icon">
                  {step.complete
                    ? <CheckCircle2 size={15} style={{ color: 'var(--green)' }} />
                    : <Circle size={15} style={{ color: 'var(--border)' }} />
                  }
                </div>
                <div className="pd-cl-step-body">
                  <div className="pd-cl-step-title">{step.title}</div>
                  {!step.complete && (
                    <div className="pd-cl-step-desc">{step.description}</div>
                  )}
                </div>
                {!step.complete && (
                  <button
                    className="pd-cl-step-action"
                    onClick={() => {
                      if (step.actionPath) {
                        onNavigate(step.actionPath);
                      } else if (step.actionTab) {
                        onSwitchTab(step.actionTab);
                      }
                    }}
                  >
                    {step.actionLabel} <ChevronRight size={11} />
                  </button>
                )}
              </div>
            );
          }) : (
            <div className="pd-cl-loading">
              <Loader2 size={14} className="spin" style={{ color: 'var(--muted)' }} />
              <span>Loading checklist…</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Plan CTA */}
      {checklist && !checklist.complete && (
        <div style={{ marginBottom: '0.75rem' }}>
          <Link
            to={`/products/${product.id}/action-plan`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              fontSize: '0.82rem', fontWeight: 500, color: 'var(--accent)',
              textDecoration: 'none', padding: '0.35rem 0.7rem',
              border: '1px solid rgba(59,130,246,0.3)', borderRadius: '6px',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(59,130,246,0.08)'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.background = 'none'; }}
          >
            <ArrowRight size={14} />
            View full action plan
          </Link>
        </div>
      )}

      {/* Conformity Assessment Module */}
      <ConformityAssessmentCard
        productId={product.id}
        craCategory={product.craCategory}
        onSwitchTab={onSwitchTab}
      />

      {/* Notified Body Assessment Tracker – only for important_ii / critical */}
      {['important_ii', 'critical'].includes(product.craCategory || '') && (
        <div className="pd-card">
          <div className="pd-card-header">
            <Building2 size={18} />
            <h3>Notified Body Assessment</h3>
            {nbAssessment && (
              <span className={`pd-nb-status pd-nb-status-${nbAssessment.status}`}>
                {nbAssessment.status.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          {!nbAssessment && !showNbForm && (
            <div style={{ padding: '12px 0' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '1.6' }}>
                {product.craCategory === 'critical'
                  ? 'Critical products require Module H (full quality assurance) by a notified body.'
                  : 'Important II products require Module B+C (EU-type examination) by a notified body.'}
              </p>
              <button
                className="pd-nb-start-btn"
                onClick={() => {
                  setShowNbForm(true);
                  const token = localStorage.getItem('session_token');
                  fetch('/api/notified-bodies', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
                    .then(r => r.ok ? r.json() : null)
                    .then(d => { if (d?.bodies) setNbBodies(d.bodies); })
                    .catch(() => {});
                }}
              >
                <Plus size={14} /> Start tracking assessment
              </button>
            </div>
          )}

          {showNbForm && !nbAssessment && (
            <form
              className="pd-nb-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const token = localStorage.getItem('session_token');
                const body = {
                  module: formData.get('module'),
                  notified_body_id: formData.get('notified_body_id') || null,
                  notes: formData.get('notes') || null,
                };
                const res = await fetch(`/api/products/${product.id}/nb-assessment`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify(body),
                });
                if (res.ok) {
                  const data = await res.json();
                  setNbAssessment(data.assessment);
                  setShowNbForm(false);
                }
              }}
            >
              <div className="pd-nb-form-row">
                <label>Module</label>
                <select name="module" defaultValue={product.craCategory === 'critical' ? 'H' : 'B'} required>
                  <option value="B">Module B — EU-Type Examination</option>
                  <option value="C">Module C — Conformity to Type</option>
                  <option value="H">Module H — Full Quality Assurance</option>
                </select>
              </div>
              <div className="pd-nb-form-row">
                <label>Notified body (optional)</label>
                <select name="notified_body_id" defaultValue="">
                  <option value="">— Select later —</option>
                  {nbBodies.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.country})</option>
                  ))}
                </select>
              </div>
              <div className="pd-nb-form-row">
                <label>Notes</label>
                <input type="text" name="notes" placeholder="Optional notes..." />
              </div>
              <div className="pd-nb-form-actions">
                <button type="submit" className="pd-nb-save-btn">Create</button>
                <button type="button" className="pd-nb-cancel-btn" onClick={() => setShowNbForm(false)}>Cancel</button>
              </div>
            </form>
          )}

          {nbAssessment && (
            <div className="pd-nb-details">
              <div className="pd-detail-row">
                <span className="pd-detail-label">Module</span>
                <span className="pd-detail-value">Module {nbAssessment.module}</span>
              </div>
              {nbAssessment.body_name && (
                <div className="pd-detail-row">
                  <span className="pd-detail-label">Notified body</span>
                  <span className="pd-detail-value">
                    {nbAssessment.body_name} ({nbAssessment.body_country})
                    {nbAssessment.body_website && (
                      <a href={nbAssessment.body_website} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 6 }}>
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </span>
                </div>
              )}
              {nbAssessment.submitted_date && (
                <div className="pd-detail-row">
                  <span className="pd-detail-label">Submitted</span>
                  <span className="pd-detail-value">{new Date(nbAssessment.submitted_date).toLocaleDateString()}</span>
                </div>
              )}
              {nbAssessment.expected_completion && (
                <div className="pd-detail-row">
                  <span className="pd-detail-label">Expected completion</span>
                  <span className="pd-detail-value">{new Date(nbAssessment.expected_completion).toLocaleDateString()}</span>
                </div>
              )}
              {nbAssessment.certificate_number && (
                <div className="pd-detail-row">
                  <span className="pd-detail-label">Certificate</span>
                  <span className="pd-detail-value">
                    {nbAssessment.certificate_number}
                    {nbAssessment.certificate_expiry && ` (expires ${new Date(nbAssessment.certificate_expiry).toLocaleDateString()})`}
                  </span>
                </div>
              )}
              {nbAssessment.notes && (
                <div className="pd-detail-row">
                  <span className="pd-detail-label">Notes</span>
                  <span className="pd-detail-value">{nbAssessment.notes}</span>
                </div>
              )}
              <div className="pd-nb-form-actions" style={{ marginTop: 12 }}>
                <select
                  className="pd-nb-status-select"
                  value={nbAssessment.status}
                  onChange={async (e) => {
                    const newStatus = e.target.value;
                    const token = localStorage.getItem('session_token');
                    const res = await fetch(`/api/products/${product.id}/nb-assessment`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ status: newStatus }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setNbAssessment(data.assessment);
                    }
                  }}
                >
                  <option value="planning">Planning</option>
                  <option value="submitted">Submitted</option>
                  <option value="under_review">Under review</option>
                  <option value="additional_info_requested">Info requested</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <button
                  className="pd-nb-cancel-btn"
                  onClick={async () => {
                    if (!confirm('Remove assessment tracking for this product?')) return;
                    const token = localStorage.getItem('session_token');
                    const res = await fetch(`/api/products/${product.id}/nb-assessment`, {
                      method: 'DELETE',
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    if (res.ok) setNbAssessment(null);
                  }}
                >
                  <X size={12} /> Remove
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Market Surveillance Registration Tracker – critical only */}
      {product.craCategory === 'critical' && (
        <div className="pd-card">
          <div className="pd-card-header">
            <Shield size={18} />
            <h3>Market Surveillance Registration</h3>
            {msRegistration && (
              <span className={`pd-nb-status pd-nb-status-${msRegistration.status}`}>
                {msRegistration.status.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          {!msRegistration && !showMsForm && (
            <div style={{ padding: '12px 0' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '1.6' }}>
                Critical products must be registered with the relevant market surveillance authority before being placed on the EU market (CRA Art.&nbsp;20).
              </p>
              <button
                className="pd-nb-start-btn"
                onClick={() => {
                  setShowMsForm(true);
                  fetch('/api/market-surveillance-authorities?cra_designated=true')
                    .then(r => r.ok ? r.json() : null)
                    .then(d => { if (d?.authorities) setMsAuthorities(d.authorities); })
                    .catch(() => {});
                }}
              >
                <Plus size={14} /> Start tracking registration
              </button>
            </div>
          )}

          {showMsForm && !msRegistration && (
            <form
              className="pd-nb-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const token = localStorage.getItem('session_token');
                const authorityId = formData.get('authority_id') as string;
                const selectedAuth = msAuthorities.find((a: any) => a.id === authorityId);
                const body: any = {
                  authority_id: authorityId || null,
                  authority_name: selectedAuth?.name || (formData.get('authority_name') as string) || null,
                  authority_country: selectedAuth?.country || (formData.get('authority_country') as string) || null,
                  notes: formData.get('notes') || null,
                };
                const res = await fetch(`/api/products/${product.id}/ms-registration`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify(body),
                });
                if (res.ok) {
                  const data = await res.json();
                  setMsRegistration(data.registration);
                  setShowMsForm(false);
                }
              }}
            >
              <div className="pd-nb-form-row">
                <label>Authority (from directory)</label>
                <select name="authority_id" defaultValue="">
                  <option value="">— Select or enter manually below —</option>
                  {msAuthorities.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.country})</option>
                  ))}
                </select>
              </div>
              <div className="pd-nb-form-row">
                <label>Authority name (if not in directory)</label>
                <input type="text" name="authority_name" placeholder="e.g. BNetzA" />
              </div>
              <div className="pd-nb-form-row">
                <label>Country</label>
                <input type="text" name="authority_country" placeholder="e.g. DE" maxLength={5} />
              </div>
              <div className="pd-nb-form-row">
                <label>Notes</label>
                <input type="text" name="notes" placeholder="Optional notes..." />
              </div>
              <div className="pd-nb-form-actions">
                <button type="submit" className="pd-nb-save-btn">Create</button>
                <button type="button" className="pd-nb-cancel-btn" onClick={() => setShowMsForm(false)}>Cancel</button>
              </div>
            </form>
          )}

          {msRegistration && (
            <div className="pd-nb-details">
              {(msRegistration.msa_name || msRegistration.authority_name) && (
                <div className="pd-detail-row">
                  <span className="pd-detail-label">Authority</span>
                  <span className="pd-detail-value">
                    {msRegistration.msa_name || msRegistration.authority_name}
                    {(msRegistration.msa_country || msRegistration.authority_country) &&
                      ` (${msRegistration.msa_country || msRegistration.authority_country})`}
                    {msRegistration.msa_website && (
                      <a href={msRegistration.msa_website} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 6 }}>
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </span>
                </div>
              )}
              {msRegistration.submission_date && (
                <div className="pd-detail-row">
                  <span className="pd-detail-label">Submitted</span>
                  <span className="pd-detail-value">{new Date(msRegistration.submission_date).toLocaleDateString()}</span>
                </div>
              )}
              {msRegistration.registration_number && (
                <div className="pd-detail-row">
                  <span className="pd-detail-label">Registration no.</span>
                  <span className="pd-detail-value">{msRegistration.registration_number}</span>
                </div>
              )}
              {msRegistration.registration_date && (
                <div className="pd-detail-row">
                  <span className="pd-detail-label">Registered</span>
                  <span className="pd-detail-value">{new Date(msRegistration.registration_date).toLocaleDateString()}</span>
                </div>
              )}
              {msRegistration.renewal_date && (
                <div className="pd-detail-row">
                  <span className="pd-detail-label">Renewal due</span>
                  <span className="pd-detail-value">{new Date(msRegistration.renewal_date).toLocaleDateString()}</span>
                </div>
              )}
              {msRegistration.notes && (
                <div className="pd-detail-row">
                  <span className="pd-detail-label">Notes</span>
                  <span className="pd-detail-value">{msRegistration.notes}</span>
                </div>
              )}
              <div className="pd-nb-form-actions" style={{ marginTop: 12 }}>
                <select
                  className="pd-nb-status-select"
                  value={msRegistration.status}
                  onChange={async (e) => {
                    const newStatus = e.target.value;
                    const token = localStorage.getItem('session_token');
                    const res = await fetch(`/api/products/${product.id}/ms-registration`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ status: newStatus }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setMsRegistration(data.registration);
                    }
                  }}
                >
                  <option value="planning">Planning</option>
                  <option value="preparing">Preparing</option>
                  <option value="submitted">Submitted</option>
                  <option value="acknowledged">Acknowledged</option>
                  <option value="registered">Registered</option>
                  <option value="rejected">Rejected</option>
                </select>
                <button
                  className="pd-nb-cancel-btn"
                  onClick={async () => {
                    if (!confirm('Remove registration tracking for this product?')) return;
                    const token = localStorage.getItem('session_token');
                    const res = await fetch(`/api/products/${product.id}/ms-registration`, {
                      method: 'DELETE',
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    if (res.ok) setMsRegistration(null);
                  }}
                >
                  <X size={12} /> Remove
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Compliance Gap Narrator – Next Steps */}
      {complianceGaps && complianceGaps.gaps.length > 0 && (
        <div className="pd-card pd-card-gaps">
          <div className="pd-card-header">
            <AlertTriangle size={18} />
            <h3>Next Steps</h3>
            <span className="pd-gaps-count">
              {complianceGaps.summary.total} action{complianceGaps.summary.total !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Progress bar */}
          <div className="pd-gaps-progress">
            <div className="pd-gaps-progress-bar">
              <div
                className="pd-gaps-progress-fill"
                style={{ width: `${Math.round((complianceGaps.progress.obligationsMet / Math.max(complianceGaps.progress.obligationsTotal, 1)) * 100)}%` }}
              />
            </div>
            <span className="pd-gaps-progress-label">
              {complianceGaps.progress.obligationsMet}/{complianceGaps.progress.obligationsTotal} obligations met
            </span>
          </div>

          {/* Priority summary badges */}
          <div className="pd-gaps-badges">
            {complianceGaps.summary.critical > 0 && (
              <span className="pd-gaps-badge critical">{complianceGaps.summary.critical} critical</span>
            )}
            {complianceGaps.summary.high > 0 && (
              <span className="pd-gaps-badge high">{complianceGaps.summary.high} high</span>
            )}
            {complianceGaps.summary.medium > 0 && (
              <span className="pd-gaps-badge medium">{complianceGaps.summary.medium} medium</span>
            )}
            {complianceGaps.summary.low > 0 && (
              <span className="pd-gaps-badge low">{complianceGaps.summary.low} low</span>
            )}
          </div>

          {/* Gap items – show top 8, collapse the rest */}
          <div className="pd-gaps-list">
            {complianceGaps.gaps.slice(0, 8).map((gap: any) => (
              <div key={gap.id} className={`pd-gap-item pd-gap-${gap.priority}`}>
                <div className="pd-gap-indicator" />
                <div className="pd-gap-body">
                  <div className="pd-gap-title">{gap.title}</div>
                  <div className="pd-gap-action">{gap.action}</div>
                  <div className="pd-gap-meta">
                    <span className="pd-gap-ref">{gap.craReference}</span>
                  </div>
                </div>
                {(gap.actionTab || gap.actionPath) && (
                  <button
                    className="pd-gap-go"
                    onClick={() => {
                      if (gap.actionPath) {
                        onNavigate(gap.actionPath);
                      } else if (gap.actionTab) {
                        onSwitchTab(gap.actionTab);
                      }
                    }}
                  >
                    <ChevronRight size={14} />
                  </button>
                )}
              </div>
            ))}
            {complianceGaps.gaps.length > 8 && (
              <div className="pd-gaps-more">
                + {complianceGaps.gaps.length - 8} more action{complianceGaps.gaps.length - 8 !== 1 ? 's' : ''}. View the Obligations tab for the full list
              </div>
            )}
          </div>
        </div>
      )}

      {complianceGaps && complianceGaps.gaps.length === 0 && (
        <div className="pd-card pd-card-gaps pd-card-gaps-clear">
          <div className="pd-card-header">
            <CheckCircle2 size={18} style={{ color: 'var(--green)' }} />
            <h3>All Clear</h3>
          </div>
          <p className="pd-gaps-clear-text">
            No compliance gaps detected. All obligations are met, the technical file is complete,
            and no open vulnerability findings remain. This product is CRA-ready.
          </p>
        </div>
      )}
      {showOnboarding && (
        <OnboardingWizard
          productId={product.id}
          productName={product.name}
          onClose={() => setShowOnboarding(false)}
          onComplete={() => {
            // Refresh checklist
            const token = localStorage.getItem('session_token');
            fetch(`/api/products/${product.id}/compliance-checklist`, {
              headers: { Authorization: `Bearer ${token}` },
            }).then(r => r.json()).then(d => setChecklist(d)).catch(() => {});
          }}
        />
      )}
    </div>
  );
}

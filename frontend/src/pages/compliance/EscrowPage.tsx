import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import {
  ArrowLeft, Archive, CheckCircle2, XCircle, Clock, Loader2,
  ExternalLink, RefreshCw, Settings2, Shield, Users, UserPlus,
  UserX, Copy, Key, Eye, EyeOff, Mail
} from 'lucide-react';
import './EscrowPage.css';

interface EscrowConfig {
  configured: boolean;
  id?: string;
  enabled?: boolean;
  setupCompleted?: boolean;
  forgejoOrg?: string;
  forgejoRepo?: string;
  toggles?: {
    includeSbomCyclonedx: boolean;
    includeSbomSpdx: boolean;
    includeVulnReport: boolean;
    includeLicenseAudit: boolean;
    includeIpProof: boolean;
    includeCraDocs: boolean;
    includeTimeline: boolean;
  };
}

interface EscrowStatus {
  configured: boolean;
  enabled: boolean;
  setupCompleted?: boolean;
  repoUrl?: string;
  forgejoOrg?: string;
  forgejoRepo?: string;
  lastDeposit?: {
    status: string;
    completedAt: string;
    artifactCount: number;
  } | null;
  stats?: {
    total: number;
    completed: number;
    failed: number;
  };
}

interface Deposit {
  id: string;
  status: string;
  trigger: string;
  commitSha: string | null;
  artifactsIncluded: string[] | null;
  artifactCount: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

interface EscrowUser {
  id: string;
  email: string;
  displayName: string | null;
  forgejoUsername: string | null;
  role: string;
  permission: string;
  status: string;
  agentReference: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export default function EscrowPage() {
  const { productId } = useParams<{ productId: string }>();
  const [productName, setProductName] = useState('');
  const [productRepoUrl, setProductRepoUrl] = useState('');
  const [config, setConfig] = useState<EscrowConfig | null>(null);
  const [status, setStatus] = useState<EscrowStatus | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [agents, setAgents] = useState<EscrowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingUp, setSettingUp] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const [savingToggles, setSavingToggles] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDisplayName, setInviteDisplayName] = useState('');
  const [inviteReference, setInviteReference] = useState('');
  const [setupCredentials, setSetupCredentials] = useState<{ username: string; password: string } | null>(null);
  const [agentCredentials, setAgentCredentials] = useState<{ email: string; username: string; password: string; isNew: boolean } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState('');
  const [toggles, setToggles] = useState({
    includeSbomCyclonedx: true,
    includeSbomSpdx: true,
    includeVulnReport: false,
    includeLicenseAudit: true,
    includeIpProof: true,
    includeCraDocs: true,
    includeTimeline: true,
  });

  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchData = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setError('');
    try {
      // Fetch product name
      const prodRes = await fetch(`/api/products/${productId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProductName(prodData.name || '');
        setProductRepoUrl(prodData.repoUrl || '');
      }

      // Fetch config + status + deposits + agents in parallel
      const [configRes, statusRes, depositsRes, agentsRes] = await Promise.all([
        fetch(`/api/escrow/${productId}/config`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/escrow/${productId}/status`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/escrow/${productId}/deposits?limit=20`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/escrow/${productId}/agents`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig(configData);
        if (configData.toggles) setToggles(configData.toggles);
      }
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData);
      }
      if (depositsRes.ok) {
        const depositsData = await depositsRes.json();
        setDeposits(depositsData.deposits || []);
      }
      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        setAgents(agentsData.users || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load escrow data');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSetup() {
    if (!productId) return;
    setSettingUp(true);
    setError('');
    try {
      const res = await fetch(`/api/escrow/${productId}/setup`, { method: 'POST', headers });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Setup failed');
      }
      const data = await res.json();
      // Show one-time credentials if returned
      if (data.customerUsername && data.customerPassword) {
        setSetupCredentials({ username: data.customerUsername, password: data.customerPassword });
      }
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Setup failed');
    } finally {
      setSettingUp(false);
    }
  }

  async function handleDeposit() {
    if (!productId) return;
    setDepositing(true);
    setError('');
    try {
      const res = await fetch(`/api/escrow/${productId}/deposit`, { method: 'POST', headers });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Deposit failed');
      }
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Deposit failed');
    } finally {
      setDepositing(false);
    }
  }

  async function handleSaveToggles() {
    if (!productId) return;
    setSavingToggles(true);
    setError('');
    try {
      const res = await fetch(`/api/escrow/${productId}/config`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ toggles }),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSavingToggles(false);
    }
  }

  async function handleToggleEnabled() {
    if (!productId || !config) return;
    try {
      const res = await fetch(`/api/escrow/${productId}/config`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ enabled: !config.enabled }),
      });
      if (!res.ok) throw new Error('Failed to toggle escrow');
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleInviteAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!productId || !inviteEmail.trim()) return;
    setInviting(true);
    setError('');
    try {
      const res = await fetch(`/api/escrow/${productId}/agents`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: inviteEmail.trim(), displayName: inviteDisplayName.trim() || undefined, reference: inviteReference.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invite failed');
      }
      // Show credentials or access notification
      if (data.agent?.newUser && data.agent?.forgejoPassword) {
        // New Forgejo user — show one-time credentials banner
        setAgentCredentials({
          email: inviteEmail.trim(),
          username: data.agent.forgejoUsername,
          password: data.agent.forgejoPassword,
          isNew: true,
        });
      } else {
        // Existing Forgejo user — show access granted notice
        setAgentCredentials({
          email: inviteEmail.trim(),
          username: data.agent.forgejoUsername,
          password: '',
          isNew: false,
        });
      }
      setInviteEmail('');
      setInviteDisplayName('');
      setInviteReference('');
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Invite failed');
    } finally {
      setInviting(false);
    }
  }

  async function handleRevokeAgent(agentId: string) {
    if (!productId) return;
    if (!window.confirm('Are you sure you want to revoke this agent\'s access? They will no longer be able to view the escrow repository.')) return;
    setRevoking(agentId);
    setError('');
    try {
      const res = await fetch(`/api/escrow/${productId}/agents/${agentId}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Revoke failed');
      }
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Revoke failed');
    } finally {
      setRevoking(null);
    }
  }

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(''), 2000);
  }

  function formatDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  if (loading) {
    return (
      <div className="esc-loading">
        <Loader2 size={24} className="esc-spin" />
        <span>Loading escrow data...</span>
      </div>
    );
  }

  const isConfigured = config?.configured && config?.setupCompleted;
  const ownerUser = agents.find(a => a.role === 'owner' && a.status === 'active');
  const agentUsers = agents.filter(a => a.role === 'agent');
  const activeAgents = agentUsers.filter(a => a.status === 'active');
  const revokedAgents = agentUsers.filter(a => a.status === 'revoked');

  return (
    <>
      <Link to={`/products/${productId}`} className="esc-back-link">
        <ArrowLeft size={16} /> Back to product
      </Link>

      <PageHeader title={`Escrow — ${productName || 'Product'}`} />

      {error && <div className="esc-error">{error}</div>}

      {/* ─── One-time credentials display ─── */}
      {setupCredentials && (
        <div className="esc-credentials-banner">
          <div className="esc-credentials-header">
            <Key size={20} />
            <div>
              <strong>Escrow Repository Credentials</strong>
              <span>Save these now — the password will not be shown again</span>
            </div>
          </div>
          <div className="esc-credentials-grid">
            <div className="esc-credential-row">
              <label>Forgejo URL</label>
              <div className="esc-credential-value">
                <code>https://escrow.cranis2.dev</code>
                <button onClick={() => copyToClipboard('https://escrow.cranis2.dev', 'url')} title="Copy">
                  {copiedField === 'url' ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <div className="esc-credential-row">
              <label>Username</label>
              <div className="esc-credential-value">
                <code>{setupCredentials.username}</code>
                <button onClick={() => copyToClipboard(setupCredentials.username, 'username')} title="Copy">
                  {copiedField === 'username' ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <div className="esc-credential-row">
              <label>Password</label>
              <div className="esc-credential-value">
                <code>{showPassword ? setupCredentials.password : '••••••••••••'}</code>
                <button onClick={() => setShowPassword(!showPassword)} title={showPassword ? 'Hide' : 'Show'}>
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button onClick={() => copyToClipboard(setupCredentials.password, 'password')} title="Copy">
                  {copiedField === 'password' ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>
          <button className="esc-credentials-dismiss" onClick={() => setSetupCredentials(null)}>
            I've saved these credentials
          </button>
        </div>
      )}

      {/* ─── Agent credentials / access notification ─── */}
      {agentCredentials && agentCredentials.isNew && (
        <div className="esc-credentials-banner esc-credentials-agent">
          <div className="esc-credentials-header">
            <Key size={20} />
            <div>
              <strong>New Agent Credentials — {agentCredentials.email}</strong>
              <span>Share these with the agent — the password will not be shown again</span>
            </div>
          </div>
          <div className="esc-credentials-grid">
            <div className="esc-credential-row">
              <label>Forgejo URL</label>
              <div className="esc-credential-value">
                <code>https://escrow.cranis2.dev</code>
                <button onClick={() => copyToClipboard('https://escrow.cranis2.dev', 'agent-url')} title="Copy">
                  {copiedField === 'agent-url' ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <div className="esc-credential-row">
              <label>Username</label>
              <div className="esc-credential-value">
                <code>{agentCredentials.username}</code>
                <button onClick={() => copyToClipboard(agentCredentials.username, 'agent-username')} title="Copy">
                  {copiedField === 'agent-username' ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <div className="esc-credential-row">
              <label>Password</label>
              <div className="esc-credential-value">
                <code>{showPassword ? agentCredentials.password : '••••••••••••'}</code>
                <button onClick={() => setShowPassword(!showPassword)} title={showPassword ? 'Hide' : 'Show'}>
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button onClick={() => copyToClipboard(agentCredentials.password, 'agent-password')} title="Copy">
                  {copiedField === 'agent-password' ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>
          <button className="esc-credentials-dismiss" onClick={() => { setAgentCredentials(null); setShowPassword(false); }}>
            I've shared these credentials
          </button>
        </div>
      )}

      {agentCredentials && !agentCredentials.isNew && (
        <div className="esc-credentials-banner esc-credentials-existing">
          <div className="esc-credentials-header">
            <CheckCircle2 size={20} />
            <div>
              <strong>Access Granted — {agentCredentials.email}</strong>
              <span>This agent already has a Forgejo account and has been notified by email</span>
            </div>
          </div>
          <p className="esc-existing-note">
            <strong>{agentCredentials.username}</strong> has been granted read-only access to this product's escrow repository.
            They can log in with their existing credentials.
          </p>
          <button className="esc-credentials-dismiss" onClick={() => setAgentCredentials(null)}>
            Got it
          </button>
        </div>
      )}

      {/* ─── No repo URL — show message ─── */}
      {!isConfigured && !setupCredentials && !productRepoUrl && (
        <div className="esc-setup-wizard">
          <div className="esc-setup-icon" style={{ color: 'var(--amber)' }}>
            <Archive size={48} />
          </div>
          <h2>Repository Required</h2>
          <p>
            A repository URL must be set on this product before escrow can be enabled.
            Escrow deposits archive your compliance artifacts from your source repository.
          </p>
          <Link to={`/products/${productId}`} className="esc-setup-btn" style={{ textDecoration: 'none' }}>
            <Settings2 size={16} />
            Go to Product Settings
          </Link>
        </div>
      )}

      {/* ─── Not configured — Setup wizard ─── */}
      {!isConfigured && !setupCredentials && productRepoUrl && (
        <div className="esc-setup-wizard">
          <div className="esc-setup-icon">
            <Archive size={48} />
          </div>
          <h2>Enable Escrow Deposits</h2>
          <p>
            Escrow deposits automatically archive your compliance artifacts to a secure,
            EU-sovereign Forgejo repository. This provides your customers with verifiable
            proof of CRA compliance and serves as a data portability archive.
          </p>
          <div className="esc-setup-features">
            <div className="esc-feature">
              <Shield size={18} />
              <div>
                <strong>EU Data Sovereignty</strong>
                <span>Hosted on EU infrastructure, outside CLOUD Act scope</span>
              </div>
            </div>
            <div className="esc-feature">
              <RefreshCw size={18} />
              <div>
                <strong>Automated Daily Deposits</strong>
                <span>Compliance artifacts pushed to your escrow repo at 5 AM daily</span>
              </div>
            </div>
            <div className="esc-feature">
              <Archive size={18} />
              <div>
                <strong>Complete Audit Trail</strong>
                <span>SBOMs, vulnerability reports, licence audits, IP proof, CRA docs</span>
              </div>
            </div>
          </div>
          <button className="esc-setup-btn" onClick={handleSetup} disabled={settingUp}>
            {settingUp ? <Loader2 size={16} className="esc-spin" /> : <Archive size={16} />}
            {settingUp ? 'Setting up...' : 'Enable Escrow'}
          </button>
        </div>
      )}

      {/* ─── Configured — Dashboard ─── */}
      {isConfigured && status && (
        <>
          {/* Status banner */}
          <div className={`esc-status-banner ${status.enabled ? (status.lastDeposit?.status === 'failed' ? 'esc-status-error' : 'esc-status-active') : 'esc-status-disabled'}`}>
            {status.enabled ? (
              status.lastDeposit?.status === 'failed' ? (
                <><XCircle size={18} /> Last deposit failed — check history for details</>
              ) : (
                <><CheckCircle2 size={18} /> Escrow active — deposits run daily at 5 AM</>
              )
            ) : (
              <><Clock size={18} /> Escrow paused — deposits are not being made</>
            )}
            <button className="esc-toggle-btn" onClick={handleToggleEnabled}>
              {status.enabled ? 'Pause' : 'Resume'}
            </button>
          </div>

          {/* Stat cards */}
          <div className="stats">
            <StatCard label="Total Deposits" value={status.stats?.total || 0} color="blue" sub="all time" />
            <StatCard
              label="Last Deposit"
              value={status.lastDeposit?.completedAt ? formatDate(status.lastDeposit.completedAt) : 'Never'}
              color={status.lastDeposit?.status === 'failed' ? 'red' : 'green'}
              sub={status.lastDeposit?.status || 'n/a'}
            />
            <StatCard label="Artifacts" value={status.lastDeposit?.artifactCount || 0} color="amber" sub="in last deposit" />
            <StatCard
              label="Success Rate"
              value={status.stats?.total ? Math.round((status.stats.completed / status.stats.total) * 100) + '%' : '—'}
              color={status.stats?.failed ? 'red' : 'green'}
              sub={`${status.stats?.completed || 0} of ${status.stats?.total || 0}`}
            />
          </div>

          {/* Repository link */}
          {status.repoUrl && (
            <div className="esc-repo-link">
              <Archive size={16} />
              <span>Escrow Repository:</span>
              <a href={status.repoUrl} target="_blank" rel="noopener noreferrer">
                {status.forgejoOrg}/{status.forgejoRepo} <ExternalLink size={12} />
              </a>
            </div>
          )}

          {/* Two-column layout: toggles + actions */}
          <div className="esc-columns">
            {/* Artifact toggles */}
            <div className="esc-card">
              <div className="esc-card-header">
                <Settings2 size={18} />
                <h3>Artifact Settings</h3>
              </div>
              <div className="esc-toggles">
                {[
                  { key: 'includeSbomCyclonedx', label: 'SBOM (CycloneDX)', desc: 'Software bill of materials in CycloneDX format' },
                  { key: 'includeSbomSpdx', label: 'SBOM (SPDX)', desc: 'Software bill of materials in SPDX format' },
                  { key: 'includeVulnReport', label: 'Vulnerability Report', desc: 'Latest vulnerability scan results and findings' },
                  { key: 'includeLicenseAudit', label: 'Licence Audit', desc: 'Dependency licence scan and compliance status' },
                  { key: 'includeIpProof', label: 'IP Proof', desc: 'Intellectual property provenance snapshot' },
                  { key: 'includeCraDocs', label: 'CRA Documentation', desc: 'Conformity obligations and ENISA reports' },
                  { key: 'includeTimeline', label: 'Compliance Timeline', desc: 'Historical compliance data over time' },
                ].map(item => (
                  <label key={item.key} className="esc-toggle-item">
                    <input
                      type="checkbox"
                      checked={(toggles as any)[item.key]}
                      onChange={e => setToggles(prev => ({ ...prev, [item.key]: e.target.checked }))}
                    />
                    <div>
                      <span className="esc-toggle-label">{item.label}</span>
                      <span className="esc-toggle-desc">{item.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
              <button className="esc-save-btn" onClick={handleSaveToggles} disabled={savingToggles}>
                {savingToggles ? 'Saving...' : 'Save Settings'}
              </button>
            </div>

            {/* Manual deposit */}
            <div className="esc-card">
              <div className="esc-card-header">
                <Archive size={18} />
                <h3>Manual Deposit</h3>
              </div>
              <p className="esc-card-desc">
                Trigger an immediate deposit of compliance artifacts to the escrow repository.
                Automated deposits run daily at 5 AM.
              </p>
              <button className="esc-deposit-btn" onClick={handleDeposit} disabled={depositing || !status.enabled}>
                {depositing ? <Loader2 size={16} className="esc-spin" /> : <RefreshCw size={16} />}
                {depositing ? 'Depositing...' : 'Run Deposit Now'}
              </button>
            </div>
          </div>

          {/* ─── Escrow Access ─── */}
          <div className="esc-card esc-access-card">
            <div className="esc-card-header">
              <Users size={18} />
              <h3>Escrow Access</h3>
            </div>
            <p className="esc-card-desc">
              Manage who can access this product's escrow repository. The product owner has write access.
              Escrow agents (third parties) receive read-only access.
            </p>

            {/* Owner row */}
            {ownerUser && (
              <div className="esc-owner-row">
                <div className="esc-owner-info">
                  <div className="esc-owner-avatar">
                    <Shield size={16} />
                  </div>
                  <div className="esc-owner-details">
                    <span className="esc-owner-name">{ownerUser.displayName || ownerUser.email}</span>
                    <span className="esc-owner-email">{ownerUser.email}</span>
                  </div>
                </div>
                <div className="esc-owner-meta">
                  <span className="esc-badge esc-badge-owner">Owner</span>
                  <span className="esc-badge esc-badge-write">Write</span>
                  {ownerUser.forgejoUsername && (
                    <span className="esc-forgejo-user">
                      <code>{ownerUser.forgejoUsername}</code>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Agent list */}
            {activeAgents.length > 0 && (
              <div className="esc-agents-section">
                <h4 className="esc-section-title">Escrow Agents</h4>
                <div className="esc-table-wrap">
                  <table className="esc-table">
                    <thead>
                      <tr>
                        <th>Agent</th>
                        <th>Reference</th>
                        <th>Forgejo User</th>
                        <th>Permission</th>
                        <th>Invited</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeAgents.map(agent => (
                        <tr key={agent.id}>
                          <td>
                            <div className="esc-agent-cell">
                              <span className="esc-agent-name">{agent.displayName || '—'}</span>
                              <span className="esc-agent-email">{agent.email}</span>
                            </div>
                          </td>
                          <td><code className="esc-sha">{agent.agentReference || '—'}</code></td>
                          <td><code className="esc-sha">{agent.forgejoUsername || '—'}</code></td>
                          <td><span className="esc-badge esc-badge-read">Read-only</span></td>
                          <td className="esc-trigger">{formatDate(agent.createdAt)}</td>
                          <td>
                            <button
                              className="esc-revoke-btn"
                              onClick={() => handleRevokeAgent(agent.id)}
                              disabled={revoking === agent.id}
                              title="Revoke access"
                            >
                              {revoking === agent.id ? <Loader2 size={14} className="esc-spin" /> : <UserX size={14} />}
                              Revoke
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Revoked agents (collapsed) */}
            {revokedAgents.length > 0 && (
              <details className="esc-revoked-section">
                <summary className="esc-revoked-summary">
                  {revokedAgents.length} revoked agent{revokedAgents.length !== 1 ? 's' : ''}
                </summary>
                <div className="esc-table-wrap">
                  <table className="esc-table">
                    <thead>
                      <tr>
                        <th>Agent</th>
                        <th>Forgejo User</th>
                        <th>Status</th>
                        <th>Revoked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revokedAgents.map(agent => (
                        <tr key={agent.id} className="esc-row-revoked">
                          <td>
                            <div className="esc-agent-cell">
                              <span className="esc-agent-name">{agent.displayName || '—'}</span>
                              <span className="esc-agent-email">{agent.email}</span>
                            </div>
                          </td>
                          <td><code className="esc-sha">{agent.forgejoUsername || '—'}</code></td>
                          <td><span className="esc-badge esc-badge-revoked">Revoked</span></td>
                          <td className="esc-trigger">{formatDate(agent.revokedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            {/* Invite form */}
            <div className="esc-invite-section">
              <h4 className="esc-section-title">
                <UserPlus size={15} />
                Invite Escrow Agent
              </h4>
              <form className="esc-invite-form" onSubmit={handleInviteAgent}>
                <div className="esc-invite-fields">
                  <div className="esc-invite-field">
                    <label htmlFor="agent-email">
                      <Mail size={14} />
                      Email address
                    </label>
                    <input
                      id="agent-email"
                      type="email"
                      placeholder="agent@escrow-firm.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="esc-invite-field">
                    <label htmlFor="agent-name">
                      <Users size={14} />
                      Display name (optional)
                    </label>
                    <input
                      id="agent-name"
                      type="text"
                      placeholder="Escrow Firm AG"
                      value={inviteDisplayName}
                      onChange={e => setInviteDisplayName(e.target.value)}
                    />
                  </div>
                  <div className="esc-invite-field">
                    <label htmlFor="agent-ref">
                      <Archive size={14} />
                      Agent reference (optional)
                    </label>
                    <input
                      id="agent-ref"
                      type="text"
                      placeholder="e.g. ENG-2026-001, Case #4412"
                      value={inviteReference}
                      onChange={e => setInviteReference(e.target.value)}
                    />
                  </div>
                </div>
                <button type="submit" className="esc-invite-btn" disabled={inviting || !inviteEmail.trim()}>
                  {inviting ? <Loader2 size={15} className="esc-spin" /> : <UserPlus size={15} />}
                  {inviting ? 'Inviting...' : 'Invite Agent'}
                </button>
              </form>
              <p className="esc-invite-note">
                The agent will receive read-only access to this product's escrow repository and be notified by email.
                If this is their first invitation, a Forgejo account will be created automatically.
              </p>
            </div>
          </div>

          {/* Deposit history */}
          <div className="esc-card esc-history-card">
            <div className="esc-card-header">
              <Clock size={18} />
              <h3>Deposit History</h3>
            </div>
            {deposits.length === 0 ? (
              <p className="esc-empty">No deposits yet.</p>
            ) : (
              <div className="esc-table-wrap">
                <table className="esc-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Trigger</th>
                      <th>Artifacts</th>
                      <th>Commit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deposits.map(d => (
                      <tr key={d.id}>
                        <td>{formatDate(d.completedAt || d.startedAt)}</td>
                        <td>
                          <span className={`esc-badge esc-badge-${d.status}`}>
                            {d.status === 'completed' && <CheckCircle2 size={12} />}
                            {d.status === 'failed' && <XCircle size={12} />}
                            {d.status === 'running' && <Loader2 size={12} className="esc-spin" />}
                            {d.status}
                          </span>
                        </td>
                        <td className="esc-trigger">{d.trigger}</td>
                        <td>{d.artifactCount || 0}</td>
                        <td className="esc-sha">{d.commitSha?.slice(0, 8) || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

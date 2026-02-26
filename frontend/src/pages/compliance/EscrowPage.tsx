import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import {
  ArrowLeft, Archive, CheckCircle2, XCircle, Clock, Loader2,
  ExternalLink, RefreshCw, Settings2, Shield
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

export default function EscrowPage() {
  const { productId } = useParams<{ productId: string }>();
  const [productName, setProductName] = useState('');
  const [config, setConfig] = useState<EscrowConfig | null>(null);
  const [status, setStatus] = useState<EscrowStatus | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingUp, setSettingUp] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const [savingToggles, setSavingToggles] = useState(false);
  const [error, setError] = useState('');
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
      }

      // Fetch config + status + deposits in parallel
      const [configRes, statusRes, depositsRes] = await Promise.all([
        fetch(`/api/escrow/${productId}/config`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/escrow/${productId}/status`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/escrow/${productId}/deposits?limit=20`, { headers: { Authorization: `Bearer ${token}` } }),
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

  return (
    <>
      <Link to={`/products/${productId}`} className="esc-back-link">
        <ArrowLeft size={16} /> Back to product
      </Link>

      <PageHeader title={`Escrow — ${productName || 'Product'}`} />

      {error && <div className="esc-error">{error}</div>}

      {/* ─── Not configured — Setup wizard ─── */}
      {!isConfigured && (
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

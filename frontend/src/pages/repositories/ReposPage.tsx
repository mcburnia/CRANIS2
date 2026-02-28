import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  GitBranch, Star, GitFork, AlertCircle, Users, ExternalLink, Github,
  Link2, ChevronDown, ChevronRight, Key, Server, Check, X, Loader, Unlink
} from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import './ReposPage.css';

// Codeberg SVG icon (not in lucide)
function CodebergIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 19.5h20L12 2z" />
      <path d="M12 8v6" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}


interface Repo {
  fullName: string;
  url: string;
  description: string;
  language: string;
  languages: string;
  stars: number;
  forks: number;
  openIssues: number;
  visibility: string;
  defaultBranch: string;
  lastPush: string | null;
  syncedAt: string | null;
  isPrivate: boolean;
  contributorCount: number;
  lastSyncDuration?: number;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  provider?: string;
}

interface ProductRepo {
  id: string;
  name: string;
  craCategory: string | null;
  repo: Repo | null;
}

interface OverviewData {
  products: ProductRepo[];
  totals: { totalProducts: number; connectedRepos: number; disconnectedProducts: number; totalOpenIssues: number };
}

interface ProviderDef {
  id: string;
  label: string;
  selfHosted: boolean;
  oauthSupported: boolean;
  supportsApiSbom: boolean;
}

interface Connection {
  provider: string;
  username: string;
  avatarUrl: string | null;
  scope: string;
  connectedAt: string;
  instanceUrl: string | null;
}

type Filter = 'all' | 'connected' | 'disconnected' | 'github' | 'codeberg';

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

const LANG_COLORS: Record<string, string> = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', HTML: '#e34c26', CSS: '#563d7c',
  Python: '#3572A5', Java: '#b07219', Go: '#00ADD8', Rust: '#dea584',
  Ruby: '#701516', PHP: '#4F5D95', C: '#555555', 'C++': '#f34b7d',
  'C#': '#178600', Shell: '#89e051', Dockerfile: '#384d54',
};

function detectProvider(url: string): string {
  try {
    const hostname = new URL(url.includes('://') ? url : `https://${url}`).hostname;
    if (hostname === 'codeberg.org') return 'codeberg';
  } catch { /* ignore */ }
  return 'github';
}

// ─── Provider Connections Panel ──────────────────────────────────

function ProviderConnections({ onConnectionChange }: { onConnectionChange: () => void }) {
  const [providers, setProviders] = useState<ProviderDef[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [showPatForm, setShowPatForm] = useState(false);
  const [patProvider, setPatProvider] = useState('forgejo');
  const [patUrl, setPatUrl] = useState('');
  const [patToken, setPatToken] = useState('');
  const [patLoading, setPatLoading] = useState(false);
  const [patError, setPatError] = useState('');
  const [patSuccess, setPatSuccess] = useState('');
  const token = localStorage.getItem('session_token');

  const fetchConnections = useCallback(async () => {
    if (!token) return;
    try {
      const [provRes, statusRes] = await Promise.all([
        fetch('/api/repo/providers', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/repo/status', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (provRes.ok) setProviders(await provRes.json());
      if (statusRes.ok) {
        const data = await statusRes.json();
        setConnections(data.connections || []);
      }
    } catch { /* silent */ }
  }, [token]);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);

  const handlePatConnect = async () => {
    setPatLoading(true);
    setPatError('');
    setPatSuccess('');
    try {
      const res = await fetch('/api/repo/connect-pat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: patProvider, instanceUrl: patUrl, accessToken: patToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPatError(data.error || 'Connection failed');
      } else {
        setPatSuccess(`Connected as ${data.username}`);
        setPatToken('');
        setShowPatForm(false);
        await fetchConnections();
        onConnectionChange();
      }
    } catch (err: any) {
      setPatError(err.message || 'Network error');
    } finally {
      setPatLoading(false);
    }
  };

  const handleDisconnect = async (prov: string) => {
    if (!confirm(`Disconnect ${prov}? This will remove access to repositories on this provider.`)) return;
    try {
      const res = await fetch(`/api/repo/disconnect/${prov}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await fetchConnections();
        onConnectionChange();
      }
    } catch { /* silent */ }
  };

  const connectedIds = new Set(connections.map(c => c.provider));
  const selfHostedProviders = providers.filter(p => p.selfHosted);
  const connectableCount = selfHostedProviders.filter(p => !connectedIds.has(p.id)).length;

  function providerIcon(id: string) {
    if (id === 'github') return <Github size={14} />;
    if (id === 'codeberg') return <CodebergIcon size={14} />;
    return <Server size={14} />;
  }

  return (
    <div className="rp-connections">
      <div className="rp-conn-header" onClick={() => setExpanded(!expanded)}>
        <div className="rp-conn-title">
          <Link2 size={16} />
          <span>Provider Connections</span>
          <span className="rp-conn-count">
            {connections.length} connected
            {connectableCount > 0 && ` \u2022 ${connectableCount} available`}
          </span>
        </div>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </div>

      {expanded && (
        <div className="rp-conn-body">
          {/* Connected providers */}
          {connections.length > 0 && (
            <div className="rp-conn-list">
              {connections.map(c => (
                <div key={c.provider} className="rp-conn-item connected">
                  <div className="rp-conn-item-left">
                    {providerIcon(c.provider)}
                    <div>
                      <span className="rp-conn-provider">{c.provider}</span>
                      <span className="rp-conn-username">{c.username}</span>
                      {c.instanceUrl && (
                        <span className="rp-conn-instance">{c.instanceUrl}</span>
                      )}
                    </div>
                  </div>
                  <div className="rp-conn-item-right">
                    <span className="rp-conn-status connected"><Check size={12} /> Connected</span>
                    <button className="rp-conn-disconnect" onClick={() => handleDisconnect(c.provider)} title="Disconnect">
                      <Unlink size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Self-hosted PAT connect form */}
          {!showPatForm ? (
            <button className="rp-conn-add-btn" onClick={() => setShowPatForm(true)}>
              <Key size={14} /> Connect Self-Hosted Provider (PAT)
            </button>
          ) : (
            <div className="rp-pat-form">
              <div className="rp-pat-form-header">
                <Key size={14} />
                <span>Connect with Personal Access Token</span>
                <button className="rp-pat-close" onClick={() => { setShowPatForm(false); setPatError(''); setPatSuccess(''); }}>
                  <X size={14} />
                </button>
              </div>

              <div className="rp-pat-field">
                <label>Provider</label>
                <select value={patProvider} onChange={e => setPatProvider(e.target.value)}>
                  {selfHostedProviders.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div className="rp-pat-field">
                <label>Instance URL</label>
                <input
                  type="url"
                  placeholder="https://git.example.com"
                  value={patUrl}
                  onChange={e => setPatUrl(e.target.value)}
                />
              </div>

              <div className="rp-pat-field">
                <label>Personal Access Token</label>
                <input
                  type="password"
                  placeholder="Enter your PAT"
                  value={patToken}
                  onChange={e => setPatToken(e.target.value)}
                />
                <span className="rp-pat-hint">Token needs read access to repositories</span>
              </div>

              {patError && <div className="rp-pat-error">{patError}</div>}
              {patSuccess && <div className="rp-pat-success">{patSuccess}</div>}

              <button
                className="rp-pat-submit"
                onClick={handlePatConnect}
                disabled={patLoading || !patUrl || !patToken}
              >
                {patLoading ? <><Loader size={14} className="spin" /> Validating...</> : 'Test & Connect'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────

export default function ReposPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  const fetchData = useCallback(() => {
    const token = localStorage.getItem('session_token');
    fetch('/api/repos/overview', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <><PageHeader title="Repositories" /><p className="rp-empty">Loading...</p></>;
  if (!data) return <><PageHeader title="Repositories" /><p className="rp-empty">Unable to load repositories.</p></>;

  const { products, totals } = data;
  if (products.length === 0) return (
    <>
      <PageHeader title="Repositories" />
      <ProviderConnections onConnectionChange={fetchData} />
      <p className="rp-empty">No products yet. <Link to="/products">Add your first product</Link> to connect a repository.</p>
    </>
  );

  const filtered = products.filter(p => {
    if (filter === 'connected') return p.repo !== null;
    if (filter === 'disconnected') return p.repo === null;
    if (filter === 'github') return p.repo !== null && (p.repo.provider || detectProvider(p.repo.url)) === 'github';
    if (filter === 'codeberg') return p.repo !== null && (p.repo.provider || detectProvider(p.repo.url)) === 'codeberg';
    return true;
  });

  // Count providers for filter badges
  const githubCount = products.filter(p => p.repo && (p.repo.provider || detectProvider(p.repo.url)) === 'github').length;
  const codebergCount = products.filter(p => p.repo && (p.repo.provider || detectProvider(p.repo.url)) === 'codeberg').length;

  return (
    <>
      <PageHeader title="Repositories" />
      <div className="rp-stats">
        <StatCard label="Products" value={totals.totalProducts} color="blue" sub="registered" />
        <StatCard label="Connected" value={totals.connectedRepos} color="green" sub="repositories linked" />
        <StatCard label="Disconnected" value={totals.disconnectedProducts} color="amber" sub="need linking" />
        <StatCard label="Open Issues" value={totals.totalOpenIssues} color="red" sub="across all repos" />
      </div>

      <ProviderConnections onConnectionChange={fetchData} />

      <div className="rp-filter-bar">
        {([
          { key: 'all' as Filter, label: 'All' },
          { key: 'connected' as Filter, label: 'Connected' },
          { key: 'disconnected' as Filter, label: 'Not Connected' },
          { key: 'github' as Filter, label: `GitHub${githubCount > 0 ? ` (${githubCount})` : ''}` },
          { key: 'codeberg' as Filter, label: `Codeberg${codebergCount > 0 ? ` (${codebergCount})` : ''}` },
        ]).map(f => (
          <button key={f.key} className={`rp-filter-btn ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
            {f.key === 'github' && <Github size={13} />}
            {f.key === 'codeberg' && <CodebergIcon size={13} />}
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && <p className="rp-empty">No products match this filter.</p>}

      {filtered.map(product => {
        const repoProvider = product.repo ? (product.repo.provider || detectProvider(product.repo.url)) : null;

        return (
          <div key={product.id} className="rp-product-card">
            <div className="rp-card-header">
              <h3><Link to={`/products/${product.id}?tab=overview`}>{product.name}</Link></h3>
              {product.repo ? (
                <>
                  <span className={`rp-badge rp-badge-provider rp-badge-${repoProvider}`}>
                    {repoProvider === 'codeberg' ? <CodebergIcon size={11} /> : <Github size={11} />}
                    {repoProvider === 'codeberg' ? 'Codeberg' : repoProvider === 'github' ? 'GitHub' : repoProvider}
                  </span>
                  <span className={`rp-badge ${product.repo.isPrivate ? 'private' : 'public'}`}>
                    {product.repo.visibility}
                  </span>
                </>
              ) : (
                <span className="rp-badge disconnected">No Repo</span>
              )}
              {product.repo && (
                <a href={product.repo.url} target="_blank" rel="noopener noreferrer"
                   style={{ color: 'var(--muted)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: 'auto' }}>
                  {product.repo.fullName} <ExternalLink size={12} />
                </a>
              )}
            </div>

            {product.repo ? (
              <>
                {product.repo.description && (
                  <div className="rp-description">{product.repo.description}</div>
                )}
                <div className="rp-repo-details">
                  {product.repo.language && (
                    <div className="rp-repo-detail">
                      <span className="rp-lang-dot" style={{ background: LANG_COLORS[product.repo.language] || '#888' }} />
                      <span className="value">{product.repo.language}</span>
                    </div>
                  )}
                  <div className="rp-repo-detail">
                    <Star size={14} /> <span className="value">{product.repo.stars}</span>
                  </div>
                  <div className="rp-repo-detail">
                    <GitFork size={14} /> <span className="value">{product.repo.forks}</span>
                  </div>
                  <div className="rp-repo-detail">
                    <AlertCircle size={14} /> <span className="value">{product.repo.openIssues}</span> <span className="label">issues</span>
                  </div>
                  <div className="rp-repo-detail">
                    <Users size={14} /> <span className="value">{product.repo.contributorCount}</span> <span className="label">contributors</span>
                  </div>
                  <div className="rp-repo-detail">
                    <GitBranch size={14} /> <span className="value">{product.repo.defaultBranch}</span>
                  </div>
                </div>
                <div className="rp-repo-meta">
                  <span>Last push: {formatTimeAgo(product.repo.lastPush)}</span>
                  <span>Last sync: {formatTimeAgo(product.repo.syncedAt)}</span>
                  {product.repo.lastSyncDuration != null && (
                    <span>Sync duration: {product.repo.lastSyncDuration.toFixed(1)}s</span>
                  )}
                </div>
              </>
            ) : (
              <div className="rp-disconnected">
                No repository connected. <Link to={`/products/${product.id}`}>Go to product</Link> to connect a repository.
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

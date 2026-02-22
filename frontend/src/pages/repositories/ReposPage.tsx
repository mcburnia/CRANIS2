import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { GitBranch, Star, GitFork, AlertCircle, Users, ExternalLink } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import './ReposPage.css';

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

type Filter = 'all' | 'connected' | 'disconnected';

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

export default function ReposPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    fetch('/api/repos/overview', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <><PageHeader title="Repositories" /><p className="rp-empty">Loading...</p></>;
  if (!data) return <><PageHeader title="Repositories" /><p className="rp-empty">Unable to load repositories.</p></>;

  const { products, totals } = data;
  if (products.length === 0) return (
    <><PageHeader title="Repositories" /><p className="rp-empty">No products yet. <Link to="/products">Add your first product</Link> to connect a repository.</p></>
  );

  const filtered = products.filter(p => {
    if (filter === 'connected') return p.repo !== null;
    if (filter === 'disconnected') return p.repo === null;
    return true;
  });

  return (
    <>
      <PageHeader title="Repositories" />
      <div className="rp-stats">
        <StatCard label="Products" value={totals.totalProducts} color="blue" sub="registered" />
        <StatCard label="Connected" value={totals.connectedRepos} color="green" sub="repositories linked" />
        <StatCard label="Disconnected" value={totals.disconnectedProducts} color="amber" sub="need linking" />
        <StatCard label="Open Issues" value={totals.totalOpenIssues} color="red" sub="across all repos" />
      </div>

      <div className="rp-filter-bar">
        {(['all', 'connected', 'disconnected'] as Filter[]).map(f => (
          <button key={f} className={`rp-filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'connected' ? 'Connected' : 'Not Connected'}
          </button>
        ))}
      </div>

      {filtered.length === 0 && <p className="rp-empty">No products match this filter.</p>}

      {filtered.map(product => (
        <div key={product.id} className="rp-product-card">
          <div className="rp-card-header">
            <h3><Link to={`/products/${product.id}?tab=overview`}>{product.name}</Link></h3>
            {product.repo ? (
              <span className={`rp-badge ${product.repo.isPrivate ? 'private' : 'public'}`}>
                {product.repo.visibility}
              </span>
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
              No repository connected. <Link to={`/products/${product.id}`}>Go to product</Link> to connect a GitHub repository.
            </div>
          )}
        </div>
      ))}
    </>
  );
}

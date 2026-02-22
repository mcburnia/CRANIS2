import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import './ContributorsPage.css';

interface Contributor {
  githubLogin: string;
  githubId: number;
  avatarUrl: string;
  profileUrl: string;
  contributions: number;
}

interface ProductContributors {
  id: string;
  name: string;
  craCategory: string | null;
  repoFullName: string | null;
  contributors: Contributor[];
}

interface OverviewData {
  products: ProductContributors[];
  totals: { totalContributors: number; totalContributions: number; productsWithRepos: number; totalProducts: number };
}

type Filter = 'all' | 'has_contributors' | 'no_repo';

export default function ContributorsPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    fetch('/api/contributors/overview', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <><PageHeader title="Contributors" /><p className="cp-empty">Loading...</p></>;
  if (!data) return <><PageHeader title="Contributors" /><p className="cp-empty">Unable to load contributors.</p></>;

  const { products, totals } = data;
  if (products.length === 0) return (
    <><PageHeader title="Contributors" /><p className="cp-empty">No products yet. <Link to="/products">Add your first product</Link> to see contributors.</p></>
  );

  const filtered = products.filter(p => {
    if (filter === 'has_contributors') return p.contributors.length > 0;
    if (filter === 'no_repo') return !p.repoFullName;
    return true;
  });

  return (
    <>
      <PageHeader title="Contributors" />
      <div className="cp-stats">
        <StatCard label="Contributors" value={totals.totalContributors} color="blue" sub="unique across all repos" />
        <StatCard label="Contributions" value={totals.totalContributions} color="green" sub="total commits" />
        <StatCard label="With Repos" value={totals.productsWithRepos} color="blue" sub={`of ${totals.totalProducts} products`} />
      </div>

      <div className="cp-filter-bar">
        {[
          { key: 'all' as Filter, label: 'All' },
          { key: 'has_contributors' as Filter, label: 'Has Contributors' },
          { key: 'no_repo' as Filter, label: 'No Repo' },
        ].map(f => (
          <button key={f.key} className={`cp-filter-btn ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && <p className="cp-empty">No products match this filter.</p>}

      {filtered.map(product => (
        <div key={product.id} className="cp-product-card">
          <div className="cp-card-header">
            <h3><Link to={`/products/${product.id}?tab=overview`}>{product.name}</Link></h3>
            {product.contributors.length > 0 && (
              <span className="cp-count-badge">{product.contributors.length} contributor{product.contributors.length !== 1 ? 's' : ''}</span>
            )}
            {product.repoFullName && (
              <span className="cp-repo-name">{product.repoFullName}</span>
            )}
          </div>

          {!product.repoFullName ? (
            <div className="cp-no-repo">
              No repository connected. <Link to={`/products/${product.id}`}>Connect a repository</Link> to see contributors.
            </div>
          ) : product.contributors.length === 0 ? (
            <div className="cp-no-repo">No contributors found. Sync the repository to populate contributor data.</div>
          ) : (
            <div className="cp-contributors-grid">
              {product.contributors.map(c => (
                <div key={c.githubId} className="cp-contributor">
                  <a href={c.profileUrl} target="_blank" rel="noopener noreferrer">
                    <img src={c.avatarUrl} alt={c.githubLogin} className="cp-avatar" />
                    <div className="cp-contributor-info">
                      <div className="cp-contributor-login">{c.githubLogin}</div>
                      <div className="cp-contributor-commits">{c.contributions} commit{c.contributions !== 1 ? 's' : ''}</div>
                    </div>
                    <ExternalLink size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

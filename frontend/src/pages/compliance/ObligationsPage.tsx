import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import './ObligationsPage.css';

interface Obligation {
  id: string;
  obligationKey: string;
  article: string;
  title: string;
  description: string;
  status: string;
  notes: string;
}

interface ProductOverview {
  id: string;
  name: string;
  craCategory: string | null;
  obligations: Obligation[];
  progress: { total: number; completed: number; inProgress: number; notStarted: number };
}

interface OverviewData {
  products: ProductOverview[];
  totals: { totalObligations: number; completed: number; inProgress: number; notStarted: number };
}

function formatCategory(cat: string | null): { label: string; color: string } {
  if (!cat) return { label: 'Unclassified', color: 'muted' };
  switch (cat) {
    case 'default': return { label: 'Default', color: 'green' };
    case 'important_i': return { label: 'Important I', color: 'amber' };
    case 'important_ii': return { label: 'Important II', color: 'amber' };
    case 'critical': return { label: 'Critical', color: 'red' };
    default: return { label: cat, color: 'muted' };
  }
}

function formatStatus(status: string): string {
  switch (status) {
    case 'met': return 'Met';
    case 'in_progress': return 'In Progress';
    case 'not_started': return 'Not Started';
    default: return status;
  }
}

type Filter = 'all' | 'outstanding' | 'met';

export default function ObligationsPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    async function fetchOverview() {
      try {
        const res = await fetch('/api/obligations/overview', {
          headers: { Authorization: `Bearer ${localStorage.getItem('session_token')}` },
        });
        if (res.ok) setData(await res.json());
      } catch (err) {
        console.error('Failed to fetch obligations overview:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchOverview();
  }, []);

  if (loading) {
    return (
      <>
        <PageHeader title="Obligations" timestamp="CRA & NIS2" />
        <p className="ob-empty">Loading obligations...</p>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader title="Obligations" timestamp="CRA & NIS2" />
        <p className="ob-empty">Unable to load obligations. Please try refreshing.</p>
      </>
    );
  }

  const { products, totals } = data;
  const compliancePercent = totals.totalObligations > 0
    ? Math.round((totals.completed / totals.totalObligations) * 100)
    : 0;

  const filteredProducts = products.filter(p => {
    if (filter === 'met') return p.progress.completed === p.progress.total;
    if (filter === 'outstanding') return p.progress.completed < p.progress.total;
    return true;
  });

  return (
    <>
      <PageHeader title="Obligations" timestamp="CRA & NIS2" />

      <div className="stats">
        <StatCard label="Total Obligations" value={totals.totalObligations} color="blue" sub={`across ${products.length} product${products.length !== 1 ? 's' : ''}`} />
        <StatCard label="Met" value={totals.completed} color="green" sub={`${compliancePercent}% compliant`} />
        <StatCard label="In Progress" value={totals.inProgress} color="amber" />
        <StatCard label="Not Started" value={totals.notStarted} color="red" />
      </div>

      <div className="ob-filter-bar">
        <button className={`ob-filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
        <button className={`ob-filter-btn ${filter === 'outstanding' ? 'active' : ''}`} onClick={() => setFilter('outstanding')}>Has Outstanding</button>
        <button className={`ob-filter-btn ${filter === 'met' ? 'active' : ''}`} onClick={() => setFilter('met')}>All Met</button>
      </div>

      {products.length === 0 ? (
        <p className="ob-empty">No products yet. <Link to="/products">Add your first product</Link> to begin tracking obligations.</p>
      ) : filteredProducts.length === 0 ? (
        <p className="ob-empty">No products match the current filter.</p>
      ) : (
        filteredProducts.map(product => {
          const cat = formatCategory(product.craCategory);
          const progressPercent = product.progress.total > 0
            ? Math.round((product.progress.completed / product.progress.total) * 100)
            : 0;
          const progressColor = progressPercent === 0 ? 'red' : progressPercent >= 100 ? 'green' : 'amber';

          return (
            <div key={product.id} className="ob-product-card">
              <div className="ob-card-header">
                <Link to={`/products/${product.id}?tab=obligations`} className="ob-product-name">{product.name}</Link>
                <span className={`ob-cat-badge ${cat.color}`}>{cat.label}</span>
                <div className="ob-progress-area">
                  <div className="ob-progress-bar">
                    <div className={`ob-progress-fill ${progressColor}`} style={{ width: `${Math.max(progressPercent, 2)}%` }} />
                  </div>
                  <span className="ob-progress-text">{product.progress.completed}/{product.progress.total}</span>
                </div>
              </div>
              <div className="ob-sections">
                {product.obligations.map(ob => (
                  <Link
                    key={ob.id}
                    to={`/products/${product.id}?tab=obligations`}
                    className="ob-section-row"
                  >
                    <div className={`ob-section-dot ${ob.status}`} />
                    <span className="ob-section-title">{ob.title}</span>
                    <span className="ob-section-ref">{ob.article}</span>
                    <span className="ob-section-status">{formatStatus(ob.status)}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })
      )}
    </>
  );
}

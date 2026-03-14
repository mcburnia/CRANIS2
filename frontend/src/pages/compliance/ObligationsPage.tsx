import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import HelpTip from '../../components/HelpTip';
import StatCard from '../../components/StatCard';
import { usePageMeta } from '../../hooks/usePageMeta';
import { Info } from 'lucide-react';
import './ObligationsPage.css';

interface Obligation {
  id: string;
  obligationKey: string;
  article: string;
  title: string;
  description: string;
  status: string;
  derivedStatus: string | null;
  derivedReason: string | null;
  effectiveStatus: string;
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
  craRole?: string;
  products: ProductOverview[];
  totals: { totalObligations: number; completed: number; inProgress: number; notStarted: number };
}

function formatCategory(cat: string | null): { label: string; color: string } {
  if (!cat) return { label: 'Unclassified', color: 'muted' };
  const normalised = cat === 'category-1' || cat === 'class_i' ? 'important_i'
    : cat === 'category-2' || cat === 'class_ii' ? 'important_ii'
    : cat;
  switch (normalised) {
    case 'default': return { label: 'Default', color: 'green' };
    case 'important_i': return { label: 'Important I', color: 'amber' };
    case 'important_ii': return { label: 'Important II', color: 'orange' };
    case 'critical': return { label: 'Critical', color: 'red' };
    default: return { label: 'Unclassified', color: 'muted' };
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

const ROLE_GUIDANCE: Record<string, { heading: string; body: string; article: string }> = {
  importer: {
    heading: 'Importer Obligations — CRA Article 18',
    body: 'As an importer, your obligations focus on verifying manufacturer compliance before placing products on the EU market. You must ensure the manufacturer has performed the correct conformity assessment, that the product bears the CE marking, and that technical documentation is available upon request. You must also identify yourself on the product and report known vulnerabilities to ENISA.',
    article: 'Art. 18',
  },
  distributor: {
    heading: 'Distributor Obligations — CRA Article 19',
    body: 'As a distributor, your obligations focus on verifying documentation and markings before making products available on the EU market. You must check the CE marking, confirm the EU Declaration of Conformity exists, and ensure the manufacturer and importer are identified. You must not supply products you believe to be non-compliant.',
    article: 'Art. 19',
  },
  open_source_steward: {
    heading: 'Open Source Steward Obligations — CRA Article 24',
    body: 'As an open source steward, you share the manufacturer obligations for products with digital elements that you systematically provide for commercial use. Your obligations are set out in Articles 13\u201316 of the CRA.',
    article: 'Art. 24',
  },
};

type Filter = 'all' | 'outstanding' | 'met';

export default function ObligationsPage() {
  usePageMeta();
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

  const { products, totals, craRole } = data;
  const guidance = craRole ? ROLE_GUIDANCE[craRole] : undefined;
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

      {guidance && (
        <div className="ob-role-guidance">
          <Info size={18} className="ob-role-guidance-icon" />
          <div>
            <strong>{guidance.heading}</strong>
            <p>{guidance.body}</p>
          </div>
        </div>
      )}

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
      <p className="ob-legend">
        <span className="ob-legend-dot" /> Manual&nbsp;&nbsp;&nbsp;
        <span className="ob-legend-auto">auto</span> Auto-detected from platform data
      </p>

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
                {product.obligations.map(ob => {
                  const isAutoAdvanced = ob.derivedStatus && ob.effectiveStatus !== ob.status;
                  const isPlatformConfirmed = ob.derivedStatus && ob.derivedStatus === ob.status && ob.status !== 'not_started';
                  return (
                    <Link
                      key={ob.id}
                      to={`/products/${product.id}?tab=obligations`}
                      className="ob-section-row"
                    >
                      <div className={`ob-section-dot ${ob.effectiveStatus}`} />
                      <span className="ob-section-title">{ob.title} <HelpTip text={ob.description} /></span>
                      <span className="ob-section-ref">{ob.article}</span>
                      <span className="ob-section-status">
                        {formatStatus(ob.effectiveStatus)}
                        {isAutoAdvanced && (
                          <span className="ob-auto-badge" title={ob.derivedReason || 'Auto-detected from platform data'}>auto</span>
                        )}
                        {isPlatformConfirmed && (
                          <span className="ob-confirmed-badge" title={ob.derivedReason || 'Confirmed by platform data'}>✓</span>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </>
  );
}

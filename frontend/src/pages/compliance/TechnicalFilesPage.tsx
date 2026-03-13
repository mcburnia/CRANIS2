import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Download, Loader2, FileText } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { usePageMeta } from '../../hooks/usePageMeta';
import './TechnicalFilesPage.css';

interface Section {
  sectionKey: string;
  title: string;
  status: string;
  craReference: string;
  updatedAt: string | null;
}

interface ProductOverview {
  id: string;
  name: string;
  craCategory: string | null;
  sections: Section[];
  progress: { total: number; completed: number; inProgress: number; notStarted: number };
}

interface OverviewData {
  products: ProductOverview[];
  totals: { totalSections: number; completed: number; inProgress: number; notStarted: number };
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
    case 'completed': return 'Complete';
    case 'in_progress': return 'In Progress';
    case 'not_started': return 'Not Started';
    default: return status;
  }
}

type Filter = 'all' | 'incomplete' | 'complete';

export default function TechnicalFilesPage() {
  usePageMeta();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [downloadingDoc, setDownloadingDoc] = useState<Record<string, boolean>>({});

  async function handleDownload(productId: string, productName: string) {
    setDownloading(prev => ({ ...prev, [productId]: true }));
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`/api/due-diligence/${productId}/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = productName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `due-diligence-${safeName}-${dateStr}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download compliance package. Please try again.');
    } finally {
      setDownloading(prev => ({ ...prev, [productId]: false }));
    }
  }

  async function handleDownloadDoc(productId: string, productName: string) {
    setDownloadingDoc(prev => ({ ...prev, [productId]: true }));
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`/api/technical-file/${productId}/declaration-of-conformity/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = productName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `eu-declaration-of-conformity-${safeName}-${dateStr}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to generate EU Declaration of Conformity. Please try again.');
    } finally {
      setDownloadingDoc(prev => ({ ...prev, [productId]: false }));
    }
  }

  useEffect(() => {
    async function fetchOverview() {
      try {
        const res = await fetch('/api/technical-files/overview', {
          headers: { Authorization: `Bearer ${localStorage.getItem('session_token')}` },
        });
        if (res.ok) setData(await res.json());
      } catch (err) {
        console.error('Failed to fetch technical files overview:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchOverview();
  }, []);

  if (loading) {
    return (
      <>
        <PageHeader title="Technical Files" timestamp="CRA Annex VII" />
        <p className="tfo-empty">Loading technical files...</p>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader title="Technical Files" timestamp="CRA Annex VII" />
        <p className="tfo-empty">Unable to load technical files. Please try refreshing.</p>
      </>
    );
  }

  const { products, totals } = data;
  const compliancePercent = totals.totalSections > 0
    ? Math.round((totals.completed / totals.totalSections) * 100)
    : 0;

  // Apply filter
  const filteredProducts = products.filter(p => {
    if (filter === 'complete') return p.progress.completed === p.progress.total;
    if (filter === 'incomplete') return p.progress.completed < p.progress.total;
    return true;
  });

  return (
    <>
      <PageHeader title="Technical Files" timestamp="CRA Annex VII" />

      <div className="stats">
        <StatCard label="Total Sections" value={totals.totalSections} color="blue" sub={`across ${products.length} product${products.length !== 1 ? 's' : ''}`} />
        <StatCard label="Completed" value={totals.completed} color="green" sub={`${compliancePercent}% compliant`} />
        <StatCard label="In Progress" value={totals.inProgress} color="amber" />
        <StatCard label="Not Started" value={totals.notStarted} color="red" />
      </div>

      <div className="tfo-filter-bar">
        <button className={`tfo-filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
        <button className={`tfo-filter-btn ${filter === 'incomplete' ? 'active' : ''}`} onClick={() => setFilter('incomplete')}>Has Incomplete</button>
        <button className={`tfo-filter-btn ${filter === 'complete' ? 'active' : ''}`} onClick={() => setFilter('complete')}>Complete</button>
      </div>

      {products.length === 0 ? (
        <p className="tfo-empty">No products yet. <Link to="/products">Add your first product</Link> to begin technical file documentation.</p>
      ) : filteredProducts.length === 0 ? (
        <p className="tfo-empty">No products match the current filter.</p>
      ) : (
        filteredProducts.map(product => {
          const cat = formatCategory(product.craCategory);
          const progressPercent = product.progress.total > 0
            ? Math.round((product.progress.completed / product.progress.total) * 100)
            : 0;
          const progressColor = progressPercent === 0 ? 'red' : progressPercent >= 100 ? 'green' : 'amber';

          return (
            <div key={product.id} className="tfo-product-card">
              <div className="tfo-card-header">
                <Link to={`/products/${product.id}?tab=technical-file`} className="tfo-product-name">{product.name}</Link>
                <span className={`tfo-cat-badge ${cat.color}`}>{cat.label}</span>
                <div className="tfo-progress-area">
                  <div className="tfo-progress-bar">
                    <div className={`tfo-progress-fill ${progressColor}`} style={{ width: `${Math.max(progressPercent, 2)}%` }} />
                  </div>
                  <span className="tfo-progress-text">{product.progress.completed}/{product.progress.total}</span>
                </div>
                <button
                  className="tfo-download-btn"
                  onClick={() => handleDownload(product.id, product.name)}
                  disabled={downloading[product.id]}
                  title="Download compliance package (ZIP)"
                >
                  {downloading[product.id]
                    ? <Loader2 size={14} className="spin" />
                    : <Download size={14} />}
                  {downloading[product.id] ? 'Generating…' : 'Download'}
                </button>
                <button
                  className="tfo-doc-btn"
                  onClick={() => handleDownloadDoc(product.id, product.name)}
                  disabled={downloadingDoc[product.id]}
                  title="Download EU Declaration of Conformity (PDF)"
                >
                  {downloadingDoc[product.id]
                    ? <Loader2 size={14} className="spin" />
                    : <FileText size={14} />}
                  {downloadingDoc[product.id] ? 'Generating…' : 'EU DoC'}
                </button>
              </div>
              <div className="tfo-sections">
                {product.sections.map(section => (
                  <Link
                    key={section.sectionKey}
                    to={`/products/${product.id}?tab=technical-file`}
                    className="tfo-section-row"
                  >
                    <div className={`tfo-section-dot ${section.status}`} />
                    <span className="tfo-section-title">{section.title}</span>
                    <span className="tfo-section-ref">{section.craReference}</span>
                    <span className="tfo-section-status">{formatStatus(section.status)}</span>
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

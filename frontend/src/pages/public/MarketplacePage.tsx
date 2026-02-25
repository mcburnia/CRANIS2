import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, MapPin, Filter, ShieldCheck, Package, Scale,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import './MarketplacePage.css';

interface ComplianceBadges {
  craStatus: 'not_started' | 'in_progress' | 'compliant';
  obligationsMetPct: number;
  techFilePct: number;
  productsCount: number;
  lastVulnScan: string | null;
  openVulnerabilities: number;
  licensePct: number;
}

interface Listing {
  orgId: string;
  orgName: string;
  country: string;
  industry: string;
  craRole: string;
  tagline: string;
  categories: string[];
  complianceBadges: ComplianceBadges;
  products: { id: string; name: string; description: string; productType: string; craCategory: string }[];
  productCount: number;
}

interface Category {
  value: string;
  label: string;
}

const LIMIT = 12;

function formatScanDate(dateStr: string | null): string {
  if (!dateStr) return 'No scan';
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function craStatusLabel(status: ComplianceBadges['craStatus']): string {
  switch (status) {
    case 'compliant': return 'Compliant';
    case 'in_progress': return 'In Progress';
    case 'not_started': return 'Not Started';
  }
}

function craStatusColor(status: ComplianceBadges['craStatus']): string {
  switch (status) {
    case 'compliant': return 'green';
    case 'in_progress': return 'amber';
    case 'not_started': return 'muted';
  }
}

export default function MarketplacePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debouncedCountry, setDebouncedCountry] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCountry(country), 400);
    return () => clearTimeout(t);
  }, [country]);

  useEffect(() => { setPage(1); }, [debouncedSearch, debouncedCountry, category]);

  useEffect(() => {
    fetch('/api/marketplace/categories')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setCategories(data.categories || []))
      .catch(() => {});
  }, []);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (debouncedCountry) params.set('country', debouncedCountry);
      if (category) params.set('category', category);
      params.set('page', String(page));
      params.set('limit', String(LIMIT));

      const res = await fetch(`/api/marketplace/listings?${params}`);
      if (!res.ok) throw new Error('Failed to load listings');
      const data = await res.json();
      setListings(data.listings || []);
      setTotal(data.total || 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setListings([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, debouncedCountry, category, page]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="mp-page">
      <nav className="mp-nav">
        <div className="mp-nav-inner">
          <div className="mp-nav-left">
            <Link to="/" className="mp-logo"><span>CRANIS</span><span className="mp-logo-2">2</span></Link>
            <span className="mp-nav-divider" />
            <span className="mp-nav-title">Marketplace</span>
          </div>
          <div className="mp-nav-right">
            <Link to="/login" className="mp-nav-link">Log in</Link>
            <Link to="/signup" className="mp-nav-link mp-nav-link--primary">Sign up</Link>
          </div>
        </div>
      </nav>

      <section className="mp-hero">
        <h1 className="mp-hero-title">Compliance Marketplace</h1>
        <p className="mp-hero-subtitle">
          Find EU-compliant software suppliers. Browse organisations with verified CRA and NIS2
          compliance postures, vulnerability scanning, and licence transparency.
        </p>
      </section>

      <section className="mp-filters">
        <div className="mp-filters-inner">
          <div className="mp-search-wrap">
            <Search size={18} className="mp-search-icon" />
            <input type="text" className="mp-search-input" placeholder="Search companies..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="mp-filter-wrap">
            <MapPin size={16} className="mp-filter-icon" />
            <input type="text" className="mp-filter-input" placeholder="Country" value={country} onChange={e => setCountry(e.target.value)} />
          </div>
          <div className="mp-filter-wrap">
            <Filter size={16} className="mp-filter-icon" />
            <select className="mp-filter-select" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>
      </section>

      <main className="mp-main">
        {loading && (
          <div className="mp-state">
            <div className="mp-spinner" />
            <p className="mp-state-text">Loading listings...</p>
          </div>
        )}

        {!loading && error && (
          <div className="mp-state">
            <p className="mp-state-text mp-state-error">{error}</p>
            <button className="mp-retry-btn" onClick={fetchListings}>Retry</button>
          </div>
        )}

        {!loading && !error && listings.length === 0 && (
          <div className="mp-state">
            <Package size={48} strokeWidth={1.2} className="mp-state-icon" />
            <p className="mp-state-text">No companies listed yet</p>
            <p className="mp-state-sub">Check back soon or adjust your search filters.</p>
          </div>
        )}

        {!loading && !error && listings.length > 0 && (
          <>
            <p className="mp-results-count">{total} {total === 1 ? 'company' : 'companies'} found</p>
            <div className="mp-grid">
              {listings.map(item => (
                <Link key={item.orgId} to={`/marketplace/${item.orgId}`} className="mp-card">
                  <div className="mp-card-header">
                    <h3 className="mp-card-name">{item.orgName}</h3>
                    {item.country && <span className="mp-card-country"><MapPin size={12} />{item.country}</span>}
                  </div>
                  {item.tagline && <p className="mp-card-tagline">{item.tagline}</p>}
                  {item.categories.length > 0 && (
                    <div className="mp-card-categories">
                      {item.categories.map(cat => <span key={cat} className="mp-card-cat">{cat}</span>)}
                    </div>
                  )}
                  <div className="mp-card-badges">
                    <span className={`mp-badge mp-badge-${craStatusColor(item.complianceBadges.craStatus)}`}>
                      <ShieldCheck size={14} />{craStatusLabel(item.complianceBadges.craStatus)}
                    </span>
                    <span className="mp-badge mp-badge-muted">
                      <Package size={14} />{item.complianceBadges.productsCount} {item.complianceBadges.productsCount === 1 ? 'product' : 'products'}
                    </span>
                    <span className="mp-badge mp-badge-muted">
                      <Scale size={14} />{item.complianceBadges.licensePct}% permissive
                    </span>
                    <span className="mp-badge mp-badge-muted">
                      {formatScanDate(item.complianceBadges.lastVulnScan)}
                    </span>
                  </div>
                  {item.products.length > 0 && (
                    <div className="mp-card-products">
                      {item.products.slice(0, 3).map(p => <span key={p.id} className="mp-card-product">{p.name}</span>)}
                      {item.products.length > 3 && <span className="mp-card-product mp-card-product--more">+{item.products.length - 3} more</span>}
                    </div>
                  )}
                </Link>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mp-pagination">
                <button className="mp-page-btn" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  <ChevronLeft size={16} />Previous
                </button>
                <span className="mp-page-info">Page {page} of {totalPages}</span>
                <button className="mp-page-btn" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                  Next<ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

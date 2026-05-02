/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, MapPin, Filter, ShieldCheck, Package, Scale,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { usePageMeta } from '../../hooks/usePageMeta';
import './TrustCentrePage.css';

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

export default function TrustCentrePage() {
  usePageMeta();
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
    fetch('/api/trust-centre/categories')
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

      const res = await fetch(`/api/trust-centre/listings?${params}`);
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
    <div className="tc-page">
      <nav className="tc-nav">
        <div className="tc-nav-inner">
          <div className="tc-nav-left">
            <Link to="/" className="tc-logo"><span>CRANIS</span><span className="tc-logo-2">2</span></Link>
            <span className="tc-nav-divider" />
            <span className="tc-nav-title">Trust Centre</span>
          </div>
          <div className="tc-nav-right">
            <Link to="/login" className="tc-nav-link">Log in</Link>
            <Link to="/signup" className="tc-nav-link tc-nav-link--primary">Sign up</Link>
          </div>
        </div>
      </nav>

      <section className="tc-hero">
        <h1 className="tc-hero-title">Trust Centre</h1>
        <p className="tc-hero-subtitle">
          Find EU-compliant software suppliers. Browse organisations with verified CRA and NIS2
          compliance postures, vulnerability scanning, and licence transparency.
        </p>
      </section>

      <section className="tc-filters">
        <div className="tc-filters-inner">
          <div className="tc-search-wrap">
            <Search size={18} className="tc-search-icon" />
            <input type="text" className="tc-search-input" placeholder="Search companies..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="tc-filter-wrap">
            <MapPin size={16} className="tc-filter-icon" />
            <input type="text" className="tc-filter-input" placeholder="Country" value={country} onChange={e => setCountry(e.target.value)} />
          </div>
          <div className="tc-filter-wrap">
            <Filter size={16} className="tc-filter-icon" />
            <select className="tc-filter-select" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>
      </section>

      <main className="tc-main">
        {loading && (
          <div className="tc-state">
            <div className="tc-spinner" />
            <p className="tc-state-text">Loading listings...</p>
          </div>
        )}

        {!loading && error && (
          <div className="tc-state">
            <p className="tc-state-text tc-state-error">{error}</p>
            <button className="tc-retry-btn" onClick={fetchListings}>Retry</button>
          </div>
        )}

        {!loading && !error && listings.length === 0 && (
          <div className="tc-state">
            <Package size={48} strokeWidth={1.2} className="tc-state-icon" />
            <p className="tc-state-text">No companies listed yet</p>
            <p className="tc-state-sub">Check back soon or adjust your search filters.</p>
          </div>
        )}

        {!loading && !error && listings.length > 0 && (
          <>
            <p className="tc-results-count">{total} {total === 1 ? 'company' : 'companies'} found</p>
            <div className="tc-list">
              {listings.map(item => (
                <Link key={item.orgId} to={`/trust-centre/${item.orgId}`} className="tc-card">
                  <div className="tc-card-info">
                    <div className="tc-card-header">
                      <h3 className="tc-card-name">{item.orgName}</h3>
                      {item.country && <span className="tc-card-country"><MapPin size={12} />{item.country}</span>}
                    </div>
                    {item.tagline && <p className="tc-card-tagline">{item.tagline}</p>}
                    <div className="tc-card-meta">
                      {item.categories.length > 0 && (
                        <div className="tc-card-categories">
                          {item.categories.map(cat => <span key={cat} className="tc-card-cat">{cat}</span>)}
                        </div>
                      )}
                      {item.products.length > 0 && (
                        <div className="tc-card-products">
                          {item.products.slice(0, 3).map(p => <span key={p.id} className="tc-card-product">{p.name}</span>)}
                          {item.products.length > 3 && <span className="tc-card-product tc-card-product--more">+{item.products.length - 3} more</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="tc-card-compliance">
                    <span className={`tc-badge tc-badge-${craStatusColor(item.complianceBadges.craStatus)}`}>
                      <ShieldCheck size={14} />{craStatusLabel(item.complianceBadges.craStatus)}
                    </span>
                    <span className="tc-badge tc-badge-muted">
                      <Package size={14} />{item.complianceBadges.productsCount} {item.complianceBadges.productsCount === 1 ? 'product' : 'products'}
                    </span>
                    <span className="tc-badge tc-badge-muted">
                      <Scale size={14} />{item.complianceBadges.licensePct}% permissive
                    </span>
                    <span className="tc-badge tc-badge-muted">
                      {formatScanDate(item.complianceBadges.lastVulnScan)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="tc-pagination">
                <button className="tc-page-btn" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  <ChevronLeft size={16} />Previous
                </button>
                <span className="tc-page-info">Page {page} of {totalPages}</span>
                <button className="tc-page-btn" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
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

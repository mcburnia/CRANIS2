/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Globe, Building2, Shield, Package, Scale,
  AlertTriangle, Send, X, CheckCircle2,
} from 'lucide-react';
import { usePageMeta } from '../../hooks/usePageMeta';
import './TrustCentreDetailPage.css';

interface Listing {
  orgId: string;
  orgName: string;
  country: string;
  industry: string;
  craRole: string;
  companySize: string;
  website: string;
  tagline: string;
  description: string;
  logoUrl: string;
  categories: string[];
  complianceBadges: {
    craStatus: 'not_started' | 'in_progress' | 'compliant';
    obligationsMetPct: number;
    techFilePct: number;
    productsCount: number;
    lastVulnScan: string | null;
    openVulnerabilities: number;
    licensePct: number;
  };
  products: { id: string; name: string; description: string; productType: string; craCategory: string }[];
  allProductCount: number;
  contactRequestsCount: number;
}

function formatDate(d: string | null): string {
  if (!d) return 'No scan';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function craStatusLabel(s: string): string {
  switch (s) { case 'compliant': return 'Compliant'; case 'in_progress': return 'In Progress'; default: return 'Not Started'; }
}

function craStatusColor(s: string): string {
  switch (s) { case 'compliant': return 'green'; case 'in_progress': return 'amber'; default: return 'muted'; }
}

export default function TrustCentreDetailPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  usePageMeta(listing ? { title: listing.orgName, description: `${listing.orgName} on the CRANIS2 Trust Centre.` } : undefined);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; text: string } | null>(null);

  const token = localStorage.getItem('session_token');
  const isLoggedIn = !!token;

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    fetch(`/api/trust-centre/listings/${orgId}`)
      .then(res => {
        if (res.status === 404) { setNotFound(true); return null; }
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => { if (data) setListing(data); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [orgId]);

  async function handleSend() {
    if (!token || message.length < 10 || message.length > 1000) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch(`/api/trust-centre/contact/${orgId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (res.status === 429) { setSendResult({ ok: false, text: 'You have already contacted this company recently. Please try again later.' }); return; }
      if (!res.ok) { const err = await res.json().catch(() => ({})); setSendResult({ ok: false, text: (err as any).error || 'Failed to send' }); return; }
      setSendResult({ ok: true, text: 'Introduction sent successfully!' });
      setMessage('');
    } catch { setSendResult({ ok: false, text: 'Network error. Please try again.' }); }
    finally { setSending(false); }
  }

  const navBar = (
    <nav className="td-nav">
      <div className="td-nav-inner">
        <Link to="/trust-centre" className="td-logo"><span>CRANIS</span><span className="td-logo-2">2</span></Link>
        <div className="td-nav-right">
          {isLoggedIn
            ? <Link to="/dashboard" className="td-nav-link">Dashboard</Link>
            : <><Link to="/login" className="td-nav-link">Log in</Link><Link to="/signup" className="td-nav-link td-nav-link--primary">Sign up</Link></>
          }
        </div>
      </div>
    </nav>
  );

  if (loading) return <div className="td-page">{navBar}<div className="td-container"><p className="td-loading-text">Loading company profile...</p></div></div>;
  if (notFound || !listing) return (
    <div className="td-page">{navBar}
      <div className="td-container">
        <Link to="/trust-centre" className="td-back"><ArrowLeft size={16} /> Back to Trust Centre</Link>
        <div className="td-not-found"><Building2 size={48} /><h2>Company not found</h2><p>This company profile does not exist or is no longer listed.</p><Link to="/trust-centre" className="td-back-btn">Browse Trust Centre</Link></div>
      </div>
    </div>
  );

  const b = listing.complianceBadges;
  return (
    <div className="td-page">
      {navBar}
      <div className="td-container">
        <Link to="/trust-centre" className="td-back"><ArrowLeft size={16} /> Back to Trust Centre</Link>

        <div className="td-header">
          <div className="td-header-icon"><Building2 size={28} /></div>
          <div>
            <h1 className="td-company-name">{listing.orgName}</h1>
            <div className="td-header-meta">
              {listing.country && <span className="td-meta-tag">{listing.country}</span>}
              {listing.industry && <span className="td-meta-tag">{listing.industry}</span>}
              {listing.craRole && <span className="td-meta-tag"><Shield size={12} /> {listing.craRole}</span>}
              {listing.website && (
                <a href={listing.website.startsWith('http') ? listing.website : `https://${listing.website}`} target="_blank" rel="noopener noreferrer" className="td-website-link">
                  <Globe size={14} /> {listing.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="td-layout">
          <div className="td-main">
            {listing.description && (
              <div className="td-card">
                <h2 className="td-section-title">About</h2>
                <p className="td-description">{listing.description}</p>
              </div>
            )}
            <div className="td-card">
              <div className="td-products-header">
                <h2 className="td-section-title"><Package size={18} /> Products</h2>
                <span className="td-product-count">{listing.allProductCount} total</span>
              </div>
              {listing.products.length === 0
                ? <p className="td-empty-text">No products listed publicly.</p>
                : <div className="td-products-grid">{listing.products.map(p => (
                    <div key={p.id} className="td-product-card">
                      <div className="td-product-name">{p.name}</div>
                      {p.description && <div className="td-product-desc">{p.description}</div>}
                      <div className="td-product-meta">
                        {p.productType && <span className="td-product-tag">{p.productType}</span>}
                        {p.craCategory && <span className="td-product-tag">{p.craCategory}</span>}
                      </div>
                    </div>
                  ))}</div>
              }
            </div>
          </div>

          <div className="td-sidebar">
            <div className="td-card td-contact-card">
              <h3 className="td-card-title">Contact</h3>
              {isLoggedIn
                ? <button className="td-contact-btn" onClick={() => { setShowContactModal(true); setSendResult(null); }}><Send size={16} /> Send Introduction</button>
                : <div className="td-contact-login"><p><Link to="/login" className="td-login-link">Log in</Link> to send an introduction</p></div>
              }
            </div>

            <div className="td-card">
              <h3 className="td-card-title"><Shield size={16} /> Compliance</h3>
              <div className="td-compliance-rows">
                <div className="td-compliance-row"><span className="td-compliance-label">CRA Status</span><span className={`td-badge td-badge-${craStatusColor(b.craStatus)}`}>{craStatusLabel(b.craStatus)}</span></div>
                <div className="td-compliance-row"><span className="td-compliance-label">Obligations</span><span className="td-compliance-value">{b.obligationsMetPct}% met</span></div>
                <div className="td-progress"><div className="td-progress-fill td-progress-green" style={{ width: `${b.obligationsMetPct}%` }} /></div>
                <div className="td-compliance-row"><span className="td-compliance-label">Technical File</span><span className="td-compliance-value">{b.techFilePct}% complete</span></div>
                <div className="td-progress"><div className="td-progress-fill td-progress-accent" style={{ width: `${b.techFilePct}%` }} /></div>
                <div className="td-compliance-row"><span className="td-compliance-label"><Scale size={13} /> Licences</span><span className="td-compliance-value">{b.licensePct}% permissive</span></div>
                <div className="td-progress"><div className="td-progress-fill td-progress-green" style={{ width: `${b.licensePct}%` }} /></div>
                <div className="td-compliance-row"><span className="td-compliance-label"><AlertTriangle size={13} /> Open Vulnerabilities</span><span className={`td-compliance-value ${b.openVulnerabilities > 0 ? 'td-text-red' : ''}`}>{b.openVulnerabilities}</span></div>
                <div className="td-compliance-row"><span className="td-compliance-label">Last Scan</span><span className="td-compliance-value td-text-muted">{formatDate(b.lastVulnScan)}</span></div>
              </div>
            </div>

            <div className="td-card">
              <h3 className="td-card-title"><Building2 size={16} /> Company Info</h3>
              <div className="td-info-rows">
                <div className="td-info-row"><span className="td-info-label">Name</span><span className="td-info-value">{listing.orgName}</span></div>
                {listing.country && <div className="td-info-row"><span className="td-info-label">Country</span><span className="td-info-value">{listing.country}</span></div>}
                {listing.industry && <div className="td-info-row"><span className="td-info-label">Industry</span><span className="td-info-value">{listing.industry}</span></div>}
                {listing.craRole && <div className="td-info-row"><span className="td-info-label">CRA Role</span><span className="td-info-value">{listing.craRole}</span></div>}
                <div className="td-info-row"><span className="td-info-label">Products</span><span className="td-info-value">{listing.allProductCount}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showContactModal && (
        <div className="td-modal-overlay" onClick={() => setShowContactModal(false)}>
          <div className="td-modal" onClick={e => e.stopPropagation()}>
            <div className="td-modal-header">
              <h3>Send Introduction to {listing.orgName}</h3>
              <button className="td-modal-close" onClick={() => setShowContactModal(false)}><X size={18} /></button>
            </div>
            {sendResult?.ok ? (
              <div className="td-send-success">
                <CheckCircle2 size={32} />
                <p>{sendResult.text}</p>
                <button className="td-btn-secondary" onClick={() => setShowContactModal(false)}>Close</button>
              </div>
            ) : (
              <>
                <div className="td-form-group">
                  <label>Your message</label>
                  <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Introduce yourself and explain why you'd like to connect..." rows={6} maxLength={1000} />
                  <div className="td-char-count"><span className={message.length < 10 ? 'td-text-red' : ''}>{message.length}</span> / 1000</div>
                </div>
                {sendResult && !sendResult.ok && <div className="td-send-error">{sendResult.text}</div>}
                <div className="td-modal-actions">
                  <button className="td-btn-secondary" onClick={() => setShowContactModal(false)}>Cancel</button>
                  <button className="td-btn-primary" onClick={handleSend} disabled={sending || message.length < 10 || message.length > 1000}>
                    <Send size={14} />{sending ? 'Sending...' : 'Send Introduction'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Globe, Building2, Shield, Package, Scale,
  AlertTriangle, Send, X, CheckCircle2,
} from 'lucide-react';
import './MarketplaceDetailPage.css';

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

export default function MarketplaceDetailPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
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
    fetch(`/api/marketplace/listings/${orgId}`)
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
      const res = await fetch(`/api/marketplace/contact/${orgId}`, {
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
    <nav className="md-nav">
      <div className="md-nav-inner">
        <Link to="/marketplace" className="md-logo"><span>CRANIS</span><span className="md-logo-2">2</span></Link>
        <div className="md-nav-right">
          {isLoggedIn
            ? <Link to="/dashboard" className="md-nav-link">Dashboard</Link>
            : <><Link to="/login" className="md-nav-link">Log in</Link><Link to="/signup" className="md-nav-link md-nav-link--primary">Sign up</Link></>
          }
        </div>
      </div>
    </nav>
  );

  if (loading) return <div className="md-page">{navBar}<div className="md-container"><p className="md-loading-text">Loading company profile...</p></div></div>;
  if (notFound || !listing) return (
    <div className="md-page">{navBar}
      <div className="md-container">
        <Link to="/marketplace" className="md-back"><ArrowLeft size={16} /> Back to Marketplace</Link>
        <div className="md-not-found"><Building2 size={48} /><h2>Company not found</h2><p>This company profile does not exist or is no longer listed.</p><Link to="/marketplace" className="md-back-btn">Browse Marketplace</Link></div>
      </div>
    </div>
  );

  const b = listing.complianceBadges;
  return (
    <div className="md-page">
      {navBar}
      <div className="md-container">
        <Link to="/marketplace" className="md-back"><ArrowLeft size={16} /> Back to Marketplace</Link>

        <div className="md-header">
          <div className="md-header-icon"><Building2 size={28} /></div>
          <div>
            <h1 className="md-company-name">{listing.orgName}</h1>
            <div className="md-header-meta">
              {listing.country && <span className="md-meta-tag">{listing.country}</span>}
              {listing.industry && <span className="md-meta-tag">{listing.industry}</span>}
              {listing.craRole && <span className="md-meta-tag"><Shield size={12} /> {listing.craRole}</span>}
              {listing.website && (
                <a href={listing.website.startsWith('http') ? listing.website : `https://${listing.website}`} target="_blank" rel="noopener noreferrer" className="md-website-link">
                  <Globe size={14} /> {listing.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="md-layout">
          <div className="md-main">
            {listing.description && (
              <div className="md-card">
                <h2 className="md-section-title">About</h2>
                <p className="md-description">{listing.description}</p>
              </div>
            )}
            <div className="md-card">
              <div className="md-products-header">
                <h2 className="md-section-title"><Package size={18} /> Products</h2>
                <span className="md-product-count">{listing.allProductCount} total</span>
              </div>
              {listing.products.length === 0
                ? <p className="md-empty-text">No products listed publicly.</p>
                : <div className="md-products-grid">{listing.products.map(p => (
                    <div key={p.id} className="md-product-card">
                      <div className="md-product-name">{p.name}</div>
                      {p.description && <div className="md-product-desc">{p.description}</div>}
                      <div className="md-product-meta">
                        {p.productType && <span className="md-product-tag">{p.productType}</span>}
                        {p.craCategory && <span className="md-product-tag">{p.craCategory}</span>}
                      </div>
                    </div>
                  ))}</div>
              }
            </div>
          </div>

          <div className="md-sidebar">
            <div className="md-card md-contact-card">
              <h3 className="md-card-title">Contact</h3>
              {isLoggedIn
                ? <button className="md-contact-btn" onClick={() => { setShowContactModal(true); setSendResult(null); }}><Send size={16} /> Send Introduction</button>
                : <div className="md-contact-login"><p><Link to="/login" className="md-login-link">Log in</Link> to send an introduction</p></div>
              }
            </div>

            <div className="md-card">
              <h3 className="md-card-title"><Shield size={16} /> Compliance</h3>
              <div className="md-compliance-rows">
                <div className="md-compliance-row"><span className="md-compliance-label">CRA Status</span><span className={`md-badge md-badge-${craStatusColor(b.craStatus)}`}>{craStatusLabel(b.craStatus)}</span></div>
                <div className="md-compliance-row"><span className="md-compliance-label">Obligations</span><span className="md-compliance-value">{b.obligationsMetPct}% met</span></div>
                <div className="md-progress"><div className="md-progress-fill md-progress-green" style={{ width: `${b.obligationsMetPct}%` }} /></div>
                <div className="md-compliance-row"><span className="md-compliance-label">Technical File</span><span className="md-compliance-value">{b.techFilePct}% complete</span></div>
                <div className="md-progress"><div className="md-progress-fill md-progress-accent" style={{ width: `${b.techFilePct}%` }} /></div>
                <div className="md-compliance-row"><span className="md-compliance-label"><Scale size={13} /> Licences</span><span className="md-compliance-value">{b.licensePct}% permissive</span></div>
                <div className="md-progress"><div className="md-progress-fill md-progress-green" style={{ width: `${b.licensePct}%` }} /></div>
                <div className="md-compliance-row"><span className="md-compliance-label"><AlertTriangle size={13} /> Open Vulnerabilities</span><span className={`md-compliance-value ${b.openVulnerabilities > 0 ? 'md-text-red' : ''}`}>{b.openVulnerabilities}</span></div>
                <div className="md-compliance-row"><span className="md-compliance-label">Last Scan</span><span className="md-compliance-value md-text-muted">{formatDate(b.lastVulnScan)}</span></div>
              </div>
            </div>

            <div className="md-card">
              <h3 className="md-card-title"><Building2 size={16} /> Company Info</h3>
              <div className="md-info-rows">
                <div className="md-info-row"><span className="md-info-label">Name</span><span className="md-info-value">{listing.orgName}</span></div>
                {listing.country && <div className="md-info-row"><span className="md-info-label">Country</span><span className="md-info-value">{listing.country}</span></div>}
                {listing.industry && <div className="md-info-row"><span className="md-info-label">Industry</span><span className="md-info-value">{listing.industry}</span></div>}
                {listing.craRole && <div className="md-info-row"><span className="md-info-label">CRA Role</span><span className="md-info-value">{listing.craRole}</span></div>}
                <div className="md-info-row"><span className="md-info-label">Products</span><span className="md-info-value">{listing.allProductCount}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showContactModal && (
        <div className="md-modal-overlay" onClick={() => setShowContactModal(false)}>
          <div className="md-modal" onClick={e => e.stopPropagation()}>
            <div className="md-modal-header">
              <h3>Send Introduction to {listing.orgName}</h3>
              <button className="md-modal-close" onClick={() => setShowContactModal(false)}><X size={18} /></button>
            </div>
            {sendResult?.ok ? (
              <div className="md-send-success">
                <CheckCircle2 size={32} />
                <p>{sendResult.text}</p>
                <button className="md-btn-secondary" onClick={() => setShowContactModal(false)}>Close</button>
              </div>
            ) : (
              <>
                <div className="md-form-group">
                  <label>Your message</label>
                  <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Introduce yourself and explain why you'd like to connect..." rows={6} maxLength={1000} />
                  <div className="md-char-count"><span className={message.length < 10 ? 'md-text-red' : ''}>{message.length}</span> / 1000</div>
                </div>
                {sendResult && !sendResult.ok && <div className="md-send-error">{sendResult.text}</div>}
                <div className="md-modal-actions">
                  <button className="md-btn-secondary" onClick={() => setShowContactModal(false)}>Cancel</button>
                  <button className="md-btn-primary" onClick={handleSend} disabled={sending || message.length < 10 || message.length > 1000}>
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

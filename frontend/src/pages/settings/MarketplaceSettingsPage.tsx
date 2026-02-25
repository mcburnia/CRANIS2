import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import {
  Store, ExternalLink, Save, Eye, ShieldCheck, Package, Loader2
} from 'lucide-react';
import './MarketplaceSettingsPage.css';

interface Category { value: string; label: string; }
interface Product { id: string; name: string; productType: string; }

interface ComplianceBadges {
  craStatus: 'not_started' | 'in_progress' | 'compliant';
  obligationsMetPct: number;
  techFilePct: number;
  productsCount: number;
  lastVulnScan: string | null;
  openVulnerabilities: number;
  licensePct: number;
}

interface ProfileData {
  listed: boolean;
  tagline: string;
  description: string;
  logoUrl: string;
  categories: string[];
  featuredProductIds: string[];
  complianceBadges: ComplianceBadges;
  listingApproved: boolean;
  contactRequestsCount: number;
  products: Product[];
}

function craStatusLabel(s: string) {
  switch (s) { case 'compliant': return 'Compliant'; case 'in_progress': return 'In Progress'; default: return 'Not Started'; }
}

function badgeColor(s: string) {
  switch (s) { case 'compliant': return 'green'; case 'in_progress': return 'amber'; default: return 'muted'; }
}

export default function MarketplaceSettingsPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [orgId, setOrgId] = useState('');

  const [listed, setListed] = useState(false);
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [featuredProductIds, setFeaturedProductIds] = useState<string[]>([]);

  const token = localStorage.getItem('session_token');
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 3000); return () => clearTimeout(t); } }, [success]);

  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      const [profileRes, catRes, meRes] = await Promise.all([
        fetch('/api/marketplace/profile', { headers }),
        fetch('/api/marketplace/categories'),
        fetch('/api/auth/me', { headers }),
      ]);
      if (!profileRes.ok) throw new Error('Failed to load marketplace profile');
      const profileData: ProfileData = await profileRes.json();
      const catData = catRes.ok ? await catRes.json() : { categories: [] };
      const meData = meRes.ok ? await meRes.json() : {};

      setProfile(profileData);
      setCategories(catData.categories || []);
      setOrgId(meData.orgId || '');
      setListed(profileData.listed);
      setTagline(profileData.tagline || '');
      setDescription(profileData.description || '');
      setLogoUrl(profileData.logoUrl || '');
      setSelectedCategories(profileData.categories || []);
      setFeaturedProductIds(profileData.featuredProductIds || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/marketplace/profile', {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ listed, tagline, description, logoUrl, categories: selectedCategories, featuredProductIds }),
      });
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error((data as any).error || 'Failed to save'); }
      const data = await res.json();
      if (data.complianceBadges && profile) setProfile({ ...profile, complianceBadges: data.complianceBadges, listed });
      setSuccess('Marketplace settings saved');
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <><PageHeader title="Marketplace Settings" /><div className="ms-loading"><Loader2 size={24} className="ms-spin" /> Loading...</div></>;
  if (!profile) return <><PageHeader title="Marketplace Settings" /><div className="ms-error">{error || 'Failed to load.'}</div></>;

  const b = profile.complianceBadges;
  const badgeItems = [
    { label: 'CRA Status', value: craStatusLabel(b.craStatus), color: badgeColor(b.craStatus) },
    { label: 'Obligations Met', value: `${b.obligationsMetPct}%`, color: b.obligationsMetPct === 100 ? 'green' : b.obligationsMetPct > 0 ? 'amber' : 'muted' },
    { label: 'Technical File', value: `${b.techFilePct}%`, color: b.techFilePct === 100 ? 'green' : b.techFilePct > 0 ? 'amber' : 'muted' },
    { label: 'Products', value: b.productsCount, color: 'blue' },
    { label: 'Licence Compliance', value: `${b.licensePct}%`, color: b.licensePct >= 90 ? 'green' : b.licensePct > 0 ? 'amber' : 'muted' },
    { label: 'Open Vulnerabilities', value: b.openVulnerabilities, color: b.openVulnerabilities === 0 ? 'green' : 'red' },
    { label: 'Last Scan', value: b.lastVulnScan ? new Date(b.lastVulnScan).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'None', color: b.lastVulnScan ? 'blue' : 'muted' },
  ];

  return (
    <>
      <PageHeader title="Marketplace Settings" />
      <div className="ms-page">
        {success && <div className="ms-success">{success}</div>}
        {error && <div className="ms-error">{error}</div>}

        <div className="ms-section">
          <div className="ms-toggle-row">
            <div className="ms-toggle-info">
              <Store size={18} />
              <div>
                <span className="ms-toggle-label">Public Marketplace Listing</span>
                <span className="ms-toggle-desc">Make your organisation visible on the CRANIS2 marketplace</span>
              </div>
            </div>
            <label className="ms-toggle">
              <input type="checkbox" checked={listed} onChange={e => setListed(e.target.checked)} />
              <span className="ms-toggle-slider" />
            </label>
          </div>
          {!profile.listingApproved && listed && <div className="ms-info-banner">Your listing is pending approval.</div>}
        </div>

        {listed && (
          <div className="ms-form">
            <div className="ms-field">
              <label>Tagline</label>
              <input type="text" className="ms-input" placeholder="A short description of your organisation" maxLength={160} value={tagline} onChange={e => setTagline(e.target.value)} />
              <div className="ms-char-count"><span className={tagline.length > 150 ? 'ms-char-warn' : ''}>{tagline.length}</span>/160</div>
            </div>
            <div className="ms-field">
              <label>Description</label>
              <textarea className="ms-textarea" placeholder="Describe your organisation, products, and compliance approach" maxLength={2000} rows={6} value={description} onChange={e => setDescription(e.target.value)} />
              <div className="ms-char-count"><span className={description.length > 1900 ? 'ms-char-warn' : ''}>{description.length}</span>/2000</div>
            </div>
            <div className="ms-field">
              <label>Logo URL</label>
              <input type="url" className="ms-input" placeholder="https://example.com/logo.png" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} />
            </div>
            {categories.length > 0 && (
              <div className="ms-field">
                <label>Categories</label>
                <div className="ms-checkbox-grid">
                  {categories.map(cat => (
                    <label key={cat.value} className="ms-checkbox">
                      <input type="checkbox" checked={selectedCategories.includes(cat.value)} onChange={() => setSelectedCategories(prev => prev.includes(cat.value) ? prev.filter(c => c !== cat.value) : [...prev, cat.value])} />
                      <span className="ms-checkbox-mark" />
                      <span>{cat.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {profile.products.length > 0 && (
              <div className="ms-field">
                <label><Package size={14} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />Featured Products</label>
                <div className="ms-checkbox-grid">
                  {profile.products.map(p => (
                    <label key={p.id} className="ms-checkbox">
                      <input type="checkbox" checked={featuredProductIds.includes(p.id)} onChange={() => setFeaturedProductIds(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])} />
                      <span className="ms-checkbox-mark" />
                      <span>{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {listed && profile.listingApproved && orgId && (
              <Link to={`/marketplace/${orgId}`} className="ms-preview-link" target="_blank"><Eye size={16} /> View your public listing <ExternalLink size={14} /></Link>
            )}
          </div>
        )}

        <div className="ms-section">
          <div className="ms-section-header"><ShieldCheck size={18} /><h3>Compliance Badges</h3></div>
          <p className="ms-section-desc">Auto-computed from your compliance data. Displayed on your marketplace listing.</p>
          <div className="ms-badges">
            {badgeItems.map(item => (
              <div key={item.label} className={`ms-badge-card ms-badge-${item.color}`}>
                <span className="ms-badge-value">{item.value}</span>
                <span className="ms-badge-label">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="ms-actions">
          <button className="ms-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={16} className="ms-spin" /> : <Save size={16} />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </>
  );
}

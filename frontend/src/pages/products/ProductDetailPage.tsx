import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';

import PageHeader from '../../components/PageHeader';
import {
  ArrowLeft, Package, Shield, FileText, AlertTriangle, GitBranch,
  Edit3, Save, X, Cpu, Cloud, BookOpen, Monitor, Smartphone, Radio, Box,
  CheckCircle2, Clock, ChevronRight, ExternalLink, Github, Star,
  GitFork, Eye, RefreshCw, Users, Unplug, Loader2
} from 'lucide-react';
import './ProductDetailPage.css';

interface Product {
  id: string;
  name: string;
  description: string;
  version: string;
  productType: string;
  craCategory: string;
  repoUrl: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface GitHubStatus {
  connected: boolean;
  githubUsername?: string;
  githubAvatarUrl?: string;
}

interface RepoData {
  name: string;
  fullName: string;
  description: string;
  url: string;
  language: string;
  stars: number;
  forks: number;
  openIssues: number;
  visibility: string;
  defaultBranch: string;
  lastPush: string;
  isPrivate: boolean;
  syncedAt?: string;
}

interface ContributorData {
  login: string;
  githubId: number;
  avatarUrl: string;
  profileUrl: string;
  contributions: number;
}

interface LanguageData {
  language: string;
  bytes: number;
  percentage: number;
}

interface GitHubData {
  synced: boolean;
  repo?: RepoData;
  contributors?: ContributorData[];
  languages?: LanguageData[];
}

const PRODUCT_TYPES = [
  { value: 'firmware', label: 'Firmware', icon: Cpu },
  { value: 'saas', label: 'SaaS / Web App', icon: Cloud },
  { value: 'library', label: 'Library / SDK', icon: BookOpen },
  { value: 'desktop_app', label: 'Desktop Application', icon: Monitor },
  { value: 'mobile_app', label: 'Mobile App', icon: Smartphone },
  { value: 'iot_device', label: 'IoT Device', icon: Radio },
  { value: 'embedded', label: 'Embedded System', icon: Cpu },
  { value: 'other', label: 'Other', icon: Box },
];

const TYPE_LABELS: Record<string, string> = Object.fromEntries(PRODUCT_TYPES.map(t => [t.value, t.label]));
const CATEGORY_INFO: Record<string, { label: string; color: string; desc: string }> = {
  default: { label: 'Default', color: 'var(--accent)', desc: 'Standard CRA obligations apply. Self-assessment is sufficient.' },
  class_i: { label: 'Class I (Important)', color: 'var(--amber)', desc: 'Important product with digital elements. Self-assessment possible under certain conditions.' },
  class_ii: { label: 'Class II (Critical)', color: 'var(--red)', desc: 'Critical product. Third-party conformity assessment required.' },
};

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572A5', Java: '#b07219',
  Go: '#00ADD8', Rust: '#dea584', Ruby: '#701516', 'C++': '#f34b7d', C: '#555555',
  'C#': '#178600', PHP: '#4F5D95', Swift: '#F05138', Kotlin: '#A97BFF', Dart: '#00B4AB',
  HTML: '#e34c26', CSS: '#563d7c', Shell: '#89e051', Dockerfile: '#384d54',
};

function getTypeIcon(type: string) {
  const found = PRODUCT_TYPES.find(t => t.value === type);
  return found?.icon || Box;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function timeAgo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

type TabKey = 'overview' | 'obligations' | 'technical-file' | 'risk-findings' | 'dependencies';

const TABS: { key: TabKey; label: string; icon: typeof Package }[] = [
  { key: 'overview', label: 'Overview', icon: Package },
  { key: 'obligations', label: 'Obligations', icon: Shield },
  { key: 'technical-file', label: 'Technical File', icon: FileText },
  { key: 'risk-findings', label: 'Risk Findings', icon: AlertTriangle },
  { key: 'dependencies', label: 'Dependencies', icon: GitBranch },
];

export default function ProductDetailPage() {
  const { productId } = useParams();
  const [searchParams] = useSearchParams();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', version: '', productType: '', craCategory: '', repoUrl: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // GitHub state
  const [ghStatus, setGhStatus] = useState<GitHubStatus>({ connected: false });
  const [ghData, setGhData] = useState<GitHubData>({ synced: false });
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    fetchProduct();
    fetchGitHubStatus();
  }, [productId]);

  // After product loads, fetch cached repo data
  useEffect(() => {
    if (product?.id) fetchCachedRepoData();
  }, [product?.id]);

  // Auto-sync if just connected via OAuth
  useEffect(() => {
    if (searchParams.get('github_connected') === 'true' && product?.repoUrl && ghStatus.connected) {
      handleSync();
    }
  }, [searchParams, product, ghStatus.connected]);

  async function fetchProduct() {
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`/api/products/${productId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProduct(data);
        setEditForm({
          name: data.name, description: data.description || '', version: data.version || '',
          productType: data.productType || 'other', craCategory: data.craCategory || 'default',
          repoUrl: data.repoUrl || '',
        });
      } else {
        setError('Product not found');
      }
    } catch {
      setError('Failed to load product');
    } finally {
      setLoading(false);
    }
  }

  async function fetchGitHubStatus() {
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch('/api/github/status', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setGhStatus(data);
      }
    } catch { /* silent */ }
  }

  async function fetchCachedRepoData() {
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`/api/github/repo/${productId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setGhData(data);
      }
    } catch { /* silent */ }
  }

  async function handleSync() {
    if (!product?.repoUrl) return;
    setSyncing(true);
    setSyncError('');
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`/api/github/sync/${productId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setGhData({ synced: true, repo: data.repo, contributors: data.contributors, languages: data.languages });
      } else {
        const err = await res.json();
        setSyncError(err.error || 'Sync failed');
      }
    } catch {
      setSyncError('Network error during sync');
    } finally {
      setSyncing(false);
    }
  }

  function handleConnectGitHub() {
    const token = localStorage.getItem('session_token');
    const returnTo = `/products/${productId}`;
    window.location.href = `/api/github/connect?token=${token}&returnTo=${encodeURIComponent(returnTo)}`;
  }

  async function handleDisconnectGitHub() {
    if (!confirm('Disconnect GitHub? You can reconnect at any time.')) return;
    const token = localStorage.getItem('session_token');
    await fetch('/api/github/disconnect', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setGhStatus({ connected: false });
    setGhData({ synced: false });
  }

  async function handleSave() {
    if (!editForm.name.trim()) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        const data = await res.json();
        setProduct(prev => prev ? { ...prev, ...data } : prev);
        setEditing(false);
      }
    } catch { /* silent */ } finally { setSaving(false); }
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Loading..." />
        <p style={{ color: 'var(--muted)' }}>Loading product details...</p>
      </>
    );
  }

  if (error || !product) {
    return (
      <>
        <PageHeader title="Product Not Found" />
        <div className="pd-error">
          <AlertTriangle size={48} strokeWidth={1} />
          <h3>{error || 'Product not found'}</h3>
          <Link to="/products" className="btn btn-primary">Back to Products</Link>
        </div>
      </>
    );
  }

  const TypeIcon = getTypeIcon(product.productType);
  const catInfo = CATEGORY_INFO[product.craCategory] || CATEGORY_INFO.default;

  return (
    <>
      {/* Back nav */}
      <Link to="/products" className="pd-back">
        <ArrowLeft size={16} /> All Products
      </Link>

      {/* Product header card */}
      <div className="pd-header-card">
        <div className="pd-header-top">
          <div className="pd-header-icon" style={{ color: catInfo.color }}>
            <TypeIcon size={28} />
          </div>
          <div className="pd-header-actions">
            {/* GitHub connection buttons */}
            {product.repoUrl && !ghStatus.connected && (
              <button className="pd-github-btn" onClick={handleConnectGitHub}>
                <Github size={14} /> Connect GitHub
              </button>
            )}
            {ghStatus.connected && product.repoUrl && (
              <button className="pd-sync-btn" onClick={handleSync} disabled={syncing}>
                {syncing ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                {syncing ? 'Syncing...' : 'Sync'}
              </button>
            )}
            {!editing ? (
              <button className="pd-edit-btn" onClick={() => setEditing(true)}>
                <Edit3 size={14} /> Edit
              </button>
            ) : (
              <>
                <button className="pd-cancel-btn" onClick={() => { setEditing(false); setEditForm({ name: product.name, description: product.description, version: product.version, productType: product.productType, craCategory: product.craCategory, repoUrl: product.repoUrl }); }}>
                  <X size={14} /> Cancel
                </button>
                <button className="btn btn-primary pd-save-btn" onClick={handleSave} disabled={saving || !editForm.name.trim()}>
                  <Save size={14} /> {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>

        {!editing ? (
          <>
            <h1 className="pd-product-name">{product.name}</h1>
            {product.description && <p className="pd-product-desc">{product.description}</p>}
            <div className="pd-meta-row">
              <span className="pd-type-badge">{TYPE_LABELS[product.productType] || product.productType}</span>
              <span className="pd-cra-badge" style={{ color: catInfo.color, borderColor: catInfo.color }}>
                <Shield size={12} /> {catInfo.label}
              </span>
              {product.version && <span className="pd-version">v{product.version}</span>}
              {product.repoUrl && (
                <a href={product.repoUrl} target="_blank" rel="noopener noreferrer" className="pd-repo-link" onClick={e => e.stopPropagation()}>
                  <GitBranch size={12} /> Repository <ExternalLink size={10} />
                </a>
              )}
              {ghStatus.connected && (
                <span className="pd-github-connected-badge">
                  <Github size={12} /> {ghStatus.githubUsername}
                </span>
              )}
              {ghData.synced && ghData.repo && (
                <>
                  <span className="pd-stat-badge"><Star size={11} /> {ghData.repo.stars}</span>
                  <span className="pd-stat-badge"><GitFork size={11} /> {ghData.repo.forks}</span>
                  {ghData.repo.language && <span className="pd-stat-badge">{ghData.repo.language}</span>}
                </>
              )}
              <span className="pd-date">Created {formatDate(product.createdAt)}</span>
            </div>
            {syncError && <div className="pd-sync-error">{syncError}</div>}
          </>
        ) : (
          <div className="pd-edit-form">
            <div className="form-group">
              <label className="form-label">Product Name</label>
              <input className="form-input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-input" rows={2} value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Repository URL</label>
              <input className="form-input" type="url" placeholder="e.g. https://github.com/your-org/your-repo" value={editForm.repoUrl} onChange={e => setEditForm({ ...editForm, repoUrl: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Version</label>
                <input className="form-input" value={editForm.version} onChange={e => setEditForm({ ...editForm, version: e.target.value })} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Product Type</label>
                <select className="form-input" value={editForm.productType} onChange={e => setEditForm({ ...editForm, productType: e.target.value })}>
                  {PRODUCT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">CRA Category</label>
                <select className="form-input" value={editForm.craCategory} onChange={e => setEditForm({ ...editForm, craCategory: e.target.value })}>
                  <option value="default">Default</option>
                  <option value="class_i">Class I (Important)</option>
                  <option value="class_ii">Class II (Critical)</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="pd-tabs">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`pd-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <tab.icon size={16} />
            {tab.label}
            {tab.key === 'dependencies' && ghData.contributors && ghData.contributors.length > 0 && (
              <span className="pd-tab-count">{ghData.contributors.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pd-tab-content">
        {activeTab === 'overview' && <OverviewTab product={product} catInfo={catInfo} ghStatus={ghStatus} ghData={ghData} onConnect={handleConnectGitHub} onSync={handleSync} syncing={syncing} onDisconnect={handleDisconnectGitHub} />}
        {activeTab === 'obligations' && <ObligationsTab product={product} />}
        {activeTab === 'technical-file' && <TechnicalFileTab />}
        {activeTab === 'risk-findings' && <RiskFindingsTab />}
        {activeTab === 'dependencies' && <DependenciesTab ghStatus={ghStatus} ghData={ghData} onConnect={handleConnectGitHub} onSync={handleSync} syncing={syncing} />}
      </div>
    </>
  );
}

/* ── Overview Tab ─────────────────────────────────────── */
function OverviewTab({ product, catInfo, ghStatus, ghData, onConnect, onSync, syncing, onDisconnect }: {
  product: Product; catInfo: { label: string; color: string; desc: string };
  ghStatus: GitHubStatus; ghData: GitHubData;
  onConnect: () => void; onSync: () => void; syncing: boolean; onDisconnect: () => void;
}) {
  return (
    <div className="pd-overview-grid">
      {/* GitHub Repo Card — only if synced */}
      {ghData.synced && ghData.repo && (
        <div className="pd-card pd-card-github">
          <div className="pd-card-header">
            <Github size={18} />
            <h3>Repository</h3>
            <a href={ghData.repo.url} target="_blank" rel="noopener noreferrer" className="pd-card-external">
              <ExternalLink size={14} />
            </a>
          </div>
          <div className="gh-repo-name">{ghData.repo.fullName}</div>
          {ghData.repo.description && <div className="gh-repo-desc">{ghData.repo.description}</div>}
          <div className="gh-repo-stats">
            <span className="gh-stat"><Star size={14} /> {ghData.repo.stars}</span>
            <span className="gh-stat"><GitFork size={14} /> {ghData.repo.forks}</span>
            <span className="gh-stat"><AlertTriangle size={14} /> {ghData.repo.openIssues} issues</span>
            <span className={`gh-visibility ${ghData.repo.isPrivate ? 'private' : 'public'}`}>
              <Eye size={12} /> {ghData.repo.visibility}
            </span>
          </div>
          <div className="pd-class-details">
            {ghData.repo.language && (
              <div className="pd-detail-row">
                <span className="pd-detail-label">Primary Language</span>
                <span className="pd-detail-value">
                  <span className="gh-lang-dot" style={{ background: LANGUAGE_COLORS[ghData.repo.language] || '#8b8d98' }}></span>
                  {ghData.repo.language}
                </span>
              </div>
            )}
            <div className="pd-detail-row">
              <span className="pd-detail-label">Default Branch</span>
              <span className="pd-detail-value">{ghData.repo.defaultBranch}</span>
            </div>
            <div className="pd-detail-row">
              <span className="pd-detail-label">Last Push</span>
              <span className="pd-detail-value">{timeAgo(ghData.repo.lastPush)}</span>
            </div>
            {ghData.repo.syncedAt && (
              <div className="pd-detail-row">
                <span className="pd-detail-label">Last Synced</span>
                <span className="pd-detail-value">{formatDateTime(ghData.repo.syncedAt)}</span>
              </div>
            )}
          </div>
          {/* GitHub account info */}
          {ghStatus.connected && (
            <div className="gh-account-row">
              {ghStatus.githubAvatarUrl && <img src={ghStatus.githubAvatarUrl} alt="" className="gh-account-avatar" />}
              <span className="gh-account-name">Connected as {ghStatus.githubUsername}</span>
              <button className="gh-disconnect-btn" onClick={onDisconnect} title="Disconnect GitHub">
                <Unplug size={12} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* GitHub Connect Card — if not connected and has repoUrl */}
      {!ghStatus.connected && product.repoUrl && (
        <div className="pd-card pd-card-connect">
          <div className="pd-card-header">
            <Github size={18} />
            <h3>Connect GitHub</h3>
          </div>
          <p className="gh-connect-desc">Connect your GitHub account to sync repository data, discover contributors, and analyse dependencies.</p>
          <button className="btn btn-primary gh-connect-btn" onClick={onConnect}>
            <Github size={16} /> Connect GitHub
          </button>
          <p className="gh-connect-note">Read-only access — CRANIS2 will never write to your repositories.</p>
        </div>
      )}

      {/* GitHub Sync Prompt — if connected but not synced */}
      {ghStatus.connected && !ghData.synced && product.repoUrl && (
        <div className="pd-card pd-card-connect">
          <div className="pd-card-header">
            <Github size={18} />
            <h3>Sync Repository</h3>
          </div>
          <p className="gh-connect-desc">Your GitHub account is connected. Sync to pull repository metadata, contributors, and language data.</p>
          <button className="btn btn-primary gh-connect-btn" onClick={onSync} disabled={syncing}>
            {syncing ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      )}

      {/* CRA Classification Card */}
      <div className="pd-card">
        <div className="pd-card-header">
          <Shield size={18} />
          <h3>CRA Classification</h3>
        </div>
        <div className="pd-classification">
          <div className="pd-class-badge-large" style={{ color: catInfo.color, borderColor: catInfo.color }}>
            {catInfo.label}
          </div>
          <p className="pd-class-desc">{catInfo.desc}</p>
        </div>
        <div className="pd-class-details">
          <div className="pd-detail-row">
            <span className="pd-detail-label">Conformity Assessment</span>
            <span className="pd-detail-value">
              {product.craCategory === 'class_ii' ? 'Third-party required' :
               product.craCategory === 'class_i' ? 'Self-assessment possible' : 'Self-assessment'}
            </span>
          </div>
          <div className="pd-detail-row">
            <span className="pd-detail-label">Vulnerability Handling</span>
            <span className="pd-detail-value">Required (5 years post-market)</span>
          </div>
          <div className="pd-detail-row">
            <span className="pd-detail-label">SBOM Required</span>
            <span className="pd-detail-value">Yes</span>
          </div>
          <div className="pd-detail-row">
            <span className="pd-detail-label">Incident Reporting</span>
            <span className="pd-detail-value">Within 24 hours to ENISA</span>
          </div>
        </div>
      </div>

      {/* Compliance Progress Card */}
      <div className="pd-card">
        <div className="pd-card-header">
          <CheckCircle2 size={18} />
          <h3>Compliance Progress</h3>
        </div>
        <div className="pd-progress-list">
          <ProgressItem label="Essential Requirements" status="not_started" />
          <ProgressItem label="Vulnerability Handling" status="not_started" />
          <ProgressItem label="Technical Documentation" status="not_started" />
          <ProgressItem label="SBOM Generation" status={ghData.synced ? 'in_progress' : 'not_started'} />
          <ProgressItem label="Conformity Assessment" status="not_started" />
          <ProgressItem label="EU Declaration of Conformity" status="not_started" />
        </div>
      </div>

      {/* Product Details Card */}
      <div className="pd-card">
        <div className="pd-card-header">
          <Package size={18} />
          <h3>Product Details</h3>
        </div>
        <div className="pd-class-details">
          <div className="pd-detail-row">
            <span className="pd-detail-label">Product ID</span>
            <span className="pd-detail-value pd-mono">{product.id}</span>
          </div>
          <div className="pd-detail-row">
            <span className="pd-detail-label">Product Type</span>
            <span className="pd-detail-value">{TYPE_LABELS[product.productType] || product.productType}</span>
          </div>
          <div className="pd-detail-row">
            <span className="pd-detail-label">Version</span>
            <span className="pd-detail-value">{product.version || '—'}</span>
          </div>
          <div className="pd-detail-row">
            <span className="pd-detail-label">Repository</span>
            <span className="pd-detail-value">
              {product.repoUrl ? (
                <a href={product.repoUrl} target="_blank" rel="noopener noreferrer" className="pd-repo-detail-link">
                  {product.repoUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\.git$/, '')} <ExternalLink size={10} />
                </a>
              ) : '—'}
            </span>
          </div>
          <div className="pd-detail-row">
            <span className="pd-detail-label">Status</span>
            <span className="pd-detail-value">{product.status}</span>
          </div>
          <div className="pd-detail-row">
            <span className="pd-detail-label">Created</span>
            <span className="pd-detail-value">{formatDateTime(product.createdAt)}</span>
          </div>
          <div className="pd-detail-row">
            <span className="pd-detail-label">Last Updated</span>
            <span className="pd-detail-value">{formatDateTime(product.updatedAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressItem({ label, status }: { label: string; status: 'completed' | 'in_progress' | 'not_started' }) {
  const statusConfig = {
    completed: { icon: CheckCircle2, color: 'var(--green)', text: 'Complete' },
    in_progress: { icon: Clock, color: 'var(--amber)', text: 'In Progress' },
    not_started: { icon: Clock, color: 'var(--muted)', text: 'Not Started' },
  };
  const cfg = statusConfig[status];
  return (
    <div className="pd-progress-item">
      <cfg.icon size={16} style={{ color: cfg.color }} />
      <span className="pd-progress-label">{label}</span>
      <span className="pd-progress-status" style={{ color: cfg.color }}>{cfg.text}</span>
    </div>
  );
}

/* ── Obligations Tab ─────────────────────────────────────── */
function ObligationsTab({ product }: { product: Product }) {
  const obligations = getCRAObligations(product.craCategory);
  return (
    <div className="pd-obligations">
      <div className="pd-section-intro">
        <Shield size={20} />
        <div>
          <h3>CRA Obligations for {CATEGORY_INFO[product.craCategory]?.label || 'Default'} Products</h3>
          <p>These are the key regulatory obligations under the EU Cyber Resilience Act that apply to your product.</p>
        </div>
      </div>
      <div className="pd-obligations-list">
        {obligations.map((ob, i) => (
          <div key={i} className="pd-obligation-card">
            <div className="pd-obligation-header">
              <span className="pd-obligation-article">{ob.article}</span>
              <span className={`pd-obligation-status status-${ob.status}`}>
                {ob.status === 'not_started' ? 'Not Started' : ob.status === 'in_progress' ? 'In Progress' : 'Complete'}
              </span>
            </div>
            <h4>{ob.title}</h4>
            <p>{ob.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function getCRAObligations(category: string) {
  const base = [
    { article: 'Art. 13', title: 'Obligations of Manufacturers', description: 'Ensure products are designed and developed in accordance with essential cybersecurity requirements.', status: 'not_started' as const },
    { article: 'Art. 13(6)', title: 'Vulnerability Handling', description: 'Identify and document vulnerabilities, provide security updates for at least 5 years.', status: 'not_started' as const },
    { article: 'Art. 13(11)', title: 'SBOM (Software Bill of Materials)', description: 'Identify and document components contained in the product, including an SBOM in machine-readable format.', status: 'not_started' as const },
    { article: 'Art. 13(12)', title: 'Technical Documentation', description: 'Draw up technical documentation before placing the product on the market.', status: 'not_started' as const },
    { article: 'Art. 13(14)', title: 'Conformity Assessment', description: 'Carry out a conformity assessment of the product.', status: 'not_started' as const },
    { article: 'Art. 13(15)', title: 'EU Declaration of Conformity', description: 'Draw up the EU declaration of conformity and affix the CE marking.', status: 'not_started' as const },
    { article: 'Art. 14', title: 'Vulnerability Reporting', description: 'Report actively exploited vulnerabilities and severe incidents to ENISA within 24 hours.', status: 'not_started' as const },
    { article: 'Annex I, Part I', title: 'Security by Design', description: 'Products shall be designed and developed with appropriate level of cybersecurity based on risks.', status: 'not_started' as const },
    { article: 'Annex I, Part II', title: 'Vulnerability Handling Requirements', description: 'Implement vulnerability handling processes including coordinated disclosure policy.', status: 'not_started' as const },
  ];
  if (category === 'class_i' || category === 'class_ii') {
    base.push({ article: 'Art. 32', title: 'Harmonised Standards', description: 'Where harmonised standards exist, conformity assessment shall reference them.', status: 'not_started' });
  }
  if (category === 'class_ii') {
    base.push({ article: 'Art. 32(3)', title: 'Third-Party Assessment', description: 'Critical products require third-party conformity assessment by a notified body.', status: 'not_started' });
  }
  return base;
}

/* ── Technical File Tab ─────────────────────────────────────── */
function TechnicalFileTab() {
  const sections = [
    { title: 'General Description', desc: 'Description of the product including its intended purpose, version, and how it is made available on the market.' },
    { title: 'Design & Development Information', desc: 'Information on the design and development process of the product, including cybersecurity risk assessment.' },
    { title: 'Cybersecurity Risk Assessment', desc: 'Assessment of cybersecurity risks against which the product is designed, developed and produced.' },
    { title: 'Vulnerability Handling Documentation', desc: 'Description of the vulnerability handling process and evidence it will be ensured for the support period.' },
    { title: 'SBOM', desc: 'Software bill of materials documenting all components, libraries and dependencies used.' },
    { title: 'Test Reports', desc: 'Results of tests carried out to verify conformity with essential requirements.' },
    { title: 'EU Declaration of Conformity', desc: 'The formal declaration that the product meets all applicable CRA requirements.' },
  ];
  return (
    <div className="pd-techfile">
      <div className="pd-section-intro">
        <FileText size={20} />
        <div>
          <h3>Technical Documentation</h3>
          <p>The technical file must be compiled before placing the product on the EU market (Annex VII of the CRA).</p>
        </div>
      </div>
      <div className="pd-techfile-list">
        {sections.map((s, i) => (
          <div key={i} className="pd-techfile-item">
            <div className="pd-techfile-status"><Clock size={16} style={{ color: 'var(--muted)' }} /></div>
            <div className="pd-techfile-content"><h4>{s.title}</h4><p>{s.desc}</p></div>
            <button className="pd-techfile-action" disabled>Start <ChevronRight size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Risk Findings Tab ─────────────────────────────────────── */
function RiskFindingsTab() {
  return (
    <div className="pd-placeholder">
      <AlertTriangle size={48} strokeWidth={1} />
      <h3>No Risk Findings Yet</h3>
      <p>Once repositories are connected and scanned, vulnerability and risk findings will appear here. This includes CVEs from dependencies, code analysis results, and CRA risk assessments.</p>
    </div>
  );
}

/* ── Dependencies Tab (with Contributors + Languages) ───────── */
function DependenciesTab({ ghStatus, ghData, onConnect, onSync, syncing }: {
  ghStatus: GitHubStatus; ghData: GitHubData; onConnect: () => void; onSync: () => void; syncing: boolean;
}) {
  if (!ghStatus.connected) {
    return (
      <div className="pd-placeholder">
        <Github size={48} strokeWidth={1} />
        <h3>Connect GitHub to Discover Dependencies</h3>
        <p>Connect your GitHub account to scan the repository for dependencies, generate SBOMs, and identify contributors. The CRA requires a machine-readable SBOM.</p>
        <button className="btn btn-primary" onClick={onConnect}>
          <Github size={18} /> Connect GitHub
        </button>
      </div>
    );
  }

  if (!ghData.synced) {
    return (
      <div className="pd-placeholder">
        <RefreshCw size={48} strokeWidth={1} />
        <h3>Sync Repository</h3>
        <p>Your GitHub account is connected. Sync the repository to discover languages, contributors, and prepare for dependency analysis.</p>
        <button className="btn btn-primary" onClick={onSync} disabled={syncing}>
          {syncing ? <Loader2 size={18} className="spin" /> : <RefreshCw size={18} />}
          {syncing ? 'Syncing...' : 'Sync Repository'}
        </button>
      </div>
    );
  }

  return (
    <div className="deps-content">
      {/* Languages */}
      {ghData.languages && ghData.languages.length > 0 && (
        <div className="pd-card">
          <div className="pd-card-header">
            <GitBranch size={18} />
            <h3>Languages</h3>
          </div>
          <div className="gh-lang-bar">
            {ghData.languages.map(l => (
              <div
                key={l.language}
                className="gh-lang-segment"
                style={{ width: `${l.percentage}%`, background: LANGUAGE_COLORS[l.language] || '#8b8d98' }}
                title={`${l.language}: ${l.percentage}%`}
              />
            ))}
          </div>
          <div className="gh-lang-legend">
            {ghData.languages.map(l => (
              <span key={l.language} className="gh-lang-item">
                <span className="gh-lang-dot" style={{ background: LANGUAGE_COLORS[l.language] || '#8b8d98' }}></span>
                {l.language} <span className="gh-lang-pct">{l.percentage}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Contributors */}
      {ghData.contributors && ghData.contributors.length > 0 && (
        <div className="pd-card">
          <div className="pd-card-header">
            <Users size={18} />
            <h3>Contributors ({ghData.contributors.length})</h3>
          </div>
          <div className="gh-contributors-grid">
            {ghData.contributors.map(c => (
              <a key={c.githubId} href={c.profileUrl} target="_blank" rel="noopener noreferrer" className="gh-contributor">
                <img src={c.avatarUrl} alt={c.login} className="gh-contributor-avatar" />
                <div className="gh-contributor-info">
                  <span className="gh-contributor-name">{c.login}</span>
                  <span className="gh-contributor-commits">{c.contributions} commit{c.contributions !== 1 ? 's' : ''}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="pd-section-intro" style={{ marginTop: '0.5rem' }}>
        <AlertTriangle size={20} />
        <div>
          <h3>Dependency Scanning — Coming Soon</h3>
          <p>Full dependency tree analysis and SBOM generation from package manifests (package.json, requirements.txt, go.mod, etc.) will be available in a future update.</p>
        </div>
      </div>
    </div>
  );
}

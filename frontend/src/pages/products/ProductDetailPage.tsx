import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

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


interface SBOMPackage {
  purl: string;
  name: string;
  version: string;
  ecosystem: string;
  license: string;
  supplier: string;
}

interface SBOMData {
  hasSBOM: boolean;
  spdxVersion?: string;
  packageCount?: number;
  isStale?: boolean;
  syncedAt?: string;
  packages?: SBOMPackage[];
}

interface TechFileSection {
  sectionKey: string;
  title: string;
  content: any;
  notes: string;
  status: 'not_started' | 'in_progress' | 'completed';
  craReference: string;
  updatedBy: string | null;
  updatedAt: string | null;
}

interface TechFileData {
  sections: TechFileSection[];
  progress: { total: number; completed: number; inProgress: number; notStarted: number };
}

interface VersionEntry {
  cranisVersion: string;
  githubTag: string | null;
  releaseName: string | null;
  source: 'sync' | 'github_release' | 'manual';
  createdAt: string;
  isPrerelease: boolean;
}



interface SyncHistoryEntry {
  syncType: 'manual' | 'auto';
  startedAt: string;
  durationSeconds: number;
  packageCount: number;
  contributorCount: number;
  releaseCount: number;
  cranisVersion: string | null;
  triggeredBy: string | null;
  status: 'success' | 'error';
  errorMessage: string | null;
}

interface SyncStats {
  totalSyncs: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  errorCount: number;
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
  const [sbomData, setSbomData] = useState<SBOMData>({ hasSBOM: false });
  const [sbomLoading, setSbomLoading] = useState(false);
  const [techFileData, setTechFileData] = useState<TechFileData>({ sections: [], progress: { total: 0, completed: 0, inProgress: 0, notStarted: 0 } });
  const [techFileLoading, setTechFileLoading] = useState(false);
  const [versionHistory, setVersionHistory] = useState<VersionEntry[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryEntry[]>([]);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);

  useEffect(() => {
    fetchProduct();
    fetchGitHubStatus();
  }, [productId]);

  // After product loads, fetch cached repo data
  useEffect(() => {
    if (product?.id) {
      fetchCachedRepoData();
      fetchSBOMData();
      fetchTechFileData();
      fetchVersionHistory();
      fetchSyncHistory();
    }
  }, [product?.id]);

  // Listen for OAuth popup completion via postMessage
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'github-oauth-success') {
        fetchGitHubStatus();
        if (product?.repoUrl) handleSync();
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [product?.repoUrl]);

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


  async function fetchSBOMData() {
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`/api/github/sbom/${productId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setSbomData(data);
      }
    } catch { /* silent */ }
  }


  async function fetchTechFileData() {
    if (!productId) return;
    try {
      setTechFileLoading(true);
      const res = await fetch(`/api/technical-file/${productId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('session_token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTechFileData(data);
      }
    } catch (err) {
      console.error('Failed to fetch technical file:', err);
    } finally {
      setTechFileLoading(false);
    }
  }


  async function fetchVersionHistory() {
    if (!productId) return;
    try {
      const res = await fetch(`/api/github/versions/${productId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('session_token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        setVersionHistory(data.versions || []);
      }
    } catch (err) {
      console.error('Failed to fetch version history:', err);
    }
  }

  async function fetchSyncHistory() {
    if (!productId) return;
    try {
      const res = await fetch(`/api/github/sync-history/${productId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('session_token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSyncHistory(data.history || []);
        setSyncStats(data.stats || null);
      }
    } catch (err) {
      console.error('Failed to fetch sync history:', err);
    }
  }

  async function handleRefreshSBOM() {
    setSbomLoading(true);
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`/api/github/sbom/${productId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSbomData(data);
      }
    } catch { /* silent */ } finally { setSbomLoading(false); }
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
        if (data.version) setProduct(prev => prev ? { ...prev, version: data.version } : prev);
        fetchSBOMData();
        fetchVersionHistory();
        fetchSyncHistory();
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

  async function handleConnectGitHub() {
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch('/api/github/connect-init', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        setSyncError(err.error || 'Failed to initiate GitHub connection');
        return;
      }
      const { connectionToken } = await res.json();
      const w = 600, h = 700;
      const left = window.screenX + (window.outerWidth - w) / 2;
      const top = window.screenY + (window.outerHeight - h) / 2;
      window.open(
        `/api/github/connect?connectionToken=${connectionToken}`,
        'github-oauth',
        `width=${w},height=${h},left=${left},top=${top}`
      );
    } catch {
      setSyncError('Failed to initiate GitHub connection');
    }
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
              <button className={`pd-sync-btn ${sbomData.isStale ? 'pd-sync-stale' : 'pd-sync-fresh'}`} onClick={handleSync} disabled={syncing}>
                {syncing ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                {syncing ? 'Syncing...' : sbomData.isStale ? 'Update Available' : 'Sync'}
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
            {tab.key === 'dependencies' && sbomData.packageCount && sbomData.packageCount > 0 && (
              <span className="pd-tab-count">{sbomData.packageCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pd-tab-content">
        {activeTab === 'overview' && <OverviewTab product={product} catInfo={catInfo} ghStatus={ghStatus} ghData={ghData} sbomData={sbomData} techFileProgress={techFileData.progress} versionHistory={versionHistory} syncHistory={syncHistory} syncStats={syncStats} onConnect={handleConnectGitHub} onSync={handleSync} syncing={syncing} onDisconnect={handleDisconnectGitHub} />}
        {activeTab === 'obligations' && <ObligationsTab product={product} />}
        {activeTab === 'technical-file' && <TechnicalFileTab productId={productId!} techFileData={techFileData} loading={techFileLoading} onUpdate={fetchTechFileData} />}
        {activeTab === 'risk-findings' && <RiskFindingsTab />}
        {activeTab === 'dependencies' && <DependenciesTab ghStatus={ghStatus} ghData={ghData} sbomData={sbomData} sbomLoading={sbomLoading} onConnect={handleConnectGitHub} onSync={handleSync} syncing={syncing} onRefreshSBOM={handleRefreshSBOM} />}
      </div>
    </>
  );
}

/* ── Overview Tab ─────────────────────────────────────── */
function OverviewTab({ product, catInfo, ghStatus, ghData, sbomData, techFileProgress, versionHistory, syncHistory, syncStats, onConnect, onSync, syncing, onDisconnect }: {
  product: Product; catInfo: { label: string; color: string; desc: string };
  ghStatus: GitHubStatus; ghData: GitHubData; sbomData: SBOMData;
  techFileProgress: { total: number; completed: number; inProgress: number; notStarted: number };
  versionHistory: VersionEntry[];
  syncHistory: SyncHistoryEntry[];
  syncStats: SyncStats | null;
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

      {/* Version History Card */}
      {versionHistory.length > 0 && (
        <div className="pd-card">
          <div className="pd-card-header">
            <GitBranch size={18} />
            <h3>Version History</h3>
          </div>
          <div className="vh-list">
            {versionHistory.slice(0, 8).map((v, i) => (
              <div key={i} className={`vh-item ${i === 0 ? 'vh-latest' : ''}`}>
                <div className="vh-version">
                  <span className="vh-cranis">{v.cranisVersion}</span>
                  {v.githubTag && <span className="vh-tag">{v.githubTag}</span>}
                  {v.isPrerelease && <span className="vh-prerelease">pre-release</span>}
                </div>
                <div className="vh-meta">
                  <span className={`vh-source vh-source-${v.source}`}>{v.source === 'sync' ? 'Sync' : v.source === 'github_release' ? 'Release' : 'Manual'}</span>
                  <span className="vh-date">{new Date(v.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {syncHistory.length > 0 && (
        <div className="pd-card">
          <div className="pd-card-header">
            <Clock size={18} />
            <h3>Sync Performance</h3>
          </div>
          {syncStats && (
            <div className="sh-stats">
              <div className="sh-stat">
                <span className="sh-stat-value">{syncStats.avgDuration.toFixed(1)}s</span>
                <span className="sh-stat-label">Avg Duration</span>
              </div>
              <div className="sh-stat">
                <span className="sh-stat-value">{syncStats.totalSyncs}</span>
                <span className="sh-stat-label">Total Syncs</span>
              </div>
              <div className="sh-stat">
                <span className="sh-stat-value">{syncStats.minDuration.toFixed(1)}s</span>
                <span className="sh-stat-label">Fastest</span>
              </div>
              <div className="sh-stat">
                <span className="sh-stat-value">{syncStats.maxDuration.toFixed(1)}s</span>
                <span className="sh-stat-label">Slowest</span>
              </div>
            </div>
          )}
          <div className="sh-list">
            {syncHistory.slice(0, 8).map((s, i) => (
              <div key={i} className={`sh-item ${s.status === 'error' ? 'sh-error' : ''}`}>
                <div className="sh-duration">
                  <span className="sh-seconds">{s.durationSeconds.toFixed(1)}s</span>
                  <span className={`sh-type sh-type-${s.syncType}`}>{s.syncType === 'manual' ? 'Manual' : 'Auto'}</span>
                </div>
                <div className="sh-meta">
                  {s.cranisVersion && <span className="sh-version">{s.cranisVersion}</span>}
                  <span className="sh-packages">{s.packageCount} pkgs</span>
                  <span className="sh-date">{new Date(s.startedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

            {/* Compliance Progress Card */}
      <div className="pd-card">
        <div className="pd-card-header">
          <CheckCircle2 size={18} />
          <h3>Compliance Progress</h3>
        </div>
        <div className="pd-progress-list">
          <ProgressItem label="Essential Requirements" status="not_started" />
          <ProgressItem label="Vulnerability Handling" status="not_started" />
          <ProgressItem label="Technical Documentation" status={techFileProgress.completed === techFileProgress.total && techFileProgress.total > 0 ? 'completed' : techFileProgress.completed > 0 || techFileProgress.inProgress > 0 ? 'in_progress' : 'not_started'} />
          <ProgressItem label="SBOM Generation" status={sbomData.hasSBOM ? 'completed' : ghData.synced ? 'in_progress' : 'not_started'} />
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
function TechnicalFileTab({ productId, techFileData, loading, onUpdate }: {
  productId: string; techFileData: TechFileData; loading: boolean; onUpdate: () => void;
}) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<Record<string, any>>({});
  const [editNotes, setEditNotes] = useState<Record<string, string>>({});
  const [editStatus, setEditStatus] = useState<Record<string, string>>({});

  const statusConfig = {
    completed: { icon: CheckCircle2, color: 'var(--green)', text: 'Complete' },
    in_progress: { icon: Clock, color: 'var(--amber)', text: 'In Progress' },
    not_started: { icon: Clock, color: 'var(--muted)', text: 'Not Started' },
  };

  function toggleSection(key: string, section: TechFileSection) {
    if (expandedSection === key) {
      setExpandedSection(null);
    } else {
      setExpandedSection(key);
      if (!editContent[key]) {
        setEditContent(prev => ({ ...prev, [key]: section.content }));
        setEditNotes(prev => ({ ...prev, [key]: section.notes || '' }));
        setEditStatus(prev => ({ ...prev, [key]: section.status }));
      }
    }
  }

  async function handleSave(sectionKey: string) {
    setSaving(sectionKey);
    try {
      const res = await fetch(`/api/technical-file/${productId}/${sectionKey}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('session_token')}`,
        },
        body: JSON.stringify({
          content: editContent[sectionKey],
          notes: editNotes[sectionKey],
          status: editStatus[sectionKey],
        }),
      });
      if (res.ok) {
        onUpdate();
      }
    } catch (err) {
      console.error('Failed to save section:', err);
    } finally {
      setSaving(null);
    }
  }

  function renderFieldEditor(sectionKey: string, fields: Record<string, string>, fieldLabels?: Record<string, string>) {
    const labels: Record<string, string> = fieldLabels || {
      intended_purpose: 'Intended Purpose',
      versions_affecting_compliance: 'Software Versions Affecting Compliance',
      market_availability: 'Market Availability',
      user_instructions_reference: 'User Information & Instructions (Annex II)',
      architecture_description: 'System Architecture Description',
      component_interactions: 'Component Interactions & Integration',
      sdlc_process: 'Secure Development Lifecycle (SDLC)',
      production_monitoring: 'Production & Monitoring Processes',
      disclosure_policy_url: 'Coordinated Vulnerability Disclosure Policy URL',
      reporting_contact: 'Vulnerability Reporting Contact',
      update_distribution_mechanism: 'Secure Update Distribution Mechanism',
      security_update_policy: 'Security Update Policy',
      sbom_reference: 'SBOM Reference',
      methodology: 'Risk Assessment Methodology',
      threat_model: 'Threat Model / Attack Surface Analysis',
      risk_register: 'Risk Register',
      start_date: 'Support Period Start Date',
      end_date: 'Support Period End Date',
      rationale: 'Rationale for Support Period',
      communication_plan: 'End-of-Support Communication Plan',
      assessment_module: 'Conformity Assessment Module (A / B+C / H)',
      notified_body: 'Notified Body (if applicable)',
      certificate_reference: 'Certificate Reference',
      ce_marking_date: 'CE Marking Date',
      declaration_text: 'Declaration Text',
    };

    return Object.entries(fields).map(([fieldKey, _]) => {
      const currentContent = editContent[sectionKey] || {};
      const currentFields = currentContent.fields || {};
      const value = currentFields[fieldKey] || '';
      const isDateField = fieldKey.includes('date') && !fieldKey.includes('update');
      const isUrlField = fieldKey.includes('url');
      const isReadOnly = fieldKey === 'sbom_reference';

      return (
        <div key={fieldKey} className="tf-field">
          <label className="tf-field-label">{labels[fieldKey] || fieldKey}</label>
          {isReadOnly ? (
            <div className="tf-field-readonly">{value}</div>
          ) : isDateField ? (
            <input
              type="date"
              className="tf-field-input"
              value={value}
              onChange={(e) => {
                const updated = { ...currentContent, fields: { ...currentFields, [fieldKey]: e.target.value } };
                setEditContent(prev => ({ ...prev, [sectionKey]: updated }));
              }}
            />
          ) : (
            <textarea
              className={`tf-field-textarea ${isUrlField ? 'tf-field-url' : ''}`}
              rows={isUrlField ? 1 : 4}
              placeholder={isUrlField ? 'https://...' : `Enter ${(labels[fieldKey] || fieldKey).toLowerCase()}...`}
              value={value}
              onChange={(e) => {
                const updated = { ...currentContent, fields: { ...currentFields, [fieldKey]: e.target.value } };
                setEditContent(prev => ({ ...prev, [sectionKey]: updated }));
              }}
            />
          )}
        </div>
      );
    });
  }

  function renderAnnexIChecklist(sectionKey: string) {
    const currentContent = editContent[sectionKey] || {};
    const reqs = currentContent.annex_i_requirements || [];
    if (!reqs.length) return null;

    return (
      <div className="tf-annex-checklist">
        <h4 className="tf-subsection-title">Annex I Part I — Essential Requirements Checklist</h4>
        <p className="tf-subsection-desc">For each requirement, indicate whether it is applicable and provide evidence or justification.</p>
        <div className="tf-annex-list">
          {reqs.map((req: any, idx: number) => (
            <div key={req.ref} className={`tf-annex-item ${req.applicable ? '' : 'tf-annex-na'}`}>
              <div className="tf-annex-header">
                <span className="tf-annex-ref">{req.ref}</span>
                <span className="tf-annex-title">{req.title}</span>
                <label className="tf-annex-toggle">
                  <input
                    type="checkbox"
                    checked={req.applicable}
                    onChange={(e) => {
                      const updated = [...reqs];
                      updated[idx] = { ...updated[idx], applicable: e.target.checked };
                      setEditContent(prev => ({
                        ...prev,
                        [sectionKey]: { ...currentContent, annex_i_requirements: updated }
                      }));
                    }}
                  />
                  Applicable
                </label>
              </div>
              {req.applicable ? (
                <textarea
                  className="tf-field-textarea"
                  rows={2}
                  placeholder="Describe how this requirement is met..."
                  value={req.evidence || ''}
                  onChange={(e) => {
                    const updated = [...reqs];
                    updated[idx] = { ...updated[idx], evidence: e.target.value };
                    setEditContent(prev => ({
                      ...prev,
                      [sectionKey]: { ...currentContent, annex_i_requirements: updated }
                    }));
                  }}
                />
              ) : (
                <textarea
                  className="tf-field-textarea"
                  rows={2}
                  placeholder="Justify why this requirement is not applicable..."
                  value={req.justification || ''}
                  onChange={(e) => {
                    const updated = [...reqs];
                    updated[idx] = { ...updated[idx], justification: e.target.value };
                    setEditContent(prev => ({
                      ...prev,
                      [sectionKey]: { ...currentContent, annex_i_requirements: updated }
                    }));
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loading && techFileData.sections.length === 0) {
    return (
      <div className="pd-placeholder">
        <Loader2 size={48} strokeWidth={1} className="spin" />
        <h3>Loading Technical File...</h3>
      </div>
    );
  }

  return (
    <div className="pd-techfile">
      <div className="pd-section-intro">
        <FileText size={20} />
        <div>
          <h3>Technical Documentation</h3>
          <p>The technical file must be compiled before placing the product on the EU market (CRA Annex VII, Article 31). Click each section to expand and edit.</p>
        </div>
        <div className="tf-progress-summary">
          <span className="tf-progress-count">{techFileData.progress.completed}/{techFileData.progress.total} complete</span>
        </div>
      </div>
      <div className="pd-techfile-list">
        {techFileData.sections.map((section) => {
          const isExpanded = expandedSection === section.sectionKey;
          const cfg = statusConfig[section.status];
          const StatusIcon = cfg.icon;
          const currentStatus = editStatus[section.sectionKey] || section.status;

          return (
            <div key={section.sectionKey} className={`pd-techfile-item ${isExpanded ? 'tf-expanded' : ''}`}>
              <div className="tf-item-header" onClick={() => toggleSection(section.sectionKey, section)}>
                <div className="pd-techfile-status">
                  <StatusIcon size={16} style={{ color: cfg.color }} />
                </div>
                <div className="pd-techfile-content">
                  <h4>{section.title}</h4>
                  <p>{section.craReference}{section.updatedAt ? ` · Updated ${timeAgo(section.updatedAt)}` : ''}</p>
                </div>
                <ChevronRight size={16} className={`tf-chevron ${isExpanded ? 'tf-chevron-open' : ''}`} />
              </div>

              {isExpanded && (
                <div className="tf-editor">
                  <div className="tf-guidance">
                    <Shield size={14} />
                    <span>{section.content?.guidance || 'Complete this section per the CRA requirements.'}</span>
                  </div>

                  {/* Status selector */}
                  <div className="tf-status-row">
                    <label className="tf-field-label">Section Status</label>
                    <select
                      className="tf-status-select"
                      value={currentStatus}
                      onChange={(e) => setEditStatus(prev => ({ ...prev, [section.sectionKey]: e.target.value }))}
                    >
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Complete</option>
                    </select>
                  </div>

                  {/* Field editors */}
                  {section.content?.fields && (
                    <div className="tf-fields">
                      {renderFieldEditor(section.sectionKey, section.content.fields)}
                    </div>
                  )}

                  {/* Annex I checklist for risk assessment */}
                  {section.sectionKey === 'risk_assessment' && renderAnnexIChecklist(section.sectionKey)}

                  {/* Notes */}
                  <div className="tf-field">
                    <label className="tf-field-label">Internal Notes</label>
                    <textarea
                      className="tf-field-textarea"
                      rows={3}
                      placeholder="Add any internal notes or comments..."
                      value={editNotes[section.sectionKey] || ''}
                      onChange={(e) => setEditNotes(prev => ({ ...prev, [section.sectionKey]: e.target.value }))}
                    />
                  </div>

                  {/* Save button */}
                  <div className="tf-actions">
                    <button
                      className="btn btn-primary tf-save-btn"
                      onClick={() => handleSave(section.sectionKey)}
                      disabled={saving === section.sectionKey}
                    >
                      {saving === section.sectionKey ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                      {saving === section.sectionKey ? 'Saving...' : 'Save Section'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
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

/* ── Dependencies Tab (with SBOM + Contributors + Languages) ───────── */
function DependenciesTab({ ghStatus, ghData, sbomData, sbomLoading, onConnect, onSync, syncing, onRefreshSBOM }: {
  ghStatus: GitHubStatus; ghData: GitHubData; sbomData: SBOMData; sbomLoading: boolean;
  onConnect: () => void; onSync: () => void; syncing: boolean; onRefreshSBOM: () => void;
}) {
  if (!ghStatus.connected) {
    return (
      <div className="pd-placeholder">
        <Github size={48} strokeWidth={1} />
        <h3>Connect GitHub to Discover Dependencies</h3>
        <p>Connect your GitHub account to scan the repository for dependencies, generate SBOMs, and identify contributors. The CRA requires a machine-readable SBOM (Article 13(11)).</p>
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
        <p>Your GitHub account is connected. Sync the repository to generate the SBOM, discover languages, and identify contributors.</p>
        <button className="btn btn-primary" onClick={onSync} disabled={syncing}>
          {syncing ? <Loader2 size={18} className="spin" /> : <RefreshCw size={18} />}
          {syncing ? 'Syncing...' : 'Sync Repository'}
        </button>
      </div>
    );
  }

  return (
    <div className="deps-content">
      {/* SBOM Section */}
      {sbomData.hasSBOM && sbomData.packages && sbomData.packages.length > 0 && (
        <div className="pd-card">
          <div className="pd-card-header">
            <Package size={18} />
            <h3>Software Bill of Materials ({sbomData.packageCount} packages)</h3>
            <div className="sbom-header-actions">
              {sbomData.isStale && <span className="sbom-stale-badge">Outdated</span>}
              <button className="pd-sync-btn" onClick={onRefreshSBOM} disabled={sbomLoading}>
                {sbomLoading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                {sbomLoading ? 'Refreshing...' : 'Refresh SBOM'}
              </button>
            </div>
          </div>
          {sbomData.syncedAt && (
            <div className="sbom-meta">
              <span>SPDX {sbomData.spdxVersion}</span>
              <span>Last synced: {new Date(sbomData.syncedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
          <div className="sbom-table-wrapper">
            <table className="sbom-table">
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Version</th>
                  <th>Ecosystem</th>
                  <th>License</th>
                </tr>
              </thead>
              <tbody>
                {sbomData.packages.map((pkg, i) => (
                  <tr key={i}>
                    <td className="sbom-pkg-name">{pkg.name}</td>
                    <td className="sbom-pkg-version">{pkg.version || '—'}</td>
                    <td><span className={`sbom-ecosystem sbom-eco-${pkg.ecosystem}`}>{pkg.ecosystem}</span></td>
                    <td className="sbom-pkg-license">{pkg.license === 'NOASSERTION' ? '—' : pkg.license}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No SBOM yet but synced */}
      {!sbomData.hasSBOM && ghData.synced && (
        <div className="pd-card pd-card-connect">
          <div className="pd-card-header">
            <Package size={18} />
            <h3>No SBOM Available</h3>
          </div>
          <p className="gh-connect-desc">No dependency data was found for this repository. Ensure the repository contains dependency manifests (package.json, requirements.txt, go.mod, etc.).</p>
          <button className="pd-sync-btn" onClick={onRefreshSBOM} disabled={sbomLoading}>
            {sbomLoading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
            Try Again
          </button>
        </div>
      )}

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
    </div>
  );
}

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';

import PageHeader from '../../components/PageHeader';
import HelpTip from '../../components/HelpTip';
import CategoryRecommenderModal from '../../components/CategoryRecommenderModal';
import SupplyChainTab from '../../components/SupplyChainTab';
import ComplianceVaultTab from './product-detail/ComplianceVaultTab';
import {
  ArrowLeft, Package, Shield, FileText, AlertTriangle, GitBranch, History, Trash2,
  Edit3, Save, X, RefreshCw, Loader2, Download, Archive, Sparkles,
  ExternalLink, Star, GitFork,
} from 'lucide-react';
import { usePageMeta } from '../../hooks/usePageMeta';
import './ProductDetailPage.css';

// Decomposed sub-modules
import type {
  Product, ProviderInfo, GitHubStatus, GitHubData, SBOMData, TechFileData,
  VersionEntry, SyncHistoryEntry, SyncStats, PushEvent,
  TabKey,
} from './product-detail/shared';
import {
  PRODUCT_TYPES, TYPE_LABELS, CATEGORY_INFO, CRA_CATEGORY_HELP,
  getTypeIcon, formatDate, providerLabel,
} from './product-detail/shared';
import ProviderIcon from './product-detail/ProviderIcon';
import OverviewTab from './product-detail/OverviewTab';
import ObligationsTab from './product-detail/ObligationsTab';
import TechnicalFileTab from './product-detail/TechnicalFileTab';
import ActivityTab from './product-detail/ActivityTab';
import RiskFindingsTab from './product-detail/RiskFindingsTab';
import DependenciesTab from './product-detail/DependenciesTab';

const TABS: { key: TabKey; label: string; icon: typeof Package }[] = [
  { key: 'overview', label: 'Overview', icon: Package },
  { key: 'obligations', label: 'Obligations', icon: Shield },
  { key: 'technical-file', label: 'Technical File', icon: FileText },
  { key: 'activity', label: 'Activity', icon: History },
  { key: 'risk-findings', label: 'Risk Findings', icon: AlertTriangle },
  { key: 'dependencies', label: 'Dependencies', icon: GitBranch },
  { key: 'supply-chain', label: 'Supply Chain', icon: Package },
  { key: 'compliance-vault', label: 'Compliance Vault', icon: Archive },
];

export default function ProductDetailPage() {
  const { productId } = useParams();

  const [product, setProduct] = useState<Product | null>(null);
  usePageMeta(product ? { title: product.name } : undefined);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabKey) || 'overview';
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', version: '', productType: '', craCategory: '', repoUrl: '', distributionModel: '', lifecycleStatus: '', marketPlacementDate: '', provider: '', instanceUrl: '' });
  const [availableProviders, setAvailableProviders] = useState<ProviderInfo[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [hasEscrow, setHasEscrow] = useState(false);
  const navigate = useNavigate();
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
  const [pushEvents, setPushEvents] = useState<PushEvent[]>([]);
  const [showCategoryRecommender, setShowCategoryRecommender] = useState(false);

  useEffect(() => {
    fetchProduct();
    fetchGitHubStatus();
    fetchProviders();
  }, [productId]);

  // Check if escrow is configured for this product
  useEffect(() => {
    if (!productId) return;
    const token = localStorage.getItem('session_token');
    fetch(`/api/escrow/${productId}/config`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.configured && data?.setupCompleted) setHasEscrow(true); })
      .catch(() => {});
  }, [productId]);

  // After product loads, fetch cached repo data
  useEffect(() => {
    if (product?.id) {
      fetchCachedRepoData();
      fetchSBOMData();
      fetchTechFileData();
      fetchVersionHistory();
      fetchSyncHistory();
      fetchPushEvents();
    }
  }, [product?.id]);

  // Listen for OAuth popup completion via postMessage
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'repo-oauth-success' || event.data?.type === 'github-oauth-success') {
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
          distributionModel: data.distributionModel || '',
          lifecycleStatus: data.lifecycleStatus || 'pre_production',
          marketPlacementDate: data.marketPlacementDate || '',
          provider: data.provider || detectProvider(data.repoUrl || ''),
          instanceUrl: data.instanceUrl || '',
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

  async function fetchProviders() {
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch('/api/repo/providers', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setAvailableProviders(data);
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
    } catch { /* silent — tech file fetch is non-critical */ } finally {
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
    } catch { /* silent — version history is non-critical */ }
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
    } catch { /* silent — sync history is non-critical */ }
  }

  async function fetchPushEvents() {
    if (!productId) return;
    try {
      const res = await fetch(`/api/github/push-events/${productId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('session_token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPushEvents(data || []);
      }
    } catch { /* silent — push events are non-critical */ }
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
        fetchPushEvents();
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

  // Detect repo provider from URL
  function detectProvider(url: string): string {
    try {
      const hostname = new URL(url.includes('://') ? url : `https://${url}`).hostname;
      if (hostname === 'codeberg.org') return 'codeberg';
      if (hostname === 'gitlab.com') return 'gitlab';
    } catch { /* ignore */ }
    return 'github';
  }

  async function handleConnectGitHub(providerOverride?: string) {
    const repoProvider = providerOverride || detectProvider(product?.repoUrl || '');
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch('/api/github/connect-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider: repoProvider }),
      });
      if (!res.ok) {
        const err = await res.json();
        setSyncError(err.error || `Failed to initiate ${providerLabel(repoProvider)} connection`);
        return;
      }
      const { connectionToken } = await res.json();
      const w = 600, h = 700;
      const left = window.screenX + (window.outerWidth - w) / 2;
      const top = window.screenY + (window.outerHeight - h) / 2;
      window.open(
        `/api/github/connect/${repoProvider}?connectionToken=${connectionToken}`,
        'repo-oauth',
        `width=${w},height=${h},left=${left},top=${top}`
      );
    } catch {
      setSyncError(`Failed to initiate ${providerLabel(repoProvider)} connection`);
    }
  }

  async function handleDisconnectGitHub(providerOverride?: string) {
    const repoProvider = providerOverride || detectProvider(product?.repoUrl || '');
    const label = providerLabel(repoProvider);
    if (!confirm(`Disconnect ${label}? You can reconnect at any time.`)) return;
    const token = localStorage.getItem('session_token');
    await fetch(`/api/github/disconnect/${repoProvider}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
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

  async function handleExportProduct() {
    if (!product) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/products/${product.id}/export`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('session_token')}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-export.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download export');
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteProduct() {
    if (!product) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('session_token')}` },
      });
      if (res.ok) {
        navigate('/products');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete product');
      }
    } catch {
      alert('Network error');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
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

  // Check if the product's specific repo provider is connected
  const currentProvider = editForm.provider || (product.repoUrl ? detectProvider(product.repoUrl) : 'github');
  const isProviderConnected = ghStatus.connections?.some(c => c.provider === currentProvider) || (currentProvider === 'github' && ghStatus.connected);

  // Find the matching connection for display
  const providerConnection = ghStatus.connections?.find(c => c.provider === currentProvider);

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
            {/* Repo connection buttons */}
            {product.repoUrl && !isProviderConnected && (
              <button className="pd-github-btn" onClick={() => handleConnectGitHub()}>
                <ProviderIcon provider={currentProvider} size={14} /> Connect {providerLabel(currentProvider)}
              </button>
            )}
            {isProviderConnected && product.repoUrl && (
              <button className={`pd-sync-btn ${sbomData.isStale ? 'pd-sync-stale' : 'pd-sync-fresh'}`} onClick={handleSync} disabled={syncing}>
                {syncing ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                {syncing ? 'Syncing...' : sbomData.isStale ? 'Update Available' : 'Sync'}
              </button>
            )}
            <Link to={`/products/${product.id}/timeline`} className="pd-edit-btn" style={{ textDecoration: "none" }}>
                <History size={14} /> Timeline
              </Link>
            <Link to={`/products/${product.id}/escrow`} className="pd-edit-btn" style={{ textDecoration: "none" }}>
                <Archive size={14} /> Escrow
              </Link>
            <button className="pd-edit-btn" onClick={() => setShowCategoryRecommender(true)}>
              <Sparkles size={14} /> AI Category
            </button>
            <button className="pd-delete-btn" onClick={() => { setShowDeleteModal(true); setDeleteConfirmed(false); }} title="Delete product">
              <Trash2 size={14} /> Delete
            </button>
            {!editing ? (
              <button className="pd-edit-btn" onClick={() => setEditing(true)}>
                <Edit3 size={14} /> Edit
              </button>
            ) : (
              <>
                <button className="pd-cancel-btn" onClick={() => { setEditing(false); setEditForm({ name: product.name, description: product.description, version: product.version, productType: product.productType, craCategory: product.craCategory, repoUrl: product.repoUrl, distributionModel: product.distributionModel || '', lifecycleStatus: product.lifecycleStatus || 'pre_production', marketPlacementDate: product.marketPlacementDate || '', provider: product.provider || detectProvider(product.repoUrl), instanceUrl: product.instanceUrl || '' }); }}>
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
              {isProviderConnected && (
                <span className="pd-github-connected-badge">
                  <ProviderIcon provider={currentProvider} size={12} /> {providerConnection?.username || ghStatus.githubUsername}
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
            <div className="form-row">
              <div className="form-group" style={{ flex: '0 0 180px' }}>
                <label className="form-label">Provider</label>
                <select className="form-input" value={editForm.provider} onChange={e => {
                  const prov = e.target.value;
                  const provInfo = availableProviders.find(p => p.id === prov);
                  setEditForm({ ...editForm, provider: prov, instanceUrl: provInfo?.selfHosted ? editForm.instanceUrl : '' });
                }}>
                  {availableProviders.length > 0 ? (
                    availableProviders.map(p => <option key={p.id} value={p.id}>{p.label}</option>)
                  ) : (
                    <>
                      <option value="github">GitHub</option>
                      <option value="codeberg">Codeberg</option>
                      <option value="gitea">Gitea (self-hosted)</option>
                      <option value="forgejo">Forgejo (self-hosted)</option>
                      <option value="gitlab">GitLab (self-hosted)</option>
                    </>
                  )}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Repository URL</label>
                <input className="form-input" type="url" placeholder={(() => {
                  const prov = availableProviders.find(p => p.id === editForm.provider);
                  if (prov?.selfHosted) return 'e.g. https://git.mycompany.com/org/repo';
                  if (editForm.provider === 'codeberg') return 'e.g. https://codeberg.org/org/repo';
                  return 'e.g. https://github.com/org/repo';
                })()} value={editForm.repoUrl} onChange={e => setEditForm({ ...editForm, repoUrl: e.target.value })} />
              </div>
            </div>
            {availableProviders.find(p => p.id === editForm.provider)?.selfHosted && (
              <div className="form-group">
                <label className="form-label">Instance URL <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(base URL of your self-hosted instance)</span></label>
                <input className="form-input" type="url" placeholder="e.g. https://git.mycompany.com" value={editForm.instanceUrl} onChange={e => setEditForm({ ...editForm, instanceUrl: e.target.value })} />
              </div>
            )}
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
                <label className="form-label">CRA Category <HelpTip text={CRA_CATEGORY_HELP} /></label>
                <select className="form-input" value={editForm.craCategory} onChange={e => setEditForm({ ...editForm, craCategory: e.target.value })}>
                  <option value="default">Default</option>
                  <option value="important_i">Important I</option>
                  <option value="important_ii">Important II</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Distribution Model</label>
                <select className="form-input" value={editForm.distributionModel} onChange={e => setEditForm({ ...editForm, distributionModel: e.target.value })}>
                  <option value="">Not set</option>
                  <option value="proprietary_binary">Proprietary Binary</option>
                  <option value="saas_hosted">SaaS / Cloud Hosted</option>
                  <option value="source_available">Source Available</option>
                  <option value="library_component">Library / Component</option>
                  <option value="internal_only">Internal Only</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Lifecycle Stage</label>
                <select className="form-input" value={editForm.lifecycleStatus} onChange={e => setEditForm({ ...editForm, lifecycleStatus: e.target.value })}>
                  <option value="pre_production">Pre-production</option>
                  <option value="on_market">On market</option>
                  <option value="end_of_life">End of life</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Market Placement Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={editForm.marketPlacementDate}
                  onChange={e => setEditForm({ ...editForm, marketPlacementDate: e.target.value })}
                  placeholder="Auto-set when placed on market"
                />
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
        {activeTab === 'overview' && <OverviewTab product={product} catInfo={catInfo} ghStatus={ghStatus} ghData={ghData} sbomData={sbomData} techFileProgress={techFileData.progress} versionHistory={versionHistory} syncHistory={syncHistory} syncStats={syncStats} pushEvents={pushEvents} onConnect={handleConnectGitHub} onSync={handleSync} syncing={syncing} onDisconnect={handleDisconnectGitHub} repoProvider={currentProvider} isProviderConnected={isProviderConnected} providerConnection={providerConnection} onSwitchTab={(tab) => { setActiveTab(tab as TabKey); window.history.replaceState({}, '', `?tab=${tab}`); }} onNavigate={(path) => navigate(path)} />}
        {activeTab === 'obligations' && <ObligationsTab product={product} />}
        {activeTab === 'technical-file' && <TechnicalFileTab productId={productId!} techFileData={techFileData} loading={techFileLoading} onUpdate={fetchTechFileData} />}
        {activeTab === 'activity' && <ActivityTab productId={product.id} />}
        {activeTab === 'risk-findings' && <RiskFindingsTab productId={product.id} />}
        {activeTab === 'dependencies' && <DependenciesTab ghData={ghData} sbomData={sbomData} sbomLoading={sbomLoading} onConnect={handleConnectGitHub} onSync={handleSync} syncing={syncing} onRefreshSBOM={handleRefreshSBOM} repoProvider={currentProvider} isProviderConnected={isProviderConnected} />}
        {activeTab === 'supply-chain' && <SupplyChainTab productId={product.id} />}
        {activeTab === 'compliance-vault' && <ComplianceVaultTab productId={product.id} marketPlacementDate={product.marketPlacementDate} supportEndDate={techFileData.sections.find(s => s.sectionKey === 'support_period')?.content?.fields?.end_date || null} lifecycleStatus={product.lifecycleStatus} />}
      </div>

      {/* Delete Product Modal */}
      {showDeleteModal && createPortal(
        <div className="pd-delete-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="pd-delete-modal" onClick={e => e.stopPropagation()}>
            <div className="pd-delete-modal-icon">
              <AlertTriangle size={32} />
            </div>
            <h3>Delete {product?.name}</h3>
            <p className="pd-delete-modal-desc">
              This will permanently remove this product and all its compliance data from CRANIS2,
              including vulnerability scans, license audits, SBOMs, technical files, and escrow records.
            </p>

            {hasEscrow && (
              <div className="pd-delete-escrow-note">
                <Archive size={16} />
                <span>
                  Your escrow repository at <strong>escrow.cranis2.dev</strong> will be preserved.
                  A final deposit will be made before deletion. Existing users will retain access.
                </span>
              </div>
            )}

            <div className="pd-delete-export-section">
              <button className="pd-export-btn" onClick={handleExportProduct} disabled={exporting}>
                {exporting ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                {exporting ? 'Generating export...' : 'Download Data Export'}
              </button>
              <span className="pd-export-hint">ZIP archive with all product data as JSON files</span>
            </div>

            <label className="pd-delete-confirm-label">
              <input
                type="checkbox"
                checked={deleteConfirmed}
                onChange={e => setDeleteConfirmed(e.target.checked)}
              />
              I have downloaded my data or no longer need it
            </label>

            <div className="pd-delete-modal-actions">
              <button className="btn-cancel" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
                Cancel
              </button>
              <button
                className="pd-delete-confirm-btn"
                onClick={handleDeleteProduct}
                disabled={!deleteConfirmed || deleting}
              >
                {deleting ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                {deleting ? 'Deleting...' : 'Delete Product'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {showCategoryRecommender && (
        <CategoryRecommenderModal
          productId={product.id}
          productName={product.name}
          currentCategory={product.craCategory}
          onClose={() => setShowCategoryRecommender(false)}
          onAccept={(category) => {
            setShowCategoryRecommender(false);
            // Update the product category locally
            setProduct((prev) => prev ? { ...prev, craCategory: category } : null);
          }}
        />
      )}
    </>
  );
}

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';

import PageHeader from '../../components/PageHeader';
import HelpTip from '../../components/HelpTip';
import {
  ArrowLeft, Package, Shield, FileText, AlertTriangle, GitBranch, History, Trash2,
  Edit3, Save, X, Cpu, Cloud, BookOpen, Monitor, Smartphone, Radio, Box,
  CheckCircle2, Circle, Clock, ChevronRight, ChevronDown, ExternalLink, Github, Star,
  GitFork, Eye, RefreshCw, Users, Unplug, Loader2, Download, Info, Archive, Server, Sparkles, Activity
} from 'lucide-react';
import { usePageMeta } from '../../hooks/usePageMeta';
import './ProductDetailPage.css';

// Codeberg SVG icon (not available in lucide)
function CodebergIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 19.5h20L12 2z" />
      <path d="M12 8v6" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}


/** Generic self-hosted forge icon */
function ForgeIcon({ size = 16 }: { size?: number }) {
  return <Server size={size} />;
}

/** GitLab icon */
function GitLabIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" />
    </svg>
  );
}

/** Return the right icon component for a repo provider */
function ProviderIcon({ provider, size = 16 }: { provider: string; size?: number }) {
  switch (provider) {
    case 'codeberg': return <CodebergIcon size={size} />;
    case 'gitlab': return <GitLabIcon size={size} />;
    case 'gitea':
    case 'forgejo': return <ForgeIcon size={size} />;
    default: return <Github size={size} />;
  }
}

/** Human-readable provider label */
const PROVIDER_LABELS: Record<string, string> = {
  github: 'GitHub', codeberg: 'Codeberg', gitea: 'Gitea', forgejo: 'Forgejo', gitlab: 'GitLab',
};
function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
}

const CRA_CATEGORY_HELP = 'The CRA defines four product categories with increasing obligations. Default: standard cybersecurity requirements (self-assessment, Module A). Important Class I: products with higher risk — must use harmonised standards or third-party assessment. Important Class II: critical infrastructure products — mandatory third-party conformity assessment (Module B+C or H). Critical: highest risk — requires EU cybersecurity certification per Article 8(6).';

const TECHFILE_HELP: Record<string, string> = {
  product_description: 'Describe your product\'s intended purpose, software versions affecting cybersecurity compliance, how it is made available on the market, and reference user instructions per Annex II. Satisfies Annex VII §1.',
  design_development: 'Document system architecture, how software components interact and integrate, and your SDLC process including production monitoring. Satisfies Annex VII §2(a).',
  vulnerability_handling: 'Document your coordinated vulnerability disclosure (CVD) policy, reporting contact, secure update distribution, and reference to your SBOM. Satisfies Annex VII §2(b).',
  risk_assessment: 'Perform and document a cybersecurity risk assessment considering intended and foreseeable use. Must address each Annex I Part I essential requirement. Satisfies Annex VII §3 and Article 13(2).',
  support_period: 'Determine and document the support period (minimum 5 years or expected product lifetime). Include rationale and communication plan. Satisfies Annex VII §4 and Article 13(8).',
  standards_applied: 'List harmonised standards (EU Official Journal), common specifications per Article 27(2), or EU cybersecurity certification schemes. Specify which parts are applied. Satisfies Annex VII §5.',
  test_reports: 'Attach penetration testing, static/dynamic analysis, vulnerability scan results, and any third-party audit reports demonstrating conformity with Annex I. Satisfies Annex VII §6.',
  declaration_of_conformity: 'The formal EU Declaration of Conformity per Article 28 and Annex VI. Specify the conformity assessment module (A, B+C, or H), notified body details if applicable, and CE marking date. Satisfies Annex VII §7.',
};

interface Product {
  id: string;
  name: string;
  description: string;
  version: string;
  productType: string;
  craCategory: string;
  repoUrl: string;
  provider: string;
  instanceUrl: string;
  distributionModel: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface RepoConnection {
  provider: string;
  username: string;
  avatarUrl: string;
  scope: string;
  connectedAt: string;
}

interface GitHubStatus {
  connected: boolean;
  githubUsername?: string;
  githubAvatarUrl?: string;
  connections?: RepoConnection[];
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


interface ProviderInfo {
  id: string;
  label: string;
  selfHosted: boolean;
  oauthSupported: boolean;
  supportsApiSbom: boolean;
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

interface PushEvent {
  id: string;
  pusherName: string;
  pusherEmail: string | null;
  ref: string | null;
  branch: string | null;
  commitCount: number;
  headCommitMessage: string | null;
  headCommitSha: string | null;
  provider: string;
  createdAt: string;
}

interface GitHubData {
  synced: boolean;
  provider?: string;
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

type TabKey = 'overview' | 'obligations' | 'technical-file' | 'activity' | 'risk-findings' | 'dependencies';

const TABS: { key: TabKey; label: string; icon: typeof Package }[] = [
  { key: 'overview', label: 'Overview', icon: Package },
  { key: 'obligations', label: 'Obligations', icon: Shield },
  { key: 'technical-file', label: 'Technical File', icon: FileText },
  { key: 'activity', label: 'Activity', icon: History },
  { key: 'risk-findings', label: 'Risk Findings', icon: AlertTriangle },
  { key: 'dependencies', label: 'Dependencies', icon: GitBranch },
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
  const [editForm, setEditForm] = useState({ name: '', description: '', version: '', productType: '', craCategory: '', repoUrl: '', distributionModel: '', provider: '', instanceUrl: '' });
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
    } catch (err) {
      console.error('Failed to fetch push events:', err);
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
            <button className="pd-delete-btn" onClick={() => { setShowDeleteModal(true); setDeleteConfirmed(false); }} title="Delete product">
              <Trash2 size={14} /> Delete
            </button>
            {!editing ? (
              <button className="pd-edit-btn" onClick={() => setEditing(true)}>
                <Edit3 size={14} /> Edit
              </button>
            ) : (
              <>
                <button className="pd-cancel-btn" onClick={() => { setEditing(false); setEditForm({ name: product.name, description: product.description, version: product.version, productType: product.productType, craCategory: product.craCategory, repoUrl: product.repoUrl, distributionModel: product.distributionModel || '', provider: product.provider || detectProvider(product.repoUrl), instanceUrl: product.instanceUrl || '' }); }}>
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
                  <option value="class_i">Class I (Important)</option>
                  <option value="class_ii">Class II (Critical)</option>
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
        {activeTab === 'overview' && <OverviewTab product={product} catInfo={catInfo} ghStatus={ghStatus} ghData={ghData} sbomData={sbomData} techFileProgress={techFileData.progress} versionHistory={versionHistory} syncHistory={syncHistory} syncStats={syncStats} pushEvents={pushEvents} onConnect={handleConnectGitHub} onSync={handleSync} syncing={syncing} onDisconnect={handleDisconnectGitHub} repoProvider={currentProvider} isProviderConnected={isProviderConnected} providerConnection={providerConnection} />}
        {activeTab === 'obligations' && <ObligationsTab product={product} />}
        {activeTab === 'technical-file' && <TechnicalFileTab productId={productId!} techFileData={techFileData} loading={techFileLoading} onUpdate={fetchTechFileData} />}
        {activeTab === 'activity' && <ActivityTab productId={product.id} />}
        {activeTab === 'risk-findings' && <RiskFindingsTab productId={product.id} />}
        {activeTab === 'dependencies' && <DependenciesTab ghData={ghData} sbomData={sbomData} sbomLoading={sbomLoading} onConnect={handleConnectGitHub} onSync={handleSync} syncing={syncing} onRefreshSBOM={handleRefreshSBOM} repoProvider={currentProvider} isProviderConnected={isProviderConnected} />}
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
    </>
  );
}

/* ── Overview Tab ─────────────────────────────────────── */
interface ChecklistStepPD {
  id: string;
  step: number;
  title: string;
  description: string;
  complete: boolean;
  actionLabel: string;
  actionTab: string | null;
  actionPath: string | null;
}

interface ProductChecklistPD {
  stepsComplete: number;
  stepsTotal: number;
  complete: boolean;
  deadlines: { id: string; label: string; date: string; daysRemaining: number }[];
  steps: ChecklistStepPD[];
}

function OverviewTab({ product, catInfo, ghStatus, ghData, sbomData: _sbomData, techFileProgress: _techFileProgress, versionHistory, syncHistory, syncStats, pushEvents, onConnect, onSync, syncing, onDisconnect, repoProvider, isProviderConnected, providerConnection }: {
  product: Product; catInfo: { label: string; color: string; desc: string };
  ghStatus: GitHubStatus; ghData: GitHubData; sbomData: SBOMData;
  techFileProgress: { total: number; completed: number; inProgress: number; notStarted: number };
  versionHistory: VersionEntry[];
  syncHistory: SyncHistoryEntry[];
  syncStats: SyncStats | null;
  pushEvents: PushEvent[];
  onConnect: (provider?: string) => void; onSync: () => void; syncing: boolean; onDisconnect: (provider?: string) => void;
  repoProvider: string;
  isProviderConnected: boolean;
  providerConnection?: RepoConnection;
}) {
  const pLabel = providerLabel(repoProvider);
  const [checklist, setChecklist] = useState<ProductChecklistPD | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    fetch(`/api/products/${product.id}/compliance-checklist`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setChecklist(d); })
      .catch(() => {});
  }, [product.id]);
  return (
    <div className="pd-overview-grid">
      {/* GitHub Repo Card — only if synced */}
      {ghData.synced && ghData.repo && (
        <div className="pd-card pd-card-github">
          <div className="pd-card-header">
            <ProviderIcon provider={repoProvider} size={18} />
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
          {/* Repo account info */}
          {isProviderConnected && (
            <div className="gh-account-row">
              {(providerConnection?.avatarUrl || ghStatus.githubAvatarUrl) && <img src={providerConnection?.avatarUrl || ghStatus.githubAvatarUrl || ''} alt="" className="gh-account-avatar" />}
              <span className="gh-account-name">Connected as {providerConnection?.username || ghStatus.githubUsername}</span>
              <button className="gh-disconnect-btn" onClick={() => onDisconnect(repoProvider)} title={`Disconnect ${pLabel}`}>
                <Unplug size={12} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Repo Connect Card — if not connected and has repoUrl */}
      {!isProviderConnected && product.repoUrl && (
        <div className="pd-card pd-card-connect">
          <div className="pd-card-header">
            <ProviderIcon provider={repoProvider} size={18} />
            <h3>Connect {pLabel}</h3>
          </div>
          <p className="gh-connect-desc">Connect your {pLabel} account to sync repository data, discover contributors, and analyse dependencies.</p>
          <button className="btn btn-primary gh-connect-btn" onClick={() => onConnect(repoProvider)}>
            <ProviderIcon provider={repoProvider} size={16} /> Connect {pLabel}
          </button>
          <p className="gh-connect-note">Read-only access — CRANIS2 will never write to your repositories.</p>
        </div>
      )}

      {/* Repo Sync Prompt — if connected but not synced */}
      {isProviderConnected && !ghData.synced && product.repoUrl && (
        <div className="pd-card pd-card-connect">
          <div className="pd-card-header">
            <ProviderIcon provider={repoProvider} size={18} />
            <h3>Sync Repository</h3>
          </div>
          <p className="gh-connect-desc">Your {pLabel} account is connected. Sync to pull repository metadata, contributors, and language data.</p>
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

      {pushEvents.length > 0 && (
        <div className="pd-card">
          <div className="pd-card-header">
            <Activity size={18} />
            <h3>Repo Activity</h3>
            <span className="pd-card-badge">{pushEvents.length} push{pushEvents.length !== 1 ? 'es' : ''}</span>
          </div>
          <div className="pd-activity-list">
            {pushEvents.slice(0, 8).map((ev) => (
              <div key={ev.id} className="pd-activity-item">
                <div className="pd-activity-top">
                  <span className="pd-activity-pusher">{ev.pusherName}</span>
                  {ev.branch && <span className="pd-activity-branch">{ev.branch}</span>}
                  <span className="pd-activity-commits">{ev.commitCount} commit{ev.commitCount !== 1 ? 's' : ''}</span>
                  <span className="pd-activity-time">{timeAgo(ev.createdAt)}</span>
                </div>
                {ev.headCommitMessage && (
                  <div className="pd-activity-message">{ev.headCommitMessage.split('\n')[0].slice(0, 120)}</div>
                )}
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

      {/* CRA Compliance Checklist Card */}
      <div className="pd-card pd-card-checklist">
        <div className="pd-card-header">
          <CheckCircle2 size={18} />
          <h3>CRA Compliance Checklist</h3>
          {checklist && (
            <span className="pd-cl-count">{checklist.stepsComplete}/{checklist.stepsTotal}</span>
          )}
        </div>

        {/* Deadlines */}
        {checklist && (
          <div className="pd-cl-deadlines">
            {checklist.deadlines.map(d => (
              <div key={d.id} className={`pd-cl-deadline ${d.daysRemaining < 180 ? 'urgent' : ''}`}>
                <span className="pd-cl-dl-days">{d.daysRemaining}d</span>
                <span className="pd-cl-dl-label">{d.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Steps */}
        <div className="pd-cl-steps">
          {checklist ? checklist.steps.map(step => {
            const navigate = (path: string) => window.location.assign(path);
            return (
              <div key={step.id} className={`pd-cl-step ${step.complete ? 'done' : 'todo'}`}>
                <div className="pd-cl-step-icon">
                  {step.complete
                    ? <CheckCircle2 size={15} style={{ color: 'var(--green)' }} />
                    : <Circle size={15} style={{ color: 'var(--border)' }} />
                  }
                </div>
                <div className="pd-cl-step-body">
                  <div className="pd-cl-step-title">{step.title}</div>
                  {!step.complete && (
                    <div className="pd-cl-step-desc">{step.description}</div>
                  )}
                </div>
                {!step.complete && (
                  <button
                    className="pd-cl-step-action"
                    onClick={() => {
                      if (step.actionPath) {
                        navigate(step.actionPath);
                      } else if (step.actionTab) {
                        window.history.pushState({}, '', `?tab=${step.actionTab}`);
                        window.dispatchEvent(new PopStateEvent('popstate'));
                      }
                    }}
                  >
                    {step.actionLabel} <ChevronRight size={11} />
                  </button>
                )}
              </div>
            );
          }) : (
            <div className="pd-cl-loading">
              <Loader2 size={14} className="spin" style={{ color: 'var(--muted)' }} />
              <span>Loading checklist…</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


/* ── Obligations Tab ─────────────────────────────────────── */
type ObligationRecord = {
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
};

const STATUS_ORDER: Record<string, number> = { not_started: 0, in_progress: 1, met: 2 };
function maxStatus(a: string, b: string | null): string {
  if (!b) return a;
  return (STATUS_ORDER[a] ?? 0) >= (STATUS_ORDER[b] ?? 0) ? a : b;
}

function ObligationsTab({ product }: { product: Product }) {
  const [obligations, setObligations] = useState<ObligationRecord[]>([]);
  const [obLoading, setObLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [exportingObl, setExportingObl] = useState<string | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savingNotes, setSavingNotes] = useState<string | null>(null);
  const [obAiSuggesting, setObAiSuggesting] = useState<string | null>(null);
  const [obShowUpgrade, setObShowUpgrade] = useState(false);
  const [obAiError, setObAiError] = useState<string | null>(null);
  const token = localStorage.getItem('session_token');

  async function handleExportObl(format: 'pdf' | 'csv') {
    setExportingObl(format);
    try {
      const res = await fetch(`/api/products/${product.id}/reports/obligations?format=${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.split('filename="')[1]?.replace('"', '') || `obligations-report.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export obligation report.');
    } finally {
      setExportingObl(null);
    }
  }

  async function fetchObligations() {
    try {
      const res = await fetch(`/api/obligations/${product.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setObligations(data.obligations);
      }
    } catch (err) {
      console.error('Failed to fetch obligations:', err);
    } finally {
      setObLoading(false);
    }
  }

  useEffect(() => { fetchObligations(); }, [product.id]);

  async function handleStatusChange(id: string, newStatus: string) {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/obligations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setObligations(prev => prev.map(o => o.id === id
          ? { ...o, status: newStatus, effectiveStatus: maxStatus(newStatus, o.derivedStatus) }
          : o));
      }
    } catch (err) {
      console.error('Failed to update obligation:', err);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleSaveNotes(ob: ObligationRecord) {
    setSavingNotes(ob.id);
    try {
      const res = await fetch(`/api/obligations/${ob.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notes: editingNotes[ob.id] ?? ob.notes }),
      });
      if (res.ok) {
        const updated = await res.json();
        setObligations(prev => prev.map(o => o.id === ob.id ? { ...o, notes: updated.notes ?? editingNotes[ob.id] ?? ob.notes } : o));
      }
    } catch (err) {
      console.error('Failed to save notes:', err);
    } finally {
      setSavingNotes(null);
    }
  }

  async function handleObAiSuggest(ob: ObligationRecord) {
    setObAiSuggesting(ob.id);
    setObAiError(null);
    setObShowUpgrade(false);
    try {
      const existingNotes = editingNotes[ob.id] ?? ob.notes;
      const res = await fetch('/api/copilot/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          productId: product.id,
          sectionKey: ob.obligationKey,
          type: 'obligation',
          existingContent: existingNotes || undefined,
        }),
      });

      if (res.status === 403) {
        const data = await res.json();
        if (data.error === 'feature_requires_plan') {
          setObShowUpgrade(true);
          return;
        }
      }
      if (!res.ok) throw new Error('Failed to generate suggestion');

      const data = await res.json();
      setEditingNotes(prev => ({ ...prev, [ob.id]: data.suggestion }));
      // Auto-expand notes if not already
      setExpandedNotes(ob.id);
    } catch (err: any) {
      setObAiError(err.message || 'AI suggestion failed');
    } finally {
      setObAiSuggesting(null);
    }
  }

  if (obLoading) {
    return <div className="pd-obligations"><p style={{ color: 'var(--muted)' }}>Loading obligations...</p></div>;
  }

  return (
    <div className="pd-obligations">
      <div className="pd-section-intro">
        <Shield size={20} />
        <div>
          <h3>CRA Obligations for {CATEGORY_INFO[product.craCategory]?.label || 'Default'} Products</h3>
          <p>These are the key regulatory obligations under the EU Cyber Resilience Act that apply to your product. Use the dropdown to set your manual compliance status, or let the platform auto-detect progress from your data.</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <button className="tf-doc-download-btn" onClick={() => handleExportObl('pdf')} disabled={!!exportingObl}>
          {exportingObl === 'pdf' ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
          {exportingObl === 'pdf' ? 'Generating...' : 'Export PDF'}
        </button>
        <button className="tf-doc-download-btn" onClick={() => handleExportObl('csv')} disabled={!!exportingObl}>
          {exportingObl === 'csv' ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
          {exportingObl === 'csv' ? 'Generating...' : 'Export CSV'}
        </button>
      </div>
      <p className="pd-ob-legend">
        <span className="pd-ob-legend-dot" /> Manual&nbsp;&nbsp;&nbsp;
        <span className="pd-ob-auto-badge">auto</span> Auto-detected from platform data
      </p>
      <div className="pd-obligations-list">
        {obligations.map((ob) => {
          const isAutoAdvanced = ob.derivedStatus && ob.effectiveStatus !== ob.status;
          const isPlatformConfirmed = ob.derivedStatus && ob.derivedStatus === ob.status && ob.status !== 'not_started';
          return (
            <div key={ob.id} className="pd-obligation-card">
              <div className="pd-obligation-header">
                <span className="pd-obligation-article">{ob.article}</span>
                <div className="pd-ob-status-group">
                  {isAutoAdvanced && (
                    <span
                      className="pd-ob-auto-badge"
                      title={ob.derivedReason || 'Auto-detected from platform data'}
                    >
                      auto: {ob.effectiveStatus === 'met' ? 'Met' : 'In Progress'}
                    </span>
                  )}
                  {isPlatformConfirmed && (
                    <span
                      className="pd-ob-confirmed"
                      title={ob.derivedReason || 'Confirmed by platform data'}
                    >✓ confirmed</span>
                  )}
                  <select
                    className={`pd-obligation-status status-${ob.status}`}
                    value={ob.status}
                    disabled={updatingId === ob.id}
                    onChange={e => handleStatusChange(ob.id, e.target.value)}
                    onClick={e => e.stopPropagation()}
                  >
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="met">Met</option>
                  </select>
                </div>
              </div>
              <h4>{ob.title}</h4>
              <p>{ob.description}</p>
              {ob.derivedReason && ob.derivedStatus && (
                <p className="pd-ob-derived-reason">{ob.derivedReason}</p>
              )}

              {/* Notes toggle + AI Suggest */}
              <div className="ob-notes-toggle-row">
                <button
                  className="ob-notes-toggle"
                  onClick={() => {
                    if (expandedNotes === ob.id) {
                      setExpandedNotes(null);
                    } else {
                      setExpandedNotes(ob.id);
                      if (editingNotes[ob.id] === undefined) {
                        setEditingNotes(prev => ({ ...prev, [ob.id]: ob.notes || '' }));
                      }
                    }
                  }}
                >
                  {expandedNotes === ob.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  Evidence Notes {ob.notes ? '(has content)' : ''}
                </button>
                <button
                  className="btn ai-suggest-btn ai-suggest-btn-sm"
                  onClick={() => handleObAiSuggest(ob)}
                  disabled={obAiSuggesting === ob.id}
                  title="Generate AI-drafted evidence notes (Pro plan)"
                >
                  {obAiSuggesting === ob.id
                    ? <Loader2 size={12} className="spin" />
                    : <Sparkles size={12} />}
                  {obAiSuggesting === ob.id ? 'Generating…' : 'AI Suggest'}
                </button>
              </div>

              {expandedNotes === ob.id && (
                <div className="ob-notes-editor">
                  {obAiSuggesting === ob.id && (
                    <div className="ai-suggesting-banner">
                      <Loader2 size={14} className="spin" />
                      <span>Generating evidence notes with AI…</span>
                    </div>
                  )}
                  {obShowUpgrade && expandedNotes === ob.id && (
                    <div className="ai-upgrade-banner">
                      <Info size={14} />
                      <span>AI Suggest requires the <strong>Pro</strong> plan. <a href="/billing">Upgrade now</a></span>
                    </div>
                  )}
                  {obAiError && expandedNotes === ob.id && (
                    <div className="ai-error-banner">
                      <AlertTriangle size={14} />
                      <span>{obAiError}</span>
                    </div>
                  )}
                  <textarea
                    className="ob-notes-textarea"
                    rows={5}
                    placeholder="Document how this obligation is met — evidence, references, compliance notes…"
                    value={editingNotes[ob.id] ?? ob.notes ?? ''}
                    onChange={(e) => setEditingNotes(prev => ({ ...prev, [ob.id]: e.target.value }))}
                  />
                  <div className="ob-notes-actions">
                    <button
                      className="btn btn-primary ob-notes-save"
                      onClick={() => handleSaveNotes(ob)}
                      disabled={savingNotes === ob.id}
                    >
                      {savingNotes === ob.id ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                      {savingNotes === ob.id ? 'Saving…' : 'Save Notes'}
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

/* ── Technical File Tab ─────────────────────────────────────── */
function TechnicalFileTab({ productId, techFileData, loading, onUpdate }: {
  productId: string; techFileData: TechFileData; loading: boolean; onUpdate: () => void;
}) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [downloadingDoc, setDownloadingDoc] = useState(false);
  const [downloadingCvd, setDownloadingCvd] = useState(false);
  const [editContent, setEditContent] = useState<Record<string, any>>({});
  const [editNotes, setEditNotes] = useState<Record<string, string>>({});
  const [editStatus, setEditStatus] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<any>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState<string | null>(null);
  const [autoFilledSections, setAutoFilledSections] = useState<Set<string>>(new Set());
  const [aiSuggesting, setAiSuggesting] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false);

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

  async function handleDownloadDoc() {
    setDownloadingDoc(true);
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
      a.download = res.headers.get('Content-Disposition')?.split('filename="')[1]?.replace('"', '') || 'eu-declaration-of-conformity.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to generate EU Declaration of Conformity. Please try again.');
    } finally {
      setDownloadingDoc(false);
    }
  }

  async function handleDownloadCvd() {
    setDownloadingCvd(true);
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`/api/technical-file/${productId}/cvd-policy/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.split('filename="')[1]?.replace('"', '') || 'cvd-policy.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to generate CVD Policy. Please try again.');
    } finally {
      setDownloadingCvd(false);
    }
  }

  // Sections that support auto-fill from platform data
  const AUTO_FILL_SECTIONS = ['product_description', 'vulnerability_handling', 'standards_applied', 'test_reports'];

  async function handleAutoFill(sectionKey: string) {
    setLoadingSuggestion(sectionKey);
    try {
      let data = suggestions;
      if (!data) {
        const token = localStorage.getItem('session_token');
        const res = await fetch(`/api/technical-file/${productId}/suggestions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch suggestions');
        data = await res.json();
        setSuggestions(data);
      }

      const sectionSuggestion = data?.sections?.[sectionKey];
      if (!sectionSuggestion) return;

      setEditContent(prev => {
        const current = prev[sectionKey] || {};

        if (sectionKey === 'product_description' || sectionKey === 'vulnerability_handling') {
          // Merge suggested fields — only populate empty values
          const currentFields = current.fields || {};
          const suggestedFields = sectionSuggestion.fields || {};
          const mergedFields = { ...currentFields };
          for (const [k, v] of Object.entries(suggestedFields)) {
            if (!mergedFields[k]) mergedFields[k] = v as string;
          }
          return { ...prev, [sectionKey]: { ...current, fields: mergedFields } };
        }

        if (sectionKey === 'standards_applied') {
          // Only apply if standards list is currently empty
          const currentStandards = current.standards || [];
          if (currentStandards.length === 0) {
            return { ...prev, [sectionKey]: { ...current, standards: sectionSuggestion.standards || [] } };
          }
          return prev;
        }

        if (sectionKey === 'test_reports') {
          // Only apply if reports list is currently empty
          const currentReports = current.reports || [];
          if (currentReports.length === 0) {
            return { ...prev, [sectionKey]: { ...current, reports: sectionSuggestion.reports || [] } };
          }
          return prev;
        }

        return prev;
      });

      setAutoFilledSections(prev => new Set([...prev, sectionKey]));
    } catch {
      // Silently ignore — auto-fill is best-effort
    } finally {
      setLoadingSuggestion(null);
    }
  }

  async function handleAiSuggest(sectionKey: string) {
    setAiSuggesting(sectionKey);
    setAiError(null);
    setShowUpgradeBanner(false);
    try {
      const token = localStorage.getItem('session_token');
      const existingContent = editContent[sectionKey] ? JSON.stringify(editContent[sectionKey]) : undefined;
      const res = await fetch('/api/copilot/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId, sectionKey, type: 'technical_file', existingContent }),
      });

      if (res.status === 403) {
        const data = await res.json();
        if (data.error === 'feature_requires_plan') {
          setShowUpgradeBanner(true);
          return;
        }
      }
      if (!res.ok) throw new Error('Failed to generate suggestion');

      const data = await res.json();
      const suggestion = data.suggestion;

      // Parse JSON response — the service returns structured JSON for tech file sections
      try {
        // Strip markdown code fences if present
        const cleaned = suggestion.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        const parsed = JSON.parse(cleaned);

        setEditContent(prev => {
          const current = prev[sectionKey] || {};

          if (parsed.fields) {
            // Sections with field structure (product_description, design_development, etc.)
            const currentFields = current.fields || {};
            const mergedFields = { ...currentFields };
            for (const [k, v] of Object.entries(parsed.fields)) {
              if (!mergedFields[k]) mergedFields[k] = v as string;
            }
            return { ...prev, [sectionKey]: { ...current, fields: mergedFields } };
          }
          if (parsed.standards) {
            const currentStandards = current.standards || [];
            if (currentStandards.length === 0) {
              return { ...prev, [sectionKey]: { ...current, standards: parsed.standards } };
            }
            return prev;
          }
          if (parsed.reports) {
            const currentReports = current.reports || [];
            if (currentReports.length === 0) {
              return { ...prev, [sectionKey]: { ...current, reports: parsed.reports } };
            }
            return prev;
          }

          // Direct field mapping (e.g. { intended_purpose: "...", ... })
          const currentFields = current.fields || {};
          const mergedFields = { ...currentFields };
          for (const [k, v] of Object.entries(parsed)) {
            if (typeof v === 'string' && !mergedFields[k]) mergedFields[k] = v;
          }
          return { ...prev, [sectionKey]: { ...current, fields: mergedFields } };
        });
      } catch {
        // If JSON parsing fails, put raw text into notes
        setEditNotes(prev => ({
          ...prev,
          [sectionKey]: prev[sectionKey] ? prev[sectionKey] + '\n\n' + suggestion : suggestion,
        }));
      }
    } catch (err: any) {
      setAiError(err.message || 'AI suggestion failed');
    } finally {
      setAiSuggesting(null);
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
                  <h4>{section.title} <HelpTip text={TECHFILE_HELP[section.sectionKey] || ''} /></h4>
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

                  {/* Auto-fill banner — shown after auto-fill is applied */}
                  {autoFilledSections.has(section.sectionKey) && (
                    <div className="tf-autofill-banner">
                      <Sparkles size={13} />
                      <span>Platform data auto-filled — review each field before saving.</span>
                    </div>
                  )}

                  {/* AI suggesting overlay */}
                  {aiSuggesting === section.sectionKey && (
                    <div className="ai-suggesting-banner">
                      <Loader2 size={14} className="spin" />
                      <span>Generating draft with AI — this may take a few seconds…</span>
                    </div>
                  )}

                  {/* Upgrade banner */}
                  {showUpgradeBanner && expandedSection === section.sectionKey && (
                    <div className="ai-upgrade-banner">
                      <Info size={14} />
                      <span>AI Suggest requires the <strong>Pro</strong> plan or higher. <a href="/billing">Upgrade now</a></span>
                    </div>
                  )}

                  {/* AI error message */}
                  {aiError && expandedSection === section.sectionKey && (
                    <div className="ai-error-banner">
                      <AlertTriangle size={14} />
                      <span>{aiError}</span>
                    </div>
                  )}

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

                  {/* Save button + action buttons */}
                  <div className="tf-actions">
                    <button
                      className="btn btn-primary tf-save-btn"
                      onClick={() => handleSave(section.sectionKey)}
                      disabled={saving === section.sectionKey}
                    >
                      {saving === section.sectionKey ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                      {saving === section.sectionKey ? 'Saving...' : 'Save Section'}
                    </button>
                    {AUTO_FILL_SECTIONS.includes(section.sectionKey) && (
                      <button
                        className="btn tf-autofill-btn"
                        onClick={() => handleAutoFill(section.sectionKey)}
                        disabled={loadingSuggestion === section.sectionKey}
                        title="Pre-fill empty fields using data already in the platform (non-destructive)"
                      >
                        {loadingSuggestion === section.sectionKey
                          ? <Loader2 size={14} className="spin" />
                          : <Sparkles size={14} />}
                        {loadingSuggestion === section.sectionKey ? 'Filling…' : 'Auto-fill'}
                      </button>
                    )}
                    <button
                      className="btn ai-suggest-btn"
                      onClick={() => handleAiSuggest(section.sectionKey)}
                      disabled={aiSuggesting === section.sectionKey}
                      title="Generate AI-drafted content using your product data (Pro plan)"
                    >
                      {aiSuggesting === section.sectionKey
                        ? <Loader2 size={14} className="spin" />
                        : <Sparkles size={14} />}
                      {aiSuggesting === section.sectionKey ? 'Generating…' : 'AI Suggest'}
                    </button>
                    {section.sectionKey === 'declaration_of_conformity' && (
                      <button
                        className="btn tf-doc-download-btn"
                        onClick={handleDownloadDoc}
                        disabled={downloadingDoc}
                        title="Download EU Declaration of Conformity as PDF"
                      >
                        {downloadingDoc ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                        {downloadingDoc ? 'Generating…' : 'Download EU DoC PDF'}
                      </button>
                    )}
                    {section.sectionKey === 'vulnerability_handling' && (
                      <button
                        className="btn tf-doc-download-btn"
                        onClick={handleDownloadCvd}
                        disabled={downloadingCvd}
                        title="Download Coordinated Vulnerability Disclosure policy as PDF"
                      >
                        {downloadingCvd ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                        {downloadingCvd ? 'Generating…' : 'Download CVD Policy'}
                      </button>
                    )}
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

/* ── Activity Tab ─────────────────────────────────────────── */

interface ActivityEntry {
  id: string;
  productId: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  oldValues: Record<string, any> | null;
  newValues: Record<string, any> | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

const ENTITY_ICONS: Record<string, typeof Shield> = {
  obligation: Shield,
  technical_file_section: FileText,
  product: Package,
  repository: GitBranch,
  stakeholder: Users,
  vulnerability_scan: AlertTriangle,
};

function activityDotClass(entityType: string): string {
  switch (entityType) {
    case 'obligation': return 'pal-dot-purple';
    case 'technical_file_section': return 'pal-dot-amber';
    case 'product':
    case 'stakeholder': return 'pal-dot-blue';
    case 'repository':
    case 'vulnerability_scan': return 'pal-dot-green';
    default: return 'pal-dot-blue';
  }
}

function formatDiffValue(val: any): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function ActivityTab({ productId }: { productId: string }) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [availableEntities, setAvailableEntities] = useState<string[]>([]);
  const limit = 50;
  const token = localStorage.getItem('session_token');

  const fetchActivities = async (newOffset: number, append: boolean) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(newOffset) });
      if (actionFilter) params.set('action', actionFilter);
      if (entityFilter) params.set('entity_type', entityFilter);
      const res = await fetch(`/api/products/${productId}/activity?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      if (append) {
        setActivities(prev => [...prev, ...data.activities]);
      } else {
        setActivities(data.activities);
      }
      setTotal(data.total);
      setOffset(newOffset);
      if (data.filters) {
        setAvailableActions(data.filters.actions || []);
        setAvailableEntities(data.filters.entityTypes || []);
      }
    } catch (err) {
      console.error('Failed to fetch activity:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => { fetchActivities(0, false); }, [productId, actionFilter, entityFilter]);

  const handleLoadMore = () => {
    fetchActivities(offset + limit, true);
  };

  const formatActionLabel = (action: string) =>
    action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const formatEntityLabel = (et: string) =>
    et.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  if (loading) {
    return (
      <div className="pd-placeholder">
        <Loader2 size={24} className="spin" />
        <h3>Loading activity…</h3>
      </div>
    );
  }

  return (
    <div className="pal-container">
      {/* Filters */}
      {(availableActions.length > 0 || availableEntities.length > 0) && (
        <div className="pal-filters">
          {availableActions.length > 0 && (
            <select
              className="pal-filter-select"
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
            >
              <option value="">All actions</option>
              {availableActions.map(a => (
                <option key={a} value={a}>{formatActionLabel(a)}</option>
              ))}
            </select>
          )}
          {availableEntities.length > 0 && (
            <select
              className="pal-filter-select"
              value={entityFilter}
              onChange={e => setEntityFilter(e.target.value)}
            >
              <option value="">All types</option>
              {availableEntities.map(et => (
                <option key={et} value={et}>{formatEntityLabel(et)}</option>
              ))}
            </select>
          )}
          <span className="pal-total">{total} event{total !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Timeline */}
      {activities.length === 0 ? (
        <div className="pd-placeholder">
          <Activity size={32} />
          <h3>No activity yet</h3>
          <p>Changes to obligations, technical file sections, scans, and other product data will appear here as an audit trail.</p>
        </div>
      ) : (
        <div className="pal-timeline">
          {activities.map(entry => {
            const Icon = ENTITY_ICONS[entry.entityType] || Activity;
            return (
              <div key={entry.id} className="pal-entry">
                <div className={`pal-dot ${activityDotClass(entry.entityType)}`}>
                  <Icon size={12} />
                </div>
                <div className="pal-entry-content">
                  <div className="pal-entry-header">
                    <span className="pal-summary">{entry.summary}</span>
                    <span className="pal-time">{timeAgo(entry.createdAt)}</span>
                  </div>
                  {entry.userEmail && (
                    <span className="pal-user">{entry.userEmail}</span>
                  )}
                  {(entry.oldValues || entry.newValues) && (
                    <div className="pal-diff">
                      {Object.keys({ ...entry.oldValues, ...entry.newValues }).map(key => {
                        const oldVal = entry.oldValues?.[key];
                        const newVal = entry.newValues?.[key];
                        if (oldVal === newVal) return null;
                        return (
                          <span key={key} className="pal-diff-item">
                            <span className="pal-diff-key">{key}:</span>
                            {oldVal !== undefined && (
                              <span className="pal-diff-old">{formatDiffValue(oldVal)}</span>
                            )}
                            {oldVal !== undefined && newVal !== undefined && (
                              <span className="pal-diff-arrow">→</span>
                            )}
                            {newVal !== undefined && (
                              <span className="pal-diff-new">{formatDiffValue(newVal)}</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {activities.length < total && (
        <div className="pal-load-more">
          <button className="pd-sync-btn" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? <><Loader2 size={14} className="spin" /> Loading…</> : <>Load more ({total - activities.length} remaining)</>}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Risk Findings Tab ─────────────────────────────────────── */
function RiskFindingsTab({ productId }: { productId: string }) {
  const [findings, setFindings] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [lastScan, setLastScan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [exportingVuln, setExportingVuln] = useState<string | null>(null);

  const token = localStorage.getItem('session_token');

  async function handleExportVuln(format: 'pdf' | 'csv') {
    setExportingVuln(format);
    try {
      const res = await fetch(`/api/products/${productId}/reports/vulnerabilities?format=${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.split('filename="')[1]?.replace('"', '') || `vuln-report.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export vulnerability report.');
    } finally {
      setExportingVuln(null);
    }
  }

  const fetchFindings = () => {
    fetch(`/api/risk-findings/${productId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setFindings(d.findings || []); setSummary(d.summary || null); setLastScan(d.lastScan || null); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchFindings(); }, [productId]);

  const handleScan = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const resp = await fetch(`/api/risk-findings/${productId}/scan`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (resp.status === 409) {
        // Already running — just poll the existing scan
        const existing = await resp.json();
        if (existing.scanId) {
          let done = false; let attempts = 0;
          while (!done && attempts < 60) {
            await new Promise(r => setTimeout(r, 3000));
            const poll = await fetch(`/api/risk-findings/scan/${existing.scanId}`, { headers: { Authorization: `Bearer ${token}` } });
            const pollData = await poll.json();
            if (pollData.status === 'completed' || pollData.status === 'failed') done = true;
            attempts++;
          }
        }
      } else {
        const result = await resp.json();
        if (result.scanId) {
          let done = false; let attempts = 0;
          while (!done && attempts < 60) {
            await new Promise(r => setTimeout(r, 3000));
            const poll = await fetch(`/api/risk-findings/scan/${result.scanId}`, { headers: { Authorization: `Bearer ${token}` } });
            const pollData = await poll.json();
            if (pollData.status === 'completed' || pollData.status === 'failed') done = true;
            attempts++;
          }
        }
      }
    } catch (err) { console.error('Scan failed', err); }
    setScanning(false);
    fetchFindings();
  };

  const handleDismiss = async (findingId: string) => {
    const reason = prompt('What action was taken to mitigate this vulnerability?');
    await fetch(`/api/risk-findings/${findingId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'dismissed', reason: reason || '' }),
    });
    fetchFindings();
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  if (loading) return <div className="pd-placeholder"><p>Loading risk findings...</p></div>;

  const severityColor: Record<string, string> = { critical: '#dc2626', high: '#f97316', medium: 'var(--amber)', low: '#3b82f6' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          {summary && (
            <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              {summary.total} findings ({summary.open} open{summary.resolved > 0 ? ', ' + summary.resolved + ' resolved' : ''}{summary.mitigated > 0 ? ', ' + summary.mitigated + ' mitigated' : ''}{summary.dismissed > 0 ? ', ' + summary.dismissed + ' dismissed' : ''})
              {summary.open > 0 ? <>&mdash;
              {summary.critical > 0 && <span style={{ color: '#dc2626', fontWeight: 600 }}> {summary.critical} critical</span>}
              {summary.high > 0 && <span style={{ color: '#f97316', fontWeight: 600 }}> {summary.high} high</span>}
              {summary.medium > 0 && <span style={{ color: 'var(--amber)' }}> {summary.medium} medium</span>}
              {summary.low > 0 && <span style={{ color: '#3b82f6' }}> {summary.low} low</span>}
              </> : summary.total > 0 ? <span style={{ color: 'var(--green)', fontWeight: 500 }}> &mdash; All findings handled</span> : null}
            </span>
          )}
          {lastScan && <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginLeft: '1rem' }}>Last scan: {new Date(lastScan.completed_at).toLocaleString()}</span>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="tf-doc-download-btn" onClick={() => handleExportVuln('pdf')} disabled={!!exportingVuln}>
            {exportingVuln === 'pdf' ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
            {exportingVuln === 'pdf' ? 'Generating...' : 'Export PDF'}
          </button>
          <button className="tf-doc-download-btn" onClick={() => handleExportVuln('csv')} disabled={!!exportingVuln}>
            {exportingVuln === 'csv' ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
            {exportingVuln === 'csv' ? 'Generating...' : 'Export CSV'}
          </button>
          <button onClick={handleScan} disabled={scanning}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 1rem', borderRadius: '6px', border: '1px solid var(--accent)', background: 'var(--accent)', color: '#fff', cursor: scanning ? 'not-allowed' : 'pointer', fontSize: '0.85rem', opacity: scanning ? 0.6 : 1 }}>
            {scanning ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
            {scanning ? 'Scanning...' : 'Scan Now'}
          </button>
        </div>
      </div>

      {findings.length === 0 && !lastScan && (
        <div className="pd-placeholder">
          <Shield size={48} strokeWidth={1} />
          <h3>No Risk Findings Yet</h3>
          <p>Click "Scan Now" to scan this product's dependencies against the local vulnerability database.</p>
        </div>
      )}

      {findings.length === 0 && lastScan && (
        <div className="pd-placeholder" style={{ color: 'var(--green)' }}>
          <Shield size={48} strokeWidth={1} />
          <h3>No Vulnerabilities Found</h3>
          <p>The last scan found no known vulnerabilities in your dependencies.</p>
        </div>
      )}

      {findings.map(f => (
        <div key={f.id} style={{ borderBottom: '1px solid var(--border)', padding: '0.6rem 0' }}>
          <div onClick={() => toggleExpand(f.id)} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
            <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '3px', fontWeight: 700, textTransform: 'uppercase' as const, background: `${severityColor[f.severity]}33`, color: severityColor[f.severity], minWidth: '55px', textAlign: 'center' as const }}>{f.severity}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text)' }}>{f.title.substring(0, 120)}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap' as const }}>
                <span>{f.source_id}</span>
                <span>{f.dependency_name}@{f.dependency_version}</span>
                {f.fixed_version && <span>Fix: {f.fixed_version}</span>}
                {f.status === 'dismissed' && <span style={{ color: 'var(--green)', fontWeight: 500 }}>✓ Dismissed</span>}
                {f.status === 'resolved' && <span style={{ color: 'var(--green)', fontWeight: 500 }}>✓ Resolved</span>}
                {f.status === 'mitigated' && <span style={{ color: 'var(--green)', fontWeight: 500 }}>✓ Mitigated</span>}
                {f.status === 'acknowledged' && <span style={{ color: 'var(--amber)', fontWeight: 500 }}>⚠ Acknowledged</span>}
              </div>
            </div>
            <span style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.25rem", color: "var(--accent)", cursor: "pointer" }}>{expandedIds.has(f.id) ? <><ChevronDown size={14} /> Close</> : <><ChevronRight size={14} /> View</>}</span>
          </div>
          {expandedIds.has(f.id) && (
            <div style={{ paddingLeft: '4rem', paddingTop: '0.5rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
              {f.mitigation && (
                <div style={{ background: 'rgba(100, 149, 237, 0.08)', border: '1px solid rgba(100, 149, 237, 0.2)', borderRadius: '6px', padding: '0.6rem 0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.3rem', textTransform: 'uppercase' as const }}>Recommended Action</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.5 }}>{f.mitigation}</div>
                </div>
              )}
              {!f.mitigation && f.fixed_version && (
                <div style={{ background: 'rgba(76, 175, 80, 0.08)', border: '1px solid rgba(76, 175, 80, 0.2)', borderRadius: '6px', padding: '0.6rem 0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--green)', marginBottom: '0.3rem', textTransform: 'uppercase' as const }}>Fix Available</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text)' }}>Upgrade {f.dependency_name} to version {f.fixed_version} or later.</div>
                </div>
              )}
              <p>{f.description?.substring(0, 500)}</p>
              {f.status === 'dismissed' && (<div style={{ background: 'rgba(76, 175, 80, 0.08)', border: '1px solid rgba(76, 175, 80, 0.2)', borderRadius: '6px', padding: '0.6rem 0.75rem', marginTop: '0.75rem' }}><div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--green)', marginBottom: '0.2rem' }}>✓ DISMISSED</div>{f.dismissed_reason && <div style={{ fontSize: '0.8rem', color: 'var(--text)' }}>{f.dismissed_reason}</div>}{f.dismissed_at && <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.2rem' }}>on {new Date(f.dismissed_at).toLocaleDateString()}</div>}</div>)}
              {f.status === 'resolved' && (<div style={{ background: 'rgba(76, 175, 80, 0.08)', border: '1px solid rgba(76, 175, 80, 0.2)', borderRadius: '6px', padding: '0.6rem 0.75rem', marginTop: '0.75rem' }}><div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--green)', marginBottom: '0.2rem' }}>✓ RESOLVED</div>{f.mitigation_notes && <div style={{ fontSize: '0.8rem', color: 'var(--text)' }}>{f.mitigation_notes}</div>}{f.resolved_at && <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.2rem' }}>on {new Date(f.resolved_at).toLocaleDateString()}</div>}</div>)}
              {f.status === 'mitigated' && (<div style={{ background: 'rgba(76, 175, 80, 0.08)', border: '1px solid rgba(76, 175, 80, 0.2)', borderRadius: '6px', padding: '0.6rem 0.75rem', marginTop: '0.75rem' }}><div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--green)', marginBottom: '0.2rem' }}>✓ MITIGATED</div>{f.mitigation_notes && <div style={{ fontSize: '0.8rem', color: 'var(--text)' }}>{f.mitigation_notes}</div>}</div>)}
              {(f.status === 'open' || f.status === 'acknowledged') && <button onClick={() => handleDismiss(f.id)} style={{ background: 'rgba(76, 175, 80, 0.1)', border: '1px solid rgba(76, 175, 80, 0.3)', color: 'var(--green)', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', marginTop: '0.75rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.3rem' }}><CheckCircle2 size={13} /> Mark as Mitigated</button>}
              <a href={"/vulnerability-reports?create=true&productId=" + productId + "&findingId=" + f.id} style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', color: 'var(--purple)', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', marginTop: '0.75rem', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}><Shield size={13} /> Report to ENISA</a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Dependencies Tab (with SBOM + Contributors + Languages) ───────── */
function DependenciesTab({ ghData, sbomData, sbomLoading, onConnect, onSync, syncing, onRefreshSBOM, repoProvider, isProviderConnected }: {
  ghData: GitHubData; sbomData: SBOMData; sbomLoading: boolean;
  onConnect: (provider?: string) => void; onSync: () => void; syncing: boolean; onRefreshSBOM: () => void;
  repoProvider: string;
  isProviderConnected: boolean;
}) {
  const pLabel = providerLabel(repoProvider);

  if (!isProviderConnected) {
    return (
      <div className="pd-placeholder">
        <ProviderIcon provider={repoProvider} size={48} />
        <h3>Connect {pLabel} to Discover Dependencies</h3>
        <p>Connect your {pLabel} account to scan the repository for dependencies, generate SBOMs, and identify contributors. The CRA requires a machine-readable SBOM (Article 13(11)).</p>
        <button className="btn btn-primary" onClick={() => onConnect(repoProvider)}>
          <ProviderIcon provider={repoProvider} size={18} /> Connect {pLabel}
        </button>
      </div>
    );
  }

  if (!ghData.synced) {
    return (
      <div className="pd-placeholder">
        <RefreshCw size={48} strokeWidth={1} />
        <h3>Sync Repository</h3>
        <p>Your {pLabel} account is connected. Sync the repository to generate the SBOM, discover languages, and identify contributors.</p>
        <button className="btn btn-primary" onClick={onSync} disabled={syncing}>
          {syncing ? <Loader2 size={18} className="spin" /> : <RefreshCw size={18} />}
          {syncing ? 'Syncing...' : 'Sync Repository'}
        </button>
      </div>
    );
  }

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showHashInfo, setShowHashInfo] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ totalDependencies: number; enrichedDependencies: number; enrichmentComplete: boolean; gaps?: { noVersion: number; unsupportedEcosystem: number; notFound: number; fetchError: number; pending: number }; lockfileResolved?: number; lastEnrichedAt?: string } | null>(null);
  const productId = useParams().productId;

  // Fetch hash enrichment status when SBOM is available
  useEffect(() => {
    if (sbomData.hasSBOM && productId) {
      const token = localStorage.getItem('session_token');
      fetch(`/api/sbom/${productId}/export/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setExportStatus(data); })
        .catch(() => {});
    }
  }, [sbomData.hasSBOM, productId]);

  async function handleExport(format: 'cyclonedx' | 'spdx') {
    setShowExportMenu(false);
    const token = localStorage.getItem('session_token');
    try {
      const res = await fetch(`/api/sbom/${productId}/export/${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Export failed');
        return;
      }
      const disposition = res.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `sbom-${format}.json`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export SBOM');
    }
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
              {exportStatus && (
                <div className="sbom-hash-info-wrapper">
                  <button className={`sbom-hash-badge ${exportStatus.enrichmentComplete ? 'hash-complete' : 'hash-partial'}`} onClick={() => setShowHashInfo(!showHashInfo)}>
                    {exportStatus.enrichmentComplete ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                    Hashes: {exportStatus.enrichedDependencies}/{exportStatus.totalDependencies}
                    <Info size={11} />
                  </button>
                  {showHashInfo && (
                    <div className="sbom-hash-info-panel">
                      <div className="sbom-hash-info-header">
                        <strong>SBOM Compliance Status</strong>
                        <button className="sbom-hash-info-close" onClick={() => setShowHashInfo(false)}><X size={14} /></button>
                      </div>
                      <p>CRA Article 13 requires SBOMs with cryptographic hashes for all components. <strong>{exportStatus.enrichedDependencies}</strong> of <strong>{exportStatus.totalDependencies}</strong> have verified hashes.</p>
                      {exportStatus.gaps && (Number(exportStatus.gaps.noVersion || 0) + Number(exportStatus.gaps.unsupportedEcosystem || 0) + Number(exportStatus.gaps.notFound || 0) + Number(exportStatus.gaps.fetchError || 0) + Number(exportStatus.gaps.pending || 0)) > 0 && (
                        <div className="gap-breakdown">
                          {exportStatus.gaps.noVersion > 0 && (
                            <div className="gap-row gap-warning">
                              <AlertTriangle size={13} />
                              <span><strong>{exportStatus.gaps.noVersion}</strong> missing version</span>
                              <span className="gap-action">Lockfile resolution recommended</span>
                            </div>
                          )}
                          {exportStatus.gaps.unsupportedEcosystem > 0 && (
                            <div className="gap-row gap-info">
                              <Info size={13} />
                              <span><strong>{exportStatus.gaps.unsupportedEcosystem}</strong> unsupported ecosystem</span>
                              <span className="gap-action">npm and PyPI supported</span>
                            </div>
                          )}
                          {exportStatus.gaps.notFound > 0 && (
                            <div className="gap-row gap-warning">
                              <AlertTriangle size={13} />
                              <span><strong>{exportStatus.gaps.notFound}</strong> not found in registry</span>
                              <span className="gap-action">May be private packages</span>
                            </div>
                          )}
                          {exportStatus.gaps.fetchError > 0 && (
                            <div className="gap-row gap-error">
                              <AlertTriangle size={13} />
                              <span><strong>{exportStatus.gaps.fetchError}</strong> registry errors</span>
                              <span className="gap-action">Will retry on next sync</span>
                            </div>
                          )}
                          {(exportStatus.gaps.pending ?? 0) > 0 && (
                            <div className="gap-row gap-info">
                              <Info size={13} />
                              <span><strong>{exportStatus.gaps.pending}</strong> pending enrichment</span>
                              <span className="gap-action">Will process on next sync</span>
                            </div>
                          )}
                        </div>
                      )}
                      {Number(exportStatus.lockfileResolved) > 0 && (
                        <div className="gap-row gap-success">
                          <CheckCircle2 size={13} />
                          <span><strong>{exportStatus.lockfileResolved}</strong> versions resolved from lockfile</span>
                        </div>
                      )}
                      <p>Hash coverage is noted in both CycloneDX and SPDX export metadata. Gaps are flagged as compliance risks.</p>
                    </div>
                  )}
                </div>
              )}
              <div className="sbom-export-dropdown">
                <button className="pd-sync-btn sbom-export-btn" onClick={() => setShowExportMenu(!showExportMenu)}>
                  <Download size={14} /> Export SBOM
                </button>
                {showExportMenu && (
                  <div className="sbom-export-menu">
                    <button onClick={() => handleExport('cyclonedx')}>CycloneDX 1.6 (JSON)</button>
                    <button onClick={() => handleExport('spdx')}>SPDX 2.3 (JSON)</button>
                  </div>
                )}
              </div>
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
          <p className="gh-connect-desc">
            No dependency data was found for this repository. Ensure the repository contains a lockfile
            (package-lock.json, yarn.lock, Pipfile.lock, poetry.lock, go.sum, Cargo.lock, or Gemfile.lock).
          </p>
          {repoProvider !== 'github' && (
            <div className="pd-codeberg-sbom-note">
              <Info size={14} />
              <span>{providerLabel(repoProvider)} repos use lockfile-based SBOM generation. If no lockfile is found, source imports will be scanned automatically. Push a lockfile for best results.</span>
            </div>
          )}
          <button className="pd-sync-btn" onClick={onRefreshSBOM} disabled={sbomLoading}>
            {sbomLoading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
            {repoProvider !== 'github' ? 'Generate SBOM' : 'Try Again'}
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

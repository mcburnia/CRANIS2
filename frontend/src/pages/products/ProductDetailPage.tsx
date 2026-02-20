import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

import PageHeader from '../../components/PageHeader';
import {
  ArrowLeft, Package, Shield, FileText, AlertTriangle, GitBranch,
  Edit3, Save, X, Cpu, Cloud, BookOpen, Monitor, Smartphone, Radio, Box,
  CheckCircle2, Clock, ChevronRight, Plus, ExternalLink
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

  useEffect(() => { fetchProduct(); }, [productId]);

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
          name: data.name,
          description: data.description || '',
          version: data.version || '',
          productType: data.productType || 'other',
          craCategory: data.craCategory || 'default',
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
              <span className="pd-date">Created {formatDate(product.createdAt)}</span>
              {product.updatedAt && product.updatedAt !== product.createdAt && (
                <span className="pd-date">Updated {formatDate(product.updatedAt)}</span>
              )}
            </div>
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
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pd-tab-content">
        {activeTab === 'overview' && <OverviewTab product={product} catInfo={catInfo} />}
        {activeTab === 'obligations' && <ObligationsTab product={product} />}
        {activeTab === 'technical-file' && <TechnicalFileTab />}
        {activeTab === 'risk-findings' && <RiskFindingsTab />}
        {activeTab === 'dependencies' && <DependenciesTab />}
      </div>
    </>
  );
}

/* ── Overview Tab ─────────────────────────────────────── */
function OverviewTab({ product, catInfo }: { product: Product; catInfo: { label: string; color: string; desc: string } }) {
  return (
    <div className="pd-overview-grid">
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
          <ProgressItem label="SBOM Generation" status="not_started" />
          <ProgressItem label="Conformity Assessment" status="not_started" />
          <ProgressItem label="EU Declaration of Conformity" status="not_started" />
        </div>
      </div>

      {/* Quick Actions Card */}
      <div className="pd-card">
        <div className="pd-card-header">
          <ChevronRight size={18} />
          <h3>Next Steps</h3>
        </div>
        <div className="pd-next-steps">
          <div className="pd-step">
            <div className="pd-step-num">1</div>
            <div>
              <div className="pd-step-title">Map CRA Obligations</div>
              <div className="pd-step-desc">Identify which CRA articles apply to this product based on its classification.</div>
            </div>
          </div>
          <div className="pd-step">
            <div className="pd-step-num">2</div>
            <div>
              <div className="pd-step-title">Connect Repositories</div>
              <div className="pd-step-desc">Link source code repositories to auto-discover dependencies and generate SBOMs.</div>
            </div>
          </div>
          <div className="pd-step">
            <div className="pd-step-num">3</div>
            <div>
              <div className="pd-step-title">Run Risk Assessment</div>
              <div className="pd-step-desc">Assess cybersecurity risks and document them as required by the CRA.</div>
            </div>
          </div>
          <div className="pd-step">
            <div className="pd-step-num">4</div>
            <div>
              <div className="pd-step-title">Prepare Technical File</div>
              <div className="pd-step-desc">Compile the technical documentation needed for conformity assessment.</div>
            </div>
          </div>
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
    base.push({
      article: 'Art. 32',
      title: 'Harmonised Standards',
      description: 'Where harmonised standards exist, conformity assessment shall reference them.',
      status: 'not_started',
    });
  }

  if (category === 'class_ii') {
    base.push({
      article: 'Art. 32(3)',
      title: 'Third-Party Assessment',
      description: 'Critical products require third-party conformity assessment by a notified body.',
      status: 'not_started',
    });
  }

  return base;
}

/* ── Technical File Tab ─────────────────────────────────────── */
function TechnicalFileTab() {
  const sections = [
    { title: 'General Description', desc: 'Description of the product including its intended purpose, version, and how it is made available on the market.', status: 'not_started' },
    { title: 'Design & Development Information', desc: 'Information on the design and development process of the product, including cybersecurity risk assessment.', status: 'not_started' },
    { title: 'Cybersecurity Risk Assessment', desc: 'Assessment of cybersecurity risks against which the product is designed, developed and produced.', status: 'not_started' },
    { title: 'Vulnerability Handling Documentation', desc: 'Description of the vulnerability handling process and evidence it will be ensured for the support period.', status: 'not_started' },
    { title: 'SBOM', desc: 'Software bill of materials documenting all components, libraries and dependencies used.', status: 'not_started' },
    { title: 'Test Reports', desc: 'Results of tests carried out to verify conformity with essential requirements.', status: 'not_started' },
    { title: 'EU Declaration of Conformity', desc: 'The formal declaration that the product meets all applicable CRA requirements.', status: 'not_started' },
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
            <div className="pd-techfile-status">
              <Clock size={16} style={{ color: 'var(--muted)' }} />
            </div>
            <div className="pd-techfile-content">
              <h4>{s.title}</h4>
              <p>{s.desc}</p>
            </div>
            <button className="pd-techfile-action" disabled>
              Start <ChevronRight size={14} />
            </button>
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
      <button className="btn btn-primary" disabled>
        <Plus size={18} /> Connect Repository
      </button>
    </div>
  );
}

/* ── Dependencies Tab ─────────────────────────────────────── */
function DependenciesTab() {
  return (
    <div className="pd-placeholder">
      <GitBranch size={48} strokeWidth={1} />
      <h3>No Dependencies Mapped</h3>
      <p>Connect a source code repository to auto-discover dependencies and generate an SBOM. The CRA requires a machine-readable SBOM covering at minimum the top-level dependencies.</p>
      <button className="btn btn-primary" disabled>
        <Plus size={18} /> Connect Repository
      </button>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import {
  Package, Plus, Trash2, ChevronRight, Cpu, Cloud,
  BookOpen, Smartphone, Monitor, Radio, Box
} from 'lucide-react';
import './ProductsPage.css';

interface Product {
  id: string;
  name: string;
  description: string;
  version: string;
  productType: string;
  craCategory: string;
  status: string;
  createdAt: string;
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

const CRA_CATEGORIES = [
  { value: 'default', label: 'Default', desc: 'Standard CRA obligations' },
  { value: 'class_i', label: 'Class I (Important)', desc: 'Important product with digital elements — self-assessment possible' },
  { value: 'class_ii', label: 'Class II (Critical)', desc: 'Critical product — third-party conformity assessment required' },
];

const TYPE_LABELS: Record<string, string> = Object.fromEntries(PRODUCT_TYPES.map(t => [t.value, t.label]));
const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  default: { label: 'Default', color: 'var(--accent)' },
  class_i: { label: 'Class I', color: 'var(--amber)' },
  class_ii: { label: 'Class II', color: 'var(--red)' },
};

function getTypeIcon(type: string) {
  const found = PRODUCT_TYPES.find(t => t.value === type);
  return found?.icon || Box;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formVersion, setFormVersion] = useState('');
  const [formType, setFormType] = useState('saas');
  const [formCategory, setFormCategory] = useState('default');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchProducts(); }, []);

  async function fetchProducts() {
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch('/api/products', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products);
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;
    setSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: formName, description: formDesc, version: formVersion, productType: formType, craCategory: formCategory }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to create product');
        setSubmitting(false);
        return;
      }

      setShowAdd(false);
      setFormName(''); setFormDesc(''); setFormVersion(''); setFormType('saas'); setFormCategory('default');
      await fetchProducts();
    } catch {
      setError('Network error');
    } finally { setSubmitting(false); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const token = localStorage.getItem('session_token');
    await fetch(`/api/products/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    await fetchProducts();
  }

  return (
    <>
      <PageHeader title="Products" />

      <div className="products-toolbar">
        <span className="products-count">{products.length} product{products.length !== 1 ? 's' : ''}</span>
        <button className="btn btn-primary products-add-btn" onClick={() => setShowAdd(true)}>
          <Plus size={18} /> Add Product
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading...</p>
      ) : products.length === 0 ? (
        <div className="products-empty">
          <Package size={48} strokeWidth={1} />
          <h3>No products yet</h3>
          <p>A CRA product is what you place on the EU market. Each product will be classified separately for compliance.</p>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={18} /> Add Your First Product
          </button>
        </div>
      ) : (
        <div className="products-grid">
          {products.map(p => {
            const TypeIcon = getTypeIcon(p.productType);
            const catInfo = CATEGORY_LABELS[p.craCategory] || CATEGORY_LABELS.default;
            return (
              <Link to={`/products/${p.id}`} key={p.id} className="product-card">
                <div className="product-card-top">
                  <div className="product-card-icon">
                    <TypeIcon size={22} />
                  </div>
                  <button
                    className="product-delete-btn"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(p.id, p.name); }}
                    title="Delete product"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="product-card-name">{p.name}</div>
                {p.description && <div className="product-card-desc">{p.description}</div>}
                <div className="product-card-meta">
                  <span className="product-type-badge">{TYPE_LABELS[p.productType] || p.productType}</span>
                  <span className="product-cra-badge" style={{ color: catInfo.color, borderColor: catInfo.color }}>{catInfo.label}</span>
                  {p.version && <span className="product-version">v{p.version}</span>}
                </div>
                <div className="product-card-footer">
                  <span className="product-card-date">Created {formatDate(p.createdAt)}</span>
                  <ChevronRight size={16} className="product-card-arrow" />
                </div>
              </Link>
            );
          })}

          <button className="product-card product-card-add" onClick={() => setShowAdd(true)}>
            <Plus size={32} strokeWidth={1.5} />
            <span>Add Product</span>
          </button>
        </div>
      )}

      {/* Add Product Modal */}
      {showAdd && createPortal(
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Add Product</h3>
            <p className="modal-subtitle">Define a product with digital elements that you place on the EU market.</p>

            {error && <div className="form-error" style={{ marginBottom: '1rem' }}>{error}</div>}

            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label className="form-label">Product Name <span style={{ color: 'var(--red)' }}>*</span></label>
                <input className="form-input" type="text" placeholder="e.g. Acme Platform" value={formName} onChange={e => setFormName(e.target.value)} autoFocus />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input" placeholder="What does this product do?" rows={3} value={formDesc} onChange={e => setFormDesc(e.target.value)} />
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Version</label>
                  <input className="form-input" type="text" placeholder="e.g. 2.1.0" value={formVersion} onChange={e => setFormVersion(e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Product Type</label>
                  <select className="form-input" value={formType} onChange={e => setFormType(e.target.value)}>
                    {PRODUCT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">CRA Category</label>
                <div className="cra-category-options">
                  {CRA_CATEGORIES.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      className={`cra-cat-btn ${formCategory === c.value ? 'selected' : ''}`}
                      onClick={() => setFormCategory(c.value)}
                    >
                      <span className="cra-cat-label">{c.label}</span>
                      <span className="cra-cat-desc">{c.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!formName.trim() || submitting}>
                  {submitting ? 'Creating...' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

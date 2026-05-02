/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

import { useState, useEffect } from 'react';
import PageHeader from '../../components/PageHeader';
import { Download, FileText, Loader2, Sparkles, X } from 'lucide-react';
import { usePageMeta } from '../../hooks/usePageMeta';
import './DocumentTemplatesPage.css';

interface DocumentTemplate {
  id: string;
  title: string;
  craArticle: string;
  description: string;
  techFileSection: string;
  filename: string;
}

interface Product {
  id: string;
  name: string;
}

function authHeaders() {
  const token = localStorage.getItem('session_token');
  return { Authorization: `Bearer ${token}` };
}

export default function DocumentTemplatesPage() {
  usePageMeta({ title: 'Document Templates' });
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Generate modal state
  const [generateModal, setGenerateModal] = useState<DocumentTemplate | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [versionFormat, setVersionFormat] = useState('');
  const [securitySuffix, setSecuritySuffix] = useState('-sec1');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch('/api/document-templates', { headers: authHeaders() })
      .then(r => r.json())
      .then(data => { setTemplates(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleDownload(template: DocumentTemplate) {
    setDownloading(template.id);
    try {
      const res = await fetch(`/api/document-templates/${template.id}/download`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Download failed');
      triggerDownload(res, template.filename);
    } catch (err) {
      console.error('Template download failed:', err);
    } finally {
      setDownloading(null);
    }
  }

  function openGenerateModal(template: DocumentTemplate) {
    setGenerateModal(template);
    setSelectedProduct('');
    setVersionFormat('');
    setSecuritySuffix('-sec1');
    if (products.length === 0) {
      setProductsLoading(true);
      fetch('/api/products', { headers: authHeaders() })
        .then(r => r.json())
        .then(data => {
          const list = (data.products || data || []).map((p: any) => ({ id: p.id, name: p.name }));
          setProducts(list);
          setProductsLoading(false);
        })
        .catch(() => setProductsLoading(false));
    }
  }

  async function handleGenerate() {
    if (!generateModal || !selectedProduct) return;
    setGenerating(true);
    try {
      const params = new URLSearchParams({ productId: selectedProduct });
      if (versionFormat) params.set('versionFormat', versionFormat);
      if (securitySuffix) params.set('securitySuffix', securitySuffix);

      const res = await fetch(
        `/api/document-templates/${generateModal.id}/generate?${params}`,
        { headers: authHeaders() }
      );
      if (!res.ok) throw new Error('Generation failed');
      const filename = generateModal.filename.replace('.md', '-generated.md');
      triggerDownload(res, filename);
      setGenerateModal(null);
    } catch (err) {
      console.error('Template generation failed:', err);
    } finally {
      setGenerating(false);
    }
  }

  async function triggerDownload(res: Response, filename: string) {
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="document-templates-page">
      <PageHeader title="Document Templates" />
      <p className="dt-intro">
        Download CRA compliance document templates to help meet your regulatory obligations.
        Use <strong>Download Template</strong> for a blank template with placeholders, or{' '}
        <strong>Generate for Product</strong> to auto-populate from your product data.
      </p>

      {loading ? (
        <div className="dt-loading"><Loader2 className="spin" size={20} /> Loading templates…</div>
      ) : templates.length === 0 ? (
        <div className="dt-empty">No templates available yet.</div>
      ) : (
        <div className="dt-grid">
          {templates.map(t => (
            <div key={t.id} className="dt-card">
              <div className="dt-card-icon"><FileText size={28} /></div>
              <div className="dt-card-body">
                <h3 className="dt-card-title">{t.title}</h3>
                <div className="dt-card-meta">
                  <span className="dt-badge dt-badge-article">{t.craArticle}</span>
                  <span className="dt-badge dt-badge-section">{t.techFileSection}</span>
                </div>
                <p className="dt-card-desc">{t.description}</p>
                <div className="dt-card-footer">
                  <span className="dt-card-format">Markdown (.md)</span>
                  <div className="dt-card-actions">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleDownload(t)}
                      disabled={downloading === t.id}
                    >
                      {downloading === t.id ? (
                        <><Loader2 size={14} className="spin" /> Downloading…</>
                      ) : (
                        <><Download size={14} /> Download Template</>
                      )}
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => openGenerateModal(t)}
                    >
                      <Sparkles size={14} /> Generate for Product
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Generate Modal */}
      {generateModal && (
        <div className="dt-modal-backdrop" onClick={() => setGenerateModal(null)}>
          <div className="dt-modal" onClick={e => e.stopPropagation()}>
            <div className="dt-modal-header">
              <h3>Generate: {generateModal.title}</h3>
              <button className="dt-modal-close" onClick={() => setGenerateModal(null)}>
                <X size={18} />
              </button>
            </div>
            <p className="dt-modal-desc">
              Select a product to auto-populate the template with your organisation and product
              data. Stakeholder roles will be mapped from your Stakeholders page. Fields that
              cannot be auto-filled will be marked with [REVIEW].
            </p>

            <div className="dt-modal-field">
              <label>Product</label>
              {productsLoading ? (
                <div className="dt-loading"><Loader2 className="spin" size={14} /> Loading products…</div>
              ) : (
                <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
                  <option value="">Select a product…</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="dt-modal-field">
              <label>Version format <span className="dt-optional">(optional: auto-detected if blank)</span></label>
              <input
                type="text"
                value={versionFormat}
                onChange={e => setVersionFormat(e.target.value)}
                placeholder="e.g. MAJOR.MINOR.PATCH or YYYY.MM.DD.NNNN"
              />
            </div>

            <div className="dt-modal-field">
              <label>Security release suffix</label>
              <input
                type="text"
                value={securitySuffix}
                onChange={e => setSecuritySuffix(e.target.value)}
                placeholder="-sec1"
              />
            </div>

            <div className="dt-modal-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setGenerateModal(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleGenerate}
                disabled={!selectedProduct || generating}
              >
                {generating ? (
                  <><Loader2 size={14} className="spin" /> Generating…</>
                ) : (
                  <><Sparkles size={14} /> Generate &amp; Download</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

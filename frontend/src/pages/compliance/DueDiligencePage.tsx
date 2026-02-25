import { useState, useEffect, useCallback } from 'react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import {
  Download, FileBarChart2, Shield, Scale, AlertTriangle,
  Fingerprint, CheckCircle2, XCircle, Loader2, ChevronRight
} from 'lucide-react';
import './DueDiligencePage.css';

interface Product {
  id: string;
  name: string;
}

interface PreviewData {
  product: { id: string; name: string; version: string | null; description: string | null; craCategory: string | null };
  organisation: { name: string; country: string | null; website: string | null; contactEmail: string | null };
  dependencies: { total: number; direct: number; transitive: number };
  licenseScan: {
    totalDeps: number; permissiveCount: number; copyleftCount: number; unknownCount: number;
    criticalCount: number; permissivePercent: number; scannedAt: string | null;
  } | null;
  licenseFindings: Array<{
    dependencyName: string; dependencyVersion: string; licenseDeclared: string;
    licenseCategory: string; riskLevel: string; dependencyDepth: string; status: string;
  }>;
  vulnerabilities: { critical: number; high: number; medium: number; low: number; open: number; mitigated: number; total: number };
  ipProof: { contentHash: string; verified: boolean; createdAt: string } | null;
  obligations: Array<{ key: string; status: string }>;
  productVersion: string | null;
  generatedAt: string;
}

export default function DueDiligencePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  // Fetch products on mount
  useEffect(() => {
    fetch('/api/products', { headers })
      .then(r => r.json())
      .then(data => setProducts(data.products || []))
      .catch(() => {});
  }, []);

  // Load preview when product is selected
  const loadPreview = useCallback(async (productId: string) => {
    if (!productId) { setPreview(null); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/due-diligence/${productId}/preview`, { headers });
      if (!res.ok) throw new Error('Failed to load preview');
      const data = await res.json();
      setPreview(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load preview');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleProductChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setSelectedProduct(id);
    loadPreview(id);
  }

  async function handleExport() {
    if (!selectedProduct) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/due-diligence/${selectedProduct}/export`, { headers });
      if (!res.ok) throw new Error('Failed to generate report');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('Content-Disposition');
      a.download = disposition?.split('filename=')[1]?.replace(/"/g, '') || 'due-diligence.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  const nonPermissive = preview?.licenseFindings.filter(f => f.riskLevel !== 'ok') || [];
  const oblMet = preview?.obligations.filter(o => o.status === 'met').length || 0;
  const oblTotal = preview?.obligations.length || 0;
  const oblPct = oblTotal > 0 ? Math.round((oblMet / oblTotal) * 100) : 0;

  return (
    <>
      <PageHeader title="Due Diligence Report" timestamp="Investor Package" />

      {/* Product selector + export button */}
      <div className="dd-actions">
        <div className="dd-product-select">
          <label htmlFor="dd-product">Select product</label>
          <select id="dd-product" value={selectedProduct} onChange={handleProductChange}>
            <option value="">Choose a product...</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {preview && (
          <button className="dd-export-btn" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 size={16} className="dd-spin" /> : <Download size={16} />}
            {exporting ? 'Generating...' : 'Download Due Diligence Package'}
          </button>
        )}
      </div>

      {error && <div className="dd-error">{error}</div>}

      {/* Loading state */}
      {loading && (
        <div className="dd-loading">
          <Loader2 size={24} className="dd-spin" />
          <span>Loading report data...</span>
        </div>
      )}

      {/* Empty state */}
      {!selectedProduct && !loading && (
        <div className="dd-empty-state">
          <FileBarChart2 size={48} />
          <h3>Due Diligence Report</h3>
          <p>
            Select a product to generate an investor-ready compliance report. The report package includes
            a PDF summary, software bill of materials, licence findings, and vulnerability assessment.
          </p>
        </div>
      )}

      {/* Preview */}
      {preview && !loading && (
        <div className="dd-preview">
          {/* Stat cards */}
          <div className="stats">
            <StatCard
              label="Dependencies"
              value={preview.dependencies.total}
              sub={`${preview.dependencies.direct} direct, ${preview.dependencies.transitive} transitive`}
              color="blue"
            />
            <StatCard
              label="Permissive"
              value={preview.licenseScan ? `${preview.licenseScan.permissivePercent}%` : 'N/A'}
              sub={preview.licenseScan ? `${preview.licenseScan.permissiveCount} of ${preview.licenseScan.totalDeps}` : 'No scan'}
              color="green"
            />
            <StatCard
              label="Open Vulnerabilities"
              value={preview.vulnerabilities.open}
              sub={`${preview.vulnerabilities.total} total findings`}
              color={preview.vulnerabilities.critical > 0 ? 'red' : preview.vulnerabilities.open > 0 ? 'amber' : 'green'}
            />
            <StatCard
              label="CRA Compliance"
              value={oblTotal > 0 ? `${oblPct}%` : 'N/A'}
              sub={oblTotal > 0 ? `${oblMet} of ${oblTotal} met` : 'No obligations set'}
              color={oblPct === 100 ? 'green' : oblPct > 50 ? 'amber' : 'red'}
            />
          </div>

          {/* Report contents preview */}
          <div className="dd-contents">
            <h3 className="dd-section-title">Report Contents</h3>
            <p className="dd-section-desc">The downloaded ZIP package will include the following:</p>

            <div className="dd-contents-grid">
              {/* PDF Report */}
              <div className="dd-content-card">
                <div className="dd-content-icon"><FileBarChart2 size={20} /></div>
                <div>
                  <strong>Due Diligence Report (PDF)</strong>
                  <p>Executive summary, dependency inventory, licence compliance, vulnerability posture, IP proof status, and CRA compliance progress.</p>
                </div>
              </div>

              {/* Licence Compliance */}
              <div className="dd-content-card">
                <div className="dd-content-icon"><Scale size={20} /></div>
                <div>
                  <strong>Licence Findings (CSV)</strong>
                  <p>
                    {preview.licenseFindings.length} dependencies classified.
                    {nonPermissive.length > 0
                      ? ` ${nonPermissive.length} non-permissive findings requiring review.`
                      : ' All permissive — no restrictions on distribution.'}
                  </p>
                </div>
              </div>

              {/* Vulnerability Summary */}
              <div className="dd-content-card">
                <div className="dd-content-icon"><AlertTriangle size={20} /></div>
                <div>
                  <strong>Vulnerability Summary (JSON)</strong>
                  <p>
                    {preview.vulnerabilities.total > 0
                      ? `${preview.vulnerabilities.critical} critical, ${preview.vulnerabilities.high} high, ${preview.vulnerabilities.medium} medium, ${preview.vulnerabilities.low} low.`
                      : 'No vulnerability findings recorded.'}
                  </p>
                </div>
              </div>

              {/* SBOM */}
              <div className="dd-content-card">
                <div className="dd-content-icon"><Shield size={20} /></div>
                <div>
                  <strong>Software Bill of Materials (CycloneDX 1.6)</strong>
                  <p>Machine-readable dependency inventory with hashes, licences, and supplier data.</p>
                </div>
              </div>

              {/* IP Proof */}
              <div className="dd-content-card">
                <div className="dd-content-icon"><Fingerprint size={20} /></div>
                <div>
                  <strong>IP Proof Status</strong>
                  <p>
                    {preview.ipProof
                      ? `RFC 3161 timestamp — ${preview.ipProof.verified ? 'verified' : 'unverified'}, created ${new Date(preview.ipProof.createdAt).toLocaleDateString('en-GB')}.`
                      : 'No IP proof snapshot available.'}
                  </p>
                </div>
              </div>

              {/* Licence Texts */}
              <div className="dd-content-card">
                <div className="dd-content-icon"><Scale size={20} /></div>
                <div>
                  <strong>Full Licence Texts</strong>
                  <p>
                    {nonPermissive.length > 0
                      ? `Full text included for ${new Set(nonPermissive.map(f => f.licenseDeclared)).size} non-permissive licences.`
                      : 'No non-permissive licences — no texts needed.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Non-permissive findings table */}
          {nonPermissive.length > 0 && (
            <div className="dd-section">
              <h3 className="dd-section-title">Non-Permissive Dependencies</h3>
              <div className="dd-table-wrapper">
                <table className="dd-table">
                  <thead>
                    <tr>
                      <th>Dependency</th>
                      <th>Licence</th>
                      <th>Risk</th>
                      <th>Depth</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nonPermissive.slice(0, 20).map((f, i) => (
                      <tr key={i}>
                        <td>{f.dependencyName}@{f.dependencyVersion}</td>
                        <td>{f.licenseDeclared}</td>
                        <td>
                          <span className={`dd-risk-badge dd-risk-${f.riskLevel}`}>
                            {f.riskLevel === 'critical' ? <XCircle size={12} /> : <AlertTriangle size={12} />}
                            {f.riskLevel}
                          </span>
                        </td>
                        <td>
                          <span className={`dd-depth-badge dd-depth-${f.dependencyDepth}`}>
                            {f.dependencyDepth}
                          </span>
                        </td>
                        <td>
                          <span className={`dd-status-badge dd-status-${f.status}`}>
                            {f.status === 'waived' && <CheckCircle2 size={12} />}
                            {f.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {nonPermissive.length > 20 && (
                  <div className="dd-table-more">
                    + {nonPermissive.length - 20} more in the full report
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Obligations summary */}
          {preview.obligations.length > 0 && (
            <div className="dd-section">
              <h3 className="dd-section-title">CRA Obligations</h3>
              <div className="dd-obligations">
                {preview.obligations.map((obl, i) => (
                  <div key={i} className={`dd-obligation dd-obl-${obl.status}`}>
                    <span className="dd-obl-icon">
                      {obl.status === 'met' ? <CheckCircle2 size={14} /> :
                       obl.status === 'in_progress' ? <ChevronRight size={14} /> :
                       <XCircle size={14} />}
                    </span>
                    <span className="dd-obl-label">
                      {obl.key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                    <span className="dd-obl-status">{obl.status.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

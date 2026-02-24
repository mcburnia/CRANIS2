import { useState, useEffect } from 'react';
import { Scale, RefreshCw, ChevronDown, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import './LicenseCompliancePage.css';

interface ProductSummary {
  productId: string;
  productName: string;
  totalDeps: number;
  permissiveCount: number;
  copyleftCount: number;
  unknownCount: number;
  criticalCount: number;
  directCount: number;
  transitiveCount: number;
  openFindings: number;
  lastScanAt: string | null;
  scanStatus: string;
}

interface Totals {
  totalDeps: number;
  permissiveCount: number;
  copyleftCount: number;
  unknownCount: number;
  criticalCount: number;
  directCount: number;
  transitiveCount: number;
  permissivePercent: number;
  productCount: number;
  scannedCount: number;
}

interface Finding {
  id: string;
  dependency_purl: string;
  dependency_name: string;
  dependency_version: string;
  license_declared: string;
  license_category: string;
  risk_level: string;
  risk_reason: string;
  dependency_depth: string | null;
  status: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  waiver_reason: string | null;
}

interface LatestScan {
  id: string;
  total_deps: number;
  permissive_count: number;
  copyleft_count: number;
  unknown_count: number;
  critical_count: number;
  direct_count: number;
  transitive_count: number;
  completed_at: string;
  duration_ms: number;
}

const getToken = () => localStorage.getItem('session_token');

export default function LicenseCompliancePage() {
  const [totals, setTotals] = useState<Totals | null>(null);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [latestScan, setLatestScan] = useState<LatestScan | null>(null);
  const [findingsLoading, setFindingsLoading] = useState(false);
  const [scanningProduct, setScanningProduct] = useState<string | null>(null);
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [waiverModal, setWaiverModal] = useState<{ findingId: string; name: string } | null>(null);
  const [waiverReason, setWaiverReason] = useState('');

  useEffect(() => {
    fetchOverview();
  }, []);

  async function fetchOverview() {
    try {
      const res = await fetch('/api/license-scan/overview', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setTotals(data.totals);
      setProducts(data.products);
    } catch (err) {
      console.error('Failed to fetch license overview:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchFindings(productId: string) {
    setFindingsLoading(true);
    try {
      const params = riskFilter !== 'all' ? `?risk=${riskFilter}` : '';
      const res = await fetch(`/api/license-scan/${productId}${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setFindings(data.findings);
      setLatestScan(data.latestScan);
    } catch (err) {
      console.error('Failed to fetch findings:', err);
    } finally {
      setFindingsLoading(false);
    }
  }

  async function triggerScan(productId: string) {
    setScanningProduct(productId);
    try {
      const res = await fetch(`/api/license-scan/${productId}/scan`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.status === 409) return;
      if (!res.ok) throw new Error('Failed to trigger scan');
      await fetchOverview();
      if (expandedProduct === productId) {
        await fetchFindings(productId);
      }
    } catch (err) {
      console.error('Failed to trigger scan:', err);
    } finally {
      setScanningProduct(null);
    }
  }

  async function updateFindingStatus(findingId: string, status: string, reason?: string) {
    try {
      const res = await fetch(`/api/license-scan/finding/${findingId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, waiverReason: reason }),
      });
      if (!res.ok) throw new Error('Failed to update');
      if (expandedProduct) await fetchFindings(expandedProduct);
    } catch (err) {
      console.error('Failed to update finding:', err);
    }
  }

  function toggleProduct(productId: string) {
    if (expandedProduct === productId) {
      setExpandedProduct(null);
      setFindings([]);
    } else {
      setExpandedProduct(productId);
      setRiskFilter('all');
      fetchFindings(productId);
    }
  }

  useEffect(() => {
    if (expandedProduct) fetchFindings(expandedProduct);
  }, [riskFilter]);

  function categoryBadge(category: string) {
    const map: Record<string, { label: string; className: string }> = {
      permissive: { label: 'Permissive', className: 'lc-badge lc-badge-green' },
      copyleft_strong: { label: 'Copyleft (Strong)', className: 'lc-badge lc-badge-red' },
      copyleft_weak: { label: 'Copyleft (Weak)', className: 'lc-badge lc-badge-amber' },
      unknown: { label: 'Unknown', className: 'lc-badge lc-badge-muted' },
      no_assertion: { label: 'No License', className: 'lc-badge lc-badge-muted' },
    };
    const info = map[category] || { label: category, className: 'lc-badge lc-badge-muted' };
    return <span className={info.className}>{info.label}</span>;
  }

  function riskBadge(risk: string) {
    const map: Record<string, { label: string; className: string }> = {
      critical: { label: 'Critical', className: 'lc-risk lc-risk-critical' },
      warning: { label: 'Warning', className: 'lc-risk lc-risk-warning' },
      ok: { label: 'OK', className: 'lc-risk lc-risk-ok' },
    };
    const info = map[risk] || { label: risk, className: 'lc-risk' };
    return <span className={info.className}>{info.label}</span>;
  }

  function depthBadge(depth: string | null) {
    if (!depth || depth === 'unknown') return <span className="lc-depth lc-depth-unknown">—</span>;
    if (depth === 'direct') return <span className="lc-depth lc-depth-direct">Direct</span>;
    return <span className="lc-depth lc-depth-transitive">Transitive</span>;
  }

  if (loading) return <div className="lc-page"><div className="lc-loading">Loading license data...</div></div>;

  return (
    <div className="lc-page">
      <PageHeader title="License Compliance" />

      <div className="lc-info-banner">
        <Scale size={18} />
        <div>
          <strong>Dependency License Scanning</strong> — Analyses SPDX license declarations from your SBOM to detect copyleft licenses (GPL, AGPL) that could require source code disclosure, and flags undeclared licenses for review.
        </div>
      </div>

      {totals && (
        <div className="stats">
          <StatCard
            label="Total Dependencies"
            value={totals.totalDeps}
            color="blue"
            sub={totals.directCount > 0 ? `${totals.directCount} direct, ${totals.transitiveCount} transitive` : undefined}
          />
          <StatCard label="Permissive" value={`${totals.permissivePercent}%`} color="green" sub={`${totals.permissiveCount} deps`} />
          <StatCard label="Copyleft Issues" value={totals.copyleftCount} color="red" sub={totals.criticalCount > 0 ? `${totals.criticalCount} critical` : 'None critical'} />
          <StatCard label="Unknown Licenses" value={totals.unknownCount} color="amber" sub="Need review" />
        </div>
      )}

      <div className="lc-products">
        <h3>Products</h3>
        {products.length === 0 ? (
          <div className="lc-empty">No products found. Add a product and sync its GitHub repository to see license data.</div>
        ) : (
          <table className="lc-table">
            <thead>
              <tr>
                <th></th>
                <th>Product</th>
                <th>Dependencies</th>
                <th>Direct</th>
                <th>Transitive</th>
                <th>Permissive</th>
                <th>Copyleft</th>
                <th>Unknown</th>
                <th>Critical</th>
                <th>Last Scan</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <>{/* Fragment for product row + expansion */}
                  <tr key={p.productId} className={`lc-product-row ${expandedProduct === p.productId ? 'lc-expanded' : ''}`} onClick={() => toggleProduct(p.productId)}>
                    <td className="lc-expand-icon">
                      {expandedProduct === p.productId ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </td>
                    <td className="lc-product-name">{p.productName}</td>
                    <td>{p.totalDeps || '—'}</td>
                    <td className="lc-cell-blue">{p.directCount || '—'}</td>
                    <td className="lc-cell-muted">{p.transitiveCount || '—'}</td>
                    <td className="lc-cell-green">{p.permissiveCount || '—'}</td>
                    <td className={p.copyleftCount > 0 ? 'lc-cell-red' : ''}>{p.copyleftCount || '—'}</td>
                    <td className={p.unknownCount > 0 ? 'lc-cell-amber' : ''}>{p.unknownCount || '—'}</td>
                    <td className={p.criticalCount > 0 ? 'lc-cell-red lc-cell-bold' : ''}>{p.criticalCount || '—'}</td>
                    <td className="lc-cell-muted">{p.lastScanAt ? new Date(p.lastScanAt).toLocaleDateString() : 'Never'}</td>
                    <td>
                      <button
                        className="lc-scan-btn"
                        onClick={(e) => { e.stopPropagation(); triggerScan(p.productId); }}
                        disabled={scanningProduct === p.productId}
                      >
                        <RefreshCw size={14} className={scanningProduct === p.productId ? 'lc-spinning' : ''} />
                        {scanningProduct === p.productId ? 'Scanning...' : 'Scan'}
                      </button>
                    </td>
                  </tr>
                  {expandedProduct === p.productId && (
                    <tr key={`${p.productId}-detail`}>
                      <td colSpan={11} className="lc-findings-cell">
                        <div className="lc-findings-panel">
                          <div className="lc-findings-header">
                            <h4>License Findings — {p.productName}</h4>
                            <div className="lc-filter-pills">
                              {['all', 'critical', 'warning', 'ok'].map(f => (
                                <button
                                  key={f}
                                  className={`lc-pill ${riskFilter === f ? 'lc-pill-active' : ''}`}
                                  onClick={() => setRiskFilter(f)}
                                >
                                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                                </button>
                              ))}
                            </div>
                          </div>

                          {latestScan && (
                            <div className="lc-scan-info">
                              Last scan: {new Date(latestScan.completed_at).toLocaleString()} — {latestScan.total_deps} deps ({latestScan.direct_count || 0} direct, {latestScan.transitive_count || 0} transitive) in {latestScan.duration_ms}ms
                            </div>
                          )}

                          {findingsLoading ? (
                            <div className="lc-loading">Loading findings...</div>
                          ) : findings.length === 0 ? (
                            <div className="lc-empty">No findings{riskFilter !== 'all' ? ` for "${riskFilter}" filter` : ''}. Run a scan to analyse licenses.</div>
                          ) : (
                            <table className="lc-findings-table">
                              <thead>
                                <tr>
                                  <th>Dependency</th>
                                  <th>Version</th>
                                  <th>Depth</th>
                                  <th>License</th>
                                  <th>Category</th>
                                  <th>Risk</th>
                                  <th>Status</th>
                                  <th>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {findings.map(finding => (
                                  <tr key={finding.id} className={finding.risk_level === 'critical' ? 'lc-row-critical' : finding.risk_level === 'warning' ? 'lc-row-warning' : ''}>
                                    <td className="lc-dep-name">{finding.dependency_name}</td>
                                    <td className="lc-dep-version">{finding.dependency_version || '—'}</td>
                                    <td>{depthBadge(finding.dependency_depth)}</td>
                                    <td className="lc-dep-license">{finding.license_declared || 'NOASSERTION'}</td>
                                    <td>{categoryBadge(finding.license_category)}</td>
                                    <td>{riskBadge(finding.risk_level)}</td>
                                    <td>
                                      {finding.status === 'open' && <span className="lc-status lc-status-open">Open</span>}
                                      {finding.status === 'acknowledged' && <span className="lc-status lc-status-ack"><CheckCircle2 size={12} /> Acknowledged</span>}
                                      {finding.status === 'waived' && <span className="lc-status lc-status-waived"><XCircle size={12} /> Waived</span>}
                                    </td>
                                    <td className="lc-actions">
                                      {finding.status === 'open' && (
                                        <>
                                          <button className="lc-action-btn lc-ack" onClick={() => updateFindingStatus(finding.id, 'acknowledged')}>Acknowledge</button>
                                          <button className="lc-action-btn lc-waive" onClick={() => { setWaiverModal({ findingId: finding.id, name: finding.dependency_name }); setWaiverReason(''); }}>Waive</button>
                                        </>
                                      )}
                                      {(finding.status === 'acknowledged' || finding.status === 'waived') && (
                                        <button className="lc-action-btn lc-reopen" onClick={() => updateFindingStatus(finding.id, 'open')}>Reopen</button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {waiverModal && (
        <div className="lc-modal-overlay" onClick={() => setWaiverModal(null)}>
          <div className="lc-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Waive License Finding</h3>
            <p>Waiving <strong>{waiverModal.name}</strong> — provide a reason for the waiver:</p>
            <textarea
              className="lc-waiver-textarea"
              value={waiverReason}
              onChange={(e) => setWaiverReason(e.target.value)}
              placeholder="e.g. Approved by legal team, not distributed as standalone..."
              rows={3}
            />
            <div className="lc-modal-actions">
              <button className="lc-modal-cancel" onClick={() => setWaiverModal(null)}>Cancel</button>
              <button
                className="lc-modal-submit"
                disabled={!waiverReason.trim()}
                onClick={() => {
                  updateFindingStatus(waiverModal.findingId, 'waived', waiverReason);
                  setWaiverModal(null);
                }}
              >Waive Finding</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

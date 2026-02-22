import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Loader2, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import './RiskFindingsPage.css';

interface FindingsSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
  open: number;
  dismissed: number;
  acknowledged: number;
}

interface LastScan {
  id: string;
  status: string;
  completedAt: string | null;
  findingsCount: number;
}

interface ScanHistoryEntry {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  dependencyCount: number;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  osvDurationMs: number | null;
  osvFindings: number;
  githubDurationMs: number | null;
  githubFindings: number;
  nvdDurationMs: number | null;
  nvdFindings: number;
  triggeredBy: string | null;
  source: string;
}

interface ScanStats {
  totalScans: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  avgOsvMs: number;
  avgGithubMs: number;
  avgNvdMs: number;
  avgDeps: number;
  errorCount: number;
}

interface ScanHistoryData {
  history: ScanHistoryEntry[];
  stats: ScanStats | null;
}

interface ProductFindings {
  id: string;
  name: string;
  craCategory: string | null;
  lastScan: LastScan | null;
  findings: FindingsSummary;
}

interface OverviewData {
  products: ProductFindings[];
  totals: {
    totalFindings: number; critical: number; high: number;
    medium: number; low: number; openFindings: number;
  };
}

interface Finding {
  id: string;
  source: string;
  source_id: string;
  severity: string;
  cvss_score: number | null;
  title: string;
  description: string;
  dependency_name: string;
  dependency_version: string;
  dependency_ecosystem: string;
  fixed_version: string;
  affected_versions: string;
  references_url: string;
  mitigation: string;
  status: string;
  dismissed_by: string | null;
  dismissed_reason: string | null;
  created_at: string;
}

type Filter = 'all' | 'critical_high' | 'open' | 'dismissed';

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function RiskFindingsPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [productFindings, setProductFindings] = useState<Record<string, Finding[]>>({});
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
  const [expandedFindings, setExpandedFindings] = useState<Record<string, boolean>>({});
  const [scanHistories, setScanHistories] = useState<Record<string, ScanHistoryData>>({});
  const [showHistory, setShowHistory] = useState<Record<string, boolean>>({});

  const token = localStorage.getItem('session_token');

  const fetchOverview = useCallback(() => {
    fetch('/api/risk-findings/overview', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  const handleScanAll = async () => {
    if (!data || scanning) return;
    setScanning(true);
    setScanStatus('Starting scans...');

    const productsToScan = data.products;
    let completed = 0;

    for (const product of productsToScan) {
      setScanStatus(`Scanning ${product.name} (${completed + 1}/${productsToScan.length})...`);
      try {
        const resp = await fetch(`/api/risk-findings/${product.id}/scan`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        const result = await resp.json();

        if (result.status === 'started' || result.status === 'already_running') {
          // Poll for completion
          let scanDone = false;
          let attempts = 0;
          while (!scanDone && attempts < 60) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            const pollResp = await fetch(`/api/risk-findings/scan/${result.scanId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const pollData = await pollResp.json();
            if (pollData.status === 'completed' || pollData.status === 'failed') {
              scanDone = true;
            }
            attempts++;
          }
        }
      } catch (err) {
        console.error(`Scan failed for ${product.name}:`, err);
      }
      completed++;
    }

    setScanStatus('');
    setScanning(false);
    fetchOverview();
  };

  const loadProductFindings = async (productId: string) => {
    if (productFindings[productId]) {
      setExpandedProducts(prev => ({ ...prev, [productId]: !prev[productId] }));
      return;
    }
    try {
      const resp = await fetch(`/api/risk-findings/${productId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await resp.json();
      setProductFindings(prev => ({ ...prev, [productId]: result.findings }));
      setExpandedProducts(prev => ({ ...prev, [productId]: true }));
    } catch (err) {
      console.error('Failed to load findings:', err);
    }
  };

  const handleDismiss = async (findingId: string, productId: string) => {
    const reason = prompt('Reason for dismissing this finding (optional):');
    try {
      await fetch(`/api/risk-findings/${findingId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dismissed', reason: reason || '' }),
      });
      // Refresh findings for this product
      const resp = await fetch(`/api/risk-findings/${productId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await resp.json();
      setProductFindings(prev => ({ ...prev, [productId]: result.findings }));
      fetchOverview();
    } catch (err) {
      console.error('Failed to dismiss finding:', err);
    }
  };

  const loadScanHistory = async (productId: string) => {
    if (scanHistories[productId]) {
      setShowHistory(prev => ({ ...prev, [productId]: !prev[productId] }));
      return;
    }
    try {
      const resp = await fetch(`/api/risk-findings/${productId}/scan-history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await resp.json();
      setScanHistories(prev => ({ ...prev, [productId]: result }));
      setShowHistory(prev => ({ ...prev, [productId]: true }));
    } catch (err) {
      console.error('Failed to load scan history:', err);
    }
  };

  if (loading) return <><PageHeader title="Risk Findings" /><p className="rf-empty">Loading...</p></>;
  if (!data) return <><PageHeader title="Risk Findings" /><p className="rf-empty">Unable to load risk findings.</p></>;

  const { products, totals } = data;

  const filtered = products.filter(p => {
    if (filter === 'critical_high') return p.findings.critical > 0 || p.findings.high > 0;
    if (filter === 'open') return p.findings.open > 0;
    if (filter === 'dismissed') return p.findings.dismissed > 0;
    return true;
  });

  return (
    <>
      <PageHeader title="Risk Findings" />
      <div className="rf-stats">
        <StatCard label="Total Findings" value={totals.totalFindings} color="blue" sub={`${totals.openFindings} open`} />
        <StatCard label="Critical" value={totals.critical} color="red" sub={totals.critical > 0 ? 'immediate action' : 'none found'} />
        <StatCard label="High" value={totals.high} color="amber" sub={totals.high > 0 ? 'review needed' : 'none found'} />
        <StatCard label="Medium + Low" value={totals.medium + totals.low} color="blue" sub={`${totals.medium} medium, ${totals.low} low`} />
      </div>

      <div className="rf-header-actions">
        <button className="rf-scan-btn" onClick={handleScanAll} disabled={scanning}>
          {scanning ? <Loader2 size={16} className="spinner" /> : <RefreshCw size={16} />}
          {scanning ? scanStatus || 'Scanning...' : 'Scan All Products'}
        </button>
        <div className="rf-filter-bar">
          {[
            { key: 'all' as Filter, label: 'All' },
            { key: 'critical_high' as Filter, label: 'Critical + High' },
            { key: 'open' as Filter, label: 'Open Only' },
            { key: 'dismissed' as Filter, label: 'Dismissed' },
          ].map(f => (
            <button key={f.key} className={`rf-filter-btn ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {products.length === 0 && <p className="rf-empty">No products yet. <Link to="/products">Add your first product</Link>.</p>}
      {filtered.length === 0 && products.length > 0 && <p className="rf-empty">No products match this filter.</p>}

      {filtered.map(product => {
        const { findings } = product;
        const total = findings.total;
        const isExpanded = expandedProducts[product.id];
        const pFindings = productFindings[product.id] || [];

        return (
          <div key={product.id} className="rf-product-card">
            <div className="rf-card-header" onClick={() => loadProductFindings(product.id)} style={{ cursor: 'pointer' }}>
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <h3><Link to={`/products/${product.id}?tab=risk-findings`} onClick={e => e.stopPropagation()}>{product.name}</Link></h3>
              {total > 0 && (
                <>
                  {findings.critical > 0 && <span className="rf-severity-badge critical">{findings.critical} Critical</span>}
                  {findings.high > 0 && <span className="rf-severity-badge high">{findings.high} High</span>}
                  {findings.medium > 0 && <span className="rf-severity-badge medium">{findings.medium} Med</span>}
                  {findings.low > 0 && <span className="rf-severity-badge low">{findings.low} Low</span>}
                </>
              )}
              <div className="rf-scan-info" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span>
                  {product.lastScan
                    ? `Last scan: ${formatTimeAgo(product.lastScan.completedAt)} (${product.lastScan.findingsCount} findings)`
                    : 'Never scanned'}
                </span>
                {product.lastScan && (
                  <button
                    onClick={(e) => { e.stopPropagation(); loadScanHistory(product.id); }}
                    style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', padding: '0.15rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}
                  >
                    {showHistory[product.id] ? 'Hide' : 'Performance'}
                  </button>
                )}
              </div>
            </div>

            {total > 0 && (
              <>
                <div className="rf-severity-bar">
                  {findings.critical > 0 && <div className="rf-severity-segment critical" style={{ width: `${(findings.critical / total) * 100}%` }} />}
                  {findings.high > 0 && <div className="rf-severity-segment high" style={{ width: `${(findings.high / total) * 100}%` }} />}
                  {findings.medium > 0 && <div className="rf-severity-segment medium" style={{ width: `${(findings.medium / total) * 100}%` }} />}
                  {findings.low > 0 && <div className="rf-severity-segment low" style={{ width: `${(findings.low / total) * 100}%` }} />}
                </div>
                <div className="rf-severity-legend">
                  {findings.critical > 0 && <span className="rf-legend-item"><span className="rf-legend-dot critical" /> Critical ({findings.critical})</span>}
                  {findings.high > 0 && <span className="rf-legend-item"><span className="rf-legend-dot high" /> High ({findings.high})</span>}
                  {findings.medium > 0 && <span className="rf-legend-item"><span className="rf-legend-dot medium" /> Medium ({findings.medium})</span>}
                  {findings.low > 0 && <span className="rf-legend-item"><span className="rf-legend-dot low" /> Low ({findings.low})</span>}
                  <span className="rf-legend-item" style={{ marginLeft: 'auto' }}>
                    {findings.open} open, {findings.dismissed} dismissed
                  </span>
                </div>
              </>
            )}

            {total === 0 && !product.lastScan && (
              <div className="rf-no-findings">
                <Shield size={24} strokeWidth={1} style={{ marginBottom: '0.5rem', opacity: 0.5 }} /><br />
                No scans yet. Click "Scan All Products" to check for vulnerabilities.
              </div>
            )}

            {total === 0 && product.lastScan && (
              <div className="rf-no-findings" style={{ color: 'var(--green)' }}>
                No vulnerabilities found in the last scan.
              </div>
            )}

            {/* Scan performance history */}
            {showHistory[product.id] && scanHistories[product.id] && (() => {
              const sh = scanHistories[product.id];
              return (
                <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)', fontSize: '0.8rem' }}>
                  {sh.stats && (
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', color: 'var(--muted)' }}>
                      <span><strong style={{ color: 'var(--text)' }}>{sh.stats.totalScans}</strong> scans</span>
                      <span>Avg: <strong style={{ color: 'var(--text)' }}>{sh.stats.avgDuration}s</strong></span>
                      <span>Min: <strong style={{ color: 'var(--text)' }}>{sh.stats.minDuration}s</strong></span>
                      <span>Max: <strong style={{ color: 'var(--text)' }}>{sh.stats.maxDuration}s</strong></span>
                      <span>OSV avg: <strong style={{ color: 'var(--text)' }}>{sh.stats.avgOsvMs}ms</strong></span>
                      <span>GitHub avg: <strong style={{ color: 'var(--text)' }}>{sh.stats.avgGithubMs}ms</strong></span>
                      <span>NVD avg: <strong style={{ color: 'var(--text)' }}>{sh.stats.avgNvdMs}ms</strong></span>
                    </div>
                  )}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)', textAlign: 'left' }}>
                        <th style={{ padding: '0.3rem 0.5rem' }}>Date</th>
                        <th style={{ padding: '0.3rem 0.5rem' }}>Duration</th>
                        <th style={{ padding: '0.3rem 0.5rem' }}>Deps</th>
                        <th style={{ padding: '0.3rem 0.5rem' }}>Findings</th>
                        <th style={{ padding: '0.3rem 0.5rem' }}>OSV</th>
                        <th style={{ padding: '0.3rem 0.5rem' }}>GitHub</th>
                        <th style={{ padding: '0.3rem 0.5rem' }}>NVD</th>
                        <th style={{ padding: '0.3rem 0.5rem' }}>By</th>
                        <th style={{ padding: '0.3rem 0.5rem' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sh.history.map(h => (
                        <tr key={h.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '0.3rem 0.5rem', color: 'var(--muted)' }}>{new Date(h.startedAt).toLocaleString()}</td>
                          <td style={{ padding: '0.3rem 0.5rem', color: 'var(--text)', fontWeight: 500 }}>{h.durationSeconds != null ? `${h.durationSeconds}s` : '-'}</td>
                          <td style={{ padding: '0.3rem 0.5rem' }}>{h.dependencyCount || '-'}</td>
                          <td style={{ padding: '0.3rem 0.5rem' }}>
                            {h.findingsCount}
                            {h.criticalCount > 0 && <span style={{ color: '#dc2626', marginLeft: '0.25rem' }}>({h.criticalCount}C</span>}
                            {h.highCount > 0 && <span style={{ color: '#f97316' }}> {h.highCount}H</span>}
                            {(h.criticalCount > 0 || h.highCount > 0) && <span style={{ color: 'var(--muted)' }}>)</span>}
                          </td>
                          <td style={{ padding: '0.3rem 0.5rem', color: 'var(--muted)' }}>{h.osvDurationMs != null ? `${h.osvDurationMs}ms (${h.osvFindings})` : '-'}</td>
                          <td style={{ padding: '0.3rem 0.5rem', color: 'var(--muted)' }}>{h.githubDurationMs != null ? `${h.githubDurationMs}ms (${h.githubFindings})` : '-'}</td>
                          <td style={{ padding: '0.3rem 0.5rem', color: 'var(--muted)' }}>{h.nvdDurationMs != null ? `${h.nvdDurationMs}ms (${h.nvdFindings})` : '-'}</td>
                          <td style={{ padding: '0.3rem 0.5rem', color: 'var(--muted)' }}>{h.triggeredBy || '-'}</td>
                          <td style={{ padding: '0.3rem 0.5rem' }}>
                            <span style={{ color: h.status === 'completed' ? 'var(--green)' : h.status === 'failed' ? 'var(--red)' : 'var(--amber)' }}>{h.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* Expanded findings list */}
            {isExpanded && pFindings.length > 0 && (
              <>
                {pFindings.map(finding => {
                  const isDetailExpanded = expandedFindings[finding.id];
                  return (
                    <div key={finding.id}>
                      <div
                        className="rf-finding-row"
                        onClick={() => setExpandedFindings(prev => ({ ...prev, [finding.id]: !prev[finding.id] }))}
                      >
                        <span className={`rf-severity-badge ${finding.severity}`}>{finding.severity}</span>
                        <div className="rf-finding-content">
                          <div className="rf-finding-title">{finding.title.substring(0, 120)}</div>
                          <div className="rf-finding-meta">
                            <span>{finding.source_id}</span>
                            <span>{finding.dependency_name}@{finding.dependency_version}</span>
                            {finding.fixed_version && <span>Fix: {finding.fixed_version}</span>}
                            {finding.cvss_score && <span>CVSS: {finding.cvss_score}</span>}
                          </div>
                        </div>
                        <div className="rf-finding-status">
                          <span className={finding.status}>{finding.status}</span>
                        </div>
                      </div>
                      {isDetailExpanded && (
                        <div className="rf-finding-detail">
                          {finding.mitigation && (
                            <div style={{ background: 'rgba(100, 149, 237, 0.08)', border: '1px solid rgba(100, 149, 237, 0.2)', borderRadius: '6px', padding: '0.6rem 0.75rem', marginBottom: '0.75rem' }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.3rem', textTransform: 'uppercase' as const }}>Recommended Action</div>
                              <div style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.5 }}>{finding.mitigation}</div>
                            </div>
                          )}
                          {!finding.mitigation && finding.fixed_version && (
                            <div style={{ background: 'rgba(76, 175, 80, 0.08)', border: '1px solid rgba(76, 175, 80, 0.2)', borderRadius: '6px', padding: '0.6rem 0.75rem', marginBottom: '0.75rem' }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--green)', marginBottom: '0.3rem', textTransform: 'uppercase' as const }}>Fix Available</div>
                              <div style={{ fontSize: '0.82rem', color: 'var(--text)' }}>Upgrade {finding.dependency_name} to version {finding.fixed_version} or later.</div>
                            </div>
                          )}
                          <p>{finding.description.substring(0, 500)}</p>
                          {finding.affected_versions && <p>Affected versions: {finding.affected_versions}</p>}
                          {finding.references_url && (
                            <div className="refs">
                              References: {finding.references_url.split(', ').map((url, i) => (
                                <span key={i}>{i > 0 && ', '}<a href={url} target="_blank" rel="noopener noreferrer">{url}</a></span>
                              ))}
                            </div>
                          )}
                          {finding.status === 'open' && (
                            <button className="rf-dismiss-btn" onClick={(e) => { e.stopPropagation(); handleDismiss(finding.id, product.id); }}>
                              Dismiss
                            </button>
                          )}
                          {finding.dismissed_by && (
                            <p style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
                              Dismissed by {finding.dismissed_by}{finding.dismissed_reason ? `: ${finding.dismissed_reason}` : ''}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

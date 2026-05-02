/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, ChevronDown, ChevronRight, Clock, RefreshCw, FileText } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { usePageMeta } from '../../hooks/usePageMeta';
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
  mitigated: number;
  resolved: number;
  openCritical: number;
  openHigh: number;
  openMedium: number;
  openLow: number;
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
    openCritical: number; openHigh: number; openMedium: number; openLow: number;
  };
}

interface Finding {
  id: string;
  product_id: string;
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
  mitigation_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  status: string;
  dismissed_by: string | null;
  dismissed_reason: string | null;
  created_at: string;
}

interface PlatformScan {
  id: string;
  status: string;
  triggeredBy: string;
  triggerType: string;
  totalProducts: number;
  totalUniqueDependencies: number;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  newFindingsCount: number;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
}

type Filter = 'all' | 'critical_high' | 'open' | 'dismissed';

// FR-1: All triage statuses
const TRIAGE_STATUSES = [
  { value: 'open', label: 'Open', className: 'open' },
  { value: 'acknowledged', label: 'Acknowledged', className: 'acknowledged' },
  { value: 'mitigated', label: 'Mitigated', className: 'mitigated' },
  { value: 'resolved', label: 'Resolved', className: 'resolved' },
  { value: 'dismissed', label: 'Dismissed', className: 'dismissed' },
];

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return diffMins + 'm ago';
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return diffHours + 'h ago';
  const diffDays = Math.floor(diffHours / 24);
  return diffDays + 'd ago';
}

export default function RiskFindingsPage() {
  usePageMeta();
  const navigate = useNavigate();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [productFindings, setProductFindings] = useState<Record<string, Finding[]>>({});
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
  const [expandedFindings, setExpandedFindings] = useState<Record<string, boolean>>({});
  const [scanHistories, setScanHistories] = useState<Record<string, ScanHistoryData>>({});
  const [showHistory, setShowHistory] = useState<Record<string, boolean>>({});
  const [latestPlatformScan, setLatestPlatformScan] = useState<PlatformScan | null>(null);
  const [scanningProducts, setScanningProducts] = useState<Record<string, boolean>>({});
  const [mitigationDraft, setMitigationDraft] = useState<Record<string, string>>({});

  const token = localStorage.getItem('session_token');
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };

  const fetchOverview = useCallback(() => {
    fetch('/api/risk-findings/overview', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  const fetchLatestPlatformScan = useCallback(() => {
    fetch('/api/risk-findings/platform-scan/latest', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => { if (d.latestScan) setLatestPlatformScan(d.latestScan); })
      .catch(() => {});
  }, [token]);

  useEffect(() => { fetchOverview(); fetchLatestPlatformScan(); }, [fetchOverview, fetchLatestPlatformScan]);

  const loadProductFindings = async (productId: string) => {
    if (productFindings[productId]) {
      setExpandedProducts(prev => ({ ...prev, [productId]: !prev[productId] }));
      return;
    }
    try {
      const resp = await fetch('/api/risk-findings/' + productId, {
        headers: { Authorization: 'Bearer ' + token },
      });
      const result = await resp.json();
      setProductFindings(prev => ({ ...prev, [productId]: result.findings }));
      setExpandedProducts(prev => ({ ...prev, [productId]: true }));
    } catch (err) {
      console.error('Failed to load findings:', err);
    }
  };

  // FR-1: Full triage status change handler
  const handleStatusChange = async (findingId: string, productId: string, newStatus: string, reason?: string, mitigationNotes?: string) => {
    try {
      await fetch('/api/risk-findings/' + findingId, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: newStatus, reason: reason || '', mitigationNotes: mitigationNotes || '' }),
      });
      // Refresh findings for this product
      const resp = await fetch('/api/risk-findings/' + productId, {
        headers: { Authorization: 'Bearer ' + token },
      });
      const result = await resp.json();
      setProductFindings(prev => ({ ...prev, [productId]: result.findings }));
      fetchOverview();
    } catch (err) {
      console.error('Failed to update finding status:', err);
    }
  };

  // FR-2: Per-product scan trigger
  const handleProductScan = async (productId: string) => {
    setScanningProducts(prev => ({ ...prev, [productId]: true }));
    try {
      const resp = await fetch('/api/risk-findings/' + productId + '/scan', {
        method: 'POST',
        headers,
      });
      if (resp.ok) {
        // Refresh data after scan completes
        setTimeout(() => {
          fetchOverview();
          // Re-load findings if expanded
          if (expandedProducts[productId]) {
            fetch('/api/risk-findings/' + productId, { headers: { Authorization: 'Bearer ' + token } })
              .then(r => r.json())
              .then(result => setProductFindings(prev => ({ ...prev, [productId]: result.findings })));
          }
          setScanningProducts(prev => ({ ...prev, [productId]: false }));
        }, 1000);
      } else {
        const err = await resp.json();
        alert(err.error || 'Scan failed');
        setScanningProducts(prev => ({ ...prev, [productId]: false }));
      }
    } catch (err) {
      console.error('Failed to trigger scan:', err);
      setScanningProducts(prev => ({ ...prev, [productId]: false }));
    }
  };

  const loadScanHistory = async (productId: string) => {
    if (scanHistories[productId]) {
      setShowHistory(prev => ({ ...prev, [productId]: !prev[productId] }));
      return;
    }
    try {
      const resp = await fetch('/api/risk-findings/' + productId + '/scan-history', {
        headers: { Authorization: 'Bearer ' + token },
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

      {/* Platform scan banner */}
      {latestPlatformScan && (
        <div className="rf-platform-banner">
          <Clock size={16} />
          <span>
            Last platform scan: <strong>{formatTimeAgo(latestPlatformScan.completedAt || latestPlatformScan.startedAt)}</strong>
            {latestPlatformScan.status === 'completed' && (
              <> &mdash; {latestPlatformScan.totalFindings} findings across {latestPlatformScan.totalProducts} products
                {latestPlatformScan.newFindingsCount > 0 && (
                  <span className="rf-new-badge">{latestPlatformScan.newFindingsCount} new</span>
                )}
              </>
            )}
            {latestPlatformScan.status === 'running' && (
              <> &mdash; <span style={{ color: 'var(--amber)' }}>Scan in progress...</span></>
            )}
            {latestPlatformScan.status === 'failed' && (
              <> &mdash; <span style={{ color: 'var(--red)' }}>Scan failed</span></>
            )}
          </span>
        </div>
      )}

      <div className="rf-stats">
        <StatCard label="Total Findings" value={totals.totalFindings} color="blue" sub={totals.openFindings + ' open'} />
        <StatCard label="Critical" value={totals.openCritical} color={totals.openCritical > 0 ? 'red' : 'green'} sub={totals.openCritical > 0 ? 'immediate action' : totals.critical > 0 ? totals.critical + ' resolved/dismissed' : 'none found'} />
        <StatCard label="High" value={totals.openHigh} color={totals.openHigh > 0 ? 'amber' : 'green'} sub={totals.openHigh > 0 ? 'review needed' : totals.high > 0 ? totals.high + ' resolved/dismissed' : 'none found'} />
        <StatCard label="Medium + Low" value={totals.openMedium + totals.openLow} color={totals.openMedium + totals.openLow > 0 ? 'blue' : 'green'} sub={totals.openMedium + totals.openLow > 0 ? totals.openMedium + ' medium, ' + totals.openLow + ' low' : (totals.medium + totals.low) > 0 ? (totals.medium + totals.low) + ' resolved/dismissed' : 'none found'} />
      </div>

      <div className="rf-header-actions">
        <div className="rf-filter-bar">
          {([
            { key: 'all' as Filter, label: 'All' },
            { key: 'critical_high' as Filter, label: 'Critical + High' },
            { key: 'open' as Filter, label: 'Open Only' },
            { key: 'dismissed' as Filter, label: 'Dismissed' },
          ]).map(f => (
            <button key={f.key} className={'rf-filter-btn ' + (filter === f.key ? 'active' : '')} onClick={() => setFilter(f.key)}>
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
        const isScanning = scanningProducts[product.id];

        return (
          <div key={product.id} className="rf-product-card">
            <div className="rf-card-header" onClick={() => loadProductFindings(product.id)} style={{ cursor: 'pointer' }}>
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <h3><Link to={'/products/' + product.id + '?tab=risk-findings'} onClick={e => e.stopPropagation()}>{product.name}</Link></h3>
              {total > 0 && (
                <>
                  {(findings.openCritical || 0) > 0 && <span className="rf-severity-badge critical">{findings.openCritical} Critical</span>}
                  {(findings.openHigh || 0) > 0 && <span className="rf-severity-badge high">{findings.openHigh} High</span>}
                  {(findings.openMedium || 0) > 0 && <span className="rf-severity-badge medium">{findings.openMedium} Med</span>}
                  {(findings.openLow || 0) > 0 && <span className="rf-severity-badge low">{findings.openLow} Low</span>}
                </>
              )}
              <div className="rf-scan-info" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span>
                  {product.lastScan
                    ? 'Last scan: ' + formatTimeAgo(product.lastScan.completedAt) + ' (' + product.lastScan.findingsCount + ' findings)'
                    : 'Never scanned'}
                </span>
                {/* FR-2: Per-product scan button */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleProductScan(product.id); }}
                  className="rf-scan-btn"
                  disabled={isScanning}
                  title="Trigger vulnerability scan"
                >
                  <RefreshCw size={12} className={isScanning ? 'rf-spin' : ''} />
                  {isScanning ? 'Scanning...' : 'Scan'}
                </button>
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

            {total > 0 && (() => {
              const openTotal = findings.open + findings.acknowledged;
              const resolvedTotal = findings.mitigated + findings.resolved + findings.dismissed;
              return (
                <>
                  {openTotal > 0 ? (
                    <>
                      <div className="rf-severity-bar">
                        {(findings.openCritical || 0) > 0 && <div className="rf-severity-segment critical" style={{ width: ((findings.openCritical || 0) / openTotal) * 100 + '%' }} />}
                        {(findings.openHigh || 0) > 0 && <div className="rf-severity-segment high" style={{ width: ((findings.openHigh || 0) / openTotal) * 100 + '%' }} />}
                        {(findings.openMedium || 0) > 0 && <div className="rf-severity-segment medium" style={{ width: ((findings.openMedium || 0) / openTotal) * 100 + '%' }} />}
                        {(findings.openLow || 0) > 0 && <div className="rf-severity-segment low" style={{ width: ((findings.openLow || 0) / openTotal) * 100 + '%' }} />}
                      </div>
                      <div className="rf-severity-legend">
                        {(findings.openCritical || 0) > 0 && <span className="rf-legend-item"><span className="rf-legend-dot critical" /> Critical ({findings.openCritical})</span>}
                        {(findings.openHigh || 0) > 0 && <span className="rf-legend-item"><span className="rf-legend-dot high" /> High ({findings.openHigh})</span>}
                        {(findings.openMedium || 0) > 0 && <span className="rf-legend-item"><span className="rf-legend-dot medium" /> Medium ({findings.openMedium})</span>}
                        {(findings.openLow || 0) > 0 && <span className="rf-legend-item"><span className="rf-legend-dot low" /> Low ({findings.openLow})</span>}
                        <span className="rf-legend-item" style={{ marginLeft: 'auto' }}>
                          {findings.open} open{findings.acknowledged > 0 ? ', ' + findings.acknowledged + ' ack' : ''}{resolvedTotal > 0 ? ', ' + resolvedTotal + ' resolved/handled' : ''}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0', color: 'var(--green)', fontSize: '0.8rem' }}>
                      <span style={{ fontSize: '1rem' }}>{"\u2714"}</span>
                      All {total} findings resolved or dismissed ({findings.resolved > 0 ? findings.resolved + ' resolved' : ''}{findings.resolved > 0 && findings.dismissed > 0 ? ', ' : ''}{findings.dismissed > 0 ? findings.dismissed + ' dismissed' : ''}{findings.mitigated > 0 ? ', ' + findings.mitigated + ' mitigated' : ''})
                    </div>
                  )}
                </>
              );
            })()}

            {total === 0 && !product.lastScan && (
              <div className="rf-no-findings">
                <Shield size={24} strokeWidth={1} style={{ marginBottom: '0.5rem', opacity: 0.5 }} /><br />
                Awaiting platform scan. Scans run daily at 3:00 AM.
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
                          <td style={{ padding: '0.3rem 0.5rem', color: 'var(--text)', fontWeight: 500 }}>{h.durationSeconds != null ? h.durationSeconds + 's' : '-'}</td>
                          <td style={{ padding: '0.3rem 0.5rem' }}>{h.dependencyCount || '-'}</td>
                          <td style={{ padding: '0.3rem 0.5rem' }}>
                            {h.findingsCount}
                            {h.criticalCount > 0 && <span style={{ color: '#dc2626', marginLeft: '0.25rem' }}>({h.criticalCount}C</span>}
                            {h.highCount > 0 && <span style={{ color: '#f97316' }}> {h.highCount}H</span>}
                            {(h.criticalCount > 0 || h.highCount > 0) && <span style={{ color: 'var(--muted)' }}>)</span>}
                          </td>
                          <td style={{ padding: '0.3rem 0.5rem', color: 'var(--muted)' }}>{h.osvDurationMs != null ? h.osvDurationMs + 'ms (' + h.osvFindings + ')' : '-'}</td>
                          <td style={{ padding: '0.3rem 0.5rem', color: 'var(--muted)' }}>{h.githubDurationMs != null ? h.githubDurationMs + 'ms (' + h.githubFindings + ')' : '-'}</td>
                          <td style={{ padding: '0.3rem 0.5rem', color: 'var(--muted)' }}>{h.nvdDurationMs != null ? h.nvdDurationMs + 'ms (' + h.nvdFindings + ')' : '-'}</td>
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
                        <span className={'rf-severity-badge ' + finding.severity}>{finding.severity}</span>
                        <div className="rf-finding-content">
                          <div className="rf-finding-title">{finding.title.substring(0, 120)}</div>
                          <div className="rf-finding-meta">
                            <span>{finding.source_id}</span>
                            <span>{finding.dependency_name}@{finding.dependency_version}</span>
                            {finding.fixed_version && <span>Fix: {finding.fixed_version}</span>}
                            {finding.cvss_score && <span>CVSS: {finding.cvss_score}</span>}
                          </div>
                        </div>
                        <div className="rf-finding-actions" onClick={e => e.stopPropagation()}>
                          {/* FR-1: Status dropdown */}
                          <select
                            className={'rf-status-select rf-status-' + finding.status}
                            value={finding.status}
                            onChange={async (e) => {
                              const newStatus = e.target.value;
                              if (newStatus === 'dismissed') {
                                const reason = prompt('Reason for dismissing (optional):');
                                await handleStatusChange(finding.id, product.id, newStatus, reason || '');
                              } else if (newStatus === 'mitigated') {
                                const notes = mitigationDraft[finding.id] || prompt('Mitigation notes (describe what was done):');
                                await handleStatusChange(finding.id, product.id, newStatus, '', notes || '');
                              } else {
                                await handleStatusChange(finding.id, product.id, newStatus);
                              }
                            }}
                          >
                            {TRIAGE_STATUSES.map(s => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                          {/* FR-3: Create ENISA Report button */}
                          <button
                            className="rf-report-btn"
                            onClick={() => navigate('/vulnerability-reports?create=true&productId=' + finding.product_id + '&findingId=' + finding.id)}
                            title="Create ENISA Report from this finding"
                          >
                            <FileText size={12} />
                            Report
                          </button>
                        </div>
                      </div>
                      {isDetailExpanded && (
                        <div className="rf-finding-detail">
                          {finding.mitigation && (
                            <div style={{ background: 'rgba(100, 149, 237, 0.08)', border: '1px solid rgba(100, 149, 237, 0.2)', borderRadius: '6px', padding: '0.6rem 0.75rem', marginBottom: '0.75rem' }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Recommended Action</div>
                              <div style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.5 }}>{finding.mitigation}</div>
                            </div>
                          )}
                          {!finding.mitigation && finding.fixed_version && (
                            <div style={{ background: 'rgba(76, 175, 80, 0.08)', border: '1px solid rgba(76, 175, 80, 0.2)', borderRadius: '6px', padding: '0.6rem 0.75rem', marginBottom: '0.75rem' }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--green)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Fix Available</div>
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
                          {/* FR-4: Mitigation notes */}
                          {(finding.status === 'mitigated' || finding.mitigation_notes) && (
                            <div className="rf-mitigation-notes">
                              <div className="rf-mitigation-header">Mitigation Notes</div>
                              {finding.status === 'mitigated' ? (
                                <textarea
                                  className="rf-mitigation-textarea"
                                  value={mitigationDraft[finding.id] ?? finding.mitigation_notes ?? ''}
                                  onChange={e => setMitigationDraft(prev => ({ ...prev, [finding.id]: e.target.value }))}
                                  onBlur={async () => {
                                    const notes = mitigationDraft[finding.id];
                                    if (notes !== undefined && notes !== (finding.mitigation_notes || '')) {
                                      await handleStatusChange(finding.id, product.id, 'mitigated', '', notes);
                                    }
                                  }}
                                  placeholder="Describe the mitigation steps taken..."
                                  rows={3}
                                />
                              ) : (
                                <p style={{ margin: 0 }}>{finding.mitigation_notes}</p>
                              )}
                            </div>
                          )}
                          {/* Status metadata */}
                          {finding.dismissed_by && finding.status === 'dismissed' && (
                            <p style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
                              Dismissed by {finding.dismissed_by}{finding.dismissed_reason ? ': ' + finding.dismissed_reason : ''}
                            </p>
                          )}
                          {finding.resolved_by && finding.status === 'resolved' && (
                            <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--green)' }}>
                              Resolved by {finding.resolved_by} on {new Date(finding.resolved_at || '').toLocaleDateString()}
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

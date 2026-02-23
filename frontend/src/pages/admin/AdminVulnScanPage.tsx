import { useState, useEffect, useCallback } from 'react';
import { Shield, Play, Loader2, Clock, AlertTriangle, CheckCircle, XCircle, Database } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import './AdminVulnScanPage.css';

interface ScanRun {
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
  osvDurationMs: number | null;
  osvFindings: number;
  githubDurationMs: number | null;
  githubFindings: number;
  nvdDurationMs: number | null;
  nvdFindings: number;
  localDbDurationMs: number | null;
  localDbFindings: number;
  errorMessage: string | null;
}

interface ProductBreakdown {
  productId: string;
  productName: string;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  durationSeconds: number | null;
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return diffMins + 'm ago';
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return diffHours + 'h ago';
  const diffDays = Math.floor(diffHours / 24);
  return diffDays + 'd ago';
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '-';
  if (seconds < 60) return seconds.toFixed(1) + 's';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return mins + 'm ' + secs + 's';
}

export default function AdminVulnScanPage() {
  const [currentRun, setCurrentRun] = useState<ScanRun | null>(null);
  const [products, setProducts] = useState<ProductBreakdown[]>([]);
  const [history, setHistory] = useState<ScanRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [polling, setPolling] = useState(false);

  const token = localStorage.getItem('session_token');

  const fetchStatus = useCallback(async () => {
    try {
      const resp = await fetch('/api/admin/vulnerability-scan/status', {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (resp.ok) {
        const data = await resp.json();
        setCurrentRun(data.run);
        setProducts(data.products || []);
        return data.run?.status;
      }
    } catch {
      // ignore
    }
    return null;
  }, [token]);

  const fetchHistory = useCallback(async () => {
    try {
      const resp = await fetch('/api/admin/vulnerability-scan/history', {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (resp.ok) {
        const data = await resp.json();
        setHistory(data.runs || []);
      }
    } catch {
      // ignore
    }
  }, [token]);

  useEffect(() => {
    Promise.all([fetchStatus(), fetchHistory()]).then(() => setLoading(false));
  }, [fetchStatus, fetchHistory]);

  // Poll while scan is running
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(async () => {
      const status = await fetchStatus();
      if (status !== 'running') {
        setPolling(false);
        fetchHistory();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [polling, fetchStatus, fetchHistory]);

  const handleTriggerScan = async () => {
    if (triggering) return;
    if (!confirm('Start a platform-wide vulnerability scan? This will scan all products.')) return;

    setTriggering(true);
    try {
      const resp = await fetch('/api/admin/vulnerability-scan', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.status === 'started' || data.status === 'already_running') {
          setPolling(true);
          setTimeout(fetchStatus, 1000);
        }
      }
    } catch (err) {
      console.error('Failed to trigger scan:', err);
    } finally {
      setTriggering(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Vulnerability Scanning" />
        <p style={{ color: 'var(--muted)' }}>Loading...</p>
      </>
    );
  }

  const isRunning = currentRun?.status === 'running';

  return (
    <>
      <PageHeader title="Vulnerability Scanning">
        <button
          className="avs-trigger-btn"
          onClick={handleTriggerScan}
          disabled={triggering || isRunning}
        >
          {isRunning ? <Loader2 size={16} className="avs-spinner" /> : <Play size={16} />}
          {isRunning ? 'Scan Running...' : 'Run Platform Scan'}
        </button>
      </PageHeader>

      {/* Current/Latest scan summary */}
      {currentRun && (
        <div className="avs-current-card">
          <div className="avs-current-header">
            <div className="avs-current-title">
              {currentRun.status === 'running' && <Loader2 size={18} className="avs-spinner" style={{ color: 'var(--amber)' }} />}
              {currentRun.status === 'completed' && <CheckCircle size={18} style={{ color: 'var(--green)' }} />}
              {currentRun.status === 'failed' && <XCircle size={18} style={{ color: 'var(--red)' }} />}
              <span>
                {currentRun.status === 'running' ? 'Scan in progress' : 'Latest scan'}
              </span>
              <span className={'avs-status-badge ' + currentRun.status}>{currentRun.status}</span>
            </div>
            <div className="avs-current-meta">
              <span><Clock size={14} /> {formatTimeAgo(currentRun.completedAt || currentRun.startedAt)}</span>
              <span>Triggered by: {currentRun.triggeredBy}</span>
              <span>Type: {currentRun.triggerType}</span>
              {currentRun.durationSeconds !== null && <span>Duration: {formatDuration(currentRun.durationSeconds)}</span>}
            </div>
          </div>

          <div className="avs-stat-row">
            <StatCard label="Products" value={currentRun.totalProducts} color="blue" />
            <StatCard label="Dependencies" value={currentRun.totalUniqueDependencies} color="blue" />
            <StatCard label="Findings" value={currentRun.totalFindings} color={currentRun.criticalCount > 0 ? 'red' : 'blue'} />
            <StatCard label="New" value={currentRun.newFindingsCount} color={currentRun.newFindingsCount > 0 ? 'amber' : 'green'} />
          </div>

          {currentRun.status === 'completed' && (
            <div className="avs-breakdown-row">
              <div className="avs-severity-summary">
                {currentRun.criticalCount > 0 && <span className="avs-sev critical">{currentRun.criticalCount} Critical</span>}
                {currentRun.highCount > 0 && <span className="avs-sev high">{currentRun.highCount} High</span>}
                {currentRun.mediumCount > 0 && <span className="avs-sev medium">{currentRun.mediumCount} Medium</span>}
                {currentRun.lowCount > 0 && <span className="avs-sev low">{currentRun.lowCount} Low</span>}
                {currentRun.totalFindings === 0 && <span style={{ color: 'var(--green)' }}>No vulnerabilities found</span>}
              </div>
              <div className="avs-source-timing">
                {currentRun.localDbDurationMs !== null && (
                  <span className="avs-local-db-timing">
                    <Database size={13} />
                    Local DB: {currentRun.localDbDurationMs}ms ({currentRun.localDbFindings} findings)
                  </span>
                )}
                <span className="avs-legacy-sources">
                  {currentRun.osvFindings > 0 && <span>OSV: {currentRun.osvFindings}</span>}
                  {currentRun.githubFindings > 0 && <span>GitHub: {currentRun.githubFindings}</span>}
                  {currentRun.nvdFindings > 0 && <span>NVD: {currentRun.nvdFindings}</span>}
                </span>
              </div>
            </div>
          )}

          {currentRun.errorMessage && (
            <div className="avs-error">
              <AlertTriangle size={14} /> {currentRun.errorMessage}
            </div>
          )}
        </div>
      )}

      {/* Per-product breakdown */}
      {products.length > 0 && (
        <div className="avs-section">
          <h3 className="avs-section-title">Per-Product Breakdown</h3>
          <div className="avs-table-wrap">
            <table className="avs-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Findings</th>
                  <th>Critical</th>
                  <th>High</th>
                  <th>Medium</th>
                  <th>Low</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.productId}>
                    <td className="avs-product-name">{p.productName}</td>
                    <td><strong>{p.findingsCount}</strong></td>
                    <td>{p.criticalCount > 0 ? <span className="avs-count critical">{p.criticalCount}</span> : <span className="avs-count zero">0</span>}</td>
                    <td>{p.highCount > 0 ? <span className="avs-count high">{p.highCount}</span> : <span className="avs-count zero">0</span>}</td>
                    <td>{p.mediumCount > 0 ? <span className="avs-count medium">{p.mediumCount}</span> : <span className="avs-count zero">0</span>}</td>
                    <td>{p.lowCount > 0 ? <span className="avs-count low">{p.lowCount}</span> : <span className="avs-count zero">0</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scan history */}
      {history.length > 0 && (
        <div className="avs-section">
          <h3 className="avs-section-title">Scan History</h3>
          <div className="avs-table-wrap">
            <table className="avs-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Products</th>
                  <th>Deps</th>
                  <th>Findings</th>
                  <th>New</th>
                  <th>Duration</th>
                  <th>Triggered By</th>
                </tr>
              </thead>
              <tbody>
                {history.map(run => (
                  <tr key={run.id}>
                    <td style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{new Date(run.startedAt).toLocaleString()}</td>
                    <td>
                      <span className={'avs-type-badge ' + run.triggerType}>{run.triggerType}</span>
                    </td>
                    <td>
                      <span className={'avs-status-badge ' + run.status}>{run.status}</span>
                    </td>
                    <td>{run.totalProducts}</td>
                    <td>{run.totalUniqueDependencies}</td>
                    <td>
                      <strong>{run.totalFindings}</strong>
                      {run.criticalCount > 0 && <span style={{ color: '#dc2626', marginLeft: '0.25rem' }}>({run.criticalCount}C)</span>}
                    </td>
                    <td>{run.newFindingsCount > 0 ? <span style={{ color: 'var(--amber)' }}>{run.newFindingsCount}</span> : '0'}</td>
                    <td>{formatDuration(run.durationSeconds)}</td>
                    <td style={{ color: 'var(--muted)' }}>{run.triggeredBy || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!currentRun && history.length === 0 && (
        <div className="avs-empty">
          <Shield size={48} strokeWidth={1} />
          <p>No vulnerability scans have been run yet.</p>
          <p style={{ fontSize: '0.85rem' }}>Click "Run Platform Scan" to trigger the first scan, or wait for the daily 3:00 AM scheduled scan.</p>
        </div>
      )}
    </>
  );
}

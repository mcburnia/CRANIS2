import { useState, useEffect } from 'react';
import { Activity, Loader, Database, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import './AdminSystemPage.css';

interface ScanEntry {
  id: string;
  productName: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  findingsCount: number;
  durationSeconds: number | null;
  dependencyCount: number | null;
  osvDurationMs: number | null;
  osvFindings: number | null;
  githubDurationMs: number | null;
  githubFindings: number | null;
  nvdDurationMs: number | null;
  nvdFindings: number | null;
  localDbDurationMs: number | null;
  localDbFindings: number | null;
  triggeredBy: string | null;
  errorMessage: string | null;
}

interface SystemData {
  overview: {
    totalEvents: number;
    eventsToday: number;
    scansToday: number;
    avgScanDuration: string | null;
    errorRate: number;
  };
  scanPerformance: {
    totalScans: number;
    completedScans: number;
    failedScans: number;
    avgOsvMs: number | null;
    avgGithubMs: number | null;
    avgNvdMs: number | null;
    avgLocalDbMs: number | null;
  };
  recentScans: ScanEntry[];
  tableCounts: Record<string, number>;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const TABLE_LABELS: Record<string, string> = {
  users: 'Users',
  events: 'User Events',
  findings: 'Vulnerability Findings',
  scans: 'Vulnerability Scans',
  sboms: 'Product SBOMs',
  tech_sections: 'Technical File Sections',
  obligations: 'Obligations',
  stakeholders: 'Stakeholders',
  github_connections: 'GitHub Connections',
  sync_records: 'Sync History',
  vuln_db_advisories: 'Vuln DB Advisories',
  vuln_db_nvd: 'Vuln DB CVEs',
};

export default function AdminSystemPage() {
  const [data, setData] = useState<SystemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch('/api/admin/system', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch');
      setData(await res.json());
    } catch {
      setError('Failed to load system health data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="as-loading"><Loader size={32} className="as-spinner" /></div>;
  if (error || !data) return <div className="as-error">{error || 'No data'}</div>;

  return (
    <div className="admin-system">
      <PageHeader title="System Health" />

      <div className="as-stat-cards">
        <StatCard label="Total Events" value={data.overview.totalEvents.toLocaleString()} />
        <StatCard label="Scans Today" value={data.overview.scansToday} />
        <StatCard label="Avg Scan Duration" value={data.overview.avgScanDuration ? `${data.overview.avgScanDuration}s` : 'N/A'} />
        <StatCard
          label="Error Rate"
          value={`${data.overview.errorRate}%`}
          color={data.overview.errorRate > 10 ? 'red' : data.overview.errorRate > 0 ? 'amber' : 'green'}
        />
      </div>

      <div className="as-grid">
        {/* Scan Performance */}
        <div className="as-card">
          <div className="as-card-header">
            <Activity size={16} className="as-purple" />
            <h3>Scan Performance</h3>
          </div>
          <div className="as-card-body">
            <div className="as-metric-row">
              <span className="as-metric-label">Total Scans</span>
              <span className="as-metric-value">{data.scanPerformance.totalScans}</span>
            </div>
            <div className="as-metric-row">
              <span className="as-metric-label">Completed</span>
              <span className="as-metric-value as-green">{data.scanPerformance.completedScans}</span>
            </div>
            <div className="as-metric-row">
              <span className="as-metric-label">Failed</span>
              <span className="as-metric-value as-red">{data.scanPerformance.failedScans}</span>
            </div>
            <div className="as-divider" />
            {data.scanPerformance.avgLocalDbMs != null && (
              <>
                <div className="as-perf-header">Local DB Query</div>
                <div className="as-metric-row">
                  <span className="as-metric-label">Avg Latency</span>
                  <span className="as-metric-value as-accent">{data.scanPerformance.avgLocalDbMs}ms</span>
                </div>
                <div className="as-divider" />
              </>
            )}
            <div className="as-perf-header as-historical-label">Historical API Latency</div>
            <div className="as-metric-row as-historical">
              <span className="as-metric-label">OSV.dev</span>
              <span className="as-metric-value">{data.scanPerformance.avgOsvMs != null ? `${data.scanPerformance.avgOsvMs}ms` : 'N/A'}</span>
            </div>
            <div className="as-metric-row as-historical">
              <span className="as-metric-label">GitHub Advisory</span>
              <span className="as-metric-value">{data.scanPerformance.avgGithubMs != null ? `${data.scanPerformance.avgGithubMs}ms` : 'N/A'}</span>
            </div>
            <div className="as-metric-row as-historical">
              <span className="as-metric-label">NVD/NIST</span>
              <span className="as-metric-value">{data.scanPerformance.avgNvdMs != null ? `${data.scanPerformance.avgNvdMs}ms` : 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Database Stats */}
        <div className="as-card">
          <div className="as-card-header">
            <Database size={16} className="as-purple" />
            <h3>Database Row Counts</h3>
          </div>
          <div className="as-card-body">
            {Object.entries(data.tableCounts).map(([key, count]) => (
              <div key={key} className="as-metric-row">
                <span className="as-metric-label">{TABLE_LABELS[key] || key}</span>
                <span className="as-metric-value">{count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Scans Table */}
      <div className="as-scans-section">
        <h3>Recent Vulnerability Scans</h3>
        <div className="as-scans-table">
          <div className="as-scans-header">
            <span>Product</span>
            <span>Status</span>
            <span>Duration</span>
            <span>Findings</span>
            <span>Local DB</span>
            <span>Source Breakdown</span>
            <span>When</span>
          </div>
          {data.recentScans.length === 0 ? (
            <div className="as-scans-empty">No scans recorded yet</div>
          ) : (
            data.recentScans.map(scan => (
              <div key={scan.id} className={`as-scan-row ${scan.status === 'failed' ? 'as-scan-failed' : ''}`}>
                <span className="as-scan-product">{scan.productName}</span>
                <span className="as-scan-status">
                  {scan.status === 'completed' ? (
                    <span className="as-status-ok"><CheckCircle size={13} /> Done</span>
                  ) : scan.status === 'failed' ? (
                    <span className="as-status-fail"><XCircle size={13} /> Failed</span>
                  ) : (
                    <span className="as-status-run"><Clock size={13} /> Running</span>
                  )}
                </span>
                <span className="as-scan-duration">{scan.durationSeconds != null ? `${scan.durationSeconds}s` : '—'}</span>
                <span className="as-scan-findings">
                  {scan.findingsCount > 0 ? (
                    <span className="as-findings-badge"><AlertTriangle size={12} /> {scan.findingsCount}</span>
                  ) : '0'}
                </span>
                <span className="as-scan-localdb">
                  {scan.localDbDurationMs != null ? (
                    <span className="as-localdb-value">{scan.localDbDurationMs}ms</span>
                  ) : '—'}
                </span>
                <span className="as-scan-sources">
                  {scan.osvFindings != null && <span>OSV:{scan.osvFindings}</span>}
                  {scan.githubFindings != null && <span>GH:{scan.githubFindings}</span>}
                  {scan.nvdFindings != null && <span>NVD:{scan.nvdFindings}</span>}
                </span>
                <span className="as-scan-time">{timeAgo(scan.startedAt)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

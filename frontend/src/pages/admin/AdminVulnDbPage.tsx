import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Loader2, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import './AdminVulnDbPage.css';

interface EcosystemStatus {
  ecosystem: string;
  advisoryCount: number;
  packageCount: number;
  lastSyncAt: string | null;
  lastFullSyncAt: string | null;
  status: string;
  durationSeconds: number | null;
  errorMessage: string | null;
}

interface VulnDbStats {
  ecosystems: EcosystemStatus[];
  totalAdvisories: number;
  totalCVEs: number;
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
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

export default function AdminVulnDbPage() {
  const [data, setData] = useState<VulnDbStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const token = localStorage.getItem('session_token');

  const fetchStatus = useCallback(async () => {
    try {
      const resp = await fetch('/api/admin/vulnerability-db/status', {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (resp.ok) {
        const result = await resp.json();
        setData(result);
      }
    } catch {
      // ignore
    }
  }, [token]);

  useEffect(() => {
    fetchStatus().then(() => setLoading(false));
  }, [fetchStatus]);

  // Poll while any ecosystem is syncing
  useEffect(() => {
    if (!data) return;
    const hasRunning = data.ecosystems.some(e => e.status === 'running');
    if (!hasRunning) return;
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [data, fetchStatus]);

  const handleSync = async () => {
    if (syncing) return;
    if (!confirm('Start a full vulnerability database sync? This may take several minutes.')) return;

    setSyncing(true);
    try {
      const resp = await fetch('/api/admin/vulnerability-db/sync', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
      });
      if (resp.ok) {
        setTimeout(fetchStatus, 1000);
      }
    } catch (err) {
      console.error('Failed to trigger sync:', err);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Vulnerability Database" />
        <p style={{ color: 'var(--muted)' }}>Loading...</p>
      </>
    );
  }

  const ecosystems = data?.ecosystems || [];
  const totalAdvisories = data?.totalAdvisories || 0;
  const totalCVEs = data?.totalCVEs || 0;
  const ecosystemsSynced = ecosystems.filter(e => e.status === 'completed').length;
  const lastSync = ecosystems.reduce((latest: string | null, e) => {
    if (!e.lastSyncAt) return latest;
    if (!latest) return e.lastSyncAt;
    return new Date(e.lastSyncAt) > new Date(latest) ? e.lastSyncAt : latest;
  }, null);
  const hasRunning = ecosystems.some(e => e.status === 'running');

  return (
    <>
      <PageHeader title="Vulnerability Database">
        <button
          className="avdb-sync-btn"
          onClick={handleSync}
          disabled={syncing || hasRunning}
        >
          {hasRunning ? <Loader2 size={16} className="avdb-spinner" /> : <RefreshCw size={16} />}
          {hasRunning ? 'Syncing...' : 'Sync Now'}
        </button>
      </PageHeader>

      <div className="avdb-stat-row">
        <StatCard label="Total Advisories" value={totalAdvisories.toLocaleString()} color="blue" />
        <StatCard label="Total CVEs" value={totalCVEs.toLocaleString()} color="blue" />
        <StatCard label="Ecosystems Synced" value={ecosystemsSynced + ' / ' + ecosystems.length} color={ecosystemsSynced === ecosystems.length ? 'green' : 'amber'} />
        <StatCard label="Last Sync" value={formatTimeAgo(lastSync)} color="blue" />
      </div>

      <div className="avdb-section">
        <h3 className="avdb-section-title">Ecosystem Status</h3>
        <div className="avdb-table-wrap">
          <table className="avdb-table">
            <thead>
              <tr>
                <th>Ecosystem</th>
                <th>Advisories</th>
                <th>Packages</th>
                <th>Last Sync</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ecosystems.map(eco => (
                <tr key={eco.ecosystem}>
                  <td className="avdb-eco-name">{eco.ecosystem}</td>
                  <td>{eco.advisoryCount.toLocaleString()}</td>
                  <td>{eco.ecosystem === 'NVD' ? <span className="avdb-na">—</span> : eco.packageCount.toLocaleString()}</td>
                  <td className="avdb-muted">{formatTimeAgo(eco.lastSyncAt)}</td>
                  <td className="avdb-muted">{eco.durationSeconds !== null ? eco.durationSeconds + 's' : '—'}</td>
                  <td>
                    <span className={'avdb-status-badge ' + eco.status}>
                      {eco.status === 'completed' && <CheckCircle size={12} />}
                      {eco.status === 'running' && <Loader2 size={12} className="avdb-spinner" />}
                      {eco.status === 'error' && <XCircle size={12} />}
                      {eco.status}
                    </span>
                    {eco.errorMessage && (
                      <span className="avdb-error-hint" title={eco.errorMessage}>
                        <AlertTriangle size={12} />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="avdb-info-card">
        <Info size={18} />
        <div>
          <strong>Local Database Architecture</strong>
          <p>
            Zero external API calls during scans. Advisory data synced daily at 1:00 AM
            from OSV.dev and NVD community feeds. Scans query local Postgres, completing
            in seconds instead of minutes.
          </p>
        </div>
      </div>
    </>
  );
}

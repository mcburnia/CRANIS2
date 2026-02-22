import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { Package, Users, ScrollText, ShieldAlert } from 'lucide-react';
import './DashboardPage.css';

interface DashboardProduct {
  id: string;
  name: string;
  category: string | null;
  repoConnected: boolean;
  repoFullName: string | null;
  sbomPackageCount: number;
  sbomIsStale: boolean;
  contributorCount: number;
  techFileProgress: number;
  techFileSections: { total: number; completed: number };
  lastSync: string | null;
  riskFindings: { total: number; critical: number; high: number; open: number };
}

interface DashboardStats {
  totalProducts: number;
  connectedRepos: number;
  totalContributors: number;
  totalDependencies: number;
  staleSboms: number;
}

interface ActivityItem {
  eventType: string;
  userEmail: string;
  createdAt: string;
  metadata: Record<string, any> | null;
}

interface RiskFindingsSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  open: number;
  dismissed: number;
  lastScanAt: string | null;
}

interface DashboardData {
  products: DashboardProduct[];
  stats: DashboardStats;
  riskFindings: RiskFindingsSummary;
  recentActivity: ActivityItem[];
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

function formatCategory(cat: string | null): { label: string; color: string } {
  if (!cat) return { label: 'Unclassified', color: 'muted' };
  switch (cat) {
    case 'default': return { label: 'Default', color: 'green' };
    case 'important_i': return { label: 'Important I', color: 'amber' };
    case 'important_ii': return { label: 'Important II', color: 'amber' };
    case 'critical': return { label: 'Critical', color: 'red' };
    default: return { label: cat, color: 'blue' };
  }
}

function getStatusBadge(progress: number): { label: string; color: string } {
  if (progress === 0) return { label: 'Not Started', color: 'red' };
  if (progress >= 100) return { label: 'Complete', color: 'green' };
  return { label: 'In Progress', color: 'amber' };
}

function getActivityDotColor(eventType: string): string {
  if (eventType === 'login' || eventType === 'register') return 'blue';
  if (['github_repo_synced', 'sbom_refreshed', 'github_connected'].includes(eventType)) return 'green';
  if (eventType === 'webhook_sbom_stale') return 'amber';
  if (eventType === 'vulnerability_scan_triggered') return 'amber';
  if (eventType === 'vulnerability_finding_updated') return 'green';
  if (eventType.startsWith('login_failed')) return 'red';
  return 'blue';
}

function getActivityText(item: ActivityItem): string {
  const product = item.metadata?.productName;
  switch (item.eventType) {
    case 'github_repo_synced': return `Synced repository ${product || 'unknown'}`;
    case 'login': return `${item.userEmail} logged in`;
    case 'register': return 'Account registered';
    case 'webhook_sbom_stale': return 'SBOM marked as stale via webhook';
    case 'sbom_refreshed': return `SBOM refreshed for ${product || 'unknown'}`;
    case 'product_created': return `Product ${product || 'unknown'} created`;
    case 'github_connected': return 'GitHub connected';
    case 'org_created': return 'Organisation created';
    case 'login_failed_bad_password': return 'Failed login attempt';
    case 'vulnerability_scan_triggered': return `Vulnerability scan started for ${item.metadata?.productId ? 'product' : 'all products'}`;
    case 'vulnerability_finding_updated': return `Vulnerability finding ${item.metadata?.status || 'updated'}`;
    default: return item.eventType.replace(/_/g, ' ');
  }
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch('/api/dashboard/summary', {
          headers: { Authorization: `Bearer ${localStorage.getItem('session_token')}` },
        });
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <div className="welcome-banner">
          <h2>Loading dashboard...</h2>
          <p>Fetching your latest data</p>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <div className="welcome-banner">
          <h2>Unable to load dashboard</h2>
          <p>Please try refreshing the page</p>
        </div>
      </>
    );
  }

  const { products, stats, riskFindings, recentActivity } = data;

  // Find most recent sync across all products
  const lastSyncDates = products.map(p => p.lastSync).filter(Boolean) as string[];
  const mostRecentSync = lastSyncDates.length > 0
    ? new Date(Math.max(...lastSyncDates.map(d => new Date(d).getTime())))
    : null;
  const syncTimestamp = mostRecentSync
    ? `Last sync: ${mostRecentSync.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} UTC`
    : undefined;

  // Welcome banner message
  let bannerTitle = '';
  let bannerText = '';
  if (stats.totalProducts === 0) {
    bannerTitle = 'Get started';
    bannerText = 'Add your first product to begin tracking CRA compliance.';
  } else if (stats.connectedRepos === 0) {
    bannerTitle = `${stats.totalProducts} product${stats.totalProducts > 1 ? 's' : ''} added`;
    bannerText = 'Connect your GitHub repositories to start syncing dependencies and contributors.';
  } else {
    bannerTitle = `${stats.totalProducts} product${stats.totalProducts > 1 ? 's' : ''} tracked`;
    bannerText = `${stats.connectedRepos} repositor${stats.connectedRepos > 1 ? 'ies' : 'y'} connected. ${stats.totalDependencies} dependencies and ${stats.totalContributors} contributor${stats.totalContributors !== 1 ? 's' : ''} tracked.`;
  }

  return (
    <>
      <PageHeader title="Dashboard" timestamp={syncTimestamp} />

      <div className="welcome-banner">
        <h2>{bannerTitle}</h2>
        <p>{bannerText}</p>
      </div>

      <div className="stats">
        <StatCard label="Products" value={stats.totalProducts} color="blue" sub={`${stats.connectedRepos} with repos`} />
        <StatCard label="Connected Repos" value={stats.connectedRepos} color="blue" sub={stats.staleSboms > 0 ? `${stats.staleSboms} stale` : 'all fresh'} />
        <StatCard label="Contributors" value={stats.totalContributors} color="amber" />
        <StatCard label="Dependencies" value={stats.totalDependencies} color="green" sub={`across ${stats.connectedRepos} repo${stats.connectedRepos !== 1 ? 's' : ''}`} />
        <StatCard label="Risk Findings" value={riskFindings.total} color={riskFindings.critical > 0 ? 'red' : riskFindings.high > 0 ? 'amber' : 'green'} sub={riskFindings.total > 0 ? `${riskFindings.open} open` : riskFindings.lastScanAt ? 'none found' : 'not scanned yet'} />
      </div>

      <div className="section">
        <h3><Package size={18} /> Products & Compliance</h3>
        {products.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No products yet. <Link to="/products">Add your first product</Link>.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>CRA Category</th>
                <th>Technical File</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const cat = formatCategory(p.category);
                const status = getStatusBadge(p.techFileProgress);
                const progressColor = p.techFileProgress === 0 ? 'red' : p.techFileProgress >= 100 ? 'green' : 'amber';
                return (
                  <tr key={p.id}>
                    <td><Link to={`/products/${p.id}`}><strong>{p.name}</strong></Link></td>
                    <td><span className={`badge ${cat.color}`}>{cat.label}</span></td>
                    <td>
                      <div className="progress-bar"><div className={`progress-fill ${progressColor}`} style={{ width: `${Math.max(p.techFileProgress, 2)}%` }} /></div>
                      <span className="progress-text">{p.techFileProgress}%</span>
                    </td>
                    <td><span className={`badge ${status.color}`}>{status.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="section">
        <h3><ShieldAlert size={18} /> Dependency Risk Findings</h3>
        {riskFindings.total === 0 && !riskFindings.lastScanAt ? (
          <div className="risk-card">
            <div className="risk-header">
              <div className="risk-title">No Scans Yet</div>
            </div>
            <div className="risk-detail">Go to <Link to="/risk-findings">Risk Findings</Link> and click "Scan All Products" to check your dependencies for known vulnerabilities.</div>
          </div>
        ) : riskFindings.total === 0 ? (
          <div className="risk-card" style={{ borderColor: 'var(--green)' }}>
            <div className="risk-header">
              <div className="risk-title" style={{ color: 'var(--green)' }}>All Clear</div>
            </div>
            <div className="risk-detail">No known vulnerabilities found across your dependencies. Last scan: {riskFindings.lastScanAt ? new Date(riskFindings.lastScanAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'never'}.</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              {riskFindings.critical > 0 && <div className="risk-card" style={{ flex: 1, minWidth: '120px', borderColor: '#dc2626' }}><div className="risk-header"><div className="risk-title" style={{ color: '#dc2626', fontSize: '1.5rem', fontWeight: 700 }}>{riskFindings.critical}</div></div><div className="risk-detail" style={{ color: '#dc2626' }}>Critical</div></div>}
              {riskFindings.high > 0 && <div className="risk-card" style={{ flex: 1, minWidth: '120px', borderColor: '#f97316' }}><div className="risk-header"><div className="risk-title" style={{ color: '#f97316', fontSize: '1.5rem', fontWeight: 700 }}>{riskFindings.high}</div></div><div className="risk-detail" style={{ color: '#f97316' }}>High</div></div>}
              {riskFindings.medium > 0 && <div className="risk-card" style={{ flex: 1, minWidth: '120px' }}><div className="risk-header"><div className="risk-title" style={{ fontSize: '1.5rem', fontWeight: 700 }}>{riskFindings.medium}</div></div><div className="risk-detail">Medium</div></div>}
              {riskFindings.low > 0 && <div className="risk-card" style={{ flex: 1, minWidth: '120px' }}><div className="risk-header"><div className="risk-title" style={{ fontSize: '1.5rem', fontWeight: 700 }}>{riskFindings.low}</div></div><div className="risk-detail">Low</div></div>}
            </div>
            <table>
              <thead>
                <tr><th>Product</th><th>Findings</th><th>Critical</th><th>High</th><th>Open</th></tr>
              </thead>
              <tbody>
                {products.filter(p => p.riskFindings && p.riskFindings.total > 0).map(p => (
                  <tr key={p.id}>
                    <td><Link to={`/products/${p.id}?tab=risk-findings`}>{p.name}</Link></td>
                    <td>{p.riskFindings.total}</td>
                    <td>{p.riskFindings.critical > 0 ? <span style={{ color: '#dc2626', fontWeight: 600 }}>{p.riskFindings.critical}</span> : <span style={{ color: 'var(--muted)' }}>0</span>}</td>
                    <td>{p.riskFindings.high > 0 ? <span style={{ color: '#f97316', fontWeight: 600 }}>{p.riskFindings.high}</span> : <span style={{ color: 'var(--muted)' }}>0</span>}</td>
                    <td>{p.riskFindings.open}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
              {riskFindings.dismissed > 0 && <span>{riskFindings.dismissed} dismissed. </span>}
              Last scan: {riskFindings.lastScanAt ? new Date(riskFindings.lastScanAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'never'}.
              {' '}<Link to="/risk-findings" style={{ color: 'var(--accent)' }}>View all findings</Link>
            </div>
          </>
        )}
      </div>

      <div className="section">
        <h3><Users size={18} /> Contributor Overview</h3>
        {products.filter(p => p.repoConnected).length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Connect a GitHub repository to see contributor data.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Product</th><th>Contributors</th><th>Last Sync</th></tr>
            </thead>
            <tbody>
              {products.filter(p => p.repoConnected).map(p => (
                <tr key={p.id}>
                  <td><Link to={`/products/${p.id}`}>{p.name}</Link></td>
                  <td>{p.contributorCount}</td>
                  <td>{p.lastSync ? timeAgo(p.lastSync) : '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section">
        <h3><ScrollText size={18} /> Recent Activity</h3>
        {recentActivity.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No activity yet.</p>
        ) : (
          <div className="activity-feed">
            {recentActivity.map((item, i) => (
              <div key={i} className="activity-item">
                <div className={`activity-dot ${getActivityDotColor(item.eventType)}`} />
                <div className="activity-content">
                  <div className="activity-text">{getActivityText(item)}</div>
                  <div className="activity-time">{new Date(item.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

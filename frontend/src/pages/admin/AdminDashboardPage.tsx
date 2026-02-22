import { useState, useEffect } from 'react';
import { Shield, Users, AlertTriangle, CheckCircle, Activity, Loader } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import './AdminDashboardPage.css';

interface DashboardData {
  users: { total: number; active30d: number; platformAdmins: number; verified: number; unverified: number };
  organisations: { total: number };
  products: { total: number; withRepos: number; withSboms: number; totalPackages: number; byCategory: Record<string, number> };
  vulnerabilities: { total: number; critical: number; high: number; medium: number; low: number; open: number; dismissed: number; lastScanAt: string | null; scansLast7d: number };
  compliance: { obligationsTotal: number; obligationsMet: number; obligationsInProgress: number; techFileSections: number; techFileSectionsCompleted: number; techFileSectionsInProgress: number };
  recentActivity: { eventsLast7d: number; loginsLast7d: number; scansLast7d: number; events: Array<{ eventType: string; userEmail: string; createdAt: string; metadata: any }> };
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
    } catch {
      setError('Failed to load admin dashboard data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="admin-dashboard">
        <PageHeader title="Platform Admin Dashboard" />
        <div className="ad-loading"><Loader size={32} className="ad-spinner" /></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="admin-dashboard">
        <PageHeader title="Platform Admin Dashboard" />
        <div className="ad-error">{error || 'No data available'}</div>
      </div>
    );
  }

  const oblProgress = data.compliance.obligationsTotal > 0
    ? Math.round((data.compliance.obligationsMet / data.compliance.obligationsTotal) * 100) : 0;
  const tfProgress = data.compliance.techFileSections > 0
    ? Math.round((data.compliance.techFileSectionsCompleted / data.compliance.techFileSections) * 100) : 0;

  const vulnColorName: 'red' | 'amber' | 'green' = data.vulnerabilities.critical > 0 ? 'red'
    : data.vulnerabilities.high > 0 ? 'amber' : 'green';

  return (
    <div className="admin-dashboard">
      <PageHeader title="Platform Admin Dashboard" />

      <div className="ad-stat-cards">
        <StatCard label="Total Users" value={data.users.total} />
        <StatCard label="Organisations" value={data.organisations.total} />
        <StatCard label="Products" value={data.products.total} />
        <StatCard label="Open Vulnerabilities" value={data.vulnerabilities.open} color={vulnColorName} />
      </div>

      <div className="ad-grid">
        {/* Users Card */}
        <div className="ad-card">
          <div className="ad-card-header">
            <Users size={18} />
            <h3>Users</h3>
          </div>
          <div className="ad-card-body">
            <div className="ad-metric-row">
              <span className="ad-metric-label">Total registered</span>
              <span className="ad-metric-value">{data.users.total}</span>
            </div>
            <div className="ad-metric-row">
              <span className="ad-metric-label">Active (30 days)</span>
              <span className="ad-metric-value">{data.users.active30d}</span>
            </div>
            <div className="ad-metric-row">
              <span className="ad-metric-label">Platform admins</span>
              <span className="ad-metric-value ad-purple">{data.users.platformAdmins}</span>
            </div>
            <div className="ad-metric-row">
              <span className="ad-metric-label">Verified</span>
              <span className="ad-metric-value ad-green">{data.users.verified}</span>
            </div>
            {data.users.unverified > 0 && (
              <div className="ad-metric-row">
                <span className="ad-metric-label">Unverified</span>
                <span className="ad-metric-value ad-amber">{data.users.unverified}</span>
              </div>
            )}
          </div>
        </div>

        {/* Security Card */}
        <div className="ad-card">
          <div className="ad-card-header">
            <AlertTriangle size={18} />
            <h3>Security</h3>
          </div>
          <div className="ad-card-body">
            {data.vulnerabilities.total === 0 ? (
              <div className="ad-empty-state">
                <Shield size={24} color="var(--green)" />
                <span>No vulnerability scans yet</span>
              </div>
            ) : (
              <>
                <div className="ad-severity-bar">
                  {data.vulnerabilities.critical > 0 && <div className="ad-sev-segment ad-sev-critical" style={{ flex: data.vulnerabilities.critical }} title={`Critical: ${data.vulnerabilities.critical}`} />}
                  {data.vulnerabilities.high > 0 && <div className="ad-sev-segment ad-sev-high" style={{ flex: data.vulnerabilities.high }} title={`High: ${data.vulnerabilities.high}`} />}
                  {data.vulnerabilities.medium > 0 && <div className="ad-sev-segment ad-sev-medium" style={{ flex: data.vulnerabilities.medium }} title={`Medium: ${data.vulnerabilities.medium}`} />}
                  {data.vulnerabilities.low > 0 && <div className="ad-sev-segment ad-sev-low" style={{ flex: data.vulnerabilities.low }} title={`Low: ${data.vulnerabilities.low}`} />}
                </div>
                <div className="ad-severity-legend">
                  {data.vulnerabilities.critical > 0 && <span className="ad-legend-item"><span className="ad-dot ad-dot-critical" />{data.vulnerabilities.critical} Critical</span>}
                  {data.vulnerabilities.high > 0 && <span className="ad-legend-item"><span className="ad-dot ad-dot-high" />{data.vulnerabilities.high} High</span>}
                  {data.vulnerabilities.medium > 0 && <span className="ad-legend-item"><span className="ad-dot ad-dot-medium" />{data.vulnerabilities.medium} Medium</span>}
                  {data.vulnerabilities.low > 0 && <span className="ad-legend-item"><span className="ad-dot ad-dot-low" />{data.vulnerabilities.low} Low</span>}
                </div>
                <div className="ad-metric-row">
                  <span className="ad-metric-label">Open</span>
                  <span className="ad-metric-value">{data.vulnerabilities.open}</span>
                </div>
                <div className="ad-metric-row">
                  <span className="ad-metric-label">Dismissed</span>
                  <span className="ad-metric-value">{data.vulnerabilities.dismissed}</span>
                </div>
                {data.vulnerabilities.lastScanAt && (
                  <div className="ad-metric-row">
                    <span className="ad-metric-label">Last scan</span>
                    <span className="ad-metric-value ad-small">{new Date(data.vulnerabilities.lastScanAt).toLocaleString()}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Compliance Card */}
        <div className="ad-card">
          <div className="ad-card-header">
            <CheckCircle size={18} />
            <h3>Compliance</h3>
          </div>
          <div className="ad-card-body">
            <div className="ad-progress-section">
              <div className="ad-progress-label">
                <span>Obligations</span>
                <span>{data.compliance.obligationsMet}/{data.compliance.obligationsTotal} met ({oblProgress}%)</span>
              </div>
              <div className="ad-progress-bar">
                <div className="ad-progress-fill ad-fill-green" style={{ width: `${oblProgress}%` }} />
              </div>
            </div>
            <div className="ad-progress-section">
              <div className="ad-progress-label">
                <span>Technical Files</span>
                <span>{data.compliance.techFileSectionsCompleted}/{data.compliance.techFileSections} complete ({tfProgress}%)</span>
              </div>
              <div className="ad-progress-bar">
                <div className="ad-progress-fill ad-fill-accent" style={{ width: `${tfProgress}%` }} />
              </div>
            </div>
            <div className="ad-metric-row" style={{ marginTop: '0.75rem' }}>
              <span className="ad-metric-label">Products with repos</span>
              <span className="ad-metric-value">{data.products.withRepos}/{data.products.total}</span>
            </div>
            <div className="ad-metric-row">
              <span className="ad-metric-label">Products with SBOMs</span>
              <span className="ad-metric-value">{data.products.withSboms}/{data.products.total}</span>
            </div>
            <div className="ad-metric-row">
              <span className="ad-metric-label">Total packages tracked</span>
              <span className="ad-metric-value">{data.products.totalPackages}</span>
            </div>
          </div>
        </div>

        {/* Activity Card */}
        <div className="ad-card">
          <div className="ad-card-header">
            <Activity size={18} />
            <h3>Activity (7 days)</h3>
          </div>
          <div className="ad-card-body">
            <div className="ad-metric-row">
              <span className="ad-metric-label">Total events</span>
              <span className="ad-metric-value">{data.recentActivity.eventsLast7d}</span>
            </div>
            <div className="ad-metric-row">
              <span className="ad-metric-label">Logins</span>
              <span className="ad-metric-value">{data.recentActivity.loginsLast7d}</span>
            </div>
            <div className="ad-metric-row">
              <span className="ad-metric-label">Vulnerability scans</span>
              <span className="ad-metric-value">{data.recentActivity.scansLast7d}</span>
            </div>
            {data.recentActivity.events.length > 0 && (
              <div className="ad-recent-events">
                <div className="ad-recent-label">Recent Events</div>
                {data.recentActivity.events.slice(0, 5).map((event, i) => (
                  <div className="ad-event-row" key={i}>
                    <span className={`ad-event-dot ad-event-${getEventColor(event.eventType)}`} />
                    <span className="ad-event-type">{formatEventType(event.eventType)}</span>
                    <span className="ad-event-user">{event.userEmail}</span>
                    <span className="ad-event-time">{timeAgo(event.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatEventType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getEventColor(type: string): string {
  if (type.includes('login')) return 'green';
  if (type.includes('created') || type.includes('register')) return 'accent';
  if (type.includes('vulnerability') || type.includes('scan')) return 'amber';
  if (type.includes('failed') || type.includes('error')) return 'red';
  return 'muted';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

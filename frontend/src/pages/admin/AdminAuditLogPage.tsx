import { useState, useEffect } from 'react';
import { Search, Loader, ChevronLeft, ChevronRight, Filter, Building2 } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import './AdminAuditLogPage.css';

interface AuditEvent {
  id: string;
  eventType: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  userEmail: string;
  orgName: string | null;
}

const EVENT_COLORS: Record<string, string> = {
  login: 'var(--accent)',
  register: 'var(--green)',
  login_failed_no_user: 'var(--red)',
  login_failed_bad_password: 'var(--red)',
  email_verified: 'var(--green)',
  org_created: 'var(--purple)',
  org_updated: 'var(--purple)',
  product_created: 'var(--green)',
  product_updated: 'var(--accent)',
  product_deleted: 'var(--red)',
  github_connected: 'var(--green)',
  github_repo_synced: 'var(--accent)',
  sbom_refreshed: 'var(--accent)',
  webhook_sbom_stale: 'var(--amber)',
  vulnerability_scan_triggered: 'var(--amber)',
  vulnerability_finding_updated: 'var(--green)',
  platform_admin_granted: 'var(--purple)',
  platform_admin_revoked: 'var(--red)',
};

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

export default function AdminAuditLogPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterEmail, setFilterEmail] = useState('');

  useEffect(() => { fetchEvents(1); }, [filterType, filterEmail]);

  async function fetchEvents(page: number) {
    setLoading(true);
    try {
      const token = localStorage.getItem('session_token');
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (filterType) params.set('eventType', filterType);
      if (filterEmail) params.set('email', filterEmail);

      const res = await fetch(`/api/admin/audit-log?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setEvents(data.events);
      setEventTypes(data.eventTypes);
      setPagination(data.pagination);
    } catch {
      setError('Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }

  if (error && events.length === 0) return <div className="aal-error">{error}</div>;

  return (
    <div className="admin-audit-log">
      <PageHeader title="Cross-Organisation Audit Log" />

      <div className="aal-stat-cards">
        <StatCard label="Total Events" value={pagination.total} />
        <StatCard label="Current Page" value={`${pagination.page} / ${pagination.totalPages}`} />
      </div>

      <div className="aal-controls">
        <div className="aal-search-bar">
          <Search size={16} className="aal-search-icon" />
          <input
            type="text"
            placeholder="Filter by email..."
            value={filterEmail}
            onChange={e => setFilterEmail(e.target.value)}
            className="aal-search-input"
          />
        </div>
        <div className="aal-type-filter">
          <Filter size={14} />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="aal-select"
          >
            <option value="">All event types</option>
            {eventTypes.map(t => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="aal-table">
        <div className="aal-table-header">
          <span className="aal-col-time">Time</span>
          <span className="aal-col-type">Event</span>
          <span className="aal-col-user">User</span>
          <span className="aal-col-org">Organisation</span>
          <span className="aal-col-ip">IP</span>
        </div>

        {loading ? (
          <div className="aal-loading"><Loader size={20} className="aal-spinner" /></div>
        ) : events.length === 0 ? (
          <div className="aal-empty">No events found</div>
        ) : (
          events.map(ev => (
            <div key={ev.id} className="aal-row">
              <span className="aal-col-time" title={new Date(ev.createdAt).toLocaleString()}>
                {timeAgo(ev.createdAt)}
              </span>
              <span className="aal-col-type">
                <span className="aal-event-dot" style={{ background: EVENT_COLORS[ev.eventType] || 'var(--muted)' }} />
                <span className="aal-event-label">{ev.eventType.replace(/_/g, ' ')}</span>
              </span>
              <span className="aal-col-user">{ev.userEmail}</span>
              <span className="aal-col-org">
                {ev.orgName ? (
                  <span className="aal-org-badge"><Building2 size={11} /> {ev.orgName}</span>
                ) : (
                  <span className="aal-no-val">—</span>
                )}
              </span>
              <span className="aal-col-ip">{ev.ipAddress || '—'}</span>
            </div>
          ))
        )}
      </div>

      {pagination.totalPages > 1 && (
        <div className="aal-pagination">
          <button
            className="aal-page-btn"
            disabled={pagination.page <= 1}
            onClick={() => fetchEvents(pagination.page - 1)}
          >
            <ChevronLeft size={16} /> Previous
          </button>
          <span className="aal-page-info">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            className="aal-page-btn"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => fetchEvents(pagination.page + 1)}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

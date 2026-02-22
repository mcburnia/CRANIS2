import { useState, useEffect, useCallback } from 'react';
import PageHeader from '../../components/PageHeader';
import {
  Shield, LogIn, UserPlus, Building2, AlertTriangle,
  Globe, Monitor, Clock, ChevronLeft, ChevronRight,
  Filter, RefreshCw
} from 'lucide-react';
import './AuditLogPage.css';

interface AuditEvent {
  id: string;
  eventType: string;
  ipAddress: string | null;
  userAgent: string | null;
  acceptLanguage: string | null;
  browserLanguage: string | null;
  browserTimezone: string | null;
  referrer: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  userEmail: string;
}

const EVENT_LABELS: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  register: { label: 'Account Registered', icon: UserPlus, color: 'var(--green)' },
  register_reverify_dev: { label: 'Re-verified (Dev)', icon: UserPlus, color: 'var(--amber)' },
  register_resend_verification: { label: 'Verification Resent', icon: UserPlus, color: 'var(--amber)' },
  login: { label: 'Login', icon: LogIn, color: 'var(--accent)' },
  login_failed_no_user: { label: 'Failed Login (Unknown User)', icon: AlertTriangle, color: 'var(--red)' },
  login_failed_bad_password: { label: 'Failed Login (Wrong Password)', icon: AlertTriangle, color: 'var(--red)' },
  email_verified: { label: 'Email Verified', icon: Shield, color: 'var(--green)' },
  org_created: { label: 'Organisation Created', icon: Building2, color: 'var(--purple)' },
};

function getEventInfo(eventType: string) {
  return EVENT_LABELS[eventType] || { label: eventType, icon: Shield, color: 'var(--muted)' };
}

function parseBrowserShort(userAgent: string | null): string {
  if (!userAgent) return '—';
  const ua = userAgent.toLowerCase();
  let browser = 'Other';
  if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('chrome') && !ua.includes('edg/')) browser = 'Chrome';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';

  let os = '';
  if (ua.includes('mac os') || ua.includes('macintosh')) os = 'macOS';
  else if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('linux') && !ua.includes('android')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

  return os ? `${browser} / ${os}` : browser;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  }) + ' ' + d.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const PAGE_SIZE = 25;

export default function AuditLogPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [filterType, setFilterType] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('session_token');
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (filterType) params.set('event_type', filterType);

      const res = await fetch(`/api/audit-log?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events);
        setTotal(data.total);
        setEventTypes(data.eventTypes);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [page, filterType]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <PageHeader title="Audit Log" />

      <div className="audit-toolbar">
        <div className="audit-filter">
          <Filter size={16} />
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(0); }}
          >
            <option value="">All Events</option>
            {eventTypes.map(t => (
              <option key={t} value={t}>{getEventInfo(t).label}</option>
            ))}
          </select>
        </div>
        <div className="audit-meta">
          <span className="audit-count">{total} event{total !== 1 ? 's' : ''}</span>
          <button className="audit-refresh" onClick={fetchEvents} title="Refresh">
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      <div className="audit-table-wrap">
        <table className="audit-table">
          <thead>
            <tr>
              <th>Event</th>
              <th>User</th>
              <th>Location</th>
              <th>Time</th>
              <th>IP Address</th>
              <th>Device</th>
            </tr>
          </thead>
          <tbody>
            {loading && events.length === 0 ? (
              <tr><td colSpan={6} className="audit-loading">Loading...</td></tr>
            ) : events.length === 0 ? (
              <tr><td colSpan={6} className="audit-empty">No events found</td></tr>
            ) : events.map(event => {
              const info = getEventInfo(event.eventType);
              const Icon = info.icon;
              const isExpanded = expandedId === event.id;

              return (
                <tr key={event.id} className="audit-row" onClick={() => setExpandedId(isExpanded ? null : event.id)}>
                  <td>
                    <div className="audit-event-cell">
                      <Icon size={16} style={{ color: info.color, flexShrink: 0 }} />
                      <span className="audit-event-label">{info.label}</span>
                    </div>
                  </td>
                  <td className="audit-email">{event.userEmail}</td>
                  <td>
                    {event.browserTimezone ? (
                      <div className="audit-location">
                        <Globe size={14} />
                        {event.browserTimezone}
                      </div>
                    ) : '—'}
                  </td>
                  <td>
                    <div className="audit-time">
                      <span className="audit-time-ago">{timeAgo(event.createdAt)}</span>
                      <span className="audit-time-full">{formatTimestamp(event.createdAt)}</span>
                    </div>
                  </td>
                  <td className="audit-mono">{event.ipAddress || '—'}</td>
                  <td>{parseBrowserShort(event.userAgent)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Expanded detail panel */}
      {expandedId && (() => {
        const event = events.find(e => e.id === expandedId);
        if (!event) return null;
        const info = getEventInfo(event.eventType);
        return (
          <div className="audit-detail">
            <div className="audit-detail-header">
              <strong>{info.label}</strong>
              <span className="audit-detail-time">{formatTimestamp(event.createdAt)}</span>
            </div>
            <div className="audit-detail-grid">
              <div className="audit-detail-item">
                <Monitor size={14} /> <label>User Agent</label>
                <span>{event.userAgent || '—'}</span>
              </div>
              <div className="audit-detail-item">
                <Globe size={14} /> <label>Accept-Language</label>
                <span>{event.acceptLanguage || '—'}</span>
              </div>
              <div className="audit-detail-item">
                <Globe size={14} /> <label>Browser Language</label>
                <span>{event.browserLanguage || '—'}</span>
              </div>
              <div className="audit-detail-item">
                <Clock size={14} /> <label>Browser Timezone</label>
                <span>{event.browserTimezone || '—'}</span>
              </div>
              {event.referrer && (
                <div className="audit-detail-item">
                  <Globe size={14} /> <label>Referrer</label>
                  <span>{event.referrer}</span>
                </div>
              )}
              {event.metadata && Object.keys(event.metadata).length > 0 && (
                <div className="audit-detail-item audit-detail-meta">
                  <Shield size={14} /> <label>Metadata</label>
                  <pre>{JSON.stringify(event.metadata, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {totalPages > 1 && (
        <div className="audit-pagination">
          <button
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft size={16} /> Previous
          </button>
          <span>Page {page + 1} of {totalPages}</span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}
    </>
  );
}

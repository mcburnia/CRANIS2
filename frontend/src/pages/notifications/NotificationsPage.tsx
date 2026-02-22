import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import './NotificationsPage.css';

interface Notification {
  id: string;
  type: string;
  severity: string;
  title: string;
  body: string;
  link: string | null;
  metadata: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

const TYPE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'vulnerability_found', label: 'Vulnerability' },
  { value: 'sbom_stale', label: 'Stale SBOM' },
  { value: 'scan_failed', label: 'Scan Failed' },
  { value: 'sync_failed', label: 'Sync Failed' },
];

const READ_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'false', label: 'Unread' },
  { value: 'true', label: 'Read' },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + 'm ago';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  if (days < 30) return days + 'd ago';
  return new Date(dateStr).toLocaleDateString();
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'var(--red)';
    case 'high': return 'var(--red)';
    case 'medium': return 'var(--amber)';
    case 'low': return 'var(--green)';
    default: return 'var(--accent)';
  }
}

function typeBadgeClass(type: string): string {
  switch (type) {
    case 'vulnerability_found': return 'badge-vuln';
    case 'sbom_stale': return 'badge-stale';
    case 'scan_failed': return 'badge-fail';
    case 'sync_failed': return 'badge-fail';
    default: return 'badge-info';
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case 'vulnerability_found': return 'Vulnerability';
    case 'sbom_stale': return 'Stale SBOM';
    case 'scan_failed': return 'Scan Failed';
    case 'sync_failed': return 'Sync Failed';
    default: return type;
  }
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [readFilter, setReadFilter] = useState('all');

  const token = localStorage.getItem('session_token');

  const fetchNotifications = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (readFilter !== 'all') params.set('read', readFilter);
      params.set('limit', '100');

      const res = await fetch(`/api/notifications?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setTotalCount(data.totalCount || 0);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token, typeFilter, readFilter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  async function markAsRead(id: string) {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchNotifications();
    } catch {
      // ignore
    }
  }

  async function markAllAsRead() {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchNotifications();
    } catch {
      // ignore
    }
  }

  function handleNotificationClick(notif: Notification) {
    if (!notif.is_read) {
      markAsRead(notif.id);
    }
    if (notif.link) {
      navigate(notif.link);
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Notifications" />
        <p style={{ color: 'var(--muted)' }}>Loading notifications...</p>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Notifications">
        {unreadCount > 0 && (
          <button className="mark-all-read-btn" onClick={markAllAsRead}>
            Mark all as read
          </button>
        )}
      </PageHeader>

      <div className="stat-grid">
        <StatCard label="Total" value={totalCount} color="blue" />
        <StatCard label="Unread" value={unreadCount} color={unreadCount > 0 ? 'red' : 'green'} />
      </div>

      <div className="notif-filters">
        <div className="filter-group">
          <span className="filter-label">Type</span>
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`filter-chip${typeFilter === opt.value ? ' active' : ''}`}
              onClick={() => setTypeFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="filter-group">
          <span className="filter-label">Status</span>
          {READ_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`filter-chip${readFilter === opt.value ? ' active' : ''}`}
              onClick={() => setReadFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="notif-empty">
          <p>No notifications found</p>
        </div>
      ) : (
        <div className="notif-list">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`notif-item${notif.is_read ? ' read' : ' unread'}`}
              onClick={() => handleNotificationClick(notif)}
            >
              <div
                className="notif-severity-dot"
                style={{ background: severityColor(notif.severity) }}
                title={notif.severity}
              />
              <div className="notif-content">
                <div className="notif-title-row">
                  <span className="notif-title">{notif.title}</span>
                  <span className={`notif-type-badge ${typeBadgeClass(notif.type)}`}>
                    {typeLabel(notif.type)}
                  </span>
                </div>
                <div className="notif-body">{notif.body}</div>
                <div className="notif-meta">
                  <span className="notif-time">{timeAgo(notif.created_at)}</span>
                  {notif.link && <span className="notif-link-hint">Click to view</span>}
                </div>
              </div>
              {!notif.is_read && (
                <button
                  className="notif-read-btn"
                  onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                  title="Mark as read"
                >
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

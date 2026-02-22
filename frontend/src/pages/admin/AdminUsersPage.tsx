import { useState, useEffect } from 'react';
import { Shield, CheckCircle, Search, Loader, Clock, Mail, Building2, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import './AdminUsersPage.css';

interface AdminUser {
  id: string;
  email: string;
  orgId: string | null;
  orgName: string | null;
  orgRole: string | null;
  emailVerified: boolean;
  isPlatformAdmin: boolean;
  preferredLanguage: string | null;
  lastLogin: string | null;
  createdAt: string;
}

type FilterType = 'all' | 'admins' | 'unverified' | 'active';

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totals, setTotals] = useState({ total: 0, verified: 0, platformAdmins: 0, active30d: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [toggling, setToggling] = useState<string | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<{ userId: string; email: string; newStatus: boolean } | null>(null);

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setUsers(data.users);
      setTotals(data.totals);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  async function toggleAdmin(userId: string, isPlatformAdmin: boolean) {
    setToggling(userId);
    setConfirmToggle(null);
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`/api/admin/users/${userId}/platform-admin`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPlatformAdmin }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to update');
        return;
      }
      await fetchUsers();
    } catch {
      alert('Network error');
    } finally {
      setToggling(null);
    }
  }

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const filtered = users.filter(u => {
    if (search && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'admins' && !u.isPlatformAdmin) return false;
    if (filter === 'unverified' && u.emailVerified) return false;
    if (filter === 'active' && (!u.lastLogin || new Date(u.lastLogin).getTime() < thirtyDaysAgo)) return false;
    return true;
  });

  if (loading) return <div className="au-loading"><Loader size={32} className="au-spinner" /></div>;
  if (error) return <div className="au-error">{error}</div>;

  return (
    <div className="admin-users">
      <PageHeader title="User Management" />

      <div className="au-stat-cards">
        <StatCard label="Total Users" value={totals.total} />
        <StatCard label="Verified" value={totals.verified} color="green" />
        <StatCard label="Platform Admins" value={totals.platformAdmins} color="amber" />
        <StatCard label="Active (30d)" value={totals.active30d} color="blue" />
      </div>

      <div className="au-controls">
        <div className="au-search-bar">
          <Search size={16} className="au-search-icon" />
          <input
            type="text"
            placeholder="Search by email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="au-search-input"
          />
        </div>
        <div className="au-filters">
          {(['all', 'admins', 'unverified', 'active'] as FilterType[]).map(f => (
            <button
              key={f}
              className={`au-filter-btn ${filter === f ? 'au-filter-active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'admins' ? 'Admins' : f === 'unverified' ? 'Unverified' : 'Active'}
            </button>
          ))}
        </div>
      </div>

      <div className="au-user-table">
        <div className="au-table-header">
          <span className="au-col-email">Email</span>
          <span className="au-col-org">Organisation</span>
          <span className="au-col-status">Status</span>
          <span className="au-col-login">Last Login</span>
          <span className="au-col-admin">Admin</span>
        </div>

        {filtered.length === 0 && (
          <div className="au-empty">No users match the current filters</div>
        )}

        {filtered.map(u => (
          <div key={u.id} className={`au-user-row ${u.isPlatformAdmin ? 'au-row-admin' : ''}`}>
            <div className="au-col-email">
              <Mail size={14} className="au-row-icon" />
              <span className="au-email-text">{u.email}</span>
              {u.id === currentUser?.id && <span className="au-you-badge">You</span>}
            </div>
            <div className="au-col-org">
              {u.orgName ? (
                <span className="au-org-link">
                  <Building2 size={12} /> {u.orgName}
                </span>
              ) : (
                <span className="au-no-org">No org</span>
              )}
            </div>
            <div className="au-col-status">
              {u.emailVerified ? (
                <span className="au-status-badge au-verified"><CheckCircle size={12} /> Verified</span>
              ) : (
                <span className="au-status-badge au-unverified"><XCircle size={12} /> Unverified</span>
              )}
            </div>
            <div className="au-col-login">
              <Clock size={12} />
              <span>{timeAgo(u.lastLogin)}</span>
            </div>
            <div className="au-col-admin">
              {u.id === currentUser?.id ? (
                <span className="au-admin-self">
                  <Shield size={14} />
                </span>
              ) : (
                <button
                  className={`au-admin-toggle ${u.isPlatformAdmin ? 'au-toggle-on' : 'au-toggle-off'}`}
                  onClick={() => setConfirmToggle({ userId: u.id, email: u.email, newStatus: !u.isPlatformAdmin })}
                  disabled={toggling === u.id}
                >
                  <Shield size={14} />
                  {toggling === u.id ? '...' : u.isPlatformAdmin ? 'Admin' : 'User'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation modal */}
      {confirmToggle && (
        <div className="au-modal-overlay" onClick={() => setConfirmToggle(null)}>
          <div className="au-modal" onClick={e => e.stopPropagation()}>
            <h3>{confirmToggle.newStatus ? 'Grant' : 'Revoke'} Platform Admin</h3>
            <p>
              {confirmToggle.newStatus
                ? `Grant platform admin access to ${confirmToggle.email}? They will be able to manage all organisations and users.`
                : `Revoke platform admin access from ${confirmToggle.email}? They will lose access to the admin panel.`}
            </p>
            <div className="au-modal-actions">
              <button className="au-btn-cancel" onClick={() => setConfirmToggle(null)}>Cancel</button>
              <button
                className={`au-btn-confirm ${confirmToggle.newStatus ? 'au-btn-grant' : 'au-btn-revoke'}`}
                onClick={() => toggleAdmin(confirmToggle.userId, confirmToggle.newStatus)}
              >
                {confirmToggle.newStatus ? 'Grant Admin' : 'Revoke Admin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

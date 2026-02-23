import { useState, useEffect } from 'react';
import { Shield, CheckCircle, Search, Loader, Clock, Mail, Building2, XCircle, UserPlus, MoreVertical, Edit3, Ban, Trash2, Undo2 } from 'lucide-react';
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
  suspendedAt: string | null;
  suspendedBy: string | null;
}

interface OrgOption {
  id: string;
  name: string;
}

type FilterType = 'all' | 'admins' | 'unverified' | 'active' | 'suspended';

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

  // Action menu state
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ userId: string; email: string; action: 'suspend' | 'unsuspend' | 'delete' } | null>(null);
  const [editUser, setEditUser] = useState<{ id: string; email: string; orgRole: string | null } | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Invite state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteOrgId, setInviteOrgId] = useState('');
  const [inviteAdmin, setInviteAdmin] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [orgs, setOrgs] = useState<OrgOption[]>([]);

  useEffect(() => { fetchUsers(); fetchOrgs(); }, []);

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

  async function fetchOrgs() {
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch('/api/admin/orgs', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      setOrgs(data.orgs.map((o: any) => ({ id: o.id, name: o.name })));
    } catch {
      // Non-critical — invite will still work without org selection
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

  async function handleInvite() {
    setInviting(true);
    setInviteError('');
    setInviteSuccess('');
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          orgId: inviteOrgId || undefined,
          isPlatformAdmin: inviteAdmin,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error || 'Failed to send invite');
        return;
      }
      setInviteSuccess(`Invitation sent to ${inviteEmail}${data.reinvite ? ' (re-sent)' : ''}`);
      setInviteEmail('');
      setInviteOrgId('');
      setInviteAdmin(false);
      await fetchUsers();
    } catch {
      setInviteError('Network error');
    } finally {
      setInviting(false);
    }
  }

  async function handleSuspend(userId: string, suspend: boolean) {
    setActionLoading(true);
    setActionError('');
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspend }),
      });
      if (!res.ok) { const d = await res.json(); setActionError(d.error || 'Failed'); return; }
      setConfirmAction(null);
      await fetchUsers();
    } catch { setActionError('Network error'); }
    finally { setActionLoading(false); }
  }

  async function handleDeleteUser(userId: string) {
    setActionLoading(true);
    setActionError('');
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const d = await res.json(); setActionError(d.error || 'Failed'); return; }
      setConfirmAction(null);
      await fetchUsers();
    } catch { setActionError('Network error'); }
    finally { setActionLoading(false); }
  }

  async function handleEditUser() {
    if (!editUser) return;
    setActionLoading(true);
    setActionError('');
    try {
      const token = localStorage.getItem('session_token');
      const body: any = {};
      if (editEmail && editEmail !== editUser.email) body.email = editEmail;
      if (editRole && editRole !== editUser.orgRole) body.orgRole = editRole;
      if (Object.keys(body).length === 0) { setEditUser(null); return; }

      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setActionError(d.error || 'Failed'); return; }
      setEditUser(null);
      await fetchUsers();
    } catch { setActionError('Network error'); }
    finally { setActionLoading(false); }
  }

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const filtered = users.filter(u => {
    if (search && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'admins' && !u.isPlatformAdmin) return false;
    if (filter === 'unverified' && u.emailVerified) return false;
    if (filter === 'active' && (!u.lastLogin || new Date(u.lastLogin).getTime() < thirtyDaysAgo)) return false;
    if (filter === 'suspended' && !u.suspendedAt) return false;
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
        <div className="au-controls-right">
          <div className="au-filters">
            {(['all', 'admins', 'unverified', 'active', 'suspended'] as FilterType[]).map(f => (
              <button
                key={f}
                className={`au-filter-btn ${filter === f ? 'au-filter-active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'admins' ? 'Admins' : f === 'unverified' ? 'Unverified' : f === 'active' ? 'Active' : 'Suspended'}
              </button>
            ))}
          </div>
          <button className="au-invite-btn" onClick={() => { setShowInviteModal(true); setInviteError(''); setInviteSuccess(''); }}>
            <UserPlus size={16} /> Invite User
          </button>
        </div>
      </div>

      <div className="au-user-table">
        <div className="au-table-header">
          <span className="au-col-email">Email</span>
          <span className="au-col-org">Organisation</span>
          <span className="au-col-status">Status</span>
          <span className="au-col-login">Last Login</span>
          <span className="au-col-admin">Admin</span>
          <span className="au-col-actions">Actions</span>
        </div>

        {filtered.length === 0 && (
          <div className="au-empty">No users match the current filters</div>
        )}

        {filtered.map(u => (
          <div key={u.id} className={`au-user-row ${u.isPlatformAdmin ? 'au-row-admin' : ''}`}>
            <div className="au-col-email">
              <Mail size={14} className="au-row-icon" />
              <span className="au-email-text">{u.email}</span>
              {u.email === currentUser?.email && <span className="au-you-badge">You</span>}
            </div>
            <div className="au-col-org">
              {u.orgName ? (
                <span className="au-org-link">
                  <Building2 size={12} /> {u.orgName}
                  {u.orgRole && <span className="au-role-badge">{u.orgRole}</span>}
                </span>
              ) : (
                <span className="au-no-org">No org</span>
              )}
            </div>
            <div className="au-col-status">
              {u.suspendedAt ? (
                <span className="au-status-badge au-suspended"><Ban size={12} /> Suspended</span>
              ) : u.emailVerified ? (
                <span className="au-status-badge au-verified"><CheckCircle size={12} /> Verified</span>
              ) : (
                <span className="au-status-badge au-unverified"><XCircle size={12} /> Invited</span>
              )}
            </div>
            <div className="au-col-login">
              <Clock size={12} />
              <span>{timeAgo(u.lastLogin)}</span>
            </div>
            <div className="au-col-admin">
              {u.email === currentUser?.email ? (
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
            <div className="au-col-actions">
              <div className="au-action-menu-wrap">
                  <button className="au-action-trigger" onClick={(e) => { e.stopPropagation(); setActionMenuId(actionMenuId === u.id ? null : u.id); }}>
                    <MoreVertical size={16} />
                  </button>
                  {actionMenuId === u.id && (
                    <div className="au-action-dropdown">
                      <button onClick={() => { setEditUser({ id: u.id, email: u.email, orgRole: u.orgRole }); setEditEmail(u.email); setEditRole(u.orgRole || 'member'); setActionMenuId(null); setActionError(''); }}>
                        <Edit3 size={13} /> Edit
                      </button>
                      {u.email === currentUser?.email ? null : u.suspendedAt ? (
                        <button onClick={() => { setConfirmAction({ userId: u.id, email: u.email, action: 'unsuspend' }); setActionMenuId(null); setActionError(''); }}>
                          <Undo2 size={13} /> Unsuspend
                        </button>
                      ) : (
                        <button onClick={() => { setConfirmAction({ userId: u.id, email: u.email, action: 'suspend' }); setActionMenuId(null); setActionError(''); }}>
                          <Ban size={13} /> Suspend
                        </button>
                      )}
                      {u.email !== currentUser?.email && (
                        <button className="au-delete-action" onClick={() => { setConfirmAction({ userId: u.id, email: u.email, action: 'delete' }); setActionMenuId(null); setActionError(''); }}>
                          <Trash2 size={13} /> Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
            </div>
          </div>
        ))}
      </div>

      {/* Admin toggle confirmation modal */}
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

      {/* Invite user modal */}
      {showInviteModal && (
        <div className="au-modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="au-modal au-invite-modal" onClick={e => e.stopPropagation()}>
            <h3><UserPlus size={18} /> Invite User</h3>
            {inviteSuccess ? (
              <>
                <p className="au-invite-success">{inviteSuccess}</p>
                <div className="au-modal-actions">
                  <button className="au-btn-cancel" onClick={() => { setShowInviteModal(false); setInviteSuccess(''); }}>Close</button>
                  <button className="au-btn-confirm au-btn-grant" onClick={() => setInviteSuccess('')}>Invite Another</button>
                </div>
              </>
            ) : (
              <>
                {inviteError && <div className="au-invite-error">{inviteError}</div>}
                <div className="au-invite-form">
                  <div className="au-invite-field">
                    <label>Email address</label>
                    <input
                      type="email"
                      className="au-invite-input"
                      placeholder="user@company.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="au-invite-field">
                    <label>Organisation <span className="au-optional">(optional)</span></label>
                    <select
                      className="au-invite-input"
                      value={inviteOrgId}
                      onChange={e => setInviteOrgId(e.target.value)}
                    >
                      <option value="">No organisation — user will create their own</option>
                      {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>
                  <label className="au-invite-checkbox">
                    <input
                      type="checkbox"
                      checked={inviteAdmin}
                      onChange={e => setInviteAdmin(e.target.checked)}
                    />
                    <span>Grant platform admin access</span>
                  </label>
                </div>
                <div className="au-modal-actions">
                  <button className="au-btn-cancel" onClick={() => setShowInviteModal(false)}>Cancel</button>
                  <button
                    className="au-btn-confirm au-btn-grant"
                    onClick={handleInvite}
                    disabled={!inviteEmail || inviting}
                  >
                    {inviting ? 'Sending...' : 'Send Invite'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Confirm suspend/delete modal */}
      {confirmAction && (
        <div className="au-modal-overlay" onClick={() => setConfirmAction(null)}>
          <div className="au-modal" onClick={e => e.stopPropagation()}>
            <h3>
              {confirmAction.action === 'suspend' ? 'Suspend User' :
               confirmAction.action === 'unsuspend' ? 'Unsuspend User' : 'Delete User'}
            </h3>
            <p>
              {confirmAction.action === 'suspend'
                ? `Suspend ${confirmAction.email}? They will not be able to log in until unsuspended.`
                : confirmAction.action === 'unsuspend'
                ? `Unsuspend ${confirmAction.email}? They will be able to log in again.`
                : `Permanently delete ${confirmAction.email}? This will remove all their data and cannot be undone.`}
            </p>
            {actionError && <div className="au-invite-error">{actionError}</div>}
            <div className="au-modal-actions">
              <button className="au-btn-cancel" onClick={() => setConfirmAction(null)} disabled={actionLoading}>Cancel</button>
              <button
                className={`au-btn-confirm ${confirmAction.action === 'delete' ? 'au-btn-revoke' : confirmAction.action === 'suspend' ? 'au-btn-revoke' : 'au-btn-grant'}`}
                onClick={() => {
                  if (confirmAction.action === 'delete') handleDeleteUser(confirmAction.userId);
                  else handleSuspend(confirmAction.userId, confirmAction.action === 'suspend');
                }}
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing...' :
                 confirmAction.action === 'suspend' ? 'Suspend' :
                 confirmAction.action === 'unsuspend' ? 'Unsuspend' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit user modal */}
      {editUser && (
        <div className="au-modal-overlay" onClick={() => setEditUser(null)}>
          <div className="au-modal au-invite-modal" onClick={e => e.stopPropagation()}>
            <h3><Edit3 size={18} /> Edit User</h3>
            {actionError && <div className="au-invite-error">{actionError}</div>}
            <div className="au-invite-form">
              <div className="au-invite-field">
                <label>Email address</label>
                <input type="email" className="au-invite-input" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
              </div>
              <div className="au-invite-field">
                <label>Organisation Role</label>
                <select className="au-invite-input" value={editRole} onChange={e => setEditRole(e.target.value)}>
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>
            <div className="au-modal-actions">
              <button className="au-btn-cancel" onClick={() => setEditUser(null)} disabled={actionLoading}>Cancel</button>
              <button className="au-btn-confirm au-btn-grant" onClick={handleEditUser} disabled={actionLoading}>
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

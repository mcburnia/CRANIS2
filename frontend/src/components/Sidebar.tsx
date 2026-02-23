import { useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUnreadCount } from '../hooks/useNotifications';
import {
  LayoutDashboard, Bell, Package, ClipboardList, FileText,
  FolderGit2, Users, Box, AlertTriangle, CreditCard,
  BarChart3, UserCircle, Settings, ScrollText, LogOut, Trash2, Shield, MessageSquareMore
} from 'lucide-react';
import FeedbackModal from './FeedbackModal';
import './Sidebar.css';

interface SidebarProps {
  onNavigate?: () => void;
  orgName?: string;
}

const navSections = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/notifications', icon: Bell, label: 'Notifications', badge: true },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { to: '/products', icon: Package, label: 'Products' },
      { to: '/obligations', icon: ClipboardList, label: 'Obligations' },
      { to: '/technical-files', icon: FileText, label: 'Technical Files' },
    ],
  },
  {
    label: 'Repositories',
    items: [
      { to: '/repos', icon: FolderGit2, label: 'Repos' },
      { to: '/contributors', icon: Users, label: 'Contributors' },
      { to: '/dependencies', icon: Box, label: 'Dependencies' },
      { to: '/risk-findings', icon: AlertTriangle, label: 'Risk Findings' },
    ],
  },
  {
    label: 'Billing',
    items: [
      { to: '/billing', icon: CreditCard, label: 'Billing' },
      { to: '/reports', icon: BarChart3, label: 'Reports' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { to: '/stakeholders', icon: UserCircle, label: 'Stakeholders' },
      { to: '/organisation', icon: Settings, label: 'Organisation' },
      { to: '/audit-log', icon: ScrollText, label: 'Audit Log' },
    ],
  },
];

// Feedback is a modal trigger, not a nav link — handled separately

export default function Sidebar({ onNavigate, orgName }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { unreadCount } = useUnreadCount();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function handleLogout() {
    logout();
    if (onNavigate) onNavigate();
    navigate('/');
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch('/api/dev/nuke-account', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        logout();
        if (onNavigate) onNavigate();
        navigate('/');
      } else {
        const data = await res.json();
        alert('Failed to delete: ' + (data.error || 'Unknown error'));
      }
    } catch {
      alert('Network error');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  return (
    <>
      <div className="sidebar-logo">CRANIS<span>2</span></div>
      <div className="sidebar-org">{orgName || 'My Organisation'}</div>
      {navSections.map((section) => (
        <div className="nav-section" key={section.label}>
          <div className="nav-section-label">{section.label}</div>
          {section.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              onClick={onNavigate}
            >
              <item.icon size={18} className="nav-icon" />
              {item.label}
              {'badge' in item && item.badge && unreadCount > 0 && (
                <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </NavLink>
          ))}
        </div>
      ))}
      <div className="nav-section">
        <button className="nav-item feedback-btn" onClick={() => { setShowFeedback(true); if (onNavigate) onNavigate(); }}>
          <MessageSquareMore size={18} className="nav-icon" />
          Feedback & Bug Report
        </button>
      </div>
      {user?.isPlatformAdmin && (
        <div className="nav-section admin-nav-section">
          <div className="nav-section-label">Platform</div>
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) => `nav-item admin-panel-link${isActive ? ' active' : ''}`}
            onClick={onNavigate}
          >
            <Shield size={18} className="nav-icon" />
            Admin Panel
          </NavLink>
        </div>
      )}
      <div className="sidebar-footer">
        <button className="sidebar-user-btn" onClick={() => setShowDeleteConfirm(true)} title="DEV: Delete account & org data">
          <Trash2 size={14} className="dev-trash-icon" />
          {user?.email}
        </button>
        <button className="nav-item logout-btn" onClick={handleLogout}>
          <LogOut size={18} className="nav-icon" />
          Sign Out
        </button>
      </div>

      {/* DEV ONLY: Delete confirmation modal */}
      {showDeleteConfirm && createPortal(
        <div className="dev-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="dev-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dev-modal-badge">DEV ONLY</div>
            <h3>Delete Account & Organisation</h3>
            <p>This will permanently remove:</p>
            <ul>
              <li>Your user account ({user?.email})</li>
              <li>All event/telemetry data</li>
              <li>Your organisation and all its graph data</li>
            </ul>
            <div className="dev-modal-actions">
              <button className="btn-cancel" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                Cancel
              </button>
              <button className="btn-delete" onClick={handleDeleteAccount} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete Everything'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      <FeedbackModal open={showFeedback} onClose={() => setShowFeedback(false)} />
    </>
  );
}

import { useState, useMemo } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUnreadCount } from '../hooks/useNotifications';
import {
  LayoutDashboard, Bell, Package, ClipboardList, FileText,
  FolderGit2, Users, Box, AlertTriangle, CreditCard,
  BarChart3, UserCircle, Settings, ScrollText, LogOut, Shield, MessageSquareMore, Scale, Fingerprint, FileBarChart2, Store, Plug,
  ChevronRight, BookOpen
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
      { to: '/vulnerability-reports', icon: Shield, label: 'ENISA Reporting' },
      { to: '/license-compliance', icon: Scale, label: 'Licenses' },
      { to: '/ip-proof', icon: Fingerprint, label: 'IP Proof' },
      { to: '/due-diligence', icon: FileBarChart2, label: 'Due Diligence' },

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
      { to: '/marketplace/settings', icon: Store, label: 'Marketplace' },
      { to: '/integrations', icon: Plug, label: 'Integrations' },
    ],
  },
];

// Feedback is a modal trigger, not a nav link — handled separately

export default function Sidebar({ onNavigate, orgName }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount } = useUnreadCount();
  const [showFeedback, setShowFeedback] = useState(false);

  // Determine which section the current route belongs to
  const activeSection = useMemo(() => {
    for (const section of navSections) {
      if (section.items.some(item => location.pathname === item.to || location.pathname.startsWith(item.to + '/'))) {
        return section.label;
      }
    }
    return navSections[0].label; // default to Overview
  }, [location.pathname]);

  const [expandedSection, setExpandedSection] = useState<string>(activeSection);

  function toggleSection(label: string) {
    setExpandedSection(prev => prev === label ? '' : label);
  }

  function handleLogout() {
    logout();
    if (onNavigate) onNavigate();
    navigate('/');
  }

  return (
    <>
      <Link to="/" className="sidebar-logo">CRANIS<span>2</span></Link>
      <div className="sidebar-org">{orgName || 'My Organisation'}</div>
      {navSections.map((section) => {
        const isExpanded = expandedSection === section.label;
        const hasActive = section.items.some(item => location.pathname === item.to || location.pathname.startsWith(item.to + '/'));
        return (
          <div className={`nav-section${isExpanded ? ' nav-section-expanded' : ''}`} key={section.label}>
            <button
              className={`nav-section-label${hasActive ? ' nav-section-active' : ''}`}
              onClick={() => toggleSection(section.label)}
            >
              <ChevronRight size={14} className={`nav-section-chevron${isExpanded ? ' nav-section-chevron-open' : ''}`} />
              {section.label}
              {!isExpanded && hasActive && <span className="nav-section-dot" />}
            </button>
            <div className={`nav-section-items${isExpanded ? ' nav-section-items-open' : ''}`} style={{ '--item-count': section.items.length } as React.CSSProperties}>
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
          </div>
        );
      })}
      <div className="nav-section">
        <Link to="/docs" className="nav-item" onClick={onNavigate} target="_blank">
          <BookOpen size={18} className="nav-icon" />
          Documentation
        </Link>
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
        <span className="sidebar-user-email">{user?.email}</span>
        <button className="nav-item logout-btn" onClick={handleLogout}>
          <LogOut size={18} className="nav-icon" />
          Sign Out
        </button>
      </div>

      <FeedbackModal open={showFeedback} onClose={() => setShowFeedback(false)} />
    </>
  );
}

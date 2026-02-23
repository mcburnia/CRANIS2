import { useState } from 'react';
import { Outlet, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Building2, Users, ScrollText, Activity,
  ArrowLeft, Menu, X, Loader, Shield, Database
} from 'lucide-react';
import './AdminLayout.css';

const adminNavSections = [
  {
    label: 'Overview',
    items: [
      { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/admin/orgs', icon: Building2, label: 'Organisations' },
      { to: '/admin/users', icon: Users, label: 'Users' },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { to: '/admin/audit-log', icon: ScrollText, label: 'Audit Log' },
      { to: '/admin/system', icon: Activity, label: 'System Health' },
      { to: '/admin/vuln-scan', icon: Shield, label: 'Vuln Scanning' },
      { to: '/admin/vuln-db', icon: Database, label: 'Vuln Database' },
    ],
  },
];

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <Loader size={32} color="var(--accent)" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.isPlatformAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="app-layout admin-layout">
      <div className="mobile-topbar admin-topbar">
        <div className="topbar-logo admin-topbar-logo">
          <Shield size={18} />
          CRANIS<span>2</span> Admin
        </div>
        <button
          className="hamburger-btn"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle navigation"
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`sidebar admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo admin-logo">
          <Shield size={16} className="admin-shield" />
          CRANIS<span>2</span>
        </div>
        <div className="sidebar-org admin-badge">Platform Admin</div>
        {adminNavSections.map((section) => (
          <div className="nav-section" key={section.label}>
            <div className="nav-section-label">{section.label}</div>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon size={18} className="nav-icon" />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
        <div className="sidebar-footer">
          <button
            className="nav-item back-to-app-btn"
            onClick={() => { setSidebarOpen(false); navigate('/dashboard'); }}
          >
            <ArrowLeft size={18} className="nav-icon" />
            Back to App
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

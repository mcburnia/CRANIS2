import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Bell, Package, ClipboardList, FileText,
  FolderGit2, Users, Box, AlertTriangle, CreditCard,
  BarChart3, UserCircle, Settings, ScrollText
} from 'lucide-react';
import './Sidebar.css';

interface SidebarProps {
  onNavigate?: () => void;
}

const navSections = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/notifications', icon: Bell, label: 'Notifications' },
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

export default function Sidebar({ onNavigate }: SidebarProps) {
  return (
    <>
      <div className="sidebar-logo">CRANIS<span>2</span></div>
      <div className="sidebar-org">Acme Software Ltd</div>
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
            </NavLink>
          ))}
        </div>
      ))}
    </>
  );
}

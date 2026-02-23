import { createBrowserRouter } from 'react-router-dom';
import RootLayout from './layouts/RootLayout';
import PublicLayout from './layouts/PublicLayout';
import AuthenticatedLayout from './layouts/AuthenticatedLayout';

import LandingPage from './pages/public/LandingPage';
import LoginPage from './pages/public/LoginPage';
import SignupPage from './pages/public/SignupPage';
import CheckEmailPage from './pages/public/CheckEmailPage';
import VerifyEmailPage from './pages/public/VerifyEmailPage';
import AcceptInvitePage from './pages/public/AcceptInvitePage';
import WelcomePage from './pages/setup/WelcomePage';
import OrgSetupPage from './pages/setup/OrgSetupPage';

import DashboardPage from './pages/dashboard/DashboardPage';
import NotificationsPage from './pages/notifications/NotificationsPage';
import ProductsPage from './pages/products/ProductsPage';
import ProductDetailPage from './pages/products/ProductDetailPage';
import ObligationsPage from './pages/compliance/ObligationsPage';
import TechnicalFilesPage from './pages/compliance/TechnicalFilesPage';
import ReposPage from './pages/repositories/ReposPage';
import ContributorsPage from './pages/repositories/ContributorsPage';
import DependenciesPage from './pages/repositories/DependenciesPage';
import RiskFindingsPage from './pages/repositories/RiskFindingsPage';
import BillingPage from './pages/billing/BillingPage';
import ReportsPage from './pages/billing/ReportsPage';
import StakeholdersPage from './pages/settings/StakeholdersPage';
import OrganisationPage from './pages/settings/OrganisationPage';
import AuditLogPage from './pages/settings/AuditLogPage';

import AdminLayout from './layouts/AdminLayout';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminOrgsPage from './pages/admin/AdminOrgsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminAuditLogPage from './pages/admin/AdminAuditLogPage';
import AdminSystemPage from './pages/admin/AdminSystemPage';
import AdminVulnScanPage from './pages/admin/AdminVulnScanPage';
import AdminVulnDbPage from './pages/admin/AdminVulnDbPage';

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { path: '/', element: <LandingPage /> },
          { path: '/login', element: <LoginPage /> },
          { path: '/signup', element: <SignupPage /> },
          { path: '/check-email', element: <CheckEmailPage /> },
          { path: '/verify-email', element: <VerifyEmailPage /> },
          { path: '/accept-invite', element: <AcceptInvitePage /> },
          { path: '/welcome', element: <WelcomePage /> },
          { path: '/setup/org', element: <OrgSetupPage /> },
        ],
      },
      {
        element: <AuthenticatedLayout />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/notifications', element: <NotificationsPage /> },
          { path: '/products', element: <ProductsPage /> },
          { path: '/products/:productId', element: <ProductDetailPage /> },
          { path: '/obligations', element: <ObligationsPage /> },
          { path: '/technical-files', element: <TechnicalFilesPage /> },
          { path: '/repos', element: <ReposPage /> },
          { path: '/contributors', element: <ContributorsPage /> },
          { path: '/dependencies', element: <DependenciesPage /> },
          { path: '/risk-findings', element: <RiskFindingsPage /> },
          { path: '/billing', element: <BillingPage /> },
          { path: '/reports', element: <ReportsPage /> },
          { path: '/stakeholders', element: <StakeholdersPage /> },
          { path: '/organisation', element: <OrganisationPage /> },
          { path: '/audit-log', element: <AuditLogPage /> },
        ],
      },
      {
        element: <AdminLayout />,
        children: [
          { path: '/admin', element: <AdminDashboardPage /> },
          { path: '/admin/dashboard', element: <AdminDashboardPage /> },
          { path: '/admin/orgs', element: <AdminOrgsPage /> },
          { path: '/admin/users', element: <AdminUsersPage /> },
          { path: '/admin/audit-log', element: <AdminAuditLogPage /> },
          { path: '/admin/system', element: <AdminSystemPage /> },
          { path: '/admin/vuln-scan', element: <AdminVulnScanPage /> },
          { path: '/admin/vuln-db', element: <AdminVulnDbPage /> },
        ],
      },
    ],
  },
]);

export default router;

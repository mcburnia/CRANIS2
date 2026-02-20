import { createBrowserRouter } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import AuthenticatedLayout from './layouts/AuthenticatedLayout';

import LandingPage from './pages/public/LandingPage';
import LoginPage from './pages/public/LoginPage';
import SignupPage from './pages/public/SignupPage';
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

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignupPage /> },
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
]);

export default router;

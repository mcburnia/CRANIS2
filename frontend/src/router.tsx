/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import { createBrowserRouter, Navigate, useParams } from 'react-router-dom';
import RootLayout from './layouts/RootLayout';

function MarketplaceDetailRedirect() {
  const { orgId } = useParams<{ orgId: string }>();
  return <Navigate to={`/trust-centre/${orgId}`} replace />;
}
import PublicLayout from './layouts/PublicLayout';
import AuthenticatedLayout from './layouts/AuthenticatedLayout';

import LandingPage from './pages/public/LandingPage';
import LoginPage from './pages/public/LoginPage';
import SignupPage from './pages/public/SignupPage';
import CheckEmailPage from './pages/public/CheckEmailPage';
import VerifyEmailPage from './pages/public/VerifyEmailPage';
import AcceptInvitePage from './pages/public/AcceptInvitePage';
import TrustCentrePage from './pages/public/TrustCentrePage';
import TrustCentreDetailPage from './pages/public/TrustCentreDetailPage';
import DocsPage from './pages/public/DocsPage';
import WelcomePage from './pages/setup/WelcomePage';
import OrgSetupPage from './pages/setup/OrgSetupPage';

import DashboardPage from './pages/dashboard/DashboardPage';
import NotificationsPage from './pages/notifications/NotificationsPage';
import ProductsPage from './pages/products/ProductsPage';
import ProductDetailPage from './pages/products/ProductDetailPage';
import ActionPlanPage from './pages/products/ActionPlanPage';
import ObligationsPage from './pages/compliance/ObligationsPage';
import TechnicalFilesPage from './pages/compliance/TechnicalFilesPage';
import VulnerabilityReportsPage from './pages/compliance/VulnerabilityReportsPage';
import ReportDetailPage from './pages/compliance/ReportDetailPage';
import LicenseCompliancePage from './pages/compliance/LicenseCompliancePage';
import IpProofPage from './pages/compliance/IpProofPage';
import DueDiligencePage from "./pages/compliance/DueDiligencePage";
import ComplianceTimelinePage from "./pages/compliance/ComplianceTimelinePage";
import EscrowPage from "./pages/compliance/EscrowPage";
import ReposPage from './pages/repositories/ReposPage';
import ContributorsPage from './pages/repositories/ContributorsPage';
import DependenciesPage from './pages/repositories/DependenciesPage';
import RiskFindingsPage from './pages/repositories/RiskFindingsPage';
import BillingPage from './pages/billing/BillingPage';
import ReportsPage from './pages/billing/ReportsPage';
import ComplianceSummaryReport from './pages/reports/ComplianceSummaryReport';
import VulnerabilityTrendsReport from './pages/reports/VulnerabilityTrendsReport';
import AuditTrailReport from './pages/reports/AuditTrailReport';
import StakeholdersPage from './pages/settings/StakeholdersPage';
import OrganisationPage from './pages/settings/OrganisationPage';
import AuditLogPage from './pages/settings/AuditLogPage';
import TrustCentreSettingsPage from './pages/settings/TrustCentreSettingsPage';
import IntegrationsPage from './pages/settings/IntegrationsPage';
import DocumentTemplatesPage from './pages/resources/DocumentTemplatesPage';
import NotFoundPage from './pages/NotFoundPage';

import AdminLayout from './layouts/AdminLayout';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminOrgsPage from './pages/admin/AdminOrgsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminAuditLogPage from './pages/admin/AdminAuditLogPage';
import AdminSystemPage from './pages/admin/AdminSystemPage';
import AdminVulnScanPage from './pages/admin/AdminVulnScanPage';
import AdminVulnDbPage from './pages/admin/AdminVulnDbPage';
import AdminFeedbackPage from './pages/admin/AdminFeedbackPage';
import AdminBillingPage from './pages/admin/AdminBillingPage';
import AdminAffiliatesPage from './pages/admin/AdminAffiliatesPage';
import AdminAffiliateDetailPage from './pages/admin/AdminAffiliateDetailPage';
import AffiliatePage from './pages/AffiliatePage';
import AdminTestResultsPage from "./pages/admin/AdminTestResultsPage";
import AdminDocsPage from "./pages/admin/AdminDocsPage";
import AdminStrategyPage from "./pages/admin/AdminStrategyPage";
import AdminCategoryRulesPage from "./pages/admin/AdminCategoryRulesPage";
import AdminCopilotPage from "./pages/admin/AdminCopilotPage";
import AdminRetentionPage from "./pages/admin/AdminRetentionPage";
import AdminAnalyticsPage from "./pages/admin/AdminAnalyticsPage";
import AdminWelcomeLeadsPage from "./pages/admin/AdminWelcomeLeadsPage";

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
          { path: '/trust-centre', element: <TrustCentrePage /> },
          { path: '/trust-centre/:orgId', element: <TrustCentreDetailPage /> },
          { path: '/marketplace', element: <Navigate to="/trust-centre" replace /> },
          { path: '/marketplace/:orgId', element: <MarketplaceDetailRedirect /> },
          { path: '/docs', element: <DocsPage /> },
          { path: '/docs/:slug', element: <DocsPage /> },
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
          { path: '/products/:productId/action-plan', element: <ActionPlanPage /> },
          { path: '/products/:productId/timeline', element: <ComplianceTimelinePage /> },
          { path: '/products/:productId/escrow', element: <EscrowPage /> },
          { path: '/obligations', element: <ObligationsPage /> },
          { path: '/technical-files', element: <TechnicalFilesPage /> },
          { path: '/vulnerability-reports', element: <VulnerabilityReportsPage /> },
          { path: '/vulnerability-reports/:id', element: <ReportDetailPage /> },
          { path: '/license-compliance', element: <LicenseCompliancePage /> },
          { path: '/ip-proof', element: <IpProofPage /> },
          { path: '/due-diligence', element: <DueDiligencePage /> },
          { path: '/repos', element: <ReposPage /> },
          { path: '/contributors', element: <ContributorsPage /> },
          { path: '/dependencies', element: <DependenciesPage /> },
          { path: '/risk-findings', element: <RiskFindingsPage /> },
          { path: '/billing', element: <BillingPage /> },
          { path: '/affiliate', element: <AffiliatePage /> },
          { path: '/reports', element: <ReportsPage /> },
          { path: '/reports/compliance-summary', element: <ComplianceSummaryReport /> },
          { path: '/reports/vulnerability-trends', element: <VulnerabilityTrendsReport /> },
          { path: '/reports/audit-trail', element: <AuditTrailReport /> },
          { path: '/stakeholders', element: <StakeholdersPage /> },
          { path: '/organisation', element: <OrganisationPage /> },
          { path: '/audit-log', element: <AuditLogPage /> },
          { path: '/trust-centre/settings', element: <TrustCentreSettingsPage /> },
          { path: '/marketplace/settings', element: <Navigate to="/trust-centre/settings" replace /> },
          { path: '/integrations', element: <IntegrationsPage /> },
          { path: '/document-templates', element: <DocumentTemplatesPage /> },

          /* URL aliases – redirect intuitive paths to actual routes */
          { path: '/cra-reports', element: <Navigate to="/vulnerability-reports" replace /> },
          { path: '/vulnerabilities', element: <Navigate to="/vulnerability-reports" replace /> },
          { path: '/license-scan', element: <Navigate to="/license-compliance" replace /> },
          { path: '/sbom-export', element: <Navigate to="/products" replace /> },
          { path: '/escrow', element: <Navigate to="/products" replace /> },
          { path: '/settings', element: <Navigate to="/organisation" replace /> },
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
          { path: '/admin/feedback', element: <AdminFeedbackPage /> },
          { path: '/admin/billing', element: <AdminBillingPage /> },
          { path: '/admin/affiliates', element: <AdminAffiliatesPage /> },
          { path: '/admin/affiliates/:id', element: <AdminAffiliateDetailPage /> },
          { path: '/admin/test-results', element: <AdminTestResultsPage /> },
          { path: '/admin/docs', element: <AdminDocsPage /> },
          { path: '/admin/strategy', element: <AdminStrategyPage /> },
          { path: '/admin/category-rules', element: <AdminCategoryRulesPage /> },
          { path: '/admin/copilot', element: <AdminCopilotPage /> },
          { path: '/admin/retention', element: <AdminRetentionPage /> },
          { path: '/admin/analytics', element: <AdminAnalyticsPage /> },
          { path: '/admin/welcome-leads', element: <AdminWelcomeLeadsPage /> },
        ],
      },

      /* 404 catch-all – must be last */
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default router;

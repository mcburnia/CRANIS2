import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface HelpPanelState {
  isOpen: boolean;
  currentPage: string;
  toggle: () => void;
  open: (page?: string) => void;
  close: () => void;
  navigate: (page: string) => void;
}

const HelpPanelContext = createContext<HelpPanelState | null>(null);

const STORAGE_KEY = 'cranis2_help_panel';
const DEFAULT_PAGE = '/help/ch0_01_what_is_cra.html';

// ── Route-to-help mapping ─────────────────────────────────────
// Maps app routes (or route prefixes) to the most relevant help page.
// More specific routes are checked first; fallback is the default page.
// The `tab` field optionally matches a query param or hash for product detail tabs.

interface HelpRoute {
  pattern: string | RegExp;
  tab?: string;          // product detail tab name (matched from URL hash or query)
  help: string;
}

const HELP_ROUTES: HelpRoute[] = [
  // Public / auth pages
  { pattern: '/login', help: '/help/ch1_01_account_creation.html' },
  { pattern: '/signup', help: '/help/ch1_01_account_creation.html' },
  { pattern: '/check-email', help: '/help/ch1_01_account_creation.html' },
  { pattern: '/verify-email', help: '/help/ch1_01_account_creation.html' },
  { pattern: '/welcome', help: '/help/ch1_02_org_setup.html' },
  { pattern: '/setup/org', help: '/help/ch1_02_org_setup.html' },

  // Dashboard
  { pattern: '/dashboard', help: '/help/ch1_06_reading_dashboard.html' },

  // Product detail — tab-specific (matched by query param ?tab= or URL hash)
  { pattern: /^\/products\/[^/]+$/, tab: 'overview', help: '/help/ch1_03_repo_connection.html' },
  { pattern: /^\/products\/[^/]+$/, tab: 'obligations', help: '/help/ch4_02_obligations.html' },
  { pattern: /^\/products\/[^/]+$/, tab: 'technical-file', help: '/help/ch4_01_technical_file.html' },
  { pattern: /^\/products\/[^/]+$/, tab: 'dependencies', help: '/help/ch2_01_sbom_sync_cycle.html' },
  { pattern: /^\/products\/[^/]+$/, tab: 'risk-findings', help: '/help/ch3_01_finding_triage.html' },
  { pattern: /^\/products\/[^/]+$/, tab: 'supply-chain', help: '/help/ch2_04_supply_chain_risk.html' },
  { pattern: /^\/products\/[^/]+$/, tab: 'crypto-inventory', help: '/help/ch6_04_crypto_pqc.html' },
  { pattern: /^\/products\/[^/]+$/, tab: 'field-issues', help: '/help/ch6_01_field_issue_lifecycle.html' },
  { pattern: /^\/products\/[^/]+$/, tab: 'incidents', help: '/help/ch6_05_incident_lifecycle.html' },
  { pattern: /^\/products\/[^/]+$/, tab: 'compliance-vault', help: '/help/ch5_02_ip_proof.html' },
  { pattern: /^\/products\/[^/]+$/, tab: 'activity', help: '/help/ch1_04_compliance_checklist.html' },
  // Product detail — default (no tab matched)
  { pattern: /^\/products\/[^/]+$/, help: '/help/ch1_03_repo_connection.html' },

  // Product escrow sub-page
  { pattern: /^\/products\/[^/]+\/escrow/, help: '/help/ch5_03_escrow.html' },
  { pattern: /^\/products\/[^/]+\/action-plan/, help: '/help/ch1_04_compliance_checklist.html' },
  { pattern: /^\/products\/[^/]+\/timeline/, help: '/help/ch5_01_enisa_reporting.html' },

  // Notifications
  { pattern: '/notifications', help: '/help/ch1_07_notifications.html' },

  // Portfolio pages
  { pattern: '/products', help: '/help/ch1_05_add_product.html' },
  { pattern: '/obligations', help: '/help/ch4_02_obligations.html' },
  { pattern: '/technical-files', help: '/help/ch4_01_technical_file.html' },
  { pattern: '/vulnerability-reports', help: '/help/ch5_01_enisa_reporting.html' },
  { pattern: '/license-compliance', help: '/help/ch2_03_licence_compliance.html' },
  { pattern: '/ip-proof', help: '/help/ch5_02_ip_proof.html' },
  { pattern: '/due-diligence', help: '/help/ch5_07_due_diligence_package.html' },
  { pattern: '/risk-findings', help: '/help/ch3_01_finding_triage.html' },
  { pattern: '/repos', help: '/help/ch2_01_sbom_sync_cycle.html' },
  { pattern: '/contributors', help: '/help/ch7_04_user_roles.html' },
  { pattern: '/dependencies', help: '/help/ch2_01_sbom_sync_cycle.html' },

  // Settings & billing
  { pattern: '/billing', help: '/help/ch5_04_billing_lifecycle.html' },
  { pattern: '/reports', help: '/help/ch5_01_enisa_reporting.html' },
  { pattern: '/stakeholders', help: '/help/ch7_06_stakeholders.html' },
  { pattern: '/organisation', help: '/help/ch7_07_org_settings.html' },
  { pattern: '/integrations', help: '/help/ch7_01_api_keys.html' },
  { pattern: '/document-templates', help: '/help/ch7_10_document_templates.html' },
  { pattern: '/audit-log', help: '/help/ch7_04_user_roles.html' },

  // Admin pages
  { pattern: /^\/admin/, help: '/help/ch7_04_user_roles.html' },

  // Public tools
  { pattern: '/marketplace', help: '/help/ch7_09_marketplace.html' },
  { pattern: '/docs', help: '/help/ch0_01_what_is_cra.html' },
  { pattern: '/', help: '/help/ch0_01_what_is_cra.html' },
];

function getHelpPageForRoute(pathname: string, search: string): string {
  // Extract tab from search params (e.g. ?tab=obligations)
  const params = new URLSearchParams(search);
  const tab = params.get('tab') || '';

  for (const route of HELP_ROUTES) {
    const matches = typeof route.pattern === 'string'
      ? pathname === route.pattern || pathname.startsWith(route.pattern + '/')
      : route.pattern.test(pathname);

    if (!matches) continue;

    // If route requires a specific tab, check it
    if (route.tab) {
      if (tab === route.tab) return route.help;
      continue; // tab didn't match, try next rule
    }

    return route.help;
  }

  return DEFAULT_PAGE;
}

export function HelpPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'open'; } catch { return false; }
  });
  const [currentPage, setCurrentPage] = useState(DEFAULT_PAGE);
  const userNavigatedRef = useRef(false); // tracks if user manually navigated within the help panel
  const location = useLocation();

  // Update help page when route changes — but only if the user hasn't manually navigated
  useEffect(() => {
    if (userNavigatedRef.current) return; // user is reading a specific page, don't interrupt
    const helpPage = getHelpPageForRoute(location.pathname, location.search);
    setCurrentPage(helpPage);
  }, [location.pathname, location.search]);

  const toggle = useCallback(() => {
    setIsOpen(prev => {
      const next = !prev;
      if (next) {
        // Opening — reset to context-aware page
        userNavigatedRef.current = false;
      }
      try { localStorage.setItem(STORAGE_KEY, next ? 'open' : 'closed'); } catch {}
      return next;
    });
  }, []);

  const open = useCallback((page?: string) => {
    if (page) {
      setCurrentPage(page);
      userNavigatedRef.current = true; // explicit page = user-driven
    } else {
      userNavigatedRef.current = false; // no page = use context
    }
    setIsOpen(true);
    try { localStorage.setItem(STORAGE_KEY, 'open'); } catch {}
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    userNavigatedRef.current = false; // reset on close
    try { localStorage.setItem(STORAGE_KEY, 'closed'); } catch {}
  }, []);

  const navigate = useCallback((page: string) => {
    setCurrentPage(page);
    userNavigatedRef.current = true; // explicit navigation
    if (!isOpen) {
      setIsOpen(true);
      try { localStorage.setItem(STORAGE_KEY, 'open'); } catch {}
    }
  }, [isOpen]);

  return (
    <HelpPanelContext.Provider value={{ isOpen, currentPage, toggle, open, close, navigate }}>
      {children}
    </HelpPanelContext.Provider>
  );
}

export function useHelpPanel() {
  const ctx = useContext(HelpPanelContext);
  if (!ctx) throw new Error('useHelpPanel must be used within HelpPanelProvider');
  return ctx;
}

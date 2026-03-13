/* ══════════════════════════════════════
   SEO meta configuration — single source of truth
   Used by usePageMeta (runtime) and inject-seo.mjs (build-time)
   ══════════════════════════════════════ */

export interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  ogType?: string;
  ogImage?: string;
  twitterCard?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

export const SITE_NAME = 'CRANIS2';
export const SITE_URL = 'https://cranis2.com';
export const DEFAULT_DESCRIPTION =
  'CRANIS2 is an EU compliance platform for the Cyber Resilience Act (CRA) and NIS2 Directive. Automated SBOMs, vulnerability monitoring, license compliance, technical documentation, and ENISA reporting.';
export const DEFAULT_OG_IMAGE = '/branding/cranis2-logo-wide.png';

/* ── JSON-LD schemas ── */

const ORG_JSON_LD: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'CRANIS2',
  url: SITE_URL,
  logo: `${SITE_URL}/branding/cranis2-logo-wide.png`,
  description: 'EU compliance platform for the Cyber Resilience Act and NIS2 Directive.',
  foundingDate: '2026',
  address: { '@type': 'PostalAddress', addressCountry: 'CH' },
};

const SOFTWARE_JSON_LD: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'CRANIS2',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: DEFAULT_DESCRIPTION,
  url: SITE_URL,
  offers: {
    '@type': 'Offer',
    price: '6',
    priceCurrency: 'EUR',
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: '6',
      priceCurrency: 'EUR',
      unitText: 'per contributor per month',
    },
  },
  featureList: [
    'Automated SBOM generation (CycloneDX, SPDX)',
    'Vulnerability monitoring (OSV, NVD, GitHub Advisory)',
    'License compliance scanning',
    'CRA Technical File management (Annex VII)',
    'ENISA incident & vulnerability reporting',
    'IP Proof via RFC 3161 timestamping',
    'Source code escrow (EU-hosted Forgejo)',
    'Due diligence export (PDF + SBOM + CSV)',
  ],
};

const FAQ_JSON_LD: Record<string, unknown> = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is CRANIS2?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'CRANIS2 is a compliance platform that helps software companies meet the requirements of the EU Cyber Resilience Act (CRA) and the NIS2 Directive. It connects to your existing source code repositories and automatically builds the compliance evidence that regulators expect to see.',
      },
    },
    {
      '@type': 'Question',
      name: 'What does CRANIS2 stand for?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'CRANIS2 stands for Cyber Resilience Act and NIS2. The name reflects the two major pieces of EU legislation that the platform addresses.',
      },
    },
    {
      '@type': 'Question',
      name: 'How much does CRANIS2 cost?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'CRANIS2 uses contributor-based pricing at EUR 6 per month per active contributor across your organisation. No per-product fees, no feature tiers, and no hidden charges.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is there a free trial?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Every new organisation receives a 90-day free trial with full access to all platform features. No credit card is required to start.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the Cyber Resilience Act (CRA)?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The Cyber Resilience Act is EU regulation establishing cybersecurity requirements for products with digital elements sold in the EU single market. It requires manufacturers to provide SBOMs, perform vulnerability management, report incidents to ENISA, and maintain technical documentation.',
      },
    },
    {
      '@type': 'Question',
      name: 'When does the CRA become mandatory?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'CRA reporting obligations begin in September 2026. Full compliance is required by December 2027. Penalties for non-compliance can reach EUR 15 million or 2.5% of global turnover.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does CRANIS2 access my source code?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. CRANIS2 reads dependency metadata (lockfiles, manifest files) from your repositories but never stores, analyses, or modifies your source code.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is an SBOM and why does the CRA require it?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'A Software Bill of Materials (SBOM) is a machine-readable inventory of every software component in a product. The CRA requires manufacturers to identify and document all components, making the SBOM a foundational compliance artifact.',
      },
    },
    {
      '@type': 'Question',
      name: 'Which repository providers does CRANIS2 support?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'CRANIS2 supports five providers: GitHub (OAuth), Codeberg (OAuth), and self-hosted Gitea, Forgejo, and GitLab instances (via Personal Access Token).',
      },
    },
    {
      '@type': 'Question',
      name: 'Where is CRANIS2 hosted?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'CRANIS2 is hosted in Switzerland on Infomaniak infrastructure. All compliance evidence and customer data remains under European jurisdiction, with no dependency on US-controlled platforms.',
      },
    },
  ],
};

/* ── Public route meta definitions ── */

export const ROUTE_META: Record<string, PageMeta> = {
  '/': {
    title: 'CRANIS2 – EU Cyber Resilience Act & NIS2 Compliance Platform',
    description: DEFAULT_DESCRIPTION,
    canonical: '/',
    jsonLd: [ORG_JSON_LD, SOFTWARE_JSON_LD],
  },
  '/marketplace': {
    title: 'Marketplace – CRANIS2',
    description:
      'Browse EU-compliant software vendors on the CRANIS2 Marketplace. Find companies with verified CRA compliance, SBOMs, vulnerability management, and escrow coverage.',
    canonical: '/marketplace',
  },
  '/docs': {
    title: 'Documentation – CRANIS2',
    description:
      'Complete user guide for CRANIS2. Learn how to set up your organisation, register products, generate SBOMs, manage vulnerabilities, file ENISA reports, and achieve CRA compliance.',
    canonical: '/docs',
  },
  '/docs/faq': {
    title: 'FAQ – CRANIS2',
    description:
      'Frequently asked questions about CRANIS2, the Cyber Resilience Act, NIS2, SBOMs, vulnerability reporting, license compliance, and pricing.',
    canonical: '/docs/faq',
    jsonLd: FAQ_JSON_LD,
  },
  '/login': {
    title: 'Log In – CRANIS2',
    description:
      'Log in to your CRANIS2 account to manage CRA compliance, SBOMs, vulnerability reports, and technical documentation.',
    canonical: '/login',
  },
  '/signup': {
    title: 'Sign Up – CRANIS2',
    description:
      'Create a free CRANIS2 account. 90-day trial with full access to automated SBOM generation, vulnerability monitoring, ENISA reporting, and CRA compliance tools.',
    canonical: '/signup',
  },
  '/check-email': {
    title: 'Check Your Email – CRANIS2',
    description: 'Check your email to verify your CRANIS2 account.',
    canonical: '/check-email',
    noindex: true,
  },
  '/verify-email': {
    title: 'Verify Email – CRANIS2',
    description: 'Email verification for your CRANIS2 account.',
    canonical: '/verify-email',
    noindex: true,
  },
  '/accept-invite': {
    title: 'Accept Invitation – CRANIS2',
    description: 'Accept your invitation to join an organisation on CRANIS2.',
    canonical: '/accept-invite',
    noindex: true,
  },
};

/* ── Authenticated page titles (all noindex) ── */

export const AUTH_PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/notifications': 'Notifications',
  '/products': 'Products',
  '/obligations': 'Obligations',
  '/technical-files': 'Technical Files',
  '/vulnerability-reports': 'ENISA Reporting',
  '/license-compliance': 'License Compliance',
  '/ip-proof': 'IP Proof',
  '/due-diligence': 'Due Diligence',
  '/repos': 'Repositories',
  '/contributors': 'Contributors',
  '/dependencies': 'Dependencies',
  '/risk-findings': 'Risk Findings',
  '/billing': 'Billing',
  '/reports': 'Reports',
  '/stakeholders': 'Stakeholders',
  '/organisation': 'Organisation',
  '/audit-log': 'Audit Log',
  '/marketplace/settings': 'Marketplace Settings',
  '/welcome': 'Welcome',
  '/setup/org': 'Organisation Setup',
};

/* ── Admin page titles (all noindex) ── */

export const ADMIN_PAGE_TITLES: Record<string, string> = {
  '/admin': 'Admin Dashboard',
  '/admin/dashboard': 'Admin Dashboard',
  '/admin/orgs': 'Admin – Organisations',
  '/admin/users': 'Admin – Users',
  '/admin/audit-log': 'Admin – Audit Log',
  '/admin/system': 'Admin – System Health',
  '/admin/vuln-scan': 'Admin – Vulnerability Scanning',
  '/admin/vuln-db': 'Admin – Vulnerability Database',
  '/admin/feedback': 'Admin – User Feedback',
  '/admin/billing': 'Admin – Billing',
  '/admin/test-results': 'Admin – Test Results',
};

#!/usr/bin/env node
/**
 * inject-seo.mjs — Post-build SEO meta injection
 *
 * Runs after `vite build`. Reads dist/index.html as a template and creates
 * per-route variants with static <title>, <meta>, OG tags, Twitter Cards,
 * canonical URLs, and JSON-LD baked into <head>.
 *
 * NGINX's `try_files $uri $uri/ /index.html` serves these automatically:
 *   /marketplace  →  dist/marketplace/index.html  (marketplace-specific meta)
 *   /dashboard    →  dist/index.html              (default meta, noindex)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const TEMPLATE = readFileSync(join(DIST, 'index.html'), 'utf-8');

const SITE_URL = 'https://cranis2.com';
const SITE_NAME = 'CRANIS2';
const DEFAULT_OG_IMAGE = '/branding/cranis2-logo-wide.png';

/* ── Route definitions ── */

const ROUTES = [
  {
    path: '/',
    title: 'CRANIS2 — EU Cyber Resilience Act & NIS2 Compliance Platform',
    description:
      'CRANIS2 is an EU compliance platform for the Cyber Resilience Act (CRA) and NIS2 Directive. Automated SBOMs, vulnerability monitoring, license compliance, technical documentation, and ENISA reporting.',
    robots: 'index, follow',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'CRANIS2',
        url: SITE_URL,
        logo: `${SITE_URL}/branding/cranis2-logo-wide.png`,
        description:
          'EU compliance platform for the Cyber Resilience Act and NIS2 Directive.',
        foundingDate: '2026',
        address: { '@type': 'PostalAddress', addressCountry: 'CH' },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'CRANIS2',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
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
      },
    ],
  },
  {
    path: '/marketplace',
    title: 'Marketplace — CRANIS2',
    description:
      'Browse EU-compliant software vendors on the CRANIS2 Marketplace. Find companies with verified CRA compliance, SBOMs, vulnerability management, and escrow coverage.',
    robots: 'index, follow',
  },
  {
    path: '/docs',
    title: 'Documentation — CRANIS2',
    description:
      'Complete user guide for CRANIS2. Learn how to set up your organisation, register products, generate SBOMs, manage vulnerabilities, file ENISA reports, and achieve CRA compliance.',
    robots: 'index, follow',
  },
  {
    path: '/docs/faq',
    title: 'FAQ — CRANIS2',
    description:
      'Frequently asked questions about CRANIS2, the Cyber Resilience Act, NIS2, SBOMs, vulnerability reporting, license compliance, and pricing.',
    robots: 'index, follow',
    jsonLd: [
      {
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
          {
            '@type': 'Question',
            name: 'Is CRANIS2 only for EU-based companies?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'No. The CRA applies to any product with digital elements placed on the EU single market, regardless of where the manufacturer is based. If your company sells software to EU customers, you are subject to CRA requirements.',
            },
          },
        ],
      },
    ],
  },
  {
    path: '/login',
    title: 'Log In — CRANIS2',
    description:
      'Log in to your CRANIS2 account to manage CRA compliance, SBOMs, vulnerability reports, and technical documentation.',
    robots: 'index, follow',
  },
  {
    path: '/signup',
    title: 'Sign Up — CRANIS2',
    description:
      'Create a free CRANIS2 account. 90-day trial with full access to automated SBOM generation, vulnerability monitoring, ENISA reporting, and CRA compliance tools.',
    robots: 'index, follow',
  },
];

/* ── Helpers ── */

function escAttr(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildMetaBlock(route) {
  const canonical = `${SITE_URL}${route.path}`;
  const ogImage = `${SITE_URL}${DEFAULT_OG_IMAGE}`;

  const lines = [
    `<title>${escHtml(route.title)}</title>`,
    `<meta name="description" content="${escAttr(route.description)}">`,
    `<meta name="robots" content="${route.robots}">`,
    `<link rel="canonical" href="${canonical}">`,
    '',
    '<!-- Open Graph -->',
    `<meta property="og:title" content="${escAttr(route.title)}">`,
    `<meta property="og:description" content="${escAttr(route.description)}">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:image" content="${ogImage}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:locale" content="en_GB">`,
    '',
    '<!-- Twitter Card -->',
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escAttr(route.title)}">`,
    `<meta name="twitter:description" content="${escAttr(route.description)}">`,
    `<meta name="twitter:image" content="${ogImage}">`,
  ];

  if (route.jsonLd) {
    const schemas = Array.isArray(route.jsonLd) ? route.jsonLd : [route.jsonLd];
    lines.push('');
    for (const schema of schemas) {
      lines.push(
        `<script type="application/ld+json">${JSON.stringify(schema)}</script>`,
      );
    }
  }

  return lines.join('\n    ');
}

function injectMeta(template, metaBlock) {
  let html = template;

  // Remove existing <title> tag (will be replaced by metaBlock)
  html = html.replace(/<title>[^<]*<\/title>\n?\s*/, '');

  // Remove existing meta description (if any)
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>\n?\s*/gi,
    '',
  );

  // Remove existing robots meta (if any)
  html = html.replace(
    /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>\n?\s*/gi,
    '',
  );

  // Remove existing canonical link (if any)
  html = html.replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>\n?\s*/gi, '');

  // Remove existing OG tags
  html = html.replace(/<meta\s+property="og:[^"]*"\s+content="[^"]*"\s*\/?>\n?\s*/gi, '');

  // Remove existing Twitter tags
  html = html.replace(
    /<meta\s+name="twitter:[^"]*"\s+content="[^"]*"\s*\/?>\n?\s*/gi,
    '',
  );

  // Remove existing JSON-LD
  html = html.replace(
    /<script\s+type="application\/ld\+json">[\s\S]*?<\/script>\n?\s*/gi,
    '',
  );

  // Inject after <meta charset="...">
  const charsetMatch = html.match(/<meta\s+charset="[^"]*"\s*\/?>/i);
  if (charsetMatch) {
    const insertPos =
      html.indexOf(charsetMatch[0]) + charsetMatch[0].length;
    html =
      html.slice(0, insertPos) +
      '\n    ' +
      metaBlock +
      '\n' +
      html.slice(insertPos);
  } else {
    html = html.replace('<head>', '<head>\n    ' + metaBlock);
  }

  return html;
}

/* ── Main ── */

console.log('[SEO] Injecting meta tags into dist/...');

for (const route of ROUTES) {
  const metaBlock = buildMetaBlock(route);
  const html = injectMeta(TEMPLATE, metaBlock);

  if (route.path === '/') {
    writeFileSync(join(DIST, 'index.html'), html, 'utf-8');
    console.log('  / -> dist/index.html');
  } else {
    const dir = join(DIST, route.path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html, 'utf-8');
    console.log(`  ${route.path} -> dist${route.path}/index.html`);
  }
}

console.log(`[SEO] Done. Injected meta for ${ROUTES.length} routes.`);

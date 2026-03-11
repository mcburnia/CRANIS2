const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const pg = require('pg');

const app = express();
const PORT = process.env.PORT || 3004;
const WELCOME_USER = process.env.WELCOME_USER || 'CRANIS2';
const WELCOME_PASS = process.env.WELCOME_PASS || '(LetMeIn)';
const WELCOME_SECRET = process.env.WELCOME_SECRET || 'dev-secret-change-me';
const LOG_FILE = process.env.LOG_FILE || '/data/access.log';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser(WELCOME_SECRET));

// Ensure log directory exists
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/* ── Postgres ────────────────────────────────────────────────────────── */

let pool = null;

async function initDatabase() {
  if (!DATABASE_URL) {
    console.warn('[WELCOME] DATABASE_URL not set — assessment persistence disabled');
    return;
  }
  pool = new pg.Pool({ connectionString: DATABASE_URL });

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS cra_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        answers JSONB NOT NULL DEFAULT '{}',
        current_section INT NOT NULL DEFAULT 0,
        scores JSONB,
        category VARCHAR(50),
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS cra_verification_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        code VARCHAR(6) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    // Index for lookups
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cra_assessments_email ON cra_assessments(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cra_verification_codes_email ON cra_verification_codes(email, used)`);
    console.log('[WELCOME] Assessment tables ready');
  } finally {
    client.release();
  }
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function makeToken(username) {
  const payload = JSON.stringify({ u: username, t: Date.now() });
  const hmac = crypto.createHmac('sha256', WELCOME_SECRET).update(payload).digest('hex');
  return Buffer.from(payload).toString('base64') + '.' + hmac;
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const [b64, hmac] = token.split('.');
    const payload = Buffer.from(b64, 'base64').toString();
    const expected = crypto.createHmac('sha256', WELCOME_SECRET).update(payload).digest('hex');
    if (hmac !== expected) return null;
    const data = JSON.parse(payload);
    if (Date.now() - data.t > 24 * 60 * 60 * 1000) return null;
    return data.u;
  } catch {
    return null;
  }
}

function logAccess(req, event) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip,
    country: req.headers['cf-ipcountry'] || null,
    city: req.headers['cf-ipcity'] || null,
    userAgent: req.headers['user-agent'] || null,
    path: req.originalUrl,
  };
  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch (err) {
    console.error('Failed to write access log:', err.message);
  }
}

function isAuthenticated(req) {
  return verifyToken(req.cookies.welcome_auth) !== null;
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/* ── Questionnaire Data ──────────────────────────────────────────────── */

const SECTIONS = [
  {
    id: 'classification',
    title: 'Product Classification',
    description: 'These questions help determine your product\'s CRA risk category. The Cyber Resilience Act classifies products with digital elements into four categories \u2014 Default, Important Class I, Important Class II, and Critical \u2014 each with different compliance requirements.',
  },
  {
    id: 'vulnerability',
    title: 'Vulnerability Management',
    description: 'The CRA places significant emphasis on how manufacturers handle vulnerabilities throughout a product\'s lifecycle. Articles 13 and 14 set out specific obligations for vulnerability handling, coordinated disclosure, and incident reporting.',
  },
  {
    id: 'sbom',
    title: 'Software Bill of Materials',
    description: 'The CRA requires manufacturers to identify and document all components in their products, including third-party and open-source dependencies. An SBOM is the foundation of supply chain transparency under the regulation.',
  },
  {
    id: 'security_design',
    title: 'Security by Design',
    description: 'Annex I of the CRA establishes essential cybersecurity requirements that products must meet. These cover secure defaults, data protection, access control, and resilience \u2014 the principle that security must be built in, not bolted on.',
  },
  {
    id: 'documentation',
    title: 'Technical Documentation',
    description: 'The CRA requires comprehensive technical documentation to demonstrate compliance. This includes risk assessments, technical files per Annex VII, and an EU Declaration of Conformity. Documentation must be retained for 10 years after market placement.',
  },
  {
    id: 'organisation',
    title: 'Organisational Readiness',
    description: 'Beyond the product itself, the CRA imposes obligations on the manufacturer as an organisation. This includes designating responsible persons, defining support periods, and cooperating with market surveillance authorities.',
  },
];

const QUESTIONS = [
  // ── Section 0: Product Classification ──
  {
    id: 'dist_scope',
    section: 0,
    question: 'How widely is your product distributed?',
    explanation: 'The CRA considers distribution scope as a risk factor. Products used by millions of consumers or deployed across critical infrastructure carry higher risk than niche tools with limited reach. Wider distribution means greater potential impact if a vulnerability is exploited.',
    cra_reference: 'Recital 52; Annex III & IV',
    options: [
      { label: 'Narrow \u2014 internal use or a small number of known customers', score: 0 },
      { label: 'Moderate \u2014 hundreds of users, specific industry sector', score: 1 },
      { label: 'Wide \u2014 thousands of users across multiple sectors or consumer-facing', score: 2 },
      { label: 'Very wide \u2014 mass market, critical infrastructure, or essential services', score: 3 },
    ],
  },
  {
    id: 'data_sensitivity',
    section: 0,
    question: 'What type of data does your product process or store?',
    explanation: 'Products handling sensitive data (personal data, financial records, health information, authentication credentials) are considered higher risk under the CRA. The sensitivity of the data your product touches directly affects the potential harm from a security breach.',
    cra_reference: 'Annex I Part I, \u00a73(d); Annex III',
    options: [
      { label: 'Non-sensitive \u2014 no personal data, no credentials, no financial data', score: 0 },
      { label: 'Low sensitivity \u2014 basic user preferences or non-critical operational data', score: 1 },
      { label: 'Moderate \u2014 personal data, business-critical data, or access credentials', score: 2 },
      { label: 'High \u2014 financial data, health records, authentication secrets, or encryption keys', score: 3 },
    ],
  },
  {
    id: 'network_connectivity',
    section: 0,
    question: 'How does your product connect to networks?',
    explanation: 'The CRA specifically targets "products with digital elements" that have a data connection. Products with persistent network connectivity are more exposed to remote attacks. Isolated products with no network interface have a fundamentally different risk profile.',
    cra_reference: 'Article 3(1); Annex I Part I, \u00a72',
    options: [
      { label: 'Isolated \u2014 no network connectivity, air-gapped operation', score: 0 },
      { label: 'Limited \u2014 occasional connections, not always online', score: 1 },
      { label: 'Connected \u2014 regular network access, cloud-connected features', score: 2 },
      { label: 'Always-on \u2014 persistent internet connection, remotely accessible, or provides network services', score: 3 },
    ],
  },
  {
    id: 'user_criticality',
    section: 0,
    question: 'Who are the primary users of your product?',
    explanation: 'The CRA assigns higher risk to products used by critical infrastructure operators, essential services, or in contexts where failure could endanger safety. A product used in a hospital has different implications than one used for personal entertainment.',
    cra_reference: 'Annex III & IV; NIS2 Directive cross-reference',
    options: [
      { label: 'General consumers \u2014 personal use, entertainment, non-critical applications', score: 0 },
      { label: 'Business users \u2014 commercial operations, productivity tools', score: 1 },
      { label: 'Regulated sectors \u2014 finance, healthcare, government, education', score: 2 },
      { label: 'Critical infrastructure \u2014 energy, transport, water, digital infrastructure, essential services', score: 3 },
    ],
  },

  // ── Section 1: Vulnerability Management ──
  {
    id: 'cvd_policy',
    section: 1,
    question: 'Do you have a coordinated vulnerability disclosure (CVD) policy?',
    explanation: 'Article 13(6) of the CRA requires manufacturers to have a policy for coordinated vulnerability disclosure. This means providing a clear, public channel for security researchers and users to report vulnerabilities, and committing to handle reports responsibly with defined timelines. Without a CVD policy, you have no structured way to receive and respond to vulnerability reports.',
    cra_reference: 'Article 13(6)',
    options: [
      { label: 'Not started \u2014 we have no vulnerability reporting channel or policy', score: 0 },
      { label: 'Aware \u2014 we know we need one but haven\u2019t created it yet', score: 1 },
      { label: 'Partial \u2014 we have a security contact or basic process, but it\u2019s not formalised', score: 2 },
      { label: 'Implemented \u2014 we have a published CVD policy with defined timelines and response process', score: 3 },
    ],
  },
  {
    id: 'vuln_monitoring',
    section: 1,
    question: 'Do you actively monitor for vulnerabilities in your product and its dependencies?',
    explanation: 'Article 13(8) requires manufacturers to regularly test and review the security of their products. This includes monitoring public vulnerability databases (NVD, OSV, GitHub Advisories) for known vulnerabilities affecting your code and third-party components. Reactive-only approaches \u2014 waiting for someone to tell you \u2014 are insufficient under the CRA.',
    cra_reference: 'Article 13(8); Annex I Part II, \u00a74',
    options: [
      { label: 'Not started \u2014 we don\u2019t systematically monitor for vulnerabilities', score: 0 },
      { label: 'Aware \u2014 we check occasionally but have no automated process', score: 1 },
      { label: 'Partial \u2014 we have some monitoring (e.g. GitHub Dependabot) but it\u2019s not comprehensive', score: 2 },
      { label: 'Implemented \u2014 continuous monitoring across our codebase and all dependencies with alerts', score: 3 },
    ],
  },
  {
    id: 'incident_reporting',
    section: 1,
    question: 'Do you have a process for reporting actively exploited vulnerabilities?',
    explanation: 'Article 14 requires manufacturers to notify ENISA within 24 hours of becoming aware of an actively exploited vulnerability, with a full report within 72 hours. This is one of the most operationally demanding CRA requirements. You need an internal process that can identify an active exploitation, escalate it, and file the report within the tight deadline.',
    cra_reference: 'Article 14(1)(2)',
    options: [
      { label: 'Not started \u2014 we have no incident reporting process', score: 0 },
      { label: 'Aware \u2014 we know about the 24/72-hour requirement but have no process', score: 1 },
      { label: 'Partial \u2014 we have an incident response process but haven\u2019t adapted it for CRA reporting', score: 2 },
      { label: 'Implemented \u2014 we have a defined process with roles, templates, and escalation paths for ENISA notification', score: 3 },
    ],
  },
  {
    id: 'security_updates',
    section: 1,
    question: 'Do you provide timely security updates for your product?',
    explanation: 'Article 13(9) requires manufacturers to provide security updates for the defined support period, free of charge. Updates must be distributed without undue delay once a vulnerability is identified. The CRA also requires that updates can be installed automatically or that users are notified of available updates.',
    cra_reference: 'Article 13(9); Annex I Part II, \u00a78',
    options: [
      { label: 'Not started \u2014 we don\u2019t have a structured patching process', score: 0 },
      { label: 'Aware \u2014 we fix issues when we find them but timelines vary', score: 1 },
      { label: 'Partial \u2014 we patch critical issues promptly but don\u2019t have formal SLAs', score: 2 },
      { label: 'Implemented \u2014 defined patch SLAs, automated distribution, and user notification', score: 3 },
    ],
  },

  // ── Section 2: Software Bill of Materials ──
  {
    id: 'sbom_maintained',
    section: 2,
    question: 'Do you maintain a Software Bill of Materials (SBOM) for your product?',
    explanation: 'Annex I Part II, \u00a71 requires manufacturers to "identify and document vulnerabilities and components contained in the product, including by drawing up a software bill of materials." An SBOM is a structured list of all software components in your product \u2014 your own code and every library, framework, and tool it depends on. Standard formats include SPDX and CycloneDX.',
    cra_reference: 'Annex I Part II, \u00a71',
    options: [
      { label: 'Not started \u2014 we don\u2019t have an SBOM', score: 0 },
      { label: 'Aware \u2014 we know what an SBOM is but haven\u2019t created one', score: 1 },
      { label: 'Partial \u2014 we have a dependency list but not in a standard SBOM format', score: 2 },
      { label: 'Implemented \u2014 we maintain a machine-readable SBOM (SPDX or CycloneDX) that is kept up to date', score: 3 },
    ],
  },
  {
    id: 'transitive_deps',
    section: 2,
    question: 'Do you track transitive (indirect) dependencies?',
    explanation: 'Your product doesn\u2019t just depend on the libraries you directly import \u2014 those libraries have their own dependencies, which have their own dependencies, and so on. A vulnerability in a transitive dependency (like the Log4Shell incident) can be just as dangerous as one in your own code. The CRA expects your component inventory to be complete, not just surface-level.',
    cra_reference: 'Annex I Part II, \u00a71; Annex VII',
    options: [
      { label: 'Not started \u2014 we only know about our direct dependencies', score: 0 },
      { label: 'Aware \u2014 we understand the risk but haven\u2019t mapped our full dependency tree', score: 1 },
      { label: 'Partial \u2014 we can generate a dependency tree but don\u2019t actively monitor it', score: 2 },
      { label: 'Implemented \u2014 full transitive dependency tracking with automated updates', score: 3 },
    ],
  },
  {
    id: 'dep_vuln_monitoring',
    section: 2,
    question: 'Do you monitor your dependencies for known vulnerabilities?',
    explanation: 'Knowing what components you use is only the first step. You also need to continuously check those components against vulnerability databases. When a CVE is published for a library you depend on, you need to know about it quickly and assess whether your product is affected. Tools like Dependabot, Snyk, or Grype automate this process.',
    cra_reference: 'Annex I Part II, \u00a74; Article 13(8)',
    options: [
      { label: 'Not started \u2014 we don\u2019t monitor dependencies for vulnerabilities', score: 0 },
      { label: 'Aware \u2014 we check manually when we hear about a major vulnerability', score: 1 },
      { label: 'Partial \u2014 we use basic tools (e.g. npm audit) but not consistently', score: 2 },
      { label: 'Implemented \u2014 automated continuous monitoring with alerts for all dependency vulnerabilities', score: 3 },
    ],
  },

  // ── Section 3: Security by Design ──
  {
    id: 'secure_defaults',
    section: 3,
    question: 'Is your product shipped with secure default configurations?',
    explanation: 'Annex I Part I, \u00a73(a) requires products to be "made available on the market with a secure by default configuration, including the possibility to reset the product to its original state." This means no default passwords, unnecessary ports closed, minimum-privilege settings enabled, and non-essential features disabled out of the box. Users should not have to be security experts to use your product safely.',
    cra_reference: 'Annex I Part I, \u00a73(a)',
    options: [
      { label: 'Not started \u2014 we haven\u2019t reviewed our default configurations for security', score: 0 },
      { label: 'Aware \u2014 we know some defaults should be changed but haven\u2019t done a full review', score: 1 },
      { label: 'Partial \u2014 we\u2019ve hardened some defaults but the review isn\u2019t comprehensive', score: 2 },
      { label: 'Implemented \u2014 all defaults reviewed and hardened, no default credentials, minimum privilege', score: 3 },
    ],
  },
  {
    id: 'update_mechanism',
    section: 3,
    question: 'Does your product have a secure automatic update mechanism?',
    explanation: 'Annex I Part I, \u00a73(f) requires products to ensure "the possibility to securely install product-related security updates." This means having a mechanism that can deliver updates securely (authenticated, integrity-verified), and ideally applies security patches automatically unless the user opts out. Updates must not require unnecessary user interaction for security fixes.',
    cra_reference: 'Annex I Part I, \u00a73(f); Annex I Part II, \u00a78',
    options: [
      { label: 'Not started \u2014 updates are manual or ad-hoc', score: 0 },
      { label: 'Aware \u2014 we have a manual update process but no automation', score: 1 },
      { label: 'Partial \u2014 we notify users of updates but they must apply them manually', score: 2 },
      { label: 'Implemented \u2014 secure automatic updates with integrity verification and rollback capability', score: 3 },
    ],
  },
  {
    id: 'data_protection',
    section: 3,
    question: 'Does your product implement appropriate data protection measures?',
    explanation: 'Annex I Part I, \u00a73(d) requires protection of the "confidentiality of stored, transmitted and otherwise processed data, personal or other, such as by encrypting relevant data at rest and in transit." This goes beyond GDPR \u2014 it covers all data your product handles, not just personal data. Encryption, access controls, and data minimisation are key measures.',
    cra_reference: 'Annex I Part I, \u00a73(d)(e)',
    options: [
      { label: 'Not started \u2014 we haven\u2019t implemented specific data protection measures', score: 0 },
      { label: 'Aware \u2014 we encrypt some data but haven\u2019t done a comprehensive review', score: 1 },
      { label: 'Partial \u2014 encryption in transit (TLS) and some data at rest, but gaps remain', score: 2 },
      { label: 'Implemented \u2014 encryption at rest and in transit, data minimisation, access controls, integrity protection', score: 3 },
    ],
  },
  {
    id: 'access_control',
    section: 3,
    question: 'Does your product implement proper authentication and access control?',
    explanation: 'Annex I Part I, \u00a73(c) requires "appropriate control mechanisms, including authentication, identity or access management systems." Products must protect against unauthorised access, and where applicable implement multi-factor authentication. Access should follow the principle of least privilege \u2014 users and components should only have the access they actually need.',
    cra_reference: 'Annex I Part I, \u00a73(c)',
    options: [
      { label: 'Not started \u2014 minimal authentication, no structured access control', score: 0 },
      { label: 'Aware \u2014 basic authentication exists but access control is coarse-grained', score: 1 },
      { label: 'Partial \u2014 role-based access control implemented but not fully reviewed', score: 2 },
      { label: 'Implemented \u2014 robust authentication (MFA where appropriate), least-privilege access, audit logging', score: 3 },
    ],
  },

  // ── Section 4: Technical Documentation ──
  {
    id: 'risk_assessment',
    section: 4,
    question: 'Have you performed a cybersecurity risk assessment for your product?',
    explanation: 'Article 13(3) requires manufacturers to "undertake an assessment of the cybersecurity risks associated with a product with digital elements." This isn\u2019t a one-time exercise \u2014 it must be considered during the planning, design, development, production, delivery, and maintenance phases. The risk assessment should identify threats, evaluate their likelihood and impact, and document how each is mitigated.',
    cra_reference: 'Article 13(3); Annex VII, \u00a74',
    options: [
      { label: 'Not started \u2014 we haven\u2019t performed a formal cybersecurity risk assessment', score: 0 },
      { label: 'Aware \u2014 we\u2019ve done informal threat modelling but nothing documented', score: 1 },
      { label: 'Partial \u2014 we have a documented risk assessment but it doesn\u2019t cover the full lifecycle', score: 2 },
      { label: 'Implemented \u2014 comprehensive risk assessment covering all phases, documented and regularly reviewed', score: 3 },
    ],
  },
  {
    id: 'technical_file',
    section: 4,
    question: 'Do you maintain technical documentation as required by CRA Annex VII?',
    explanation: 'Annex VII specifies the contents of the technical documentation: product description, design and development information, cybersecurity risk assessment, information on the conformity assessment procedure applied, the EU Declaration of Conformity, and information on vulnerability handling. This documentation must be retained for 10 years after the product is placed on the market (Article 13(10)).',
    cra_reference: 'Annex VII; Article 13(10)',
    options: [
      { label: 'Not started \u2014 we don\u2019t have structured technical documentation', score: 0 },
      { label: 'Aware \u2014 we have some documentation but haven\u2019t mapped it to Annex VII', score: 1 },
      { label: 'Partial \u2014 we have documentation for some sections but significant gaps remain', score: 2 },
      { label: 'Implemented \u2014 complete technical file covering all Annex VII requirements', score: 3 },
    ],
  },
  {
    id: 'eu_doc',
    section: 4,
    question: 'Have you prepared an EU Declaration of Conformity?',
    explanation: 'Article 28 and Annex VI require manufacturers to draw up an EU Declaration of Conformity (DoC) stating that the essential requirements of the CRA have been fulfilled. The DoC must include the product identification, manufacturer details, the conformity assessment procedure used, and references to any harmonised standards applied. This is a legal declaration \u2014 signing it makes you legally responsible for conformity.',
    cra_reference: 'Article 28; Annex VI',
    options: [
      { label: 'Not started \u2014 we haven\u2019t prepared a Declaration of Conformity', score: 0 },
      { label: 'Aware \u2014 we know it\u2019s required but haven\u2019t drafted one', score: 1 },
      { label: 'Partial \u2014 we have a draft but it\u2019s not yet complete or signed', score: 2 },
      { label: 'Implemented \u2014 DoC prepared, signed, and ready for market surveillance authorities', score: 3 },
    ],
  },
  {
    id: 'conformity_assessment',
    section: 4,
    question: 'Have you undergone the required conformity assessment procedure?',
    explanation: 'Articles 32 and 33 specify which conformity assessment module applies to your product: Module A (self-assessment) for Default category, Module B+C or H for Important Class II and Critical, and either A or B+C for Important Class I depending on whether harmonised standards have been applied. The assessment must be completed before the product is placed on the market.',
    cra_reference: 'Articles 32\u201333; Annex VIII',
    options: [
      { label: 'Not started \u2014 we haven\u2019t begun any conformity assessment', score: 0 },
      { label: 'Aware \u2014 we know which module applies but haven\u2019t started the process', score: 1 },
      { label: 'Partial \u2014 we\u2019re in the process of completing the assessment', score: 2 },
      { label: 'Implemented \u2014 conformity assessment completed, CE marking applied', score: 3 },
    ],
  },

  // ── Section 5: Organisational Readiness ──
  {
    id: 'responsible_person',
    section: 5,
    question: 'Have you designated a responsible person for CRA compliance?',
    explanation: 'Article 13(15) requires manufacturers to ensure their product is "accompanied by the name, registered trade name or registered trade mark and the postal address and the email address of the manufacturer." More broadly, someone in your organisation needs to own CRA compliance \u2014 coordinating the risk assessment, technical documentation, vulnerability handling, and conformity assessment. Without clear ownership, compliance activities tend to fall through the cracks.',
    cra_reference: 'Article 13(15)(16)',
    options: [
      { label: 'Not started \u2014 no one is specifically responsible for CRA compliance', score: 0 },
      { label: 'Aware \u2014 we know someone needs to own this but haven\u2019t assigned it', score: 1 },
      { label: 'Partial \u2014 someone has been informally assigned but it\u2019s not their primary role', score: 2 },
      { label: 'Implemented \u2014 designated person with clear mandate, resources, and reporting line', score: 3 },
    ],
  },
  {
    id: 'support_period',
    section: 5,
    question: 'Have you defined and communicated an end-of-support date for your product?',
    explanation: 'Article 13(11) requires manufacturers to determine a support period that "reflects the length of time during which the product is expected to be in use." During this period, you must provide security updates free of charge. The support period must be communicated clearly to users before purchase. Setting this expectation is important \u2014 it defines how long your CRA obligations last for each product version.',
    cra_reference: 'Article 13(11)(12)',
    options: [
      { label: 'Not started \u2014 we haven\u2019t defined a support period', score: 0 },
      { label: 'Aware \u2014 we know we need to but haven\u2019t decided on a duration', score: 1 },
      { label: 'Partial \u2014 we have an internal policy but haven\u2019t communicated it to users', score: 2 },
      { label: 'Implemented \u2014 support period defined, publicly communicated, and reflected in product documentation', score: 3 },
    ],
  },
  {
    id: 'market_surveillance',
    section: 5,
    question: 'Are you prepared to cooperate with market surveillance authorities?',
    explanation: 'Article 13(13) requires manufacturers to cooperate with market surveillance authorities and provide information or documentation on request. If a vulnerability is discovered post-market, authorities can require you to take corrective action, recall products, or withdraw them from the market. Being prepared means having documentation readily available, understanding your obligations, and knowing who to contact.',
    cra_reference: 'Article 13(13); Article 16',
    options: [
      { label: 'Not started \u2014 we\u2019re not aware of market surveillance obligations', score: 0 },
      { label: 'Aware \u2014 we know about market surveillance but haven\u2019t prepared', score: 1 },
      { label: 'Partial \u2014 we have documentation that could be provided but no formal process', score: 2 },
      { label: 'Implemented \u2014 documentation accessible, contact points defined, process for responding to authority requests', score: 3 },
    ],
  },
];

/* ── Scoring Logic ───────────────────────────────────────────────────── */

function computeScores(answers) {
  const sectionScores = {};
  const sectionMaxes = {};
  let totalScore = 0;
  let totalMax = 0;

  SECTIONS.forEach((section, idx) => {
    sectionScores[section.id] = 0;
    sectionMaxes[section.id] = 0;
  });

  QUESTIONS.forEach(q => {
    const section = SECTIONS[q.section];
    const answer = answers[q.id];
    const score = (answer !== undefined && answer !== null) ? q.options[answer].score : 0;
    const max = 3;

    sectionScores[section.id] += score;
    sectionMaxes[section.id] += max;
    totalScore += score;
    totalMax += max;
  });

  const sectionResults = {};
  SECTIONS.forEach(section => {
    const score = sectionScores[section.id];
    const max = sectionMaxes[section.id];
    const pct = max > 0 ? Math.round((score / max) * 100) : 0;
    let level;
    if (pct >= 75) level = 'Advanced';
    else if (pct >= 50) level = 'Developing';
    else if (pct >= 25) level = 'Early stage';
    else level = 'Not started';

    sectionResults[section.id] = { score, max, pct, level };
  });

  const overallPct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

  return { sections: sectionResults, overallPct, totalScore, totalMax };
}

function determineCategory(answers) {
  const classificationQuestions = QUESTIONS.filter(q => q.section === 0);
  let total = 0;
  let count = 0;
  classificationQuestions.forEach(q => {
    const answer = answers[q.id];
    if (answer !== undefined && answer !== null) {
      total += q.options[answer].score;
      count++;
    }
  });

  if (count === 0) return 'default';
  const avg = total / (count * 3); // normalise to 0\u20131
  if (avg >= 0.75) return 'critical';
  if (avg >= 0.50) return 'important_ii';
  if (avg >= 0.25) return 'important_i';
  return 'default';
}

function getConformityModule(category) {
  switch (category) {
    case 'critical':
      return { module: 'Module H', fullName: 'Module H \u2014 Full Quality Assurance', needsNB: true,
        description: 'Your product requires the most rigorous assessment procedure. A notified body must approve your quality assurance system covering design, production, and post-market surveillance, with periodic inspections.' };
    case 'important_ii':
      return { module: 'Module B+C or H', fullName: 'Module B+C (EU-Type Examination) or Module H (Full QA)', needsNB: true,
        description: 'Your product requires third-party assessment regardless of whether harmonised standards are applied. You may choose between EU-type examination (Module B+C) or full quality assurance (Module H).' };
    case 'important_i':
      return { module: 'Module A or B+C', fullName: 'Module A (Self-Assessment) or Module B+C', needsNB: false,
        description: 'If you have fully applied relevant harmonised standards (EN 18031), you can self-assess under Module A. Otherwise, you\u2019ll need EU-type examination (Module B+C) from a notified body.' };
    default:
      return { module: 'Module A', fullName: 'Module A \u2014 Internal Control', needsNB: false,
        description: 'Your product qualifies for self-assessment. You perform the conformity assessment internally, prepare your technical documentation and EU Declaration of Conformity, and affix the CE marking yourself. No notified body involvement required.' };
  }
}

function getTopRecommendations(scores, answers) {
  const recommendations = [];

  // Find weakest sections (excluding classification)
  const scoredSections = SECTIONS.filter(s => s.id !== 'classification')
    .map(s => ({ ...s, ...scores.sections[s.id] }))
    .sort((a, b) => a.pct - b.pct);

  scoredSections.forEach(section => {
    if (section.pct >= 75) return; // already advanced
    const sectionQuestions = QUESTIONS.filter(q => SECTIONS[q.section].id === section.id);
    const weakest = sectionQuestions
      .filter(q => {
        const a = answers[q.id];
        return a === undefined || a === null || q.options[a].score < 2;
      })
      .slice(0, 2);

    weakest.forEach(q => {
      const currentAnswer = answers[q.id];
      const currentScore = (currentAnswer !== undefined && currentAnswer !== null) ? q.options[currentAnswer].score : 0;
      const nextLevel = q.options[Math.min(currentScore + 1, 3)];
      recommendations.push({
        section: section.title,
        question: q.question,
        current: currentScore === 0 ? 'Not started' : q.options[currentAnswer].label,
        target: nextLevel.label,
        cra_reference: q.cra_reference,
        priority: currentScore === 0 ? 'high' : 'medium',
      });
    });
  });

  return recommendations.sort((a, b) => {
    if (a.priority === 'high' && b.priority !== 'high') return -1;
    if (a.priority !== 'high' && b.priority === 'high') return 1;
    return 0;
  }).slice(0, 6);
}

const CATEGORY_LABELS = {
  default: 'Default',
  important_i: 'Important Class I',
  important_ii: 'Important Class II',
  critical: 'Critical',
};

/* ── Welcome Site Routes (unchanged) ─────────────────────────────────── */

app.get('/login', (req, res) => {
  const error = req.query.error === '1';
  logAccess(req, 'login_page');
  res.send(loginPage(error));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === WELCOME_USER && password === WELCOME_PASS) {
    const token = makeToken(username);
    res.cookie('welcome_auth', token, {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
    });
    logAccess(req, 'login_success');
    return res.redirect('/');
  }
  logAccess(req, 'login_failed');
  res.redirect('/login?error=1');
});

app.get('/logout', (req, res) => {
  logAccess(req, 'logout');
  res.clearCookie('welcome_auth');
  res.redirect('/login');
});

app.get('/access-log', (req, res) => {
  if (!isAuthenticated(req)) return res.redirect('/login');
  logAccess(req, 'view_log');
  try {
    const raw = fs.readFileSync(LOG_FILE, 'utf-8').trim();
    const entries = raw ? raw.split('\n').map(line => JSON.parse(line)) : [];
    res.json({ total: entries.length, entries: entries.reverse() });
  } catch {
    res.json({ total: 0, entries: [] });
  }
});

app.post('/contact', async (req, res) => {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'Unauthorised' });

  const { name, email, position } = req.body || {};
  if (!name || !email || !position) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  logAccess(req, 'contact_form');

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return res.status(500).json({ error: 'Email service not configured.' });
  }

  try {
    const thankYouRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'CRANIS2 <noreply@poste.cranis2.com>',
        to: [email],
        subject: 'Thank you for your interest in CRANIS2',
        html: `<p>Dear ${escapeHtml(name)},</p>
<p>Thank you for your interest in CRANIS2. We have received your enquiry and will be in touch shortly.</p>
<p>Best regards,<br>The CRANIS2 Team</p>`
      })
    });
    if (!thankYouRes.ok) {
      const errBody = await thankYouRes.text();
      console.error('Resend thank-you email failed:', thankYouRes.status, errBody);
      return res.status(502).json({ error: 'Failed to send confirmation email.' });
    }

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'CRANIS2 Welcome <noreply@poste.cranis2.com>',
        to: ['info@cranis2.com'],
        subject: `New CRANIS2 Enquiry \u2014 ${name} (${position})`,
        html: `<h3>New Enquiry from Welcome Page</h3>
<table style="border-collapse:collapse;">
<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Name</td><td>${escapeHtml(name)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Email</td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Position</td><td>${escapeHtml(position)}</td></tr>
</table>`
      })
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Contact form email error:', err);
    res.status(500).json({ error: 'Failed to send email.' });
  }
});

/* ── Conformity Assessment API Endpoints ─────────────────────────────── */

// Send verification code
app.post('/conformity-assessment/send-code', async (req, res) => {
  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  if (!pool) return res.status(503).json({ error: 'Database not available.' });

  try {
    // Rate limit: max 3 codes per email per hour
    const recentCodes = await pool.query(
      `SELECT COUNT(*) FROM cra_verification_codes
       WHERE email = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [email.toLowerCase()]
    );
    if (parseInt(recentCodes.rows[0].count) >= 3) {
      return res.status(429).json({ error: 'Too many verification attempts. Please try again later.' });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await pool.query(
      `INSERT INTO cra_verification_codes (email, code, expires_at) VALUES ($1, $2, $3)`,
      [email.toLowerCase(), code, expiresAt]
    );

    if (!RESEND_API_KEY) {
      console.log(`[DEV] Verification code for ${email}: ${code}`);
      return res.json({ ok: true, dev_code: code });
    }

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'CRANIS2 <noreply@poste.cranis2.com>',
        to: [email],
        subject: `Your CRANIS2 verification code: ${code}`,
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;">
<div style="font-size:13px;font-weight:700;color:#a855f7;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:16px;">CRANIS2</div>
<h2 style="font-size:20px;color:#111827;margin-bottom:16px;">Your verification code</h2>
<p style="font-size:14px;color:#4b5563;margin-bottom:24px;">Enter this code to access or resume your CRA Readiness Assessment:</p>
<div style="background:#f3f4f6;border-radius:8px;padding:16px;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;color:#111827;margin-bottom:24px;">${code}</div>
<p style="font-size:12px;color:#9ca3af;">This code expires in 10 minutes. If you didn\u2019t request this, you can safely ignore this email.</p>
</div>`
      })
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      console.error('Verification email failed:', emailRes.status, errBody);
      return res.status(502).json({ error: 'Failed to send verification email.' });
    }

    logAccess(req, 'assessment_code_sent');
    res.json({ ok: true });
  } catch (err) {
    console.error('Send code error:', err);
    res.status(500).json({ error: 'Failed to send verification code.' });
  }
});

// Verify code and return/create session
app.post('/conformity-assessment/verify', async (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required.' });
  }

  if (!pool) return res.status(503).json({ error: 'Database not available.' });

  try {
    const result = await pool.query(
      `SELECT id FROM cra_verification_codes
       WHERE email = $1 AND code = $2 AND used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [email.toLowerCase(), code]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired code. Please request a new one.' });
    }

    // Mark code as used
    await pool.query(`UPDATE cra_verification_codes SET used = TRUE WHERE id = $1`, [result.rows[0].id]);

    // Find or create assessment
    const existing = await pool.query(
      `SELECT id, answers, current_section, completed_at FROM cra_assessments
       WHERE email = $1 ORDER BY updated_at DESC LIMIT 1`,
      [email.toLowerCase()]
    );

    let assessment;
    if (existing.rows.length > 0 && !existing.rows[0].completed_at) {
      assessment = existing.rows[0];
    } else {
      const newAssessment = await pool.query(
        `INSERT INTO cra_assessments (email) VALUES ($1) RETURNING id, answers, current_section`,
        [email.toLowerCase()]
      );
      assessment = newAssessment.rows[0];
    }

    logAccess(req, 'assessment_verified');
    res.json({
      ok: true,
      assessmentId: assessment.id,
      answers: assessment.answers,
      currentSection: assessment.current_section,
    });
  } catch (err) {
    console.error('Verify code error:', err);
    res.status(500).json({ error: 'Verification failed.' });
  }
});

// Save progress
app.post('/conformity-assessment/save-progress', async (req, res) => {
  const { assessmentId, answers, currentSection } = req.body || {};
  if (!assessmentId) {
    return res.status(400).json({ error: 'Assessment ID is required.' });
  }

  if (!pool) return res.status(503).json({ error: 'Database not available.' });

  try {
    await pool.query(
      `UPDATE cra_assessments SET answers = $1, current_section = $2, updated_at = NOW()
       WHERE id = $3 AND completed_at IS NULL`,
      [JSON.stringify(answers || {}), currentSection || 0, assessmentId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Save progress error:', err);
    res.status(500).json({ error: 'Failed to save progress.' });
  }
});

// Complete assessment
app.post('/conformity-assessment/complete', async (req, res) => {
  const { assessmentId, answers } = req.body || {};
  if (!assessmentId) {
    return res.status(400).json({ error: 'Assessment ID is required.' });
  }

  if (!pool) return res.status(503).json({ error: 'Database not available.' });

  try {
    const scores = computeScores(answers || {});
    const category = determineCategory(answers || {});

    await pool.query(
      `UPDATE cra_assessments
       SET answers = $1, scores = $2, category = $3, completed_at = NOW(), updated_at = NOW(),
           current_section = $4
       WHERE id = $5`,
      [JSON.stringify(answers || {}), JSON.stringify(scores), category, SECTIONS.length, assessmentId]
    );

    logAccess(req, 'assessment_completed');
    res.json({ ok: true, scores, category });
  } catch (err) {
    console.error('Complete assessment error:', err);
    res.status(500).json({ error: 'Failed to complete assessment.' });
  }
});

// Send report email
app.post('/conformity-assessment/send-report', async (req, res) => {
  const { assessmentId, email: reportEmail } = req.body || {};
  if (!assessmentId) {
    return res.status(400).json({ error: 'Assessment ID is required.' });
  }
  if (!reportEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reportEmail)) {
    return res.status(400).json({ error: 'Valid email address is required.' });
  }

  if (!pool) return res.status(503).json({ error: 'Database not available.' });
  if (!RESEND_API_KEY) return res.status(503).json({ error: 'Email service not configured.' });

  try {
    const result = await pool.query(
      `SELECT answers, scores, category, email FROM cra_assessments WHERE id = $1`,
      [assessmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found.' });
    }

    const { answers, scores, category } = result.rows[0];
    const conformity = getConformityModule(category);
    const recommendations = getTopRecommendations(scores, answers);

    const reportHtml = buildReportEmail(answers, scores, category, conformity, recommendations);

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'CRANIS2 <noreply@poste.cranis2.com>',
        to: [reportEmail],
        subject: `Your CRA Readiness Assessment Report \u2014 ${scores.overallPct}% Ready`,
        html: reportHtml,
      })
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      console.error('Report email failed:', emailRes.status, errBody);
      return res.status(502).json({ error: 'Failed to send report email.' });
    }

    // Also send lead notification
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'CRANIS2 Assessment <noreply@poste.cranis2.com>',
        to: ['info@cranis2.com'],
        subject: `CRA Assessment Completed \u2014 ${reportEmail} (${scores.overallPct}% ready, ${CATEGORY_LABELS[category]})`,
        html: `<h3>CRA Readiness Assessment Completed</h3>
<table style="border-collapse:collapse;font-family:sans-serif;">
<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Email</td><td>${escapeHtml(reportEmail)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Readiness</td><td>${scores.overallPct}%</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Category</td><td>${CATEGORY_LABELS[category]}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Conformity Module</td><td>${conformity.module}</td></tr>
</table>
<h4>Section Scores</h4>
<table style="border-collapse:collapse;font-family:sans-serif;">
${SECTIONS.map(s => `<tr><td style="padding:2px 12px 2px 0;">${s.title}</td><td>${scores.sections[s.id].pct}% (${scores.sections[s.id].level})</td></tr>`).join('\n')}
</table>`
      })
    });

    logAccess(req, 'assessment_report_sent');
    res.json({ ok: true });
  } catch (err) {
    console.error('Send report error:', err);
    res.status(500).json({ error: 'Failed to send report.' });
  }
});

/* ── Report Email Builder ────────────────────────────────────────────── */

function buildReportEmail(answers, scores, category, conformity, recommendations) {
  const catLabel = CATEGORY_LABELS[category] || 'Default';
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const sectionBars = SECTIONS.map(s => {
    const sc = scores.sections[s.id];
    const barColor = sc.pct >= 75 ? '#10b981' : sc.pct >= 50 ? '#f59e0b' : sc.pct >= 25 ? '#f97316' : '#ef4444';
    return `<tr>
      <td style="padding:6px 12px 6px 0;font-size:13px;color:#374151;white-space:nowrap;">${s.title}</td>
      <td style="padding:6px 0;width:100%;">
        <div style="background:#f3f4f6;border-radius:4px;height:20px;position:relative;">
          <div style="background:${barColor};border-radius:4px;height:20px;width:${sc.pct}%;min-width:${sc.pct > 0 ? '2px' : '0'};"></div>
        </div>
      </td>
      <td style="padding:6px 0 6px 12px;font-size:13px;color:#111827;font-weight:600;white-space:nowrap;">${sc.pct}%</td>
      <td style="padding:6px 0 6px 8px;font-size:11px;color:#6b7280;white-space:nowrap;">${sc.level}</td>
    </tr>`;
  }).join('\n');

  const questionDetails = SECTIONS.map(section => {
    const sectionQs = QUESTIONS.filter(q => SECTIONS[q.section].id === section.id);
    const rows = sectionQs.map(q => {
      const ansIdx = answers[q.id];
      const answered = ansIdx !== undefined && ansIdx !== null;
      const score = answered ? q.options[ansIdx].score : 0;
      const label = answered ? q.options[ansIdx].label : 'Not answered';
      const dots = [0,1,2,3].map(i =>
        `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:3px;background:${i <= score - 1 ? '#2563eb' : '#e5e7eb'};"></span>`
      ).join('');
      return `<tr>
        <td style="padding:6px 8px 6px 0;font-size:12px;color:#374151;vertical-align:top;">${q.question}</td>
        <td style="padding:6px 0;font-size:12px;color:#6b7280;vertical-align:top;white-space:nowrap;">${dots}</td>
      </tr>
      <tr><td colspan="2" style="padding:0 0 10px 0;font-size:11px;color:#9ca3af;">${label}</td></tr>`;
    }).join('\n');

    return `<tr><td colspan="2" style="padding:16px 0 6px 0;font-size:14px;font-weight:600;color:#111827;border-bottom:1px solid #e5e7eb;">${section.title}</td></tr>\n${rows}`;
  }).join('\n');

  const recRows = recommendations.map(r => {
    const priorityColor = r.priority === 'high' ? '#ef4444' : '#f59e0b';
    const priorityLabel = r.priority === 'high' ? 'HIGH' : 'MEDIUM';
    return `<tr>
      <td style="padding:8px 8px 8px 0;vertical-align:top;">
        <span style="font-size:10px;font-weight:700;color:${priorityColor};text-transform:uppercase;">${priorityLabel}</span>
      </td>
      <td style="padding:8px 0;font-size:13px;color:#374151;vertical-align:top;">
        <strong>${r.question}</strong><br>
        <span style="font-size:12px;color:#6b7280;">Next step: ${r.target}</span><br>
        <span style="font-size:11px;color:#9ca3af;">${r.cra_reference}</span>
      </td>
    </tr>`;
  }).join('\n');

  const overallColor = scores.overallPct >= 75 ? '#10b981' : scores.overallPct >= 50 ? '#f59e0b' : scores.overallPct >= 25 ? '#f97316' : '#ef4444';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;">
<div style="max-width:640px;margin:0 auto;padding:32px 20px;">

<!-- Header -->
<div style="text-align:center;margin-bottom:32px;">
  <div style="font-size:13px;font-weight:700;color:#a855f7;text-transform:uppercase;letter-spacing:0.05em;">CRANIS2</div>
  <h1 style="font-size:24px;color:#111827;margin:8px 0 4px;">CRA Readiness Assessment Report</h1>
  <p style="font-size:13px;color:#6b7280;">${date}</p>
</div>

<!-- Overall Score -->
<div style="background:white;border-radius:12px;border:1px solid #e5e7eb;padding:24px;margin-bottom:20px;text-align:center;">
  <div style="font-size:48px;font-weight:700;color:${overallColor};">${scores.overallPct}%</div>
  <div style="font-size:14px;color:#6b7280;margin-bottom:16px;">Overall CRA Readiness</div>

  <div style="display:inline-block;background:#f3f4f6;border-radius:8px;padding:12px 24px;margin-bottom:16px;">
    <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Product Category</div>
    <div style="font-size:16px;font-weight:700;color:#111827;">${catLabel}</div>
  </div>

  <div style="margin-top:8px;">
    <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Conformity Assessment</div>
    <div style="font-size:14px;font-weight:600;color:#111827;">${conformity.fullName}</div>
    <div style="font-size:12px;color:${conformity.needsNB ? '#f59e0b' : '#10b981'};font-weight:600;margin-top:4px;">
      ${conformity.needsNB ? 'Notified Body Required' : 'Self-Assessment Permitted'}
    </div>
  </div>
</div>

<!-- Conformity Assessment Detail -->
<div style="background:white;border-radius:12px;border:1px solid #e5e7eb;padding:24px;margin-bottom:20px;">
  <h2 style="font-size:16px;color:#111827;margin:0 0 12px;">Your Conformity Assessment Path</h2>
  <p style="font-size:13px;color:#4b5563;line-height:1.6;margin:0;">${conformity.description}</p>
</div>

<!-- Section Breakdown -->
<div style="background:white;border-radius:12px;border:1px solid #e5e7eb;padding:24px;margin-bottom:20px;">
  <h2 style="font-size:16px;color:#111827;margin:0 0 16px;">Maturity Breakdown</h2>
  <table style="width:100%;border-collapse:collapse;">
    ${sectionBars}
  </table>
</div>

<!-- Detailed Answers -->
<div style="background:white;border-radius:12px;border:1px solid #e5e7eb;padding:24px;margin-bottom:20px;">
  <h2 style="font-size:16px;color:#111827;margin:0 0 8px;">Detailed Responses</h2>
  <table style="width:100%;border-collapse:collapse;">
    ${questionDetails}
  </table>
</div>

<!-- Recommendations -->
${recommendations.length > 0 ? `
<div style="background:white;border-radius:12px;border:1px solid #e5e7eb;padding:24px;margin-bottom:20px;">
  <h2 style="font-size:16px;color:#111827;margin:0 0 16px;">Priority Recommendations</h2>
  <p style="font-size:13px;color:#6b7280;margin:0 0 16px;">Based on your responses, these are the areas where action would have the most impact on your CRA readiness:</p>
  <table style="width:100%;border-collapse:collapse;">
    ${recRows}
  </table>
</div>
` : ''}

<!-- CTA -->
<div style="background:white;border-radius:12px;border:1px solid #e5e7eb;padding:28px;text-align:center;margin-bottom:20px;">
  <h2 style="font-size:18px;color:#111827;margin:0 0 8px;">Need Help Getting CRA Ready?</h2>
  <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0 0 20px;">CRANIS2 helps you manage every aspect of CRA compliance \u2014 from SBOM management and vulnerability scanning to technical documentation and conformity assessment tracking.</p>
  <a href="https://dev.cranis2.dev" style="display:inline-block;padding:12px 28px;background:#a855f7;color:white;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Learn More About CRANIS2</a>
</div>

<!-- Footer -->
<div style="text-align:center;font-size:11px;color:#9ca3af;margin-top:24px;">
  <p>This assessment is for guidance only and does not constitute legal advice. Consult with a qualified professional for specific compliance requirements.</p>
  <p style="margin-top:8px;">\u00a9 CRANIS2 ${new Date().getFullYear()} \u2014 EU Cyber Resilience Act Compliance Platform</p>
</div>

</div>
</body>
</html>`;
}

/* ── Conformity Assessment Page ──────────────────────────────────────── */

app.get('/conformity-assessment', (req, res) => {
  logAccess(req, 'conformity_assessment_tool');
  res.send(conformityAssessmentPage());
});

app.get('/', (req, res) => {
  if (!isAuthenticated(req)) return res.redirect('/login');
  logAccess(req, 'page_view');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ── Login page HTML ─────────────────────────────────────────────────── */

function loginPage(error) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CRANIS2 \u2014 Welcome</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0f0f14; color: #e4e4e7; min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
  }
  .login-card {
    background: #1a1a22; border: 1px solid #2a2a35; border-radius: 12px;
    padding: 2.5rem; width: 380px; max-width: 90vw;
  }
  .login-logo {
    font-size: 1.4rem; font-weight: 800; color: #a855f7; text-align: center;
    margin-bottom: 0.25rem; letter-spacing: -0.02em;
  }
  .login-subtitle {
    font-size: 0.82rem; color: #71717a; text-align: center; margin-bottom: 2rem;
  }
  .login-label {
    display: block; font-size: 0.78rem; font-weight: 600; color: #a1a1aa;
    margin-bottom: 0.35rem; text-transform: uppercase; letter-spacing: 0.04em;
  }
  .login-input {
    width: 100%; padding: 0.65rem 0.85rem; border: 1px solid #2a2a35;
    border-radius: 6px; background: #0f0f14; color: #e4e4e7;
    font-size: 0.9rem; font-family: inherit; margin-bottom: 1.25rem;
    outline: none; transition: border-color 0.15s;
  }
  .login-input:focus { border-color: #a855f7; }
  .login-btn {
    width: 100%; padding: 0.7rem; border: none; border-radius: 6px;
    background: #a855f7; color: white; font-size: 0.9rem; font-weight: 600;
    cursor: pointer; font-family: inherit; transition: background 0.15s;
  }
  .login-btn:hover { background: #9333ea; }
  .login-error {
    background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25);
    border-radius: 6px; padding: 0.6rem 0.85rem; margin-bottom: 1.25rem;
    font-size: 0.82rem; color: #f87171;
  }
</style>
</head>
<body>
<div class="login-card">
  <div class="login-logo">CRANIS2</div>
  <div class="login-subtitle">Strategy &amp; Ecosystem Context</div>
  ${error ? '<div class="login-error">Invalid credentials. Please try again.</div>' : ''}
  <form method="POST" action="/login">
    <label class="login-label" for="username">Username</label>
    <input class="login-input" type="text" id="username" name="username" autocomplete="username" required autofocus>
    <label class="login-label" for="password">Password</label>
    <input class="login-input" type="password" id="password" name="password" autocomplete="current-password" required>
    <button class="login-btn" type="submit">Sign In</button>
  </form>
</div>
</body>
</html>`;
}

/* ── Conformity Assessment Questionnaire Page ────────────────────────── */

function conformityAssessmentPage() {
  // Embed questions and sections as JSON for client-side rendering
  const sectionsJson = JSON.stringify(SECTIONS);
  const questionsJson = JSON.stringify(QUESTIONS);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CRA Readiness Assessment \u2014 CRANIS2</title>
<meta name="description" content="Free CRA readiness assessment. Find out your product's risk category, required conformity assessment module, and get a personalised maturity report with recommendations.">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #111827; min-height: 100vh; }
  .page { max-width: 680px; margin: 0 auto; padding: 40px 20px 80px; }
  .brand { font-size: 13px; font-weight: 700; color: #a855f7; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
  h1 { font-size: 26px; font-weight: 700; color: #111827; margin-bottom: 8px; line-height: 1.3; }
  .subtitle { font-size: 14px; color: #6b7280; margin-bottom: 28px; line-height: 1.6; }

  /* Progress bar */
  .progress-wrap { margin-bottom: 28px; }
  .progress-bar-bg { background: #e5e7eb; border-radius: 4px; height: 6px; }
  .progress-bar { background: #a855f7; border-radius: 4px; height: 6px; transition: width 0.3s; }
  .progress-label { display: flex; justify-content: space-between; font-size: 12px; color: #9ca3af; margin-top: 6px; }

  /* Cards */
  .card { background: white; border-radius: 12px; border: 1px solid #e5e7eb; padding: 28px; margin-bottom: 20px; }

  /* Email verification */
  .email-input { width: 100%; padding: 12px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; font-family: inherit; outline: none; margin-bottom: 12px; }
  .email-input:focus { border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168,85,247,0.1); }
  .code-input { width: 180px; padding: 12px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 18px; font-family: inherit; outline: none; text-align: center; letter-spacing: 4px; }
  .code-input:focus { border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168,85,247,0.1); }

  /* Buttons */
  .btn { padding: 12px 24px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s; }
  .btn-primary { background: #a855f7; color: white; }
  .btn-primary:hover { background: #9333ea; }
  .btn-primary:disabled { background: #d8b4fe; cursor: not-allowed; }
  .btn-secondary { background: white; color: #374151; border: 1px solid #d1d5db; }
  .btn-secondary:hover { background: #f9fafb; }
  .btn-sm { padding: 8px 16px; font-size: 13px; }

  /* Section header */
  .section-header { margin-bottom: 20px; }
  .section-num { font-size: 12px; font-weight: 600; color: #a855f7; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
  .section-title { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 8px; }
  .section-desc { font-size: 13px; color: #6b7280; line-height: 1.6; }

  /* Question */
  .question-block { margin-bottom: 28px; padding-bottom: 28px; border-bottom: 1px solid #f3f4f6; }
  .question-block:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
  .question-text { font-size: 15px; font-weight: 600; color: #111827; margin-bottom: 8px; line-height: 1.4; }
  .question-explain { font-size: 12px; color: #6b7280; line-height: 1.6; margin-bottom: 4px; background: #f9fafb; border-radius: 8px; padding: 12px; }
  .question-ref { font-size: 11px; color: #a855f7; font-weight: 600; margin-bottom: 12px; display: inline-block; }
  .explain-toggle { font-size: 12px; color: #6b7280; cursor: pointer; margin-bottom: 12px; display: inline-block; }
  .explain-toggle:hover { color: #374151; }

  /* Options */
  .option { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 8px; cursor: pointer; transition: background 0.1s; margin-bottom: 4px; }
  .option:hover { background: #f9fafb; }
  .option.selected { background: #f5f3ff; }
  .option input[type="radio"] { margin-top: 2px; accent-color: #a855f7; width: 16px; height: 16px; flex-shrink: 0; }
  .option label { font-size: 13px; color: #374151; line-height: 1.5; cursor: pointer; }

  /* Navigation */
  .nav-row { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }

  /* Results */
  .result-score { text-align: center; margin-bottom: 20px; }
  .result-score .big-num { font-size: 56px; font-weight: 700; line-height: 1; }
  .result-score .big-label { font-size: 14px; color: #6b7280; margin-top: 4px; }

  .maturity-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
  .maturity-label { font-size: 13px; color: #374151; width: 160px; flex-shrink: 0; }
  .maturity-bar-bg { flex: 1; background: #f3f4f6; border-radius: 4px; height: 16px; }
  .maturity-bar { border-radius: 4px; height: 16px; transition: width 0.5s; }
  .maturity-pct { font-size: 13px; font-weight: 600; width: 40px; text-align: right; }
  .maturity-level { font-size: 11px; color: #6b7280; width: 80px; }

  .conformity-box { padding: 16px; border-radius: 8px; margin-bottom: 16px; }
  .conformity-box.ok { background: #ecfdf5; border: 1px solid #a7f3d0; }
  .conformity-box.warning { background: #fffbeb; border: 1px solid #fde68a; }
  .conformity-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
  .conformity-desc { font-size: 13px; line-height: 1.6; }
  .conformity-tag { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; margin-top: 8px; }
  .conformity-tag.ok { background: #d1fae5; color: #065f46; }
  .conformity-tag.warning { background: #fef3c7; color: #92400e; }

  .rec-item { padding: 12px; border-radius: 8px; background: #f9fafb; margin-bottom: 8px; }
  .rec-priority { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .rec-priority.high { color: #ef4444; }
  .rec-priority.medium { color: #f59e0b; }
  .rec-question { font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 2px; }
  .rec-next { font-size: 12px; color: #6b7280; }
  .rec-ref { font-size: 11px; color: #a855f7; }

  /* Report form */
  .report-form { display: flex; gap: 8px; align-items: flex-start; }
  .report-form .email-input { margin-bottom: 0; flex: 1; }

  /* Error/success messages */
  .msg { padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 12px; }
  .msg-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
  .msg-success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
  .msg-info { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }

  .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #9ca3af; }
  .footer a { color: #a855f7; text-decoration: none; }

  .hidden { display: none; }

  /* Loading spinner */
  .spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; vertical-align: middle; margin-right: 6px; }
  @keyframes spin { to { transform: rotate(360deg); } }

  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .animate-in { animation: fadeIn 0.3s ease-out; }
</style>
</head>
<body>
<div class="page">
  <div class="brand">CRANIS2</div>
  <h1>CRA Readiness Assessment</h1>
  <p class="subtitle">
    Find out how ready your product is for the EU Cyber Resilience Act. This free assessment covers
    22 questions across 6 key areas, determines your product\u2019s risk category, identifies the
    required conformity assessment module, and provides personalised recommendations.<br>
    <strong>Takes about 10 minutes.</strong> You can save your progress and return later.
  </p>

  <!-- Phase 1: Email verification -->
  <div id="phase-email" class="card">
    <h2 style="font-size:18px;margin-bottom:4px;">Enter your email to begin</h2>
    <p style="font-size:13px;color:#6b7280;margin-bottom:16px;">We\u2019ll send you a verification code. Your progress is saved automatically so you can return at any time.</p>
    <div id="email-msg"></div>
    <div id="email-step">
      <input type="email" class="email-input" id="email-input" placeholder="you@company.com" autocomplete="email">
      <button class="btn btn-primary" id="send-code-btn" onclick="sendCode()">Send Verification Code</button>
    </div>
    <div id="code-step" class="hidden">
      <p style="font-size:13px;color:#374151;margin-bottom:12px;">Enter the 6-digit code we sent to <strong id="code-email-display"></strong></p>
      <div style="display:flex;gap:12px;align-items:center;">
        <input type="text" class="code-input" id="code-input" maxlength="6" placeholder="000000" autocomplete="one-time-code">
        <button class="btn btn-primary" id="verify-btn" onclick="verifyCode()">Verify</button>
      </div>
      <button class="btn-link" style="background:none;border:none;color:#6b7280;font-size:12px;cursor:pointer;margin-top:8px;font-family:inherit;" onclick="resetEmail()">Use a different email</button>
    </div>
  </div>

  <!-- Phase 2: Questionnaire -->
  <div id="phase-questionnaire" class="hidden">
    <div class="progress-wrap">
      <div class="progress-bar-bg"><div class="progress-bar" id="progress-bar" style="width:0%"></div></div>
      <div class="progress-label">
        <span id="progress-section">Section 1 of 6</span>
        <span id="progress-pct">0%</span>
      </div>
    </div>
    <div class="card" id="question-card">
      <!-- Rendered by JS -->
    </div>
    <div class="nav-row">
      <button class="btn btn-secondary" id="prev-btn" onclick="prevSection()">Back</button>
      <button class="btn btn-primary" id="next-btn" onclick="nextSection()">Continue</button>
    </div>
  </div>

  <!-- Phase 3: Results -->
  <div id="phase-results" class="hidden animate-in">
    <!-- Rendered by JS -->
  </div>

  <div class="footer">
    Powered by <a href="https://dev.cranis2.dev">CRANIS2</a> \u2014 EU Cyber Resilience Act Compliance Platform
  </div>
</div>

<script>
const SECTIONS = ${sectionsJson};
const QUESTIONS = ${questionsJson};
const CATEGORY_LABELS = { default: 'Default', important_i: 'Important Class I', important_ii: 'Important Class II', critical: 'Critical' };

let assessmentId = null;
let sessionEmail = '';
let answers = {};
let currentSection = 0;

/* ── Email Verification ── */

async function sendCode() {
  const email = document.getElementById('email-input').value.trim();
  if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    showMsg('email-msg', 'Please enter a valid email address.', 'error');
    return;
  }
  const btn = document.getElementById('send-code-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Sending\u2026';
  showMsg('email-msg', '', '');

  try {
    const res = await fetch('/conformity-assessment/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) {
      showMsg('email-msg', data.error || 'Failed to send code.', 'error');
      btn.disabled = false;
      btn.textContent = 'Send Verification Code';
      return;
    }
    sessionEmail = email;
    document.getElementById('code-email-display').textContent = email;
    document.getElementById('email-step').classList.add('hidden');
    document.getElementById('code-step').classList.remove('hidden');
    showMsg('email-msg', 'Verification code sent. Check your inbox.', 'success');
    document.getElementById('code-input').focus();
  } catch (err) {
    showMsg('email-msg', 'Network error. Please try again.', 'error');
  }
  btn.disabled = false;
  btn.textContent = 'Send Verification Code';
}

async function verifyCode() {
  const code = document.getElementById('code-input').value.trim();
  if (!code || code.length !== 6) {
    showMsg('email-msg', 'Please enter the 6-digit code.', 'error');
    return;
  }
  const btn = document.getElementById('verify-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Verifying\u2026';

  try {
    const res = await fetch('/conformity-assessment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: sessionEmail, code }),
    });
    const data = await res.json();
    if (!res.ok) {
      showMsg('email-msg', data.error || 'Invalid code.', 'error');
      btn.disabled = false;
      btn.textContent = 'Verify';
      return;
    }
    assessmentId = data.assessmentId;
    answers = data.answers || {};
    currentSection = data.currentSection || 0;
    if (currentSection >= SECTIONS.length) {
      currentSection = 0;
      answers = {};
    }
    startQuestionnaire();
  } catch (err) {
    showMsg('email-msg', 'Network error. Please try again.', 'error');
    btn.disabled = false;
    btn.textContent = 'Verify';
  }
}

function resetEmail() {
  document.getElementById('email-step').classList.remove('hidden');
  document.getElementById('code-step').classList.add('hidden');
  document.getElementById('code-input').value = '';
  showMsg('email-msg', '', '');
  document.getElementById('email-input').focus();
}

/* ── Questionnaire ── */

function startQuestionnaire() {
  document.getElementById('phase-email').classList.add('hidden');
  document.getElementById('phase-questionnaire').classList.remove('hidden');
  renderSection();
}

function renderSection() {
  const section = SECTIONS[currentSection];
  const sectionQs = QUESTIONS.filter(q => q.section === currentSection);

  let html = '<div class="section-header">';
  html += '<div class="section-num">Section ' + (currentSection + 1) + ' of ' + SECTIONS.length + '</div>';
  html += '<div class="section-title">' + section.title + '</div>';
  html += '<div class="section-desc">' + section.description + '</div>';
  html += '</div>';

  sectionQs.forEach((q, qi) => {
    html += '<div class="question-block">';
    html += '<div class="question-text">' + q.question + '</div>';

    const explainId = 'explain-' + q.id;
    html += '<span class="explain-toggle" onclick="toggleExplain(\\'' + explainId + '\\')">Why does this matter? \u25BC</span>';
    html += '<div id="' + explainId + '" class="hidden">';
    html += '<div class="question-explain">' + q.explanation + '</div>';
    html += '<span class="question-ref">' + q.cra_reference + '</span>';
    html += '</div>';

    q.options.forEach((opt, oi) => {
      const checked = answers[q.id] === oi ? 'checked' : '';
      const selected = answers[q.id] === oi ? 'selected' : '';
      html += '<div class="option ' + selected + '" onclick="selectOption(\\'' + q.id + '\\', ' + oi + ', this)">';
      html += '<input type="radio" name="q_' + q.id + '" value="' + oi + '" ' + checked + ' id="q_' + q.id + '_' + oi + '">';
      html += '<label for="q_' + q.id + '_' + oi + '">' + opt.label + '</label>';
      html += '</div>';
    });

    html += '</div>';
  });

  document.getElementById('question-card').innerHTML = html;

  // Update progress
  const pct = Math.round(((currentSection) / SECTIONS.length) * 100);
  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('progress-section').textContent = 'Section ' + (currentSection + 1) + ' of ' + SECTIONS.length;
  document.getElementById('progress-pct').textContent = pct + '%';

  // Navigation buttons
  document.getElementById('prev-btn').style.visibility = currentSection > 0 ? 'visible' : 'hidden';
  const nextBtn = document.getElementById('next-btn');
  if (currentSection === SECTIONS.length - 1) {
    nextBtn.textContent = 'Complete Assessment';
  } else {
    nextBtn.textContent = 'Continue';
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleExplain(id) {
  const el = document.getElementById(id);
  el.classList.toggle('hidden');
}

function selectOption(qId, optionIndex, el) {
  answers[qId] = optionIndex;
  // Update visual state
  const parent = el.parentElement;
  parent.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  el.querySelector('input').checked = true;
  // Auto-save
  saveProgress();
}

async function saveProgress() {
  if (!assessmentId) return;
  try {
    await fetch('/conformity-assessment/save-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentId, answers, currentSection }),
    });
  } catch (err) {
    console.error('Save failed:', err);
  }
}

function prevSection() {
  if (currentSection > 0) {
    currentSection--;
    saveProgress();
    renderSection();
  }
}

async function nextSection() {
  if (currentSection < SECTIONS.length - 1) {
    currentSection++;
    saveProgress();
    renderSection();
  } else {
    await completeAssessment();
  }
}

async function completeAssessment() {
  const btn = document.getElementById('next-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Calculating\u2026';

  try {
    const res = await fetch('/conformity-assessment/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentId, answers }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to complete assessment.');
      btn.disabled = false;
      btn.textContent = 'Complete Assessment';
      return;
    }
    showResults(data.scores, data.category);
  } catch (err) {
    alert('Network error. Please try again.');
    btn.disabled = false;
    btn.textContent = 'Complete Assessment';
  }
}

/* ── Results ── */

function showResults(scores, category) {
  document.getElementById('phase-questionnaire').classList.add('hidden');
  const resultsDiv = document.getElementById('phase-results');
  resultsDiv.classList.remove('hidden');

  const catLabel = CATEGORY_LABELS[category] || 'Default';
  const conformity = getConformityModule(category);
  const recommendations = getTopRecommendations(scores, answers);
  const overallColor = scores.overallPct >= 75 ? '#10b981' : scores.overallPct >= 50 ? '#f59e0b' : scores.overallPct >= 25 ? '#f97316' : '#ef4444';

  let html = '';

  // Overall score
  html += '<div class="card" style="text-align:center;">';
  html += '<div class="result-score"><div class="big-num" style="color:' + overallColor + ';">' + scores.overallPct + '%</div>';
  html += '<div class="big-label">Overall CRA Readiness</div></div>';
  html += '<div style="display:inline-block;background:#f3f4f6;border-radius:8px;padding:10px 20px;margin-bottom:12px;">';
  html += '<div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Product Category</div>';
  html += '<div style="font-size:16px;font-weight:700;">' + catLabel + '</div></div>';
  html += '</div>';

  // Conformity assessment
  const confClass = conformity.needsNB ? 'warning' : 'ok';
  html += '<div class="card">';
  html += '<h2 style="font-size:16px;margin-bottom:12px;">Your Conformity Assessment Path</h2>';
  html += '<div class="conformity-box ' + confClass + '">';
  html += '<div class="conformity-title">' + conformity.fullName + '</div>';
  html += '<div class="conformity-desc">' + conformity.description + '</div>';
  html += '<span class="conformity-tag ' + confClass + '">' + (conformity.needsNB ? 'Notified Body Required' : 'Self-Assessment Permitted') + '</span>';
  html += '</div></div>';

  // Maturity breakdown
  html += '<div class="card">';
  html += '<h2 style="font-size:16px;margin-bottom:16px;">Maturity Breakdown</h2>';
  SECTIONS.forEach(function(s) {
    var sc = scores.sections[s.id];
    var barColor = sc.pct >= 75 ? '#10b981' : sc.pct >= 50 ? '#f59e0b' : sc.pct >= 25 ? '#f97316' : '#ef4444';
    html += '<div class="maturity-row">';
    html += '<div class="maturity-label">' + s.title + '</div>';
    html += '<div class="maturity-bar-bg"><div class="maturity-bar" style="width:' + sc.pct + '%;background:' + barColor + ';"></div></div>';
    html += '<div class="maturity-pct">' + sc.pct + '%</div>';
    html += '<div class="maturity-level">' + sc.level + '</div>';
    html += '</div>';
  });
  html += '</div>';

  // Recommendations
  if (recommendations.length > 0) {
    html += '<div class="card">';
    html += '<h2 style="font-size:16px;margin-bottom:8px;">Priority Recommendations</h2>';
    html += '<p style="font-size:13px;color:#6b7280;margin-bottom:16px;">Focus on these areas for the biggest improvement in your CRA readiness:</p>';
    recommendations.forEach(function(r) {
      html += '<div class="rec-item">';
      html += '<div class="rec-priority ' + r.priority + '">' + r.priority.toUpperCase() + ' PRIORITY</div>';
      html += '<div class="rec-question">' + r.question + '</div>';
      html += '<div class="rec-next">Next step: ' + r.target + '</div>';
      html += '<div class="rec-ref">' + r.cra_reference + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  // Send report
  html += '<div class="card" style="text-align:center;">';
  html += '<h2 style="font-size:18px;margin-bottom:4px;">Get Your Full Report</h2>';
  html += '<p style="font-size:13px;color:#6b7280;margin-bottom:16px;">We\u2019ll email you a detailed report with your complete assessment, maturity scores, conformity assessment path, and prioritised recommendations. Share it with your team.</p>';
  html += '<div id="report-msg"></div>';
  html += '<div class="report-form" id="report-form">';
  html += '<input type="email" class="email-input" id="report-email" value="' + escapeHtmlJS(sessionEmail) + '" placeholder="you@company.com">';
  html += '<button class="btn btn-primary" id="send-report-btn" onclick="sendReport()">Send Report</button>';
  html += '</div>';
  html += '</div>';

  // Start over
  html += '<div style="text-align:center;margin-top:12px;">';
  html += '<button class="btn btn-secondary btn-sm" onclick="startOver()">Start a New Assessment</button>';
  html += '</div>';

  resultsDiv.innerHTML = html;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getConformityModule(category) {
  switch (category) {
    case 'critical':
      return { module: 'Module H', fullName: 'Module H \u2014 Full Quality Assurance', needsNB: true,
        description: 'Your product requires the most rigorous assessment procedure. A notified body must approve your quality assurance system covering design, production, and post-market surveillance, with periodic inspections.' };
    case 'important_ii':
      return { module: 'Module B+C or H', fullName: 'Module B+C (EU-Type Examination) or Module H (Full QA)', needsNB: true,
        description: 'Your product requires third-party assessment regardless of whether harmonised standards are applied. You may choose between EU-type examination (Module B+C) or full quality assurance (Module H).' };
    case 'important_i':
      return { module: 'Module A or B+C', fullName: 'Module A (Self-Assessment) or Module B+C', needsNB: false,
        description: 'If you have fully applied relevant harmonised standards (EN 18031), you can self-assess under Module A. Otherwise, you\\u2019ll need EU-type examination (Module B+C) from a notified body.' };
    default:
      return { module: 'Module A', fullName: 'Module A \u2014 Internal Control', needsNB: false,
        description: 'Your product qualifies for self-assessment. You perform the conformity assessment internally, prepare your technical documentation and EU Declaration of Conformity, and affix the CE marking yourself. No notified body involvement required.' };
  }
}

function getTopRecommendations(scores, answers) {
  var recs = [];
  SECTIONS.forEach(function(section, idx) {
    if (section.id === 'classification') return;
    var sc = scores.sections[section.id];
    if (sc.pct >= 75) return;
    var sectionQs = QUESTIONS.filter(function(q) { return q.section === idx; });
    var weak = sectionQs.filter(function(q) {
      var a = answers[q.id];
      return a === undefined || a === null || q.options[a].score < 2;
    }).slice(0, 2);
    weak.forEach(function(q) {
      var a = answers[q.id];
      var currentScore = (a !== undefined && a !== null) ? q.options[a].score : 0;
      var nextLevel = q.options[Math.min(currentScore + 1, 3)];
      recs.push({
        section: section.title,
        question: q.question,
        target: nextLevel.label,
        cra_reference: q.cra_reference,
        priority: currentScore === 0 ? 'high' : 'medium',
      });
    });
  });
  recs.sort(function(a, b) {
    if (a.priority === 'high' && b.priority !== 'high') return -1;
    if (a.priority !== 'high' && b.priority === 'high') return 1;
    return 0;
  });
  return recs.slice(0, 6);
}

async function sendReport() {
  var email = document.getElementById('report-email').value.trim();
  if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    showMsg('report-msg', 'Please enter a valid email address.', 'error');
    return;
  }
  var btn = document.getElementById('send-report-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Sending\u2026';
  showMsg('report-msg', '', '');

  try {
    var res = await fetch('/conformity-assessment/send-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentId: assessmentId, email: email }),
    });
    var data = await res.json();
    if (!res.ok) {
      showMsg('report-msg', data.error || 'Failed to send report.', 'error');
      btn.disabled = false;
      btn.textContent = 'Send Report';
      return;
    }
    showMsg('report-msg', 'Report sent! Check your inbox.', 'success');
    document.getElementById('report-form').classList.add('hidden');
  } catch (err) {
    showMsg('report-msg', 'Network error. Please try again.', 'error');
    btn.disabled = false;
    btn.textContent = 'Send Report';
  }
}

function startOver() {
  assessmentId = null;
  answers = {};
  currentSection = 0;
  document.getElementById('phase-results').classList.add('hidden');
  document.getElementById('phase-results').innerHTML = '';
  document.getElementById('phase-email').classList.remove('hidden');
  document.getElementById('email-step').classList.remove('hidden');
  document.getElementById('code-step').classList.add('hidden');
  document.getElementById('email-input').value = sessionEmail;
  document.getElementById('code-input').value = '';
  showMsg('email-msg', '', '');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Helpers ── */

function showMsg(containerId, text, type) {
  var el = document.getElementById(containerId);
  if (!text) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="msg msg-' + type + '">' + text + '</div>';
}

function escapeHtmlJS(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
</script>
</body>
</html>`;
}

/* ── Start ────────────────────────────────────────────────────────────── */

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log('CRANIS2 Welcome site running on port ' + PORT);
  });
}).catch(err => {
  console.error('Failed to initialise database:', err);
  // Start anyway without persistence
  app.listen(PORT, () => {
    console.log('CRANIS2 Welcome site running on port ' + PORT + ' (no database)');
  });
});

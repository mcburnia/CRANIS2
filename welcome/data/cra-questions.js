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
  // Section 0: Product Classification
  {
    id: 'dist_scope', section: 0,
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
    id: 'data_sensitivity', section: 0,
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
    id: 'network_connectivity', section: 0,
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
    id: 'user_criticality', section: 0,
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
  // Section 1: Vulnerability Management
  {
    id: 'cvd_policy', section: 1,
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
    id: 'vuln_monitoring', section: 1,
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
    id: 'incident_reporting', section: 1,
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
    id: 'security_updates', section: 1,
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
  // Section 2: SBOM
  {
    id: 'sbom_maintained', section: 2,
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
    id: 'transitive_deps', section: 2,
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
    id: 'dep_vuln_monitoring', section: 2,
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
  // Section 3: Security by Design
  {
    id: 'secure_defaults', section: 3,
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
    id: 'update_mechanism', section: 3,
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
    id: 'data_protection', section: 3,
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
    id: 'access_control', section: 3,
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
  // Section 4: Technical Documentation
  {
    id: 'risk_assessment', section: 4,
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
    id: 'technical_file', section: 4,
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
    id: 'eu_doc', section: 4,
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
    id: 'conformity_assessment', section: 4,
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
  // Section 5: Organisational Readiness
  {
    id: 'responsible_person', section: 5,
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
    id: 'support_period', section: 5,
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
    id: 'market_surveillance', section: 5,
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

const CATEGORY_LABELS = {
  default: 'Default',
  important_i: 'Important Class I',
  important_ii: 'Important Class II',
  critical: 'Critical',
};

module.exports = { SECTIONS, QUESTIONS, CATEGORY_LABELS };

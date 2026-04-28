# CRANIS2 – Executive Summary

## What Is CRANIS2?

CRANIS2 is a compliance platform that helps software companies meet the requirements of two major pieces of EU legislation: the **Cyber Resilience Act (CRA)** and the **NIS2 Directive**.

It connects to your existing source code repositories (GitHub, Codeberg, Gitea, Forgejo, GitLab, and Bitbucket Cloud) and automatically builds the compliance evidence that regulators expect to see. No spreadsheets, no consultants, no guesswork.

## What Does It Actually Do?

CRANIS2 takes the dependency and component information present in your repositories and turns it into a structured compliance programme:

- **Software Bill of Materials (SBOM).** Automatically captures and maintains an up-to-date inventory of every software component in your products, in the formats regulators expect (CycloneDX, SPDX). Uses a three-tier approach: repository API, lockfile parsing (28 formats), and source import scanning (26 languages).

- **Vulnerability Monitoring.** Continuously scans your dependency tree against a local database of 445,000+ known vulnerabilities (OSV, GitHub Advisory, NVD) which is updated daily. Alerts are targeted to the right stakeholders, not dumped into a generic inbox.

- **Licence Compliance.** Classifies every dependency by licence type, flags copyleft and unknown licences, and tracks waivers. Provides a clear picture of your open-source obligations.

- **Intellectual Property Proof.** Creates cryptographically timestamped snapshots of your codebase using RFC 3161, giving you independently verifiable proof of authorship and prior art.

- **CRA Technical File.** Structures the documentation required under CRA Annex VII across eight sections, with inline editing and version tracking. Auto-population suggests content for four key sections based on your platform data (product description, vulnerability handling, applicable standards, and test reports), eliminating 60–80% of the documentation effort.

- **EU Declaration of Conformity.** Generates a professionally formatted declaration under CRA Article 16, combining your product metadata, organisation details, and applicable standards into a legally compliant Markdown document ready for download.

- **ENISA Reporting.** Manages the mandatory incident and vulnerability reporting workflow under CRA Article 14, with deadline tracking (24-hour early warning, 72-hour notification, 14-day final report).

- **Obligations Tracking.** Maps 35 CRA obligations across three operator roles (19 manufacturer, 10 importer, 6 distributor) to your products, with auto-intelligence that derives obligation statuses from platform data (SBOMs, scans, technical file progress, field issues, crypto scans). You always see your true compliance standing without manual data entry, and manual overrides are preserved.

- **Compliance Checklist.** A 7-step getting-started guide for each product that breaks CRA conformity into concrete, actionable steps. Progress is tracked in real time so you always know what to do next and how far along you are.

- **AI Copilot (Pro Plan).** AI-powered compliance assistance across the platform. Contextual suggestions for technical file sections and obligation evidence notes, AI auto-triage of vulnerability findings with ecosystem-specific fix commands, risk assessment generation with Annex I mappings (exportable as Markdown), incident report drafting for ENISA Article 14 stages, and CRA category recommendation with deterministic scoring plus AI augmentation. Powered by Claude (Anthropic). Source code is never sent to the AI; only compliance metadata.

- **Supplier Due Diligence.** Template-based questionnaires for third-party dependency risk management, with automatic enrichment from npm, PyPI, and crates.io registries. Markdown and CSV export. Available on all plans (no AI).

- **Compliance Gap Narrator.** A deterministic "Next Steps" card on each product's overview showing prioritised compliance actions, derived from obligations, technical file progress, scan coverage, and SBOM freshness. Available on all plans (no AI).

- **Public API & Integrations (Pro Plan).** REST API with API key authentication for programmatic access. CI/CD compliance gate for blocking non-compliant deployments (GitHub Actions, GitLab CI, generic bash). Trello integration for automated card creation on compliance events. MCP server for IDE AI assistants (VS Code, Cursor, Claude Desktop, Claude Code) to query vulnerabilities, get fix commands, and verify fixes directly from the editor.

- **Source Code Escrow.** Protects your clients against business continuity risk. When setting up a product in CRANIS2, you can configure escrow coverage so that if your company ceases to operate, your clients are not left without the software they depend on. Source code is deposited to a self-hosted Forgejo instance within the CRANIS2 infrastructure, hosted in Switzerland (European data sovereignty). You choose the release model: either the source code is published as open source, or specific clients you designate receive private copies. Daily automated deposits ensure the escrow is always current.

- **Compliance Evidence Vault.** Generates cryptographically signed compliance snapshots that bundle the complete state of a product's compliance evidence (SBOM, vulnerability scan results, licence findings, technical file, obligations) into a tamper-evident archive. Each snapshot is RFC 3161 timestamped for legal admissibility and Ed25519 signed for integrity verification. Archives are uploaded to Scaleway Glacier cold storage for 10-year retention per CRA Art. 13(10). A retention reserve ledger tracks funding with quarterly Wise transfers, cost forecasting, legal holds, and bulk funding workflows. Snapshots can be generated manually, on release, or on an automated schedule (weekly/monthly/quarterly). Retention dates automatically extend when a product's support period is updated beyond the default 10-year window.

- **Document Templates.** A library of pre-built CRA compliance document templates that auto-populate with your product data. Templates cover security policies, vulnerability disclosure procedures, and incident response plans, reducing the documentation burden from days to minutes.

- **Post-Market Monitoring.** Tracks field-reported security issues through a full lifecycle (open → investigating → fix in progress → resolved → closed) with corrective action management (planned → in progress → completed → verified). Generates surveillance reports exportable as Markdown. Field issue data automatically feeds the obligation engine — Art. 13(6) vulnerability handling reflects open field issues, and Art. 13(9) security updates tracks corrective action completion.

- **Cryptographic Standards Inventory.** Scans your dependency tree for cryptographic algorithm usage and classifies 37 algorithms as quantum-safe, quantum-vulnerable, or broken. Provides a post-quantum cryptography (PQC) readiness assessment showing your migration path from vulnerable algorithms (RSA, ECDSA, classic Diffie-Hellman) to quantum-resistant alternatives (ML-KEM, ML-DSA, SLH-DSA). Results feed the obligation engine for Art. 13(2) cryptographic requirements and Annex I risk assessment.

- **Importer & Distributor Obligations.** Extends CRA compliance beyond manufacturers. Importers and distributors each have dedicated obligation sets (10 and 6 respectively) with role-specific derived statuses. A public importer obligations assessment (10 questions) helps supply chain partners evaluate their CRA readiness before engaging. Role-specific checklists provide actionable guidance tailored to each operator type.

- **GRC/Audit Tool Bridge.** Exports compliance data in OSCAL 1.1.2 format for integration with governance, risk, and compliance (GRC) platforms. Four document types are supported: catalog (obligation definitions), profile (applicable obligations), assessment-results (compliance status with findings), and component-definition (product metadata with properties). Available on Pro plan.

- **Conformity Assessments.** Self-assessment tools for CRA, NIS2, importer obligations, and post-quantum cryptography readiness. Four public assessments are available: CRA conformity (12 questions), NIS2 readiness (25 questions), importer obligations (10 questions), and PQC readiness (18 questions). Each walks through the regulatory requirements with guidance text, evidence linking, and progress tracking. A public assessment landing page allows prospective customers to understand your compliance posture before engaging.

- **Product Lifecycle Management.** Tracks products through their lifecycle stages: pre-production, on-market, and end-of-life. Market placement dates drive retention calculations and obligation timelines. End-of-support dates are linked to technical file sections with automatic retention extension when updated.

- **Software Evidence Engine (SEE) (Pro Plan).** Analyses connected repositories to extract structured engineering evidence for R&D tax credits, due diligence, and multi-regulation compliance. Opt-in per product (requires explicit source code consent). Repository access is strictly read-only — CRANIS2 never writes to your repository and never stores your source code. The analysis reads commit metadata, branch structures, and file classifications, then extracts structured metrics. The source content is processed transiently and discarded. What is retained: lines-of-code counts by language, effort and cost estimates (COCOMO II), commit metadata (author, date, message, classification), branch types, developer attribution percentages, experimentation indicators, and architecture evolution events. Eight analysis phases cover: LOC estimation and effort/cost calculation, commit history ingestion with developer attribution, branch analysis with deterministic commit classification (9 categories), experimentation detection for R&D evidence (refactoring waves, prototype branches, rapid iteration, algorithm replacement), architecture and test evolution tracking, an evidence graph linking development data to existing SBOM and vulnerability records, and multi-regulation report generation (R&D Tax, CRA, NIS2, AI Act, DORA, ISO 27001). Reports are deterministic, auditable, and exportable as Markdown.

- **Session Capture & Competence Profiling (Pro Plan).** Records development sessions (with explicit developer consent) to build evidence of engineering competence — a requirement for R&D tax credit claims in multiple jurisdictions. Session transcripts are stored in the platform's Forgejo instance (EU-sovereign, git-backed). A Competence Evidence Profile is generated from each session, assessing 10 domains including domain vocabulary, design reasoning, industry awareness, and decision quality. This addresses the "competent professional" requirement in R&D tax relief schemes without relying on formal qualifications. Session capture integrates with Claude Code via hooks configuration, and with other AI-assisted development tools via the MCP server.

## Why Now?

The Cyber Resilience Act entered into force in December 2024. Its requirements are phasing in on a strict timeline:

| Milestone | Date |
|---|---|
| Reporting obligations begin | **September 2026** |
| Full compliance required | **December 2027** |

The NIS2 Directive is already being transposed into national law across EU member states, with most countries requiring compliance from **October 2024** onwards.

These are not optional guidelines. The CRA carries penalties of up to **EUR 15 million or 2.5% of global turnover** for non-compliance. Products that do not meet the requirements cannot carry a CE mark and cannot legally be sold in the EU single market.

Companies that start now have time to build compliance into their workflow. Companies that wait will face a scramble and risk losing market access.

## Who Is It For?

CRANIS2 is built for **software product companies that sell into the EU market**. It serves two distinct audiences within each organisation:

### Organisation and Product Administrators

Compliance officers, product managers, and organisation administrators who need to manage regulatory obligations, maintain technical documentation, track vulnerabilities, and demonstrate conformity to market surveillance authorities.

- **SMEs and scale-ups** that lack dedicated regulatory teams but still need to demonstrate compliance
- **B2B software vendors** whose customers are beginning to ask for SBOMs and vulnerability disclosures as part of procurement
- **Any company with products containing software** that will be subject to CRA classification (the vast majority of digital products)

### Development and Testing Contributors

Software engineers, test engineers, and DevOps practitioners whose daily work generates the evidence that compliance depends on. CRANIS2 connects their development activity to the compliance programme without requiring them to change how they work.

- **Engineers whose commits are analysed** by the Software Evidence Engine for R&D tax credit evidence, effort estimation, and regulatory compliance reports
- **Developers using AI-assisted tools** (Claude Code, Cursor, VS Code) who can query compliance data directly from their IDE via the MCP server
- **CI/CD pipeline operators** who integrate compliance gates into their deployment workflows
- **Contributors whose competence is profiled** from development sessions to satisfy the "competent professional" requirement for R&D tax relief

If you build software and have customers in Europe, this applies to you.

## "But That Means You Have Access to Our Source Code!"

**CRANIS2 never stores your source code and never writes to your repository. All repository access is strictly read-only.**

This is the most common question we hear, and the answer is clear. Here is exactly what happens:

1. You connect your source code repository. For GitHub, Codeberg, and Bitbucket Cloud, this is via OAuth (the same mechanism used by CI/CD tools and developer platforms). For Gitea, Forgejo, and GitLab (including self-hosted instances), you provide a Personal Access Token (PAT) which is encrypted at rest using AES-256-GCM. **All connections use read-only scopes. CRANIS2 cannot push code, create branches, modify files, or change any repository settings.**

2. CRANIS2 identifies your dependencies using a three-tier approach:
   - **Tier 1 (API):** For GitHub, it calls the Dependency Graph API, returning package names and versions as structured metadata
   - **Tier 2 (Lockfiles):** It fetches lockfiles (e.g. `package-lock.json`, `yarn.lock`, `Cargo.lock`) and parses them to extract dependency information. 28 lockfile formats are supported.
   - **Tier 3 (Import Scanning):** It reads source files to detect import and require statements, identifying dependencies that may not appear in lockfiles. 26 language plugins are supported. **The source files are read, scanned for import statements, and immediately discarded. Nothing is stored.**

3. The dependency list is what we work with. We scan it against vulnerability databases, classify licences, and track changes over time.

4. **With the Software Evidence Engine (opt-in only),** CRANIS2 reads more deeply into your repository: commit history, branch structures, and file paths. This enables effort estimation, developer attribution, and R&D evidence extraction. The same two guarantees apply: **source code is never stored** (only extracted metadata such as LOC counts, commit classifications, and file type categories are retained), and **nothing is ever written back to your repository**.

**What we store:**
- Package names and versions (e.g. "express 4.18.2")
- Licence identifiers (e.g. "MIT", "Apache-2.0")
- Vulnerability findings linked to those packages
- Compliance documentation you create within the platform
- Encrypted access tokens for repository connections (AES-256-GCM)
- With SEE consent: commit metadata (author, date, message, classification), LOC counts by language, branch types, developer attribution percentages, and architecture evolution events

**What we never store:**
- Your source code, logic, algorithms, or business rules
- Your diffs or file contents
- Your intellectual property
- Your repository contents (all source file access is transient — read, extract metadata, discard)

**What we never do:**
- Write to your repository (no pushes, no branches, no file modifications, no settings changes)
- Share your data with other organisations (strict multi-tenant isolation)
- Send your source code to any third party, including AI providers

The architecture is analogous to a pharmacist reading the ingredients list on a medicine bottle and checking each one against a safety database. They can see what goes into it. They cannot see the manufacturing process, the proprietary formula, or the factory floor. The pharmacist never writes on the bottle.

Your code stays in your repository. We read metadata, and in some cases scan import lines or commit history, but your source code is never stored and your repository is never modified.

## How It Works Day-to-Day

Once connected, CRANIS2 runs largely on autopilot:

- **Daily at 1 AM:** Vulnerability database sync (OSV + NVD)
- **Daily at 2 AM:** SBOMs are automatically refreshed for any products with changes
- **Daily at 3 AM:** Vulnerability scans run against the updated dependency data
- **Daily at 4 AM:** Billing checks (trial expiry, payment grace)
- **Daily at 5 AM:** Escrow deposits are updated for all enabled products
- **Daily at 6 AM:** Webhook health checks ensure push event pipelines are working
- **Daily at 9 AM:** Scheduled compliance snapshots are generated (weekly/monthly/quarterly per product configuration)
- **Hourly:** CRA reporting deadlines are checked, with escalating alerts as they approach
- **On every sync:** Licence compliance is re-scanned and IP proof snapshots are created
- **On release:** Compliance snapshot automatically generated with full evidence bundle
- **On first product creation:** All stakeholder contact roles can be auto-populated with the creating user's details

Your team interacts with CRANIS2 when action is needed: reviewing a new vulnerability finding, updating a compliance obligation, or submitting an ENISA report. The rest happens in the background.

## Platform Security

CRANIS2 is a compliance platform — the security of the platform itself must be beyond reproach. We apply the same standards we help our customers achieve.

**Post-Quantum Cryptography (PQC)**
All compliance archives and certificates are signed with hybrid Ed25519 + ML-DSA-65 signatures (NIST FIPS 204). This means document integrity is provable even against future quantum computing threats. CRANIS2 runs on Node.js 24 with native PQC support — no third-party dependencies for cryptographic operations.

**Encryption and Key Management**
Repository access tokens are encrypted at rest using AES-256-GCM with HKDF-derived keys (RFC 5869). Each cryptographic purpose uses a domain-separated key, so even if one key were compromised, others remain secure. JWT session tokens are algorithm-pinned to HS256 to prevent algorithm confusion attacks. All encryption keys are rotated on a defined schedule — monthly for credentials, annually for encryption and signing keys — using an air-gapped rotation process.

**Infrastructure Hardening**
All database services are bound to localhost only — there is no external access to any database port. Authentication endpoints are rate-limited to prevent brute-force attacks. Cross-origin requests are restricted to the CRANIS2 domain. Security headers (HSTS, Content-Security-Policy, X-Frame-Options) are enforced on every response. Dependencies are continuously audited for vulnerabilities.

**Audit and Verification**
Over 2,166 automated tests verify the platform's security controls on every build. The security hardening programme is validated by dedicated test suites covering port binding, rate limiting, CORS policy, credential management, and cryptographic operations.

## Pricing

CRANIS2 offers two plans, both with a 90-day free trial and no payment details required upfront:

- **Standard (€6/contributor/month):** Core compliance — SBOM management, vulnerability monitoring, licence compliance, IP proof, technical file, EU Declaration of Conformity, ENISA reporting, obligations tracking, compliance checklist, post-market monitoring, cryptographic standards inventory, source code escrow, compliance evidence vault, document templates, conformity assessments, and supplier due diligence.
- **Pro (€9/product/month + €6/contributor/month):** Everything in Standard, plus AI Copilot, Public API, CI/CD compliance gate, Trust Centre listing, MCP server for IDE integration, GRC/OSCAL bridge, and Software Evidence Engine with R&D tax credit support.

Billing is managed through Stripe — CRANIS2 does not handle payment card data. No vendor lock-in: all compliance data is exportable in open formats (PDF, CycloneDX, SPDX, CSV, JSON) at any time.

An affiliate programme rewards partners for referring new customers, with self-service commission tracking and monthly statements.

## Summary

| | |
|---|---|
| **Problem** | EU legislation (CRA + NIS2) requires software companies to demonstrate cybersecurity compliance. Most have no tooling for this |
| **Solution** | CRANIS2 automates SBOM management, vulnerability monitoring, licence compliance, IP proof, technical documentation, regulatory reporting, post-market monitoring with field issue tracking, cryptographic standards inventory with PQC readiness, source code escrow, compliance evidence vault with 10-year retention, document templates, conformity assessments (CRA, NIS2, importer, PQC), AI-powered compliance intelligence, supplier due diligence, GRC/OSCAL bridge, software evidence engine with R&D tax credit support, session capture with competence profiling, and external integrations (API, CI/CD, Trello, IDE, MCP) |
| **Timing** | CRA reporting obligations begin Sept 2026; full compliance required Dec 2027 |
| **Audience** | Organisation administrators (compliance officers, product managers) and development contributors (engineers, testers, DevOps) at software product companies selling into the EU |
| **Source code** | Source code is never stored. Repositories are never written to. All access is strictly read-only. SEE analysis (opt-in) reads commit metadata and file classifications but retains only structured metrics |
| **Providers** | GitHub, Codeberg, Gitea, Forgejo, GitLab (including self-hosted instances), Bitbucket Cloud |
| **Deployment** | SaaS platform at cranis2.com, hosted in Switzerland (Infomaniak) |
| **Security** | Post-quantum hybrid signing (Ed25519 + ML-DSA-65), AES-256-GCM with HKDF, automated key rotation, auth rate limiting, localhost-only database access, 2,166 automated security tests |

---

*CRANIS2 – Cyber Resilience Act & NIS2 compliance, automated.*

# CRANIS2 – Capabilities, Benefits & Safeguards

*A comprehensive overview for due diligence and critical evaluation.*

---

## 1. What Problem Does CRANIS2 Solve?

Two major pieces of EU legislation are fundamentally changing the software industry:

**The Cyber Resilience Act (CRA).** Entered into force December 2024. Any product containing digital elements sold in the EU must meet cybersecurity requirements, carry a CE mark, and maintain ongoing compliance. This is not optional. Penalties reach EUR 15 million or 2.5% of global turnover.

**The NIS2 Directive.** Already being transposed into national law. Organisations operating critical infrastructure must demonstrate security baselines.

The compliance timeline is tight:

| Milestone | Date |
|---|---|
| CRA reporting obligations begin | September 2026 |
| Full CRA compliance required | December 2027 |

Most software companies, especially SMEs, have no tooling for this. They face a choice between expensive consultants, manual spreadsheets, or non-compliance. CRANIS2 is the tooling answer.

---

## 2. What CRANIS2 Actually Does

CRANIS2 connects to a company's source code repositories (GitHub, Codeberg, Gitea, Forgejo, and GitLab, including self-hosted instances) and automatically builds compliance evidence from dependency metadata. It reads import statements but never stores, analyses or modifies source code in any way. It automates core compliance functions across three capability tiers:

### 2.1 Software Bill of Materials (SBOM)

**What:** Automatically captures and maintains a complete inventory of every software component in a product, covering both direct dependencies and transitive dependencies (dependencies of dependencies).

**Why it matters:** The CRA explicitly requires manufacturers to provide SBOMs. Customers and regulators will expect them in standard formats. Creating and maintaining these manually is impractical for any non-trivial codebase.

**How it works:**
- Three-tier dependency detection with automatic fallback:
  - **Tier 1 (API):** Calls the repository provider's dependency graph API (GitHub only). Fastest path.
  - **Tier 2 (Lockfile Parsing):** Fetches and parses lockfiles from the repository. 28 lockfile formats supported (package-lock.json, yarn.lock, Cargo.lock, go.sum, Gemfile.lock, poetry.lock, and more).
  - **Tier 3 (Import Scanning):** Reads source files to detect import/require statements. 26 language plugins (Python, JavaScript/TypeScript, Go, Rust, C/C++, Ruby, Java, PHP, and more). Source files are read transiently and immediately discarded. Nothing is stored.
- Stores dependencies in a graph database (Neo4j) with relationship tracking
- Enriches each dependency with cryptographic hashes from package registries (npm, PyPI) for integrity verification
- Exports in both CycloneDX 1.6 and SPDX 2.3 formats (the two industry standards)
- Auto-syncs daily at 2 AM for any products with changes; webhooks from GitHub, Codeberg, and Forgejo flag stale SBOMs in real time
- Works with all five supported providers. Tiers 2 and 3 are provider-agnostic

### 2.2 Vulnerability Monitoring

**What:** Continuously scans every dependency against a local database of 445,000+ known vulnerabilities from three authoritative sources.

**Why it matters:** The CRA requires manufacturers to actively monitor for and address known vulnerabilities in their products. Doing this manually is impossible at scale. Relying on external API calls is slow and unreliable.

**How it works:**
- Maintains a local mirror of the OSV (Open Source Vulnerabilities), NVD (National Vulnerability Database), and GitHub Advisory databases
- Syncs new vulnerability data every night at 1 AM
- Runs platform-wide scans at 3 AM, deduplicating dependencies across all products for efficiency
- Per-product scans available on demand
- Scan time: ~0.25 seconds (down from ~6 minutes when using external APIs)
- Findings are classified by severity (critical/high/medium/low) with CVSS scores
- Each finding links to the specific dependency, its version, and the available fix version
- Findings can be triaged: open, mitigated, or closed with documented reasoning

### 2.3 License Compliance

**What:** Classifies every dependency by licence type, detects copyleft obligations, flags unknown licences, and assesses compatibility with the product's distribution model.

**Why it matters:** Using a GPL-licensed library in a proprietary product without compliance can create legal liability. Many companies have no visibility into the licences in their transitive dependency tree. The CRA requires this as part of the technical file.

**How it works:**
- Scans all dependencies against SPDX licence identifiers
- Classifies as permissive (MIT, Apache-2.0, BSD), weak copyleft (LGPL, MPL), strong copyleft (GPL), or unknown
- A rules engine with 14 known cross-licence incompatibilities (e.g., GPL-2.0 vs Apache-2.0) assesses compatibility based on the product's distribution model (proprietary binary, SaaS, source-available, library, internal-only)
- AGPL/SSPL network copyleft detection for SaaS products
- Waivers can be documented with reasons for audit trail
- Re-triggered automatically after every SBOM sync

### 2.4 Intellectual Property Proof

**What:** Creates cryptographically timestamped snapshots of the codebase composition using RFC 3161, providing independently verifiable proof of authorship and prior art.

**Why it matters:** In IP disputes, patent claims, or escrow release scenarios, you need provable evidence of what your software contained at a specific point in time. A regular backup is not legally sufficient; it can be backdated.

**How it works:**
- Generates a SHA-256 hash of the codebase composition (dependency graph, not source code)
- Submits the hash to an external Time Stamping Authority (FreeTSA.org) using the RFC 3161 protocol
- The TSA returns a signed timestamp token that cryptographically binds the hash to a specific moment in time
- This is recognised under the EU eIDAS Regulation (910/2014) as legally admissible evidence
- Automatically created after every SBOM sync. No manual action needed

### 2.5 CRA Technical File (Annex VII)

**What:** Structures the documentation required under CRA Annex VII across eight sections, with inline editing, version tracking, and intelligent auto-population that pre-fills content from platform data.

**Why it matters:** The CRA requires a technical file to be maintained for every product with digital elements. This file must be available for market surveillance authorities on request. It covers risk assessment, design documentation, testing evidence, and more. Writing this documentation from scratch is one of the most time-consuming parts of CRA compliance.

**How it works:**
- Eight structured sections corresponding to CRA Annex VII requirements
- Inline editors for each section with guidance text explaining what is needed
- **Auto-population** suggests content for four key sections based on platform data:
  - **Product Description:** pre-fills product name, CRA category, repository URL, and deployment guidance
  - **Vulnerability Handling:** summarises SBOM status (package count, staleness), scan history, and open findings
  - **Standards Applied:** suggests harmonised standards (EN 18031-1/2/3, ETSI EN 303 645, ISO/IEC 15408) based on CRA category classification
  - **Test Reports:** lists all completed vulnerability scans with dates, tools, and finding counts
- Per-product, versioned documentation with status tracking (not started / in progress / complete)
- Annex I Part I checklist with 13 essential requirements and evidence fields
- Cross-product overview dashboard showing completion status

### 2.6 EU Declaration of Conformity (CRA Article 16)

**What:** Generates a professionally formatted, legally compliant EU Declaration of Conformity as a downloadable Markdown document.

**Why it matters:** Every product with digital elements placed on the EU market must be accompanied by a Declaration of Conformity. This is the formal statement that the product meets CRA requirements and is eligible for the CE mark. Creating this document manually requires legal knowledge of the correct format and clauses.

**How it works:**
- Combines product metadata, organisation details, and technical file content into a structured Markdown document
- Eight numbered legal clauses covering: product identification, manufacturer, responsibility, object, legislative basis, harmonised standards, notified body (if applicable), and additional information
- Standards list is pulled automatically from the technical file
- Signature block with place and date of issue
- One-click download from the product detail page

### 2.7 ENISA Reporting (CRA Article 14)

**What:** Manages the mandatory vulnerability and incident reporting workflow to national CSIRTs (Computer Security Incident Response Teams) and ENISA.

**Why it matters:** From September 2026, manufacturers must report actively exploited vulnerabilities within 24 hours and severe incidents on a strict timeline. Missing these deadlines carries regulatory consequences.

**How it works:**
- Two report types: Actively Exploited Vulnerability and Severe Incident
- Three-stage timeline with automatic deadline calculation:
  - Early Warning: 24 hours from awareness
  - Notification: 72 hours from awareness
  - Final Report: 14 days (vulnerabilities) or 1 month (incidents)
- Intermediate reporting for progress updates
- EU27 CSIRT country selection for jurisdiction routing
- Traffic Light Protocol (TLP) classification for information sensitivity
- Hourly deadline monitoring with escalating alerts (12h, 4h, 1h before, then overdue)
- Can auto-populate from a vulnerability finding. One click to initiate a report
- Stages are submitted individually with audit trail (who submitted, when)
- Dashboard showing active reports, overdue count, next deadline

### 2.8 Source Code Escrow

**What:** Enables companies to configure escrow coverage so that if they cease to operate, their clients are not left without access to the software they depend on.

**Why it matters:** B2B software customers increasingly require business continuity assurances. Escrow is a tangible trust signal during sales conversations and procurement.

**How it works:**
- Opt-in, configured per product
- Source code is deposited to a self-hosted Forgejo instance within the CRANIS2 infrastructure
- Daily automated deposits at 5 AM UTC ensure the escrow is always current
- European data sovereignty, hosted in Switzerland (Infomaniak)
- Release model is defined by the manufacturer: open-source publication or private copies to designated recipients
- Escrow deposits are preserved even after product deletion (legal retention)
- Entirely under the manufacturer's control

### 2.9 AI Intelligence (Pro Plan)

CRANIS2 includes an AI intelligence layer powered by Claude (Anthropic), available on the Pro plan. The AI only receives compliance metadata; it never has access to source code.

| Capability | Purpose |
|---|---|
| **AI Copilot** | Contextual suggestions for technical file sections and obligation evidence notes. Analyses product data (dependencies, scans, CRA category) to generate draft content. Supports refinement and 24-hour response caching. |
| **AI Auto-Triage** | Analyses vulnerability findings and recommends dismiss/acknowledge/escalate with confidence scores. Generates ecosystem-specific CLI fix commands (npm, pip, cargo, go, maven, nuget, etc.). Auto-dismiss for high-confidence false positives. |
| **AI Risk Assessment** | Generates a four-part risk assessment: methodology, threat model, risk register, and 13 Annex I requirement mappings. Grounded in actual product data. Exportable as Markdown for inclusion in the CRA technical file. |
| **AI Incident Report Drafter** | Pre-populates ENISA Article 14 report stages (early warning, notification, final report) with contextually appropriate content. Non-destructive merge preserves existing text. Uses linked findings and prior stages for continuity. |
| **CRA Category Recommender** | Deterministic 4-attribute risk scoring (network, data sensitivity, privileges, safety) plus AI augmentation for a second opinion. Admin-configurable override rules with audit trail. |

**Cost protection:** Three-layer system. Per-organisation monthly token budget (default 500K, admin-configurable), per-endpoint rate limits, and 24-hour response caching. Usage is tracked on the Billing page.

### 2.10 Supplier Due Diligence (All Plans)

| Capability | Purpose |
|---|---|
| **Supplier Questionnaires** | Template-based questionnaires for dependency suppliers, derived from CRA requirements. Deterministic; no AI involved. |
| **Supplier Enrichment** | Automatic metadata enrichment from npm, PyPI, and crates.io registries (maintainer details, licence, download counts, last publish date). Shared 30-day Postgres cache. |
| **Compliance Gap Narrator** | "Next Steps" card on each product's Overview tab. Prioritised action list derived from obligations, technical file progress, scan coverage, SBOM freshness, and stakeholder completeness. Deterministic; no AI. |
| **Export** | Markdown and CSV export of supplier due diligence data for audit and procurement review. |

### 2.11 Public API & External Integrations (Pro Plan)

| Capability | Purpose |
|---|---|
| **Public API** | REST API at `/api/v1/` with API key authentication (SHA-256 hashed, `cranis2_` prefix). Four read-only scopes: `read:products`, `read:vulnerabilities`, `read:compliance`, `write:findings`. |
| **CI/CD Compliance Gate** | Pipeline step that queries the API and fails the build if open critical/high findings exist. Ready-made snippets for GitHub Actions, GitLab CI, and generic bash. |
| **Trello Integration** | Automatic card creation on mapped Trello boards for 4 event types (new findings, obligation changes, stale SBOMs, compliance gaps). Deduplication and resolution comments. |
| **MCP Server** | Model Context Protocol server for IDE AI assistants (VS Code, Cursor, Claude Desktop, Claude Code). 5 tools: list products, get vulnerabilities, get mitigation commands, verify fixes, check compliance status. |
| **IDE Compliance Assistant** | In-app setup wizard on the Integrations page with auto-generated JSON config snippets for each supported IDE. |
| **GRC/OSCAL Bridge** | NIST OSCAL 1.1.2 export (catalog, profile, assessment-results, component-definition) for integration with governance tools like Vanta, Drata, and OneTrust. |

### 2.13 Compliance Evidence Vault

**What:** Generates cryptographically signed, tamper-evident compliance snapshots that bundle the complete state of a product's compliance evidence into a single archive, stored in cold storage for CRA-mandated 10-year retention.

**Why it matters:** CRA Art. 13(10) requires technical documentation to be retained for at least 10 years after a product is placed on the market, or for the duration of the support period, whichever is longer. Simply keeping files on a server is not sufficient. Regulators expect evidence to be tamper-evident, timestamped, and independently verifiable. The compliance evidence vault provides this with full automation.

**How it works:**
- **Snapshot generation.** Bundles SBOM, vulnerability scan results, licence findings, technical file sections, obligations, and metadata into a single compliance archive.
- **RFC 3161 timestamping.** Each snapshot is submitted to an external Time Stamping Authority, providing legally admissible proof of when the evidence existed.
- **Ed25519 signing.** Each snapshot is digitally signed with a platform key, ensuring integrity verification without relying on a third party.
- **Scaleway Glacier cold storage.** Archives are uploaded to European cold storage (Scaleway, Paris region) for long-term preservation.
- **Retention reserve ledger.** Tracks the cost of storing each snapshot for its full retention period, with a 2x buffer on Scaleway Glacier rates. Entries move through three states: allocated (cost calculated), funded (Wise transfer recorded), released (retention period ended).
- **Bulk funding workflow.** A dedicated Funding Run tab allows the CFO to select all unfunded entries and record a single Wise transaction reference, marking them as funded in one operation.
- **Legal holds.** A snapshot under legal hold cannot be deleted regardless of retention status, supporting regulatory investigations and litigation preservation.
- **Cost forecast.** Projects quarterly cold storage costs for the next 8 quarters based on current archive sizes and retention periods.
- **Automated scheduling.** Snapshots can be generated on a weekly, monthly, or quarterly schedule per product, in addition to manual and release-triggered generation.
- **Retention extension.** When a product's support end date is updated to a date later than the current retention end, all existing snapshots for that product are automatically extended (retention can only be extended, never shortened).

**Trigger types:**
- Manual: user-initiated from the product's Compliance Vault tab
- Release: automatically generated when a product release is created
- Scheduled: weekly, monthly, or quarterly per product configuration (runs daily at 9 AM)

### 2.14 Document Templates

**What:** A library of pre-built CRA compliance document templates that auto-populate with product data from the platform.

**Why it matters:** Writing compliance documents from scratch is time-consuming and error-prone. Templates provide a starting point grounded in regulatory requirements, pre-filled with your actual product data.

**How it works:**
- Templates cover security policies, vulnerability disclosure procedures, incident response plans, end-of-support notices, and more
- Auto-population pulls product metadata, organisation details, scan results, and obligation statuses into template fields
- Documents can be customised after generation
- Available on all plans

### 2.15 Conformity Assessments

**What:** Self-assessment tools for CRA and NIS2 compliance, with a public-facing assessment landing page.

**Why it matters:** Before engaging with a new software vendor, procurement teams and regulators want to understand the vendor's compliance posture. Conformity assessments provide a structured way to demonstrate readiness.

**How it works:**
- Four public assessment tools on the welcome site, each free and requiring no registration:
  - **CRA Conformity Assessment** (12 questions): covers all major CRA requirements with per-section maturity scoring
  - **NIS2 Readiness Assessment** (25 questions): entity classification, supervision regime, penalty levels, per-section maturity
  - **Importer Obligations Assessment** (10 questions): Art. 18 requirements, readiness scoring for importers/distributors
  - **PQC Readiness Assessment** (18 questions): cryptographic agility, algorithm inventory, migration planning
- Email verification and progress saving for all assessments
- Emailed HTML reports with scores, gaps, and CRANIS2 call-to-action
- Assessment landing page at `/conformity-assessment` with cards for all tools
- Launch-readiness subscription for organisations preparing for CRA enforcement
- Admin analytics for assessment completions by type and week

### 2.16 Product Lifecycle Management

**What:** Tracks products through their lifecycle stages with dates that drive retention and obligation timelines.

**Why it matters:** CRA obligations and retention periods are tied to when a product is placed on the market and when support ends. Lifecycle management ensures these dates are captured and propagated correctly across the platform.

**How it works:**
- Three lifecycle stages: pre-production, on-market, end-of-life
- Market placement date drives the 10-year retention clock
- End-of-support date (from the technical file) extends retention if it falls beyond the 10-year window
- Lifecycle transitions are logged in the activity trail
- CRA Action Plan: a 7-step compliance checklist per product that breaks conformity into concrete, actionable steps with real-time progress tracking

### 2.17 Post-Market Monitoring & Field Issue Tracking

**What:** Tracks field issues (defects, vulnerabilities, customer reports) discovered after a product is placed on the market, with corrective action management and surveillance report generation.

**Why it matters:** CRA Art. 13(2) requires manufacturers to have procedures for keeping products in conformity throughout their support period. Art. 13(9) requires corrective action when a product is found to be non-conforming. Post-market surveillance is a regulatory obligation, not optional quality practice.

**How it works:**
- Full lifecycle tracking for field issues: open, investigating, fix in progress, resolved, closed
- Six source categories: customer report, internal testing, market surveillance, vulnerability scan, security researcher, other
- Severity classification (critical, high, medium, low) with filtering and search
- Corrective action management per issue: planned, in progress, completed, verified
- Automatic timestamps when issues are resolved and corrective actions completed
- Wired into the obligation engine: open field issues affect Art. 13(6) vulnerability handling status; corrective action coverage drives Art. 13(9) security updates status
- Post-market surveillance report export as Markdown, citing CRA Art. 13(2) and Art. 13(9)
- Per-product field issue counts on the dashboard; platform-wide field issue health metrics in admin analytics
- Cross-organisation isolation: field issues are scoped to the owning organisation

### 2.18 Cryptographic Standards & Quantum Readiness Inventory

**What:** Scans product dependencies for cryptographic algorithm usage, classifies each as broken, quantum-vulnerable, or quantum-safe, and provides a public PQC (Post-Quantum Cryptography) readiness assessment.

**Why it matters:** The CRA requires products to use state-of-the-art cryptography (Annex I, Part I). Algorithms like SHA-1, MD5, DES, and RSA-1024 are broken. RSA-2048, ECDSA, and classical Diffie-Hellman are quantum-vulnerable. Regulators and procurement teams increasingly ask: "Will your crypto survive a quantum computer?"

**How it works:**
- Registry of 37 cryptographic algorithms classified across three tiers: broken (must replace now), quantum-vulnerable (plan migration), quantum-safe (no action needed)
- On-demand scanning of product dependencies against the registry
- CryptoInventoryTab in the product detail page showing findings, posture summary, and scan trigger
- Public PQC Readiness Assessment at `/pqc-readiness-assessment` on the welcome site: 18 questions across 6 sections (asymmetric crypto, symmetric/hashing, key management, cryptographic agility, data sensitivity, migration planning), 4 readiness levels, email report with CRANIS2 CTA
- Wired into the obligation engine: crypto scan results inform Art. 13(3) component currency and Annex I Part I essential requirements
- Crypto health metrics in admin analytics; per-product crypto posture on the dashboard

### 2.19 Importer & Distributor Obligation Workflows

**What:** Extends the obligation engine beyond manufacturers to cover the distinct CRA obligations for importers (Art. 18) and distributors (Art. 19), with role-specific compliance checklists, technical file guidance, and a public importer assessment.

**Why it matters:** The CRA imposes different obligations on different supply chain roles. Importers must verify that manufacturers have performed conformity assessment, check CE marking, and maintain documentation. Distributors must verify that importers and manufacturers have fulfilled their obligations. Most compliance tools only address manufacturers.

**How it works:**
- 35 obligations total: 19 manufacturer (Art. 13, 14, 16, 20, 32, Annexes), 10 importer (Art. 18), 6 distributor (Art. 19)
- Organisation CRA role (manufacturer, importer, distributor, open-source steward) stored on the organisation record and used to filter applicable obligations
- Open-source stewards share manufacturer obligations per CRA Art. 25
- Role-specific compliance checklists with tailored steps and guidance
- Technical file guidance adapted for importers and distributors (different documentation requirements)
- Public Importer Obligations Assessment at `/importer-assessment` on the welcome site: interactive questionnaire covering Art. 18 requirements, readiness scoring, email report
- Admin analytics for assessment completions by role

### 2.20 GRC/Audit Tool Bridge (OSCAL Export)

**What:** Exports compliance data in NIST OSCAL 1.1.2 format for integration with governance, risk, and compliance (GRC) tools.

**Why it matters:** Enterprises using tools like Vanta, Drata, or OneTrust need compliance data in machine-readable formats that integrate with their existing governance workflows. OSCAL is the emerging standard for security assessment automation.

**How it works:**
- Four OSCAL document types: catalog (CRA requirements as controls), profile (selected controls per product), assessment-results (obligation statuses and evidence), component-definition (product metadata and dependencies)
- Single endpoint generates all four documents as a ZIP
- Data is derived from obligations, technical file sections, vulnerability findings, and product metadata
- Available on the Pro plan

### 2.22 Software Evidence Engine (SEE)

**What:** Analyses connected repositories to extract structured engineering evidence for R&D tax credits, due diligence, and multi-regulation compliance reporting. Opt-in per product, requiring explicit source code consent.

**Why it matters:** Software companies claiming R&D tax relief (HMRC, CIR, Forschungszulage, I+D+i) need defensible evidence of engineering effort, experimentation, and technical uncertainty. Due diligence exercises require effort estimation and architecture analysis. Multiple regulatory frameworks (CRA, NIS2, AI Act, DORA, ISO 27001) require evidence of secure development practices. CRANIS2 already connects to the repositories where this evidence exists. The data is there; it just needs structuring.

**Source code guarantee:** All repository access is strictly read-only. CRANIS2 never writes to your repository — no pushes, no branches, no file modifications, no settings changes. Source code is processed transiently: files are read, metadata is extracted, and the source content is immediately discarded. What is retained is structured metadata only: LOC counts, commit classifications, developer attribution percentages, branch types, and architecture evolution events. Your code, logic, algorithms, and business rules are never stored.

**How it works:**

The SEE operates in eight analysis phases, each building on the previous:

1. **Source code consent and estimation.** The product owner explicitly opts in to source code analysis. A file classification engine categorises repository files as production, test, configuration, generated, vendor, or documentation. LOC counting produces per-language totals with exclusions for generated and vendor code. A COCOMO II-style model produces effort and cost estimates (low, mid, high ranges). An executive report summarises the findings.

2. **Commit history and developer attribution.** Paginated, incremental commit ingestion via the repository provider API. Each commit is stored as metadata (SHA, author, date, message, additions, deletions). Developer attribution is calculated as contribution percentages. SEEDeveloper and SEECommit nodes are created in the evidence graph.

3. **Branch analysis and commit classification.** Branch metadata is ingested via the provider API. A deterministic classifier assigns each commit to one of nine categories (feature, fix, refactor, test, documentation, build, style, experiment, chore) based on message patterns. Branch types (feature, experimental, release, maintenance, abandoned) are inferred from naming conventions and activity. Rewrite ratio is calculated per module.

4. **Experimentation detection.** Five detection algorithms identify R&D activity: refactoring waves (clustered refactoring commits indicating systematic improvement), prototype branches (branches with high churn and short lifespan), rapid iteration cycles (repeated changes to the same files within short windows), high rewrite ratios (sustained rework indicating technical uncertainty), and fix-after-feature patterns (fixes closely following feature commits, suggesting experimentation). An R&D evidence report is generated with SHA-256 content hashing for tamper detection.

5. **Architecture and test evolution.** Detects architecture changes: module restructuring, migration events, API changes, and decomposition patterns. Tracks test evolution: test creation, modification, and failure-fix correlation over time. SEEModule nodes represent inferred module boundaries.

6. **Evidence graph integration.** Links SEE data to existing CRANIS2 records (SBOMs, vulnerability findings, dependency nodes). Five provenance query types answer questions such as "who introduced this dependency?" and "what experiments preceded this architecture change?". A graph summary provides a completeness assessment.

7. **Multi-regulation reports.** A report type registry generates evidence reports for six regulatory frameworks: R&D Tax (HMRC/CIR/Forschungszulage/I+D+i), CRA, NIS2, AI Act, DORA, and ISO 27001. Reports are deterministic, auditable, and stored immutably. All reports are exportable as Markdown.

8. **Session capture and competence profiling.** Development sessions are recorded (with explicit developer consent) via Claude Code hooks or MCP integration. Session transcripts are stored in the platform's Forgejo instance (EU-sovereign, git-backed). A Competence Evidence Profile is generated from each session, assessing 10 domains including domain vocabulary, design reasoning, industry reference detection, and decision quality. This addresses the "competent professional" requirement in R&D tax relief schemes without relying on formal qualifications.

### 2.23 Additional Capabilities

| Capability | Purpose |
|---|---|
| **Obligations Tracking** | Maps 35 CRA obligations to products with auto-intelligence across three operator roles (19 manufacturer, 10 importer, 6 distributor). Obligation statuses are derived from platform data (SBOMs, scans, technical file progress, field issues, crypto scans) so users see their true compliance standing without manual data entry. Manual overrides are always preserved. |
| **Compliance Checklist** | A 7-step getting-started guide per product that breaks CRA conformity into concrete, actionable steps with real-time progress tracking, completion percentage, and statutory deadlines |
| **Stakeholders Management** | Records CRA/NIS2 contacts at org and product level (responsible persons, security officers). Auto-assign option during product creation fills all 6 stakeholder roles with the creating user's details, ideal for solo developers and small teams |
| **Due Diligence Export** | Generates a complete compliance package as a ZIP: Markdown report, CycloneDX SBOM, licence findings CSV, vulnerability summary JSON, full licence texts |
| **Compliance Marketplace** | Companies can opt in to list themselves publicly with compliance badges derived from real platform data, not self-declared |
| **Notifications System** | Targeted alerts for vulnerability findings, deadline warnings, sync status, billing events |
| **Webhook Integration** | Push webhooks are automatically registered when repositories are connected (GitHub, Codeberg, Gitea, Forgejo). SBOMs are flagged as stale in real time when code is pushed, with admin health monitoring to detect broken pipelines |
| **Audit Logging** | Every significant action is recorded with user, timestamp, IP address, and metadata |
| **Platform Admin Dashboard** | Organisation management, user management, system health, vulnerability database status, webhook health monitoring, feedback handling |

---

## 3. What CRANIS2 Is Not

Being clear about scope prevents misunderstanding:

- **Not a code scanner.** CRANIS2 reads repository metadata to identify dependencies and (with SEE consent) to extract engineering metrics. It never stores your source code and never writes to your repository. It does not perform static analysis, code quality checks, or logic review.
- **Not a penetration testing tool.** It identifies known vulnerabilities in dependencies, not custom application vulnerabilities.
- **Not a repository modification tool.** All repository access is strictly read-only. CRANIS2 cannot push code, create branches, modify files, or change any repository settings.
- **Not a consultancy replacement for novel legal questions.** It automates the mechanical compliance work. Complex legal interpretations still need human expertise.

---

## 4. How We Protect Against Abuse and Account Mimicry

This is the section that addresses the hard questions about trust, abuse, and fraud prevention.

### 4.1 Source Code Handling

Two architectural guarantees apply to every interaction with your repository:

1. **CRANIS2 never stores your source code.** All source file access is transient: files are read, metadata is extracted, and the source content is immediately discarded. No source code is stored in any database, file system, or cache.

2. **CRANIS2 never writes to your repository.** All repository access is strictly read-only. No pushes, no branches, no file modifications, no settings changes. Repository connections use read-only scopes.

**Dependency discovery (all products):**

- **Tier 1 (API SBOM):** The provider's dependency graph API returns package names and versions as structured metadata. No source code is involved.
- **Tier 2 (Lockfile Parsing):** Lockfiles (e.g. `package-lock.json`, `Cargo.lock`) are fetched and parsed for dependency information. These are metadata files, not source code.
- **Tier 3 (Import Scanning):** Source files are read to detect import and require statements. The files are processed transiently in memory. **Import lines are extracted and the source content is immediately discarded.** No source code is stored in any database, file system, or cache.

What we receive from Tier 3: `import express from 'express'` → we record "express" as a dependency. The surrounding code, logic, and algorithms are never examined or retained.

**Software Evidence Engine (opt-in products only):**

When a product owner explicitly consents to source code analysis, the SEE reads more deeply: commit history, branch structures, and file paths. The same two guarantees apply. Source files are read transiently to classify file types and count lines of code; the content is discarded immediately. What is retained is structured metadata: LOC counts by language, commit classifications, developer attribution percentages, branch types, experimentation indicators, and architecture evolution events. Your code, logic, algorithms, and business rules are never stored.

### 4.2 Authentication and Access Control

| Layer | Mechanism |
|---|---|
| **User authentication** | JWT session tokens, bcrypt password hashing, email verification required |
| **Repository authentication** | OAuth (GitHub, Codeberg) or encrypted PAT tokens (Gitea, Forgejo, GitLab). PATs encrypted at rest using AES-256-GCM |
| **Organisation isolation** | Every database query is scoped to the user's `org_id`. There is no query path that returns another organisation's data |
| **Product ownership** | Neo4j graph relationship verification: a product must have a `BELONGS_TO` relationship to the user's organisation before any operation is permitted |
| **Role-based access** | Organisation admins vs members; platform admin middleware for system operations |
| **API route protection** | Every route implements `requireAuth` middleware. No anonymous API access to protected resources |

### 4.3 Organisation Isolation (Multi-Tenancy)

This is the primary defence against account mimicry and cross-tenant data leakage:

- **Every Postgres query** includes a `WHERE org_id = $1` clause. There is no "get all" endpoint that spans organisations.
- **Every Neo4j query** traverses from the organisation node. You cannot query a product without proving ownership through the graph relationship.
- **Product operations** require `verifyProductOwnership(orgId, productId)`, a Neo4j query that checks the `BELONGS_TO` relationship exists.
- **If a resource is not found within your organisation, you get a 404**, not a 403. This prevents attackers from distinguishing "exists but you can't access it" from "doesn't exist," eliminating enumeration attacks.

### 4.4 Anti-Abuse Mechanisms

**Marketplace Contact Rate Limiting:**
- 3 contact requests per day per user
- 1 contact request per organisation per 7-day period to any given target organisation
- Cannot contact your own organisation
- Prevents spam and harassment through the compliance marketplace

**Billing Gate (Global Middleware):**
- A JWT-peeking middleware runs before route-level auth on every request
- Blocks all write operations (POST, PUT, DELETE) when an organisation's billing status is `read_only`, `suspended`, or `cancelled`
- Exempt paths: authentication, billing management, admin, health checks, webhooks
- This prevents suspended or non-paying accounts from creating data or taking actions while still allowing them to read/export their existing data

**Trial and Payment Lifecycle:**
- Trial: 90-day free trial → 7-day grace period → read-only → suspended after 60 days
- Payment: active → 7-day grace on failed payment → read-only → suspended after 30 days
- Nine automated email templates for lifecycle communications
- Admin controls: extend trial, toggle billing exemption, payment pause

**Webhook Security:**
- GitHub and Codeberg webhooks are HMAC-SHA256 verified. The raw body is validated against a shared secret before any processing occurs
- Stripe webhooks use Stripe's signature verification
- Malformed or unsigned webhooks are rejected

**Input Validation:**
- All database queries use parameterised statements (prevents SQL injection)
- Neo4j queries use parameter binding (prevents Cypher injection)
- Schema validation on API inputs (email format, minimum lengths, enum constraints)
- Filenames are sanitised to prevent path traversal
- State machine validation on CRA report stages (prevents invalid transitions)

**Audit Trail:**
- Every significant action records: user ID, email, event type, IP address, user agent, metadata, timestamp
- System events (scheduled tasks) are logged with NULL user_id via LEFT JOIN, distinguishable from human actions
- This creates a forensic trail for investigating suspicious activity

### 4.5 What About Someone Impersonating a Company?

This is a legitimate concern. Here is how CRANIS2 addresses it:

1. **Repository authentication is the identity anchor.** You must authenticate with a real account (via OAuth or PAT) that has access to the repositories you claim. You cannot fabricate dependency data; it comes directly from the provider's API for repositories you control.

2. **Marketplace listings require admin approval.** A company cannot appear in the public marketplace without platform admin review and explicit approval. Compliance badges are computed from real platform data (vulnerability scan results, obligation completion, licence scan coverage). They cannot be self-declared.

3. **Organisation data is self-contained.** Even if someone creates an account with a similar company name, they cannot access another organisation's products, findings, or compliance data. The multi-tenancy isolation is absolute.

4. **Contributor-based billing creates accountability.** Pricing is based on active contributors to connected repositories. This ties the account to real development activity, making it impractical to create fake accounts for mimicry.

5. **Audit logging enables investigation.** If a mimicry attempt is reported, the full history of account creation, actions taken, and data accessed is available.

### 4.6 Data We Store, Data We Don't Store, and Actions We Never Take

**What we store (all products):**

| Data | Purpose |
|---|---|
| Package names and versions | Dependency tracking, vulnerability matching |
| Licence identifiers (SPDX) | Licence compliance analysis |
| Vulnerability findings for those packages | Security monitoring |
| Compliance documentation created in-platform | Technical file, obligations, reports |
| SBOM snapshots (dependency tree structure) | Supply chain visibility |
| Cryptographic hashes from public registries | Integrity verification |
| Encrypted repository access tokens (AES-256-GCM) | Repository connection |
| Organisation and user account data | Platform operation |

**What we store additionally with SEE consent (opt-in products only):**

| Data | Purpose |
|---|---|
| Commit metadata (author, date, message, SHA, additions/deletions) | Developer attribution, effort estimation, R&D evidence |
| LOC counts by language and file category | Effort and cost estimation |
| Branch metadata (name, type, activity dates) | Branch analysis, experimentation detection |
| Commit classifications (feature, fix, refactor, test, etc.) | R&D evidence, architecture evolution |
| Developer attribution percentages | Contribution analysis |
| Experimentation indicators and architecture events | R&D tax credit evidence |
| Session transcripts (with explicit developer consent) | Competence profiling, R&D evidence |

**What we never store:**

| Data | Guarantee |
|---|---|
| Source code, logic, algorithms, or business rules | All source file access is transient — read, extract metadata, discard |
| File contents or diffs | Only metadata (file paths, LOC counts, classifications) is retained |
| Private keys or secrets | Never accessed or requested |
| Data from non-connected repositories | No access beyond authorised connections |
| Personal data beyond name, email, and role | Minimal data collection |
| Unencrypted credentials | All tokens encrypted at rest (AES-256-GCM) |

**What we never do:**

| Action | Guarantee |
|---|---|
| Write to your repository | No pushes, branches, file modifications, or settings changes |
| Share your data with other organisations | Strict multi-tenant isolation |
| Send source code to AI providers | Only compliance metadata is sent to AI; never source code |
| Access repositories without authorisation | Read-only scopes, explicit consent for SEE |

---

## 5. The Business Model

Transparency on commercial incentives:

- **Two paid tiers:**
  - **Standard:** EUR 6/month per active contributor. All core compliance features.
  - **Pro:** EUR 9/month per product + EUR 6/month per contributor. Adds AI intelligence (Copilot, auto-triage, risk assessment, incident drafter, category recommender), public API, CI/CD gate, Trello integration, and IDE assistant.
- **90-day free trial** with no payment details required upfront (includes all features)
- **No vendor lock-in on data:** Due diligence export provides all your compliance data in open formats (Markdown, CycloneDX, SPDX, CSV, JSON) at any time
- **Billing is managed through Stripe.** CRANIS2 does not handle payment card data
- **AI cost protection:** Per-organisation token budgets, per-endpoint rate limits, and response caching prevent runaway costs

The pricing model aligns incentives: we succeed when you use the platform actively, not when we lock you into contracts or upsell unnecessary features.

---

## 6. Day-to-Day Operations

Once set up, CRANIS2 runs largely on autopilot:

| Time | Automated Task |
|---|---|
| 1 AM | Vulnerability database sync (OSV + NVD) |
| 2 AM | SBOM auto-sync for products with changes → triggers licence scan + IP proof |
| 3 AM | Platform-wide vulnerability scan |
| 4 AM | Billing checks (trial expiry, payment grace) |
| 5 AM | Escrow deposits for all enabled products |
| 6 AM | Webhook health checks. Detects products with missing or silent webhooks |
| 9 AM | Scheduled compliance snapshots. Generates snapshots for products with weekly/monthly/quarterly schedules |
| Hourly | CRA deadline monitoring with escalating alerts |
| On push | Push webhooks flag SBOMs as stale in real time |
| On release | Compliance snapshot automatically generated with full evidence bundle |

Human interaction is needed when:
- A new vulnerability finding requires triage
- A compliance obligation needs updating
- An ENISA report needs to be initiated or a stage submitted
- A new product or repository is connected

---

## 7. Technology Stack

For technical due diligence:

| Component | Technology | Purpose |
|---|---|---|
| Frontend | React + Vite + TypeScript | User interface |
| Backend | Express + TypeScript (ESM) | API server |
| Graph Database | Neo4j | Products, organisations, dependencies, relationships |
| Relational Database | PostgreSQL | Compliance data, scans, findings, billing, audit logs |
| Escrow | Forgejo (self-hosted) | Source code escrow, hosted in Switzerland |
| Email | Resend | Transactional emails (billing, notifications, marketplace contact) |
| Payments | Stripe | Subscription billing, checkout, customer portal |
| Hosting | Docker Compose (NGINX + Backend + Postgres + Neo4j + Forgejo) | Self-contained deployment |
| Tunnel | Cloudflare Tunnel | Secure public access without exposed ports |
| Source Providers | GitHub, Codeberg, Gitea, Forgejo, GitLab | Repository connection via OAuth or PAT |

---

## 8. Regulatory Timeline and Market Context

The window for preparation is narrowing:

```
Dec 2024 ──── CRA enters into force
                │
Oct 2024 ──── NIS2 national transposition deadlines begin
                │
Sep 2026 ──── CRA: Reporting obligations begin
                │  (companies must report actively exploited vulnerabilities
                │   within 24 hours to ENISA)
                │
Dec 2027 ──── CRA: Full compliance required
                   (products without CE mark cannot be sold in EU)
```

**Penalties for non-compliance:**
- CRA: Up to EUR 15 million or 2.5% of global annual turnover
- NIS2: Up to EUR 10 million or 2% of global annual turnover

**Who is affected:**
- Any company that places products with digital elements on the EU market
- This includes software products, IoT devices, and hardware with embedded software
- Both EU-based companies and non-EU companies selling into the EU

---

## 9. Summary

CRANIS2 automates the mechanical burden of EU cybersecurity compliance so that software companies can meet CRA and NIS2 requirements without building a dedicated compliance department. It serves two audiences: organisation administrators who manage compliance obligations, and development contributors whose engineering activity generates compliance evidence.

It covers SBOM management, vulnerability monitoring, licence compliance, IP proof, technical documentation, EU Declaration of Conformity, regulatory reporting, source code escrow, compliance evidence vault with 10-year retention, document templates, conformity assessments, product lifecycle management, post-market monitoring with field issue tracking, cryptographic standards inventory with quantum readiness assessment, role-aware obligations for manufacturers/importers/distributors, GRC/OSCAL integration, AI-powered compliance intelligence, supplier due diligence, software evidence engine with R&D tax credit support, session capture with competence profiling, and external integrations (API, CI/CD, Trello, IDE, MCP).

It does this while never storing source code and never writing to your repositories. All repository access is strictly read-only. Multi-tenant isolation is absolute. Billing accountability is tied to real development activity. All compliance data is exportable in open formats at any time.

The regulations are real, the deadlines are fixed, and the penalties are significant. The question is not whether to comply, but how efficiently.

---

*CRANIS2 – Cyber Resilience Act & NIS2 compliance, automated.*

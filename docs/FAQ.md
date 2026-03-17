# CRANIS2 Frequently Asked Questions

**Document Version:** 4.0
**Last Updated:** 2026-03-17

---

## Table of Contents

1. [General](#general)
2. [Regulatory and Compliance](#regulatory-and-compliance)
3. [Account and Setup](#account-and-setup)
4. [Products](#products)
5. [Source Code and Privacy](#source-code-and-privacy)
6. [Repository Connections](#repository-connections)
7. [SBOM and Dependencies](#sbom-and-dependencies)
8. [Vulnerabilities and Risk Findings](#vulnerabilities-and-risk-findings)
9. [ENISA Reporting](#enisa-reporting)
10. [Licence Compliance](#licence-compliance)
11. [IP Proof](#ip-proof)
12. [Due Diligence Export](#due-diligence-export)
13. [Escrow](#escrow)
14. [Technical Files and Obligations](#technical-files-and-obligations)
15. [Billing and Subscription](#billing-and-subscription)
16. [Marketplace](#marketplace)
17. [Notifications and Audit](#notifications-and-audit)
18. [Troubleshooting](#troubleshooting)
19. [AI Intelligence (Pro Plan)](#ai-intelligence-pro-plan)
20. [Public API and Integrations](#public-api-and-integrations)
21. [Plans and Pricing](#plans-and-pricing)
22. [Post-Market Monitoring & Field Issues](#post-market-monitoring--field-issues)
23. [Cryptographic Standards & Quantum Readiness](#cryptographic-standards--quantum-readiness)
24. [Conformity Assessments](#conformity-assessments)
25. [GRC/OSCAL Bridge](#grcooscal-bridge)
26. [Software Evidence Engine](#software-evidence-engine)
27. [Session Capture & Competence Profiling](#session-capture--competence-profiling)
28. [For Development Contributors](#for-development-contributors)

---

## General

### Q: What is CRANIS2?

CRANIS2 is a compliance platform that helps software companies meet the requirements of the EU Cyber Resilience Act (CRA) and the NIS2 Directive. It connects to your existing source code repositories and automatically builds the compliance evidence that regulators expect to see. The platform automates seven compliance functions: SBOM management, vulnerability monitoring, licence compliance, intellectual property proof, CRA technical documentation, ENISA reporting, and source code escrow. CRANIS2 reads dependency metadata from your repositories but never stores, analyses, or modifies your source code.

See the User Guide, Section 1: Introduction for a full overview.

### Q: What does CRANIS2 stand for?

CRANIS2 stands for **C**yber **R**esilience **A**ct and **NIS2**. The name reflects the two major pieces of EU legislation that the platform addresses: the Cyber Resilience Act (CRA) and the Network and Information Security Directive (NIS2). Together, these regulations form the backbone of the EU's approach to cybersecurity for software products and critical infrastructure.

### Q: Who is CRANIS2 designed for?

CRANIS2 is designed for four audiences:

- **Organisation Admins**: users who set up and manage their company's CRANIS2 account, configure products, and oversee compliance activities.
- **Organisation Members**: team members who work within the platform day-to-day, reviewing findings, updating technical files, and filing reports.
- **Platform Admins**: users with platform-level access who manage organisations, monitor system health, and administer the vulnerability database.
- **Evaluators and Auditors**: individuals assessing whether CRANIS2 meets their organisation's compliance needs, or reviewing the compliance evidence it produces.

In practice, any company that manufactures, imports, or distributes software products with digital elements in the EU market will benefit from the platform. See the User Guide, Section 1: Introduction.

### Q: Is CRANIS2 only for EU-based companies?

No. The CRA applies to any product with digital elements placed on the EU single market, regardless of where the manufacturer is based. If your company sells software to customers in the EU, even if your headquarters are in the United States, United Kingdom, or elsewhere, you are subject to CRA requirements and CRANIS2 can help you meet them. Companies based outside the EU may also need to designate an authorised representative within the EU.

See the User Guide, Section 2: Regulatory Context.

### Q: How much does CRANIS2 cost?

CRANIS2 uses a simple, contributor-based pricing model at EUR 6 per month per active contributor across your organisation. An active contributor is anyone who has made at least one contribution to a connected repository. Bot accounts are automatically identified and excluded from billing. There are no per-product fees, no feature tiers, and no hidden charges.

See the User Guide, Section 18: Billing.

### Q: Is there a free trial?

Yes. Every new organisation receives a 90-day free trial with full access to all platform features. No credit card is required to start the trial. You can register products, connect repositories, generate SBOMs, run vulnerability scans, and use every feature during the trial period without restriction.

See the User Guide, Section 18: Billing.

### Q: How long is the free trial?

The free trial lasts 90 days from the date your organisation is created. After the trial expires, there is an additional 7-day grace period during which you retain full access but see a warning banner prompting you to subscribe. After the grace period, the account enters read-only mode. You can subscribe at any point during the trial or grace period to continue with uninterrupted access.

See the User Guide, Section 18: Billing.

---

## Regulatory and Compliance

### Q: What is the Cyber Resilience Act (CRA)?

The CRA is an EU regulation that entered into force in December 2024. It applies to any product with digital elements placed on the EU single market and imposes cybersecurity requirements across the entire product lifecycle, from design through end-of-support. The regulation affects manufacturers, importers, distributors, and open source stewards. Penalties for non-compliance can reach up to EUR 15 million or 2.5% of worldwide annual turnover, whichever is higher.

See the User Guide, Section 2: Regulatory Context.

### Q: When does the CRA become mandatory?

The CRA follows a phased timeline:

- **December 2024**: the CRA entered into force.
- **September 2026**: reporting obligations begin (Article 14). Manufacturers must report actively exploited vulnerabilities and severe incidents to ENISA.
- **December 2027**: full compliance required. All products must meet the complete set of CRA requirements.

Organisations should begin preparing now, particularly for the September 2026 reporting deadline. See the User Guide, Section 2: Regulatory Context.

### Q: What are the penalties for CRA non-compliance?

The penalties are significant:

- Up to **EUR 15 million or 2.5% of worldwide annual turnover** (whichever is higher) for core requirement violations.
- Up to **EUR 10 million or 2% of turnover** for other obligations.
- Products that do not comply **cannot carry a CE mark** and cannot legally be sold in the EU single market.

See the User Guide, Section 2: Regulatory Context.

### Q: What is a Technical File under the CRA?

A Technical File is the documentation package that CRA Annex VII requires manufacturers to maintain for every product with digital elements. It must be available on request to market surveillance authorities and serves as the primary evidence of your compliance. The file covers eight sections that document everything from product design to conformity declarations. CRANIS2 provides structured editors for all eight sections.

See the User Guide, Section 9: Technical Files.

### Q: What are the eight sections of the Technical File?

The eight Annex VII sections are:

1. **Product Description** (Annex VII S1): general description, purpose, hardware/software versions
2. **Design and Development** (Annex VII S2a): security-by-design practices, development tools, testing
3. **Vulnerability Handling** (Annex VII S2b): processes for identifying and addressing vulnerabilities
4. **Risk Assessment** (Annex VII S2c): threats, attack surfaces, and mitigations
5. **Support Period** (Annex VII S3): product lifetime and security update commitment
6. **Standards Applied** (Annex VII S4): harmonised standards and certification schemes
7. **Test Reports** (Annex VII S5): testing evidence and methodology
8. **Declaration of Conformity** (Annex VII S6): formal EU Declaration of Conformity

Each section has a content editor, internal notes field, and status indicator. See the User Guide, Section 9: Technical Files.

### Q: What is the difference between Default, Class I, and Class II products?

The CRA classifies products into three categories based on cybersecurity risk:

- **Default**: self-assessment by the manufacturer. This applies to the vast majority of software products (most SaaS, internal tools, business applications).
- **Class I (Important)**: requires application of a harmonised standard or third-party assessment. Applies to products with higher cybersecurity significance (identity management, VPNs, firewalls, intrusion detection).
- **Class II (Critical)**: mandatory EU-level certification by a notified body. Applies to products critical to EU cybersecurity (operating systems, hypervisors, hardware security modules).

See the User Guide, Section 2: Regulatory Context.

### Q: How does NIS2 relate to the CRA?

The CRA and NIS2 are complementary. The CRA focuses on **product security**, requiring that software products meet cybersecurity standards. NIS2 focuses on **organisational security**, imposing obligations on entities operating critical infrastructure (energy, transport, banking, health, digital infrastructure, and more). If your organisation falls under NIS2 and you also manufacture software products, both sets of obligations apply. CRANIS2 tracks obligations from both frameworks in a unified view.

See the User Guide, Section 2: Regulatory Context.

### Q: What is ENISA?

ENISA is the European Union Agency for Cybersecurity. Under CRA Article 14, manufacturers must report actively exploited vulnerabilities and severe security incidents to both ENISA and their national CSIRT on a strict timeline. ENISA coordinates the EU-wide response to cybersecurity threats. CRANIS2 automates deadline tracking, provides structured reporting forms, and monitors deadlines hourly to ensure you never miss a filing window.

See the User Guide, Section 10: ENISA Reporting.

### Q: What is a CSIRT?

A CSIRT (Computer Security Incident Response Team) is the national cybersecurity body in each EU member state. Every EU country has a designated CSIRT responsible for coordinating responses to cybersecurity incidents. When filing an ENISA report, you must identify the CSIRT of the member state where the impact is felt. CRANIS2 includes an EU27 country selector for this purpose.

See the User Guide, Section 10: ENISA Reporting.

### Q: Does CRANIS2 help with CE marking?

CRANIS2 helps you prepare the documentation and evidence required for CE marking. This includes the complete Technical File (all eight Annex VII sections), the Annex I Part I checklist (13 essential cybersecurity requirements), conformity assessment documentation, and the Declaration of Conformity. The platform tracks completion of each section and highlights where gaps remain. The actual CE mark application and affixing is a separate regulatory process that you complete with the relevant authorities.

See the User Guide, Section 9: Technical Files.

### Q: What are the CRA reporting deadlines?

There are three mandatory reporting stages with strict deadlines:

| Stage | Deadline | Content |
|-------|----------|---------|
| **Early Warning** | 24 hours after awareness | Summary, initial assessment, malicious action suspected? |
| **Notification** | 72 hours after awareness | Detailed description, corrective measures, patch status |
| **Final Report** | 14 days (vulnerability) or 1 month (incident) | Root cause, severity, preventive measures |

These deadlines are legally binding from September 2026. CRANIS2 calculates all three deadlines automatically from the awareness date you provide. See the User Guide, Section 10: ENISA Reporting.

### Q: What is an SBOM and why does the CRA require it?

An SBOM (Software Bill of Materials) is a machine-readable inventory of all software components in a product, including direct dependencies, transitive dependencies, their versions, ecosystems, and licences. CRA Article 13 requires manufacturers to maintain an SBOM for every product with digital elements. The SBOM enables vulnerability tracking (which components are affected by known CVEs), licence compliance verification (are all licences compatible with your distribution model), and supply chain transparency (what exactly is in your product). CRANIS2 generates and maintains SBOMs automatically from your connected repositories.

See the User Guide, Section 14: Repository Management and Section 16: Dependencies.

---

## Account and Setup

### Q: How do I create an account?

Navigate to the signup page and provide a valid email address and a password that meets all five strength criteria: at least 8 characters, at least one uppercase letter, at least one lowercase letter, at least one number, and at least one special character. A strength meter on the signup form shows your progress in real time. After signing up, you will receive a verification email from `info@poste.cranis2.com`.

See the User Guide, Section 3: Getting Started.

### Q: I did not receive my verification email. What should I do?

First, check your spam or junk folder. The email comes from `info@poste.cranis2.com` and may be filtered by your email provider. If the email does not arrive within a few minutes, try signing up again with the same email address. Until your email is verified, you cannot log in or access the platform. If problems persist, submit a support request describing the issue.

See the User Guide, Section 3: Getting Started.

### Q: How do I set up my organisation?

After email verification and first login, you are directed to a Welcome page that introduces the platform and guides you to create your organisation. The setup wizard collects your organisation name, country, company size (Micro, Small, Medium, or Large), CRA role (Manufacturer, Importer, Distributor, or Open Source Steward), and optionally your industry. Your CRA role determines which obligations are tracked and how compliance workflows behave. Most software companies should select **Manufacturer**.

See the User Guide, Section 3: Getting Started.

### Q: Can I change my organisation details later?

Yes. Organisation settings such as name, country, company size, CRA role, and industry can be updated at any time from the Organisation page under Settings in the sidebar. Changing your CRA role may affect which obligations are tracked for your products.

See the User Guide, Section 21: Organisation Management.

### Q: How do I invite team members to my organisation?

Navigate to the Stakeholders page under Settings in the sidebar. From there you can invite new members by their email address. Invited users receive an email with instructions to create an account (if they do not already have one) and join your organisation. You can assign roles and manage team member access from the same page.

See the User Guide, Section 20: Stakeholders.

### Q: What is the difference between an admin and a member?

An **admin** has full control over the organisation, including managing members, configuring products, accessing billing settings, and modifying organisation-level configuration. A **member** can work within the platform (reviewing findings, updating technical files, filing reports, and managing product-level data) but cannot manage organisation settings, billing, or user access. The person who creates the organisation is automatically assigned the admin role.

See the User Guide, Section 20: Stakeholders.

---

## Products

### Q: How do I register a product?

Navigate to the Products page and click the create button. The creation form collects the product name, product type, and CRA category (all required), plus optional fields for description, version, repository URL, and distribution model. Once created, you can connect a repository, begin filling the Technical File, and start building compliance evidence.

See the User Guide, Section 5: Products.

### Q: How do I choose the right CRA category for my product?

Most software products fall under **Default**, which allows self-assessment by the manufacturer. Choose **Class I (Important)** if your product falls into categories such as identity management, VPNs, network management tools, firewalls, or intrusion detection systems. Choose **Class II (Critical)** only for products such as operating systems, hypervisors, hardware security modules, or smartcard readers. When in doubt, consult CRA Annex III (Class I) and Annex IV (Class II) for the full product lists, or seek legal advice.

See the User Guide, Section 2: Regulatory Context.

### Q: What product types does CRANIS2 support?

CRANIS2 supports eight product types: Firmware, SaaS, Library, Desktop App, Mobile App, IoT, Embedded, and Other. The product type helps categorise your portfolio and is informational. Your **distribution model** (a separate field) has a more direct impact on compliance analysis, particularly for licence compatibility.

See the User Guide, Section 5: Products.

### Q: What are the available distribution models?

There are five distribution models, each affecting licence compatibility analysis differently:

| Model | Description |
|-------|-------------|
| **Proprietary Binary** | Distributed as compiled binary without source code |
| **SaaS Hosted** | Hosted as a service; users do not receive a copy |
| **Source Available** | Source code available under restrictive terms |
| **Library Component** | Distributed as a library for integration by others |
| **Internal Only** | Used internally, not distributed to third parties |

See the User Guide, Section 5: Products.

### Q: How do I connect a repository to a product?

From the product detail page, click **Connect Repository**. For GitHub and Codeberg, an OAuth popup flow handles authentication. You authorise CRANIS2 and select your repository. For self-hosted Gitea, Forgejo, or GitLab instances, you first establish a PAT connection on the Repos page, then connect individual products to repositories on that instance. The first SBOM sync begins automatically after connection.

See the User Guide, Section 14: Repository Management.

### Q: Can I register a product without connecting a repository?

Yes. You can create a product and work on its Technical File, obligations, and other compliance documentation without ever connecting a repository. However, the automated compliance features (SBOM generation, vulnerability scanning, licence compliance analysis, and IP proof) all depend on a connected repository. Products without a repository will require manual compliance evidence.

See the User Guide, Section 5: Products.

### Q: How do I edit a product?

Product details including name, description, version, type, CRA category, and distribution model can all be edited from the product detail page. Navigate to the product and update the fields as needed. Note that changing the distribution model may affect licence compatibility verdicts for existing dependencies.

See the User Guide, Section 5: Products.

### Q: What happens when I delete a product?

When you delete a product, CRANIS2 generates a **data exit package**, a ZIP file containing all compliance data associated with that product. This includes the SBOM, vulnerability findings, technical file content, reports, and other evidence. The data exit ensures you retain your compliance evidence even after removing the product. If the product had escrow enabled, the Forgejo repository is **preserved** even after deletion, in accordance with legal retention requirements.

See the User Guide, Section 5: Products.

---

## Source Code and Privacy

### Q: Does CRANIS2 access my source code?

CRANIS2 reads repository metadata but **never stores your source code and never writes to your repository**. All repository access is strictly read-only — no pushes, no branches, no file modifications, no settings changes. During SBOM generation, source files may be read via the provider's API, parsed in memory, and only dependency metadata is retained. Source content is discarded immediately. This applies to all three SBOM generation tiers, including the import scanner.

With the Software Evidence Engine (opt-in only), CRANIS2 reads more deeply: commit metadata, branch structures, and file paths. The same guarantees apply — source code is never stored, and the repository is never written to. Only structured metrics are retained.

See the User Guide, Section 43: Source Code Guarantee.

### Q: What data is stored from my repository?

CRANIS2 stores the following from your repository:

- **Dependency metadata**: package names, versions, ecosystems, and licences
- **Contributor information**: usernames and contribution counts (from the provider's API)
- **Repository statistics**: stars, forks, open issues, and language breakdown
- **Release and tag information**: version tags and release dates
- **With SEE consent (opt-in)**: commit metadata (author, date, message, classification), LOC counts by language, branch types, developer attribution percentages, architecture evolution events

It does **not** store source code files, file contents, diffs, or any proprietary business logic. See the User Guide, Section 14: Repository Management, Section 16: Dependencies, and Section 43: Source Code Guarantee.

### Q: Does CRANIS2 ever write to my repository?

No. All repository access is strictly read-only. CRANIS2 cannot push code, create branches, modify files, or change any repository settings. Repository connections use read-only scopes (OAuth) or read-only Personal Access Tokens.

### Q: How does import scanning work without storing source code?

During Tier 3 import scanning, CRANIS2 retrieves source files via the repository provider's API, scans them in memory for import statements (`import`, `require`, `use`, `include`, and equivalents across 26 languages), extracts the dependency names, and immediately discards the source content. Only the identified dependency names are persisted. The scanner operates within strict memory guards to prevent resource exhaustion. No source files are written to disk at any point.

See the User Guide, Section 14: Repository Management.

### Q: How are my repository tokens stored?

Personal Access Tokens for self-hosted providers (Gitea, Forgejo, GitLab) are **encrypted at rest** before being stored in the database. CRANIS2 validates each token against the provider's API before accepting it, confirming that it grants the expected permissions. OAuth tokens for GitHub and Codeberg follow standard OAuth security practices. Tokens are used exclusively for API calls to the connected provider and are never exposed to other users, logged in plaintext, or transmitted to third parties.

See the User Guide, Section 14: Repository Management.

### Q: Can I disconnect my repository at any time?

Yes. Disconnecting a repository is immediate and removes the live connection. All previously generated compliance data is preserved. The existing SBOM, vulnerability findings, licence scan results, and IP proof snapshots remain intact and continue to be available. Only future automatic syncs are stopped. You can reconnect the same repository or connect a different one at any time.

See the User Guide, Section 14: Repository Management.

---

## Repository Connections

### Q: Which repository providers does CRANIS2 support?

CRANIS2 supports five repository providers:

| Provider | Auth Method | Hosting |
|----------|-------------|---------|
| **GitHub** | OAuth (popup flow) | github.com |
| **Codeberg** | OAuth (popup flow) | codeberg.org |
| **Gitea** | Personal Access Token | Self-hosted instances |
| **Forgejo** | Personal Access Token | Self-hosted instances |
| **GitLab** | Personal Access Token | Self-hosted instances |

See the User Guide, Section 14: Repository Management and Appendix B: Supported Repository Providers.

### Q: How do I connect a GitHub or Codeberg repository?

Navigate to the product detail page and click **Connect Repository**. Select GitHub or Codeberg as the provider. A popup window opens where you authorise CRANIS2 to access your repositories. Once authorised, select the specific repository from the list. The connection is established immediately and the first SBOM sync begins automatically.

See the User Guide, Section 14: Repository Management.

### Q: How do I connect a self-hosted Gitea, Forgejo, or GitLab instance?

Navigate to the Repos page and open the **Provider Connections** panel. Select the provider type (Gitea, Forgejo, or GitLab), enter the instance URL (e.g. `https://git.example.com`), and provide a Personal Access Token generated from your provider's account settings. CRANIS2 validates the token against the provider's API before storing it. Once validated and encrypted, you can connect individual products to repositories on that instance.

See the User Guide, Section 14: Repository Management.

### Q: What is a Personal Access Token (PAT) and what permissions does it need?

A PAT is an authentication credential generated from your repository provider's account settings. It grants CRANIS2 the permissions needed to read repository metadata, dependency files, contributor information, and release data. The token should be configured with **read-only repository access** at minimum. CRANIS2 encrypts the token at rest and uses it exclusively for API calls to the connected instance. It never writes to your repository.

See the User Guide, Section 14: Repository Management.

### Q: Can I connect multiple repositories from the same provider?

Yes. Once you have established an OAuth connection (GitHub, Codeberg) or a PAT connection (Gitea, Forgejo, GitLab), you can connect any number of repositories from that provider to different products. Each product is linked to one repository, but your provider connection can serve as many products as you need. You only need to authenticate once per provider instance.

---

## SBOM and Dependencies

### Q: How does CRANIS2 generate SBOMs?

CRANIS2 uses a three-tier fallback approach. It attempts each tier in order and uses the first successful result:

1. **Tier 1: API SBOM** (GitHub only): retrieves the SBOM from GitHub's built-in dependency graph API.
2. **Tier 2: Lockfile Parsing**: scans the repository for lockfiles and parses them directly, supporting 28 formats.
3. **Tier 3: Import Scanning**: analyses source code import statements across 26 languages to identify dependencies.

See the User Guide, Section 14: Repository Management.

### Q: What are the differences between the three SBOM tiers?

**Tier 1 (API SBOM)** is the fastest and relies on GitHub's own analysis, but is only available for GitHub-hosted repositories. **Tier 2 (Lockfile Parsing)** produces the most precise SBOMs because lockfiles contain exact, resolved dependency versions including all transitive dependencies. **Tier 3 (Import Scanning)** is a best-effort approach. It identifies dependencies from import statements but cannot determine exact versions or capture dependencies that are not explicitly imported in source code.

See the User Guide, Section 14: Repository Management.

### Q: Which lockfile formats does CRANIS2 support?

CRANIS2 supports 28 lockfile formats across all major ecosystems, including:

- **JavaScript/TypeScript**: package-lock.json, yarn.lock, pnpm-lock.yaml
- **Python**: Pipfile.lock, poetry.lock, requirements.txt
- **Rust**: Cargo.lock
- **Go**: go.sum
- **Ruby**: Gemfile.lock
- **PHP**: composer.lock
- **Dart**: pubspec.lock
- **And many more** across Java, .NET, Elixir, Swift, and other ecosystems

The full list is in the User Guide, Appendix C: Supported Lockfile Formats.

### Q: Which languages does import scanning support?

Import scanning (Tier 3) supports 26 programming languages, including JavaScript, TypeScript, Python, Rust, Go, Java, Kotlin, C#, Ruby, PHP, Swift, Dart, Elixir, Haskell, Scala, R, Lua, Perl, C, C++, Objective-C, and others. The scanner identifies `import`, `require`, `use`, `include`, and equivalent statements specific to each language.

The full list is in the User Guide, Appendix D: Supported Languages for Import Scanning.

### Q: Why does my SBOM show fewer dependencies than I expected?

There are several common reasons:

- **No lockfiles committed**: If your repository does not contain lockfiles, CRANIS2 falls back to import scanning (Tier 3), which may miss transitive dependencies and cannot capture dependencies not explicitly imported.
- **GitHub API limitations**: If the SBOM was generated via Tier 1 (GitHub API), coverage depends on what GitHub has analysed, which may differ from your local build.
- **Monorepo structure**: Dependencies in nested directories may not be detected if the lockfile paths are non-standard.

For the most accurate results, commit your lockfiles to the repository. See the User Guide, Section 14: Repository Management.

### Q: How often are SBOMs updated?

SBOMs can be updated in two ways:

- **Manual sync**: click the sync button on the product detail page or the Repos page to trigger an immediate regeneration.
- **Automatic nightly sync**: the platform scheduler runs at 2 AM UTC and syncs all stale SBOMs. Only repositories that have received changes since the last sync are processed.

After SBOM sync, licence scanning and IP proof generation are triggered automatically. See the User Guide, Section 14: Repository Management.

### Q: What makes an SBOM stale?

An SBOM becomes stale when the connected repository receives new changes after the last sync. This is detected through webhook push events (for GitHub, Codeberg, and Forgejo with configured webhooks) or during the nightly auto-sync check. The Repos page and product detail page display an **Update Available** indicator next to stale SBOMs, and you can choose to sync immediately or wait for the nightly run.

See the User Guide, Section 14: Repository Management.

### Q: Can I export my SBOM? In what formats?

Yes. CRANIS2 supports exporting SBOMs in two industry-standard formats:

- **CycloneDX 1.6** (JSON): an OWASP standard widely used in security tooling and supply chain management.
- **SPDX 2.3** (JSON): a Linux Foundation standard commonly used in licence compliance and regulatory contexts.

Exports are available from the product detail page and are also included in the Due Diligence export package. See the User Guide, Appendix E: SBOM Export Formats.

---

## Vulnerabilities and Risk Findings

### Q: How does vulnerability scanning work?

CRANIS2 evaluates every dependency in a product's SBOM against a local vulnerability database. The database is built from two authoritative sources: OSV (covering 263,000+ advisories) and NVD (covering 182,000+ CVEs). The local database deduplicates across both sources and uses CPE matching combined with ecosystem-specific filtering to minimise false positives. When a match is found, a finding is created with the vulnerability details, severity, affected package, and fix version (if available).

See the User Guide, Section 17: Risk Findings.

### Q: Which vulnerability databases does CRANIS2 use?

CRANIS2 uses two complementary sources:

- **OSV (Open Source Vulnerabilities)**: a distributed database covering all major open-source ecosystems with 263,000+ advisories. It uses ecosystem-specific identifiers (GHSA, PYSEC, RUSTSEC, etc.) for precise package matching.
- **NVD (National Vulnerability Database)**: the US government repository with 182,000+ CVEs. It uses CPE identifiers for matching.

Both databases are synchronised nightly at 1 AM UTC. See the User Guide, Section 17: Risk Findings.

### Q: How often are vulnerability scans run?

The platform scheduler runs a comprehensive vulnerability scan across all products at **3 AM UTC daily**. You can also trigger a scan manually from the product detail page at any time. Since the vulnerability database is synchronised at 1 AM UTC, the 3 AM scan always runs against the latest available data. Scans deduplicate findings to avoid alerting on the same vulnerability multiple times.

See the User Guide, Section 17: Risk Findings and Section 25: Automated Background Processes.

### Q: What severity levels are used for findings?

Findings use four severity levels derived from CVSS (Common Vulnerability Scoring System) scores:

| Severity | CVSS Range | Platform Colour |
|----------|-----------|-----------------|
| **Critical** | 9.0–10.0 | Red |
| **High** | 7.0–8.9 | Red |
| **Medium** | 4.0–6.9 | Amber |
| **Low** | 0.1–3.9 | Green |

See the User Guide, Section 17: Risk Findings.

### Q: How do I triage a vulnerability finding?

Navigate to the finding on the Risk Findings page or the product detail page. Each finding can be set to one of five statuses using inline editing. You can change the status directly from the table row. For Mitigated findings, a notes text area is available to document the workaround. For Dismissed findings, a reason field captures the justification. All status changes are recorded in the audit trail.

See the User Guide, Section 17: Risk Findings.

### Q: What are the five finding statuses?

| Status | Meaning | When to Use |
|--------|---------|-------------|
| **Open** | New finding, not yet reviewed | Automatically assigned on creation |
| **Acknowledged** | Team is aware and evaluating | Reviewed but no action decided yet |
| **Mitigated** | Workaround or partial fix applied | Temporary measure in place |
| **Resolved** | Fully fixed | Vulnerable dependency updated or removed |
| **Dismissed** | Not applicable or accepted risk | Vulnerable code path not reachable, or risk accepted |

See the User Guide, Section 17: Risk Findings.

### Q: Can I create an ENISA report directly from a vulnerability finding?

Yes. If a vulnerability finding represents an actively exploited vulnerability, you can create an ENISA report directly from the Risk Findings page. The report creation form will be pre-populated with data from the finding (affected dependency, severity, CVSS score, and description), saving you time during a time-sensitive reporting process.

See the User Guide, Section 17: Risk Findings and Section 10: ENISA Reporting.

---

## ENISA Reporting

### Q: When am I required to file an ENISA report?

You must file an ENISA report when you become aware of either:

- An **actively exploited vulnerability** in one of your products, meaning a vulnerability that is being used in real attacks.
- A **severe security incident** that has a significant impact on the security of a product with digital elements.

If in doubt, err on the side of filing. Late reporting carries regulatory consequences; over-reporting does not. These obligations become legally binding in September 2026. See the User Guide, Section 10: ENISA Reporting.

### Q: How do I create an ENISA report?

Navigate to the Vulnerability Reports page and click **New Report**. The creation form collects three required fields: the affected product (selected from your portfolio), the report type (Actively Exploited Vulnerability or Severe Incident), and the awareness date and time (which starts the deadline clock). After creation, you can set the CSIRT country, affected member states, TLP classification, and ENISA reference number.

See the User Guide, Section 10: ENISA Reporting.

### Q: What is the three-stage reporting timeline?

Once a report is created with an awareness date, CRANIS2 automatically calculates three deadlines:

1. **Early Warning** (24 hours): summary of the issue, whether malicious action is suspected, initial assessment of affected member states.
2. **Notification** (72 hours): detailed description, corrective measures taken or planned, patch status, affected components.
3. **Final Report** (14 days for vulnerabilities, 1 month for incidents): root cause analysis, severity assessment, preventive measures, user notification status.

The report detail page shows the timeline visually with submitted stages marked as complete and upcoming deadlines displayed as countdowns. See the User Guide, Section 10: ENISA Reporting.

### Q: What is the Early Warning and when is it due?

The Early Warning is the first mandatory stage, due **within 24 hours** of becoming aware of the issue. It should include a summary of the vulnerability or incident, an initial assessment of scope, and whether malicious action is suspected. CRANIS2 provides a structured form with fields appropriate to this stage. Intermediate updates can be submitted between the Early Warning and the Notification stage for progress reporting.

See the User Guide, Section 10: ENISA Reporting.

### Q: What is the difference between a vulnerability report and an incident report?

A **vulnerability report** is filed when you discover an actively exploited vulnerability in your product. An **incident report** is filed when a severe security incident has significant impact on product security. The key practical difference is the Final Report deadline: **14 days** for vulnerability reports and **1 month** for incident reports. The Early Warning (24 hours) and Notification (72 hours) deadlines are the same for both types.

See the User Guide, Section 10: ENISA Reporting.

### Q: Can I add information after closing a report?

Yes. CRANIS2 supports **post-close addenda**. You can submit additional intermediate stages even after a report has been closed, in case new information emerges or your understanding of the issue evolves. This means you do not need to create a new report if you discover additional details after closure.

See the User Guide, Section 10: ENISA Reporting.

---

## Licence Compliance

### Q: How does licence scanning work?

CRANIS2 classifies every dependency's licence into three categories: **Permissive** (MIT, Apache-2.0, BSD, ISC), **Copyleft** (GPL, LGPL, AGPL, MPL, SSPL), and **Unknown/NOASSERTION** (no declared licence). A rules engine then evaluates each licence against your product's distribution model to produce a compatibility verdict: Compatible, Incompatible, or Review Needed. The engine also detects 14 known cross-licence incompatibilities where two licences in the same dependency tree conflict.

See the User Guide, Section 11: Licence Compliance.

### Q: What is the difference between permissive and copyleft licences?

**Permissive licences** (MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, Unlicense) allow unrestricted use, including in proprietary products, with minimal obligations (typically just attribution). **Copyleft licences** (GPL-2.0, GPL-3.0, LGPL, AGPL-3.0, MPL-2.0, SSPL-1.0) require derivative works to be distributed under the same or compatible terms. The practical impact of copyleft depends on your distribution model and how the dependency is linked.

See the User Guide, Section 11: Licence Compliance.

### Q: What does NOASSERTION mean?

NOASSERTION means the dependency has no declared licence or uses a licence identifier that CRANIS2 does not recognise. Dependencies with NOASSERTION require manual review because the absence of a declared licence may carry legal risk. You could be using code with no legal permission to do so. Investigate the dependency's actual licensing terms on its project page before distributing your product.

See the User Guide, Section 11: Licence Compliance.

### Q: How does the compatibility matrix work?

The compatibility engine evaluates every dependency's licence against your product's distribution model and produces one of three verdicts: **Compatible** (safe to use), **Incompatible** (action required), or **Review Needed** (ambiguous, manual review recommended). The engine also detects 14 known cross-licence incompatibilities based on FSF guidance, where two licences in the same dependency tree conflict with each other regardless of your distribution model.

See the User Guide, Section 11: Licence Compliance.

### Q: How does my distribution model affect licence compatibility?

Your distribution model has a direct and significant impact:

- **Proprietary Binary**: incompatible with GPL-licensed dependencies (unless dynamically linked under LGPL exception).
- **SaaS Hosted**: triggers network copyleft obligations under AGPL and SSPL, which extend copyleft to software accessed over a network.
- **Internal Only**: has no distribution-related licence obligations in most cases.
- **Library Component**: must consider the downstream consumer's distribution model.
- **Source Available**: depends on the specific terms of your source-available licence.

See the User Guide, Section 11: Licence Compliance.

### Q: Can I waive a licence finding?

Yes. If a licence finding does not apply to your situation (for example, a test-only dependency not included in the distributed product, or a build tool not bundled with the output), you can **waive** the finding and record your reasoning. Waived findings are retained in the audit trail for accountability but are excluded from active compliance counts and dashboards.

See the User Guide, Section 11: Licence Compliance.

---

## IP Proof

### Q: What is IP Proof?

IP Proof is CRANIS2's implementation of cryptographic timestamping for compliance evidence. It creates independently verifiable proof that a specific set of data (your product's software composition) existed at a specific point in time. This is valuable for establishing prior art against patent claims, demonstrating compliance as of a particular date for auditors, and verifying the integrity of escrow deposits.

See the User Guide, Section 12: IP Proof.

### Q: What is RFC 3161 timestamping?

RFC 3161 defines a protocol for trusted timestamping. CRANIS2 generates a SHA-256 hash of your product's composition data, sends this hash to a Time Stamping Authority (FreeTSA.org), and receives back a signed timestamp token. The TSA signs the hash together with the current time, creating proof that the data existed at that moment. The TSA never sees your source code or dependency data; it receives only the cryptographic hash. The resulting timestamp is recognised under the EU eIDAS Regulation (910/2014) as legally admissible evidence.

See the User Guide, Section 12: IP Proof.

### Q: How are IP Proof snapshots created?

Snapshots are created **automatically** after every SBOM sync. The nightly auto-sync at 2 AM UTC triggers a licence scan, and the licence scan triggers IP proof creation. This means your IP proof stays current without any manual action. Each snapshot records the SHA-256 content hash, verification status, and creation date. You can view all snapshots on the IP Proof page.

See the User Guide, Section 12: IP Proof.

### Q: What does "verified" mean on an IP Proof snapshot?

A verified snapshot means the RFC 3161 timestamp token has been successfully validated, confirming that the content hash was signed by the Time Stamping Authority at the recorded date and time. This verification can be performed independently by anyone with the timestamp token, providing legally admissible proof under EU eIDAS that your software composition existed as of that specific date.

See the User Guide, Section 12: IP Proof.

---

## Due Diligence Export

### Q: What is the Due Diligence export?

The Due Diligence export generates a comprehensive, investor-ready compliance package for any of your products. It is designed for scenarios where you need to demonstrate your compliance posture to a third party: during fundraising, acquisition due diligence, customer procurement, regulatory inspection, internal audit, or cyber insurance applications. You can preview the contents before downloading.

See the User Guide, Section 13: Due Diligence Export.

### Q: What files are included in the export?

The ZIP file contains five items:

| File | Format | Contents |
|------|--------|----------|
| Due Diligence Report | Markdown | Executive summary of compliance posture |
| Software Bill of Materials | CycloneDX 1.6 JSON | Complete dependency inventory |
| Licence Findings | CSV | All dependencies with compliance verdicts |
| Vulnerability Summary | JSON | All findings with severities and CVEs |
| Full Licence Texts | Text files | Complete text for each non-permissive licence |

See the User Guide, Section 13: Due Diligence Export.

### Q: Is the Due Diligence export per-product?

Yes. You select a specific product from the dropdown before generating the export. Each ZIP covers a single product and includes all compliance data associated with it. A preview is shown before you download, including summary statistics, non-permissive dependencies, and CRA obligation status. If you need exports for multiple products, generate one for each product separately.

See the User Guide, Section 13: Due Diligence Export.

---

## Escrow

### Q: What is source code escrow?

Source code escrow is a business continuity mechanism where a copy of your product's source code is deposited with a trusted third party, with agreed conditions under which it may be released to designated beneficiaries. If your company ceases to operate, your customers are not left without access to the software they depend on. For B2B software vendors, escrow is increasingly a procurement requirement and provides a tangible trust signal during sales conversations.

See the User Guide, Section 7: Escrow.

### Q: How does escrow work in CRANIS2?

CRANIS2 uses a self-hosted **Forgejo** instance (a lightweight, open-source Git forge) for escrow deposits. Escrow is opt-in and configured per product. When enabled, your repository is mirrored to the Forgejo instance. You can also configure which artifact types to include alongside the source code: SBOM, vulnerability reports, licence audit, IP proof, CRA documentation, and compliance timeline. You choose a release model (open source or designated recipients) to control what happens if the deposit needs to be released.

See the User Guide, Section 7: Escrow.

### Q: Where is the escrow data stored?

The Forgejo instance is hosted in **Switzerland**, ensuring European data sovereignty. It runs within the CRANIS2 infrastructure and is separate from your production repository; it functions purely as a deposit. The escrow data never leaves European jurisdiction.

See the User Guide, Section 7: Escrow.

### Q: How often are escrow deposits made?

Automated escrow deposits run **daily at 5 AM UTC** for all products with escrow enabled. Each deposit mirrors the current state of your repository and any configured compliance artifacts. This ensures the escrow is always current without requiring manual action.

See the User Guide, Section 7: Escrow and Section 25: Automated Background Processes.

### Q: What happens to the escrow when I delete a product?

When you delete a product from CRANIS2, the Forgejo escrow repository is **not deleted**. It is preserved under legal retention policy, ensuring continuity of any escrow agreements regardless of the product's status in CRANIS2. The data exit ZIP you receive on product deletion includes references to the preserved escrow repository.

See the User Guide, Section 7: Escrow and Section 5: Products.

---

## Technical Files and Obligations

### Q: What is a Technical File in CRANIS2?

A Technical File in CRANIS2 corresponds to the CRA Annex VII requirements. It is a structured documentation package with eight sections, each addressing a specific regulatory requirement. Every section provides a content editor for substantive documentation, a notes field for internal annotations (not included in exports), and a status indicator (Not Started, In Progress, or Complete). The cross-product Technical Files dashboard shows completion progress for all products at a glance.

See the User Guide, Section 9: Technical Files.

### Q: How do I edit a Technical File section?

Navigate to the product detail page and open the **Technical File** tab. Click on any of the eight sections to open its editor. Write your documentation in the content field, add internal notes if needed, and set the status. The CRA reference for each section is displayed alongside the editor so you can see exactly which regulatory requirement you are addressing. Content is saved when you submit the form.

See the User Guide, Section 9: Technical Files.

### Q: What are the Annex I checklist items?

Within the Technical File tab, the **Annex I Part I checklist** covers 13 essential cybersecurity requirements labelled (a) through (m). These include security by design, no known vulnerabilities at market placement, secure defaults, access protection, data confidentiality, data integrity, data minimisation, availability protection, minimal network impact, incident resilience, security logging, secure data removal, and security update mechanisms. For each requirement, you can mark it as applicable or not applicable and provide evidence of how it is met.

See the User Guide, Section 9: Technical Files and Section 2: Regulatory Context.

### Q: What are CRA obligations and what statuses can they have?

CRANIS2 tracks **35 CRA obligations** across three operator roles: 19 for manufacturers (Articles 13, 14, 16, 20, 32, and Annexes), 10 for importers (Article 18), and 6 for distributors (Article 19). They cover product security (Annex I), vulnerability handling (Article 13), security updates, SBOM maintenance, technical documentation (Annex VII), conformity assessment (Articles 24–28), CE marking (Article 22), authority reporting (Article 14), market surveillance cooperation (Article 43), and role-specific supply chain obligations for importers and distributors. Each obligation has one of three statuses: **Not Started**, **In Progress**, or **Met**. Statuses can be changed inline from the obligations table, and the obligation engine automatically derives statuses from platform data (SBOMs, scans, technical file progress, field issues, crypto scans).

See the User Guide, Section 8: Obligations Tracking.

---

## Billing and Subscription

### Q: How does contributor-based pricing work?

You pay **EUR 6 per month** for each active contributor across your organisation. An active contributor is anyone who has made at least one contribution to a connected repository. Bot accounts are automatically identified and excluded from billing. The Billing page shows a contributor roster with badges indicating each contributor's status: active (green), bot (grey), departed (red), and inactive (amber).

See the User Guide, Section 18: Billing.

### Q: What happens when my trial expires?

The trial follows a defined lifecycle:

1. **90-day trial**: full access to all features.
2. **7-day grace period**: full access continues, with a warning banner prompting subscription.
3. **Read-only mode**: all write operations blocked; viewing and exporting remain available.
4. **Suspension** (60 days after read-only): limited access.
5. **Cancellation**: account is cancelled.

You can subscribe at any point to restore full access. See the User Guide, Section 18: Billing.

### Q: What is the billing gate?

The billing gate is a global middleware that activates when an organisation enters read-only, suspended, or cancelled status. It intercepts all write operations (creating products, updating obligations, filing reports, syncing SBOMs, editing technical files) and returns a billing error. You can still view all your data, read reports, export SBOMs and due diligence packages, and access the billing page to resolve the payment issue.

See the User Guide, Section 18: Billing.

### Q: What can I still do in read-only mode?

In read-only mode you retain full **read access**: viewing all products, findings, reports, and compliance data; exporting SBOMs in CycloneDX and SPDX formats; downloading due diligence packages; viewing the audit log; and accessing the billing page to subscribe or resolve payment issues. All **write operations** (create, update, delete) are blocked until your billing status is restored.

See the User Guide, Section 18: Billing.

### Q: How do I upgrade from the free trial to a paid subscription?

Navigate to the **Billing** page under the Billing section in the sidebar. Click the subscribe button to be directed to Stripe's hosted checkout, where you enter your payment details. You can also set your billing email, company name, and VAT number on the Billing page. Once payment is processed, your account status moves to Active and all features remain available.

See the User Guide, Section 18: Billing.

### Q: How do I manage my payment method or cancel my subscription?

The Billing page provides a link to **Stripe's customer portal**, where you can view invoices, update your payment method, and cancel your subscription. If a payment fails, you receive a 7-day grace period with full access before the account enters read-only mode. Resolving the payment failure during the grace period prevents any disruption.

See the User Guide, Section 18: Billing.

---

## Marketplace

### Q: What is the Marketplace?

The Marketplace is a public-facing directory of organisations using CRANIS2 to demonstrate their compliance posture. It is accessible without login, allowing prospective customers, partners, procurement teams, and auditors to browse listed companies and assess their compliance readiness at a glance through compliance badges.

See the User Guide, Section 19: Marketplace.

### Q: How do I list my organisation on the Marketplace?

Navigate to the Marketplace settings page. From there you can toggle your listing visibility on or off, write a tagline and longer description, select product categories that apply to your organisation (from 10 available categories), and choose which of your products to feature on the listing. Listings are currently auto-approved upon creation.

See the User Guide, Section 19: Marketplace.

### Q: What are the compliance badges on Marketplace listings?

Each listing displays live compliance badges summarising the organisation's posture: CRA status, percentage of obligations met, technical file completion percentage, product count, open vulnerability count, and licence compliance percentage. These badges are calculated from live data and update automatically as the organisation's compliance posture evolves.

See the User Guide, Section 19: Marketplace.

### Q: Can I contact a company listed on the Marketplace?

Yes, if you are logged in. A contact modal allows you to send a message to listed organisations. Rate limits are enforced to prevent abuse: a maximum of **3 messages per day** per user across all organisations, and **1 message per organisation** per 7-day period.

See the User Guide, Section 19: Marketplace.

### Q: Do Marketplace listings require approval?

Marketplace listings are currently **auto-approved** upon creation. When you toggle your listing to visible and save your profile, it appears in the public directory immediately. You can toggle it off at any time to remove your listing from public view. No manual review process is required.

See the User Guide, Section 19: Marketplace.

---

## Notifications and Audit

### Q: What types of notifications does CRANIS2 generate?

CRANIS2 generates notifications for the following events:

- New vulnerability findings discovered during scans
- Approaching or overdue ENISA reporting deadlines (escalating alerts at 12 hours, 4 hours, and 1 hour before deadlines)
- Repository sync status changes (stale SBOM detected after a push event)
- Billing events (trial expiry warnings, payment failure alerts)

Notifications have five severity levels: **critical**, **high**, **medium**, **low**, and **info**. See the User Guide, Section 4: Navigating the Platform.

### Q: Can I filter notifications?

Yes. The Notifications page supports filtering by severity level and notification type. You can also mark individual notifications as read. A badge on the sidebar shows the count of unread notifications so you can quickly assess whether new alerts require attention without navigating to the page.

See the User Guide, Section 4: Navigating the Platform.

### Q: Does CRANIS2 have an audit log?

Yes. The **Audit Log** page under Settings records significant actions taken within your organisation, providing a traceable record of who did what and when. This is valuable for internal governance reviews, regulatory inspections, demonstrating continuous compliance to auditors, and investigating any unexpected changes to your compliance data.

See the User Guide, Section 22: Audit Log.

---

## Troubleshooting

### Q: I cannot create, edit, or delete anything. What is wrong?

This almost certainly means the **billing gate** is active. Your organisation may have entered read-only mode due to an expired trial (after the 7-day grace period), a failed payment, or account suspension. Navigate to the Billing page to check your current billing status and take the appropriate action, whether subscribing for the first time or resolving a payment failure.

See the User Guide, Section 18: Billing.

### Q: My SBOM shows zero dependencies. What should I check?

Work through this checklist:

1. Confirm that a repository is connected to the product (check the product detail page).
2. Verify that the repository contains recognisable lockfiles (package-lock.json, yarn.lock, Cargo.lock, go.sum, etc.) or source files in one of the 26 supported languages.
3. Check that the lockfiles are committed to the repository, not just present locally.
4. Verify that the repository connection is active and the token has not expired.
5. Try triggering a manual sync from the product detail page.

See the User Guide, Section 14: Repository Management.

### Q: A vulnerability scan returned no results. Does that mean my product is secure?

Not necessarily. A scan with no results means no known vulnerabilities were found in the current SBOM against the databases available at scan time. New vulnerabilities are published daily, and the databases are synchronised nightly at 1 AM UTC, so future scans may discover issues. Also confirm that your SBOM is not empty; a scan against an empty SBOM will naturally return zero findings. Vulnerability databases may not cover all ecosystems equally.

See the User Guide, Section 17: Risk Findings.

### Q: I see "Invalid Date" displayed on a page. What does this mean?

This is a display formatting issue that can occur when date values from the database are not in the expected format. If you encounter this, try refreshing the page first. If the issue persists, submit a bug report using the **Feedback** button at the bottom of the sidebar. Select the "bug" category and the page URL will be captured automatically. This helps the development team identify and resolve the formatting issue.

See the User Guide, Section 23: Feedback System.

### Q: My notification count badge does not match the number of unread notifications on the page.

The badge and the notifications page may briefly show different counts if new notifications arrive between page loads or if there is a caching delay. Refreshing the page should synchronise the count. If the discrepancy persists after a refresh, submit a bug report using the Feedback button at the bottom of the sidebar.

See the User Guide, Section 4: Navigating the Platform.

### Q: I am an organisation admin but cannot access Platform Administration features.

**Platform Administration** is a separate role from organisation admin. Organisation admins manage their own company's account, products, and team members. Platform admins manage the entire CRANIS2 platform, including all organisations, system health, vulnerability database administration, and test results. Platform admin access is granted at the system level and is not available to regular organisation admins, regardless of their admin status within their own organisation.

See the User Guide, Section 24: Platform Administration.

---

## AI Intelligence (Pro Plan)

### Q: What is the AI Copilot?

The AI Copilot is a set of AI-powered features available on the Pro plan that help you write compliance documentation faster. It uses Claude (Anthropic) to generate contextual suggestions for technical file sections, obligation evidence notes, vulnerability triage decisions, risk assessments, and incident report drafts. The AI only sees compliance metadata (product details, dependencies, scan results). It never has access to your source code.

See the User Guide, Section 26: AI Copilot.

### Q: Does the AI Copilot have access to my source code?

No. The AI Copilot receives structured metadata only: product name, CRA category, dependency names and versions, vulnerability findings, and existing compliance documentation. Your source code is never sent to the AI provider.

### Q: What is AI auto-triage?

AI auto-triage analyses individual vulnerability findings and recommends whether to dismiss, acknowledge, or escalate them. It provides a confidence score and reasoning for each recommendation. For findings with available fixes, it also generates ecosystem-specific CLI commands (e.g. `npm install package@version`). Findings recommended for dismissal with confidence above 90% can be auto-dismissed.

See the User Guide, Section 27: AI Auto-Triage.

### Q: What does the AI risk assessment generator produce?

It generates a four-part risk assessment document: methodology, threat model, risk register, and Annex I requirement mappings. The assessment is grounded in your actual product data (dependencies, scan results, CRA category) and can be exported as Markdown for inclusion in your CRA technical file.

See the User Guide, Section 28: AI Risk Assessment.

### Q: What is the AI incident report drafter?

When filing an ENISA Article 14 report, the AI can draft content for each of the three stages (early warning, notification, final report). It uses your product's vulnerability data, linked findings, and any previously submitted stages to generate contextually appropriate content. The draft is merged non-destructively; existing content is never overwritten.

See the User Guide, Section 29: AI Incident Report Drafter.

### Q: How does the CRA category recommender work?

The recommender uses a deterministic four-attribute scoring system (network connectivity, data sensitivity, privileged access, safety/infrastructure impact) to suggest whether your product is Default, Important Class I, Important Class II, or Critical. On the Pro plan, an AI second opinion is also provided. Platform admins can define override rules for specific attribute combinations.

See the User Guide, Section 30: CRA Category Recommender.

### Q: Is there a usage limit on AI features?

Yes. Each organisation has a monthly token budget (default: 500,000 tokens). Individual AI endpoints also have rate limits (e.g. 20 suggestions per product per hour, 3 risk assessments per product per day). AI responses are cached for 24 hours to avoid consuming tokens on repeated identical requests. Usage is tracked on the Billing page and the product Overview tab.

See the User Guide, Section 36: Copilot Usage & Cost Protection.

### Q: What is supplier due diligence?

Supplier due diligence generates template-based questionnaires for your product's dependencies, assessing their security practices, licence compliance, and maintenance cadence. It does not use AI. The questionnaires are derived from CRA requirements using deterministic templates. Dependencies from npm, PyPI, and crates.io are automatically enriched with maintainer and registry metadata. Results can be exported as Markdown or CSV.

See the User Guide, Section 31: Supplier Due Diligence.

### Q: What is the compliance gap narrator?

The compliance gap narrator is the "Next Steps" card on each product's Overview tab. It provides a prioritised list of compliance actions based on a deterministic analysis of your obligations, technical file progress, scan coverage, SBOM freshness, and stakeholder completeness. It does not use AI.

See the User Guide, Section 32: Compliance Gap Narrator.

---

## Public API and Integrations

### Q: Does CRANIS2 have an API?

Yes. The public API (Pro plan) provides read-only access to your products, vulnerability findings, obligation statuses, and compliance status. Authentication is via API keys (created at Settings > Integrations). All endpoints are under `/api/v1/`.

See the User Guide, Section 33: Public API & API Keys.

### Q: What is the CI/CD compliance gate?

The CI/CD gate is a pipeline step that queries the CRANIS2 API and fails the build if open critical or high-severity findings are detected. Ready-made snippets are provided for GitHub Actions, GitLab CI, and generic bash scripts. It requires a Pro plan and an API key.

See the User Guide, Section 34: CI/CD Compliance Gate.

### Q: Can CRANIS2 create Trello cards?

Yes. The Trello integration (Pro plan) automatically creates cards on mapped Trello boards when compliance events occur: new vulnerability findings, obligation status changes, stale SBOMs, and compliance gaps. Cards are deduplicated, and resolution comments are added when events are cleared. Configure it at Settings > Integrations.

See the User Guide, Section 35: Integrations.

### Q: What is the MCP server?

The MCP (Model Context Protocol) server allows IDE AI assistants (Claude Desktop, VS Code with GitHub Copilot, Cursor, and Claude Code) to query your CRANIS2 compliance data directly from the editor. It provides five tools: list products, get vulnerabilities, get mitigation commands, verify fixes, and check compliance status.

See the User Guide, Section 35: Integrations.

### Q: How do I set up the IDE compliance assistant?

Navigate to Settings > Integrations and scroll to the IDE Compliance Assistant card. Select your IDE, choose an API key, and copy the auto-generated JSON configuration snippet into your IDE's MCP configuration file. The wizard provides the correct format and file path for each supported IDE.

See the User Guide, Section 35: Integrations.

---

## Plans and Pricing

### Q: What is the difference between Standard and Pro?

**Standard** (EUR 6/contributor/month) includes all core compliance features: SBOMs, vulnerability monitoring, licence compliance, IP proof, technical files, ENISA reporting, escrow, obligations tracking (35 obligations across manufacturer, importer, and distributor roles), post-market monitoring with field issue tracking, cryptographic standards inventory, conformity assessments, document templates, compliance evidence vault, and the marketplace.

**Pro** (EUR 9/product/month + EUR 6/contributor/month) adds AI intelligence features (Copilot, auto-triage, risk assessment, incident drafter, category recommender), the public API with API keys, the CI/CD compliance gate, Trello integration, the IDE compliance assistant via MCP, and the GRC/OSCAL bridge for audit tool integration.

See the User Guide, Section 18: Billing.

### Q: Can I upgrade or downgrade my plan?

Yes. Navigate to the Billing page and click the appropriate button. Upgrades take effect immediately with prorated billing. Downgrades take effect at the end of the current billing period. Access to Pro-only features is removed on downgrade.

### Q: Are supplier due diligence and the compliance gap narrator available on Standard?

Yes. Both features are available on all paid plans (and during the free trial). They are deterministic, template-based features that do not use AI.

---

## Post-Market Monitoring & Field Issues

### Q: What is post-market monitoring in CRANIS2?

Post-market monitoring tracks field-reported security issues after a product is placed on the market, as required by CRA Articles 13(2) and 13(9). The **Field Issues** tab on each product lets you record, investigate, and resolve security issues reported by customers, discovered through internal testing, or identified by market surveillance authorities. Each field issue progresses through a defined lifecycle: open → investigating → fix in progress → resolved → closed.

See the User Guide, Section 37: Post-Market Monitoring & Field Issues.

### Q: What are corrective actions?

Corrective actions are the specific steps taken to address a field issue. Each field issue can have one or more corrective actions, each with its own lifecycle: planned → in progress → completed → verified. Corrective action data automatically feeds the obligation engine — Art. 13(9) (security updates) tracks corrective action completion rates.

See the User Guide, Section 37: Post-Market Monitoring & Field Issues.

### Q: Can I export field issue data?

Yes. Click **Export Report** on the Field Issues tab to generate a Markdown surveillance report covering all field issues for a product, including corrective action status and timeline. This report is suitable for inclusion in the CRA technical file or for submission to market surveillance authorities.

### Q: How do field issues affect my obligation status?

Field issue data automatically feeds two obligations: **Art. 13(6) — Vulnerability handling** reflects whether any field issues remain open, and **Art. 13(9) — Security updates** tracks whether corrective actions have been completed. If you have unresolved field issues, these obligations cannot show as fully met.

---

## Cryptographic Standards & Quantum Readiness

### Q: What does the cryptographic standards inventory do?

The crypto inventory scans your dependency tree to identify cryptographic algorithm usage and classifies 37 algorithms into three categories: **quantum-safe** (resistant to quantum attacks, e.g. ML-KEM, AES-256, SHA-3), **quantum-vulnerable** (secure today but breakable by quantum computers, e.g. RSA, ECDSA, classic Diffie-Hellman), and **broken** (already insecure, e.g. MD5, SHA-1, DES, RC4). Access it from the **Crypto Inventory** tab on each product.

See the User Guide, Section 38: Cryptographic Standards Inventory.

### Q: What is the PQC readiness assessment?

The Post-Quantum Cryptography (PQC) readiness assessment is a public self-assessment tool with 18 questions covering your migration preparedness for quantum-resistant algorithms. It evaluates current algorithm usage, migration planning, crypto-agility, key management, and compliance with emerging NIST FIPS 203/204/205 standards. Available publicly at `/assess/pqc`.

See the User Guide, Section 39: Conformity Assessments.

### Q: How does the crypto inventory affect my obligations?

Crypto findings feed two areas of the obligation engine: **Art. 13(2) — Cryptographic requirements** reflects whether broken or quantum-vulnerable algorithms have been identified and addressed, and crypto data is included in the context for AI-generated Annex I risk assessment mappings.

---

## Conformity Assessments

### Q: What conformity assessments are available?

CRANIS2 provides four self-assessment tools:

| Assessment | Questions | Scope |
|-----------|-----------|-------|
| **CRA Conformity** | 12 | Product-level CRA compliance |
| **NIS2 Readiness** | 25 | Organisation-level NIS2 compliance |
| **Importer Obligations** | 10 | CRA Article 18 requirements for importers |
| **PQC Readiness** | 18 | Post-quantum cryptography preparedness |

All four are available publicly at `/assess` without a CRANIS2 account.

See the User Guide, Section 39: Conformity Assessments.

### Q: Do I need a CRANIS2 account to take an assessment?

No. All four assessments are accessible publicly from the assessment landing page at `/assess`. This allows prospective customers, supply chain partners, and auditors to evaluate compliance posture independently. For authenticated users, results are stored against the product or organisation.

### Q: What is the importer obligations assessment?

The importer obligations assessment covers the 10 CRA Article 18 requirements specific to importers placing products on the EU market. It helps importers evaluate whether they meet their obligations regarding conformity assessment verification, CE marking checks, technical file availability, and cooperation with market surveillance authorities.

---

## GRC/OSCAL Bridge

### Q: What is the GRC/OSCAL bridge?

CRANIS2 exports compliance data in **OSCAL 1.1.2** (Open Security Controls Assessment Language) format for integration with governance, risk, and compliance (GRC) platforms. Four document types are supported: catalog (obligation definitions), profile (applicable obligations), assessment-results (compliance status with findings), and component-definition (product metadata).

**Requires:** Pro plan.

See the User Guide, Section 40: GRC/OSCAL Bridge.

### Q: Which GRC tools can I import OSCAL data into?

Any tool that supports OSCAL 1.1.2 JSON, including Trestle, Lula, Comply, and others. The exports conform to the NIST OSCAL 1.1.2 schema specification.

### Q: How do I access OSCAL exports?

OSCAL exports are available via the Public API (Pro plan required). Use the API endpoints for each document type: `/api/v1/products/:productId/oscal/catalog`, `/oscal/profile`, `/oscal/assessment-results`, and `/oscal/component-definition`.

---

## Software Evidence Engine

### Q: What is the Software Evidence Engine?

The Software Evidence Engine (SEE) analyses connected repositories to extract structured engineering evidence for R&D tax credits, due diligence, and multi-regulation compliance reporting. It operates in eight phases covering LOC estimation, commit history analysis, branch classification, experimentation detection, architecture evolution, evidence graph integration, multi-regulation report generation, and session capture with competence profiling.

**Requires:** Pro plan. Opt-in per product (explicit source code consent required).

See the User Guide, Section 41: Software Evidence Engine.

### Q: Does the SEE store my source code?

No. The SEE reads commit metadata, branch structures, and file paths, but never stores source code. Source files are processed transiently — read, metadata extracted, content discarded. What is retained: LOC counts by language, commit classifications, developer attribution percentages, branch types, experimentation indicators, and architecture evolution events.

### Q: Does the SEE write to my repository?

No. All repository access is strictly read-only. The SEE cannot push code, create branches, or modify files.

### Q: What regulations does the SEE support?

The SEE generates evidence reports for six regulatory frameworks: R&D Tax (HMRC, CIR, Forschungszulage, I+D+i), CRA, NIS2, AI Act, DORA, and ISO 27001. Reports are deterministic, auditable, and exportable as Markdown.

### Q: How does experimentation detection work?

Five algorithms identify R&D activity patterns in your commit and branch history: refactoring waves (clustered refactoring commits), prototype branches (high churn, short lifespan), rapid iteration cycles (repeated changes within short windows), high rewrite ratios (sustained rework indicating technical uncertainty), and fix-after-feature patterns (fixes closely following feature commits). These patterns are used as evidence of technological uncertainty for R&D tax credit claims.

### Q: What is the COCOMO II effort model?

The SEE uses a COCOMO II-style model to estimate development effort (person-months) and cost ranges from LOC counts. It produces low, mid, and high estimates based on productivity factors and project complexity. These estimates are included in the executive report.

---

## Session Capture & Competence Profiling

### Q: What is session capture?

Session capture records development sessions (via Claude Code hooks or MCP integration) to build evidence of engineering competence. This addresses the "competent professional" requirement in R&D tax relief schemes. Each developer is prompted for explicit consent before any session is recorded.

**Requires:** Pro plan. Explicit developer consent per session.

See the User Guide, Section 42: Session Capture & Competence Profiling.

### Q: Where are session transcripts stored?

Session transcripts are stored in the platform's Forgejo instance — EU-sovereign, git-backed, within the CRANIS2 infrastructure. This provides European data sovereignty and a full audit trail via git history.

### Q: What is a Competence Evidence Profile?

A structured assessment of engineering competence generated from a development session. It evaluates 10 domains: domain vocabulary, design reasoning, industry reference detection, decision quality, technical uncertainty identification, problem decomposition, trade-off analysis, standards awareness, security consciousness, and architecture comprehension.

### Q: Why does R&D tax relief require competence evidence?

R&D tax relief schemes (HMRC, CIR, Forschungszulage, I+D+i) require evidence that qualifying work was carried out by competent professionals exercising judgement in the face of technical uncertainty. Traditional evidence relies on formal qualifications. Session capture provides behavioural evidence from actual development activity, which is more defensible and does not exclude self-taught engineers.

### Q: Is session capture mandatory?

No. Session capture is always optional and requires explicit consent from each individual developer. No recording occurs without consent. Developers can opt out at any time.

---

## For Development Contributors

### Q: How does CRANIS2 affect my daily work as a developer?

CRANIS2 connects to your repositories and analyses your development activity to build compliance and R&D evidence. It does not require you to change how you work. Your commits, branches, and pull requests generate evidence automatically. You may also use the MCP server to query compliance data from your IDE, or integrate the CI/CD compliance gate into your deployment pipeline.

### Q: Will my commits be analysed?

If your product owner has enabled the Software Evidence Engine, your commits will be analysed for metadata: author, date, message, additions/deletions. The commit message is classified into one of nine categories (feature, fix, refactor, test, documentation, build, style, experiment, chore). Developer attribution is calculated as contribution percentages. Your source code is never stored.

### Q: Is developer attribution a performance metric?

No. Developer attribution measures evidence coverage for R&D tax credit claims, not individual performance. It shows which developers contributed to which aspects of the codebase, supporting the "competent professional" requirement for R&D tax relief. It is not used for ranking, evaluation, or comparison.

### Q: Can I query compliance data from my IDE?

Yes. The MCP server exposes five tools to IDE AI assistants (VS Code, Cursor, Claude Desktop, Claude Code): list products, get vulnerabilities, get mitigation commands, verify fixes, and check compliance status. Setup instructions are available in the `mcp/README.md` file and on the Integrations page within the platform.

### Q: How does the CI/CD compliance gate work?

The compliance gate is a pipeline step that queries the CRANIS2 Public API and fails the build if open critical or high vulnerability findings exist for the product. Ready-made snippets are provided for GitHub Actions, GitLab CI, and generic bash scripts. See the User Guide, Section 34: CI/CD Compliance Gate.

### Q: Can I opt out of session capture?

Yes. Session capture always requires explicit consent from each individual developer. No recording occurs without your consent. You can opt out at any time, and existing session data does not affect your ability to continue contributing.

---

*For detailed guidance on any topic covered in this FAQ, refer to the [CRANIS2 User Guide](USER-GUIDE.md).*

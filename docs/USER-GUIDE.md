# CRANIS2 User Guide

**Document Version:** 3.0
**Last Updated:** 2026-03-14
**Covers:** Sections 1–40 plus Appendices A–E

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Regulatory Context](#2-regulatory-context)
3. [Getting Started](#3-getting-started)
4. [Navigating the Platform](#4-navigating-the-platform)
5. [Products](#5-products)
6. [Compliance Timeline](#6-compliance-timeline)
7. [Escrow](#7-escrow)
8. [Obligations Tracking](#8-obligations-tracking)
9. [Technical Files](#9-technical-files)
10. [ENISA Reporting](#10-enisa-reporting)
11. [Licence Compliance](#11-licence-compliance)
12. [IP Proof](#12-ip-proof)
13. [Due Diligence Export](#13-due-diligence-export)
14. [Repository Management](#14-repository-management)
15. [Contributors](#15-contributors)
16. [Dependencies](#16-dependencies)
17. [Risk Findings (Vulnerability Management)](#17-risk-findings-vulnerability-management)
18. [Billing](#18-billing)
19. [Marketplace](#19-marketplace)
20. [Stakeholders](#20-stakeholders)
21. [Organisation Management](#21-organisation-management)
22. [Audit Log](#22-audit-log)
23. [Feedback System](#23-feedback-system)
24. [Platform Administration](#24-platform-administration)
25. [Automated Background Processes](#25-automated-background-processes)
26. [AI Copilot](#26-ai-copilot)
27. [AI Auto-Triage](#27-ai-auto-triage)
28. [AI Risk Assessment](#28-ai-risk-assessment)
29. [AI Incident Report Drafter](#29-ai-incident-report-drafter)
30. [CRA Category Recommender](#30-cra-category-recommender)
31. [Supplier Due Diligence](#31-supplier-due-diligence)
32. [Compliance Gap Narrator](#32-compliance-gap-narrator)
33. [Public API & API Keys](#33-public-api--api-keys)
34. [CI/CD Compliance Gate](#34-cicd-compliance-gate)
35. [Integrations (Trello, MCP, IDE)](#35-integrations-trello-mcp-ide)
36. [Copilot Usage & Cost Protection](#36-copilot-usage--cost-protection)
37. [Post-Market Monitoring & Field Issues](#37-post-market-monitoring--field-issues)
38. [Cryptographic Standards Inventory](#38-cryptographic-standards-inventory)
39. [Conformity Assessments](#39-conformity-assessments)
40. [GRC/OSCAL Bridge](#40-grcooscal-bridge)
- [Appendix A: CRA Product Categories](#appendix-a-cra-product-categories)
- [Appendix B: Supported Repository Providers](#appendix-b-supported-repository-providers)
- [Appendix C: Supported Lockfile Formats](#appendix-c-supported-lockfile-formats)
- [Appendix D: Supported Languages for Import Scanning](#appendix-d-supported-languages-for-import-scanning)
- [Appendix E: SBOM Export Formats](#appendix-e-sbom-export-formats)

---

## 1. Introduction

### What Is CRANIS2?

CRANIS2 is a compliance platform that helps software companies meet the requirements of two major pieces of EU legislation: the **Cyber Resilience Act (CRA)** and the **NIS2 Directive**.

It connects to your existing source code repositories and automatically builds the compliance evidence that regulators expect to see. CRANIS2 reads dependency metadata from your repositories but never stores, analyses or modifies your source code. The platform automates a comprehensive set of compliance functions: SBOM management, vulnerability monitoring, licence compliance, intellectual property proof, CRA technical documentation, ENISA reporting, source code escrow, post-market monitoring with field issue tracking, cryptographic standards inventory with PQC readiness, compliance evidence vault, document templates, conformity assessments, AI-powered compliance intelligence, supplier due diligence, GRC/OSCAL bridge, and external integrations.

### Who This Guide Is For

This guide is written for four audiences:

- **Organisation Admins** – Users who set up and manage their company's CRANIS2 account, configure products, and oversee compliance activities.
- **Organisation Members** – Team members who work within the platform: reviewing findings, updating technical files, filing reports.
- **Platform Admins** – Users with platform-level access who manage organisations, monitor system health, and administer the vulnerability database. Platform admin functions are covered in the second half of this guide.
- **Evaluators and Auditors** – Individuals assessing whether CRANIS2 meets their organisation's compliance needs, or reviewing the compliance evidence it produces.

### Key Terminology

| Term | Meaning |
|------|---------|
| **CRA** | Cyber Resilience Act – EU regulation requiring cybersecurity standards for products with digital elements, effective December 2024 |
| **NIS2** | Network and Information Security Directive (2022/2555) – EU directive strengthening cybersecurity obligations for essential and important entities |
| **SBOM** | Software Bill of Materials – a machine-readable inventory of all software components in a product |
| **ENISA** | European Union Agency for Cybersecurity – the EU body that coordinates vulnerability and incident reporting under the CRA |
| **CSIRT** | Computer Security Incident Response Team – national cybersecurity body in each EU member state |
| **CE Mark** | Conformite Europeenne – the marking required to legally sell products in the EU single market |
| **CycloneDX** | An OWASP standard format for SBOMs, supported by CRANIS2 in version 1.6 |
| **SPDX** | Software Package Data Exchange – a Linux Foundation standard format for SBOMs, supported by CRANIS2 in version 2.3 |
| **RFC 3161** | Internet standard for trusted timestamping, used by CRANIS2 to create legally admissible proof of content at a point in time |
| **TLP** | Traffic Light Protocol – a classification system (WHITE, GREEN, AMBER, RED) for controlling information sensitivity in vulnerability reports |
| **Copyleft** | A category of open-source licence (GPL, LGPL, AGPL, MPL) that requires derivative works to be distributed under the same or compatible terms |
| **Permissive** | A category of open-source licence (MIT, Apache-2.0, BSD, ISC) that allows unrestricted use including in proprietary products |
| **PURL** | Package URL – a standardised scheme for identifying software packages across ecosystems (e.g. `pkg:npm/express@4.18.2`) |
| **CVE** | Common Vulnerabilities and Exposures – a unique identifier assigned to publicly disclosed security vulnerabilities |
| **CVSS** | Common Vulnerability Scoring System – a numerical scale (0.0–10.0) rating the severity of a vulnerability |
| **OSV** | Open Source Vulnerabilities – a distributed vulnerability database covering all major ecosystems, used by CRANIS2 |
| **NVD** | National Vulnerability Database – the US government repository of CVE data, used by CRANIS2 alongside OSV |

---

## 2. Regulatory Context

### The Cyber Resilience Act (CRA)

The CRA entered into force in December 2024 and applies to any product with digital elements placed on the EU single market. It imposes cybersecurity requirements across the entire product lifecycle, from design through end-of-support.

**Who it applies to:**

- **Manufacturers** – any company that designs, develops or produces a product with digital elements, or has one designed and produced on their behalf. This is the broadest category and includes most software product companies.
- **Importers** – companies that bring products from outside the EU into the EU market.
- **Distributors** – companies that make products available on the EU market without affecting their properties (resellers, channel partners).
- **Open Source Stewards** – organisations that systematically provide support for open-source products intended for commercial use.

**Penalties for non-compliance:**

- Up to EUR 15 million or 2.5% of worldwide annual turnover (whichever is higher) for core requirement violations
- Up to EUR 10 million or 2% of turnover for other obligations
- Products that do not comply cannot carry a CE mark and cannot legally be sold in the EU

**Timeline:**

| Milestone | Date |
|-----------|------|
| CRA enters into force | December 2024 |
| Reporting obligations begin (Article 14) | **September 2026** |
| Full compliance required | **December 2027** |

### Product Categories

The CRA classifies products into three categories based on their cybersecurity risk level. The category determines the conformity assessment procedure required:

| Category | Assessment | Description | Examples |
|----------|-----------|-------------|----------|
| **Default** | Self-assessment | The vast majority of products. Manufacturers can self-certify compliance. | Most SaaS products, internal tools, business applications |
| **Class I (Important)** | Third-party audit or harmonised standard | Products that present a higher cybersecurity risk. Manufacturers must either apply a harmonised standard or undergo third-party assessment. | Identity management, VPNs, network management tools, firewalls, intrusion detection systems |
| **Class II (Critical)** | EU-level certification | Products considered critical to EU cybersecurity. Mandatory third-party assessment required. | Operating systems, hypervisors, HSMs, smartcard readers, industrial control systems |

CRANIS2 lets you assign a CRA category to each product (see [Section 5: Products](#5-products)), which informs the compliance workflow and obligations tracking.

### NIS2 Directive

The NIS2 Directive (2022/2555) is the EU's framework for network and information security. While the CRA focuses on product security, NIS2 focuses on organisational security, particularly for entities operating critical infrastructure.

NIS2 distinguishes between:

- **Essential entities** – energy, transport, banking, health, water, digital infrastructure, ICT service management, public administration, space
- **Important entities** – postal services, waste management, chemicals, food, manufacturing, digital providers, research

The relationship between CRA and NIS2 is complementary. If your organisation falls under NIS2 and you manufacture software products, both sets of obligations apply. CRANIS2 tracks obligations from both frameworks.

### CRA Annex VII: Technical File

The CRA requires manufacturers to maintain a technical file for every product. This file must be available on request to market surveillance authorities. Annex VII defines eight sections:

1. Product Description (Section 1)
2. Design and Development processes (Section 2a)
3. Vulnerability Handling processes (Section 2b)
4. Risk Assessment (Section 2c)
5. Support Period declaration (Section 3)
6. Standards Applied (Section 4)
7. Test Reports (Section 5)
8. Declaration of Conformity (Section 6)

CRANIS2 provides structured editors for all eight sections. See [Section 9: Technical Files](#9-technical-files) for details.

### CRA Annex I: Essential Cybersecurity Requirements

Annex I Part I lists 13 essential cybersecurity requirements that products must meet. These are labelled (a) through (m) and cover:

- **(a)** Products designed with appropriate cybersecurity, including reduced attack surfaces
- **(b)** No known exploitable vulnerabilities at time of placing on market
- **(c)** Secure by default configuration
- **(d)** Protection against unauthorised access, including authentication and identity management
- **(e)** Protection of confidentiality of data (encryption at rest and in transit)
- **(f)** Protection of integrity of data and commands
- **(g)** Processing of only necessary data (data minimisation)
- **(h)** Protection of availability, including resilience against denial-of-service
- **(i)** Minimised negative impact on other devices and networks
- **(j)** Designed to reduce the impact of security incidents
- **(k)** Ability to record and monitor relevant internal activity (security logging)
- **(l)** Ability for users to securely remove all data and settings
- **(m)** Security update mechanism that allows timely and automatic patching

CRANIS2 includes a checklist for all 13 requirements within the Technical File, where each can be marked applicable or not-applicable with supporting evidence. See [Section 9: Technical Files](#9-technical-files).

### CRA Article 14: Mandatory ENISA Reporting

Article 14 introduces mandatory reporting obligations for manufacturers. When a manufacturer becomes aware of an actively exploited vulnerability or a severe security incident affecting one of their products, they must notify both their national CSIRT and ENISA on a strict timeline:

| Stage | Deadline | Content |
|-------|----------|---------|
| **Early Warning** | 24 hours after awareness | Summary of the issue, initial assessment, whether malicious action is suspected |
| **Notification** | 72 hours after awareness | Detailed vulnerability or incident description, corrective measures, patch status |
| **Final Report** | 14 days (vulnerability) or 1 month (incident) | Root cause analysis, severity assessment, preventive measures, user notification status |

These deadlines are legally binding from September 2026. CRANIS2 automates deadline tracking and provides structured forms for each stage. See [Section 10: ENISA Reporting](#10-enisa-reporting).

---

## 3. Getting Started

### Creating an Account

Navigate to `/signup` to create a new account. You will need:

- A valid email address (this becomes your login)
- A password meeting all five strength criteria:
  - At least 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character

A strength meter on the signup form shows your progress against these criteria in real time.

### Email Verification

After signing up, you will receive a verification email from `info@poste.cranis2.com`. Check your spam or junk folder if it does not arrive within a few minutes.

Click the verification link in the email to activate your account. Until your email is verified, you will not be able to access the platform.

### Welcome Page

After email verification and first login, you are directed to a Welcome page that introduces the platform and guides you to set up your organisation.

### Organisation Setup

Before you can use CRANIS2, you need to create an organisation. The setup wizard collects:

| Field | Options | Required |
|-------|---------|----------|
| Organisation name | Free text | Yes |
| Country | Country selector | Yes |
| Company size | Micro (< 10), Small (10–49), Medium (50–249), Large (250+) | Yes |
| CRA role | Manufacturer, Importer, Distributor, Open Source Steward | Yes |
| Industry | Free text | No |

Your CRA role determines which obligations are tracked and how compliance workflows behave. Most software companies will select **Manufacturer**.

Once the organisation is created, you are assigned the **admin** role within it. You can invite additional team members later (see Stakeholders in the second half of this guide).

### First Dashboard View

After setup, the Dashboard provides a high-level summary of your compliance posture:

- **Products** – how many products are registered and their sync status
- **Vulnerabilities** – open findings across your portfolio
- **Compliance** – obligation completion percentage
- **SBOM** – dependency counts and freshness

These cards are connected to live data and update as you add products and connect repositories.

---

## 4. Navigating the Platform

### Sidebar Navigation

The sidebar uses an accordion pattern; only one section can be expanded at a time. Clicking a section header collapses the previously open section and expands the new one.

The sidebar is organised into five groups:

| Group | Pages |
|-------|-------|
| **Dashboard** | Dashboard |
| **Compliance** | Products, Obligations, Technical Files, Vulnerability Reports, Licence Compliance, IP Proof, Due Diligence |
| **Source Code** | Repos, Contributors, Dependencies, Risk Findings |
| **Billing** | Plans & Usage, Reports |
| **Settings** | Organisation, Stakeholders, Audit Log, Marketplace |

A **Feedback** button sits at the bottom of the sidebar, outside the accordion. It opens a modal where you can submit bug reports, feature requests, or general feedback. Each submission is categorised (`bug`, `feature`, or `feedback`) and includes the page URL where you submitted it.

### Common UI Patterns

Throughout the platform, you will encounter several consistent UI elements:

- **StatCards** – coloured summary cards at the top of most pages showing key metrics (e.g. "Open Vulnerabilities: 3"). Colours indicate severity: green (healthy), amber (attention needed), red (action required), blue (informational).
- **PageHeaders** – the title bar at the top of every page, sometimes with a timestamp or subtitle.
- **Inline editing** – many fields (obligation statuses, technical file sections, stakeholder details) can be edited directly on the page without navigating to a separate form.
- **Filter bars** – tables across the platform support filtering by status, product, type, and other relevant criteria.

### Notifications

The Notifications page (`/notifications`) is your inbox for platform alerts. Notifications are generated automatically for events such as:

- New vulnerability findings from a scan
- Approaching or overdue ENISA reporting deadlines
- Repository sync status changes (stale SBOM detected)
- Billing events (trial expiry warnings, payment issues)

Notifications have five severity levels: **critical**, **high**, **medium**, **low**, and **info**. You can filter by severity and type, and mark notifications as read. A badge on the sidebar shows the count of unread notifications.

### URL Aliases

For convenience, CRANIS2 supports several alternative URLs that redirect to the canonical routes:

| Alias | Redirects To |
|-------|-------------|
| `/cra-reports` | `/vulnerability-reports` |
| `/vulnerabilities` | `/vulnerability-reports` |
| `/license-scan` | `/license-compliance` |
| `/sbom-export` | `/products` |
| `/escrow` | `/products` |
| `/settings` | `/organisation` |

---

## 5. Products

### Products Page

The Products page (`/products`) lists all products registered to your organisation. From here you can:

- View all products with their CRA category, type, and sync status
- Create a new product
- Navigate to any product's detail page

### Creating a Product

To create a product, click the create button on the Products page. You will need to provide:

| Field | Description | Required |
|-------|-------------|----------|
| Name | The product name as it appears in compliance documentation | Yes |
| Description | A brief description of the product's purpose | No |
| Version | The current product version | No |
| Product type | The type of software product (see below) | Yes |
| CRA category | Default, Class I (Important), or Class II (Critical) | Yes |
| Repository URL | The URL of the product's source code repository | No |
| Distribution model | How the product is distributed (see below) | No |

### CRA Categories

- **Default** – Self-assessment. The manufacturer performs their own conformity assessment. This applies to the majority of software products.
- **Class I (Important)** – Products with higher cybersecurity significance. Requires application of a harmonised standard or third-party assessment. Examples: identity management systems, VPNs, firewalls.
- **Class II (Critical)** – Products considered critical to EU cybersecurity. Mandatory third-party assessment by an EU-notified body. Examples: operating systems, hypervisors, hardware security modules.

### Product Types

| Type | Description |
|------|-------------|
| Firmware | Software embedded in hardware devices |
| SaaS | Software as a Service – cloud-hosted application |
| Library | A reusable software library or framework |
| Desktop App | Application installed on desktop operating systems |
| Mobile App | Application installed on mobile devices |
| IoT | Software for Internet of Things devices |
| Embedded | Software for embedded systems |
| Other | Products that do not fit the above categories |

### Distribution Models

The distribution model affects licence compatibility analysis (see [Section 11: Licence Compliance](#11-licence-compliance)):

| Model | Description |
|-------|-------------|
| `proprietary_binary` | Distributed as compiled binary without source code |
| `saas_hosted` | Hosted as a service – users do not receive a copy |
| `source_available` | Source code is available but under restrictive terms |
| `library_component` | Distributed as a library for integration by others |
| `internal_only` | Used internally, not distributed to third parties |

### Product Detail Page

Clicking on a product opens the detail page (`/products/:productId`), which has seven tabs:

**Overview** – The landing tab. Shows:
- Repository card with connection status and provider
- SBOM summary: package count, source tier (API / Lockfile / Import Scan), last sync time, staleness indicator
- Technical file progress (X of 8 sections complete)
- Version history using the CRANIS2 auto-versioning format (`YYYY.MM.DD.NNNN`) alongside any Git tags from the repository

**Obligations** – Per-product CRA obligations with inline status editing. Each obligation can be set to Not Started, In Progress, or Met. See [Section 8: Obligations Tracking](#8-obligations-tracking).

**Technical File** – The eight Annex VII sections with content editors, plus the Annex I checklist. See [Section 9: Technical Files](#9-technical-files).

**Risk Findings** – Vulnerability findings specific to this product, with severity, affected dependency, and triage controls. Findings can be triaged as open, mitigated, or closed.

**Dependencies** – The full SBOM package list for this product. Each dependency shows its name, version, ecosystem (npm, PyPI, crates.io, etc.), licence, and whether it is a direct or transitive dependency.

**Field Issues** – Post-market monitoring for field-reported security issues. Tracks issues through a full lifecycle with corrective action management. See [Section 37: Post-Market Monitoring & Field Issues](#37-post-market-monitoring--field-issues).

**Crypto Inventory** – Cryptographic algorithm usage detected in your dependency tree, classified by quantum readiness. See [Section 38: Cryptographic Standards Inventory](#38-cryptographic-standards-inventory).

### Editing and Deleting Products

Product details (name, description, version, type, category, distribution model) can be edited from the product detail page.

When deleting a product, CRANIS2 generates a **data exit package**, a ZIP file containing all compliance data associated with that product (SBOM, findings, technical file content, reports). This ensures you retain your compliance evidence even after removing the product from the platform.

If the product had escrow enabled, the Forgejo repository is preserved even after deletion, in accordance with legal retention requirements.

---

## 6. Compliance Timeline

### Overview

Each product has a historical compliance timeline accessible at `/products/:productId/timeline`.

The timeline provides a chronological view of all compliance-significant events for that product, including:

- Vulnerability scan results (when scans ran, what was found)
- Licence scan events
- Obligation status changes
- ENISA report submissions
- Technical file updates
- SBOM sync events

### Visualising Compliance Progress

The timeline displays events as a chart, allowing you to see how your compliance posture has evolved over time. This is particularly valuable for:

- Demonstrating continuous improvement to auditors
- Identifying periods where compliance attention may have lapsed
- Correlating vulnerability discoveries with remediation actions
- Preparing evidence for market surveillance authority requests

---

## 7. Escrow

### What Is Source Code Escrow?

Source code escrow is a business continuity mechanism. A copy of your product's source code is deposited with a trusted third party, with agreed conditions under which it may be released to designated beneficiaries. This protects your customers: if your company ceases to operate, they are not left without access to the software they depend on.

For B2B software vendors, escrow is increasingly a procurement requirement. It provides a tangible trust signal during sales conversations.

### How CRANIS2 Implements Escrow

CRANIS2 uses a self-hosted **Forgejo** instance (a lightweight, open-source Git forge) for escrow deposits. Forgejo runs within the CRANIS2 infrastructure and is hosted in Switzerland, ensuring European data sovereignty.

Key characteristics:

- Escrow is **opt-in** and configured per product
- Source code is deposited as a mirror of your repository
- **Daily automated deposits** run at 5 AM UTC, keeping the escrow always current
- The Forgejo instance is separate from your production repository. It is a deposit, not a replacement
- Deposits are preserved even after product deletion (legal retention)

### Configuring Escrow

To configure escrow for a product, navigate to `/products/:productId/escrow`. From this page you can:

- Enable or disable escrow for the product
- Choose which artefact types to include in deposits:

| Artifact Type | Description |
|---------------|-------------|
| SBOM (CycloneDX/SPDX) | The product's software bill of materials |
| Vulnerability reports | Current vulnerability scan findings |
| Licence audit | Licence compliance scan results |
| IP proof | RFC 3161 timestamp snapshots |
| CRA documentation | Technical file content and obligation status |
| Compliance timeline | Historical compliance event data |

### Release Models

You control what happens to the escrow deposit if it needs to be released:

- **Open source** – the source code is published publicly
- **Designated recipients** – specific clients you name receive private copies

### What Happens on Product Deletion

When you delete a product from CRANIS2, the Forgejo escrow repository is **not** deleted. It is preserved under legal retention policy. The data exit ZIP you receive on deletion (see [Section 5: Products](#5-products)) includes references to the preserved escrow repository.

---

## 8. Obligations Tracking

### Cross-Product Overview

The Obligations page (`/obligations`) provides a cross-product view of all CRA and NIS2 obligations across your organisation. This is the place to get a portfolio-level understanding of where you stand.

### What Are CRA Obligations?

The CRA defines a set of obligations that apply to manufacturers, importers and distributors of products with digital elements. These cover areas including:

- Product security requirements (Annex I)
- Vulnerability handling processes (Article 13)
- Security update provision (Article 13)
- SBOM maintenance (Article 13)
- Technical documentation (Article 13, Annex VII)
- Conformity assessment (Articles 24–28)
- CE marking (Article 22)
- Reporting to authorities (Article 14)
- Cooperation with market surveillance (Article 43)
- Incident and vulnerability coordination (Article 15)

CRANIS2 tracks **35 obligations in total**, split across three operator roles: 19 for manufacturers (Articles 13, 14, 16, 20, 32, and Annexes), 10 for importers (Article 18), and 6 for distributors (Article 19). The specific obligations shown for each product are determined by its CRA category and the organisation's CRA role.

### Obligation Statuses

Each obligation has one of three statuses:

| Status | Meaning |
|--------|---------|
| **Not Started** | Work has not begun on this obligation |
| **In Progress** | The obligation is being addressed but is not yet fully met |
| **Met** | The obligation has been satisfied, with supporting evidence in place |

### Working with Obligations

- **Inline editing** – Change any obligation's status directly from the table by clicking the status indicator.
- **Per-product view** – Obligations also appear on the product detail page under the Obligations tab, where you can manage them in the context of a specific product.
- **Filtering** – The overview page supports filtering by product and by status, so you can quickly identify which obligations still need attention.

---

## 9. Technical Files

### Cross-Product Dashboard

The Technical Files page (`/technical-files`) shows a dashboard of all products with their technical file completion status. Each product displays a progress indicator (e.g. 5/8 sections complete), allowing you to prioritise which products need documentation attention.

### The Eight Annex VII Sections

Each product has a technical file with eight sections, corresponding to the requirements of CRA Annex VII:

| # | Section | CRA Reference | What to Document |
|---|---------|--------------|------------------|
| 1 | Product Description | Annex VII S1 | General description of the product, its intended purpose, hardware/software versions, and how it is delivered to users |
| 2 | Design & Development | Annex VII S2a | Description of the design and development process, including security-by-design practices, development tools, and testing methodologies |
| 3 | Vulnerability Handling | Annex VII S2b | The processes for identifying, documenting, and addressing vulnerabilities, including your coordinated disclosure policy |
| 4 | Risk Assessment | Annex VII S2c | Cybersecurity risk assessment covering threats, attack surfaces, and mitigations for each of the 13 Annex I requirements |
| 5 | Support Period | Annex VII S3 | Declaration of the expected product lifetime and the period during which security updates will be provided |
| 6 | Standards Applied | Annex VII S4 | List of harmonised standards, common specifications, or cybersecurity certification schemes applied |
| 7 | Test Reports | Annex VII S5 | Evidence that the product has been tested against the applicable essential requirements, including test methodology and results |
| 8 | Declaration of Conformity | Annex VII S6 | The formal EU Declaration of Conformity, or a reference to where it can be found |

### Section Editors

Each section provides:

- A **content** editor where you write the substantive documentation
- A **notes** field for internal annotations (not included in exports)
- A **status** indicator: Not Started, In Progress, or Complete

The CRA reference for each section is displayed alongside the editor, so you can see exactly which regulatory requirement you are addressing.

### Annex I Part I Checklist

Within the Technical File tab, you also find the **Annex I Part I checklist**, the 13 essential cybersecurity requirements labelled (a) through (m) (see [Section 2: Regulatory Context](#2-regulatory-context) for the full list).

For each requirement, you can:

- Mark it as **applicable** or **not applicable** to your product
- Provide **evidence** of how the requirement is met (free text)

This checklist is separate from the eight documentation sections and represents the substantive security requirements rather than the documentation structure.

### Progress Tracking

The Technical Files overview page shows completion as X/8 sections complete for each product. A section counts as complete when its status is set to "Complete." This gives you a clear picture of documentation progress across your entire product portfolio.

---

## 10. ENISA Reporting

### When to File a Report

Under CRA Article 14, you must file an ENISA report when you become aware of either:

- An **actively exploited vulnerability** in one of your products, meaning a vulnerability that is being used in real attacks
- A **severe security incident** that has a significant impact on the security of a product with digital elements

If in doubt, err on the side of filing. Late reporting carries regulatory consequences; over-reporting does not.

### Creating a Report

Navigate to `/vulnerability-reports` and click **New Report**. The creation form collects:

| Field | Description |
|-------|-------------|
| Product | Select the affected product from your portfolio |
| Report type | **Actively Exploited Vulnerability** or **Severe Incident** |
| Awareness date/time | When you first became aware of the issue. This starts the deadline clock |

Additional fields can be set after creation:

| Field | Description |
|-------|-------------|
| CSIRT country | The EU member state whose CSIRT should receive the report (EU27 dropdown) |
| Member states affected | Multi-select of all EU member states where the impact is felt |
| TLP classification | Traffic Light Protocol level: WHITE, GREEN, AMBER, or RED |
| ENISA reference | An external reference number for cross-referencing with ENISA |

### The Three-Stage Timeline

Once a report is created with an awareness date, CRANIS2 automatically calculates three deadlines:

| Stage | Deadline | What to Include |
|-------|----------|-----------------|
| **Early Warning** | 24 hours after awareness | Summary of the issue, whether malicious action is suspected, initial assessment of affected member states |
| **Notification** | 72 hours after awareness | Detailed description of the vulnerability or incident, nature of the exploit, corrective measures taken or planned, patch status, affected components |
| **Final Report** | 14 days (vulnerability) or 1 month (incident) | Root cause analysis, severity assessment, information on malicious actors (if applicable), security updates issued, preventive measures, user notification status |

Each stage has a structured form with fields appropriate to that stage and report type. The report detail page shows the timeline visually, with submitted stages marked as complete and upcoming deadlines displayed as countdowns.

### Submitting Stages

Navigate to the report detail page (`/vulnerability-reports/:id`). The platform automatically opens the form for the next required stage. Fill in the stage form and submit it. Once submitted, the report status advances:

| After Submitting | Report Status Becomes |
|------------------|-----------------------|
| Early Warning | `early_warning_sent` |
| Notification | `notification_sent` |
| Final Report | `final_report_sent` |

**Intermediate updates** can be submitted at any stage of the process for progress reporting between the three main stages.

### Deadline Tracking

CRANIS2 monitors ENISA reporting deadlines hourly. Notifications are generated at escalating intervals:

- 12 hours before a deadline
- 4 hours before a deadline
- 1 hour before a deadline
- When a deadline becomes overdue

The ENISA Reporting overview page displays stat cards showing active reports, overdue count, next deadline countdown, and reports filed this month.

### Closing a Report and Post-Close Addenda

When all stages are complete and the issue is resolved, you can close a report. Closing marks it as resolved.

Post-close addenda are allowed. You can submit additional intermediate stages even after a report has been closed, in case new information emerges.

### Creating a Report from a Risk Finding

If a vulnerability finding from a scan turns out to be actively exploited, you can create an ENISA report directly from the Risk Findings page. The report will be pre-populated with details from the finding (affected dependency, severity, CVSS score, description), saving you from re-entering information.

---

## 11. Licence Compliance

### Overview

The Licence Compliance page (`/license-compliance`) provides a cross-product view of the open-source licences in your dependency tree and their compatibility with your distribution model.

### Licence Categories

CRANIS2 classifies every dependency's licence into one of three categories:

| Category | Licences | Implications |
|----------|---------|-------------|
| **Permissive** | MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, Unlicense | No restrictions on distribution. Compatible with all distribution models. |
| **Copyleft** | GPL-2.0, GPL-3.0, LGPL-2.1, LGPL-3.0, AGPL-3.0, MPL-2.0, SSPL-1.0 | Requires derivative works to be distributed under the same or compatible terms. Impact depends on distribution model and linking method. |
| **Unknown / NOASSERTION** | No licence declared, unrecognised licence identifier | Requires manual review. Dependencies with no declared licence may carry legal risk. |

### Distribution Model Impact

Your product's distribution model (set when creating or editing a product; see [Section 5: Products](#5-products)) directly affects which licences are compatible. For example:

- A **proprietary binary** distribution is incompatible with GPL-licensed dependencies unless the dependency is dynamically linked (LGPL exception)
- A **SaaS-hosted** product triggers network copyleft obligations under AGPL and SSPL
- An **internal-only** product generally has no distribution-related licence obligations
- A **library component** must consider the downstream consumer's distribution model

### Compatibility Matrix

CRANIS2 includes a rules engine that evaluates every dependency's licence against your product's distribution model and produces a verdict:

| Verdict | Meaning |
|---------|---------|
| **Compatible** | The licence is fully compatible with your distribution model |
| **Incompatible** | The licence conflicts with your distribution model – action required |
| **Review Needed** | The compatibility is ambiguous or context-dependent – manual review recommended |

### Cross-Licence Conflicts

The compatibility engine also detects **14 known cross-licence incompatibilities** based on FSF guidance. These are cases where two licences in the same dependency tree conflict with each other (e.g. GPL-2.0-only and Apache-2.0 in some configurations).

### Network Copyleft Detection

For SaaS products, CRANIS2 specifically checks for AGPL and SSPL licences. These "network copyleft" licences extend copyleft obligations to software accessed over a network, not just software that is distributed as a copy. If your product is distributed as `saas_hosted` and includes an AGPL dependency, it will be flagged.

### Waivers

In some cases, you may determine that a licence finding does not actually apply to your situation (for example, a test-only dependency that is not included in the distributed product). You can **waive** a finding and record your reasoning. Waived findings are retained in the audit trail but excluded from active compliance counts.

### Rechecking After Changes

If you change a product's distribution model, the licence compatibility verdicts may change. Use the recheck function to re-evaluate all findings against the new distribution model without triggering a full SBOM resync.

A per-product scan trigger is also available to run a fresh licence scan on demand.

---

## 12. IP Proof

### What Is IP Proof?

IP Proof is CRANIS2's implementation of cryptographic timestamping for compliance evidence. It creates independently verifiable proof that a specific set of data existed at a specific point in time.

This serves several purposes:

- **Prior art** – proving your software composition predates a competitor's patent claim
- **Compliance evidence** – demonstrating that your SBOM or compliance state existed as of a particular date
- **Escrow verification** – confirming the integrity of deposited materials

### How RFC 3161 Works

RFC 3161 defines a protocol for trusted timestamping. In simple terms:

1. CRANIS2 generates a SHA-256 hash of your product's composition data (the dependency graph, not your source code)
2. This hash is sent to a **Time Stamping Authority (TSA)**, an independent, trusted third party
3. The TSA signs the hash together with the current time, creating a **timestamp token**
4. The token is stored in CRANIS2 and can be independently verified by anyone

The TSA used by CRANIS2 is **FreeTSA.org**. The resulting timestamp is recognised under the EU eIDAS Regulation (910/2014) as legally admissible evidence.

The TSA never sees your source code or even your dependency data. It only receives a cryptographic hash. The hash alone reveals nothing about the content it was derived from.

### Viewing IP Proof Snapshots

The IP Proof page (`/ip-proof`) shows all timestamped snapshots for your products. Each snapshot displays:

- **Content hash** – the SHA-256 hash that was timestamped
- **Verification status** – whether the timestamp token has been validated
- **Creation date** – when the snapshot was created

### Automatic Creation

IP proof snapshots are created automatically after every SBOM sync. The nightly SBOM auto-sync at 2 AM triggers a licence scan, and the licence scan triggers IP proof creation. This means your IP proof stays current without any manual action.

---

## 13. Due Diligence Export

### Overview

The Due Diligence page (`/due-diligence`) lets you generate a comprehensive, investor-ready compliance package for any of your products. This is designed for scenarios where you need to demonstrate your compliance posture to a third party: during fundraising, acquisition due diligence, customer procurement, or regulatory inspection.

### Preview Before Export

Select a product from the dropdown to see a preview of the report contents. The preview includes:

- **Summary stat cards** – total dependencies (direct and transitive), permissive licence percentage, open vulnerability count, and CRA compliance progress
- **Report contents** – descriptions of each file that will be included in the export
- **Non-permissive dependencies table** – a preview of dependencies with copyleft or unknown licences (up to 20 shown, full list in the export)
- **CRA obligations summary** – a visual overview of obligation statuses (Met, In Progress, Not Started)

### Export Contents

Clicking **Download Due Diligence Package** generates a ZIP file containing:

| File | Format | Description |
|------|--------|-------------|
| Due Diligence Report | Markdown | Executive summary covering product details, dependency inventory, licence compliance posture, vulnerability assessment, IP proof status, and CRA compliance progress |
| Software Bill of Materials | CycloneDX 1.6 JSON | Machine-readable dependency inventory with package hashes, licences, and supplier data |
| Licence Findings | CSV | Complete list of dependencies with their licences, categories, risk levels, compatibility verdicts, and waiver status |
| Vulnerability Summary | JSON | All vulnerability findings with severities, affected packages, CVE identifiers, and fix versions |
| Full Licence Texts | Text files | Complete licence text for each non-permissive licence found in the dependency tree |

The ZIP filename follows the pattern `due-diligence-{product-name}-{date}.zip`.

### When to Use Due Diligence Export

Common scenarios include:

- **Investor due diligence** – providing evidence of software governance and compliance readiness during fundraising
- **Customer procurement** – responding to supply chain security questionnaires with concrete data rather than self-declarations
- **Regulatory inspection** – having a ready-to-share compliance package if a market surveillance authority requests documentation
- **Internal audit** – periodic review of compliance status by your own governance team
- **Insurance applications** – demonstrating cybersecurity maturity for cyber insurance underwriting

---

## 14. Repository Management

### The Repos Page

The Repos page (`/repos`) provides a cross-product overview of all connected source code repositories across your organisation. At the top, stat cards summarise:

- **Connected Repos** – the total number of repositories linked to products
- **Stars** – aggregated star count across all connected repositories
- **Forks** – aggregated fork count
- **Open Issues** – total open issues across all repositories
- **Contributors** – total unique contributors
- **Stale SBOMs** – repositories where the SBOM is out of date (a push event has been received since the last sync)

### Supported Providers

CRANIS2 supports five repository providers. The authentication method depends on the provider:

| Provider | Auth Method | Hosting |
|----------|-------------|---------|
| **GitHub** | OAuth (popup flow) | github.com |
| **Codeberg** | OAuth (popup flow) | codeberg.org |
| **Gitea** | Personal Access Token (PAT) | Self-hosted instances |
| **Forgejo** | Personal Access Token (PAT) | Self-hosted instances |
| **GitLab** | Personal Access Token (PAT) | Self-hosted instances |

### Connecting via OAuth (GitHub, Codeberg)

For GitHub and Codeberg, authentication uses an OAuth popup flow:

1. Navigate to the product detail page and click **Connect Repository**
2. Select GitHub or Codeberg as the provider
3. A popup window opens where you authorise CRANIS2 to access your repositories
4. Once authorised, select the repository from the list
5. The connection is established and the first SBOM sync begins automatically

### Connecting via PAT (Gitea, Forgejo, GitLab)

For self-hosted providers, authentication uses a Personal Access Token:

1. Navigate to `/repos` and open the **Provider Connections** panel
2. Select the provider (Gitea, Forgejo, or GitLab)
3. Enter the **Instance URL** – the base URL of your self-hosted instance (e.g. `https://git.example.com`)
4. Enter the **Personal Access Token** generated from your provider's settings
5. CRANIS2 validates the token against the provider's API before storing it
6. The token is encrypted at rest and used for all subsequent API calls to that instance

Once the PAT connection is established, you can connect individual products to repositories on that instance.

### How SBOM Generation Works

CRANIS2 uses a three-tier fallback approach to generate SBOMs from your repository. Each tier is attempted in order, and the first successful result is used:

**Tier 1: Repository API SBOM (GitHub only)**

GitHub provides a built-in dependency graph API. When available, CRANIS2 retrieves the SBOM directly from GitHub's API. This is the fastest method and covers dependencies that GitHub has already analysed.

**Tier 2: Lockfile Parsing**

If the API SBOM is unavailable or insufficient, CRANIS2 scans your repository for lockfiles and parses them directly. The platform supports 28 lockfile formats across all major ecosystems (see [Appendix C](#appendix-c-supported-lockfile-formats) for the full list). This tier extracts exact dependency versions and produces the most precise SBOMs.

**Tier 3: Source Import Scanning**

If no lockfiles are found, CRANIS2 falls back to scanning source code import statements. The import scanner supports 28 programming languages (see [Appendix D](#appendix-d-supported-languages-for-import-scanning)) and identifies dependencies by analysing `import`, `require`, `use`, `include`, and equivalent statements. This tier produces a best-effort SBOM based on observed imports, though it cannot determine exact versions.

### Source Code Privacy

CRANIS2 never stores your source code. During SBOM generation, repository contents are accessed via the provider's API, parsed in memory, and only the resulting dependency metadata is persisted. Source files are not written to disk, cached, or transmitted to any third party.

### Syncing

SBOMs can be updated in two ways:

- **Manual sync** – Click the sync button on the product detail page or the Repos page to trigger an immediate SBOM regeneration.
- **Automatic daily sync** – The platform scheduler runs at 2 AM UTC and syncs all stale SBOMs. Only repositories that have received changes since the last sync are processed. After SBOM sync, licence scanning and IP proof generation are triggered automatically.

### Webhook-Driven Staleness

When configured, push events from GitHub, Codeberg, or Forgejo webhooks automatically mark the affected product's SBOM as stale. The Repos page and product detail page display an **Update Available** button next to stale SBOMs, allowing you to sync immediately or wait for the nightly auto-sync.

### Disconnecting a Repository

Disconnecting a repository from a product removes the live connection but preserves all previously generated compliance data. The existing SBOM, vulnerability findings, licence scan results, and IP proof snapshots remain intact. Only future syncs are stopped.

---

## 15. Contributors

### Cross-Product Overview

The Contributors page (`/contributors`) displays a grid of all contributors across your connected repositories.

### Stat Cards

At the top of the page, stat cards summarise:

- **Total Contributors** – the number of unique individuals who have contributed to your products
- **Total Contributions** – the aggregate contribution count across all products
- **Products with Repos** – how many of your products have a connected repository

### Contributor Details

Each contributor card displays:

- **Avatar** – the contributor's profile picture from the repository provider
- **Login** – the contributor's username on the provider (e.g. GitHub handle)
- **Profile link** – a direct link to the contributor's profile on the provider
- **Contribution count** – the number of commits or contributions attributed to this individual

### Per-Product Breakdown

Contributors are grouped by product, so you can see which individuals are contributing to which products. This is useful for understanding team distribution and for identifying single points of failure where a product depends on a very small number of contributors.

### Connection to Billing

The contributor count directly drives CRANIS2's pricing model. Active contributors across your organisation determine your monthly billing amount. See [Section 18: Billing](#18-billing) for details on how contributors are counted and how pricing works.

---

## 16. Dependencies

### Cross-Product View

The Dependencies page (`/dependencies`) provides a consolidated view of all software dependencies across your product portfolio. This is the place to understand what third-party code your organisation relies on.

### SBOM Packages

For each product, the dependency list shows every package in the SBOM:

| Column | Description |
|--------|-------------|
| **Name** | The package name as declared in the ecosystem registry |
| **Version** | The exact version resolved from the lockfile or import scan |
| **Ecosystem** | The package ecosystem, shown as a badge (npm, PyPI, crates.io, Maven, Go, NuGet, RubyGems, Hex, Pub, CocoaPods, and others) |
| **Licence** | The declared licence identifier (SPDX format) |
| **PURL** | The Package URL – a standardised identifier for the package (e.g. `pkg:npm/express@4.18.2`) |

### Depth Indicator

Each dependency is tagged as either **direct** (explicitly declared in your project's manifest) or **transitive** (pulled in as a dependency of a dependency). This distinction is important for prioritising remediation: a vulnerability in a direct dependency is generally easier to address than one in a deeply nested transitive dependency.

### Connection to Other Features

The Dependencies page is the foundation for two downstream compliance functions:

- **Licence scanning** – every dependency's licence is evaluated for compatibility with your distribution model. See [Section 11: Licence Compliance](#11-licence-compliance).
- **Vulnerability scanning** – every dependency is checked against vulnerability databases. See [Section 17: Risk Findings](#17-risk-findings-vulnerability-management).

---

## 17. Risk Findings (Vulnerability Management)

### Cross-Product View

The Risk Findings page (`/risk-findings`) provides a unified view of all vulnerability findings across your product portfolio. Stat cards at the top summarise findings by severity and status:

- **By severity** – Critical, High, Medium, Low counts
- **By status** – Total, Open, Dismissed, Acknowledged, Mitigated, Resolved

### Vulnerability Sources

CRANIS2 draws vulnerability data from two authoritative sources, synchronised nightly at 1 AM UTC:

| Source | Coverage | Description |
|--------|----------|-------------|
| **OSV** (Open Source Vulnerabilities) | 263,000+ advisories | A distributed database covering all major open-source ecosystems. Ecosystem-specific identifiers (GHSA, PYSEC, RUSTSEC, etc.) are mapped to packages. |
| **NVD** (National Vulnerability Database) | 182,000+ CVEs | The US government repository of vulnerability data. CVEs are matched to packages using CPE (Common Platform Enumeration) identifiers. |

The local vulnerability database deduplicates across both sources and uses CPE matching combined with ecosystem-specific filtering to minimise false positives.

### Severity Levels

Findings are assigned a severity level derived from the CVSS (Common Vulnerability Scoring System) score:

| Severity | CVSS Range | Colour |
|----------|-----------|--------|
| **Critical** | 9.0 – 10.0 | Red |
| **High** | 7.0 – 8.9 | Red |
| **Medium** | 4.0 – 6.9 | Amber |
| **Low** | 0.1 – 3.9 | Green |

### The Five-Status Triage Workflow

Each finding passes through a triage workflow with five possible statuses:

| Status | Meaning | When to Use |
|--------|---------|-------------|
| **Open** | New finding, not yet reviewed | Automatically assigned when a finding is first created |
| **Acknowledged** | The team is aware and evaluating impact | Use when you have reviewed the finding but have not yet decided on a course of action |
| **Mitigated** | A workaround or partial fix has been applied | Use when you have applied a temporary measure. A mitigation notes text area is available to document the workaround. |
| **Resolved** | Fully fixed (e.g. the vulnerable dependency has been updated) | Records who resolved the finding and when |
| **Dismissed** | Not applicable or accepted risk | Use when the finding does not affect your product (e.g. the vulnerable code path is not reachable). A reason field captures the justification. |

### Per-Product Scanning

From the product detail page, you can trigger a vulnerability scan for a specific product. The scan evaluates all dependencies in the product's current SBOM against the local vulnerability database.

### Creating an ENISA Report from a Finding

If a vulnerability finding represents an actively exploited vulnerability, you can create an ENISA report directly from the finding. Clicking the report button navigates to `/vulnerability-reports` with the report creation form pre-populated with data from the finding: affected dependency, severity, CVSS score, and description. This saves time and reduces the risk of transcription errors during a time-sensitive reporting process.

### Scan History

The scan history section shows all past vulnerability scans for a product, including:

- **Status** – completed, failed, or in progress
- **Duration** – how long the scan took to complete
- **Dependency count** – how many packages were evaluated
- **Per-source timing** – breakdown of time spent querying OSV vs NVD

### Platform-Wide Scanning

The platform scheduler runs a comprehensive vulnerability scan at 3 AM UTC. This scan evaluates all SBOM components across all products on the platform, deduplicating findings to avoid alerting on the same vulnerability multiple times.

---

## 18. Billing

### Pricing Model

CRANIS2 offers two paid tiers:

| Plan | Price | Includes |
|------|-------|----------|
| **Standard** | EUR 6 per contributor per month | All core compliance features: SBOMs, vulnerability monitoring, licence compliance, IP proof, technical files, ENISA reporting, escrow, obligations tracking, marketplace |
| **Pro** | EUR 9 per product per month + EUR 6 per contributor per month | Everything in Standard, plus: AI Copilot, AI auto-triage, AI risk assessment, AI incident report drafter, CRA category recommender, public API & API keys, CI/CD compliance gate, IDE assistant (MCP), Trello integration |

An active contributor is anyone who has made at least one contribution to a connected repository within the last 90 days. Bot accounts are automatically excluded from billing.

### Free Trial

Every new organisation receives a **90-day free trial** with full access to all platform features. No credit card is required to start the trial.

### Trial Lifecycle

The trial follows a defined progression:

| Phase | Duration | Access Level |
|-------|----------|-------------|
| **Trial** | 90 days from organisation creation | Full access to all features |
| **Grace period** | 7 days after trial expires | Full access, with a warning banner prompting you to subscribe |
| **Read-only** | After grace period | All write operations are blocked; viewing, reading, and exporting remain available |
| **Suspended** | 60 days after entering read-only | Account is suspended with limited access |
| **Cancelled** | After suspension period | Account is cancelled |

### Payment Lifecycle

For paying customers, the lifecycle in the event of a payment failure is:

| Phase | Duration | Access Level |
|-------|----------|-------------|
| **Active** | While payments are current | Full access |
| **Past due** | 7-day grace period after a failed payment | Full access, with a warning |
| **Read-only** | After the grace period | Write operations blocked |
| **Suspended** | Continued non-payment | Account suspended |

### The Billing Page

The Billing page (`/billing`) shows:

- **Status card** – current billing status (trial, active, read-only, suspended)
- **Contributor count** – the number of active contributors driving your bill
- **Billing details form** – billing email, company name, and VAT number
- **Stripe checkout** – subscribe or update your payment method via Stripe's hosted checkout
- **Customer portal** – manage invoices, payment methods, and subscription details through Stripe's customer portal

### The Billing Gate

When an organisation enters read-only, suspended, or cancelled status, the billing gate activates. This is a global middleware that intercepts all write operations (creating products, updating obligations, filing reports, syncing SBOMs) and returns a billing error.

**What is blocked:** All create, update, and delete operations across the platform.

**What remains available:** Viewing all data, reading reports and findings, exporting SBOMs and due diligence packages, accessing the billing page itself to resolve the payment issue.

### Contributor Roster

The Billing page includes a contributor roster showing all individuals counted for billing purposes:

| Badge | Meaning |
|-------|---------|
| **Green** | Active contributor with recent activity |
| **Grey** | Bot account (not billed) |
| **Red** | Departed contributor (no longer active in the repository) |
| **Amber** | Inactive contributor (no recent activity) |

---

## 19. Marketplace

### Public Marketplace

The Marketplace (`/marketplace`) is a public-facing directory of organisations using CRANIS2 to demonstrate their compliance posture. It is accessible without login, allowing prospective customers and partners to browse listed companies.

### Search and Filtering

The marketplace supports search by organisation name and filtering by 10 product categories:

| Category | Category |
|----------|----------|
| IoT | Enterprise |
| Industrial | Open Source |
| Automotive | SaaS |
| Healthcare | Cybersecurity |
| FinTech | Other |

### Compliance Badges

Each marketplace listing displays compliance badges that provide an at-a-glance summary of the organisation's posture:

- **CRA status** – overall CRA compliance progress
- **Obligations %** – percentage of CRA obligations marked as Met
- **Tech file %** – percentage of technical file sections completed
- **Product count** – number of products registered
- **Open vulnerabilities** – count of unresolved vulnerability findings
- **Licence compliance %** – percentage of dependencies with compatible licences

### Company Detail Page

Clicking on an organisation opens the detail page (`/marketplace/:orgId`), which shows the full profile including description, categories, featured products, and all compliance badges.

### Contact Modal

Logged-in users can contact listed organisations through a contact modal. Rate limits are enforced to prevent abuse:

- **3 messages per day** per user across all organisations
- **1 message per organisation** per 7-day period

### Listing Your Organisation

To list your organisation on the marketplace, navigate to `/marketplace/settings`. From this page you can:

- **Toggle visibility** – turn your listing on or off
- **Tagline** – a short one-line description
- **Description** – a longer description of your company and products
- **Categories** – select which product categories apply to your organisation
- **Featured products** – choose which of your products to highlight on the listing

Marketplace listings are currently auto-approved upon creation.

---

## 20. Stakeholders

### CRA Contact Requirements

The CRA requires manufacturers to designate contacts for specific compliance roles. CRANIS2 manages these at two levels: organisation-level and product-level.

### Organisation-Level Stakeholders

| Role | CRA Relevance |
|------|---------------|
| **Manufacturer Contact** | Primary point of contact for the manufacturing entity |
| **Authorised Representative** | Designated representative within the EU (if manufacturer is outside EU) |
| **Importer Contact** | Contact for the entity importing the product into the EU market |
| **Compliance Officer** | Person responsible for overseeing regulatory compliance |

### Product-Level Stakeholders

| Role | CRA Relevance |
|------|---------------|
| **Security Contact** | Responsible for coordinated vulnerability disclosure and security communications |
| **Tech File Owner** | Person responsible for maintaining the technical documentation |
| **Incident Response Lead** | Primary contact during security incident handling and ENISA reporting |

### Stakeholder Fields

Each stakeholder role captures the following information:

| Field | Description |
|-------|-------------|
| Name | Full name of the individual |
| Email | Contact email address |
| Phone | Contact phone number |
| Organisation | The company or entity the individual represents |
| Address | Mailing address |

### How Stakeholders Work

Stakeholder roles are pre-seeded. The roles themselves cannot be added or removed, only their details can be edited. This ensures the CRA-required roles are always present and visible. Each role displays its CRA reference, so you can see which article or annex requires that particular contact.

Editing is done inline on the Stakeholders page. Click a role to expand it and update the contact details.

---

## 21. Organisation Management

### Organisation Page

The Organisation page (`/organisation`) is where you manage your company's profile and team membership.

### Profile Fields

| Field | Description | Required |
|-------|-------------|----------|
| Organisation name | Your company name | Yes |
| Country | Country of registration | Yes |
| Company size | Micro (< 10), Small (10–49), Medium (50–249), Large (250+) | Yes |
| CRA role | Manufacturer, Importer, Distributor, Open Source Steward | Yes |
| Industry | Your industry sector | No |
| Website | Company website URL | No |
| Contact email | Primary contact email | No |
| Phone | Contact phone number | No |
| Address | Company address | No |

### Team Members

The Organisation page lists all members of your organisation with their email address, role, and preferred language.

### Inviting Members

Organisation admins can invite new members by email. The invitation process:

1. Enter the invitee's email address on the Organisation page
2. An invitation email is sent via Resend from `info@poste.cranis2.com`
3. The invitee clicks the token-based acceptance link at `/accept-invite`
4. Upon acceptance, the invitee creates an account (if needed) and is added to the organisation

### Member Roles

| Role | Capabilities |
|------|-------------|
| **Admin** | Full access to all features, including organisation settings, billing, member management, and product deletion |
| **Member** | Read access to all data plus limited write access (update obligations, edit technical files, triage findings, file reports) |

---

## 22. Audit Log

### Organisation Audit Log

The Audit Log (`/audit-log`) provides a chronological record of all compliance-significant actions taken within your organisation.

### What Is Recorded

The audit log captures events across all compliance functions, including:

- Product creation, editing, and deletion
- Repository connections and disconnections
- SBOM sync events
- Vulnerability scan triggers and results
- ENISA report submissions and stage completions
- Obligation status changes
- Stakeholder information updates
- Technical file edits
- Licence scan events
- Login and authentication events

### Viewing the Audit Log

The audit log is presented as a paginated table with the following columns:

| Column | Description |
|--------|-------------|
| **Event type** | The category of action (e.g. `product.created`, `scan.triggered`, `report.submitted`) |
| **User email** | The email of the user who performed the action |
| **Timestamp** | When the action occurred |
| **Metadata** | Additional context about the event (product name, scan results, etc.) |

### Filtering

The audit log supports filtering by:

- **Event type** – narrow down to specific categories of events
- **User** – view actions taken by a specific team member

### Regulatory Significance

CRA Article 10 requires manufacturers to maintain records of compliance activities. The audit log serves as this record, providing an immutable trail of all actions that affect your compliance posture. In the event of a market surveillance authority request, the audit log demonstrates that compliance activities are tracked and attributable to specific individuals and times.

---

## 23. Feedback System

### In-App Feedback

CRANIS2 includes a built-in feedback system accessible from the **Feedback & Bug Report** button at the bottom of the sidebar. The feedback modal allows you to communicate directly with the platform team without leaving the application.

### Submission Categories

| Category | When to Use |
|----------|-------------|
| **Bug** | Something is not working as expected |
| **Feature Request** | A capability you would like to see added |
| **General Feedback** | Any other comment, question, or suggestion |

### Submission Fields

| Field | Description |
|-------|-------------|
| Subject | A brief summary of the feedback |
| Message | Detailed description |
| Page URL | Automatically captured. The page you were on when you opened the feedback modal |

All submissions are reviewed by the platform team and inform the development roadmap.

---

## 24. Platform Administration

### Admin Panel

The admin panel (`/admin`) is a separate, purple-themed interface available only to users with the `is_platform_admin` flag. It provides platform-wide visibility and management capabilities that go beyond any single organisation.

### Who Can Access

Platform admin access is granted at the database level. It is not a role that can be self-assigned or requested through the UI. Platform admins can access both the admin panel and their own organisation's regular interface.

### Admin Pages

The admin panel includes 10 pages:

| Page | Description |
|------|-------------|
| **Dashboard** | Platform-wide statistics: total users, organisations, products, scans run, active users over time |
| **Organisations** | Browse all organisations on the platform. View details, marketplace approval status. |
| **Users** | Search for users across all organisations. Suspend or unsuspend accounts, delete users (with full cascade of associated data), toggle platform admin status. |
| **Audit Log** | Cross-organisation event history. Unlike the per-org audit log, this shows events from all organisations. |
| **System Health** | Database row counts for all major tables, scan performance metrics, error rates, and system status indicators. |
| **Vulnerability Scan** | Trigger platform-wide vulnerability scans. View per-product scan breakdown and full scan history with timing data. |
| **Vulnerability Database** | Statistics for the local vulnerability database: OSV advisory count, NVD CVE count, last sync timestamps, and a manual sync trigger for on-demand updates. |
| **Feedback** | View all feedback submissions from all users. Triage submissions, add admin notes, and track resolution. |
| **Billing** | View billing status for all organisations. Extend trial periods, toggle billing exemptions, and pause payments for specific organisations. |
| **Test Results** | View Vitest backend test results and Playwright E2E test results. Drill into individual suites, test cases, and run history. |

---

## 25. Automated Background Processes

### Scheduler

CRANIS2 runs a set of background jobs on a fixed schedule. These processes maintain the platform's vulnerability database, keep SBOMs current, enforce billing rules, and deposit escrow materials without requiring any user action.

| Time (UTC) | Job | Description |
|------------|-----|-------------|
| **1:00 AM** | Vulnerability database sync | Fetches the latest advisories from OSV (263,000+ entries) and CVEs from NVD (182,000+ entries). Updates the local vulnerability database. |
| **2:00 AM** | SBOM auto-sync | Re-syncs all stale SBOMs (repositories where a push event has been received since the last sync). After sync, triggers licence scanning and IP proof generation for affected products. |
| **3:00 AM** | Platform vulnerability scan | Runs a comprehensive vulnerability scan across all SBOM components on the platform. Deduplicates findings and generates notifications for new discoveries. |
| **4:00 AM** | Billing checks | Evaluates trial expiry dates and payment grace periods. Transitions organisations between billing states (trial, grace, read-only, suspended, cancelled) as appropriate. |
| **5:00 AM** | Escrow deposits | Creates or updates escrow deposits for all products with escrow enabled. Pushes selected artefacts (SBOM, findings, compliance data) to the Forgejo escrow instance. |
| **Hourly** | CRA deadline checks | Monitors all open ENISA reports for approaching or overdue deadlines. Generates notifications at 12 hours, 4 hours, and 1 hour before a deadline, and again when a deadline becomes overdue. |

### Webhooks

CRANIS2 receives webhooks from external services to maintain real-time awareness of changes:

- **GitHub / Codeberg / Forgejo push events** – When a push is made to a connected repository, the webhook marks the corresponding product's SBOM as stale. This triggers the "Update Available" indicator on the Repos page and product detail page. The stale SBOM is automatically re-synced during the 2 AM nightly job.
- **Stripe billing events** – Payment success, payment failure, and subscription update events from Stripe are processed in real time. These events trigger billing state transitions (e.g. from active to past due) and generate user notifications.

### No User Action Required

All background processes run automatically. Users benefit from up-to-date vulnerability data, fresh SBOMs, enforced billing rules, and current escrow deposits without needing to trigger any of these manually.

---

## 26. AI Copilot

**Requires:** Pro plan

The AI Copilot provides contextual AI-generated suggestions for compliance documentation. It is powered by Claude (Anthropic) and is available on two areas of the platform:

### Technical File Suggestions

Each of the eight technical file sections has an **AI Suggest** button. When clicked, the Copilot analyses your product's data (its dependencies, vulnerability scan results, CRA category, repository metadata, and existing documentation) and generates a draft for that section.

- Suggestions are presented in a review panel alongside your current content
- You can accept, edit, or discard the suggestion
- Refinement is supported: after receiving a suggestion, you can provide additional instructions and the Copilot will revise its output
- Suggestions are cached for 24 hours (same product context produces the same result without consuming additional tokens)

### Obligation Evidence Suggestions

On the Obligations tab of a product, each obligation has an **AI Suggest** button for its evidence/notes field. The Copilot generates suggested evidence text based on the obligation requirements and your product's compliance data.

### How It Works

The Copilot sends a structured context payload (product metadata, dependencies, scan results, existing content) to the Claude API. Your source code is never included; only compliance metadata is sent. Responses are streamed back to the UI.

---

## 27. AI Auto-Triage

**Requires:** Pro plan

AI auto-triage analyses vulnerability findings and recommends an appropriate triage action for each one:

- **Dismiss** – the finding is a false positive or not applicable to your usage
- **Acknowledge** – the finding is real but does not require immediate action
- **Escalate** – the finding requires urgent attention

### How It Works

When you click **AI Triage** on a vulnerability finding, the Copilot examines the CVE details, the affected package, its version, and your product's context. It returns:

- A recommended action (dismiss / acknowledge / escalate)
- A confidence score (0–100%)
- A reasoning explanation
- For findings with available fixes, a **CLI mitigation command** specific to the package ecosystem (e.g. `npm install lodash@4.17.21`, `pip install requests>=2.31.0`, `cargo update -p serde`)

### Auto-Dismiss

Findings where the AI recommends dismissal with a confidence score above 90% can be automatically dismissed. This reduces noise from false positives while preserving an audit trail of the AI's reasoning.

### Supported Ecosystems for Mitigation Commands

npm, pip, Cargo (Rust), Go modules, Maven, NuGet, Composer (PHP), RubyGems, CocoaPods, Pub (Dart), Hex (Elixir), and Swift Package Manager.

---

## 28. AI Risk Assessment

**Requires:** Pro plan

The AI risk assessment generator creates a comprehensive risk assessment document for a product, grounded in its actual platform data. Navigate to a product's detail page and click **Generate Risk Assessment**.

### What It Produces

1. **Risk Assessment Methodology** – describes the approach, data sources, and severity classification used
2. **Threat Model** – identifies threats relevant to the product based on its CRA category, dependency profile, and distribution model
3. **Risk Register** – a structured table of identified risks with likelihood, impact, severity, and recommended mitigations
4. **Annex I Mappings** – maps 13 CRA Annex I essential requirements to the product's current compliance state, with evidence references

### Output

The risk assessment is stored against the product and can be exported as **Markdown** for inclusion in the CRA technical file. It is regenerated on demand; each generation reflects the product's current state.

---

## 29. AI Incident Report Drafter

**Requires:** Pro plan

When creating an ENISA Article 14 report (see Section 10), the AI incident report drafter can pre-populate each of the three reporting stages with content grounded in your product's data.

### How It Works

On any CRA report, click **AI Draft** for a stage (early warning, notification, or final report). The Copilot analyses:

- The product's vulnerability findings and scan history
- Any linked findings associated with the report
- Content from previously submitted stages (for continuity)
- The product's CRA category and metadata

It generates stage-appropriate content following ENISA Article 14 requirements. The draft is presented for review before merging into the report form.

### Non-Destructive Merge

AI-generated content is merged with any existing content in the stage form. Existing text is never overwritten. The AI draft is appended or offered as a suggestion alongside current content.

---

## 30. CRA Category Recommender

**Requires:** Pro plan (AI augmentation); deterministic scoring available on all plans

The CRA category recommender helps determine whether a product falls under the Default, Important Class I, Important Class II, or Critical CRA category.

### Deterministic Scoring

The recommender uses four attributes to compute a risk score:

1. **Network connectivity** – does the product connect to the internet or operate on a network?
2. **Data sensitivity** – does the product handle personal data, financial data, or credentials?
3. **Privileged access** – does the product run with elevated privileges or manage access control?
4. **Safety / infrastructure impact** – could a failure affect critical infrastructure or physical safety?

Each attribute is scored, and the total determines the recommended category. This scoring is deterministic and available on all plans.

### AI Augmentation (Pro Plan)

On Pro plans, the recommender also sends the product's metadata and attribute answers to the Claude API for a second opinion. The AI may confirm the deterministic result or suggest adjustments with reasoning. Both scores are shown side by side.

### Admin Rules

Platform admins can define override rules that map specific attribute combinations to fixed categories (e.g. "any product with safety impact must be Class II"). These rules take precedence over both the deterministic score and the AI suggestion. All rule changes are recorded in the audit trail.

### Accessing the Recommender

Click the **CRA Category** badge on a product's detail page to open the Category Recommender modal.

---

## 31. Supplier Due Diligence

**Available on:** All plans

The Supply Chain tab on each product provides supplier due diligence capabilities for managing third-party dependency risk.

### Questionnaires

CRANIS2 generates deterministic, template-based questionnaires for your product's dependencies. These questionnaires assess:

- Security practices of the dependency maintainer
- Licence compliance and compatibility
- Vulnerability handling and disclosure processes
- Update and maintenance cadence

Questionnaires are generated from templates. No AI is involved. The questions are derived from CRA requirements and industry best practices.

### Supplier Enrichment

For dependencies from supported registries, CRANIS2 automatically enriches supplier information:

- **npm** – maintainer details, repository URL, licence, download counts, last publish date
- **PyPI** – author details, project URL, licence, Python version support
- **crates.io** – owner details, repository URL, licence, download counts

Enrichment data is cached in a shared 30-day Postgres cache to minimise external API calls.

### Export

Supplier due diligence data can be exported as:

- **Markdown** – formatted report suitable for audit or procurement review
- **CSV** – raw data for further analysis

---

## 32. Compliance Gap Narrator

**Available on:** All plans

The compliance gap narrator provides a deterministic analysis of each product's compliance gaps. It appears as a **Next Steps** card on the product Overview tab.

### What It Shows

- A prioritised list of compliance actions, ordered by impact
- Each action includes the relevant CRA article, what is needed, and why it matters
- A completion percentage based on obligations, technical file progress, scan coverage, and SBOM freshness

### How It Works

The gap analysis is computed deterministically from platform data. It does not use AI. It examines:

- Obligation statuses (not started, in progress, complete)
- Technical file section completion
- Vulnerability scan recency and open finding counts
- SBOM freshness and dependency coverage
- Stakeholder contact completeness
- ENISA reporting readiness

The Next Steps card updates in real time as you make progress.

---

## 33. Public API & API Keys

**Requires:** Pro plan

CRANIS2 provides a public REST API for programmatic access to your compliance data. The API is authenticated using API keys.

### Managing API Keys

Navigate to **Settings > Integrations** to manage API keys. You can:

- Create new keys with a descriptive name
- View active keys (the full key is shown only once at creation)
- Revoke keys instantly

API keys use the prefix `cranis2_` followed by 40 hexadecimal characters. Keys are stored as SHA-256 hashes; the plaintext is never retained after creation.

### API Scopes

Each key has four read-only scopes:

| Scope | Access |
|-------|--------|
| `read:products` | List products in your organisation |
| `read:vulnerabilities` | Read vulnerability findings and scan status |
| `read:compliance` | Read obligation and compliance status |
| `write:findings` | Trigger syncs and resolve findings |

New keys include all scopes by default.

### Available Endpoints

All public API endpoints are under `/api/v1/`:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/products` | List all products |
| GET | `/api/v1/products/:id` | Get product details |
| GET | `/api/v1/products/:id/vulnerabilities` | Get vulnerability findings |
| GET | `/api/v1/products/:id/obligations` | Get obligation statuses |
| GET | `/api/v1/compliance-status` | Get overall compliance pass/fail |

### Authentication

Include your API key in the `Authorization` header:

```
Authorization: Bearer cranis2_your_key_here
```

---

## 34. CI/CD Compliance Gate

**Requires:** Pro plan + API key

The CI/CD compliance gate lets you block deployments that do not meet your organisation's compliance threshold. It queries the CRANIS2 public API and exits with a non-zero code if the compliance check fails.

### How It Works

The gate calls the `/api/v1/compliance-status` endpoint, which returns a pass/fail result based on whether any open critical or high-severity findings exist. You configure the gate as a step in your CI/CD pipeline.

### Setup

Navigate to **Settings > Integrations > CI/CD Gate** for ready-made configuration snippets for:

- **GitHub Actions** – a workflow step using `curl` and `jq`
- **GitLab CI** – a pipeline job with the gate script
- **Generic** – a bash script that works with any CI system

Each snippet uses your API key and the CRANIS2 API URL. Copy the snippet into your pipeline configuration.

### Configurable Threshold

The compliance gate checks for zero open critical and high-severity findings by default. The threshold is configurable via the API.

---

## 35. Integrations (Trello, MCP, IDE)

**Requires:** Pro plan

The Integrations page (**Settings > Integrations**) provides configuration for external tool connections.

### Trello Integration

Connect CRANIS2 to Trello to automatically create cards when compliance events occur. Configuration:

1. Enter your Trello API key and token
2. Map each product to a Trello board
3. Select which event types should create cards:
   - **New vulnerability finding** – creates a card when a new critical or high finding is discovered
   - **Obligation status change** – creates a card when an obligation moves to a new status
   - **SBOM stale** – creates a card when a product's SBOM becomes stale
   - **Compliance gap** – creates a card for new compliance gaps

Cards are deduplicated. The same event will not create duplicate cards. When an event is resolved (e.g. a vulnerability is fixed), a resolution comment is added to the existing card.

Default lists are auto-created on empty boards: To Do, In Progress, Done, and Resolved.

### MCP Server (IDE AI Assistants)

CRANIS2 provides a Model Context Protocol (MCP) server that enables IDE AI assistants (Claude Desktop, VS Code Copilot, Cursor, Claude Code) to query your compliance data directly from the editor.

The MCP server provides five tools:

| Tool | Description |
|------|-------------|
| `list_products` | List all products in your organisation |
| `get_vulnerabilities` | Get vulnerability findings for a product (filterable by severity and status) |
| `get_mitigation` | Get an ecosystem-aware bash command to fix a specific vulnerability |
| `get_compliance_status` | Check pass/fail compliance status against a severity threshold |
| `verify_fix` | Trigger an SBOM rescan to confirm a vulnerability fix has been applied |

### IDE Compliance Assistant Setup

The Integrations page includes a setup wizard for configuring the MCP server in your IDE:

1. Select your IDE (VS Code, Cursor, Claude Desktop, or Claude Code)
2. Select an existing API key or create a new one
3. Copy the auto-generated JSON configuration snippet
4. Paste it into your IDE's MCP configuration file

The wizard provides the correct configuration format for each IDE and includes instructions for where to place the configuration file.

### Example Workflow

```
You: "What vulnerabilities does my project have?"
AI:  [calls list_products, then get_vulnerabilities]
     "Found 3 critical vulnerabilities. The most urgent is CVE-2024-1234
      in lodash@4.17.11. Run: npm install lodash@4.17.21"

You: *runs the command in terminal*

You: "Verify my fix"
AI:  [calls verify_fix]
     "Verification passed: lodash@4.17.11 is no longer flagged.
      The finding has been marked as resolved in CRANIS2."
```

---

## 36. Copilot Usage & Cost Protection

**Requires:** Pro plan

CRANIS2 includes a three-layer cost protection system for AI Copilot features to prevent runaway costs.

### Token Budget

Each organisation has a monthly token budget (default: 500,000 tokens). When the budget is exhausted, AI features return a 429 error until the next billing cycle. Platform admins can configure the default budget and set per-organisation overrides.

### Rate Limits

Individual AI endpoints have rate limits to prevent abuse:

| Endpoint | Limit |
|----------|-------|
| AI Suggest (tech file / obligations) | 20 requests per product per hour |
| AI Triage | 5 requests per product per hour |
| AI Risk Assessment | 3 requests per product per day |
| AI Incident Report Draft | 5 requests per report per day |
| CRA Category Recommendation | 5 requests per product per day |

### Response Caching

AI responses are cached for 24 hours using a SHA-256 hash of the input context. If the same request is made with identical context (e.g. re-clicking AI Suggest without changing any product data), the cached response is returned instantly without consuming tokens.

### Usage Dashboard

AI usage is tracked on the Billing page:

- **Organisation-level**: total tokens used, remaining budget, cost estimate (USD)
- **Product-level**: a Copilot Usage widget on the product Overview tab shows per-product token consumption
- **Admin-level**: platform admins see cross-organisation usage on the Admin Billing page

---

## 37. Post-Market Monitoring & Field Issues

### What Is Post-Market Monitoring?

CRA Articles 13(2) and 13(9) require manufacturers to monitor their products after placing them on the market. This includes tracking field-reported security issues, implementing corrective actions, and providing security updates. CRANIS2 provides a structured workflow for managing this process.

### Accessing Field Issues

Field issues are managed from the **Field Issues** tab on each product's detail page. You can also access a cross-product view from the sidebar navigation.

### Creating a Field Issue

Click **Report Field Issue** to create a new entry. Each field issue captures:

| Field | Description |
|-------|-------------|
| **Title** | Short description of the reported issue |
| **Description** | Detailed account of the issue, including how it was discovered and its potential impact |
| **Severity** | Critical, High, Medium, or Low |
| **Source** | How the issue was reported: customer report, internal testing, vulnerability disclosure, market surveillance, or other |
| **Affected versions** | Which product versions are affected |
| **Reporter** | Contact details for the person or organisation that reported the issue |

### Field Issue Lifecycle

Each field issue progresses through a defined lifecycle:

1. **Open** – Issue has been reported and recorded
2. **Investigating** – The issue is being analysed to determine root cause and impact
3. **Fix in Progress** – A corrective action has been identified and development is underway
4. **Resolved** – The fix has been implemented and verified
5. **Closed** – The issue has been fully addressed and documented

### Corrective Actions

Each field issue can have one or more **corrective actions** — the specific steps taken to address the issue. Corrective actions have their own lifecycle:

1. **Planned** – The action has been identified but work has not started
2. **In Progress** – Work is underway
3. **Completed** – The action has been implemented
4. **Verified** – The action has been tested and confirmed effective

### Obligation Wiring

Field issue data automatically feeds the obligation engine:

- **Art. 13(6) — Vulnerability handling**: Status reflects open field issues. If any field issues remain open, this obligation cannot be fully met.
- **Art. 13(9) — Security updates**: Status tracks corrective action completion. Pending corrective actions keep this obligation in progress.

### Surveillance Reports

Click **Export Report** to generate a Markdown surveillance report covering all field issues for a product, including corrective action status and timeline. This report is suitable for inclusion in CRA technical file documentation or for submission to market surveillance authorities.

---

## 38. Cryptographic Standards Inventory

### What Is the Crypto Inventory?

CRA Annex I requires products to use appropriate cryptographic standards. CRANIS2 scans your dependency tree to identify cryptographic algorithm usage and classifies each algorithm by its quantum readiness status.

### Accessing the Crypto Inventory

The crypto inventory is available from the **Crypto Inventory** tab on each product's detail page.

### Algorithm Classification

CRANIS2 recognises 37 cryptographic algorithms, each classified into one of three categories:

| Category | Meaning | Examples |
|----------|---------|----------|
| **Quantum-safe** | Resistant to known quantum computing attacks | ML-KEM (Kyber), ML-DSA (Dilithium), SLH-DSA (SPHINCS+), AES-256, SHA-3 |
| **Quantum-vulnerable** | Secure today but will be broken by cryptographically relevant quantum computers | RSA, ECDSA, ECDH, classic Diffie-Hellman, DSA |
| **Broken** | Already considered insecure regardless of quantum computing | MD5, SHA-1, DES, 3DES, RC4 |

### PQC Readiness Assessment

The **Post-Quantum Cryptography (PQC) Readiness Assessment** provides a structured evaluation of your product's preparedness for the quantum computing transition. It covers 18 questions across areas including:

- Current cryptographic algorithm usage
- Migration planning for quantum-vulnerable algorithms
- Crypto-agility (ability to swap algorithms without major refactoring)
- Key management practices
- Compliance with emerging PQC standards (NIST FIPS 203/204/205)

The assessment is available as a public self-assessment tool at `/assess/pqc`.

### Obligation Wiring

Crypto inventory data feeds the obligation engine:

- **Art. 13(2) — Cryptographic requirements**: Derived status reflects whether broken or quantum-vulnerable algorithms have been identified and addressed.
- **Annex I risk assessment**: Crypto findings are included in the risk assessment context for AI-generated Annex I mappings.

---

## 39. Conformity Assessments

### What Are Conformity Assessments?

Conformity assessments are structured self-evaluation tools that help you determine whether your product or organisation meets regulatory requirements. CRANIS2 provides four assessment types:

| Assessment | Questions | Scope |
|-----------|-----------|-------|
| **CRA Conformity** | 12 | Product-level CRA compliance covering essential requirements, documentation, vulnerability handling, and CE marking |
| **NIS2 Readiness** | 25 | Organisation-level NIS2 compliance covering governance, risk management, incident handling, supply chain security, and reporting |
| **Importer Obligations** | 10 | CRA Article 18 obligations specific to importers placing products on the EU market |
| **PQC Readiness** | 18 | Post-quantum cryptography preparedness covering algorithm usage, migration planning, and crypto-agility |

### Taking an Assessment

Each assessment presents questions with:

- **Guidance text** explaining the regulatory requirement and what constitutes compliance
- **Response options** (typically Yes / Partially / No / Not Applicable)
- **Evidence linking** to connect your response to supporting documentation within the platform
- **Progress tracking** showing how many questions have been answered

### Public Assessment Landing Page

All four assessments are available publicly at `/assess` without requiring a CRANIS2 account. This allows prospective customers, supply chain partners, and auditors to evaluate compliance posture independently. Results are shown immediately upon completion.

### Assessment Results

Completed assessments produce a compliance score and highlight areas requiring attention. For authenticated users, assessment results are stored against the product or organisation and can be referenced in technical file documentation.

---

## 40. GRC/OSCAL Bridge

### What Is OSCAL?

OSCAL (Open Security Controls Assessment Language) is a NIST framework for expressing security assessment information in a standardised, machine-readable format. It enables interoperability between compliance tools and GRC (Governance, Risk, and Compliance) platforms.

### Supported Document Types

CRANIS2 exports compliance data in OSCAL 1.1.2 format across four document types:

| Document Type | Contents |
|--------------|----------|
| **Catalog** | CRA obligation definitions as OSCAL controls, with regulatory references and descriptions |
| **Profile** | The subset of obligations applicable to a specific product, based on its CRA category and operator role |
| **Assessment Results** | Current compliance status for each obligation, including findings, evidence references, and timestamps |
| **Component Definition** | Product metadata expressed as an OSCAL component with properties (category, type, version, distribution model) |

### Accessing OSCAL Exports

**Requires:** Pro plan

OSCAL exports are available via the Public API:

```
GET /api/v1/products/:productId/oscal/catalog
GET /api/v1/products/:productId/oscal/profile
GET /api/v1/products/:productId/oscal/assessment-results
GET /api/v1/products/:productId/oscal/component-definition
```

All endpoints return JSON conforming to the OSCAL 1.1.2 schema. The exports can be imported into GRC platforms such as Trestle, Lula, or Comply.

---

## Appendix A: CRA Product Categories

| Category | Assessment Procedure | Description |
|----------|---------------------|-------------|
| **Default** | Self-assessment by the manufacturer | The vast majority of products with digital elements. Manufacturers perform their own conformity assessment based on Annex VIII Module A. No third-party involvement is required. |
| **Class I (Important)** | Third-party assessment or harmonised standard | Products that present a higher cybersecurity risk. Manufacturers must either apply a harmonised standard (and self-certify) or undergo assessment by a notified body. Examples include identity management systems, VPNs, network management tools, firewalls, and intrusion detection systems. |
| **Class II (Critical)** | Mandatory EU-level certification | Products considered critical to EU cybersecurity infrastructure. A mandatory third-party assessment by an EU-notified body is required. Examples include operating systems, hypervisors, hardware security modules, smartcard readers, and industrial control systems. |

---

## Appendix B: Supported Repository Providers

| Provider | Auth Method | Hosting | URL |
|----------|-------------|---------|-----|
| **GitHub** | OAuth | Cloud (github.com) | `https://github.com` |
| **Codeberg** | OAuth | Cloud (codeberg.org) | `https://codeberg.org` |
| **Gitea** | Personal Access Token | Self-hosted | User-provided instance URL |
| **Forgejo** | Personal Access Token | Self-hosted | User-provided instance URL |
| **GitLab** | Personal Access Token | Self-hosted | User-provided instance URL |

---

## Appendix C: Supported Lockfile Formats

CRANIS2's Tier 2 SBOM generation parses 28 lockfile formats across all major package ecosystems:

| Lockfile | Ecosystem |
|----------|-----------|
| `package-lock.json` | npm |
| `yarn.lock` | Yarn |
| `pnpm-lock.yaml` | pnpm |
| `Cargo.lock` | Rust (crates.io) |
| `go.sum` | Go |
| `Pipfile.lock` | Python (Pipenv) |
| `poetry.lock` | Python (Poetry) |
| `requirements.txt` | Python (pip) |
| `Gemfile.lock` | Ruby (RubyGems) |
| `composer.lock` | PHP (Composer) |
| `packages.lock.json` | NuGet (.NET) |
| `Package.resolved` | Swift (Swift Package Manager) |
| `Podfile.lock` | CocoaPods (iOS/macOS) |
| `pubspec.lock` | Dart / Flutter (Pub) |
| `mix.lock` | Elixir (Hex) |
| `stack.yaml.lock` | Haskell (Stack) |
| `cabal.project.freeze` | Haskell (Cabal) |
| `build.gradle.lockfile` | Gradle (Java/Kotlin) |
| `pom.xml` | Maven (Java) |
| `ivy.xml` | Ivy (Java) |
| `cpanfile.snapshot` | Perl (CPAN) |
| `renv.lock` | R (renv) |
| `conan.lock` | C/C++ (Conan) |
| `vcpkg.json` | C/C++ (vcpkg) |
| `Package.swift resolved` | Swift (Swift Package Manager, resolved format) |
| `shard.lock` | Crystal (Shards) |
| `deno.lock` | Deno |
| `bun.lockb` | Bun |

---

## Appendix D: Supported Languages for Import Scanning

CRANIS2's Tier 3 import scanner analyses source code import statements in 28 programming languages:

| Language | Language | Language |
|----------|----------|----------|
| JavaScript | Kotlin | Perl |
| TypeScript | C# | R |
| Python | Ruby | Lua |
| Go | PHP | Shell |
| Rust | Swift | Zig |
| Java | Objective-C | Crystal |
| Scala | C | Delphi |
| Groovy | C++ | Pascal |
| Dart | Elixir | |
| Haskell | Erlang | |

The import scanner identifies dependencies by parsing `import`, `require`, `use`, `include`, `using`, and equivalent statements specific to each language. Memory guards are in place to prevent excessive resource consumption when scanning large repositories.

---

## Appendix E: SBOM Export Formats

CRANIS2 supports exporting SBOMs in two industry-standard formats:

| Format | Version | Output | Description |
|--------|---------|--------|-------------|
| **CycloneDX** | 1.6 | JSON | OWASP standard for software bill of materials. Includes component metadata, licences, supplier information, and package hashes. Widely adopted by security tooling and compliance frameworks. |
| **SPDX** | 2.3 | JSON | Linux Foundation standard for software package data exchange. Includes package identifiers, relationships, licence declarations, and file-level information. Required by several government procurement frameworks. |

Both formats include **SHA-512 hash enrichment** for package integrity verification, enabling downstream consumers to verify that the packages listed in the SBOM match the actual artefacts in use.

---

*End of the CRANIS2 User Guide.*

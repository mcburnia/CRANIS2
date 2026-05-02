<!--
  Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi.mcburnie@gmail.com
-->

# CRANIS2 User Guide

**Document Version:** 1.0
**Last Updated:** 2026-04-28
**Covers:** Sections 1--28 plus Appendices A--E

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
11. [License Compliance](#11-license-compliance)
12. [IP Proof](#12-ip-proof)
13. [Due Diligence Export](#13-due-diligence-export)
14. [Repository Management](#14-repository-management)
15. [Contributors](#15-contributors)
16. [Dependencies](#16-dependencies)
17. [Risk Findings (Vulnerability Management)](#17-risk-findings-vulnerability-management)
18. [Billing](#18-billing)
19. [Trust Centre](#19-trust-centre)
20. [Stakeholders](#20-stakeholders)
21. [Organisation Management](#21-organisation-management)
22. [Audit Log](#22-audit-log)
23. [Account and Data Rights](#23-account-and-data-rights)
24. [Feedback System](#24-feedback-system)
25. [Affiliate Programme](#25-affiliate-programme)
26. [Non-Profit and Open Source Access](#26-non-profit-and-open-source-access)
27. [Platform Administration](#27-platform-administration)
28. [Automated Background Processes](#28-automated-background-processes)
- [Appendix A: CRA Product Categories](#appendix-a-cra-product-categories)
- [Appendix B: Supported Repository Providers](#appendix-b-supported-repository-providers)
- [Appendix C: Supported Lockfile Formats](#appendix-c-supported-lockfile-formats)
- [Appendix D: Supported Languages for Import Scanning](#appendix-d-supported-languages-for-import-scanning)
- [Appendix E: SBOM Export Formats](#appendix-e-sbom-export-formats)

---

## 1. Introduction

### What Is CRANIS2?

CRANIS2 is a compliance platform that helps software companies meet the requirements of two major pieces of EU legislation: the **Cyber Resilience Act (CRA)** and the **NIS2 Directive**.

It connects to your existing source code repositories and automatically builds the compliance evidence that regulators expect to see. CRANIS2 reads dependency metadata from your repositories but never stores, analyses or modifies your source code. The platform automates seven compliance functions: SBOM management, vulnerability monitoring, license compliance, intellectual property proof, CRA technical documentation, ENISA reporting, and source code escrow.

### Who This Guide Is For

This guide is written for four audiences:

- **Organisation Admins** -- Users who set up and manage their company's CRANIS2 account, configure products, and oversee compliance activities.
- **Organisation Members** -- Team members who work within the platform: reviewing findings, updating technical files, filing reports.
- **Platform Admins** -- Users with platform-level access who manage organisations, monitor system health, and administer the vulnerability database. Platform admin functions are covered in the second half of this guide.
- **Evaluators and Auditors** -- Individuals assessing whether CRANIS2 meets their organisation's compliance needs, or reviewing the compliance evidence it produces.

### Key Terminology

| Term | Meaning |
|------|---------|
| **CRA** | Cyber Resilience Act -- EU regulation requiring cybersecurity standards for products with digital elements, effective December 2024 |
| **NIS2** | Network and Information Security Directive (2022/2555) -- EU directive strengthening cybersecurity obligations for essential and important entities |
| **SBOM** | Software Bill of Materials -- a machine-readable inventory of all software components in a product |
| **ENISA** | European Union Agency for Cybersecurity -- the EU body that coordinates vulnerability and incident reporting under the CRA |
| **CSIRT** | Computer Security Incident Response Team -- national cybersecurity body in each EU member state |
| **CE Mark** | Conformite Europeenne -- the marking required to legally sell products in the EU single market |
| **CycloneDX** | An OWASP standard format for SBOMs, supported by CRANIS2 in version 1.6 |
| **SPDX** | Software Package Data Exchange -- a Linux Foundation standard format for SBOMs, supported by CRANIS2 in version 2.3 |
| **RFC 3161** | Internet standard for trusted timestamping, used by CRANIS2 to create legally admissible proof of content at a point in time |
| **TLP** | Traffic Light Protocol -- a classification system (WHITE, GREEN, AMBER, RED) for controlling information sensitivity in vulnerability reports |
| **Copyleft** | A category of open-source licence (GPL, LGPL, AGPL, MPL) that requires derivative works to be distributed under the same or compatible terms |
| **Permissive** | A category of open-source licence (MIT, Apache-2.0, BSD, ISC) that allows unrestricted use including in proprietary products |
| **PURL** | Package URL -- a standardised scheme for identifying software packages across ecosystems (e.g. `pkg:npm/express@4.18.2`) |
| **CVE** | Common Vulnerabilities and Exposures -- a unique identifier assigned to publicly disclosed security vulnerabilities |
| **CVSS** | Common Vulnerability Scoring System -- a numerical scale (0.0--10.0) rating the severity of a vulnerability |
| **OSV** | Open Source Vulnerabilities -- a distributed vulnerability database covering all major ecosystems, used by CRANIS2 |
| **NVD** | National Vulnerability Database -- the US government repository of CVE data, used by CRANIS2 alongside OSV |

---

## 2. Regulatory Context

### The Cyber Resilience Act (CRA)

The CRA entered into force in December 2024 and applies to any product with digital elements placed on the EU single market. It imposes cybersecurity requirements across the entire product lifecycle -- from design through end-of-support.

**Who it applies to:**

- **Manufacturers** -- any company that designs, develops or produces a product with digital elements, or has one designed and produced on their behalf. This is the broadest category and includes most software product companies.
- **Importers** -- companies that bring products from outside the EU into the EU market.
- **Distributors** -- companies that make products available on the EU market without affecting their properties (resellers, channel partners).
- **Open Source Stewards** -- organisations that systematically provide support for open-source products intended for commercial use.

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

The NIS2 Directive (2022/2555) is the EU's framework for network and information security. While the CRA focuses on product security, NIS2 focuses on organisational security -- particularly for entities operating critical infrastructure.

NIS2 distinguishes between:

- **Essential entities** -- energy, transport, banking, health, water, digital infrastructure, ICT service management, public administration, space
- **Important entities** -- postal services, waste management, chemicals, food, manufacturing, digital providers, research

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

If you have a bonus code (e.g. from an affiliate partner), enter it in the bonus code field during signup. Valid bonus codes extend your free trial from 30 to 90 days.

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
| Company size | Micro (< 10), Small (10--49), Medium (50--249), Large (250+) | Yes |
| CRA role | Manufacturer, Importer, Distributor, Open Source Steward | Yes |
| Industry | Free text | No |

Your CRA role determines which obligations are tracked and how compliance workflows behave. Most software companies will select **Manufacturer**.

Once the organisation is created, you are assigned the **admin** role within it. You can invite additional team members later (see Stakeholders in the second half of this guide).

### First Dashboard View

After setup, the Dashboard provides a high-level summary of your compliance posture:

- **Products** -- how many products are registered and their sync status
- **Vulnerabilities** -- open findings across your portfolio
- **Compliance** -- obligation completion percentage
- **SBOM** -- dependency counts and freshness

These cards are connected to live data and update as you add products and connect repositories.

---

## 4. Navigating the Platform

### Sidebar Navigation

The sidebar uses an accordion pattern -- only one section can be expanded at a time. Clicking a section header collapses the previously open section and expands the new one.

The sidebar is organised into five groups:

| Group | Pages |
|-------|-------|
| **Dashboard** | Dashboard |
| **Compliance** | Products, Obligations, Technical Files, Vulnerability Reports, License Compliance, IP Proof, Due Diligence |
| **Source Code** | Repos, Contributors, Dependencies, Risk Findings |
| **Billing** | Plans & Usage, Reports |
| **Settings** | Organisation, Stakeholders, Audit Log, Trust Centre |

A **Feedback** button sits at the bottom of the sidebar, outside the accordion. It opens a modal where you can submit bug reports, feature requests, or general feedback. Each submission is categorised (`bug`, `feature`, or `feedback`) and includes the page URL where you submitted it.

### Common UI Patterns

Throughout the platform, you will encounter several consistent UI elements:

- **StatCards** -- coloured summary cards at the top of most pages showing key metrics (e.g. "Open Vulnerabilities: 3"). Colours indicate severity: green (healthy), amber (attention needed), red (action required), blue (informational).
- **PageHeaders** -- the title bar at the top of every page, sometimes with a timestamp or subtitle.
- **Inline editing** -- many fields (obligation statuses, technical file sections, stakeholder details) can be edited directly on the page without navigating to a separate form.
- **Filter bars** -- tables across the platform support filtering by status, product, type, and other relevant criteria.

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

- **Default** -- Self-assessment. The manufacturer performs their own conformity assessment. This applies to the majority of software products.
- **Class I (Important)** -- Products with higher cybersecurity significance. Requires application of a harmonised standard or third-party assessment. Examples: identity management systems, VPNs, firewalls.
- **Class II (Critical)** -- Products considered critical to EU cybersecurity. Mandatory third-party assessment by an EU-notified body. Examples: operating systems, hypervisors, hardware security modules.

### Product Types

| Type | Description |
|------|-------------|
| Firmware | Software embedded in hardware devices |
| SaaS | Software as a Service -- cloud-hosted application |
| Library | A reusable software library or framework |
| Desktop App | Application installed on desktop operating systems |
| Mobile App | Application installed on mobile devices |
| IoT | Software for Internet of Things devices |
| Embedded | Software for embedded systems |
| Other | Products that do not fit the above categories |

### Distribution Models

The distribution model affects license compatibility analysis (see [Section 11: License Compliance](#11-license-compliance)):

| Model | Description |
|-------|-------------|
| `proprietary_binary` | Distributed as compiled binary without source code |
| `saas_hosted` | Hosted as a service -- users do not receive a copy |
| `source_available` | Source code is available but under restrictive terms |
| `library_component` | Distributed as a library for integration by others |
| `internal_only` | Used internally, not distributed to third parties |

### Product Detail Page

Clicking on a product opens the detail page (`/products/:productId`), which has five tabs:

**Overview** -- The landing tab. Shows:
- Repository card with connection status and provider
- SBOM summary: package count, source tier (API / Lockfile / Import Scan), last sync time, staleness indicator
- Technical file progress (X of 8 sections complete)
- Version history using the CRANIS2 auto-versioning format (`YYYY.MM.DD.NNNN`) alongside any Git tags from the repository

**Obligations** -- Per-product CRA obligations with inline status editing. Each obligation can be set to Not Started, In Progress, or Met. See [Section 8: Obligations Tracking](#8-obligations-tracking).

**Technical File** -- The eight Annex VII sections with content editors, plus the Annex I checklist. See [Section 9: Technical Files](#9-technical-files).

**Risk Findings** -- Vulnerability findings specific to this product, with severity, affected dependency, and triage controls. Findings can be triaged as open, mitigated, or closed.

**Dependencies** -- The full SBOM package list for this product. Each dependency shows its name, version, ecosystem (npm, PyPI, crates.io, etc.), license, and whether it is a direct or transitive dependency.

The Overview tab includes a **Next Steps** card — a compliance gap narrator that analyses your product's current state and presents a prioritised list of actions needed to achieve full CRA compliance. Each gap includes the relevant CRA article reference, a description of the action required, and a navigation link to the appropriate page or tab.

### Editing and Deleting Products

Product details (name, description, version, type, category, distribution model) can be edited from the product detail page.

When deleting a product, CRANIS2 generates a **data exit package** -- a ZIP file containing all compliance data associated with that product (SBOM, findings, technical file content, reports). This ensures you retain your compliance evidence even after removing the product from the platform.

If the product had escrow enabled, the Forgejo repository is preserved even after deletion, in accordance with legal retention requirements.

---

## 6. Compliance Timeline

### Overview

Each product has a historical compliance timeline accessible at `/products/:productId/timeline`.

The timeline provides a chronological view of all compliance-significant events for that product, including:

- Vulnerability scan results (when scans ran, what was found)
- License scan events
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
- The Forgejo instance is separate from your production repository -- it is a deposit, not a replacement
- Deposits are preserved even after product deletion (legal retention)

### Configuring Escrow

To configure escrow for a product, navigate to `/products/:productId/escrow`. From this page you can:

- Enable or disable escrow for the product
- Choose which artifact types to include in deposits:

| Artifact Type | Description |
|---------------|-------------|
| SBOM (CycloneDX/SPDX) | The product's software bill of materials |
| Vulnerability reports | Current vulnerability scan findings |
| License audit | License compliance scan results |
| IP proof | RFC 3161 timestamp snapshots |
| CRA documentation | Technical file content and obligation status |
| Compliance timeline | Historical compliance event data |

### Release Models

You control what happens to the escrow deposit if it needs to be released:

- **Open source** -- the source code is published publicly
- **Designated recipients** -- specific clients you name receive private copies

### What Happens on Product Deletion

When you delete a product from CRANIS2, the Forgejo escrow repository is **not** deleted. It is preserved under legal retention policy. The data exit ZIP you receive on deletion (see [Section 5: Products](#5-products)) includes references to the preserved escrow repository.

---

## 8. Obligations Tracking

### Cross-Product Overview

The Obligations page (`/obligations`) provides a cross-product view of all CRA and NIS2 obligations across your organisation. This is the place to get a portfolio-level understanding of where you stand.

### What Are CRA Obligations?

The CRA defines a set of obligations that apply to manufacturers, importers and distributors of products with digital elements. CRANIS2 tracks **35 obligations** across three CRA roles:

| Role | Obligation Count | Source Articles |
|------|-----------------|-----------------|
| **Manufacturer** | 19 | Articles 13, 14, 16, 20, 32, Annexes I and VII |
| **Importer** | 10 | Article 18 |
| **Distributor** | 6 | Article 19 |

Open-source stewards share the manufacturer obligation set.

The platform automatically assigns the correct obligation set based on the organisation's CRA role. When you create or update your organisation's role in the Organisation settings, the applicable obligations are recalculated for all products.

For manufacturers (the broadest set), obligations cover areas including:

- Product security requirements (Annex I)
- Vulnerability handling processes (Article 13)
- Security update provision (Article 13)
- SBOM maintenance (Article 13)
- Technical documentation (Article 13, Annex VII)
- Conformity assessment (Articles 24--28)
- CE marking (Article 22)
- Reporting to authorities (Article 14)
- Cooperation with market surveillance (Article 43)
- Incident and vulnerability coordination (Article 15)

Importers and distributors have role-specific subsets drawn from their respective CRA articles.

### Obligation Statuses

Each obligation has one of three statuses:

| Status | Meaning |
|--------|---------|
| **Not Started** | Work has not begun on this obligation |
| **In Progress** | The obligation is being addressed but is not yet fully met |
| **Met** | The obligation has been satisfied, with supporting evidence in place |

### Working with Obligations

- **Inline editing** -- Change any obligation's status directly from the table by clicking the status indicator.
- **Per-product view** -- Obligations also appear on the product detail page under the Obligations tab, where you can manage them in the context of a specific product.
- **Filtering** -- The overview page supports filtering by product and by status, so you can quickly identify which obligations still need attention.
- **Auto-intelligence** -- Many obligations have their status automatically derived from platform data (e.g. SBOM presence, vulnerability scan results, technical file completion). When the auto-derived status is higher than the manual status, an "auto" badge appears. When platform data confirms a manual status, a "✓ confirmed" badge appears.

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

Within the Technical File tab, you also find the **Annex I Part I checklist** -- the 13 essential cybersecurity requirements labelled (a) through (m) (see [Section 2: Regulatory Context](#2-regulatory-context) for the full list).

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

- An **actively exploited vulnerability** in one of your products -- a vulnerability that is being used in real attacks
- A **severe security incident** that has a significant impact on the security of a product with digital elements

If in doubt, err on the side of filing. Late reporting carries regulatory consequences; over-reporting does not.

### Creating a Report

Navigate to `/vulnerability-reports` and click **New Report**. The creation form collects:

| Field | Description |
|-------|-------------|
| Product | Select the affected product from your portfolio |
| Report type | **Actively Exploited Vulnerability** or **Severe Incident** |
| Awareness date/time | When you first became aware of the issue -- this starts the deadline clock |

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

Importantly, post-close addenda are allowed -- you can submit additional intermediate stages even after a report has been closed, in case new information emerges.

### Creating a Report from a Risk Finding

If a vulnerability finding from a scan turns out to be actively exploited, you can create an ENISA report directly from the Risk Findings page. The report will be pre-populated with details from the finding (affected dependency, severity, CVSS score, description), saving you from re-entering information.

---

## 11. License Compliance

### Overview

The License Compliance page (`/license-compliance`) provides a cross-product view of the open-source licenses in your dependency tree and their compatibility with your distribution model.

### License Categories

CRANIS2 classifies every dependency's license into one of three categories:

| Category | Licences | Implications |
|----------|---------|-------------|
| **Permissive** | MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, Unlicense | No restrictions on distribution. Compatible with all distribution models. |
| **Copyleft** | GPL-2.0, GPL-3.0, LGPL-2.1, LGPL-3.0, AGPL-3.0, MPL-2.0, SSPL-1.0 | Requires derivative works to be distributed under the same or compatible terms. Impact depends on distribution model and linking method. |
| **Unknown / NOASSERTION** | No license declared, unrecognised license identifier | Requires manual review. Dependencies with no declared license may carry legal risk. |

### Distribution Model Impact

Your product's distribution model (set when creating or editing a product -- see [Section 5: Products](#5-products)) directly affects which licenses are compatible. For example:

- A **proprietary binary** distribution is incompatible with GPL-licensed dependencies unless the dependency is dynamically linked (LGPL exception)
- A **SaaS-hosted** product triggers network copyleft obligations under AGPL and SSPL
- An **internal-only** product generally has no distribution-related license obligations
- A **library component** must consider the downstream consumer's distribution model

### Compatibility Matrix

CRANIS2 includes a rules engine that evaluates every dependency's license against your product's distribution model and produces a verdict:

| Verdict | Meaning |
|---------|---------|
| **Compatible** | The license is fully compatible with your distribution model |
| **Incompatible** | The license conflicts with your distribution model -- action required |
| **Review Needed** | The compatibility is ambiguous or context-dependent -- manual review recommended |

### Cross-License Conflicts

The compatibility engine also detects **14 known cross-license incompatibilities** based on FSF guidance. These are cases where two licenses in the same dependency tree conflict with each other (e.g. GPL-2.0-only and Apache-2.0 in some configurations).

### Network Copyleft Detection

For SaaS products, CRANIS2 specifically checks for AGPL and SSPL licenses. These "network copyleft" licenses extend copyleft obligations to software accessed over a network, not just software that is distributed as a copy. If your product is distributed as `saas_hosted` and includes an AGPL dependency, it will be flagged.

### Waivers

In some cases, you may determine that a license finding does not actually apply to your situation (for example, a test-only dependency that is not included in the distributed product). You can **waive** a finding and record your reasoning. Waived findings are retained in the audit trail but excluded from active compliance counts.

### Rechecking After Changes

If you change a product's distribution model, the license compatibility verdicts may change. Use the recheck function to re-evaluate all findings against the new distribution model without triggering a full SBOM resync.

A per-product scan trigger is also available to run a fresh license scan on demand.

---

## 12. IP Proof

### What Is IP Proof?

IP Proof is CRANIS2's implementation of cryptographic timestamping for compliance evidence. It creates independently verifiable proof that a specific set of data existed at a specific point in time.

This serves several purposes:

- **Prior art** -- proving your software composition predates a competitor's patent claim
- **Compliance evidence** -- demonstrating that your SBOM or compliance state existed as of a particular date
- **Escrow verification** -- confirming the integrity of deposited materials

### How RFC 3161 Works

RFC 3161 defines a protocol for trusted timestamping. In simple terms:

1. CRANIS2 generates a SHA-256 hash of your product's composition data (the dependency graph, not your source code)
2. This hash is sent to a **Time Stamping Authority (TSA)** -- an independent, trusted third party
3. The TSA signs the hash together with the current time, creating a **timestamp token**
4. The token is stored in CRANIS2 and can be independently verified by anyone

The TSA used by CRANIS2 is **FreeTSA.org**. The resulting timestamp is recognised under the EU eIDAS Regulation (910/2014) as legally admissible evidence.

Critically, the TSA never sees your source code or even your dependency data -- it only receives a cryptographic hash. The hash alone reveals nothing about the content it was derived from.

### Viewing IP Proof Snapshots

The IP Proof page (`/ip-proof`) shows all timestamped snapshots for your products. Each snapshot displays:

- **Content hash** -- the SHA-256 hash that was timestamped
- **Verification status** -- whether the timestamp token has been validated
- **Creation date** -- when the snapshot was created

### Automatic Creation

IP proof snapshots are created automatically after every SBOM sync. The nightly SBOM auto-sync at 2 AM triggers a license scan, and the license scan triggers IP proof creation. This means your IP proof stays current without any manual action.

---

## 13. Due Diligence Export

### Overview

The Due Diligence page (`/due-diligence`) lets you generate a comprehensive, investor-ready compliance package for any of your products. This is designed for scenarios where you need to demonstrate your compliance posture to a third party: during fundraising, acquisition due diligence, customer procurement, or regulatory inspection.

### Preview Before Export

Select a product from the dropdown to see a preview of the report contents. The preview includes:

- **Summary stat cards** -- total dependencies (direct and transitive), permissive license percentage, open vulnerability count, and CRA compliance progress
- **Report contents** -- descriptions of each file that will be included in the export
- **Non-permissive dependencies table** -- a preview of dependencies with copyleft or unknown licenses (up to 20 shown, full list in the export)
- **CRA obligations summary** -- a visual overview of obligation statuses (Met, In Progress, Not Started)

### Export Contents

Clicking **Download Due Diligence Package** generates a ZIP file containing:

| File | Format | Description |
|------|--------|-------------|
| Due Diligence Report | PDF | Executive summary covering product details, dependency inventory, license compliance posture, vulnerability assessment, IP proof status, and CRA compliance progress |
| Software Bill of Materials | CycloneDX 1.6 JSON | Machine-readable dependency inventory with package hashes, licenses, and supplier data |
| License Findings | CSV | Complete list of dependencies with their licenses, categories, risk levels, compatibility verdicts, and waiver status |
| Vulnerability Summary | JSON | All vulnerability findings with severities, affected packages, CVE identifiers, and fix versions |
| Full License Texts | Text files | Complete license text for each non-permissive license found in the dependency tree |

The ZIP filename follows the pattern `due-diligence-{product-name}-{date}.zip`.

### When to Use Due Diligence Export

Common scenarios include:

- **Investor due diligence** -- providing evidence of software governance and compliance readiness during fundraising
- **Customer procurement** -- responding to supply chain security questionnaires with concrete data rather than self-declarations
- **Regulatory inspection** -- having a ready-to-share compliance package if a market surveillance authority requests documentation
- **Internal audit** -- periodic review of compliance status by your own governance team
- **Insurance applications** -- demonstrating cybersecurity maturity for cyber insurance underwriting

---

## 14. Repository Management

### The Repos Page

The Repos page (`/repos`) provides a cross-product overview of all connected source code repositories across your organisation. At the top, stat cards summarise:

- **Connected Repos** -- the total number of repositories linked to products
- **Stars** -- aggregated star count across all connected repositories
- **Forks** -- aggregated fork count
- **Open Issues** -- total open issues across all repositories
- **Contributors** -- total unique contributors
- **Stale SBOMs** -- repositories where the SBOM is out of date (a push event has been received since the last sync)

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
3. Enter the **Instance URL** -- the base URL of your self-hosted instance (e.g. `https://git.example.com`)
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

If no lockfiles are found, CRANIS2 falls back to scanning source code import statements. The import scanner supports 26 programming languages (see [Appendix D](#appendix-d-supported-languages-for-import-scanning)) and identifies dependencies by analysing `import`, `require`, `use`, `include`, and equivalent statements. This tier produces a best-effort SBOM based on observed imports, though it cannot determine exact versions.

### Source Code Privacy

CRANIS2 never stores your source code. During SBOM generation, repository contents are accessed via the provider's API, parsed in memory, and only the resulting dependency metadata is persisted. Source files are not written to disk, cached, or transmitted to any third party.

### Syncing

SBOMs can be updated in two ways:

- **Manual sync** -- Click the sync button on the product detail page or the Repos page to trigger an immediate SBOM regeneration.
- **Automatic daily sync** -- The platform scheduler runs at 2 AM UTC and syncs all stale SBOMs. Only repositories that have received changes since the last sync are processed. After SBOM sync, license scanning and IP proof generation are triggered automatically.

### Webhook-Driven Staleness

When configured, push events from GitHub, Codeberg, or Forgejo webhooks automatically mark the affected product's SBOM as stale. The Repos page and product detail page display an **Update Available** button next to stale SBOMs, allowing you to sync immediately or wait for the nightly auto-sync.

### Disconnecting a Repository

Disconnecting a repository from a product removes the live connection but preserves all previously generated compliance data -- the existing SBOM, vulnerability findings, license scan results, and IP proof snapshots remain intact. Only future syncs are stopped.

---

## 15. Contributors

### Cross-Product Overview

The Contributors page (`/contributors`) displays a grid of all contributors across your connected repositories.

### Stat Cards

At the top of the page, stat cards summarise:

- **Total Contributors** -- the number of unique individuals who have contributed to your products
- **Total Contributions** -- the aggregate contribution count across all products
- **Products with Repos** -- how many of your products have a connected repository

### Contributor Details

Each contributor card displays:

- **Avatar** -- the contributor's profile picture from the repository provider
- **Login** -- the contributor's username on the provider (e.g. GitHub handle)
- **Profile link** -- a direct link to the contributor's profile on the provider
- **Contribution count** -- the number of commits or contributions attributed to this individual

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
| **PURL** | The Package URL -- a standardised identifier for the package (e.g. `pkg:npm/express@4.18.2`) |

### Depth Indicator

Each dependency is tagged as either **direct** (explicitly declared in your project's manifest) or **transitive** (pulled in as a dependency of a dependency). This distinction is important for prioritising remediation: a vulnerability in a direct dependency is generally easier to address than one in a deeply nested transitive dependency.

### Connection to Other Features

The Dependencies page is the foundation for two downstream compliance functions:

- **License scanning** -- every dependency's licence is evaluated for compatibility with your distribution model. See [Section 11: License Compliance](#11-license-compliance).
- **Vulnerability scanning** -- every dependency is checked against vulnerability databases. See [Section 17: Risk Findings](#17-risk-findings-vulnerability-management).

---

## 17. Risk Findings (Vulnerability Management)

### Cross-Product View

The Risk Findings page (`/risk-findings`) provides a unified view of all vulnerability findings across your product portfolio. Stat cards at the top summarise findings by severity and status:

- **By severity** -- Critical, High, Medium, Low counts
- **By status** -- Total, Open, Dismissed, Acknowledged, Mitigated, Resolved

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
| **Critical** | 9.0 -- 10.0 | Red |
| **High** | 7.0 -- 8.9 | Red |
| **Medium** | 4.0 -- 6.9 | Amber |
| **Low** | 0.1 -- 3.9 | Green |

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

If a vulnerability finding represents an actively exploited vulnerability, you can create an ENISA report directly from the finding. Clicking the report button navigates to `/vulnerability-reports` with the report creation form pre-populated with data from the finding -- affected dependency, severity, CVSS score, and description. This saves time and reduces the risk of transcription errors during a time-sensitive reporting process.

### Scan History

The scan history section shows all past vulnerability scans for a product, including:

- **Status** -- completed, failed, or in progress
- **Duration** -- how long the scan took to complete
- **Dependency count** -- how many packages were evaluated
- **Per-source timing** -- breakdown of time spent querying OSV vs NVD

### Platform-Wide Scanning

The platform scheduler runs a comprehensive vulnerability scan at 3 AM UTC. This scan evaluates all SBOM components across all products on the platform, deduplicating findings to avoid alerting on the same vulnerability multiple times.

---

## 18. Billing

### Pricing Model

CRANIS2 offers two subscription tiers:

| Plan | Monthly Price | Includes |
|------|--------------|----------|
| **Standard** | €6 per active contributor | Core compliance features: SBOM, vulnerability scanning, obligations tracking, technical files, ENISA reporting, licence compliance, IP proof, escrow, due diligence, reports |
| **Pro** | €9 per product + €6 per active contributor | Everything in Standard, plus: AI Copilot (suggestions, auto-triage, risk assessment, incident drafting, category recommendation), Public API and API keys, CI/CD compliance gate, Trust Centre listings, MCP IDE integration, GRC/OSCAL bridge, Software Evidence Engine |

An active contributor is anyone who has made at least one contribution to a connected repository.

### Free Trial

Every new organisation receives a **30-day free trial** with full access to all Pro features. No credit card is required. Organisations that sign up with a bonus code (e.g. from an affiliate partner) receive a **90-day trial** instead.

### Trial Lifecycle

The trial follows a defined progression:

| Phase | Duration | Access Level |
|-------|----------|-------------|
| **Trial** | 30 days (90 with bonus code) from organisation creation | Full access to all features |
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

- **Status card** -- current billing status (trial, active, read-only, suspended)
- **Plan selection** -- Choose between Standard and Pro. Trial and cancelled organisations see a two-column plan comparison grid. Active subscribers see their current plan with an Upgrade or Downgrade button.
- **Contributor count** -- the number of active contributors driving your bill
- **CSIRT country** -- Set your organisation's default CSIRT country for ENISA reporting.
- **Billing details form** -- billing email, company name, and VAT number
- **Stripe checkout** -- subscribe or update your payment method via Stripe's hosted checkout
- **Customer portal** -- manage invoices, payment methods, and subscription details through Stripe's customer portal

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

## 19. Trust Centre

### Public Trust Centre

The Trust Centre (`/trust-centre`) is a public-facing directory of organisations using CRANIS2 to demonstrate their compliance posture. It is accessible without login, allowing prospective customers and partners to browse listed companies.

### Search and Filtering

The Trust Centre supports search by organisation name and filtering by 10 product categories:

| Category | Category |
|----------|----------|
| IoT | Enterprise |
| Industrial | Open Source |
| Automotive | SaaS |
| Healthcare | Cybersecurity |
| FinTech | Other |

### Compliance Badges

Each Trust Centre listing displays compliance badges that provide an at-a-glance summary of the organisation's posture:

- **CRA status** -- overall CRA compliance progress
- **Obligations %** -- percentage of CRA obligations marked as Met
- **Tech file %** -- percentage of technical file sections completed
- **Product count** -- number of products registered
- **Open vulnerabilities** -- count of unresolved vulnerability findings
- **Licence compliance %** -- percentage of dependencies with compatible licences

### Company Detail Page

Clicking on an organisation opens the detail page (`/trust-centre/:orgId`), which shows the full profile including description, categories, featured products, and all compliance badges.

### Contact Modal

Logged-in users can contact listed organisations through a contact modal. Rate limits are enforced to prevent abuse:

- **3 messages per day** per user across all organisations
- **1 message per organisation** per 7-day period

### Listing Your Organisation

To list your organisation on the Trust Centre, navigate to `/trust-centre/settings`. From this page you can:

- **Toggle visibility** -- turn your listing on or off
- **Tagline** -- a short one-line description
- **Description** -- a longer description of your company and products
- **Categories** -- select which product categories apply to your organisation
- **Featured products** -- choose which of your products to highlight on the listing

Trust Centre listings are auto-approved by default. Platform administrators can revoke approval for any listing if necessary. Trust Centre settings are available to organisations on the Pro plan.

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

Stakeholder roles are pre-seeded -- the roles themselves cannot be added or removed, only their details can be edited. This ensures the CRA-required roles are always present and visible. Each role displays its CRA reference, so you can see which article or annex requires that particular contact.

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
| Company size | Micro (< 10), Small (10--49), Medium (50--249), Large (250+) | Yes |
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
- License scan events
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

- **Event type** -- narrow down to specific categories of events
- **User** -- view actions taken by a specific team member

### Regulatory Significance

CRA Article 10 requires manufacturers to maintain records of compliance activities. The audit log serves as this record, providing an immutable trail of all actions that affect your compliance posture. In the event of a market surveillance authority request, the audit log demonstrates that compliance activities are tracked and attributable to specific individuals and times.

---

## 23. Account and Data Rights

### Data Export

You can export all personal data held by CRANIS2 at any time. Navigate to your Account page and select **Export My Data**. The platform generates a structured JSON file containing your account details, organisation membership, billing records, repository connections (tokens excluded), products, stakeholders, feedback, API keys (secrets excluded), recent telemetry, Copilot usage, notifications, and SEE sessions.

Categories excluded from export (with reasons) include password hashes, OAuth tokens, the immutable audit trail, and Stripe billing invoices (available directly from Stripe).

### Account Deletion

To delete your account, navigate to your Account page and select **Delete My Account**. You will be asked to confirm your password. If you are the sole administrator of an organisation, you must first transfer admin rights or delete the organisation.

On confirmation, CRANIS2 immediately deletes your user record, events, repository connections, feedback, API keys, Copilot cache, notifications, and Neo4j user node. Billing records and audit trail entries are anonymised (not deleted) for legal retention obligations. Foreign key references across 11 tables are nullified.

### Data Retention

CRANIS2 enforces documented retention periods automatically:

| Data | Retention |
|------|-----------|
| User events (telemetry) | 90 days |
| Feedback submissions | 2 years |
| Expired verification tokens | Deleted on expiry |
| Copilot response cache | 24 hours |

Platform administrators can trigger a manual retention cleanup via the Admin panel.

---

## 24. Feedback System

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
| Page URL | Automatically captured -- the page you were on when you opened the feedback modal |

All submissions are reviewed by the platform team and inform the development roadmap.

---

## 25. Affiliate Programme

CRANIS2 offers an affiliate programme that rewards partners for referring new customers.

### For Users

If you received a bonus code from an affiliate partner, enter it during signup to extend your free trial to 90 days.

### For Affiliates

Affiliates have access to a self-service dashboard (`/affiliate`) showing:

- **Referral statistics** -- Signups, active organisations, and conversion metrics
- **Commission ledger** -- Detailed log of earned commissions with amounts and descriptions
- **Monthly statements** -- Automatically generated statements summarising earned, invoiced, and paid commissions
- **Invoice submission** -- Submit invoices for commission payment

The affiliate link appears in the sidebar navigation for users who have been registered as affiliates by a platform administrator.

### For Administrators

Platform administrators manage affiliates from the Admin panel (`/admin/affiliates`):

- Create and edit affiliate accounts with configurable commission rates
- View affiliate detail pages with full ledger history
- Create manual ledger entries (credits, adjustments, payments)
- Review monthly statements and track payment status

---

## 26. Non-Profit and Open Source Access

CRANIS2 provides free access for verified non-profit organisations and qualifying open-source projects.

### Eligibility

- **Non-profit organisations** -- Must submit verification documentation via the platform. Applications are reviewed by platform administrators.
- **Open-source projects** -- Automatically classified using a trust scoring system that evaluates OSI-approved licence usage, repository activity, and community indicators.

### What Is Included

Qualifying organisations receive full platform access without contributor-based charges. The trust classification is re-evaluated periodically by an automated scheduler to ensure continued eligibility.

---

## 27. Platform Administration

### Admin Panel

The admin panel (`/admin`) is a separate, purple-themed interface available only to users with the `is_platform_admin` flag. It provides platform-wide visibility and management capabilities that go beyond any single organisation.

### Who Can Access

Platform admin access is granted at the database level. It is not a role that can be self-assigned or requested through the UI. Platform admins can access both the admin panel and their own organisation's regular interface.

### Admin Pages

The admin panel includes 10 pages:

| Page | Description |
|------|-------------|
| **Dashboard** | Platform-wide statistics: total users, organisations, products, scans run, active users over time |
| **Organisations** | Browse all organisations on the platform. View details, Trust Centre approval status. |
| **Users** | Search for users across all organisations. Suspend or unsuspend accounts, delete users (with full cascade of associated data), toggle platform admin status. |
| **Audit Log** | Cross-organisation event history. Unlike the per-org audit log, this shows events from all organisations. |
| **System Health** | Database row counts for all major tables, scan performance metrics, error rates, and system status indicators. |
| **Vulnerability Scan** | Trigger platform-wide vulnerability scans. View per-product scan breakdown and full scan history with timing data. |
| **Vulnerability Database** | Statistics for the local vulnerability database: OSV advisory count, NVD CVE count, last sync timestamps, and a manual sync trigger for on-demand updates. |
| **Feedback** | View all feedback submissions from all users. Triage submissions, add admin notes, and track resolution. |
| **Billing** | View billing status for all organisations. Extend trial periods, toggle billing exemptions, and pause payments for specific organisations. |
| **Test Results** | View Vitest backend test results and Playwright E2E test results. Drill into individual suites, test cases, and run history. |

---

## 28. Automated Background Processes

### Scheduler

CRANIS2 runs a set of background jobs on a fixed schedule. These processes maintain the platform's vulnerability database, keep SBOMs current, enforce billing rules, and deposit escrow materials without requiring any user action.

| Time (UTC) | Job | Description |
|------------|-----|-------------|
| **1:00 AM** | Vulnerability database sync | Fetches the latest advisories from OSV (263,000+ entries) and CVEs from NVD (182,000+ entries). Updates the local vulnerability database. |
| **2:00 AM** | SBOM auto-sync | Re-syncs all stale SBOMs (repositories where a push event has been received since the last sync). After sync, triggers license scanning and IP proof generation for affected products. |
| **3:00 AM** | Platform vulnerability scan | Runs a comprehensive vulnerability scan across all SBOM components on the platform. Deduplicates findings and generates notifications for new discoveries. |
| **4:00 AM** | Billing checks | Evaluates trial expiry dates and payment grace periods. Transitions organisations between billing states (trial, grace, read-only, suspended, cancelled) as appropriate. |
| **5:00 AM** | Escrow deposits | Creates or updates escrow deposits for all products with escrow enabled. Pushes selected artifacts (SBOM, findings, compliance data) to the Forgejo escrow instance. |
| **Hourly** | CRA deadline checks | Monitors all open ENISA reports for approaching or overdue deadlines. Generates notifications at 12 hours, 4 hours, and 1 hour before a deadline, and again when a deadline becomes overdue. |

### Webhooks

CRANIS2 receives webhooks from external services to maintain real-time awareness of changes:

- **GitHub / Codeberg / Forgejo / Bitbucket push events** -- When a push is made to a connected repository, the webhook marks the corresponding product's SBOM as stale. This triggers the "Update Available" indicator on the Repos page and product detail page. The stale SBOM is automatically re-synced during the 2 AM nightly job.
- **Stripe billing events** -- Payment success, payment failure, and subscription update events from Stripe are processed in real time. These events trigger billing state transitions (e.g. from active to past due) and generate user notifications.

### No User Action Required

All background processes run automatically. Users benefit from up-to-date vulnerability data, fresh SBOMs, enforced billing rules, and current escrow deposits without needing to trigger any of these manually.

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
| **Bitbucket** | OAuth | Cloud (bitbucket.org) | `https://bitbucket.org` |

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

CRANIS2's Tier 3 import scanner analyses source code import statements in 26 programming languages:

| Language | Language | Language |
|----------|----------|----------|
| JavaScript | Kotlin | Perl |
| TypeScript | C# | R |
| Python | Ruby | Lua |
| Go | PHP | Shell |
| Rust | Swift | Zig |
| Java | Objective-C | Crystal |
| Scala | C | |
| Groovy | C++ | |
| Dart | Elixir | |
| Haskell | Erlang | |

The import scanner identifies dependencies by parsing `import`, `require`, `use`, `include`, `using`, and equivalent statements specific to each language. Memory guards are in place to prevent excessive resource consumption when scanning large repositories.

---

## Appendix E: SBOM Export Formats

CRANIS2 supports exporting SBOMs in two industry-standard formats:

| Format | Version | Output | Description |
|--------|---------|--------|-------------|
| **CycloneDX** | 1.6 | JSON | OWASP standard for software bill of materials. Includes component metadata, licenses, supplier information, and package hashes. Widely adopted by security tooling and compliance frameworks. |
| **SPDX** | 2.3 | JSON | Linux Foundation standard for software package data exchange. Includes package identifiers, relationships, licence declarations, and file-level information. Required by several government procurement frameworks. |

Both formats include **SHA-512 hash enrichment** for package integrity verification, enabling downstream consumers to verify that the packages listed in the SBOM match the actual artifacts in use.

---

*End of the CRANIS2 User Guide.*

# CRANIS2 — Capabilities, Benefits & Safeguards

*A comprehensive overview for due diligence and critical evaluation.*

---

## 1. What Problem Does CRANIS2 Solve?

Two major pieces of EU legislation are fundamentally changing the software industry:

**The Cyber Resilience Act (CRA)** — Entered into force December 2024. Any product containing digital elements sold in the EU must meet cybersecurity requirements, carry a CE mark, and maintain ongoing compliance. This is not optional. Penalties reach EUR 15 million or 2.5% of global turnover.

**The NIS2 Directive** — Already being transposed into national law. Organisations operating critical infrastructure must demonstrate security baselines.

The compliance timeline is tight:

| Milestone | Date |
|---|---|
| CRA reporting obligations begin | September 2026 |
| Full CRA compliance required | December 2027 |

Most software companies — especially SMEs — have no tooling for this. They face a choice between expensive consultants, manual spreadsheets, or non-compliance. CRANIS2 is the tooling answer.

---

## 2. What CRANIS2 Actually Does

CRANIS2 connects to a company's source code repositories — GitHub, Codeberg, Gitea, Forgejo, or GitLab (including self-hosted instances) — and automatically builds compliance evidence from dependency metadata. It reads import statements but never stores, analyses or modifies source code in any way. It automates seven distinct compliance functions:

### 2.1 Software Bill of Materials (SBOM)

**What:** Automatically captures and maintains a complete inventory of every software component in a product — direct dependencies and transitive dependencies (dependencies of dependencies).

**Why it matters:** The CRA explicitly requires manufacturers to provide SBOMs. Customers and regulators will expect them in standard formats. Creating and maintaining these manually is impractical for any non-trivial codebase.

**How it works:**
- Three-tier dependency detection with automatic fallback:
  - **Tier 1 (API):** Calls the repository provider's dependency graph API (GitHub only) — fastest path
  - **Tier 2 (Lockfile Parsing):** Fetches and parses lockfiles from the repository — 28 lockfile formats supported (package-lock.json, yarn.lock, Cargo.lock, go.sum, Gemfile.lock, poetry.lock, and more)
  - **Tier 3 (Import Scanning):** Reads source files to detect import/require statements — 26 language plugins (Python, JavaScript/TypeScript, Go, Rust, C/C++, Ruby, Java, PHP, and more). Source files are read transiently and immediately discarded — nothing is stored.
- Stores dependencies in a graph database (Neo4j) with relationship tracking
- Enriches each dependency with cryptographic hashes from package registries (npm, PyPI) for integrity verification
- Exports in both CycloneDX 1.6 and SPDX 2.3 formats — the two industry standards
- Auto-syncs daily at 2 AM for any products with changes; webhooks from GitHub, Codeberg, and Forgejo flag stale SBOMs in real time
- Works with all five supported providers — Tiers 2 and 3 are provider-agnostic

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

**Why it matters:** In IP disputes, patent claims, or escrow release scenarios, you need provable evidence of what your software contained at a specific point in time. A regular backup is not legally sufficient — it can be backdated.

**How it works:**
- Generates a SHA-256 hash of the codebase composition (dependency graph, not source code)
- Submits the hash to an external Time Stamping Authority (FreeTSA.org) using the RFC 3161 protocol
- The TSA returns a signed timestamp token that cryptographically binds the hash to a specific moment in time
- This is recognised under the EU eIDAS Regulation (910/2014) as legally admissible evidence
- Automatically created after every SBOM sync — no manual action needed

### 2.5 CRA Technical File (Annex VII)

**What:** Structures the documentation required under CRA Annex VII across eight sections, with inline editing and version tracking.

**Why it matters:** The CRA requires a technical file to be maintained for every product with digital elements. This file must be available for market surveillance authorities on request. It covers risk assessment, design documentation, testing evidence, and more.

**How it works:**
- Eight structured sections corresponding to CRA Annex VII requirements
- Inline editors for each section with guidance text explaining what is needed
- Per-product, versioned documentation with status tracking (not started / in progress / complete)
- Annex I Part I checklist with 13 essential requirements and evidence fields
- Cross-product overview dashboard showing completion status

### 2.6 ENISA Reporting (CRA Article 14)

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
- Can auto-populate from a vulnerability finding — one click to initiate a report
- Stages are submitted individually with audit trail (who submitted, when)
- Dashboard showing active reports, overdue count, next deadline

### 2.7 Source Code Escrow

**What:** Enables companies to configure escrow coverage so that if they cease to operate, their clients are not left without access to the software they depend on.

**Why it matters:** B2B software customers increasingly require business continuity assurances. Escrow is a tangible trust signal during sales conversations and procurement.

**How it works:**
- Opt-in, configured per product
- Source code is deposited to a self-hosted Forgejo instance within the CRANIS2 infrastructure
- Daily automated deposits at 5 AM UTC ensure the escrow is always current
- European data sovereignty — hosted in Switzerland (Infomaniak)
- Release model is defined by the manufacturer: open-source publication or private copies to designated recipients
- Escrow deposits are preserved even after product deletion (legal retention)
- Entirely under the manufacturer's control

### 2.8 Additional Capabilities

| Capability | Purpose |
|---|---|
| **Obligations Tracking** | Maps CRA and NIS2 requirements to products, tracks status (not started / in progress / met) |
| **Stakeholders Management** | Records CRA/NIS2 contacts at org and product level (responsible persons, security officers) |
| **Due Diligence Export** | Generates a complete compliance package as a ZIP: PDF report, CycloneDX SBOM, licence findings CSV, vulnerability summary JSON, full licence texts |
| **Compliance Marketplace** | Companies can opt in to list themselves publicly with compliance badges derived from real platform data — not self-declared |
| **Notifications System** | Targeted alerts for vulnerability findings, deadline warnings, sync status, billing events |
| **Audit Logging** | Every significant action is recorded with user, timestamp, IP address, and metadata |
| **Platform Admin Dashboard** | Organisation management, user management, system health, vulnerability database status, feedback handling |

---

## 3. What CRANIS2 Is Not

Being clear about scope prevents misunderstanding:

- **Not a code scanner.** CRANIS2 reads import statements to identify dependencies, but never stores, analyses or modifies your source code in any way. It does not perform static analysis, code quality checks, or logic review.
- **Not a penetration testing tool.** It identifies known vulnerabilities in dependencies, not custom application vulnerabilities.
- **Not a consultancy replacement for novel legal questions.** It automates the mechanical compliance work. Complex legal interpretations still need human expertise.

---

## 4. How We Protect Against Abuse and Account Mimicry

This is the section that addresses the hard questions about trust, abuse, and fraud prevention.

### 4.1 Source Code Handling

The most important architectural principle: **CRANIS2 reads import statements but never stores, analyses or modifies your source code in any way.**

- **Tier 1 (API SBOM):** The provider's dependency graph API returns package names and versions as structured metadata. No source code is involved.
- **Tier 2 (Lockfile Parsing):** Lockfiles (e.g. `package-lock.json`, `Cargo.lock`) are fetched and parsed for dependency information. These are metadata files, not source code.
- **Tier 3 (Import Scanning):** Source files are read to detect import and require statements. The files are processed transiently in memory — **import lines are extracted and the source content is immediately discarded.** No source code is stored in any database, file system, or cache.

What we receive from Tier 3: `import express from 'express'` → we record "express" as a dependency. The surrounding code, logic, and algorithms are never examined or retained.

### 4.2 Authentication and Access Control

| Layer | Mechanism |
|---|---|
| **User authentication** | JWT session tokens, bcrypt password hashing, email verification required |
| **Repository authentication** | OAuth (GitHub, Codeberg) or encrypted PAT tokens (Gitea, Forgejo, GitLab) — PATs encrypted at rest using AES-256-GCM |
| **Organisation isolation** | Every database query is scoped to the user's `org_id` — there is no query path that returns another organisation's data |
| **Product ownership** | Neo4j graph relationship verification: a product must have a `BELONGS_TO` relationship to the user's organisation before any operation is permitted |
| **Role-based access** | Organisation admins vs members; platform admin middleware for system operations |
| **API route protection** | Every route implements `requireAuth` middleware — no anonymous API access to protected resources |

### 4.3 Organisation Isolation (Multi-Tenancy)

This is the primary defence against account mimicry and cross-tenant data leakage:

- **Every Postgres query** includes a `WHERE org_id = $1` clause. There is no "get all" endpoint that spans organisations.
- **Every Neo4j query** traverses from the organisation node. You cannot query a product without proving ownership through the graph relationship.
- **Product operations** require `verifyProductOwnership(orgId, productId)` — a Neo4j query that checks the `BELONGS_TO` relationship exists.
- **If a resource is not found within your organisation, you get a 404** — not a 403. This prevents attackers from distinguishing "exists but you can't access it" from "doesn't exist," eliminating enumeration attacks.

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
- GitHub and Codeberg webhooks are HMAC-SHA256 verified — the raw body is validated against a shared secret before any processing occurs
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
- System events (scheduled tasks) are logged with NULL user_id via LEFT JOIN — distinguishable from human actions
- This creates a forensic trail for investigating suspicious activity

### 4.5 What About Someone Impersonating a Company?

This is a legitimate concern. Here is how CRANIS2 addresses it:

1. **Repository authentication is the identity anchor.** You must authenticate with a real account (via OAuth or PAT) that has access to the repositories you claim. You cannot fabricate dependency data — it comes directly from the provider's API for repositories you control.

2. **Marketplace listings require admin approval.** A company cannot appear in the public marketplace without platform admin review and explicit approval. Compliance badges are computed from real platform data (vulnerability scan results, obligation completion, licence scan coverage) — they cannot be self-declared.

3. **Organisation data is self-contained.** Even if someone creates an account with a similar company name, they cannot access another organisation's products, findings, or compliance data. The multi-tenancy isolation is absolute.

4. **Contributor-based billing creates accountability.** Pricing is based on active contributors to connected repositories. This ties the account to real development activity, making it impractical to create fake accounts for mimicry.

5. **Audit logging enables investigation.** If a mimicry attempt is reported, the full history of account creation, actions taken, and data accessed is available.

### 4.6 Data We Store and Data We Don't

| We Store | We Don't Store |
|---|---|
| Package names and versions | Source code logic, algorithms, or business rules |
| Licence identifiers (SPDX) | Repository file contents (beyond transient import scanning) |
| Vulnerability findings for those packages | Commit history or diffs |
| Compliance documentation created in-platform | Private keys or secrets |
| SBOM snapshots (dependency tree structure) | Any data from non-connected repositories |
| Cryptographic hashes from public registries | Personal data beyond name, email, role |
| Encrypted repository access tokens (AES-256-GCM) | Unencrypted credentials |
| Organisation and user account data | |

---

## 5. The Business Model

Transparency on commercial incentives:

- **Contributor-based pricing:** EUR 6/month per active contributor to connected repositories
- **90-day free trial** with no payment details required upfront
- **No vendor lock-in on data:** Due diligence export provides all your compliance data in open formats (PDF, CycloneDX, SPDX, CSV, JSON) at any time
- **Billing is managed through Stripe** — CRANIS2 does not handle payment card data

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
| Hourly | CRA deadline monitoring with escalating alerts |

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

CRANIS2 automates the mechanical burden of EU cybersecurity compliance — SBOM management, vulnerability monitoring, licence compliance, IP proof, regulatory reporting, and source code escrow — so that software companies can meet CRA and NIS2 requirements without building a dedicated compliance department.

It does this while reading import statements but never storing, analysing or modifying source code in any way, with strict multi-tenant isolation, with billing accountability tied to real development activity, and with all compliance data exportable in open formats at any time.

The regulations are real, the deadlines are fixed, and the penalties are significant. The question is not whether to comply, but how efficiently.

---

*CRANIS2 — Cyber Resilience Act & NIS2 compliance, automated.*

# CRANIS2 — Executive Summary

## What Is CRANIS2?

CRANIS2 is a compliance platform that helps software companies meet the requirements of two major pieces of EU legislation: the **Cyber Resilience Act (CRA)** and the **NIS2 Directive**.

It connects to your existing source code repositories — GitHub, Codeberg, Gitea, Forgejo, or GitLab — and automatically builds the compliance evidence that regulators will expect to see. No manual spreadsheets, no expensive consultants, no guesswork.

## What Does It Actually Do?

CRANIS2 takes the dependency and component information present in your repositories and turns it into a structured compliance programme:

- **Software Bill of Materials (SBOM)** — Automatically captures and maintains an up-to-date inventory of every software component in your products, in the formats regulators expect (CycloneDX, SPDX). Uses a three-tier approach: repository API, lockfile parsing (28 formats), and source import scanning (26 languages).

- **Vulnerability Monitoring** — Continuously scans your dependency tree against a local database of 445,000+ known vulnerabilities (OSV, GitHub Advisory, NVD). Alerts are targeted to the right stakeholders, not dumped into a generic inbox.

- **License Compliance** — Classifies every dependency by licence type, flags copyleft and unknown licences, and tracks waivers. Provides a clear picture of your open-source obligations.

- **Intellectual Property Proof** — Creates cryptographically timestamped snapshots of your codebase using RFC 3161, giving you independently verifiable proof of authorship and prior art.

- **CRA Technical File** — Structures the documentation required under CRA Annex VII across eight sections, with inline editing and version tracking.

- **ENISA Reporting** — Manages the mandatory incident and vulnerability reporting workflow under CRA Article 14, with deadline tracking (24-hour early warning, 72-hour notification, 14-day final report).

- **Obligations Tracking** — Maps CRA and NIS2 requirements to your products and tracks compliance status across your organisation.

- **Source Code Escrow** — Protects your clients against business continuity risk. When setting up a product in CRANIS2, you can configure escrow coverage so that if your company ceases to operate, your clients are not left without the software they depend on. Source code is deposited to a self-hosted Forgejo instance within the CRANIS2 infrastructure, hosted in Switzerland (European data sovereignty). You choose the release model: either the source code is published as open source, or specific clients you designate receive private copies. Daily automated deposits ensure the escrow is always current.

## Why Now?

The Cyber Resilience Act entered into force in December 2024. Its requirements are phasing in on a strict timeline:

| Milestone | Date |
|---|---|
| Reporting obligations begin | **September 2026** |
| Full compliance required | **December 2027** |

The NIS2 Directive is already being transposed into national law across EU member states, with most countries requiring compliance from **October 2024** onwards.

These are not optional guidelines. The CRA carries penalties of up to **EUR 15 million or 2.5% of global turnover** for non-compliance. Products that do not meet the requirements cannot carry a CE mark and cannot legally be sold in the EU single market.

Companies that start now have time to build compliance into their workflow. Companies that wait will face a scramble — and potentially lose market access.

## Who Is It For?

CRANIS2 is built for **software product companies that sell into the EU market**, particularly:

- **SMEs and scale-ups** that lack dedicated regulatory teams but still need to demonstrate compliance
- **B2B software vendors** whose customers are beginning to ask for SBOMs and vulnerability disclosures as part of procurement
- **Any company with products containing software** that will be subject to CRA classification (the vast majority of digital products)

If you build software and have customers in Europe, this applies to you.

## "But That Means You Have Access to Our Source Code!"

**CRANIS2 reads import statements but never stores, analyses or modifies your source code in any way.**

This is the most common question we hear, and the answer is clear. Here is exactly what happens:

1. You connect your source code repository. For GitHub and Codeberg, this is via OAuth (the same mechanism used by CI/CD tools and developer platforms). For Gitea, Forgejo, and GitLab (including self-hosted instances), you provide a Personal Access Token (PAT) which is encrypted at rest using AES-256-GCM.

2. CRANIS2 identifies your dependencies using a three-tier approach:
   - **Tier 1 (API):** For GitHub, it calls the Dependency Graph API — returning package names and versions as structured metadata
   - **Tier 2 (Lockfiles):** It fetches lockfiles (e.g. `package-lock.json`, `yarn.lock`, `Cargo.lock`) and parses them to extract dependency information. 28 lockfile formats are supported.
   - **Tier 3 (Import Scanning):** It reads source files to detect import and require statements, identifying dependencies that may not appear in lockfiles. 26 language plugins are supported. **The source files are read, scanned for import statements, and immediately discarded — nothing is stored.**

3. The dependency list is what we work with. We scan it against vulnerability databases, classify licences, and track changes over time.

**What we store:**
- Package names and versions (e.g. "express 4.18.2")
- Licence identifiers (e.g. "MIT", "Apache-2.0")
- Vulnerability findings linked to those packages
- Compliance documentation you create within the platform
- Encrypted access tokens for repository connections (AES-256-GCM)

**What we never store or analyse:**
- Your source code logic, algorithms, or business rules
- Your commit history or diffs
- Your intellectual property
- Your repository contents (beyond transient import scanning)

The architecture is analogous to a pharmacist reading the ingredients list on a medicine bottle and checking each one against a safety database. They can see what goes into it. They cannot see the manufacturing process, the proprietary formula, or the factory floor.

Your code stays in your repository. We read the labels — and in some cases glance at the import lines — but your source code is never stored, analysed or modified in any way.

## How It Works Day-to-Day

Once connected, CRANIS2 runs largely on autopilot:

- **Daily at 2 AM** — SBOMs are automatically refreshed for any products with changes
- **Daily at 3 AM** — Vulnerability scans run against the updated dependency data
- **Hourly** — CRA reporting deadlines are checked, with escalating alerts as they approach
- **On every sync** — Licence compliance is re-scanned and IP proof snapshots are created
- **Daily at 5 AM** — Escrow deposits are updated for all enabled products

Your team interacts with CRANIS2 when action is needed: reviewing a new vulnerability finding, updating a compliance obligation, or submitting an ENISA report. The rest happens in the background.

## Summary

| | |
|---|---|
| **Problem** | EU legislation (CRA + NIS2) requires software companies to demonstrate cybersecurity compliance — most have no tooling for this |
| **Solution** | CRANIS2 automates SBOM management, vulnerability monitoring, licence compliance, IP proof, regulatory reporting, and source code escrow |
| **Timing** | CRA reporting obligations begin Sept 2026; full compliance required Dec 2027 |
| **Audience** | Software product companies selling into the EU, especially SMEs without dedicated compliance teams |
| **Source code** | Import statements are read but source code is never stored, analysed or modified |
| **Providers** | GitHub, Codeberg, Gitea, Forgejo, GitLab (including self-hosted instances) |
| **Deployment** | SaaS platform at cranis2.com, hosted in Switzerland (Infomaniak) |

---

*CRANIS2 — Cyber Resilience Act & NIS2 compliance, automated.*

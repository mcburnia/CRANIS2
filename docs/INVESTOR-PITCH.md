# CRANIS2 Investor Pitch

**Evidence automation infrastructure for regulated software.**

---

## The problem

Every company that builds or distributes software in the European Union will soon need to produce structured compliance evidence, continuously, tied to the actual state of their codebase. The EU Cyber Resilience Act demands technical files, vulnerability handling processes, incident reports to ENISA within 24 hours, and retention-grade documentation spanning the full product lifecycle.

Most organisations have no tooling for this. The evidence is scattered across repositories, spreadsheets, email threads, and the memories of individual engineers. Assembling it manually is slow, error-prone, and does not scale.

The penalty for non-compliance is up to EUR 15 million or 2.5% of global turnover.

---

## What we have built

CRANIS2 connects to an organisation's source code repositories and generates the compliance evidence that EU regulations require. Automatically. Continuously. Cryptographically signed and retention-grade.

This is not a GRC questionnaire tool. It reads live software data and produces structured evidence from it.

### The evidence engine

CRANIS2 generates SBOMs across six repository providers, 28 lockfile formats, and 26 programming languages using a three-tier approach: provider API, lockfile parsing, and source-level import scanning. Dependencies are stored as a graph with hash enrichment.

That graph feeds a vulnerability scanner drawing on 445,000+ advisories from OSV, NVD, and GitHub Advisory databases. Findings are attributed to affected products, triaged through a five-status workflow, and optionally assessed by AI-assisted auto-triage.

Obligation tracking covers 35 CRA requirements across three operator roles: manufacturer, importer, and distributor. Statuses are derived automatically from platform data. If an organisation has a current SBOM, a recent vulnerability scan, and a completed technical file section, the relevant obligations reflect that without manual input.

Technical file sections follow CRA Annex VII structure. Four of the eight sections auto-populate from existing platform data. An AI Copilot generates contextual content for the remaining sections, grounded in the product's actual dependencies, vulnerabilities, and configuration.

ENISA incident reporting follows the Article 14 three-stage timeline: 24-hour early warning, 72-hour notification, and 14-day final report. The system monitors deadlines, routes to the appropriate CSIRT, and auto-populates report content from linked vulnerability findings.

The compliance evidence vault stores signed snapshots with RFC 3161 timestamping and hybrid Ed25519 + ML-DSA-65 post-quantum signatures. Retention spans 10 years, backed by a reserve funding ledger and funding certificates.

An OSCAL 1.1.2 bridge exports evidence in the machine-readable format that enterprise GRC platforms, NIST frameworks, and the US FedRAMP 20x programme are converging on.

The Software Evidence Engine analyses commit history at the code level: LOC estimation, developer attribution, effort and cost calculation, and R&D evidence generation with multi-regulation report templates.

Supplier assurance runs deterministic due diligence questionnaires enriched from npm, PyPI, and crates.io registries. A public Trust Centre lets organisations publish verified compliance profiles for supply chain discovery.

### Why this is infrastructure

Every connected repository deepens the evidence graph. SBOMs feed vulnerability scans. Scans feed obligation derivation. Obligations feed technical file sections. Technical file completion feeds conformity assessments. Assessments feed the evidence vault.

The result is not a report. It is a continuously maintained, cryptographically signed evidence chain that satisfies multiple regulatory frameworks from a single source of truth.

---

## Why now

The regulatory timeline is creating forced demand. This is not discretionary spend.

| Milestone | Date | Significance |
|-----------|------|-------------|
| NIS2 transposition | October 2024 | Live. Member states enforcing. |
| CRA enters into force | December 2024 | 36-month compliance window opens. |
| CRA incident reporting | September 2026 | Mandatory 24h ENISA reporting begins. |
| CRA full compliance | December 2027 | Complete technical files, vulnerability handling, and support commitments required for all products with digital elements. |
| DORA | January 2025 | Financial sector ICT risk management. Expanding supplier assurance requirements across supply chains. |
| FedRAMP 20x | 2025 onwards | US government validating machine-readable evidence (OSCAL) as the direction of travel. |

The window between now and September 2026 is when organisations will make their tooling decisions. After that, incident reporting obligations are live and the cost of inadequate tooling becomes operational, not theoretical.

---

## Differentiation

### Repository-driven, not questionnaire-driven

Evidence comes from live source code data. Connect a repository and the platform produces SBOMs, scans for vulnerabilities, maps obligations, and populates technical files. This is structurally different from tools that rely on humans describing what their software does.

### Full evidence chain in one system

SBOM generation, vulnerability management, obligation tracking, technical file authoring, incident reporting, supplier assurance, evidence vault, and OSCAL export. Competitors address fragments. CRANIS2 produces the complete chain from source code to signed, retained evidence.

### European sovereignty

Self-hosted Forgejo escrow. EU data residency. No dependency on US cloud providers for core evidence storage. This is a procurement requirement for European public sector and large enterprise buyers, not a marketing claim.

### Post-quantum cryptography

Hybrid Ed25519 + ML-DSA-65 document signing is shipping in production. HKDF key derivation. Versioned encryption with automatic legacy migration. Evidence signed today remains verifiable when quantum computing threatens classical cryptography.

### Long-tail retention

10-year compliance vault with RFC 3161 timestamping, reserve funding ledger, and signed snapshots. Source code escrow with daily automated deposits. CRA Article 13(10) requires manufacturers to retain technical documentation for 10 years after placing a product on the market. CRANIS2 was designed around that obligation.

### Enterprise GRC interoperability

OSCAL 1.1.2 export positions CRANIS2 as a feeder into existing enterprise compliance ecosystems. Large organisations do not need another dashboard. They need structured evidence flowing into the tools they already operate.

---

## Platform expansion

The evidence model is not specific to one regulation. The core engine (repository analysis, dependency mapping, vulnerability scanning, obligation tracking, evidence generation, cryptographic signing, retention) serves multiple adjacent markets from the same architecture.

| Regulation | Evidence need | CRANIS2 capability |
|-----------|-------------|-------------------|
| CRA | Technical files, vulnerability handling, incident reporting | Core platform |
| NIS2 | Entity classification, supply chain risk, obligation tracking | Entity classifier, Article 21 risk assessment |
| DORA | ICT supplier assurance, third-party risk management | Supplier due diligence, Trust Centre, supply chain scoring |
| AI Act | Technical documentation, risk assessment, transparency obligations | Evidence engine extensible to AI-specific requirements |
| R&D tax credit | Development effort evidence, technical uncertainty documentation | Software Evidence Engine, session capture, competence profiling |
| FedRAMP 20x | Machine-readable security evidence | OSCAL 1.1.2 bridge, already shipping |

Adding a new regulation means adding obligation definitions and report templates. The evidence engine does not need to be rebuilt.

---

## Commercial model

### Pricing

| Plan | Monthly price | What it includes |
|------|--------------|-----------------|
| Standard | EUR 6 per active contributor | SBOM, vulnerability scanning, obligation tracking, technical files, ENISA reporting, licence compliance, IP proof, escrow, due diligence, compliance reports |
| Pro | EUR 9 per product + EUR 6 per contributor | Standard features, plus AI Copilot, Public API, CI/CD compliance gate, Trust Centre listings, MCP IDE integration, OSCAL bridge, Software Evidence Engine |

Free 30-day trial with full Pro access. 90-day trial with affiliate referral. No credit card required.

### How this scales

Contributor-based pricing aligns cost with compliance surface area. More contributors means more code, more dependencies, and more evidence to generate. The price tracks the value delivered.

The initial market is small and mid-sized manufacturers. They are the first to feel the CRA burden and they lack in-house compliance teams. CRANIS2 gives them evidence infrastructure without the headcount.

Enterprise expansion follows the evidence integrations. The OSCAL bridge, Public API, and CI/CD gate make CRANIS2 a feeder into existing GRC ecosystems. Large enterprises will not replace their compliance stack. They will plug structured evidence into it.

Every connected repository increases the value of the evidence graph. Each new product adds obligation mappings, vulnerability coverage, and supply chain data. The Trust Centre creates network effects as suppliers publish compliance profiles. Usage compounds.

The operating model is high-margin SaaS. No consulting dependency. No manual evidence production. The engine runs autonomously: daily SBOM syncs, nightly vulnerability scans, automated obligation derivation, scheduled retention enforcement. Marginal cost per additional customer is negligible.

### Affiliate programme

An affiliate programme is in place with commission tracking, self-service dashboards, and monthly statement automation. Referral partners extend the trial to 90 days for referred organisations, reducing acquisition friction.

---

## Product maturity

CRANIS2 is a working product with production-grade engineering discipline.

| | |
|---|---|
| Backend tests | 2,166 across 121 files, zero failures |
| End-to-end tests | ~280 Playwright tests |
| Route coverage | 79 test files covering 74 backend routes |
| Frontend | 77 page components |
| Vulnerability database | 445,000+ advisories |
| Repository providers | 6: GitHub, Codeberg, Gitea, Forgejo, GitLab, Bitbucket Cloud |
| Lockfile formats | 28 |
| Import scanning languages | 26 |
| CRA obligations | 35 across 3 operator roles |
| AI Copilot | 5 capabilities: suggest, triage, risk assessment, incident drafting, category recommendation |
| Cryptography | Post-quantum hybrid signing, HKDF, versioned encryption, key rotation tooling |
| Security hardening | Auth rate limiting, CORS restriction, port binding, credential rotation |
| GDPR | Data export, account deletion, automated retention enforcement |

---

## Summary

CRANIS2 is evidence automation infrastructure for regulated software.

The regulatory timeline is creating forced demand across the EU. CRA incident reporting begins in September 2026. Full compliance is required by December 2027. NIS2 is already live. DORA is expanding supplier assurance. FedRAMP 20x is validating machine-readable evidence as the direction of travel.

The platform generates structured, signed, retention-grade evidence from live source code data. It covers the full evidence chain in one system. It is differentiated by automation depth, European sovereignty, post-quantum cryptography, and OSCAL interoperability with enterprise GRC ecosystems.

The same evidence engine serves CRA, NIS2, DORA, AI Act, R&D tax, and FedRAMP-aligned evidence requirements. Multiple adjacent markets, one core architecture.

The commercial model scales efficiently. Contributor-based SaaS with platform-style compounding as every connected repository deepens the evidence graph.

The product is built, tested, and shipping.

---

*Loman Cavendish Limited*

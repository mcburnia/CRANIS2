<!--
  Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi@mcburnie.com
-->

# CRANIS2 Market Pitch

**Evidence automation infrastructure for regulated software.**

---

## The problem

Every company that builds or distributes software in the European Union will soon need to produce structured compliance evidence, continuously, tied to the actual state of their codebase. The EU Cyber Resilience Act demands technical files, vulnerability handling processes, incident reports to ENISA within 24 hours, and retention-grade documentation spanning the full product lifecycle.

Most organisations have no tooling for this. The evidence is scattered across repositories, spreadsheets, email threads, and the memories of individual engineers. Assembling it manually is slow, error-prone, and does not scale.

**The penalty for non-compliance is up to EUR 15 million or 2.5% of global turnover.**

---

## What we have built

CRANIS2 connects to an organisation's source code repositories and generates the compliance evidence that EU regulations require. Automatically. Continuously. Cryptographically signed and retention-grade.

**This is not a GRC questionnaire tool.** It reads live software data and produces structured evidence from it.

### The evidence engine

CRANIS2 generates SBOMs across six repository providers, 28 lockfile formats, and 26 programming languages using a three-tier approach: provider API, lockfile parsing, and source-level import scanning. The third tier is particularly significant for embedded software markets. Languages such as C, C++, and other legacy ecosystems lack standardised lockfiles, which means mainstream SCA tools either cannot generate SBOMs for them or require manual build-system plugins. **CRANIS2's import scanner analyses source code directly, producing dependency evidence for codebases that most competitors cannot reach.** Dependencies are stored as a graph with hash enrichment.

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

The result is not a report. **It is a continuously maintained, cryptographically signed evidence chain that satisfies multiple regulatory frameworks from a single source of truth.**

---

## Why now

The regulatory timeline is creating forced demand. **This is not discretionary spend.**

| Milestone | Date | Significance |
|-----------|------|-------------|
| NIS2 transposition | October 2024 | Live. Member states enforcing. |
| CRA enters into force | December 2024 | 36-month compliance window opens. |
| CRA incident reporting | September 2026 | Mandatory 24h ENISA reporting begins. |
| CRA full compliance | December 2027 | Complete technical files, vulnerability handling, and support commitments required for all products with digital elements. |
| DORA | January 2025 | Financial sector ICT risk management. Expanding supplier assurance requirements across supply chains. |
| FedRAMP 20x | 2025 onwards | US government validating machine-readable evidence (OSCAL) as the direction of travel. |

**The window between now and September 2026 is when organisations will make their tooling decisions.** After that, incident reporting obligations are live and the cost of inadequate tooling becomes operational, not theoretical.

---

## Market scale

CRANIS2 is a repository-native platform. The addressable market starts with the scale of the forge ecosystem itself.

### Repository provider volumes

GitHub remains the dominant platform by a wide margin. The October 2025 Octoverse report states **180 million developers and 630 million total repositories**, with 395 million public or open-source repositories reported separately in the same release.

GitLab officially reports 50 million registered users. A reputable public-API scan by Truffle Security counted approximately 5.6 million public GitLab Cloud repositories in November 2025. That figure excludes private repositories and self-hosted GitLab estates entirely.

Bitbucket Cloud serves 15 million developers according to Atlassian's official reporting. The same Truffle Security scan counted 2.6 million public Bitbucket Cloud repositories. Atlassian does not publish a current total repository count.

Codeberg has reached 300,000 repositories and 200,000 registered accounts as of November 2025, per its official public update. That is meaningful scale for an EU-sovereign, non-profit forge running Forgejo.

Gitea and Forgejo are predominantly self-hosted. Neither project publishes a credible global census of repositories or users across deployments. The best available figures come from public-instance discovery indexes: ecosyste.ms independently indexes 62,000 repositories across 703 public Gitea instances and 52,000 repositories across 189 public Forgejo instances. These are lower bounds, not ecosystem totals.

| Provider | Repositories | Users / developers | Metric date | Confidence |
|----------|-------------|-------------------|-------------|------------|
| GitHub | 630M total (395M public/OSS) | 180M+ developers | Oct 2025 | High |
| GitLab | ~5.6M public cloud repos | 50M+ registered users | Nov 2025 / Mar 2026 | Medium |
| Bitbucket Cloud | 2.6M public cloud repos | 15M developers | Nov 2025 / Dec 2025 | Medium |
| Codeberg | 300K+ repositories | 200K+ accounts | Nov 2025 | High |
| Gitea | 62K discoverable public repos (703 instances) | ~11.5K owners on gitea.com | Apr 2026 | Low |
| Forgejo | 52K discoverable public repos (189 instances) | Codeberg figures as lower-bound proxy | Apr 2026 | Low |

Sources: GitHub Octoverse 2025, GitLab FY2026 results and company page, Atlassian Bitbucket product page, Codeberg November 2025 newsletter, Truffle Security public-API scans (November 2025), ecosyste.ms open-data index.

### What this means for CRANIS2

The commercial inference is straightforward. GitHub, GitLab, and Bitbucket demonstrate the scale of the mainstream forge market. Every organisation using these platforms to build software with digital elements sold in the EU is a potential CRANIS2 customer once CRA obligations apply.

Codeberg demonstrates real traction for a European sovereign public forge, which aligns directly with CRANIS2's sovereignty positioning.

The self-hosted long tail (Gitea, Forgejo, private GitLab) is strategically important. These are often the organisations with the strongest data sovereignty requirements and the highest willingness to pay for managed private deployments. The absence of central telemetry across self-hosted ecosystems means the true scale is materially larger than public discovery indexes suggest.

**A significant segment within this market is embedded software.** Automotive, industrial, medical device, and IoT manufacturers are squarely within CRA scope, and their codebases are predominantly C, C++, and other languages that lack standardised package managers or lockfiles. Mainstream SCA tools have weak coverage here. CRANIS2's Tier 3 import scanner analyses source code directly, producing SBOM evidence for codebases that most competitors cannot reach. This is a structural advantage in a market segment where CRA compliance pressure will be acute.

**CRANIS2 already connects to all six of these provider ecosystems.** The platform does not need to add provider support to address the market. It needs to reach the organisations already using them.

---

## Differentiation

### Repository-driven, not questionnaire-driven

Evidence comes from live source code data. Connect a repository and the platform produces SBOMs, scans for vulnerabilities, maps obligations, and populates technical files. This is structurally different from tools that rely on humans describing what their software does.

### Full evidence chain in one system

SBOM generation, vulnerability management, obligation tracking, technical file authoring, incident reporting, supplier assurance, evidence vault, and OSCAL export. Competitors address fragments. CRANIS2 produces the complete chain from source code to signed, retained evidence.

### European sovereignty

Self-hosted Forgejo escrow. EU data residency. No dependency on US cloud providers for core evidence storage. **This is a procurement requirement for European public sector and large enterprise buyers, not a marketing claim.**

### Post-quantum cryptography

**Hybrid Ed25519 + ML-DSA-65 document signing is shipping in production.** HKDF key derivation. Versioned encryption with automatic legacy migration. Evidence signed today remains verifiable when quantum computing threatens classical cryptography.

### Long-tail retention

10-year compliance vault with RFC 3161 timestamping, reserve funding ledger, and signed snapshots. Source code escrow with daily automated deposits. CRA Article 13(10) requires manufacturers to retain technical documentation for 10 years after placing a product on the market. **CRANIS2 was designed around that obligation.**

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

## Competitor landscape

The market is fragmented. Buyers today stitch together multiple tools rather than buying one end-to-end platform. That fragmentation is strategically good for CRANIS2.

**No single vendor reviewed combines repository-native SBOM and vulnerability evidence, CRA-specific technical file workflows, CRA Article 14 reporting, OSCAL export, and cryptographically timestamped long-retention evidence in one product.** The nearest technical comparators are SBOM and SCA vendors (Snyk, Black Duck, FOSSA, Anchore). The nearest workflow and evidence comparators are GRC and trust platforms (ServiceNow, Vanta, Drata, OneTrust, RegScale, SecurityScorecard).

### Vendor profiles

**Snyk** is a developer-first SCA and application security platform with SBOM export, licence compliance, CI/CD integration and a proprietary vulnerability database. Strong in developer adoption. Weak in CRA-specific workflows.

**Black Duck** is an enterprise SCA platform emphasising open-source security, licence and IP governance, proprietary advisories and on-premise deployment. Strong in enterprise AppSec and legal teams. Weak in CRA and OSCAL workflows.

**FOSSA** is a licence-first software supply chain platform spanning SBOMs, vulnerabilities and regulatory reporting with self-hosted options. Strong in licence governance. Weak in full regulatory orchestration.

**Anchore** is an SBOM-native software supply chain platform, strong in cloud-native, public sector and air-gapped use cases. Strong in SBOM depth. Weak in GRC and business workflow layers.

**ServiceNow** is an enterprise IRM and TPRM workflow platform with strong orchestration and integrations. Workflow-native, not software-artefact-native. Weak in repository-driven evidence.

**Vanta** is a trust and compliance automation platform with a public Trust Centre, questionnaire automation, APIs and broad integrations. Strongest in cloud control evidence. Weak in software product evidence.

**Drata** is a compliance automation platform with a Trust Centre, vendor risk workflows and open API. Strongest in mid-market trust automation. Weak in CRA and software artefact depth.

**OneTrust** is a broad governance and third-party management suite with assessments, risk exchange, APIs and dedicated cloud hosting. Strong in enterprise TPRM. Weak in code-native evidence.

**RegScale** is an OSCAL-native compliance-as-code and continuous controls platform, strong in FedRAMP and ATO contexts. Strong in OSCAL. Weak in software composition depth.

**SecurityScorecard** is a supplier risk intelligence platform focused on continuous monitoring, questionnaires, trust pages and board-ready reporting. Strong in external risk scoring. Weak in software artefact evidence.

### Capability comparison

Scoring uses Yes, Partial, or No based on public product materials as at April 2026. Partial means the outcome appears achievable through adjacent capabilities, connectors, or custom workflow rather than first-class product support.

| Capability | CRANIS2 | Snyk | Black Duck | FOSSA | Anchore | ServiceNow | Vanta | Drata | OneTrust | RegScale | SecurityScorecard |
|-----------|---------|------|------------|-------|---------|------------|-------|-------|----------|----------|-------------------|
| SBOM generation (lockfile ecosystems) | Yes | Yes | Yes | Yes | Yes | No | No | No | No | No | No |
| SBOM generation (non-lockfile / legacy languages, e.g. C, C++, embedded) | Yes, via Tier 3 import scanning | Partial | Partial | Partial | Partial | No | No | No | No | No | No |
| Vulnerability database | Yes | Yes | Yes | Yes | Yes | Partial | Partial | Partial | Partial | Partial | Partial |
| Licence compliance | Yes | Yes | Yes | Yes | Partial | No | No | No | No | No | No |
| CRA technical file and DoC | Yes | Partial | Partial | Partial | Partial | Partial | No | No | Partial | Partial | No |
| ENISA / CRA reporting workflow | Yes | No | No | No | No | Partial | No | No | No | Partial | Partial |
| OSCAL export | Yes | No | No | No | No | Partial | Partial | Partial | Partial | Yes | No |
| Evidence vault with RFC 3161 and PQC | Yes | No | No | No | No | No | No | No | No | No | No |
| Supplier due diligence and Trust Centre | Yes | No | No | No | No | Partial | Yes | Yes | Yes | Partial | Yes |
| Software Evidence Engine | Yes | No | No | No | No | No | No | No | No | No | No |
| PQC signing | Yes | No | No | No | No | No | No | No | No | No | No |

### Commercial and deployment comparison

| Dimension | CRANIS2 | Snyk | Black Duck | FOSSA | Anchore | ServiceNow | Vanta | Drata | OneTrust | RegScale | SecurityScorecard |
|-----------|---------|------|------------|-------|---------|------------|-------|-------|----------|----------|-------------------|
| Deployment | SaaS + managed private | SaaS + broker | SaaS + on-prem | SaaS + on-prem | SaaS, on-prem, hybrid, air-gapped | SaaS + sovereign | SaaS + regional | SaaS + on-prem integrations | SaaS + dedicated cloud | Cloud, hybrid, on-prem | SaaS + managed |
| Pricing model | Public, per contributor and product | Public free/paid + enterprise | Custom | Free + paid | Custom | Custom enterprise | Public packages + custom | Public packages + custom | Custom and package | Custom enterprise + community | Free trial + custom |
| Target customers | EU software manufacturers, SME to enterprise | DevSecOps teams | Enterprise AppSec and legal | Software, legal, compliance | Cloud-native and public sector | Large enterprises | Start-up to mid-market | Mid-market to enterprise | Enterprise governance and TPRM | Federal and highly regulated | Enterprise TPRM and financial services |

### What differentiates CRANIS2

| Differentiator | Why it matters | Risk and mitigation |
|---------------|---------------|-------------------|
| CRA-native product workflows | Technical file, Declaration of Conformity, and Article 14 reporting are productised, not bolted on | Incumbents may add CRA templates. Mitigation: maintain deep workflow advantage beyond content packs. |
| Repository-native evidence chain | Connects live software artefacts to compliance outputs, unlike questionnaire-led tools | SCA vendors may broaden upward. Mitigation: emphasise full evidence chain and regulator-ready outputs. |
| Embedded and legacy language SBOM coverage | Tier 3 import scanning produces SBOMs for C, C++, and other non-lockfile ecosystems where mainstream SCA tools have weak or no coverage. Critical for automotive, industrial, medical device, and IoT manufacturers under CRA. | SCA vendors may extend build-system plugins. Mitigation: source-level scanning is structurally deeper than plugin-based approaches and does not require build toolchain access. |
| OSCAL bridge from EU software compliance | Bridges EU product compliance into enterprise GRC and FedRAMP-aligned ecosystems | OSCAL adoption outside federal remains uneven. Mitigation: position as interoperability enhancer, not sole value proposition. |
| Evidence vault with RFC 3161 and PQC | Long-retention legal admissibility and future-verifiable integrity are rare in this peer set | Buyers may not value it initially. Mitigation: sell into regulated procurement, escrow, and dispute scenarios. |
| Supplier assurance and Trust Centre | Extends from manufacturer compliance into DORA-style supply chain assurance | TPRM incumbents are well funded. Mitigation: target software suppliers needing artefact-backed assurance, not generic vendor risk buyers. |
| Software Evidence Engine | Commit, LOC, and R&D evidence expands the addressable market beyond security compliance | Narrative can appear too broad. Mitigation: package as adjacent module, not core wedge. |
| European sovereignty posture | Stronger fit for EU public sector and regulated procurement than US-centric trust platforms | Sovereignty claims must be provable. Mitigation: publish architecture, hosting, escrow, and residency controls clearly. |
| One-platform economics | Replaces multi-tool stacks for smaller manufacturers | Enterprises still prefer best-of-breed stacks. Mitigation: lead with SaaS for SMEs, integrate upstream and downstream for enterprise. |

### Strategic positioning

CRANIS2 is best framed as the evidence layer for regulated software, not as another compliance dashboard. That separates it from Vanta and Drata on one side and pure SCA vendors on the other.

The most likely competitive substitute is a bundle (SCA plus GRC plus TPRM), not a single rival product. The right response is integration rather than head-to-head competition. Building partner motions into ServiceNow, OneTrust, RegScale, and SecurityScorecard makes CRANIS2 a feeder into existing enterprise stacks.

Three near-term commercial moves strengthen the competitive position. First, a DORA supplier assurance pack aimed at software vendors selling into financial institutions, combining supplier questionnaires, trust profiles, evidence export, and contract-ready artefact bundles. Second, managed private deployment with standard SLA, sovereign hosting, and enterprise pricing tiers, directly addressing the biggest enterprise procurement objection. Third, deeper OSCAL integration in both directions (import, mapping, and signed export packs for major GRC destinations), increasing switching value and reinforcing the feeder positioning.

### Analyst category positioning

CRANIS2 does not fit cleanly into any single existing analyst category. That is itself a strategic signal. The product sits across at least three established market categories, and would be evaluated differently in each.

**Software Composition Analysis.** This is the most established category. Snyk and Black Duck are the leaders with large install bases and proven enterprise sales. Anchore occupies a visionary position through its SBOM-native architecture and air-gapped capability. CRANIS2 has strong SBOM capability including Tier 3 import scanning for embedded and legacy languages, but would be evaluated purely on SCA and miss the evidence chain, CRA workflows, vault, and OSCAL bridge entirely. Being placed here undersells the product.

**IT Risk Management and GRC.** ServiceNow and OneTrust dominate with massive enterprise footprints and deep workflow engines. RegScale has strong OSCAL-native vision and federal traction. CRANIS2's repository-native evidence generation is genuinely different from questionnaire-driven GRC, and the vision score would be strong. But analyst firms would score enterprise deployment breadth, SI partnerships, and customer references conservatively for a newer vendor.

**Trust and Compliance Automation.** This is the newer category where Vanta and Drata operate. They optimise for SOC 2, ISO 27001, and cloud controls. CRA and NIS2 are not their focus. CRANIS2 would appear niche in this framing despite solving a harder, regulation-specific problem with deeper software artefact evidence.

**The category that does not yet exist.** The most accurate analyst category for what CRANIS2 does, regulated software evidence platforms, has not been defined. If an analyst firm created a category for platforms that generate structured compliance evidence from live software artefacts for product-level EU regulation, the landscape would look very different. No vendor has established dominance. CRANIS2 is the only product reviewed that combines repository-native SBOM generation, CRA technical file workflows, Article 14 reporting, OSCAL export, PQC signing, and 10-year evidence vaulting in one platform. The nearest entrants (RegScale from the OSCAL side, Snyk and Black Duck from the SCA side) would need substantial product development to match that breadth.

This matters for three reasons. First, **CRANIS2 is a category-creation opportunity**. The most valuable position in a new analyst category is being the reference vendor when it forms, not competing for share in an established one. Second, the fragmented competitive landscape confirms the thesis. Buyers today would need to assemble Snyk plus ServiceNow plus Vanta plus custom OSCAL tooling to approximate what CRANIS2 delivers in one platform. **That bundle cost and integration complexity is the real competitor, not any single vendor.** Third, CRA reporting obligations go live in September 2026. When regulated software manufacturers start asking analysts what to buy for CRA compliance, the analyst firms will need a category. Being positioned as the reference vendor when that happens is a significant first-mover advantage.

### Competitive risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Incumbent bundle threat: SCA plus GRC plus TPRM partnerships displace single-tool buying | High | High | Win through integration, not replacement. Market CRANIS2 as evidence infrastructure. |
| SCA vendors add lightweight CRA and NIS2 packs | Medium | High | Maintain lead in technical file, ENISA workflow, vaulting, and sovereign evidence. |
| Enterprise deals stall on deployment model and VPC expectations | High | High | Launch managed private tier with standard architecture and commercial terms. |
| OSCAL adoption grows slower in Europe than expected | Medium | Medium | Treat OSCAL as interoperability enhancer, not the sole story. |
| Buyer confusion with Vanta and Drata-style trust platforms | High | Medium | Sharpen messaging around regulated software artefacts, not generic control evidence. |
| New-vendor credibility versus large incumbents | Medium | High | Publish reference architectures, security attestations, partner logos, and lighthouse customers. |

### Sources

Regulatory sources:

- European Commission CRA overview: https://digital-strategy.ec.europa.eu/en/policies/cyber-resilience-act
- European Commission CRA reporting: https://digital-strategy.ec.europa.eu/en/policies/cra-reporting
- European Commission NIS2 overview: https://digital-strategy.ec.europa.eu/en/policies/nis2-directive
- ESMA DORA overview: https://www.esma.europa.eu/esmas-activities/digital-finance-and-innovation/digital-operational-resilience-act-dora
- NIST OSCAL: https://pages.nist.gov/OSCAL/
- FedRAMP 20x: https://www.fedramp.gov/20x/
- FedRAMP RFC-0024: https://www.fedramp.gov/rfcs/0024/

Vendor sources:

- Snyk SBOM: https://docs.snyk.io/developer-tools/snyk-cli/commands/sbom
- Black Duck SCA: https://www.blackduck.com/software-composition-analysis-tools/black-duck-sca.html
- FOSSA SBOM management: https://fossa.com/solutions/sbom-management/
- Anchore SBOM: https://anchore.com/platform/sbom/
- ServiceNow IRM: https://www.servicenow.com/products/integrated-risk-management.html
- Vanta pricing: https://www.vanta.com/pricing
- Drata plans: https://drata.com/plans
- OneTrust TPRM: https://www.onetrust.com/products/third-party-risk-management/
- RegScale OSCAL: https://regscale.com/continuous-monitoring-built-on-oscal/
- SecurityScorecard TPRM: https://securityscorecard.com/solutions/use-cases/third-party-risk-management/

Supplementary context:

- AWS Public Sector on FedRAMP 20x automation: https://aws.amazon.com/blogs/publicsector/prepare-for-fedramp-20x-with-aws-automation-and-validation/
- Center for Cybersecurity Policy on RFC-0024: https://www.centerforcybersecuritypolicy.org/insights-and-research/fedramp-signals-acceleration-of-requirements-for-machine-readable-packages-in-the-rev5-process

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

Every connected repository increases the value of the evidence graph. Each new product adds obligation mappings, vulnerability coverage, and supply chain data. The Trust Centre creates network effects as suppliers publish compliance profiles. Usage compounds.

The SaaS operating model is high-margin. No consulting dependency. No manual evidence production. The engine runs autonomously: daily SBOM syncs, nightly vulnerability scans, automated obligation derivation, scheduled retention enforcement. **Marginal cost per additional customer is negligible.**

### Enterprise and managed deployment

Regulated enterprises that require dedicated environments, sovereign hosting, private networking, or internal-only operation can deploy CRANIS2 as a managed private instance. This is a higher-value infrastructure offering, not hosted SaaS with a support uplift.

Enterprise customers retain standard software licensing (Standard or Pro, per contributor and per product) and add an annual managed deployment subscription.

| Tier | Annual managed fee | Typical buyer | Includes |
|------|-------------------|---------------|----------|
| Enterprise Private | From EUR 75,000 | Large software vendors, regulated SMEs | Dedicated instance, managed upgrades, patching, backups, monitoring, business-hours SLA |
| Enterprise Regulated | From EUR 150,000 | Financial services, critical infrastructure, public sector | Private deployment, enhanced SLA, resilience commitments, sovereign hosting options, premium support |
| Enterprise Sovereign Dedicated | From EUR 250,000 | High-assurance and national-scale buyers | Dedicated environment, customer-controlled security options, high-assurance operations, bespoke resilience and support commitments |

Optional add-ons provide expansion revenue per enterprise account.

| Service | Indicative annual value |
|---------|----------------------|
| 24x7 premium support | EUR 20,000 to 40,000 |
| Named technical account architect | EUR 25,000+ |
| Customer-specific control mappings and regulatory extensions | EUR 30,000+ |
| Customer-managed keys, HSM, and advanced sovereignty controls | Premium priced |
| Air-gapped or isolated deployment models | Premium priced |

Implementation and onboarding services are separately priced at EUR 15,000 to 50,000 depending on scope. Migration and evidence onboarding starts at EUR 20,000. Regulatory mapping workshops start at EUR 10,000. Professional services revenue is intentionally distinct from subscription revenue.

### Blended revenue model

This creates a commercial architecture with multiple revenue layers.

SaaS subscriptions provide scalable recurring revenue through contributor and product pricing. **Enterprise managed contracts operate in the EUR 100,000 to 300,000+ annual range.** Premium services and support generate additional per-account revenue. Sovereign and regulated deployments create expansion opportunities within existing accounts.

The result is materially higher average contract value, stronger retention, and enterprise defensibility, while preserving the scalability of the self-service SaaS core.

This follows established pricing patterns from enterprise infrastructure and security vendors such as GitLab Dedicated, HashiCorp, Snyk, and ServiceNow, where **managed private deployments are typically priced at two to four times standard SaaS contract value**. The premium reflects operational responsibility, security assurance, and risk transfer.

### Affiliate programme

An affiliate programme is in place with commission tracking, self-service dashboards, and monthly statement automation. Referral partners extend the trial to 90 days for referred organisations, reducing acquisition friction.

---

## Product maturity

**CRANIS2 is a working product**, not a prototype, with production-grade engineering discipline.

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

The commercial model supports both self-service SaaS adoption and high-value enterprise infrastructure contracts. Contributor-based SaaS provides scalable recurring revenue. Managed enterprise deployments in the EUR 100,000 to 300,000+ range provide high-ACV contracts with strong retention. Every connected repository deepens the evidence graph, compounding platform value.

**The product is built, tested, and shipping.**

---

*Loman Cavendish Limited*

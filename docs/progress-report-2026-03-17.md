<!--
  Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi.mcburnie@gmail.com
-->

# CRANIS2 — Weekly Progress Report

**Period:** 10 March -- 17 March 2026
**Prepared for:** Leadership Team Meeting, 17 March 2026
**Author:** Andi McBurnie

---

## Headlines

- **178 commits** across **498 files** (~80,000 lines added)
- **12 new product features** shipped
- **8-phase Software Evidence Engine** built end-to-end
- **48-page interactive help system** with Beck map navigation
- **Test coverage** expanded to ~1,957 backend tests (109 files) and ~280 E2E tests
- **Codebase health:** 7 major route files decomposed into modular architecture

---

## Features Delivered

### 1. AI CoPilot Prompt Management (P7 #38)

**What it is:** A three-layer prompt architecture that gives platform admins full control over every AI-generated output -- the quality standard, the regulatory context, and the capability-specific instructions.

**Why it matters:** Customers can tune AI behaviour to match their organisation's tone and compliance posture without touching code. It also means we can iterate on prompt quality without deploying new releases.

---

### 2. Conformity Assessment Module (P9 #47)

**What it is:** A public-facing tool that helps manufacturers determine which conformity assessment route applies to their product under the CRA -- self-assessment, third-party, or notified body.

**Why it matters:** This is one of the most confusing parts of the CRA for manufacturers. Making it a free public tool drives awareness and inbound leads.

---

### 3. CRA and NIS2 Readiness Assessments

**What it is:** Two interactive questionnaires (CRA and NIS2) on the welcome site that score an organisation's readiness against regulation requirements, with email-verified report delivery and launch list subscription.

**Why it matters:** Lead generation. Prospects get immediate value (a readiness score and gap report) and we capture qualified leads who have self-identified a compliance need.

---

### 4. Batch Fill, Post-Scan Triage, and Onboarding Wizards (P7 #39)

**What it is:** Three guided workflows that dramatically reduce the manual effort of getting a product compliant:
- **Batch Fill** -- walks users through all 8 technical file sections and obligation evidence in one sitting
- **Post-Scan Triage** -- after a vulnerability scan, guides users through bulk accept/dismiss/defer decisions
- **Onboarding** -- one-click product setup that connects a repo, triggers SBOM sync, runs a vulnerability scan, and generates initial obligations

**Why it matters:** These remove the biggest friction points new users face. Instead of navigating dozens of screens to fill in compliance data, they follow a single guided flow.

---

### 5. GRC/OSCAL Integration Bridge (P4 #23)

**What it is:** An export layer that translates CRANIS2 compliance data into OSCAL (Open Security Controls Assessment Language) format -- the standard used by GRC tools like ServiceNow GRC, OneTrust, and Archer.

**Why it matters:** Enterprise customers already have GRC platforms. Rather than asking them to replace those tools, we integrate with them. OSCAL export means CRANIS2 data flows into existing audit workflows.

---

### 6. Role-Aware Obligation Engine -- Importers and Distributors (#45)

**What it is:** Extended the obligation engine from manufacturer-only to full CRA role support. Importers see their 10 Art. 18 obligations; distributors see their 6 Art. 19 obligations. The compliance dashboard, status derivation, and all reports are role-aware.

**Why it matters:** The CRA places obligations on the entire supply chain, not just manufacturers. This triples our addressable market by making the platform relevant to importers and distributors as well.

---

### 7. Post-Quantum Cryptography Scanner (#53)

**What it is:** A scanner that inventories all cryptographic algorithms used across a product's dependencies, flags quantum-vulnerable algorithms (RSA, ECDSA, classic Diffie-Hellman), and generates a PQC readiness score. Includes a public readiness assessment on the welcome site.

**Why it matters:** NIST's PQC standards are finalised and the CRA requires products to use "state of the art" cryptography. Organisations need to know where they stand before migration deadlines hit. Another free public tool for lead generation.

---

### 8. Post-Market Surveillance (#46)

**What it is:** Full field issues lifecycle -- logging, categorisation, corrective actions, patch tracking, and automated reporting. Wired into the obligation engine for Art. 14 vulnerability reporting.

**Why it matters:** CRA Art. 14 requires manufacturers to monitor products after market placement and report incidents to ENISA. This gives them the tooling to do it systematically rather than ad hoc.

---

### 9. Notified Body Directory and Assessment Tracking (#48)

**What it is:** A registry of EU notified bodies with their accreditation scope, plus assessment tracking so manufacturers can manage the third-party conformity assessment process from within the platform.

**Why it matters:** Products classified as "critical" or "important class II" require third-party assessment. Finding and engaging a notified body is currently a manual, opaque process. We make it searchable and trackable.

---

### 10. Market Surveillance Authority Registration (#49)

**What it is:** A registry of EU market surveillance authorities by member state, with registration tracking so manufacturers can record their regulatory submissions and correspondence.

**Why it matters:** Manufacturers must register certain products with national authorities. This centralises that record-keeping alongside the rest of their compliance data.

---

### 11. Incident Lifecycle Management (#52) and Supply Chain Risk Scoring (#51)

**What it is:**
- **Incident management** -- full lifecycle from detection through containment, eradication, recovery, and lessons learned. Includes a public readiness checklist on the welcome site.
- **Supply chain risk scoring** -- automated risk scores for every dependency based on maintenance activity, vulnerability history, licence risk, and community health.

**Why it matters:** Both are core CRA requirements. Incident management satisfies Art. 14 reporting obligations. Supply chain risk scoring supports Art. 13(4) due diligence on integrated components -- one of the gaps identified in our completeness assessment.

---

### 12. Software Evidence Engine (SEE) -- All 8 Phases

**What it is:** A complete engineering evidence extraction system that analyses git history, branch patterns, test evolution, and architecture changes to generate compliance and R&D tax evidence:

- **Phase A** -- Effort estimation with developer consent model
- **Phase B** -- Commit history analysis and developer attribution
- **Phase C** -- Branch classification (feature, bugfix, experiment, refactor)
- **Phase D** -- Experimentation detection and R&D tax report generation
- **Phase E** -- Architecture and test evolution tracking
- **Phase F** -- Evidence graph construction in Neo4j
- **Phase G** -- Multi-regulation report generation (CRA, NIS2, AI Act, DORA, ISO 27001)
- **Phase H** -- Development session capture with competence profiling

**Why it matters:** This is a unique capability. No competitor extracts compliance evidence directly from engineering activity. For UK customers, Phase D generates evidence that directly supports HMRC R&D tax credit claims. For all customers, it provides auditable proof that security was considered throughout the development process -- a core CRA requirement.

---

## Platform Quality and Infrastructure

### Interactive Help System (48 pages)

Built a complete context-aware help system using a Beck map (London Underground-style) navigation design. The help panel opens alongside any page and automatically selects the relevant guide. All content follows our editorial standard with regulatory citations.

**Why it matters:** Reduces support burden and helps users self-serve. The contextual awareness means users see relevant guidance without searching.

### Codebase Modularity Refactoring

Decomposed 7 large route files and the product detail page into focused, maintainable modules. No functionality changed -- purely structural improvement.

**Why it matters:** Development velocity. Smaller, focused files are faster to navigate, easier to test, and reduce merge conflicts as the team grows.

### Test Infrastructure Hardening

- Fully isolated test stack (separate backend, Neo4j, and Postgres instances)
- 5-layer safety preventing tests from ever touching live data
- API client retry logic eliminating flaky failures from transient socket errors
- Nightly automated test runs with Trello notifications

### Editorial Standard

Established and applied a consistent editorial standard across all product copy, documentation, and AI-generated content. British English throughout, no em dashes, consistent terminology, regulatory citation format.

---

## By the Numbers

| Metric | Start of Week | End of Week |
|--------|--------------|-------------|
| Backend tests | ~1,650 | ~1,957 |
| E2E tests | ~240 | ~280 |
| Test files | ~95 | 109 |
| Route test coverage | ~90% | 98.5% |
| Help guide pages | 0 | 48 |
| CRA obligations tracked | 19 (manufacturer only) | 35 (manufacturer + importer + distributor) |
| Public assessment tools | 1 | 6 |

---

## Week Ahead -- Priorities

1. **Help guide stub rewrites** -- 15 remaining stubs need full content (P1 guides next)
2. **Template library** (P6 #37) -- remaining policy document templates
3. **CRAD exploration** -- vision scope drafted for a sister advisory database product covering Tier 2/3 language ecosystems
4. **Production readiness** -- final pre-launch checks

---

*Report generated 17 March 2026*

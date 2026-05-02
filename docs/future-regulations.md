<!--
  Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi@mcburnie.com
-->

# CRANIS2 — Adjacent Regulatory Opportunities

**Last updated:** 2026-03-16

The research identifies five strong candidates, ranging from near-term adjacencies where CRANIS2 already has substantial capability overlap, to longer-term expansion plays requiring new feature investment.

---

## 1. EU AI Act — Strongest Adjacency

**Status:** Phased enforcement. GPAI model obligations active since August 2025. High-risk AI system obligations for embedded products run to August 2027.

**Why it matters for CRANIS2:** Providers of high-risk AI systems must maintain a full Technical Documentation dossier under Article 11 and Annex IV, covering system design, data governance, risk assessments, test results, user instructions, an EU Declaration of Conformity, and operational logs. That is structurally near-identical to the CRA Technical File pattern CRANIS2 already implements.

Additionally, there is emerging work on an AI-SBOM concept, a Bill of Materials for AI systems, targeting the transparency obligations in Articles 13 and 52 of the Act, intended as a single point of truth for collecting and sharing information throughout the AI value chain.

**Capability overlap with CRANIS2:**
- Technical File → AI Technical Documentation (Annex IV)
- Declaration of Conformity → EU Declaration of Conformity (Article 47)
- Post-market monitoring → AI Act Article 72 post-market monitoring plan
- ENISA incident reporting → AI Act serious incident reporting (Article 73)
- Obligations tracking → AI Act's layered obligations across providers, importers, deployers

**Gap:** AI Act compliance requires data governance records, model training data documentation, and human oversight evidence, none of which map to CRANIS2's current SBOM/dependency model. This is genuinely new territory, not a surface remap.

**Assessment:** High-value expansion. Many CRANIS2 customers building AI-embedded software products will face both CRA and AI Act obligations simultaneously. A combined compliance programme is a compelling proposition.

---

## 2. EU Product Liability Directive (PLD) — Urgent Risk Amplifier

**Status:** Directive 2024/2853 takes effect 9 December 2026. Member states are already publishing draft national implementing laws.

**Why it matters:** The PLD explicitly includes software, AI, and digital services within the definition of products subject to strict liability. Non-compliance with cybersecurity requirements or failure to provide security updates can constitute a product defect. Companies cannot contractually exclude or limit their liability for software or cybersecurity defects.

Critically, the PLD's new rules on evidence and presumptions mean that if a company cannot demonstrate compliance with vulnerability management and coordinated disclosure processes, courts may presume defectiveness or causation in favour of the claimant, especially in technically complex cases involving digital products or AI.

**Capability overlap with CRANIS2:** This regulation is less about generating compliance artefacts and more about having them available as legal defence evidence. CRANIS2's evidence vault, RFC 3161 timestamps, SBOM history, and vulnerability tracking records are precisely what a company would need to rebut a PLD defectiveness claim.

**Assessment:** Not a new product line, a new value framing for CRANIS2's existing evidence capabilities. The PLD makes the compliance evidence vault a legal risk management tool, not just a regulatory filing requirement. This should be reflected in messaging and potentially in a dedicated "PLD Defence Pack" export feature.

---

## 3. DORA (Digital Operational Resilience Act) — Sector-Specific, High Fit

**Status:** In force and directly applicable across all EU member states since 17 January 2025.

**Who it catches:** Banks, insurance companies, investment firms, and, critically for CRANIS2's potential customer base, ICT third-party service providers to the financial sector. Any software company supplying systems to financial entities may be classified as a critical ICT third-party provider.

**SBOM angle:** DORA requires financial entities to develop vulnerability management procedures that include tracking third-party libraries, including open source. Although DORA does not use the word "SBOM", a machine-readable structured software inventory is the most practical way to ensure compliance. Furthermore, DORA demands continuous monitoring of the software supply chain. It is not enough to have an SBOM at one point in time.

**Capability overlap with CRANIS2:** Strong. SBOM generation, continuous vulnerability scanning, dependency tracking, third-party risk management questionnaires, and incident reporting are all present. The daily SBOM refresh cycle aligns directly with DORA's continuous monitoring expectation.

**Assessment:** A targeted vertical play. CRANIS2 should consider whether a DORA compliance module, positioned at ICT third-party service providers, is viable, potentially as a lighter, financially-sector-specific variant of the CRA programme.

---

## 4. EU Data Act — Emerging Obligation for Connected Product Makers

**Status:** Applicable since September 2025, with access-by-design requirements for new connected products taking effect September 2026.

**Why it matters:** The Data Act places obligations on manufacturers and suppliers of connected products to design products so that product data and associated service data are accessible to users by default. From 2026 it becomes a product and development-related compliance requirement.

**Capability overlap with CRANIS2:** Weaker than the others. The Data Act is primarily about data portability, switching rights, and B2B data access, not security documentation. However, companies building connected products face both CRA and Data Act obligations simultaneously. A "connected product compliance" framing that packages both could reduce customer friction.

**Assessment:** Indirect adjacency. Worth monitoring rather than building towards immediately. The Digital Omnibus package is also seeking to harmonise obligations across the AI Act, GDPR, NIS2, DORA, and the Data Act with a single incident reporting point, which, if it passes, would make a unified compliance platform significantly more attractive.

---

## 5. General Product Safety Regulation (GPSR) — Broader Safety Net

**Status:** In force since December 2024, with market surveillance expected to intensify through 2026. Commission guidance issued in 2025 clarifies that the definition of "product" covers digital and hybrid products.

**Why it matters:** The GPSR is the catch-all product safety framework for any product not covered by sector-specific legislation. It captures software products that fall outside the CRA's precise scope, and the guidance now explicitly addresses digital products.

**Capability overlap with CRANIS2:** Moderate. GPSR requires post-market monitoring, incident reporting, and corrective action management, all of which CRANIS2 already implements for CRA. The regulatory framework differs, but the operational evidence requirements are comparable.

**Assessment:** Useful as a safety net proposition. Software makers unsure whether they fall under CRA or GPSR could use CRANIS2 to cover both bases. Requires a light mapping exercise rather than significant new development.

---

## Summary Table

| Regulation | Enforcement | Capability Overlap | Effort to Serve | Priority |
|---|---|---|---|---|
| EU AI Act | Aug 2026 / Aug 2027 | High (Technical File, DoC, post-market) | Medium-High (new data governance layer needed) | 1st |
| Product Liability Directive | Dec 2026 | High (evidence vault = legal defence) | Low (reframing + export feature) | 2nd |
| DORA | Jan 2025 (live) | High (SBOM, vulnerability tracking, incident reporting) | Low-Medium (vertical positioning) | 3rd |
| GPSR | Dec 2024 (live) | Medium (post-market, corrective actions) | Low (mapping exercise) | 4th |
| EU Data Act | Sep 2026 | Low (different obligation type) | High (new capability) | Watch |

---

## Digital Omnibus Package

Also worth tracking. It proposes a single incident reporting point and aligned breach notification thresholds and timelines across the AI Act, GDPR, NIS2, DORA, and the Data Act, which, if passed, creates a natural home for a unified reporting workflow inside CRANIS2.

The near-term commercial opportunity is the PLD reframing (low effort, high leverage) and a DORA vertical pitch at ICT software suppliers to financial entities. The AI Act is the medium-term strategic bet.

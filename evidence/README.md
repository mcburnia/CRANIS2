<!--
  Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi@mcburnie.com
-->

# CRANIS2 — Evidence Locker

This directory holds source documents that establish the **timeline, provenance, and personal authorship** of CRANIS2. Each entry records:

- **Date** — when the document was created or when the recorded event occurred
- **Source** — who authored or issued the document
- **Role at the time** — Andrew (Andi) MCBURNIE's relationship to the document
- **What it establishes** — why this document is part of the CRANIS2 evidence chain
- **Access notes** — confidentiality, redistribution, or handling considerations

## Why this exists

CRANIS2 is, and has always been, the personal work of **Andrew (Andi) MCBURNIE**. The evidence locker preserves the original artefacts that document when and how the project came into being, and supports the unbroken personal-IP lineage that will eventually be assigned to a UK limited company at the point of seed investment.

The locker is **not** the project's documentation. Project documentation lives in [`docs/`](../docs/). The locker is the source-of-truth audit trail behind the timeline.

## Storage policy

Binary documents (`*.pdf`, `*.docx`, `*.xlsx`, etc.) are listed in `.gitignore` and are **not** committed to the repository. Only this `README.md` index is tracked in git, so the existence of each piece of evidence is recorded without the documents themselves being distributed via remote git hosts.

When a binary is referenced below, it should exist locally on disk at `evidence/<filename>`. If it is missing, refer to the original source listed in the entry.

## Index

### Entry #1 — SNRG Year 1 Cybersecurity Maturity Assessment

| Field | Value |
|---|---|
| Date | June 2023 (V1.0); subsequent V1.1 QA review |
| Source | FTI Consulting LLP (Cybersecurity practice) |
| Issued for | SNRG Limited (a previous employer of Andrew (Andi) MCBURNIE) |
| Andi's role at the time | CTO, SNRG Limited — primary stakeholder, interviewee, and named recipient of the report |
| Filename | `2023-06-snrg-nist-assessment.pdf` |
| Classification | TLP AMBER · FTI–SNRG Confidential |

**What it establishes:**

This report is the documented external trigger for what later became CRANIS2. As CTO of SNRG, Andrew was a primary participant in the assessment process (kick-off 16 May 2023, context establishment 31 May 2023, NIST readout 13 June 2023, draft readout 27 June 2023). Direct exposure to the report's findings — particularly the systemic gaps in vulnerability management, incident response, supply-chain controls, penetration testing, and security documentation that small-and-medium organisations face — established the **problem space** that the embryonic ideation of CRANIS2 set out to address.

**Timeline anchor:**

- **June 2023** — Report issued; Andrew exposed to detailed findings
- **August 2023** — Embryonic ideation of CRANIS2 begins (originally unnamed; the "CRANIS2" name was coined in early 2026)
- **2024** — EU Cyber Resilience Act enters force (10 December 2024); CRANIS2 design work intensifies as a regulatory-aware response to the same problem space
- **2025–2026** — Working code, launch readiness, and the artefacts visible in this repository

The report therefore pre-dates the CRANIS2 work as a *triggering event* and is **not** itself part of CRANIS2 IP. CRANIS2 IP begins with Andrew's personal ideation in August 2023 and onwards.

**Access notes:**

The document is FTI Consulting's intellectual property, prepared for SNRG. Andrew holds a rightful personal copy as a former officer of SNRG and as a named participant in the assessment. The TLP AMBER marking restricts onward sharing without FTI's permission. The document must not be redistributed, posted to public services, included in customer-facing materials, or shared outside this evidence locker without express FTI consent. It is held here solely to evidence the timeline of CRANIS2's origin.

---

*Future entries will be added below as further timeline-establishing documents are added.*

# CRANIS2 — CRA Gap Analysis

**Date:** 2026-05-06
**Author:** Andi McBurnie (with Claude Code session 65)
**Source conversation:** session transcript `c643b171-3353-4f30-9574-d349b8801787` (2026-05-06 11:56 CEST)
**Jira project:** [CRAN — andimcburnie.atlassian.net](https://andimcburnie.atlassian.net/jira/software/projects/CRAN/boards/34)

This document inventories what CRANIS2 actually does today against what compliance staff at a software-engineering company actually have to do operationally — ranked by leverage. It is the seed for the CRAN-1 through CRAN-22 epics in Jira plus a CRA-completeness audit backlog.

---

## Baseline — what CRANIS2 covers today

The baseline to push against. This is the foundation; everything below is *gap-filling on top of it*.

**CRA — broad and deep:**

- 35 obligations modelled across manufacturer / importer / distributor roles (`obligation-engine.ts`)
- 8-section technical file (Annex VII) with AI-assisted authoring + auto-fill
- 7 document templates (CVD policy, end-of-support, incident response, SDLC, security update, versioning, vulnerability handling)
- SBOM generation + storage + 30+ ecosystem support
- Vulnerability scanning across NVD/OSV/GHSA + (after P10) KEV/EPSS enrichment
- Conformity assessment workflow + EU DoC + CE marking machinery
- Notified-body catalogue
- 10-year compliance vault with RFC 3161 + Ed25519 + ML-DSA signed archives
- **Art. 14 reporting fully automated end-to-end** (P10): detection → awareness attestation → trigger → escalating deadlines → submit-with-authorisation
- Supplier due diligence
- Software escrow

**GDPR — narrow:**

- Data export endpoint
- Account deletion endpoint
- Privacy Policy + Terms + cookie consent on CRANIS2's own welcome site

**NIS2 — referenced but unmodelled:**

- Mentioned in metadata, no obligation tracking, no parallel reporting track

**Other:**

- Trust Centre (supplier-published profiles)
- Public API + CI/CD gate + MCP server + IDE assistant
- Activity log per product
- Compliance snapshots + retention ledger

That is a substantial baseline. The gaps below are things CRANIS2 *could* absorb but currently leaves to the engineer / compliance officer.

---

## Tier 1 — high leverage, currently manual, high frequency

Where a single CRANIS2 feature would save dozens of person-hours per customer per year.

### 1. Coordinated Vulnerability Disclosure intake *(CRA Art. 13(6))*

CRANIS2 generates the *policy* but doesn't run the *channel*. A security researcher reporting a vulnerability today emails `security@<customer>.com`, the email lands in a shared inbox, someone triages it manually, the 90-day disclosure clock runs in someone's head.

**What CRANIS2 should add:** hosted intake form per product (e.g. `cranis2.com/cvd/<org>/<product>` or customer-domain-mapped) → optional PGP encryption → automatic triage ticket → routed to the same `vulnerability_findings` table as scan results → 90-day disclosure timer with bell + email escalations → public-acknowledgements page when researcher consents → automatic feed into Art. 14 trigger if validation confirms active exploitation.

**Why high-leverage:** every CRA-regulated company needs this, almost none have it built well, and the alternative (HackerOne, BugCrowd) costs $5–50k/year. CRANIS2 absorbs it as a feature.

### 2. Customer-facing SBOM publication endpoint *(CRA Art. 13(11))*

CRANIS2 generates SBOMs internally. But the manufacturer's own customers — particularly the NIS2-regulated ones — increasingly demand SBOMs as part of vendor onboarding. Today the manufacturer emails a CycloneDX file every time a customer asks.

**What CRANIS2 should add:** per-product, per-version tokenised SBOM URL (`cranis2.com/sbom/<token>` with revocable, audit-logged access) — the manufacturer hands a customer a URL and the customer always gets the latest SBOM for the version they're using, signed and verifiable.

**Why high-leverage:** turns "send me your SBOM" emails (50–500/year for a B2B SaaS) into one URL. Bonus: every customer-side fetch is a CRANIS2 referral.

### 3. Customer security questionnaire auto-answering *(cross-regulation, but very GDPR/NIS2-heavy)*

Enterprise customers send SIG Lite / CAIQ / custom 200-question questionnaires before signing. Today engineers spend a half-day per questionnaire copy-pasting from previous answers.

**What CRANIS2 should add:** import standard questionnaires (SIG Lite, CAIQ v4, Common Assessment Framework) → AI-fill from CRANIS2 evidence base (tech file + obligations + scan results + Trust Centre profile) → human reviews + edits → export as the customer's required format (PDF, Excel, JSON-API). Reuses a lot of P3 #20 (compliance gap narrator) infrastructure.

**Why high-leverage:** sales cycle accelerator. A B2B SaaS doing 30 enterprise deals a year saves ~120 person-days.

### 4. Single-incident → multi-track regulatory notification *(CRA + NIS2 + GDPR)*

CRANIS2 currently models CRA Art. 14. A serious incident often triggers more:

| Trigger | Authority | Deadline |
|---|---|---|
| Actively-exploited vuln in CRA product | ENISA + CSIRT | 24h / 72h / 14d ✓ |
| Significant incident in NIS2 entity | National CSIRT | 24h / 72h / 1m ✗ |
| Personal-data breach | Supervisory Authority (e.g. CNIL, ICO) | 72h ✗ |
| Material event for listed company | Stock exchange | varies ✗ |
| Sectoral (banking / energy / health) | Sector regulator | varies ✗ |

**What CRANIS2 should add:** intake an incident once; the system asks "which regulatory tracks does this trigger?" (with auto-detection from product attributes — does it process personal data? Is the customer NIS2-regulated? etc.) and produces parallel reports tailored to each authority, each with its own deadline track and submission attestation.

**Why high-leverage:** a single bad day for a customer becomes one workflow in CRANIS2 instead of 3-5 independent panic-driven processes. This is the most regulatorily-distinctive feature in the gap list — almost nobody else does it.

### 5. Substantial-modification detection *(CRA Art. 32 + Annex VII)*

Under CRA, a "substantial modification" — material change to functionality, threat surface, or essential cybersecurity properties — re-triggers the conformity assessment. CRANIS2 already tracks SBOM diffs, version history, and tech-file changes per product. Today, deciding whether a release is a "substantial modification" is a manual judgement call.

**What CRANIS2 should add:** a deterministic+AI "substantial modification detector" that flags releases where any of: major-version bump, new high-CVSS dependency added, new external network surface, new data class processed, removal of a security control. Output: "this release likely needs re-CA — confirm or override" with audit trail.

**Why high-leverage:** the alternative is to either re-CA every release (massively over-conservative) or get caught by a regulator for skipping a re-CA on a material change. CRANIS2 turns a high-stakes legal judgement into a checkable signal.

### 6. GDPR Article 30 RoPA — Records of Processing Activities

Every controller processing personal data needs a RoPA. CRANIS2 has all the inputs already — supplier list (sub-processors), product list (purposes), data categories implicit in obligations — but doesn't emit a RoPA document.

**What CRANIS2 should add:** new tech-file-style section "Data Processing Activities" → AI-fill from existing data → export as the standard CNIL / ICO RoPA template. Updates whenever sub-processors or purposes change.

**Why high-leverage:** every GDPR-regulated company maintains this. Most do it in spreadsheets. CRANIS2 has 60% of the source data already.

### 7. Sub-processor list with auto-publication *(GDPR Art. 28(2))*

If a manufacturer uses AWS, Stripe, Anthropic, etc. as sub-processors, they need a public list + advance-notification on changes. CRANIS2 already knows the SBOM, supplier-due-diligence, and category of each dependency.

**What CRANIS2 should add:** flag each supplier as "data processor / not" → auto-publish `cranis2.com/subprocessors/<org>/<product>` → diff-detection on changes triggers customer-notification email via existing alert infrastructure.

**Why high-leverage:** GDPR-required, customers ask for it, currently maintained by hand on a static page that goes stale.

---

## Tier 2 — meaningful but periodic / specialist

### 8. Audit-ready evidence bundle / scoped auditor portal

When a market-surveillance authority asks for evidence, today the manufacturer manually exports tech file + DoC + SBOM + vuln history + incident log. P8 vault generates archives, but there's no "auditor request" workflow.

**What CRANIS2 should add:** "Generate Auditor Bundle" button → ZIP of all relevant artefacts + their TSA tokens + a verification README → optionally a time-limited read-only auditor portal URL with audit-logged access.

### 9. Standards mapping + harmonised standards catalogue *(CRA Art. 32)*

Art. 32 says "where harmonised standards exist, conformity assessment shall reference them." EN 18031 (cyber for radio equipment), IEC 62443 (industrial), ETSI EN 303 645 (consumer IoT), ISO/IEC 27001, etc. Today the engineer fills in `standards_applied` from memory.

**What CRANIS2 should add:** curated catalogue of EU harmonised standards by product category → recommend applicable standards based on CRA category + product type → generate compliance matrix mapping each standard's clauses to evidence in the tech file.

### 10. Notified Body workflow orchestration *(CRA Art. 32(3))*

For Important Class II / Critical products, you need a notified body. CRANIS2 lists them; doesn't manage the engagement: NB selection → tech-file submission to NB → review tracking → cert storage → re-trigger on substantial modification.

**What CRANIS2 should add:** end-to-end NB engagement workflow with state tracking + document handoff + cert management. Tier 2 because few products are Critical, but for those few it's high-stakes.

### 11. DPIA generator *(GDPR Art. 35)*

CRANIS2 already has a CRA risk-assessment generator (P3 #16). A close cousin could generate a Data Protection Impact Assessment.

**What CRANIS2 should add:** parallel `generate-dpia` Copilot capability reusing the same product-context gathering, tailored to GDPR Art. 35's required content (purpose, necessity, risks to rights, mitigations).

### 12. Internal policy attestation tracking *(Annex I Part II + ISO 27001 + SOC 2)*

"All employees have been trained on the vulnerability handling policy" — every framework asks for evidence. Today: PDF emails + spreadsheets.

**What CRANIS2 should add:** publish-to-employees workflow → each employee electronically signs (with timestamp + IP) → attestation log per policy version → automatic re-attestation on policy update.

### 13. External evidence intake / "evidence dropbox"

Pen-test reports, audit reports, supplier compliance certs arrive as PDFs by email. CRANIS2's tech file is structured but doesn't ingest unstructured PDFs.

**What CRANIS2 should add:** drag-and-drop PDF → AI-extract metadata (issued by, dates, scope) → suggest which obligation(s) this is evidence for → attach to tech file or vault with attestation chain.

### 14. DPA / SCC generator *(GDPR Art. 28)*

When a customer signs a contract, they often demand a Data Processing Agreement with EU Standard Contractual Clauses. Today: legal pulls a template.

**What CRANIS2 should add:** customisable DPA generator pulling org details + sub-processor list + TOMs → exports signed PDF. One-click for sales.

### 15. Open Source Steward simplified workflow *(CRA Art. 24)*

CRANIS2's CraRole supports `open_source_steward` but the obligations are pruned to manufacturer's. Stewards have a deliberately lighter regime — there should be a tailored workflow that doesn't show them irrelevant manufacturer-only obligations and emphasises the steward-specific content.

---

## Tier 3 — strategic / forward-looking

### 16. AI Act overlap

If the customer's product uses AI, the EU AI Act stacks on CRA. Risk classification, transparency, data governance. Not yet modelled.

### 17. NIS2 risk-management measures *(Art. 21, 10 categories)*

NIS2 entities (often the customer of CRANIS2 customers) need a structured 10-point matrix. Currently CRANIS2 covers some via supplier-due-diligence + escrow but not as a structured NIS2 view.

### 18. Compliance calendar — unified regulatory due-date tracking

CRA Sep 2026, CRA Dec 2027, NIS2 transposition deadlines, GDPR DSR response deadlines, AI Act phase-ins. Some of this is in the smart deadline alerts; most isn't.

### 19. Multi-product policy templating

Small company with 5 products shouldn't write 5 separate CVD policies — master policy + per-product overrides. Currently every product gets its own copy.

### 20. Cyber-insurance evidence export

Cyber insurers (Beazley, Coalition, Hiscox) increasingly demand compliance evidence. Plug-in export adapters per insurer.

---

## The strategic 10x frame — single source of truth → many regulatory dialects

Items 4 (single-incident multi-track) + 6 (Art. 30 RoPA from CRA tech file) + 11 (DPIA from CRA risk assessment) + 14 (DPA from CRANIS2 evidence) all share a theme:

**The same underlying facts get reframed for different regulations.** CRANIS2 already captures the facts (tech file, suppliers, dependencies, incidents, awareness moments). What it doesn't yet do is **emit them in the dialect of each regulation that's interested**.

That is the strategic frame for the next epic-cluster: **"single source of truth → many regulatory dialects"**. A customer enters their data once into CRANIS2's CRA-shaped model, and CRANIS2 translates it on-demand into NIS2 reports, GDPR Art. 30 records, DPIAs, DPAs, sub-processor pages, customer questionnaires, auditor bundles, and insurance applications.

This is the frame that turns CRANIS2 from "CRA compliance tool" into **"the EU regulatory nervous system for software companies"** — and it is defensible because the 60-80% upfront data ingestion (already built) is the moat.

---

## CRA-Completeness Audit — for separate consideration *(backlog)*

The 20 gaps above are scoped against an honest cross-regulation operator's view. For *true CRA totality from a software engineer's perspective*, the following six items round out CRA itself. They are not in the primary 22-epic plan; they live in the Jira backlog with `cra-completeness` and `priority:backlog` labels and can be promoted to an epic at any point.

### CRA-A. Annex II "User Information & Instructions" pack generator *(CRA Art. 13(12) + Annex II)*

The technical file is for *regulators*. Annex II is the **user-facing** pack: cybersecurity properties for the end user, type and period of technical security support, instructions for secure installation/configuration/use/maintenance, effects of modifications/connections on security, where to find the DoC, single point of contact for vulns. CRANIS2 has the source material but emits no user-facing pack.

### CRA-B. CSAF v2.0 advisory feed per product *(CRA Art. 13(8))*

Art. 13(8) requires manufacturers to publicly inform users when a security update is available, "in a clear and easy-to-understand way." Industry direction (and increasingly assumed in EU practice) is a machine-readable CSAF v2.0 advisory feed at a well-known URL per product. CRANIS2 has the underlying vuln + fix data; doesn't emit CSAF.

### CRA-C. Per-component due-diligence record *(CRA Art. 13(3))*

Manufacturers must "perform due diligence" when integrating third-party components. CRANIS2 has supplier-due-diligence (whole supplier) and SBOM (component listing), but no structured per-component DD record (integrity check, vulnerability check at integration time, signed attestation that DD was performed). Currently inferred from SBOM scan; should be a first-class auditable artefact.

### CRA-D. Art. 14(1)(b) severe-incident auto-trigger

P10 fully automated the Art. 14(1)(a) actively-exploited-vulnerability path: detection → awareness attestation → trigger → deadline track → submission. Art. 14(1)(b) — severe incidents impacting product security (not necessarily tied to a specific vuln) — has its own 24h/72h/1m clock and is currently a manual trigger. The infrastructure is shared with P10; what's missing is the trigger criteria + report-content variant.

### CRA-E. Authorised-representative role + obligations *(CRA Art. 12)*

Where the manufacturer is established outside the EU, an authorised representative is required. CRANIS2's `CraRole` enum currently covers manufacturer / importer / distributor / open_source_steward — there is no `authorised_representative`. For non-EU manufacturers serving the EU market this is a structural gap.

### CRA-F. Module A self-assessment record output *(CRA Art. 32(2)(a))*

For Important Class I products, manufacturers may use Module A — internal production control, no notified body. CRANIS2 captures the inputs but does not emit a structured "Module A self-assessment record" that an auditor or market-surveillance authority can review as a single artefact.

---

## Jira mapping

The doc is the seed; Jira is the working set. See `andimcburnie.atlassian.net/jira/software/projects/CRAN`.

| Epic | Title | Tier | Status |
|---|---|---|---|
| CRAN-1 | Baseline — CRANIS2 current coverage | — | Done |
| CRAN-2 | CVD intake channel | T1 | To Do |
| CRAN-3 | Customer-facing SBOM publication endpoint | T1 | To Do |
| CRAN-4 | Customer security questionnaire auto-answer | T1 | To Do |
| CRAN-5 | Single-incident multi-track regulatory notification | T1 | To Do |
| CRAN-6 | Substantial-modification detection | T1 | To Do |
| CRAN-7 | GDPR Art. 30 RoPA generator | T1 | To Do |
| CRAN-8 | Sub-processor list with auto-publication | T1 | To Do |
| CRAN-9 | Audit-ready evidence bundle / scoped auditor portal | T2 | To Do |
| CRAN-10 | Harmonised standards catalogue + mapping | T2 | To Do |
| CRAN-11 | Notified Body workflow orchestration | T2 | To Do |
| CRAN-12 | DPIA generator | T2 | To Do |
| CRAN-13 | Internal policy attestation tracking | T2 | To Do |
| CRAN-14 | External evidence intake / "evidence dropbox" | T2 | To Do |
| CRAN-15 | DPA / SCC generator | T2 | To Do |
| CRAN-16 | Open Source Steward simplified workflow | T2 | To Do |
| CRAN-17 | AI Act overlap modelling | T3 | To Do |
| CRAN-18 | NIS2 risk-management measures matrix | T3 | To Do |
| CRAN-19 | Unified compliance calendar | T3 | To Do |
| CRAN-20 | Multi-product policy templating | T3 | To Do |
| CRAN-21 | Cyber-insurance evidence export | T3 | To Do |
| CRAN-22 | Strategic 10x — single source of truth → many regulatory dialects (meta) | — | To Do |
| CRAN-23 | CRA-A — Annex II user-information pack generator | Backlog | To Do |
| CRAN-24 | CRA-B — CSAF v2.0 advisory feed | Backlog | To Do |
| CRAN-25 | CRA-C — Per-component due-diligence record | Backlog | To Do |
| CRAN-26 | CRA-D — Art. 14(1)(b) severe-incident auto-trigger | Backlog | To Do |
| CRAN-27 | CRA-E — Authorised-representative role + obligations | Backlog | To Do |
| CRAN-28 | CRA-F — Module A self-assessment record output | Backlog | To Do |

# CRANIS2 — CRA Gap Analysis

**Date:** 2026-05-06
**Author:** Andi McBurnie (with Claude Code session 65)
**Source conversation:** session transcript `c643b171-3353-4f30-9574-d349b8801787` (2026-05-06 11:56 CEST)
**Jira project:** [CRAN — andimcburnie.atlassian.net](https://andimcburnie.atlassian.net/jira/software/projects/CRAN/boards/34)

This document inventories what CRANIS2 actually does today against what compliance staff at a software-engineering company actually have to do operationally — ranked by leverage. It is the seed for the CRAN-1 through CRAN-22 epics in Jira plus a CRA-completeness audit backlog.

---

## Strategic frame revised — 2026-05-13

This document was written through one filter (rule of law) but did not yet articulate two further constraints that have since been agreed. Those constraints reshape the priority ranking and rescope or withdraw several epics. The original analysis below is preserved for audit trail; the in-place notes (marked **[Revised 2026-05-13]**) and the new sections at the bottom reflect the current shape.

### Filter 1 — Customer

Companies that **build software**, embedded or otherwise: ISVs, SaaS, IoT / firmware, MSPs, MSSPs, cloud-service providers, OSS stewards, hardware-with-software OEMs, game studios.

**Out of scope as paying customers:** banks, hospitals, utilities, telcos, retailers — anyone whose primary business is *operating* regulated services rather than *building* software products.

### Filter 2 — Regulation

**Statutory regulation only.** The rules customers cannot opt out of: CRA, GDPR, AI Act, NIS2 (where directly applicable), PLD recast, DORA-supplier-evidence (downstream-demand).

**Out of scope as regulation:** ISO 27001, ISO 42001, SOC 2, EUCC, NIST CSF, HackerOne / BugCrowd, cyber insurance, SIG Lite / CAIQ — these are opt-in markets we leave to Vanta / Drata / OneTrust.

### Two-sided market

The out-of-scope customer category (regulated operators — banks, healthcare, utilities, telcos, NIS2 entities, large enterprises) re-enters as the **demand-side promoter**. They do not pay; they push CRANIS2 adoption into their software supply chain because it discharges *their* NIS2 Art. 21(2)(d), DORA Art. 28, and GDPR Art. 28 supply-chain obligations. Procurement leverage drives viral adoption: once one bank in a sector demands a CRANIS2 Trust Centre from suppliers, every other bank wants the same data flow.

### What this changes in the document below

1. **Tier 1 splits into Group A (closes the promoter loop) and Group B (supplier-internal value only).** Group A is the highest priority going forward.
2. **Five epics rescope** — CRAN-4, CRAN-9, CRAN-10, CRAN-13, CRAN-20. See in-place notes.
3. **One epic withdrawn** — CRAN-21 (cyber-insurance evidence). Preserved in the doc for audit trail.
4. **Three new epic candidates added** — Operator Supplier Dashboard, PLD recast 2024/2853, DORA Art. 28 supplier-evidence pack. Jira IDs TBD on creation.
5. **The strategic 10x section** is superseded by the two-sided-market framing — see "Revised strategic frame" at the bottom.

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

**[Revised 2026-05-13]** The seven Tier-1 epics now split into two groups based on whether they close the two-sided-market promoter loop:

- **Group A (close the operator loop — highest priority):** CRAN-3, CRAN-4 (rescoped), CRAN-5, CRAN-8. Each emits structured signed evidence that a regulated operator can pull into their own DORA register / NIS2 supplier-DD / GDPR sub-processor pipeline.
- **Group B (supplier-internal value only):** CRAN-2, CRAN-6, CRAN-7. Each helps the supplier discharge a statutory obligation but does not produce an artefact for downstream operator consumption.

Both groups remain in scope; Group A is more viral and therefore prioritised.

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

> **[Revised 2026-05-13 — Rescope]** *SIG Lite / CAIQ are operational expressions of ISO 27001 / SOC 2 (opt-in certifications) and fall outside the rule-of-law filter. They are dropped from this epic.* The surviving scope is the **regulatory** supplier-assessment counterpart:
>
> - **NIS2 Art. 21(2)(d) supplier-DD requests** sent by essential / important entities to their suppliers
> - **GDPR Art. 28 processor-assessment questionnaires** sent by controllers
> - **DORA Art. 28 ICT third-party assessments** sent by financial entities
> - **CRA Art. 13(3) due-diligence questionnaires** sent by manufacturers to their dependency suppliers
>
> The auto-fill mechanism (AI extraction from CRANIS2's existing evidence base) is unchanged. The renamed epic is **"Regulatory supplier-assessment auto-answer"**. Closes the operator loop — Group A.

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

> **[Revised 2026-05-13 — Rescope]** *Renamed* **"Regulator evidence portal"**. The bundle is for a **regulator** (CRA market-surveillance authority under Art. 52, CNIL / ICO under GDPR, national CSIRT under NIS2 Art. 23) — *not* for an ISO 27001 / SOC 2 external auditor. The exclusion is structural: opt-in audit bundles are out of scope under the rule-of-law filter. Acceptance criteria must name the regulator audience explicitly.

### 9. Standards mapping + harmonised standards catalogue *(CRA Art. 32)*

Art. 32 says "where harmonised standards exist, conformity assessment shall reference them." EN 18031 (cyber for radio equipment), IEC 62443 (industrial), ETSI EN 303 645 (consumer IoT), ISO/IEC 27001, etc. Today the engineer fills in `standards_applied` from memory.

**What CRANIS2 should add:** curated catalogue of EU harmonised standards by product category → recommend applicable standards based on CRA category + product type → generate compliance matrix mapping each standard's clauses to evidence in the tech file.

> **[Revised 2026-05-13 — Rescope with exclusion list]** Harmonised standards are in scope only as the **CRA Art. 32 presumption-of-conformity route** — i.e. when applying the standard delivers a regulatory benefit under EU law. They are **not** in scope as standalone opt-in certifications.
>
> **The catalogue must include:** EN 18031 (cyber for radio equipment), ETSI EN 303 645 (consumer IoT), IEC 62443 (industrial), forthcoming EN-CRA standards (cited in OJEU), and other harmonised standards listed in the EU's *Official Journal* under the CRA implementing acts.
>
> **The catalogue must NOT include:** ISO/IEC 27001, ISO/IEC 42001, SOC 2 trust criteria, NIST CSF, EUCC certification scheme, or any other framework whose application is procurement-led rather than regulation-led. The original epic body's reference to "ISO/IEC 27001, etc." is removed.

### 10. Notified Body workflow orchestration *(CRA Art. 32(3))*

For Important Class II / Critical products, you need a notified body. CRANIS2 lists them; doesn't manage the engagement: NB selection → tech-file submission to NB → review tracking → cert storage → re-trigger on substantial modification.

**What CRANIS2 should add:** end-to-end NB engagement workflow with state tracking + document handoff + cert management. Tier 2 because few products are Critical, but for those few it's high-stakes.

### 11. DPIA generator *(GDPR Art. 35)*

CRANIS2 already has a CRA risk-assessment generator (P3 #16). A close cousin could generate a Data Protection Impact Assessment.

**What CRANIS2 should add:** parallel `generate-dpia` Copilot capability reusing the same product-context gathering, tailored to GDPR Art. 35's required content (purpose, necessity, risks to rights, mitigations).

### 12. Internal policy attestation tracking *(Annex I Part II + ISO 27001 + SOC 2)*

"All employees have been trained on the vulnerability handling policy" — every framework asks for evidence. Today: PDF emails + spreadsheets.

**What CRANIS2 should add:** publish-to-employees workflow → each employee electronically signs (with timestamp + IP) → attestation log per policy version → automatic re-attestation on policy update.

> **[Revised 2026-05-13 — Rescope]** *Renamed* **"Regulatory policy attestation"**. The ISO 27001 + SOC 2 framing is dropped. The surviving scope is attestation for policies that satisfy a specific **statutory** obligation:
>
> - **CRA Annex I Part II** — vulnerability-handling policy training
> - **NIS2 Art. 21(2)(g)** — cybersecurity training and awareness
> - **GDPR** — data-protection training, awareness, and Art. 32 organisational measures
> - **CRA Art. 13(5)** — secure-development-lifecycle policy attestation
>
> The mechanism (publish → sign → versioned log → re-attest on update) is unchanged. Each policy in the system must be tagged with the obligation it discharges; attestations not tied to a statutory obligation are out of scope.

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

> **[Revised 2026-05-13 — Rescope]** Templating applies to **regulatory** policies only — CVD (CRA Art. 13(6)), vulnerability handling (CRA Art. 13(5)), incident response (CRA Art. 14), security updates (CRA Art. 13(8)), end-of-support (CRA Art. 13(15)), SDLC (CRA Annex I), data protection (GDPR), and NIS2 risk-management policies. Templating does **not** apply to opt-in framework policies (ISO 27001 ISMS policies, SOC 2 trust-criteria policies).

### 20. Cyber-insurance evidence export ~~*(withdrawn 2026-05-13)*~~

Cyber insurers (Beazley, Coalition, Hiscox) increasingly demand compliance evidence. Plug-in export adapters per insurer.

> **[Withdrawn 2026-05-13]** *Cyber insurance is voluntary commercial procurement, not statutory regulation. Insurers demanding evidence is them outsourcing risk-assessment to the customer; it does not fit the rule-of-law filter. **This epic is removed from scope.** Preserved here for audit trail.* CRAN-21 should be closed in Jira with status `won't-do` and a link to this revision.

---

## ~~The strategic 10x frame — single source of truth → many regulatory dialects~~

> **[Superseded 2026-05-13]** *This section is preserved for audit trail but replaced by the "Revised strategic frame" below. The "single source of truth → many dialects" thesis was correct as far as it went — but it framed CRANIS2 as a generic compliance tool and left room for auditor bundles, insurance applications, and customer questionnaires that fall outside the rule-of-law filter. The revised frame is sharper.*

Items 4 (single-incident multi-track) + 6 (Art. 30 RoPA from CRA tech file) + 11 (DPIA from CRA risk assessment) + 14 (DPA from CRANIS2 evidence) all share a theme:

**The same underlying facts get reframed for different regulations.** CRANIS2 already captures the facts (tech file, suppliers, dependencies, incidents, awareness moments). What it doesn't yet do is **emit them in the dialect of each regulation that's interested**.

That is the strategic frame for the next epic-cluster: **"single source of truth → many regulatory dialects"**. A customer enters their data once into CRANIS2's CRA-shaped model, and CRANIS2 translates it on-demand into NIS2 reports, GDPR Art. 30 records, DPIAs, DPAs, sub-processor pages, customer questionnaires, auditor bundles, and insurance applications.

This is the frame that turns CRANIS2 from "CRA compliance tool" into **"the EU regulatory nervous system for software companies"** — and it is defensible because the 60-80% upfront data ingestion (already built) is the moat.

---

## Revised strategic frame — 2026-05-13

The "single source of truth → many regulatory dialects" thesis survives in a sharpened form. Two things change:

### 1. The dialects we translate to are statutory only

CRA, GDPR, AI Act, NIS2 (where directly applicable), PLD recast, and DORA-supplier-evidence (downstream-demand). We do **not** translate into ISO 27001 / SOC 2 / EUCC / NIST CSF / cyber-insurance dialects. Those markets are owned by Vanta / Drata / OneTrust and chasing them dilutes the position.

### 2. The audience for our outputs is two-sided

**Supply side (paying customer):** software developers — ISVs, SaaS, IoT / firmware, MSPs, MSSPs, OSS stewards, hardware-with-software OEMs. They pay to publish their regulatory evidence.

**Demand side (free-read-access promoter):** regulated operators — banks, hospitals, utilities, telcos, NIS2 essential / important entities, large enterprises. They do *not* pay. They push CRANIS2 adoption into their software supply chain because it discharges *their own* NIS2 Art. 21(2)(d), DORA Art. 28, and GDPR Art. 28 supply-chain obligations.

The viral mechanism is procurement leverage: once one bank in a sector says *"if you want to sell to us, publish your CRANIS2 Trust Centre"*, every other bank wants the same data flow. Same shape as SecurityScorecard / BitSight / Cloudflare Trust Hub — but the forcing function is **European law, not vendor preference**.

### What this frame does to the product

It re-ranks Tier 1 into Group A (closes the operator loop) and Group B (supplier-internal only). Group A is now the highest priority. It also surfaces a **missing surface**: there is currently no operator-side experience on the platform. The supplier publishes; nothing on CRANIS2 today makes consuming that evidence efficient for an operator. The new **Operator Supplier Dashboard** epic (below) closes that gap.

It also surfaces two new regulations worth adding: **PLD recast** (direct on the software developer) and **DORA Art. 28 supplier-evidence pack** (downstream-demand). See new epic candidates below.

---

## New epic candidates — 2026-05-13

### NEW-1. Operator Supplier Dashboard *(closes the two-sided-market loop)*

A free, read-only product surface scoped to regulated operators. One screen showing all suppliers in their software supply chain who publish on CRANIS2, with:

- Current obligation states (per supplier, per product)
- Active incident feeds (Art. 14 / NIS2 / GDPR notifications inbound from suppliers)
- Sub-processor change diffs with subscription-based notifications
- DORA Art. 28 register-ready exports (one click per ICT third-party)
- NIS2 Art. 21(2)(d) supplier-DD discharge as a side-effect
- Webhook delivery of changes
- Audit-logged read access

**Audience:** financial entities (DORA), NIS2 essential / important entities, healthcare providers, utilities, telcos, large enterprises with software supply chains.

**Surface decision (open):** mode of existing app vs. separate sub-app (`operators.cranis2.com`) vs. defer the call. Owner: TBD on epic creation.

**Why high-leverage:** this is the missing surface that turns the supply-side product into a two-sided regulatory data exchange. Without it, every supplier publishing on CRANIS2 still requires the operator to do bespoke consumption work. With it, the operator's supply-chain compliance collapses from "spreadsheets and chase PDFs" to "subscribe to a dashboard". This is the feature that makes the procurement-leverage flywheel real.

### NEW-2. PLD recast 2024/2853 — software-product liability evidence

Directive (EU) 2024/2853 (PLD recast) explicitly classifies software as a "product" for defective-product liability purposes. Transposition deadline December 2026. CRANIS2 already has 60-80% of the evidence a PLD defence requires:

- Vulnerability history with discovery and fix dates
- SBOM history showing component decisions
- Security update timeliness (Art. 13(8))
- Reasonable-safety-expectations evidence via CRA conformity

**What CRANIS2 should add:** a PLD-shaped export of this existing evidence — "defective-product defence pack" — tied to a specific product version. Plus a tech-file section "Reasonable safety expectations" that ties into the CRA risk assessment.

**Why high-leverage:** new and direct statutory obligation on every software developer, December 2026 deadline. Almost no incumbent addresses it.

### NEW-3. DORA Art. 28 supplier-evidence pack *(downstream-demand)*

DORA (Regulation (EU) 2022/2554) requires financial entities to maintain a structured ICT third-party register and to perform due diligence on every ICT supplier. Mandatory since Jan 2025. CRANIS2 customers selling into financial services are already getting DORA questionnaires today.

**What CRANIS2 should add:** a DORA-shaped supplier-evidence export — the exact fields a financial entity needs to populate their ICT third-party register, emitted from the supplier's CRANIS2 data. Subscribed via the Operator Supplier Dashboard.

**Why high-leverage:** complements NEW-1 by giving the operator a finished artefact rather than raw data; complements the supplier by giving them a one-click answer to their banking customer's DORA questionnaire.

### Operating model notes

- All three new epics await Jira ID assignment. Suggested labels: `tier-1` for NEW-1 and NEW-3 (closes operator loop); `tier-1` for NEW-2 (direct statutory obligation, fresh deadline); `regulation:pld` for NEW-2; `regulation:dora` for NEW-3; `regulation:cross` for NEW-1.

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
| CRAN-4 | Regulatory supplier-assessment auto-answer *(rescoped 2026-05-13 — SIG/CAIQ dropped)* | T1 — Group A | To Do |
| CRAN-5 | Single-incident multi-track regulatory notification | T1 — Group A | To Do |
| CRAN-6 | Substantial-modification detection | T1 — Group B | To Do |
| CRAN-7 | GDPR Art. 30 RoPA generator | T1 — Group B | To Do |
| CRAN-8 | Sub-processor list with auto-publication | T1 — Group A | To Do |
| CRAN-9 | Regulator evidence portal *(rescoped 2026-05-13 — regulators only, not opt-in auditors)* | T2 | To Do |
| CRAN-10 | Harmonised standards catalogue + mapping *(rescoped 2026-05-13 — CRA presumption-of-conformity only, excludes ISO/SOC)* | T2 | To Do |
| CRAN-11 | Notified Body workflow orchestration | T2 | To Do |
| CRAN-12 | DPIA generator | T2 | To Do |
| CRAN-13 | Regulatory policy attestation *(rescoped 2026-05-13 — statutory policies only)* | T2 | To Do |
| CRAN-14 | External evidence intake / "evidence dropbox" | T2 | To Do |
| CRAN-15 | DPA / SCC generator | T2 | To Do |
| CRAN-16 | Open Source Steward simplified workflow | T2 | To Do |
| CRAN-17 | AI Act overlap modelling | T3 | To Do |
| CRAN-18 | NIS2 risk-management measures matrix | T3 | To Do |
| CRAN-19 | Unified compliance calendar | T3 | To Do |
| CRAN-20 | Multi-product policy templating *(rescoped 2026-05-13 — regulatory policies only)* | T3 | To Do |
| ~~CRAN-21~~ | ~~Cyber-insurance evidence export~~ — **Withdrawn 2026-05-13** (opt-in, fails rule-of-law filter) | — | Won't do |
| ~~CRAN-22~~ | ~~Strategic 10x — single source of truth → many regulatory dialects (meta)~~ — **Superseded 2026-05-13** by the Revised strategic frame (two-sided market) | — | Superseded |
| CRAN-23 | CRA-A — Annex II user-information pack generator | Backlog | To Do |
| CRAN-24 | CRA-B — CSAF v2.0 advisory feed | Backlog | To Do |
| CRAN-25 | CRA-C — Per-component due-diligence record | Backlog | To Do |
| CRAN-26 | CRA-D — Art. 14(1)(b) severe-incident auto-trigger | Backlog | To Do |
| CRAN-27 | CRA-E — Authorised-representative role + obligations | Backlog | To Do |
| CRAN-28 | CRA-F — Module A self-assessment record output | Backlog | To Do |
| NEW-1 *(Jira ID TBD)* | Operator Supplier Dashboard — closes the two-sided-market loop | T1 — Group A | New 2026-05-13 |
| NEW-2 *(Jira ID TBD)* | PLD recast 2024/2853 — software-product liability evidence | T1 | New 2026-05-13 |
| NEW-3 *(Jira ID TBD)* | DORA Art. 28 supplier-evidence pack — downstream-demand | T1 — Group A | New 2026-05-13 |

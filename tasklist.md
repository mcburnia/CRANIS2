# CRANIS2 — Task List

---

## Phase 1: MVP (Complete)

All five MVP features are built, tested, and shipped. See git history for full details.

- [x] SBOM Export (CycloneDX 1.6 + SPDX 2.3, structural validation)
- [x] Compliance Package (Due Diligence ZIP — PDF, SBOM, licence CSV, vuln summary, tech file)
- [x] IP / Copyright Proof (RFC 3161 timestamping, licence compatibility matrix)
- [x] Billing & Reports (Stripe, three report types with PDF/CSV export)
- [x] Escrow Capability (self-hosted Forgejo, daily deposits, management UI)

---

## Phase 2: Compliance Intelligence

The platform collects excellent data but leaves compliance *interpretation* almost entirely to the user. Phase 2 closes that gap — connecting what the platform knows to what the regulations require, and guiding product developers from "connected repo" to "audit-ready".

---

### 1. Obligations auto-intelligence
**Priority: CRITICAL**

The obligations tracker currently shows everything as "not started" regardless of what's actually been done. The platform already has all the data to advance statuses automatically — it just isn't wired up.

Auto-advance logic to implement:
- SBOM exists for a product → **Art. 13(11)** advances to `in_progress`; all dependencies resolved with no unknowns → `met`
- Vulnerability scans running (scan history present) → **Art. 13(6)** advances to `in_progress`
- Technical file ≥ 50% complete → **Art. 13(12)** advances to `in_progress`; 100% complete → `met`
- At least one ENISA report created → **Art. 14** advances to `in_progress`
- Annex I Part I checklist 100% ticked → **Annex I Part I** advances to `met`
- Annex I Part II CVD policy field populated → **Annex I Part II** advances to `in_progress`
- EU DoC generated (see item 3) → **Art. 13(15)** advances to `met`
- Conformity assessment section of tech file complete → **Art. 13(14)** advances to `in_progress`

Sub-tasks:
- [ ] Design the auto-advance rules engine (per-obligation, per-product, non-destructive — manual overrides preserved)
- [ ] Implement backend logic to compute derived statuses alongside manual ones
- [ ] Update obligations overview API to include `derivedStatus` and `derivedReason` fields
- [ ] Update ObligationsPage UI to show derived status with a visual indicator distinguishing auto from manual
- [ ] Write tests covering each auto-advance rule

---

### 2. Expand the obligations list
**Priority: HIGH**

The current 11 obligations do not cover all relevant CRA articles. Several missing obligations are trackable or at least declarable within the platform.

Obligations to add:

| Key | Article | Title | Auto-trackable? |
|-----|---------|-------|----------------|
| `art_13_3` | Art. 13(3) | Up-to-date components only | Partially — flag deps with available newer versions |
| `art_13_5` | Art. 13(5) | No known exploitable vulnerabilities at market placement | Yes — query own vuln scanner |
| `art_13_7` | Art. 13(7) | Automatic security update distribution | No — policy declaration |
| `art_13_8` | Art. 13(8) | Security patches provided free of charge | No — policy declaration |
| `art_13_9` | Art. 13(9) | Security updates separate from feature updates | No — policy declaration |
| `art_13_10` | Art. 13(10) | Technical file retained for 10 years | Trackable — end-of-retention date |
| `art_16` | Art. 16 | EU Declaration of Conformity drawn up | Yes — links to DoC generator (item 3) |
| `art_20` | Art. 20 | EUDAMED registration (critical products only) | Flaggable — warn if `craCategory = critical` |

Sub-tasks:
- [ ] Add the 8 new obligation definitions to `obligations.ts`
- [ ] Set correct `appliesTo` arrays (some apply only to important/critical classes)
- [ ] Add a `productEndOfSupportDate` field to products (Art. 13(10) / 13(6))
- [ ] Write migration to add new obligation rows for existing products
- [ ] Update UI to render the new obligations with appropriate guidance text
- [ ] Write tests for new obligation definitions and category filtering

---

### 3. EU Declaration of Conformity (DoC) generator
**Priority: HIGH**

Art. 16 requires every manufacturer to draw up an EU Declaration of Conformity before placing a product on the market. This is a legal document with a defined structure. CRANIS2 holds virtually all the data needed to generate it.

Required DoC fields (per CRA Annex V):
- Manufacturer name and address (from org stakeholders)
- Product name, model/type, version (from product record)
- Statement of sole responsibility
- Object of declaration (CRA Article 28 reference)
- Relevant harmonised standards or common specifications applied
- Notified body name and certificate number (if applicable — class II/critical only)
- Place and date of issue
- Name and signature of authorised signatory (from stakeholders)

Sub-tasks:
- [ ] Design DoC data model (which fields come from where)
- [ ] Add "authorised representative" and "person responsible for signing" fields to stakeholders if not present
- [ ] Add "harmonised standards applied" field to product or technical file (Section 6)
- [ ] Build `GET /api/products/:productId/declaration-of-conformity` endpoint (returns PDF)
- [ ] PDF generation using PDFKit following the legal format for CRA Annex V
- [ ] Add DoC download button to product detail page and Due Diligence page
- [ ] Include generated DoC in the Due Diligence ZIP export
- [ ] Write tests (PDF generation, field population, auth/org scoping)

---

### 4. Technical file auto-population
**Priority: HIGH**

When a user opens a technical file section they see a blank text field. The platform already holds data that could pre-fill substantial portions, removing the "blank page" problem.

Auto-population targets:

| Section | What can be pre-filled |
|---------|----------------------|
| 1 — Product Description | Product name, version, category, CRA class, repo URL, distribution model, lifecycle status, contributor count |
| 3 — Vulnerability Handling | Description of automated scanning pipeline (scan frequency, databases, severity model), CVD policy stub |
| 6 — Standards Applied | Suggested harmonised standards based on product category (EN 18031-x, ISO 27001, ETSI EN 303 645) |
| 7 — Test Reports | Reference to vulnerability scan history as evidence of security testing (scan dates, findings count, resolution rate) |

Sub-tasks:
- [ ] Design auto-population templates for each section (structured text with placeholders)
- [ ] Build `GET /api/technical-file/:productId/suggestions` endpoint that returns pre-filled content per section
- [ ] Add "Auto-fill from platform data" button to each section editor (non-destructive — user can edit/replace)
- [ ] Add guidance text to each section explaining what the CRA requires and what evidence is needed
- [ ] Write tests for suggestion generation

---

### 5. Getting-started compliance checklist
**Priority: HIGH**

New users land on the dashboard with no guidance on what to do first. A prioritised checklist showing progress from "connected" to "CRA-ready" would significantly reduce time-to-value.

The checklist should be per-product and sequenced:
1. Connect your repository → sync your SBOM
2. Set your CRA product category (default / important I / important II / critical)
3. Review and triage any open vulnerability findings
4. Complete Technical File sections 1, 3, and 4 (minimum viable)
5. Set up your stakeholder contacts (manufacturer, security contact)
6. Generate your EU Declaration of Conformity
7. Download your compliance package

Sub-tasks:
- [ ] Design checklist data model (per-product, each step has a completion check query)
- [ ] Build `GET /api/products/:productId/compliance-checklist` endpoint computing step status
- [ ] Add compliance checklist widget to the Dashboard (collapsed if all steps complete, expanded otherwise)
- [ ] Add per-product checklist view accessible from product detail page
- [ ] Show estimated time to September 2026 and December 2027 deadlines alongside the checklist
- [ ] Write tests

---

### 6. CVD policy template generator
**Priority: MEDIUM**

Annex I Part II requires manufacturers to have a publicly available Coordinated Vulnerability Disclosure (CVD) policy. Most companies don't have one. CRANIS2 can generate a complete, publishable policy document from a small number of inputs.

Required inputs:
- Response SLA (e.g. acknowledge within 5 business days)
- Disclosure timeline (e.g. public disclosure after 90 days)
- Contact method (email address — from stakeholders security contact)
- Preferred language for reports
- Safe harbour statement (opt-in)

Output: a Markdown/PDF CVD policy document ready to publish at `security.txt` or a company security page.

Sub-tasks:
- [ ] Design CVD policy template (based on ISO/IEC 29147 and CERT/CC guidelines)
- [ ] Add CVD policy inputs to the Stakeholders page or a new dedicated section
- [ ] Build `GET /api/org/cvd-policy` endpoint returning generated Markdown and PDF
- [ ] Add CVD policy download to the Due Diligence ZIP
- [ ] Store CVD policy inputs so they survive page refreshes
- [ ] Write tests

---

### 7. End-of-support tracking
**Priority: MEDIUM**

Art. 13(6) requires a minimum 5-year support period. CRANIS2 currently has no concept of a product's support window.

Sub-tasks:
- [ ] Add `supportEndDate` field to product records (Neo4j node)
- [ ] Add support end date input to product create/edit form
- [ ] Add dashboard warning when a product's support end date is within 12 months
- [ ] Add support window display to product detail Overview tab
- [ ] Surface support end date in the compliance package PDF
- [ ] Write tests

---

### 8. Webhook integration end-to-end test
**Priority: HIGH**

The platform had auto-webhook registration code deployed but no webhook was ever registered — and no test caught this. The existing test suite verified webhook *reception* (HMAC validation, stale-marking) but never verified that webhooks were *registered* on the provider side during sync.

Sub-tasks:
- [ ] Add E2E test that verifies a product sync results in a `webhookId` stored on the Repository node
- [ ] Add E2E test that verifies subsequent pushes trigger stale-marking (full push→stale→sync→scan pipeline)
- [ ] Add test that verifies disconnect removes the webhook from the provider
- [ ] Add monitoring/alert for products with connected repos but no `webhookId`

---

## Phase 3: Pre-Production Housekeeping

These are not new features but must be completed before production launch.

- [ ] **Remove dev routes** — delete `/api/dev/*` (nuke button) before production deployment
- [ ] **Remove SBOM debug logging** — remove `console.log` statements from `services/github.ts`
- [ ] **Multi-language support** — i18n/localisation for the UI (language to be scoped separately)
- [ ] **Production deployment** — Infomaniak hosting, `cranis2.com` domain, update `FRONTEND_URL`, OAuth callback URLs, DNS, SSL

---

## Notes
- Tackle one feature at a time — plan, build, test, commit before moving on
- Each feature should be planned and approved before implementation begins
- Phase 2 items are ordered by impact on the product developer's compliance journey

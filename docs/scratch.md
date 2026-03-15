P0 – Must-have before launch – ALL DONE
#	Feature	Status
1	Email alerts	DONE
2	Notification bell	DONE
3	Compliance scorecard	DONE
4	CVD policy generator	DONE
5	Pre-prod cleanup	DONE

P1 – Important for credibility – ALL DONE
#	Feature	Status
6	Standalone report exports	DONE
7	In-field tooltips	DONE
8	Smart deadline alerts	DONE
9	End-of-support tracking	DONE

P2 – Polish for production – ALL DONE
#	Feature	Status
10	Product activity log	DONE
11	Compliance heat map	DONE
12	Webhook E2E tests	DONE

P3 – AI Automation (Pro plan) – ALL DONE
#	Feature	Effort	Status
13	AI Copilot	High	DONE
15	Auto-triage vulns	High	DONE
27	Copilot usage dashboard	Medium	DONE
16	Risk assessment generator	Medium	DONE
17	Incident report drafter	Medium	DONE
18	CRA category recommender	Low	DONE
19	Supplier due diligence questionnaire	Medium	DONE
20	Compliance gap narrator	Low	DONE

P4 – Public API & External Integrations – 6/7 DONE
#	Feature	Effort	Status	Notes
28	Public API with API key auth	High	DONE	Prerequisite for #14, #21
22	CI/CD compliance gate	Medium	DONE	Gate script + CI examples
26	Trello task creation	Medium	DONE	4 event types, dedup, resolution
14	MCP API server	High	DONE	5 tools, 12+ mitigation commands, SBOM rescan verification
21	IDE compliance assistant	Medium	DONE	Setup wizard on Integrations page, 4 IDE tabs, auto-generated config
23	GRC/audit tool bridge	Medium	DONE	OSCAL 1.1.2 export (catalog, profile, assessment-results, component-definition)
24	Chat ops integration	Low	PARKED
25	Slack notifications	Medium	PARKED

P5 – Supplier Marketplace (viral growth loop) – NOT STARTED
#	Feature	Effort	Status
28	Supplier invitation flow	Medium	TODO
29	Supplier compliance profile	Medium	TODO
30	Auto-resolution of due diligence	Medium	TODO
31	Marketplace directory	Medium	TODO
32	Supplier analytics dashboard	Low	TODO
33	Supplier tier pricing	Low	TODO
34	Manufacturer trust signals	Low	TODO

Bugs
#	Description	Status
27	All Organisations -> Actions button does nothing	DONE
28	ENISA Reporting -> Cancel button does nothing	DONE
29	Products & Compliance -> CRANIS2 -> Not Stated?	DONE

P6 – Compliance Document Library – ALL DONE
#	Feature	Effort	Status
35	Template download page	Low	DONE
36	Auto-populated templates	Medium	DONE
37	Full template library (7 templates)	High	DONE

P7 - Andi's good catches – ALL DONE
#	Feature	Effort	Status
38	AI CoPilot Prompt Engineering Topic Focus	High	PHASE 2 DONE
39	Automation wizards (Batch Fill, Post-Scan Triage, Onboarding)	Medium	DONE
40	Codebase modularity refactor	Medium	DONE
41	Update welcome page, user docs, and FAQ	Medium	DONE

Cross-cutting (done)
-	Pro plan billing (Standard €6/contributor, Pro €9/product + €6/contributor)	DONE
-	Pro plan feature gating (API keys, CI/CD, marketplace behind Pro)	DONE
-	AI Copilot cost protection (token budget, rate limits, response cache)	DONE
-	Welcome page pricing overhaul (enhanced features, vertical cards, €9 price)	DONE
-	CRA Action Plan guided workflow (per-product visual pipeline)	DONE
-	Product lifecycle stage + lifecycle-aware readiness framing	DONE
-	Test infrastructure fix (reliable, repeatable, 37% faster)	DONE
-	Nightly test runner (cron 22:00 CEST, 14-day log retention, Trello notification)	DONE
-	Bug #29 fix (formatCategory legacy normalisation + Neo4j data)	DONE
-	Flaky risk-findings status filter test fix (open instead of resolved)	DONE
-	CoPilot quality standard + 3-layer prompt architecture + admin prompt editor	DONE
-	GRC bridge stub (unblocks Docker build for parked P4 #23)	DONE
-	Editorial standard (docs/EDITORIAL-STANDARD.md) + full codebase sweep (em dash ban, UK English)	DONE

---

## Current Status & Next Steps

**P0–P3:** ALL COMPLETE (50/50 features done)
**P4:** 6/7 DONE (#28 Public API, #22 CI/CD gate, #26 Trello, #14 MCP server, #21 IDE assistant, #23 GRC/OSCAL bridge) — #24/#25 parked for post-launch
**P5:** 0/7 — Supplier marketplace not started (post-launch)
**P6:** ALL DONE (document template library)
**Bugs:** 3/3 ALL DONE
**P7:** ALL DONE (#38 AI copilot prompts, #39 automation wizards, #40 codebase modularity, #41 docs update)
**P8:** ALL DONE (10-year compliance vault, 7 phases A–G)
**P9:** ALL DONE (CRA + NIS2 conformity assessments, assessment landing page, launch list subscription)
**#45 PDF→Markdown:** DONE (pdfkit removed, all exports now Markdown)
**#45 Importer/distributor workflows:** DONE (role-aware obligations, compliance checklist, technical file guidance, public importer assessment, admin analytics)
**#46 Post-market monitoring:** DONE (field issues, corrective actions, obligation engine wiring, surveillance report export, dashboard/analytics integration)
**#53 Crypto inventory:** DONE (crypto library registry, scanner, CryptoInventoryTab, PQC readiness assessment, obligation wiring, admin analytics)
**#57 Platform Analytics Dashboard:** DONE (admin-only KPI cards, growth charts, revenue breakdown, market intelligence, assessment completions)
**Cross-cutting:** Editorial standard established and applied across entire codebase (frontend, backend, docs, welcome site)

**#48 Notified body directory:** DONE (registry of 16 EU bodies, public directory on welcome site, product-scoped assessment tracking, obligation engine wiring for art_32_3, compliance checklist/dashboard/analytics integration)
**#49 Market surveillance registration:** DONE (registry of 20 EU authorities across 16 countries, public decision tree + authority directory on welcome site, product-scoped registration tracking, obligation engine wiring for art_20, compliance checklist/dashboard/analytics integration)

**P9 Growth Funnels:** 7/12 DONE (#45, #46, #47, #48, #49, #50, #53), 5 remaining (#51, #52, #54, #55, #56)

**Immediate next:**
- Production deployment planning (Infomaniak hosting, cranis2.com)
- P5 — Supplier marketplace (post-launch)
- P9 growth funnels — remaining items (#51 supply chain risk, #52 incident lifecycle, #54 end-of-life, #55 EU authorised rep, #56 non-compliance reporting)

---

## P8 – 10-Year Compliance Vault (Art. 13(10)) – ALL DONE

| # | Feature | Effort | Status |
|---|---------|--------|--------|
| 40 | Compliance snapshot generator | Medium | DONE |
| 41 | RFC 3161 qualified timestamping | Low | DONE |
| 42 | Scaleway Glacier cold storage | Medium | DONE |
| 43 | Automated snapshot scheduling | Low | DONE |
| 44 | Retention dashboard | Low | DONE |

Additional phases completed beyond original scope:
- Phase C: Ed25519 document signing for compliance archives
- Phase D: Retention reserve ledger and funding certificates
- Phase E: Storage lifecycle controls (grace period, pending deletion)
- Phase F: Event-triggered snapshots (SBOM update, vuln scan, obligation change)
- Phase G: Admin retention dashboard with funding run and auto-extend

**Why this matters:** The CRA requires technical documentation + EU DoC retained for at least 10 years after market placement (or support period, whichever is longer). No competitor is solving this. Most manufacturers have no idea how they'll comply. CRANIS2 can make it automatic, legally robust, and essentially free – included in the subscription.

**Approach:** CRANIS2 generates signed, self-contained compliance archives, timestamps them with an eIDAS-qualified service, and stores them on EU cold storage. Archives are readable without CRANIS2 – if we cease to exist, the customer's evidence survives.

### What must be retained (CRA Annex VII + Art. 13(10))
- All 8 Annex VII technical file sections (product description, design & development, vulnerability handling, risk assessment, support period, standards applied, test reports, declaration of conformity)
- EU Declaration of Conformity (Annex VI format)
- SBOMs – all historical versions (SPDX + CycloneDX)
- Vulnerability scan history, triage decisions, and CVD communications
- Security release classification records + SBOM diffs
- Obligation evidence (all 19 obligations with status history)
- Product activity audit trail

### Architecture (2 layers)

**Layer 1 – Automated compliance snapshots + RFC 3161 timestamps**
- CRANIS2 generates a compliance snapshot as a self-contained signed ZIP
- Contents: human-readable PDFs + machine-readable JSON + SBOMs + scan reports
- SHA-256 manifest for integrity verification
- Each snapshot timestamped via RFC 3161 Qualified Trust Service Provider (QTSP)
  - eIDAS-qualified = legally binding in all 27 EU member states
  - Legal presumption of accuracy (eIDAS Regulation (EU) 910/2014)
  - Stronger than blockchain – no need to explain the mechanism to regulators
  - QTSP candidates: Bundesdruckerei (German), CertEurope (French), DigiCert EU
  - Cost: €0.01–0.05 per timestamp
- Snapshot triggers: quarterly schedule + on significant changes (SBOM update, vulnerability fix, obligation status change, DoC revision)
- Customer also receives a copy for their own archives

**Layer 2 – Scaleway Glacier (EU-sovereign cold storage)**
- **Scaleway Glacier** (https://www.scaleway.com/en/object-storage/)
  - French company (Iliad group), own data centres in Paris and Amsterdam
  - GDPR-native, genuinely EU-sovereign (not reselling AWS/Azure)
  - S3-compatible API – straightforward integration from backend
  - €0.00254/GB/month storage, €0.009/GB restoration
  - API requests included, 75 GB/month egress free
  - Designed for long-term archival with high durability
- **Why not OVHcloud?** OVHcloud Cold Archive resells AWS S3 Glacier – undermines the EU data sovereignty claim
- Alternative options evaluated: Hetzner Object Storage (German), Backblaze B2 EU (Amsterdam), Exoscale (Swiss), Iron Mountain EU, Piql (Arctic World Archive, Svalbard)

### Cost analysis (per product, 10-year lifecycle)

| Item | Calculation | Cost |
|------|-----------|------|
| Scaleway Glacier storage (40 quarterly snapshots, ~200 MB each = 8 GB) | 8 GB × €0.00254/GB/month × 120 months | ~€2.44 |
| Restoration (assume 2 full retrievals over 10 years) | 8 GB × €0.009/GB × 2 | ~€0.14 |
| RFC 3161 timestamps (40 snapshots) | 40 × €0.03 | ~€1.20 |
| Egress (within 75 GB/month free tier) | – | €0.00 |
| API requests (included by Scaleway) | – | €0.00 |
| **Total per product over 10 years** | | **~€3.78** |

At scale (100 customers, 5 products each = 500 products): **~€1,890 total over 10 years**, or ~€15.75/month platform-wide. Effectively free.

### Implementation plan

**#40 – Compliance snapshot generator** (Medium effort)
- Backend service that assembles a complete compliance archive ZIP for a product
- Includes: technical file (all 8 sections as Markdown + JSON), EU DoC as Markdown, all SBOM versions (SPDX JSON + CycloneDX JSON), vulnerability scan history JSON, obligation evidence JSON with status history, activity log JSON
- Format policy: Markdown for human-readable documents, JSON for machine-readable data – no PDF generation anywhere in the platform
- SHA-256 manifest file listing every file + hash
- Self-contained: includes a README explaining the archive structure and how to verify integrity without CRANIS2
- API endpoint: `POST /api/products/:id/compliance-snapshot`
- Manual trigger from product detail page ("Generate Compliance Snapshot" button)

**#41 – RFC 3161 qualified timestamping** (Low effort)
- Integrate with a QTSP API (Bundesdruckerei or CertEurope)
- After snapshot generation, compute SHA-256 of the ZIP, submit to QTSP, receive timestamp token
- Store timestamp token (.tsr file) alongside the archive
- Include verification instructions in the archive README
- `compliance_snapshots` table: product_id, org_id, snapshot_hash, timestamp_token, storage_url, created_at, size_bytes

**#42 – Scaleway Glacier integration** (Medium effort)
- S3-compatible upload of snapshot ZIP + timestamp token to Scaleway Glacier
- Bucket structure: `/{org_id}/{product_id}/{date}-snapshot.zip`
- Retrieval endpoint: `POST /api/products/:id/compliance-snapshot/:snapshotId/retrieve` (triggers restore from cold storage)
- Retrieval status polling (cold storage restore is async)
- Download endpoint once restored

**#43 – Automated snapshot scheduling** (Low effort)
- Cron job (quarterly) generates snapshots for all active products
- Event-triggered snapshots on significant changes:
  - SBOM update (new dependency sync)
  - Vulnerability scan with new findings
  - Obligation status change (any of 19 obligations)
  - EU DoC revision
  - Product version change
- Deduplication: skip snapshot if nothing has changed since last one (compare SHA-256 of content)
- Email notification to org admin when new snapshot is archived

**#44 – Retention dashboard** (Low effort)
- Product detail page section showing:
  - Market placement date (if set)
  - Retention deadline (market placement + 10 years, or support period end, whichever is later)
  - Days remaining on retention obligation
  - List of all archived snapshots with dates, sizes, and timestamp verification status
  - "Download snapshot" and "Retrieve from cold storage" actions
  - Visual timeline of snapshot history
- Admin dashboard: aggregate view across all products/orgs

### Audit response workflow
1. Market surveillance authority requests documentation
2. Customer (or CRANIS2 on their behalf) retrieves the relevant snapshot from cold storage (minutes to hours)
3. Provides the ZIP + RFC 3161 timestamp token
4. Authority can independently verify: re-hash the ZIP, check the timestamp against the QTSP's public certificate
5. Complete chain of evidence: what was documented, when it was documented, and proof it hasn't been tampered with

### Marketing angle
- "10-year compliance retention included" – no competitor offers this
- "Audit-ready in minutes, not weeks"
- "Your compliance evidence survives even if we don't" – builds trust
- "eIDAS-qualified timestamps – legally binding across the EU"
- "EU-sovereign cold storage – French infrastructure, no US cloud dependency"
- 10-year compliance vault included in the Pro plan product charge (€9/product/month) – no additional cost, no per-archive fees
- At ~€0.38/product/year, the retention cost is effectively zero – a rounding error inside the Pro subscription

### Customer exit & data portability policy

**Principle:** No sludge. A customer who leaves should take their compliance evidence with them – easily, completely, and without penalty. This is both ethically right and commercially smart (builds trust, reduces resistance to signing up).

**90-day grace period**
- When a customer cancels, their account enters a 90-day grace period with full read-only access
- All data remains intact – products, SBOMs, scan history, obligation evidence, snapshots
- Customer can reactivate at any time during the grace period (no re-onboarding)
- Email reminders at cancellation, 30 days, 60 days, and 7 days before expiry

**Automated exit package**
- One-click "Export Everything" generates a complete data package:
  - All historical compliance snapshots (ZIP + RFC 3161 timestamp tokens)
  - Current live data export (products, SBOMs, obligations, vulnerabilities, activity log) in JSON + CSV
  - EU Declarations of Conformity as Markdown
  - Technical file content as structured JSON + human-readable Markdown
  - Verification guide explaining how to independently verify timestamp tokens
- No export fees, no degraded formats, no artificial delays
- Available throughout the grace period and at any time during active subscription

**Post-cancellation archive persistence**
- Cold storage archives persist for the remainder of the 10-year retention period, even after cancellation
- Former customers can request retrieval of archived snapshots without an active subscription
- Retrieval charged at cost only (effectively free – Scaleway Glacier restoration is €0.009/GB)
- This is a legal obligation fulfilment, not a commercial lever

**Automatic deletion**
- After the 10-year retention deadline expires, archives are scheduled for deletion
- 30-day advance notice sent to the customer's registered email before any deletion
- Customer can request a final bulk download before deletion

**Anti-sludge commitments**
- No "call to cancel" – cancellation is self-service in account settings
- No downgrade-to-retain dark patterns
- No withholding of data behind premium tiers
- No format lock-in – all exports use open standards (JSON, CSV, Markdown, SPDX, CycloneDX)
- Exit package is the same whether on Standard or Pro plan

---

## Backlog

**#45 – Replace PDF generation with Markdown across the platform** – DONE (Session 44)
- Replaced all 6 pdfkit-based PDF generators with Markdown output
- Removed `pdfkit` and `@types/pdfkit` dependencies (~2MB saved)
- 24 files changed, 986 insertions, 1,633 deletions
- All report exports now use `text/markdown; charset=utf-8`, format param `md`
- Frontend buttons updated: "Download Report" / "Export Report" instead of PDF labels

---

## P9 – Public Conformity Assessments & Growth Funnels – ASSESSMENTS DONE, FUNNELS BACKLOG

### Completed (sessions 38–39)

- **CRA Conformity Assessment** — 12-question public assessment at `/cra-conformity-assessment`. Email verification, progress saving, per-section maturity scoring, emailed HTML reports. DONE
- **NIS2 Readiness Assessment** — 25-question public assessment at `/nis2-conformity-assessment`. Entity classification, supervision regime, penalty levels, per-section maturity. DONE
- **Assessment landing page** — `/conformity-assessment` with cards for both assessments. DONE
- **Launch list subscription** — Subscribe/unsubscribe with HMAC-signed tokens. DONE

### Backlog – Growth Funnels (not started)

**Strategy:** Every regulatory gap is a marketing opportunity. Each gap below is both a genuine compliance feature AND a conversion funnel entry point. The pattern: free assessment tool, email capture, nurture, CRANIS2 subscription.

### Features

#	Feature	Effort	Status	Funnel Hook
45	Importer/distributor obligation workflows	High	DONE	"Are you importing software into the EU? Check your CRA obligations"
46	Post-market monitoring & field issue tracking	High	DONE	"Is your product still CRA-compliant after launch?"
47	Conformity assessment module selector	Medium	DONE	"Which conformity assessment do you need? Free interactive tool"
48	Notified body directory & assessment tracking	Medium	DONE	"Find your notified body – prepare for third-party assessment"
49	Market surveillance registration (Art. 20)	Medium	DONE	"Critical product? You must register with market surveillance"
50	NIS2 entity classifier & obligation tracker	High	DONE	"Are you essential or important under NIS2? Free classifier"
51	Supply chain risk assessment (NIS2 Art. 21)	Medium	TODO	"Map your supply chain risk – beyond individual dependency checks"
52	Internal incident lifecycle management	Medium	TODO	"Detection → containment → recovery → lessons learned"
53	Cryptographic standards inventory	Low	DONE	"Will your crypto pass a CRA audit? SHA-1, RSA-1024, DES – find out"
54	End-of-life notification to downstream users	Low	TODO	"Notify your users before support ends – it's a CRA obligation"
55	EU Authorised Representative workflows (Art. 15)	Low	TODO	"Non-EU manufacturer? You need an EU representative"
56	Non-compliance reporting to authorities (Art. 19)	Low	TODO	"What to do when you discover your product is non-compliant"

### Conversion funnel architecture

Each feature maps to a three-stage funnel:

**Stage 1 – Free assessment (no registration required)**
- Interactive tool on the public website (cranis2.com)
- Answers a specific regulatory question the customer is Googling
- Examples: "Which conformity assessment module?", "Essential or important entity?", "Is your crypto CRA-ready?"
- Result: personalised gap report showing what they need to do

**Stage 2 – Email capture (free account)**
- "Save your results and get notified when regulations change"
- Free account with read-only access to their assessment
- Periodic email nurture with regulatory updates relevant to their profile
- No credit card required

**Stage 3 – Paid conversion (Standard or Pro)**
- Assessment shows gaps → CRANIS2 is the tool to close them
- "You need vulnerability scanning" → Standard plan
- "You need AI-assisted technical file completion" → Pro plan
- "You need 10-year compliance vault" → Pro plan

### Feature-to-funnel mapping

| Feature | Free Tool | Conversion Trigger |
|---------|-----------|-------------------|
| #45 Importer/distributor | "Check your importer obligations" quiz | "Track these obligations automatically" |
| #46 Post-market monitoring | "Post-market compliance checklist" PDF | "Automate field issue tracking" |
| #47 Conformity assessment selector | Interactive module selector | "Prepare your technical file for assessment" |
| #48 Notified body directory | Searchable EU notified body list | "Submit your technical file digitally" |
| #49 Market surveillance registration | "Do you need to register?" decision tree | "We'll prepare your registration package" |
| #50 NIS2 classifier | "Essential or important?" questionnaire | "Track NIS2 + CRA obligations together" |
| #51 Supply chain risk | "Rate your supply chain risk" scorecard | "Deep dependency analysis with SBOM scanning" |
| #52 Incident lifecycle | "Incident response readiness" checklist | "Automate your incident workflow" |
| #53 Crypto inventory | "Is your crypto CRA-ready?" scanner | "Continuous crypto compliance monitoring" |
| #54 End-of-life notification | "When must you notify users?" calculator | "Automated end-of-life communications" |
| #55 EU Authorised Rep | "Do you need an EU rep?" decision tree | "Manage your representative relationship" |
| #56 Non-compliance reporting | "What to report and when" guide | "Structured reporting with audit trail" |

### Content marketing angles

Each feature also generates blog/SEO content:
- "The complete guide to CRA importer obligations"
- "Post-market monitoring under the Cyber Resilience Act – what you need to know"
- "Module A vs Module H – choosing your conformity assessment path"
- "NIS2 vs CRA – where they overlap and where they don't"
- "Is SHA-1 still acceptable under the CRA?"
- "What happens when your product reaches end-of-life under CRA?"

### Priority order (based on market demand + implementation effort)

1. ~~**#47 Conformity assessment selector** – DONE (P9)~~
2. ~~**#50 NIS2 entity classifier** – DONE (P9)~~
3. ~~**#45 Importer/distributor workflows** – DONE~~
4. ~~**#46 Post-market monitoring** – DONE~~
5. ~~**#53 Crypto inventory** – DONE~~
6. ~~**#48 Notified body directory** – DONE~~
7. ~~**#49 Market surveillance registration** – DONE~~
8. **#52 Internal incident lifecycle** – Extends existing ENISA reporting
9. **#51 Supply chain risk assessment** – Extends existing due diligence
10. **#54 End-of-life notification** – Low effort, completes existing support period tracking
11. **#55 EU Authorised Rep** – Niche (non-EU manufacturers only)
12. **#56 Non-compliance reporting** – Niche, low frequency event

### Status: 7/12 DONE (#45, #46, #47, #48, #49, #50, #53 complete), 5 remaining
### Dependencies: #52 extends existing Art. 14 reporting
### Estimated effort: Medium (5 remaining items, ~3–5 sessions total)

### #57 — Platform Analytics Dashboard — DONE (Session 45)
Admin-only analytics page at `/admin/analytics`. KPI snapshot (users, orgs, products, repos, active users, contributors, subscribers), growth charts (weekly signups, cumulative users), revenue breakdown (MRR, by plan, by status), market intelligence (countries, industries, CRA roles, company sizes), assessment completions (CRA + NIS2 totals, breakdowns, weekly trends). Recharts bar/line/pie charts + data tables.

---

## Pre-Production Items

### #58 — Trusted Open Source & Non-Profit Access Model
**Status:** TODO — Full spec below. Priority: High.

### #59 — Multi-Language Support (i18n)
**Status:** TODO — Scope TBD. Platform UI + welcome site assessments.

---

# #58 Feature Specification — Trusted Open Source and Non-Profit Access Model

## Document Status
Proposed backlog item

---

# Objective

Allow open source projects, community projects and verified non-profit organisations to use CRANIS2 without contributor charges while preventing commercial abuse of the free tier.

The system must automatically classify organisations using repository metadata and behavioural signals, while allowing manual verification where appropriate.

The system must also implement a **Progressive Trust Model** so that open source eligibility is earned through observed behaviour rather than granted permanently at repository connection.

---

# 1 Feature Overview

CRANIS2 must introduce a **Trust Classification System** that determines whether an organisation qualifies for free access.

The classification must support the following categories.

| Classification | Description |
|---|---|
| Commercial | Standard paying organisation |
| Provisional Open Source | Newly connected public open source repository |
| Trusted Open Source | Open source project confirmed through behavioural signals |
| Community Project | Small public project with limited contributors |
| Verified Non Profit | Approved non profit organisation |
| Review Required | Potential abuse or uncertain classification |

Classification determines billing behaviour.

---

# 2 High Level Behaviour

When an organisation connects repositories, CRANIS2 must automatically evaluate eligibility for free usage.

Evaluation must occur during the following events.

- repository connection
- scheduled periodic review
- repository metadata updates
- manual admin review

The classification result must be stored with the organisation record.

---

# 3 Progressive Trust Model

CRANIS2 must not grant permanent free access immediately.

Instead, organisations must progress through trust stages.

## Stage 1 Provisional Open Source

A repository initially qualifies as **Provisional Open Source** if the following conditions are met.

| Condition | Requirement |
|---|---|
| Repository visibility | Public |
| Licence | OSI approved licence detected |
| Private repositories | None attached to organisation |
| Source provider | Supported repository provider |

Eligibility rule.

public repository equals true  
AND licence in OSI approved licences  
AND private repository count equals zero

This classification grants temporary free access.

Duration of provisional stage.

30 to 60 days.

Purpose.

Observe repository behaviour before granting permanent trusted status.

---

## Stage 2 Behavioural Trust Evaluation

During the provisional period CRANIS2 must calculate a **Trust Score** based on repository activity signals.

Signals.

| Signal | Description |
|---|---|
| Contributor count | Number of contributors |
| Fork count | Repository forks |
| Star count | Repository stars |
| Issue activity | Presence of public issue tracker |
| Pull requests | Public pull request activity |
| Release history | Presence of tagged releases |
| Commit activity | Recent commits |

Example scoring model.

| Signal | Points |
|---|---|
| Two or more contributors | 10 |
| Five or more contributors | 20 |
| Ten or more forks | 10 |
| Twenty or more stars | 10 |
| At least one release | 5 |
| Recent commits | 5 |

If the trust score exceeds a configurable threshold the organisation becomes **Trusted Open Source**.

---

## Stage 3 Trusted Open Source

When behavioural signals confirm legitimate open source activity the classification becomes **Trusted Open Source**.

Benefits.

| Feature | Access |
|---|---|
| SBOM generation | Full |
| Vulnerability scanning | Full |
| Licence compliance | Full |
| Technical file features | Full |
| Compliance vault | Limited snapshot quota |
| AI features | Limited token allowance |
| Integrations | Limited |

Trusted Open Source classification remains active unless abuse signals are detected.

---

# 4 Commercial Signal Detection

CRANIS2 must detect indicators that a repository is part of a commercial product.

Signals.

| Signal | Description |
|---|---|
| Corporate email domains | Contributors using corporate domains |
| Private repository mirrors | Public repo linked to private repos |
| Commercial organisation metadata | Organisation description indicates company |
| CI CD deployment pipelines | Pipelines referencing production deployment |
| Proprietary licence detection | Non OSI licence |
| Commercial website links | Organisation linked to product website |

If commercial signals exceed a defined threshold the organisation must be classified as **Review Required**.

Admin review must determine whether the organisation should convert to a commercial plan.

---

# 5 Non Profit Organisation Eligibility

CRANIS2 must support a **Verified Non Profit** classification.

## Application Workflow

The organisation must submit the following information.

| Requirement | Description |
|---|---|
| Organisation name | Registered name |
| Country | Registration country |
| Registration number | Charity or non profit number |
| Proof document | Uploaded verification document |
| Organisation website | Optional |

Submission triggers admin review.

Admin actions.

- approve
- reject
- request additional information

Approved organisations receive the Verified Non Profit classification.

---

# 6 Abuse Protection

Free access must be revoked automatically when specific triggers occur.

| Trigger | Behaviour |
|---|---|
| Private repository added | Convert organisation to commercial |
| Commercial signals exceed threshold | Flag for admin review |
| Repeated trust violations | Remove free eligibility |

When a private repository is added the organisation plan must convert to the commercial tier.

The organisation must be notified.

---

# 7 Trust Classification Data Model

Add the following fields to the organisation record.

| Field | Type | Description |
|---|---|---|
| trust classification | enum | classification type |
| trust score | integer | behavioural score |
| commercial signal score | integer | risk score |
| classification last review | timestamp | last evaluation |
| classification source | enum | automatic or manual |

Enum values.

- commercial  
- provisional open source  
- trusted open source  
- community project  
- verified nonprofit  
- review required  

---

# 8 Admin Dashboard Requirements

Add a **Trust Classification Panel** to the Admin dashboard.

Display fields.

| Field | Description |
|---|---|
| Organisation name | organisation identifier |
| classification | current classification |
| trust score | behavioural score |
| commercial signal score | risk score |
| contributor count | repository contributor count |
| repository count | connected repositories |
| licence types | detected licences |
| review status | manual review status |

Admin actions.

- approve open source
- approve non profit
- reclassify organisation
- suspend free access
- trigger re evaluation

---

# 9 Background Evaluation Jobs

Periodic evaluation must be implemented.

| Task | Frequency |
|---|---|
| Trust score recomputation | Weekly |
| Commercial signal detection | Weekly |
| Classification audit | Monthly |

These checks ensure classifications remain accurate.

---

# 10 Badge Feature Optional

Trusted open source projects may optionally display a badge.

CRA Compliance powered by CRANIS2

The badge links back to CRANIS2.

Purpose.

- ecosystem goodwill
- organic marketing
- developer adoption

---

# 11 Security Considerations

The system must ensure the following.

- no private repository metadata is exposed
- commercial signal detection does not store sensitive data
- uploaded verification documents are securely stored
- admin actions are fully logged

All classification changes must generate audit log entries.

---

# 12 Acceptance Criteria

The feature is complete when the following conditions are met.

- organisations connecting public OSI licensed repositories are automatically evaluated
- provisional open source stage is created on first connection
- behavioural scoring promotes projects to trusted open source
- commercial signals trigger review
- non profit verification workflow functions
- admin dashboard allows classification management
- free tier automatically converts to paid when private repositories are added
- audit logging captures classification decisions

---

# 13 Implementation Priority

Priority level is **High**.

This feature directly affects.

- pricing integrity
- developer goodwill
- abuse prevention
- ecosystem adoption
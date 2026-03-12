P0 — Must-have before launch — ALL DONE
#	Feature	Status
1	Email alerts	DONE
2	Notification bell	DONE
3	Compliance scorecard	DONE
4	CVD policy generator	DONE
5	Pre-prod cleanup	DONE

P1 — Important for credibility — ALL DONE
#	Feature	Status
6	Standalone report exports	DONE
7	In-field tooltips	DONE
8	Smart deadline alerts	DONE
9	End-of-support tracking	DONE

P2 — Polish for production — ALL DONE
#	Feature	Status
10	Product activity log	DONE
11	Compliance heat map	DONE
12	Webhook E2E tests	DONE

P3 — AI Automation (Pro plan) — ALL DONE
#	Feature	Effort	Status
13	AI Copilot	High	DONE
15	Auto-triage vulns	High	DONE
27	Copilot usage dashboard	Medium	DONE
16	Risk assessment generator	Medium	DONE
17	Incident report drafter	Medium	DONE
18	CRA category recommender	Low	DONE
19	Supplier due diligence questionnaire	Medium	DONE
20	Compliance gap narrator	Low	DONE

P4 — Public API & External Integrations — 5/7 DONE
#	Feature	Effort	Status	Notes
28	Public API with API key auth	High	DONE	Prerequisite for #14, #21
22	CI/CD compliance gate	Medium	DONE	Gate script + CI examples
26	Trello task creation	Medium	DONE	4 event types, dedup, resolution
14	MCP API server	High	DONE	5 tools, 12+ mitigation commands, SBOM rescan verification
21	IDE compliance assistant	Medium	DONE	Setup wizard on Integrations page, 4 IDE tabs, auto-generated config
23	GRC/audit tool bridge	Medium	PARKED
24	Chat ops integration	Low	PARKED
25	Slack notifications	Medium	PARKED

P5 — Supplier Marketplace (viral growth loop) — NOT STARTED
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

P6 — Compliance Document Library — ALL DONE
#	Feature	Effort	Status
35	Template download page	Low	DONE
36	Auto-populated templates	Medium	DONE
37	Full template library (7 templates)	High	DONE

P7 - Andi's good catches — 3/4 DONE
#	Feature	Effort	Status
38	AI CoPilot Prompt Engineering Topic Focus	High	PHASE 2 DONE
39	Automation wizards	Unknown	TODO
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

---

## Current Status & Next Steps

**P0–P3:** ALL COMPLETE (50/50 features done)
**P4:** 5/7 DONE (#28 Public API, #22 CI/CD gate, #26 Trello, #14 MCP server, #21 IDE assistant) — #23/#24/#25 parked for post-launch
**P5:** 0/7 — Supplier marketplace not started (post-launch)
**P6:** ALL DONE (document template library)
**Bugs:** 3/3 ALL DONE

**P7:** 3/4 DONE (#38 AI copilot prompts, #40 codebase modularity, #41 docs update) — #39 automation wizards TODO

**Immediate next:**
- P7 #39 — Automation wizards (batch fill, post-scan triage, onboarding wizard)
- Production deployment planning (Infomaniak hosting, cranis2.com)
- P5 — Supplier marketplace (post-launch)

---

## P8 — 10-Year Compliance Vault (Art. 13(10)) — 3/5 DONE

| # | Feature | Effort | Status |
|---|---------|--------|--------|
| 40 | Compliance snapshot generator | Medium | DONE |
| 41 | RFC 3161 qualified timestamping | Low | DONE |
| 42 | Scaleway Glacier cold storage | Medium | DONE |
| 43 | Automated snapshot scheduling | Low | TODO |
| 44 | Retention dashboard | Low | TODO |

**Why this matters:** The CRA requires technical documentation + EU DoC retained for at least 10 years after market placement (or support period, whichever is longer). No competitor is solving this. Most manufacturers have no idea how they'll comply. CRANIS2 can make it automatic, legally robust, and essentially free — included in the subscription.

**Approach:** CRANIS2 generates signed, self-contained compliance archives, timestamps them with an eIDAS-qualified service, and stores them on EU cold storage. Archives are readable without CRANIS2 — if we cease to exist, the customer's evidence survives.

### What must be retained (CRA Annex VII + Art. 13(10))
- All 8 Annex VII technical file sections (product description, design & development, vulnerability handling, risk assessment, support period, standards applied, test reports, declaration of conformity)
- EU Declaration of Conformity (Annex VI format)
- SBOMs — all historical versions (SPDX + CycloneDX)
- Vulnerability scan history, triage decisions, and CVD communications
- Security release classification records + SBOM diffs
- Obligation evidence (all 19 obligations with status history)
- Product activity audit trail

### Architecture (2 layers)

**Layer 1 — Automated compliance snapshots + RFC 3161 timestamps**
- CRANIS2 generates a compliance snapshot as a self-contained signed ZIP
- Contents: human-readable PDFs + machine-readable JSON + SBOMs + scan reports
- SHA-256 manifest for integrity verification
- Each snapshot timestamped via RFC 3161 Qualified Trust Service Provider (QTSP)
  - eIDAS-qualified = legally binding in all 27 EU member states
  - Legal presumption of accuracy (eIDAS Regulation (EU) 910/2014)
  - Stronger than blockchain — no need to explain the mechanism to regulators
  - QTSP candidates: Bundesdruckerei (German), CertEurope (French), DigiCert EU
  - Cost: €0.01–0.05 per timestamp
- Snapshot triggers: quarterly schedule + on significant changes (SBOM update, vulnerability fix, obligation status change, DoC revision)
- Customer also receives a copy for their own archives

**Layer 2 — Scaleway Glacier (EU-sovereign cold storage)**
- **Scaleway Glacier** (https://www.scaleway.com/en/object-storage/)
  - French company (Iliad group), own data centres in Paris and Amsterdam
  - GDPR-native, genuinely EU-sovereign (not reselling AWS/Azure)
  - S3-compatible API — straightforward integration from backend
  - €0.00254/GB/month storage, €0.009/GB restoration
  - API requests included, 75 GB/month egress free
  - Designed for long-term archival with high durability
- **Why not OVHcloud?** OVHcloud Cold Archive resells AWS S3 Glacier — undermines the EU data sovereignty claim
- Alternative options evaluated: Hetzner Object Storage (German), Backblaze B2 EU (Amsterdam), Exoscale (Swiss), Iron Mountain EU, Piql (Arctic World Archive, Svalbard)

### Cost analysis (per product, 10-year lifecycle)

| Item | Calculation | Cost |
|------|-----------|------|
| Scaleway Glacier storage (40 quarterly snapshots, ~200 MB each = 8 GB) | 8 GB × €0.00254/GB/month × 120 months | ~€2.44 |
| Restoration (assume 2 full retrievals over 10 years) | 8 GB × €0.009/GB × 2 | ~€0.14 |
| RFC 3161 timestamps (40 snapshots) | 40 × €0.03 | ~€1.20 |
| Egress (within 75 GB/month free tier) | — | €0.00 |
| API requests (included by Scaleway) | — | €0.00 |
| **Total per product over 10 years** | | **~€3.78** |

At scale (100 customers, 5 products each = 500 products): **~€1,890 total over 10 years**, or ~€15.75/month platform-wide. Effectively free.

### Implementation plan

**#40 — Compliance snapshot generator** (Medium effort)
- Backend service that assembles a complete compliance archive ZIP for a product
- Includes: technical file (all 8 sections as Markdown + JSON), EU DoC as Markdown, all SBOM versions (SPDX JSON + CycloneDX JSON), vulnerability scan history JSON, obligation evidence JSON with status history, activity log JSON
- Format policy: Markdown for human-readable documents, JSON for machine-readable data — no PDF generation
- SHA-256 manifest file listing every file + hash
- Self-contained: includes a README explaining the archive structure and how to verify integrity without CRANIS2
- API endpoint: `POST /api/products/:id/compliance-snapshot`
- Manual trigger from product detail page ("Generate Compliance Snapshot" button)

**#41 — RFC 3161 qualified timestamping** (Low effort)
- Integrate with a QTSP API (Bundesdruckerei or CertEurope)
- After snapshot generation, compute SHA-256 of the ZIP, submit to QTSP, receive timestamp token
- Store timestamp token (.tsr file) alongside the archive
- Include verification instructions in the archive README
- `compliance_snapshots` table: product_id, org_id, snapshot_hash, timestamp_token, storage_url, created_at, size_bytes

**#42 — Scaleway Glacier integration** (Medium effort)
- S3-compatible upload of snapshot ZIP + timestamp token to Scaleway Glacier
- Bucket structure: `/{org_id}/{product_id}/{date}-snapshot.zip`
- Retrieval endpoint: `POST /api/products/:id/compliance-snapshot/:snapshotId/retrieve` (triggers restore from cold storage)
- Retrieval status polling (cold storage restore is async)
- Download endpoint once restored

**#43 — Automated snapshot scheduling** (Low effort)
- Cron job (quarterly) generates snapshots for all active products
- Event-triggered snapshots on significant changes:
  - SBOM update (new dependency sync)
  - Vulnerability scan with new findings
  - Obligation status change (any of 19 obligations)
  - EU DoC revision
  - Product version change
- Deduplication: skip snapshot if nothing has changed since last one (compare SHA-256 of content)
- Email notification to org admin when new snapshot is archived

**#44 — Retention dashboard** (Low effort)
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
- "10-year compliance retention included" — no competitor offers this
- "Audit-ready in minutes, not weeks"
- "Your compliance evidence survives even if we don't" — builds trust
- "eIDAS-qualified timestamps — legally binding across the EU"
- "EU-sovereign cold storage — French infrastructure, no US cloud dependency"
- 10-year compliance vault included in the Pro plan product charge (€9/product/month) — no additional cost, no per-archive fees
- At ~€0.38/product/year, the retention cost is effectively zero — a rounding error inside the Pro subscription

### Customer exit & data portability policy

**Principle:** No sludge. A customer who leaves should take their compliance evidence with them — easily, completely, and without penalty. This is both ethically right and commercially smart (builds trust, reduces resistance to signing up).

**90-day grace period**
- When a customer cancels, their account enters a 90-day grace period with full read-only access
- All data remains intact — products, SBOMs, scan history, obligation evidence, snapshots
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
- Retrieval charged at cost only (effectively free — Scaleway Glacier restoration is €0.009/GB)
- This is a legal obligation fulfilment, not a commercial lever

**Automatic deletion**
- After the 10-year retention deadline expires, archives are scheduled for deletion
- 30-day advance notice sent to the customer's registered email before any deletion
- Customer can request a final bulk download before deletion

**Anti-sludge commitments**
- No "call to cancel" — cancellation is self-service in account settings
- No downgrade-to-retain dark patterns
- No withholding of data behind premium tiers
- No format lock-in — all exports use open standards (JSON, CSV, Markdown, SPDX, CycloneDX)
- Exit package is the same whether on Standard or Pro plan

---

## Backlog

**#45 — Replace PDF generation with Markdown across the platform** (Medium effort)
- Replace all 6 pdfkit-based PDF generators with Markdown output
- Affected files:
  - `backend/src/routes/product-reports.ts` — product compliance report
  - `backend/src/routes/reports.ts` — general reports
  - `backend/src/routes/technical-file/cvd-pdf.ts` — CVD policy PDF
  - `backend/src/routes/technical-file/doc-pdf.ts` — EU DoC PDF
  - `backend/src/routes/supplier-due-diligence.ts` — due diligence report
  - `backend/src/services/due-diligence.ts` — due diligence export
- Benefits: lighter files, version-controllable, future-proof, no pdfkit dependency
- Can remove `pdfkit` from package.json once complete
- Update frontend download links to serve `.md` files instead of `.pdf`
- Update tests accordingly

### Status: BACKLOG — ready to scope when prioritised
### Dependencies: None — can be built independently of other P8 items
### Estimated effort: Medium (5 items, ~4–5 sessions total)

---

## P9 — Compliance Coverage Gaps & Growth Funnels — NOT STARTED

**Strategy:** Every regulatory gap is a marketing opportunity. Each gap below is both a genuine compliance feature AND a conversion funnel entry point. The pattern: free assessment tool → demonstrates the gap → email capture → nurture → CRANIS2 subscription.

### Features

#	Feature	Effort	Status	Funnel Hook
45	Importer/distributor obligation workflows	High	TODO	"Are you importing software into the EU? Check your CRA obligations"
46	Post-market monitoring & field issue tracking	High	TODO	"Is your product still CRA-compliant after launch?"
47	Conformity assessment module selector	Medium	TODO	"Which conformity assessment do you need? Free interactive tool"
48	Notified body directory & assessment tracking	Medium	TODO	"Find your notified body — prepare for third-party assessment"
49	Market surveillance registration (Art. 20)	Medium	TODO	"Critical product? You must register with market surveillance"
50	NIS2 entity classifier & obligation tracker	High	TODO	"Are you essential or important under NIS2? Free classifier"
51	Supply chain risk assessment (NIS2 Art. 21)	Medium	TODO	"Map your supply chain risk — beyond individual dependency checks"
52	Internal incident lifecycle management	Medium	TODO	"Detection → containment → recovery → lessons learned"
53	Cryptographic standards inventory	Low	TODO	"Will your crypto pass a CRA audit? SHA-1, RSA-1024, DES — find out"
54	End-of-life notification to downstream users	Low	TODO	"Notify your users before support ends — it's a CRA obligation"
55	EU Authorised Representative workflows (Art. 15)	Low	TODO	"Non-EU manufacturer? You need an EU representative"
56	Non-compliance reporting to authorities (Art. 19)	Low	TODO	"What to do when you discover your product is non-compliant"

### Conversion funnel architecture

Each feature maps to a three-stage funnel:

**Stage 1 — Free assessment (no registration required)**
- Interactive tool on the public website (cranis2.com)
- Answers a specific regulatory question the customer is Googling
- Examples: "Which conformity assessment module?", "Essential or important entity?", "Is your crypto CRA-ready?"
- Result: personalised gap report showing what they need to do

**Stage 2 — Email capture (free account)**
- "Save your results and get notified when regulations change"
- Free account with read-only access to their assessment
- Periodic email nurture with regulatory updates relevant to their profile
- No credit card required

**Stage 3 — Paid conversion (Standard or Pro)**
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
- "Post-market monitoring under the Cyber Resilience Act — what you need to know"
- "Module A vs Module H — choosing your conformity assessment path"
- "NIS2 vs CRA — where they overlap and where they don't"
- "Is SHA-1 still acceptable under the CRA?"
- "What happens when your product reaches end-of-life under CRA?"

### Priority order (based on market demand + implementation effort)

1. **#47 Conformity assessment selector** — Low effort, high search volume, clear conversion path
2. **#50 NIS2 entity classifier** — High demand, positions CRANIS2 as CRA+NIS2 platform
3. **#45 Importer/distributor workflows** — Opens new customer segment
4. **#46 Post-market monitoring** — Genuine compliance gap for existing customers
5. **#53 Crypto inventory** — Low effort, high fear factor, good content marketing
6. **#48 Notified body directory** — Medium effort, valuable resource
7. **#52 Internal incident lifecycle** — Extends existing ENISA reporting
8. **#51 Supply chain risk assessment** — Extends existing due diligence
9. **#49 Market surveillance registration** — Niche but mandatory for critical products
10. **#54 End-of-life notification** — Low effort, completes existing support period tracking
11. **#55 EU Authorised Rep** — Niche (non-EU manufacturers only)
12. **#56 Non-compliance reporting** — Niche, low frequency event

### Status: BACKLOG — ready to scope when prioritised
### Dependencies: #45 builds on P5 supplier marketplace concepts; #52 extends existing Art. 14 reporting
### Estimated effort: High (12 items, ~10–15 sessions total)

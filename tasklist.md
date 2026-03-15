# CRANIS2 — Task List

---

## Phase 1: MVP (Complete)

All five MVP features are built, tested, and shipped.

- [x] SBOM Export (CycloneDX 1.6 + SPDX 2.3, structural validation)
- [x] Compliance Package (Due Diligence ZIP — PDF, SBOM, licence CSV, vuln summary, tech file)
- [x] IP / Copyright Proof (RFC 3161 timestamping, licence compatibility matrix)
- [x] Billing & Reports (Stripe, three report types with Markdown/CSV export)
- [x] Escrow Capability (self-hosted Forgejo, daily deposits, management UI)

---

## Phase 2: Compliance Framework (Complete)

- [x] Obligations auto-intelligence — derived statuses from platform data, `obligation-engine.ts`
- [x] Expanded obligations list (11 → 19 → 35) — Art. 13, 14, 16, 18, 19, 20, 32, Annexes
- [x] EU Declaration of Conformity — Annex V compliant, pre-filled from org/product data
- [x] Technical file auto-population — suggestions endpoint, auto-fill buttons, guidance text
- [x] Getting-started compliance checklist — per-product, sequenced, dashboard widget

---

## Phase 3: AI Intelligence & Billing (Complete)

- [x] AI Copilot — contextual AI Suggest buttons on 8 tech file sections + obligation evidence (P3 #13)
- [x] AI auto-triage — dismiss/acknowledge/escalate with confidence scores, auto-dismiss, CLI mitigations (P3 #15)
- [x] AI risk assessment generator — methodology, threat model, risk register, 13 Annex I mappings (P3 #16)
- [x] AI incident report drafter — ENISA Art. 14 stage content, non-destructive merge (P3 #17)
- [x] CRA category recommender — deterministic 4-attribute scoring + AI augmentation, admin rules, audit trail (P3 #18)
- [x] Supplier due diligence — deterministic questionnaires, npm/PyPI/crates.io enrichment, CSV export (P3 #19)
- [x] Compliance gap narrator — deterministic gap analysis, prioritised action list, Next Steps card (P3 #20)
- [x] Copilot usage dashboard — org billing, admin billing, product widget, token counts + cost (P3 #27)
- [x] Pro plan + admin-configurable pricing — Standard (€6/contributor) + Pro (€9/product + €6/contributor)
- [x] AI Copilot cost protection — per-org token budget, per-endpoint rate limits, response caching
- [x] Pro plan feature gating — API keys, CI/CD, marketplace behind Pro tier

---

## Phase 4: Public API & External Integrations (6/7 Done)

- [x] Public API with API key auth — `api_keys` table, SHA-256 hashed, 4 read-only scopes, v1 routes (P4 #28)
- [x] CI/CD compliance gate — configurable threshold, bash gate script, GitHub Actions/GitLab CI/generic examples (P4 #22)
- [x] Trello task creation — per-product board mapping, 4 event types, dedup, card resolution (P4 #26)
- [x] MCP API server — 5 tools, 12+ ecosystems, SBOM rescan validation (P4 #14)
- [x] IDE compliance assistant — VS Code/Cursor integration via MCP, in-app setup wizard (P4 #21)
- [x] GRC/audit tool bridge — OSCAL 1.1.2 export (catalog, profile, assessment-results, component-definition) (P4 #23)
- [ ] Chat ops / Slack notifications (P4 #24/#25) — PARKED for post-launch

---

## Phase 5: Supplier Marketplace (Not Started — Post-Launch)

- [ ] Supplier invitation flow (#28)
- [ ] Supplier compliance profile (#29)
- [ ] Auto-resolution of due diligence (#30)
- [ ] Marketplace directory (#31)
- [ ] Supplier analytics dashboard (#32)
- [ ] Supplier tier pricing (#33)
- [ ] Manufacturer trust signals (#34)

---

## P6: Compliance Document Library (Complete)

- [x] Template download page (#35)
- [x] Auto-populated templates (#36)
- [x] Full template library — 7 templates (#37)

---

## P7: AI & Codebase Quality (Complete)

- [x] AI CoPilot prompt engineering — 3-layer architecture, 32 prompts, quality standard (#38)
- [x] Automation wizards — Batch Fill, Post-Scan Triage, Onboarding (#39)
- [x] Codebase modularity refactor (#40)
- [x] Welcome page, user docs, FAQ update (#41)

---

## P8: 10-Year Compliance Vault (Complete)

- [x] Compliance snapshot generator + RFC 3161 timestamping (Phases A–B)
- [x] Ed25519 document signing (Phase C)
- [x] Retention reserve ledger + funding certificates (Phase D)
- [x] Storage lifecycle controls — grace period, pending deletion (Phase E)
- [x] Event-triggered snapshots (Phase F)
- [x] Admin retention dashboard with funding run + auto-extend (Phase G)

---

## P9: Public Conformity Assessments (Complete)

- [x] CRA Conformity Assessment — 12-question public tool
- [x] NIS2 Readiness Assessment — 25-question public tool
- [x] Assessment landing page + launch list subscription

---

## P9 Growth Funnels (12/12 ALL DONE)

- [x] #45 Importer/distributor obligation workflows — role-aware engine, compliance checklist, public assessment
- [x] #46 Post-market monitoring & field issue tracking — CRUD, corrective actions, obligation wiring, surveillance report
- [x] #47 Conformity assessment module selector
- [x] #48 Notified body directory & assessment tracking — 16 EU bodies, public directory, product assessment tracking, art_32_3 wiring
- [x] #49 Market surveillance registration (Art. 20) — 20 EU authorities, public decision tree, product registration tracking, art_20 wiring
- [x] #50 NIS2 entity classifier & obligation tracker
- [x] #51 Supply chain risk assessment (NIS2 Art. 21) — scoring engine (5 areas), public assessment, SupplyChainRiskCard, admin analytics
- [x] #52 Internal incident lifecycle — incidents + timeline tables, 8 endpoints, ENISA escalation, IncidentsTab, art_14 wiring, dashboard/analytics
- [x] #53 Cryptographic standards & quantum readiness inventory — scanner, PQC assessment, obligation wiring
- [x] #54 End-of-life notification — public calculator on welcome site (CRA Art. 13(15) timeline)
- [x] #55 EU Authorised Representative (Art. 15) — public decision tree on welcome site
- [x] #56 Non-compliance reporting (Art. 19) — public step-by-step guide on welcome site

---

## Standalone Features (Complete)

- [x] #45 PDF to Markdown migration — pdfkit removed, all exports now Markdown
- [x] #57 Platform Analytics Dashboard — admin-only KPIs, growth, revenue, market intel, assessments

---

## Bugs (All Fixed)

- [x] All Organisations → Actions button does nothing (#27)
- [x] ENISA Reporting → Cancel button does nothing (#28)
- [x] Products & Compliance → CRA category mismatch (#29)

---

## Cross-cutting (Complete)

- [x] Welcome page pricing overhaul
- [x] Admin org management
- [x] CSIRT country tracking
- [x] CRA Action Plan guided workflow
- [x] Product lifecycle stage + lifecycle-aware readiness
- [x] Test infrastructure fix + nightly runner + Trello notifications
- [x] CoPilot quality standard + 3-layer prompt architecture + admin prompt editor
- [x] Editorial standard (docs/EDITORIAL-STANDARD.md) + full codebase sweep
- [x] Forgejo test infrastructure fix (15 previously-expected failures now pass)

---

## Pre-Production

- [x] #58 Trusted Open Source & Non-Profit Access Model — trust scoring, OSI licence detection, abuse protection, non-profit verification, admin dashboard, scheduler, billing integration
- [ ] #59 Multi-language support — i18n/localisation of platform UI and public-facing welcome site (scope TBD)
- [ ] Production deployment — Infomaniak hosting, `cranis2.com` domain, DNS, SSL
- [ ] Update OAuth callback URLs and `FRONTEND_URL` for production

---

## Test Suite

- **Backend (Vitest):** ~1,611 tests (92 files), ~1,610 pass, 1 expected failure (category-recommendation needs Anthropic API)
- **E2E (Playwright):** ~280 tests
- **Nightly runner:** cron at 22:00 CEST, 14-day log retention, Trello notifications

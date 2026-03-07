# CRANIS2 — Task List

---

## Phase 1: MVP (Complete)

All five MVP features are built, tested, and shipped.

- [x] SBOM Export (CycloneDX 1.6 + SPDX 2.3, structural validation)
- [x] Compliance Package (Due Diligence ZIP — PDF, SBOM, licence CSV, vuln summary, tech file)
- [x] IP / Copyright Proof (RFC 3161 timestamping, licence compatibility matrix)
- [x] Billing & Reports (Stripe, three report types with PDF/CSV export)
- [x] Escrow Capability (self-hosted Forgejo, daily deposits, management UI)

---

## Phase 2: Compliance Framework (Complete)

- [x] Obligations auto-intelligence — derived statuses from platform data, `obligation-engine.ts`
- [x] Expanded obligations list (11 → 19) — Art. 13 sub-articles, Art. 16, Art. 20, Art. 32
- [x] EU Declaration of Conformity PDF — Annex V compliant, pre-filled from org/product data
- [x] Technical file auto-population — suggestions endpoint, auto-fill buttons, guidance text
- [x] Getting-started compliance checklist — per-product, sequenced, dashboard widget

---

## Phase 3: AI Intelligence & Billing (Complete)

- [x] AI Copilot — contextual AI Suggest buttons on 8 tech file sections + obligation evidence (P3 #13)
- [x] AI auto-triage — dismiss/acknowledge/escalate with confidence scores, auto-dismiss, CLI mitigations (P3 #15)
- [x] AI risk assessment generator — methodology, threat model, risk register, 13 Annex I mappings, PDF export (P3 #16)
- [x] AI incident report drafter — ENISA Art. 14 stage content, non-destructive merge (P3 #17)
- [x] CRA category recommender — deterministic 4-attribute scoring + AI augmentation, admin rules, audit trail (P3 #18)
- [x] Supplier due diligence — deterministic questionnaires, npm/PyPI/crates.io enrichment, PDF/CSV export (P3 #19)
- [x] Compliance gap narrator — deterministic gap analysis, prioritised action list, Next Steps card (P3 #20)
- [x] Copilot usage dashboard — org billing, admin billing, product widget, token counts + cost (P3 #27)
- [x] Pro plan + admin-configurable pricing — Standard (€6/contributor) + Pro (€9/product + €6/contributor), Stripe auto-prices
- [x] AI Copilot cost protection — per-org token budget, per-endpoint rate limits, response caching
- [x] Pro plan feature gating — API keys, CI/CD, marketplace behind Pro tier

---

## Phase 4: Public API & External Integrations (In Progress — 5/7 done)

- [x] Public API with API key auth — `api_keys` table, SHA-256 hashed, 4 read-only scopes, v1 routes (P4 #28)
- [x] CI/CD compliance gate — configurable threshold, bash gate script, GitHub Actions/GitLab CI/generic examples (P4 #22)
- [x] Trello task creation — per-product board mapping, 4 event types, dedup, card resolution (P5 #26)
- [x] MCP API server — 5 tools (list_products, get_vulnerabilities, get_mitigation, verify_fix, get_compliance_status), 12+ ecosystems, SBOM rescan validation (P4 #14)
- [x] IDE compliance assistant — VS Code/Cursor integration via MCP, in-app setup wizard on Integrations page (P4 #21)
- [ ] GRC/audit tool bridge — Vanta, Drata, OneTrust integration (P4 #23) — PARKED
- [ ] Chat ops integration — Slack/Teams bot for compliance queries (P4 #24) — PARKED
- [ ] Slack notifications — Push alerts to Slack channels (P4 #25) — PARKED

---

## Phase 5: Supplier Marketplace (Not Started)

Viral growth loop — manufacturers invite suppliers, suppliers publish verified compliance profiles.

- [ ] Supplier invitation flow — questionnaire includes CRANIS2 invite link, pre-filled signup (#28)
- [ ] Supplier compliance profile — public CRA compliance card per package (#29)
- [ ] Auto-resolution of due diligence — profile data auto-answers questionnaires (#30)
- [ ] Marketplace directory — public searchable directory with "Verified on CRANIS2" badge (#31)
- [ ] Supplier analytics dashboard — dependency count, pending questionnaires, readiness score (#32)
- [ ] Supplier tier pricing — free basic profile, premium verified tier (#33)
- [ ] Manufacturer trust signals — verified vs unverified indicators on Supply Chain tab (#34)

---

## Bugs

- [x] All Organisations → Actions button does nothing (#27)
- [x] ENISA Reporting → Cancel button does nothing (#28)
- [x] Products & Compliance → CRA category mismatch (class_i/class_ii vs important_i/important_ii/critical) (#29)

---

## Cross-cutting (Complete)

- [x] Welcome page pricing overhaul — enhanced feature lists, vertical layout, €9 Pro price
- [x] Admin org management — change plan, extend trial, delete organisations
- [x] CSIRT country tracking — organisation-level, auto-populates ENISA reports
- [x] Full route test coverage — 33/33 routes tested, 1126+ backend tests

---

## Pre-Production

- [ ] Production deployment — Infomaniak hosting, `cranis2.com` domain, DNS, SSL
- [ ] Update OAuth callback URLs and `FRONTEND_URL` for production
- [ ] Multi-language support — i18n/localisation (scope TBD)

---

## Notes

- 1126+ backend tests (65 files), ~280 E2E tests
- All P0–P3 work shipped and tested
- Immediate next: production deployment prep (remaining P4 items parked)

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
- [x] Pro plan feature gating — API keys, CI/CD, Trust Centre behind Pro tier

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

## Phase 5: Supplier Trust Centre (Not Started — Post-Launch)

- [ ] Supplier invitation flow (#28)
- [ ] Supplier compliance profile (#29)
- [ ] Auto-resolution of due diligence (#30)
- [ ] Trust Centre directory (#31)
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

## Pre-Production (Complete)

- [x] #58 Trusted Open Source & Non-Profit Access Model — trust scoring, OSI licence detection, abuse protection, non-profit verification, admin dashboard, scheduler, billing integration
- [x] Welcome site email verification — two-step verified contact form + subscribe flow, disposable email honeypot, DB persistence, admin Welcome Leads page
- [x] Trust Centre rename — Marketplace → Trust Centre across entire codebase (routes, services, frontend, tests, docs, e2e, help guides)
- [x] Affiliate programme — bonus codes, admin management (ledger, detail views), monthly statement automation, affiliate self-service dashboard, 35 tests

---

## Production Deployment (Complete — 2026-04-30, session 62)

Production live at `https://cranis2.com`. Full procedure: `docs/deployment-plan.md` (historical), `docs/backup-retention.md` (operational reference), `RESTART.md` "Production server" section.

- [x] Phase 1 — Server foundation (Docker CE 29.4.1, Compose v5.1.3, NGINX 1.24, certbot, fail2ban, UFW, nvm + Node 24, git)
- [x] Phase 2 — SSL & host NGINX (Let's Encrypt cert + auto-renew, full prod NGINX site at `/etc/nginx/sites-available/cranis2`, `client_max_body_size 200M`, security headers + Stripe-aware CSP)
- [x] Phase 3 — Stack deployed (Docker stack with `NODE_ENV=production` via `docker-compose.override.yml`, all containers bound to `127.0.0.1` only)
- [x] Phase 4 — Backup cron (daily 02:00 UTC, weekly verify Sun 04:00, key rotation check Mon 09:00)
- [x] Phase 5 — Smoke test core flow (signup → email verify → land on `/getting-started` end-to-end)
- [x] GFS retention (7d/4w/12m on prod; encrypted age-pull mirror to dev with 7d/4w/12m too)
- [x] Affiliate schema patched on prod Postgres (registration was failing before)
- [x] `/welcome` URL collision fixed — SPA route renamed to `/getting-started` (8 file edits)
- [x] Container ports 3001/3004 tightened to `127.0.0.1` only

**Outstanding pre-launch user actions:**

- [ ] DKIM verification for `poste.cranis2.com` at Resend dashboard + Infomaniak DNS
- [ ] Stripe live keys (currently `sk_test_*`) — get `sk_live_*`, live webhook (`whsec_*`), live `price_*` ID
- [ ] Secret rotation (Anthropic API key, Codeberg client secret, Codeberg webhook secret, signing key, Postgres password, Forgejo admin token) — see `feedback_compose_config_secrets.md`
- [ ] ICO registration (£40/year), update Privacy Policy placeholder
- [ ] Legal review of Privacy Policy + Terms of Service

---

## Launch Blockers (closed 2026-04-30 — historical record)

1. [x] `FRONTEND_URL` migration — `https://cranis2.com` set in prod `.env`
2. [x] Remove `/api/dev/*` routes — destructive endpoints removed
3. [x] Remove SBOM debug logging — `console.log` removed
4. [ ] DKIM verification for `poste.cranis2.com` — TODO (user-side, see Production Deployment outstanding above)
5. [x] Production infrastructure — Infomaniak VPS + `cranis2.com` + host NGINX + Let's Encrypt (no Cloudflare Tunnel — direct)
6. [x] Privacy Policy
7. [x] Terms of Service
8. [x] Cookie consent
9. [ ] Stripe production keys — TODO (user-side)
10. [x] Resend production domain — `EMAIL_FROM=info@poste.cranis2.com` working
11. [x] Docker Compose orphan container cleanup (CRN-14)
12. [x] `DEV_SKIP_EMAIL` confirmed `false` in production
13. [x] Production `LOG_LEVEL=info` set

---

## Open product bugs

- [ ] **SBOM resync should prune orphaned `Dependency` nodes/edges in Neo4j.** Found 2026-04-26 during dep-upgrade housekeeping for the CRANIS2 product. When a SBOM resync detects new dependency versions (e.g. `vite 8.0.10`), it adds new `Dependency` nodes + `DEPENDS_ON` edges from `Product`, but **does not remove** edges to the old versions (`vite 7.3.1`, `vite 6.4.1`). Knock-on impact: `reconcileFindings()` in the platform vuln scanner reads `currentDepsByProduct` from Neo4j, sees the old purls still present, and **doesn't auto-resolve** vulnerability findings whose dependency has actually been upgraded. Workaround: manually `MATCH (p:Product)-[r:DEPENDS_ON]->(d:Dependency)` and DELETE edges whose `(d.name, d.version)` is no longer in the current `product_sboms.spdx_json` after a resync. Proper fix: in the SBOM ingest path (`backend/src/services/github.ts` or wherever Neo4j writes happen), diff the new SBOM against existing edges and DETACH-DELETE the orphans before adding the new ones.
- [ ] **`runProductScan()` doesn't call `reconcileFindings()`** — only the platform-wide scan does. Per-product scans never auto-resolve stale findings, so users who hit the in-app "Scan now" button see findings persist even after dep upgrades. Same fix path: refactor `reconcileFindings()` to accept a single `productId` and call it from `runProductScan` after the new-findings sweep.
- [x] **`vulnerability_scans` schema vs scanner code drift** — fixed 2026-04-26 by adding `local_db_duration_ms` + `local_db_findings` columns.

---

## Parked (post-launch)

- [ ] #59 Multi-language support — i18n/localisation (scope TBD)
- [ ] P4 #24/#25 — Chat ops / Slack notifications
- [ ] P5 — Supplier Trust Centre (7 features, #28-34)
- [ ] 15 help guide stub rewrites
- [ ] Service unit test depth (7/71 services)
- [ ] Audit log route mapping
- [ ] Compliance Timeline SVG issue
- [ ] Enterprise Licensing — on-premise/private-cloud deployment model (scope TBD)
- [ ] Managed Service Hosting — dedicated hosted instances per customer (scope TBD)

---

## Test Suite

- **Backend (Vitest):** ~2,166 tests (121 files), ~2,166 pass, 0 fail, 36 skip, 1 expected infra failure (category-recommendation needs Anthropic API)
- **E2E (Playwright):** ~280 tests
- **Nightly runner:** cron at 22:00 CEST, 14-day log retention, Trello notifications

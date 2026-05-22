<!--
  Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
-->

# CRANIS2 — Completed-Work Import for Jira `CRAN`

**Purpose:** retrospective import of all completed work into the `CRAN` Jira project, broken down into epics, stories and discovery spikes, with acceptance criteria the team can verify against the as-built code and test suite. This is the **draft inventory for review** before bulk-create via the Jira REST API.

**Source-of-truth hierarchy:**
1. Git commit history (`git log` over 484 commits, 2026-02-20 → 2026-05-22) — authoritative for what shipped
2. Test files in `backend/tests/` (126 files), `e2e/` (28 specs) — authoritative for what is verified
3. Route files in `backend/src/routes/` (74 files) — authoritative for what endpoints exist
4. Synthesised memory (`completed_work.md`, RESTART.md) — narrative scaffold, treated as secondary

**Status convention:**
- All work that shipped to production is `Done`.
- Items explicitly parked (P4 #24/#25 Slack/ChatOps, multi-language i18n, etc.) are `Won't Do`.
- The existing `CRAN-29` and `CRAN-30` (already shipped) will be flipped from `To Do` → `Done`.
- `CRAN-31` ("API integration test — please ignore or delete") will be deleted.

**Labels in use:**
- `methodology-retrospective` — every ticket created from this import (so we can find / delete the set if needed)
- `tier:mvp` / `tier:p0` … `tier:p10` / `tier:standalone` / `tier:ws` — phase tagging
- `area:auth` / `area:sbom` / `area:vuln` / `area:copilot` / `area:see` / `area:gdpr` / `area:billing` / `area:trust` / `area:admin` / `area:ops` / `area:docs` — broad code-area tag
- `regulation:cra` / `regulation:nis2` / `regulation:gdpr` / `regulation:ai-act` — regulation alignment
- `verified-by:vitest` / `verified-by:playwright` / `verified-by:visual` / `verified-by:operational` — how AC is verified

**External-ID convention:** `EPIC-NN` (epics), `STORY-NN.MM` (stories under epic NN), `SPIKE-NN` (spikes). These are reference IDs *within this file only* — Jira will assign its own `CRAN-` keys at create time.

---

## Index

**Epics (42):**

| Ext ID | Summary | Area | Tests |
|---|---|---|---|
| EPIC-01 | Platform Foundation & Stack | ops | — |
| EPIC-02 | Identity, Auth & Session Model | auth | 5 files |
| EPIC-03 | Organisation & Multi-Tenant Model | ops | 2 files |
| EPIC-04 | Product Lifecycle | ops | 3 files |
| EPIC-05 | Repository Integration & SBOM Capture | sbom | 6 files |
| EPIC-06 | Local Vulnerability Database & Scanning | vuln | 5 files |
| EPIC-07 | Technical File (CRA Annex VII) | docs | 4 files |
| EPIC-08 | CRA Article 14 Reporting Workflow | cra | 3 files |
| EPIC-09 | Obligations Engine | cra | 3 files |
| EPIC-10 | IP/Copyright Proof & Compliance Snapshots | ops | 3 files |
| EPIC-11 | Licence Compliance Scanning | sbom | 4 files |
| EPIC-12 | Compliance Package & Reporting | docs | 6 files |
| EPIC-13 | Notifications & Activity Tracking | ops | 5 files |
| EPIC-14 | Webhooks (Cross-Provider) | sbom | 7 files |
| EPIC-15 | Cross-Product Overviews | ops | 4 files |
| EPIC-16 | Billing & Subscriptions (Stripe + Pro tier) | billing | 5 files |
| EPIC-17 | Marketplace → Trust Centre | trust | 3 files |
| EPIC-18 | Escrow (Forgejo Orchestrator) | ops | 2 files |
| EPIC-19 | Platform Admin | admin | 12 files |
| EPIC-20 | P3 — AI Copilot Suite | copilot | 8 files |
| EPIC-21 | P4 — External Integrations | ops | 5 files |
| EPIC-22 | P8 — 10-Year Compliance Vault | ops | 3 files |
| EPIC-23 | P9 — Public Conformity Assessments | cra | 1 file |
| EPIC-24 | P10 — Automated Article 14 Trigger Engine | cra | 4 files |
| EPIC-25 | Standalone — Post-Market Monitoring (#46) | cra | 1 file |
| EPIC-26 | Standalone — Notified Body Directory (#48) | cra | 2 files |
| EPIC-27 | Standalone — Market Surveillance Registration Art. 20 (#49) | cra | 2 files |
| EPIC-28 | Standalone — Supply Chain Risk Assessment NIS2 Art. 21 (#51) | nis2 | 1 file |
| EPIC-29 | Standalone — Internal Incident Lifecycle (#52) | ops | 1 file |
| EPIC-30 | Standalone — Cryptographic Standards & Quantum Readiness (#53) | ops | 2 files |
| EPIC-31 | Standalone — Trusted Open Source & Non-Profit Access (#58) | ops | 1 file |
| EPIC-32 | Software Evidence Engine (SEE) — 8 Phases | see | 4 files |
| EPIC-33 | Help Guide System Overhaul | docs | visual |
| EPIC-34 | Documentation Two-Audience Model | docs | content |
| EPIC-35 | Test Infrastructure & Hardening | ops | meta |
| EPIC-36 | WS1 — Database Backup & Restore | ops | 1 file |
| EPIC-37 | WS2 — PQC Foundation + Hybrid Signing | ops | 3 files |
| EPIC-38 | WS3 — Security Hardening + Key Rotation | ops | 2 files |
| EPIC-39 | WS4 — GDPR Compliance | gdpr | 2 files |
| EPIC-40 | Affiliate Programme | billing | 4 files |
| EPIC-41 | Production Launch (cranis2.com) | ops | operational |
| EPIC-42 | Ownership & Licensing Cleanup | docs | operational |

**Spikes (5):**

| Ext ID | Summary |
|---|---|
| SPIKE-01 | CRA Gap Analysis 2026-05-06 |
| SPIKE-02 | Two-Sided Market Refinement 2026-05-13 |
| SPIKE-03 | Promotion-Process Design (dev → prod) |
| SPIKE-04 | Methodology Framework |
| SPIKE-05 | Architectural Review for Rebuild |

**Out of this import (existing CRAN tickets, do not duplicate):**
- `CRAN-1` (Done) — Baseline as-is epic; this import is the body of work it summarises
- `CRAN-2` … `CRAN-28` (To Do) — forward-looking gap-analysis epics (not yet delivered)
- `CRAN-29` and `CRAN-30` — will be transitioned to Done as part of the housekeeping pass (their work is captured under [EPIC-02](#epic-02))
- `CRAN-31` — test ticket, will be deleted

---

## Epic descriptions (skeleton — stories follow in section 2)

### EPIC-01 — Platform Foundation & Stack

**Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`

**Description:**
Establish the runtime, build, and deployment stack the entire product sits on: a Vite/React/TypeScript frontend, an Express+Node backend, dual-database persistence (Postgres for relational, Neo4j for graph), an NGINX reverse proxy, a containerised Docker compose stack, and a Cloudflare Tunnel for public access from the dev host. Includes the session-continuity protocol (`RESTART.md`) that every later session has been opened against.

**Acceptance Criteria:**
- Docker compose brings up frontend (port 3002), backend (3001), Postgres (5433), Neo4j (7475/7688), and Forgejo (3003) — verified by `docker compose up -d` and the live service map in `RESTART.md` / `CLAUDE.md`.
- NGINX serves the React build with SPA fallback and proxies `/api/` to backend; Cloudflare Tunnel exposes `https://dev.cranis2.dev` (and later `https://cranis2.com`).
- `RESTART.md` exists at repo root, is the first read of every session.
- The "no escaped dollar signs" rule for `nginx/default.conf` is documented in `CLAUDE.md` after the live-incident fix.

**Sources:**
- Commits: `fc72fd4` (initial static prototype), `ab2fe28` (Vite+Docker scaffold), `37ee0bf` (RESTART.md), `e6d851a` (nginx $-escape fix), `ceddd7c` (Cloudflare Tunnel as part of broader Feb 21 bundle)

---

### EPIC-02 — Identity, Auth & Session Model

**Status:** Done | **Labels:** `methodology-retrospective`, `area:auth`, `verified-by:vitest`

**Description:**
Build the full self-service identity stack: email+password signup with strength validation, Resend-backed email verification, JWT session tokens, an Express + React `AuthContext`, passive telemetry on every auth event (IP/UA/locale captured into Postgres + Neo4j), platform-admin-initiated invitations, self-service password recovery (CRAN-29), account profile and email/password change page (CRAN-30), a session-invalidation watermark on credential change, locale-code tolerance on profile updates, OAuth-callback bare-route compatibility, pre-OAuth reassurance, admin and affiliate notifications on signup, and various UX polish (popup auto-close, login race condition).

**Acceptance Criteria:**
- 49+16+12 tests in `backend/tests/routes/auth.test.ts`, `routes/account-settings.test.ts`, `routes/password-reset.test.ts` all pass against the isolated test stack.
- Endpoints exist: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `GET /api/auth/verify-email`, `POST /api/auth/password-reset-request`, `POST /api/auth/password-reset`, `PUT /api/account/profile`, `PUT /api/account/password`, `PUT /api/account/email`, `POST /api/account/email/confirm`, `GET /api/account` — files `backend/src/routes/auth.ts`, `routes/account.ts`.
- Frontend routes mounted: `/signup`, `/login`, `/verify-email`, `/forgot-password`, `/reset-password`, `/accept-invite`, `/account`, `/getting-started`.
- `users.sessions_invalidated_before` watermark column rejects pre-reset tokens; documented in commit `f8c4ee3`.
- `auth_security_events` append-only audit table populated for `profile_updated`, `password_changed`, `email_change_requested`, `email_change_confirmed`, `password_reset_request`, `password_reset_confirm`.
- info@cranis2.com receives an email on every signup (`a9746b3`); the affiliate also receives a privacy-clean email when their bonus code drove the signup (`478253c`).

**Sources:**
- Commits: `eb0385f`, `40f4427`, `2d61fb5`, `d17de3f`, `ffa0ec1`, `02f097a`, `be2ae95`, `f8c4ee3`, `ca4bbdf`, `8910d22`, `a9746b3`, `478253c`, `75a957b`, `2033636`, `ec8e004` (pre-OAuth modal element)
- Tests: `routes/auth.test.ts`, `routes/account.test.ts`, `routes/account-settings.test.ts`, `routes/password-reset.test.ts`, `routes/auth-bonus-code.test.ts`
- Routes: `backend/src/routes/auth.ts`, `routes/account.ts`

---

### EPIC-03 — Organisation & Multi-Tenant Model

**Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:**
The tenancy boundary: every product, repo, contributor, and finding is scoped to an `Organisation` node. Includes the post-signup org-setup wizard (name / country / company size / CRA role / industry), the Postgres + Neo4j data model (Organisation node with `ADMIN_OF` / `BELONGS_TO` edges), the org page with members + CRA classification, and the cross-org data-isolation guarantee enforced by every authenticated route and verified by integration tests.

**Acceptance Criteria:**
- Tests in `routes/org.test.ts` and `integration/cross-org-data-isolation.test.ts` pass; no row from org A's tenant ever appears in a query response served to an authenticated user of org B.
- Endpoints exist: `POST /api/org`, `GET /api/org`, `GET /api/org/members` (`backend/src/routes/org.ts`).
- Org-setup wizard redirects unauthenticated-and-unowned users to `/setup/org`; verified by `e2e/acceptance/organisation-management.spec.ts`.
- Five CRA roles supported via `Organisation.craRole` property: `manufacturer`, `importer`, `distributor`, `open_source_steward` (treated as manufacturer for obligation derivation).

**Sources:**
- Commits: `bac8ad5`, `0c7bc1e`, `a4f8a45`
- Tests: `routes/org.test.ts`, `integration/cross-org-data-isolation.test.ts`, `e2e/acceptance/organisation-management.spec.ts`
- Routes: `backend/src/routes/org.ts`

---

### EPIC-04 — Product Lifecycle

**Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:playwright`

**Description:**
Full CRUD on products, with a tabbed detail page (Overview / Supply Chain / Compliance / Security / Evidence) and a deletion flow that exports the full product data set as a ZIP, makes a final escrow deposit, and cascade-cleans 15 Postgres tables + Neo4j relationships before removing the product node. Repository URL is a first-class field on Product with scheme-normalised hrefs to defend against schemeless input.

**Acceptance Criteria:**
- Tests in `routes/products.test.ts` and `integration/product-lifecycle.test.ts` pass; E2E coverage in `e2e/acceptance/product-crud.spec.ts`.
- Endpoints exist in `backend/src/routes/products.ts`: create / list / read / update / delete.
- Two-tier tab navigation present on `ProductDetailPage.tsx` with 5 groups; `cranis2:tab-change` custom event dispatches and is heard by `HelpPanelContext`.
- Deletion offers ZIP export of all product data (SBOM / vulns / licences / IP proof / CRA docs), triggers a final `product_deleted` escrow deposit, and cleans 15 tables in FK-safe order; Forgejo escrow repo preserved as permanent archive.
- `ensureHttpScheme()` defends repo-URL hrefs on the header badge and the OverviewTab row (`f37b00b`).

**Sources:**
- Commits: `ac719b4`, `50bd2cf`, `27152d4` (deletion + data exit), `f37b00b` (scheme fix)
- Tests: `routes/products.test.ts`, `integration/product-lifecycle.test.ts`, `e2e/acceptance/product-crud.spec.ts`
- Routes: `backend/src/routes/products.ts`

---

### EPIC-05 — Repository Integration & SBOM Capture

**Status:** Done | **Labels:** `methodology-retrospective`, `area:sbom`, `verified-by:vitest`

**Description:**
Connect to six Git providers (GitHub, Codeberg, Gitea, Forgejo, GitLab, Bitbucket Cloud) and capture the full software bill of materials in a deterministic, custody-free way. SBOM generation uses a three-tier fallback chain: provider SBOM API where available (GitHub Dependency Graph), then lockfile parsing across 28 ecosystems, then orchestrator-driven source import scanning across 26 languages. Outputs are CycloneDX 1.6 and SPDX 2.3 enriched with SHA-512 (npm) / SHA-256 (PyPI) hashes and full manufacturer metadata. Repo connections are scoped to the **organisation**, not the user — `requireOrgAdmin` gates connect / disconnect / PAT actions; non-admin members keep read-only visibility and sync rights.

**Acceptance Criteria:**
- Tests pass: `routes/sbom-export.test.ts`, `routes/repo-connections.test.ts`, `services/lockfile-parsers.test.ts` (236), `integration/tier3-import-scanning.test.ts` (24 against local Forgejo).
- E2E `e2e/acceptance/sbom-generation-and-export.spec.ts` + `repo-connection.spec.ts` pass.
- Endpoints in `routes/github/`, `routes/sbom-export.ts`: `POST /api/github/connect-init`, `GET /api/github/callback/:provider?`, `POST /api/repo/connect-pat`, `DELETE /api/repo/disconnect/:provider`, `GET /api/sbom-export/:productId/cyclonedx|spdx`, etc.
- `RepoProvider` type covers six providers; `PROVIDER_REGISTRY` and all 16 dispatcher functions handle each.
- `repo_connections.org_id` (not `user_id`) is the scope; `connected_by_user_id` is audit-only. Same-org duplicates collapsed during migration via most-recent-wins (`ec8e004`).
- Bare `/api/github/callback` route returns 200 (Express 5 path-to-regexp fix `75a957b`).

**Sources:**
- Commits: `532ed27` (GitHub OAuth read-only), `80fb0ce` (popup + connect-init token), `ceddd7c` (Dependency Graph SBOM as part of bundle), `1cf07d9` (CycloneDX 1.6 + SPDX 2.3 + hash enrichment), `f11bc40` (gap detection + lockfile resolver), `7d4a2dd` (modular 5-provider registry + 28 lockfile parsers + 26 language plugins + import scanner + three-tier fallback), `8974cbe` (PAT auth for self-hosted), `0eb49cd` (25 PAT auth tests), `09d16d3` (24 Tier 3 E2E tests), `ec8e004` (org-scoped + admin-gated + reassurance modal), `75a957b` (callback route shape), `2033636` (popup auto-close)
- Tests: `routes/sbom-export.test.ts`, `routes/repo-connections.test.ts`, `services/lockfile-parsers.test.ts`, `integration/tier3-import-scanning.test.ts`, `e2e/acceptance/sbom-generation-and-export.spec.ts`, `e2e/acceptance/repo-connection.spec.ts`
- Routes: `backend/src/routes/github/*`, `routes/sbom-export.ts`

---

### EPIC-06 — Local Vulnerability Database & Scanning

**Status:** Done | **Labels:** `methodology-retrospective`, `area:vuln`, `verified-by:vitest`

**Description:**
Replace external-API vulnerability scanning (OSV / GitHub Advisory / NVD) with a local Postgres-backed advisory database (263K GHSA + 182K NVD CVEs), a flattened CPE index for ecosystem-strict NVD matching, and a deterministic severity-normalisation layer. Scan time dropped from ~6 minutes to ~0.25s and eliminates false positives caused by NVD keyword search on scoped npm names. Platform-wide deduplicated scanning attributes findings to all affected products, sends targeted stakeholder notifications, and feeds the risk findings UI. Per-product scans run with a 409 guard against concurrency.

**Acceptance Criteria:**
- Tests pass: `routes/vulnerability-scan.test.ts`, `routes/risk-findings.test.ts`, `routes/risk-findings-regression.test.ts`, `routes/admin-vuln-scan.test.ts`.
- E2E `e2e/acceptance/vulnerability-reports-lifecycle.spec.ts` passes.
- Endpoints exist in `routes/risk-findings.ts` and `routes/admin/vuln-scan.ts`; admin pages at `/admin/vuln-db` and `/admin/vuln-scan`.
- `vuln_db_advisories`, `vuln_db_nvd`, `vuln_db_nvd_cpe_index`, `vuln_db_sync_status`, `vulnerability_scans`, `platform_scan_runs` tables present (idempotent guards in `pool.ts initDb()`).
- `normaliseSeverity()` handles GitHub `moderate` ↔ standard `medium`; `GENERIC_CPE_NAMES` blocklist prevents scoped-npm false positives.
- `auto_resolved` findings surface as resolved in API responses (session 60 fix).

**Sources:**
- Commits: `fadff46` (multi-source scanning baseline), `e553f1e` (platform-wide scan + notifications + admin page), `4494ffb` (local DB + CPE index, 6m → 0.25s), `ba591b1` (RESTART notes), `ab7ec03` (risk-findings UI, View/Close/Mark mitigated, 409 guard)
- Tests: `routes/vulnerability-scan.test.ts`, `routes/risk-findings.test.ts`, `routes/risk-findings-regression.test.ts`, `routes/admin-vuln-scan.test.ts`, `e2e/acceptance/vulnerability-reports-lifecycle.spec.ts`
- Routes: `backend/src/routes/risk-findings.ts`, `routes/admin/vuln-scan.ts`

---

### EPIC-07 — Technical File (CRA Annex VII)

**Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`, `regulation:cra`, `verified-by:vitest`

**Description:**
The CRA-Annex-VII-compliant Technical File: an 8-section editor with autosave, an Annex I Part I essential-requirements checklist, a Batch-Fill wizard (deterministic auto-population from existing org / product / SBOM data), a templates library (37 templates), DoC and CVD-policy Markdown exports, and a cross-product Technical Files overview. PDF generation was migrated entirely to Markdown (six pdfkit generators replaced, pdfkit dependency removed) to avoid a binary-format dependency for what is fundamentally documentary output.

**Acceptance Criteria:**
- Tests pass: `routes/technical-files.test.ts`, `routes/technical-files-overview.test.ts`, `routes/batch-fill.test.ts`, `routes/document-templates.test.ts`.
- E2E `e2e/acceptance/technical-files.spec.ts` passes.
- Endpoints exist in `routes/technical-file/` (sub-router with `sections.ts`, `batch-fill.ts`, `doc-pdf.ts`, `cvd-pdf.ts`): GET / PUT per section, POST batch-fill, GET DoC, GET CVD policy.
- `technical_file_sections`, `document_templates`, `obligations` tables present.
- DoC and CVD download routes return `Content-Type: text/markdown` with `.md` filenames; button labels say "(MD)" not "PDF" (`b81b52e`).
- Help guide `ch4_05` ("Batch Fill wizard") complete with 6 stations + Beck-map JSON.

**Sources:**
- Commits: `ceddd7c` (initial 8 sections), `a4f8a45` (tech-files overview + obligations table), feature commits across Phase 2/P6/#45 PDF→MD migration, `b81b52e` (label fix)
- Tests: `routes/technical-files.test.ts`, `routes/technical-files-overview.test.ts`, `routes/batch-fill.test.ts`, `routes/document-templates.test.ts`, `e2e/acceptance/technical-files.spec.ts`
- Routes: `backend/src/routes/technical-file/*`, `routes/technical-files-overview.ts`

---

### EPIC-08 — CRA Article 14 Reporting Workflow

**Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `regulation:cra`, `verified-by:vitest`

**Description:**
The three-stage CRA Art. 14 notification process: Early Warning (24h), Notification (72h), Final Report (14 days / 1 month). Includes CSIRT-country selection, TLP classification, the "create-from-finding" deep-link flow, deadline tracking with countdown chips, and (added in P10) a submit-with-authorisation flow that captures an authorising-user attestation and co-stores an RFC3161 timestamp token with the submission at each stage.

**Acceptance Criteria:**
- Tests pass: `routes/cra-reports.test.ts`, `integration/cra-report-lifecycle.test.ts`, `services/submission-attestation.test.ts`.
- Endpoints in `routes/cra-reports.ts`: create / list / read / update / submit; submit captures attestation + RFC3161 token.
- `cra_reports` table includes `actively_exploited` flag auto-derived from KEV/EPSS state (added by EPIC-24).
- Deadlines are derived from `awareness_at`; countdown UI on per-product regulatory-state view.

**Sources:**
- Commits: `624eb8e` (Article 14 ENISA workflow), `949aef2` (P10b-1 auto-trigger), `b8441c0` (P10b-2 RFC3161 attestation on awareness), `290d85f` (P10d submit-with-authorisation + RFC3161 on stage submit)
- Tests: `routes/cra-reports.test.ts`, `integration/cra-report-lifecycle.test.ts`, `services/submission-attestation.test.ts`
- Routes: `backend/src/routes/cra-reports.ts`

---

### EPIC-09 — Obligations Engine

**Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `regulation:cra`, `verified-by:vitest`

**Description:**
A role-aware obligations engine that maps every CRA obligation onto every product based on its CRA category (`default` / `important_i` / `important_ii` / `critical`) AND the organisation's CRA role (`manufacturer` / `importer` / `distributor` / `open_source_steward`). Carries 35 obligations total (19 manufacturer per Art. 13/14/16/20/32/Annexes, 10 importer per Art. 18, 6 distributor per Art. 19). Status is `effective = max(manual, derived)` — manual entries are always preserved over machine derivation.

**Acceptance Criteria:**
- Tests pass: `routes/obligations.test.ts`, `services/obligation-engine-roles.test.ts`, `integration/role-specific-obligations.test.ts`.
- E2E `e2e/acceptance/role-aware-obligations.spec.ts` passes.
- `obligations` unique constraint is `(org_id, product_id, obligation_key)`; `ON CONFLICT DO NOTHING` used everywhere.
- `getApplicableObligations(craCategory, craRole?)`, `computeDerivedStatuses()`, `ensureObligationsBatch()` (chunked at 500 rows) all in `backend/src/services/obligation-engine.ts` and used by all 10 call sites.
- All call sites pass `craRole` from the org's Neo4j `craRole` property.

**Sources:**
- Commits: `a4f8a45` (obligations table + tracker), feature commits across Phase 2 / Phase 3, role-specific work, `services/obligation-engine.ts` registry build-out
- Tests: `routes/obligations.test.ts`, `services/obligation-engine-roles.test.ts`, `integration/role-specific-obligations.test.ts`, `e2e/acceptance/role-aware-obligations.spec.ts`
- Routes: `backend/src/routes/obligations.ts`, `services/obligation-engine.ts`

---

### EPIC-10 — IP/Copyright Proof & Compliance Snapshots

**Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:**
RFC 3161 timestamping via FreeTSA (pure-Node ASN.1 DER encoding, no external libraries) creates a tamper-evident snapshot of every compliance artefact at point-in-time. Each snapshot can be exported as a verifiable proof ZIP. Signing is hybrid post-quantum: Ed25519 + ML-DSA-65 — verifyHybridSignature() AND-logic both signatures so a future quantum break of Ed25519 alone is not catastrophic.

**Acceptance Criteria:**
- Tests pass: `routes/ip-proof.test.ts`, `routes/compliance-snapshots.test.ts`, `security/hybrid-signing.test.ts` (23 tests).
- `signDocument()` returns Ed25519 (64 bytes) + ML-DSA-65 (3,309 bytes); both `.sig` and `.sig.mldsa` written next to compliance ZIPs (`backend/src/services/compliance-snapshot.ts`).
- `/.well-known/cranis2-signing-key-mldsa.pem` returns 200 with the ML-DSA-65 public key.
- Graceful degradation: falls back to Ed25519-only if `CRANIS2_SIGNING_KEY_MLDSA` is unset.

**Sources:**
- Commits: `eb0f7e6` (RFC 3161 + licence scan + transitive enrichment bundle — IP proof part), WS2 Part 2 hybrid signing commits, `generate-signing-keys.sh`
- Tests: `routes/ip-proof.test.ts`, `routes/compliance-snapshots.test.ts`, `security/hybrid-signing.test.ts`
- Routes: `backend/src/routes/ip-proof.ts`, `routes/compliance-snapshots.ts`, `services/signing.ts`, `services/compliance-snapshot.ts`

---

### EPIC-11 — Licence Compliance Scanning

**Status:** Done | **Labels:** `methodology-retrospective`, `area:sbom`, `verified-by:vitest`

**Description:**
Classify every dependency licence per SPDX into `permissive` / `copyleft_weak` / `copyleft_strong` / `unknown`, derive per-dependency risk against the product's distribution model (proprietary binary, SaaS, source-available, library, internal), flag incompatibilities through a 14-entry FSF cross-licence conflict table, and surface verdicts (compatible / incompatible / review_needed) in the scanner output, the recheck endpoint, frontend badges and filters, and the due-diligence PDF export. Manual sync paths auto-trigger licence scan + IP proof timestamp (previously only the 2 AM scheduler did).

**Acceptance Criteria:**
- Tests pass: `routes/license-scan.test.ts`, `routes/due-diligence.test.ts`, `integration/due-diligence-export.test.ts`.
- E2E `e2e/acceptance/due-diligence-package.spec.ts` passes.
- Per-dependency licence risk visible on the Dependencies tab and Licences page.
- Acknowledge / waive workflow persists `licence_findings.acknowledged_by`, `acknowledged_at`, `waiver_reason`.
- Transitive depth tagged on Neo4j `DEPENDS_ON` edges (89 direct, 295 transitive measured on the CRANIS2 repo itself).

**Sources:**
- Commits: `eb0f7e6` (IP proof + licence scan + transitive enrichment), `5199d40` (distribution-model compatibility matrix), `4dd6841` (due-diligence ZIP)
- Tests: `routes/license-scan.test.ts`, `routes/due-diligence.test.ts`, `integration/due-diligence-export.test.ts`, `e2e/acceptance/due-diligence-package.spec.ts`
- Routes: `backend/src/routes/license-scan.ts`, `routes/due-diligence.ts`

---

### EPIC-12 — Compliance Package & Reporting

**Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`, `verified-by:vitest`

**Description:**
Per-product reporting surface: a Compliance Package endpoint (ZIP bundle of all CRA-evidence-relevant artefacts), individual reports (CRA Annex VII PDF→MD, conformity, dependencies CSV, vulnerability summary JSON, IP proof), a categorised SBOM-compliance gap detector that explains *why* a hash couldn't be resolved (`no_version`, `unsupported_ecosystem`, `not_found`, `fetch_error`, `pending`), and a per-product historical compliance timeline rendered with Recharts.

**Acceptance Criteria:**
- Tests pass: `routes/reports.test.ts`, `routes/product-reports.test.ts`, `routes/compliance-gaps.test.ts`, `routes/compliance-timeline.test.ts`, `routes/compliance-checklist.test.ts`, `integration/compliance-package-journey.test.ts`.
- E2E `e2e/acceptance/reports.spec.ts` passes.
- Endpoints in `routes/reports.ts`, `routes/product-reports.ts`, `routes/compliance-gaps.ts`, `routes/compliance-timeline.ts`, `routes/compliance-checklist.ts`.
- Gap detection surfaces categorised breakdown in export-status endpoint and frontend info panel; `sendComplianceGapNotification()` targets security_contact + compliance_officer with debounce.
- Compliance timeline summary card uses live actionable findings count (session 60 fix); CRA readiness capped at 100% (session 60 fix).

**Sources:**
- Commits: `f11bc40` (gap detection), `0302d55` (gap categorisation fix), `5e11e33` (compliance timeline), `4dd6841` (due-diligence report export), Phase 2 commits for compliance checklist
- Tests: `routes/reports.test.ts`, `routes/product-reports.test.ts`, `routes/compliance-gaps.test.ts`, `routes/compliance-timeline.test.ts`, `routes/compliance-checklist.test.ts`, `integration/compliance-package-journey.test.ts`, `e2e/acceptance/reports.spec.ts`
- Routes: `backend/src/routes/reports.ts`, `routes/product-reports.ts`, `routes/compliance-gaps.ts`, `routes/compliance-timeline.ts`, `routes/compliance-checklist.ts`

---

### EPIC-13 — Notifications & Activity Tracking

**Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:**
Three layered notification surfaces: in-app notifications (sidebar bell badge + polling + filterable notifications page), Resend-backed email notifications routed to stakeholder roles (security contact, compliance officer, tech file owner, incident response lead, platform admin), and an append-only audit / activity log capturing both user-driven and system events (webhooks land with `NULL user_id` rendered as `system`). Activity log uses `LEFT JOIN users` so system events appear.

**Acceptance Criteria:**
- Tests pass: `routes/notifications.test.ts`, `routes/audit-log.test.ts`, `routes/audit.test.ts`, `routes/product-activity.test.ts`, `services/alert-emails.test.ts`.
- E2E `e2e/acceptance/notifications.spec.ts` passes.
- `notifications`, `user_events` tables present; events for verify/login/failure/org-creation/webhooks recorded.
- Sidebar bell badge polls and updates count in real time.
- `routes/audit.ts` and `routes/audit-log.test.ts` confirm webhook events appear with user="system" via `LEFT JOIN`.

**Sources:**
- Commits: `e553f1e` (notifications + platform scan), `d17de3f` (telemetry layer), `c68d6e3` (audit log live data), `516fbee` (webhook audit logging), `625908f` (system events fix)
- Tests: `routes/notifications.test.ts`, `routes/audit-log.test.ts`, `routes/audit.test.ts`, `routes/product-activity.test.ts`, `services/alert-emails.test.ts`, `e2e/acceptance/notifications.spec.ts`
- Routes: `backend/src/routes/notifications.ts`, `routes/audit.ts`, `routes/product-activity.ts`

---

### EPIC-14 — Webhooks (Cross-Provider)

**Status:** Done | **Labels:** `methodology-retrospective`, `area:sbom`, `verified-by:vitest`

**Description:**
HMAC-SHA256-verified push webhooks from GitHub, Codeberg (via Forgejo-test instance), Forgejo, and Bitbucket (X-Event-Key, no HMAC — verified by checking the repo is tracked); Stripe webhooks with stripe-signature verification. Push events mark the product's SBOM stale and record a `webhook_sbom_stale` audit-log entry. Per-org cleanup on org deletion explicitly cascades the connections and unsubscribes webhooks. Health and registration endpoints support operational verification.

**Acceptance Criteria:**
- Tests pass: `routes/webhook-e2e.test.ts`, `routes/webhook-health.test.ts`, `routes/webhook-registration.test.ts`, `webhooks/github-webhook.test.ts`, `webhooks/codeberg-webhook.test.ts`, `webhooks/stripe-webhook.test.ts`, `routes/push-events.test.ts`.
- Endpoints: `POST /api/webhooks/github`, `POST /api/webhooks/codeberg`, `POST /api/webhooks/bitbucket`, `POST /api/webhooks/stripe`; GET / DELETE for registration.
- Codeberg B5/B6 webhook E2E tests pass against the local Forgejo instance.

**Sources:**
- Commits: `516fbee` (audit logging), `ceddd7c` (initial GH webhook bundle), various provider expansions, Bitbucket session-59 commit, Stripe `8987f8a`
- Tests: as listed
- Routes: `backend/src/routes/github/webhook.ts`, `routes/push-events.ts`

---

### EPIC-15 — Cross-Product Overviews

**Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:**
Org-level rollup pages so a compliance lead can see everything across all products at once: Stakeholders (org + product roles), Contributors overview (with sync status), Dependencies overview (with risk), Repos overview (with last-sync state).

**Acceptance Criteria:**
- Tests pass: `routes/stakeholders.test.ts`, `routes/contributors-overview.test.ts`, `routes/dependencies-overview.test.ts`, `routes/repos-overview.test.ts`.
- Sidebar nav exposes all four routes; deep links from each row land on the relevant product detail tab via `?tab=` query parameter.
- `stakeholders` table has org-level + product-level rows with inline-edit endpoints.

**Sources:**
- Commits: `a4f8a45` (initial stakeholders + tech-files overview + obligations tracker), `fadff46` (cross-product overviews baseline)
- Tests: `routes/stakeholders.test.ts`, `routes/contributors-overview.test.ts`, `routes/dependencies-overview.test.ts`, `routes/repos-overview.test.ts`
- Routes: `backend/src/routes/stakeholders.ts`, `routes/contributors-overview.ts`, `routes/dependencies-overview.ts`, `routes/repos-overview.ts`

---

### EPIC-16 — Billing & Subscriptions (Stripe + Pro tier)

**Status:** Done | **Labels:** `methodology-retrospective`, `area:billing`, `verified-by:vitest`

**Description:**
Stripe-backed billing on a contributor-centric model (€6 / active contributor / month) with a 90-day free trial and an optional Pro tier (€9 / product / month + €6 / contributor / month). Includes Stripe checkout + customer portal, webhook signature verification, a global billing-gate middleware that blocks writes for unpaid accounts, an admin path to extend / exempt / pause trials, and a `requirePlan(tier)` middleware enforcing tier hierarchy (standard < pro < enterprise). Pricing is admin-configurable via `platform_settings`.

**Acceptance Criteria:**
- Tests pass: `routes/billing.test.ts`, `security/billing-gate.test.ts`, `integration/billing-gate-enforcement.test.ts`, `webhooks/stripe-webhook.test.ts`.
- E2E `e2e/acceptance/billing-and-subscription.spec.ts` passes.
- Endpoints in `routes/billing.ts`: checkout / portal / status; webhook in `routes/billing.ts` or dedicated webhook handler verifies signature.
- `org_billing` table (`org_id varchar(255)`, plan, status, copilot_token_limit, trial_extension fields) idempotent in `pool.ts initDb()`.
- Trial scheduler runs at 4 AM with grace periods.
- `requirePlan('pro')` blocks non-Pro orgs from Pro routes; verified by trust-centre and public-api tests.

**Sources:**
- Commits: `8987f8a` (Stripe baseline + trial + webhook), Pro tier introduction commit, `webhooks/stripe-webhook.test.ts` additions
- Tests: as listed
- Routes: `backend/src/routes/billing.ts`, `webhooks/stripe-webhook.test.ts`

---

### EPIC-17 — Marketplace → Trust Centre

**Status:** Done | **Labels:** `methodology-retrospective`, `area:trust`, `verified-by:vitest`

**Description:**
Started life as a public Compliance Marketplace (public browse with `computeComplianceBadges()` derived from real obligations / tech files / vuln scans / licences; company detail; in-app contact with rate-limit; org-level settings to publish), then rebranded codebase-wide in session 60 from "Marketplace" to "Trust Centre" (≈90 test name changes, file renames in backend / frontend / e2e, help-guide rename `ch7_09_marketplace.html` → `ch7_09_trust_centre.html`). The Trust Centre is now Pro-gated for the published-side; public read remains free.

**Acceptance Criteria:**
- Tests pass: `routes/trust-centre.test.ts`, `routes/trust-classification.test.ts`, `routes/feedback.test.ts` (where shared helpers live).
- E2E `e2e/acceptance/trust-centre.spec.ts` passes; the suite upgrades the org to Pro in `beforeAll` via platformAdmin token, restores in `afterAll` (mirror of public-api-v1 pattern).
- Endpoints in `routes/trust-centre.ts` (renamed from `marketplace.ts`); frontend pages `TrustCentrePage.tsx` / `TrustCentreDetailPage.tsx` / `TrustCentreSettingsPage.tsx` (renamed).
- `marketplace_profiles` table retained (rename was code-level; table rename would have been a customer-data invariant violation per CLAUDE.md rule 14).
- Contact email enforces 3/day per org + 1/org/7d rate limit; self-contact blocked.
- 10 categories supported: IoT, Industrial, Automotive, Healthcare, FinTech, Enterprise, Open Source, SaaS, Cybersecurity, Other.

**Sources:**
- Commits: `d235d5c` (initial marketplace), `62fec94` (landing + marketplace UI polish), session 60 rename commits
- Tests: `routes/trust-centre.test.ts`, `routes/trust-classification.test.ts`, `e2e/acceptance/trust-centre.spec.ts`
- Routes: `backend/src/routes/trust-centre.ts`

---

### EPIC-18 — Escrow (Forgejo Orchestrator)

**Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:**
EU-sovereign software escrow built on a self-hosted Forgejo instance (v10, port 3003) with Cloudflare-Tunnelled access at `escrow.cranis2.dev`. Seven artefact types supported (SBOM, vuln scans, licence findings, tech file PDF→MD, DoC, CVD policy, IP proof). Per-product toggles; daily scheduled deposits at 05:00; manual deposits; full deposit history. Escrow agent access uses the Forgejo collaborator API with reference codes for engagement tracking, one-time credentials banner on new agents (purple) and access notification (green) on existing agents, password reset only on first invite, and multi-product agent support across a single Forgejo account.

**Acceptance Criteria:**
- Tests pass: `routes/escrow.test.ts`.
- E2E `e2e/acceptance/escrow-management.spec.ts` passes.
- Endpoints in `routes/escrow.ts`: config / setup / deposit / deposits / status (6 endpoints).
- `escrow_configs` and `escrow_deposits` tables present.
- Product deletion fires a final `product_deleted` escrow deposit before the cascade-delete.

**Sources:**
- Commits: `f3835b2` (Forgejo orchestrator baseline), `27152d4` (escrow agent access + product deletion with data exit + accordion sidebar)
- Tests: `routes/escrow.test.ts`, `e2e/acceptance/escrow-management.spec.ts`
- Routes: `backend/src/routes/escrow.ts`

---

### EPIC-19 — Platform Admin

**Status:** Done | **Labels:** `methodology-retrospective`, `area:admin`, `verified-by:vitest`

**Description:**
A separate admin layout / router for the platform owner: dashboard with live cross-org stats, organisations + drill-down management, users with admin toggle / suspend / delete, cross-org audit log with pagination + filters, system health (CPU temperature, memory, scan performance), the vuln-DB sync UI, user-invite flow (Resend email), retention ledger, platform analytics, Copilot prompt management, and the affiliate ledger. Destructive actions live on visible danger-bordered icon-buttons with typed-confirmation modals (no kebab burial) — `9581d00`. `requirePlatformAdmin` middleware gates the entire `/admin` namespace.

**Acceptance Criteria:**
- Tests pass across all 12 admin test files (`routes/admin*.test.ts` + `security/admin-route-protection.test.ts`).
- E2E `e2e/acceptance/admin-panel.spec.ts` passes.
- `is_platform_admin`, `invited_by`, `suspended_at` columns on `users`.
- Platform-admin invariant check at startup; `/api/health` reports its existence (`2a6017f`).
- Delete button hidden for self + other platform admins; typed-confirmation matches user email / org name before submit enables (`9581d00`).

**Sources:**
- Commits: `add070c` (admin dashboard baseline), `ba2ce27` (RESTART notes), `be2ae95` (invite flow), `2a6017f` (platform-admin invariant), `9581d00` (visible danger + typed-confirmation), session 60 admin-affiliates router commits
- Tests: 12 admin test files + `security/admin-route-protection.test.ts`, `e2e/acceptance/admin-panel.spec.ts`
- Routes: `backend/src/routes/admin/*` (sub-router with `index.ts` composing 12 sub-routers)

---

### EPIC-20 — P3 — AI Copilot Suite

**Status:** Done | **Labels:** `methodology-retrospective`, `area:copilot`, `tier:p3`, `verified-by:vitest`

**Description:**
Eight AI-Copilot capabilities backed by Anthropic Claude, all gated by `requirePlan('pro')` and shielded by a token-budget / rate-limit / response-cache middleware chain: suggest, vulnerability triage, risk assessment, incident report drafter, CRA category recommender, supplier due-diligence, gap narrator, and the Copilot dashboard. Prompts are managed as data (`copilot_prompts` table, 32 prompts seeded across foundation / capability / section / obligation layers) and editable via `/admin/copilot`. The 3-layer architecture is: Quality Standard preamble (Q1-Q7) → Regulatory context (per-capability / section / obligation) → Capability prompt. Token budget is `copilot.monthly_token_limit` (default 500K) with per-org override. Response cache uses SHA-256 over context with 24h TTL.

**Acceptance Criteria:**
- Tests pass: `routes/copilot.test.ts`, `routes/admin-copilot.test.ts`, `routes/batch-triage.test.ts`, `routes/category-recommendation.test.ts`, `routes/supplier-due-diligence.test.ts`.
- E2E `e2e/acceptance/category-recommendation.spec.ts`, `supplier-due-diligence.spec.ts` pass.
- `copilot_prompts`, `copilot_usage`, `copilot_cache` tables present.
- Rate limits enforced: suggest 20/product/hr, triage 5/product/hr, risk_assessment 3/product/day, incident_report_draft 5/report/day, category_recommendation 5/product/day.
- Admin can edit any prompt at `/admin/copilot` with model + max_tokens + temperature + enabled + version controls.
- Documentation: `docs/copilot-quality-standard.md` (Q1-Q7), `docs/prompts.md` (full inventory).

**Sources:**
- Commits: feature commits #13/#15/#16/#17/#18/#19/#20/#27 (P3 phase), prompt-management Phase 1+2 commits (P7 phase)
- Tests: as listed
- Routes: `backend/src/routes/copilot.ts`, `routes/admin/copilot.ts`, `routes/category-recommendation.ts`, `routes/supplier-due-diligence.ts`

---

### EPIC-21 — P4 — External Integrations

**Status:** Done (partial — #24/#25 parked) | **Labels:** `methodology-retrospective`, `area:ops`, `tier:p4`, `verified-by:vitest`

**Description:**
External-system integrations for compliance automation: a public v1 API (#28) with API-key auth; a CI/CD gate webhook (#22) so a CI run can fail-fast on un-met CRA obligations; a Trello integration (#26) for test-result notifications; an MCP server (#14) exposing CRANIS2 data to LLM tools; an IDE assistant (#21); a GRC / OSCAL bridge (#23) for downstream GRC tooling. #24/#25 (Slack / ChatOps) explicitly parked.

**Acceptance Criteria:**
- Tests pass: `routes/public-api-v1.test.ts`, `routes/trello.test.ts`, `routes/oscal.test.ts`, `routes/grc-bridge.test.ts`, `routes/api-keys.test.ts`.
- Public API tests upgrade billing to Pro in `beforeAll` and restore in `afterAll` (standard pattern).
- `api_keys` table with HMAC fingerprint; key never stored plaintext.
- Trello board `69b076fb70d3d0cf561032b7` receives nightly test-result cards.

**Sources:**
- Commits: feature commits #28 / #22 / #26 / #14 / #21 / #23 (P4 phase)
- Tests: as listed
- Routes: `backend/src/routes/public-api-v1.ts`, `routes/trello.ts`, `routes/grc-bridge.ts`, `routes/api-keys.ts`, `services/oscal.ts`

---

### EPIC-22 — P8 — 10-Year Compliance Vault

**Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:p8`, `verified-by:vitest`

**Description:**
Long-horizon (10-year) compliance evidence retention: scheduled snapshot capture, hybrid-signed manifest, retention ledger with anti-tamper hash chaining, scheduled re-verification, an auto-extend policy for active products, a one-off funding-run script for backfilling missing snapshots, and a customer-facing retention ledger view. Built across 7 phases (A-G).

**Acceptance Criteria:**
- Tests pass: `routes/retention-ledger.test.ts`, `routes/snapshot-schedule.test.ts`, `routes/admin-retention-ledger.test.ts`.
- `compliance_snapshots`, `retention_ledger`, `snapshot_schedules` tables present.
- Anti-tamper hash chain (`previous_hash` column on `retention_ledger`) validated by the verification job.
- Auto-extend logic: snapshot scheduler extends retention if product still active at scheduled end.

**Sources:**
- Commits: P8 phase A-G commits, funding run, auto-extend
- Tests: `routes/retention-ledger.test.ts`, `routes/snapshot-schedule.test.ts`, `routes/admin-retention-ledger.test.ts`
- Routes: `backend/src/routes/compliance-snapshots.ts`, `services/snapshot-schedule.ts`, `services/retention-ledger.ts`

---

### EPIC-23 — P9 — Public Conformity Assessments

**Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `regulation:cra`, `regulation:nis2`, `tier:p9`, `verified-by:vitest`

**Description:**
Public-facing self-assessment wizards for CRA, NIS2, Importer Art. 18, and PQC readiness; an assessment landing page with social-share previews; a launch-list email subscription with verified-email gate; 12 growth funnels measured end-to-end. Verified emails are shared cross-system: the welcome site's `verified_emails` table is read together with the main-app `users.email_verified` so a main-app verified user is auto-recognised on the welcome site without re-verifying.

**Acceptance Criteria:**
- Tests pass: `routes/conformity-assessment.test.ts`.
- Welcome-site flows (CRA / NIS2 / Importer / PQC + contact + subscribe) all bypass code entry when the email is already verified.
- `/send-code` returns `{ alreadyVerified: true }`; `/verify` accepts `skipCode: true` with server-side re-validation.
- Disposable emails excluded; 90-day refresh on each code verification.

**Sources:**
- Commits: P9 phase commits, session 59 verified-emails cross-system commits
- Tests: `routes/conformity-assessment.test.ts`, welcome-site smoke tests
- Routes: `backend/src/routes/conformity-assessment.ts`, `welcome/lib/verified-emails.js`

---

### EPIC-24 — P10 — Automated Article 14 Trigger Engine

**Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `regulation:cra`, `tier:p10`, `verified-by:vitest`

**Description:**
The keystone CRA capability: ingest CISA's Known-Exploited-Vulnerabilities (KEV) catalogue + FIRST EPSS exploitation-probability feed on a schedule; enrich scanner findings with KEV / EPSS at scan time; prioritise severity from the threat-intel state; surface KEV / actively-exploited / EPSS-percentile across the findings UI; derive `cra_reports.actively_exploited` automatically from KEV / EPSS state; auto-trigger Art. 14 on actively-exploited findings against regulated products; RFC3161-attest the awareness moment so the 24-hour clock has an independently-witnessed start; expose per-product regulatory state with 24h / 72h / 14d countdown chips.

**Acceptance Criteria:**
- Tests pass: `services/cra-trigger-engine.test.ts`, `services/threat-intel.test.ts`, `services/regulatory-state.test.ts`, `services/submission-attestation.test.ts`.
- `kev_catalogue`, `epss_scores` tables present and refreshed by scheduler.
- `cra_reports.actively_exploited` boolean column auto-flagged on insert from KEV/EPSS join.
- New "Regulatory state" panel on the product detail page shows the active Art. 14 deadline track with live countdown chips.
- RFC3161 token captured on the awareness moment (auto-trigger) and on each `submit-with-authorisation` call.

**Sources:**
- Commits: `949aef2` (p10b-1 auto-trigger), `b8441c0` (p10b-2 RFC3161 awareness), `fe1ba49` (p10c regulatory-state view), `290d85f` (p10d submit-with-authorisation), `43c4600` (P10 close), session-64 P10a phase commits
- Tests: as listed
- Routes: `backend/src/services/cra-trigger-engine.ts`, `services/threat-intel.ts`, `services/regulatory-state.ts`, `services/submission-attestation.ts`

---

### EPIC-25 — Standalone Feature — Post-Market Monitoring (#46)

**Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `regulation:cra`, `tier:standalone`, `verified-by:vitest`

**Description:**
CRA Art. 14(1)(a) post-market vigilance: field-issue intake, classification (incident / non-incident), product / version correlation, status workflow, link to CRA reports. Built across 4 phases, 33 tests.

**Acceptance Criteria:**
- Tests pass: `routes/field-issues.test.ts` (33 tests).
- Endpoint surface in `routes/field-issues.ts`.
- `field_issues` table with `(org_id, product_id, status, classified_as)` tracking.

**Sources:**
- Commits: #46 phase 1-4
- Tests: `routes/field-issues.test.ts`
- Routes: `backend/src/routes/field-issues.ts`

---

### EPIC-26 — Standalone Feature — Notified Body Directory (#48)

**Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `regulation:cra`, `tier:standalone`, `verified-by:vitest`

**Description:**
Curated directory of EU CRA notified bodies, with per-product assessment-tracking workflow: choose body, log application, attach correspondence, set milestones, store assessment outcome. 4 phases, 54 tests.

**Acceptance Criteria:**
- Tests pass: `routes/notified-bodies.test.ts`, `routes/nb-assessment.test.ts` (54 tests combined).
- `notified_bodies` directory seeded from EU register; `nb_assessments` table tracks per-product applications.

**Sources:**
- Commits: #48 phase 1-4
- Tests: `routes/notified-bodies.test.ts`, `routes/nb-assessment.test.ts`
- Routes: `backend/src/routes/notified-bodies.ts`

---

### EPIC-27 — Standalone Feature — Market Surveillance Registration Art. 20 (#49)

**Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `regulation:cra`, `tier:standalone`, `verified-by:vitest`

**Description:**
Records the manufacturer's market-surveillance registration (CRA Art. 20) per Member State / Single Point of Contact: registration body + reference + contact + jurisdiction + status. 4 phases, 40 tests.

**Acceptance Criteria:**
- Tests pass: `routes/market-surveillance.test.ts`, `routes/ms-registration.test.ts` (40 tests combined).
- `market_surveillance_registrations` table per-org + per-jurisdiction.

**Sources:**
- Commits: #49 phase 1-4
- Tests: `routes/market-surveillance.test.ts`, `routes/ms-registration.test.ts`
- Routes: `backend/src/routes/market-surveillance.ts`

---

### EPIC-28 — Standalone Feature — Supply Chain Risk Assessment NIS2 Art. 21 (#51)

**Status:** Done | **Labels:** `methodology-retrospective`, `regulation:nis2`, `tier:standalone`, `verified-by:vitest`

**Description:**
NIS2 Art. 21(2)(d) supply-chain risk-management: enumerate suppliers, classify criticality, log risk treatment, store evidence. 4 phases, 8 tests.

**Acceptance Criteria:**
- Tests pass: `routes/supply-chain-risk.test.ts`.

**Sources:**
- Commits: #51 phase 1-4
- Tests: `routes/supply-chain-risk.test.ts`
- Routes: `backend/src/routes/supply-chain-risk.ts` (note: route may live under `services/` — confirm at create time)

---

### EPIC-29 — Standalone Feature — Internal Incident Lifecycle (#52)

**Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:standalone`, `verified-by:vitest`

**Description:**
Org-internal incident workflow distinct from CRA Art. 14 external reporting: detect → contain → eradicate → recover → post-mortem, with role assignments, RACI, evidence attachments, and a final timeline export. 4 phases, 33 tests.

**Acceptance Criteria:**
- Tests pass: `routes/incidents.test.ts` (33 tests).
- `incidents`, `incident_events`, `incident_responders` tables present.
- Help guide `ch6_05` ("Incident Lifecycle") rewritten with Beck map route.

**Sources:**
- Commits: #52 phase 1-4, session 58 help-guide rewrite
- Tests: `routes/incidents.test.ts`
- Routes: `backend/src/routes/incidents.ts`

---

### EPIC-30 — Standalone Feature — Cryptographic Standards & Quantum Readiness (#53)

**Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:standalone`, `verified-by:vitest`

**Description:**
Per-product cryptographic-inventory: log every cryptographic library / algorithm / use-case in the product, classify against PQC readiness (NIST PQC standards: ML-DSA, ML-KEM, SLH-DSA), flag deprecated algorithms (RSA-1024, SHA-1, DES). Admin-side library + algorithm registry editable via `/admin/crypto-inventory`. 4 phases.

**Acceptance Criteria:**
- Tests pass: `routes/crypto-inventory.test.ts`, `services/crypto-inventory.test.ts`.
- `crypto_libraries`, `crypto_algorithms`, `crypto_inventory_entries` tables present.
- Help guide `ch6_04` uses CRANIS2 itself as a real-world PQC implementation example.

**Sources:**
- Commits: #53 phase 1-4
- Tests: `routes/crypto-inventory.test.ts`, `services/crypto-inventory.test.ts`
- Routes: `backend/src/routes/crypto-inventory.ts`, `services/crypto-inventory.ts`

---

### EPIC-31 — Standalone Feature — Trusted Open Source & Non-Profit Access (#58)

**Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:standalone`, `verified-by:vitest`

**Description:**
A free-access tier for verified open-source maintainers and non-profits, with a verification workflow (GitHub org / OSS-stewardship attestation / charity-register lookup). 6 phases, 33 tests.

**Acceptance Criteria:**
- Tests pass: `routes/nonprofit-verification.test.ts` (33 tests).
- `nonprofit_verifications`, `trusted_oss_orgs` tables present.
- Admin can approve / reject / revoke a verification.

**Sources:**
- Commits: #58 phase 1-6
- Tests: `routes/nonprofit-verification.test.ts`
- Routes: `backend/src/routes/nonprofit-verification.ts`

---

### EPIC-32 — Software Evidence Engine (SEE) — 8 Phases

**Status:** Done | **Labels:** `methodology-retrospective`, `area:see`, `verified-by:vitest`

**Description:**
A consent-gated, source-code-read-only analysis pipeline that produces multi-regulation evidence reports (R&D, CRA, NIS2, AI Act, DORA, ISO 27001) from a customer's commit history and repository structure. Never stores source code; only derived analyses. 8 phases:

- **A** consent + LOC estimation + effort/cost + executive report
- **B** paginated commit-history ingestion + developer attribution (Neo4j)
- **C** branch analysis + deterministic commit classification (9 types) + rewrite ratio
- **D** experimentation detection (refactoring waves, prototype branches, rapid iteration, high rewrite, fix-after-feature) + R&D evidence report with SHA-256
- **E** architecture-evolution detection + test-evolution tracking + module inference
- **F** evidence-graph builder linking SEE to existing CRANIS2 data + provenance queries
- **G** multi-regulation reports + report-type registry + immutable storage
- **H** session-capture API (start/record/end) + competence profiling (10 domains) + Claude Code hooks config generator

**Acceptance Criteria:**
- Tests pass: `routes/see-estimator.test.ts`, `services/see-classifier.test.ts`, `services/see-estimator.test.ts`, `services/see-session.test.ts` (209 SEE tests total per session-53 close).
- Source-code consent model present; no source code is persisted (verified by code review + EXECUTIVE-SUMMARY guarantee).
- 9 commit-classification types deterministic across replays.
- `SEEModule` Neo4j nodes link to existing Product / Dependency / Contributor graph.
- Session-capture API + Claude Code hooks config generator both shipped.

**Sources:**
- Commits: SEE phase A-H commits (Session 52), session-capture rewrite commits (Session 54)
- Tests: `routes/see-estimator.test.ts`, `services/see-classifier.test.ts`, `services/see-estimator.test.ts`, `services/see-session.test.ts`
- Routes: `backend/src/routes/see-estimator.ts`, `services/see-*.ts`

---

### EPIC-33 — Help Guide System Overhaul

**Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`, `verified-by:visual`

**Description:**
Comprehensive overhaul of the 48-file in-app help guide system: a written Standard, an audit of every file, a Beck-Map design spec for visual navigation, application of the Standard to 30 real-content files, removal of all Previous/Next nav, iframe cache-busting, fixes to 20 emoji escapes, standardised Beck-map geometry (equidistant 26-px row grid across all 48 files), hover-grow accessibility effect, alternating label positions with interchange / feeder / edge rules, a CLI generator (`tools/becksmap/`), a YOU-ARE-HERE amber arrow indicator + dismissible hint banner, 5 priority guide rewrites (ch4_05 Batch Fill / ch4_06 AI Copilot / ch4_07 Risk Assessment / ch6_05 Incident Lifecycle / ch5_06 Compliance Vault), and SVG fixes on ch4_02 + ch1_03.

**Acceptance Criteria:**
- `docs/HELP-GUIDE-STANDARD.md`, `docs/HELP-GUIDE-REVIEW.md`, `docs/BECK-MAP-DESIGN-SPEC.md` exist at repo root.
- All 48 help files load with no Previous/Next navigation; iframe cache-busting query string present on each load.
- becksmap CLI at `tools/becksmap/` regenerates any guide from its JSON definition.
- YOU-ARE-HERE arrow rendered on opposite side of station label; hint banner dismissible with localStorage persistence.

**Sources:**
- Commits: Session 51 help-guide-system commits, session 54 rewrites, session 59 navigation guidance
- Files: `docs/HELP-GUIDE-STANDARD.md`, `docs/HELP-GUIDE-REVIEW.md`, `docs/BECK-MAP-DESIGN-SPEC.md`, `frontend/public/help/*`, `tools/becksmap/`

---

### EPIC-34 — Documentation Two-Audience Model

**Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`, `verified-by:visual`

**Description:**
Split all customer-facing documentation into two audiences (Admin and Contributor) with explicit tagging: a rewritten `EXECUTIVE-SUMMARY.md`, `CRANIS2-CAPABILITIES-AND-SAFEGUARDS.md` (new section 2.22 SEE, updated 4.1 source-code handling with dual guarantees, new sections 4.5 Cryptographic Security + 4.6 Infrastructure Hardening), a Contributor audience card on the welcome site, a SEE + Session Capture + source-code-guarantee callout, `USER-GUIDE.md v4.0` with audience-tagged TOC and new sections 41-43, `FAQ.md v4.0` with 3 new sections, `HELP-GUIDE-STANDARD.md v2.0` with the two-track model. Frontend supports the model: `DocsPage.tsx` has an audience filter toggle, `HelpPanelContext.tsx` dispatches a `cranis2:tab-change` event.

**Acceptance Criteria:**
- `docs/EXECUTIVE-SUMMARY.md`, `docs/CRANIS2-CAPABILITIES-AND-SAFEGUARDS.md`, `docs/USER-GUIDE.md`, `docs/FAQ.md`, `docs/HELP-GUIDE-STANDARD.md` all present and reflect v4.0 / v2.0 structure.
- Welcome site `welcome/public/index.html` carries the Contributor audience card and SEE callout.
- `DocsPage.tsx` exposes the All/Admin/Contributor filter; the audience attribute is honoured.

**Sources:**
- Commits: Session 53 documentation-overhaul commits, ai-coder-framework owner-block rewrites (in Session 63 entity-scrub work — see EPIC-42)
- Files: as listed

---

### EPIC-35 — Test Infrastructure & Hardening

**Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:operational`

**Description:**
A fully-isolated test stack with five layers of safety (separate containers, separate Postgres DB `cranis2_test`, backend startup guards in `pool.ts` and `neo4j.ts`, test-side guards in `test-helpers.ts` + `seed-test-data.ts` + `clean-rate-limits.ts`, port separation 3011 / 7699 vs live 3001 / 7688). Plus the nightly runner with Trello notifications, the ~300 new tests added in session 53 to lift route coverage from 86.8% to 98.5%, the API-client retry-on-transient-socket-error logic that eliminated flaky failures, the deterministic test IDs pattern (`e0000001-...` + `ON CONFLICT (id) DO UPDATE`), the E2E video-on-failure capture, and the test-run rate-limit bypass.

**Acceptance Criteria:**
- `scripts/test-stack.sh start/stop/run` brings the test stack up/down cleanly; verified by the user running it during every dev session.
- Test stack listens on 3011 / 7699; live stack on 3001 / 7688 — confirmed by port-binding inspection.
- 2,166+ tests pass (121 files), 0 fail, 36 skip, 1 expected infra-dependent failure (`category-recommendation` Anthropic-API).
- API-client retry logic in `backend/tests/helpers/api-client.ts` retries `UND_ERR_SOCKET` / `ECONNRESET` up to 2 times with backoff.
- Nightly `scripts/nightly-tests.sh` runs at 20:00 UTC, logs to `logs/nightly-tests-YYYY-MM-DD.log` with 14-day retention.
- Trello cards posted to board `69b076fb70d3d0cf561032b7` (Passed list `69b0770a19a08092fa674929` / Failed list `69b0770caa1a3148db3bee6d`).

**Sources:**
- Commits: Session 53 test-hardening commits, session 56 isolated-test-stack commits, session 58 E2E improvements
- Files: `scripts/test-stack.sh`, `scripts/nightly-tests.sh`, `backend/tests/setup/per-file-setup.ts`, `backend/tests/setup/global-setup.ts`, `backend/tests/helpers/*`

---

### EPIC-36 — WS1 — Database Backup & Restore

**Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:ws`, `verified-by:vitest`

**Description:**
Workstream 1 of launch readiness — full database backup / restore / verify / upgrade / patch / rollback toolchain. Postgres (cranis2 + forgejo) and Neo4j dumps; GFS retention (7 daily, 4 weekly, 3 monthly, 30-day pre-upgrade); weekly verification by spinning up temp containers + restoring + validating + tearing down; one-command upgrade pipeline; one-command security-patch pipeline with `npm audit fix` + test-verification + auto-revert; manual rollback by code / DB / both; USB-storage sync of latest backups (4-copy retention).

**Acceptance Criteria:**
- Tests pass: `integration/system-scripts.test.ts` (51 tests).
- Scripts present and runnable: `scripts/backup-databases.sh`, `restore-databases.sh`, `verify-backup.sh`, `upgrade-system.sh`, `apply-security-patch.sh`, `rollback-upgrade.sh`, `usb-storage-sync-artifacts.sh`.
- `docs/backup-and-restore.md`, `docs/upgrade-and-patching.md`, `docs/backup-retention.md` runbooks present.
- Backups land in `~/cranis2/backups/<frequency>/<timestamp>/`; pre-upgrade under `pre-upgrade/` with 30-day retention.

**Sources:**
- Commits: WS1 commits (Session 56)
- Tests: `backend/tests/integration/system-scripts.test.ts`
- Files: `scripts/backup-databases.sh`, `restore-databases.sh`, `verify-backup.sh`, `upgrade-system.sh`, `apply-security-patch.sh`, `rollback-upgrade.sh`, `usb-storage-sync-artifacts.sh`

---

### EPIC-37 — WS2 — PQC Foundation + Hybrid Signing

**Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:ws`, `verified-by:vitest`

**Description:**
Workstream 2 — post-quantum-cryptography foundations. JWT algorithm pinning (HS256 in both sign + verify, blocks alg:none / alg-confusion); HKDF-SHA256 (RFC 5869) key derivation with purpose-specific info strings for domain separation; JWT secret derived from master via HKDF, cached per process; versioned encryption (v1 legacy raw-key auto-detected and back-compat-decrypted; v2 HKDF-derived); base-image upgrade from `node:22-alpine` to `node:24-alpine` for OpenSSL 3.5+ native ML-DSA-65; hybrid signing (Ed25519 + ML-DSA-65 dual signatures, AND-logic verification); `.well-known/cranis2-signing-key-mldsa.pem` endpoint; `generate-signing-keys.sh` outputs base64 for `.env`.

**Acceptance Criteria:**
- Tests pass: `security/pqc-foundation.test.ts` (25), `security/hybrid-signing.test.ts` (23), `security/jwt-manipulation.test.ts`.
- `signDocument()` returns both Ed25519 + ML-DSA-65; `verifyHybridSignature()` is AND-logic; falls back to Ed25519-only if ML-DSA-65 key unset.
- `key-derivation.ts` module exposes HKDF helpers used by JWT + encryption.
- Encryption ciphertext format: `v2:iv:tag:ciphertext`; legacy `v1:...` still decrypts.

**Sources:**
- Commits: WS2 Part 1 + Part 2 commits (Session 56)
- Tests: `security/pqc-foundation.test.ts`, `security/hybrid-signing.test.ts`, `security/jwt-manipulation.test.ts`
- Files: `backend/src/lib/key-derivation.ts`, `services/signing.ts`, `Dockerfile`

---

### EPIC-38 — WS3 — Security Hardening + Key Rotation

**Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:ws`, `verified-by:vitest`

**Description:**
Workstream 3 — defence-in-depth hardening and a routine rotation toolchain. Database ports bound to 127.0.0.1 (Postgres, Neo4j, Forgejo); Forgejo credentials moved to `.env` and rotated; auth rate-limiting (login 5/15min, register 3/hr, verify 10/hr, invite 5/hr) with no Retry-After timing leak; CORS restricted to `FRONTEND_URL`; welcome-site default credentials removed (requireEnv); zero npm-audit vulnerabilities. Rotation scripts: `rotate-credentials.sh` (monthly DB passwords + JWT + welcome secret), `rotate-encryption-key.sh` (annual, decrypts + re-encrypts PATs on lab server), `apply-key-rotation.sh` (production deploy of rotation packages), `rotate-signing-keys.sh` (annual, new Ed25519 + ML-DSA-65, archives old public keys), `check-rotation-age.sh` (weekly cron, warns when rotation overdue).

**Acceptance Criteria:**
- Tests pass: `security/hardening.test.ts` (29), `security/key-rotation.test.ts` (41).
- Docker compose binds `127.0.0.1:5433:5432`, `127.0.0.1:7475:7474`, `127.0.0.1:7688:7687`, `127.0.0.1:3003:3000` etc.
- Rate-limit responses do NOT include Retry-After (verified by hardening.test.ts).
- Rotation scripts present + chmod +x; `docs/key-rotation.md` runbook explains HNDL context and lab-based operational model.

**Sources:**
- Commits: WS3 commits (Session 56), `20980de` (backend + welcome 127.0.0.1 bind, Session 66 prod-edit replay)
- Tests: `security/hardening.test.ts`, `security/key-rotation.test.ts`
- Files: `scripts/rotate-*.sh`, `scripts/check-rotation-age.sh`, `docs/key-rotation.md`

---

### EPIC-39 — WS4 — GDPR Compliance

**Status:** Done | **Labels:** `methodology-retrospective`, `area:gdpr`, `regulation:gdpr`, `tier:ws`, `verified-by:vitest`

**Description:**
Workstream 4 — GDPR-completeness for the product as a data processor / controller. Privacy Policy (Beta) drafted from a real data audit (all PII categories, sub-processors Stripe / Resend / Anthropic / Git providers, retention periods, data-subject rights); Terms of Service (Beta) with beta disclaimer, AI Copilot limitations, liability cap, governing law England & Wales; cookie-and-storage assessment (essential-only — JWT + help-panel width, no consent banner needed); dynamic `/docs/:slug` routing replacing hardcoded user-guide/faq; footer links on login / signup / accept-invite / landing / docs; `doc_pages` seeding (privacy-policy + terms-of-service slugs in `pool.ts` docsToSeed); data-export endpoint, account-deletion endpoint, data-retention cleanup. In session 63 both Privacy Policy and ToS were rewritten for personal ownership (data controller / operator = Andrew (Andi) MCBURNIE personally, France-resident, CNIL named lead supervisory authority, indemnity runs to Andi personally).

**Acceptance Criteria:**
- 27 GDPR tests pass (data export / account deletion / retention cleanup).
- `docs/PRIVACY-POLICY.md` and `docs/TERMS-OF-SERVICE.md` served at `/docs/privacy-policy` and `/docs/terms-of-service`.
- Footer links present on all listed pages.
- `routes/admin/data-retention.ts` exposes admin cleanup; `routes/account.ts` exposes data export + account deletion.

**Sources:**
- Commits: WS4 commits (Session 57), Session 63 personal-ownership rewrites of Privacy Policy + ToS
- Files: `docs/PRIVACY-POLICY.md`, `docs/TERMS-OF-SERVICE.md`, `backend/src/routes/admin/data-retention.ts`, `frontend/src/public/DocsPage.tsx`

---

### EPIC-40 — Affiliate Programme

**Status:** Done | **Labels:** `methodology-retrospective`, `area:billing`, `verified-by:vitest`

**Description:**
Five-phase affiliate / bonus-code system: tables (`bonus_codes`, `affiliate_ledger`, `affiliates`) + signup-flow bonus code + org-billing integration → admin affiliates page with ledger management (389-line router) → monthly statement automation (312-line service + email template) → self-service dashboard (311-line router, 392-line frontend, sidebar navigation for affiliates) → 35 Vitest tests. Session 66+ added affiliate notification on signup conversion (privacy-clean — affiliate is told *that* a conversion happened and *which* code, never *who*).

**Acceptance Criteria:**
- Tests pass: `routes/admin-affiliates.test.ts`, `routes/affiliate.test.ts`, `routes/auth-bonus-code.test.ts`, `routes/bonus-code.test.ts` (35 tests).
- Affiliate self-service dashboard at `/affiliate`; sidebar nav appears for users with `affiliates` row.
- Monthly statement email template includes ledger summary + balance + payout history.
- Affiliate-notify email subject: "Your CRANIS2 affiliate code <CODE> drove a new signup"; does NOT contain submitter email / referrer / language (`478253c`).

**Sources:**
- Commits: Session 60 affiliate-programme phase 1-5 commits, `478253c` (affiliate notify)
- Tests: as listed
- Routes: `backend/src/routes/affiliate.ts`, `routes/bonus-code.ts`, `routes/admin/affiliates.ts`

---

### EPIC-41 — Production Launch (`cranis2.com`)

**Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:operational`

**Description:**
Session-62 launch day: provisioned Infomaniak VPS; `cranis2.com` domain; host NGINX + Let's Encrypt TLS (auto-renew, systemd-timer); Docker stack deployed; `FRONTEND_URL` migrated to `https://cranis2.com`; `LOG_LEVEL=info`; `DEV_SKIP_EMAIL=false`; backend and welcome containers bound to `127.0.0.1` only — only NGINX publicly reachable; GFS backup architecture (7d / 4w / 12m on prod; encrypted age-pull mirror to dev at 03:00 UTC; age private key escrowed on user's keyring USB); affiliate schema patch applied directly to prod (logged as job #100 — back-port to dev `pool.ts initDb()`); `/welcome` URL collision fixed (SPA post-registration page renamed to `/getting-started`); CLAUDE.md operating rules 12-15 added; smoke-tested signup → email-verify → land on `/getting-started`.

**Acceptance Criteria:**
- `https://cranis2.com/api/health` returns 200 with platform-admin invariant satisfied.
- `/welcome` is no longer a route; `/getting-started` is the post-signup landing page (verified frontend + backend).
- Compose binds `127.0.0.1:3001:3001` + `127.0.0.1:3004:3004`.
- `~/cranis2/backups/` follows the 7d / 4w / 12m + 30-day pre-upgrade structure with age-mirror on dev.
- CLAUDE.md rules 12 (backup-before-prod-change), 13 (schema in `pool.ts`), 14 (customer-data invariant), 15 (sensitive-output discipline) all present.

**Sources:**
- Commits: Session 62 launch commits, `2a6017f` (platform-admin invariant + /api/health), `ede802f` (welcome → getting-started rename), `20980de` (container 127.0.0.1 bind), CLAUDE.md rule 12-15 commits
- Files: `docker-compose.yml`, `docs/backup-retention.md`, `docs/backup-and-restore.md`, `CLAUDE.md`, host nginx config (on prod)

---

### EPIC-42 — Ownership & Licensing Cleanup

**Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`, `verified-by:operational`

**Description:**
Session 63 ownership cleanup. Added `LICENSE` at repo root defining `LicenseRef-Cranis2-Proprietary` (CRANIS2 Proprietary Licence, Andrew (Andi) MCBURNIE, England & Wales governing law); `scripts/apply-licence-headers.sh` idempotent header sweep applied to 757 in-scope files (TS / TSX / JS / CSS / MD / HTML / SH / SQL / YAML / Dockerfile / gitignore variants), with JSON files carrying `license` + `author` metadata instead (8 `package.json` files); permission-preservation bug fixed mid-session and 25 scripts had 0755 restored; copyright range mechanically aligned to 2023-2026 across 752 headed files + LICENSE + sweep-script BODY; email standardised to `andi@mcburnie.com`; full entity scrub (Gibbs / Loman / Cavendish references removed from 15 files — zero matches across the repo, excluding standard exclude dirs); AI Coder Framework owner blocks rewritten; R&D Tax Relief framing stripped from `STANDARDS.md` and `SESSION-TEMPLATE.md` and reframed as IP provenance / audit / due-diligence / knowledge-transfer value; `docs/loman-cavendish-capabilities.md` → `docs/personal-capabilities.md` (renamed + rewritten in first-person); `docs/operations/99-succession.md` rewritten as a personal succession plan; Privacy Policy + ToS rewritten with personal ownership + France residence + CNIL lead supervisory authority. Evidence locker established at `evidence/` with `README.md` index; `.gitignore` keeps binaries local-only. New memory files: `project_ownership.md`, `seis_strategy.md`, `rebuild_plan.md`. Rebuild prep set up on the MBP at 10.0.0.117 (port range 4xxx reserved, Forgejo on MBP planned as primary git).

**Acceptance Criteria:**
- `LICENSE` at repo root exists with `LicenseRef-Cranis2-Proprietary` SPDX identifier.
- `grep -r "Loman\|Cavendish\|Gibbs" -- ':!node_modules' ':!evidence' --include='*'` returns zero matches (verified at session-63 close).
- `evidence/README.md` indexes Entry #1 (SNRG NIST assessment) and Entry #2 (personal-time engagement analysis); binaries gitignored.
- `apply-licence-headers.sh` is idempotent — running twice produces no diff.
- All 8 `package.json` files carry the correct `license: "LicenseRef-Cranis2-Proprietary"` + `author: "Andrew (Andi) MCBURNIE <andi@mcburnie.com>"`.

**Sources:**
- Commits: Session 63 commits (entity scrub, licence headers, evidence locker, personal-ownership rewrites), `fb39bb0` (evidence Entry #2)
- Files: `LICENSE`, `scripts/apply-licence-headers.sh`, `evidence/README.md`, `docs/personal-capabilities.md`, `docs/operations/99-succession.md`, `docs/PRIVACY-POLICY.md`, `docs/TERMS-OF-SERVICE.md`, all 757 header-bearing files

---

## Discovery Spikes

### SPIKE-01 — CRA Gap Analysis 2026-05-06

**Status:** Done | **Labels:** `methodology-retrospective`, `regulation:cra`, `verified-by:visual`

**Description:**
A 270-line post-P10 inventory of what CRANIS2 covers today vs what compliance staff at a software-engineering company actually do operationally, ranked by leverage. Output: 22 epics across T1 (high-leverage, manual today, high frequency — 7 epics), T2 (meaningful-but-periodic / specialist — 8 epics), T3 (strategic / forward-looking — 5 epics), plus a strategic 10x meta-epic ("single source of truth → many regulatory dialects") and a CRA-completeness backlog of 6 items. All 28 created in Jira project `CRAN` (CRAN-2 through CRAN-28).

**Acceptance Criteria:**
- `docs/CRA-GAP-ANALYSIS-2026-05-06.md` exists with the full ranked inventory.
- 28 tickets exist in Jira `CRAN-2` through `CRAN-28` with labels `tier:1` / `tier:2` / `tier:3` / `strategic-10x` / `cra-completeness` as appropriate.
- The 7 T1 epics are: CVD intake, customer-facing SBOM endpoint, security-questionnaire auto-answer, multi-track incident notification, substantial-modification detection, GDPR Art. 30 RoPA, sub-processor list.

**Sources:**
- Commits: `1fe685b` (persist gap analysis + 28 epics)
- Files: `docs/CRA-GAP-ANALYSIS-2026-05-06.md`, memory `gap_analysis_2026_05_06.md`
- Jira: existing CRAN-2 through CRAN-28

---

### SPIKE-02 — Two-Sided Market Refinement 2026-05-13

**Status:** Done | **Labels:** `methodology-retrospective`, `verified-by:visual`

**Description:**
Strategic refinement applied to the 2026-05-06 gap analysis. Filter 1: paying customers are companies that build software (ISV / SaaS / IoT / firmware / MSP / OSS steward / hardware-with-software) — not banks, hospitals, utilities, telcos. Filter 2: statutory regulation only (CRA / GDPR / AI Act / NIS2 where applicable / PLD recast / DORA-supplier-evidence) — not ISO 27001 / ISO 42001 / SOC 2 / EUCC / NIST CSF / cyber insurance / SIG-CAIQ. Two-sided market: out-of-scope paying customers (regulated operators) re-enter as free-read-access promoters who push CRANIS2 adoption into their software supply chain to discharge their own NIS2 Art. 21(2)(d) / DORA Art. 28 / GDPR Art. 28 supply-chain obligations. Outcome: T1 splits into Group A (closes operator loop — CRAN-3/4/5/8 are now highest priority) and Group B (supplier-internal only — CRAN-2/6/7); CRAN-4 / CRAN-9 / CRAN-10 / CRAN-13 / CRAN-20 rescoped; CRAN-21 withdrawn; CRAN-22 superseded; 3 new epic candidates proposed (Operator Supplier Dashboard, PLD recast 2024/2853 evidence, DORA Art. 28 supplier-evidence pack).

**Acceptance Criteria:**
- `docs/CRA-GAP-ANALYSIS-2026-05-06.md` carries the "Strategic frame revised — 2026-05-13" preamble with the rescope / withdrawal table.
- Memory `project_strategic_scope.md`, `project_two_sided_market.md`, `feedback_no_certification_features.md` all persisted.

**Sources:**
- Commits: `dd499a8` (apply dual filter + two-sided market)
- Files: `docs/CRA-GAP-ANALYSIS-2026-05-06.md`

---

### SPIKE-03 — Promotion-Process Design (dev → prod)

**Status:** Done (design) | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:visual`

**Description:**
Design artefact for the dev→prod promotion model: dev is the continuous workspace; prod is a gated destination; customer data is sacred (rule 14 floor restated verbatim). Per-release committed pair of files: `migrations/release-YYYY-MM-DD-<slug>.md` (assessment doc) + `.sql` (bespoke migration). The migration assessment gate (§6) is the central design. 7-step dev-side workflow + 7-step promotion runbook. Rollback path = backup-restore-and-redeploy (never reverse-migration). Quarterly rollback rehearsal noted as standing requirement.

**Status note:** design only. The machinery (`promote-to-prod.sh`, `generate-schema-diff.sh`, `migrations/` directory, `schema_migrations` table, quarterly rehearsal) is deferred to backlog items #100 and #101. This spike captures the design that #101 will implement.

**Acceptance Criteria:**
- `docs/promotion-process.md` exists at repo root with §1-§11 as scoped.
- Worked example (§9) included — a transformational release adding `cra_category_v2` column with backfill, showing both `.md` and `.sql` files.
- Implementation-status table (§10) explicitly distinguishes "in place today" from "target-state-only" so the doc is honest about what still needs building.

**Sources:**
- Commits: `cda82ea` (promotion-process documentation)
- Files: `docs/promotion-process.md`
- Backlog: `docs/scratch.md` items #100 + #101 (implementation tracked there)

---

### SPIKE-04 — Methodology Framework

**Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`, `verified-by:visual`

**Description:**
Product-agnostic methodology framework for AI-collaborative software development. The scaffold; CRANIS2's CLAUDE.md and supporting docs (RESTART, scratch, editorial-standard, promotion-process, backup-retention) instantiate it. Covers: collaboration model; the three non-negotiable invariants (customer-data, backup-before-change, schema-as-code); operating protocol (propose-first, commit-per-task, human-push, trunk-based, test cadences, high-risk approvals, editorial consistency, definition of done, no-secrets, file-growth thresholds, sensitive-output discipline); promotion process; test discipline; editorial discipline; AI/LLM usage principle; communication and memory hygiene; hard prohibitions; what well-collaborated looks like; adapting the framework; project-addendum template; CRANIS2 as the worked example.

**Acceptance Criteria:**
- `docs/methodology-prompt.md` exists at repo root.
- Document is bootstrappable: pasted into a fresh AI session, plus CLAUDE.md, it is sufficient to begin productive work without re-deriving the operating rules.
- Carries the personal-ownership copyright header.

**Sources:**
- Commits: `3641c3e` (add methodology framework)
- Files: `docs/methodology-prompt.md`

---

### SPIKE-05 — Architectural Review for Rebuild

**Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:visual`

**Description:**
End-of-session-63 architectural review of the existing codebase. Conclusion: stack is fit-for-purpose; key highest-leverage future improvements to apply on the rebuild are TanStack Query (highest-leverage — replaces 78 pages each hand-rolling `fetch + useEffect`), zod for request validation across all routes, Kysely + node-pg-migrate to replace raw `pg` calls and the 2,529-line idempotent `initDb()` pattern, graphile-worker for background jobs (replaces the 1,519-line in-process `scheduler.ts`), pino for structured logging, CI from commit 1.

**Acceptance Criteria:**
- Memory `rebuild_plan.md` carries the full plan.
- Secondary MBP target at 10.0.0.117 set up (16 GB, Ubuntu 24.04, Docker 29.4); SSH alias `mbp` configured with passphrase-less LAN-only key.
- Port range 4xxx reserved on MBP (avoids existing cranis-stack 3000/5678 and CRANIS2 dev 3001-3004).

**Sources:**
- Commits: Session 63 architectural-review work (no single commit — the review output lives in memory)
- Files: memory `rebuild_plan.md`

---


---

## Stories — grouped by epic

Each story is a substantive deliverable with its own description, acceptance criteria and evidence. Use the `Under:` field as the Epic Link target when bulk-creating in Jira.

---

### Stories under EPIC-01 — Platform Foundation & Stack

#### STORY-01.1 — Initial static HTML prototype
**Under:** EPIC-01 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`

**Description:** Before any framework code, a hand-built static HTML prototype was committed to make the design system + page layouts visible. Acted as the visual contract the Vite/React migration was held to.

**Acceptance Criteria:**
- A `prototype/` (or equivalent) tree containing static HTML pages exists in commit `fc72fd4`.
- The visual design system (colour tokens, sidebar layout, page chrome) carried forward into the React scaffold.

**Sources:** Commit `fc72fd4` (2026-02-20 06:14).

---

#### STORY-01.2 — Vite + React + Docker compose scaffold
**Under:** EPIC-01 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`

**Description:** First-cut React app with Vite + TypeScript, mobile-first responsive design, React Router v6 with public + authenticated layouts, sidebar nav with lucide-react icons, all 15 app pages stubbed with routing, plus Docker Compose with NGINX (3002), Postgres 16 (5433), Neo4j 5 (7475). NGINX serves the React build with SPA fallback. CSS custom properties ported from HTML prototypes.

**Acceptance Criteria:**
- `docker compose up -d` brings up frontend (3002) / Postgres (5433) / Neo4j (7475) from `docker-compose.yml`.
- React Router v6 public layout (landing, login, signup) + AuthenticatedLayout in `frontend/src/router.tsx`.
- Sidebar uses lucide-react icons; CSS custom properties for theme tokens.
- NGINX `default.conf` proxies and falls back to `index.html` for SPA routes.

**Sources:** Commit `ab2fe28` (2026-02-20 07:39).

---

#### STORY-01.3 — RESTART.md session-continuity protocol
**Under:** EPIC-01 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** Single-document context anchor — read at the start of every new AI session to restore project state without re-deriving it from scratch. Covers server access, Docker setup, tech stack, project structure, routes, design system, workflow rules, and current status. Updated session-by-session.

**Acceptance Criteria:**
- `RESTART.md` exists at repo root and is referenced as the first read in `CLAUDE.md`.
- File survives every session — updated at session close.
- Includes architecture notes, port map, env vars, current status section.

**Sources:** Commit `37ee0bf` (2026-02-20 07:46).

---

#### STORY-01.4 — NGINX no-escape-on-dollar-vars rule
**Under:** EPIC-01 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`

**Description:** First live bug post-scaffold: `\$uri` / `\$host` escaping in `nginx/default.conf` caused an internal redirect loop and 500s. Fixed and the lesson captured in `CLAUDE.md`'s NGINX Notes section so it cannot recur.

**Acceptance Criteria:**
- `nginx/default.conf` uses unescaped `$uri`, `$host`, etc.
- `CLAUDE.md` "NGINX Notes" section explicitly forbids the escape pattern.

**Sources:** Commit `e6d851a` (2026-02-20 13:29).

---

### Stories under EPIC-02 — Identity, Auth & Session Model

#### STORY-02.1 — Email/password signup with strength meter
**Under:** EPIC-02 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:auth`, `verified-by:vitest`

**Description:** Signup with email + password (primary), GitHub stub (secondary), live password-strength meter (5 checks: length / upper / lower / number / special), colour-graded strength bar, and confirm-password match feedback. Submit disabled until strong + confirmed.

**Acceptance Criteria:**
- `SignupPage.tsx` renders the 5-check strength meter.
- Submit button disabled state derived from strength + match.
- `routes/auth.test.ts` covers register-happy / weak-password / mismatch.

**Sources:** Commit `eb0385f` (2026-02-20 08:03).

---

#### STORY-02.2 — Resend email-verification flow
**Under:** EPIC-02 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:auth`, `verified-by:vitest`

**Description:** Stand up the Express backend (port 3001) with `POST /api/auth/register` (Postgres user insert + Resend verification email) and `GET /api/auth/verify-email` (token verify → JWT issue → redirect to welcome). Multi-stage Docker build for backend.

**Acceptance Criteria:**
- `routes/auth.test.ts` covers register → token → verify → JWT happy path.
- `users` table has `email_verified` + token columns; bcrypt password hashing.
- Resend sends from `info@cranis2.com` (configurable via `EMAIL_FROM`).
- NGINX proxies `/api/` to backend.

**Sources:** Commit `40f4427` (2026-02-20 08:26).

---

#### STORY-02.3 — Login API + JWT + AuthContext + dev-mode bypass
**Under:** EPIC-02 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:auth`, `verified-by:vitest`

**Description:** `POST /api/auth/login` (bcrypt verify, JWT issue), `GET /api/auth/me` (session validation), React `AuthContext` with login / logout / session JWT, `AuthenticatedLayout` redirect to `/login` for unauthenticated, `DEV_SKIP_EMAIL=true` auto-verify path for dev testing.

**Acceptance Criteria:**
- `routes/auth.test.ts` login + me tests pass.
- `AuthContext` exposes user + login() + logout() + checkSession().
- `AuthenticatedLayout` redirect verified via E2E `e2e/smoke/login-and-dashboard.spec.ts`.
- `DEV_SKIP_EMAIL` env-flagged in dev; verified false in prod via launch-blocker check.

**Sources:** Commit `2d61fb5` (2026-02-20 13:21).

---

#### STORY-02.4 — Passive telemetry layer for auth events
**Under:** EPIC-02 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:auth`, `verified-by:vitest`

**Description:** Zero-friction passive capture on every auth event: IP + user-agent + accept-language + browser language + timezone + referrer. `preferred_language` derived to `users.preferred_language` for future i18n. `user_events` table is the structured audit trail; Neo4j graph carries User / Event / EmailDomain / IPAddress / Device / Language nodes with `PERFORMED` / `HAS_EMAIL_DOMAIN` / `SEEN_FROM` / `USES` / `PREFERS_LANGUAGE` edges. Failed login attempts tracked. Org creation events recorded.

**Acceptance Criteria:**
- `user_events` table populates on register / login / failure / verify / org-creation.
- Neo4j Cypher query verifies graph edges exist for a sample user.
- `routes/audit-log.test.ts` covers cross-event-type listing.

**Sources:** Commit `d17de3f` (2026-02-20 14:46).

---

#### STORY-02.5 — Login race-condition fix (`await checkSession` before navigate)
**Under:** EPIC-02 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:auth`

**Description:** `login()` was fire-and-forget, so `navigate('/dashboard')` happened before `/api/auth/me` returned the user's orgId — `AuthenticatedLayout` then saw `orgId=null` and (incorrectly) redirected to `/setup/org`. Fix: make `login()` async, await `checkSession()` before returning.

**Acceptance Criteria:**
- `LoginPage` awaits `login()` before `navigate()`.
- `OrgSetupPage` calls `refreshUser()` after org creation before `navigate()`.

**Sources:** Commit `ffa0ec1` (2026-02-20 14:50).

---

#### STORY-02.6 — Logout button + dynamic org name in sidebar
**Under:** EPIC-02 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:auth`

**Description:** Sign-Out button at sidebar foot with email display; sidebar fetches real org name from `/api/org` (was hardcoded "Acme Software Ltd"); flex-column sidebar so footer sticks to bottom.

**Acceptance Criteria:**
- Sidebar renders the live org name from `/api/org`.
- Logout clears session JWT + redirects to landing.

**Sources:** Commit `02f097a` (2026-02-20 14:56).

---

#### STORY-02.7 — User invite flow with Resend email
**Under:** EPIC-02 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:auth`, `verified-by:vitest`

**Description:** Platform admins invite new users from `/admin/users`. Invite creates a user record, sends a set-password email via Resend, and optionally pre-assigns an organisation. Re-invite supported for unaccepted invitations. Invited users set their password on `/accept-invite`, are auto-verified, and linked to their org in Neo4j.

**Acceptance Criteria:**
- `routes/auth.test.ts` (or `admin-users.test.ts`) covers invite-create / invite-resend / accept-invite flows.
- `AcceptInvitePage` accepts the invite token and lands on `/getting-started` (formerly `/welcome`).
- `users.invited_by` column populated.

**Sources:** Commit `be2ae95` (2026-02-22 13:26).

---

#### STORY-02.8 — CRAN-29 self-service password recovery
**Under:** EPIC-02 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:auth`, `verified-by:vitest`

**Description:** `/forgot-password` → email (60-min one-time hash-stored token) → `/reset-password?token=` → reset → invalidate all existing sessions via the `sessions_invalidated_before` watermark. SHA-256 token hash; enumeration-defensive responses; 3/hr/IP issuance rate-limit, 10/hr/IP confirmation rate-limit.

**Acceptance Criteria:**
- 12 tests pass in `routes/password-reset.test.ts` (issuance happy/unknown/malformed/audit; confirm happy/replay/expiry/forged/weak/watermark/missing-fields).
- `password_reset_tokens` and `auth_security_events` tables present in `pool.ts initDb()`.
- `getTokenIssuedAt()` helper extracts JWT `iat` for watermark comparison.
- Existing `CRAN-29` Jira ticket should be flipped from `To Do` to `Done` as part of housekeeping.

**Sources:** Commit `f8c4ee3` (2026-05-07 02:36).

---

#### STORY-02.9 — CRAN-30 account profile + password + email change
**Under:** EPIC-02 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:auth`, `verified-by:vitest`

**Description:** `/account` page with Profile + Security tabs. Profile: display name + preferred language (9 EU languages). Security: change password (current + new + confirm, invalidates all other sessions on success); change email (24h verification token to new address; account stays on current email until confirmation). Rate-limit categories: profile 20/hr, password 5/hr, email 3/hr. Audit-log entries via `auth_security_events`. Reuses the watermark from CRAN-29.

**Acceptance Criteria:**
- 16 tests pass in `routes/account-settings.test.ts`.
- 5 endpoints on `routes/account.ts`: `GET /api/account`, `PUT /api/account/profile`, `PUT /api/account/password`, `PUT /api/account/email`, `POST /api/account/email/confirm`.
- Password-strength rules displayed live as 5 ticks (parity with reset flow).
- Existing `CRAN-30` Jira ticket should be flipped from `To Do` to `Done` as part of housekeeping.

**Sources:** Commit `ca4bbdf` (2026-05-07 02:44).

---

#### STORY-02.10 — Locale-code normalisation + auto-verify on password reset
**Under:** EPIC-02 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:auth`, `verified-by:vitest`

**Description:** Two post-deploy fixes. (1) Accept locale-style codes (`en-GB`) on `PUT /api/account/profile` — split on `-`, validate base against supported set, persist base only. (2) Successful password reset auto-verifies the email (sets `email_verified=TRUE` in the same transaction as `password_hash`) so a user who never clicked the original verification link but resets their password isn't locked out.

**Acceptance Criteria:**
- 2 new tests in `routes/account-settings.test.ts` (locale `en-GB` → `en`; unsupported base rejection).
- 1 new test in `routes/password-reset.test.ts` (unverified user reset → can log in immediately).
- Enumeration defence preserved on `/password-reset-request`.

**Sources:** Commit `8910d22` (2026-05-07 06:51).

---

#### STORY-02.11 — Admin signup notification (info@cranis2.com)
**Under:** EPIC-02 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:auth`, `verified-by:vitest`

**Description:** Resend-backed email to `info@cranis2.com` (configurable via `ADMIN_NOTIFY_EMAIL`) on every new signup. Body table shows email + signup timestamp UTC + preferred language + source referrer + bonus code (with affiliate's `display_name` + `contact_email` resolved). Fire-and-forget after `sendVerificationEmail`, `.catch()`-wrapped so Resend outage cannot break signup. Skipped in `DEV_SKIP_EMAIL=true`.

**Acceptance Criteria:**
- 54/54 auth + account + bonus-code regression tests pass after change.
- `services/email.ts` exposes `sendNewSignupNotification()`.
- Skipped in test stack (verified via test fixture creating hundreds of users without emails to `info@cranis2.com`).

**Sources:** Commit `a9746b3` (2026-05-07 07:16).

---

#### STORY-02.12 — Affiliate signup notification (privacy-clean)
**Under:** EPIC-02 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:auth`, `area:billing`, `verified-by:vitest`

**Description:** Resend email to the affiliate when their bonus code drove a signup. Subject `"Your CRANIS2 affiliate code <CODE> drove a new signup"`. Privacy boundary: the affiliate is told *that* a conversion happened and *which* code, never *who* — no submitter email / referrer / language is forwarded. Conversions tracked via `users.canonicalBonusCode`.

**Acceptance Criteria:**
- 22/22 auth + bonus-code regression tests pass after change.
- `sendAffiliateSignupNotification()` exists in `services/email.ts`.
- Email body audited for absence of new-user PII.

**Sources:** Commit `478253c` (2026-05-07 08:02).

---

#### STORY-02.13 — Pre-OAuth reassurance modal
**Under:** EPIC-02 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:auth`

**Description:** `ConnectProviderModal` intercepts the connect click before redirecting to a third-party OAuth consent screen. Explains what the user will see on the provider's consent screen, lists each scope requested with a plain-English rationale, makes the read-only intent explicit ("CRANIS2 will never commit, push, branch, tag, open issues or pull requests, or modify code or settings"), surfaces where to revoke later. Provider-specific copy for `github` / `codeberg` / `bitbucket`.

**Acceptance Criteria:**
- `ConnectProviderModal` component renders for each provider with provider-specific copy.
- Connect click path: button → modal → user confirm → redirect to provider.

**Sources:** Commit `ec8e004` (2026-05-18 09:52, modal component is one of three concerns in this commit).

---

#### STORY-02.14 — OAuth callback bare-route fix (Express 5 path-to-regexp)
**Under:** EPIC-02 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:auth`, `verified-by:vitest`

**Description:** `router.get('/callback/{:provider}', ...)` in Express 5 path-to-regexp v8 treated bare `/callback` (legacy GitHub redirect URI) as a 404 — only `/callback/<provider>` and `/callback/` matched. Fix: move the leading slash inside the optional group → `/callback{/:provider}`. Now both legacy and per-provider URL forms match the same handler.

**Acceptance Criteria:**
- 4 new tests in `routes/repo-connections.test.ts` under "oauth callback route shape" assert non-404 on each URL form.
- `routes/repo-connections.test.ts` total: 46 (was 42).

**Sources:** Commit `75a957b` (2026-05-18 11:33).

---

#### STORY-02.15 — OAuth popup auto-close fix (COOP severance)
**Under:** EPIC-02 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:auth`

**Description:** After successful OAuth handshake, the popup showed "GitHub Connected" but did not auto-close. Root cause: the close call sat inside `if (window.opener)`, and Chrome's Cross-Origin-Opener-Policy can sever the opener reference across the cross-origin hop through github.com — silently no-op-ing the whole block including `setTimeout(window.close, 1500)`. Fix: unconditional `window.close()` on success; "Close now" manual escape button; `postMessage` + `window.close` wrapped in try/catch.

**Acceptance Criteria:**
- Popup closes automatically in the common case (verified on dev manually).
- "Close now" button visible if auto-close blocked.

**Sources:** Commit `2033636` (2026-05-18 11:40).

---

#### STORY-02.16 — Dev-only account nuke (later removed pre-launch)
**Under:** EPIC-02 | **Status:** Won't Do (removed before production) | **Labels:** `methodology-retrospective`, `area:auth`

**Description:** Click email in sidebar → confirmation modal → deletes user + events + organisation from both Postgres and Neo4j. WARNING in commit explicitly flagged: "`backend/src/routes/dev.ts` and its import in `index.ts` MUST be removed before production deployment." Removed pre-launch per launch-blocker checklist.

**Acceptance Criteria:**
- `grep -r "/api/dev" backend/src` returns no matches at HEAD.
- Launch blocker #2 (remove `/api/dev/*` routes) marked DONE.

**Sources:** Commits `19480f1` (add, 2026-02-20), removal commit in pre-launch tidy.

---

### Stories under EPIC-03 — Organisation & Multi-Tenant Model

#### STORY-03.1 — Org setup wizard + Neo4j integration
**Under:** EPIC-03 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Connect backend to Neo4j; introduce Organisation / Product / Dependency / Vulnerability node types. Post-signup org-setup wizard: name + country + company size + CRA role + industry. `POST /api/org` and `GET /api/org` endpoints. Store Organisation as Neo4j node, link user via `org_id` in Postgres. Redirect authenticated users without an org to `/setup/org`. `users.org_id` + `users.org_role` columns. `/api/auth/me` returns org info.

**Acceptance Criteria:**
- `routes/org.test.ts` covers org-create + org-read.
- `e2e/acceptance/organisation-management.spec.ts` covers the redirect-to-setup path.
- Postgres `users.org_id` populated; Neo4j Organisation node + `ADMIN_OF` edge created.

**Sources:** Commit `bac8ad5` (2026-02-20 14:23).

---

#### STORY-03.2 — Organisation page with live data + members
**Under:** EPIC-03 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Three-card org page: Details (name / country / size / CRA role / industry / org ID), CRA Compliance Status (classification / SME exemptions / applicable articles / product + obligation counts placeholder), Members table (email / role / preferred language / join date). `GET /api/org/members` endpoint. Responsive: single column on mobile, hides language column on small screens.

**Acceptance Criteria:**
- `OrganisationPage` renders the three cards with live data (verified manually + via E2E).
- `routes/org.test.ts` covers `GET /api/org/members`.

**Sources:** Commit `0c7bc1e` (2026-02-20 15:25).

---

#### STORY-03.3 — Cross-org data-isolation guarantee
**Under:** EPIC-03 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Every authenticated route resolves `org_id` from the JWT and scopes every query to that org. Integration test exercises the guarantee end-to-end: a row from org A's tenant never appears in a response served to org B's authenticated user.

**Acceptance Criteria:**
- `integration/cross-org-data-isolation.test.ts` passes.
- `security/cross-org-access.test.ts` covers attempted privilege-escalation paths.

**Sources:** `routes/auth.ts` JWT payload includes `org_id`; org scoping is the established pattern across `routes/*.ts`. Tests `integration/cross-org-data-isolation.test.ts`, `security/cross-org-access.test.ts`.

---

### Stories under EPIC-04 — Product Lifecycle

#### STORY-04.1 — Products CRUD + detail page
**Under:** EPIC-04 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:playwright`

**Description:** Products API (Neo4j): list / create / read / update / delete with telemetry events. `ProductsPage` with card grid + add modal + delete. `ProductDetailPage` with edit-in-place, tabbed layout (Overview / Obligations / Technical File / Risk Findings / Dependencies), CRA classification info, compliance progress, next-steps section.

**Acceptance Criteria:**
- `routes/products.test.ts` covers all 5 CRUD verbs.
- `e2e/acceptance/product-crud.spec.ts` passes against the live stack.
- `e2e/smoke/create-product-flow.spec.ts` passes.

**Sources:** Commit `ac719b4` (2026-02-20 16:22).

---

#### STORY-04.2 — Repository URL field on products
**Under:** EPIC-04 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`

**Description:** First-class `repoUrl` on Product nodes in Neo4j; included in all CRUD endpoints. Frontend: repo-URL field in add modal with helper text; green repo badge on cards; clickable repo link in detail header + details card; editable inline.

**Acceptance Criteria:**
- `Product.repoUrl` returned by `GET /api/products/:id`.
- Repo badge visible on product card list.

**Sources:** Commit `50bd2cf` (2026-02-20 16:47).

---

#### STORY-04.3 — Product deletion with full data exit
**Under:** EPIC-04 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Deletion modal offers ZIP export of all product data (SBOM, vulns, licences, IP proof, CRA docs) and a final `product_deleted` escrow deposit, then cascade-cleans 15 Postgres tables in FK-safe order. Forgejo repo preserved as permanent archive. Repo URL gating: products can be created without a repo URL; escrow setup gated with friendly message; delete/export handles products with or without repos.

**Acceptance Criteria:**
- `integration/product-lifecycle.test.ts` covers create → delete + ZIP + escrow + cascade.
- 15 Postgres tables cleaned in FK-safe order — list captured in commit `27152d4`.
- Forgejo archive remains after Product node deletion.

**Sources:** Commit `27152d4` (2026-02-26 14:28).

---

#### STORY-04.4 — Two-tier tab navigation on product detail
**Under:** EPIC-04 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`

**Description:** Five groups on `ProductDetailPage`: Overview / Supply Chain / Compliance / Security / Evidence. `?tab=` query param for deep-linking from overview pages. Custom event `cranis2:tab-change` dispatched after `replaceState` so the help panel re-routes correctly.

**Acceptance Criteria:**
- Five tab groups visible on `ProductDetailPage`.
- Deep link `/products/<id>?tab=compliance` lands on the Compliance group.
- `HelpPanelContext` listens for `cranis2:tab-change` and re-routes.

**Sources:** Session 52 product-detail two-tier refactor commits.

---

#### STORY-04.5 — Repository URL scheme normalisation
**Under:** EPIC-04 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`

**Description:** Render-time defensive fix for schemeless repo URLs: `ensureHttpScheme()` helper prefixes `https://` when neither `http://` nor `https://` is present. Applied at the two render sites taking `product.repoUrl` as an href (header badge + OverviewTab row). Display string (visible `github.com/foo/bar`) unchanged.

**Acceptance Criteria:**
- `ensureHttpScheme()` exported from `product-detail/shared.ts`.
- Schemeless input renders an `https://`-prefixed `href`.

**Sources:** Commit `f37b00b` (2026-05-18 12:09).

---

### Stories under EPIC-05 — Repository Integration & SBOM Capture

#### STORY-05.1 — GitHub OAuth (read-only) with encrypted token storage
**Under:** EPIC-05 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:sbom`, `verified-by:vitest`

**Description:** Admin connects GitHub via OAuth. Access token AES-256 encrypted before persisting to Postgres. Sync pulls repo metadata + contributors + languages via GitHub API (GET-only — strictly read-only). Data stored as `GitHubRepo` + `Contributor` nodes in Neo4j. Product detail page shows Connect button, repo stats card (stars / forks / issues / visibility), contributor grid with avatars, language breakdown bar chart. Auto-syncs after initial OAuth connection.

**Acceptance Criteria:**
- `routes/repo-connections.test.ts` covers connect + status + disconnect.
- Token stored encrypted (verified by inspecting `repo_connections.access_token` column — should be ciphertext).

**Sources:** Commit `532ed27` (2026-02-20 17:17).

---

#### STORY-05.2 — GitHub OAuth popup with single-use connection tokens
**Under:** EPIC-05 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:sbom`, `verified-by:vitest`

**Description:** Replace broken same-window redirect with a popup window. `POST /api/github/connect-init` issues a single-use connection token instead of passing JWTs as URL params. Popup auto-closes on success and notifies parent via `postMessage`.

**Acceptance Criteria:**
- `POST /api/github/connect-init` returns a one-time token.
- Popup posts `cranis2:repo-connected` back to opener via `postMessage`.

**Sources:** Commit `80fb0ce` (2026-02-21 06:09).

---

#### STORY-05.3 — Initial SBOM capture via GitHub Dependency Graph API
**Under:** EPIC-05 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:sbom`, `verified-by:vitest`

**Description:** GitHub Dependency Graph API integration; SBOM ingested + stored in Postgres `product_sboms.spdx_json` (the column is named `spdx_json`, not `sbom_json`) + represented in Neo4j as Dependency nodes; ecosystem badges on the dependency tree. Scheduler runs daily auto-sync at 2 AM for stale SBOMs. Stale UI: sync button pulse animation when update available.

**Acceptance Criteria:**
- `routes/sbom-export.test.ts` exercises a known SBOM fixture.
- `product_sboms.spdx_json` populated for connected products.
- Scheduler daily 2 AM job present (verified by `scheduler.ts`).

**Sources:** Commit `ceddd7c` (2026-02-21 10:46, bundled with Tech File + versioning + webhooks + Cloudflare Tunnel — only the SBOM concern relates to this story).

---

#### STORY-05.4 — CycloneDX 1.6 + SPDX 2.3 export with hash enrichment
**Under:** EPIC-05 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:sbom`, `verified-by:vitest`

**Description:** Add manufacturer metadata (website / email / phone / address) on the org profile; hash-enrichment service fetches SHA-512 from npm and SHA-256 from PyPI; CycloneDX 1.6 export includes manufacturer + hashes + dependency tree; SPDX 2.3 export enriched with checksums and CRANIS2 creator info; export-status endpoint exposes enrichment progress; SBOM tab gains export dropdown + hash-warning badge. Fire-and-forget hash enrichment integrated into sync + scheduler.

**Acceptance Criteria:**
- CycloneDX 1.6 output validates against the official schema (verified in `routes/sbom-export.test.ts`).
- SPDX 2.3 output includes `algorithm: SHA512` for npm and `SHA256` for PyPI.

**Sources:** Commit `1cf07d9` (2026-02-24 05:30).

---

#### STORY-05.5 — SBOM compliance gap detection + lockfile resolver
**Under:** EPIC-05 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:sbom`, `verified-by:vitest`

**Description:** Categorise hash-enrichment failures into `no_version` / `unsupported_ecosystem` / `not_found` / `fetch_error` / `pending` and store `hashGapReason` on Neo4j Dependency nodes. New `lockfile-resolver` service fetches `package-lock.json` from GitHub to resolve version gaps before hash enrichment. Compliance-gap notification routed to security_contact + compliance_officer with debounce. Categorised breakdown surfaced in export-status endpoint and frontend info panel.

**Acceptance Criteria:**
- `routes/compliance-gaps.test.ts` covers categorisation.
- `Dependency.hashGapReason` populated for un-resolvable deps.
- Frontend info panel renders the categorised breakdown.

**Sources:** Commits `f11bc40` (2026-02-24 06:55), `0302d55` (2026-02-24 07:36, gap detection fix to query Neo4j directly).

---

#### STORY-05.6 — Modular universal SBOM generation (5 providers, 28 lockfile parsers, 26 languages, 3-tier fallback)
**Under:** EPIC-05 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:sbom`, `verified-by:vitest`

**Description:** Phase 1 — provider registry (GitHub, Codeberg, Gitea, Forgejo, GitLab) with frontend dropdown + self-hosted instance-URL support + DB persistence. Phase 2 — 28 lockfile / manifest parsers covering all major ecosystems including C++ (Conan / vcpkg), Erlang, Haskell, R, Julia, Nix, Dockerfile. Phase 3 — 26 language detection plugins with content-based scoring (Python through Assembly, Fortran, COBOL, Ada — industries with zero existing CRA tooling). Phase 4 — Import scanner with memory guards (500 files, 1MB/file, 50MB total, 120s timeout) producing SPDX 2.3. Phase 5 — Three-tier fallback wired into sync + SBOM refresh + scheduler.

**Acceptance Criteria:**
- 713 unit tests pass (236 lockfile + 416 language + 61 SBOM mock).
- `services/lockfile-parsers.test.ts` covers all 28 parsers.
- `integration/tier3-import-scanning.test.ts` covers 24 E2E tests against 4 Forgejo repos.
- Each provider in `PROVIDER_REGISTRY` exposes the 16 standard dispatcher functions.

**Sources:** Commit `7d4a2dd` (2026-02-27 07:27).

---

#### STORY-05.7 — PAT-based auth for self-hosted providers (Gitea / Forgejo / GitLab)
**Under:** EPIC-05 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:sbom`, `verified-by:vitest`

**Description:** `POST /api/repo/connect-pat` accepts PAT connections to self-hosted Git instances. `RepoProvider` type + all dispatcher functions extended to support 5 providers. Scheduler and lockfile generator pass `instanceUrl` through to all sync ops. `ProviderConnections` panel with inline PAT form on ReposPage.

**Acceptance Criteria:**
- 25 PAT auth tests pass in `routes/repo-connections.test.ts` (validation + Forgejo integration + provider-type acceptance + upsert + legacy-path back-compat).
- 24 Tier-3 import-scanning E2E tests pass.

**Sources:** Commits `8974cbe` (2026-02-28 06:13), `0eb49cd` (PAT tests), `09d16d3` (Tier 3 E2E tests).

---

#### STORY-05.8 — Bitbucket Cloud integration (6th provider)
**Under:** EPIC-05 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:sbom`, `verified-by:vitest`

**Description:** New `backend/src/services/bitbucket.ts` — full API client (OAuth 2.0, repo metadata, contributors from commits, languages, tags, raw file content, webhooks, recursive file tree). 6th supported repo provider added to `RepoProvider` type, `PROVIDER_REGISTRY`, all 16 dispatcher functions. OAuth flow: redirect to `bitbucket.org/site/oauth2/authorize`, callback with Basic auth token exchange. Webhook handling: `X-Event-Key: repo:push` (no HMAC) — verified by checking repo tracked in Neo4j. Frontend: `bitbucket.org` detection on ProductDetailPage + ReposPage, filter tab with count badge. No SBOM API — uses lockfile/import scan fallback.

**Acceptance Criteria:**
- 6 providers visible in `PROVIDER_REGISTRY`.
- E2E `repo-connection.spec.ts` updated to assert "6 supported providers".

**Sources:** Session 59 Bitbucket commits.

---

#### STORY-05.9 — Org-scoped repo connections + admin gating
**Under:** EPIC-05 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:sbom`, `verified-by:vitest`

**Description:** `repo_connections.user_id` renamed to `connected_by_user_id` (audit-only); `org_id` added, backfilled from `users.org_id`; old unique constraint replaced with two partial unique indexes split by `instance_url` nullability (cloud vs self-hosted). Same-org duplicates collapsed during migration via most-recent-wins. `requireOrgAdmin` middleware: `connect-init`, `connect-pat`, `disconnect/:provider` all require `org_role='admin'`. Members keep read-only visibility + sync rights. Helpers renamed: `getUserRepoToken` → `getOrgRepoToken`, etc. Webhook cleanup walks Organisation → Product → Repository.

**Acceptance Criteria:**
- 4 new org-scope tests (Forgejo PAT path) + 3 Bitbucket admin-gating-parity tests in `routes/repo-connections.test.ts`.
- Full regression after: 2338 pass, 13 skipped, 0 fail (per commit `ec8e004`).
- Frontend ReposPage retitled "Organisation Provider Connections"; PAT form + disconnect hidden for non-admins.

**Sources:** Commit `ec8e004` (2026-05-18 09:52, the org-scope concern of this commit).

---

### Stories under EPIC-06 — Local Vulnerability Database & Scanning

#### STORY-06.1 — Cross-product overview pages baseline + multi-source vuln scanning
**Under:** EPIC-06 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:vuln`, `verified-by:vitest`

**Description:** Initial vuln-scanning capability: Repos / Contributors / Dependencies / Risk Findings cross-product overview pages, multi-source vulnerability scanning (OSV.dev + GitHub Advisory + NVD), mitigation guidance, scan-performance tracking, dashboard risk card.

**Acceptance Criteria:**
- Cross-product overview pages render (verified by `routes/repos-overview.test.ts`, `contributors-overview.test.ts`, `dependencies-overview.test.ts`, `risk-findings.test.ts`).
- Multi-source scan hits OSV + GHSA + NVD endpoints.

**Sources:** Commit `fadff46` (2026-02-22 10:33).

---

#### STORY-06.2 — Notifications + platform-wide vuln scanning
**Under:** EPIC-06 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:vuln`, `verified-by:vitest`

**Description:** Platform-wide deduplicated SBOM scanning across all products via OSV + GitHub Advisory + NVD. `runPlatformScan()` attributes findings to all affected products and sends targeted notifications to stakeholders (security contacts, compliance officers) + platform admins. Admin vuln-scan page (manual trigger, per-product breakdown, scan history). Scheduler updated with daily 3 AM vulnerability scan (after 2 AM SBOM sync). `platform_scan_runs` table with per-source timing + aggregate metrics.

**Acceptance Criteria:**
- `routes/admin-vuln-scan.test.ts` covers the admin trigger + history endpoints.
- `routes/notifications.test.ts` covers stakeholder notification routing.

**Sources:** Commit `e553f1e` (2026-02-22 15:42).

---

#### STORY-06.3 — Local vulnerability database (Postgres CVE/CPE)
**Under:** EPIC-06 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:vuln`, `verified-by:vitest`

**Description:** Replace external-API scanning with a local Postgres advisory DB (263K GHSA + 182K NVD CVEs). Scan time: ~6 minutes → ~0.25s. NVD matching uses a flattened CPE index (B-tree indexes) — eliminates false positives from keyword search. Severity normalisation handles GitHub `moderate` ↔ standard `medium`. `GENERIC_CPE_NAMES` blocklist prevents scoped npm short-name false positives. `vuln-db-sync.ts` rebuilds the CPE index after NVD sync. New admin page `/admin/vuln-db`.

**Acceptance Criteria:**
- `routes/vulnerability-scan.test.ts` exercises the local-DB path.
- `vuln_db_advisories`, `vuln_db_nvd`, `vuln_db_nvd_cpe_index`, `vuln_db_sync_status` tables present in `pool.ts initDb()`.
- Admin `/admin/vuln-db` page (ecosystem stats + sync controls) live.

**Sources:** Commits `4494ffb` (2026-02-23 12:40), `ba591b1` (RESTART notes).

---

#### STORY-06.4 — Risk findings UI + per-product scan with 409 guard
**Under:** EPIC-06 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:vuln`, `verified-by:vitest`

**Description:** Risk findings page View/Close toggle, Mark as Mitigated, per-product scanning with 409 guard against concurrent scans. Removed per-product scan trigger from user-facing Risk Findings page in favour of admin-triggered platform scan.

**Acceptance Criteria:**
- `routes/risk-findings.test.ts` covers list / close / mark-mitigated.
- `runProductScan()` returns 409 if a scan is already running.

**Sources:** Commit `ab7ec03` (2026-02-23 15:48, bundled UI + feedback + user-mgmt + scan-guard — only the vuln-scan concern relates here).

---

#### STORY-06.5 — Auto-resolved findings surface fix
**Under:** EPIC-06 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:vuln`, `verified-by:vitest`

**Description:** `auto_resolved` findings (where a dependency upgrade removed the vulnerable version) were not appearing in API responses as resolved. Fix: surface them with explicit status.

**Acceptance Criteria:**
- `routes/risk-findings.test.ts` covers the `auto_resolved` response shape.
- `routes/risk-findings-regression.test.ts` covers the reconcile path.

**Sources:** Session 60 bug-fix commits.

---

#### STORY-06.6 — Dashboard CRA-readiness capped at 100% + live timeline count
**Under:** EPIC-06 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:vuln`, `verified-by:vitest`

**Description:** Two related corrections. (1) Dashboard CRA-readiness percentage capped at 100% (was exceeding due to obligations edge case). (2) Compliance-timeline summary card uses live actionable-findings count (was stale).

**Acceptance Criteria:**
- `routes/dashboard.test.ts` covers the 100% cap.
- `routes/compliance-timeline.test.ts` covers the live actionable count.

**Sources:** Session 60 bug-fix commits.

---

#### STORY-06.7 — `vulnerability_scans` schema drift fix
**Under:** EPIC-06 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:vuln`

**Description:** Added missing columns `local_db_duration_ms` + `local_db_findings` to `vulnerability_scans` table (idempotent ALTER in `pool.ts initDb()`).

**Acceptance Criteria:**
- `vulnerability_scans` table has both columns at HEAD; `pool.ts initDb()` carries the idempotent `ADD COLUMN IF NOT EXISTS` guards.

**Sources:** Session 60 schema-drift commit.

---

#### STORY-06.8 — SBOM resync orphaned dependencies (known open)
**Under:** EPIC-06 | **Status:** To Do (known open product bug) | **Labels:** `methodology-retrospective`, `area:vuln`, `bug`

**Description:** Neo4j `DEPENDS_ON` edges are not pruned on SBOM resync, blocking `reconcileFindings()` from auto-resolving stale findings. Logged as open product bug session 60.

**Acceptance Criteria:** *(this is a defect — verification on fix)*
- On resync, `DEPENDS_ON` edges for removed deps are deleted.
- `reconcileFindings()` auto-resolves the corresponding findings.

**Sources:** Session 60 RESTART note; tracked under EPIC-06 as defect.

---

#### STORY-06.9 — `runProductScan()` missing `reconcileFindings()` call (known open)
**Under:** EPIC-06 | **Status:** To Do (known open product bug) | **Labels:** `methodology-retrospective`, `area:vuln`, `bug`

**Description:** Per-product scans never auto-resolve stale findings because `reconcileFindings()` is not called inside `runProductScan()`. Logged as open product bug session 60.

**Acceptance Criteria:** *(defect — verification on fix)*
- `runProductScan()` calls `reconcileFindings()` after a successful scan completes.
- `routes/risk-findings-regression.test.ts` covers the per-product path.

**Sources:** Session 60 RESTART note.

---

### Stories under EPIC-07 — Technical File (CRA Annex VII)

#### STORY-07.1 — Technical File 8-section editor + Annex I Part I checklist
**Under:** EPIC-07 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`, `regulation:cra`, `verified-by:vitest`

**Description:** CRA Annex VII compliant Technical File editor with 8 sections (Product Description, Risk Assessment, Design, Manufacturing, Verification, Documentation, Conformity Assessment, Change Management). Annex I Part I essential-requirements checklist on the Compliance tab. Per-section autosave; per-section author + last-updated metadata.

**Acceptance Criteria:**
- `routes/technical-files.test.ts` covers section CRUD per product.
- `technical_file_sections` table with `(org_id, product_id, section_key)` unique.
- E2E `e2e/acceptance/technical-files.spec.ts` covers section edit.

**Sources:** Commit `ceddd7c` (2026-02-21 10:46, Tech File concern), Phase 2 obligation-engine commits.

---

#### STORY-07.2 — Tech Files cross-product overview
**Under:** EPIC-07 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`, `verified-by:vitest`

**Description:** Cross-product overview with summary stats, filter buttons, deep-links to per-product editors. `?tab=` deep linking supported.

**Acceptance Criteria:**
- `routes/technical-files-overview.test.ts` covers the rollup.
- Deep-link `/products/<id>?tab=technical-file&section=risk-assessment` lands correctly.

**Sources:** Commit `a4f8a45` (2026-02-22 08:34, tech-files overview concern).

---

#### STORY-07.3 — Document templates library
**Under:** EPIC-07 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`, `verified-by:vitest`

**Description:** Library of compliance document templates (37 templates) — DoC, CVD policy, post-market plan, risk assessment, etc. Auto-population from existing org / product / SBOM data. Help-guide route ch4_05 (Batch Fill wizard).

**Acceptance Criteria:**
- `routes/document-templates.test.ts` passes.
- `document_templates` table seeded; full list visible on Templates page.

**Sources:** P6 #35/#36/#37 phase commits.

---

#### STORY-07.4 — Batch Fill wizard (deterministic auto-population)
**Under:** EPIC-07 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`, `verified-by:vitest`

**Description:** Six-station wizard that deterministically auto-populates 4 Annex VII sections + obligation evidence from existing data. Non-destructive — never overwrites user edits without explicit re-confirm.

**Acceptance Criteria:**
- `routes/batch-fill.test.ts` covers the auto-population pipeline.
- Help guide `ch4_05` complete with 6 stations + Beck-map JSON.
- Non-destructive guarantee enforced (verified via test fixtures with pre-existing section content).

**Sources:** Session 54 ch4_05 help-guide + auto-fill commits, `routes/technical-file/batch-fill.ts`.

---

#### STORY-07.5 — EU DoC + CVD policy Markdown export
**Under:** EPIC-07 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`, `regulation:cra`

**Description:** Download buttons on TechnicalFileTab for the EU Declaration of Conformity and the Coordinated Vulnerability Disclosure policy. Output is Markdown (`text/markdown`, `.md` filename), labelled accordingly: "Download EU DoC (MD)", "Download CVD Policy (MD)". Route path retained as `/pdf` for URL stability; full Markdown→PDF rendering is a separate planned project.

**Acceptance Criteria:**
- `GET /api/technical-file/:productId/declaration-of-conformity/pdf` returns `Content-Type: text/markdown` with `.md` filename.
- `GET /api/technical-file/:productId/cvd-policy/pdf` ditto.
- Button labels read "(MD)" not "PDF" (`b81b52e`).

**Sources:** Commit `b81b52e` (2026-05-18 12:00, button labels).

---

#### STORY-07.6 — PDF→Markdown migration (#45)
**Under:** EPIC-07 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** Replaced 6 `pdfkit` generators with Markdown emitters; removed the `pdfkit` dependency entirely. Rationale: Markdown is auditable, diffable, and pipes cleanly into downstream tools; the visual-PDF feature is deferred until there's real customer demand.

**Acceptance Criteria:**
- `pdfkit` not in `backend/package.json` at HEAD (verified `grep -i pdfkit backend/package.json`).
- All 6 former PDF endpoints return `Content-Type: text/markdown`.

**Sources:** #45 PDF→MD migration commits.

---

### Stories under EPIC-08 — CRA Article 14 Reporting Workflow

#### STORY-08.1 — Three-stage CRA Art. 14 notification workflow
**Under:** EPIC-08 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `regulation:cra`, `verified-by:vitest`

**Description:** Three-stage notification per CRA Article 14: Early Warning (24h), Notification (72h), Final Report (14 days / 1 month). CSIRT country selection; TLP classification (RED/AMBER/GREEN/CLEAR); create-from-finding flow; deadline tracking per stage.

**Acceptance Criteria:**
- `routes/cra-reports.test.ts` covers each stage's draft + submit.
- `cra_reports` table with `awareness_at`, `early_warning_at`, `notification_at`, `final_report_at`, `csirt_country`, `tlp` columns.
- E2E `e2e/acceptance/reports.spec.ts` covers create-from-finding.

**Sources:** Commit `624eb8e` (2026-02-24 10:44).

---

#### STORY-08.2 — Submit-with-authorisation + RFC3161 attestation on stage submit (P10d)
**Under:** EPIC-08 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `regulation:cra`, `verified-by:vitest`

**Description:** On stage submit (early / notification / final), capture authorising-user attestation (user + timestamp + UA + IP) and co-store an RFC3161 timestamp token with the submission. Together the attestation + RFC3161 token give an independently-witnessed audit trail of *who* authorised *what* and *when*.

**Acceptance Criteria:**
- `services/submission-attestation.test.ts` covers attestation capture + token co-store.
- `cra_reports.attestation_user_id`, `cra_reports.attestation_rfc3161_token` columns populated on submit.

**Sources:** Commit `290d85f` (2026-05-06 10:29).

---

#### STORY-08.3 — Per-product regulatory-state view with deadline countdown (P10c)
**Under:** EPIC-08 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `regulation:cra`

**Description:** New "regulatory state" panel on the product detail page surfaces the active CRA Art. 14 deadline track (24h / 72h / 14d) with live countdown chips. Shows current stage, deadline, time remaining.

**Acceptance Criteria:**
- `services/regulatory-state.test.ts` passes.
- Frontend panel renders countdown chips that update live.

**Sources:** Commit `fe1ba49` (2026-05-06 10:13).

---

### Stories under EPIC-09 — Obligations Engine

#### STORY-09.1 — Obligations table + cross-product tracker
**Under:** EPIC-09 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `regulation:cra`, `verified-by:vitest`

**Description:** Postgres `obligations` table with unique constraint `(org_id, product_id, obligation_key)`. Cross-product tracker page lists obligations per product with status (`not_started` / `in_progress` / `met`). Inline status dropdown on product detail page. `ON CONFLICT DO NOTHING` used everywhere to keep ensure-paths idempotent.

**Acceptance Criteria:**
- `routes/obligations.test.ts` covers list / update / status transitions.
- `obligations` table has the documented unique constraint at HEAD.

**Sources:** Commit `a4f8a45` (2026-02-22 08:34, obligations concern of bundle).

---

#### STORY-09.2 — 35-obligation registry (manufacturer / importer / distributor / OSS steward)
**Under:** EPIC-09 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `regulation:cra`, `verified-by:vitest`

**Description:** `services/obligation-engine.ts` defines 35 obligations: 19 manufacturer (Art. 13, 14, 16, 20, 32, Annexes), 10 importer (Art. 18), 6 distributor (Art. 19). Each carries `appliesTo` (CRA categories) and `appliesToRoles` (CraRole[]). Open-source stewards share the manufacturer obligation set.

**Acceptance Criteria:**
- `services/obligation-engine-roles.test.ts` enumerates 35 obligations and verifies role-applicability mapping.
- `CraRole` type union: `'manufacturer' | 'importer' | 'distributor' | 'open_source_steward'`.

**Sources:** Phase 2 + role-aware obligations commits; `services/obligation-engine.ts`.

---

#### STORY-09.3 — Role-aware applicability + derivation engine
**Under:** EPIC-09 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `regulation:cra`, `verified-by:vitest`

**Description:** `getApplicableObligations(craCategory, craRole?)` filters by category AND role (default `manufacturer` if omitted). `computeDerivedStatuses(productIds, orgId, categoryMap, craRole?)` runs role-specific derivation logic against live product / SBOM / vuln-scan / tech-file state. `effectiveStatus = max(manual, derived)` — manual entries always preserved.

**Acceptance Criteria:**
- `integration/role-specific-obligations.test.ts` covers each role's derivation path.
- E2E `e2e/acceptance/role-aware-obligations.spec.ts` passes.
- Manual `met` status preserved over a derived `not_started` (verified by test).

**Sources:** Role-aware obligations commits; `services/obligation-engine.ts`.

---

#### STORY-09.4 — Batched obligation ensure (`ensureObligationsBatch` chunked at 500)
**Under:** EPIC-09 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `verified-by:vitest`

**Description:** All 10 call sites use `ensureObligationsBatch(orgId, products, craRole?)` for efficient bulk upsert; chunked at 500 rows to stay within Postgres parameter limits. `craRole` flows from the org's Neo4j `craRole` property.

**Acceptance Criteria:**
- `services/obligation-engine.ts` exports `ensureObligationsBatch` with chunking.
- 10 call sites wired (grep for `ensureObligationsBatch` finds 10 occurrences).

**Sources:** Role-aware obligations commits.

---

### Stories under EPIC-10 — IP/Copyright Proof & Compliance Snapshots

#### STORY-10.1 — IP/Copyright Proof via RFC 3161 (pure-Node ASN.1)
**Under:** EPIC-10 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** RFC 3161 timestamping via FreeTSA.org using pure Node.js ASN.1 DER encoding (no external libraries). Snapshot creation hashes the artefact, requests a timestamp token from FreeTSA, stores both. Verification re-computes the hash and verifies the token signature. Export as a proof ZIP with token + chain + verification helper.

**Acceptance Criteria:**
- `routes/ip-proof.test.ts` covers snapshot create / verify / export.
- ASN.1 DER encoder + decoder are pure Node (no native bindings); verified by `grep -ri pkijs backend/src/services/ip-proof*` returning empty for the timestamping path (`pkijs` is only used for signing).

**Sources:** Commit `eb0f7e6` (2026-02-24 13:45, IP proof concern).

---

#### STORY-10.2 — Compliance snapshot + retention ledger
**Under:** EPIC-10 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** `compliance_snapshot.ts` builds a deterministic snapshot of all CRA-evidence-relevant artefacts at point-in-time. Writes ZIP + signature files alongside it. `retention_ledger` table records each snapshot with anti-tamper hash chaining (`previous_hash` column).

**Acceptance Criteria:**
- `routes/compliance-snapshots.test.ts` covers create / list / verify.
- `retention_ledger.previous_hash` chain validates correctly (verified by snapshot-verification job).

**Sources:** WS2 + P8 commits.

---

#### STORY-10.3 — Hybrid signing (Ed25519 + ML-DSA-65)
**Under:** EPIC-10 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Hybrid post-quantum signing. `signDocument()` returns both Ed25519 (64 bytes) and ML-DSA-65 (3,309 bytes) signatures. `verifyHybridSignature()` is AND-logic — both must pass. Graceful degradation: falls back to Ed25519-only when `CRANIS2_SIGNING_KEY_MLDSA` is unset. `compliance-snapshot.ts` writes `.sig` (Ed25519) + `.sig.mldsa` (ML-DSA-65) alongside compliance ZIPs. `retention-certificate.ts` carries both signatures in `CertificateResult`.

**Acceptance Criteria:**
- 23 tests pass in `security/hybrid-signing.test.ts`.
- Both `.sig` and `.sig.mldsa` files produced next to a snapshot ZIP (verified manually).
- Falls back gracefully when key is unset.

**Sources:** WS2 Part 2 commits; `services/signing.ts`, `services/compliance-snapshot.ts`.

---

#### STORY-10.4 — Public signing-key endpoint + key generator script
**Under:** EPIC-10 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`

**Description:** `/.well-known/cranis2-signing-key-mldsa.pem` exposes the ML-DSA-65 public key for third-party signature verification. `scripts/generate-signing-keys.sh` generates both Ed25519 + ML-DSA-65 key pairs and outputs base64 for `.env`.

**Acceptance Criteria:**
- `curl https://cranis2.com/.well-known/cranis2-signing-key-mldsa.pem` returns 200 + a valid ML-DSA-65 PEM public key.
- `generate-signing-keys.sh` produces both keys + base64 for `.env`.

**Sources:** WS2 Part 2 commits.

---

### Stories under EPIC-11 — Licence Compliance Scanning

#### STORY-11.1 — SPDX licence classification + risk
**Under:** EPIC-11 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:sbom`, `verified-by:vitest`

**Description:** Classify every dependency licence per SPDX into `permissive` / `copyleft_weak` / `copyleft_strong` / `unknown`. Per-dependency risk assessment with acknowledge / waive workflow. Notifications for critical copyleft findings routed to security_contact + compliance_officer.

**Acceptance Criteria:**
- `routes/license-scan.test.ts` covers classification + risk.
- `licence_findings.acknowledged_by`, `acknowledged_at`, `waiver_reason` columns present.

**Sources:** Commit `eb0f7e6` (2026-02-24 13:45, licence-scan concern of bundle).

---

#### STORY-11.2 — Transitive depth tagging on Neo4j `DEPENDS_ON` edges
**Under:** EPIC-11 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:sbom`

**Description:** SPDX relationships parsed to tag direct vs transitive depth on Neo4j `DEPENDS_ON` edges. Measured on CRANIS2 itself: 89 direct, 295 transitive. npm registry fallback for `NOASSERTION` licence enrichment.

**Acceptance Criteria:**
- Cypher `MATCH ()-[r:DEPENDS_ON]->() WHERE r.depth IS NOT NULL RETURN count(r)` returns >0 on a synced product.
- npm-registry fallback fires on `NOASSERTION` and updates the licence field.

**Sources:** Commit `eb0f7e6` (transitive-enrichment concern).

---

#### STORY-11.3 — Licence compatibility matrix with distribution-model awareness
**Under:** EPIC-11 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:sbom`, `verified-by:vitest`

**Description:** Pure rules engine checks licence compatibility based on how a product is distributed (proprietary binary, SaaS, source-available, library, internal). FSF cross-licence conflict table with 14 known incompatibilities. Verdicts (`compatible` / `incompatible` / `review_needed`) integrated into scanner, recheck endpoint, frontend badges + filters, and the due-diligence PDF→MD export.

**Acceptance Criteria:**
- `routes/license-scan.test.ts` covers the matrix.
- 14 entries in the FSF conflict table (verified in `services/license-compatibility.ts` or equivalent).

**Sources:** Commit `5199d40` (2026-02-25 14:24).

---

#### STORY-11.4 — Due-diligence report ZIP export
**Under:** EPIC-11 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:sbom`, `verified-by:vitest`

**Description:** Per-product investor-ready ZIP package with PDF→MD report, CycloneDX SBOM, licence findings CSV, vulnerability summary JSON, and full licence texts. Shared `sbom-service.ts` extracted from `sbom-export.ts` to avoid duplication.

**Acceptance Criteria:**
- `routes/due-diligence.test.ts` covers ZIP generation.
- `integration/due-diligence-export.test.ts` covers end-to-end export.
- E2E `e2e/acceptance/due-diligence-package.spec.ts` passes.

**Sources:** Commit `4dd6841` (2026-02-25 10:15).

---

#### STORY-11.5 — Manual sync auto-triggers licence scan + IP proof
**Under:** EPIC-11 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:sbom`

**Description:** Previously only the 2 AM scheduler ran licence scan + IP-proof timestamping. Manual sync paths now also trigger both, so a user-driven resync produces fresh evidence immediately.

**Acceptance Criteria:**
- Manual `POST /api/github/sync/:productId` (or equivalent) triggers `runLicenseScan()` + IP-proof timestamping.

**Sources:** Commit `eb0f7e6` (manual-sync auto-trigger concern).

---

### Stories under EPIC-12 — Compliance Package & Reporting

#### STORY-12.1 — Per-product compliance package + reports
**Under:** EPIC-12 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`, `verified-by:vitest`

**Description:** ZIP bundle of all CRA-evidence-relevant artefacts per product, plus individual reports (CRA Annex VII MD, conformity, dependencies CSV, vulnerability summary JSON, IP proof).

**Acceptance Criteria:**
- `routes/reports.test.ts`, `routes/product-reports.test.ts` pass.
- `integration/compliance-package-journey.test.ts` passes.
- E2E `e2e/acceptance/reports.spec.ts` passes.

**Sources:** Phase 2 compliance-package commits; `routes/reports.ts`, `routes/product-reports.ts`.

---

#### STORY-12.2 — Categorised SBOM compliance gap detection
**Under:** EPIC-12 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`, `verified-by:vitest`

**Description:** Categorise hash-enrichment failures into `no_version` / `unsupported_ecosystem` / `not_found` / `fetch_error` / `pending`. `sendComplianceGapNotification()` debounced. Frontend info panel renders categorised breakdown with actionable guidance.

**Acceptance Criteria:**
- `routes/compliance-gaps.test.ts` covers the categorisation + endpoint.

**Sources:** Commits `f11bc40`, `0302d55`.

---

#### STORY-12.3 — Per-product historical compliance timeline (Recharts)
**Under:** EPIC-12 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`, `verified-by:vitest`

**Description:** Per-product historical compliance timeline rendered with Recharts. Shows obligations status, vuln-findings count, licence verdicts over time. Live actionable-findings count on the summary card (session-60 fix).

**Acceptance Criteria:**
- `routes/compliance-timeline.test.ts` passes.
- Chart renders with at least one data series for a product with history.

**Sources:** Commits `5e11e33` (2026-02-25 15:01), session 60 actionable-count fix.

---

#### STORY-12.4 — CRA Compliance Checklist (Annex I Part I + Article-driven)
**Under:** EPIC-12 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `regulation:cra`, `verified-by:vitest`

**Description:** Compliance checklist endpoint derives per-product status from real obligations + tech-file completeness + scan state. `routes/compliance-checklist.ts`.

**Acceptance Criteria:**
- `routes/compliance-checklist.test.ts` passes.
- Checklist derivation is deterministic across replays.

**Sources:** Phase 2 commits; `routes/compliance-checklist.ts`.

---

#### STORY-12.5 — CRA scorecard (P0)
**Under:** EPIC-12 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `regulation:cra`, `tier:p0`

**Description:** Dashboard CRA-readiness scorecard. Aggregates obligation status + vuln findings + tech-file completeness into a single readiness % (capped at 100%, session-60 fix).

**Acceptance Criteria:**
- `routes/dashboard.test.ts` covers the scorecard.
- Cap at 100% verified by test fixture.

**Sources:** P0 phase commits, session 60 cap fix.

---

### Stories under EPIC-13 — Notifications & Activity Tracking

#### STORY-13.1 — Notifications API + service + sidebar bell
**Under:** EPIC-13 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Backend notification API + service; sidebar bell badge with polling; full notifications page with filters + mark-as-read. `notifications` table with `(user_id, org_id, kind, payload_json, read_at)` columns.

**Acceptance Criteria:**
- `routes/notifications.test.ts` covers create / list / mark-read.
- E2E `e2e/acceptance/notifications.spec.ts` covers the bell + page.

**Sources:** Commit `e553f1e` (2026-02-22 15:42, notifications concern).

---

#### STORY-13.2 — Stakeholder notification routing
**Under:** EPIC-13 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Notifications routed to role-based recipients: security_contact, compliance_officer, tech_file_owner, incident_response_lead, platform_admin. Resend email delivery for the email-channel; in-app for the bell.

**Acceptance Criteria:**
- `services/alert-emails.test.ts` covers routing per role.
- `stakeholders` table has per-role contact rows.

**Sources:** Commit `e553f1e` (stakeholder-notify concern), `services/alert-emails.test.ts`.

---

#### STORY-13.3 — Audit log live data + system events
**Under:** EPIC-13 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** `GET /api/audit-log` queries `user_events` for all users in the org. Filters, pagination (25/page), total count. AuditLogPage table; click row to expand full detail (UA, accept-language, referrer, metadata). Webhook events appear with user="system" via `LEFT JOIN` (was `JOIN`, which hid them).

**Acceptance Criteria:**
- `routes/audit-log.test.ts` and `routes/audit.test.ts` cover the listing + event-type filter.
- Webhook events appear in audit log with `user="system"` (verified by test).

**Sources:** Commits `c68d6e3` (2026-02-20 15:20, audit log baseline), `625908f` (LEFT JOIN fix).

---

#### STORY-13.4 — Audit log column reorder for mobile
**Under:** EPIC-13 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`

**Description:** Column order changed from Event/User/IP/Device/Location/Time to Event/User/Location/Time/IP/Device — most useful columns first on small screens.

**Acceptance Criteria:**
- AuditLogPage header order matches the new column order.

**Sources:** Commit `2e20f48` (2026-02-22 05:37).

---

#### STORY-13.5 — Webhook audit logging
**Under:** EPIC-13 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Webhook push events record `webhook_sbom_stale` in the audit trail with repo URL + product ID metadata. Direct insert with `NULL user_id` since webhooks are system events. Error handling wrap with try/catch + console.error for silent-failure debug.

**Acceptance Criteria:**
- `webhooks/github-webhook.test.ts` covers audit-log write.
- `user_events.event_type = 'webhook_sbom_stale'` rows present.

**Sources:** Commits `516fbee`, `ac98a10`, `5ff6da4` (test commit).

---

#### STORY-13.6 — Product activity feed
**Under:** EPIC-13 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Per-product activity feed surfacing sync events, scan completions, obligation status changes, tech-file edits, escrow deposits, etc.

**Acceptance Criteria:**
- `routes/product-activity.test.ts` passes.
- Activity feed visible on the ProductDetailPage Overview tab.

**Sources:** P2 activity-log commits; `routes/product-activity.ts`.

---

#### STORY-13.7 — Notifications page filters + mark-as-read
**Under:** EPIC-13 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Standalone notifications page with filter dropdown (by kind / by read state), bulk mark-as-read, refresh.

**Acceptance Criteria:**
- E2E `e2e/acceptance/notifications.spec.ts` covers the filter + mark-as-read paths.

**Sources:** P0 notification commits.

---

### Stories under EPIC-14 — Webhooks (Cross-Provider)

#### STORY-14.1 — GitHub HMAC-SHA256 push webhooks
**Under:** EPIC-14 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:sbom`, `verified-by:vitest`

**Description:** GitHub push events verified by HMAC-SHA256 against `GITHUB_WEBHOOK_SECRET`. Marks SBOM stale; records `webhook_sbom_stale` audit entry. Daily 2 AM scheduler auto-syncs stale SBOMs.

**Acceptance Criteria:**
- `webhooks/github-webhook.test.ts` passes.
- HMAC mismatch returns 401.

**Sources:** Commit `ceddd7c` (2026-02-21 10:46, webhook concern).

---

#### STORY-14.2 — Codeberg / Forgejo / Gitea webhooks
**Under:** EPIC-14 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:sbom`, `verified-by:vitest`

**Description:** Self-hosted provider webhook handlers reuse the HMAC verification pattern (where supported) and the "repo tracked in Neo4j" check otherwise. Tier-3 E2E tests exercise these against the local Forgejo instance.

**Acceptance Criteria:**
- `webhooks/codeberg-webhook.test.ts` passes against local Forgejo.
- `routes/webhook-e2e.test.ts` B5/B6 pass.

**Sources:** Provider-expansion commits; `webhooks/codeberg-webhook.test.ts`.

---

#### STORY-14.3 — Bitbucket Cloud webhooks (no HMAC)
**Under:** EPIC-14 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:sbom`

**Description:** Bitbucket uses `X-Event-Key: repo:push` with no HMAC signature — verified by checking the repo is tracked in Neo4j (defence by knowledge). Same `webhook_sbom_stale` flow as the others.

**Acceptance Criteria:**
- Bitbucket webhook handler accepts `repo:push` and runs the "tracked in Neo4j" verification.

**Sources:** Session 59 Bitbucket commits.

---

#### STORY-14.4 — Stripe webhook signature verification
**Under:** EPIC-14 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:billing`, `verified-by:vitest`

**Description:** Stripe webhook handler verifies `Stripe-Signature` header against `STRIPE_WEBHOOK_SECRET` using the official `stripe.webhooks.constructEvent` pattern. Handles `customer.subscription.*`, `invoice.payment_*`, `customer.created`.

**Acceptance Criteria:**
- `webhooks/stripe-webhook.test.ts` covers signature-pass + signature-fail.

**Sources:** Stripe billing commits.

---

#### STORY-14.5 — Webhook E2E + registration + health
**Under:** EPIC-14 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:sbom`, `verified-by:vitest`

**Description:** End-to-end webhook-registration flow (subscribe / unsubscribe on the provider) and a health endpoint reporting last-received-at per webhook.

**Acceptance Criteria:**
- `routes/webhook-e2e.test.ts`, `routes/webhook-registration.test.ts`, `routes/webhook-health.test.ts`, `routes/push-events.test.ts` all pass.

**Sources:** P2 #12 webhook E2E commits.

---

### Stories under EPIC-15 — Cross-Product Overviews

#### STORY-15.1 — Stakeholders page (org + product roles)
**Under:** EPIC-15 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Stakeholders page surfaces org-level (manufacturer / authorised rep / compliance officer) and product-level (security contact / tech file owner / incident response lead) CRA + NIS2 contacts, with inline editing.

**Acceptance Criteria:**
- `routes/stakeholders.test.ts` covers list + inline update.
- `stakeholders` table has org + product rows with auto-create on first access.

**Sources:** Commit `a4f8a45` (2026-02-22 08:34, stakeholders concern).

---

#### STORY-15.2 — Contributors overview
**Under:** EPIC-15 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Cross-product contributor list aggregated from all connected repos; per-contributor product count, last commit timestamp, languages.

**Acceptance Criteria:**
- `routes/contributors-overview.test.ts` passes.

**Sources:** Commit `fadff46` (2026-02-22 10:33).

---

#### STORY-15.3 — Dependencies overview
**Under:** EPIC-15 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Cross-product dependency rollup; aggregates direct + transitive counts, ecosystems, top vulnerable packages.

**Acceptance Criteria:**
- `routes/dependencies-overview.test.ts` passes.

**Sources:** Commit `fadff46`.

---

#### STORY-15.4 — Repos overview
**Under:** EPIC-15 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Cross-product repos page with provider filter tabs (badge counts per provider), last-sync state, sync-now action.

**Acceptance Criteria:**
- `routes/repos-overview.test.ts` passes.
- 6 provider tabs visible (GH / Codeberg / Gitea / Forgejo / GitLab / Bitbucket).

**Sources:** Commit `fadff46`.

---

### Stories under EPIC-16 — Billing & Subscriptions

#### STORY-16.1 — Stripe contributor-based pricing baseline (Standard tier)
**Under:** EPIC-16 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:billing`, `verified-by:vitest`

**Description:** Stripe checkout with EUR 6/month per active contributor. 90-day free trial. Stripe customer portal for plan management. Global billing-gate middleware blocks writes for restricted accounts. Trial lifecycle with grace periods + email notifications via Resend. Scheduler checks at 4 AM. Admin controls for trial extension / exemption / payment pause.

**Acceptance Criteria:**
- `routes/billing.test.ts`, `webhooks/stripe-webhook.test.ts` pass.
- `org_billing` table present with trial fields.
- E2E `e2e/acceptance/billing-and-subscription.spec.ts` passes.

**Sources:** Commit `8987f8a` (2026-02-25 10:15).

---

#### STORY-16.2 — Global billing-gate middleware
**Under:** EPIC-16 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:billing`, `verified-by:vitest`

**Description:** Express middleware applied globally to write routes. Blocks writes for orgs with `status = 'restricted'` (post-trial-expiry, payment failure). Read paths continue to work so the customer can still log in, view data, fix billing.

**Acceptance Criteria:**
- `security/billing-gate.test.ts` covers blocked write + allowed read.
- `integration/billing-gate-enforcement.test.ts` covers end-to-end.

**Sources:** Commit `8987f8a` (billing-gate concern).

---

#### STORY-16.3 — Pro tier (€9/product + €6/contributor)
**Under:** EPIC-16 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:billing`, `verified-by:vitest`

**Description:** Second pricing tier introduced for product-heavy orgs. `requirePlan('pro')` middleware enforces tier hierarchy (standard < pro < enterprise). Trust Centre publish, public API v1, AI Copilot all gated to Pro.

**Acceptance Criteria:**
- `requirePlan('pro')` middleware exported from `backend/src/middleware/billing.ts` (or equivalent).
- Routes using it return 402 for standard-plan orgs.

**Sources:** Pro-tier introduction commit.

---

#### STORY-16.4 — Platform-admin-configurable pricing (`platform_settings`)
**Under:** EPIC-16 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:billing`, `area:admin`

**Description:** Pricing values stored in `platform_settings` (key-value), admin-editable via `/admin/system`. Avoids redeploy for pricing changes.

**Acceptance Criteria:**
- `platform_settings` table present with `key text primary key, value jsonb, updated_at`.
- `/admin/system` page exposes pricing controls.

**Sources:** Pro-tier + admin commits.

---

#### STORY-16.5 — Pre-Stripe due-diligence + billing-tier documentation
**Under:** EPIC-16 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:billing`, `area:docs`

**Description:** Pre-Stripe documentation: `docs/billing-tier.md` captures the tier model + pricing rationale.

**Acceptance Criteria:**
- `docs/billing-tier.md` present at HEAD.

**Sources:** Commit `4dd6841` (2026-02-25 10:15, billing-tier doc concern).

---

#### STORY-16.6 — Admin trial / exemption / pause controls
**Under:** EPIC-16 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:billing`, `area:admin`, `verified-by:vitest`

**Description:** Admin controls for: extend trial (sets `trial_ends_at`); exempt from billing (sets `status='exempt'`); pause payment (sets `status='paused'`). Reflected in `org_billing` and respected by the billing gate.

**Acceptance Criteria:**
- `routes/admin-orgs.test.ts` covers the three actions.
- Audit-log entry on each action.

**Sources:** Stripe billing commits + admin-orgs commits.

---

### Stories under EPIC-17 — Marketplace → Trust Centre

#### STORY-17.1 — Compliance Marketplace (initial baseline)
**Under:** EPIC-17 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:trust`, `verified-by:vitest`

**Description:** Initial public-facing Compliance Marketplace. Postgres tables `marketplace_profiles` + `marketplace_contact_log`. Backend `/api/marketplace` (listings, categories, profile CRUD, contact with rate limiting). `computeComplianceBadges()` derives CRA status from real obligations + tech files + vuln scans + licences. Public MarketplacePage with search / filter grid + pagination + compliance badges. Public MarketplaceDetailPage with two-column layout + contact modal (auth required) + company info. Authenticated MarketplaceSettingsPage to toggle listing + edit tagline / description / categories. Contact emails via Resend with Reply-To, rate limited (3/day, 1/org/7d), self-contact blocked. 10 categories.

**Acceptance Criteria:**
- `routes/trust-centre.test.ts` (file renamed from `marketplace.test.ts` in session 60) covers list / detail / contact.
- 10 categories: IoT, Industrial, Automotive, Healthcare, FinTech, Enterprise, Open Source, SaaS, Cybersecurity, Other.

**Sources:** Commit `d235d5c` (2026-02-25 10:53).

---

#### STORY-17.2 — Landing page + marketplace UI polish
**Under:** EPIC-17 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:trust`

**Description:** Landing page polish + marketplace card layout switched from tiled grid to full-width horizontal list. Hero text "Compliance without the chaos". Centre-aligned reg-intro paragraphs. Logo "2" uses accent blue outside admin area.

**Acceptance Criteria:**
- Marketplace card layout matches the full-width horizontal pattern.
- Hero text + alignment verified visually on `/` and `/marketplace`.

**Sources:** Commit `62fec94` (2026-02-25 13:29).

---

#### STORY-17.3 — Marketplace → Trust Centre rename (codebase-wide)
**Under:** EPIC-17 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:trust`, `verified-by:vitest`

**Description:** Session-60 rebrand: every code-level reference changed from "Marketplace" to "Trust Centre" — routes, services, frontend pages, tests, e2e specs, docs, help guides. `marketplace.ts` → `trust-centre.ts`. `MarketplacePage.tsx` → `TrustCentrePage.tsx` (+ detail + settings). Help guide `ch7_09_marketplace.html` → `ch7_09_trust_centre.html`. ≈90 test name changes. **Table name retained** (`marketplace_profiles`) per CLAUDE.md rule 14 — renaming a table holding customer data is forbidden; rename was code-level only.

**Acceptance Criteria:**
- `grep -ri "marketplace" -- ':!docs/scratch.md' ':!evidence' ':!*.md.bak'` returns only the `marketplace_profiles` table name + acceptable doc references.
- All 90+ renamed tests pass.

**Sources:** Session 60 rename commits.

---

#### STORY-17.4 — Compliance-badge derivation from live data
**Under:** EPIC-17 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:trust`, `verified-by:vitest`

**Description:** `computeComplianceBadges()` derives the badges (CRA-ready / NIS2-ready / IP-attested / SBOM-published) from current obligations + tech-file completeness + vuln-scan freshness + IP-proof timestamp existence — not from manual user attestation.

**Acceptance Criteria:**
- `routes/trust-classification.test.ts` passes.
- Badge regenerates within seconds of underlying data changing.

**Sources:** Commit `d235d5c` + session-60 refresh.

---

#### STORY-17.5 — Trust Centre Pro-gating + suite upgrade pattern
**Under:** EPIC-17 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:trust`, `area:billing`, `verified-by:playwright`

**Description:** Trust Centre publish (`TrustCentreSettingsPage`) is gated to Pro plan. E2E `trust-centre.spec.ts` was failing on a standard-plan default — fixed by upgrading the org to Pro in `beforeAll` via platformAdmin token, restoring in `afterAll` (mirrors the public-api-v1 pattern).

**Acceptance Criteria:**
- E2E `e2e/acceptance/trust-centre.spec.ts` passes against a fresh test stack (4-fail → green at session-63 close).
- `requirePlan('pro')` returns 402 for standard-plan orgs on publish endpoint.

**Sources:** Session 63 E2E fix commit `c2e1318`.

---

### Stories under EPIC-18 — Escrow (Forgejo Orchestrator)

#### STORY-18.1 — Forgejo Orchestrator baseline (v10, EU-sovereign)
**Under:** EPIC-18 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Self-hosted Forgejo v10 in Docker Compose with Cloudflare Tunnel (`escrow.cranis2.dev`). 7 artefact types (SBOM / vuln scans / licence findings / tech-file MD / DoC / CVD policy / IP proof). Per-product toggles. Daily scheduled deposits at 5 AM with date/hour gating. Manual deposits + deposit history. `escrow_configs` + `escrow_deposits` tables.

**Acceptance Criteria:**
- `routes/escrow.test.ts` covers config / setup / deposit / deposits / status (6 endpoints).
- Forgejo container reachable at `https://escrow.cranis2.dev` (dev) — verified by Tunnel route.

**Sources:** Commit `f3835b2` (2026-02-26 10:21).

---

#### STORY-18.2 — Escrow agent access (Forgejo collaborator API)
**Under:** EPIC-18 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Customer can grant an escrow agent collaborator access to their Forgejo repo via the Forgejo API. One-time credentials banner for new agents (purple); access notification (green) for existing agents. Agent reference codes for engagement tracking. Email notifications via Resend with org + product + repo details. Multi-product agent support — same Forgejo account across multiple orgs. Password reset only on first invite, not on subsequent product grants.

**Acceptance Criteria:**
- `routes/escrow.test.ts` covers agent invite / re-invite / multi-product.
- Forgejo collaborator created on first invite; re-invite does not reset password.

**Sources:** Commit `27152d4` (2026-02-26 14:28, escrow-agent concern).

---

#### STORY-18.3 — Product deletion fires final escrow deposit
**Under:** EPIC-18 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`

**Description:** Product delete flow makes a final `product_deleted` deposit to Forgejo before cascade-deleting the product. Repo preserved as permanent archive — customer can always come back to it.

**Acceptance Criteria:**
- `routes/escrow.test.ts` (or integration test) covers the final-deposit-then-delete sequence.
- Forgejo repo remains after Postgres + Neo4j cascade-delete.

**Sources:** Commit `27152d4` (product-deletion concern).

---

#### STORY-18.4 — Escrow setup gating on repo URL
**Under:** EPIC-18 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`

**Description:** Products can be created without a repo URL; escrow setup is gated on a repo URL existing with a friendly message. Delete / export handles products with or without repos.

**Acceptance Criteria:**
- Escrow setup page shows the gating message for products without `repoUrl`.

**Sources:** Commit `27152d4` (gating concern).

---

#### STORY-18.5 — Accordion sidebar (escrow + other navigation)
**Under:** EPIC-18 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`

**Description:** Collapsible menu categories with chevron indicators; only one section expanded at a time; auto-expands the section matching current route; active dot when a collapsed section contains the current page.

**Acceptance Criteria:**
- Sidebar collapses cleanly; auto-expand verified on hard refresh.

**Sources:** Commit `27152d4` (accordion-sidebar concern).

---

### Stories under EPIC-19 — Platform Admin

#### STORY-19.1 — Platform admin role + dashboard baseline
**Under:** EPIC-19 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:admin`, `verified-by:vitest`

**Description:** Platform-level admin role (`users.is_platform_admin`), `requirePlatformAdmin` middleware, full admin area with separate layout + routing. Real-time dashboard stats; organisations management with drill-down; users management with admin toggle; cross-org audit log with pagination + filters; system health monitoring with scan-performance metrics.

**Acceptance Criteria:**
- `routes/admin.test.ts`, `routes/admin-dashboard.test.ts` pass.
- `security/admin-route-protection.test.ts` covers non-admin rejection.
- `is_platform_admin` column present in `users` table.

**Sources:** Commit `add070c` (2026-02-22 11:13).

---

#### STORY-19.2 — Admin user-invite flow with Resend
**Under:** EPIC-19 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:admin`, `verified-by:vitest`

**Description:** Platform admins invite users from `/admin/users`. Creates user record, sends set-password email via Resend, optionally pre-assigns an organisation. Re-invite supported for unaccepted. Invited user → `/accept-invite` → set password → auto-verified → linked to org in Neo4j.

**Acceptance Criteria:**
- Admin-only invite endpoint protected by `requirePlatformAdmin`.
- `users.invited_by` populated.

**Sources:** Commit `be2ae95` (covered also in EPIC-02 from the user side; the admin trigger lives here).

---

#### STORY-19.3 — Admin orgs page
**Under:** EPIC-19 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:admin`, `verified-by:vitest`

**Description:** Cross-org admin page with org detail + members + billing + tech-file + vuln-scan summary. Suspend / delete + audit-log per org.

**Acceptance Criteria:**
- `routes/admin-orgs.test.ts` passes.
- Org delete cascade documented in commit `9581d00`: 13 Postgres tables + Neo4j `DETACH DELETE`.

**Sources:** Commit `add070c` + session 60 affiliate-row delete update.

---

#### STORY-19.4 — Admin system health
**Under:** EPIC-19 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:admin`, `verified-by:vitest`

**Description:** System health page reporting CPU temperature, memory, scan performance, database connection health, scheduler last-run timestamps.

**Acceptance Criteria:**
- `routes/admin-system.test.ts` passes.

**Sources:** Commit `ab7ec03` (2026-02-23 15:48, system-health concern), `add070c`.

---

#### STORY-19.5 — Admin audit log (cross-org)
**Under:** EPIC-19 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:admin`, `verified-by:vitest`

**Description:** Cross-org audit log with pagination + filters (org / event-type / user / date range). System events appear with user="system".

**Acceptance Criteria:**
- `routes/admin-audit-log.test.ts` passes.

**Sources:** Commit `add070c`.

---

#### STORY-19.6 — Admin vuln-db sync UI
**Under:** EPIC-19 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:admin`, `area:vuln`, `verified-by:vitest`

**Description:** `/admin/vuln-db` page with ecosystem stats + sync controls. Shows last sync timestamp per source (GHSA / NVD), advisory count per ecosystem.

**Acceptance Criteria:**
- `routes/admin-vuln-scan.test.ts` covers the admin trigger.
- `vuln_db_sync_status` table populated.

**Sources:** Commit `4494ffb`.

---

#### STORY-19.7 — Admin retention-ledger view
**Under:** EPIC-19 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:admin`, `verified-by:vitest`

**Description:** Admin view of the retention ledger across all orgs. Surfaces orphan rows, hash-chain integrity warnings.

**Acceptance Criteria:**
- `routes/admin-retention-ledger.test.ts` passes.

**Sources:** P8 admin commits.

---

#### STORY-19.8 — Admin analytics dashboard
**Under:** EPIC-19 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:admin`, `verified-by:vitest`

**Description:** Platform-wide analytics: signups, conversions, plan distribution, copilot usage per org, scan latency p50/p95/p99.

**Acceptance Criteria:**
- `routes/admin-analytics.test.ts` passes.

**Sources:** #57 Platform Analytics Dashboard commits.

---

#### STORY-19.9 — Admin copilot-prompt management page
**Under:** EPIC-19 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:admin`, `area:copilot`, `verified-by:vitest`

**Description:** `/admin/copilot` exposes all 32 seeded prompts with editable textareas + model + max_tokens + temperature + enabled + version controls. Quality Standard shown in context. Prompts loaded with 5-min in-memory cache; falls back to hardcoded constants on cache miss.

**Acceptance Criteria:**
- `routes/admin-copilot.test.ts` passes.
- `copilot_prompts` table has 32 rows seeded.
- Page exposes save + revert per prompt.

**Sources:** P7 prompt-management commits.

---

#### STORY-19.10 — Admin affiliates page + ledger management
**Under:** EPIC-19 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:admin`, `area:billing`, `verified-by:vitest`

**Description:** 389-line admin affiliates router. List affiliates; per-affiliate detail with bonus codes, ledger entries, payouts. Add ledger entries (credit / debit / payout). Generate monthly statement on demand.

**Acceptance Criteria:**
- `routes/admin-affiliates.test.ts` passes.
- `affiliates`, `affiliate_ledger`, `bonus_codes` tables present.

**Sources:** Session 60 affiliate phase-2 commits.

---

#### STORY-19.11 — Admin delete UI (visible danger + typed-confirmation)
**Under:** EPIC-19 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:admin`

**Description:** Hardening of admin delete flows. Delete affordance moved OUT of the kebab "more" menu and onto its own red-bordered row-level icon-button — always visible. Hidden for current user + any platform-admin row. Confirmation modal includes red "Permanent deletion" banner, cascade-summary paragraph, typed-confirmation input (must match email / org name), case-insensitive for emails / exact for org names. Inline 3-second success banner above list; no toast system introduced.

**Acceptance Criteria:**
- Delete button visible on AdminUsersPage + AdminOrgsPage rows (red-bordered).
- Confirmation modal disables Delete button until typed input matches.
- Delete cascades 13 Postgres tables + Neo4j `DETACH DELETE` (backend already enforced).

**Sources:** Commit `9581d00` (2026-05-18 16:29).

---

#### STORY-19.12 — Platform-admin invariant at startup + `/api/health`
**Under:** EPIC-19 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:admin`, `area:ops`

**Description:** Startup check ensures the platform-admin user exists. `/api/health` reports the invariant. If absent on prod, alert fires (deployment-health gate).

**Acceptance Criteria:**
- `curl https://cranis2.com/api/health` returns 200 with `platform_admin: ok` in body.
- Startup logs include the invariant check result.

**Sources:** Commit `2a6017f` (2026-05-07 01:30).

---

#### STORY-19.13 — Admin welcome-leads view
**Under:** EPIC-19 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:admin`

**Description:** Admin page surfacing the welcome-site assessment / launch-list leads — email, source funnel, verified state, assessment result. Used to follow up on leads pre-launch.

**Acceptance Criteria:**
- `routes/admin/welcome-leads.ts` exists; the admin page renders the list.

**Sources:** Session 60+ welcome-leads commits.

---

### Stories under EPIC-20 — P3 AI Copilot Suite

#### STORY-20.1 — Copilot — Suggest (#13)
**Under:** EPIC-20 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:copilot`, `tier:p3`, `verified-by:vitest`

**Description:** Generic "suggest" capability — given a tech-file section + product context, the copilot drafts suggested content for the user to accept / edit / reject. Backed by the foundation `quality_standard` + per-section `section:*` prompt layer.

**Acceptance Criteria:**
- `routes/copilot.test.ts` covers suggest happy path + auth + plan gating.
- Rate limit 20/product/hr enforced.

**Sources:** P3 #13 commits.

---

#### STORY-20.2 — Copilot — Auto-triage (#15)
**Under:** EPIC-20 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:copilot`, `tier:p3`, `verified-by:vitest`

**Description:** Vulnerability triage capability — given a finding, the copilot proposes severity adjustment, mitigation path, owner suggestion. Capability prompt `vulnerability_triage`.

**Acceptance Criteria:**
- `routes/batch-triage.test.ts` passes.
- Rate limit 5/product/hr.

**Sources:** P3 #15 commits.

---

#### STORY-20.3 — Copilot — Risk assessment (#16)
**Under:** EPIC-20 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:copilot`, `tier:p3`, `verified-by:vitest`

**Description:** Risk-assessment capability targeting CRA Annex I essential requirements. Capability prompt `risk_assessment`.

**Acceptance Criteria:**
- Risk-assessment capability invocable from the Risk tab.
- Rate limit 3/product/day.

**Sources:** P3 #16 commits.

---

#### STORY-20.4 — Copilot — Incident report drafter (#17)
**Under:** EPIC-20 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:copilot`, `tier:p3`, `verified-by:vitest`

**Description:** Drafts Art. 14 incident reports for review. Capability prompt `incident_report_draft`.

**Acceptance Criteria:**
- Incident drafter invocable from the CRA Reports flow.
- Rate limit 5/report/day.

**Sources:** P3 #17 commits.

---

#### STORY-20.5 — Copilot — CRA category recommender (#18)
**Under:** EPIC-20 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:copilot`, `tier:p3`, `verified-by:vitest`

**Description:** Given a product description + SBOM + market context, recommends the CRA category (`default` / `important_i` / `important_ii` / `critical`). Capability prompt `category_recommendation`.

**Acceptance Criteria:**
- `routes/category-recommendation.test.ts` covers auth / validation / gating (test does not invoke Anthropic API).
- E2E `e2e/acceptance/category-recommendation.spec.ts` passes (this is the 1 expected infrastructure-dependent failure in nightly).
- Rate limit 5/product/day.

**Sources:** P3 #18 commits.

---

#### STORY-20.6 — Copilot — Supplier due diligence (#19)
**Under:** EPIC-20 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:copilot`, `tier:p3`, `verified-by:vitest`

**Description:** Given an upstream supplier's name + product, the copilot drafts a due-diligence assessment using public information (CVE history, support cadence, OSS-license profile).

**Acceptance Criteria:**
- `routes/supplier-due-diligence.test.ts` passes.
- E2E `e2e/acceptance/supplier-due-diligence.spec.ts` passes.

**Sources:** P3 #19 commits.

---

#### STORY-20.7 — Copilot — Gap narrator (#20)
**Under:** EPIC-20 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:copilot`, `tier:p3`

**Description:** Plain-English narration of the categorised compliance-gap breakdown (no_version / unsupported_ecosystem / not_found / etc.) — turns a technical list into a sentence a compliance officer can act on.

**Acceptance Criteria:**
- Gap narrator invocable from the gap-detection info panel.

**Sources:** P3 #20 commits.

---

#### STORY-20.8 — Copilot dashboard (#27)
**Under:** EPIC-20 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:copilot`, `tier:p3`

**Description:** Per-org Copilot dashboard showing token-usage (monthly budget vs consumed), per-capability counts, cache hit rate, top recipients.

**Acceptance Criteria:**
- Copilot dashboard renders for Pro-plan orgs.
- `copilot_usage` table populated.

**Sources:** P3 #27 commits.

---

#### STORY-20.9 — Copilot prompt management (P7 phase 1 + 2)
**Under:** EPIC-20 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:copilot`, `tier:p7`, `verified-by:vitest`

**Description:** Prompts as data: `copilot_prompts` table stores 32 prompts across foundation (`quality_standard`), capability (`suggest`, `vulnerability_triage`, `risk_assessment`, `incident_report_draft`), section (`section:*` — 8), and obligation (`obligation:*` — 19) layers. Prompts loaded with 5-min in-memory cache; fall back to hardcoded constants. Three-layer architecture: Quality Standard preamble (Q1-Q7) → Regulatory context (per capability/section/obligation) → Capability prompt. `getGuidanceText()` loads section/obligation guidance from DB with 5-min cache.

**Acceptance Criteria:**
- `copilot_prompts` has 32 rows seeded.
- Docs `docs/copilot-quality-standard.md` (Q1-Q7) + `docs/prompts.md` (full inventory) exist.

**Sources:** P7 #38 prompt-management commits.

---

#### STORY-20.10 — Copilot cost protection (token budget + rate limits + cache)
**Under:** EPIC-20 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:copilot`, `verified-by:vitest`

**Description:** Token budget `copilot.monthly_token_limit` in `platform_settings` (default 500K); per-org override via `org_billing.copilot_token_limit`. Per-capability rate limits. Response cache: SHA-256 over context hash, 24h TTL, `copilot_cache` table. Middleware chain: `requireAuth → requirePlan('pro') → attachOrgId → requireTokenBudget() → requireCopilotRateLimit() → handler`.

**Acceptance Criteria:**
- Budget exceeded returns 429 with `Retry-After` set.
- Cache hit avoids LLM call (verified by usage count + cache hit count).
- All 8 capabilities are gated by the middleware chain (verified by `routes/copilot.test.ts`).

**Sources:** P7 #38 + P3 cost-protection commits.

---

### Stories under EPIC-21 — P4 External Integrations

#### STORY-21.1 — Public API v1 (#28)
**Under:** EPIC-21 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:p4`, `verified-by:vitest`

**Description:** Versioned public API at `/api/public/v1/*`. API-key auth via `api_keys` table (HMAC fingerprint, never plaintext). Pro-plan gated.

**Acceptance Criteria:**
- `routes/public-api-v1.test.ts` covers happy paths + auth.
- `routes/api-keys.test.ts` covers key issuance / revocation.
- Public API tests upgrade the org to Pro in `beforeAll`, restore in `afterAll` (standard pattern).

**Sources:** P4 #28 commits.

---

#### STORY-21.2 — CI/CD gate webhook (#22)
**Under:** EPIC-21 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:p4`

**Description:** Webhook endpoint a CI run can call to check whether CRA obligations are met before letting a release through. Returns pass/fail with un-met obligation list.

**Acceptance Criteria:**
- CI gate endpoint exists under `/api/public/v1/ci-gate` (or equivalent).

**Sources:** P4 #22 commits.

---

#### STORY-21.3 — Trello integration (#26)
**Under:** EPIC-21 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:p4`, `verified-by:vitest`

**Description:** Nightly test-result notifications posted to a Trello board. Board `69b076fb70d3d0cf561032b7`; Passed list `69b0770a19a08092fa674929`; Failed list `69b0770caa1a3148db3bee6d`.

**Acceptance Criteria:**
- `routes/trello.test.ts` passes.
- Nightly card visible on the Trello board (operational verification).

**Sources:** P4 #26 commits.

---

#### STORY-21.4 — MCP server (#14)
**Under:** EPIC-21 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:p4`

**Description:** Model Context Protocol server exposing CRANIS2 data to LLM tools. Used by Claude Code / IDE assistants to read product state + compliance status.

**Acceptance Criteria:**
- MCP server runnable from `mcp/` workspace.

**Sources:** P4 #14 commits.

---

#### STORY-21.5 — IDE assistant + GRC/OSCAL bridge (#21 + #23)
**Under:** EPIC-21 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:p4`, `verified-by:vitest`

**Description:** IDE-side assistant (#21) feeds CRANIS2 context into the developer's editor. GRC bridge / OSCAL export (#23) emits OSCAL component-definitions + control mappings for downstream GRC tooling.

**Acceptance Criteria:**
- `routes/oscal.test.ts`, `routes/grc-bridge.test.ts` pass.

**Sources:** P4 #21, #23 commits.

---

#### STORY-21.6 — Slack / ChatOps (#24/#25) — parked
**Under:** EPIC-21 | **Status:** Won't Do (parked post-launch) | **Labels:** `methodology-retrospective`, `area:ops`, `tier:p4`

**Description:** Slack notifications + ChatOps integrations were scoped but parked for post-launch — value uncertain without customer-validated demand.

**Acceptance Criteria:** *(none — explicitly parked)*

**Sources:** P4 phase notes; `completed_work.md` "P4 — 6/7 done… #24/#25 parked for post-launch".

---

### Stories under EPIC-22 — P8 10-Year Compliance Vault

#### STORY-22.1 — Phase A — Vault schema + snapshot capture
**Under:** EPIC-22 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:p8`

**Description:** Foundational schema (`compliance_snapshots`, `retention_ledger`, `snapshot_schedules`) and the snapshot-capture pipeline.

**Acceptance Criteria:**
- Tables present in `pool.ts initDb()`.
- A manual snapshot can be created.

**Sources:** P8 Phase A commits.

---

#### STORY-22.2 — Phase B — Hybrid-signed manifest
**Under:** EPIC-22 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:p8`

**Description:** Snapshot ZIP carries an Ed25519 `.sig` and ML-DSA-65 `.sig.mldsa` next to it (see EPIC-10 STORY-10.3).

**Acceptance Criteria:**
- Both signature files exist next to each snapshot ZIP.

**Sources:** P8 Phase B commits; WS2 hybrid-signing dependency.

---

#### STORY-22.3 — Phase C — Anti-tamper hash chain
**Under:** EPIC-22 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:p8`, `verified-by:vitest`

**Description:** `retention_ledger.previous_hash` chains each row to the previous. A verification job walks the chain and reports broken links.

**Acceptance Criteria:**
- `routes/retention-ledger.test.ts` covers the chain verification.

**Sources:** P8 Phase C commits.

---

#### STORY-22.4 — Phase D — Scheduled snapshots
**Under:** EPIC-22 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:p8`, `verified-by:vitest`

**Description:** `snapshot_schedules` table + scheduler runs nightly to take snapshots per active product.

**Acceptance Criteria:**
- `routes/snapshot-schedule.test.ts` passes.

**Sources:** P8 Phase D commits.

---

#### STORY-22.5 — Phase E — Re-verification job
**Under:** EPIC-22 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:p8`

**Description:** Periodic re-verification of each snapshot — re-compute the hash, re-verify the signature, re-verify the RFC3161 token. Records the result.

**Acceptance Criteria:**
- Re-verification job runs on schedule; result stored on `retention_ledger`.

**Sources:** P8 Phase E commits.

---

#### STORY-22.6 — Phase F — Customer-facing retention ledger view
**Under:** EPIC-22 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:p8`

**Description:** Read-only customer view of the retention ledger — every snapshot, when it was taken, when last re-verified, hash-chain status.

**Acceptance Criteria:**
- Retention-ledger view renders for a product with snapshots.

**Sources:** P8 Phase F commits.

---

#### STORY-22.7 — Phase G — Admin retention-ledger view + integrity warnings
**Under:** EPIC-22 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:admin`, `tier:p8`, `verified-by:vitest`

**Description:** Admin-side view across all orgs, with orphan + hash-chain integrity warnings.

**Acceptance Criteria:**
- `routes/admin-retention-ledger.test.ts` passes.

**Sources:** P8 Phase G commits.

---

#### STORY-22.8 — Funding run (one-off backfill)
**Under:** EPIC-22 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:p8`

**Description:** One-off script to backfill missing snapshots for active products that pre-date the vault.

**Acceptance Criteria:**
- Funding-run script in `scripts/` produces backfilled rows.

**Sources:** P8 funding-run commits.

---

#### STORY-22.9 — Auto-extend policy
**Under:** EPIC-22 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:p8`

**Description:** Retention end-date auto-extends if a product is still active when the scheduled end approaches. Prevents loss of evidence for live products.

**Acceptance Criteria:**
- Auto-extend logic verified by a fixture product approaching its scheduled end.

**Sources:** P8 auto-extend commits.

---

### Stories under EPIC-23 — P9 Public Conformity Assessments

#### STORY-23.1 — CRA self-assessment
**Under:** EPIC-23 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `regulation:cra`, `tier:p9`, `verified-by:vitest`

**Description:** Public CRA self-assessment wizard on the welcome site. Walks the user through product details + supply chain + obligations to produce a CRA-readiness score + recommendations.

**Acceptance Criteria:**
- `routes/conformity-assessment.test.ts` covers CRA assessment.
- Welcome-site `/conformity/cra` route renders the wizard.

**Sources:** P9 CRA-assessment commits.

---

#### STORY-23.2 — NIS2 self-assessment
**Under:** EPIC-23 | **Status:** Done | **Labels:** `methodology-retrospective`, `regulation:nis2`, `tier:p9`

**Description:** NIS2 self-assessment for in-scope entities. Same wizard pattern as CRA.

**Acceptance Criteria:**
- `/conformity/nis2` route renders the wizard.

**Sources:** P9 NIS2-assessment commits.

---

#### STORY-23.3 — Importer Art. 18 assessment
**Under:** EPIC-23 | **Status:** Done | **Labels:** `methodology-retrospective`, `regulation:cra`, `tier:p9`

**Description:** Importer-specific assessment per CRA Art. 18 — verifies the manufacturer is CRA-compliant, distributor obligations, importer obligations.

**Acceptance Criteria:**
- `/conformity/importer` route renders the wizard.

**Sources:** P9 importer-assessment commits.

---

#### STORY-23.4 — PQC readiness assessment
**Under:** EPIC-23 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:p9`

**Description:** Post-quantum-cryptography readiness wizard. Captures crypto-inventory inputs, classifies against NIST PQC standards, gives readiness score.

**Acceptance Criteria:**
- `/conformity/pqc` route renders the wizard.
- PQC assessment page carries the "practises what it preaches" trust banner.

**Sources:** P9 PQC-assessment commits.

---

#### STORY-23.5 — Verified emails cross-system + 12 growth funnels
**Under:** EPIC-23 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:auth`, `tier:p9`

**Description:** `verified_emails` table (90-day TTL, source-tracked per flow) on the welcome site. `welcome/lib/verified-emails.js → isEmailVerified()` checks the welcome-site DB plus the main-app `users.email_verified`. Main-app verified users are auto-recognised on the welcome site without re-verifying. All 6 flows updated: CRA / NIS2 / Importer / PQC assessments + contact form + subscribe. `/send-code` returns `{ alreadyVerified: true }` → frontend skips code entry. `/verify` accepts `skipCode: true` with server-side re-validation. No enumeration vector; disposable emails excluded; 90-day refresh on each verification.

**Acceptance Criteria:**
- 6 welcome-site flows bypass code entry for already-verified emails.
- `verified_emails` table populated cross-flow.

**Sources:** Session 59 verified-emails commits.

---

#### STORY-23.6 — Assessment landing page + launch list subscription
**Under:** EPIC-23 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`, `tier:p9`

**Description:** Dedicated assessment landing page with social-share previews + launch-list subscription form. 12 growth funnels measured end-to-end.

**Acceptance Criteria:**
- Landing page renders with social-share OG / Twitter tags.
- Launch-list signup writes to `welcome_leads` (or equivalent).

**Sources:** P9 landing-page + launch-list commits.

---

### Stories under EPIC-24 — P10 Automated Article 14 Trigger Engine

#### STORY-24.1 — P10a-1 — KEV + EPSS ingestion foundation
**Under:** EPIC-24 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:vuln`, `tier:p10`

**Description:** Scheduled ingestion of the CISA Known-Exploited-Vulnerabilities (KEV) catalogue and the FIRST EPSS exploitation-probability feed. Refresh schedule + persistence in `kev_catalogue`, `epss_scores` tables.

**Acceptance Criteria:**
- `services/threat-intel.test.ts` covers ingestion + refresh.
- `kev_catalogue` populated after a scheduled refresh.

**Sources:** P10a-1 commits.

---

#### STORY-24.2 — P10a-2 — Scanner enriches findings with KEV / EPSS
**Under:** EPIC-24 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:vuln`, `tier:p10`

**Description:** At scan time, each finding is joined to KEV + EPSS state; result attached to the finding row.

**Acceptance Criteria:**
- Finding rows expose `kev: bool`, `epss_score: float`, `epss_percentile: float`.

**Sources:** P10a-2 commits.

---

#### STORY-24.3 — P10a-3 — KEV/EPSS-driven severity prioritisation
**Under:** EPIC-24 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:vuln`, `tier:p10`

**Description:** Scanner output prioritises findings by KEV+EPSS state — an EPSS-high finding outranks a high-CVSS finding with no exploitation signal.

**Acceptance Criteria:**
- Sort order on risk-findings page reflects KEV-first, EPSS-percentile-desc, CVSS-desc.

**Sources:** P10a-3 commits.

---

#### STORY-24.4 — P10a-4 — UI surfacing for KEV / actively-exploited / EPSS percentile
**Under:** EPIC-24 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:vuln`, `tier:p10`

**Description:** KEV badge, actively-exploited chip, EPSS percentile shown on findings views.

**Acceptance Criteria:**
- Risk-findings table renders KEV badge + EPSS percentile column.

**Sources:** P10a-4 commits.

---

#### STORY-24.5 — P10a-5 — `cra_reports.actively_exploited` auto-flag
**Under:** EPIC-24 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `regulation:cra`, `tier:p10`

**Description:** `cra_reports.actively_exploited` boolean column auto-derived from KEV / EPSS state on insert.

**Acceptance Criteria:**
- `cra_reports.actively_exploited` populated on report creation from finding.

**Sources:** P10a-5 commits.

---

#### STORY-24.6 — P10b-1 — Automated Art. 14 trigger
**Under:** EPIC-24 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `regulation:cra`, `tier:p10`, `verified-by:vitest`

**Description:** When an actively-exploited vuln is detected on a regulated product, Art. 14 is auto-triggered: `cra_reports` row created with `awareness_at = NOW()`, stakeholders notified, 24h deadline track started.

**Acceptance Criteria:**
- `services/cra-trigger-engine.test.ts` passes.
- `cra_reports` row created automatically; verification by integration test.

**Sources:** Commit `949aef2` (2026-05-06 09:34).

---

#### STORY-24.7 — P10b-2 — RFC3161 timestamp on awareness moment
**Under:** EPIC-24 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `tier:p10`, `verified-by:vitest`

**Description:** Auto-triggered reports carry an RFC3161 token attesting the `awareness_at` moment — so the 24h clock has an independent witness.

**Acceptance Criteria:**
- `cra_reports.awareness_rfc3161_token` populated on auto-trigger.

**Sources:** Commit `b8441c0` (2026-05-06 09:42).

---

#### STORY-24.8 — P10c — Per-product regulatory state view
**Under:** EPIC-24 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `tier:p10`

**Description:** Per-product "regulatory state" view surfacing the active CRA Art. 14 deadline track (24h / 72h / 14d) with live countdown chips. (Covered in EPIC-08 STORY-08.3 from the report-flow side; this is the dedicated regulatory-state surface.)

**Acceptance Criteria:**
- `services/regulatory-state.test.ts` passes.

**Sources:** Commit `fe1ba49` (2026-05-06 10:13).

---

#### STORY-24.9 — P10d — Submit-with-authorisation + RFC3161 on stage submit
**Under:** EPIC-24 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `tier:p10`, `verified-by:vitest`

**Description:** On each stage submit (early / notification / final), capture authorising-user attestation + co-store an RFC3161 token. (Covered in EPIC-08 STORY-08.2.)

**Acceptance Criteria:**
- `services/submission-attestation.test.ts` passes.

**Sources:** Commit `290d85f` (2026-05-06 10:29).

---

### Stories under EPIC-25 — Post-Market Monitoring (#46)

#### STORY-25.1 — Phase 1 — Field-issue intake + schema
**Under:** EPIC-25 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `regulation:cra`, `tier:standalone`, `verified-by:vitest`

**Description:** Foundational schema (`field_issues` table with `(org_id, product_id, status, classified_as)`), intake endpoint, and basic UI for capturing field-reported issues against a product.

**Acceptance Criteria:**
- `routes/field-issues.test.ts` passes (Phase 1 tests).
- `field_issues` table present in `pool.ts initDb()`.

**Sources:** #46 Phase 1 commits.

---

#### STORY-25.2 — Phase 2 — Classification (incident / non-incident)
**Under:** EPIC-25 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `tier:standalone`, `verified-by:vitest`

**Description:** Field issues are classified as incident-relevant (requiring CRA Art. 14 attention) or non-incident (quality / UX / feature). Classification drives the workflow.

**Acceptance Criteria:**
- `routes/field-issues.test.ts` covers classification transitions.

**Sources:** #46 Phase 2 commits.

---

#### STORY-25.3 — Phase 3 — Product / version correlation
**Under:** EPIC-25 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `tier:standalone`, `verified-by:vitest`

**Description:** Each field issue is correlated to a specific product + version + SBOM snapshot — so a vuln-pattern in the issue can be matched against the dependency tree.

**Acceptance Criteria:**
- `field_issues` row links to `product_id`, `version`, and a snapshot.

**Sources:** #46 Phase 3 commits.

---

#### STORY-25.4 — Phase 4 — Status workflow + CRA-report link
**Under:** EPIC-25 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `regulation:cra`, `tier:standalone`, `verified-by:vitest`

**Description:** Full workflow (open / triaging / classified / linked-to-cra-report / closed). Incident-classified issues can be promoted to a CRA Art. 14 report (`POST /api/field-issues/:id/promote-to-cra-report`).

**Acceptance Criteria:**
- 33 tests pass in `routes/field-issues.test.ts`.
- Promote-to-CRA-report flow verified.

**Sources:** #46 Phase 4 commits.

---

### Stories under EPIC-26 — Notified Body Directory (#48)

#### STORY-26.1 — Phase 1 — Directory seed + schema
**Under:** EPIC-26 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `regulation:cra`, `tier:standalone`, `verified-by:vitest`

**Description:** `notified_bodies` table seeded from the EU register. Fields: NB number, name, country, scope, contact.

**Acceptance Criteria:**
- `routes/notified-bodies.test.ts` passes.
- Seed data present (verified by row count > 0 on a fresh `pool.ts initDb()`).

**Sources:** #48 Phase 1 commits.

---

#### STORY-26.2 — Phase 2 — Per-product assessment record
**Under:** EPIC-26 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `tier:standalone`, `verified-by:vitest`

**Description:** `nb_assessments` table tracks per-product applications: which NB, application date, application reference, status, milestones, correspondence.

**Acceptance Criteria:**
- `routes/nb-assessment.test.ts` passes.

**Sources:** #48 Phase 2 commits.

---

#### STORY-26.3 — Phase 3 — Milestones + correspondence
**Under:** EPIC-26 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `tier:standalone`, `verified-by:vitest`

**Description:** Per-assessment milestones (submitted / accepted / pre-audit / audit / certificate-issued / certificate-renewed) + correspondence log (date / from / to / subject / body / attachment).

**Acceptance Criteria:**
- `nb_assessments.milestones` + `nb_correspondence` populated.

**Sources:** #48 Phase 3 commits.

---

#### STORY-26.4 — Phase 4 — Outcome storage + UI
**Under:** EPIC-26 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `tier:standalone`, `verified-by:vitest`

**Description:** Final assessment outcome stored (certificate / decision / expiry / scope-limitations). UI page per product showing chosen NB + assessment timeline.

**Acceptance Criteria:**
- 54 tests pass across `routes/notified-bodies.test.ts` + `routes/nb-assessment.test.ts`.
- UI surfaces the timeline + outcome.

**Sources:** #48 Phase 4 commits.

---

### Stories under EPIC-27 — Market Surveillance Registration Art. 20 (#49)

#### STORY-27.1 — Phase 1 — Registration schema + Member State directory
**Under:** EPIC-27 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `regulation:cra`, `tier:standalone`, `verified-by:vitest`

**Description:** `market_surveillance_registrations` schema with per-org + per-jurisdiction rows. Directory of EU Member State market-surveillance contact points and Single Points of Contact (SPOC).

**Acceptance Criteria:**
- `routes/market-surveillance.test.ts` passes.

**Sources:** #49 Phase 1 commits.

---

#### STORY-27.2 — Phase 2 — Per-jurisdiction registration
**Under:** EPIC-27 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `tier:standalone`, `verified-by:vitest`

**Description:** Register the manufacturer in each Member State where they market a product. Stores reference, contact, jurisdiction, status (`pending` / `confirmed` / `rejected`).

**Acceptance Criteria:**
- `routes/ms-registration.test.ts` passes.

**Sources:** #49 Phase 2 commits.

---

#### STORY-27.3 — Phase 3 — Status workflow + correspondence
**Under:** EPIC-27 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `tier:standalone`, `verified-by:vitest`

**Description:** Status transitions + correspondence log per jurisdiction. Renewals flagged when status approaches expiry.

**Acceptance Criteria:**
- Renewal flag triggers a notification.

**Sources:** #49 Phase 3 commits.

---

#### STORY-27.4 — Phase 4 — UI + cross-product overview
**Under:** EPIC-27 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `tier:standalone`, `verified-by:vitest`

**Description:** Per-product UI page; cross-product matrix showing per-jurisdiction registration status across all products.

**Acceptance Criteria:**
- 40 tests pass across `routes/market-surveillance.test.ts` + `routes/ms-registration.test.ts`.

**Sources:** #49 Phase 4 commits.

---

### Stories under EPIC-28 — Supply Chain Risk Assessment NIS2 Art. 21 (#51)

#### STORY-28.1 — Phase 1 — Supplier registry + schema
**Under:** EPIC-28 | **Status:** Done | **Labels:** `methodology-retrospective`, `regulation:nis2`, `tier:standalone`, `verified-by:vitest`

**Description:** Per-org supplier registry; each supplier has name + product/service + criticality + contact + last-assessed date.

**Acceptance Criteria:**
- `routes/supply-chain-risk.test.ts` passes.
- `suppliers` (or equivalent) table present.

**Sources:** #51 Phase 1 commits.

---

#### STORY-28.2 — Phase 2 — Criticality classification
**Under:** EPIC-28 | **Status:** Done | **Labels:** `methodology-retrospective`, `regulation:nis2`, `tier:standalone`, `verified-by:vitest`

**Description:** Classify each supplier by criticality (`critical` / `important` / `standard`) and store the rationale.

**Acceptance Criteria:**
- Criticality field + rationale required on save.

**Sources:** #51 Phase 2 commits.

---

#### STORY-28.3 — Phase 3 — Risk-treatment log
**Under:** EPIC-28 | **Status:** Done | **Labels:** `methodology-retrospective`, `regulation:nis2`, `tier:standalone`, `verified-by:vitest`

**Description:** Per-supplier risk-treatment entries: identified risk, treatment (accept / mitigate / transfer / avoid), owner, due date, status.

**Acceptance Criteria:**
- Risk-treatment log visible per supplier.

**Sources:** #51 Phase 3 commits.

---

#### STORY-28.4 — Phase 4 — Evidence attachment + report export
**Under:** EPIC-28 | **Status:** Done | **Labels:** `methodology-retrospective`, `regulation:nis2`, `tier:standalone`, `verified-by:vitest`

**Description:** Attach supporting evidence per supplier / treatment. Report export (Markdown) for the supply-chain risk register.

**Acceptance Criteria:**
- 8 tests pass in `routes/supply-chain-risk.test.ts`.

**Sources:** #51 Phase 4 commits.

---

### Stories under EPIC-29 — Internal Incident Lifecycle (#52)

#### STORY-29.1 — Phase 1 — Incident schema + intake
**Under:** EPIC-29 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:standalone`, `verified-by:vitest`

**Description:** `incidents` schema; intake endpoint. Distinct from external CRA Art. 14 reporting — this is the org-internal record.

**Acceptance Criteria:**
- `routes/incidents.test.ts` passes.

**Sources:** #52 Phase 1 commits.

---

#### STORY-29.2 — Phase 2 — Workflow stages
**Under:** EPIC-29 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:standalone`, `verified-by:vitest`

**Description:** Stages: detect → contain → eradicate → recover → post-mortem. Each stage has owner, started_at, completed_at, summary.

**Acceptance Criteria:**
- Stage transitions enforced (cannot recover before contain).

**Sources:** #52 Phase 2 commits.

---

#### STORY-29.3 — Phase 3 — RACI + evidence attachments
**Under:** EPIC-29 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:standalone`, `verified-by:vitest`

**Description:** RACI assignments per incident; evidence attachments per stage; `incident_responders` join table.

**Acceptance Criteria:**
- RACI roles selectable from a per-org list.

**Sources:** #52 Phase 3 commits.

---

#### STORY-29.4 — Phase 4 — Timeline export
**Under:** EPIC-29 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:standalone`, `verified-by:vitest`

**Description:** Final incident timeline export (Markdown). Help guide `ch6_05` ("Incident Lifecycle") rewritten with Beck-map route.

**Acceptance Criteria:**
- 33 tests pass in `routes/incidents.test.ts`.
- `ch6_05` help guide complete.

**Sources:** #52 Phase 4 commits; session 58 help-guide rewrite.

---

### Stories under EPIC-30 — Cryptographic Standards & Quantum Readiness (#53)

#### STORY-30.1 — Phase 1 — Algorithm + library registry
**Under:** EPIC-30 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:standalone`, `verified-by:vitest`

**Description:** `crypto_algorithms` + `crypto_libraries` registries seeded with deprecation classification per algorithm (RSA-1024 deprecated, SHA-1 deprecated, etc.) and NIST PQC standards (ML-DSA, ML-KEM, SLH-DSA).

**Acceptance Criteria:**
- `services/crypto-inventory.test.ts` covers algorithm + library registry.
- Registries seeded.

**Sources:** #53 Phase 1 commits.

---

#### STORY-30.2 — Phase 2 — Per-product crypto-inventory entries
**Under:** EPIC-30 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:standalone`, `verified-by:vitest`

**Description:** Log every crypto library / algorithm / use-case in a product to `crypto_inventory_entries`. UI lets a contributor add entries against their product.

**Acceptance Criteria:**
- `routes/crypto-inventory.test.ts` passes.

**Sources:** #53 Phase 2 commits.

---

#### STORY-30.3 — Phase 3 — PQC readiness classification
**Under:** EPIC-30 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:standalone`, `verified-by:vitest`

**Description:** Each entry classified against PQC readiness: PQC-ready / classical-but-secure / deprecated. Inventory page shows readiness score per product.

**Acceptance Criteria:**
- Readiness score computed deterministically.

**Sources:** #53 Phase 3 commits.

---

#### STORY-30.4 — Phase 4 — Report + admin registry edit
**Under:** EPIC-30 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:standalone`, `verified-by:vitest`

**Description:** Markdown report export per product; admin can edit registries via `/admin/crypto-inventory`. Help guide `ch6_04` uses CRANIS2 itself as the real-world PQC implementation example.

**Acceptance Criteria:**
- Report generates with full inventory + readiness summary.

**Sources:** #53 Phase 4 commits.

---

### Stories under EPIC-31 — Trusted Open Source & Non-Profit Access (#58)

#### STORY-31.1 — Phase 1 — Verification schema
**Under:** EPIC-31 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:standalone`, `verified-by:vitest`

**Description:** `nonprofit_verifications` + `trusted_oss_orgs` tables; verification status lifecycle (`requested` / `under_review` / `approved` / `rejected` / `revoked`).

**Acceptance Criteria:**
- `routes/nonprofit-verification.test.ts` passes.

**Sources:** #58 Phase 1 commits.

---

#### STORY-31.2 — Phase 2 — Application + evidence intake
**Under:** EPIC-31 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:standalone`, `verified-by:vitest`

**Description:** Self-service application; OSS-maintainer evidence (GitHub org link, OSS-stewardship attestation); non-profit evidence (charity register lookup).

**Acceptance Criteria:**
- Application form captures all evidence fields.

**Sources:** #58 Phase 2 commits.

---

#### STORY-31.3 — Phase 3 — Admin review
**Under:** EPIC-31 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:admin`, `tier:standalone`, `verified-by:vitest`

**Description:** Admin can approve / reject / revoke + audit-log the decision with reason.

**Acceptance Criteria:**
- Approve / reject endpoints gated by `requirePlatformAdmin`.

**Sources:** #58 Phase 3 commits.

---

#### STORY-31.4 — Phase 4 — Free-access billing entitlement
**Under:** EPIC-31 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:billing`, `tier:standalone`, `verified-by:vitest`

**Description:** Approved orgs receive a free-access entitlement that overrides the contributor-based billing. Billing gate honours the entitlement.

**Acceptance Criteria:**
- Approved org bypasses billing gate.

**Sources:** #58 Phase 4 commits.

---

#### STORY-31.5 — Phase 5 — Renewal cadence
**Under:** EPIC-31 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:standalone`, `verified-by:vitest`

**Description:** Annual renewal — re-verify evidence; notify org 30 days before expiry.

**Acceptance Criteria:**
- Renewal-due notification fires 30 days before expiry.

**Sources:** #58 Phase 5 commits.

---

#### STORY-31.6 — Phase 6 — UI + tests
**Under:** EPIC-31 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:standalone`, `verified-by:vitest`

**Description:** Customer-facing application UI + admin review UI. 33 tests pass.

**Acceptance Criteria:**
- 33 tests pass in `routes/nonprofit-verification.test.ts`.

**Sources:** #58 Phase 6 commits.

---

### Stories under EPIC-32 — Software Evidence Engine (SEE)

#### STORY-32.1 — Phase A — Consent model + LOC + effort/cost + exec report
**Under:** EPIC-32 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:see`, `verified-by:vitest`

**Description:** Source-code-read-only consent model; LOC estimation; effort-and-cost calculation; executive report. Recalibration of productivity + complexity coefficients in Session 52.

**Acceptance Criteria:**
- `services/see-estimator.test.ts` covers file classification + language detection + LOC counting + report generation.
- Source code never persisted (audited).

**Sources:** SEE Phase A commits (Session 52).

---

#### STORY-32.2 — Phase B — Paginated commit-history ingestion + dev attribution
**Under:** EPIC-32 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:see`, `verified-by:vitest`

**Description:** Paginated, incremental commit-history ingestion (handles repos with 100K+ commits). Developer attribution with Neo4j `Developer` + `AUTHORED` edges.

**Acceptance Criteria:**
- Ingestion resumes from last cursor on re-run.

**Sources:** SEE Phase B commits.

---

#### STORY-32.3 — Phase C — Branch analysis + 9-type commit classifier + rewrite ratio
**Under:** EPIC-32 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:see`, `verified-by:vitest`

**Description:** Branch analysis (long-lived / short-lived / merged / abandoned); deterministic commit classifier with 9 types (feature / fix / refactor / docs / test / chore / spike / merge / wip); rewrite ratio per file.

**Acceptance Criteria:**
- `services/see-classifier.test.ts` covers all 9 classification types deterministically.

**Sources:** SEE Phase C commits.

---

#### STORY-32.4 — Phase D — Experimentation detection + R&D evidence report
**Under:** EPIC-32 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:see`, `verified-by:vitest`

**Description:** Five experimentation-detection algorithms: refactoring waves, prototype branches, rapid iteration, high rewrite, fix-after-feature. R&D evidence report generator with SHA-256 hashing. (Originally framed as R&D Tax Relief evidence; reframed as IP-provenance / due-diligence / knowledge-transfer evidence in Session 63.)

**Acceptance Criteria:**
- All 5 algorithms have positive + negative test cases.

**Sources:** SEE Phase D commits.

---

#### STORY-32.5 — Phase E — Architecture evolution + test evolution + module inference
**Under:** EPIC-32 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:see`, `verified-by:vitest`

**Description:** Detect architecture-evolution events (restructuring, migrations, API changes, decomposition); test-evolution tracking; module inference with `SEEModule` Neo4j nodes.

**Acceptance Criteria:**
- `SEEModule` nodes link to existing Product / Dependency / Contributor graph.

**Sources:** SEE Phase E commits.

---

#### STORY-32.6 — Phase F — Evidence-graph builder + provenance queries
**Under:** EPIC-32 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:see`

**Description:** Evidence-graph builder linking SEE outputs to existing CRANIS2 data (Product / Dependency / Vulnerability / Obligation). 5 provenance query types; graph-summary report with completeness assessment.

**Acceptance Criteria:**
- 5 provenance queries return non-empty results on a populated test fixture.

**Sources:** SEE Phase F commits.

---

#### STORY-32.7 — Phase G — Multi-regulation reports + immutable storage
**Under:** EPIC-32 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:see`

**Description:** Report types: CRA, NIS2, AI Act, DORA, ISO 27001, R&D-evidence. Report-type registry; immutable storage with hash chain.

**Acceptance Criteria:**
- Each report type generates with content + hash.
- Reports immutable post-write.

**Sources:** SEE Phase G commits.

---

#### STORY-32.8 — Phase H — Session capture + competence profiling + Claude Code hooks
**Under:** EPIC-32 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:see`, `verified-by:vitest`

**Description:** Session-capture API (start / record / end); competence profiling with 10 domains, industry reference detection, decision-quality assessment, competence level inference; Claude Code hooks config generator. Session 54 rewrite: fixed event name `session_end` → `SessionEnd` (PascalCase); explicit sourcing of `.claude/.env`; rewrote stdin handling to parse JSON metadata for `transcript_path`; reads JSONL transcript and converts to Markdown; extracts tool usage from assistant content blocks; tested end-to-end against a real 688-line transcript.

**Acceptance Criteria:**
- `services/see-session.test.ts` covers domain detection + industry refs + competence levels.
- `tools/session-capture/setup-hooks.sh` generates correct hook config (PascalCase event names).

**Sources:** SEE Phase H commits (Session 52) + session-capture rewrite (Session 54).

---

### Stories under EPIC-33 — Help Guide System Overhaul

#### STORY-33.1 — Help Guide Standard v1
**Under:** EPIC-33 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** First-pass written Standard for the in-app help guide system: file structure, station / route grammar, voice, length, embedded media rules.

**Acceptance Criteria:**
- `docs/HELP-GUIDE-STANDARD.md` exists at repo root.

**Sources:** Session 51 help-guide standard commit.

---

#### STORY-33.2 — Help Guide Review audit (all 48 files)
**Under:** EPIC-33 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** Audit of every existing help-guide file against the new Standard — identifies what's compliant, what needs fixing, what's a stub.

**Acceptance Criteria:**
- `docs/HELP-GUIDE-REVIEW.md` covers all 48 files.

**Sources:** Session 51 help-guide review commit.

---

#### STORY-33.3 — Beck Map Design Spec
**Under:** EPIC-33 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** Visual-navigation design specification — the "tube map" pattern that gives each guide a route diagram with stations.

**Acceptance Criteria:**
- `docs/BECK-MAP-DESIGN-SPEC.md` exists.

**Sources:** Session 51 Beck Map design spec commit.

---

#### STORY-33.4 — Apply Standard to 30 real-content files
**Under:** EPIC-33 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** Mechanical + editorial application of the Standard to all 30 files that hold real content (the remaining 18 are stubs).

**Acceptance Criteria:**
- 30 files match the Standard at HEAD (verified by audit).

**Sources:** Session 51 application commits.

---

#### STORY-33.5 — Trial feature claim corrections (4 files + SEO)
**Under:** EPIC-33 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** Corrected over-claims about trial-period features in 4 help-guide files + SEO meta-config; removed claims that didn't reflect what shipped.

**Acceptance Criteria:**
- `grep -r "trial-period feature" frontend/public/help` returns expected matches only.

**Sources:** Session 51 trial-claims fix commits.

---

#### STORY-33.6 — Remove Previous/Next navigation from all 48 files
**Under:** EPIC-33 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** Linear Prev/Next nav incentivised "next-button reading" instead of route-based discovery via the Beck map. Removed across all 48 files; navigation now lives in the Beck map.

**Acceptance Criteria:**
- `grep -r "Previous" frontend/public/help` finds no navigation usages.

**Sources:** Session 51 nav-removal commits.

---

#### STORY-33.7 — Iframe cache-busting on every help-panel load
**Under:** EPIC-33 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** Help-panel iframe URL carries a cache-busting query string per load so updates appear immediately without a browser cache flush.

**Acceptance Criteria:**
- `HelpPanel.tsx` appends `?v=<ts>` to iframe `src`.

**Sources:** Session 51 cache-busting commits.

---

#### STORY-33.8 — Emoji escape bugs in 20 files
**Under:** EPIC-33 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** 20 files had broken HTML entity escapes around emojis that rendered as raw entity codes. Fixed mechanically.

**Acceptance Criteria:**
- No raw HTML entity codes visible on any guide.

**Sources:** Session 51 emoji-fix commits.

---

#### STORY-33.9 — Beck Map equidistant geometry (26px row grid) across all 48 files
**Under:** EPIC-33 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** Standardised geometry: 26-px row grid; predictable interchange spacing. Visual coherence across all 48 maps.

**Acceptance Criteria:**
- Every Beck map SVG honours the 26-px row grid (verified by becksmap CLI regen).

**Sources:** Session 51 geometry commits.

---

#### STORY-33.10 — Hover-grow accessibility effect (all 48 files)
**Under:** EPIC-33 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** Hover-grow effect on stations improves discoverability for low-vision users and gives keyboard-focus an obvious visual handle.

**Acceptance Criteria:**
- Every guide's CSS includes the hover-grow rule on station elements.

**Sources:** Session 51 accessibility commits.

---

#### STORY-33.11 — Alternating label positions with interchange / feeder / edge rules
**Under:** EPIC-33 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** Label positions alternate above/below the route line; interchange stations get a fixed-side rule; feeder lines get edge-aware placement.

**Acceptance Criteria:**
- Labels don't collide on any guide (visual + becksmap regen check).

**Sources:** Session 51 label-position commits.

---

#### STORY-33.12 — becksmap CLI generator
**Under:** EPIC-33 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** CLI generator at `tools/becksmap/` produces a Beck-map SVG from a JSON definition. Examples under `tools/becksmap/examples/`.

**Acceptance Criteria:**
- `node tools/becksmap/index.js examples/ch4_05.json` regenerates the ch4_05 SVG cleanly.

**Sources:** Session 51 becksmap-CLI commits.

---

#### STORY-33.13 — Beck Map navigation guidance (YOU-ARE-HERE arrow + hint banner)
**Under:** EPIC-33 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** Amber "YOU ARE HERE" arrow positioned on opposite side from the station label (detects label position from SVG coordinates); bold dismissible hint banner (amber background, white text, close button with localStorage persistence); semi-transparent station-label backgrounds using `paint-order: stroke` so track lines remain visible through labels. All changes via `panel-overrides.css` + `HelpPanel.tsx` injection — works on all 48 existing files without regeneration. Template updated for newly generated files.

**Acceptance Criteria:**
- YOU-ARE-HERE arrow renders on a guide loaded against a deep-linked station.
- Hint banner dismissible with localStorage state.

**Sources:** Session 59 navigation-guidance commits.

---

#### STORY-33.14 — Five priority guide rewrites (ch4_05 / ch4_06 / ch4_07 / ch6_05 / ch5_06)
**Under:** EPIC-33 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** Full rewrites of the 5 highest-priority stubs: Batch Fill wizard (6 stations), AI Copilot (6 stations + admin feeder, all 5 capabilities, 3-layer architecture, token budgets), Risk Assessment / Annex I (6 stations + 2 feeders, all 13 essential requirements mapped), Incident Lifecycle, Compliance Vault. Beck-map JSON definitions added to `tools/becksmap/examples/`.

**Acceptance Criteria:**
- All 5 guides render with their full Beck-map route.

**Sources:** Session 54 (ch4_05/06/07) + session 58 (ch6_05/ch5_06) rewrites.

---

#### STORY-33.15 — SVG fixes on ch4_02 + ch1_03
**Under:** EPIC-33 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** ch4_02 (Obligations): "Open Obligations" terminus label moved above station to avoid collision with adjacent label. ch1_03 (Repository connection): OAuth + PAT branch polylines extended to reach the "Connected" station.

**Acceptance Criteria:**
- Both guides render with no label collisions / disconnected polylines.

**Sources:** Session 54 SVG-fix commits.

---

#### STORY-33.16 — `ch7_09_marketplace.html` → `ch7_09_trust_centre.html` rename
**Under:** EPIC-33 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** Help-guide file renamed as part of the codebase-wide Marketplace → Trust Centre rebrand. `HelpPanelContext` mapping updated.

**Acceptance Criteria:**
- File at `frontend/public/help/ch7_09_trust_centre.html`.
- `HelpPanelContext` maps the Trust Centre route to the new file.

**Sources:** Session 60 Trust Centre rename commits.

---

#### STORY-33.17 — Audit log help guide (ch7_11) + HelpPanelContext mapping fix
**Under:** EPIC-33 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** New `ch7_11_audit_log.html` (6 stations) created; `HelpPanelContext` mapping fixed from the incorrect `ch5_05` reference.

**Acceptance Criteria:**
- ch7_11 file exists with 6 stations.
- HelpPanelContext maps audit-log route to ch7_11.

**Sources:** Session 57 audit-log help-guide commit.

---

#### STORY-33.18 — Non-Compliance Reporting Guide (#56)
**Under:** EPIC-33 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`, `regulation:cra`, `tier:standalone`

**Description:** Help-guide content explaining how to report non-compliance under CRA. Originally tracked as standalone feature #56; lives as a help-guide entry now.

**Acceptance Criteria:**
- Help-guide file rendered in-app at the corresponding route.

**Sources:** #56 commits.

---

### Stories under EPIC-34 — Documentation Two-Audience Model

#### STORY-34.1 — `EXECUTIVE-SUMMARY.md` rewrite
**Under:** EPIC-34 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** Added SEE / session capture / competence profiling sections; split "Who Is It For?" into Admin / Contributor audiences; rewrote source-code section with read-only / never-store guarantees.

**Acceptance Criteria:**
- `docs/EXECUTIVE-SUMMARY.md` carries the two-audience split + SEE section + source-code guarantee.

**Sources:** Session 53 + Session 63 personal-ownership-rewrite commits.

---

#### STORY-34.2 — `CRANIS2-CAPABILITIES-AND-SAFEGUARDS.md` updates
**Under:** EPIC-34 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** New section 2.22 (SEE, 8 phases); updated section 4.1 (source-code handling with dual guarantees); new sections 4.5 (Cryptographic Security) + 4.6 (Infrastructure Hardening); replaced section 4.6 with four-table layout (store / SEE-consent / never-store / never-do).

**Acceptance Criteria:**
- `docs/CRANIS2-CAPABILITIES-AND-SAFEGUARDS.md` carries all four updates.

**Sources:** Session 53 + WS-documentation commits.

---

#### STORY-34.3 — Welcome site update (Contributor audience + SEE + Source Code Guarantee callout)
**Under:** EPIC-34 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** Added Contributor audience card; SEE + Session Capture capability cards; reframed Marketplace as "(Planned)"; replaced vague R&D claim with the actual SEE capability description; added source-code guarantee callout; added SEE to Pro pricing.

**Acceptance Criteria:**
- `welcome/public/index.html` carries all of the above.

**Sources:** Session 53 welcome-site commits.

---

#### STORY-34.4 — `USER-GUIDE.md` v4.0
**Under:** EPIC-34 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** Reorganised TOC into 7 audience-tagged groups; added sections 41-43 (SEE / Session Capture / Source Code Guarantee); added SEE glossary terms.

**Acceptance Criteria:**
- `docs/USER-GUIDE.md` v4.0 header; 7 audience-tagged groups visible.

**Sources:** Session 53 user-guide rewrite.

---

#### STORY-34.5 — `FAQ.md` v4.0
**Under:** EPIC-34 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** 3 new sections (SEE / Session Capture / For Development Contributors); updated source-code answers with read-only guarantee.

**Acceptance Criteria:**
- `docs/FAQ.md` v4.0 header; 3 new sections present.

**Sources:** Session 53 FAQ rewrite.

---

#### STORY-34.6 — `HELP-GUIDE-STANDARD.md` v2.0 (two-track model)
**Under:** EPIC-34 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** Two-track audience model (Admin / Contributor) replacing the 5-role model; chapter-to-track mapping; HTML audience-tag spec.

**Acceptance Criteria:**
- `docs/HELP-GUIDE-STANDARD.md` v2.0 header; two-track mapping present.

**Sources:** Session 53 standard rewrite.

---

#### STORY-34.7 — Frontend audience filter (`DocsPage` + `HelpPanelContext` + meta-config)
**Under:** EPIC-34 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** `DocsPage.tsx` exposes All/Admin/Contributor filter toggle in the TOC sidebar. `HelpPanelContext.tsx` fixed for two-tier tab detection via the `cranis2:tab-change` custom event. `ProductDetailPage.tsx` dispatches `cranis2:tab-change` after `replaceState`. `seo/meta-config.ts` updated descriptions, featureList (8 → 16), FAQ JSON-LD with the SEE Q&A.

**Acceptance Criteria:**
- DocsPage filter toggles the visible TOC.
- HelpPanelContext re-routes on tab change.

**Sources:** Session 53 frontend commits.

---

### Stories under EPIC-35 — Test Infrastructure & Hardening

#### STORY-35.1 — Isolated test stack (containers + DB + ports)
**Under:** EPIC-35 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:operational`

**Description:** Separate test stack: `backend_test` (port 3011), `neo4j_test` (HTTP 7476 / Bolt 7699), Postgres `cranis2_test` database. 5-layer safety (separate containers, separate DB, backend startup guards, test-side guards, port separation). Only starts with `--profile test`. `scripts/test-stack.sh` exposes `start` / `stop` / `run`.

**Acceptance Criteria:**
- `scripts/test-stack.sh start` brings up test stack; `stop` tears down + frees ~900 MB memory.
- Backend startup guards in `pool.ts` + `neo4j.ts` verify DB URLs match `CRANIS2_TEST_MODE` and exit on mismatch.

**Sources:** Session 56 isolated-test-stack commits.

---

#### STORY-35.2 — ~300 new tests + route coverage 86.8% → 98.5%
**Under:** EPIC-35 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Session 53 mass test-hardening pass: SEE tests (4 files, 209 tests); route-gap closure (7 files, ~50 tests for compliance-gaps / conformity-assessment / grc-bridge / risk-findings / api-keys / trello / audit); admin route tests (5 files, ~30 tests); service unit tests (crypto-inventory). Route coverage lifted from 86.8% to 98.5% (65/66 routes tested). Total tests: ~1,664 → ~1,957.

**Acceptance Criteria:**
- `routes/` coverage at 98.5% (verified by coverage report).
- ~300 new tests across the 17 test files listed.

**Sources:** Session 53 test-hardening commits.

---

#### STORY-35.3 — API-client retry on transient socket errors
**Under:** EPIC-35 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Test API client retries `UND_ERR_SOCKET` / `ECONNRESET` up to 2 times with backoff — eliminates 3-10 flaky failures per run caused by backend memory pressure under parallel load.

**Acceptance Criteria:**
- Retry logic visible in `backend/tests/helpers/api-client.ts`.
- Nightly run failure rate drops from 3-10 to 0 on transient causes.

**Sources:** Session 53 flaky-test-fix commits.

---

#### STORY-35.4 — Deterministic test IDs + `clean-rate-limits`
**Under:** EPIC-35 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Deterministic test IDs (`e0000001-...`) with `ON CONFLICT (id) DO UPDATE` so re-runs converge on the same fixtures. `globalSetup` seeds once + cleans rate limits. `clean-rate-limits.ts` cleans `copilot_usage`, duplicate findings, resets billing plans, orphan test products (Postgres + Neo4j).

**Acceptance Criteria:**
- Fresh test stack run produces deterministic IDs.
- `public-api-v1.test.ts` `afterAll` restores billing plans to standard.

**Sources:** Session 53 + Session 56 test-helpers commits.

---

#### STORY-35.5 — Nightly runner + Trello notifications
**Under:** EPIC-35 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:operational`

**Description:** `scripts/nightly-tests.sh` runs daily at 20:00 UTC (22:00 CEST). Uses isolated test stack. Logs to `logs/nightly-tests-YYYY-MM-DD.log` with 14-day retention. Posts results to Trello board `69b076fb70d3d0cf561032b7` (Passed list / Failed list).

**Acceptance Criteria:**
- Cron entry at 20:00 UTC.
- Trello card visible the morning after a run.

**Sources:** Session 58+ nightly-runner commits.

---

#### STORY-35.6 — E2E video on failure + rate-limit bypass
**Under:** EPIC-35 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`

**Description:** Playwright config records video on test failure for debugging. Rate-limit bypass mechanism for E2E runs so the suite doesn't exhaust limits.

**Acceptance Criteria:**
- Failed E2E test produces a video artefact in `e2e/test-results/`.
- Rate-limit bypass token recognised by backend in `--profile test`.

**Sources:** Session 58 visual-testing commits.

---

### Stories under EPIC-36 — WS1 Database Backup & Restore

#### STORY-36.1 — `backup-databases.sh` (Postgres + Neo4j + GFS retention)
**Under:** EPIC-36 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Postgres (cranis2 + forgejo) and Neo4j dumps; GFS retention (7 daily / 4 weekly / 3 monthly / 30-day pre-upgrade). `--pre-upgrade` flag for ad-hoc backups before risky operations. `--postgres-only` flag for fast non-Neo4j-stop backup.

**Acceptance Criteria:**
- `integration/system-scripts.test.ts` covers the script.
- Backups land in `~/cranis2/backups/<frequency>/<timestamp>/`.

**Sources:** WS1 commits.

---

#### STORY-36.2 — `restore-databases.sh` (interactive)
**Under:** EPIC-36 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Interactive restore with confirmation, safety backup before restore, health-checks after.

**Acceptance Criteria:**
- Script refuses to run without explicit confirmation; takes safety backup first.

**Sources:** WS1 commits.

---

#### STORY-36.3 — `verify-backup.sh` (weekly cron)
**Under:** EPIC-36 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Spins up temp containers, restores, validates, cleans up. Weekly cron job. Catches silently-broken backups before they're needed.

**Acceptance Criteria:**
- Script exits 0 on a valid backup, non-zero with explanation otherwise.
- Cron entry weekly.

**Sources:** WS1 commits.

---

#### STORY-36.4 — `upgrade-system.sh` (full pipeline)
**Under:** EPIC-36 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Full upgrade pipeline: pre-flight checks → backup → git pull → build → deploy → health check → auto-rollback on failure.

**Acceptance Criteria:**
- Script aborts cleanly on pre-flight failure.
- Auto-rollback triggers on health-check failure.

**Sources:** WS1 commits.

---

#### STORY-36.5 — `apply-security-patch.sh` (npm audit + auto-revert)
**Under:** EPIC-36 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** `npm audit fix` across all workspaces; runs test suite; auto-reverts on test failure.

**Acceptance Criteria:**
- Tests pass → patches stay. Tests fail → patches revert via `git restore`.

**Sources:** WS1 commits.

---

#### STORY-36.6 — `rollback-upgrade.sh` (manual rollback)
**Under:** EPIC-36 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Manual rollback by code / DB / both. Lists available rollback points (backups + git tags).

**Acceptance Criteria:**
- Script prompts for rollback scope; performs restore + git reset cleanly.

**Sources:** WS1 commits.

---

#### STORY-36.7 — `usb-storage-sync-artifacts.sh` (4-copy retention)
**Under:** EPIC-36 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`

**Description:** Copies latest DB backup to a USB-mounted volume with 4-copy retention. Provides an air-gapped recovery option independent of the dev / prod servers.

**Acceptance Criteria:**
- USB volume contains the 4 most recent backups; older ones rotated off.

**Sources:** WS1 commits.

---

#### STORY-36.8 — `backup-and-restore.md` + `upgrade-and-patching.md` runbooks
**Under:** EPIC-36 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** Two operational runbooks. `docs/backup-and-restore.md` covers the full backup / restore flow + decision tree. `docs/upgrade-and-patching.md` covers the upgrade + patching flow with decision tree.

**Acceptance Criteria:**
- Both docs exist at HEAD with the documented structure.

**Sources:** WS1 commits.

---

#### STORY-36.9 — Pre-deploy + customer-data invariants (CLAUDE.md rules 12-14)
**Under:** EPIC-36 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`

**Description:** Operating rules added to CLAUDE.md: rule 12 (pre-change backup mandatory before any prod state change), rule 13 (schema-as-code in `pool.ts initDb()` — no ad-hoc DDL), rule 14 (customer-data invariant — production updates must never drop / delete / truncate / remove FK on customer data). Backed by the WS1 toolchain.

**Acceptance Criteria:**
- CLAUDE.md rules 12-14 present at HEAD.

**Sources:** Session 62 CLAUDE.md rule commits.

---

### Stories under EPIC-37 — WS2 PQC Foundation + Hybrid Signing

#### STORY-37.1 — JWT algorithm pinning (HS256)
**Under:** EPIC-37 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Pin HS256 in both `jwt.sign()` and `jwt.verify()` — defeats `alg:none` and algorithm-confusion attacks where an attacker manipulates the JWT header to bypass signature verification.

**Acceptance Criteria:**
- `security/jwt-manipulation.test.ts` covers alg-none / RS256-confusion / HS512-confusion rejection.

**Sources:** WS2 Part 1 commit (Session 56).

---

#### STORY-37.2 — HKDF key derivation module
**Under:** EPIC-37 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** `lib/key-derivation.ts` exposes HKDF-SHA256 (RFC 5869) with purpose-specific info strings for domain separation. JWT secret derived from master `JWT_SECRET`, cached per process. Used elsewhere for versioned encryption.

**Acceptance Criteria:**
- `security/pqc-foundation.test.ts` covers HKDF outputs against RFC 5869 test vectors.

**Sources:** WS2 Part 1 commit.

---

#### STORY-37.3 — Versioned encryption (v1 legacy / v2 HKDF-derived)
**Under:** EPIC-37 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** New ciphertext format `v2:iv:tag:ciphertext` uses an HKDF-derived key. Legacy `v1:...` ciphertexts auto-detected and decrypted with the raw key (backwards-compatible read; only new writes use v2).

**Acceptance Criteria:**
- 25 tests pass in `security/pqc-foundation.test.ts`.
- Mixed v1+v2 cohabitation tested.

**Sources:** WS2 Part 1 commit.

---

#### STORY-37.4 — Node 22 → Node 24 (OpenSSL 3.5+ for ML-DSA-65)
**Under:** EPIC-37 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`

**Description:** Dockerfile base upgrade `node:22-alpine` → `node:24-alpine` to get OpenSSL 3.5+ which exposes native ML-DSA-65. Avoids a userland WASM polyfill.

**Acceptance Criteria:**
- `node --version` in container reports 24.x.
- `openssl version` reports 3.5+.

**Sources:** WS2 Part 2 commit.

---

#### STORY-37.5 — Hybrid signing (Ed25519 + ML-DSA-65)
**Under:** EPIC-37 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** `services/signing.ts` rewritten for dual signatures. `signDocument()` returns Ed25519 (64 bytes) + ML-DSA-65 (3,309 bytes). `verifyHybridSignature()` AND-logic (both must pass). Graceful degradation: falls back to Ed25519-only if `CRANIS2_SIGNING_KEY_MLDSA` unset.

**Acceptance Criteria:**
- 23 tests pass in `security/hybrid-signing.test.ts`.
- Falls back gracefully when key unset.

**Sources:** WS2 Part 2 commit.

---

#### STORY-37.6 — Snapshot signature side-cars (`.sig` + `.sig.mldsa`)
**Under:** EPIC-37 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`

**Description:** `compliance-snapshot.ts` writes both signature files alongside snapshot ZIPs. `retention-certificate.ts` carries both signatures in `CertificateResult`.

**Acceptance Criteria:**
- Both `.sig` and `.sig.mldsa` files produced next to a snapshot ZIP.

**Sources:** WS2 Part 2 commit.

---

#### STORY-37.7 — `.well-known` ML-DSA-65 key endpoint + key generator
**Under:** EPIC-37 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`

**Description:** `/.well-known/cranis2-signing-key-mldsa.pem` for third-party verification. `generate-signing-keys.sh` outputs both key pairs + base64 for `.env`.

**Acceptance Criteria:**
- Endpoint returns valid ML-DSA-65 PEM.
- Generator produces both keys in one run.

**Sources:** WS2 Part 2 commit.

---

### Stories under EPIC-38 — WS3 Security Hardening + Key Rotation

#### STORY-38.1 — DB ports bound to 127.0.0.1
**Under:** EPIC-38 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Docker compose binds Postgres, Neo4j, Forgejo ports to `127.0.0.1` only. Containers no longer reachable from the host's public interfaces.

**Acceptance Criteria:**
- `docker-compose.yml` bindings: `127.0.0.1:5433:5432`, `127.0.0.1:7475:7474`, `127.0.0.1:7688:7687`, `127.0.0.1:3003:3000`.

**Sources:** WS3 commits.

---

#### STORY-38.2 — Forgejo credentials moved to `.env` + rotated
**Under:** EPIC-38 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`

**Description:** Default Forgejo creds replaced with `.env`-sourced values; rotated as part of hardening pass.

**Acceptance Criteria:**
- `docker-compose.yml` references `FORGEJO_*` env vars; no hardcoded credentials.

**Sources:** WS3 commits.

---

#### STORY-38.3 — Auth rate limiting (no Retry-After timing leak)
**Under:** EPIC-38 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Per-category rate limits: login 5/15min, register 3/hr, verify 10/hr, invite 5/hr. `Retry-After` deliberately omitted so attackers can't probe when the window resets.

**Acceptance Criteria:**
- 29 tests pass in `security/hardening.test.ts`.
- 429 response does NOT include `Retry-After` header (asserted in test).

**Sources:** WS3 commits.

---

#### STORY-38.4 — CORS restricted to `FRONTEND_URL`
**Under:** EPIC-38 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** CORS Allowed Origin restricted to the configured `FRONTEND_URL` — was previously permissive.

**Acceptance Criteria:**
- Pre-flight from a different origin returns no CORS header.

**Sources:** WS3 commits.

---

#### STORY-38.5 — Welcome-site default credentials removed (`requireEnv`)
**Under:** EPIC-38 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`

**Description:** Welcome site code no longer carries hardcoded admin credentials. `requireEnv()` helper throws at startup if a required env var is missing.

**Acceptance Criteria:**
- `grep -r "admin@example" welcome/` returns no occurrences.

**Sources:** WS3 commits.

---

#### STORY-38.6 — npm-audit zero (all workspaces)
**Under:** EPIC-38 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`

**Description:** `npm audit` reports zero vulnerabilities across all 5 workspaces (backend / frontend / e2e / mcp / welcome). Maintained ongoing via the WS1 patching script.

**Acceptance Criteria:**
- `npm audit --workspace=backend` etc. each report 0 vulnerabilities at session-60 close.

**Sources:** WS3 + session 59 + session 60 dep-bump commits.

---

#### STORY-38.7 — `rotate-credentials.sh` (monthly)
**Under:** EPIC-38 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Monthly rotation: DB passwords, `JWT_SECRET`, welcome admin secret.

**Acceptance Criteria:**
- `security/key-rotation.test.ts` covers the rotation flow.

**Sources:** WS3 Part 2 commits.

---

#### STORY-38.8 — `rotate-encryption-key.sh` (annual, lab-based)
**Under:** EPIC-38 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Annual rotation of the master encryption key. Decrypts + re-encrypts PATs on the lab server (not prod). Lab-based operational model approved: re-encryption on the dev server, deploy during maintenance window.

**Acceptance Criteria:**
- Re-encryption runs against a backup of prod, not prod directly.

**Sources:** WS3 Part 2 commits.

---

#### STORY-38.9 — `apply-key-rotation.sh` (prod deploy of rotation package)
**Under:** EPIC-38 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`

**Description:** Production-side script applying the rotation package produced on the lab server. Runs during maintenance window.

**Acceptance Criteria:**
- Script aborts cleanly if package signature invalid.

**Sources:** WS3 Part 2 commits.

---

#### STORY-38.10 — `rotate-signing-keys.sh` + `check-rotation-age.sh`
**Under:** EPIC-38 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** `rotate-signing-keys.sh`: annual — generates new Ed25519 + ML-DSA-65, archives old public keys for verification of historical signatures. `check-rotation-age.sh`: weekly cron, warns when any rotation is overdue.

**Acceptance Criteria:**
- 41 tests pass in `security/key-rotation.test.ts`.
- Weekly cron entry for `check-rotation-age.sh`.

**Sources:** WS3 Part 2 commits.

---

#### STORY-38.11 — `key-rotation.md` runbook
**Under:** EPIC-38 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** Full operational runbook covering all rotations (credentials / encryption / signing) + the HNDL (Harvest Now, Decrypt Later) threat context.

**Acceptance Criteria:**
- `docs/key-rotation.md` exists at HEAD.

**Sources:** WS3 Part 2 docs commit.

---

### Stories under EPIC-39 — WS4 GDPR Compliance

#### STORY-39.1 — Privacy Policy (Beta) — GDPR-compliant
**Under:** EPIC-39 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:gdpr`, `regulation:gdpr`

**Description:** Comprehensive Privacy Policy from a real data audit. Covers all PII categories, sub-processors (Stripe / Resend / Anthropic / Git providers), retention periods, data-subject rights. Beta-flagged. Served at `/docs/privacy-policy`.

**Acceptance Criteria:**
- `docs/PRIVACY-POLICY.md` carries the audit-derived inventory.
- Frontend renders the doc at `/docs/privacy-policy`.

**Sources:** Session 57 GDPR commits.

---

#### STORY-39.2 — Terms of Service (Beta)
**Under:** EPIC-39 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:gdpr`

**Description:** Full Terms with beta disclaimer, AI Copilot limitations, liability cap, governing law (England & Wales).

**Acceptance Criteria:**
- `docs/TERMS-OF-SERVICE.md` at HEAD; served at `/docs/terms-of-service`.

**Sources:** Session 57 GDPR commits.

---

#### STORY-39.3 — Cookie / storage assessment (essential-only, no banner)
**Under:** EPIC-39 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:gdpr`

**Description:** Audit confirmed only essential storage: JWT (authentication) + help-panel width (UX). Documented in Privacy Policy; no consent banner needed per GDPR / ePrivacy guidance for essential-only.

**Acceptance Criteria:**
- Privacy Policy lists exactly these two storage items.

**Sources:** Session 57 GDPR commits.

---

#### STORY-39.4 — Dynamic `/docs/:slug` routing + footer links
**Under:** EPIC-39 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:gdpr`, `area:docs`

**Description:** `DocsPage.tsx` converted from hardcoded user-guide/faq to `/docs/:slug` dynamic routing. `doc_pages` seeding includes `privacy-policy` + `terms-of-service` slugs (`pool.ts docsToSeed`). Footer links added to login / signup / accept-invite / landing / docs pages.

**Acceptance Criteria:**
- `routes/docs.test.ts` covers dynamic slug routing.
- Footer links visible on all 5 listed pages.

**Sources:** Session 57 GDPR commits.

---

#### STORY-39.5 — Data export + account deletion + retention cleanup endpoints
**Under:** EPIC-39 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:gdpr`, `verified-by:vitest`

**Description:** Data export endpoint (GDPR Art. 15 / 20); account deletion endpoint (Art. 17); data-retention cleanup job (Art. 5(1)(e)). 27 tests pass.

**Acceptance Criteria:**
- `routes/account.test.ts` covers export + delete.
- `routes/admin/data-retention.ts` exposes the cleanup job.

**Sources:** Session 57 GDPR commits.

---

#### STORY-39.6 — Personal-ownership rewrite of Privacy Policy + ToS (session 63)
**Under:** EPIC-39 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:gdpr`

**Description:** Full rewrites. Data controller / operator = Andrew (Andi) MCBURNIE personally, established at La Vallée, 50150, Sourdeval, France. Generic GDPR (no UK GDPR); CNIL named as lead supervisory authority (France-resident operator). Governing law retained as England & Wales for continuity with the planned future UK NewCo. Indemnity runs to Andi personally.

**Acceptance Criteria:**
- Privacy Policy + ToS both name Andi personally as controller/operator and CNIL as lead authority.

**Sources:** Session 63 personal-ownership rewrite commits.

---

### Stories under EPIC-40 — Affiliate Programme

#### STORY-40.1 — Phase 1 — Schema + signup integration
**Under:** EPIC-40 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:billing`, `verified-by:vitest`

**Description:** `bonus_codes`, `affiliate_ledger`, `affiliates` tables. Signup-flow bonus-code validation + canonicalisation (lowercased, dashes preserved). Org billing integration: validated code applies discount.

**Acceptance Criteria:**
- `routes/auth-bonus-code.test.ts` + `routes/bonus-code.test.ts` pass.
- `users.canonicalBonusCode` populated when used.

**Sources:** Session 60 Phase 1 commits.

---

#### STORY-40.2 — Phase 2 — Admin affiliates page + ledger
**Under:** EPIC-40 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:admin`, `area:billing`, `verified-by:vitest`

**Description:** 389-line `routes/admin/affiliates.ts` router. Admin can list / create / edit affiliates; view per-affiliate ledger; add credit / debit / payout entries; generate monthly statements on demand.

**Acceptance Criteria:**
- `routes/admin-affiliates.test.ts` passes.

**Sources:** Session 60 Phase 2 commits.

---

#### STORY-40.3 — Phase 3 — Monthly statement automation
**Under:** EPIC-40 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:billing`

**Description:** 312-line monthly-statement service. Affiliate statement email template (HTML). Schedules on the 1st of each month for the previous month.

**Acceptance Criteria:**
- Statement email template renders ledger summary + balance + payout history.

**Sources:** Session 60 Phase 3 commits.

---

#### STORY-40.4 — Phase 4 — Self-service affiliate dashboard
**Under:** EPIC-40 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:billing`, `verified-by:vitest`

**Description:** 311-line `routes/affiliate.ts` + 392-line frontend page. Sidebar navigation for affiliate-flagged users. View own bonus codes, ledger entries, balance, payouts.

**Acceptance Criteria:**
- `routes/affiliate.test.ts` passes.
- Sidebar shows the Affiliate section only for users with an `affiliates` row.

**Sources:** Session 60 Phase 4 commits.

---

#### STORY-40.5 — Phase 5 — 35 Vitest tests
**Under:** EPIC-40 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:billing`, `verified-by:vitest`

**Description:** Final phase — 35 tests across `admin-affiliates` / `affiliate` / `auth-bonus-code` / `bonus-code`.

**Acceptance Criteria:**
- 35 tests pass across the 4 test files.

**Sources:** Session 60 Phase 5 commits.

---

### Stories under EPIC-41 — Production Launch (cranis2.com)

#### STORY-41.1 — Infomaniak VPS + cranis2.com domain
**Under:** EPIC-41 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:operational`

**Description:** Provisioned Infomaniak VPS (EU-sovereign); registered `cranis2.com` domain; DNS pointed to the VPS.

**Acceptance Criteria:**
- `dig cranis2.com` resolves to the VPS IP.

**Sources:** Session 62 launch commits.

---

#### STORY-41.2 — Host NGINX + Let's Encrypt TLS (auto-renew)
**Under:** EPIC-41 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:operational`

**Description:** Host-level NGINX terminates TLS with Let's Encrypt cert + systemd-timer auto-renew. Proxies into the Docker stack.

**Acceptance Criteria:**
- `https://cranis2.com` returns 200 with a valid LE cert.
- Cert auto-renew timer active (`systemctl list-timers certbot.timer`).

**Sources:** Session 62 launch commits.

---

#### STORY-41.3 — Docker stack deploy + env config
**Under:** EPIC-41 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`

**Description:** Docker stack deployed to VPS. `FRONTEND_URL` migrated to `https://cranis2.com`. `LOG_LEVEL=info`. `DEV_SKIP_EMAIL=false`. `EMAIL_FROM=info@poste.cranis2.com`.

**Acceptance Criteria:**
- `docker compose ps` shows all services running on prod.
- `.env` reflects the documented prod values.

**Sources:** Session 62 launch commits.

---

#### STORY-41.4 — Backend + welcome containers bound to 127.0.0.1 (prod-edit replay)
**Under:** EPIC-41 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`

**Description:** Backend (3001) and welcome (3004) port bindings changed to `127.0.0.1:...` only. Only NGINX publicly reachable. Originally applied directly on prod during launch; replayed in dev via commit `20980de` so dev compose matches prod.

**Acceptance Criteria:**
- `docker-compose.yml` shows `127.0.0.1:3001:3001` + `127.0.0.1:3004:3004`.

**Sources:** Commit `20980de` (2026-05-07 01:42).

---

#### STORY-41.5 — GFS backup architecture (prod) + age-encrypted dev mirror
**Under:** EPIC-41 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`

**Description:** Prod backup retention 7d / 4w / 12m via the WS1 toolchain. Dev pulls an age-encrypted mirror nightly at 03:00 UTC. Age private key escrowed on the user's keyring USB. Full procedure documented in `docs/backup-retention.md`.

**Acceptance Criteria:**
- `docs/backup-retention.md` at HEAD documents the full scheme.
- Cron entry on dev for the 03:00 UTC age-pull.

**Sources:** Session 62 backup-arch commits.

---

#### STORY-41.6 — `/welcome` → `/getting-started` rename (prod-edit replay)
**Under:** EPIC-41 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ux`

**Description:** Post-signup landing renamed `/welcome` → `/getting-started` (commit `ede802f`). Originally applied directly on prod; brought back into git so dev and prod converge. 7 frontend files + backend redirect updated. Quote style normalised.

**Acceptance Criteria:**
- All 7 frontend files use `/getting-started`.
- Backend `routes/auth.ts` redirects to `/getting-started` after verification.

**Sources:** Commit `ede802f` (2026-05-07 01:41).

---

#### STORY-41.7 — Affiliate-tables schema patch on prod
**Under:** EPIC-41 | **Status:** Done (with debt) | **Labels:** `methodology-retrospective`, `area:ops`

**Description:** Affiliate schema applied directly to prod Postgres on launch day because `pool.ts initDb()` did not yet include the affiliate tables. **Logged as job #100 — back-port to dev `pool.ts initDb()`.** This incident motivated CLAUDE.md rule 13 (schema-as-code) and SPIKE-03 (promotion process).

**Acceptance Criteria:** *(remediation tracked)*
- Affiliate tables present in `pool.ts initDb()` with idempotent guards.

**Sources:** Session 62 launch notes; `docs/scratch.md` item #100.

---

#### STORY-41.8 — Smoke test (signup → verify → getting-started)
**Under:** EPIC-41 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:operational`

**Description:** Core flow smoke-tested on production: signup → email verify → land on `/getting-started`. End-to-end working.

**Acceptance Criteria:**
- Manual prod smoke test produces a verified user landing on `/getting-started`.

**Sources:** Session 62 close notes.

---

#### STORY-41.9 — Outstanding launch tasks (user-side)
**Under:** EPIC-41 | **Status:** In Progress (user-side) | **Labels:** `methodology-retrospective`, `area:ops`

**Description:** Three outstanding user-side launch tasks tracked: DKIM verification at Resend (item #4), Stripe live keys (item #9), secret rotation pre-launch (Anthropic / Codeberg / signing key / Postgres / Forgejo admin token — exposed in conversation transcript via a `docker compose config` mishap; option B chosen 2026-04-30 to defer rotation until pre-launch). Plus ICO registration + Privacy Policy placeholder update + legal review.

**Acceptance Criteria:** *(user-side ongoing)*
- DKIM verified at Resend.
- Stripe `sk_live_*` + live webhook in prod `.env`.
- Secret rotation completed.

**Sources:** `docs/scratch.md` launch-blocker table.

---

### Stories under EPIC-42 — Ownership & Licensing Cleanup

#### STORY-42.1 — LICENSE file + SPDX identifier
**Under:** EPIC-42 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** `LICENSE` at repo root defines `LicenseRef-Cranis2-Proprietary` (CRANIS2 Proprietary Licence, Andrew (Andi) MCBURNIE, England & Wales governing law).

**Acceptance Criteria:**
- `LICENSE` exists at repo root with the named SPDX identifier.

**Sources:** Session 63 commits.

---

#### STORY-42.2 — `apply-licence-headers.sh` idempotent sweep (757 files)
**Under:** EPIC-42 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** Idempotent header-application script. Headers applied to 757 in-scope files (TS / TSX / JS / CSS / MD / HTML / SH / SQL / YAML / Dockerfile / gitignore variants); JSON files set `license` + `author` metadata fields instead (8 `package.json` files). Permission-preservation bug fixed mid-session; 25 scripts had 0755 restored.

**Acceptance Criteria:**
- Re-running the script produces zero diff.
- All 25 scripts retain 0755 after re-run.

**Sources:** Session 63 commits.

---

#### STORY-42.3 — Copyright range 2023-2026 mechanical sweep
**Under:** EPIC-42 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** Anchored to August 2023 ideation (triggered by FTI Consulting NIST assessment for SNRG, June 2023). Mechanical sweep: `© 2026` → `© 2023–2026` across 752 headed files + LICENSE + sweep-script body.

**Acceptance Criteria:**
- `grep -r "© 2026 " -- ':!evidence' ':!docs/scratch.md'` returns zero matches at HEAD.

**Sources:** Session 63 commits.

---

#### STORY-42.4 — Email standardisation to andi@mcburnie.com
**Under:** EPIC-42 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** Standardised contact email across all artefacts: `andi.mcburnie@gmail.com` → `andi@mcburnie.com`. `author` field updated in all 8 `package.json` files.

**Acceptance Criteria:**
- `grep -r "andi.mcburnie@gmail.com" -- ':!evidence'` returns only acceptable references (e.g. .env / git config).

**Sources:** Session 63 commits.

---

#### STORY-42.5 — Entity scrub (Gibbs / Loman / Cavendish)
**Under:** EPIC-42 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** Full removal of every corporate-attribution reference from 15 files. Author lines updated in `docs/SDLC.md`, `docs/LLD.md`, `docs/MARKET-PITCH.md`, `docs/scratch.md`, `RESTART.md` historical lines. AI coder framework (6 files) — owner blocks rewritten; "managing director / employees / client engagements" framing replaced with personal / framework-owner language. `docs/loman-cavendish-capabilities.md` → `docs/personal-capabilities.md` (renamed + rewritten in first-person). `docs/operations/99-succession.md` rewritten as a personal succession plan addressed to executors / heirs.

**Acceptance Criteria:**
- `grep -r "Loman\|Cavendish\|Gibbs" -- ':!evidence' ':!node_modules'` returns zero matches at HEAD.

**Sources:** Session 63 commits.

---

#### STORY-42.6 — R&D Tax Relief framing stripped + reframed
**Under:** EPIC-42 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** R&D Tax Relief framing (mapped to HMRC four-part test) removed entirely from `STANDARDS.md` and `SESSION-TEMPLATE.md` — not applicable to an individual. Underlying evidence-and-discipline value preserved and reframed as IP provenance, audit, due-diligence, and knowledge-transfer value.

**Acceptance Criteria:**
- `grep -r "HMRC" -- ':!evidence' ':!docs/scratch.md'` returns zero matches at HEAD.

**Sources:** Session 63 commits.

---

#### STORY-42.7 — Evidence locker (gitignore-binary + README index)
**Under:** EPIC-42 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** `evidence/` directory at repo root with `README.md` index. Entry #1: FTI Consulting NIST Cybersecurity Maturity Assessment for SNRG (V1.0 June 2023, V1.1 QA review) — establishes the August-2023 ideation trigger. Entry #2: personal-time engagement analysis (3 May 2026) — 33.7% of 448 commits over 71 days during Gibbs salaried hours; 66.3% outside. `.gitignore` keeps binaries (pdf / docx / xlsx / pptx / zip / image formats) local-only. The PDF binary for Entry #1 (1.83 MB, SHA-256 `204299599c650c036768364e00e99aa8a9007a03556f87f4bfa525de00b27476`) and the Entry #2 binaries live on the dev Mac Mini, never pushed.

**Acceptance Criteria:**
- `evidence/README.md` indexes Entry #1 and Entry #2.
- `evidence/.gitignore` keeps binaries local-only.

**Sources:** Session 63 commits + commit `fb39bb0` (Entry #2 add, 2026-05-07).

---

#### STORY-42.8 — Memory hygiene + rebuild prep
**Under:** EPIC-42 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** New memory files: `project_ownership.md`, `seis_strategy.md`, `rebuild_plan.md`. Scrubbed entity references from `user_profile.md`. Rebuild prep: MBP at 10.0.0.117 (Ubuntu 24.04, 16 GB, Docker 29.4); SSH alias `mbp`; project location reserved at `/home/andi/cranis2/`; port range 4xxx reserved; Forgejo on MBP planned as primary git, Codeberg secondary push-mirror.

**Acceptance Criteria:**
- Memory files present at `/home/mcburnia/.claude/projects/-home-mcburnia-cranis2/memory/`.
- MBP reachable from Mac Mini via `ssh mbp`.

**Sources:** Session 63 memory + rebuild-prep commits.

---

### Additional standalone stories (catch-all for substantive items not anchored to a phase epic above)

#### STORY-08.4 — Smart CRA deadline alerts (P1 #8)
**Under:** EPIC-08 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `regulation:cra`, `tier:p1`, `verified-by:vitest`

**Description:** Scheduled alerts as a CRA Art. 14 deadline approaches: T-12h before 24h early-warning, T-24h before 72h notification, T-72h before 14d final. Routed to stakeholders via the standard notification channels.

**Acceptance Criteria:**
- `services/alert-emails.test.ts` covers deadline-approaching emails.
- Scheduler fires the alerts at the documented offsets.

**Sources:** P1 #8 commits.

---

#### STORY-09.5 — End-of-life notification calculator (#54)
**Under:** EPIC-09 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `regulation:cra`, `tier:standalone`

**Description:** CRA Art. 13(8) end-of-support obligation helper. Calculates the customer-notice deadline for products approaching end-of-life or end-of-support and surfaces it on the product detail page. Drives obligation derivation for `end-of-support-notice` obligations.

**Acceptance Criteria:**
- Calculator visible on the product detail page when an end-of-life date is set.
- Obligation derivation reflects the calculator output.

**Sources:** #54 commits.

---

#### STORY-09.6 — EU Authorised Representative decision tree (#55)
**Under:** EPIC-09 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:cra`, `regulation:cra`, `tier:standalone`

**Description:** Interactive decision tree that walks a customer through whether they need an EU Authorised Representative (Art. 17): EU-established? Manufacturer? Distributor? Importer? OSS Steward? Drives the `authorised_representative_appointed` obligation derivation.

**Acceptance Criteria:**
- Decision tree renders and produces a deterministic recommendation given a fixed set of answers.
- Obligation derivation reflects the recommendation.

**Sources:** #55 commits.

---

#### STORY-12.6 — Dashboard heat map (P2 #11)
**Under:** EPIC-12 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `tier:p2`

**Description:** Cross-product dashboard heat map visualising CRA-readiness / risk-findings / obligation status. Coloured cells per product × dimension.

**Acceptance Criteria:**
- Heat map renders on the Dashboard for orgs with ≥1 product.

**Sources:** P2 #11 commits.

---

#### STORY-13.8 — UX tooltips pass (P1 #7)
**Under:** EPIC-13 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`, `tier:p1`

**Description:** Tooltip pass across the product detail tabs + admin panel. Plain-English explanations of CRA / NIS2 jargon on hover.

**Acceptance Criteria:**
- Tooltips visible on identified controls; copy reviewed against the editorial standard.

**Sources:** P1 #7 commits.

---

#### STORY-13.9 — In-app feedback notify support@cranis2.com (#104)
**Under:** EPIC-13 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`, `verified-by:vitest`

**Description:** Every in-app feedback / bug-report / feature-request submission triggers a Resend email to `support@cranis2.com` (configurable via `SUPPORT_NOTIFY_EMAIL`). Subject format `[CRANIS2 <CATEGORY>] <subject>` with the category uppercased and the user-supplied subject trimmed at 120 chars. HTML body: category chip + submitter (display name + email) + org name + role + plan + status + page URL + verbatim message in `<pre>` + UTC ISO + Europe/Dublin timestamps + "Open in admin panel" deep link + mailto reply. Resend's `replyTo` set to submitter so Reply addresses them directly. Non-blocking send (`.catch()`-wrapped); suppressed in `DEV_SKIP_EMAIL=true`.

**Acceptance Criteria:**
- 4 unit tests pass in `tests/services/feedback-notify.test.ts` (category casing / whitespace / 120-char truncation / boundary).
- 4 tests pass in `tests/routes/feedback.test.ts` after the notify path was added.
- `buildFeedbackEmailSubject()` exported and unit-testable independently of Resend.

**Sources:** Commit `e65a684` (2026-05-18 13:48).

---

#### STORY-02.17 — Login/Signup SSO stub cleanup (#62)
**Under:** EPIC-02 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:auth`

**Description:** Removed non-functional "Continue with GitHub" + "Sign up with GitHub" stub buttons from `LoginPage.tsx` + `SignupPage.tsx`. SSO is deferred to post-launch (#61). Visible-but-non-functional buttons are an antipattern.

**Acceptance Criteria:**
- No GitHub-SSO buttons visible on Login or Signup pages.

**Sources:** Session 59 #62 commits.

---

#### STORY-42.9 — Drop INVESTOR-PITCH.md (superseded)
**Under:** EPIC-42 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:docs`

**Description:** `INVESTOR-PITCH.md` (added 28 April) had been sitting on the working tree as an unstaged deletion across multiple sessions — superseded since 2 May by `MARKET-PITCH.md` + `EXECUTIVE-SUMMARY.md`. Staged the delete to clean up.

**Acceptance Criteria:**
- `docs/INVESTOR-PITCH.md` does not exist at HEAD.
- `docs/MARKET-PITCH.md` is the canonical market-positioning doc.

**Sources:** Commit `801f127` (2026-05-07 07:44).

---

#### STORY-35.7 — `react-is` explicit dep + lockfile dedupe
**Under:** EPIC-35 | **Status:** Done | **Labels:** `methodology-retrospective`, `area:ops`

**Description:** Added `react-is@^19.2.6` to `frontend/package.json`. `recharts` declares `react-is` as a peer dependency; newer npm does not auto-install peer deps, so the package was missing from `node_modules` and surfaced as a build/runtime gap during prod install. Adding it explicitly so dev and prod resolve the same way. Lockfile regenerated by npm — shrinks ~517 lines via dedupe.

**Acceptance Criteria:**
- `frontend/package.json` lists `react-is@^19.2.6` in `dependencies`.
- `npm install` from a clean state resolves without warnings about missing peer.

**Sources:** Commit `af2abf8` (2026-05-07 01:44).

---

## Operational notes for bulk-create

### Standard fields for every ticket
- **Project:** `CRAN`
- **Reporter:** Andi MCBURNIE
- **Status:** map to the appropriate workflow state. `Done` for the vast majority; `Won't Do` for explicitly parked items.
- **Labels:** always include `methodology-retrospective`; plus any tier / area / regulation / verified-by labels listed on the ticket.
- **Epic Link:** for stories, set to the parent epic's `CRAN-` key once the epic has been created (the bulk-create script must do epics first and capture the key map).

### Issue type mapping
- `Epic` → issue type `Epic`
- `Story` → issue type `Story`
- `Spike` → issue type `Spike`

### CRAN-29 / CRAN-30 / CRAN-31 housekeeping
- `CRAN-29` "User self-service password recovery" → transition `To Do` → `Done` (work captured in STORY-02.8).
- `CRAN-30` "User profile + account settings page" → transition `To Do` → `Done` (work captured in STORY-02.9).
- `CRAN-31` "API integration test — please ignore or delete" → delete.

### Counts (for sanity-check on bulk-create)
- Epics: **42**
- Spikes: **5**
- Stories: **291** (verified: `grep -cE '^#### STORY-' docs/CRAN-COMPLETED-IMPORT.md`)
- Total new tickets to create: **338**
- Existing tickets to transition: **2** (CRAN-29, CRAN-30)
- Existing tickets to delete: **1** (CRAN-31)
- Highest current Jira key: `CRAN-31` → first newly-created epic likely lands at `CRAN-32`

### Verification after bulk-create
1. Query `JQL: project = CRAN AND labels = "methodology-retrospective" ORDER BY key` → expect 338 results.
2. Query `JQL: project = CRAN AND status = Done AND labels = "methodology-retrospective"` → expect all shipped items in `Done`.
3. Spot-check 10 randomly-sampled stories: open them in the Jira UI and confirm Description + Acceptance Criteria match this document.
4. Hash-check: this file (`docs/CRAN-COMPLETED-IMPORT.md`) committed to the repo gives the team a stable reference to compare against the Jira-side state.


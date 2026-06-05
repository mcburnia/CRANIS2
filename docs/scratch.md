<!--
  Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi@mcburnie.com
-->

# CRANIS2 — Active Backlog

Updated: 2026-06-02 — **the live working backlog now lives in Jira `CRAN`** (`andimcburnie.atlassian.net`, board 34). Every item below is mirrored there as an agile ticket with estimates, plus 11 new business/GTM/QA/legal/ops epics (CRAN-423–479) that are Jira-native (not duplicated here). Treat Jira as the working set; this file is the narrative seed. See the `jira-cran-mirror` memory + `staging/` toolchain.

Updated: 2026-04-30 (session 62 — production deployment day)

For completed work history, see `.claude/projects/-home-mcburnia-cranis2/memory/completed_work.md`

---

## Launch Readiness Workstreams — ALL COMPLETE

| WS | Workstream | Status |
|----|-----------|--------|
| 1 | Database Backup & Restore | **COMPLETE** (session 56) |
| 2 | PQC Readiness (JWT, HKDF, hybrid signing, Node.js 24) | **COMPLETE** (session 56) |
| 3 | Security Hardening (ports, rate limiting, CORS, key rotation) | **COMPLETE** (session 56) |
| 4 | GDPR Compliance | **COMPLETE** (session 57) — Privacy Policy, ToS, data export, account deletion, retention cleanup |
| 5 | Visual Testing | **COMPLETE** (session 58) — E2E video recording, rate limit bypass |

---

## Recent Work (session 62 — production deployment)

- **Production live at `https://cranis2.com`** — TLS via Let's Encrypt (auto-renew), host nginx + Docker stack on Infomaniak VPS
- **Affiliate schema patch on prod** — DDL applied directly to prod Postgres because `pool.ts initDb()` doesn't include the affiliate tables yet (logged as job #100 — back-port to dev)
- **`/welcome` URL collision fix** — SPA post-registration page renamed to `/getting-started` (8 file edits applied directly on prod tree; back-port to dev pending)
- **Container ports tightened** — backend (3001) and welcome (3004) bound to `127.0.0.1` only on prod
- **GFS backup architecture** — 7d/4w/12m on prod; encrypted age-pull mirror to dev at 03:00 UTC. Age private key escrowed on user's keyring USB. Full procedure: `docs/backup-retention.md`
- **CLAUDE.md operating rules 12–15 added** — pre-change backup; schema in `pool.ts`; customer-data invariant; sensitive-output discipline
- **Two feedback memories saved** — `feedback_compose_config_secrets.md`, `feedback_docker_port_rebinding.md`
- **Smoke test (core flow)** — signup → email verify → land on `/getting-started` working end-to-end

## Recent Work (session 60)

- **Trust Centre rename** — Marketplace → Trust Centre across entire codebase
- **Affiliate programme** — bonus codes, admin management, self-service dashboard, monthly statements, 35 tests
- **Vulnerability remediation** — dep bumps across all 5 workspaces, 26 findings mitigated, schema drift fixed
- **4 bug fixes** — auto_resolved findings, compliance timeline live counts, CRA readiness >100%, test runner parity
- **Test suite:** 2,166 tests (121 files), 2,166 pass, 0 fail, 36 skip

---

## Launch Blockers (must-fix before go-live)

**12 of 13 resolved as of 2026-04-30. Remaining 3 are user-side config tasks.**

| # | Item | Status |
|---|------|--------|
| 1 | `FRONTEND_URL` migration — change from `dev.cranis2.dev` to production URL | **DONE** (session 62) — `https://cranis2.com` set in prod `.env` |
| 2 | Remove `/api/dev/*` routes | **DONE** |
| 3 | Remove SBOM debug logging | **DONE** (session 57) |
| 4 | DKIM verification for `poste.cranis2.com` — emails landing in spam without it | **TODO (user-side)** — verify at Resend dashboard, add DNS records at Infomaniak |
| 5 | Production infrastructure — Infomaniak hosting, `cranis2.com` domain, host NGINX + Let's Encrypt | **DONE** (session 62) |
| 6 | Privacy Policy | **DONE** (session 57) |
| 7 | Terms of Service | **DONE** (session 57) |
| 8 | Cookie consent | **DONE** (session 57) |
| 9 | Stripe production keys — switch from test mode | **TODO (user-side)** — get `sk_live_*` and live webhook from Stripe Dashboard |
| 10 | Resend production domain — verify `cranis2.com` (or `poste.cranis2.com`) | **DONE** (session 62) — `EMAIL_FROM=info@poste.cranis2.com` in prod, sending works |
| 11 | Docker Compose orphan container cleanup | **DONE** (session 57) |
| 12 | `DEV_SKIP_EMAIL` confirmed `false` in production | **DONE** (session 62) |
| 13 | Production `LOG_LEVEL` — set appropriately (not debug) | **DONE** (session 62) — `LOG_LEVEL=info` |

**Outstanding user actions:**
- DKIM verification at Resend (item 4)
- Stripe live keys (item 9)
- Secret rotation pre-launch (Anthropic API key, Codeberg client secret, Codeberg webhook secret, signing key, Postgres password, Forgejo admin token — exposed in conversation transcript via a `docker compose config` mishap; option B chosen 2026-04-30 to defer rotation until pre-launch)
- Register with ICO (ico.org.uk, £40/year), update Privacy Policy placeholder
- Legal review of Privacy Policy + Terms of Service

---

## Open Product Bugs

- [ ] **SBOM resync orphaned dependencies** — Neo4j `DEPENDS_ON` edges not pruned on resync, blocks auto-resolution of findings
- [ ] **`runProductScan()` missing `reconcileFindings()`** — per-product scans never auto-resolve stale findings
- [x] **`vulnerability_scans` schema drift** — fixed (session 60)

---

## Future — Enterprise Licensing and Managed Service Hosting

Two commercial models to explore post-launch:

### Enterprise Licensing
- On-premise or private-cloud deployment of CRANIS2 for large organisations
- Custom SLAs, dedicated support, tailored obligation sets
- Pricing model TBD — likely annual licence fee based on product/contributor count
- Considerations: deployment packaging (Docker, Kubernetes), configuration management, update delivery, data isolation guarantees

### Managed Service Hosting
- CRANIS2 hosted and operated by the platform owner on behalf of the customer
- Dedicated instance per customer (not multi-tenant shared infrastructure)
- Full data sovereignty — customer chooses hosting region (EU, UK, etc.)
- Includes backup management, patching, monitoring, and 24/7 availability
- Pricing model TBD — likely monthly fee per instance + usage-based component

**Discussion needed:** scope, pricing, infrastructure requirements, operational burden, minimum viable offering for each model.

---

## Parked (post-launch)

- **15 remaining help guide stub rewrites**
- **Service unit test depth** — only 7/71 services have unit tests. Route tests cover critical paths.
- **P4 #24/#25** — Chat ops / Slack notifications
- **P5 Supplier Trust Centre** — 7 features (#28-34), not started
- **#59 Multi-language i18n** — scope TBD
- **#61 SSO and Gmail/GitHub sign-in** — must have moving forward
- ~~#60 Bitbucket integration~~ — **DONE** (session 59). Needs OAuth consumer registration for beta partner.

## Jobs To Do

- ** 100 ensure the dev server is an accurate representation of the production server to future production updates and fixes are a smooth process.
- ** 101 create a defined process for version upgrades and security patches of cranis2 from dev to prod, this MUST be a fully documented and smoot process. I must also, under no circumstances ever delete customer data, so everything we do, MUST start with a full clean backup, that is then restored after the update delivery.
- ** 102 update all Claude operating instruction to ensure no accidents based on what we have learned throughout this development and deployment process.
- ** 103 perform a full and comprehensive resilience and security test on the production server.
- ~~** 104 feat(feedback-notify): email `support@cranis2.com` on every in-app FeedbackModal submission~~ — **DONE 2026-05-18**. `sendFeedbackNotification` in `backend/src/services/email.ts`, wired into `routes/feedback.ts`; subject `[CRANIS2 <CATEGORY>] <subject>`; body includes submitter identity + org + role + plan + trial state + page URL + verbatim message + UTC/local timestamps + admin-panel deep-link + `mailto:` reply; destination configurable via `SUPPORT_NOTIFY_EMAIL`; gated on `DEV_SKIP_EMAIL`. Deep-link points to `/admin/feedback` (the actual admin list view) rather than `/admin/users/:userId` (no such route exists).
- ** 105 feat(bitbucket-oauth): register a Bitbucket OAuth Consumer and wire it through CRANIS2 so customers can actually use the Bitbucket Connect button. Today the code path is fully implemented (`/connect-init` + `/api/repo/callback/bitbucket` in `backend/src/routes/github/oauth.ts`, provider entry in `PROVIDER_REGISTRY`) but `BITBUCKET_CLIENT_ID` / `BITBUCKET_CLIENT_SECRET` are not set in any `.env` — calling Connect Bitbucket today returns `500: Bitbucket OAuth not configured`. User-side prereq: (a) create a Bitbucket Workspace named `cranis2app` to keep brand consistency with the GitHub Org; (b) under *Workspace settings → OAuth consumers → Add consumer*, register a consumer named `CRANIS2` with callback URL `https://cranis2.com/api/repo/callback/bitbucket` and permissions `Account: read`, `Repositories: read`, `Webhooks: read and write` (write needed for auto-registration parity with GitHub). Code-side: add the new env vars to `.env.example` and `RESTART.md`; verify the existing Bitbucket call paths still work end-to-end against the real `api.bitbucket.org`; add an end-to-end "Connect Bitbucket" integration test that uses a sandbox workspace if available, else mock. Acceptance: a customer in a Bitbucket-using org can click Connect Bitbucket → see the reassurance modal → continue → see "by cranis2app" on the Bitbucket consent screen → return to CRANIS2 with a connection stored at the org level → trigger a sync. Out of scope: Bitbucket Server / Data Center (only Bitbucket Cloud). Estimated effort: ~30–45 min user-side + ~½ day code/test work.
- ** 106 feat(pat-guidance-modal): mirror the new OAuth reassurance modal (`ConnectProviderModal.tsx`) for the PAT connection form used by self-hosted providers (Forgejo / Gitea / GitLab). Different framing because the customer generates the PAT themselves on their own provider — so the guidance should explain: (a) exactly which read-only scopes to tick on their provider's PAT-generation page (per-provider — `read:user` + `read:repository` for Forgejo/Gitea; `read_api` + `read_repository` for GitLab); (b) how to scope the PAT to specific repos rather than all (recommended); (c) what CRANIS2 will do with the token (read metadata, SBOM extraction, contributor lists) and won't do (commit, push, modify, open PRs); (d) where to revoke later. Visual style matches the OAuth modal. Triggered when the customer clicks the "Connect Self-Hosted Provider (PAT)" button on `/repositories`; sits in front of (not replacing) the existing PAT entry form. Same admin-only gating as the existing PAT form. Tests: unit on the per-provider copy mapping, integration that the modal renders on Connect-PAT click. Out of scope: actually validating the PAT's scopes before storing (separate item — would require an extra API call per provider). Estimated effort: small (~½ day).
- ~~** 107 feat(admin-panel-delete): expose user-deletion and organisation-deletion in the platform-admin panel UI~~ — **DONE 2026-05-18**. Both AdminUsersPage and AdminOrgsPage already had wired Delete buttons inside the kebab menu; rather than build new endpoints, this iteration was a hardening pass: (a) moved Delete OUT of the kebab into a dedicated red row-level icon-button so destructive actions are always visible — never tucked under "more"; (b) added typed-confirmation modal that requires typing the exact email or organisation name to enable the Delete button (case-insensitive for emails, exact for org names); (c) added a danger banner at the top of the modal ("Permanent deletion — this cannot be undone") + an explicit cascade summary; (d) hide the row Delete button entirely for protected rows (any `isPlatformAdmin = true` user, the current user, the current user's own org); (e) inline success banner above the list for 3s after deletion. Toast system was deferred — banner is sufficient for this one flow. Deviation from original spec: there are no per-user/per-org detail pages today; all actions are on the list view. Effort: ~½ day pure frontend, no backend changes.
- ** 108 chore(type-safety): eliminate `any` from the codebase and add a `no-explicit-any` lint gate so the debt cannot silently regrow. Current state (identified 2026-06-05): **1,093** occurrences of `: any` / `as any` across `backend/src` and `frontend/src`. Each one is a place the TypeScript compiler can no longer catch a runtime error, so this is genuine, payable-down debt rather than a stylistic preference. Approach: (a) add `@typescript-eslint/no-explicit-any` as a **warning** first, with `--max-warnings` recorded as the current baseline, so the count can only ratchet down; (b) triage the existing occurrences into buckets — trivially-typed (give the real type), `unknown` + narrow (replace `any` with `unknown` and add a type guard), genuinely-dynamic (justify with a one-line comment and a narrow `// eslint-disable-next-line` rather than a blanket file disable), and third-party-shape (add a local `interface`/`type` or a `@types` shim); (c) work backend-service files first (highest blast radius — `any` in a service propagates into every route that calls it), then routes, then frontend; (d) once the bulk is cleared, promote the rule to **error** and wire it into the existing CI test gate. Out of scope: turning on `strict: true` wholesale if it is not already set — that is a separate, larger item. Acceptance: lint rule active and enforced in CI; occurrence count materially reduced from 1,093 with a documented baseline for the residue; no new `any` can merge without an explicit, justified inline disable. Estimated effort: ~2–3 days, mostly mechanical but high-volume; best done in batches by area so each batch is independently reviewable.
- ** 109 refactor(decomposition): split the source files that now breach the **800-line** decomposition threshold defined in CLAUDE.md rule 11. Current state (identified 2026-06-05) — 11 files at or over the threshold:
  - Backend: `routes/account.ts` (1,180), `routes/see-estimator.ts` (977), `routes/github/sync.ts` (907), `routes/products.ts` (891), `routes/reports.ts` (842), `routes/cra-reports.ts` (803)
  - Frontend: `pages/products/product-detail/SoftwareEvidenceTab.tsx` (1,376), `pages/settings/IntegrationsPage.tsx` (1,176), `pages/compliance/ReportDetailPage.tsx` (1,039), `pages/compliance/EscrowPage.tsx` (848), `pages/products/ProductDetailPage.tsx` (831)

  Approach: decompose only where a file has **distinct responsibilities** (rule 11 is explicit that size alone is not sufficient reason to split — a single-purpose pipeline is fine at higher line counts). Backend routers follow the established pattern — a sub-directory with `index.ts` composing focused sub-routers via `router.use()`, plus `shared.ts` for common middleware/helpers (see `routes/github/`, `routes/technical-file/`, `routes/admin/` for the reference shape). `account.ts` is the clearest first candidate (auth + profile + billing-adjacent concerns in one file). Frontend pages should extract self-contained tabs/sections into colocated child components (the `product-detail/` folder already demonstrates this) rather than splitting mechanically by line count. Sequence by worst-offender-with-clearest-seams first: `account.ts`, then `SoftwareEvidenceTab.tsx`, then `IntegrationsPage.tsx`. Acceptance: each touched file either drops below 800 lines or carries a one-line note justifying why it is a legitimate single-responsibility exception; no behaviour change (tests green before and after each split); decomposition uses the established `index.ts`/`shared.ts` pattern, not ad-hoc file shuffling. Estimated effort: ~½ day per file, spread across sessions — do not attempt all 11 in one pass.
- ** 107-OLD-SPEC feat(admin-panel-delete) ORIGINAL ENTRY (kept for traceability): The backend endpoints already exist and are correctly cascading: `DELETE /api/admin/users/:userId` ([backend/src/routes/admin/users.ts](backend/src/routes/admin/users.ts)) and `DELETE /api/admin/orgs/:orgId` ([backend/src/routes/admin/orgs.ts:338](backend/src/routes/admin/orgs.ts) — covers 13 Postgres tables + full Neo4j DETACH DELETE of org/products/repos/contributors/dependencies/SBOMs/tech-files). What's missing is the **frontend**: today there is no Delete button on `/admin/users` or `/admin/orgs`, so platform admins have to drop into SQL+Cypher to remove test/junk accounts (had to do this manually for the Monkeygarbage org / tom.mcburnie@gmail.com on 2026-05-18). Required UI: (a) a Delete button on the user detail page and on each row of the user list, with a confirmation modal that requires typing the user's email to confirm — disabled / hidden for users with `is_platform_admin = true` so platform admins cannot accidentally delete themselves or each other from the UI; (b) the same on the org detail page and org list rows, with a confirmation modal that requires typing the org name to confirm — the backend already blocks deleting your own org, but the UI should hide the button entirely for that case so it's not even tempting; (c) after success, show a toast and refresh the list; (d) on partial failure show the API error and leave the user/org intact (backend already wraps these in transactions). Tests: route integration tests already exist; add Playwright E2E covering the delete-with-confirm flow for both user and org. Out of scope: bulk delete, soft delete / "archive" mode, undo. Estimated effort: small (~½ day, pure frontend work).

## Completed (sessions 59-60)

- ~~#62 Remove GitHub auth from login page~~ — **DONE** (session 59)
- ~~#63 Remember verified emails across welcome site flows~~ — **DONE** (session 59)
- ~~#64 Beck map navigation guidance~~ — **DONE** (session 59)
- ~~Trust Centre rename~~ — **DONE** (session 60)
- ~~Affiliate programme~~ — **DONE** (session 60)
- ~~Vulnerability remediation~~ — **DONE** (session 60)

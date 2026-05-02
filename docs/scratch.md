<!--
  Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi@mcburnie.com
-->

# CRANIS2 — Active Backlog

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

## Completed (sessions 59-60)

- ~~#62 Remove GitHub auth from login page~~ — **DONE** (session 59)
- ~~#63 Remember verified emails across welcome site flows~~ — **DONE** (session 59)
- ~~#64 Beck map navigation guidance~~ — **DONE** (session 59)
- ~~Trust Centre rename~~ — **DONE** (session 60)
- ~~Affiliate programme~~ — **DONE** (session 60)
- ~~Vulnerability remediation~~ — **DONE** (session 60)

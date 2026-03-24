# CRANIS2 — Active Backlog

Updated: 2026-03-24 (session 59)

For completed work history, see `.claude/projects/-home-mcburnia-cranis2/memory/completed_work.md`

---

## Launch Readiness Workstreams

| WS | Workstream | Status |
|----|-----------|--------|
| 1 | Database Backup & Restore | **COMPLETE** (session 56) |
| 2 | PQC Readiness (JWT, HKDF, hybrid signing, Node.js 24) | **COMPLETE** (session 56) |
| 3 | Security Hardening (ports, rate limiting, CORS, key rotation) | **COMPLETE** (session 56) |
| 4 | GDPR Compliance | **COMPLETE** (session 57) — Privacy Policy, ToS, data export, account deletion, retention cleanup |
| 5 | Visual Testing | **COMPLETE** (session 58) — E2E video recording, rate limit bypass |

---

## WS4 — COMPLETE (session 57)

All GDPR items done: Privacy Policy, Terms of Service, data export, account deletion with PII purge + statistical aggregation, data retention cleanup. 27 tests.

**User action required:** Register with ICO (ico.org.uk/registration, £40/year) and update `[Pending]` placeholder in Privacy Policy. Legal review of both documents before production launch.

---

## Launch Blockers (must-fix before go-live)

| # | Item | Status |
|---|------|--------|
| 1 | `FRONTEND_URL` migration — change from `dev.cranis2.dev` to production URL | TODO |
| 2 | Remove `/api/dev/*` routes | **DONE** (already removed in prior session) |
| 3 | Remove SBOM debug logging | **DONE** (session 57) |
| 4 | DKIM verification for `poste.cranis2.com` — emails landing in spam without it | TODO (infrastructure) |
| 5 | Production infrastructure — Infomaniak hosting, `cranis2.com` domain, Cloudflare Tunnel | TODO (infrastructure) |
| 6 | Privacy Policy | **DONE** (session 57) — `docs/PRIVACY-POLICY.md`, served at `/docs/privacy-policy` |
| 7 | Terms of Service | **DONE** (session 57) — `docs/TERMS-OF-SERVICE.md`, served at `/docs/terms-of-service` |
| 8 | Cookie consent | **DONE** (session 57) — essential-only storage, documented in Privacy Policy, no banner needed |
| 9 | Stripe production keys — switch from test mode | TODO (config) |
| 10 | Resend production domain — verify `cranis2.com` | TODO (config) |
| 11 | Docker Compose orphan container cleanup (CRN-14) | **DONE** (session 57) |
| 12 | `DEV_SKIP_EMAIL` confirmed `false` in production | TODO (config) |
| 13 | Production `LOG_LEVEL` — set appropriately (not debug) | TODO (config) |

**Summary:** 7 of 13 blockers resolved. Remaining 6 are infrastructure/config (user-side).

### Server Maintenance (session 59)
- Ubuntu 24.04.4 fully patched (30 packages including Docker CE 29.3)
- Neo4j 2026.x deferred (major version jump from 5.x LTS, held via `apt-mark hold`)
- 0 npm vulnerabilities across all workspaces
- Dependency updates: @aws-sdk, pg, stripe, react-router-dom, recharts, typescript-eslint

---

## First-Impression Quality — COMPLETE

- ~~Help guide stub rewrites (top 5)~~ — all done (sessions 54 + 58)
- ~~Compliance Timeline SVG~~ — reviewed, confirmed correct (session 58)

---

## Parked (post-launch)

- **10 remaining help guide stub rewrites** — after top 5 above are done
- **Service unit test depth** — only 7/71 services have unit tests. Route tests cover critical paths.
- **P4 #24/#25** — Chat ops / Slack notifications.
- **P5 Supplier Marketplace** — 7 features (#28-34), not started.
- **#59 Multi-language i18n** — scope TBD.
- ~~#60 Bitbucket integration~~ — **DONE** (session 59). Needs OAuth consumer registration before beta partner can use it.
- **#61 SSO and GMAIL | Github sign in etc.** — must have moving forward.

## TODO

- ~~#62 Remove GitHub auth from login page~~ — **DONE** (session 59). Stub buttons removed from login + signup.
- ~~#63 Remember verified emails across welcome site flows~~ — **DONE** (session 59). 90-day TTL, cross-flow + cross-system recognition, 13 files changed.
- **#64 Beck map navigation guidance** — maps don't inform users how to navigate them. Team suggestion: animated glow on current station (first on page) to show where they are. Also consider a dismissible one-line instruction on each page.

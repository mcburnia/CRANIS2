# CRANIS2 — Active Backlog

Updated: 2026-04-28 (session 61)

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

## Recent Work (session 60)

- **Trust Centre rename** — Marketplace → Trust Centre across entire codebase
- **Affiliate programme** — bonus codes, admin management, self-service dashboard, monthly statements, 35 tests
- **Vulnerability remediation** — dep bumps across all 5 workspaces, 26 findings mitigated, schema drift fixed
- **4 bug fixes** — auto_resolved findings, compliance timeline live counts, CRA readiness >100%, test runner parity
- **Test suite:** 2,166 tests (121 files), 2,166 pass, 0 fail, 36 skip

---

## Launch Blockers (must-fix before go-live)

**7 of 13 resolved. Remaining 6 are infrastructure/config (user-side).**

| # | Item | Status |
|---|------|--------|
| 1 | `FRONTEND_URL` migration — change from `dev.cranis2.dev` to production URL | TODO |
| 2 | Remove `/api/dev/*` routes | **DONE** |
| 3 | Remove SBOM debug logging | **DONE** (session 57) |
| 4 | DKIM verification for `poste.cranis2.com` — emails landing in spam without it | TODO (infrastructure) |
| 5 | Production infrastructure — Infomaniak hosting, `cranis2.com` domain, Cloudflare Tunnel | TODO (infrastructure) |
| 6 | Privacy Policy | **DONE** (session 57) |
| 7 | Terms of Service | **DONE** (session 57) |
| 8 | Cookie consent | **DONE** (session 57) |
| 9 | Stripe production keys — switch from test mode | TODO (config) |
| 10 | Resend production domain — verify `cranis2.com` | TODO (config) |
| 11 | Docker Compose orphan container cleanup | **DONE** (session 57) |
| 12 | `DEV_SKIP_EMAIL` confirmed `false` in production | TODO (config) |
| 13 | Production `LOG_LEVEL` — set appropriately (not debug) | TODO (config) |

**User action required:** Register with ICO (ico.org.uk/registration, £40/year), update Privacy Policy placeholder. Legal review both docs.

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
- CRANIS2 hosted and operated by Loman Cavendish on behalf of the customer
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

## Completed (sessions 59-60)

- ~~#62 Remove GitHub auth from login page~~ — **DONE** (session 59)
- ~~#63 Remember verified emails across welcome site flows~~ — **DONE** (session 59)
- ~~#64 Beck map navigation guidance~~ — **DONE** (session 59)
- ~~Trust Centre rename~~ — **DONE** (session 60)
- ~~Affiliate programme~~ — **DONE** (session 60)
- ~~Vulnerability remediation~~ — **DONE** (session 60)

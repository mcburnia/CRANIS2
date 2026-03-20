# CRANIS2 — Active Backlog

Updated: 2026-03-20 (session 56)

For completed work history, see `.claude/projects/-home-mcburnia-cranis2/memory/completed_work.md`

---

## Launch Readiness Workstreams

| WS | Workstream | Status |
|----|-----------|--------|
| 1 | Database Backup & Restore | **COMPLETE** (session 56) |
| 2 | PQC Readiness (JWT, HKDF, hybrid signing, Node.js 24) | **COMPLETE** (session 56) |
| 3 | Security Hardening (ports, rate limiting, CORS, key rotation) | **COMPLETE** (session 56) |
| 4 | GDPR Compliance | **NEXT** (session 57) |
| 5 | Visual Testing | Pending (session 58) |

---

## WS4 Scope (GDPR Compliance — approved)

1. **Data export endpoint** (Art. 20) — `GET /api/account/data-export` returning all personal data as JSON/ZIP
2. **Account deletion endpoint** (Art. 17) — `DELETE /api/account` with PII hard-delete, audit trail anonymisation, Neo4j cleanup, Stripe cancellation
3. **Statistical aggregation before deletion** — convert telemetry to anonymous statistics (GDPR Recital 26: anonymised data is outside scope) before purging personal data
4. **Data retention policy + scheduled cleanup** — telemetry 90 days, welcome contacts 12 months, assessments 12 months, verification codes 24 hours, audit trail 10 years (CRA Art. 13(10))
5. **Tests** for all of the above

**Session 58 (legal/docs — may need legal input):** Privacy Policy, DPA templates, localStorage disclosure

---

## Launch Blockers (must-fix before go-live)

| # | Item | Status |
|---|------|--------|
| 1 | `FRONTEND_URL` migration — change from `dev.cranis2.dev` to production URL | TODO |
| 2 | Remove `/api/dev/*` routes — destructive endpoints still present | TODO |
| 3 | Remove SBOM debug logging — `console.log` in `services/github.ts` | TODO |
| 4 | DKIM verification for `poste.cranis2.com` — emails landing in spam without it | TODO |
| 5 | Production infrastructure — Infomaniak hosting, `cranis2.com` domain, Cloudflare Tunnel | TODO |
| 6 | Privacy Policy — GDPR requirement for personal data collection | TODO |
| 7 | Terms of Service — contractual basis for the platform | TODO |
| 8 | Cookie consent — if any non-essential cookies used | TODO |
| 9 | Stripe production keys — switch from test mode | TODO |
| 10 | Resend production domain — verify `cranis2.com` | TODO |
| 11 | Docker Compose orphan container cleanup (CRN-14) | TODO |
| 12 | `DEV_SKIP_EMAIL` confirmed `false` in production | TODO |
| 13 | Production `LOG_LEVEL` — set appropriately (not debug) | TODO |

---

## Parked (post-launch)

Everything below is deferred until after launch. No work on these until the 13 launch blockers are resolved.

- **15 help guide stub rewrites** — prioritised in `docs/HELP-GUIDE-REVIEW.md`. P1 guides next (ch6_05, ch5_06, ch5_05, ch7_07).
- **Audit log route mapping** — `/audit-log` maps to ch5_05 which is a stub. Remap or write the stub.
- **Compliance Timeline SVG issue** — ENISA reporting visual issue deferred, needs clarification.
- **Service unit test depth** — only 7/71 services have unit tests. Route tests cover critical paths but pure-function services would benefit from isolated tests.
- **P4 #24/#25** — Chat ops / Slack notifications.
- **P5 Supplier Marketplace** — 7 features (#28-34), not started.
- **#59 Multi-language i18n** — scope TBD.
- **#60 Bitbucket integration** — PAT-based initially (App Passwords), OAuth 2.0 follow-up. All 3 SBOM tiers. Beta pilot partner confirmed (brother's company CTO).

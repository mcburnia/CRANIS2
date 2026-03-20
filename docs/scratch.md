# CRANIS2 — Active Backlog

Updated: 2026-03-20 (session 57)

For completed work history, see `.claude/projects/-home-mcburnia-cranis2/memory/completed_work.md`

---

## Launch Readiness Workstreams

| WS | Workstream | Status |
|----|-----------|--------|
| 1 | Database Backup & Restore | **COMPLETE** (session 56) |
| 2 | PQC Readiness (JWT, HKDF, hybrid signing, Node.js 24) | **COMPLETE** (session 56) |
| 3 | Security Hardening (ports, rate limiting, CORS, key rotation) | **COMPLETE** (session 56) |
| 4 | GDPR Compliance | **PARTIAL** (session 57) — Privacy Policy + ToS done; data export/deletion endpoints pending |
| 5 | Visual Testing | Pending |

---

## WS4 Remaining Scope (GDPR Compliance)

Privacy Policy and Terms of Service are **done** (session 57). Remaining WS4 items:

1. **Data export endpoint** (Art. 20) — `GET /api/account/data-export` returning all personal data as JSON/ZIP
2. **Account deletion endpoint** (Art. 17) — `DELETE /api/account` with PII hard-delete, audit trail anonymisation, Neo4j cleanup, Stripe cancellation
3. **Statistical aggregation before deletion** — convert telemetry to anonymous statistics (GDPR Recital 26)
4. **Data retention policy + scheduled cleanup** — telemetry 90 days, welcome contacts 12 months, verification codes 24 hours, audit trail 10 years (CRA Art. 13(10))
5. **Tests** for all of the above

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

---

## In Progress — First-Impression Quality

These items were promoted from post-launch to pre-launch to ensure beta pilot quality.

- **Help guide stub rewrites (top 5)** — prioritised by user impact:
  1. `ch4_06_ai_copilot.html` — primary Copilot reference
  2. `ch4_05_batch_fill.html` — core Copilot feature
  3. `ch4_07_risk_assessment.html` — Annex I risk assessment
  4. `ch6_05_incident_lifecycle.html` — 8-endpoint feature, no docs
  5. `ch5_06_compliance_vault.html` — major P8 feature, no docs
- **Compliance Timeline SVG** — reviewed in code, no defect found. Needs visual browser check.

---

## Parked (post-launch)

- **10 remaining help guide stub rewrites** — after top 5 above are done
- **Service unit test depth** — only 7/71 services have unit tests. Route tests cover critical paths.
- **P4 #24/#25** — Chat ops / Slack notifications.
- **P5 Supplier Marketplace** — 7 features (#28-34), not started.
- **#59 Multi-language i18n** — scope TBD.
- **#60 Bitbucket integration** — beta pilot partner uses Bitbucket.

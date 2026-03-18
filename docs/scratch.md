# CRANIS2 — Active Backlog

Updated: 2026-03-18 (session 55)

For completed work history, see `.claude/projects/-home-mcburnia-cranis2/memory/completed_work.md`

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

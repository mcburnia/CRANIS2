# CRANIS2 — Active Backlog

Updated: 2026-03-17 (session 54)

For completed work history, see `.claude/projects/-home-mcburnia-cranis2/memory/completed_work.md`

---

## Completed This Session

- P0 help guides written — ch4_05 (Batch Fill), ch4_06 (AI Copilot), ch4_07 (Risk Assessment)
- SVG fixes — ch4_02 "Open Obligations" label collision, ch1_03 branch tracks not reaching station
- SEE report export auth fix — replaced window.open with fetch+blob for Bearer token
- Session capture rewrite — correct hook event name, explicit env sourcing, JSONL transcript parsing
- AI Coder Framework — 6-document Gibbs Consulting framework (principles, policy, standards, guidelines, session template, project scaffold)

---

## Help Guide System

### 15 Stub Files — Complete Rewrites Needed

Priority order (from `docs/HELP-GUIDE-REVIEW.md`):

| Priority | File | Feature |
|----------|------|---------|
| P1 | ch6_05 | Incident lifecycle |
| P1 | ch5_06 | Compliance vault |
| P1 | ch5_05 | Compliance reports |
| P1 | ch7_07 | Organisation settings |
| P2 | ch5_07 | Due diligence package |
| P2 | ch2_05 | Supplier due diligence |
| P2 | ch3_04 | Batch triage wizard |
| P2 | ch3_05 | Understanding severity |
| P2 | ch7_10 | Document templates |
| P3 | ch7_06 | Stakeholders |
| P3 | ch7_08 | Trello integration |
| P4 | ch7_09 | Marketplace (feature not built — Coming Soon placeholder) |

Use `tools/becksmap/` generator for new maps. Follow `docs/HELP-GUIDE-STANDARD.md` and `docs/BECK-MAP-DESIGN-SPEC.md`.

### Audit Log Route Mapping

`/audit-log` currently maps to ch5_05 (compliance reports) which is a stub. Either remap to an existing guide or write the ch5_05 stub.

### SVG Issues to Investigate

- Compliance Timeline guide — ENISA reporting workflow visual issue (deferred, needs clarification)

---

## Test Depth

### Service unit tests (7/71)

Route tests cover all critical API paths (98.5% coverage). Service unit tests add depth for pure-function logic. Current service tests: lockfile-parsers, obligation-engine-roles, alert-emails, see-classifier, see-estimator, see-session, crypto-inventory. Candidates for next batch: compliance-gaps, see-report-generator, see-evolution, see-experiment-detector.

---

## Parked

- **P4 #24/#25** — Chat ops / Slack notifications (post-launch)
- **P5** — Supplier marketplace (post-launch, 0/7 features)
- **#59** — Multi-language i18n (scope TBD)

# CRANIS2 — Active Backlog

Updated: 2026-03-16 (session 51)

For completed work history, see `.claude/projects/-home-mcburnia-cranis2/memory/completed_work.md`

---

## Active Work

### #60 — Repository Effort & Cost Estimator (R&D Tax Credits)

**Status:** PLANNED — 5 phases, not started

Opt-in per product feature that analyses connected repositories to estimate development effort, cost, team size, and complexity. Primary use case: R&D tax credit evidence. Pro plan feature.

| Phase | Scope | Status |
|-------|-------|--------|
| A | Database schema, consent model, file classification engine | TODO |
| B | Repo scanning pipeline, LOC counting, git stats, API endpoints | TODO |
| C | Effort/cost calculation engine (deterministic, range-based) | TODO |
| D | Frontend: Effort Estimate tab with consent, scan, results, charts | TODO |
| E | Markdown report (R&D tax credit quality), admin config, analytics | TODO |

Full spec: user provided in session 51 conversation. Implementation plan in memory.

---

## Help Guide System

### 18 Stub Files — Complete Rewrites Needed

Priority order (from `docs/HELP-GUIDE-REVIEW.md`):

| Priority | File | Feature |
|----------|------|---------|
| P0 | ch4_06 | AI Copilot user reference |
| P0 | ch4_05 | Batch Fill wizard |
| P0 | ch4_07 | Risk assessment (Annex I) |
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

---

## Future Capability

### Software Evidence Engine (SEE)

**Status:** SPECIFIED — not yet planned or phased

Automated engineering evidence extraction and lifecycle provenance generation from software repositories. Constructs a Software Evidence Graph in Neo4j from Git history, CI/CD metadata, test evolution, SBOMs, and vulnerability records.

Full specification: `docs/see-specification.md`

Key capabilities: commit/branch/developer attribution, experimentation detection, architecture evolution tracking, R&D tax evidence generation, multi-regulation compliance reports (CRA, NIS2, AI Act, DORA, ISO 27001, HMRC R&D).

Relationship to #60 (Repo Estimator): the estimator is a pragmatic MVP that delivers LOC/effort/cost estimation. SEE is the broader strategic capability that subsumes and extends it with full lifecycle provenance and evidence graph modelling.

---

## Parked

- **P4 #24/#25** — Chat ops / Slack notifications (post-launch)
- **P5** — Supplier marketplace (post-launch, 0/7 features)
- **#59** — Multi-language i18n (scope TBD)

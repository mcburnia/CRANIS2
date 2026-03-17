# CRANIS2 — Active Backlog

Updated: 2026-03-17 (session 52)

For completed work history, see `.claude/projects/-home-mcburnia-cranis2/memory/completed_work.md`

---

## Active Work

### Software Evidence Engine (SEE) — Unified Plan

**Status:** PLANNED — 7 phases, not started

The SEE unifies the Repository Effort & Cost Estimator (#60) and the Software Evidence Engine specification into a single staged delivery. It analyses connected repositories to extract engineering evidence, estimate effort/cost, detect experimentation, and generate multi-regulation compliance reports.

**Why:** Software companies need defensible evidence of engineering effort for R&D tax credits, due diligence, and regulatory compliance. CRANIS2 already connects to their repos. The data is there.

**Goal:** Customer enables source code analysis, runs an analysis, receives LOC/effort/cost estimates, experimentation evidence, architecture evolution timeline, developer attribution, and multi-regulation compliance reports. All deterministic, auditable, exportable as Markdown.

**Primary use case:** R&D tax credit evidence (HMRC, CIR, Forschungszulage, I+D+i).
**Secondary use cases:** Due diligence, CRA/NIS2/AI Act/DORA compliance evidence, internal estimation.
**Billing:** Pro plan. Opt-in per product (source code consent required).

**Specifications:**
- `docs/see-specification.md` — full SEE capability specification
- `docs/future-regulations.md` — adjacent regulatory opportunities

| Phase | Delivers | User-visible outcome | Status |
|-------|----------|---------------------|--------|
| A | Consent + basic estimator | LOC by language, effort/cost ranges, executive report | TODO |
| B | Commit history + developer attribution | Commit metrics, developer contribution table, timeline | TODO |
| C | Branch analysis + commit classification | Branch types, commit categories, rewrite ratio | TODO |
| D | Experimentation detection + R&D report | Uncertainty indicators, experiment timeline, HMRC-ready report | TODO |
| E | Architecture evolution + test evolution | Architecture change timeline, test maturity metrics | TODO |
| F | Full evidence graph + visualisations | SBOM/vuln integration, provenance queries, charts | TODO |
| G | Multi-regulation reports + AI narratives | CRA, NIS2, AI Act, DORA, ISO 27001 evidence reports | TODO |
| H | Development session capture + competence profiling | Conversation evidence via MCP, Forgejo storage, competence assessment | TODO |

### Phase detail

**Phase A** — Source code consent model (Neo4j Product property), `see_analysis_runs` table, file classification engine (production/test/config/generated/vendor/docs), LOC counting with exclusions, COCOMO II-style effort/cost estimation (low/mid/high), Markdown executive report. New "Software Evidence" tab on product detail.

**Phase B** — Extend repo-provider with `getCommits()` for all providers. `see_commits` and `see_developers` tables. `SEEDeveloper` and `SEECommit` Neo4j nodes. Incremental commit ingestion. Developer attribution with percentages and timeline. Commit frequency chart.

**Phase C** — Extend repo-provider with `getBranches()`. `see_branches` table. `SEEBranch` Neo4j nodes. Deterministic commit classification (feature/fix/refactor/test/experiment) via message patterns. Branch type classification (feature/experimental/abandoned). Rewrite ratio per module.

**Phase D** — Core R&D capability. `see_experiments` and `see_evidence_reports` tables. `SEEExperiment` Neo4j nodes. Experimentation detection: repeated implementation, algorithm replacement, prototype branches, dependency switching, refactoring waves. Narrative-style R&D evidence report with technological uncertainty indicators. Optional Copilot narrative.

**Phase E** — `see_architecture_events` and `see_test_events` tables. `SEEFile`, `SEEModule`, `SEEArchitectureChange`, `SEETest` Neo4j nodes. Module restructuring detection, schema migration detection. Test lifecycle tracking (creation, modification, failure/fix correlation). Architecture evolution timeline.

**Phase F** — `SEEComponent`, `SEERelease` Neo4j nodes. `see_provenance` table. Links existing SBOM/vulnerability data to evidence graph. Provenance queries ("who introduced this dependency?"). Commit activity timeline, module churn heatmap, developer contribution chart.

**Phase G** — Multi-regulation report templates (CRA, NIS2, AI Act, DORA, ISO 27001, R&D Tax). Copilot AI narrative generation for reports. Admin analytics integration. Public API exposure. `see_audit_log` for immutable evidence trail.

**Phase H** — Development session capture via MCP/Claude Code hooks. Developer prompted for consent per session. Conversation transcripts stored in Forgejo (EU-sovereign, git-backed). Competence Evidence Profile generated from conversation analysis (domain vocabulary, design reasoning, industry awareness, decision quality). Addresses R&D tax credit "competent professional" requirement without relying on formal qualifications.

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

## Parked

- **P4 #24/#25** — Chat ops / Slack notifications (post-launch)
- **P5** — Supplier marketplace (post-launch, 0/7 features)
- **#59** — Multi-language i18n (scope TBD)

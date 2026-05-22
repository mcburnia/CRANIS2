<!--
  Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
-->

# CRANIS2 — Outstanding-Work Import for Jira `CRAN`

**Companion to** `docs/CRAN-COMPLETED-IMPORT.md`. That document captured the **as-built history** (338 tickets, all Done). This document captures the **forward-looking outstanding work** that remained in `docs/scratch.md` after the retrospective import — 49 tickets, all `To Do`, all labelled `outstanding`.

**Created:** 2026-05-22 (same session as the retrospective import). Jira keys `CRAN-370 → CRAN-418`.

---

## What's tracked here vs elsewhere

The CRAN project now contains three distinct ticket cohorts:

| Cohort | Range | Status | Labels | What it is |
|---|---|---|---|---|
| Retrospective (as-built) | CRAN-32 → CRAN-369 | Done (mostly) | `methodology-retrospective` | The 338-ticket import of completed work — see `CRAN-COMPLETED-IMPORT.md` |
| Gap-analysis epics (CRA scope) | CRAN-2 → CRAN-28 | To Do | tier:1/2/3, `strategic-10x`, `cra-completeness` | The 28 forward-looking CRA-coverage epics from the 2026-05-06 gap analysis (existed before this session) |
| Outstanding (this doc) | CRAN-370 → CRAN-418 | To Do | `outstanding` + sub-labels | 49 tickets covering parked features, active backlog Jobs To Do, user-side launch tasks, dep upgrades, commercial offerings |
| Baseline + retro housekeeping | CRAN-1, CRAN-29, CRAN-30 | Done | — | Pre-existing tickets — CRAN-1 is the as-is baseline, CRAN-29/30 were transitioned to Done as part of the retro import |

---

## Outstanding inventory — 10 epics + 39 stories

### EPIC OUT-01 (`CRAN-370`) — Multi-language internationalization (#59)
**Labels:** `outstanding`, `parked`, `area:ux`, `feature:i18n`

Scope TBD — parked post-launch. CRANIS2 is currently English-only; multi-language support is required for EU-wide adoption.

**Stories:** discovery spike (CRAN-380) → infrastructure (CRAN-381) → first language pack FR/DE/ES/IT/NL (CRAN-382).

---

### EPIC OUT-02 (`CRAN-371`) — SSO + federated identity (#61)
**Labels:** `outstanding`, `parked`, `area:auth`

"Must have moving forward" per `docs/scratch.md`. The Gmail/GitHub sign-in stub buttons were removed pre-launch (STORY-02.17 / CRAN-367) — this epic owes the actual implementation.

**Stories:** Google Sign-In (CRAN-383) → GitHub Sign-In (CRAN-384) → Microsoft/Apple SSO (CRAN-385).

---

### EPIC OUT-03 (`CRAN-372`) — Help-guide stub completion (15 remaining)
**Labels:** `outstanding`, `parked`, `area:docs`

15 of 48 help-guide files remain as stubs after the EPIC-33 priority pass.

**Stories:** audit + prioritise (CRAN-386) → rewrite remaining 15 to v2.0 standard (CRAN-387).

---

### EPIC OUT-04 (`CRAN-373`) — Service unit-test coverage expansion (7/71 → 100%)
**Labels:** `outstanding`, `parked`, `area:ops`

Route tests cover happy / break paths but service-level unit tests would isolate logic errors faster.

**Stories:** enumerate + audit (CRAN-388) → batch 1 top-15 by complexity (CRAN-389) → batch 2 middle-25 (CRAN-390) → batch 3 remaining + CI gate (CRAN-391).

---

### EPIC OUT-05 (`CRAN-374`) — Slack + ChatOps integrations (P4 #24 / #25)
**Labels:** `outstanding`, `parked`, `area:ops`, `tier:p4`

Two explicitly-parked P4 items.

**Stories:** #24 Slack notifications (CRAN-392) → #25 ChatOps slash commands (CRAN-393).

---

### EPIC OUT-06 (`CRAN-375`) — Supplier Trust Centre (P5 #28-#34)
**Labels:** `outstanding`, `parked`, `area:trust`, `tier:p5`

P5 phase supplier-side workflow capabilities, 7 features. Sister epic to the customer-facing Trust Centre (CRAN-48).

**Stories:** 7 placeholders P5 #28 → #34 (CRAN-394 → CRAN-400) — to be fleshed out once P5 is unparked.

---

### EPIC OUT-07 (`CRAN-376`) — Post-launch operations & hardening (#100-#106)
**Labels:** `outstanding`, `area:ops`

Active-backlog operational items from `docs/scratch.md`'s **Jobs To Do** section.

**Stories:**
- `CRAN-401` (#100) Dev ↔ Prod alignment — back-port affiliate schema + `/welcome` rename to `pool.ts initDb()`
- `CRAN-402` (#101) Promotion-process implementation — machinery for SPIKE-03 (`docs/promotion-process.md`)
- `CRAN-403` (#102) Maintain Claude operating instructions
- `CRAN-404` (#103) Production resilience + security test
- `CRAN-405` (#105) Bitbucket OAuth Consumer registration + wiring
- `CRAN-406` (#106) PAT guidance modal for self-hosted providers

---

### EPIC OUT-08 (`CRAN-377`) — Launch outstanding (user-side)
**Labels:** `outstanding`, `area:ops`, `user-side`

Five user-side configuration items outstanding from the launch checklist. None require code.

**Stories:**
- `CRAN-407` DKIM verification for `poste.cranis2.com` (Resend)
- `CRAN-408` Stripe live keys + live webhook
- `CRAN-409` Pre-launch secret rotation (Anthropic / Codeberg / signing / DB / Forgejo)
- `CRAN-410` ICO registration (£40/year) + Privacy Policy placeholder update
- `CRAN-411` Legal review of Privacy Policy + Terms of Service

---

### EPIC OUT-09 (`CRAN-378`) — Major dependency upgrades
**Labels:** `outstanding`, `parked`, `area:ops`, `deps`

Five major-version bumps deferred from sessions 60 / 63.

**Stories:** TypeScript 6 (CRAN-412) → Vite 8 (CRAN-413) → Resend 6 (CRAN-414) → ESLint 10 (CRAN-415) → lucide-react 1.x (CRAN-416).

---

### EPIC OUT-10 (`CRAN-379`) — Commercial offerings (post-launch discovery)
**Labels:** `outstanding`, `discovery`, `post-launch`

Two commercial models flagged for post-launch exploration. Discovery items — require scoping conversations before becoming engineering work.

**Stories:** Enterprise Licensing discovery (CRAN-417) → Managed Service Hosting discovery (CRAN-418).

---

## Operating notes

### Status semantics
- All 49 outstanding tickets are `To Do`. No `Start Date` / `Due Date` populated yet — the user (Andi) will set these when sequencing them on the Timeline / Roadmap.
- The `outstanding` label is the canonical filter for "not yet started" work introduced in this batch.
- `parked` vs not-parked: `parked` is on items deferred indefinitely. Active backlog items (CRAN-376 / EPIC OUT-07) and launch-user-side items (CRAN-377 / EPIC OUT-08) are **not** parked — they're queued for execution as soon as priority allows.

### How this relates to the Timeline / Roadmap
- The retrospective (Done) work already has Start + Due dates and renders as historical bars on the Timeline.
- These 49 outstanding items appear in Backlog initially with no dates → no Timeline visibility yet.
- To put them on the roadmap, populate `customfield_10015` (Start date) and `duedate` on each. Recommended sequence: prioritise within each epic, then assign start/end dates based on planned execution window.

### Verification queries
```
JQL: project = CRAN AND labels = "outstanding"
  → 49 results (10 epics + 39 stories)

JQL: project = CRAN AND labels = "outstanding" AND labels = "user-side"
  → 5 results (the EPIC OUT-08 user-side stories)

JQL: project = CRAN AND labels = "outstanding" AND labels = "parked"
  → ~24 results (parked features + dep upgrades)
```

---

## Source

The full source-of-truth for this import lives at `docs/scratch.md` (the active backlog file), plus the **Parked**, **Jobs To Do**, **Launch Blockers (user-side outstanding)**, and **Future — Enterprise Licensing and Managed Service Hosting** sections within it. This document is the structured representation of those sections at the time of the 2026-05-22 import.

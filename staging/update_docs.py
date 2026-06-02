#!/usr/bin/env python3
"""Update RESTART.md Current Status + scratch.md header with this session's
Jira-progress-system work, so the next session knows where we are."""
import sys

RESTART = "/home/mcburnia/cranis2/RESTART.md"
SCRATCH = "/home/mcburnia/cranis2/docs/scratch.md"

# ---- RESTART.md ----
R_ANCHOR = "**Last updated:** 2026-05-06 (session 64)\n\n**Recently completed (session 64) — P10 Automated CRA Art. 14 Trigger Engine SHIPPED:**"
R_NEW = """**Last updated:** 2026-06-02

**Recently completed (2026-06-01 → 06-02) — Jira CRAN progress system built (repo ↔ Jira leg of the team collaboration environment):**

> The 2026-05-18 → 05-22 work (admin-delete UI, feedback-notify, repo-connection org-scoping, OAuth/repo fixes, CRA gap analysis, retrospective + outstanding Jira imports — commits through `78fad14`) shipped to git but was never logged in this section; see `git log`.

- **Jira `CRAN` is now a full agile mirror of the repo AND the all-disciplines team progress system.** `andimcburnie.atlassian.net`, board 34, team-managed. ≈479 issues, every one with a user-story-voice description (As a / I want / so that + Given/When/Then AC + preserved commit SHAs as Sources), correct status, and story points + human-effort (Original estimate) on every scoped item (≈1,373 pts).
  - 338 Done = as-built history reverse-engineered from `docs/CRAN-COMPLETED-IMPORT.md`; forward backlog from `docs/CRAN-OUTSTANDING-IMPORT.md` + `docs/CRA-GAP-ANALYSIS-2026-05-06.md`.
  - Audit gap closed: created the 3 strategic epics that were "Jira ID TBD" — Operator Supplier Dashboard (CRAN-419), PLD recast 2024/2853 (CRAN-420), DORA Art. 28 pack (CRAN-421) — plus a billing 90-day-window story (CRAN-422) from a `billing.ts` code TODO.
- **Cross-discipline expansion** — 11 business/GTM/QA/legal/ops epics (CRAN-423–479) added alongside engineering, `discipline:*`-labelled (marketing / sales / qa / legal / ops; engineering = no discipline label): Social campaign, Operator outreach, CRA-deadline content, Brand foundation, Affiliate activation, Sales plan, Beta programme, Customer-journey UAT, Accessibility (WCAG), Corporate & Legal Foundation, Finance & Tax Ops.
- **Team working surface:** Timeline roadmap (49 forward epics dated Jun 2026 → Dec 2027, anchored to CRA Sep-2026 / PLD Dec-2026 / CRA-full Dec-2027); 6 project-shared, starred saved filters one per discipline (IDs 10132–10137); 6 per-discipline Kanban boards built from those filters (IDs 100–105). CRAN-21/22 remain To Do (no Won't-Do status in the workflow yet; labelled `cancelled`).
- **Toolchain committed** to `staging/` (commit `c5df8af`): `jira_enrich.py` / `jira_list.py` / `jira_create.py` / `jira_create_gtm.py` / `jira_filters.py` / `jira_boards.py` / `jira_roadmap.py` + `wave*.json` data + `staging/README.md`. Full state, IDs and Jira gotchas in the `jira-cran-mirror` memory.
- **Still open:** **Miro** visual layer (third leg of the collaboration environment) — not started; Miro MCP is in the server `.mcp.json` but not reachable from a local Claude session. The 7 P5 placeholders (CRAN-394–400) need scoping; CRAN-21/22 need a Won't-Do status added before they can be closed.

**Recently completed (session 64) — P10 Automated CRA Art. 14 Trigger Engine SHIPPED:**"""

# ---- scratch.md ----
S_ANCHOR = "Updated: 2026-04-30 (session 62 — production deployment day)"
S_NEW = """Updated: 2026-06-02 — **the live working backlog now lives in Jira `CRAN`** (`andimcburnie.atlassian.net`, board 34). Every item below is mirrored there as an agile ticket with estimates, plus 11 new business/GTM/QA/legal/ops epics (CRAN-423–479) that are Jira-native (not duplicated here). Treat Jira as the working set; this file is the narrative seed. See the `jira-cran-mirror` memory + `staging/` toolchain.

Updated: 2026-04-30 (session 62 — production deployment day)"""

def patch(path, anchor, new):
    with open(path, encoding="utf-8") as f:
        txt = f.read()
    if anchor not in txt:
        print(f"!! anchor NOT found in {path} — no change made")
        return False
    if new.split("\n")[0] in txt and "2026-06-02" in txt and path == RESTART and txt.count("2026-06-02") > 0 and anchor not in txt:
        pass
    txt = txt.replace(anchor, new, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(txt)
    print(f"OK patched {path}")
    return True

ok1 = patch(RESTART, R_ANCHOR, R_NEW)
ok2 = patch(SCRATCH, S_ANCHOR, S_NEW)
print("DONE" if (ok1 and ok2) else "INCOMPLETE — check anchors")

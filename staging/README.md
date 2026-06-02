<!--
  Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
-->

# Jira CRAN toolchain

Scripts that build and maintain the **CRAN** Jira project as an agile mirror of
this repo (project management progress system across all disciplines).

Run from `~/cranis2` after loading the API token:

```bash
set -a && . ./.env && set +a          # exposes JIRA_API_TOKEN
export JIRA_EMAIL=andi.mcburnie@gmail.com
python3 staging/<script>.py
```

All scripts use Basic auth (`JIRA_EMAIL:JIRA_API_TOKEN`) against
`andimcburnie.atlassian.net`. No secrets are committed.

| Script | Purpose |
|---|---|
| `jira_enrich.py <data.json> [--apply]` | Update description (wiki→ADF) + story points (`customfield_10016`) + Original estimate. Idempotent; checks `editmeta` so it only sets settable fields. |
| `jira_list.py "<JQL>"` | Paginated `key  type  parent  status  summary` dump. |
| `jira_create.py` | Create issues then enrich (one-off: strategic epics + billing story). |
| `jira_create_gtm.py` | Create the 11 business/GTM/QA epics + child stories. |
| `jira_filters.py` | Create the 6 per-discipline saved filters (project-shared, starred). |
| `jira_boards.py` | Create the 6 per-discipline Kanban boards from those filters. |
| `jira_roadmap.py` | Set Start date + Due date on the 49 forward epics (Timeline roadmap). |
| `wave1.json … wave3m.json` | Enrichment data applied to CRAN — audit trail of what was pushed. |

See the `jira-cran-mirror` memory for the full state, IDs, and Jira gotchas.

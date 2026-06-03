#!/usr/bin/env bash
#
# Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
# SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
#
# rebuild-roadmaps.sh — regenerate all three roadmap pages from live Jira CRAN
# data and deploy them. Run on demand or nightly via cron. Single source of
# truth = Jira; placement is deterministic (due date -> period, discipline label
# -> discipline, parent -> epic, status -> done/to-do).
set -euo pipefail
cd /home/mcburnia/cranis2
# shellcheck disable=SC1090
source ~/.nvm/nvm.sh >/dev/null 2>&1 || true
set -a; . ./.env; set +a
export JIRA_EMAIL="andi.mcburnie@gmail.com"
BM="node tools/becksmap/bin/becksmap.js"
S=staging

echo "[$(date -u +%FT%TZ)] rebuild-roadmaps starting"

# 1. regenerate definitions from live Jira (detail pages are fully data-driven;
#    the overview gets live shipped-counts + a missing-due-date lint)
python3 "$S/build_by_period.py"
python3 "$S/build_left_to_do.py"
python3 "$S/build_roadmap.py"

# 2. generate HTML
$BM generate "$S/roadmap.generated.json" --output "$S/cranis2-roadmap.html" >/dev/null
$BM generate "$S/by-period.json"          --output "$S/by-period.html"        >/dev/null
$BM generate "$S/left-to-do.json"         --output "$S/left-to-do.html"       >/dev/null

# 3. deploy (dist = live via nginx bind-mount; public = survives frontend rebuilds)
for p in roadmap by-period left-to-do; do mkdir -p "frontend/dist/$p" "frontend/public/$p"; done
cp "$S/cranis2-roadmap.html" frontend/dist/roadmap/index.html;   cp "$S/cranis2-roadmap.html" frontend/public/roadmap/index.html
cp "$S/by-period.html"       frontend/dist/by-period/index.html; cp "$S/by-period.html"       frontend/public/by-period/index.html
cp "$S/left-to-do.html"      frontend/dist/left-to-do/index.html; cp "$S/left-to-do.html"     frontend/public/left-to-do/index.html

echo "[$(date -u +%FT%TZ)] rebuild-roadmaps done — /roadmap /by-period /left-to-do updated"

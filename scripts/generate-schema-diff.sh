#!/usr/bin/env bash
# Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
# SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
#
# This file is part of CRANIS2 — a personally-owned, personally-funded
# software product. Unauthorised copying, modification, distribution,
# or commercial use is prohibited. For licence enquiries:
# andi@mcburnie.com

# ──────────────────────────────────────────────────────────────────────
# CRANIS2 — Schema diff helper (promotion assessment aid, §6.4 step 4)
#
# Produces a unified diff between the schema of the restored-prod database
# and the current dev schema, on the dev Postgres. Paste the annotated
# output into the release assessment's "Schema diff" section, then classify
# every change as Additive / Transformational / Rule-14 violation (§6.2).
#
# Prereq: restore the latest prod backup into a scratch DB on dev first
# (docs/promotion-process.md §6.4 step 3), e.g. cranis2_promotion_test.
#
# Usage (on dev):
#   ./scripts/generate-schema-diff.sh [--prod-db cranis2_promotion_test] [--dev-db cranis2]
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

PROD_DB="cranis2_promotion_test"
DEV_DB="cranis2"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --prod-db) PROD_DB="${2:-}"; shift 2 ;;
    --dev-db)  DEV_DB="${2:-}"; shift 2 ;;
    *) echo "generate-schema-diff: unknown argument: $1" >&2; exit 2 ;;
  esac
done

die() { echo "generate-schema-diff: ERROR: $*" >&2; exit 1; }

dump_schema() { # $1 = dbname
  docker exec cranis2_postgres pg_dump -U cranis2 --schema-only --no-owner --no-privileges "$1" 2>/dev/null \
    | grep -vE '^--|^$|^SET |^SELECT pg_catalog' || true
}

docker exec cranis2_postgres psql -U cranis2 -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname='${PROD_DB}'" 2>/dev/null | grep -q 1 \
  || die "scratch prod DB '${PROD_DB}' not found — restore the prod backup into it first (§6.4 step 3)"

TMP_PROD="$(mktemp)"; TMP_DEV="$(mktemp)"
trap 'rm -f "$TMP_PROD" "$TMP_DEV"' EXIT
dump_schema "$PROD_DB" > "$TMP_PROD"
dump_schema "$DEV_DB"  > "$TMP_DEV"

echo "# Schema diff: prod (${PROD_DB}) → dev (${DEV_DB})"
echo "# '-' = only on prod (current), '+' = new in this release candidate."
echo "# Classify every '+' change as Additive / Transformational / Rule-14 (§6.2)."
echo
if diff -u "$TMP_PROD" "$TMP_DEV" > /tmp/schema.diff; then
  echo "(no schema differences — a no-op release; the migration .sql is a stub)"
else
  sed '1,2d' /tmp/schema.diff
fi

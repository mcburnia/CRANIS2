#!/usr/bin/env bash
# Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
# SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
#
# This file is part of CRANIS2 — a personally-owned, personally-funded
# software product. Unauthorised copying, modification, distribution,
# or commercial use is prohibited. For licence enquiries:
# andi@mcburnie.com

# ──────────────────────────────────────────────────────────────────────
# CRANIS2 — Restricted prod-ops dispatcher (forced command, promote key)
#
# This is the ONLY command the restricted promotion key may run. It is set
# as the forced command in ~/.ssh/authorized_keys:
#
#   command="/home/mcburnia/cranis2/scripts/prod-ops-dispatch.sh",no-pty,\
#   no-port-forwarding,no-agent-forwarding,no-X11-forwarding ssh-ed25519 …
#
# The requested operation arrives in $SSH_ORIGINAL_COMMAND. We split it into
# words (no eval, no glob), accept only a small verb whitelist, validate every
# argument against strict patterns, and deny + log anything else. A leaked key
# can therefore only trigger these exact operations — never a shell.
#
# Verbs:
#   health                          → backend HTTP health code (e.g. "200")
#   disk                            → free KiB on /
#   rowcounts                       → critical-table counts
#   backup                          → backup-databases.sh --pre-upgrade
#   deploy --tag T [--migration M]  → deploy-on-prod.sh …
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

mkdir -p "${PROJECT_ROOT}/logs"
LOG="${PROJECT_ROOT}/logs/prod-ops-dispatch.log"
ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }
deny() { echo "$(ts) DENY from=${SSH_CONNECTION:-?} cmd=[${SSH_ORIGINAL_COMMAND:-}] reason=$1" >> "$LOG"; echo "prod-ops-dispatch: denied ($1)" >&2; exit 1; }
allow() { echo "$(ts) ALLOW from=${SSH_CONNECTION:-?} verb=$1" >> "$LOG"; }

# DB identifiers (never the password — psql runs via docker exec)
if [ -f "${PROJECT_ROOT}/.env" ]; then
  # shellcheck disable=SC2046
  export $(grep -E '^(POSTGRES_USER|POSTGRES_DB)=' "${PROJECT_ROOT}/.env" | xargs) || true
fi
PG_USER="${POSTGRES_USER:-cranis2}"
PG_DB="${POSTGRES_DB:-cranis2}"

# Split the requested command into words — NO eval, NO glob expansion.
read -r -a A <<< "${SSH_ORIGINAL_COMMAND:-}"
VERB="${A[0]:-}"

TAG_RE='^prod-release-[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]+$'
MIG_RE='^migrations/release-[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]+\.sql$'

case "$VERB" in
  health)
    [ "${#A[@]}" -eq 1 ] || deny "health takes no args"
    allow health
    curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api/health
    ;;
  disk)
    [ "${#A[@]}" -eq 1 ] || deny "disk takes no args"
    allow disk
    df -k --output=avail / | tail -1 | tr -d ' '
    ;;
  rowcounts)
    [ "${#A[@]}" -eq 1 ] || deny "rowcounts takes no args"
    allow rowcounts
    docker exec cranis2_postgres psql -U "$PG_USER" -d "$PG_DB" -tAc \
      "SELECT 'users='||count(*) FROM users UNION ALL SELECT 'products='||count(*) FROM products UNION ALL SELECT 'org_billing='||count(*) FROM org_billing;"
    ;;
  backup)
    [ "${#A[@]}" -eq 1 ] || deny "backup takes no args"
    allow backup
    ./scripts/backup-databases.sh --pre-upgrade
    ;;
  deploy)
    TAG=""; MIG=""; i=1
    while [ "$i" -lt "${#A[@]}" ]; do
      case "${A[$i]}" in
        --tag)       TAG="${A[$((i+1))]:-}"; i=$((i+2)) ;;
        --migration) MIG="${A[$((i+1))]:-}"; i=$((i+2)) ;;
        *) deny "deploy: unexpected arg '${A[$i]}'" ;;
      esac
    done
    [[ "$TAG" =~ $TAG_RE ]] || deny "deploy: invalid --tag"
    if [ -n "$MIG" ]; then
      [[ "$MIG" =~ $MIG_RE ]] || deny "deploy: invalid --migration path"
    fi
    allow "deploy ${TAG}"
    if [ -n "$MIG" ]; then
      ./scripts/deploy-on-prod.sh --tag "$TAG" --migration "$MIG"
    else
      ./scripts/deploy-on-prod.sh --tag "$TAG"
    fi
    ;;
  *)
    deny "unknown verb '${VERB}'"
    ;;
esac

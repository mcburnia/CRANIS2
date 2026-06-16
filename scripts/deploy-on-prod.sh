#!/usr/bin/env bash
# Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
# SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
#
# This file is part of CRANIS2 — a personally-owned, personally-funded
# software product. Unauthorised copying, modification, distribution,
# or commercial use is prohibited. For licence enquiries:
# andi@mcburnie.com

# ──────────────────────────────────────────────────────────────────────
# CRANIS2 — Prod-side deploy executor (promotion pipeline, Phase 0)
#
# Runs ON the production host. Invoked by scripts/promote-to-prod.sh and,
# in Phase 2, by a restricted forced-command CI deploy key. It performs the
# prod-side half of the promotion runbook (docs/promotion-process.md §7
# steps 4–6): clean-tree guard → checkout the vetted release tag → rebuild
# → wait for health → apply the (transaction-wrapped) release migration.
#
# CUSTOMER-DATA INVARIANT (CLAUDE.md rule 14): this script never drops,
# deletes, or truncates customer data. It only moves code/containers and
# runs a release .sql that is itself BEGIN/COMMIT-wrapped and idempotent.
#
# Usage (on prod):
#   ./scripts/deploy-on-prod.sh --tag <release-tag> [--migration <file>] [--no-build]
#
# Forced-command use (restricted key): args may arrive via
# SSH_ORIGINAL_COMMAND; this script extracts them.
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

log() { echo "[$(date -u +%H:%M:%S)] deploy-on-prod: $*"; }
die() { echo "[$(date -u +%H:%M:%S)] deploy-on-prod: ERROR: $*" >&2; exit 1; }

# Load DB identifiers (never the password — psql via docker exec uses peer/trust)
if [ -f "${PROJECT_ROOT}/.env" ]; then
  # shellcheck disable=SC2046
  export $(grep -E '^(POSTGRES_USER|POSTGRES_DB)=' "${PROJECT_ROOT}/.env" | xargs) || true
fi
PG_USER="${POSTGRES_USER:-cranis2}"
PG_DB="${POSTGRES_DB:-cranis2}"

# ── Argument parsing (supports restricted forced-command invocation) ──
if [ "$#" -eq 0 ] && [ -n "${SSH_ORIGINAL_COMMAND:-}" ]; then
  # Strip everything up to and including the script name, keep the args.
  # shellcheck disable=SC2086
  set -- ${SSH_ORIGINAL_COMMAND##*deploy-on-prod.sh}
fi

TAG=""
MIGRATION=""
DO_BUILD=true
while [ "$#" -gt 0 ]; do
  case "$1" in
    --tag)       TAG="${2:-}"; shift 2 ;;
    --migration) MIGRATION="${2:-}"; shift 2 ;;
    --no-build)  DO_BUILD=false; shift ;;
    "") shift ;;
    *) die "unknown argument: $1" ;;
  esac
done

[ -n "$TAG" ] || die "--tag <release-tag> is required"

# ── Gate 1: clean working tree (anti-contamination seatbelt) ──
# The May-2026 foreign-junk incident would have been blocked here.
DIRTY="$(git status --porcelain)"
if [ -n "$DIRTY" ]; then
  echo "$DIRTY" >&2
  die "working tree is NOT clean — refusing to deploy a contaminated checkout. Investigate the paths above."
fi

# ── Gate 2: fetch + verify the release tag exists on origin ──
log "fetching tags…"
git fetch --quiet origin --tags
git rev-parse -q --verify "refs/tags/${TAG}^{commit}" >/dev/null \
  || die "release tag '${TAG}' not found on origin"

PREV_REF="$(git rev-parse --short HEAD)"
log "current HEAD=${PREV_REF}; checking out ${TAG}…"
git checkout --quiet "tags/${TAG}"

# ── Build (frontend on host — nginx serves frontend/dist) + containers ──
if [ "$DO_BUILD" = true ]; then
  log "building frontend (npm ci && npm run build)…"
  # shellcheck disable=SC1090,SC1091
  [ -f "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
  ( cd frontend && npm ci && npm run build ) || die "frontend build failed (HEAD restorable to ${PREV_REF})"
  log "rebuilding backend + welcome containers…"
  docker compose up -d --build backend welcome || die "container rebuild failed (HEAD restorable to ${PREV_REF})"
else
  log "--no-build supplied: skipping rebuild"
fi

# ── Wait for backend health (initDb() applies additive schema on startup) ──
log "waiting for backend health…"
HEALTH_CODE=""
for i in $(seq 1 30); do
  HEALTH_CODE="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api/health || true)"
  [ "$HEALTH_CODE" = "200" ] && { log "backend healthy"; break; }
  [ "$i" -eq 30 ] && die "backend not healthy after deploy (last code: ${HEALTH_CODE:-none}); roll back to ${PREV_REF} per docs/promotion-process.md §8"
  sleep 2
done

# ── Apply release migration (the .sql is BEGIN/COMMIT-wrapped + idempotent) ──
if [ -n "$MIGRATION" ]; then
  [ -f "$MIGRATION" ] || die "migration file not found: ${MIGRATION}"
  log "applying migration: ${MIGRATION}"
  docker exec -i cranis2_postgres psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 < "$MIGRATION" \
    || die "migration failed — transaction rolled back, DB unchanged. Investigate before re-promoting."
  log "migration applied"
fi

log "DEPLOY COMPLETE ${TAG}"

#!/usr/bin/env bash
# Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
# SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
#
# This file is part of CRANIS2 — a personally-owned, personally-funded
# software product. Unauthorised copying, modification, distribution,
# or commercial use is prohibited. For licence enquiries:
# andi@mcburnie.com

# ──────────────────────────────────────────────────────────────────────
# CRANIS2 — Dev→Prod promotion orchestrator (promotion pipeline, Phase 0)
#
# Implements the human-readable runbook in docs/promotion-process.md §7.
# Runs on the DEV host (the source of truth: it has the git repo, Postgres
# for the migration dry-run, and node). Prod-side steps are performed over
# SSH via $PROD_SSH (default: cranis2-prod). In Phase 2 that channel becomes
# a restricted forced-command CI key whose only command is deploy-on-prod.sh.
#
# Promotion is a DELIBERATE, GATED, EVIDENCED event — never an ad-hoc push
# (docs/promotion-process.md §1). Every gate below can abort the release.
#
# Usage:
#   ./scripts/promote-to-prod.sh --tag <release-tag> \
#       --assessment-sha <sha256> --script-sha <sha256> [--prod-ssh <alias>]
#
#   ./scripts/promote-to-prod.sh --tag <release-tag> --check
#       Run every pre-flight gate, change nothing, print the file SHAs.
#
#   ...add --local-only to --check to skip the prod-side gates (dev testing).
#
# Release tag form:  prod-release-YYYY-MM-DD-<slug>
# Migration files:   migrations/release-YYYY-MM-DD-<slug>.{md,sql}
#                    (the file slug is the tag with any leading "prod-" removed)
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# ── Defaults / args ──
TAG=""
ASSESS_SHA=""
SCRIPT_SHA=""
PROD_SSH="cranis2-prod"
CHECK_ONLY=false
LOCAL_ONLY=false
ASSUME_YES=false
MIN_PROD_FREE_KB=1048576   # require ≥1 GiB free on prod for the backup

while [ "$#" -gt 0 ]; do
  case "$1" in
    --tag)            TAG="${2:-}"; shift 2 ;;
    --assessment-sha) ASSESS_SHA="${2:-}"; shift 2 ;;
    --script-sha)     SCRIPT_SHA="${2:-}"; shift 2 ;;
    --prod-ssh)       PROD_SSH="${2:-}"; shift 2 ;;
    --check)          CHECK_ONLY=true; shift ;;
    --local-only)     LOCAL_ONLY=true; shift ;;
    --yes)            ASSUME_YES=true; shift ;;
    -h|--help)        sed -n '11,40p' "$0"; exit 0 ;;
    *) echo "promote: unknown argument: $1" >&2; exit 2 ;;
  esac
done

log()  { echo "[$(date -u +%H:%M:%S)] promote: $*"; }
ok()   { echo "  ✓ $*"; }
die()  { echo "[$(date -u +%H:%M:%S)] promote: ABORT: $*" >&2; exit 1; }
prod() { ssh -o ConnectTimeout=15 "$PROD_SSH" "$@"; }

[ -n "$TAG" ] || die "--tag <release-tag> is required"
SLUG="${TAG#prod-}"                              # prod-release-… → release-…
ASSESS="migrations/${SLUG}.md"
SQL="migrations/${SLUG}.sql"

echo "──────────────────────────────────────────────────────────"
echo " CRANIS2 promotion — ${TAG}"
echo "  assessment: ${ASSESS}"
echo "  migration:  ${SQL}"
echo "  prod ssh:   ${PROD_SSH}"
[ "$CHECK_ONLY" = true ] && echo "  MODE:       --check (no changes will be made)"
echo "──────────────────────────────────────────────────────────"

# ══ STEP 1 — Pre-flight gates (§7 Step 1) ═════════════════════════════
log "Step 1 — pre-flight gates"

# 1a. Working tree clean.
[ -z "$(git status --porcelain)" ] || die "working tree is not clean — commit, stash, or clean it (a dirty tree is how foreign files reach prod)"
ok "working tree clean"

# 1b. Release tag exists and points at the current HEAD (promote what dev tested).
git rev-parse -q --verify "refs/tags/${TAG}^{commit}" >/dev/null || die "tag '${TAG}' does not exist — tag the tested commit first"
if [ "$(git rev-parse "${TAG}^{commit}")" != "$(git rev-parse HEAD)" ]; then
  die "tag '${TAG}' does not point at HEAD — check out the exact tested commit before promoting"
fi
ok "tag ${TAG} == HEAD ($(git rev-parse --short HEAD))"

# 1c/1d. Assessment + migration files exist.
[ -f "$ASSESS" ] || die "assessment document missing: ${ASSESS} (see docs/promotion-process.md §6)"
[ -f "$SQL" ]    || die "migration script missing: ${SQL} (a zero-change release still needs a no-op stub — §6.1)"
ok "assessment and migration files present"

# 1d. Sign-off line present (§6.2 item 7).
grep -Eq 'Assessed and approved for promotion: .* — Andi MCBURNIE' "$ASSESS" \
  || die "assessment ${ASSESS} is missing the sign-off line 'Assessed and approved for promotion: <date> — Andi MCBURNIE'"
ok "assessment is signed off"

# 1e. SHA gate — force the operator to look at the actual files.
ACTUAL_ASSESS_SHA="$(sha256sum "$ASSESS" | awk '{print $1}')"
ACTUAL_SCRIPT_SHA="$(sha256sum "$SQL"    | awk '{print $1}')"
if [ "$CHECK_ONLY" = true ] && [ -z "$ASSESS_SHA$SCRIPT_SHA" ]; then
  echo "    assessment sha256: ${ACTUAL_ASSESS_SHA}"
  echo "    migration  sha256: ${ACTUAL_SCRIPT_SHA}"
  echo "    (pass these as --assessment-sha / --script-sha for the real run)"
else
  [ "$ASSESS_SHA" = "$ACTUAL_ASSESS_SHA" ] || die "--assessment-sha mismatch (expected ${ACTUAL_ASSESS_SHA}). Re-read ${ASSESS}."
  [ "$SCRIPT_SHA" = "$ACTUAL_SCRIPT_SHA" ] || die "--script-sha mismatch (expected ${ACTUAL_SCRIPT_SHA}). Re-read ${SQL}."
  ok "assessment + migration SHAs match the committed files"
fi

# 1f/1g. Prod is healthy and has disk headroom for a backup.
if [ "$LOCAL_ONLY" = true ]; then
  echo "  • skipping prod-side gates (--local-only)"
else
  HC="$(prod 'curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health' || true)"
  [ "$HC" = "200" ] || die "prod /api/health did not return 200 (got: ${HC:-unreachable}). Refusing to promote onto an unhealthy host."
  ok "prod /api/health = 200"
  FREE_KB="$(prod 'df -k --output=avail / | tail -1' | tr -d ' ' || true)"
  if [ -n "$FREE_KB" ] && [ "$FREE_KB" -lt "$MIN_PROD_FREE_KB" ]; then
    die "prod free disk on / is ${FREE_KB} KiB (< ${MIN_PROD_FREE_KB} KiB) — free space before promoting"
  fi
  ok "prod disk headroom OK (${FREE_KB:-?} KiB free on /)"
fi

# ── Migration dry-run (§7 Step 3) — runs against a dev scratch DB ──
# Confirms the migration executes cleanly AND idempotently against the
# current schema. The customer-data row-count evidence lives in the signed
# assessment (the gate verifies that exists; it does not re-do the work).
log "Step 3 — migration dry-run (dev scratch DB, idempotency check)"
SCRATCH="cranis2_promotion_test"
PG="docker exec -i cranis2_postgres psql -U cranis2"
docker exec cranis2_postgres psql -U cranis2 -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS ${SCRATCH};" -c "CREATE DATABASE ${SCRATCH};" >/dev/null \
  || die "could not create scratch DB ${SCRATCH} on dev"
docker exec cranis2_postgres pg_dump -U cranis2 --schema-only cranis2 \
  | $PG -d "$SCRATCH" -q >/dev/null 2>&1 || die "could not load dev schema into scratch DB"
$PG -d "$SCRATCH" -v ON_ERROR_STOP=1 -q < "$SQL" || die "migration failed on first apply against scratch schema"
$PG -d "$SCRATCH" -v ON_ERROR_STOP=1 -q < "$SQL" || die "migration is NOT idempotent — failed on second apply (§6.3 requires idempotent migrations)"
docker exec cranis2_postgres psql -U cranis2 -d postgres -c "DROP DATABASE IF EXISTS ${SCRATCH};" >/dev/null 2>&1 || true
ok "migration applies cleanly and idempotently"

# ── --check stops here ──
if [ "$CHECK_ONLY" = true ]; then
  echo "──────────────────────────────────────────────────────────"
  log "✓ ALL PRE-FLIGHT GATES PASSED — check mode, no changes made"
  exit 0
fi

# ── Confirmation ──
if [ "$ASSUME_YES" != true ]; then
  echo
  read -r -p "Promote ${TAG} to PRODUCTION (cranis2.com)? Type 'promote' to proceed: " REPLY
  [ "$REPLY" = "promote" ] || die "not confirmed"
fi

# ══ STEP 2 — Pre-promotion backup (§7 Step 2, CLAUDE.md rule 12) ══════
log "Step 2 — pre-promotion backup on prod"
prod './scripts/backup-databases.sh --pre-upgrade' | tee /tmp/promote-backup.log
grep -q 'BACKUP COMPLETE' /tmp/promote-backup.log || die "prod backup did not report BACKUP COMPLETE — aborting before any deploy"
ok "pre-promotion backup complete"

# ══ STEP 4+5 — Deploy code + apply migration on prod (§7 Steps 4–5) ══
log "Step 4/5 — deploy ${TAG} to prod"
prod "./scripts/deploy-on-prod.sh --tag ${TAG} --migration ${SQL}" | tee /tmp/promote-deploy.log
grep -q "DEPLOY COMPLETE ${TAG}" /tmp/promote-deploy.log || die "deploy did not complete — see output above; roll back per §8 if prod is degraded"
ok "code deployed and migration applied"

# ══ STEP 6 — Post-promotion verification (§7 Step 6) ═════════════════
log "Step 6 — post-promotion verification"
HC="$(prod 'curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health' || true)"
[ "$HC" = "200" ] || die "post-deploy /api/health is ${HC:-unreachable} — investigate / roll back (§8)"
ok "prod /api/health = 200"
echo "  critical-table row counts (prod):"
prod "docker exec cranis2_postgres psql -U cranis2 -d cranis2 -tAc \"SELECT 'users='||count(*) FROM users UNION ALL SELECT 'products='||count(*) FROM products UNION ALL SELECT 'org_billing='||count(*) FROM org_billing;\"" 2>/dev/null | sed 's/^/    /' || true

echo "──────────────────────────────────────────────────────────"
log "✓ PROMOTION COMPLETE — ${TAG} is live on cranis2.com"
echo "  Next (§7 Step 7): update RESTART.md with the release summary;"
echo "  notify customers if there are user-visible changes."

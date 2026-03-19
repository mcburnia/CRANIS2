#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# CRANIS2 — Manual Rollback Script
#
# Reverts to a previous state after an upgrade. Can rollback:
#   - Code (git revert to a specific commit)
#   - Database (restore from a pre-upgrade backup)
#   - Both (default)
#
# Usage:
#   ./scripts/rollback-upgrade.sh                           # list available rollback points
#   ./scripts/rollback-upgrade.sh <backup-dir>              # full rollback (code + DB)
#   ./scripts/rollback-upgrade.sh <backup-dir> --db-only    # database only
#   ./scripts/rollback-upgrade.sh <backup-dir> --code-only  # code only (git revert)
#   ./scripts/rollback-upgrade.sh --to-commit <sha>         # revert code to specific commit
#
# Exit codes:
#   0 = rollback successful
#   1 = rollback failed
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${PROJECT_ROOT}/logs"
TIMESTAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
LOG_FILE="${LOG_DIR}/rollback-${TIMESTAMP}.log"

# ── Parse arguments ──────────────────────────────────────────────────

BACKUP_DIR=""
DB_ONLY=false
CODE_ONLY=false
TARGET_COMMIT=""

while [ $# -gt 0 ]; do
  case "$1" in
    --db-only)     DB_ONLY=true ;;
    --code-only)   CODE_ONLY=true ;;
    --to-commit)   shift; TARGET_COMMIT="${1:-}" ;;
    --to-commit=*) TARGET_COMMIT="${1#--to-commit=}" ;;
    *)
      if [ -z "$BACKUP_DIR" ]; then
        if [[ "$1" = /* ]]; then
          BACKUP_DIR="$1"
        else
          BACKUP_DIR="${PROJECT_ROOT}/$1"
        fi
      else
        echo "Unknown argument: $1"
        exit 1
      fi
      ;;
  esac
  shift
done

mkdir -p "${LOG_DIR}"

# ── Logging ──────────────────────────────────────────────────────────

log() {
  local msg="[$(date -u +%H:%M:%S)] $*"
  echo "$msg"
  echo "$msg" >> "${LOG_FILE}" 2>/dev/null || true
}

log_section() {
  log ""
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log "  $*"
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# ── List available rollback points ──────────────────────────────────

list_rollback_points() {
  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║           CRANIS2 AVAILABLE ROLLBACK POINTS                ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo ""

  # Pre-upgrade backups
  echo "  Database backups (pre-upgrade):"
  local pre_upgrade_dirs=()
  if [ -d "${PROJECT_ROOT}/backups/pre-upgrade" ]; then
    while IFS= read -r d; do
      [ -n "$d" ] && pre_upgrade_dirs+=("$d")
    done < <(find "${PROJECT_ROOT}/backups/pre-upgrade" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort -r)
  fi

  if [ ${#pre_upgrade_dirs[@]} -eq 0 ]; then
    echo "    (none found)"
  else
    for d in "${pre_upgrade_dirs[@]}"; do
      local name
      name=$(basename "$d")
      local size
      size=$(du -sh "$d" 2>/dev/null | cut -f1)
      local manifest_info=""
      if [ -f "$d/manifest.json" ]; then
        local has_pg has_neo4j
        has_pg=$(grep -o '"postgres_cranis2": true' "$d/manifest.json" 2>/dev/null && echo "PG" || echo "")
        has_neo4j=$(grep -o '"neo4j": true' "$d/manifest.json" 2>/dev/null && echo "Neo4j" || echo "")
        manifest_info=" [${has_pg:+PG }${has_neo4j:+Neo4j}]"
      fi
      echo "    ${name}  (${size})${manifest_info}"
      echo "      → ./scripts/rollback-upgrade.sh backups/pre-upgrade/${name}"
    done
  fi

  echo ""

  # Daily backups
  echo "  Database backups (daily):"
  local daily_dirs=()
  if [ -d "${PROJECT_ROOT}/backups/daily" ]; then
    while IFS= read -r d; do
      [ -n "$d" ] && daily_dirs+=("$d")
    done < <(find "${PROJECT_ROOT}/backups/daily" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort -r | head -5)
  fi

  if [ ${#daily_dirs[@]} -eq 0 ]; then
    echo "    (none found)"
  else
    for d in "${daily_dirs[@]}"; do
      local name
      name=$(basename "$d")
      local size
      size=$(du -sh "$d" 2>/dev/null | cut -f1)
      echo "    ${name}  (${size})"
      echo "      → ./scripts/rollback-upgrade.sh backups/daily/${name}"
    done
  fi

  echo ""

  # Recent git commits
  echo "  Recent commits (code-only rollback):"
  cd "${PROJECT_ROOT}"
  git log --oneline -10 2>/dev/null | while read -r line; do
    echo "    ${line}"
  done
  echo "      → ./scripts/rollback-upgrade.sh --to-commit <sha> --code-only"

  echo ""

  # Upgrade reports
  echo "  Recent upgrade reports:"
  find "${LOG_DIR}" -name 'upgrade-report-*.json' 2>/dev/null \
    | sort -r | head -5 | while read -r f; do
      local name
      name=$(basename "$f")
      local status
      status=$(grep -o '"status": "[^"]*"' "$f" 2>/dev/null | cut -d'"' -f4)
      local prev
      prev=$(grep -o '"previous_commit": "[^"]*"' "$f" 2>/dev/null | cut -d'"' -f4)
      echo "    ${name}  status=${status}  prev=${prev:0:7}"
    done

  local report_count
  report_count=$(find "${LOG_DIR}" -name 'upgrade-report-*.json' 2>/dev/null | wc -l)
  if [ "$report_count" -eq 0 ]; then
    echo "    (none found)"
  fi

  echo ""
}

# ── Rollback code ───────────────────────────────────────────────────

rollback_code() {
  log_section "ROLLING BACK CODE"

  cd "${PROJECT_ROOT}"

  # Determine target commit
  local commit="$TARGET_COMMIT"
  if [ -z "$commit" ]; then
    # Try to find it from the upgrade report associated with this backup
    if [ -n "$BACKUP_DIR" ]; then
      local backup_ts
      backup_ts=$(basename "$BACKUP_DIR")
      local report
      report=$(find "${LOG_DIR}" -name "upgrade-report-*.json" 2>/dev/null | sort -r | head -1)
      if [ -n "$report" ]; then
        commit=$(grep -o '"previous_commit": "[^"]*"' "$report" 2>/dev/null | cut -d'"' -f4 || true)
      fi
    fi
  fi

  if [ -z "$commit" ]; then
    log "ERROR: No target commit specified and could not determine from upgrade report."
    log "Use --to-commit <sha> to specify explicitly."
    return 1
  fi

  # Verify the commit exists
  if ! git cat-file -t "$commit" > /dev/null 2>&1; then
    log "ERROR: Commit ${commit} does not exist"
    return 1
  fi

  local current_commit
  current_commit=$(git rev-parse HEAD)
  log "Current commit: ${current_commit:0:7}"
  log "Target commit:  ${commit:0:7}"

  if [ "$current_commit" = "$commit" ]; then
    log "Already at target commit. Nothing to do."
    return 0
  fi

  # Revert by checking out the target commit's tree
  log "Reverting code..."
  git checkout "$commit" -- . 2>&1 | while read -r line; do
    log "  ${line}"
  done

  # Reinstall dependencies
  log "Reinstalling dependencies..."
  local workspaces=("backend" "frontend" "welcome")
  for ws in "${workspaces[@]}"; do
    if [ -f "${PROJECT_ROOT}/${ws}/package-lock.json" ]; then
      bash -c "source ~/.nvm/nvm.sh && cd '${PROJECT_ROOT}/${ws}' && npm ci --ignore-scripts" > /dev/null 2>&1 || true
    fi
  done

  # Rebuild frontend
  log "Rebuilding frontend..."
  bash -c "source ~/.nvm/nvm.sh && cd '${PROJECT_ROOT}/frontend' && npm run build" > /dev/null 2>&1 || true

  # Rebuild containers
  log "Rebuilding containers..."
  docker compose -f "${PROJECT_ROOT}/docker-compose.yml" up -d --build backend welcome nginx 2>&1 | while read -r line; do
    log "  ${line}"
  done || true

  log "Code rolled back to ${commit:0:7}"
}

# ── Rollback database ──────────────────────────────────────────────

rollback_database() {
  log_section "ROLLING BACK DATABASE"

  if [ -z "$BACKUP_DIR" ] || [ ! -d "$BACKUP_DIR" ]; then
    log "ERROR: No valid backup directory specified"
    return 1
  fi

  log "Backup directory: ${BACKUP_DIR}"

  # Delegate to restore script (it handles confirmation, safety backup, etc.)
  "${PROJECT_ROOT}/scripts/restore-databases.sh" "${BACKUP_DIR}"
}

# ── Health check ────────────────────────────────────────────────────

post_rollback_health() {
  log_section "POST-ROLLBACK HEALTH CHECK"
  local errors=0

  # Backend
  log "Checking backend..."
  local waited=0
  while ! curl -sf http://localhost:3001/api/health > /dev/null 2>&1; do
    sleep 2
    waited=$((waited + 2))
    if [ "$waited" -ge 60 ]; then
      log "FAIL: Backend not healthy after 60s"
      errors=$((errors + 1))
      break
    fi
  done
  if [ "$waited" -lt 60 ]; then
    log "PASS: Backend healthy (${waited}s)"
  fi

  # Frontend
  if curl -sf http://localhost:3002 > /dev/null 2>&1; then
    log "PASS: Frontend responding"
  else
    log "FAIL: Frontend not responding"
    errors=$((errors + 1))
  fi

  # Neo4j
  if [ -f "${PROJECT_ROOT}/.env" ]; then
    # shellcheck disable=SC2046
    export $(grep -E '^(NEO4J_PASSWORD|POSTGRES_PASSWORD)=' "${PROJECT_ROOT}/.env" | xargs)
  fi
  if docker exec cranis2_neo4j cypher-shell -u neo4j -p "${NEO4J_PASSWORD:-cranis2_dev_2026}" \
    "RETURN 1" > /dev/null 2>&1; then
    log "PASS: Neo4j responding"
  else
    log "FAIL: Neo4j not responding"
    errors=$((errors + 1))
  fi

  if [ "$errors" -gt 0 ]; then
    log ""
    log "WARNING: ${errors} health check(s) failed after rollback"
    log "Manual intervention may be required."
    return 1
  fi

  log ""
  log "All health checks passed."
  return 0
}

# ── Main ─────────────────────────────────────────────────────────────

main() {
  # If no arguments, show available rollback points
  if [ -z "$BACKUP_DIR" ] && [ -z "$TARGET_COMMIT" ]; then
    list_rollback_points
    exit 0
  fi

  log "╔══════════════════════════════════════════════════════════════╗"
  log "║              CRANIS2 MANUAL ROLLBACK                       ║"
  log "╚══════════════════════════════════════════════════════════════╝"
  log ""
  log "Timestamp: ${TIMESTAMP}"
  if [ -n "$BACKUP_DIR" ]; then
    log "Backup: ${BACKUP_DIR}"
  fi
  if [ -n "$TARGET_COMMIT" ]; then
    log "Target commit: ${TARGET_COMMIT}"
  fi
  log "Mode: $([ "$DB_ONLY" = true ] && echo 'database only' || ([ "$CODE_ONLY" = true ] && echo 'code only' || echo 'full rollback'))"
  log ""

  # Confirmation
  echo "  ⚠  This will rollback your CRANIS2 installation."
  echo ""
  read -rp "  Type 'ROLLBACK' to confirm: " CONFIRM
  if [ "$CONFIRM" != "ROLLBACK" ]; then
    echo "  Aborted."
    exit 0
  fi
  echo ""

  local errors=0

  # Rollback code
  if [ "$DB_ONLY" = false ]; then
    if ! rollback_code; then
      log "Code rollback failed"
      errors=$((errors + 1))
    fi
  fi

  # Rollback database
  if [ "$CODE_ONLY" = false ] && [ -n "$BACKUP_DIR" ]; then
    if ! rollback_database; then
      log "Database rollback failed"
      errors=$((errors + 1))
    fi
  fi

  # Health check
  post_rollback_health || true

  if [ "$errors" -gt 0 ]; then
    log_section "ROLLBACK COMPLETED WITH ERRORS"
    log "Some steps failed. Check the log: ${LOG_FILE}"
    exit 1
  fi

  log_section "ROLLBACK COMPLETE"
  log "Verify at: https://dev.cranis2.dev"
  log "Log: ${LOG_FILE}"
  exit 0
}

main

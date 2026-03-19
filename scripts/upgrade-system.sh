#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# CRANIS2 — System Upgrade Script
#
# Performs a safe, repeatable upgrade of the CRANIS2 stack:
#   1. Pre-flight checks (disk, containers, health)
#   2. Pre-upgrade database backup
#   3. Git pull latest changes
#   4. Dependency install (all workspaces)
#   5. Frontend build
#   6. Container rebuild
#   7. Post-upgrade health checks
#   8. Automatic rollback if health checks fail
#
# Usage:
#   ./scripts/upgrade-system.sh                  # standard upgrade
#   ./scripts/upgrade-system.sh --skip-backup    # skip pre-upgrade backup (not recommended)
#   ./scripts/upgrade-system.sh --dry-run        # show what would happen without doing it
#   ./scripts/upgrade-system.sh --branch feature # pull a specific branch (default: main)
#
# Exit codes:
#   0 = upgrade successful
#   1 = upgrade failed (rollback attempted)
#   2 = pre-flight checks failed (nothing changed)
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${PROJECT_ROOT}/logs"
TIMESTAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
LOG_FILE="${LOG_DIR}/upgrade-${TIMESTAMP}.log"

# ── Parse arguments ──────────────────────────────────────────────────

SKIP_BACKUP=false
DRY_RUN=false
BRANCH="main"
for arg in "$@"; do
  case "$arg" in
    --skip-backup) SKIP_BACKUP=true ;;
    --dry-run)     DRY_RUN=true ;;
    --branch)      shift; BRANCH="${1:-main}" ;;
    --branch=*)    BRANCH="${arg#--branch=}" ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
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

# ── State tracking ───────────────────────────────────────────────────

PREVIOUS_COMMIT=""
BACKUP_DIR=""
CONTAINERS_STOPPED=false
UPGRADE_REPORT="${PROJECT_ROOT}/logs/upgrade-report-${TIMESTAMP}.json"

# ── Pre-flight checks ───────────────────────────────────────────────

preflight_checks() {
  log_section "PRE-FLIGHT CHECKS"
  local errors=0

  # 1. Disk space (need at least 2GB free)
  local free_kb
  free_kb=$(df -k "${PROJECT_ROOT}" | tail -1 | awk '{print $4}')
  local free_gb=$(( free_kb / 1048576 ))
  if [ "$free_kb" -lt 2097152 ]; then
    log "FAIL: Insufficient disk space (${free_gb}GB free, need 2GB)"
    errors=$((errors + 1))
  else
    log "PASS: Disk space (${free_gb}GB free)"
  fi

  # 2. Docker daemon running
  if ! docker info > /dev/null 2>&1; then
    log "FAIL: Docker daemon is not running"
    errors=$((errors + 1))
  else
    log "PASS: Docker daemon running"
  fi

  # 3. Required containers exist
  local required_containers=("cranis2_backend" "cranis2_postgres" "cranis2_neo4j" "cranis2_nginx")
  for container in "${required_containers[@]}"; do
    if ! docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
      log "FAIL: Container ${container} does not exist"
      errors=$((errors + 1))
    fi
  done
  if [ "$errors" -eq 0 ]; then
    log "PASS: All required containers exist"
  fi

  # 4. Backend health check
  if ! curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
    log "WARN: Backend health check failed (may be down — will attempt upgrade anyway)"
  else
    log "PASS: Backend is healthy"
  fi

  # 5. Git status — warn about uncommitted changes
  if [ -n "$(cd "${PROJECT_ROOT}" && git status --porcelain 2>/dev/null)" ]; then
    log "WARN: Uncommitted changes detected — these will NOT be overwritten by git pull"
  else
    log "PASS: Working directory clean"
  fi

  # 6. Node.js available
  if ! bash -c 'source ~/.nvm/nvm.sh && node --version' > /dev/null 2>&1; then
    log "FAIL: Node.js not available via nvm"
    errors=$((errors + 1))
  else
    local node_ver
    node_ver=$(bash -c 'source ~/.nvm/nvm.sh && node --version' 2>/dev/null)
    log "PASS: Node.js ${node_ver}"
  fi

  # 7. Backup script exists
  if [ ! -x "${PROJECT_ROOT}/scripts/backup-databases.sh" ]; then
    log "FAIL: backup-databases.sh not found or not executable"
    errors=$((errors + 1))
  else
    log "PASS: Backup script available"
  fi

  if [ "$errors" -gt 0 ]; then
    log ""
    log "Pre-flight checks failed with ${errors} error(s). Aborting."
    return 1
  fi

  log ""
  log "All pre-flight checks passed."
  return 0
}

# ── Record current state ────────────────────────────────────────────

record_current_state() {
  log_section "RECORDING CURRENT STATE"

  PREVIOUS_COMMIT=$(cd "${PROJECT_ROOT}" && git rev-parse HEAD 2>/dev/null || echo "unknown")
  log "Current commit: ${PREVIOUS_COMMIT}"

  local container_images
  container_images=$(docker ps --format '{{.Names}}: {{.Image}}' 2>/dev/null | grep cranis2 || true)
  log "Running containers:"
  echo "$container_images" | while read -r line; do
    log "  ${line}"
  done
}

# ── Pre-upgrade backup ──────────────────────────────────────────────

pre_upgrade_backup() {
  if [ "$SKIP_BACKUP" = true ]; then
    log_section "PRE-UPGRADE BACKUP (SKIPPED)"
    log "Skipped by --skip-backup flag"
    return 0
  fi

  log_section "PRE-UPGRADE BACKUP"
  log "Running backup-databases.sh --pre-upgrade..."

  if "${PROJECT_ROOT}/scripts/backup-databases.sh" --pre-upgrade 2>&1 | while read -r line; do log "  ${line}"; done; then
    # Find the backup directory just created
    BACKUP_DIR=$(find "${PROJECT_ROOT}/backups/pre-upgrade" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort -r | head -1)
    log "Backup stored at: ${BACKUP_DIR}"
  else
    log "ERROR: Pre-upgrade backup failed"
    log "Aborting upgrade. Fix the backup issue before proceeding."
    return 1
  fi
}

# ── Pull latest code ────────────────────────────────────────────────

pull_latest() {
  log_section "PULLING LATEST CODE"
  log "Branch: ${BRANCH}"

  cd "${PROJECT_ROOT}"

  # Fetch first to check what's coming
  if ! git fetch origin "${BRANCH}" 2>&1 | while read -r line; do log "  ${line}"; done; then
    log "ERROR: git fetch failed"
    return 1
  fi

  local local_commit
  local_commit=$(git rev-parse HEAD)
  local remote_commit
  remote_commit=$(git rev-parse "origin/${BRANCH}" 2>/dev/null || echo "unknown")

  if [ "$local_commit" = "$remote_commit" ]; then
    log "Already up to date (${local_commit:0:7})"
  else
    local commit_count
    commit_count=$(git rev-list HEAD.."origin/${BRANCH}" --count 2>/dev/null || echo "?")
    log "Pulling ${commit_count} new commit(s)..."

    if ! git pull origin "${BRANCH}" 2>&1 | while read -r line; do log "  ${line}"; done; then
      log "ERROR: git pull failed"
      log "Resolve conflicts manually, then re-run the upgrade."
      return 1
    fi

    local new_commit
    new_commit=$(git rev-parse HEAD)
    log "Updated: ${local_commit:0:7} → ${new_commit:0:7}"

    # Show what changed
    log "Changes:"
    git log --oneline "${local_commit}..HEAD" 2>/dev/null | while read -r line; do
      log "  ${line}"
    done
  fi
}

# ── Install dependencies ────────────────────────────────────────────

install_dependencies() {
  log_section "INSTALLING DEPENDENCIES"

  local workspaces=("backend" "frontend" "e2e" "welcome" "mcp")
  for ws in "${workspaces[@]}"; do
    if [ -f "${PROJECT_ROOT}/${ws}/package.json" ]; then
      log "Installing ${ws} dependencies..."
      if ! bash -c "source ~/.nvm/nvm.sh && cd '${PROJECT_ROOT}/${ws}' && npm ci --ignore-scripts 2>&1" | tail -1 | while read -r line; do log "  ${line}"; done; then
        log "  WARNING: npm ci failed for ${ws}, trying npm install..."
        if ! bash -c "source ~/.nvm/nvm.sh && cd '${PROJECT_ROOT}/${ws}' && npm install 2>&1" | tail -1 | while read -r line; do log "  ${line}"; done; then
          log "  ERROR: npm install also failed for ${ws}"
          return 1
        fi
      fi
    fi
  done

  log "All dependencies installed."
}

# ── Build frontend ──────────────────────────────────────────────────

build_frontend() {
  log_section "BUILDING FRONTEND"
  log "Running tsc + vite build + SEO injection..."

  if ! bash -c "source ~/.nvm/nvm.sh && cd '${PROJECT_ROOT}/frontend' && npm run build 2>&1" | tail -5 | while read -r line; do log "  ${line}"; done; then
    log "ERROR: Frontend build failed"
    return 1
  fi

  local dist_size
  dist_size=$(du -sh "${PROJECT_ROOT}/frontend/dist" 2>/dev/null | cut -f1)
  log "Frontend built (${dist_size})"
}

# ── Rebuild containers ──────────────────────────────────────────────

rebuild_containers() {
  log_section "REBUILDING CONTAINERS"

  log "Rebuilding backend, welcome, and nginx containers..."
  if ! docker compose -f "${PROJECT_ROOT}/docker-compose.yml" up -d --build backend welcome nginx 2>&1 | while read -r line; do log "  ${line}"; done; then
    log "ERROR: Container rebuild failed"
    CONTAINERS_STOPPED=true
    return 1
  fi

  log "Containers rebuilt and started."
}

# ── Post-upgrade health checks ──────────────────────────────────────

post_upgrade_health_checks() {
  log_section "POST-UPGRADE HEALTH CHECKS"
  local errors=0

  # 1. Backend health — wait up to 60s
  log "Checking backend health..."
  local waited=0
  while ! curl -sf http://localhost:3001/api/health > /dev/null 2>&1; do
    sleep 2
    waited=$((waited + 2))
    if [ "$waited" -ge 60 ]; then
      log "FAIL: Backend did not become healthy within 60s"
      errors=$((errors + 1))
      break
    fi
  done
  if [ "$waited" -lt 60 ]; then
    log "PASS: Backend healthy after ${waited}s"
  fi

  # 2. Frontend serving
  log "Checking frontend..."
  if curl -sf http://localhost:3002 > /dev/null 2>&1; then
    log "PASS: Frontend responding on port 3002"
  else
    log "FAIL: Frontend not responding on port 3002"
    errors=$((errors + 1))
  fi

  # 3. Neo4j connectivity
  log "Checking Neo4j..."
  if docker exec cranis2_neo4j cypher-shell -u neo4j -p "${NEO4J_PASSWORD:-cranis2_dev_2026}" \
    "RETURN 1" > /dev/null 2>&1; then
    log "PASS: Neo4j responding"
  else
    log "FAIL: Neo4j not responding"
    errors=$((errors + 1))
  fi

  # 4. Postgres connectivity
  log "Checking Postgres..."
  if docker exec cranis2_postgres pg_isready -U "${POSTGRES_USER:-cranis2}" > /dev/null 2>&1; then
    log "PASS: Postgres responding"
  else
    log "FAIL: Postgres not responding"
    errors=$((errors + 1))
  fi

  # 5. All expected containers running
  log "Checking containers..."
  local expected=("cranis2_backend" "cranis2_postgres" "cranis2_neo4j" "cranis2_nginx")
  for container in "${expected[@]}"; do
    if ! docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
      log "FAIL: Container ${container} not running"
      errors=$((errors + 1))
    fi
  done
  if [ "$errors" -eq 0 ]; then
    log "PASS: All containers running"
  fi

  return "$errors"
}

# ── Rollback ────────────────────────────────────────────────────────

rollback() {
  log_section "ROLLING BACK"

  # Revert git to previous commit
  if [ -n "$PREVIOUS_COMMIT" ] && [ "$PREVIOUS_COMMIT" != "unknown" ]; then
    log "Reverting to commit ${PREVIOUS_COMMIT:0:7}..."
    cd "${PROJECT_ROOT}"
    git checkout "${PREVIOUS_COMMIT}" -- . 2>/dev/null || true
  fi

  # Rebuild frontend from reverted code
  log "Rebuilding frontend from previous code..."
  bash -c "source ~/.nvm/nvm.sh && cd '${PROJECT_ROOT}/frontend' && npm run build" > /dev/null 2>&1 || true

  # Restore database if we have a backup
  if [ -n "$BACKUP_DIR" ] && [ -d "$BACKUP_DIR" ]; then
    log "Restoring database from pre-upgrade backup..."
    # Non-interactive restore (we're in an automated rollback)
    echo "RESTORE" | "${PROJECT_ROOT}/scripts/restore-databases.sh" "${BACKUP_DIR}" 2>&1 | while read -r line; do
      log "  ${line}"
    done || true
  else
    log "No pre-upgrade backup available — skipping database restore"
  fi

  # Rebuild containers
  log "Rebuilding containers from previous code..."
  docker compose -f "${PROJECT_ROOT}/docker-compose.yml" up -d --build backend welcome nginx 2>&1 | while read -r line; do
    log "  ${line}"
  done || true

  # Final health check
  local waited=0
  while ! curl -sf http://localhost:3001/api/health > /dev/null 2>&1; do
    sleep 2
    waited=$((waited + 2))
    if [ "$waited" -ge 60 ]; then
      log "WARNING: Backend still unhealthy after rollback"
      break
    fi
  done

  if [ "$waited" -lt 60 ]; then
    log "Backend healthy after rollback (${waited}s)"
  fi
}

# ── Write upgrade report ────────────────────────────────────────────

write_report() {
  local status="$1"
  local new_commit
  new_commit=$(cd "${PROJECT_ROOT}" && git rev-parse HEAD 2>/dev/null || echo "unknown")

  cat > "${UPGRADE_REPORT}" <<REPORT
{
  "timestamp": "${TIMESTAMP}",
  "status": "${status}",
  "previous_commit": "${PREVIOUS_COMMIT}",
  "new_commit": "${new_commit}",
  "branch": "${BRANCH}",
  "backup_dir": "${BACKUP_DIR}",
  "dry_run": ${DRY_RUN},
  "log_file": "${LOG_FILE}"
}
REPORT
  log "Report written to: ${UPGRADE_REPORT}"
}

# ── Main ─────────────────────────────────────────────────────────────

main() {
  log "╔══════════════════════════════════════════════════════════════╗"
  log "║               CRANIS2 SYSTEM UPGRADE                       ║"
  log "╚══════════════════════════════════════════════════════════════╝"
  log ""
  log "Timestamp: ${TIMESTAMP}"
  log "Branch: ${BRANCH}"
  log "Dry run: ${DRY_RUN}"
  log "Skip backup: ${SKIP_BACKUP}"
  log "Log file: ${LOG_FILE}"

  # Load .env for credentials
  if [ -f "${PROJECT_ROOT}/.env" ]; then
    # shellcheck disable=SC2046
    export $(grep -E '^(POSTGRES_USER|POSTGRES_PASSWORD|NEO4J_PASSWORD)=' "${PROJECT_ROOT}/.env" | xargs)
  fi

  # Step 1: Pre-flight checks
  if ! preflight_checks; then
    write_report "preflight_failed"
    exit 2
  fi

  # Dry run stops here
  if [ "$DRY_RUN" = true ]; then
    log ""
    log "Dry run complete. No changes made."
    write_report "dry_run"
    exit 0
  fi

  # Step 2: Record current state
  record_current_state

  # Step 3: Pre-upgrade backup
  if ! pre_upgrade_backup; then
    write_report "backup_failed"
    exit 1
  fi

  # Step 4: Pull latest code
  if ! pull_latest; then
    write_report "pull_failed"
    exit 1
  fi

  # Step 5: Install dependencies
  if ! install_dependencies; then
    log "Dependency install failed — attempting rollback..."
    rollback
    write_report "rollback_deps"
    exit 1
  fi

  # Step 6: Build frontend
  if ! build_frontend; then
    log "Frontend build failed — attempting rollback..."
    rollback
    write_report "rollback_build"
    exit 1
  fi

  # Step 7: Rebuild containers
  if ! rebuild_containers; then
    log "Container rebuild failed — attempting rollback..."
    rollback
    write_report "rollback_containers"
    exit 1
  fi

  # Step 8: Post-upgrade health checks
  if ! post_upgrade_health_checks; then
    log ""
    log "Post-upgrade health checks FAILED — attempting rollback..."
    rollback
    write_report "rollback_health"
    exit 1
  fi

  # Success
  log_section "UPGRADE COMPLETE"
  local new_commit
  new_commit=$(cd "${PROJECT_ROOT}" && git rev-parse HEAD 2>/dev/null || echo "unknown")
  log "Previous: ${PREVIOUS_COMMIT:0:7}"
  log "Current:  ${new_commit:0:7}"
  if [ -n "$BACKUP_DIR" ]; then
    log "Backup:   ${BACKUP_DIR}"
  fi
  log ""
  log "Verify at: https://dev.cranis2.dev"

  write_report "success"
  exit 0
}

main

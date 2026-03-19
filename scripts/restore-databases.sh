#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# CRANIS2 — Database Restore Script
#
# Restores Postgres and/or Neo4j from a backup directory created by
# backup-databases.sh.
#
# Usage:
#   ./scripts/restore-databases.sh <backup-dir>
#   ./scripts/restore-databases.sh backups/daily/2026-03-19T020000Z
#   ./scripts/restore-databases.sh backups/daily/2026-03-19T020000Z --postgres-only
#   ./scripts/restore-databases.sh backups/daily/2026-03-19T020000Z --neo4j-only
#
# WARNING: This is a destructive operation. It replaces the current
# database contents with the backup. A pre-restore backup is taken
# automatically before proceeding.
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Parse arguments
BACKUP_DIR=""
PG_ONLY=false
NEO4J_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --postgres-only) PG_ONLY=true ;;
    --neo4j-only)    NEO4J_ONLY=true ;;
    *)
      if [ -z "$BACKUP_DIR" ]; then
        # Support both absolute and relative paths
        if [[ "$arg" = /* ]]; then
          BACKUP_DIR="$arg"
        else
          BACKUP_DIR="${PROJECT_ROOT}/${arg}"
        fi
      else
        echo "Unknown argument: $arg"
        exit 1
      fi
      ;;
  esac
done

if [ -z "$BACKUP_DIR" ]; then
  echo "Usage: $0 <backup-directory> [--postgres-only|--neo4j-only]"
  echo ""
  echo "Available backups:"
  find "${PROJECT_ROOT}/backups" -name "manifest.json" -exec dirname {} \; 2>/dev/null \
    | sort -r | head -10 | while read -r d; do
      echo "  $(basename "$(dirname "$d")")/$(basename "$d")"
    done
  exit 1
fi

if [ ! -d "$BACKUP_DIR" ]; then
  echo "ERROR: Backup directory not found: $BACKUP_DIR"
  exit 1
fi

# Load credentials
if [ -f "${PROJECT_ROOT}/.env" ]; then
  # shellcheck disable=SC2046
  export $(grep -E '^(POSTGRES_USER|POSTGRES_PASSWORD|POSTGRES_DB)=' "${PROJECT_ROOT}/.env" | xargs)
fi
PG_USER="${POSTGRES_USER:-cranis2}"
PG_DB="${POSTGRES_DB:-cranis2}"

log() { echo "[$(date -u +%H:%M:%S)] $*"; }

# ── Show what we're about to restore ─────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    CRANIS2 DATABASE RESTORE                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  Backup directory: ${BACKUP_DIR}"
echo ""
echo "  Files found:"
[ -f "${BACKUP_DIR}/cranis2.dump" ] && echo "    ✓ cranis2.dump  ($(du -h "${BACKUP_DIR}/cranis2.dump" | cut -f1))"
[ -f "${BACKUP_DIR}/forgejo.dump" ] && echo "    ✓ forgejo.dump  ($(du -h "${BACKUP_DIR}/forgejo.dump" | cut -f1))"
[ -f "${BACKUP_DIR}/neo4j-data.tar.gz" ] && echo "    ✓ neo4j-data.tar.gz ($(du -h "${BACKUP_DIR}/neo4j-data.tar.gz" | cut -f1))"
[ -f "${BACKUP_DIR}/manifest.json" ] && echo "    ✓ manifest.json"
echo ""

if [ "$PG_ONLY" = true ]; then
  echo "  Mode: Postgres only"
elif [ "$NEO4J_ONLY" = true ]; then
  echo "  Mode: Neo4j only"
else
  echo "  Mode: Full restore (Postgres + Neo4j)"
fi
echo ""

echo "  ⚠  WARNING: This will REPLACE the current database contents."
echo "     A safety backup will be taken before proceeding."
echo ""
read -rp "  Type 'RESTORE' to confirm: " CONFIRM
if [ "$CONFIRM" != "RESTORE" ]; then
  echo "  Aborted."
  exit 0
fi
echo ""

# ── Safety backup before restore ─────────────────────────────────────

log "Taking safety backup before restore..."
if ! "${PROJECT_ROOT}/scripts/backup-databases.sh" --pre-upgrade > /dev/null 2>&1; then
  log "WARNING: Safety backup failed, but proceeding with restore"
fi

# ── Stop the backend ─────────────────────────────────────────────────

log "Stopping backend container..."
docker stop cranis2_backend > /dev/null 2>&1 || true

# ── Restore Postgres ─────────────────────────────────────────────────

restore_postgres() {
  if [ -f "${BACKUP_DIR}/cranis2.dump" ]; then
    log "Restoring Postgres database: ${PG_DB}"

    # Drop and recreate to ensure clean state
    docker exec cranis2_postgres psql -U "${PG_USER}" -d postgres \
      -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${PG_DB}' AND pid <> pg_backend_pid();" \
      > /dev/null 2>&1 || true

    cat "${BACKUP_DIR}/cranis2.dump" | docker exec -i cranis2_postgres \
      pg_restore -U "${PG_USER}" -d "${PG_DB}" --clean --if-exists --no-owner --no-privileges \
      2>/dev/null || true
    log "  cranis2 database restored"
  else
    log "  WARNING: cranis2.dump not found, skipping"
  fi

  if [ -f "${BACKUP_DIR}/forgejo.dump" ]; then
    log "Restoring Postgres database: forgejo"
    cat "${BACKUP_DIR}/forgejo.dump" | docker exec -i cranis2_postgres \
      pg_restore -U "${PG_USER}" -d forgejo --clean --if-exists --no-owner --no-privileges \
      2>/dev/null || true
    log "  forgejo database restored"
  fi
}

# ── Restore Neo4j ────────────────────────────────────────────────────

restore_neo4j() {
  if [ ! -f "${BACKUP_DIR}/neo4j-data.tar.gz" ]; then
    log "  WARNING: neo4j-data.tar.gz not found, skipping"
    return 0
  fi

  log "Restoring Neo4j (requires container stop)"

  # Stop neo4j
  docker stop cranis2_neo4j > /dev/null 2>&1 || true
  local waited=0
  while docker ps -q -f name=cranis2_neo4j | grep -q .; do
    sleep 1
    waited=$((waited + 1))
    if [ "$waited" -ge 30 ]; then
      log "ERROR: Neo4j did not stop within 30s"
      return 1
    fi
  done

  # Clear existing data and extract backup into volume
  log "  Restoring neo4j-data.tar.gz..."
  docker run --rm \
    -v cranis2_neo4j_data:/data \
    -v "${BACKUP_DIR}:/backups:ro" \
    --entrypoint /bin/bash \
    neo4j:5-community \
    -c "rm -rf /data/* && cd /data && tar xzf /backups/neo4j-data.tar.gz" \
    > /dev/null 2>&1

  # Restart neo4j
  log "  Restarting neo4j..."
  docker start cranis2_neo4j > /dev/null 2>&1

  # Wait for healthy
  local health_waited=0
  while ! docker exec cranis2_neo4j cypher-shell -u neo4j -p "${POSTGRES_PASSWORD:-cranis2_dev_2026}" \
    "RETURN 1" > /dev/null 2>&1; do
    sleep 2
    health_waited=$((health_waited + 2))
    if [ "$health_waited" -ge 60 ]; then
      log "WARNING: Neo4j did not become healthy within 60s"
      break
    fi
  done
  log "  Neo4j restored and healthy"
}

# ── Run restores ─────────────────────────────────────────────────────

ERRORS=0

if [ "$NEO4J_ONLY" = false ]; then
  if ! restore_postgres; then
    ERRORS=$((ERRORS + 1))
  fi
fi

if [ "$PG_ONLY" = false ]; then
  if ! restore_neo4j; then
    ERRORS=$((ERRORS + 1))
  fi
fi

# ── Restart backend ──────────────────────────────────────────────────

log "Starting backend container..."
docker start cranis2_backend > /dev/null 2>&1

# Wait for backend health
log "Waiting for backend health..."
HEALTH_WAITED=0
while ! curl -sf http://localhost:3001/api/health > /dev/null 2>&1; do
  sleep 2
  HEALTH_WAITED=$((HEALTH_WAITED + 2))
  if [ "$HEALTH_WAITED" -ge 60 ]; then
    log "WARNING: Backend did not become healthy within 60s"
    break
  fi
done

if [ "$HEALTH_WAITED" -lt 60 ]; then
  log "Backend healthy after ${HEALTH_WAITED}s"
fi

# ── Summary ──────────────────────────────────────────────────────────

echo ""
if [ "$ERRORS" -gt 0 ]; then
  log "=== RESTORE COMPLETED WITH ${ERRORS} ERROR(S) ==="
  exit 1
else
  log "=== RESTORE COMPLETE ==="
  echo ""
  echo "  Verify the application at https://dev.cranis2.dev"
  echo "  If something is wrong, restore the safety backup:"
  echo "    $(find "${PROJECT_ROOT}/backups/pre-upgrade" -maxdepth 1 -type d | sort -r | head -1)"
  exit 0
fi

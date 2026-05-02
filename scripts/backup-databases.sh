#!/usr/bin/env bash
# Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
# SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
#
# This file is part of CRANIS2 — a personally-owned, personally-funded
# software product. Unauthorised copying, modification, distribution,
# or commercial use is prohibited. For licence enquiries:
# andi@mcburnie.com

# ──────────────────────────────────────────────────────────────────────
# CRANIS2 — Database Backup Script
#
# Dumps Postgres (cranis2 + forgejo databases) and Neo4j to compressed
# archive files. Manages retention: 7 daily, 4 weekly, 12 monthly (GFS).
#
# Usage:
#   ./scripts/backup-databases.sh              # normal daily backup
#   ./scripts/backup-databases.sh --pre-upgrade # tagged pre-upgrade backup (kept 30 days)
#   ./scripts/backup-databases.sh --postgres-only
#   ./scripts/backup-databases.sh --neo4j-only
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_ROOT="${PROJECT_ROOT}/backups"
TIMESTAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
LOG_DIR="${PROJECT_ROOT}/logs"

# Parse arguments
PRE_UPGRADE=false
PG_ONLY=false
NEO4J_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --pre-upgrade)   PRE_UPGRADE=true ;;
    --postgres-only) PG_ONLY=true ;;
    --neo4j-only)    NEO4J_ONLY=true ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

# Load database credentials from .env
if [ -f "${PROJECT_ROOT}/.env" ]; then
  # shellcheck disable=SC2046
  export $(grep -E '^(POSTGRES_USER|POSTGRES_PASSWORD|POSTGRES_DB)=' "${PROJECT_ROOT}/.env" | xargs)
fi
PG_USER="${POSTGRES_USER:-cranis2}"
PG_DB="${POSTGRES_DB:-cranis2}"

# Determine backup directory
if [ "$PRE_UPGRADE" = true ]; then
  BACKUP_DIR="${BACKUP_ROOT}/pre-upgrade/${TIMESTAMP}"
else
  BACKUP_DIR="${BACKUP_ROOT}/daily/${TIMESTAMP}"
fi
mkdir -p "${BACKUP_DIR}"
mkdir -p "${LOG_DIR}"

log() { echo "[$(date -u +%H:%M:%S)] $*"; }

# ── Postgres backup ──────────────────────────────────────────────────

backup_postgres() {
  log "Backing up Postgres database: ${PG_DB}"
  if ! docker exec cranis2_postgres pg_dump -U "${PG_USER}" -d "${PG_DB}" \
    --format=custom --compress=6 > "${BACKUP_DIR}/cranis2.dump" 2>/dev/null; then
    log "ERROR: Postgres cranis2 dump failed"
    return 1
  fi
  local size
  size=$(du -h "${BACKUP_DIR}/cranis2.dump" | cut -f1)
  log "  cranis2.dump: ${size}"

  log "Backing up Postgres database: forgejo"
  if ! docker exec cranis2_postgres pg_dump -U "${PG_USER}" -d forgejo \
    --format=custom --compress=6 > "${BACKUP_DIR}/forgejo.dump" 2>/dev/null; then
    log "WARNING: Postgres forgejo dump failed (may not exist)"
    rm -f "${BACKUP_DIR}/forgejo.dump"
  else
    size=$(du -h "${BACKUP_DIR}/forgejo.dump" | cut -f1)
    log "  forgejo.dump: ${size}"
  fi
}

# ── Neo4j backup ─────────────────────────────────────────────────────
#
# Neo4j Community 5.x does not support online dumps or neo4j-admin dump
# reliably on externally-managed volumes. We use a filesystem-level tar
# of the data directory instead:
#   1. Stop the neo4j container (ensures consistent state)
#   2. Tar the data volume via a temporary container
#   3. Restart the neo4j container
#
# This causes ~30-60s downtime. The backend will queue requests and
# reconnect automatically when Neo4j comes back.

backup_neo4j() {
  log "Backing up Neo4j (requires brief container stop)"

  # Stop neo4j
  log "  Stopping neo4j container..."
  docker stop cranis2_neo4j > /dev/null 2>&1 || true

  # Wait for clean shutdown
  local waited=0
  while docker ps -q -f name=cranis2_neo4j | grep -q .; do
    sleep 1
    waited=$((waited + 1))
    if [ "$waited" -ge 30 ]; then
      log "ERROR: Neo4j did not stop within 30s"
      docker start cranis2_neo4j > /dev/null 2>&1 || true
      return 1
    fi
  done
  log "  Neo4j stopped after ${waited}s"

  # Tar the data volume via a temporary container
  log "  Creating neo4j-data.tar.gz..."
  if ! docker run --rm \
    -v cranis2_neo4j_data:/data:ro \
    -v "${BACKUP_DIR}:/backups" \
    --entrypoint /bin/bash \
    neo4j:5-community \
    -c "cd /data && tar czf /backups/neo4j-data.tar.gz ." \
    > /dev/null 2>&1; then
    log "ERROR: Neo4j tar backup failed"
    docker start cranis2_neo4j > /dev/null 2>&1 || true
    return 1
  fi

  # Restart neo4j
  log "  Restarting neo4j container..."
  docker start cranis2_neo4j > /dev/null 2>&1

  # Wait for neo4j to become healthy
  local health_waited=0
  while ! docker exec cranis2_neo4j cypher-shell -u neo4j -p "${POSTGRES_PASSWORD:-cranis2_dev_2026}" \
    "RETURN 1" > /dev/null 2>&1; do
    sleep 2
    health_waited=$((health_waited + 2))
    if [ "$health_waited" -ge 60 ]; then
      log "WARNING: Neo4j did not become healthy within 60s (may still be starting)"
      break
    fi
  done

  if [ "$health_waited" -lt 60 ]; then
    log "  Neo4j healthy after ${health_waited}s"
  fi

  local size
  size=$(du -h "${BACKUP_DIR}/neo4j-data.tar.gz" | cut -f1)
  log "  neo4j-data.tar.gz: ${size}"
}

# ── Run backups ──────────────────────────────────────────────────────

log "=== CRANIS2 Database Backup ==="
log "Timestamp: ${TIMESTAMP}"
log "Destination: ${BACKUP_DIR}"

ERRORS=0

if [ "$NEO4J_ONLY" = false ]; then
  if ! backup_postgres; then
    ERRORS=$((ERRORS + 1))
  fi
fi

if [ "$PG_ONLY" = false ]; then
  if ! backup_neo4j; then
    ERRORS=$((ERRORS + 1))
  fi
fi

# Write manifest
cat > "${BACKUP_DIR}/manifest.json" <<MANIFEST
{
  "timestamp": "${TIMESTAMP}",
  "type": "$([ "$PRE_UPGRADE" = true ] && echo 'pre-upgrade' || echo 'daily')",
  "postgres_cranis2": $([ -f "${BACKUP_DIR}/cranis2.dump" ] && echo true || echo false),
  "postgres_forgejo": $([ -f "${BACKUP_DIR}/forgejo.dump" ] && echo true || echo false),
  "neo4j": $([ -f "${BACKUP_DIR}/neo4j-data.tar.gz" ] && echo true || echo false),
  "errors": ${ERRORS}
}
MANIFEST

# ── Retention cleanup ────────────────────────────────────────────────

if [ "$PRE_UPGRADE" = false ]; then
  log "Applying retention policy..."

  DAILY_DIR="${BACKUP_ROOT}/daily"
  WEEKLY_DIR="${BACKUP_ROOT}/weekly"
  MONTHLY_DIR="${BACKUP_ROOT}/monthly"
  mkdir -p "${WEEKLY_DIR}" "${MONTHLY_DIR}"

  # Promote Sunday backups to weekly (symlinks)
  DOW="$(date -u +%u)"  # 7 = Sunday
  if [ "$DOW" = "7" ]; then
    ln -sfn "${BACKUP_DIR}" "${WEEKLY_DIR}/${TIMESTAMP}"
    log "  Promoted to weekly backup"
  fi

  # Promote 1st-of-month backups to monthly (symlinks)
  DOM="$(date -u +%d)"
  if [ "$DOM" = "01" ]; then
    ln -sfn "${BACKUP_DIR}" "${MONTHLY_DIR}/${TIMESTAMP}"
    log "  Promoted to monthly backup"
  fi

  # Purge old daily backups (keep 7)
  DAILY_COUNT=$(find "${DAILY_DIR}" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
  if [ "$DAILY_COUNT" -gt 7 ]; then
    find "${DAILY_DIR}" -mindepth 1 -maxdepth 1 -type d \
      | sort | head -n "$((DAILY_COUNT - 7))" \
      | while read -r old_dir; do
          # Don't delete if it's referenced by a weekly or monthly symlink
          if ! find "${WEEKLY_DIR}" "${MONTHLY_DIR}" -type l -lname "${old_dir}" 2>/dev/null | grep -q .; then
            rm -rf "${old_dir}"
            log "  Purged old daily: $(basename "${old_dir}")"
          fi
        done
  fi

  # Purge old weekly symlinks (keep 4)
  WEEKLY_COUNT=$(find "${WEEKLY_DIR}" -mindepth 1 -maxdepth 1 -type l 2>/dev/null | wc -l)
  if [ "$WEEKLY_COUNT" -gt 4 ]; then
    find "${WEEKLY_DIR}" -mindepth 1 -maxdepth 1 -type l \
      | sort | head -n "$((WEEKLY_COUNT - 4))" \
      | xargs rm -f
    log "  Purged old weekly symlinks"
  fi

  # Purge old monthly symlinks (keep 12)
  MONTHLY_COUNT=$(find "${MONTHLY_DIR}" -mindepth 1 -maxdepth 1 -type l 2>/dev/null | wc -l)
  if [ "$MONTHLY_COUNT" -gt 12 ]; then
    find "${MONTHLY_DIR}" -mindepth 1 -maxdepth 1 -type l \
      | sort | head -n "$((MONTHLY_COUNT - 12))" \
      | xargs rm -f
    log "  Purged old monthly symlinks"
  fi
else
  # Pre-upgrade backups: keep for 30 days
  find "${BACKUP_ROOT}/pre-upgrade" -mindepth 1 -maxdepth 1 -type d -mtime +30 \
    -exec rm -rf {} + 2>/dev/null || true
  log "Cleaned pre-upgrade backups older than 30 days"
fi

# ── Summary ──────────────────────────────────────────────────────────

if [ "$ERRORS" -gt 0 ]; then
  log "=== BACKUP COMPLETED WITH ${ERRORS} ERROR(S) ==="
  exit 1
else
  TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)
  log "=== BACKUP COMPLETE (${TOTAL_SIZE}) ==="
  exit 0
fi

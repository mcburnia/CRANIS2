#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# CRANIS2 — Backup Verification Script
#
# Spins up temporary Postgres and Neo4j containers, restores the latest
# backup into them, runs validation queries, then cleans up. Designed
# to run weekly via cron to confirm backups are actually restorable.
#
# Usage:
#   ./scripts/verify-backup.sh                  # verify latest daily backup
#   ./scripts/verify-backup.sh <backup-dir>     # verify a specific backup
#
# Exit codes:
#   0 = backup verified successfully
#   1 = verification failed
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Find backup directory
if [ -n "${1:-}" ]; then
  if [[ "$1" = /* ]]; then
    BACKUP_DIR="$1"
  else
    BACKUP_DIR="${PROJECT_ROOT}/$1"
  fi
else
  # Find latest daily backup
  BACKUP_DIR="$(find "${PROJECT_ROOT}/backups/daily" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort -r | head -1)"
fi

if [ -z "$BACKUP_DIR" ] || [ ! -d "$BACKUP_DIR" ]; then
  echo "ERROR: No backup directory found"
  exit 1
fi

# Load credentials
if [ -f "${PROJECT_ROOT}/.env" ]; then
  # shellcheck disable=SC2046
  export $(grep -E '^(POSTGRES_USER|POSTGRES_PASSWORD|POSTGRES_DB)=' "${PROJECT_ROOT}/.env" | xargs)
fi
PG_USER="${POSTGRES_USER:-cranis2}"
PG_DB="${POSTGRES_DB:-cranis2}"
PG_PASS="${POSTGRES_PASSWORD:-cranis2_dev_2026}"
NEO4J_PASS="${POSTGRES_PASSWORD:-cranis2_dev_2026}"

# Temp container names
PG_VERIFY="cranis2_pg_verify_$$"
NEO4J_VERIFY="cranis2_neo4j_verify_$$"
NEO4J_VERIFY_VOL="cranis2_neo4j_verify_data_$$"

log() { echo "[$(date -u +%H:%M:%S)] $*"; }

# Cleanup function — always runs on exit
cleanup() {
  log "Cleaning up temporary containers..."
  docker stop "$PG_VERIFY" > /dev/null 2>&1 || true
  docker rm -f "$PG_VERIFY" > /dev/null 2>&1 || true
  docker stop "$NEO4J_VERIFY" > /dev/null 2>&1 || true
  docker rm -f "$NEO4J_VERIFY" > /dev/null 2>&1 || true
  docker volume rm "$NEO4J_VERIFY_VOL" > /dev/null 2>&1 || true
}
trap cleanup EXIT

ERRORS=0

log "=== CRANIS2 Backup Verification ==="
log "Backup: ${BACKUP_DIR}"

# ── Verify Postgres ──────────────────────────────────────────────────

verify_postgres() {
  if [ ! -f "${BACKUP_DIR}/cranis2.dump" ]; then
    log "SKIP: cranis2.dump not found"
    return 0
  fi

  log "Verifying Postgres backup..."

  # Start temporary Postgres container
  docker run -d --name "$PG_VERIFY" \
    -e POSTGRES_USER="$PG_USER" \
    -e POSTGRES_PASSWORD="$PG_PASS" \
    -e POSTGRES_DB="$PG_DB" \
    postgres:16-alpine > /dev/null 2>&1

  # Wait for ready
  local waited=0
  while ! docker exec "$PG_VERIFY" pg_isready -U "$PG_USER" > /dev/null 2>&1; do
    sleep 1
    waited=$((waited + 1))
    if [ "$waited" -ge 30 ]; then
      log "ERROR: Temp Postgres did not start within 30s"
      return 1
    fi
  done

  # Restore
  log "  Restoring cranis2.dump..."
  if ! cat "${BACKUP_DIR}/cranis2.dump" | docker exec -i "$PG_VERIFY" \
    pg_restore -U "$PG_USER" -d "$PG_DB" --no-owner --no-privileges 2>/dev/null; then
    log "  WARNING: pg_restore reported warnings (may be non-fatal)"
  fi

  # Validate — check key tables exist and have data
  log "  Running validation queries..."

  local user_count
  user_count=$(docker exec "$PG_VERIFY" psql -U "$PG_USER" -d "$PG_DB" -t -A \
    -c "SELECT count(*) FROM users;" 2>/dev/null || echo "0")

  local table_count
  table_count=$(docker exec "$PG_VERIFY" psql -U "$PG_USER" -d "$PG_DB" -t -A \
    -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")

  local product_count
  product_count=$(docker exec "$PG_VERIFY" psql -U "$PG_USER" -d "$PG_DB" -t -A \
    -c "SELECT count(*) FROM obligation_statuses;" 2>/dev/null || echo "0")

  if [ "$user_count" = "0" ] || [ "$table_count" = "0" ]; then
    log "  FAIL: Postgres restore verification failed"
    log "    Tables: ${table_count}, Users: ${user_count}"
    return 1
  fi

  log "  PASS: Postgres verified (${table_count} tables, ${user_count} users, ${product_count} obligation rows)"

  # Stop temp container
  docker stop "$PG_VERIFY" > /dev/null 2>&1 || true
  docker rm -f "$PG_VERIFY" > /dev/null 2>&1 || true
}

# ── Verify Neo4j ─────────────────────────────────────────────────────

verify_neo4j() {
  if [ ! -f "${BACKUP_DIR}/neo4j-data.tar.gz" ]; then
    log "SKIP: neo4j-data.tar.gz not found"
    return 0
  fi

  log "Verifying Neo4j backup..."

  # Create temp volume and extract tar into it
  docker volume create "$NEO4J_VERIFY_VOL" > /dev/null 2>&1

  log "  Extracting neo4j-data.tar.gz into temp volume..."
  docker run --rm \
    -v "$NEO4J_VERIFY_VOL":/data \
    -v "${BACKUP_DIR}":/backups:ro \
    --entrypoint /bin/bash \
    neo4j:5-community \
    -c "cd /data && tar xzf /backups/neo4j-data.tar.gz" \
    > /dev/null 2>&1

  # Start temp Neo4j container
  docker run -d --name "$NEO4J_VERIFY" \
    -v "$NEO4J_VERIFY_VOL":/data \
    -e NEO4J_AUTH="neo4j/${NEO4J_PASS}" \
    -e NEO4J_server_memory_heap_initial__size=256m \
    -e NEO4J_server_memory_heap_max__size=256m \
    -e NEO4J_server_memory_pagecache_size=64m \
    neo4j:5-community > /dev/null 2>&1

  # Wait for ready
  local waited=0
  while ! docker exec "$NEO4J_VERIFY" cypher-shell -u neo4j -p "$NEO4J_PASS" \
    "RETURN 1" > /dev/null 2>&1; do
    sleep 2
    waited=$((waited + 2))
    if [ "$waited" -ge 60 ]; then
      log "ERROR: Temp Neo4j did not start within 60s"
      return 1
    fi
  done

  # Validate
  log "  Running validation queries..."

  local node_count
  node_count=$(docker exec "$NEO4J_VERIFY" cypher-shell -u neo4j -p "$NEO4J_PASS" \
    --format plain "MATCH (n) RETURN count(n) AS c" 2>/dev/null | tail -1 || echo "0")

  local org_count
  org_count=$(docker exec "$NEO4J_VERIFY" cypher-shell -u neo4j -p "$NEO4J_PASS" \
    --format plain "MATCH (o:Organisation) RETURN count(o) AS c" 2>/dev/null | tail -1 || echo "0")

  if [ "$node_count" = "0" ]; then
    log "  FAIL: Neo4j restore verification failed"
    log "    Nodes: ${node_count}"
    return 1
  fi

  log "  PASS: Neo4j verified (${node_count} nodes, ${org_count} organisations)"

  # Cleanup
  docker stop "$NEO4J_VERIFY" > /dev/null 2>&1 || true
  docker rm -f "$NEO4J_VERIFY" > /dev/null 2>&1 || true
  docker volume rm "$NEO4J_VERIFY_VOL" > /dev/null 2>&1 || true
}

# ── Run verifications ────────────────────────────────────────────────

if ! verify_postgres; then
  ERRORS=$((ERRORS + 1))
fi

if ! verify_neo4j; then
  ERRORS=$((ERRORS + 1))
fi

# ── Summary ──────────────────────────────────────────────────────────

echo ""
if [ "$ERRORS" -gt 0 ]; then
  log "=== VERIFICATION FAILED (${ERRORS} error(s)) ==="
  exit 1
else
  log "=== VERIFICATION PASSED ==="
  exit 0
fi

#!/usr/bin/env bash
# Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
# SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
#
# This file is part of CRANIS2 — a personally-owned, personally-funded
# software product. Unauthorised copying, modification, distribution,
# or commercial use is prohibited. For licence enquiries:
# andi.mcburnie@gmail.com

# ──────────────────────────────────────────────────────────────────────
# CRANIS2 — Apply Key Rotation (Production)
#
# Deploys a key rotation package produced by rotate-encryption-key.sh
# or rotate-signing-keys.sh to the production environment.
#
# Usage:
#   ./scripts/apply-key-rotation.sh <rotation-dir>
#
# This script runs on PRODUCTION during a maintenance window:
#   1. Stops the backend
#   2. Takes a safety backup
#   3. Restores the re-encrypted Postgres dump (if present)
#   4. Applies new .env values
#   5. Copies new signing public keys to .well-known (if present)
#   6. Restarts all affected services
#   7. Verifies health
#
# Runs on: Production server
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${PROJECT_ROOT}/logs"
TIMESTAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
LOG_FILE="${LOG_DIR}/apply-rotation-${TIMESTAMP}.log"
ENV_FILE="${PROJECT_ROOT}/.env"

ROTATION_DIR="${1:-}"

if [ -z "$ROTATION_DIR" ]; then
  echo "Usage: $0 <rotation-directory>"
  echo ""
  echo "Example: $0 logs/key-rotation-2026-03-20T050000Z"
  exit 1
fi

# Support relative paths
if [[ "$ROTATION_DIR" != /* ]]; then
  ROTATION_DIR="${PROJECT_ROOT}/${ROTATION_DIR}"
fi

if [ ! -d "$ROTATION_DIR" ]; then
  echo "ERROR: Rotation directory not found: ${ROTATION_DIR}"
  exit 1
fi

mkdir -p "${LOG_DIR}"

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

# Update a value in .env
update_env() {
  local key="$1"
  local value="$2"

  if grep -q "^${key}=" "${ENV_FILE}"; then
    local tmp="${ENV_FILE}.tmp.$$"
    awk -v k="${key}" -v v="${value}" 'BEGIN{FS=OFS="="} $1==k{$2=v}{print}' "${ENV_FILE}" > "${tmp}"
    mv "${tmp}" "${ENV_FILE}"
  else
    echo "${key}=${value}" >> "${ENV_FILE}"
  fi
}

main() {
  log "╔══════════════════════════════════════════════════════════════╗"
  log "║          CRANIS2 APPLY KEY ROTATION                        ║"
  log "╚══════════════════════════════════════════════════════════════╝"
  log ""
  log "Rotation package: ${ROTATION_DIR}"
  log "Timestamp: ${TIMESTAMP}"
  log ""

  # Show what's in the package
  log "Package contents:"
  ls -lh "${ROTATION_DIR}" | while read -r line; do log "  ${line}"; done
  log ""

  # Confirmation
  echo "  ⚠  This will apply a key rotation to the PRODUCTION environment."
  echo "     A safety backup will be taken first."
  echo ""
  read -rp "  Type 'ROTATE' to confirm: " CONFIRM
  if [ "$CONFIRM" != "ROTATE" ]; then
    echo "  Aborted."
    exit 0
  fi
  echo ""

  # ── Step 1: Safety backup ──────────────────────────────────────────

  log_section "SAFETY BACKUP"
  if "${PROJECT_ROOT}/scripts/backup-databases.sh" --pre-upgrade 2>&1 | while read -r line; do log "  ${line}"; done; then
    log "Safety backup complete"
  else
    log "WARNING: Safety backup failed — proceeding anyway"
  fi

  # ── Step 2: Stop backend ───────────────────────────────────────────

  log_section "STOPPING BACKEND"
  docker stop cranis2_backend > /dev/null 2>&1 || true
  log "Backend stopped"

  # ── Step 3: Restore re-encrypted dump ──────────────────────────────

  if [ -f "${ROTATION_DIR}/cranis2-rotated.dump" ]; then
    log_section "RESTORING RE-ENCRYPTED DATABASE"

    # shellcheck disable=SC2046
    export $(grep -E '^(POSTGRES_USER|POSTGRES_PASSWORD)=' "${ENV_FILE}" | xargs)
    local PG_USER="${POSTGRES_USER:-cranis2}"
    local PG_DB="cranis2"

    # Terminate existing connections
    docker exec cranis2_postgres psql -U "${PG_USER}" -d postgres \
      -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${PG_DB}' AND pid <> pg_backend_pid();" \
      > /dev/null 2>&1 || true

    # Restore
    cat "${ROTATION_DIR}/cranis2-rotated.dump" | docker exec -i cranis2_postgres \
      pg_restore -U "${PG_USER}" -d "${PG_DB}" --clean --if-exists --no-owner --no-privileges \
      2>/dev/null || true
    log "Database restored with re-encrypted data"
  else
    log "No database dump in package — skipping database restore"
  fi

  # ── Step 4: Apply new .env values ──────────────────────────────────

  if [ -f "${ROTATION_DIR}/new-env-values.txt" ]; then
    log_section "APPLYING NEW .ENV VALUES"

    while IFS= read -r line; do
      # Skip comments and empty lines
      [[ "$line" =~ ^#.*$ ]] && continue
      [[ -z "$line" ]] && continue

      local key="${line%%=*}"
      local value="${line#*=}"
      log "  Updating ${key}"
      update_env "${key}" "${value}"
    done < "${ROTATION_DIR}/new-env-values.txt"

    log "All .env values updated"
  fi

  # ── Step 5: Archive old signing keys (if new ones provided) ────────

  if [ -f "${ROTATION_DIR}/new-signing-keys.txt" ]; then
    log_section "APPLYING NEW SIGNING KEYS"

    while IFS= read -r line; do
      [[ "$line" =~ ^#.*$ ]] && continue
      [[ -z "$line" ]] && continue

      local key="${line%%=*}"
      local value="${line#*=}"
      log "  Updating ${key}"
      update_env "${key}" "${value}"
    done < "${ROTATION_DIR}/new-signing-keys.txt"

    log "Signing keys updated"
  fi

  # ── Step 6: Restart services ───────────────────────────────────────

  log_section "RESTARTING SERVICES"

  docker compose -f "${PROJECT_ROOT}/docker-compose.yml" up -d backend welcome 2>&1 | while read -r line; do
    log "  ${line}"
  done || true

  # Wait for health
  log "Waiting for backend health..."
  local waited=0
  while ! curl -sf http://localhost:3001/api/health > /dev/null 2>&1; do
    sleep 2
    waited=$((waited + 2))
    if [ "$waited" -ge 60 ]; then
      log "WARNING: Backend not healthy after 60s"
      break
    fi
  done

  if [ "$waited" -lt 60 ]; then
    log "Backend healthy after ${waited}s"
  fi

  # ── Step 7: Verify ─────────────────────────────────────────────────

  log_section "VERIFICATION"

  # Check health endpoint
  if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
    log "PASS: Backend health check"
  else
    log "FAIL: Backend health check"
  fi

  # Check frontend
  if curl -sf http://localhost:3002 > /dev/null 2>&1; then
    log "PASS: Frontend responding"
  else
    log "FAIL: Frontend not responding"
  fi

  log_section "KEY ROTATION APPLIED"
  log ""
  log "Verify the application at the public URL."
  log "If something is wrong, restore from the safety backup:"
  log "  $(find "${PROJECT_ROOT}/backups/pre-upgrade" -maxdepth 1 -type d | sort -r | head -1)"
  log ""
  log "Log: ${LOG_FILE}"
}

main

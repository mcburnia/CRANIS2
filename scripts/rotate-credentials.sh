#!/usr/bin/env bash
# Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
# SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
#
# This file is part of CRANIS2 — a personally-owned, personally-funded
# software product. Unauthorised copying, modification, distribution,
# or commercial use is prohibited. For licence enquiries:
# andi@mcburnie.com

# ──────────────────────────────────────────────────────────────────────
# CRANIS2 — Credential Rotation Script (Monthly)
#
# Rotates database passwords, JWT secret, and welcome secret.
# No maintenance window required — services restart automatically.
#
# Usage:
#   ./scripts/rotate-credentials.sh              # rotate all credentials
#   ./scripts/rotate-credentials.sh --db-only    # database passwords only
#   ./scripts/rotate-credentials.sh --jwt-only   # JWT secret only
#   ./scripts/rotate-credentials.sh --welcome-only  # welcome secret only
#   ./scripts/rotate-credentials.sh --dry-run    # show what would change
#
# This script:
#   1. Generates cryptographically secure random passwords
#   2. Changes passwords at the database level (ALTER USER / cypher-shell)
#   3. Updates .env with new values
#   4. Restarts affected containers
#   5. Verifies health after restart
#   6. Records the rotation in a ledger file
#
# Runs on: Lab server (dev) or production
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${PROJECT_ROOT}/logs"
TIMESTAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
LOG_FILE="${LOG_DIR}/rotate-credentials-${TIMESTAMP}.log"
LEDGER_FILE="${PROJECT_ROOT}/logs/rotation-ledger.json"
ENV_FILE="${PROJECT_ROOT}/.env"

# Parse arguments
ROTATE_DB=true
ROTATE_JWT=true
ROTATE_WELCOME=true
DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --db-only)      ROTATE_JWT=false; ROTATE_WELCOME=false ;;
    --jwt-only)     ROTATE_DB=false; ROTATE_WELCOME=false ;;
    --welcome-only) ROTATE_DB=false; ROTATE_JWT=false ;;
    --dry-run)      DRY_RUN=true ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

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

# Generate a cryptographically secure random password
generate_password() {
  local length="${1:-32}"
  bash -c "source ~/.nvm/nvm.sh && node -e \"console.log(require('crypto').randomBytes(${length}).toString('base64url'))\"" 2>/dev/null
}

# Update a value in .env
update_env() {
  local key="$1"
  local value="$2"

  if grep -q "^${key}=" "${ENV_FILE}"; then
    # Use a temp file to avoid sed issues with special characters
    local tmp="${ENV_FILE}.tmp.$$"
    awk -v k="${key}" -v v="${value}" 'BEGIN{FS=OFS="="} $1==k{$2=v}{print}' "${ENV_FILE}" > "${tmp}"
    mv "${tmp}" "${ENV_FILE}"
  else
    echo "${key}=${value}" >> "${ENV_FILE}"
  fi
}

# Record rotation in the ledger
record_rotation() {
  local key_name="$1"
  local entry="{\"key\": \"${key_name}\", \"rotated_at\": \"${TIMESTAMP}\", \"dry_run\": ${DRY_RUN}}"

  if [ ! -f "${LEDGER_FILE}" ]; then
    echo "[${entry}]" > "${LEDGER_FILE}"
  else
    # Append to the JSON array
    local tmp="${LEDGER_FILE}.tmp.$$"
    sed '$ s/]$/,/' "${LEDGER_FILE}" > "${tmp}"
    echo "${entry}]" >> "${tmp}"
    mv "${tmp}" "${LEDGER_FILE}"
  fi
}

# ── Rotate database passwords ───────────────────────────────────────

rotate_postgres() {
  log_section "ROTATING POSTGRES PASSWORD"

  local new_pass
  new_pass=$(generate_password 32)
  log "Generated new Postgres password (${#new_pass} chars)"

  if [ "$DRY_RUN" = true ]; then
    log "DRY RUN: Would change POSTGRES_PASSWORD in .env and ALTER USER in Postgres"
    return 0
  fi

  # Change at database level
  local current_user
  current_user=$(grep '^POSTGRES_USER=' "${ENV_FILE}" | cut -d= -f2)

  if ! docker exec cranis2_postgres psql -U "${current_user}" -d postgres \
    -c "ALTER USER ${current_user} WITH PASSWORD '${new_pass}';" > /dev/null 2>&1; then
    log "ERROR: Failed to change Postgres password"
    return 1
  fi
  log "Postgres password changed at database level"

  # Update .env
  update_env "POSTGRES_PASSWORD" "${new_pass}"
  log "Updated POSTGRES_PASSWORD in .env"

  record_rotation "POSTGRES_PASSWORD"
}

rotate_neo4j() {
  log_section "ROTATING NEO4J PASSWORD"

  local new_pass
  new_pass=$(generate_password 32)
  log "Generated new Neo4j password (${#new_pass} chars)"

  if [ "$DRY_RUN" = true ]; then
    log "DRY RUN: Would change NEO4J_PASSWORD in .env and alter in Neo4j"
    return 0
  fi

  # Change at database level via cypher-shell
  local current_pass
  current_pass=$(grep '^NEO4J_PASSWORD=' "${ENV_FILE}" | cut -d= -f2)
  local current_user
  current_user=$(grep '^NEO4J_USER=' "${ENV_FILE}" | cut -d= -f2)

  if ! docker exec cranis2_neo4j cypher-shell -u "${current_user}" -p "${current_pass}" \
    "ALTER CURRENT USER SET PASSWORD FROM '${current_pass}' TO '${new_pass}'" > /dev/null 2>&1; then
    log "ERROR: Failed to change Neo4j password"
    return 1
  fi
  log "Neo4j password changed at database level"

  # Update .env
  update_env "NEO4J_PASSWORD" "${new_pass}"
  log "Updated NEO4J_PASSWORD in .env"

  record_rotation "NEO4J_PASSWORD"
}

rotate_forgejo_db() {
  log_section "ROTATING FORGEJO DB PASSWORD"

  local new_pass
  new_pass=$(generate_password 32)
  log "Generated new Forgejo DB password (${#new_pass} chars)"

  if [ "$DRY_RUN" = true ]; then
    log "DRY RUN: Would change FORGEJO_DB_PASSWD in .env and ALTER USER in Postgres"
    return 0
  fi

  # Change at Postgres level
  local pg_user
  pg_user=$(grep '^POSTGRES_USER=' "${ENV_FILE}" | cut -d= -f2)
  local forgejo_user
  forgejo_user=$(grep '^FORGEJO_DB_USER=' "${ENV_FILE}" | cut -d= -f2)

  if ! docker exec cranis2_postgres psql -U "${pg_user}" -d postgres \
    -c "ALTER USER ${forgejo_user} WITH PASSWORD '${new_pass}';" > /dev/null 2>&1; then
    log "ERROR: Failed to change Forgejo DB password"
    return 1
  fi
  log "Forgejo DB password changed at Postgres level"

  # Update .env
  update_env "FORGEJO_DB_PASSWD" "${new_pass}"
  log "Updated FORGEJO_DB_PASSWD in .env"

  record_rotation "FORGEJO_DB_PASSWD"
}

# ── Rotate JWT secret ───────────────────────────────────────────────

rotate_jwt() {
  log_section "ROTATING JWT_SECRET"

  # JWT_SECRET is a 64-char hex string (32 bytes)
  local new_secret
  new_secret=$(bash -c "source ~/.nvm/nvm.sh && node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"" 2>/dev/null)
  log "Generated new JWT secret (${#new_secret} chars)"

  if [ "$DRY_RUN" = true ]; then
    log "DRY RUN: Would change JWT_SECRET in .env"
    log "NOTE: All active sessions will expire within 7 days"
    return 0
  fi

  update_env "JWT_SECRET" "${new_secret}"
  log "Updated JWT_SECRET in .env"
  log "Active sessions will expire naturally within 7 days"

  record_rotation "JWT_SECRET"
}

# ── Rotate welcome secret ──────────────────────────────────────────

rotate_welcome() {
  log_section "ROTATING WELCOME_SECRET"

  local new_secret
  new_secret=$(generate_password 32)
  log "Generated new welcome secret (${#new_secret} chars)"

  if [ "$DRY_RUN" = true ]; then
    log "DRY RUN: Would change WELCOME_SECRET in .env"
    return 0
  fi

  update_env "WELCOME_SECRET" "${new_secret}"
  log "Updated WELCOME_SECRET in .env"

  record_rotation "WELCOME_SECRET"
}

# ── Restart affected services ───────────────────────────────────────

restart_services() {
  log_section "RESTARTING SERVICES"

  local services=()

  if [ "$ROTATE_DB" = true ]; then
    services+=(backend forgejo welcome)
    # Postgres and Neo4j don't need restart — the password change is at the DB level.
    # But containers that connect to them need to pick up new .env values.
  fi

  if [ "$ROTATE_JWT" = true ]; then
    services+=(backend)
  fi

  if [ "$ROTATE_WELCOME" = true ]; then
    services+=(welcome)
  fi

  # Deduplicate
  local unique_services
  unique_services=$(echo "${services[@]}" | tr ' ' '\n' | sort -u | tr '\n' ' ')

  log "Recreating containers: ${unique_services}"

  if ! docker compose -f "${PROJECT_ROOT}/docker-compose.yml" up -d ${unique_services} 2>&1 | while read -r line; do
    log "  ${line}"
  done; then
    log "WARNING: Some containers may have failed to restart"
  fi

  # Wait for health
  sleep 5
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
}

# ── Main ─────────────────────────────────────────────────────────────

main() {
  log "╔══════════════════════════════════════════════════════════════╗"
  log "║            CRANIS2 CREDENTIAL ROTATION                     ║"
  log "╚══════════════════════════════════════════════════════════════╝"
  log ""
  log "Timestamp: ${TIMESTAMP}"
  log "Dry run: ${DRY_RUN}"
  log "Rotate DB: ${ROTATE_DB}  JWT: ${ROTATE_JWT}  Welcome: ${ROTATE_WELCOME}"

  local errors=0

  if [ "$ROTATE_DB" = true ]; then
    rotate_postgres || errors=$((errors + 1))
    rotate_neo4j || errors=$((errors + 1))
    rotate_forgejo_db || errors=$((errors + 1))
  fi

  if [ "$ROTATE_JWT" = true ]; then
    rotate_jwt || errors=$((errors + 1))
  fi

  if [ "$ROTATE_WELCOME" = true ]; then
    rotate_welcome || errors=$((errors + 1))
  fi

  if [ "$DRY_RUN" = true ]; then
    log ""
    log "Dry run complete. No changes made."
    exit 0
  fi

  # Restart services to pick up new credentials
  restart_services

  log_section "ROTATION COMPLETE"
  if [ "$errors" -gt 0 ]; then
    log "Completed with ${errors} error(s). Check the log."
    exit 1
  fi

  log "All credentials rotated successfully."
  log "Log: ${LOG_FILE}"
  log "Ledger: ${LEDGER_FILE}"
  exit 0
}

main

#!/usr/bin/env bash
# Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
# SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
#
# This file is part of CRANIS2 — a personally-owned, personally-funded
# software product. Unauthorised copying, modification, distribution,
# or commercial use is prohibited. For licence enquiries:
# andi@mcburnie.com

# ──────────────────────────────────────────────────────────────────────
# CRANIS2 — Encryption Key Rotation Script (Annual)
#
# Generates a new GITHUB_ENCRYPTION_KEY, decrypts all stored PATs with
# the old key, and re-encrypts them with the new key. Produces a
# package ready for deployment to production.
#
# Usage:
#   ./scripts/rotate-encryption-key.sh                    # full rotation
#   ./scripts/rotate-encryption-key.sh --dry-run          # preview only
#   ./scripts/rotate-encryption-key.sh --dump <file.dump> # use existing dump
#
# This script runs on the LAB SERVER (not production):
#   1. Takes a Postgres dump (or uses an existing one)
#   2. Generates a new encryption key
#   3. Starts a temporary Postgres container
#   4. Restores the dump
#   5. Decrypts all PATs with the old key, re-encrypts with the new key
#   6. Dumps the re-encrypted database
#   7. Packages: new dump + new .env values
#
# The output package is then deployed to production using
# apply-key-rotation.sh during a maintenance window.
#
# Runs on: Lab server ONLY
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${PROJECT_ROOT}/logs"
TIMESTAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
LOG_FILE="${LOG_DIR}/rotate-encryption-${TIMESTAMP}.log"
ROTATION_DIR="${PROJECT_ROOT}/logs/key-rotation-${TIMESTAMP}"
ENV_FILE="${PROJECT_ROOT}/.env"
LEDGER_FILE="${PROJECT_ROOT}/logs/rotation-ledger.json"

# Parse arguments
DRY_RUN=false
EXISTING_DUMP=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --dump)    shift; EXISTING_DUMP="${1:-}" ;;
    --dump=*)  EXISTING_DUMP="${arg#--dump=}" ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

mkdir -p "${LOG_DIR}" "${ROTATION_DIR}"

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

# Temp container name
PG_ROTATE="cranis2_pg_rotate_$$"

cleanup() {
  log "Cleaning up temporary containers..."
  docker stop "$PG_ROTATE" > /dev/null 2>&1 || true
  docker rm -f "$PG_ROTATE" > /dev/null 2>&1 || true
}
trap cleanup EXIT

# ── Main ─────────────────────────────────────────────────────────────

main() {
  log "╔══════════════════════════════════════════════════════════════╗"
  log "║         CRANIS2 ENCRYPTION KEY ROTATION                    ║"
  log "╚══════════════════════════════════════════════════════════════╝"
  log ""
  log "Timestamp: ${TIMESTAMP}"
  log "Output:    ${ROTATION_DIR}"
  log "Dry run:   ${DRY_RUN}"

  # Load current credentials
  if [ ! -f "${ENV_FILE}" ]; then
    log "ERROR: .env file not found"
    exit 1
  fi
  # shellcheck disable=SC2046
  export $(grep -E '^(POSTGRES_USER|POSTGRES_PASSWORD|GITHUB_ENCRYPTION_KEY)=' "${ENV_FILE}" | xargs)

  local OLD_KEY="${GITHUB_ENCRYPTION_KEY}"
  local PG_USER="${POSTGRES_USER:-cranis2}"
  local PG_PASS="${POSTGRES_PASSWORD}"
  local PG_DB="cranis2"

  if [ -z "$OLD_KEY" ]; then
    log "ERROR: GITHUB_ENCRYPTION_KEY not found in .env"
    exit 1
  fi

  log "Old encryption key: ${OLD_KEY:0:8}...${OLD_KEY: -4} (${#OLD_KEY} chars)"

  # ── Step 1: Generate new key ───────────────────────────────────────

  log_section "GENERATING NEW ENCRYPTION KEY"

  local NEW_KEY
  NEW_KEY=$(bash -c "source ~/.nvm/nvm.sh && node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"" 2>/dev/null)
  log "New encryption key: ${NEW_KEY:0:8}...${NEW_KEY: -4} (${#NEW_KEY} chars)"

  if [ "$DRY_RUN" = true ]; then
    log ""
    log "DRY RUN: Would re-encrypt all PATs from old key to new key"
    log "  Old key: ${OLD_KEY:0:8}..."
    log "  New key: ${NEW_KEY:0:8}..."

    # Count how many PATs need re-encryption
    local pat_count
    pat_count=$(docker exec cranis2_postgres psql -U "${PG_USER}" -d "${PG_DB}" -t -A \
      -c "SELECT count(*) FROM repo_connections WHERE access_token_encrypted IS NOT NULL;" 2>/dev/null || echo "?")
    log "  PATs to re-encrypt: ${pat_count}"
    exit 0
  fi

  # ── Step 2: Get a Postgres dump ────────────────────────────────────

  log_section "PREPARING DATABASE DUMP"

  local DUMP_FILE="${ROTATION_DIR}/cranis2-pre-rotation.dump"

  if [ -n "$EXISTING_DUMP" ]; then
    log "Using existing dump: ${EXISTING_DUMP}"
    cp "$EXISTING_DUMP" "$DUMP_FILE"
  else
    log "Taking fresh Postgres dump..."
    if ! docker exec cranis2_postgres pg_dump -U "${PG_USER}" -d "${PG_DB}" \
      --format=custom --compress=6 > "${DUMP_FILE}" 2>/dev/null; then
      log "ERROR: Failed to dump Postgres"
      exit 1
    fi
  fi

  local dump_size
  dump_size=$(du -h "${DUMP_FILE}" | cut -f1)
  log "Dump size: ${dump_size}"

  # ── Step 3: Start temporary Postgres ───────────────────────────────

  log_section "STARTING TEMPORARY POSTGRES"

  docker run -d --name "$PG_ROTATE" \
    -e POSTGRES_USER="$PG_USER" \
    -e POSTGRES_PASSWORD="$PG_PASS" \
    -e POSTGRES_DB="$PG_DB" \
    postgres:16-alpine > /dev/null 2>&1

  # Wait for ready
  local waited=0
  while ! docker exec "$PG_ROTATE" pg_isready -U "$PG_USER" > /dev/null 2>&1; do
    sleep 1
    waited=$((waited + 1))
    if [ "$waited" -ge 30 ]; then
      log "ERROR: Temp Postgres did not start within 30s"
      exit 1
    fi
  done
  log "Temporary Postgres ready (${waited}s)"

  # Restore
  log "Restoring dump into temporary Postgres..."
  if ! cat "${DUMP_FILE}" | docker exec -i "$PG_ROTATE" \
    pg_restore -U "$PG_USER" -d "$PG_DB" --no-owner --no-privileges 2>/dev/null; then
    log "WARNING: pg_restore reported warnings (may be non-fatal)"
  fi

  # ── Step 4: Re-encrypt PATs ────────────────────────────────────────

  log_section "RE-ENCRYPTING PATs"

  # Count PATs
  local pat_count
  pat_count=$(docker exec "$PG_ROTATE" psql -U "$PG_USER" -d "$PG_DB" -t -A \
    -c "SELECT count(*) FROM repo_connections WHERE access_token_encrypted IS NOT NULL;" 2>/dev/null)
  log "PATs to re-encrypt: ${pat_count}"

  if [ "$pat_count" = "0" ] || [ "$pat_count" = "" ]; then
    log "No PATs to re-encrypt"
  else
    # Use Node.js to do the actual decryption/re-encryption
    # This replicates the exact logic from encryption.ts
    bash -c "source ~/.nvm/nvm.sh && node -e \"
const { hkdfSync, createDecipheriv, createCipheriv, randomBytes } = require('crypto');

const OLD_KEY_HEX = '${OLD_KEY}';
const NEW_KEY_HEX = '${NEW_KEY}';
const HKDF_SALT = Buffer.from('cranis2-hkdf-salt-v1', 'utf-8');

// Derive keys
function deriveKey(hex) {
  return Buffer.from(hkdfSync('sha256', Buffer.from(hex, 'hex'), HKDF_SALT, 'cranis2-encryption-v1', 32));
}

const oldLegacyKey = Buffer.from(OLD_KEY_HEX, 'hex');
const oldDerivedKey = deriveKey(OLD_KEY_HEX);
const newDerivedKey = deriveKey(NEW_KEY_HEX);

// Decrypt with auto-detection (v1 or v2)
function decrypt(encrypted) {
  const parts = encrypted.split(':');
  let key, iv, tag, ciphertext;
  if (parts[0] === 'v2' && parts.length === 4) {
    key = oldDerivedKey; iv = Buffer.from(parts[1], 'hex');
    tag = Buffer.from(parts[2], 'hex'); ciphertext = parts[3];
  } else if (parts.length === 3) {
    key = oldLegacyKey; iv = Buffer.from(parts[0], 'hex');
    tag = Buffer.from(parts[1], 'hex'); ciphertext = parts[2];
  } else {
    throw new Error('Invalid format: ' + encrypted.substring(0, 20));
  }
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext, 'hex', 'utf8') + decipher.final('utf8');
}

// Encrypt with new key (v2 format)
function encrypt(plaintext) {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', newDerivedKey, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex') + cipher.final('hex');
  const tag = cipher.getAuthTag();
  return 'v2:' + iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
}

// Connect to temp Postgres and re-encrypt
const { Client } = require('pg');
const client = new Client({
  host: 'localhost',
  port: 5432, // inside the temp container network — we'll use docker exec instead
});

// We'll output SQL UPDATE statements to stdout
process.stdin.resume();
process.stdin.setEncoding('utf8');
let data = '';
process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  const rows = data.trim().split('\n').filter(Boolean);
  let success = 0, errors = 0;
  for (const row of rows) {
    const [id, encrypted] = row.split('\t');
    try {
      const plaintext = decrypt(encrypted);
      const reEncrypted = encrypt(plaintext);
      // Output SQL for docker exec
      console.log('UPDATE repo_connections SET access_token_encrypted = \\'' + reEncrypted.replace(/'/g, \"''\") + '\\' WHERE id = \\'' + id.replace(/'/g, \"''\") + '\\';');
      success++;
    } catch (e) {
      console.error('ERROR re-encrypting id=' + id + ': ' + e.message);
      errors++;
    }
  }
  console.error('Re-encrypted: ' + success + ' Success, ' + errors + ' Errors');
});
\"" < <(docker exec "$PG_ROTATE" psql -U "$PG_USER" -d "$PG_DB" -t -A \
  -c "SELECT id, access_token_encrypted FROM repo_connections WHERE access_token_encrypted IS NOT NULL;") \
  > "${ROTATION_DIR}/re-encrypt.sql" 2>"${ROTATION_DIR}/re-encrypt.log"

    # Show results
    cat "${ROTATION_DIR}/re-encrypt.log" | while read -r line; do log "  ${line}"; done

    # Apply the re-encryption SQL to the temp database
    local sql_lines
    sql_lines=$(wc -l < "${ROTATION_DIR}/re-encrypt.sql")
    if [ "$sql_lines" -gt 0 ]; then
      log "Applying ${sql_lines} UPDATE statements..."
      cat "${ROTATION_DIR}/re-encrypt.sql" | docker exec -i "$PG_ROTATE" \
        psql -U "$PG_USER" -d "$PG_DB" > /dev/null 2>&1
      log "Re-encryption applied"
    fi
  fi

  # ── Step 5: Dump re-encrypted database ─────────────────────────────

  log_section "CREATING RE-ENCRYPTED DUMP"

  local OUTPUT_DUMP="${ROTATION_DIR}/cranis2-rotated.dump"
  if ! docker exec "$PG_ROTATE" pg_dump -U "$PG_USER" -d "$PG_DB" \
    --format=custom --compress=6 > "${OUTPUT_DUMP}" 2>/dev/null; then
    log "ERROR: Failed to dump re-encrypted database"
    exit 1
  fi

  local output_size
  output_size=$(du -h "${OUTPUT_DUMP}" | cut -f1)
  log "Re-encrypted dump: ${output_size}"

  # ── Step 6: Package for deployment ─────────────────────────────────

  log_section "PACKAGING FOR DEPLOYMENT"

  # Write the new key to a file (not .env — that's production's job)
  cat > "${ROTATION_DIR}/new-env-values.txt" <<ENVFILE
# Generated by rotate-encryption-key.sh on ${TIMESTAMP}
# Apply these to production .env during the maintenance window
GITHUB_ENCRYPTION_KEY=${NEW_KEY}
ENVFILE

  # Write deployment instructions
  cat > "${ROTATION_DIR}/DEPLOY.md" <<DEPLOY
# Encryption Key Rotation — ${TIMESTAMP}

## Files in this package

- \`cranis2-rotated.dump\` — Postgres dump with PATs re-encrypted using the new key
- \`new-env-values.txt\` — New GITHUB_ENCRYPTION_KEY value for production .env
- \`cranis2-pre-rotation.dump\` — Original dump (rollback)
- \`re-encrypt.sql\` — SQL statements used for re-encryption (audit trail)

## Deployment Steps

1. Schedule a maintenance window
2. Copy this directory to the production server
3. Run: \`./scripts/apply-key-rotation.sh ${ROTATION_DIR}\`

## Rollback

If something goes wrong, restore from \`cranis2-pre-rotation.dump\`:
\`\`\`bash
./scripts/restore-databases.sh ${ROTATION_DIR}/cranis2-pre-rotation.dump --postgres-only
\`\`\`
Then revert GITHUB_ENCRYPTION_KEY in .env to the old value.
DEPLOY

  log "Package ready at: ${ROTATION_DIR}"
  log "Contents:"
  ls -lh "${ROTATION_DIR}" | while read -r line; do log "  ${line}"; done

  # Record in ledger
  record_rotation() {
    local entry="{\"key\": \"GITHUB_ENCRYPTION_KEY\", \"rotated_at\": \"${TIMESTAMP}\", \"package\": \"${ROTATION_DIR}\"}"
    if [ ! -f "${LEDGER_FILE}" ]; then
      echo "[${entry}]" > "${LEDGER_FILE}"
    else
      local tmp="${LEDGER_FILE}.tmp.$$"
      sed '$ s/]$/,/' "${LEDGER_FILE}" > "${tmp}"
      echo "${entry}]" >> "${tmp}"
      mv "${tmp}" "${LEDGER_FILE}"
    fi
  }
  record_rotation

  log_section "ENCRYPTION KEY ROTATION COMPLETE"
  log ""
  log "Next steps:"
  log "  1. Transfer ${ROTATION_DIR} to production server"
  log "  2. Schedule maintenance window"
  log "  3. Run: ./scripts/apply-key-rotation.sh ${ROTATION_DIR}"
  log ""
  log "Log: ${LOG_FILE}"
}

main

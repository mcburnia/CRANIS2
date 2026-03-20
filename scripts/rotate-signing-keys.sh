#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# CRANIS2 — Signing Key Rotation Script (Annual)
#
# Generates new Ed25519 and ML-DSA-65 key pairs for document signing.
# Archives the old public keys so historical documents remain verifiable.
#
# Usage:
#   ./scripts/rotate-signing-keys.sh              # generate new key pairs
#   ./scripts/rotate-signing-keys.sh --dry-run    # preview only
#
# This script runs on the LAB SERVER:
#   1. Generates new Ed25519 + ML-DSA-65 key pairs
#   2. Packages new private keys (base64-encoded for .env)
#   3. Archives current public keys with rotation timestamp
#   4. Produces a deployment package for apply-key-rotation.sh
#
# Runs on: Lab server ONLY
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${PROJECT_ROOT}/logs"
TIMESTAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
LOG_FILE="${LOG_DIR}/rotate-signing-${TIMESTAMP}.log"
ROTATION_DIR="${PROJECT_ROOT}/logs/signing-rotation-${TIMESTAMP}"
LEDGER_FILE="${PROJECT_ROOT}/logs/rotation-ledger.json"

DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
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

main() {
  log "╔══════════════════════════════════════════════════════════════╗"
  log "║          CRANIS2 SIGNING KEY ROTATION                      ║"
  log "╚══════════════════════════════════════════════════════════════╝"
  log ""
  log "Timestamp: ${TIMESTAMP}"
  log "Output:    ${ROTATION_DIR}"
  log "Dry run:   ${DRY_RUN}"

  # ── Archive current public keys ────────────────────────────────────

  log_section "ARCHIVING CURRENT PUBLIC KEYS"

  local archive_dir="${ROTATION_DIR}/archived-public-keys"
  mkdir -p "${archive_dir}"

  # Try to fetch current public keys from the running backend
  local ed25519_archived=false
  local mldsa_archived=false

  if curl -sf http://localhost:3001/.well-known/cranis2-signing-key.pem > "${archive_dir}/cranis2-signing-key-pre-${TIMESTAMP}.pem" 2>/dev/null; then
    log "Archived current Ed25519 public key"
    ed25519_archived=true
  else
    log "No current Ed25519 public key to archive (endpoint not available)"
  fi

  if curl -sf http://localhost:3001/.well-known/cranis2-signing-key-mldsa.pem > "${archive_dir}/cranis2-signing-key-mldsa-pre-${TIMESTAMP}.pem" 2>/dev/null; then
    log "Archived current ML-DSA-65 public key"
    mldsa_archived=true
  else
    log "No current ML-DSA-65 public key to archive (endpoint not available)"
  fi

  # ── Generate new key pairs ─────────────────────────────────────────

  log_section "GENERATING NEW KEY PAIRS"

  if [ "$DRY_RUN" = true ]; then
    log "DRY RUN: Would generate new Ed25519 + ML-DSA-65 key pairs"
    exit 0
  fi

  bash -c "source ~/.nvm/nvm.sh && node -e \"
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const rotDir = '${ROTATION_DIR}';

// ── Ed25519 ──
const ed = crypto.generateKeyPairSync('ed25519');
const edPrivPem = ed.privateKey.export({ type: 'pkcs8', format: 'pem' });
const edPubPem = ed.publicKey.export({ type: 'spki', format: 'pem' });
const edB64 = Buffer.from(edPrivPem).toString('base64');
const edKeyId = crypto.createHash('sha256').update(edPubPem).digest('hex').substring(0, 8);

console.log('Ed25519 Key ID: ' + edKeyId);
console.log('Ed25519 sig size: 64 bytes');

fs.writeFileSync(path.join(rotDir, 'cranis2-signing-key.pem'), edPubPem);

// ── ML-DSA-65 ──
const ml = crypto.generateKeyPairSync('ml-dsa-65');
const mlPrivPem = ml.privateKey.export({ type: 'pkcs8', format: 'pem' });
const mlPubPem = ml.publicKey.export({ type: 'spki', format: 'pem' });
const mlB64 = Buffer.from(mlPrivPem).toString('base64');
const mlKeyId = crypto.createHash('sha256').update(mlPubPem).digest('hex').substring(0, 8);

// Verify the new keys work
const testData = Buffer.from('CRANIS2 signing key rotation verification');
const edSig = crypto.sign(null, testData, ed.privateKey);
const mlSig = crypto.sign(null, testData, ml.privateKey);
const edValid = crypto.verify(null, testData, ed.publicKey, edSig);
const mlValid = crypto.verify(null, testData, ml.publicKey, mlSig);

console.log('ML-DSA-65 Key ID: ' + mlKeyId);
console.log('ML-DSA-65 sig size: ' + mlSig.length + ' bytes');
console.log('Ed25519 verify: ' + edValid);
console.log('ML-DSA-65 verify: ' + mlValid);

if (!edValid || !mlValid) {
  console.error('ERROR: Key verification failed');
  process.exit(1);
}

fs.writeFileSync(path.join(rotDir, 'cranis2-signing-key-mldsa.pem'), mlPubPem);

// Write new .env values
const envValues = [
  '# Generated by rotate-signing-keys.sh on ${TIMESTAMP}',
  '# Apply these to production .env during the maintenance window',
  'CRANIS2_SIGNING_KEY=' + edB64,
  'CRANIS2_SIGNING_KEY_MLDSA=' + mlB64,
].join('\n') + '\n';

fs.writeFileSync(path.join(rotDir, 'new-signing-keys.txt'), envValues);

console.log('Keys written to: ' + rotDir);
\""

  log "New key pairs generated and verified"

  # ── Write deployment instructions ──────────────────────────────────

  cat > "${ROTATION_DIR}/DEPLOY.md" <<DEPLOY
# Signing Key Rotation — ${TIMESTAMP}

## Files in this package

- \`new-signing-keys.txt\` — New CRANIS2_SIGNING_KEY and CRANIS2_SIGNING_KEY_MLDSA values for .env
- \`cranis2-signing-key.pem\` — New Ed25519 public key
- \`cranis2-signing-key-mldsa.pem\` — New ML-DSA-65 public key
- \`archived-public-keys/\` — Previous public keys (for verifying historical documents)

## Deployment Steps

1. Schedule a maintenance window
2. Copy this directory to the production server
3. Run: \`./scripts/apply-key-rotation.sh ${ROTATION_DIR}\`

## Important

After rotation, documents signed with the OLD keys can still be verified using
the archived public keys in \`archived-public-keys/\`. Store these permanently.

Documents signed AFTER rotation use the new keys and are verified via the
\`/.well-known/\` endpoints which will serve the new public keys.
DEPLOY

  # Record in ledger
  local entry="{\"key\": \"SIGNING_KEYS\", \"rotated_at\": \"${TIMESTAMP}\", \"package\": \"${ROTATION_DIR}\"}"
  if [ ! -f "${LEDGER_FILE}" ]; then
    echo "[${entry}]" > "${LEDGER_FILE}"
  else
    local tmp="${LEDGER_FILE}.tmp.$$"
    sed '$ s/]$/,/' "${LEDGER_FILE}" > "${tmp}"
    echo "${entry}]" >> "${tmp}"
    mv "${tmp}" "${LEDGER_FILE}"
  fi

  log_section "SIGNING KEY ROTATION COMPLETE"
  log ""
  log "Package ready at: ${ROTATION_DIR}"
  log ""
  log "Next steps:"
  log "  1. Transfer ${ROTATION_DIR} to production server"
  log "  2. Schedule maintenance window"
  log "  3. Run: ./scripts/apply-key-rotation.sh ${ROTATION_DIR}"
  log "  4. Archive the old public keys permanently"
  log ""
  log "Log: ${LOG_FILE}"
}

main

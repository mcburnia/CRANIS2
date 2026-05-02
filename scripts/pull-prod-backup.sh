#!/usr/bin/env bash
# Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
# SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
#
# This file is part of CRANIS2 — a personally-owned, personally-funded
# software product. Unauthorised copying, modification, distribution,
# or commercial use is prohibited. For licence enquiries:
# andi.mcburnie@gmail.com

# ──────────────────────────────────────────────────────────────────────
# CRANIS2 — Encrypted Backup Mirror Pull (dev side)
#
# Runs on the dev server. Connects to production via the dedicated
# passphraseless SSH key (~/.ssh/cranis2_prod) and pulls the latest
# daily backup. The backup is encrypted on dev with `age` using the
# public key — the private key never leaves dev. Plaintext only exists
# in pipe memory during transit, never on disk.
#
# Implements GFS retention on dev (independent of prod's GFS):
#   daily/   — 7 retained (pruned oldest)
#   weekly/  — 4 retained, promoted on Sunday
#   monthly/ — 12 retained, promoted on 1st of month
#
# Usage:
#   ./scripts/pull-prod-backup.sh                  # pull latest daily
#
# Cron entry (recommended, dev side):
#   0 3 * * * /home/mcburnia/cranis2/scripts/pull-prod-backup.sh \
#               >> /home/mcburnia/cranis2-backup-mirror/logs/pull.log 2>&1
#
# Recovery — to decrypt a backup:
#   age -d -i ~/.age/cranis2-backup.key \
#       /home/mcburnia/cranis2-backup-mirror/daily/<stamp>.tar.age \
#       | tar x -C /tmp/restore
# ──────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────
MIRROR_ROOT="${HOME}/cranis2-backup-mirror"
DAILY_DIR="${MIRROR_ROOT}/daily"
WEEKLY_DIR="${MIRROR_ROOT}/weekly"
MONTHLY_DIR="${MIRROR_ROOT}/monthly"
LOG_DIR="${MIRROR_ROOT}/logs"

AGE_PUB_FILE="${HOME}/.age/cranis2-backup.pub"
SSH_KEY="${HOME}/.ssh/cranis2_prod"
SSH_HOST="mcburnia@83.228.241.168"
SSH_OPTS=(-i "$SSH_KEY" -o IdentitiesOnly=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new -o BatchMode=yes)

TIMESTAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"

# ── Helpers ──────────────────────────────────────────────────────────
log() { echo "[$(date -u +%H:%M:%S)] $*"; }
err() { echo "[$(date -u +%H:%M:%S)] ERROR: $*" >&2; }

cleanup_temp() {
  if [ -n "${TMP_FILE:-}" ] && [ -f "${TMP_FILE}" ]; then
    rm -f "${TMP_FILE}"
  fi
}
trap cleanup_temp EXIT

# ── Pre-flight ───────────────────────────────────────────────────────
mkdir -p "$DAILY_DIR" "$WEEKLY_DIR" "$MONTHLY_DIR" "$LOG_DIR"

if ! command -v age >/dev/null 2>&1; then
  err "age is not installed. Run: sudo apt install -y age"
  exit 1
fi

if [ ! -f "$AGE_PUB_FILE" ]; then
  err "age public key not found at $AGE_PUB_FILE"
  exit 1
fi
AGE_PUB="$(cat "$AGE_PUB_FILE")"

if [ ! -f "$SSH_KEY" ]; then
  err "SSH key not found at $SSH_KEY"
  exit 1
fi

log "=== CRANIS2 Backup Mirror Pull ==="
log "Source:      ${SSH_HOST}"
log "Destination: ${DAILY_DIR}"
log "Recipient:   ${AGE_PUB}"

# ── 1. Ask prod for the latest daily backup name ─────────────────────
# The restricted SSH key on prod limits us to running serve-backup.sh.
# That script accepts these subcommands via SSH_ORIGINAL_COMMAND:
#   "name"  — print the latest daily backup directory name (one line, stdout)
#   "tar"   — stream tarball of latest daily on stdout
LATEST_NAME="$(ssh "${SSH_OPTS[@]}" "$SSH_HOST" name | tr -d '\r')"

if [ -z "$LATEST_NAME" ]; then
  err "Failed to fetch latest backup name from production"
  exit 1
fi
log "Latest prod daily: ${LATEST_NAME}"

OUT_FILE="${DAILY_DIR}/${LATEST_NAME}.tar.age"

if [ -f "$OUT_FILE" ]; then
  log "Already mirrored — nothing to do: ${OUT_FILE}"
  exit 0
fi

# ── 2. Stream tarball through age in one pipe ────────────────────────
# Plaintext tarball flows: prod tar → SSH stream → age (on dev) → ciphertext file.
# Plaintext NEVER lands on disk; only in pipe memory while age is encrypting.
TMP_FILE="${OUT_FILE}.partial"

if ! ssh "${SSH_OPTS[@]}" "$SSH_HOST" tar | age -r "$AGE_PUB" -o "$TMP_FILE"; then
  err "Pull/encrypt pipe failed"
  exit 1
fi

# Atomic rename — the .tar.age file only appears once it is complete.
mv "$TMP_FILE" "$OUT_FILE"
SIZE_HUMAN="$(du -h "$OUT_FILE" | cut -f1)"
log "Encrypted backup written: ${OUT_FILE} (${SIZE_HUMAN})"

# ── 3. GFS promotion on dev (independent of prod's GFS) ──────────────
DOW="$(date -u +%u)"  # 7 = Sunday
DOM="$(date -u +%d)"

if [ "$DOW" = "7" ]; then
  cp -al "$OUT_FILE" "${WEEKLY_DIR}/$(basename "$OUT_FILE")" 2>/dev/null \
    || cp "$OUT_FILE" "${WEEKLY_DIR}/$(basename "$OUT_FILE")"
  log "Promoted to weekly mirror"
fi

if [ "$DOM" = "01" ]; then
  cp -al "$OUT_FILE" "${MONTHLY_DIR}/$(basename "$OUT_FILE")" 2>/dev/null \
    || cp "$OUT_FILE" "${MONTHLY_DIR}/$(basename "$OUT_FILE")"
  log "Promoted to monthly mirror"
fi

# ── 4. Retention pruning ─────────────────────────────────────────────
prune_to() {
  local dir="$1" keep="$2" tier="$3"
  local count
  count="$(find "$dir" -mindepth 1 -maxdepth 1 -type f -name '*.tar.age' 2>/dev/null | wc -l)"
  if [ "$count" -gt "$keep" ]; then
    find "$dir" -mindepth 1 -maxdepth 1 -type f -name '*.tar.age' \
      | sort | head -n "$((count - keep))" \
      | while read -r old; do
          rm -f "$old"
          log "  Pruned old ${tier}: $(basename "$old")"
        done
  fi
}

prune_to "$DAILY_DIR"   7  daily
prune_to "$WEEKLY_DIR"  4  weekly
prune_to "$MONTHLY_DIR" 12 monthly

# ── 5. Summary ───────────────────────────────────────────────────────
DAILY_N=$(find "$DAILY_DIR"   -mindepth 1 -maxdepth 1 -type f -name '*.tar.age' | wc -l)
WEEKLY_N=$(find "$WEEKLY_DIR"  -mindepth 1 -maxdepth 1 -type f -name '*.tar.age' | wc -l)
MONTHLY_N=$(find "$MONTHLY_DIR" -mindepth 1 -maxdepth 1 -type f -name '*.tar.age' | wc -l)
TOTAL_HUMAN=$(du -sh "$MIRROR_ROOT" 2>/dev/null | cut -f1)

log "Mirror state: daily=${DAILY_N}/7 weekly=${WEEKLY_N}/4 monthly=${MONTHLY_N}/12 total=${TOTAL_HUMAN}"
log "=== PULL COMPLETE ==="

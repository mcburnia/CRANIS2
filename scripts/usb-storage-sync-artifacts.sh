#!/usr/bin/env bash
# Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
# SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
#
# This file is part of CRANIS2 — a personally-owned, personally-funded
# software product. Unauthorised copying, modification, distribution,
# or commercial use is prohibited. For licence enquiries:
# andi.mcburnie@gmail.com

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOUNT_POINT="${1:-/mnt/usb-storage}"
ROOT_DIR="${MOUNT_POINT}/CRANIS2-storage"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

if ! findmnt -rn "${MOUNT_POINT}" >/dev/null 2>&1; then
  echo "Mount point is not active: ${MOUNT_POINT}"
  exit 1
fi

if [ ! -w "${MOUNT_POINT}" ]; then
  echo "Mount point is not writable: ${MOUNT_POINT}"
  exit 1
fi

mkdir -p \
  "${ROOT_DIR}/artifacts/e2e" \
  "${ROOT_DIR}/artifacts/vitest" \
  "${ROOT_DIR}/backups/repo-snapshots"

if [ -f "${PROJECT_ROOT}/backend/tests/test-results.json" ]; then
  cp "${PROJECT_ROOT}/backend/tests/test-results.json" \
    "${ROOT_DIR}/artifacts/vitest/test-results-${STAMP}.json"
  echo "Copied backend Vitest report."
fi

if [ -d "${PROJECT_ROOT}/e2e/test-results" ]; then
  cp -a "${PROJECT_ROOT}/e2e/test-results" \
    "${ROOT_DIR}/artifacts/e2e/test-results-${STAMP}"
  echo "Copied Playwright JSON + failure artifacts."
fi

if [ -d "${PROJECT_ROOT}/e2e/playwright-report" ]; then
  cp -a "${PROJECT_ROOT}/e2e/playwright-report" \
    "${ROOT_DIR}/artifacts/e2e/playwright-report-${STAMP}"
  echo "Copied Playwright HTML report."
fi

tar -czf "${ROOT_DIR}/backups/repo-snapshots/cranis2-repo-${STAMP}.tgz" \
  --exclude='.git' \
  --exclude='**/node_modules' \
  --exclude='**/dist' \
  -C "${PROJECT_ROOT}" .

echo "Created repo snapshot: cranis2-repo-${STAMP}.tgz"

# ── Copy latest database backup to USB ───────────────────────────────

DB_DUMPS_DIR="${ROOT_DIR}/backups/db-dumps"
mkdir -p "${DB_DUMPS_DIR}"

LATEST_BACKUP="$(find "${PROJECT_ROOT}/backups/daily" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort -r | head -1)"
if [ -n "$LATEST_BACKUP" ] && [ -d "$LATEST_BACKUP" ]; then
  BACKUP_NAME="$(basename "$LATEST_BACKUP")"
  cp -a "$LATEST_BACKUP" "${DB_DUMPS_DIR}/${BACKUP_NAME}"
  echo "Copied database backup: ${BACKUP_NAME}"

  # Keep only 4 most recent db dumps on USB
  DB_COUNT=$(find "${DB_DUMPS_DIR}" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
  if [ "$DB_COUNT" -gt 4 ]; then
    find "${DB_DUMPS_DIR}" -mindepth 1 -maxdepth 1 -type d \
      | sort | head -n "$((DB_COUNT - 4))" \
      | xargs rm -rf
    echo "Cleaned old USB database backups (kept 4)"
  fi
else
  echo "No database backup found to copy (run backup-databases.sh first)"
fi

echo "Sync complete at ${ROOT_DIR}"

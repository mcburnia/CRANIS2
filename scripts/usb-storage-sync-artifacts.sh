#!/usr/bin/env bash
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
echo "Sync complete at ${ROOT_DIR}"

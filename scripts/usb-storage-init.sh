#!/usr/bin/env bash
set -euo pipefail

MOUNT_POINT="${1:-/mnt/usb-storage}"
ROOT_DIR="${MOUNT_POINT}/CRANIS2-storage"

if ! findmnt -rn "${MOUNT_POINT}" >/dev/null 2>&1; then
  echo "Mount point is not active: ${MOUNT_POINT}"
  echo "Mount the USB drive first, then rerun this script."
  exit 1
fi

if [ ! -w "${MOUNT_POINT}" ]; then
  echo "Mount point is not writable: ${MOUNT_POINT}"
  echo "If the filesystem mounted read-only, backups cannot be written."
  exit 1
fi

mkdir -p \
  "${ROOT_DIR}/artifacts/e2e" \
  "${ROOT_DIR}/artifacts/vitest" \
  "${ROOT_DIR}/backups/repo-snapshots" \
  "${ROOT_DIR}/backups/db-dumps"

echo "USB storage initialized at: ${ROOT_DIR}"
echo "No existing files were removed or modified."

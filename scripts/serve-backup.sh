#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# CRANIS2 — Restricted Backup Server (prod side)
#
# Invoked by the dev mirror's SSH key, which is restricted in
# ~/.ssh/authorized_keys with:
#   command="/home/mcburnia/cranis2/scripts/serve-backup.sh",no-pty,
#           no-port-forwarding,no-agent-forwarding,no-X11-forwarding
#
# This means: even though the dev key is passphraseless, a compromise
# of dev only allows running THIS script — not arbitrary shell.
#
# Subcommands (read from $SSH_ORIGINAL_COMMAND):
#   "name"  — print the timestamp directory name of the latest daily
#             backup on stdout, single line. Used by dev to decide
#             whether it has already mirrored this backup.
#   "tar"   — write a tarball of the latest daily backup to stdout.
#             Dev pipes this through `age` for at-rest encryption.
#
# Anything else exits 1. No shell access, no file path arguments
# accepted from the client.
# ──────────────────────────────────────────────────────────────────────

set -euo pipefail

BACKUP_ROOT="${HOME}/cranis2/backups"
DAILY_DIR="${BACKUP_ROOT}/daily"

# Find latest daily backup (sorted by name = sorted by UTC timestamp)
LATEST_NAME="$(ls -1 "$DAILY_DIR" 2>/dev/null | sort | tail -1 || true)"

if [ -z "$LATEST_NAME" ] || [ ! -d "$DAILY_DIR/$LATEST_NAME" ]; then
  echo "ERROR: no daily backup found" >&2
  exit 1
fi

# Strict subcommand whitelist — argument comes from $SSH_ORIGINAL_COMMAND.
case "${SSH_ORIGINAL_COMMAND:-}" in
  name)
    echo "$LATEST_NAME"
    ;;
  tar)
    cd "$DAILY_DIR"
    # Stream tarball of just the latest backup directory on stdout.
    tar c "$LATEST_NAME"
    ;;
  *)
    echo "ERROR: unknown subcommand: ${SSH_ORIGINAL_COMMAND:-<empty>}" >&2
    echo "Allowed: name, tar" >&2
    exit 1
    ;;
esac

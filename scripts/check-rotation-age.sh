#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# CRANIS2 — Key Rotation Age Checker
#
# Reads the rotation ledger and reports how many days since each key
# was last rotated. Warns when a key is approaching or past its
# rotation threshold.
#
# Usage:
#   ./scripts/check-rotation-age.sh           # check all keys
#   ./scripts/check-rotation-age.sh --json    # machine-readable output
#
# Thresholds:
#   Monthly keys (30 days):  POSTGRES_PASSWORD, NEO4J_PASSWORD,
#                            FORGEJO_DB_PASSWD, JWT_SECRET, WELCOME_SECRET
#   Annual keys (365 days):  GITHUB_ENCRYPTION_KEY, SIGNING_KEYS
#
# Cron entry (weekly check, Mondays at 06:00 UTC):
#   0 6 * * 1 /home/mcburnia/cranis2/scripts/check-rotation-age.sh >> /home/mcburnia/cranis2/logs/rotation-check.log 2>&1
#
# Exit codes:
#   0 = all keys within threshold
#   1 = one or more keys overdue
#   2 = no ledger found (never rotated)
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LEDGER_FILE="${PROJECT_ROOT}/logs/rotation-ledger.json"

JSON_OUTPUT=false
for arg in "$@"; do
  case "$arg" in
    --json) JSON_OUTPUT=true ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

# Key rotation thresholds in days
declare -A THRESHOLDS=(
  [POSTGRES_PASSWORD]=30
  [NEO4J_PASSWORD]=30
  [FORGEJO_DB_PASSWD]=30
  [JWT_SECRET]=30
  [WELCOME_SECRET]=30
  [GITHUB_ENCRYPTION_KEY]=365
  [SIGNING_KEYS]=365
)

# Friendly names
declare -A LABELS=(
  [POSTGRES_PASSWORD]="Postgres password"
  [NEO4J_PASSWORD]="Neo4j password"
  [FORGEJO_DB_PASSWD]="Forgejo DB password"
  [JWT_SECRET]="JWT signing secret"
  [WELCOME_SECRET]="Welcome site secret"
  [GITHUB_ENCRYPTION_KEY]="Encryption key (PATs)"
  [SIGNING_KEYS]="Signing keys (Ed25519+ML-DSA-65)"
)

NOW_EPOCH=$(date +%s)
OVERDUE=0

# Parse the ledger to find the most recent rotation for each key
declare -A LAST_ROTATED

if [ ! -f "${LEDGER_FILE}" ]; then
  if [ "$JSON_OUTPUT" = true ]; then
    echo '{"status": "no_ledger", "message": "No rotation ledger found. Keys have never been rotated."}'
  else
    echo ""
    echo "[$(date -u +%H:%M:%S)] ⚠  ROTATION CHECK: No ledger found at ${LEDGER_FILE}"
    echo "  Keys have never been formally rotated."
    echo "  Run ./scripts/rotate-credentials.sh to establish the baseline."
  fi
  exit 2
fi

# Extract last rotation timestamp for each key using grep/awk (no jq dependency)
for key in "${!THRESHOLDS[@]}"; do
  # Find the last occurrence of this key in the ledger
  local_ts=$(grep "\"key\": \"${key}\"" "${LEDGER_FILE}" 2>/dev/null | \
    grep -o '"rotated_at": "[^"]*"' | tail -1 | cut -d'"' -f4 || echo "")

  if [ -n "$local_ts" ]; then
    LAST_ROTATED[$key]="$local_ts"
  fi
done

# Output
if [ "$JSON_OUTPUT" = false ]; then
  echo ""
  echo "[$(date -u +%H:%M:%S)] CRANIS2 Key Rotation Age Report"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  printf "  %-35s %-12s %-10s %s\n" "Key" "Last Rotated" "Days Ago" "Status"
  echo "  ─────────────────────────────────── ──────────── ────────── ──────"
fi

json_entries=()

for key in POSTGRES_PASSWORD NEO4J_PASSWORD FORGEJO_DB_PASSWD JWT_SECRET WELCOME_SECRET GITHUB_ENCRYPTION_KEY SIGNING_KEYS; do
  local threshold=${THRESHOLDS[$key]}
  local label="${LABELS[$key]}"
  local last="${LAST_ROTATED[$key]:-never}"
  local days_ago="?"
  local status="UNKNOWN"

  if [ "$last" = "never" ]; then
    status="⚠ NEVER"
    OVERDUE=$((OVERDUE + 1))
  else
    # Parse ISO timestamp to epoch
    local rotated_epoch
    rotated_epoch=$(date -d "${last}" +%s 2>/dev/null || echo "0")

    if [ "$rotated_epoch" -gt 0 ]; then
      days_ago=$(( (NOW_EPOCH - rotated_epoch) / 86400 ))

      if [ "$days_ago" -gt "$threshold" ]; then
        status="⛔ OVERDUE"
        OVERDUE=$((OVERDUE + 1))
      elif [ "$days_ago" -gt $(( threshold * 80 / 100 )) ]; then
        status="⚠ DUE SOON"
      else
        status="✓ OK"
      fi
    fi
  fi

  if [ "$JSON_OUTPUT" = false ]; then
    printf "  %-35s %-12s %-10s %s\n" "$label" "${last:0:10}" "$days_ago" "$status"
  fi

  json_entries+=("{\"key\": \"${key}\", \"label\": \"${label}\", \"last_rotated\": \"${last}\", \"days_ago\": ${days_ago:-null}, \"threshold\": ${threshold}, \"status\": \"${status}\"}")
done

if [ "$JSON_OUTPUT" = true ]; then
  echo "{\"checked_at\": \"$(date -u +%Y-%m-%dT%H%M%SZ)\", \"overdue\": ${OVERDUE}, \"keys\": [$(IFS=,; echo "${json_entries[*]}")]}"
else
  echo ""
  if [ "$OVERDUE" -gt 0 ]; then
    echo "  ⚠  ${OVERDUE} key(s) overdue or never rotated"
  else
    echo "  ✓ All keys within rotation thresholds"
  fi
  echo ""
fi

if [ "$OVERDUE" -gt 0 ]; then
  exit 1
fi
exit 0

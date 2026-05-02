#!/usr/bin/env bash
# Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
# SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
#
# This file is part of CRANIS2 — a personally-owned, personally-funded
# software product. Unauthorised copying, modification, distribution,
# or commercial use is prohibited. For licence enquiries:
# andi.mcburnie@gmail.com

# ──────────────────────────────────────────────────────────────────────
# CRANIS2 — Security Patch Script
#
# Audits npm dependencies for known vulnerabilities and applies safe
# fixes. Generates a patch report documenting what changed.
#
# Usage:
#   ./scripts/apply-security-patch.sh                  # audit + fix (non-breaking only)
#   ./scripts/apply-security-patch.sh --audit-only     # audit only, no changes
#   ./scripts/apply-security-patch.sh --breaking       # allow breaking changes (major updates)
#   ./scripts/apply-security-patch.sh --package lodash # fix a specific package only
#   ./scripts/apply-security-patch.sh --dry-run        # show what would change
#
# Exit codes:
#   0 = all clear or patches applied successfully
#   1 = patching failed or tests failed after patching
#   2 = vulnerabilities found but --audit-only specified
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${PROJECT_ROOT}/logs"
TIMESTAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
LOG_FILE="${LOG_DIR}/security-patch-${TIMESTAMP}.log"
REPORT_FILE="${LOG_DIR}/security-patch-report-${TIMESTAMP}.json"
RESULTS_TMP="${LOG_DIR}/.audit-results-${TIMESTAMP}.tmp"

# ── Parse arguments ──────────────────────────────────────────────────

AUDIT_ONLY=false
ALLOW_BREAKING=false
DRY_RUN=false
TARGET_PACKAGE=""
for arg in "$@"; do
  case "$arg" in
    --audit-only)  AUDIT_ONLY=true ;;
    --breaking)    ALLOW_BREAKING=true ;;
    --dry-run)     DRY_RUN=true ;;
    --package)     shift; TARGET_PACKAGE="${1:-}" ;;
    --package=*)   TARGET_PACKAGE="${arg#--package=}" ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

mkdir -p "${LOG_DIR}"

# ── Logging ──────────────────────────────────────────────────────────

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

# ── Audit a single workspace ────────────────────────────────────────
# Writes JSON result to $RESULTS_TMP (one line per workspace).
# Returns 0 if no vulns, 1 if vulns found.

audit_workspace() {
  local ws_name="$1"
  local ws_path="$2"

  if [ ! -f "${ws_path}/package-lock.json" ] && [ ! -f "${ws_path}/package.json" ]; then
    return 0
  fi

  log ""
  log "  ${ws_name}:"

  local audit_output
  local audit_exit=0
  audit_output=$(bash -c "source ~/.nvm/nvm.sh && cd '${ws_path}' && npm audit --json 2>/dev/null") || audit_exit=$?

  if [ "$audit_exit" -eq 0 ]; then
    log "    No known vulnerabilities"
    echo "{\"workspace\": \"${ws_name}\", \"vulnerabilities\": 0}" >> "${RESULTS_TMP}"
    return 0
  fi

  # Parse vulnerability counts from JSON
  local total critical high moderate low
  total=$(echo "$audit_output" | grep -o '"total":[0-9]*' | head -1 | cut -d: -f2 || echo "0")
  critical=$(echo "$audit_output" | grep -o '"critical":[0-9]*' | head -1 | cut -d: -f2 || echo "0")
  high=$(echo "$audit_output" | grep -o '"high":[0-9]*' | head -1 | cut -d: -f2 || echo "0")
  moderate=$(echo "$audit_output" | grep -o '"moderate":[0-9]*' | head -1 | cut -d: -f2 || echo "0")
  low=$(echo "$audit_output" | grep -o '"low":[0-9]*' | head -1 | cut -d: -f2 || echo "0")

  log "    Found ${total} vulnerabilities (critical: ${critical}, high: ${high}, moderate: ${moderate}, low: ${low})"

  echo "{\"workspace\": \"${ws_name}\", \"vulnerabilities\": ${total:-0}, \"critical\": ${critical:-0}, \"high\": ${high:-0}, \"moderate\": ${moderate:-0}, \"low\": ${low:-0}}" >> "${RESULTS_TMP}"
  return 1
}

# ── Build JSON array from results file ──────────────────────────────

build_results_json() {
  if [ ! -f "${RESULTS_TMP}" ] || [ ! -s "${RESULTS_TMP}" ]; then
    echo "[]"
    return
  fi
  # Read lines into a comma-separated JSON array
  local first=true
  echo -n "["
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    if [ "$first" = true ]; then
      first=false
    else
      echo -n ", "
    fi
    echo -n "$line"
  done < "${RESULTS_TMP}"
  echo "]"
}

# ── Fix a single workspace ──────────────────────────────────────────

fix_workspace() {
  local ws_name="$1"
  local ws_path="$2"

  if [ ! -f "${ws_path}/package-lock.json" ] && [ ! -f "${ws_path}/package.json" ]; then
    return 0
  fi

  log "  Fixing ${ws_name}..."

  # Record lockfile hash before
  local before_hash=""
  if [ -f "${ws_path}/package-lock.json" ]; then
    before_hash=$(sha256sum "${ws_path}/package-lock.json" | cut -d' ' -f1)
  fi

  local fix_args="--json"
  if [ "$ALLOW_BREAKING" = true ]; then
    fix_args="${fix_args} --force"
  fi

  if [ -n "$TARGET_PACKAGE" ]; then
    # Target a specific package
    log "    Targeting package: ${TARGET_PACKAGE}"
    bash -c "source ~/.nvm/nvm.sh && cd '${ws_path}' && npm update ${TARGET_PACKAGE} 2>&1" | while read -r line; do
      log "    ${line}"
    done || true
  else
    bash -c "source ~/.nvm/nvm.sh && cd '${ws_path}' && npm audit fix ${fix_args} 2>/dev/null" | while read -r line; do
      # Only log non-JSON output for readability
      if [[ ! "$line" =~ ^\{ ]]; then
        log "    ${line}"
      fi
    done || true
  fi

  # Check if lockfile changed
  local after_hash=""
  if [ -f "${ws_path}/package-lock.json" ]; then
    after_hash=$(sha256sum "${ws_path}/package-lock.json" | cut -d' ' -f1)
  fi

  if [ "$before_hash" != "$after_hash" ]; then
    log "    Dependencies updated"
    return 0
  else
    log "    No changes needed"
    return 0
  fi
}

# ── Run tests to verify fixes ──────────────────────────────────────

run_verification_tests() {
  log_section "RUNNING VERIFICATION TESTS"

  # Frontend build check
  log "Building frontend to verify no breakage..."
  if ! bash -c "source ~/.nvm/nvm.sh && cd '${PROJECT_ROOT}/frontend' && npm run build 2>&1" | tail -3 | while read -r line; do log "  ${line}"; done; then
    log "FAIL: Frontend build broken by patches"
    return 1
  fi
  log "PASS: Frontend builds successfully"

  # Backend container rebuild
  log "Rebuilding backend container..."
  if ! docker compose -f "${PROJECT_ROOT}/docker-compose.yml" build backend > /dev/null 2>&1; then
    log "FAIL: Backend container build broken by patches"
    return 1
  fi
  log "PASS: Backend container builds successfully"

  # Run backend tests
  log "Running backend tests against test stack..."
  if "${PROJECT_ROOT}/scripts/test-stack.sh" start > /dev/null 2>&1; then
    local test_result=0
    bash -c "source ~/.nvm/nvm.sh && cd '${PROJECT_ROOT}/backend/tests' && TEST_BASE_URL=http://localhost:3011 TEST_NEO4J_URI=bolt://localhost:7699 npx vitest run --config vitest.config.ts 2>&1" | tail -5 | while read -r line; do
      log "  ${line}"
    done || test_result=$?

    "${PROJECT_ROOT}/scripts/test-stack.sh" stop > /dev/null 2>&1 || true

    if [ "$test_result" -ne 0 ]; then
      log "FAIL: Backend tests failed after patching"
      return 1
    fi
    log "PASS: Backend tests pass"
  else
    log "WARN: Could not start test stack — skipping test verification"
  fi

  return 0
}

# ── Write report ────────────────────────────────────────────────────

write_report() {
  local status="$1"
  local details
  details=$(build_results_json)

  cat > "${REPORT_FILE}" <<REPORT
{
  "timestamp": "${TIMESTAMP}",
  "status": "${status}",
  "audit_only": ${AUDIT_ONLY},
  "allow_breaking": ${ALLOW_BREAKING},
  "target_package": "${TARGET_PACKAGE}",
  "workspaces": ${details},
  "log_file": "${LOG_FILE}"
}
REPORT
  log "Report: ${REPORT_FILE}"
}

# ── Cleanup ─────────────────────────────────────────────────────────

cleanup() {
  rm -f "${RESULTS_TMP}" 2>/dev/null || true
}
trap cleanup EXIT

# ── Main ─────────────────────────────────────────────────────────────

main() {
  log "╔══════════════════════════════════════════════════════════════╗"
  log "║             CRANIS2 SECURITY PATCH                         ║"
  log "╚══════════════════════════════════════════════════════════════╝"
  log ""
  log "Timestamp: ${TIMESTAMP}"
  log "Mode: $([ "$AUDIT_ONLY" = true ] && echo 'audit only' || echo 'audit + fix')"
  log "Breaking changes: $([ "$ALLOW_BREAKING" = true ] && echo 'allowed' || echo 'non-breaking only')"
  if [ -n "$TARGET_PACKAGE" ]; then
    log "Target package: ${TARGET_PACKAGE}"
  fi

  # ── Phase 1: Audit ────────────────────────────────────────────────

  log_section "SECURITY AUDIT"

  # Clear any previous results
  > "${RESULTS_TMP}"

  local workspaces=("backend:${PROJECT_ROOT}/backend" "frontend:${PROJECT_ROOT}/frontend" "e2e:${PROJECT_ROOT}/e2e" "welcome:${PROJECT_ROOT}/welcome" "mcp:${PROJECT_ROOT}/mcp")
  local has_vulns=false

  for ws_entry in "${workspaces[@]}"; do
    local ws_name="${ws_entry%%:*}"
    local ws_path="${ws_entry#*:}"
    audit_workspace "$ws_name" "$ws_path" || has_vulns=true
  done

  if [ "$has_vulns" = false ]; then
    log ""
    log "No vulnerabilities found across all workspaces."
    write_report "clean"
    exit 0
  fi

  if [ "$AUDIT_ONLY" = true ]; then
    log ""
    log "Vulnerabilities found. Run without --audit-only to apply fixes."
    write_report "vulnerabilities_found"
    exit 2
  fi

  if [ "$DRY_RUN" = true ]; then
    log ""
    log "Dry run complete. Run without --dry-run to apply fixes."
    write_report "dry_run"
    exit 0
  fi

  # ── Phase 2: Apply fixes ──────────────────────────────────────────

  log_section "APPLYING SECURITY PATCHES"

  for ws_entry in "${workspaces[@]}"; do
    local ws_name="${ws_entry%%:*}"
    local ws_path="${ws_entry#*:}"
    fix_workspace "$ws_name" "$ws_path"
  done

  # ── Phase 3: Re-audit ────────────────────────────────────────────

  log_section "POST-PATCH AUDIT"

  # Reset results for post-patch audit
  > "${RESULTS_TMP}"

  local remaining_vulns=false
  for ws_entry in "${workspaces[@]}"; do
    local ws_name="${ws_entry%%:*}"
    local ws_path="${ws_entry#*:}"
    audit_workspace "$ws_name" "$ws_path" || remaining_vulns=true
  done

  if [ "$remaining_vulns" = true ]; then
    log ""
    log "Some vulnerabilities remain. These may require manual intervention"
    log "or --breaking to resolve (major version updates)."
  else
    log ""
    log "All vulnerabilities resolved."
  fi

  # ── Phase 4: Verify ──────────────────────────────────────────────

  if ! run_verification_tests; then
    log ""
    log "Tests failed after patching. Reverting package changes..."

    # Revert lockfiles
    cd "${PROJECT_ROOT}"
    git checkout -- '*/package-lock.json' 2>/dev/null || true
    git checkout -- '*/package.json' 2>/dev/null || true

    for ws_entry in "${workspaces[@]}"; do
      local ws_name="${ws_entry%%:*}"
      local ws_path="${ws_entry#*:}"
      if [ -f "${ws_path}/package-lock.json" ]; then
        bash -c "source ~/.nvm/nvm.sh && cd '${ws_path}' && npm ci --ignore-scripts" > /dev/null 2>&1 || true
      fi
    done

    log "Package changes reverted."
    write_report "reverted"
    exit 1
  fi

  # ── Success ───────────────────────────────────────────────────────

  log_section "SECURITY PATCH COMPLETE"
  if [ "$remaining_vulns" = true ]; then
    log "Patches applied with some remaining vulnerabilities."
    log "Review the report and consider --breaking for major updates."
  else
    log "All patches applied successfully. No remaining vulnerabilities."
  fi

  write_report "patched"
  exit 0
}

main

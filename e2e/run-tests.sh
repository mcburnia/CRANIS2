#!/bin/bash
# Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
# SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
#
# This file is part of CRANIS2 — a personally-owned, personally-funded
# software product. Unauthorised copying, modification, distribution,
# or commercial use is prohibited. For licence enquiries:
# andi.mcburnie@gmail.com

# Run E2E tests in groups with incremental feedback.
# Usage: ./run-tests.sh [group]
#   No args    — run all groups sequentially
#   smoke      — smoke tests only
#   acceptance — acceptance tests only
#   break      — break tests only
#   <file>     — single spec file (e.g. smoke/login-and-dashboard.spec.ts)

set -euo pipefail

BASE_URL="${E2E_BASE_URL:-http://localhost:3002}"
export E2E_BASE_URL="$BASE_URL"
cd "$(dirname "$0")"

PASS=0
FAIL=0
SKIP=0
FAILED_GROUPS=()

run_group() {
  local group="$1"
  local label="$2"
  echo ""
  echo "============================================"
  echo "  $label"
  echo "============================================"
  echo ""

  if npx playwright test --project="$group" --reporter=list 2>&1; then
    echo ""
    echo "  ✅ $label — PASSED"
    PASS=$((PASS + 1))
  else
    echo ""
    echo "  ❌ $label — FAILED"
    FAIL=$((FAIL + 1))
    FAILED_GROUPS+=("$label")
  fi
  echo ""
}

run_file() {
  local file="$1"
  echo ""
  echo "============================================"
  echo "  Running: $file"
  echo "============================================"
  echo ""
  npx playwright test "$file" --reporter=list 2>&1
}

print_summary() {
  echo ""
  echo "============================================"
  echo "  E2E TEST SUMMARY"
  echo "============================================"
  echo "  Groups passed:  $PASS"
  echo "  Groups failed:  $FAIL"
  if [ ${#FAILED_GROUPS[@]} -gt 0 ]; then
    echo "  Failed groups:  ${FAILED_GROUPS[*]}"
  fi
  echo "============================================"
  echo ""

  if [ "$FAIL" -gt 0 ]; then
    exit 1
  fi
}

# If a specific file is given, run just that
if [ "${1:-}" != "" ] && [[ "$1" == *.spec.ts ]]; then
  run_file "$1"
  exit $?
fi

GROUP="${1:-all}"

case "$GROUP" in
  smoke)
    run_group "smoke" "SMOKE TESTS"
    print_summary
    ;;
  acceptance)
    run_group "acceptance" "ACCEPTANCE TESTS"
    print_summary
    ;;
  break)
    run_group "break" "BREAK TESTS"
    print_summary
    ;;
  all)
    # Auth setup runs automatically as a dependency
    run_group "smoke" "SMOKE TESTS (4 specs)"
    run_group "acceptance" "ACCEPTANCE TESTS (13 specs)"
    run_group "break" "BREAK TESTS (7 specs)"
    print_summary
    ;;
  *)
    echo "Unknown group: $GROUP"
    echo "Usage: ./run-tests.sh [smoke|acceptance|break|all|<file.spec.ts>]"
    exit 1
    ;;
esac

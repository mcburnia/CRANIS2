#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# CRANIS2 Test Stack Manager
#
# Manages the isolated test infrastructure (neo4j_test + backend_test).
# These containers use separate databases from the live stack.
#
# Usage:
#   ./scripts/test-stack.sh start   — Start test stack
#   ./scripts/test-stack.sh stop    — Stop test stack
#   ./scripts/test-stack.sh status  — Show test stack status
#   ./scripts/test-stack.sh run     — Start + run full test suite + stop
# ──────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_DIR="/home/mcburnia/cranis2"
cd "${PROJECT_DIR}"

# ── Node.js via nvm ──
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

start_stack() {
  echo "Starting isolated test stack..."
  docker compose --profile test up -d neo4j_test backend_test

  echo "Waiting for test backend health (http://localhost:3011)..."
  for i in $(seq 1 60); do
    if curl -sf http://localhost:3011/api/health > /dev/null 2>&1; then
      echo "Test stack ready."
      return 0
    fi
    sleep 1
  done
  echo "ERROR: Test backend did not become healthy within 60 seconds."
  docker compose --profile test logs backend_test --tail=30
  return 1
}

stop_stack() {
  echo "Stopping test stack..."
  docker compose --profile test stop neo4j_test backend_test
  echo "Test stack stopped."
}

show_status() {
  echo "=== Test Stack Status ==="
  docker compose --profile test ps neo4j_test backend_test 2>/dev/null || echo "(not running)"
}

run_tests() {
  start_stack
  echo ""
  echo "Running full test suite against isolated test backend..."
  echo ""

  cd "${PROJECT_DIR}/backend/tests"
  TEST_EXIT=0
  TEST_BASE_URL=http://localhost:3011 npx vitest run --config vitest.config.ts || TEST_EXIT=$?

  cd "${PROJECT_DIR}"
  stop_stack

  exit ${TEST_EXIT}
}

case "${1:-help}" in
  start)  start_stack ;;
  stop)   stop_stack ;;
  status) show_status ;;
  run)    run_tests ;;
  *)
    echo "Usage: $0 {start|stop|status|run}"
    echo ""
    echo "  start   Start the isolated test stack (neo4j_test + backend_test)"
    echo "  stop    Stop the test stack"
    echo "  status  Show test stack container status"
    echo "  run     Start stack, run full test suite, stop stack"
    exit 1
    ;;
esac

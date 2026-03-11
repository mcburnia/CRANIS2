#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# CRANIS2 Nightly Test Runner
#
# Starts the isolated test stack (neo4j_test + backend_test on
# port 3011), runs the full backend test suite, then stops the
# test stack to free memory.
#
# Tests NEVER touch the live backend (port 3001) or live databases.
#
# Logs to ~/cranis2/logs/nightly-tests-YYYY-MM-DD.log
# Retains the last 14 days of logs.
#
# Cron: 0 20 * * * /home/mcburnia/cranis2/scripts/nightly-tests.sh
#        (20:00 UTC = 22:00 CEST)
# ──────────────────────────────────────────────────────────────
set -euo pipefail

# ── Paths ──
PROJECT_DIR="/home/mcburnia/cranis2"
LOG_DIR="${PROJECT_DIR}/logs"
DATE=$(date '+%Y-%m-%d')
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S %Z')
LOG_FILE="${LOG_DIR}/nightly-tests-${DATE}.log"
TEST_BACKEND="http://localhost:3011"

# ── Trello notification config (loaded from .env.nightly) ──
NIGHTLY_ENV="${PROJECT_DIR}/scripts/.env.nightly"
if [ -f "${NIGHTLY_ENV}" ]; then
  # shellcheck source=/dev/null
  . "${NIGHTLY_ENV}"
fi

# ── Node.js via nvm ──
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# ── Ensure log directory exists ──
mkdir -p "${LOG_DIR}"

# ── Header ──
{
  echo "═══════════════════════════════════════════════════════════"
  echo " CRANIS2 Nightly Test Run (ISOLATED TEST STACK)"
  echo " Started: ${TIMESTAMP}"
  echo " Target:  ${TEST_BACKEND}"
  echo "═══════════════════════════════════════════════════════════"
  echo ""
} > "${LOG_FILE}"

# ── Start isolated test stack ──
echo "Starting isolated test stack..." >> "${LOG_FILE}"
cd "${PROJECT_DIR}"
docker compose --profile test up -d neo4j_test backend_test >> "${LOG_FILE}" 2>&1

# ── Wait for test backend health ──
echo "Waiting for test backend health check..." >> "${LOG_FILE}"
HEALTHY=false
for i in $(seq 1 90); do
  if curl -sf "${TEST_BACKEND}/api/health" > /dev/null 2>&1; then
    HEALTHY=true
    break
  fi
  sleep 1
done

if [ "${HEALTHY}" = false ]; then
  {
    echo "ABORT: Test backend did not become healthy within 90 seconds"
    echo "       Target: ${TEST_BACKEND}/api/health"
    echo ""
    echo "Recent backend_test logs:"
    docker compose --profile test logs backend_test --tail=30 2>&1
    echo ""
    echo "Finished: $(date '+%Y-%m-%d %H:%M:%S %Z')"
  } >> "${LOG_FILE}"
  # Stop test stack before exiting
  docker compose --profile test stop neo4j_test backend_test >> "${LOG_FILE}" 2>&1 || true
  echo "CRANIS2 nightly tests ABORTED — test backend not healthy. See ${LOG_FILE}"
  exit 1
fi

echo "Pre-flight: test backend health OK" >> "${LOG_FILE}"
echo "" >> "${LOG_FILE}"

# ── Run test suite against isolated test backend ──
cd "${PROJECT_DIR}/backend/tests"

TEST_EXIT=0
TEST_BASE_URL="${TEST_BACKEND}" npx vitest run \
  --config vitest.config.ts \
  --reporter=verbose \
  >> "${LOG_FILE}" 2>&1 || TEST_EXIT=$?

echo "" >> "${LOG_FILE}"

# ── Stop test stack to free memory ──
cd "${PROJECT_DIR}"
echo "Stopping test stack..." >> "${LOG_FILE}"
docker compose --profile test stop neo4j_test backend_test >> "${LOG_FILE}" 2>&1 || true

# ── Parse results from vitest output ──
FILES_LINE=$(grep -E '^\s*Test Files' "${LOG_FILE}" | tail -1 || true)
TESTS_LINE=$(grep -E '^\s+Tests\s' "${LOG_FILE}" | tail -1 || true)

if [ -n "${TESTS_LINE}" ]; then
  PASSED=$(echo "${TESTS_LINE}" | grep -oP '\d+(?= passed)' || echo "?")
  FAILED=$(echo "${TESTS_LINE}" | grep -oP '\d+(?= failed)' || echo "0")
  TOTAL=$(echo "${TESTS_LINE}" | grep -oP '(?<=\()\d+' || echo "?")
  FILES_PASSED=$(echo "${FILES_LINE}" | grep -oP '\d+(?= passed)' || echo "?")
  FILES_FAILED=$(echo "${FILES_LINE}" | grep -oP '\d+(?= failed)' || echo "0")
  FILES_TOTAL=$(echo "${FILES_LINE}" | grep -oP '(?<=\()\d+' || echo "?")
else
  PASSED="?"; FAILED="?"; TOTAL="?"
  FILES_PASSED="?"; FILES_FAILED="?"; FILES_TOTAL="?"
fi

# ── Summary ──
{
  echo "═══════════════════════════════════════════════════════════"
  echo " SUMMARY"
  echo "═══════════════════════════════════════════════════════════"
  echo ""
  echo " Test files:  ${FILES_PASSED} passed / ${FILES_FAILED} failed / ${FILES_TOTAL} total"
  echo " Tests:       ${PASSED} passed / ${FAILED} failed / ${TOTAL} total"
  echo " Exit code:   ${TEST_EXIT}"
  echo " Finished:    $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo ""
  if [ "${TEST_EXIT}" -eq 0 ]; then
    echo " Result: ✅ ALL TESTS PASSED"
  else
    echo " Result: ❌ ${FAILED} TEST(S) FAILED"
    echo ""
    echo " Failed tests:"
    grep -E '^\s*×|FAIL\s' "${LOG_FILE}" | head -20 | sed 's/^/   /' || echo "   (see full log for details)"
  fi
  echo ""
  echo "═══════════════════════════════════════════════════════════"
} >> "${LOG_FILE}"

# ── Trello notification ──
if [ "${TEST_EXIT}" -eq 0 ]; then
  TRELLO_LIST="${TRELLO_PASSED_LIST}"
  CARD_NAME="✅ ${DATE} — ALL TESTS PASSED (${PASSED}/${TOTAL})"
else
  TRELLO_LIST="${TRELLO_FAILED_LIST}"
  CARD_NAME="❌ ${DATE} — ${FAILED} FAILED (${PASSED} passed / ${TOTAL} total)"
fi

CARD_DESC="**CRANIS2 Nightly Test Run — ${DATE}**

Test files: ${FILES_PASSED} passed / ${FILES_FAILED} failed / ${FILES_TOTAL} total
Tests: ${PASSED} passed / ${FAILED} failed / ${TOTAL} total
Exit code: ${TEST_EXIT}
Started: ${TIMESTAMP}
Finished: $(date '+%Y-%m-%d %H:%M:%S %Z')
Stack: isolated (backend_test:3011, neo4j_test)"

if [ "${TEST_EXIT}" -ne 0 ]; then
  FAIL_LIST=$(grep -E '^\s*×|FAIL\s' "${LOG_FILE}" | head -20 | sed 's/^/- /' || echo "- (see log for details)")
  CARD_DESC="${CARD_DESC}

**Failed tests:**
${FAIL_LIST}"
fi

curl -s -X POST "https://api.trello.com/1/cards" \
  --data-urlencode "key=${TRELLO_KEY}" \
  --data-urlencode "token=${TRELLO_TOKEN}" \
  --data-urlencode "idList=${TRELLO_LIST}" \
  --data-urlencode "name=${CARD_NAME}" \
  --data-urlencode "desc=${CARD_DESC}" \
  --data-urlencode "pos=top" \
  > /dev/null 2>&1 || echo "WARNING: Failed to post Trello notification" >> "${LOG_FILE}"

# ── Cleanup old logs (keep 14 days) ──
find "${LOG_DIR}" -name 'nightly-tests-*.log' -mtime +14 -delete 2>/dev/null || true

# ── Print summary to stdout (visible in cron mail) ──
tail -20 "${LOG_FILE}"

exit ${TEST_EXIT}

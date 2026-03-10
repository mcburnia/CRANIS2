#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# CRANIS2 Nightly Test Runner
#
# Runs the full backend test suite against localhost:3001.
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

# ── Node.js via nvm ──
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# ── Ensure log directory exists ──
mkdir -p "${LOG_DIR}"

# ── Header ──
{
  echo "═══════════════════════════════════════════════════════════"
  echo " CRANIS2 Nightly Test Run"
  echo " Started: ${TIMESTAMP}"
  echo " Target:  http://localhost:3001"
  echo "═══════════════════════════════════════════════════════════"
  echo ""
} > "${LOG_FILE}"

# ── Pre-flight: check backend is running ──
if ! curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
  {
    echo "ABORT: Backend is not responding on http://localhost:3001/api/health"
    echo "       Cannot run tests. Check Docker stack."
    echo ""
    echo "Finished: $(date '+%Y-%m-%d %H:%M:%S %Z')"
  } >> "${LOG_FILE}"
  echo "CRANIS2 nightly tests ABORTED — backend not running. See ${LOG_FILE}"
  exit 1
fi

echo "Pre-flight: backend health OK" >> "${LOG_FILE}"
echo "" >> "${LOG_FILE}"

# ── Run test suite ──
cd "${PROJECT_DIR}/backend/tests"

TEST_EXIT=0
TEST_BASE_URL=http://localhost:3001 npx vitest run \
  --config vitest.config.ts \
  --reporter=verbose \
  >> "${LOG_FILE}" 2>&1 || TEST_EXIT=$?

echo "" >> "${LOG_FILE}"

# ── Parse results from vitest output (more reliable than JSON reporter) ──
# Vitest prints lines like: " Test Files  67 passed (67)" and "      Tests  1147 passed (1147)"
FILES_LINE=$(grep -E '^\s*Test Files' "${LOG_FILE}" | tail -1 || true)
TESTS_LINE=$(grep -E '^\s+Tests\s' "${LOG_FILE}" | tail -1 || true)

if [ -n "${TESTS_LINE}" ]; then
  # Extract "X passed" and optional "Y failed" from the lines
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

# ── Cleanup old logs (keep 14 days) ──
find "${LOG_DIR}" -name 'nightly-tests-*.log' -mtime +14 -delete 2>/dev/null || true

# ── Print summary to stdout (visible in cron mail) ──
tail -20 "${LOG_FILE}"

exit ${TEST_EXIT}

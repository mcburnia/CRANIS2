#!/usr/bin/env bash
# Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
# SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
#
# This file is part of CRANIS2 — a personally-owned, personally-funded
# software product. Unauthorised copying, modification, distribution,
# or commercial use is prohibited. For licence enquiries:
# andi@mcburnie.com

# ─────────────────────────────────────────────────────────────────────────────
# CRANIS2 CI/CD Compliance Gate
#
# Checks your product's CRA compliance status and fails the pipeline
# if unresolved compliance gaps exceed the configured threshold.
#
# Required environment variables:
#   CRANIS2_API_KEY      — Your API key (from Settings > Integrations)
#   CRANIS2_PRODUCT_ID   — The product UUID to check
#
# Optional environment variables:
#   CRANIS2_URL          — Base URL (default: https://dev.cranis2.dev)
#   CRANIS2_THRESHOLD    — Minimum gap severity that blocks the gate:
#                          "critical" — only block on critical gaps
#                          "high"     — block on critical + high (default)
#                          "medium"   — block on critical + high + medium
#                          "any"      — block on any gap
#
# Exit codes:
#   0 — Compliance gate passed
#   1 — Compliance gate failed (gaps found above threshold)
#   2 — Configuration error (missing env vars, invalid response)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Configuration ──
API_KEY="${CRANIS2_API_KEY:-}"
PRODUCT_ID="${CRANIS2_PRODUCT_ID:-}"
BASE_URL="${CRANIS2_URL:-https://dev.cranis2.dev}"
THRESHOLD="${CRANIS2_THRESHOLD:-high}"

# ── Validation ──
if [ -z "$API_KEY" ]; then
  echo "ERROR: CRANIS2_API_KEY is not set"
  echo "Generate an API key at ${BASE_URL}/settings/integrations"
  exit 2
fi

if [ -z "$PRODUCT_ID" ]; then
  echo "ERROR: CRANIS2_PRODUCT_ID is not set"
  echo "Find your product ID in the CRANIS2 dashboard URL"
  exit 2
fi

# ── Call the API ──
echo "CRANIS2 Compliance Gate"
echo "======================="
echo "Product:   ${PRODUCT_ID}"
echo "Threshold: ${THRESHOLD}"
echo "Server:    ${BASE_URL}"
echo ""

RESPONSE=$(curl -sf \
  -H "X-API-Key: ${API_KEY}" \
  "${BASE_URL}/api/v1/products/${PRODUCT_ID}/compliance-status?threshold=${THRESHOLD}" \
  2>&1) || {
  echo "ERROR: Failed to reach CRANIS2 API"
  echo "Response: ${RESPONSE}"
  exit 2
}

# ── Parse response ──
PASS=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(str(d.get('pass','')).lower())" 2>/dev/null) || {
  # Fallback: try with jq
  PASS=$(echo "$RESPONSE" | jq -r '.pass' 2>/dev/null) || {
    echo "ERROR: Could not parse API response (install python3 or jq)"
    exit 2
  }
}

PRODUCT_NAME=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('productName',''))" 2>/dev/null || echo "")
TOTAL=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['summary']['total'])" 2>/dev/null || echo "?")
CRITICAL=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['summary']['critical'])" 2>/dev/null || echo "?")
HIGH=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['summary']['high'])" 2>/dev/null || echo "?")
MEDIUM=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['summary']['medium'])" 2>/dev/null || echo "?")
LOW=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['summary']['low'])" 2>/dev/null || echo "?")
OB_MET=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['progress']['obligationsMet'])" 2>/dev/null || echo "?")
OB_TOTAL=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['progress']['obligationsTotal'])" 2>/dev/null || echo "?")

# ── Display results ──
if [ -n "$PRODUCT_NAME" ]; then
  echo "Product: ${PRODUCT_NAME}"
fi
echo ""
echo "Compliance Gaps:"
echo "  Critical: ${CRITICAL}"
echo "  High:     ${HIGH}"
echo "  Medium:   ${MEDIUM}"
echo "  Low:      ${LOW}"
echo "  Total:    ${TOTAL}"
echo ""
echo "Obligations: ${OB_MET}/${OB_TOTAL} met"
echo ""

# ── Gate decision ──
if [ "$PASS" = "true" ]; then
  echo "RESULT: PASS"
  echo "No compliance gaps above '${THRESHOLD}' threshold."
  exit 0
else
  echo "RESULT: FAIL"
  echo "Compliance gaps found above '${THRESHOLD}' threshold."
  echo ""
  echo "Fix these issues in CRANIS2: ${BASE_URL}/products/${PRODUCT_ID}"
  exit 1
fi

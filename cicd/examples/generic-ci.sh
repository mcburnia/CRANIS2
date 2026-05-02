#!/usr/bin/env bash
# Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
# SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
#
# This file is part of CRANIS2 — a personally-owned, personally-funded
# software product. Unauthorised copying, modification, distribution,
# or commercial use is prohibited. For licence enquiries:
# andi.mcburnie@gmail.com

# CRANIS2 CRA Compliance Gate — Generic CI
#
# Works with any CI/CD system (Jenkins, CircleCI, Bitbucket Pipelines, etc.)
# Simply download and run this script, or copy the cranis2-gate.sh from the
# cicd/ directory in the CRANIS2 repository.
#
# Required environment variables:
#   CRANIS2_API_KEY      — Your API key (Settings > Integrations)
#   CRANIS2_PRODUCT_ID   — The product UUID to check
#
# Optional environment variables:
#   CRANIS2_URL          — Base URL (default: https://dev.cranis2.dev)
#   CRANIS2_THRESHOLD    — "critical", "high" (default), "medium", or "any"
#
# Usage:
#   export CRANIS2_API_KEY="cranis2_..."
#   export CRANIS2_PRODUCT_ID="your-product-uuid"
#   curl -sf https://dev.cranis2.dev/cicd/cranis2-gate.sh | bash
#
#   Or download first:
#   curl -sfO https://dev.cranis2.dev/cicd/cranis2-gate.sh
#   chmod +x cranis2-gate.sh
#   ./cranis2-gate.sh

set -euo pipefail

API_KEY="${CRANIS2_API_KEY:-}"
PRODUCT_ID="${CRANIS2_PRODUCT_ID:-}"
BASE_URL="${CRANIS2_URL:-https://dev.cranis2.dev}"
THRESHOLD="${CRANIS2_THRESHOLD:-high}"

if [ -z "$API_KEY" ]; then
  echo "ERROR: CRANIS2_API_KEY is not set"
  exit 2
fi

if [ -z "$PRODUCT_ID" ]; then
  echo "ERROR: CRANIS2_PRODUCT_ID is not set"
  exit 2
fi

RESPONSE=$(curl -sf \
  -H "X-API-Key: ${API_KEY}" \
  "${BASE_URL}/api/v1/products/${PRODUCT_ID}/compliance-status?threshold=${THRESHOLD}" \
  2>&1) || {
  echo "ERROR: Failed to reach CRANIS2 API at ${BASE_URL}"
  exit 2
}

# Parse with python3 (most CI images have it)
PASS=$(echo "$RESPONSE" | python3 -c "import sys,json; print(str(json.load(sys.stdin)['pass']).lower())" 2>/dev/null) || {
  PASS=$(echo "$RESPONSE" | jq -r '.pass' 2>/dev/null) || {
    echo "ERROR: Could not parse API response (install python3 or jq)"
    exit 2
  }
}

TOTAL=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['summary']['total'])" 2>/dev/null || echo "?")

echo "CRANIS2 CRA Compliance Gate"
echo "  Threshold: ${THRESHOLD}"
echo "  Total gaps: ${TOTAL}"

if [ "$PASS" = "true" ]; then
  echo "  Result: PASS"
  exit 0
else
  echo "  Result: FAIL"
  echo "  Fix issues at: ${BASE_URL}/products/${PRODUCT_ID}"
  exit 1
fi

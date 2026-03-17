#!/bin/bash
#
# CRANIS2 Session Capture — captures Claude Code conversation to evidence repo
#
# This script is called by Claude Code hooks at the end of each session.
# It commits the conversation transcript to a separate evidence repository
# for R&D evidence, IP preservation, and session continuity.
#
# Setup:
#   1. Clone or create your evidence repo
#   2. Set CRANIS2_EVIDENCE_REPO to the path
#   3. Configure .claude/hooks.json (see setup-hooks.sh)
#
# Environment variables:
#   CRANIS2_EVIDENCE_REPO  — path to the evidence git repository
#   CRANIS2_PROJECT_NAME   — project name (default: directory name)
#   CRANIS2_CONTRIBUTOR    — your name (default: git user.name)

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────

EVIDENCE_REPO="${CRANIS2_EVIDENCE_REPO:-}"
PROJECT_NAME="${CRANIS2_PROJECT_NAME:-$(basename "$(pwd)")}"
CONTRIBUTOR="${CRANIS2_CONTRIBUTOR:-$(git config user.name 2>/dev/null || echo 'Unknown')}"
DATE=$(date '+%Y-%m-%d')
TIME=$(date '+%H:%M:%S')
SESSION_FILE="sessions/${PROJECT_NAME}/${DATE}-$(date '+%H%M%S').md"

if [ -z "$EVIDENCE_REPO" ]; then
  echo "[session-capture] CRANIS2_EVIDENCE_REPO not set. Skipping capture."
  exit 0
fi

if [ ! -d "$EVIDENCE_REPO/.git" ]; then
  echo "[session-capture] Evidence repo not found at $EVIDENCE_REPO. Skipping capture."
  exit 0
fi

# ── Read conversation from stdin (piped by the hook) ─────────────────

CONVERSATION=$(cat)

if [ -z "$CONVERSATION" ]; then
  echo "[session-capture] No conversation content received. Skipping."
  exit 0
fi

# ── Write the session file ───────────────────────────────────────────

mkdir -p "$EVIDENCE_REPO/sessions/${PROJECT_NAME}"

cat > "$EVIDENCE_REPO/$SESSION_FILE" << HEADER
---
project: ${PROJECT_NAME}
contributor: ${CONTRIBUTOR}
date: ${DATE}
time: ${TIME}
tool: Claude Code
type: development_session
---

# Development Session — ${DATE} ${TIME}

**Project:** ${PROJECT_NAME}
**Contributor:** ${CONTRIBUTOR}
**Date:** ${DATE} ${TIME}

---

HEADER

echo "$CONVERSATION" >> "$EVIDENCE_REPO/$SESSION_FILE"

# ── Commit to evidence repo ──────────────────────────────────────────

cd "$EVIDENCE_REPO"
git add "$SESSION_FILE"
git commit -m "session: ${PROJECT_NAME} ${DATE} ${TIME} — ${CONTRIBUTOR}" --quiet 2>/dev/null || true

echo "[session-capture] Session saved to ${SESSION_FILE}"

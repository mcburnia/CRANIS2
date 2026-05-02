#!/bin/bash
# Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
# SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
#
# This file is part of CRANIS2 — a personally-owned, personally-funded
# software product. Unauthorised copying, modification, distribution,
# or commercial use is prohibited. For licence enquiries:
# andi@mcburnie.com

#
# CRANIS2 Session Capture — captures Claude Code conversation to evidence repo
#
# Called by the SessionEnd hook in .claude/hooks.json.
# Claude Code pipes JSON metadata to stdin containing transcript_path.
# This script reads the transcript JSONL file, converts it to Markdown,
# and commits it to the evidence repository.
#
# Environment variables (sourced from .claude/.env):
#   CRANIS2_EVIDENCE_REPO  — path to the evidence git repository
#   CRANIS2_PROJECT_NAME   — project name (default: directory name)
#   CRANIS2_CONTRIBUTOR    — your name (default: git user.name)

set -euo pipefail

# ── Source environment from .claude/.env ─────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$PROJECT_DIR/.claude/.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

EVIDENCE_REPO="${CRANIS2_EVIDENCE_REPO:-}"
PROJECT_NAME="${CRANIS2_PROJECT_NAME:-$(basename "$PROJECT_DIR")}"
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

# ── Read JSON metadata from stdin ────────────────────────────────────

INPUT=$(cat)

if [ -z "$INPUT" ]; then
  echo "[session-capture] No input received from hook. Skipping."
  exit 0
fi

# Extract transcript path from the JSON payload
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty' 2>/dev/null || true)
SESSION_ID="${PROJECT_NAME}-${DATE}-$(date '+%H%M%S')"

if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
  echo "[session-capture] Transcript file not found: $TRANSCRIPT_PATH. Skipping."
  exit 0
fi

# ── Convert JSONL transcript to Markdown ─────────────────────────────

mkdir -p "$EVIDENCE_REPO/sessions/${PROJECT_NAME}"

# Write frontmatter
cat > "$EVIDENCE_REPO/$SESSION_FILE" << HEADER
---
project: ${PROJECT_NAME}
contributor: ${CONTRIBUTOR}
date: ${DATE}
time: ${TIME}
session_id: ${SESSION_ID}
tool: Claude Code
type: development_session
---

# Development Session — ${DATE} ${TIME}

**Project:** ${PROJECT_NAME}
**Contributor:** ${CONTRIBUTOR}
**Date:** ${DATE} ${TIME}
**Session ID:** ${SESSION_ID}

---

HEADER

# Parse the JSONL transcript file.
# Each line is a JSON object. We extract role and content from conversation messages.
while IFS= read -r line; do
  # Skip empty lines
  [ -z "$line" ] && continue

  TYPE=$(echo "$line" | jq -r '.type // empty' 2>/dev/null || true)

  # Handle different message types in the JSONL transcript
  case "$TYPE" in
    "user")
      echo "" >> "$EVIDENCE_REPO/$SESSION_FILE"
      echo "## Human" >> "$EVIDENCE_REPO/$SESSION_FILE"
      echo "" >> "$EVIDENCE_REPO/$SESSION_FILE"
      # Extract text content — may be a string or array of content blocks
      CONTENT=$(echo "$line" | jq -r '
        if .message.content | type == "string" then
          .message.content
        elif .message.content | type == "array" then
          [.message.content[] | select(.type == "text") | .text] | join("\n")
        else
          empty
        end' 2>/dev/null || true)
      if [ -n "$CONTENT" ]; then
        echo "$CONTENT" >> "$EVIDENCE_REPO/$SESSION_FILE"
      fi
      ;;
    "assistant")
      echo "" >> "$EVIDENCE_REPO/$SESSION_FILE"
      echo "## Assistant" >> "$EVIDENCE_REPO/$SESSION_FILE"
      echo "" >> "$EVIDENCE_REPO/$SESSION_FILE"
      CONTENT=$(echo "$line" | jq -r '
        if .message.content | type == "string" then
          .message.content
        elif .message.content | type == "array" then
          [.message.content[] | select(.type == "text") | .text] | join("\n")
        else
          empty
        end' 2>/dev/null || true)
      if [ -n "$CONTENT" ]; then
        echo "$CONTENT" >> "$EVIDENCE_REPO/$SESSION_FILE"
      fi
      # Note tool uses if present
      TOOLS=$(echo "$line" | jq -r '
        [.message.content[]? | select(.type == "tool_use") | .name] | join(", ")' 2>/dev/null || true)
      if [ -n "$TOOLS" ]; then
        echo "" >> "$EVIDENCE_REPO/$SESSION_FILE"
        echo "*Tools used: ${TOOLS}*" >> "$EVIDENCE_REPO/$SESSION_FILE"
      fi
      ;;
  esac
done < "$TRANSCRIPT_PATH"

# ── Commit to evidence repo ──────────────────────────────────────────

cd "$EVIDENCE_REPO"
git add "$SESSION_FILE"
git commit -m "session: ${PROJECT_NAME} ${DATE} ${TIME} — ${CONTRIBUTOR}" --quiet 2>/dev/null || true

echo "[session-capture] Session saved to ${SESSION_FILE}"

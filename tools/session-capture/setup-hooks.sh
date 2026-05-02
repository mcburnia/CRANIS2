#!/bin/bash
# Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
# SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
#
# This file is part of CRANIS2 — a personally-owned, personally-funded
# software product. Unauthorised copying, modification, distribution,
# or commercial use is prohibited. For licence enquiries:
# andi@mcburnie.com

#
# CRANIS2 Session Capture — setup script
#
# Configures Claude Code hooks to automatically capture development
# sessions to your evidence repository.
#
# Usage:
#   ./tools/session-capture/setup-hooks.sh /path/to/evidence-repo
#
# This will:
#   1. Verify the evidence repo exists
#   2. Create the hooks configuration in .claude/hooks.json
#   3. Set up the environment variable in .claude/.env

set -euo pipefail

EVIDENCE_REPO="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROJECT_NAME="$(basename "$PROJECT_DIR")"

echo "CRANIS2 Session Capture — Setup"
echo "================================"
echo ""

if [ -z "$EVIDENCE_REPO" ]; then
  echo "Usage: $0 /path/to/evidence-repo"
  echo ""
  echo "The evidence repo is a separate git repository where development"
  echo "session transcripts are stored. It should NOT be your main project repo."
  echo ""
  echo "To create one:"
  echo "  mkdir ~/cranis2-evidence && cd ~/cranis2-evidence && git init"
  echo "  # Or clone from Forgejo: git clone https://your-forgejo/org/evidence.git"
  echo ""
  exit 1
fi

# Resolve to absolute path
EVIDENCE_REPO="$(cd "$EVIDENCE_REPO" && pwd)"

if [ ! -d "$EVIDENCE_REPO/.git" ]; then
  echo "Error: $EVIDENCE_REPO is not a git repository."
  echo "Initialise it with: cd $EVIDENCE_REPO && git init"
  exit 1
fi

echo "Project:       $PROJECT_NAME"
echo "Project dir:   $PROJECT_DIR"
echo "Evidence repo: $EVIDENCE_REPO"
echo "Capture script: $SCRIPT_DIR/capture-session.sh"
echo ""

# ── Create .claude directory if needed ───────────────────────────────

mkdir -p "$PROJECT_DIR/.claude"

# ── Write hooks.json ─────────────────────────────────────────────────

HOOKS_FILE="$PROJECT_DIR/.claude/hooks.json"

if [ -f "$HOOKS_FILE" ]; then
  echo "Warning: $HOOKS_FILE already exists."
  echo "Please manually add the SessionEnd hook to your existing config."
  echo ""
  echo "Add this to your hooks.json:"
  echo '  "SessionEnd": ['
  echo '    {'
  echo '      "type": "command",'
  echo "      \"command\": \"$SCRIPT_DIR/capture-session.sh\","
  echo '      "timeout": 10000'
  echo '    }'
  echo '  ]'
  echo ""
else
  cat > "$HOOKS_FILE" << EOF
{
  "hooks": {
    "SessionEnd": [
      {
        "type": "command",
        "command": "$SCRIPT_DIR/capture-session.sh",
        "timeout": 10000
      }
    ]
  }
}
EOF
  echo "Created: $HOOKS_FILE"
fi

# ── Write environment config ─────────────────────────────────────────

ENV_FILE="$PROJECT_DIR/.claude/.env"

if [ -f "$ENV_FILE" ]; then
  if grep -q "CRANIS2_EVIDENCE_REPO" "$ENV_FILE"; then
    echo "CRANIS2_EVIDENCE_REPO already set in $ENV_FILE"
  else
    echo "" >> "$ENV_FILE"
    echo "CRANIS2_EVIDENCE_REPO=$EVIDENCE_REPO" >> "$ENV_FILE"
    echo "Updated: $ENV_FILE"
  fi
else
  cat > "$ENV_FILE" << EOF
CRANIS2_EVIDENCE_REPO=$EVIDENCE_REPO
CRANIS2_PROJECT_NAME=$PROJECT_NAME
EOF
  echo "Created: $ENV_FILE"
fi

# ── Make capture script executable ───────────────────────────────────

chmod +x "$SCRIPT_DIR/capture-session.sh"

echo ""
echo "Setup complete."
echo ""
echo "How it works:"
echo "  1. At the end of each Claude Code session, the hook fires"
echo "  2. The conversation transcript is saved to:"
echo "     $EVIDENCE_REPO/sessions/$PROJECT_NAME/<date>-<time>.md"
echo "  3. The file is committed to the evidence repo automatically"
echo ""
echo "To push evidence to a remote (Forgejo, GitHub, etc.):"
echo "  cd $EVIDENCE_REPO && git remote add origin <url> && git push"
echo ""
echo "To verify the setup, start a new Claude Code session and check"
echo "the evidence repo after the session ends."

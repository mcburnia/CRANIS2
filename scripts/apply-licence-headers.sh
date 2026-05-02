#!/usr/bin/env bash
# Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
# SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
#
# This file is part of CRANIS2 — a personally-owned, personally-funded
# software product. Unauthorised copying, modification, distribution,
# or commercial use is prohibited. For licence enquiries:
# andi@mcburnie.com

# Idempotent sweep that adds the CRANIS2 proprietary licence header to every
# in-scope project file. Skips imported libraries, generated artefacts, data,
# logs, lock files, and anything that already carries the SPDX marker.
#
# Usage:
#   scripts/apply-licence-headers.sh --dry-run    # show counts and 3 sample edits
#   scripts/apply-licence-headers.sh               # apply for real
#
# Re-running is safe: existing headers are detected and never duplicated.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

MARKER='SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary'

read -r -d '' BODY <<'EOF' || true
Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

This file is part of CRANIS2 — a personally-owned, personally-funded
software product. Unauthorised copying, modification, distribution,
or commercial use is prohibited. For licence enquiries:
andi@mcburnie.com
EOF

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then DRY_RUN=1; fi

# ─── Header generators per comment style ────────────────────────────────────
header_block_c() {           # /* ... */ — TS, JS, CSS, etc.
  printf '/*\n'
  while IFS= read -r line; do
    if [ -z "$line" ]; then printf ' *\n'; else printf ' * %s\n' "$line"; fi
  done <<<"$BODY"
  printf ' */\n\n'
}

header_hash() {              # # ... — sh, py, sql (when sql uses --), yaml, dockerfile
  while IFS= read -r line; do
    if [ -z "$line" ]; then printf '#\n'; else printf '# %s\n' "$line"; fi
  done <<<"$BODY"
  printf '\n'
}

header_sql() {               # -- ... — sql files
  while IFS= read -r line; do
    if [ -z "$line" ]; then printf '%s\n' '--'; else printf '%s\n' "-- $line"; fi
  done <<<"$BODY"
  printf '\n'
}

header_html() {              # <!-- ... --> — html, md
  printf '%s\n' '<!--'
  while IFS= read -r line; do
    if [ -z "$line" ]; then printf '\n'; else printf '  %s\n' "$line"; fi
  done <<<"$BODY"
  printf '%s\n\n' '-->'
}

# ─── Decide comment style for a given file path ─────────────────────────────
style_for() {
  local f="$1"
  local base
  base="$(basename "$f")"
  case "$base" in
    Dockerfile|Dockerfile.*) echo hash; return ;;
    .env|.env.*|.gitignore|.dockerignore|.gitattributes) echo hash; return ;;
  esac
  case "$f" in
    *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.css)        echo block_c ;;
    *.sh|*.bash|*.zsh|*.py|*.toml|*.ini|*.conf)     echo hash ;;
    *.yml|*.yaml)                                   echo hash ;;
    *.sql)                                          echo sql ;;
    *.html|*.htm)                                   echo html ;;
    *.md|*.markdown)                                echo html ;;
    *)                                              echo "" ;;
  esac
}

render_header() {
  case "$1" in
    block_c) header_block_c ;;
    hash)    header_hash ;;
    sql)     header_sql ;;
    html)    header_html ;;
    *)       return 1 ;;
  esac
}

# ─── Find candidate files ───────────────────────────────────────────────────
# Excludes:  third-party, generated, data, logs, lock files, .git
mapfile -t CANDIDATES < <(
  find . \
    \( \
      -path ./node_modules -o \
      -path './*/node_modules' -o \
      -path './*/*/node_modules' -o \
      -path ./.git -o \
      -path ./backups -o \
      -path ./data -o \
      -path ./logs -o \
      -path ./reports -o \
      -path ./dist -o \
      -path './*/dist' -o \
      -path './*/build' -o \
      -path './backend/dist' -o \
      -path './frontend/dist' -o \
      -path './frontend/.vite' -o \
      -path ./.cache -o \
      -path ./.claude \
    \) -prune -o \
    -type f \
    \( \
      -name '*.ts' -o -name '*.tsx' -o \
      -name '*.js' -o -name '*.jsx' -o -name '*.mjs' -o -name '*.cjs' -o \
      -name '*.css' -o \
      -name '*.sh' -o -name '*.bash' -o -name '*.py' -o \
      -name '*.sql' -o -name '*.yml' -o -name '*.yaml' -o \
      -name '*.toml' -o -name '*.ini' -o -name '*.conf' -o \
      -name '*.html' -o -name '*.htm' -o \
      -name '*.md' -o -name '*.markdown' -o \
      -name 'Dockerfile' -o -name 'Dockerfile.*' -o \
      -name '.gitignore' -o -name '.dockerignore' -o -name '.gitattributes' -o \
      -name '.env.example' -o -name '.env.sample' \
    \) \
    ! -name 'package-lock.json' ! -name '*.lock' ! -name '*.tsbuildinfo' ! -name '*.map' \
    -print
)

# ─── Stats counters ─────────────────────────────────────────────────────────
declare -A BY_EXT
ADDED=0; SKIPPED_HEADED=0; SKIPPED_NOSTYLE=0; SKIPPED_NOWRITE=0
SAMPLES=()

apply_header() {
  local f="$1" style="$2"
  local first tmp hdr_file
  hdr_file="$(mktemp)"
  tmp="$(mktemp)"

  # Render header to a file so its trailing newlines survive
  render_header "$style" > "$hdr_file"

  first="$(head -n 1 "$f" 2>/dev/null || true)"

  if [[ "$first" == "#!"* ]]; then
    # Preserve shebang on line 1, then header, then rest
    printf '%s\n' "$first" >>"$tmp"
    cat "$hdr_file" >>"$tmp"
    tail -n +2 "$f" >>"$tmp"
  elif [[ "$style" == "html" ]] && [[ "$first" =~ ^[[:space:]]*\<\!DOCTYPE ]]; then
    # Place header AFTER the DOCTYPE for HTML
    printf '%s\n' "$first" >>"$tmp"
    cat "$hdr_file" >>"$tmp"
    tail -n +2 "$f" >>"$tmp"
  else
    cat "$hdr_file" >>"$tmp"
    cat "$f" >>"$tmp"
  fi

  rm -f "$hdr_file"

  if [ "$DRY_RUN" -eq 1 ]; then
    if [ "${#SAMPLES[@]}" -lt 3 ]; then
      SAMPLES+=("$f")
    fi
    rm -f "$tmp"
  else
    # Preserve original permissions (mv from /tmp would otherwise reset to 0644)
    chmod --reference="$f" "$tmp"
    mv "$tmp" "$f"
  fi
}

for f in "${CANDIDATES[@]}"; do
  [ -f "$f" ] || continue
  [ -w "$f" ] || { SKIPPED_NOWRITE=$((SKIPPED_NOWRITE+1)); continue; }

  if grep -q -F "$MARKER" "$f"; then
    SKIPPED_HEADED=$((SKIPPED_HEADED+1))
    continue
  fi

  style="$(style_for "$f")"
  if [ -z "$style" ]; then
    SKIPPED_NOSTYLE=$((SKIPPED_NOSTYLE+1))
    continue
  fi

  ext="${f##*.}"
  case "$(basename "$f")" in
    Dockerfile|Dockerfile.*) ext='Dockerfile' ;;
    .gitignore) ext='gitignore' ;;
    .dockerignore) ext='dockerignore' ;;
    .gitattributes) ext='gitattributes' ;;
    .env.*) ext='env-example' ;;
  esac
  BY_EXT[$ext]=$((${BY_EXT[$ext]:-0}+1))

  apply_header "$f" "$style"
  ADDED=$((ADDED+1))
done

# ─── Report ─────────────────────────────────────────────────────────────────
mode_label="APPLIED"; [ "$DRY_RUN" -eq 1 ] && mode_label="WOULD APPLY"
echo
echo "── Licence header sweep — $mode_label ──"
echo "  Files processed:           $ADDED"
echo "  Already had header:        $SKIPPED_HEADED"
echo "  No matching comment style: $SKIPPED_NOSTYLE"
echo "  Not writable:              $SKIPPED_NOWRITE"
echo
echo "  By extension:"
for k in $(printf '%s\n' "${!BY_EXT[@]}" | sort); do
  printf '    %-15s %5d\n' "$k" "${BY_EXT[$k]}"
done

if [ "$DRY_RUN" -eq 1 ] && [ "${#SAMPLES[@]}" -gt 0 ]; then
  echo
  echo "── Sample edits (dry-run, no files changed) ──"
  for s in "${SAMPLES[@]}"; do
    echo
    echo "── $s ──"
    style="$(style_for "$s")"
    render_header "$style" | head -10
  done
fi

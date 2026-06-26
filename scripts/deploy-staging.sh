#!/usr/bin/env bash
#
# Pull-based auto-deploy for the STAGING environment (dev.cranis2.dev).
#
# The staging host sits behind 5G CGNAT (no public inbound), so deployment is
# PULL-based: the host reaches OUT to GitHub. This means staging can be deployed
# from anywhere simply by merging to `main` — no inbound access to the box is
# required. Run on a timer (deploy/cranis2-staging-deploy.timer) or manually.
#
# Idempotent and safe to run repeatedly: it only acts when origin/main advances,
# refuses to run over a dirty tree, and single-flights via a lock.
#
# It rebuilds the app services only (backend, welcome). Databases (postgres,
# neo4j, forgejo) and nginx are left running and untouched.
set -euo pipefail

PROJECT_ROOT="${CRANIS2_DIR:-$HOME/cranis2}"
BRANCH="main"
HEALTH_URL="${STAGING_HEALTH_URL:-http://localhost:3001/api/health}"

log() { echo "[$(date -u +%FT%TZ)] deploy-staging: $*"; }
die() { echo "[$(date -u +%FT%TZ)] deploy-staging: ERROR: $*" >&2; exit 1; }

cd "$PROJECT_ROOT" || die "project root not found: $PROJECT_ROOT"

# Single-flight: never let two deploys overlap.
exec 9>/tmp/cranis2-staging-deploy.lock
flock -n 9 || { log "another deploy is in progress; skipping"; exit 0; }

git fetch --quiet origin "$BRANCH" || die "git fetch failed"
REMOTE="$(git rev-parse "origin/$BRANCH")"
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

# Staging tracks main. If the box is on another branch, only switch when clean.
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  [ -z "$(git status --porcelain)" ] || die "tree not clean and not on '$BRANCH'; refusing to switch"
  log "switching branch $CURRENT_BRANCH -> $BRANCH"
  git checkout "$BRANCH"
fi

if [ "$(git rev-parse @)" = "$REMOTE" ]; then
  log "already up to date ($(git rev-parse --short @))"
  exit 0
fi

# Clean-tree guard (anti-contamination): never build/deploy over local edits.
[ -z "$(git status --porcelain)" ] || die "working tree not clean; refusing to deploy"

log "deploying $(git rev-parse --short @) -> $(git rev-parse --short "$REMOTE")"
git merge --ff-only "origin/$BRANCH" || die "fast-forward failed (history diverged from origin/$BRANCH)"

# Frontend is built on the host; nginx bind-mounts frontend/dist.
log "building frontend"
(
  cd frontend
  # shellcheck disable=SC1090
  [ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
  npm install --no-audit --no-fund
  npm run build
) || die "frontend build failed"

# Rebuild + restart app services only. DBs and nginx are untouched.
log "rebuilding app services (backend, welcome)"
docker compose up -d --build backend welcome || die "docker compose up failed"

# Health check.
sleep 5
if curl -fsS -o /dev/null --max-time 10 "$HEALTH_URL"; then
  log "deploy OK — now at $(git rev-parse --short @), health 200"
else
  die "health check failed at $HEALTH_URL after deploy — investigate (services may still be starting)"
fi

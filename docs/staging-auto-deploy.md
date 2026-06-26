# Staging auto-deploy (dev.cranis2.dev)

The staging host is behind 5G CGNAT, so it has **no public inbound IP** — a GitHub-hosted runner cannot reach *into* it the way it reaches prod. Instead, staging deploys **pull-based**: the host reaches **out** to GitHub on a timer and fast-forwards `origin/main`, then rebuilds the app services.

**Net effect:** to deploy staging from anywhere, just **merge to `main`**. Within the timer interval, the box updates itself. No tunnel or inbound access required.

This is intentionally different from prod, which is **push-based and gated** (a GitHub Actions runner connects to prod's public IP after a human approval — see `scripts/promote-to-prod.sh` / `.github/workflows/promote.yml`). Staging is lower-risk, so it auto-deploys.

## What it does
`scripts/deploy-staging.sh` (run by a systemd timer):
1. Single-flights via a lock; fetches `origin/main`.
2. Ensures the box is on `main` (only switches when the tree is clean).
3. No-ops if already up to date.
4. Clean-tree guard, then `git merge --ff-only origin/main`.
5. Builds the frontend on the host (nginx bind-mounts `frontend/dist`).
6. `docker compose up -d --build backend welcome` (databases + nginx untouched).
7. Health-checks `/api/health`.

## One-time install (on the staging host)
```bash
# 1) Put the working tree on main (staging tracks main, not a feature branch):
cd ~/cranis2 && git checkout main && git pull --ff-only origin main

# 2) Install the systemd units:
sudo cp deploy/cranis2-staging-deploy.service /etc/systemd/system/
sudo cp deploy/cranis2-staging-deploy.timer   /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cranis2-staging-deploy.timer

# 3) Verify:
systemctl list-timers cranis2-staging-deploy.timer
./scripts/deploy-staging.sh        # run once manually to confirm it works
journalctl -u cranis2-staging-deploy.service -n 50 --no-pager
```

## Manual deploy
Run `./scripts/deploy-staging.sh` any time (it's idempotent).

## Notes
- The deploy is **not** taking a pre-deploy backup (staging is rebuildable; prod's gated process handles backups).
- If you ever want *instant* staging deploys instead of a ≤2-minute poll, add a GitHub webhook to a small receiver exposed through the existing Cloudflare Tunnel (`dev.cranis2.dev`) that runs the same script. The poll is simpler and needs no inbound, so it's the default here.
- Adjust the cadence in `cranis2-staging-deploy.timer` (`OnUnitActiveSec`).

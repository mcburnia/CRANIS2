# CRANIS2 Dev Server Memory Runbook

## Scope

- Host RAM was upgraded from `4 GB` to `16 GB` on `2026-03-03`.
- This machine runs at least two active dev stacks: `CRANIS2` and `ANSABASE`.
- External `2 TB` USB SSD is storage-only. Do not format it, wipe it, or use it as swap.

## CRANIS2 Memory Profile (Current)

Source of truth: `docker-compose.yml` and `backend/Dockerfile`.

| Service | Limit | Notes |
|---|---:|---|
| `cranis2_nginx` | `64M` | Static frontend + reverse proxy |
| `cranis2_backend` | `768M` | Node process heap capped to `512 MB` |
| `cranis2_test_runner` | `512M` | Optional; used for test runs |
| `cranis2_postgres` | `1G` | Conservative DB cache settings retained |
| `cranis2_neo4j` | `1536M` | Heap/pagecache tuned in env vars |
| `cranis2_forgejo` | `384M` | Source escrow instance |

Backend command (hard cap):

```bash
node --max-old-space-size=512 dist/index.js
```

## ANSABASE Limits (Reference)

Configured outside this repo in `/home/mcburnia/ANSABASE/docker`:

- `docker-compose.dev.yml`
  - app/backend: `768M`
  - nginx: `64M`
- `docker-compose.yml`
  - nginx: `64M`
  - app/backend: `768M`
  - ai-service: `768M`

## Daily Checks

```bash
# Host memory overview
free -h

# CRANIS2 limit config
cd ~/cranis2 && docker compose config | rg -n "memory:"

# Live per-container usage
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"
```

## If OOM Kills Happen

```bash
# Check kernel OOM records
dmesg -T | rg -i "out of memory|killed process|oom"

# Restart CRANIS2 stack
cd ~/cranis2 && docker compose up -d
```

If OOMs continue while both stacks are active:

1. Capture `docker stats --no-stream` output.
2. Identify the top memory container(s).
3. Adjust compose limits or service internals before increasing limits again.

## USB SSD Guardrails

- Keep SSD as storage only: artifacts and backups.
- Use `docs/USB-STORAGE-SETUP.md` and scripts:
  - `scripts/usb-storage-init.sh`
  - `scripts/usb-storage-sync-artifacts.sh`
- Do not run format commands (`mkfs.*`, partitioning tools) on the device.

## Backlog / Technical Debt

- Compose project naming mismatch and orphan cleanup is tracked in:
  - `docs/Stories-and-spikes.csv` (`CRN-14`)

<!--
  Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi@mcburnie.com
-->

# CRANIS2 — Database Backup and Restore

> This document is the **technical reference** — what the backup and restore
> scripts do, dump format, troubleshooting. For the **operational reference**
> (GFS retention scheme, age encryption of the dev mirror, recovery procedure,
> disaster scenarios) see [`docs/backup-retention.md`](./backup-retention.md).

## Overview

CRANIS2 stores data in two databases:
- **Postgres** (port 5433): relational data — users, products, obligations, vulnerabilities, billing, audit logs
- **Neo4j** (port 7688): graph data — organisations, products, contributors, dependencies, telemetry relationships

Both must be backed up and restorable as a pair. A Postgres backup without Neo4j (or vice versa) leaves the system in an inconsistent state.

## Backup Schedule (GFS — Grandfather/Father/Son)

| Type | Frequency | Retention | Script |
|------|-----------|-----------|--------|
| Daily (Son) | 02:00 UTC | 7 days | `scripts/backup-databases.sh` |
| Weekly (Father) | Sundays (promoted from daily) | 4 weeks | Automatic in same script |
| Monthly (Grandfather) | 1st of month (promoted from daily) | 12 months | Automatic in same script |
| Pre-upgrade | Before each deployment | 30 days | `scripts/backup-databases.sh --pre-upgrade` |
| Verification | Sundays 04:00 UTC | N/A | `scripts/verify-backup.sh` |
| **Encrypted off-site mirror** | Daily 03:00 UTC | 7d/4w/12m on dev | `scripts/pull-prod-backup.sh` (runs on dev) |
| USB artefact dump (legacy) | Manual | 4 copies | `scripts/usb-storage-sync-artifacts.sh` |

## Backup Directory Structure

```
backups/
  daily/
    2026-03-19T020000Z/
      cranis2.dump       Postgres custom-format dump (cranis2 database)
      forgejo.dump       Postgres custom-format dump (forgejo database)
      neo4j-data.tar.gz  Neo4j data volume archive
      manifest.json      Backup metadata and status
  weekly/                Symlinks to daily backups (Sundays)
  monthly/               Symlinks to daily backups (1st of month)
  pre-upgrade/           Tagged backups before deployments (kept 30 days)
```

## Scripts

### Take a Backup

```bash
# Normal daily backup
./scripts/backup-databases.sh

# Pre-upgrade backup (before deploying a new version)
./scripts/backup-databases.sh --pre-upgrade

# Postgres only (no Neo4j downtime)
./scripts/backup-databases.sh --postgres-only

# Neo4j only
./scripts/backup-databases.sh --neo4j-only
```

**Important:** Neo4j Community Edition does not support online dumps. The Neo4j container is stopped for approximately 30-60 seconds during backup. The backend will queue requests and reconnect automatically.

### Restore from Backup

```bash
# List available backups
./scripts/restore-databases.sh

# Restore a specific backup
./scripts/restore-databases.sh backups/daily/2026-03-19T020000Z

# Restore Postgres only
./scripts/restore-databases.sh backups/daily/2026-03-19T020000Z --postgres-only

# Restore Neo4j only
./scripts/restore-databases.sh backups/daily/2026-03-19T020000Z --neo4j-only
```

The restore script:
1. Shows what will be restored and asks for confirmation (type `RESTORE`)
2. Takes a safety backup before proceeding (tagged as pre-upgrade)
3. Stops the backend container
4. Restores Postgres via `pg_restore --clean --if-exists`
5. Restores Neo4j via `neo4j-admin database load --overwrite-destination`
6. Restarts the backend and waits for health check
7. Reports the safety backup location in case you need to roll back

### Verify a Backup

```bash
# Verify the latest daily backup
./scripts/verify-backup.sh

# Verify a specific backup
./scripts/verify-backup.sh backups/daily/2026-03-19T020000Z
```

Verification spins up temporary Postgres and Neo4j containers, restores the backup into them, runs validation queries (table counts, user counts, node counts), then cleans up. Exit code 0 means the backup is restorable.

## Cron Configuration

The following cron entries run backups and verification automatically:

```
# Daily database backup at 02:00 UTC
0 2 * * * /home/mcburnia/cranis2/scripts/backup-databases.sh >> /home/mcburnia/cranis2/logs/backup.log 2>&1

# Weekly backup verification on Sundays at 04:00 UTC
0 4 * * 0 /home/mcburnia/cranis2/scripts/verify-backup.sh >> /home/mcburnia/cranis2/logs/verify-backup.log 2>&1
```

## Pre-Deployment Procedure

Before deploying a new version:

1. **Take a pre-upgrade backup:**
   ```bash
   ./scripts/backup-databases.sh --pre-upgrade
   ```

2. **Deploy:**
   ```bash
   source ~/.nvm/nvm.sh && npm run build
   docker compose up -d --build
   ```

3. **Verify health:**
   ```bash
   curl -s http://localhost:3001/api/health
   ```

4. **If something goes wrong, restore:**
   ```bash
   # Find the latest pre-upgrade backup
   ls -la backups/pre-upgrade/

   # Restore it
   ./scripts/restore-databases.sh backups/pre-upgrade/<timestamp>
   ```

## Off-Site Backup (USB)

When a USB drive is connected and mounted at `/mnt/usb-storage`:

```bash
./scripts/usb-storage-sync-artifacts.sh
```

This copies the latest database backup to the USB drive alongside test artefacts and repo snapshots. Keeps 4 copies on USB.

## Neo4j Downtime Window

The Neo4j backup requires a brief container stop (30-60 seconds). During this window:
- The backend will receive connection errors from Neo4j
- API requests that touch the graph database will fail with 500 errors
- The frontend will show loading states
- Once Neo4j restarts, everything recovers automatically

The daily backup runs at 02:00 UTC (04:00 CEST) to minimise impact.

## What Is NOT Backed Up

- **Docker images** — rebuilt from source on each deployment
- **`cranis2_test` database** — ephemeral test data, seeded fresh each test run
- **Container logs** — ephemeral, rotated by Docker
- **Frontend static files** — rebuilt from source (`npm run build`)
- **node_modules** — reinstalled from lockfiles

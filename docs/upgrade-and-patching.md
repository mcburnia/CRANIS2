<!--
  Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi@mcburnie.com
-->

# CRANIS2 — System Upgrade and Security Patching

## Overview

CRANIS2 runs as a Docker Compose stack with six services (backend, frontend/nginx, Postgres, Neo4j, Forgejo, welcome site). This document covers how to safely upgrade the system, apply security patches, and roll back if something goes wrong.

**Core principle:** Every upgrade takes a backup first, verifies health after, and can be rolled back automatically or manually.

## Quick Reference

```bash
# Standard upgrade (pull, build, deploy, verify)
./scripts/upgrade-system.sh

# Check what would happen without changing anything
./scripts/upgrade-system.sh --dry-run

# Audit npm dependencies for vulnerabilities
./scripts/apply-security-patch.sh --audit-only

# Apply security patches (non-breaking)
./scripts/apply-security-patch.sh

# List available rollback points
./scripts/rollback-upgrade.sh

# Roll back to a specific backup
./scripts/rollback-upgrade.sh backups/pre-upgrade/<timestamp>
```

---

## System Upgrade

### What It Does

The upgrade script (`scripts/upgrade-system.sh`) performs these steps in order:

| Step | Action | On Failure |
|------|--------|------------|
| 1 | Pre-flight checks (disk, Docker, containers, Node.js) | Abort — nothing changed |
| 2 | Record current commit and container state | — |
| 3 | Take pre-upgrade database backup | Abort — nothing changed |
| 4 | `git pull origin main` | Abort — only git state changed |
| 5 | `npm ci` across all workspaces | Automatic rollback |
| 6 | Frontend build (`npm run build`) | Automatic rollback |
| 7 | Container rebuild (`docker compose up -d --build`) | Automatic rollback |
| 8 | Health checks (backend, frontend, Neo4j, Postgres) | Automatic rollback |

If any step from 5 onwards fails, the script automatically:
1. Reverts the code to the previous commit
2. Rebuilds the frontend from the reverted code
3. Restores the database from the pre-upgrade backup
4. Rebuilds and restarts containers
5. Verifies health after rollback

### Usage

```bash
# Standard upgrade from main branch
./scripts/upgrade-system.sh

# Preview without making changes
./scripts/upgrade-system.sh --dry-run

# Upgrade from a specific branch
./scripts/upgrade-system.sh --branch feature/new-feature

# Skip backup (not recommended — use only if backup is broken and you need to upgrade urgently)
./scripts/upgrade-system.sh --skip-backup
```

### Pre-Flight Checks

The script verifies these conditions before proceeding:

- **Disk space:** At least 2 GB free
- **Docker daemon:** Running and accessible
- **Required containers:** `cranis2_backend`, `cranis2_postgres`, `cranis2_neo4j`, `cranis2_nginx` exist
- **Backend health:** `/api/health` responds (warning only — proceeds if down)
- **Working directory:** No uncommitted changes (warning only)
- **Node.js:** Available via nvm
- **Backup script:** `backup-databases.sh` exists and is executable

### Outputs

Each upgrade produces:
- **Log file:** `logs/upgrade-<timestamp>.log` — full transcript of every step
- **Report:** `logs/upgrade-report-<timestamp>.json` — machine-readable status, commits, backup location

---

## Security Patching

### What It Does

The security patch script (`scripts/apply-security-patch.sh`) performs:

1. **Audit** — Runs `npm audit` across all workspaces (backend, frontend, e2e, welcome, mcp)
2. **Fix** — Applies `npm audit fix` (non-breaking by default)
3. **Re-audit** — Verifies which vulnerabilities were resolved
4. **Verify** — Builds frontend, rebuilds backend container, runs test suite
5. **Revert** — If tests fail, reverts all package changes automatically

### Usage

```bash
# Full cycle: audit → fix → re-audit → test → report
./scripts/apply-security-patch.sh

# Audit only (no changes made)
./scripts/apply-security-patch.sh --audit-only

# Allow breaking changes (major version updates)
./scripts/apply-security-patch.sh --breaking

# Fix a specific package
./scripts/apply-security-patch.sh --package lodash

# Preview what would change
./scripts/apply-security-patch.sh --dry-run
```

### Severity Levels

npm audit reports vulnerabilities at four severity levels:

| Level | Action |
|-------|--------|
| **Critical** | Patch immediately |
| **High** | Patch within 24 hours |
| **Moderate** | Patch within 1 week |
| **Low** | Patch in next scheduled maintenance |

### When to Use `--breaking`

Use `--breaking` only when:
- A critical/high vulnerability has no non-breaking fix
- You have time to test thoroughly after the update
- The major version bump is for a well-understood package

Always run the full test suite after `--breaking` updates.

### Outputs

- **Log file:** `logs/security-patch-<timestamp>.log`
- **Report:** `logs/security-patch-report-<timestamp>.json` — vulnerability counts per workspace, status

---

## Manual Rollback

### When to Use

Use manual rollback when:
- An upgrade completed but you discover issues later (after the automatic rollback window)
- You need to revert to a state from days ago (not just the last upgrade)
- You need to roll back only code or only the database, not both

### Usage

```bash
# List all available rollback points (backups, commits, upgrade reports)
./scripts/rollback-upgrade.sh

# Full rollback (code + database) to a pre-upgrade backup
./scripts/rollback-upgrade.sh backups/pre-upgrade/2026-03-19T020000Z

# Database only (keep current code)
./scripts/rollback-upgrade.sh backups/daily/2026-03-19T020000Z --db-only

# Code only (keep current database)
./scripts/rollback-upgrade.sh --to-commit abc1234 --code-only
```

### Confirmation

All rollback operations require typing `ROLLBACK` to confirm. Database restores additionally require typing `RESTORE` (handled by the restore script).

### What Gets Rolled Back

| Mode | Code | Dependencies | Frontend | Containers | Database |
|------|------|-------------|----------|------------|----------|
| Full | ✓ | ✓ | ✓ | ✓ | ✓ |
| `--code-only` | ✓ | ✓ | ✓ | ✓ | — |
| `--db-only` | — | — | — | — | ✓ |

---

## Decision Tree

```
Is there a known vulnerability?
├── Yes, critical/high severity
│   └── Apply security patch immediately
│       └── ./scripts/apply-security-patch.sh
├── Yes, moderate/low severity
│   └── Schedule for next maintenance window
└── No
    └── Is there a new release to deploy?
        ├── Yes
        │   └── Run standard upgrade
        │       └── ./scripts/upgrade-system.sh
        └── No
            └── No action needed
```

```
Did the upgrade/patch fail?
├── Automatic rollback triggered
│   └── Check the log file for root cause
│       └── Fix the issue, then try again
├── Upgrade succeeded but issues found later
│   └── Use manual rollback
│       └── ./scripts/rollback-upgrade.sh
└── Upgrade succeeded, all good
    └── Verify at https://dev.cranis2.dev
```

---

## Maintenance Windows

For production use, schedule upgrades during low-traffic periods:

- **Preferred window:** 02:00–04:00 UTC (04:00–06:00 CEST)
- **Neo4j downtime:** ~30–60 seconds during backup (before upgrade)
- **Backend restart:** ~10–20 seconds during container rebuild
- **Total expected downtime:** Under 2 minutes for a standard upgrade

---

## Scheduled Automation (Cron)

Security audits can run on a schedule. Upgrades should always be triggered manually.

```cron
# Weekly security audit (Mondays at 03:00 UTC) — audit only, no changes
0 3 * * 1 /home/mcburnia/cranis2/scripts/apply-security-patch.sh --audit-only >> /home/mcburnia/cranis2/logs/security-audit.log 2>&1
```

Do **not** automate `upgrade-system.sh` or `apply-security-patch.sh` (without `--audit-only`) via cron. These should be human-initiated.

---

## File Inventory

| Script | Purpose |
|--------|---------|
| `scripts/backup-databases.sh` | Daily/pre-upgrade database backup |
| `scripts/restore-databases.sh` | Interactive database restore |
| `scripts/verify-backup.sh` | Backup verification (temp containers) |
| `scripts/upgrade-system.sh` | Full system upgrade with auto-rollback |
| `scripts/apply-security-patch.sh` | npm vulnerability audit and fix |
| `scripts/rollback-upgrade.sh` | Manual rollback (code, DB, or both) |
| `scripts/usb-storage-sync-artifacts.sh` | Off-site backup to USB |

| Log/Report | Created By |
|------------|-----------|
| `logs/upgrade-<ts>.log` | upgrade-system.sh |
| `logs/upgrade-report-<ts>.json` | upgrade-system.sh |
| `logs/security-patch-<ts>.log` | apply-security-patch.sh |
| `logs/security-patch-report-<ts>.json` | apply-security-patch.sh |
| `logs/rollback-<ts>.log` | rollback-upgrade.sh |
| `logs/backup.log` | backup-databases.sh (via cron) |
| `logs/verify-backup.log` | verify-backup.sh (via cron) |

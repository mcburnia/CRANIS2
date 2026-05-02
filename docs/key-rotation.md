<!--
  Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi.mcburnie@gmail.com
-->

# CRANIS2 — Key Rotation Runbook

## Overview

CRANIS2 uses multiple cryptographic keys and credentials. This document covers when and how to rotate each one, the operational model, and rollback procedures.

**Core principle:** Rotation limits the exposure window if a key is compromised. Monthly for credentials, annually for encryption and signing keys.

## Rotation Schedule

| Key | Frequency | Maintenance Window? | Script |
|-----|-----------|-------------------|--------|
| Postgres password | Monthly | No | `rotate-credentials.sh` |
| Neo4j password | Monthly | No | `rotate-credentials.sh` |
| Forgejo DB password | Monthly | No | `rotate-credentials.sh` |
| JWT_SECRET | Monthly | No | `rotate-credentials.sh` |
| WELCOME_SECRET | Monthly | No | `rotate-credentials.sh` |
| GITHUB_ENCRYPTION_KEY | Annually | Yes | `rotate-encryption-key.sh` |
| Signing keys (Ed25519 + ML-DSA-65) | Annually | Yes | `rotate-signing-keys.sh` |

## Operational Model

Production runs on Infomaniak (Switzerland). The dev server (lab, Mac Mini) acts as the secure key rotation workstation.

### Monthly Credential Rotation (no maintenance window)

```bash
# On the lab server (or production directly):
./scripts/rotate-credentials.sh

# Preview first:
./scripts/rotate-credentials.sh --dry-run
```

This script:
1. Generates new passwords for Postgres, Neo4j, and Forgejo
2. Changes passwords at the database level (`ALTER USER` / `cypher-shell`)
3. Generates a new JWT_SECRET and WELCOME_SECRET
4. Updates `.env` with all new values
5. Restarts affected containers
6. Verifies health
7. Records the rotation in the ledger

**Impact:** Active user sessions expire within 7 days (JWT rotation). No data loss. No downtime beyond container restart (~10 seconds).

### Annual Encryption Key Rotation (maintenance window)

This is the most involved rotation because stored PATs must be re-encrypted.

**Phase 1 — Lab server (before the maintenance window):**

```bash
# On the lab server:
./scripts/rotate-encryption-key.sh

# Or preview first:
./scripts/rotate-encryption-key.sh --dry-run
```

This produces a package in `logs/key-rotation-<timestamp>/` containing:
- `cranis2-rotated.dump` — Postgres dump with PATs re-encrypted
- `new-env-values.txt` — New GITHUB_ENCRYPTION_KEY
- `cranis2-pre-rotation.dump` — Original dump (for rollback)
- `DEPLOY.md` — Deployment instructions

**Phase 2 — Production (during maintenance window):**

```bash
# Transfer the package to production, then:
./scripts/apply-key-rotation.sh logs/key-rotation-<timestamp>
```

This script:
1. Takes a safety backup
2. Stops the backend
3. Restores the re-encrypted database dump
4. Updates `.env` with the new encryption key
5. Restarts services
6. Verifies health

**Estimated downtime:** 2–5 minutes.

### Annual Signing Key Rotation (maintenance window)

```bash
# On the lab server:
./scripts/rotate-signing-keys.sh

# Then on production:
./scripts/apply-key-rotation.sh logs/signing-rotation-<timestamp>
```

The old public keys are archived in the rotation package. Store these permanently — they're needed to verify documents signed before the rotation.

## Monitoring Rotation Age

```bash
# Check all keys:
./scripts/check-rotation-age.sh

# Machine-readable:
./scripts/check-rotation-age.sh --json
```

**Cron entry (weekly, Mondays at 06:00 UTC):**

```cron
0 6 * * 1 /home/mcburnia/cranis2/scripts/check-rotation-age.sh >> /home/mcburnia/cranis2/logs/rotation-check.log 2>&1
```

The checker reads the rotation ledger (`logs/rotation-ledger.json`) and reports:
- **OK** — within threshold
- **DUE SOON** — past 80% of the threshold
- **OVERDUE** — past the threshold
- **NEVER** — no rotation recorded

## Rotation Ledger

All rotations are recorded in `logs/rotation-ledger.json`:

```json
[
  {"key": "POSTGRES_PASSWORD", "rotated_at": "2026-03-20T050000Z"},
  {"key": "JWT_SECRET", "rotated_at": "2026-03-20T050000Z"},
  {"key": "GITHUB_ENCRYPTION_KEY", "rotated_at": "2026-03-20T060000Z", "package": "logs/key-rotation-..."}
]
```

## Rollback Procedures

### Credential rotation failed

If `rotate-credentials.sh` fails partway through:
1. Check which credentials were changed (look at the log)
2. The old `.env` values are still in the previous state if the script failed before updating
3. If `.env` was updated but containers didn't restart, restart manually: `docker compose up -d backend forgejo welcome`

### Encryption key rotation failed

If the re-encrypted dump is corrupt or the new key doesn't work:

```bash
# Restore from the pre-rotation dump in the package:
./scripts/restore-databases.sh <rotation-dir>/cranis2-pre-rotation.dump --postgres-only

# Revert .env to the old GITHUB_ENCRYPTION_KEY
# Then restart:
docker compose up -d backend
```

### Signing key rotation failed

Signing keys are simpler — just revert the `.env` values to the old `CRANIS2_SIGNING_KEY` and `CRANIS2_SIGNING_KEY_MLDSA`, then restart the backend.

## HNDL (Harvest Now, Decrypt Later) Context

**Why we rotate:**
- Monthly credential rotation limits the exposure window if a credential is stolen without detection
- Annual encryption key rotation is for hygiene, not algorithm weakness (AES-256 is quantum-safe)
- Annual signing key rotation refreshes the key material

**What rotation does NOT protect against:**
- Data already encrypted with an old key and harvested by an adversary — the algorithm strength (AES-256) is the protection, not rotation frequency
- This is why we use AES-256-GCM (quantum-safe) rather than relying on rotation alone

## Script Inventory

| Script | Purpose | Runs On |
|--------|---------|---------|
| `rotate-credentials.sh` | Monthly: DB passwords, JWT, welcome secret | Lab or production |
| `rotate-encryption-key.sh` | Annual: re-encrypt PATs with new key | Lab server |
| `rotate-signing-keys.sh` | Annual: new Ed25519+ML-DSA-65 key pairs | Lab server |
| `apply-key-rotation.sh` | Deploy rotation package to production | Production |
| `check-rotation-age.sh` | Report days since last rotation per key | Both |
| `generate-signing-keys.sh` | One-off key generation (initial setup) | Lab server |

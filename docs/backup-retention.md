<!--
  Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi.mcburnie@gmail.com
-->

# CRANIS2 — Backup Retention & Recovery

This document describes the production backup architecture, retention scheme, encryption, and recovery procedures. **Treat it as part of the operational runbook.** It must be kept current — if any script, key location, or schedule changes, update this file in the same commit.

---

## Architecture overview

```
PROD (Infomaniak VPS, 83.228.241.168)
  └── ~/cranis2/backups/
        ├── daily/<UTC-stamp>/        ← 7 retained — Son
        ├── weekly/<UTC-stamp>        ← 4 retained — Father (symlink to a daily, promoted on Sunday)
        ├── monthly/<UTC-stamp>       ← 12 retained — Grandfather (symlink to a daily, promoted on 1st of month)
        └── pre-upgrade/<UTC-stamp>/  ← retained 30 days, manual

       ↓ daily 03:00 UTC, encrypted pull via dedicated SSH key

DEV (this server, behind Cloudflare Tunnel)
  └── ~/cranis2-backup-mirror/
        ├── daily/<stamp>.tar.age     ← 7 retained — encrypted ciphertext only
        ├── weekly/<stamp>.tar.age    ← 4 retained
        ├── monthly/<stamp>.tar.age   ← 12 retained
        └── logs/pull.log             ← rolling log of each pull cron run
```

**Two independent retention chains.** Prod and dev each run their own GFS rotation. If either side is compromised or destroyed, the other remains a complete year of monthly snapshots.

---

## Schedule

| When (UTC) | What | Where |
|---|---|---|
| **02:00 daily** | Postgres + Neo4j backup (Son tier) | Prod, via cron (`scripts/backup-databases.sh`) |
| **02:00 Sundays** | Daily promoted to weekly tier | Prod, automatic in same script |
| **02:00 1st of month** | Daily promoted to monthly tier | Prod, automatic |
| **03:00 daily** | Encrypted pull from prod | Dev, via cron (`scripts/pull-prod-backup.sh`) |
| **03:00 Sundays / 1st** | GFS promotion on dev mirror | Dev, automatic in same script |
| **04:00 Sundays** | Backup verification (restore round-trip) | Prod, via cron (`scripts/verify-backup.sh`) |
| **09:00 Mondays** | Key-rotation age check | Prod, via cron (`scripts/check-rotation-age.sh`) |

---

## Encryption

- Tool: **age** (`apt install age` — version 1.1.x on Ubuntu 24.04)
- Algorithm: X25519 + ChaCha20-Poly1305 (modern, audited)
- **Public key** (used to encrypt, can be on prod or anywhere):
  - File on dev: `~/.age/cranis2-backup.pub`
  - Value: `age1wxfvuc02qjdlxnlsuhhyhxwcckmqkt2hjtj4455syppxwmpch4ksr4ekzz`
- **Private key** (used to decrypt, lives only on dev):
  - File on dev: `~/.age/cranis2-backup.key` (perms `0400`, owner-only)
  - **Never copied to prod, never leaves dev.**

### Where the plaintext lives during transit

The pull script streams in a single pipe:
```
ssh prod 'tar c <latest-daily>'  →  age -r <pub>  →  /home/.../<stamp>.tar.age
                ^                          ^
                encrypted by SSH           encrypted by age before disk write
```
Plaintext exists only in pipe memory on the dev host while age encrypts it. It is **never written unencrypted to dev disk**.

### Loss-of-key risk

**If `~/.age/cranis2-backup.key` is lost or destroyed on dev, every backup in the dev mirror becomes permanently undecryptable.** Mitigations:

1. **Print the key on paper and store in a safe.** It's 184 bytes — fits on a single sheet.
2. **Copy the key to a password manager / secure offline vault.** Bitwarden, 1Password, etc., as a secure note.
3. **Do NOT** store the key in git, in cloud storage you don't control, or on the same host as the backups.

The key file content (showing format only — your actual key differs):
```
# created: 2026-04-30T07:31:00Z
# public key: age1wxfvuc02qjdlxnlsuhhyhxwcckmqkt2hjtj4455syppxwmpch4ksr4ekzz
AGE-SECRET-KEY-1...........................................
```

---

## SSH key restriction (defence-in-depth)

The dev → prod backup pull uses a **dedicated, passphraseless** SSH key:
- Dev: `~/.ssh/cranis2_prod` (label `cranis2-dev-to-prod`)
- Prod: line 3 of `~/.ssh/authorized_keys`, **restricted with**:
  ```
  command="/home/mcburnia/cranis2/scripts/serve-backup.sh",no-pty,
  no-port-forwarding,no-agent-forwarding,no-X11-forwarding
  ```

This means: a compromise of dev (which holds the passphraseless key) only allows running `serve-backup.sh` on prod, **not arbitrary shell**. The serve script accepts only two subcommands:

| `$SSH_ORIGINAL_COMMAND` | Action |
|---|---|
| `name` | Print latest daily timestamp on stdout |
| `tar`  | Stream tarball of latest daily on stdout |
| anything else | Reject, exit 1 |

The interactive `cranis2-prod` (with passphrase) key on line 1 of `authorized_keys` remains unrestricted for normal admin work.

---

## Recovery procedure

### From prod's local backup (fastest)

```bash
# On prod
cd ~/cranis2
./scripts/restore-databases.sh                           # latest daily
./scripts/restore-databases.sh ~/cranis2/backups/daily/<stamp>  # specific
./scripts/restore-databases.sh ~/cranis2/backups/monthly/<stamp> # year-old
```

### From dev mirror (if prod is gone)

1. **Decrypt** on dev:
   ```bash
   age -d -i ~/.age/cranis2-backup.key \
       ~/cranis2-backup-mirror/daily/<stamp>.tar.age \
       | tar x -C /tmp/restore
   ```
2. **Copy the unpacked directory** to a recovered prod (or a new instance):
   ```bash
   scp -r /tmp/restore/<stamp>/ user@<new-prod>:~/cranis2/backups/daily/
   ```
3. **Run the restore** on the new prod:
   ```bash
   ./scripts/restore-databases.sh ~/cranis2/backups/daily/<stamp>
   ```

### Restore a specific tier

| Need | Use |
|---|---|
| "the data as of yesterday" | Latest in `daily/` |
| "what was it last Sunday" | Latest in `weekly/` |
| "first of last month" | Latest in `monthly/` |
| "before the disaster recovery operation we just did" | Latest in `pre-upgrade/` |

---

## Customer-data invariant

**Never** in any backup, restore, or migration step:
- `DROP` a column or table
- `DELETE` rows from a customer-owned table (`users`, `products`, `product_sboms`, vulnerabilities, technical files, obligations, `org_billing`, `affiliate_*`, etc.)
- `TRUNCATE` data tables
- Remove a foreign key that data depends on

Schema migrations live in `backend/src/db/pool.ts initDb()` and may **only add or relax** structure. If a removal is genuinely needed, it requires explicit user approval, a documented migration plan, and a pre-change `--pre-upgrade` backup.

---

## Operational checklist

Before any planned change to prod:
1. Confirm cron-driven daily backup ran successfully today (`tail ~/cranis2/logs/backup.log`)
2. Confirm dev mirror is current (`ls ~/cranis2-backup-mirror/daily/ | tail -1`)
3. Take a manual `--pre-upgrade` backup: `./scripts/backup-databases.sh --pre-upgrade`
4. Note the timestamp; if anything goes wrong, that's your immediate rollback target
5. Make the change
6. Run a quick smoke test (`/api/health` plus one or two API calls)
7. If anything is suspicious, restore from the pre-upgrade backup before proceeding

---

## Disaster scenarios

| Scenario | Recovery path | Maximum data loss |
|---|---|---|
| Single-table corruption | Restore that table from latest daily | 24h |
| Postgres-instance corruption | Restore latest daily (Postgres dump) | 24h |
| Whole-VPS loss with disk recoverable | Provision new VPS, copy backups, restore | 24h |
| Whole-VPS loss with disk gone | Pull latest from dev mirror, restore on new VPS | 24h–48h (one-day mirror lag + provisioning) |
| Both VPS and dev disk lost | Restore from offline-stored age key + most recent off-machine backup copy you've kept | depends on most recent off-machine snapshot |

**The "both VPS and dev disk lost" scenario is unmitigated by the current scheme.** To close it, take a periodic off-line snapshot of the dev mirror to external media (USB drive in a safe, or a third-party object store with separate credentials). Recommendation: weekly USB snapshot, or wire up a third-party secondary mirror as a follow-on task.

---

## Files involved

| File | Purpose | Lives on |
|---|---|---|
| `scripts/backup-databases.sh` | Generates daily/pre-upgrade backups, runs prod-side GFS rotation | both |
| `scripts/pull-prod-backup.sh` | Dev-side encrypted pull; runs at 03:00 UTC | both |
| `scripts/serve-backup.sh` | Prod-side restricted SSH command (called by dev's pull) | both |
| `scripts/restore-databases.sh` | Restores Postgres + Neo4j from a backup directory | both |
| `scripts/verify-backup.sh` | Weekly verify — restores latest backup into ephemeral containers | both |
| `~/.age/cranis2-backup.key` | age private key (decrypt) | dev only |
| `~/.age/cranis2-backup.pub` | age public key (encrypt) | dev (canonical), can be referenced anywhere |
| `~/.ssh/cranis2_prod` | passphraseless SSH key for backup pulls | dev only |
| `~/.ssh/authorized_keys` (line 3) | restricted entry for the above key | prod only |

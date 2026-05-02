<!--
  Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi@mcburnie.com
-->

# CRANIS2 — System Architecture (Operator View)

This document describes the platform from an operator's perspective: where everything lives, what runs where, how data flows, and what depends on what. It is the document a new technical operator should read first.

For design rationale and product architecture see `docs/HLD.md` and `docs/LLD.md`. For backup and recovery in detail see `docs/backup-retention.md`. This document focuses on **what is deployed today** — not how it was designed or why.

---

## 1. Two environments

| Environment | Purpose | Hostname | Public URL |
|---|---|---|---|
| **Production** | Runs the customer-facing platform | Infomaniak VPS `ov-6fc008` | `https://cranis2.com` |
| **Development** | Day-to-day engineering, test stack, encrypted backup mirror | Mac Mini in the founder's office (Ubuntu 24.04 LTS, hostname `cranis2`) | `https://dev.cranis2.dev` (via Cloudflare Tunnel) |

These are the only two environments. There is no staging environment — production is small enough that the cost of a staging tier outweighs its value, and customer-impacting changes are de-risked by the test stack on dev (see section 6) plus the rollback procedure in `04-deployment.md`.

The production server's IP, SSH details, and account ownership are in `OPERATIONS-SECURE.md` under `infomaniak.prod`. The dev server is on the founder's home network; remote access via Cloudflare Tunnel.

---

## 2. Production architecture

```
                Internet
                   │
                   ▼
   Cloudflare ─── DDoS, TLS to edge, WAF
                   │
                   ▼
  Infomaniak VPS (83.228.241.168, Ubuntu 24.04 LTS)
   ┌──────────────────────────────────────────────┐
   │  HOST nginx (Let's Encrypt, certbot.timer)   │  ← TLS terminates here
   │     │                                        │
   │     ▼                                        │
   │  Docker stack (cranis2_net bridge)           │
   │   ┌──────────┐  ┌─────────┐  ┌──────────┐    │
   │   │ frontend │  │ backend │  │ welcome  │    │
   │   │ (nginx,  │  │ (Node24)│  │ (Node22) │    │
   │   │  port 80)│  │  :3001  │  │  :3004   │    │
   │   └────┬─────┘  └────┬────┘  └────┬─────┘    │
   │        │             │            │          │
   │        └────────┬────┴────────────┘          │
   │                 ▼                            │
   │   ┌──────────┐  ┌──────────┐  ┌──────────┐   │
   │   │ Postgres │  │  Neo4j   │  │ Forgejo  │   │
   │   │   16     │  │    5     │  │    10    │   │
   │   │ :5433/lo │  │:7475-88  │  │ :3003/lo │   │
   │   └──────────┘  └──────────┘  └──────────┘   │
   └──────────────────────────────────────────────┘
        UFW firewall: open on 22/80/443 only
        Database container ports bound to 127.0.0.1
        Infomaniak provider firewall: same
```

**Key points:**

- **Nginx is on the host, not in a container** on production. This was a deliberate choice for TLS automation: certbot runs as a system service against host nginx, and certificate renewals happen automatically via `certbot.timer`.
- **All database container ports are bound to `127.0.0.1`** (Postgres 5433, Neo4j 7475/7688, Forgejo 3003). They are reachable from the host and from other containers in `cranis2_net`, but never directly from the internet.
- **There is a prod-only `docker-compose.override.yml`** that sets `NODE_ENV=production` and any prod-specific environment overrides. It is gitignored (see commit `6927926`); the source of truth for its content is the file itself on the production server.
- **Architecture details and deployment history** are in `docs/deployment-plan.md` (now a historical record — all five phases completed 2026-04-30).

---

## 3. Development architecture

```
                Internet
                   │
                   ▼
   Cloudflare Tunnel (cloudflared systemd service)
                   │
                   ▼
  Mac Mini, Ubuntu 24.04 LTS, on home LAN
   ┌──────────────────────────────────────────────┐
   │  Docker stack (same compose file as prod)    │
   │     + test stack (--profile test, port 3011) │
   │     + cranis2-backup-mirror (encrypted)      │
   └──────────────────────────────────────────────┘
        Reachable publicly only via the Tunnel
        SSH from outside via tunnel: -p 2222 mcburnia@localhost
```

**Key points:**

- **Same docker-compose.yml as production**, plus the test stack containers (`backend_test`, `neo4j_test`, `test-runner` — only started with `--profile test`, see `scripts/test-stack.sh`).
- **No public TLS certificate is needed on the host.** Cloudflare terminates TLS at the edge for `dev.cranis2.dev` and forwards to the local Docker stack via the Tunnel.
- **The backup mirror lives at `~/cranis2-backup-mirror/`** and is populated by `scripts/pull-prod-backup.sh` running nightly at 03:00 UTC via cron. Files are `.tar.age` ciphertext only. Decryption requires the dev-only age private key (`~/.age/cranis2-backup.key`). See `docs/backup-retention.md`.
- **The dev server doubles as the key-rotation workstation.** When a key rotation happens (annual for encryption/signing keys), it happens on dev and the result is deployed to production during a maintenance window. See `docs/key-rotation.md`.

---

## 4. The container stack

Defined in `docker-compose.yml` at the project root. Same definition runs on both environments — different `.env` content selects production or development behaviour.

| Container | Image | Purpose | Port (host:container) | Memory limit |
|---|---|---|---|---|
| `cranis2_nginx` | `nginx:alpine` | Internal nginx serving the React SPA from `frontend/dist` (the host nginx fronts this on prod) | `3002:80` | 64M |
| `cranis2_backend` | Built from `backend/` (Node 24 Alpine) | The application server (Express + TypeScript) | `3001:3001` | 768M |
| `cranis2_postgres` | `postgres:16-alpine` | Relational database (CRANIS2 + Forgejo + test DB) | `127.0.0.1:5433:5432` | 2G |
| `cranis2_neo4j` | `neo4j:5-community` | Graph database (contributor/dependency relationships, SBOM graph, SEE evidence graph) | `127.0.0.1:7475:7474`, `127.0.0.1:7688:7687` | 1.5G |
| `cranis2_welcome` | Built from `welcome/` (Node 22) | Marketing site, public assessments, lead capture | `3004:3004` | 96M |
| `cranis2_forgejo` | `codeberg.org/forgejo/forgejo:10` | In-house git server used as IP escrow (`escrow.cranis2.dev`) | `127.0.0.1:3003:3000` | 512M |

**Test stack (started with `--profile test` only):**

| Container | Purpose | Port |
|---|---|---|
| `cranis2_neo4j_test` | Isolated Neo4j for tests | `7476:7474`, `7699:7687` |
| `cranis2_backend_test` | Isolated backend for tests, talks only to test DBs | `3011:3001` |
| `cranis2_test_runner` | Vitest runner — runs the suite inside the container network | (no host port) |

**Why an isolated test stack?** Running tests against the live backend caused ~29 spurious failures from data collisions and was an existential risk to customer data. The isolated stack uses a separate Postgres database (`cranis2_test`), separate Neo4j instance, separate backend, on different ports. Five layers of safety enforce this — see `CLAUDE.md` "Test Infrastructure" section. **The rule is absolute: tests never run against the live stack.**

---

## 5. Consolidated port map

| Service | Port | Bound to | Notes |
|---|---|---|---|
| Frontend nginx (dev/prod container) | 3002 | All interfaces (fronted by host nginx on prod) | |
| Backend (live) | 3001 | All interfaces in container | |
| Backend (test) | 3011 | Only when `--profile test` | |
| Postgres | 5433 | `127.0.0.1` only | |
| Neo4j HTTP (live) | 7475 | `127.0.0.1` only | |
| Neo4j Bolt (live) | 7688 | `127.0.0.1` only | |
| Neo4j HTTP (test) | 7476 | All interfaces (test profile) | |
| Neo4j Bolt (test) | 7699 | All interfaces (test profile) | |
| Forgejo | 3003 | `127.0.0.1` only | |
| Welcome site | 3004 | All interfaces in container | |

On production, only ports 22 (SSH), 80 (HTTP redirect), and 443 (HTTPS) are open at both UFW and the Infomaniak provider firewall. Everything else is internal.

---

## 6. Data layer

CRANIS2 stores its operational data across two databases plus filesystem volumes for snapshots.

### Postgres (relational)

Holds: users, organisations, products, billing, obligations, vulnerabilities, audit log, copilot prompts and cache, technical-file sections, retention ledger, affiliate programme, doc pages, verified emails, and roughly 70 other tables.

**Schema source of truth: `backend/src/db/pool.ts initDb()`.** All `CREATE TABLE`, `ALTER TABLE`, and `CREATE INDEX` statements live there, guarded with `IF NOT EXISTS`. The function runs at backend startup and is idempotent. **Never apply DDL directly on the production database** — the schema must change in code first so dev and prod stay in lockstep. See `CLAUDE.md` rule 13.

**Two databases inside the same Postgres instance:**
- `cranis2` — application data
- `forgejo` — Forgejo's own data (issues, repos, settings, users)
- `cranis2_test` — test stack only, lives in the same instance for convenience

### Neo4j (graph)

Holds: contributor → product relationships, dependency graph (`Component-DEPENDS_ON-Component`), repository tracking (provider, owner, repo), SEE (Software Evidence Engine) competence graph.

Schema is implicit (Neo4j is schema-less) but constraints are created at backend startup — see `backend/src/db/neo4j.ts`.

### Filesystem volumes

Docker named volumes hold:
- `cranis2_pg_data` — Postgres data
- `cranis2_neo4j_data` — Neo4j data (declared `external: true` so it survives a `docker compose down -v`)
- `cranis2_neo4j_logs` — Neo4j logs
- `cranis2_forgejo_data` — Forgejo data
- `cranis2_welcome_data` — verified-email cache for the welcome site
- `cranis2_neo4j_test_data` — test stack only

Project-mounted bind mounts:
- `./frontend/dist` → nginx static root
- `./docs` → backend (read-only — for serving the user guide / FAQ / PQC assessment markdown)
- `./data/snapshots` → backend (compliance snapshots before being uploaded to cold storage)

### Cold storage

Compliance snapshots (the long-term immutable evidence vault) are uploaded to **Scaleway Object Storage**, S3-compatible, Glacier storage class, in region `fr-par`. See `backend/src/services/cold-storage.ts`. Credentials are `SCW_ACCESS_KEY` and `SCW_SECRET_KEY` in `.env`. Bucket name: `cranis2-compliance-archive` (configurable via `SCW_BUCKET_NAME`).

---

## 7. External services

CRANIS2 depends on the following third-party services. Loss of access to any of them degrades or disables specific features.

| Service | Purpose | What breaks if it's gone | Where credentials live |
|---|---|---|---|
| **Cloudflare** | DNS for `cranis2.com`/`.dev`, Tunnel for dev, edge TLS, DDoS, WAF | Public access to both environments | Cloudflare account (in `OPERATIONS-SECURE`) |
| **Infomaniak** | Production VPS hosting | Production server | Infomaniak account |
| **Stripe** | Customer billing (subscriptions, one-off bonuses, affiliate payouts) | New signups can't pay; existing subs stop renewing | `STRIPE_*` in `.env`; Stripe dashboard account |
| **Resend** | Outbound email (verifications, alerts, statements, affiliate emails) | Customers can't verify accounts; no system emails | `RESEND_API_KEY` in `.env`; Resend account |
| **Anthropic** | AI Copilot (suggest, triage, risk assessment, incident drafter, category recommender, gap narrator, supplier DD) | All Copilot capabilities; auth/login still works | `ANTHROPIC_API_KEY` in `.env`; Anthropic Console |
| **Scaleway Object Storage** | Cold storage for compliance snapshots (10-year vault) | Vault snapshot uploads fail; everything else works | `SCW_*` in `.env`; Scaleway console |
| **GitHub OAuth** | Repo provider integration (most common) | New GitHub repo connections; existing connections continue | `GITHUB_CLIENT_ID/SECRET` in `.env`; GitHub OAuth App |
| **Codeberg OAuth** | Repo provider | Codeberg integrations | `CODEBERG_CLIENT_ID/SECRET` in `.env` |
| **Bitbucket OAuth** | Repo provider (added session 59) | Bitbucket integrations | Bitbucket OAuth Consumer in workspace settings |
| **Forgejo (self-hosted)** | IP escrow at `escrow.cranis2.dev` (in-container, see section 4) | Escrow uploads/exports | Self-hosted, no external dependency |
| **`poste.cranis2.com`** (planned) | Inbound mailbox for support, contact, abuse | Customer email contact | Email host account (in `OPERATIONS-SECURE`) |

GitLab integration is referenced as a planned provider but no GitLab OAuth credentials are wired in `.env` today. If/when added, it follows the same pattern.

---

## 8. Backup architecture (summary)

Full procedure: `docs/backup-retention.md`. One-paragraph summary for orientation:

Production runs `scripts/backup-databases.sh` nightly at 02:00 UTC, dumping Postgres (`cranis2` + `forgejo`) and Neo4j into `~/cranis2/backups/daily/<stamp>/`. A GFS rotation keeps 7 daily, 4 weekly (Sunday-promoted), and 12 monthly (1st-of-month-promoted) snapshots. At 03:00 UTC the dev server pulls the latest daily over a restricted SSH command channel (`scripts/serve-backup.sh` on prod, `scripts/pull-prod-backup.sh` on dev), encrypts it through `age` (X25519 + ChaCha20-Poly1305) in a single pipe so plaintext never lands on dev disk, and writes `.tar.age` ciphertext to `~/cranis2-backup-mirror/`. The dev mirror keeps its own GFS chain. The age private key lives only on dev (`~/.age/cranis2-backup.key`, perms 0400) plus paper/USB escrow described in `docs/backup-retention.md` and `06-security-and-keys.md`.

---

## 9. Scheduled tasks

All cron entries live on the production server unless marked otherwise. Inspect with `crontab -l` on each host.

| Time (UTC) | Where | What | Script |
|---|---|---|---|
| 02:00 daily | prod | Database backup + GFS promotion | `scripts/backup-databases.sh` |
| 03:00 daily | dev | Encrypted pull from prod into dev mirror | `scripts/pull-prod-backup.sh` |
| 04:00 Sundays | prod | Backup verification (round-trip restore in temp containers) | `scripts/verify-backup.sh` |
| 09:00 Mondays | prod | Key-rotation age check (warns if any key is overdue) | `scripts/check-rotation-age.sh` |
| 20:00 daily | dev | Nightly test run + Trello report | `scripts/nightly-tests.sh` |

Application-internal scheduled jobs (vulnerability scans, alert dispatch, end-of-support warnings, monthly affiliate statements, retention cleanup) are run by the backend's in-process scheduler — see `backend/src/services/scheduler.ts`. They are not cron jobs at the OS level.

---

## 10. Where things live on disk

On both environments unless noted.

| Path | Contents |
|---|---|
| `~/cranis2/` | The application git repository, the running stack |
| `~/cranis2/.env` | All operational secrets — never committed, never logged |
| `~/cranis2/backups/` | Local DB backups (prod only, by GFS tier) |
| `~/cranis2/logs/` | Backup, nightly-test, and operational logs (rotating) |
| `~/cranis2/data/snapshots/` | Compliance snapshot working area (transient, before Scaleway upload) |
| `~/cranis2-backup-mirror/` | Encrypted backup mirror (**dev only**) |
| `~/.age/cranis2-backup.key` | age private key — decrypts the backup mirror (**dev only**, perms 0400) |
| `~/.age/cranis2-backup.pub` | age public key (used to encrypt during pull) |
| `~/.ssh/cranis2_prod` | Passphraseless SSH key restricted to `serve-backup.sh` (**dev only**) |
| `~/.ssh/cranis2-prod` | Interactive admin SSH key (with passphrase) for prod |
| `/etc/nginx/` | Host nginx config (**prod only**) |
| `/etc/letsencrypt/` | TLS certificates (**prod only**, certbot-managed) |
| `~/.cloudflared/` | Cloudflare Tunnel config (**dev only**) |

---

## 11. Co-tenancy on the dev server

The dev Mac Mini also hosts other projects (ANSABASE, Archoniq). They run alongside CRANIS2 and must not interfere with it. Specifically:

- ANSABASE is sized to fit alongside CRANIS2 within the host's memory budget — see `memory.md` at the project root.
- Archoniq uses Postgres on port 5432 and Neo4j on ports 7474/7687 (the standard ports). CRANIS2's containers deliberately use different ports (5433, 7475, 7688) to avoid collision.
- Do not stop, rebuild, or `docker compose down` containers belonging to other projects.

This co-tenancy model only applies to dev. Production runs CRANIS2 and nothing else.

---

## 12. Where to read next

| If you want to know… | Read |
|---|---|
| How to log into things | `02-accounts-and-access.md` (not yet written) |
| What to check every day | `03-daily-operations.md` (not yet written) |
| How to deploy a change | `04-deployment.md` (not yet written) |
| What to do when something breaks | `05-incident-response.md` (not yet written) |
| How keys, secrets and rotation work | `06-security-and-keys.md` (not yet written), plus existing `docs/key-rotation.md` |
| How backups work in detail | `docs/backup-retention.md` |
| The original deployment plan (historical) | `docs/deployment-plan.md` |
| Design rationale (why it's built this way) | `docs/HLD.md`, `docs/LLD.md` |

---

*Last updated: 2026-05-01. If you change a port, add a service, change where a key file lives, or move a scheduled task, update this document in the same commit.*

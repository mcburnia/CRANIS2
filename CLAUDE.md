<!--
  Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi.mcburnie@gmail.com
-->

# CLAUDE.md — CRANIS2 Project Instructions

Read this file at the start of every session. It defines how to work with this project and the user's operating preferences.

---

## What is CRANIS2?

CRANIS2 is a SaaS platform that helps software organisations achieve and maintain compliance with the **EU Cyber Resilience Act (CRA)**. It tracks products, obligations, contributors, dependencies, and vulnerabilities.

**Full project context:** See `RESTART.md` for architecture, completed features, known issues, and current status.

**Editorial standard:** All content (product copy, UI text, documentation, compliance content, generated summaries, Copilot output) must follow the rules in `docs/EDITORIAL-STANDARD.md`. This is a persistent standard, not a one-off guideline.

---

## Operating Protocol

Follow these rules for every session, every task, without exception.

### 1. Propose first, then implement
Always present a clear plan of action before making any changes. Wait for the user's explicit approval before proceeding. Do not start implementation speculatively.

### 2. Commit per completed task
Create one git commit after each distinct piece of work is finished. Commit messages must have a concise subject line and a detailed body describing what changed and why — sufficient for full traceability without reading the diff.

### 3. User performs git push
Never push automatically. When a commit is ready, ask the user to run `git push origin main` in their own terminal. They will confirm when it is done.

### 4. Work on `main`
Use the `main` branch for all work unless the user explicitly requests a feature branch.

### 5. Run tests per task
At the end of every task, run unit and integration tests and report the outcome before declaring the task done.

### 6. Full regression at end of session
At the end of each development session (after all work is committed), run the full test cycle:
- Backend: `./scripts/test-stack.sh start && cd backend/tests && source ~/.nvm/nvm.sh && TEST_BASE_URL=http://localhost:3011 TEST_NEO4J_URI=bolt://localhost:7699 npx vitest run --config vitest.config.ts`
- E2E: `cd e2e && E2E_BASE_URL=http://localhost:3002 npm test`
- Stop test stack after: `./scripts/test-stack.sh stop`

**CRITICAL:** NEVER run backend tests against the dev stack (port 3001). ALWAYS use the isolated test stack (port 3011). Running against dev causes ~29 spurious failures from data collisions and wastes time debugging non-issues. The correct sequence is: start test stack → run tests → stop test stack. Use `./scripts/test-stack.sh run` for a one-command workflow.

**Expected failures (1):** 1 category-recommendation (needs Anthropic API key). Tier3 import scanning and webhook E2E tests now pass against the local Forgejo instance.

Report pass/fail totals. Fix any failures while the context is still fresh rather than leaving them for the next session.

### 7. Explicit approval for higher-risk operations
Before executing any of the following, stop and get explicit user approval:
- Infrastructure restarts (Docker, services, the host itself)
- Database migrations or schema changes
- Destructive commands (`rm -rf`, `DROP TABLE`, `git reset --hard`, etc.)
- External service changes (Stripe, Resend, GitHub OAuth, Cloudflare)
- Anything that could affect a production environment

### 8. Use British English
All communication must use British spelling and phrasing (e.g. "organise" not "organize", "colour" not "color", "licence" not "license" as a noun).

### 9. Definition of done
A task is only complete when **all** of the following are true:
- Code has been changed correctly
- Tests pass (unit, integration, and relevant E2E)
- Relevant documentation updated (RESTART.md if significant)
- Committed with a detailed message
- User has pushed to GitHub
- Deployment health verified (`/api/health` returns `200`)

### 10. Never commit `.env`
The `.env` file contains credentials. Never stage or commit it under any circumstances.

### 11. Monitor file growth
Before starting work that will add significant code to an existing file, check the largest files:

```bash
find backend/src/routes -name '*.ts' | xargs wc -l | sort -rn | head -20
find frontend/src/pages -name '*.tsx' | xargs wc -l | sort -rn | head -20
```

**Thresholds:**
- **500+ lines** — flag to the user as approaching the decomposition threshold
- **800+ lines** — propose decomposition before adding more code

**When to split:** Decompose when a file has **distinct responsibilities** (e.g. OAuth + sync + webhooks in one router). Data-driven registries and single-purpose pipelines are fine at higher line counts — size alone is not sufficient reason to split.

**How to split:** Use the established pattern — sub-directory with `index.ts` composing focused sub-routers via `router.use()`, and `shared.ts` for common middleware/helpers. See `routes/github/`, `routes/technical-file/`, and `routes/admin/` for examples.

### 12. Production safety — backup before any prod state change
Before any schema migration, compose-file edit, container recreate, or other state-affecting change on the production server (`83.228.241.168`), take a pre-upgrade backup:

```bash
./scripts/backup-databases.sh --pre-upgrade               # full
./scripts/backup-databases.sh --pre-upgrade --postgres-only  # faster, no Neo4j stop
```

Backups land in `~/cranis2/backups/pre-upgrade/<timestamp>/`, retained 30 days. Do not proceed until "BACKUP COMPLETE" is logged. The full retention scheme and recovery procedures are documented in `docs/backup-retention.md`.

### 13. Schema is single source of truth in `pool.ts initDb()`
All Postgres schema must live in `backend/src/db/pool.ts initDb()`, using idempotent guards:
- `CREATE TABLE IF NOT EXISTS …`
- `ALTER TABLE … ADD COLUMN IF NOT EXISTS …`
- `CREATE INDEX IF NOT EXISTS …`

Never apply DDL ad-hoc on the dev DB without also adding it to `initDb()` in the same commit. Otherwise dev passes tests but fresh deployments (like production) end up missing the schema. **This happened with the affiliate programme** — registration broke on prod immediately because the tables only existed on dev's hand-patched DB.

### 14. Customer-data invariant
Production updates must NEVER:
- `DROP` a column or table
- `DELETE` rows from a customer-owned table (`users`, `products`, `product_sboms`, vulnerability/finding tables, `technical_file_sections`, `obligations`, `org_billing`, `affiliate_*`, etc.)
- `TRUNCATE` data tables
- Remove a foreign key that data depends on

Schema migrations in `pool.ts` may only add or relax structure, never remove. If a removal is genuinely needed, propose it explicitly to the user with a migration plan that includes data preservation. Rule 14 is the floor — rule 7 still requires approval for anything below it; rule 14 forbids the listed actions outright.

### 15. Sensitive-output discipline
Some commands echo secrets and must never be run ungated against an environment with a populated `.env`:

- `docker compose config` — interpolates env vars; use `--no-interpolate`
- `docker exec <container> env` — pipe through a `grep -E "^NODE_ENV|^FRONTEND_URL|..."` whitelist, never raw
- `docker inspect` of any container running with secrets in its environment
- Any blanket `printenv` from inside an app container

If a secret ends up in a terminal, transcript, or log outside the prod host, treat it as compromised and add it to the rotation list. See `feedback_compose_config_secrets.md` for the incident that established this rule.

---

## Environment Notes

- **Node.js:** Available via nvm — always prefix npm/node commands with `source ~/.nvm/nvm.sh &&`
- **Build before deploying:** `source ~/.nvm/nvm.sh && npm run build` then `docker compose up -d --build`
- **Docker stack:** `cd ~/cranis2 && docker compose up -d`
- **Public URL:** `https://dev.cranis2.dev` (Cloudflare Tunnel, systemd service)
- **SSH key for GitHub:** `~/.ssh/id_ed25519` — has a passphrase; the user must run `git push` manually

## NGINX Notes

- Do **not** escape dollar signs in `nginx/default.conf` — use plain `$uri`, `$host` etc. Escaping causes redirect loops.
- API proxy uses Docker DNS (`resolver 127.0.0.11`) to re-resolve backend at request time — this prevents 502 errors after backend container recreation.

## Other Projects on This Server

- **ANSABASE** — runs concurrently. Keep both stacks within the memory budgets in `memory.md`. Do not interfere with its containers.
- **Archoniq** — uses Postgres (port 5432) and Neo4j (ports 7474/7687). Do not touch these containers.

## Test Infrastructure

Tests run against a **fully isolated test stack** — separate backend, separate Neo4j instance, separate Postgres database. This makes it structurally impossible for tests to affect live data.

### Running tests
```bash
# Start test stack (neo4j_test + backend_test on port 3011)
./scripts/test-stack.sh start

# Run tests
cd backend/tests && source ~/.nvm/nvm.sh && TEST_BASE_URL=http://localhost:3011 npx vitest run --config vitest.config.ts

# Stop test stack (frees ~900MB memory)
./scripts/test-stack.sh stop

# Or do all three in one command:
./scripts/test-stack.sh run
```

### Safety layers (defence in depth)
1. **Separate containers:** `neo4j_test` (port 7699) and `backend_test` (port 3011) only start with `--profile test`
2. **Separate database:** Postgres `cranis2_test` database (not `cranis2`)
3. **Backend startup guards:** `pool.ts` and `neo4j.ts` verify DB URLs match `CRANIS2_TEST_MODE` flag — process exits if misconfigured
4. **Test-side guards:** `test-helpers.ts`, `seed-test-data.ts`, and `clean-rate-limits.ts` all verify they connect to `cranis2_test`
5. **Port separation:** Live on 3001/7688, test on 3011/7699 — no possible overlap

### Writing new tests
- Tests connect to `cranis2_test` Postgres and `neo4j_test` graph by default via `test-helpers.ts`
- **NEVER** hardcode live database connection strings in tests
- **NEVER** run cleanup queries against the live Neo4j or Postgres databases
- Use `getAppPool()` and `getNeo4jSession()` from test-helpers — they are pre-configured for the test databases

### Expected infrastructure-dependent failures
- `category-recommendation.test.ts` (1 test) — needs real Anthropic API key
- Tier3 import scanning and webhook E2E tests now pass against the local Forgejo instance

## Port Map

| Service | Port |
|---|---|
| CRANIS2 frontend (nginx) | 3002 |
| CRANIS2 backend | 3001 |
| CRANIS2 backend (test) | 3011 |
| CRANIS2 Postgres | 5433 |
| CRANIS2 Neo4j HTTP | 7475 |
| CRANIS2 Neo4j Bolt | 7688 |
| CRANIS2 Neo4j test HTTP | 7476 |
| CRANIS2 Neo4j test Bolt | 7699 |
| CRANIS2 Forgejo | 3003 |

# CLAUDE.md — CRANIS2 Project Instructions

Read this file at the start of every session. It defines how to work with this project and the user's operating preferences.

---

## What is CRANIS2?

CRANIS2 is a SaaS platform that helps software organisations achieve and maintain compliance with the **EU Cyber Resilience Act (CRA)**. It tracks products, obligations, contributors, dependencies, and vulnerabilities.

**Full project context:** See `RESTART.md` for architecture, completed features, known issues, and current status.

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
- Backend: `cd backend/tests && source ~/.nvm/nvm.sh && TEST_BASE_URL=http://localhost:3011 npx vitest run --config vitest.config.ts`
- E2E: `cd e2e && E2E_BASE_URL=http://localhost:3002 npm test`

**Important:** Backend tests MUST target the isolated test stack on port 3011 (not the live backend on 3001 or 3002). Start the test stack first with `./scripts/test-stack.sh start` and stop it after with `./scripts/test-stack.sh stop`.

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
These tests require real external services (Forgejo, Anthropic API) and are expected to fail in the isolated test stack:
- `tier3-import-scanning.test.ts` (13 tests) — needs Forgejo repo access
- `webhook-e2e.test.ts` B5/B6 (2 tests) — needs Forgejo push round-trip
- `category-recommendation.test.ts` (1 test) — needs real Anthropic API key

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

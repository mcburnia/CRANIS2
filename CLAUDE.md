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

### 6. Full morning regression at session start
At the start of each new session (before any new work), run the full test cycle:
- Backend: `cd backend/tests && TEST_BASE_URL=http://localhost:3002 npx vitest run --config vitest.config.ts`
- E2E: `cd e2e && E2E_BASE_URL=http://localhost:3002 npm test`

Report pass/fail totals. Only proceed with new work once the baseline is confirmed clean (or known failures are documented).

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

## Port Map

| Service | Port |
|---|---|
| CRANIS2 frontend (nginx) | 3002 |
| CRANIS2 backend | 3001 |
| CRANIS2 Postgres | 5433 |
| CRANIS2 Neo4j HTTP | 7475 |
| CRANIS2 Neo4j Bolt | 7688 |
| CRANIS2 Forgejo | 3003 |

# CRANIS2 — Software Development Lifecycle (SDLC)

**Document Version:** 1.0
**Last Updated:** 2026-02-28
**Author:** Andi McBurnie, Loman Cavendish Ltd
**CRA Reference:** Annex VII Par. 2(a) — Design & Development Process

---

## 1. Overview

CRANIS2 follows a continuous delivery model with AI-assisted development. The platform is developed as a monolithic full-stack application (React + Express + TypeScript) deployed as Docker containers on a single server, with public access via Cloudflare Tunnel.

The development lifecycle prioritises:
- **Rapid iteration** with comprehensive automated testing
- **Security-first** development with adversarial test coverage
- **Continuous deployment** with zero-downtime container recreation
- **Full traceability** via git commit history and audit logging

---

## 2. Development Environment

### 2.1 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + TypeScript | React 19.2, TypeScript 5.9 |
| Build Tool | Vite | 6.x |
| Backend | Express + TypeScript (ESM) | Express 5, Node.js 22 |
| Relational DB | PostgreSQL | 16 (Alpine) |
| Graph DB | Neo4j | 5 Community |
| Escrow | Forgejo (self-hosted) | 10.x |
| Reverse Proxy | NGINX | Alpine |
| Containerisation | Docker + Docker Compose | Latest |
| Public Access | Cloudflare Tunnel | Latest |
| Email | Resend API | — |
| Billing | Stripe API | — |
| Icons | Lucide React | — |
| Charts | Recharts | 3.7 |

### 2.2 Development Tools

| Tool | Purpose |
|------|---------|
| Claude Code (AI) | AI-assisted development — planning, code generation, testing, debugging |
| Claude CoWork (AI) | Browser-based UI testing and compliance data entry |
| Git + GitHub | Version control and remote repository |
| SSH Tunnel | Secure access to development server |
| Docker Compose | Local and production container orchestration |
| Vitest | Automated test framework |
| ESLint | Frontend code linting |

### 2.3 Server Environment

- **Hardware:** Intel i5-2520M, 3.8GB RAM
- **OS:** Linux (Debian-based)
- **Network:** Behind 5G CGNAT, exposed via Cloudflare Tunnel
- **Domain:** cranis2.dev (Cloudflare DNS)
- **Public URLs:** `https://dev.cranis2.dev` (application), `https://escrow.cranis2.dev` (escrow)

---

## 3. Development Workflow

### 3.1 Feature Development Process

```
1. REQUIREMENTS
   └─> Feature defined by product owner
   └─> Claude Code plan mode used for architectural decisions
   └─> Implementation approach reviewed before coding begins

2. IMPLEMENTATION
   └─> Code written in TypeScript (strict mode, ESM)
   └─> Backend: Express routes, services, middleware
   └─> Frontend: React components, pages, CSS modules
   └─> AI-assisted development via Claude Code

3. TESTING
   └─> Automated tests written alongside feature code
   └─> Full test suite run (788 tests must pass)
   └─> Browser-based testing via CoWork for UI changes

4. BUILD
   └─> Frontend: `npm run build` (Vite — content-hashed assets)
   └─> Backend: `tsc` (TypeScript to ESM JavaScript)

5. DEPLOY
   └─> `docker compose up -d --build`
   └─> Zero-downtime container recreation
   └─> NGINX restart if backend IP changes

6. VERIFY
   └─> Full test suite re-run against live deployment
   └─> Manual spot-checks or CoWork UI verification
   └─> Monitor backend logs for errors

7. COMMIT & PUSH
   └─> Changes committed with descriptive messages
   └─> Pushed to GitHub (origin/main)
   └─> Escrow auto-deposits at 5 AM UTC daily
```

### 3.2 Branching Strategy

Development follows a **trunk-based** model:
- All work is done on the `main` branch
- No feature branches or pull request workflow (single developer)
- Commits are atomic and descriptive (e.g., `feat:`, `fix:`, `test:`, `refactor:`)
- Git history serves as the audit trail for all changes

### 3.3 Code Review

- AI-assisted review via Claude Code during development
- No formal peer review process (single developer)
- CoWork browser-based testing provides UX verification
- Security tests provide automated vulnerability checking

---

## 4. Build Pipeline

### 4.1 Frontend Build

```bash
cd frontend && npm run build
```

- **Tool:** Vite 6 with React plugin
- **Input:** TypeScript + TSX source files in `frontend/src/`
- **Output:** Static assets in `frontend/dist/` with content-hashed filenames
- **Optimisation:** Tree-shaking, minification, gzip compression via NGINX
- **Caching:** Static assets cached for 1 year (`Cache-Control: public, immutable`); `index.html` never cached (`no-cache, no-store, must-revalidate`)

### 4.2 Backend Build

Multi-stage Docker build:

```
Stage 1 (builder):
  - Base: node:22-alpine
  - Install all dependencies (npm ci)
  - Compile TypeScript to JavaScript (npx tsc)

Stage 2 (production):
  - Base: node:22-alpine
  - Install production dependencies only (npm ci --omit=dev)
  - Copy compiled JavaScript from builder stage
  - Runtime: node --max-old-space-size=3072 dist/index.js
```

- **TypeScript Config:** ES2022 target, ESNext modules, strict mode, bundler module resolution
- **Additional packages:** `unzip` and `xz` (Alpine) for SBOM archive handling and escrow operations

### 4.3 Container Orchestration

Docker Compose manages 6 production services:

| Service | Image | Memory Limit | Health Check |
|---------|-------|-------------|-------------|
| NGINX | nginx:alpine | 64MB | — |
| Backend | Custom (Node 22) | 256MB | — |
| PostgreSQL | postgres:16-alpine | 512MB | `pg_isready` |
| Neo4j | neo4j:5-community | 512MB | `wget localhost:7474` |
| Forgejo | forgejo:10 | 256MB | — |
| Test Runner | Custom | 512MB | — |

All services communicate via the `cranis2_net` Docker bridge network. Backend waits for Postgres and Neo4j health checks before starting.

---

## 5. Testing Strategy

### 5.1 Test Framework

- **Framework:** Vitest (TypeScript-native, ESM-compatible)
- **Execution:** Sequential test suites (`fileParallelism: false`) to prevent data conflicts
- **Target:** Live development server at `https://dev.cranis2.dev`
- **Timeouts:** 30s per test, 60s per hook
- **Output:** JSON results exported for the test-runner dashboard

### 5.2 Test Categories

| Category | Files | Tests | Coverage |
|----------|-------|-------|----------|
| Route Tests | 21 | 350 | All API endpoints — CRUD, auth, validation, error handling |
| Security Tests | 6 | 150 | XSS injection, SQL injection, CSRF, auth bypass, rate limiting, session expiry |
| Break/Adversarial Tests | 9 | 188 | Oversized inputs, rapid double-submit, browser state, empty states, edge cases |
| Webhook Tests | 3 | 39 | GitHub, Codeberg/Forgejo, Stripe webhook signature verification and processing |
| Integration Tests | 7 | 102 | E2E Tier 3 import scanning, PAT auth flows, cross-service workflows |
| **Total** | **46** | **829** | |

Additionally:
- **SBOM Parser Unit Tests:** 713 tests (236 lockfile + 416 language + 61 SBOM mock)
- **CoWork UI Tests:** 23 manual scripts (4 smoke, 12 acceptance, 7 break)

### 5.3 Test Execution

```bash
# Run full programmatic test suite
cd ~/cranis2/backend/tests
source ~/.nvm/nvm.sh
node_modules/.bin/vitest run --config vitest.config.ts

# Run specific test file
node_modules/.bin/vitest run --config vitest.config.ts routes/auth.test.ts

# CoWork UI tests
# Executed via Claude CoWork browser agent with prompt scripts
```

### 5.4 Test Data Management

- **Seed data:** 6 organisations, 15 users, 13 products across all 5 providers
- **Deterministic UUIDs:** Defined in `seed-test-data.ts` for reproducible tests
- **Test database:** `cranis2_test` in Postgres for test metadata tracking
- **Cleanup:** Tests create and clean up their own data; seed data is idempotent

### 5.5 Security Testing Coverage

| Attack Vector | Test Method | Test Count |
|--------------|------------|-----------|
| XSS Injection | Script tags, SVG onload, img onerror, javascript: URIs, template injection in all input fields | 30+ |
| SQL Injection | DROP TABLE, UNION SELECT, comment-based injection across all text inputs | 20+ |
| Authentication Bypass | Invalid tokens, expired sessions, missing auth headers, cross-org access | 40+ |
| Authorisation Escalation | Member accessing admin routes, cross-org data access, billing tier violations | 30+ |
| Input Validation | Oversized strings, special characters, empty required fields, invalid formats | 50+ |
| Race Conditions | Rapid double-submit on all action buttons, concurrent form submissions | 10+ |
| Session Management | Token expiry, forced logout, browser back/forward after logout | 10+ |

---

## 6. Deployment Process

### 6.1 Deployment Steps

```bash
# 1. Build frontend (generates content-hashed static assets)
cd ~/cranis2/frontend && source ~/.nvm/nvm.sh && npm run build

# 2. Deploy all containers (rebuilds backend, restarts services)
cd ~/cranis2 && docker compose up -d --build

# 3. Verify backend started cleanly
docker logs cranis2_backend

# 4. Restart NGINX if backend container IP changed
docker restart cranis2_nginx

# 5. Run full test suite to verify deployment
cd ~/cranis2/backend/tests
source ~/.nvm/nvm.sh
node_modules/.bin/vitest run --config vitest.config.ts
```

### 6.2 Deployment Characteristics

- **Strategy:** Rolling replacement (Docker container recreation)
- **Downtime:** Minimal (seconds during container restart)
- **Rollback:** `git revert` + redeploy, or `docker compose up -d` with previous image
- **Environments:** Single environment (development/production combined)
- **Frequency:** Multiple times per day during active development

### 6.3 Infrastructure as Code

All infrastructure is defined in version-controlled files:
- `docker-compose.yml` — Container orchestration
- `backend/Dockerfile` — Backend build
- `nginx/default.conf` — Reverse proxy configuration
- `frontend/vite.config.ts` — Frontend build configuration
- `backend/tsconfig.json` — TypeScript compilation

Cloudflare Tunnel configuration (`~/.cloudflared/config.yml`) is maintained on the server outside the repository.

---

## 7. Secrets Management

### 7.1 Current Approach

Secrets are stored in a flat `.env` file at the repository root, excluded from version control via `.gitignore`. Docker Compose injects these as environment variables into the backend container.

### 7.2 Secret Categories

| Category | Variables | Count |
|----------|----------|-------|
| Database | POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, NEO4J_USER, NEO4J_PASSWORD | 5 |
| Authentication | JWT_SECRET, GITHUB_ENCRYPTION_KEY | 2 |
| OAuth | GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, CODEBERG_CLIENT_ID, CODEBERG_CLIENT_SECRET | 4 |
| Webhooks | GITHUB_WEBHOOK_SECRET, CODEBERG_WEBHOOK_SECRET, STRIPE_WEBHOOK_SECRET | 3 |
| Billing | STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY, STRIPE_PRODUCT_ID, STRIPE_PRICE_ID | 4 |
| Email | RESEND_API_KEY, EMAIL_FROM | 2 |
| Escrow | FORGEJO_ADMIN_TOKEN, FORGEJO_URL | 2 |
| Application | FRONTEND_URL, DEV_SKIP_EMAIL | 2 |

### 7.3 Planned Improvements

- Migration to a secrets manager (e.g., HashiCorp Vault or cloud-native solution) before production deployment
- Environment-specific configuration files (development, staging, production)
- Secret rotation policy and automated key management

---

## 8. Monitoring and Operations

### 8.1 Scheduled Jobs

The backend scheduler runs automated maintenance tasks:

| Time (UTC) | Job | Description |
|-----------|-----|------------|
| 1:00 AM | Vulnerability DB Sync | Fetches latest CVEs from OSV and NVD databases |
| 2:00 AM | SBOM Auto-Sync | Re-syncs stale SBOMs, triggers license scan and IP proof |
| 3:00 AM | Platform Vulnerability Scan | Matches dependencies against vulnerability database |
| 4:00 AM | Billing Checks | Trial expiry warnings and payment grace period enforcement |
| 5:00 AM | Escrow Deposits | Automated source code deposits to Forgejo for all enabled products |
| Hourly | CRA Deadline Checks | Monitors approaching CRA reporting deadlines |

### 8.2 Logging

- **Application logs:** Docker container stdout/stderr, accessible via `docker logs <container>`
- **Audit trail:** `user_events` table in Postgres records compliance-significant actions
- **Webhook logs:** All inbound webhook deliveries logged with provider, event type, and processing result
- **Test results:** JSON reports exported to `test-results.json` and displayed on admin dashboard

### 8.3 Health Monitoring

- **Database health:** Docker healthcheck on Postgres (`pg_isready`) and Neo4j (`wget localhost:7474`)
- **Container restarts:** All services configured with `restart: unless-stopped`
- **Memory limits:** Per-container memory caps prevent resource exhaustion
- **External monitoring:** Cloudflare provides uptime monitoring, DDoS protection, and traffic analytics

---

## 9. Security Practices

### 9.1 Secure Coding Standards

- **TypeScript strict mode** enforced across the entire codebase
- **Parameterised queries** for all database operations (PostgreSQL `pg` library and Neo4j driver)
- **Input validation** on all API endpoints before processing
- **JWT authentication** with expiring session tokens
- **bcrypt** password hashing with salt rounds
- **CORS** restricted to known frontend origin
- **CSP headers** configured via NGINX
- **No sensitive data** in URL parameters, logs, or error responses

### 9.2 Dependency Management

- **SBOM generation:** CRANIS2 generates its own SBOM from its GitHub repository
- **Vulnerability scanning:** Daily automated scans against OSV and NVD databases
- **Lock files:** `package-lock.json` committed for reproducible builds
- **Production isolation:** `npm ci --omit=dev` ensures only production dependencies in containers
- **Multi-stage builds:** Build tooling never present in production images

### 9.3 Access Control

- **Server access:** SSH key-based authentication only
- **Database access:** Internal Docker network only (not exposed to public)
- **API authentication:** JWT Bearer tokens required on all authenticated routes
- **Role-based access:** member, admin, platform_admin with per-route middleware
- **Billing gates:** Global middleware blocks write operations for read-only/suspended/cancelled accounts
- **Org isolation:** All data queries scoped to the authenticated user's organisation

---

## 10. Change Management

### 10.1 Commit Convention

Commits follow a conventional format:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feat:` | New feature | `feat: PAT-based auth for self-hosted providers` |
| `fix:` | Bug fix | `fix: Invalid Date for last sync on Repos page` |
| `test:` | Test additions/changes | `test: add 24 E2E Tier 3 import scanning tests` |
| `refactor:` | Code restructuring | `refactor: modular SBOM generation pipeline` |
| `docs:` | Documentation | `docs: update SDLC documentation` |

### 10.2 Release Versioning

CRANIS2 uses date-based semantic versioning: `YYYY.MM.DD.NNNN`

- **YYYY.MM.DD:** Date of release
- **NNNN:** Sequential build number for that date
- Example: `2026.02.25.0001`

### 10.3 Traceability

Every change is traceable through:
1. **Git commit history** — who, when, what, why
2. **Audit log** — user actions within the platform (`/audit-log`)
3. **User events** — all significant API actions recorded in Postgres
4. **Compliance timeline** — per-product history of compliance events
5. **Escrow deposits** — daily snapshots of source code in Forgejo

---

## 11. Disaster Recovery

### 11.1 Backup Strategy

| Data Store | Backup Method | Frequency |
|-----------|--------------|-----------|
| PostgreSQL | Docker volume persistence | Continuous (on disk) |
| Neo4j | Docker volume persistence | Continuous (on disk) |
| Source Code | GitHub (primary), Forgejo escrow (daily) | Every push + daily |
| Configuration | Git repository (docker-compose.yml, Dockerfile, nginx.conf) | Every commit |
| Secrets | `.env` file on server | Manual backup |

### 11.2 Recovery Procedure

1. **Code recovery:** Clone from GitHub or restore from Forgejo escrow
2. **Infrastructure recovery:** `docker compose up -d --build` recreates all containers
3. **Database recovery:** Restore Postgres and Neo4j Docker volumes from backup
4. **DNS recovery:** Cloudflare Tunnel reconnects automatically on server restart

### 11.3 Planned Improvements

- Automated PostgreSQL backups with `pg_dump` to external storage
- Neo4j automated backups via `neo4j-admin dump`
- Off-site backup replication
- Recovery time objective (RTO) and recovery point objective (RPO) documentation

---

## 12. Compliance Integration

The SDLC is designed to produce the evidence required by the CRA:

| CRA Requirement | SDLC Evidence |
|----------------|---------------|
| Annex VII Par. 2(a) — Design & development | This document, HLD.md, architecture in technical files |
| Annex VII Par. 2(b) — Vulnerability handling | Daily vuln scanning, ENISA reporting workflow, security update policy |
| Annex VII Par. 3 — Risk assessment | Threat model, 13 Annex I requirements addressed in technical file |
| Annex VII Par. 6 — Test reports | 788+ automated tests, 713 parser tests, 23 UI tests |
| Article 13(6) — Vulnerability handling | Automated scanning, security update within 24 hours |
| Article 13(11) — SBOM | Auto-generated from source repository |
| Article 13(12) — Technical documentation | Technical file maintained within CRANIS2 platform |
| Article 14 — Vulnerability reporting | ENISA reporting workflow with 24-hour initial notification |

---

*This document is maintained as part of the CRANIS2 technical file and is subject to review upon significant changes to the development process.*

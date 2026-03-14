# CRANIS2 Daily Restart Prompt

**Read this file at the start of every new Claude Code session.**

This document ensures continuity between sessions. Claude Code has no memory of previous conversations. This file, combined with the codebase itself, is the single source of truth.

---

## What is CRANIS2?

CRANIS2 is a SaaS platform that helps software organisations achieve and maintain compliance with the **EU Cyber Resilience Act (CRA)**. It tracks products, obligations, contributors, dependencies, and vulnerabilities.

## Project Owner

- **User:** mcburnia (Andi McBurnie)
- **GitHub:** https://github.com/mcburnia/CRANIS2

## Server Access

- **Server:** Mac Mini running Ubuntu Linux
- **SSH (direct):** `ssh mcburnia@10.0.0.122` (only works from user's own terminal)
- **SSH (Claude Code):** `ssh -p 2222 mcburnia@localhost` (via SSH tunnel — see below)
- **Project path:** `~/cranis2/`
- **Public URL:** `https://dev.cranis2.dev` (via Cloudflare Tunnel)
- **Node.js:** Available via nvm — always prefix commands with `source ~/.nvm/nvm.sh &&`
- **SSH key for GitHub:** `~/.ssh/id_ed25519` (has passphrase — user must run `git push` manually)
- **Cloudflare Tunnel:** `cloudflared` running as systemd service (`cloudflared.service`), config at `~/.cloudflared/config.yml`

### SSH Tunnel Workaround (IMPORTANT)

Claude Code's CLI binary has a macOS bug where it cannot access local network devices directly (missing Info.plist prevents TCC Local Network permission from working). See `learning.md` for full details.

**Before starting any session, the user must run these commands in their own terminal (not Claude Code):**

```bash
# Terminal tab 1: Start SSH tunnel (keep running)
ssh -N -L 2222:localhost:22 mcburnia@192.168.1.107

# Terminal tab 2: Load SSH key
ssh-add ~/.ssh/id_ed25519
```

**Claude Code then uses the tunnel for all server access:**
```bash
# SSH commands
ssh -p 2222 mcburnia@localhost 'command here'

# SCP file transfers
scp -P 2222 localfile mcburnia@localhost:~/cranis2/path/
```

**If the tunnel dies**, the user needs to restart it in their terminal. If `bind [127.0.0.1]:2222: Address already in use` appears, the tunnel is already running.

## Step 1: Connect and Verify Server

**Ensure the SSH tunnel is running first** (see Server Access section above).

```bash
ssh -p 2222 mcburnia@localhost "echo 'Connected' && hostname && uname -a"
```

## Step 2: Check Docker Containers + Memory Profile

Core CRANIS2 services must be running (`test-runner` is optional unless running regression tests):

```bash
ssh -p 2222 mcburnia@localhost "docker ps --filter name=cranis2 --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
```

Expected containers:

| Container | Image | Port | Purpose |
|-----------|-------|------|---------|
| cranis2_nginx | nginx:alpine | 3002 → 80 | Serves React build + reverse proxy to API |
| cranis2_backend | cranis2-backend | 3001 → 3001 | Express API server |
| cranis2_postgres | postgres:16-alpine | 5433 → 5432 | Application database (users, auth, GitHub connections) |
| cranis2_neo4j | neo4j:5-community | 7475 → 7474, 7688 → 7687 | Graph database (organisations, products, contributors, dependencies) |
| cranis2_forgejo | codeberg.org/forgejo/forgejo:10 | 3003 → 3000 | Source code escrow (EU-hosted, Forgejo git server) |
| cranis2_welcome | cranis2-welcome | 3004 → 3004 | Welcome site + public assessment tools (Express) |
| cranis2_test_runner (optional) | cranis2_test-runner | none | Morning regression harness container |

If containers are down, start them:

```bash
ssh -p 2222 mcburnia@localhost "cd ~/cranis2 && docker compose up -d"
```

Current CRANIS2 memory profile (for 16 GB host) is:

| Service | Limit |
|---------|-------|
| nginx | 64M |
| backend | 768M |
| test-runner | 512M |
| postgres | 1G |
| neo4j | 1536M |
| forgejo | 384M |

Backend process is hard-capped at Node V8 heap `512 MB` (`--max-old-space-size=512`) to prevent container OOM kills.

Quick check commands:
```bash
# Limit configuration from compose
ssh -p 2222 mcburnia@localhost "cd ~/cranis2 && docker compose config | rg -n 'memory:|--max-old-space-size'"

# Live memory usage snapshot
ssh -p 2222 mcburnia@localhost "docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}'"
```

For full shared-host guidance (CRANIS2 + ANSABASE) see `memory.md`.

## Step 3: Sync Code from GitHub

The server may have been restarted overnight. Always pull latest:

```bash
ssh -p 2222 mcburnia@localhost "cd ~/cranis2 && git pull origin main"
```

**Note:** If git pull fails with SSH permission errors, the user needs to run:
```bash
eval $(ssh-agent -s) && ssh-add ~/.ssh/id_ed25519
git pull origin main
```

## Step 4: Rebuild (if needed)

If code was pulled or changes were made:

```bash
# Rebuild frontend
ssh -p 2222 mcburnia@localhost "source ~/.nvm/nvm.sh && cd ~/cranis2/frontend && npm install && npm run build"

# Rebuild and restart all services
ssh -p 2222 mcburnia@localhost "cd ~/cranis2 && docker compose up -d --build && docker compose restart nginx"
```

Note: backend starts with `node --max-old-space-size=512 dist/index.js` (defined in `backend/Dockerfile`).

## Step 5: Verify the App

```bash
ssh -p 2222 mcburnia@localhost "curl -s -o /dev/null -w '%{http_code}' http://localhost:3002 && echo '' && curl -s http://localhost:3002/api/health"
```

Should return `200` and `{"status":"ok"}`. The app is accessible at:
- **Local:** `http://192.168.1.107:3002`
- **Public:** `https://dev.cranis2.dev` (via Cloudflare Tunnel)

---

## Step 6: Test Cycle

### Nightly Automated Tests (runs at 22:00 CEST)

A cron job runs the full backend test suite every evening:

```bash
# Cron: 0 20 * * * /home/mcburnia/cranis2/scripts/nightly-tests.sh
# Check last night's results:
tail -20 ~/cranis2/logs/nightly-tests-$(date '+%Y-%m-%d').log
```

- Pre-flight health check (aborts if backend is down)
- Logs to `logs/nightly-tests-YYYY-MM-DD.log` (14-day retention)
- Summary with pass/fail counts and failed test names
- Trello notification: posts a card to the "Test Results" board (passed/failed lists) after each run

### Manual Backend Tests (~1,395 tests — runs on server)

**CRITICAL: Always use the isolated test stack, never the dev stack.**

```bash
# One-command workflow (start test stack → run tests → stop test stack):
./scripts/test-stack.sh run

# Or manually:
./scripts/test-stack.sh start
cd ~/cranis2/backend/tests && source ~/.nvm/nvm.sh && TEST_BASE_URL=http://localhost:3011 TEST_NEO4J_URI=bolt://localhost:7699 npx vitest run --config vitest.config.ts
./scripts/test-stack.sh stop
```

- `globalSetup` seeds data once + cleans stale rate-limit/billing rows
- Tests target localhost:3011 (isolated test stack — NOT port 3001)
- Single Cloudflare smoke test in `integration/cloudflare-tunnel.test.ts`
- Deterministic test IDs for idempotent seeding
- Expected result: **~1,379 passed, 16 expected infra-dependent failures** (81 test files)
- Expected failures: tier3-import-scanning (13, needs Forgejo), webhook-e2e B5/B6 (2, needs Forgejo), category-recommendation (1, needs Anthropic API)

### Playwright E2E Tests (~280 tests — runs locally on Mac)

```bash
cd ~/CRANIS2/e2e && npm test
```

- Requires SSH tunnel running (for Postgres push if using `npm run test:push`)
- Tests run against https://dev.cranis2.dev via Chromium
- Expected result: **~280 passed**

### Push Results to Admin Dashboard (optional)

```bash
# Requires Postgres SSH tunnel: ssh -N -L 5433:localhost:5433 -p 2222 mcburnia@localhost
cd ~/CRANIS2/e2e && npm run push-results
```

### Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Mass 404 failures in Vitest | Seed data missing from Neo4j | Auto-seeding should prevent this. Manual fix: `cd ~/cranis2/backend/tests && source ~/.nvm/nvm.sh && npx tsx setup/seed-test-data.ts` |
| 429 rate-limit errors on copilot tests | Stale copilot_usage rows from previous runs | `clean-rate-limits.ts` in globalSetup handles this automatically |
| Copilot plan-gating tests fail (expect 403, get 200) | Another test file upgraded billing plan to pro | `public-api-v1.test.ts` afterAll restores plans; globalSetup also resets |
| SSH connection refused | Tunnel not running | User must start: `ssh -N -L 2222:localhost:22 mcburnia@10.0.0.122` |
| Docker containers down | Server restarted | `ssh -p 2222 mcburnia@localhost "cd ~/cranis2 && docker compose up -d"` |
| E2E auth failures | Storage state expired | Delete `e2e/auth/` and re-run (setup tests regenerate it) |


## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 19 + TypeScript | Vite build tool |
| Styling | Plain CSS + CSS custom properties | Mobile-first, responsive |
| Routing | React Router v7 | Layout-based (public vs authenticated) |
| Icons | lucide-react | Replaces emoji icons from prototypes |
| Web server | NGINX (Docker) | Serves static React build + reverse proxy to API |
| Backend | Express (Node.js/TypeScript) | API server in Docker, port 3001 |
| Email | Resend | Verification emails from info@cranis2.com (or poste.cranis2.com) |
| Auth | bcrypt + JWT | Password hashing (12 rounds) + session tokens (7-day expiry) |
| Database | PostgreSQL 16 | Port 5433, users + user_events + github_connections tables |
| Graph DB | Neo4j 5 Community | Ports 7475/7688, Organisation + Product + GitHubRepo + Contributor nodes |
| Containerisation | Docker Compose | All services in cranis2_net network |

## Technical Mandates

1. **Mobile-first responsive design** — must work on smartphones, tablets, and desktops
2. **React with HTML5/CSS3 output** — no CSS-in-JS frameworks
3. **NGINX serving production builds** — dev environment mirrors production (Infomaniak, Switzerland)

## Architecture: Postgres vs Neo4j

**Postgres** (relational data):
- Users, authentication, sessions
- User events (passive telemetry — logins, page views, actions)
- GitHub connections (encrypted OAuth tokens)
- Billing, subscriptions (future)

**Neo4j** (graph data — supply chain relationships):
- Organisation nodes (name, country, size, CRA role, industry)
- Product nodes (name, version, category, description, repoUrl, distributionModel, lifecycle status)
- GitHubRepo nodes (owner, name, description, stars, forks, language, visibility)
- Contributor nodes (githubLogin, avatarUrl, contributions count)
- Relationships: (Organisation)-[:BELONGS_TO]-(Product), (Product)-[:HAS_REPO]->(GitHubRepo), (GitHubRepo)-[:HAS_CONTRIBUTOR]->(Contributor)
- Dependency nodes + DEPENDS_ON relationships (live — from SBOM sync)
- Vulnerability findings tracked in Postgres (vulnerability_findings + vulnerability_scans tables)
- Supply chain traversal queries (e.g. "which products are affected by this CVE through any depth of dependency?")

## Project Structure

```
~/cranis2/
  RESTART.md              ← This file
  memory.md               ← Memory/oom runbook (shared dev server profile)
  docker-compose.yml      ← Docker services (NGINX, Backend, Postgres, Neo4j)
  .env                    ← Credentials (NOT in git)
  .gitignore
  nginx/
    default.conf           ← NGINX config (SPA routing, API proxy, gzip, caching)
  docs/
    HLD.md                 ← High Level Design
    LLD.md                 ← Low Level Design
    Cranis2 Epics.csv      ← Project epics
    Stories-and-spikes.csv ← User stories and spikes
    USB-STORAGE-SETUP.md   ← External SSD mount + backup workflow (non-destructive)
  scripts/
    usb-storage-init.sh
    usb-storage-sync-artifacts.sh
  welcome/                 ← Welcome site + public assessment tools (Express, port 3004)
    server.js              ← Express server: landing, contact form, CRA assessment, shared subscribe/unsubscribe
    nis2-assessment.js     ← NIS2 Readiness Assessment module (25 questions, entity classification, scoring)
    public/index.html      ← Welcome/landing page HTML
    Dockerfile             ← Node.js container for welcome site
  public/                  ← Original HTML prototypes (reference only)
  backend/                 ← Express API service
    Dockerfile             ← Multi-stage build (builder for TS compile, production for runtime)
    src/
      index.ts             ← Express server entry (port 3001), inits Postgres + Neo4j, mounts all routes
      routes/
        auth.ts            ← POST /register, POST /login, GET /verify-email, GET /me
        org.ts             ← POST /org (create org), GET /org (get org), PUT /org (update org)
        products.ts        ← Full CRUD for products (Neo4j nodes linked to Organisation)
        github/            ← GitHub/Codeberg integration (decomposed)
          index.ts         ← Composes sub-routers
          shared.ts        ← requireAuth middleware, in-memory token stores
          oauth.ts         ← OAuth/PAT connection, status, disconnect
          sync.ts          ← Repo sync, SBOM, versions, history, push events, repo data
          webhook.ts       ← Push webhook handler (HMAC-verified)
        technical-file/    ← CRA Annex VII technical file (decomposed)
          index.ts         ← Composes sub-routers
          shared.ts        ← Auth, helpers, DEFAULT_SECTIONS data
          sections.ts      ← CRUD routes, suggestions, progress
          doc-pdf.ts       ← EU Declaration of Conformity PDF generator
          cvd-pdf.ts       ← CVD Policy PDF generator
        audit.ts           ← GET /audit/events (paginated audit log)
        dashboard.ts       ← GET /dashboard (aggregate stats with vulnerability data)
        stakeholders.ts    ← GET/PUT stakeholders (org + product CRA contacts)
        technical-files-overview.ts ← GET /technical-files/overview (cross-product compliance)
        obligations.ts     ← GET/PUT obligations (cross-product status tracker)
        repos-overview.ts  ← GET /repos/overview (cross-product repo summary)
        contributors-overview.ts ← GET /contributors/overview
        dependencies-overview.ts ← GET /dependencies/overview (+ license analysis)
        risk-findings.ts   ← Vulnerability scanning + findings CRUD (5 endpoints)
        admin/             ← Platform admin endpoints (decomposed into 8 modules)
          index.ts         ← Composes sub-routers
          dashboard.ts, orgs.ts, users.ts, audit-log.ts, system.ts, vuln-scan.ts, copilot.ts, utils.ts
        docs.ts            ← Public + admin documentation page CRUD
        dev.ts             ← Dev-only routes (nuke button — MUST REMOVE BEFORE PRODUCTION)
marketplace.ts     ← Marketplace endpoints (listings, profile, contact, admin)
      db/
        pool.ts            ← Postgres pool + schema init (all tables including vuln_db_* and CPE index)
        neo4j.ts           ← Neo4j driver + graph schema init (constraints/indexes)
        schema.sql         ← Users table DDL (reference)
      services/
        email.ts           ← Resend email integration (verification + invite emails)
        telemetry.ts       ← Passive telemetry — dual-write to Postgres + Neo4j
        github.ts          ← GitHub API client (READ-ONLY — GET requests + SBOM + releases/tags)
        scheduler.ts       ← Daily scheduler (vuln DB sync 1 AM, SBOM sync 2 AM, vuln scan 3 AM)
        vulnerability-scanner.ts ← Platform-wide CVE scanner (local Postgres DB with CPE matching, deduplication)
        vuln-db-sync.ts    ← Local vulnerability database sync (OSV.dev + NVD feeds → Postgres, CPE index rebuild)
marketplace.ts     ← Compliance badge computation for marketplace profiles
        license-compatibility.ts ← License compatibility rules engine (distribution model + FSF conflicts)
      middleware/
        requirePlatformAdmin.ts ← Platform admin auth middleware (JWT + DB check)
      utils/
        password.ts        ← bcrypt hashing (12 salt rounds)
        token.ts           ← JWT generation/verification + email verification tokens
        encryption.ts      ← AES-256-GCM encrypt/decrypt for GitHub OAuth tokens
  frontend/                ← React application
    index.html
    package.json
    vite.config.ts
    src/
      main.tsx             ← React entry point
      App.tsx              ← RouterProvider wrapper
      index.css            ← Global CSS (design system variables + utilities)
      router.tsx           ← All route definitions with RootLayout
      hooks/
        useNotifications.ts <- Unread notification count polling (60s interval)
      context/
        AuthContext.tsx     ← Auth state (user + orgId), login/logout/refreshUser, session check
      layouts/
        RootLayout.tsx     ← Wraps AuthProvider around all routes
        PublicLayout.tsx    ← No sidebar (landing, login, signup)
        AuthenticatedLayout.tsx ← Sidebar + auth guard + org guard
        AdminLayout.tsx    ← Admin panel layout (purple accent, admin sidebar, redirects non-admins)
      components/
        Sidebar.tsx        ← Navigation with lucide-react icons (5 sections)
        PageHeader.tsx     ← Page title + timestamp
        StatCard.tsx       ← Metric display card
      pages/
        public/            ← LandingPage, LoginPage, SignupPage, CheckEmailPage, VerifyEmailPage, AcceptInvitePage, MarketplacePage, MarketplaceDetailPage, DocsPage
        setup/             ← WelcomePage, OrgSetupPage (wizard with CRA role selection)
        dashboard/         ← DashboardPage (fully migrated)
        products/          ← ProductsPage (list + add modal), ProductDetailPage (tabs + GitHub UI)
        compliance/        ← ObligationsPage (live), TechnicalFilesPage (live)
        repositories/      ← ReposPage (live), ContributorsPage (live), DependenciesPage (live), RiskFindingsPage (live)
        billing/           ← BillingPage, ReportsPage (stubs)
        settings/          ← StakeholdersPage (live), OrganisationPage (live), AuditLogPage (live), MarketplaceSettingsPage (live)
        notifications/     ← NotificationsPage (live — filters, mark-read, severity badges)
        admin/             ← AdminDashboardPage, AdminOrgsPage, AdminUsersPage, AdminAuditLogPage, AdminSystemPage, AdminVulnScanPage, AdminVulnDbPage, AdminDocsPage
```

## Routes

**Public (no sidebar):**
- `/` → Landing page (product welcome + feature cards + pricing CTA)
- `/login` → Login (calls POST /api/auth/login)
- `/signup` → Registration with password strength meter (calls POST /api/auth/register)
- `/check-email` → "Check your inbox" confirmation
- `/verify-email?token=xxx` → Email verification handler
- `/welcome` → Post-verification welcome page (links to org setup)
- `/accept-invite?token=xxx` → Accept invitation, set password, activate account
- `/setup/org` → Organisation setup wizard
- `/marketplace` → Public compliance marketplace (browse companies, search/filter)
- `/marketplace/:orgId` → Company detail page (products, compliance badges, contact modal)
- `/docs` → User Guide documentation page (fetched from API, TOC sidebar)
- `/docs/faq` → FAQ documentation page

**Admin (platform admins only, separate layout):**
- `/admin` → Admin dashboard (cross-org platform statistics)
- `/admin/dashboard` → Same as above
- `/admin/orgs` → Organisation management (browse all orgs, drill-down)
- `/admin/users` → User management (search, filters, admin toggle, invite users via email)
- `/admin/audit-log` → Cross-org audit log (paginated, filterable by event type/email)
- `/admin/system` → System health (scan performance, DB row counts, error rates)
- `/admin/vuln-scan` → Vulnerability scanning (trigger scans, scan history, per-product breakdown)
- `/admin/vuln-db` → Vulnerability database (ecosystem stats, sync controls, advisory/CVE counts)
- `/admin/docs` → Documentation editor (split-pane markdown editor with live preview)

**Authenticated (with sidebar, requires JWT + org):**
- `/dashboard` → Dashboard (live — real data from Neo4j + Postgres, vulnerability summary)
- `/notifications` → Notifications (live — type/severity filters, mark-all-read, navigation links)
- `/products` → Products list with add modal (live — CRUD backed by Neo4j)
- `/products/:productId` → Product detail with tabs + GitHub integration
- `/obligations` → CRA obligations tracker (live — cross-product status tracking)
- `/technical-files` → Technical files overview (live — cross-product compliance dashboard)
- `/repos` → Repository overview (live — cross-product repo summary)
- `/contributors` → Contributor tracking (live — cross-product contributor grid)
- `/dependencies` → Dependency management (live — license analysis, SBOM status)
- `/risk-findings` → Vulnerability findings (live — multi-source CVE scanning)
- `/billing` → Billing (stub)
- `/reports` → Compliance reports (stub)
- `/stakeholders` → CRA stakeholder management (live — org + product contacts)
- `/organisation` → Organisation settings (live — editable)
- `/audit-log` → Audit trail (live — paginated event log)
- `/marketplace/settings` → Marketplace settings (toggle listing, edit profile, compliance badges)

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/auth/register | Create account, send verification email (or auto-verify in dev mode) |
| POST | /api/auth/login | Login with email/password, returns JWT |
| GET | /api/auth/verify-email?token=xxx | Verify email, redirect to /welcome |
| GET | /api/auth/me | Check session, returns user info + orgId + orgRole |
| POST | /api/org | Create organisation (Neo4j node + Postgres link) |
| GET | /api/org | Get current user's organisation from Neo4j |
| PUT | /api/org | Update organisation details |
| GET | /api/products | List all products for user's organisation |
| GET | /api/products/:id | Get single product details |
| POST | /api/products | Create new product (Neo4j node linked to Organisation) |
| PUT | /api/products/:id | Update product details |
| DELETE | /api/products/:id | Delete product |
| GET | /api/github/connect | Initiate GitHub OAuth flow (redirects to GitHub) |
| GET | /api/github/callback | Handle GitHub OAuth callback, store encrypted token |
| GET | /api/github/status | Check if current user has GitHub connected |
| POST | /api/github/sync/:productId | Sync repo data from GitHub (metadata + contributors + languages) |
| GET | /api/github/repo/:productId | Get cached repo data from Neo4j (no GitHub API call) |
| DELETE | /api/github/disconnect | Remove GitHub connection |
| GET | /api/audit/events | Paginated audit log (telemetry events) |
| GET | /api/health | Health check |
| GET | /api/github/sbom/:productId | Get cached SBOM data for a product |
| POST | /api/github/sbom/:productId | Refresh SBOM from GitHub |
| GET | /api/github/versions/:productId | Get version history for a product |
| POST | /api/github/webhook | GitHub webhook receiver (HMAC-verified, push events) |
| GET | /api/technical-file/:productId | Get all technical file sections (auto-creates defaults) |
| PUT | /api/technical-file/:productId/:sectionKey | Update a technical file section |
| GET | /api/technical-file/:productId/progress | Get technical file completion progress |
| GET | /api/dashboard | Aggregate dashboard data (real data from Neo4j + Postgres + vulnerability summary) |
| GET | /api/stakeholders?orgId=xxx | Get all stakeholders for an organisation |
| PUT | /api/stakeholders/:roleKey | Update stakeholder contact details |
| GET | /api/technical-files/overview | Cross-product technical file compliance overview |
| GET | /api/obligations/overview | Cross-product CRA obligations overview |
| GET | /api/obligations/:productId | Per-product obligations |
| PUT | /api/obligations/:productId/:obligationKey | Update obligation status |
| GET | /api/repos/overview | Cross-product repository summary |
| GET | /api/contributors/overview | Cross-product contributor overview |
| GET | /api/dependencies/overview | Cross-product dependency + license overview |
| GET | /api/risk-findings/overview | Cross-product vulnerability findings overview |
| GET | /api/risk-findings/:productId | Per-product vulnerability findings |
| GET | /api/risk-findings/platform-scan/latest | Latest platform-wide scan summary |
| GET | /api/risk-findings/scan/:scanId | Poll scan status + performance data |
| GET | /api/risk-findings/:productId/scan-history | Scan performance history with aggregate stats |
| PUT | /api/risk-findings/:findingId | Dismiss/acknowledge a vulnerability finding |
| GET | /api/admin/dashboard | Platform-wide stats (users, orgs, products, vulnerabilities) |
| GET | /api/admin/orgs | List all organisations with user/product/vulnerability counts |
| GET | /api/admin/orgs/:orgId | Organisation detail (users, products, recent activity) |
| GET | /api/admin/users | List all users with org names, admin status, last login |
| PUT | /api/admin/users/:userId/platform-admin | Toggle platform admin role (self-demotion prevented) |
| POST | /api/admin/invite | Invite new user via email (optional org assignment + admin flag) |
| GET | /api/admin/audit-log | Cross-org paginated audit log with event type/email filters |
| GET | /api/admin/system | System health (scan perf, DB row counts, error rates) |
| GET | /api/notifications | List notifications (type/read filters, pagination) |
| GET | /api/notifications/unread-count | Unread notification count for sidebar badge |
| PUT | /api/notifications/read-all | Mark all notifications as read |
| PUT | /api/notifications/:id/read | Mark single notification as read |
| POST | /api/admin/vulnerability-scan | Trigger platform-wide vulnerability scan (admin only) |
| GET | /api/admin/vulnerability-scan/status | Latest scan status with per-product breakdown |
| GET | /api/admin/vulnerability-scan/history | Paginated scan run history |
| POST | /api/auth/accept-invite | Accept invitation — set password, activate account |
| GET | /api/admin/vulnerability-db/status | Local vuln DB status (ecosystems, advisory counts, sync times) |
| POST | /api/admin/vulnerability-db/sync | Trigger manual vuln DB sync (admin only) |
| GET | /api/marketplace/listings | Public: Browse marketplace listings (paginated, filterable) |
| GET | /api/marketplace/categories | Public: Static category list |
| GET | /api/marketplace/listings/:orgId | Public: Company detail with products |
| GET | /api/marketplace/profile | Auth: Current org marketplace profile |
| PUT | /api/marketplace/profile | Auth: Upsert marketplace listing |
| POST | /api/marketplace/contact/:orgId | Auth: Send introduction email (rate-limited) |
| GET | /api/marketplace/contact-history | Auth: Contacts sent by current user |
| POST | /api/license-scan/:productId/recheck-compatibility | Re-run compatibility checks without full rescan |
| GET | /api/docs | Public: List all doc pages (slug, title, updated_at) |
| GET | /api/docs/:slug | Public: Get doc page content (markdown) |
| PUT | /api/docs/:slug | Admin: Update doc page title + content |
| POST | /api/copilot/suggest | AI Copilot: tech file + obligation suggestions (Pro plan) |
| POST | /api/copilot/triage | AI auto-triage: dismiss/acknowledge/escalate with confidence (Pro plan) |
| POST | /api/copilot/generate-risk-assessment | AI risk assessment generator (Pro plan) |
| POST | /api/copilot/draft-incident-report | AI incident report drafter (Pro plan) |
| GET | /api/copilot/status | AI Copilot token budget status |
| GET | /api/category-recommendation/:productId | CRA category recommender (deterministic + AI) |
| POST | /api/category-recommendation/:productId | Submit category recommendation |
| GET | /api/supplier-due-diligence/:productId | Supplier DD questionnaires and enrichment |
| POST | /api/supplier-due-diligence/:productId | Generate supplier questionnaire |
| GET | /api/compliance-gaps/:productId | Compliance gap analysis |
| GET | /api/compliance-checklist/:productId | 7-step compliance checklist |
| GET | /api/settings/api-keys | List API keys for org (Pro plan) |
| POST | /api/settings/api-keys | Create new API key |
| DELETE | /api/settings/api-keys/:keyId | Revoke API key |
| GET | /api/v1/products | Public API: List products (API key auth) |
| GET | /api/v1/products/:id | Public API: Product details |
| GET | /api/v1/products/:id/vulnerabilities | Public API: Vulnerability findings |
| GET | /api/v1/products/:id/obligations | Public API: Obligation statuses |
| GET | /api/v1/compliance-status | Public API: Compliance pass/fail |
| POST | /api/trello/connect | Trello: Connect with API key + token (Pro plan) |
| GET | /api/trello/status | Trello: Connection status |
| POST | /api/trello/boards | Trello: Map product to board |
| DELETE | /api/trello/boards/:mappingId | Trello: Remove board mapping |
| POST | /api/trello/test | Trello: Test connection with card creation |
| DELETE | /api/trello/disconnect | Trello: Disconnect integration |
| GET | /api/billing/admin/pricing | Admin: Get platform pricing config |
| PUT | /api/billing/admin/pricing | Admin: Update pricing (creates new Stripe prices) |

## Database Schema

### Postgres — Tables

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(255),
  token_expires_at TIMESTAMPTZ,
  org_id UUID,
  org_role VARCHAR(50) DEFAULT 'admin',
  preferred_language VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_platform_admin BOOLEAN DEFAULT FALSE,
  invited_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User events (passive telemetry)
CREATE TABLE user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  event_type VARCHAR(50) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  accept_language TEXT,
  browser_language VARCHAR(10),
  browser_timezone VARCHAR(100),
  referrer TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- GitHub connections (encrypted OAuth tokens)
CREATE TABLE github_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  github_user_id BIGINT NOT NULL,
  github_username VARCHAR(255) NOT NULL,
  github_avatar_url TEXT,
  access_token_encrypted TEXT NOT NULL,
  token_scope VARCHAR(255),
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Product SBOMs (dependency snapshots from GitHub)
CREATE TABLE product_sboms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id VARCHAR(255) NOT NULL,
  sbom_json JSONB NOT NULL,
  package_count INTEGER DEFAULT 0,
  is_stale BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Technical File sections (CRA Annex VII compliance documentation)
CREATE TABLE technical_file_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id VARCHAR(255) NOT NULL,
  section_key VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content JSONB DEFAULT '{}',
  notes TEXT DEFAULT '',
  status VARCHAR(20) DEFAULT 'not_started',
  cra_reference VARCHAR(100),
  updated_by VARCHAR(255),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, section_key)
);

-- Product versions (CRANIS2 auto-versioning + GitHub release tags)
CREATE TABLE product_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id VARCHAR(255) NOT NULL,
  cranis_version VARCHAR(20) NOT NULL,
  github_tag VARCHAR(100),
  github_release_name VARCHAR(255),
  github_release_body TEXT,
  github_commit_sha VARCHAR(40),
  is_prerelease BOOLEAN DEFAULT FALSE,
  source VARCHAR(20) NOT NULL DEFAULT 'sync',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync history (repo sync performance tracking)
CREATE TABLE sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id VARCHAR(255) NOT NULL,
  org_id UUID NOT NULL,
  sync_type VARCHAR(20) DEFAULT 'manual',
  duration_seconds NUMERIC(10,2),
  status VARCHAR(20) DEFAULT 'completed',
  error_message TEXT,
  triggered_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stakeholders (CRA/NIS2 compliance contacts)
CREATE TABLE stakeholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  product_id VARCHAR(255),
  role_key VARCHAR(50) NOT NULL,
  name VARCHAR(255) DEFAULT '',
  email VARCHAR(255) DEFAULT '',
  phone VARCHAR(50) DEFAULT '',
  organisation VARCHAR(255) DEFAULT '',
  address TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Obligations (CRA compliance status tracking)
CREATE TABLE obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  product_id VARCHAR(255) NOT NULL,
  obligation_key VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'not_started',
  updated_by VARCHAR(255),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, product_id, obligation_key)
);

-- Vulnerability scans (per-product scan tracking, FK to platform_scan_runs)
CREATE TABLE vulnerability_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  product_id VARCHAR(255) NOT NULL,
  platform_scan_run_id UUID REFERENCES platform_scan_runs(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'running',
  findings_count INT DEFAULT 0,
  critical_count INT DEFAULT 0,
  high_count INT DEFAULT 0,
  medium_count INT DEFAULT 0,
  low_count INT DEFAULT 0,
  duration_seconds NUMERIC(10,2),
  dependency_count INTEGER,
  osv_duration_ms INTEGER,
  osv_findings INTEGER,
  github_duration_ms INTEGER,
  github_findings INTEGER,
  nvd_duration_ms INTEGER,
  nvd_findings INTEGER,
  triggered_by VARCHAR(255),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vulnerability findings (CVE data from OSV/GitHub/NVD)
CREATE TABLE vulnerability_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  product_id VARCHAR(255) NOT NULL,
  scan_id UUID REFERENCES vulnerability_scans(id),
  source VARCHAR(20) NOT NULL,
  source_id VARCHAR(255),
  severity VARCHAR(20) NOT NULL,
  cvss_score DECIMAL(3,1),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  dependency_name VARCHAR(255),
  dependency_version VARCHAR(100),
  dependency_ecosystem VARCHAR(50),
  dependency_purl VARCHAR(1000),
  affected_versions TEXT,
  fixed_version VARCHAR(100),
  references_url TEXT,
  mitigation TEXT DEFAULT '',
  status VARCHAR(20) DEFAULT 'open',
  dismissed_by VARCHAR(255),
  dismissed_at TIMESTAMPTZ,
  dismissed_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, source, source_id, dependency_purl)
);

-- Platform scan runs (platform-wide vulnerability scan tracking)
CREATE TABLE platform_scan_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(20) DEFAULT 'running',
  triggered_by VARCHAR(255),
  trigger_type VARCHAR(20) DEFAULT 'manual',
  total_products INT DEFAULT 0,
  total_unique_dependencies INT DEFAULT 0,
  total_findings INT DEFAULT 0,
  new_findings_count INT DEFAULT 0,
  critical_count INT DEFAULT 0,
  high_count INT DEFAULT 0,
  medium_count INT DEFAULT 0,
  low_count INT DEFAULT 0,
  osv_duration_ms INT,
  osv_findings INT DEFAULT 0,
  github_duration_ms INT,
  github_findings INT DEFAULT 0,
  nvd_duration_ms INT,
  nvd_findings INT DEFAULT 0,
  local_db_duration_ms INT,
  local_db_findings INT DEFAULT 0,
  duration_seconds NUMERIC(10,2),
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Local vulnerability database: OSV/GHSA advisories (263K+ records)
CREATE TABLE vuln_db_advisories (
  id VARCHAR(50) PRIMARY KEY,
  ecosystem VARCHAR(50) NOT NULL,
  package_name VARCHAR(500),
  aliases TEXT[],
  severity VARCHAR(20),
  summary TEXT,
  affected JSONB,
  raw JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Local vulnerability database: NVD CVEs (182K+ records)
CREATE TABLE vuln_db_nvd (
  cve_id VARCHAR(30) PRIMARY KEY,
  description TEXT,
  description_tsv TSVECTOR,
  severity VARCHAR(20),
  cvss_score DECIMAL(3,1),
  cpe_matches JSONB DEFAULT '[]',
  references JSONB DEFAULT '[]',
  published_at TIMESTAMPTZ,
  modified_at TIMESTAMPTZ,
  raw JSONB
);

-- Flattened CPE index for fast NVD vulnerability matching (1M+ entries)
CREATE TABLE vuln_db_nvd_cpe_index (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cve_id VARCHAR(30) NOT NULL,
  vendor VARCHAR(200),
  product VARCHAR(200) NOT NULL,
  target_sw VARCHAR(100),
  version_exact VARCHAR(100),
  version_start_incl VARCHAR(100),
  version_start_excl VARCHAR(100),
  version_end_incl VARCHAR(100),
  version_end_excl VARCHAR(100)
);
-- Indexes: idx_nvd_cpe_product, idx_nvd_cpe_target, idx_nvd_cpe_product_target
n-- Marketplace profiles (opt-in company listings)
CREATE TABLE marketplace_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID UNIQUE NOT NULL,
  listed BOOLEAN DEFAULT FALSE,
  tagline VARCHAR(160) DEFAULT '',
  description TEXT DEFAULT '',
  logo_url VARCHAR(500) DEFAULT '',
  categories JSONB DEFAULT '[]',
  featured_product_ids JSONB DEFAULT '[]',
  compliance_badges JSONB DEFAULT '{}',
  listing_approved BOOLEAN DEFAULT TRUE,
  contact_requests_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Marketplace contact log (intro emails)
CREATE TABLE marketplace_contact_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL,
  from_org_id UUID,
  to_org_id UUID NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documentation pages (admin-editable)
CREATE TABLE doc_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vulnerability database sync status (per-ecosystem tracking)
CREATE TABLE vuln_db_sync_status (
  ecosystem VARCHAR(50) PRIMARY KEY,
  last_sync_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pending',
  advisory_count INT DEFAULT 0,
  package_count INT DEFAULT 0,
  duration_seconds NUMERIC(10,2),
  error_message TEXT
);
```

### Neo4j — Graph Schema

```cypher
-- Constraints (auto-created on backend startup)
CREATE CONSTRAINT org_id_unique IF NOT EXISTS FOR (o:Organisation) REQUIRE o.id IS UNIQUE;
CREATE CONSTRAINT product_id_unique IF NOT EXISTS FOR (p:Product) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT dependency_id_unique IF NOT EXISTS FOR (d:Dependency) REQUIRE d.id IS UNIQUE;
CREATE CONSTRAINT vulnerability_cve_unique IF NOT EXISTS FOR (v:Vulnerability) REQUIRE v.cve IS UNIQUE;

-- Organisation node
(:Organisation {id, name, country, companySize, craRole, industry, createdAt, updatedAt})

-- Product node
(:Product {id, name, version, category, description, repoUrl, distributionModel, lifecycleStatus, createdAt, updatedAt})
-- Relationships: (Product)-[:BELONGS_TO]->(Organisation)

-- GitHubRepo node (created on repo sync)
(:GitHubRepo {url, owner, name, fullName, description, language, stars, forks, openIssues, visibility, lastPush, defaultBranch, syncedAt})
-- Relationships: (Product)-[:HAS_REPO]->(GitHubRepo), (User)-[:GITHUB_CONNECTED]->(GitHubRepo)

-- Contributor node (created on repo sync)
(:Contributor {githubLogin, githubId, avatarUrl, contributions})
-- Relationships: (GitHubRepo)-[:HAS_CONTRIBUTOR]->(Contributor)

-- SBOM node (dependency snapshot)
(:SBOM {productId, packageCount, syncedAt, isStale})
-- Relationships: (Product)-[:HAS_SBOM]->(SBOM)

-- TechnicalFile node (progress tracking)
(:TechnicalFile {productId, completedSections, totalSections, updatedAt})
-- Relationships: (Product)-[:HAS_TECH_FILE]->(TechnicalFile)

-- Dependency nodes (from SBOM)
(:Dependency {name, ecosystem, version})
-- Relationships: (Product)-[:DEPENDS_ON]->(Dependency)
```

## Passive Telemetry System

Every significant user action is recorded as a dual-write event:
- **Postgres `user_events`**: Stores event with IP, user agent, browser language, timezone, referrer, metadata JSONB
- **Neo4j**: Creates `(:UserEvent)` node linked to `(:User)` via `[:PERFORMED]` relationship

Event types tracked: `login`, `register`, `org_created`, `org_updated`, `product_created`, `product_updated`, `product_deleted`, `github_connected`, `github_disconnected`, `github_repo_synced`, `page_view`, etc.

The audit log page (`/audit-log`) displays these events in a paginated, filterable table.

## GitHub Integration

**Architecture**: GitHub OAuth App flow. The product/project admin connects their GitHub account once. Contributors are discovered from the repo and stored as Neo4j nodes — they don't need CRANIS2 accounts.

**Security constraints**:
- OAuth scope: `read:user,repo` (read-only — `repo` scope gives read access to private repos the user can access)
- All GitHub API calls are GET-only — no write endpoints exposed
- Token stored AES-256-GCM encrypted in Postgres (iv:tag:ciphertext hex format)
- Token can be disconnected/revoked at any time

**Data pulled on sync**:
- Repo metadata: name, description, stars, forks, language, visibility, last push, open issues
- Contributors: login, avatar, commit count
- Languages: breakdown with percentages
- SBOM: full dependency graph (package names, versions, ecosystems) via GitHub Dependency Graph API
- Releases: tag names, release notes, prerelease flags
- Tags: tag names + commit SHAs

**GitHub OAuth App** configured at https://github.com/settings/developers:
- Application name: `CRANIS2`
- Client ID: stored in `.env` as `GITHUB_CLIENT_ID`
- Authorization callback: proxied through NGINX to backend
- Flow: popup window + postMessage + single-use connection tokens

**GitHub Webhook** registered at https://github.com/mcburnia/CRANIS2/settings/hooks:
- Payload URL: `https://dev.cranis2.dev/api/github/webhook`
- Content type: `application/json`
- Secret: stored in `.env` as `GITHUB_WEBHOOK_SECRET`
- Events: push only
- Purpose: marks SBOMs stale on code changes

## Products Feature

Products represent software products that need CRA compliance tracking. Each product is a Neo4j node linked to an Organisation via `BELONGS_TO`.

**Product properties**: name, version, category (default/class_i/class_ii), description, repoUrl, lifecycleStatus (development/production/maintenance/end_of_life)

**CRA categories**:
- `default` — Standard products, self-assessment possible
- `class_i` (Important) — Products with digital element requiring third-party assessment
- `class_ii` (Critical) — Critical products requiring EU-level assessment

**ProductDetailPage tabs**: Overview (product info + GitHub repo card + version history + SBOM summary + compliance progress), Obligations (live — per-product CRA obligation tracker), Technical File (CRA Annex VII — 8 expandable sections with inline editors, Annex I checklist, status tracking), Risk Findings (live — per-product vulnerability scanning with dismiss/acknowledge), Dependencies (SBOM table with ecosystem badges + language breakdown + contributors)

## User Registration + Org Setup Flow

1. User visits `/signup`, enters email + password (strength validated)
2. **Dev mode** (`DEV_SKIP_EMAIL=true`): account auto-verified, session token returned, redirect to `/welcome`
3. **Production mode**: verification email sent via Resend, user clicks link, redirected to `/welcome`
4. `/welcome` page stores session token, offers "Set Up Your Organisation" button
5. `/setup/org` wizard collects: org name, country, company size, CRA role, industry
6. `POST /api/org` creates Organisation node in Neo4j and links user as admin in Postgres
7. User is redirected to `/dashboard`
8. **Auth guard**: if user has no `orgId`, any authenticated route redirects to `/setup/org`

## Environment Variables (.env — NOT in git)

```
POSTGRES_USER=cranis2
POSTGRES_PASSWORD=cranis2_dev_2026
POSTGRES_DB=cranis2

NEO4J_USER=neo4j
NEO4J_PASSWORD=cranis2_dev_2026

RESEND_API_KEY=re_tZ1swTMo_4yB2pTde1Lm6KMxFpA7hZtNU
JWT_SECRET=<auto-generated>
FRONTEND_URL=https://dev.cranis2.dev
EMAIL_FROM=info@poste.cranis2.com
DEV_SKIP_EMAIL=false

GITHUB_CLIENT_ID=PLACEHOLDER          ← Needs real OAuth App credentials
GITHUB_CLIENT_SECRET=PLACEHOLDER      ← Needs real OAuth App credentials
GITHUB_ENCRYPTION_KEY=<32-byte hex>   ← Generated, used for AES-256-GCM token encryption
```

**Docker-compose passes to backend:**
- `DATABASE_URL` (Postgres connection string)
- `NEO4J_URI=bolt://neo4j:7687`
- `NEO4J_USER`, `NEO4J_PASSWORD`
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_ENCRYPTION_KEY`
- `GITHUB_WEBHOOK_SECRET` (HMAC-SHA256 verification for GitHub webhooks)
- All Resend/JWT/Email vars

## Dev Mode

`DEV_SKIP_EMAIL=false` in `.env` (currently disabled — real emails active):
- When `true`: registration auto-verifies accounts, invite URLs logged to console
- When `false`: verification + invite emails sent via Resend from `info@poste.cranis2.com`
- Resend domain `poste.cranis2.com` pending DKIM verification

**Dev nuke button** (`/api/dev/nuke`) — accessible from Organisation page. Wipes all user data for testing. **MUST BE REMOVED before production deployment.**

## Design System

Dark theme with CSS custom properties (defined in `frontend/src/index.css`):

```
--bg: #0f1117        (page background)
--surface: #1a1d27   (cards, sidebar)
--border: #2a2d3a    (borders)
--text: #e4e4e7      (primary text)
--muted: #8b8d98     (secondary text)
--accent: #3b82f6    (primary blue)
--accent-hover: #2563eb
--green: #22c55e     (success)
--amber: #f59e0b     (warning)
--red: #ef4444       (error/critical)
--purple: #a855f7    (secondary)
```

Responsive breakpoints:
- Desktop: > 1024px (sidebar always visible)
- Tablet: 768–1024px (collapsible sidebar)
- Mobile: < 768px (slide-out drawer with hamburger)

## Workflow Rules

1. **Propose first, then implement** — always present a plan of action before making changes, and wait for user approval.
2. **Commit per completed task** — create one commit after each distinct piece of work is complete, with a detailed message/body for traceability.
3. **User performs push** — do not push automatically; ask the user to run `git push` after each commit.
4. **Work on `main`** — use `main` unless the user explicitly asks for a feature branch.
5. **Run tests per task** — run unit and integration tests at the end of each task.
6. **Run full morning regression daily** — before new work each morning, run the full test cycle in Step 6.
7. **Explicit approval for higher-risk operations** — get approval before infra restarts, DB migrations, destructive commands, external service changes, or production-impacting actions.
8. **Use British English** — all assistant communication should use British spelling/phrasing.
9. **Definition of done** — code changed, tests pass, docs updated, committed, pushed, and deployment status verified.
10. **Never commit `.env`** — it contains credentials.
11. **Build before deploying** — `npm run build` then `docker compose up -d --build`.
12. **Always use `source ~/.nvm/nvm.sh &&`** before npm/node commands on the server.
13. **Update RESTART.md** after significant workflow or platform changes.

## NGINX Config Notes

- The `nginx/default.conf` file uses plain `$uri` / `$host` variables — **do NOT escape with `\$`** as it causes redirect loops (this was a bug we fixed)
- SPA routing: `try_files $uri $uri/ /index.html`
- API proxy: `location /api/` resolves backend through Docker DNS (`resolver 127.0.0.11`) and forwards full request URI to avoid stale upstream IPs after backend container recreation
- GitHub callback URL `/api/github/callback` is proxied through NGINX to the backend

## Other Projects on This Server

- **ANSABASE** — separate dev stack that runs concurrently on this host. Keep both stacks within documented memory budgets (see `memory.md`).
- **Archoniq** — separate project using Postgres (port 5432) and Neo4j (ports 7474/7687). Do not interfere with these containers.

## Reference Materials

The `public/` directory contains the original HTML prototypes from the design phase. Use these as reference when migrating page content into React components. Key files:
- `public/app-shell.css` — design system source
- `public/dashboard.html` — sidebar layout and component patterns
- `public/landing.html` — public page layout

---

## Technical File (CRA Annex VII)

The Technical File is the core compliance document required by CRA Article 31 and Annex VII. CRANIS2 provides a structured editor for all 8 required sections:

| # | Section | CRA Reference | Content |
|---|---------|---------------|---------|
| 1 | Product Description | Annex VII S1 | Intended purpose, versions, market availability |
| 2 | Design & Development | Annex VII S2(a) | Architecture, SDLC, secure-by-design measures |
| 3 | Vulnerability Handling | Annex VII S2(b) | Disclosure policy, CVE monitoring, patch process |
| 4 | Risk Assessment | Annex VII S2(c) | Annex I Part I checklist (13 essential requirements) |
| 5 | Support Period | Annex VII S3 | Expected support duration, update mechanism |
| 6 | Standards Applied | Annex VII S4 | EN standards, harmonised standards, ISO references |
| 7 | Test Reports | Annex VII S5 | Conformity test results, penetration testing |
| 8 | EU Declaration of Conformity | Annex VII S6 | DoC reference, notified body (if applicable) |

**Annex I Part I checklist** (13 essential cybersecurity requirements a-m) is embedded in the Risk Assessment section. Each requirement can be marked as applicable/not-applicable with evidence and justification fields.

**Progress tracking**: Each section has a status (Not Started / In Progress / Complete). The overview tab shows X/8 sections complete.

## Versioning System

CRANIS2 uses a dual versioning approach:

1. **CRANIS2 auto-version**: `YYYY.MM.DD.NNNN` format (e.g. `2026.02.21.0001`). Date-based with a daily incrementing counter. Generated on every sync.
2. **GitHub release tags**: Captured from the repository and stored alongside the auto-version.

Version history is displayed on the Product Overview tab showing both CRANIS2 versions and GitHub tags with source badges (sync/webhook).

## Webhook + Stale SBOM + Auto-Sync Pipeline

1. **Push to GitHub** -> GitHub sends POST to `https://dev.cranis2.dev/api/github/webhook`
2. **Webhook received** -> HMAC-SHA256 signature verified -> SBOM marked `is_stale = TRUE` in Postgres + Neo4j
3. **UI reflects** -> Sync button changes to "Update Available" with blue pulse animation
4. **Resolution** -> Either manual "Update Available" click OR daily 2 AM auto-sync
5. **Sync runs** -> Fresh SBOM fetched, new CRANIS2 version generated, `is_stale` cleared to FALSE

The scheduler (`services/scheduler.ts`) checks every 60 minutes and runs: vuln DB sync at 1 AM, SBOM auto-sync at 2 AM for stale SBOMs, and platform vulnerability scan at 3 AM.

## Cloudflare Tunnel

The dev server is behind 5G CGNAT (no inbound port forwarding possible). A Cloudflare Tunnel provides public access:

- **Domain**: `cranis2.dev` (registered via Cloudflare)
- **Subdomain**: `dev.cranis2.dev` -> tunnelled to `localhost:3002` (NGINX)
- **Tunnel name**: `cranis2-dev`
- **Config**: `~/.cloudflared/config.yml`
- **Service**: `cloudflared.service` (systemd, enabled, auto-starts on reboot)
- **Tunnel ID**: `fdce7420-f896-42d2-865d-1ec6ac8d4e7f`

To check tunnel status:
```bash
systemctl is-active cloudflared
```

To restart:
```bash
sudo systemctl restart cloudflared
```

## Current Status

*Update this section at the end of each working session.*

**Last updated:** 2026-03-14 (session 46)

**Completed:**
- **Platform Analytics Dashboard (#57)** — Admin-only analytics page at `/admin/analytics`. Backend endpoint queries both Postgres and Neo4j for: KPI snapshot (total users, orgs, products, connected repos, active users 7d/30d, billable contributors, launch subscribers), growth metrics (weekly signups 26 weeks, cumulative users by month), revenue breakdown (MRR, by plan, by billing status), market intelligence (countries, industries, CRA operator roles, company sizes — all from Neo4j Organisation nodes), and assessment completions (CRA + NIS2 totals, category/entity-class breakdowns, weekly trends). Frontend: KPI stat cards, Recharts bar/line/pie charts, data tables, responsive grid layout. 10 new tests. **Total: ~1,450 backend tests passing (82 files).**
- Docker Compose stack (NGINX, Backend, Postgres, Neo4j)
- Assistant operating protocol formalised in `Workflow Rules` (propose-first flow, test gates, push handoff, British English)
- **CLAUDE.md created** — project-level instructions file (auto-loaded by Claude Code each session); contains operating protocol, environment notes, NGINX gotchas, port map
- **MEMORY.md created** — cross-session memory at `~/.claude/projects/-home-mcburnia/memory/MEMORY.md`; contains user preferences, active projects, key environment facts
- **SBOM structural validation** — `validateCycloneDX()` and `validateSPDX()` added to `sbom-export.ts`; exports set `X-SBOM-Warnings` response header; status endpoint includes `validationWarnings` array
- **Technical File in compliance package** — Due Diligence ZIP now includes `technical-file.json` (all 8 Annex VII sections) and a Technical File section in the PDF
- **Download button on Technical Files overview** — per-product "Download" button on `/technical-files` triggers the Due Diligence export ZIP download
- **tasklist.md updated** — SBOM Export, Compliance Package, IP/Copyright Proof, and Billing all marked complete; Reports page and Escrow remain open
- **Compliance Reports feature** — Three report types added: Compliance Summary (per-product obligations, tech file, vulns, CRA reports), Vulnerability Trends (scan history, severity/status charts via Recharts, ecosystem breakdown), Audit Trail (user events, ENISA stage submissions, repo syncs). Each has PDF (PDFKit) and CSV export, date range picker defaulting to last 12 months. Hub at `/reports`; sub-routes `/reports/compliance-summary`, `/reports/vulnerability-trends`, `/reports/audit-trail`. Backend: `backend/src/routes/reports.ts` (6 endpoints).
- **tasklist.md finalised** — All 5 MVP features confirmed complete. Escrow was already fully implemented (routes, service, DB schema, frontend) in a prior session; tasklist updated to reflect this. **No open MVP tasks remain.**
- **Reports test coverage** — Full test coverage added for the reports feature. Backend: `backend/tests/routes/reports.test.ts` (35 integration tests covering all 6 endpoints — 401 auth, 200 success, PDF magic bytes, CSV headers, date defaults, category filter, org isolation). E2E: `e2e/acceptance/reports.spec.ts` (29 acceptance tests covering hub + 3 sub-pages). Total test counts: **841 backend tests passing, 29 E2E acceptance tests passing**.
- **Phase 2 tasklist defined** — Thorough CRA gap analysis identified 7 Phase 2 features for the 8-week launch window. `tasklist.md` rewritten with full Phase 2 + Phase 3 roadmap.
- **Obligations auto-intelligence** — `computeDerivedStatuses()` added to `obligations.ts`; derives obligation statuses from existing platform data (5 batched Postgres queries: product_sboms, vulnerability_scans, vulnerability_findings, technical_file_sections, cra_reports). All GET endpoints now return `derivedStatus`, `derivedReason`, `effectiveStatus`. Progress counts use effectiveStatus. `getApplicableObligations()` fixed to fall back to `'default'` for unrecognised CRA categories. UI: both `ObligationsPage` and `ProductDetailPage` ObligationsTab show `auto` badge when derived advances status above manual, `✓ confirmed` when platform data confirms manual status, derived reason as tooltip/subtext, legend explaining manual vs auto. 27 new tests added (`backend/tests/routes/obligations.test.ts`). **Total: 868 backend tests passing.**
- **Expanded obligations list** — 8 new CRA obligations added (19 total, up from 11): Art. 13(3) Component Currency, Art. 13(5) No Known Exploitable Vulnerabilities, Art. 13(7) Automatic Security Updates, Art. 13(8) Security Patches Free of Charge, Art. 13(9) Security Updates Separate from Feature Updates, Art. 13(10) Documentation Retention (10 Years), Art. 16 EU Declaration of Conformity (Annex IV), Art. 20 EU Market Surveillance Registration (critical category only). Auto-derive rules added for art_13_3, art_13_5, art_16, art_20. `ensureObligations()` refactored to single-query batch insert. 7 new tests. **Total: 875 backend tests passing.**
- **EU Declaration of Conformity PDF generator** — New endpoint `GET /api/technical-file/:productId/declaration-of-conformity/pdf`. Generates a formally-structured Annex VI EU DoC PDF (PDFKit) pre-populated from Neo4j product/org data and `technical_file_sections` content. EU-navy styling, DRAFT watermark when section not yet completed, Content-Disposition attachment. Frontend: "Download EU DoC PDF" button added to declaration_of_conformity section in ProductDetailPage TechnicalFileTab; per-product "EU DoC" button added to TechnicalFilesPage card headers. 5 new tests. **Total: 880 backend tests passing.**
- **Technical file auto-population** — New endpoint `GET /api/technical-file/:productId/suggestions` (Phase 2 Item 4). Returns pre-filled content for four technical file sections derived from platform data. `product_description`: intended purpose stub with product name, CRA category label, repo URL; versions and distribution. `vulnerability_handling`: update mechanism with scan count and last-scan date, SBOM reference with package count and stale status. `standards_applied`: ETSI EN 303 645 + EN 18031-1 for all; adds EN 18031-2 for important_i+, EN 18031-3 for important_ii+, ISO/IEC 15408 for critical. `test_reports`: one entry per completed vulnerability scan (date, findings_count, scan ID); placeholder if no scans exist. Frontend: purple "Auto-fill" (Sparkles icon) button added to all four sections; non-destructive — only populates empty fields; first request caches suggestions for subsequent sections; amber "Platform data auto-filled" banner shown after applying. 8 new tests (auth, 404, structure, field content, standard count for default category, scan entry seeding). **Total: 888 backend tests passing.**
- **Getting-started compliance checklist** — New endpoint `GET /api/products/:productId/compliance-checklist` (Phase 2 Item 5). Returns a 7-step CRA compliance checklist with completion status derived from existing platform data: (1) connect repo + sync SBOM, (2) set CRA category, (3) run vuln scan + triage findings, (4) complete minimum technical file, (5) set up stakeholder contacts, (6) begin EU Declaration of Conformity, (7) download compliance package. Each step links to the relevant tab/page. Response includes CRA deadline countdowns (Art. 14 incident reporting Sep 2026, full compliance Dec 2027). Dashboard: compact checklist widget for first 5 products with progress bar, step dots, next-action button, and deadline countdown. Product detail page: full 7-step checklist in Overview tab with descriptions, deadlines, and per-step action buttons. 10 new tests. **Total: 898 backend tests passing.**
- **Auto-webhook registration on repo sync** — New webhook lifecycle service (`backend/src/services/webhook.ts`) with `ensureWebhook()` and `removeWebhooksForUser()`. After every successful repo sync (manual or scheduler), the platform auto-registers a push-event webhook on the provider (GitHub, Codeberg, Gitea, Forgejo — GitLab deferred). Idempotent — skips if Repository node already has `webhookId`. Non-blocking — webhook registration failure never breaks the sync. On provider disconnect, all registered webhooks are cleaned up. Provider-specific functions added to `github.ts` (GitHub REST API v3) and `codeberg.ts` (Gitea-compatible API). Dispatcher added to `repo-provider.ts` with `createWebhook()`, `deleteWebhook()`, `getWebhookSecret()`. Env vars: `GITHUB_WEBHOOK_SECRET`, `CODEBERG_WEBHOOK_SECRET`. 10 new tests (`webhook-registration.test.ts`). **Total: 908 backend tests passing.**
- **Repo Activity card** — New `repo_push_events` table stores push event details (pusher name, branch, commit count, head commit message, SHA) extracted from webhook payloads. New endpoint `GET /api/github/push-events/:productId` returns recent push events. Product Overview tab shows a "Repo Activity" card listing up to 8 recent pushes with pusher name, branch badge, commit count, commit message, and relative timestamp. 8 new tests (`push-events.test.ts`). **Total: 916 backend tests passing.**
- NGINX API proxy updated to use Docker DNS re-resolution for backend upstreams (prevents stale IP 502 errors after backend recreation)
- Shared dev-server memory profile tuned for 16 GB RAM (container limits + backend Node heap cap) to reduce OOM restarts
- External USB SSD runbook + helper scripts added for non-destructive artifact/backup storage
- Vite + React + TypeScript scaffolding with all routes
- React Router with RootLayout for auth context
- Express backend with auth + org API endpoints
- Email verification via Resend (dev mode bypass active)
- User registration with password strength validation
- Login with JWT session tokens
- Auth context with protected routes (redirects to /login if no session, /setup/org if no org)
- Landing page fully migrated from HTML prototype
- Responsive sidebar with 5 navigation sections
- Neo4j integration — Organisation nodes stored in graph database
- Org setup wizard — collects name, country, company size, CRA role, industry
- Postgres ↔ Neo4j linking — users.org_id references Organisation node in Neo4j
- NGINX config fix (escaped dollar signs bug resolved)
- Passive telemetry system — dual-write events to Postgres + Neo4j, audit log page
- Organisation page — live data, editable fields, dev nuke button
- Audit log page — paginated event viewer with filtering
- Products page — full CRUD with Neo4j backend, category badges, lifecycle status
- Product detail page — 5 tabs (Overview, Obligations, Technical File, Risk Findings, Dependencies)
- Repository URL field — full-stack support for repoUrl on products
- GitHub OAuth (popup window + postMessage + single-use connection tokens)
- GitHub integration — repo sync, contributor discovery, language breakdown
- **SBOM capture** — GitHub Dependency Graph API, stored in Postgres + Neo4j, ecosystem-coloured badges
- **Technical File (CRA Annex VII)** — 8 structured sections with inline editors, Annex I Part I checklist (13 essential requirements), status tracking, progress summary
- **Dual versioning** — CRANIS2 auto-version (YYYY.MM.DD.NNNN format) + GitHub release tag capture
- **GitHub webhooks** — HMAC-SHA256 verified push events, marks SBOMs stale
- **Stale SBOM UI** — Sync button shows "Update Available" with pulse animation when stale, dimmed when fresh
- **Daily auto-sync scheduler** — checks hourly, syncs stale SBOMs at 2 AM, generates new version
- **Cloudflare Tunnel** — `dev.cranis2.dev` publicly accessible, systemd service, survives reboots
- **Sync duration tracking** — Per-sync timing stored in `sync_history` table, displayed on product cards
- **Dashboard (real data)** — Aggregate stats from Neo4j + Postgres, product table, activity feed, risk findings summary
- **Stakeholders page** — Org-level (manufacturer contact, authorised rep, compliance officer) + product-level (security contact, tech file owner, incident response lead) CRA/NIS2 contacts with inline editing
- **Technical Files overview** — Cross-product compliance dashboard with StatCards, progress bars, deep links to section editors
- **Obligations tracker** — Cross-product CRA obligation status tracking (22 obligations), persisted in Postgres, inline status changes
- **Repos overview** — Cross-product repository summary with StatCards (connected/disconnected), repo details, sync status
- **Contributors overview** — Cross-product contributor grid with avatar display, GitHub profile links, contribution counts
- **Dependencies overview** — Cross-product dependency management with license analysis (MIT/ISC/copyleft risk), SBOM status, searchable dependency tables
- **Vulnerability scanning** — Scans local Postgres vulnerability database (OSV/GHSA advisories + NVD CVEs via CPE matching). Per-finding severity, mitigation guidance, CRA Art. 13(6) references
- **Risk Findings page** — Cross-product vulnerability overview with severity breakdown, expandable findings, dismiss/acknowledge workflow
- **Scan performance tracking** — Local DB timing + legacy per-source timing, scan history with aggregate stats (avg/min/max)
- **Dashboard risk card** — Real vulnerability data replacing "coming soon" placeholder, severity breakdown, per-product findings
- **Product RiskFindingsTab** — Per-product vulnerability findings with scan trigger, severity badges, mitigation display, dismiss actions
- **Platform Admin Dashboard** — Separate admin area with purple accent theme, cross-org stats, organisation drill-down, user management
- **Admin User Management** — Platform admin toggle with confirmation modal, user search/filters, "You" badge for current user
- **Admin Audit Log** — Cross-org paginated event table with event type and email filters
- **Admin System Health** — Scan performance metrics, DB row counts, error rates, recent scan history
- **User Invite System** — Platform admins invite users via email (Resend), optional org pre-assignment, set-password flow, re-invite support
- **Notifications system** -- Backend API (list/unread-count/mark-read), notifications service, sidebar unread badge with 60s polling, full notifications page with type/severity filters and mark-all-read
- **Platform-wide vulnerability scanning** -- Admin-only, deduplicates all SBOM components across all products, scans local Postgres DB, attributes findings to all affected products, sends targeted notifications to stakeholders (security contacts, compliance officers) and platform admins
- **Admin Vulnerability Scan page** -- Manual scan trigger, current scan summary with local DB timing, per-product findings breakdown table, paginated scan history
- **Daily scheduled vulnerability scan** -- Runs at 3 AM (after 2 AM SBOM sync), uses same platform-wide deduplication approach
- **platform_scan_runs table** -- Tracks platform-wide scan operations with local DB timing + legacy per-source timing, aggregate severity metrics, new findings count
- **Accept Invite Page** — `/accept-invite` page with password strength validation, auto-login on completion, org-aware redirect
- **Local vulnerability database** — 263K OSV/GHSA advisories + 182K NVD CVEs stored in Postgres. Daily sync at 1 AM from OSV.dev + NVD community feeds (vuln-db-sync.ts). Scans query local DB instead of external APIs (~0.25s vs ~6 min)
- **CPE-based NVD matching** — Flattened CPE index (1M+ entries) with ecosystem-strict matching (node.js target_sw only, no wildcards). GENERIC_CPE_NAMES blocklist prevents false positives from scoped package short names
- **Severity normalisation** — normaliseSeverity() maps GitHub "moderate" to standard "medium". All severities standardised to critical/high/medium/low
- **Admin Vuln Database page** — `/admin/vuln-db` showing ecosystem stats, advisory/CVE counts, sync controls, architecture info card
- **CRA Article 14 ENISA Reporting** -- Two report types (Actively Exploited Vulnerability, Severe Incident), three-stage timeline (Early Warning 24h, Notification 72h, Final Report 14d/1m), cra_reports + cra_report_stages tables, deadline monitoring, CSIRT country selection, TLP classification
- **IP/Copyright Proof system** -- RFC 3161 timestamping (FreeTSA.org, pure Node.js ASN.1 DER encoding), license compliance scanning (SPDX classification, copyleft detection), ip_proof_snapshots table, scheduler auto-triggers after SBOM sync
- **Transitive dependency enrichment** -- SPDX relationship parsing, npm registry fallback for NOASSERTION deps, depth tracking (direct/transitive)
- **Due Diligence Report export** -- Per-product investor-ready ZIP: PDF report + CycloneDX SBOM + licence findings CSV + vulnerability summary JSON + full licence texts
- **Feedback and Bug Report system** -- In-app modal (3 categories), sidebar button, admin page for review/resolve
- **User management (admin)** -- Edit user, suspend/unsuspend, delete with cascades, action menu per row
- **Billing (Stripe)** -- Two-tier pricing: Standard (€6/contributor/month) and Pro (€20/product/month + €6/contributor/month). Admin-configurable pricing via `platform_settings` table. Stripe price auto-creation at startup. 90-day trial, checkout sessions (multi-line-item for Pro), customer portal, webhook, billing gate middleware, trial/payment lifecycle, billing emails (9 templates), admin controls (extend trial, exempt, pause, pricing config). Upgrade/downgrade between plans with Stripe proration.
- **Landing page** -- Hero, feature cards, audience cards, pricing CTA, regulation sections (CRA, NIS2, GDPR, EU Sovereignty, ISO)
- **Compliance Marketplace** -- Public marketplace for companies to list themselves with products and compliance badges. marketplace_profiles + marketplace_contact_log tables. Public browse page (/marketplace) with search/filter, detail page (/marketplace/:orgId) with contact modal, settings page (/marketplace/settings) with toggle/editor. Contact rate limiting (3/day, 1/org/7d). 10 categories. Admin approval controls.
- **Admin pages updated for local DB** — Dashboard shows last DB sync time, System Health shows Local DB Query avg latency (historical API latencies dimmed), Vuln Scan shows local DB timing as primary display
- **License Compatibility Matrix** -- Distribution model awareness on products (proprietary_binary, saas_hosted, source_available, library_component, internal_only). Pure rules engine (license-compatibility.ts) with FSF cross-license conflict table (14 known incompatibilities). Verdicts: compatible/incompatible/review_needed per finding. AGPL/SSPL network copyleft detection. Integrated into license scanner, recheck endpoint for distribution model changes. Frontend: distribution model select on product edit, verdict badges/filters on LicenseCompliancePage. Due diligence PDF includes compatibility analysis section.
- **Landing page polish** -- Alternating section backgrounds (nth-of-type(even) #363d4f), CRANIS2 logo "2" blue on public pages, Log In nav link, marketplace cards full-width list layout, hero text simplified
- **SEO implementation** -- usePageMeta hook (per-route meta tags, Open Graph, Twitter Cards, JSON-LD structured data), sitemap.xml endpoint, security headers middleware (CSP, HSTS, X-Frame-Options), canonical URLs
- **User documentation** -- USER-GUIDE.md and FAQ.md (comprehensive usage guides), in-app /docs page with TOC sidebar, hash navigation, IntersectionObserver heading tracking
- **Admin-editable documentation** -- doc_pages Postgres table (seeded from markdown files), /api/docs public GET + admin PUT endpoints, AdminDocsPage split-pane markdown editor with live preview, Ctrl+S/Cmd+S save, unsaved changes warning, tab switching between User Guide and FAQ
- **Vulnerability remediation** -- Upgraded minimatch 10.2.2→10.2.4, rollup 4.57.1→4.59.0; dismissed ajv (dev-only) and @types/qs (false positive); 0 open findings on CRANIS2 product

**Known Issues / Gotchas:**
- **PRODUCTION MIGRATION**: `FRONTEND_URL` in `.env` is currently `https://dev.cranis2.dev`. When moving to production, this MUST be changed to `https://cranis2.com` (or equivalent production URL). This affects all email links (verification, invitations) and OAuth callback URLs.
- DNS for poste.cranis2.com pending DKIM verification — once verified, invite emails will flow via Resend
- Dev routes (`/api/dev/*`) must be removed before production
- SBOM debug logging still in `services/github.ts` (console.log statements) — remove before production
- **local_db_duration_ms** lives on `platform_scan_runs`, NOT `vulnerability_scans` — must JOIN through `platform_scan_run_id`
- **GitHub "moderate" severity** — always use normaliseSeverity() when storing severity from any source
- **NVD CPE matching** — never use keyword/description search (produces massive false positives). Always use CPE index with ecosystem-strict targets
- **CPE wildcard target_sw** (`*`) matches unrelated products — only match ecosystem-specific targets (e.g. `node.js`)
- **GENERIC_CPE_NAMES blocklist** in vulnerability-scanner.ts prevents scoped npm short names (core, connect, debug, etc.) from matching unrelated CPE products
- Compose project naming mismatch can leave temporary `docker-*` orphan containers; cleanup and naming standardisation is tracked as technical debt in `docs/Stories-and-spikes.csv` (CRN-14)

**Session 15 (2026-03-04):**
- **Welcome site** — Standalone Express app on port 3004 serving public-facing content. Originally password-protected for Strategy & Ecosystem content; later evolved into the public welcome page with contact form, CRA and NIS2 conformity assessments, and launch list subscription (sessions 38–39). Docker service, Cloudflare Tunnel route via nginx proxy.
- **Full prioritised backlog** — `memory/BACKLOG.md` created with 14 items across P0–P3 including AI Copilot and MCP API as future features.
- **Email alerts for critical compliance events (P0 #1)** — New `backend/src/services/alert-emails.ts` with 5 alert types: vulnerability found (critical/high), scan failed, SBOM stale, compliance gaps (>10%), CRA deadline approaching (12h/1h thresholds). Recipients resolved from stakeholders table by role_key at product + org levels, deduplicated. 24-hour deduplication via notifications metadata. Non-blocking (fire-and-forget). Wired into vulnerability-scanner.ts (sendScanNotifications), scheduler.ts (autoSyncProduct error, compliance gap, CRA deadline), github.ts (webhook stale handler). 12 new tests. **Total: 943 backend tests passing.**
- **Technical file N+1 query fix** — `ensureSections()` was running 8 individual INSERT queries per product sequentially (2,209 test products × 8 = 17,672 round trips). Refactored to chunked multi-row INSERT (100 products per chunk). Added `idx_technical_file_sections_product` index on `product_id`. Response time: 15s+ timeout → ~2s. Fixed the only flaky test in the suite.

**Session 16 (2026-03-04):**
- **CRA readiness scorecard on dashboard (P0 #3)** — SVG ring gauge showing overall CRA compliance percentage on Dashboard. Per-product CRA readiness column in the products table. Shared `obligation-engine.ts` for obligation counting. 6 new tests. **Total: 949 backend tests passing.**
- **CVD policy template generator (P0 #4)** — New endpoint `GET /api/technical-file/:productId/cvd-policy/pdf`. Generates an ISO 29147-aligned Coordinated Vulnerability Disclosure policy PDF pre-filled with org/product data. PDFKit with EU-blue styling, DRAFT watermark. "Download CVD Policy" button on vulnerability_handling section in ProductDetailPage. 5 new tests. **Total: 954 backend tests passing.**
- **Ghost button contrast fix** — Brightened dark text buttons from `#003399`/`#7c3aed` to `#60a5fa`/`#a78bfa` across ProductDetailPage.css and TechnicalFilesPage.css for visibility on dark surfaces.
- **Pre-prod cleanup (P0 #5)** — Deleted `backend/src/routes/dev.ts` (nuke-account + seed-notifications). Removed nuke-account UI from Sidebar. Created `backend/src/utils/logger.ts` with LOG_LEVEL gating (error/warn/info/debug). Converted ~80 console.log/warn across 6 service files to structured logger. Added LOG_LEVEL env var to docker-compose.yml. DEV_SKIP_EMAIL verified false in production.

**Session 17 (2026-03-04):**
- **In-field tooltips and contextual help (P1 #7)** — New reusable `HelpTip` component (`frontend/src/components/HelpTip.tsx` + CSS). Info icon with hover/tap tooltip, click-outside dismiss, dark theme styling. Integrated in 4 locations: ObligationsPage (obligation descriptions from existing API data), StakeholdersPage (6 CRA role explanations), ProductDetailPage CRA category selector (Default/Important I/II/Critical), ProductDetailPage technical file sections (Annex VII guidance for all 8 sections).
- **Standalone report exports (P1 #6)** — New route `backend/src/routes/product-reports.ts` with 3 per-product export endpoints supporting PDF and CSV: `GET /api/products/:productId/reports/vulnerabilities`, `GET /api/products/:productId/reports/licences`, `GET /api/products/:productId/reports/obligations`. PDFKit-styled PDFs with cover page, summary stats, and data tables. Export PDF/CSV buttons added to RiskFindingsTab and ObligationsTab in ProductDetailPage, and to LicenseCompliancePage expanded findings panel. 18 new tests. **Total: 972 backend tests passing.**

**Session 18 (2026-03-04):**
- **End-of-support tracking (P1 #9)** — Surfaces support period status across the platform. Dashboard backend (`dashboard.ts`) extended to extract `end_date` from technical file `support_period` section JSONB, computes status (active/ending_soon/ended/not_set) with days remaining. New "Support" column in dashboard products table with coloured badge + subtitle. Obligation engine (`obligation-engine.ts`) derives `art_13_7` and `art_13_8` from support period (active → in_progress, ended → met/discharged). Scheduler (`scheduler.ts`) checks daily at 7 AM UTC for approaching end-of-support at 90/60/30/7/0 day thresholds, creates bell notifications and sends email alerts. New `sendSupportEndAlertEmail()` in `alert-emails.ts` (6th alert type). 4 new dashboard tests. **Total: 976 backend tests passing.**

**Session 19 (2026-03-05):**
- **Webhook integration E2E tests (P2 #12)** — Comprehensive end-to-end test file `backend/tests/routes/webhook-e2e.test.ts` (21 tests in 2 categories). **Category A** (13 tests): sends simulated push events with valid HMAC signatures using real webhook secrets loaded from `.env`. Tests full downstream chain for both GitHub (`X-GitHub-Event` + `GITHUB_WEBHOOK_SECRET`) and Forgejo (`X-Forgejo-Event` + `CODEBERG_WEBHOOK_SECRET`): SBOM marked stale in Postgres, push event record stored with correct provider/branch/commit count, notification created, user telemetry event logged. Edge cases: invalid/missing signature rejection, non-push event ignored, unknown repo URL returns no_match, dual-route (`/api/github/webhook` and `/api/repo/webhook`) compatibility. **Category B** (8 tests): real Forgejo round-trip using the local Forgejo instance on port 3003. Creates a test repo via Forgejo API, creates a CRANIS2 product, connects via PAT, syncs (auto-registers webhook — verifies webhookId in Neo4j + hook exists in Forgejo API), idempotent re-sync (same webhookId, no duplicate hooks), pushes file via Forgejo API and polls for webhook callback delivery (push event record appears, SBOM marked stale), disconnect cleanup (webhookId cleared, hook removed from Forgejo). Both categories skip gracefully when prerequisites unavailable. **Total: 997 backend tests passing (55 files).**

**Session 20 (2026-03-05):**
- **Smart deadline alerts (P1 #8)** — Two new proactive alert types in the scheduler at 8 AM UTC. **(A) CRA Milestone Alerts** (org-level): checks the two fixed CRA deadlines (Sep 2026 incident reporting, Dec 2027 full compliance) and notifies all orgs at 90/60/30 day thresholds via bell notification + email to `compliance_officer` and `manufacturer_contact`. Deduplication via unread notification check per milestone/threshold/org. **(B) Compliance Stall Alerts** (per-product): detects products with <100% CRA readiness and no obligation updates for >7 days. Bell notification + email to `compliance_officer` and `technical_file_owner`. Weekly deduplication (one per product per ISO week). New functions: `sendCraMilestoneAlertEmail()` and `sendComplianceStallAlertEmail()` in `alert-emails.ts` (alert types 7 and 8). `DEADLINES` exported from `compliance-checklist.ts` for scheduler reuse. Obligation engine imported for per-product readiness computation. **Total: 997 backend tests passing (55 files).**

**Session 21 (2026-03-05):**
- **Product-level activity log (P2 #10)** — Full product-scoped audit trail for CRA compliance evidence. New `product_activity_log` Postgres table with `old_values`/`new_values` JSONB for before/after diffs, indexed on (product_id, created_at). Non-blocking `logProductActivity()` service in `activity-log.ts` (never throws). GET `/api/products/:productId/activity` endpoint with action + entity_type filters, paginated (50/page). Instrumented 6 backend files with 8 event types: `obligation_status_changed` and `obligation_notes_updated` (obligations.ts — captures old/new status/notes), `technical_file_updated` (technical-file.ts — old/new status), `product_created` and `product_updated` (products.ts — field-level diff), `repo_synced` (github.ts — packageCount/contributors/version), `stakeholder_updated` (stakeholders.ts — old/new name/email), `vulnerability_scan_completed` (vulnerability-scanner.ts — per-product findings breakdown). Frontend Activity tab on ProductDetailPage with timeline UI: coloured entity-type dots (purple=obligations, amber=tech file, green=scans/repos, blue=product/stakeholder), inline old→new value diffs, filter dropdowns, paginated load-more. **Total: 997 backend tests passing (55 files).**

- **Multi-product compliance heat map (P2 #11)** — Visual heat map grid on dashboard for orgs with 2+ products. CSS Grid with products as rows (sorted worst-first) and 5 compliance dimensions as columns: CRA Readiness, Technical File, Vulnerabilities (critical+high), SBOM Health, Support Period. Each cell colour-coded green/amber/red with value. Top Blockers section beneath shows prioritised actions with linked product names (critical compliance gaps, critical vulns, expired support, stale SBOMs, low tech file). Frontend-only — all data from existing `GET /api/dashboard/summary`. **Total: 997 backend tests passing (55 files).**

**Session 22 (2026-03-05):**
- **AI Copilot — contextual AI Suggest buttons (P3 #13)** — In-app AI assistant that generates CRA compliance content using Claude (claude-sonnet-4-20250514), grounded in the product's actual data. Backend: new `copilot.ts` service gathers `ProductContext` from Postgres + Neo4j (SBOM, vulnerabilities, obligations, tech file statuses, repo metadata), builds context-rich prompts, returns structured JSON for tech file sections or plain text for obligation evidence. New `copilot.ts` route with `POST /api/copilot/suggest` and `GET /api/copilot/status`. Usage tracked in `copilot_usage` table (org_id, user_id, tokens, model). New `requirePlan.ts` middleware gates features behind billing tiers (standard < pro < enterprise). Frontend: "AI Suggest" button on all 8 tech file sections (blue gradient, distinct from purple Auto-fill) with pulsing "Generating…" feedback banner. Collapsible "Evidence Notes" textarea on each obligation card with save button and AI Suggest. 403 handling shows upgrade-to-Pro banner. **Total: 997 backend tests passing (55 files).**

- **Pro plan + admin-configurable pricing** — Two-tier billing system enabling AI Copilot gating. Backend: `platform_settings` key-value table for admin-configurable pricing (seeded: contributor €6, pro product €20), `ensureStripePrices()` auto-creates Stripe products/prices at startup via API, `createCheckoutSession()` accepts plan param with multi-line-item checkout for Pro (product × count + contributor × count), webhook handlers updated for multi-plan (metadata + line item count detection), `upgradeToProPlan()` / `downgradeToStandardPlan()` modify existing Stripe subscriptions with proration, new routes POST `/upgrade`, POST `/downgrade`, GET/PUT `/admin/pricing`. Frontend billing page: two-column plan selection grid (Standard + Pro with "Recommended" badge) for trial/cancelled users, dynamic pricing from API, active subscribers see current plan with Upgrade/Downgrade buttons. Admin billing page: Pricing Configuration card with editable contributor and pro product prices, save creates new Stripe prices if amounts changed. **Total: 997 backend tests passing (55 files).**

**Session 23 (2026-03-05):**
- **Stripe checkout fix** — Added `customer_update: { address: 'auto', name: 'auto' }` to Stripe checkout session for automatic tax + tax ID collection. Pro product price reduced from €20 to €3/month (later increased to €9/month in session 27).
- **Full route test coverage** — Test coverage audit identified 7 untested routes. Created 7 new test files (54 tests): `copilot.test.ts` (9 — auth, status shape, Pro plan gating, validation, cross-org), `product-activity.test.ts` (9 — auth, shape, pagination, filters, cross-org), `dependencies-overview.test.ts` (6 — auth, shape, totals, cross-org, empty org), `repos-overview.test.ts` (6), `contributors-overview.test.ts` (6), `technical-files-overview.test.ts` (7 — sections, progress), `docs.test.ts` (11 — public GET, admin PUT, validation). Route test coverage: 33/33 (100%). **Total: 1051 backend tests passing (62 files).**

**Session 24 (2026-03-05):**
- **AI auto-triage vulnerabilities (P3 #15)** — AI-powered vulnerability triage on Risk Findings tab. Claude analyses each finding against product context (SBOM, description, category) and suggests dismiss/acknowledge/escalate with confidence scores and mitigation CLI commands. Pro plan gated. `POST /api/copilot/triage` endpoint. 5 new tests.
- **Copilot usage dashboard (P3 #27)** — Org-level billing page section showing Copilot usage: current month totals (requests, input/output tokens, estimated cost USD), 6-month history, breakdown by type and product. `GET /api/copilot/usage` endpoint. Admin billing page shows platform-wide usage. Product overview shows compact usage widget. 9 new tests.
- **Risk assessment generator (P3 #16)** — AI-powered CRA risk assessment generation. Produces structured methodology, threat model, risk register, and 13 Annex I Part I requirement mappings from product context. PDF export. `POST /api/copilot/generate-risk-assessment` endpoint. 5 new tests.
- **Removed Export PDF from Risk Findings tab** — Poor quality PDF removed.
- **AI incident report drafter (P3 #17)** — AI-powered drafting for ENISA Article 14 report stages (early warning, notification, final report). Generates stage-appropriate content grounded in product data, linked vulnerability findings, and previously submitted stages. Non-destructive merge (only fills empty fields). `POST /api/copilot/draft-incident-report` endpoint with `gatherIncidentReportContext()` and `generateIncidentReportDraft()` in copilot service. `REPORT_STAGE_FIELDS` maps 6 stage×type combinations to exact form fields. CRA Article 14-specific system prompt for CSIRT/ENISA regulatory tone. 5 new tests. **Total: 1070 backend tests passing (62 files).**
- **Org-level CSIRT country setting** — New `csirt_country` column on `org_billing`. "ENISA Reporting Settings" card on Billing page with country dropdown. Report creation auto-populates CSIRT from org default (per-report override preserved). `GET/PUT /api/billing/csirt-country` endpoints.
- **Select All EU member states** — One-click "Select All EU" / "Deselect All" toggle in the create report modal member states grid.

- **CRA category recommender (P3 #18)** — Deterministic + AI-augmented CRA category classification. 4 risk attributes (distribution scope, data sensitivity, network connectivity, user criticality) each scored 0.0–1.0, normalised average mapped to CRA thresholds (default/important_i/important_ii/critical). Claude API augmentation provides contextual adjustment and confidence score. Admin rule editing with AI-assessed regulatory alignment validation. Full audit trail for recommendations, user actions (accept/override/dismiss), and rule changes. Backend: `category-recommendation.ts` service (deterministic scoring), `category-ai-augmentation.ts` (Claude augmentation), `category-rule-validator.ts` (rule change validation). Routes: `POST /:productId/category-recommendation`, `GET /:productId/category-recommendation-history`, `POST /:productId/category-recommendation/:recId/action`, admin rule CRUD. Frontend: `CategoryRecommenderModal` on product detail page with risk breakdown gauge, AI assessment card, category selector, accept/override/dismiss actions. DB: `category_rule_attributes`, `category_rule_attribute_values`, `category_thresholds`, `category_recommendations`, `recommendation_access_log`, `category_rule_changes` tables seeded on startup. 26 backend integration tests + 16 E2E acceptance tests. **Total: 1107 backend tests passing (64 files).**

**Session 25 (2026-03-06):**
- **Supplier due diligence (P3 #19)** — Deterministic template-based questionnaires for supply chain due diligence. Risk flags (copyleft licence, known vulnerability, high severity vuln, no supplier info) map to pre-written CRA-grounded questions — no AI dependency. Supplier enrichment from npm/PyPI/crates.io registries with shared 30-day Postgres cache (`supplier_enrichment_cache` table). PDF/CSV export. Supply Chain tab on product detail page. Available to all plans (removed Pro gate). `supplier-due-diligence.ts` service + route. `SupplyChainTab.tsx` frontend component.
- **Supplier Marketplace backlog (P4 #28–34)** — Captured viral growth loop concept: manufacturers invite suppliers via questionnaires, suppliers join and publish compliance profiles, due diligence auto-resolves. 7 items with detailed subtasks for initial implementation (#28 invitation flow, #29 supplier profiles, #30 auto-resolution).
- **AI design principle established** — Only use LLMs within the app when they add value that cannot be gained deterministically. Template/rule-based approaches preferred for predictable logic.

**Session 26 (2026-03-06):**
- **Compliance gap narrator (P3 #20)** — Deterministic gap analysis service. Gathers obligations, tech file sections, vulnerability findings, SBOM status, stakeholder contacts, and support period for a product, then generates a prioritised action list. Each gap includes CRA article reference, action description, and navigation target. "Next Steps" card on product OverviewTab with progress bar, priority badges (critical/high/medium/low), and navigable gap items. `compliance-gaps.ts` service + route. `GET /api/products/:productId/compliance-gaps`. No AI dependency. **P3 tier now fully complete (all 8 items shipped).**
- **Navigation fix** — Fixed gap narrator and checklist "Go" buttons not switching tabs. Added `onSwitchTab`/`onNavigate` callback props from parent component.
- **Trello task creation (P5 #26)** — Per-product Trello board mapping with automatic card creation for 4 compliance event types. Backend: 3 new tables (`trello_integrations`, `trello_product_boards`, `trello_card_log`), `trello.ts` service with Trello REST API helpers, CRUD for integrations/product boards, card creation with deduplication via unique event keys. 10 API endpoints in `routes/trello.ts` (config CRUD, board/list proxy, product board mapping, test card). Wired into `vulnerability-scanner.ts` (critical/high findings), `scheduler.ts` (deadline + stall alerts), `obligations.ts` (status changes to in_progress). All card creation non-blocking (`.catch(() => {})`). Frontend: `IntegrationsPage` with connect/disconnect flow, per-product board mapping with 4 list assignments (vulns, obligations, deadlines, gaps/stalls), test card sender. Added to Sidebar and router. **Total: 1126 backend tests passing (65 files).**

**Session 27 (2026-03-07):**
- **Trello integration fixes** — Auto-create default lists on empty Trello boards (info panel with descriptions, "Create Default Lists" button, auto-selects into dropdowns). Card resolution: when events are cleared in CRANIS2, a comment is added to the Trello card and `resolved_at` timestamp recorded (no move/archive/delete — board admin handles cleanup). `resolveCard`, `resolveCardsByPrefix` functions in `trello.ts`. Wired into vulnerability scanner (finding resolved), obligations (marked met), scheduler (stall cleared/readiness 100%).

**Session 28 (2026-03-07):**
- **Public API with API key auth (P4 #28)** — Complete public API for external service integration. `api_keys` table with SHA-256 hashed keys, `cranis2_` prefix + 40 hex chars, 4 read-only scopes (`read:products`, `read:vulnerabilities`, `read:obligations`, `read:compliance`). `requireApiKey` middleware validates `X-API-Key` header, checks scopes, updates `last_used_at`. Management routes at `/api/settings/api-keys` (session-auth: create/list/revoke). Public v1 routes at `/api/v1/` (API-key-auth): `GET /products`, `GET /products/:id`, `GET /products/:id/vulnerabilities` (with severity/status filters), `GET /products/:id/obligations` (with derived statuses), `GET /products/:id/compliance-status` (pass/fail based on zero critical+high gaps — the CI/CD gate endpoint). API Keys card on IntegrationsPage UI (create, copy, revoke). `/api/v1` exempt from billing gate. Neo4j DateTime serialisation to ISO strings. **Prerequisite for CI/CD gate (#22), MCP server (#14), IDE assistant (#21).**
- **Backlog reprioritised** — P4 renamed "Public API & External Integrations". CI/CD compliance gate marked PARKED_HIGH_PRIORITY (first post-launch integration). Slack, ChatOps, GRC bridge all PARKED.

**Session 29 (2026-03-07):**
- **CI/CD compliance gate (P4 #22)** — Configurable `threshold` query parameter on `GET /api/v1/products/:id/compliance-status` (critical, high [default], medium, low/any). Standalone `cicd/cranis2-gate.sh` bash script with env var validation, formatted output, exit codes 0/1/2. CI provider examples: `cicd/examples/github-actions.yml` (with `$GITHUB_STEP_SUMMARY` table), `cicd/examples/gitlab-ci.yml` (alpine image), `cicd/examples/generic-ci.sh` (Jenkins/CircleCI/Bitbucket). CI/CD Compliance Gate card on IntegrationsPage with expandable setup guide, tabbed code snippets (GitHub Actions / GitLab CI / Bash), copy-to-clipboard, threshold reference table. Verified end-to-end: gate script correctly returns FAIL with exit 1 when critical gaps exist.

**Session 30 (2026-03-07):**
- **Welcome page contact form** — Replaced "Open the Platform" CTA with name/email/position contact form. Backend `POST /contact` endpoint sends thank-you email to enquirer and lead notification to `info@cranis2.com` via Resend API (`noreply@poste.cranis2.com` verified domain). Node 20 native `fetch`, no extra dependencies.
- **Pro plan feature gating** — Moved "Public API & CI/CD gate" and "Marketplace listings" from Standard to Pro tier. Backend: `requirePlan('pro')` on API key management routes, belt-and-braces plan check in `requireApiKey` middleware, `requirePlan('pro')` on marketplace profile PUT. Frontend: `orgPlan` field on `/api/auth/me` response, upgrade banners on IntegrationsPage (API Keys + CI/CD cards) and MarketplaceSettingsPage for Standard-plan users. Welcome page pricing updated.
- **AI Copilot cost protection (three layers):**
  1. **Per-org monthly token budget** — `copilot.monthly_token_limit` platform setting (default 500K tokens/month, admin-configurable). Per-org override via `org_billing.copilot_token_limit` column. `requireTokenBudget()` middleware checks current month's `copilot_usage` against limit, returns 429 with usage info when exceeded. `/api/copilot/status` now returns `tokenBudget: { used, limit, remaining }`.
  2. **Per-endpoint rate limiting** — `requireCopilotRateLimit()` middleware using Postgres-based counting against `copilot_usage`. Limits: suggest 20/product/hour, triage 5/product/hour, risk assessment 3/product/day, incident report 5/report/day, category recommendation 5/product/day. Returns 429 with details when exceeded.
  3. **Response caching** — `copilot_cache` table with SHA-256 hash of product context data. 24-hour TTL. On cache hit: returns cached response with `tokensUsed: 0, cached: true`. Applied to suggest (non-refinement), risk assessment. Automatically invalidated when product data changes (context hash changes).
  - Category recommendation route now logs AI usage to `copilot_usage` (previously missing). `AIAugmentation` type extended with `inputTokens`/`outputTokens`.
  - New files: `middleware/copilotLimits.ts`, `services/copilot-cache.ts`. New table: `copilot_cache`. New column: `org_billing.copilot_token_limit`.

**Session 31 (2026-03-07):**
- **Welcome page pricing overhaul** — Enhanced feature descriptions for both Standard and Pro plans with frequency/timeliness qualifiers (e.g. "Daily automated dependency discovery", "Continuous vulnerability scanning", "Real-time alert emails"). Added missing features (supplier due diligence, Trello integration). Stacked pricing cards vertically (single column, max-width 640px) for cleaner layout. Removed incorrect "unlimited products" footer claim, replaced with "unlimited compliance exports and repository connections".
- **Pro plan price increase** — Changed Pro plan price from €3 to €9/product/month across welcome page, platform_settings seed (`billing.pro_product_price_cents` 300→900), and live database. Reflects expanded feature set and value proposition. Stripe will auto-create a new price object on next checkout.

**Session 32 (2026-03-07):**
- **Bug #29 fix** — CRA category naming mismatch between frontend and backend. Standardised on `default`, `important_i`, `important_ii`, `critical` (matching obligation engine and category_thresholds table). Updated ProductsPage, ProductDetailPage, AdminOrgsPage, and backend product create/update validation.
- **MCP Server (P4 #14)** — Complete Model Context Protocol server for IDE AI assistants. 5 tools: `list_products`, `get_vulnerabilities` (with severity/status filters + inline mitigation commands), `get_mitigation` (ecosystem-aware bash commands for 12+ package managers: npm, pip, cargo, go, maven, nuget, gem, composer, hex, pub, cocoapods, swift), `verify_fix` (triggers SBOM rescan, polls for completion, compares before/after findings, auto-resolves if fixed), `get_compliance_status` (pass/fail with gap summary). New backend endpoints: `POST /api/v1/products/:id/sync` (async background scan), `GET /api/v1/products/:id/scans/:scanId` (poll status), `PUT /api/v1/products/:id/findings/:findingId/resolve` (mark resolved with evidence JSON). Added `write:findings` to default API key scopes. 20 new backend tests all passing. README with setup instructions for Claude Desktop, VS Code, Cursor, and Claude Code.

**Session 33 (2026-03-08):**
- **IDE compliance assistant (P4 #21)** — In-app setup wizard on Integrations page. IdeAssistantCard with IDE selector tabs (VS Code, Cursor, Claude Desktop, Claude Code), API key picker, auto-generated JSON config snippets, copy-to-clipboard, tools table, example workflow. Pro plan gated. Frontend-only component.
- **Compliance document templates (P6 #35–37)** — Template download page with 7 CRA-aligned document templates: Versioning (Art. 13(9)), CVD (Art. 13(6)), Vuln Handling (Art. 13(5)), Security Updates (Art. 13(8)), Incident Response (Art. 14), End-of-Support (Art. 13(15)), Secure Dev Lifecycle (Annex I). Auto-populated from product/org/stakeholder data with product selector modal, version format auto-detection, delivery model mapping, stakeholder role mapping. All templates reference CRANIS2 AI/MCP with HITL.

**Session 34 (2026-03-09):**
- **CRA Action Plan guided workflow** — Per-product action plan page (`/products/:id/action-plan`). Visual pipeline merging 7-step compliance checklist (Phase 1) + compliance gaps (Phase 2) + advisory steps. Dashboard CTA, per-product links, OverviewTab link. Readiness ring with visibilitychange auto-refresh. Pure frontend: `action-plan-merge.ts`, `ActionPlanPage.tsx/css`.
- **Product lifecycle stage** — Lifecycle-aware readiness framing (development, pre-market, in-market, end-of-support) with stage-appropriate messaging throughout the platform.

**Session 35 (2026-03-10):**
- **Test infrastructure fix** — Fixed 4 root causes of flaky tests: (1) stale copilot rate-limit rows causing 429s, (2) billing plan drift from public-api-v1.test.ts upgrading to Pro without cleanup, (3) seed running per-fork instead of once, (4) Cloudflare tunnel hammering. Added `clean-rate-limits.ts` (cleans copilot_usage, duplicate findings, resets billing plans). Added afterAll in public-api-v1 to restore plans. Result: 1147/1147 passing, 483s (was 887s — 37% faster).
- **Nightly test runner** — `scripts/nightly-tests.sh` with cron at 20:00 UTC (22:00 CEST). Pre-flight health check, verbose vitest output, stdout-based result parsing, 14-day log retention.
- **Bug #29 fix** — "Not Stated?" CRA category display on Products & Compliance pages. Added legacy value normalisation to `formatCategory()` in 3 frontend pages (`category-1`/`class_i` → `important_i`, `category-2`/`class_ii` → `important_ii`). Updated seed data and Neo4j product nodes from legacy to canonical category values.

**Session 36 (2026-03-10):**
- **Flaky risk-findings test fix** — Changed status filter test from `?status=resolved` (single fragile finding) to `?status=open` (multiple robust findings), eliminating cross-file state pollution.
- **Nightly test Trello notification** — Created "Test Results" Trello board with Passed/Failed lists. Updated nightly script to post a card after each run with pass/fail status, test counts, timing, and failed test names. Non-blocking (Trello failure doesn't break the script).

**Session 37 (2026-03-11):**
- **CoPilot prompt management (P7 #38 Phase 1)** — Quality standard document (`docs/copilot-quality-standard.md`) with 7 rules (Q1–Q7) for CRA-grounded AI output. `copilot_prompts` table seeded with 32 prompts: 1 foundation quality standard, 4 capability prompts (suggest, vulnerability_triage, risk_assessment, incident_report_draft), 8 section guidance prompts (section:*), 19 obligation guidance prompts (obligation:*). 3-layer architecture: quality standard preamble → regulatory context (section/obligation) → capability prompt. Admin UI at `/admin/copilot` with editable textareas, model/token/temperature controls. `GET/PUT /api/admin/copilot-prompts/:promptKey`. 5-minute in-memory cache with DB fallback.
- **Section + obligation prompt enrichment (P7 #38 Phase 2)** — `getGuidanceText()` loads section/obligation guidance from `copilot_prompts` table (5-min cache), injected into `generateSuggestion()` and obligation evidence generation. Section prompts provide Annex VII-specific CRA references. Obligation prompts provide per-article regulatory guidance. Full prompt inventory documented in `docs/prompts.md`.
- **Batch DB query optimisation** — Eliminated N+1 patterns causing 18 test timeouts. Batched obligation and stakeholder INSERT queries with 500-row chunking.
- **Isolated test infrastructure** — 5-layer safety architecture: separate containers (`backend_test` port 3011, `neo4j_test` port 7699), separate Postgres DB (`cranis2_test`), backend startup guards (verify DB URLs match `CRANIS2_TEST_MODE`), test-side guards (verify `cranis2_test` connection), port separation (no overlap possible). `test-stack.sh` script for start/stop/run. Docker Compose `test` profile.
- **Copilot cache bug fix** — Fixed cache returning same response for all obligations (was hashing only product context, not obligation key).
- **Admin copilot auth fix** — Fixed missing auth headers on admin copilot page API calls.

**Session 38 (2026-03-11):**
- **CRA Conformity Assessment (P9 #47)** — Full public CRA readiness assessment tool at `/cra-conformity-assessment`. 12 CRA-specific questions across 4 sections (Product Scope, Security Requirements, Conformity & Documentation, Vulnerability Management). Email verification flow (6-digit codes via Resend), assessment progress saved to Postgres (`assessments` table), results with per-section maturity scoring and recommendations. Emailed PDF-style HTML reports with progress bars. Lead notifications to `info@cranis2.com`. HMAC-signed unsubscribe tokens. Welcome site Express container on port 3004.
- **Launch list subscription** — Subscribe/unsubscribe system for assessment users. `assessment_subscribers` table. HMAC-signed unsubscribe links in all assessment emails. Shared endpoints at `/conformity-assessment/subscribe` and `/conformity-assessment/unsubscribe`.
- **Container memory optimisation** — Retuned container memory allocations for 16 GiB server with welcome site added.

**Session 39 (2026-03-12):**
- **Welcome page made public** — Removed authentication from `/` and `/contact` routes. Replaced "Sign Out" link with "Free CRA Assessment" link. Added welcome page URL to assessment report emails.
- **NIS2 Readiness Assessment** — Full 25-question NIS2 readiness assessment at `/nis2-conformity-assessment`. 7 sections (Applicability, Governance, Risk Management, Incident Reporting, Supply Chain, Business Continuity, Technical Measures). Entity classification (essential_critical/essential/important/not_in_scope) based on sector + size. Supervision regime details (proactive/reactive), penalty levels (€10M/2% vs €7M/1.4%), per-section maturity scoring, top recommendations. Email verification + progress saving + emailed reports. Extracted to `welcome/nis2-assessment.js` module (~1250 lines). Cross-links to CRA assessment. `nis2_assessments` Postgres table.
- **Assessment landing page** — `/conformity-assessment` serves a landing page with cards for both CRA and NIS2 assessments. URL reorganisation: CRA moved to `/cra-conformity-assessment`, NIS2 at `/nis2-conformity-assessment`. Shared subscribe/unsubscribe endpoints kept at original paths for backward compatibility with already-sent emails.
- **Navigation improvements** — "Returning?" info box on landing page explaining progress restoration. "← All assessments" back link on both assessment pages.

**Session 40 (2026-03-12):**
- **Codebase modularity refactor (P7 #40)** — Decomposed `backend/src/routes/technical-file.ts` (1,400+ lines) into focused sub-router modules: `sections.ts`, `suggestions.ts`, `cvd-pdf.ts`, `doc-pdf.ts`, `declaration.ts`, `checklist.ts`, `compliance-gaps.ts`, composed via `index.ts` with shared middleware in `shared.ts`. Follows established pattern from `routes/github/` and `routes/admin/`.
- **Docs update (P7 #41)** — Updated welcome page, USER-GUIDE.md, and FAQ.md to reflect all current platform capabilities including AI Copilot, public API, CI/CD gate, MCP server, IDE assistant, document templates, and Trello integration.
- **P8 10-Year Compliance Vault (all phases)** — Complete implementation of CRA Art. 13(10) evidence retention:
  - **Phase A** — Release-triggered evidence capture. `compliance_snapshots` and `retention_obligations` tables. `POST /api/products/:id/compliance-snapshot` assembles ZIP with technical file, obligations, SBOMs, vulnerability history, activity log, SHA-256 manifest, and self-verifying README. Retention deadline computed from market placement + 10 years or support period end.
  - **Phase B** — RFC 3161 timestamping. SHA-256 of snapshot ZIP submitted to FreeTSA.org, timestamp token (.tsr) stored alongside archive. `POST /api/products/:id/compliance-snapshot/:snapshotId/timestamp`.
  - **Phase C** — Ed25519 document signing. Platform signing keypair generated on first use (`SIGNING_PRIVATE_KEY`/`SIGNING_PUBLIC_KEY` env vars). Each snapshot signed with detached Ed25519 signature. Verification instructions in archive README.
  - **Phase D** — Retention reserve ledger. `retention_reserves` and `funding_certificates` tables tracking per-product storage cost reserves (€0.38/product/year). Funding certificate generation with HMAC-SHA256 verification. `GET /api/admin/retention/reserves`, `POST /api/admin/retention/fund`.
  - **Phase E** — Storage lifecycle controls. Retention status state machine (active → grace_period → pending_deletion → deleted). 90-day grace period on cancellation. `POST /api/admin/retention/:id/extend`, `POST /api/admin/retention/:id/delete`. Lifecycle transition audit logging.
  - **Phase F** — Automated snapshot scheduling. Quarterly cron job generates snapshots for all active products. Event-triggered snapshots on SBOM update, vulnerability scan, obligation change. SHA-256 deduplication skips unchanged content. Email notification on new archive.
  - **Phase G** — Retention dashboard for platform admins. `/admin/retention` page with aggregate stats (total obligations, storage estimate, funding status), filterable obligation table with status badges, per-obligation detail panel with snapshot history and lifecycle controls. HelpTip guidance icons throughout.
  - **Funding Run tab** — Bulk Wise transfer recording for retention reserve funding across multiple products.
  - **Auto-extend retention** — When a product's support period is updated, retention deadline automatically recalculates.

**Session 41 (2026-03-12):**
- **Welcome site content update** — Updated all public-facing content on the welcome site for current platform capabilities.
- **Editorial standard established** — Created `docs/EDITORIAL-STANDARD.md` defining the CRANIS2 foundational editorial prompt. 9 hard linting rules: em dash ban, colon discipline, triadic phrase suppression, hedging removal, transition minimalism, sentence rhythm control, bullet list discipline, consultancy cliche suppression, AI smoothness detection. UK English mandatory. Applied retrospectively to all welcome site content (16 files).

**Session 42 (2026-03-13):**
- **Full editorial standard sweep** — Applied em dash ban across the entire codebase:
  - Frontend: 55 files, 203 em dashes removed. Context-sensitive replacements (en dashes for label separators and ranges, full stops/commas/colons for prose clause-joiners).
  - Backend: 103 files, 692 em dashes removed. Copilot system prompts, obligation engine reason strings, licence scanner output, conformity assessment descriptions, route error messages, alert email content all updated.
  - Documentation: 28 UML diagram files (43 em dashes), USER-GUIDE.md (~150 edits including double-dash separators), LLD.md (UK English fix), USB-STORAGE-SETUP.md (UK English fixes). Fixed Unicode escape artefacts (`\u2013` literals) in EXECUTIVE-SUMMARY.md and CRANIS2-CAPABILITIES-AND-SAFEGUARDS.md.

**Session 43 (2026-03-13):**
- **Automation wizards (P7 #39)** — Three guided workflow wizards for common compliance tasks:
  - **Batch Fill wizard** — Bulk-populate technical file sections and obligation evidence from a single form. Product selector, section/obligation picker, AI-assisted content generation with review step, batch save. Accessible from Technical File tab.
  - **Post-Scan Triage wizard** — After a vulnerability scan completes, guides user through triaging new findings. Severity-sorted list with accept/mitigate/defer actions, bulk operations, notes per finding, summary confirmation step.
  - **Onboarding wizard** — First-time product setup flow. Steps: product details, repository connection, initial scan trigger, CRA category selection, key obligation review, technical file kickstart. Accessible from empty-state product list and dashboard CTA.

**Session 44 (2026-03-13):**
- **PDF to Markdown migration (#45)** — Replaced all 6 pdfkit-based PDF generators with Markdown output. 24 files changed, 986 insertions, 1,633 deletions.
  - Backend: 6 generators rewritten from async stream-based PDFDocument to sync string-based Markdown functions. Content-Type changed from `application/pdf` to `text/markdown; charset=utf-8`. Default format parameter changed from `pdf` to `md`. API route URLs unchanged.
  - Frontend: 9 files updated. Format types `'pdf'` to `'md'`, filenames `.pdf` to `.md`, button labels "Download PDF"/"Export PDF" to "Download Report"/"Export Report".
  - Tests: 5 test files updated. Content-type assertions, magic byte checks replaced with Markdown content assertions, format query params updated.
  - Dependency: Removed `pdfkit` and `@types/pdfkit` from package.json (~2MB saved).
  - Files affected: `technical-file/cvd-pdf.ts`, `technical-file/doc-pdf.ts`, `product-reports.ts`, `reports.ts`, `supplier-due-diligence.ts`, `services/due-diligence.ts` (backend); `ComplianceSummaryReport`, `VulnerabilityTrendsReport`, `AuditTrailReport`, `ObligationsTab`, `RiskFindingsTab`, `LicenseCompliancePage`, `TechnicalFilesPage`, `TechnicalFileTab`, `SupplyChainTab` (frontend).

**Session 45 (2026-03-13):**
- **OSCAL export layer / GRC bridge (#23)** — Built four OSCAL 1.1.2 compliant endpoints on the public API, enabling any OSCAL-compatible GRC tool (ServiceNow, Vanta, Drata, OneTrust) to pull CRA compliance data.
  - `GET /api/v1/oscal/catalog` — 19 CRA obligations as OSCAL controls, grouped by article. Static endpoint, no product context.
  - `GET /api/v1/products/:id/oscal/profile` — Category-filtered control selection (default/important_i/important_ii/critical).
  - `GET /api/v1/products/:id/oscal/assessment-results` — Full obligation assessment with manual + derived statuses as OSCAL findings (satisfied/not-satisfied), vulnerability posture observations, and product metadata.
  - `GET /api/v1/products/:id/oscal/component-definition` — Product metadata, SBOM availability, dependency summary (up to 500), and control implementations.
  - New service: `backend/src/services/oscal.ts` with deterministic UUID v5 generation for cacheable responses.
  - All endpoints use `requireApiKey` middleware with `read:compliance` scope. Pro plan required.
  - Frontend: GRC/OSCAL integration card added to Integrations page with endpoint table, curl quick-test, and 3-step GRC tool setup guide.
  - Tests: 20 new tests in `oscal.test.ts` — auth, cross-org isolation, structure validation, control counts, finding states, observations, version consistency.

**Session 46 (2026-03-13):**
- **Role-aware obligation engine (#45 Phase A)** — Extended the obligation engine to filter obligations by both CRA product category AND the economic operator role of the organisation.
  - Added `appliesToRoles` field to every obligation definition with type `CraRole` ('manufacturer' | 'importer' | 'distributor' | 'open_source_steward').
  - 16 new obligations: 10 importer obligations (Art. 18) covering conformity verification, CE marking, manufacturer contact, storage/transport, non-conformity reporting, ENISA reporting, documentation retention, and market surveillance cooperation; 6 distributor obligations (Art. 19) covering documentation verification, product handling, non-conformity reporting, ENISA reporting, market surveillance cooperation, and documentation retention.
  - Total obligations: 35 (19 manufacturer + 10 importer + 6 distributor). Open source stewards share manufacturer obligations.
  - `getApplicableObligations(craCategory, craRole?)` — backward-compatible; defaults to 'manufacturer' if no role passed.
  - `computeDerivedStatuses()` now includes role-specific derivation: importer obligations derive from DoC verification, documentation completeness, and ENISA reports; distributor obligations derive from documentation/marking checks and ENISA reports.
  - Wired `craRole` through all 10 call sites: obligations.ts, dashboard.ts, products.ts, product-reports.ts, public-api-v1.ts, scheduler.ts, compliance-snapshot.ts, compliance-gaps.ts, oscal.ts.
  - OSCAL catalog now includes all 35 obligations with `applies-to-roles` prop on each control.
  - Frontend requires no changes — dynamically renders whatever obligations the API returns.
  - Tests: 22 new tests (21 in obligation-engine-roles.test.ts + 1 new OSCAL test). Full suite: 1244 tests (73 files), 1228 pass, 16 expected infra-dependent failures.

- **Comprehensive test review and improvement (P0–P5)** — Full cross-reference audit of all backend endpoints, services, and E2E flows against test coverage, followed by systematic improvement:
  - **P0:** Fixed all 7 pre-existing E2E failures (marketplace profile, console errors, supplier DD tab). Zero E2E failures remaining.
  - **P1:** Added importer/distributor E2E personas and role-aware obligation rendering tests.
  - **P2:** Deepened 7 thin backend test files (audit-log, marketplace, notifications, due-diligence, billing, sbom-export, escrow) with field validation, content assertions, cross-org isolation.
  - **P3:** 3 new user journey integration tests (44 tests): onboarding journey, compliance package assembly, role-specific obligations.
  - **P4:** 4 new endpoint coverage test files (45 tests): retention ledger, admin vuln scan, snapshot schedule, document templates.
  - **P5:** Lockfile parser unit tests (43 tests) covering all 28 parsers with sample input, registry integrity, dispatcher routing, deduplication, error handling.
  - **Total:** ~207 new backend tests added across 14 new/expanded test files. Full suite: ~1,395 tests (81 files), ~1,379 pass, 16 expected infra-dependent failures.

**Next Steps:**
- #45 remaining phases: product-level operator context, importer verification workflow, public funnel tool
- #46 Post-market monitoring & field issue tracking
- #53 Cryptographic standards inventory
- Production deployment planning (Infomaniak hosting, cranis2.com)

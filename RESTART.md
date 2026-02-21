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
- **SSH:** `ssh mcburnia@192.168.1.107`
- **Project path:** `~/cranis2/`
- **Public URL:** `https://dev.cranis2.dev` (via Cloudflare Tunnel)
- **Node.js:** Available via nvm — always prefix commands with `source ~/.nvm/nvm.sh &&`
- **SSH key for GitHub:** `~/.ssh/id_ed25519` (has passphrase — user must run `git push` manually)
- **Cloudflare Tunnel:** `cloudflared` running as systemd service (`cloudflared.service`), config at `~/.cloudflared/config.yml`

## Step 1: Connect and Verify Server

```bash
ssh mcburnia@192.168.1.107 "echo 'Connected' && hostname && uname -a"
```

## Step 2: Check Docker Containers

All four must be running:

```bash
ssh mcburnia@192.168.1.107 "docker ps --filter name=cranis2 --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
```

Expected containers:

| Container | Image | Port | Purpose |
|-----------|-------|------|---------|
| cranis2_nginx | nginx:alpine | 3002 → 80 | Serves React build + reverse proxy to API |
| cranis2_backend | cranis2-backend | 3001 → 3001 | Express API server |
| cranis2_postgres | postgres:16-alpine | 5433 → 5432 | Application database (users, auth, GitHub connections) |
| cranis2_neo4j | neo4j:5-community | 7475 → 7474, 7688 → 7687 | Graph database (organisations, products, contributors, dependencies) |

If containers are down, start them:

```bash
ssh mcburnia@192.168.1.107 "cd ~/cranis2 && docker compose up -d"
```

## Step 3: Sync Code from GitHub

The server may have been restarted overnight. Always pull latest:

```bash
ssh mcburnia@192.168.1.107 "cd ~/cranis2 && git pull origin main"
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
ssh mcburnia@192.168.1.107 "source ~/.nvm/nvm.sh && cd ~/cranis2/frontend && npm install && npm run build"

# Rebuild and restart all services
ssh mcburnia@192.168.1.107 "cd ~/cranis2 && docker compose up -d --build && docker compose restart nginx"
```

## Step 5: Verify the App

```bash
ssh mcburnia@192.168.1.107 "curl -s -o /dev/null -w '%{http_code}' http://localhost:3002 && echo '' && curl -s http://localhost:3002/api/health"
```

Should return `200` and `{"status":"ok"}`. The app is accessible at:
- **Local:** `http://192.168.1.107:3002`
- **Public:** `https://dev.cranis2.dev` (via Cloudflare Tunnel)

---

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
- Product nodes (name, version, category, description, repoUrl, lifecycle status)
- GitHubRepo nodes (owner, name, description, stars, forks, language, visibility)
- Contributor nodes (githubLogin, avatarUrl, contributions count)
- Relationships: (Organisation)-[:BELONGS_TO]-(Product), (Product)-[:HAS_REPO]->(GitHubRepo), (GitHubRepo)-[:HAS_CONTRIBUTOR]->(Contributor)
- Dependency nodes + DEPENDS_ON relationships (future)
- Vulnerability/CVE nodes (future)
- Supply chain traversal queries (e.g. "which products are affected by this CVE through any depth of dependency?")

## Project Structure

```
~/cranis2/
  RESTART.md              ← This file
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
  public/                  ← Original HTML prototypes (reference only)
  backend/                 ← Express API service
    Dockerfile             ← Multi-stage build (builder for TS compile, production for runtime)
    src/
      index.ts             ← Express server entry (port 3001), inits Postgres + Neo4j, mounts all routes
      routes/
        auth.ts            ← POST /register, POST /login, GET /verify-email, GET /me
        org.ts             ← POST /org (create org), GET /org (get org), PUT /org (update org)
        products.ts        ← Full CRUD for products (Neo4j nodes linked to Organisation)
        github.ts          ← GitHub OAuth flow, repo sync, SBOM, versions, webhook
        technical-file.ts  ← CRA Annex VII technical file CRUD (8 sections)
        audit.ts           ← GET /audit/events (paginated audit log)
        dev.ts             ← Dev-only routes (nuke button — MUST REMOVE BEFORE PRODUCTION)
      db/
        pool.ts            ← Postgres pool + schema init (users, user_events, github_connections)
        neo4j.ts           ← Neo4j driver + graph schema init (constraints/indexes)
        schema.sql         ← Users table DDL (reference)
      services/
        email.ts           ← Resend email integration
        telemetry.ts       ← Passive telemetry — dual-write to Postgres + Neo4j
        github.ts          ← GitHub API client (READ-ONLY — GET requests + SBOM + releases/tags)
        scheduler.ts       ← Daily auto-sync scheduler (stale SBOMs at 2 AM)
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
      context/
        AuthContext.tsx     ← Auth state (user + orgId), login/logout/refreshUser, session check
      layouts/
        RootLayout.tsx     ← Wraps AuthProvider around all routes
        PublicLayout.tsx    ← No sidebar (landing, login, signup)
        AuthenticatedLayout.tsx ← Sidebar + auth guard + org guard
      components/
        Sidebar.tsx        ← Navigation with lucide-react icons (5 sections)
        PageHeader.tsx     ← Page title + timestamp
        StatCard.tsx       ← Metric display card
      pages/
        public/            ← LandingPage, LoginPage, SignupPage, CheckEmailPage, VerifyEmailPage
        setup/             ← WelcomePage, OrgSetupPage (wizard with CRA role selection)
        dashboard/         ← DashboardPage (fully migrated)
        products/          ← ProductsPage (list + add modal), ProductDetailPage (tabs + GitHub UI)
        compliance/        ← ObligationsPage, TechnicalFilesPage (stubs)
        repositories/      ← ReposPage, ContributorsPage, DependenciesPage, RiskFindingsPage (stubs)
        billing/           ← BillingPage, ReportsPage (stubs)
        settings/          ← StakeholdersPage (stub), OrganisationPage (live), AuditLogPage (live)
        notifications/     ← NotificationsPage (stub)
```

## Routes

**Public (no sidebar):**
- `/` → Landing page (product welcome + feature cards + pricing CTA)
- `/login` → Login (calls POST /api/auth/login)
- `/signup` → Registration with password strength meter (calls POST /api/auth/register)
- `/check-email` → "Check your inbox" confirmation
- `/verify-email?token=xxx` → Email verification handler
- `/welcome` → Post-verification welcome page (links to org setup)
- `/setup/org` → Organisation setup wizard

**Authenticated (with sidebar, requires JWT + org):**
- `/dashboard` → Dashboard (fully migrated with stats, tables, activity feed)
- `/notifications` → Notifications (stub)
- `/products` → Products list with add modal (live — CRUD backed by Neo4j)
- `/products/:productId` → Product detail with tabs + GitHub integration
- `/obligations` → CRA obligations (stub)
- `/technical-files` → Technical documentation (stub)
- `/repos` → Repository management (stub)
- `/contributors` → Contributor tracking (stub)
- `/dependencies` → Dependency/SBOM management (stub)
- `/risk-findings` → Vulnerability findings (stub)
- `/billing` → Billing (stub)
- `/reports` → Compliance reports (stub)
- `/stakeholders` → Team management (stub)
- `/organisation` → Organisation settings (live — editable)
- `/audit-log` → Audit trail (live — paginated event log)

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
(:Product {id, name, version, category, description, repoUrl, lifecycleStatus, createdAt, updatedAt})
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

**ProductDetailPage tabs**: Overview (product info + GitHub repo card + version history + SBOM summary + compliance progress), Obligations (stub), Technical File (CRA Annex VII — 8 expandable sections with inline editors, Annex I checklist, status tracking), Risk Findings (stub), Dependencies (SBOM table with ecosystem badges + language breakdown + contributors)

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
FRONTEND_URL=http://192.168.1.107:3002
EMAIL_FROM=info@cranis2.com
DEV_SKIP_EMAIL=true

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

`DEV_SKIP_EMAIL=true` in `.env` enables:
- Registration auto-verifies accounts immediately (skips email)
- Returns session token directly so user goes straight to /welcome
- Set to `false` once Resend domain (poste.cranis2.com) DNS is propagated

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

1. **After each user prompt** (not responses to questions), commit to git and remind the user to push to GitHub
2. **Never commit `.env`** — it contains credentials
3. **Build before deploying** — `npm run build` then `docker compose up -d --build`
4. **SSH key has passphrase** — user must handle `git push` manually
5. **Always use `source ~/.nvm/nvm.sh &&`** before any npm/node commands on the server
6. **Update RESTART.md** after significant changes

## NGINX Config Notes

- The `nginx/default.conf` file uses plain `$uri` / `$host` variables — **do NOT escape with `\$`** as it causes redirect loops (this was a bug we fixed)
- SPA routing: `try_files $uri $uri/ /index.html`
- API proxy: `location /api/` → `proxy_pass http://backend:3001/api/`
- GitHub callback URL `/api/github/callback` is proxied through NGINX to the backend

## Other Projects on This Server

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

The scheduler (`services/scheduler.ts`) checks every 60 minutes and runs the auto-sync at 2 AM for any stale SBOMs.

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

**Last updated:** 2026-02-21

**Completed:**
- Docker Compose stack (NGINX, Backend, Postgres, Neo4j)
- Vite + React + TypeScript scaffolding with all routes
- React Router with RootLayout for auth context
- Express backend with auth + org API endpoints
- Email verification via Resend (dev mode bypass active)
- User registration with password strength validation
- Login with JWT session tokens
- Auth context with protected routes (redirects to /login if no session, /setup/org if no org)
- Landing page fully migrated from HTML prototype
- Dashboard page fully migrated (stats, tables, risk cards, activity feed)
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

**Known Issues:**
- DNS for poste.cranis2.com still pending (DEV_SKIP_EMAIL remains true)
- Dev routes (`/api/dev/*`) must be removed before production
- SBOM debug logging still in `services/github.ts` (console.log statements) — remove before production

**Next Steps:**
- **Add sync duration tracking** — timestamp before each repo sync, measure elapsed seconds, store in DB for workload balancing at scale (3600+ repo contributors)
- Connect dashboard to real data from Postgres + Neo4j (currently prototype data)
- Switch DEV_SKIP_EMAIL to false once email domain is verified
- Remove dev routes before production deployment
- Remove SBOM debug logging from services/github.ts
- Migrate remaining stub pages:
  - Obligations, Repos, Contributors, Dependencies, Risk Findings
  - Billing, Reports, Stakeholders
- Implement Risk Findings (vulnerability tracking)
- Full dependency scanning and vulnerability correlation (Neo4j graph queries)
- Production deployment planning (Infomaniak hosting, cranis2.com)


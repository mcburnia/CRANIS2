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
- **SSH (direct):** `ssh mcburnia@192.168.1.107` (only works from user's own terminal)
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

## Step 2: Check Docker Containers

All four must be running:

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

If containers are down, start them:

```bash
ssh -p 2222 mcburnia@localhost "cd ~/cranis2 && docker compose up -d"
```

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

## Step 5: Verify the App

```bash
ssh -p 2222 mcburnia@localhost "curl -s -o /dev/null -w '%{http_code}' http://localhost:3002 && echo '' && curl -s http://localhost:3002/api/health"
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
- Dependency nodes + DEPENDS_ON relationships (live — from SBOM sync)
- Vulnerability findings tracked in Postgres (vulnerability_findings + vulnerability_scans tables)
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
        dashboard.ts       ← GET /dashboard (aggregate stats with vulnerability data)
        stakeholders.ts    ← GET/PUT stakeholders (org + product CRA contacts)
        technical-files-overview.ts ← GET /technical-files/overview (cross-product compliance)
        obligations.ts     ← GET/PUT obligations (cross-product status tracker)
        repos-overview.ts  ← GET /repos/overview (cross-product repo summary)
        contributors-overview.ts ← GET /contributors/overview
        dependencies-overview.ts ← GET /dependencies/overview (+ license analysis)
        risk-findings.ts   ← Vulnerability scanning + findings CRUD (5 endpoints)
        admin.ts           ← Platform admin endpoints (dashboard, orgs, users, invite, audit, system, vuln-scan, vuln-db)
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
        public/            ← LandingPage, LoginPage, SignupPage, CheckEmailPage, VerifyEmailPage, AcceptInvitePage, MarketplacePage, MarketplaceDetailPage
        setup/             ← WelcomePage, OrgSetupPage (wizard with CRA role selection)
        dashboard/         ← DashboardPage (fully migrated)
        products/          ← ProductsPage (list + add modal), ProductDetailPage (tabs + GitHub UI)
        compliance/        ← ObligationsPage (live), TechnicalFilesPage (live)
        repositories/      ← ReposPage (live), ContributorsPage (live), DependenciesPage (live), RiskFindingsPage (live)
        billing/           ← BillingPage, ReportsPage (stubs)
        settings/          ← StakeholdersPage (live), OrganisationPage (live), AuditLogPage (live), MarketplaceSettingsPage (live)
        notifications/     ← NotificationsPage (live — filters, mark-read, severity badges)
        admin/             ← AdminDashboardPage, AdminOrgsPage, AdminUsersPage, AdminAuditLogPage, AdminSystemPage, AdminVulnScanPage, AdminVulnDbPage
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

**Admin (platform admins only, separate layout):**
- `/admin` → Admin dashboard (cross-org platform statistics)
- `/admin/dashboard` → Same as above
- `/admin/orgs` → Organisation management (browse all orgs, drill-down)
- `/admin/users` → User management (search, filters, admin toggle, invite users via email)
- `/admin/audit-log` → Cross-org audit log (paginated, filterable by event type/email)
- `/admin/system` → System health (scan performance, DB row counts, error rates)
- `/admin/vuln-scan` → Vulnerability scanning (trigger scans, scan history, per-product breakdown)
- `/admin/vuln-db` → Vulnerability database (ecosystem stats, sync controls, advisory/CVE counts)

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

**Last updated:** 2026-02-25 (session 6)

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
- **Billing (Stripe)** -- Contributor-based pricing (EUR 6/month), 90-day trial, checkout sessions, customer portal, webhook, billing gate middleware, trial/payment lifecycle, billing emails (9 templates), admin controls (extend trial, exempt, pause)
- **Landing page** -- Hero, feature cards, audience cards, pricing CTA, regulation sections (CRA, NIS2, GDPR, EU Sovereignty, ISO)
- **Compliance Marketplace** -- Public marketplace for companies to list themselves with products and compliance badges. marketplace_profiles + marketplace_contact_log tables. Public browse page (/marketplace) with search/filter, detail page (/marketplace/:orgId) with contact modal, settings page (/marketplace/settings) with toggle/editor. Contact rate limiting (3/day, 1/org/7d). 10 categories. Admin approval controls.
- **Admin pages updated for local DB** — Dashboard shows last DB sync time, System Health shows Local DB Query avg latency (historical API latencies dimmed), Vuln Scan shows local DB timing as primary display

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

**Next Steps:**
- License compatibility matrix (distribution model on products, FSF rules, conflict detection)
- Historical compliance timeline (per-scan findings, timeline visualisation)
- Escrow capability
- Remove dev routes before production deployment
- Remove SBOM debug logging from services/github.ts
- Production deployment planning (Infomaniak hosting, cranis2.com)


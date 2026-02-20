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
- **Node.js:** Available via nvm — always prefix commands with `source ~/.nvm/nvm.sh &&`
- **SSH key for GitHub:** `~/.ssh/id_ed25519` (has passphrase — user must run `git push` manually)

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
| cranis2_postgres | postgres:16-alpine | 5433 → 5432 | Application database (users, auth) |
| cranis2_neo4j | neo4j:5-community | 7475 → 7474, 7688 → 7687 | Graph database (organisations, products, dependencies) |

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

Should return `200` and `{"status":"ok"}`. The app is accessible at `http://192.168.1.107:3002`.

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
| Database | PostgreSQL 16 | Port 5433, users table with auth + org linking |
| Graph DB | Neo4j 5 Community | Ports 7475/7688, Organisation nodes + future product/dependency graph |
| Containerisation | Docker Compose | All services in cranis2_net network |

## Technical Mandates

1. **Mobile-first responsive design** — must work on smartphones, tablets, and desktops
2. **React with HTML5/CSS3 output** — no CSS-in-JS frameworks
3. **NGINX serving production builds** — dev environment mirrors production (Infomaniak, Switzerland)

## Architecture: Postgres vs Neo4j

**Postgres** (relational data):
- Users, authentication, sessions
- Billing, subscriptions
- Audit logs
- User-to-organisation linking (org_id on users table)

**Neo4j** (graph data — supply chain relationships):
- Organisation nodes (name, country, size, CRA role, industry)
- Product nodes (future)
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
      index.ts             ← Express server entry (port 3001), inits Postgres + Neo4j
      routes/
        auth.ts            ← POST /register, POST /login, GET /verify-email, GET /me
        org.ts             ← POST /org (create org), GET /org (get user's org)
      db/
        pool.ts            ← Postgres connection pool + schema init (users table with org_id)
        neo4j.ts           ← Neo4j driver connection + graph schema init (constraints/indexes)
        schema.sql         ← Users table DDL (reference)
      services/
        email.ts           ← Resend email integration
      utils/
        password.ts        ← bcrypt hashing (12 salt rounds)
        token.ts           ← JWT generation/verification + email verification tokens
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
        AuthenticatedLayout.tsx ← Sidebar + auth guard + org guard (redirects to /login or /setup/org)
      components/
        Sidebar.tsx        ← Navigation with lucide-react icons (5 sections)
        PageHeader.tsx     ← Page title + timestamp
        StatCard.tsx       ← Metric display card
      pages/
        public/            ← LandingPage, LoginPage, SignupPage, CheckEmailPage, VerifyEmailPage
        setup/             ← WelcomePage, OrgSetupPage (wizard with CRA role selection)
        dashboard/         ← DashboardPage (fully migrated)
        products/          ← ProductsPage, ProductDetailPage (stubs)
        compliance/        ← ObligationsPage, TechnicalFilesPage (stubs)
        repositories/      ← ReposPage, ContributorsPage, DependenciesPage, RiskFindingsPage (stubs)
        billing/           ← BillingPage, ReportsPage (stubs)
        settings/          ← StakeholdersPage, OrganisationPage, AuditLogPage (stubs)
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
- `/notifications` → Notifications
- `/products` → Products list
- `/products/:productId` → Product detail
- `/obligations` → CRA obligations
- `/technical-files` → Technical documentation
- `/repos` → Repository management
- `/contributors` → Contributor tracking
- `/dependencies` → Dependency/SBOM management
- `/risk-findings` → Vulnerability findings
- `/billing` → Billing (Stripe metered)
- `/reports` → Compliance reports
- `/stakeholders` → Team management
- `/organisation` → Organisation settings
- `/audit-log` → Audit trail

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/auth/register | Create account, send verification email (or auto-verify in dev mode) |
| POST | /api/auth/login | Login with email/password, returns JWT |
| GET | /api/auth/verify-email?token=xxx | Verify email, redirect to /welcome |
| GET | /api/auth/me | Check session, returns user info + orgId + orgRole |
| POST | /api/org | Create organisation (Neo4j node + Postgres link) |
| GET | /api/org | Get current user's organisation from Neo4j |
| GET | /api/health | Health check |

## Database Schema

### Postgres — Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(255),
  token_expires_at TIMESTAMPTZ,
  org_id UUID,                          -- Links to Neo4j Organisation node
  org_role VARCHAR(50) DEFAULT 'admin', -- User's role within the org
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Neo4j — Graph Schema

```cypher
-- Constraints (auto-created on backend startup)
CREATE CONSTRAINT org_id_unique IF NOT EXISTS FOR (o:Organisation) REQUIRE o.id IS UNIQUE;
CREATE CONSTRAINT product_id_unique IF NOT EXISTS FOR (p:Product) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT dependency_id_unique IF NOT EXISTS FOR (d:Dependency) REQUIRE d.id IS UNIQUE;
CREATE CONSTRAINT vulnerability_cve_unique IF NOT EXISTS FOR (v:Vulnerability) REQUIRE v.cve IS UNIQUE;

-- Organisation node properties
(:Organisation {
  id: UUID,
  name: String,
  country: String,         -- e.g. "Germany", "France"
  companySize: String,     -- "micro", "small", "medium", "large"
  craRole: String,         -- "manufacturer", "importer", "distributor", "open_source_steward"
  industry: String,        -- e.g. "Software & SaaS", "IoT & Smart Devices"
  createdAt: DateTime,
  updatedAt: DateTime
})
```

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
DEV_SKIP_EMAIL=true   ← Set to false when email DNS is confirmed
```

**Docker-compose passes to backend:**
- `DATABASE_URL` (Postgres connection string)
- `NEO4J_URI=bolt://neo4j:7687`
- `NEO4J_USER`, `NEO4J_PASSWORD`
- All Resend/JWT/Email vars

## Dev Mode

`DEV_SKIP_EMAIL=true` in `.env` enables:
- Registration auto-verifies accounts immediately (skips email)
- Returns session token directly so user goes straight to /welcome
- Set to `false` once Resend domain (poste.cranis2.com) DNS is propagated

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

## Other Projects on This Server

- **Archoniq** — separate project using Postgres (port 5432) and Neo4j (ports 7474/7687). Do not interfere with these containers.

## Reference Materials

The `public/` directory contains the original HTML prototypes from the design phase. Use these as reference when migrating page content into React components. Key files:
- `public/app-shell.css` — design system source
- `public/dashboard.html` — sidebar layout and component patterns
- `public/landing.html` — public page layout

---

## Current Status

*Update this section at the end of each working session.*

**Last updated:** 2026-02-20

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
- **Neo4j integration** — Organisation nodes stored in graph database
- **Org setup wizard** — collects name, country, company size, CRA role, industry
- **Postgres ↔ Neo4j linking** — users.org_id references Organisation node in Neo4j
- NGINX config fix (escaped dollar signs bug resolved)

**In Progress:**
- Awaiting DNS propagation for poste.cranis2.com (Resend email domain)

**Next Steps:**
- Test full registration + org setup flow end-to-end in browser
- Switch DEV_SKIP_EMAIL to false once email domain is verified
- Migrate remaining stub pages from HTML prototypes (products, obligations, repos, etc.)
- Build product management CRUD (Neo4j Product nodes linked to Organisation)
- Build dependency/SBOM tracking (Neo4j DEPENDS_ON relationships)
- Connect dashboard to real data from Postgres + Neo4j

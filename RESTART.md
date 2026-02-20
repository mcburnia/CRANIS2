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
| cranis2_postgres | postgres:16-alpine | 5433 → 5432 | Application database |
| cranis2_neo4j | neo4j:5-community | 7475 → 7474, 7688 → 7687 | Graph database |

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
| Auth | bcrypt + JWT | Password hashing + session tokens |
| Database | PostgreSQL 16 | Port 5433, users table with email verification |
| Graph DB | Neo4j 5 Community | Ports 7475/7688 |
| Containerisation | Docker Compose | All services in cranis2_net network |

## Technical Mandates

1. **Mobile-first responsive design** — must work on smartphones, tablets, and desktops
2. **React with HTML5/CSS3 output** — no CSS-in-JS frameworks
3. **NGINX serving production builds** — dev environment mirrors production (Infomaniak, Switzerland)

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
    Dockerfile
    src/
      index.ts             ← Express server entry (port 3001)
      routes/auth.ts       ← POST /register, POST /login, GET /verify-email, GET /me
      db/pool.ts           ← Postgres connection pool + schema init
      db/schema.sql        ← Users table DDL
      services/email.ts    ← Resend email integration
      utils/password.ts    ← bcrypt hashing
      utils/token.ts       ← JWT + verification token generation
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
        AuthContext.tsx     ← Auth state, login/logout, session check
      layouts/
        RootLayout.tsx     ← Wraps AuthProvider around all routes
        PublicLayout.tsx    ← No sidebar (landing, login, signup)
        AuthenticatedLayout.tsx ← Sidebar + auth guard (redirects to /login)
      components/
        Sidebar.tsx        ← Navigation with lucide-react icons
        PageHeader.tsx     ← Page title + timestamp
        StatCard.tsx       ← Metric display card
      pages/
        public/            ← LandingPage, LoginPage, SignupPage, CheckEmailPage, VerifyEmailPage
        setup/             ← WelcomePage, OrgSetupPage
        dashboard/         ← DashboardPage (fully migrated)
        products/          ← ProductsPage, ProductDetailPage
        compliance/        ← ObligationsPage, TechnicalFilesPage
        repositories/      ← ReposPage, ContributorsPage, DependenciesPage, RiskFindingsPage
        billing/           ← BillingPage, ReportsPage
        settings/          ← StakeholdersPage, OrganisationPage, AuditLogPage
        notifications/     ← NotificationsPage
```

## Routes

**Public (no sidebar):**
- `/` → Landing page (product welcome + login/register)
- `/login` → Login (calls POST /api/auth/login)
- `/signup` → Registration (calls POST /api/auth/register)
- `/check-email` → "Check your inbox" confirmation
- `/verify-email?token=xxx` → Email verification handler
- `/welcome` → Post-verification welcome page
- `/setup/org` → Organisation setup

**Authenticated (with sidebar, requires JWT):**
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
| POST | /api/auth/register | Create account, send verification email |
| POST | /api/auth/login | Login with email/password, returns JWT |
| GET | /api/auth/verify-email?token=xxx | Verify email, redirect to /welcome |
| GET | /api/auth/me | Check session validity, returns user info |
| GET | /api/health | Health check |

## Database Schema

```sql
-- Users table (Postgres)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(255),
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Environment Variables (.env — NOT in git)

```
POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
NEO4J_USER, NEO4J_PASSWORD
RESEND_API_KEY
JWT_SECRET
FRONTEND_URL=http://192.168.1.107:3002
EMAIL_FROM=info@cranis2.com
DEV_SKIP_EMAIL=true   ← Set to false when email DNS is confirmed
```

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
- Mobile: < 768px (slide-out drawer)

## Workflow Rules

1. **After each user prompt** (not responses to questions), commit to git and remind the user to push to GitHub
2. **Never commit `.env`** — it contains credentials
3. **Build before deploying** — `npm run build` then `docker compose up -d --build`
4. **SSH key has passphrase** — user must handle `git push` manually
5. **Always use `source ~/.nvm/nvm.sh &&`** before any npm/node commands on the server

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
- Vite + React + TypeScript scaffolding
- React Router with all routes + RootLayout for auth context
- Express backend API with auth endpoints
- Email verification via Resend (dev mode bypass active)
- User registration with password strength validation
- Login with JWT session tokens
- Auth context with protected routes (redirects to /login)
- Landing page fully migrated from HTML prototype
- Dashboard page fully migrated (stats, tables, risk cards, activity feed)
- Public layout (landing, login, signup, check-email, verify-email, welcome)
- Authenticated layout with responsive sidebar

**In Progress:**
- Awaiting DNS propagation for poste.cranis2.com (Resend email domain)

**Next Steps:**
- Test full registration + login flow end-to-end
- Migrate remaining pages from HTML prototypes
- Implement org setup flow
- Connect to Postgres/Neo4j for real data
- Switch DEV_SKIP_EMAIL to false once email domain is verified

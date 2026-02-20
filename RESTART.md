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

All three must be running:

```bash
ssh mcburnia@192.168.1.107 "docker ps --filter name=cranis2 --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
```

Expected containers:

| Container | Image | Port | Purpose |
|-----------|-------|------|---------|
| cranis2_nginx | nginx:alpine | 3002 → 80 | Serves React build |
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

## Step 4: Rebuild Frontend (if needed)

If code was pulled or changes were made:

```bash
ssh mcburnia@192.168.1.107 "source ~/.nvm/nvm.sh && cd ~/cranis2/frontend && npm install && npm run build && cd ~/cranis2 && docker compose restart nginx"
```

## Step 5: Verify the App

```bash
ssh mcburnia@192.168.1.107 "curl -s -o /dev/null -w '%{http_code}' http://localhost:3002"
```

Should return `200`. The app is accessible from the local network at `http://192.168.1.107:3002`.

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 19 + TypeScript | Vite build tool |
| Styling | Plain CSS + CSS custom properties | Mobile-first, responsive |
| Routing | React Router v6 | Layout-based (public vs authenticated) |
| Icons | lucide-react | Replaces emoji icons from prototypes |
| Web server | NGINX (Docker) | Serves static React build, SPA routing |
| Database | PostgreSQL 16 | Port 5433 (5432 used by another project) |
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
  docker-compose.yml      ← Docker services (NGINX, Postgres, Neo4j)
  .env                    ← Credentials (NOT in git)
  .gitignore
  nginx/
    default.conf           ← NGINX config (SPA routing, gzip, caching)
  public/                  ← Original HTML prototypes (reference only)
  frontend/                ← React application
    index.html
    package.json
    vite.config.ts
    src/
      main.tsx             ← React entry point
      App.tsx              ← RouterProvider wrapper
      index.css            ← Global CSS (design system variables + utilities)
      router.tsx           ← All route definitions
      layouts/
        PublicLayout.tsx    ← No sidebar (landing, login, signup)
        AuthenticatedLayout.tsx ← Sidebar + responsive hamburger
      components/
        Sidebar.tsx        ← Navigation with lucide-react icons
        PageHeader.tsx     ← Page title + timestamp
        StatCard.tsx       ← Metric display card
      pages/
        public/            ← LandingPage, LoginPage, SignupPage
        setup/             ← OrgSetupPage
        dashboard/         ← DashboardPage
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
- `/login` → Login
- `/signup` → Registration
- `/setup/org` → Organisation setup

**Authenticated (with sidebar):**
- `/dashboard` → Dashboard
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

## Design System

Dark theme with these CSS custom properties (defined in `frontend/src/index.css`):

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
3. **Build before deploying** — `npm run build` then `docker compose restart nginx`
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
- Docker Compose stack (NGINX, Postgres, Neo4j)
- Vite + React + TypeScript scaffolding
- React Router with all routes
- Public layout (landing, login, signup)
- Authenticated layout with responsive sidebar
- All 15 app pages stubbed
- Design system ported to CSS

**In Progress:**
- Migrating page content from HTML prototypes to React components

**Next Steps:**
- Migrate LandingPage content from landing.html
- Migrate DashboardPage content from dashboard.html
- Migrate remaining pages
- Implement auth context and protected routes
- Connect to Postgres/Neo4j backends

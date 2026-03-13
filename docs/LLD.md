# CRANIS2 – Low-Level Design (LLD)

**Document Version:** 3.0
**Last Updated:** 2026-03-07
**Author:** Andi McBurnie, Loman Cavendish Ltd
**CRA Reference:** Annex VII Par. 2(a), System Architecture & Component Design

> This document replaces the original microservices-based LLD (`OLD/LLD.md`). It describes the **as-built** architecture of CRANIS2 and serves as design documentation for CRA Annex VII compliance. For the development lifecycle, see `docs/SDLC.md`.

---

## 1. Purpose & Scope

CRANIS2 is an EU-first SaaS platform that automates CRA and NIS2 compliance evidence collection for software manufacturers. This LLD documents the concrete implementation: deployment topology, backend/frontend architecture, data models, integrations, security controls, and scheduled operations.

**In scope:** All components deployed as part of the CRANIS2 platform.
**Out of scope:** Customer source code (CRANIS2 is observer-only), Cloudflare infrastructure, Stripe/Resend internals.

---

## 2. Deployment Architecture

### 2.1 Infrastructure

```
Internet
  │
  ▼
Cloudflare Tunnel (HTTPS termination, DDoS protection)
  │
  ▼
┌──────────────────────────────────────────────────────┐
│  Docker Compose Host (Intel i5-2520M, 3.8GB RAM)     │
│                                                       │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────┐ │
│  │  NGINX   │──▶│ Backend  │──▶│  PostgreSQL 16    │ │
│  │  (64MB)  │   │ (256MB)  │   │  (512MB)          │ │
│  │ port 3002│   │ port 3001│   │  port 5432        │ │
│  └──────────┘   └────┬─────┘   └──────────────────┘ │
│                      │                                │
│                      ├──▶ ┌──────────────────┐       │
│                      │    │  Neo4j 5          │       │
│                      │    │  (512MB)          │       │
│                      │    │  bolt:7687        │       │
│                      │    └──────────────────┘       │
│                      │                                │
│                      └──▶ ┌──────────────────┐       │
│                           │  Forgejo          │       │
│                           │  (256MB)          │       │
│                           │  port 3000        │       │
│                           └──────────────────┘       │
└──────────────────────────────────────────────────────┘
```

### 2.2 Container Configuration

| Container | Image | Memory Limit | Ports | Health Check |
|-----------|-------|-------------|-------|-------------|
| `cranis2_nginx` | nginx:alpine | 64MB | 3002→80 | HTTP GET / |
| `cranis2_backend` | Custom (Node 22) | 256MB | 3001 (internal) | TCP 3001 |
| `cranis2_postgres` | postgres:16-alpine | 512MB | 5432 (localhost) | pg_isready |
| `cranis2_neo4j` | neo4j:5 | 512MB | 7687 (internal) | cypher-shell |
| `cranis2_forgejo` | codeberg.org/forgejo/forgejo | 256MB | 3000 (internal), 3003 (external) | HTTP GET /api/healthz |

### 2.3 Network & Access

- **Public URL:** https://dev.cranis2.dev (development), https://cranis2.com (planned production)
- **Cloudflare Tunnel ID:** `fdce7420-f896-42d2-865d-1ec6ac8d4e7f`
- **NGINX** serves frontend static assets and proxies `/api/*` to the backend
- **Backend** is not directly accessible from the internet
- **Database ports** are bound to localhost only
- **Planned production hosting:** Infomaniak (Switzerland)

---

## 3. Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Frontend | React + TypeScript | 19.2 / 5.9 | SPA user interface |
| Build | Vite | 6.x | Frontend bundling |
| Routing | React Router | 6.x | Client-side routing |
| Icons | Lucide React | latest | UI iconography |
| Charts | Recharts | latest | Data visualisation |
| Backend | Express + TypeScript (ESM) | 5.x / 5.9 | REST API server |
| Runtime | Node.js | 22.x | Server runtime |
| Relational DB | PostgreSQL | 16 | Users, events, SBOM metadata, compliance data |
| Graph DB | Neo4j | 5.x | Products, dependencies, relationships |
| Escrow | Forgejo | latest | Self-hosted Git forge for source code escrow |
| Reverse Proxy | NGINX | alpine | Static serving, API proxy |
| Billing | Stripe | API v2024 | Subscriptions, payment processing |
| Email | Resend | API | Transactional email |
| PDF | PDFKit | latest | Due diligence report generation |
| ZIP | AdmZip | latest | Export package creation |

---

## 4. Backend Architecture

### 4.1 Entry Point (`backend/src/index.ts`)

The Express application initialises in this order:

1. **Database connections.** PostgreSQL pool + Neo4j driver
2. **Global middleware.** CORS, JSON body parser (1MB limit), static file serving
3. **Billing gate.** Peeks JWT from Authorization header, checks org billing status, blocks write operations (POST/PUT/DELETE) for `read_only`, `suspended`, or `cancelled` organisations
4. **Route mounting.** Static routes mounted before parameterised (Express 5 requirement)
5. **Scheduler start.** Cron jobs initialised
6. **Server listen.** Port 3001

### 4.2 Route Files

All routes are in `backend/src/routes/`. Each file is self-contained with its own auth middleware.

| File | Base Path | Methods | Description |
|------|-----------|---------|-------------|
| `admin.ts` | `/api/admin` | GET, POST, PUT, DELETE | Platform admin: dashboard stats, org/user management, vuln scanning, feedback triage, pricing config |
| `api-keys.ts` | `/api/settings/api-keys` | GET, POST, DELETE | API key management (Pro plan): create, list, revoke |
| `auth.ts` | `/api/auth` | POST, GET | Login, signup, email verification, password reset, session validation |
| `billing.ts` | `/api/billing` | GET, POST | Stripe plans, checkout, portal, webhook receiver, admin pricing |
| `category-recommendation.ts` | `/api/category-recommendation` | GET, POST | CRA category recommender: deterministic scoring + AI augmentation (Pro plan) |
| `compliance-checklist.ts` | `/api/compliance-checklist` | GET | Per-product 7-step compliance checklist with progress |
| `compliance-gaps.ts` | `/api/compliance-gaps` | GET | Deterministic compliance gap analysis + prioritised action list |
| `compliance-timeline.ts` | `/api/compliance-timeline` | GET | Historical compliance event timeline per product |
| `contributors-overview.ts` | `/api/contributors` | GET | Cross-product contributor overview |
| `copilot.ts` | `/api/copilot` | POST | AI Copilot: suggest (tech file + obligations), triage, risk assessment, incident draft (Pro plan) |
| `cra-reports.ts` | `/api/cra-reports` | GET, POST, PUT, DELETE | ENISA Article 14 reporting: 3-stage workflow (early warning → notification → final report) |
| `dependencies-overview.ts` | `/api/dependencies` | GET | Cross-product dependency + licence overview |
| `due-diligence.ts` | `/api/due-diligence` | GET | Preview + ZIP export (PDF, SBOM, CSV, metadata) |
| `escrow.ts` | `/api/escrow` | GET, POST, PUT | Source code escrow configuration and deposit management |
| `feedback.ts` | `/api/feedback` | GET, POST | User bug reports, feature requests, feedback |
| `github.ts` | `/api/github` + `/api/repo` | GET, POST, DELETE | OAuth flow, PAT connect, repo sync, webhook receiver |
| `ip-proof.ts` | `/api/ip-proof` | GET, POST | RFC 3161 IP proof snapshots |
| `license-scan.ts` | `/api/license-scan` | GET, POST | Licence compatibility scanning and recheck |
| `marketplace.ts` | `/api/marketplace` | GET, POST, PUT | Public marketplace listings, profile, contact (rate-limited) |
| `notifications.ts` | `/api/notifications` | GET, PUT | User notification inbox, mark read/dismissed |
| `obligations.ts` | `/api/obligations` | GET, PUT | CRA obligation tracking per product |
| `org.ts` | `/api/org` | GET, POST, PUT | Organisation CRUD, member listing |
| `product-activity.ts` | `/api/product-activity` | GET | Per-product activity log |
| `product-reports.ts` | `/api/product-reports` | GET | Per-product compliance reports |
| `products.ts` | `/api/products` | GET, POST, PUT, DELETE | Product CRUD (Neo4j), includes data exit ZIP on delete |
| `public-api-v1.ts` | `/api/v1` | GET | Public API: products, vulnerabilities, obligations, compliance-status (API key auth) |
| `repos-overview.ts` | `/api/repos` | GET | Repository dashboard: connected count, sync status, provider breakdown |
| `reports.ts` | `/api/reports` | GET | PDF/CSV report generation (3 report types) |
| `risk-findings.ts` | `/api/risk-findings` | GET, POST, PUT | Vulnerability findings per product, trigger scan, triage findings |
| `sbom-export.ts` | `/api/sbom` | GET | CycloneDX 1.6 + SPDX 2.3 export with SHA-512 hash enrichment |
| `stakeholders.ts` | `/api/stakeholders` | GET, PUT | CRA stakeholder roles (org-level + product-level) |
| `supplier-due-diligence.ts` | `/api/supplier-due-diligence` | GET, POST | Supplier questionnaires, enrichment, PDF/CSV export |
| `technical-file.ts` | `/api/technical-file` | GET, PUT | CRA Annex VII section editing (8 sections per product) |
| `technical-files-overview.ts` | `/api/technical-files` | GET | Cross-product technical file progress summary |
| `trello.ts` | `/api/trello` | GET, POST, PUT, DELETE | Trello integration: connect, board mapping, test, disconnect (Pro plan) |

### 4.3 Authentication & Authorisation

**Six layers of access control:**

```
Layer 1: requireAuth (per-route)
  ├── Extracts Bearer token from Authorization header
  ├── Calls verifySessionToken() → JWT payload { userId, email }
  └── Sets req.userId, req.email

Layer 2: requirePlatformAdmin (middleware/)
  ├── Runs after requireAuth
  ├── Queries users table for is_platform_admin = true
  └── Returns 403 if not admin

Layer 3: Billing Gate (global, index.ts)
  ├── Peeks JWT from Authorization header (non-blocking)
  ├── Queries org_billing for user's org
  └── Blocks POST/PUT/DELETE if status in (read_only, suspended, cancelled)

Layer 4: requireApiKey (middleware/)
  ├── Extracts Bearer token from Authorization header
  ├── SHA-256 hashes token, looks up in api_keys table
  ├── Validates scopes against required scope for endpoint
  └── Sets req.orgId, req.apiKeyId; used by /api/v1/* routes

Layer 5: requirePlan (middleware/)
  ├── Checks org_billing.plan against required tier (e.g. 'pro')
  ├── Tier hierarchy: standard < pro < enterprise
  └── Returns 403 with upgrade prompt if plan insufficient

Layer 6: AI Copilot middleware chain (copilotLimits.ts)
  ├── requireTokenBudget(): checks org monthly token usage against limit (429 if exceeded)
  └── requireCopilotRateLimit(): per-endpoint rate limiting via copilot_usage table
```

### 4.4 Services

| File | Purpose | Key Exports |
|------|---------|-------------|
| `scheduler.ts` | Cron job orchestration | `startScheduler()`: registers all timed jobs |
| `repo-provider.ts` | Multi-provider abstraction | `PROVIDER_REGISTRY`, `getRepo()`, `getContributors()`, `getLanguages()`, `getReleases()`, `getTags()`, `validatePAT()`, `generateSBOMFromLockfiles()` |
| `sbom-service.ts` | SBOM document generation | `generateCycloneDX(orgId, productId)`: builds CycloneDX 1.6 from Neo4j |
| `hash-enrichment.ts` | Package hash fetching | `enrichDependencyHashes(productId, packages)`: npm/PyPI registry lookups |
| `due-diligence.ts` | Export package builder | `gatherReportData()`, `generatePDF()`, `generateFindingsCSV()`, `generateDueDiligenceZIP()` |
| `vulnerability-scanner.ts` | Platform vuln scanning | Matches SBOM packages against vuln DB, writes findings |
| `vuln-db-sync.ts` | Vulnerability feed sync | OSV + NVD database synchronisation |
| `escrow-service.ts` | Source code escrow | Forgejo repository deposits via internal Docker network |
| `telemetry.ts` | Event recording | `recordEvent()`, `extractRequestData()`. Writes to user_events |
| `email.ts` | Transactional email | Resend API integration, from `info@poste.cranis2.com` |
| `alert-emails.ts` | Compliance alert emails | 6 alert types (vuln found, scan failed, SBOM stale, compliance gaps, CRA deadline, support expiry) |
| `billing-emails.ts` | Billing lifecycle emails | Trial expiry, payment failure, subscription change notifications |
| `obligation-engine.ts` | Obligation automation | `computeDerivedStatuses()`, `ensureObligations()`. 19 CRA obligations with derived statuses |
| `copilot.ts` | AI Copilot service | Claude API integration for suggest, triage, risk assessment, incident draft |
| `copilot-cache.ts` | AI response caching | SHA-256 context hashing, 24h TTL, `copilot_cache` table |
| `category-recommendation.ts` | CRA category scoring | Deterministic 4-attribute risk scoring for product classification |
| `category-ai-augmentation.ts` | AI category analysis | Claude API second opinion on CRA category classification |
| `category-rule-validator.ts` | Admin category rules | Validates admin-defined category override rules |
| `supplier-due-diligence.ts` | Supplier DD service | Questionnaire generation, npm/PyPI/crates.io enrichment, PDF/CSV export |
| `compliance-gaps.ts` | Gap analysis | Deterministic compliance gap computation and prioritised action list |
| `trello.ts` | Trello integration | Card creation, deduplication, resolution comments, board list management |
| `webhook.ts` | Webhook management | `ensureWebhook()`, `removeWebhooksForUser()`. Auto-registers push webhooks |
| `license-compatibility.ts` | Licence rules engine | 14 cross-licence incompatibilities, distribution model analysis |
| `license-scanner.ts` | Licence scanning | SPDX classification, copyleft detection, waiver tracking |
| `license-enrichment.ts` | Licence metadata | Registry lookups for licence details |
| `ip-proof.ts` | IP proof service | RFC 3161 timestamping, SHA-256 hash generation |
| `activity-log.ts` | Activity tracking | Per-product compliance activity recording |
| `notifications.ts` | Notification service | Create and manage user notifications |
| `marketplace.ts` | Marketplace service | Compliance badge computation for marketplace profiles |
| `api-keys.ts` | API key service | Key generation, SHA-256 hashing, scope validation |
| `billing.ts` | Billing service | Stripe integration, plan management, `ensureStripePrices()` |

### 4.5 SBOM Generation – Three-Tier Fallback

```
Tier 1: API SBOM (GitHub-only)
  └── GET /repos/{owner}/{repo}/dependency-graph/sbom
      ├── Returns SPDX 2.3 JSON
      └── Fastest path, limited to GitHub

Tier 2: Lockfile Parsing (all providers)
  └── Fetch lockfiles from repo via provider API
      ├── 28 lockfile parsers (package-lock.json, yarn.lock, Cargo.lock, go.sum, etc.)
      ├── Supports nested/workspace lockfiles
      └── Deterministic version extraction

Tier 3: Source Import Scanning (all providers)
  └── Scan source files for import/require statements
      ├── 26 language plugins (Python, JS/TS, Go, Rust, C/C++, Ruby, etc.)
      ├── Memory guards (max file size, max file count per repo)
      └── Inferred dependencies (no version pinning)
```

**Provider support:** GitHub, Codeberg, Gitea, Forgejo, GitLab. Tier 2 and 3 work with all providers via `getFileContent()` / `listRepoFiles()` dispatch.

### 4.6 Database Layer

| File | Purpose |
|------|---------|
| `db/pool.ts` | PostgreSQL connection pool (`DATABASE_URL` env var) |
| `db/neo4j.ts` | Neo4j Bolt driver (`NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`) |
| `db/test-pool.ts` | Separate pool for `cranis2_test` database (max 3 connections) |

### 4.7 Utilities

| File | Purpose |
|------|---------|
| `utils/token.ts` | JWT generation (`generateSessionToken`), verification (`verifySessionToken`), email verification tokens |
| `utils/encryption.ts` | AES-256-GCM encrypt/decrypt for PAT token storage (`GITHUB_ENCRYPTION_KEY`) |

---

## 5. Frontend Architecture

### 5.1 Build & Serving

- **Source:** `frontend/src/`, TypeScript + React + CSS
- **Build:** `npm run build` → Vite outputs to `frontend/dist/`
- **Serving:** NGINX container serves `dist/` as static assets
- **SPA routing:** NGINX `try_files $uri $uri/ /index.html` for client-side routing

### 5.2 Route Hierarchy

```
RootLayout
├── PublicLayout (unauthenticated)
│   ├── /              → LandingPage
│   ├── /login         → LoginPage
│   ├── /signup        → SignupPage
│   ├── /check-email   → CheckEmailPage
│   ├── /verify-email  → VerifyEmailPage
│   ├── /accept-invite → AcceptInvitePage
│   ├── /marketplace   → MarketplacePage
│   └── /welcome       → WelcomePage
│
├── AuthenticatedLayout (JWT required)
│   ├── /dashboard              → DashboardPage
│   ├── /products               → ProductsPage
│   ├── /products/:productId    → ProductDetailPage (tabbed: Overview, Obligations, Technical File, Risk Findings, Dependencies)
│   ├── /products/:productId/timeline → ComplianceTimelinePage
│   ├── /products/:productId/escrow   → EscrowPage
│   ├── /vulnerability-reports  → VulnerabilityReportsPage
│   ├── /vulnerability-reports/:id → ReportDetailPage (3-stage ENISA workflow)
│   ├── /obligations            → ObligationsPage
│   ├── /technical-files        → TechnicalFilesPage
│   ├── /license-compliance     → LicenseCompliancePage
│   ├── /ip-proof               → IpProofPage
│   ├── /due-diligence          → DueDiligencePage
│   ├── /repos                  → ReposPage
│   ├── /contributors           → ContributorsPage
│   ├── /dependencies           → DependenciesPage
│   ├── /risk-findings          → RiskFindingsPage
│   ├── /billing                → BillingPage
│   ├── /reports                → ReportsPage
│   ├── /stakeholders           → StakeholdersPage
│   ├── /organisation           → OrganisationPage
│   ├── /audit-log              → AuditLogPage
│   └── /notifications          → NotificationsPage
│
└── AdminLayout (platform admin only)
    ├── /admin/dashboard    → AdminDashboardPage
    ├── /admin/orgs         → AdminOrgsPage
    ├── /admin/users        → AdminUsersPage
    ├── /admin/audit-log    → AdminAuditLogPage
    ├── /admin/system       → AdminSystemPage
    ├── /admin/vuln-scan    → AdminVulnScanPage
    ├── /admin/vuln-db      → AdminVulnDbPage
    ├── /admin/feedback     → AdminFeedbackPage
    ├── /admin/billing      → AdminBillingPage
    └── /admin/test-results → AdminTestResultsPage
```

**URL aliases:** `/cra-reports` → `/vulnerability-reports`, `/vulnerabilities` → `/vulnerability-reports`, `/license-scan` → `/license-compliance`, `/sbom-export` → `/products`, `/escrow` → `/products`, `/settings` → `/organisation`

**Catch-all:** `*` → NotFoundPage (branded 404)

### 5.3 Sidebar Navigation (Accordion)

Only one section expanded at a time (`expandedSection` state):

| Section | Pages |
|---------|-------|
| **Dashboard** | Dashboard |
| **Compliance** | Products, Obligations, Technical Files, Vulnerability Reports, License Compliance, IP Proof, Due Diligence |
| **Source Code** | Repos, Contributors, Dependencies, Risk Findings |
| **Billing** | Plans & Usage, Reports |
| **Settings** | Organisation, Stakeholders, Integrations, Audit Log, Marketplace |
| **Feedback** | Feedback & Bug Report button (bottom, outside accordion) |

### 5.4 Shared Components

| Component | Props | Usage |
|-----------|-------|-------|
| `PageHeader` | title, timestamp?, children? | Page title bar on every page |
| `StatCard` | label, value, color, sub? | Dashboard metric cards |
| `FeedbackModal` | (internal state) | Bug/feature/feedback submission |

### 5.5 State Management

- **Auth:** `useAuth()` context → `{ user, loading, isPlatformAdmin }`
- **Session:** JWT stored in `localStorage.getItem('session_token')`
- **Page state:** Component-local `useState` / `useEffect`. No global store
- **API calls:** Native `fetch()` with Bearer token header

### 5.6 CSS Conventions

**Variables:** `--accent`, `--surface`, `--border`, `--muted`, `--text`, `--green`, `--amber`, `--red`, `--purple`

**Prefix convention per feature:**

| Prefix | Feature Area |
|--------|-------------|
| `ad-`, `ao-`, `au-`, `aal-`, `as-`, `avs-`, `avdb-`, `afb-` | Admin pages |
| `bill-`, `abill-` | Billing |
| `vr-`, `rd-`, `lc-`, `ipp-`, `dd-`, `ct-`, `esc-` | Compliance pages |
| `mp-`, `md-`, `ms-` | Marketplace |
| `rp-` | Repositories |
| `org-` | Organisation |
| `sk-` | Stakeholders |
| `tf-` | Technical File |
| `pd-` | Product Detail |
| `nf-` | Not Found page |

---

## 6. Data Architecture

### 6.1 PostgreSQL Schema

**Core tables:**

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | User accounts | id (UUID), email, password_hash, org_id (UUID), role, is_platform_admin, language |
| `user_events` | Telemetry | id, user_id, email, event_type, ip_address, user_agent, metadata (JSONB) |
| `org_billing` | Billing state | org_id (VARCHAR), stripe_customer_id, plan (standard/pro), status, trial_ends_at, copilot_token_limit |
| `platform_settings` | Admin config | key (VARCHAR PK), value (TEXT). Stores pricing, token budgets, Stripe price IDs |
| `feedback` | User feedback | id, user_id, category (bug/feature/feedback), subject, body, status, page_url |

**SBOM & Vulnerability tables:**

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `product_sboms` | SBOM metadata | product_id, sbom_source, package_count, synced_at, is_stale |
| `sbom_packages` | Package inventory | product_id, purl, name, version, ecosystem, license |
| `product_versions` | Version tracking | product_id, cranis_version, github_tag, source |
| `vulnerability_scans` | Scan runs | id, product_id, status, findings_count, started_at, completed_at |
| `vulnerability_findings` | Scan results | id, scan_id, product_id, package_purl, cve_id, severity, fixed_version |
| `vulnerability_db_osv` | OSV feed cache | ecosystem, package, vulnerability_id, severity, affected_versions |
| `vulnerability_db_nvd` | NVD feed cache | cve_id, description, severity, cvss_score, published_at |

**CRA Compliance tables:**

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `cra_reports` | ENISA reports | id, product_id, report_type (vulnerability/incident), status, csirt_country, awareness_at |
| `cra_report_stages` | Report stages | id, report_id, stage_type (early_warning/notification/final_report), content (JSONB), submitted_at |
| `technical_file_sections` | Annex VII docs | product_id, section_key, title, content (JSONB), notes, status, cra_reference |
| `stakeholders` | CRA roles | id, role_key, title, cra_reference, name, email, phone, org_id/product_id |
| `obligations` | CRA obligations | id, product_id, obligation_key, article, title, description, status |

**Integration tables:**

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `repo_connections` | Provider auth | user_id, provider, instance_url, access_token_encrypted, provider_username |
| `notifications` | User inbox | id, user_id, title, body, severity, read, dismissed |
| `audit_log` | Compliance audit | id, user_id, action, resource_type, resource_id, metadata (JSONB) |
| `escrow_users` | Escrow config | user_id, forgejo_username, agent_reference |
| `escrow_deposits` | Deposit records | id, product_id, forgejo_repo, commit_sha, deposited_at, status |
| `api_keys` | Public API auth | id, org_id, name, key_hash (SHA-256), key_prefix, scopes (JSONB), last_used_at |
| `trello_board_mappings` | Trello config | id, org_id, product_id, board_id, board_name, list_mappings (JSONB) |
| `trello_card_log` | Trello dedup | id, org_id, product_id, event_type, event_key, card_id, created_at |

**AI Copilot tables:**

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `copilot_usage` | Token tracking | id, org_id, product_id, endpoint, tokens_used, created_at |
| `copilot_cache` | Response cache | id, context_hash (SHA-256), response (JSONB), tokens_used, created_at, expires_at |
| `category_recommendation_audit` | Category audit | id, product_id, org_id, attributes (JSONB), deterministic_result, ai_result, admin_rule_applied, created_at |

**Supplier Due Diligence tables:**

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `supplier_questionnaires` | DD questionnaires | id, product_id, org_id, dependency_purl, template_key, status, created_at |
| `supplier_responses` | Questionnaire answers | id, questionnaire_id, question_key, response (TEXT), updated_at |
| `supplier_enrichment_cache` | Registry metadata | id, purl, ecosystem, metadata (JSONB), fetched_at. 30-day TTL |

**Key constraints:**
- `org_billing.org_id` is VARCHAR(255), `users.org_id` is UUID; requires `::text` cast in JOINs
- `user_events` has no `org_id`; join through `users` table
- `repo_connections` unique on `(user_id, provider)`

### 6.2 Neo4j Graph Model

```
(:Organisation {id, name, country, companySize, craRole, industry})
    ←[:BELONGS_TO]─ (:Product {id, name, description, version, productType, craCategory, repoUrl, provider, status})

(:Product)
    ─[:HAS_DEPENDENCY]→ (:Dependency {purl, name, version, ecosystem, scope, isDirect})
    ─[:HAS_CONTRIBUTOR]→ (:Contributor {login, githubId, avatarUrl, contributions})
    ─[:REPO_CONNECTED]→ (:Repository {fullName, url, provider, language, stars, syncedAt})
    ─[:HAS_TECHNICAL_FILE]→ (:TechnicalFile {productId, status, completedSections, totalSections})
    ─[:HAS_ESCROW_CONFIG]→ (:EscrowConfig {enabled, forgejoRepo, lastDeposit})

(:Dependency)
    ─[:HAS_LICENSE]→ (:License {spdxId, name, isPermissive})
    ─[:HAS_VULNERABILITY]→ (:Vulnerability {cveId, severity, fixedVersion})
```

**Design rationale:** Neo4j is used for relationship-heavy queries (dependency trees, product→contributor→repo traversals, compliance graph status). PostgreSQL handles transactional data (auth, billing, events, CRA report stages).

### 6.3 Forgejo Escrow

- **Internal URL:** `http://forgejo:3000` (Docker network)
- **External URL:** `https://escrow.cranis2.dev` (port 3003)
- **Separate Postgres DB:** `forgejo` database, user `forgejo`
- **Purpose:** European data sovereignty. Source code deposits hosted in Switzerland (Infomaniak)
- **Deposit flow:** Scheduler (5 AM UTC) pushes latest product repo content to Forgejo mirror repository
- **Retention:** Forgejo repos preserved even after product deletion (legal retention)

---

## 7. External Integrations

### 7.1 Source Code Providers

| Provider | Auth Method | Webhook Support | API SBOM |
|----------|------------|----------------|----------|
| GitHub | OAuth (Client ID: `Ov23lir9PSu5mL43AHYb`) | Yes (HMAC-SHA256) | Yes |
| Codeberg | OAuth | Yes (HMAC-SHA256, `CODEBERG_WEBHOOK_SECRET`) | No |
| Gitea | PAT | Via instance config | No |
| Forgejo | PAT | Via instance config | No |
| GitLab | PAT | Via instance config | No |

**Webhook endpoints:**
- GitHub: `https://dev.cranis2.dev/api/github/webhook`
- Codeberg/Forgejo: `https://dev.cranis2.dev/api/repo/webhook` (X-Forgejo-Event / X-Gitea-Event headers)

**Webhook actions:** Push event → mark product SBOM as stale → create notification → log audit event

### 7.2 Stripe Billing

- **Initialisation:** Lazy via `getStripe()` (avoids startup dependency)
- **Webhook:** `https://dev.cranis2.dev/api/billing/webhook` (235ms avg response)
- **Flow:** Free trial → checkout → subscription → per-contributor billing
- **Billing gate:** Global middleware blocks write API calls for unpaid orgs

### 7.3 Email (Resend)

- **From address:** `info@poste.cranis2.com`
- **Uses:** Registration verification, invitation emails, notification digests
- **Environment:** `DEV_SKIP_EMAIL` is OFF on server. Real emails are sent

### 7.4 Vulnerability Intelligence

- **OSV (Open Source Vulnerabilities):** Daily sync at 1 AM UTC, covers all ecosystems
- **NVD (National Vulnerability Database):** Daily sync at 1 AM UTC, CVE enrichment
- **Matching:** SBOM package purls matched against cached vuln DB entries by ecosystem + version range
- **Severity normalisation:** `normaliseSeverity()` maps "moderate" → "medium"

---

## 8. Scheduled Jobs

All jobs run via `scheduler.ts` using node-cron:

| Time (UTC) | Job | Description |
|------------|-----|-------------|
| 01:00 | Vulnerability DB Sync | Fetches latest OSV + NVD data, updates local cache tables |
| 02:00 | SBOM Auto-Sync | Re-syncs stale SBOMs only → triggers licence scan + IP proof enrichment |
| 03:00 | Platform Vulnerability Scan | Runs all products against latest vulnerability database |
| 04:00 | Billing Checks | Trial expiry warnings, payment grace period enforcement |
| 05:00 | Escrow Deposits | Pushes all escrow-enabled products to Forgejo mirrors |
| Hourly | CRA Deadline Checks | Monitors ENISA reporting deadlines (24h/72h/14d/1m) |

---

## 9. Security Architecture

### 9.1 Authentication

- **Method:** JWT session tokens (HS256, configurable expiry)
- **Password storage:** bcrypt with salt rounds
- **Registration:** Email verification required (`DEV_SKIP_EMAIL=false`)
- **Session:** Token stored client-side in localStorage, sent as Bearer header

### 9.2 Authorisation

| Layer | Mechanism | Scope |
|-------|-----------|-------|
| Route auth | `requireAuth` (per-route) | All authenticated endpoints |
| Admin auth | `requirePlatformAdmin` (middleware) | `/api/admin/*` endpoints |
| Billing gate | Global middleware (index.ts) | Blocks writes for unpaid orgs |
| Tenant isolation | org_id filter (Postgres), Organisation ownership (Neo4j) | Every data query |

### 9.3 Input Protection

- **SQL injection:** Parameterised queries via `pg` library (`$1`, `$2` placeholders)
- **NoSQL injection:** Neo4j parameterised queries (`$param` syntax)
- **XSS:** React's built-in escaping + CSP headers via NGINX
- **Request size:** Body parser limited to 1MB
- **Webhook verification:** HMAC-SHA256 signature validation on all webhook endpoints

### 9.4 Secret Management

| Secret | Storage | Notes |
|--------|---------|-------|
| JWT signing key | Environment variable (`JWT_SECRET`) | In `.env` file on server |
| PAT tokens | AES-256-GCM encrypted in `repo_connections.access_token_encrypted` | Key: `GITHUB_ENCRYPTION_KEY` |
| Stripe keys | Environment variables | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Database passwords | Environment variables | Postgres: `cranis2`, Neo4j: env var |
| Webhook secrets | Environment variables | `GITHUB_WEBHOOK_SECRET`, `CODEBERG_WEBHOOK_SECRET` |

### 9.5 Network Security

- NGINX is the only container with an exposed port (3002)
- Backend communicates with databases via Docker internal network
- Database ports are not exposed to the host
- Cloudflare provides TLS termination, DDoS protection, and WAF
- Forgejo accessible externally on port 3003 for escrow verification

---

## 10. Key Request Flows

### 10.1 User Login

```
Browser                     NGINX              Backend            PostgreSQL
  │                           │                   │                   │
  │  POST /api/auth/login     │                   │                   │
  │──────────────────────────▶│──────────────────▶│                   │
  │                           │                   │  SELECT user      │
  │                           │                   │──────────────────▶│
  │                           │                   │  { id, hash }     │
  │                           │                   │◀──────────────────│
  │                           │                   │  bcrypt.compare() │
  │                           │                   │  sign JWT         │
  │  { session: "eyJ..." }    │                   │                   │
  │◀──────────────────────────│◀──────────────────│                   │
```

### 10.2 Product Sync (SBOM Generation)

```
Browser                  Backend            Provider API       Neo4j         PostgreSQL
  │  POST /sync/:id       │                     │               │               │
  │──────────────────────▶│                     │               │               │
  │                        │  Get product repo   │               │               │
  │                        │─────────────────────────────────────▶               │
  │                        │  { repoUrl, provider }              │               │
  │                        │◀────────────────────────────────────│               │
  │                        │                     │               │               │
  │                        │  Tier 1: GET SBOM   │               │               │
  │                        │────────────────────▶│               │               │
  │                        │  (GitHub only)       │               │               │
  │                        │                     │               │               │
  │                        │  Tier 2: GET lockfiles               │               │
  │                        │────────────────────▶│               │               │
  │                        │  Parse → packages   │               │               │
  │                        │                     │               │               │
  │                        │  Tier 3: Scan imports│               │               │
  │                        │────────────────────▶│               │               │
  │                        │  Infer dependencies  │               │               │
  │                        │                     │               │               │
  │                        │  MERGE dependencies ─────────────────▶               │
  │                        │  INSERT sbom_packages──────────────────────────────▶│
  │  { packages: 47 }     │                     │               │               │
  │◀──────────────────────│                     │               │               │
```

### 10.3 Webhook → Stale SBOM Flow

```
GitHub/Codeberg         Backend              PostgreSQL          Neo4j
  │  POST /webhook       │                      │                 │
  │─────────────────────▶│                      │                 │
  │                      │  Verify HMAC sig      │                 │
  │                      │  Match repo → product │                 │
  │                      │──────────────────────────────────────▶│
  │                      │  Mark SBOM stale      │                 │
  │                      │─────────────────────▶│                 │
  │                      │  Create notification  │                 │
  │                      │─────────────────────▶│                 │
  │  200 OK              │  Record audit event   │                 │
  │◀─────────────────────│─────────────────────▶│                 │
```

### 10.4 CRA Report (ENISA Article 14)

```
User creates report → Backend writes cra_reports (status: draft)
  │
  ▼  Submit Early Warning (within 24h of awareness)
User fills stage form → POST /stages → cra_report_stages insert → status: early_warning_sent
  │
  ▼  Submit Notification (within 72h)
User fills details → POST /stages → cra_report_stages insert → status: notification_sent
  │
  ▼  Submit Final Report (within 14d for vulns, 1m for incidents)
User fills final analysis → POST /stages → cra_report_stages insert → status: final_report_sent
  │
  ▼  Close Report
POST /close → status: closed (post-close addenda still accepted)
```

---

## 11. Testing Architecture

| Category | Framework | Count | Description |
|----------|-----------|-------|-------------|
| Route tests | Vitest | 450+ | API endpoint validation (33 test files) |
| Security tests | Vitest | 150+ | XSS, SQL injection, auth bypass, CSRF (6 files) |
| Adversarial/break tests | Vitest | 188+ | Oversized inputs, double-submit, edge cases (9 files) |
| Webhook tests | Vitest | 39 | GitHub/Codeberg/Forgejo webhook processing (3 files) |
| Integration tests | Vitest | 120+ | E2E flows including PAT auth, Tier 3 scanning, MCP server (8 files) |
| SBOM parser unit tests | Vitest | 713 | Lockfile parsers (236), language plugins (416), mocks (61) |
| CoWork UI scripts | Browser agent | ~280 | E2E tests via Playwright |

**Test infrastructure:**
- Tests run against live dev server (`https://dev.cranis2.dev`)
- Test database: `cranis2_test` on same Postgres instance (metadata/results tracking)
- Seed data: 6 orgs, 15 users, 13 products with deterministic UUIDs
- Config: `backend/tests/vitest.config.ts`
- Run: `cd backend/tests && npx vitest run --config vitest.config.ts`
- **Total: 1126+ backend tests (65 files), ~280 E2E tests**

---

## 12. Differences from Original LLD

The original LLD (`OLD/LLD.md`) was written before implementation began and described a microservices architecture. The table below documents what was planned versus what was actually built.

| Aspect | Original LLD (2025) | Actual Implementation (2026) |
|--------|---------------------|------------------------------|
| Architecture | 12 microservices | Single monolithic Express app |
| Orchestration | Kubernetes (EKS/GKE/AKS) | Docker Compose on dedicated server |
| Caching | Redis | No caching layer (direct DB queries) |
| Message broker | RabbitMQ / AWS SQS | Scheduler-based cron jobs (node-cron) |
| Object storage | S3-compatible | Filesystem + database storage |
| Observability | OpenTelemetry tracing | Docker container logging |
| Evidence store | Append-only hash-chained ledger | Audit log table + Forgejo escrow |
| Vulnerability matching | Redis-cached feed lookups | PostgreSQL-cached feed tables |
| Auth | OAuth/OIDC + MFA | JWT session tokens + bcrypt |
| SBOM storage | Metadata + S3 artefacts | PostgreSQL metadata + Neo4j graph |

**Rationale for divergence:** CRANIS2 is developed and operated by a single developer. The monolithic architecture reduces operational complexity while maintaining the same functional capabilities. The microservices approach would have required Kubernetes expertise, service mesh configuration, and distributed tracing, none of which suit the current scale and team size. The architecture can be decomposed into services if scale demands it in the future.

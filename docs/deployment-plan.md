# CRANIS2 Production Deployment Plan

> **STATUS: COMPLETE — all 5 phases delivered 2026-04-30.**
>
> Production is live at `https://cranis2.com`. This document is retained as
> the historical record of the deployment plan and decisions. The
> ongoing-operations references that supersede it:
> - **Backup, retention, encryption, recovery:** `docs/backup-retention.md`
> - **Connection details, server overview, daily ops:** `RESTART.md` →
>   "Production server" section under "Server Access"
> - **Update / patch process (job #101):** TBD `docs/upgrade-process.md`
>   (placeholder — to be authored)

## Server Details

| Item | Value |
|---|---|
| **Server name** | cranis2-prod |
| **Provider** | Infomaniak VPS |
| **IP address** | 83.228.241.168 |
| **Login user** | mcburnia |
| **SSH key** | `~/.ssh/cranis2-prod` |
| **SSH command** | `ssh -i ~/.ssh/cranis2-prod mcburnia@83.228.241.168` |
| **Domain** | cranis2.com, www.cranis2.com |
| **DNS provider** | Infomaniak |
| **SSL strategy** | Let's Encrypt (certbot) |
| **Existing hardening** | Brute-force protection (to be verified) |

## Architecture

```
Internet
  │
  ▼
Host NGINX (ports 80/443)
  ├── SSL termination (Let's Encrypt)
  ├── cranis2.com / www.cranis2.com
  ├── /api/* → proxy to localhost:3001 (backend container)
  └── /* → serve frontend static files (or proxy to localhost:3002)
  │
  ▼
Docker Compose stack
  ├── backend (port 3001)
  ├── postgres (port 5433, bound to 127.0.0.1)
  ├── neo4j (ports 7475/7688, bound to 127.0.0.1)
  └── forgejo (port 3003, bound to 127.0.0.1)
```

**Key decision:** Host NGINX handles SSL and serves the frontend static files directly from the built `frontend/dist` directory. The Docker NGINX container is not needed in production — the host NGINX replaces it. This simplifies certificate management and reduces container count.

---

## Phase 1: Server Foundation — ✅ DONE (2026-04-30)

**Status:** ✅ Complete (2026-04-30)

- [x] Connect and assess current state (OS, packages, existing hardening)
- [x] Update all system packages (`apt update && apt upgrade`)
- [x] Verify/install fail2ban for SSH brute-force protection
- [x] Configure UFW firewall
  - Allow 22 (SSH)
  - Allow 80 (HTTP — needed for Let's Encrypt challenges)
  - Allow 443 (HTTPS)
  - Deny everything else
- [x] Install Docker & Docker Compose
- [x] Install NGINX
- [x] Install certbot (Let's Encrypt client)
- [x] Install nvm and Node.js (for frontend builds)
- [x] Install git

## Phase 2: SSL & NGINX — ✅ DONE (2026-04-30)

**Status:** ✅ Complete (2026-04-30)

**Prerequisites:** Phase 1 complete, DNS A records for cranis2.com and www.cranis2.com pointing to 83.228.241.168

- [x] Verify DNS resolution (`dig cranis2.com` returns 83.228.241.168)
- [x] Start NGINX with a basic config (needed for certbot HTTP challenge)
- [x] Obtain Let's Encrypt certificates:
  ```bash
  sudo certbot --nginx -d cranis2.com -d www.cranis2.com
  ```
- [x] Configure NGINX for production:
  ```nginx
  # HTTP → HTTPS redirect
  server {
      listen 80;
      server_name cranis2.com www.cranis2.com;
      return 301 https://$host$request_uri;
  }

  # Main HTTPS server
  server {
      listen 443 ssl http2;
      server_name cranis2.com www.cranis2.com;

      ssl_certificate /etc/letsencrypt/live/cranis2.com/fullchain.pem;
      ssl_certificate_key /etc/letsencrypt/live/cranis2.com/privkey.pem;

      # Frontend static files
      root /home/mcburnia/cranis2/frontend/dist;
      index index.html;

      # API proxy to backend container
      location /api/ {
          proxy_pass http://127.0.0.1:3001;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }

      # SPA fallback
      location / {
          try_files $uri $uri/ /index.html;
      }
  }
  ```
- [x] Verify certbot auto-renewal timer is active:
  ```bash
  sudo systemctl status certbot.timer
  ```
- [x] Test HTTPS access (may show default page until app is deployed)

## Phase 3: Deploy CRANIS2 — ✅ DONE (2026-04-30)

**Status:** ✅ Complete (2026-04-30)

**Prerequisites:** Phase 2 complete

- [x] Set up SSH key for GitHub access on production server
- [x] Clone repository: `git clone git@github.com:<repo> ~/cranis2`
- [x] Create production `.env` file with:
  - Strong database passwords (Postgres, Neo4j) — generated fresh, not copied from dev
  - Strong JWT secret — generated fresh
  - Strong encryption key — generated fresh
  - `FRONTEND_URL=https://cranis2.com`
  - `DEV_SKIP_EMAIL=false`
  - `LOG_LEVEL=warn`
  - Stripe production keys (user to provide)
  - Resend production API key and domain (user to provide)
  - Forgejo credentials — generated fresh
  - Signing keys — generate new Ed25519 + ML-DSA-65 pair using `scripts/generate-signing-keys.sh`
- [x] Build the frontend:
  ```bash
  cd ~/cranis2/frontend && source ~/.nvm/nvm.sh && npm ci && npm run build
  ```
- [x] Modify `docker-compose.yml` for production (or create `docker-compose.prod.yml`):
  - Remove the `nginx` service (host NGINX replaces it)
  - Remove the test profile services (`backend_test`, `neo4j_test`)
  - Ensure all database ports are bound to `127.0.0.1`
- [x] Start the Docker stack:
  ```bash
  cd ~/cranis2 && docker compose up -d
  ```
- [x] Wait for database initialisation (Postgres migrations, Neo4j constraints)
- [x] Verify backend health:
  ```bash
  curl http://localhost:3001/api/health
  ```
- [x] Verify HTTPS access: `https://cranis2.com/api/health`

## Phase 4: Production Configuration — ✅ DONE (2026-04-30)

**Status:** ✅ Complete (2026-04-30)

**Prerequisites:** Phase 3 complete, stack running

- [x] Verify `FRONTEND_URL` is set to `https://cranis2.com` (not dev.cranis2.dev)
- [x] Verify `DEV_SKIP_EMAIL` is `false`
- [x] Verify `LOG_LEVEL` is `warn`
- [x] Configure Stripe production keys (user to provide and set in .env)
- [x] Configure Resend production domain and API key (user to provide and set in .env)
- [x] Set up DKIM for email domain (if using custom sending domain)
- [x] Set up database backup cron job:
  ```bash
  # Daily at 02:00
  0 2 * * * /home/mcburnia/cranis2/scripts/backup-databases.sh
  ```
- [x] Set up backup verification cron job:
  ```bash
  # Weekly on Sunday at 04:00
  0 4 * * 0 /home/mcburnia/cranis2/scripts/verify-backup.sh
  ```
- [x] Set up key rotation age check cron job:
  ```bash
  # Weekly on Monday at 09:00
  0 9 * * 1 /home/mcburnia/cranis2/scripts/check-rotation-age.sh
  ```
- [x] Register with ICO (ico.org.uk, £40/year) and update Privacy Policy placeholder
- [x] Update Privacy Policy and Terms of Service with production URLs

## Phase 5: Smoke Test — ✅ DONE (2026-04-30)

**Status:** ✅ Complete (2026-04-30)

**Prerequisites:** Phase 4 complete

- [x] HTTPS works on `https://cranis2.com`
- [x] HTTPS works on `https://www.cranis2.com`
- [x] HTTP redirects to HTTPS
- [x] `/api/health` returns 200
- [x] Signup flow works (new user registration)
- [x] Email delivery works (verification email received)
- [x] Login flow works
- [x] OAuth flows work (GitHub, GitLab — callback URLs updated)
- [x] Product creation works
- [x] SBOM import works
- [x] AI Copilot responds (if Anthropic API key configured)
- [x] Stripe checkout works (test mode first, then production)
- [x] Help guides load correctly
- [x] Compliance package download works
- [x] Public API authentication works

---

## Post-Deployment

- [x] Update OAuth callback URLs at GitHub, GitLab, Bitbucket to use `https://cranis2.com`
- [x] Update Stripe webhook URL to `https://cranis2.com/api/billing/webhook`
- [x] Set up monitoring/alerting (uptime check on `/api/health`)
- [x] Run the nightly test suite against production (read-only smoke tests only — NOT the full test suite)
- [x] Update RESTART.md with production deployment details

---

## Launch Blocker Checklist (cross-reference)

| # | Blocker | Status |
|---|---|---|
| 1 | `FRONTEND_URL` migration | Phase 3 |
| 2 | Remove `/api/dev/*` routes | DONE (prior session) |
| 3 | Remove SBOM debug logging | DONE (session 57) |
| 4 | DKIM verification | Phase 4 |
| 5 | Production infrastructure | Phase 1 (server provisioned) |
| 6 | Privacy Policy | DONE (session 57) |
| 7 | Terms of Service | DONE (session 57) |
| 8 | Cookie consent | DONE (essential-only) |
| 9 | Stripe production keys | Phase 4 |
| 10 | Resend production domain | Phase 4 |
| 11 | Docker Compose orphan cleanup | DONE (session 57) |
| 12 | `DEV_SKIP_EMAIL` = false | Phase 4 |
| 13 | Production `LOG_LEVEL` | Phase 4 |

---

## Security Notes

- **Never copy `.env` from dev to production.** Generate all secrets fresh.
- **Database ports must be bound to 127.0.0.1.** Never expose Postgres, Neo4j, or Forgejo to the internet.
- **UFW must be active** with only ports 22, 80, 443 open.
- **SSL certificates** auto-renew via certbot timer. Verify this is working within the first week.
- **Backups** must be configured before announcing to users. Data loss before backup setup is unrecoverable.

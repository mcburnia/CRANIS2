# CRANIS2 Production Deployment Plan

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

## Phase 1: Server Foundation

**Status:** Not started

- [ ] Connect and assess current state (OS, packages, existing hardening)
- [ ] Update all system packages (`apt update && apt upgrade`)
- [ ] Verify/install fail2ban for SSH brute-force protection
- [ ] Configure UFW firewall
  - Allow 22 (SSH)
  - Allow 80 (HTTP — needed for Let's Encrypt challenges)
  - Allow 443 (HTTPS)
  - Deny everything else
- [ ] Install Docker & Docker Compose
- [ ] Install NGINX
- [ ] Install certbot (Let's Encrypt client)
- [ ] Install nvm and Node.js (for frontend builds)
- [ ] Install git

## Phase 2: SSL & NGINX

**Status:** Not started

**Prerequisites:** Phase 1 complete, DNS A records for cranis2.com and www.cranis2.com pointing to 83.228.241.168

- [ ] Verify DNS resolution (`dig cranis2.com` returns 83.228.241.168)
- [ ] Start NGINX with a basic config (needed for certbot HTTP challenge)
- [ ] Obtain Let's Encrypt certificates:
  ```bash
  sudo certbot --nginx -d cranis2.com -d www.cranis2.com
  ```
- [ ] Configure NGINX for production:
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
- [ ] Verify certbot auto-renewal timer is active:
  ```bash
  sudo systemctl status certbot.timer
  ```
- [ ] Test HTTPS access (may show default page until app is deployed)

## Phase 3: Deploy CRANIS2

**Status:** Not started

**Prerequisites:** Phase 2 complete

- [ ] Set up SSH key for GitHub access on production server
- [ ] Clone repository: `git clone git@github.com:<repo> ~/cranis2`
- [ ] Create production `.env` file with:
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
- [ ] Build the frontend:
  ```bash
  cd ~/cranis2/frontend && source ~/.nvm/nvm.sh && npm ci && npm run build
  ```
- [ ] Modify `docker-compose.yml` for production (or create `docker-compose.prod.yml`):
  - Remove the `nginx` service (host NGINX replaces it)
  - Remove the test profile services (`backend_test`, `neo4j_test`)
  - Ensure all database ports are bound to `127.0.0.1`
- [ ] Start the Docker stack:
  ```bash
  cd ~/cranis2 && docker compose up -d
  ```
- [ ] Wait for database initialisation (Postgres migrations, Neo4j constraints)
- [ ] Verify backend health:
  ```bash
  curl http://localhost:3001/api/health
  ```
- [ ] Verify HTTPS access: `https://cranis2.com/api/health`

## Phase 4: Production Configuration

**Status:** Not started

**Prerequisites:** Phase 3 complete, stack running

- [ ] Verify `FRONTEND_URL` is set to `https://cranis2.com` (not dev.cranis2.dev)
- [ ] Verify `DEV_SKIP_EMAIL` is `false`
- [ ] Verify `LOG_LEVEL` is `warn`
- [ ] Configure Stripe production keys (user to provide and set in .env)
- [ ] Configure Resend production domain and API key (user to provide and set in .env)
- [ ] Set up DKIM for email domain (if using custom sending domain)
- [ ] Set up database backup cron job:
  ```bash
  # Daily at 02:00
  0 2 * * * /home/mcburnia/cranis2/scripts/backup-databases.sh
  ```
- [ ] Set up backup verification cron job:
  ```bash
  # Weekly on Sunday at 04:00
  0 4 * * 0 /home/mcburnia/cranis2/scripts/verify-backup.sh
  ```
- [ ] Set up key rotation age check cron job:
  ```bash
  # Weekly on Monday at 09:00
  0 9 * * 1 /home/mcburnia/cranis2/scripts/check-rotation-age.sh
  ```
- [ ] Register with ICO (ico.org.uk, £40/year) and update Privacy Policy placeholder
- [ ] Update Privacy Policy and Terms of Service with production URLs

## Phase 5: Smoke Test

**Status:** Not started

**Prerequisites:** Phase 4 complete

- [ ] HTTPS works on `https://cranis2.com`
- [ ] HTTPS works on `https://www.cranis2.com`
- [ ] HTTP redirects to HTTPS
- [ ] `/api/health` returns 200
- [ ] Signup flow works (new user registration)
- [ ] Email delivery works (verification email received)
- [ ] Login flow works
- [ ] OAuth flows work (GitHub, GitLab — callback URLs updated)
- [ ] Product creation works
- [ ] SBOM import works
- [ ] AI Copilot responds (if Anthropic API key configured)
- [ ] Stripe checkout works (test mode first, then production)
- [ ] Help guides load correctly
- [ ] Compliance package download works
- [ ] Public API authentication works

---

## Post-Deployment

- [ ] Update OAuth callback URLs at GitHub, GitLab, Bitbucket to use `https://cranis2.com`
- [ ] Update Stripe webhook URL to `https://cranis2.com/api/billing/webhook`
- [ ] Set up monitoring/alerting (uptime check on `/api/health`)
- [ ] Run the nightly test suite against production (read-only smoke tests only — NOT the full test suite)
- [ ] Update RESTART.md with production deployment details

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

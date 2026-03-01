# CRANIS2 — Project Progress Update

**Date:** 1 March 2026
**To:** Team
**From:** Project Lead

---

## 1. Executive Summary

CRANIS2 is a compliance automation platform that helps software companies meet the requirements of the EU Cyber Resilience Act (CRA) and NIS2 Directive. It connects to source code repositories (GitHub, Codeberg, GitLab, Gitea, Forgejo), builds a complete compliance evidence chain, and automates the ongoing monitoring and reporting obligations.

As of today, the platform is feature-complete for launch. All 16 epics and 60 stories from our original backlog have been implemented. Testing across automated and manual test suites is complete, with all identified defects resolved. We are on track for a May 4th 2026 launch — four months ahead of the September 2026 CRA reporting deadline.

---

## 2. Features & Capabilities Implemented

### Core Compliance Engine
- **SBOM Management** — Three-tier dependency detection (API, lockfile parsing for 28 formats, source import scanning for 26 languages). Export in CycloneDX 1.6 and SPDX 2.3. Auto-sync daily at 2 AM UTC with webhook-triggered refresh.
- **Vulnerability Monitoring** — Local database of 445,000+ CVEs (OSV, NVD, GitHub Advisory). Nightly sync, hourly platform-wide scans. Finding triage with status tracking (open/mitigated/closed). CVSS scoring and fix-version recommendations.
- **License Compliance** — Automatic license detection and SPDX classification. Distribution model compatibility analysis with 14 known incompatible combinations flagged. Waiver system with audit trail.
- **IP Proof (RFC 3161)** — Cryptographic timestamping via external Time Stamping Authority. EU eIDAS compliant. Auto-generated after every SBOM sync.
- **CRA Technical File (Annex VII)** — Eight structured sections with inline editing, version tracking, and completion metrics. Cross-product overview dashboard.
- **ENISA Reporting (Article 14)** — Three-stage workflow (24h early warning, 72h notification, 14-day final report). Auto-deadline calculation with escalating alerts. All 27 EU member states supported. TLP classification.
- **Obligations Tracking** — CRA and NIS2 requirements mapped to products with per-obligation status tracking (not started / in progress / met).
- **Due Diligence Export** — Single ZIP containing compliance PDF, SBOM, vulnerability summary, license findings, license texts, technical file, IP proof records, and audit trail.

### Source Code & Repository Management
- **Five Git Providers** — GitHub (OAuth), Codeberg (OAuth + PAT), GitLab (PAT + self-hosted), Gitea (PAT), Forgejo (PAT). All PATs encrypted with AES-256-GCM.
- **Webhook Integration** — GitHub, Codeberg, and Forgejo push/tag events with HMAC-SHA256 signature verification.
- **Contributor Tracking** — Active/inactive/departed/bot/shared account classification. 90-day activity window for billing.
- **Source Code Escrow** — Automated daily deposits to self-hosted Forgejo. Configurable release models (open source or designated recipients). Swiss hosting for EU data sovereignty.

### Platform & Business
- **Billing & Subscriptions** — Stripe integration with contributor-based pricing (free trial, standard at EUR 6/contributor/month, enterprise). Automated dunning, VAT handling via Stripe Tax, payment pause for hardship.
- **Marketplace** — Public compliance directory with real-time badges (green/amber/red) computed from actual scan data. Admin approval workflow. Contact rate limiting.
- **Notifications** — In-app inbox with severity levels (info/warning/critical). Deadline alerts, vulnerability alerts, billing notifications, sync status.
- **Audit Logging** — Immutable append-only event ledger. Every significant operation logged with user, timestamp, IP, user agent. Filterable and exportable.
- **Admin Panel** — System health, user/org management, vulnerability database status, scheduled task monitoring, feedback triage, test results dashboard.

### Frontend
- **50+ pages** across dashboard, compliance, source code, billing, and settings sections.
- **57 React components** with responsive design, accordion navigation, data tables, charts (Recharts), and form validation.
- **Tech stack:** React 19, TypeScript 5.9, Vite 6, React Router 6.

### Backend
- **135+ API endpoints** across 27 route files.
- **25 service/integration modules** handling business logic, external APIs, and scheduled operations.
- **Tech stack:** Express 5, TypeScript (ESM), Node.js 22, PostgreSQL 16, Neo4j 5.
- **Deployment:** Docker Compose, NGINX reverse proxy, Cloudflare Tunnel, hosted on Infomaniak (Switzerland).

### Scheduled Automation (24-hour cycle)
- 1 AM — Vulnerability database sync
- 2 AM — SBOM auto-sync for changed products + license scan + IP proof generation
- 3 AM — Platform-wide vulnerability scans
- 4 AM — Billing lifecycle checks (trial expiry, grace periods)
- 5 AM — Escrow deposits
- Hourly — CRA deadline monitoring with escalating alerts

---

## 3. Current Backlog

The original 16 epics and 60 stories are implemented. The remaining backlog consists of post-launch enhancements:

### Deferred to Post-Launch
| Item | Priority | Notes |
|------|----------|-------|
| Annual billing option | Standard | Pro-rata and contributor true-up logic needed |
| Multi-currency pricing (GBP, USD) | Standard | Currently EUR only |
| Enterprise enquiry (Calendly integration) | Standard | Contact form exists, scheduling link not yet added |
| Advanced shared account detection | Standard | Commit style variance analysis |
| IP geolocation cross-reference | High | Registration country vs IP mismatch detection |
| Device fingerprinting | High | Suspicious sign-up pattern detection |
| Velocity checks | High | Same person creating multiple accounts |
| Bot anomaly detection | High | Unusual commit frequency/scope changes |
| Chargeback protection | Standard | Stripe add-on evaluation |

### Technical Debt
| Item | Priority | Notes |
|------|----------|-------|
| Remove dev-only routes before production | Critical | `/backend/src/routes/dev.ts` — account nuking and notification seeding helpers |
| Contributor 90-day window refinement | Medium | Requires `lastCommitAt` field on Neo4j Contributor nodes |

All items above are non-blocking for launch. The dev-only routes will be removed as part of production hardening before May 4th.

---

## 4. Test Plan & Current Status

### Automated Backend Tests (Vitest)
- **45 test files** across 5 categories
- **647+ test cases** (`it()` blocks)
- **Framework:** Vitest 3.x with TypeScript, sequential execution, JSON output
- **Status: All passing. All defects found have been resolved.**

| Category | Files | Scope |
|----------|-------|-------|
| Route tests | 21 | All 135+ API endpoints — request/response validation, status codes, error handling |
| Integration tests | 7 | End-to-end workflows: product lifecycle, CRA report lifecycle, cross-org isolation, billing gates, Neo4j-Postgres consistency, due diligence export, Tier 3 import scanning against live Forgejo repos |
| Security tests | 6 | Auth bypass, cross-org access, admin route protection, billing gate enforcement, SQL/NoSQL/command injection, JWT manipulation |
| Break tests | 8 | Concurrent mutations, malformed JSON, oversized payloads, unicode, boundary values, empty collections, null inputs, type coercion |
| Webhook tests | 3 | GitHub signature validation, Codeberg PAT auth, Stripe payment events |

### Manual Test Suites (Microsoft Test Library)
- **23 structured test plans** executed across acceptance, break, and smoke categories
- **Status: All executed. All defects found have been resolved.**

**Acceptance Tests (12 suites):**
Organisation management, product CRUD, repo connection, SBOM generation & export, vulnerability reports lifecycle, due diligence package, billing & subscription, escrow management, admin panel, notifications, marketplace, technical files.

**Break Tests (7 suites):**
Form validation across all pages, XSS injection on all text inputs, oversized text inputs, rapid click / double submit, back button state, session expiry behaviour, empty state handling.

**Smoke Tests (4 suites):**
Login & dashboard load, navigation across all pages, critical API health checks, create product end-to-end flow.

### Test Data
- 8+ seeded test users across different org types (manufacturer, importer, distributor, OSS) and billing states (active, trial, suspended, past due, empty)
- Dedicated `cranis2_test` PostgreSQL database
- Test data registry with automatic cleanup

---

## 5. Estimated Equivalent Human Effort

Based on industry-standard productivity metrics (100–150 lines of production code per developer per day, accounting for design, testing, debugging, integration, and documentation):

| Work Area | Lines of Code | Estimated Effort |
|-----------|---------------|-----------------|
| Backend (27 routes, 25 services, dual-DB) | ~24,000 | 200 person-days |
| Frontend (57 React components, 50+ pages) | ~15,400 | 128 person-days |
| Test suite (45 files, 647+ test cases) | ~10,000 | 100 person-days |
| Documentation (33 files, architecture, compliance mapping) | ~5,200 | 20 person-days |
| DevOps & infrastructure (Docker, NGINX, deployment) | ~300 | 40 person-days |
| **Total** | **~55,000** | **~488 person-days** |

**488 person-days is equivalent to approximately 2–3 full-time senior engineers working for 8–12 months.**

This accounts for:
- 10 external integrations (Stripe, GitHub, Codeberg, GitLab, Gitea, Forgejo, OSV, NVD, FreeTSA, Resend)
- Dual database architecture (PostgreSQL + Neo4j)
- 28 lockfile parsers and 26 language import scanners
- Full regulatory compliance mapping (CRA Annex VII, Article 14, NIS2)
- Comprehensive test suite with security and adversarial testing

---

## 6. Launch Readiness Assessment — May 4th 2026

### Likelihood of Successful Launch: HIGH

| Factor | Assessment |
|--------|------------|
| Feature completeness | All 16 epics and 60 stories implemented. Platform is feature-complete for v1. |
| Test coverage | 45 automated test files + 23 manual test suites executed. All defects resolved. |
| Security posture | 6 dedicated security test files. XSS, injection, auth bypass, cross-org isolation all tested and passing. |
| Infrastructure | Docker Compose deployment operational on Infomaniak (Switzerland). Cloudflare Tunnel for public access. |
| Regulatory timing | Launch is 4 months before the September 2026 CRA reporting deadline — gives early adopters time to onboard. |
| Billing integration | Stripe fully integrated with checkout, portal, webhooks, dunning, and VAT handling. |
| Remaining work | Dev route removal (1 day), contributor window refinement (non-blocking), production DNS cutover. |

### Pre-Launch Checklist (Before May 4th)
- [ ] Remove dev-only routes (`/backend/src/routes/dev.ts`)
- [ ] Production DNS cutover to `cranis2.com`
- [ ] Final smoke test on production environment
- [ ] Stripe production keys configured
- [ ] Resend production domain verified
- [ ] Monitoring and alerting configured

### Risk Factors
| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Infrastructure scaling under load | Low | Current Intel i5/3.8GB handles dev load; monitor and scale on Infomaniak as needed |
| Third-party API changes (GitHub, Stripe) | Low | Version-pinned integrations; webhook signatures verified |
| Regulatory requirement changes before Sept 2026 | Very Low | CRA text is final; implementing guidelines may add detail but not change core requirements |

---

## 7. Summary

CRANIS2 is feature-complete, fully tested, and on track for May 4th launch. The platform delivers comprehensive CRA and NIS2 compliance automation — SBOM management, vulnerability monitoring, license compliance, IP proof, regulatory reporting, escrow, and billing — across 135+ API endpoints and 50+ frontend pages. The equivalent professional effort is approximately 488 person-days (2–3 engineers for 8–12 months). All automated and manual tests have been executed and all identified defects have been resolved. The remaining work before launch is limited to production hardening tasks that can be completed in days, not weeks.

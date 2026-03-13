# CRANIS2 — Comprehensive Test Review

**Date:** 2026-03-13
**Scope:** Backend (Vitest) + E2E (Playwright) — full cross-reference against source code

---

## 1. Executive Summary

| Suite | Files | Tests | Pass | Fail | Skip |
|-------|-------|-------|------|------|------|
| Backend (Vitest) | 75 | 1,244 | 1,228 | 16 (expected) | 0 |
| E2E (Playwright) | 27 | 276 | 267 | 7 | 4 |
| **Total** | **102** | **1,520** | **1,495** | **23** | **4** |

**Expected failures (16 backend):** 13 tier3-import-scanning (needs Forgejo), 2 webhook-e2e B5/B6 (needs Forgejo push), 1 category-recommendation (needs Anthropic API).

**E2E failures (7):** 4 marketplace profile tests (pre-existing), 2 console-error checks on product detail page, 1 supplier due diligence tab visibility. All pre-existing and unrelated to recent work.

---

## 2. Backend Test Inventory

### 2.1 Routes Tests (55 files)

| Test File | Lines | Tests | What It Covers | Verdict |
|-----------|-------|-------|----------------|---------|
| `auth.test.ts` | 154 | ~6 | Register, login, /me | OK |
| `admin.test.ts` | 74 | ~4 | Admin dashboard access control | OK |
| `admin-orgs.test.ts` | 140 | ~6 | Org plan/billing management | OK |
| `audit-log.test.ts` | 46 | ~2 | Audit log retrieval | THIN — only checks 200, no content validation |
| `batch-fill.test.ts` | 343 | ~12 | AI batch fill tech file sections | OK |
| `batch-triage.test.ts` | 241 | ~10 | Batch vulnerability triage | OK |
| `billing.test.ts` | 101 | ~4 | Billing status endpoint | THIN — no checkout/portal/upgrade/downgrade |
| `category-recommendation.test.ts` | 495 | ~15 | AI category recommendations | OK (1 needs API key) |
| `compliance-checklist.test.ts` | 112 | ~5 | Compliance checklist status | OK |
| `compliance-snapshots.test.ts` | 259 | ~10 | Snapshot create/list/download/delete | OK |
| `compliance-timeline.test.ts` | 102 | ~4 | Event timeline | OK |
| `contributors-overview.test.ts` | 96 | ~4 | Contributor listing | OK |
| `copilot.test.ts` | 379 | ~14 | Suggest, triage, risk, incident draft | OK — auth/validation/gating only |
| `cra-reports.test.ts` | 371 | ~15 | Report CRUD, stage progression | OK |
| `dashboard.test.ts` | 145 | ~6 | Dashboard summary, scorecard | OK |
| `dependencies-overview.test.ts` | 99 | ~4 | Dependencies overview | OK |
| `docs.test.ts` | 137 | ~6 | Public docs, admin edit | OK |
| `due-diligence.test.ts` | 98 | ~4 | Due diligence preview | THIN — no export/ZIP test |
| `escrow.test.ts` | 104 | ~4 | Escrow deposits, config | THIN — no agent invite/revoke |
| `feedback.test.ts` | 70 | ~3 | User feedback submission | OK |
| `ip-proof.test.ts` | 116 | ~5 | IP proof snapshot/verify | OK |
| `license-scan.test.ts` | 177 | ~8 | License findings, compatibility | OK |
| `marketplace.test.ts` | 43 | ~2 | Marketplace profile | THIN — no listings/contact/admin |
| `notifications.test.ts` | 58 | ~3 | Notification list/read | THIN — no unread-count |
| `obligations.test.ts` | 535 | ~20 | Obligation tracking, derived status | OK — comprehensive |
| `onboard.test.ts` | 135 | ~5 | Product onboarding wizard | OK |
| `org.test.ts` | 139 | ~6 | Org info, update, members | OK |
| `oscal.test.ts` | 320 | ~12 | OSCAL catalog, profile, assessment | OK |
| `product-activity.test.ts` | 117 | ~5 | Activity feed | OK |
| `product-reports.test.ts` | 183 | ~8 | Per-product reports | OK |
| `products.test.ts` | 386 | ~16 | CRUD, auto-assign contacts | OK |
| `public-api-v1.test.ts` | 270 | ~12 | Public API endpoints, scopes | OK |
| `push-events.test.ts` | 110 | ~5 | Push event listing | OK |
| `repo-connections.test.ts` | 515 | ~18 | PAT/OAuth connections | OK |
| `reports.test.ts` | 471 | ~18 | Summary, trends, audit trail + exports | OK |
| `repos-overview.test.ts` | 99 | ~4 | Repository overview | OK |
| `risk-findings-regression.test.ts` | 294 | ~12 | Risk finding status tracking | OK |
| `sbom-export.test.ts` | 99 | ~4 | SBOM export status | THIN — no CycloneDX/SPDX download |
| `stakeholders.test.ts` | 127 | ~5 | Stakeholder listing/update | OK |
| `supplier-due-diligence.test.ts` | 319 | ~12 | Scan, risks, questionnaires | OK |
| `technical-files.test.ts` | 337 | ~14 | Section CRUD, DoC/CVD PDFs | OK |
| `technical-files-overview.test.ts` | 123 | ~5 | Overview listing | OK |
| `vulnerability-scan.test.ts` | 187 | ~8 | Vulnerability findings | OK |
| `webhook-e2e.test.ts` | 731 | ~25 | Full webhook round-trip | OK (2 need Forgejo) |
| `webhook-health.test.ts` | 237 | ~10 | Webhook health detection | OK |
| `webhook-registration.test.ts` | 206 | ~8 | Webhook registration in Neo4j | OK |

### 2.2 Integration Tests (8 files)

| Test File | Lines | Tests | What It Covers |
|-----------|-------|-------|----------------|
| `billing-gate-enforcement.test.ts` | 194 | ~8 | Write-op blocking for restricted orgs |
| `cloudflare-tunnel.test.ts` | 23 | ~1 | Public URL health check |
| `cra-report-lifecycle.test.ts` | 247 | ~10 | Full report workflow (draft → closed) |
| `cross-org-data-isolation.test.ts` | 217 | ~10 | Data access controls across orgs |
| `due-diligence-export.test.ts` | 67 | ~3 | Due diligence ZIP export |
| `neo4j-postgres-consistency.test.ts` | 238 | ~10 | Cross-database consistency |
| `product-lifecycle.test.ts` | 142 | ~6 | Product create → delete cycle |
| `tier3-import-scanning.test.ts` | 329 | ~13 | Source-only scanning (needs Forgejo) |

### 2.3 Security Tests (6 files)

| Test File | Lines | Tests | What It Covers |
|-----------|-------|-------|----------------|
| `injection-attempts.test.ts` | 976 | ~40 | SQL, Cypher, XSS, path traversal, CRLF, JSON, NoSQL |
| `jwt-manipulation.test.ts` | 401 | ~16 | Token tampering, algo confusion, privilege escalation |
| `admin-route-protection.test.ts` | 204 | ~8 | Admin endpoint access control |
| `billing-gate.test.ts` | 141 | ~6 | Billing enforcement on writes |
| `cross-org-access.test.ts` | 116 | ~5 | Cross-org access prevention |
| `auth-bypass.test.ts` | 104 | ~5 | Missing/invalid token handling |

### 2.4 Service Tests (2 files)

| Test File | Lines | Tests | What It Covers |
|-----------|-------|-------|----------------|
| `obligation-engine-roles.test.ts` | 283 | ~21 | Role filtering, defaults, counts, integrity |
| `alert-emails.test.ts` | 253 | ~10 | Email deduplication, content |

### 2.5 Break/Fuzzing Tests (8 files)

| Test File | Lines | Tests | What It Covers |
|-----------|-------|-------|----------------|
| `oversized-payloads.test.ts` | 211 | ~8 | Large strings, nested objects, URL limits |
| `malformed-json.test.ts` | 207 | ~8 | Truncated/invalid JSON |
| `unicode-special-chars.test.ts` | 269 | ~10 | Emoji, CJK, RTL, zero-width |
| `concurrent-mutations.test.ts` | 249 | ~10 | Concurrent product/org/CRA ops |
| `boundary-values.test.ts` | 289 | ~12 | Date/string/UUID/country boundaries |
| `null-undefined-inputs.test.ts` | 179 | ~8 | Null/undefined handling |
| `empty-collections.test.ts` | 179 | ~8 | Empty orgs, products, arrays |
| `type-coercion.test.ts` | 247 | ~10 | Type coercion edge cases |

### 2.6 Webhook Tests (3 files)

| Test File | Lines | Tests | What It Covers |
|-----------|-------|-------|----------------|
| `github-webhook.test.ts` | 196 | ~8 | GitHub HMAC validation |
| `codeberg-webhook.test.ts` | 176 | ~8 | Codeberg/Forgejo validation |
| `stripe-webhook.test.ts` | 241 | ~10 | Stripe webhook validation |

---

## 3. E2E Test Inventory

### 3.1 Smoke Tests (4 files, ~13 tests)

| Spec File | Tests | What It Covers |
|-----------|-------|----------------|
| `critical-api-health.spec.ts` | 9 | 7 API endpoint health checks |
| `login-and-dashboard.spec.ts` | 6 | Auth flow, dashboard rendering |
| `navigation-all-pages.spec.ts` | 1 (parametrised × 18) | All 18 sidebar pages load |
| `create-product-flow.spec.ts` | 3 | Product create/verify/cleanup |

### 3.2 Acceptance Tests (16 files, ~179 tests)

| Spec File | Tests | What It Covers |
|-----------|-------|----------------|
| `product-crud.spec.ts` | ~10 | CRUD operations |
| `technical-files.spec.ts` | ~14 | 8 CRA Annex VII sections |
| `sbom-generation-and-export.spec.ts` | ~12 | Export formats, lifecycle |
| `reports.spec.ts` | ~12 | 3 report types |
| `admin-panel.spec.ts` | ~12 | Platform admin features |
| `category-recommendation.spec.ts` | ~10 | Deterministic recommendations |
| `risk-findings-regression.spec.ts` | ~10 | Status tracking |
| `repo-connection.spec.ts` | ~10 | PAT management |
| `vulnerability-reports-lifecycle.spec.ts` | ~8 | ENISA lifecycle |
| `notifications.spec.ts` | ~8 | Notification management |
| `organisation-management.spec.ts` | ~8 | Org details, members |
| `escrow-management.spec.ts` | ~8 | Escrow configuration |
| `due-diligence-package.spec.ts` | ~8 | Package preview/export |
| `marketplace.spec.ts` | ~8 | Profile editing |
| `supplier-due-diligence.spec.ts` | ~4 | Questionnaires |
| `billing-and-subscription.spec.ts` | ~8 | Billing gating |

### 3.3 Break Tests (7 files, ~58 tests)

| Spec File | Tests | What It Covers |
|-----------|-------|----------------|
| `session-expiry-behaviour.spec.ts` | ~8 | Token handling |
| `back-button-state.spec.ts` | ~10 | Navigation consistency |
| `empty-state-handling.spec.ts` | ~8 | Graceful empty states |
| `form-validation-all-pages.spec.ts` | ~6 | Input validation |
| `xss-injection-inputs.spec.ts` | ~10 | 8 XSS payload types |
| `oversized-text-inputs.spec.ts` | ~10 | UTF-8, emoji, boundaries |
| `rapid-click-double-submit.spec.ts` | ~6 | Double-submit prevention |

---

## 4. Coverage Gap Analysis

### 4.1 Untested or Under-Tested Backend Endpoints

| Endpoint Group | Specific Gaps | Priority |
|----------------|---------------|----------|
| **Billing** | `POST /checkout`, `POST /portal`, `POST /upgrade`, `POST /downgrade`, `POST /contributors/:login/departed` | HIGH — revenue-critical |
| **Escrow** | `POST /:productId/agents` (invite), `DELETE /:productId/agents/:agentId` (revoke), `GET /:productId/agents` | MEDIUM |
| **SBOM Export** | `GET /:productId/export/cyclonedx`, `GET /:productId/export/spdx` — only status tested, not actual download | HIGH — core feature |
| **Retention Ledger** | All endpoints: Wise ref linking, bulk funding, legal hold, expiry warnings, cost forecast, certificate download | MEDIUM — admin only |
| **Snapshot Schedule** | `GET/PUT/DELETE /:productId/snapshot-schedule` | LOW |
| **Marketplace** | `GET /listings`, `GET /listings/:orgId`, `POST /contact/:orgId`, `GET /contact-history`, admin approve | MEDIUM |
| **Document Templates** | `GET /:id/generate` (product-specific generation) | LOW |
| **Conformity Assessment** | Public endpoint `GET /api/conformity-assessment/` | LOW — tested via E2E indirectly |
| **GRC Bridge** | `GET /api/integrations/grc/` | LOW — informational only |
| **Trello Integration** | Board CRUD, card creation, product board linking | LOW — external service |
| **Notification** | `GET /unread-count` | LOW |
| **Admin Vuln Scan** | `POST /vulnerability-scan`, `GET /status`, `GET /history`, DB sync | MEDIUM |
| **Admin Copilot** | `GET /copilot-usage`, prompt CRUD | LOW — admin only |

### 4.2 Untested Backend Services

| Service | What's Missing | Priority |
|---------|---------------|----------|
| **obligation-engine.ts** | `enrichObligation()` — not directly tested | LOW — exercised via integration |
| **compliance-gaps.ts** | `analyseComplianceGaps()` — only tested via route | LOW |
| **copilot.ts** | `gatherProductContext()`, `generateSuggestion()` — only auth/gating tested, not logic | LOW — requires API key |
| **billing.ts** | `createCheckoutSession()`, `processWebhookEvent()`, trial/grace period logic | HIGH |
| **escrow-service.ts** | `inviteEscrowAgent()`, `revokeEscrowAgent()`, `runAllEscrowDeposits()` | MEDIUM |
| **trello.ts** | All card creation functions | LOW — external |
| **scheduler.ts** | Background job execution | LOW — exercised in production |
| **cold-storage.ts** | `uploadToGlacier()`, `deleteFromGlacier()` | LOW — external service |
| **lockfile-parsers.ts** | 23 parsers — no unit tests for individual parsers | MEDIUM — high complexity |

### 4.3 Untested E2E User Flows

| Flow | Description | Priority |
|------|-------------|----------|
| **Obligation workflow by role** | Importer sees Art. 18, distributor sees Art. 19 on product detail | HIGH — just implemented |
| **Compliance checklist walkthrough** | Step-by-step completion of all 7 checklist items | MEDIUM |
| **AI Copilot interaction** | Suggestion request, triage, risk assessment from UI | LOW — requires API |
| **Public API key management** | Create/list/revoke API keys from settings page | MEDIUM |
| **Compliance snapshot flow** | Create snapshot, verify timestamp, download archive | MEDIUM |
| **IP Proof flow** | Create snapshot, verify integrity, export package | MEDIUM |
| **Document template download** | Generate and download pre-populated templates | LOW |
| **Action plan walkthrough** | Navigate product action plan, complete items | MEDIUM |
| **Multi-org switching** | (If applicable) switching between organisations | LOW |
| **Webhook configuration** | Setting up repository webhooks from UI | LOW — partially covered |
| **Search and filter** | Product search, vulnerability filtering, obligation filtering | MEDIUM |
| **Pagination** | Large dataset navigation (products, findings, obligations) | LOW |

---

## 5. Test Quality Issues

### 5.1 Thin Tests (Need Deepening)

These files exist but have minimal assertions — they check HTTP status codes but don't validate response body structure or business logic:

| File | Issue | Recommendation |
|------|-------|----------------|
| `audit-log.test.ts` (46 lines) | Only checks 200 status | Add assertions for log entry structure, filtering, date ranges |
| `billing.test.ts` (101 lines) | Only checks billing status | Add checkout session creation, plan upgrade/downgrade flows |
| `marketplace.test.ts` (43 lines) | Only checks profile GET/PUT | Add listings search, contact workflow, admin approval |
| `notifications.test.ts` (58 lines) | Only checks list/read | Add unread count, mark-all-read, notification creation triggers |
| `due-diligence.test.ts` (98 lines) | Only checks preview | Add ZIP export validation, content structure |
| `escrow.test.ts` (104 lines) | Only checks config/deposit | Add agent invite/revoke, multi-deposit scenarios |
| `sbom-export.test.ts` (99 lines) | Only checks export status | Add actual CycloneDX/SPDX download and format validation |

### 5.2 Tests That Should Follow User Journeys

Currently, most backend tests are isolated endpoint tests. The integration directory has some workflow tests, but these key user journeys are not tested end-to-end through the API:

1. **New user onboarding journey:** Register → Create org → Add product → Connect repo → Sync SBOM → View obligations → Complete checklist
2. **Vulnerability response journey:** Scan triggers → Findings appear → Triage findings → Generate risk assessment → File ENISA report → Close report
3. **Compliance package journey:** Complete tech file sections → Generate DoC → Create compliance snapshot → Download package → Export due diligence ZIP
4. **Importer compliance journey:** Create product as importer org → See Art. 18 obligations → Upload DoC verification → Complete importer-specific checklist
5. **Distributor compliance journey:** Create product as distributor org → See Art. 19 obligations → Verify documentation/marking → Complete distributor checklist

### 5.3 Overlapping Coverage (Not Necessarily Bad)

| Area | Files | Notes |
|------|-------|-------|
| Cross-org isolation | `security/cross-org-access.test.ts` + `integration/cross-org-data-isolation.test.ts` | Intentional — security tests check access control, integration tests check data leakage. Keep both. |
| Billing gates | `security/billing-gate.test.ts` + `integration/billing-gate-enforcement.test.ts` | Intentional — different scopes. Keep both. |
| Obligation engine | `routes/obligations.test.ts` + `services/obligation-engine-roles.test.ts` | Complementary — routes test API layer, services test pure logic. Keep both. |

---

## 6. E2E Test Quality Issues

### 6.1 Pre-Existing Failures (7 tests)

| Test | Failure Type | Root Cause | Action |
|------|-------------|------------|--------|
| `marketplace.spec.ts` (4 tests) | Profile API update failures | Marketplace profile persistence issue | INVESTIGATE — may be a real bug |
| `sbom-generation-and-export.spec.ts` (1 test) | Console errors on product detail | Unknown console error source | INVESTIGATE — check browser console |
| `supplier-due-diligence.spec.ts` (1 test) | Supply Chain tab not visible | Tab visibility condition | INVESTIGATE — may require specific data |
| `oversized-text-inputs.spec.ts` (1 test) | Console errors on oversized product | Console error from large product name | LOW — edge case |

### 6.2 Missing E2E User Personas

Currently 4 personas:
- `testadmin@manufacturer-active.test` (manufacturer admin)
- `testmember1@manufacturer-active.test` (manufacturer member)
- `testplatformadmin@cranis2.test` (platform admin)
- `testadmin@empty-org.test` (empty org admin)

**Missing:**
- Importer org admin — needed to test Art. 18 obligation rendering
- Distributor org admin — needed to test Art. 19 obligation rendering
- Suspended org user — needed to test billing gate UI behaviour
- Read-only org user — needed to test read-only mode UI

### 6.3 Missing E2E Coverage

| Area | What's Missing |
|------|---------------|
| **Role-aware obligations** | No E2E test verifies importer/distributor see correct obligations |
| **Compliance vault** | No E2E test for snapshot creation/download |
| **IP Proof** | No E2E test for proof creation/verification |
| **Document templates** | No E2E test for template download/generation |
| **Public API settings** | No E2E test for API key creation/management |
| **Integrations page** | No E2E test for Trello/webhook configuration |
| **Action plan** | No E2E test for the product action plan page |
| **Dark mode / responsive** | No responsive or theme tests |

---

## 7. Recommendations — Priority Order

### P0: Fix Pre-Existing E2E Failures

1. **Investigate marketplace test failures** — 4 tests failing, likely a real bug in profile persistence
2. **Investigate console error tests** — identify and fix the browser console errors on product detail pages
3. **Investigate supplier DD tab visibility** — check whether test data preconditions are met

### P1: Add Role-Aware E2E Tests (New Feature Coverage)

4. **Add importer/distributor E2E personas** — create storage states for `testadmin@importer-trial.test` and `testadmin@distributor-suspended.test`
5. **Add obligation rendering E2E test** — verify product detail page shows correct Art. 13/18/19 obligations based on org role

### P2: Deepen Thin Backend Tests

6. **Expand billing.test.ts** — add checkout, upgrade, downgrade, contributor management
7. **Expand sbom-export.test.ts** — add actual CycloneDX/SPDX download and format validation
8. **Expand escrow.test.ts** — add agent invite/revoke workflows
9. **Expand marketplace.test.ts** — add listings, contact, admin approval
10. **Expand notifications.test.ts** — add unread count, creation triggers

### P3: Add User Journey Integration Tests

11. **New user onboarding journey** — register through to first compliance check
12. **Vulnerability response journey** — scan through to ENISA report closure
13. **Compliance package journey** — tech file through to ZIP export
14. **Importer compliance journey** — importer-specific end-to-end flow
15. **Distributor compliance journey** — distributor-specific end-to-end flow

### P4: Fill Endpoint Coverage Gaps

16. **Retention ledger endpoints** — CRUD + certificate download
17. **Admin vulnerability scan** — trigger, status, history
18. **Snapshot schedule** — CRUD operations
19. **Document template generation** — product-specific output

### P5: Add Service Unit Tests

20. **Lockfile parser unit tests** — test each of the 23 parsers with sample lockfiles
21. **Billing service logic** — trial expiry, grace periods, webhook processing
22. **Obligation enrichment** — `enrichObligation()` with various inputs

---

## 8. Test Infrastructure Assessment

### Strengths

- **5-layer isolation** (containers, DB, startup guards, test-side guards, ports) — excellent
- **Deterministic test IDs** with `ON CONFLICT DO UPDATE` — prevents flaky seeds
- **Token caching** — reduces auth overhead significantly
- **Pre-test cleanup** (rate limits, billing plans, orphan data) — prevents cross-test contamination
- **Security test suite** — injection, JWT manipulation, access control well covered
- **Break/fuzzing tests** — edge cases, Unicode, concurrent mutations all tested

### Weaknesses

- **No test for actual Stripe checkout flow** — billing tests only check status, not the payment journey
- **No lockfile parser unit tests** — 23 complex parsers with zero direct unit tests
- **E2E limited to 1 browser** — Chrome only, no Firefox/Safari
- **No performance/load tests** — no response time assertions or concurrent user simulation
- **No accessibility tests** — no WCAG compliance checks
- **Seed data is large and growing** — 6 orgs, 15 users, 13 products — risk of test coupling

### Recommendations for Infrastructure

- Consider adding a `test:coverage` script to measure actual line/branch coverage
- Consider splitting the E2E suite into "fast" (smoke + critical acceptance) and "full" categories for faster CI feedback
- Consider adding retry logic for the 7 flaky E2E tests rather than accepting them as failures

---

## 9. Summary

The test suite is **comprehensive and well-structured** for a project of this size. The main areas for improvement are:

1. **Fix the 7 pre-existing E2E failures** — these erode confidence in the suite
2. **Add role-aware E2E tests** — the new importer/distributor feature has backend tests but no UI verification
3. **Deepen the thin backend tests** — 7 test files have minimal assertions
4. **Add user journey tests** — the suite tests endpoints in isolation but doesn't simulate real user workflows end-to-end
5. **Add lockfile parser unit tests** — 23 complex parsers deserve direct coverage

The security, break/fuzzing, and integration test suites are strong. The test infrastructure is excellent with proper isolation and deterministic seeding.

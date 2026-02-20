# CRANIS2 - Low-Level Design (initial)

## Purpose
This LLD translates the HLD into concrete services, data models, event schemas, and operational notes to start implementation and sprint planning.

## 1. Deployment Targets
- Kubernetes (EKS/GKE/AKS) in an EU region
- Postgres (managed) for relational and append-only ledger
- Object store (S3-compatible) for SBOM/artifact storage
- Redis for caches and dedupe counters
- Message broker: RabbitMQ or AWS SQS (for FIFO+DLQ patterns)

## 2. Service Boundaries (microservices)
1. api-gateway / web-frontend
   - Hosts dashboard and public portal
   - Routes to backend APIs, enforces auth
2. auth-service
   - OAuth/OIDC, session mgmt, RBAC, GitHub identity linking
3. tenancy-service
   - Organisations, teams, users, enablement rules
4. billing-service
   - Stripe integration, contributor accounting, metering
5. repo-integration-service
   - GitHub App install flows, repo discovery, webhook receiver
6. ingestion-service
   - Normalises GitHub events to canonical schema, idempotency
7. sbom-service
   - SBOM ingestion, normalisation, purl mapping, artefact storage
8. vuln-service
   - Feeds connectors, caching, matching utilities
9. compliance-engine (workers)
   - Schedules rechecks, executes SBOM→vuln matching, writes findings
10. evidence-store-service
   - Append-only ledger API, integrity proofs, export builder
11. notification-service
   - Email/In-app enqueue + delivery with retry
12. ops-service
   - Health, queues, DLQ, metrics

Each service exposes a small API and writes to shared Postgres and object store only via well-defined DAOs.

## 3. Data Model (key tables)
- organisations (id, name, billing_id, created_at)
- teams (id, org_id, name)
- users (id, org_id, github_id, email, role)
- repos (id, org_id, github_repo_id, name, enabled_scope)
- enablement_rules (id, repo_id, team_id, user_id, scope)
- events (id, org_id, repo_id, event_type, payload JSONB, created_at, delivery_id, hash)
- evidence_ledger (seq_id, org_id, event_hash, prev_hash, payload JSONB, created_at, signature)
- sboms (id, org_id, repo_id, release_tag, metadata JSONB, sbom_hash, storage_path, created_at)
- vuln_feeds (feed_id, feed_name, last_updated)
- findings (id, org_id, sbom_id, vuln_id, severity, metadata JSONB, created_at)

Notes: `evidence_ledger` is append-only; updates are inserts only. Hash chasing uses `prev_hash` chaining.

## 4. Canonical Event Schema (example)
{
  "event_id": "uuid",
  "source": "github",
  "delivery_id": "github-delivery-id",
  "repo": "org/name",
  "actor": { "github_id": 1234, "login": "alice" },
  "type": "release",
  "timestamp": "2025-12-01T12:00:00Z",
  "payload": {/* normalized fields for event type */},
  "metadata": { "received_at": "...", "processing_version": 1 }
}

Each event is hashed (SHA-256) and recorded in `events` and appended to `evidence_ledger` with `prev_hash` to enable tamper-evidence.

## 5. SBOM Representation
Store minimal SBOM metadata by default:
- sbom_hash: SHA-256 of SBOM
- format: CycloneDX/SPDX
- package_count, package_purls (index)
- storage_path (optional)

Tenant may opt into full SBOM storage; otherwise we retain only metadata + purls and a reference to an external location.

## 6. Queue & Worker Patterns
- Ingestion publishes work items to a queue with routing keys: `sbom.refresh`, `vuln.check`, `export.build`
- Workers are stateless, idempotent, and fetch job by event_hash or job_id
- Use at-least-once delivery with dedupe via Redis idempotency keys and database unique constraints
- Dead-letter queue (DLQ) for poison messages; ops-service monitors DLQ

## 7. Idempotency & Verification
- Webhook receiver records `delivery_id` with unique constraint to prevent duplication
- Job workers create idempotency token: `{job_type}:{event_hash}` in Redis with TTL
- All ledger inserts check for existing `event_hash` before insert

## 8. Vulnerability Matching
- Feeds normalized into a canonical vuln model (ecosystem, package, version_range, cves, severity)
- Matching algorithm:
  1. Map SBOM package purl to canonical package id
  2. Compare version against feed ranges
  3. Score by severity + exploitability heuristics
- Cache feed lookups in Redis with TTL; background refresh updates feed cache

## 9. Evidence Export Format
- Export pack (JSON-first):
  - manifest.json (org, window, repo list, start/end hashes)
  - events/ (ndjson of canonical events)
  - sboms/ (metadata + optional files)
  - findings/ (matching results)
  - signature (detached signature over manifest)

Integrity: manifest includes chain head/tail hashes; option to sign with platform key or provide tenant signing support.

## 10. Security & Privacy
- Tenant isolation enforced in every query (org_id filter)
- Strong auth via OIDC; admin flows require MFA
- Secrets in K8s secrets / vault
- Webhook verification (GitHub HMAC) and rate limiting on public endpoints
- Data minimisation default: only metadata stored

## 11. Observability & Ops
- Metrics: ingestion rate, queue depth, worker failures, SBOM refresh lag
- Tracing: OpenTelemetry across services for request traces
- Logs: structured JSON to centralized logging (EU region)
- Alerts: DLQ non-empty, repeated worker errors, feed failures

## 12. NFRs mapping (short)
- Deliverability: schema versioning, idempotent processing, queue metrics
- Affordability: metadata-first, caching, background consolidation
- Desirability: non-intrusive integrations, clear exports
- Adoptability: minimal permission GitHub App, tenant exportability

## 13. Next implementation slices (suggested)
1. Minimal platform skeleton: `auth-service`, `tenancy-service`, `repo-integration-service` (webhook receiver), Postgres schema, and simple frontend login
2. Ingestion -> evidence ledger insert -> simple `sbom-service` endpoint to accept sample SBOM metadata
3. Basic `compliance-engine` worker that runs a canned vuln match against a static feed and writes `findings`
4. Export builder prototype producing JSON pack and manifest hash


---

This initial LLD is intended to be iterated once you confirm storage choices, message broker, and preferred deployment target. Replace RabbitMQ with SQS/Kinesis if you prefer managed AWS primitives.

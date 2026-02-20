# CRANIS2

## High-Level Design

### Development Lineage & Compliance Evidence Platform

**Version 1.1**

---

## Document Control

* **Owner:** Product Owner / Solution Architect (CRANIS2)
* **Audience:** Engineering, Security, Procurement, Audit/Assurance
* **Scope:** Design, configuration, and development lineage; SBOM & vulnerability evidence; documentation exports
* **Out of Scope:** Runtime decision logging, runtime monitoring, policy enforcement in customer delivery pipelines, source code storage/inspection

---

## 1. Purpose

CRANIS2 provides **customer-owned, immutable evidence** of how software is **designed, configured, and developed**, and supports **compliance evidence generation** by maintaining SBOM snapshots and checking them against vulnerability intelligence sources.

CRANIS2 is **observer-only**: it does not sit in runtime paths, and it does not claim to “make customers compliant”. It provides **audit-ready evidence** and **defensible lineage**.

---

## 2. Scope

### 2.1 In Scope

* Web application:

  * registration and onboarding
  * organisation/team/user administration
  * dashboard and evidence views
  * on-demand documentation/evidence requests
  * handling external (non-user) evidence/compliance requests

* Identity and tenancy:

  * Organisation → Teams → Users (contributors)
  * role-based access control

* Integrations:

  * GitHub App (repo discovery, webhook ingestion)
  * Stripe (subscriptions and billing state)
  * vulnerability intelligence sources

* Event ingestion and processing:

  * webhook receiver with verification and idempotency
  * process queue and workers
  * scheduling of SBOM refresh and vulnerability checks

* Evidence and compliance:

  * SBOM ingestion (metadata-first; optional full SBOM storage)
  * vulnerability matching and alerting
  * immutable lineage/evidence storage
  * evidence export packs with integrity proofs

### 2.2 Out of Scope

* Runtime monitoring of production systems
* Runtime agent decision logging (customer responsibility)
* Enforcement of CI/CD gates (CRANIS2 may record outcomes, not control them)
* Source code storage or inspection
* Formal compliance certification (CRA/NIS2 “views” are mappings, not guarantees)

---

## 3. Architectural Principles

1. **Customer-Owned Evidence**
   Evidence is owned by the organisation tenant and is exportable at any time.

2. **Observer-Only & Non-Intrusive**
   CRANIS2 observes development activity; it must not disrupt delivery.

3. **Append-Only, Tamper-Evident Storage**
   Once recorded, evidence cannot be altered; integrity must be verifiable.

4. **Metadata-First**
   Prefer hashes and metadata; store minimal data necessary for evidence value.

5. **Organisation → Teams → Users**
   Hierarchy underpins governance, access control, attribution, and billing.

6. **Contributor-Centric Licensing**
   Licensing is per active user (contributor), billed at organisation level.

7. **EU Sovereignty by Design**
   Hosting and sub-processors operate within EU residency and jurisdiction constraints.

---

## 4. Stakeholders and Users

* **Organisation Administrator:** onboarding, users, teams, repos, billing, exports
* **Audit/Assurance User:** evidence views and export packs
* **Developer/Contributor:** typically no daily interaction (non-intrusive)
* **External Requestor (Non-user):** requests evidence pack or confirmation via public portal
* **Platform Operator (CRANIS2):** health, incidents, queue operations, integrity verification

---

## 5. Logical Architecture

### 5.1 Presentation Layer

* **Public Website (HTML/CSS3):** welcome/home/product pages
* **Web App Dashboard:** authenticated UI for admin/audit workflows
* **Public Evidence Request Portal:** controlled intake for non-user requests

### 5.2 Core Services

1. **Identity & Tenancy Service**

   * organisations, teams, users (contributors)
   * roles (Org Admin, Auditor, Read-only)
   * GitHub identity mappings

2. **Billing Service**

   * Stripe customer/subscription lifecycle
   * contributor-centric usage and invoicing state

3. **Repository Integration Service**

   * GitHub App installation flows
   * repo discovery
   * enablement rules (org/team/user scope)
   * webhook ingestion (verify, de-dupe)

4. **Event Ingestion & Normalisation Service**

   * convert GitHub events to canonical lineage events
   * apply enablement policy
   * publish work items to queue

5. **SBOM Service**

   * ingest SBOM snapshots (CycloneDX/SPDX)
   * normalise package identifiers (purl where possible)
   * link SBOMs to repo/release events

6. **Vulnerability Intelligence Service**

   * connectors to vulnerability sources
   * caching and normalisation
   * matching utilities for ecosystems/versions

7. **Compliance Engine**

   * schedule and execute SBOM → vulnerability checks
   * severity policy evaluation
   * generate notifications and evidence annotations

8. **Notification Service**

   * email and in-app notifications
   * delivery tracking, retries, user preferences
   * escalation rules (later)

9. **Evidence Store & Export Service**

   * immutable append-only lineage/evidence ledger
   * integrity verification
   * evidence export packs (PDF/JSON later; MVP may start JSON-first)

10. **Operations & Admin Service (Internal)**

* queue monitoring, dead-letter handling
* integration health and incident management
* platform integrity checks

### 5.3 Integration Layer (Cross-cutting)

* Stripe integration adapters
* GitHub API adapters
* Vulnerability feed adapters
* Data access layer to persistence stores

---

## 6. Organisation, Team, User Hierarchy

### 6.1 Canonical Hierarchy

* **Organisation (Tenant):** owns data, evidence, billing, exports
* **Teams:** logical groups for governance, suppliers/offshore, reporting
* **Users (Contributors):** real people; mapped to GitHub identities; billable when active

### 6.2 Repository Coverage and “Users on a Repo”

CRANIS2 does not manually maintain “users per repository”. Instead it derives it:

> **Users working on a repo = distinct mapped contributors observed on enabled events for that repo within a defined time window.**

### 6.3 Repository Enablement Rules

Repositories can be enabled for observation at:

* organisation level (all repos)
* team level (selected repos for that team)
* user level (specific users + repos)

Enablement is fully auditable and must remain **observer-only**.

---

## 7. Processing Model

### 7.1 Event Flow (GitHub to Evidence)

1. GitHub webhook delivered to CRANIS2
2. Webhook signature verified; delivery id recorded (idempotency)
3. Repo identified; enablement rules evaluated
4. Canonical lineage event created
5. Event appended to evidence store (immutable)
6. Work item placed on queue for downstream processing (SBOM refresh, vuln check)

### 7.2 Scheduling Model

Triggers:

* release/tag event → schedule SBOM refresh + vulnerability check
* dependency change signals (optional) → schedule SBOM refresh
* periodic re-check (e.g. daily/weekly) → re-evaluate SBOM against new vulns

### 7.3 Compliance Engine Flow

1. Retrieve most recent SBOM snapshot for repo/release
2. Retrieve vulnerability intel (cached)
3. Match packages and versions
4. Evaluate policy (severity, exploitability where available)
5. Create findings and notifications
6. Append compliance events to evidence store (tamper-evident)

---

## 8. Data Architecture

### 8.1 Primary Data Stores (Logical)

* **Relational DB:** organisations, teams, users, roles, enablement rules, billing state, indexes
* **Immutable Evidence Ledger:** append-only event store (may be same DB with strict constraints)
* **Artefact Store:** SBOM files / scan artefacts (optional store; default hashes + metadata)
* **Cache/Index:** vulnerability intel caching and normalised lookup tables

### 8.2 Data Minimisation Defaults

* store metadata and hashes by default
* allow tenant-configured “full SBOM storage” if required
* never store source code

---

## 9. Security Model

* Strong authentication for admins; MFA required (MVP may start with enforced strong auth + roadmap to MFA)
* RBAC: Org Admin / Auditor / Read-only
* Tenant isolation enforced in every query and storage operation
* Webhook verification and idempotency
* Rate limiting on public portal endpoints
* Encryption in transit and at rest
* Secret management for integration credentials
* Immutable audit trail for admin actions and exports

---

## 10. Evidence, Exports, and External Requests

### 10.1 Evidence Exports

Users can request exports by:

* time window
* repository
* team
* contributor

Exports include:

* integrity summary (start/end hashes, verification)
* evidence chain references
* minimal narrative summaries (later)

### 10.2 External (Non-user) Evidence Requests

CRANIS2 supports a public request path for third parties to request evidence from an organisation, subject to:

* organisation approval workflow
* rate limiting and anti-abuse controls
* issuance of a time-limited evidence pack or confirmation token

(Details will be finalised in run books and LLD.)

---

## 11. Non-Functional Requirements

### 11.1 Deliverability

* deterministic canonical event schema and hashing
* idempotent event processing
* clear service boundaries (web, ingestion, engine, evidence)
* schema versioning and backward compatibility
* operational visibility (queue depth, failures, ingestion lag)

### 11.2 Affordability

* metadata-first storage default
* caching of vulnerability intel
* predictable per-contributor billing model
* avoid repo/event-volume billing drivers
* automation-first operations (solo operable)

### 11.3 Desirability

* non-intrusive integration (no workflow disruption)
* minimal UI friction; calm dashboard
* clear, comprehensible evidence outputs for non-engineers
* noise controls for notifications (thresholds, bundling)

### 11.4 Adoptability

* EU sovereignty by design
* least-privilege GitHub App
* no runtime dependency
* incremental onboarding (team-by-team, repo-by-repo)
* easy exit with full export of evidence

---

## 12. Risks and Mitigations

* **Overreach into runtime governance:** maintain explicit out-of-scope boundaries
* **Vuln feed reliability:** cache + retry + multi-source strategy
* **Notification overload:** policy thresholds, grouping, user preferences
* **Supplier resistance:** customer-owned model, metadata-only, non-intrusive
* **Evidence trust:** append-only storage + hash chaining + integrity exports
* **Public portal abuse:** rate limiting, verification, approval workflow

---

## 13. Acceptance Criteria for HLD Approval

The HLD is approved when:

* organisation/team/user hierarchy is agreed
* repo enablement scope logic is agreed
* event/queue/engine architecture is agreed
* evidence immutability and export integrity approach is agreed
* NFR hierarchy and commitments are agreed
* scope exclusions are explicit and accepted

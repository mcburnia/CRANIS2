<!--
  Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi.mcburnie@gmail.com
-->

# Evidence Vault – Developer Workflow

> Maps the 25 process steps in `evidence-vault-process.md` to concrete implementation tasks.
> Each task is tagged: **CODE** (backend/frontend), **INFRA** (infrastructure/config), **OPS** (operational/business process).

---

## What already exists

| Capability | Status | Location |
|---|---|---|
| Compliance snapshot generator (steps 4–5) | Done | `services/compliance-snapshot.ts` |
| SHA-256 manifest + content hash (step 6 partial) | Done | In ZIP as `MANIFEST.sha256` |
| Scaleway Glacier upload/delete (step 14) | Done | `services/cold-storage.ts` |
| Product lifecycle stages (step 3 trigger) | Done | Neo4j `lifecycleStatus`: `pre_production`, `on_market`, `end_of_life` |
| Product versions/releases (step 2) | Done | `product_versions` table |
| RFC 3161 timestamping (step 12) | Done (IP Proof) | `services/ip-proof.ts`, needs wiring to compliance snapshots |
| Activity logging (step 24) | Done | `services/activity-log.ts` |
| 24-hour local file cleanup (step 15 partial) | Done | `services/scheduler.ts` |
| AES-256-GCM encryption | Done | `utils/encryption.ts` |

## What needs building

Organised into implementation phases. Each phase is independently deployable.

---

### Phase A – Release-triggered evidence capture (steps 2–6)

**Goal:** When a product transitions to `on_market`, automatically generate an evidence snapshot tied to that release.

#### A1. Add market placement date to products – CODE
- Add `marketPlacementDate` property to Neo4j Product nodes
- Add to product creation/update API (`routes/products.ts`)
- Auto-set when `lifecycleStatus` changes to `on_market` (if not already set)
- Add to product detail frontend form
- Add to compliance snapshot `product.json` output

#### A2. Add retention end date calculation – CODE
- New utility: `calculateRetentionEndDate(marketPlacementDate, supportEndDate)`
- Rule: `max(marketPlacement + 10 years, supportEndDate)`
- Store as computed property (not persisted; derived from product data)
- Display on product detail page and compliance vault tab

#### A3. Wire lifecycle transition to snapshot generation – CODE
- In the product update route, when `lifecycleStatus` changes to `on_market`:
  - Auto-trigger compliance snapshot generation (same as manual POST)
  - Link snapshot to the current product version (`product_versions.id`)
  - Log as activity: `evidence_vault_release_archived`
- Add `release_id` and `release_version` columns to `compliance_snapshots` table

#### A4. Expand the archive manifest – CODE
- Extend `manifest.json` (new file, separate from `MANIFEST.sha256`) to include:
  - Customer identity (org name, org ID)
  - Product identity (name, ID, CRA category)
  - Release/version identifier
  - Release date (market placement date)
  - Retention start date
  - Retention end date
  - Support end date
  - Archive contents list with individual file hashes
  - Bundle hash (SHA-256 of the entire ZIP)
- Keep `MANIFEST.sha256` for simple integrity checking
- `manifest.json` becomes the structured index for the archive

#### A5. Enhance bundle self-containment – CODE
- Update `README.md` in the ZIP to include:
  - Verification instructions (how to check hashes without CRANIS2)
  - Retention period and legal basis (Art. 13(10))
  - Contact information for retrieval requests
  - Explanation that each release is independently archived

---

### Phase B – RFC 3161 timestamping for compliance snapshots (step 12)

**Goal:** Every compliance snapshot gets an RFC 3161 qualified timestamp proving when it was created.

#### B1. Extract RFC 3161 client into shared service – CODE
- Refactor `services/ip-proof.ts` to extract the RFC 3161 timestamping logic into `services/rfc3161.ts`
- Functions: `requestTimestamp(hash: Buffer): Promise<Buffer>`, `verifyTimestamp(hash: Buffer, token: Buffer): Promise<boolean>`
- Configurable TSA URL (env var `RFC3161_TSA_URL`, default to FreeTSA for dev, QTSP for production)
- Keep ip-proof.ts importing from the shared service

#### B2. Add RFC 3161 to compliance snapshot workflow – CODE
- After snapshot ZIP is generated and content hash computed:
  - Call `requestTimestamp()` with the content hash
  - Store the timestamp token in the DB (`compliance_snapshots.rfc3161_token BYTEA`)
  - Include the `.tsr` file in the Glacier upload alongside the ZIP
- Add `rfc3161_token` and `rfc3161_timestamp` columns to `compliance_snapshots`

#### B3. Include verification instructions – CODE
- Add `VERIFY.md` to the ZIP explaining:
  - How to verify the SHA-256 manifest
  - How to verify the RFC 3161 timestamp token using `openssl ts -verify`
  - What the timestamp proves (existence at a point in time, not authorship)

---

### Phase C – Document signing (steps 11, 13)

**Goal:** CRANIS2 digitally signs certificates and archives with its own key pair, proving they were issued by CRANIS2.

#### C1. Generate and manage CRANIS2 signing key – INFRA
- Generate an Ed25519 key pair for CRANIS2 document signing
- Store private key securely (env var `CRANIS2_SIGNING_KEY` or file path)
- Publish public key at a well-known URL (e.g. `/.well-known/cranis2-signing-key.pem`)
- Document key rotation procedure

#### C2. Implement document signing service – CODE
- New service: `services/signing.ts`
- Functions:
  - `signDocument(content: Buffer): { signature: Buffer, algorithm: string, keyId: string }`
  - `verifySignature(content: Buffer, signature: Buffer): boolean`
- Sign the archive manifest and/or the complete ZIP
- Store signature alongside the archive

#### C3. Add signature to Glacier upload – CODE
- Upload to Scaleway: ZIP + manifest + signature + RFC 3161 token
- Storage structure: `{orgId}/{productId}/{releaseVersion}/{filename}.{zip,sig,tsr,manifest.json}`

---

### Phase D – Retention Funding Certificate + financial controls (steps 7–10, 13)

**Goal:** For each archived release, calculate the storage cost, allocate money to the retention reserve, and generate a signed certificate proving it.

#### D1. Storage cost calculator – CODE
- New service: `services/retention-costing.ts`
- Input: archive size (bytes), retention duration (months), costing model version
- Scaleway Glacier pricing: €0.00254/GB/month
- Include buffer multiplier (e.g. 2x) for pricing changes and retrieval costs
- Output: `{ estimatedCost, fundedAmount, costingModelVersion, calculationDate }`
- Store costing model version in `platform_settings` for auditability

#### D2. Retention reserve ledger – CODE + INFRA
- New table: `retention_reserve_ledger`
  - `id`, `org_id`, `product_id`, `release_id`, `snapshot_id`
  - `archive_hash`, `archive_size_bytes`
  - `estimated_cost_eur`, `funded_amount_eur`
  - `costing_model_version`
  - `retention_end_date`
  - `wise_transaction_ref` (nullable, populated after Wise transfer)
  - `reserve_account_ref`
  - `status` (allocated, topped_up, released)
  - `created_at`
- Each archive creation generates a ledger entry
- Ledger is append-only (amendments create new entries referencing the original)

#### D3. Wise API integration – CODE + INFRA
- New service: `services/wise-reserve.ts`
- On archive creation, initiate a transfer to the retention reserve account
- Store the Wise transaction reference in the ledger
- **Note:** This may start as a manual process (admin transfers funds quarterly) with the ledger tracking what's owed. Full Wise API automation is a future enhancement.
- Env vars: `WISE_API_KEY`, `WISE_RESERVE_ACCOUNT_ID`

#### D4. Retention Funding Certificate generator – CODE
- New service: `services/retention-certificate.ts`
- Generates a structured Markdown document containing:
  - Customer legal name and org ID
  - Product and release identifiers
  - Archive hash and storage path
  - Archive size
  - Estimated cost and funded amount
  - Ledger reference and Wise transaction reference
  - Retention period (start date → end date)
  - Costing model version
  - Creation timestamp
- Certificate uses "restricted retention reserve" and "allocated for the benefit of" language
- Certificate is signed (Phase C) and RFC 3161 timestamped (Phase B)

#### D5. Certificate storage – CODE
- Store certificate + signature + timestamp token:
  1. In the Glacier vault alongside the evidence archive
  2. In the `retention_reserve_ledger` row (certificate hash reference)
  3. Exportable for accountant custody (step 19, initially manual)

---

### Phase E – Storage lifecycle and retention controls (steps 15, 20, 23) ✅

**Goal:** Archives move through storage tiers over time. Deletion is blocked until retention expires.

**Status:** DONE. Storage tier management simplified (uploads go directly to Glacier class via Scaleway). Retention lock, expiry monitoring, and reserve sufficiency monitoring all implemented.

#### E1. Retention columns – DONE
- Added `retention_end_date DATE` and `legal_hold BOOLEAN` to `compliance_snapshots`
- `retention_end_date` backfilled automatically by `createLedgerEntry()` after ledger calculation
- Storage tier management not needed. Scaleway uploads go directly to Glacier class

#### E2. Retention lock – DONE
- DELETE endpoint blocks deletion if `retention_end_date` is in the future (409 response)
- DELETE endpoint blocks deletion if `legal_hold` is true (409 response)
- Frontend shows "Retention lock" / "Legal hold" badges (amber Lock icon)
- Frontend delete handler shows meaningful error messages on 409

#### E3. End-of-retention handling – DONE
- Daily scheduled task at 09:00 UTC (`checkRetentionExpiry`)
- Finds snapshots past retention end date (not on legal hold), marks as `retention_complete`
- Does NOT auto-delete. Creates admin notification for review
- Debounced: one notification per admin per day

#### E4. Reserve sufficiency monitoring – DONE
- Monthly scheduled task on 1st of each month at 10:00 UTC (`checkReserveSufficiency`)
- Recalculates remaining retention cost for each `allocated` ledger entry
- Flags shortfalls >20% with `high` severity admin notification
- Reports total estimated shortfall in EUR

---

### Phase F – Retrieval and verification (steps 16–18)

**Goal:** Active customers can browse and retrieve evidence. Anyone can verify an archive pack.

#### F1. Release evidence index – CODE
- New API: `GET /api/products/:productId/evidence-vault`
  - Lists all archived releases with metadata
  - Includes retention dates, archive status, cold storage status
  - Filterable by release, date range
- Frontend: new "Evidence Vault" section on product detail page (extends existing ComplianceVaultTab)

#### F2. Regulator-ready export – CODE
- New API: `POST /api/products/:productId/evidence-vault/export`
  - Options: all releases, specific release, date range
  - Produces a combined export pack:
    - Individual archive ZIPs
    - Retention Funding Certificates
    - Verification guide
    - Index document linking everything
  - Returns download URL (available for 24 hours)

#### F3. Independent verification endpoint – CODE
- Public endpoint: `GET /api/verify/:archiveHash`
  - No authentication required
  - Returns: archive exists (yes/no), timestamp date, retention status
  - Does NOT return archive contents (privacy)
- Include verification instructions in every archive README

---

### Phase G – Accountant custody and audit trail (steps 19, 24)

**Goal:** Certificates are lodged with accountants. Every event is logged.

#### G1. Accountant export pack – CODE + OPS
- Admin function: generate quarterly accountant pack containing:
  - All new Retention Funding Certificates from the period
  - Signature artefacts and RFC 3161 tokens
  - Summary ledger extract (total allocated, total stored, total by customer)
- Export as ZIP, downloadable from admin panel
- **OPS:** Establish process for sending to accountant (email/secure transfer)

#### G2. Comprehensive audit trail – CODE
- Extend `activity-log.ts` with new event types:
  - `evidence_vault_release_archived`
  - `evidence_vault_reserve_funded`
  - `evidence_vault_certificate_generated`
  - `evidence_vault_certificate_signed`
  - `evidence_vault_rfc3161_timestamped`
  - `evidence_vault_archived_to_glacier`
  - `evidence_vault_retrieved`
  - `evidence_vault_reserve_topped_up`
  - `evidence_vault_retention_expired`
  - `evidence_vault_deleted`
- Each event logged with full metadata (hashes, amounts, references)

---

### Phase H – Frontend and customer experience (steps 16, 17, 25)

**Goal:** Customers see the vault as a managed control, not raw storage.

#### H1. Evidence vault dashboard – CODE
- Product detail tab: timeline view of all archived releases
- Per-release card showing:
  - Release version and date
  - Archive status and cold storage tier
  - Retention period with countdown
  - Funding certificate status
  - Quick actions: download, verify, export for regulator
- Visual indicator: "Retention funded until {date}"

#### H2. Release-to-market workflow – CODE
- When user changes lifecycle to `on_market`:
  - Confirmation modal explaining what happens:
    - "CRANIS2 will capture a compliance evidence snapshot"
    - "The archive will be timestamped and stored in the vault"
    - "Storage is funded for the full retention period"
  - Progress indicator during generation
  - Success state showing the certificate summary

#### H3. Subscription page messaging – CODE
- Update Pro plan description to include:
  - "10-year evidence vault included"
  - "RFC 3161 qualified timestamps"
  - "EU-sovereign cold storage"
  - "Regulator-ready retrieval"

---

## Implementation order (recommended)

| Phase | Depends on | Effort | Priority |
|---|---|---|---|
| **A** – Release-triggered capture | – | Medium | 1st |
| **B** – RFC 3161 for snapshots | A | Low | 2nd |
| **C** – Document signing | – | Low | 3rd |
| **D** – Funding certificates + ledger | A, B, C | High | 4th |
| **E** – Storage lifecycle + retention | A, D | Medium | 5th |
| **F** – Retrieval + verification | A, B | Medium | 6th |
| **G** – Accountant custody + audit | D, F | Low | 7th |
| **H** – Frontend + customer experience | A–G | Medium | Throughout |

**Phases A–C** are pure engineering and can start immediately.
**Phase D** requires a business decision on the Wise reserve process (manual vs automated).
**Phase E–G** build on the foundation.
**Phase H** is iterative. Each phase adds frontend elements.

---

## Mapping to existing P8 backlog

| P8 Item | Covered by |
|---|---|
| #40 Compliance snapshot generator | Done + Phase A enhancements |
| #41 RFC 3161 timestamping | Phase B |
| #42 Scaleway Glacier cold storage | Done + Phase E enhancements |
| #43 Automated snapshot scheduling | Phase A3 (release trigger) + future event triggers |
| #44 Retention dashboard | Phase F1 + Phase H1 |

**New items introduced by the evidence vault process:**
- Retention Funding Certificate (Phase D)
- Document signing (Phase C)
- Reserve ledger + Wise integration (Phase D)
- Storage lifecycle tiering (Phase E)
- Retention lock + end-of-retention handling (Phase E)
- Accountant custody exports (Phase G)
- Public verification endpoint (Phase F3)

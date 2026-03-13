# CRANIS2 Funded 10-Year Evidence Vault Process

> **Owner:** Andi Burns
> **Created:** 2026-03-12
> **Status:** Approved process design, implementation in progress

---

## 1. Customer subscribes to CRANIS2

- Customer accepts the CRANIS2 service terms for managed evidence retention.
- Terms make clear that:
  - the **manufacturer remains legally responsible** for CRA compliance;
  - CRANIS2 provides the **managed retention and retrieval control**;
  - CRANIS2 allocates and manages a **restricted retention reserve** to cover archive storage costs.

## 2. Product and release are registered in CRANIS2

- The customer defines:
  - legal entity name;
  - product name and identifier;
  - version/release identifier;
  - market placement date;
  - support end date, if known.
- CRANIS2 calculates the initial retention end date as:
  - **10 years from market placement**, or
  - **longer if support period requires it**.

## 3. Release-to-market event is triggered

- When the customer marks a release as distributed, published, or placed on the market, CRANIS2 starts the evidence vault workflow.
- This event becomes the formal trigger for evidence capture.

## 4. CRANIS2 freezes the release evidence set

- CRANIS2 captures the artefacts that represent the product state at release time.
- Typical contents:
  - SBOM snapshot;
  - vulnerability scan outputs;
  - risk assessment;
  - build/provenance records;
  - declarations;
  - release notes;
  - user documentation;
  - hashes/checksums;
  - any other CRA-relevant evidence.
- The goal is to create a **point-in-time compliance record** for that release.

## 5. CRANIS2 builds a self-contained evidence bundle

- All relevant artefacts are assembled into a structured archive folder or package.
- Recommended structure:
  - `manifest.json`
  - `sbom.*`
  - `vulnerability-report.*`
  - `risk-assessment.*`
  - `declaration-of-conformity.*`
  - `build-provenance.*`
  - `documentation.*`
  - `README.txt`
- The bundle must remain intelligible even if CRANIS2 no longer exists.

## 6. CRANIS2 generates the archive manifest

- The manifest records:
  - customer identity;
  - product identity;
  - release/version;
  - release date;
  - retention start date;
  - retention end date;
  - support end date;
  - archive contents list;
  - hashes of included files;
  - bundle hash.
- This manifest becomes the primary technical index for that release archive.

## 7. CRANIS2 calculates the long-term storage cost

- CRANIS2 calculates the estimated storage cost for the full retention period using:
  - archive size;
  - current storage pricing model;
  - retention duration;
  - a prudential uplift or buffer.
- Recommended formula:
  - estimated cost for full retention period;
  - then apply a **buffer multiplier** to protect against pricing changes, retrieval costs, and estimation drift.

## 8. CRANIS2 allocates money into the retention reserve

- At archive creation time, CRANIS2 transfers the calculated funded amount into the dedicated Wise business retention account.
- That account should be:
  - separate from operating cash;
  - linked to the payment card used for Scaleway billing;
  - used only for retention-related charges.
- This creates the economic equivalent of "pre-funding" the archive.

## 9. CRANIS2 records the financial transaction in the ledger

- A ledger entry is created for the archive funding event.
- It should include:
  - customer ID;
  - product ID;
  - release ID;
  - archive hash;
  - archive size;
  - estimated storage cost;
  - funded amount;
  - Wise transaction reference;
  - reserve account reference;
  - retention end date;
  - costing model version.

## 10. CRANIS2 creates the Retention Funding Certificate

- A certificate is generated linking:
  - the evidence archive;
  - the allocated reserve;
  - the customer/beneficiary;
  - the retention period.
- Suggested wording should use:
  - **restricted retention reserve**;
  - **allocated for the benefit of the named customer/archive**;
  - not casual statements of ownership unless legally supported.
- The certificate should contain:
  - customer legal name;
  - product and release identifiers;
  - archive hash and URI/path;
  - archive size;
  - estimated cost;
  - funded amount;
  - ledger and Wise references;
  - retention period;
  - calculation method version;
  - creation timestamp.

## 11. CRANIS2 signs the certificate

- CRANIS2 signs the certificate with its private signing key.
- This proves the certificate was formally issued by CRANIS2 and has not been altered since signing.

## 12. CRANIS2 timestamps the certificate using RFC 3161

- The signed certificate is submitted to the RFC 3161 timestamping workflow.
- The returned timestamp token is stored alongside the certificate.
- This proves the certificate existed in that exact form at that point in time.

## 13. CRANIS2 stores the certificate and timestamp package

- Store:
  - the certificate file;
  - its digital signature;
  - the RFC 3161 timestamp token.
- Keep copies in three places:
  - with the evidence archive;
  - in the internal CRANIS2 ledger/evidence store;
  - with the external accountant/custodian.

## 14. CRANIS2 uploads the evidence bundle to the vault

- The evidence archive is written to Scaleway object storage.
- The storage path should be deterministic and understandable, for example by customer, product and release.
- The vault should contain:
  - archive bundle;
  - manifest;
  - certificate;
  - signature;
  - RFC 3161 token;
  - optional verification instructions.

## 15. CRANIS2 applies lifecycle and retention controls

- The storage policy moves evidence through the appropriate temperature tiers over time.
- Example:
  - hot or standard at first;
  - colder tier later;
  - glacier/deep archive for long-term retention.
- Deletion must be blocked until retention expiry and any legal hold conditions are satisfied.

## 16. CRANIS2 keeps hot metadata available while the customer is active

- While the customer is an active subscriber, CRANIS2 keeps:
  - searchable metadata;
  - release index;
  - retrieval interface;
  - audit trail.
- This gives the customer easy access to current and historical compliance evidence without needing to work directly with raw archive storage.

## 17. CRANIS2 supports regulator-ready retrieval

- The customer can request:
  - all evidence for a product;
  - all evidence for a specific release;
  - evidence for a date range;
  - the signed and timestamped funding record.
- CRANIS2 produces an export pack that is intelligible without CRANIS2 itself.

## 18. CRANIS2 supports independent verification

- Anyone with the archive pack should be able to verify:
  - file hashes;
  - bundle hash;
  - certificate signature;
  - RFC 3161 timestamp token;
  - linkage between archive and reserve record.
- This is critical for regulator, insurer, investor, and due diligence trust.

## 19. CRANIS2 lodges a custody copy with the accountants

- The accountant receives a copy of:
  - the Retention Funding Certificate;
  - signature artefacts;
  - timestamp token;
  - optionally a summary ledger extract.
- This creates an independent professional record that strengthens the governance trail.

## 20. CRANIS2 monitors reserve sufficiency over time

- Periodically, CRANIS2 checks:
  - remaining retention horizon;
  - actual archive size;
  - storage pricing changes;
  - reserve sufficiency.
- If funding is materially insufficient:
  - CRANIS2 tops up the reserve;
  - generates an amended reserve record;
  - signs and timestamps the top-up certificate.

## 21. CRANIS2 handles superseding releases correctly

- A new release does **not** replace the old archive.
- Each market release gets its own evidence bundle and funding record.
- Archives are retained independently according to their own retention windows.

## 22. CRANIS2 handles subscription end safely

- If the customer leaves CRANIS2:
  - existing archives remain in storage;
  - existing reserve allocations remain dedicated to archive costs;
  - retrieval instructions and archive identifiers are made available to the customer.
- No already-funded archive should become invalid merely because the operational subscription ends.

## 23. CRANIS2 defines end-of-retention handling

- At the end of the lawful retention period, CRANIS2 checks:
  - no legal hold applies;
  - no contractual extension applies;
  - no regulatory extension applies.
- Only then may the archive be marked eligible for deletion or long-term discretionary retention.
- Any deletion action should be separately logged and approved.

## 24. CRANIS2 maintains a full audit trail

- Every key event is logged:
  - release declared;
  - artefacts captured;
  - archive created;
  - hash calculated;
  - reserve funded;
  - certificate generated;
  - certificate signed;
  - RFC 3161 timestamp applied;
  - archive stored;
  - archive retrieved;
  - reserve topped up;
  - archive expired or deleted.
- This forms the operational proof that the control is functioning.

## 25. CRANIS2 presents this as a managed control

- Internally and externally, describe the service as:
  - a **managed CRA evidence retention and retrieval control**;
  - supported by a **restricted retention reserve**;
  - evidenced by **signed and RFC 3161 timestamped funding certificates**;
  - with independent custody copies lodged with accountants.
- Avoid claiming that legal compliance transfers from the manufacturer to CRANIS2.
- Say instead that CRANIS2 **removes the operational burden** of implementing the retention control.

---

## Control statement

> CRANIS2 automatically captures, hashes, archives, funds, signs, timestamps and retains release evidence packages for the required retention period, with independently lodged reserve certificates and regulator-ready retrieval.

## Plain-English summary

> Every time a product release is placed on the market, CRANIS2 creates an immutable evidence pack, calculates the full long-term storage cost, allocates that money into a restricted reserve, signs and RFC 3161-timestamps the funding certificate, stores the archive in the vault, and keeps the proof chain available for regulators, auditors and the customer.

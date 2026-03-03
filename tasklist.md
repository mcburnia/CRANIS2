# CRANIS2 — MVP Task List

## Priority: CRITICAL (CRA Mandate)

### 1. SBOM Export
Export SBOMs in industry-standard formats (CycloneDX / SPDX) for submission to market surveillance authorities as required by the Cyber Resilience Act.

> **Compliance package delivered via the Due Diligence feature** (`/due-diligence`).

- [x] Define export format(s) — CycloneDX 1.6 and SPDX 2.3 both implemented
- [x] Build backend endpoint to generate exportable SBOM (`/api/sbom/:productId/export/cyclonedx` and `/api/sbom/:productId/export/spdx`)
- [x] Add download/export button to product detail page (Dependencies tab — dropdown with CycloneDX and SPDX options)
- [x] Include version metadata, licence info, and dependency tree (PURLs, hashes, relationships, manufacturer info)
- [x] Validate output against CycloneDX/SPDX schema (structural completeness validation added; `X-SBOM-Warnings` header on export, `validationWarnings` on status endpoint)

### 2. Compliance Package
Bundle all CRA-required documentation into a single downloadable package for each product — technical file, SBOM, vulnerability disclosures, and conformity declaration.

> **Implemented as the Due Diligence export** (`/api/due-diligence/:productId/export`). Downloads a ZIP containing the PDF report, CycloneDX SBOM, licence findings CSV, vulnerability summary JSON, Annex VII Technical File JSON, and full licence texts.

- [x] Define package contents and structure (ZIP with 6 file types)
- [x] Build backend endpoint to assemble and zip the compliance package
- [x] Include technical file (all 8 Annex VII sections — `technical-file.json` in ZIP)
- [x] Include latest SBOM export (CycloneDX 1.6 in ZIP)
- [x] Include vulnerability disclosure summary (`vulnerability-summary.json` in ZIP)
- [x] Include stakeholder/contact information (organisation contact in PDF and CycloneDX metadata)
- [x] Add download button to product detail page (Due Diligence page) and Technical Files overview (Download button per product card)

---

## Priority: HIGH

### 3. IP / Copyright Proof
Provide evidence of intellectual property ownership and open-source licence compliance across all dependencies — a key differentiator for due diligence and CRA conformity.

- [x] Analyse dependency licences from SBOM data (licence scanner implemented)
- [x] Flag incompatible or high-risk licences (e.g. AGPL in proprietary products — licence compatibility matrix)
- [x] Generate licence compliance report per product (PDF section + `license-findings.csv` in Due Diligence ZIP)
- [x] Surface licence risk on dashboard and product detail page (Licence Compliance page, risk badges)

### 4. Billing & Reports
Replace stub pages with functional billing management and compliance reporting.

- [x] Define billing model (contributor-based, EUR 6/month, 90-day trial)
- [x] Integrate payment provider (Stripe — checkout sessions, customer portal, webhooks, 9 billing email templates)
- [x] Build billing page with plan management, invoices, usage
- [x] Define report types (compliance summary, vulnerability trends, audit trail)
- [x] Build reports page with generation and export (PDF/CSV)

---

## Priority: MEDIUM

### 5. Escrow Capability
Offer source code escrow integration for customers who require guaranteed access to source code — relevant for critical infrastructure suppliers under NIS2.

- [x] Research escrow provider APIs — self-hosted Forgejo chosen for EU data sovereignty
- [x] Define escrow workflow and triggers — setup wizard, daily scheduled deposits (5 AM), manual trigger, initial setup deposit, and final archive on product deletion
- [x] Build escrow status tracking per product — escrow_configs, escrow_deposits, escrow_users tables; status endpoint; deposit history with commit SHAs
- [x] Add escrow management UI to product detail page — full EscrowPage.tsx accessible via "Escrow" button on product detail; dashboard with artifact toggles, agent management, deposit history

---

## Notes
- Tackle one feature at a time — plan, build, test, commit before moving on
- Each feature should be planned and approved before implementation begins
- **All MVP tasks are complete.**

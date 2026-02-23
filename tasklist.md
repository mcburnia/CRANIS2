# CRANIS2 — MVP Task List

## Priority: CRITICAL (CRA Mandate)

### 1. SBOM Export
Export SBOMs in industry-standard formats (CycloneDX / SPDX) for submission to market surveillance authorities as required by the Cyber Resilience Act.

- [ ] Define export format(s) — CycloneDX JSON, SPDX, or both
- [ ] Build backend endpoint to generate exportable SBOM from stored dependency data
- [ ] Add download/export button to product detail page
- [ ] Include version metadata, licence info, and dependency tree
- [ ] Validate output against CycloneDX/SPDX schema

### 2. Compliance Package
Bundle all CRA-required documentation into a single downloadable package for each product — technical file, SBOM, vulnerability disclosures, and conformity declaration.

- [ ] Define package contents and structure
- [ ] Build backend endpoint to assemble and zip the compliance package
- [ ] Include technical file (all 8 Annex VII sections)
- [ ] Include latest SBOM export
- [ ] Include vulnerability disclosure summary
- [ ] Include stakeholder/contact information
- [ ] Add download button to product detail page and technical files overview

---

## Priority: HIGH

### 3. IP / Copyright Proof
Provide evidence of intellectual property ownership and open-source licence compliance across all dependencies — a key differentiator for due diligence and CRA conformity.

- [ ] Analyse dependency licences from SBOM data
- [ ] Flag incompatible or high-risk licences (e.g. AGPL in proprietary products)
- [ ] Generate licence compliance report per product
- [ ] Surface licence risk on dashboard and product detail page

### 4. Billing & Reports
Replace stub pages with functional billing management and compliance reporting.

- [ ] Define billing model (per-org, per-product, tiered)
- [ ] Integrate payment provider (Stripe or similar)
- [ ] Build billing page with plan management, invoices, usage
- [ ] Define report types (compliance summary, vulnerability trends, audit trail)
- [ ] Build reports page with generation and export (PDF/CSV)

---

## Priority: MEDIUM

### 5. Escrow Capability
Offer source code escrow integration for customers who require guaranteed access to source code — relevant for critical infrastructure suppliers under NIS2.

- [ ] Research escrow provider APIs (e.g. NCC Group, Iron Mountain)
- [ ] Define escrow workflow and triggers
- [ ] Build escrow status tracking per product
- [ ] Add escrow management UI to product detail page

---

## Notes
- Tackle one feature at a time — plan, build, test, commit before moving on
- SBOM Export is the foundation — Compliance Package depends on it
- Each feature should be planned and approved before implementation begins

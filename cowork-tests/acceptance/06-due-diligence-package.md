# Test: Due Diligence Package — Preview, Generate, Download ZIP

**Priority:** high
**Preconditions:** User is logged in as org admin. At least one product exists with SBOM data and compliance information populated. The product should have vulnerability scan results and ideally some CRA report history.
**Test User:** testadmin@manufacturer-active.test / TestPass123!
**URL:** https://dev.cranis2.dev/login

## Steps

### Step 1 — Login
**Action:** Enter email `testadmin@manufacturer-active.test` and password `TestPass123!`. Click "Sign In".
**Expected:** User is redirected to the dashboard.

### Step 2 — Navigate to Due Diligence
**Action:** In the sidebar, expand the "Compliance" section. Click "Due Diligence" or equivalent navigation item.
**Expected:** The due diligence page loads showing a list of products or an overview of due diligence package readiness.

### Step 3 — Select a Product for Due Diligence
**Action:** Select a product that has compliance data (SBOM, vulnerability scans, etc.).
**Expected:** The due diligence detail page for the selected product loads.

### Step 4 — View Due Diligence Preview
**Action:** Review the due diligence preview/summary section.
**Expected:** The preview displays a summary of what will be included in the package:
- SBOM status and dependency count
- Vulnerability scan summary
- License compliance status
- IP proof information (if available)
- CRA report history (if any)
- Technical documentation status
Each section indicates whether data is available or missing.

### Step 5 — Generate Due Diligence Package
**Action:** Click "Generate Package" or "Build Due Diligence Package".
**Expected:** A loading indicator appears while the package is being assembled. After completion, a success message confirms the package has been generated.

### Step 6 — Download ZIP
**Action:** Click "Download" or the download icon for the generated package.
**Expected:** A ZIP file downloads to the browser. The file name includes the product name and a date/timestamp (e.g. `product-name-due-diligence-2026-02-27.zip`).

### Step 7 — Verify ZIP Contents
**Action:** Open the downloaded ZIP file and inspect its contents.
**Expected:** The ZIP contains relevant compliance documentation:
- SBOM export file (CycloneDX or SPDX format)
- Vulnerability report summary
- License compliance information
- Any additional compliance artifacts
The files are properly named and contain valid data.

## Pass Criteria
- [ ] Due diligence page loads and lists products
- [ ] Due diligence preview shows a summary of available compliance data
- [ ] Missing data sections are clearly indicated
- [ ] Package generation completes without errors
- [ ] ZIP file downloads successfully
- [ ] ZIP contains the expected compliance documents
- [ ] Downloaded files contain valid, non-empty data

## Result
**Status:** passed
**Notes:** All steps verified. Defects found during testing have been resolved and re-verified.

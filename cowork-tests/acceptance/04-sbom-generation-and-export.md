# Test: SBOM Generation and Export — View, Sync, Dependencies, Export

**Priority:** critical
**Preconditions:** User is logged in as org admin. At least one product exists with a connected repository that has recognisable dependencies (e.g. a Node.js project with package-lock.json or a Python project with requirements.txt).
**Test User:** testadmin@manufacturer-active.test / TestPass123!
**URL:** https://dev.cranis2.dev/login

## Steps

### Step 1 — Login
**Action:** Enter email `testadmin@manufacturer-active.test` and password `TestPass123!`. Click "Sign In".
**Expected:** User is redirected to the dashboard.

### Step 2 — Navigate to Product with Connected Repo
**Action:** Click "Products" in the sidebar. Select a product that has a connected repository.
**Expected:** The product detail page loads.

### Step 3 — View SBOM Status
**Action:** Navigate to the "SBOM" tab or section of the product.
**Expected:** The SBOM section displays:
- Current SBOM status (generated, pending, or not yet generated)
- SBOM source type if generated (api, lockfile, or import-scan)
- Last sync timestamp if previously generated
- Dependency count if available

### Step 4 — Trigger SBOM Sync
**Action:** Click the "Sync SBOM" or "Generate SBOM" button.
**Expected:** A loading indicator appears while the SBOM is being generated. The system uses the three-tier fallback chain:
1. API SBOM (GitHub only)
2. Lockfile parsing
3. Source Import Scanning

After completion, a success message appears with the SBOM source type used.

### Step 5 — View Dependencies List
**Action:** After the SBOM is generated, view the dependencies section.
**Expected:** A list of dependencies is displayed showing:
- Package name
- Version
- License (if detected)
- Ecosystem/package manager
The list should contain at least one dependency from the connected repo.

### Step 6 — Export SBOM as CycloneDX
**Action:** Click the "Export" button or dropdown. Select "CycloneDX" format.
**Expected:** A CycloneDX JSON or XML file downloads to the browser. The file name includes the product name and format identifier.

### Step 7 — Export SBOM as SPDX
**Action:** Click the "Export" button or dropdown. Select "SPDX" format.
**Expected:** An SPDX JSON or tag-value file downloads to the browser. The file name includes the product name and format identifier.

### Step 8 — Verify Export File Contents
**Action:** Open the downloaded CycloneDX file in a text editor.
**Expected:** The file contains valid CycloneDX structure with:
- BOM metadata (tool, timestamp)
- Components array with the dependencies listed in Step 5
- Proper formatting (valid JSON/XML)

## Pass Criteria
- [ ] SBOM section loads and displays current status
- [ ] SBOM sync/generation can be triggered from the UI
- [ ] The SBOM source type is displayed (api, lockfile, or import-scan)
- [ ] Dependencies list populates after generation with package names and versions
- [ ] CycloneDX export downloads a valid file
- [ ] SPDX export downloads a valid file
- [ ] Exported file contains the expected dependency data

## Result
**Status:** _pending_
**Notes:**

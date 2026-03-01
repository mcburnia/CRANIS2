# Test: Navigation — All Sidebar Pages Load

**Priority:** critical  
**Preconditions:** User is logged in as org admin with an active billing plan; at least one product exists  
**Test User:** testadmin@manufacturer-active.test / TestPass123!  
**URL:** https://dev.cranis2.dev/dashboard

## Steps

### Step 1: Navigate to Products
- **Action:** Click "Products" in the sidebar
- **Expected:** The products list page loads at `/products`. A table or card list of products is visible. Page title or heading includes "Products". No error banner or blank page.

### Step 2: Navigate to CRA Reports
- **Action:** Click "CRA Reports" in the sidebar
- **Expected:** The CRA reports page loads at `/cra-reports`. A list of compliance reports or an empty-state message is visible. No console errors.

### Step 3: Navigate to Due Diligence
- **Action:** Click "Due Diligence" in the sidebar
- **Expected:** The due diligence page loads at `/due-diligence`. The page renders with content or an appropriate empty state. No console errors.

### Step 4: Navigate to SBOM Export
- **Action:** Click "SBOM Export" in the sidebar
- **Expected:** The SBOM export page loads at `/sbom-export`. The page renders with export options or a product selector. No console errors.

### Step 5: Navigate to Vulnerabilities
- **Action:** Click "Vulnerabilities" in the sidebar
- **Expected:** The vulnerabilities page loads at `/vulnerabilities`. A list of vulnerability findings or a summary view is displayed. No console errors.

### Step 6: Navigate to License Scan
- **Action:** Click "License Scan" in the sidebar
- **Expected:** The license scan page loads at `/license-scan`. License compliance data or an empty state is shown. No console errors.

### Step 7: Navigate to IP Proof
- **Action:** Click "IP Proof" in the sidebar
- **Expected:** The IP proof page loads at `/ip-proof`. Intellectual property documentation or an empty state is shown. No console errors.

### Step 8: Navigate to Technical Files
- **Action:** Click "Technical Files" in the sidebar
- **Expected:** The technical files page loads at `/technical-files`. A file listing or empty state is shown. No console errors.

### Step 9: Navigate to Escrow
- **Action:** Click "Escrow" in the sidebar
- **Expected:** The escrow page loads at `/escrow`. Escrow deposit status, history, or configuration is visible. No console errors.

### Step 10: Navigate to Billing
- **Action:** Click "Billing" in the sidebar
- **Expected:** The billing page loads at `/billing`. Current plan, usage, or subscription details are visible. No console errors.

### Step 11: Navigate to Marketplace
- **Action:** Click "Marketplace" in the sidebar
- **Expected:** The marketplace page loads at `/marketplace`. Available services or integrations are listed. No console errors.

### Step 12: Navigate to Notifications
- **Action:** Click "Notifications" in the sidebar
- **Expected:** The notifications page loads at `/notifications`. A list of notifications or "No notifications" empty state is shown. No console errors.

### Step 13: Navigate to Settings
- **Action:** Click "Settings" in the sidebar
- **Expected:** The settings page loads at `/settings`. User or organisation settings form fields are visible. No console errors.

### Step 14: Verify No Dead Links
- **Action:** Review the browser console and network tab across all navigation steps
- **Expected:** All page navigations returned 2xx on their API calls. No 404 pages were encountered. No JavaScript exceptions were thrown. All pages rendered within 3 seconds.

## Pass Criteria
- [ ] All 13 sidebar pages load without errors
- [ ] Each page shows meaningful content or an appropriate empty state
- [ ] No 404 or blank pages encountered
- [ ] Sidebar accordion expands/collapses correctly throughout navigation
- [ ] Active page is visually indicated in the sidebar (active dot)
- [ ] No console errors on any page
- [ ] All pages render correctly
- [ ] Response times under 3 seconds for each page

## Result
**Status:** passed
**Notes:** All steps verified. Defects found during testing have been resolved and re-verified.

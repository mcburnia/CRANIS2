# Test: Break — Empty State Handling

**Priority:** medium
**Preconditions:** Application is running. An organisation exists with no products, no CRA reports, and no activity. The empty org test user account is active.
**Test User:** testadmin@empty-org.test / TestPass123!
**URL:** https://dev.cranis2.dev/login

## Steps

### Step 1 — Log in as empty org user
**Action:** Navigate to https://dev.cranis2.dev/login. Log in with testadmin@empty-org.test / TestPass123!.
**Expected:** Login succeeds. The dashboard loads without errors.

### Step 2 — Dashboard with zero data
**Action:** Observe the dashboard page. Look at all stat cards, charts, graphs, and summary widgets.
**Expected:** The dashboard renders without errors. Stat cards show "0" or "N/A" values (not "undefined", "null", "NaN", or blank). Any charts or graphs either show an empty state message (e.g., "No data yet") or render with zero values gracefully. No JavaScript errors in the browser console.

### Step 3 — Empty product list
**Action:** Navigate to the Products page.
**Expected:** The page renders a clear empty state. This should be either: (a) a friendly message like "No products yet" with a call-to-action button to create a product, or (b) an empty table/list with headers visible but no rows. The page does NOT show a loading spinner indefinitely, an error message, or a blank white space.

### Step 4 — Empty notifications
**Action:** Navigate to the notifications area (bell icon, notifications page, or wherever notifications are displayed).
**Expected:** The notifications area shows an empty state message (e.g., "No notifications") or simply shows nothing. It does NOT show an error, "undefined", or a loading spinner that never resolves.

### Step 5 — Empty CRA reports
**Action:** If accessible without a product, navigate to the CRA reports section. If CRA reports require a product, create a temporary product first, then check its CRA reports section.
**Expected:** The CRA reports area shows an empty state (e.g., "No CRA reports yet" with an option to create one). No errors or broken UI elements.

### Step 6 — Empty compliance timeline
**Action:** If a product was created in Step 5, navigate to its compliance timeline page.
**Expected:** The timeline page either shows an empty state message or renders an empty chart/timeline. No errors about missing data. No "Cannot read property of undefined" or similar JavaScript errors.

### Step 7 — Empty vulnerability scans
**Action:** Navigate to the vulnerability scans section (either global or for a specific product).
**Expected:** The page shows an empty state (e.g., "No vulnerability scans performed yet"). No errors or broken layout.

### Step 8 — Empty SBOM data
**Action:** Navigate to the SBOM section for a product (if one was created).
**Expected:** The page shows an empty state indicating no SBOM has been generated. A clear action path is presented (e.g., "Connect a repository to generate an SBOM"). No errors.

### Step 9 — Organisation settings with minimal data
**Action:** Navigate to organisation settings.
**Expected:** The settings page loads with whatever data exists (may be minimal). Empty optional fields show placeholder text or are simply blank — not "undefined" or "null". The save button is functional.

### Step 10 — Empty escrow section
**Action:** Navigate to the escrow section (if accessible).
**Expected:** The page shows an appropriate empty state or a message indicating escrow is not configured. No errors.

### Step 11 — Search or filter with no results
**Action:** If any page has a search or filter feature, use it to search for a term that will return no results (e.g., search for "zzzznonexistent" in the product list).
**Expected:** A "No results found" message is displayed. The search input remains functional. The page does not crash or show an error.

### Step 12 — Verify browser console for errors
**Action:** Open DevTools > Console tab. Navigate through all the empty pages again (Dashboard, Products, Notifications, Settings). Check for any JavaScript errors or warnings.
**Expected:** No JavaScript errors related to rendering empty/null data (e.g., no "Cannot read property of undefined", "TypeError", or "Unhandled rejection" messages). Warnings are acceptable but errors are not.

### Step 13 — Clean up
**Action:** Delete any temporary product created during testing. Log out.
**Expected:** Cleanup completes without errors.

## Pass Criteria

- [ ] Dashboard renders with zero data without showing "undefined", "null", or "NaN"
- [ ] Dashboard stat cards show "0" or "N/A" for empty metrics
- [ ] Empty product list shows a friendly empty state message or call-to-action
- [ ] Notifications area handles zero notifications gracefully
- [ ] CRA reports section shows an empty state without errors
- [ ] Compliance timeline handles empty data without JavaScript errors
- [ ] Vulnerability scans section shows an empty state message
- [ ] SBOM section handles no-data state with a clear action path
- [ ] Organisation settings does not display "undefined" or "null" for empty fields
- [ ] Search/filter with no results shows a "No results found" message
- [ ] Browser console has no JavaScript errors on any empty-state page
- [ ] No loading spinners are stuck indefinitely on any page

## Result

**Status:** _pending_
**Notes:**

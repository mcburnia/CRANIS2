# Test: Break — Browser Back Button State Management

**Priority:** high
**Preconditions:** Application is running. Test user account exists with at least one product that has CRA reports. Browser history is clear or in a known state.
**Test User:** testadmin@manufacturer-active.test / TestPass123!
**URL:** https://dev.cranis2.dev/login

## Steps

### Step 1 — Login then back button
**Action:** Navigate to https://dev.cranis2.dev/login. Log in with testadmin@manufacturer-active.test / TestPass123!. Once the dashboard loads, click the browser back button.
**Expected:** The user is either: (a) redirected back to the dashboard (login page detects active session and redirects), or (b) shown the login page but with session intact — clicking any nav link returns to the authenticated app. The user should NOT see a broken or half-authenticated state.

### Step 2 — Dashboard to product to back
**Action:** From the dashboard, click on a product to view its detail page. Note the product name and details displayed. Click the browser back button.
**Expected:** The dashboard loads correctly with all data visible. No stale data, no loading spinners stuck, no blank page.

### Step 3 — Product detail to CRA report to back
**Action:** From a product detail page, navigate to the product's CRA reports section. Click into a specific CRA report to view its details. Click the browser back button.
**Expected:** The CRA reports list for that product loads correctly. The report that was just viewed is still listed. No data is missing or duplicated.

### Step 4 — Deep navigation then multiple back clicks
**Action:** Navigate: Dashboard -> Products list -> Product detail -> CRA Reports -> Specific report. Then click the browser back button four times in succession (one click per second).
**Expected:** Each back click returns to the previous page in the correct order: report list -> product detail -> products list -> dashboard. Each page renders correctly with its data. No blank pages or errors at any step.

### Step 5 — Create product then back button
**Action:** Navigate to product creation. Fill in all required fields (product name: "Back Button Test"). Click submit and wait for success confirmation. Then click the browser back button.
**Expected:** The user is taken to the previous page (either the creation form or the product list). If taken to the creation form, it should either be empty (reset) or show previously entered data. The product "Back Button Test" should NOT be created a second time. Navigating to the product list confirms only one "Back Button Test" exists.

### Step 6 — Submit CRA report then back button
**Action:** Navigate to an existing product's CRA reports. Create a new report with test data. Submit successfully. Click the browser back button.
**Expected:** The user is returned to the report creation form or the reports list. The form should not auto-resubmit. The report is not duplicated. No "confirm form resubmission" browser dialog appears (unless using POST-redirect-GET, in which case the dialog is acceptable).

### Step 7 — Edit organisation settings then back button
**Action:** Navigate to organisation settings. Change the organisation website to "https://backbuttontest.example.com". Click "Save" and wait for confirmation. Click the browser back button.
**Expected:** The user is navigated to the previous page. The settings change is preserved (not reverted). Navigating back to settings confirms the website is still "https://backbuttontest.example.com".

### Step 8 — Forward button after back
**Action:** Navigate: Dashboard -> Products -> Product detail. Click the browser back button to return to the Products list. Then click the browser forward button.
**Expected:** The product detail page loads correctly with all data. The forward navigation works identically to the original navigation.

### Step 9 — Back button on first authenticated page
**Action:** Clear browser history by opening a new tab. Navigate directly to https://dev.cranis2.dev/login. Log in. Once the dashboard loads (this is the first page in history), click the browser back button.
**Expected:** The browser either stays on the dashboard, navigates to the login page (which should redirect back since session is active), or shows a blank/new tab page. The application does not crash or show an error.

### Step 10 — Rapid back-forward-back clicks
**Action:** Navigate through 3-4 pages to build up history. Then rapidly alternate: back, forward, back, forward (4 clicks within 2 seconds).
**Expected:** The application settles on the correct page based on the final navigation action. No errors, no mixed content from different pages, no stale data rendering.

### Step 11 — Clean up
**Action:** Delete "Back Button Test" product if created. Restore organisation website to its original value.
**Expected:** Cleanup completes without errors.

## Pass Criteria

- [ ] Back button from dashboard after login does not break authentication state
- [ ] Back button from product detail returns to a fully rendered dashboard or product list
- [ ] Back button through deep navigation chain renders each page correctly
- [ ] Creating a resource then pressing back does not cause duplicate creation
- [ ] Submitting a form then pressing back does not trigger resubmission
- [ ] Settings changes persist after back button navigation
- [ ] Forward button works correctly after back button
- [ ] Rapid back/forward navigation does not cause rendering errors
- [ ] No blank pages or stuck loading spinners from back button navigation
- [ ] Browser console shows no errors related to state management during back/forward navigation

## Result

**Status:** passed
**Notes:** All steps verified. Defects found during testing have been resolved and re-verified.

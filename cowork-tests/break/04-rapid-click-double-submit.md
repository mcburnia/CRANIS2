# Test: Break — Rapid Click and Double Submit

**Priority:** high
**Preconditions:** Application is running. Test user account exists with at least one product. Note the current count of products, CRA reports, and feedback submissions before testing.
**Test User:** testadmin@manufacturer-active.test / TestPass123!
**URL:** https://dev.cranis2.dev/login

## Steps

### Step 1 — Log in and note baseline counts
**Action:** Log in with testadmin@manufacturer-active.test / TestPass123!. Navigate to the product list and note the total number of products. Navigate to any product's CRA reports and note the count. Note the current state for comparison after testing.
**Expected:** Dashboard and product list load. Baseline counts are recorded.

### Step 2 — Double-click product creation submit
**Action:** Navigate to product creation. Fill in all required fields with valid data (product name: "Double Click Test 1"). Rapidly double-click the submit/create button (click twice within 200ms).
**Expected:** Only ONE product is created. The submit button should either: (a) become disabled after the first click, (b) show a loading spinner preventing the second click, or (c) the backend deduplicates the request. Navigate to the product list and confirm only one "Double Click Test 1" exists.

### Step 3 — Triple-click product creation submit
**Action:** Navigate to product creation again. Fill in all required fields (product name: "Triple Click Test"). Rapidly click the submit button three times in quick succession.
**Expected:** Only ONE product named "Triple Click Test" is created. No duplicate entries appear in the product list.

### Step 4 — Double-click CRA report creation
**Action:** Navigate to an existing product's CRA reports section. Start creating a new report. Fill in all required fields. Rapidly double-click the submit button.
**Expected:** Only ONE report is created. The reports list shows a single new entry, not two duplicates.

### Step 5 — Double-click feedback submission
**Action:** Navigate to the feedback form. Enter "Double Submit Test" as the subject and "Testing rapid click protection" as the body. Rapidly double-click the submit button.
**Expected:** Only ONE feedback entry is submitted. If there is a success message, it appears once (not twice).

### Step 6 — Rapid clicks on delete confirmation
**Action:** Navigate to the product list. Click the delete button on "Double Click Test 1" (created in Step 2). When the confirmation dialog appears, rapidly double-click the confirm/delete button.
**Expected:** The product is deleted once. No errors appear. The application does not attempt to delete an already-deleted resource (no 404 or "not found" errors flash on screen).

### Step 7 — Rapid navigation clicks on sidebar
**Action:** Rapidly click between different sidebar navigation items (Dashboard, Products, Settings, etc.) — click at least 5 different items within 2 seconds.
**Expected:** The application navigates to the last clicked item without errors. No race conditions cause mixed or corrupted page content. No console errors related to unmounted component state updates.

### Step 8 — Rapid click on login button
**Action:** Log out. On the login page, enter valid credentials. Rapidly double-click the "Log in" button.
**Expected:** The user is logged in once. The dashboard loads normally. No error messages about duplicate sessions or invalid tokens appear.

### Step 9 — Rapid click on save in organisation settings
**Action:** Navigate to organisation settings. Make a small change (e.g., update the website URL). Rapidly double-click the "Save" button.
**Expected:** The settings are saved once. The success notification appears once (not multiple times). The saved data is correct.

### Step 10 — Verify button states during submission
**Action:** Navigate to product creation. Fill in valid data. Before clicking submit, open browser DevTools (Network tab). Click submit once and immediately observe the submit button.
**Expected:** The submit button shows a loading/disabled state during the API request. The button is not clickable while the request is in flight. The Network tab shows only one POST request.

### Step 11 — Clean up
**Action:** Delete any remaining test products ("Triple Click Test" and any duplicates). Verify the product count matches the baseline from Step 1 (adjusted for intentional additions/deletions).
**Expected:** Cleanup completes. Final counts are consistent.

## Pass Criteria

- [ ] Double-clicking product creation submit creates exactly one product
- [ ] Triple-clicking product creation submit creates exactly one product
- [ ] Double-clicking CRA report creation creates exactly one report
- [ ] Double-clicking feedback submission sends exactly one feedback
- [ ] Double-clicking delete confirmation does not produce errors from deleting twice
- [ ] Rapid sidebar navigation does not cause rendering errors or mixed content
- [ ] Double-clicking login does not cause session issues
- [ ] Double-clicking save in settings saves once and shows one success message
- [ ] Submit buttons show a disabled or loading state during API requests
- [ ] No duplicate entries exist in any list after testing

## Result

**Status:** _pending_
**Notes:**

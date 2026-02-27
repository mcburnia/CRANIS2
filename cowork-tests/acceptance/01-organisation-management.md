# Test: Organisation Management — View and Update Org Details

**Priority:** critical
**Preconditions:** User is registered and belongs to an organisation with admin role. Organisation has at least one other member.
**Test User:** testadmin@manufacturer-active.test / TestPass123!
**URL:** https://dev.cranis2.dev/login

## Steps

### Step 1 — Login
**Action:** Enter email `testadmin@manufacturer-active.test` and password `TestPass123!`. Click "Sign In".
**Expected:** User is redirected to the dashboard. Sidebar is visible with navigation items.

### Step 2 — Navigate to Organisation Settings
**Action:** In the sidebar, expand the "Admin" or "Organisation" section. Click "Organisation" or "Settings".
**Expected:** The organisation details page loads showing the current org name, website, and contact information.

### Step 3 — Verify Current Org Details Display
**Action:** Observe the organisation details page.
**Expected:** The page displays:
- Organisation name
- Website URL (if set)
- Contact email or contact info
- All fields are populated with the current values from the database.

### Step 4 — Update Organisation Name
**Action:** Click the edit button or field for the organisation name. Change the name to "Manufacturer Active Updated". Click "Save" or confirm.
**Expected:** A success message appears. The organisation name now displays "Manufacturer Active Updated".

### Step 5 — Update Website
**Action:** Edit the website field. Enter `https://updated-manufacturer.example.com`. Save the change.
**Expected:** A success message appears. The website field shows the new URL.

### Step 6 — Update Contact Information
**Action:** Edit the contact information field. Enter `updated-contact@manufacturer-active.test`. Save the change.
**Expected:** A success message appears. The contact field shows the updated email.

### Step 7 — Verify Changes Persist After Reload
**Action:** Refresh the browser page (F5 or Ctrl+R).
**Expected:** All three updated fields persist:
- Name: "Manufacturer Active Updated"
- Website: `https://updated-manufacturer.example.com`
- Contact: `updated-contact@manufacturer-active.test`

### Step 8 — View Organisation Members List
**Action:** Navigate to the members section of the organisation page (tab or separate link).
**Expected:** A list of organisation members is displayed showing:
- Member email addresses
- Member roles (admin, member, etc.)
- The current user (testadmin) appears in the list with an admin role
- testmember1@manufacturer-active.test appears as a member

### Step 9 — Revert Organisation Details
**Action:** Change the organisation name, website, and contact back to their original values. Save each change.
**Expected:** All fields revert to their original values. Success messages confirm each save.

## Pass Criteria
- [ ] Organisation details page loads and displays current org info
- [ ] Organisation name can be updated and the change is confirmed
- [ ] Website field can be updated and the change is confirmed
- [ ] Contact info can be updated and the change is confirmed
- [ ] All changes persist after a full page reload
- [ ] Members list displays all org members with correct roles
- [ ] Original values are restored after the test

## Result
**Status:** _pending_
**Notes:**

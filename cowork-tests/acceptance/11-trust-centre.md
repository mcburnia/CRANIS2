<!--
  Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi@mcburnie.com
-->

# Test: Trust Centre — View Profile, Update Profile Fields

**Priority:** medium
**Preconditions:** User is logged in as org admin. The organisation has a Trust Centre profile (or the ability to create one). At least one product exists in the organisation.
**Test User:** testadmin@manufacturer-active.test / TestPass123!
**URL:** https://dev.cranis2.dev/login

## Steps

### Step 1 — Login
**Action:** Enter email `testadmin@manufacturer-active.test` and password `TestPass123!`. Click "Sign In".
**Expected:** User is redirected to the dashboard.

### Step 2 — Navigate to Trust Centre
**Action:** In the sidebar, expand the "Trust Centre" section or click the "Trust Centre" navigation item.
**Expected:** The Trust Centre page loads. This may show a public Trust Centre listing or a profile management view.

### Step 3 — View Trust Centre Profile
**Action:** Navigate to the Trust Centre profile section (e.g. "My Profile", "Organisation Profile", or similar).
**Expected:** The Trust Centre profile page loads showing:
- Organisation/company name
- Profile description or bio
- Contact information
- Listed products (if any are published to the Trust Centre)
- Profile completeness indicator or status

### Step 4 — Review Current Profile Fields
**Action:** Note the current values of all editable profile fields.
**Expected:** The following fields are visible (some may be empty):
- Company/organisation name
- Description or about text
- Website URL
- Contact email
- Industry or category
- Any product listings or showcase items

### Step 5 — Update Profile Description
**Action:** Click "Edit Profile" or the edit button. Update the description/bio field to: "CRANIS2 acceptance test — Trust Centre profile updated". Save the changes.
**Expected:** A success message appears. The description field now shows the updated text.

### Step 6 — Update Additional Profile Fields
**Action:** Update another editable field (e.g. website URL to `https://test-Trust Centre.example.com` or contact email). Save the changes.
**Expected:** A success message appears. The updated field displays the new value.

### Step 7 — Verify Changes Persist
**Action:** Navigate away from the Trust Centre profile (e.g. to the dashboard) and then return to the profile page.
**Expected:** All updated fields retain their new values:
- Description shows "CRANIS2 acceptance test — Trust Centre profile updated"
- Any other updated fields show their new values

### Step 8 — Revert Profile Changes
**Action:** Edit the profile fields back to their original values (noted in Step 4). Save the changes.
**Expected:** The profile is restored to its original state. Success messages confirm each save.

## Pass Criteria
- [ ] Trust Centre section is accessible from the sidebar
- [ ] Trust Centre profile page loads with current organisation details
- [ ] Profile fields are displayed and editable
- [ ] Profile description can be updated and saved
- [ ] Additional profile fields can be updated and saved
- [ ] Changes persist after navigating away and returning
- [ ] Profile can be reverted to original values

## Result
**Status:** _pending_
**Notes:**

# Test: Escrow Management — View Config, Enable, Deposit History, Manual Deposit

**Priority:** high
**Preconditions:** User is logged in as org admin. At least one product exists with a connected repository. Forgejo escrow service is running and accessible at escrow.cranis2.dev. The product has not yet been enabled for escrow (or can be toggled).
**Test User:** testadmin@manufacturer-active.test / TestPass123!
**URL:** https://dev.cranis2.dev/login

## Steps

### Step 1 — Login
**Action:** Enter email `testadmin@manufacturer-active.test` and password `TestPass123!`. Click "Sign In".
**Expected:** User is redirected to the dashboard.

### Step 2 — Navigate to a Product
**Action:** Click "Products" in the sidebar. Select a product with a connected repository.
**Expected:** The product detail page loads.

### Step 3 — View Escrow Configuration
**Action:** Navigate to the "Escrow" tab or section of the product.
**Expected:** The escrow configuration section is displayed showing:
- Current escrow status (enabled/disabled)
- Escrow repository information (if enabled)
- Artifact type toggles (up to 7 types)
- Deposit schedule information

### Step 4 — Enable Escrow for the Product
**Action:** If escrow is not yet enabled, toggle the escrow enable switch or click "Enable Escrow". Confirm if prompted.
**Expected:** A success message appears. The escrow status changes to "enabled". A Forgejo escrow repository is created (or referenced) at escrow.cranis2.dev. The artifact type toggles become active.

### Step 5 — Configure Artifact Types
**Action:** Review the artifact type toggles. Enable or disable specific artifact types (e.g. source code, SBOM, vulnerability reports, license info, technical docs, build artifacts, compliance docs).
**Expected:** Each toggle can be switched on/off. Changes are saved (either automatically or via a save button). The selected artifact types are confirmed.

### Step 6 — View Deposit History
**Action:** Scroll to or navigate to the "Deposit History" section of the escrow page.
**Expected:** The deposit history table/list is displayed showing:
- Date/timestamp of each deposit
- Deposit type (automated daily or manual)
- Artifacts included in the deposit
- Deposit status (success/failed)

If no deposits have been made yet, an empty state message is shown.

### Step 7 — Trigger Manual Deposit
**Action:** Click the "Manual Deposit" or "Deposit Now" button.
**Expected:** A loading indicator appears while the deposit is processed. After completion:
- A success message appears confirming the deposit
- The deposit history updates with a new entry
- The new entry shows type "manual" with the current timestamp
- The included artifacts match the enabled artifact type toggles

### Step 8 — Verify Deposit in History
**Action:** Refresh the page and check the deposit history.
**Expected:** The manual deposit from Step 7 appears in the history with:
- Correct timestamp
- "Manual" deposit type
- Success status
- Artifact details

## Pass Criteria
- [ ] Escrow configuration section loads for the product
- [ ] Escrow can be enabled for a product with a connected repo
- [ ] Artifact type toggles are functional (7 types available)
- [ ] Deposit history section displays correctly (or shows empty state)
- [ ] Manual deposit triggers successfully
- [ ] Manual deposit appears in the deposit history with correct details
- [ ] Deposit history persists after page reload

## Result
**Status:** _pending_
**Notes:**

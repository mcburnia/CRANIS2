# Test: Billing and Subscription — View Status, Trial Info, Page Elements

**Priority:** high
**Preconditions:** User is logged in as org admin. The organisation has an active billing status (trial, active, or other). Stripe integration is configured on the backend.
**Test User:** testadmin@manufacturer-active.test / TestPass123!
**URL:** https://dev.cranis2.dev/login

## Steps

### Step 1 — Login
**Action:** Enter email `testadmin@manufacturer-active.test` and password `TestPass123!`. Click "Sign In".
**Expected:** User is redirected to the dashboard.

### Step 2 — Navigate to Billing Page
**Action:** In the sidebar, click "Billing" or navigate to the billing/subscription section.
**Expected:** The billing page loads showing the current subscription status for the organisation.

### Step 3 — View Billing Status
**Action:** Observe the billing status section.
**Expected:** The page displays:
- Current plan/subscription status (e.g. "Trial", "Active", "Read-Only", "Suspended", "Cancelled")
- A clear status indicator with appropriate colour coding
- The organisation name associated with the billing

### Step 4 — Check Trial Information
**Action:** If the organisation is on a trial, review the trial details section.
**Expected:** Trial information is displayed including:
- Trial start date
- Trial end date or days remaining
- What happens when the trial expires
- Call-to-action to upgrade (if on trial)

If the organisation is on a paid plan, subscription details should show instead (plan name, billing period, next payment date).

### Step 5 — Verify Billing Page Elements
**Action:** Scroll through the entire billing page and note all visible elements.
**Expected:** The billing page contains:
- Subscription status card/section
- Plan details or trial countdown
- Payment method section (or prompt to add one)
- Billing history or invoice list (if applicable)
- Upgrade/downgrade options or manage subscription button
- No broken layouts, missing text, or error states

### Step 6 — Check Billing Gate Behaviour (Read-Only Test)
**Action:** Note whether the current billing status allows write operations. If the org is in a restricted state (read_only, suspended, cancelled), attempt to create a product or make a change.
**Expected:**
- If billing is active/trial: Write operations succeed normally
- If billing is read_only/suspended/cancelled: Write operations are blocked with an appropriate error message indicating billing restrictions

### Step 7 — Verify No Sensitive Data Exposed
**Action:** Inspect the billing page for any exposed sensitive information.
**Expected:**
- No full credit card numbers are displayed (only last 4 digits if shown)
- No Stripe API keys or webhook secrets are visible
- No internal billing IDs are exposed in the UI

## Pass Criteria
- [ ] Billing page loads without errors
- [ ] Current subscription status is clearly displayed
- [ ] Trial information shows dates and/or remaining days (if applicable)
- [ ] All billing page sections render correctly without broken layouts
- [ ] Billing gate correctly restricts or allows operations based on status
- [ ] No sensitive payment data is exposed in the UI
- [ ] Page is accessible to org admin users

## Result
**Status:** passed
**Notes:** All steps verified. Defects found during testing have been resolved and re-verified.

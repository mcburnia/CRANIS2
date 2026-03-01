# Test: Authentication — Login and Dashboard Load

**Priority:** critical  
**Preconditions:** CRANIS2 is deployed and accessible; test user account exists with at least one product  
**Test User:** testadmin@manufacturer-active.test / TestPass123!  
**URL:** https://dev.cranis2.dev/login

## Steps

### Step 1: Navigate to Login Page
- **Action:** Open https://dev.cranis2.dev/login in the browser
- **Expected:** Login form renders with email and password fields, a "Sign In" button, and CRANIS2 branding. No console errors.

### Step 2: Enter Credentials and Submit
- **Action:** Type `testadmin@manufacturer-active.test` into the email field, type `TestPass123!` into the password field, then click "Sign In"
- **Expected:** A loading indicator appears briefly. The browser redirects to the dashboard at `/dashboard` (or `/`). No error toast or "invalid credentials" message appears.

### Step 3: Verify Dashboard Stat Cards
- **Action:** Inspect the stat cards displayed at the top of the dashboard
- **Expected:** At least one row of stat cards is visible using the `stats` CSS class grid. Each StatCard shows a label, a numeric value, and a colored indicator (green, amber, blue, or red). Values are not "NaN", "undefined", or blank.

### Step 4: Verify Sidebar Navigation Items
- **Action:** Inspect the left sidebar navigation
- **Expected:** The sidebar is visible and contains accordion sections. At minimum the following items are present: Products, CRA Reports, Due Diligence, Vulnerabilities, License Scan, IP Proof, Technical Files, Escrow, Billing, Marketplace, Notifications, Settings. Clicking a section chevron expands it, and only one section is expanded at a time.

### Step 5: Verify Product List on Dashboard
- **Action:** Look for a product list or recent products section on the dashboard
- **Expected:** At least one product is listed with its name visible. Product entries are clickable links. No "No products found" empty state (given preconditions).

### Step 6: Check Console for Errors
- **Action:** Open browser DevTools (F12) and check the Console tab
- **Expected:** No JavaScript errors (red entries). Network requests to `/api/` endpoints returned 2xx status codes. No CORS errors.

## Pass Criteria
- [ ] Login form renders correctly on /login
- [ ] Credentials accepted, redirect to dashboard
- [ ] Stat cards display with valid labels and values
- [ ] Sidebar accordion navigation is present with all expected items
- [ ] Product list is populated with at least one product
- [ ] No console errors
- [ ] Page renders correctly
- [ ] Response times under 3 seconds

## Result
**Status:** passed
**Notes:** All steps verified. Defects found during testing have been resolved and re-verified.

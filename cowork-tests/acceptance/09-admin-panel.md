# Test: Admin Panel — Dashboard, Orgs, Users, System Status

**Priority:** critical
**Preconditions:** The platform admin user exists and has platform admin privileges. There are multiple organisations and users in the system for listing.
**Test User:** testplatformadmin@cranis2.test / TestPass123!
**URL:** https://dev.cranis2.dev/login

## Steps

### Step 1 — Login as Platform Admin
**Action:** Enter email `testplatformadmin@cranis2.test` and password `TestPass123!`. Click "Sign In".
**Expected:** User is redirected to the dashboard. The sidebar displays admin-specific navigation items that are not visible to regular users (e.g. "Admin" section with sub-items).

### Step 2 — Navigate to Admin Dashboard
**Action:** In the sidebar, expand the "Admin" section. Click "Dashboard" or the main admin overview link.
**Expected:** The admin dashboard loads showing platform-wide statistics:
- Total number of organisations
- Total number of users
- Total number of products
- System health indicators
- StatCards with relevant metrics and colours

### Step 3 — View Admin Dashboard Stats
**Action:** Review all StatCards and summary information on the admin dashboard.
**Expected:** Each StatCard displays:
- A label (e.g. "Total Orgs", "Total Users", "Active Scans")
- A numeric value
- A colour indicator (green, amber, blue, red)
- Optional sub-text with additional context
All values are non-negative and plausible.

### Step 4 — List All Organisations
**Action:** Navigate to the "Organisations" admin page (via sidebar or dashboard link).
**Expected:** A table or list of all organisations in the system is displayed showing:
- Organisation name
- Billing status
- Number of members or products
- Creation date or last activity
The list includes the test organisation "manufacturer-active" (or similar).

### Step 5 — Search/Filter Organisations
**Action:** Use the search or filter input on the organisations list. Type "manufacturer".
**Expected:** The list filters to show only organisations matching "manufacturer". The test organisation appears in the results.

### Step 6 — List All Users
**Action:** Navigate to the "Users" admin page.
**Expected:** A table or list of all users in the system is displayed showing:
- User email
- Organisation membership
- Role (admin, member, platform_admin)
- Last login or account status
The list includes the test users (testadmin, testmember1, testplatformadmin).

### Step 7 — Search/Filter Users
**Action:** Use the search or filter input on the users list. Type "testadmin".
**Expected:** The list filters to show users matching "testadmin". The testadmin@manufacturer-active.test user appears.

### Step 8 — View System Status
**Action:** Navigate to the "System Status" or "Health" admin page (if available).
**Expected:** The system status page displays:
- Service health (backend, database, Neo4j, Forgejo)
- Scheduler status and last run times
- Recent scan activity
- Any error or warning indicators

### Step 9 — Verify Admin-Only Access
**Action:** Note the URL of the admin dashboard. Log out. Log in as `testmember1@manufacturer-active.test` / `TestPass123!`. Attempt to navigate to the admin dashboard URL directly.
**Expected:** The regular member user is either:
- Redirected away from the admin page, or
- Shown an "Access Denied" / "Unauthorised" message
The admin navigation items are not visible in the sidebar for this user.

## Pass Criteria
- [ ] Platform admin can log in and see admin navigation items
- [ ] Admin dashboard loads with platform-wide statistics
- [ ] StatCards display valid labels, values, and colours
- [ ] Organisation list displays all orgs with relevant details
- [ ] Organisation search/filter works correctly
- [ ] User list displays all users with relevant details
- [ ] User search/filter works correctly
- [ ] System status page shows service health (if available)
- [ ] Non-admin users cannot access admin pages

## Result
**Status:** _pending_
**Notes:**

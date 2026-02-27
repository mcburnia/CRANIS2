# Test: Break — Session Expiry Behaviour

**Priority:** critical
**Preconditions:** Application is running. Test user account exists. Browser DevTools are accessible for manipulating cookies/localStorage.
**Test User:** testadmin@manufacturer-active.test / TestPass123!
**URL:** https://dev.cranis2.dev/login

## Steps

### Step 1 — Log in and confirm active session
**Action:** Navigate to https://dev.cranis2.dev/login. Log in with testadmin@manufacturer-active.test / TestPass123!. Navigate to the dashboard. Open browser DevTools > Application tab and locate the session token (check cookies and localStorage).
**Expected:** Dashboard loads successfully. A session token (JWT) is visible in either cookies or localStorage.

### Step 2 — Note the token location and value
**Action:** In DevTools > Application, identify exactly where the token is stored (cookie name or localStorage key). Copy the token value for reference.
**Expected:** Token location and value are identified and noted.

### Step 3 — Clear session token manually
**Action:** In DevTools > Application, delete the session token (remove the cookie or clear the localStorage entry). Do NOT refresh the page yet.
**Expected:** The token is removed from storage. The page still shows the dashboard (since the page is already rendered).

### Step 4 — Attempt navigation after token removal
**Action:** With the token removed, click on a sidebar navigation item (e.g., Products).
**Expected:** The application detects the missing/invalid session and either: (a) redirects to the login page with a clear message (e.g., "Session expired, please log in again"), or (b) shows an authentication error and provides a link to log in. The application does NOT crash or show a blank page.

### Step 5 — Attempt API action after token removal
**Action:** If still on an authenticated page, try performing an action that triggers an API call (e.g., clicking a button, submitting a form). If already redirected to login, skip this step.
**Expected:** The API call fails with a 401 response. The frontend handles this gracefully by redirecting to login or showing an appropriate error message. No sensitive data is exposed.

### Step 6 — Refresh page after token removal
**Action:** Press F5 or Ctrl+R to refresh the current page (with the token still removed).
**Expected:** The application redirects to the login page. No authenticated content flashes briefly before the redirect.

### Step 7 — Log in again after session clear
**Action:** On the login page, log in again with testadmin@manufacturer-active.test / TestPass123!.
**Expected:** Login succeeds. The dashboard loads normally. A new session token is created and visible in DevTools.

### Step 8 — Corrupt the session token
**Action:** In DevTools > Application, locate the new session token. Edit the token value by changing several characters in the middle (corrupting the JWT signature). Do not delete it entirely — just modify it.
**Expected:** The corrupted token is saved in storage.

### Step 9 — Navigate with corrupted token
**Action:** Click on a sidebar navigation item (e.g., Products or Settings).
**Expected:** The application detects the invalid token and either: (a) redirects to the login page, or (b) shows an authentication error. The response should be identical to the missing token scenario — no partial data loads or error stack traces visible to the user.

### Step 10 — Attempt direct URL access without session
**Action:** Log out (or clear the token). In the browser address bar, directly navigate to https://dev.cranis2.dev/products.
**Expected:** The application redirects to the login page. The products page content is not displayed, even briefly.

### Step 11 — Attempt direct URL access to settings
**Action:** Without logging in, navigate directly to https://dev.cranis2.dev/settings.
**Expected:** The application redirects to the login page. No settings data is visible.

### Step 12 — Attempt direct URL access to API endpoint
**Action:** In the browser address bar, navigate directly to https://dev.cranis2.dev/api/products (or any authenticated API endpoint).
**Expected:** The API returns a 401 Unauthorized JSON response (e.g., `{"error": "Unauthorized"}`). No product data is returned.

### Step 13 — Verify login redirect preserves intended destination
**Action:** Without logging in, navigate directly to https://dev.cranis2.dev/products. After being redirected to login, log in with valid credentials.
**Expected:** After successful login, the user is either: (a) redirected to /products (the originally intended page), or (b) redirected to the dashboard. Either behaviour is acceptable, but redirecting to the intended page is preferred.

## Pass Criteria

- [ ] Removing the session token and navigating redirects to login
- [ ] Removing the session token and attempting API actions returns 401, handled gracefully
- [ ] Refreshing the page without a token redirects to login with no content flash
- [ ] Corrupting the session token is handled identically to a missing token
- [ ] Direct URL access to authenticated routes without a session redirects to login
- [ ] Direct API access without a session returns 401 with no data leakage
- [ ] Re-login after session expiry works normally with a fresh token
- [ ] No stack traces, raw error objects, or sensitive information shown to the user
- [ ] No authenticated content is visible at any point without a valid session

## Result

**Status:** _pending_
**Notes:**

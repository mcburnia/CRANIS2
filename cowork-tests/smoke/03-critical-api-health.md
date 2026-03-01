# Test: API Health — Critical Endpoints Respond

**Priority:** critical  
**Preconditions:** User is logged in; session token is valid; at least one product exists  
**Test User:** testadmin@manufacturer-active.test / TestPass123!  
**URL:** https://dev.cranis2.dev/dashboard

## Steps

### Step 1: Verify Dashboard Summary API
- **Action:** Open DevTools Network tab, then navigate to the dashboard. Filter network requests for `/api/` calls.
- **Expected:** A request to the dashboard summary endpoint (e.g., `/api/dashboard/summary` or `/api/compliance-summary`) returns HTTP 200. The response body contains JSON with stat values (not empty or error objects). Response time is under 3 seconds.

### Step 2: Verify Product List API
- **Action:** Navigate to the Products page. Observe the network request that fetches the product list.
- **Expected:** A request to `/api/products` (or similar) returns HTTP 200. The response body is a JSON array containing at least one product object. Each product object has at minimum an `id` and a `name` field. Response time is under 3 seconds.

### Step 3: Verify CRA Reports List API
- **Action:** Navigate to the CRA Reports page. Observe the network request that fetches reports.
- **Expected:** A request to the CRA reports endpoint returns HTTP 200. The response body is valid JSON (either an array of reports or an object with a reports array). Response time is under 3 seconds.

### Step 4: Verify Notifications API
- **Action:** Navigate to the Notifications page. Observe the network request that fetches notifications.
- **Expected:** A request to `/api/notifications` (or similar) returns HTTP 200. The response body is valid JSON (either an array or an object with a notifications array). Severity values, if present, are one of: 'critical', 'high', 'medium', 'low', 'info'. Response time is under 3 seconds.

### Step 5: Verify Billing Status API
- **Action:** Navigate to the Billing page. Observe the network request that fetches billing status.
- **Expected:** A request to `/api/billing/status` (or similar) returns HTTP 200. The response body contains JSON with plan and status information. The billing status is not "error" or "unknown". Response time is under 3 seconds.

### Step 6: Verify Authentication Token is Valid
- **Action:** Check the Authorization header on any of the above API requests
- **Expected:** Requests include a valid Bearer token or session cookie. No 401 Unauthorized responses were returned. No redirect to /login occurred unexpectedly.

### Step 7: Check for API Error Patterns
- **Action:** Review all network requests made during Steps 1-5 in the DevTools Network tab
- **Expected:** No API requests returned 5xx status codes. No API requests returned HTML error pages instead of JSON. No CORS-related failures appear in the console. All responses have `Content-Type: application/json`.

## Pass Criteria
- [ ] Dashboard summary endpoint returns 200 with valid data
- [ ] Product list endpoint returns 200 with at least one product
- [ ] CRA reports endpoint returns 200 with valid JSON
- [ ] Notifications endpoint returns 200 with valid JSON
- [ ] Billing status endpoint returns 200 with plan information
- [ ] All API responses are valid JSON
- [ ] No 401, 403, or 5xx errors
- [ ] No console errors
- [ ] All response times under 3 seconds

## Result
**Status:** passed
**Notes:** All steps verified. Defects found during testing have been resolved and re-verified.

# Test: Break — XSS Injection on All Text Inputs

**Priority:** critical
**Preconditions:** Application is running. Test user account exists with at least one product.
**Test User:** testadmin@manufacturer-active.test / TestPass123!
**URL:** https://dev.cranis2.dev/login

## Steps

### Step 1 — Login with XSS in email field
**Action:** Navigate to https://dev.cranis2.dev/login. Enter `<script>alert('xss')</script>` in the email field. Enter "TestPass123!" in the password field. Click "Log in".
**Expected:** The script tag is not executed. The login fails gracefully with an invalid credentials message. No alert dialog appears.

### Step 2 — Log in as test user
**Action:** Log in with testadmin@manufacturer-active.test / TestPass123!. Confirm you reach the dashboard.
**Expected:** Dashboard loads successfully.

### Step 3 — XSS script tag in product name
**Action:** Navigate to product creation. Enter `<script>alert('xss')</script>` as the product name. Fill in any other required fields with valid data. Submit the form.
**Expected:** If the product is created, the name is displayed as escaped text (the literal string `<script>alert('xss')</script>` is visible, not executed). No alert dialog appears. If validation rejects it, that is also acceptable.

### Step 4 — XSS img onerror in product name
**Action:** Create another product (or edit the previous one) with the name: `<img src=x onerror=alert('xss')>`. Submit the form.
**Expected:** The payload is escaped and displayed as literal text. No JavaScript executes. No alert dialog appears.

### Step 5 — XSS event handler in product name
**Action:** Create or edit a product with the name: `" onmouseover="alert('xss')" data-x="`. Submit the form.
**Expected:** The payload is stored as literal text. Hovering over the product name does not trigger any JavaScript execution.

### Step 6 — XSS in organisation name
**Action:** Navigate to organisation settings. Change the organisation name to `<script>document.cookie</script>`. Click "Save".
**Expected:** If the save succeeds, the name is displayed as escaped text. No script execution occurs. If validation rejects the input, that is also acceptable.

### Step 7 — XSS SVG payload in organisation name
**Action:** Change the organisation name to `<svg onload=alert('xss')>`. Click "Save".
**Expected:** The SVG tag is escaped or rejected. No JavaScript executes.

### Step 8 — XSS in feedback subject
**Action:** Navigate to the feedback form. Enter `<script>alert('xss')</script>` in the subject field. Enter "Test body content" in the body. Submit.
**Expected:** The script tag is escaped and not executed. The feedback is submitted with the literal text as the subject, or validation rejects the input.

### Step 9 — XSS in feedback body
**Action:** Navigate to the feedback form. Enter "Normal subject" in the subject. Enter `<img src=x onerror=alert(document.domain)>` in the body. Submit.
**Expected:** The payload is escaped and displayed as literal text. No JavaScript executes.

### Step 10 — XSS in CRA report content
**Action:** Navigate to an existing product's CRA reports section. Create a new report. In any free-text field, enter: `<iframe src="javascript:alert('xss')"></iframe>`. Submit.
**Expected:** The iframe tag is escaped or stripped. No JavaScript executes. The content is displayed safely.

### Step 11 — Verify stored XSS does not execute on page reload
**Action:** Navigate away from the pages where XSS payloads were entered. Then navigate back to each page (product list, organisation settings, feedback history if visible). Inspect the rendered HTML.
**Expected:** All previously entered XSS payloads are rendered as escaped text in the DOM. No `<script>`, `<img onerror>`, `<svg onload>`, or `<iframe>` tags are present as live HTML elements.

### Step 12 — Clean up test data
**Action:** Delete any test products created with XSS payloads. Restore the organisation name to its original value.
**Expected:** Cleanup completes without errors.

## Pass Criteria

- [ ] `<script>alert('xss')</script>` never executes in any field
- [ ] `<img src=x onerror=alert('xss')>` never executes in any field
- [ ] `<svg onload=alert('xss')>` never executes in any field
- [ ] `<iframe src="javascript:alert('xss')">` never executes in any field
- [ ] Event handler injection (`onmouseover`, etc.) never executes
- [ ] All payloads are either rejected by validation or stored and displayed as escaped literal text
- [ ] No alert dialogs appear at any point during testing
- [ ] Page source inspection confirms payloads are HTML-entity-encoded or stripped

## Result

**Status:** passed
**Notes:** All steps verified. Defects found during testing have been resolved and re-verified.

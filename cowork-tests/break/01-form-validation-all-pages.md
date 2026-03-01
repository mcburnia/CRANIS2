# Test: Break — Form Validation on All Pages

**Priority:** critical
**Preconditions:** Application is running and accessible. Test user account exists and is active.
**Test User:** testadmin@manufacturer-active.test / TestPass123!
**URL:** https://dev.cranis2.dev

## Steps

### Step 1 — Login form with empty fields
**Action:** Navigate to https://dev.cranis2.dev/login. Leave both email and password fields empty. Click the "Log in" button.
**Expected:** Form does not submit. Validation messages appear on both email and password fields indicating they are required.

### Step 2 — Login form with email only
**Action:** Enter "testadmin@manufacturer-active.test" in the email field. Leave password empty. Click "Log in".
**Expected:** Form does not submit. A validation message appears on the password field indicating it is required.

### Step 3 — Login form with invalid email format
**Action:** Clear the email field. Enter "not-an-email" in the email field. Enter "TestPass123!" in the password field. Click "Log in".
**Expected:** Form does not submit or the server returns an error. A validation message indicates the email format is invalid.

### Step 4 — Registration form with empty fields
**Action:** Navigate to https://dev.cranis2.dev/register. Leave all fields empty. Click the registration submit button.
**Expected:** Form does not submit. Validation messages appear on all required fields (email, password, organisation name, etc.).

### Step 5 — Registration form with mismatched passwords
**Action:** On the registration form, fill in all fields with valid data but enter "Password1!" in the password field and "DifferentPass2!" in the confirm password field. Click submit.
**Expected:** Form does not submit. A validation message indicates the passwords do not match.

### Step 6 — Product creation with empty fields
**Action:** Log in as testadmin@manufacturer-active.test / TestPass123!. Navigate to the product creation page. Leave all fields empty. Click the "Create" or "Save" button.
**Expected:** Form does not submit. Validation messages appear on required fields (product name at minimum).

### Step 7 — Product creation with name only
**Action:** On the product creation form, enter only a product name ("Test Product"). Leave all other required fields empty. Click submit.
**Expected:** Either the form submits successfully (if only name is required) or validation messages appear on any other required fields.

### Step 8 — CRA report creation with empty fields
**Action:** Navigate to an existing product's CRA reports section. Start creating a new CRA report. Leave all fields empty. Click submit.
**Expected:** Form does not submit. Validation messages appear on all required fields.

### Step 9 — Organisation settings with cleared required fields
**Action:** Navigate to organisation settings. Clear the organisation name field (and any other required fields). Click "Save".
**Expected:** Form does not submit. A validation message appears indicating the organisation name is required.

### Step 10 — Feedback form with empty fields
**Action:** Navigate to the feedback form. Leave all fields empty. Click the submit button.
**Expected:** Form does not submit. Validation messages appear on required fields (subject, body, or similar).

### Step 11 — Feedback form with subject only
**Action:** On the feedback form, enter only a subject ("Test Feedback"). Leave the body/message field empty. Click submit.
**Expected:** Either the form submits (if body is optional) or a validation message appears on the body field.

## Pass Criteria

- [ ] Login form shows validation for empty email
- [ ] Login form shows validation for empty password
- [ ] Login form rejects invalid email format
- [ ] Registration form shows validation on all required empty fields
- [ ] Registration form catches mismatched passwords
- [ ] Product creation form shows validation on required empty fields
- [ ] CRA report creation shows validation on required empty fields
- [ ] Organisation settings rejects empty organisation name
- [ ] Feedback form shows validation on required empty fields
- [ ] No form submits successfully with missing required data
- [ ] All validation messages are user-friendly and descriptive

## Result

**Status:** passed
**Notes:** All steps verified. Defects found during testing have been resolved and re-verified.

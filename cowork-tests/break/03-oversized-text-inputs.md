# Test: Break — Oversized Text Inputs

**Priority:** high
**Preconditions:** Application is running. Test user account exists with at least one product.
**Test User:** testadmin@manufacturer-active.test / TestPass123!
**URL:** https://dev.cranis2.dev/login

## Steps

### Step 1 — Log in
**Action:** Navigate to https://dev.cranis2.dev/login. Log in with testadmin@manufacturer-active.test / TestPass123!.
**Expected:** Dashboard loads successfully.

### Step 2 — 1000-character product name
**Action:** Navigate to product creation. In the product name field, paste a string of 1000 "A" characters (AAAA...1000 times). Fill in other required fields with valid data. Click submit.
**Expected:** Either: (a) the input is truncated or rejected with a max-length validation message, or (b) the product is created and the long name is handled without crashing. The UI does not break or overflow in a way that hides other content.

### Step 3 — Verify long product name display
**Action:** If the product was created in Step 2, navigate to the product list page.
**Expected:** The long product name is truncated with ellipsis or wraps cleanly. The page layout is not broken. Other products in the list remain visible and accessible.

### Step 4 — 5000-character product name
**Action:** Create another product with a 5000-character name (repeat "Test " 1000 times). Submit.
**Expected:** The form either rejects the input with a validation message or the backend returns a meaningful error. The application does not crash or display a generic server error.

### Step 5 — 1000-character organisation name
**Action:** Navigate to organisation settings. Replace the organisation name with a string of 1000 characters. Click "Save".
**Expected:** Either: (a) validation rejects the input with a max-length message, or (b) the name is saved and displayed without breaking the sidebar, header, or any other UI element that shows the org name.

### Step 6 — 1000-character organisation website URL
**Action:** In organisation settings, enter a URL of 1000+ characters in the website field (e.g., "https://example.com/" followed by 980 random characters). Click "Save".
**Expected:** The input is either rejected by URL validation or truncated. If saved, the website link does not break page layout.

### Step 7 — 10000-character feedback body
**Action:** Navigate to the feedback form. Enter "Overflow Test" as the subject. In the body field, paste a string of 10000 characters (mixed text, e.g., repeat "This is a long feedback message. " approximately 310 times). Submit.
**Expected:** Either: (a) a max-length validation message appears, or (b) the feedback is submitted successfully without timeout or crash.

### Step 8 — 1000-character feedback subject
**Action:** In the feedback form, paste a 1000-character string in the subject field. Enter "Normal body" in the body. Submit.
**Expected:** The subject is either truncated/rejected by validation or saved without breaking the feedback list UI.

### Step 9 — Oversized CRA report content
**Action:** Navigate to an existing product's CRA report section. Create a new report. In any free-text content field, paste 10000 characters of text. Submit.
**Expected:** The report is either created successfully (content is stored and viewable without layout issues) or the form shows a max-length validation message.

### Step 10 — Extremely long single word (no spaces)
**Action:** In any text input (product name is ideal), enter a single word of 500 characters with no spaces (e.g., "Abcdefghij" repeated 50 times). Submit.
**Expected:** The UI handles the unbreakable word gracefully — either CSS word-break/overflow rules prevent horizontal scrolling, or validation rejects the input.

### Step 11 — Unicode and emoji overload
**Action:** Create a product with a name consisting of 200 emoji characters (e.g., copy-paste a block of mixed emojis). Submit.
**Expected:** The form either accepts the input and displays it correctly (emojis render properly, layout is intact) or rejects it with a validation message. No encoding errors or crashes occur.

### Step 12 — Clean up
**Action:** Delete any test products created during this test. Restore the organisation name to its original value.
**Expected:** Cleanup completes without errors.

## Pass Criteria

- [ ] No page crashes or unhandled 500 errors from oversized inputs
- [ ] Product name field either enforces a max length or gracefully handles overflow in display
- [ ] Organisation name with 1000+ characters does not break sidebar or header layout
- [ ] Long website URLs do not break the settings page layout
- [ ] 10000-character feedback body is either accepted or rejected cleanly
- [ ] Long unbreakable words do not cause horizontal scrolling on list pages
- [ ] Emoji-heavy strings do not cause encoding errors
- [ ] All error messages from length violations are user-friendly

## Result

**Status:** passed
**Notes:** All steps verified. Defects found during testing have been resolved and re-verified.

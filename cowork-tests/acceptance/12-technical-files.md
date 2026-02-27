# Test: Technical Files — Overview, Product Sections, Update Content

**Priority:** high
**Preconditions:** User is logged in as org admin. At least one product exists in the organisation. The technical files feature is accessible (CRA technical documentation management).
**Test User:** testadmin@manufacturer-active.test / TestPass123!
**URL:** https://dev.cranis2.dev/login

## Steps

### Step 1 — Login
**Action:** Enter email `testadmin@manufacturer-active.test` and password `TestPass123!`. Click "Sign In".
**Expected:** User is redirected to the dashboard.

### Step 2 — Navigate to Technical Files
**Action:** In the sidebar, expand the "Compliance" section. Click "Technical Files" or equivalent navigation item.
**Expected:** The technical files overview page loads showing a list of products with their technical documentation status.

### Step 3 — View Technical Files Overview
**Action:** Review the overview page.
**Expected:** The page displays:
- A list of products in the organisation
- Each product shows its technical documentation completeness (e.g. percentage, section count, or status indicators)
- Products with incomplete documentation are distinguishable from complete ones
- A clear way to drill into each product's technical file sections

### Step 4 — Select a Product
**Action:** Click on a product to view its technical file sections.
**Expected:** The product technical files page loads showing individual sections of the CRA technical documentation. Each section represents a required area of the technical file (e.g. product description, risk assessment, security requirements, vulnerability handling process, etc.).

### Step 5 — View Product Sections
**Action:** Review the list of technical file sections.
**Expected:** Multiple sections are displayed, each showing:
- Section title/name
- Current status (complete, in progress, empty/not started)
- A preview of content (if any has been entered)
- An edit or update action

### Step 6 — Open a Section for Editing
**Action:** Click on a section that is empty or incomplete (e.g. "Product Description" or "Risk Assessment"). Click "Edit" if needed.
**Expected:** A text editor or form opens for the selected section. If content already exists, it is pre-populated in the editor.

### Step 7 — Update Section Content
**Action:** Enter or update the section content with test text: "CoWork acceptance test — technical file section content updated on 2026-02-27. This section documents the compliance requirements for the product under the Cyber Resilience Act." Save the changes.
**Expected:** A success message appears. The section now displays the updated content. The section status changes to "complete" or "in progress" (depending on whether all required fields are filled).

### Step 8 — Verify Content Persists
**Action:** Navigate back to the technical files overview, then drill back into the same product and section.
**Expected:** The updated content is still present: "CoWork acceptance test — technical file section content updated on 2026-02-27..."

### Step 9 — Update a Second Section
**Action:** Open a different section. Enter content: "Second section test content for acceptance testing." Save.
**Expected:** A success message appears. The second section now shows the test content. The product's overall completeness indicator may update to reflect the additional completed section.

### Step 10 — Verify Overview Reflects Updates
**Action:** Navigate back to the technical files overview page.
**Expected:** The product's documentation completeness indicator has updated to reflect the two sections that now have content. The product is visually distinguishable from products with no documentation.

### Step 11 — Revert Section Content
**Action:** Navigate back into the sections edited in Steps 7 and 9. Clear the test content or restore original values. Save.
**Expected:** The sections are reverted. The overview completeness indicator adjusts accordingly.

## Pass Criteria
- [ ] Technical files overview page loads with a list of products
- [ ] Product documentation completeness is indicated on the overview
- [ ] Individual product sections are listed with titles and statuses
- [ ] A section can be opened for editing
- [ ] Section content can be updated and saved
- [ ] Updated content persists after navigation
- [ ] Multiple sections can be independently edited
- [ ] Overview completeness indicator reflects section updates
- [ ] Test content can be reverted/cleaned up

## Result
**Status:** _pending_
**Notes:**

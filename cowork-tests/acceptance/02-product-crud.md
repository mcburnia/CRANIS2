# Test: Product CRUD — Create, Edit, List, Filter, Delete

**Priority:** critical
**Preconditions:** User is logged in as an org admin. The organisation exists and has billing in good standing (not suspended/cancelled).
**Test User:** testadmin@manufacturer-active.test / TestPass123!
**URL:** https://dev.cranis2.dev/login

## Steps

### Step 1 — Login
**Action:** Enter email `testadmin@manufacturer-active.test` and password `TestPass123!`. Click "Sign In".
**Expected:** User is redirected to the dashboard.

### Step 2 — Navigate to Products List
**Action:** In the sidebar, click "Products" or the equivalent navigation item.
**Expected:** The products list page loads showing all products belonging to the organisation. Each product card/row shows the product name and key details.

### Step 3 — Create a New Product
**Action:** Click the "Add Product" or "New Product" button. Fill in the form:
- Name: `CoWork Test Product`
- Description: `Automated acceptance test product`
- Version: `1.0.0`
Submit the form.
**Expected:** A success message appears. The new product "CoWork Test Product" appears in the products list.

### Step 4 — View the New Product
**Action:** Click on "CoWork Test Product" in the products list.
**Expected:** The product detail page loads showing:
- Product name: "CoWork Test Product"
- Description: "Automated acceptance test product"
- Version information
- Tabs or sections for SBOM, vulnerabilities, compliance, etc.

### Step 5 — Edit Product Details
**Action:** Click the "Edit" button on the product detail page. Change:
- Name to `CoWork Test Product Edited`
- Description to `Updated description for acceptance test`
Save the changes.
**Expected:** A success message appears. The product detail page now shows the updated name and description.

### Step 6 — Verify Edit Persists
**Action:** Navigate back to the products list, then click on the edited product.
**Expected:** The product detail page shows:
- Name: "CoWork Test Product Edited"
- Description: "Updated description for acceptance test"

### Step 7 — Filter Products
**Action:** Return to the products list. Use the search or filter input. Type `CoWork` or `Edited`.
**Expected:** The list filters to show only products matching the search term. "CoWork Test Product Edited" appears in the filtered results.

### Step 8 — Clear Filter
**Action:** Clear the search/filter input.
**Expected:** The full list of products is displayed again.

### Step 9 — Delete the Test Product
**Action:** Navigate to "CoWork Test Product Edited". Click the "Delete" button. Confirm the deletion in the confirmation dialog.
**Expected:** A success message appears. The user is redirected to the products list. "CoWork Test Product Edited" no longer appears in the list.

### Step 10 — Verify Deletion
**Action:** Search for "CoWork Test Product" in the products list.
**Expected:** No results are found. The product has been fully removed.

## Pass Criteria
- [ ] Products list page loads and displays existing products
- [ ] A new product can be created with name, description, and version
- [ ] The new product appears in the products list
- [ ] Product details can be edited and changes are saved
- [ ] Edits persist after navigating away and returning
- [ ] Products can be filtered/searched by name
- [ ] A product can be deleted with confirmation
- [ ] Deleted product no longer appears in the list

## Result
**Status:** _pending_
**Notes:**

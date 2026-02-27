# Test: Products — Create Product Flow

**Priority:** critical  
**Preconditions:** User is logged in as org admin with an active billing plan that allows product creation; user knows the repo connection details or can create a product without a repo  
**Test User:** testadmin@manufacturer-active.test / TestPass123!  
**URL:** https://dev.cranis2.dev/products

## Steps

### Step 1: Navigate to Products Page
- **Action:** Click "Products" in the sidebar to navigate to the products list
- **Expected:** The products page loads at `/products`. An "Add Product" or "Create Product" button is visible. The current product count is noted for later comparison.

### Step 2: Open Create Product Form
- **Action:** Click the "Add Product" or "Create Product" button
- **Expected:** A product creation form or modal appears. The form contains fields for at minimum: product name and CRANIS version (`cranis_version` column). A provider dropdown may be visible for repo connection. A submit/save button is present.

### Step 3: Fill in Product Details
- **Action:** Enter the following details:
  - **Product Name:** `Smoke Test Product — 2026-02-27`
  - **CRANIS Version:** `1.0.0`
  - Leave optional fields (repo connection, provider, instance URL) empty or at defaults
- **Expected:** All required fields accept input. No validation errors appear while typing. The form does not submit prematurely.

### Step 4: Submit the Product
- **Action:** Click the submit/save button to create the product
- **Expected:** A loading indicator appears briefly. A success toast or confirmation message appears (e.g., "Product created"). The user is redirected to either the product detail page or back to the product list. No error messages appear. The API call to create the product returns HTTP 200 or 201.

### Step 5: Verify Product Appears in the List
- **Action:** Navigate back to the products list at `/products` (if not already there)
- **Expected:** The newly created product "Smoke Test Product — 2026-02-27" appears in the product list. The total product count has increased by one compared to Step 1.

### Step 6: Open the New Product Detail Page
- **Action:** Click on the newly created product "Smoke Test Product — 2026-02-27" in the list
- **Expected:** The product detail page loads at `/products/:productId`. The product name "Smoke Test Product — 2026-02-27" is displayed in the page header. The CRANIS version "1.0.0" is visible. Product sections (SBOM, vulnerabilities, compliance, escrow, etc.) are present, showing empty states or initial values. No console errors.

### Step 7: Verify Product in Neo4j (via UI)
- **Action:** Check that the product detail page shows repository and graph-related sections
- **Expected:** The product detail page renders sections that would pull from Neo4j (e.g., repo connection status, dependency graph). These sections show appropriate empty states since no repo was connected. No "500 Internal Server Error" or graph database errors appear.

### Step 8: Clean Up (Optional)
- **Action:** If a delete option is available on the product detail page, delete the test product to clean up. Otherwise, note the product ID for manual cleanup later.
- **Expected:** If deleted: a confirmation dialog appears, deletion succeeds, and the product is removed from the list. If not deleted: note the product name and ID for later cleanup.

## Pass Criteria
- [ ] "Add Product" button is visible and functional
- [ ] Product creation form renders with required fields
- [ ] Form accepts valid input without premature validation errors
- [ ] Product is successfully created (API returns 2xx)
- [ ] Success feedback is shown to the user
- [ ] New product appears in the product list
- [ ] Product detail page loads with correct name and version
- [ ] No console errors throughout the flow
- [ ] All pages render correctly
- [ ] Response times under 3 seconds for each action

## Result
**Status:** _pending_  
**Notes:**  
**Screenshots:**  

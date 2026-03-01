# Test: Repository Connection — View Providers, Connect Repo, Verify Info

**Priority:** high
**Preconditions:** User is logged in as org admin. At least one product exists in the organisation. The user has a GitHub or Codeberg account with at least one public repository.
**Test User:** testadmin@manufacturer-active.test / TestPass123!
**URL:** https://dev.cranis2.dev/login

## Steps

### Step 1 — Login
**Action:** Enter email `testadmin@manufacturer-active.test` and password `TestPass123!`. Click "Sign In".
**Expected:** User is redirected to the dashboard.

### Step 2 — Navigate to a Product
**Action:** In the sidebar, click "Products". Select an existing product from the list.
**Expected:** The product detail page loads with tabs/sections for various features.

### Step 3 — Open Repository Settings
**Action:** Navigate to the repository or source code section of the product. This may be a "Repository" tab or an edit form with a repo connection section.
**Expected:** The repository connection section is displayed. If no repo is connected, a prompt to connect one is shown.

### Step 4 — View Available Repo Providers
**Action:** Click "Connect Repository" or the provider dropdown.
**Expected:** A list of supported repository providers is displayed, including:
- GitHub
- Codeberg
- Gitea (with instance URL field)
- Forgejo (with instance URL field)
- GitLab (with instance URL field)

### Step 5 — Select a Provider
**Action:** Select "GitHub" from the provider dropdown.
**Expected:** The form updates to show GitHub-specific connection fields (owner/repo or URL input). For self-hosted providers (Gitea, Forgejo, GitLab), an instance URL field would appear.

### Step 6 — Enter Repository Details
**Action:** Enter a valid public GitHub repository URL or owner/repo combination (e.g. a known test repository). Submit the connection form.
**Expected:** The system validates the repository. A success message appears confirming the repository has been connected.

### Step 7 — Verify Repository Info Displays
**Action:** View the product detail page repository section after connection.
**Expected:** The connected repository information is displayed:
- Repository name/URL
- Provider badge (e.g. GitHub icon/label)
- Connection status (connected/active)

### Step 8 — Verify Repo Info Persists
**Action:** Navigate away from the product (e.g. to the products list) and then return to the product detail page.
**Expected:** The repository connection information still displays correctly with all details intact.

## Pass Criteria
- [ ] Repository connection section is accessible from the product page
- [ ] All five supported providers are listed (GitHub, Codeberg, Gitea, Forgejo, GitLab)
- [ ] Self-hosted providers show an instance URL input field
- [ ] A repository can be connected to a product
- [ ] Connected repo info (name, provider, status) displays correctly
- [ ] Repo connection persists after navigation

## Result
**Status:** passed
**Notes:** All steps verified. Defects found during testing have been resolved and re-verified.

# CRANIS2 Billing & Pricing Model

> Decision log for billing implementation. All pricing decisions recorded here before coding begins.
> Last updated: 2026-02-25

---

## Pricing Philosophy

- Per-contributor pricing — simple, transparent, scales with team size
- Consumer Duty Act compliant — cancellation must be as easy as sign-up across all tiers
- No lock-in — all SaaS subscriptions easy to enter, easy to exit
- Customer data treated with respect even after cancellation

---

## Tiers

### 1. Free Trial

| Attribute | Detail |
|-----------|--------|
| **Price** | €0 |
| **Duration** | 3 months (default, configurable per org by platform admin) |
| **Contributors** | 1 (single contributor / one-man-band) |
| **Products** | Unlimited |
| **Card required** | No — explicit upgrade action required after trial |
| **Purpose** | Let solo developers / micro-companies get started and evaluate the platform |

**Admin controls:**
- Platform admins can edit the free trial duration per organisation (extend, shorten)
- Non-admin users cannot view or modify trial settings
- Trial expiry notifications at 14 days and 7 days before expiry

**Trial contributor limit:**
- Contributors counted using 90-day activity window
- Known bots auto-excluded from count
- If active contributor count exceeds 1, show warning and prompt upgrade — do not block

**Anti-gaming:**
- On product creation / repo connection: verify the GitHub repo is NOT already registered to another organisation
- Block connection if repo is linked to another org (active, suspended, or expired trial)
- Do not reveal the other org's identity or status (privacy)

---

### 2. Standard (Pay-as-you-grow)

| Attribute | Detail |
|-----------|--------|
| **Price** | €6 per organisation contributor per month |
| **Currency** | EUR only (v1). Multi-currency in backlog. |
| **Billing cycle** | Anniversary (bills on the date they subscribed) |
| **Annual billing** | Not available in v1. Monthly only. In backlog. |
| **Contributors** | Unlimited |
| **Products** | Unlimited (within the organisation) |
| **Billing unit** | Organisation contributor (identified via git repo contributions) |

**Contributor counting rules:**
- A contributor is anyone identified in the git repository contributions for products belonging to that organisation
- **90-day activity window**: only contributors with commits in the last 90 days are billable
- Contributors can work on any number of products within the same organisation — still counted once
- If the same person contributes to products across **multiple** organisations, **each organisation is charged separately** for that contributor
- Contributor identity is determined by git contribution data (GitHub login / commit author)
- **Snapshot on billing date**: count is taken on the day the invoice is generated
- **Bot exclusion**: known bot accounts (dependabot, renovate, github-actions, etc.) automatically excluded from billing. Detected via GitHub API `type: "Bot"` field + curated name list.
- **Inactive contributors**: no commits in 90+ days = not billed. Automatically excluded.

**Contributor disputes:**
- Org admins can self-service mark a contributor as "departed" — immediate billing removal
- All departures logged in audit trail
- Platform admins can review departures and override if needed
- Suspicious patterns flagged (e.g. 10 departures right before billing day)

**Example:**
> Alice contributes to 3 products at OrgA and 2 products at OrgB.
> OrgA pays €6/month for Alice. OrgB also pays €6/month for Alice.
> Each org is billed independently based on their own contributor roster.

---

### 3. Enterprise (Co-located Instance)

| Attribute | Detail |
|-----------|--------|
| **Price** | Custom (negotiated per contract) |
| **Deployment** | Dedicated / co-located CRANIS2 instance |
| **Contributors** | As per contract |
| **Products** | As per contract |
| **Support** | As per contract |

**Notes:**
- Not managed through the standard Stripe billing flow
- Pricing, SLAs, and terms negotiated individually
- Excluded from self-service billing UI (handled offline)

**Enquiry flow:**
- "Contact Sales" button on billing page opens a modal form within CRANIS2
- Captures: company name, contact name, email, estimated team size, requirements
- Sends email via Resend, logs lead in admin dashboard

---

## Security Roster (Compliance Feature)

Separate from billing, a security-focused view of all contributors for CRA/NIS2 compliance:

| Category | Icon | Description |
|----------|------|-------------|
| **Active** | ✅ | Human, commits in last 90 days |
| **Inactive** | ⚠️ | Human, no commits in 90+ days, still has repo access — flag for access review |
| **Departed** | ❌ | Human, marked as departed by org admin, access should be revoked |
| **Bot — monitored** | 🤖 | Automated account, tracked but not billed |
| **Shared/Generic — compliance risk** | 🔴 | Suspected shared account, CRA/NIS2 requires individual attribution |

**Shared account detection (v1):**
- Generic naming heuristics (admin, developer, deploy, team, shared, etc.)
- Temporal anomaly: commits spread across 18+ hours of the day consistently (shift pattern = multiple people)
- Flag on security roster with compliance warning notification

**Compliance notifications:**
- "Shared account detected: CRA/NIS2 requires individual attribution of code changes"
- "3 contributors inactive 90+ days but still have repo access — review recommended"

---

## Consumer Duty Act Compliance

All tiers (except Enterprise, which is contract-based) must adhere to:

- **Easy exit**: One-click cancellation via Stripe Customer Portal, no phone calls, no retention flows
- **Clear communication**: Upcoming charges, trial expiry, and plan changes communicated via email and in-app notification
- **No dark patterns**: No pre-checked upsells, no hidden fees, no confusing cancellation paths
- **Transparent pricing**: Total monthly cost always visible on the billing page based on current contributor count
- **No card upfront for trial**: Explicit upgrade action required — nobody charged unexpectedly
- **Cancellation at period end**: Cancelled subscriptions retain access until the end of the paid period
- **Data respect**: 12-month retention after cancellation, full archive provided before deletion

---

## Trial Expiry & Grace Periods

| Timeline | State | Access Level |
|----------|-------|-------------|
| Day -14 | Trial active | Full access. Email + in-app warning: "Trial ends in 2 weeks" |
| Day -7 | Trial active | Full access. Email + in-app warning: "Trial ends in 7 days" |
| Day 0 | Trial expired | Full access. Persistent banner: "Trial expired. Upgrade to continue." |
| Days 1-7 | Grace period | Full access continues. Banner persists. Email: "Trial expired." |
| Day 8+ | Read-only | Can view everything, cannot edit/sync/scan/export reports. Email notification. |
| Day 60+ | Suspended | Can only: log in, view billing page, update payment, export own data. |
| 12 months | Data archive | Secure download link emailed. Link valid 30 days. |
| 12 months + 30 days | Data purged | All org data deleted. Audit log: "Data archive sent, org purged." |

---

## Payment Failure Handling

| Timeline | Action |
|----------|--------|
| Day 0 | Payment fails. Stripe Smart Retries begin. Email + in-app (admin only): "Payment failed." |
| Day 3 | Stripe retries. Second email if still failing. |
| Day 5 | Stripe final retry. Urgent email (admin only): "2 days until access restricted." |
| Day 7 | Read-only mode. Email to all users: "Account restricted due to non-payment." In-app critical notification. |
| Day 30 | Account suspended. Email: "Account suspended. Update payment to restore access." |
| Day 60 | Final email: "Resubscribe within 30 days or data will be archived." |
| 12 months post-cancellation | Data archive ZIP via secure download link. Then purge. |

**Hardship / extenuating circumstances:**
- Contact route (email or in-app) for orgs needing more time
- Platform admin can apply a **payment pause** — extends grace period for 30/60/90 days
- Reason logged in audit trail
- Covers: holiday, hospitalisation, bereavement, company restructuring, bank issues, parental leave, force majeure

**Dunning:**
- Stripe Smart Retries: enabled (automatic, ML-optimised retry timing)
- Stripe dunning emails: disabled (generic, not branded)
- CRANIS2 emails via Resend: enabled (branded, specific, includes hardship contact info)
- In-app notifications: enabled (severity escalation: info → warning → critical)

---

## Access Levels

### Always accessible (even in read-only / suspended):
- Log in
- View billing page and update payment method
- Export own data (GDPR right)

### Accessible in read-only (not in suspended):
- View dashboards
- View all compliance data (technical files, obligations, risk findings, licence reports, ENISA reports)
- View contributor and dependency lists

### Blocked in read-only:
- Sync repos / trigger SBOM updates
- Run vulnerability scans or licence scans
- Edit technical files, obligations, stakeholders
- Create new products or connect repos
- Generate new IP proof snapshots
- Create new ENISA reports
- Invite new users

### Blocked on full suspension:
- Everything above, plus all viewing except billing page and data export

---

## Data Retention & Cancellation Lifecycle

| Stage | Timeline | Action |
|-------|----------|--------|
| Cancellation | Day 0 | Access continues until end of paid period |
| Paid period ends | Varies | Read-only mode begins |
| Retention | 12 months | Data retained, account can be reactivated at any time |
| Archive warning | 11 months | Email: "Your data will be archived in 30 days" |
| Archive | 12 months | Complete data export ZIP generated (compliance reports, SBOMs, vulnerability history, licence findings, technical files, audit log, IP proof snapshots) |
| Download link | 12 months | Secure time-limited download link (valid 30 days) emailed to registered contact |
| Purge | 12 months + 30 days | All org data deleted from platform. Audit log entry recorded. |

---

## VAT & Tax

- **Stripe Tax**: enabled from day one (0.5% per transaction)
- **EU B2B with valid VAT number**: reverse charge (0% VAT), VAT number validated via VIES
- **EU B2B without VAT number**: local rate applied automatically by Stripe
- **EU consumer**: local rate applied automatically by Stripe
- **Non-EU**: generally no VAT (UK rules apply if UK threshold exceeded)

**Collected during upgrade flow:**
- Company name
- Billing address (street, city, postcode, country)
- VAT number (optional — enables reverse charge)
- Billing email

---

## Sanctions & Fraud Prevention

### Sanctions checking (v1):
- Stripe screens all customers against global sanctions lists (OFAC, EU, UK, UN)
- Application-level blocked country list — registration blocked from comprehensively sanctioned jurisdictions
- Country collected at sign-up (also used for VAT)

### AML:
- Risk assessed as negligible for small-value SaaS subscriptions
- Stripe handles KYC/AML on the payment side
- Risk assessment documented (this document)

### Inbound fraud prevention (v1):
- Stripe Radar: enabled (free, ML-based fraud scoring on every transaction)
- Rate limiting on registration (max 3 accounts per IP per 24 hours)
- Email verification (existing, via Resend)
- Repo uniqueness check (prevents trial abuse / re-registration)

---

## Stripe Integration

| Component | Decision |
|-----------|----------|
| **Checkout** | Stripe Checkout (hosted) — never handle card data |
| **Customer portal** | Stripe Customer Portal (hosted) — invoices, payment method, cancellation |
| **Webhook URL** | Configurable via `APP_BASE_URL` env var. Dev: `https://dev.cranis2.dev/api/billing/webhook` |
| **Webhook security** | Stripe signature verification (HMAC), no auth middleware on webhook endpoint |
| **Idempotency** | Webhook handler must handle duplicate events safely |
| **Smart Retries** | Enabled |
| **Stripe Tax** | Enabled |
| **Stripe Radar** | Enabled |
| **Dunning emails** | Disabled (using Resend instead) |

**Environment variables:**
- `STRIPE_SECRET_KEY` — sk_test_... (test) / sk_live_... (production)
- `STRIPE_PUBLISHABLE_KEY` — pk_test_... (test) / pk_live_... (production)
- `STRIPE_WEBHOOK_SECRET` — whsec_...
- `APP_BASE_URL` — https://dev.cranis2.dev (configurable for production)

---

## Email Notifications (via Resend)

### Trial lifecycle:
- 14 days before trial expiry
- 7 days before trial expiry
- Trial expired
- End of 7-day grace period (read-only begins)

### Payment events:
- First payment successful (welcome email)
- Payment failed (to org admins only)
- Payment failed urgent reminder — day 5 (to org admins only)
- Access restricted due to non-payment (to all org users)

### Subscription changes:
- Subscription cancelled — access continues until [date]
- 7 days before paid period ends post-cancellation

### Account lifecycle:
- 11 months post-cancellation — data archive warning
- 12 months post-cancellation — data archive download link

### NOT emailed (in-app only):
- Recurring monthly payment successful (Stripe sends invoice receipt)
- Contributor count changes

---

## In-App Notifications

### Info (blue) — visible to org admins only:
- Monthly invoice paid
- Subscription confirmed
- Contributor count changed

### Warning (amber) — visible to org admins only:
- 14 days until trial expiry
- 7 days until trial expiry
- Payment failed
- Subscription cancelled

### Critical (red) — visible to ALL org users:
- Trial expired — upgrade required
- Payment failed — 2 days until restriction
- Account restricted due to non-payment
- Data archive and deletion imminent

---

## Platform Admin Controls

| Capability | Description |
|------------|-------------|
| **Extend trials** | Override default trial duration per org, including mid-trial extensions |
| **Apply discounts/credits** | Create Stripe coupons/credits and apply to org subscriptions |
| **Exempt orgs** | Flag org as billing-exempt (internal/partner). Full access, no subscription required |
| **Adjust contributor count** | Manual override for disputed contributors per billing cycle |
| **Payment pause** | Extend grace period for hardship (30/60/90 days) with logged reason |
| **Billing dashboard** | View all orgs: subscription status, contributor counts, payment history, MRR, churn, trial dates |
| **Enterprise leads** | View enquiry form submissions from billing page |

All admin actions logged in audit trail with who, when, and why.

---

## Backlog

### High Priority (implement soon after launch):
- [ ] IP geolocation cross-reference (registration country vs IP location mismatch)
- [ ] Device fingerprinting for suspicious sign-up patterns
- [ ] Velocity checks (same person creating accounts across multiple email addresses)
- [ ] Bot anomaly detection (unusual commit frequency, scope change, new unknown bots)

### Standard Priority:
- [ ] Annual billing option (discount TBD, with pro-rata and contributor true-up logic)
- [ ] Multi-currency pricing (GBP, USD alongside EUR)
- [ ] Enterprise enquiry — Calendly / external scheduling link integration
- [ ] Advanced shared account detection (commit style variance analysis)
- [ ] Chargeback protection (Stripe add-on evaluation)

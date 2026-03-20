# Privacy Policy

**Effective date:** 1 April 2026
**Last updated:** 20 March 2026
**Status:** Beta

CRANIS2 is operated by Loman Cavendish Limited, a company registered in England and Wales. This policy explains what personal data we collect, why we collect it, how we use it, and what rights you have.

Loman Cavendish Limited
Unit 32 St. Asaph Business Park
St. Asaph, Wales
LL17 0JA

Data protection enquiries: info@lomancavendish.com
ICO registration: [Pending]

---

## Beta Service Notice

CRANIS2 is currently in a beta testing period. During beta, the service may change without notice. This privacy policy applies in full during the beta period. If you participate in the beta programme, you accept that certain features (including data export and automated account deletion) may be delivered progressively during this period. Your data protection rights under UK GDPR are not affected by the beta status of the service.

---

## 1. Who we are

Loman Cavendish Limited is the data controller for CRANIS2. We decide what personal data is collected and how it is used. Where we use third-party services to process data on our behalf, those services act as data processors under contractual agreements.

---

## 2. What we collect and why

### 2.1 Account data

When you create an account, we collect your email address and a password. The password is hashed using bcrypt before storage. We never store or have access to your plaintext password.

We also store your preferred language, organisation membership, role within your organisation, and whether your account was created via invitation.

**Legal basis:** Contract. We need this data to provide the service you signed up for.

### 2.2 Organisation and billing data

If your organisation subscribes to a paid plan, we collect a billing email address, company name, billing address, and VAT number (if provided). This data is collected through our payment processor, Stripe, during the checkout process.

We also maintain a record of active contributors linked to your repositories, including their provider usernames and contribution counts. This is used to calculate subscription charges.

**Legal basis:** Contract. This data is necessary to process payments and manage your subscription.

### 2.3 Repository connection data

When you connect a code repository (GitHub, Codeberg, Gitea, Forgejo, or GitLab), we store your provider username, provider user ID, and avatar URL. We also store an OAuth access token, which is encrypted using AES-256-GCM before storage. We request read-only access to your repositories.

**Legal basis:** Contract. Repository access is required to deliver SBOM generation, dependency scanning, and vulnerability monitoring.

### 2.4 Compliance and stakeholder data

You may enter personal data about third parties when recording compliance stakeholders (responsible officers, CISOs, data protection officers, and similar roles). This may include names, email addresses, phone numbers, postal addresses, and organisational affiliations.

You are responsible for ensuring you have a lawful basis to provide this data to CRANIS2. We process it solely to support your CRA compliance activities.

**Legal basis:** Legitimate interest. Processing stakeholder contact details is necessary for the compliance management purpose of the platform.

### 2.5 Usage telemetry

Each time you interact with the platform, we automatically collect your IP address, browser user agent string, browser language preference, timezone, and the referring page. We record the type of action performed (login, page view, product edit, and similar events).

This data is stored in both our relational database and our graph database. In the graph database, we derive additional signals from this data, including device type, browser name, and operating system. We also cluster users by email domain for organisational analytics.

**Legal basis:** Legitimate interest. We use this data for security monitoring, fraud detection, abuse prevention, and understanding how the platform is used so we can improve it.

### 2.6 AI Copilot data

When you use the AI Copilot features (compliance suggestions, vulnerability triage, risk assessments, incident report drafting, and category recommendations), we send contextual data about your product to our AI provider, Anthropic. This includes your product name, version, CRA category, repository URL, a summary of your dependencies (package names only, not full SBOMs), vulnerability counts by severity, obligation statuses, and technical file section content.

We do not send any personal data (email addresses, names, IP addresses, or account information) to Anthropic. The data sent is limited to product and compliance context.

**Legal basis:** Contract. The AI Copilot is a feature of the platform that you choose to invoke. You can use CRANIS2 without activating any Copilot features.

### 2.7 Welcome site and contact data

If you submit a contact form or subscribe to updates on our welcome site, we collect your name, email address, position, IP address, country (derived from IP), and browser user agent. Contact form submissions require email verification before processing.

**Legal basis:** Consent. You actively choose to submit this information. You may withdraw consent at any time by contacting info@lomancavendish.com.

### 2.8 Feedback data

If you submit feedback through the platform, we collect your user ID, email address, the page you were viewing, and your browser user agent, alongside the feedback content you provide.

**Legal basis:** Legitimate interest. We use feedback to improve the platform.

### 2.9 Escrow data

If your organisation uses the source code escrow feature, we store escrow agent email addresses, display names, and Forgejo usernames. Escrow agents receive invitation emails containing temporary credentials.

**Legal basis:** Contract. Escrow access management is a contracted feature of the platform.

---

## 3. How we store your data

All data is stored on infrastructure located in the European Union. Our primary databases are PostgreSQL (relational data) and Neo4j (graph data), both running on EU-hosted servers.

Passwords are hashed using bcrypt. OAuth tokens are encrypted using AES-256-GCM with HKDF-derived keys. Our signing infrastructure uses hybrid Ed25519 and ML-DSA-65 (post-quantum) algorithms.

Access to production systems is restricted to the platform administrator. Database connections are authenticated and encrypted in transit.

---

## 4. Who we share data with

We share personal data with the following third-party processors. Each processor receives only the data necessary for its function.

### 4.1 Stripe (payment processing)

Stripe receives your billing email address, company name, billing address, VAT number, and subscription details. Stripe processes payments on our behalf and is certified under PCI DSS Level 1. Stripe is based in the United States and processes data under Standard Contractual Clauses (SCCs).

### 4.2 Resend (email delivery)

Resend delivers transactional emails on our behalf, including account verification, password resets, invitations, billing alerts, and escrow notifications. Resend receives the email addresses of recipients. Resend is based in the United States and processes data under Standard Contractual Clauses (SCCs).

### 4.3 Anthropic (AI processing)

Anthropic provides the AI model used by the Copilot features. Anthropic receives product context data as described in section 2.6. No personal data is sent to Anthropic. Anthropic is based in the United States.

### 4.4 Repository providers (GitHub, Codeberg, Gitea, Forgejo, GitLab)

When you connect a repository, your OAuth token is used to access your repositories on your behalf. We retrieve dependency data, contributor metadata (usernames, IDs, avatar URLs), and release information. The provider already holds this data. Our access is read-only and scoped to the permissions you granted during the OAuth flow.

### 4.5 Law enforcement and regulatory bodies

We may disclose personal data if required to do so by law, by court order, or by a regulatory authority with jurisdiction. We will notify you of such disclosure unless prohibited from doing so.

---

## 5. Data retention

We retain different categories of data for different periods.

| Data category | Retention period | Reason |
|---|---|---|
| Account data | Until you delete your account | Required to provide the service |
| Billing data | 7 years after the end of the subscription | UK tax and accounting obligations |
| Usage telemetry | 90 days | Security monitoring and platform improvement |
| Audit trail (compliance activity log) | 10 years | CRA Article 13(10) requires manufacturers to keep technical documentation for 10 years |
| Welcome site contacts | 12 months | Follow-up and engagement |
| Email verification codes | 24 hours | Single-use, short-lived tokens |
| Feedback submissions | 2 years | Product improvement |
| Escrow records | Duration of escrow agreement plus 1 year | Contractual obligation |

When a retention period expires, the relevant data is deleted or anonymised. We are progressively implementing automated retention enforcement. During the beta period, some retention policies may be enforced manually.

---

## 6. Cookies and local storage

CRANIS2 does not use tracking cookies. We do not use any third-party analytics, advertising, or tracking services.

We use browser local storage for two purposes.

| Key | Purpose | Classification |
|---|---|---|
| `session_token` | Stores your authentication token (JWT) so you remain logged in between page loads | Essential. The platform cannot function without this. |
| Help panel width preference | Remembers the width of the help panel sidebar | Functional. This is a user interface preference. |

The welcome site sets one HTTP-only cookie (`welcome_auth`) to maintain an authenticated session. This is classified as essential.

Because we use only essential and functional storage, we do not require a cookie consent banner under ePrivacy regulations. We disclose our use of local storage here for transparency.

---

## 7. Your rights

Under UK GDPR, you have the following rights. You can exercise any of these by contacting info@lomancavendish.com.

**Right of access.** You can request a copy of all personal data we hold about you. We will respond within 30 days.

**Right to rectification.** You can update your email address and preferences through the platform settings. For other corrections, contact us.

**Right to erasure.** You can request that we delete your account and associated personal data. Some data may be retained where we have a legal obligation to do so (billing records for tax purposes, audit trails for CRA compliance).

**Right to restrict processing.** You can request that we stop processing your data for specific purposes while a complaint or dispute is resolved.

**Right to data portability.** You can request your personal data in a structured, machine-readable format. We are implementing an automated data export feature. Until this is available, we will fulfil portability requests manually within 30 days.

**Right to object.** You can object to processing based on legitimate interest. We will stop processing unless we have compelling legitimate grounds that override your interests.

**Right to withdraw consent.** Where processing is based on consent (welcome site contact data), you can withdraw at any time. Withdrawal does not affect the lawfulness of processing carried out before withdrawal.

You also have the right to lodge a complaint with the Information Commissioner's Office (ICO) if you believe your data protection rights have been infringed. The ICO can be contacted at ico.org.uk.

---

## 8. International transfers

Some of our processors (Stripe, Resend, Anthropic) are based in the United States. Data transferred to these processors is protected by Standard Contractual Clauses (SCCs) approved by the UK government, or by the processor's participation in an approved data transfer mechanism.

We do not transfer personal data outside the UK and EU except through these processor relationships.

---

## 9. Children

CRANIS2 is a business-to-business platform for software compliance management. It is not intended for use by anyone under the age of 18. We do not knowingly collect personal data from children.

---

## 10. Automated decision-making

CRANIS2 uses AI to generate compliance suggestions, vulnerability triage recommendations, risk assessments, and CRA category recommendations. These are advisory outputs presented for your review. No automated decisions are made about you or your access to the service based on AI processing.

You always retain the ability to override, ignore, or modify any AI-generated recommendation.

---

## 11. Security incidents

If we become aware of a personal data breach that poses a risk to your rights, we will notify you without undue delay and no later than 72 hours after becoming aware of the breach. We will also notify the ICO where required.

---

## 12. Changes to this policy

We may update this policy from time to time. When we make material changes, we will notify you by email or through a notice on the platform. The "last updated" date at the top of this policy indicates the most recent revision.

---

## 13. Contact

For any questions about this policy or your personal data, contact us at:

Loman Cavendish Limited
Unit 32 St. Asaph Business Park
St. Asaph, Wales
LL17 0JA

Email: info@lomancavendish.com

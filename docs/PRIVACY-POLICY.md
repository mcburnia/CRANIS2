<!--
  Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi@mcburnie.com
-->

# Privacy Policy

**Effective date:** 1 April 2026
**Last updated:** 2 May 2026
**Status:** Beta

CRANIS2 is operated by **Andrew (Andi) MCBURNIE**, a private individual. This policy explains what personal data is collected, why it is collected, how it is used, and what rights you have.

Andrew (Andi) MCBURNIE
La Vallée
50150 Sourdeval
France

Data protection enquiries: andi@mcburnie.com
Supervisory authority registration: [Pending]

---

## Beta Service Notice

CRANIS2 is currently in a beta testing period. During beta, the service may change without notice. This privacy policy applies in full during the beta period. If you participate in the beta programme, you accept that certain features (including data export and automated account deletion) may be delivered progressively during this period. Your data protection rights under GDPR are not affected by the beta status of the service.

---

## 1. Who I am

Andrew (Andi) MCBURNIE is the data controller for CRANIS2. I decide what personal data is collected and how it is used. Where I use third-party services to process data on my behalf, those services act as data processors under contractual agreements.

CRANIS2 is at the date of this policy operated by me personally as a sole individual. If and when CRANIS2 is moved into a corporate vehicle, this policy will be re-issued and the controller details updated accordingly.

---

## 2. What I collect and why

### 2.1 Account data

When you create an account, I collect your email address and a password. The password is hashed using bcrypt before storage. I never store or have access to your plaintext password.

I also store your preferred language, organisation membership, role within your organisation, and whether your account was created via invitation.

**Legal basis:** Contract. This data is needed to provide the service you signed up for.

### 2.2 Organisation and billing data

If your organisation subscribes to a paid plan, I collect a billing email address, company name, billing address, and VAT number (if provided). This data is collected through the payment processor, Stripe, during the checkout process.

I also maintain a record of active contributors linked to your repositories, including their provider usernames and contribution counts. This is used to calculate subscription charges.

**Legal basis:** Contract. This data is necessary to process payments and manage your subscription.

### 2.3 Repository connection data

When you connect a code repository (GitHub, Codeberg, Gitea, Forgejo, GitLab, Bitbucket), I store your provider username, provider user ID, and avatar URL. I also store an OAuth access token, which is encrypted using AES-256-GCM before storage. I request read-only access to your repositories.

**Legal basis:** Contract. Repository access is required to deliver SBOM generation, dependency scanning, and vulnerability monitoring.

### 2.4 Compliance and stakeholder data

You may enter personal data about third parties when recording compliance stakeholders (responsible officers, CISOs, data protection officers, and similar roles). This may include names, email addresses, phone numbers, postal addresses, and organisational affiliations.

You are responsible for ensuring you have a lawful basis to provide this data to CRANIS2. I process it solely to support your CRA compliance activities.

**Legal basis:** Legitimate interest. Processing stakeholder contact details is necessary for the compliance management purpose of the platform.

### 2.5 Usage telemetry

Each time you interact with the platform, I automatically collect your IP address, browser user agent string, browser language preference, timezone, and the referring page. I record the type of action performed (login, page view, product edit, and similar events).

This data is stored in both a relational database and a graph database. In the graph database, additional signals are derived, including device type, browser name, and operating system. I also cluster users by email domain for organisational analytics.

**Legal basis:** Legitimate interest. This data is used for security monitoring, fraud detection, abuse prevention, and understanding how the platform is used so it can be improved.

### 2.6 AI Copilot data

When you use the AI Copilot features (compliance suggestions, vulnerability triage, risk assessments, incident report drafting, and category recommendations), contextual data about your product is sent to the AI provider, Anthropic. This includes your product name, version, CRA category, repository URL, a summary of your dependencies (package names only, not full SBOMs), vulnerability counts by severity, obligation statuses, and technical file section content.

No personal data (email addresses, names, IP addresses, or account information) is sent to Anthropic. The data sent is limited to product and compliance context.

**Legal basis:** Contract. The AI Copilot is a feature of the platform that you choose to invoke. You can use CRANIS2 without activating any Copilot features.

### 2.7 Welcome site and contact data

If you submit a contact form or subscribe to updates on the welcome site, I collect your name, email address, position, IP address, country (derived from IP), and browser user agent. Contact form submissions require email verification before processing.

**Legal basis:** Consent. You actively choose to submit this information. You may withdraw consent at any time by contacting andi@mcburnie.com.

### 2.8 Feedback data

If you submit feedback through the platform, I collect your user ID, email address, the page you were viewing, and your browser user agent, alongside the feedback content you provide.

**Legal basis:** Legitimate interest. Feedback is used to improve the platform.

### 2.9 Escrow data

If your organisation uses the source code escrow feature, I store escrow agent email addresses, display names, and Forgejo usernames. Escrow agents receive invitation emails containing temporary credentials.

**Legal basis:** Contract. Escrow access management is a contracted feature of the platform.

---

## 3. How your data is stored

All data is stored on infrastructure located in the European Union. The primary databases are PostgreSQL (relational data) and Neo4j (graph data), both running on EU-hosted servers.

Passwords are hashed using bcrypt. OAuth tokens are encrypted using AES-256-GCM with HKDF-derived keys. The signing infrastructure uses hybrid Ed25519 and ML-DSA-65 (post-quantum) algorithms.

Access to production systems is restricted to the platform operator. Database connections are authenticated and encrypted in transit.

---

## 4. Who I share data with

I share personal data with the following third-party processors. Each processor receives only the data necessary for its function.

### 4.1 Stripe (payment processing)

Stripe receives your billing email address, company name, billing address, VAT number, and subscription details. Stripe processes payments on my behalf and is certified under PCI DSS Level 1. Stripe is based in the United States and processes data under Standard Contractual Clauses (SCCs) and the EU-US Data Privacy Framework where applicable.

### 4.2 Resend (email delivery)

Resend delivers transactional emails on my behalf, including account verification, password resets, invitations, billing alerts, and escrow notifications. Resend receives the email addresses of recipients. Resend is based in the United States and processes data under Standard Contractual Clauses (SCCs) and the EU-US Data Privacy Framework where applicable.

### 4.3 Anthropic (AI processing)

Anthropic provides the AI model used by the Copilot features. Anthropic receives product context data as described in section 2.6. No personal data is sent to Anthropic. Anthropic is based in the United States.

### 4.4 Repository providers (GitHub, Codeberg, Gitea, Forgejo, GitLab, Bitbucket)

When you connect a repository, your OAuth token is used to access your repositories on your behalf. I retrieve dependency data, contributor metadata (usernames, IDs, avatar URLs), and release information. The provider already holds this data. Access is read-only and scoped to the permissions you granted during the OAuth flow.

### 4.5 Law enforcement and regulatory bodies

I may disclose personal data if required to do so by law, by court order, or by a regulatory authority with jurisdiction. I will notify you of such disclosure unless prohibited from doing so.

---

## 5. Data retention

Different categories of data are retained for different periods.

| Data category | Retention period | Reason |
|---|---|---|
| Account data | Until you delete your account | Required to provide the service |
| Billing data | 7 years after the end of the subscription | Tax and accounting obligations |
| Usage telemetry | 90 days | Security monitoring and platform improvement |
| Audit trail (compliance activity log) | 10 years | CRA Article 13(10) requires manufacturers to keep technical documentation for 10 years |
| Welcome site contacts | 12 months | Follow-up and engagement |
| Email verification codes | 24 hours | Single-use, short-lived tokens |
| Feedback submissions | 2 years | Product improvement |
| Escrow records | Duration of escrow agreement plus 1 year | Contractual obligation |

When a retention period expires, the relevant data is deleted or anonymised automatically. Automated retention enforcement runs on a scheduled basis, deleting expired telemetry events, feedback, verification tokens, and Copilot response cache. The platform operator can also trigger a manual retention cleanup at any time.

---

## 6. Cookies and local storage

CRANIS2 does not use tracking cookies. There are no third-party analytics, advertising, or tracking services.

The platform uses browser local storage for two purposes.

| Key | Purpose | Classification |
|---|---|---|
| `session_token` | Stores your authentication token (JWT) so you remain logged in between page loads | Essential. The platform cannot function without this. |
| Help panel width preference | Remembers the width of the help panel sidebar | Functional. This is a user interface preference. |

The welcome site sets one HTTP-only cookie (`welcome_auth`) to maintain an authenticated session. This is classified as essential.

Because only essential and functional storage is used, no cookie consent banner is required under ePrivacy regulations. The use of local storage is disclosed here for transparency.

---

## 7. Your rights

Under GDPR, you have the following rights. You can exercise any of these by contacting andi@mcburnie.com.

**Right of access.** You can request a copy of all personal data held about you. I will respond within 30 days.

**Right to rectification.** You can update your email address and preferences through the platform settings. For other corrections, contact me.

**Right to erasure.** You can request that I delete your account and associated personal data. Some data may be retained where there is a legal obligation to do so (billing records for tax purposes, audit trails for CRA compliance).

**Right to restrict processing.** You can request that I stop processing your data for specific purposes while a complaint or dispute is resolved.

**Right to data portability.** You can request your personal data in a structured, machine-readable format. Navigate to your Account page and select "Export My Data" to download a JSON export of all your personal data, including account details, organisation membership, products, findings, and usage history. Security-sensitive data (password hashes, OAuth tokens) is excluded from the export.

**Right to object.** You can object to processing based on legitimate interest. I will stop processing unless there are compelling legitimate grounds that override your interests.

**Right to withdraw consent.** Where processing is based on consent (welcome site contact data), you can withdraw at any time. Withdrawal does not affect the lawfulness of processing carried out before withdrawal.

You also have the right to lodge a complaint with the relevant supervisory authority under GDPR if you believe your data protection rights have been infringed. As the platform operator is currently established in France, the lead supervisory authority is the **Commission Nationale de l'Informatique et des Libertés (CNIL)** — `cnil.fr`. You may also contact the supervisory authority of your own country of residence.

---

## 8. International transfers

Some processors (Stripe, Resend, Anthropic) are based in the United States. Data transferred to these processors is protected by Standard Contractual Clauses (SCCs) approved by the European Commission, or by the processor's participation in the EU-US Data Privacy Framework where applicable.

Personal data is not transferred outside the EU or the UK except through these processor relationships.

---

## 9. Children

CRANIS2 is a business-to-business platform for software compliance management. It is not intended for use by anyone under the age of 18, and personal data from children is not knowingly collected.

---

## 10. Automated decision-making

CRANIS2 uses AI to generate compliance suggestions, vulnerability triage recommendations, risk assessments, and CRA category recommendations. These are advisory outputs presented for your review. No automated decisions are made about you or your access to the service based on AI processing.

You always retain the ability to override, ignore, or modify any AI-generated recommendation.

---

## 11. Security incidents

If I become aware of a personal data breach that poses a risk to your rights, I will notify you without undue delay and no later than 72 hours after becoming aware of the breach. The relevant supervisory authority will also be notified where required by GDPR.

---

## 12. Changes to this policy

This policy may be updated from time to time. When material changes are made, you will be notified by email or through a notice on the platform. The "last updated" date at the top of this policy indicates the most recent revision.

---

## 13. Contact

For any questions about this policy or your personal data, contact:

Andrew (Andi) MCBURNIE
La Vallée
50150 Sourdeval
France

Email: andi@mcburnie.com

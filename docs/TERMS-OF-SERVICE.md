<!--
  Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi@mcburnie.com
-->

# Terms of Service

**Effective date:** 1 April 2026
**Last updated:** 20 March 2026
**Status:** Beta

These terms govern your use of CRANIS2, a software compliance management platform operated by Loman Cavendish Limited.

Loman Cavendish Limited
Unit 32 St. Asaph Business Park
St. Asaph, Wales
LL17 0JA

Company registration: England and Wales
Contact: info@lomancavendish.com

By creating an account or using the platform, you agree to these terms. If you do not agree, do not use the service.

---

## Beta Service Notice

CRANIS2 is currently in a beta testing period. During the beta period, the following additional conditions apply.

The service is provided for evaluation and early-adoption purposes. Features may be added, changed, or removed without prior notice. We may reset, migrate, or restructure data during the beta period where necessary for platform development, though we will give reasonable advance notice before doing so.

No service level agreement (SLA) applies during the beta period. We will make reasonable efforts to maintain availability but do not guarantee uninterrupted access.

Beta participants may be asked to provide feedback on their experience. Participation in feedback is voluntary.

When the beta period ends, we will notify you in advance. Your continued use of the platform after the beta period constitutes acceptance of the terms in effect at that time, which may differ from these beta terms.

---

## 1. The service

CRANIS2 helps software organisations manage compliance with the EU Cyber Resilience Act (CRA) and related regulations. The platform provides product tracking, obligation management, vulnerability monitoring, SBOM generation, technical file assembly, compliance reporting, and AI-assisted guidance.

CRANIS2 is a compliance management tool. It is not a substitute for professional legal advice. The platform provides structured frameworks and AI-assisted suggestions to support your compliance activities, but you are responsible for your own regulatory compliance decisions.

---

## 2. Accounts

### 2.1 Registration

You must provide a valid email address and create a password to use CRANIS2. You must verify your email address before your account is fully activated.

You are responsible for maintaining the security of your account credentials. If you believe your account has been compromised, contact us immediately at info@lomancavendish.com.

### 2.2 Organisation membership

Each user account belongs to one organisation. Organisation administrators can invite other users, assign roles, and manage organisation settings. Administrators are responsible for the accounts they create and the access they grant.

### 2.3 Minimum age

You must be at least 18 years old to use CRANIS2.

---

## 3. Acceptable use

You agree to use CRANIS2 only for its intended purpose of software compliance management. You must not:

- Attempt to gain unauthorised access to other accounts, organisations, or platform infrastructure
- Use the platform to store, transmit, or process data that you do not have the right to handle
- Reverse-engineer, decompile, or attempt to extract the source code of the platform
- Use automated tools (scrapers, bots, or similar) to access the platform except through our published API
- Interfere with the operation of the platform or impose an unreasonable load on our infrastructure
- Use the AI Copilot features to generate content for purposes unrelated to your compliance activities
- Enter personal data about third parties (stakeholder records, contributor information) without a lawful basis to do so
- Resell, sublicense, or redistribute access to the platform without our written consent

We reserve the right to suspend or terminate accounts that violate these terms.

---

## 4. Subscriptions and billing

### 4.1 Plans

CRANIS2 offers paid subscription plans. Pricing is published on the platform and may change with 30 days' notice. Current plans are billed monthly based on the number of active contributors and products in your organisation.

### 4.2 Payment

Payments are processed by Stripe. By subscribing, you agree to Stripe's terms of service. You authorise us to charge your payment method at the start of each billing cycle.

### 4.3 Cancellation

You may cancel your subscription at any time through the platform. Cancellation takes effect at the end of the current billing period. You will retain access until that date.

### 4.4 Refunds

We do not offer refunds for partial billing periods. If you believe you have been charged in error, contact info@lomancavendish.com within 14 days of the charge.

### 4.5 Non-payment

If payment fails, we will attempt to collect payment for up to 14 days. If payment remains outstanding, your organisation's access may be restricted to read-only mode. Continued non-payment may result in account suspension.

---

## 5. Your data

### 5.1 Ownership

You retain full ownership of all data you upload, enter, or generate through the platform. This includes product information, compliance records, SBOM data, stakeholder details, technical files, and any other content you create.

We do not claim any intellectual property rights over your data.

### 5.2 Licence to us

By using the platform, you grant us a limited licence to process, store, and display your data solely for the purpose of providing the service. This licence ends when you delete your data or close your account, subject to any retention obligations described in our Privacy Policy.

### 5.3 Data portability

You may export your data at any time through the platform's export features (SBOM exports, compliance reports, due diligence packages). A full account data export is available from your Account page — select "Export My Data" to download a structured JSON file containing all your personal data. You may also request account deletion from the same page, which immediately removes personal data and anonymises billing and audit records for legal retention.

### 5.4 Data processing

Our processing of your personal data is governed by our Privacy Policy, which forms part of these terms. By using the platform, you acknowledge that you have read and understood the Privacy Policy.

---

## 6. AI Copilot

### 6.1 Nature of AI output

The AI Copilot features generate suggestions, assessments, and draft content using a third-party AI model (Anthropic Claude). AI output is advisory. It is not legal advice, regulatory guidance, or a substitute for professional judgement.

You are responsible for reviewing, verifying, and approving any AI-generated content before relying on it for compliance purposes.

### 6.2 Data sent to AI

When you use Copilot features, product context data (product names, dependency summaries, vulnerability counts, obligation statuses, and technical file content) is sent to Anthropic for processing. No personal data is sent. Full details are in our Privacy Policy.

### 6.3 Accuracy

We do not guarantee the accuracy, completeness, or regulatory correctness of AI-generated output. The CRA and related regulations are subject to interpretation and change. AI suggestions should be validated against current regulatory guidance.

### 6.4 Availability

AI Copilot features are subject to usage limits (rate limits and token budgets) which may vary by subscription plan. We reserve the right to adjust these limits.

---

## 7. Repository connections

When you connect a code repository, you authorise CRANIS2 to access your repositories using the permissions you grant during the OAuth flow or via a personal access token. Our access is read-only.

You are responsible for ensuring that you have the authority to grant this access. If your repository contains code owned by third parties, you must have their permission to connect it to CRANIS2.

You may disconnect a repository at any time. When you disconnect, we revoke the stored access token and stop accessing the repository. Previously imported data (SBOMs, dependency information, contributor metadata) remains in the platform unless you delete the associated product.

---

## 8. Source code escrow

If your organisation uses the escrow feature, source code snapshots are stored on a Forgejo instance managed by us. Escrow access is granted to designated agents (your organisation and, where applicable, a nominated third party).

Escrow data is stored separately from the main platform databases. Access is controlled by per-user credentials issued through the platform.

The escrow feature does not constitute a legal escrow agreement. If you require a formal escrow arrangement with legal enforceability, you should engage a specialist escrow provider.

---

## 9. Intellectual property

### 9.1 Our IP

CRANIS2, its design, code, documentation, AI prompt configurations, compliance frameworks, and branding are the intellectual property of Loman Cavendish Limited. Nothing in these terms grants you any rights to our intellectual property beyond the right to use the platform as a subscriber.

### 9.2 Feedback

If you provide us with feedback, suggestions, or feature requests, you grant us a non-exclusive, royalty-free, perpetual licence to use that feedback to improve the platform. We will not publicly attribute feedback to you without your permission.

---

## 10. Availability and support

### 10.1 Availability

We aim to maintain high availability but do not guarantee uninterrupted service. Planned maintenance will be announced in advance where possible. Unplanned outages will be communicated through the platform or by email.

### 10.2 Support

Support is provided by email at info@lomancavendish.com. We will respond to enquiries within a reasonable timeframe. During the beta period, support capacity may be limited.

---

## 11. Limitation of liability

To the maximum extent permitted by law:

We provide the platform "as is" and "as available" without warranties of any kind, whether express or implied, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement.

We are not liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the platform. This includes loss of profits, data, business opportunity, or goodwill.

Our total aggregate liability for any claims arising from these terms or your use of the platform is limited to the amount you have paid us in the 12 months preceding the claim.

Nothing in these terms excludes or limits liability for death or personal injury caused by negligence, fraud or fraudulent misrepresentation, or any other liability that cannot be excluded or limited by law.

---

## 12. Indemnification

You agree to indemnify and hold harmless Loman Cavendish Limited from any claims, damages, losses, or expenses (including legal fees) arising from your use of the platform, your violation of these terms, or your infringement of any third-party rights.

---

## 13. Termination

### 13.1 By you

You may close your account at any time by contacting info@lomancavendish.com. If you have an active subscription, cancellation terms in section 4.3 apply.

### 13.2 By us

We may suspend or terminate your account if you breach these terms, if your account shows no activity for 12 consecutive months, or if we discontinue the service. Where possible, we will give 30 days' notice before termination.

### 13.3 Effect of termination

On termination, your access to the platform ceases. We will retain your data in accordance with the retention periods described in our Privacy Policy. You may request a data export before termination.

---

## 14. Changes to these terms

We may update these terms from time to time. When we make material changes, we will notify you by email or through the platform at least 30 days before the changes take effect.

Your continued use of the platform after the effective date of updated terms constitutes acceptance of those terms. If you do not agree to the updated terms, you should stop using the platform and close your account.

---

## 15. Governing law

These terms are governed by the laws of England and Wales. Any disputes arising from these terms or your use of the platform are subject to the exclusive jurisdiction of the courts of England and Wales.

---

## 16. Severability

If any provision of these terms is found to be unenforceable, the remaining provisions continue in full force and effect.

---

## 17. Entire agreement

These terms, together with the Privacy Policy, constitute the entire agreement between you and Loman Cavendish Limited regarding your use of CRANIS2. They supersede any prior agreements or understandings.

---

## 18. Contact

For questions about these terms, contact us at:

Loman Cavendish Limited
Unit 32 St. Asaph Business Park
St. Asaph, Wales
LL17 0JA

Email: info@lomancavendish.com

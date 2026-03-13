export const CVD_POLICY_TEMPLATE = `> **INSTRUCTIONS – DELETE THIS SECTION BEFORE FINALISING**
>
> This is a template document provided by CRANIS2 to help you meet your
> obligations under EU Cyber Resilience Act Article 13(6).
>
> **How to use this template:**
> 1. Replace all placeholder values (marked with \`{{PLACEHOLDER}}\`) with
>    your product-specific details
> 2. Review and adapt each section to match your actual disclosure process
> 3. Publish this policy on your public-facing website or security page
> 4. Have the document reviewed and approved by your Security Lead
>
> **Where to store the completed document:**
> Once finalised, paste the content into your product's **Tech File** in
> CRANIS2 under the **Art. 13 – Security Properties** section. The policy
> should also be published at a publicly accessible URL.

---

# Coordinated Vulnerability Disclosure Policy

**Document Owner:** {{SECURITY_CONTACT}}
**Applicable Product:** {{PRODUCT_NAME}}
**Organisation:** {{ORG_NAME}}
**CRA Reference:** Article 13(6) – Coordinated vulnerability disclosure
**Standard Alignment:** ISO/IEC 29147:2018
**Effective Date:** {{EFFECTIVE_DATE}}
**Review Cycle:** Annually, or upon significant change to the handling process

---

## 1. Purpose

This policy describes how {{ORG_NAME}} receives, handles, and discloses security vulnerabilities reported by external parties in {{PRODUCT_NAME}}. It satisfies the requirement under EU Cyber Resilience Act Article 13(6) that manufacturers maintain a documented and accessible coordinated vulnerability disclosure (CVD) process.

---

## 2. Scope

This policy applies to:

- All versions of {{PRODUCT_NAME}} currently within the support period
- All components, dependencies, and services that form part of the product
- Reports received from security researchers, users, partners, and automated tools

---

## 3. Reporting a Vulnerability

### 3.1 Reporting Channels

| Channel | Details |
|---|---|
| **Email** | security@[REVIEW: your-domain.com] |
| **Web form** | [REVIEW: URL to your security reporting page] |
| **PGP key** | [REVIEW: PGP key fingerprint or link to public key] |

> **Note:** At least one channel must be available 24/7.

### 3.2 What to Include

Please include in your report:

- Description of the vulnerability
- Steps to reproduce (proof of concept if possible)
- Affected product version(s)
- Potential impact assessment
- Your contact details for follow-up (optional but recommended)

### 3.3 Encryption

We strongly encourage encrypting vulnerability reports using our PGP key.

---

## 4. Handling Process

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│  1. RECEIPT                                                      │
│     Report received via designated channel                       │
│     Acknowledgement sent within 72 hours                         │
│                           │                                      │
│  2. TRIAGE                ▼                                      │
│     Report logged in CRANIS2. AI-assisted triage assigns an      │
│     initial severity and recommended disposition. The security   │
│     team reviews and confirms the classification before          │
│     proceeding. No automated action is taken without human       │
│     approval.                                                    │
│                           │                                      │
│  3. INVESTIGATION         ▼                                      │
│     Root cause analysis and impact assessment                    │
│     Affected versions and components identified                  │
│                           │                                      │
│  4. REMEDIATION           ▼                                      │
│     Fix developed, tested, and verified                          │
│     CRANIS2 MCP tools provide ecosystem-specific mitigation      │
│     commands for developer remediation; fixes are reviewed and   │
│     approved by the security team before deployment.             │
│                           │                                      │
│  5. DISCLOSURE            ▼                                      │
│     Coordinated with reporter on disclosure timeline             │
│     Security advisory published                                  │
│     ENISA notified if required under Article 14                  │
│                           │                                      │
│  6. CLOSE-OUT             ▼                                      │
│     Reporter notified of resolution                              │
│     Evidence archived in compliance record                       │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

---

## 5. Response Timelines

| Milestone | Target |
|---|---|
| Acknowledgement of receipt | Within 72 hours |
| Initial triage and severity assessment | Within 5 working days |
| Status update to reporter | At least every 14 days |
| Fix development and testing | Severity-dependent (see below) |
| Coordinated disclosure | Within 90 days of report, unless mutually extended |

### Severity-Based Remediation Targets

| Severity | Fix deployment target |
|---|---|
| Critical (CVSS ≥ 9.0) | Within 24 hours of fix validation |
| High (CVSS 7.0–8.9) | Within 72 hours of fix validation |
| Medium (CVSS 4.0–6.9) | Within 30 days |
| Low (CVSS < 4.0) | Next scheduled release |

---

## 6. Safe Harbour

{{ORG_NAME}} commits to the following for good-faith security researchers:

- **No legal action** – We will not pursue legal action against researchers who report vulnerabilities in accordance with this policy
- **No negative consequences** – Researchers who act in good faith will not be subject to penalties
- **Good faith defined** – Avoiding privacy violations, data destruction, and service disruption; not accessing or modifying other users' data; providing reasonable time to remediate before disclosure

---

## 7. Recognition

We value the contribution of security researchers. With the reporter's consent:

- Reporters are credited in security advisories
- Reporters are listed on our [REVIEW: security acknowledgements page or hall of fame]
- [REVIEW: describe any bug bounty programme if applicable, or state "{{ORG_NAME}} does not currently operate a bug bounty programme"]

---

## 8. ENISA Notification

Where a reported vulnerability meets the criteria in CRA Article 14 (actively exploited vulnerability or severe incident), {{ORG_NAME}} will notify ENISA through the designated single reporting platform within the required timelines:

- **Early warning:** Within 24 hours of becoming aware
- **Vulnerability notification:** Within 72 hours
- **Final report:** Within 14 days of remediation

CRANIS2's AI incident report drafter assists in generating the required notification content, grounded in product data and linked findings. The incident lead reviews, edits, and explicitly approves all content before submission.

---

## 9. Contact

For any questions about this policy, contact: {{SECURITY_CONTACT}}

---

## Revision History

| Date | Author | Summary |
|---|---|---|
| {{EFFECTIVE_DATE}} | | Initial version – establishes CVD process aligned with ISO 29147 and CRA Art. 13(6) |
`;

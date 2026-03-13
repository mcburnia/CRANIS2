export const END_OF_SUPPORT_TEMPLATE = `> **INSTRUCTIONS – DELETE THIS SECTION BEFORE FINALISING**
>
> This is a template document provided by CRANIS2 to help you meet your
> obligations under EU Cyber Resilience Act Article 13(15).
>
> **How to use this template:**
> 1. Replace all placeholder values (marked with \`{{PLACEHOLDER}}\`) with
>    your product-specific details
> 2. Review and adapt each section to match your actual support lifecycle
> 3. Have the document reviewed and approved by your Product Owner and
>    Compliance Officer
>
> **Where to store the completed document:**
> Once finalised, paste the content into your product's **Tech File** in
> CRANIS2 under the **Art. 13 – Support & Maintenance** section.

---

# End-of-Support Policy

**Document Owner:** {{TECHNICAL_FILE_OWNER}}
**Applicable Product:** {{PRODUCT_NAME}}
**Organisation:** {{ORG_NAME}}
**CRA Reference:** Article 13(15) – Support period and end-of-support obligations
**Effective Date:** {{EFFECTIVE_DATE}}
**Review Cycle:** Annually, or upon change to the support period

---

## 1. Purpose

This policy defines the support period for {{PRODUCT_NAME}}, the obligations that apply during that period, the process for winding down support, and the notification procedures for users. It satisfies the requirements under CRA Article 13(15) that manufacturers clearly communicate the expected support period and ensure users are informed when support ends.

---

## 2. Support Period

### 2.1 Commitment

{{ORG_NAME}} commits to providing security updates and vulnerability handling for {{PRODUCT_NAME}} for a minimum period of:

**[REVIEW: specify support period, e.g. "5 years from the date of market placement" or "until 31 December 2031"]**

This period is proportionate to the expected product lifetime and reflects the requirements of CRA Article 13(8).

### 2.2 CRA Minimum

The CRA requires that the support period is at least 5 years, unless the expected product lifetime is shorter. The support period must be clearly stated at the time of market placement.

### 2.3 Support Period Tracking

CRANIS2 tracks the support period expiry date and automatically sends alerts at **90, 60, 30, 7, and 0 days** before the end-of-support date. These alerts are delivered to all designated compliance stakeholders via email and in-app notifications.

The obligation engine automatically derives support-period-dependent obligations (Articles 13(7) and 13(8)) and adjusts compliance status accordingly.

---

## 3. Obligations During the Support Period

During the support period, {{ORG_NAME}} commits to:

| Obligation | CRA Reference | Description |
|---|---|---|
| Security updates | Art. 13(8) | Free-of-charge security updates for all identified vulnerabilities |
| Vulnerability handling | Art. 13(5) | Effective handling of all reported and detected vulnerabilities |
| SBOM maintenance | Art. 13(5) | Up-to-date Software Bill of Materials |
| ENISA reporting | Art. 14 | Notification of actively exploited vulnerabilities |
| User communication | Art. 13(15) | Transparent communication about security status |
| CVD process | Art. 13(6) | Active coordinated vulnerability disclosure channel |

---

## 4. End-of-Support Procedure

### 4.1 Decision Process

The decision to end support is made by [REVIEW: e.g. the Product Owner in consultation with the Compliance Officer] and must consider:

- Remaining user base size
- Availability of successor products or migration paths
- Outstanding vulnerability obligations
- Regulatory requirements

### 4.2 Wind-Down Timeline

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│  12 MONTHS BEFORE END-OF-SUPPORT                                 │
│  • Public announcement of end-of-support date                    │
│  • Migration guidance published                                  │
│  • Users notified via all communication channels                 │
│                           │                                      │
│  6 MONTHS BEFORE          ▼                                      │
│  • Reminder notifications sent                                   │
│  • Migration support offered                                     │
│  • Final feature release (if applicable)                         │
│                           │                                      │
│  3 MONTHS BEFORE          ▼                                      │
│  • Final reminder notifications                                  │
│  • Support team prepares for transition                           │
│  • Knowledge base updated with end-of-support FAQ                │
│                           │                                      │
│  END-OF-SUPPORT DATE      ▼                                      │
│  • Security update obligation ends                                │
│  • Product status changed to "End of Life" in CRANIS2            │
│  • Final security advisory published                              │
│  • CVD channel remains active for 6 months post-support          │
│                           │                                      │
│  6 MONTHS AFTER           ▼                                      │
│  • CVD channel closed                                             │
│  • Final compliance evidence archived                             │
│  • End-of-support process formally concluded                      │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

---

## 5. User Notification

### 5.1 Communication Channels

| Channel | Timing | Content |
|---|---|---|
| Email notification | 12, 6, 3, 1 month(s) before | End-of-support date, migration options, impact |
| In-app notification | 12, 6, 3, 1 month(s) before | End-of-support banner with action items |
| Product documentation | 12 months before | End-of-support FAQ and migration guide |
| Security advisory page | On end-of-support date | Final advisory stating support has ended |

### 5.2 CRANIS2 Automated Alerts

CRANIS2 automatically sends alerts to designated stakeholders at 90, 60, 30, 7, and 0 days before the end-of-support date. These alerts ensure that no end-of-support milestone is missed and provide time to complete the wind-down procedure.

---

## 6. Post-Support Responsibilities

After the support period ends:

| Responsibility | Duration | Description |
|---|---|---|
| CVD channel | 6 months post-support | Accept and acknowledge vulnerability reports, but no obligation to fix |
| Evidence retention | 10 years | Maintain all compliance evidence, ENISA notifications, and audit trail |
| Public notice | Indefinite | Product marked as "End of Life" with clear notice that security updates are no longer provided |
| SBOM availability | 10 years | Final SBOM remains available for audit purposes |

---

## 7. Successor Products

Where {{ORG_NAME}} offers a successor product, the end-of-support notification includes:

- Name and version of the successor product
- Migration path and instructions
- Any data migration tools or assistance available
- Timeline for migration support
- Whether the successor product's support period covers the same use cases

---

## 8. Evidence & Audit Trail

| Artefact | Retention |
|---|---|
| Support period declaration | Minimum 10 years |
| User notification records | Minimum 10 years |
| End-of-support announcement | Minimum 10 years |
| Final SBOM | Minimum 10 years |
| Migration guidance documentation | Minimum 5 years |

---

## 9. Roles & Responsibilities

| Role | Responsibility |
|---|---|
| **Product Owner** ({{TECHNICAL_FILE_OWNER}}) | Owns the end-of-support decision; approves timeline and communications |
| **Security Lead** ({{SECURITY_CONTACT}}) | Manages final vulnerability assessments; oversees post-support CVD channel |
| **Engineering Team** ({{MANUFACTURER_CONTACT}}) | Delivers final security updates; supports migration |
| **Compliance Officer** ({{COMPLIANCE_OFFICER}}) | Ensures regulatory compliance throughout wind-down; archives evidence |

---

## Revision History

| Date | Author | Summary |
|---|---|---|
| {{EFFECTIVE_DATE}} | | Initial version – establishes end-of-support policy for CRA Art. 13(15) compliance |
`;

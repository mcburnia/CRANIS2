export const SECURITY_UPDATE_TEMPLATE = `> **INSTRUCTIONS — DELETE THIS SECTION BEFORE FINALISING**
>
> This is a template document provided by CRANIS2 to help you meet your
> obligations under EU Cyber Resilience Act Article 13(8).
>
> **How to use this template:**
> 1. Replace all placeholder values (marked with \`{{PLACEHOLDER}}\`) with
>    your product-specific details
> 2. Review and adapt each section to match your actual update process
> 3. Have the document reviewed and approved by your Product Owner and
>    Engineering Lead
>
> **Where to store the completed document:**
> Once finalised, paste the content into your product's **Tech File** in
> CRANIS2 under the **Art. 13 — Security Properties** section.

---

# Security Update Procedure

**Document Owner:** {{TECHNICAL_FILE_OWNER}}
**Applicable Product:** {{PRODUCT_NAME}}
**Organisation:** {{ORG_NAME}}
**CRA Reference:** Article 13(8) — Security updates provided free of charge
**Effective Date:** {{EFFECTIVE_DATE}}
**Review Cycle:** Annually, or upon significant change to the update process

---

## 1. Purpose

This procedure defines how {{ORG_NAME}} develops, tests, deploys, and communicates security updates for {{PRODUCT_NAME}}. It satisfies the requirements under EU Cyber Resilience Act Article 13(8) that manufacturers provide security updates without delay and free of charge for the duration of the support period.

---

## 2. Scope

This procedure applies to:

- All security updates for {{PRODUCT_NAME}} during the support period
- All update delivery channels (automatic, manual, package registry)
- All personnel involved in developing, approving, and deploying security updates

---

## 3. Free-of-Charge Requirement

In accordance with CRA Article 13(8), {{ORG_NAME}} commits that:

- All security updates for {{PRODUCT_NAME}} are provided **free of charge** to all users
- Security updates are **never** bundled behind paid upgrades, premium tiers, or service contracts
- Users are **never** required to purchase a new version or subscription to receive security fixes
- This commitment applies for the entire duration of the support period (see End-of-Support Policy)

---

## 4. Update Types

| Type | Description | Delivery |
|---|---|---|
| **Security-only update** | Contains exclusively vulnerability fixes. No feature changes. | Priority deployment — severity-based timeline |
| **Dependency update** | Upgrades third-party components to address known CVEs | Included in security-only updates or scheduled releases |
| **Configuration update** | Security-relevant configuration changes | Documented and communicated with update instructions |
| **Emergency hotfix** | Critical/actively exploited vulnerability requiring immediate response | Expedited deployment within 24 hours |

---

## 5. Development Process

### 5.1 Trigger

A security update is initiated when:

- A vulnerability is triaged and confirmed for remediation (per the Vulnerability Handling Process)
- A dependency advisory recommends immediate update
- A penetration test or audit finding requires a code change

### 5.2 Workflow

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│  1. FINDING CONFIRMED                                            │
│     Vulnerability triaged and assigned for remediation            │
│                           │                                      │
│  2. FIX DEVELOPMENT       ▼                                      │
│     Security branch created from production baseline              │
│     CRANIS2 MCP tools suggest ecosystem-specific mitigation       │
│     commands in the developer's IDE. Developer reviews and        │
│     applies the appropriate fix.                                  │
│                           │                                      │
│  3. TESTING               ▼                                      │
│     Security-focused code review                                  │
│     Full regression test suite                                    │
│     CRANIS2 CI/CD compliance gate validates readiness             │
│                           │                                      │
│  4. APPROVAL              ▼                                      │
│     Security Lead confirms fix completeness                       │
│     Product Owner approves release classification                 │
│                           │                                      │
│  5. DEPLOYMENT             ▼                                      │
│     Update published to distribution channel                      │
│     SBOM regenerated automatically by CRANIS2                     │
│                           │                                      │
│  6. VERIFICATION           ▼                                      │
│     CRANIS2 MCP verify_fix triggers SBOM rescan and confirms      │
│     the vulnerability is resolved. A team member reviews the      │
│     verification result before closing the finding.               │
│                           │                                      │
│  7. COMMUNICATION          ▼                                      │
│     Security advisory published                                   │
│     Users notified via designated channels                        │
│     ENISA notified if required under Article 14                   │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

---

## 6. Testing Requirements

Every security update must pass:

| Test | Purpose |
|---|---|
| Unit tests | Verify the fix addresses the vulnerability |
| Regression suite | Confirm no functional breakage |
| Integration tests | Validate component interactions |
| SBOM validation | Confirm dependency changes are reflected |
| CI/CD compliance gate | Verify CRA readiness threshold is met |

---

## 7. Deployment Timelines

| Severity | Target deployment |
|---|---|
| Critical (CVSS ≥ 9.0) or actively exploited | Within 24 hours of fix validation |
| High (CVSS 7.0–8.9) | Within 72 hours of fix validation |
| Medium (CVSS 4.0–6.9) | Within 30 days |
| Low (CVSS < 4.0) | Next scheduled release |

---

## 8. User Communication

### 8.1 Notification

Users are notified of security updates through:

| Channel | Content |
|---|---|
| Security advisory | CVE IDs, severity, affected versions, fix version, upgrade instructions |
| Release notes | [SECURITY] tag, plain-language summary |
| Email / in-app notification | Critical and High severity updates |
| Changelog | All security updates with dedicated section |

### 8.2 Update Instructions

Every security update includes clear instructions for users to apply the update. For dependency updates, CRANIS2 provides ecosystem-specific commands (e.g. \`npm update\`, \`pip install --upgrade\`).

---

## 9. Evidence & Audit Trail

| Artefact | Retention |
|---|---|
| Security update release record | Minimum 10 years |
| Test results | Minimum 5 years |
| User notification records | Minimum 10 years |
| SBOM before/after update | Minimum 10 years |
| ENISA notification (if applicable) | Minimum 10 years |

---

## 10. Roles & Responsibilities

| Role | Responsibility |
|---|---|
| **Product Owner** ({{TECHNICAL_FILE_OWNER}}) | Approves release classification; owns deployment decision |
| **Security Lead** ({{SECURITY_CONTACT}}) | Confirms fix completeness; reviews verification results |
| **Engineering Team** ({{MANUFACTURER_CONTACT}}) | Develops and tests fixes; applies CRANIS2 mitigation suggestions after review |
| **Compliance Officer** ({{COMPLIANCE_OFFICER}}) | Verifies free-of-charge provision; maintains evidence |

---

## Revision History

| Date | Author | Summary |
|---|---|---|
| {{EFFECTIVE_DATE}} | | Initial version — establishes security update procedure for CRA Art. 13(8) compliance |
`;

/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

export const VERSIONING_POLICY_TEMPLATE = `> **INSTRUCTIONS – DELETE THIS SECTION BEFORE FINALISING**
>
> This is a template document provided by CRANIS2 to help you meet your
> obligations under EU Cyber Resilience Act Article 13(9).
>
> **How to use this template:**
> 1. Replace all placeholder values (marked with \`{{PLACEHOLDER}}\`) with
>    your product-specific details
> 2. Review and adapt each section to match your actual release process
> 3. Remove or modify any sections that do not apply to your delivery model
> 4. Have the document reviewed and approved by your Product Owner and
>    Security Lead
>
> **Where to store the completed document:**
> Once finalised, paste the content into your product's **Tech File** in
> CRANIS2 under the **Art. 13 – Security Properties** section. This
> ensures it is included in your CRA compliance evidence package and
> linked to your product's compliance status.
>
> The completed document should also be retained in your internal document
> management system as a controlled policy document.
>
> **Placeholders in this template:**
> - \`{{PRODUCT_NAME}}\` – Your product's name
> - \`{{ORG_NAME}}\` – Your organisation's name
> - \`{{EFFECTIVE_DATE}}\` – The date this policy takes effect
> - \`{{VERSION_FORMAT}}\` – Your versioning scheme (e.g. SemVer, date-based, CalVer)
> - \`{{SECURITY_SUFFIX}}\` – The suffix you use for security-only releases (e.g. -sec1, .patch1)
> - \`{{DELIVERY_MODEL}}\` – SaaS, on-premises, hybrid, embedded, etc.

---

# Versioning & Security Release Policy

**Document Owner:** Product & Engineering Lead
**Applicable Product:** {{PRODUCT_NAME}}
**Organisation:** {{ORG_NAME}}
**CRA Reference:** Article 13(9) – Separation of security and functionality updates
**Effective Date:** {{EFFECTIVE_DATE}}
**Review Cycle:** Annually, or upon significant change to the release process

---

## 1. Purpose

This policy defines how {{ORG_NAME}} distinguishes security updates from feature updates for {{PRODUCT_NAME}}, ensuring that security patches can be developed, tested, and deployed independently of functionality changes. It satisfies the requirement under EU Cyber Resilience Act Article 13(9) that manufacturers provide security updates separately from functionality updates where technically feasible.

---

## 2. Scope

This policy applies to:

- All production releases of {{PRODUCT_NAME}} (all components and services)
- All personnel involved in development, review, and deployment
- All dependencies managed within the Software Bill of Materials (SBOM)

---

## 3. Versioning Scheme

### 3.1 Format

{{PRODUCT_NAME}} uses the following versioning scheme:

\`\`\`
{{VERSION_FORMAT}}[{{SECURITY_SUFFIX}}]
\`\`\`

| Segment | Meaning |
|---|---|
| \`{{VERSION_FORMAT}}\` | Standard version identifier for the release |
| \`{{SECURITY_SUFFIX}}\` | **Security-only release suffix**. Present only when the release contains exclusively security fixes. |

### 3.2 Examples

| Version | Classification |
|---|---|
| \`1.2.0\` | Feature release (may include non-critical security improvements alongside features) |
| \`1.2.0{{SECURITY_SUFFIX}}\` | Security-only release – contains only vulnerability fixes |
| \`1.3.0\` | Feature release |
| \`1.3.0{{SECURITY_SUFFIX}}\` | Security hotfix issued against the \`1.3.0\` baseline |

> **Note:** Update the examples above to match your actual versioning scheme.

### 3.3 Classification Rules

Every release MUST be classified as one of the following:

| Classification | Definition | Version suffix |
|---|---|---|
| **Security-only** | Contains exclusively security fixes (vulnerability patches, dependency upgrades addressing CVEs, security configuration changes). No new features, no behavioural changes. | \`{{SECURITY_SUFFIX}}\` |
| **Feature** | Contains new functionality, enhancements, refactoring, or non-security bug fixes. May include minor security hardening that does not address a known vulnerability. | No suffix |
| **Mixed** | Contains both security fixes and feature changes. Mixed releases should be avoided where possible. When unavoidable, the security fixes MUST be documented separately in the release notes and the release MUST be preceded or accompanied by a security-only release containing the same fixes. | No suffix (but release notes must itemise security content) |

The **Product Owner** is responsible for classifying each release before deployment.

---

## 4. Security Release Procedure

### 4.1 Trigger

A security-only release is triggered when any of the following occur:

- A vulnerability rated **Critical** or **High** (CVSS ≥ 7.0) is identified in {{PRODUCT_NAME}} code or its dependencies
- A vulnerability rated **Medium** (CVSS 4.0–6.9) that is actively exploited or has a public exploit available
- A security advisory from a dependency maintainer recommends immediate update
- A penetration test or security audit identifies a finding requiring remediation

### 4.2 Process

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│  1. IDENTIFICATION                                              │
│     Vulnerability detected (scanner, advisory, audit, report)   │
│                           │                                     │
│  2. TRIAGE                ▼                                     │
│     Classify severity, assess exploitability, determine scope   │
│                           │                                     │
│  3. ISOLATION             ▼                                     │
│     Create hotfix branch from current production baseline       │
│     Cherry-pick or develop ONLY the security fix                │
│     No feature code included                                    │
│                           │                                     │
│  4. REVIEW & TEST         ▼                                     │
│     Code review (security-focused)                              │
│     Run full regression suite                                   │
│     Verify fix resolves the vulnerability                       │
│     Verify no functional regressions introduced                 │
│                           │                                     │
│  5. CLASSIFICATION        ▼                                     │
│     Product Owner confirms security-only classification         │
│     Version tagged with security suffix                         │
│                           │                                     │
│  6. DEPLOYMENT            ▼                                     │
│     Deploy to production via standard pipeline                  │
│     SBOM regenerated automatically                              │
│                           │                                     │
│  7. COMMUNICATION         ▼                                     │
│     Release notes published (see Section 5)                     │
│     Affected users notified                                     │
│     Changelog updated                                           │
│                           │                                     │
│  8. EVIDENCE              ▼                                     │
│     Commit history, test results, and classification archived   │
│     Vulnerability status updated in tracker                     │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

### 4.3 Timelines

| Severity | Target fix deployment |
|---|---|
| Critical (CVSS ≥ 9.0) | Within 24 hours of confirmation |
| High (CVSS 7.0–8.9) | Within 72 hours of confirmation |
| Medium (CVSS 4.0–6.9, actively exploited) | Within 5 working days |
| Medium (CVSS 4.0–6.9, no known exploit) | Next scheduled release or within 30 days |
| Low (CVSS < 4.0) | Next scheduled release |

### 4.4 Independence from feature work

Security-only releases:

- **MUST NOT** include any feature changes, refactoring, or non-security bug fixes
- **MUST NOT** require users to accept new terms, configurations, or behavioural changes
- **MUST** be deployable independently of any in-progress feature work
- **MUST** be tested against the current production baseline, not a development branch

### 4.5 Branching Strategy

{{PRODUCT_NAME}} follows a branching model with a dedicated security hotfix lane. The \`main\` branch always represents the current production state.

\`\`\`
main (always = production, always deployable)
  │
  ├── feature/new-feature-name         ← new work, branched from main
  ├── feature/another-feature          ← new work, branched from main
  │
  └── sec/CVE-2026-XXXX               ← security fix, branched from main
        fix → test → merge back to main  ← deployed independently of features
        then merged forward into open feature branches
\`\`\`

#### Feature branches

1. Branch from \`main\` when starting new feature work
2. Develop and test on the feature branch
3. Merge back to \`main\` via pull request when the feature is complete, reviewed, and approved
4. Tag \`main\` with a standard version
5. Deploy from \`main\`

#### Security fix branches

1. Branch from \`main\` (the live production baseline). Name the branch \`sec/<CVE-ID>\` or \`sec/<finding-ref>\`
2. Apply **only** the security fix: no feature code, no refactoring, no unrelated changes
3. Test against the production baseline (full regression suite)
4. Merge back to \`main\` via pull request with security-focused review
5. Tag \`main\` with the security suffix (e.g. \`1.2.0{{SECURITY_SUFFIX}}\`)
6. Deploy immediately from \`main\`
7. Merge \`main\` forward into all open feature branches so they inherit the fix

#### Key principles

- **\`main\` is always deployable** – it represents exactly what is live in production
- **Security fixes never wait for feature work** – they are branched from and merged back to \`main\` independently
- **Feature branches never block security releases** – the security lane operates in parallel
- **Feature branches stay current** – after every security merge to \`main\`, open feature branches rebase or merge from \`main\` to pick up the fix
- **No mixed merges** – a security branch must not include feature commits, and vice versa

---

## 5. User Communication & Transparency

### 5.1 Release notes

Every release MUST include release notes that clearly state:

- The **classification** (Security-only, Feature, or Mixed)
- For security-only releases: the CVE identifiers or internal finding references addressed
- A plain-language summary of what was fixed and why it matters
- Whether any user action is required

### 5.2 Security update labelling

Security-only releases are identified through:

- The \`{{SECURITY_SUFFIX}}\` version suffix
- A **[SECURITY]** tag in the release notes title
- A distinct visual indicator in any update notification or changelog
- Separate grouping in the changelog (security fixes listed before feature changes)

### 5.3 Notification channels

| Channel | Used for |
|---|---|
| In-app notification / email | All security-only releases |
| Direct notification to administrators | Critical and High severity security releases |
| Changelog / release notes page | All releases |
| Status page | Releases addressing actively exploited vulnerabilities |

> **Note:** Adapt the channels above to match your actual notification infrastructure.

### 5.4 Delivery model considerations

> **Note:** Complete this section based on your delivery model ({{DELIVERY_MODEL}}).

**For SaaS products:**
Users do not manually apply updates; all releases are deployed centrally. This means users are never forced to accept feature changes in order to receive a security fix, and they are always on the latest secure version.

**For on-premises / distributed products:**
Security-only releases are published to the same distribution channel as feature releases but are clearly labelled. Users can apply security patches without upgrading to the latest feature release. Update instructions specify the minimum steps required for the security fix only.

---

## 6. Roles & Responsibilities

| Role | Responsibility |
|---|---|
| **Product Owner** | Classifies each release; approves mixed releases (exceptional cases only) |
| **Security Lead** | Triages vulnerabilities; validates fix completeness; reviews security-only releases |
| **Engineering Team** | Develops fixes on isolated branches; ensures no feature code in security releases |
| **Operations** | Deploys releases; monitors post-deployment health; triggers rollback if needed |
| **Compliance Officer** | Verifies this policy is followed; maintains evidence for CRA technical file |

> **Note:** Adapt the roles above to match your actual team structure.

---

## 7. Evidence & Audit Trail

The following artefacts are retained for each security-only release as evidence of Art. 13(9) compliance:

| Artefact | Retention |
|---|---|
| Git commit history (isolated hotfix branch) | Indefinite (version control) |
| Release classification record | Minimum 10 years (CRA support period) |
| Release notes with [SECURITY] tag | Minimum 10 years |
| Test results (regression suite) | Minimum 5 years |
| Vulnerability tracker status change | Indefinite (platform database) |
| SBOM diff (before/after) | Minimum 10 years |
| Deployment log | Minimum 5 years |

---

## 8. Policy on Mixed Releases

Mixed releases (containing both security fixes and feature changes) are **strongly discouraged**. When a mixed release is unavoidable:

1. The security fixes MUST also be available as a standalone security-only release (deployed first or concurrently)
2. The release notes MUST separately itemise all security fixes under a dedicated **Security** section
3. The Product Owner MUST document the justification for combining the changes
4. The justification is retained as part of the compliance evidence

---

## 9. Exceptions

Any deviation from this policy requires:

- Written approval from the Product Owner and Security Lead
- A documented justification explaining why the deviation was necessary
- A remediation plan to return to standard process
- Recording in the compliance evidence archive

---

## 10. Review & Revision

This policy is reviewed:

- **Annually** as part of the regular compliance review cycle
- **Upon significant change** to the release pipeline, deployment architecture, or delivery model
- **Upon regulatory guidance** from ENISA or national authorities clarifying Art. 13(9) expectations

All revisions are tracked with date, author, and summary of changes.

---

## Revision History

| Date | Author | Summary |
|---|---|---|
| {{EFFECTIVE_DATE}} | | Initial version – establishes versioning scheme, security release process, and Art. 13(9) evidence framework |
`;

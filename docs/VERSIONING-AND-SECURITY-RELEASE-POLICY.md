<!--
  Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi@mcburnie.com
-->

# Versioning & Security Release Policy

**Document Owner:** Product & Engineering Lead
**Applicable Product:** CRANIS2 – EU Cyber Resilience Act Compliance Platform
**CRA Reference:** Article 13(9) – Separation of security and functionality updates
**Effective Date:** 2026-03-08
**Review Cycle:** Annually, or upon significant change to the release process

---

## 1. Purpose

This policy defines how CRANIS2 distinguishes security updates from feature updates, ensuring that security patches can be developed, tested, and deployed independently of functionality changes. It satisfies the requirement under EU Cyber Resilience Act Article 13(9) that manufacturers provide security updates separately from functionality updates where technically feasible.

---

## 2. Scope

This policy applies to:

- All production releases of the CRANIS2 platform (backend, frontend, infrastructure)
- All personnel involved in development, review, and deployment
- All dependencies managed within the Software Bill of Materials (SBOM)

---

## 3. Versioning Scheme

### 3.1 Format

CRANIS2 uses a **date-based versioning scheme** with the following structure:

```
YYYY.MM.DD.NNNN[-secN]
```

| Segment | Meaning |
|---|---|
| `YYYY.MM.DD` | Date of the release |
| `NNNN` | Sequential build number for that date (zero-padded, starting at `0001`) |
| `-secN` | **Security-only release suffix** (e.g. `-sec1`, `-sec2`). Present only when the release contains exclusively security fixes. |

### 3.2 Examples

| Version | Classification |
|---|---|
| `2026.03.08.0001` | Feature release (may include non-critical security improvements alongside features) |
| `2026.03.08.0002-sec1` | Security-only release containing only vulnerability fixes |
| `2026.03.09.0001` | Feature release |
| `2026.03.09.0001-sec1` | Security hotfix issued against the `2026.03.09.0001` baseline |

### 3.3 Classification Rules

Every release MUST be classified as one of the following:

| Classification | Definition | Version suffix |
|---|---|---|
| **Security-only** | Contains exclusively security fixes (vulnerability patches, dependency upgrades addressing CVEs, security configuration changes). No new features, no behavioural changes. | `-secN` |
| **Feature** | Contains new functionality, enhancements, refactoring, or non-security bug fixes. May include minor security hardening that does not address a known vulnerability. | No suffix |
| **Mixed** | Contains both security fixes and feature changes. Mixed releases should be avoided where possible. When unavoidable, the security fixes MUST be documented separately in the release notes and the release MUST be preceded or accompanied by a security-only release containing the same fixes. | No suffix (but release notes must itemise security content) |

The **Product Owner** is responsible for classifying each release before deployment.

---

## 4. Security Release Procedure

### 4.1 Trigger

A security-only release is triggered when any of the following occur:

- A vulnerability rated **Critical** or **High** (CVSS ≥ 7.0) is identified in CRANIS2 code or its dependencies
- A vulnerability rated **Medium** (CVSS 4.0–6.9) that is actively exploited or has a public exploit available
- A security advisory from a dependency maintainer recommends immediate update
- A penetration test or security audit identifies a finding requiring remediation

### 4.2 Process

```
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
│     Version tagged with -secN suffix                            │
│                           │                                     │
│  6. DEPLOYMENT            ▼                                     │
│     Deploy to production via standard pipeline                  │
│     SBOM regenerated automatically                              │
│                           │                                     │
│  7. COMMUNICATION         ▼                                     │
│     Release notes published (see Section 5)                     │
│     Affected users notified via in-app notification             │
│     Changelog updated                                           │
│                           │                                     │
│  8. EVIDENCE              ▼                                     │
│     Commit history, test results, and classification archived   │
│     Vulnerability status updated in CRANIS2 tracker             │
└─────────────────────────────────────────────────────────────────┘
```

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

CRANIS2 follows a **GitHub Flow model with a dedicated security hotfix lane**. The `main` branch always represents the current production state.

```
main (always = production, always deployable)
  │
  ├── feature/supplier-enrichment-v2     ← new work, branched from main
  ├── feature/grc-bridge                 ← new work, branched from main
  │
  └── sec/CVE-2026-XXXX                  ← security fix, branched from main
        fix → test → merge back to main  ← deployed independently of features
        then merged forward into open feature branches
```

#### Feature branches

1. Branch from `main` when starting new feature work
2. Develop and test on the feature branch
3. Merge back to `main` via pull request when the feature is complete, reviewed, and approved
4. Tag `main` with a standard version (e.g. `2026.03.10.0001`)
5. Deploy from `main`

#### Security fix branches

1. Branch from `main` (the live production baseline). Name the branch `sec/<CVE-ID>` or `sec/<finding-ref>`
2. Apply **only** the security fix. No feature code, no refactoring, no unrelated changes
3. Test against the production baseline (full regression suite)
4. Merge back to `main` via pull request with security-focused review
5. Tag `main` with the `-secN` suffix (e.g. `2026.03.10.0001-sec1`)
6. Deploy immediately from `main`
7. Merge `main` forward into all open feature branches so they inherit the fix

#### Key principles

- **`main` is always deployable.** It represents exactly what is live in production
- **Security fixes never wait for feature work.** They are branched from and merged back to `main` independently
- **Feature branches never block security releases.** The security lane operates in parallel
- **Feature branches stay current.** After every security merge to `main`, open feature branches rebase or merge from `main` to pick up the fix
- **No mixed merges.** A security branch must not include feature commits, and vice versa

---

## 5. User Communication & Transparency

### 5.1 Release notes

Every release MUST include release notes that clearly state:

- The **classification** (Security-only, Feature, or Mixed)
- For security-only releases: the CVE identifiers or internal finding references addressed
- A plain-language summary of what was fixed and why it matters
- Whether any user action is required (for SaaS: typically none)

### 5.2 Security update labelling

Security-only releases are identified through:

- The `-secN` version suffix
- A **[SECURITY]** tag in the release notes title
- A distinct visual indicator in any in-app update notification or changelog
- Separate grouping in the changelog (security fixes listed before feature changes)

### 5.3 Notification channels

| Channel | Used for |
|---|---|
| In-app notification bell | All security-only releases |
| Email alert (to organisation admins) | Critical and High severity security releases |
| Changelog page | All releases |
| Platform status page | Releases addressing actively exploited vulnerabilities |

### 5.4 SaaS deployment model

CRANIS2 is delivered as a Software-as-a-Service platform. Users do not manually apply updates; all releases are deployed centrally by the CRANIS2 operations team. This means:

- Users are **never forced to accept feature changes** in order to receive a security fix. Security-only releases are deployed independently
- Users are **always on the latest secure version.** There is no delay between release and user protection
- The separation obligation under Art. 13(9) is met by maintaining independent release pipelines and ensuring security fixes are never gated behind feature rollouts

---

## 6. Roles & Responsibilities

| Role | Responsibility |
|---|---|
| **Product Owner** | Classifies each release; approves mixed releases (exceptional cases only) |
| **Security Lead** | Triages vulnerabilities; validates fix completeness; reviews security-only releases |
| **Engineering Team** | Develops fixes on isolated branches; ensures no feature code in security releases |
| **Operations** | Deploys releases; monitors post-deployment health; triggers rollback if needed |
| **Compliance Officer** | Verifies this policy is followed; maintains evidence for CRA technical file |

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
| 2026-03-08 | Product & Engineering | Initial version. Establishes versioning scheme, security release process, and Art. 13(9) evidence framework |

/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

export const SECURE_DEV_LIFECYCLE_TEMPLATE = `> **INSTRUCTIONS – DELETE THIS SECTION BEFORE FINALISING**
>
> This is a template document provided by CRANIS2 to help you meet your
> obligations under EU Cyber Resilience Act Annex I, Part I.
>
> **How to use this template:**
> 1. Replace all placeholder values (marked with \`{{PLACEHOLDER}}\`) with
>    your product-specific details
> 2. Review and adapt each section to match your actual development process
> 3. Have the document reviewed and approved by your Engineering Lead and
>    Security Lead
>
> **Where to store the completed document:**
> Once finalised, paste the content into your product's **Tech File** in
> CRANIS2 under the **Annex I – Design & Development** section.

---

# Secure Development Lifecycle

**Document Owner:** {{MANUFACTURER_CONTACT}}
**Applicable Product:** {{PRODUCT_NAME}}
**Organisation:** {{ORG_NAME}}
**CRA Reference:** Annex I, Part I – Security requirements relating to properties of products with digital elements
**Effective Date:** {{EFFECTIVE_DATE}}
**Review Cycle:** Annually, or upon significant change to the development process

---

## 1. Purpose

This document describes how {{ORG_NAME}} integrates security throughout the development lifecycle of {{PRODUCT_NAME}}, from design through to deployment and maintenance. It demonstrates compliance with CRA Annex I, Part I, which requires that products with digital elements are designed, developed, and produced to ensure an appropriate level of cybersecurity.

---

## 2. Scope

This lifecycle applies to:

- All development activities for {{PRODUCT_NAME}}
- All contributors (internal employees and external contributors)
- All components (proprietary code, open-source dependencies, third-party libraries)
- All environments (development, staging, production)

---

## 3. Security by Design

### 3.1 Principles

{{PRODUCT_NAME}} is developed in accordance with the following security-by-design principles (CRA Annex I, Part I):

| Principle | Implementation |
|---|---|
| **Minimised attack surface** | Default-deny configurations; principle of least privilege; unnecessary services disabled |
| **Defence in depth** | Multiple security layers; input validation at every boundary |
| **Secure defaults** | Products ship with secure default configurations; users must opt in to reduce security |
| **Data protection** | Personal and sensitive data encrypted at rest and in transit; data minimisation |
| **Integrity protection** | Cryptographic verification of software updates and components |

### 3.2 Threat Modelling

Before significant feature development:

1. Identify assets, entry points, and trust boundaries
2. Enumerate threats using [REVIEW: methodology, e.g. STRIDE, PASTA]
3. Assess risk and define mitigations
4. Document in the product's technical file

CRANIS2's AI risk assessment generator can produce an initial threat analysis grounded in product data, CRA category, and known vulnerability patterns. **The security team reviews, validates, and refines the output before it is accepted as the basis for design decisions.**

---

## 4. CRA Category Classification

{{PRODUCT_NAME}} is classified under the CRA product category system, which determines the applicable conformity assessment route and essential requirements.

CRANIS2's AI category recommender assists in classifying products based on functionality, connectivity, data handling, and deployment attributes. **The recommendation is reviewed and confirmed by the compliance officer before it is applied. The AI provides a starting point, not a final decision.**

---

## 5. Secure Coding Standards

### 5.1 Coding Practices

All contributors must follow:

| Practice | Description |
|---|---|
| Input validation | Validate and sanitise all external inputs at system boundaries |
| Output encoding | Encode output to prevent injection attacks (XSS, SQL injection) |
| Authentication & authorisation | Use established frameworks; enforce least privilege |
| Cryptography | Use well-vetted libraries; no custom cryptographic implementations |
| Error handling | Never expose internal details in error messages; log securely |
| Secrets management | No credentials in code; use environment variables or secret stores |

### 5.2 Code Review

All code changes require peer review before merging, with security-critical changes requiring review by the Security Lead or a designated security reviewer.

---

## 6. Dependency Management

### 6.1 SBOM Management

CRANIS2 auto-generates and maintains the Software Bill of Materials for {{PRODUCT_NAME}} from repository data. The SBOM is:

- Updated automatically on every code push (via webhook integration)
- Scanned continuously against vulnerability databases
- Available for export in SPDX format for audit and supply chain transparency

### 6.2 Dependency Selection

Before adding a new dependency:

| Check | Purpose |
|---|---|
| Licence compatibility | CRANIS2 licence compliance scanning flags incompatible or high-risk licences |
| Maintenance status | Is the package actively maintained? Last release date, open issues |
| Known vulnerabilities | Current CVE count and severity |
| Transitive dependencies | Impact on overall supply chain complexity |

### 6.3 Dependency Updates

- **Security updates**: Applied immediately per the Security Update Procedure
- **Non-security updates**: Evaluated and applied on a [REVIEW: frequency, e.g. monthly] cadence
- **Deprecated dependencies**: Replaced before they become unsupported

---

## 7. Testing Requirements

### 7.1 Security Testing

| Test Type | Frequency | Scope |
|---|---|---|
| Unit tests | Every commit | All code changes |
| Integration tests | Every merge to main | Component interactions |
| SAST (Static Application Security Testing) | Every commit | Source code analysis |
| Dependency vulnerability scan | Continuous (CRANIS2) | All SBOM components |
| Penetration testing | [REVIEW: frequency, e.g. annually] | Full application and infrastructure |
| Fuzz testing | [REVIEW: if applicable] | Input parsing and API endpoints |

### 7.2 CI/CD Compliance Gate

CRANIS2's CI/CD compliance gate is integrated into the deployment pipeline. It verifies CRA readiness as a deployment prerequisite, blocking releases that fail the configured compliance threshold. The threshold is configurable by the team to match their risk tolerance and release cadence.

---

## 8. Release & Deployment

### 8.1 Release Process

1. All tests pass (including CI/CD compliance gate)
2. Code review approved
3. SBOM regenerated and validated
4. Release classified (security-only or feature – per Versioning & Security Release Policy)
5. Deployed to production via automated pipeline
6. Post-deployment health verification

### 8.2 Integrity Verification

- All releases are cryptographically signed [REVIEW: or describe your integrity mechanism]
- Users can verify release authenticity before installation
- SBOM is published alongside each release

---

## 9. Maintenance & Monitoring

### 9.1 Continuous Monitoring

During the support period, {{PRODUCT_NAME}} is continuously monitored for:

| Aspect | Tool/Process |
|---|---|
| Dependency vulnerabilities | CRANIS2 SBOM scanning + CVE database matching |
| Licence compliance | CRANIS2 licence compliance scanning |
| CRA readiness | CRANIS2 obligation engine + compliance gap analysis |
| Support period | CRANIS2 automated alerts (90/60/30/7/0 days before expiry) |

### 9.2 Vulnerability Response

All detected vulnerabilities are handled per the Vulnerability Handling Process (Art. 13(5)), which includes AI-assisted triage with mandatory human review before any action is taken.

---

## 10. Evidence & Audit Trail

| Artefact | Retention |
|---|---|
| Threat model documentation | Minimum 10 years |
| Code review records | Minimum 5 years |
| Test results (all types) | Minimum 5 years |
| SBOM snapshots | Minimum 10 years |
| Release records | Minimum 10 years |
| Penetration test reports | Minimum 10 years |
| CRA category classification rationale | Minimum 10 years |

---

## 11. Roles & Responsibilities

| Role | Responsibility |
|---|---|
| **Engineering Lead** ({{MANUFACTURER_CONTACT}}) | Owns the development lifecycle; ensures secure coding practices are followed |
| **Security Lead** ({{SECURITY_CONTACT}}) | Reviews threat models; approves security-critical changes; oversees testing |
| **Compliance Officer** ({{COMPLIANCE_OFFICER}}) | Ensures CRA compliance throughout the lifecycle; manages evidence |
| **All Contributors** | Follow secure coding standards; participate in code review; report security concerns |

---

## Revision History

| Date | Author | Summary |
|---|---|---|
| {{EFFECTIVE_DATE}} | | Initial version – establishes secure development lifecycle for CRA Annex I, Part I compliance |
`;

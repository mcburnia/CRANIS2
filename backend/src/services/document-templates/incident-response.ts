/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

export const INCIDENT_RESPONSE_TEMPLATE = `> **INSTRUCTIONS – DELETE THIS SECTION BEFORE FINALISING**
>
> This is a template document provided by CRANIS2 to help you meet your
> obligations under EU Cyber Resilience Act Article 14.
>
> **How to use this template:**
> 1. Replace all placeholder values (marked with \`{{PLACEHOLDER}}\`) with
>    your product-specific details
> 2. Review and adapt each section to match your actual incident
>    response process
> 3. Have the document reviewed and approved by your Incident Response Lead
>    and Compliance Officer
>
> **Where to store the completed document:**
> Once finalised, paste the content into your product's **Tech File** in
> CRANIS2 under the **Art. 14 – Incident Response** section.

---

# Incident Response Plan

**Document Owner:** {{INCIDENT_RESPONSE_LEAD}}
**Applicable Product:** {{PRODUCT_NAME}}
**Organisation:** {{ORG_NAME}}
**CRA Reference:** Article 14 – Reporting obligations
**Effective Date:** {{EFFECTIVE_DATE}}
**Review Cycle:** Annually, or after every major incident

---

## 1. Purpose

This plan defines how {{ORG_NAME}} responds to security incidents affecting {{PRODUCT_NAME}} and fulfils the notification obligations under EU Cyber Resilience Act Article 14. It covers incident detection, classification, containment, ENISA reporting (three-stage process), stakeholder communication, and post-incident review.

---

## 2. Scope

This plan applies to:

- Actively exploited vulnerabilities in {{PRODUCT_NAME}}
- Severe incidents that impact the security of {{PRODUCT_NAME}} or its users
- Incidents affecting third-party components within the product's SBOM
- All personnel involved in incident response

### 2.1 Article 14 Reporting Triggers

Notification to ENISA is required when:

- An **actively exploited vulnerability** is identified in {{PRODUCT_NAME}}
- A **severe incident** impacts the security of {{PRODUCT_NAME}} with significant effect on users

---

## 3. Incident Classification

| Level | Definition | Response |
|---|---|---|
| **P1 – Critical** | Actively exploited vulnerability or data breach affecting users | Immediate response; ENISA notification required |
| **P2 – High** | Severe vulnerability with public exploit available, no confirmed exploitation | Urgent response; assess ENISA notification requirement |
| **P3 – Medium** | Significant vulnerability without known exploitation | Scheduled response; monitor for escalation |
| **P4 – Low** | Minor security issue with limited impact | Normal process; document and address |

---

## 4. ENISA Notification Process

### 4.1 Three-Stage Reporting

CRA Article 14 requires a three-stage notification process through ENISA's single reporting platform:

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 1: EARLY WARNING              Deadline: 24 hours         │
│                                                                  │
│  Notify ENISA within 24 hours of becoming aware of an actively   │
│  exploited vulnerability or severe incident.                     │
│                                                                  │
│  Content:                                                        │
│  • Nature of the incident/vulnerability                          │
│  • Affected product and versions                                 │
│  • Initial severity assessment                                   │
│  • Whether the vulnerability is being actively exploited         │
│  • Any immediate mitigating measures taken                        │
│                           │                                      │
│  STAGE 2: NOTIFICATION               Deadline: 72 hours         │
│                           ▼                                      │
│  Follow-up notification within 72 hours with more detail.        │
│                                                                  │
│  Content:                                                        │
│  • Updated severity and impact assessment                        │
│  • Root cause analysis (if available)                             │
│  • Affected user base scope                                      │
│  • Corrective measures taken or planned                           │
│  • Indicators of compromise (if applicable)                      │
│                           │                                      │
│  STAGE 3: FINAL REPORT               Deadline: 14 days          │
│                           ▼                                      │
│  Comprehensive final report within 14 days of remediation.       │
│                                                                  │
│  Content:                                                        │
│  • Detailed root cause analysis                                  │
│  • Timeline of events                                            │
│  • Total impact assessment                                       │
│  • Remediation actions taken                                     │
│  • Lessons learned and preventive measures                       │
│  • Cross-border impact (if any)                                  │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

### 4.2 AI-Assisted Report Drafting

CRANIS2's AI incident report drafter generates content for each ENISA notification stage, grounded in:

- Product data (name, version, category, SBOM)
- Linked vulnerability findings and their triage history
- Content from previous reporting stages (ensuring consistency)

**Human-in-the-loop requirement:** The AI generates a draft. The incident lead must review the content, verify factual accuracy, edit where necessary, and explicitly approve the report before submission to ENISA. The AI draft is a starting point. The incident lead owns the final content.

### 4.3 CSIRT Notification

Reports are submitted to the CSIRT of the Member State where {{ORG_NAME}} is established. CRANIS2 tracks the organisation's CSIRT country to ensure reports are directed correctly.

---

## 5. Internal Response Procedure

### 5.1 Response Phases

| Phase | Actions | Timeline |
|---|---|---|
| **Detection** | Incident identified via monitoring, user report, or vulnerability scan | Continuous |
| **Assessment** | Classify severity; determine ENISA notification requirement; CRANIS2 AI risk assessment provides initial threat analysis for security team review and validation | Within 1 hour |
| **Containment** | Isolate affected systems; apply temporary mitigations | Within 2 hours (P1) |
| **Remediation** | Develop and deploy fix; verify resolution | Severity-dependent |
| **Communication** | Notify affected parties; publish advisory | Per communication plan |
| **Recovery** | Restore normal operations; verify no residual impact | Post-fix |
| **Review** | Post-incident review; update procedures; archive evidence | Within 14 days |

### 5.2 Incident Commander

For P1 and P2 incidents, the Incident Response Lead assumes the role of Incident Commander with authority to:

- Mobilise the response team
- Authorise emergency deployments
- Approve external communications
- Initiate ENISA notification

---

## 6. Communication Plan

### 6.1 Internal Communication

| Audience | Channel | Timing |
|---|---|---|
| Response team | [REVIEW: e.g. dedicated Slack channel, Teams] | Immediately on detection |
| Executive leadership | Direct notification | Within 2 hours (P1/P2) |
| All engineering staff | Internal advisory | Within 24 hours (P1/P2) |

### 6.2 External Communication

| Audience | Channel | Timing |
|---|---|---|
| ENISA / CSIRT | Single reporting platform | Per Article 14 timelines |
| Affected users | Email / in-app notification | After containment, before public disclosure |
| General public | Security advisory page | After fix deployment |
| Media (if applicable) | Press statement | As determined by incident commander |

---

## 7. Evidence & Audit Trail

| Artefact | Retention |
|---|---|
| Incident timeline and log | Minimum 10 years |
| ENISA notification copies (all three stages) | Minimum 10 years |
| Root cause analysis | Minimum 10 years |
| Communication records | Minimum 10 years |
| Post-incident review report | Minimum 10 years |
| SBOM snapshots (pre/post incident) | Minimum 10 years |

---

## 8. Post-Incident Review

Within 14 days of incident resolution, the response team conducts a post-incident review covering:

- Timeline accuracy – was the response timely?
- ENISA notification compliance – were all deadlines met?
- Communication effectiveness – were stakeholders informed appropriately?
- Root cause – what allowed the incident to occur?
- Process improvements – what should change?
- Training needs – does the team need additional preparation?

Findings are documented and used to update this plan.

---

## 9. Roles & Responsibilities

| Role | Responsibility |
|---|---|
| **Incident Response Lead** ({{INCIDENT_RESPONSE_LEAD}}) | Owns incident response; acts as incident commander; authorises ENISA submissions |
| **Security Lead** ({{SECURITY_CONTACT}}) | Leads technical investigation; validates root cause analysis |
| **Engineering Team** ({{MANUFACTURER_CONTACT}}) | Develops and deploys fixes; provides technical context |
| **Compliance Officer** ({{COMPLIANCE_OFFICER}}) | Ensures ENISA notification compliance; maintains evidence |
| **Product Owner** ({{TECHNICAL_FILE_OWNER}}) | Approves external communications; manages user impact |

---

## Revision History

| Date | Author | Summary |
|---|---|---|
| {{EFFECTIVE_DATE}} | | Initial version – establishes incident response plan for CRA Art. 14 compliance |
`;

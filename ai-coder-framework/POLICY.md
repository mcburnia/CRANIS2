<!--
  Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi@mcburnie.com
-->

# Loman Cavendish Limited — AI-Assisted Development Policy

**Document type:** Policy
**Owner:** Loman Cavendish Limited
**Version:** 1.0
**Last reviewed:** March 2026
**Review cycle:** Quarterly, or when tools, regulations, or contractual requirements change

---

## 1. Scope

This policy applies to all development and research work undertaken by Loman Cavendish Limited, including:

- Internal product development
- Client engagements (where contractually permitted)
- Research and prototyping activities
- Open-source contributions made in a Loman Cavendish Limited capacity

All employees, contractors, and associates performing development work under the Loman Cavendish Limited banner must comply with this policy.

---

## 2. Authorised Tools

The following AI tools are approved for use in Loman Cavendish Limited development work:

| Tool | Approved Use | Notes |
|------|-------------|-------|
| Claude Code (Anthropic) | Code generation, analysis, documentation, research | Primary AI development tool |
| GitHub Copilot | Inline code completion | IDE integration only |

Additional tools may be approved by submitting a request to the managing director. The request must include the tool name, vendor, data handling policy, and intended use case. Unapproved tools must not be used on any Loman Cavendish Limited or client project.

---

## 3. Confidentiality and Data Handling

### 3.1 What may be shared with AI tools

- Source code owned by Loman Cavendish Limited (subject to client restrictions per Section 4)
- Technical documentation and specifications
- Publicly available information (standards, regulations, open-source code)
- Anonymised or synthetic data

### 3.2 What must never be shared with AI tools

- Client credentials, API keys, tokens, or secrets of any kind
- Personally identifiable information (PII) of clients, users, or employees
- Client data classified as confidential or restricted under NDA
- Production database contents or connection strings
- Financial records, pricing agreements, or commercial terms
- Any information explicitly restricted by a client contract

### 3.3 Data residency

Developers must be aware of where AI tool vendors process and store data. For client work subject to data residency requirements (e.g. UK/EU only), verify that the AI tool's data processing arrangements comply before use.

### 3.4 Environment files

`.env` files, credentials files, and secrets must never be committed to version control or shared with AI tools. This is enforced by project-level `.gitignore` rules and is verified during code review.

---

## 4. Client Work

### 4.1 Contractual review

Before using AI tools on a client engagement, review the contract for:

- Restrictions on third-party tools or subprocessors
- Data handling and confidentiality clauses
- IP assignment terms that may affect AI-assisted work
- Requirements for disclosure of AI involvement

If the contract is silent on AI tool usage, seek written confirmation from the client before proceeding.

### 4.2 Client notification

Where AI tools are used on client work, the client should be informed as part of the engagement setup. The notification should cover:

- Which tools are used and for what purpose
- That all output is reviewed and approved by a competent professional
- That session transcripts are retained as part of the project record
- That no client data is shared beyond the scope described in Section 3

### 4.3 Client-specific restrictions

If a client imposes restrictions on AI tool usage, those restrictions take precedence over this policy. Document the restrictions in the project's `CLAUDE.md` file so they are enforced from the first session.

---

## 5. Session Recording

### 5.1 Mandatory capture

All AI-assisted development sessions must be captured automatically using the session capture tooling described in the Project Scaffold document. Manual recording is not an acceptable alternative — it is incomplete, inconsistent, and not contemporaneous.

### 5.2 What is captured

- Full conversation transcript (human prompts and AI responses)
- Tool usage (which AI capabilities were invoked)
- Session metadata (date, time, contributor, project, session ID)

### 5.3 Storage

Session transcripts are stored in a dedicated evidence repository, separate from the project's source code repository. This separation ensures that development conversations are not mixed with production code and can be managed under their own retention policy.

### 5.4 Retention

Session transcripts must be retained for a minimum of **7 years** from the date of creation. This exceeds HMRC's 6-year requirement for R&D tax credit records and provides a margin for late enquiries.

### 5.5 Access

Session transcripts are accessible to:

- The contributor who recorded the session
- The managing director
- Tax advisors and auditors (under NDA, for R&D claims)

Access is not granted to clients unless explicitly agreed in writing.

---

## 6. Review and Approval

### 6.1 Code review

All AI-generated code must be reviewed by a competent professional before it is merged into a project's main branch. "Competent professional" means a developer with sufficient experience and domain knowledge to evaluate the correctness, security, and appropriateness of the code.

### 6.2 Documentation review

AI-generated documentation, compliance content, and client-facing material must be reviewed for accuracy, tone, and completeness before delivery.

### 6.3 The propose-then-implement pattern

AI tools must be configured to propose a plan of action before making changes. The developer reviews and approves the plan before implementation begins. This ensures that the human is directing the work, not passively accepting whatever the AI produces.

---

## 7. Accountability

The developer who accepts AI output takes full professional responsibility for it.

AI tools do not reduce individual accountability. If AI-generated code introduces a bug, a security vulnerability, or a compliance failure, the developer who approved and committed that code is accountable — not the AI tool.

This is consistent with existing professional standards. A developer who uses a library, a code generator, or a consultant's advice is still responsible for the code they ship. AI tools are no different.

---

## 8. Non-Compliance

Failure to comply with this policy may result in:

- Removal of AI tool access
- Disciplinary action under Loman Cavendish Limited's employment or contractor terms
- Liability for any client or regulatory consequences arising from the non-compliance

Concerns about the policy or its application should be raised with the managing director. The policy is intended to protect both the company and the individual; constructive feedback is welcomed.

---

## 9. Review and Amendment

This policy is reviewed quarterly by the managing director. Amendments may be triggered by:

- Changes to AI tool capabilities or vendor terms
- New regulatory requirements (e.g. the EU AI Act, UK AI framework)
- Lessons learned from project experience
- Client feedback or contractual changes
- Changes to HMRC R&D tax credit guidance

All amendments are versioned and dated. Previous versions are retained for audit purposes.

---

*Loman Cavendish Limited — Professional standards for AI-assisted development.*

<!--
  Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi@mcburnie.com
-->

# AI-Assisted Development Policy

**Document type:** Policy
**Owner:** Andrew (Andi) MCBURNIE
**Version:** 1.1
**Last reviewed:** May 2026
**Review cycle:** Quarterly, or when tools, regulations, or contractual requirements change

---

## 1. Scope

This policy applies to all development and research work undertaken under this framework, including:

- Personal product development
- Any work performed under contract for a third party (where contractually permitted)
- Research and prototyping activities
- Open-source contributions made under this framework

Anyone performing development work under this framework — the framework owner, or any contractor or collaborator who has been granted access — must comply with this policy.

---

## 2. Authorised Tools

The following AI tools are approved for use under this framework:

| Tool | Approved Use | Notes |
|------|-------------|-------|
| Claude Code (Anthropic) | Code generation, analysis, documentation, research | Primary AI development tool |
| GitHub Copilot | Inline code completion | IDE integration only |

Additional tools may be approved by the framework owner. The request must include the tool name, vendor, data handling policy, and intended use case. Unapproved tools must not be used on any project covered by this framework.

---

## 3. Confidentiality and Data Handling

### 3.1 What may be shared with AI tools

- Source code owned by the framework owner (subject to any contractual restrictions per Section 4)
- Technical documentation and specifications
- Publicly available information (standards, regulations, open-source code)
- Anonymised or synthetic data

### 3.2 What must never be shared with AI tools

- Credentials, API keys, tokens, or secrets of any kind
- Personally identifiable information (PII) of users, contractors, or third parties
- Data classified as confidential or restricted under any agreement
- Production database contents or connection strings
- Financial records, pricing agreements, or commercial terms
- Any information explicitly restricted by a contract

### 3.3 Data residency

Developers must be aware of where AI tool vendors process and store data. For work subject to data residency requirements (e.g. EU/UK only), verify that the AI tool's data processing arrangements comply before use.

### 3.4 Environment files

`.env` files, credentials files, and secrets must never be committed to version control or shared with AI tools. This is enforced by project-level `.gitignore` rules and is verified during code review.

---

## 4. Contracted Work

### 4.1 Contractual review

Before using AI tools on any contracted engagement, review the contract for:

- Restrictions on third-party tools or subprocessors
- Data handling and confidentiality clauses
- IP assignment terms that may affect AI-assisted work
- Requirements for disclosure of AI involvement

If the contract is silent on AI tool usage, seek written confirmation from the counterparty before proceeding.

### 4.2 Counterparty notification

Where AI tools are used on contracted work, the counterparty should be informed as part of the engagement setup. The notification should cover:

- Which tools are used and for what purpose
- That all output is reviewed and approved by a competent professional
- That session transcripts are retained as part of the project record
- That no counterparty data is shared beyond the scope described in Section 3

### 4.3 Counterparty-specific restrictions

If a counterparty imposes restrictions on AI tool usage, those restrictions take precedence over this policy. Document the restrictions in the project's `CLAUDE.md` file so they are enforced from the first session.

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

Session transcripts must be retained for a minimum of **7 years** from the date of creation. This horizon supports IP-provenance evidence over a typical product lifecycle, defends against later challenges to authorship or methodology, and provides a margin for any future enquiry — regulatory, contractual, or otherwise.

### 5.5 Access

Session transcripts are accessible to:

- The contributor who recorded the session
- The framework owner
- Auditors or counsel (under NDA), where required for a specific enquiry

Access is not granted to counterparties unless explicitly agreed in writing.

---

## 6. Review and Approval

### 6.1 Code review

All AI-generated code must be reviewed by a competent professional before it is merged into a project's main branch. "Competent professional" means a developer with sufficient experience and domain knowledge to evaluate the correctness, security, and appropriateness of the code.

### 6.2 Documentation review

AI-generated documentation, compliance content, and counterparty-facing material must be reviewed for accuracy, tone, and completeness before delivery.

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
- Termination of any contractor agreement under which the work is performed
- Liability for any contractual or regulatory consequences arising from the non-compliance

Concerns about the policy or its application should be raised with the framework owner. The policy is intended to protect both the project and the individual; constructive feedback is welcomed.

---

## 9. Review and Amendment

This policy is reviewed quarterly by the framework owner. Amendments may be triggered by:

- Changes to AI tool capabilities or vendor terms
- New regulatory requirements (e.g. the EU AI Act, UK AI framework)
- Lessons learned from project experience
- Counterparty feedback or contractual changes

All amendments are versioned and dated. Previous versions are retained for audit purposes.

---

*Andrew (Andi) MCBURNIE — Professional standards for AI-assisted development.*

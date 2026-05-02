<!--
  Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi@mcburnie.com
-->

# Evidence and Documentation Standards

**Document type:** Standard
**Owner:** Andrew (Andi) MCBURNIE
**Version:** 1.1
**Last reviewed:** May 2026

---

## 1. Purpose

This standard defines the evidence and documentation expected for development and research work undertaken under this framework. It ensures that what was built, why, by whom, and through what process is recorded contemporaneously and as a natural byproduct of disciplined work — not retrofitted under deadline pressure.

AI-assisted development produces uniquely strong evidence because every session is captured as a verbatim transcript. This standard explains how to structure that evidence so it stands up to subsequent scrutiny — IP provenance challenges, due-diligence enquiries, security audits, contractual disputes, or any later question about authorship and methodology.

---

## 2. Four Lenses for Project Evidence

Every non-trivial project should be documented through four complementary lenses. The structure mirrors classical R&D analysis frameworks but is applied here as professional discipline, not as a claim under any specific tax or grant scheme.

### 2.1 The Advance

What new capability, process, or system was created — measured against what existed before.

**What to document:**

- The baseline — what existed before the project began and what was achievable using publicly available knowledge or tooling
- The intended advance — what new capability, process, or system the project sought to create
- The outcome — what was actually achieved and how it differs from the baseline

### 2.2 The Uncertainty

The places where a competent professional could not readily resolve the problem by applying existing knowledge or following established practice.

Uncertainty arises when:

- It is not known whether something is technically achievable
- It is not known how to achieve it
- Multiple approaches exist and it is not clear which will work, or whether any will
- Existing solutions exist but it is uncertain whether they can be adapted to the specific context

**What to document:**

- The specific uncertainties encountered (not vague statements like "it was difficult")
- Why these could not be resolved by a competent professional using publicly available knowledge
- What approaches were tried, what was learned, and what was ultimately adopted or abandoned
- Residual uncertainties that remain unresolved

### 2.3 The Method

That the work was conducted systematically — planned, structured activity with clear objectives — rather than trial-and-error without direction.

AI-assisted development is inherently systematic when conducted under the accompanying Guidelines:

- Sessions begin with a stated objective
- Plans are proposed and approved before implementation
- Each task is committed with a detailed message explaining what changed and why
- Session transcripts record the full decision-making process
- Failures and abandoned approaches are documented alongside successes

**What to document:**

- The methodology used (iterative development, prototype-and-test, research-then-implement)
- How results were evaluated at each stage
- How the approach was adjusted based on findings
- The relationship between sessions — how each session built on what was learned previously

### 2.4 The Author

That the work was directed by a professional with relevant qualifications, experience, or expertise in the field.

**What to document:**

- The contributor's name, role, and relevant experience
- Their relationship to the technical decisions made during the project
- Evidence that they directed the AI tool rather than passively accepting its output (session transcripts provide this naturally)

---

## 3. Session Evidence Requirements

Every captured session must contain the following elements, either in the frontmatter metadata or the transcript body:

### 3.1 Mandatory Frontmatter

```yaml
---
project: <project name>
contributor: <developer name>
date: <YYYY-MM-DD>
time: <HH:MM:SS>
session_id: <unique identifier>
tool: <AI tool used, e.g. Claude Code>
type: development_session
---
```

### 3.2 Session Content

The transcript itself provides the evidence. No additional annotation is required during the session. However, developers should be aware that the following elements strengthen the evidentiary value of a session when they appear naturally in the conversation:

- **Problem statement** — what the developer asked the AI to help with
- **Uncertainty markers** — moments where the developer or AI identified that the solution was not obvious ("I'm not sure whether...", "Let's try this approach first...", "That didn't work because...")
- **Design decisions** — the developer choosing between alternatives and explaining why
- **Rejected approaches** — things that were tried and abandoned, with the reason
- **Testing and validation** — running tests, evaluating results, iterating

### 3.3 Post-Session Annotation (Optional)

For sessions that resolve significant uncertainty or develop novel work, the contributor may add a brief annotation to the session file after capture:

```yaml
objective: <what the session set out to achieve>
uncertainties_encountered: <technical uncertainties met>
advances_made: <what new knowledge or capability resulted>
review_status: draft
```

This annotation is optional but valuable. It makes the significance of the session explicit for reviewers who may not have the technical context to extract it from the transcript alone.

---

## 4. Project-Level Documentation

Each substantive investigation (which may span multiple software projects and many sessions) deserves a project-level narrative. This is typically written periodically as the work progresses and is informed by contemporaneous session records.

### 4.1 Project Narrative Structure

```markdown
# Project: <title>

## 1. Objectives
What the project sought to achieve and why it constitutes an advance.

## 2. Baseline
What was achievable before the project began, using publicly available
knowledge and existing tools.

## 3. Technical Uncertainties
Specific uncertainties that could not be resolved by a competent
professional without systematic investigation.

## 4. Methodology
How the work was planned and conducted. Reference to session transcripts
as contemporaneous evidence.

## 5. Outcomes
What was achieved, what was learned, and how it differs from the baseline.

## 6. Residual Uncertainties
Uncertainties that remain unresolved and may form the basis of
continuing investigation.

## 7. Contributors
Names, roles, and relevant experience of the competent professionals
who directed the work.

## 8. Session Index
List of session transcripts related to this project, with dates
and brief descriptions.
```

### 4.2 Maintaining the Narrative

The narrative should be updated periodically throughout the project, not written from scratch at the end. Monthly or quarterly updates are recommended. Session transcripts provide the raw material; the narrative provides the interpretation.

---

## 5. Contemporaneous Records

Records created at the time the work was performed carry significantly more weight than records reconstructed retrospectively — for IP defence, audit, due diligence, or any future enquiry.

AI-assisted development sessions are captured automatically and timestamped at the point of creation. This makes them inherently contemporaneous. They cannot easily be fabricated or backdated because:

- Session IDs are generated by the AI tool
- Timestamps are system-generated
- Transcript content reflects the actual conversation, including mistakes, dead ends, and course corrections

This is a significant advantage over traditional record-keeping, where developers are often asked to recall what they did months after the fact.

---

## 6. How Session Evidence Maps to the Four Lenses

AI-assisted development sessions provide unusually strong evidence for each lens described in Section 2:

| Lens | How Session Transcripts Provide Evidence |
|------|------------------------------------------|
| **Advance** | The developer states what they are trying to achieve. The final state of the code demonstrates the advance. |
| **Uncertainty** | The transcript captures moments of uncertainty, failed approaches, and iterative problem-solving in real time. |
| **Method** | The propose-then-implement pattern, structured task lists, and commit discipline demonstrate systematic methodology. |
| **Author** | The developer's direction of the AI — choosing approaches, rejecting output, making architectural decisions — evidences professional competence. |

The key insight is that the developer's role in an AI-assisted session is exactly the role any later reviewer expects of a competent professional: directing a systematic investigation, evaluating results, and making informed decisions.

---

## 7. Retention

| Record Type | Minimum Retention | Basis |
|-------------|-------------------|-------|
| Session transcripts | 7 years from creation | Defends IP provenance and methodology over a typical product lifecycle; provides margin for any later enquiry |
| Project narratives | 7 years from project end | As above |
| Project scaffold files (CLAUDE.md, RESTART.md, etc.) | Retained in version control indefinitely | Part of the project record |
| Commit history | Retained in version control indefinitely | Part of the project record |

---

## 8. Naming and Filing

### 8.1 Evidence Repository Structure

```
evidence-repo/
  sessions/
    <project-name>/
      2026-03-17-143022.md
      2026-03-17-160445.md
      ...
  narratives/
    <project-reference>.md
    ...
```

### 8.2 File Naming

- Session files: `YYYY-MM-DD-HHMMSS.md` (generated automatically by the capture tool)
- Narrative files: `<project-reference>.md`

### 8.3 Evidence Repository

The evidence repository is a separate git repository from the project source code. This separation:

- Prevents development conversations from being mixed with production code
- Allows independent access control (reviewers can access evidence without accessing source)
- Enables a retention policy independent of the project's lifecycle
- Keeps session transcripts out of any deliverable repository

---

*Andrew (Andi) MCBURNIE — Evidence standards for professional AI-assisted development.*

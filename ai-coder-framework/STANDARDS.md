# Loman Cavendish Limited — R&D Evidence and Documentation Standards

**Document type:** Standard
**Owner:** Loman Cavendish Limited
**Version:** 1.0
**Last reviewed:** March 2026
**Regulatory basis:** HMRC R&D Tax Relief (Corporation Tax), BEIS Guidelines on the Meaning of Research and Development

---

## 1. Purpose

This standard defines the evidence requirements for R&D tax credit claims made by Loman Cavendish Limited under the UK R&D tax relief scheme. It ensures that development and research activities are documented to the level required by HMRC, contemporaneously and as a natural byproduct of disciplined work.

AI-assisted development produces uniquely strong R&D evidence because every session is captured as a verbatim transcript. This standard explains how to structure that evidence so it directly supports the four-part test.

---

## 2. The Four-Part Test

HMRC requires that qualifying R&D activities satisfy all four parts of the following test. Every R&D project must document how its activities meet each criterion.

### 2.1 Advance in Science or Technology

The project must seek to achieve an advance in overall knowledge or capability in a field of science or technology. This is not limited to groundbreaking research; it includes:

- Creating new processes, systems, or services
- Appreciably improving existing ones beyond what is readily available
- Developing novel combinations of existing technologies to solve a problem that has not been solved in this way before

**What to document:**

- The baseline — what existed before the project began and what was achievable using publicly available knowledge
- The intended advance — what new capability, process, or system the project seeks to create
- The outcome — what was actually achieved and how it differs from the baseline

### 2.2 Scientific or Technological Uncertainty

The project must encounter uncertainty that a competent professional in the field could not readily resolve by applying existing knowledge or following established practice.

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

### 2.3 Systematic Investigation

The work must be conducted systematically. This means planned, structured activity with clear objectives — not trial and error without direction.

AI-assisted development is inherently systematic when conducted under the Loman Cavendish Limited Guidelines:

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

### 2.4 Competent Professional

The work must be directed by a professional with relevant qualifications, experience, or expertise in the field.

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
client: <client name, if applicable>
contributor: <developer name>
date: <YYYY-MM-DD>
time: <HH:MM:SS>
session_id: <unique identifier>
tool: <AI tool used, e.g. Claude Code>
type: development_session
---
```

### 3.2 Session Content

The transcript itself provides the evidence. No additional annotation is required during the session. However, developers should be aware that the following elements strengthen an R&D claim when they appear naturally in the conversation:

- **Problem statement** — what the developer asked the AI to help with
- **Uncertainty markers** — moments where the developer or AI identified that the solution was not obvious ("I'm not sure whether...", "Let's try this approach first...", "That didn't work because...")
- **Design decisions** — the developer choosing between alternatives and explaining why
- **Rejected approaches** — things that were tried and abandoned, with the reason
- **Testing and validation** — running tests, evaluating results, iterating

### 3.3 Post-Session Annotation (Optional)

For sessions that involve significant R&D activity, the contributor may add a brief annotation to the session file after it is captured:

```yaml
r_and_d_project: <R&D project reference>
objective: <what the session set out to achieve>
uncertainties_encountered: <technological uncertainties met>
advances_made: <what new knowledge or capability resulted>
review_status: draft
```

This annotation is optional but valuable. It makes the R&D relevance of the session explicit for auditors who may not have the technical context to extract it from the transcript alone.

---

## 4. Project-Level Documentation

Each R&D project (which may span multiple software projects and many sessions) requires a project-level narrative. This is typically written at the end of a claim period but should be informed by contemporaneous session records.

### 4.1 R&D Project Narrative Structure

```markdown
# R&D Project: <title>

## 1. Objectives
What the project sought to achieve and why it constitutes an advance.

## 2. Baseline
What was achievable before the project began, using publicly available
knowledge and existing tools.

## 3. Technological Uncertainties
Specific uncertainties that could not be resolved by a competent
professional without systematic investigation.

## 4. Methodology
How the work was planned and conducted. Reference to session transcripts
as contemporaneous evidence.

## 5. Outcomes
What was achieved, what was learned, and how it differs from the baseline.

## 6. Residual Uncertainties
Uncertainties that remain unresolved and may form the basis of
continuing R&D in subsequent periods.

## 7. Contributors
Names, roles, and relevant experience of the competent professionals
who directed the work.

## 8. Session Index
List of session transcripts related to this R&D project, with dates
and brief descriptions.
```

### 4.2 Maintaining the Narrative

The R&D narrative should be updated periodically throughout the claim period, not written from scratch at the end. Monthly or quarterly updates are recommended. Session transcripts provide the raw material; the narrative provides the interpretation.

---

## 5. Contemporaneous Records

HMRC places significant weight on records created at the time the work was performed, as opposed to records reconstructed retrospectively.

AI-assisted development sessions are captured automatically and timestamped at the point of creation. This makes them inherently contemporaneous. They cannot be fabricated or backdated because:

- Session IDs are generated by the AI tool
- Timestamps are system-generated
- Transcript content reflects the actual conversation, including mistakes, dead ends, and course corrections

This is a significant advantage over traditional R&D record-keeping, where developers are often asked to recall what they did months after the fact.

---

## 6. AI Tool Evidence and the Four-Part Test

AI-assisted development sessions provide unusually strong evidence for each part of the four-part test:

| Test | How Session Transcripts Provide Evidence |
|------|------------------------------------------|
| **Advance** | The developer states what they are trying to achieve. The final state of the code demonstrates the advance. |
| **Uncertainty** | The transcript captures moments of uncertainty, failed approaches, and iterative problem-solving in real time. |
| **Systematic** | The propose-then-implement pattern, structured task lists, and commit discipline demonstrate systematic methodology. |
| **Competent professional** | The developer's direction of the AI — choosing approaches, rejecting output, making architectural decisions — demonstrates professional competence. |

The key insight is that the developer's role in an AI-assisted session is precisely the role HMRC expects of a competent professional: directing a systematic investigation, evaluating results, and making informed decisions.

---

## 7. Retention

| Record Type | Minimum Retention | Basis |
|-------------|-------------------|-------|
| Session transcripts | 7 years from creation | HMRC enquiry window (6 years) plus 1-year margin |
| R&D project narratives | 7 years from the end of the claim period | As above |
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
    <r-and-d-project-reference>.md
    ...
```

### 8.2 File Naming

- Session files: `YYYY-MM-DD-HHMMSS.md` (generated automatically by the capture tool)
- Narrative files: `<r-and-d-project-reference>.md` (e.g. `GC-RD-2026-001.md`)

### 8.3 Evidence Repository

The evidence repository is a separate git repository from the project source code. This separation:

- Prevents development conversations from being mixed with production code
- Allows independent access control (auditors can access evidence without accessing source)
- Enables a retention policy independent of the project's lifecycle
- Keeps session transcripts out of client-deliverable repositories

---

*Loman Cavendish Limited — Evidence standards for R&D tax credit claims and professional development practice.*

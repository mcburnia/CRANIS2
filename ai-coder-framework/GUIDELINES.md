<!--
  Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi.mcburnie@gmail.com
-->

# Loman Cavendish Limited — Developer Guide to AI-Assisted Development

**Document type:** Guidelines
**Owner:** Loman Cavendish Limited
**Version:** 1.0
**Last reviewed:** March 2026

---

## 1. Before You Start

Read the Principles and Policy documents before your first AI-assisted session. You are accountable for the code you produce, regardless of how it was generated. Understanding the rules is not optional.

Key points to internalise:

- You direct the AI. It does not direct you.
- You must be able to explain every line of code you commit.
- Sessions are captured automatically. Behave accordingly.
- The propose-then-implement pattern is mandatory, not a suggestion.

---

## 2. Session Setup

### 2.1 First-Time Setup

Before your first session on a project, verify that the session capture tooling is configured:

1. Check that `.claude/hooks.json` exists and contains a `SessionEnd` hook
2. Check that `.claude/.env` contains `EVIDENCE_REPO` pointing to the evidence repository
3. Verify the evidence repository exists and is a valid git repository
4. Run a test session and confirm a transcript appears in the evidence repo

If any of these are missing, follow the setup instructions in `PROJECT-SCAFFOLD.md`.

### 2.2 Every Session

At the start of each session:

1. Open the project in your development environment
2. Read `RESTART.md` if you are returning after a break or picking up someone else's work
3. Check `BACKLOG.md` for the current priorities
4. State your objective clearly in your first message to the AI

---

## 3. Directing the AI

### 3.1 The Propose-Then-Implement Pattern

This is the most important habit to develop. It works as follows:

1. **Describe what you want** — tell the AI what you need to achieve, not how to achieve it
2. **Review the plan** — the AI proposes an approach. Read it. Challenge anything you do not understand or agree with.
3. **Approve or adjust** — explicitly approve the plan, or ask for modifications
4. **Implementation** — the AI implements the approved plan
5. **Review the output** — read the code. Run the tests. Verify the result.

Never skip step 2. The plan is where architectural decisions are made, and those decisions are your responsibility.

### 3.2 Providing Context

AI tools work better with context. At the start of a session or when shifting to a new task:

- Explain what the project does and where you are in the development process
- Reference specific files, functions, or components by name
- Mention constraints (performance requirements, compatibility, client preferences)
- If this relates to R&D work, mention the uncertainty you are investigating

### 3.3 Challenging Output

Do not accept output you do not understand. Productive challenges include:

- "Why did you choose this approach over X?"
- "What are the trade-offs of this design?"
- "Is there a simpler way to achieve this?"
- "What happens if this input is null/empty/malicious?"
- "Walk me through this function line by line."

These questions serve two purposes: they ensure you understand the code, and they generate excellent R&D evidence in the session transcript.

---

## 4. Commit Discipline

### 4.1 One Commit Per Task

Each distinct piece of work gets its own commit. Do not batch unrelated changes into a single commit. Do not leave uncommitted work at the end of a session.

### 4.2 Commit Messages

Write commit messages with a concise subject line and a detailed body:

```
feat: add retry logic with exponential backoff for webhook delivery

Implement a retry queue for failed webhook deliveries using
exponential backoff (1s, 2s, 4s, 8s, max 60s) with jitter.
Failed deliveries are persisted to the database and retried
up to 5 times before being marked as permanently failed.

Tested against simulated 503, timeout, and connection-refused
scenarios.
```

The subject line says what changed. The body says why it changed and any relevant context. A future developer (or auditor) should be able to understand the change without reading the diff.

### 4.3 What Never Gets Committed

- `.env` files or any file containing credentials
- API keys, tokens, or secrets
- Production data or database dumps
- Large binary files that belong in artefact storage
- Temporary files, editor configurations, or OS metadata

---

## 5. Reviewing AI Output

### 5.1 Code Review Checklist

Before accepting AI-generated code, verify:

- [ ] You understand what the code does and why
- [ ] The approach matches the approved plan
- [ ] No security vulnerabilities (injection, XSS, SSRF, hardcoded secrets)
- [ ] Error handling is appropriate but not excessive
- [ ] Edge cases are considered
- [ ] Tests are included or updated
- [ ] The code follows the project's existing patterns and conventions
- [ ] No unnecessary abstractions or over-engineering

### 5.2 Documentation Review

Before accepting AI-generated documentation:

- [ ] Content is factually accurate
- [ ] Regulatory or standards references are correct and current
- [ ] Tone and style match the project's editorial standard
- [ ] No AI artefacts (filler phrases, excessive hedging, mechanical cadence)
- [ ] British English spelling throughout

---

## 6. Recording Uncertainty

When you encounter something you cannot solve deterministically, document it explicitly in the session. This is the most valuable R&D evidence you can create.

Productive ways to surface uncertainty:

- "I am not sure whether this approach will handle concurrent requests correctly."
- "The documentation for this API is ambiguous about error responses. Let's test it empirically."
- "There are three possible architectures for this. I need to evaluate them against our performance constraints."
- "This works in isolation but I do not know how it will interact with the existing auth middleware."

The AI's response — and your subsequent evaluation of that response — demonstrates systematic investigation by a competent professional. This is precisely what HMRC is looking for.

---

## 7. Session Hygiene

### 7.1 Keep Sessions Focused

One session should address one area of work. Do not mix unrelated tasks in a single session. If you need to switch context, end the session and start a new one.

### 7.2 End Sessions Cleanly

When you are finished:

1. Ensure all work is committed
2. Update `BACKLOG.md` if priorities have changed
3. Update `RESTART.md` if significant architectural changes were made
4. End the session properly so the capture hook fires

### 7.3 Session Length

There is no ideal session length. Sessions naturally range from 30 minutes to several hours. If a session exceeds 4 hours, consider whether it should have been split into smaller, more focused sessions.

---

## 8. Source Code Anti-Patterns

These are patterns we have learned to avoid through experience. They apply whether code is written manually or generated by AI.

### 8.1 File Growth

Monitor file size before adding code to an existing file.

- **500+ lines** — flag to the team. Consider whether the file has accumulated distinct responsibilities.
- **800+ lines** — propose decomposition before adding more code.

Size alone is not sufficient reason to split. A 900-line data registry with a single responsibility is fine. A 600-line file handling authentication, synchronisation, and webhooks is not.

### 8.2 Decomposition

When splitting a file, use a consistent pattern:

- Create a sub-directory with an `index.ts` (or equivalent) that composes the focused sub-modules
- Extract shared helpers into a `shared.ts` file
- Compose sub-routers or sub-modules via the framework's standard mechanism (e.g. `router.use()` in Express)

### 8.3 Over-Engineering

- Do not add error handling for scenarios that cannot happen
- Do not create abstractions for one-time operations — three similar lines of code is better than a premature helper function
- Do not design for hypothetical future requirements
- Do not add docstrings, comments, or type annotations to code you did not change
- Do not add feature flags or backwards-compatibility shims when you can just change the code

### 8.4 Backwards-Compatibility Residue

When removing code, remove it completely:

- No renamed `_unusedVariable` placeholders
- No re-exported types that nothing imports
- No `// removed` comments marking where code used to be
- If it is unused, delete it

### 8.5 Security Hygiene

- Never commit `.env` files or credentials
- Validate at system boundaries (user input, external APIs) — trust internal code and framework guarantees
- Do not add validation for internal function parameters that are already type-checked
- Review AI-generated code specifically for injection vulnerabilities — AI tools sometimes produce code that concatenates user input into queries or commands

### 8.6 Test Discipline

- Use isolated test infrastructure — separate databases, separate ports, no data collisions with the development environment
- Use deterministic test data with conflict-safe seeding
- Never run tests against the live or development stack
- Write tests that verify behaviour, not implementation details

### 8.7 AI-Specific Anti-Patterns

- **Blind acceptance** — committing AI output without reading it. This is the single most common and most damaging mistake.
- **Architectural delegation** — letting the AI make structural decisions without your evaluation. The AI can propose; you must decide.
- **Specification by correction** — giving the AI vague instructions and then correcting the output through multiple rounds. State what you want clearly upfront.
- **Context starvation** — expecting the AI to produce good output without providing project context, constraints, or references.
- **Refactoring creep** — allowing the AI to "improve" code adjacent to the task. Stay focused on what was asked.

---

## 9. Quick-Reference Checklist

### Session Start

- [ ] Project files are current (RESTART.md, BACKLOG.md)
- [ ] Session capture is configured and working
- [ ] Objective is stated clearly in the first message
- [ ] R&D project reference noted (if applicable)

### During the Session

- [ ] Propose-then-implement pattern followed for every task
- [ ] AI output reviewed before acceptance
- [ ] One commit per completed task with a detailed message
- [ ] Uncertainties documented explicitly in the conversation
- [ ] No credentials or sensitive data shared with the AI

### Session End

- [ ] All work committed
- [ ] Tests passing
- [ ] BACKLOG.md updated if priorities changed
- [ ] RESTART.md updated if architecture changed
- [ ] Session ended cleanly (capture hook fires)

---

*Loman Cavendish Limited — Practical guidance for professional AI-assisted development.*

<!--
  Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi@mcburnie.com
-->

# Session Record Template

**Document type:** Template
**Owner:** Andrew (Andi) MCBURNIE
**Version:** 1.1

---

## Purpose

This template defines the structure for captured AI-assisted development sessions. The session capture tool generates files in this format automatically. The frontmatter fields support IP provenance, audit, and knowledge-transfer requirements.

---

## Template

```markdown
---
project: <project-name>
contributor: <developer-name>
date: <YYYY-MM-DD>
time: <HH:MM:SS>
session_id: <unique-identifier>
tool: <AI tool, e.g. Claude Code>
type: development_session
---

# Development Session — <date> <time>

**Project:** <project-name>
**Contributor:** <developer-name>
**Date:** <date> <time>
**Session ID:** <session-id>

---

<transcript content — automatically captured>
```

---

## Optional Annotation

For sessions that resolve significant technical uncertainty, develop novel solutions, or otherwise warrant a permanent record beyond the raw transcript, the contributor may add the following fields to the frontmatter after capture. This is optional but recommended for sessions whose value is not obvious from the transcript alone.

```yaml
objective: <what the session set out to achieve>
uncertainties_encountered: |
  <technical uncertainties met during the session,
  written as specific statements, not generalities>
advances_made: |
  <what new knowledge or capability resulted,
  or what was learned from a failed approach>
review_status: <draft | reviewed | approved>
reviewed_by: <name of reviewer, if reviewed>
reviewed_date: <YYYY-MM-DD, if reviewed>
```

---

## Field Descriptions

| Field | Required | Description |
|-------|----------|-------------|
| `project` | Yes | The software project name (directory name by default) |
| `contributor` | Yes | Full name of the developer who conducted the session |
| `date` | Yes | Session date in ISO format |
| `time` | Yes | Session start time |
| `session_id` | Yes | Unique identifier assigned by the AI tool |
| `tool` | Yes | AI tool used (e.g. Claude Code, GitHub Copilot) |
| `type` | Yes | Always `development_session` |
| `objective` | No | Brief statement of what the session aimed to achieve |
| `uncertainties_encountered` | No | Specific technical uncertainties met |
| `advances_made` | No | New knowledge or capabilities resulting from the session |
| `review_status` | No | Whether the annotation has been reviewed |

---

## Guidance for Annotations

### Writing Uncertainty Statements

Strong:
> "It was uncertain whether the event-driven architecture would maintain message ordering guarantees under high concurrency, given that the broker does not natively support exactly-once delivery and our consumers must be idempotent."

Weak:
> "We were not sure if it would work."

### Writing Advance Statements

Strong:
> "Developed an idempotent consumer pattern using content-based deduplication with a sliding window, allowing the system to tolerate duplicate deliveries without data corruption. This approach was not covered by the broker's documentation or existing client libraries."

Weak:
> "We built the feature successfully."

### When to Annotate

Not every session requires annotation. Annotate sessions where:

- You encountered genuine technical uncertainty
- You tried an approach that failed and learned from it
- You developed a novel solution to a technical problem
- You achieved something that was not readily achievable using existing knowledge or tooling

Routine development (small bug fixes, UI adjustments, configuration changes, mechanical refactors) does not typically warrant annotation.

---

*Andrew (Andi) MCBURNIE — Template for AI-assisted development session records.*

# Gibbs Consulting — Session Record Template

**Document type:** Template
**Owner:** Gibbs Consulting
**Version:** 1.0

---

## Purpose

This template defines the structure for captured AI-assisted development sessions. The session capture tool generates files in this format automatically. The frontmatter fields support R&D tax credit claims, IP evidence, and audit requirements.

---

## Template

```markdown
---
project: <project-name>
client: <client-name or "internal">
contributor: <developer-name>
date: <YYYY-MM-DD>
time: <HH:MM:SS>
session_id: <unique-identifier>
tool: <AI tool, e.g. Claude Code>
type: development_session
---

# Development Session — <date> <time>

**Project:** <project-name>
**Client:** <client-name or Internal>
**Contributor:** <developer-name>
**Date:** <date> <time>
**Session ID:** <session-id>

---

<transcript content — automatically captured>
```

---

## Optional R&D Annotation

For sessions that involve R&D activity, the contributor may add the following fields to the frontmatter after the session is captured. This is optional but recommended for sessions that form part of an R&D claim.

```yaml
r_and_d_project: <R&D project reference, e.g. GC-RD-2026-001>
objective: <what the session set out to achieve>
uncertainties_encountered: |
  <technological uncertainties met during the session,
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
| `client` | No | Client name if this is client work; "internal" otherwise |
| `contributor` | Yes | Full name of the developer who conducted the session |
| `date` | Yes | Session date in ISO format |
| `time` | Yes | Session start time |
| `session_id` | Yes | Unique identifier assigned by the AI tool |
| `tool` | Yes | AI tool used (e.g. Claude Code, GitHub Copilot) |
| `type` | Yes | Always `development_session` |
| `r_and_d_project` | No | Reference to the R&D project this session supports |
| `objective` | No | Brief statement of what the session aimed to achieve |
| `uncertainties_encountered` | No | Specific technological uncertainties met |
| `advances_made` | No | New knowledge or capabilities resulting from the session |
| `review_status` | No | Whether the R&D annotation has been reviewed |

---

## Guidance for R&D Annotations

### Writing Uncertainty Statements

Strong:
> "It was uncertain whether the three-tier SBOM generation approach (API, lockfile, import scanning) would produce consistent dependency counts across all package managers, given that each tier has different visibility into transitive dependencies."

Weak:
> "We were not sure if it would work."

### Writing Advance Statements

Strong:
> "Developed a reconciliation algorithm that merges dependency data from three independent sources into a single SPDX-compliant SBOM, resolving version conflicts by preferring the most specific source. This approach was not documented in existing tooling."

Weak:
> "We built the feature successfully."

### When to Annotate

Not every session requires R&D annotation. Annotate sessions where:

- You encountered genuine technological uncertainty
- You tried an approach that failed and learned from it
- You developed a novel solution to a technical problem
- You achieved something that was not readily achievable using existing knowledge

Routine development (bug fixes, UI adjustments, configuration changes) does not typically qualify as R&D and does not need annotation.

---

*Gibbs Consulting — Template for AI-assisted development session records.*

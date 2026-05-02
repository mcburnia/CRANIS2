<!--
  Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi@mcburnie.com
-->

# Loman Cavendish Limited — Project Scaffold

**Document type:** Standard
**Owner:** Loman Cavendish Limited
**Version:** 1.0
**Last reviewed:** March 2026

---

## 1. Purpose

Every software project initiated by Loman Cavendish Limited includes a standard set of files that enable AI-assisted development, session capture, and R&D evidence collection from day one. This document defines those files, explains their purpose, and provides starter templates.

These files are not bureaucratic overhead. They are working documents that the AI reads at the start of each session. They eliminate the "catch-up" problem where context is lost between sessions, reduce onboarding time for new team members, and produce the evidence trail required for R&D tax credit claims.

---

## 2. File Overview

| File | Purpose | Created | Updated |
|------|---------|---------|---------|
| `CLAUDE.md` | AI operating instructions | Project inception | When environment, standards, or tooling change |
| `MEMORY.md` | Persistent AI memory index | First session | Each session (automatically) |
| `RESTART.md` | Full project context | After initial architecture | After significant changes |
| `BACKLOG.md` | Active work items | When development begins | Each session |
| `.claude/hooks.json` | Session capture hook | Project inception | Rarely |
| `.claude/.env` | Evidence repo path | Project inception | Rarely |
| `.gitignore` | Version control exclusions | Project inception | As needed |

Optional (per project):

| File | Purpose | When to include |
|------|---------|-----------------|
| `EDITORIAL-STANDARD.md` | Writing quality rules | Projects producing user-facing content |
| `CONTRIBUTING.md` | Contributor guidelines | Projects with multiple developers |

---

## 3. CLAUDE.md — AI Operating Instructions

### Purpose

The AI reads this file at the start of every session. It defines how the AI should behave on this specific project: what the project does, how to build and test it, coding standards, environment details, and any project-specific rules.

### What Goes Here

- Project description (one paragraph)
- Build, test, and deploy commands
- Environment notes (runtime versions, Docker, database setup)
- Coding standards and conventions
- Project-specific rules (e.g. "never modify the migration files directly")
- Port map (if the project runs multiple services)
- Links to other scaffold files

### What Does Not Go Here

- Architectural decisions (those go in `RESTART.md`)
- Task lists (those go in `BACKLOG.md`)
- User preferences or feedback (those go in `MEMORY.md`)
- General Loman Cavendish Limited policies (those are in the framework documents)

### Anti-Patterns

- **Bloated CLAUDE.md** — if this file exceeds 200 lines, it is trying to do too much. Extract architecture to `RESTART.md` and conventions to a separate standards file.
- **Stale commands** — if build or test commands change, update this file immediately. A stale CLAUDE.md causes the AI to run incorrect commands.
- **Duplicated context** — do not repeat information that exists in `RESTART.md` or `BACKLOG.md`. Link to it instead.

### Starter Template

```markdown
# CLAUDE.md — <Project Name>

Read this file at the start of every session.

## What is <Project Name>?

<One paragraph describing the project, its purpose, and its users.>

## Operating Protocol

1. Propose first, then implement. Wait for approval before making changes.
2. One commit per completed task with a detailed message.
3. Developer performs git push manually.
4. Run tests after each task and report the outcome.
5. Use British English throughout.

## Environment

- **Runtime:** <e.g. Node.js 20 via nvm>
- **Database:** <e.g. PostgreSQL 16 on port 5433>
- **Build:** `<build command>`
- **Test:** `<test command>`
- **Dev server:** `<start command>`

## Project Context

See `RESTART.md` for architecture and current status.
See `BACKLOG.md` for active work items.
```

---

## 4. MEMORY.md — Persistent AI Memory Index

### Purpose

The AI's memory system stores information that should persist across sessions: user preferences, feedback, project state, and references to external resources. `MEMORY.md` is the index file that points to individual memory files.

### What Goes Here

Links to memory files, organised by topic. Each memory file has its own frontmatter with a name, description, and type.

### What Does Not Go Here

- Memory content (that goes in individual files in the memory directory)
- Task lists or progress tracking (ephemeral, belongs in the session)
- Code patterns or architecture (derivable from the code itself)

### Anti-Patterns

- **Writing memory content directly into MEMORY.md** — this file is an index, not a store
- **Duplicate memories** — check for existing memories before creating new ones
- **Stale memories** — remove or update memories that are no longer accurate

### Starter Template

```markdown
# <Project Name> — Session Memory

Memory files are stored in this directory. Each file has frontmatter
with name, description, and type (user, feedback, project, reference).

## Index

<Links to memory files will be added as the project progresses.>
```

---

## 5. RESTART.md — Full Project Context

### Purpose

The "catch-up" document. Any developer (or AI) should be able to read this file and understand the project's current state: what has been built, how it fits together, what is known to be broken, and what the immediate priorities are.

### What Goes Here

- Architecture overview (database schema, service structure, API design)
- Completed features (what has been built and when)
- Known issues and technical debt
- Current status (what is in progress, what is blocked)
- Key technical decisions and their rationale

### What Does Not Go Here

- Operating instructions (those go in `CLAUDE.md`)
- Task breakdowns (those go in `BACKLOG.md`)
- Detailed API documentation (that belongs in dedicated docs)

### Anti-Patterns

- **Stale RESTART.md** — if the architecture changes and this file is not updated, the next session starts with incorrect assumptions. Update it after every significant change.
- **Too much detail** — this is a context document, not a specification. Keep it scannable. Link to detailed documentation where it exists.
- **Missing rationale** — recording what was built without explaining why leads to confusion when future developers question the design.

### Starter Template

```markdown
# RESTART.md — <Project Name>

Last updated: <date>

## Architecture

<High-level description of the system architecture.>

## Completed Work

<List of completed features with dates.>

## Known Issues

<Known bugs, technical debt, or limitations.>

## Current Status

<What is in progress and what is next.>
```

---

## 6. BACKLOG.md — Active Work Items

### Purpose

The prioritised list of work to be done. Replaces verbal handoffs, sticky notes, and scattered issue trackers for the immediate development context.

### What Goes Here

- Prioritised work items with brief descriptions
- Status indicators (not started, in progress, blocked, done)
- Grouping by theme or milestone where helpful

### What Does Not Go Here

- Completed work history (that goes in `RESTART.md`)
- Detailed specifications (link to them instead)
- Long-term roadmap items that are not yet actionable

### Anti-Patterns

- **Backlog as wishlist** — if items have been on the backlog for months without being actioned, they are not backlog items. Archive or delete them.
- **Missing priorities** — an unordered list is not a backlog. Items must be in priority order.
- **Stale status** — update status as work progresses. A backlog that shows items as "in progress" from three weeks ago is worse than no backlog at all.

### Starter Template

```markdown
# <Project Name> — Active Backlog

Updated: <date>

## In Progress

- <item> — <brief description>

## Next Up

- <item> — <brief description>
- <item> — <brief description>

## Parked

- <item> — <reason for parking>
```

---

## 7. Session Capture Configuration

### .claude/hooks.json

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "type": "command",
        "command": "<absolute-path-to>/capture-session.sh",
        "timeout": 10000
      }
    ]
  }
}
```

### .claude/.env

```
EVIDENCE_REPO=<absolute-path-to-evidence-repo>
PROJECT_NAME=<project-name>
```

### Evidence Repository Setup

```bash
# Create the evidence repo (once, per organisation or per project)
mkdir ~/evidence-repo && cd ~/evidence-repo && git init

# Optional: connect to a remote
git remote add origin <remote-url>
```

The evidence repository is separate from the project repository. See `STANDARDS.md` Section 8 for the directory structure and naming conventions.

---

## 8. .gitignore Essentials

Every project must include these exclusions at minimum:

```gitignore
# Credentials and environment
.env
.env.*
*.pem
*.key

# AI tool configuration (contains local paths)
.claude/.env

# OS and editor metadata
.DS_Store
Thumbs.db
*.swp
*.swo
*~

# Dependencies (installed, not committed)
node_modules/
vendor/
__pycache__/
```

Note: `.claude/hooks.json` should be committed (it contains no secrets and ensures session capture works for all developers). `.claude/.env` should not be committed (it contains local file paths).

---

## 9. How These Files Relate to R&D Evidence

| File | R&D Evidence Role |
|------|-------------------|
| `CLAUDE.md` | Documents the systematic methodology (how the project is structured and managed) |
| `RESTART.md` | Documents the baseline (what existed before) and advances (what was achieved) |
| `BACKLOG.md` | Documents the planned investigation (what uncertainties are being addressed) |
| `MEMORY.md` | Documents the competent professional's preferences, feedback, and accumulated knowledge |
| Session transcripts | Contemporaneous evidence of systematic investigation by a competent professional |
| Commit history | Granular evidence of iterative progress and decision-making |

Together, these files create a complete evidence chain from project inception through to delivery, without any retrospective documentation effort.

---

## 10. New Project Checklist

When starting a new project:

- [ ] Create the project repository
- [ ] Create `CLAUDE.md` from the starter template
- [ ] Create `RESTART.md` with initial architecture notes
- [ ] Create `BACKLOG.md` with initial priorities
- [ ] Set up `.claude/hooks.json` for session capture
- [ ] Set up `.claude/.env` with evidence repo path
- [ ] Verify `.gitignore` includes credential exclusions
- [ ] Create or verify the evidence repository exists
- [ ] Run a test session to confirm capture works
- [ ] If R&D work is anticipated, create the R&D project narrative in the evidence repo

---

*Loman Cavendish Limited — Standard project file structure for AI-assisted development.*

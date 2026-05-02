<!--
  Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi.mcburnie@gmail.com
-->

# Contributing to CRANIS2

## Development Session Recording

All contributors using AI coding assistants (Claude Code, Cursor, etc.) are encouraged to record their development sessions. This serves three purposes:

1. **R&D evidence** — recorded sessions demonstrate human-directed engineering effort for R&D tax credit claims
2. **IP preservation** — architectural decisions and design rationale are captured permanently
3. **Session continuity** — AI assistants can read previous sessions for better context

### Setup

You need a **separate git repository** for evidence. Do not commit session transcripts to the main CRANIS2 repo.

```bash
# Create your evidence repo
mkdir ~/cranis2-evidence && cd ~/cranis2-evidence && git init

# Or clone from Forgejo
git clone https://your-forgejo/org/cranis2-evidence.git ~/cranis2-evidence

# Run the setup script from the CRANIS2 project
cd ~/cranis2
./tools/session-capture/setup-hooks.sh ~/cranis2-evidence
```

This configures Claude Code to automatically capture sessions. See `tools/session-capture/README.md` for full documentation.

### How it works

At the end of each Claude Code session, the conversation transcript is automatically saved to your evidence repo as a timestamped Markdown file. No manual action required after initial setup.

### Privacy

Session transcripts are stored in YOUR repository. You control the data. Review, edit, or delete sessions before pushing to a remote.

---

## Development Standards

- **British English** throughout all code, documentation, and UI text
- Follow the **Editorial Standard** (`docs/EDITORIAL-STANDARD.md`)
- Follow the **Help Guide Standard** (`docs/HELP-GUIDE-STANDARD.md`) for help pages
- Follow the **Beck Map Design Spec** (`docs/BECK-MAP-DESIGN-SPEC.md`) for help page diagrams
- Use the **becksmap generator** (`tools/becksmap/`) for new help pages

## Testing

Always use the isolated test stack (port 3011), never the dev stack (port 3001):

```bash
./scripts/test-stack.sh run
```

See `CLAUDE.md` for full testing instructions.

## Commits

- One commit per completed task
- Concise subject line, detailed body
- Include `Co-Authored-By` header when working with AI assistants

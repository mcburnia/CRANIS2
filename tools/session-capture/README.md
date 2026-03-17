# CRANIS2 Session Capture

Automatically records Claude Code development sessions to a separate evidence repository for R&D evidence, IP preservation, and session continuity.

## Why

Development conversations between engineers and AI assistants contain valuable evidence:

- **R&D tax credits** — proof of human-directed technological investigation
- **Intellectual property** — architectural decisions, novel ideas, design rationale
- **Session continuity** — next session can read previous conversations for full context
- **Competence evidence** — demonstrates engineering expertise for regulatory claims

Without capture, this evidence is lost when the conversation window closes.

## Setup

### 1. Create an evidence repository

The evidence repo must be separate from your main project repository. Developer conversations should not be mixed with production code.

```bash
# Option A: Local repo
mkdir ~/my-project-evidence && cd ~/my-project-evidence && git init

# Option B: Clone from Forgejo/GitHub
git clone https://your-forgejo-instance/org/evidence.git ~/my-project-evidence
```

### 2. Run the setup script

```bash
./tools/session-capture/setup-hooks.sh ~/my-project-evidence
```

This creates:
- `.claude/hooks.json` — Claude Code hooks configuration
- `.claude/.env` — environment variables for the capture script

### 3. Start developing

That's it. At the end of each Claude Code session, the conversation transcript is automatically committed to your evidence repository.

### 4. Push evidence to remote (optional)

```bash
cd ~/my-project-evidence
git remote add origin https://your-forgejo/org/evidence.git
git push -u origin main
```

## How it works

1. Claude Code fires a `session_end` hook when the conversation ends
2. The hook runs `capture-session.sh` which receives the conversation
3. The transcript is saved as a timestamped Markdown file with frontmatter metadata
4. The file is committed to the evidence repository

## File structure

```
evidence-repo/
  sessions/
    your-project/
      2026-03-17-143022.md    ← session transcript
      2026-03-17-160445.md
      2026-03-18-091200.md
```

Each file contains:
- YAML frontmatter (project, contributor, date, tool)
- Full conversation transcript

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CRANIS2_EVIDENCE_REPO` | Path to evidence git repo | *(required)* |
| `CRANIS2_PROJECT_NAME` | Project name | Directory name |
| `CRANIS2_CONTRIBUTOR` | Your name | `git config user.name` |

## Integration with CRANIS2 SEE

If you're using CRANIS2's Software Evidence Engine, recorded sessions can be analysed for:

- **Competence profiling** — technical domains demonstrated, industry standard awareness
- **R&D evidence reports** — sessions referenced as supporting evidence
- **Decision quality assessment** — engineering reasoning and design trade-offs

Use the SEE Session APIs to import session data into your CRANIS2 product analysis.

## Privacy

- Sessions are stored in YOUR repository — you control the data
- The capture script runs locally — no data is sent to external services
- You can review, edit, or delete any session file before pushing
- `.claude/.env` and `.claude/hooks.json` are local configuration only

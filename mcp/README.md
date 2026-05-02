<!--
  Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
  SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary

  This file is part of CRANIS2 — a personally-owned, personally-funded
  software product. Unauthorised copying, modification, distribution,
  or commercial use is prohibited. For licence enquiries:
  andi.mcburnie@gmail.com
-->

# CRANIS2 MCP Server

CRA compliance tools for IDE AI assistants. Lets developers query vulnerabilities, get mitigation commands, and verify fixes — all from their editor.

## What it does

1. **List vulnerabilities** for your products with severity, affected package, and CVE details
2. **Get a fix command** — ecosystem-aware bash commands (npm, pip, cargo, go, maven, nuget, etc.)
3. **Verify the fix** — triggers a CRANIS2 SBOM rescan to confirm the vulnerability is resolved
4. **Check compliance** — pass/fail against configurable severity thresholds

## Prerequisites

- A CRANIS2 account with **Pro plan**
- An API key (generate at Settings > Integrations > API Keys)
- Node.js 18+

## Setup

### 1. Build

```bash
cd mcp
npm install
npm run build
```

### 2. Configure your IDE

#### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `~/.config/Claude/claude_desktop_config.json` (Linux):

```json
{
  "mcpServers": {
    "cranis2": {
      "command": "node",
      "args": ["/path/to/cranis2/mcp/dist/index.js"],
      "env": {
        "CRANIS2_API_KEY": "cranis2_your_key_here",
        "CRANIS2_API_URL": "https://dev.cranis2.dev"
      }
    }
  }
}
```

#### VS Code (GitHub Copilot)

Create `.vscode/mcp.json` in your project:

```json
{
  "servers": {
    "cranis2": {
      "command": "node",
      "args": ["/path/to/cranis2/mcp/dist/index.js"],
      "env": {
        "CRANIS2_API_KEY": "cranis2_your_key_here",
        "CRANIS2_API_URL": "https://dev.cranis2.dev"
      }
    }
  }
}
```

#### Cursor

Settings > MCP > Add Server:

- **Name:** cranis2
- **Command:** `node /path/to/cranis2/mcp/dist/index.js`
- **Environment:** `CRANIS2_API_KEY=cranis2_your_key_here`, `CRANIS2_API_URL=https://dev.cranis2.dev`

#### Claude Code

Add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "cranis2": {
      "command": "node",
      "args": ["/path/to/cranis2/mcp/dist/index.js"],
      "env": {
        "CRANIS2_API_KEY": "cranis2_your_key_here",
        "CRANIS2_API_URL": "https://dev.cranis2.dev"
      }
    }
  }
}
```

## Available tools

| Tool | Description |
|------|-------------|
| `list_products` | List all products in your CRANIS2 organisation |
| `get_vulnerabilities` | Get vulnerability findings for a product (filterable by severity/status) |
| `get_mitigation` | Get a bash command to fix a specific vulnerability |
| `verify_fix` | Trigger SBOM rescan, confirm fix applied, update CRANIS2 |
| `get_compliance_status` | Pass/fail compliance check against severity threshold |

## Example workflow

```
You: "What vulnerabilities does my project have?"
AI:  [calls list_products, then get_vulnerabilities]
     "Found 3 critical vulnerabilities. The most urgent is CVE-2024-1234
      in lodash@4.17.11. Run: npm install lodash@4.17.21"

You: *runs the command in terminal*

You: "Verify my fix"
AI:  [calls verify_fix]
     "Verification passed — lodash@4.17.11 is no longer flagged.
      The finding has been marked as resolved in CRANIS2."
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CRANIS2_API_KEY` | Yes | Your CRANIS2 API key (starts with `cranis2_`) |
| `CRANIS2_API_URL` | No | API base URL (default: `https://dev.cranis2.dev`) |

## API scopes

The MCP server requires an API key with the following scopes:

- `read:products` — list products
- `read:vulnerabilities` — read vulnerability findings and scan status
- `read:compliance` — read compliance status
- `write:findings` — trigger syncs and resolve findings

New API keys include all scopes by default.

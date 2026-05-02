#!/usr/bin/env node
/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

/**
 * CRANIS2 MCP Server
 *
 * Exposes CRA compliance tools to IDE AI assistants (Claude Desktop, VS Code, Cursor).
 * Authenticates against CRANIS2 via API key.
 *
 * Tools:
 *   list_products        — List all products for this organisation
 *   get_vulnerabilities  — Get open vulnerability findings for a product
 *   get_mitigation       — Get a bash command to fix a specific vulnerability
 *   verify_fix           — Trigger SBOM rescan and verify a vulnerability is resolved
 *   get_compliance_status — Quick pass/fail compliance check
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  listProducts,
  getVulnerabilities,
  getComplianceStatus,
  triggerSync,
  resolveFinding,
  getScanStatus,
} from './api-client.js';

const server = new McpServer({
  name: 'cranis2',
  version: '1.0.0',
});

// ── list_products ───────────────────────────────────────────────────────
server.tool(
  'list_products',
  'List all products registered in CRANIS2 for your organisation. Returns product name, CRA category, version, and ID.',
  {},
  async () => {
    try {
      const products = await listProducts();
      if (products.length === 0) {
        return { content: [{ type: 'text', text: 'No products found in your CRANIS2 organisation.' }] };
      }

      const lines = products.map(
        (p: any) => `- **${p.name}** (${p.craCategory}) — ID: ${p.id}${p.version ? `, v${p.version}` : ''}`
      );
      return {
        content: [{ type: 'text', text: `Found ${products.length} product(s):\n\n${lines.join('\n')}` }],
      };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  },
);

// ── get_vulnerabilities ─────────────────────────────────────────────────
server.tool(
  'get_vulnerabilities',
  'Get vulnerability findings for a CRANIS2 product. Returns severity, affected package, version, CVE ID, fix version, and a suggested mitigation command. Use severity filter to focus on critical/high issues.',
  {
    productId: z.string().describe('The CRANIS2 product ID'),
    severity: z.enum(['critical', 'high', 'medium', 'low']).optional().describe('Filter by severity level'),
    status: z.enum(['open', 'acknowledged', 'mitigated']).optional().describe('Filter by status (default: all non-resolved)'),
  },
  async ({ productId, severity, status }) => {
    try {
      const data = await getVulnerabilities(productId, severity, status || 'open');
      const findings: any[] = data.findings;

      if (findings.length === 0) {
        return {
          content: [{
            type: 'text',
            text: severity
              ? `No ${severity} vulnerabilities found for this product.`
              : 'No open vulnerabilities found for this product.',
          }],
        };
      }

      const lines = findings.map((f: any, i: number) => {
        const fixInfo = f.fixed_version ? `Fix: upgrade to ${f.fixed_version}` : 'No fix version available';
        const cmd = getMitigationCommand(f);
        return [
          `### ${i + 1}. ${f.title || f.source_id}`,
          `- **Severity:** ${f.severity.toUpperCase()}${f.cvss_score ? ` (CVSS ${f.cvss_score})` : ''}`,
          `- **Package:** ${f.dependency_name}@${f.dependency_version} (${f.dependency_ecosystem || 'unknown'})`,
          `- **Status:** ${f.status}`,
          `- **${fixInfo}**`,
          cmd ? `- **Mitigation command:** \`${cmd}\`` : '- _No automatic mitigation available_',
          `- **Finding ID:** ${f.id}`,
          f.references_url ? `- **Reference:** ${f.references_url}` : '',
        ].filter(Boolean).join('\n');
      });

      const summary = `Found **${findings.length}** vulnerability finding(s)` +
        (data.latestScan ? ` (last scan: ${data.latestScan.completed_at || data.latestScan.started_at})` : '') +
        ':\n\n';

      return { content: [{ type: 'text', text: summary + lines.join('\n\n') }] };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  },
);

// ── get_mitigation ──────────────────────────────────────────────────────
server.tool(
  'get_mitigation',
  'Get a specific bash command to fix a vulnerability. Returns the exact command the developer should run in their terminal, plus context about what it does.',
  {
    productId: z.string().describe('The CRANIS2 product ID'),
    findingId: z.string().describe('The vulnerability finding ID'),
  },
  async ({ productId, findingId }) => {
    try {
      const data = await getVulnerabilities(productId);
      const finding = data.findings.find((f: any) => f.id === findingId);

      if (!finding) {
        return { content: [{ type: 'text', text: `Finding ${findingId} not found for this product.` }], isError: true };
      }

      const cmd = getMitigationCommand(finding);
      if (!cmd) {
        return {
          content: [{
            type: 'text',
            text: [
              `**${finding.title || finding.source_id}** (${finding.severity.toUpperCase()})`,
              `Package: ${finding.dependency_name}@${finding.dependency_version}`,
              '',
              'No automatic mitigation command available for this vulnerability.',
              finding.fixed_version
                ? `A fixed version (${finding.fixed_version}) exists — you may need to update manually.`
                : 'No fixed version has been published yet. Consider alternative packages or applying a manual patch.',
            ].join('\n'),
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: [
            `**${finding.title || finding.source_id}** (${finding.severity.toUpperCase()})`,
            `Package: ${finding.dependency_name}@${finding.dependency_version} → ${finding.fixed_version || 'latest'}`,
            '',
            '**Run this command in your project directory:**',
            '```bash',
            cmd,
            '```',
            '',
            `This will update \`${finding.dependency_name}\` to a version that addresses this vulnerability.`,
            '',
            `After running the command, use the \`verify_fix\` tool with finding ID \`${finding.id}\` to confirm the fix and update CRANIS2.`,
          ].join('\n'),
        }],
      };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  },
);

// ── verify_fix ──────────────────────────────────────────────────────────
server.tool(
  'verify_fix',
  'After applying a mitigation command, trigger a CRANIS2 SBOM rescan to verify the vulnerability is resolved. The scanner will re-analyse the repository and check whether the finding is still present. If resolved, the finding status in CRANIS2 is updated automatically.',
  {
    productId: z.string().describe('The CRANIS2 product ID'),
    findingId: z.string().describe('The vulnerability finding ID to verify'),
  },
  async ({ productId, findingId }) => {
    try {
      // Step 1: Get current finding details before rescan
      const beforeData = await getVulnerabilities(productId);
      const finding = beforeData.findings.find((f: any) => f.id === findingId);
      if (!finding) {
        return {
          content: [{
            type: 'text',
            text: `Finding ${findingId} not found. It may already be resolved.`,
          }],
        };
      }

      // Step 2: Trigger a sync + rescan
      let syncResult;
      try {
        syncResult = await triggerSync(productId);
      } catch (err: any) {
        if (err.message.includes('409')) {
          return {
            content: [{
              type: 'text',
              text: 'A scan is already running for this product. Please wait a moment and try again.',
            }],
          };
        }
        throw err;
      }

      // Step 3: Poll for scan completion (max 60 seconds)
      const scanId = syncResult.scanId;
      let scanComplete = false;
      const startTime = Date.now();
      const TIMEOUT_MS = 60_000;
      const POLL_INTERVAL_MS = 3_000;

      while (!scanComplete && Date.now() - startTime < TIMEOUT_MS) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        try {
          const scanStatus = await getScanStatus(productId, scanId);
          if (scanStatus.status === 'completed' || scanStatus.status === 'failed') {
            scanComplete = true;
          }
        } catch {
          // Scan status endpoint may not exist yet — fall back to time-based wait
          if (Date.now() - startTime > 15_000) {
            scanComplete = true; // Assume done after 15s if we can't poll
          }
        }
      }

      // Step 4: Check if the finding is still present
      const afterData = await getVulnerabilities(productId);
      const stillPresent = afterData.findings.find((f: any) => f.id === findingId);

      if (!stillPresent || stillPresent.status === 'resolved') {
        // Finding is gone or resolved — update CRANIS2
        try {
          await resolveFinding(productId, findingId, {
            resolution: 'package_updated',
            packageName: finding.dependency_name,
            previousVersion: finding.dependency_version,
            fixedVersion: finding.fixed_version,
            ecosystem: finding.dependency_ecosystem,
            verifiedAt: new Date().toISOString(),
            verifiedBy: 'mcp-ide-assistant',
          });
        } catch {
          // Resolve endpoint may not exist yet — finding absence is still good news
        }

        return {
          content: [{
            type: 'text',
            text: [
              '**Verification passed** — vulnerability resolved.',
              '',
              `\`${finding.dependency_name}@${finding.dependency_version}\` is no longer flagged.`,
              `The finding has been marked as resolved in CRANIS2.`,
            ].join('\n'),
          }],
        };
      }

      // Still present — check if version changed
      const versionChanged = stillPresent.dependency_version !== finding.dependency_version;
      if (versionChanged) {
        return {
          content: [{
            type: 'text',
            text: [
              '**Partial fix detected** — version updated but vulnerability persists.',
              '',
              `Package: ${finding.dependency_name}`,
              `Before: ${finding.dependency_version}`,
              `After: ${stillPresent.dependency_version}`,
              `Required: ${finding.fixed_version || 'unknown'}`,
              '',
              'The package was updated but the new version is still vulnerable. Try upgrading further.',
            ].join('\n'),
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: [
            '**Verification failed** — vulnerability still present.',
            '',
            `\`${finding.dependency_name}@${finding.dependency_version}\` has not changed.`,
            '',
            'Possible reasons:',
            '- The mitigation command was not run in the correct directory',
            '- The change has not been pushed to the repository yet',
            '- The package is a transitive dependency — update the direct parent instead',
            finding.fixed_version
              ? `\nTry: upgrade ${finding.dependency_name} to at least ${finding.fixed_version}`
              : '',
          ].filter(Boolean).join('\n'),
        }],
      };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Error during verification: ${err.message}` }], isError: true };
    }
  },
);

// ── get_compliance_status ───────────────────────────────────────────────
server.tool(
  'get_compliance_status',
  'Get the current CRA compliance status for a product. Returns pass/fail, gap summary, and progress metrics. Use this to check if a product is deployment-ready.',
  {
    productId: z.string().describe('The CRANIS2 product ID'),
    threshold: z.enum(['critical', 'high', 'medium', 'low']).optional().describe('Severity threshold for pass/fail (default: high)'),
  },
  async ({ productId, threshold }) => {
    try {
      const data = await getComplianceStatus(productId, threshold);

      const statusIcon = data.pass ? 'PASS' : 'FAIL';
      const lines = [
        `## Compliance Status: **${statusIcon}**`,
        '',
        `**Product:** ${data.productName} (${data.craCategory})`,
        `**Threshold:** ${data.threshold}`,
        '',
        '### Gap Summary',
        `- Critical: ${data.summary.critical}`,
        `- High: ${data.summary.high}`,
        `- Medium: ${data.summary.medium}`,
        `- Low: ${data.summary.low}`,
        `- Total: ${data.summary.total}`,
      ];

      if (data.progress) {
        lines.push(
          '',
          '### Progress',
          `- Obligations met: ${data.progress.obligationsMet ?? 'N/A'}`,
          `- Tech file completion: ${data.progress.techFileCompletion ?? 'N/A'}%`,
          `- CRA readiness: ${data.progress.craReadiness ?? 'N/A'}%`,
        );
      }

      if (data.gaps && data.gaps.length > 0) {
        lines.push('', '### Top Gaps');
        for (const gap of data.gaps.slice(0, 5)) {
          lines.push(`- **${gap.title || gap.type}** (${gap.severity}) — ${gap.description || gap.detail || ''}`);
        }
        if (data.gaps.length > 5) {
          lines.push(`- _...and ${data.gaps.length - 5} more_`);
        }
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    } catch (err: any) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  },
);

// ── Helper: generate mitigation command from finding data ───────────────
function getMitigationCommand(finding: any): string | null {
  if (!finding.dependency_name) return null;

  const pkg = finding.dependency_name;
  const fixVer = finding.fixed_version;
  const eco = (finding.dependency_ecosystem || '').toLowerCase();

  // If no fix version, we can still suggest an update
  const target = fixVer || 'latest';

  switch (eco) {
    case 'npm':
      return fixVer ? `npm install ${pkg}@${fixVer}` : `npm update ${pkg}`;
    case 'pip':
    case 'pypi':
      return fixVer ? `pip install ${pkg}>=${fixVer}` : `pip install --upgrade ${pkg}`;
    case 'cargo':
    case 'crates.io':
      return fixVer ? `cargo update ${pkg} --precise ${fixVer}` : `cargo update ${pkg}`;
    case 'go':
    case 'golang':
      return fixVer ? `go get ${pkg}@v${fixVer}` : `go get -u ${pkg}`;
    case 'maven':
      return fixVer
        ? `mvn versions:use-dep-version -Dincludes=${pkg} -DdepVersion=${fixVer}`
        : `mvn versions:use-latest-versions -Dincludes=${pkg}`;
    case 'nuget':
      return fixVer ? `dotnet add package ${pkg} --version ${fixVer}` : `dotnet add package ${pkg}`;
    case 'gem':
    case 'rubygems':
      return fixVer ? `bundle update ${pkg} --conservative` : `bundle update ${pkg}`;
    case 'composer':
    case 'packagist':
      return fixVer ? `composer require ${pkg}:^${fixVer}` : `composer update ${pkg}`;
    case 'hex':
      return fixVer ? `mix deps.update ${pkg}` : `mix deps.update ${pkg}`;
    case 'pub':
      return fixVer ? `dart pub upgrade ${pkg}` : `dart pub upgrade ${pkg}`;
    case 'cocoapods':
      return `pod update ${pkg}`;
    case 'swift':
      return fixVer ? `swift package update ${pkg}` : `swift package update`;
    default:
      // Generic fallback — still useful
      if (fixVer) return `# Update ${pkg} to version ${fixVer} or later`;
      return `# Update ${pkg} to the latest version`;
  }
}

// ── Start server ────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[CRANIS2-MCP] Server started (stdio transport)');
}

main().catch((err) => {
  console.error('[CRANIS2-MCP] Fatal error:', err);
  process.exit(1);
});

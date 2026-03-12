/**
 * Compliance Snapshot Service — P8 #40
 *
 * Assembles a self-contained compliance archive ZIP for a product.
 * Human-readable content in Markdown, machine-readable data in JSON.
 * SHA-256 manifest for integrity verification.
 */

import { createHash } from 'node:crypto';
import { mkdir, writeFile, stat, unlink } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import archiver from 'archiver';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { generateCycloneDX } from './sbom-service.js';
import { OBLIGATIONS, computeDerivedStatuses } from './obligation-engine.js';

// ── Snapshot storage root ──
const SNAPSHOT_ROOT = join(process.cwd(), 'data', 'snapshots');

// ── Types ──
interface SnapshotFile {
  path: string;
  content: string;
}

interface SnapshotResult {
  id: string;
  filename: string;
  filepath: string;
  sizeBytes: number;
  contentHash: string;
  metadata: Record<string, any>;
}

// ── Helper: SHA-256 of a string ──
function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

// ── Helper: format date for filenames ──
function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Helper: format date for display ──
function formatDate(d: string | Date | null): string {
  if (!d) return 'Not set';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Helper: format CRA category ──
function formatCategory(cat: string | null): string {
  const map: Record<string, string> = {
    default: 'Default',
    important_i: 'Important (Class I)',
    important_ii: 'Important (Class II)',
    critical: 'Critical',
  };
  return map[cat || 'default'] || 'Default';
}

// ── Helper: slugify product name ──
function slugify(name: string): string {
  return (name || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
}

// ══════════════════════════════════════════════════════════════
// Data collectors — each returns SnapshotFile[] and metadata
// ══════════════════════════════════════════════════════════════

async function collectProductMetadata(orgId: string, productId: string): Promise<{ files: SnapshotFile[]; product: any; org: any }> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p, o`,
      { orgId, productId }
    );
    if (result.records.length === 0) throw new Error('Product not found');

    const p = result.records[0].get('p').properties;
    const o = result.records[0].get('o').properties;

    const product = {
      id: p.id, name: p.name, description: p.description || '',
      version: p.version || '', productType: p.productType || '',
      craCategory: p.craCategory || 'default', repoUrl: p.repoUrl || '',
      distributionModel: p.distributionModel || null,
      lifecycleStatus: p.lifecycleStatus || null,
      status: p.status || 'active',
      createdAt: p.createdAt?.toString() || '',
      updatedAt: p.updatedAt?.toString() || '',
    };

    const org = {
      id: o.id, name: o.name, country: o.country || '',
      companySize: o.companySize || '', craRole: o.craRole || '',
      industry: o.industry || '', website: o.website || '',
      contactEmail: o.contactEmail || '',
    };

    return {
      files: [
        { path: 'product.json', content: JSON.stringify(product, null, 2) },
        { path: 'organisation.json', content: JSON.stringify(org, null, 2) },
      ],
      product,
      org,
    };
  } finally {
    await session.close();
  }
}

async function collectTechnicalFile(productId: string): Promise<{ files: SnapshotFile[]; sectionCount: number; completedCount: number }> {
  const result = await pool.query(
    `SELECT section_key, title, content, notes, status, cra_reference, updated_by, updated_at
     FROM technical_file_sections WHERE product_id = $1 ORDER BY created_at ASC`,
    [productId]
  );

  const files: SnapshotFile[] = [];
  let completedCount = 0;

  // JSON export of all sections
  files.push({
    path: 'technical-file/sections.json',
    content: JSON.stringify(result.rows, null, 2),
  });

  // Individual Markdown files per section
  for (const row of result.rows) {
    if (row.status === 'completed') completedCount++;

    const content = typeof row.content === 'string' ? JSON.parse(row.content) : (row.content || {});
    let md = `# ${row.title}\n\n`;
    md += `**CRA Reference:** ${row.cra_reference || 'N/A'}  \n`;
    md += `**Status:** ${row.status}  \n`;
    md += `**Last updated:** ${formatDate(row.updated_at)}  \n`;
    if (row.updated_by) md += `**Updated by:** ${row.updated_by}  \n`;
    md += '\n---\n\n';

    // Render content fields
    if (content.fields) {
      for (const [key, value] of Object.entries(content.fields)) {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        md += `## ${label}\n\n${value || '*Not yet completed*'}\n\n`;
      }
    }
    if (content.standards && Array.isArray(content.standards)) {
      md += '## Standards\n\n';
      for (const s of content.standards) {
        const name = typeof s === 'string' ? s : (s.name || s.reference || JSON.stringify(s));
        const scope = typeof s === 'object' && s.scope ? ` — ${s.scope}` : '';
        md += `- ${name}${scope}\n`;
      }
      md += '\n';
    }
    if (content.reports && Array.isArray(content.reports)) {
      md += '## Test Reports\n\n';
      for (const r of content.reports) {
        md += `### ${r.type || 'Report'} (${r.date || 'Unknown date'})\n\n`;
        if (r.tool) md += `**Tool:** ${r.tool}  \n`;
        if (r.summary) md += `${r.summary}\n`;
        md += '\n';
      }
    }

    if (row.notes) {
      md += `## Notes\n\n${row.notes}\n`;
    }

    files.push({
      path: `technical-file/${row.section_key}.md`,
      content: md,
    });
  }

  return { files, sectionCount: result.rows.length, completedCount };
}

async function collectDeclarationOfConformity(orgId: string, productId: string, product: any, org: any): Promise<SnapshotFile[]> {
  const sectResult = await pool.query(
    `SELECT section_key, content, status
     FROM technical_file_sections
     WHERE product_id = $1 AND section_key IN ('declaration_of_conformity', 'standards_applied')`,
    [productId]
  );

  let docFields: Record<string, string> = {};
  let docStatus = 'not_started';
  let standardsList: any[] = [];

  for (const row of sectResult.rows) {
    const content = typeof row.content === 'string' ? JSON.parse(row.content) : (row.content || {});
    if (row.section_key === 'declaration_of_conformity') {
      docFields = content.fields || {};
      docStatus = row.status;
    } else if (row.section_key === 'standards_applied') {
      standardsList = content.standards || [];
    }
  }

  const isDraft = docStatus !== 'completed';
  const ceDate = docFields.ce_marking_date;
  const dateStr = ceDate
    ? formatDate(ceDate)
    : formatDate(new Date());

  let md = '';
  if (isDraft) md += '> **DRAFT — Not yet finalised**\n\n';
  md += '# EU DECLARATION OF CONFORMITY\n\n';
  md += '*Regulation (EU) 2024/2847 — Cyber Resilience Act*\n\n';
  if (docFields.certificate_reference) {
    md += `**No.** ${docFields.certificate_reference}\n\n`;
  }
  md += '---\n\n';

  md += `**1. Product name and type**  \n${product.name}\n\n`;

  const mfgLine = `${org.name}${org.country ? ', ' + org.country : ''}`;
  md += `**2. Manufacturer name and address**  \n${mfgLine}\n\n`;

  md += '**3. Responsibility**  \nThis declaration of conformity is issued under the sole responsibility of the manufacturer.\n\n';

  md += `**4. Object of the declaration**  \n${product.name} (CRA Category: ${formatCategory(product.craCategory)})\n\n`;

  md += '**5. Legislative basis**  \n';
  md += 'The object of the declaration described above is in conformity with the relevant Union harmonisation legislation:\n\n';
  md += 'Regulation (EU) 2024/2847 of the European Parliament and of the Council of 23 October 2024 ';
  md += 'on horizontal cybersecurity requirements for products with digital elements (Cyber Resilience Act) ';
  md += 'and its national implementing measures.\n\n';

  md += '**6. Harmonised standards and technical specifications**  \n';
  if (standardsList.length > 0) {
    for (const s of standardsList) {
      const name = typeof s === 'string' ? s : (s.name || s.reference || JSON.stringify(s));
      md += `- ${name}\n`;
    }
  } else {
    md += 'No harmonised standards specified. See Technical File, Section 5 for the full standards assessment.\n';
  }
  md += '\n';

  if (docFields.notified_body) {
    md += `**7. Notified body (where applicable)**  \n${docFields.notified_body}\n`;
    if (docFields.certificate_reference) md += `Certificate reference: ${docFields.certificate_reference}\n`;
    md += '\n';
  }

  if (docFields.declaration_text) {
    md += `**8. Additional information**  \n${docFields.declaration_text}\n\n`;
  }

  if (docFields.assessment_module) {
    md += `**Conformity assessment procedure:** Module ${docFields.assessment_module}\n\n`;
  }

  md += '---\n\n';
  md += `**Signed for and on behalf of:** ${org.name}${org.country ? ', ' + org.country : ''}\n\n`;
  md += `**Place and date of issue:** ${dateStr}${org.country ? ', ' + org.country : ''}\n\n`;
  md += '\\______________________________  \n*Authorised signatory*\n\n';
  md += `---\n*EU Declaration of Conformity — generated by CRANIS2 — ${formatDate(new Date())}*\n`;

  return [{ path: 'declaration-of-conformity.md', content: md }];
}

async function collectSBOMs(orgId: string, productId: string): Promise<{ files: SnapshotFile[]; packageCount: number }> {
  const files: SnapshotFile[] = [];
  let packageCount = 0;

  const sbomResult = await pool.query(
    'SELECT spdx_json, package_count, synced_at, sbom_source FROM product_sboms WHERE product_id = $1',
    [productId]
  );

  if (sbomResult.rows[0]?.spdx_json) {
    files.push({
      path: 'sbom/sbom-spdx.json',
      content: JSON.stringify(sbomResult.rows[0].spdx_json, null, 2),
    });
    packageCount = sbomResult.rows[0].package_count || 0;
  }

  try {
    const { cyclonedx } = await generateCycloneDX(orgId, productId);
    files.push({
      path: 'sbom/sbom-cyclonedx.json',
      content: JSON.stringify(cyclonedx, null, 2),
    });
  } catch { /* no CycloneDX data available */ }

  return { files, packageCount };
}

async function collectVulnerabilities(orgId: string, productId: string): Promise<{ files: SnapshotFile[]; stats: Record<string, number> }> {
  const files: SnapshotFile[] = [];
  const stats = { total: 0, critical: 0, high: 0, medium: 0, low: 0, open: 0, resolved: 0 };

  // Scan metadata
  const scans = await pool.query(
    `SELECT id, status, source, findings_count, critical_count, high_count, medium_count, low_count,
            started_at, completed_at, created_at
     FROM vulnerability_scans WHERE product_id = $1 AND org_id = $2
     ORDER BY created_at DESC`,
    [productId, orgId]
  );
  if (scans.rows.length > 0) {
    files.push({ path: 'vulnerabilities/scans.json', content: JSON.stringify(scans.rows, null, 2) });
  }

  // Findings
  const findings = await pool.query(
    `SELECT source, source_id, severity, cvss_score, title, description, status,
            dependency_name, dependency_version, dependency_purl, fixed_version,
            mitigation, mitigation_notes, dismissed_reason,
            created_at, updated_at, resolved_at
     FROM vulnerability_findings WHERE product_id = $1 AND org_id = $2
     ORDER BY severity, dependency_name`,
    [productId, orgId]
  );

  if (findings.rows.length > 0) {
    files.push({ path: 'vulnerabilities/findings.json', content: JSON.stringify(findings.rows, null, 2) });

    stats.total = findings.rows.length;
    for (const f of findings.rows) {
      if (f.severity === 'critical') stats.critical++;
      else if (f.severity === 'high') stats.high++;
      else if (f.severity === 'medium') stats.medium++;
      else if (f.severity === 'low') stats.low++;
      if (f.status === 'open' || f.status === 'acknowledged') stats.open++;
      else stats.resolved++;
    }
  }

  return { files, stats };
}

async function collectObligations(orgId: string, productId: string, craCategory: string): Promise<{ files: SnapshotFile[]; stats: Record<string, number> }> {
  const files: SnapshotFile[] = [];
  const stats = { total: 0, met: 0, in_progress: 0, not_started: 0 };

  // Manual statuses
  const obligations = await pool.query(
    `SELECT obligation_key, status, notes, evidence_url, evidence_filename,
            due_date, is_custom, custom_title, custom_description,
            updated_by, updated_at, created_at
     FROM obligations WHERE product_id = $1 AND org_id = $2`,
    [productId, orgId]
  );

  // Derived statuses
  const categoryMap: Record<string, string | null> = { [productId]: craCategory };
  const derived = await computeDerivedStatuses([productId], orgId, categoryMap);
  const derivedMap = derived[productId] || {};

  // Merge manual + derived + definitions
  const applicableObs = OBLIGATIONS.filter(o =>
    o.appliesTo.includes(craCategory || 'default')
  );

  const manualMap: Record<string, any> = {};
  for (const row of obligations.rows) {
    manualMap[row.obligation_key] = row;
  }

  const merged = applicableObs.map(def => {
    const manual = manualMap[def.key] || {};
    const derivedInfo = derivedMap[def.key] || {};
    const manualStatus = manual.status || 'not_started';
    const derivedStatus = derivedInfo.status || 'not_started';

    // Effective = max(manual, derived)
    const statusOrder = ['not_started', 'in_progress', 'met'];
    const effective = statusOrder.indexOf(manualStatus) >= statusOrder.indexOf(derivedStatus)
      ? manualStatus : derivedStatus;

    return {
      obligationKey: def.key,
      article: def.article,
      title: def.title,
      description: def.description,
      manualStatus,
      derivedStatus,
      derivedReason: derivedInfo.reason || null,
      effectiveStatus: effective,
      notes: manual.notes || null,
      evidenceUrl: manual.evidence_url || null,
      dueDate: manual.due_date || null,
      updatedBy: manual.updated_by || null,
      updatedAt: manual.updated_at || null,
    };
  });

  stats.total = merged.length;
  for (const o of merged) {
    if (o.effectiveStatus === 'met') stats.met++;
    else if (o.effectiveStatus === 'in_progress') stats.in_progress++;
    else stats.not_started++;
  }

  files.push({ path: 'obligations/obligations.json', content: JSON.stringify(merged, null, 2) });

  // Markdown summary
  let md = '# CRA Obligation Status\n\n';
  md += `**Total obligations:** ${stats.total}  \n`;
  md += `**Met:** ${stats.met} | **In progress:** ${stats.in_progress} | **Not started:** ${stats.not_started}\n\n`;
  md += '---\n\n';

  for (const o of merged) {
    const icon = o.effectiveStatus === 'met' ? '[MET]'
      : o.effectiveStatus === 'in_progress' ? '[IN PROGRESS]'
      : '[NOT STARTED]';
    md += `## ${o.article} — ${o.title} ${icon}\n\n`;
    md += `${o.description}\n\n`;
    if (o.derivedReason) md += `**Derived evidence:** ${o.derivedReason}  \n`;
    if (o.notes) md += `**Notes:** ${o.notes}  \n`;
    if (o.dueDate) md += `**Due date:** ${formatDate(o.dueDate)}  \n`;
    if (o.updatedBy) md += `**Last updated by:** ${o.updatedBy} on ${formatDate(o.updatedAt)}  \n`;
    md += '\n';
  }

  files.push({ path: 'obligations/obligations.md', content: md });

  return { files, stats };
}

async function collectActivityLog(orgId: string, productId: string): Promise<{ files: SnapshotFile[]; entryCount: number }> {
  const result = await pool.query(
    `SELECT id, user_email, action, entity_type, entity_id, summary,
            old_values, new_values, metadata, created_at
     FROM product_activity_log WHERE product_id = $1 AND org_id = $2
     ORDER BY created_at DESC`,
    [productId, orgId]
  );

  const files: SnapshotFile[] = [];
  if (result.rows.length > 0) {
    files.push({ path: 'activity-log/activity.json', content: JSON.stringify(result.rows, null, 2) });
  }

  return { files, entryCount: result.rows.length };
}

async function collectCraReports(orgId: string, productId: string): Promise<SnapshotFile[]> {
  const reports = await pool.query(
    `SELECT id, report_type, status, awareness_at, created_at, updated_at
     FROM cra_reports WHERE product_id = $1 AND org_id = $2
     ORDER BY created_at DESC`,
    [productId, orgId]
  );

  if (reports.rows.length === 0) return [];

  // Get stages for each report
  const reportIds = reports.rows.map(r => r.id);
  const stages = await pool.query(
    `SELECT report_id, stage, content, submitted_by, submitted_at
     FROM cra_report_stages WHERE report_id = ANY($1)
     ORDER BY submitted_at ASC`,
    [reportIds]
  );

  const stageMap: Record<string, any[]> = {};
  for (const s of stages.rows) {
    if (!stageMap[s.report_id]) stageMap[s.report_id] = [];
    stageMap[s.report_id].push(s);
  }

  const enriched = reports.rows.map(r => ({
    ...r,
    stages: stageMap[r.id] || [],
  }));

  return [{ path: 'cra-reports/reports.json', content: JSON.stringify(enriched, null, 2) }];
}

async function collectStakeholders(orgId: string, productId: string): Promise<SnapshotFile[]> {
  const result = await pool.query(
    'SELECT role_key, name, email, organisation, created_at FROM stakeholders WHERE product_id = $1 AND org_id = $2',
    [productId, orgId]
  );
  if (result.rows.length === 0) return [];
  return [{ path: 'stakeholders.json', content: JSON.stringify(result.rows, null, 2) }];
}

// ── README generator ──
function generateReadme(product: any, org: any, metadata: Record<string, any>): string {
  const now = formatDate(new Date());

  return `# Compliance Archive — ${product.name}

**Generated:** ${now}
**Product:** ${product.name} (v${product.version || 'unset'})
**Organisation:** ${org.name}
**CRA Category:** ${formatCategory(product.craCategory)}
**Generated by:** CRANIS2 (https://cranis2.dev)

---

## Purpose

This archive is a self-contained compliance snapshot for **${product.name}** under the
EU Cyber Resilience Act (Regulation (EU) 2024/2847). It contains all documentation
required by Art. 13(10) for retention over at least 10 years from market placement.

This archive is **readable without CRANIS2** — all human-readable documents are in
Markdown format and all machine-readable data is in JSON format.

---

## Archive Structure

\`\`\`
README.md                          This file
MANIFEST.sha256                    SHA-256 checksums of every file
declaration-of-conformity.md       EU Declaration of Conformity (Annex V)
product.json                       Product metadata
organisation.json                  Organisation metadata
stakeholders.json                  Compliance stakeholders

technical-file/                    CRA Annex VII Technical Documentation
  sections.json                    All 8 sections (machine-readable)
  product_description.md           Section 1: Product Description
  design_development.md            Section 2: Design & Development
  vulnerability_handling.md        Section 3: Vulnerability Handling
  risk_assessment.md               Section 4: Risk Assessment
  standards_applied.md             Section 5: Standards Applied
  test_reports.md                  Section 6: Test Reports
  support_period.md                Section 7: Support Period
  declaration_of_conformity.md     Section 8: Declaration of Conformity

sbom/                              Software Bill of Materials
  sbom-spdx.json                   SPDX 2.3 format
  sbom-cyclonedx.json              CycloneDX format

vulnerabilities/                   Vulnerability Management Evidence
  scans.json                       Scan run history
  findings.json                    All vulnerability findings with triage decisions

obligations/                       CRA Obligation Compliance
  obligations.json                 All obligations with manual + derived statuses
  obligations.md                   Human-readable obligation summary

activity-log/                      Audit Trail
  activity.json                    Full product activity log

cra-reports/                       ENISA Vulnerability Reports (Art. 14)
  reports.json                     Report history with submission stages
\`\`\`

---

## Snapshot Summary

| Metric | Value |
|--------|-------|
| Technical file sections | ${metadata.techFile?.sectionCount || 0} (${metadata.techFile?.completedCount || 0} completed) |
| SBOM components | ${metadata.sbom?.packageCount || 0} |
| Vulnerability findings | ${metadata.vulns?.total || 0} (${metadata.vulns?.open || 0} open) |
| Obligations | ${metadata.obligations?.total || 0} (${metadata.obligations?.met || 0} met) |
| Activity log entries | ${metadata.activityCount || 0} |

---

## Integrity Verification

Every file in this archive has a SHA-256 checksum recorded in \`MANIFEST.sha256\`.

To verify integrity:

\`\`\`bash
# On Linux/macOS:
sha256sum -c MANIFEST.sha256

# On Windows (PowerShell):
Get-Content MANIFEST.sha256 | ForEach-Object {
  $parts = $_ -split '  '
  $expected = $parts[0]
  $file = $parts[1]
  $actual = (Get-FileHash $file -Algorithm SHA256).Hash.ToLower()
  if ($actual -eq $expected) { Write-Host "OK: $file" }
  else { Write-Host "FAILED: $file" -ForegroundColor Red }
}
\`\`\`

---

## Legal Basis

- **Regulation (EU) 2024/2847** — Cyber Resilience Act
- **Art. 13(10)** — Documentation retention requirement (10 years minimum)
- **Annex VII** — Technical documentation contents
- **Annex V/VI** — EU Declaration of Conformity format

---

*This archive was generated automatically by CRANIS2. For questions, contact support@cranis2.dev.*
`;
}

// ══════════════════════════════════════════════════════════════
// Main entry point
// ══════════════════════════════════════════════════════════════

export async function generateComplianceSnapshot(
  orgId: string,
  productId: string,
  userId: string,
  snapshotId: string,
): Promise<SnapshotResult> {
  // Collect all data in parallel where possible
  const { files: metaFiles, product, org } = await collectProductMetadata(orgId, productId);

  const [
    techFileResult,
    docFiles,
    sbomResult,
    vulnResult,
    obligationResult,
    activityResult,
    craReportFiles,
    stakeholderFiles,
  ] = await Promise.all([
    collectTechnicalFile(productId),
    collectDeclarationOfConformity(orgId, productId, product, org),
    collectSBOMs(orgId, productId),
    collectVulnerabilities(orgId, productId),
    collectObligations(orgId, productId, product.craCategory),
    collectActivityLog(orgId, productId),
    collectCraReports(orgId, productId),
    collectStakeholders(orgId, productId),
  ]);

  // Assemble metadata summary
  const metadata = {
    techFile: { sectionCount: techFileResult.sectionCount, completedCount: techFileResult.completedCount },
    sbom: { packageCount: sbomResult.packageCount },
    vulns: vulnResult.stats,
    obligations: obligationResult.stats,
    activityCount: activityResult.entryCount,
    generatedAt: new Date().toISOString(),
    generatedBy: userId,
  };

  // Combine all files
  const allFiles: SnapshotFile[] = [
    ...metaFiles,
    ...techFileResult.files,
    ...docFiles,
    ...sbomResult.files,
    ...vulnResult.files,
    ...obligationResult.files,
    ...activityResult.files,
    ...craReportFiles,
    ...stakeholderFiles,
  ];

  // Generate README
  allFiles.push({ path: 'README.md', content: generateReadme(product, org, metadata) });

  // Generate SHA-256 manifest
  const manifestLines: string[] = [];
  for (const file of allFiles) {
    manifestLines.push(`${sha256(file.content)}  ${file.path}`);
  }
  const manifestContent = manifestLines.join('\n') + '\n';
  allFiles.push({ path: 'MANIFEST.sha256', content: manifestContent });

  // Create ZIP
  const slug = slugify(product.name);
  const filename = `${slug}-compliance-${dateStamp()}.zip`;
  const dir = join(SNAPSHOT_ROOT, orgId, productId);
  await mkdir(dir, { recursive: true });
  const filepath = join(dir, filename);

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(filepath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);

    for (const file of allFiles) {
      archive.append(file.content, { name: file.path });
    }

    archive.finalize();
  });

  // Compute hash of the ZIP file itself
  const fileStats = await stat(filepath);
  const sizeBytes = fileStats.size;

  // Read the ZIP to compute its hash
  const { readFile } = await import('node:fs/promises');
  const zipBuffer = await readFile(filepath);
  const contentHash = createHash('sha256').update(zipBuffer).digest('hex');

  return {
    id: snapshotId,
    filename,
    filepath,
    sizeBytes,
    contentHash,
    metadata,
  };
}

/**
 * Delete a snapshot ZIP from the filesystem.
 */
export async function deleteSnapshotFile(orgId: string, productId: string, filename: string): Promise<void> {
  const filepath = join(SNAPSHOT_ROOT, orgId, productId, filename);
  try {
    await unlink(filepath);
  } catch (err: any) {
    if (err.code !== 'ENOENT') throw err;
  }
}

/**
 * Get the full filesystem path for a snapshot.
 */
export function getSnapshotPath(orgId: string, productId: string, filename: string): string {
  return join(SNAPSHOT_ROOT, orgId, productId, filename);
}

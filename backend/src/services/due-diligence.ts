/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import AdmZip from 'adm-zip';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// ─── Types ──────────────────────────────────────────────────────────

export interface TechnicalFileSection {
  sectionKey: string;
  title: string;
  craReference: string | null;
  status: string;
  content: Record<string, any>;
  notes: string;
  updatedAt: string | null;
}

export interface DueDiligenceData {
  product: {
    id: string;
    name: string;
    version: string | null;
    description: string | null;
    craCategory: string | null;
    distributionModel: string | null;
  };
  organisation: {
    name: string;
    country: string | null;
    website: string | null;
    contactEmail: string | null;
  };
  dependencies: {
    total: number;
    direct: number;
    transitive: number;
  };
  licenseScan: {
    totalDeps: number;
    permissiveCount: number;
    copyleftCount: number;
    unknownCount: number;
    criticalCount: number;
    directCount: number;
    transitiveCount: number;
    permissivePercent: number;
    scannedAt: string | null;
  } | null;
  licenseFindings: Array<{
    dependencyName: string;
    dependencyVersion: string;
    licenseDeclared: string;
    licenseCategory: string;
    riskLevel: string;
    riskReason: string;
    dependencyDepth: string;
    status: string;
    waiverReason: string | null;
  }>;
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    open: number;
    mitigated: number;
    total: number;
  };
  ipProof: {
    contentHash: string;
    verified: boolean;
    createdAt: string;
    snapshotType: string;
  } | null;
  obligations: Array<{ key: string; status: string }>;
  productVersion: string | null;
  generatedAt: string;
  technicalFileSections: TechnicalFileSection[];
}

// ─── Data Gathering ─────────────────────────────────────────────────

export async function gatherReportData(orgId: string, productId: string): Promise<DueDiligenceData> {
  const neo4jSession = getDriver().session();

  try {
    // 1. Product + Org from Neo4j
    const productResult = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p, o`,
      { orgId, productId }
    );

    if (productResult.records.length === 0) {
      throw new Error('Product not found');
    }

    const product = productResult.records[0].get('p').properties;
    const org = productResult.records[0].get('o').properties;

    // 2. Dependency counts from Neo4j
    const depResult = await neo4jSession.run(
      `MATCH (p:Product {id: $productId})-[r:DEPENDS_ON]->(d:Dependency)
       RETURN count(d) AS total,
              count(CASE WHEN r.depth = 'direct' THEN 1 END) AS direct,
              count(CASE WHEN r.depth = 'transitive' THEN 1 END) AS transitive`,
      { productId }
    );

    const depRecord = depResult.records[0];
    const toNum = (v: any) => (v && typeof v.toNumber === 'function') ? v.toNumber() : (parseInt(v) || 0);

    const dependencies = {
      total: toNum(depRecord.get('total')),
      direct: toNum(depRecord.get('direct')),
      transitive: toNum(depRecord.get('transitive')),
    };

    // 3-8: Parallel Postgres queries
    const [scanResult, findingsResult, vulnResult, ipResult, oblResult, versionResult, techFileResult] = await Promise.all([
      // 3. Latest licence scan
      pool.query(
        `SELECT total_deps, permissive_count, copyleft_count, unknown_count, critical_count,
                direct_count, transitive_count, completed_at
         FROM license_scans
         WHERE product_id = $1 AND org_id = $2 AND status = 'completed'
         ORDER BY completed_at DESC LIMIT 1`,
        [productId, orgId]
      ),
      // 4. All licence findings
      pool.query(
        `SELECT dependency_name, dependency_version, license_declared, license_category,
                risk_level, risk_reason, dependency_depth, status, waiver_reason,
                compatibility_verdict, compatibility_reason
         FROM license_findings
         WHERE product_id = $1 AND org_id = $2
         ORDER BY CASE risk_level WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, dependency_name`,
        [productId, orgId]
      ),
      // 5. Vulnerability findings summary
      pool.query(
        `SELECT severity, status, count(*)::int AS cnt
         FROM vulnerability_findings
         WHERE product_id = $1 AND org_id = $2
         GROUP BY severity, status`,
        [productId, orgId]
      ),
      // 6. Latest IP proof snapshot
      pool.query(
        `SELECT content_hash, verified, created_at, snapshot_type
         FROM ip_proof_snapshots
         WHERE product_id = $1 AND org_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [productId, orgId]
      ),
      // 7. Obligations
      pool.query(
        `SELECT obligation_key, status
         FROM obligations
         WHERE product_id = $1 AND org_id = $2`,
        [productId, orgId]
      ),
      // 8. Product version
      pool.query(
        `SELECT cranis_version FROM product_versions
         WHERE product_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [productId]
      ),
      // 9. Technical file sections (Annex VII)
      pool.query(
        `SELECT section_key, title, content, notes, status, cra_reference, updated_at
         FROM technical_file_sections
         WHERE product_id = $1
         ORDER BY created_at ASC`,
        [productId]
      ),
    ]);

    // Process licence scan
    const scan = scanResult.rows[0];
    const licenseScan = scan ? {
      totalDeps: parseInt(scan.total_deps) || 0,
      permissiveCount: parseInt(scan.permissive_count) || 0,
      copyleftCount: parseInt(scan.copyleft_count) || 0,
      unknownCount: parseInt(scan.unknown_count) || 0,
      criticalCount: parseInt(scan.critical_count) || 0,
      directCount: parseInt(scan.direct_count) || 0,
      transitiveCount: parseInt(scan.transitive_count) || 0,
      permissivePercent: scan.total_deps > 0 ? Math.round((parseInt(scan.permissive_count) / parseInt(scan.total_deps)) * 100) : 0,
      scannedAt: scan.completed_at,
    } : null;

    // Process licence findings
    const licenseFindings = findingsResult.rows.map(r => ({
      dependencyName: r.dependency_name,
      dependencyVersion: r.dependency_version,
      licenseDeclared: r.license_declared,
      licenseCategory: r.license_category,
      riskLevel: r.risk_level,
      riskReason: r.risk_reason,
      dependencyDepth: r.dependency_depth || 'unknown',
      status: r.status,
      waiverReason: r.waiver_reason,
      compatibilityVerdict: r.compatibility_verdict || null,
      compatibilityReason: r.compatibility_reason || null,
    }));

    // Process vulnerability findings
    const vulns = { critical: 0, high: 0, medium: 0, low: 0, open: 0, mitigated: 0, total: 0 };
    for (const row of vulnResult.rows) {
      const cnt = row.cnt;
      vulns.total += cnt;
      if (row.severity === 'critical') vulns.critical += cnt;
      if (row.severity === 'high') vulns.high += cnt;
      if (row.severity === 'medium') vulns.medium += cnt;
      if (row.severity === 'low') vulns.low += cnt;
      if (row.status === 'open') vulns.open += cnt;
      if (row.status === 'mitigated') vulns.mitigated += cnt;
    }

    // Process IP proof
    const ip = ipResult.rows[0];
    const ipProof = ip ? {
      contentHash: ip.content_hash,
      verified: ip.verified,
      createdAt: ip.created_at,
      snapshotType: ip.snapshot_type,
    } : null;

    // Process obligations
    const obligations = oblResult.rows.map(r => ({ key: r.obligation_key, status: r.status }));

    // Process technical file sections
    const technicalFileSections: TechnicalFileSection[] = techFileResult.rows.map(r => ({
      sectionKey: r.section_key,
      title: r.title,
      craReference: r.cra_reference || null,
      status: r.status,
      content: typeof r.content === 'string' ? JSON.parse(r.content) : (r.content || {}),
      notes: r.notes || '',
      updatedAt: r.updated_at || null,
    }));

    return {
      product: {
        id: productId,
        name: product.name || 'Unknown Product',
        version: product.version || null,
        description: product.description || null,
        craCategory: product.craCategory || null,
        distributionModel: product.distributionModel || null,
      },
      organisation: {
        name: org.name || 'Unknown Organisation',
        country: org.country || null,
        website: org.website || null,
        contactEmail: org.contactEmail || null,
      },
      dependencies,
      licenseScan,
      licenseFindings,
      vulnerabilities: vulns,
      ipProof,
      obligations,
      productVersion: versionResult.rows[0]?.cranis_version || null,
      generatedAt: new Date().toISOString(),
      technicalFileSections,
    };
  } finally {
    await neo4jSession.close();
  }
}

// ─── Markdown Generation ─────────────────────────────────────────────

export function generateMarkdown(data: DueDiligenceData): string {
  const lines: string[] = [];
  const genDate = new Date(data.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  lines.push('# Due Diligence Report');
  lines.push('**Open Source Compliance & Risk Assessment**');
  lines.push('');
  lines.push(`**Product:** ${data.product.name}`);
  if (data.productVersion) lines.push(`**Version:** ${data.productVersion}`);
  lines.push(`**Organisation:** ${data.organisation.name}`);
  if (data.organisation.country) lines.push(`**Country:** ${data.organisation.country}`);
  lines.push(`**Generated:** ${genDate}`);
  lines.push('');

  // ── EXECUTIVE SUMMARY ──
  lines.push('## Executive Summary');
  lines.push('');

  const permPct = data.licenseScan?.permissivePercent ?? 0;
  const vulnTotal = data.vulnerabilities.total;
  const vulnOpen = data.vulnerabilities.open;
  const oblMet = data.obligations.filter(o => o.status === 'met').length;
  const oblTotal = data.obligations.length;

  lines.push(
    `This report provides an independent assessment of the open-source compliance and risk profile for ${data.product.name}, ` +
    `developed by ${data.organisation.name}. ` +
    `The product comprises ${data.dependencies.total} software dependencies (${data.dependencies.direct} direct, ${data.dependencies.transitive} transitive). ` +
    (data.licenseScan
      ? `${permPct}% of dependencies use permissive licences with no restrictions on proprietary distribution. `
      : 'No licence scan has been performed yet. ') +
    (vulnTotal > 0
      ? `There are ${vulnTotal} known vulnerability findings, of which ${vulnOpen} remain open. `
      : 'No known vulnerability findings have been identified. ') +
    (oblTotal > 0
      ? `CRA compliance obligations are ${oblMet}/${oblTotal} met.`
      : '')
  );
  lines.push('');

  // ── PRODUCT OVERVIEW ──
  lines.push('## Product Overview');
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Product Name | ${data.product.name} |`);
  if (data.productVersion) lines.push(`| Version | ${data.productVersion} |`);
  if (data.product.description) lines.push(`| Description | ${data.product.description} |`);
  if (data.product.craCategory) lines.push(`| CRA Category | ${data.product.craCategory} |`);
  lines.push(`| Organisation | ${data.organisation.name} |`);
  if (data.organisation.country) lines.push(`| Country | ${data.organisation.country} |`);
  if (data.organisation.website) lines.push(`| Website | ${data.organisation.website} |`);
  if (data.organisation.contactEmail) lines.push(`| Contact | ${data.organisation.contactEmail} |`);
  lines.push('');

  // ── DEPENDENCY INVENTORY ──
  lines.push('## Dependency Inventory');
  lines.push('');
  lines.push(`| Metric | Count |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Total Dependencies | ${data.dependencies.total} |`);
  lines.push(`| Direct | ${data.dependencies.direct} |`);
  lines.push(`| Transitive | ${data.dependencies.transitive} |`);
  lines.push('');

  // ── LICENCE COMPLIANCE ──
  lines.push('## Licence Compliance');
  lines.push('');

  if (data.licenseScan) {
    const ls = data.licenseScan;
    lines.push(`| Metric | Count |`);
    lines.push(`| --- | --- |`);
    lines.push(`| Permissive | ${ls.permissiveCount} (${ls.permissivePercent}%) |`);
    lines.push(`| Copyleft | ${ls.copyleftCount} |`);
    lines.push(`| Unknown / No Assertion | ${ls.unknownCount} |`);
    lines.push(`| Critical | ${ls.criticalCount} |`);
    lines.push('');

    lines.push('### Proprietary Compatibility');
    lines.push('');
    if (ls.permissivePercent === 100) {
      lines.push(
        'All dependencies use permissive licences (MIT, Apache-2.0, BSD, ISC, etc.). ' +
        'There are no restrictions on proprietary distribution or commercialisation. ' +
        'No source code disclosure obligations apply.'
      );
    } else if (ls.criticalCount > 0) {
      lines.push(
        `${ls.criticalCount} dependencies use strong copyleft licences that may require source code disclosure ` +
        `if the software is distributed. These must be reviewed for compatibility with the intended distribution model. ` +
        `Full licence texts are included in the accompanying ZIP package.`
      );
    } else {
      lines.push(
        `${ls.permissivePercent}% of dependencies are permissive. ` +
        `${ls.copyleftCount} dependencies use weak copyleft licences (e.g. LGPL, MPL) which have limited obligations. ` +
        `${ls.unknownCount} dependencies have unresolved licence assertions requiring manual review.`
      );
    }
    lines.push('');

    // Compatibility analysis
    const incompatible = data.licenseFindings?.filter((f: any) => f.compatibilityVerdict === 'incompatible').length || 0;
    const reviewNeeded = data.licenseFindings?.filter((f: any) => f.compatibilityVerdict === 'review_needed').length || 0;
    if (incompatible > 0 || reviewNeeded > 0) {
      lines.push('### Licence Compatibility Analysis');
      lines.push('');
      const distModel = data.product.distributionModel || 'not set';
      lines.push(`Distribution model: ${distModel}. Based on this distribution model:`);
      lines.push('');
      if (incompatible > 0) lines.push(`- **Incompatible Licences:** ${incompatible}`);
      if (reviewNeeded > 0) lines.push(`- **Review Needed:** ${reviewNeeded}`);
      lines.push('');
    }

    // Non-permissive table
    const nonPermissive = data.licenseFindings.filter(f => f.riskLevel !== 'ok');
    if (nonPermissive.length > 0) {
      lines.push('### Non-Permissive Dependencies');
      lines.push('');
      lines.push('| Dependency | Licence | Risk | Status |');
      lines.push('| --- | --- | --- | --- |');
      for (const f of nonPermissive.slice(0, 50)) {
        lines.push(`| ${f.dependencyName}@${f.dependencyVersion} | ${f.licenseDeclared} | ${f.riskLevel.toUpperCase()} | ${f.status} |`);
      }
      if (nonPermissive.length > 50) {
        lines.push(`| ... | ${nonPermissive.length - 50} more — see license-findings.csv | | |`);
      }
      lines.push('');
    }

    // Waivers
    const waived = data.licenseFindings.filter(f => f.status === 'waived');
    if (waived.length > 0) {
      lines.push('### Waivers');
      lines.push('');
      for (const w of waived.slice(0, 10)) {
        lines.push(`- **${w.dependencyName}** (${w.licenseDeclared}): ${w.waiverReason || 'No reason provided'}`);
      }
      lines.push('');
    }
  } else {
    lines.push('No licence scan has been performed for this product. Run a licence scan from the CRANIS2 dashboard to generate compliance data.');
    lines.push('');
  }

  // ── VULNERABILITY POSTURE ──
  lines.push('## Vulnerability Posture');
  lines.push('');

  const v = data.vulnerabilities;
  if (v.total > 0) {
    lines.push(`| Metric | Count |`);
    lines.push(`| --- | --- |`);
    lines.push(`| Total Findings | ${v.total} |`);
    lines.push(`| Critical | ${v.critical} |`);
    lines.push(`| High | ${v.high} |`);
    lines.push(`| Medium | ${v.medium} |`);
    lines.push(`| Low | ${v.low} |`);
    lines.push(`| Open | ${v.open} |`);
    lines.push(`| Mitigated | ${v.mitigated} |`);
    lines.push('');

    lines.push('### Risk Assessment');
    lines.push('');
    if (v.critical > 0) {
      lines.push(
        `There are ${v.critical} critical-severity vulnerabilities requiring immediate attention. ` +
        `These should be remediated before any release or investment milestone.`
      );
    } else if (v.high > 0) {
      lines.push(
        `No critical vulnerabilities found. ${v.high} high-severity findings should be reviewed and remediated. ` +
        `The overall security posture is moderate.`
      );
    } else {
      lines.push('No critical or high-severity vulnerabilities found. The security posture is strong.');
    }
  } else {
    lines.push('No vulnerability findings have been recorded. Ensure vulnerability scanning has been run from the CRANIS2 dashboard.');
  }
  lines.push('');

  // ── IP PROOF STATUS ──
  lines.push('## Intellectual Property Proof');
  lines.push('');

  if (data.ipProof) {
    lines.push(`| Field | Value |`);
    lines.push(`| --- | --- |`);
    lines.push(`| Content Hash (SHA-256) | ${data.ipProof.contentHash} |`);
    lines.push(`| Verified | ${data.ipProof.verified ? 'Yes' : 'No'} |`);
    lines.push(`| Timestamp Type | RFC 3161 (FreeTSA.org) |`);
    lines.push(`| Created | ${new Date(data.ipProof.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} |`);
    lines.push(`| Snapshot Type | ${data.ipProof.snapshotType} |`);
    lines.push('');
    lines.push(
      'An RFC 3161 cryptographic timestamp has been created for this product\'s software bill of materials. ' +
      'This provides independently verifiable proof that the codebase composition existed at the timestamped date. ' +
      'The timestamp is signed by a trusted third-party Time Stamping Authority and is legally recognised under the EU eIDAS regulation.'
    );
  } else {
    lines.push('No IP proof snapshot has been created for this product. Create one from the CRANIS2 IP Proof page.');
  }
  lines.push('');

  // ── CRA COMPLIANCE ──
  lines.push('## CRA Compliance Status');
  lines.push('');

  if (data.obligations.length > 0) {
    const met = data.obligations.filter(o => o.status === 'met').length;
    const inProgress = data.obligations.filter(o => o.status === 'in_progress').length;
    const notStarted = data.obligations.filter(o => o.status === 'not_started').length;
    const progressPct = Math.round((met / data.obligations.length) * 100);

    lines.push(`| Metric | Value |`);
    lines.push(`| --- | --- |`);
    lines.push(`| Obligations Met | ${met} of ${data.obligations.length} (${progressPct}%) |`);
    lines.push(`| In Progress | ${inProgress} |`);
    lines.push(`| Not Started | ${notStarted} |`);
    lines.push('');

    lines.push('### Obligation Details');
    lines.push('');
    for (const obl of data.obligations) {
      const icon = obl.status === 'met' ? '✓' : obl.status === 'in_progress' ? '◐' : '○';
      const oblLabel = obl.key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      lines.push(`- ${icon} **${oblLabel}** — ${obl.status.replace('_', ' ')}`);
    }
  } else {
    lines.push('No CRA obligations have been configured for this product.');
  }
  lines.push('');

  // ── TECHNICAL FILE (ANNEX VII) ──
  lines.push('## Technical File (CRA Annex VII)');
  lines.push('');

  if (data.technicalFileSections.length > 0) {
    const completed = data.technicalFileSections.filter(s => s.status === 'completed').length;
    const inProg = data.technicalFileSections.filter(s => s.status === 'in_progress').length;
    const notStarted = data.technicalFileSections.filter(s => s.status === 'not_started').length;
    const tfPct = Math.round((completed / data.technicalFileSections.length) * 100);

    lines.push(`| Metric | Value |`);
    lines.push(`| --- | --- |`);
    lines.push(`| Sections Completed | ${completed} of ${data.technicalFileSections.length} (${tfPct}%) |`);
    lines.push(`| In Progress | ${inProg} |`);
    lines.push(`| Not Started | ${notStarted} |`);
    lines.push('');

    lines.push('### Section Status');
    lines.push('');
    for (const section of data.technicalFileSections) {
      const icon = section.status === 'completed' ? '✓' : section.status === 'in_progress' ? '◐' : '○';
      const updatedStr = section.updatedAt ? new Date(section.updatedAt).toLocaleDateString('en-GB') : 'not updated';
      lines.push(`- ${icon} **${section.title}** (${section.craReference || ''}) — ${section.status.replace('_', ' ')} — last updated ${updatedStr}`);
    }
    lines.push('');
    lines.push('The complete Annex VII Technical File data is included in this package as technical-file.json.');
  } else {
    lines.push('No Technical File sections have been created for this product. Begin filling in the Technical File from the CRANIS2 dashboard.');
  }

  lines.push('');
  lines.push('---');
  lines.push(`*Generated by CRANIS2 — ${genDate}*`);

  return lines.join('\n');
}

// ─── CSV Generation ─────────────────────────────────────────────────

export function generateFindingsCSV(findings: DueDiligenceData['licenseFindings']): string {
  const headers = ['Dependency', 'Version', 'Licence', 'Category', 'Risk Level', 'Depth', 'Status', 'Waiver Reason'];
  const rows = findings.map(f => [
    csvEscape(f.dependencyName),
    csvEscape(f.dependencyVersion),
    csvEscape(f.licenseDeclared),
    csvEscape(f.licenseCategory),
    csvEscape(f.riskLevel),
    csvEscape(f.dependencyDepth),
    csvEscape(f.status),
    csvEscape(f.waiverReason || ''),
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ─── Licence Text Loading ───────────────────────────────────────────

function getLicenseText(spdxId: string): string | null {
  try {
    const data = require(`spdx-license-list/licenses/${spdxId}.json`);
    return data?.licenseText || null;
  } catch {
    return null;
  }
}

function extractLicenseIds(expression: string): string[] {
  return expression
    .replace(/\(/g, ' ')
    .replace(/\)/g, ' ')
    .replace(/\bAND\b/gi, ' ')
    .replace(/\bOR\b/gi, ' ')
    .replace(/\bWITH\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(id => id.length > 0 && id !== '+');
}

// ─── ZIP Assembly ───────────────────────────────────────────────────

export function generateDueDiligenceZIP(
  data: DueDiligenceData,
  reportMarkdown: string,
  sbomJson: any,
  csv: string,
): Buffer {
  const zip = new AdmZip();

  // 1. Markdown report
  zip.addFile('due-diligence-report.md', Buffer.from(reportMarkdown, 'utf-8'));

  // 2. CycloneDX SBOM
  zip.addFile('sbom-cyclonedx-1.6.json', Buffer.from(JSON.stringify(sbomJson, null, 2), 'utf-8'));

  // 3. Licence findings CSV
  zip.addFile('license-findings.csv', Buffer.from(csv, 'utf-8'));

  // 4. Vulnerability summary JSON
  const vulnSummary = {
    generatedAt: data.generatedAt,
    product: data.product.name,
    version: data.productVersion,
    summary: {
      critical: data.vulnerabilities.critical,
      high: data.vulnerabilities.high,
      medium: data.vulnerabilities.medium,
      low: data.vulnerabilities.low,
    },
    openFindings: data.vulnerabilities.open,
    mitigatedFindings: data.vulnerabilities.mitigated,
    totalFindings: data.vulnerabilities.total,
  };
  zip.addFile('vulnerability-summary.json', Buffer.from(JSON.stringify(vulnSummary, null, 2), 'utf-8'));

  // 5. Technical File (Annex VII) – all 8 sections as structured JSON
  const technicalFileExport = {
    generatedAt: data.generatedAt,
    productId: data.product.id,
    productName: data.product.name,
    sections: data.technicalFileSections.map(s => ({
      sectionKey: s.sectionKey,
      title: s.title,
      craReference: s.craReference,
      status: s.status,
      content: s.content,
      notes: s.notes,
      updatedAt: s.updatedAt,
    })),
  };
  zip.addFile('technical-file.json', Buffer.from(JSON.stringify(technicalFileExport, null, 2), 'utf-8'));

  // 6. Full licence texts for non-permissive licences
  const nonPermissiveIds = new Set<string>();
  for (const f of data.licenseFindings) {
    if (f.riskLevel !== 'ok' && f.licenseDeclared && f.licenseDeclared !== 'NOASSERTION') {
      for (const id of extractLicenseIds(f.licenseDeclared)) {
        nonPermissiveIds.add(id);
      }
    }
  }

  for (const spdxId of nonPermissiveIds) {
    const text = getLicenseText(spdxId);
    if (text) {
      zip.addFile(`license-texts/${spdxId}.txt`, Buffer.from(text, 'utf-8'));
    } else {
      zip.addFile(
        `license-texts/${spdxId}.txt`,
        Buffer.from(`Licence text for "${spdxId}" could not be resolved from the SPDX licence list.\nPlease consult https://spdx.org/licenses/${spdxId}.html for the full text.\n`, 'utf-8')
      );
    }
  }

  // 7. Report metadata
  const metadata = {
    reportType: 'due-diligence',
    generatedAt: data.generatedAt,
    generator: 'CRANIS2',
    product: {
      name: data.product.name,
      version: data.productVersion,
      id: data.product.id,
    },
    organisation: data.organisation.name,
    contents: [
      'due-diligence-report.md – Investor-readable compliance report',
      'sbom-cyclonedx-1.6.json – Software Bill of Materials (CycloneDX 1.6)',
      'license-findings.csv – Per-dependency licence classification',
      'vulnerability-summary.json – Vulnerability posture summary',
      `technical-file.json – CRA Annex VII Technical File (${data.technicalFileSections.length} sections)`,
      `license-texts/ – Full licence texts (${nonPermissiveIds.size} non-permissive licences)`,
    ],
  };
  zip.addFile('metadata.json', Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8'));

  return zip.toBuffer();
}

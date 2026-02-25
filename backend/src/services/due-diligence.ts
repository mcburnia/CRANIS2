import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import PDFDocument from 'pdfkit';
import AdmZip from 'adm-zip';
import { createRequire } from 'module';
import { PassThrough } from 'stream';

const require = createRequire(import.meta.url);

// ─── Types ──────────────────────────────────────────────────────────

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

    // 3-7: Parallel Postgres queries
    const [scanResult, findingsResult, vulnResult, ipResult, oblResult, versionResult] = await Promise.all([
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
    };
  } finally {
    await neo4jSession.close();
  }
}

// ─── PDF Generation ─────────────────────────────────────────────────

export async function generatePDF(data: DueDiligenceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    const stream = new PassThrough();

    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    doc.pipe(stream);

    const pageWidth = doc.page.width - 100; // margins
    const accentColour = '#6366f1';
    const mutedColour = '#6b7280';
    const greenColour = '#22c55e';
    const amberColour = '#f59e0b';
    const redColour = '#ef4444';

    // ── Footer helper (no event listeners — avoids recursion) ──
    let pageNum = 1;

    function addFooter() {
      const bottom = doc.page.height - 30;
      doc.save();
      doc.fontSize(8).fillColor(mutedColour);
      doc.text(`Generated by CRANIS2 on ${new Date(data.generatedAt).toLocaleDateString('en-GB')}`, 50, bottom, { lineBreak: false });
      doc.text(`Page ${pageNum}`, 50 + pageWidth - 80, bottom, { lineBreak: false, width: 80, align: 'right' });
      doc.restore();
    }

    // ── COVER PAGE ──
    doc.moveDown(6);
    doc.fontSize(32).fillColor(accentColour).text('Due Diligence Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).fillColor(mutedColour).text('Open Source Compliance & Risk Assessment', { align: 'center' });
    doc.moveDown(3);
    doc.fontSize(20).fillColor('#111827').text(data.product.name, { align: 'center' });
    if (data.productVersion) {
      doc.fontSize(12).fillColor(mutedColour).text(`Version ${data.productVersion}`, { align: 'center' });
    }
    doc.moveDown(2);
    doc.fontSize(12).fillColor('#374151').text(data.organisation.name, { align: 'center' });
    if (data.organisation.country) {
      doc.fontSize(10).fillColor(mutedColour).text(data.organisation.country, { align: 'center' });
    }
    doc.moveDown(4);
    doc.fontSize(10).fillColor(mutedColour).text(`Generated: ${new Date(data.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, { align: 'center' });
    addFooter();

    // ── Helper functions ──
    function newPage() {
      doc.addPage();
      pageNum++;
      addFooter();
    }

    function sectionTitle(title: string) {
      newPage();
      doc.fontSize(18).fillColor(accentColour).text(title, 50, 50, { lineBreak: false });
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).strokeColor(accentColour).lineWidth(1).stroke();
      doc.moveDown(0.8);
    }

    function subHeading(title: string) {
      doc.moveDown(0.5);
      doc.fontSize(12).fillColor('#111827').font('Helvetica-Bold').text(title);
      doc.font('Helvetica');
      doc.moveDown(0.3);
    }

    function bodyText(text: string) {
      doc.fontSize(10).fillColor('#374151').text(text, { lineGap: 3 });
    }

    function statLine(label: string, value: string | number, colour?: string) {
      const y = doc.y;
      doc.fontSize(10).fillColor(mutedColour).text(label, 50, y, { continued: false, width: 250 });
      doc.fontSize(10).fillColor(colour || '#111827').font('Helvetica-Bold').text(String(value), 300, y, { width: 245 });
      doc.font('Helvetica');
      doc.moveDown(0.2);
    }

    function drawBar(x: number, y: number, width: number, height: number, fillPct: number, fillCol: string, bgCol: string) {
      doc.save();
      doc.roundedRect(x, y, width, height, 3).fillColor(bgCol).fill();
      if (fillPct > 0) {
        const fillWidth = Math.max(6, width * (fillPct / 100));
        doc.roundedRect(x, y, fillWidth, height, 3).fillColor(fillCol).fill();
      }
      doc.restore();
    }

    // ── EXECUTIVE SUMMARY ──
    sectionTitle('Executive Summary');

    const permPct = data.licenseScan?.permissivePercent ?? 0;
    const vulnTotal = data.vulnerabilities.total;
    const vulnOpen = data.vulnerabilities.open;
    const oblMet = data.obligations.filter(o => o.status === 'met').length;
    const oblTotal = data.obligations.length;

    bodyText(
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

    // ── PRODUCT OVERVIEW ──
    sectionTitle('Product Overview');

    statLine('Product Name', data.product.name);
    if (data.productVersion) statLine('Version', data.productVersion);
    if (data.product.description) statLine('Description', data.product.description);
    if (data.product.craCategory) statLine('CRA Category', data.product.craCategory);
    doc.moveDown(0.5);
    statLine('Organisation', data.organisation.name);
    if (data.organisation.country) statLine('Country', data.organisation.country);
    if (data.organisation.website) statLine('Website', data.organisation.website);
    if (data.organisation.contactEmail) statLine('Contact', data.organisation.contactEmail);

    // ── DEPENDENCY INVENTORY ──
    sectionTitle('Dependency Inventory');

    statLine('Total Dependencies', data.dependencies.total);
    statLine('Direct Dependencies', data.dependencies.direct);
    statLine('Transitive Dependencies', data.dependencies.transitive);

    if (data.dependencies.total > 0) {
      doc.moveDown(0.5);
      const directPct = Math.round((data.dependencies.direct / data.dependencies.total) * 100);
      subHeading('Composition');
      drawBar(50, doc.y, pageWidth, 16, directPct, accentColour, '#e5e7eb');
      doc.moveDown(1.5);
      doc.fontSize(9).fillColor(mutedColour)
        .text(`Direct: ${data.dependencies.direct} (${directPct}%)    Transitive: ${data.dependencies.transitive} (${100 - directPct}%)`, 50, doc.y);
    }

    // ── LICENCE COMPLIANCE ──
    sectionTitle('Licence Compliance');

    if (data.licenseScan) {
      const ls = data.licenseScan;
      statLine('Permissive', `${ls.permissiveCount} (${ls.permissivePercent}%)`, greenColour);
      statLine('Copyleft', String(ls.copyleftCount), ls.copyleftCount > 0 ? redColour : greenColour);
      statLine('Unknown / No Assertion', String(ls.unknownCount), ls.unknownCount > 0 ? amberColour : greenColour);
      statLine('Critical', String(ls.criticalCount), ls.criticalCount > 0 ? redColour : greenColour);

      doc.moveDown(0.5);
      subHeading('Proprietary Compatibility');
      if (ls.permissivePercent === 100) {
        bodyText(
          'All dependencies use permissive licences (MIT, Apache-2.0, BSD, ISC, etc.). ' +
          'There are no restrictions on proprietary distribution or commercialisation. ' +
          'No source code disclosure obligations apply.'
        );
      } else if (ls.criticalCount > 0) {
        bodyText(
          `${ls.criticalCount} dependencies use strong copyleft licences that may require source code disclosure ` +
          `if the software is distributed. These must be reviewed for compatibility with the intended distribution model. ` +
          `Full licence texts are included in the accompanying ZIP package.`
        );
      } else {
        bodyText(
          `${ls.permissivePercent}% of dependencies are permissive. ` +
          `${ls.copyleftCount} dependencies use weak copyleft licences (e.g. LGPL, MPL) which have limited obligations. ` +
          `${ls.unknownCount} dependencies have unresolved licence assertions requiring manual review.`
        );
      }

      // Non-permissive findings table

      // Compatibility matrix summary
      const incompatible = data.licenseFindings?.filter((f: any) => f.compatibilityVerdict === "incompatible").length || 0;
      const reviewNeeded = data.licenseFindings?.filter((f: any) => f.compatibilityVerdict === "review_needed").length || 0;
      if (incompatible > 0 || reviewNeeded > 0) {
        doc.moveDown(0.5);
        subHeading("Licence Compatibility Analysis");
        const distModel = data.product.distributionModel || "not set";
        bodyText("Distribution model: " + distModel + ". Based on this distribution model:");
        if (incompatible > 0) {
          statLine("Incompatible Licences", String(incompatible), redColour);
        }
        if (reviewNeeded > 0) {
          statLine("Review Needed", String(reviewNeeded), amberColour);
        }
      }
      const nonPermissive = data.licenseFindings.filter(f => f.riskLevel !== 'ok');
      if (nonPermissive.length > 0) {
        doc.moveDown(0.5);
        subHeading('Non-Permissive Dependencies');

        // Table header
        const colX = [50, 200, 310, 400];
        const colW = [148, 108, 88, pageWidth - 350];
        doc.fontSize(8).fillColor(mutedColour).font('Helvetica-Bold');
        doc.text('Dependency', colX[0], doc.y);
        doc.text('Licence', colX[1], doc.y - 10);
        doc.text('Risk', colX[2], doc.y - 10);
        doc.text('Status', colX[3], doc.y - 10);
        doc.font('Helvetica');
        doc.moveDown(0.3);

        doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
        doc.moveDown(0.3);

        for (const f of nonPermissive.slice(0, 30)) {
          if (doc.y > doc.page.height - 80) {
            newPage();
          }
          const y = doc.y;
          const riskCol = f.riskLevel === 'critical' ? redColour : amberColour;
          doc.fontSize(8).fillColor('#374151');
          doc.text(`${f.dependencyName}@${f.dependencyVersion}`, colX[0], y, { width: colW[0] });
          doc.text(f.licenseDeclared, colX[1], y, { width: colW[1] });
          doc.fillColor(riskCol).text(f.riskLevel.toUpperCase(), colX[2], y, { width: colW[2] });
          doc.fillColor('#374151').text(f.status, colX[3], y, { width: colW[3] });
          doc.moveDown(0.3);
        }

        if (nonPermissive.length > 30) {
          doc.moveDown(0.3);
          doc.fontSize(8).fillColor(mutedColour).text(`... and ${nonPermissive.length - 30} more. See license-findings.csv for full list.`);
        }
      }

      // Waivers
      const waived = data.licenseFindings.filter(f => f.status === 'waived');
      if (waived.length > 0) {
        doc.moveDown(0.5);
        subHeading('Waivers');
        for (const w of waived.slice(0, 10)) {
          doc.fontSize(9).fillColor('#374151')
            .text(`${w.dependencyName} (${w.licenseDeclared}): ${w.waiverReason || 'No reason provided'}`, { indent: 10 });
          doc.moveDown(0.2);
        }
      }
    } else {
      bodyText('No licence scan has been performed for this product. Run a licence scan from the CRANIS2 dashboard to generate compliance data.');
    }

    // ── VULNERABILITY POSTURE ──
    sectionTitle('Vulnerability Posture');

    const v = data.vulnerabilities;
    if (v.total > 0) {
      statLine('Total Findings', v.total);
      statLine('Critical', String(v.critical), v.critical > 0 ? redColour : greenColour);
      statLine('High', String(v.high), v.high > 0 ? redColour : greenColour);
      statLine('Medium', String(v.medium), v.medium > 0 ? amberColour : greenColour);
      statLine('Low', String(v.low), greenColour);
      doc.moveDown(0.5);
      statLine('Open', String(v.open), v.open > 0 ? amberColour : greenColour);
      statLine('Mitigated', String(v.mitigated), greenColour);

      doc.moveDown(0.5);
      subHeading('Risk Assessment');
      if (v.critical > 0) {
        bodyText(
          `There are ${v.critical} critical-severity vulnerabilities requiring immediate attention. ` +
          `These should be remediated before any release or investment milestone.`
        );
      } else if (v.high > 0) {
        bodyText(
          `No critical vulnerabilities found. ${v.high} high-severity findings should be reviewed and remediated. ` +
          `The overall security posture is moderate.`
        );
      } else {
        bodyText(
          'No critical or high-severity vulnerabilities found. The security posture is strong.'
        );
      }
    } else {
      bodyText('No vulnerability findings have been recorded. Ensure vulnerability scanning has been run from the CRANIS2 dashboard.');
    }

    // ── IP PROOF STATUS ──
    sectionTitle('Intellectual Property Proof');

    if (data.ipProof) {
      statLine('Content Hash (SHA-256)', data.ipProof.contentHash);
      statLine('Verified', data.ipProof.verified ? 'Yes' : 'No', data.ipProof.verified ? greenColour : amberColour);
      statLine('Timestamp Type', 'RFC 3161 (FreeTSA.org)');
      statLine('Created', new Date(data.ipProof.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
      statLine('Snapshot Type', data.ipProof.snapshotType);

      doc.moveDown(0.5);
      bodyText(
        'An RFC 3161 cryptographic timestamp has been created for this product\'s software bill of materials. ' +
        'This provides independently verifiable proof that the codebase composition existed at the timestamped date. ' +
        'The timestamp is signed by a trusted third-party Time Stamping Authority and is legally recognised under the EU eIDAS regulation.'
      );
    } else {
      bodyText('No IP proof snapshot has been created for this product. Create one from the CRANIS2 IP Proof page.');
    }

    // ── CRA COMPLIANCE ──
    sectionTitle('CRA Compliance Status');

    if (data.obligations.length > 0) {
      const met = data.obligations.filter(o => o.status === 'met').length;
      const inProgress = data.obligations.filter(o => o.status === 'in_progress').length;
      const notStarted = data.obligations.filter(o => o.status === 'not_started').length;
      const progressPct = Math.round((met / data.obligations.length) * 100);

      statLine('Obligations Met', `${met} of ${data.obligations.length} (${progressPct}%)`, met === data.obligations.length ? greenColour : amberColour);
      statLine('In Progress', String(inProgress), amberColour);
      statLine('Not Started', String(notStarted), notStarted > 0 ? redColour : greenColour);

      doc.moveDown(0.5);
      subHeading('Progress');
      drawBar(50, doc.y, pageWidth, 16, progressPct, greenColour, '#e5e7eb');
      doc.moveDown(1.5);
      doc.fontSize(9).fillColor(mutedColour).text(`${progressPct}% complete`);

      // Obligation details
      doc.moveDown(0.5);
      subHeading('Obligation Details');
      for (const obl of data.obligations) {
        const statusIcon = obl.status === 'met' ? '✓' : obl.status === 'in_progress' ? '◐' : '○';
        const statusCol = obl.status === 'met' ? greenColour : obl.status === 'in_progress' ? amberColour : mutedColour;
        const oblLabel = obl.key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        doc.fontSize(9).fillColor(statusCol).text(`${statusIcon}  ${oblLabel}  —  ${obl.status.replace('_', ' ')}`, { indent: 10 });
        doc.moveDown(0.2);
      }
    } else {
      bodyText('No CRA obligations have been configured for this product.');
    }

    // ── Finalize ──
    doc.end();
  });
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
  pdfBuffer: Buffer,
  sbomJson: any,
  csv: string,
): Buffer {
  const zip = new AdmZip();

  // 1. PDF report
  zip.addFile('due-diligence-report.pdf', pdfBuffer);

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

  // 5. Full licence texts for non-permissive licences
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

  // 6. Report metadata
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
      'due-diligence-report.pdf — Investor-readable compliance report',
      'sbom-cyclonedx-1.6.json — Software Bill of Materials (CycloneDX 1.6)',
      'license-findings.csv — Per-dependency licence classification',
      'vulnerability-summary.json — Vulnerability posture summary',
      `license-texts/ — Full licence texts (${nonPermissiveIds.size} non-permissive licences)`,
    ],
  };
  zip.addFile('metadata.json', Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8'));

  return zip.toBuffer();
}

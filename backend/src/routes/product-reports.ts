import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';
import { ensureObligations, computeDerivedStatuses, enrichObligation } from '../services/obligation-engine.js';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';

const router = Router();

// ─── Auth middleware ──────────────────────────────────────────────────────────

async function requireAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = verifySessionToken(token);
    if (!payload) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    (req as any).userId = payload.userId;
    (req as any).email = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getOrgId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.org_id || null;
}

async function getProductInfo(orgId: string, productId: string): Promise<{ name: string; craCategory: string | null } | null> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p.name AS name, p.craCategory AS craCategory`,
      { orgId, productId }
    );
    if (result.records.length === 0) return null;
    return {
      name: result.records[0].get('name'),
      craCategory: result.records[0].get('craCategory') || null,
    };
  } finally {
    await session.close();
  }
}

function sanitiseName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
}

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── CSV helpers ─────────────────────────────────────────────────────────────

function escCsv(val: unknown): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escCsv).join(',')];
  for (const row of rows) {
    lines.push(row.map(escCsv).join(','));
  }
  return lines.join('\n');
}

// ─── PDF helpers ─────────────────────────────────────────────────────────────

const PDF_ACCENT = '#6366f1';
const PDF_MUTED = '#6b7280';
const PDF_DARK = '#111827';
const PDF_BODY = '#374151';

function buildProductPdf(title: string, subtitle: string, productName: string) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const chunks: Buffer[] = [];
  const stream = new PassThrough();
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  doc.pipe(stream);

  const pageWidth = doc.page.width - 100;
  let pageNum = 1;

  function addFooter() {
    const bottom = doc.page.height - 30;
    doc.save();
    doc.fontSize(8).fillColor(PDF_MUTED);
    doc.text(`CRANIS2 | ${productName}`, 50, bottom, { lineBreak: false });
    doc.text(`Page ${pageNum}`, 50 + pageWidth - 80, bottom, { lineBreak: false, width: 80, align: 'right' });
    doc.restore();
  }

  function newPage() {
    doc.addPage();
    pageNum++;
    addFooter();
  }

  function sectionTitle(t: string) {
    newPage();
    doc.fontSize(16).fillColor(PDF_ACCENT).text(t, 50, 50, { lineBreak: false });
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).strokeColor(PDF_ACCENT).lineWidth(1).stroke();
    doc.moveDown(0.8);
  }

  function subHeading(t: string) {
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor(PDF_DARK).font('Helvetica-Bold').text(t);
    doc.font('Helvetica');
    doc.moveDown(0.2);
  }

  function bodyText(t: string) {
    doc.fontSize(10).fillColor(PDF_BODY).text(t, { lineGap: 2 });
  }

  function statLine(label: string, value: string | number, colour?: string) {
    const y = doc.y;
    doc.fontSize(9).fillColor(PDF_MUTED).text(label, 50, y, { width: 240 });
    doc.fontSize(9).fillColor(colour ?? PDF_DARK).font('Helvetica-Bold').text(String(value), 295, y, { width: 255 });
    doc.font('Helvetica');
    doc.moveDown(0.15);
  }

  function tableRow(cols: string[], widths: number[], y: number, bold = false, colour = PDF_BODY) {
    let x = 50;
    doc.fontSize(8).fillColor(colour).font(bold ? 'Helvetica-Bold' : 'Helvetica');
    for (let i = 0; i < cols.length; i++) {
      doc.text(cols[i], x, y, { width: widths[i] - 4, lineBreak: false });
      x += widths[i];
    }
    doc.font('Helvetica');
  }

  function checkPageBreak(neededHeight = 20) {
    if (doc.y + neededHeight > doc.page.height - 60) {
      newPage();
    }
  }

  // Cover page
  doc.moveDown(6);
  doc.fontSize(28).fillColor(PDF_ACCENT).text(title, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(13).fillColor(PDF_MUTED).text(subtitle, { align: 'center' });
  doc.moveDown(2);
  doc.fontSize(12).fillColor(PDF_BODY).text(productName, { align: 'center' });
  doc.moveDown(1);
  doc.fontSize(10).fillColor(PDF_MUTED).text(
    `Generated: ${formatDate(new Date())}`,
    { align: 'center' }
  );
  addFooter();

  return {
    doc, stream, chunks, pageWidth,
    newPage, sectionTitle, subHeading, bodyText, statLine,
    tableRow, checkPageBreak,
  };
}

function finalisePdf(doc: PDFKit.PDFDocument, stream: PassThrough, chunks: Buffer[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    doc.end();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 1 — VULNERABILITY FINDINGS
// ═══════════════════════════════════════════════════════════════════════════════

const SEVERITY_ORDER: Record<string, number> = { critical: 1, high: 2, medium: 3, low: 4 };

function severityColour(sev: string): string {
  switch (sev) {
    case 'critical': return '#dc2626';
    case 'high': return '#f97316';
    case 'medium': return '#eab308';
    case 'low': return '#3b82f6';
    default: return PDF_MUTED;
  }
}

router.get('/:productId/reports/vulnerabilities', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const email = (req as any).email;
  const format = (req.query.format as string || 'pdf').toLowerCase();
  const productId = req.params.productId as string;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation' }); return; }

    const productInfo = await getProductInfo(orgId, productId);
    if (!productInfo) { res.status(404).json({ error: 'Product not found' }); return; }

    const findings = await pool.query(
      `SELECT source, source_id, severity, cvss_score, title, description,
              dependency_name, dependency_version, dependency_ecosystem,
              affected_versions, fixed_version,
              status, dismissed_reason, mitigation_notes,
              created_at, updated_at
       FROM vulnerability_findings
       WHERE product_id = $1 AND org_id = $2
       ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END,
                created_at DESC`,
      [productId, orgId]
    );
    const rows = findings.rows;

    // Summary stats
    const total = rows.length;
    const open = rows.filter(r => r.status === 'open').length;
    const critical = rows.filter(r => r.severity === 'critical').length;
    const high = rows.filter(r => r.severity === 'high').length;
    const medium = rows.filter(r => r.severity === 'medium').length;
    const low = rows.filter(r => r.severity === 'low').length;

    const filename = `vuln-report-${sanitiseName(productInfo.name)}-${isoDate()}`;

    if (format === 'csv') {
      const headers = ['Severity', 'Source ID', 'Title', 'Dependency', 'Version', 'Ecosystem', 'CVSS', 'Status', 'Affected Versions', 'Fixed Version', 'Mitigation Notes', 'Created'];
      const csvRows = rows.map(r => [
        r.severity, r.source_id, r.title, r.dependency_name, r.dependency_version,
        r.dependency_ecosystem, r.cvss_score, r.status, r.affected_versions, r.fixed_version,
        r.mitigation_notes || '', formatDate(r.created_at),
      ]);
      const csv = rowsToCsv(headers, csvRows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csv);
    } else {
      const pdf = buildProductPdf('Vulnerability Findings', 'Per-product security report', productInfo.name);

      // Summary section
      pdf.sectionTitle('Summary');
      pdf.statLine('Total Findings', total);
      pdf.statLine('Open', open, open > 0 ? '#dc2626' : '#16a34a');
      pdf.statLine('Critical', critical, critical > 0 ? '#dc2626' : PDF_MUTED);
      pdf.statLine('High', high, high > 0 ? '#f97316' : PDF_MUTED);
      pdf.statLine('Medium', medium, medium > 0 ? '#eab308' : PDF_MUTED);
      pdf.statLine('Low', low, low > 0 ? '#3b82f6' : PDF_MUTED);

      // Findings table
      if (total > 0) {
        pdf.sectionTitle('Findings');
        const widths = [55, 85, 150, 80, 70, 55];
        pdf.tableRow(['Severity', 'Source ID', 'Title', 'Dependency', 'Status', 'CVSS'], widths, pdf.doc.y, true);
        pdf.doc.moveDown(0.3);

        for (const r of rows) {
          pdf.checkPageBreak(14);
          const y = pdf.doc.y;
          pdf.tableRow(
            [r.severity?.toUpperCase() || '', r.source_id || '', r.title || '', r.dependency_name || '', r.status || '', r.cvss_score != null ? String(r.cvss_score) : ''],
            widths, y, false, severityColour(r.severity)
          );
          pdf.doc.moveDown(0.25);
        }
      }

      const buffer = await finalisePdf(pdf.doc, pdf.stream, pdf.chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      res.send(buffer);
    }

    // Telemetry (non-blocking)
    const reqData = extractRequestData(req);
    recordEvent({
      userId, email,
      eventType: 'product_report_exported',
      ipAddress: reqData.ipAddress,
      userAgent: reqData.userAgent,
      metadata: { productId, reportType: 'vulnerabilities', format, findingsCount: rows.length },
    }).catch(() => {});

  } catch (err) {
    console.error('Failed to export vulnerability report:', err);
    res.status(500).json({ error: 'Failed to generate vulnerability report' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 2 — LICENCE COMPLIANCE
// ═══════════════════════════════════════════════════════════════════════════════

function riskColour(risk: string): string {
  switch (risk) {
    case 'critical': return '#dc2626';
    case 'warning': return '#f97316';
    default: return PDF_BODY;
  }
}

router.get('/:productId/reports/licences', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const email = (req as any).email;
  const format = (req.query.format as string || 'pdf').toLowerCase();
  const productId = req.params.productId as string;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation' }); return; }

    const productInfo = await getProductInfo(orgId, productId);
    if (!productInfo) { res.status(404).json({ error: 'Product not found' }); return; }

    // Latest scan summary
    const scanResult = await pool.query(
      `SELECT total_deps, permissive_count, copyleft_count, unknown_count, critical_count,
              direct_count, transitive_count, completed_at
       FROM license_scans
       WHERE product_id = $1 AND org_id = $2 AND status = 'completed'
       ORDER BY completed_at DESC LIMIT 1`,
      [productId, orgId]
    );
    const scan = scanResult.rows[0] || null;

    // All findings
    const findingsResult = await pool.query(
      `SELECT dependency_name, dependency_version, license_declared, license_category,
              risk_level, risk_reason, dependency_depth, status, waiver_reason,
              compatibility_verdict, compatibility_reason, created_at
       FROM license_findings
       WHERE product_id = $1 AND org_id = $2
       ORDER BY CASE risk_level WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
                dependency_name`,
      [productId, orgId]
    );
    const rows = findingsResult.rows;

    const filename = `licence-report-${sanitiseName(productInfo.name)}-${isoDate()}`;

    if (format === 'csv') {
      const headers = ['Dependency', 'Version', 'Licence', 'Category', 'Risk Level', 'Depth', 'Status', 'Compatibility', 'Waiver Reason'];
      const csvRows = rows.map(r => [
        r.dependency_name, r.dependency_version, r.license_declared, r.license_category,
        r.risk_level, r.dependency_depth || 'unknown', r.status, r.compatibility_verdict || '',
        r.waiver_reason || '',
      ]);
      const csv = rowsToCsv(headers, csvRows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csv);
    } else {
      const pdf = buildProductPdf('Licence Compliance', 'Per-product licence audit report', productInfo.name);

      // Scan summary
      pdf.sectionTitle('Scan Summary');
      if (scan) {
        pdf.statLine('Total Dependencies', scan.total_deps);
        pdf.statLine('Permissive', scan.permissive_count, '#16a34a');
        pdf.statLine('Copyleft', scan.copyleft_count, parseInt(scan.copyleft_count) > 0 ? '#f97316' : PDF_MUTED);
        pdf.statLine('Unknown', scan.unknown_count, parseInt(scan.unknown_count) > 0 ? '#dc2626' : PDF_MUTED);
        pdf.statLine('Critical Risk', scan.critical_count, parseInt(scan.critical_count) > 0 ? '#dc2626' : PDF_MUTED);
        pdf.statLine('Direct / Transitive', `${scan.direct_count} / ${scan.transitive_count}`);
        pdf.statLine('Last Scan', formatDate(scan.completed_at));
      } else {
        pdf.bodyText('No completed licence scan found for this product.');
      }

      // Findings table
      if (rows.length > 0) {
        pdf.sectionTitle('Licence Findings');
        const widths = [110, 50, 90, 70, 55, 55, 65];
        pdf.tableRow(['Dependency', 'Version', 'Licence', 'Category', 'Risk', 'Status', 'Compat.'], widths, pdf.doc.y, true);
        pdf.doc.moveDown(0.3);

        for (const r of rows) {
          pdf.checkPageBreak(14);
          const y = pdf.doc.y;
          pdf.tableRow(
            [r.dependency_name || '', r.dependency_version || '', r.license_declared || '', r.license_category || '', r.risk_level || '', r.status || '', r.compatibility_verdict || ''],
            widths, y, false, riskColour(r.risk_level)
          );
          pdf.doc.moveDown(0.25);
        }
      }

      const buffer = await finalisePdf(pdf.doc, pdf.stream, pdf.chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      res.send(buffer);
    }

    // Telemetry
    const reqData = extractRequestData(req);
    recordEvent({
      userId, email,
      eventType: 'product_report_exported',
      ipAddress: reqData.ipAddress,
      userAgent: reqData.userAgent,
      metadata: { productId, reportType: 'licences', format, findingsCount: rows.length },
    }).catch(() => {});

  } catch (err) {
    console.error('Failed to export licence report:', err);
    res.status(500).json({ error: 'Failed to generate licence report' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 3 — OBLIGATION STATUS
// ═══════════════════════════════════════════════════════════════════════════════

function statusColour(status: string): string {
  switch (status) {
    case 'met': return '#16a34a';
    case 'in_progress': return '#eab308';
    case 'not_started': return '#dc2626';
    default: return PDF_BODY;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'met': return 'Met';
    case 'in_progress': return 'In Progress';
    case 'not_started': return 'Not Started';
    default: return status;
  }
}

router.get('/:productId/reports/obligations', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const email = (req as any).email;
  const format = (req.query.format as string || 'pdf').toLowerCase();
  const productId = req.params.productId as string;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation' }); return; }

    const productInfo = await getProductInfo(orgId, productId);
    if (!productInfo) { res.status(404).json({ error: 'Product not found' }); return; }

    // Ensure obligations exist and compute derived statuses (same as obligations.ts)
    await ensureObligations(orgId, productId, productInfo.craCategory);

    const [obResult, derivedMap] = await Promise.all([
      pool.query(
        `SELECT id, product_id, obligation_key, status, notes, updated_by, updated_at
         FROM obligations WHERE org_id = $1 AND product_id = $2
         ORDER BY created_at ASC`,
        [orgId, productId]
      ),
      computeDerivedStatuses([productId], orgId, { [productId]: productInfo.craCategory }),
    ]);

    const productDerived = derivedMap[productId] ?? {};
    const obligations = obResult.rows.map(row => enrichObligation(row, productDerived[row.obligation_key] ?? null));

    const met = obligations.filter(o => o.effectiveStatus === 'met').length;
    const inProgress = obligations.filter(o => o.effectiveStatus === 'in_progress').length;
    const notStarted = obligations.filter(o => o.effectiveStatus === 'not_started').length;
    const total = obligations.length;

    const filename = `obligations-report-${sanitiseName(productInfo.name)}-${isoDate()}`;

    if (format === 'csv') {
      const headers = ['Article', 'Title', 'Manual Status', 'Derived Status', 'Effective Status', 'Derived Reason', 'Notes', 'Updated By', 'Updated At'];
      const csvRows = obligations.map(o => [
        o.article, o.title, statusLabel(o.status), statusLabel(o.derivedStatus || ''),
        statusLabel(o.effectiveStatus), o.derivedReason || '', o.notes || '',
        o.updatedBy || '', o.updatedAt ? formatDate(o.updatedAt) : '',
      ]);
      const csv = rowsToCsv(headers, csvRows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csv);
    } else {
      const pdf = buildProductPdf('CRA Obligation Status', 'Regulatory compliance status report', productInfo.name);

      // Progress summary
      pdf.sectionTitle('Progress Summary');
      pdf.statLine('Total Obligations', total);
      pdf.statLine('Met', met, '#16a34a');
      pdf.statLine('In Progress', inProgress, inProgress > 0 ? '#eab308' : PDF_MUTED);
      pdf.statLine('Not Started', notStarted, notStarted > 0 ? '#dc2626' : PDF_MUTED);
      const pct = total > 0 ? Math.round((met / total) * 100) : 0;
      pdf.statLine('Compliance', `${pct}%`, pct >= 100 ? '#16a34a' : pct > 0 ? '#eab308' : '#dc2626');

      // Obligation table
      if (total > 0) {
        pdf.sectionTitle('Obligations');
        const widths = [60, 150, 75, 75, 135];
        pdf.tableRow(['Article', 'Title', 'Status', 'Source', 'Notes'], widths, pdf.doc.y, true);
        pdf.doc.moveDown(0.3);

        for (const o of obligations) {
          pdf.checkPageBreak(14);
          const y = pdf.doc.y;
          const source = o.derivedStatus && o.effectiveStatus !== o.status ? 'Auto-detected' :
                         o.derivedStatus && o.derivedStatus === o.status && o.status !== 'not_started' ? 'Confirmed' : 'Manual';
          pdf.tableRow(
            [o.article, o.title, statusLabel(o.effectiveStatus), source, (o.notes || '').slice(0, 50)],
            widths, y, false, statusColour(o.effectiveStatus)
          );
          pdf.doc.moveDown(0.25);
        }
      }

      const buffer = await finalisePdf(pdf.doc, pdf.stream, pdf.chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      res.send(buffer);
    }

    // Telemetry
    const reqData = extractRequestData(req);
    recordEvent({
      userId, email,
      eventType: 'product_report_exported',
      ipAddress: reqData.ipAddress,
      userAgent: reqData.userAgent,
      metadata: { productId, reportType: 'obligations', format, total, met, inProgress, notStarted },
    }).catch(() => {});

  } catch (err) {
    console.error('Failed to export obligation report:', err);
    res.status(500).json({ error: 'Failed to generate obligation report' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 4 — RISK ASSESSMENT (Annex VII §3)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:productId/reports/risk-assessment', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const email = (req as any).email;
  const productId = req.params.productId as string;
  const format = (req.query.format as string) || 'pdf';

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const productInfo = await getProductInfo(orgId, productId);
    if (!productInfo) { res.status(404).json({ error: 'Product not found' }); return; }

    // Fetch risk assessment section
    const tfResult = await pool.query(
      `SELECT content, notes, status FROM technical_file_sections
       WHERE product_id = $1 AND section_key = 'risk_assessment'`,
      [productId]
    );

    const section = tfResult.rows[0];
    const content = section?.content || {};
    const fields = content.fields || {};
    const annexReqs = content.annex_i_requirements || [];
    const status = section?.status || 'not_started';

    const filename = `risk-assessment_${sanitiseName(productInfo.name)}_${isoDate()}`;

    if (format === 'csv') {
      // CSV — Annex I requirements table
      const headers = ['Ref', 'Title', 'Applicable', 'Justification', 'Evidence'];
      const rows = annexReqs.map((r: any) => [
        r.ref || '',
        r.title || '',
        r.applicable ? 'Yes' : 'No',
        r.justification || '',
        r.evidence || '',
      ]);
      const csv = rowsToCsv(headers, rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csv);
    } else {
      // PDF
      const pdf = buildProductPdf(
        'Cybersecurity Risk Assessment',
        'CRA Annex VII §3 / Article 13(2)',
        productInfo.name
      );

      // Section 1: Methodology
      pdf.sectionTitle('1. Risk Assessment Methodology');
      if (fields.methodology) {
        pdf.bodyText(fields.methodology);
      } else {
        pdf.bodyText('[Not yet documented — complete the risk assessment section in the Technical File.]');
      }

      // Section 2: Threat Model
      pdf.sectionTitle('2. Threat Model / Attack Surface Analysis');
      if (fields.threat_model) {
        pdf.bodyText(fields.threat_model);
      } else {
        pdf.bodyText('[Not yet documented.]');
      }

      // Section 3: Risk Register
      pdf.sectionTitle('3. Risk Register');
      if (fields.risk_register) {
        // Parse Markdown table and render
        const lines = fields.risk_register.split('\n').filter((l: string) => l.trim());
        const dataLines = lines.filter((l: string) => !l.match(/^\|[\s-|]+$/));

        if (dataLines.length > 0) {
          for (const line of dataLines) {
            const cells = line.split('|').map((c: string) => c.trim()).filter(Boolean);
            if (cells.length > 0) {
              const isHeader = dataLines.indexOf(line) === 0;
              pdf.checkPageBreak(14);
              const y = pdf.doc.y;
              const colWidth = pdf.pageWidth / Math.min(cells.length, 7);
              const widths = cells.map(() => colWidth);
              pdf.tableRow(cells.slice(0, 7), widths.slice(0, 7), y, isHeader, isHeader ? PDF_ACCENT : PDF_BODY);
              pdf.doc.moveDown(0.6);
            }
          }
        }
      } else {
        pdf.bodyText('[Not yet documented.]');
      }

      // Section 4: Annex I Part I Requirements
      pdf.sectionTitle('4. Annex I Part I — Essential Requirements');
      if (annexReqs.length > 0) {
        for (const req of annexReqs) {
          pdf.checkPageBreak(60);
          pdf.subHeading(`${req.ref}: ${req.title}`);
          pdf.statLine('Applicable', req.applicable ? 'Yes' : 'No', req.applicable ? '#16a34a' : '#dc2626');
          if (req.applicable && req.evidence) {
            pdf.statLine('Evidence', '');
            pdf.bodyText(req.evidence);
          }
          if (!req.applicable && req.justification) {
            pdf.statLine('Justification', '');
            pdf.bodyText(req.justification);
          }
          if (req.applicable && !req.evidence) {
            pdf.bodyText('[Evidence not yet provided.]');
          }
          pdf.doc.moveDown(0.3);
        }
      } else {
        pdf.bodyText('[Annex I requirements not yet assessed.]');
      }

      const buffer = await finalisePdf(pdf.doc, pdf.stream, pdf.chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      res.send(buffer);
    }

    // Telemetry
    const reqData = extractRequestData(req);
    recordEvent({
      userId, email,
      eventType: 'product_report_exported',
      ipAddress: reqData.ipAddress,
      userAgent: reqData.userAgent,
      metadata: { productId, reportType: 'risk-assessment', format, status, annexReqCount: annexReqs.length },
    }).catch(() => {});

  } catch (err) {
    console.error('Failed to export risk assessment report:', err);
    res.status(500).json({ error: 'Failed to generate risk assessment report' });
  }
});

export default router;

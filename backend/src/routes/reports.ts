import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
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
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
  (req as any).userId = payload.userId;
  next();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getOrgId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.org_id ?? null;
}

/** Returns all products for an org from Neo4j, as { id, name, craCategory } */
async function getOrgProducts(orgId: string): Promise<Array<{ id: string; name: string; craCategory: string | null }>> {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (o:Organisation {org_id: $orgId})<-[:BELONGS_TO]-(p:Product)
       RETURN p.id AS id, p.name AS name, p.craCategory AS craCategory`,
      { orgId }
    );
    return result.records.map(r => ({
      id: r.get('id'),
      name: r.get('name'),
      craCategory: r.get('craCategory'),
    }));
  } finally {
    await session.close();
  }
}

/** Default date range: from = 12 months ago, to = now */
function parseDateRange(req: Request): { from: Date; to: Date } {
  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

  const from = req.query.from ? new Date(req.query.from as string) : twelveMonthsAgo;
  const to = req.query.to ? new Date(req.query.to as string) : now;

  // Ensure 'to' covers the full day
  if (req.query.to) {
    to.setHours(23, 59, 59, 999);
  }

  return { from, to };
}

function formatDate(d: Date | string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function craLabel(cat: string | null): string {
  const labels: Record<string, string> = {
    default: 'Default',
    important_i: 'Important Class I',
    important_ii: 'Important Class II',
    critical: 'Critical',
  };
  return labels[cat ?? 'default'] ?? cat ?? 'Default';
}

// ─── CSV helper ───────────────────────────────────────────────────────────────

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

// ─── PDF helpers (same style as due-diligence) ───────────────────────────────

const PDF_ACCENT = '#6366f1';
const PDF_MUTED = '#6b7280';
const PDF_DARK = '#111827';
const PDF_BODY = '#374151';

function buildPdfBase(title: string, subtitle: string, orgName: string, from: Date, to: Date) {
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
    const range = `${formatDate(from)} – ${formatDate(to)}`;
    doc.text(`CRANIS2 | ${range}`, 50, bottom, { lineBreak: false });
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
  doc.fontSize(12).fillColor(PDF_BODY).text(orgName, { align: 'center' });
  doc.moveDown(1);
  doc.fontSize(10).fillColor(PDF_MUTED).text(
    `Period: ${formatDate(from)} – ${formatDate(to)}`,
    { align: 'center' }
  );
  doc.moveDown(0.5);
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

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT A — COMPLIANCE SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchComplianceSummaryData(orgId: string, from: Date, to: Date) {
  const products = await getOrgProducts(orgId);
  if (!products.length) return { products: [], orgName: '', generatedAt: new Date().toISOString() };

  const productIds = products.map(p => p.id);

  // Obligations per product (current state — not date-filtered)
  const oblResult = await pool.query<{
    product_id: string; total: string; met: string; in_progress: string; not_started: string;
  }>(
    `SELECT product_id,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'met') AS met,
       COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
       COUNT(*) FILTER (WHERE status = 'not_started') AS not_started
     FROM obligations
     WHERE org_id = $1 AND product_id = ANY($2)
     GROUP BY product_id`,
    [orgId, productIds]
  );
  const oblMap = new Map(oblResult.rows.map(r => [r.product_id, r]));

  // Technical file sections per product (current state)
  const tfResult = await pool.query<{ product_id: string; total: string; complete: string }>(
    `SELECT product_id,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'complete') AS complete
     FROM technical_file_sections
     WHERE product_id = ANY($1)
     GROUP BY product_id`,
    [productIds]
  );
  const tfMap = new Map(tfResult.rows.map(r => [r.product_id, r]));

  // Latest completed vuln scan per product within range
  const vulnResult = await pool.query<{
    product_id: string; completed_at: Date;
    findings_count: string; critical_count: string; high_count: string; medium_count: string; low_count: string;
  }>(
    `SELECT DISTINCT ON (product_id)
       product_id, completed_at, findings_count,
       critical_count, high_count, medium_count, low_count
     FROM vulnerability_scans
     WHERE org_id = $1 AND product_id = ANY($2)
       AND status = 'completed' AND completed_at BETWEEN $3 AND $4
     ORDER BY product_id, completed_at DESC`,
    [orgId, productIds, from, to]
  );
  const vulnMap = new Map(vulnResult.rows.map(r => [r.product_id, r]));

  // CRA reports per product created within range
  const craResult = await pool.query<{ product_id: string; total: string; draft: string; submitted: string }>(
    `SELECT product_id,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'draft') AS draft,
       COUNT(*) FILTER (WHERE status NOT IN ('draft')) AS submitted
     FROM cra_reports
     WHERE org_id = $1 AND product_id = ANY($2)
       AND created_at BETWEEN $3 AND $4
     GROUP BY product_id`,
    [orgId, productIds, from, to]
  );
  const craMap = new Map(craResult.rows.map(r => [r.product_id, r]));

  // Org name from Neo4j
  const driver = getDriver();
  const session = driver.session();
  let orgName = '';
  try {
    const orgResult = await session.run(
      `MATCH (o:Organisation {org_id: $orgId}) RETURN o.name AS name`,
      { orgId }
    );
    orgName = orgResult.records[0]?.get('name') ?? '';
  } finally {
    await session.close();
  }

  return {
    orgName,
    generatedAt: new Date().toISOString(),
    products: products.map(p => {
      const obl = oblMap.get(p.id);
      const tf = tfMap.get(p.id);
      const vuln = vulnMap.get(p.id);
      const cra = craMap.get(p.id);
      const tfTotal = parseInt(tf?.total ?? '0');
      const tfComplete = parseInt(tf?.complete ?? '0');
      return {
        id: p.id,
        name: p.name,
        craCategory: p.craCategory,
        obligations: {
          total: parseInt(obl?.total ?? '0'),
          met: parseInt(obl?.met ?? '0'),
          inProgress: parseInt(obl?.in_progress ?? '0'),
          notStarted: parseInt(obl?.not_started ?? '0'),
        },
        technicalFile: {
          totalSections: tfTotal,
          completeSections: tfComplete,
          percentComplete: tfTotal > 0 ? Math.round((tfComplete / tfTotal) * 100) : 0,
        },
        vulnerabilities: vuln
          ? {
              lastScannedAt: vuln.completed_at,
              total: parseInt(vuln.findings_count),
              critical: parseInt(vuln.critical_count),
              high: parseInt(vuln.high_count),
              medium: parseInt(vuln.medium_count),
              low: parseInt(vuln.low_count),
            }
          : null,
        craReports: {
          total: parseInt(cra?.total ?? '0'),
          draft: parseInt(cra?.draft ?? '0'),
          submitted: parseInt(cra?.submitted ?? '0'),
        },
      };
    }),
  };
}

// GET /api/reports/compliance-summary
router.get('/compliance-summary', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }
    const { from, to } = parseDateRange(req);
    const data = await fetchComplianceSummaryData(orgId, from, to);
    res.json(data);
  } catch (err) {
    console.error('[reports] compliance-summary error:', err);
    res.status(500).json({ error: 'Failed to generate compliance summary' });
  }
});

// GET /api/reports/compliance-summary/export
router.get('/compliance-summary/export', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const format = (req.query.format as string) || 'pdf';
  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }
    const { from, to } = parseDateRange(req);
    const data = await fetchComplianceSummaryData(orgId, from, to);

    if (format === 'csv') {
      const headers = [
        'Product', 'CRA Category',
        'Obligations Total', 'Obligations Met', 'Obligations In Progress', 'Obligations Not Started',
        'Tech File %', 'Tech File Sections Complete',
        'Vuln Critical', 'Vuln High', 'Vuln Medium', 'Vuln Low', 'Vuln Last Scanned',
        'CRA Reports Total', 'CRA Reports Draft', 'CRA Reports Submitted',
      ];
      const rows = data.products.map(p => [
        p.name, craLabel(p.craCategory),
        p.obligations.total, p.obligations.met, p.obligations.inProgress, p.obligations.notStarted,
        `${p.technicalFile.percentComplete}%`,
        `${p.technicalFile.completeSections}/${p.technicalFile.totalSections}`,
        p.vulnerabilities?.critical ?? '—', p.vulnerabilities?.high ?? '—',
        p.vulnerabilities?.medium ?? '—', p.vulnerabilities?.low ?? '—',
        p.vulnerabilities?.lastScannedAt ? formatDate(p.vulnerabilities.lastScannedAt) : '—',
        p.craReports.total, p.craReports.draft, p.craReports.submitted,
      ]);
      const csv = rowsToCsv(headers, rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="compliance-summary-${from.toISOString().slice(0,10)}.csv"`);
      res.send(csv);
      return;
    }

    // PDF
    const { doc, stream, chunks, pageWidth, sectionTitle, subHeading, tableRow, checkPageBreak } =
      buildPdfBase('Compliance Summary', 'CRA Obligations & Product Posture', data.orgName, from, to);

    const done = new Promise<Buffer>((resolve, reject) => {
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });

    sectionTitle('Compliance Summary');

    const colWidths = [150, 100, 70, 70, 70, 80];
    const colHeaders = ['Product', 'CRA Category', 'Obligations', 'Tech File %', 'Open Vulns', 'CRA Reports'];

    // Table header
    tableRow(colHeaders, colWidths, doc.y, true, PDF_ACCENT);
    doc.moveDown(0.6);
    doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
    doc.moveDown(0.3);

    for (const p of data.products) {
      checkPageBreak(20);
      const oblText = `${p.obligations.met}/${p.obligations.total} met`;
      const tfText = `${p.technicalFile.percentComplete}%`;
      const vulnText = p.vulnerabilities
        ? `${p.vulnerabilities.critical}C ${p.vulnerabilities.high}H`
        : '—';
      const craText = `${p.craReports.total} (${p.craReports.draft} draft)`;
      tableRow(
        [p.name, craLabel(p.craCategory), oblText, tfText, vulnText, craText],
        colWidths, doc.y
      );
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).strokeColor('#f3f4f6').lineWidth(0.3).stroke();
      doc.moveDown(0.2);
    }

    // Per-product detail pages
    for (const p of data.products) {
      sectionTitle(p.name);

      subHeading('Obligations');
      doc.fontSize(9).fillColor(PDF_BODY)
        .text(`Total: ${p.obligations.total}  |  Met: ${p.obligations.met}  |  In Progress: ${p.obligations.inProgress}  |  Not Started: ${p.obligations.notStarted}`);
      doc.moveDown(0.5);

      subHeading('Technical File (Annex VII)');
      doc.fontSize(9).fillColor(PDF_BODY)
        .text(`${p.technicalFile.completeSections} of ${p.technicalFile.totalSections} sections complete (${p.technicalFile.percentComplete}%)`);
      doc.moveDown(0.5);

      subHeading('Vulnerability Posture');
      if (p.vulnerabilities) {
        doc.fontSize(9).fillColor(PDF_BODY)
          .text(`Last scan: ${formatDate(p.vulnerabilities.lastScannedAt)}  |  Critical: ${p.vulnerabilities.critical}  |  High: ${p.vulnerabilities.high}  |  Medium: ${p.vulnerabilities.medium}  |  Low: ${p.vulnerabilities.low}`);
      } else {
        doc.fontSize(9).fillColor(PDF_MUTED).text('No scan completed in selected period.');
      }
      doc.moveDown(0.5);

      subHeading(`ENISA Reports (${formatDate(from)} – ${formatDate(to)})`);
      doc.fontSize(9).fillColor(PDF_BODY)
        .text(`Total: ${p.craReports.total}  |  Draft: ${p.craReports.draft}  |  Submitted: ${p.craReports.submitted}`);
    }

    doc.end();
    const buf = await done;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="compliance-summary-${from.toISOString().slice(0,10)}.pdf"`);
    res.send(buf);
  } catch (err) {
    console.error('[reports] compliance-summary/export error:', err);
    res.status(500).json({ error: 'Failed to export compliance summary' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT B — VULNERABILITY TRENDS
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchVulnTrendsData(orgId: string, from: Date, to: Date, productId?: string) {
  const params: unknown[] = [orgId, from, to];
  const productFilter = productId ? `AND vs.product_id = $4` : '';
  const findingProductFilter = productId ? `AND vf.product_id = $4` : '';
  if (productId) params.push(productId);

  // Scan history — one row per completed scan
  const scansResult = await pool.query<{
    id: string; product_id: string; completed_at: Date;
    findings_count: string; critical_count: string; high_count: string; medium_count: string; low_count: string;
  }>(
    `SELECT id, product_id, completed_at, findings_count,
       critical_count, high_count, medium_count, low_count
     FROM vulnerability_scans
     WHERE org_id = $1 AND status = 'completed'
       AND completed_at BETWEEN $2 AND $3 ${productFilter}
     ORDER BY completed_at ASC`,
    params
  );

  // Status distribution over time (grouped by month)
  const statusResult = await pool.query<{ month: string; status: string; count: string }>(
    `SELECT TO_CHAR(DATE_TRUNC('month', vf.created_at), 'YYYY-MM') AS month,
       vf.status, COUNT(*) AS count
     FROM vulnerability_findings vf
     WHERE vf.org_id = $1
       AND vf.created_at BETWEEN $2 AND $3 ${findingProductFilter}
     GROUP BY DATE_TRUNC('month', vf.created_at), vf.status
     ORDER BY DATE_TRUNC('month', vf.created_at) ASC`,
    params
  );

  // Ecosystem breakdown
  const ecoResult = await pool.query<{ ecosystem: string; total: string; open_count: string }>(
    `SELECT vf.dependency_ecosystem AS ecosystem,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE vf.status = 'open') AS open_count
     FROM vulnerability_findings vf
     WHERE vf.org_id = $1
       AND vf.created_at BETWEEN $2 AND $3 ${findingProductFilter}
       AND vf.dependency_ecosystem IS NOT NULL
     GROUP BY vf.dependency_ecosystem
     ORDER BY total DESC`,
    params
  );

  // Severity totals summary
  const summaryResult = await pool.query<{
    critical: string; high: string; medium: string; low: string;
    open_count: string; resolved_count: string; dismissed_count: string; total: string;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE severity = 'critical') AS critical,
       COUNT(*) FILTER (WHERE severity = 'high') AS high,
       COUNT(*) FILTER (WHERE severity = 'medium') AS medium,
       COUNT(*) FILTER (WHERE severity = 'low') AS low,
       COUNT(*) FILTER (WHERE status = 'open') AS open_count,
       COUNT(*) FILTER (WHERE status IN ('resolved', 'mitigated')) AS resolved_count,
       COUNT(*) FILTER (WHERE status = 'dismissed') AS dismissed_count,
       COUNT(*) AS total
     FROM vulnerability_findings vf
     WHERE vf.org_id = $1
       AND vf.created_at BETWEEN $2 AND $3 ${findingProductFilter}`,
    params
  );

  const s = summaryResult.rows[0];

  // Pivot status-by-month into chart-friendly format
  const monthMap = new Map<string, Record<string, number>>();
  for (const row of statusResult.rows) {
    if (!monthMap.has(row.month)) monthMap.set(row.month, {});
    monthMap.get(row.month)![row.status] = parseInt(row.count);
  }
  const statusByMonth = Array.from(monthMap.entries()).map(([month, counts]) => ({
    month,
    open: counts.open ?? 0,
    acknowledged: counts.acknowledged ?? 0,
    mitigated: counts.mitigated ?? 0,
    resolved: counts.resolved ?? 0,
    dismissed: counts.dismissed ?? 0,
  }));

  return {
    scans: scansResult.rows.map(r => ({
      id: r.id,
      productId: r.product_id,
      completedAt: r.completed_at,
      findingsCount: parseInt(r.findings_count),
      critical: parseInt(r.critical_count),
      high: parseInt(r.high_count),
      medium: parseInt(r.medium_count),
      low: parseInt(r.low_count),
    })),
    statusByMonth,
    ecosystems: ecoResult.rows.map(r => ({
      ecosystem: r.ecosystem,
      total: parseInt(r.total),
      openCount: parseInt(r.open_count),
    })),
    summary: s ? {
      critical: parseInt(s.critical),
      high: parseInt(s.high),
      medium: parseInt(s.medium),
      low: parseInt(s.low),
      open: parseInt(s.open_count),
      resolved: parseInt(s.resolved_count),
      dismissed: parseInt(s.dismissed_count),
      total: parseInt(s.total),
    } : { critical: 0, high: 0, medium: 0, low: 0, open: 0, resolved: 0, dismissed: 0, total: 0 },
    generatedAt: new Date().toISOString(),
  };
}

// GET /api/reports/vulnerability-trends
router.get('/vulnerability-trends', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }
    const { from, to } = parseDateRange(req);
    const productId = req.query.productId as string | undefined;
    const data = await fetchVulnTrendsData(orgId, from, to, productId);
    // Also return product list for the selector
    const products = await getOrgProducts(orgId);
    res.json({ ...data, products });
  } catch (err) {
    console.error('[reports] vulnerability-trends error:', err);
    res.status(500).json({ error: 'Failed to generate vulnerability trends' });
  }
});

// GET /api/reports/vulnerability-trends/export
router.get('/vulnerability-trends/export', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const format = (req.query.format as string) || 'pdf';
  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }
    const { from, to } = parseDateRange(req);
    const productId = req.query.productId as string | undefined;
    const data = await fetchVulnTrendsData(orgId, from, to, productId);

    if (format === 'csv') {
      // Sheet 1 (prefixed): scan history
      const scanHeaders = ['Date', 'Product ID', 'Total Findings', 'Critical', 'High', 'Medium', 'Low'];
      const scanRows = data.scans.map(s => [
        formatDate(s.completedAt), s.productId,
        s.findingsCount, s.critical, s.high, s.medium, s.low,
      ]);
      // Sheet 2: ecosystem breakdown
      const ecoHeaders = ['Ecosystem', 'Total Findings', 'Open Findings'];
      const ecoRows = data.ecosystems.map(e => [e.ecosystem, e.total, e.openCount]);

      const csv = [
        'SCAN HISTORY',
        rowsToCsv(scanHeaders, scanRows),
        '',
        'ECOSYSTEM BREAKDOWN',
        rowsToCsv(ecoHeaders, ecoRows),
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="vulnerability-trends-${from.toISOString().slice(0,10)}.csv"`);
      res.send(csv);
      return;
    }

    // Org name for cover
    const driver = getDriver();
    const session = driver.session();
    let orgName = '';
    try {
      const r = await session.run(`MATCH (o:Organisation {org_id: $orgId}) RETURN o.name AS name`, { orgId });
      orgName = r.records[0]?.get('name') ?? '';
    } finally {
      await session.close();
    }

    const { doc, stream, chunks, pageWidth, sectionTitle, subHeading, tableRow, checkPageBreak } =
      buildPdfBase('Vulnerability Trends', 'Scan History & Risk Analysis', orgName, from, to);

    const done = new Promise<Buffer>((resolve, reject) => {
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });

    // Summary section
    sectionTitle('Summary');
    const s = data.summary;
    doc.fontSize(10).fillColor(PDF_BODY)
      .text(`Total findings: ${s.total}  |  Open: ${s.open}  |  Resolved/Mitigated: ${s.resolved}  |  Dismissed: ${s.dismissed}`);
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(PDF_BODY)
      .text(`Critical: ${s.critical}  |  High: ${s.high}  |  Medium: ${s.medium}  |  Low: ${s.low}`);

    // Scan history table
    sectionTitle('Scan History');
    const scanCols = [90, 90, 70, 60, 60, 60, 60];
    const scanHeaders = ['Date', 'Product', 'Total', 'Critical', 'High', 'Medium', 'Low'];
    tableRow(scanHeaders, scanCols, doc.y, true, PDF_ACCENT);
    doc.moveDown(0.6);
    doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
    doc.moveDown(0.3);

    for (const scan of data.scans) {
      checkPageBreak(16);
      tableRow([
        formatDate(scan.completedAt), scan.productId.slice(0, 20),
        String(scan.findingsCount), String(scan.critical),
        String(scan.high), String(scan.medium), String(scan.low),
      ], scanCols, doc.y);
      doc.moveDown(0.5);
    }

    // Status by month
    if (data.statusByMonth.length) {
      sectionTitle('Finding Status by Month');
      const mCols = [70, 60, 80, 70, 70, 70];
      const mHeaders = ['Month', 'Open', 'Acknowledged', 'Mitigated', 'Resolved', 'Dismissed'];
      tableRow(mHeaders, mCols, doc.y, true, PDF_ACCENT);
      doc.moveDown(0.6);
      doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
      doc.moveDown(0.3);
      for (const row of data.statusByMonth) {
        checkPageBreak(16);
        tableRow([
          row.month, String(row.open), String(row.acknowledged),
          String(row.mitigated), String(row.resolved), String(row.dismissed),
        ], mCols, doc.y);
        doc.moveDown(0.5);
      }
    }

    // Ecosystem breakdown
    if (data.ecosystems.length) {
      sectionTitle('Ecosystem Breakdown');
      const eCols = [200, 150, 140];
      const eHeaders = ['Ecosystem', 'Total Findings', 'Open Findings'];
      tableRow(eHeaders, eCols, doc.y, true, PDF_ACCENT);
      doc.moveDown(0.6);
      doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
      doc.moveDown(0.3);
      for (const eco of data.ecosystems) {
        checkPageBreak(16);
        tableRow([eco.ecosystem, String(eco.total), String(eco.openCount)], eCols, doc.y);
        doc.moveDown(0.5);
      }
    }

    doc.end();
    const buf = await done;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="vulnerability-trends-${from.toISOString().slice(0,10)}.pdf"`);
    res.send(buf);
  } catch (err) {
    console.error('[reports] vulnerability-trends/export error:', err);
    res.status(500).json({ error: 'Failed to export vulnerability trends' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT C — AUDIT TRAIL
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORY_FILTERS: Record<string, string[]> = {
  auth: ['login', 'register', 'login_failed_bad_token', 'login_failed_unverified', 'login_failed_no_account'],
  vulnerability: ['vulnerability_scan_triggered', 'vulnerability_finding_updated'],
  data_export: ['sbom_export', 'due_diligence_export', 'report_export'],
  sync: ['github_repo_synced', 'sbom_refreshed', 'webhook_sbom_stale', 'github_connected'],
};

async function fetchAuditTrailData(orgId: string, from: Date, to: Date, category?: string) {
  const products = await getOrgProducts(orgId);
  const productIds = products.map(p => p.id);

  // User events
  let eventQuery = `
    SELECT e.id, e.event_type, e.ip_address, e.metadata, e.created_at,
      COALESCE(u.email, 'system') AS user_email
    FROM user_events e
    LEFT JOIN users u ON e.user_id = u.id
    WHERE (u.org_id = $1 OR e.user_id IS NULL)
      AND e.created_at BETWEEN $2 AND $3
  `;
  const eventParams: unknown[] = [orgId, from, to];

  if (category && CATEGORY_FILTERS[category]) {
    eventQuery += ` AND e.event_type = ANY($4)`;
    eventParams.push(CATEGORY_FILTERS[category]);
  }
  eventQuery += ` ORDER BY e.created_at DESC LIMIT 500`;

  const eventResult = await pool.query(eventQuery, eventParams);

  // CRA report stage submissions within range (skip if category filter excludes compliance)
  let stageRows: any[] = [];
  if (!category || category === 'compliance') {
    const stageResult = await pool.query(
      `SELECT rs.id, rs.stage, rs.submitted_at,
         cr.product_id, cr.report_type,
         COALESCE(u.email, 'unknown') AS submitted_by
       FROM cra_report_stages rs
       JOIN cra_reports cr ON rs.report_id = cr.id
       LEFT JOIN users u ON rs.submitted_by = u.id
       WHERE cr.org_id = $1 AND rs.submitted_at BETWEEN $2 AND $3
       ORDER BY rs.submitted_at DESC`,
      [orgId, from, to]
    );
    stageRows = stageResult.rows;
  }

  // Sync history (linked to org via product_ids)
  let syncRows: any[] = [];
  if ((!category || category === 'sync') && productIds.length) {
    const syncResult = await pool.query(
      `SELECT id, product_id, sync_type, started_at, duration_seconds,
         package_count, contributor_count, status, triggered_by, error_message
       FROM sync_history
       WHERE product_id = ANY($1) AND started_at BETWEEN $2 AND $3
       ORDER BY started_at DESC LIMIT 200`,
      [productIds, from, to]
    );
    syncRows = syncResult.rows;
  }

  return {
    userEvents: eventResult.rows.map(r => ({
      id: r.id,
      eventType: r.event_type,
      userEmail: r.user_email,
      ipAddress: r.ip_address,
      metadata: r.metadata,
      createdAt: r.created_at,
    })),
    complianceStages: stageRows.map(r => ({
      id: r.id,
      stage: r.stage,
      reportType: r.report_type,
      productId: r.product_id,
      submittedBy: r.submitted_by,
      submittedAt: r.submitted_at,
    })),
    syncHistory: syncRows.map(r => ({
      id: r.id,
      productId: r.product_id,
      syncType: r.sync_type,
      startedAt: r.started_at,
      durationSeconds: parseFloat(r.duration_seconds),
      packageCount: r.package_count,
      contributorCount: r.contributor_count,
      status: r.status,
      triggeredBy: r.triggered_by,
      errorMessage: r.error_message,
    })),
    generatedAt: new Date().toISOString(),
  };
}

// GET /api/reports/audit-trail
router.get('/audit-trail', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }
    const { from, to } = parseDateRange(req);
    const category = req.query.category as string | undefined;
    const data = await fetchAuditTrailData(orgId, from, to, category);
    res.json(data);
  } catch (err) {
    console.error('[reports] audit-trail error:', err);
    res.status(500).json({ error: 'Failed to generate audit trail' });
  }
});

// GET /api/reports/audit-trail/export
router.get('/audit-trail/export', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const format = (req.query.format as string) || 'pdf';
  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }
    const { from, to } = parseDateRange(req);
    const category = req.query.category as string | undefined;
    const data = await fetchAuditTrailData(orgId, from, to, category);

    if (format === 'csv') {
      const eventHeaders = ['Timestamp', 'User', 'Event Type', 'IP Address', 'Details'];
      const eventRows = data.userEvents.map(e => [
        new Date(e.createdAt).toISOString(),
        e.userEmail, e.eventType, e.ipAddress ?? '',
        e.metadata ? JSON.stringify(e.metadata) : '',
      ]);
      const stageHeaders = ['Timestamp', 'Submitted By', 'Report Type', 'Stage', 'Product ID'];
      const stageRows = data.complianceStages.map(s => [
        new Date(s.submittedAt).toISOString(),
        s.submittedBy, s.reportType, s.stage, s.productId,
      ]);
      const syncHeaders = ['Timestamp', 'Product ID', 'Type', 'Duration (s)', 'Packages', 'Contributors', 'Status', 'Triggered By'];
      const syncRows = data.syncHistory.map(s => [
        new Date(s.startedAt).toISOString(),
        s.productId, s.syncType, s.durationSeconds,
        s.packageCount, s.contributorCount, s.status, s.triggeredBy ?? '',
      ]);

      const csv = [
        'USER EVENTS',
        rowsToCsv(eventHeaders, eventRows),
        '',
        'COMPLIANCE STAGE SUBMISSIONS',
        rowsToCsv(stageHeaders, stageRows),
        '',
        'REPOSITORY SYNCS',
        rowsToCsv(syncHeaders, syncRows),
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-trail-${from.toISOString().slice(0,10)}.csv"`);
      res.send(csv);
      return;
    }

    // Org name
    const driver = getDriver();
    const session = driver.session();
    let orgName = '';
    try {
      const r = await session.run(`MATCH (o:Organisation {org_id: $orgId}) RETURN o.name AS name`, { orgId });
      orgName = r.records[0]?.get('name') ?? '';
    } finally {
      await session.close();
    }

    const { doc, stream, chunks, pageWidth, sectionTitle, subHeading, tableRow, checkPageBreak } =
      buildPdfBase('Audit Trail', 'User Activity & Compliance Events', orgName, from, to);

    const done = new Promise<Buffer>((resolve, reject) => {
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });

    // User events
    sectionTitle('User Activity');
    const evCols = [110, 140, 130, 110];
    tableRow(['Timestamp', 'User', 'Event', 'IP Address'], evCols, doc.y, true, PDF_ACCENT);
    doc.moveDown(0.6);
    doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
    doc.moveDown(0.3);

    for (const e of data.userEvents) {
      checkPageBreak(16);
      tableRow([
        formatDate(e.createdAt),
        e.userEmail.slice(0, 24),
        e.eventType,
        e.ipAddress ?? '—',
      ], evCols, doc.y);
      doc.moveDown(0.5);
    }

    // Compliance stage submissions
    if (data.complianceStages.length) {
      sectionTitle('ENISA Report Stage Submissions');
      const stCols = [110, 140, 100, 140];
      tableRow(['Timestamp', 'Submitted By', 'Stage', 'Product ID'], stCols, doc.y, true, PDF_ACCENT);
      doc.moveDown(0.6);
      doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
      doc.moveDown(0.3);
      for (const s of data.complianceStages) {
        checkPageBreak(16);
        tableRow([
          formatDate(s.submittedAt), s.submittedBy.slice(0, 24),
          s.stage, s.productId.slice(0, 24),
        ], stCols, doc.y);
        doc.moveDown(0.5);
      }
    }

    // Sync history
    if (data.syncHistory.length) {
      sectionTitle('Repository Syncs');
      const synCols = [110, 100, 80, 60, 70, 80, 110];
      tableRow(['Timestamp', 'Product ID', 'Type', 'Duration', 'Pkgs', 'Status', 'Triggered By'], synCols, doc.y, true, PDF_ACCENT);
      doc.moveDown(0.6);
      doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
      doc.moveDown(0.3);
      for (const s of data.syncHistory) {
        checkPageBreak(16);
        tableRow([
          formatDate(s.startedAt), s.productId.slice(0, 20),
          s.syncType, `${s.durationSeconds}s`,
          String(s.packageCount), s.status,
          (s.triggeredBy ?? 'system').slice(0, 20),
        ], synCols, doc.y);
        doc.moveDown(0.5);
      }
    }

    doc.end();
    const buf = await done;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="audit-trail-${from.toISOString().slice(0,10)}.pdf"`);
    res.send(buf);
  } catch (err) {
    console.error('[reports] audit-trail/export error:', err);
    res.status(500).json({ error: 'Failed to export audit trail' });
  }
});

export default router;

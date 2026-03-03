import { Router, Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { getDriver } from '../db/neo4j.js';
import pool from '../db/pool.js';
import { verifySessionToken } from '../utils/token.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';

const router = Router();

// ─── Auth middleware ─────────────────────────────────────────
async function requireAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) { res.status(401).json({ error: 'No token provided' }); return; }
  const token = authHeader.split(' ')[1];
  try {
    const payload = verifySessionToken(token);
    if (!payload) { res.status(401).json({ error: 'Invalid token' }); return; }
    (req as any).userId = payload.userId;
    (req as any).email = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

async function getUserOrgId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.org_id || null;
}

// ─── Default sections per CRA Annex VII ──────────────────────
const DEFAULT_SECTIONS = [
  {
    section_key: 'product_description',
    title: 'Product Description',
    cra_reference: 'Annex VII §1',
    content: {
      guidance: 'Describe the product including its intended purpose, software versions affecting cybersecurity compliance, how it is made available on the market, and user information/instructions per Annex II.',
      fields: {
        intended_purpose: '',
        versions_affecting_compliance: '',
        market_availability: '',
        user_instructions_reference: '',
      }
    }
  },
  {
    section_key: 'design_development',
    title: 'Design & Development',
    cra_reference: 'Annex VII §2(a)',
    content: {
      guidance: 'Document the design and development process including system architecture drawings/schemes, how software components build on each other, and how they integrate into the overall processing. Include SDLC process description.',
      fields: {
        architecture_description: '',
        component_interactions: '',
        sdlc_process: '',
        production_monitoring: '',
      }
    }
  },
  {
    section_key: 'vulnerability_handling',
    title: 'Vulnerability Handling',
    cra_reference: 'Annex VII §2(b)',
    content: {
      guidance: 'Document vulnerability handling processes: coordinated vulnerability disclosure policy, reporting contact address, secure update distribution mechanism, and reference to the SBOM (managed in Dependencies tab).',
      fields: {
        disclosure_policy_url: '',
        reporting_contact: '',
        update_distribution_mechanism: '',
        security_update_policy: '',
        sbom_reference: 'See Dependencies tab — auto-generated from GitHub repository.',
      }
    }
  },
  {
    section_key: 'risk_assessment',
    title: 'Cybersecurity Risk Assessment',
    cra_reference: 'Annex VII §3, Article 13(2)',
    content: {
      guidance: 'Document the cybersecurity risk assessment considering intended purpose and foreseeable use. Must demonstrate how each Annex I Part I essential requirement is addressed, or justify why it is not applicable.',
      fields: {
        methodology: '',
        threat_model: '',
        risk_register: '',
      },
      annex_i_requirements: [
        { ref: 'I(a)', title: 'No known exploitable vulnerabilities', applicable: true, justification: '', evidence: '' },
        { ref: 'I(b)', title: 'Secure-by-default configuration', applicable: true, justification: '', evidence: '' },
        { ref: 'I(c)', title: 'Security update mechanism', applicable: true, justification: '', evidence: '' },
        { ref: 'I(d)', title: 'Access control & authentication', applicable: true, justification: '', evidence: '' },
        { ref: 'I(e)', title: 'Data confidentiality & encryption', applicable: true, justification: '', evidence: '' },
        { ref: 'I(f)', title: 'Data & command integrity', applicable: true, justification: '', evidence: '' },
        { ref: 'I(g)', title: 'Data minimisation', applicable: true, justification: '', evidence: '' },
        { ref: 'I(h)', title: 'Availability & resilience', applicable: true, justification: '', evidence: '' },
        { ref: 'I(i)', title: 'Minimise impact on other services', applicable: true, justification: '', evidence: '' },
        { ref: 'I(j)', title: 'Attack surface limitation', applicable: true, justification: '', evidence: '' },
        { ref: 'I(k)', title: 'Exploitation mitigation', applicable: true, justification: '', evidence: '' },
        { ref: 'I(l)', title: 'Security monitoring & logging', applicable: true, justification: '', evidence: '' },
        { ref: 'I(m)', title: 'Secure data erasure & transfer', applicable: true, justification: '', evidence: '' },
      ]
    }
  },
  {
    section_key: 'support_period',
    title: 'Support Period',
    cra_reference: 'Annex VII §4, Article 13(8)',
    content: {
      guidance: 'Determine and document the support period. Minimum 5 years or expected product lifetime, whichever is shorter. Include rationale for the determined period.',
      fields: {
        start_date: '',
        end_date: '',
        rationale: '',
        communication_plan: '',
      }
    }
  },
  {
    section_key: 'standards_applied',
    title: 'Standards & Specifications Applied',
    cra_reference: 'Annex VII §5',
    content: {
      guidance: 'List harmonised standards (published in the Official Journal of the EU), common specifications per Article 27(2), or European cybersecurity certification schemes per Regulation (EU) 2019/881. Where partially applied, specify which parts. Where none applied, describe alternative solutions.',
      standards: [],
    }
  },
  {
    section_key: 'test_reports',
    title: 'Test Reports',
    cra_reference: 'Annex VII §6',
    content: {
      guidance: 'Results of tests and examinations to verify conformity with Annex I essential requirements. Include penetration testing, static/dynamic analysis, vulnerability scans, and any third-party audit results.',
      reports: [],
    }
  },
  {
    section_key: 'declaration_of_conformity',
    title: 'EU Declaration of Conformity',
    cra_reference: 'Annex VII §7, Annex VI',
    content: {
      guidance: 'The formal EU Declaration of Conformity per Article 28 and Annex VI. Includes the conformity assessment module used (A, B+C, or H), notified body details if applicable, and CE marking information.',
      fields: {
        assessment_module: '',
        notified_body: '',
        certificate_reference: '',
        ce_marking_date: '',
        declaration_text: '',
      }
    }
  },
];

// ─── Helper: ensure sections exist for a product ─────────────
async function ensureSections(productId: string): Promise<void> {
  for (const section of DEFAULT_SECTIONS) {
    await pool.query(
      `INSERT INTO technical_file_sections (product_id, section_key, title, content, cra_reference)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (product_id, section_key) DO NOTHING`,
      [productId, section.section_key, section.title, JSON.stringify(section.content), section.cra_reference]
    );
  }
}

// ─── Helper: update Neo4j TechnicalFile node ─────────────────
async function updateTechFileNode(productId: string): Promise<void> {
  const result = await pool.query(
    `SELECT status FROM technical_file_sections WHERE product_id = $1`,
    [productId]
  );
  const rows = result.rows;
  const total = rows.length;
  const completed = rows.filter((r: any) => r.status === 'completed').length;
  const inProgress = rows.filter((r: any) => r.status === 'in_progress').length;

  let overallStatus = 'not_started';
  if (completed === total && total > 0) overallStatus = 'completed';
  else if (completed > 0 || inProgress > 0) overallStatus = 'in_progress';

  const neo4jSession = getDriver().session();
  try {
    await neo4jSession.run(
      `MATCH (p:Product {id: $productId})
       MERGE (p)-[:HAS_TECHNICAL_FILE]->(tf:TechnicalFile {productId: $productId})
       SET tf.status = $status,
           tf.completedSections = $completed,
           tf.totalSections = $total,
           tf.updatedAt = datetime()`,
      { productId, status: overallStatus, completed, total }
    );
  } finally {
    await neo4jSession.close();
  }
}

// ─── GET /api/technical-file/:productId ──────────────────────
// Returns all sections for a product (auto-creates on first access)
router.get('/:productId', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const orgId = await getUserOrgId(userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const productId = req.params.productId as string;

  // Verify product belongs to user's org
  const neo4jSession = getDriver().session();
  try {
    const check = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId}) RETURN p`,
      { orgId, productId }
    );
    if (check.records.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Auto-create sections if they don't exist yet
    await ensureSections(productId);

    const result = await pool.query(
      `SELECT section_key, title, content, notes, status, cra_reference, updated_by, updated_at
       FROM technical_file_sections
       WHERE product_id = $1
       ORDER BY created_at ASC`,
      [productId]
    );

    const sections = result.rows.map((row: any) => ({
      sectionKey: row.section_key,
      title: row.title,
      content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
      notes: row.notes,
      status: row.status,
      craReference: row.cra_reference,
      updatedBy: row.updated_by,
      updatedAt: row.updated_at,
    }));

    // Compute progress
    const total = sections.length;
    const completed = sections.filter((s: any) => s.status === 'completed').length;
    const inProgress = sections.filter((s: any) => s.status === 'in_progress').length;

    res.json({
      productId,
      sections,
      progress: { total, completed, inProgress, notStarted: total - completed - inProgress },
    });
  } finally {
    await neo4jSession.close();
  }
});

// ─── PUT /api/technical-file/:productId/:sectionKey ──────────
// Update a section's content, notes, and/or status
router.put('/:productId/:sectionKey', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).email;
  const orgId = await getUserOrgId(userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const productId = req.params.productId as string;
  const sectionKey = req.params.sectionKey as string;
  const { content, notes, status } = req.body;

  // Validate status if provided
  if (status && !['not_started', 'in_progress', 'completed'].includes(status)) {
    res.status(400).json({ error: 'Invalid status. Must be: not_started, in_progress, or completed' });
    return;
  }

  // Verify product belongs to user's org
  const neo4jSession = getDriver().session();
  try {
    const check = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId}) RETURN p`,
      { orgId, productId }
    );
    if (check.records.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Build dynamic update
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (content !== undefined) {
      updates.push(`content = $${paramIndex}`);
      params.push(JSON.stringify(content));
      paramIndex++;
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex}`);
      params.push(notes);
      paramIndex++;
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    updates.push(`updated_by = $${paramIndex}`);
    params.push(userEmail);
    paramIndex++;

    updates.push(`updated_at = NOW()`);

    params.push(productId);
    params.push(sectionKey);

    const result = await pool.query(
      `UPDATE technical_file_sections
       SET ${updates.join(', ')}
       WHERE product_id = $${paramIndex} AND section_key = $${paramIndex + 1}
       RETURNING section_key, title, content, notes, status, cra_reference, updated_by, updated_at`,
      params
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Section not found' });
      return;
    }

    // Update Neo4j TechnicalFile node with new progress
    await updateTechFileNode(productId);

    const row = result.rows[0];

    // Record telemetry
    const reqData = extractRequestData(req);
    await recordEvent({
      userId,
      email: userEmail,
      eventType: 'technical_file_updated',
      ...reqData,
      metadata: { productId, sectionKey, status: status || row.status },
    });

    res.json({
      sectionKey: row.section_key,
      title: row.title,
      content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
      notes: row.notes,
      status: row.status,
      craReference: row.cra_reference,
      updatedBy: row.updated_by,
      updatedAt: row.updated_at,
    });
  } finally {
    await neo4jSession.close();
  }
});

// ─── EU Declaration of Conformity PDF helpers ────────────────

function formatCraCategory(cat: string | null): string {
  switch (cat) {
    case 'default': return 'Default';
    case 'important_i': return 'Important (Class I)';
    case 'important_ii': return 'Important (Class II)';
    case 'critical': return 'Critical';
    default: return cat || 'Unclassified';
  }
}

interface DocPdfData {
  productName: string;
  productCraCategory: string | null;
  orgName: string;
  orgCountry: string | null;
  docFields: Record<string, string>;
  standardsList: any[];
  isDraft: boolean;
  dateStr: string;
}

function generateDocPdf(data: DocPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60, size: 'A4' });
    const chunks: Buffer[] = [];
    const stream = new PassThrough();

    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    doc.pipe(stream);

    const pageWidth = doc.page.width - 120;
    const navy = '#003399';
    const bodyColour = '#111827';
    const mutedColour = '#6b7280';
    const draftColour = '#b45309';

    // EU-blue top and bottom border bars
    doc.rect(0, 0, doc.page.width, 10).fill(navy);
    doc.rect(0, doc.page.height - 10, doc.page.width, 10).fill(navy);

    // DRAFT watermark
    if (data.isDraft) {
      doc.save();
      doc.opacity(0.07);
      doc.fontSize(100).fillColor('#9ca3af').text('DRAFT', 60, 250, { align: 'center', width: pageWidth, lineBreak: false });
      doc.restore();
    }

    // Footer
    function addFooter() {
      const bottom = doc.page.height - 28;
      doc.save();
      doc.fontSize(8).fillColor(mutedColour);
      doc.text(
        `EU Declaration of Conformity — generated by CRANIS2 — ${new Date().toLocaleDateString('en-GB')}`,
        60, bottom, { width: pageWidth, align: 'center', lineBreak: false }
      );
      doc.restore();
    }

    // ── Header ──
    doc.y = 28;
    doc.fontSize(8).fillColor(mutedColour).font('Helvetica')
      .text('REGULATION (EU) 2024/2847 — CYBER RESILIENCE ACT', 60, doc.y, { align: 'center', width: pageWidth });
    doc.moveDown(0.4);
    doc.fontSize(18).fillColor(navy).font('Helvetica-Bold')
      .text('EU DECLARATION OF CONFORMITY', 60, doc.y, { align: 'center', width: pageWidth });
    doc.font('Helvetica');
    doc.moveDown(0.3);

    if (data.isDraft) {
      doc.fontSize(10).fillColor(draftColour)
        .text('[ DRAFT — Not yet finalised ]', 60, doc.y, { align: 'center', width: pageWidth });
      doc.moveDown(0.2);
    }

    if (data.docFields.certificate_reference) {
      doc.fontSize(9).fillColor(mutedColour)
        .text(`No. ${data.docFields.certificate_reference}`, 60, doc.y, { align: 'center', width: pageWidth });
      doc.moveDown(0.2);
    }

    doc.moveDown(0.5);
    doc.moveTo(60, doc.y).lineTo(60 + pageWidth, doc.y).strokeColor(navy).lineWidth(1.5).stroke();
    doc.moveDown(0.8);

    // ── Numbered clauses ──
    function clause(num: string, heading: string, body: string) {
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor(navy).font('Helvetica-Bold')
        .text(`${num}.  ${heading}`, 60, doc.y, { lineGap: 2, width: pageWidth });
      doc.font('Helvetica').fontSize(10).fillColor(bodyColour)
        .text(body, 80, doc.y, { lineGap: 3, width: pageWidth - 20 });
    }

    clause('1', 'Product name and type', data.productName);

    const mfgLine = `${data.orgName}${data.orgCountry ? ', ' + data.orgCountry : ''}`;
    clause('2', 'Manufacturer name and address', mfgLine);

    clause('3', 'Responsibility',
      'This declaration of conformity is issued under the sole responsibility of the manufacturer.');

    clause('4', 'Object of the declaration',
      `${data.productName} (CRA Category: ${formatCraCategory(data.productCraCategory)})`);

    clause('5', 'Legislative basis',
      'The object of the declaration described above is in conformity with the relevant Union harmonisation legislation:\n\n' +
      'Regulation (EU) 2024/2847 of the European Parliament and of the Council of 23 October 2024 ' +
      'on horizontal cybersecurity requirements for products with digital elements (Cyber Resilience Act) ' +
      'and its national implementing measures.');

    const standardsText = data.standardsList.length > 0
      ? data.standardsList.map((s: any) => {
          const name = typeof s === 'string' ? s : (s.name || s.reference || s.id || JSON.stringify(s));
          return `\u2022 ${name}`;
        }).join('\n')
      : 'No harmonised standards specified. See Technical File, Section 5 for the full standards assessment.';
    clause('6', 'Harmonised standards and technical specifications', standardsText);

    if (data.docFields.notified_body) {
      const nbText = data.docFields.notified_body +
        (data.docFields.certificate_reference ? `\nCertificate reference: ${data.docFields.certificate_reference}` : '');
      clause('7', 'Notified body (where applicable)', nbText);
    }

    if (data.docFields.declaration_text) {
      clause('8', 'Additional information', data.docFields.declaration_text);
    }

    if (data.docFields.assessment_module) {
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor(navy).font('Helvetica-Bold')
        .text('Conformity assessment procedure:', 60, doc.y, { width: pageWidth });
      doc.font('Helvetica').fillColor(bodyColour)
        .text(`Module ${data.docFields.assessment_module}`, 80, doc.y, { width: pageWidth - 20 });
    }

    // ── Signature block ──
    doc.moveDown(1.5);
    doc.moveTo(60, doc.y).lineTo(60 + pageWidth, doc.y).strokeColor('#d1d5db').lineWidth(0.5).stroke();
    doc.moveDown(0.8);

    doc.fontSize(10).fillColor(navy).font('Helvetica-Bold').text('Signed for and on behalf of:', 60, doc.y, { width: pageWidth });
    doc.font('Helvetica').fillColor(bodyColour).text(data.orgName, 80, doc.y, { width: pageWidth - 20 });
    if (data.orgCountry) doc.text(data.orgCountry, 80, doc.y, { width: pageWidth - 20 });

    doc.moveDown(0.6);
    doc.fontSize(10).fillColor(navy).font('Helvetica-Bold').text('Place and date of issue:', 60, doc.y, { width: pageWidth });
    doc.font('Helvetica').fillColor(bodyColour)
      .text(data.dateStr + (data.orgCountry ? `, ${data.orgCountry}` : ''), 80, doc.y, { width: pageWidth - 20 });

    doc.moveDown(1.5);
    doc.moveTo(60, doc.y).lineTo(260, doc.y).strokeColor(bodyColour).lineWidth(0.5).stroke();
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor(mutedColour).text('Authorised signatory', 60, doc.y);

    addFooter();
    doc.end();
  });
}

// ─── GET /api/technical-file/:productId/declaration-of-conformity/pdf ──
router.get('/:productId/declaration-of-conformity/pdf', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const orgId = await getUserOrgId(userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const productId = req.params.productId as string;

  // Verify product belongs to org and fetch product + org data
  const neo4jSession = getDriver().session();
  let productName: string;
  let productCraCategory: string | null;
  let orgName: string;
  let orgCountry: string | null;

  try {
    const result = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p.name AS name, p.craCategory AS craCategory,
              o.name AS orgName, o.country AS orgCountry`,
      { orgId, productId }
    );
    if (result.records.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const rec = result.records[0];
    productName = rec.get('name') || productId;
    productCraCategory = rec.get('craCategory') || null;
    orgName = rec.get('orgName') || 'Unknown Organisation';
    orgCountry = rec.get('orgCountry') || null;
  } finally {
    await neo4jSession.close();
  }

  // Fetch DoC section and standards (auto-create sections if needed)
  await ensureSections(productId);

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
    const content = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
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
    ? new Date(ceDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const safeName = productName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const filename = `eu-declaration-of-conformity-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`;

  try {
    const pdf = await generateDocPdf({ productName, productCraCategory, orgName, orgCountry, docFields, standardsList, isDraft, dateStr });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  } catch (err) {
    console.error('Failed to generate EU DoC PDF:', err);
    res.status(500).json({ error: 'Failed to generate EU Declaration of Conformity' });
  }
});

// ─── GET /api/technical-file/:productId/suggestions ──────────
// Returns pre-filled content suggestions derived from platform data for 4 sections:
// product_description, vulnerability_handling, standards_applied, test_reports
router.get('/:productId/suggestions', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const orgId = await getUserOrgId(userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const productId = req.params.productId as string;

  // Verify product belongs to org and fetch product metadata
  const neo4jSession = getDriver().session();
  let productName: string;
  let productVersion: string | null;
  let productCraCategory: string | null;
  let repoUrl: string | null;

  try {
    const result = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p.name AS name, p.version AS version, p.craCategory AS craCategory, p.repoUrl AS repoUrl`,
      { orgId, productId }
    );
    if (result.records.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const rec = result.records[0];
    productName = rec.get('name') || productId;
    productVersion = rec.get('version') || null;
    productCraCategory = rec.get('craCategory') || null;
    repoUrl = rec.get('repoUrl') || null;
  } finally {
    await neo4jSession.close();
  }

  // Fetch platform data from Postgres in parallel
  const [sbomResult, scanCountResult, findingsResult] = await Promise.all([
    pool.query(
      `SELECT package_count, is_stale FROM product_sboms WHERE product_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [productId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS scan_count, MAX(completed_at) AS last_scan_date
       FROM vulnerability_scans WHERE product_id = $1 AND status = 'completed'`,
      [productId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS open_count FROM vulnerability_findings
       WHERE product_id = $1 AND org_id = $2 AND status IN ('open', 'acknowledged')`,
      [productId, orgId]
    ),
  ]);

  const sbom = sbomResult.rows[0] || null;
  const scanCount = scanCountResult.rows[0]?.scan_count || 0;
  const lastScanDate = scanCountResult.rows[0]?.last_scan_date || null;
  const openFindings = findingsResult.rows[0]?.open_count || 0;

  // ── 1. Product Description ──
  const craLabel = formatCraCategory(productCraCategory);
  const versionText = productVersion ? `v${productVersion}` : '[version not set — add via product settings]';
  const purposeText =
    `${productName} is a software product placed on the EU market. ` +
    `It is classified under the Cyber Resilience Act as a ${craLabel} product. ` +
    (repoUrl ? `The source code is hosted at ${repoUrl}. ` : '') +
    `Describe the intended purpose here: who uses this product, what problem it solves, and any relevant operational or deployment context.`;

  const versionNote =
    `${versionText} — This is the version (or range of versions) subject to CRA conformity assessment. ` +
    `List all software versions currently available on the market that are within the scope of this declaration.`;

  const availabilityText = repoUrl
    ? `${productName} is made available via its public repository at ${repoUrl}. ` +
      `Releases are distributed as source code and/or binary artefacts via the repository's release mechanism.`
    : `${productName} is distributed as software. ` +
      `Describe here how the product is made available to users (e.g. download page, app store, package repository, SaaS service).`;

  const productDescriptionSuggestion = {
    fields: {
      intended_purpose: purposeText,
      versions_affecting_compliance: versionNote,
      market_availability: availabilityText,
    },
  };

  // ── 2. Vulnerability Handling ──
  const sbomRef = sbom
    ? `An SBOM is maintained for ${productName} containing ${sbom.package_count} component(s). ` +
      `It is auto-generated from the source repository and accessible from the Dependencies tab in CRANIS2. ` +
      (sbom.is_stale
        ? 'Note: the SBOM is currently marked as stale and should be regenerated before publication.'
        : 'The SBOM is current and up to date.')
    : `An SBOM for ${productName} has not yet been generated. ` +
      `Connect the product repository in CRANIS2 to enable automatic SBOM generation per CRA Art. 13(11).`;

  const updateMechanism = scanCount > 0
    ? `${productName} undergoes automated vulnerability scanning via CRANIS2 using the OSV.dev database. ` +
      `${scanCount} completed scan${scanCount === 1 ? '' : 's'} on record. ` +
      (lastScanDate
        ? `Most recent scan: ${new Date(lastScanDate).toLocaleDateString('en-GB')}. `
        : '') +
      `Security updates are distributed via [describe your distribution mechanism, e.g. package manager update, auto-update push, release notification]. ` +
      `Current open/acknowledged findings: ${openFindings}.`
    : `Describe the mechanism used to distribute security updates to users of ${productName}. ` +
      `Include how users are notified of available updates and how updates are applied. ` +
      `To generate scan evidence, run a vulnerability scan from the Risk Findings tab.`;

  const vulnHandlingSuggestion = {
    fields: {
      update_distribution_mechanism: updateMechanism,
      sbom_reference: sbomRef,
    },
  };

  // ── 3. Standards Applied ──
  const standards: { name: string; reference: string; scope: string }[] = [
    {
      name: 'ETSI EN 303 645 V2.1.1 — Cyber Security for Consumer Internet of Things: Baseline Requirements',
      reference: 'ETSI EN 303 645:2021',
      scope: 'Applied where product functionality intersects with internet-connected device requirements.',
    },
    {
      name: 'EN 18031-1:2024 — Common security requirements for internet-connected radio equipment (general)',
      reference: 'EN 18031-1:2024',
      scope: 'Baseline CRA internet security requirements for connected software products.',
    },
  ];

  if (['important_i', 'important_ii', 'critical'].includes(productCraCategory || '')) {
    standards.push({
      name: 'EN 18031-2:2024 — Security requirements for equipment processing virtual currency or personal data',
      reference: 'EN 18031-2:2024',
      scope: `Applies as product is classified ${craLabel} (Important Class I or higher).`,
    });
  }
  if (['important_ii', 'critical'].includes(productCraCategory || '')) {
    standards.push({
      name: 'EN 18031-3:2024 — Security requirements for industrial/professional internet-connected equipment',
      reference: 'EN 18031-3:2024',
      scope: `Applies as product is classified ${craLabel} (Important Class II or higher).`,
    });
  }
  if (productCraCategory === 'critical') {
    standards.push({
      name: 'ISO/IEC 15408 — Common Criteria for Information Technology Security Evaluation',
      reference: 'ISO/IEC 15408',
      scope: 'Common Criteria evaluation applicable to critical products requiring third-party conformity assessment.',
    });
  }

  const standardsSuggestion = { standards };

  // ── 4. Test Reports ──
  const reports: { type: string; date: string; tool: string; summary: string }[] = [];

  if (scanCount > 0) {
    const scansResult = await pool.query(
      `SELECT id, completed_at, findings_count FROM vulnerability_scans
       WHERE product_id = $1 AND status = 'completed'
       ORDER BY completed_at DESC LIMIT 5`,
      [productId]
    );
    for (const scan of scansResult.rows) {
      const dateStr = scan.completed_at
        ? new Date(scan.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'Unknown date';
      reports.push({
        type: 'Automated Vulnerability Scan',
        date: dateStr,
        tool: 'CRANIS2 Vulnerability Scanner (OSV.dev database)',
        summary:
          `Automated vulnerability scan completed ${dateStr}. ` +
          (scan.findings_count != null ? `${scan.findings_count} total finding(s) identified. ` : '') +
          `Evidence retained in CRANIS2 platform (scan ID: ${scan.id}).`,
      });
    }
  }

  if (reports.length === 0) {
    reports.push({
      type: 'Automated Vulnerability Scan',
      date: '[Date to be completed]',
      tool: 'CRANIS2 Vulnerability Scanner (OSV.dev database)',
      summary:
        'No completed vulnerability scans recorded yet. ' +
        'Run a scan from the Risk Findings tab to generate evidence for this section.',
    });
  }

  const testReportsSuggestion = { reports };

  res.json({
    sections: {
      product_description: productDescriptionSuggestion,
      vulnerability_handling: vulnHandlingSuggestion,
      standards_applied: standardsSuggestion,
      test_reports: testReportsSuggestion,
    },
  });
});

// ─── GET /api/technical-file/:productId/progress ─────────────
// Lightweight progress endpoint for overview tab
router.get('/:productId/progress', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const orgId = await getUserOrgId(userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const productId = req.params.productId as string;

  const result = await pool.query(
    `SELECT status, COUNT(*)::int as count
     FROM technical_file_sections
     WHERE product_id = $1
     GROUP BY status`,
    [productId]
  );

  const counts: Record<string, number> = { not_started: 0, in_progress: 0, completed: 0 };
  for (const row of result.rows) {
    counts[row.status] = row.count;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  let overallStatus: string = 'not_started';
  if (counts.completed === total && total > 0) overallStatus = 'completed';
  else if (counts.completed > 0 || counts.in_progress > 0) overallStatus = 'in_progress';

  res.json({
    total,
    ...counts,
    overallStatus,
  });
});

export default router;

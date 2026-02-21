import { Router, Request, Response } from 'express';
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
       WHERE product_id = $${paramIndex - 1} AND section_key = $${paramIndex}
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

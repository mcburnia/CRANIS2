import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';

const router = Router();

/* ── Auth middleware (per-route-file pattern) ──────────────── */
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

async function getOrgId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.org_id || null;
}

/* ── EU27 Member State codes ─────────────────────────────── */
const EU_MEMBER_STATES = [
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR',
  'DE','GR','HU','IE','IT','LV','LT','LU','MT','NL',
  'PL','PT','RO','SK','SI','ES','SE',
];

/* ── Deadline calculation ─────────────────────────────────── */
function calculateDeadlines(awarenessAt: Date, reportType: 'vulnerability' | 'incident') {
  const earlyWarning = new Date(awarenessAt.getTime() + 24 * 60 * 60 * 1000);
  const notification = new Date(awarenessAt.getTime() + 72 * 60 * 60 * 1000);

  let finalReport: Date;
  if (reportType === 'vulnerability') {
    // 14 days after awareness (actual deadline is 14 days after corrective measure,
    // but we use awareness + 14d as a planning deadline — can be adjusted later)
    finalReport = new Date(awarenessAt.getTime() + 14 * 24 * 60 * 60 * 1000);
  } else {
    // 1 month for incidents
    finalReport = new Date(awarenessAt);
    finalReport.setMonth(finalReport.getMonth() + 1);
  }

  return { earlyWarning, notification, finalReport };
}

/* ── GET /api/cra-reports/overview — Dashboard summary ───── */
router.get('/overview', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const result = await pool.query(
      `SELECT
         count(*) FILTER (WHERE status != 'closed') AS active_reports,
         count(*) FILTER (WHERE status = 'draft') AS draft_count,
         count(*) FILTER (WHERE status = 'early_warning_sent') AS early_warning_count,
         count(*) FILTER (WHERE status = 'notification_sent') AS notification_count,
         count(*) FILTER (WHERE status = 'final_report_sent') AS final_report_count,
         count(*) FILTER (WHERE status = 'closed') AS closed_count,
         count(*) FILTER (WHERE report_type = 'vulnerability') AS vulnerability_count,
         count(*) FILTER (WHERE report_type = 'incident') AS incident_count,
         count(*) FILTER (
           WHERE status NOT IN ('closed', 'final_report_sent')
             AND (
               (status = 'draft' AND early_warning_deadline < NOW())
               OR (status = 'early_warning_sent' AND notification_deadline < NOW())
               OR (status = 'notification_sent' AND final_report_deadline < NOW())
             )
         ) AS overdue_count
       FROM cra_reports WHERE org_id = $1`,
      [orgId]
    );

    // Next upcoming deadline
    const nextDeadline = await pool.query(
      `SELECT id, product_id, report_type, status,
              CASE
                WHEN status = 'draft' THEN early_warning_deadline
                WHEN status = 'early_warning_sent' THEN notification_deadline
                WHEN status = 'notification_sent' THEN final_report_deadline
              END AS next_deadline
       FROM cra_reports
       WHERE org_id = $1 AND status NOT IN ('closed', 'final_report_sent')
       ORDER BY next_deadline ASC NULLS LAST
       LIMIT 1`,
      [orgId]
    );

    // Reports created this month
    const thisMonth = await pool.query(
      `SELECT count(*) AS cnt FROM cra_reports
       WHERE org_id = $1 AND created_at >= date_trunc('month', NOW())`,
      [orgId]
    );

    const row = result.rows[0];
    res.json({
      activeReports: parseInt(row.active_reports) || 0,
      draftCount: parseInt(row.draft_count) || 0,
      earlyWarningCount: parseInt(row.early_warning_count) || 0,
      notificationCount: parseInt(row.notification_count) || 0,
      finalReportCount: parseInt(row.final_report_count) || 0,
      closedCount: parseInt(row.closed_count) || 0,
      vulnerabilityCount: parseInt(row.vulnerability_count) || 0,
      incidentCount: parseInt(row.incident_count) || 0,
      overdueCount: parseInt(row.overdue_count) || 0,
      reportsThisMonth: parseInt(thisMonth.rows[0]?.cnt) || 0,
      nextDeadline: nextDeadline.rows[0] || null,
    });
  } catch (err) {
    console.error('Failed to fetch CRA reports overview:', err);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

/* ── GET /api/cra-reports — List reports ─────────────────── */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const { status, product_id, report_type } = req.query;
    let query = `
      SELECT r.*,
        u.email AS created_by_email,
        (SELECT count(*) FROM cra_report_stages WHERE report_id = r.id) AS stage_count
      FROM cra_reports r
      LEFT JOIN users u ON r.created_by = u.id
      WHERE r.org_id = $1
    `;
    const params: any[] = [orgId];
    let idx = 2;

    if (status) { query += ` AND r.status = $${idx}`; params.push(status); idx++; }
    if (product_id) { query += ` AND r.product_id = $${idx}`; params.push(product_id); idx++; }
    if (report_type) { query += ` AND r.report_type = $${idx}`; params.push(report_type); idx++; }

    query += ' ORDER BY r.updated_at DESC';

    const result = await pool.query(query, params);

    // Enrich with product names from Neo4j
    const productIds = [...new Set(result.rows.map((r: any) => r.product_id))];
    const productNames: Record<string, string> = {};

    if (productIds.length > 0) {
      const driver = getDriver();
      const session = driver.session();
      try {
        const neo = await session.run(
          'UNWIND $ids AS pid MATCH (p:Product {id: pid}) RETURN p.id AS id, p.name AS name',
          { ids: productIds }
        );
        for (const rec of neo.records) {
          productNames[rec.get('id')] = rec.get('name');
        }
      } finally {
        await session.close();
      }
    }

    const reports = result.rows.map((r: any) => ({
      id: r.id,
      orgId: r.org_id,
      productId: r.product_id,
      productName: productNames[r.product_id] || 'Unknown Product',
      reportType: r.report_type,
      status: r.status,
      awarenessAt: r.awareness_at,
      earlyWarningDeadline: r.early_warning_deadline,
      notificationDeadline: r.notification_deadline,
      finalReportDeadline: r.final_report_deadline,
      csirtCountry: r.csirt_country,
      memberStatesAffected: r.member_states_affected || [],
      linkedFindingId: r.linked_finding_id,
      enisaReference: r.enisa_reference,
      sensitivityTlp: r.sensitivity_tlp,
      createdBy: r.created_by,
      createdByEmail: r.created_by_email,
      stageCount: parseInt(r.stage_count) || 0,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    res.json({ reports });
  } catch (err) {
    console.error('Failed to list CRA reports:', err);
    res.status(500).json({ error: 'Failed to list reports' });
  }
});

/* ── POST /api/cra-reports — Create report ───────────────── */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const email = (req as any).email;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const {
      productId,
      reportType = 'vulnerability',
      awarenessAt,
      csirtCountry,
      memberStatesAffected = [],
      linkedFindingId,
      sensitivityTlp = 'AMBER',
    } = req.body;

    if (!productId) { res.status(400).json({ error: 'productId is required' }); return; }
    if (!['vulnerability', 'incident'].includes(reportType)) {
      res.status(400).json({ error: 'reportType must be vulnerability or incident' }); return;
    }

    // Verify product belongs to org
    const driver = getDriver();
    const session = driver.session();
    try {
      const check = await session.run(
        'MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId}) RETURN p.id',
        { orgId, productId }
      );
      if (check.records.length === 0) {
        res.status(404).json({ error: 'Product not found in your organisation' }); return;
      }
    } finally {
      await session.close();
    }

    // Calculate deadlines if awareness time is provided
    const awareness = awarenessAt ? new Date(awarenessAt) : null;
    let deadlines = { earlyWarning: null as Date | null, notification: null as Date | null, finalReport: null as Date | null };
    if (awareness) {
      deadlines = calculateDeadlines(awareness, reportType);
    }

    // If linked to a finding, validate it exists
    if (linkedFindingId) {
      const findingCheck = await pool.query(
        'SELECT id FROM vulnerability_findings WHERE id = $1 AND org_id = $2',
        [linkedFindingId, orgId]
      );
      if (findingCheck.rows.length === 0) {
        res.status(404).json({ error: 'Linked finding not found' }); return;
      }
    }

    const result = await pool.query(
      `INSERT INTO cra_reports (
        org_id, product_id, report_type, status, awareness_at,
        early_warning_deadline, notification_deadline, final_report_deadline,
        csirt_country, member_states_affected, linked_finding_id,
        sensitivity_tlp, created_by
      ) VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        orgId, productId, reportType, awareness,
        deadlines.earlyWarning, deadlines.notification, deadlines.finalReport,
        csirtCountry || null,
        memberStatesAffected.length > 0 ? memberStatesAffected : null,
        linkedFindingId || null,
        sensitivityTlp, userId,
      ]
    );

    const report = result.rows[0];

    // Record telemetry
    const reqData = extractRequestData(req);
    await recordEvent({
      userId, email,
      eventType: 'cra_report_created',
      ...reqData,
      metadata: { reportId: report.id, reportType, productId, linkedFindingId: linkedFindingId || null },
    });

    res.status(201).json({ report });
  } catch (err) {
    console.error('Failed to create CRA report:', err);
    res.status(500).json({ error: 'Failed to create report' });
  }
});

/* ── GET /api/cra-reports/eu-countries — EU Member States ── */
router.get('/eu-countries', requireAuth, async (_req: Request, res: Response) => {
  const countries: Record<string, string> = {
    AT: 'Austria', BE: 'Belgium', BG: 'Bulgaria', HR: 'Croatia',
    CY: 'Cyprus', CZ: 'Czechia', DK: 'Denmark', EE: 'Estonia',
    FI: 'Finland', FR: 'France', DE: 'Germany', GR: 'Greece',
    HU: 'Hungary', IE: 'Ireland', IT: 'Italy', LV: 'Latvia',
    LT: 'Lithuania', LU: 'Luxembourg', MT: 'Malta', NL: 'Netherlands',
    PL: 'Poland', PT: 'Portugal', RO: 'Romania', SK: 'Slovakia',
    SI: 'Slovenia', ES: 'Spain', SE: 'Sweden',
  };
  res.json({ countries });
});

/* ── GET /api/cra-reports/:id — Report detail ────────────── */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const reportId = req.params.id as string;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const result = await pool.query(
      `SELECT r.*, u.email AS created_by_email
       FROM cra_reports r
       LEFT JOIN users u ON r.created_by = u.id
       WHERE r.id = $1 AND r.org_id = $2`,
      [reportId, orgId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Report not found' }); return;
    }

    const r = result.rows[0];

    // Get product name from Neo4j
    let productName = 'Unknown Product';
    const driver = getDriver();
    const session = driver.session();
    try {
      const neo = await session.run(
        'MATCH (p:Product {id: $productId}) RETURN p.name AS name',
        { productId: r.product_id }
      );
      if (neo.records.length > 0) productName = neo.records[0].get('name');
    } finally {
      await session.close();
    }

    // Get all stages
    const stages = await pool.query(
      `SELECT s.*, u.email AS submitted_by_email
       FROM cra_report_stages s
       LEFT JOIN users u ON s.submitted_by = u.id
       WHERE s.report_id = $1
       ORDER BY s.submitted_at ASC`,
      [reportId]
    );

    // Get linked finding details if applicable
    let linkedFinding = null;
    if (r.linked_finding_id) {
      const f = await pool.query(
        'SELECT id, title, severity, cvss_score, source, source_id, dependency_name, dependency_version, fixed_version, description FROM vulnerability_findings WHERE id = $1',
        [r.linked_finding_id]
      );
      if (f.rows.length > 0) linkedFinding = f.rows[0];
    }

    res.json({
      report: {
        id: r.id,
        orgId: r.org_id,
        productId: r.product_id,
        productName,
        reportType: r.report_type,
        status: r.status,
        awarenessAt: r.awareness_at,
        earlyWarningDeadline: r.early_warning_deadline,
        notificationDeadline: r.notification_deadline,
        finalReportDeadline: r.final_report_deadline,
        csirtCountry: r.csirt_country,
        memberStatesAffected: r.member_states_affected || [],
        linkedFindingId: r.linked_finding_id,
        enisaReference: r.enisa_reference,
        sensitivityTlp: r.sensitivity_tlp,
        createdBy: r.created_by,
        createdByEmail: r.created_by_email,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      },
      stages: stages.rows.map((s: any) => ({
        id: s.id,
        stage: s.stage,
        content: s.content,
        submittedBy: s.submitted_by,
        submittedByEmail: s.submitted_by_email,
        submittedAt: s.submitted_at,
      })),
      linkedFinding,
    });
  } catch (err) {
    console.error('Failed to get CRA report:', err);
    res.status(500).json({ error: 'Failed to get report' });
  }
});

/* ── PUT /api/cra-reports/:id — Update report draft ──────── */
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const reportId = req.params.id as string;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    // Build dynamic update
    const allowedFields: Record<string, string> = {
      awarenessAt: 'awareness_at',
      csirtCountry: 'csirt_country',
      memberStatesAffected: 'member_states_affected',
      sensitivityTlp: 'sensitivity_tlp',
      reportType: 'report_type',
    };

    const sets: string[] = ['updated_at = NOW()'];
    const params: any[] = [reportId, orgId];
    let idx = 3;

    for (const [bodyKey, dbCol] of Object.entries(allowedFields)) {
      if (req.body[bodyKey] !== undefined) {
        sets.push(`${dbCol} = $${idx}`);
        params.push(req.body[bodyKey]);
        idx++;
      }
    }

    // Recalculate deadlines if awareness or type changed
    if (req.body.awarenessAt || req.body.reportType) {
      // Need current values to merge
      const current = await pool.query(
        'SELECT awareness_at, report_type FROM cra_reports WHERE id = $1 AND org_id = $2',
        [reportId, orgId]
      );
      if (current.rows.length === 0) { res.status(404).json({ error: 'Report not found' }); return; }

      const awareness = req.body.awarenessAt ? new Date(req.body.awarenessAt) : current.rows[0].awareness_at;
      const type = req.body.reportType || current.rows[0].report_type;

      if (awareness) {
        const deadlines = calculateDeadlines(awareness, type);
        sets.push(`early_warning_deadline = $${idx}`); params.push(deadlines.earlyWarning); idx++;
        sets.push(`notification_deadline = $${idx}`); params.push(deadlines.notification); idx++;
        sets.push(`final_report_deadline = $${idx}`); params.push(deadlines.finalReport); idx++;
      }
    }

    const result = await pool.query(
      `UPDATE cra_reports SET ${sets.join(', ')} WHERE id = $1 AND org_id = $2 RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Report not found' }); return;
    }

    res.json({ report: result.rows[0] });
  } catch (err) {
    console.error('Failed to update CRA report:', err);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

/* ── POST /api/cra-reports/:id/stages — Submit a stage ───── */
router.post('/:id/stages', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const email = (req as any).email;
  const reportId = req.params.id as string;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const { stage, content } = req.body;

    if (!stage || !['early_warning', 'notification', 'final_report', 'intermediate'].includes(stage)) {
      res.status(400).json({ error: 'stage must be: early_warning, notification, final_report, or intermediate' }); return;
    }
    if (!content || typeof content !== 'object') {
      res.status(400).json({ error: 'content must be a JSON object' }); return;
    }

    // Verify report exists and belongs to org
    const report = await pool.query(
      'SELECT id, status, report_type FROM cra_reports WHERE id = $1 AND org_id = $2',
      [reportId, orgId]
    );
    if (report.rows.length === 0) {
      res.status(404).json({ error: 'Report not found' }); return;
    }

    // Validate stage progression (allow intermediate at any time)
    const currentStatus = report.rows[0].status;
    const validTransitions: Record<string, string[]> = {
      draft: ['early_warning', 'intermediate'],
      early_warning_sent: ['notification', 'intermediate'],
      notification_sent: ['final_report', 'intermediate'],
      final_report_sent: ['intermediate'], // Can still add intermediates after final
    };

    if (stage !== 'intermediate' && !(validTransitions[currentStatus] || []).includes(stage)) {
      res.status(400).json({
        error: `Cannot submit ${stage} when report status is ${currentStatus}`,
        currentStatus,
        allowedStages: validTransitions[currentStatus] || [],
      });
      return;
    }

    // Insert stage
    const stageResult = await pool.query(
      `INSERT INTO cra_report_stages (report_id, stage, content, submitted_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [reportId, stage, JSON.stringify(content), userId]
    );

    // Update report status (unless intermediate)
    let newStatus = currentStatus;
    if (stage === 'early_warning') newStatus = 'early_warning_sent';
    else if (stage === 'notification') newStatus = 'notification_sent';
    else if (stage === 'final_report') newStatus = 'final_report_sent';

    if (newStatus !== currentStatus) {
      await pool.query(
        'UPDATE cra_reports SET status = $1, updated_at = NOW() WHERE id = $2',
        [newStatus, reportId]
      );
    }

    // Record telemetry
    const reqData = extractRequestData(req);
    await recordEvent({
      userId, email,
      eventType: 'cra_report_stage_submitted',
      ...reqData,
      metadata: { reportId, stage, newStatus },
    });

    res.status(201).json({
      stage: stageResult.rows[0],
      reportStatus: newStatus,
    });
  } catch (err) {
    console.error('Failed to submit CRA report stage:', err);
    res.status(500).json({ error: 'Failed to submit stage' });
  }
});

/* ── POST /api/cra-reports/:id/close — Close a report ────── */
router.post('/:id/close', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const email = (req as any).email;
  const reportId = req.params.id as string;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const result = await pool.query(
      `UPDATE cra_reports SET status = 'closed', updated_at = NOW()
       WHERE id = $1 AND org_id = $2 RETURNING *`,
      [reportId, orgId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Report not found' }); return;
    }

    const reqData = extractRequestData(req);
    await recordEvent({
      userId, email,
      eventType: 'cra_report_closed',
      ...reqData,
      metadata: { reportId },
    });

    res.json({ report: result.rows[0] });
  } catch (err) {
    console.error('Failed to close CRA report:', err);
    res.status(500).json({ error: 'Failed to close report' });
  }
});

/* ── DELETE /api/cra-reports/:id — Delete draft only ─────── */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const email = (req as any).email;
  const reportId = req.params.id as string;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    // Only allow deleting drafts
    const check = await pool.query(
      "SELECT id, status FROM cra_reports WHERE id = $1 AND org_id = $2",
      [reportId, orgId]
    );

    if (check.rows.length === 0) {
      res.status(404).json({ error: 'Report not found' }); return;
    }

    if (check.rows[0].status !== 'draft') {
      res.status(400).json({ error: 'Only draft reports can be deleted. Use close instead.' }); return;
    }

    // CASCADE deletes stages too
    await pool.query('DELETE FROM cra_reports WHERE id = $1', [reportId]);

    const reqData = extractRequestData(req);
    await recordEvent({
      userId, email,
      eventType: 'cra_report_deleted',
      ...reqData,
      metadata: { reportId },
    });

    res.json({ deleted: true });
  } catch (err) {
    console.error('Failed to delete CRA report:', err);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});


export default router;

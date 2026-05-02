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
 * Internal Incident Lifecycle — Route Handlers
 *
 * CRA Art. 14: Detection → Assessment → Containment → Remediation → Recovery → Review → Closed
 *
 * GET    /:productId/incidents              — list (filterable by phase, severity)
 * GET    /:productId/incidents/summary      — aggregated counts
 * GET    /:productId/incidents/:id          — detail with timeline
 * POST   /:productId/incidents              — create new incident
 * PUT    /:productId/incidents/:id          — update (phase transitions auto-log)
 * DELETE /:productId/incidents/:id          — delete (detection phase only)
 * POST   /:productId/incidents/:id/timeline — add timeline entry
 * POST   /:productId/incidents/:id/escalate — create linked CRA report
 *
 * Mount at: app.use('/api/products', incidentRoutes)
 */

import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';

const router = Router();

// ─── Constants ────────────────────────────────────────────────

const VALID_SEVERITIES = ['P1', 'P2', 'P3', 'P4'] as const;
type Severity = typeof VALID_SEVERITIES[number];

const VALID_PHASES = [
  'detection', 'assessment', 'containment',
  'remediation', 'recovery', 'review', 'closed',
] as const;
type Phase = typeof VALID_PHASES[number];

const PHASE_ORDER: Record<string, number> = {
  detection: 0, assessment: 1, containment: 2,
  remediation: 3, recovery: 4, review: 5, closed: 6,
};

const VALID_TIMELINE_TYPES = [
  'phase_change', 'note', 'escalation',
  'action_taken', 'evidence_attached',
] as const;

// ─── Auth middleware ──────────────────────────────────────────

async function requireAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) { res.status(401).json({ error: 'No token provided' }); return; }
  try {
    const payload = verifySessionToken(authHeader.split(' ')[1]);
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

async function verifyProductAccess(orgId: string, productId: string): Promise<boolean> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      'MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId}) RETURN p.id AS id',
      { orgId, productId }
    );
    return result.records.length > 0;
  } finally {
    await session.close();
  }
}

// ─── Helper: add timeline entry ───────────────────────────────

async function addTimelineEntry(
  incidentId: string, eventType: string,
  description: string, createdBy: string | null
) {
  await pool.query(
    `INSERT INTO incident_timeline (incident_id, event_type, description, created_by)
     VALUES ($1, $2, $3, $4)`,
    [incidentId, eventType, description, createdBy]
  );
}

// ─── GET /:productId/incidents ────────────────────────────────

router.get(
  '/:productId/incidents',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params as { productId: string };
      const orgId = await getUserOrgId((req as any).userId);
      if (!orgId) { res.status(400).json({ error: 'No organisation context' }); return; }
      if (!(await verifyProductAccess(orgId, productId))) { res.status(404).json({ error: 'Product not found' }); return; }

      const phase = req.query.phase as string | undefined;
      const severity = req.query.severity as string | undefined;

      let sql = 'SELECT * FROM incidents WHERE org_id = $1 AND product_id = $2';
      const params: any[] = [orgId, productId];
      let idx = 3;

      if (phase && VALID_PHASES.includes(phase as Phase)) {
        sql += ` AND phase = $${idx++}`;
        params.push(phase);
      }
      if (severity && VALID_SEVERITIES.includes(severity as Severity)) {
        sql += ` AND severity = $${idx++}`;
        params.push(severity);
      }

      sql += ' ORDER BY detected_at DESC';

      const result = await pool.query(sql, params);
      res.json({ incidents: result.rows, total: result.rows.length });
    } catch (err: any) {
      console.error('[INCIDENTS] List error:', err.message);
      res.status(500).json({ error: 'Failed to list incidents' });
    }
  }
);

// ─── GET /:productId/incidents/summary ────────────────────────

router.get(
  '/:productId/incidents/summary',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params as { productId: string };
      const orgId = await getUserOrgId((req as any).userId);
      if (!orgId) { res.status(400).json({ error: 'No organisation context' }); return; }
      if (!(await verifyProductAccess(orgId, productId))) { res.status(404).json({ error: 'Product not found' }); return; }

      const [byPhase, bySeverity, avgResolution] = await Promise.all([
        pool.query(
          `SELECT phase, COUNT(*) AS count FROM incidents
           WHERE org_id = $1 AND product_id = $2 GROUP BY phase ORDER BY phase`,
          [orgId, productId]
        ),
        pool.query(
          `SELECT severity, COUNT(*) AS count FROM incidents
           WHERE org_id = $1 AND product_id = $2 GROUP BY severity ORDER BY severity`,
          [orgId, productId]
        ),
        pool.query(
          `SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - detected_at)) / 3600)::numeric(10,1) AS avg_hours
           FROM incidents WHERE org_id = $1 AND product_id = $2 AND resolved_at IS NOT NULL`,
          [orgId, productId]
        ),
      ]);

      const total = byPhase.rows.reduce((sum: number, r: any) => sum + parseInt(r.count), 0);
      const active = byPhase.rows
        .filter((r: any) => r.phase !== 'closed' && r.phase !== 'review')
        .reduce((sum: number, r: any) => sum + parseInt(r.count), 0);

      res.json({
        total,
        active,
        byPhase: byPhase.rows.map(r => ({ phase: r.phase, count: parseInt(r.count) })),
        bySeverity: bySeverity.rows.map(r => ({ severity: r.severity, count: parseInt(r.count) })),
        avgResolutionHours: avgResolution.rows[0]?.avg_hours ? parseFloat(avgResolution.rows[0].avg_hours) : null,
      });
    } catch (err: any) {
      console.error('[INCIDENTS] Summary error:', err.message);
      res.status(500).json({ error: 'Failed to fetch incident summary' });
    }
  }
);

// ─── GET /:productId/incidents/:id ────────────────────────────

router.get(
  '/:productId/incidents/:id',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId, id } = req.params as { productId: string; id: string };
      const orgId = await getUserOrgId((req as any).userId);
      if (!orgId) { res.status(400).json({ error: 'No organisation context' }); return; }
      if (!(await verifyProductAccess(orgId, productId))) { res.status(404).json({ error: 'Product not found' }); return; }

      const result = await pool.query(
        'SELECT * FROM incidents WHERE id = $1 AND org_id = $2 AND product_id = $3',
        [id, orgId, productId]
      );
      if (result.rows.length === 0) { res.status(404).json({ error: 'Incident not found' }); return; }

      const timeline = await pool.query(
        'SELECT * FROM incident_timeline WHERE incident_id = $1 ORDER BY created_at ASC',
        [id]
      );

      res.json({
        incident: result.rows[0],
        timeline: timeline.rows,
      });
    } catch (err: any) {
      console.error('[INCIDENTS] Get error:', err.message);
      res.status(500).json({ error: 'Failed to fetch incident' });
    }
  }
);

// ─── POST /:productId/incidents ───────────────────────────────

router.post(
  '/:productId/incidents',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params as { productId: string };
      const orgId = await getUserOrgId((req as any).userId);
      if (!orgId) { res.status(400).json({ error: 'No organisation context' }); return; }
      if (!(await verifyProductAccess(orgId, productId))) { res.status(404).json({ error: 'Product not found' }); return; }

      const {
        title, description, severity, detected_at,
        incident_lead, linked_field_issue_id,
      } = req.body;

      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        res.status(400).json({ error: 'Title is required' }); return;
      }
      if (severity && !VALID_SEVERITIES.includes(severity as Severity)) {
        res.status(400).json({ error: `Severity must be one of: ${VALID_SEVERITIES.join(', ')}` }); return;
      }

      // Validate linked field issue if provided
      if (linked_field_issue_id) {
        const fiCheck = await pool.query(
          'SELECT id FROM field_issues WHERE id = $1 AND org_id = $2 AND product_id = $3',
          [linked_field_issue_id, orgId, productId]
        );
        if (fiCheck.rows.length === 0) {
          res.status(400).json({ error: 'Linked field issue not found' }); return;
        }
      }

      const result = await pool.query(
        `INSERT INTO incidents
         (org_id, product_id, title, description, severity, phase, detected_at,
          incident_lead, linked_field_issue_id, created_by)
         VALUES ($1, $2, $3, $4, $5, 'detection', $6, $7, $8, $9)
         RETURNING *`,
        [
          orgId, productId,
          title.trim(),
          description || null,
          severity || 'P3',
          detected_at || new Date().toISOString(),
          incident_lead || null,
          linked_field_issue_id || null,
          (req as any).email || null,
        ]
      );

      const incident = result.rows[0];

      // Auto-log creation to timeline
      await addTimelineEntry(
        incident.id, 'phase_change',
        `Incident created in detection phase (${incident.severity})`,
        (req as any).email
      );

      res.status(201).json({ incident });
    } catch (err: any) {
      console.error('[INCIDENTS] Create error:', err.message);
      res.status(500).json({ error: 'Failed to create incident' });
    }
  }
);

// ─── PUT /:productId/incidents/:id ────────────────────────────

router.put(
  '/:productId/incidents/:id',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId, id } = req.params as { productId: string; id: string };
      const orgId = await getUserOrgId((req as any).userId);
      if (!orgId) { res.status(400).json({ error: 'No organisation context' }); return; }
      if (!(await verifyProductAccess(orgId, productId))) { res.status(404).json({ error: 'Product not found' }); return; }

      const existing = await pool.query(
        'SELECT * FROM incidents WHERE id = $1 AND org_id = $2 AND product_id = $3',
        [id, orgId, productId]
      );
      if (existing.rows.length === 0) { res.status(404).json({ error: 'Incident not found' }); return; }

      const current = existing.rows[0];
      const {
        title, description, severity, phase, incident_lead,
        root_cause, lessons_learned, impact_summary,
      } = req.body;

      // Validate severity
      if (severity && !VALID_SEVERITIES.includes(severity as Severity)) {
        res.status(400).json({ error: `Severity must be one of: ${VALID_SEVERITIES.join(', ')}` }); return;
      }

      // Validate phase transition (must move forward or stay)
      if (phase && !VALID_PHASES.includes(phase as Phase)) {
        res.status(400).json({ error: `Phase must be one of: ${VALID_PHASES.join(', ')}` }); return;
      }
      if (phase && PHASE_ORDER[phase] < PHASE_ORDER[current.phase]) {
        res.status(400).json({ error: `Cannot move backwards from ${current.phase} to ${phase}` }); return;
      }

      // Build dynamic SET
      const setClauses: string[] = ['updated_at = NOW()'];
      const params: any[] = [];
      let idx = 1;

      const addField = (field: string, value: any) => {
        if (value !== undefined) {
          setClauses.push(`${field} = $${idx++}`);
          params.push(value);
        }
      };

      addField('title', title?.trim());
      addField('description', description);
      addField('severity', severity);
      addField('incident_lead', incident_lead);
      addField('root_cause', root_cause);
      addField('lessons_learned', lessons_learned);
      addField('impact_summary', impact_summary);

      // Phase transition with auto-timestamps
      if (phase && phase !== current.phase) {
        setClauses.push(`phase = $${idx++}`);
        params.push(phase);

        if (phase === 'containment' && !current.contained_at) {
          setClauses.push(`contained_at = NOW()`);
        }
        if ((phase === 'recovery' || phase === 'review' || phase === 'closed') && !current.resolved_at) {
          setClauses.push(`resolved_at = NOW()`);
        }
        if ((phase === 'review' || phase === 'closed') && current.phase !== 'review') {
          // Don't overwrite if already set
        }
        if (phase === 'closed' && !current.review_completed_at) {
          setClauses.push(`review_completed_at = NOW()`);
        }
      }

      params.push(id, orgId, productId);

      const result = await pool.query(
        `UPDATE incidents SET ${setClauses.join(', ')}
         WHERE id = $${idx} AND org_id = $${idx + 1} AND product_id = $${idx + 2}
         RETURNING *`,
        params
      );

      // Auto-log phase change to timeline
      if (phase && phase !== current.phase) {
        await addTimelineEntry(
          id, 'phase_change',
          `Phase changed from ${current.phase} to ${phase}`,
          (req as any).email
        );
      }

      res.json({ incident: result.rows[0] });
    } catch (err: any) {
      console.error('[INCIDENTS] Update error:', err.message);
      res.status(500).json({ error: 'Failed to update incident' });
    }
  }
);

// ─── DELETE /:productId/incidents/:id ─────────────────────────

router.delete(
  '/:productId/incidents/:id',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId, id } = req.params as { productId: string; id: string };
      const orgId = await getUserOrgId((req as any).userId);
      if (!orgId) { res.status(400).json({ error: 'No organisation context' }); return; }
      if (!(await verifyProductAccess(orgId, productId))) { res.status(404).json({ error: 'Product not found' }); return; }

      // Only allow deletion in detection phase
      const existing = await pool.query(
        'SELECT phase FROM incidents WHERE id = $1 AND org_id = $2 AND product_id = $3',
        [id, orgId, productId]
      );
      if (existing.rows.length === 0) { res.status(404).json({ error: 'Incident not found' }); return; }
      if (existing.rows[0].phase !== 'detection') {
        res.status(400).json({ error: 'Can only delete incidents in the detection phase' }); return;
      }

      await pool.query(
        'DELETE FROM incidents WHERE id = $1 AND org_id = $2 AND product_id = $3',
        [id, orgId, productId]
      );

      res.json({ deleted: true });
    } catch (err: any) {
      console.error('[INCIDENTS] Delete error:', err.message);
      res.status(500).json({ error: 'Failed to delete incident' });
    }
  }
);

// ─── POST /:productId/incidents/:id/timeline ──────────────────

router.post(
  '/:productId/incidents/:id/timeline',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId, id } = req.params as { productId: string; id: string };
      const orgId = await getUserOrgId((req as any).userId);
      if (!orgId) { res.status(400).json({ error: 'No organisation context' }); return; }
      if (!(await verifyProductAccess(orgId, productId))) { res.status(404).json({ error: 'Product not found' }); return; }

      // Verify incident exists
      const existing = await pool.query(
        'SELECT id FROM incidents WHERE id = $1 AND org_id = $2 AND product_id = $3',
        [id, orgId, productId]
      );
      if (existing.rows.length === 0) { res.status(404).json({ error: 'Incident not found' }); return; }

      const { event_type, description } = req.body;

      if (!description || typeof description !== 'string' || description.trim().length === 0) {
        res.status(400).json({ error: 'Description is required' }); return;
      }
      if (event_type && !VALID_TIMELINE_TYPES.includes(event_type as any)) {
        res.status(400).json({ error: `Event type must be one of: ${VALID_TIMELINE_TYPES.join(', ')}` }); return;
      }

      const result = await pool.query(
        `INSERT INTO incident_timeline (incident_id, event_type, description, created_by)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [id, event_type || 'note', description.trim(), (req as any).email || null]
      );

      res.status(201).json({ entry: result.rows[0] });
    } catch (err: any) {
      console.error('[INCIDENTS] Timeline error:', err.message);
      res.status(500).json({ error: 'Failed to add timeline entry' });
    }
  }
);

// ─── POST /:productId/incidents/:id/escalate ──────────────────

router.post(
  '/:productId/incidents/:id/escalate',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId, id } = req.params as { productId: string; id: string };
      const orgId = await getUserOrgId((req as any).userId);
      if (!orgId) { res.status(400).json({ error: 'No organisation context' }); return; }
      if (!(await verifyProductAccess(orgId, productId))) { res.status(404).json({ error: 'Product not found' }); return; }

      const existing = await pool.query(
        'SELECT * FROM incidents WHERE id = $1 AND org_id = $2 AND product_id = $3',
        [id, orgId, productId]
      );
      if (existing.rows.length === 0) { res.status(404).json({ error: 'Incident not found' }); return; }

      const incident = existing.rows[0];

      // Check if already escalated
      if (incident.linked_report_id) {
        res.status(409).json({ error: 'Incident already escalated to a CRA report', reportId: incident.linked_report_id }); return;
      }

      const { csirt_country, report_type } = req.body;

      // Create CRA report linked to this incident
      const now = new Date();
      const earlyWarningDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const notificationDeadline = new Date(now.getTime() + 72 * 60 * 60 * 1000);
      const finalReportDeadline = (report_type === 'incident')
        ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      const reportResult = await pool.query(
        `INSERT INTO cra_reports
         (org_id, product_id, report_type, status, awareness_at,
          early_warning_deadline, notification_deadline, final_report_deadline,
          csirt_country, created_by)
         VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          orgId, productId,
          report_type || 'incident',
          now.toISOString(),
          earlyWarningDeadline.toISOString(),
          notificationDeadline.toISOString(),
          finalReportDeadline.toISOString(),
          csirt_country || null,
          (req as any).userId || null,
        ]
      );

      const report = reportResult.rows[0];

      // Link the incident to the report
      await pool.query(
        'UPDATE incidents SET linked_report_id = $1, updated_at = NOW() WHERE id = $2',
        [report.id, id]
      );

      // Log escalation to timeline
      await addTimelineEntry(
        id, 'escalation',
        `Escalated to ENISA CRA report (${report.report_type}, CSIRT: ${csirt_country || 'not set'})`,
        (req as any).email
      );

      res.status(201).json({ report, incidentId: id });
    } catch (err: any) {
      console.error('[INCIDENTS] Escalate error:', err.message);
      res.status(500).json({ error: 'Failed to escalate incident' });
    }
  }
);

export default router;

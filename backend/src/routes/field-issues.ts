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
 * Field Issues Routes — post-market monitoring & field issue tracking.
 *
 * CRA Art. 13(2): procedures for keeping products in conformity.
 * CRA Art. 13(9): corrective action when a product is non-conforming.
 *
 * GET    /:productId/field-issues              – List field issues (filterable)
 * GET    /:productId/field-issues/summary       – Aggregated counts
 * GET    /:productId/field-issues/export        – Post-market surveillance report (Markdown)
 * GET    /:productId/field-issues/:issueId      – Single issue detail
 * POST   /:productId/field-issues               – Create a new field issue
 * PUT    /:productId/field-issues/:issueId      – Update a field issue
 * DELETE /:productId/field-issues/:issueId      – Delete a field issue
 *
 * Mount at: app.use('/api/products', fieldIssuesRoutes)
 */

import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';

const router = Router();

// ─── Allowed enum values ─────────────────────────────────────────────

const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
const VALID_SOURCES = [
  'customer_report', 'internal_testing', 'market_surveillance',
  'vulnerability_scan', 'security_researcher', 'other',
] as const;
const VALID_STATUSES = ['open', 'investigating', 'fix_in_progress', 'resolved', 'closed'] as const;

type Severity = typeof VALID_SEVERITIES[number];
type Source = typeof VALID_SOURCES[number];
type Status = typeof VALID_STATUSES[number];

// ─── Auth middleware ─────────────────────────────────────────────────

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

async function verifyProductAccess(orgId: string, productId: string): Promise<boolean> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId}) RETURN p.id AS id`,
      { orgId, productId }
    );
    return result.records.length > 0;
  } finally {
    await session.close();
  }
}

// ─── GET /:productId/field-issues ────────────────────────────────────

router.get(
  '/:productId/field-issues',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params as { productId: string };
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });
      if (!(await verifyProductAccess(orgId, productId))) return res.status(404).json({ error: 'Product not found' });

      const status = req.query.status as string | undefined;
      const severity = req.query.severity as string | undefined;
      const source = req.query.source as string | undefined;
      let sql = `SELECT fi.*, u.email AS reporter_email
                 FROM field_issues fi
                 LEFT JOIN users u ON fi.reported_by = u.id
                 WHERE fi.product_id = $1 AND fi.org_id = $2`;
      const params: any[] = [productId, orgId];
      let idx = 3;

      if (status && VALID_STATUSES.includes(status as Status)) {
        sql += ` AND fi.status = $${idx++}`;
        params.push(status);
      }
      if (severity && VALID_SEVERITIES.includes(severity as Severity)) {
        sql += ` AND fi.severity = $${idx++}`;
        params.push(severity);
      }
      if (source && VALID_SOURCES.includes(source as Source)) {
        sql += ` AND fi.source = $${idx++}`;
        params.push(source);
      }

      sql += ` ORDER BY fi.created_at DESC`;

      const result = await pool.query(sql, params);
      res.json({ issues: result.rows });
    } catch (err: any) {
      console.error(`[FIELD-ISSUES] List error: ${err.message}`);
      res.status(500).json({ error: 'Failed to list field issues' });
    }
  }
);

// ─── GET /:productId/field-issues/summary ────────────────────────────

router.get(
  '/:productId/field-issues/summary',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params as { productId: string };
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });
      if (!(await verifyProductAccess(orgId, productId))) return res.status(404).json({ error: 'Product not found' });

      const result = await pool.query(
        `SELECT
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status = 'open') AS open,
           COUNT(*) FILTER (WHERE status = 'investigating') AS investigating,
           COUNT(*) FILTER (WHERE status = 'fix_in_progress') AS fix_in_progress,
           COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
           COUNT(*) FILTER (WHERE status = 'closed') AS closed,
           COUNT(*) FILTER (WHERE severity = 'critical') AS critical,
           COUNT(*) FILTER (WHERE severity = 'high') AS high,
           COUNT(*) FILTER (WHERE severity = 'medium') AS medium,
           COUNT(*) FILTER (WHERE severity = 'low') AS low,
           AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 86400)
             FILTER (WHERE resolved_at IS NOT NULL) AS avg_resolution_days
         FROM field_issues
         WHERE product_id = $1 AND org_id = $2`,
        [productId, orgId]
      );

      const row = result.rows[0];
      res.json({
        total: parseInt(row.total),
        byStatus: {
          open: parseInt(row.open),
          investigating: parseInt(row.investigating),
          fix_in_progress: parseInt(row.fix_in_progress),
          resolved: parseInt(row.resolved),
          closed: parseInt(row.closed),
        },
        bySeverity: {
          critical: parseInt(row.critical),
          high: parseInt(row.high),
          medium: parseInt(row.medium),
          low: parseInt(row.low),
        },
        avgResolutionDays: row.avg_resolution_days ? parseFloat(parseFloat(row.avg_resolution_days).toFixed(1)) : null,
      });
    } catch (err: any) {
      console.error(`[FIELD-ISSUES] Summary error: ${err.message}`);
      res.status(500).json({ error: 'Failed to fetch field issue summary' });
    }
  }
);

// ─── GET /:productId/field-issues/export — Post-market surveillance report ──

router.get(
  '/:productId/field-issues/export',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params as { productId: string };
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });
      if (!(await verifyProductAccess(orgId, productId))) return res.status(404).json({ error: 'Product not found' });

      // Fetch product name from Neo4j
      const neoSession = getDriver().session();
      let productName = productId;
      try {
        const pResult = await neoSession.run(
          'MATCH (p:Product {id: $productId}) RETURN p.name AS name',
          { productId }
        );
        productName = pResult.records[0]?.get('name') || productId;
      } finally {
        await neoSession.close();
      }

      // Fetch all issues with corrective actions
      const issuesResult = await pool.query(
        `SELECT fi.*, u.email AS reporter_email
         FROM field_issues fi
         LEFT JOIN users u ON fi.reported_by = u.id
         WHERE fi.product_id = $1 AND fi.org_id = $2
         ORDER BY fi.created_at DESC`,
        [productId, orgId]
      );

      const actionsResult = await pool.query(
        `SELECT * FROM corrective_actions
         WHERE product_id = $1 AND org_id = $2
         ORDER BY created_at ASC`,
        [productId, orgId]
      );

      // Summary stats
      const summaryResult = await pool.query(
        `SELECT
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status IN ('open', 'investigating')) AS open,
           COUNT(*) FILTER (WHERE status IN ('resolved', 'closed')) AS resolved,
           COUNT(*) FILTER (WHERE severity = 'critical') AS critical,
           COUNT(*) FILTER (WHERE severity = 'high') AS high,
           AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 86400)
             FILTER (WHERE resolved_at IS NOT NULL) AS avg_days
         FROM field_issues WHERE product_id = $1 AND org_id = $2`,
        [productId, orgId]
      );

      const stats = summaryResult.rows[0];
      const issues = issuesResult.rows;
      const actionsByIssue: Record<string, any[]> = {};
      for (const a of actionsResult.rows) {
        if (!actionsByIssue[a.field_issue_id]) actionsByIssue[a.field_issue_id] = [];
        actionsByIssue[a.field_issue_id].push(a);
      }

      // Generate Markdown report
      const now = new Date().toISOString().slice(0, 10);
      const lines: string[] = [
        `# Post-Market Surveillance Report`,
        ``,
        `**Product:** ${productName}  `,
        `**Generated:** ${now}  `,
        `**CRA Reference:** Article 13(2), Article 13(9)`,
        ``,
        `---`,
        ``,
        `## Summary`,
        ``,
        `| Metric | Value |`,
        `|--------|-------|`,
        `| Total field issues | ${parseInt(stats.total)} |`,
        `| Open / Investigating | ${parseInt(stats.open)} |`,
        `| Resolved / Closed | ${parseInt(stats.resolved)} |`,
        `| Critical severity | ${parseInt(stats.critical)} |`,
        `| High severity | ${parseInt(stats.high)} |`,
        `| Avg. resolution time | ${stats.avg_days ? parseFloat(parseFloat(stats.avg_days).toFixed(1)) + ' days' : 'N/A'} |`,
        ``,
      ];

      if (issues.length === 0) {
        lines.push(`No field issues have been recorded for this product.`);
      } else {
        lines.push(`## Field Issues`, ``);
        for (const issue of issues) {
          const sevLabel = issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1);
          const statusLabel = issue.status.replace(/_/g, ' ');
          lines.push(`### ${issue.title}`);
          lines.push(``);
          lines.push(`- **Severity:** ${sevLabel}`);
          lines.push(`- **Status:** ${statusLabel}`);
          lines.push(`- **Source:** ${issue.source.replace(/_/g, ' ')}`);
          lines.push(`- **Reported:** ${issue.created_at?.toISOString?.()?.slice(0, 10) || String(issue.created_at).slice(0, 10)}`);
          if (issue.affected_versions) lines.push(`- **Affected versions:** ${issue.affected_versions}`);
          if (issue.fixed_in_version) lines.push(`- **Fixed in:** ${issue.fixed_in_version}`);
          if (issue.resolved_at) lines.push(`- **Resolved:** ${String(issue.resolved_at).slice(0, 10)}`);
          if (issue.reporter_email) lines.push(`- **Reporter:** ${issue.reporter_email}`);
          lines.push(``);
          if (issue.description) {
            lines.push(issue.description, ``);
          }
          if (issue.resolution) {
            lines.push(`**Resolution:** ${issue.resolution}`, ``);
          }

          // Corrective actions
          const actions = actionsByIssue[issue.id];
          if (actions && actions.length > 0) {
            lines.push(`**Corrective Actions:**`, ``);
            for (const a of actions) {
              const aStatus = a.status.replace(/_/g, ' ');
              lines.push(`- [${aStatus}] ${a.description}${a.version_released ? ` (v${a.version_released})` : ''}`);
            }
            lines.push(``);
          }

          lines.push(`---`, ``);
        }
      }

      lines.push(``, `*Report generated by CRANIS2 — EU Cyber Resilience Act compliance platform.*`);

      const markdown = lines.join('\n');
      const filename = `post-market-surveillance-${productName.replace(/[^a-zA-Z0-9-_]/g, '_')}-${now}.md`;
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(markdown);
    } catch (err: any) {
      console.error(`[FIELD-ISSUES] Export error: ${err.message}`);
      res.status(500).json({ error: 'Failed to generate surveillance report' });
    }
  }
);

// ─── GET /:productId/field-issues/:issueId ───────────────────────────

router.get(
  '/:productId/field-issues/:issueId',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId, issueId } = req.params as { productId: string; issueId: string };
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });
      if (!(await verifyProductAccess(orgId, productId))) return res.status(404).json({ error: 'Product not found' });

      const result = await pool.query(
        `SELECT fi.*, u.email AS reporter_email
         FROM field_issues fi
         LEFT JOIN users u ON fi.reported_by = u.id
         WHERE fi.id = $1 AND fi.product_id = $2 AND fi.org_id = $3`,
        [issueId, productId, orgId]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Field issue not found' });

      res.json(result.rows[0]);
    } catch (err: any) {
      console.error(`[FIELD-ISSUES] Get error: ${err.message}`);
      res.status(500).json({ error: 'Failed to fetch field issue' });
    }
  }
);

// ─── POST /:productId/field-issues ───────────────────────────────────

router.post(
  '/:productId/field-issues',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId } = req.params as { productId: string };
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });
      if (!(await verifyProductAccess(orgId, productId))) return res.status(404).json({ error: 'Product not found' });

      const { title, description, severity, source, affected_versions, linked_finding_id } = req.body;

      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: 'Title is required' });
      }
      if (severity && !VALID_SEVERITIES.includes(severity)) {
        return res.status(400).json({ error: `Invalid severity. Must be one of: ${VALID_SEVERITIES.join(', ')}` });
      }
      if (source && !VALID_SOURCES.includes(source)) {
        return res.status(400).json({ error: `Invalid source. Must be one of: ${VALID_SOURCES.join(', ')}` });
      }

      const result = await pool.query(
        `INSERT INTO field_issues (org_id, product_id, title, description, severity, source, affected_versions, linked_finding_id, reported_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [orgId, productId, title.trim(), description || null, severity || 'medium', source || 'internal_testing', affected_versions || null, linked_finding_id || null, userId]
      );

      res.status(201).json(result.rows[0]);
    } catch (err: any) {
      console.error(`[FIELD-ISSUES] Create error: ${err.message}`);
      res.status(500).json({ error: 'Failed to create field issue' });
    }
  }
);

// ─── PUT /:productId/field-issues/:issueId ───────────────────────────

router.put(
  '/:productId/field-issues/:issueId',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId, issueId } = req.params as { productId: string; issueId: string };
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });
      if (!(await verifyProductAccess(orgId, productId))) return res.status(404).json({ error: 'Product not found' });

      // Verify issue exists
      const existing = await pool.query(
        'SELECT id, status FROM field_issues WHERE id = $1 AND product_id = $2 AND org_id = $3',
        [issueId, productId, orgId]
      );
      if (existing.rows.length === 0) return res.status(404).json({ error: 'Field issue not found' });

      const { title, description, severity, source, status, resolution, affected_versions, fixed_in_version, linked_finding_id } = req.body;

      if (severity && !VALID_SEVERITIES.includes(severity)) {
        return res.status(400).json({ error: `Invalid severity. Must be one of: ${VALID_SEVERITIES.join(', ')}` });
      }
      if (source && !VALID_SOURCES.includes(source)) {
        return res.status(400).json({ error: `Invalid source. Must be one of: ${VALID_SOURCES.join(', ')}` });
      }
      if (status && !VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
      }

      // Auto-set resolved_at when transitioning to resolved/closed
      const oldStatus = existing.rows[0].status;
      let resolvedAt: string | null = null;
      if (status && (status === 'resolved' || status === 'closed') && oldStatus !== 'resolved' && oldStatus !== 'closed') {
        resolvedAt = new Date().toISOString();
      }

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
      addField('source', source);
      addField('status', status);
      addField('resolution', resolution);
      addField('affected_versions', affected_versions);
      addField('fixed_in_version', fixed_in_version);
      addField('linked_finding_id', linked_finding_id);
      if (resolvedAt) addField('resolved_at', resolvedAt);

      params.push(issueId, productId, orgId);
      const whereIdx = idx;

      const result = await pool.query(
        `UPDATE field_issues SET ${setClauses.join(', ')}
         WHERE id = $${whereIdx} AND product_id = $${whereIdx + 1} AND org_id = $${whereIdx + 2}
         RETURNING *`,
        params
      );

      res.json(result.rows[0]);
    } catch (err: any) {
      console.error(`[FIELD-ISSUES] Update error: ${err.message}`);
      res.status(500).json({ error: 'Failed to update field issue' });
    }
  }
);

// ─── DELETE /:productId/field-issues/:issueId ────────────────────────

router.delete(
  '/:productId/field-issues/:issueId',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId, issueId } = req.params as { productId: string; issueId: string };
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });
      if (!(await verifyProductAccess(orgId, productId))) return res.status(404).json({ error: 'Product not found' });

      const result = await pool.query(
        'DELETE FROM field_issues WHERE id = $1 AND product_id = $2 AND org_id = $3 RETURNING id',
        [issueId, productId, orgId]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Field issue not found' });

      res.json({ deleted: true, id: issueId });
    } catch (err: any) {
      console.error(`[FIELD-ISSUES] Delete error: ${err.message}`);
      res.status(500).json({ error: 'Failed to delete field issue' });
    }
  }
);

// ─── Corrective Actions ──────────────────────────────────────────────

const VALID_ACTION_TYPES = ['patch', 'hotfix', 'configuration_change', 'workaround', 'recall', 'other'] as const;
const VALID_ACTION_STATUSES = ['planned', 'in_progress', 'completed', 'verified'] as const;

// GET /:productId/field-issues/:issueId/actions — list corrective actions for an issue
router.get(
  '/:productId/field-issues/:issueId/actions',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId, issueId } = req.params as { productId: string; issueId: string };
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });
      if (!(await verifyProductAccess(orgId, productId))) return res.status(404).json({ error: 'Product not found' });

      const result = await pool.query(
        `SELECT * FROM corrective_actions
         WHERE field_issue_id = $1 AND product_id = $2 AND org_id = $3
         ORDER BY created_at ASC`,
        [issueId, productId, orgId]
      );
      res.json({ actions: result.rows });
    } catch (err: any) {
      console.error(`[FIELD-ISSUES] List actions error: ${err.message}`);
      res.status(500).json({ error: 'Failed to list corrective actions' });
    }
  }
);

// POST /:productId/field-issues/:issueId/actions — create a corrective action
router.post(
  '/:productId/field-issues/:issueId/actions',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId, issueId } = req.params as { productId: string; issueId: string };
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });
      if (!(await verifyProductAccess(orgId, productId))) return res.status(404).json({ error: 'Product not found' });

      // Verify issue exists
      const issueCheck = await pool.query(
        'SELECT id FROM field_issues WHERE id = $1 AND product_id = $2 AND org_id = $3',
        [issueId, productId, orgId]
      );
      if (issueCheck.rows.length === 0) return res.status(404).json({ error: 'Field issue not found' });

      const { description, action_type, version_released } = req.body;
      if (!description || typeof description !== 'string' || description.trim().length === 0) {
        return res.status(400).json({ error: 'Description is required' });
      }
      if (action_type && !VALID_ACTION_TYPES.includes(action_type)) {
        return res.status(400).json({ error: `Invalid action_type. Must be one of: ${VALID_ACTION_TYPES.join(', ')}` });
      }

      const result = await pool.query(
        `INSERT INTO corrective_actions (field_issue_id, org_id, product_id, description, action_type, version_released)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [issueId, orgId, productId, description.trim(), action_type || 'patch', version_released || null]
      );

      res.status(201).json(result.rows[0]);
    } catch (err: any) {
      console.error(`[FIELD-ISSUES] Create action error: ${err.message}`);
      res.status(500).json({ error: 'Failed to create corrective action' });
    }
  }
);

// PUT /:productId/field-issues/:issueId/actions/:actionId — update a corrective action
router.put(
  '/:productId/field-issues/:issueId/actions/:actionId',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId, issueId, actionId } = req.params as { productId: string; issueId: string; actionId: string };
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });
      if (!(await verifyProductAccess(orgId, productId))) return res.status(404).json({ error: 'Product not found' });

      const existing = await pool.query(
        'SELECT id, status FROM corrective_actions WHERE id = $1 AND field_issue_id = $2 AND org_id = $3',
        [actionId, issueId, orgId]
      );
      if (existing.rows.length === 0) return res.status(404).json({ error: 'Corrective action not found' });

      const { description, action_type, status, version_released } = req.body;
      if (action_type && !VALID_ACTION_TYPES.includes(action_type)) {
        return res.status(400).json({ error: `Invalid action_type. Must be one of: ${VALID_ACTION_TYPES.join(', ')}` });
      }
      if (status && !VALID_ACTION_STATUSES.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_ACTION_STATUSES.join(', ')}` });
      }

      // Auto-set completed_at
      const oldStatus = existing.rows[0].status;
      let completedAt: string | null = null;
      if (status && (status === 'completed' || status === 'verified') && oldStatus !== 'completed' && oldStatus !== 'verified') {
        completedAt = new Date().toISOString();
      }

      const setClauses: string[] = ['updated_at = NOW()'];
      const params: any[] = [];
      let idx = 1;

      const addField = (field: string, value: any) => {
        if (value !== undefined) {
          setClauses.push(`${field} = $${idx++}`);
          params.push(value);
        }
      };

      addField('description', description?.trim());
      addField('action_type', action_type);
      addField('status', status);
      addField('version_released', version_released);
      if (completedAt) addField('completed_at', completedAt);

      params.push(actionId, issueId, orgId);
      const whereIdx = idx;

      const result = await pool.query(
        `UPDATE corrective_actions SET ${setClauses.join(', ')}
         WHERE id = $${whereIdx} AND field_issue_id = $${whereIdx + 1} AND org_id = $${whereIdx + 2}
         RETURNING *`,
        params
      );

      res.json(result.rows[0]);
    } catch (err: any) {
      console.error(`[FIELD-ISSUES] Update action error: ${err.message}`);
      res.status(500).json({ error: 'Failed to update corrective action' });
    }
  }
);

// DELETE /:productId/field-issues/:issueId/actions/:actionId
router.delete(
  '/:productId/field-issues/:issueId/actions/:actionId',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { productId, issueId, actionId } = req.params as { productId: string; issueId: string; actionId: string };
      const userId = (req as any).userId;
      const orgId = await getUserOrgId(userId);
      if (!orgId) return res.status(400).json({ error: 'No organisation context' });
      if (!(await verifyProductAccess(orgId, productId))) return res.status(404).json({ error: 'Product not found' });

      const result = await pool.query(
        'DELETE FROM corrective_actions WHERE id = $1 AND field_issue_id = $2 AND org_id = $3 RETURNING id',
        [actionId, issueId, orgId]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Corrective action not found' });

      res.json({ deleted: true, id: actionId });
    } catch (err: any) {
      console.error(`[FIELD-ISSUES] Delete action error: ${err.message}`);
      res.status(500).json({ error: 'Failed to delete corrective action' });
    }
  }
);

export default router;

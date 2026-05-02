/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';
import { ensureObligations, computeDerivedStatuses, enrichObligation } from '../services/obligation-engine.js';

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

async function getProductInfo(orgId: string, productId: string): Promise<{ name: string; craCategory: string | null; craRole: string } | null> {
  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p.name AS name, p.craCategory AS craCategory, o.craRole AS craRole`,
      { orgId, productId }
    );
    if (result.records.length === 0) return null;
    return {
      name: result.records[0].get('name'),
      craCategory: result.records[0].get('craCategory') || null,
      craRole: result.records[0].get('craRole') || 'manufacturer',
    };
  } finally {
    await session.close();
  }
}

function sanitiseName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
}

function formatDate(d: Date | string | null): string {
  if (!d) return '–';
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

// ─── Markdown helpers ────────────────────────────────────────────────────────

function mdTable(headers: string[], rows: string[][]): string {
  const lines: string[] = [];
  lines.push('| ' + headers.join(' | ') + ' |');
  lines.push('| ' + headers.map(() => '---').join(' | ') + ' |');
  for (const row of rows) {
    lines.push('| ' + row.map(c => (c || '').replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ') + ' |');
  }
  return lines.join('\n');
}

function statusLabel(status: string): string {
  switch (status) {
    case 'met': return 'Met';
    case 'in_progress': return 'In Progress';
    case 'not_started': return 'Not Started';
    default: return status;
  }
}

function sendMarkdown(res: Response, filename: string, content: string) {
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(content);
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 1 – VULNERABILITY FINDINGS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:productId/reports/vulnerabilities', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const email = (req as any).email;
  const format = (req.query.format as string || 'md').toLowerCase();
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
      const lines: string[] = [];
      lines.push(`# Vulnerability Findings Report`);
      lines.push('');
      lines.push(`**Product:** ${productInfo.name}`);
      lines.push(`**Generated:** ${formatDate(new Date())}`);
      lines.push('');

      lines.push('## Summary');
      lines.push('');
      lines.push(`| Metric | Count |`);
      lines.push(`| --- | --- |`);
      lines.push(`| Total Findings | ${total} |`);
      lines.push(`| Open | ${open} |`);
      lines.push(`| Critical | ${critical} |`);
      lines.push(`| High | ${high} |`);
      lines.push(`| Medium | ${medium} |`);
      lines.push(`| Low | ${low} |`);
      lines.push('');

      if (total > 0) {
        lines.push('## Findings');
        lines.push('');
        const tableRows = rows.map(r => [
          (r.severity || '').toUpperCase(), r.source_id || '', r.title || '',
          r.dependency_name || '', r.status || '',
          r.cvss_score != null ? String(r.cvss_score) : '',
        ]);
        lines.push(mdTable(['Severity', 'Source ID', 'Title', 'Dependency', 'Status', 'CVSS'], tableRows));
      }

      lines.push('');
      lines.push('---');
      lines.push(`*Generated by CRANIS2 — ${formatDate(new Date())}*`);

      sendMarkdown(res, `${filename}.md`, lines.join('\n'));
    }

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
// REPORT 2 – LICENCE COMPLIANCE
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:productId/reports/licences', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const email = (req as any).email;
  const format = (req.query.format as string || 'md').toLowerCase();
  const productId = req.params.productId as string;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation' }); return; }

    const productInfo = await getProductInfo(orgId, productId);
    if (!productInfo) { res.status(404).json({ error: 'Product not found' }); return; }

    const scanResult = await pool.query(
      `SELECT total_deps, permissive_count, copyleft_count, unknown_count, critical_count,
              direct_count, transitive_count, completed_at
       FROM license_scans
       WHERE product_id = $1 AND org_id = $2 AND status = 'completed'
       ORDER BY completed_at DESC LIMIT 1`,
      [productId, orgId]
    );
    const scan = scanResult.rows[0] || null;

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
      const lines: string[] = [];
      lines.push(`# Licence Compliance Report`);
      lines.push('');
      lines.push(`**Product:** ${productInfo.name}`);
      lines.push(`**Generated:** ${formatDate(new Date())}`);
      lines.push('');

      lines.push('## Scan Summary');
      lines.push('');
      if (scan) {
        lines.push(`| Metric | Value |`);
        lines.push(`| --- | --- |`);
        lines.push(`| Total Dependencies | ${scan.total_deps} |`);
        lines.push(`| Permissive | ${scan.permissive_count} |`);
        lines.push(`| Copyleft | ${scan.copyleft_count} |`);
        lines.push(`| Unknown | ${scan.unknown_count} |`);
        lines.push(`| Critical Risk | ${scan.critical_count} |`);
        lines.push(`| Direct / Transitive | ${scan.direct_count} / ${scan.transitive_count} |`);
        lines.push(`| Last Scan | ${formatDate(scan.completed_at)} |`);
      } else {
        lines.push('No completed licence scan found for this product.');
      }
      lines.push('');

      if (rows.length > 0) {
        lines.push('## Licence Findings');
        lines.push('');
        const tableRows = rows.map(r => [
          r.dependency_name || '', r.dependency_version || '', r.license_declared || '',
          r.license_category || '', r.risk_level || '', r.status || '',
          r.compatibility_verdict || '',
        ]);
        lines.push(mdTable(['Dependency', 'Version', 'Licence', 'Category', 'Risk', 'Status', 'Compat.'], tableRows));
      }

      lines.push('');
      lines.push('---');
      lines.push(`*Generated by CRANIS2 — ${formatDate(new Date())}*`);

      sendMarkdown(res, `${filename}.md`, lines.join('\n'));
    }

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
// REPORT 3 – OBLIGATION STATUS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:productId/reports/obligations', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const email = (req as any).email;
  const format = (req.query.format as string || 'md').toLowerCase();
  const productId = req.params.productId as string;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation' }); return; }

    const productInfo = await getProductInfo(orgId, productId);
    if (!productInfo) { res.status(404).json({ error: 'Product not found' }); return; }

    await ensureObligations(orgId, productId, productInfo.craCategory, productInfo.craRole);

    const [obResult, derivedMap] = await Promise.all([
      pool.query(
        `SELECT id, product_id, obligation_key, status, notes, updated_by, updated_at
         FROM obligations WHERE org_id = $1 AND product_id = $2
         ORDER BY created_at ASC`,
        [orgId, productId]
      ),
      computeDerivedStatuses([productId], orgId, { [productId]: productInfo.craCategory }, productInfo.craRole),
    ]);

    const productDerived = derivedMap[productId] ?? {};
    const obligations = obResult.rows.map(row => enrichObligation(row, productDerived[row.obligation_key] ?? null));

    const met = obligations.filter(o => o.effectiveStatus === 'met').length;
    const inProgress = obligations.filter(o => o.effectiveStatus === 'in_progress').length;
    const notStarted = obligations.filter(o => o.effectiveStatus === 'not_started').length;
    const total = obligations.length;
    const pct = total > 0 ? Math.round((met / total) * 100) : 0;

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
      const lines: string[] = [];
      lines.push(`# CRA Obligation Status Report`);
      lines.push('');
      lines.push(`**Product:** ${productInfo.name}`);
      lines.push(`**Generated:** ${formatDate(new Date())}`);
      lines.push('');

      lines.push('## Progress Summary');
      lines.push('');
      lines.push(`| Metric | Value |`);
      lines.push(`| --- | --- |`);
      lines.push(`| Total Obligations | ${total} |`);
      lines.push(`| Met | ${met} |`);
      lines.push(`| In Progress | ${inProgress} |`);
      lines.push(`| Not Started | ${notStarted} |`);
      lines.push(`| Compliance | ${pct}% |`);
      lines.push('');

      if (total > 0) {
        lines.push('## Obligations');
        lines.push('');
        const tableRows = obligations.map(o => {
          const source = o.derivedStatus && o.effectiveStatus !== o.status ? 'Auto-detected' :
                         o.derivedStatus && o.derivedStatus === o.status && o.status !== 'not_started' ? 'Confirmed' : 'Manual';
          return [o.article, o.title, statusLabel(o.effectiveStatus), source, (o.notes || '').slice(0, 80)];
        });
        lines.push(mdTable(['Article', 'Title', 'Status', 'Source', 'Notes'], tableRows));
      }

      lines.push('');
      lines.push('---');
      lines.push(`*Generated by CRANIS2 — ${formatDate(new Date())}*`);

      sendMarkdown(res, `${filename}.md`, lines.join('\n'));
    }

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
// REPORT 4 – RISK ASSESSMENT (Annex VII §3)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:productId/reports/risk-assessment', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const email = (req as any).email;
  const productId = req.params.productId as string;
  const format = (req.query.format as string) || 'md';

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const productInfo = await getProductInfo(orgId, productId);
    if (!productInfo) { res.status(404).json({ error: 'Product not found' }); return; }

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
      const lines: string[] = [];
      lines.push(`# Cybersecurity Risk Assessment`);
      lines.push(`**CRA Annex VII §3 / Article 13(2)**`);
      lines.push('');
      lines.push(`**Product:** ${productInfo.name}`);
      lines.push(`**Generated:** ${formatDate(new Date())}`);
      lines.push('');

      // Section 1
      lines.push('## 1. Risk Assessment Methodology');
      lines.push('');
      lines.push(fields.methodology || '*Not yet documented. Complete the risk assessment section in the Technical File.*');
      lines.push('');

      // Section 2
      lines.push('## 2. Threat Model / Attack Surface Analysis');
      lines.push('');
      lines.push(fields.threat_model || '*Not yet documented.*');
      lines.push('');

      // Section 3
      lines.push('## 3. Risk Register');
      lines.push('');
      if (fields.risk_register) {
        lines.push(fields.risk_register);
      } else {
        lines.push('*Not yet documented.*');
      }
      lines.push('');

      // Section 4
      lines.push('## 4. Annex I Part I — Essential Requirements');
      lines.push('');
      if (annexReqs.length > 0) {
        for (const r of annexReqs) {
          lines.push(`### ${r.ref}: ${r.title}`);
          lines.push('');
          lines.push(`**Applicable:** ${r.applicable ? 'Yes' : 'No'}`);
          lines.push('');
          if (r.applicable && r.evidence) {
            lines.push(`**Evidence:** ${r.evidence}`);
            lines.push('');
          }
          if (!r.applicable && r.justification) {
            lines.push(`**Justification:** ${r.justification}`);
            lines.push('');
          }
          if (r.applicable && !r.evidence) {
            lines.push('*Evidence not yet provided.*');
            lines.push('');
          }
        }
      } else {
        lines.push('*Annex I requirements not yet assessed.*');
      }

      lines.push('');
      lines.push('---');
      lines.push(`*Generated by CRANIS2 — ${formatDate(new Date())}*`);

      sendMarkdown(res, `${filename}.md`, lines.join('\n'));
    }

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

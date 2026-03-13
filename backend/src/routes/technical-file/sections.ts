import { Router, Request, Response } from 'express';
import { getDriver } from '../../db/neo4j.js';
import pool from '../../db/pool.js';
import { recordEvent, extractRequestData } from '../../services/telemetry.js';
import { logProductActivity } from '../../services/activity-log.js';
import { extendRetentionForSupportDate } from '../../services/retention-ledger.js';
import {
  requireAuth, getUserOrgId, ensureSections, updateTechFileNode, formatCraCategory,
} from './shared.js';

const router = Router();

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

    // Capture old status for audit trail
    const oldSection = await pool.query(
      `SELECT status FROM technical_file_sections WHERE product_id = $1 AND section_key = $2`,
      [productId, sectionKey]
    );
    const oldStatus = oldSection.rows[0]?.status || null;

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

    // Activity log – technical file edits
    const newStatus = status || row.status;
    const statusChanged = status !== undefined && status !== oldStatus;
    logProductActivity({
      productId, orgId, userId, userEmail,
      action: 'technical_file_updated',
      entityType: 'technical_file_section',
      entityId: sectionKey,
      summary: statusChanged
        ? `Updated ${sectionKey} section (${oldStatus} → ${newStatus})`
        : `Edited ${sectionKey} section content`,
      oldValues: statusChanged ? { status: oldStatus } : null,
      newValues: statusChanged ? { status: newStatus } : null,
      metadata: { sectionKey, title: row.title },
    }).catch(() => {});

    // If support_period end_date changed, extend retention on existing snapshots
    if (sectionKey === 'support_period' && content?.fields?.end_date) {
      extendRetentionForSupportDate(productId, content.fields.end_date)
        .then(({ extended }) => {
          if (extended > 0) {
            logProductActivity({
              productId, orgId, userId, userEmail,
              action: 'retention_extended',
              entityType: 'compliance_snapshot',
              entityId: productId,
              summary: `Retention extended to ${content.fields.end_date} for ${extended} snapshot(s), support period updated`,
              metadata: { newSupportEndDate: content.fields.end_date, snapshotsExtended: extended },
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }

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
  const versionText = productVersion ? `v${productVersion}` : '[version not set; add via product settings]';
  const purposeText =
    `${productName} is a software product placed on the EU market. ` +
    `It is classified under the Cyber Resilience Act as a ${craLabel} product. ` +
    (repoUrl ? `The source code is hosted at ${repoUrl}. ` : '') +
    `Describe the intended purpose here: who uses this product, what problem it solves, and any relevant operational or deployment context.`;

  const versionNote =
    `${versionText}. This is the version (or range of versions) subject to CRA conformity assessment. ` +
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
      name: 'ETSI EN 303 645 V2.1.1 – Cyber Security for Consumer Internet of Things: Baseline Requirements',
      reference: 'ETSI EN 303 645:2021',
      scope: 'Applied where product functionality intersects with internet-connected device requirements.',
    },
    {
      name: 'EN 18031-1:2024 – Common security requirements for internet-connected radio equipment (general)',
      reference: 'EN 18031-1:2024',
      scope: 'Baseline CRA internet security requirements for connected software products.',
    },
  ];

  if (['important_i', 'important_ii', 'critical'].includes(productCraCategory || '')) {
    standards.push({
      name: 'EN 18031-2:2024 – Security requirements for equipment processing virtual currency or personal data',
      reference: 'EN 18031-2:2024',
      scope: `Applies as product is classified ${craLabel} (Important Class I or higher).`,
    });
  }
  if (['important_ii', 'critical'].includes(productCraCategory || '')) {
    standards.push({
      name: 'EN 18031-3:2024 – Security requirements for industrial/professional internet-connected equipment',
      reference: 'EN 18031-3:2024',
      scope: `Applies as product is classified ${craLabel} (Important Class II or higher).`,
    });
  }
  if (productCraCategory === 'critical') {
    standards.push({
      name: 'ISO/IEC 15408 – Common Criteria for Information Technology Security Evaluation',
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

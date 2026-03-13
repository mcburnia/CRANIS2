import { Router, Request, Response } from 'express';
import { getDriver } from '../../db/neo4j.js';
import pool from '../../db/pool.js';
import { recordEvent, extractRequestData } from '../../services/telemetry.js';
import { logProductActivity } from '../../services/activity-log.js';
import {
  requireAuth, getUserOrgId, ensureSections, updateTechFileNode, formatCraCategory,
} from './shared.js';

const router = Router();

// ─── Section field definitions (which sections have which structure) ─
const FIELD_SECTIONS = ['product_description', 'design_development', 'vulnerability_handling', 'declaration_of_conformity', 'support_period'];
const ARRAY_SECTIONS_MAP: Record<string, string> = {
  standards_applied: 'standards',
  test_reports: 'reports',
};
// Sections the deterministic auto-fill covers
const AUTO_FILL_SECTIONS = ['product_description', 'vulnerability_handling', 'standards_applied', 'test_reports'];

// ─── POST /api/technical-file/:productId/batch-fill ─────────
// Applies deterministic auto-fill to all eligible sections in one request.
// Only populates empty fields; never overwrites existing content.
// Returns per-section results so the frontend can show what changed.
router.post('/:productId/batch-fill', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).email;
  const orgId = await getUserOrgId(userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const productId = req.params.productId as string;
  const { excludeSections = [] } = req.body || {};

  // Verify product belongs to org and fetch metadata
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

  // Ensure sections exist
  await ensureSections(productId);

  // Fetch current section state + platform data in parallel
  const [sectionsResult, sbomResult, scanCountResult, findingsResult, scansResult] = await Promise.all([
    pool.query(
      `SELECT section_key, content, status FROM technical_file_sections WHERE product_id = $1`,
      [productId]
    ),
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
    pool.query(
      `SELECT id, completed_at, findings_count FROM vulnerability_scans
       WHERE product_id = $1 AND status = 'completed'
       ORDER BY completed_at DESC LIMIT 5`,
      [productId]
    ),
  ]);

  const sectionMap: Record<string, { content: any; status: string }> = {};
  for (const row of sectionsResult.rows) {
    sectionMap[row.section_key] = {
      content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
      status: row.status,
    };
  }

  const sbom = sbomResult.rows[0] || null;
  const scanCount = scanCountResult.rows[0]?.scan_count || 0;
  const lastScanDate = scanCountResult.rows[0]?.last_scan_date || null;
  const openFindings = findingsResult.rows[0]?.open_count || 0;

  // Build suggestions (same logic as the GET /suggestions endpoint)
  const craLabel = formatCraCategory(productCraCategory);
  const suggestions = buildSuggestions(
    productName, productVersion, productCraCategory, repoUrl, craLabel,
    sbom, scanCount, lastScanDate, openFindings, scansResult.rows,
  );

  // Apply non-destructive merge for each eligible section
  const results: { sectionKey: string; action: string; fieldsPopulated: number }[] = [];
  const sectionsToSave: { key: string; content: any }[] = [];

  for (const sectionKey of AUTO_FILL_SECTIONS) {
    if (excludeSections.includes(sectionKey)) {
      results.push({ sectionKey, action: 'skipped', fieldsPopulated: 0 });
      continue;
    }

    const current = sectionMap[sectionKey];
    if (!current) {
      results.push({ sectionKey, action: 'missing', fieldsPopulated: 0 });
      continue;
    }

    // Skip completed sections
    if (current.status === 'completed') {
      results.push({ sectionKey, action: 'already_complete', fieldsPopulated: 0 });
      continue;
    }

    const suggestion = suggestions[sectionKey];
    if (!suggestion) {
      results.push({ sectionKey, action: 'no_suggestion', fieldsPopulated: 0 });
      continue;
    }

    const { merged, fieldsPopulated } = mergeSection(sectionKey, current.content, suggestion);
    if (fieldsPopulated === 0) {
      results.push({ sectionKey, action: 'no_empty_fields', fieldsPopulated: 0 });
      continue;
    }

    sectionsToSave.push({ key: sectionKey, content: merged });
    results.push({ sectionKey, action: 'filled', fieldsPopulated });
  }

  // Save all changed sections and advance status to in_progress where applicable
  for (const { key, content } of sectionsToSave) {
    const currentStatus = sectionMap[key]?.status || 'not_started';
    const newStatus = currentStatus === 'not_started' ? 'in_progress' : currentStatus;

    await pool.query(
      `UPDATE technical_file_sections
       SET content = $1, status = $2, updated_by = $3, updated_at = NOW()
       WHERE product_id = $4 AND section_key = $5`,
      [JSON.stringify(content), newStatus, userEmail, productId, key]
    );

    // Activity log
    logProductActivity({
      productId, orgId, userId, userEmail,
      action: 'technical_file_updated',
      entityType: 'technical_file_section',
      entityId: key,
      summary: `Batch-filled ${key} section (auto-fill wizard)`,
      oldValues: currentStatus !== newStatus ? { status: currentStatus } : null,
      newValues: currentStatus !== newStatus ? { status: newStatus } : null,
      metadata: { sectionKey: key, source: 'batch_fill_wizard' },
    }).catch(() => {});
  }

  // Update Neo4j progress node
  if (sectionsToSave.length > 0) {
    await updateTechFileNode(productId);
  }

  // Telemetry
  const reqData = extractRequestData(req);
  recordEvent({
    userId, email: userEmail,
    eventType: 'batch_fill_completed',
    ...reqData,
    metadata: {
      productId,
      sectionsFilled: sectionsToSave.length,
      totalFieldsPopulated: results.reduce((sum, r) => sum + r.fieldsPopulated, 0),
    },
  }).catch(() => {});

  // Fetch updated progress for the response
  const progressResult = await pool.query(
    `SELECT status, COUNT(*)::int as count
     FROM technical_file_sections WHERE product_id = $1 GROUP BY status`,
    [productId]
  );
  const progress: Record<string, number> = { not_started: 0, in_progress: 0, completed: 0 };
  for (const row of progressResult.rows) progress[row.status] = row.count;
  const total = Object.values(progress).reduce((a, b) => a + b, 0);

  res.json({
    results,
    summary: {
      sectionsFilled: sectionsToSave.length,
      totalFieldsPopulated: results.reduce((sum, r) => sum + r.fieldsPopulated, 0),
      sectionsSkipped: results.filter(r => r.action !== 'filled').length,
    },
    progress: { total, ...progress },
  });
});

// ─── Suggestion builder (extracted from GET /suggestions) ────
function buildSuggestions(
  productName: string, productVersion: string | null, productCraCategory: string | null,
  repoUrl: string | null, craLabel: string,
  sbom: any, scanCount: number, lastScanDate: string | null, openFindings: number,
  scanRows: any[],
): Record<string, any> {
  const versionText = productVersion ? `v${productVersion}` : '[version not set; add via product settings]';

  return {
    product_description: {
      fields: {
        intended_purpose:
          `${productName} is a software product placed on the EU market. ` +
          `It is classified under the Cyber Resilience Act as a ${craLabel} product. ` +
          (repoUrl ? `The source code is hosted at ${repoUrl}. ` : '') +
          `Describe the intended purpose here: who uses this product, what problem it solves, and any relevant operational or deployment context.`,
        versions_affecting_compliance:
          `${versionText}. This is the version (or range of versions) subject to CRA conformity assessment. ` +
          `List all software versions currently available on the market that are within the scope of this declaration.`,
        market_availability: repoUrl
          ? `${productName} is made available via its public repository at ${repoUrl}. ` +
            `Releases are distributed as source code and/or binary artefacts via the repository's release mechanism.`
          : `${productName} is distributed as software. ` +
            `Describe here how the product is made available to users (e.g. download page, app store, package repository, SaaS service).`,
      },
    },
    vulnerability_handling: {
      fields: {
        update_distribution_mechanism: scanCount > 0
          ? `${productName} undergoes automated vulnerability scanning via CRANIS2 using the OSV.dev database. ` +
            `${scanCount} completed scan${scanCount === 1 ? '' : 's'} on record. ` +
            (lastScanDate ? `Most recent scan: ${new Date(lastScanDate).toLocaleDateString('en-GB')}. ` : '') +
            `Security updates are distributed via [describe your distribution mechanism, e.g. package manager update, auto-update push, release notification]. ` +
            `Current open/acknowledged findings: ${openFindings}.`
          : `Describe the mechanism used to distribute security updates to users of ${productName}. ` +
            `Include how users are notified of available updates and how updates are applied. ` +
            `To generate scan evidence, run a vulnerability scan from the Risk Findings tab.`,
        sbom_reference: sbom
          ? `An SBOM is maintained for ${productName} containing ${sbom.package_count} component(s). ` +
            `It is auto-generated from the source repository and accessible from the Dependencies tab in CRANIS2. ` +
            (sbom.is_stale
              ? 'Note: the SBOM is currently marked as stale and should be regenerated before publication.'
              : 'The SBOM is current and up to date.')
          : `An SBOM for ${productName} has not yet been generated. ` +
            `Connect the product repository in CRANIS2 to enable automatic SBOM generation per CRA Art. 13(11).`,
      },
    },
    standards_applied: {
      standards: buildStandardsList(productCraCategory, craLabel),
    },
    test_reports: {
      reports: buildTestReports(scanCount, scanRows),
    },
  };
}

function buildStandardsList(productCraCategory: string | null, craLabel: string) {
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
  return standards;
}

function buildTestReports(scanCount: number, scanRows: any[]) {
  const reports: { type: string; date: string; tool: string; summary: string }[] = [];
  if (scanCount > 0) {
    for (const scan of scanRows) {
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
      summary: 'No completed vulnerability scans recorded yet. Run a scan from the Risk Findings tab to generate evidence for this section.',
    });
  }
  return reports;
}

// ─── Non-destructive merge logic ─────────────────────────────
function mergeSection(sectionKey: string, current: any, suggestion: any): { merged: any; fieldsPopulated: number } {
  let fieldsPopulated = 0;

  if (FIELD_SECTIONS.includes(sectionKey) || suggestion.fields) {
    const currentFields = current?.fields || {};
    const suggestedFields = suggestion.fields || {};
    const mergedFields = { ...currentFields };
    for (const [k, v] of Object.entries(suggestedFields)) {
      if (!mergedFields[k] || mergedFields[k] === '') {
        mergedFields[k] = v;
        fieldsPopulated++;
      }
    }
    return { merged: { ...current, fields: mergedFields }, fieldsPopulated };
  }

  const arrayKey = ARRAY_SECTIONS_MAP[sectionKey];
  if (arrayKey && suggestion[arrayKey]) {
    const currentArray = current?.[arrayKey] || [];
    if (currentArray.length === 0) {
      const suggestedArray = suggestion[arrayKey] || [];
      fieldsPopulated = suggestedArray.length;
      return { merged: { ...current, [arrayKey]: suggestedArray }, fieldsPopulated };
    }
    return { merged: current, fieldsPopulated: 0 };
  }

  return { merged: current, fieldsPopulated: 0 };
}

export default router;

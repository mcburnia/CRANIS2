/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';
import {
  ensureObligations, ensureObligationsBatch, computeDerivedStatuses, enrichObligation,
  OBLIGATIONS, CraRole,
} from '../services/obligation-engine.js';
import { logProductActivity } from '../services/activity-log.js';
import { createObligationCard, resolveCard } from '../services/trello.js';

const router = Router();

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

async function getOrgCraRole(orgId: string): Promise<CraRole> {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(
      'MATCH (o:Organisation {id: $orgId}) RETURN o.craRole AS craRole',
      { orgId }
    );
    const role = result.records[0]?.get('craRole') || 'manufacturer';
    return role as CraRole;
  } finally {
    await session.close();
  }
}

// ─── GET /api/obligations/overview ───────────────────────────
router.get('/overview', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    // Get org role and products from Neo4j
    const craRole = await getOrgCraRole(orgId);
    const driver = getDriver();
    const session = driver.session();
    let products: { id: string; name: string; craCategory: string | null }[] = [];
    try {
      const result = await session.run(
        `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product)
         RETURN p.id AS id, p.name AS name, p.craCategory AS craCategory
         ORDER BY p.name`,
        { orgId }
      );
      products = result.records.map(r => ({
        id: r.get('id'),
        name: r.get('name'),
        craCategory: r.get('craCategory') || null,
      }));
    } finally {
      await session.close();
    }

    if (products.length === 0) {
      res.json({ products: [], totals: { totalObligations: 0, completed: 0, inProgress: 0, notStarted: 0 } });
      return;
    }

    // Auto-create obligations for all products (single batch INSERT)
    await ensureObligationsBatch(orgId, products.map(p => ({ id: p.id, craCategory: p.craCategory })), craRole);

    // Fetch all obligations and derived statuses in parallel
    const productIds = products.map(p => p.id);
    const categoryMap: Record<string, string | null> = {};
    for (const p of products) categoryMap[p.id] = p.craCategory;
    const [obResult, derivedMap] = await Promise.all([
      pool.query(
        `SELECT id, product_id, obligation_key, status, notes, updated_by, updated_at
         FROM obligations WHERE org_id = $1 AND product_id = ANY($2)
         ORDER BY created_at ASC`,
        [orgId, productIds]
      ),
      computeDerivedStatuses(productIds, orgId, categoryMap, craRole),
    ]);

    // Group by product
    const obByProduct: Record<string, any[]> = {};
    for (const row of obResult.rows) {
      if (!obByProduct[row.product_id]) obByProduct[row.product_id] = [];
      const derived = derivedMap[row.product_id]?.[row.obligation_key] ?? null;
      obByProduct[row.product_id].push(enrichObligation(row, derived));
    }

    let totalCompleted = 0, totalInProgress = 0, totalNotStarted = 0;

    const enrichedProducts = products.map(p => {
      const obligations = obByProduct[p.id] || [];
      // Use effectiveStatus (max of manual and derived) for counts
      const completed = obligations.filter(o => o.effectiveStatus === 'met').length;
      const inProgress = obligations.filter(o => o.effectiveStatus === 'in_progress').length;
      const notStarted = obligations.filter(o => o.effectiveStatus === 'not_started').length;
      totalCompleted += completed;
      totalInProgress += inProgress;
      totalNotStarted += notStarted;

      return {
        id: p.id,
        name: p.name,
        craCategory: p.craCategory,
        obligations,
        progress: { total: obligations.length, completed, inProgress, notStarted },
      };
    });

    res.json({
      craRole,
      products: enrichedProducts,
      totals: { totalObligations: totalCompleted + totalInProgress + totalNotStarted, completed: totalCompleted, inProgress: totalInProgress, notStarted: totalNotStarted },
    });

  } catch (err) {
    console.error('Failed to fetch obligations overview:', err);
    res.status(500).json({ error: 'Failed to fetch obligations overview' });
  }
});

// ─── GET /api/obligations/:productId ─────────────────────────
router.get('/:productId', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const productId = req.params.productId as string;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    // Verify product belongs to org and get category + role
    const craRole = await getOrgCraRole(orgId);
    const driver = getDriver();
    const session = driver.session();
    let craCategory: string | null = null;
    try {
      const result = await session.run(
        `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
         RETURN p.craCategory AS craCategory`,
        { orgId, productId }
      );
      if (result.records.length === 0) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      craCategory = result.records[0].get('craCategory') || null;
    } finally {
      await session.close();
    }

    // Auto-create obligations and fetch derived statuses in parallel
    await ensureObligations(orgId, productId, craCategory, craRole);

    const [obResult, derivedMap] = await Promise.all([
      pool.query(
        `SELECT id, product_id, obligation_key, status, notes, updated_by, updated_at
         FROM obligations WHERE org_id = $1 AND product_id = $2
         ORDER BY created_at ASC`,
        [orgId, productId]
      ),
      computeDerivedStatuses([productId], orgId, { [productId]: craCategory }, craRole),
    ]);

    const productDerived = derivedMap[productId] ?? {};
    const obligations = obResult.rows.map(row => enrichObligation(row, productDerived[row.obligation_key] ?? null));

    // Use effectiveStatus for counts
    const completed = obligations.filter(o => o.effectiveStatus === 'met').length;
    const inProgress = obligations.filter(o => o.effectiveStatus === 'in_progress').length;
    const notStarted = obligations.filter(o => o.effectiveStatus === 'not_started').length;

    res.json({
      obligations,
      progress: { total: obligations.length, completed, inProgress, notStarted },
    });

  } catch (err) {
    console.error('Failed to fetch product obligations:', err);
    res.status(500).json({ error: 'Failed to fetch product obligations' });
  }
});

// ─── PUT /api/obligations/:id ────────────────────────────────
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).email;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const obligationId = req.params.id as string;
    const { status, notes } = req.body;

    if (status && !['not_started', 'in_progress', 'met'].includes(status)) {
      res.status(400).json({ error: 'Invalid status. Must be: not_started, in_progress, or met' });
      return;
    }

    // Verify belongs to org + capture old values for audit
    const check = await pool.query(
      `SELECT id, obligation_key, product_id, status AS old_status, notes AS old_notes FROM obligations WHERE id = $1 AND org_id = $2`,
      [obligationId, orgId]
    );
    if (check.rows.length === 0) {
      res.status(404).json({ error: 'Obligation not found' });
      return;
    }

    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (status !== undefined) { updates.push(`status = $${idx}`); params.push(status); idx++; }
    if (notes !== undefined) { updates.push(`notes = $${idx}`); params.push(notes); idx++; }
    updates.push(`updated_by = $${idx}`); params.push(userEmail); idx++;
    updates.push(`updated_at = NOW()`);
    params.push(obligationId);

    const result = await pool.query(
      `UPDATE obligations SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    // Telemetry
    const reqData = extractRequestData(req);
    await recordEvent({
      userId,
      email: userEmail,
      eventType: 'obligation_updated',
      ...reqData,
      metadata: {
        obligationId,
        obligationKey: check.rows[0].obligation_key,
        productId: check.rows[0].product_id,
        newStatus: status,
      },
    });

    // Activity log – obligation changes with before/after
    const obKey = check.rows[0].obligation_key;
    const productId = check.rows[0].product_id;
    if (status !== undefined && status !== check.rows[0].old_status) {
      logProductActivity({
        productId, orgId, userId, userEmail,
        action: 'obligation_status_changed',
        entityType: 'obligation',
        entityId: obligationId,
        summary: `Changed ${obKey} status from ${check.rows[0].old_status} to ${status}`,
        oldValues: { status: check.rows[0].old_status },
        newValues: { status },
        metadata: { obligationKey: obKey },
      }).catch(() => {});
      // Trello card for obligation work started
      const obDef = OBLIGATIONS.find(o => o.key === obKey);
      if (obDef) {
        createObligationCard(orgId, productId, '', obKey, obDef.title, status, obDef.article).catch(() => {});
      }
      // Resolve Trello card when obligation is met
      if (status === 'met') {
        const eventKey = `obligation:${productId}:${obKey}:in_progress`;
        resolveCard(orgId, eventKey, `Obligation ${obKey} marked as met.`).catch(() => {});
      }
    }
    if (notes !== undefined && notes !== check.rows[0].old_notes) {
      logProductActivity({
        productId, orgId, userId, userEmail,
        action: 'obligation_notes_updated',
        entityType: 'obligation',
        entityId: obligationId,
        summary: `Updated notes for ${obKey}`,
        oldValues: { notes: check.rows[0].old_notes || '' },
        newValues: { notes },
        metadata: { obligationKey: obKey },
      }).catch(() => {});
    }

    res.json(enrichObligation(result.rows[0]));

  } catch (err) {
    console.error('Failed to update obligation:', err);
    res.status(500).json({ error: 'Failed to update obligation' });
  }
});

// ─── POST /api/obligations/:productId/batch-evidence ────────
// Batch-generate deterministic evidence notes for obligations that
// have no notes yet. Uses platform data (tech file, scans, SBOM) to
// produce structured evidence text. No AI involved.
router.post('/:productId/batch-evidence', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).email;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const productId = req.params.productId as string;
    const { excludeKeys = [] } = req.body || {};

    // Verify product belongs to org
    const driver = getDriver();
    const neo4jSession = driver.session();
    let productName: string;
    try {
      const check = await neo4jSession.run(
        `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
         RETURN p.name AS name, p.craCategory AS craCategory`,
        { orgId, productId }
      );
      if (check.records.length === 0) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      productName = check.records[0].get('name') || productId;
    } finally {
      await neo4jSession.close();
    }

    // Ensure obligations exist
    const categoryMap = new Map<string, string>();
    const catResult = await pool.query(
      `SELECT id, obligation_key, status, notes FROM obligations WHERE product_id = $1 AND org_id = $2`,
      [productId, orgId]
    );
    if (catResult.rows.length === 0) {
      res.json({ results: [], summary: { obligationsFilled: 0, obligationsSkipped: 0 } });
      return;
    }

    // Gather platform data for evidence generation
    const [sbomResult, scanResult, techFileResult, stakeholderResult] = await Promise.all([
      pool.query(
        `SELECT package_count, is_stale FROM product_sboms WHERE product_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [productId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count, MAX(completed_at) AS last_date
         FROM vulnerability_scans WHERE product_id = $1 AND status = 'completed'`,
        [productId]
      ),
      pool.query(
        `SELECT section_key, status FROM technical_file_sections WHERE product_id = $1`,
        [productId]
      ),
      pool.query(
        `SELECT role_key, name, email FROM stakeholders
         WHERE (product_id = $1 OR product_id IS NULL) AND org_id = $2 AND name IS NOT NULL AND name != ''`,
        [productId, orgId]
      ),
    ]);

    const sbom = sbomResult.rows[0] || null;
    const scans = { count: scanResult.rows[0]?.count || 0, lastDate: scanResult.rows[0]?.last_date };
    const techSections: Record<string, string> = {};
    for (const row of techFileResult.rows) techSections[row.section_key] = row.status;
    const stakeholders: Record<string, { name: string; email: string }> = {};
    for (const row of stakeholderResult.rows) {
      if (row.name) stakeholders[row.role_key] = { name: row.name, email: row.email || '' };
    }

    const results: { obligationKey: string; action: string }[] = [];
    let filled = 0;

    for (const ob of catResult.rows) {
      const key = ob.obligation_key;

      // Skip if excluded, already has notes, or already met
      if (excludeKeys.includes(key)) {
        results.push({ obligationKey: key, action: 'skipped' });
        continue;
      }
      if (ob.notes && ob.notes.trim().length > 0) {
        results.push({ obligationKey: key, action: 'has_notes' });
        continue;
      }
      if (ob.status === 'met') {
        results.push({ obligationKey: key, action: 'already_met' });
        continue;
      }

      // Generate evidence note from platform data
      const evidence = generateEvidenceNote(key, productName, sbom, scans, techSections, stakeholders);
      if (!evidence) {
        results.push({ obligationKey: key, action: 'no_evidence_available' });
        continue;
      }

      // Save the evidence note
      await pool.query(
        `UPDATE obligations SET notes = $1, updated_by = $2, updated_at = NOW()
         WHERE id = $3`,
        [evidence, userEmail, ob.id]
      );

      logProductActivity({
        productId, orgId, userId, userEmail,
        action: 'obligation_notes_updated',
        entityType: 'obligation',
        entityId: ob.id,
        summary: `Batch-filled evidence notes for ${key} (batch evidence wizard)`,
        oldValues: { notes: '' },
        newValues: { notes: evidence },
        metadata: { obligationKey: key, source: 'batch_evidence_wizard' },
      }).catch(() => {});

      results.push({ obligationKey: key, action: 'filled' });
      filled++;
    }

    // Telemetry
    const reqData = extractRequestData(req);
    recordEvent({
      userId, email: userEmail,
      eventType: 'batch_evidence_completed',
      ...reqData,
      metadata: { productId, obligationsFilled: filled },
    }).catch(() => {});

    res.json({
      results,
      summary: {
        obligationsFilled: filled,
        obligationsSkipped: results.filter(r => r.action !== 'filled').length,
      },
    });

  } catch (err) {
    console.error('Failed to batch-generate obligation evidence:', err);
    res.status(500).json({ error: 'Failed to generate obligation evidence' });
  }
});

// ─── Deterministic evidence note generator ───────────────────
function generateEvidenceNote(
  obligationKey: string,
  productName: string,
  sbom: { package_count: number; is_stale: boolean } | null,
  scans: { count: number; lastDate: string | null },
  techSections: Record<string, string>,
  stakeholders: Record<string, { name: string; email: string }>,
): string | null {
  const obDef = OBLIGATIONS.find(o => o.key === obligationKey);
  if (!obDef) return null;

  switch (obligationKey) {
    case 'art_13':
      return `${productName} is tracked in CRANIS2 with automated SBOM management, vulnerability scanning, and technical file documentation to meet general CRA cybersecurity requirements.`;

    case 'art_13_3':
      if (!sbom) return null;
      return sbom.is_stale
        ? `${productName} has an SBOM with ${sbom.package_count} components, currently flagged as stale. Daily auto-sync is configured. Component currency review is in progress.`
        : `${productName} maintains a current SBOM with ${sbom.package_count} components. Auto-sync runs daily at 2 AM; webhooks flag changes in real time. All dependencies are up to date.`;

    case 'art_13_5':
      if (scans.count === 0) return null;
      return `${scans.count} vulnerability scan${scans.count === 1 ? '' : 's'} completed for ${productName} using the OSV.dev and NVD databases (445,000+ advisories). ` +
        (scans.lastDate ? `Most recent scan: ${new Date(scans.lastDate).toLocaleDateString('en-GB')}. ` : '') +
        `Findings are triaged and tracked through to resolution. Platform-wide scans run daily at 3 AM.`;

    case 'art_13_6':
      return techSections['vulnerability_handling'] === 'completed'
        ? `Vulnerability handling processes are documented in the technical file (vulnerability_handling section, marked complete). ` +
          `Coordinated vulnerability disclosure policy is in place.`
        : techSections['vulnerability_handling']
          ? `Vulnerability handling documentation is in progress in the technical file. Complete the vulnerability_handling section to fulfil this obligation.`
          : null;

    case 'art_13_7':
    case 'art_13_8':
      return techSections['support_period']
        ? `Support period is documented in the technical file. Security updates are provided free of charge during the declared support period per CRA Art. 13(8).`
        : null;

    case 'art_13_9':
      return scans.count > 0
        ? `Security updates for ${productName} are tracked separately from feature updates. Vulnerability findings drive security-specific release cycles.`
        : null;

    case 'art_13_10':
      return `CRANIS2 maintains a compliance evidence vault with RFC 3161 timestamped, Ed25519-signed snapshots stored on EU-sovereign cold storage. ` +
        `Retention period: 10 years from market placement or end of support period, whichever is later. Archives are self-contained and verifiable without CRANIS2.`;

    case 'art_13_11':
      if (!sbom) return null;
      return `An SBOM is maintained for ${productName} containing ${sbom.package_count} component(s), exported in both CycloneDX 1.6 and SPDX 2.3 formats. ` +
        `Auto-generated from the source repository. ${sbom.is_stale ? 'Currently flagged as stale; regeneration pending.' : 'Current and up to date.'}`;

    case 'art_13_12':
      return stakeholders['security_contact']
        ? `Security contact designated: ${stakeholders['security_contact'].name}${stakeholders['security_contact'].email ? ` (${stakeholders['security_contact'].email})` : ''}. ` +
          `Contact information is included in product documentation and the EU Declaration of Conformity.`
        : null;

    case 'art_13_13':
      return `${productName} is registered on CRANIS2 with a unique product identifier. CE marking and conformity information will be included in product documentation upon completion of the technical file.`;

    case 'art_13_14':
      return techSections['product_description'] === 'completed'
        ? `User instructions and safety information are documented in the product_description section of the technical file (marked complete).`
        : techSections['product_description']
          ? `User instructions documentation is in progress. Complete the product_description section of the technical file.`
          : null;

    case 'art_13_15':
      return techSections['support_period']
        ? `End-of-support planning is documented in the technical file. CRANIS2 monitors support periods and sends proactive alerts at 90, 60, 30, and 7 days before expiry.`
        : null;

    case 'art_14':
      return scans.count > 0
        ? `CRANIS2 provides ENISA Article 14 reporting workflows with three-stage timeline management (24h early warning, 72h notification, 14d/1m final report). ` +
          `Deadline monitoring runs hourly with escalating alerts. ${scans.count} vulnerability scan${scans.count === 1 ? '' : 's'} provide the evidence base for incident detection.`
        : `CRANIS2 provides ENISA Article 14 reporting workflows. Run vulnerability scans to build the evidence base for incident detection and reporting.`;

    case 'art_16':
      return techSections['declaration_of_conformity']
        ? `EU Declaration of Conformity is ${techSections['declaration_of_conformity'] === 'completed' ? 'complete' : 'in progress'} in the technical file. ` +
          `CRANIS2 generates a formatted Annex VI DoC PDF pre-populated from platform data.`
        : null;

    case 'annex_i_part_i':
      return techSections['risk_assessment'] === 'completed'
        ? `Cybersecurity risk assessment is documented in the technical file (risk_assessment section, marked complete). ` +
          `All 13 Annex I Part I essential requirements are addressed with applicability decisions, justifications, and evidence references.`
        : techSections['risk_assessment']
          ? `Risk assessment is in progress. Complete the risk_assessment section to demonstrate Annex I Part I compliance.`
          : null;

    case 'annex_i_part_ii':
      return scans.count > 0
        ? `Vulnerability handling requirements under Annex I Part II are addressed through automated scanning (${scans.count} scan${scans.count === 1 ? '' : 's'}), ` +
          `SBOM management, coordinated disclosure processes, and ENISA reporting workflows.`
        : null;

    case 'art_20':
      return `Market surveillance registration is required for critical-category products. CRANIS2 tracks the registration status and provides the necessary product identification data.`;

    case 'art_32':
    case 'art_32_3':
      return techSections['declaration_of_conformity']
        ? `Conformity assessment documentation is ${techSections['declaration_of_conformity'] === 'completed' ? 'complete' : 'in progress'}. ` +
          `Technical file maintained in CRANIS2 with all required Annex VII sections.`
        : null;

    default:
      return null;
  }
}

export default router;

import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';

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

// ─── Obligation definitions ──────────────────────────────────
const OBLIGATIONS = [
  { key: 'art_13', article: 'Art. 13', title: 'Obligations of Manufacturers', description: 'Ensure products are designed and developed in accordance with essential cybersecurity requirements.', appliesTo: ['default', 'important_i', 'important_ii', 'critical'] },
  { key: 'art_13_6', article: 'Art. 13(6)', title: 'Vulnerability Handling', description: 'Identify and document vulnerabilities, provide security updates for at least 5 years.', appliesTo: ['default', 'important_i', 'important_ii', 'critical'] },
  { key: 'art_13_11', article: 'Art. 13(11)', title: 'SBOM (Software Bill of Materials)', description: 'Identify and document components contained in the product, including an SBOM in machine-readable format.', appliesTo: ['default', 'important_i', 'important_ii', 'critical'] },
  { key: 'art_13_12', article: 'Art. 13(12)', title: 'Technical Documentation', description: 'Draw up technical documentation before placing the product on the market.', appliesTo: ['default', 'important_i', 'important_ii', 'critical'] },
  { key: 'art_13_14', article: 'Art. 13(14)', title: 'Conformity Assessment', description: 'Carry out a conformity assessment of the product.', appliesTo: ['default', 'important_i', 'important_ii', 'critical'] },
  { key: 'art_13_15', article: 'Art. 13(15)', title: 'EU Declaration of Conformity', description: 'Draw up the EU declaration of conformity and affix the CE marking.', appliesTo: ['default', 'important_i', 'important_ii', 'critical'] },
  { key: 'art_14', article: 'Art. 14', title: 'Vulnerability Reporting', description: 'Report actively exploited vulnerabilities and severe incidents to ENISA within 24 hours.', appliesTo: ['default', 'important_i', 'important_ii', 'critical'] },
  { key: 'annex_i_part_i', article: 'Annex I, Part I', title: 'Security by Design', description: 'Products shall be designed and developed with appropriate level of cybersecurity based on risks.', appliesTo: ['default', 'important_i', 'important_ii', 'critical'] },
  { key: 'annex_i_part_ii', article: 'Annex I, Part II', title: 'Vulnerability Handling Requirements', description: 'Implement vulnerability handling processes including coordinated disclosure policy.', appliesTo: ['default', 'important_i', 'important_ii', 'critical'] },
  { key: 'art_32', article: 'Art. 32', title: 'Harmonised Standards', description: 'Where harmonised standards exist, conformity assessment shall reference them.', appliesTo: ['important_i', 'important_ii', 'critical'] },
  { key: 'art_32_3', article: 'Art. 32(3)', title: 'Third-Party Assessment', description: 'Critical products require third-party conformity assessment by a notified body.', appliesTo: ['important_ii', 'critical'] },
  { key: 'art_13_3', article: 'Art. 13(3)', title: 'Component Currency', description: 'Ensure all software components integrated in the product are free of known exploitable vulnerabilities and kept up to date throughout the support period.', appliesTo: ['default', 'important_i', 'important_ii', 'critical'] },
  { key: 'art_13_5', article: 'Art. 13(5)', title: 'No Known Exploitable Vulnerabilities at Market Placement', description: 'Products shall be placed on the market without any known exploitable vulnerabilities. Conduct a vulnerability assessment before market placement and remediate findings.', appliesTo: ['default', 'important_i', 'important_ii', 'critical'] },
  { key: 'art_13_7', article: 'Art. 13(7)', title: 'Automatic Security Updates', description: 'Put in place a policy ensuring that security updates are automatically made available to users where technically feasible, for the duration of the support period.', appliesTo: ['default', 'important_i', 'important_ii', 'critical'] },
  { key: 'art_13_8', article: 'Art. 13(8)', title: 'Security Patches Free of Charge', description: 'Security patches and updates shall be provided to users at no additional charge for the full duration of the support period.', appliesTo: ['default', 'important_i', 'important_ii', 'critical'] },
  { key: 'art_13_9', article: 'Art. 13(9)', title: 'Security Updates Separate from Feature Updates', description: 'Security updates shall be distributed and clearly identified separately from feature updates, allowing users to apply security fixes promptly and independently.', appliesTo: ['default', 'important_i', 'important_ii', 'critical'] },
  { key: 'art_13_10', article: 'Art. 13(10)', title: 'Documentation Retention (10 Years)', description: 'Technical documentation and the EU declaration of conformity shall be retained for at least 10 years after the product is placed on the market, or for the support period if longer.', appliesTo: ['default', 'important_i', 'important_ii', 'critical'] },
  { key: 'art_16', article: 'Art. 16', title: 'EU Declaration of Conformity (Annex IV)', description: 'Draw up an EU Declaration of Conformity meeting the Annex IV content requirements: manufacturer name and address, product identification, applicable standards, place and date of issue, and authorised signatory.', appliesTo: ['default', 'important_i', 'important_ii', 'critical'] },
  { key: 'art_20', article: 'Art. 20', title: 'EU Market Surveillance Registration', description: 'Critical products with digital elements require notification of the relevant market surveillance authority and additional registration steps before being placed on the EU market.', appliesTo: ['critical'] },
];

const STATUS_ORDER: Record<string, number> = { 'not_started': 0, 'in_progress': 1, 'met': 2 };

function higherStatus(a: string, b: string | null): string {
  if (!b) return a;
  return (STATUS_ORDER[a] ?? 0) >= (STATUS_ORDER[b] ?? 0) ? a : b;
}

function getApplicableObligations(craCategory: string | null): typeof OBLIGATIONS {
  const known = ['default', 'important_i', 'important_ii', 'critical'];
  const cat = (craCategory && known.includes(craCategory)) ? craCategory : 'default';
  return OBLIGATIONS.filter(o => o.appliesTo.includes(cat));
}

async function ensureObligations(orgId: string, productId: string, craCategory: string | null): Promise<void> {
  const applicable = getApplicableObligations(craCategory);
  if (applicable.length === 0) return;
  // Batch all inserts into a single round-trip
  const placeholders = applicable.map((_, i) => `($1, $2, $${i + 3})`).join(', ');
  const params: any[] = [orgId, productId, ...applicable.map(ob => ob.key)];
  await pool.query(
    `INSERT INTO obligations (org_id, product_id, obligation_key) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
    params
  );
}

// ─── Derived status computation ───────────────────────────────
// Computes obligation statuses that can be inferred from existing platform data.
// Returns: productId → obligationKey → { status, reason }
// Non-destructive: manual statuses are preserved; derived is returned alongside.
async function computeDerivedStatuses(
  productIds: string[],
  orgId: string,
  categoryMap: Record<string, string | null>
): Promise<Record<string, Record<string, { status: string; reason: string }>>> {
  if (productIds.length === 0) return {};

  // 1. SBOMs
  const sbomResult = await pool.query(
    `SELECT product_id, package_count, is_stale FROM product_sboms WHERE product_id = ANY($1)`,
    [productIds]
  );
  const sbomByProduct: Record<string, { packageCount: number; isStale: boolean }> = {};
  for (const row of sbomResult.rows) {
    sbomByProduct[row.product_id] = { packageCount: parseInt(row.package_count, 10), isStale: row.is_stale };
  }

  // 2. Completed vulnerability scan count per product
  const scanResult = await pool.query(
    `SELECT product_id, COUNT(*) AS scan_count
     FROM vulnerability_scans
     WHERE product_id = ANY($1) AND status = 'completed'
     GROUP BY product_id`,
    [productIds]
  );
  const scanCountByProduct: Record<string, number> = {};
  for (const row of scanResult.rows) {
    scanCountByProduct[row.product_id] = parseInt(row.scan_count, 10);
  }

  // 3. Open/acknowledged vulnerability findings per product
  const findingsResult = await pool.query(
    `SELECT product_id, COUNT(*) AS open_count
     FROM vulnerability_findings
     WHERE product_id = ANY($1) AND org_id = $2 AND status IN ('open', 'acknowledged')
     GROUP BY product_id`,
    [productIds, orgId]
  );
  const openFindingsByProduct: Record<string, number> = {};
  for (const row of findingsResult.rows) {
    openFindingsByProduct[row.product_id] = parseInt(row.open_count, 10);
  }

  // 4. Technical file sections (status + key content fields)
  const techFileResult = await pool.query(
    `SELECT product_id, section_key, status,
            content->>'disclosure_policy_url' AS cvd_url,
            content->>'notified_body' AS notified_body
     FROM technical_file_sections WHERE product_id = ANY($1)`,
    [productIds]
  );
  const techFileByProduct: Record<string, Record<string, { status: string; cvdUrl: string | null; notifiedBody: string | null }>> = {};
  for (const row of techFileResult.rows) {
    if (!techFileByProduct[row.product_id]) techFileByProduct[row.product_id] = {};
    techFileByProduct[row.product_id][row.section_key] = {
      status: row.status,
      cvdUrl: row.cvd_url || null,
      notifiedBody: row.notified_body || null,
    };
  }

  // 5. CRA reports
  const craResult = await pool.query(
    `SELECT product_id, status FROM cra_reports WHERE product_id = ANY($1) AND org_id = $2`,
    [productIds, orgId]
  );
  const craReportsByProduct: Record<string, string[]> = {};
  for (const row of craResult.rows) {
    if (!craReportsByProduct[row.product_id]) craReportsByProduct[row.product_id] = [];
    craReportsByProduct[row.product_id].push(row.status);
  }

  // Compute derived statuses per product
  const result: Record<string, Record<string, { status: string; reason: string }>> = {};

  for (const productId of productIds) {
    const derived: Record<string, { status: string; reason: string }> = {};
    const sections = techFileByProduct[productId] ?? {};
    const ALL_SECTION_KEYS = ['product_description', 'design_development', 'vulnerability_handling', 'risk_assessment', 'support_period', 'standards_applied', 'test_reports', 'declaration_of_conformity'];

    // art_13_11 — SBOM
    const sbom = sbomByProduct[productId];
    if (sbom) {
      if (!sbom.isStale && sbom.packageCount > 0) {
        derived['art_13_11'] = { status: 'met', reason: `SBOM current (${sbom.packageCount} packages)` };
      } else {
        derived['art_13_11'] = { status: 'in_progress', reason: `SBOM present${sbom.isStale ? ' — update pending' : ''} (${sbom.packageCount} packages)` };
      }
    }

    // art_13_6 — Vulnerability Handling
    const scanCount = scanCountByProduct[productId] ?? 0;
    const openFindings = openFindingsByProduct[productId] ?? 0;
    if (scanCount > 0) {
      if (openFindings === 0) {
        derived['art_13_6'] = { status: 'met', reason: 'Vulnerability scanning active — no open findings' };
      } else {
        derived['art_13_6'] = { status: 'in_progress', reason: `Vulnerability scanning active — ${openFindings} open finding${openFindings !== 1 ? 's' : ''}` };
      }
    }

    // art_13_12 — Technical Documentation
    const sectionStatuses = ALL_SECTION_KEYS.map(k => sections[k]?.status ?? 'not_started');
    const completedCount = sectionStatuses.filter(s => s === 'completed').length;
    const startedCount = sectionStatuses.filter(s => s !== 'not_started').length;
    if (completedCount === ALL_SECTION_KEYS.length) {
      derived['art_13_12'] = { status: 'met', reason: 'Technical file complete (8/8 sections)' };
    } else if (startedCount > 0) {
      derived['art_13_12'] = { status: 'in_progress', reason: `Technical file ${completedCount}/8 sections complete` };
    }

    // art_13_14 — Conformity Assessment (test_reports section)
    const testReports = sections['test_reports'];
    if (testReports?.status === 'completed') {
      derived['art_13_14'] = { status: 'met', reason: 'Test reports section complete' };
    } else if (testReports?.status === 'in_progress') {
      derived['art_13_14'] = { status: 'in_progress', reason: 'Test reports section in progress' };
    }

    // art_13_15 — EU Declaration of Conformity
    const docSection = sections['declaration_of_conformity'];
    if (docSection?.status === 'completed') {
      derived['art_13_15'] = { status: 'met', reason: 'Declaration of Conformity section complete' };
    } else if (docSection?.status === 'in_progress') {
      derived['art_13_15'] = { status: 'in_progress', reason: 'Declaration of Conformity section in progress' };
    }

    // annex_i_part_i — Security by Design (risk_assessment section)
    const riskSection = sections['risk_assessment'];
    if (riskSection?.status === 'completed') {
      derived['annex_i_part_i'] = { status: 'met', reason: 'Risk assessment complete' };
    } else if (riskSection?.status === 'in_progress') {
      derived['annex_i_part_i'] = { status: 'in_progress', reason: 'Risk assessment in progress' };
    }

    // annex_i_part_ii — Vulnerability Handling Requirements (CVD policy)
    const vulnHandling = sections['vulnerability_handling'];
    if (vulnHandling?.status === 'completed') {
      derived['annex_i_part_ii'] = { status: 'met', reason: 'Vulnerability handling section complete' };
    } else if (vulnHandling?.cvdUrl) {
      derived['annex_i_part_ii'] = { status: 'in_progress', reason: 'CVD policy URL documented' };
    } else if (vulnHandling?.status === 'in_progress') {
      derived['annex_i_part_ii'] = { status: 'in_progress', reason: 'Vulnerability handling section in progress' };
    }

    // art_32 — Harmonised Standards
    const standardsSection = sections['standards_applied'];
    if (standardsSection?.status === 'completed') {
      derived['art_32'] = { status: 'met', reason: 'Standards section complete' };
    } else if (standardsSection?.status === 'in_progress') {
      derived['art_32'] = { status: 'in_progress', reason: 'Standards section in progress' };
    }

    // art_32_3 — Third-Party Assessment (notified body in DoC)
    if (docSection?.notifiedBody) {
      derived['art_32_3'] = { status: docSection.status === 'completed' ? 'met' : 'in_progress', reason: 'Notified body referenced in DoC' };
    }

    // art_14 — Vulnerability Reporting (ENISA reports)
    const reports = craReportsByProduct[productId] ?? [];
    if (reports.length > 0) {
      const hasFinal = reports.some(s => s === 'final_report_sent' || s === 'closed');
      derived['art_14'] = { status: hasFinal ? 'met' : 'in_progress', reason: hasFinal ? 'ENISA report submitted' : 'ENISA report in progress' };
    }

    // art_13_3 — Component Currency (uses SBOM as proxy; can't verify 'latest' without registry lookups)
    if (sbom) {
      derived['art_13_3'] = { status: 'in_progress', reason: `Component inventory tracked via SBOM (${sbom.packageCount} packages)` };
    }

    // art_13_5 — No Known Exploitable Vulnerabilities at Market Placement
    if (scanCount > 0) {
      if (openFindings === 0) {
        derived['art_13_5'] = { status: 'met', reason: 'Vulnerability scanning active — no open findings' };
      } else {
        derived['art_13_5'] = { status: 'in_progress', reason: `Vulnerability scanning active — ${openFindings} open finding${openFindings !== 1 ? 's' : ''} require remediation` };
      }
    }

    // art_16 — EU Declaration of Conformity content (Annex IV) — same data source as art_13_15
    if (docSection?.status === 'completed') {
      derived['art_16'] = { status: 'met', reason: 'EU Declaration of Conformity complete (Annex IV)' };
    } else if (docSection?.status === 'in_progress') {
      derived['art_16'] = { status: 'in_progress', reason: 'EU Declaration of Conformity in progress' };
    }

    // art_20 — EU Market Surveillance Registration (critical products only)
    if (categoryMap[productId] === 'critical') {
      derived['art_20'] = { status: 'in_progress', reason: 'Critical product — EU market surveillance registration required' };
    }

    // art_13 — Overall (derived from all others)
    const others = Object.entries(derived).filter(([k]) => k !== 'art_13');
    if (others.length > 0) {
      const metCount = others.filter(([, v]) => v.status === 'met').length;
      const allMet = metCount === others.length;
      derived['art_13'] = {
        status: allMet ? 'met' : 'in_progress',
        reason: `${metCount}/${others.length} obligations met`,
      };
    }

    result[productId] = derived;
  }

  return result;
}

function enrichObligation(row: any, derived?: { status: string; reason: string } | null) {
  const def = OBLIGATIONS.find(o => o.key === row.obligation_key);
  const manualStatus: string = row.status;
  const derivedStatus: string | null = derived?.status ?? null;
  const derivedReason: string | null = derived?.reason ?? null;
  const effectiveStatus = higherStatus(manualStatus, derivedStatus);

  return {
    id: row.id,
    obligationKey: row.obligation_key,
    article: def?.article || row.obligation_key,
    title: def?.title || row.obligation_key,
    description: def?.description || '',
    status: manualStatus,
    derivedStatus,
    derivedReason,
    effectiveStatus,
    notes: row.notes || '',
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

// ─── GET /api/obligations/overview ───────────────────────────
router.get('/overview', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    // Get products from Neo4j
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

    // Auto-create obligations for all products
    for (const p of products) {
      await ensureObligations(orgId, p.id, p.craCategory);
    }

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
      computeDerivedStatuses(productIds, orgId, categoryMap),
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

    // Verify product belongs to org and get category
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
    await ensureObligations(orgId, productId, craCategory);

    const [obResult, derivedMap] = await Promise.all([
      pool.query(
        `SELECT id, product_id, obligation_key, status, notes, updated_by, updated_at
         FROM obligations WHERE org_id = $1 AND product_id = $2
         ORDER BY created_at ASC`,
        [orgId, productId]
      ),
      computeDerivedStatuses([productId], orgId, { [productId]: craCategory }),
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

    // Verify belongs to org
    const check = await pool.query(
      `SELECT id, obligation_key, product_id FROM obligations WHERE id = $1 AND org_id = $2`,
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

    res.json(enrichObligation(result.rows[0]));

  } catch (err) {
    console.error('Failed to update obligation:', err);
    res.status(500).json({ error: 'Failed to update obligation' });
  }
});

export default router;

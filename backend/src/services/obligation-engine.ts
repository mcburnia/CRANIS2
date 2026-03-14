/**
 * Obligation Engine – shared obligation definitions and derived-status computation.
 *
 * Extracted from routes/obligations.ts so that dashboard.ts (and other consumers)
 * can compute CRA readiness without duplicating logic.
 *
 * Role-aware: obligations are filtered by both CRA product category AND the
 * economic operator role of the organisation (manufacturer, importer, distributor,
 * open_source_steward).
 */

import pool from '../db/pool.js';

// ─── Types ──────────────────────────────────────────────────
export type CraRole = 'manufacturer' | 'importer' | 'distributor' | 'open_source_steward';

export interface ObligationDef {
  key: string;
  article: string;
  title: string;
  description: string;
  appliesTo: string[];          // CRA product categories
  appliesToRoles: CraRole[];    // Economic operator roles
}

// ─── Obligation definitions ──────────────────────────────────
// Manufacturer obligations (Art. 13, 14, 16, 20, 32, Annexes I/IV)
const ALL_CATEGORIES = ['default', 'important_i', 'important_ii', 'critical'];
const MFG_ROLES: CraRole[] = ['manufacturer', 'open_source_steward'];
const IMP_ROLES: CraRole[] = ['importer'];
const DIST_ROLES: CraRole[] = ['distributor'];

export const OBLIGATIONS: ObligationDef[] = [
  // ═══════════════════════════════════════════════════════════
  // Manufacturer obligations (Art. 13, 14, 16, 20, 32, Annexes)
  // ═══════════════════════════════════════════════════════════
  { key: 'art_13', article: 'Art. 13', title: 'Obligations of Manufacturers', description: 'Ensure products are designed and developed in accordance with essential cybersecurity requirements.', appliesTo: ALL_CATEGORIES, appliesToRoles: MFG_ROLES },
  { key: 'art_13_6', article: 'Art. 13(6)', title: 'Vulnerability Handling', description: 'Identify and document vulnerabilities, provide security updates for at least 5 years.', appliesTo: ALL_CATEGORIES, appliesToRoles: MFG_ROLES },
  { key: 'art_13_11', article: 'Art. 13(11)', title: 'SBOM (Software Bill of Materials)', description: 'Identify and document components contained in the product, including an SBOM in machine-readable format.', appliesTo: ALL_CATEGORIES, appliesToRoles: MFG_ROLES },
  { key: 'art_13_12', article: 'Art. 13(12)', title: 'Technical Documentation', description: 'Draw up technical documentation before placing the product on the market.', appliesTo: ALL_CATEGORIES, appliesToRoles: MFG_ROLES },
  { key: 'art_13_14', article: 'Art. 13(14)', title: 'Conformity Assessment', description: 'Carry out a conformity assessment of the product.', appliesTo: ALL_CATEGORIES, appliesToRoles: MFG_ROLES },
  { key: 'art_13_15', article: 'Art. 13(15)', title: 'EU Declaration of Conformity', description: 'Draw up the EU declaration of conformity and affix the CE marking.', appliesTo: ALL_CATEGORIES, appliesToRoles: MFG_ROLES },
  { key: 'art_14', article: 'Art. 14', title: 'Vulnerability Reporting', description: 'Report actively exploited vulnerabilities and severe incidents to ENISA within 24 hours.', appliesTo: ALL_CATEGORIES, appliesToRoles: MFG_ROLES },
  { key: 'annex_i_part_i', article: 'Annex I, Part I', title: 'Security by Design', description: 'Products shall be designed and developed with appropriate level of cybersecurity based on risks.', appliesTo: ALL_CATEGORIES, appliesToRoles: MFG_ROLES },
  { key: 'annex_i_part_ii', article: 'Annex I, Part II', title: 'Vulnerability Handling Requirements', description: 'Implement vulnerability handling processes including coordinated disclosure policy.', appliesTo: ALL_CATEGORIES, appliesToRoles: MFG_ROLES },
  { key: 'art_32', article: 'Art. 32', title: 'Harmonised Standards', description: 'Where harmonised standards exist, conformity assessment shall reference them.', appliesTo: ['important_i', 'important_ii', 'critical'], appliesToRoles: MFG_ROLES },
  { key: 'art_32_3', article: 'Art. 32(3)', title: 'Third-Party Assessment', description: 'Critical products require third-party conformity assessment by a notified body.', appliesTo: ['important_ii', 'critical'], appliesToRoles: MFG_ROLES },
  { key: 'art_13_3', article: 'Art. 13(3)', title: 'Component Currency', description: 'Ensure all software components integrated in the product are free of known exploitable vulnerabilities and kept up to date throughout the support period.', appliesTo: ALL_CATEGORIES, appliesToRoles: MFG_ROLES },
  { key: 'art_13_5', article: 'Art. 13(5)', title: 'No Known Exploitable Vulnerabilities at Market Placement', description: 'Products shall be placed on the market without any known exploitable vulnerabilities. Conduct a vulnerability assessment before market placement and remediate findings.', appliesTo: ALL_CATEGORIES, appliesToRoles: MFG_ROLES },
  { key: 'art_13_7', article: 'Art. 13(7)', title: 'Automatic Security Updates', description: 'Put in place a policy ensuring that security updates are automatically made available to users where technically feasible, for the duration of the support period.', appliesTo: ALL_CATEGORIES, appliesToRoles: MFG_ROLES },
  { key: 'art_13_8', article: 'Art. 13(8)', title: 'Security Patches Free of Charge', description: 'Security patches and updates shall be provided to users at no additional charge for the full duration of the support period.', appliesTo: ALL_CATEGORIES, appliesToRoles: MFG_ROLES },
  { key: 'art_13_9', article: 'Art. 13(9)', title: 'Security Updates Separate from Feature Updates', description: 'Security updates shall be distributed and clearly identified separately from feature updates, allowing users to apply security fixes promptly and independently.', appliesTo: ALL_CATEGORIES, appliesToRoles: MFG_ROLES },
  { key: 'art_13_10', article: 'Art. 13(10)', title: 'Documentation Retention (10 Years)', description: 'Technical documentation and the EU declaration of conformity shall be retained for at least 10 years after the product is placed on the market, or for the support period if longer.', appliesTo: ALL_CATEGORIES, appliesToRoles: MFG_ROLES },
  { key: 'art_16', article: 'Art. 16', title: 'EU Declaration of Conformity (Annex IV)', description: 'Draw up an EU Declaration of Conformity meeting the Annex IV content requirements: manufacturer name and address, product identification, applicable standards, place and date of issue, and authorised signatory.', appliesTo: ALL_CATEGORIES, appliesToRoles: MFG_ROLES },
  { key: 'art_20', article: 'Art. 20', title: 'EU Market Surveillance Registration', description: 'Critical products with digital elements require notification of the relevant market surveillance authority and additional registration steps before being placed on the EU market.', appliesTo: ['critical'], appliesToRoles: MFG_ROLES },

  // ═══════════════════════════════════════════════════════════
  // Importer obligations (Art. 18)
  // ═══════════════════════════════════════════════════════════
  { key: 'art_18_1', article: 'Art. 18(1)', title: 'Verify Manufacturer Conformity', description: 'Only place products on the market where the manufacturer has carried out the appropriate conformity assessment procedure, drawn up the technical documentation, and the product bears the CE marking.', appliesTo: ALL_CATEGORIES, appliesToRoles: IMP_ROLES },
  { key: 'art_18_2', article: 'Art. 18(2)', title: 'Verify CE Marking and Documentation', description: 'Verify that the product bears the required CE marking, is accompanied by the EU declaration of conformity and required documentation, and that the manufacturer has complied with Art. 13(15) and (16).', appliesTo: ALL_CATEGORIES, appliesToRoles: IMP_ROLES },
  { key: 'art_18_3', article: 'Art. 18(3)', title: 'Manufacturer Contact Details', description: 'Record and maintain the name, registered trade name or trademark, postal address, email address, and website of the manufacturer. Ensure this information is available to market surveillance authorities on request.', appliesTo: ALL_CATEGORIES, appliesToRoles: IMP_ROLES },
  { key: 'art_18_4', article: 'Art. 18(4)', title: 'Product Storage and Transport', description: 'Ensure that while a product is under the importer\'s responsibility, storage or transport conditions do not jeopardise its compliance with the essential cybersecurity requirements.', appliesTo: ALL_CATEGORIES, appliesToRoles: IMP_ROLES },
  { key: 'art_18_5', article: 'Art. 18(5)', title: 'Report Non-Conformity to Manufacturer', description: 'Where the importer considers or has reason to believe that a product is not in conformity with the essential requirements, the importer shall not place the product on the market until it has been brought into conformity. The importer shall inform the manufacturer and market surveillance authorities.', appliesTo: ALL_CATEGORIES, appliesToRoles: IMP_ROLES },
  { key: 'art_18_6', article: 'Art. 18(6)', title: 'Importer Identification on Product', description: 'Indicate the importer\'s name, registered trade name or trademark, and postal address on the product or its packaging, or in a document accompanying the product.', appliesTo: ALL_CATEGORIES, appliesToRoles: IMP_ROLES },
  { key: 'art_18_7', article: 'Art. 18(7)', title: 'Vulnerability Reporting to ENISA (Importer)', description: 'Upon becoming aware of an actively exploited vulnerability or a severe incident, inform the manufacturer without undue delay. Report to ENISA within the same timelines as Art. 14 (24/72 hours).', appliesTo: ALL_CATEGORIES, appliesToRoles: IMP_ROLES },
  { key: 'art_18_8', article: 'Art. 18(8)', title: 'Retain Documentation (Importer)', description: 'Keep a copy of the EU declaration of conformity at the disposal of market surveillance authorities for at least 10 years after the product has been placed on the market. Ensure the technical documentation can be made available on request.', appliesTo: ALL_CATEGORIES, appliesToRoles: IMP_ROLES },
  { key: 'art_18_9', article: 'Art. 18(9)', title: 'Cooperate with Market Surveillance (Importer)', description: 'Provide market surveillance authorities, on reasoned request, with all information and documentation necessary to demonstrate the conformity of the product. Cooperate with authorities on actions to eliminate risks.', appliesTo: ALL_CATEGORIES, appliesToRoles: IMP_ROLES },
  { key: 'art_18_10', article: 'Art. 18(10)', title: 'Verify Technical Documentation Accessible', description: 'Ensure the technical documentation drawn up by the manufacturer pursuant to Art. 31 is available and can be provided to market surveillance authorities upon request.', appliesTo: ALL_CATEGORIES, appliesToRoles: IMP_ROLES },

  // ═══════════════════════════════════════════════════════════
  // Distributor obligations (Art. 19)
  // ═══════════════════════════════════════════════════════════
  { key: 'art_19_1', article: 'Art. 19(1)', title: 'Verify Documentation and Markings', description: 'Before making a product available on the market, verify that the manufacturer has affixed the CE marking, provided the EU declaration of conformity and required documentation, and that the importer (where applicable) has complied with Art. 18(6).', appliesTo: ALL_CATEGORIES, appliesToRoles: DIST_ROLES },
  { key: 'art_19_2', article: 'Art. 19(2)', title: 'Product Handling Conditions', description: 'Ensure that while a product is under the distributor\'s responsibility, storage or transport conditions do not jeopardise its compliance with the essential cybersecurity requirements.', appliesTo: ALL_CATEGORIES, appliesToRoles: DIST_ROLES },
  { key: 'art_19_3', article: 'Art. 19(3)', title: 'Report Non-Conformity (Distributor)', description: 'Where the distributor considers or has reason to believe that a product is not in conformity, the distributor shall not make the product available on the market until it has been brought into conformity. The distributor shall inform the manufacturer or importer and market surveillance authorities.', appliesTo: ALL_CATEGORIES, appliesToRoles: DIST_ROLES },
  { key: 'art_19_4', article: 'Art. 19(4)', title: 'Vulnerability Reporting to ENISA (Distributor)', description: 'Upon becoming aware of an actively exploited vulnerability or a severe incident, inform the manufacturer or importer without undue delay. Report to ENISA within the same timelines as Art. 14 (24/72 hours).', appliesTo: ALL_CATEGORIES, appliesToRoles: DIST_ROLES },
  { key: 'art_19_5', article: 'Art. 19(5)', title: 'Cooperate with Market Surveillance (Distributor)', description: 'Provide market surveillance authorities, on reasoned request, with all information and documentation necessary to demonstrate the conformity of the product. Cooperate with authorities on actions to eliminate risks.', appliesTo: ALL_CATEGORIES, appliesToRoles: DIST_ROLES },
  { key: 'art_19_6', article: 'Art. 19(6)', title: 'Retain Documentation (Distributor)', description: 'Keep records of products made available on the market, including supplier and customer details, for at least 10 years. Ensure non-confidential parts of the technical documentation can be made available on request.', appliesTo: ALL_CATEGORIES, appliesToRoles: DIST_ROLES },
];

export const STATUS_ORDER: Record<string, number> = { 'not_started': 0, 'in_progress': 1, 'met': 2 };

export function higherStatus(a: string, b: string | null): string {
  if (!b) return a;
  return (STATUS_ORDER[a] ?? 0) >= (STATUS_ORDER[b] ?? 0) ? a : b;
}

/**
 * Returns obligations applicable to a given CRA product category and org role.
 * Backward-compatible: if craRole is omitted, defaults to 'manufacturer'.
 */
export function getApplicableObligations(craCategory: string | null, craRole?: CraRole | string | null): ObligationDef[] {
  const known = ['default', 'important_i', 'important_ii', 'critical'];
  const cat = (craCategory && known.includes(craCategory)) ? craCategory : 'default';
  const role = (craRole && ['manufacturer', 'importer', 'distributor', 'open_source_steward'].includes(craRole))
    ? craRole as CraRole
    : 'manufacturer';
  return OBLIGATIONS.filter(o => o.appliesTo.includes(cat) && o.appliesToRoles.includes(role));
}

export async function ensureObligations(orgId: string, productId: string, craCategory: string | null, craRole?: CraRole | string | null): Promise<void> {
  const applicable = getApplicableObligations(craCategory, craRole);
  if (applicable.length === 0) return;
  const placeholders = applicable.map((_, i) => `($1, $2, $${i + 3})`).join(', ');
  const params: any[] = [orgId, productId, ...applicable.map(ob => ob.key)];
  await pool.query(
    `INSERT INTO obligations (org_id, product_id, obligation_key) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
    params
  );
}

/**
 * Batch version: ensure obligations for multiple products in a single INSERT.
 * Replaces the per-product loop pattern that caused N sequential round-trips.
 * Chunks into batches of up to 500 rows to stay within Postgres parameter limits.
 */
export async function ensureObligationsBatch(
  orgId: string,
  products: { id: string; craCategory: string | null }[],
  craRole?: CraRole | string | null
): Promise<void> {
  if (products.length === 0) return;

  // Build all (product_id, obligation_key) pairs
  const allRows: [string, string][] = [];
  for (const p of products) {
    const applicable = getApplicableObligations(p.craCategory, craRole);
    for (const ob of applicable) {
      allRows.push([p.id, ob.key]);
    }
  }
  if (allRows.length === 0) return;

  // Process in chunks of 500 rows (1001 params each, well within Postgres 65535 limit)
  const CHUNK_SIZE = 500;
  for (let offset = 0; offset < allRows.length; offset += CHUNK_SIZE) {
    const chunk = allRows.slice(offset, offset + CHUNK_SIZE);
    const params: any[] = [orgId];
    const valueClauses: string[] = [];
    for (const [productId, key] of chunk) {
      const pIdx = params.push(productId);
      const kIdx = params.push(key);
      valueClauses.push(`($1, $${pIdx}, $${kIdx})`);
    }
    await pool.query(
      `INSERT INTO obligations (org_id, product_id, obligation_key) VALUES ${valueClauses.join(', ')} ON CONFLICT DO NOTHING`,
      params
    );
  }
}

// Computes obligation statuses inferred from existing platform data.
// Returns: productId → obligationKey → { status, reason }
export async function computeDerivedStatuses(
  productIds: string[],
  orgId: string,
  categoryMap: Record<string, string | null>,
  craRole?: CraRole | string | null
): Promise<Record<string, Record<string, { status: string; reason: string }>>> {
  if (productIds.length === 0) return {};

  const role = (craRole && ['manufacturer', 'importer', 'distributor', 'open_source_steward'].includes(craRole))
    ? craRole as CraRole
    : 'manufacturer';

  // ─── Data queries (shared across roles) ────────────────────

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

  // 4. Technical file sections (status + key content fields + support period end date)
  const techFileResult = await pool.query(
    `SELECT product_id, section_key, status,
            content->>'disclosure_policy_url' AS cvd_url,
            content->>'notified_body' AS notified_body,
            CASE WHEN section_key = 'support_period'
                 THEN content->'fields'->>'end_date' ELSE NULL END AS support_end_date
     FROM technical_file_sections WHERE product_id = ANY($1)`,
    [productIds]
  );
  const techFileByProduct: Record<string, Record<string, { status: string; cvdUrl: string | null; notifiedBody: string | null; supportEndDate?: string | null }>> = {};
  for (const row of techFileResult.rows) {
    if (!techFileByProduct[row.product_id]) techFileByProduct[row.product_id] = {};
    techFileByProduct[row.product_id][row.section_key] = {
      status: row.status,
      cvdUrl: row.cvd_url || null,
      notifiedBody: row.notified_body || null,
      ...(row.support_end_date ? { supportEndDate: row.support_end_date } : {}),
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

  // 6. Crypto scan results
  const cryptoResult = await pool.query(
    `SELECT product_id, broken_count, quantum_vulnerable_count, quantum_safe_count
     FROM crypto_scans WHERE product_id = ANY($1)`,
    [productIds]
  );
  const cryptoByProduct: Record<string, { broken: number; qv: number; qs: number }> = {};
  for (const row of cryptoResult.rows) {
    cryptoByProduct[row.product_id] = {
      broken: parseInt(row.broken_count, 10),
      qv: parseInt(row.quantum_vulnerable_count, 10),
      qs: parseInt(row.quantum_safe_count, 10),
    };
  }

  // 7. Field issues (post-market monitoring)
  const fieldIssueResult = await pool.query(
    `SELECT product_id, status, severity, COUNT(*) AS cnt
     FROM field_issues WHERE product_id = ANY($1) AND org_id = $2
     GROUP BY product_id, status, severity`,
    [productIds, orgId]
  );
  const fieldIssuesByProduct: Record<string, { total: number; open: number; critical: number; resolved: number }> = {};
  for (const row of fieldIssueResult.rows) {
    const cnt = parseInt(row.cnt, 10);
    if (!fieldIssuesByProduct[row.product_id]) fieldIssuesByProduct[row.product_id] = { total: 0, open: 0, critical: 0, resolved: 0 };
    fieldIssuesByProduct[row.product_id].total += cnt;
    if (row.status === 'open' || row.status === 'investigating') fieldIssuesByProduct[row.product_id].open += cnt;
    if (row.severity === 'critical') fieldIssuesByProduct[row.product_id].critical += cnt;
    if (row.status === 'resolved' || row.status === 'closed') fieldIssuesByProduct[row.product_id].resolved += cnt;
  }

  // 8. Corrective actions
  const correctiveResult = await pool.query(
    `SELECT product_id, status, COUNT(*) AS cnt
     FROM corrective_actions WHERE product_id = ANY($1) AND org_id = $2
     GROUP BY product_id, status`,
    [productIds, orgId]
  );
  const correctiveByProduct: Record<string, { total: number; completed: number; planned: number }> = {};
  for (const row of correctiveResult.rows) {
    const cnt = parseInt(row.cnt, 10);
    if (!correctiveByProduct[row.product_id]) correctiveByProduct[row.product_id] = { total: 0, completed: 0, planned: 0 };
    correctiveByProduct[row.product_id].total += cnt;
    if (row.status === 'completed' || row.status === 'verified') correctiveByProduct[row.product_id].completed += cnt;
    if (row.status === 'planned') correctiveByProduct[row.product_id].planned += cnt;
  }

  // 9. Notified body assessments
  const nbAssessmentResult = await pool.query(
    `SELECT product_id, status FROM notified_body_assessments
     WHERE product_id = ANY($1) AND org_id = $2`,
    [productIds, orgId]
  );
  const nbAssessmentByProduct: Record<string, string> = {};
  for (const row of nbAssessmentResult.rows) {
    nbAssessmentByProduct[row.product_id] = row.status;
  }

  // ─── Compute derived statuses per product ──────────────────
  const result: Record<string, Record<string, { status: string; reason: string }>> = {};

  for (const productId of productIds) {
    const derived: Record<string, { status: string; reason: string }> = {};
    const sections = techFileByProduct[productId] ?? {};
    const ALL_SECTION_KEYS = ['product_description', 'design_development', 'vulnerability_handling', 'risk_assessment', 'support_period', 'standards_applied', 'test_reports', 'declaration_of_conformity'];

    if (role === 'manufacturer' || role === 'open_source_steward') {
      // ─── Manufacturer / OSS steward derivations ──────────────

      // art_13_11 – SBOM
      const sbom = sbomByProduct[productId];
      if (sbom) {
        if (!sbom.isStale && sbom.packageCount > 0) {
          derived['art_13_11'] = { status: 'met', reason: `SBOM current (${sbom.packageCount} packages)` };
        } else {
          derived['art_13_11'] = { status: 'in_progress', reason: `SBOM present${sbom.isStale ? ', update pending' : ''} (${sbom.packageCount} packages)` };
        }
      }

      // art_13_6 – Vulnerability Handling (scans + field issues)
      const scanCount = scanCountByProduct[productId] ?? 0;
      const openFindings = openFindingsByProduct[productId] ?? 0;
      const fieldIssues = fieldIssuesByProduct[productId];
      if (scanCount > 0) {
        const openFieldCount = fieldIssues?.open ?? 0;
        if (openFindings === 0 && openFieldCount === 0) {
          derived['art_13_6'] = { status: 'met', reason: 'Vulnerability scanning active, no open findings or field issues' };
        } else {
          const parts: string[] = [];
          if (openFindings > 0) parts.push(`${openFindings} open vulnerability finding${openFindings !== 1 ? 's' : ''}`);
          if (openFieldCount > 0) parts.push(`${openFieldCount} open field issue${openFieldCount !== 1 ? 's' : ''}`);
          derived['art_13_6'] = { status: 'in_progress', reason: `Vulnerability scanning active, ${parts.join(', ')}` };
        }
      } else if (fieldIssues && fieldIssues.open > 0) {
        derived['art_13_6'] = { status: 'in_progress', reason: `${fieldIssues.open} open field issue${fieldIssues.open !== 1 ? 's' : ''} require attention` };
      }

      // art_13_12 – Technical Documentation
      const sectionStatuses = ALL_SECTION_KEYS.map(k => sections[k]?.status ?? 'not_started');
      const completedCount = sectionStatuses.filter(s => s === 'completed').length;
      const startedCount = sectionStatuses.filter(s => s !== 'not_started').length;
      if (completedCount === ALL_SECTION_KEYS.length) {
        derived['art_13_12'] = { status: 'met', reason: 'Technical file complete (8/8 sections)' };
      } else if (startedCount > 0) {
        derived['art_13_12'] = { status: 'in_progress', reason: `Technical file ${completedCount}/8 sections complete` };
      }

      // art_13_14 – Conformity Assessment (test_reports section)
      const testReports = sections['test_reports'];
      if (testReports?.status === 'completed') {
        derived['art_13_14'] = { status: 'met', reason: 'Test reports section complete' };
      } else if (testReports?.status === 'in_progress') {
        derived['art_13_14'] = { status: 'in_progress', reason: 'Test reports section in progress' };
      }

      // art_13_15 – EU Declaration of Conformity
      const docSection = sections['declaration_of_conformity'];
      if (docSection?.status === 'completed') {
        derived['art_13_15'] = { status: 'met', reason: 'Declaration of Conformity section complete' };
      } else if (docSection?.status === 'in_progress') {
        derived['art_13_15'] = { status: 'in_progress', reason: 'Declaration of Conformity section in progress' };
      }

      // annex_i_part_i – Security by Design (risk_assessment section + crypto posture)
      const riskSection = sections['risk_assessment'];
      const cryptoForDesign = cryptoByProduct[productId];
      if (riskSection?.status === 'completed') {
        if (cryptoForDesign && cryptoForDesign.broken > 0) {
          derived['annex_i_part_i'] = { status: 'in_progress', reason: `Risk assessment complete but ${cryptoForDesign.broken} broken cryptographic algorithm${cryptoForDesign.broken !== 1 ? 's' : ''} detected (Annex I §3 requires state-of-the-art cryptography)` };
        } else {
          derived['annex_i_part_i'] = { status: 'met', reason: 'Risk assessment complete' + (cryptoForDesign ? '; cryptographic posture verified' : '') };
        }
      } else if (riskSection?.status === 'in_progress') {
        derived['annex_i_part_i'] = { status: 'in_progress', reason: 'Risk assessment in progress' };
      } else if (cryptoForDesign && cryptoForDesign.broken > 0) {
        derived['annex_i_part_i'] = { status: 'in_progress', reason: `Crypto scan detected ${cryptoForDesign.broken} broken algorithm${cryptoForDesign.broken !== 1 ? 's' : ''} — risk assessment and remediation needed (Annex I §3)` };
      }

      // annex_i_part_ii – Vulnerability Handling Requirements (CVD policy)
      const vulnHandling = sections['vulnerability_handling'];
      if (vulnHandling?.status === 'completed') {
        derived['annex_i_part_ii'] = { status: 'met', reason: 'Vulnerability handling section complete' };
      } else if (vulnHandling?.cvdUrl) {
        derived['annex_i_part_ii'] = { status: 'in_progress', reason: 'CVD policy URL documented' };
      } else if (vulnHandling?.status === 'in_progress') {
        derived['annex_i_part_ii'] = { status: 'in_progress', reason: 'Vulnerability handling section in progress' };
      }

      // art_32 – Harmonised Standards
      const standardsSection = sections['standards_applied'];
      if (standardsSection?.status === 'completed') {
        derived['art_32'] = { status: 'met', reason: 'Standards section complete' };
      } else if (standardsSection?.status === 'in_progress') {
        derived['art_32'] = { status: 'in_progress', reason: 'Standards section in progress' };
      }

      // art_32_3 – Third-Party Assessment (notified body assessment tracking + DoC reference)
      const nbStatus = nbAssessmentByProduct[productId];
      if (nbStatus === 'approved') {
        derived['art_32_3'] = { status: 'met', reason: 'Notified body assessment approved' };
      } else if (nbStatus === 'submitted' || nbStatus === 'under_review' || nbStatus === 'additional_info_requested') {
        derived['art_32_3'] = { status: 'in_progress', reason: `Assessment ${nbStatus.replace(/_/g, ' ')}` };
      } else if (nbStatus === 'planning') {
        derived['art_32_3'] = { status: 'in_progress', reason: 'Assessment planning in progress' };
      } else {
        // Fallback: check DoC for notified body reference
        const docSectionForNB = sections['declaration_of_conformity'];
        if (docSectionForNB?.notifiedBody) {
          derived['art_32_3'] = { status: docSectionForNB.status === 'completed' ? 'met' : 'in_progress', reason: 'Notified body referenced in DoC' };
        }
      }

      // art_14 – Vulnerability Reporting (ENISA reports)
      const reports = craReportsByProduct[productId] ?? [];
      if (reports.length > 0) {
        const hasFinal = reports.some(s => s === 'final_report_sent' || s === 'closed');
        derived['art_14'] = { status: hasFinal ? 'met' : 'in_progress', reason: hasFinal ? 'ENISA report submitted' : 'ENISA report in progress' };
      }

      // art_13_3 – Component Currency (SBOM + crypto scan)
      const sbomForCurrency = sbomByProduct[productId];
      const crypto = cryptoByProduct[productId];
      if (sbomForCurrency && crypto) {
        if (crypto.broken > 0) {
          derived['art_13_3'] = { status: 'in_progress', reason: `Component inventory tracked (${sbomForCurrency.packageCount} packages). Crypto scan: ${crypto.broken} broken algorithm${crypto.broken !== 1 ? 's' : ''} require remediation` };
        } else if (crypto.qv > 0) {
          derived['art_13_3'] = { status: 'in_progress', reason: `Component inventory tracked (${sbomForCurrency.packageCount} packages). Crypto scan: ${crypto.qv} quantum-vulnerable algorithm${crypto.qv !== 1 ? 's' : ''}, PQC migration recommended` };
        } else {
          derived['art_13_3'] = { status: 'met', reason: `Component inventory tracked (${sbomForCurrency.packageCount} packages). Crypto scan: all algorithms quantum-safe` };
        }
      } else if (sbomForCurrency) {
        derived['art_13_3'] = { status: 'in_progress', reason: `Component inventory tracked via SBOM (${sbomForCurrency.packageCount} packages). Crypto scan not yet run` };
      } else if (crypto) {
        derived['art_13_3'] = { status: 'in_progress', reason: `Crypto scan complete (${crypto.broken} broken, ${crypto.qv} quantum-vulnerable). SBOM not yet available` };
      }

      // art_13_7 / art_13_8 – Support period awareness
      const spSection = sections['support_period'];
      const supportEndDate = spSection?.supportEndDate;
      if (spSection?.status === 'completed' && supportEndDate) {
        const endDate = new Date(supportEndDate);
        if (!isNaN(endDate.getTime())) {
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          endDate.setHours(0, 0, 0, 0);
          if (endDate < now) {
            derived['art_13_7'] = { status: 'met', reason: 'Support period ended. Obligation discharged' };
            derived['art_13_8'] = { status: 'met', reason: 'Support period ended. Obligation discharged' };
          } else {
            const formattedEnd = supportEndDate.slice(0, 10);
            derived['art_13_7'] = { status: 'in_progress', reason: `Support active until ${formattedEnd}, automatic updates required` };
            derived['art_13_8'] = { status: 'in_progress', reason: `Support active until ${formattedEnd}, free patches required` };
          }
        }
      }

      // art_13_5 – No Known Exploitable Vulnerabilities at Market Placement
      const scanCountForVuln = scanCountByProduct[productId] ?? 0;
      const openFindingsForVuln = openFindingsByProduct[productId] ?? 0;
      if (scanCountForVuln > 0) {
        if (openFindingsForVuln === 0) {
          derived['art_13_5'] = { status: 'met', reason: 'Vulnerability scanning active, no open findings' };
        } else {
          derived['art_13_5'] = { status: 'in_progress', reason: `Vulnerability scanning active, ${openFindingsForVuln} open finding${openFindingsForVuln !== 1 ? 's' : ''} require remediation` };
        }
      }

      // art_13_9 – Security Updates Separate from Feature Updates (corrective action tracking)
      const corrective = correctiveByProduct[productId];
      const fieldIssueData = fieldIssuesByProduct[productId];
      if (corrective && corrective.total > 0) {
        if (fieldIssueData && fieldIssueData.open > 0 && corrective.planned > 0) {
          derived['art_13_9'] = { status: 'in_progress', reason: `${corrective.planned} corrective action${corrective.planned !== 1 ? 's' : ''} planned for ${fieldIssueData.open} open field issue${fieldIssueData.open !== 1 ? 's' : ''}` };
        } else if (corrective.completed === corrective.total) {
          derived['art_13_9'] = { status: 'met', reason: `All ${corrective.total} corrective action${corrective.total !== 1 ? 's' : ''} completed` };
        } else {
          derived['art_13_9'] = { status: 'in_progress', reason: `${corrective.completed}/${corrective.total} corrective action${corrective.total !== 1 ? 's' : ''} completed` };
        }
      } else if (fieldIssueData && fieldIssueData.open > 0) {
        derived['art_13_9'] = { status: 'in_progress', reason: `${fieldIssueData.open} open field issue${fieldIssueData.open !== 1 ? 's' : ''} — corrective actions needed` };
      }

      // art_16 – EU Declaration of Conformity content (Annex IV)
      const docSectionForAnnex = sections['declaration_of_conformity'];
      if (docSectionForAnnex?.status === 'completed') {
        derived['art_16'] = { status: 'met', reason: 'EU Declaration of Conformity complete (Annex IV)' };
      } else if (docSectionForAnnex?.status === 'in_progress') {
        derived['art_16'] = { status: 'in_progress', reason: 'EU Declaration of Conformity in progress' };
      }

      // art_20 – EU Market Surveillance Registration (critical products only)
      if (categoryMap[productId] === 'critical') {
        derived['art_20'] = { status: 'in_progress', reason: 'Critical product: EU market surveillance registration required' };
      }

      // art_13 – Overall (derived from all others)
      const others = Object.entries(derived).filter(([k]) => k !== 'art_13');
      if (others.length > 0) {
        const metCount = others.filter(([, v]) => v.status === 'met').length;
        const allMet = metCount === others.length;
        derived['art_13'] = {
          status: allMet ? 'met' : 'in_progress',
          reason: `${metCount}/${others.length} obligations met`,
        };
      }

    } else if (role === 'importer') {
      // ─── Importer derivations (Art. 18) ──────────────────────

      // art_18_1 – Verify Manufacturer Conformity
      // Derived from: DoC section exists and is completed (implies manufacturer did assessment)
      const docSection = sections['declaration_of_conformity'];
      if (docSection?.status === 'completed') {
        derived['art_18_1'] = { status: 'met', reason: 'EU Declaration of Conformity verified and complete' };
      } else if (docSection?.status === 'in_progress') {
        derived['art_18_1'] = { status: 'in_progress', reason: 'EU Declaration of Conformity verification in progress' };
      }

      // art_18_2 – Verify CE Marking and Documentation
      // Derived from: DoC section + product description section
      const productDesc = sections['product_description'];
      if (docSection?.status === 'completed' && productDesc?.status === 'completed') {
        derived['art_18_2'] = { status: 'met', reason: 'CE marking and documentation verified' };
      } else if (docSection || productDesc) {
        derived['art_18_2'] = { status: 'in_progress', reason: 'CE marking and documentation verification in progress' };
      }

      // art_18_7 – Vulnerability Reporting to ENISA (same as manufacturer Art. 14)
      const reports = craReportsByProduct[productId] ?? [];
      if (reports.length > 0) {
        const hasFinal = reports.some(s => s === 'final_report_sent' || s === 'closed');
        derived['art_18_7'] = { status: hasFinal ? 'met' : 'in_progress', reason: hasFinal ? 'ENISA report submitted' : 'ENISA report in progress' };
      }

      // art_18_8 – Retain Documentation (10 years)
      // Derived from: technical file sections exist
      const sectionStatuses = ALL_SECTION_KEYS.map(k => sections[k]?.status ?? 'not_started');
      const startedCount = sectionStatuses.filter(s => s !== 'not_started').length;
      if (startedCount > 0) {
        const completedCount = sectionStatuses.filter(s => s === 'completed').length;
        derived['art_18_8'] = {
          status: completedCount === ALL_SECTION_KEYS.length ? 'met' : 'in_progress',
          reason: `Documentation retained (${completedCount}/${ALL_SECTION_KEYS.length} sections complete)`,
        };
      }

      // art_18_10 – Verify Technical Documentation Accessible
      if (startedCount > 0) {
        derived['art_18_10'] = { status: 'in_progress', reason: `Technical documentation partially available (${startedCount}/${ALL_SECTION_KEYS.length} sections started)` };
        const completedCount = sectionStatuses.filter(s => s === 'completed').length;
        if (completedCount === ALL_SECTION_KEYS.length) {
          derived['art_18_10'] = { status: 'met', reason: 'Technical documentation fully available' };
        }
      }

    } else if (role === 'distributor') {
      // ─── Distributor derivations (Art. 19) ───────────────────

      // art_19_1 – Verify Documentation and Markings
      const docSection = sections['declaration_of_conformity'];
      const productDesc = sections['product_description'];
      if (docSection?.status === 'completed' && productDesc?.status === 'completed') {
        derived['art_19_1'] = { status: 'met', reason: 'CE marking and documentation verified' };
      } else if (docSection || productDesc) {
        derived['art_19_1'] = { status: 'in_progress', reason: 'Documentation and marking verification in progress' };
      }

      // art_19_4 – Vulnerability Reporting to ENISA
      const reports = craReportsByProduct[productId] ?? [];
      if (reports.length > 0) {
        const hasFinal = reports.some(s => s === 'final_report_sent' || s === 'closed');
        derived['art_19_4'] = { status: hasFinal ? 'met' : 'in_progress', reason: hasFinal ? 'ENISA report submitted' : 'ENISA report in progress' };
      }

      // art_19_6 – Retain Documentation (10 years)
      const sectionStatuses = ALL_SECTION_KEYS.map(k => sections[k]?.status ?? 'not_started');
      const startedCount = sectionStatuses.filter(s => s !== 'not_started').length;
      if (startedCount > 0) {
        const completedCount = sectionStatuses.filter(s => s === 'completed').length;
        derived['art_19_6'] = {
          status: completedCount === ALL_SECTION_KEYS.length ? 'met' : 'in_progress',
          reason: `Documentation retained (${completedCount}/${ALL_SECTION_KEYS.length} sections complete)`,
        };
      }
    }

    result[productId] = derived;
  }

  return result;
}

export function enrichObligation(row: any, derived?: { status: string; reason: string } | null) {
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

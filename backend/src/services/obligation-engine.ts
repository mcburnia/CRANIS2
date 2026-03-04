/**
 * Obligation Engine — shared obligation definitions and derived-status computation.
 *
 * Extracted from routes/obligations.ts so that dashboard.ts (and other consumers)
 * can compute CRA readiness without duplicating logic.
 */

import pool from '../db/pool.js';

// ─── Obligation definitions ──────────────────────────────────
export const OBLIGATIONS = [
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

export const STATUS_ORDER: Record<string, number> = { 'not_started': 0, 'in_progress': 1, 'met': 2 };

export function higherStatus(a: string, b: string | null): string {
  if (!b) return a;
  return (STATUS_ORDER[a] ?? 0) >= (STATUS_ORDER[b] ?? 0) ? a : b;
}

export function getApplicableObligations(craCategory: string | null): typeof OBLIGATIONS {
  const known = ['default', 'important_i', 'important_ii', 'critical'];
  const cat = (craCategory && known.includes(craCategory)) ? craCategory : 'default';
  return OBLIGATIONS.filter(o => o.appliesTo.includes(cat));
}

export async function ensureObligations(orgId: string, productId: string, craCategory: string | null): Promise<void> {
  const applicable = getApplicableObligations(craCategory);
  if (applicable.length === 0) return;
  const placeholders = applicable.map((_, i) => `($1, $2, $${i + 3})`).join(', ');
  const params: any[] = [orgId, productId, ...applicable.map(ob => ob.key)];
  await pool.query(
    `INSERT INTO obligations (org_id, product_id, obligation_key) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
    params
  );
}

// Computes obligation statuses inferred from existing platform data.
// Returns: productId → obligationKey → { status, reason }
export async function computeDerivedStatuses(
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

    // art_13_3 — Component Currency
    if (sbom) {
      derived['art_13_3'] = { status: 'in_progress', reason: `Component inventory tracked via SBOM (${sbom.packageCount} packages)` };
    }

    // art_13_7 / art_13_8 — Support period awareness
    const spSection = sections['support_period'];
    const supportEndDate = spSection?.supportEndDate;
    if (spSection?.status === 'completed' && supportEndDate) {
      const endDate = new Date(supportEndDate);
      if (!isNaN(endDate.getTime())) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        if (endDate < now) {
          derived['art_13_7'] = { status: 'met', reason: 'Support period ended — obligation discharged' };
          derived['art_13_8'] = { status: 'met', reason: 'Support period ended — obligation discharged' };
        } else {
          const formattedEnd = supportEndDate.slice(0, 10);
          derived['art_13_7'] = { status: 'in_progress', reason: `Support active until ${formattedEnd} — automatic updates required` };
          derived['art_13_8'] = { status: 'in_progress', reason: `Support active until ${formattedEnd} — free patches required` };
        }
      }
    }

    // art_13_5 — No Known Exploitable Vulnerabilities at Market Placement
    if (scanCount > 0) {
      if (openFindings === 0) {
        derived['art_13_5'] = { status: 'met', reason: 'Vulnerability scanning active — no open findings' };
      } else {
        derived['art_13_5'] = { status: 'in_progress', reason: `Vulnerability scanning active — ${openFindings} open finding${openFindings !== 1 ? 's' : ''} require remediation` };
      }
    }

    // art_16 — EU Declaration of Conformity content (Annex IV)
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

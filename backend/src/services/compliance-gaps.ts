/**
 * Compliance Gap Narrator Service
 * Deterministic gap analysis – gathers all compliance state for a product
 * and generates a prioritised action list showing what needs to be done next.
 *
 * No AI dependency – every gap maps to a specific CRA article and action.
 */

import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import {
  OBLIGATIONS,
  getApplicableObligations,
  computeDerivedStatuses,
  higherStatus,
} from './obligation-engine.js';

// ── Types ──

export type GapPriority = 'critical' | 'high' | 'medium' | 'low';

export type GapCategory =
  | 'vulnerabilities'
  | 'obligations'
  | 'technical_file'
  | 'sbom'
  | 'supply_chain'
  | 'stakeholders'
  | 'support_period';

export interface ComplianceGap {
  id: string;
  priority: GapPriority;
  category: GapCategory;
  title: string;
  description: string;
  action: string;
  craReference: string;
  /** Tab or path the user should navigate to */
  actionTab?: string;
  actionPath?: string;
}

export interface ComplianceGapResult {
  productId: string;
  productName: string;
  craCategory: string;
  generatedAt: string;
  gaps: ComplianceGap[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  progress: {
    obligationsMet: number;
    obligationsTotal: number;
    techFileSections: number;
    techFileTotal: number;
    openVulns: number;
    hasSbom: boolean;
    sbomStale: boolean;
  };
}

// ── Gap analysis ──

const ALL_SECTION_KEYS = [
  'product_description', 'design_development', 'vulnerability_handling',
  'risk_assessment', 'support_period', 'standards_applied',
  'test_reports', 'declaration_of_conformity',
];

const SECTION_LABELS: Record<string, string> = {
  product_description: 'Product Description',
  design_development: 'Design & Development',
  vulnerability_handling: 'Vulnerability Handling',
  risk_assessment: 'Risk Assessment',
  support_period: 'Support Period',
  standards_applied: 'Standards Applied',
  test_reports: 'Test Reports',
  declaration_of_conformity: 'Declaration of Conformity',
};

const SECTION_CRA_REFS: Record<string, string> = {
  product_description: 'Annex VII §1',
  design_development: 'Annex VII §2a',
  vulnerability_handling: 'Annex VII §2b',
  risk_assessment: 'Annex VII §3',
  support_period: 'Annex VII §4',
  standards_applied: 'Annex VII §5',
  test_reports: 'Annex VII §6',
  declaration_of_conformity: 'Annex VII §7',
};

export async function analyseComplianceGaps(
  productId: string,
  orgId: string
): Promise<ComplianceGapResult | null> {
  // 1. Get product from Neo4j
  const neo4jSession = getDriver().session();
  let productName: string;
  let craCategory: string;

  try {
    const result = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p.name AS name, p.craCategory AS craCategory`,
      { orgId, productId }
    );
    if (result.records.length === 0) return null;
    productName = result.records[0].get('name') || productId;
    craCategory = result.records[0].get('craCategory') || 'default';
  } finally {
    await neo4jSession.close();
  }

  // 2. Gather all data in parallel
  const [
    obligationsResult,
    techFileResult,
    sbomResult,
    vulnFindingsResult,
    scanCountResult,
    stakeholderResult,
  ] = await Promise.all([
    pool.query(
      `SELECT obligation_key, status, notes FROM obligations WHERE product_id = $1 AND org_id = $2`,
      [productId, orgId]
    ),
    pool.query(
      `SELECT section_key, status,
              CASE WHEN section_key = 'support_period'
                   THEN content->'fields'->>'end_date' ELSE NULL END AS support_end_date
       FROM technical_file_sections WHERE product_id = $1`,
      [productId]
    ),
    pool.query(
      `SELECT package_count, is_stale, synced_at FROM product_sboms WHERE product_id = $1`,
      [productId]
    ),
    pool.query(
      `SELECT severity, COUNT(*)::int AS count
       FROM vulnerability_findings
       WHERE product_id = $1 AND org_id = $2 AND status IN ('open', 'acknowledged')
       GROUP BY severity`,
      [productId, orgId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS scan_count
       FROM vulnerability_scans
       WHERE product_id = $1 AND status = 'completed'`,
      [productId]
    ),
    pool.query(
      `SELECT role_key, email FROM stakeholders
       WHERE org_id = $1 AND role_key IN ('manufacturer_contact', 'security_contact')
       AND (product_id IS NULL OR product_id = $2)`,
      [orgId, productId]
    ),
  ]);

  // 3. Parse data
  const manualStatuses: Record<string, string> = {};
  for (const row of obligationsResult.rows) {
    manualStatuses[row.obligation_key] = row.status;
  }

  const techSections: Record<string, { status: string; supportEndDate?: string }> = {};
  for (const row of techFileResult.rows) {
    techSections[row.section_key] = {
      status: row.status,
      ...(row.support_end_date ? { supportEndDate: row.support_end_date } : {}),
    };
  }

  const hasSbom = sbomResult.rows.length > 0;
  const sbomStale = sbomResult.rows[0]?.is_stale === true;
  const sbomPackageCount = sbomResult.rows[0]?.package_count ? parseInt(sbomResult.rows[0].package_count, 10) : 0;

  const vulnCounts: Record<string, number> = {};
  let totalOpenVulns = 0;
  for (const row of vulnFindingsResult.rows) {
    vulnCounts[row.severity] = row.count;
    totalOpenVulns += row.count;
  }

  const scanCount = scanCountResult.rows[0]?.scan_count ?? 0;

  const stakeholderEmails: Record<string, string> = {};
  for (const row of stakeholderResult.rows) {
    if (row.email && row.email.trim()) stakeholderEmails[row.role_key] = row.email;
  }

  // 4. Compute derived statuses
  const categoryMap = { [productId]: craCategory };
  const derivedMap = await computeDerivedStatuses([productId], orgId, categoryMap);
  const derived = derivedMap[productId] ?? {};

  // 5. Compute effective obligation statuses
  const applicable = getApplicableObligations(craCategory);
  let obligationsMet = 0;

  for (const ob of applicable) {
    const manual = manualStatuses[ob.key] || 'not_started';
    const derivedStatus = derived[ob.key]?.status || null;
    const effective = higherStatus(manual, derivedStatus);
    if (effective === 'met') obligationsMet++;
  }

  // 6. Count tech file progress
  const techFileCompleted = ALL_SECTION_KEYS.filter(k => techSections[k]?.status === 'completed').length;

  // 7. Generate gaps
  const gaps: ComplianceGap[] = [];
  let gapIndex = 1;

  // ── CRITICAL: Open critical/high vulns ──
  const criticalVulns = vulnCounts['critical'] || 0;
  const highVulns = vulnCounts['high'] || 0;

  if (criticalVulns > 0) {
    gaps.push({
      id: `gap-${gapIndex++}`,
      priority: 'critical',
      category: 'vulnerabilities',
      title: `${criticalVulns} critical vulnerability finding${criticalVulns > 1 ? 's' : ''} open`,
      description: `Your product has ${criticalVulns} critical severity vulnerability finding${criticalVulns > 1 ? 's' : ''} that must be remediated before market placement. CRA Art. 13(5) prohibits placing products with known exploitable vulnerabilities on the market.`,
      action: 'Triage and remediate critical vulnerabilities immediately',
      craReference: 'Art. 13(5)',
      actionTab: 'risk-findings',
    });
  }

  if (highVulns > 0) {
    gaps.push({
      id: `gap-${gapIndex++}`,
      priority: 'critical',
      category: 'vulnerabilities',
      title: `${highVulns} high severity vulnerability finding${highVulns > 1 ? 's' : ''} open`,
      description: `${highVulns} high severity finding${highVulns > 1 ? 's' : ''} require prompt attention. These represent significant security risks under CRA Art. 13(5).`,
      action: 'Triage and remediate high severity vulnerabilities',
      craReference: 'Art. 13(5)',
      actionTab: 'risk-findings',
    });
  }

  // ── HIGH: No vulnerability scan run ──
  if (scanCount === 0) {
    gaps.push({
      id: `gap-${gapIndex++}`,
      priority: 'high',
      category: 'vulnerabilities',
      title: 'No vulnerability scan has been run',
      description: 'CRA Art. 13(6) requires continuous vulnerability identification. Connect a repository and sync to trigger an initial scan.',
      action: 'Connect a repository and run a vulnerability scan',
      craReference: 'Art. 13(6)',
      actionTab: 'overview',
    });
  } else if (totalOpenVulns > 0 && criticalVulns === 0 && highVulns === 0) {
    const medLow = totalOpenVulns;
    gaps.push({
      id: `gap-${gapIndex++}`,
      priority: 'medium',
      category: 'vulnerabilities',
      title: `${medLow} medium/low severity finding${medLow > 1 ? 's' : ''} open`,
      description: `${medLow} vulnerability finding${medLow > 1 ? 's' : ''} of medium or low severity remain open. While not immediately blocking, these should be triaged and addressed.`,
      action: 'Review and triage remaining vulnerability findings',
      craReference: 'Art. 13(6)',
      actionTab: 'risk-findings',
    });
  }

  // ── HIGH: No SBOM ──
  if (!hasSbom) {
    gaps.push({
      id: `gap-${gapIndex++}`,
      priority: 'high',
      category: 'sbom',
      title: 'No Software Bill of Materials (SBOM)',
      description: 'CRA Art. 13(11) requires an SBOM identifying all components in the product. Connect a repository to generate one automatically.',
      action: 'Connect a repository and sync to generate an SBOM',
      craReference: 'Art. 13(11)',
      actionTab: 'dependencies',
    });
  } else if (sbomStale) {
    gaps.push({
      id: `gap-${gapIndex++}`,
      priority: 'medium',
      category: 'sbom',
      title: 'SBOM is stale – update required',
      description: `The SBOM (${sbomPackageCount} packages) has not been refreshed recently. Re-sync the repository to ensure the component inventory is current.`,
      action: 'Re-sync repository to refresh the SBOM',
      craReference: 'Art. 13(11)',
      actionTab: 'dependencies',
    });
  }

  // ── HIGH: Incomplete tech file sections ──
  for (const sectionKey of ALL_SECTION_KEYS) {
    const section = techSections[sectionKey];
    const status = section?.status ?? 'not_started';

    if (status === 'completed') continue;

    const label = SECTION_LABELS[sectionKey] || sectionKey;
    const craRef = SECTION_CRA_REFS[sectionKey] || 'Annex VII';

    // Risk assessment and vulnerability handling are higher priority
    const isCoreSecurity = ['risk_assessment', 'vulnerability_handling'].includes(sectionKey);
    const priority: GapPriority = status === 'not_started'
      ? (isCoreSecurity ? 'high' : 'medium')
      : 'low';

    gaps.push({
      id: `gap-${gapIndex++}`,
      priority,
      category: 'technical_file',
      title: `Technical file: "${label}" ${status === 'not_started' ? 'not started' : 'incomplete'}`,
      description: `The ${label} section of your technical file is ${status === 'not_started' ? 'not yet started' : 'in progress but incomplete'}. This is required under ${craRef} of the CRA technical documentation requirements.`,
      action: status === 'not_started'
        ? `Begin the "${label}" section in the Technical File tab`
        : `Complete the "${label}" section in the Technical File tab`,
      craReference: craRef,
      actionTab: 'technical-file',
    });
  }

  // ── HIGH: Missing stakeholder contacts ──
  if (!stakeholderEmails['manufacturer_contact']) {
    gaps.push({
      id: `gap-${gapIndex++}`,
      priority: 'high',
      category: 'stakeholders',
      title: 'No manufacturer contact set',
      description: 'CRA Art. 13(15) requires a manufacturer contact to be identified in the EU Declaration of Conformity. Set this in the Stakeholders page.',
      action: 'Set a manufacturer contact email',
      craReference: 'Art. 13(15)',
      actionPath: '/stakeholders',
    });
  }

  if (!stakeholderEmails['security_contact']) {
    gaps.push({
      id: `gap-${gapIndex++}`,
      priority: 'high',
      category: 'stakeholders',
      title: 'No security contact set',
      description: 'A security contact is needed to receive vulnerability reports and coordinate with ENISA under CRA Art. 14. Set this in the Stakeholders page.',
      action: 'Set a security contact email',
      craReference: 'Art. 14',
      actionPath: '/stakeholders',
    });
  }

  // ── MEDIUM: Support period not defined ──
  const spSection = techSections['support_period'];
  if (!spSection?.supportEndDate && spSection?.status !== 'completed') {
    gaps.push({
      id: `gap-${gapIndex++}`,
      priority: 'medium',
      category: 'support_period',
      title: 'Support period end date not defined',
      description: 'CRA Art. 13(8) requires a defined support period during which security patches must be provided free of charge. Set this in the Technical File.',
      action: 'Define the support period end date in the Technical File',
      craReference: 'Art. 13(8)',
      actionTab: 'technical-file',
    });
  }

  // ── MEDIUM: Unmet obligations (not already covered by specific gaps above) ──
  const coveredObligations = new Set([
    'art_13_11', // SBOM – covered above
    'art_13_6',  // Vuln handling – covered by scan gaps
    'art_13_5',  // No known vulns – covered by vuln gaps
    'art_13_12', // Tech doc – covered by section gaps
    'art_13_7',  // Auto updates – covered by support period
    'art_13_8',  // Free patches – covered by support period
    'art_13',    // Overall – skip, it's an aggregate
  ]);

  for (const ob of applicable) {
    if (coveredObligations.has(ob.key)) continue;

    const manual = manualStatuses[ob.key] || 'not_started';
    const derivedStatus = derived[ob.key]?.status || null;
    const effective = higherStatus(manual, derivedStatus);

    if (effective === 'met') continue;

    gaps.push({
      id: `gap-${gapIndex++}`,
      priority: effective === 'not_started' ? 'medium' : 'low',
      category: 'obligations',
      title: `${ob.article}: ${ob.title} – ${effective === 'not_started' ? 'not started' : 'in progress'}`,
      description: ob.description,
      action: effective === 'not_started'
        ? `Begin work on ${ob.article} (${ob.title})`
        : `Complete ${ob.article} (${ob.title})`,
      craReference: ob.article,
      actionTab: 'obligations',
    });
  }

  // 8. Sort by priority
  const priorityOrder: Record<GapPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  gaps.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // 9. Build summary
  const summary = {
    total: gaps.length,
    critical: gaps.filter(g => g.priority === 'critical').length,
    high: gaps.filter(g => g.priority === 'high').length,
    medium: gaps.filter(g => g.priority === 'medium').length,
    low: gaps.filter(g => g.priority === 'low').length,
  };

  return {
    productId,
    productName,
    craCategory,
    generatedAt: new Date().toISOString(),
    gaps,
    summary,
    progress: {
      obligationsMet,
      obligationsTotal: applicable.length,
      techFileSections: techFileCompleted,
      techFileTotal: ALL_SECTION_KEYS.length,
      openVulns: totalOpenVulns,
      hasSbom,
      sbomStale,
    },
  };
}

/**
 * Supply Chain Risk Scoring Service
 *
 * Computes a per-product supply chain risk score from existing platform data:
 * SBOM dependencies (Neo4j), vulnerability findings (Postgres), licence scan
 * results, and supplier enrichment data. No new tables — purely computed.
 *
 * Score: 0–100 (higher = healthier). Risk level: low/medium/high/critical.
 * Aligned with CRA Art. 13(5) and NIS2 Art. 21 supply chain security measures.
 */

import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';

// ─── Types ────────────────────────────────────────────────────

export interface AreaScore {
  area: string;
  label: string;
  score: number;       // 0–100
  maxScore: number;    // weight for this area
  details: string;
}

export interface RiskDependency {
  name: string;
  version: string | null;
  riskScore: number;
  flags: string[];
}

export interface SupplyChainRiskResult {
  overallScore: number;       // 0–100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  areas: AreaScore[];
  topRisks: RiskDependency[];
  stats: {
    totalDependencies: number;
    withKnownSupplier: number;
    withVulnerabilities: number;
    withCopyleftLicence: number;
    withUnknownLicence: number;
    sbomFresh: boolean;
    sbomExists: boolean;
  };
}

// ─── Copyleft detection (shared with supplier-due-diligence) ──

const COPYLEFT_LICENSES = [
  'GPL', 'GPLv2', 'GPLv3', 'GPL-2.0', 'GPL-3.0',
  'LGPL', 'LGPLv2', 'LGPLv3', 'LGPL-2.0', 'LGPL-2.1', 'LGPL-3.0',
  'AGPL', 'AGPLv3', 'AGPL-3.0',
  'MPL', 'MPL-2.0',
  'EUPL', 'EUPL-1.1', 'EUPL-1.2',
  'CPAL', 'CPAL-1.0',
  'OSL', 'OSL-3.0',
];

function isCopyleft(licence: string | null): boolean {
  if (!licence) return false;
  const upper = licence.toUpperCase().replace(/-ONLY|-OR-LATER/g, '');
  return COPYLEFT_LICENSES.some(cl => upper.includes(cl.toUpperCase()));
}

// ─── Main scoring function ────────────────────────────────────

export async function computeSupplyChainRisk(
  productId: string,
  orgId: string
): Promise<SupplyChainRiskResult> {
  // 1. Fetch dependencies from Neo4j
  const neo4jSession = getDriver().session();
  let deps: Array<{
    name: string;
    version: string | null;
    licence: string | null;
    supplier: string | null;
  }> = [];

  try {
    const result = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})-[:DEPENDS_ON]->(d:Dependency)
       RETURN d.name AS name, d.version AS version, d.license AS licence, d.supplier AS supplier`,
      { orgId, productId }
    );
    deps = result.records.map(r => ({
      name: r.get('name'),
      version: r.get('version') || null,
      licence: r.get('licence') || null,
      supplier: r.get('supplier') || null,
    }));
  } finally {
    await neo4jSession.close();
  }

  // 2. Fetch vulnerability findings
  const vulnResult = await pool.query(
    `SELECT dependency_name, severity, COUNT(*) AS cnt
     FROM vulnerability_findings
     WHERE product_id = $1 AND org_id = $2 AND status IN ('open', 'acknowledged')
     GROUP BY dependency_name, severity`,
    [productId, orgId]
  );

  const vulnMap = new Map<string, { critical: number; high: number; medium: number; low: number }>();
  for (const row of vulnResult.rows) {
    if (!vulnMap.has(row.dependency_name)) {
      vulnMap.set(row.dependency_name, { critical: 0, high: 0, medium: 0, low: 0 });
    }
    const entry = vulnMap.get(row.dependency_name)!;
    const sev = row.severity as string;
    if (sev === 'critical') entry.critical += parseInt(row.cnt);
    else if (sev === 'high') entry.high += parseInt(row.cnt);
    else if (sev === 'medium') entry.medium += parseInt(row.cnt);
    else entry.low += parseInt(row.cnt);
  }

  // 3. Fetch SBOM metadata
  const sbomResult = await pool.query(
    `SELECT package_count, is_stale FROM product_sboms WHERE product_id = $1 ORDER BY synced_at DESC LIMIT 1`,
    [productId]
  );
  const sbomExists = sbomResult.rows.length > 0;
  const sbomFresh = sbomExists && !sbomResult.rows[0].is_stale;

  // 4. Compute stats
  const totalDeps = deps.length;
  const withSupplier = deps.filter(d => d.supplier && d.supplier.trim().length > 0).length;
  const withVulns = deps.filter(d => vulnMap.has(d.name)).length;
  const withCopyleft = deps.filter(d => isCopyleft(d.licence)).length;
  const withUnknownLicence = deps.filter(d => !d.licence || d.licence.trim() === '').length;

  // Handle empty dependency case
  if (totalDeps === 0) {
    return {
      overallScore: sbomExists ? 50 : 0,
      riskLevel: sbomExists ? 'medium' : 'critical',
      areas: [
        { area: 'sbom', label: 'SBOM Health', score: sbomExists ? (sbomFresh ? 100 : 50) : 0, maxScore: 20, details: sbomExists ? (sbomFresh ? 'SBOM present and fresh' : 'SBOM present but stale') : 'No SBOM found' },
        { area: 'vulnerabilities', label: 'Vulnerability Exposure', score: 100, maxScore: 30, details: 'No dependencies to assess' },
        { area: 'licence', label: 'Licence Risk', score: 100, maxScore: 20, details: 'No dependencies to assess' },
        { area: 'supplier', label: 'Supplier Coverage', score: 0, maxScore: 20, details: 'No dependencies to assess' },
        { area: 'concentration', label: 'Concentration Risk', score: 100, maxScore: 10, details: 'No dependencies' },
      ],
      topRisks: [],
      stats: { totalDependencies: 0, withKnownSupplier: 0, withVulnerabilities: 0, withCopyleftLicence: 0, withUnknownLicence: 0, sbomFresh, sbomExists },
    };
  }

  // ── Area 1: SBOM Health (20 points) ──
  let sbomScore: number;
  let sbomDetails: string;
  if (!sbomExists) {
    sbomScore = 0;
    sbomDetails = 'No SBOM found — dependency visibility is limited';
  } else if (!sbomFresh) {
    sbomScore = 50;
    sbomDetails = 'SBOM present but stale — resync recommended';
  } else {
    sbomScore = 100;
    sbomDetails = `SBOM fresh with ${totalDeps} dependencies tracked`;
  }

  // ── Area 2: Vulnerability Exposure (30 points) ──
  let totalCritical = 0, totalHigh = 0, totalMedium = 0;
  for (const v of vulnMap.values()) {
    totalCritical += v.critical;
    totalHigh += v.high;
    totalMedium += v.medium;
  }
  let vulnScore: number;
  let vulnDetails: string;
  if (totalCritical > 0) {
    vulnScore = 0;
    vulnDetails = `${totalCritical} critical + ${totalHigh} high vulnerabilities across ${withVulns} dependencies`;
  } else if (totalHigh > 0) {
    vulnScore = 30;
    vulnDetails = `${totalHigh} high vulnerabilities across ${withVulns} dependencies`;
  } else if (totalMedium > 0) {
    vulnScore = 70;
    vulnDetails = `${totalMedium} medium vulnerabilities across ${withVulns} dependencies`;
  } else if (withVulns > 0) {
    vulnScore = 85;
    vulnDetails = `${withVulns} dependencies with low-severity findings only`;
  } else {
    vulnScore = 100;
    vulnDetails = 'No open vulnerabilities detected';
  }

  // ── Area 3: Licence Risk (20 points) ──
  const copyleftPct = totalDeps > 0 ? (withCopyleft / totalDeps) * 100 : 0;
  const unknownLicPct = totalDeps > 0 ? (withUnknownLicence / totalDeps) * 100 : 0;
  let licenceScore: number;
  let licenceDetails: string;
  if (unknownLicPct > 20) {
    licenceScore = 20;
    licenceDetails = `${withUnknownLicence} dependencies (${Math.round(unknownLicPct)}%) have no declared licence`;
  } else if (copyleftPct > 10) {
    licenceScore = 40;
    licenceDetails = `${withCopyleft} copyleft-licensed dependencies (${Math.round(copyleftPct)}%) — review distribution obligations`;
  } else if (withCopyleft > 0 || withUnknownLicence > 0) {
    licenceScore = 70;
    licenceDetails = `${withCopyleft} copyleft, ${withUnknownLicence} unknown licence${withUnknownLicence !== 1 ? 's' : ''}`;
  } else {
    licenceScore = 100;
    licenceDetails = 'All dependencies have permissive licences';
  }

  // ── Area 4: Supplier Coverage (20 points) ──
  const supplierPct = totalDeps > 0 ? (withSupplier / totalDeps) * 100 : 0;
  let supplierScore: number;
  let supplierDetails: string;
  if (supplierPct >= 80) {
    supplierScore = 100;
    supplierDetails = `${withSupplier}/${totalDeps} dependencies (${Math.round(supplierPct)}%) have identified suppliers`;
  } else if (supplierPct >= 50) {
    supplierScore = 60;
    supplierDetails = `${withSupplier}/${totalDeps} dependencies (${Math.round(supplierPct)}%) have identified suppliers — enrichment recommended`;
  } else {
    supplierScore = 20;
    supplierDetails = `Only ${withSupplier}/${totalDeps} dependencies (${Math.round(supplierPct)}%) have identified suppliers`;
  }

  // ── Area 5: Concentration Risk (10 points) ──
  // Single-maintainer = supplier field contains only one name (no commas, no "and")
  const singleMaintainer = deps.filter(d => {
    if (!d.supplier) return false;
    const s = d.supplier.trim();
    return s.length > 0 && !s.includes(',') && !s.includes(' and ') && !s.includes(' & ');
  }).length;
  const singlePct = withSupplier > 0 ? (singleMaintainer / withSupplier) * 100 : 0;
  let concentrationScore: number;
  let concentrationDetails: string;
  if (singlePct > 80) {
    concentrationScore = 30;
    concentrationDetails = `${Math.round(singlePct)}% of suppliers appear to be single maintainers — bus factor risk`;
  } else if (singlePct > 50) {
    concentrationScore = 60;
    concentrationDetails = `${Math.round(singlePct)}% of suppliers appear to be single maintainers`;
  } else {
    concentrationScore = 100;
    concentrationDetails = 'Supplier diversity is healthy';
  }

  // ── Overall score (weighted) ──
  const areas: AreaScore[] = [
    { area: 'sbom', label: 'SBOM Health', score: sbomScore, maxScore: 20, details: sbomDetails },
    { area: 'vulnerabilities', label: 'Vulnerability Exposure', score: vulnScore, maxScore: 30, details: vulnDetails },
    { area: 'licence', label: 'Licence Risk', score: licenceScore, maxScore: 20, details: licenceDetails },
    { area: 'supplier', label: 'Supplier Coverage', score: supplierScore, maxScore: 20, details: supplierDetails },
    { area: 'concentration', label: 'Concentration Risk', score: concentrationScore, maxScore: 10, details: concentrationDetails },
  ];

  const overallScore = Math.round(
    areas.reduce((sum, a) => sum + (a.score / 100) * a.maxScore, 0)
  );

  const riskLevel: 'low' | 'medium' | 'high' | 'critical' =
    overallScore >= 75 ? 'low' :
    overallScore >= 50 ? 'medium' :
    overallScore >= 25 ? 'high' : 'critical';

  // ── Top risk dependencies ──
  const topRisks: RiskDependency[] = deps.map(d => {
    const flags: string[] = [];
    let depRisk = 0;

    const vulns = vulnMap.get(d.name);
    if (vulns) {
      if (vulns.critical > 0) { flags.push(`${vulns.critical} critical vuln${vulns.critical !== 1 ? 's' : ''}`); depRisk += 40; }
      if (vulns.high > 0) { flags.push(`${vulns.high} high vuln${vulns.high !== 1 ? 's' : ''}`); depRisk += 25; }
      if (vulns.medium > 0) { depRisk += 10; }
    }
    if (isCopyleft(d.licence)) { flags.push('Copyleft licence'); depRisk += 15; }
    if (!d.licence || d.licence.trim() === '') { flags.push('No licence declared'); depRisk += 10; }
    if (!d.supplier || d.supplier.trim() === '') { flags.push('Unknown supplier'); depRisk += 10; }

    return { name: d.name, version: d.version, riskScore: Math.min(depRisk, 100), flags };
  })
    .filter(d => d.flags.length > 0)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 10);

  return {
    overallScore,
    riskLevel,
    areas,
    topRisks,
    stats: {
      totalDependencies: totalDeps,
      withKnownSupplier: withSupplier,
      withVulnerabilities: withVulns,
      withCopyleftLicence: withCopyleft,
      withUnknownLicence: withUnknownLicence,
      sbomFresh,
      sbomExists,
    },
  };
}

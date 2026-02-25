import { checkCompatibility, type DistributionModel, type CompatibilityResult } from './license-compatibility.js';
import pool from '../db/pool.js';
import neo4j from 'neo4j-driver';
import { createNotification } from './notifications.js';

// SPDX license classification maps

const PERMISSIVE_LICENSES = new Set([
  'MIT', 'ISC', 'BSD-2-Clause', 'BSD-2-Clause-Views', 'BSD-3-Clause', 'Apache-2.0',
  'Unlicense', '0BSD', 'CC0-1.0', 'CC-BY-4.0', 'CC-BY-3.0',
  'Artistic-2.0', 'Zlib', 'BSL-1.0', 'PSF-2.0', 'Python-2.0',
  'BlueOak-1.0.0', 'MIT-0', 'W3C', 'X11', 'Fair'
]);

const COPYLEFT_STRONG = new Set([
  'GPL-2.0', 'GPL-2.0-only', 'GPL-2.0-or-later', 'GPL-2.0+',
  'GPL-3.0', 'GPL-3.0-only', 'GPL-3.0-or-later', 'GPL-3.0+',
  'AGPL-3.0', 'AGPL-3.0-only', 'AGPL-3.0-or-later',
  'SSPL-1.0', 'EUPL-1.2', 'OSL-3.0', 'CPAL-1.0'
]);

const COPYLEFT_WEAK = new Set([
  'LGPL-2.1', 'LGPL-2.1-only', 'LGPL-2.1-or-later', 'LGPL-2.1+',
  'LGPL-3.0', 'LGPL-3.0-only', 'LGPL-3.0-or-later', 'LGPL-3.0+',
  'MPL-2.0', 'EPL-1.0', 'EPL-2.0', 'CDDL-1.0', 'CPL-1.0',
  'IPL-1.0', 'MS-RL'
]);

interface LicenseClassification {
  category: 'permissive' | 'copyleft_strong' | 'copyleft_weak' | 'unknown' | 'no_assertion';
  riskLevel: 'ok' | 'warning' | 'critical';
  reason: string;
}

/**
 * Classify a single SPDX license identifier
 */
function classifySingleLicense(licenseId: string): LicenseClassification {
  const id = licenseId.trim();

  if (!id || id === 'NOASSERTION' || id === 'NONE') {
    return {
      category: 'no_assertion',
      riskLevel: 'warning',
      reason: 'No license declared — unknown legal obligations'
    };
  }

  if (COPYLEFT_STRONG.has(id)) {
    return {
      category: 'copyleft_strong',
      riskLevel: 'critical',
      reason: `${id} requires source code disclosure — incompatible with proprietary distribution`
    };
  }

  if (COPYLEFT_WEAK.has(id)) {
    return {
      category: 'copyleft_weak',
      riskLevel: 'warning',
      reason: `${id} has weak copyleft terms — modifications to this library must be shared`
    };
  }

  if (PERMISSIVE_LICENSES.has(id)) {
    return {
      category: 'permissive',
      riskLevel: 'ok',
      reason: `${id} is permissive — no distribution restrictions`
    };
  }

  return {
    category: 'unknown',
    riskLevel: 'warning',
    reason: `${id} is not in known license database — manual review recommended`
  };
}

/**
 * Classify an SPDX license expression (may contain OR/AND operators)
 * Strategy: if ANY component is copyleft strong → critical
 *           if any component is copyleft weak → warning
 *           if all permissive → ok
 *           if any unknown → warning
 */
export function classifyLicense(spdxExpression: string | null | undefined): LicenseClassification {
  if (!spdxExpression || spdxExpression.trim() === '' || spdxExpression === 'NOASSERTION' || spdxExpression === 'NONE') {
    return {
      category: 'no_assertion',
      riskLevel: 'warning',
      reason: 'No license declared — unknown legal obligations'
    };
  }

  // Extract individual license IDs from expression (strip AND/OR/WITH/parens)
  const cleaned = spdxExpression
    .replace(/\(/g, ' ')
    .replace(/\)/g, ' ')
    .replace(/\bAND\b/gi, ' ')
    .replace(/\bOR\b/gi, ' ')
    .replace(/\bWITH\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const licenseIds = cleaned.split(' ').filter(id => id.length > 0 && id !== '+');

  if (licenseIds.length === 0) {
    return { category: 'unknown', riskLevel: 'warning', reason: 'Could not parse license expression' };
  }

  // Classify each component
  const classifications = licenseIds.map(id => classifySingleLicense(id));

  // Find worst category
  const hasStrongCopyleft = classifications.some(c => c.category === 'copyleft_strong');
  const hasWeakCopyleft = classifications.some(c => c.category === 'copyleft_weak');
  const hasUnknown = classifications.some(c => c.category === 'unknown');
  const hasNoAssertion = classifications.some(c => c.category === 'no_assertion');

  if (hasStrongCopyleft) {
    const copyleftIds = licenseIds.filter((_, i) => classifications[i].category === 'copyleft_strong');
    return {
      category: 'copyleft_strong',
      riskLevel: 'critical',
      reason: `Contains strong copyleft: ${copyleftIds.join(', ')} — requires source disclosure`
    };
  }

  if (hasWeakCopyleft) {
    const weakIds = licenseIds.filter((_, i) => classifications[i].category === 'copyleft_weak');
    return {
      category: 'copyleft_weak',
      riskLevel: 'warning',
      reason: `Contains weak copyleft: ${weakIds.join(', ')} — modifications must be shared`
    };
  }

  if (hasUnknown) {
    const unknownIds = licenseIds.filter((_, i) => classifications[i].category === 'unknown');
    return {
      category: 'unknown',
      riskLevel: 'warning',
      reason: `Unknown licenses: ${unknownIds.join(', ')} — manual review recommended`
    };
  }

  if (hasNoAssertion) {
    return {
      category: 'no_assertion',
      riskLevel: 'warning',
      reason: 'No license declared — unknown legal obligations'
    };
  }

  return {
    category: 'permissive',
    riskLevel: 'ok',
    reason: `All licenses are permissive: ${licenseIds.join(', ')}`
  };
}

const neo4jDriver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://neo4j:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'cranis2_dev_2026'
  )
);

/**
 * Scan all dependencies of a product and classify their licenses
 */
export async function scanProductLicenses(
  productId: string,
  orgId: string,
  triggeredBy?: string
): Promise<{ scanId: string; totalDeps: number; criticalCount: number }> {
  const startTime = Date.now();

  // Create scan record
  const scanResult = await pool.query(
    `INSERT INTO license_scans (org_id, product_id, status) VALUES ($1, $2, 'running') RETURNING id`,
    [orgId, productId]
  );
  const scanId = scanResult.rows[0].id;

  try {
    // Get all dependencies from Neo4j (including depth)
    const session = neo4jDriver.session({ defaultAccessMode: neo4j.session.READ });
    let deps: Array<{ purl: string; name: string; version: string; license: string; depth: string }> = [];

    try {
      const result = await session.run(
        `MATCH (p:Product {id: $productId})-[r:DEPENDS_ON]->(d:Dependency)
         RETURN d.purl AS purl, d.name AS name, d.version AS version, d.license AS license, coalesce(r.depth, 'unknown') AS depth`,
        { productId }
      );
      deps = result.records.map(r => ({
        purl: r.get('purl') || '',
        name: r.get('name') || '',
        version: r.get('version') || '',
        license: r.get('license') || 'NOASSERTION',
        depth: r.get('depth') || 'unknown'
      }));
    } finally {
      await session.close();
    }

    // Get product's distribution model for compatibility checks
    let distributionModel: DistributionModel | null = null;
    const writeSession = neo4jDriver.session({ defaultAccessMode: neo4j.session.READ });
    try {
      const prodResult = await writeSession.run(
        `MATCH (p:Product {id: $productId}) RETURN p.distributionModel AS dm`,
        { productId }
      );
      const dm = prodResult.records[0]?.get('dm');
      if (dm) distributionModel = dm as DistributionModel;
    } finally {
      await writeSession.close();
    }

    let permissiveCount = 0;
    let copyleftCount = 0;
    let unknownCount = 0;
    let criticalCount = 0;
    let directCount = 0;
    let transitiveCount = 0;
    const newCriticalFindings: string[] = [];

    // Count direct vs transitive
    for (const dep of deps) {
      if (dep.depth === 'direct') directCount++;
      else if (dep.depth === 'transitive') transitiveCount++;
    }

    // Classify each dependency
    for (const dep of deps) {
      const classification = classifyLicense(dep.license);

      switch (classification.category) {
        case 'permissive': permissiveCount++; break;
        case 'copyleft_strong': copyleftCount++; criticalCount++; break;
        case 'copyleft_weak': copyleftCount++; break;
        case 'unknown': unknownCount++; break;
        case 'no_assertion': unknownCount++; break;
      }

      // Compute compatibility verdict
      let compatVerdict: string | null = null;
      let compatReason: string | null = null;
      if (distributionModel) {
        const compat = checkCompatibility(distributionModel, classification.category, dep.license, dep.depth);
        compatVerdict = compat.verdict;
        compatReason = compat.reason;
      }

      // Upsert finding (now includes dependency_depth and compatibility)
      const upsertResult = await pool.query(
        `INSERT INTO license_findings (
           org_id, product_id, scan_id, dependency_purl, dependency_name,
           dependency_version, license_declared, license_category, risk_level,
           risk_reason, dependency_depth, compatibility_verdict, compatibility_reason,
           status, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'open', NOW())
         ON CONFLICT (product_id, dependency_purl) DO UPDATE SET
           scan_id = $3,
           dependency_version = $6,
           license_declared = $7,
           license_category = $8,
           risk_level = $9,
           risk_reason = $10,
           dependency_depth = $11,
           compatibility_verdict = $12,
           compatibility_reason = $13,
           updated_at = NOW()
         RETURNING (xmax = 0) AS is_new`,
        [
          orgId, productId, scanId, dep.purl, dep.name,
          dep.version, dep.license, classification.category,
          classification.riskLevel, classification.reason, dep.depth,
          compatVerdict, compatReason
        ]
      );

      // Track new critical findings for notifications
      if (classification.riskLevel === 'critical' && upsertResult.rows[0]?.is_new) {
        newCriticalFindings.push(`${dep.name}@${dep.version} (${dep.license})`);
      }

      // Track new incompatible findings
      if (compatVerdict === 'incompatible' && upsertResult.rows[0]?.is_new) {
        newCriticalFindings.push(`${dep.name}@${dep.version} — incompatible: ${compatReason}`);
      }
    }

    // Remove findings for deps no longer in SBOM
    const currentPurls = deps.map(d => d.purl).filter(p => p);
    if (currentPurls.length > 0) {
      await pool.query(
        `DELETE FROM license_findings
         WHERE product_id = $1 AND dependency_purl != ALL($2)
         AND status = 'open'`,
        [productId, currentPurls]
      );
    }

    const durationMs = Date.now() - startTime;

    // Update scan record (now includes direct_count and transitive_count)
    await pool.query(
      `UPDATE license_scans SET
         status = 'completed', total_deps = $2, permissive_count = $3,
         copyleft_count = $4, unknown_count = $5, critical_count = $6,
         direct_count = $7, transitive_count = $8,
         completed_at = NOW(), duration_ms = $9
       WHERE id = $1`,
      [scanId, deps.length, permissiveCount, copyleftCount, unknownCount, criticalCount, directCount, transitiveCount, durationMs]
    );

    // Send notifications for new critical findings
    if (newCriticalFindings.length > 0) {
      await createNotification({
        orgId,
        type: 'license_compliance',
        severity: 'high',
        title: `${newCriticalFindings.length} critical license issue${newCriticalFindings.length > 1 ? 's' : ''} found`,
        body: `Copyleft licenses detected in dependencies:\n${newCriticalFindings.join('\n')}\n\nThese licenses may require source code disclosure.`,
        link: '/license-compliance',
        metadata: { productId, criticalCount }
      });
    }

    console.log(`[License Scanner] Product ${productId}: ${deps.length} deps scanned in ${durationMs}ms — ${directCount} direct, ${transitiveCount} transitive, ${criticalCount} critical, ${copyleftCount} copyleft, ${unknownCount} unknown`);

    return { scanId, totalDeps: deps.length, criticalCount };
  } catch (error) {
    await pool.query(
      `UPDATE license_scans SET status = 'failed', completed_at = NOW(), duration_ms = $2 WHERE id = $1`,
      [scanId, Date.now() - startTime]
    );
    console.error(`[License Scanner] Error scanning product ${productId}:`, error);
    throw error;
  }
}

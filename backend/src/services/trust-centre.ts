import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';

export interface ComplianceBadges {
  craStatus: 'not_started' | 'in_progress' | 'compliant';
  obligationsMetPct: number;
  techFilePct: number;
  productsCount: number;
  lastVulnScan: string | null;
  openVulnerabilities: number;
  licensePct: number;
}

export async function computeComplianceBadges(orgId: string): Promise<ComplianceBadges> {
  // 1. Get product IDs from Neo4j
  const driver = getDriver();
  const session = driver.session();
  let productIds: string[] = [];
  try {
    const result = await session.run(
      'MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product) RETURN p.id AS id',
      { orgId }
    );
    productIds = result.records.map(r => r.get('id'));
  } finally {
    await session.close();
  }
  const productsCount = productIds.length;

  // 2. Obligations: count met vs total
  const oblResult = await pool.query(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'met') AS met
     FROM obligations WHERE org_id = $1`,
    [orgId]
  );
  const oblTotal = parseInt(oblResult.rows[0]?.total || '0');
  const oblMet = parseInt(oblResult.rows[0]?.met || '0');
  const obligationsMetPct = oblTotal > 0 ? Math.round((oblMet / oblTotal) * 100) : 0;

  // 3. Technical file sections: % completed (keyed by product_id, not org_id)
  let tfFilled = 0;
  let tfTotal = 0;
  if (productIds.length > 0) {
    const tfResult = await pool.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE content IS NOT NULL AND content::text NOT IN ('{}', 'null', '""')) AS filled
       FROM technical_file_sections WHERE product_id = ANY($1)`,
      [productIds]
    );
    tfTotal = parseInt(tfResult.rows[0]?.total || '0');
    tfFilled = parseInt(tfResult.rows[0]?.filled || '0');
  }
  const techFilePct = tfTotal > 0 ? Math.round((tfFilled / tfTotal) * 100) : 0;

  // 4. Latest vulnerability scan date + open findings
  const vulnResult = await pool.query(
    `SELECT MAX(completed_at) AS last_scan
     FROM vulnerability_scans WHERE org_id = $1`,
    [orgId]
  );
  const lastVulnScan = vulnResult.rows[0]?.last_scan || null;

  const openVulnResult = await pool.query(
    `SELECT COUNT(*) AS cnt FROM vulnerability_findings
     WHERE org_id = $1 AND status = 'open'`,
    [orgId]
  );
  const openVulnerabilities = parseInt(openVulnResult.rows[0]?.cnt || '0');

  // 5. License scan: permissive % (uses started_at, not created_at)
  const licResult = await pool.query(
    `SELECT total_deps, permissive_count FROM license_scans
     WHERE org_id = $1 ORDER BY started_at DESC LIMIT 1`,
    [orgId]
  );
  const licTotal = licResult.rows[0]?.total_deps || 0;
  const licPermissive = licResult.rows[0]?.permissive_count || 0;
  const licensePct = licTotal > 0 ? Math.round((licPermissive / licTotal) * 100) : 0;

  // Derive CRA status
  let craStatus: ComplianceBadges['craStatus'] = 'not_started';
  if (obligationsMetPct === 100 && techFilePct === 100) {
    craStatus = 'compliant';
  } else if (oblMet > 0 || tfFilled > 0) {
    craStatus = 'in_progress';
  }

  return {
    craStatus,
    obligationsMetPct,
    techFilePct,
    productsCount,
    lastVulnScan: lastVulnScan ? new Date(lastVulnScan).toISOString() : null,
    openVulnerabilities,
    licensePct,
  };
}

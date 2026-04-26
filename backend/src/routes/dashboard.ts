import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
import {
  getApplicableObligations, ensureObligations, ensureObligationsBatch,
  computeDerivedStatuses, higherStatus, CraRole,
} from '../services/obligation-engine.js';

const router = Router();

type SupportStatus = 'active' | 'ending_soon' | 'ended' | 'not_set';

function computeSupportStatus(endDateStr: string | null): { status: SupportStatus; daysRemaining: number | null; endDate: string | null } {
  if (!endDateStr) return { status: 'not_set', daysRemaining: null, endDate: null };
  const end = new Date(endDateStr);
  if (isNaN(end.getTime())) return { status: 'not_set', daysRemaining: null, endDate: null };
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { status: 'ended', daysRemaining: days, endDate: endDateStr };
  if (days <= 90) return { status: 'ending_soon', daysRemaining: days, endDate: endDateStr };
  return { status: 'active', daysRemaining: days, endDate: endDateStr };
}

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

// GET /api/dashboard/summary
router.get('/summary', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) {
      res.status(403).json({ error: 'No organisation found' });
      return;
    }

    const driver = getDriver();
    const session = driver.session();

    let products: any[] = [];
    let totalContributors = 0;
    let craRole: CraRole = 'manufacturer';

    try {
      // Fetch org role for role-aware obligations
      const orgResult = await session.run(
        'MATCH (o:Organisation {id: $orgId}) RETURN o.craRole AS craRole',
        { orgId }
      );
      craRole = (orgResult.records[0]?.get('craRole') || 'manufacturer') as CraRole;

      const productResult = await session.run(
        `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product)
         OPTIONAL MATCH (p)-[:HAS_REPO]->(r:Repository)
         OPTIONAL MATCH (p)-[:HAS_SBOM]->(s:SBOM)
         OPTIONAL MATCH (r)-[:HAS_CONTRIBUTOR]->(c:Contributor)
         RETURN p.id AS id, p.name AS name, p.craCategory AS category,
                p.lifecycleStatus AS lifecycleStatus,
                r.fullName AS repoFullName, r IS NOT NULL AS repoConnected,
                s.packageCount AS sbomPackageCount, s.isStale AS sbomIsStale,
                count(DISTINCT c) AS contributorCount`,
        { orgId }
      );

      products = productResult.records.map(record => ({
        id: record.get('id'),
        name: record.get('name'),
        category: record.get('category') || null,
        lifecycleStatus: record.get('lifecycleStatus') || 'pre_production',
        repoConnected: record.get('repoConnected'),
        repoFullName: record.get('repoFullName') || null,
        sbomPackageCount: record.get('sbomPackageCount')?.toNumber?.() ?? record.get('sbomPackageCount') ?? 0,
        sbomIsStale: record.get('sbomIsStale') ?? false,
        contributorCount: record.get('contributorCount')?.toNumber?.() ?? record.get('contributorCount') ?? 0,
      }));

      const contribResult = await session.run(
        `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product)-[:HAS_REPO]->(r:Repository)-[:HAS_CONTRIBUTOR]->(c:Contributor)
         RETURN count(DISTINCT c) AS total`,
        { orgId }
      );
      totalContributors = contribResult.records[0]?.get('total')?.toNumber?.() ?? 0;

    } finally {
      await session.close();
    }

    const productIds = products.map(p => p.id);

    // --- Postgres: total dependencies from product_sboms.package_count ---
    // Uses the same source as the product detail page for consistency
    let totalDependencies = 0;
    if (productIds.length > 0) {
      const depResult = await pool.query(
        `SELECT COALESCE(SUM(package_count), 0) AS total FROM product_sboms WHERE product_id = ANY($1)`,
        [productIds]
      );
      totalDependencies = parseInt(depResult.rows[0]?.total) || 0;
    }

    // --- Postgres: tech file sections + support period end dates ---
    let techFileMap: Record<string, { total: number; completed: number }> = {};
    let supportEndMap: Record<string, string | null> = {};
    if (productIds.length > 0) {
      const tfResult = await pool.query(
        `SELECT product_id, section_key, status,
                CASE WHEN section_key = 'support_period'
                     THEN content->'fields'->>'end_date' ELSE NULL END AS support_end_date
         FROM technical_file_sections WHERE product_id = ANY($1)`,
        [productIds]
      );
      for (const row of tfResult.rows) {
        if (!techFileMap[row.product_id]) {
          techFileMap[row.product_id] = { total: 0, completed: 0 };
        }
        techFileMap[row.product_id].total++;
        if (row.status === 'complete') {
          techFileMap[row.product_id].completed++;
        }
        if (row.section_key === 'support_period' && row.support_end_date) {
          supportEndMap[row.product_id] = row.support_end_date;
        }
      }
    }

    // --- Postgres: last sync per product ---
    let lastSyncMap: Record<string, string> = {};
    if (productIds.length > 0) {
      const syncResult = await pool.query(
        `SELECT product_id, MAX(started_at) AS last_sync FROM sync_history WHERE product_id = ANY($1) AND status = 'success' GROUP BY product_id`,
        [productIds]
      );
      for (const row of syncResult.rows) {
        lastSyncMap[row.product_id] = row.last_sync;
      }
    }

    const enrichedProducts = products.map(p => {
      const tf = techFileMap[p.id] || { total: 8, completed: 0 };
      const progress = tf.total > 0 ? Math.round((tf.completed / tf.total) * 100) : 0;
      return {
        ...p,
        techFileProgress: progress,
        techFileSections: tf,
        lastSync: lastSyncMap[p.id] || null,
      };
    });

    const connectedRepos = products.filter(p => p.repoConnected).length;
    const staleSboms = products.filter(p => p.sbomIsStale).length;

    const activityResult = await pool.query(
      `SELECT
        e.event_type,
        e.metadata,
        e.created_at,
        COALESCE(u.email, 'system') AS user_email
      FROM user_events e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE (u.org_id = $1 OR e.user_id IS NULL)
      ORDER BY e.created_at DESC
      LIMIT 10`,
      [orgId]
    );

    const recentActivity = activityResult.rows.map(row => ({
      eventType: row.event_type,
      userEmail: row.user_email,
      createdAt: row.created_at,
      metadata: row.metadata,
    }));

    // --- Postgres: vulnerability findings summary ---
    let riskFindings = { total: 0, critical: 0, high: 0, medium: 0, low: 0, open: 0, dismissed: 0, lastScanAt: null as string | null };
    let productRiskMap: Record<string, { total: number; critical: number; high: number; open: number }> = {};
    if (productIds.length > 0) {
      const vulnResult = await pool.query(
        `SELECT product_id, severity, status, count(*) as cnt
         FROM vulnerability_findings
         WHERE org_id = $1
         GROUP BY product_id, severity, status`,
        [orgId]
      );
      for (const row of vulnResult.rows) {
        const cnt = parseInt(row.cnt);
        riskFindings.total += cnt;
        if (row.severity === 'critical') riskFindings.critical += cnt;
        if (row.severity === 'high') riskFindings.high += cnt;
        if (row.severity === 'medium') riskFindings.medium += cnt;
        if (row.severity === 'low') riskFindings.low += cnt;
        if (row.status === 'open') riskFindings.open += cnt;
        if (row.status === 'dismissed') riskFindings.dismissed += cnt;

        if (!productRiskMap[row.product_id]) productRiskMap[row.product_id] = { total: 0, critical: 0, high: 0, open: 0 };
        productRiskMap[row.product_id].total += cnt;
        if (row.severity === 'critical') productRiskMap[row.product_id].critical += cnt;
        if (row.severity === 'high') productRiskMap[row.product_id].high += cnt;
        if (row.status === 'open') productRiskMap[row.product_id].open += cnt;
      }

      const lastScanResult = await pool.query(
        `SELECT MAX(completed_at) as last_scan
         FROM vulnerability_scans
         WHERE org_id = $1 AND status = 'completed'`,
        [orgId]
      );
      riskFindings.lastScanAt = lastScanResult.rows[0]?.last_scan || null;
    }

    // --- CRA Readiness computation (obligation-based) ---
    let readinessMap: Record<string, { met: number; total: number; readiness: number }> = {};
    let overallReadiness = 0;

    if (productIds.length > 0) {
      const categoryMap: Record<string, string | null> = {};
      for (const p of products) categoryMap[p.id] = p.category;

      // Ensure obligations exist for all products (single batch INSERT)
      await ensureObligationsBatch(orgId, products.map(p => ({ id: p.id, craCategory: p.category })), craRole);

      // Fetch obligations + derived statuses in parallel
      const [obResult, derivedMap] = await Promise.all([
        pool.query(
          `SELECT product_id, obligation_key, status
           FROM obligations WHERE org_id = $1 AND product_id = ANY($2)`,
          [orgId, productIds]
        ),
        computeDerivedStatuses(productIds, orgId, categoryMap, craRole),
      ]);

      // Compute per-product readiness
      const obByProduct: Record<string, { key: string; effectiveStatus: string }[]> = {};
      for (const row of obResult.rows) {
        if (!obByProduct[row.product_id]) obByProduct[row.product_id] = [];
        const derivedStatus = derivedMap[row.product_id]?.[row.obligation_key]?.status ?? null;
        const effectiveStatus = higherStatus(row.status, derivedStatus);
        obByProduct[row.product_id].push({ key: row.obligation_key, effectiveStatus });
      }

      let totalMetAcrossOrg = 0;
      let totalObligationsAcrossOrg = 0;

      for (const p of products) {
        const obligations = obByProduct[p.id] || [];
        const applicable = getApplicableObligations(p.category, craRole);
        const total = applicable.length;
        // Numerator must share scope with the denominator: count only 'met'
        // obligations that are *applicable* to this product's role+category.
        // Otherwise non-applicable obligations marked 'met' inflate readiness
        // above 100% (e.g. importer/Default → 14/10 → 140%).
        const applicableKeys = new Set(applicable.map(a => a.key));
        const met = obligations.filter(o =>
          o.effectiveStatus === 'met' && applicableKeys.has(o.key)
        ).length;
        const readiness = total > 0 ? Math.round((met / total) * 100) : 0;
        readinessMap[p.id] = { met, total, readiness };
        totalMetAcrossOrg += met;
        totalObligationsAcrossOrg += total;
      }

      overallReadiness = totalObligationsAcrossOrg > 0
        ? Math.round((totalMetAcrossOrg / totalObligationsAcrossOrg) * 100)
        : 0;
    }

    // Crypto posture per product
    let cryptoPostureMap: Record<string, { broken: number; quantumVulnerable: number; quantumSafe: number; scannedAt: string | null }> = {};
    if (productIds.length > 0) {
      const cryptoResult = await pool.query(
        `SELECT product_id, broken_count, quantum_vulnerable_count, quantum_safe_count, scanned_at
         FROM crypto_scans WHERE product_id = ANY($1)`,
        [productIds]
      );
      for (const row of cryptoResult.rows) {
        cryptoPostureMap[row.product_id] = {
          broken: parseInt(row.broken_count, 10),
          quantumVulnerable: parseInt(row.quantum_vulnerable_count, 10),
          quantumSafe: parseInt(row.quantum_safe_count, 10),
          scannedAt: row.scanned_at,
        };
      }
    }

    // NB assessment status per product
    let nbAssessmentMap: Record<string, { status: string; module: string; certificateNumber: string | null }> = {};
    if (productIds.length > 0) {
      const nbResult = await pool.query(
        `SELECT product_id, status, module, certificate_number
         FROM notified_body_assessments WHERE org_id = $1 AND product_id = ANY($2)`,
        [orgId, productIds]
      );
      for (const row of nbResult.rows) {
        nbAssessmentMap[row.product_id] = {
          status: row.status,
          module: row.module,
          certificateNumber: row.certificate_number || null,
        };
      }
    }

    // MS registration status per product
    let msRegistrationMap: Record<string, { status: string; registrationNumber: string | null }> = {};
    if (productIds.length > 0) {
      const msResult = await pool.query(
        `SELECT product_id, status, registration_number
         FROM market_surveillance_registrations WHERE org_id = $1 AND product_id = ANY($2)`,
        [orgId, productIds]
      );
      for (const row of msResult.rows) {
        msRegistrationMap[row.product_id] = {
          status: row.status,
          registrationNumber: row.registration_number || null,
        };
      }
    }

    // Field issues per product
    let fieldIssueMap: Record<string, { total: number; open: number; critical: number }> = {};
    if (productIds.length > 0) {
      const fiResult = await pool.query(
        `SELECT product_id, COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status IN ('open', 'investigating')) AS open,
                COUNT(*) FILTER (WHERE severity = 'critical') AS critical
         FROM field_issues WHERE product_id = ANY($1) AND org_id = $2
         GROUP BY product_id`,
        [productIds, orgId]
      );
      for (const row of fiResult.rows) {
        fieldIssueMap[row.product_id] = {
          total: parseInt(row.total),
          open: parseInt(row.open),
          critical: parseInt(row.critical),
        };
      }
    }

    // Incidents per product
    let incidentMap: Record<string, { total: number; active: number; p1p2: number }> = {};
    if (productIds.length > 0) {
      const incResult = await pool.query(
        `SELECT product_id, COUNT(*) AS total,
                COUNT(*) FILTER (WHERE phase NOT IN ('closed')) AS active,
                COUNT(*) FILTER (WHERE severity IN ('P1', 'P2') AND phase NOT IN ('closed')) AS p1p2
         FROM incidents WHERE product_id = ANY($1) AND org_id = $2
         GROUP BY product_id`,
        [productIds, orgId]
      );
      for (const row of incResult.rows) {
        incidentMap[row.product_id] = {
          total: parseInt(row.total),
          active: parseInt(row.active),
          p1p2: parseInt(row.p1p2),
        };
      }
    }

    // Enrich products with risk + readiness + support status + crypto + field issues + incidents
    const finalProducts = enrichedProducts.map(p => ({
      ...p,
      riskFindings: productRiskMap[p.id] || { total: 0, critical: 0, high: 0, open: 0 },
      craReadiness: readinessMap[p.id] || { met: 0, total: 0, readiness: 0 },
      supportStatus: computeSupportStatus(supportEndMap[p.id] || null),
      cryptoPosture: cryptoPostureMap[p.id] || null,
      fieldIssues: fieldIssueMap[p.id] || { total: 0, open: 0, critical: 0 },
      nbAssessment: nbAssessmentMap[p.id] || null,
      msRegistration: msRegistrationMap[p.id] || null,
      incidents: incidentMap[p.id] || null,
    }));

    res.json({
      craRole,
      products: finalProducts,
      stats: {
        totalProducts: products.length,
        connectedRepos,
        totalContributors,
        totalDependencies,
        staleSboms,
      },
      riskFindings,
      recentActivity,
      overallReadiness,
    });

  } catch (err) {
    console.error('Failed to fetch dashboard summary:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

export default router;

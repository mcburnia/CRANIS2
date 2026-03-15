import { Router, Request, Response } from 'express';
import pool from '../../db/pool.js';
import { getDriver } from '../../db/neo4j.js';
import { requirePlatformAdmin } from '../../middleware/requirePlatformAdmin.js';
import { recordEvent, extractRequestData } from '../../services/telemetry.js';
import { toISOString } from './utils.js';
import {
  evaluateOrganisation, applyClassification, getClassification,
  setClassificationManually, type TrustClassification,
} from '../../services/trust-classification.js';

const router = Router();

// GET /api/admin/orgs – List all organisations with summary stats
router.get('/orgs', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const driver = getDriver();
    const session = driver.session();

    let orgs: any[] = [];
    try {
      const result = await session.run(`
        MATCH (o:Organisation)
        OPTIONAL MATCH (o)<-[:BELONGS_TO]-(p:Product)
        OPTIONAL MATCH (p)-[:HAS_REPO]->(r:Repository)
        RETURN o.id AS id, o.name AS name, o.country AS country, o.craRole AS craRole,
               o.industry AS industry, o.companySize AS companySize, o.createdAt AS createdAt,
               count(DISTINCT p) AS productCount, count(DISTINCT r) AS repoCount
      `);
      orgs = result.records.map(record => ({
        id: record.get('id'),
        name: record.get('name'),
        country: record.get('country') || null,
        craRole: record.get('craRole') || null,
        industry: record.get('industry') || null,
        companySize: record.get('companySize') || null,
        createdAt: toISOString(record.get('createdAt')),
        productCount: record.get('productCount')?.toNumber?.() ?? 0,
        repoCount: record.get('repoCount')?.toNumber?.() ?? 0,
      }));
    } finally {
      await session.close();
    }

    // Postgres: user counts per org + last activity
    const orgIds = orgs.map(o => o.id);
    let userCountMap: Record<string, number> = {};
    let lastActivityMap: Record<string, string> = {};

    if (orgIds.length > 0) {
      const userResult = await pool.query(
        `SELECT org_id, COUNT(*) AS cnt FROM users WHERE org_id = ANY($1) GROUP BY org_id`,
        [orgIds]
      );
      for (const row of userResult.rows) {
        userCountMap[row.org_id] = parseInt(row.cnt);
      }

      const activityResult = await pool.query(
        `SELECT u.org_id, MAX(e.created_at) AS last_activity
         FROM user_events e
         JOIN users u ON e.user_id = u.id
         WHERE u.org_id = ANY($1)
         GROUP BY u.org_id`,
        [orgIds]
      );
      for (const row of activityResult.rows) {
        lastActivityMap[row.org_id] = row.last_activity;
      }
    }

    // Postgres: vulnerability counts per org
    let vulnCountMap: Record<string, { total: number; critical: number; high: number; open: number }> = {};
    if (orgIds.length > 0) {
      const vulnResult = await pool.query(
        `SELECT org_id, severity, status, COUNT(*) AS cnt
         FROM vulnerability_findings
         WHERE org_id = ANY($1)
         GROUP BY org_id, severity, status`,
        [orgIds]
      );
      for (const row of vulnResult.rows) {
        if (!vulnCountMap[row.org_id]) vulnCountMap[row.org_id] = { total: 0, critical: 0, high: 0, open: 0 };
        const cnt = parseInt(row.cnt);
        vulnCountMap[row.org_id].total += cnt;
        if (row.severity === 'critical') vulnCountMap[row.org_id].critical += cnt;
        if (row.severity === 'high') vulnCountMap[row.org_id].high += cnt;
        if (row.status === 'open') vulnCountMap[row.org_id].open += cnt;
      }
    }

    // Postgres: obligation counts per org
    let oblCountMap: Record<string, { total: number; met: number }> = {};
    if (orgIds.length > 0) {
      const oblResult = await pool.query(
        `SELECT org_id, status, COUNT(*) AS cnt
         FROM obligations
         WHERE org_id = ANY($1)
         GROUP BY org_id, status`,
        [orgIds]
      );
      for (const row of oblResult.rows) {
        if (!oblCountMap[row.org_id]) oblCountMap[row.org_id] = { total: 0, met: 0 };
        oblCountMap[row.org_id].total += parseInt(row.cnt);
        if (row.status === 'met') oblCountMap[row.org_id].met += parseInt(row.cnt);
      }
    }

    // Postgres: billing plan + status + trust classification per org
    let billingMap: Record<string, { plan: string; billingStatus: string; trustClassification: string; trustScore: number; commercialSignalScore: number }> = {};
    if (orgIds.length > 0) {
      const billingResult = await pool.query(
        `SELECT org_id, plan, status, trust_classification, trust_score, commercial_signal_score
         FROM org_billing WHERE org_id = ANY($1)`,
        [orgIds]
      );
      for (const row of billingResult.rows) {
        billingMap[row.org_id] = {
          plan: row.plan || 'standard',
          billingStatus: row.status || 'trial',
          trustClassification: row.trust_classification || 'commercial',
          trustScore: row.trust_score || 0,
          commercialSignalScore: row.commercial_signal_score || 0,
        };
      }
    }

    const enrichedOrgs = orgs.map(o => ({
      ...o,
      userCount: userCountMap[o.id] || 0,
      lastActivity: lastActivityMap[o.id] || null,
      vulnerabilities: vulnCountMap[o.id] || { total: 0, critical: 0, high: 0, open: 0 },
      obligations: oblCountMap[o.id] || { total: 0, met: 0 },
      plan: billingMap[o.id]?.plan || 'standard',
      billingStatus: billingMap[o.id]?.billingStatus || 'trial',
      trustClassification: billingMap[o.id]?.trustClassification || 'commercial',
      trustScore: billingMap[o.id]?.trustScore || 0,
      commercialSignalScore: billingMap[o.id]?.commercialSignalScore || 0,
    }));

    res.json({
      orgs: enrichedOrgs,
      totals: {
        totalOrgs: orgs.length,
        totalUsers: Object.values(userCountMap).reduce((a, b) => a + b, 0),
        totalProducts: orgs.reduce((sum, o) => sum + o.productCount, 0),
      },
    });

  } catch (err) {
    console.error('Admin orgs list error:', err);
    res.status(500).json({ error: 'Failed to fetch organisations' });
  }
});

// GET /api/admin/orgs/:orgId – Organisation detail
router.get('/orgs/:orgId', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const driver = getDriver();
    const session = driver.session();

    let org: any = null;
    let products: any[] = [];

    try {
      // Get org details
      const orgResult = await session.run(
        `MATCH (o:Organisation {id: $orgId})
         RETURN o.id AS id, o.name AS name, o.country AS country, o.craRole AS craRole,
                o.industry AS industry, o.companySize AS companySize, o.createdAt AS createdAt`,
        { orgId }
      );
      if (orgResult.records.length === 0) {
        res.status(404).json({ error: 'Organisation not found' });
        return;
      }
      const r = orgResult.records[0];
      org = {
        id: r.get('id'), name: r.get('name'), country: r.get('country'),
        craRole: r.get('craRole'), industry: r.get('industry'),
        companySize: r.get('companySize'), createdAt: toISOString(r.get('createdAt')),
      };

      // Get products with repo + contributor + dependency counts
      const prodResult = await session.run(
        `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product)
         OPTIONAL MATCH (p)-[:HAS_REPO]->(r:Repository)
         OPTIONAL MATCH (r)-[:HAS_CONTRIBUTOR]->(c:Contributor)
         OPTIONAL MATCH (p)-[:DEPENDS_ON]->(d:Dependency)
         RETURN p.id AS id, p.name AS name, p.craCategory AS category,
                p.lifecycleStatus AS lifecycle, p.repoUrl AS repoUrl,
                r.fullName AS repoFullName, r IS NOT NULL AS hasRepo,
                count(DISTINCT c) AS contributors, count(DISTINCT d) AS dependencies`,
        { orgId }
      );
      products = prodResult.records.map(rec => ({
        id: rec.get('id'),
        name: rec.get('name'),
        category: rec.get('category') || 'default',
        lifecycle: rec.get('lifecycle') || null,
        repoUrl: rec.get('repoUrl') || null,
        repoFullName: rec.get('repoFullName') || null,
        hasRepo: rec.get('hasRepo'),
        contributors: rec.get('contributors')?.toNumber?.() ?? 0,
        dependencies: rec.get('dependencies')?.toNumber?.() ?? 0,
      }));
    } finally {
      await session.close();
    }

    // Postgres: users in this org
    const usersResult = await pool.query(
      `SELECT id, email, org_role, email_verified, is_platform_admin, created_at FROM users WHERE org_id = $1 ORDER BY created_at`,
      [orgId]
    );
    const users = usersResult.rows.map(u => ({
      id: u.id, email: u.email, orgRole: u.org_role,
      emailVerified: u.email_verified, isPlatformAdmin: u.is_platform_admin,
      createdAt: u.created_at,
    }));

    // Postgres: vulnerability summary per product
    const productIds = products.map(p => p.id);
    let vulnMap: Record<string, { total: number; critical: number; high: number; open: number }> = {};
    if (productIds.length > 0) {
      const vulnResult = await pool.query(
        `SELECT product_id, severity, status, COUNT(*) AS cnt
         FROM vulnerability_findings WHERE org_id = $1
         GROUP BY product_id, severity, status`,
        [orgId]
      );
      for (const row of vulnResult.rows) {
        if (!vulnMap[row.product_id]) vulnMap[row.product_id] = { total: 0, critical: 0, high: 0, open: 0 };
        const cnt = parseInt(row.cnt);
        vulnMap[row.product_id].total += cnt;
        if (row.severity === 'critical') vulnMap[row.product_id].critical += cnt;
        if (row.severity === 'high') vulnMap[row.product_id].high += cnt;
        if (row.status === 'open') vulnMap[row.product_id].open += cnt;
      }
    }

    // Postgres: tech file progress per product
    let tfMap: Record<string, { total: number; completed: number }> = {};
    if (productIds.length > 0) {
      const tfResult = await pool.query(
        `SELECT product_id, status, COUNT(*) AS cnt
         FROM technical_file_sections WHERE product_id = ANY($1)
         GROUP BY product_id, status`,
        [productIds]
      );
      for (const row of tfResult.rows) {
        if (!tfMap[row.product_id]) tfMap[row.product_id] = { total: 0, completed: 0 };
        tfMap[row.product_id].total += parseInt(row.cnt);
        if (row.status === 'complete') tfMap[row.product_id].completed += parseInt(row.cnt);
      }
    }

    // Recent events for this org
    const eventsResult = await pool.query(
      `SELECT e.event_type, e.created_at, COALESCE(u.email, 'system') AS user_email, e.metadata
       FROM user_events e
       LEFT JOIN users u ON e.user_id = u.id
       WHERE u.org_id = $1
       ORDER BY e.created_at DESC LIMIT 20`,
      [orgId]
    );

    const enrichedProducts = products.map(p => ({
      ...p,
      vulnerabilities: vulnMap[p.id] || { total: 0, critical: 0, high: 0, open: 0 },
      techFile: tfMap[p.id] || { total: 8, completed: 0 },
    }));

    res.json({
      org,
      users,
      products: enrichedProducts,
      recentEvents: eventsResult.rows.map(r => ({
        eventType: r.event_type, createdAt: r.created_at,
        userEmail: r.user_email, metadata: r.metadata,
      })),
    });

  } catch (err) {
    console.error('Admin org detail error:', err);
    res.status(500).json({ error: 'Failed to fetch organisation details' });
  }
});

// PUT /api/admin/orgs/:orgId/plan – Change organisation plan
router.put('/orgs/:orgId/plan', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { plan } = req.body;
    const adminUserId = (req as any).userId;
    const adminEmail = (req as any).email;

    if (!plan || !['standard', 'pro'].includes(plan)) {
      res.status(400).json({ error: 'Invalid plan. Must be "standard" or "pro".' });
      return;
    }

    // Get current plan for telemetry
    const current = await pool.query('SELECT plan FROM org_billing WHERE org_id = $1', [orgId]);
    if (current.rows.length === 0) {
      res.status(404).json({ error: 'Organisation billing record not found' });
      return;
    }
    const oldPlan = current.rows[0].plan;

    await pool.query('UPDATE org_billing SET plan = $1, updated_at = NOW() WHERE org_id = $2', [plan, orgId]);

    const reqData = extractRequestData(req);
    await recordEvent({
      userId: adminUserId, email: adminEmail,
      eventType: 'admin_org_plan_changed', ...reqData,
      metadata: { orgId, oldPlan, newPlan: plan },
    });

    res.json({ success: true, plan });
  } catch (err) {
    console.error('Admin change org plan error:', err);
    res.status(500).json({ error: 'Failed to change organisation plan' });
  }
});

// DELETE /api/admin/orgs/:orgId – Delete organisation and all data
router.delete('/orgs/:orgId', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const adminUserId = (req as any).userId;
    const adminEmail = (req as any).email;

    // Safety: cannot delete your own org
    const adminUser = await pool.query('SELECT org_id FROM users WHERE id = $1', [adminUserId]);
    if (adminUser.rows.length > 0 && adminUser.rows[0].org_id === orgId) {
      res.status(400).json({ error: 'Cannot delete your own organisation' });
      return;
    }

    // Verify org exists in Neo4j
    const driver = getDriver();
    const neo4jSession = driver.session();
    try {
      const orgCheck = await neo4jSession.run(
        'MATCH (o:Organisation {id: $orgId}) RETURN o.name AS name', { orgId }
      );
      if (orgCheck.records.length === 0) {
        res.status(404).json({ error: 'Organisation not found' });
        return;
      }
      const orgName = orgCheck.records[0].get('name');

      // Get user IDs for this org
      const usersResult = await pool.query('SELECT id FROM users WHERE org_id = $1', [orgId]);
      const userIds = usersResult.rows.map(r => r.id);

      // Get product IDs from Neo4j (needed for product-only tables)
      const prodResult = await neo4jSession.run(
        'MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product) RETURN p.id AS id', { orgId }
      );
      const productIds = prodResult.records.map(r => r.get('id'));

      // Cascading Postgres deletes – order matters for FK constraints
      // Tables with org_id (direct)
      await pool.query('DELETE FROM copilot_usage WHERE org_id = $1', [orgId]);
      await pool.query('DELETE FROM product_activity_log WHERE org_id = $1', [orgId]);
      await pool.query('DELETE FROM marketplace_profiles WHERE org_id = $1', [orgId]);
      await pool.query('DELETE FROM marketplace_contact_log WHERE to_org_id = $1', [orgId]);
      await pool.query('DELETE FROM billing_events WHERE org_id = $1', [orgId]);
      await pool.query('DELETE FROM departed_contributors WHERE org_id = $1', [orgId]);
      await pool.query('DELETE FROM contributor_snapshots WHERE org_id = $1', [orgId]);
      await pool.query('DELETE FROM escrow_users WHERE org_id = $1', [orgId]);
      await pool.query('DELETE FROM escrow_deposits WHERE org_id = $1', [orgId]);
      await pool.query('DELETE FROM escrow_configs WHERE org_id = $1', [orgId]);
      await pool.query('DELETE FROM ip_proof_snapshots WHERE org_id = $1', [orgId]);
      await pool.query('DELETE FROM license_findings WHERE org_id = $1', [orgId]);
      await pool.query('DELETE FROM license_scans WHERE org_id = $1', [orgId]);

      // cra_report_stages cascade via cra_reports FK
      const reportIds = await pool.query('SELECT id FROM cra_reports WHERE org_id = $1', [orgId]);
      if (reportIds.rows.length > 0) {
        const rIds = reportIds.rows.map(r => r.id);
        await pool.query('DELETE FROM cra_report_stages WHERE report_id = ANY($1)', [rIds]);
      }
      await pool.query('DELETE FROM cra_reports WHERE org_id = $1', [orgId]);

      await pool.query('DELETE FROM vulnerability_findings WHERE org_id = $1', [orgId]);
      await pool.query('DELETE FROM vulnerability_scans WHERE org_id = $1', [orgId]);
      await pool.query('DELETE FROM obligations WHERE org_id = $1', [orgId]);
      await pool.query('DELETE FROM stakeholders WHERE org_id = $1', [orgId]);
      await pool.query('DELETE FROM notifications WHERE org_id = $1', [orgId]);

      // Product-only tables (no org_id column – delete by product_id)
      if (productIds.length > 0) {
        await pool.query('DELETE FROM sync_history WHERE product_id = ANY($1)', [productIds]);
        await pool.query('DELETE FROM repo_push_events WHERE product_id = ANY($1)', [productIds]);
        await pool.query('DELETE FROM product_sboms WHERE product_id = ANY($1)', [productIds]);
        await pool.query('DELETE FROM technical_file_sections WHERE product_id = ANY($1)', [productIds]);
        await pool.query('DELETE FROM product_versions WHERE product_id = ANY($1)', [productIds]);
      }

      // User-linked tables
      if (userIds.length > 0) {
        await pool.query('DELETE FROM feedback WHERE user_id = ANY($1)', [userIds]);
        await pool.query('DELETE FROM user_events WHERE user_id = ANY($1)', [userIds]);
        await pool.query('DELETE FROM repo_connections WHERE user_id = ANY($1)', [userIds]);
        await pool.query('DELETE FROM marketplace_contact_log WHERE from_user_id = ANY($1)', [userIds]);
      }

      // Org billing and users last
      await pool.query('DELETE FROM org_billing WHERE org_id = $1', [orgId]);
      await pool.query('DELETE FROM users WHERE org_id = $1', [orgId]);

      // Neo4j: delete org and all linked nodes
      await neo4jSession.run(
        `MATCH (o:Organisation {id: $orgId})
         OPTIONAL MATCH (o)<-[:BELONGS_TO]-(p:Product)
         OPTIONAL MATCH (p)-[:HAS_REPO]->(r:Repository)
         OPTIONAL MATCH (r)-[:HAS_CONTRIBUTOR]->(c:Contributor)
         OPTIONAL MATCH (p)-[:DEPENDS_ON]->(d:Dependency)
         OPTIONAL MATCH (p)-[:HAS_SBOM]->(s:SBOM)
         OPTIONAL MATCH (p)-[:HAS_TECH_FILE]->(tf:TechnicalFile)
         DETACH DELETE o, p, r, c, d, s, tf`,
        { orgId }
      );

      const reqData = extractRequestData(req);
      await recordEvent({
        userId: adminUserId, email: adminEmail,
        eventType: 'admin_org_deleted', ...reqData,
        metadata: { orgId, orgName, userCount: userIds.length },
      });

      res.json({ success: true });
    } finally {
      await neo4jSession.close();
    }
  } catch (err) {
    console.error('Admin delete org error:', err);
    res.status(500).json({ error: 'Failed to delete organisation' });
  }
});

// ─── Trust classification management ─────────────────────────

const VALID_CLASSIFICATIONS: TrustClassification[] = [
  'commercial', 'provisional_open_source', 'trusted_open_source',
  'community_project', 'verified_nonprofit', 'review_required',
];

// GET /api/admin/orgs/:orgId/trust — get current classification with full details
router.get('/orgs/:orgId/trust', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params as { orgId: string };
    const classification = await getClassification(orgId);
    if (!classification) {
      res.status(404).json({ error: 'Organisation billing record not found' });
      return;
    }
    res.json(classification);
  } catch (err) {
    console.error('Admin get trust error:', err);
    res.status(500).json({ error: 'Failed to fetch trust classification' });
  }
});

// POST /api/admin/orgs/:orgId/trust/evaluate — trigger re-evaluation
router.post('/orgs/:orgId/trust/evaluate', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params as { orgId: string };

    // Verify org exists
    const billing = await pool.query('SELECT org_id FROM org_billing WHERE org_id = $1', [orgId]);
    if (billing.rows.length === 0) {
      res.status(404).json({ error: 'Organisation not found' });
      return;
    }

    const evaluation = await evaluateOrganisation(orgId);
    await applyClassification(orgId, evaluation, 'automatic');

    const reqData = extractRequestData(req);
    await recordEvent({
      userId: (req as any).userId,
      email: (req as any).email,
      eventType: 'trust_classification_evaluated',
      ...reqData,
      metadata: {
        orgId,
        classification: evaluation.classification,
        trustScore: evaluation.trustScore,
        commercialSignalScore: evaluation.commercialSignalScore,
        reasons: evaluation.reasons,
      },
    });

    res.json({ evaluation });
  } catch (err) {
    console.error('Admin trust evaluate error:', err);
    res.status(500).json({ error: 'Failed to evaluate trust classification' });
  }
});

// PUT /api/admin/orgs/:orgId/trust — manually set classification
router.put('/orgs/:orgId/trust', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params as { orgId: string };
    const { classification, reason } = req.body;

    if (!classification || !VALID_CLASSIFICATIONS.includes(classification)) {
      res.status(400).json({ error: `Classification must be one of: ${VALID_CLASSIFICATIONS.join(', ')}` });
      return;
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      res.status(400).json({ error: 'Reason is required for manual classification' });
      return;
    }

    const billing = await pool.query('SELECT org_id FROM org_billing WHERE org_id = $1', [orgId]);
    if (billing.rows.length === 0) {
      res.status(404).json({ error: 'Organisation not found' });
      return;
    }

    await setClassificationManually(orgId, classification, reason.trim());

    const reqData = extractRequestData(req);
    await recordEvent({
      userId: (req as any).userId,
      email: (req as any).email,
      eventType: 'trust_classification_manual',
      ...reqData,
      metadata: { orgId, classification, reason: reason.trim() },
    });

    const updated = await getClassification(orgId);
    res.json({ classification: updated });
  } catch (err) {
    console.error('Admin set trust error:', err);
    res.status(500).json({ error: 'Failed to set trust classification' });
  }
});

export default router;

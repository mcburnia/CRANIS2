import { Router, Request, Response } from 'express';
import { readFileSync } from 'fs';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { requirePlatformAdmin } from '../middleware/requirePlatformAdmin.js';
import { generateVerificationToken } from '../utils/token.js';
import { sendInviteEmail } from '../services/email.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';
import { runPlatformScan } from '../services/vulnerability-scanner.js';
import { syncVulnDatabases, getVulnDbStats } from '../services/vuln-db-sync.js';

const router = Router();

// Helper: Convert Neo4j DateTime or string to ISO string
function toISOString(val: any): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (val.toStandardDate) return val.toStandardDate().toISOString();
  if (val.year) {
    const y = val.year.low ?? val.year;
    const m = val.month.low ?? val.month;
    const d = val.day.low ?? val.day;
    return new Date(y, m - 1, d).toISOString();
  }
  return String(val);
}

// GET /api/admin/dashboard — Platform-wide statistics
router.get('/dashboard', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    // --- Postgres: user stats ---
    const usersResult = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE is_platform_admin = true) AS platform_admins,
        COUNT(*) FILTER (WHERE email_verified = true) AS verified,
        COUNT(*) FILTER (WHERE email_verified = false) AS unverified
      FROM users
    `);
    const userStats = usersResult.rows[0];

    // Active users (logged in within 30 days)
    const activeResult = await pool.query(`
      SELECT COUNT(DISTINCT user_id) AS active
      FROM user_events
      WHERE event_type = 'login'
        AND created_at > NOW() - INTERVAL '30 days'
    `);
    const active30d = parseInt(activeResult.rows[0]?.active) || 0;

    // --- Neo4j: org and product stats ---
    const driver = getDriver();
    const session = driver.session();
    let orgCount = 0;
    let productCount = 0;
    let productsWithRepos = 0;
    let productsByCategory: Record<string, number> = {};

    try {
      const orgResult = await session.run('MATCH (o:Organisation) RETURN count(o) AS total');
      orgCount = orgResult.records[0]?.get('total')?.toNumber?.() ?? 0;

      const prodResult = await session.run(`
        MATCH (p:Product)
        OPTIONAL MATCH (p)-[:HAS_REPO]->(r:GitHubRepo)
        RETURN p.craCategory AS category, r IS NOT NULL AS hasRepo, count(p) AS cnt
      `);
      for (const record of prodResult.records) {
        const cat = record.get('category') || 'default';
        const cnt = record.get('cnt')?.toNumber?.() ?? 0;
        const hasRepo = record.get('hasRepo');
        productCount += cnt;
        if (hasRepo) productsWithRepos += cnt;
        productsByCategory[cat] = (productsByCategory[cat] || 0) + cnt;
      }
    } finally {
      await session.close();
    }

    // --- Postgres: SBOM stats ---
    const sbomResult = await pool.query(`
      SELECT
        COUNT(DISTINCT product_id) AS products_with_sbom,
        COALESCE(SUM(package_count), 0) AS total_packages
      FROM product_sboms
    `);
    const productsWithSboms = parseInt(sbomResult.rows[0]?.products_with_sbom) || 0;
    const totalPackages = parseInt(sbomResult.rows[0]?.total_packages) || 0;

    // --- Postgres: vulnerability stats ---
    const vulnResult = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE severity = 'critical') AS critical,
        COUNT(*) FILTER (WHERE severity = 'high') AS high,
        COUNT(*) FILTER (WHERE severity = 'medium') AS medium,
        COUNT(*) FILTER (WHERE severity = 'low') AS low,
        COUNT(*) FILTER (WHERE status = 'open') AS open,
        COUNT(*) FILTER (WHERE status = 'dismissed') AS dismissed
      FROM vulnerability_findings
    `);
    const vulnStats = vulnResult.rows[0];

    // Last scan
    const lastScanResult = await pool.query(`
      SELECT completed_at FROM vulnerability_scans
      WHERE status = 'completed'
      ORDER BY completed_at DESC LIMIT 1
    `);
    const lastScanAt = lastScanResult.rows[0]?.completed_at || null;

    // Scans last 7 days
    const scansWeekResult = await pool.query(`
      SELECT COUNT(*) AS cnt FROM vulnerability_scans
      WHERE created_at > NOW() - INTERVAL '7 days'
    `);
    const scansLast7d = parseInt(scansWeekResult.rows[0]?.cnt) || 0;

    // Last vuln DB sync
    const dbSyncResult = await pool.query(`
      SELECT MAX(last_sync_at) AS last_db_sync FROM vuln_db_sync_status
    `);
    const lastDbSyncAt = dbSyncResult.rows[0]?.last_db_sync || null;

    // --- Postgres: compliance stats ---
    const obligationsResult = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'met') AS met,
        COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
        COUNT(*) FILTER (WHERE status = 'not_started') AS not_started
      FROM obligations
    `);
    const oblStats = obligationsResult.rows[0];

    const techFileResult = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'complete') AS completed,
        COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress
      FROM technical_file_sections
    `);
    const tfStats = techFileResult.rows[0];

    // --- Postgres: activity stats ---
    const eventsWeekResult = await pool.query(`
      SELECT COUNT(*) AS cnt FROM user_events
      WHERE created_at > NOW() - INTERVAL '7 days'
    `);
    const eventsLast7d = parseInt(eventsWeekResult.rows[0]?.cnt) || 0;

    const loginsWeekResult = await pool.query(`
      SELECT COUNT(*) AS cnt FROM user_events
      WHERE event_type = 'login' AND created_at > NOW() - INTERVAL '7 days'
    `);
    const loginsLast7d = parseInt(loginsWeekResult.rows[0]?.cnt) || 0;

    // --- Postgres: recent events (last 10) ---
    const recentEventsResult = await pool.query(`
      SELECT
        e.event_type,
        e.created_at,
        COALESCE(u.email, 'system') AS user_email,
        e.metadata
      FROM user_events e
      LEFT JOIN users u ON e.user_id = u.id
      ORDER BY e.created_at DESC
      LIMIT 10
    `);
    const recentEvents = recentEventsResult.rows.map(row => ({
      eventType: row.event_type,
      userEmail: row.user_email,
      createdAt: row.created_at,
      metadata: row.metadata,
    }));

    res.json({
      users: {
        total: parseInt(userStats.total) || 0,
        active30d,
        platformAdmins: parseInt(userStats.platform_admins) || 0,
        verified: parseInt(userStats.verified) || 0,
        unverified: parseInt(userStats.unverified) || 0,
      },
      organisations: {
        total: orgCount,
      },
      products: {
        total: productCount,
        withRepos: productsWithRepos,
        withSboms: productsWithSboms,
        totalPackages,
        byCategory: productsByCategory,
      },
      vulnerabilities: {
        total: parseInt(vulnStats.total) || 0,
        critical: parseInt(vulnStats.critical) || 0,
        high: parseInt(vulnStats.high) || 0,
        medium: parseInt(vulnStats.medium) || 0,
        low: parseInt(vulnStats.low) || 0,
        open: parseInt(vulnStats.open) || 0,
        dismissed: parseInt(vulnStats.dismissed) || 0,
        lastScanAt,
        scansLast7d,
        lastDbSyncAt,
      },
      compliance: {
        obligationsTotal: parseInt(oblStats.total) || 0,
        obligationsMet: parseInt(oblStats.met) || 0,
        obligationsInProgress: parseInt(oblStats.in_progress) || 0,
        techFileSections: parseInt(tfStats.total) || 0,
        techFileSectionsCompleted: parseInt(tfStats.completed) || 0,
        techFileSectionsInProgress: parseInt(tfStats.in_progress) || 0,
      },
      recentActivity: {
        eventsLast7d,
        loginsLast7d,
        scansLast7d,
        events: recentEvents,
      },
    });

  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch admin dashboard data' });
  }
});


// GET /api/admin/orgs — List all organisations with summary stats
router.get('/orgs', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const driver = getDriver();
    const session = driver.session();

    let orgs: any[] = [];
    try {
      const result = await session.run(`
        MATCH (o:Organisation)
        OPTIONAL MATCH (o)<-[:BELONGS_TO]-(p:Product)
        OPTIONAL MATCH (p)-[:HAS_REPO]->(r:GitHubRepo)
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

    const enrichedOrgs = orgs.map(o => ({
      ...o,
      userCount: userCountMap[o.id] || 0,
      lastActivity: lastActivityMap[o.id] || null,
      vulnerabilities: vulnCountMap[o.id] || { total: 0, critical: 0, high: 0, open: 0 },
      obligations: oblCountMap[o.id] || { total: 0, met: 0 },
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

// GET /api/admin/orgs/:orgId — Organisation detail
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
         OPTIONAL MATCH (p)-[:HAS_REPO]->(r:GitHubRepo)
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


// GET /api/admin/users — List all users with org info and activity
router.get('/users', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const search = (req.query.search as string || '').toLowerCase();

    // Get all users from Postgres
    let query = `
      SELECT id, email, org_id, org_role, email_verified, is_platform_admin,
             preferred_language, created_at, updated_at, suspended_at, suspended_by
      FROM users
    `;
    const params: any[] = [];
    if (search) {
      query += ' WHERE LOWER(email) LIKE $1';
      params.push(`%${search}%`);
    }
    query += ' ORDER BY created_at DESC';

    const usersResult = await pool.query(query, params);

    // Get last login per user
    const lastLoginResult = await pool.query(`
      SELECT user_id, MAX(created_at) AS last_login
      FROM user_events
      WHERE event_type = 'login'
      GROUP BY user_id
    `);
    const lastLoginMap: Record<string, string> = {};
    for (const row of lastLoginResult.rows) {
      lastLoginMap[row.user_id] = row.last_login;
    }

    // Get org names from Neo4j
    const orgIds = [...new Set(usersResult.rows.map(u => u.org_id).filter(Boolean))];
    let orgNameMap: Record<string, string> = {};

    if (orgIds.length > 0) {
      const driver = getDriver();
      const session = driver.session();
      try {
        const orgResult = await session.run(
          'MATCH (o:Organisation) WHERE o.id IN $orgIds RETURN o.id AS id, o.name AS name',
          { orgIds }
        );
        for (const record of orgResult.records) {
          orgNameMap[record.get('id')] = record.get('name');
        }
      } finally {
        await session.close();
      }
    }

    // Active users (last 30 days)
    const activeResult = await pool.query(`
      SELECT COUNT(DISTINCT user_id) AS active FROM user_events
      WHERE event_type = 'login' AND created_at > NOW() - INTERVAL '30 days'
    `);
    const active30d = parseInt(activeResult.rows[0]?.active) || 0;

    const users = usersResult.rows.map(u => ({
      id: u.id,
      email: u.email,
      orgId: u.org_id || null,
      orgName: u.org_id ? (orgNameMap[u.org_id] || 'Unknown') : null,
      orgRole: u.org_role || null,
      emailVerified: u.email_verified,
      isPlatformAdmin: u.is_platform_admin || false,
      preferredLanguage: u.preferred_language || null,
      lastLogin: lastLoginMap[u.id] || null,
      createdAt: u.created_at,
      suspendedAt: u.suspended_at || null,
      suspendedBy: u.suspended_by || null,
    }));

    const totalAdmins = users.filter(u => u.isPlatformAdmin).length;
    const totalVerified = users.filter(u => u.emailVerified).length;

    res.json({
      users,
      totals: {
        total: users.length,
        verified: totalVerified,
        platformAdmins: totalAdmins,
        active30d,
      },
    });

  } catch (err) {
    console.error('Admin users list error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PUT /api/admin/users/:userId/platform-admin — Toggle platform admin status
router.put('/users/:userId/platform-admin', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { isPlatformAdmin } = req.body;
    const adminUserId = (req as any).userId;
    const adminEmail = (req as any).email;

    if (typeof isPlatformAdmin !== 'boolean') {
      res.status(400).json({ error: 'isPlatformAdmin must be a boolean' });
      return;
    }

    // Safety: cannot demote yourself
    if (userId === adminUserId && !isPlatformAdmin) {
      res.status(400).json({ error: 'Cannot remove your own platform admin access' });
      return;
    }

    // Check target user exists
    const userResult = await pool.query('SELECT id, email FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const targetEmail = userResult.rows[0].email;

    await pool.query(
      'UPDATE users SET is_platform_admin = $1, updated_at = NOW() WHERE id = $2',
      [isPlatformAdmin, userId]
    );

    // Record telemetry event
    const { recordEvent, extractRequestData } = await import('../services/telemetry.js');
    const reqData = extractRequestData(req);
    await recordEvent({
      userId: adminUserId,
      email: adminEmail,
      eventType: isPlatformAdmin ? 'platform_admin_granted' : 'platform_admin_revoked',
      ...reqData,
      metadata: { targetUserId: userId, targetEmail },
    });

    res.json({ success: true, userId, isPlatformAdmin });

  } catch (err) {
    console.error('Admin toggle error:', err);
    res.status(500).json({ error: 'Failed to update admin status' });
  }
});



// PUT /api/admin/users/:userId — Edit user details
router.put('/users/:userId', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const adminUserId = (req as any).userId;
    const adminEmail = (req as any).email;
    const { email, orgRole } = req.body;

    const userResult = await pool.query('SELECT id, email FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const updates: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let idx = 1;

    if (email) {
      // Check email not already taken
      const existing = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
      if (existing.rows.length > 0) {
        res.status(409).json({ error: 'Email address already in use' });
        return;
      }
      updates.push('email = $' + idx); params.push(email); idx++;
    }
    if (orgRole) {
      updates.push('org_role = $' + idx); params.push(orgRole); idx++;
    }

    params.push(userId);
    await pool.query(
      'UPDATE users SET ' + updates.join(', ') + ' WHERE id = $' + idx,
      params
    );

    const { recordEvent, extractRequestData } = await import('../services/telemetry.js');
    const reqData = extractRequestData(req);
    await recordEvent({
      userId: adminUserId, email: adminEmail,
      eventType: 'admin_user_edited', ...reqData,
      metadata: { targetUserId: userId, changes: { email, orgRole } },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Admin edit user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// PUT /api/admin/users/:userId/suspend — Suspend or unsuspend a user
router.put('/users/:userId/suspend', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { suspend } = req.body;
    const adminUserId = (req as any).userId;
    const adminEmail = (req as any).email;

    if (typeof suspend !== 'boolean') {
      res.status(400).json({ error: 'suspend must be a boolean' });
      return;
    }

    if (userId === adminUserId) {
      res.status(400).json({ error: 'Cannot suspend yourself' });
      return;
    }

    const userResult = await pool.query('SELECT id, email FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const targetEmail = userResult.rows[0].email;

    if (suspend) {
      await pool.query(
        'UPDATE users SET suspended_at = NOW(), suspended_by = $1, updated_at = NOW() WHERE id = $2',
        [adminEmail, userId]
      );
    } else {
      await pool.query(
        'UPDATE users SET suspended_at = NULL, suspended_by = NULL, updated_at = NOW() WHERE id = $1',
        [userId]
      );
    }

    const { recordEvent, extractRequestData } = await import('../services/telemetry.js');
    const reqData = extractRequestData(req);
    await recordEvent({
      userId: adminUserId, email: adminEmail,
      eventType: suspend ? 'admin_user_suspended' : 'admin_user_unsuspended',
      ...reqData,
      metadata: { targetUserId: userId, targetEmail },
    });

    res.json({ success: true, suspended: suspend });
  } catch (err) {
    console.error('Admin suspend user error:', err);
    res.status(500).json({ error: 'Failed to suspend/unsuspend user' });
  }
});

// DELETE /api/admin/users/:userId — Delete a user
router.delete('/users/:userId', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const adminUserId = (req as any).userId;
    const adminEmail = (req as any).email;

    if (userId === adminUserId) {
      res.status(400).json({ error: 'Cannot delete yourself' });
      return;
    }

    const userResult = await pool.query('SELECT id, email, org_id FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const targetEmail = userResult.rows[0].email;
    const targetOrgId = userResult.rows[0].org_id;

    // Delete related data
    await pool.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM user_events WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM feedback WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM github_connections WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    const { recordEvent, extractRequestData } = await import('../services/telemetry.js');
    const reqData = extractRequestData(req);
    await recordEvent({
      userId: adminUserId, email: adminEmail,
      eventType: 'admin_user_deleted', ...reqData,
      metadata: { targetUserId: userId, targetEmail, targetOrgId },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Admin delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// GET /api/admin/audit-log — Cross-org audit log with filtering + pagination
router.get('/audit-log', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;
    const eventType = (req.query.eventType as string) || '';
    const email = (req.query.email as string) || '';

    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (eventType) {
      whereConditions.push(`e.event_type = $${paramIndex}`);
      params.push(eventType);
      paramIndex++;
    }
    if (email) {
      whereConditions.push(`LOWER(u.email) LIKE $${paramIndex}`);
      params.push(`%${email.toLowerCase()}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Count total
    const countResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM user_events e
       LEFT JOIN users u ON e.user_id = u.id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Fetch page
    const eventsResult = await pool.query(
      `SELECT e.id, e.event_type, e.ip_address, e.user_agent, e.metadata, e.created_at,
              COALESCE(u.email, 'system') AS user_email, u.org_id
       FROM user_events e
       LEFT JOIN users u ON e.user_id = u.id
       ${whereClause}
       ORDER BY e.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    // Get org names for the events
    const orgIds = [...new Set(eventsResult.rows.map((r: any) => r.org_id).filter(Boolean))];
    let orgNameMap: Record<string, string> = {};
    if (orgIds.length > 0) {
      const driver = getDriver();
      const session = driver.session();
      try {
        const orgResult = await session.run(
          'MATCH (o:Organisation) WHERE o.id IN $orgIds RETURN o.id AS id, o.name AS name',
          { orgIds }
        );
        for (const record of orgResult.records) {
          orgNameMap[record.get('id')] = record.get('name');
        }
      } finally {
        await session.close();
      }
    }

    // Get distinct event types for filter dropdown
    const typesResult = await pool.query(
      'SELECT DISTINCT event_type FROM user_events ORDER BY event_type'
    );
    const eventTypes = typesResult.rows.map((r: any) => r.event_type);

    const events = eventsResult.rows.map((r: any) => ({
      id: r.id,
      eventType: r.event_type,
      ipAddress: r.ip_address,
      userAgent: r.user_agent,
      metadata: r.metadata,
      createdAt: r.created_at,
      userEmail: r.user_email,
      orgName: r.org_id ? (orgNameMap[r.org_id] || null) : null,
    }));

    res.json({
      events,
      eventTypes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (err) {
    console.error('Admin audit log error:', err);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// GET /api/admin/system — System health metrics
router.get('/system', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    // Total events
    const eventsResult = await pool.query('SELECT COUNT(*) AS total FROM user_events');
    const totalEvents = parseInt(eventsResult.rows[0].total);

    // Events today
    const todayResult = await pool.query(
      "SELECT COUNT(*) AS cnt FROM user_events WHERE created_at > CURRENT_DATE"
    );
    const eventsToday = parseInt(todayResult.rows[0].cnt);

    // Scan stats (per-product scans)
    const scanStatsResult = await pool.query(`
      SELECT
        COUNT(*) AS total_scans,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_scans,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed_scans,
        COUNT(*) FILTER (WHERE created_at > CURRENT_DATE) AS scans_today,
        AVG(duration_seconds) FILTER (WHERE status = 'completed') AS avg_duration,
        AVG(osv_duration_ms) FILTER (WHERE status = 'completed') AS avg_osv_ms,
        AVG(github_duration_ms) FILTER (WHERE status = 'completed') AS avg_github_ms,
        AVG(nvd_duration_ms) FILTER (WHERE status = 'completed') AS avg_nvd_ms
      FROM vulnerability_scans
    `);

    // Avg local DB latency (from platform_scan_runs where the column lives)
    const localDbAvgResult = await pool.query(`
      SELECT AVG(local_db_duration_ms) FILTER (WHERE status = 'completed') AS avg_local_db_ms
      FROM platform_scan_runs
    `);
    const scanStats = scanStatsResult.rows[0];

    // Error rate
    const totalScans = parseInt(scanStats.total_scans) || 0;
    const failedScans = parseInt(scanStats.failed_scans) || 0;
    const errorRate = totalScans > 0 ? ((failedScans / totalScans) * 100).toFixed(1) : '0.0';

    // Recent scans with performance data (join platform_scan_runs for local DB fields)
    const recentScansResult = await pool.query(`
      SELECT vs.id, vs.product_id, vs.started_at, vs.completed_at, vs.status,
             vs.findings_count, vs.duration_seconds, vs.dependency_count,
             vs.osv_duration_ms, vs.osv_findings,
             vs.github_duration_ms, vs.github_findings,
             vs.nvd_duration_ms, vs.nvd_findings,
             psr.local_db_duration_ms, psr.local_db_findings,
             vs.triggered_by, vs.error_message
      FROM vulnerability_scans vs
      LEFT JOIN platform_scan_runs psr ON vs.platform_scan_run_id = psr.id
      ORDER BY vs.started_at DESC
      LIMIT 20
    `);

    // Get product names for recent scans
    const productIds = [...new Set(recentScansResult.rows.map((r: any) => r.product_id))];
    let productNameMap: Record<string, string> = {};
    if (productIds.length > 0) {
      const driver = getDriver();
      const session = driver.session();
      try {
        const prodResult = await session.run(
          'MATCH (p:Product) WHERE p.id IN $productIds RETURN p.id AS id, p.name AS name',
          { productIds }
        );
        for (const record of prodResult.records) {
          productNameMap[record.get('id')] = record.get('name');
        }
      } finally {
        await session.close();
      }
    }

    const recentScans = recentScansResult.rows.map((r: any) => ({
      id: r.id,
      productName: productNameMap[r.product_id] || r.product_id,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      status: r.status,
      findingsCount: r.findings_count,
      durationSeconds: r.duration_seconds ? parseFloat(r.duration_seconds) : null,
      dependencyCount: r.dependency_count,
      osvDurationMs: r.osv_duration_ms,
      osvFindings: r.osv_findings,
      githubDurationMs: r.github_duration_ms,
      githubFindings: r.github_findings,
      nvdDurationMs: r.nvd_duration_ms,
      nvdFindings: r.nvd_findings,
      localDbDurationMs: r.local_db_duration_ms,
      localDbFindings: r.local_db_findings,
      triggeredBy: r.triggered_by,
      errorMessage: r.error_message,
    }));

    // DB table row counts
    const tableCountsResult = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM user_events) AS events,
        (SELECT COUNT(*) FROM vulnerability_findings) AS findings,
        (SELECT COUNT(*) FROM vulnerability_scans) AS scans,
        (SELECT COUNT(*) FROM product_sboms) AS sboms,
        (SELECT COUNT(*) FROM technical_file_sections) AS tech_sections,
        (SELECT COUNT(*) FROM obligations) AS obligations,
        (SELECT COUNT(*) FROM stakeholders) AS stakeholders,
        (SELECT COUNT(*) FROM github_connections) AS github_connections,
        (SELECT COUNT(*) FROM sync_history) AS sync_records,
        (SELECT COUNT(*) FROM vuln_db_advisories) AS vuln_db_advisories,
        (SELECT COUNT(*) FROM vuln_db_nvd) AS vuln_db_nvd
    `);
    const tableCounts = tableCountsResult.rows[0];

    // Read CPU temperature
    let cpuTempC: number | null = null;
    try {
      const raw = readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf-8').trim();
      cpuTempC = Math.round(parseInt(raw) / 1000);
    } catch { /* not available */ }

    res.json({
      overview: {
        totalEvents: totalEvents,
        eventsToday: eventsToday,
        scansToday: parseInt(scanStats.scans_today) || 0,
        avgScanDuration: scanStats.avg_duration ? parseFloat(scanStats.avg_duration).toFixed(1) : null,
        errorRate: parseFloat(errorRate),
        cpuTemp: cpuTempC,
      },
      scanPerformance: {
        totalScans,
        completedScans: parseInt(scanStats.completed_scans) || 0,
        failedScans,
        avgOsvMs: scanStats.avg_osv_ms ? Math.round(parseFloat(scanStats.avg_osv_ms)) : null,
        avgGithubMs: scanStats.avg_github_ms ? Math.round(parseFloat(scanStats.avg_github_ms)) : null,
        avgNvdMs: scanStats.avg_nvd_ms ? Math.round(parseFloat(scanStats.avg_nvd_ms)) : null,
        avgLocalDbMs: localDbAvgResult.rows[0]?.avg_local_db_ms ? Math.round(parseFloat(localDbAvgResult.rows[0].avg_local_db_ms)) : null,
      },
      recentScans,
      tableCounts: Object.fromEntries(
        Object.entries(tableCounts).map(([k, v]) => [k, parseInt(v as string)])
      ),
    });

  } catch (err) {
    console.error('Admin system health error:', err);
    res.status(500).json({ error: 'Failed to fetch system health data' });
  }
});


const DEV_MODE = process.env.DEV_SKIP_EMAIL === 'true';

// POST /admin/invite — Invite a new user via email
router.post('/invite', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { email, orgId, isPlatformAdmin } = req.body;
    const adminUserId = (req as any).userId;
    const adminEmail = (req as any).email;

    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      res.status(400).json({ error: 'Invalid email address' });
      return;
    }

    // Check if user already exists
    const existing = await pool.query(
      'SELECT id, email_verified, invited_by FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (existing.rows.length > 0) {
      const existingUser = existing.rows[0];

      // Allow re-invite for unaccepted invitations
      if (!existingUser.email_verified && existingUser.invited_by) {
        const token = generateVerificationToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await pool.query(
          `UPDATE users SET verification_token = $1, token_expires_at = $2, org_id = $3,
           is_platform_admin = $4, invited_by = $5, updated_at = NOW() WHERE id = $6`,
          [token, expiresAt, orgId || null, isPlatformAdmin || false, adminUserId, existingUser.id]
        );

        if (DEV_MODE) {
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
          console.log(`[DEV MODE] Re-invite URL for ${normalizedEmail}: ${frontendUrl}/accept-invite?token=${token}`);
        } else {
          await sendInviteEmail(normalizedEmail, token, adminEmail);
        }

        const reqData = extractRequestData(req);
        await recordEvent({
          userId: adminUserId,
          email: adminEmail,
          eventType: 'user_reinvited',
          ipAddress: reqData.ipAddress,
          userAgent: reqData.userAgent,
          acceptLanguage: reqData.acceptLanguage,
          metadata: { invitedEmail: normalizedEmail, orgId: orgId || null, isPlatformAdmin: isPlatformAdmin || false },
        });

        res.json({ success: true, userId: existingUser.id, email: normalizedEmail, reinvite: true });
        return;
      }

      res.status(409).json({ error: 'A user with this email already exists' });
      return;
    }

    // Validate org exists if provided
    if (orgId) {
      const neo4jSession = getDriver().session();
      try {
        const orgResult = await neo4jSession.run(
          'MATCH (o:Organisation {id: $orgId}) RETURN o.id AS id',
          { orgId }
        );
        if (orgResult.records.length === 0) {
          res.status(400).json({ error: 'Organisation not found' });
          return;
        }
      } finally {
        await neo4jSession.close();
      }
    }

    // Generate invite token (7-day expiry)
    const token = generateVerificationToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Create user record (no usable password)
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, email_verified, verification_token, token_expires_at,
       org_id, org_role, is_platform_admin, invited_by)
       VALUES ($1, '', FALSE, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [normalizedEmail, token, expiresAt, orgId || null, orgId ? 'member' : 'admin',
       isPlatformAdmin || false, adminUserId]
    );

    // Send invite email (or log in dev mode)
    if (DEV_MODE) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';
      console.log(`[DEV MODE] Invite URL for ${normalizedEmail}: ${frontendUrl}/accept-invite?token=${token}`);
    } else {
      await sendInviteEmail(normalizedEmail, token, adminEmail);
    }

    // Record telemetry
    const reqData = extractRequestData(req);
    await recordEvent({
      userId: adminUserId,
      email: adminEmail,
      eventType: 'user_invited',
      ipAddress: reqData.ipAddress,
      userAgent: reqData.userAgent,
      acceptLanguage: reqData.acceptLanguage,
      metadata: { invitedEmail: normalizedEmail, orgId: orgId || null, isPlatformAdmin: isPlatformAdmin || false },
    });

    res.status(201).json({ success: true, userId: result.rows[0].id, email: normalizedEmail });
  } catch (err) {
    console.error('Admin invite error:', err);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});



// =====================================================================
// Platform-wide vulnerability scanning endpoints
// =====================================================================

// POST /api/admin/vulnerability-scan
router.post('/vulnerability-scan', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const adminEmail = (req as any).email;
    const adminUserId = (req as any).userId;

    // Check no scan already running
    const running = await pool.query(
      "SELECT id FROM platform_scan_runs WHERE status = 'running'"
    );
    if (running.rows.length > 0) {
      res.json({ status: 'already_running', runId: running.rows[0].id });
      return;
    }

    // Record telemetry
    const reqData = extractRequestData(req);
    await recordEvent({
      userId: adminUserId,
      email: adminEmail,
      eventType: 'platform_vulnerability_scan_triggered',
      ...reqData,
      metadata: { triggerType: 'manual' },
    });

    // Start scan async, respond immediately
    runPlatformScan(adminEmail, 'manual').catch(err => {
      console.error('[ADMIN] Platform scan failed:', err);
    });

    // Small delay to let the record get created
    await new Promise(resolve => setTimeout(resolve, 200));

    const latestRunning = await pool.query(
      "SELECT id FROM platform_scan_runs WHERE status = 'running' ORDER BY started_at DESC LIMIT 1"
    );

    res.json({ status: 'started', runId: latestRunning.rows[0]?.id || null });
  } catch (err) {
    console.error('Admin vulnerability scan trigger error:', err);
    res.status(500).json({ error: 'Failed to trigger vulnerability scan' });
  }
});

// GET /api/admin/vulnerability-scan/status
router.get('/vulnerability-scan/status', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const runResult = await pool.query(
      'SELECT id, status, triggered_by, trigger_type, total_products, total_unique_dependencies, ' +
      'total_findings, critical_count, high_count, medium_count, low_count, new_findings_count, ' +
      'started_at, completed_at, duration_seconds, ' +
      'osv_duration_ms, osv_findings, github_duration_ms, github_findings, ' +
      'nvd_duration_ms, nvd_findings, local_db_duration_ms, local_db_findings, error_message ' +
      'FROM platform_scan_runs ORDER BY started_at DESC LIMIT 1'
    );

    if (runResult.rows.length === 0) {
      res.json({ run: null, products: [] });
      return;
    }

    const run = runResult.rows[0];

    const productsResult = await pool.query(
      'SELECT vs.product_id, vs.findings_count, vs.critical_count, vs.high_count, ' +
      'vs.medium_count, vs.low_count, vs.duration_seconds ' +
      'FROM vulnerability_scans vs ' +
      'WHERE vs.platform_scan_run_id = $1 ' +
      'ORDER BY vs.critical_count DESC, vs.high_count DESC, vs.findings_count DESC',
      [run.id]
    );

    const productIds = productsResult.rows.map((r: any) => r.product_id);
    let productNameMap: Record<string, string> = {};
    if (productIds.length > 0) {
      const driver = getDriver();
      const session = driver.session();
      try {
        const nameResult = await session.run(
          'MATCH (p:Product) WHERE p.id IN $productIds RETURN p.id AS id, p.name AS name',
          { productIds }
        );
        for (const record of nameResult.records) {
          productNameMap[record.get('id')] = record.get('name');
        }
      } finally {
        await session.close();
      }
    }

    res.json({
      run: {
        id: run.id,
        status: run.status,
        triggeredBy: run.triggered_by,
        triggerType: run.trigger_type,
        totalProducts: run.total_products,
        totalUniqueDependencies: run.total_unique_dependencies,
        totalFindings: run.total_findings,
        criticalCount: run.critical_count,
        highCount: run.high_count,
        mediumCount: run.medium_count,
        lowCount: run.low_count,
        newFindingsCount: run.new_findings_count,
        startedAt: run.started_at,
        completedAt: run.completed_at,
        durationSeconds: run.duration_seconds ? parseFloat(run.duration_seconds) : null,
        osvDurationMs: run.osv_duration_ms,
        osvFindings: run.osv_findings,
        githubDurationMs: run.github_duration_ms,
        githubFindings: run.github_findings,
        nvdDurationMs: run.nvd_duration_ms,
        nvdFindings: run.nvd_findings,
        localDbDurationMs: run.local_db_duration_ms,
        localDbFindings: run.local_db_findings,
        errorMessage: run.error_message,
      },
      products: productsResult.rows.map((r: any) => ({
        productId: r.product_id,
        productName: productNameMap[r.product_id] || r.product_id,
        findingsCount: r.findings_count,
        criticalCount: r.critical_count,
        highCount: r.high_count,
        mediumCount: r.medium_count,
        lowCount: r.low_count,
        durationSeconds: r.duration_seconds ? parseFloat(r.duration_seconds) : null,
      })),
    });
  } catch (err) {
    console.error('Admin vulnerability scan status error:', err);
    res.status(500).json({ error: 'Failed to fetch vulnerability scan status' });
  }
});

// GET /api/admin/vulnerability-scan/history
router.get('/vulnerability-scan/history', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) AS total FROM platform_scan_runs');
    const total = parseInt(countResult.rows[0].total);

    const runsResult = await pool.query(
      'SELECT id, status, triggered_by, trigger_type, total_products, total_unique_dependencies, ' +
      'total_findings, critical_count, high_count, medium_count, low_count, new_findings_count, ' +
      'started_at, completed_at, duration_seconds, ' +
      'osv_duration_ms, osv_findings, github_duration_ms, github_findings, ' +
      'nvd_duration_ms, nvd_findings, local_db_duration_ms, local_db_findings, error_message ' +
      'FROM platform_scan_runs ORDER BY started_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    res.json({
      runs: runsResult.rows.map((row: any) => ({
        id: row.id,
        status: row.status,
        triggeredBy: row.triggered_by,
        triggerType: row.trigger_type,
        totalProducts: row.total_products,
        totalUniqueDependencies: row.total_unique_dependencies,
        totalFindings: row.total_findings,
        criticalCount: row.critical_count,
        highCount: row.high_count,
        mediumCount: row.medium_count,
        lowCount: row.low_count,
        newFindingsCount: row.new_findings_count,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        durationSeconds: row.duration_seconds ? parseFloat(row.duration_seconds) : null,
        osvDurationMs: row.osv_duration_ms,
        osvFindings: row.osv_findings,
        githubDurationMs: row.github_duration_ms,
        githubFindings: row.github_findings,
        nvdDurationMs: row.nvd_duration_ms,
        nvdFindings: row.nvd_findings,
        localDbDurationMs: row.local_db_duration_ms,
        localDbFindings: row.local_db_findings,
        errorMessage: row.error_message,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Admin vulnerability scan history error:', err);
    res.status(500).json({ error: 'Failed to fetch vulnerability scan history' });
  }
});


// POST /api/admin/vulnerability-db/sync — trigger manual vulnerability database sync
router.post('/vulnerability-db/sync', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    // Run async — don't block the response
    syncVulnDatabases().catch(err => {
      console.error('Manual vuln DB sync failed:', err);
    });
    res.json({ message: 'Vulnerability database sync started' });
  } catch (err) {
    console.error('Admin vuln DB sync trigger error:', err);
    res.status(500).json({ error: 'Failed to trigger vulnerability database sync' });
  }
});

// GET /api/admin/vulnerability-db/status — get sync status per ecosystem
router.get('/vulnerability-db/status', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await getVulnDbStats();
    res.json(stats);
  } catch (err) {
    console.error('Admin vuln DB status error:', err);
    res.status(500).json({ error: 'Failed to fetch vulnerability database status' });
  }
});


// GET /api/admin/feedback — List all feedback submissions
router.get('/feedback', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM feedback';
    const params: any[] = [];
    let paramIdx = 1;

    if (status) {
      query += ' WHERE status = $' + paramIdx;
      params.push(status);
      paramIdx++;
    }

    query += ' ORDER BY created_at DESC LIMIT $' + paramIdx + ' OFFSET $' + (paramIdx + 1);
    params.push(limit, offset);

    const result = await pool.query(query, params);

    let countQuery = 'SELECT COUNT(*) AS total FROM feedback';
    const countParams: any[] = [];
    if (status) {
      countQuery += ' WHERE status = $1';
      countParams.push(status);
    }
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    // Summary counts
    const summaryResult = await pool.query(
      "SELECT status, COUNT(*) AS cnt FROM feedback GROUP BY status"
    );
    const summary: Record<string, number> = { new: 0, reviewed: 0, resolved: 0 };
    for (const row of summaryResult.rows) {
      summary[row.status] = parseInt(row.cnt);
    }

    res.json({
      feedback: result.rows,
      summary,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Failed to fetch feedback:', err);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// PUT /api/admin/feedback/:id — Update feedback status/notes
router.put('/feedback/:id', requirePlatformAdmin, async (req: Request, res: Response) => {
  const feedbackId = req.params.id as string;
  const { status, adminNotes } = req.body;

  if (status && !['new', 'reviewed', 'resolved'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  try {
    const updates: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let idx = 1;

    if (status) { updates.push('status = $' + idx); params.push(status); idx++; }
    if (adminNotes !== undefined) { updates.push('admin_notes = $' + idx); params.push(adminNotes); idx++; }

    params.push(feedbackId);
    const result = await pool.query(
      'UPDATE feedback SET ' + updates.join(', ') + ' WHERE id = $' + idx + ' RETURNING *',
      params
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Feedback not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to update feedback:', err);
    res.status(500).json({ error: 'Failed to update feedback' });
  }
});

export default router;

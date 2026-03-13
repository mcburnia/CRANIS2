import { Router, Request, Response } from 'express';
import pool from '../../db/pool.js';
import { getDriver } from '../../db/neo4j.js';
import { requirePlatformAdmin } from '../../middleware/requirePlatformAdmin.js';

const router = Router();

// GET /api/admin/dashboard – Platform-wide statistics
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
        OPTIONAL MATCH (p)-[:HAS_REPO]->(r:Repository)
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

export default router;

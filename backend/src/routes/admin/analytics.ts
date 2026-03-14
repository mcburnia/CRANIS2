import { Router, Request, Response } from 'express';
import pool from '../../db/pool.js';
import { getDriver } from '../../db/neo4j.js';
import { requirePlatformAdmin } from '../../middleware/requirePlatformAdmin.js';

const router = Router();

// ─── Helper ─────────────────────────────────────────────────────────────────
function toInt(val: unknown): number {
  return parseInt(String(val)) || 0;
}

// ─── GET /api/admin/analytics ───────────────────────────────────────────────
router.get('/analytics', requirePlatformAdmin, async (_req: Request, res: Response) => {
  try {
    // --- Growth: weekly signups (last 26 weeks) ---
    const signupsResult = await pool.query(`
      SELECT
        date_trunc('week', created_at)::date AS week,
        COUNT(*) AS signups
      FROM users
      WHERE created_at > NOW() - INTERVAL '26 weeks'
      GROUP BY week
      ORDER BY week
    `);
    const weeklySignups = signupsResult.rows.map(r => ({
      week: r.week,
      signups: toInt(r.signups),
    }));

    // --- Growth: cumulative users ---
    const cumulativeResult = await pool.query(`
      SELECT
        date_trunc('month', created_at)::date AS month,
        COUNT(*) AS signups
      FROM users
      GROUP BY month
      ORDER BY month
    `);
    let runningTotal = 0;
    const cumulativeUsers = cumulativeResult.rows.map(r => {
      runningTotal += toInt(r.signups);
      return { month: r.month, total: runningTotal };
    });

    // --- Growth: active users (7d and 30d) ---
    const active7dResult = await pool.query(`
      SELECT COUNT(DISTINCT user_id) AS cnt
      FROM user_events
      WHERE event_type = 'login' AND created_at > NOW() - INTERVAL '7 days'
    `);
    const active30dResult = await pool.query(`
      SELECT COUNT(DISTINCT user_id) AS cnt
      FROM user_events
      WHERE event_type = 'login' AND created_at > NOW() - INTERVAL '30 days'
    `);

    // --- Adoption: connected repos and products with SBOMs ---
    const repoResult = await pool.query(`
      SELECT COUNT(DISTINCT product_id) AS cnt FROM product_sboms
    `);
    const productsWithSboms = toInt(repoResult.rows[0]?.cnt);

    // Neo4j: connected repos, countries, industries, roles, company sizes
    const driver = getDriver();
    const session = driver.session();

    let connectedRepos = 0;
    let countryCounts: Array<{ country: string; count: number }> = [];
    let industryCounts: Array<{ industry: string; count: number }> = [];
    let roleCounts: Array<{ role: string; count: number }> = [];
    let sizeCounts: Array<{ size: string; count: number }> = [];
    let totalOrgs = 0;
    let totalProducts = 0;

    try {
      // Connected repos
      const repoNeo = await session.run(`
        MATCH (:Product)-[:HAS_REPO]->(:Repository)
        RETURN count(*) AS cnt
      `);
      connectedRepos = repoNeo.records[0]?.get('cnt')?.toNumber?.() ?? 0;

      // Org + product totals
      const orgResult = await session.run('MATCH (o:Organisation) RETURN count(o) AS cnt');
      totalOrgs = orgResult.records[0]?.get('cnt')?.toNumber?.() ?? 0;

      const prodResult = await session.run('MATCH (p:Product) RETURN count(p) AS cnt');
      totalProducts = prodResult.records[0]?.get('cnt')?.toNumber?.() ?? 0;

      // Countries
      const countryResult = await session.run(`
        MATCH (o:Organisation)
        WHERE o.country IS NOT NULL AND o.country <> ''
        RETURN o.country AS country, count(o) AS cnt
        ORDER BY cnt DESC
      `);
      countryCounts = countryResult.records.map(r => ({
        country: r.get('country'),
        count: r.get('cnt')?.toNumber?.() ?? 0,
      }));

      // Industries
      const industryResult = await session.run(`
        MATCH (o:Organisation)
        WHERE o.industry IS NOT NULL AND o.industry <> ''
        RETURN o.industry AS industry, count(o) AS cnt
        ORDER BY cnt DESC
      `);
      industryCounts = industryResult.records.map(r => ({
        industry: r.get('industry'),
        count: r.get('cnt')?.toNumber?.() ?? 0,
      }));

      // CRA roles
      const roleResult = await session.run(`
        MATCH (o:Organisation)
        WHERE o.craRole IS NOT NULL AND o.craRole <> ''
        RETURN o.craRole AS role, count(o) AS cnt
        ORDER BY cnt DESC
      `);
      roleCounts = roleResult.records.map(r => ({
        role: r.get('role'),
        count: r.get('cnt')?.toNumber?.() ?? 0,
      }));

      // Company sizes
      const sizeResult = await session.run(`
        MATCH (o:Organisation)
        WHERE o.companySize IS NOT NULL AND o.companySize <> ''
        RETURN o.companySize AS size, count(o) AS cnt
        ORDER BY cnt DESC
      `);
      sizeCounts = sizeResult.records.map(r => ({
        size: r.get('size'),
        count: r.get('cnt')?.toNumber?.() ?? 0,
      }));
    } finally {
      await session.close();
    }

    // --- Revenue: billing breakdown ---
    const billingResult = await pool.query(`
      SELECT
        plan,
        status,
        COUNT(*) AS cnt,
        COALESCE(SUM(monthly_amount_cents), 0) AS revenue_cents,
        COALESCE(SUM(contributor_count), 0) AS contributors
      FROM org_billing
      GROUP BY plan, status
    `);

    let mrr = 0;
    let totalContributors = 0;
    const billingByPlan: Record<string, { count: number; revenue: number }> = {};
    const billingByStatus: Record<string, number> = {};

    for (const row of billingResult.rows) {
      const plan = row.plan || 'standard';
      const status = row.status || 'unknown';
      const cnt = toInt(row.cnt);
      const rev = toInt(row.revenue_cents);
      const contribs = toInt(row.contributors);

      if (['active', 'trial'].includes(status)) {
        mrr += rev;
        totalContributors += contribs;
      }

      if (!billingByPlan[plan]) billingByPlan[plan] = { count: 0, revenue: 0 };
      billingByPlan[plan].count += cnt;
      billingByPlan[plan].revenue += rev;

      billingByStatus[status] = (billingByStatus[status] || 0) + cnt;
    }

    // --- Assessments: CRA + NIS2 completions ---
    let craAssessments = { total: 0, completed: 0, byCategory: [] as Array<{ category: string; count: number }>, byWeek: [] as Array<{ week: string; count: number }> };
    let nis2Assessments = { total: 0, completed: 0, byEntityClass: [] as Array<{ entityClass: string; count: number }>, byWeek: [] as Array<{ week: string; count: number }> };
    let launchSubscribers = 0;

    try {
      // CRA assessments
      const craTotal = await pool.query(`SELECT COUNT(*) AS cnt FROM cra_assessments`);
      const craCompleted = await pool.query(`SELECT COUNT(*) AS cnt FROM cra_assessments WHERE completed_at IS NOT NULL`);
      craAssessments.total = toInt(craTotal.rows[0]?.cnt);
      craAssessments.completed = toInt(craCompleted.rows[0]?.cnt);

      const craByCat = await pool.query(`
        SELECT category, COUNT(*) AS cnt
        FROM cra_assessments
        WHERE completed_at IS NOT NULL AND category IS NOT NULL
        GROUP BY category ORDER BY cnt DESC
      `);
      craAssessments.byCategory = craByCat.rows.map(r => ({ category: r.category, count: toInt(r.cnt) }));

      const craByWeek = await pool.query(`
        SELECT date_trunc('week', completed_at)::date AS week, COUNT(*) AS cnt
        FROM cra_assessments
        WHERE completed_at IS NOT NULL AND completed_at > NOW() - INTERVAL '26 weeks'
        GROUP BY week ORDER BY week
      `);
      craAssessments.byWeek = craByWeek.rows.map(r => ({ week: r.week, count: toInt(r.cnt) }));

      // NIS2 assessments
      const nis2Total = await pool.query(`SELECT COUNT(*) AS cnt FROM nis2_assessments`);
      const nis2Completed = await pool.query(`SELECT COUNT(*) AS cnt FROM nis2_assessments WHERE completed_at IS NOT NULL`);
      nis2Assessments.total = toInt(nis2Total.rows[0]?.cnt);
      nis2Assessments.completed = toInt(nis2Completed.rows[0]?.cnt);

      const nis2ByClass = await pool.query(`
        SELECT entity_class, COUNT(*) AS cnt
        FROM nis2_assessments
        WHERE completed_at IS NOT NULL AND entity_class IS NOT NULL
        GROUP BY entity_class ORDER BY cnt DESC
      `);
      nis2Assessments.byEntityClass = nis2ByClass.rows.map(r => ({ entityClass: r.entity_class, count: toInt(r.cnt) }));

      const nis2ByWeek = await pool.query(`
        SELECT date_trunc('week', completed_at)::date AS week, COUNT(*) AS cnt
        FROM nis2_assessments
        WHERE completed_at IS NOT NULL AND completed_at > NOW() - INTERVAL '26 weeks'
        GROUP BY week ORDER BY week
      `);
      nis2Assessments.byWeek = nis2ByWeek.rows.map(r => ({ week: r.week, count: toInt(r.cnt) }));

      // Launch list subscribers
      const subsResult = await pool.query(`SELECT COUNT(*) AS cnt FROM cra_launch_subscribers`);
      launchSubscribers = toInt(subsResult.rows[0]?.cnt);
    } catch {
      // Assessment tables may not exist in test DB — gracefully degrade
    }

    // --- Total users ---
    const totalUsersResult = await pool.query(`SELECT COUNT(*) AS cnt FROM users`);
    const totalUsers = toInt(totalUsersResult.rows[0]?.cnt);

    res.json({
      snapshot: {
        totalUsers,
        totalOrgs,
        totalProducts,
        connectedRepos,
        productsWithSboms,
        activeUsers7d: toInt(active7dResult.rows[0]?.cnt),
        activeUsers30d: toInt(active30dResult.rows[0]?.cnt),
        totalContributors,
        launchSubscribers,
      },
      growth: {
        weeklySignups,
        cumulativeUsers,
      },
      revenue: {
        mrrCents: mrr,
        byPlan: billingByPlan,
        byStatus: billingByStatus,
      },
      market: {
        countries: countryCounts,
        industries: industryCounts,
        roles: roleCounts,
        companySizes: sizeCounts,
      },
      assessments: {
        cra: craAssessments,
        nis2: nis2Assessments,
      },
    });
  } catch (err) {
    console.error('Admin analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

export default router;

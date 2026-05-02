/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

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

    // --- Assessments: CRA + NIS2 + Importer completions ---
    let craAssessments = { total: 0, completed: 0, byCategory: [] as Array<{ category: string; count: number }>, byWeek: [] as Array<{ week: string; count: number }> };
    let nis2Assessments = { total: 0, completed: 0, byEntityClass: [] as Array<{ entityClass: string; count: number }>, byWeek: [] as Array<{ week: string; count: number }> };
    let importerAssessments = { total: 0, completed: 0, byReadiness: [] as Array<{ level: string; count: number }>, byWeek: [] as Array<{ week: string; count: number }> };
    let pqcAssessments = { total: 0, completed: 0, byReadiness: [] as Array<{ level: string; count: number }>, byWeek: [] as Array<{ week: string; count: number }> };
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

      // Importer assessments
      const impTotal = await pool.query(`SELECT COUNT(*) AS cnt FROM importer_assessments`);
      const impCompleted = await pool.query(`SELECT COUNT(*) AS cnt FROM importer_assessments WHERE completed_at IS NOT NULL`);
      importerAssessments.total = toInt(impTotal.rows[0]?.cnt);
      importerAssessments.completed = toInt(impCompleted.rows[0]?.cnt);

      const impByLevel = await pool.query(`
        SELECT readiness_level, COUNT(*) AS cnt
        FROM importer_assessments
        WHERE completed_at IS NOT NULL AND readiness_level IS NOT NULL
        GROUP BY readiness_level ORDER BY cnt DESC
      `);
      importerAssessments.byReadiness = impByLevel.rows.map(r => ({ level: r.readiness_level, count: toInt(r.cnt) }));

      const impByWeek = await pool.query(`
        SELECT date_trunc('week', completed_at)::date AS week, COUNT(*) AS cnt
        FROM importer_assessments
        WHERE completed_at IS NOT NULL AND completed_at > NOW() - INTERVAL '26 weeks'
        GROUP BY week ORDER BY week
      `);
      importerAssessments.byWeek = impByWeek.rows.map(r => ({ week: r.week, count: toInt(r.cnt) }));

      // PQC assessments
      const pqcTotal = await pool.query(`SELECT COUNT(*) AS cnt FROM pqc_assessments`);
      const pqcCompleted = await pool.query(`SELECT COUNT(*) AS cnt FROM pqc_assessments WHERE completed_at IS NOT NULL`);
      pqcAssessments.total = toInt(pqcTotal.rows[0]?.cnt);
      pqcAssessments.completed = toInt(pqcCompleted.rows[0]?.cnt);

      const pqcByLevel = await pool.query(`
        SELECT readiness_level, COUNT(*) AS cnt
        FROM pqc_assessments
        WHERE completed_at IS NOT NULL AND readiness_level IS NOT NULL
        GROUP BY readiness_level ORDER BY cnt DESC
      `);
      pqcAssessments.byReadiness = pqcByLevel.rows.map(r => ({ level: r.readiness_level, count: toInt(r.cnt) }));

      const pqcByWeek = await pool.query(`
        SELECT date_trunc('week', completed_at)::date AS week, COUNT(*) AS cnt
        FROM pqc_assessments
        WHERE completed_at IS NOT NULL AND completed_at > NOW() - INTERVAL '26 weeks'
        GROUP BY week ORDER BY week
      `);
      pqcAssessments.byWeek = pqcByWeek.rows.map(r => ({ week: r.week, count: toInt(r.cnt) }));

      // Launch list subscribers
      const subsResult = await pool.query(`SELECT COUNT(*) AS cnt FROM cra_launch_subscribers`);
      launchSubscribers = toInt(subsResult.rows[0]?.cnt);
    } catch {
      // Assessment tables may not exist in test DB — gracefully degrade
    }

    // --- Crypto health across all products ---
    let cryptoHealth = { scanned: 0, withBroken: 0, withQuantumVulnerable: 0, allQuantumSafe: 0 };
    try {
      const cryptoHealthResult = await pool.query(`
        SELECT
          COUNT(*) AS scanned,
          COUNT(*) FILTER (WHERE broken_count > 0) AS with_broken,
          COUNT(*) FILTER (WHERE quantum_vulnerable_count > 0 AND broken_count = 0) AS with_qv_only,
          COUNT(*) FILTER (WHERE broken_count = 0 AND quantum_vulnerable_count = 0) AS all_safe
        FROM crypto_scans
      `);
      const ch = cryptoHealthResult.rows[0];
      cryptoHealth = {
        scanned: toInt(ch?.scanned),
        withBroken: toInt(ch?.with_broken),
        withQuantumVulnerable: toInt(ch?.with_qv_only),
        allQuantumSafe: toInt(ch?.all_safe),
      };
    } catch {
      // crypto_scans table may not exist in test DB
    }

    // --- Field issues health ---
    let fieldIssueHealth = { total: 0, open: 0, resolved: 0, critical: 0, avgResolutionDays: null as number | null, byWeek: [] as { week: string; opened: number; resolved: number }[] };
    try {
      const fiTotals = await pool.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status IN ('open', 'investigating')) AS open,
          COUNT(*) FILTER (WHERE status IN ('resolved', 'closed')) AS resolved,
          COUNT(*) FILTER (WHERE severity = 'critical') AS critical,
          AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 86400)
            FILTER (WHERE resolved_at IS NOT NULL) AS avg_days
        FROM field_issues
      `);
      const fi = fiTotals.rows[0];
      fieldIssueHealth.total = toInt(fi?.total);
      fieldIssueHealth.open = toInt(fi?.open);
      fieldIssueHealth.resolved = toInt(fi?.resolved);
      fieldIssueHealth.critical = toInt(fi?.critical);
      fieldIssueHealth.avgResolutionDays = fi?.avg_days ? parseFloat(parseFloat(fi.avg_days).toFixed(1)) : null;

      const fiByWeek = await pool.query(`
        SELECT
          date_trunc('week', created_at)::date AS week,
          COUNT(*) AS opened,
          COUNT(*) FILTER (WHERE resolved_at IS NOT NULL) AS resolved
        FROM field_issues
        WHERE created_at > NOW() - INTERVAL '12 weeks'
        GROUP BY week ORDER BY week
      `);
      fieldIssueHealth.byWeek = fiByWeek.rows.map(r => ({
        week: r.week,
        opened: toInt(r.opened),
        resolved: toInt(r.resolved),
      }));
    } catch {
      // field_issues table may not exist
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
        importer: importerAssessments,
        pqc: pqcAssessments,
      },
      cryptoHealth,
      fieldIssueHealth,
      nbAssessments: await (async () => {
        try {
          const total = await pool.query(`SELECT COUNT(*) AS cnt FROM notified_body_assessments`);
          const byStatus = await pool.query(`
            SELECT status, COUNT(*) AS cnt FROM notified_body_assessments GROUP BY status ORDER BY cnt DESC
          `);
          const byModule = await pool.query(`
            SELECT module, COUNT(*) AS cnt FROM notified_body_assessments GROUP BY module ORDER BY cnt DESC
          `);
          return {
            total: toInt(total.rows[0]?.cnt),
            byStatus: byStatus.rows.map(r => ({ status: r.status, count: toInt(r.cnt) })),
            byModule: byModule.rows.map(r => ({ module: r.module, count: toInt(r.cnt) })),
          };
        } catch {
          return { total: 0, byStatus: [], byModule: [] };
        }
      })(),
      msRegistrations: await (async () => {
        try {
          const total = await pool.query(`SELECT COUNT(*) AS cnt FROM market_surveillance_registrations`);
          const byStatus = await pool.query(`
            SELECT status, COUNT(*) AS cnt FROM market_surveillance_registrations GROUP BY status ORDER BY cnt DESC
          `);
          const byCountry = await pool.query(`
            SELECT authority_country, COUNT(*) AS cnt FROM market_surveillance_registrations
            WHERE authority_country IS NOT NULL GROUP BY authority_country ORDER BY cnt DESC
          `);
          return {
            total: toInt(total.rows[0]?.cnt),
            byStatus: byStatus.rows.map(r => ({ status: r.status, count: toInt(r.cnt) })),
            byCountry: byCountry.rows.map(r => ({ country: r.authority_country, count: toInt(r.cnt) })),
          };
        } catch {
          return { total: 0, byStatus: [], byCountry: [] };
        }
      })(),
      supplyChain: await (async () => {
        try {
          const sbomCount = await pool.query(`SELECT COUNT(DISTINCT product_id) AS cnt FROM product_sboms`);
          const totalDeps = await pool.query(`SELECT SUM(package_count) AS cnt FROM product_sboms`);
          const vulnDeps = await pool.query(
            `SELECT COUNT(DISTINCT dependency_name) AS cnt FROM vulnerability_findings WHERE status IN ('open', 'acknowledged')`
          );
          const critHighVulns = await pool.query(
            `SELECT COUNT(*) AS cnt FROM vulnerability_findings WHERE status IN ('open', 'acknowledged') AND severity IN ('critical', 'high')`
          );
          const questionnaires = await pool.query(`SELECT COUNT(*) AS cnt FROM supplier_questionnaires`);
          const byStatus = await pool.query(
            `SELECT status, COUNT(*) AS cnt FROM supplier_questionnaires GROUP BY status ORDER BY cnt DESC`
          );
          return {
            productsWithSbom: toInt(sbomCount.rows[0]?.cnt),
            totalDependencies: toInt(totalDeps.rows[0]?.cnt),
            dependenciesWithVulns: toInt(vulnDeps.rows[0]?.cnt),
            criticalHighVulns: toInt(critHighVulns.rows[0]?.cnt),
            questionnaires: toInt(questionnaires.rows[0]?.cnt),
            questionnairesByStatus: byStatus.rows.map(r => ({ status: r.status, count: toInt(r.cnt) })),
          };
        } catch {
          return { productsWithSbom: 0, totalDependencies: 0, dependenciesWithVulns: 0, criticalHighVulns: 0, questionnaires: 0, questionnairesByStatus: [] };
        }
      })(),
      incidents: await (async () => {
        try {
          const total = await pool.query(`SELECT COUNT(*) AS cnt FROM incidents`);
          const byPhase = await pool.query(`
            SELECT phase, COUNT(*) AS cnt FROM incidents GROUP BY phase ORDER BY cnt DESC
          `);
          const bySeverity = await pool.query(`
            SELECT severity, COUNT(*) AS cnt FROM incidents GROUP BY severity ORDER BY cnt DESC
          `);
          const avgResolution = await pool.query(`
            SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - detected_at)) / 3600)::numeric(10,1) AS avg_hours
            FROM incidents WHERE resolved_at IS NOT NULL
          `);
          return {
            total: toInt(total.rows[0]?.cnt),
            byPhase: byPhase.rows.map(r => ({ phase: r.phase, count: toInt(r.cnt) })),
            bySeverity: bySeverity.rows.map(r => ({ severity: r.severity, count: toInt(r.cnt) })),
            avgResolutionHours: avgResolution.rows[0]?.avg_hours ? parseFloat(avgResolution.rows[0].avg_hours) : null,
          };
        } catch {
          return { total: 0, byPhase: [], bySeverity: [], avgResolutionHours: null };
        }
      })(),
      trustClassification: await (async () => {
        try {
          const byClassification = await pool.query(`
            SELECT trust_classification, COUNT(*) AS cnt FROM org_billing
            WHERE trust_classification IS NOT NULL
            GROUP BY trust_classification ORDER BY cnt DESC
          `);
          const freeCount = await pool.query(`
            SELECT COUNT(*) AS cnt FROM org_billing
            WHERE trust_classification IN ('provisional_open_source', 'trusted_open_source', 'community_project', 'verified_nonprofit')
          `);
          const reviewCount = await pool.query(`
            SELECT COUNT(*) AS cnt FROM org_billing WHERE trust_classification = 'review_required'
          `);
          return {
            byClassification: byClassification.rows.map(r => ({ classification: r.trust_classification, count: toInt(r.cnt) })),
            freeAccessOrgs: toInt(freeCount.rows[0]?.cnt),
            reviewRequired: toInt(reviewCount.rows[0]?.cnt),
          };
        } catch {
          return { byClassification: [], freeAccessOrgs: 0, reviewRequired: 0 };
        }
      })(),
    });
  } catch (err) {
    console.error('Admin analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

export default router;

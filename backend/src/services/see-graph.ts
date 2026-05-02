/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

/**
 * SEE Graph Builder & Query Service — Phase F
 *
 * Links SEE evidence nodes to existing CRANIS2 data (Dependencies,
 * SBOMs, Vulnerabilities) and provides provenance queries.
 */

import { getDriver } from '../db/neo4j.js';
import pool from '../db/pool.js';
import { logger } from '../utils/logger.js';

// ─── Types ──────────────────────────────────────────────────────────

export interface GraphSummary {
  productId: string;
  nodes: {
    developers: number;
    commits: number;
    modules: number;
    branches: number;
    experiments: number;
    dependencies: number;
    vulnerabilities: number;
  };
  relationships: {
    contributedTo: number;
    partOf: number;
    dependsOn: number;
  };
  completeness: 'partial' | 'basic' | 'rich' | 'full';
}

export interface ProvenanceResult {
  queryType: string;
  productId: string;
  results: any[];
  executedAt: string;
}

// ─── Graph Builder ──────────────────────────────────────────────────

export async function buildEvidenceGraph(productId: string): Promise<GraphSummary> {
  const session = getDriver().session();
  logger.info(`[SEE] Building evidence graph for product ${productId}`);

  try {
    // Link SEE developers to existing Contributors where email/login matches
    await session.run(
      `MATCH (d:SEEDeveloper {productId: $productId})
       MATCH (p:Product {id: $productId})-[:HAS_REPO]->(:Repository)-[:HAS_CONTRIBUTOR]->(c:Contributor)
       WHERE c.login = d.login AND d.login <> ''
       MERGE (d)-[:SAME_AS]->(c)`,
      { productId }
    );

    // Link experiments to the product
    const experiments = await pool.query(
      `SELECT id, experiment_type, title FROM see_experiments WHERE product_id = $1`,
      [productId]
    );
    for (const exp of experiments.rows) {
      await session.run(
        `MATCH (p:Product {id: $productId})
         MERGE (e:SEEExperiment {id: $expId})
         SET e.type = $type, e.title = $title, e.productId = $productId
         MERGE (e)-[:DETECTED_IN]->(p)`,
        { productId, expId: exp.id, type: exp.experiment_type, title: exp.title }
      );
    }

    // Link architecture events to the product
    const archEvents = await pool.query(
      `SELECT id, event_type, title FROM see_architecture_events WHERE product_id = $1`,
      [productId]
    );
    for (const evt of archEvents.rows) {
      await session.run(
        `MATCH (p:Product {id: $productId})
         MERGE (a:SEEArchitectureChange {id: $evtId})
         SET a.type = $type, a.title = $title, a.productId = $productId
         MERGE (a)-[:CHANGED]->(p)`,
        { productId, evtId: evt.id, type: evt.event_type, title: evt.title }
      );
    }

    // Get graph summary
    const summary = await getGraphSummary(productId);
    logger.info(`[SEE] Evidence graph built: ${summary.nodes.developers} devs, ${summary.nodes.modules} modules, ${summary.nodes.dependencies} deps`);

    return summary;
  } finally {
    await session.close();
  }
}

// ─── Graph Summary ──────────────────────────────────────────────────

export async function getGraphSummary(productId: string): Promise<GraphSummary> {
  const session = getDriver().session();

  try {
    const result = await session.run(
      `MATCH (p:Product {id: $productId})
       OPTIONAL MATCH (d:SEEDeveloper {productId: $productId})
       OPTIONAL MATCH (m:SEEModule {productId: $productId})
       OPTIONAL MATCH (e:SEEExperiment {productId: $productId})
       OPTIONAL MATCH (a:SEEArchitectureChange {productId: $productId})
       OPTIONAL MATCH (p)-[:DEPENDS_ON]->(dep:Dependency)
       WITH p,
         COUNT(DISTINCT d) AS devCount,
         COUNT(DISTINCT m) AS modCount,
         COUNT(DISTINCT e) AS expCount,
         COUNT(DISTINCT a) AS archCount,
         COUNT(DISTINCT dep) AS depCount
       RETURN devCount, modCount, expCount, archCount, depCount`,
      { productId }
    );

    const row = result.records[0];
    const devCount = row?.get('devCount')?.toNumber?.() || row?.get('devCount') || 0;
    const modCount = row?.get('modCount')?.toNumber?.() || row?.get('modCount') || 0;
    const expCount = row?.get('expCount')?.toNumber?.() || row?.get('expCount') || 0;
    const archCount = row?.get('archCount')?.toNumber?.() || row?.get('archCount') || 0;
    const depCount = row?.get('depCount')?.toNumber?.() || row?.get('depCount') || 0;

    // Get commit and branch counts from Postgres (faster)
    const commitCount = await pool.query(
      `SELECT COUNT(*) AS cnt FROM see_commits WHERE product_id = $1`,
      [productId]
    );
    const branchCount = await pool.query(
      `SELECT COUNT(*) AS cnt FROM see_branches WHERE product_id = $1`,
      [productId]
    );

    // Get vulnerability count
    const vulnCount = await pool.query(
      `SELECT COUNT(*) AS cnt FROM vulnerability_findings WHERE product_id = $1`,
      [productId]
    );

    const commits = parseInt(commitCount.rows[0]?.cnt) || 0;
    const branches = parseInt(branchCount.rows[0]?.cnt) || 0;
    const vulns = parseInt(vulnCount.rows[0]?.cnt) || 0;

    // Determine completeness
    let completeness: 'partial' | 'basic' | 'rich' | 'full' = 'partial';
    if (commits > 0 && devCount > 0) completeness = 'basic';
    if (completeness === 'basic' && branches > 0 && expCount > 0) completeness = 'rich';
    if (completeness === 'rich' && modCount > 0 && archCount > 0) completeness = 'full';

    return {
      productId,
      nodes: {
        developers: devCount,
        commits,
        modules: modCount,
        branches,
        experiments: expCount,
        dependencies: depCount,
        vulnerabilities: vulns,
      },
      relationships: {
        contributedTo: devCount, // 1:1 with devs
        partOf: modCount,
        dependsOn: depCount,
      },
      completeness,
    };
  } finally {
    await session.close();
  }
}

// ─── Provenance Queries ─────────────────────────────────────────────

export async function queryProvenance(
  productId: string,
  queryType: string,
): Promise<ProvenanceResult> {
  const session = getDriver().session();

  try {
    let results: any[] = [];

    switch (queryType) {
      case 'developer-contributions': {
        const r = await session.run(
          `MATCH (d:SEEDeveloper {productId: $productId})-[:CONTRIBUTED_TO]->(p:Product {id: $productId})
           RETURN d.name AS name, d.login AS login, d.email AS email,
                  d.commitCount AS commits, d.additions AS additions, d.deletions AS deletions,
                  d.firstCommitAt AS firstCommit, d.lastCommitAt AS lastCommit
           ORDER BY d.commitCount DESC`,
          { productId }
        );
        results = r.records.map(rec => ({
          name: rec.get('name'),
          login: rec.get('login'),
          email: rec.get('email'),
          commits: rec.get('commits')?.toNumber?.() || rec.get('commits'),
          additions: rec.get('additions')?.toNumber?.() || rec.get('additions'),
          deletions: rec.get('deletions')?.toNumber?.() || rec.get('deletions'),
          firstCommit: rec.get('firstCommit'),
          lastCommit: rec.get('lastCommit'),
        }));
        break;
      }

      case 'module-structure': {
        const r = await session.run(
          `MATCH (m:SEEModule {productId: $productId})-[:PART_OF]->(p:Product {id: $productId})
           RETURN m.name AS name, m.path AS path, m.fileCount AS files, m.loc AS loc
           ORDER BY m.loc DESC`,
          { productId }
        );
        results = r.records.map(rec => ({
          name: rec.get('name'),
          path: rec.get('path'),
          files: rec.get('files')?.toNumber?.() || rec.get('files'),
          loc: rec.get('loc')?.toNumber?.() || rec.get('loc'),
        }));
        break;
      }

      case 'dependency-exposure': {
        // Which dependencies have known vulnerabilities?
        const r = await pool.query(
          `SELECT DISTINCT vf.dependency_name, vf.dependency_version, vf.severity, vf.status, vf.cve_id
           FROM vulnerability_findings vf
           WHERE vf.product_id = $1 AND vf.status != 'dismissed'
           ORDER BY
             CASE vf.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
             vf.dependency_name
           LIMIT 50`,
          [productId]
        );
        results = r.rows.map(row => ({
          dependency: row.dependency_name,
          version: row.dependency_version,
          severity: row.severity,
          status: row.status,
          cveId: row.cve_id,
        }));
        break;
      }

      case 'experiment-timeline': {
        const r = await pool.query(
          `SELECT experiment_type, title, description, start_date, end_date, confidence, uncertainty_indicator
           FROM see_experiments
           WHERE product_id = $1
           ORDER BY start_date ASC NULLS LAST`,
          [productId]
        );
        results = r.rows.map(row => ({
          type: row.experiment_type,
          title: row.title,
          description: row.description,
          startDate: row.start_date,
          endDate: row.end_date,
          confidence: row.confidence,
          uncertaintyIndicator: row.uncertainty_indicator,
        }));
        break;
      }

      case 'architecture-timeline': {
        const r = await pool.query(
          `SELECT event_type, title, description, affected_modules, detected_at
           FROM see_architecture_events
           WHERE product_id = $1
           ORDER BY detected_at ASC NULLS LAST`,
          [productId]
        );
        results = r.rows.map(row => ({
          type: row.event_type,
          title: row.title,
          description: row.description,
          modules: row.affected_modules,
          detectedAt: row.detected_at,
        }));
        break;
      }

      default:
        results = [];
    }

    return {
      queryType,
      productId,
      results,
      executedAt: new Date().toISOString(),
    };
  } finally {
    await session.close();
  }
}

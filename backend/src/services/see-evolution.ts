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
 * SEE Evolution Detector — Phase E
 *
 * Detects architecture evolution and test evolution from commit history.
 * Works from already-ingested commit data — no additional API calls needed.
 */

import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { logger } from '../utils/logger.js';

// ─── Types ──────────────────────────────────────────────────────────

export type ArchEventType =
  | 'module_created'
  | 'module_restructured'
  | 'layer_introduced'
  | 'schema_migration'
  | 'api_redesign'
  | 'decomposition';

export interface ArchitectureEvent {
  eventType: ArchEventType;
  title: string;
  description: string;
  affectedModules: string[];
  evidenceCommits: string[];
  detectedAt: string | null;
}

export interface TestEvolutionPoint {
  month: string;
  testFilesAdded: number;
  testFilesModified: number;
  testLocAdded: number;
  sourceCommits: number;
  testCommits: number;
  testRatio: number;
}

export interface EvolutionResult {
  productId: string;
  architectureEvents: ArchitectureEvent[];
  testEvolution: TestEvolutionPoint[];
  modules: ModuleInfo[];
  summary: {
    totalArchEvents: number;
    totalModules: number;
    testGrowthTrend: 'growing' | 'stable' | 'declining' | 'none';
    architectureMaturity: 'early' | 'evolving' | 'stable' | 'mature';
  };
}

export interface ModuleInfo {
  name: string;
  path: string;
  commitCount: number;
  firstSeen: string;
  lastModified: string;
}

// ─── Architecture Evolution Detection ───────────────────────────────

/**
 * Detect architecture events from commit message patterns.
 * Since we don't have per-commit file lists from the GitHub commits API
 * (it would require individual commit fetches), we infer from commit
 * messages and the file classification data from Phase A.
 */
async function detectArchitectureEvents(productId: string): Promise<ArchitectureEvent[]> {
  const events: ArchitectureEvent[] = [];

  // 1. Detect refactoring/restructuring commits that mention modules
  const restructureCommits = await pool.query(
    `SELECT sha, authored_at, message_summary
     FROM see_commits
     WHERE product_id = $1
       AND (classified_type = 'refactor' OR message_summary ~* '(restructur|reorgani[sz]|decompos|split|extract|move.*to|migrat)')
     ORDER BY authored_at ASC`,
    [productId]
  );

  // Group restructure commits by month
  const monthGroups: Record<string, { shas: string[]; messages: string[]; date: string }> = {};
  for (const row of restructureCommits.rows) {
    const month = new Date(row.authored_at).toISOString().slice(0, 7);
    if (!monthGroups[month]) monthGroups[month] = { shas: [], messages: [], date: row.authored_at };
    monthGroups[month].shas.push(row.sha);
    monthGroups[month].messages.push(row.message_summary);
  }

  for (const [month, group] of Object.entries(monthGroups)) {
    if (group.shas.length >= 3) {
      events.push({
        eventType: 'module_restructured',
        title: `Module restructuring: ${month} (${group.shas.length} commits)`,
        description: `${group.shas.length} restructuring commits in ${month}. Examples: "${group.messages[0]}", "${group.messages[Math.min(1, group.messages.length - 1)]}".`,
        affectedModules: extractModulesFromMessages(group.messages),
        evidenceCommits: group.shas.slice(0, 10),
        detectedAt: group.date,
      });
    }
  }

  // 2. Detect schema/migration commits
  const migrationCommits = await pool.query(
    `SELECT sha, authored_at, message_summary
     FROM see_commits
     WHERE product_id = $1
       AND message_summary ~* '(migrat|schema|database|table|column|ALTER|CREATE TABLE)'
     ORDER BY authored_at ASC`,
    [productId]
  );

  if (migrationCommits.rows.length > 0) {
    events.push({
      eventType: 'schema_migration',
      title: `Database schema evolution: ${migrationCommits.rows.length} migration commits`,
      description: `${migrationCommits.rows.length} commits related to database schema changes across the project lifetime.`,
      affectedModules: ['database'],
      evidenceCommits: migrationCommits.rows.slice(0, 10).map((r: any) => r.sha),
      detectedAt: migrationCommits.rows[0]?.authored_at || null,
    });
  }

  // 3. Detect API route/endpoint changes
  const apiCommits = await pool.query(
    `SELECT sha, authored_at, message_summary
     FROM see_commits
     WHERE product_id = $1
       AND message_summary ~* '(route|endpoint|api|REST|controller|middleware)'
       AND classified_type IN ('feature', 'refactor')
     ORDER BY authored_at ASC`,
    [productId]
  );

  if (apiCommits.rows.length >= 5) {
    events.push({
      eventType: 'api_redesign',
      title: `API evolution: ${apiCommits.rows.length} route/endpoint commits`,
      description: `${apiCommits.rows.length} commits involved API route or endpoint changes, indicating evolving system interfaces.`,
      affectedModules: ['api', 'routes'],
      evidenceCommits: apiCommits.rows.slice(0, 10).map((r: any) => r.sha),
      detectedAt: apiCommits.rows[0]?.authored_at || null,
    });
  }

  // 4. Detect decomposition events (commits mentioning split, decompose, extract)
  const decompCommits = await pool.query(
    `SELECT sha, authored_at, message_summary
     FROM see_commits
     WHERE product_id = $1
       AND message_summary ~* '(decompos|split.*into|extract.*from|break.*into|separate)'
     ORDER BY authored_at ASC`,
    [productId]
  );

  for (const row of decompCommits.rows) {
    events.push({
      eventType: 'decomposition',
      title: `Decomposition: ${row.message_summary.slice(0, 80)}`,
      description: `Code decomposition event: "${row.message_summary}". This indicates a deliberate architectural decision to improve modularity.`,
      affectedModules: extractModulesFromMessages([row.message_summary]),
      evidenceCommits: [row.sha],
      detectedAt: row.authored_at,
    });
  }

  // Sort by date
  events.sort((a, b) => {
    const da = a.detectedAt ? new Date(a.detectedAt).getTime() : 0;
    const db = b.detectedAt ? new Date(b.detectedAt).getTime() : 0;
    return da - db;
  });

  return events;
}

function extractModulesFromMessages(messages: string[]): string[] {
  const modules = new Set<string>();
  for (const msg of messages) {
    // Extract words after common prefixes
    const match = msg.match(/(?:refactor|restructure|decompose|split|extract|move)\s*[:(]?\s*(\w[\w\-/]*)/i);
    if (match) modules.add(match[1].toLowerCase());
  }
  return Array.from(modules).slice(0, 5);
}

// ─── Test Evolution Detection ───────────────────────────────────────

async function detectTestEvolution(productId: string): Promise<TestEvolutionPoint[]> {
  // Get monthly commit counts split by test vs non-test
  const result = await pool.query(
    `SELECT
       to_char(authored_at, 'YYYY-MM') AS month,
       COUNT(*) FILTER (WHERE classified_type = 'test') AS test_commits,
       COUNT(*) FILTER (WHERE classified_type != 'test' OR classified_type IS NULL) AS source_commits,
       SUM(additions) FILTER (WHERE classified_type = 'test') AS test_additions,
       COUNT(*)  AS total_commits
     FROM see_commits
     WHERE product_id = $1
     GROUP BY to_char(authored_at, 'YYYY-MM')
     ORDER BY month ASC`,
    [productId]
  );

  const points: TestEvolutionPoint[] = result.rows.map((r: any) => {
    const testCommits = parseInt(r.test_commits) || 0;
    const sourceCommits = parseInt(r.source_commits) || 0;
    const total = parseInt(r.total_commits) || 1;

    return {
      month: r.month,
      testFilesAdded: 0, // Would need file-level data
      testFilesModified: 0,
      testLocAdded: parseInt(r.test_additions) || 0,
      sourceCommits,
      testCommits,
      testRatio: Math.round(testCommits / total * 100),
    };
  });

  // Store the evolution data
  for (const point of points) {
    await pool.query(
      `INSERT INTO see_test_events (product_id, month, test_files_added, test_files_modified, test_loc_added, source_commits, test_commits)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (product_id, month) DO UPDATE SET
         test_loc_added = EXCLUDED.test_loc_added,
         source_commits = EXCLUDED.source_commits,
         test_commits = EXCLUDED.test_commits`,
      [productId, point.month, point.testFilesAdded, point.testFilesModified,
       point.testLocAdded, point.sourceCommits, point.testCommits]
    );
  }

  return points;
}

// ─── Module Inference ───────────────────────────────────────────────

async function inferModules(productId: string): Promise<ModuleInfo[]> {
  // Infer modules from the file classification data stored in Phase A
  const scanResult = await pool.query(
    `SELECT file_detail FROM see_analysis_runs
     WHERE product_id = $1 AND scan_status = 'completed'
     ORDER BY created_at DESC LIMIT 1`,
    [productId]
  );

  if (scanResult.rows.length === 0) return [];

  const fileDetail: Array<{ path: string; language: string; classification: string; loc: number }> =
    scanResult.rows[0].file_detail || [];

  // Group by top-level directory
  const moduleMap: Record<string, { files: number; loc: number; languages: Set<string> }> = {};
  for (const f of fileDetail) {
    const parts = f.path.split('/');
    const topDir = parts.length > 1 ? parts[0] : '(root)';
    if (!moduleMap[topDir]) moduleMap[topDir] = { files: 0, loc: 0, languages: new Set() };
    moduleMap[topDir].files++;
    moduleMap[topDir].loc += f.loc;
    if (f.language) moduleMap[topDir].languages.add(f.language);
  }

  const modules: ModuleInfo[] = Object.entries(moduleMap)
    .filter(([, data]) => data.files >= 3) // Only count directories with 3+ files
    .sort((a, b) => b[1].loc - a[1].loc)
    .map(([name, data]) => ({
      name,
      path: name,
      commitCount: data.files,
      firstSeen: '',
      lastModified: '',
    }));

  // Store module nodes in Neo4j
  const session = getDriver().session();
  try {
    for (const mod of modules) {
      await session.run(
        `MATCH (p:Product {id: $productId})
         MERGE (m:SEEModule {name: $name, productId: $productId})
         SET m.path = $path, m.fileCount = $fileCount, m.loc = $loc
         MERGE (m)-[:PART_OF]->(p)`,
        {
          productId,
          name: mod.name,
          path: mod.path,
          fileCount: moduleMap[mod.name]?.files || 0,
          loc: moduleMap[mod.name]?.loc || 0,
        }
      );
    }
  } finally {
    await session.close();
  }

  return modules;
}

// ─── Main Orchestrator ──────────────────────────────────────────────

export async function runEvolutionAnalysis(productId: string): Promise<EvolutionResult> {
  logger.info(`[SEE] Running evolution analysis for product ${productId}`);

  const [archEvents, testEvolution, modules] = await Promise.all([
    detectArchitectureEvents(productId),
    detectTestEvolution(productId),
    inferModules(productId),
  ]);

  // Store architecture events
  await pool.query('DELETE FROM see_architecture_events WHERE product_id = $1', [productId]);
  for (const event of archEvents) {
    await pool.query(
      `INSERT INTO see_architecture_events (product_id, event_type, title, description, affected_modules, evidence_commits, detected_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [productId, event.eventType, event.title, event.description,
       JSON.stringify(event.affectedModules), JSON.stringify(event.evidenceCommits), event.detectedAt]
    );
  }

  // Determine test growth trend
  let testTrend: 'growing' | 'stable' | 'declining' | 'none' = 'none';
  if (testEvolution.length >= 3) {
    const recent = testEvolution.slice(-3);
    const earlier = testEvolution.slice(0, Math.min(3, testEvolution.length));
    const recentAvg = recent.reduce((s, p) => s + p.testRatio, 0) / recent.length;
    const earlierAvg = earlier.reduce((s, p) => s + p.testRatio, 0) / earlier.length;
    if (recentAvg > earlierAvg + 5) testTrend = 'growing';
    else if (recentAvg < earlierAvg - 5) testTrend = 'declining';
    else testTrend = 'stable';
  }

  // Determine architecture maturity
  let maturity: 'early' | 'evolving' | 'stable' | 'mature' = 'early';
  if (archEvents.length === 0) maturity = 'stable';
  else if (archEvents.length <= 3) maturity = 'evolving';
  else if (archEvents.length <= 8) maturity = 'evolving';
  else maturity = 'mature'; // Many arch events = actively maintained

  logger.info(`[SEE] Evolution analysis complete: ${archEvents.length} arch events, ${modules.length} modules, test trend: ${testTrend}`);

  return {
    productId,
    architectureEvents: archEvents,
    testEvolution,
    modules,
    summary: {
      totalArchEvents: archEvents.length,
      totalModules: modules.length,
      testGrowthTrend: testTrend,
      architectureMaturity: maturity,
    },
  };
}

// ─── Query Functions ────────────────────────────────────────────────

export async function getEvolutionData(productId: string): Promise<EvolutionResult | null> {
  const archResult = await pool.query(
    `SELECT * FROM see_architecture_events WHERE product_id = $1 ORDER BY detected_at ASC NULLS LAST`,
    [productId]
  );

  const testResult = await pool.query(
    `SELECT * FROM see_test_events WHERE product_id = $1 ORDER BY month ASC`,
    [productId]
  );

  if (archResult.rows.length === 0 && testResult.rows.length === 0) return null;

  const architectureEvents: ArchitectureEvent[] = archResult.rows.map((r: any) => ({
    eventType: r.event_type,
    title: r.title,
    description: r.description,
    affectedModules: r.affected_modules || [],
    evidenceCommits: r.evidence_commits || [],
    detectedAt: r.detected_at,
  }));

  const testEvolution: TestEvolutionPoint[] = testResult.rows.map((r: any) => ({
    month: r.month,
    testFilesAdded: r.test_files_added,
    testFilesModified: r.test_files_modified,
    testLocAdded: r.test_loc_added,
    sourceCommits: r.source_commits,
    testCommits: r.test_commits,
    testRatio: r.source_commits + r.test_commits > 0
      ? Math.round(r.test_commits / (r.source_commits + r.test_commits) * 100)
      : 0,
  }));

  // Get modules from Neo4j
  const session = getDriver().session();
  let modules: ModuleInfo[] = [];
  try {
    const modResult = await session.run(
      `MATCH (m:SEEModule {productId: $productId}) RETURN m ORDER BY m.loc DESC`,
      { productId }
    );
    modules = modResult.records.map((r: any) => {
      const m = r.get('m').properties;
      return { name: m.name, path: m.path, commitCount: m.fileCount || 0, firstSeen: '', lastModified: '' };
    });
  } finally {
    await session.close();
  }

  let testTrend: 'growing' | 'stable' | 'declining' | 'none' = 'none';
  if (testEvolution.length >= 3) {
    const recent = testEvolution.slice(-3);
    const earlier = testEvolution.slice(0, 3);
    const recentAvg = recent.reduce((s, p) => s + p.testRatio, 0) / recent.length;
    const earlierAvg = earlier.reduce((s, p) => s + p.testRatio, 0) / earlier.length;
    if (recentAvg > earlierAvg + 5) testTrend = 'growing';
    else if (recentAvg < earlierAvg - 5) testTrend = 'declining';
    else testTrend = 'stable';
  }

  return {
    productId,
    architectureEvents,
    testEvolution,
    modules,
    summary: {
      totalArchEvents: architectureEvents.length,
      totalModules: modules.length,
      testGrowthTrend: testTrend,
      architectureMaturity: architectureEvents.length > 8 ? 'mature' : architectureEvents.length > 3 ? 'evolving' : 'early',
    },
  };
}

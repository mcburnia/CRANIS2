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
 * SEE Classifier — Phase C
 *
 * Deterministic commit classification and branch type detection.
 * No AI — pure pattern matching on commit messages and branch names.
 */

import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { getBranches, type NormalisedBranch } from './repo-provider.js';
import { resolveRepoConnection } from './repo-helpers.js';
import { logger } from '../utils/logger.js';

// ─── Commit Classification ──────────────────────────────────────────

export type CommitType = 'feature' | 'fix' | 'refactor' | 'test' | 'docs' | 'chore' | 'experiment' | 'style' | 'other';

const COMMIT_PATTERNS: { type: CommitType; patterns: RegExp[] }[] = [
  { type: 'fix', patterns: [
    /^fix[\s(:]/i, /^bugfix[\s(:]/i, /^hotfix[\s(:]/i, /^patch[\s(:]/i,
    /\bfix(es|ed)?\b/i, /\bbug\b/i, /\bresolve[sd]?\b/i,
  ]},
  { type: 'feature', patterns: [
    /^feat[\s(:]/i, /^feature[\s(:]/i, /^add[\s(:]/i, /^implement[\s(:]/i,
    /^new[\s(:]/i, /^introduce[\s(:]/i,
  ]},
  { type: 'refactor', patterns: [
    /^refactor[\s(:]/i, /^restructure[\s(:]/i, /^reorgani[sz]e[\s(:]/i,
    /^simplify[\s(:]/i, /^clean[\s(:]/i, /^decompose[\s(:]/i,
    /^extract[\s(:]/i, /^move[\s(:]/i, /^rename[\s(:]/i,
  ]},
  { type: 'test', patterns: [
    /^test[\s(:]/i, /^tests[\s(:]/i, /^spec[\s(:]/i,
    /\badd(ed|ing)?\s+tests?\b/i, /\btest\s+coverage\b/i,
  ]},
  { type: 'docs', patterns: [
    /^docs?[\s(:]/i, /^documentation[\s(:]/i, /^readme[\s(:]/i,
    /^update\s+readme/i, /^update\s+docs/i, /^comment[\s(:]/i,
  ]},
  { type: 'experiment', patterns: [
    /^experiment[\s(:]/i, /^spike[\s(:]/i, /^poc[\s(:]/i, /^prototype[\s(:]/i,
    /^wip[\s(:]/i, /^try[\s(:]/i, /^attempt[\s(:]/i, /^explore[\s(:]/i,
    /\bexperimental\b/i, /\bprototype\b/i, /\bspike\b/i, /\bpoc\b/i,
  ]},
  { type: 'style', patterns: [
    /^style[\s(:]/i, /^format[\s(:]/i, /^lint[\s(:]/i,
    /^prettier[\s(:]/i, /^eslint[\s(:]/i,
  ]},
  { type: 'chore', patterns: [
    /^chore[\s(:]/i, /^build[\s(:]/i, /^ci[\s(:]/i, /^deps[\s(:]/i,
    /^bump[\s(:]/i, /^upgrade[\s(:]/i, /^update[\s(:]/i,
    /^merge[\s(:]/i, /^release[\s(:]/i, /^version[\s(:]/i,
  ]},
];

export function classifyCommit(messageSummary: string): CommitType {
  const msg = messageSummary.trim();
  if (!msg) return 'other';

  for (const { type, patterns } of COMMIT_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(msg)) return type;
    }
  }

  return 'other';
}

// ─── Branch Type Classification ─────────────────────────────────────

export type BranchType = 'default' | 'feature' | 'bugfix' | 'release' | 'experiment' | 'hotfix' | 'other';

const BRANCH_PATTERNS: { type: BranchType; patterns: RegExp[] }[] = [
  { type: 'feature', patterns: [/^feature[/\-]/i, /^feat[/\-]/i, /^add[/\-]/i] },
  { type: 'bugfix', patterns: [/^fix[/\-]/i, /^bugfix[/\-]/i, /^bug[/\-]/i] },
  { type: 'hotfix', patterns: [/^hotfix[/\-]/i, /^sec[/\-]/i, /^security[/\-]/i] },
  { type: 'release', patterns: [/^release[/\-]/i, /^v\d/i, /^version[/\-]/i] },
  { type: 'experiment', patterns: [
    /^experiment[/\-]/i, /^spike[/\-]/i, /^poc[/\-]/i, /^prototype[/\-]/i,
    /^try[/\-]/i, /^wip[/\-]/i, /^explore[/\-]/i, /^test[/\-]/i,
  ]},
];

export function classifyBranch(name: string, isDefault: boolean): BranchType {
  if (isDefault) return 'default';

  for (const { type, patterns } of BRANCH_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(name)) return type;
    }
  }

  return 'other';
}

// ─── Run Branch & Classification Analysis ───────────────────────────

export interface BranchAnalysisResult {
  productId: string;
  totalBranches: number;
  branchTypes: Record<BranchType, number>;
  branches: BranchRecord[];
  commitTypes: Record<CommitType, number>;
  totalCommitsClassified: number;
  rewriteRatio: number;
  moduleChurn: ModuleChurn[];
}

export interface BranchRecord {
  name: string;
  branchType: BranchType;
  isDefault: boolean;
  isProtected: boolean;
  headSha: string;
}

export interface ModuleChurn {
  module: string;
  additions: number;
  deletions: number;
  rewriteRatio: number;
  commitCount: number;
}

export async function runBranchAnalysis(
  productId: string,
  orgId: string,
  userId: string,
): Promise<BranchAnalysisResult> {
  // Resolve repo connection
  const neo4jSession = getDriver().session();
  let repoUrl = '';
  let defaultBranch = 'main';

  try {
    const result = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       OPTIONAL MATCH (p)-[:HAS_REPO]->(r:Repository)
       RETURN r.url AS repoUrl, r.defaultBranch AS branch`,
      { orgId, productId }
    );
    if (result.records.length === 0) throw new Error('Product not found');
    repoUrl = result.records[0].get('repoUrl') || '';
    defaultBranch = result.records[0].get('branch') || 'main';
  } finally {
    await neo4jSession.close();
  }

  if (!repoUrl) throw new Error('No repository connected');

  const conn = await resolveRepoConnection(userId, repoUrl);
  if (!conn) throw new Error('Cannot resolve repository connection');

  const { token, provider, owner, repo, instanceUrl } = conn;

  // Fetch branches
  logger.info(`[SEE] Fetching branches for product ${productId}`);
  const rawBranches = await getBranches(provider, token, owner, repo, defaultBranch, instanceUrl || undefined);

  // Classify branches
  const branches: BranchRecord[] = rawBranches.map(b => ({
    name: b.name,
    branchType: classifyBranch(b.name, b.isDefault),
    isDefault: b.isDefault,
    isProtected: b.isProtected,
    headSha: b.headSha,
  }));

  // Store branches
  for (const b of branches) {
    await pool.query(
      `INSERT INTO see_branches (product_id, name, branch_type, is_default, is_protected, head_sha)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (product_id, name) DO UPDATE SET
         branch_type = EXCLUDED.branch_type, is_protected = EXCLUDED.is_protected,
         head_sha = EXCLUDED.head_sha, updated_at = NOW()`,
      [productId, b.name, b.branchType, b.isDefault, b.isProtected, b.headSha]
    );
  }

  // Classify all commits
  const commits = await pool.query(
    `SELECT id, message_summary FROM see_commits WHERE product_id = $1`,
    [productId]
  );

  const commitTypes: Record<CommitType, number> = {
    feature: 0, fix: 0, refactor: 0, test: 0, docs: 0,
    chore: 0, experiment: 0, style: 0, other: 0,
  };

  for (const row of commits.rows) {
    const ct = classifyCommit(row.message_summary || '');
    commitTypes[ct]++;
    // Update the commit record with its classification
    await pool.query(
      `UPDATE see_commits SET classified_type = $2 WHERE id = $1`,
      [row.id, ct]
    );
  }

  // Calculate module-level rewrite ratio from commit messages
  // (We extract module from file paths in future phases; for now use commit-level additions/deletions)
  const churnResult = await pool.query(
    `SELECT
       SPLIT_PART(message_summary, ':', 1) AS prefix,
       SUM(additions) AS additions,
       SUM(deletions) AS deletions,
       COUNT(*) AS commit_count
     FROM see_commits
     WHERE product_id = $1 AND additions > 0
     GROUP BY SPLIT_PART(message_summary, ':', 1)
     ORDER BY SUM(additions) + SUM(deletions) DESC
     LIMIT 20`,
    [productId]
  );

  const moduleChurn: ModuleChurn[] = churnResult.rows
    .filter(r => r.additions > 0)
    .map(r => ({
      module: r.prefix?.trim() || 'unknown',
      additions: parseInt(r.additions) || 0,
      deletions: parseInt(r.deletions) || 0,
      rewriteRatio: parseInt(r.additions) > 0
        ? Math.round(parseInt(r.deletions) / parseInt(r.additions) * 100) / 100
        : 0,
      commitCount: parseInt(r.commit_count) || 0,
    }));

  // Branch type summary
  const branchTypes: Record<BranchType, number> = {
    default: 0, feature: 0, bugfix: 0, release: 0, experiment: 0, hotfix: 0, other: 0,
  };
  for (const b of branches) {
    branchTypes[b.branchType]++;
  }

  // Overall rewrite ratio
  const overallStats = await pool.query(
    `SELECT SUM(additions) AS adds, SUM(deletions) AS dels FROM see_commits WHERE product_id = $1`,
    [productId]
  );
  const totalAdds = parseInt(overallStats.rows[0]?.adds) || 0;
  const totalDels = parseInt(overallStats.rows[0]?.dels) || 0;
  const rewriteRatio = totalAdds > 0 ? Math.round(totalDels / totalAdds * 100) / 100 : 0;

  logger.info(`[SEE] Branch analysis complete: ${branches.length} branches, ${commits.rows.length} commits classified`);

  return {
    productId,
    totalBranches: branches.length,
    branchTypes,
    branches,
    commitTypes,
    totalCommitsClassified: commits.rows.length,
    rewriteRatio,
    moduleChurn,
  };
}

// ─── Query Functions ────────────────────────────────────────────────

export async function getBranchAnalysis(productId: string): Promise<BranchAnalysisResult | null> {
  const branchResult = await pool.query(
    `SELECT * FROM see_branches WHERE product_id = $1 ORDER BY is_default DESC, name ASC`,
    [productId]
  );

  if (branchResult.rows.length === 0) return null;

  const branches: BranchRecord[] = branchResult.rows.map(r => ({
    name: r.name,
    branchType: r.branch_type as BranchType,
    isDefault: r.is_default,
    isProtected: r.is_protected,
    headSha: r.head_sha,
  }));

  const branchTypes: Record<BranchType, number> = {
    default: 0, feature: 0, bugfix: 0, release: 0, experiment: 0, hotfix: 0, other: 0,
  };
  for (const b of branches) branchTypes[b.branchType]++;

  // Commit type breakdown
  const commitResult = await pool.query(
    `SELECT classified_type, COUNT(*) AS cnt
     FROM see_commits WHERE product_id = $1 AND classified_type IS NOT NULL
     GROUP BY classified_type`,
    [productId]
  );
  const commitTypes: Record<CommitType, number> = {
    feature: 0, fix: 0, refactor: 0, test: 0, docs: 0,
    chore: 0, experiment: 0, style: 0, other: 0,
  };
  for (const r of commitResult.rows) {
    if (r.classified_type in commitTypes) {
      commitTypes[r.classified_type as CommitType] = parseInt(r.cnt) || 0;
    }
  }
  const totalClassified = Object.values(commitTypes).reduce((a, b) => a + b, 0);

  // Overall rewrite ratio
  const stats = await pool.query(
    `SELECT SUM(additions) AS adds, SUM(deletions) AS dels FROM see_commits WHERE product_id = $1`,
    [productId]
  );
  const totalAdds = parseInt(stats.rows[0]?.adds) || 0;
  const totalDels = parseInt(stats.rows[0]?.dels) || 0;

  return {
    productId,
    totalBranches: branches.length,
    branchTypes,
    branches,
    commitTypes,
    totalCommitsClassified: totalClassified,
    rewriteRatio: totalAdds > 0 ? Math.round(totalDels / totalAdds * 100) / 100 : 0,
    moduleChurn: [],
  };
}

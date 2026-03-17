/**
 * SEE Commit Ingestor — Phase B
 *
 * Fetches commit history from the repository API, stores commits and
 * developer attribution data. Supports incremental ingestion (only
 * fetches commits newer than the last known commit).
 */

import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { getCommitsPaginated, type NormalisedCommit } from './repo-provider.js';
import { resolveRepoConnection } from './repo-helpers.js';
import { logger } from '../utils/logger.js';

// ─── Types ──────────────────────────────────────────────────────────

export interface CommitSummary {
  productId: string;
  totalCommits: number;
  firstCommitDate: string | null;
  lastCommitDate: string | null;
  activeMonths: number;
  totalAdditions: number;
  totalDeletions: number;
  rewriteRatio: number;
  newCommitsIngested: number;
}

export interface DeveloperAttribution {
  authorName: string;
  authorEmail: string;
  authorLogin: string;
  commitCount: number;
  additions: number;
  deletions: number;
  firstCommitAt: string;
  lastCommitAt: string;
  contributionPct: number;
}

export interface CommitActivityPoint {
  month: string; // YYYY-MM
  commits: number;
  additions: number;
  deletions: number;
}

// ─── Ingest Commits ─────────────────────────────────────────────────

export async function ingestCommits(
  productId: string,
  orgId: string,
  userId: string,
): Promise<CommitSummary> {
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

  if (!repoUrl) throw new Error('No repository connected to this product');

  const conn = await resolveRepoConnection(userId, repoUrl);
  if (!conn) throw new Error('Cannot resolve repository connection');

  const { token, provider, owner, repo, instanceUrl } = conn;

  // Find the last known commit date for incremental sync
  const lastKnown = await pool.query(
    `SELECT MAX(authored_at) AS last_date FROM see_commits WHERE product_id = $1`,
    [productId]
  );
  const since = lastKnown.rows[0]?.last_date
    ? new Date(new Date(lastKnown.rows[0].last_date).getTime() + 1000).toISOString()
    : undefined;

  logger.info(`[SEE] Ingesting commits for product ${productId}${since ? ` since ${since}` : ' (full)'}`);

  // Fetch commits from provider
  const commits = await getCommitsPaginated(provider, token, owner, repo, { since }, instanceUrl || undefined);

  // Store commits (upsert to handle duplicates)
  let newCount = 0;
  for (const c of commits) {
    if (!c.sha || !c.authoredAt) continue;
    const result = await pool.query(
      `INSERT INTO see_commits (product_id, sha, author_name, author_email, author_login, authored_at, message_summary, additions, deletions, files_changed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (product_id, sha) DO NOTHING
       RETURNING id`,
      [productId, c.sha, c.authorName, c.authorEmail, c.authorLogin, c.authoredAt, c.messageSummary, c.additions, c.deletions, c.filesChanged]
    );
    if (result.rows.length > 0) newCount++;
  }

  // Rebuild developer attribution from all commits
  await rebuildDeveloperAttribution(productId);

  // Store developer nodes in Neo4j
  await storeDeveloperNodes(productId, orgId);

  // Get summary
  const summary = await getCommitSummary(productId);
  summary.newCommitsIngested = newCount;

  logger.info(`[SEE] Ingested ${newCount} new commits for product ${productId} (${summary.totalCommits} total)`);

  return summary;
}

// ─── Rebuild Developer Attribution ──────────────────────────────────

async function rebuildDeveloperAttribution(productId: string): Promise<void> {
  // Aggregate commits by author email
  await pool.query(
    `INSERT INTO see_developers (product_id, author_name, author_email, author_login, commit_count, additions, deletions, first_commit_at, last_commit_at, updated_at)
     SELECT
       product_id,
       MAX(author_name) AS author_name,
       author_email,
       MAX(author_login) AS author_login,
       COUNT(*) AS commit_count,
       SUM(additions) AS additions,
       SUM(deletions) AS deletions,
       MIN(authored_at) AS first_commit_at,
       MAX(authored_at) AS last_commit_at,
       NOW()
     FROM see_commits
     WHERE product_id = $1 AND author_email IS NOT NULL AND author_email != ''
     GROUP BY product_id, author_email
     ON CONFLICT (product_id, author_email) DO UPDATE SET
       author_name = EXCLUDED.author_name,
       author_login = EXCLUDED.author_login,
       commit_count = EXCLUDED.commit_count,
       additions = EXCLUDED.additions,
       deletions = EXCLUDED.deletions,
       first_commit_at = EXCLUDED.first_commit_at,
       last_commit_at = EXCLUDED.last_commit_at,
       updated_at = NOW()`,
    [productId]
  );
}

// ─── Store Developer Nodes in Neo4j ─────────────────────────────────

async function storeDeveloperNodes(productId: string, orgId: string): Promise<void> {
  const devs = await pool.query(
    `SELECT * FROM see_developers WHERE product_id = $1`,
    [productId]
  );

  const session = getDriver().session();
  try {
    for (const dev of devs.rows) {
      await session.run(
        `MATCH (p:Product {id: $productId})
         MERGE (d:SEEDeveloper {email: $email, productId: $productId})
         SET d.name = $name, d.login = $login, d.commitCount = $commitCount,
             d.additions = $additions, d.deletions = $deletions,
             d.firstCommitAt = $firstCommitAt, d.lastCommitAt = $lastCommitAt
         MERGE (d)-[:CONTRIBUTED_TO]->(p)`,
        {
          productId,
          email: dev.author_email,
          name: dev.author_name,
          login: dev.author_login || '',
          commitCount: dev.commit_count,
          additions: dev.additions,
          deletions: dev.deletions,
          firstCommitAt: dev.first_commit_at?.toISOString() || '',
          lastCommitAt: dev.last_commit_at?.toISOString() || '',
        }
      );
    }
  } finally {
    await session.close();
  }
}

// ─── Query Functions ────────────────────────────────────────────────

export async function getCommitSummary(productId: string): Promise<CommitSummary> {
  const result = await pool.query(
    `SELECT
       COUNT(*) AS total_commits,
       MIN(authored_at) AS first_commit,
       MAX(authored_at) AS last_commit,
       SUM(additions) AS total_additions,
       SUM(deletions) AS total_deletions,
       COUNT(DISTINCT to_char(authored_at, 'YYYY-MM')) AS active_months
     FROM see_commits WHERE product_id = $1`,
    [productId]
  );

  const row = result.rows[0];
  const totalAdd = parseInt(row.total_additions) || 0;
  const totalDel = parseInt(row.total_deletions) || 0;

  return {
    productId,
    totalCommits: parseInt(row.total_commits) || 0,
    firstCommitDate: row.first_commit || null,
    lastCommitDate: row.last_commit || null,
    activeMonths: parseInt(row.active_months) || 0,
    totalAdditions: totalAdd,
    totalDeletions: totalDel,
    rewriteRatio: totalAdd > 0 ? Math.round(totalDel / totalAdd * 100) / 100 : 0,
    newCommitsIngested: 0,
  };
}

export async function getDeveloperAttribution(productId: string): Promise<DeveloperAttribution[]> {
  const result = await pool.query(
    `SELECT * FROM see_developers WHERE product_id = $1 ORDER BY commit_count DESC`,
    [productId]
  );

  const totalCommits = result.rows.reduce((sum, r) => sum + r.commit_count, 0);

  return result.rows.map(r => ({
    authorName: r.author_name,
    authorEmail: r.author_email,
    authorLogin: r.author_login || '',
    commitCount: r.commit_count,
    additions: r.additions,
    deletions: r.deletions,
    firstCommitAt: r.first_commit_at?.toISOString() || '',
    lastCommitAt: r.last_commit_at?.toISOString() || '',
    contributionPct: totalCommits > 0 ? Math.round(r.commit_count / totalCommits * 1000) / 10 : 0,
  }));
}

export async function getCommitActivity(productId: string): Promise<CommitActivityPoint[]> {
  const result = await pool.query(
    `SELECT
       to_char(authored_at, 'YYYY-MM') AS month,
       COUNT(*) AS commits,
       SUM(additions) AS additions,
       SUM(deletions) AS deletions
     FROM see_commits
     WHERE product_id = $1
     GROUP BY to_char(authored_at, 'YYYY-MM')
     ORDER BY month ASC`,
    [productId]
  );

  return result.rows.map(r => ({
    month: r.month,
    commits: parseInt(r.commits) || 0,
    additions: parseInt(r.additions) || 0,
    deletions: parseInt(r.deletions) || 0,
  }));
}

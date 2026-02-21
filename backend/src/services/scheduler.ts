import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { decrypt } from '../utils/encryption.js';
import {
  getRepo, getContributors, getLanguages, getSBOM, getReleases, getTags, parseRepoUrl,
} from '../services/github.js';
import type { GitHubRelease } from '../services/github.js';

// How often to check for stale SBOMs (default: every hour)
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

// Hour of the day to run auto-sync (0-23, default: 2 AM)
const AUTO_SYNC_HOUR = 2;

let lastSyncDate = '';

async function getProductGitHubToken(productId: string): Promise<{ token: string; userId: string } | null> {
  // Find the user who owns this product (via org) and has a GitHub connection
  const neo4jSession = getDriver().session();
  try {
    const result = await neo4jSession.run(
      `MATCH (p:Product {id: $productId})-[:BELONGS_TO]->(o:Organisation)<-[:BELONGS_TO]-(u:User)
       RETURN u.id as userId`,
      { productId }
    );
    if (result.records.length === 0) return null;

    // Try each user until we find one with a GitHub token
    for (const record of result.records) {
      const userId = record.get('userId');
      const tokenResult = await pool.query(
        `SELECT access_token_encrypted FROM github_connections WHERE user_id = $1`,
        [userId]
      );
      if (tokenResult.rows.length > 0) {
        return {
          token: decrypt(tokenResult.rows[0].access_token_encrypted),
          userId,
        };
      }
    }
    return null;
  } finally {
    await neo4jSession.close();
  }
}

async function autoSyncProduct(productId: string): Promise<boolean> {
  console.log(`[AUTO-SYNC] Syncing product ${productId}`);

  const auth = await getProductGitHubToken(productId);
  if (!auth) {
    console.log(`[AUTO-SYNC] No GitHub token found for product ${productId}`);
    return false;
  }

  const neo4jSession = getDriver().session();
  try {
    // Get repo URL from product
    const productResult = await neo4jSession.run(
      `MATCH (p:Product {id: $productId}) RETURN p.repoUrl as repoUrl, p.name as name`,
      { productId }
    );
    if (productResult.records.length === 0) return false;

    const repoUrl = productResult.records[0].get('repoUrl');
    if (!repoUrl) return false;

    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) return false;

    // Fetch all data from GitHub
    const [repoData, contributors, languages, sbomData, releases, tags] = await Promise.all([
      getRepo(auth.token, parsed.owner, parsed.repo),
      getContributors(auth.token, parsed.owner, parsed.repo),
      getLanguages(auth.token, parsed.owner, parsed.repo),
      getSBOM(auth.token, parsed.owner, parsed.repo),
      getReleases(auth.token, parsed.owner, parsed.repo),
      getTags(auth.token, parsed.owner, parsed.repo),
    ]);

    // Store repo data in Neo4j
    await neo4jSession.run(
      `MERGE (r:GitHubRepo {url: $url})
       ON CREATE SET r.createdAt = datetime()
       SET r.owner = $owner, r.name = $name, r.fullName = $fullName,
           r.description = $description, r.language = $language,
           r.stars = $stars, r.forks = $forks, r.openIssues = $openIssues,
           r.visibility = $visibility, r.defaultBranch = $defaultBranch,
           r.lastPush = $lastPush, r.isPrivate = $isPrivate,
           r.languages = $languagesJson, r.syncedAt = datetime()
       WITH r
       MATCH (p:Product {id: $productId})
       MERGE (p)-[:HAS_REPO]->(r)`,
      {
        url: repoData.html_url,
        owner: parsed.owner,
        name: parsed.repo,
        fullName: repoData.full_name,
        description: repoData.description || '',
        language: repoData.language || '',
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        openIssues: repoData.open_issues_count,
        visibility: repoData.visibility,
        defaultBranch: repoData.default_branch,
        lastPush: repoData.pushed_at,
        isPrivate: repoData.private,
        languagesJson: JSON.stringify(languages),
        productId,
      }
    );

    // Store SBOM if available (this also sets is_stale = FALSE)
    if (sbomData) {
      // Inline storeSBOM logic for Postgres
      const packages = sbomData.sbom?.packages || [];
      await pool.query(
        `INSERT INTO product_sboms (product_id, spdx_json, spdx_version, package_count, is_stale, synced_at)
         VALUES ($1, $2, $3, $4, FALSE, NOW())
         ON CONFLICT (product_id) DO UPDATE SET
           spdx_json = $2, spdx_version = $3, package_count = $4, is_stale = FALSE, synced_at = NOW()`,
        [productId, JSON.stringify(sbomData), sbomData.sbom?.spdxVersion, packages.length]
      );

      // Update Neo4j SBOM node
      await neo4jSession.run(
        `MATCH (p:Product {id: $productId})
         MERGE (p)-[:HAS_SBOM]->(sbom:SBOM {productId: $productId})
         SET sbom.spdxVersion = $spdxVersion, sbom.packageCount = $packageCount,
             sbom.isStale = false, sbom.syncedAt = datetime()`,
        { productId, spdxVersion: sbomData.sbom?.spdxVersion, packageCount: packages.length }
      );
    }

    // Store GitHub releases
    const publishedReleases = releases.filter((r: GitHubRelease) => !r.draft);
    for (const rel of publishedReleases) {
      await pool.query(
        `INSERT INTO product_versions (product_id, cranis_version, github_tag, github_release_name, github_release_body, github_commit_sha, is_prerelease, source, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'github_release', $8)
         ON CONFLICT DO NOTHING`,
        [productId, rel.tag_name, rel.tag_name, rel.name || rel.tag_name, rel.body || '',
         rel.target_commitish, rel.prerelease, rel.published_at]
      );
    }

    // Generate CRANIS2 auto-version
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
    const counterResult = await pool.query(
      `SELECT cranis_version FROM product_versions
       WHERE product_id = $1 AND source = 'sync' AND cranis_version LIKE $2
       ORDER BY cranis_version DESC LIMIT 1`,
      [productId, today + '.%']
    );
    let counter = 1;
    if (counterResult.rows.length > 0) {
      const lastCounter = parseInt(counterResult.rows[0].cranis_version.split('.').pop() || '0', 10);
      counter = lastCounter + 1;
    }
    const cranisVersion = `${today}.${String(counter).padStart(4, '0')}`;

    const latestTagSha = tags.length > 0 ? tags[0].commit.sha : null;
    const latestRelease = publishedReleases.length > 0 ? publishedReleases[0] : null;

    await pool.query(
      `INSERT INTO product_versions (product_id, cranis_version, github_tag, github_release_name, github_commit_sha, source)
       VALUES ($1, $2, $3, $4, $5, 'sync')`,
      [productId, cranisVersion, latestRelease?.tag_name || null, latestRelease?.name || null, latestTagSha]
    );

    // Update product version
    await neo4jSession.run(
      `MATCH (p:Product {id: $productId}) SET p.version = $version`,
      { productId, version: cranisVersion }
    );

    console.log(`[AUTO-SYNC] Completed: ${productId} → ${cranisVersion}`);
    return true;
  } catch (err: any) {
    console.error(`[AUTO-SYNC] Error syncing product ${productId}:`, err.message);
    return false;
  } finally {
    await neo4jSession.close();
  }
}

async function runDailySync(): Promise<void> {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (lastSyncDate === todayStr) return; // Already ran today

  const now = new Date();
  if (now.getHours() < AUTO_SYNC_HOUR) return; // Not yet time

  console.log('[AUTO-SYNC] Starting daily sync check...');
  lastSyncDate = todayStr;

  try {
    const result = await pool.query(
      `SELECT product_id FROM product_sboms WHERE is_stale = TRUE`
    );

    if (result.rows.length === 0) {
      console.log('[AUTO-SYNC] No stale SBOMs found');
      return;
    }

    console.log(`[AUTO-SYNC] Found ${result.rows.length} stale product(s)`);

    for (const row of result.rows) {
      await autoSyncProduct(row.product_id);
    }

    console.log('[AUTO-SYNC] Daily sync complete');
  } catch (err: any) {
    console.error('[AUTO-SYNC] Error during daily sync:', err.message);
  }
}

export function startScheduler(): void {
  console.log(`[SCHEDULER] Started — checking every ${CHECK_INTERVAL_MS / 60000} minutes, auto-sync at ${AUTO_SYNC_HOUR}:00`);

  // Run check periodically
  setInterval(() => {
    runDailySync().catch(err => console.error('[SCHEDULER] Uncaught error:', err));
  }, CHECK_INTERVAL_MS);
}

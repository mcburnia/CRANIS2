import { getDriver } from '../db/neo4j.js';
import * as repoProvider from '../services/repo-provider.js';

export interface LockfileResult {
  resolved: number;
  totalNoVersion: number;
  lockfileFound: boolean;
}

/**
 * Fetch package-lock.json from GitHub and resolve version gaps.
 * 
 * Finds Dependency nodes with no version, looks up the exact
 * pinned version from the lockfile, and updates Neo4j.
 * 
 * Must be called BEFORE hash enrichment so newly-versioned
 * deps become eligible for hash fetching.
 * 
 * Never throws — returns partial results on failure.
 */
export async function resolveLockfileVersions(
  productId: string,
  ghToken: string
): Promise<LockfileResult> {
  const result: LockfileResult = { resolved: 0, totalNoVersion: 0, lockfileFound: false };

  const neo4jSession = getDriver().session();
  try {
    // 1. Get repo URL + default branch from Neo4j
    const repoResult = await neo4jSession.run(
      `MATCH (p:Product {id: $productId})-[:HAS_REPO]->(r:Repository)
       RETURN r.url AS url, r.defaultBranch AS defaultBranch, r.provider AS provider`,
      { productId }
    );
    if (repoResult.records.length === 0) {
      console.log('[LOCKFILE] No repo found for product');
      return result;
    }

    const repoUrl = repoResult.records[0].get('url');
    const defaultBranch = repoResult.records[0].get('defaultBranch') || 'main';
    const detectedProvider = (repoResult.records[0].get('provider') as repoProvider.RepoProvider) || repoProvider.detectProvider(repoUrl) || 'github';
    const parsed = repoProvider.parseRepoUrl(detectedProvider, repoUrl);
    if (!parsed) {
      console.log('[LOCKFILE] Could not parse repo URL:', repoUrl);
      return result;
    }

    // 2. Get deps with no version
    const noVersionResult = await neo4jSession.run(
      `MATCH (p:Product {id: $productId})-[:DEPENDS_ON]->(d:Dependency)
       WHERE d.version IS NULL OR d.version = ''
       RETURN d.name AS name, d.purl AS purl, d.ecosystem AS ecosystem`,
      { productId }
    );

    result.totalNoVersion = noVersionResult.records.length;
    if (result.totalNoVersion === 0) {
      console.log('[LOCKFILE] No versionless dependencies found');
      return result;
    }

    console.log(`[LOCKFILE] Found ${result.totalNoVersion} deps without versions, fetching package-lock.json...`);

    // 3. Fetch package-lock.json via provider-agnostic file API
    let lockfileContent: string;
    try {
      const content = await repoProvider.getFileContent(
        detectedProvider, ghToken, parsed.owner, parsed.repo, defaultBranch, 'package-lock.json'
      );

      if (!content) {
        console.log('[LOCKFILE] No package-lock.json found in repo');
        return result;
      }

      result.lockfileFound = true;
      lockfileContent = content;
    } catch (err: any) {
      if (err.message?.includes('404')) {
        console.log('[LOCKFILE] No package-lock.json in repo (404)');
      } else if (err.message?.includes('403')) {
        console.log('[LOCKFILE] Access denied to package-lock.json (403)');
      } else {
        console.warn('[LOCKFILE] Failed to fetch package-lock.json:', err.message);
      }
      return result;
    }

    // 4. Parse lockfile and build name -> version map
    let lockfile: any;
    try {
      lockfile = JSON.parse(lockfileContent);
    } catch (err) {
      console.warn('[LOCKFILE] Failed to parse package-lock.json:', (err as Error).message);
      return result;
    }

    const versionMap = new Map<string, string>();

    if (lockfile.packages) {
      // v2/v3 format: keys are "node_modules/@scope/name" or "node_modules/name"
      for (const [path, info] of Object.entries(lockfile.packages)) {
        if (!path) continue; // root entry has empty key
        const name = path.replace(/^node_modules\//, '');
        if (name && (info as any).version) {
          versionMap.set(name, (info as any).version);
        }
      }
      console.log(`[LOCKFILE] Parsed v2/v3 lockfile: ${versionMap.size} packages`);
    } else if (lockfile.dependencies) {
      // v1 format: keys are package names directly
      for (const [name, info] of Object.entries(lockfile.dependencies)) {
        if ((info as any).version) {
          versionMap.set(name, (info as any).version);
        }
      }
      console.log(`[LOCKFILE] Parsed v1 lockfile: ${versionMap.size} packages`);
    } else {
      console.warn('[LOCKFILE] Unrecognised lockfile format');
      return result;
    }

    // 5. Match versionless deps against lockfile
    const updates: Array<{ purl: string; version: string; newPurl: string }> = [];

    for (const record of noVersionResult.records) {
      const name = record.get('name');
      const purl = record.get('purl');
      const ecosystem = record.get('ecosystem');

      // Only npm lockfile for now
      if (ecosystem !== 'npm') continue;

      const resolvedVersion = versionMap.get(name);
      if (resolvedVersion) {
        // Rebuild purl with version: pkg:npm/name -> pkg:npm/name@version
        const newPurl = purl.includes('@') && !purl.startsWith('pkg:npm/%40')
          ? purl  // Already has a version in purl
          : `${purl}@${resolvedVersion}`;
        updates.push({ purl, version: resolvedVersion, newPurl });
      }
    }

    if (updates.length === 0) {
      console.log('[LOCKFILE] No matching versions found in lockfile');
      return result;
    }

    // 6. Update Neo4j nodes with resolved versions
    await neo4jSession.run(
      `UNWIND $updates AS u
       MATCH (d:Dependency {purl: u.purl})
       SET d.version = u.version,
           d.purl = u.newPurl,
           d.versionSource = 'lockfile',
           d.hashGapReason = null`,
      { updates }
    );

    result.resolved = updates.length;
    console.log(`[LOCKFILE] Resolved ${result.resolved}/${result.totalNoVersion} version gaps from lockfile`);

    return result;
  } catch (err) {
    console.warn('[LOCKFILE] Failed to resolve versions:', (err as Error).message);
    return result;
  } finally {
    await neo4jSession.close();
  }
}

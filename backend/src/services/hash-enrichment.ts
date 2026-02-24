import { getDriver } from '../db/neo4j.js';

interface RegistryInfo {
  hash: string;
  hashAlgorithm: string;
  downloadUrl: string;
}

/**
 * Fetch SHA-512 hash from npm registry for a specific package@version.
 * Returns null if package not found or private.
 */
async function fetchNpmHash(name: string, version: string): Promise<RegistryInfo | null> {
  try {
    // Handle scoped packages: @types/node -> @types%2Fnode
    const encodedName = name.startsWith('@') ? name.replace('/', '%2F') : name;
    const url = `https://registry.npmjs.org/${encodedName}/${version}`;

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'CRANIS2/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;

    const data = await res.json() as any;
    const integrity = data?.dist?.integrity;
    const tarball = data?.dist?.tarball;

    if (!integrity) return null;

    // Parse SRI format: "sha512-abc123..." -> { hash: "abc123...", algorithm: "SHA-512" }
    const match = integrity.match(/^(sha\d+)-(.+)$/);
    if (!match) return null;

    return {
      hash: match[2],
      hashAlgorithm: match[1].toUpperCase().replace('SHA', 'SHA-'),
      downloadUrl: tarball || '',
    };
  } catch (err) {
    console.warn(`[HASH] Failed to fetch npm hash for ${name}@${version}:`, (err as Error).message);
    return null;
  }
}

/**
 * Fetch SHA-256 hash from PyPI registry for a specific package@version.
 * Returns null if package not found.
 */
async function fetchPypiHash(name: string, version: string): Promise<RegistryInfo | null> {
  try {
    const url = `https://pypi.org/pypi/${encodeURIComponent(name)}/${version}/json`;

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'CRANIS2/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;

    const data = await res.json() as any;
    const files = data?.urls || [];
    // Prefer sdist, fall back to first wheel
    const file = files.find((f: any) => f.packagetype === 'sdist') || files[0];

    if (!file?.digests?.sha256) return null;

    return {
      hash: file.digests.sha256,
      hashAlgorithm: 'SHA-256',
      downloadUrl: file.url || '',
    };
  } catch (err) {
    console.warn(`[HASH] Failed to fetch PyPI hash for ${name}@${version}:`, (err as Error).message);
    return null;
  }
}

/**
 * Enrich Dependency nodes with cryptographic hashes and download URLs.
 * Fetches from package registries in batches to avoid hammering.
 *
 * Designed to be called fire-and-forget after storeSBOM completes.
 * Never throws — logs warnings and continues on failure.
 */
export async function enrichDependencyHashes(
  productId: string,
  packages: Array<{ name: string; version: string; ecosystem: string; purl: string }>
): Promise<{ enriched: number; skipped: number; failed: number }> {
  const stats = { enriched: 0, skipped: 0, failed: 0 };
  const BATCH_SIZE = 10;
  const BATCH_DELAY_MS = 200;

  console.log(`[HASH] Starting enrichment for ${packages.length} deps (product: ${productId})`);
  const startMs = Date.now();

  // Filter to only packages that need enrichment (supported ecosystems with versions)
  const toEnrich = packages.filter(pkg => {
    if (!pkg.version) { stats.skipped++; return false; }
    if (pkg.ecosystem !== 'npm' && pkg.ecosystem !== 'pip' && pkg.ecosystem !== 'pypi') {
      stats.skipped++;
      return false;
    }
    return true;
  });

  if (toEnrich.length === 0) {
    console.log(`[HASH] No enrichable packages found (${stats.skipped} skipped)`);
    return stats;
  }

  // Check which packages already have hashes (skip re-fetching)
  const neo4jSession = getDriver().session();
  try {
    const existingResult = await neo4jSession.run(
      `MATCH (p:Product {id: $productId})-[:DEPENDS_ON]->(d:Dependency)
       WHERE d.hash IS NOT NULL
       RETURN d.purl AS purl`,
      { productId }
    );
    const alreadyEnriched = new Set(existingResult.records.map(r => r.get('purl')));

    const needsEnrichment = toEnrich.filter(pkg => {
      if (alreadyEnriched.has(pkg.purl)) { stats.skipped++; return false; }
      return true;
    });

    if (needsEnrichment.length === 0) {
      console.log(`[HASH] All packages already enriched (${stats.skipped} skipped)`);
      return stats;
    }

    console.log(`[HASH] Fetching hashes for ${needsEnrichment.length} packages (${stats.skipped} already enriched or skipped)`);

    for (let i = 0; i < needsEnrichment.length; i += BATCH_SIZE) {
      const batch = needsEnrichment.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (pkg) => {
          let info: RegistryInfo | null = null;

          if (pkg.ecosystem === 'npm') {
            info = await fetchNpmHash(pkg.name, pkg.version);
          } else if (pkg.ecosystem === 'pip' || pkg.ecosystem === 'pypi') {
            info = await fetchPypiHash(pkg.name, pkg.version);
          }

          if (!info) { stats.failed++; return; }

          // Update Neo4j Dependency node
          await neo4jSession.run(
            `MATCH (d:Dependency {purl: $purl})
             SET d.hash = $hash,
                 d.hashAlgorithm = $hashAlgorithm,
                 d.downloadUrl = $downloadUrl,
                 d.hashEnrichedAt = datetime()`,
            {
              purl: pkg.purl,
              hash: info.hash,
              hashAlgorithm: info.hashAlgorithm,
              downloadUrl: info.downloadUrl,
            }
          );
          stats.enriched++;
        })
      );

      // Count rejections as failures
      for (const r of results) {
        if (r.status === 'rejected') {
          stats.failed++;
          console.warn('[HASH] Batch item rejected:', (r as PromiseRejectedResult).reason?.message);
        }
      }

      // Rate limit between batches
      if (i + BATCH_SIZE < needsEnrichment.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }
  } finally {
    await neo4jSession.close();
  }

  const durationSeconds = ((Date.now() - startMs) / 1000).toFixed(2);
  console.log(`[HASH] Enrichment complete: ${stats.enriched} enriched, ${stats.skipped} skipped, ${stats.failed} failed (${durationSeconds}s)`);

  return stats;
}

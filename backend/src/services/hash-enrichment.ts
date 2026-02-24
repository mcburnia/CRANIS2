import { getDriver } from '../db/neo4j.js';

interface RegistryInfo {
  hash: string;
  hashAlgorithm: string;
  downloadUrl: string;
}

export interface GapBreakdown {
  noVersion: number;
  unsupportedEcosystem: number;
  notFound: number;
  fetchError: number;
}

export interface EnrichmentResult {
  enriched: number;
  skipped: number;
  failed: number;
  gaps: GapBreakdown;
}

/**
 * Fetch SHA-512 hash from npm registry for a specific package@version.
 * Returns null if package not found or private.
 */
async function fetchNpmHash(name: string, version: string): Promise<RegistryInfo | null> {
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
}

/**
 * Fetch SHA-256 hash from PyPI registry for a specific package@version.
 * Returns null if package not found.
 */
async function fetchPypiHash(name: string, version: string): Promise<RegistryInfo | null> {
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
}

/**
 * Enrich Dependency nodes with cryptographic hashes and download URLs.
 * Fetches from package registries in batches to avoid hammering.
 *
 * Registry fetches run in parallel (network I/O), but Neo4j writes
 * run sequentially to avoid concurrent session transaction errors.
 *
 * Categorises WHY each dependency is missing its hash, storing
 * a hashGapReason on the Neo4j Dependency node for compliance reporting.
 *
 * Never throws — logs warnings and continues on failure.
 */
export async function enrichDependencyHashes(
  productId: string,
  packages: Array<{ name: string; version: string; ecosystem: string; purl: string }>
): Promise<EnrichmentResult> {
  const stats: EnrichmentResult = {
    enriched: 0,
    skipped: 0,
    failed: 0,
    gaps: { noVersion: 0, unsupportedEcosystem: 0, notFound: 0, fetchError: 0 },
  };
  const BATCH_SIZE = 10;
  const BATCH_DELAY_MS = 200;

  console.log(`[HASH] Starting enrichment for ${packages.length} deps (product: ${productId})`);
  const startMs = Date.now();

  // Collect gap reasons for batch Neo4j write at the end
  const gapEntries: Array<{ purl: string; reason: string }> = [];
  const successPurls: string[] = [];

  // Filter to only packages that need enrichment (supported ecosystems with versions)
  const toEnrich: typeof packages = [];
  for (const pkg of packages) {
    if (!pkg.version) {
      stats.gaps.noVersion++;
      stats.skipped++;
      gapEntries.push({ purl: pkg.purl, reason: 'no_version' });
      continue;
    }
    if (pkg.ecosystem !== 'npm' && pkg.ecosystem !== 'pip' && pkg.ecosystem !== 'pypi') {
      stats.gaps.unsupportedEcosystem++;
      stats.skipped++;
      gapEntries.push({ purl: pkg.purl, reason: 'unsupported_ecosystem' });
      continue;
    }
    toEnrich.push(pkg);
  }

  if (toEnrich.length === 0) {
    console.log(`[HASH] No enrichable packages found (${stats.skipped} skipped)`);
    // Still persist gap reasons even if nothing to enrich
    if (gapEntries.length > 0) {
      const neo4jSession = getDriver().session();
      try {
        await neo4jSession.run(
          `UNWIND $entries AS entry
           MATCH (d:Dependency {purl: entry.purl})
           SET d.hashGapReason = entry.reason`,
          { entries: gapEntries }
        );
      } finally {
        await neo4jSession.close();
      }
    }
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
      // Still persist gap reasons for pre-filtered packages
      if (gapEntries.length > 0) {
        await neo4jSession.run(
          `UNWIND $entries AS entry
           MATCH (d:Dependency {purl: entry.purl})
           SET d.hashGapReason = entry.reason`,
          { entries: gapEntries }
        );
      }
      return stats;
    }

    console.log(`[HASH] Fetching hashes for ${needsEnrichment.length} packages (${stats.skipped} already enriched or skipped)`);

    for (let i = 0; i < needsEnrichment.length; i += BATCH_SIZE) {
      const batch = needsEnrichment.slice(i, i + BATCH_SIZE);

      // Phase 1: Fetch from registries IN PARALLEL (network I/O is the bottleneck)
      const fetchResults = await Promise.allSettled(
        batch.map(async (pkg) => {
          try {
            let info: RegistryInfo | null = null;
            if (pkg.ecosystem === 'npm') {
              info = await fetchNpmHash(pkg.name, pkg.version);
            } else if (pkg.ecosystem === 'pip' || pkg.ecosystem === 'pypi') {
              info = await fetchPypiHash(pkg.name, pkg.version);
            }
            return { pkg, info, fetchError: false };
          } catch (err) {
            console.warn(`[HASH] Fetch error for ${pkg.name}@${pkg.version}:`, (err as Error).message);
            return { pkg, info: null, fetchError: true };
          }
        })
      );

      // Phase 2: Write to Neo4j SEQUENTIALLY (avoids concurrent session conflicts)
      for (const result of fetchResults) {
        if (result.status === 'rejected') {
          stats.gaps.fetchError++;
          stats.failed++;
          console.warn('[HASH] Batch item rejected:', (result as PromiseRejectedResult).reason?.message);
          continue;
        }

        const { pkg, info, fetchError } = result.value;

        if (fetchError) {
          stats.gaps.fetchError++;
          stats.failed++;
          gapEntries.push({ purl: pkg.purl, reason: 'fetch_error' });
          continue;
        }

        if (!info) {
          stats.gaps.notFound++;
          stats.failed++;
          gapEntries.push({ purl: pkg.purl, reason: 'not_found' });
          continue;
        }

        // Write hash to Neo4j (sequential — no concurrent session conflicts)
        try {
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
          successPurls.push(pkg.purl);
        } catch (writeErr) {
          console.warn(`[HASH] Neo4j write error for ${pkg.name}:`, (writeErr as Error).message);
          stats.gaps.fetchError++;
          stats.failed++;
          gapEntries.push({ purl: pkg.purl, reason: 'fetch_error' });
        }
      }

      // Rate limit between batches
      if (i + BATCH_SIZE < needsEnrichment.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    // Batch-write all gap reasons to Neo4j
    if (gapEntries.length > 0) {
      await neo4jSession.run(
        `UNWIND $entries AS entry
         MATCH (d:Dependency {purl: entry.purl})
         SET d.hashGapReason = entry.reason`,
        { entries: gapEntries }
      );
    }

    // Clear gap reason for successfully enriched deps
    if (successPurls.length > 0) {
      await neo4jSession.run(
        `UNWIND $purls AS purl
         MATCH (d:Dependency {purl: purl})
         SET d.hashGapReason = null`,
        { purls: successPurls }
      );
    }

  } finally {
    await neo4jSession.close();
  }

  const durationSeconds = ((Date.now() - startMs) / 1000).toFixed(2);
  console.log(
    `[HASH] Enrichment complete: ${stats.enriched} enriched, ${stats.skipped} skipped, ${stats.failed} failed ` +
    `(gaps: ${stats.gaps.noVersion} no-version, ${stats.gaps.unsupportedEcosystem} unsupported, ` +
    `${stats.gaps.notFound} not-found, ${stats.gaps.fetchError} fetch-error) (${durationSeconds}s)`
  );

  return stats;
}

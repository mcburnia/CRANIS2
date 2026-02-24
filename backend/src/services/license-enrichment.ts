import { getDriver } from '../db/neo4j.js';

export interface LicenseEnrichmentResult {
  enriched: number;
  skipped: number;
  failed: number;
  gaps: {
    noVersion: number;
    unsupportedEcosystem: number;
    notFound: number;
    fetchError: number;
  };
  total: number;
}

/**
 * Fetch license from npm registry for a specific package@version.
 * Returns the SPDX license identifier or null.
 */
async function fetchNpmLicense(name: string, version: string): Promise<string | null> {
  const encodedName = name.startsWith('@') ? name.replace('/', '%2F') : name;
  const url = `https://registry.npmjs.org/${encodedName}/${version}`;

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'CRANIS2/1.0' },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return null;

  const data = await res.json() as any;
  const license = data?.license;

  if (!license || typeof license !== 'string') return null;
  return license;
}

/**
 * Enrich Dependency nodes that have NOASSERTION or no license declared.
 * Queries npm registry for the actual license field.
 *
 * Follows the same batched pattern as hash-enrichment.ts:
 * - Parallel registry fetches (network I/O)
 * - Sequential Neo4j writes (avoids concurrent session conflicts)
 * - 10 per batch, 200ms delay, 10s timeout
 *
 * Never throws — logs warnings and continues on failure.
 */
export async function enrichDependencyLicenses(
  productId: string,
  packages: Array<{ name: string; version: string; ecosystem: string; purl: string }>
): Promise<LicenseEnrichmentResult> {
  const stats: LicenseEnrichmentResult = {
    enriched: 0,
    skipped: 0,
    failed: 0,
    gaps: { noVersion: 0, unsupportedEcosystem: 0, notFound: 0, fetchError: 0 },
    total: packages.length,
  };
  const BATCH_SIZE = 10;
  const BATCH_DELAY_MS = 200;

  console.log(`[LICENSE-ENRICH] Starting license enrichment for ${packages.length} deps (product: ${productId})`);
  const startMs = Date.now();

  // Query Neo4j for deps that need license enrichment
  const neo4jSession = getDriver().session();
  try {
    const needsEnrichment = await neo4jSession.run(
      `MATCH (p:Product {id: $productId})-[:DEPENDS_ON]->(d:Dependency)
       WHERE d.license IS NULL OR d.license = 'NOASSERTION' OR d.license = 'NONE' OR d.license = ''
       RETURN d.purl AS purl, d.name AS name, d.version AS version, d.ecosystem AS ecosystem`,
      { productId }
    );

    const depsToEnrich = needsEnrichment.records.map(r => ({
      purl: r.get('purl') || '',
      name: r.get('name') || '',
      version: r.get('version') || '',
      ecosystem: r.get('ecosystem') || 'unknown',
    }));

    if (depsToEnrich.length === 0) {
      console.log(`[LICENSE-ENRICH] No deps need license enrichment`);
      return stats;
    }

    console.log(`[LICENSE-ENRICH] ${depsToEnrich.length} deps need license enrichment`);

    // Filter to enrichable deps
    const toEnrich: typeof depsToEnrich = [];
    const gapEntries: Array<{ purl: string; reason: string }> = [];

    for (const dep of depsToEnrich) {
      if (!dep.version) {
        stats.gaps.noVersion++;
        stats.skipped++;
        gapEntries.push({ purl: dep.purl, reason: 'no_version' });
        continue;
      }
      if (dep.ecosystem !== 'npm') {
        stats.gaps.unsupportedEcosystem++;
        stats.skipped++;
        gapEntries.push({ purl: dep.purl, reason: 'unsupported_ecosystem' });
        continue;
      }
      toEnrich.push(dep);
    }

    if (toEnrich.length === 0) {
      console.log(`[LICENSE-ENRICH] No enrichable deps (${stats.skipped} skipped)`);
      // Persist gap reasons
      if (gapEntries.length > 0) {
        await neo4jSession.run(
          `UNWIND $entries AS entry
           MATCH (d:Dependency {purl: entry.purl})
           SET d.licenseGapReason = entry.reason`,
          { entries: gapEntries }
        );
      }
      return stats;
    }

    console.log(`[LICENSE-ENRICH] Fetching licenses for ${toEnrich.length} packages`);

    for (let i = 0; i < toEnrich.length; i += BATCH_SIZE) {
      const batch = toEnrich.slice(i, i + BATCH_SIZE);

      // Phase 1: Fetch from registries IN PARALLEL
      const fetchResults = await Promise.allSettled(
        batch.map(async (dep) => {
          try {
            const license = await fetchNpmLicense(dep.name, dep.version);
            return { dep, license, fetchError: false };
          } catch (err) {
            console.warn(`[LICENSE-ENRICH] Fetch error for ${dep.name}@${dep.version}:`, (err as Error).message);
            return { dep, license: null, fetchError: true };
          }
        })
      );

      // Phase 2: Write to Neo4j SEQUENTIALLY
      for (const result of fetchResults) {
        if (result.status === 'rejected') {
          stats.gaps.fetchError++;
          stats.failed++;
          continue;
        }

        const { dep, license, fetchError } = result.value;

        if (fetchError) {
          stats.gaps.fetchError++;
          stats.failed++;
          gapEntries.push({ purl: dep.purl, reason: 'fetch_error' });
          continue;
        }

        if (!license) {
          stats.gaps.notFound++;
          stats.failed++;
          gapEntries.push({ purl: dep.purl, reason: 'not_found' });
          continue;
        }

        // Write enriched license to Neo4j
        try {
          await neo4jSession.run(
            `MATCH (d:Dependency {purl: $purl})
             SET d.license = $license,
                 d.licenseEnrichedAt = datetime(),
                 d.licenseSource = 'npm_registry',
                 d.licenseGapReason = null`,
            { purl: dep.purl, license }
          );
          stats.enriched++;
        } catch (writeErr) {
          console.warn(`[LICENSE-ENRICH] Neo4j write error for ${dep.name}:`, (writeErr as Error).message);
          stats.gaps.fetchError++;
          stats.failed++;
          gapEntries.push({ purl: dep.purl, reason: 'fetch_error' });
        }
      }

      // Rate limit between batches
      if (i + BATCH_SIZE < toEnrich.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    // Batch-write gap reasons to Neo4j
    if (gapEntries.length > 0) {
      await neo4jSession.run(
        `UNWIND $entries AS entry
         MATCH (d:Dependency {purl: entry.purl})
         SET d.licenseGapReason = entry.reason`,
        { entries: gapEntries }
      );
    }

  } finally {
    await neo4jSession.close();
  }

  const durationSeconds = ((Date.now() - startMs) / 1000).toFixed(2);
  console.log(
    `[LICENSE-ENRICH] Complete: ${stats.enriched} enriched, ${stats.skipped} skipped, ${stats.failed} failed ` +
    `(gaps: ${stats.gaps.noVersion} no-version, ${stats.gaps.unsupportedEcosystem} unsupported, ` +
    `${stats.gaps.notFound} not-found, ${stats.gaps.fetchError} fetch-error) (${durationSeconds}s)`
  );

  return stats;
}

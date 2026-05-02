/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

/**
 * Shared repository helper functions.
 *
 * Extracted from routes/github.ts – these are service-level functions
 * used by both the route handlers and the scheduler.
 */

import crypto from 'crypto';
import pool from '../db/pool.js';
import { decrypt } from '../utils/encryption.js';
import { logger } from '../utils/logger.js';
import * as provider from './repo-provider.js';
import type { RepoProvider } from './repo-provider.js';
import type { GitHubSBOMResponse, SpdxPackage } from './github.js';

// Helper: get user's org_id
export async function getUserOrgId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.org_id || null;
}

// Helper: get user's decrypted repo token for a specific provider
export async function getUserRepoToken(userId: string, repoProvider?: RepoProvider): Promise<string | null> {
  const query = repoProvider
    ? 'SELECT access_token_encrypted FROM repo_connections WHERE user_id = $1 AND provider = $2'
    : 'SELECT access_token_encrypted FROM repo_connections WHERE user_id = $1';
  const params = repoProvider ? [userId, repoProvider] : [userId];
  const result = await pool.query(query, params);
  if (result.rows.length === 0) return null;
  try {
    return decrypt(result.rows[0].access_token_encrypted);
  } catch {
    return null;
  }
}
// Backward compat alias
export const getUserGitHubToken = getUserRepoToken;

/** Get user's decrypted token AND connection metadata for a specific provider */
export async function getUserRepoConnection(
  userId: string,
  repoProvider?: RepoProvider
): Promise<{ token: string; instanceUrl: string | null; provider: RepoProvider } | null> {
  const query = repoProvider
    ? 'SELECT access_token_encrypted, instance_url, provider FROM repo_connections WHERE user_id = $1 AND provider = $2'
    : 'SELECT access_token_encrypted, instance_url, provider FROM repo_connections WHERE user_id = $1';
  const params = repoProvider ? [userId, repoProvider] : [userId];
  const result = await pool.query(query, params);
  if (result.rows.length === 0) return null;
  try {
    return {
      token: decrypt(result.rows[0].access_token_encrypted),
      instanceUrl: result.rows[0].instance_url || null,
      provider: result.rows[0].provider as RepoProvider,
    };
  } catch {
    return null;
  }
}

/** Resolve provider + token for a repo URL by checking user's connections */
export async function resolveRepoConnection(
  userId: string,
  repoUrl: string
): Promise<{ token: string; instanceUrl: string | null; provider: RepoProvider; owner: string; repo: string } | null> {
  // First try cloud providers
  const cloudProvider = provider.detectProvider(repoUrl);
  if (cloudProvider) {
    const conn = await getUserRepoConnection(userId, cloudProvider);
    if (!conn) return null;
    const parsed = provider.parseRepoUrl(cloudProvider, repoUrl);
    if (!parsed) return null;
    return { ...conn, owner: parsed.owner, repo: parsed.repo };
  }

  // Try self-hosted: find a connection whose instance_url hostname matches the repo URL
  const allConns = await pool.query(
    'SELECT access_token_encrypted, instance_url, provider FROM repo_connections WHERE user_id = $1 AND instance_url IS NOT NULL',
    [userId]
  );

  let repoHostname;
  try {
    repoHostname = new URL(repoUrl.includes('://') ? repoUrl : `https://${repoUrl}`).hostname;
  } catch {
    return null;
  }

  for (const row of allConns.rows) {
    try {
      const instanceHostname = new URL(row.instance_url).hostname;
      if (instanceHostname === repoHostname) {
        const parsed = provider.parseRepoUrlGeneric(repoUrl);
        if (!parsed) continue;
        return {
          token: decrypt(row.access_token_encrypted),
          instanceUrl: row.instance_url,
          provider: row.provider as RepoProvider,
          owner: parsed.owner,
          repo: parsed.repo,
        };
      }
    } catch { continue; }
  }

  return null;
}

/**
 * Parse a purl (Package URL) or construct one from SPDX package data.
 * SPDX packages from GitHub have externalRefs with purl references.
 */
export function extractPackageInfo(pkg: SpdxPackage): {
  purl: string;
  name: string;
  version: string;
  ecosystem: string;
  license: string;
  supplier: string;
  downloadLocation: string;
} {
  // Try to get purl from externalRefs
  let purl = '';
  if (pkg.externalRefs) {
    const purlRef = pkg.externalRefs.find(r => r.referenceType === 'purl');
    if (purlRef) purl = purlRef.referenceLocator;
  }

  // Parse ecosystem from purl (e.g. pkg:npm/lodash@4.17.21 -> npm)
  let ecosystem = 'unknown';
  let name = pkg.name || '';
  let version = pkg.versionInfo || '';

  if (purl) {
    const purlMatch = purl.match(/^pkg:([^/]+)\//);
    if (purlMatch) ecosystem = purlMatch[1];
  }

  // Clean up name – SPDX names can include ecosystem prefix
  if (name.includes(':')) {
    const parts = name.split(':');
    name = parts[parts.length - 1];
  }

  return {
    purl: purl || `pkg:${ecosystem}/${name}@${version}`,
    name,
    version,
    ecosystem,
    license: pkg.licenseDeclared || pkg.licenseConcluded || 'NOASSERTION',
    supplier: pkg.supplier || '',
    downloadLocation: pkg.downloadLocation || 'NOASSERTION',
  };
}

/**
 * Store SBOM data in Postgres + Neo4j
 */
export async function storeSBOM(
  productId: string,
  sbomResponse: GitHubSBOMResponse,
  neo4jSession: any,
  sbomSource: string = 'api'
): Promise<{ packageCount: number; packages: ReturnType<typeof extractPackageInfo>[] }> {
  const sbom = sbomResponse.sbom;
  // Filter out the root package (the repo itself)
  const depPackages = sbom.packages.filter(p => p.SPDXID !== 'SPDXRef-DOCUMENT' && !p.name?.startsWith('com.github.'));
  const packages = depPackages.map(extractPackageInfo);

  // Store full SPDX JSON in Postgres
  await pool.query(
    `INSERT INTO product_sboms (product_id, spdx_json, spdx_version, package_count, is_stale, synced_at, sbom_source)
     VALUES ($1, $2, $3, $4, FALSE, NOW(), $5)
     ON CONFLICT (product_id) DO UPDATE SET
       spdx_json = $2, spdx_version = $3, package_count = $4,
       is_stale = FALSE, synced_at = NOW(), sbom_source = $5`,
    [productId, JSON.stringify(sbomResponse), sbom.spdxVersion, packages.length, sbomSource]
  );

  // Create SBOM node in Neo4j
  const sbomId = crypto.randomUUID();
  await neo4jSession.run(
    `MATCH (p:Product {id: $productId})
     MERGE (p)-[:HAS_SBOM]->(sbom:SBOM {productId: $productId})
     ON CREATE SET sbom.id = $sbomId, sbom.createdAt = datetime()
     SET sbom.spdxVersion = $spdxVersion,
         sbom.packageCount = $packageCount,
         sbom.isStale = false,
         sbom.syncedAt = datetime()`,
    { productId, sbomId, spdxVersion: sbom.spdxVersion, packageCount: packages.length }
  );

  // Create Dependency nodes and relationships
  for (const pkg of packages) {
    await neo4jSession.run(
      `MERGE (d:Dependency {purl: $purl})
       ON CREATE SET d.id = $depId, d.createdAt = datetime()
       SET d.name = $name,
           d.version = $version,
           d.ecosystem = $ecosystem,
           d.license = $license,
           d.supplier = $supplier,
           d.downloadLocation = $downloadLocation

       WITH d
       MATCH (p:Product {id: $productId})
       MERGE (p)-[:DEPENDS_ON]->(d)

       WITH d
       MATCH (p:Product {id: $productId})-[:HAS_SBOM]->(sbom:SBOM)
       MERGE (sbom)-[:INCLUDES]->(d)`,
      {
        purl: pkg.purl,
        depId: crypto.randomUUID(),
        name: pkg.name,
        version: pkg.version,
        ecosystem: pkg.ecosystem,
        license: pkg.license,
        supplier: pkg.supplier,
        downloadLocation: pkg.downloadLocation,
        productId,
      }
    );
  }


  // ── Tag direct vs transitive depth on DEPENDS_ON relationships ──
  // Parse SPDX relationships to identify which deps are direct (from root package)
  const relationships = sbom.relationships || [];
  if (relationships.length > 0) {
    // Find root package: the element that SPDXRef-DOCUMENT DESCRIBES
    const describesRel = relationships.find(
      (r: any) => r.spdxElementId === 'SPDXRef-DOCUMENT' && r.relationshipType === 'DESCRIBES'
    );
    const rootSpdxId = describesRel?.relatedSpdxElement;

    if (rootSpdxId) {
      // Build SPDXID → PURL map from all packages
      const spdxIdToPurl = new Map<string, string>();
      for (const pkg of sbom.packages) {
        const purlRef = pkg.externalRefs?.find((r: any) => r.referenceType === 'purl');
        if (purlRef) {
          spdxIdToPurl.set(pkg.SPDXID, purlRef.referenceLocator);
        }
      }

      // Collect direct dependency PURLs (root DEPENDS_ON → these are direct)
      const directPurls = new Set<string>();
      for (const rel of relationships) {
        if (rel.spdxElementId === rootSpdxId && rel.relationshipType === 'DEPENDS_ON') {
          const purl = spdxIdToPurl.get(rel.relatedSpdxElement);
          if (purl) directPurls.add(purl);
        }
      }

      // Batch-update Neo4j: set depth on DEPENDS_ON relationships and Dependency nodes
      if (directPurls.size > 0) {
        const allPurls = packages.map(p => p.purl);
        const depthEntries = allPurls.map(purl => ({
          purl,
          depth: directPurls.has(purl) ? 'direct' : 'transitive'
        }));

        await neo4jSession.run(
          `UNWIND $entries AS entry
           MATCH (p:Product {id: $productId})-[r:DEPENDS_ON]->(d:Dependency {purl: entry.purl})
           SET r.depth = entry.depth, d.depth = entry.depth`,
          { productId, entries: depthEntries }
        );

        logger.debug(`[SBOM] Depth tagged: ${directPurls.size} direct, ${allPurls.length - directPurls.size} transitive`);
      }
    }
  }


  return { packageCount: packages.length, packages };
}

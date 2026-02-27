// Lockfile-based SBOM generator
// Fetches lockfiles from a repo, parses them, and produces an SPDX-format SBOM
// compatible with the existing storeSBOM() pipeline.

import * as repoProvider from './repo-provider.js';
import type { RepoProvider } from './repo-provider.js';
import { LOCKFILE_CONFIGS, parseLockfile, type ParsedDependency } from './lockfile-parsers.js';

const MAX_LOCKFILE_SIZE = 10 * 1024 * 1024; // 10 MB guard (256 MB container limit)

export interface LockfileSBOMResult {
  sbom: {
    sbom: {
      spdxVersion: string;
      SPDXID: string;
      name: string;
      documentNamespace: string;
      creationInfo: { creators: string[]; created: string };
      packages: SpdxPackage[];
      relationships: SpdxRelationship[];
    };
  };
  lockfileUsed: string;
  totalDependencies: number;
}

interface SpdxPackage {
  SPDXID: string;
  name: string;
  versionInfo?: string;
  downloadLocation: string;
  licenseDeclared?: string;
  licenseConcluded?: string;
  supplier?: string;
  externalRefs?: Array<{
    referenceCategory: string;
    referenceType: string;
    referenceLocator: string;
  }>;
}

interface SpdxRelationship {
  spdxElementId: string;
  relatedSpdxElement: string;
  relationshipType: string;
}

/**
 * Generate an SPDX-format SBOM from lockfiles fetched from a repository.
 * Tries each supported lockfile in order, uses the first one found.
 * Returns null if no lockfile is found.
 *
 * The output matches the GitHubSBOMResponse format exactly so storeSBOM() works unchanged.
 */
export async function generateSBOMFromLockfiles(
  owner: string,
  repo: string,
  branch: string,
  provider: RepoProvider,
  token: string,
  repoUrl: string
): Promise<LockfileSBOMResult | null> {
  console.log(`[LOCKFILE-SBOM] Attempting lockfile SBOM for ${owner}/${repo} (${provider}, branch: ${branch})`);

  for (const config of LOCKFILE_CONFIGS) {
    try {
      const content = await repoProvider.getFileContent(provider, token, owner, repo, branch, config.filename);
      if (!content) continue;

      // Memory guard
      if (content.length > MAX_LOCKFILE_SIZE) {
        console.warn(`[LOCKFILE-SBOM] ${config.filename} is ${(content.length / 1024 / 1024).toFixed(1)} MB — skipping (limit: 10 MB)`);
        continue;
      }

      const parseResult = parseLockfile(config.filename, content);
      if (parseResult.dependencies.length === 0) {
        console.log(`[LOCKFILE-SBOM] ${config.filename} found but contains no dependencies`);
        continue;
      }

      console.log(`[LOCKFILE-SBOM] Found ${config.filename}: ${parseResult.dependencies.length} dependencies (${parseResult.ecosystem})`);

      const spdx = buildSpdxDocument(parseResult.dependencies, owner, repo, repoUrl, config.filename);

      return {
        sbom: spdx,
        lockfileUsed: config.filename,
        totalDependencies: parseResult.dependencies.length,
      };
    } catch (err) {
      console.warn(`[LOCKFILE-SBOM] Error with ${config.filename}:`, (err as Error).message);
    }
  }

  console.log(`[LOCKFILE-SBOM] No lockfile found for ${owner}/${repo}`);
  return null;
}

/**
 * Build an SPDX document from parsed dependencies.
 * Output format matches GitHubSBOMResponse so storeSBOM() needs no changes.
 */
function buildSpdxDocument(
  deps: ParsedDependency[],
  owner: string,
  repo: string,
  repoUrl: string,
  lockfileSource: string
): LockfileSBOMResult['sbom'] {
  const documentNamespace = `https://cranis2.dev/spdx/${owner}/${repo}/${Date.now()}`;

  // Root package (the repo itself)
  const rootPackage: SpdxPackage = {
    SPDXID: 'SPDXRef-DOCUMENT',
    name: `com.github.${owner}.${repo}`,
    versionInfo: '',
    downloadLocation: repoUrl || 'NOASSERTION',
    licenseDeclared: 'NOASSERTION',
    licenseConcluded: 'NOASSERTION',
    supplier: `Organization: ${owner}`,
    externalRefs: [],
  };

  const packages: SpdxPackage[] = [rootPackage];
  const relationships: SpdxRelationship[] = [];

  // DESCRIBES relationship: document describes the root package
  relationships.push({
    spdxElementId: 'SPDXRef-DOCUMENT',
    relatedSpdxElement: 'SPDXRef-Package-root',
    relationshipType: 'DESCRIBES',
  });

  for (let i = 0; i < deps.length; i++) {
    const dep = deps[i];
    const spdxId = `SPDXRef-Package-${i}`;

    packages.push({
      SPDXID: spdxId,
      name: dep.name,
      versionInfo: dep.version,
      downloadLocation: 'NOASSERTION',
      licenseDeclared: 'NOASSERTION',
      licenseConcluded: 'NOASSERTION',
      supplier: 'NOASSERTION',
      externalRefs: [{
        referenceCategory: 'PACKAGE-MANAGER',
        referenceType: 'purl',
        referenceLocator: dep.purl,
      }],
    });

    // Root depends on each dependency
    relationships.push({
      spdxElementId: 'SPDXRef-DOCUMENT',
      relatedSpdxElement: spdxId,
      relationshipType: 'DEPENDS_ON',
    });
  }

  return {
    sbom: {
      spdxVersion: 'SPDX-2.3',
      SPDXID: 'SPDXRef-DOCUMENT',
      name: `${owner}/${repo}`,
      documentNamespace,
      creationInfo: {
        creators: [`Tool: CRANIS2-lockfile-generator-1.0 (from ${lockfileSource})`],
        created: new Date().toISOString(),
      },
      packages,
      relationships,
    },
  };
}

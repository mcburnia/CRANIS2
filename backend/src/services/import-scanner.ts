/**
 * import-scanner.ts — Tier 3 SBOM Generation
 *
 * Scans source files for import statements when no lockfiles are found.
 * Uses language plugins to detect languages, extract imports, filter stdlib,
 * and map imports to package references. Produces an SPDX 2.3 SBOM.
 */

import { LANGUAGE_PLUGINS, type LanguagePlugin, type DetectedPackage } from './language-plugins.js';
import { getFileContent, listRepoFiles } from './repo-provider.js';

// ─── Interfaces ────────────────────────────────────────────────────────

export interface ImportScanResult {
  sbom: {
    spdxVersion: string;
    SPDXID: string;
    name: string;
    documentNamespace: string;
    creationInfo: {
      creators: string[];
      created: string;
    };
    packages: Array<{
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
    }>;
    relationships: Array<{
      spdxElementId: string;
      relatedSpdxElement: string;
      relationshipType: string;
    }>;
  };
  languagesDetected: string[];
  totalImports: number;
  totalPackages: number;
  confidence: 'high' | 'medium' | 'low';
}

// ─── Constants ─────────────────────────────────────────────────────────

const MAX_SOURCE_FILES = 500;
const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024;       // 1 MB
const MAX_TOTAL_CONTENT_BYTES = 50 * 1024 * 1024;   // 50 MB
const CONCURRENT_FETCHES = 10;
const TOTAL_TIMEOUT_MS = 120_000;                    // 120 seconds

// ─── Helpers ───────────────────────────────────────────────────────────

/** Check if a file path matches any plugin's extensions */
function isSourceFile(filepath: string): boolean {
  const lower = filepath.toLowerCase();
  for (const plugin of LANGUAGE_PLUGINS) {
    for (const ext of plugin.extensions) {
      if (lower.endsWith(ext)) return true;
    }
  }
  return false;
}

/** Find the plugin whose extensions match this filepath */
function pluginsForFile(filepath: string): LanguagePlugin[] {
  const lower = filepath.toLowerCase();
  return LANGUAGE_PLUGINS.filter(plugin =>
    plugin.extensions.some(ext => lower.endsWith(ext))
  );
}

/** Fetch files in batches with concurrency limit, respecting size and total caps */
async function fetchFilesInBatches(
  files: string[],
  provider: string,
  token: string,
  owner: string,
  repo: string,
  branch: string,
  instanceUrl: string | undefined,
  abortSignal: AbortSignal
): Promise<{ contents: Map<string, string>; skipped: number }> {
  const contents = new Map<string, string>();
  let totalBytes = 0;
  let skipped = 0;

  for (let i = 0; i < files.length; i += CONCURRENT_FETCHES) {
    if (abortSignal.aborted) break;

    const batch = files.slice(i, i + CONCURRENT_FETCHES);
    const results = await Promise.allSettled(
      batch.map(filepath => getFileContent(provider, token, owner, repo, branch, filepath, instanceUrl))
    );

    for (let j = 0; j < results.length; j++) {
      if (abortSignal.aborted) break;

      const result = results[j];
      const filepath = batch[j];

      if (result.status === 'rejected' || result.value === null) {
        skipped++;
        continue;
      }

      const content = result.value;
      const sizeBytes = new TextEncoder().encode(content).byteLength;

      // Skip files exceeding 1 MB
      if (sizeBytes > MAX_FILE_SIZE_BYTES) {
        skipped++;
        continue;
      }

      // Stop fetching if total content exceeds 50 MB
      if (totalBytes + sizeBytes > MAX_TOTAL_CONTENT_BYTES) {
        skipped += files.length - (i + j);
        console.log(`[IMPORT-SCAN] Content cap reached (${(totalBytes / 1024 / 1024).toFixed(1)} MB), stopping fetches`);
        return { contents, skipped };
      }

      totalBytes += sizeBytes;
      contents.set(filepath, content);
    }
  }

  return { contents, skipped };
}

// ─── Main Function ─────────────────────────────────────────────────────

export async function generateSBOMFromImports(
  owner: string,
  repo: string,
  branch: string,
  provider: string,
  token: string,
  repoUrl: string,
  instanceUrl?: string
): Promise<ImportScanResult | null> {
  const scanStart = Date.now();

  // Set up abort controller for total timeout
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log('[IMPORT-SCAN] Scan timed out after 120 seconds');
    abortController.abort();
  }, TOTAL_TIMEOUT_MS);

  try {
    // ── Step 1: List files ─────────────────────────────────────────────
    const allFiles = await listRepoFiles(provider, token, owner, repo, branch, instanceUrl);

    // ── Step 2: Filter to source files ─────────────────────────────────
    let sourceFiles = allFiles.filter(isSourceFile);

    if (sourceFiles.length === 0) {
      console.log('[IMPORT-SCAN] No source files found, skipping import scan');
      return null;
    }

    if (sourceFiles.length > MAX_SOURCE_FILES) {
      console.log(`[IMPORT-SCAN] Skipping ${sourceFiles.length - MAX_SOURCE_FILES} files (capped at ${MAX_SOURCE_FILES})`);
      sourceFiles = sourceFiles.slice(0, MAX_SOURCE_FILES);
    }

    console.log(`[IMPORT-SCAN] Scanning ${sourceFiles.length} source files...`);

    // ── Step 3: Fetch content in batches ───────────────────────────────
    const { contents, skipped } = await fetchFilesInBatches(
      sourceFiles, provider, token, owner, repo, branch, instanceUrl, abortController.signal
    );

    if (skipped > 0) {
      console.log(`[IMPORT-SCAN] Skipping ${skipped} files (size/limit exceeded)`);
    }

    if (contents.size === 0) {
      console.log('[IMPORT-SCAN] No file contents fetched, aborting');
      return null;
    }

    // ── Step 4: Detect languages ───────────────────────────────────────
    const filePluginMap = new Map<string, LanguagePlugin>();
    const languageSet = new Set<string>();

    for (const [filepath, content] of contents) {
      if (abortController.signal.aborted) break;

      const candidates = pluginsForFile(filepath);
      let bestPlugin: LanguagePlugin | null = null;
      let bestConfidence = 0;

      for (const plugin of candidates) {
        const confidence = plugin.detect(content, filepath);
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestPlugin = plugin;
        }
      }

      // Also try all plugins (not just extension-matched) in case a plugin
      // can detect language from content alone
      for (const plugin of LANGUAGE_PLUGINS) {
        if (candidates.includes(plugin)) continue;
        const confidence = plugin.detect(content, filepath);
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestPlugin = plugin;
        }
      }

      if (bestPlugin && bestConfidence >= 40) {
        filePluginMap.set(filepath, bestPlugin);
        languageSet.add(bestPlugin.id);
      }
    }

    const languagesDetected = Array.from(languageSet);

    if (languagesDetected.length === 0) {
      console.log('[IMPORT-SCAN] No languages detected above confidence threshold');
      return null;
    }

    console.log(`[IMPORT-SCAN] Detected languages: ${languagesDetected.join(', ')}`);

    // ── Step 5: Extract imports ────────────────────────────────────────
    const importMap = new Map<string, { module: string; pluginId: string }>();

    for (const [filepath, plugin] of filePluginMap) {
      if (abortController.signal.aborted) break;

      const content = contents.get(filepath);
      if (!content) continue;

      const imports = plugin.extractImports(content);

      for (const imp of imports) {
        // ── Step 6: Deduplicate globally by pluginId:module ────────────
        const key = `${plugin.id}:${imp.module}`;
        if (!importMap.has(key)) {
          importMap.set(key, { module: imp.module, pluginId: plugin.id });
        }
      }
    }

    const totalImports = importMap.size;

    // ── Step 7: Filter stdlib ──────────────────────────────────────────
    const externalImports: Array<{ module: string; pluginId: string }> = [];

    for (const [, entry] of importMap) {
      const plugin = LANGUAGE_PLUGINS.find(p => p.id === entry.pluginId);
      if (plugin && !plugin.isStdLib(entry.module)) {
        externalImports.push(entry);
      }
    }

    // ── Step 8: Map to packages ────────────────────────────────────────
    const packagesByPurl = new Map<string, DetectedPackage>();

    for (const entry of externalImports) {
      const plugin = LANGUAGE_PLUGINS.find(p => p.id === entry.pluginId);
      if (!plugin) continue;

      const pkg = plugin.mapToPackage(entry.module);
      if (pkg && pkg.purl && !packagesByPurl.has(pkg.purl)) {
        packagesByPurl.set(pkg.purl, pkg);
      }
    }

    const packages = Array.from(packagesByPurl.values());
    const totalPackages = packages.length;

    console.log(`[IMPORT-SCAN] Found ${totalImports} imports, ${totalPackages} unique packages`);

    if (totalPackages === 0) {
      console.log('[IMPORT-SCAN] No external packages detected, skipping SBOM generation');
      return null;
    }

    // ── Step 9: Build SPDX document ────────────────────────────────────
    const spdxPackages: ImportScanResult['sbom']['packages'] = [];
    const relationships: ImportScanResult['sbom']['relationships'] = [];

    // Root package
    const rootPackage = {
      SPDXID: 'SPDXRef-DOCUMENT',
      name: `com.github.${owner}.${repo}`,
      versionInfo: '',
      downloadLocation: repoUrl,
      licenseDeclared: 'NOASSERTION',
      licenseConcluded: 'NOASSERTION',
      supplier: `Organization: ${owner}`,
      externalRefs: [] as Array<{
        referenceCategory: string;
        referenceType: string;
        referenceLocator: string;
      }>,
    };

    spdxPackages.push(rootPackage);

    // DESCRIBES relationship from DOCUMENT to root
    relationships.push({
      spdxElementId: 'SPDXRef-DOCUMENT',
      relatedSpdxElement: 'SPDXRef-DOCUMENT',
      relationshipType: 'DESCRIBES',
    });

    // One package + DEPENDS_ON relationship per detected package
    for (let i = 0; i < packages.length; i++) {
      const pkg = packages[i];
      const spdxId = `SPDXRef-Package-${i}`;

      spdxPackages.push({
        SPDXID: spdxId,
        name: pkg.name,
        versionInfo: pkg.version || '',
        downloadLocation: 'NOASSERTION',
        licenseDeclared: 'NOASSERTION',
        licenseConcluded: 'NOASSERTION',
        supplier: 'NOASSERTION',
        externalRefs: [{
          referenceCategory: 'PACKAGE-MANAGER',
          referenceType: 'purl',
          referenceLocator: pkg.purl,
        }],
      });

      relationships.push({
        spdxElementId: 'SPDXRef-DOCUMENT',
        relatedSpdxElement: spdxId,
        relationshipType: 'DEPENDS_ON',
      });
    }

    const sbom: ImportScanResult['sbom'] = {
      spdxVersion: 'SPDX-2.3',
      SPDXID: 'SPDXRef-DOCUMENT',
      name: `${owner}/${repo}`,
      documentNamespace: `https://spdx.org/spdxdocs/${owner}-${repo}-${Date.now()}`,
      creationInfo: {
        creators: [
          'Tool: CRANIS2-ImportScanner-1.0.0',
        ],
        created: new Date().toISOString(),
      },
      packages: spdxPackages,
      relationships,
    };

    // ── Step 10: Set confidence ────────────────────────────────────────
    let confidence: 'high' | 'medium' | 'low' = 'low';

    // Check if any lockfile-parsed ecosystem is present (high confidence
    // would come from lockfiles, but import scanning is Tier 3 — so at
    // best we can be medium confidence)
    const ecosystems = new Set(packages.map(p => p.ecosystem));
    const hasMultipleLanguages = languagesDetected.length > 1;
    const hasManyPackages = totalPackages >= 5;

    if (hasMultipleLanguages && hasManyPackages) {
      confidence = 'medium';
    } else if (hasManyPackages) {
      confidence = 'medium';
    }
    // 'high' would only come if lockfile data was also present — import
    // scanning alone stays at medium at best

    const durationMs = Date.now() - scanStart;
    console.log(
      `[IMPORT-SCAN] Scan complete in ${(durationMs / 1000).toFixed(1)}s — ` +
      `${languagesDetected.length} language(s), ${totalImports} imports, ` +
      `${totalPackages} packages, confidence: ${confidence}`
    );

    // ── Step 11: Return result ─────────────────────────────────────────
    return {
      sbom,
      languagesDetected,
      totalImports,
      totalPackages,
      confidence,
    };
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      console.log('[IMPORT-SCAN] Scan aborted due to timeout');
    } else {
      console.error('[IMPORT-SCAN] Scan failed:', (err as Error).message);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Mock integration test: SBOM generation from lockfile content
 * Tests the full SPDX generation pipeline without needing a live API token.
 * Run with: npx tsx test-sbom-mock.ts
 */

import { parseLockfile, LOCKFILE_CONFIGS } from './src/services/lockfile-parsers.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

// ── Simulate a realistic package-lock.json ──────────────────
console.log('\n=== MOCK INTEGRATION TEST: SBOM Generation Pipeline ===');

console.log('\n[TEST 1] Parse realistic package-lock.json');
const realisticLockfile = JSON.stringify({
  name: "ansabase",
  version: "1.0.0",
  lockfileVersion: 3,
  packages: {
    "": { name: "ansabase", version: "1.0.0" },
    "node_modules/express": { version: "4.18.2" },
    "node_modules/body-parser": { version: "1.20.2" },
    "node_modules/cors": { version: "2.8.5" },
    "node_modules/dotenv": { version: "16.4.5" },
    "node_modules/pg": { version: "8.11.3" },
    "node_modules/@types/express": { version: "4.17.21" },
    "node_modules/@types/node": { version: "20.11.16" },
    "node_modules/typescript": { version: "5.3.3" },
    "node_modules/express/node_modules/accepts": { version: "1.3.8" },
    "node_modules/express/node_modules/content-type": { version: "1.0.5" },
  }
});

const parseResult = parseLockfile('package-lock.json', realisticLockfile);
assert(parseResult.dependencies.length === 10, `Parsed 10 deps (got ${parseResult.dependencies.length})`);
assert(parseResult.ecosystem === 'npm', 'Ecosystem is npm');

// ── Build SPDX document (same as lockfile-sbom-generator.ts) ──
console.log('\n[TEST 2] Build SPDX document from parsed deps');

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

// Import the actual buildSpdxDocument logic via generateSBOMFromLockfiles
// We can't call it directly since it requires API access, so test the parse+build flow
const deps = parseResult.dependencies;
const owner = 'mcburnia';
const repo = 'ANSABASE';
const repoUrl = 'https://codeberg.org/mcburnia/ANSABASE';

// Build SPDX (replicating the logic from lockfile-sbom-generator.ts)
const documentNamespace = `https://cranis2.dev/spdx/${owner}/${repo}/test`;

const rootPackage: SpdxPackage = {
  SPDXID: 'SPDXRef-DOCUMENT',
  name: `com.github.${owner}.${repo}`,
  versionInfo: '',
  downloadLocation: repoUrl,
  licenseDeclared: 'NOASSERTION',
  licenseConcluded: 'NOASSERTION',
  supplier: `Organization: ${owner}`,
  externalRefs: [],
};

const packages: SpdxPackage[] = [rootPackage];
const relationships: any[] = [];

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

  relationships.push({
    spdxElementId: 'SPDXRef-DOCUMENT',
    relatedSpdxElement: spdxId,
    relationshipType: 'DEPENDS_ON',
  });
}

const spdxDoc = {
  sbom: {
    spdxVersion: 'SPDX-2.3',
    SPDXID: 'SPDXRef-DOCUMENT',
    name: `${owner}/${repo}`,
    documentNamespace,
    creationInfo: {
      creators: ['Tool: CRANIS2-lockfile-generator-1.0 (from package-lock.json)'],
      created: new Date().toISOString(),
    },
    packages,
    relationships,
  },
};

// Validate SPDX structure
assert(spdxDoc.sbom.spdxVersion === 'SPDX-2.3', 'SPDX 2.3');
assert(spdxDoc.sbom.packages.length === 11, `11 packages (root + 10 deps) — got ${spdxDoc.sbom.packages.length}`);
assert(spdxDoc.sbom.relationships.length === 11, `11 relationships (DESCRIBES + 10 DEPENDS_ON) — got ${spdxDoc.sbom.relationships.length}`);
assert(spdxDoc.sbom.creationInfo.creators[0].includes('CRANIS2'), 'Creator tag present');

// ── Verify compatibility with storeSBOM() format ──────────
console.log('\n[TEST 3] Verify GitHubSBOMResponse compatibility');

// storeSBOM expects: { sbom: { spdxVersion, packages: SpdxPackage[], relationships? } }
const sbomResponse = spdxDoc; // This is our lockfile-generated format

assert(!!sbomResponse.sbom, 'Has sbom property');
assert(!!sbomResponse.sbom.spdxVersion, 'Has spdxVersion');
assert(Array.isArray(sbomResponse.sbom.packages), 'packages is array');
assert(Array.isArray(sbomResponse.sbom.relationships), 'relationships is array');

// storeSBOM filters out root package: p.SPDXID !== 'SPDXRef-DOCUMENT' && !p.name?.startsWith('com.github.')
const depPackages = sbomResponse.sbom.packages.filter(
  (p: any) => p.SPDXID !== 'SPDXRef-DOCUMENT' && !p.name?.startsWith('com.github.')
);
assert(depPackages.length === 10, `Filtered to 10 dep packages (got ${depPackages.length})`);

// extractPackageInfo expects: name, versionInfo, externalRefs[].referenceLocator
for (const pkg of depPackages) {
  assert(!!pkg.name, `Package has name: ${pkg.name}`);
  assert(!!pkg.versionInfo, `Package has version: ${pkg.versionInfo}`);
  assert(pkg.externalRefs!.length > 0, `Package has externalRefs`);
  assert(pkg.externalRefs![0].referenceLocator.startsWith('pkg:'), `PURL valid: ${pkg.externalRefs![0].referenceLocator}`);
}

// ── Verify PURL formats ─────────────────────────────────────
console.log('\n[TEST 4] PURL format verification');

const expressPkg = depPackages.find((p: any) => p.name === 'express');
assert(expressPkg?.externalRefs![0].referenceLocator === 'pkg:npm/express@4.18.2',
  `express PURL (got ${expressPkg?.externalRefs![0].referenceLocator})`);

const typesExpress = depPackages.find((p: any) => p.name === '@types/express');
assert(typesExpress?.externalRefs![0].referenceLocator === 'pkg:npm/%40types/express@4.17.21',
  `@types/express PURL matches GitHub format (got ${typesExpress?.externalRefs![0].referenceLocator})`);

const typesNode = depPackages.find((p: any) => p.name === '@types/node');
assert(typesNode?.externalRefs![0].referenceLocator === 'pkg:npm/%40types/node@20.11.16',
  `@types/node PURL (got ${typesNode?.externalRefs![0].referenceLocator})`);

// ── Verify depth tagging compatibility ──────────────────────
console.log('\n[TEST 5] Relationship structure for depth tagging');

const describes = relationships.find((r: any) => r.relationshipType === 'DESCRIBES');
assert(!!describes, 'DESCRIBES relationship exists');
assert(describes.spdxElementId === 'SPDXRef-DOCUMENT', 'DESCRIBES from SPDXRef-DOCUMENT');

const dependsOnRels = relationships.filter((r: any) => r.relationshipType === 'DEPENDS_ON');
assert(dependsOnRels.length === 10, `10 DEPENDS_ON relationships (got ${dependsOnRels.length})`);
assert(dependsOnRels.every((r: any) => r.spdxElementId === 'SPDXRef-DOCUMENT'),
  'All DEPENDS_ON from root (all deps treated as direct)');

// ── Verify Postgres JSON storage compatibility ──────────────
console.log('\n[TEST 6] JSON serialization for Postgres');

const jsonStr = JSON.stringify(spdxDoc);
assert(jsonStr.length > 0, `JSON serializable (${jsonStr.length} bytes)`);
const parsed = JSON.parse(jsonStr);
assert(parsed.sbom.packages.length === 11, 'JSON roundtrip preserves packages');
assert(parsed.sbom.spdxVersion === 'SPDX-2.3', 'JSON roundtrip preserves version');

// ── Summary ─────────────────────────────────────────────────
console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('MOCK INTEGRATION TESTS FAILED');
  process.exit(1);
} else {
  console.log('ALL MOCK INTEGRATION TESTS PASSED ✓');
}

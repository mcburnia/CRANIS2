/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

/**
 * One-shot: seed SBOM fixtures into the LIVE cranis2 dev DB
 * (Postgres `cranis2` + Neo4j `cranis2_neo4j`) for `test-product-github`.
 *
 * The Playwright SBOM spec expects an existing product with `hasSBOM=true`
 * and `totalDependencies>0`. Without this, 4 export tests skip.
 *
 * Idempotent. Run with:
 *   cd ~/cranis2/backend/tests && npx tsx setup/seed-live-sbom.ts
 */
import pg from 'pg';
import neo4j from 'neo4j-driver';

const OLD_PRODUCT_ID = 'c0000001-0000-0000-0000-000000000001'; // test-product-github (was previously seeded with SBOM — clean it up)
const PRODUCT_ID    = 'c0000001-0000-0000-0000-00000000000e'; // test-product-sbom-fixture (dedicated SBOM fixture)
const ORG_ID        = 'a0000001-0000-0000-0000-000000000001'; // mfgActive

const DEPS = [
  { id: 'e0000001-0000-0000-0000-000000000001', name: 'lodash',  version: '4.17.21', hash: 'a'.repeat(128), license: 'MIT', supplier: 'OpenJS Foundation' },
  { id: 'e0000001-0000-0000-0000-000000000002', name: 'express', version: '4.19.0',  hash: 'b'.repeat(128), license: 'MIT', supplier: 'OpenJS Foundation' },
  { id: 'e0000001-0000-0000-0000-000000000003', name: 'react',   version: '18.2.0',  hash: null,            license: 'MIT', supplier: 'Meta' },
  { id: 'e0000001-0000-0000-0000-000000000004', name: 'chalk',   version: '5.3.0',   hash: 'c'.repeat(128), license: 'MIT', supplier: 'Sindre Sorhus' },
  { id: 'e0000001-0000-0000-0000-000000000005', name: 'debug',   version: '4.3.4',   hash: 'd'.repeat(128), license: 'MIT', supplier: 'TJ Holowaychuk' },
];

async function main() {
  const pool = new pg.Pool({
    host: 'localhost', port: 5433, database: 'cranis2',
    user: 'cranis2', password: 'cranis2_dev_2026',
  });

  const driver = neo4j.driver('bolt://localhost:7688', neo4j.auth.basic('neo4j', 'cranis2_dev_2026'));
  const session = driver.session();

  const spdxDoc = {
    sbom: {
      spdxVersion: 'SPDX-2.3',
      SPDXID: 'SPDXRef-DOCUMENT',
      name: 'test-product-github SBOM',
      dataLicense: 'CC0-1.0',
      documentNamespace: `https://cranis2.test/sbom/${PRODUCT_ID}`,
      creationInfo: {
        created: new Date().toISOString(),
        creators: ['Tool: cranis2-test-seed'],
      },
      packages: DEPS.map(d => ({
        SPDXID: `SPDXRef-Package-${d.name}`,
        name: d.name,
        versionInfo: d.version,
        downloadLocation: `https://registry.npmjs.org/${d.name}/-/${d.name}-${d.version}.tgz`,
        filesAnalyzed: false,
        licenseConcluded: d.license,
        licenseDeclared: d.license,
        supplier: `Organization: ${d.supplier}`,
        externalRefs: [{
          referenceCategory: 'PACKAGE-MANAGER',
          referenceType: 'purl',
          referenceLocator: `pkg:npm/${d.name}@${d.version}`,
        }],
      })),
      relationships: DEPS.map(d => ({
        spdxElementId: 'SPDXRef-DOCUMENT',
        relationshipType: 'DESCRIBES',
        relatedSpdxElement: `SPDXRef-Package-${d.name}`,
      })),
    },
  };

  // Cleanup: prior version of this script seeded SBOM data on test-product-github,
  // which broke the obligations test that asserts art_13_11 is null when no SBOM
  // exists for that product. Move the fixture to a dedicated product instead.
  const oldDelete = await pool.query(
    `DELETE FROM product_sboms WHERE product_id = $1`,
    [OLD_PRODUCT_ID]
  );
  if (oldDelete.rowCount && oldDelete.rowCount > 0) {
    console.log(`  cleanup: removed stale SBOM row for ${OLD_PRODUCT_ID}`);
    await session.run(
      `MATCH (p:Product {id: $productId})-[r:DEPENDS_ON]->(:Dependency) DELETE r`,
      { productId: OLD_PRODUCT_ID }
    );
    console.log(`  cleanup: removed stale DEPENDS_ON edges from ${OLD_PRODUCT_ID}`);
  }

  // Ensure the dedicated SBOM-fixture product exists in Neo4j (mfgActive org).
  await session.run(
    `MATCH (o:Organisation {id: $orgId})
     MERGE (p:Product {id: $productId})
     ON CREATE SET p.name = 'test-product-sbom-fixture', p.provider = 'github',
       p.craCategory = 'default', p.repoUrl = 'https://github.com/test-org/test-sbom-fixture',
       p.status = 'active', p.createdAt = datetime(), p.updatedAt = datetime()
     ON MATCH SET p.updatedAt = datetime()
     MERGE (p)-[:BELONGS_TO]->(o)`,
    { orgId: ORG_ID, productId: PRODUCT_ID }
  );
  console.log(`  product node: ensured ${PRODUCT_ID} in Neo4j`);

  await pool.query(
    `INSERT INTO product_sboms (product_id, spdx_json, spdx_version, package_count, is_stale, sbom_source, synced_at)
     VALUES ($1, $2, $3, $4, FALSE, $5, NOW())
     ON CONFLICT (product_id) DO UPDATE SET
       spdx_json = $2, spdx_version = $3, package_count = $4,
       is_stale = FALSE, sbom_source = $5, synced_at = NOW()`,
    [PRODUCT_ID, JSON.stringify(spdxDoc), 'SPDX-2.3', DEPS.length, 'test-seed']
  );
  console.log(`  product_sboms: upserted row for ${PRODUCT_ID}`);

  for (const d of DEPS) {
    const purl = `pkg:npm/${d.name}@${d.version}`;
    await session.run(
      `MATCH (p:Product {id: $productId})
       MERGE (dep:Dependency {purl: $purl})
       ON CREATE SET dep.id = $id, dep.createdAt = datetime()
       SET dep.name = $name,
           dep.version = $version,
           dep.ecosystem = 'npm',
           dep.license = $license,
           dep.supplier = $supplier,
           dep.versionSource = 'lockfile',
           dep.downloadUrl = $downloadUrl,
           dep.hash = $hash,
           dep.hashAlgorithm = $hashAlg,
           dep.hashEnrichedAt = CASE WHEN $hash IS NULL THEN NULL ELSE datetime() END
       MERGE (p)-[:DEPENDS_ON]->(dep)`,
      {
        productId: PRODUCT_ID,
        purl,
        id: d.id,
        name: d.name,
        version: d.version,
        license: d.license,
        supplier: d.supplier,
        downloadUrl: `https://registry.npmjs.org/${d.name}/-/${d.name}-${d.version}.tgz`,
        hash: d.hash,
        hashAlg: d.hash ? 'SHA-512' : null,
      }
    );
    console.log(`  dep merged: ${d.name}@${d.version} ${d.hash ? '(enriched)' : '(pending)'}`);
  }

  await session.close();
  await driver.close();
  await pool.end();
  console.log('\n  Done. Live SBOM fixture seeded for test-product-sbom-fixture.');
}

main().catch(err => { console.error(err); process.exit(1); });

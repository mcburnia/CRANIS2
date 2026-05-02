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
 * CRANIS2 Test Data Seeder
 *
 * Seeds all test data into the app databases (Postgres + Neo4j).
 * Registers everything in test_data_registry for cleanup.
 *
 * Run standalone: npx tsx backend/tests/setup/seed-test-data.ts
 */

import { v4 as uuid } from 'uuid';
import bcrypt from 'bcrypt';
import {
  getAppPool, getNeo4jSession, getTestPool,
  registerTestData, closeAllConnections,
  TEST_USERS, TEST_PASSWORD,
} from './test-helpers.js';

// ─── IDs (hardcoded for idempotent seeding — never change these) ─────────

export const TEST_IDS = {
  orgs: {
    mfgActive:     'a0000001-0000-0000-0000-000000000001',
    impTrial:      'a0000001-0000-0000-0000-000000000002',
    distSuspended: 'a0000001-0000-0000-0000-000000000003',
    ossReadOnly:   'a0000001-0000-0000-0000-000000000004',
    mfgPastDue:    'a0000001-0000-0000-0000-000000000005',
    empty:         'a0000001-0000-0000-0000-000000000006',
  },
  users: {
    mfgAdmin:      'b0000001-0000-0000-0000-000000000001',
    mfgMember1:    'b0000001-0000-0000-0000-000000000002',
    mfgMember2:    'b0000001-0000-0000-0000-000000000003',
    mfgSuspended:  'b0000001-0000-0000-0000-000000000004',
    impAdmin:      'b0000001-0000-0000-0000-000000000005',
    impMember:     'b0000001-0000-0000-0000-000000000006',
    distAdmin:     'b0000001-0000-0000-0000-000000000007',
    distMember:    'b0000001-0000-0000-0000-000000000008',
    ossAdmin:      'b0000001-0000-0000-0000-000000000009',
    ossMember:     'b0000001-0000-0000-0000-00000000000a',
    pdAdmin:       'b0000001-0000-0000-0000-00000000000b',
    pdMember:      'b0000001-0000-0000-0000-00000000000c',
    emptyAdmin:    'b0000001-0000-0000-0000-00000000000d',
    orphanUser:    'b0000001-0000-0000-0000-00000000000e',
    platformAdmin: 'b0000001-0000-0000-0000-00000000000f',
  },
  products: {
    github:       'c0000001-0000-0000-0000-000000000001',
    codeberg:     'c0000001-0000-0000-0000-000000000002',
    gitea:        'c0000001-0000-0000-0000-000000000003',
    forgejo:      'c0000001-0000-0000-0000-000000000004',
    gitlab:       'c0000001-0000-0000-0000-000000000005',
    impGithub:    'c0000001-0000-0000-0000-000000000006',
    impCodeberg:  'c0000001-0000-0000-0000-000000000007',
    distGithub1:  'c0000001-0000-0000-0000-000000000008',
    distGithub2:  'c0000001-0000-0000-0000-000000000009',
    ossGithub:    'c0000001-0000-0000-0000-00000000000a',
    ossGitea:     'c0000001-0000-0000-0000-00000000000b',
    pdGithub:     'c0000001-0000-0000-0000-00000000000c',
    pdForgejo:    'c0000001-0000-0000-0000-00000000000d',
    sbomFixture:  'c0000001-0000-0000-0000-00000000000e',
  },
  reports: {
    draft:              'd0000001-0000-0000-0000-000000000001',
    earlyWarningSent:   'd0000001-0000-0000-0000-000000000002',
    notificationSent:   'd0000001-0000-0000-0000-000000000003',
    closed:             'd0000001-0000-0000-0000-000000000004',
  },
  dependencies: {
    lodash:   'e0000001-0000-0000-0000-000000000001',
    express:  'e0000001-0000-0000-0000-000000000002',
    react:    'e0000001-0000-0000-0000-000000000003',
    chalk:    'e0000001-0000-0000-0000-000000000004',
    debug:    'e0000001-0000-0000-0000-000000000005',
  },
};

// ─── Seed Functions ──────────────────────────────────────────────────────

async function seedUsers(): Promise<void> {
  const pool = getAppPool();
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  const users = [
    // TestOrg-Manufacturer-Active
    { id: TEST_IDS.users.mfgAdmin, email: TEST_USERS.mfgAdmin, orgId: TEST_IDS.orgs.mfgActive, orgRole: 'admin', isPlatformAdmin: false },
    { id: TEST_IDS.users.mfgMember1, email: TEST_USERS.mfgMember1, orgId: TEST_IDS.orgs.mfgActive, orgRole: 'member', isPlatformAdmin: false },
    { id: TEST_IDS.users.mfgMember2, email: TEST_USERS.mfgMember2, orgId: TEST_IDS.orgs.mfgActive, orgRole: 'member', isPlatformAdmin: false },
    { id: TEST_IDS.users.mfgSuspended, email: TEST_USERS.mfgSuspended, orgId: TEST_IDS.orgs.mfgActive, orgRole: 'member', isPlatformAdmin: false, suspended: true },

    // TestOrg-Importer-Trial
    { id: TEST_IDS.users.impAdmin, email: TEST_USERS.impAdmin, orgId: TEST_IDS.orgs.impTrial, orgRole: 'admin', isPlatformAdmin: false },
    { id: TEST_IDS.users.impMember, email: TEST_USERS.impMember, orgId: TEST_IDS.orgs.impTrial, orgRole: 'member', isPlatformAdmin: false },

    // TestOrg-Distributor-Suspended
    { id: TEST_IDS.users.distAdmin, email: TEST_USERS.distAdmin, orgId: TEST_IDS.orgs.distSuspended, orgRole: 'admin', isPlatformAdmin: false },
    { id: TEST_IDS.users.distMember, email: TEST_USERS.distMember, orgId: TEST_IDS.orgs.distSuspended, orgRole: 'member', isPlatformAdmin: false },

    // TestOrg-OSS-ReadOnly
    { id: TEST_IDS.users.ossAdmin, email: TEST_USERS.ossAdmin, orgId: TEST_IDS.orgs.ossReadOnly, orgRole: 'admin', isPlatformAdmin: false },
    { id: TEST_IDS.users.ossMember, email: TEST_USERS.ossMember, orgId: TEST_IDS.orgs.ossReadOnly, orgRole: 'member', isPlatformAdmin: false },

    // TestOrg-Manufacturer-PastDue
    { id: TEST_IDS.users.pdAdmin, email: TEST_USERS.pdAdmin, orgId: TEST_IDS.orgs.mfgPastDue, orgRole: 'admin', isPlatformAdmin: false },
    { id: TEST_IDS.users.pdMember, email: TEST_USERS.pdMember, orgId: TEST_IDS.orgs.mfgPastDue, orgRole: 'member', isPlatformAdmin: false },

    // TestOrg-Empty
    { id: TEST_IDS.users.emptyAdmin, email: TEST_USERS.emptyAdmin, orgId: TEST_IDS.orgs.empty, orgRole: 'admin', isPlatformAdmin: false },

    // Special users
    { id: TEST_IDS.users.orphanUser, email: TEST_USERS.orphanUser, orgId: null, orgRole: null, isPlatformAdmin: false },
    { id: TEST_IDS.users.platformAdmin, email: TEST_USERS.platformAdmin, orgId: TEST_IDS.orgs.mfgActive, orgRole: 'admin', isPlatformAdmin: true },
  ];

  for (const u of users) {
    await pool.query(
      `INSERT INTO users (id, email, password_hash, email_verified, org_id, org_role, is_platform_admin, suspended_at, created_at, updated_at)
       VALUES ($1, $2, $3, TRUE, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET
         id = $1, password_hash = $3, org_id = $4, org_role = $5,
         is_platform_admin = $6, suspended_at = $7, updated_at = NOW()`,
      [u.id, u.email, passwordHash, u.orgId, u.orgRole, u.isPlatformAdmin, u.suspended ? new Date() : null]
    );
    await registerTestData('user', u.id, 'postgres');
  }

  console.log(`  Seeded ${users.length} users`);
}

async function seedOrganisationsNeo4j(): Promise<void> {
  const session = getNeo4jSession();

  const orgs = [
    { id: TEST_IDS.orgs.mfgActive, name: 'TestOrg-Manufacturer-Active', country: 'DE', companySize: 'medium', craRole: 'manufacturer' },
    { id: TEST_IDS.orgs.impTrial, name: 'TestOrg-Importer-Trial', country: 'FR', companySize: 'small', craRole: 'importer' },
    { id: TEST_IDS.orgs.distSuspended, name: 'TestOrg-Distributor-Suspended', country: 'NL', companySize: 'large', craRole: 'distributor' },
    { id: TEST_IDS.orgs.ossReadOnly, name: 'TestOrg-OSS-ReadOnly', country: 'AT', companySize: 'micro', craRole: 'open_source_steward' },
    { id: TEST_IDS.orgs.mfgPastDue, name: 'TestOrg-Manufacturer-PastDue', country: 'IT', companySize: 'medium', craRole: 'manufacturer' },
    { id: TEST_IDS.orgs.empty, name: 'TestOrg-Empty', country: 'ES', companySize: 'small', craRole: 'manufacturer' },
  ];

  try {
    for (const o of orgs) {
      await session.run(
        `MERGE (org:Organisation {id: $id})
         ON CREATE SET org.name = $name, org.country = $country,
           org.companySize = $companySize, org.craRole = $craRole,
           org.createdAt = datetime(), org.updatedAt = datetime()
         ON MATCH SET org.name = $name, org.updatedAt = datetime()`,
        o
      );
      await registerTestData('organisation', o.id, 'neo4j');
    }

    // Create User nodes + relationships
    const userOrgPairs = [
      { userId: TEST_IDS.users.mfgAdmin, email: TEST_USERS.mfgAdmin, orgId: TEST_IDS.orgs.mfgActive, isAdmin: true },
      { userId: TEST_IDS.users.mfgMember1, email: TEST_USERS.mfgMember1, orgId: TEST_IDS.orgs.mfgActive, isAdmin: false },
      { userId: TEST_IDS.users.mfgMember2, email: TEST_USERS.mfgMember2, orgId: TEST_IDS.orgs.mfgActive, isAdmin: false },
      { userId: TEST_IDS.users.impAdmin, email: TEST_USERS.impAdmin, orgId: TEST_IDS.orgs.impTrial, isAdmin: true },
      { userId: TEST_IDS.users.distAdmin, email: TEST_USERS.distAdmin, orgId: TEST_IDS.orgs.distSuspended, isAdmin: true },
      { userId: TEST_IDS.users.ossAdmin, email: TEST_USERS.ossAdmin, orgId: TEST_IDS.orgs.ossReadOnly, isAdmin: true },
      { userId: TEST_IDS.users.pdAdmin, email: TEST_USERS.pdAdmin, orgId: TEST_IDS.orgs.mfgPastDue, isAdmin: true },
      { userId: TEST_IDS.users.emptyAdmin, email: TEST_USERS.emptyAdmin, orgId: TEST_IDS.orgs.empty, isAdmin: true },
      { userId: TEST_IDS.users.platformAdmin, email: TEST_USERS.platformAdmin, orgId: TEST_IDS.orgs.mfgActive, isAdmin: true },
    ];

    for (const pair of userOrgPairs) {
      await session.run(
        `MATCH (o:Organisation {id: $orgId})
         MERGE (u:User {id: $userId})
         ON CREATE SET u.email = $email, u.createdAt = datetime()
         MERGE (u)-[:BELONGS_TO]->(o)
         ${pair.isAdmin ? 'MERGE (u)-[:ADMIN_OF]->(o)' : ''}`,
        pair
      );
      await registerTestData('user_neo4j', pair.userId, 'neo4j');
    }

    console.log(`  Seeded ${orgs.length} organisations in Neo4j`);
  } finally {
    await session.close();
  }
}

async function seedBilling(): Promise<void> {
  const pool = getAppPool();

  const billingRecords = [
    { orgId: TEST_IDS.orgs.mfgActive, status: 'active', plan: 'standard' },
    { orgId: TEST_IDS.orgs.impTrial, status: 'trial', plan: 'standard', trialEnds: new Date(Date.now() + 14 * 86400000) },
    { orgId: TEST_IDS.orgs.distSuspended, status: 'suspended', plan: 'standard' },
    { orgId: TEST_IDS.orgs.ossReadOnly, status: 'read_only', plan: 'standard' },
    { orgId: TEST_IDS.orgs.mfgPastDue, status: 'past_due', plan: 'standard', graceEnds: new Date(Date.now() + 7 * 86400000) },
    { orgId: TEST_IDS.orgs.empty, status: 'active', plan: 'standard' },
  ];

  for (const b of billingRecords) {
    await pool.query(
      `INSERT INTO org_billing (org_id, status, plan, trial_ends_at, grace_ends_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (org_id) DO UPDATE SET status = $2, plan = $3, trial_ends_at = $4, grace_ends_at = $5`,
      [b.orgId, b.status, b.plan, b.trialEnds || null, b.graceEnds || null]
    );
    await registerTestData('org_billing', b.orgId, 'postgres');
  }

  console.log(`  Seeded ${billingRecords.length} billing records`);
}

async function seedProducts(): Promise<void> {
  const session = getNeo4jSession();

  const products = [
    // TestOrg-Manufacturer-Active — one per provider
    { id: TEST_IDS.products.github, name: 'test-product-github', orgId: TEST_IDS.orgs.mfgActive, provider: 'github', craCategory: 'important_i', repoUrl: 'https://github.com/test-org/test-product' },
    { id: TEST_IDS.products.codeberg, name: 'test-product-codeberg', orgId: TEST_IDS.orgs.mfgActive, provider: 'codeberg', craCategory: 'important_ii', repoUrl: 'https://codeberg.org/test-org/test-product' },
    { id: TEST_IDS.products.gitea, name: 'test-product-gitea', orgId: TEST_IDS.orgs.mfgActive, provider: 'gitea', craCategory: 'default', repoUrl: 'https://gitea.example.com/test-org/test-product', instanceUrl: 'https://gitea.example.com' },
    { id: TEST_IDS.products.forgejo, name: 'test-product-forgejo', orgId: TEST_IDS.orgs.mfgActive, provider: 'forgejo', craCategory: 'important_i', repoUrl: 'https://forgejo.example.com/test-org/test-product', instanceUrl: 'https://forgejo.example.com' },
    { id: TEST_IDS.products.gitlab, name: 'test-product-gitlab', orgId: TEST_IDS.orgs.mfgActive, provider: 'gitlab', craCategory: 'default', repoUrl: 'https://gitlab.com/test-org/test-product' },
    // Dedicated SBOM-export fixture — kept separate from other products so tests that
    // assume "no SBOM exists for X" (e.g. obligations art_13_11) aren't broken by seeding.
    { id: TEST_IDS.products.sbomFixture, name: 'test-product-sbom-fixture', orgId: TEST_IDS.orgs.mfgActive, provider: 'github', craCategory: 'default', repoUrl: 'https://github.com/test-org/test-sbom-fixture' },

    // Other orgs
    { id: TEST_IDS.products.impGithub, name: 'test-imp-github', orgId: TEST_IDS.orgs.impTrial, provider: 'github', craCategory: 'default', repoUrl: 'https://github.com/imp-org/product1' },
    { id: TEST_IDS.products.impCodeberg, name: 'test-imp-codeberg', orgId: TEST_IDS.orgs.impTrial, provider: 'codeberg', craCategory: 'default', repoUrl: 'https://codeberg.org/imp-org/product1' },
    { id: TEST_IDS.products.distGithub1, name: 'test-dist-github1', orgId: TEST_IDS.orgs.distSuspended, provider: 'github', craCategory: 'default', repoUrl: 'https://github.com/dist-org/product1' },
    { id: TEST_IDS.products.distGithub2, name: 'test-dist-github2', orgId: TEST_IDS.orgs.distSuspended, provider: 'github', craCategory: 'important_i', repoUrl: 'https://github.com/dist-org/product2' },
    { id: TEST_IDS.products.ossGithub, name: 'test-oss-github', orgId: TEST_IDS.orgs.ossReadOnly, provider: 'github', craCategory: 'default', repoUrl: 'https://github.com/oss-org/product1' },
    { id: TEST_IDS.products.ossGitea, name: 'test-oss-gitea', orgId: TEST_IDS.orgs.ossReadOnly, provider: 'gitea', craCategory: 'default', repoUrl: 'https://gitea.example.com/oss-org/product1', instanceUrl: 'https://gitea.example.com' },
    { id: TEST_IDS.products.pdGithub, name: 'test-pd-github', orgId: TEST_IDS.orgs.mfgPastDue, provider: 'github', craCategory: 'default', repoUrl: 'https://github.com/pd-org/product1' },
    { id: TEST_IDS.products.pdForgejo, name: 'test-pd-forgejo', orgId: TEST_IDS.orgs.mfgPastDue, provider: 'forgejo', craCategory: 'important_i', repoUrl: 'https://forgejo.example.com/pd-org/product1', instanceUrl: 'https://forgejo.example.com' },
  ];

  try {
    for (const p of products) {
      await session.run(
        `MATCH (o:Organisation {id: $orgId})
         MERGE (p:Product {id: $id})
         ON CREATE SET p.name = $name, p.provider = $provider,
           p.craCategory = $craCategory, p.repoUrl = $repoUrl,
           p.instanceUrl = $instanceUrl, p.status = 'active',
           p.createdAt = datetime(), p.updatedAt = datetime()
         ON MATCH SET p.name = $name, p.updatedAt = datetime()
         MERGE (p)-[:BELONGS_TO]->(o)`,
        { ...p, instanceUrl: p.instanceUrl || null }
      );
      await registerTestData('product', p.id, 'neo4j');
    }

    console.log(`  Seeded ${products.length} products in Neo4j`);
  } finally {
    await session.close();
  }
}

async function seedSboms(): Promise<void> {
  const pool = getAppPool();
  const session = getNeo4jSession();
  const productId = TEST_IDS.products.sbomFixture;

  // Five npm dependencies; first four are hash-enriched, fifth (react) is pending.
  const deps = [
    { id: TEST_IDS.dependencies.lodash,  name: 'lodash',  version: '4.17.21', hash: 'a'.repeat(128), license: 'MIT', supplier: 'OpenJS Foundation', enriched: true },
    { id: TEST_IDS.dependencies.express, name: 'express', version: '4.19.0',  hash: 'b'.repeat(128), license: 'MIT', supplier: 'OpenJS Foundation', enriched: true },
    { id: TEST_IDS.dependencies.chalk,   name: 'chalk',   version: '5.3.0',   hash: 'c'.repeat(128), license: 'MIT', supplier: 'Sindre Sorhus',     enriched: true },
    { id: TEST_IDS.dependencies.debug,   name: 'debug',   version: '4.3.4',   hash: 'd'.repeat(128), license: 'MIT', supplier: 'TJ Holowaychuk',    enriched: true },
    { id: TEST_IDS.dependencies.react,   name: 'react',   version: '18.2.0',  hash: null,            license: 'MIT', supplier: 'Meta',              enriched: false },
  ];

  // SPDX 2.3 doc — the export endpoint reads spdx_json.sbom.{packages,relationships}
  const spdxDoc = {
    sbom: {
      spdxVersion: 'SPDX-2.3',
      SPDXID: 'SPDXRef-DOCUMENT',
      name: 'test-product-github SBOM',
      dataLicense: 'CC0-1.0',
      documentNamespace: `https://cranis2.test/sbom/${productId}`,
      creationInfo: {
        created: new Date().toISOString(),
        creators: ['Tool: cranis2-test-seed'],
      },
      packages: deps.map(d => ({
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
      relationships: deps.map(d => ({
        spdxElementId: 'SPDXRef-DOCUMENT',
        relationshipType: 'DESCRIBES',
        relatedSpdxElement: `SPDXRef-Package-${d.name}`,
      })),
    },
  };

  await pool.query(
    `INSERT INTO product_sboms (product_id, spdx_json, spdx_version, package_count, is_stale, sbom_source, synced_at)
     VALUES ($1, $2, $3, $4, FALSE, $5, NOW())
     ON CONFLICT (product_id) DO UPDATE SET
       spdx_json = $2, spdx_version = $3, package_count = $4,
       is_stale = FALSE, sbom_source = $5, synced_at = NOW()`,
    [productId, JSON.stringify(spdxDoc), 'SPDX-2.3', deps.length, 'test-seed']
  );
  await registerTestData('product_sbom', productId, 'postgres');

  try {
    for (const d of deps) {
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
          productId,
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
      await registerTestData('dependency', d.id, 'neo4j');
    }
    console.log(`  Seeded SBOM for test-product-sbom-fixture (${deps.length} dependencies, ${deps.filter(d => d.enriched).length} enriched)`);
  } finally {
    await session.close();
  }
}

async function seedVulnerabilityFindings(): Promise<void> {
  const pool = getAppPool();

  // Deterministic IDs — must never change (idempotent upsert)
  const findings = [
    // test-product-github: 7 vulns (all 5 statuses represented)
    { id: 'e0000001-0000-0000-0000-000000000001', productId: TEST_IDS.products.github, orgId: TEST_IDS.orgs.mfgActive, title: 'CVE-2024-0001 - Prototype Pollution', severity: 'critical', cvssScore: 9.8, source: 'osv', sourceId: 'GHSA-test-0001', dependencyName: 'lodash', dependencyVersion: '4.17.20', fixedVersion: '4.17.21', status: 'open' },
    { id: 'e0000001-0000-0000-0000-000000000002', productId: TEST_IDS.products.github, orgId: TEST_IDS.orgs.mfgActive, title: 'CVE-2024-0002 - XSS in Template', severity: 'high', cvssScore: 7.5, source: 'osv', sourceId: 'GHSA-test-0002', dependencyName: 'handlebars', dependencyVersion: '4.7.6', fixedVersion: '4.7.8', status: 'open' },
    { id: 'e0000001-0000-0000-0000-000000000003', productId: TEST_IDS.products.github, orgId: TEST_IDS.orgs.mfgActive, title: 'CVE-2024-0003 - ReDoS', severity: 'medium', cvssScore: 5.3, source: 'nvd', sourceId: 'CVE-2024-0003', dependencyName: 'minimatch', dependencyVersion: '3.0.4', fixedVersion: '3.1.2', status: 'mitigated' },
    { id: 'e0000001-0000-0000-0000-000000000004', productId: TEST_IDS.products.github, orgId: TEST_IDS.orgs.mfgActive, title: 'CVE-2024-0004 - Info Leak', severity: 'low', cvssScore: 3.1, source: 'osv', sourceId: 'GHSA-test-0004', dependencyName: 'debug', dependencyVersion: '4.3.1', fixedVersion: '4.3.4', status: 'open' },
    { id: 'e0000001-0000-0000-0000-000000000005', productId: TEST_IDS.products.github, orgId: TEST_IDS.orgs.mfgActive, title: 'CVE-2024-0005 - DoS', severity: 'high', cvssScore: 7.8, source: 'nvd', sourceId: 'CVE-2024-0005', dependencyName: 'express', dependencyVersion: '4.18.0', fixedVersion: '4.19.0', status: 'resolved' },
    { id: 'e0000001-0000-0000-0000-000000000006', productId: TEST_IDS.products.github, orgId: TEST_IDS.orgs.mfgActive, title: 'CVE-2024-0006 - Open Redirect', severity: 'medium', cvssScore: 4.3, source: 'osv', sourceId: 'GHSA-test-0006', dependencyName: 'next', dependencyVersion: '13.4.0', fixedVersion: '13.4.5', status: 'dismissed' },
    { id: 'e0000001-0000-0000-0000-000000000007', productId: TEST_IDS.products.github, orgId: TEST_IDS.orgs.mfgActive, title: 'CVE-2024-0007 - Race Condition', severity: 'high', cvssScore: 6.8, source: 'nvd', sourceId: 'CVE-2024-0007', dependencyName: 'async', dependencyVersion: '3.2.4', fixedVersion: '3.2.5', status: 'acknowledged' },

    // test-product-codeberg: 3 vulns
    { id: 'e0000001-0000-0000-0000-000000000008', productId: TEST_IDS.products.codeberg, orgId: TEST_IDS.orgs.mfgActive, title: 'CVE-2024-1001 - SQL Injection', severity: 'critical', cvssScore: 9.1, source: 'osv', sourceId: 'PYSEC-test-1001', dependencyName: 'django', dependencyVersion: '4.1.0', fixedVersion: '4.1.7', status: 'open' },
    { id: 'e0000001-0000-0000-0000-000000000009', productId: TEST_IDS.products.codeberg, orgId: TEST_IDS.orgs.mfgActive, title: 'CVE-2024-1002 - CSRF', severity: 'medium', cvssScore: 6.1, source: 'osv', sourceId: 'PYSEC-test-1002', dependencyName: 'flask', dependencyVersion: '2.2.0', fixedVersion: '2.3.0', status: 'open' },
    { id: 'e0000001-0000-0000-0000-00000000000a', productId: TEST_IDS.products.codeberg, orgId: TEST_IDS.orgs.mfgActive, title: 'CVE-2024-1003 - Path Traversal', severity: 'high', cvssScore: 7.2, source: 'nvd', sourceId: 'CVE-2024-1003', dependencyName: 'werkzeug', dependencyVersion: '2.2.2', fixedVersion: '2.3.0', status: 'mitigated' },

    // test-product-gitlab: 2 vulns
    { id: 'e0000001-0000-0000-0000-00000000000b', productId: TEST_IDS.products.gitlab, orgId: TEST_IDS.orgs.mfgActive, title: 'CVE-2024-2001 - Memory Leak', severity: 'medium', cvssScore: 5.5, source: 'osv', sourceId: 'GO-test-2001', dependencyName: 'golang.org/x/net', dependencyVersion: '0.10.0', fixedVersion: '0.15.0', status: 'open' },
    { id: 'e0000001-0000-0000-0000-00000000000c', productId: TEST_IDS.products.gitlab, orgId: TEST_IDS.orgs.mfgActive, title: 'CVE-2024-2002 - Cert Validation', severity: 'high', cvssScore: 8.0, source: 'nvd', sourceId: 'CVE-2024-2002', dependencyName: 'golang.org/x/crypto', dependencyVersion: '0.11.0', fixedVersion: '0.14.0', status: 'open' },
  ];

  for (const f of findings) {
    await pool.query(
      `INSERT INTO vulnerability_findings (id, product_id, org_id, title, severity, cvss_score, source, source_id, dependency_name, dependency_version, fixed_version, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET status = $12, updated_at = NOW()`,
      [f.id, f.productId, f.orgId, f.title, f.severity, f.cvssScore, f.source, f.sourceId, f.dependencyName, f.dependencyVersion, f.fixedVersion, f.status]
    );
    await registerTestData('vulnerability_finding', f.id, 'postgres');
  }

  console.log(`  Seeded ${findings.length} vulnerability findings (all 5 statuses represented)`);
}

async function seedCraReports(): Promise<void> {
  const pool = getAppPool();

  const now = new Date();
  const reports = [
    {
      id: TEST_IDS.reports.draft, orgId: TEST_IDS.orgs.mfgActive, productId: TEST_IDS.products.github,
      reportType: 'vulnerability', status: 'draft',
      awarenessAt: new Date(now.getTime() - 2 * 3600000), // 2 hours ago
      createdBy: TEST_IDS.users.mfgAdmin,
    },
    {
      id: TEST_IDS.reports.earlyWarningSent, orgId: TEST_IDS.orgs.mfgActive, productId: TEST_IDS.products.codeberg,
      reportType: 'vulnerability', status: 'early_warning_sent',
      awarenessAt: new Date(now.getTime() - 20 * 3600000), // 20 hours ago
      createdBy: TEST_IDS.users.mfgAdmin,
    },
    {
      id: TEST_IDS.reports.notificationSent, orgId: TEST_IDS.orgs.mfgActive, productId: TEST_IDS.products.github,
      reportType: 'incident', status: 'notification_sent',
      awarenessAt: new Date(now.getTime() - 5 * 86400000), // 5 days ago
      createdBy: TEST_IDS.users.mfgAdmin,
    },
    {
      id: TEST_IDS.reports.closed, orgId: TEST_IDS.orgs.mfgActive, productId: TEST_IDS.products.gitlab,
      reportType: 'vulnerability', status: 'closed',
      awarenessAt: new Date(now.getTime() - 30 * 86400000), // 30 days ago
      createdBy: TEST_IDS.users.mfgAdmin,
    },
  ];

  for (const r of reports) {
    const earlyWarningDeadline = new Date(r.awarenessAt.getTime() + 24 * 3600000);
    const notificationDeadline = new Date(r.awarenessAt.getTime() + 72 * 3600000);
    const finalDeadline = r.reportType === 'vulnerability'
      ? new Date(r.awarenessAt.getTime() + 14 * 86400000)
      : new Date(new Date(r.awarenessAt).setMonth(r.awarenessAt.getMonth() + 1));

    await pool.query(
      `INSERT INTO cra_reports (id, org_id, product_id, report_type, status, awareness_at,
         early_warning_deadline, notification_deadline, final_report_deadline,
         csirt_country, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'DE', $10, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [r.id, r.orgId, r.productId, r.reportType, r.status, r.awarenessAt,
       earlyWarningDeadline, notificationDeadline, finalDeadline, r.createdBy]
    );
    await registerTestData('cra_report', r.id, 'postgres');
  }

  console.log(`  Seeded ${reports.length} CRA reports`);
}

async function seedNotifications(): Promise<void> {
  const pool = getAppPool();

  const notifications = [
    { orgId: TEST_IDS.orgs.mfgActive, userId: TEST_IDS.users.mfgAdmin, type: 'vulnerability_scan_complete', severity: 'high', title: 'Vulnerability Scan Complete', message: '5 new findings detected', isRead: false },
    { orgId: TEST_IDS.orgs.mfgActive, userId: TEST_IDS.users.mfgAdmin, type: 'cra_deadline_warning', severity: 'critical', title: 'CRA Deadline Approaching', message: 'Early warning due in 4 hours', isRead: false },
    { orgId: TEST_IDS.orgs.mfgActive, userId: null, type: 'sbom_sync_complete', severity: 'info', title: 'SBOM Sync Complete', message: '50 dependencies tracked', isRead: true },
    { orgId: TEST_IDS.orgs.mfgActive, userId: TEST_IDS.users.mfgMember1, type: 'license_critical', severity: 'medium', title: 'New License Finding', message: 'GPL-3.0 dependency detected', isRead: false },
    { orgId: TEST_IDS.orgs.impTrial, userId: TEST_IDS.users.impAdmin, type: 'trial_expiry_warning', severity: 'high', title: 'Trial Expiring', message: 'Your trial expires in 14 days', isRead: false },
    { orgId: TEST_IDS.orgs.mfgActive, userId: TEST_IDS.users.mfgAdmin, type: 'escrow_deposit_complete', severity: 'info', title: 'Escrow Deposit', message: 'Daily deposit completed', isRead: true },
    { orgId: TEST_IDS.orgs.mfgActive, userId: TEST_IDS.users.mfgAdmin, type: 'product_version', severity: 'low', title: 'New Version', message: 'Version 2026.01.15.0001 created', isRead: false },
    { orgId: TEST_IDS.orgs.mfgActive, userId: null, type: 'compliance_gap', severity: 'medium', title: 'Compliance Gap', message: '3 obligations not yet met', isRead: false },
    { orgId: TEST_IDS.orgs.ossReadOnly, userId: TEST_IDS.users.ossAdmin, type: 'billing_restricted', severity: 'critical', title: 'Account Restricted', message: 'Read-only access due to billing', isRead: false },
    { orgId: TEST_IDS.orgs.mfgActive, userId: TEST_IDS.users.mfgAdmin, type: 'ip_proof_created', severity: 'info', title: 'IP Proof Created', message: 'RFC 3161 timestamp verified', isRead: true },
  ];

  for (const n of notifications) {
    const id = uuid();
    await pool.query(
      `INSERT INTO notifications (id, org_id, user_id, type, severity, title, body, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT DO NOTHING`,
      [id, n.orgId, n.userId, n.type, n.severity, n.title, n.message, n.isRead]
    );
    await registerTestData('notification', id, 'postgres');
  }

  console.log(`  Seeded ${notifications.length} notifications`);
}

// ─── Main Seed Runner ────────────────────────────────────────────────────

export async function seedAllTestData(): Promise<void> {
  // Safety: verify we're writing to the test database, not live
  const pool = getAppPool();
  const dbResult = await pool.query('SELECT current_database()');
  const currentDb = dbResult.rows[0].current_database;
  if (currentDb !== 'cranis2_test') {
    throw new Error(
      `SAFETY: seedAllTestData would write to "${currentDb}" — expected "cranis2_test". Aborting.`
    );
  }
  console.log(`\n=== Seeding CRANIS2 Test Data (database: ${currentDb}) ===\n`);

  // Clean ephemeral test data before re-seeding. Earlier seed used random UUIDs +
  // ON CONFLICT DO NOTHING, so multiple runs accumulated findings/SBOM rows and
  // broke tests that assert on exact counts (e.g. risk-findings-regression).
  // We only truncate tables the seed itself populates — auth/billing rows are upserted by id.
  await pool.query('TRUNCATE TABLE vulnerability_findings, product_sboms, notifications, cra_reports RESTART IDENTITY CASCADE');
  console.log('  Cleaned: vulnerability_findings, product_sboms, notifications, cra_reports');

  try {
    await seedUsers();
    await seedOrganisationsNeo4j();
    await seedBilling();
    await seedProducts();
    await seedSboms();
    await seedVulnerabilityFindings();
    await seedCraReports();
    await seedNotifications();

    console.log('\n=== Test Data Seeding Complete ===\n');
  } catch (err) {
    console.error('Seed error:', err);
    throw err;
  }
}

// Run standalone
if (process.argv[1]?.endsWith('seed-test-data.ts') || process.argv[1]?.endsWith('seed-test-data.js')) {
  seedAllTestData()
    .then(() => closeAllConnections())
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

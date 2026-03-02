/**
 * DEV ONLY ROUTES — MUST BE REMOVED BEFORE PRODUCTION
 *
 * These routes perform destructive operations for development/testing.
 */
import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcrypt';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';

const router = Router();

// DELETE /api/dev/nuke-account — Remove user + org from both databases
router.delete('/nuke-account', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const payload = verifySessionToken(token);
    if (!payload) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const userId = payload.userId;
    const email = payload.email;

    console.log(`[DEV] Nuking account: ${email} (${userId})`);

    // 1. Get org_id before deleting user
    const userResult = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
    const orgId = userResult.rows[0]?.org_id;

    // 2. Delete from Postgres (order matters: events first, then user)
    await pool.query('DELETE FROM user_events WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    console.log(`[DEV] Postgres: deleted user ${email} and their events`);

    // 3. Delete from Neo4j — user node, their events, devices, and org if they were the only member
    const session = getDriver().session();
    try {
      // Delete the user node and all relationships/connected event nodes
      await session.run(
        `MATCH (u:User {id: $userId})
         OPTIONAL MATCH (u)-[:PERFORMED]->(e:Event)
         DETACH DELETE e
         WITH u
         DETACH DELETE u`,
        { userId }
      );
      console.log(`[DEV] Neo4j: deleted User node and events for ${email}`);

      // Delete the organisation if no other users reference it
      if (orgId) {
        const otherMembers = await pool.query(
          'SELECT COUNT(*) as count FROM users WHERE org_id = $1',
          [orgId]
        );

        if (parseInt(otherMembers.rows[0].count) === 0) {
          await session.run(
            'MATCH (o:Organisation {id: $orgId}) DETACH DELETE o',
            { orgId }
          );
          console.log(`[DEV] Neo4j: deleted Organisation ${orgId} (no remaining members)`);
        } else {
          console.log(`[DEV] Neo4j: Organisation ${orgId} kept (${otherMembers.rows[0].count} members remain)`);
        }
      }
    } finally {
      await session.close();
    }

    res.json({ message: 'Account and all associated data deleted', email });
  } catch (err) {
    console.error('[DEV] Nuke account failed:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// POST /api/dev/seed-notifications — Generate notifications from existing vulnerability scans + stale SBOM events
router.post('/seed-notifications', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    const token = authHeader.split(' ')[1];
    const payload = verifySessionToken(token);
    if (!payload) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const results = { vulnerabilityNotifications: 0, staleNotifications: 0, skipped: 0 };

    // 1. Generate notifications from existing vulnerability scans that have findings
    const scans = await pool.query(
      `SELECT vs.id, vs.product_id, vs.org_id, vs.critical_count, vs.high_count,
              vs.medium_count, vs.low_count, vs.findings_count, vs.completed_at
       FROM vulnerability_scans vs
       WHERE vs.findings_count > 0 AND vs.status = 'completed'
       ORDER BY vs.completed_at ASC`
    );

    for (const scan of scans.rows) {
      // Check if notification already exists for this scan
      const existing = await pool.query(
        `SELECT id FROM notifications
         WHERE org_id = $1 AND type = 'vulnerability_found'
           AND metadata->>'scanId' = $2`,
        [scan.org_id, scan.id]
      );
      if (existing.rows.length > 0) {
        results.skipped++;
        continue;
      }

      // Look up product name from Neo4j
      let productName = 'Unknown product';
      const neo4jSession = getDriver().session();
      try {
        const nameResult = await neo4jSession.run(
          'MATCH (p:Product {id: $productId}) RETURN p.name AS name',
          { productId: scan.product_id }
        );
        if (nameResult.records.length > 0) {
          productName = nameResult.records[0].get('name') || productName;
        }
      } finally {
        await neo4jSession.close();
      }

      // Determine worst severity
      let severity = 'low';
      if (scan.critical_count > 0) severity = 'critical';
      else if (scan.high_count > 0) severity = 'high';
      else if (scan.medium_count > 0) severity = 'medium';

      // Build summary parts
      const parts: string[] = [];
      if (scan.critical_count > 0) parts.push(scan.critical_count + ' critical');
      if (scan.high_count > 0) parts.push(scan.high_count + ' high');
      if (scan.medium_count > 0) parts.push(scan.medium_count + ' medium');
      if (scan.low_count > 0) parts.push(scan.low_count + ' low');

      await pool.query(
        `INSERT INTO notifications (org_id, type, severity, title, body, link, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          scan.org_id,
          'vulnerability_found',
          severity,
          'Vulnerability scan: ' + productName,
          'Found ' + scan.findings_count + ' vulnerabilities (' + parts.join(', ') + ')',
          '/products/' + scan.product_id + '?tab=risk-findings',
          JSON.stringify({ scanId: scan.id, productId: scan.product_id, findingsCount: scan.findings_count }),
          scan.completed_at,
        ]
      );
      results.vulnerabilityNotifications++;
    }

    // 2. Generate notifications from stale SBOM events
    // user_events doesn't have org_id, so we join through users or look up org from the product
    const staleEvents = await pool.query(
      `SELECT ue.id, ue.user_id, ue.metadata, ue.created_at, u.org_id
       FROM user_events ue
       LEFT JOIN users u ON u.id = ue.user_id
       WHERE ue.event_type = 'webhook.push_received'
         AND ue.metadata->>'sbomMarkedStale' = 'true'
       ORDER BY ue.created_at ASC`
    );

    for (const evt of staleEvents.rows) {
      const meta = evt.metadata || {};
      const productId = meta.productId;
      if (!productId) continue;

      // Get org_id: from user if available, otherwise look up from product in Neo4j
      let orgId = evt.org_id;
      if (!orgId) {
        const neo4jOrgSession = getDriver().session();
        try {
          const orgResult = await neo4jOrgSession.run(
            'MATCH (p:Product {id: $productId})-[:BELONGS_TO]->(o:Organisation) RETURN o.id AS orgId',
            { productId }
          );
          if (orgResult.records.length > 0) {
            orgId = orgResult.records[0].get('orgId');
          }
        } finally {
          await neo4jOrgSession.close();
        }
      }
      if (!orgId) continue;

      // Check for existing notification
      const existing = await pool.query(
        `SELECT id FROM notifications
         WHERE org_id = $1 AND type = 'sbom_stale'
           AND metadata->>'eventId' = $2`,
        [orgId, evt.id]
      );
      if (existing.rows.length > 0) {
        results.skipped++;
        continue;
      }

      // Look up product name
      let productName = 'Unknown product';
      const neo4jSession = getDriver().session();
      try {
        const nameResult = await neo4jSession.run(
          'MATCH (p:Product {id: $productId}) RETURN p.name AS name',
          { productId }
        );
        if (nameResult.records.length > 0) {
          productName = nameResult.records[0].get('name') || productName;
        }
      } finally {
        await neo4jSession.close();
      }

      await pool.query(
        `INSERT INTO notifications (org_id, type, severity, title, body, link, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          orgId,
          'sbom_stale',
          'medium',
          'SBOM outdated: ' + productName,
          'A push to the repository has been detected. The SBOM may no longer reflect the current dependencies.',
          '/products/' + productId + '?tab=sbom',
          JSON.stringify({ eventId: evt.id, productId, repo: meta.repo || '' }),
          evt.created_at,
        ]
      );
      results.staleNotifications++;
    }

    console.log('[DEV] Seed notifications:', results);
    res.json({ success: true, ...results });
  } catch (err: any) {
    console.error('[DEV] Seed notifications failed:', err);
    res.status(500).json({ error: 'Failed to seed notifications' });
  }
});

// ─── Test Data IDs (hardcoded for idempotent seeding) ────────────────────

const TEST_IDS = {
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
  },
  reports: {
    draft:              'd0000001-0000-0000-0000-000000000001',
    earlyWarningSent:   'd0000001-0000-0000-0000-000000000002',
    notificationSent:   'd0000001-0000-0000-0000-000000000003',
    closed:             'd0000001-0000-0000-0000-000000000004',
  },
};

const TEST_USERS = {
  mfgAdmin: 'testadmin@manufacturer-active.test',
  mfgMember1: 'testmember1@manufacturer-active.test',
  mfgMember2: 'testmember2@manufacturer-active.test',
  mfgSuspended: 'testsuspended@manufacturer-active.test',
  impAdmin: 'testadmin@importer-trial.test',
  impMember: 'testmember@importer-trial.test',
  distAdmin: 'testadmin@distributor-suspended.test',
  distMember: 'testmember@distributor-suspended.test',
  ossAdmin: 'testadmin@oss-readonly.test',
  ossMember: 'testmember@oss-readonly.test',
  pdAdmin: 'testadmin@manufacturer-pastdue.test',
  pdMember: 'testmember@manufacturer-pastdue.test',
  emptyAdmin: 'testadmin@empty-org.test',
  orphanUser: 'testorphan@noorg.test',
  platformAdmin: 'testplatformadmin@cranis2.test',
};

const TEST_PASSWORD = 'TestPass123!';

// POST /api/dev/seed-test-data — Seed test data for automated testing (idempotent)
router.post('/seed-test-data', async (_req: Request, res: Response) => {
  const counts = { users: 0, orgs: 0, billing: 0, products: 0, findings: 0, reports: 0, notifications: 0 };

  try {
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

    // ── 1. Seed Users ──────────────────────────────────────────
    const users = [
      { id: TEST_IDS.users.mfgAdmin, email: TEST_USERS.mfgAdmin, orgId: TEST_IDS.orgs.mfgActive, orgRole: 'admin', isPlatformAdmin: false, suspended: false },
      { id: TEST_IDS.users.mfgMember1, email: TEST_USERS.mfgMember1, orgId: TEST_IDS.orgs.mfgActive, orgRole: 'member', isPlatformAdmin: false, suspended: false },
      { id: TEST_IDS.users.mfgMember2, email: TEST_USERS.mfgMember2, orgId: TEST_IDS.orgs.mfgActive, orgRole: 'member', isPlatformAdmin: false, suspended: false },
      { id: TEST_IDS.users.mfgSuspended, email: TEST_USERS.mfgSuspended, orgId: TEST_IDS.orgs.mfgActive, orgRole: 'member', isPlatformAdmin: false, suspended: true },
      { id: TEST_IDS.users.impAdmin, email: TEST_USERS.impAdmin, orgId: TEST_IDS.orgs.impTrial, orgRole: 'admin', isPlatformAdmin: false, suspended: false },
      { id: TEST_IDS.users.impMember, email: TEST_USERS.impMember, orgId: TEST_IDS.orgs.impTrial, orgRole: 'member', isPlatformAdmin: false, suspended: false },
      { id: TEST_IDS.users.distAdmin, email: TEST_USERS.distAdmin, orgId: TEST_IDS.orgs.distSuspended, orgRole: 'admin', isPlatformAdmin: false, suspended: false },
      { id: TEST_IDS.users.distMember, email: TEST_USERS.distMember, orgId: TEST_IDS.orgs.distSuspended, orgRole: 'member', isPlatformAdmin: false, suspended: false },
      { id: TEST_IDS.users.ossAdmin, email: TEST_USERS.ossAdmin, orgId: TEST_IDS.orgs.ossReadOnly, orgRole: 'admin', isPlatformAdmin: false, suspended: false },
      { id: TEST_IDS.users.ossMember, email: TEST_USERS.ossMember, orgId: TEST_IDS.orgs.ossReadOnly, orgRole: 'member', isPlatformAdmin: false, suspended: false },
      { id: TEST_IDS.users.pdAdmin, email: TEST_USERS.pdAdmin, orgId: TEST_IDS.orgs.mfgPastDue, orgRole: 'admin', isPlatformAdmin: false, suspended: false },
      { id: TEST_IDS.users.pdMember, email: TEST_USERS.pdMember, orgId: TEST_IDS.orgs.mfgPastDue, orgRole: 'member', isPlatformAdmin: false, suspended: false },
      { id: TEST_IDS.users.emptyAdmin, email: TEST_USERS.emptyAdmin, orgId: TEST_IDS.orgs.empty, orgRole: 'admin', isPlatformAdmin: false, suspended: false },
      { id: TEST_IDS.users.orphanUser, email: TEST_USERS.orphanUser, orgId: null, orgRole: null, isPlatformAdmin: false, suspended: false },
      { id: TEST_IDS.users.platformAdmin, email: TEST_USERS.platformAdmin, orgId: TEST_IDS.orgs.mfgActive, orgRole: 'admin', isPlatformAdmin: true, suspended: false },
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
      counts.users++;
    }

    // ── 2. Seed Organisations in Neo4j ─────────────────────────
    const orgs = [
      { id: TEST_IDS.orgs.mfgActive, name: 'TestOrg-Manufacturer-Active', country: 'DE', companySize: 'medium', craRole: 'manufacturer' },
      { id: TEST_IDS.orgs.impTrial, name: 'TestOrg-Importer-Trial', country: 'FR', companySize: 'small', craRole: 'importer' },
      { id: TEST_IDS.orgs.distSuspended, name: 'TestOrg-Distributor-Suspended', country: 'NL', companySize: 'large', craRole: 'distributor' },
      { id: TEST_IDS.orgs.ossReadOnly, name: 'TestOrg-OSS-ReadOnly', country: 'AT', companySize: 'micro', craRole: 'open_source_steward' },
      { id: TEST_IDS.orgs.mfgPastDue, name: 'TestOrg-Manufacturer-PastDue', country: 'IT', companySize: 'medium', craRole: 'manufacturer' },
      { id: TEST_IDS.orgs.empty, name: 'TestOrg-Empty', country: 'ES', companySize: 'small', craRole: 'manufacturer' },
    ];

    const orgSession = getDriver().session();
    try {
      for (const o of orgs) {
        await orgSession.run(
          `MERGE (org:Organisation {id: $id})
           ON CREATE SET org.name = $name, org.country = $country,
             org.companySize = $companySize, org.craRole = $craRole,
             org.createdAt = datetime(), org.updatedAt = datetime()
           ON MATCH SET org.name = $name, org.updatedAt = datetime()`,
          o
        );
        counts.orgs++;
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
        await orgSession.run(
          `MATCH (o:Organisation {id: $orgId})
           MERGE (u:User {id: $userId})
           ON CREATE SET u.email = $email, u.createdAt = datetime()
           MERGE (u)-[:BELONGS_TO]->(o)
           ${pair.isAdmin ? 'MERGE (u)-[:ADMIN_OF]->(o)' : ''}`,
          pair
        );
      }
    } finally {
      await orgSession.close();
    }

    // ── 3. Seed Billing ────────────────────────────────────────
    const billingRecords = [
      { orgId: TEST_IDS.orgs.mfgActive, status: 'active', trialEnds: null, graceEnds: null },
      { orgId: TEST_IDS.orgs.impTrial, status: 'trial', trialEnds: new Date(Date.now() + 14 * 86400000), graceEnds: null },
      { orgId: TEST_IDS.orgs.distSuspended, status: 'suspended', trialEnds: null, graceEnds: null },
      { orgId: TEST_IDS.orgs.ossReadOnly, status: 'read_only', trialEnds: null, graceEnds: null },
      { orgId: TEST_IDS.orgs.mfgPastDue, status: 'past_due', trialEnds: null, graceEnds: new Date(Date.now() + 7 * 86400000) },
      { orgId: TEST_IDS.orgs.empty, status: 'active', trialEnds: null, graceEnds: null },
    ];

    for (const b of billingRecords) {
      await pool.query(
        `INSERT INTO org_billing (org_id, status, trial_ends_at, grace_ends_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (org_id) DO UPDATE SET status = $2, trial_ends_at = $3, grace_ends_at = $4`,
        [b.orgId, b.status, b.trialEnds, b.graceEnds]
      );
      counts.billing++;
    }

    // ── 4. Seed Products in Neo4j ──────────────────────────────
    const products = [
      { id: TEST_IDS.products.github, name: 'test-product-github', orgId: TEST_IDS.orgs.mfgActive, provider: 'github', craCategory: 'category-1', repoUrl: 'https://github.com/test-org/test-product', instanceUrl: null },
      { id: TEST_IDS.products.codeberg, name: 'test-product-codeberg', orgId: TEST_IDS.orgs.mfgActive, provider: 'codeberg', craCategory: 'category-2', repoUrl: 'https://codeberg.org/test-org/test-product', instanceUrl: null },
      { id: TEST_IDS.products.gitea, name: 'test-product-gitea', orgId: TEST_IDS.orgs.mfgActive, provider: 'gitea', craCategory: 'default', repoUrl: 'https://gitea.example.com/test-org/test-product', instanceUrl: 'https://gitea.example.com' },
      { id: TEST_IDS.products.forgejo, name: 'test-product-forgejo', orgId: TEST_IDS.orgs.mfgActive, provider: 'forgejo', craCategory: 'category-1', repoUrl: 'https://forgejo.example.com/test-org/test-product', instanceUrl: 'https://forgejo.example.com' },
      { id: TEST_IDS.products.gitlab, name: 'test-product-gitlab', orgId: TEST_IDS.orgs.mfgActive, provider: 'gitlab', craCategory: 'default', repoUrl: 'https://gitlab.com/test-org/test-product', instanceUrl: null },
      { id: TEST_IDS.products.impGithub, name: 'test-imp-github', orgId: TEST_IDS.orgs.impTrial, provider: 'github', craCategory: 'default', repoUrl: 'https://github.com/imp-org/product1', instanceUrl: null },
      { id: TEST_IDS.products.impCodeberg, name: 'test-imp-codeberg', orgId: TEST_IDS.orgs.impTrial, provider: 'codeberg', craCategory: 'default', repoUrl: 'https://codeberg.org/imp-org/product1', instanceUrl: null },
      { id: TEST_IDS.products.distGithub1, name: 'test-dist-github1', orgId: TEST_IDS.orgs.distSuspended, provider: 'github', craCategory: 'default', repoUrl: 'https://github.com/dist-org/product1', instanceUrl: null },
      { id: TEST_IDS.products.distGithub2, name: 'test-dist-github2', orgId: TEST_IDS.orgs.distSuspended, provider: 'github', craCategory: 'category-1', repoUrl: 'https://github.com/dist-org/product2', instanceUrl: null },
      { id: TEST_IDS.products.ossGithub, name: 'test-oss-github', orgId: TEST_IDS.orgs.ossReadOnly, provider: 'github', craCategory: 'default', repoUrl: 'https://github.com/oss-org/product1', instanceUrl: null },
      { id: TEST_IDS.products.ossGitea, name: 'test-oss-gitea', orgId: TEST_IDS.orgs.ossReadOnly, provider: 'gitea', craCategory: 'default', repoUrl: 'https://gitea.example.com/oss-org/product1', instanceUrl: 'https://gitea.example.com' },
      { id: TEST_IDS.products.pdGithub, name: 'test-pd-github', orgId: TEST_IDS.orgs.mfgPastDue, provider: 'github', craCategory: 'default', repoUrl: 'https://github.com/pd-org/product1', instanceUrl: null },
      { id: TEST_IDS.products.pdForgejo, name: 'test-pd-forgejo', orgId: TEST_IDS.orgs.mfgPastDue, provider: 'forgejo', craCategory: 'category-1', repoUrl: 'https://forgejo.example.com/pd-org/product1', instanceUrl: 'https://forgejo.example.com' },
    ];

    const prodSession = getDriver().session();
    try {
      for (const p of products) {
        await prodSession.run(
          `MATCH (o:Organisation {id: $orgId})
           MERGE (p:Product {id: $id})
           ON CREATE SET p.name = $name, p.provider = $provider,
             p.craCategory = $craCategory, p.repoUrl = $repoUrl,
             p.instanceUrl = $instanceUrl, p.status = 'active',
             p.createdAt = datetime(), p.updatedAt = datetime()
           ON MATCH SET p.name = $name, p.updatedAt = datetime()
           MERGE (p)-[:BELONGS_TO]->(o)`,
          p
        );
        counts.products++;
      }
    } finally {
      await prodSession.close();
    }

    // ── 5. Seed Vulnerability Findings ─────────────────────────
    const findings = [
      { productId: TEST_IDS.products.github, orgId: TEST_IDS.orgs.mfgActive, title: 'CVE-2024-0001 - Prototype Pollution', severity: 'critical', cvssScore: 9.8, source: 'osv', sourceId: 'GHSA-test-0001', dependencyName: 'lodash', dependencyVersion: '4.17.20', fixedVersion: '4.17.21', status: 'open' },
      { productId: TEST_IDS.products.github, orgId: TEST_IDS.orgs.mfgActive, title: 'CVE-2024-0002 - XSS in Template', severity: 'high', cvssScore: 7.5, source: 'osv', sourceId: 'GHSA-test-0002', dependencyName: 'handlebars', dependencyVersion: '4.7.6', fixedVersion: '4.7.8', status: 'open' },
      { productId: TEST_IDS.products.github, orgId: TEST_IDS.orgs.mfgActive, title: 'CVE-2024-0003 - ReDoS', severity: 'medium', cvssScore: 5.3, source: 'nvd', sourceId: 'CVE-2024-0003', dependencyName: 'minimatch', dependencyVersion: '3.0.4', fixedVersion: '3.1.2', status: 'mitigated' },
      { productId: TEST_IDS.products.github, orgId: TEST_IDS.orgs.mfgActive, title: 'CVE-2024-0004 - Info Leak', severity: 'low', cvssScore: 3.1, source: 'osv', sourceId: 'GHSA-test-0004', dependencyName: 'debug', dependencyVersion: '4.3.1', fixedVersion: '4.3.4', status: 'open' },
      { productId: TEST_IDS.products.github, orgId: TEST_IDS.orgs.mfgActive, title: 'CVE-2024-0005 - DoS', severity: 'high', cvssScore: 7.8, source: 'nvd', sourceId: 'CVE-2024-0005', dependencyName: 'express', dependencyVersion: '4.18.0', fixedVersion: '4.19.0', status: 'closed' },
      { productId: TEST_IDS.products.codeberg, orgId: TEST_IDS.orgs.mfgActive, title: 'CVE-2024-1001 - SQL Injection', severity: 'critical', cvssScore: 9.1, source: 'osv', sourceId: 'PYSEC-test-1001', dependencyName: 'django', dependencyVersion: '4.1.0', fixedVersion: '4.1.7', status: 'open' },
      { productId: TEST_IDS.products.codeberg, orgId: TEST_IDS.orgs.mfgActive, title: 'CVE-2024-1002 - CSRF', severity: 'medium', cvssScore: 6.1, source: 'osv', sourceId: 'PYSEC-test-1002', dependencyName: 'flask', dependencyVersion: '2.2.0', fixedVersion: '2.3.0', status: 'open' },
      { productId: TEST_IDS.products.codeberg, orgId: TEST_IDS.orgs.mfgActive, title: 'CVE-2024-1003 - Path Traversal', severity: 'high', cvssScore: 7.2, source: 'nvd', sourceId: 'CVE-2024-1003', dependencyName: 'werkzeug', dependencyVersion: '2.2.2', fixedVersion: '2.3.0', status: 'mitigated' },
      { productId: TEST_IDS.products.gitlab, orgId: TEST_IDS.orgs.mfgActive, title: 'CVE-2024-2001 - Memory Leak', severity: 'medium', cvssScore: 5.5, source: 'osv', sourceId: 'GO-test-2001', dependencyName: 'golang.org/x/net', dependencyVersion: '0.10.0', fixedVersion: '0.15.0', status: 'open' },
      { productId: TEST_IDS.products.gitlab, orgId: TEST_IDS.orgs.mfgActive, title: 'CVE-2024-2002 - Cert Validation', severity: 'high', cvssScore: 8.0, source: 'nvd', sourceId: 'CVE-2024-2002', dependencyName: 'golang.org/x/crypto', dependencyVersion: '0.11.0', fixedVersion: '0.14.0', status: 'open' },
    ];

    for (const f of findings) {
      const id = uuid();
      await pool.query(
        `INSERT INTO vulnerability_findings (id, product_id, org_id, title, severity, cvss_score, source, source_id, dependency_name, dependency_version, fixed_version, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
         ON CONFLICT DO NOTHING`,
        [id, f.productId, f.orgId, f.title, f.severity, f.cvssScore, f.source, f.sourceId, f.dependencyName, f.dependencyVersion, f.fixedVersion, f.status]
      );
      counts.findings++;
    }

    // ── 6. Seed CRA Reports ───────────────────────────────────
    const now = new Date();
    const reports = [
      {
        id: TEST_IDS.reports.draft, orgId: TEST_IDS.orgs.mfgActive, productId: TEST_IDS.products.github,
        reportType: 'vulnerability', status: 'draft',
        awarenessAt: new Date(now.getTime() - 2 * 3600000),
        createdBy: TEST_IDS.users.mfgAdmin,
      },
      {
        id: TEST_IDS.reports.earlyWarningSent, orgId: TEST_IDS.orgs.mfgActive, productId: TEST_IDS.products.codeberg,
        reportType: 'vulnerability', status: 'early_warning_sent',
        awarenessAt: new Date(now.getTime() - 20 * 3600000),
        createdBy: TEST_IDS.users.mfgAdmin,
      },
      {
        id: TEST_IDS.reports.notificationSent, orgId: TEST_IDS.orgs.mfgActive, productId: TEST_IDS.products.github,
        reportType: 'incident', status: 'notification_sent',
        awarenessAt: new Date(now.getTime() - 5 * 86400000),
        createdBy: TEST_IDS.users.mfgAdmin,
      },
      {
        id: TEST_IDS.reports.closed, orgId: TEST_IDS.orgs.mfgActive, productId: TEST_IDS.products.gitlab,
        reportType: 'vulnerability', status: 'closed',
        awarenessAt: new Date(now.getTime() - 30 * 86400000),
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
         ON CONFLICT (id) DO UPDATE SET
           status = $5, awareness_at = $6,
           early_warning_deadline = $7, notification_deadline = $8,
           final_report_deadline = $9, updated_at = NOW()`,
        [r.id, r.orgId, r.productId, r.reportType, r.status, r.awarenessAt,
         earlyWarningDeadline, notificationDeadline, finalDeadline, r.createdBy]
      );
      counts.reports++;
    }

    // ── 7. Seed Notifications ──────────────────────────────────
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
      counts.notifications++;
    }

    console.log('[DEV] Seed test data complete:', counts);
    res.json({ success: true, counts });
  } catch (err: any) {
    console.error('[DEV] Seed test data failed:', err);
    res.status(500).json({ error: 'Failed to seed test data', message: err.message });
  }
});

export default router;

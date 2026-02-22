/**
 * DEV ONLY ROUTES — MUST BE REMOVED BEFORE PRODUCTION
 *
 * These routes perform destructive operations for development/testing.
 */
import { Router, Request, Response } from 'express';
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

export default router;

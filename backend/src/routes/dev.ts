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

export default router;

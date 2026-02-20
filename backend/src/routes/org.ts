import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';

const router = Router();

// Middleware to verify auth token
async function requireAuth(req: Request, res: Response, next: Function) {
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

  (req as any).userId = payload.userId;
  (req as any).email = payload.email;
  next();
}

// POST /api/org — Create organisation
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const { name, country, companySize, craRole, industry } = req.body;
  const userId = (req as any).userId;

  // Validation
  if (!name || !country || !companySize || !craRole) {
    res.status(400).json({ error: 'Name, country, company size, and CRA role are required' });
    return;
  }

  const validSizes = ['micro', 'small', 'medium', 'large'];
  if (!validSizes.includes(companySize)) {
    res.status(400).json({ error: 'Invalid company size. Must be: micro, small, medium, or large' });
    return;
  }

  const validRoles = ['manufacturer', 'importer', 'distributor', 'open_source_steward'];
  if (!validRoles.includes(craRole)) {
    res.status(400).json({ error: 'Invalid CRA role' });
    return;
  }

  try {
    // Check if user already has an org
    const existingUser = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
    if (existingUser.rows[0]?.org_id) {
      res.status(409).json({ error: 'User already belongs to an organisation' });
      return;
    }

    const orgId = uuidv4();

    // Create Organisation node in Neo4j
    const session = getDriver().session();
    try {
      await session.run(
        `CREATE (o:Organisation {
          id: $id,
          name: $name,
          country: $country,
          companySize: $companySize,
          craRole: $craRole,
          industry: $industry,
          createdAt: datetime(),
          updatedAt: datetime()
        }) RETURN o`,
        { id: orgId, name, country, companySize, craRole, industry: industry || '' }
      );
    } finally {
      await session.close();
    }

    // Link user to org in Postgres
    await pool.query(
      'UPDATE users SET org_id = $1, org_role = $2, updated_at = NOW() WHERE id = $3',
      [orgId, 'admin', userId]
    );

    res.status(201).json({
      id: orgId,
      name,
      country,
      companySize,
      craRole,
      industry: industry || '',
      userRole: 'admin',
    });
  } catch (err) {
    console.error('Failed to create organisation:', err);
    res.status(500).json({ error: 'Failed to create organisation' });
  }
});

// GET /api/org — Get current user's organisation
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  try {
    const userResult = await pool.query(
      'SELECT org_id, org_role FROM users WHERE id = $1',
      [userId]
    );

    const orgId = userResult.rows[0]?.org_id;
    if (!orgId) {
      res.status(404).json({ error: 'No organisation found' });
      return;
    }

    // Fetch org from Neo4j
    const session = getDriver().session();
    try {
      const result = await session.run(
        'MATCH (o:Organisation {id: $id}) RETURN o',
        { id: orgId }
      );

      if (result.records.length === 0) {
        res.status(404).json({ error: 'Organisation not found in graph' });
        return;
      }

      const org = result.records[0].get('o').properties;
      res.json({
        id: org.id,
        name: org.name,
        country: org.country,
        companySize: org.companySize,
        craRole: org.craRole,
        industry: org.industry,
        userRole: userResult.rows[0].org_role,
      });
    } finally {
      await session.close();
    }
  } catch (err) {
    console.error('Failed to fetch organisation:', err);
    res.status(500).json({ error: 'Failed to fetch organisation' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';

const router = Router();

async function requireAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) { res.status(401).json({ error: 'No token provided' }); return; }
  const token = authHeader.split(' ')[1];
  try {
    const payload = verifySessionToken(token);
    if (!payload) { res.status(401).json({ error: 'Invalid token' }); return; }
    (req as any).userId = payload.userId;
    (req as any).email = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

async function getOrgId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.org_id || null;
}

// ─── Role definitions ────────────────────────────────────────
const ORG_ROLES = [
  { role_key: 'manufacturer_contact', title: 'Manufacturer Contact', cra_reference: 'CRA Article 13' },
  { role_key: 'authorised_representative', title: 'EU Authorised Representative', cra_reference: 'CRA Article 15' },
  { role_key: 'compliance_officer', title: 'Compliance Officer', cra_reference: 'Governance' },
];

const PRODUCT_ROLES = [
  { role_key: 'security_contact', title: 'Security Contact', cra_reference: 'CRA Article 11' },
  { role_key: 'technical_file_owner', title: 'Technical File Owner', cra_reference: 'CRA Article 31' },
  { role_key: 'incident_response_lead', title: 'Incident Response Lead', cra_reference: 'NIS2' },
];

// ─── Auto-create missing stakeholder rows ────────────────────
async function ensureStakeholders(orgId: string, productIds: string[]): Promise<void> {
  // Org-level roles
  for (const role of ORG_ROLES) {
    await pool.query(
      `INSERT INTO stakeholders (org_id, product_id, role_key)
       VALUES ($1, NULL, $2)
       ON CONFLICT DO NOTHING`,
      [orgId, role.role_key]
    );
  }
  // Product-level roles
  for (const productId of productIds) {
    for (const role of PRODUCT_ROLES) {
      await pool.query(
        `INSERT INTO stakeholders (org_id, product_id, role_key)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [orgId, productId, role.role_key]
      );
    }
  }
}

// ─── GET /api/stakeholders ───────────────────────────────────
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    // Get all products for this org from Neo4j
    const driver = getDriver();
    const session = driver.session();
    let products: { id: string; name: string }[] = [];
    try {
      const result = await session.run(
        `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product)
         RETURN p.id AS id, p.name AS name ORDER BY p.name`,
        { orgId }
      );
      products = result.records.map(r => ({ id: r.get('id'), name: r.get('name') }));
    } finally {
      await session.close();
    }

    // Auto-create missing stakeholder rows
    await ensureStakeholders(orgId, products.map(p => p.id));

    // Fetch all stakeholders for this org
    const stakeholders = await pool.query(
      `SELECT id, org_id, product_id, role_key, name, email, phone, organisation, address, updated_by, updated_at
       FROM stakeholders WHERE org_id = $1
       ORDER BY product_id NULLS FIRST, role_key`,
      [orgId]
    );

    // Split into org-level and product-level
    const roleMeta = [...ORG_ROLES, ...PRODUCT_ROLES];
    function enrich(row: any) {
      const meta = roleMeta.find(r => r.role_key === row.role_key);
      return {
        id: row.id,
        roleKey: row.role_key,
        title: meta?.title || row.role_key,
        craReference: meta?.cra_reference || '',
        name: row.name || '',
        email: row.email || '',
        phone: row.phone || '',
        organisation: row.organisation || '',
        address: row.address || '',
        updatedBy: row.updated_by,
        updatedAt: row.updated_at,
      };
    }

    const orgStakeholders = stakeholders.rows
      .filter(r => r.product_id === null)
      .map(enrich);

    const productStakeholders: Record<string, { productName: string; stakeholders: any[] }> = {};
    for (const product of products) {
      productStakeholders[product.id] = {
        productName: product.name,
        stakeholders: stakeholders.rows
          .filter(r => r.product_id === product.id)
          .map(enrich),
      };
    }

    res.json({ orgStakeholders, productStakeholders });

  } catch (err) {
    console.error('Failed to fetch stakeholders:', err);
    res.status(500).json({ error: 'Failed to fetch stakeholders' });
  }
});

// ─── PUT /api/stakeholders/:id ───────────────────────────────
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).email;

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const stakeholderId = req.params.id as string;
    const { name, email, phone, organisation, address } = req.body;

    // Verify stakeholder belongs to user's org
    const check = await pool.query(
      `SELECT id, role_key, product_id FROM stakeholders WHERE id = $1 AND org_id = $2`,
      [stakeholderId, orgId]
    );
    if (check.rows.length === 0) {
      res.status(404).json({ error: 'Stakeholder not found' });
      return;
    }

    const result = await pool.query(
      `UPDATE stakeholders
       SET name = $1, email = $2, phone = $3, organisation = $4, address = $5,
           updated_by = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING id, role_key, name, email, phone, organisation, address, updated_by, updated_at`,
      [name || '', email || '', phone || '', organisation || '', address || '', userEmail, stakeholderId]
    );

    const row = result.rows[0];

    // Record telemetry
    const reqData = extractRequestData(req);
    await recordEvent({
      userId,
      email: userEmail,
      eventType: 'stakeholder_updated',
      ...reqData,
      metadata: {
        stakeholderId,
        roleKey: check.rows[0].role_key,
        productId: check.rows[0].product_id,
      },
    });

    res.json({
      id: row.id,
      roleKey: row.role_key,
      name: row.name,
      email: row.email,
      phone: row.phone,
      organisation: row.organisation,
      address: row.address,
      updatedBy: row.updated_by,
      updatedAt: row.updated_at,
    });

  } catch (err) {
    console.error('Failed to update stakeholder:', err);
    res.status(500).json({ error: 'Failed to update stakeholder' });
  }
});

export default router;

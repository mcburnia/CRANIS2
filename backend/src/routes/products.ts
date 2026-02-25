import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDriver } from '../db/neo4j.js';
import pool from '../db/pool.js';
import { verifySessionToken } from '../utils/token.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';

const router = Router();

const VALID_DIST_MODELS = ['proprietary_binary', 'saas_hosted', 'source_available', 'library_component', 'internal_only'];

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

// Helper: get user's org_id
async function getUserOrgId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.org_id || null;
}

// GET /api/products — List products for the user's org
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const orgId = await getUserOrgId((req as any).userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product)
       RETURN p ORDER BY p.createdAt DESC`,
      { orgId }
    );

    const products = result.records.map(r => {
      const p = r.get('p').properties;
      return {
        id: p.id,
        name: p.name,
        description: p.description || '',
        version: p.version || '',
        productType: p.productType || '',
        craCategory: p.craCategory || 'default',
        repoUrl: p.repoUrl || '',
        distributionModel: p.distributionModel || null,
        status: p.status || 'active',
        createdAt: p.createdAt?.toString() || '',
      };
    });

    res.json({ products });
  } finally {
    await session.close();
  }
});

// GET /api/products/:id — Get single product
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const orgId = await getUserOrgId((req as any).userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p`,
      { orgId, productId: req.params.id }
    );

    if (result.records.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const p = result.records[0].get('p').properties;
    res.json({
      id: p.id,
      name: p.name,
      description: p.description || '',
      version: p.version || '',
      productType: p.productType || '',
      craCategory: p.craCategory || 'default',
      repoUrl: p.repoUrl || '',
      distributionModel: p.distributionModel || null,
      status: p.status || 'active',
      createdAt: p.createdAt?.toString() || '',
      updatedAt: p.updatedAt?.toString() || '',
    });
  } finally {
    await session.close();
  }
});

// POST /api/products — Create product
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).email;
  const orgId = await getUserOrgId(userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const { name, description, version, productType, craCategory, repoUrl, distributionModel } = req.body;

  if (!name?.trim()) {
    res.status(400).json({ error: 'Product name is required' });
    return;
  }

  const validTypes = ['firmware', 'saas', 'library', 'desktop_app', 'mobile_app', 'iot_device', 'embedded', 'other'];
  const validCategories = ['default', 'class_i', 'class_ii'];

  const productId = uuidv4();
  const session = getDriver().session();
  try {
    await session.run(
      `MATCH (o:Organisation {id: $orgId})
       CREATE (p:Product {
         id: $productId,
         name: $name,
         description: $description,
         version: $version,
         productType: $productType,
         craCategory: $craCategory,
         repoUrl: $repoUrl,
         distributionModel: $distributionModel,
         status: 'active',
         createdAt: datetime(),
         updatedAt: datetime()
       })
       CREATE (p)-[:BELONGS_TO]->(o)
       RETURN p`,
      {
        orgId,
        productId,
        name: name.trim(),
        description: description?.trim() || '',
        version: version?.trim() || '',
        productType: validTypes.includes(productType) ? productType : 'other',
        craCategory: validCategories.includes(craCategory) ? craCategory : 'default',
        repoUrl: repoUrl?.trim() || '',
        distributionModel: VALID_DIST_MODELS.includes(distributionModel) ? distributionModel : null,
      }
    );

    // Record telemetry
    const reqData = extractRequestData(req);
    await recordEvent({
      userId,
      email: userEmail,
      eventType: 'product_created',
      ipAddress: reqData.ipAddress,
      userAgent: reqData.userAgent,
      acceptLanguage: reqData.acceptLanguage,
      metadata: { productId, productName: name.trim(), productType, craCategory, repoUrl: repoUrl?.trim() || '' },
    });

    res.status(201).json({
      id: productId,
      name: name.trim(),
      description: description?.trim() || '',
      version: version?.trim() || '',
      productType: validTypes.includes(productType) ? productType : 'other',
      craCategory: validCategories.includes(craCategory) ? craCategory : 'default',
      repoUrl: repoUrl?.trim() || '',
      distributionModel: VALID_DIST_MODELS.includes(distributionModel) ? distributionModel : null,
      status: 'active',
    });
  } catch (err) {
    console.error('Failed to create product:', err);
    res.status(500).json({ error: 'Failed to create product' });
  } finally {
    await session.close();
  }
});

// PUT /api/products/:id — Update product
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  const orgId = await getUserOrgId((req as any).userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const { name, description, version, productType, craCategory, repoUrl, distributionModel } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: 'Product name is required' }); return; }

  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       SET p.name = $name, p.description = $description, p.version = $version,
           p.productType = $productType, p.craCategory = $craCategory,
           p.repoUrl = $repoUrl, p.distributionModel = $distributionModel,
           p.updatedAt = datetime()
       RETURN p`,
      {
        orgId,
        productId: req.params.id,
        name: name.trim(),
        description: description?.trim() || '',
        version: version?.trim() || '',
        productType: productType || 'other',
        craCategory: craCategory || 'default',
        repoUrl: repoUrl?.trim() || '',
        distributionModel: VALID_DIST_MODELS.includes(distributionModel) ? distributionModel : null,
      }
    );

    if (result.records.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const p = result.records[0].get('p').properties;
    res.json({
      id: p.id,
      name: p.name,
      description: p.description || '',
      version: p.version || '',
      productType: p.productType || '',
      craCategory: p.craCategory || 'default',
      repoUrl: p.repoUrl || '',
      distributionModel: p.distributionModel || null,
    });
  } finally {
    await session.close();
  }
});

// DELETE /api/products/:id — Delete product
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).email;
  const orgId = await getUserOrgId(userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const session = getDriver().session();
  try {
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       WITH p, p.name AS productName
       DETACH DELETE p
       RETURN productName`,
      { orgId, productId: req.params.id }
    );

    if (result.records.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const reqData = extractRequestData(req);
    await recordEvent({
      userId,
      email: userEmail,
      eventType: 'product_deleted',
      ipAddress: reqData.ipAddress,
      userAgent: reqData.userAgent,
      acceptLanguage: reqData.acceptLanguage,
      metadata: { productId: req.params.id, productName: result.records[0].get('productName') },
    });

    res.json({ message: 'Product deleted' });
  } finally {
    await session.close();
  }
});

export default router;

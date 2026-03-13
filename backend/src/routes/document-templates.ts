import { Router, Request, Response } from 'express';
import { verifySessionToken } from '../utils/token.js';
import pool from '../db/pool.js';
import { TEMPLATE_CATALOGUE, getTemplateContent, generateTemplateForProduct } from '../services/document-templates.js';

const router = Router();

// ─── Auth middleware ──────────────────────────────────────────────────────────

async function requireAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = verifySessionToken(token);
    if (!payload) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
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

// ─── GET /api/document-templates – list available templates ───────────────────

router.get('/', requireAuth, (_req: Request, res: Response) => {
  res.json(TEMPLATE_CATALOGUE);
});

// ─── GET /api/document-templates/:id/download – download raw template ─────────

router.get('/:id/download', requireAuth, (req: Request, res: Response) => {
  const id = req.params.id as string;

  const template = TEMPLATE_CATALOGUE.find(t => t.id === id);
  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  const content = getTemplateContent(id);
  if (!content) {
    res.status(404).json({ error: 'Template content not found' });
    return;
  }

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${template.filename}"`);
  res.send(content);
});

// ─── GET /api/document-templates/:id/generate – auto-populated template ───────

router.get('/:id/generate', requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const productId = req.query.productId as string;
  const versionFormat = req.query.versionFormat as string | undefined;
  const securitySuffix = req.query.securitySuffix as string | undefined;

  if (!productId) {
    res.status(400).json({ error: 'productId query parameter is required' });
    return;
  }

  const template = TEMPLATE_CATALOGUE.find(t => t.id === id);
  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  const orgId = await getOrgId((req as any).userId);
  if (!orgId) {
    res.status(403).json({ error: 'No organisation found' });
    return;
  }

  try {
    const content = await generateTemplateForProduct(id, {
      productId,
      orgId,
      versionFormat: versionFormat || undefined,
      securitySuffix: securitySuffix || undefined,
    });

    if (!content) {
      res.status(404).json({ error: 'Product not found or template generation failed' });
      return;
    }

    const sanitisedName = template.filename.replace('.md', '');
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitisedName}-generated.md"`);
    res.send(content);
  } catch (err: any) {
    console.error('[DOCUMENT-TEMPLATES] Generate error:', err.message);
    res.status(500).json({ error: 'Failed to generate template' });
  }
});

export default router;

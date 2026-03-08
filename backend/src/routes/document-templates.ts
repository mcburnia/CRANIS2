import { Router, Request, Response } from 'express';
import { verifySessionToken } from '../utils/token.js';
import { TEMPLATE_CATALOGUE, getTemplateContent } from '../services/document-templates.js';

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

// ─── GET /api/document-templates — list available templates ───────────────────

router.get('/', requireAuth, (_req: Request, res: Response) => {
  res.json(TEMPLATE_CATALOGUE);
});

// ─── GET /api/document-templates/:id/download — download template as Markdown ─

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

export default router;

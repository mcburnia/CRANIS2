import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { requirePlatformAdmin } from '../middleware/requirePlatformAdmin.js';

const router = Router();

// GET /api/docs — List all doc pages (public, no auth)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT slug, title, updated_at FROM doc_pages ORDER BY slug`
    );
    res.json({ docs: rows });
  } catch (err) {
    console.error('GET /api/docs error:', err);
    res.status(500).json({ error: 'Failed to fetch documentation' });
  }
});

// GET /api/docs/:slug — Get single page (public, no auth)
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT d.slug, d.title, d.content, d.updated_at,
              u.email AS updated_by_email
       FROM doc_pages d
       LEFT JOIN users u ON u.id = d.updated_by
       WHERE d.slug = $1`,
      [req.params.slug]
    );
    if (rows.length === 0) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /api/docs/:slug error:', err);
    res.status(500).json({ error: 'Failed to fetch page' });
  }
});

// PUT /api/docs/:slug — Update page (platform admin only)
router.put('/:slug', requirePlatformAdmin, async (req: Request, res: Response) => {
  const { title, content } = req.body;
  const userId = (req as any).userId;

  if (!title || typeof content !== 'string') {
    res.status(400).json({ error: 'title and content are required' });
    return;
  }

  try {
    const { rows } = await pool.query(
      `UPDATE doc_pages
       SET title = $1, content = $2, updated_by = $3, updated_at = NOW()
       WHERE slug = $4
       RETURNING slug, title, updated_at`,
      [title, content, userId, req.params.slug]
    );
    if (rows.length === 0) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /api/docs/:slug error:', err);
    res.status(500).json({ error: 'Failed to update page' });
  }
});

export default router;

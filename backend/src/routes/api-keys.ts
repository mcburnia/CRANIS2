/**
 * API Key Management Routes (session-authenticated)
 *
 * POST   /api/settings/api-keys     — Create a new API key
 * GET    /api/settings/api-keys     — List all keys for the org
 * DELETE /api/settings/api-keys/:id — Revoke a key
 */

import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { verifySessionToken } from '../utils/token.js';
import { createApiKey, listApiKeys, revokeApiKey } from '../services/api-keys.js';

const router = Router();

async function requireAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) { res.status(401).json({ error: 'No token provided' }); return; }
  const token = authHeader.split(' ')[1];
  try {
    const payload = verifySessionToken(token);
    if (!payload) { res.status(401).json({ error: 'Invalid token' }); return; }
    (req as any).userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

async function getUserOrgId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.org_id || null;
}

// POST /api/settings/api-keys
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = await getUserOrgId((req as any).userId);
    if (!orgId) return res.status(400).json({ error: 'No organisation context' });

    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'name is required' });
    }

    const result = await createApiKey(orgId, name.trim(), (req as any).userId);
    res.json(result);
  } catch (error) {
    console.error('[API-KEYS] POST error:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// GET /api/settings/api-keys
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = await getUserOrgId((req as any).userId);
    if (!orgId) return res.status(400).json({ error: 'No organisation context' });

    const keys = await listApiKeys(orgId);
    res.json(keys);
  } catch (error) {
    console.error('[API-KEYS] GET error:', error);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

// DELETE /api/settings/api-keys/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = await getUserOrgId((req as any).userId);
    if (!orgId) return res.status(400).json({ error: 'No organisation context' });

    const revoked = await revokeApiKey(orgId, req.params.id as string);
    if (!revoked) return res.status(404).json({ error: 'Key not found or already revoked' });

    res.json({ ok: true });
  } catch (error) {
    console.error('[API-KEYS] DELETE error:', error);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

export default router;

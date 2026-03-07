/**
 * Trello Integration Routes
 *
 * GET    /api/integrations/trello          — Get org's Trello config
 * PUT    /api/integrations/trello          — Save/update credentials
 * DELETE /api/integrations/trello          — Disconnect Trello
 * PUT    /api/integrations/trello/enabled  — Toggle enabled/disabled
 * GET    /api/integrations/trello/boards   — List user's Trello boards
 * GET    /api/integrations/trello/boards/:boardId/lists — List board's lists
 * POST   /api/integrations/trello/boards/:boardId/create-default-lists — Create default CRANIS2 lists
 * GET    /api/integrations/trello/product-boards       — Get all product board mappings
 * PUT    /api/integrations/trello/product-boards/:productId — Save product board mapping
 * DELETE /api/integrations/trello/product-boards/:productId — Delete product board mapping
 * POST   /api/integrations/trello/test     — Send a test card
 */

import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { verifySessionToken } from '../utils/token.js';
import {
  getIntegration,
  saveIntegration,
  deleteIntegration,
  setEnabled,
  getOrgProductBoards,
  saveProductBoard,
  deleteProductBoard,
  listBoards,
  listBoardLists,
  createDefaultLists,
  sendTestCard,
} from '../services/trello.js';

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

// GET /api/integrations/trello
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = await getUserOrgId((req as any).userId);
    if (!orgId) return res.status(400).json({ error: 'No organisation context' });

    const integration = await getIntegration(orgId);
    if (!integration) return res.json({ connected: false });

    // Don't expose full token — mask it
    const maskedToken = integration.apiToken.length > 8
      ? integration.apiToken.slice(0, 4) + '...' + integration.apiToken.slice(-4)
      : '****';

    const boards = await getOrgProductBoards(orgId);

    // Count cards created
    const cardCount = await pool.query(
      'SELECT COUNT(*)::int AS count FROM trello_card_log WHERE org_id = $1',
      [orgId]
    );

    res.json({
      connected: true,
      enabled: integration.enabled,
      apiKey: integration.apiKey,
      maskedToken,
      productBoards: boards,
      cardsCreated: cardCount.rows[0].count,
    });
  } catch (error) {
    console.error('[TRELLO] GET error:', error);
    res.status(500).json({ error: 'Failed to get Trello integration' });
  }
});

// PUT /api/integrations/trello
router.put('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = await getUserOrgId((req as any).userId);
    if (!orgId) return res.status(400).json({ error: 'No organisation context' });

    const { apiKey, apiToken } = req.body;
    if (!apiKey || !apiToken) return res.status(400).json({ error: 'apiKey and apiToken are required' });

    // Validate credentials by trying to list boards
    try {
      await listBoards(apiKey, apiToken);
    } catch {
      return res.status(400).json({ error: 'Invalid Trello credentials — could not access your boards' });
    }

    await saveIntegration(orgId, apiKey, apiToken);
    res.json({ ok: true });
  } catch (error) {
    console.error('[TRELLO] PUT error:', error);
    res.status(500).json({ error: 'Failed to save Trello integration' });
  }
});

// DELETE /api/integrations/trello
router.delete('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = await getUserOrgId((req as any).userId);
    if (!orgId) return res.status(400).json({ error: 'No organisation context' });

    await deleteIntegration(orgId);
    res.json({ ok: true });
  } catch (error) {
    console.error('[TRELLO] DELETE error:', error);
    res.status(500).json({ error: 'Failed to disconnect Trello' });
  }
});

// PUT /api/integrations/trello/enabled
router.put('/enabled', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = await getUserOrgId((req as any).userId);
    if (!orgId) return res.status(400).json({ error: 'No organisation context' });

    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be a boolean' });

    await setEnabled(orgId, enabled);
    res.json({ ok: true });
  } catch (error) {
    console.error('[TRELLO] PUT enabled error:', error);
    res.status(500).json({ error: 'Failed to update Trello integration' });
  }
});

// GET /api/integrations/trello/boards
router.get('/boards', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = await getUserOrgId((req as any).userId);
    if (!orgId) return res.status(400).json({ error: 'No organisation context' });

    const integration = await getIntegration(orgId);
    if (!integration) return res.status(404).json({ error: 'Trello not connected' });

    const boards = await listBoards(integration.apiKey, integration.apiToken);
    res.json(boards);
  } catch (error) {
    console.error('[TRELLO] GET boards error:', error);
    res.status(500).json({ error: 'Failed to list Trello boards' });
  }
});

// GET /api/integrations/trello/boards/:boardId/lists
router.get('/boards/:boardId/lists', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = await getUserOrgId((req as any).userId);
    if (!orgId) return res.status(400).json({ error: 'No organisation context' });

    const integration = await getIntegration(orgId);
    if (!integration) return res.status(404).json({ error: 'Trello not connected' });

    const lists = await listBoardLists(integration.apiKey, integration.apiToken, req.params.boardId as string);
    res.json(lists);
  } catch (error) {
    console.error('[TRELLO] GET lists error:', error);
    res.status(500).json({ error: 'Failed to list Trello board lists' });
  }
});

// POST /api/integrations/trello/boards/:boardId/create-default-lists
router.post('/boards/:boardId/create-default-lists', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = await getUserOrgId((req as any).userId);
    if (!orgId) return res.status(400).json({ error: 'No organisation context' });

    const integration = await getIntegration(orgId);
    if (!integration) return res.status(404).json({ error: 'Trello not connected' });

    const lists = await createDefaultLists(integration.apiKey, integration.apiToken, req.params.boardId as string);
    res.json(lists);
  } catch (error) {
    console.error('[TRELLO] POST create-default-lists error:', error);
    res.status(500).json({ error: 'Failed to create default lists' });
  }
});

// GET /api/integrations/trello/product-boards
router.get('/product-boards', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = await getUserOrgId((req as any).userId);
    if (!orgId) return res.status(400).json({ error: 'No organisation context' });

    const boards = await getOrgProductBoards(orgId);
    res.json(boards);
  } catch (error) {
    console.error('[TRELLO] GET product-boards error:', error);
    res.status(500).json({ error: 'Failed to get product boards' });
  }
});

// PUT /api/integrations/trello/product-boards/:productId
router.put('/product-boards/:productId', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = await getUserOrgId((req as any).userId);
    if (!orgId) return res.status(400).json({ error: 'No organisation context' });

    const { productId } = req.params;
    const { boardId, boardName, listVuln, listObligations, listDeadlines, listGaps } = req.body;
    if (!boardId) return res.status(400).json({ error: 'boardId is required' });

    await saveProductBoard(orgId, productId as string, boardId, boardName || null, {
      vuln: listVuln,
      obligations: listObligations,
      deadlines: listDeadlines,
      gaps: listGaps,
    });
    res.json({ ok: true });
  } catch (error) {
    console.error('[TRELLO] PUT product-board error:', error);
    res.status(500).json({ error: 'Failed to save product board mapping' });
  }
});

// DELETE /api/integrations/trello/product-boards/:productId
router.delete('/product-boards/:productId', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = await getUserOrgId((req as any).userId);
    if (!orgId) return res.status(400).json({ error: 'No organisation context' });

    await deleteProductBoard(orgId, req.params.productId as string);
    res.json({ ok: true });
  } catch (error) {
    console.error('[TRELLO] DELETE product-board error:', error);
    res.status(500).json({ error: 'Failed to delete product board mapping' });
  }
});

// POST /api/integrations/trello/test
router.post('/test', requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = await getUserOrgId((req as any).userId);
    if (!orgId) return res.status(400).json({ error: 'No organisation context' });

    const integration = await getIntegration(orgId);
    if (!integration) return res.status(404).json({ error: 'Trello not connected' });

    const { listId } = req.body;
    if (!listId) return res.status(400).json({ error: 'listId is required' });

    const card = await sendTestCard(integration.apiKey, integration.apiToken, listId);
    res.json({ ok: true, cardUrl: card.url });
  } catch (error) {
    console.error('[TRELLO] POST test error:', error);
    res.status(500).json({ error: 'Failed to send test card' });
  }
});

export default router;

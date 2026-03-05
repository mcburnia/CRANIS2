import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
import { requirePlan } from '../middleware/requirePlan.js';
import { isCopilotConfigured, gatherProductContext, generateSuggestion } from '../services/copilot.js';

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

// GET /api/copilot/status — check if copilot is available for this org
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const configured = isCopilotConfigured();

    // Check org plan
    const billing = await pool.query(
      'SELECT plan, exempt FROM org_billing WHERE org_id = $1',
      [orgId]
    );
    const row = billing.rows[0];
    const plan = row?.plan || 'standard';
    const exempt = row?.exempt || false;
    const hasAccess = exempt || plan === 'pro' || plan === 'enterprise';

    // Usage this month
    const usageResult = await pool.query(
      `SELECT COUNT(*)::int AS requests,
              COALESCE(SUM(input_tokens), 0)::int AS input_tokens,
              COALESCE(SUM(output_tokens), 0)::int AS output_tokens
       FROM copilot_usage
       WHERE org_id = $1 AND created_at >= date_trunc('month', NOW())`,
      [orgId]
    );
    const usage = usageResult.rows[0];

    res.json({
      available: configured && hasAccess,
      configured,
      plan,
      hasAccess,
      usage: {
        requestsThisMonth: usage.requests,
        inputTokensThisMonth: usage.input_tokens,
        outputTokensThisMonth: usage.output_tokens,
      },
    });
  } catch (err) {
    console.error('[COPILOT] Failed to check status:', err);
    res.status(500).json({ error: 'Failed to check copilot status' });
  }
});

// POST /api/copilot/suggest — generate AI suggestion
router.post('/suggest', requireAuth, requirePlan('pro'), async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).email;

  if (!isCopilotConfigured()) {
    res.status(503).json({ error: 'AI copilot is not configured. Please set ANTHROPIC_API_KEY.' });
    return;
  }

  const { productId, sectionKey, type, existingContent } = req.body;

  if (!productId || !sectionKey || !type) {
    res.status(400).json({ error: 'Missing required fields: productId, sectionKey, type' });
    return;
  }

  if (!['technical_file', 'obligation'].includes(type)) {
    res.status(400).json({ error: 'type must be "technical_file" or "obligation"' });
    return;
  }

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    // Verify product belongs to org
    const neo4jSession = getDriver().session();
    try {
      const result = await neo4jSession.run(
        `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
         RETURN p.id AS id`,
        { orgId, productId }
      );
      if (result.records.length === 0) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
    } finally {
      await neo4jSession.close();
    }

    // Gather context
    const productContext = await gatherProductContext(productId, orgId);

    // Generate suggestion
    const result = await generateSuggestion({
      sectionKey,
      type,
      productContext,
      existingContent: existingContent || undefined,
    });

    // Log usage
    pool.query(
      `INSERT INTO copilot_usage (org_id, user_id, product_id, section_key, type, input_tokens, output_tokens, model)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [orgId, userId, productId, sectionKey, type, result.inputTokens, result.outputTokens, result.model]
    ).catch(err => console.error('[COPILOT] Failed to log usage:', err));

    res.json({
      suggestion: result.suggestion,
      tokensUsed: result.inputTokens + result.outputTokens,
    });
  } catch (err: any) {
    console.error('[COPILOT] Failed to generate suggestion:', err);
    res.status(500).json({ error: 'Failed to generate suggestion' });
  }
});

export default router;

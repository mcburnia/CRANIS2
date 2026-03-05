import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
import { requirePlan } from '../middleware/requirePlan.js';
import { isCopilotConfigured, gatherProductContext, generateSuggestion, generateTriageSuggestions, TriageFinding, gatherEnrichedRiskContext, generateRiskAssessment, gatherIncidentReportContext, generateIncidentReportDraft } from '../services/copilot.js';

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

// ─── Cost estimation ────────────────────────────────────────────────────────
// Anthropic Claude Sonnet pricing (USD per 1M tokens)
const INPUT_COST_PER_M = 3;   // $3 / 1M input tokens
const OUTPUT_COST_PER_M = 15;  // $15 / 1M output tokens

function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * INPUT_COST_PER_M + outputTokens * OUTPUT_COST_PER_M) / 1_000_000;
}

// GET /api/copilot/usage — detailed usage breakdown for the org
router.get('/usage', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    const months = Math.min(Math.max(parseInt(req.query.months as string) || 1, 1), 12);

    // 1. Monthly totals
    const historyResult = await pool.query(
      `SELECT date_trunc('month', created_at) AS month,
              COUNT(*)::int AS requests,
              COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
              COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens
       FROM copilot_usage
       WHERE org_id = $1 AND created_at >= date_trunc('month', NOW()) - ($2 || ' months')::interval
       GROUP BY month ORDER BY month DESC`,
      [orgId, String(months)]
    );

    // 2. Current month by type
    const byTypeResult = await pool.query(
      `SELECT type,
              COUNT(*)::int AS requests,
              COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
              COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens
       FROM copilot_usage
       WHERE org_id = $1 AND created_at >= date_trunc('month', NOW())
       GROUP BY type ORDER BY SUM(COALESCE(input_tokens, 0)) + SUM(COALESCE(output_tokens, 0)) DESC`,
      [orgId]
    );

    // 3. Current month by product
    const byProductResult = await pool.query(
      `SELECT product_id,
              COUNT(*)::int AS requests,
              COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
              COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens
       FROM copilot_usage
       WHERE org_id = $1 AND created_at >= date_trunc('month', NOW()) AND product_id IS NOT NULL
       GROUP BY product_id ORDER BY SUM(COALESCE(input_tokens, 0)) + SUM(COALESCE(output_tokens, 0)) DESC`,
      [orgId]
    );

    // Resolve product names via Neo4j
    const productIds = byProductResult.rows.map((r: any) => r.product_id).filter(Boolean);
    const productNames: Record<string, string> = {};
    if (productIds.length > 0) {
      const neo4jSession = getDriver().session();
      try {
        const result = await neo4jSession.run(
          `MATCH (p:Product) WHERE p.id IN $ids RETURN p.id AS id, p.name AS name`,
          { ids: productIds }
        );
        for (const r of result.records) {
          productNames[r.get('id')] = r.get('name') || 'Unknown';
        }
      } finally {
        await neo4jSession.close();
      }
    }

    // Current month totals
    const current = historyResult.rows[0];
    const currentInput = current ? Number(current.input_tokens) : 0;
    const currentOutput = current ? Number(current.output_tokens) : 0;

    res.json({
      currentMonth: {
        requests: current?.requests || 0,
        inputTokens: currentInput,
        outputTokens: currentOutput,
        estimatedCostUsd: parseFloat(estimateCostUsd(currentInput, currentOutput).toFixed(4)),
      },
      history: historyResult.rows.map((r: any) => ({
        month: r.month,
        requests: r.requests,
        inputTokens: Number(r.input_tokens),
        outputTokens: Number(r.output_tokens),
        estimatedCostUsd: parseFloat(estimateCostUsd(Number(r.input_tokens), Number(r.output_tokens)).toFixed(4)),
      })),
      byType: byTypeResult.rows.map((r: any) => ({
        type: r.type,
        requests: r.requests,
        inputTokens: Number(r.input_tokens),
        outputTokens: Number(r.output_tokens),
        estimatedCostUsd: parseFloat(estimateCostUsd(Number(r.input_tokens), Number(r.output_tokens)).toFixed(4)),
      })),
      byProduct: byProductResult.rows.map((r: any) => ({
        productId: r.product_id,
        productName: productNames[r.product_id] || 'Unknown',
        requests: r.requests,
        inputTokens: Number(r.input_tokens),
        outputTokens: Number(r.output_tokens),
        estimatedCostUsd: parseFloat(estimateCostUsd(Number(r.input_tokens), Number(r.output_tokens)).toFixed(4)),
      })),
    });
  } catch (err) {
    console.error('[COPILOT] Failed to fetch usage:', err);
    res.status(500).json({ error: 'Failed to fetch copilot usage' });
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

// POST /api/copilot/triage — AI triage vulnerability findings
router.post('/triage', requireAuth, requirePlan('pro'), async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  if (!isCopilotConfigured()) {
    res.status(503).json({ error: 'AI copilot is not configured. Please set ANTHROPIC_API_KEY.' });
    return;
  }

  const { productId, findingIds, autoApply } = req.body;

  if (!productId) {
    res.status(400).json({ error: 'Missing required field: productId' });
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

    // Fetch findings
    let findingsQuery = `SELECT id, title, severity, cvss_score, source, source_id,
      dependency_name, dependency_version, dependency_ecosystem,
      fixed_version, description, status
      FROM vulnerability_findings
      WHERE product_id = $1`;
    const params: any[] = [productId];

    if (findingIds && Array.isArray(findingIds) && findingIds.length > 0) {
      findingsQuery += ` AND id = ANY($2)`;
      params.push(findingIds);
    } else {
      // Default: triage open and acknowledged findings
      findingsQuery += ` AND status IN ('open', 'acknowledged')`;
    }

    findingsQuery += ` ORDER BY severity DESC, cvss_score DESC NULLS LAST LIMIT 100`;

    const findingsResult = await pool.query(findingsQuery, params);
    const findings: TriageFinding[] = findingsResult.rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      severity: r.severity,
      cvssScore: r.cvss_score ? parseFloat(r.cvss_score) : null,
      source: r.source,
      sourceId: r.source_id,
      dependencyName: r.dependency_name,
      dependencyVersion: r.dependency_version,
      dependencyEcosystem: r.dependency_ecosystem,
      fixedVersion: r.fixed_version,
      description: r.description,
      status: r.status,
    }));

    if (findings.length === 0) {
      res.json({
        suggestions: [],
        totalTriaged: 0,
        autoApplied: 0,
        tokensUsed: 0,
      });
      return;
    }

    // Gather context and generate triage suggestions
    const productContext = await gatherProductContext(productId, orgId);
    const triageResult = await generateTriageSuggestions(findings, productContext);

    // Auto-apply if requested
    let autoAppliedCount = 0;
    if (autoApply) {
      for (const s of triageResult.suggestions) {
        if (s.automatable && s.suggestedAction === 'dismiss') {
          await pool.query(
            `UPDATE vulnerability_findings
             SET status = 'dismissed', dismissed_by = 'ai-triage', dismissed_reason = $2, dismissed_at = NOW()
             WHERE id = $1 AND status IN ('open', 'acknowledged')`,
            [s.findingId, s.dismissReason || 'AI auto-triage: ' + s.reasoning.substring(0, 200)]
          );
          autoAppliedCount++;
        }
      }
    }

    // Log usage
    const totalTokens = triageResult.inputTokens + triageResult.outputTokens;
    pool.query(
      `INSERT INTO copilot_usage (org_id, user_id, product_id, section_key, type, input_tokens, output_tokens, model)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [orgId, userId, productId, 'vulnerability_triage', 'vulnerability_triage',
       triageResult.inputTokens, triageResult.outputTokens, triageResult.model]
    ).catch(err => console.error('[COPILOT] Failed to log triage usage:', err));

    res.json({
      suggestions: triageResult.suggestions.map(s => ({
        ...s,
        autoApplied: autoApply && s.automatable && s.suggestedAction === 'dismiss',
      })),
      totalTriaged: triageResult.suggestions.length,
      autoApplied: autoAppliedCount,
      tokensUsed: totalTokens,
    });
  } catch (err: any) {
    console.error('[COPILOT] Failed to triage findings:', err);
    res.status(500).json({ error: 'Failed to triage findings' });
  }
});

// POST /api/copilot/generate-risk-assessment — AI-generated risk assessment
router.post('/generate-risk-assessment', requireAuth, requirePlan('pro'), async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  if (!isCopilotConfigured()) {
    res.status(503).json({ error: 'AI copilot is not configured. Please set ANTHROPIC_API_KEY.' });
    return;
  }

  const { productId } = req.body;

  if (!productId) {
    res.status(400).json({ error: 'Missing required field: productId' });
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

    // Gather enriched context and generate
    const context = await gatherEnrichedRiskContext(productId, orgId);
    const result = await generateRiskAssessment(context);

    // Log usage
    pool.query(
      `INSERT INTO copilot_usage (org_id, user_id, product_id, section_key, type, input_tokens, output_tokens, model)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [orgId, userId, productId, 'risk_assessment', 'risk_assessment',
       result.inputTokens, result.outputTokens, result.model]
    ).catch(err => console.error('[COPILOT] Failed to log risk assessment usage:', err));

    res.json({
      fields: result.fields,
      annexIRequirements: result.annexIRequirements,
      tokensUsed: result.inputTokens + result.outputTokens,
    });
  } catch (err: any) {
    console.error('[COPILOT] Failed to generate risk assessment:', err);
    res.status(500).json({ error: 'Failed to generate risk assessment' });
  }
});

// POST /api/copilot/draft-incident-report — AI-drafted ENISA report stage
router.post('/draft-incident-report', requireAuth, requirePlan('pro'), async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  if (!isCopilotConfigured()) {
    res.status(503).json({ error: 'AI copilot is not configured. Please set ANTHROPIC_API_KEY.' });
    return;
  }

  const { reportId, stage } = req.body;

  if (!reportId) {
    res.status(400).json({ error: 'Missing required field: reportId' });
    return;
  }
  if (!stage || !['early_warning', 'notification', 'final_report'].includes(stage)) {
    res.status(400).json({ error: 'stage must be: early_warning, notification, or final_report' });
    return;
  }

  try {
    const orgId = await getOrgId(userId);
    if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

    // Gather context (also verifies report belongs to org)
    const context = await gatherIncidentReportContext(reportId, orgId);

    // Generate draft
    const result = await generateIncidentReportDraft(context, stage as 'early_warning' | 'notification' | 'final_report');

    // Log usage
    pool.query(
      `INSERT INTO copilot_usage (org_id, user_id, product_id, section_key, type, input_tokens, output_tokens, model)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [orgId, userId, context.report.productId, `report_draft_${stage}`, 'incident_report_draft',
       result.inputTokens, result.outputTokens, result.model]
    ).catch(err => console.error('[COPILOT] Failed to log report draft usage:', err));

    res.json({
      fields: result.fields,
      tokensUsed: result.inputTokens + result.outputTokens,
    });
  } catch (err: any) {
    if (err.message === 'Report not found') {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    console.error('[COPILOT] Failed to draft incident report:', err);
    res.status(500).json({ error: 'Failed to generate report draft' });
  }
});

export default router;

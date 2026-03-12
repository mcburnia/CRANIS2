import { Router, Request, Response } from 'express';
import pool from '../../db/pool.js';
import { getDriver } from '../../db/neo4j.js';
import { requirePlatformAdmin } from '../../middleware/requirePlatformAdmin.js';

const router = Router();

// ─── GET /api/admin/copilot-usage — Platform-wide AI copilot usage ──────────
const INPUT_COST_PER_M = 3;
const OUTPUT_COST_PER_M = 15;
function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * INPUT_COST_PER_M + outputTokens * OUTPUT_COST_PER_M) / 1_000_000;
}

router.get('/copilot-usage', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const months = Math.min(Math.max(parseInt(req.query.months as string) || 1, 1), 12);

    // 1. Platform totals (current month)
    const totalsResult = await pool.query(
      `SELECT COUNT(*)::int AS requests,
              COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
              COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
              COUNT(DISTINCT org_id)::int AS active_orgs
       FROM copilot_usage
       WHERE created_at >= date_trunc('month', NOW())`
    );
    const totals = totalsResult.rows[0];

    // 2. Monthly history
    const historyResult = await pool.query(
      `SELECT date_trunc('month', created_at) AS month,
              COUNT(*)::int AS requests,
              COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
              COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
              COUNT(DISTINCT org_id)::int AS active_orgs
       FROM copilot_usage
       WHERE created_at >= date_trunc('month', NOW()) - ($1 || ' months')::interval
       GROUP BY month ORDER BY month DESC`,
      [String(months)]
    );

    // 3. Per-org breakdown (current month)
    const byOrgResult = await pool.query(
      `SELECT org_id,
              COUNT(*)::int AS requests,
              COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
              COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens
       FROM copilot_usage
       WHERE created_at >= date_trunc('month', NOW())
       GROUP BY org_id ORDER BY SUM(COALESCE(input_tokens, 0)) + SUM(COALESCE(output_tokens, 0)) DESC`
    );

    // 4. By type (current month)
    const byTypeResult = await pool.query(
      `SELECT type,
              COUNT(*)::int AS requests,
              COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
              COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens
       FROM copilot_usage
       WHERE created_at >= date_trunc('month', NOW())
       GROUP BY type ORDER BY SUM(COALESCE(input_tokens, 0)) + SUM(COALESCE(output_tokens, 0)) DESC`
    );

    // Resolve org names via Neo4j
    const orgIds = byOrgResult.rows.map((r: any) => r.org_id).filter(Boolean);
    const orgNames: Record<string, string> = {};
    if (orgIds.length > 0) {
      const neo4jSession = getDriver().session();
      try {
        const result = await neo4jSession.run(
          `MATCH (o:Organisation) WHERE o.id IN $ids RETURN o.id AS id, o.name AS name`,
          { ids: orgIds }
        );
        for (const r of result.records) {
          orgNames[r.get('id')] = r.get('name') || 'Unknown';
        }
      } finally {
        await neo4jSession.close();
      }
    }

    const totalInput = Number(totals.input_tokens);
    const totalOutput = Number(totals.output_tokens);

    res.json({
      currentMonth: {
        requests: totals.requests,
        inputTokens: totalInput,
        outputTokens: totalOutput,
        estimatedCostUsd: parseFloat(estimateCostUsd(totalInput, totalOutput).toFixed(4)),
        activeOrgs: totals.active_orgs,
      },
      history: historyResult.rows.map((r: any) => ({
        month: r.month,
        requests: r.requests,
        inputTokens: Number(r.input_tokens),
        outputTokens: Number(r.output_tokens),
        estimatedCostUsd: parseFloat(estimateCostUsd(Number(r.input_tokens), Number(r.output_tokens)).toFixed(4)),
        activeOrgs: r.active_orgs,
      })),
      byOrg: byOrgResult.rows.map((r: any) => ({
        orgId: r.org_id,
        orgName: orgNames[r.org_id] || 'Unknown',
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
    });
  } catch (err) {
    console.error('Admin copilot-usage error:', err);
    res.status(500).json({ error: 'Failed to fetch copilot usage' });
  }
});

// ── CoPilot Prompt Management ──

router.get('/copilot-prompts', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, prompt_key, category, title, description, system_prompt,
              model, max_tokens, temperature, enabled, version, updated_at, updated_by
       FROM copilot_prompts
       ORDER BY CASE category WHEN 'foundation' THEN 0 ELSE 1 END, title`
    );
    res.json({ prompts: result.rows });
  } catch (err) {
    console.error('Admin copilot-prompts list error:', err);
    res.status(500).json({ error: 'Failed to fetch copilot prompts' });
  }
});

router.get('/copilot-prompts/:promptKey', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, prompt_key, category, title, description, system_prompt,
              model, max_tokens, temperature, enabled, version, updated_at, updated_by
       FROM copilot_prompts WHERE prompt_key = $1`,
      [req.params.promptKey]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Admin copilot-prompts get error:', err);
    res.status(500).json({ error: 'Failed to fetch copilot prompt' });
  }
});

router.put('/copilot-prompts/:promptKey', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { promptKey } = req.params;
    const { system_prompt, model, max_tokens, temperature, enabled, description } = req.body;
    const userId = (req as any).user?.id || null;

    // Validate required fields
    if (!system_prompt || typeof system_prompt !== 'string' || system_prompt.trim().length === 0) {
      return res.status(400).json({ error: 'system_prompt is required and must be non-empty' });
    }
    if (max_tokens && (typeof max_tokens !== 'number' || max_tokens < 100 || max_tokens > 16000)) {
      return res.status(400).json({ error: 'max_tokens must be between 100 and 16000' });
    }
    if (temperature !== undefined && (typeof temperature !== 'number' || temperature < 0 || temperature > 2)) {
      return res.status(400).json({ error: 'temperature must be between 0 and 2' });
    }

    const result = await pool.query(
      `UPDATE copilot_prompts
       SET system_prompt = $1,
           model = COALESCE($2, model),
           max_tokens = COALESCE($3, max_tokens),
           temperature = COALESCE($4, temperature),
           enabled = COALESCE($5, enabled),
           description = COALESCE($6, description),
           version = version + 1,
           updated_at = NOW(),
           updated_by = $7
       WHERE prompt_key = $8
       RETURNING id, prompt_key, category, title, description, system_prompt,
                 model, max_tokens, temperature, enabled, version, updated_at, updated_by`,
      [system_prompt.trim(), model || null, max_tokens || null, temperature ?? null,
       enabled ?? null, description || null, userId, promptKey]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    console.log(`[ADMIN] CoPilot prompt "${promptKey}" updated to v${result.rows[0].version} by ${userId}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Admin copilot-prompts update error:', err);
    res.status(500).json({ error: 'Failed to update copilot prompt' });
  }
});

export default router;

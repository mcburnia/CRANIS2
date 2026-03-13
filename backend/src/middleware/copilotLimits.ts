/**
 * Copilot Cost Protection Middleware
 *
 * 1. Per-org monthly token budget (hard cap)
 * 2. Per-endpoint rate limiting (based on copilot_usage table)
 */

import { Request, Response, NextFunction } from 'express';
import pool from '../db/pool.js';
import { getPlatformSetting } from '../services/billing.js';

const DEFAULT_MONTHLY_TOKEN_LIMIT = 500_000;

// Per-endpoint rate limits: { windowMinutes, maxCalls }
const ENDPOINT_RATE_LIMITS: Record<string, { windowMinutes: number; maxCalls: number }> = {
  suggest:                   { windowMinutes: 60,   maxCalls: 20 },
  vulnerability_triage:      { windowMinutes: 60,   maxCalls: 5  },
  risk_assessment:           { windowMinutes: 1440, maxCalls: 3  },
  incident_report_draft:     { windowMinutes: 1440, maxCalls: 5  },
  category_recommendation:   { windowMinutes: 1440, maxCalls: 5  },
};

/**
 * Get the monthly token limit for an org.
 * Priority: org_billing.copilot_token_limit > platform_settings > hardcoded default.
 */
async function getTokenLimit(orgId: string): Promise<number> {
  const billing = await pool.query(
    'SELECT copilot_token_limit FROM org_billing WHERE org_id = $1',
    [orgId]
  );
  const orgLimit = billing.rows[0]?.copilot_token_limit;
  if (orgLimit != null) return orgLimit;

  const platformLimit = await getPlatformSetting('copilot.monthly_token_limit');
  if (platformLimit != null) return Number(platformLimit);

  return DEFAULT_MONTHLY_TOKEN_LIMIT;
}

/**
 * Get current month's total token usage for an org.
 */
async function getMonthlyUsage(orgId: string): Promise<{ inputTokens: number; outputTokens: number; totalTokens: number }> {
  const result = await pool.query(
    `SELECT COALESCE(SUM(input_tokens), 0)::int AS input_tokens,
            COALESCE(SUM(output_tokens), 0)::int AS output_tokens
     FROM copilot_usage
     WHERE org_id = $1 AND created_at >= date_trunc('month', NOW())`,
    [orgId]
  );
  const row = result.rows[0];
  const inputTokens = row.input_tokens;
  const outputTokens = row.output_tokens;
  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
}

/**
 * Middleware: check monthly token budget before AI call.
 */
export function requireTokenBudget() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const orgId = (req as any).orgId;
    if (!orgId) { next(); return; } // orgId set by caller

    try {
      const [limit, usage] = await Promise.all([
        getTokenLimit(orgId),
        getMonthlyUsage(orgId),
      ]);

      if (usage.totalTokens >= limit) {
        const resetDate = new Date();
        resetDate.setMonth(resetDate.getMonth() + 1, 1);
        resetDate.setHours(0, 0, 0, 0);

        return res.status(429).json({
          error: 'token_budget_exceeded',
          message: 'Your organisation has reached its monthly AI Copilot token limit. The budget resets on the 1st of each month.',
          used: usage.totalTokens,
          limit,
          resetDate: resetDate.toISOString(),
        });
      }

      // Attach budget info for downstream use
      (req as any).tokenBudget = { used: usage.totalTokens, limit, remaining: limit - usage.totalTokens };
      next();
    } catch (err) {
      console.error('[COPILOT-LIMITS] Budget check error:', err);
      // Fail open – don't block on query failure
      next();
    }
  };
}

/**
 * Middleware: per-endpoint rate limiting.
 * Uses copilot_usage table to count recent calls per (org, product/report, type).
 *
 * @param endpointType - The copilot usage type key (e.g. 'suggest', 'vulnerability_triage')
 * @param scopeField - Request body field that identifies the scope ('productId' or 'reportId')
 */
export function requireCopilotRateLimit(endpointType: string, scopeField: string = 'productId') {
  const limit = ENDPOINT_RATE_LIMITS[endpointType];
  if (!limit) return (_req: Request, _res: Response, next: NextFunction) => next();

  return async (req: Request, res: Response, next: NextFunction) => {
    const orgId = (req as any).orgId;
    if (!orgId) { next(); return; }

    const scopeId = req.body?.[scopeField] || req.params?.[scopeField];
    if (!scopeId) { next(); return; }

    try {
      const result = await pool.query(
        `SELECT COUNT(*)::int AS call_count
         FROM copilot_usage
         WHERE org_id = $1 AND product_id = $2 AND type = $3
           AND created_at >= NOW() - ($4 || ' minutes')::interval`,
        [orgId, scopeId, endpointType, String(limit.windowMinutes)]
      );

      const count = result.rows[0]?.call_count || 0;
      if (count >= limit.maxCalls) {
        const windowLabel = limit.windowMinutes >= 1440
          ? `${Math.round(limit.windowMinutes / 1440)} day(s)`
          : `${limit.windowMinutes} minute(s)`;
        return res.status(429).json({
          error: 'rate_limit_exceeded',
          message: `Rate limit reached: maximum ${limit.maxCalls} ${endpointType.replace(/_/g, ' ')} calls per ${windowLabel} per product.`,
          currentCount: count,
          maxCalls: limit.maxCalls,
          windowMinutes: limit.windowMinutes,
        });
      }

      next();
    } catch (err) {
      console.error('[COPILOT-LIMITS] Rate limit check error:', err);
      // Fail open
      next();
    }
  };
}

/**
 * Helper: get token budget info for the /status endpoint.
 */
export async function getTokenBudgetInfo(orgId: string): Promise<{ used: number; limit: number; remaining: number }> {
  const [limit, usage] = await Promise.all([
    getTokenLimit(orgId),
    getMonthlyUsage(orgId),
  ]);
  return { used: usage.totalTokens, limit, remaining: Math.max(0, limit - usage.totalTokens) };
}

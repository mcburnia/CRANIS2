/**
 * API Key Authentication Middleware
 *
 * Validates the X-API-Key header against the api_keys table.
 * Sets req.orgId and req.apiKeyScopes on success.
 */

import { Request, Response, NextFunction } from 'express';
import { validateApiKey } from '../services/api-keys.js';

export function requireApiKey(requiredScope?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'] as string | undefined;
    if (!apiKey) {
      return res.status(401).json({ error: 'Missing X-API-Key header' });
    }

    const result = await validateApiKey(apiKey);
    if (!result) {
      return res.status(401).json({ error: 'Invalid or revoked API key' });
    }

    if (requiredScope && !result.scopes.includes(requiredScope)) {
      return res.status(403).json({ error: `Insufficient scope — requires ${requiredScope}` });
    }

    (req as any).orgId = result.orgId;
    (req as any).apiKeyId = result.keyId;
    (req as any).apiKeyScopes = result.scopes;
    next();
  };
}

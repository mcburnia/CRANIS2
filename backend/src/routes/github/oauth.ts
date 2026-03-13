import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import pool from '../../db/pool.js';
import { encrypt, decrypt } from '../../utils/encryption.js';
import { recordEvent, extractRequestData } from '../../services/telemetry.js';
import { PROVIDER_REGISTRY } from '../../services/repo-provider.js';
import * as provider from '../../services/repo-provider.js';
import type { RepoProvider } from '../../services/repo-provider.js';
import { removeWebhooksForUser } from '../../services/webhook.js';
import { requireAuth, pendingStates, connectionTokens } from './shared.js';

const router = Router();

// ── GET /providers – available providers for frontend dropdown ────
router.get('/providers', requireAuth, (_req: Request, res: Response) => {
  const providers = PROVIDER_REGISTRY.map(p => ({
    id: p.id,
    label: p.label,
    selfHosted: p.selfHosted,
    oauthSupported: p.oauthSupported,
    supportsApiSbom: p.supportsApiSbom,
  }));
  res.json(providers);
});

// ─── POST /connect-pat – PAT-based connection for self-hosted providers ───
router.post('/connect-pat', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).email;
  const { provider: prov, instanceUrl, accessToken } = req.body;

  // Validate required fields
  if (!prov || !instanceUrl || !accessToken) {
    res.status(400).json({ error: 'Missing required fields: provider, instanceUrl, accessToken' });
    return;
  }

  // Only allow PAT for self-hosted providers
  if (!['gitea', 'forgejo', 'gitlab'].includes(prov)) {
    res.status(400).json({ error: `Provider "${prov}" uses OAuth, not PAT. Use the OAuth connect flow instead.` });
    return;
  }

  // Normalise instanceUrl (strip trailing slashes)
  const normalised = instanceUrl.replace(/\/+$/, '');

  // Validate URL format
  try {
    new URL(normalised);
  } catch {
    res.status(400).json({ error: 'Invalid instanceUrl format. Must be a valid URL (e.g. https://git.example.com)' });
    return;
  }

  try {
    // Validate the PAT by calling the provider's user endpoint
    const user = await provider.validatePAT(prov as RepoProvider, accessToken, normalised);

    // Encrypt the token
    const encryptedToken = encrypt(accessToken);

    // Store connection
    await pool.query(
      `INSERT INTO repo_connections (user_id, provider, instance_url, provider_user_id, provider_username,
         provider_avatar_url, access_token_encrypted, token_scope)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pat')
       ON CONFLICT ON CONSTRAINT repo_connections_user_provider_unique DO UPDATE SET
         instance_url = $3, provider_user_id = $4, provider_username = $5,
         provider_avatar_url = $6, access_token_encrypted = $7, token_scope = 'pat', connected_at = NOW()`,
      [userId, prov, normalised, String(user.id), user.login, user.avatar_url, encryptedToken]
    );

    // Record telemetry
    const reqData = extractRequestData(req);
    await recordEvent({
      userId,
      email: userEmail,
      eventType: `${prov}_connected`,
      ipAddress: reqData.ipAddress,
      userAgent: reqData.userAgent,
      acceptLanguage: reqData.acceptLanguage,
      metadata: { username: user.login, provider: prov, instanceUrl: normalised, method: 'pat' },
    });

    res.json({
      provider: prov,
      username: user.login,
      avatarUrl: user.avatar_url,
      instanceUrl: normalised,
    });
  } catch (err: any) {
    console.error(`[PAT-CONNECT] ${prov} PAT validation failed:`, err.message);
    if (err.message?.includes('401') || err.message?.includes('403')) {
      res.status(401).json({ error: 'Invalid access token. Please check your PAT and try again.' });
    } else if (err.message?.includes('ECONNREFUSED') || err.message?.includes('ENOTFOUND')) {
      res.status(400).json({ error: `Cannot reach ${normalised}. Please check the instance URL.` });
    } else {
      res.status(400).json({ error: `Failed to validate ${prov} token: ${err.message}` });
    }
  }
});

// ─── POST /api/github/connect-init ──────────────────────────────
router.post('/connect-init', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const repoProvider = (req.body?.provider || 'github') as RepoProvider;

  if (repoProvider === 'github') {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId || clientId === 'PLACEHOLDER') {
      res.status(500).json({ error: 'GitHub OAuth not configured. Please set GITHUB_CLIENT_ID in .env' });
      return;
    }
  } else if (repoProvider === 'codeberg') {
    const clientId = process.env.CODEBERG_CLIENT_ID;
    if (!clientId) {
      res.status(500).json({ error: 'Codeberg OAuth not configured. Please set CODEBERG_CLIENT_ID in .env' });
      return;
    }
  } else {
    res.status(400).json({ error: 'Unsupported provider. Use "github" or "codeberg".' });
    return;
  }

  const connectionToken = crypto.randomUUID();
  connectionTokens.set(connectionToken, {
    userId,
    expiresAt: Date.now() + 10 * 60 * 1000,
    provider: repoProvider,
  });

  res.json({ connectionToken });
});

// ─── GET /api/github/connect ────────────────────────────────────
// Supports both /connect?connectionToken=... (legacy GitHub) and /connect/{:provider}connectionToken=...
router.get('/connect/{:provider}', async (req: Request, res: Response) => {
  const { connectionToken } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://192.168.1.107:3002';

  if (!connectionToken || typeof connectionToken !== 'string') {
    res.status(400).send(renderOAuthResultPage(frontendUrl, false, 'Missing connection token. Please try again.', 'github'));
    return;
  }

  const pending = connectionTokens.get(connectionToken);
  if (!pending || pending.expiresAt < Date.now()) {
    connectionTokens.delete(connectionToken);
    res.status(401).send(renderOAuthResultPage(frontendUrl, false, 'Connection token expired. Please close this window and try again.', 'github'));
    return;
  }
  connectionTokens.delete(connectionToken);

  // Provider from URL param overrides token's provider (for backward compat)
  const repoProvider: RepoProvider = (req.params.provider as RepoProvider) || pending.provider || 'github';

  const state = crypto.randomBytes(32).toString('hex');
  pendingStates.set(state, {
    userId: pending.userId,
    expiresAt: Date.now() + 10 * 60 * 1000,
    provider: repoProvider,
  });

  if (repoProvider === 'codeberg') {
    const clientId = process.env.CODEBERG_CLIENT_ID;
    if (!clientId) {
      res.status(500).send(renderOAuthResultPage(frontendUrl, false, 'Codeberg OAuth not configured.', 'codeberg'));
      return;
    }
    const redirectUri = `${frontendUrl}/api/repo/callback/codeberg`;
    const codebergAuthUrl = `https://codeberg.org/login/oauth/authorize?client_id=${clientId}&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    res.redirect(codebergAuthUrl);
  } else {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      res.status(500).send(renderOAuthResultPage(frontendUrl, false, 'GitHub OAuth not configured.', 'github'));
      return;
    }
    const redirectUri = `${frontendUrl}/api/github/callback`;
    const scope = 'read:user,repo';
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=${scope}&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    res.redirect(githubAuthUrl);
  }
});

// ─── GET /api/github/callback/{:provider} ────────────────────────
router.get('/callback/{:provider}', async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://192.168.1.107:3002';

  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    res.send(renderOAuthResultPage(frontendUrl, false, 'Invalid callback parameters.', 'github'));
    return;
  }

  const pending = pendingStates.get(state);
  if (!pending || pending.expiresAt < Date.now()) {
    pendingStates.delete(state);
    res.send(renderOAuthResultPage(frontendUrl, false, 'Session expired. Please close this window and try again.', 'github'));
    return;
  }
  pendingStates.delete(state);

  const repoProvider: RepoProvider = (req.params.provider as RepoProvider) || pending.provider || 'github';

  try {
    const redirectUri = repoProvider === 'codeberg'
      ? `${frontendUrl}/api/repo/callback/codeberg`
      : `${frontendUrl}/api/github/callback`;
    const tokenData = await provider.exchangeCodeForToken(repoProvider, code, redirectUri);
    const providerUser = await provider.getAuthenticatedUser(repoProvider, tokenData.access_token);
    const encryptedToken = encrypt(tokenData.access_token);

    await pool.query(
      `INSERT INTO repo_connections (user_id, provider, provider_user_id, provider_username, provider_avatar_url,
         github_user_id, github_username, github_avatar_url, access_token_encrypted, token_scope)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT ON CONSTRAINT repo_connections_user_provider_unique DO UPDATE SET
         provider_user_id = $3, provider_username = $4, provider_avatar_url = $5,
         github_user_id = $6, github_username = $7, github_avatar_url = $8,
         access_token_encrypted = $9, token_scope = $10, connected_at = NOW()`,
      [
        pending.userId, repoProvider,
        String(providerUser.id), providerUser.login, providerUser.avatar_url,
        repoProvider === 'github' ? providerUser.id : null,
        repoProvider === 'github' ? providerUser.login : null,
        repoProvider === 'github' ? providerUser.avatar_url : null,
        encryptedToken, tokenData.scope || '',
      ]
    );

    await recordEvent({
      userId: pending.userId,
      email: '',
      eventType: `${repoProvider}_connected`,
      metadata: { username: providerUser.login, provider: repoProvider, scope: tokenData.scope },
    });

    res.send(renderOAuthResultPage(frontendUrl, true, `Connected as ${providerUser.login}`, repoProvider));
  } catch (err) {
    console.error(`${repoProvider} OAuth callback error:`, err);
    res.send(renderOAuthResultPage(frontendUrl, false, `Failed to connect to ${repoProvider === 'codeberg' ? 'Codeberg' : 'GitHub'}. Please try again.`, repoProvider));
  }
});

function renderOAuthResultPage(frontendUrl: string, success: boolean, message: string, repoProvider: string = 'github'): string {
  const escapedMessage = message.replace(/'/g, "\\'").replace(/"/g, '&quot;');
  const providerLabel = repoProvider === 'codeberg' ? 'Codeberg' : 'GitHub';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CRANIS2 ${success ? `– ${providerLabel} Connected` : '– Connection Failed'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f1117; color: #e4e4e7;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 2rem;
    }
    .card {
      background: #1a1d27; border: 1px solid #2a2d3a; border-radius: 12px;
      padding: 2.5rem; text-align: center; max-width: 400px; width: 100%;
    }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    .success .icon { color: #22c55e; }
    .error .icon { color: #ef4444; }
    h2 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { color: #8b8d98; font-size: 0.875rem; margin-bottom: 1.5rem; }
    .close-btn {
      background: #3b82f6; color: white; border: none; border-radius: 8px;
      padding: 0.625rem 1.5rem; font-size: 0.875rem; cursor: pointer;
    }
    .close-btn:hover { background: #2563eb; }
    .auto-close { color: #8b8d98; font-size: 0.75rem; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="card ${success ? 'success' : 'error'}">
    <div class="icon">${success ? '&#10003;' : '&#10007;'}</div>
    <h2>${success ? `${providerLabel} Connected` : 'Connection Failed'}</h2>
    <p>${escapedMessage}</p>
    ${success
      ? '<p class="auto-close">This window will close automatically...</p>'
      : '<button class="close-btn" onclick="window.close()">Close Window</button>'
    }
  </div>
  <script>
    (function() {
      var success = ${success ? 'true' : 'false'};
      if (window.opener) {
        if (success) {
          window.opener.postMessage({ type: 'repo-oauth-success', provider: '${repoProvider}' }, '${frontendUrl}');
          setTimeout(function() { window.close(); }, 1500);
        } else {
          window.opener.postMessage({ type: 'repo-oauth-error', provider: '${repoProvider}', message: '${escapedMessage}' }, '${frontendUrl}');
        }
      }
    })();
  </script>
</body>
</html>`;
}

// ─── GET /api/github/status ─────────────────────────────────────
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  const result = await pool.query(
    'SELECT provider, provider_username, provider_avatar_url, token_scope, connected_at, instance_url FROM repo_connections WHERE user_id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    res.json({ connected: false, connections: [] });
    return;
  }

  // Build per-provider status
  const connections = result.rows.map((conn: any) => ({
    provider: conn.provider,
    username: conn.provider_username,
    avatarUrl: conn.provider_avatar_url,
    scope: conn.token_scope,
    connectedAt: conn.connected_at,
    instanceUrl: conn.instance_url || null,
  }));

  // Backward compat: surface the GitHub connection at top level
  const ghConn = result.rows.find((r: any) => r.provider === 'github');
  res.json({
    connected: !!ghConn,
    githubUsername: ghConn?.provider_username || ghConn?.github_username || undefined,
    githubAvatarUrl: ghConn?.provider_avatar_url || ghConn?.github_avatar_url || undefined,
    scope: ghConn?.token_scope || undefined,
    connectedAt: ghConn?.connected_at || undefined,
    connections,
  });
});

// ─── DELETE /api/github/disconnect/{:provider} ───────────────────
router.delete('/disconnect/{:provider}', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).email;
  const disconnectProvider = (req.params.provider || 'github') as RepoProvider;

  // Retrieve token before deleting connection – needed for webhook cleanup (non-blocking)
  try {
    const connRow = await pool.query(
      'SELECT access_token_encrypted, instance_url FROM repo_connections WHERE user_id = $1 AND provider = $2',
      [userId, disconnectProvider]
    );
    if (connRow.rows.length > 0 && connRow.rows[0].access_token_encrypted) {
      const decryptedToken = decrypt(connRow.rows[0].access_token_encrypted);
      await removeWebhooksForUser(disconnectProvider, decryptedToken, userId, connRow.rows[0].instance_url || undefined);
    }
  } catch (err: any) {
    console.error(`[DISCONNECT] Webhook cleanup failed (non-blocking): ${err.message}`);
  }

  const result = await pool.query(
    'DELETE FROM repo_connections WHERE user_id = $1 AND provider = $2 RETURNING provider_username',
    [userId, disconnectProvider]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: `No ${disconnectProvider} connection found` });
    return;
  }

  const reqData = extractRequestData(req);
  await recordEvent({
    userId,
    email: userEmail,
    eventType: `${disconnectProvider}_disconnected`,
    ipAddress: reqData.ipAddress,
    userAgent: reqData.userAgent,
    acceptLanguage: reqData.acceptLanguage,
    metadata: { username: result.rows[0].provider_username, provider: disconnectProvider },
  });

  const providerLabels = { github: 'GitHub', codeberg: 'Codeberg', gitea: 'Gitea', forgejo: 'Forgejo', gitlab: 'GitLab' };
    res.json({ message: `${providerLabels[disconnectProvider] || disconnectProvider} disconnected` });
});

export default router;

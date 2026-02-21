import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';
import {
  exchangeCodeForToken,
  getAuthenticatedUser,
  getRepo,
  getContributors,
  getLanguages,
  parseRepoUrl,
} from '../services/github.js';

const router = Router();

// In-memory stores with automatic cleanup
// OAuth state tokens for CSRF protection
const pendingStates = new Map<string, { userId: string; expiresAt: number }>();
// Connection tokens — short-lived, single-use tokens for initiating OAuth
const connectionTokens = new Map<string, { userId: string; expiresAt: number }>();

// Clean up expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pendingStates) {
    if (val.expiresAt < now) pendingStates.delete(key);
  }
  for (const [key, val] of connectionTokens) {
    if (val.expiresAt < now) connectionTokens.delete(key);
  }
}, 5 * 60 * 1000);

// Auth middleware
async function requireAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) { res.status(401).json({ error: 'No token provided' }); return; }
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

// Helper: get user's org_id
async function getUserOrgId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.org_id || null;
}

// Helper: get user's decrypted GitHub token
async function getUserGitHubToken(userId: string): Promise<string | null> {
  const result = await pool.query(
    'SELECT access_token_encrypted FROM github_connections WHERE user_id = $1',
    [userId]
  );
  if (result.rows.length === 0) return null;
  try {
    return decrypt(result.rows[0].access_token_encrypted);
  } catch {
    return null;
  }
}

// ─── POST /api/github/connect-init ──────────────────────────────
// Creates a short-lived, single-use connection token for the OAuth popup.
// The frontend calls this with Bearer auth, then opens a popup with the returned token.
router.post('/connect-init', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId || clientId === 'PLACEHOLDER') {
    res.status(500).json({ error: 'GitHub OAuth not configured. Please set GITHUB_CLIENT_ID in .env' });
    return;
  }

  // Generate a single-use connection token (UUID)
  const connectionToken = crypto.randomUUID();
  connectionTokens.set(connectionToken, {
    userId,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 min expiry
  });

  res.json({ connectionToken });
});

// ─── GET /api/github/connect ────────────────────────────────────
// Initiates GitHub OAuth flow. Called from the popup window with a connectionToken.
router.get('/connect', async (req: Request, res: Response) => {
  const { connectionToken } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://192.168.1.107:3002';

  if (!connectionToken || typeof connectionToken !== 'string') {
    res.status(400).send(renderOAuthResultPage(frontendUrl, false, 'Missing connection token. Please try again.'));
    return;
  }

  // Validate and consume the connection token (single-use)
  const pending = connectionTokens.get(connectionToken);
  if (!pending || pending.expiresAt < Date.now()) {
    connectionTokens.delete(connectionToken);
    res.status(401).send(renderOAuthResultPage(frontendUrl, false, 'Connection token expired. Please close this window and try again.'));
    return;
  }
  connectionTokens.delete(connectionToken); // Single-use — delete immediately

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    res.status(500).send(renderOAuthResultPage(frontendUrl, false, 'GitHub OAuth not configured.'));
    return;
  }

  // Generate state token for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');
  pendingStates.set(state, {
    userId: pending.userId,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 min expiry
  });

  const redirectUri = `${frontendUrl}/api/github/callback`;
  const scope = 'read:user,repo';

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=${scope}&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  res.redirect(githubAuthUrl);
});

// ─── GET /api/github/callback ───────────────────────────────────
// GitHub redirects here after user authorises. Runs inside the popup window.
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://192.168.1.107:3002';

  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    res.send(renderOAuthResultPage(frontendUrl, false, 'Invalid callback parameters.'));
    return;
  }

  // Validate state
  const pending = pendingStates.get(state);
  if (!pending || pending.expiresAt < Date.now()) {
    pendingStates.delete(state);
    res.send(renderOAuthResultPage(frontendUrl, false, 'Session expired. Please close this window and try again.'));
    return;
  }
  pendingStates.delete(state);

  try {
    // Exchange code for access token
    const tokenData = await exchangeCodeForToken(code);

    // Fetch GitHub user profile
    const ghUser = await getAuthenticatedUser(tokenData.access_token);

    // Encrypt and store token
    const encryptedToken = encrypt(tokenData.access_token);

    // Upsert github_connection
    await pool.query(
      `INSERT INTO github_connections (user_id, github_user_id, github_username, github_avatar_url, access_token_encrypted, token_scope)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET
         github_user_id = $2, github_username = $3, github_avatar_url = $4,
         access_token_encrypted = $5, token_scope = $6, connected_at = NOW()`,
      [
        pending.userId,
        ghUser.id,
        ghUser.login,
        ghUser.avatar_url,
        encryptedToken,
        tokenData.scope,
      ]
    );

    // Record telemetry
    await recordEvent({
      userId: pending.userId,
      email: '',
      eventType: 'github_connected',
      metadata: { githubUsername: ghUser.login, scope: tokenData.scope },
    });

    // Send success — the popup will postMessage to the parent window and close itself
    res.send(renderOAuthResultPage(frontendUrl, true, `Connected as ${ghUser.login}`));
  } catch (err) {
    console.error('GitHub OAuth callback error:', err);
    res.send(renderOAuthResultPage(frontendUrl, false, 'Failed to connect to GitHub. Please try again.'));
  }
});

/**
 * Renders a small HTML page for the OAuth popup window.
 * On success: sends postMessage to parent window and auto-closes.
 * On error: shows error message with a close button.
 */
function renderOAuthResultPage(frontendUrl: string, success: boolean, message: string): string {
  const escapedMessage = message.replace(/'/g, "\\'").replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CRANIS2 ${success ? '— GitHub Connected' : '— Connection Failed'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f1117;
      color: #e4e4e7;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 2rem;
    }
    .card {
      background: #1a1d27;
      border: 1px solid #2a2d3a;
      border-radius: 12px;
      padding: 2.5rem;
      text-align: center;
      max-width: 400px;
      width: 100%;
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
    <h2>${success ? 'GitHub Connected' : 'Connection Failed'}</h2>
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
          window.opener.postMessage({ type: 'github-oauth-success' }, '${frontendUrl}');
          setTimeout(function() { window.close(); }, 1500);
        } else {
          window.opener.postMessage({ type: 'github-oauth-error', message: '${escapedMessage}' }, '${frontendUrl}');
        }
      }
    })();
  </script>
</body>
</html>`;
}

// ─── GET /api/github/status ─────────────────────────────────────
// Check if current user has a GitHub connection
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  const result = await pool.query(
    'SELECT github_username, github_avatar_url, token_scope, connected_at FROM github_connections WHERE user_id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    res.json({ connected: false });
    return;
  }

  const conn = result.rows[0];
  res.json({
    connected: true,
    githubUsername: conn.github_username,
    githubAvatarUrl: conn.github_avatar_url,
    scope: conn.token_scope,
    connectedAt: conn.connected_at,
  });
});

// ─── POST /api/github/sync/:productId ──────────────────────────
// Sync repo data from GitHub (READ-ONLY API calls)
router.post('/sync/:productId', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).email;
  const orgId = await getUserOrgId(userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const { productId } = req.params;

  // Get the product's repo URL from Neo4j
  const neo4jSession = getDriver().session();
  try {
    const productResult = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p.repoUrl AS repoUrl, p.name AS productName`,
      { orgId, productId }
    );

    if (productResult.records.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const repoUrl = productResult.records[0].get('repoUrl');
    const productName = productResult.records[0].get('productName');

    if (!repoUrl) {
      res.status(400).json({ error: 'Product has no repository URL configured' });
      return;
    }

    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) {
      res.status(400).json({ error: 'Invalid GitHub repository URL' });
      return;
    }

    const ghToken = await getUserGitHubToken(userId);
    if (!ghToken) {
      res.status(400).json({ error: 'GitHub not connected. Please connect your GitHub account first.' });
      return;
    }

    // Fetch data from GitHub (ALL READ-ONLY GET requests)
    const [repoData, contributors, languages] = await Promise.all([
      getRepo(ghToken, parsed.owner, parsed.repo),
      getContributors(ghToken, parsed.owner, parsed.repo),
      getLanguages(ghToken, parsed.owner, parsed.repo),
    ]);

    // Store in Neo4j — GitHubRepo node
    await neo4jSession.run(
      `MERGE (r:GitHubRepo {url: $url})
       ON CREATE SET r.createdAt = datetime()
       SET r.owner = $owner,
           r.name = $name,
           r.fullName = $fullName,
           r.description = $description,
           r.language = $language,
           r.stars = $stars,
           r.forks = $forks,
           r.openIssues = $openIssues,
           r.visibility = $visibility,
           r.defaultBranch = $defaultBranch,
           r.lastPush = $lastPush,
           r.isPrivate = $isPrivate,
           r.languages = $languagesJson,
           r.syncedAt = datetime()

       WITH r
       MATCH (p:Product {id: $productId})
       MERGE (p)-[:HAS_REPO]->(r)

       WITH r
       MATCH (u:User {id: $userId})
       MERGE (u)-[:GITHUB_CONNECTED]->(r)`,
      {
        url: repoData.html_url,
        owner: parsed.owner,
        name: parsed.repo,
        fullName: repoData.full_name,
        description: repoData.description || '',
        language: repoData.language || '',
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        openIssues: repoData.open_issues_count,
        visibility: repoData.visibility,
        defaultBranch: repoData.default_branch,
        lastPush: repoData.pushed_at,
        isPrivate: repoData.private,
        languagesJson: JSON.stringify(languages),
        productId,
        userId,
      }
    );

    // Contributor nodes
    for (const contrib of contributors) {
      await neo4jSession.run(
        `MATCH (r:GitHubRepo {url: $repoUrl})
         MERGE (c:Contributor {githubId: $githubId})
         ON CREATE SET c.createdAt = datetime()
         SET c.githubLogin = $login,
             c.avatarUrl = $avatarUrl,
             c.profileUrl = $profileUrl,
             c.contributions = $contributions
         MERGE (r)-[rel:HAS_CONTRIBUTOR]->(c)
         SET rel.contributions = $contributions, rel.syncedAt = datetime()`,
        {
          repoUrl: repoData.html_url,
          githubId: contrib.id,
          login: contrib.login,
          avatarUrl: contrib.avatar_url,
          profileUrl: contrib.html_url,
          contributions: contrib.contributions,
        }
      );
    }

    // Record telemetry
    const reqData = extractRequestData(req);
    await recordEvent({
      userId,
      email: userEmail,
      eventType: 'github_repo_synced',
      ipAddress: reqData.ipAddress,
      userAgent: reqData.userAgent,
      acceptLanguage: reqData.acceptLanguage,
      metadata: {
        productId,
        productName,
        repoFullName: repoData.full_name,
        contributors: contributors.length,
        languages: Object.keys(languages).length,
      },
    });

    const totalBytes = Object.values(languages).reduce((sum, b) => sum + b, 0);
    const languageBreakdown = Object.entries(languages)
      .map(([lang, bytes]) => ({ language: lang, bytes, percentage: totalBytes > 0 ? Math.round((bytes / totalBytes) * 1000) / 10 : 0 }))
      .sort((a, b) => b.bytes - a.bytes);

    res.json({
      repo: {
        name: repoData.name,
        fullName: repoData.full_name,
        description: repoData.description,
        url: repoData.html_url,
        language: repoData.language,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        openIssues: repoData.open_issues_count,
        visibility: repoData.visibility,
        defaultBranch: repoData.default_branch,
        lastPush: repoData.pushed_at,
        isPrivate: repoData.private,
      },
      contributors: contributors.map(c => ({
        login: c.login,
        githubId: c.id,
        avatarUrl: c.avatar_url,
        profileUrl: c.html_url,
        contributions: c.contributions,
      })),
      languages: languageBreakdown,
    });
  } catch (err: any) {
    console.error('GitHub sync error:', err);
    if (err.message?.includes('404')) {
      res.status(404).json({ error: 'Repository not found on GitHub. Check the URL and ensure your GitHub account has access.' });
    } else if (err.message?.includes('401') || err.message?.includes('403')) {
      res.status(403).json({ error: 'GitHub access denied. Your token may have expired — try reconnecting.' });
    } else {
      res.status(500).json({ error: 'Failed to sync repository from GitHub' });
    }
  } finally {
    await neo4jSession.close();
  }
});

// ─── DELETE /api/github/disconnect ──────────────────────────────
router.delete('/disconnect', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).email;

  const result = await pool.query(
    'DELETE FROM github_connections WHERE user_id = $1 RETURNING github_username',
    [userId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'No GitHub connection found' });
    return;
  }

  const reqData = extractRequestData(req);
  await recordEvent({
    userId,
    email: userEmail,
    eventType: 'github_disconnected',
    ipAddress: reqData.ipAddress,
    userAgent: reqData.userAgent,
    acceptLanguage: reqData.acceptLanguage,
    metadata: { githubUsername: result.rows[0].github_username },
  });

  res.json({ message: 'GitHub disconnected' });
});

// ─── GET /api/github/repo/:productId ────────────────────────────
router.get('/repo/:productId', requireAuth, async (req: Request, res: Response) => {
  const orgId = await getUserOrgId((req as any).userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const { productId } = req.params;
  const session = getDriver().session();

  try {
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})-[:HAS_REPO]->(r:GitHubRepo)
       OPTIONAL MATCH (r)-[hc:HAS_CONTRIBUTOR]->(c:Contributor)
       RETURN r, collect({
         login: c.githubLogin,
         githubId: c.githubId,
         avatarUrl: c.avatarUrl,
         profileUrl: c.profileUrl,
         contributions: hc.contributions
       }) AS contributors`,
      { orgId, productId }
    );

    if (result.records.length === 0) {
      res.json({ synced: false });
      return;
    }

    const r = result.records[0].get('r').properties;
    const contributors = result.records[0].get('contributors')
      .filter((c: any) => c.login !== null)
      .sort((a: any, b: any) => (b.contributions || 0) - (a.contributions || 0));

    let languages: { language: string; bytes: number; percentage: number }[] = [];
    try {
      const langObj = JSON.parse(r.languages || '{}');
      const totalBytes = Object.values(langObj).reduce((sum: number, b: any) => sum + (b as number), 0);
      languages = Object.entries(langObj)
        .map(([lang, bytes]) => ({
          language: lang,
          bytes: bytes as number,
          percentage: totalBytes > 0 ? Math.round(((bytes as number) / totalBytes) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.bytes - a.bytes);
    } catch { /* silent */ }

    res.json({
      synced: true,
      repo: {
        name: r.name,
        fullName: r.fullName,
        description: r.description || '',
        url: r.url,
        language: r.language || '',
        stars: typeof r.stars === 'object' ? r.stars.toNumber?.() ?? r.stars : r.stars,
        forks: typeof r.forks === 'object' ? r.forks.toNumber?.() ?? r.forks : r.forks,
        openIssues: typeof r.openIssues === 'object' ? r.openIssues.toNumber?.() ?? r.openIssues : r.openIssues,
        visibility: r.visibility,
        defaultBranch: r.defaultBranch,
        lastPush: r.lastPush,
        isPrivate: r.isPrivate,
        syncedAt: r.syncedAt?.toString() || '',
      },
      contributors: contributors.map((c: any) => ({
        ...c,
        contributions: typeof c.contributions === 'object' ? c.contributions.toNumber?.() ?? c.contributions : c.contributions,
      })),
      languages,
    });
  } finally {
    await session.close();
  }
});

export default router;

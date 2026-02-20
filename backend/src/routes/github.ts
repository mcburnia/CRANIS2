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

// In-memory state store for OAuth CSRF protection (simple for MVP)
// In production, use Redis or DB-backed sessions
const pendingStates = new Map<string, { userId: string; returnTo: string; expiresAt: number }>();

// Clean up expired states every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pendingStates) {
    if (val.expiresAt < now) pendingStates.delete(key);
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

// ─── GET /api/github/connect ────────────────────────────────────
// Initiates GitHub OAuth flow. Called from frontend with session token as query param.
router.get('/connect', async (req: Request, res: Response) => {
  const { token, returnTo } = req.query;

  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'Session token required' });
    return;
  }

  // Verify the session token
  let userId: string;
  try {
    const payload = verifySessionToken(token);
    userId = payload.userId;
  } catch {
    res.status(401).json({ error: 'Invalid session' });
    return;
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    res.status(500).json({ error: 'GitHub OAuth not configured' });
    return;
  }

  // Generate state token for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');
  pendingStates.set(state, {
    userId,
    returnTo: (typeof returnTo === 'string' ? returnTo : '/products'),
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 min expiry
  });

  const redirectUri = `${process.env.FRONTEND_URL}/api/github/callback`;
  const scope = 'read:user,repo';

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=${scope}&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  res.redirect(githubAuthUrl);
});

// ─── GET /api/github/callback ───────────────────────────────────
// GitHub redirects here after user authorises
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://192.168.1.107:3002';

  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    res.redirect(`${frontendUrl}/products?github_error=invalid_callback`);
    return;
  }

  // Validate state
  const pending = pendingStates.get(state);
  if (!pending || pending.expiresAt < Date.now()) {
    pendingStates.delete(state);
    res.redirect(`${frontendUrl}/products?github_error=invalid_state`);
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
      email: '', // We don't have email in the state; telemetry will use userId
      eventType: 'github_connected',
      metadata: { githubUsername: ghUser.login, scope: tokenData.scope },
    });

    res.redirect(`${frontendUrl}${pending.returnTo}?github_connected=true`);
  } catch (err) {
    console.error('GitHub OAuth callback error:', err);
    res.redirect(`${frontendUrl}/products?github_error=token_exchange_failed`);
  }
});

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

    // Parse the repo URL
    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) {
      res.status(400).json({ error: 'Invalid GitHub repository URL' });
      return;
    }

    // Get the user's GitHub token
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

    // Store in Neo4j
    // 1. Create/update GitHubRepo node
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

    // 2. Create/update Contributor nodes
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

    // Return the synced data
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
// Remove GitHub connection
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
// Get cached repo data from Neo4j (no GitHub API call)
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

    // Parse languages from stored JSON
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

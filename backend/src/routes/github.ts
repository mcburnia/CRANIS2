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
  getSBOM,
  getReleases,
  getTags,
  parseRepoUrl,
} from '../services/github.js';
import type { GitHubSBOMResponse, SpdxPackage, GitHubRelease, GitHubTag } from '../services/github.js';

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

/**
 * Parse a purl (Package URL) or construct one from SPDX package data.
 * SPDX packages from GitHub have externalRefs with purl references.
 */
function extractPackageInfo(pkg: SpdxPackage): {
  purl: string;
  name: string;
  version: string;
  ecosystem: string;
  license: string;
  supplier: string;
} {
  // Try to get purl from externalRefs
  let purl = '';
  if (pkg.externalRefs) {
    const purlRef = pkg.externalRefs.find(r => r.referenceType === 'purl');
    if (purlRef) purl = purlRef.referenceLocator;
  }

  // Parse ecosystem from purl (e.g. pkg:npm/lodash@4.17.21 -> npm)
  let ecosystem = 'unknown';
  let name = pkg.name || '';
  let version = pkg.versionInfo || '';

  if (purl) {
    const purlMatch = purl.match(/^pkg:([^/]+)\//);
    if (purlMatch) ecosystem = purlMatch[1];
  }

  // Clean up name — SPDX names can include ecosystem prefix
  if (name.includes(':')) {
    const parts = name.split(':');
    name = parts[parts.length - 1];
  }

  return {
    purl: purl || `pkg:${ecosystem}/${name}@${version}`,
    name,
    version,
    ecosystem,
    license: pkg.licenseDeclared || pkg.licenseConcluded || 'NOASSERTION',
    supplier: pkg.supplier || '',
  };
}

/**
 * Store SBOM data in Postgres + Neo4j
 */
async function storeSBOM(
  productId: string,
  sbomResponse: GitHubSBOMResponse,
  neo4jSession: any
): Promise<{ packageCount: number; packages: ReturnType<typeof extractPackageInfo>[] }> {
  const sbom = sbomResponse.sbom;
  // Filter out the root package (the repo itself)
  const depPackages = sbom.packages.filter(p => p.SPDXID !== 'SPDXRef-DOCUMENT' && !p.name?.startsWith('com.github.'));
  const packages = depPackages.map(extractPackageInfo);

  // Store full SPDX JSON in Postgres
  await pool.query(
    `INSERT INTO product_sboms (product_id, spdx_json, spdx_version, package_count, is_stale, synced_at)
     VALUES ($1, $2, $3, $4, FALSE, NOW())
     ON CONFLICT (product_id) DO UPDATE SET
       spdx_json = $2, spdx_version = $3, package_count = $4,
       is_stale = FALSE, synced_at = NOW()`,
    [productId, JSON.stringify(sbomResponse), sbom.spdxVersion, packages.length]
  );

  // Create SBOM node in Neo4j
  const sbomId = crypto.randomUUID();
  await neo4jSession.run(
    `MATCH (p:Product {id: $productId})
     MERGE (p)-[:HAS_SBOM]->(sbom:SBOM {productId: $productId})
     ON CREATE SET sbom.id = $sbomId, sbom.createdAt = datetime()
     SET sbom.spdxVersion = $spdxVersion,
         sbom.packageCount = $packageCount,
         sbom.isStale = false,
         sbom.syncedAt = datetime()`,
    { productId, sbomId, spdxVersion: sbom.spdxVersion, packageCount: packages.length }
  );

  // Create Dependency nodes and relationships
  for (const pkg of packages) {
    await neo4jSession.run(
      `MERGE (d:Dependency {purl: $purl})
       ON CREATE SET d.id = $depId, d.createdAt = datetime()
       SET d.name = $name,
           d.version = $version,
           d.ecosystem = $ecosystem,
           d.license = $license,
           d.supplier = $supplier

       WITH d
       MATCH (p:Product {id: $productId})
       MERGE (p)-[:DEPENDS_ON]->(d)

       WITH d
       MATCH (p:Product {id: $productId})-[:HAS_SBOM]->(sbom:SBOM)
       MERGE (sbom)-[:INCLUDES]->(d)`,
      {
        purl: pkg.purl,
        depId: crypto.randomUUID(),
        name: pkg.name,
        version: pkg.version,
        ecosystem: pkg.ecosystem,
        license: pkg.license,
        supplier: pkg.supplier,
        productId,
      }
    );
  }

  return { packageCount: packages.length, packages };
}

// ─── POST /api/github/connect-init ──────────────────────────────
router.post('/connect-init', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId || clientId === 'PLACEHOLDER') {
    res.status(500).json({ error: 'GitHub OAuth not configured. Please set GITHUB_CLIENT_ID in .env' });
    return;
  }

  const connectionToken = crypto.randomUUID();
  connectionTokens.set(connectionToken, {
    userId,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  res.json({ connectionToken });
});

// ─── GET /api/github/connect ────────────────────────────────────
router.get('/connect', async (req: Request, res: Response) => {
  const { connectionToken } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://192.168.1.107:3002';

  if (!connectionToken || typeof connectionToken !== 'string') {
    res.status(400).send(renderOAuthResultPage(frontendUrl, false, 'Missing connection token. Please try again.'));
    return;
  }

  const pending = connectionTokens.get(connectionToken);
  if (!pending || pending.expiresAt < Date.now()) {
    connectionTokens.delete(connectionToken);
    res.status(401).send(renderOAuthResultPage(frontendUrl, false, 'Connection token expired. Please close this window and try again.'));
    return;
  }
  connectionTokens.delete(connectionToken);

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    res.status(500).send(renderOAuthResultPage(frontendUrl, false, 'GitHub OAuth not configured.'));
    return;
  }

  const state = crypto.randomBytes(32).toString('hex');
  pendingStates.set(state, {
    userId: pending.userId,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  const redirectUri = `${frontendUrl}/api/github/callback`;
  const scope = 'read:user,repo';

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=${scope}&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  res.redirect(githubAuthUrl);
});

// ─── GET /api/github/callback ───────────────────────────────────
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://192.168.1.107:3002';

  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    res.send(renderOAuthResultPage(frontendUrl, false, 'Invalid callback parameters.'));
    return;
  }

  const pending = pendingStates.get(state);
  if (!pending || pending.expiresAt < Date.now()) {
    pendingStates.delete(state);
    res.send(renderOAuthResultPage(frontendUrl, false, 'Session expired. Please close this window and try again.'));
    return;
  }
  pendingStates.delete(state);

  try {
    const tokenData = await exchangeCodeForToken(code);
    const ghUser = await getAuthenticatedUser(tokenData.access_token);
    const encryptedToken = encrypt(tokenData.access_token);

    await pool.query(
      `INSERT INTO github_connections (user_id, github_user_id, github_username, github_avatar_url, access_token_encrypted, token_scope)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET
         github_user_id = $2, github_username = $3, github_avatar_url = $4,
         access_token_encrypted = $5, token_scope = $6, connected_at = NOW()`,
      [pending.userId, ghUser.id, ghUser.login, ghUser.avatar_url, encryptedToken, tokenData.scope]
    );

    await recordEvent({
      userId: pending.userId,
      email: '',
      eventType: 'github_connected',
      metadata: { githubUsername: ghUser.login, scope: tokenData.scope },
    });

    res.send(renderOAuthResultPage(frontendUrl, true, `Connected as ${ghUser.login}`));
  } catch (err) {
    console.error('GitHub OAuth callback error:', err);
    res.send(renderOAuthResultPage(frontendUrl, false, 'Failed to connect to GitHub. Please try again.'));
  }
});

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
// Sync repo data + SBOM from GitHub (READ-ONLY API calls)
router.post('/sync/:productId', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).email;
  const orgId = await getUserOrgId(userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const productId = req.params.productId as string;
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

    // Fetch ALL data from GitHub in parallel (ALL READ-ONLY GET requests)
    console.log("[SYNC] Fetching SBOM for", parsed.owner, parsed.repo);
    const [repoData, contributors, languages, sbomData, releases, tags] = await Promise.all([
      getRepo(ghToken, parsed.owner, parsed.repo),
      getContributors(ghToken, parsed.owner, parsed.repo),
      getLanguages(ghToken, parsed.owner, parsed.repo),
      getSBOM(ghToken, parsed.owner, parsed.repo),
      getReleases(ghToken, parsed.owner, parsed.repo),
      getTags(ghToken, parsed.owner, parsed.repo),
    ]);

    // Store repo data in Neo4j
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

    // Store contributors in Neo4j
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

    // Store SBOM in Postgres + Neo4j (if available)
    let sbomResult: { packageCount: number; packages: any[] } | null = null;
    console.log("[SYNC] SBOM result:", sbomData ? `Found ${sbomData.sbom?.packages?.length || 0} packages` : "null - no SBOM available");
    if (sbomData) {
      sbomResult = await storeSBOM(productId, sbomData, neo4jSession);
    }

    // ── Store GitHub releases in product_versions ──
    const publishedReleases = releases.filter((r: GitHubRelease) => !r.draft);
    for (const rel of publishedReleases) {
      await pool.query(
        `INSERT INTO product_versions (product_id, cranis_version, github_tag, github_release_name, github_release_body, github_commit_sha, is_prerelease, source, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'github_release', $8)
         ON CONFLICT DO NOTHING`,
        [
          productId,
          rel.tag_name,
          rel.tag_name,
          rel.name || rel.tag_name,
          rel.body || '',
          rel.target_commitish,
          rel.prerelease,
          rel.published_at,
        ]
      );
    }

    // ── Generate CRANIS2 auto-version (YYYY.MM.DD.NNNN) ──
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
    const counterResult = await pool.query(
      `SELECT cranis_version FROM product_versions
       WHERE product_id = $1 AND source = 'sync' AND cranis_version LIKE $2
       ORDER BY cranis_version DESC LIMIT 1`,
      [productId, today + '.%']
    );
    let counter = 1;
    if (counterResult.rows.length > 0) {
      const lastVersion = counterResult.rows[0].cranis_version;
      const lastCounter = parseInt(lastVersion.split('.').pop() || '0', 10);
      counter = lastCounter + 1;
    }
    const cranisVersion = `${today}.${String(counter).padStart(4, '0')}`;

    // Find latest tag's commit SHA if available
    const latestTagSha = tags.length > 0 ? tags[0].commit.sha : null;
    const latestRelease = publishedReleases.length > 0 ? publishedReleases[0] : null;

    await pool.query(
      `INSERT INTO product_versions (product_id, cranis_version, github_tag, github_release_name, github_commit_sha, source)
       VALUES ($1, $2, $3, $4, $5, 'sync')`,
      [
        productId,
        cranisVersion,
        latestRelease?.tag_name || null,
        latestRelease?.name || null,
        latestTagSha,
      ]
    );

    // Update Product node version in Neo4j
    await neo4jSession.run(
      `MATCH (p:Product {id: $productId}) SET p.version = $version`,
      { productId, version: cranisVersion }
    );
    console.log(`[SYNC] CRANIS2 version: ${cranisVersion}, GitHub releases: ${publishedReleases.length}, tags: ${tags.length}`);

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
        sbomPackages: sbomResult?.packageCount || 0,
      },
    });

    // Build response
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
      sbom: sbomResult ? {
        packageCount: sbomResult.packageCount,
        syncedAt: new Date().toISOString(),
        isStale: false,
      } : null,
      version: cranisVersion,
      releases: publishedReleases.map((r: GitHubRelease) => ({
        tagName: r.tag_name,
        name: r.name,
        publishedAt: r.published_at,
        prerelease: r.prerelease,
        url: r.html_url,
      })),
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

// ─── GET /api/github/sbom/:productId ────────────────────────────
// Get cached SBOM data (from Postgres, no GitHub API call)
router.get('/sbom/:productId', requireAuth, async (req: Request, res: Response) => {
  const orgId = await getUserOrgId((req as any).userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const productId = req.params.productId as string;

  // Verify product belongs to user's org
  const neo4jSession = getDriver().session();
  try {
    const productResult = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId}) RETURN p.id`,
      { orgId, productId }
    );
    if (productResult.records.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
  } finally {
    await neo4jSession.close();
  }

  // Get SBOM from Postgres
  const result = await pool.query(
    'SELECT spdx_json, spdx_version, package_count, is_stale, synced_at FROM product_sboms WHERE product_id = $1',
    [productId]
  );

  if (result.rows.length === 0) {
    res.json({ hasSBOM: false });
    return;
  }

  const row = result.rows[0];
  const sbomData = typeof row.spdx_json === 'string' ? JSON.parse(row.spdx_json) : row.spdx_json;

  // Parse packages for the frontend
  const packages = (sbomData?.sbom?.packages || [])
    .filter((p: SpdxPackage) => p.SPDXID !== 'SPDXRef-DOCUMENT' && !p.name?.startsWith('com.github.'))
    .map((p: SpdxPackage) => extractPackageInfo(p));

  res.json({
    hasSBOM: true,
    spdxVersion: row.spdx_version,
    packageCount: row.package_count,
    isStale: row.is_stale,
    syncedAt: row.synced_at,
    packages,
  });
});

// ─── POST /api/github/sbom/:productId ───────────────────────────
// Refresh SBOM only (without full repo sync)
router.post('/sbom/:productId', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).email;
  const orgId = await getUserOrgId(userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const productId = req.params.productId as string;
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
      res.status(400).json({ error: 'GitHub not connected.' });
      return;
    }

    const sbomData = await getSBOM(ghToken, parsed.owner, parsed.repo);
    if (!sbomData) {
      res.status(404).json({ error: 'No dependency data available for this repository.' });
      return;
    }

    const sbomResult = await storeSBOM(productId, sbomData, neo4jSession);


    // Record telemetry
    const reqData = extractRequestData(req);
    await recordEvent({
      userId,
      email: userEmail,
      eventType: 'sbom_refreshed',
      ipAddress: reqData.ipAddress,
      userAgent: reqData.userAgent,
      acceptLanguage: reqData.acceptLanguage,
      metadata: { productId, productName, packageCount: sbomResult.packageCount },
    });

    res.json({
      hasSBOM: true,
      packageCount: sbomResult.packageCount,
      isStale: false,
      syncedAt: new Date().toISOString(),
      packages: sbomResult.packages,
    });
  } catch (err: any) {
    console.error('SBOM refresh error:', err);
    res.status(500).json({ error: 'Failed to refresh SBOM from GitHub' });
  } finally {
    await neo4jSession.close();
  }
});

// ─── POST /api/github/webhook ─────────────────────────────────────
// Receive GitHub push events and mark SBOM as stale
router.post('/webhook', async (req: Request, res: Response) => {
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[WEBHOOK] No GITHUB_WEBHOOK_SECRET configured');
    res.status(500).json({ error: 'Webhook not configured' });
    return;
  }

  // Verify HMAC signature
  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) {
    res.status(401).json({ error: 'Missing signature' });
    return;
  }

  const rawBody = (req as any).rawBody;
  if (!rawBody) {
    res.status(400).json({ error: 'Missing raw body' });
    return;
  }

  const expectedSignature = 'sha256=' + crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    console.warn('[WEBHOOK] Invalid signature');
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  // Only process push events
  const event = req.headers['x-github-event'] as string;
  if (event !== 'push') {
    console.log(`[WEBHOOK] Ignoring event: ${event}`);
    res.json({ status: 'ignored', event });
    return;
  }

  const repoUrl = req.body?.repository?.html_url;
  if (!repoUrl) {
    res.status(400).json({ error: 'Missing repository URL' });
    return;
  }

  console.log(`[WEBHOOK] Push event for ${repoUrl}`);

  // Find product(s) linked to this repo
  const neo4jSession = getDriver().session();
  try {
    const result = await neo4jSession.run(
      `MATCH (p:Product)-[:HAS_REPO]->(r:GitHubRepo)
       WHERE r.url = $repoUrl OR r.url = $repoUrlGit
       RETURN p.id as productId`,
      { repoUrl, repoUrlGit: repoUrl + '.git' }
    );

    if (result.records.length === 0) {
      console.log(`[WEBHOOK] No product found for repo: ${repoUrl}`);
      res.json({ status: 'no_match', repoUrl });
      return;
    }

    // Mark SBOM as stale for each matching product
    for (const record of result.records) {
      const productId = record.get('productId');

      // Update Postgres
      await pool.query(
        `UPDATE product_sboms SET is_stale = TRUE WHERE product_id = $1`,
        [productId]
      );

      // Update Neo4j
      await neo4jSession.run(
        `MATCH (p:Product {id: $productId})-[:HAS_SBOM]->(sbom:SBOM)
         SET sbom.isStale = true`,
        { productId }
      );

      console.log(`[WEBHOOK] Marked SBOM stale for product: ${productId}`);
    }

    res.json({ status: 'ok', productsUpdated: result.records.length });
  } catch (err: any) {
    console.error('[WEBHOOK] Error processing push event:', err);
    res.status(500).json({ error: 'Internal error processing webhook' });
  } finally {
    await neo4jSession.close();
  }
});

// ─── GET /api/github/versions/:productId ─────────────────────────
// Get version history for a product
router.get('/versions/:productId', requireAuth, async (req: Request, res: Response) => {
  const orgId = await getUserOrgId((req as any).userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const productId = req.params.productId as string;

  // Verify product belongs to user's org
  const neo4jSession = getDriver().session();
  try {
    const check = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId}) RETURN p`,
      { orgId, productId }
    );
    if (check.records.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const result = await pool.query(
      `SELECT cranis_version, github_tag, github_release_name, github_release_body,
              github_commit_sha, is_prerelease, source, created_at
       FROM product_versions
       WHERE product_id = $1
       ORDER BY created_at DESC`,
      [productId]
    );

    res.json({
      versions: result.rows.map((row: any) => ({
        cranisVersion: row.cranis_version,
        githubTag: row.github_tag,
        releaseName: row.github_release_name,
        releaseBody: row.github_release_body,
        commitSha: row.github_commit_sha,
        isPrerelease: row.is_prerelease,
        source: row.source,
        createdAt: row.created_at,
      })),
    });
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

  const productId = req.params.productId as string;
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

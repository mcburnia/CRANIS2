import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { verifySessionToken } from '../utils/token.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { recordEvent, extractRequestData } from '../services/telemetry.js';
import { createNotification, sendComplianceGapNotification } from '../services/notifications.js';
import { enrichDependencyHashes } from '../services/hash-enrichment.js';
import { enrichDependencyLicenses } from '../services/license-enrichment.js';
import { scanProductLicenses } from '../services/license-scanner.js';
import { createSnapshot } from '../services/ip-proof.js';
import { resolveLockfileVersions } from '../services/lockfile-resolver.js';
import { generateSBOMFromLockfiles } from '../services/lockfile-sbom-generator.js';
import { generateSBOMFromImports } from '../services/import-scanner.js';
import { PROVIDER_REGISTRY } from '../services/repo-provider.js';
import {
  exchangeCodeForToken as githubExchangeCodeForToken,
  getAuthenticatedUser as githubGetAuthenticatedUser,
  getRepo as githubGetRepo,
  getContributors as githubGetContributors,
  getLanguages as githubGetLanguages,
  getSBOM as githubGetSBOM,
  getReleases as githubGetReleases,
  getTags as githubGetTags,
  parseRepoUrl as githubParseRepoUrl,
} from '../services/github.js';
import type { GitHubSBOMResponse, SpdxPackage, GitHubRelease, GitHubTag } from '../services/github.js';
import * as provider from '../services/repo-provider.js';
import type { RepoProvider, NormalisedRelease } from '../services/repo-provider.js';
// Note: provider.parseRepoUrlGeneric, provider.validatePAT, provider.detectProvider now available
import { createRepo as codebergCreateRepo } from '../services/codeberg.js';

const router = Router();

// In-memory stores with automatic cleanup
// OAuth state tokens for CSRF protection
const pendingStates = new Map<string, { userId: string; expiresAt: number; provider: RepoProvider }>();
// Connection tokens — short-lived, single-use tokens for initiating OAuth
const connectionTokens = new Map<string, { userId: string; expiresAt: number; provider: RepoProvider }>();

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

// ── GET /providers — available providers for frontend dropdown ────
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

// ─── POST /connect-pat — PAT-based connection for self-hosted providers ───
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

// Helper: get user's org_id
async function getUserOrgId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.org_id || null;
}

// Helper: get user's decrypted repo token for a specific provider
export async function getUserRepoToken(userId: string, repoProvider?: RepoProvider): Promise<string | null> {
  const query = repoProvider
    ? 'SELECT access_token_encrypted FROM repo_connections WHERE user_id = $1 AND provider = $2'
    : 'SELECT access_token_encrypted FROM repo_connections WHERE user_id = $1';
  const params = repoProvider ? [userId, repoProvider] : [userId];
  const result = await pool.query(query, params);
  if (result.rows.length === 0) return null;
  try {
    return decrypt(result.rows[0].access_token_encrypted);
  } catch {
    return null;
  }
}
// Backward compat alias
export const getUserGitHubToken = getUserRepoToken;

/** Get user's decrypted token AND connection metadata for a specific provider */
export async function getUserRepoConnection(
  userId: string,
  repoProvider?: RepoProvider
): Promise<{ token: string; instanceUrl: string | null; provider: RepoProvider } | null> {
  const query = repoProvider
    ? 'SELECT access_token_encrypted, instance_url, provider FROM repo_connections WHERE user_id = $1 AND provider = $2'
    : 'SELECT access_token_encrypted, instance_url, provider FROM repo_connections WHERE user_id = $1';
  const params = repoProvider ? [userId, repoProvider] : [userId];
  const result = await pool.query(query, params);
  if (result.rows.length === 0) return null;
  try {
    return {
      token: decrypt(result.rows[0].access_token_encrypted),
      instanceUrl: result.rows[0].instance_url || null,
      provider: result.rows[0].provider as RepoProvider,
    };
  } catch {
    return null;
  }
}

/** Resolve provider + token for a repo URL by checking user's connections */
export async function resolveRepoConnection(
  userId: string,
  repoUrl: string
): Promise<{ token: string; instanceUrl: string | null; provider: RepoProvider; owner: string; repo: string } | null> {
  // First try cloud providers
  const cloudProvider = provider.detectProvider(repoUrl);
  if (cloudProvider) {
    const conn = await getUserRepoConnection(userId, cloudProvider);
    if (!conn) return null;
    const parsed = provider.parseRepoUrl(cloudProvider, repoUrl);
    if (!parsed) return null;
    return { ...conn, owner: parsed.owner, repo: parsed.repo };
  }

  // Try self-hosted: find a connection whose instance_url hostname matches the repo URL
  const allConns = await pool.query(
    'SELECT access_token_encrypted, instance_url, provider FROM repo_connections WHERE user_id = $1 AND instance_url IS NOT NULL',
    [userId]
  );

  let repoHostname;
  try {
    repoHostname = new URL(repoUrl.includes('://') ? repoUrl : `https://${repoUrl}`).hostname;
  } catch {
    return null;
  }

  for (const row of allConns.rows) {
    try {
      const instanceHostname = new URL(row.instance_url).hostname;
      if (instanceHostname === repoHostname) {
        const parsed = provider.parseRepoUrlGeneric(repoUrl);
        if (!parsed) continue;
        return {
          token: decrypt(row.access_token_encrypted),
          instanceUrl: row.instance_url,
          provider: row.provider as RepoProvider,
          owner: parsed.owner,
          repo: parsed.repo,
        };
      }
    } catch { continue; }
  }

  return null;
}

/**
 * Parse a purl (Package URL) or construct one from SPDX package data.
 * SPDX packages from GitHub have externalRefs with purl references.
 */
export function extractPackageInfo(pkg: SpdxPackage): {
  purl: string;
  name: string;
  version: string;
  ecosystem: string;
  license: string;
  supplier: string;
  downloadLocation: string;
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
    downloadLocation: pkg.downloadLocation || 'NOASSERTION',
  };
}

/**
 * Store SBOM data in Postgres + Neo4j
 */
async function storeSBOM(
  productId: string,
  sbomResponse: GitHubSBOMResponse,
  neo4jSession: any,
  sbomSource: string = 'api'
): Promise<{ packageCount: number; packages: ReturnType<typeof extractPackageInfo>[] }> {
  const sbom = sbomResponse.sbom;
  // Filter out the root package (the repo itself)
  const depPackages = sbom.packages.filter(p => p.SPDXID !== 'SPDXRef-DOCUMENT' && !p.name?.startsWith('com.github.'));
  const packages = depPackages.map(extractPackageInfo);

  // Store full SPDX JSON in Postgres
  await pool.query(
    `INSERT INTO product_sboms (product_id, spdx_json, spdx_version, package_count, is_stale, synced_at, sbom_source)
     VALUES ($1, $2, $3, $4, FALSE, NOW(), $5)
     ON CONFLICT (product_id) DO UPDATE SET
       spdx_json = $2, spdx_version = $3, package_count = $4,
       is_stale = FALSE, synced_at = NOW(), sbom_source = $5`,
    [productId, JSON.stringify(sbomResponse), sbom.spdxVersion, packages.length, sbomSource]
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
           d.supplier = $supplier,
           d.downloadLocation = $downloadLocation

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
        downloadLocation: pkg.downloadLocation,
        productId,
      }
    );
  }


  // ── Tag direct vs transitive depth on DEPENDS_ON relationships ──
  // Parse SPDX relationships to identify which deps are direct (from root package)
  const relationships = sbom.relationships || [];
  if (relationships.length > 0) {
    // Find root package: the element that SPDXRef-DOCUMENT DESCRIBES
    const describesRel = relationships.find(
      (r: any) => r.spdxElementId === 'SPDXRef-DOCUMENT' && r.relationshipType === 'DESCRIBES'
    );
    const rootSpdxId = describesRel?.relatedSpdxElement;

    if (rootSpdxId) {
      // Build SPDXID → PURL map from all packages
      const spdxIdToPurl = new Map<string, string>();
      for (const pkg of sbom.packages) {
        const purlRef = pkg.externalRefs?.find((r: any) => r.referenceType === 'purl');
        if (purlRef) {
          spdxIdToPurl.set(pkg.SPDXID, purlRef.referenceLocator);
        }
      }

      // Collect direct dependency PURLs (root DEPENDS_ON → these are direct)
      const directPurls = new Set<string>();
      for (const rel of relationships) {
        if (rel.spdxElementId === rootSpdxId && rel.relationshipType === 'DEPENDS_ON') {
          const purl = spdxIdToPurl.get(rel.relatedSpdxElement);
          if (purl) directPurls.add(purl);
        }
      }

      // Batch-update Neo4j: set depth on DEPENDS_ON relationships and Dependency nodes
      if (directPurls.size > 0) {
        const allPurls = packages.map(p => p.purl);
        const depthEntries = allPurls.map(purl => ({
          purl,
          depth: directPurls.has(purl) ? 'direct' : 'transitive'
        }));

        await neo4jSession.run(
          `UNWIND $entries AS entry
           MATCH (p:Product {id: $productId})-[r:DEPENDS_ON]->(d:Dependency {purl: entry.purl})
           SET r.depth = entry.depth, d.depth = entry.depth`,
          { productId, entries: depthEntries }
        );

        console.log(`[SBOM] Depth tagged: ${directPurls.size} direct, ${allPurls.length - directPurls.size} transitive`);
      }
    }
  }


  return { packageCount: packages.length, packages };
}

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
  <title>CRANIS2 ${success ? `— ${providerLabel} Connected` : '— Connection Failed'}</title>
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

    // Resolve provider + token from repo URL (supports cloud + self-hosted)
    const repoConn = await resolveRepoConnection(userId, repoUrl);
    if (!repoConn) {
      res.status(400).json({ error: 'No provider connection found for this repository URL. Please connect your account first.' });
      return;
    }
    const detectedProvider = repoConn.provider;
    const parsed = { owner: repoConn.owner, repo: repoConn.repo };
    const repoToken = repoConn.token;
    const repoInstanceUrl = repoConn.instanceUrl;

    const syncStartedAt = new Date();
    const syncStartMs = Date.now();

    // Fetch ALL data from provider in parallel (ALL READ-ONLY GET requests)
    console.log(`[SYNC] Fetching data from ${detectedProvider} for`, parsed.owner, parsed.repo);
    const [repoData, contributors, languages, sbomData, releases, tags] = await Promise.all([
      provider.getRepo(detectedProvider, repoToken, parsed.owner, parsed.repo, repoInstanceUrl || undefined),
      provider.getContributors(detectedProvider, repoToken, parsed.owner, parsed.repo, repoInstanceUrl || undefined),
      provider.getLanguages(detectedProvider, repoToken, parsed.owner, parsed.repo, repoInstanceUrl || undefined),
      provider.getSBOM(detectedProvider, repoToken, parsed.owner, parsed.repo),
      provider.getReleases(detectedProvider, repoToken, parsed.owner, parsed.repo, repoInstanceUrl || undefined),
      provider.getTags(detectedProvider, repoToken, parsed.owner, parsed.repo, repoInstanceUrl || undefined),
    ]);

    // Store repo data in Neo4j
    await neo4jSession.run(
      `MERGE (r:Repository {url: $url})
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
           r.provider = $provider,
           r.syncedAt = datetime()

       WITH r
       MATCH (p:Product {id: $productId})
       MERGE (p)-[:HAS_REPO]->(r)

       WITH r
       MATCH (u:User {id: $userId})
       MERGE (u)-[:REPO_CONNECTED]->(r)`,
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
        provider: detectedProvider,
        productId,
        userId,
      }
    );

    // Store contributors in Neo4j
    for (const contrib of contributors) {
      await neo4jSession.run(
        `MATCH (r:Repository {url: $repoUrl})
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

    // Lockfile fallback: if provider API has no SBOM (e.g. Codeberg), generate from lockfiles
    let effectiveSbomData = sbomData;
    let sbomSource = 'api';
    if (!effectiveSbomData) {
      console.log("[SYNC] No API SBOM — trying lockfile fallback...");
      const lockfileResult = await generateSBOMFromLockfiles(
        parsed.owner, parsed.repo, repoData.default_branch,
        detectedProvider, repoToken, repoData.html_url, repoInstanceUrl || undefined
      );
      if (lockfileResult) {
        effectiveSbomData = lockfileResult.sbom as any;
        sbomSource = `lockfile:${lockfileResult.lockfileUsed}`;
        console.log(`[SYNC] Lockfile SBOM generated from ${lockfileResult.lockfileUsed}: ${lockfileResult.totalDependencies} dependencies`);
      }
    }

    // Tier 3: Source import scanning (if no API SBOM and no lockfile found)
    if (!effectiveSbomData) {
      console.log("[SYNC] No lockfile SBOM — trying import scan (Tier 3)...");
      try {
        const importResult = await generateSBOMFromImports(
          parsed.owner, parsed.repo, repoData.default_branch,
          detectedProvider, repoToken, repoData.html_url, repoInstanceUrl || undefined
        );
        if (importResult) {
          effectiveSbomData = { sbom: importResult.sbom } as any;
          sbomSource = `import-scan:${importResult.languagesDetected.join('+')}`;
          console.log(`[SYNC] Import scan SBOM: ${importResult.languagesDetected.join(', ')} — ${importResult.totalPackages} packages (confidence: ${importResult.confidence})`);
        }
      } catch (err: any) {
        console.error(`[SYNC] Import scan failed: ${err.message}`);
      }
    }

    // Store SBOM in Postgres + Neo4j (if available)
    let sbomResult: { packageCount: number; packages: any[] } | null = null;
    console.log("[SYNC] SBOM result:", effectiveSbomData ? `Found ${effectiveSbomData.sbom?.packages?.length || 0} packages` : "null - no SBOM available");
    if (effectiveSbomData) {
      sbomResult = await storeSBOM(productId, effectiveSbomData, neo4jSession, sbomSource);

      // Post-SBOM compliance pipeline (non-blocking)
      if (sbomResult) {
        const pipelinePackages = sbomResult.packages;
        const pipelineProductId = productId;
        const pipelineOrgId = orgId;
        const pipelineProductName = productName;
        const pipelineUserId = userId;
        const pipelineGhToken = repoToken;
        (async () => {
          try {
            // 1. Resolve version gaps from lockfile
            if (pipelineGhToken) {
              await resolveLockfileVersions(pipelineProductId, pipelineGhToken);
            }
            // 2. Enrich hashes (newly-versioned deps now eligible)
            const enrichResult = await enrichDependencyHashes(pipelineProductId, pipelinePackages);
            // 3. Send compliance gap notifications
            const totalDeps = enrichResult.enriched + enrichResult.gaps.noVersion + enrichResult.gaps.unsupportedEcosystem + enrichResult.gaps.notFound + enrichResult.gaps.fetchError;
            await sendComplianceGapNotification(pipelineProductId, pipelineOrgId, pipelineProductName, enrichResult.gaps, totalDeps);
            // 4. Enrich licenses from npm registry (for NOASSERTION deps)
            await enrichDependencyLicenses(pipelineProductId, pipelinePackages);
            // 5. Auto license scan
            if (pipelineOrgId) {
              try {
                await scanProductLicenses(pipelineProductId, pipelineOrgId);
                console.log("[SYNC] License scan completed for", pipelineProductId);
              } catch (lsErr: any) {
                console.error("[SYNC] License scan failed:", lsErr.message);
              }
              // 6. IP proof timestamp
              try {
                await createSnapshot(pipelineProductId, pipelineOrgId, pipelineUserId, 'sync');
                console.log("[SYNC] IP proof snapshot created for", pipelineProductId);
              } catch (ipErr: any) {
                console.error("[SYNC] IP proof snapshot failed:", ipErr.message);
              }
            }
          } catch (err: any) {
            console.error("[SYNC] Post-SBOM pipeline failed:", err.message);
          }
        })();
      }
    }

    // ── Store GitHub releases in product_versions ──
    const publishedReleases = releases.filter((r: NormalisedRelease) => !r.draft);
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

    // Record sync duration
    const syncDurationSeconds = (Date.now() - syncStartMs) / 1000;
    console.log(`[SYNC] Duration: ${syncDurationSeconds.toFixed(2)}s for ${parsed.owner}/${parsed.repo}`);
    await pool.query(
      `INSERT INTO sync_history (product_id, sync_type, started_at, duration_seconds, package_count, contributor_count, release_count, cranis_version, triggered_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [productId, 'manual', syncStartedAt, syncDurationSeconds, sbomResult?.packageCount || 0, contributors.length, publishedReleases.length, cranisVersion, userEmail, 'success']
    );

    // Build response
    const totalBytes = Object.values(languages).reduce((sum, b) => sum + b, 0);
    const languageBreakdown = Object.entries(languages)
      .map(([lang, bytes]) => ({ language: lang, bytes, percentage: totalBytes > 0 ? Math.round((bytes / totalBytes) * 1000) / 10 : 0 }))
      .sort((a, b) => b.bytes - a.bytes);

    res.json({
      provider: detectedProvider,
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
      releases: publishedReleases.map((r: any) => ({
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
      res.status(404).json({ error: 'Repository not found. Check the URL and ensure your account has access.' });
    } else if (err.message?.includes('401') || err.message?.includes('403')) {
      res.status(403).json({ error: 'GitHub access denied. Your token may have expired — try reconnecting.' });
    } else {
      res.status(500).json({ error: 'Failed to sync repository' });
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

    // Resolve provider + token (supports cloud + self-hosted)
    const sbomConn = await resolveRepoConnection(userId, repoUrl);
    if (!sbomConn) {
      res.status(400).json({ error: 'No provider connection found for this repository.' });
      return;
    }
    const sbomProvider = sbomConn.provider;
    const parsed = { owner: sbomConn.owner, repo: sbomConn.repo };
    const sbomToken = sbomConn.token;
    const sbomInstanceUrl = sbomConn.instanceUrl;

    let sbomData = await provider.getSBOM(sbomProvider, sbomToken, parsed.owner, parsed.repo);
    let refreshInstanceUrl = sbomInstanceUrl;
    let refreshSbomSource = 'api';
    // Fetch default branch for fallback SBOM generation
    const repoNode = await neo4jSession.run(
      'MATCH (p:Product {id: $productId})-[:HAS_REPO]->(r:Repository) RETURN r.defaultBranch as defaultBranch',
      { productId }
    );
    const defaultBranch = repoNode.records[0]?.get('defaultBranch') || 'main';
    if (!sbomData) {
      // Lockfile fallback: generate SBOM from lockfiles
      console.log("[SBOM-REFRESH] No API SBOM — trying lockfile fallback...");
      const lockfileResult = await generateSBOMFromLockfiles(
        parsed.owner, parsed.repo, defaultBranch,
        sbomProvider, sbomToken, repoUrl
      );
      if (lockfileResult) {
        sbomData = lockfileResult.sbom as any;
        refreshSbomSource = `lockfile:${lockfileResult.lockfileUsed}`;
        console.log(`[SBOM-REFRESH] Lockfile SBOM: ${lockfileResult.lockfileUsed} (${lockfileResult.totalDependencies} deps)`);
      }
    }
    // Tier 3: Source import scanning
    if (!sbomData) {
      console.log("[SBOM-REFRESH] No lockfile SBOM — trying import scan (Tier 3)...");
      try {
        const importResult = await generateSBOMFromImports(
          parsed.owner, parsed.repo, defaultBranch,
          sbomProvider, sbomToken, repoUrl
        );
        if (importResult) {
          sbomData = { sbom: importResult.sbom } as any;
          refreshSbomSource = `import-scan:${importResult.languagesDetected.join('+')}`;
          console.log(`[SBOM-REFRESH] Import scan: ${importResult.languagesDetected.join(', ')} — ${importResult.totalPackages} packages`);
        }
      } catch (err: any) {
        console.error(`[SBOM-REFRESH] Import scan failed: ${err.message}`);
      }
    }
    if (!sbomData) {
      res.status(404).json({ error: 'No dependency data available for this repository. No lockfile or source imports found.' });
      return;
    }

    const sbomResult = await storeSBOM(productId, sbomData, neo4jSession, refreshSbomSource);

    // Post-SBOM compliance pipeline (non-blocking)
    const refreshPackages = sbomResult.packages;
    const refreshGhToken = sbomToken;
    (async () => {
      try {
        if (refreshGhToken) {
          await resolveLockfileVersions(productId, refreshGhToken);
        }
        const enrichResult = await enrichDependencyHashes(productId, refreshPackages);
        const totalDeps = enrichResult.enriched + enrichResult.gaps.noVersion + enrichResult.gaps.unsupportedEcosystem + enrichResult.gaps.notFound + enrichResult.gaps.fetchError;
        await sendComplianceGapNotification(productId, orgId, productName, enrichResult.gaps, totalDeps);
        // 4. Enrich licenses from npm registry (for NOASSERTION deps)
        await enrichDependencyLicenses(productId, refreshPackages);
        // 5. Auto license scan
        try {
          await scanProductLicenses(productId, orgId);
          console.log("[SBOM-REFRESH] License scan completed for", productId);
        } catch (lsErr: any) {
          console.error("[SBOM-REFRESH] License scan failed:", lsErr.message);
        }
        // 6. IP proof timestamp
        try {
          await createSnapshot(productId, orgId, userId, 'sync');
          console.log("[SBOM-REFRESH] IP proof snapshot created for", productId);
        } catch (ipErr: any) {
          console.error("[SBOM-REFRESH] IP proof snapshot failed:", ipErr.message);
        }
      } catch (err: any) {
        console.error("[SBOM-REFRESH] Post-SBOM pipeline failed:", err.message);
      }
    })();

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
    res.status(500).json({ error: 'Failed to refresh SBOM' });
  } finally {
    await neo4jSession.close();
  }
});

// ─── POST /api/github/webhook ─────────────────────────────────────
// Receive push events from GitHub or Codeberg and mark SBOM as stale
router.post('/webhook', async (req: Request, res: Response) => {
  // Detect provider from headers
  const isGitHub = !!req.headers['x-github-event'];
  const isForgejo = !!req.headers['x-forgejo-event'] || !!req.headers['x-gitea-event'];
  const webhookProvider: RepoProvider = isForgejo ? 'codeberg' : 'github';

  const webhookSecret = webhookProvider === 'codeberg'
    ? process.env.CODEBERG_WEBHOOK_SECRET
    : process.env.GITHUB_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error(`[WEBHOOK] No ${webhookProvider.toUpperCase()}_WEBHOOK_SECRET configured`);
    res.status(500).json({ error: 'Webhook not configured' });
    return;
  }

  // Verify HMAC signature
  const signature = (req.headers['x-hub-signature-256'] || req.headers['x-forgejo-signature']) as string;
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
  const sigToCompare = signature.startsWith('sha256=') ? signature : `sha256=${signature}`;
  if (!crypto.timingSafeEqual(Buffer.from(sigToCompare), Buffer.from(expectedSignature))) {
    console.warn(`[WEBHOOK] Invalid ${webhookProvider} signature`);
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  // Only process push events
  const event = (req.headers['x-github-event'] || req.headers['x-forgejo-event'] || req.headers['x-gitea-event']) as string;
  if (event !== 'push') {
    console.log(`[WEBHOOK] Ignoring ${webhookProvider} event: ${event}`);
    res.json({ status: 'ignored', event });
    return;
  }

  const repoUrl = req.body?.repository?.html_url;
  if (!repoUrl) {
    res.status(400).json({ error: 'Missing repository URL' });
    return;
  }

  console.log(`[WEBHOOK] Push event from ${webhookProvider} for ${repoUrl}`);

  // Find product(s) linked to this repo
  const neo4jSession = getDriver().session();
  try {
    const result = await neo4jSession.run(
      `MATCH (p:Product)-[:HAS_REPO]->(r:Repository)
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

      // Record telemetry (system event — no user, insert directly)
      try {
        await pool.query(
          `INSERT INTO user_events (event_type, ip_address, user_agent, metadata)
           VALUES ($1, $2, $3, $4)`,
          ['webhook_sbom_stale', req.ip || null, req.headers['user-agent'] || 'GitHub-Hookshot', JSON.stringify({ productId, repoUrl, event: 'push' })]
        );
        console.log(`[WEBHOOK] Audit event recorded for product: ${productId}`);
      } catch (telErr: any) {
        console.error('[WEBHOOK] Failed to record audit event:', telErr.message);
      }

      // Create notification for stale SBOM
      try {
        const orgResult = await neo4jSession.run(
          'MATCH (p:Product {id: $productId})-[:BELONGS_TO]->(o:Organisation) RETURN o.id AS orgId, p.name AS name',
          { productId }
        );
        if (orgResult.records.length > 0) {
          const webhookOrgId = orgResult.records[0].get('orgId');
          const productName = orgResult.records[0].get('name') || productId;
          if (webhookOrgId) {
            await createNotification({
              orgId: webhookOrgId,
              userId: null,
              type: 'sbom_stale',
              severity: 'medium',
              title: 'SBOM is now stale for ' + productName,
              body: `A push to the ${webhookProvider === 'codeberg' ? 'Codeberg' : 'GitHub'} repository was detected. The SBOM needs to be re-synced.`,
              link: '/products/' + productId + '?tab=dependencies',
              metadata: { productId, productName, repoUrl, event: 'push' },
            });
          }
        }
      } catch (notifErr: any) {
        console.error('[WEBHOOK] Failed to create stale SBOM notification:', notifErr.message);
      }
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

// ─── GET /api/github/sync-history/:productId ─────────────────────
// Get sync duration history for a product
router.get('/sync-history/:productId', requireAuth, async (req: Request, res: Response) => {
  const orgId = await getUserOrgId((req as any).userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const productId = req.params.productId as string;

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
      `SELECT sync_type, started_at, duration_seconds, package_count,
              contributor_count, release_count, cranis_version,
              triggered_by, status, error_message, created_at
       FROM sync_history
       WHERE product_id = $1
       ORDER BY started_at DESC
       LIMIT 50`,
      [productId]
    );

    // Also get aggregate stats
    const stats = await pool.query(
      `SELECT
         COUNT(*) as total_syncs,
         ROUND(AVG(duration_seconds)::numeric, 2) as avg_duration,
         ROUND(MIN(duration_seconds)::numeric, 2) as min_duration,
         ROUND(MAX(duration_seconds)::numeric, 2) as max_duration,
         COUNT(*) FILTER (WHERE status = 'error') as error_count
       FROM sync_history
       WHERE product_id = $1`,
      [productId]
    );

    res.json({
      history: result.rows.map((row: any) => ({
        syncType: row.sync_type,
        startedAt: row.started_at,
        durationSeconds: parseFloat(row.duration_seconds),
        packageCount: row.package_count,
        contributorCount: row.contributor_count,
        releaseCount: row.release_count,
        cranisVersion: row.cranis_version,
        triggeredBy: row.triggered_by,
        status: row.status,
        errorMessage: row.error_message,
        createdAt: row.created_at,
      })),
      stats: stats.rows[0] ? {
        totalSyncs: parseInt(stats.rows[0].total_syncs),
        avgDuration: parseFloat(stats.rows[0].avg_duration) || 0,
        minDuration: parseFloat(stats.rows[0].min_duration) || 0,
        maxDuration: parseFloat(stats.rows[0].max_duration) || 0,
        errorCount: parseInt(stats.rows[0].error_count),
      } : null,
    });
  } finally {
    await neo4jSession.close();
  }
});

// ─── DELETE /api/github/disconnect/{:provider} ───────────────────
router.delete('/disconnect/{:provider}', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const userEmail = (req as any).email;
  const disconnectProvider = (req.params.provider || 'github') as RepoProvider;

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

// ─── GET /api/github/repo/:productId ────────────────────────────
router.get('/repo/:productId', requireAuth, async (req: Request, res: Response) => {
  const orgId = await getUserOrgId((req as any).userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const productId = req.params.productId as string;
  const session = getDriver().session();

  try {
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})-[:HAS_REPO]->(r:Repository)
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
      provider: r.provider || 'github',
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

// ─── POST /api/github/codeberg/create-repo ──────────────────────
// Create a new repo on Codeberg for EU-sovereign hosting
router.post('/codeberg/create-repo', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { name, description, isPrivate } = req.body;

  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'Repository name is required' });
    return;
  }

  const codebergToken = await getUserRepoToken(userId, 'codeberg');
  if (!codebergToken) {
    res.status(400).json({ error: 'Codeberg not connected. Please connect your Codeberg account first.' });
    return;
  }

  try {
    const repo = await codebergCreateRepo(codebergToken, name, description || '', !!isPrivate);
    res.json({
      url: repo.html_url,
      fullName: repo.full_name,
      name: repo.name,
      isPrivate: repo.private,
    });
  } catch (err: any) {
    console.error('Codeberg repo creation error:', err);
    res.status(500).json({ error: err.message || 'Failed to create Codeberg repository' });
  }
});

export default router;

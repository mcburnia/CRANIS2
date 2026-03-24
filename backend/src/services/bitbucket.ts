// Bitbucket Cloud API service – mirrors github.ts / codeberg.ts structure
// API docs: https://developer.atlassian.com/cloud/bitbucket/rest/intro/

const BITBUCKET_API = 'https://api.bitbucket.org/2.0';

export interface BitbucketRepo {
  uuid: string;
  slug: string;
  full_name: string;  // workspace/repo
  name: string;
  description: string;
  language: string;
  is_private: boolean;
  mainbranch?: { name: string };
  updated_on: string;
  created_on: string;
  size: number;
  links: {
    html: { href: string };
  };
}

export interface BitbucketUser {
  uuid: string;
  display_name: string;
  nickname: string;
  account_id: string;
  links: {
    avatar: { href: string };
    html: { href: string };
  };
}

export interface BitbucketTag {
  name: string;
  target: {
    hash: string;
    date?: string;
  };
}

async function bbGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BITBUCKET_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Bitbucket API ${res.status}: ${path} – ${body}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Parse workspace/repo from a Bitbucket URL.
 * Supports: https://bitbucket.org/workspace/repo, https://bitbucket.org/workspace/repo.git
 */
export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  if (!url) return null;
  try {
    const u = new URL(url.includes('://') ? url : `https://${url}`);
    if (u.hostname !== 'bitbucket.org') return null;
    const parts = u.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/').filter(Boolean);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return { owner: parts[0], repo: parts[1] };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Exchange an OAuth2 authorisation code for an access token.
 * Bitbucket uses standard OAuth2 with client credentials in Basic auth header.
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; token_type: string; scope: string; refresh_token?: string }> {
  const clientId = process.env.BITBUCKET_CLIENT_ID;
  const clientSecret = process.env.BITBUCKET_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Bitbucket OAuth credentials not configured');
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch('https://bitbucket.org/site/oauth2/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bitbucket token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json() as any;
  return {
    access_token: data.access_token,
    token_type: data.token_type || 'bearer',
    scope: data.scopes || '',
    refresh_token: data.refresh_token,
  };
}

export async function getAuthenticatedUser(token: string): Promise<BitbucketUser> {
  return bbGet<BitbucketUser>('/user', token);
}

export async function getRepo(token: string, workspace: string, repo: string): Promise<BitbucketRepo> {
  return bbGet<BitbucketRepo>(`/repositories/${workspace}/${repo}`, token);
}

/**
 * Get repository contributors (commit authors) via the diffstat commits endpoint.
 * Bitbucket doesn't have a dedicated contributors endpoint, so we approximate
 * from the commit authors list.
 */
export async function getContributors(
  token: string,
  workspace: string,
  repo: string
): Promise<Array<{ display_name: string; uuid: string; nickname: string; avatar: string; count: number }>> {
  try {
    // Fetch recent commits and aggregate by author
    const data = await bbGet<{
      values: Array<{
        author: {
          raw: string;
          user?: { uuid: string; display_name: string; nickname: string; links: { avatar: { href: string } } };
        };
      }>;
    }>(`/repositories/${workspace}/${repo}/commits?pagelen=100`, token);

    const authorMap = new Map<string, { display_name: string; uuid: string; nickname: string; avatar: string; count: number }>();
    for (const commit of data.values || []) {
      const user = commit.author?.user;
      if (!user) continue;
      const key = user.uuid || user.nickname;
      const existing = authorMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        authorMap.set(key, {
          display_name: user.display_name || user.nickname || '',
          uuid: user.uuid || '',
          nickname: user.nickname || '',
          avatar: user.links?.avatar?.href || '',
          count: 1,
        });
      }
    }
    return Array.from(authorMap.values()).sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

/**
 * Get repository language breakdown.
 * Bitbucket returns { "TypeScript": 45.2, "JavaScript": 30.1 } as percentages.
 */
export async function getLanguages(token: string, workspace: string, repo: string): Promise<Record<string, number>> {
  try {
    const data = await bbGet<Record<string, number>>(
      `/repositories/${workspace}/${repo}/languages`, token
    );
    // Some endpoints may not exist; fall back to repo.language
    if (!data || Object.keys(data).length === 0) {
      const repoData = await getRepo(token, workspace, repo);
      if (repoData.language) return { [repoData.language]: 100 };
      return {};
    }
    return data;
  } catch {
    // Bitbucket doesn't always expose /languages — fall back to repo metadata
    try {
      const repoData = await getRepo(token, workspace, repo);
      if (repoData.language) return { [repoData.language]: 100 };
    } catch { /* ignore */ }
    return {};
  }
}

/**
 * Get tags (Bitbucket calls them "refs/tags").
 */
export async function getTags(token: string, workspace: string, repo: string): Promise<BitbucketTag[]> {
  try {
    const data = await bbGet<{ values: BitbucketTag[] }>(
      `/repositories/${workspace}/${repo}/refs/tags?pagelen=100&sort=-target.date`, token
    );
    return data.values || [];
  } catch {
    return [];
  }
}

/**
 * Fetch raw file content from a Bitbucket repo. Returns null if not found.
 */
export async function getRawFile(
  token: string,
  workspace: string,
  repo: string,
  branch: string,
  filepath: string
): Promise<string | null> {
  const url = `${BITBUCKET_API}/repositories/${workspace}/${repo}/src/${encodeURIComponent(branch)}/${filepath}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Bitbucket raw file ${res.status}: ${filepath}`);
    return await res.text();
  } catch (err: any) {
    if (err.message?.includes('404')) return null;
    throw err;
  }
}

// ─── Webhook management ──────────────────────────────────────────

/**
 * Create a push-event webhook on a Bitbucket repository.
 * Bitbucket uses a different webhook structure to GitHub.
 * Returns the webhook UUID (as a numeric hash for compatibility with the provider interface).
 */
export async function createWebhook(
  token: string,
  workspace: string,
  repo: string,
  callbackUrl: string,
  _secret: string
): Promise<number> {
  // Note: Bitbucket Cloud webhooks do NOT support shared secrets / HMAC signatures.
  // Verification must be done by IP allowlisting or checking the webhook UUID header.
  const res = await fetch(`${BITBUCKET_API}/repositories/${workspace}/${repo}/hooks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description: 'CRANIS2 push sync',
      url: callbackUrl,
      active: true,
      events: ['repo:push'],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bitbucket webhook POST ${res.status}: ${text}`);
  }
  const result = await res.json() as { uuid: string };
  // Store UUID hash as numeric ID for compatibility with the provider interface
  return hashUuid(result.uuid);
}

/**
 * Delete a webhook from a Bitbucket repository.
 * We stored a hash of the UUID, but we need the actual UUID to delete.
 * For now, list hooks and find the matching CRANIS2 one.
 */
export async function deleteWebhook(
  token: string,
  workspace: string,
  repo: string,
  _webhookId: number
): Promise<void> {
  try {
    // List all webhooks and find the CRANIS2 one
    const data = await bbGet<{ values: Array<{ uuid: string; description: string }> }>(
      `/repositories/${workspace}/${repo}/hooks?pagelen=100`, token
    );
    for (const hook of data.values || []) {
      if (hook.description === 'CRANIS2 push sync') {
        const res = await fetch(`${BITBUCKET_API}/repositories/${workspace}/${repo}/hooks/${hook.uuid}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok && res.status !== 404) {
          console.error(`[BITBUCKET] Failed to delete webhook ${hook.uuid}: ${res.status}`);
        }
        return;
      }
    }
  } catch (err: any) {
    console.error(`[BITBUCKET] Webhook cleanup failed: ${err.message}`);
  }
}

/**
 * List all files in a Bitbucket repo (recursive). Returns flat array of file paths.
 */
export async function listFiles(
  token: string,
  workspace: string,
  repo: string,
  branch: string,
  maxFiles: number = 5000
): Promise<string[]> {
  const files: string[] = [];
  let url: string | null = `/repositories/${workspace}/${repo}/src/${encodeURIComponent(branch)}/?pagelen=100&max_depth=10`;

  while (url && files.length < maxFiles) {
    try {
      const fullUrl = url.startsWith('http') ? url : `${BITBUCKET_API}${url}`;
      const res = await fetch(fullUrl, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (!res.ok) break;
      const data = await res.json() as {
        values: Array<{ path: string; type: string }>;
        next?: string;
      };

      for (const item of data.values || []) {
        if (item.type === 'commit_file' && files.length < maxFiles) {
          files.push(item.path);
        }
      }

      url = data.next || null;
    } catch {
      break;
    }
  }
  return files;
}

// ─── Helpers ──────────────────────────────────────────────────────

/** Convert a Bitbucket UUID string to a stable numeric hash for the webhook ID field. */
function hashUuid(uuid: string): number {
  let hash = 0;
  for (let i = 0; i < uuid.length; i++) {
    hash = ((hash << 5) - hash + uuid.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// Codeberg (Forgejo) API service — mirrors github.ts structure
// API docs: https://codeberg.org/api/swagger

const CODEBERG_API = 'https://codeberg.org/api/v1';

export interface CodebergRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  language: string;
  stars_count: number;
  forks_count: number;
  open_issues_count: number;
  private: boolean;
  default_branch: string;
  updated_at: string;
  visibility: string;
}

export interface CodebergContributor {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
}

export interface CodebergUser {
  id: number;
  login: string;
  avatar_url: string;
  email: string;
}

export interface CodebergRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string;
  target_commitish: string;
  html_url: string;
}

export interface CodebergTag {
  name: string;
  id: string;
  commit: {
    sha: string;
    url: string;
  };
}

async function codebergGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${CODEBERG_API}${path}`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Codeberg API ${res.status}: ${path}`);
  }
  return res.json() as Promise<T>;
}

export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  if (!url) return null;
  try {
    const u = new URL(url.includes('://') ? url : `https://${url}`);
    if (u.hostname !== 'codeberg.org') return null;
    const parts = u.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/');
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return { owner: parts[0], repo: parts[1] };
    }
    return null;
  } catch {
    return null;
  }
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; token_type: string; scope: string }> {
  const res = await fetch('https://codeberg.org/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.CODEBERG_CLIENT_ID,
      client_secret: process.env.CODEBERG_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`Codeberg token exchange failed: ${res.status}`);
  return res.json();
}

export async function getAuthenticatedUser(token: string): Promise<CodebergUser> {
  return codebergGet<CodebergUser>('/user', token);
}

export async function getRepo(token: string, owner: string, repo: string): Promise<CodebergRepo> {
  return codebergGet<CodebergRepo>(`/repos/${owner}/${repo}`, token);
}

export async function getContributors(token: string, owner: string, repo: string): Promise<CodebergContributor[]> {
  // Forgejo doesn't always have the same contributors endpoint as GitHub
  // Use the activity endpoint if available
  try {
    return await codebergGet<CodebergContributor[]>(`/repos/${owner}/${repo}/contributors`, token);
  } catch {
    return [];
  }
}

export async function getLanguages(token: string, owner: string, repo: string): Promise<Record<string, number>> {
  return codebergGet<Record<string, number>>(`/repos/${owner}/${repo}/languages`, token);
}

export async function getReleases(token: string, owner: string, repo: string): Promise<CodebergRelease[]> {
  try {
    return await codebergGet<CodebergRelease[]>(`/repos/${owner}/${repo}/releases?limit=100`, token);
  } catch {
    return [];
  }
}

export async function getTags(token: string, owner: string, repo: string): Promise<CodebergTag[]> {
  try {
    return await codebergGet<CodebergTag[]>(`/repos/${owner}/${repo}/tags?limit=100`, token);
  } catch {
    return [];
  }
}

/** Fetch raw file content from a Codeberg repo. Returns null if file not found. */
export async function getRawFile(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  filepath: string
): Promise<string | null> {
  const url = `${CODEBERG_API}/repos/${owner}/${repo}/raw/${encodeURIComponent(branch)}/${filepath}`;
  const res = await fetch(url, {
    headers: { Authorization: `token ${token}`, Accept: 'text/plain' },
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Codeberg raw file ${res.status}: ${filepath}`);
  return res.text();
}

export async function createRepo(
  token: string,
  name: string,
  description: string,
  isPrivate: boolean
): Promise<CodebergRepo> {
  const res = await fetch(`${CODEBERG_API}/user/repos`, {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      description,
      private: isPrivate,
      auto_init: true,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create Codeberg repo: ${res.status} ${err}`);
  }
  return res.json();
}

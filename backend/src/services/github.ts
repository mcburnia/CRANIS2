/**
 * GitHub API Service — READ-ONLY operations only
 *
 * This service ONLY performs GET requests to the GitHub API.
 * No write, update, or delete operations are exposed.
 */

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  visibility: string;
  default_branch: string;
  pushed_at: string;
  created_at: string;
  updated_at: string;
  private: boolean;
}

export interface GitHubContributor {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  contributions: number;
}

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  email: string | null;
  html_url: string;
}

const GITHUB_API = 'https://api.github.com';

async function githubGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'CRANIS2/1.0',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Parse owner/repo from a GitHub URL
 * Supports: https://github.com/owner/repo, https://github.com/owner/repo.git
 */
export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  try {
    const cleaned = url.replace(/\.git$/, '').replace(/\/$/, '');
    const urlObj = new URL(cleaned);
    if (urlObj.hostname !== 'github.com') return null;

    const parts = urlObj.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;

    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

/**
 * Get the authenticated user's profile (READ-ONLY)
 */
export async function getAuthenticatedUser(token: string): Promise<GitHubUser> {
  return githubGet<GitHubUser>('/user', token);
}

/**
 * Get repository metadata (READ-ONLY)
 */
export async function getRepo(token: string, owner: string, repo: string): Promise<GitHubRepo> {
  return githubGet<GitHubRepo>(`/repos/${owner}/${repo}`, token);
}

/**
 * Get repository contributors (READ-ONLY)
 * Returns up to 100 contributors sorted by commits
 */
export async function getContributors(token: string, owner: string, repo: string): Promise<GitHubContributor[]> {
  return githubGet<GitHubContributor[]>(`/repos/${owner}/${repo}/contributors?per_page=100`, token);
}

/**
 * Get repository language breakdown (READ-ONLY)
 * Returns { "TypeScript": 12345, "JavaScript": 6789, ... } (bytes)
 */
export async function getLanguages(token: string, owner: string, repo: string): Promise<Record<string, number>> {
  return githubGet<Record<string, number>>(`/repos/${owner}/${repo}/languages`, token);
}

/**
 * Exchange an OAuth code for an access token
 */
export async function exchangeCodeForToken(code: string): Promise<{ access_token: string; token_type: string; scope: string }> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('GitHub OAuth credentials not configured');
  }

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub token exchange failed: ${res.status}`);
  }

  const data = await res.json() as Record<string, string>;

  if (data.error) {
    throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
  }

  return {
    access_token: data.access_token,
    token_type: data.token_type,
    scope: data.scope,
  };
}

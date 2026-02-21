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

/**
 * SPDX SBOM response from GitHub's dependency graph API
 */
export interface SpdxPackage {
  SPDXID: string;
  name: string;
  versionInfo?: string;
  downloadLocation?: string;
  licenseConcluded?: string;
  licenseDeclared?: string;
  supplier?: string;
  externalRefs?: Array<{
    referenceCategory: string;
    referenceType: string;
    referenceLocator: string;
  }>;
}

export interface GitHubSBOMResponse {
  sbom: {
    spdxVersion: string;
    dataLicense: string;
    SPDXID: string;
    name: string;
    documentNamespace: string;
    creationInfo: {
      created: string;
      creators: string[];
    };
    packages: SpdxPackage[];
    relationships?: Array<{
      spdxElementId: string;
      relatedSpdxElement: string;
      relationshipType: string;
    }>;
  };
}

/**
 * Get the SPDX SBOM from GitHub's dependency graph (READ-ONLY)
 * Returns null if the repo has no dependency data (404)
 */
export async function getSBOM(token: string, owner: string, repo: string): Promise<GitHubSBOMResponse | null> {
  try {
    console.log(`[SBOM] Fetching from /repos/${owner}/${repo}/dependency-graph/sbom`);
    const result = await githubGet<GitHubSBOMResponse>(`/repos/${owner}/${repo}/dependency-graph/sbom`, token);
    console.log(`[SBOM] Success - got ${result?.sbom?.packages?.length || 0} packages`);
    return result;
  } catch (err: any) {
    console.log(`[SBOM] Error: ${err.message}`);
    // 404 means no dependency data available — not an error
    if (err.message?.includes('404')) return null;
    // 403 can mean dependency graph not enabled
    if (err.message?.includes('403')) return null;
    throw err;
  }
}

// ─── GitHub Releases & Tags ─────────────────────────────────
export interface GitHubRelease {
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

export interface GitHubTag {
  name: string;
  commit: { sha: string; url: string };
}

export async function getReleases(token: string, owner: string, repo: string): Promise<GitHubRelease[]> {
  try {
    return await githubGet<GitHubRelease[]>(`/repos/${owner}/${repo}/releases?per_page=100`, token);
  } catch (err: any) {
    console.log(`[RELEASES] Error fetching releases: ${err.message}`);
    return [];
  }
}

export async function getTags(token: string, owner: string, repo: string): Promise<GitHubTag[]> {
  try {
    return await githubGet<GitHubTag[]>(`/repos/${owner}/${repo}/tags?per_page=100`, token);
  } catch (err: any) {
    console.log(`[TAGS] Error fetching tags: ${err.message}`);
    return [];
  }
}

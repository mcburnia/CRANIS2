// Provider dispatcher — thin dispatch layer (no abstract classes, just functions)
// Routes provider-specific calls to github.ts or codeberg.ts
// PROVIDER_REGISTRY: data-driven provider configuration

import * as github from './github.js';
import * as codeberg from './codeberg.js';

export type RepoProvider = 'github' | 'codeberg';

// ══════════════════════════════════════════════════════════════════
// PROVIDER REGISTRY — data-driven, adding a provider = one entry
// ══════════════════════════════════════════════════════════════════

export interface ProviderConfig {
  id: string;
  label: string;
  baseUrl: string | null;       // null for self-hosted
  apiBase: string | null;       // null → derived from instanceUrl
  selfHosted: boolean;
  supportsApiSbom: boolean;
  authHeader: (token: string) => Record<string, string>;
  oauthSupported: boolean;
}

export const PROVIDER_REGISTRY: ProviderConfig[] = [
  {
    id: 'github',
    label: 'GitHub',
    baseUrl: 'https://github.com',
    apiBase: 'https://api.github.com',
    selfHosted: false,
    supportsApiSbom: true,
    authHeader: (t) => ({ Authorization: `Bearer ${t}` }),
    oauthSupported: true,
  },
  {
    id: 'codeberg',
    label: 'Codeberg',
    baseUrl: 'https://codeberg.org',
    apiBase: 'https://codeberg.org/api/v1',
    selfHosted: false,
    supportsApiSbom: false,
    authHeader: (t) => ({ Authorization: `token ${t}` }),
    oauthSupported: true,
  },
  {
    id: 'gitea',
    label: 'Gitea (self-hosted)',
    baseUrl: null,
    apiBase: null,
    selfHosted: true,
    supportsApiSbom: false,
    authHeader: (t) => ({ Authorization: `token ${t}` }),
    oauthSupported: false,
  },
  {
    id: 'forgejo',
    label: 'Forgejo (self-hosted)',
    baseUrl: null,
    apiBase: null,
    selfHosted: true,
    supportsApiSbom: false,
    authHeader: (t) => ({ Authorization: `token ${t}` }),
    oauthSupported: false,
  },
  {
    id: 'gitlab',
    label: 'GitLab (self-hosted)',
    baseUrl: null,
    apiBase: null,
    selfHosted: true,
    supportsApiSbom: false,
    authHeader: (t) => ({ 'PRIVATE-TOKEN': t }),
    oauthSupported: false,
  },
];

export function getProviderConfig(id: string): ProviderConfig | undefined {
  return PROVIDER_REGISTRY.find(p => p.id === id);
}

// ── Normalised types ─────────────────────────────────────────────
// Used by routes/scheduler regardless of provider

export interface NormalisedRepo {
  html_url: string;
  full_name: string;
  name: string;
  description: string;
  language: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  visibility: string;
  default_branch: string;
  pushed_at: string;
  private: boolean;
}

export interface NormalisedContributor {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
}

export interface NormalisedRelease {
  tag_name: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string;
  target_commitish: string;
  html_url: string;
}

export interface NormalisedTag {
  name: string;
  commit: { sha: string };
}

export interface NormalisedUser {
  id: number;
  login: string;
  avatar_url: string;
}

// ── Detection ────────────────────────────────────────────────────

/** Detect provider from a repository URL hostname */
export function detectProvider(repoUrl: string): RepoProvider | null {
  if (!repoUrl) return null;
  try {
    const url = new URL(repoUrl.includes('://') ? repoUrl : `https://${repoUrl}`);
    if (url.hostname === 'github.com') return 'github';
    if (url.hostname === 'codeberg.org') return 'codeberg';
    return null;
  } catch {
    return null;
  }
}

// ── Dispatchers ──────────────────────────────────────────────────

export function parseRepoUrl(provider: RepoProvider, url: string): { owner: string; repo: string } | null {
  switch (provider) {
    case 'github': return github.parseRepoUrl(url);
    case 'codeberg': return codeberg.parseRepoUrl(url);
  }
}

export async function getRepo(provider: RepoProvider, token: string, owner: string, repo: string): Promise<NormalisedRepo> {
  switch (provider) {
    case 'github': {
      const r = await github.getRepo(token, owner, repo);
      return {
        html_url: r.html_url,
        full_name: r.full_name,
        name: r.name,
        description: r.description || '',
        language: r.language || '',
        stargazers_count: r.stargazers_count,
        forks_count: r.forks_count,
        open_issues_count: r.open_issues_count,
        visibility: r.visibility,
        default_branch: r.default_branch,
        pushed_at: r.pushed_at,
        private: r.private,
      };
    }
    case 'codeberg': {
      const r = await codeberg.getRepo(token, owner, repo);
      return {
        html_url: r.html_url,
        full_name: r.full_name,
        name: r.name,
        description: r.description || '',
        language: r.language || '',
        stargazers_count: r.stars_count,
        forks_count: r.forks_count,
        open_issues_count: r.open_issues_count,
        visibility: r.private ? 'private' : 'public',
        default_branch: r.default_branch,
        pushed_at: r.updated_at,
        private: r.private,
      };
    }
  }
}

export async function getContributors(provider: RepoProvider, token: string, owner: string, repo: string): Promise<NormalisedContributor[]> {
  switch (provider) {
    case 'github': return github.getContributors(token, owner, repo);
    case 'codeberg': return codeberg.getContributors(token, owner, repo);
  }
}

export async function getLanguages(provider: RepoProvider, token: string, owner: string, repo: string): Promise<Record<string, number>> {
  switch (provider) {
    case 'github': return github.getLanguages(token, owner, repo);
    case 'codeberg': return codeberg.getLanguages(token, owner, repo);
  }
}

/** Fetch raw file content from a repo. Returns null if file not found (404). */
export async function getFileContent(
  provider: RepoProvider | string, token: string, owner: string, repo: string, branch: string, filepath: string,
  instanceUrl?: string
): Promise<string | null> {
  if (provider === 'github') return github.getFileContent(token, owner, repo, branch, filepath);
  if (provider === 'codeberg') return codeberg.getRawFile(token, owner, repo, branch, filepath);
  // Self-hosted Gitea/Forgejo — use Gitea API
  if (provider === 'gitea' || provider === 'forgejo') {
    if (!instanceUrl) return null;
    const apiBase = `${instanceUrl}/api/v1`;
    const url = `${apiBase}/repos/${owner}/${repo}/raw/${encodeURIComponent(filepath)}?ref=${encodeURIComponent(branch)}`;
    try {
      const res = await fetch(url, { headers: { Authorization: `token ${token}` } });
      if (!res.ok) return null;
      return await res.text();
    } catch { return null; }
  }
  // GitLab self-hosted
  if (provider === 'gitlab') {
    if (!instanceUrl) return null;
    const projectId = encodeURIComponent(`${owner}/${repo}`);
    const url = `${instanceUrl}/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(filepath)}/raw?ref=${encodeURIComponent(branch)}`;
    try {
      const res = await fetch(url, { headers: { 'PRIVATE-TOKEN': token } });
      if (!res.ok) return null;
      return await res.text();
    } catch { return null; }
  }
  return null;
}

export async function getSBOM(provider: RepoProvider, token: string, owner: string, repo: string): Promise<any | null> {
  switch (provider) {
    case 'github': return github.getSBOM(token, owner, repo);
    case 'codeberg': return null; // Codeberg has no SBOM API
  }
}

export async function getReleases(provider: RepoProvider, token: string, owner: string, repo: string): Promise<NormalisedRelease[]> {
  switch (provider) {
    case 'github': return github.getReleases(token, owner, repo);
    case 'codeberg': {
      const releases = await codeberg.getReleases(token, owner, repo);
      return releases.map(r => ({
        tag_name: r.tag_name,
        name: r.name || r.tag_name,
        body: r.body || '',
        draft: r.draft,
        prerelease: r.prerelease,
        published_at: r.published_at,
        target_commitish: r.target_commitish || '',
        html_url: r.html_url,
      }));
    }
  }
}

export async function getTags(provider: RepoProvider, token: string, owner: string, repo: string): Promise<NormalisedTag[]> {
  switch (provider) {
    case 'github': {
      const tags = await github.getTags(token, owner, repo);
      return tags.map(t => ({ name: t.name, commit: { sha: t.commit.sha } }));
    }
    case 'codeberg': {
      const tags = await codeberg.getTags(token, owner, repo);
      return tags.map(t => ({ name: t.name, commit: { sha: t.commit.sha } }));
    }
  }
}

export async function exchangeCodeForToken(
  provider: RepoProvider,
  code: string,
  redirectUri: string
): Promise<{ access_token: string; token_type: string; scope: string }> {
  switch (provider) {
    case 'github': return github.exchangeCodeForToken(code);
    case 'codeberg': return codeberg.exchangeCodeForToken(code, redirectUri);
  }
}

export async function getAuthenticatedUser(provider: RepoProvider, token: string): Promise<NormalisedUser> {
  switch (provider) {
    case 'github': {
      const u = await github.getAuthenticatedUser(token);
      return { id: u.id, login: u.login, avatar_url: u.avatar_url };
    }
    case 'codeberg': {
      const u = await codeberg.getAuthenticatedUser(token);
      return { id: u.id, login: u.login, avatar_url: u.avatar_url };
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// FILE TREE LISTING — needed for Tier 3 import scanning
// ══════════════════════════════════════════════════════════════════

const MAX_TREE_FILES = 5000;

/** List all files in a repo (recursive). Returns flat array of file paths. */
export async function listRepoFiles(
  provider: RepoProvider | string,
  token: string,
  owner: string,
  repo: string,
  branch: string,
  instanceUrl?: string
): Promise<string[]> {
  try {
    if (provider === 'github') {
      return await listGitHubFiles(token, owner, repo, branch);
    }
    if (provider === 'codeberg' || provider === 'gitea' || provider === 'forgejo') {
      const apiBase = provider === 'codeberg'
        ? 'https://codeberg.org/api/v1'
        : instanceUrl ? `${instanceUrl}/api/v1` : null;
      if (!apiBase) return [];
      return await listGiteaFiles(apiBase, token, owner, repo, branch);
    }
    if (provider === 'gitlab') {
      const apiBase = instanceUrl ? `${instanceUrl}/api/v4` : null;
      if (!apiBase) return [];
      return await listGitLabFiles(apiBase, token, owner, repo, branch);
    }
    return [];
  } catch (err: any) {
    console.error(`[REPO-PROVIDER] listRepoFiles failed for ${provider}/${owner}/${repo}: ${err.message}`);
    return [];
  }
}

async function listGitHubFiles(token: string, owner: string, repo: string, branch: string): Promise<string[]> {
  // GitHub: GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1
  const data = await github.githubGet<{ tree: Array<{ path: string; type: string }> }>(
    `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    token
  );
  return (data.tree || [])
    .filter(item => item.type === 'blob')
    .slice(0, MAX_TREE_FILES)
    .map(item => item.path);
}

async function listGiteaFiles(apiBase: string, token: string, owner: string, repo: string, branch: string): Promise<string[]> {
  // Gitea/Codeberg/Forgejo: GET /api/v1/repos/{owner}/{repo}/git/trees/{branch}?recursive=true&per_page=0
  const url = `${apiBase}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=true&per_page=0`;
  const res = await fetch(url, {
    headers: { Authorization: `token ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    console.error(`[REPO-PROVIDER] Gitea tree API ${res.status}: ${res.statusText}`);
    return [];
  }
  const data = await res.json() as { tree?: Array<{ path: string; type: string }> };
  return (data.tree || [])
    .filter((item: any) => item.type === 'blob')
    .slice(0, MAX_TREE_FILES)
    .map((item: any) => item.path);
}

async function listGitLabFiles(apiBase: string, token: string, owner: string, repo: string, branch: string): Promise<string[]> {
  // GitLab: GET /api/v4/projects/{id}/repository/tree?recursive=true&per_page=100
  // Project ID = owner%2Frepo (URL-encoded)
  const projectId = encodeURIComponent(`${owner}/${repo}`);
  const files: string[] = [];
  let page = 1;
  while (files.length < MAX_TREE_FILES) {
    const url = `${apiBase}/projects/${projectId}/repository/tree?recursive=true&per_page=100&page=${page}&ref=${encodeURIComponent(branch)}`;
    const res = await fetch(url, {
      headers: { 'PRIVATE-TOKEN': token, Accept: 'application/json' },
    });
    if (!res.ok) break;
    const items = await res.json() as Array<{ path: string; type: string }>;
    if (!items.length) break;
    for (const item of items) {
      if (item.type === 'blob' && files.length < MAX_TREE_FILES) {
        files.push(item.path);
      }
    }
    page++;
    if (items.length < 100) break;
  }
  return files;
}

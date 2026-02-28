// Provider dispatcher — thin dispatch layer (no abstract classes, just functions)
// Routes provider-specific calls to github.ts or codeberg.ts (+ self-hosted APIs)
// PROVIDER_REGISTRY: data-driven provider configuration

import * as github from './github.js';
import * as codeberg from './codeberg.js';

export type RepoProvider = 'github' | 'codeberg' | 'gitea' | 'forgejo' | 'gitlab';

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

/** Parse owner/repo from any Git hosting URL (works for all providers) */
export function parseRepoUrlGeneric(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url.includes('://') ? url : `https://${url}`);
    const parts = u.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/').filter(Boolean);
    if (parts.length >= 2) return { owner: parts[0], repo: parts[1] };
    return null;
  } catch { return null; }
}

/**
 * Detect provider from a repository URL hostname.
 * For cloud providers, matches by hostname. For self-hosted, checks
 * a map of known instanceUrl → provider from the user's connections.
 */
export function detectProvider(
  repoUrl: string,
  knownInstances?: Map<string, RepoProvider>
): RepoProvider | null {
  if (!repoUrl) return null;
  try {
    const url = new URL(repoUrl.includes('://') ? repoUrl : `https://${repoUrl}`);
    if (url.hostname === 'github.com') return 'github';
    if (url.hostname === 'codeberg.org') return 'codeberg';

    // Check self-hosted instances
    if (knownInstances) {
      for (const [instanceUrl, prov] of knownInstances) {
        try {
          if (new URL(instanceUrl).hostname === url.hostname) return prov;
        } catch { /* skip malformed instance_url */ }
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ── PAT validation ───────────────────────────────────────────────

/**
 * Validate a Personal Access Token by calling the provider's /user endpoint.
 * Returns normalised user info on success, throws on failure.
 */
export async function validatePAT(
  prov: RepoProvider,
  token: string,
  instanceUrl: string
): Promise<NormalisedUser> {
  const config = getProviderConfig(prov);
  if (!config) throw new Error(`Unknown provider: ${prov}`);
  const headers = config.authHeader(token);

  if (prov === 'gitlab') {
    const res = await fetch(`${instanceUrl}/api/v4/user`, {
      headers: { ...headers, Accept: 'application/json' },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitLab PAT validation failed (${res.status}): ${body}`);
    }
    const u = await res.json() as any;
    return { id: u.id, login: u.username, avatar_url: u.avatar_url || '' };
  } else {
    // Gitea / Forgejo: GET /api/v1/user
    const res = await fetch(`${instanceUrl}/api/v1/user`, {
      headers: { ...headers, Accept: 'application/json' },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${prov} PAT validation failed (${res.status}): ${body}`);
    }
    const u = await res.json() as any;
    return { id: u.id, login: u.login || u.username, avatar_url: u.avatar_url || '' };
  }
}

// ── Gitea/Forgejo API helpers ────────────────────────────────────

async function giteaGet<T>(apiBase: string, path: string, token: string): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
    headers: { Authorization: `token ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gitea API ${res.status}: ${path} — ${body}`);
  }
  return res.json() as Promise<T>;
}

async function gitlabGet<T>(apiBase: string, path: string, token: string): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
    headers: { 'PRIVATE-TOKEN': token, Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitLab API ${res.status}: ${path} — ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── Dispatchers ──────────────────────────────────────────────────

export function parseRepoUrl(
  prov: RepoProvider,
  url: string
): { owner: string; repo: string } | null {
  switch (prov) {
    case 'github': return github.parseRepoUrl(url);
    case 'codeberg': return codeberg.parseRepoUrl(url);
    case 'gitea':
    case 'forgejo':
    case 'gitlab':
      return parseRepoUrlGeneric(url);
  }
}

export async function getRepo(
  prov: RepoProvider,
  token: string,
  owner: string,
  repo: string,
  instanceUrl?: string
): Promise<NormalisedRepo> {
  switch (prov) {
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
    case 'gitea':
    case 'forgejo': {
      if (!instanceUrl) throw new Error(`${prov} requires instanceUrl`);
      const apiBase = `${instanceUrl}/api/v1`;
      const r = await giteaGet<any>(apiBase, `/repos/${owner}/${repo}`, token);
      return {
        html_url: r.html_url,
        full_name: r.full_name,
        name: r.name,
        description: r.description || '',
        language: r.language || '',
        stargazers_count: r.stars_count || 0,
        forks_count: r.forks_count || 0,
        open_issues_count: r.open_issues_count || 0,
        visibility: r.private ? 'private' : 'public',
        default_branch: r.default_branch,
        pushed_at: r.updated_at,
        private: r.private,
      };
    }
    case 'gitlab': {
      if (!instanceUrl) throw new Error('gitlab requires instanceUrl');
      const apiBase = `${instanceUrl}/api/v4`;
      const projectId = encodeURIComponent(`${owner}/${repo}`);
      const r = await gitlabGet<any>(apiBase, `/projects/${projectId}`, token);
      return {
        html_url: r.web_url,
        full_name: r.path_with_namespace,
        name: r.name,
        description: r.description || '',
        language: '',  // GitLab doesn't include in project endpoint
        stargazers_count: r.star_count || 0,
        forks_count: r.forks_count || 0,
        open_issues_count: r.open_issues_count || 0,
        visibility: r.visibility || 'private',
        default_branch: r.default_branch || 'main',
        pushed_at: r.last_activity_at || r.updated_at || '',
        private: r.visibility === 'private',
      };
    }
  }
}

export async function getContributors(
  prov: RepoProvider,
  token: string,
  owner: string,
  repo: string,
  instanceUrl?: string
): Promise<NormalisedContributor[]> {
  switch (prov) {
    case 'github': return github.getContributors(token, owner, repo);
    case 'codeberg': return codeberg.getContributors(token, owner, repo);
    case 'gitea':
    case 'forgejo': {
      if (!instanceUrl) return [];
      const apiBase = `${instanceUrl}/api/v1`;
      try {
        const contributors = await giteaGet<any[]>(apiBase, `/repos/${owner}/${repo}/contributors`, token);
        return contributors.map((c: any) => ({
          id: c.id,
          login: c.login || c.username || '',
          avatar_url: c.avatar_url || '',
          html_url: c.html_url || `${instanceUrl}/${c.login || c.username}`,
          contributions: c.contributions || 0,
        }));
      } catch { return []; }
    }
    case 'gitlab': {
      if (!instanceUrl) return [];
      const apiBase = `${instanceUrl}/api/v4`;
      const projectId = encodeURIComponent(`${owner}/${repo}`);
      try {
        const members = await gitlabGet<any[]>(apiBase, `/projects/${projectId}/members/all?per_page=100`, token);
        return members.map((m: any) => ({
          id: m.id,
          login: m.username,
          avatar_url: m.avatar_url || '',
          html_url: `${instanceUrl}/${m.username}`,
          contributions: 0,  // GitLab members API doesn't include commit counts
        }));
      } catch { return []; }
    }
  }
}

export async function getLanguages(
  prov: RepoProvider,
  token: string,
  owner: string,
  repo: string,
  instanceUrl?: string
): Promise<Record<string, number>> {
  switch (prov) {
    case 'github': return github.getLanguages(token, owner, repo);
    case 'codeberg': return codeberg.getLanguages(token, owner, repo);
    case 'gitea':
    case 'forgejo': {
      if (!instanceUrl) return {};
      const apiBase = `${instanceUrl}/api/v1`;
      try {
        return await giteaGet<Record<string, number>>(apiBase, `/repos/${owner}/${repo}/languages`, token);
      } catch { return {}; }
    }
    case 'gitlab': {
      if (!instanceUrl) return {};
      const apiBase = `${instanceUrl}/api/v4`;
      const projectId = encodeURIComponent(`${owner}/${repo}`);
      try {
        // GitLab returns { "TypeScript": 45.2, "JavaScript": 30.1 } as percentages
        const langs = await gitlabGet<Record<string, number>>(apiBase, `/projects/${projectId}/languages`, token);
        // Convert percentages to approximate bytes (use 1000 as base)
        const result: Record<string, number> = {};
        for (const [lang, pct] of Object.entries(langs)) {
          result[lang] = Math.round(pct * 1000);
        }
        return result;
      } catch { return {}; }
    }
  }
}

/** Fetch raw file content from a repo. Returns null if file not found (404). */
export async function getFileContent(
  prov: RepoProvider | string,
  token: string,
  owner: string,
  repo: string,
  branch: string,
  filepath: string,
  instanceUrl?: string
): Promise<string | null> {
  if (prov === 'github') return github.getFileContent(token, owner, repo, branch, filepath);
  if (prov === 'codeberg') return codeberg.getRawFile(token, owner, repo, branch, filepath);
  // Self-hosted Gitea/Forgejo — use Gitea API
  if (prov === 'gitea' || prov === 'forgejo') {
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
  if (prov === 'gitlab') {
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

export async function getSBOM(
  prov: RepoProvider,
  token: string,
  owner: string,
  repo: string
): Promise<any | null> {
  switch (prov) {
    case 'github': return github.getSBOM(token, owner, repo);
    case 'codeberg': return null;
    case 'gitea':
    case 'forgejo':
    case 'gitlab':
      return null;  // No SBOM API for self-hosted providers
  }
}

export async function getReleases(
  prov: RepoProvider,
  token: string,
  owner: string,
  repo: string,
  instanceUrl?: string
): Promise<NormalisedRelease[]> {
  switch (prov) {
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
    case 'gitea':
    case 'forgejo': {
      if (!instanceUrl) return [];
      const apiBase = `${instanceUrl}/api/v1`;
      try {
        const releases = await giteaGet<any[]>(apiBase, `/repos/${owner}/${repo}/releases?limit=100`, token);
        return releases.map((r: any) => ({
          tag_name: r.tag_name,
          name: r.name || r.tag_name,
          body: r.body || '',
          draft: r.draft,
          prerelease: r.prerelease,
          published_at: r.published_at || r.created_at,
          target_commitish: r.target_commitish || '',
          html_url: r.html_url || `${instanceUrl}/${owner}/${repo}/releases/tag/${r.tag_name}`,
        }));
      } catch { return []; }
    }
    case 'gitlab': {
      if (!instanceUrl) return [];
      const apiBase = `${instanceUrl}/api/v4`;
      const projectId = encodeURIComponent(`${owner}/${repo}`);
      try {
        const releases = await gitlabGet<any[]>(apiBase, `/projects/${projectId}/releases?per_page=100`, token);
        return releases.map((r: any) => ({
          tag_name: r.tag_name,
          name: r.name || r.tag_name,
          body: r.description || '',
          draft: false,
          prerelease: false,
          published_at: r.released_at || r.created_at,
          target_commitish: r.commit?.id || '',
          html_url: r._links?.self || `${instanceUrl}/${owner}/${repo}/-/releases/${r.tag_name}`,
        }));
      } catch { return []; }
    }
  }
}

export async function getTags(
  prov: RepoProvider,
  token: string,
  owner: string,
  repo: string,
  instanceUrl?: string
): Promise<NormalisedTag[]> {
  switch (prov) {
    case 'github': {
      const tags = await github.getTags(token, owner, repo);
      return tags.map(t => ({ name: t.name, commit: { sha: t.commit.sha } }));
    }
    case 'codeberg': {
      const tags = await codeberg.getTags(token, owner, repo);
      return tags.map(t => ({ name: t.name, commit: { sha: t.commit.sha } }));
    }
    case 'gitea':
    case 'forgejo': {
      if (!instanceUrl) return [];
      const apiBase = `${instanceUrl}/api/v1`;
      try {
        const tags = await giteaGet<any[]>(apiBase, `/repos/${owner}/${repo}/tags?limit=100`, token);
        return tags.map((t: any) => ({
          name: t.name,
          commit: { sha: t.id || t.commit?.sha || '' },
        }));
      } catch { return []; }
    }
    case 'gitlab': {
      if (!instanceUrl) return [];
      const apiBase = `${instanceUrl}/api/v4`;
      const projectId = encodeURIComponent(`${owner}/${repo}`);
      try {
        const tags = await gitlabGet<any[]>(apiBase, `/projects/${projectId}/repository/tags?per_page=100`, token);
        return tags.map((t: any) => ({
          name: t.name,
          commit: { sha: t.commit?.id || '' },
        }));
      } catch { return []; }
    }
  }
}

export async function exchangeCodeForToken(
  prov: RepoProvider,
  code: string,
  redirectUri: string
): Promise<{ access_token: string; token_type: string; scope: string }> {
  switch (prov) {
    case 'github': return github.exchangeCodeForToken(code);
    case 'codeberg': return codeberg.exchangeCodeForToken(code, redirectUri);
    case 'gitea':
    case 'forgejo':
    case 'gitlab':
      throw new Error(`${prov} uses PAT authentication, not OAuth code exchange`);
  }
}

export async function getAuthenticatedUser(
  prov: RepoProvider,
  token: string,
  instanceUrl?: string
): Promise<NormalisedUser> {
  switch (prov) {
    case 'github': {
      const u = await github.getAuthenticatedUser(token);
      return { id: u.id, login: u.login, avatar_url: u.avatar_url };
    }
    case 'codeberg': {
      const u = await codeberg.getAuthenticatedUser(token);
      return { id: u.id, login: u.login, avatar_url: u.avatar_url };
    }
    case 'gitea':
    case 'forgejo':
    case 'gitlab': {
      if (!instanceUrl) throw new Error(`${prov} requires instanceUrl`);
      return validatePAT(prov, token, instanceUrl);
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// FILE TREE LISTING — needed for Tier 3 import scanning
// ══════════════════════════════════════════════════════════════════

const MAX_TREE_FILES = 5000;

/** List all files in a repo (recursive). Returns flat array of file paths. */
export async function listRepoFiles(
  prov: RepoProvider | string,
  token: string,
  owner: string,
  repo: string,
  branch: string,
  instanceUrl?: string
): Promise<string[]> {
  try {
    if (prov === 'github') {
      return await listGitHubFiles(token, owner, repo, branch);
    }
    if (prov === 'codeberg' || prov === 'gitea' || prov === 'forgejo') {
      const apiBase = prov === 'codeberg'
        ? 'https://codeberg.org/api/v1'
        : instanceUrl ? `${instanceUrl}/api/v1` : null;
      if (!apiBase) return [];
      return await listGiteaFiles(apiBase, token, owner, repo, branch);
    }
    if (prov === 'gitlab') {
      const apiBase = instanceUrl ? `${instanceUrl}/api/v4` : null;
      if (!apiBase) return [];
      return await listGitLabFiles(apiBase, token, owner, repo, branch);
    }
    return [];
  } catch (err: any) {
    console.error(`[REPO-PROVIDER] listRepoFiles failed for ${prov}/${owner}/${repo}: ${err.message}`);
    return [];
  }
}

async function listGitHubFiles(token: string, owner: string, repo: string, branch: string): Promise<string[]> {
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

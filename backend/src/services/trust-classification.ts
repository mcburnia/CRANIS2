/**
 * Trust Classification Service
 *
 * Evaluates whether an organisation qualifies for free open-source or
 * non-profit access based on repository metadata and behavioural signals.
 *
 * Progressive trust model:
 *   commercial → provisional_open_source → trusted_open_source
 *   commercial → community_project
 *   commercial → verified_nonprofit (via separate application workflow)
 *   * → review_required (if commercial signals detected)
 *
 * CRA context: open_source_steward role shares manufacturer obligations
 */

import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';

// ─── Types ────────────────────────────────────────────────────

export type TrustClassification =
  | 'commercial'
  | 'provisional_open_source'
  | 'trusted_open_source'
  | 'community_project'
  | 'verified_nonprofit'
  | 'review_required';

export interface TrustEvaluation {
  classification: TrustClassification;
  trustScore: number;
  commercialSignalScore: number;
  reasons: string[];
  repoStats: {
    totalRepos: number;
    publicRepos: number;
    privateRepos: number;
    totalStars: number;
    totalForks: number;
    totalContributors: number;
    hasReleases: boolean;
    recentCommits: boolean;
    licences: string[];
    osiLicenceCount: number;
  };
}

// ─── OSI-approved licences (SPDX identifiers) ────────────────

export const OSI_APPROVED_LICENCES = new Set([
  // Permissive
  'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'Zlib',
  'Unlicense', '0BSD', 'BlueOak-1.0.0',
  // Weak copyleft
  'MPL-2.0', 'LGPL-2.0', 'LGPL-2.1', 'LGPL-3.0', 'EPL-1.0', 'EPL-2.0',
  'CDDL-1.0', 'CDDL-1.1',
  // Strong copyleft
  'GPL-2.0', 'GPL-3.0', 'AGPL-3.0', 'EUPL-1.1', 'EUPL-1.2',
  'OSL-3.0', 'CPAL-1.0',
  // Other OSI-approved
  'Artistic-2.0', 'BSL-1.0', 'PostgreSQL', 'NCSA', 'MulanPSL-2.0',
  'UPL-1.0', 'Zlib', 'ECL-2.0', 'AAL',
  // Common variants
  'MIT-0', 'Apache-1.1', 'BSD-1-Clause',
  'GPL-2.0-only', 'GPL-2.0-or-later', 'GPL-3.0-only', 'GPL-3.0-or-later',
  'LGPL-2.0-only', 'LGPL-2.0-or-later', 'LGPL-2.1-only', 'LGPL-2.1-or-later',
  'LGPL-3.0-only', 'LGPL-3.0-or-later',
  'AGPL-3.0-only', 'AGPL-3.0-or-later',
  'MPL-2.0-no-copyleft-exception',
]);

function isOsiApproved(licence: string | null): boolean {
  if (!licence || licence === 'NOASSERTION') return false;
  // Try exact match first
  if (OSI_APPROVED_LICENCES.has(licence)) return true;
  // Try without -only/-or-later suffix
  const normalised = licence.replace(/-only$|-or-later$/, '');
  return OSI_APPROVED_LICENCES.has(normalised);
}

// ─── Configurable thresholds ──────────────────────────────────

const TRUST_SCORE_THRESHOLD = 35;           // Points needed for trusted_open_source
const COMMUNITY_MAX_CONTRIBUTORS = 3;       // Max contributors for community_project
const COMMERCIAL_SIGNAL_THRESHOLD = 30;     // Points that trigger review_required
const PROVISIONAL_DURATION_DAYS = 45;       // Days before promotion evaluation

// ─── Trust score computation ──────────────────────────────────

interface RepoData {
  stars: number;
  forks: number;
  openIssues: number;
  isPrivate: boolean;
  lastPush: string | null;
}

function computeTrustScore(repos: RepoData[], contributorCount: number, hasReleases: boolean): number {
  let score = 0;

  // Contributor signals
  if (contributorCount >= 2) score += 10;
  if (contributorCount >= 5) score += 10;  // cumulative: 20
  if (contributorCount >= 10) score += 5;  // cumulative: 25

  // Repository signals (aggregate across all repos)
  const totalForks = repos.reduce((s, r) => s + (r.forks || 0), 0);
  const totalStars = repos.reduce((s, r) => s + (r.stars || 0), 0);

  if (totalForks >= 5) score += 5;
  if (totalForks >= 10) score += 5;   // cumulative: 10
  if (totalStars >= 10) score += 5;
  if (totalStars >= 20) score += 5;   // cumulative: 10

  // Activity signals
  if (hasReleases) score += 5;

  const now = new Date();
  const recentCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days
  const hasRecentCommits = repos.some(r => r.lastPush && new Date(r.lastPush) > recentCutoff);
  if (hasRecentCommits) score += 5;

  // Issue tracker activity (proxy for community engagement)
  const totalIssues = repos.reduce((s, r) => s + (r.openIssues || 0), 0);
  if (totalIssues > 0) score += 5;

  return score;
}

// ─── Commercial signal detection ──────────────────────────────

function computeCommercialSignalScore(
  repos: RepoData[],
  licences: string[],
  hasPrivateRepos: boolean,
): number {
  let score = 0;

  // Private repositories are a strong commercial signal
  if (hasPrivateRepos) score += 40;

  // Non-OSI licence detected
  const nonOsiCount = licences.filter(l => l && l !== 'NOASSERTION' && !isOsiApproved(l)).length;
  if (nonOsiCount > 0) score += 20;

  // No licence at all on any repo (suspicious for claiming open source)
  const noLicenceCount = licences.filter(l => !l || l === 'NOASSERTION').length;
  if (noLicenceCount > 0 && noLicenceCount === licences.length) score += 15;

  return Math.min(score, 100);
}

// ─── Main evaluation function ─────────────────────────────────

export async function evaluateOrganisation(orgId: string): Promise<TrustEvaluation> {
  const reasons: string[] = [];

  // 1. Fetch repos from Neo4j
  const neo4jSession = getDriver().session();
  let repos: RepoData[] = [];
  let contributorCount = 0;
  let repoLicences: string[] = [];
  let hasReleases = false;

  try {
    // Get all repositories for this org's products
    const repoResult = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product)-[:HAS_REPO]->(r:Repository)
       RETURN r.stars AS stars, r.forks AS forks, r.openIssues AS openIssues,
              r.isPrivate AS isPrivate, r.lastPush AS lastPush`,
      { orgId }
    );
    repos = repoResult.records.map(r => ({
      stars: r.get('stars')?.toNumber?.() ?? r.get('stars') ?? 0,
      forks: r.get('forks')?.toNumber?.() ?? r.get('forks') ?? 0,
      openIssues: r.get('openIssues')?.toNumber?.() ?? r.get('openIssues') ?? 0,
      isPrivate: r.get('isPrivate') ?? false,
      lastPush: r.get('lastPush')?.toString() ?? null,
    }));

    // Get contributor count across all products
    const contribResult = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product)-[:HAS_CONTRIBUTOR]->(c:Contributor)
       WHERE NOT c.isBot
       RETURN count(DISTINCT c) AS cnt`,
      { orgId }
    );
    contributorCount = contribResult.records[0]?.get('cnt')?.toNumber?.() ?? 0;

    // Get licences from dependencies
    const licenceResult = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product)-[:DEPENDS_ON]->(d:Dependency)
       WHERE d.license IS NOT NULL AND d.license <> ''
       RETURN DISTINCT d.license AS licence`,
      { orgId }
    );
    repoLicences = licenceResult.records.map(r => r.get('licence'));

    // Check for releases (via version history or tags)
    const releaseResult = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product)
       WHERE p.version IS NOT NULL AND p.version <> ''
       RETURN count(p) AS cnt`,
      { orgId }
    );
    hasReleases = (releaseResult.records[0]?.get('cnt')?.toNumber?.() ?? 0) > 0;
  } finally {
    await neo4jSession.close();
  }

  // 2. Compute scores
  const totalRepos = repos.length;
  const publicRepos = repos.filter(r => !r.isPrivate).length;
  const privateRepos = repos.filter(r => r.isPrivate).length;
  const totalStars = repos.reduce((s, r) => s + r.stars, 0);
  const totalForks = repos.reduce((s, r) => s + r.forks, 0);
  const osiCount = repoLicences.filter(l => isOsiApproved(l)).length;

  const recentCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const recentCommits = repos.some(r => r.lastPush && new Date(r.lastPush) > recentCutoff);

  const trustScore = computeTrustScore(repos, contributorCount, hasReleases);
  const commercialSignalScore = computeCommercialSignalScore(repos, repoLicences, privateRepos > 0);

  const repoStats = {
    totalRepos, publicRepos, privateRepos,
    totalStars, totalForks, totalContributors: contributorCount,
    hasReleases, recentCommits: recentCommits,
    licences: [...new Set(repoLicences)],
    osiLicenceCount: osiCount,
  };

  // 3. Determine classification
  let classification: TrustClassification = 'commercial';

  // Check for commercial signals first (takes priority)
  if (commercialSignalScore >= COMMERCIAL_SIGNAL_THRESHOLD) {
    classification = 'review_required';
    reasons.push(`Commercial signal score (${commercialSignalScore}) exceeds threshold (${COMMERCIAL_SIGNAL_THRESHOLD})`);
  }
  // Private repos → always commercial
  else if (privateRepos > 0) {
    classification = 'commercial';
    reasons.push(`Organisation has ${privateRepos} private repository/ies`);
  }
  // No repos → commercial (nothing to evaluate)
  else if (totalRepos === 0) {
    classification = 'commercial';
    reasons.push('No connected repositories to evaluate');
  }
  // All public + OSI licences detected → eligible for open source
  else if (publicRepos > 0 && osiCount > 0) {
    if (trustScore >= TRUST_SCORE_THRESHOLD) {
      classification = 'trusted_open_source';
      reasons.push(`Trust score (${trustScore}) exceeds threshold (${TRUST_SCORE_THRESHOLD})`);
      reasons.push(`${publicRepos} public repos, ${osiCount} OSI-licensed dependencies, ${contributorCount} contributors`);
    } else if (contributorCount <= COMMUNITY_MAX_CONTRIBUTORS && totalStars < 20) {
      classification = 'community_project';
      reasons.push(`Small community project: ${contributorCount} contributors, ${totalStars} stars`);
    } else {
      classification = 'provisional_open_source';
      reasons.push(`Eligible for provisional open source (trust score: ${trustScore}, threshold: ${TRUST_SCORE_THRESHOLD})`);
      reasons.push('Provisional period allows behavioural evaluation before permanent classification');
    }
  }
  // Public repos but no OSI licence
  else if (publicRepos > 0 && osiCount === 0) {
    classification = 'commercial';
    reasons.push('Public repositories but no OSI-approved licences detected');
  }

  return {
    classification,
    trustScore,
    commercialSignalScore,
    reasons,
    repoStats,
  };
}

// ─── Apply evaluation result to org_billing ───────────────────

export async function applyClassification(
  orgId: string,
  evaluation: TrustEvaluation,
  source: 'automatic' | 'manual' = 'automatic'
): Promise<void> {
  const provisionalExpiry = evaluation.classification === 'provisional_open_source'
    ? new Date(Date.now() + PROVISIONAL_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString()
    : null;

  await pool.query(
    `UPDATE org_billing SET
       trust_classification = $1,
       trust_score = $2,
       commercial_signal_score = $3,
       classification_last_review = NOW(),
       classification_source = $4,
       provisional_expires_at = $5,
       updated_at = NOW()
     WHERE org_id = $6`,
    [
      evaluation.classification,
      evaluation.trustScore,
      evaluation.commercialSignalScore,
      source,
      provisionalExpiry,
      orgId,
    ]
  );
}

// ─── Get current classification ───────────────────────────────

export async function getClassification(orgId: string): Promise<{
  trust_classification: TrustClassification;
  trust_score: number;
  commercial_signal_score: number;
  classification_last_review: string | null;
  classification_source: string;
  provisional_expires_at: string | null;
} | null> {
  const result = await pool.query(
    `SELECT trust_classification, trust_score, commercial_signal_score,
            classification_last_review, classification_source, provisional_expires_at
     FROM org_billing WHERE org_id = $1`,
    [orgId]
  );
  return result.rows[0] || null;
}

// ─── Admin: manually set classification ───────────────────────

export async function setClassificationManually(
  orgId: string,
  classification: TrustClassification,
  reason: string
): Promise<void> {
  await pool.query(
    `UPDATE org_billing SET
       trust_classification = $1,
       classification_last_review = NOW(),
       classification_source = 'manual',
       updated_at = NOW()
     WHERE org_id = $2`,
    [classification, orgId]
  );
}

// ─── Check if classification grants free access ───────────────

export function isFreeClassification(classification: TrustClassification): boolean {
  return [
    'provisional_open_source',
    'trusted_open_source',
    'community_project',
    'verified_nonprofit',
  ].includes(classification);
}

export { TRUST_SCORE_THRESHOLD, COMMERCIAL_SIGNAL_THRESHOLD, PROVISIONAL_DURATION_DAYS };

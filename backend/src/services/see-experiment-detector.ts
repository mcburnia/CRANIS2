/**
 * SEE Experiment Detector — Phase D
 *
 * Analyses commit and branch data to identify engineering experimentation
 * patterns. These patterns indicate technological uncertainty — the core
 * requirement for R&D tax credit eligibility.
 *
 * All detection is deterministic. No AI.
 */

import pool from '../db/pool.js';
import { logger } from '../utils/logger.js';

// ─── Types ──────────────────────────────────────────────────────────

export type ExperimentType =
  | 'repeated_implementation'
  | 'algorithm_replacement'
  | 'prototype_branch'
  | 'dependency_switching'
  | 'refactoring_wave'
  | 'architecture_change'
  | 'rapid_iteration';

export interface Experiment {
  id?: string;
  experimentType: ExperimentType;
  title: string;
  description: string;
  evidenceCommits: string[]; // SHA references
  startDate: string | null;
  endDate: string | null;
  uncertaintyIndicator: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ExperimentDetectionResult {
  productId: string;
  experiments: Experiment[];
  uncertaintySummary: {
    totalExperiments: number;
    byType: Record<ExperimentType, number>;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
  };
}

// ─── Detection Functions ────────────────────────────────────────────

/**
 * Detect refactoring waves — clusters of refactor-classified commits
 * within a short time window (7 days).
 */
async function detectRefactoringWaves(productId: string): Promise<Experiment[]> {
  const result = await pool.query(
    `SELECT sha, authored_at, message_summary
     FROM see_commits
     WHERE product_id = $1 AND classified_type = 'refactor'
     ORDER BY authored_at ASC`,
    [productId]
  );

  if (result.rows.length < 3) return [];

  const experiments: Experiment[] = [];
  let waveStart = 0;

  for (let i = 1; i < result.rows.length; i++) {
    const prevDate = new Date(result.rows[i - 1].authored_at);
    const currDate = new Date(result.rows[i].authored_at);
    const daysDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > 7) {
      // Check if the wave from waveStart to i-1 is significant (3+ commits)
      const waveLength = i - waveStart;
      if (waveLength >= 3) {
        const shas = result.rows.slice(waveStart, i).map((r: any) => r.sha);
        experiments.push({
          experimentType: 'refactoring_wave',
          title: `Refactoring wave: ${waveLength} restructuring commits`,
          description: `A cluster of ${waveLength} refactoring commits over ${Math.ceil(daysDiff)} days, indicating systematic code restructuring. First commit: "${result.rows[waveStart].message_summary}".`,
          evidenceCommits: shas,
          startDate: result.rows[waveStart].authored_at,
          endDate: result.rows[i - 1].authored_at,
          uncertaintyIndicator: 'Systematic restructuring indicates the original approach was reconsidered, suggesting technological uncertainty in the design.',
          confidence: waveLength >= 5 ? 'high' : 'medium',
        });
      }
      waveStart = i;
    }
  }

  // Check final wave
  const finalLength = result.rows.length - waveStart;
  if (finalLength >= 3) {
    const shas = result.rows.slice(waveStart).map((r: any) => r.sha);
    experiments.push({
      experimentType: 'refactoring_wave',
      title: `Refactoring wave: ${finalLength} restructuring commits`,
      description: `A cluster of ${finalLength} refactoring commits indicating systematic code restructuring.`,
      evidenceCommits: shas,
      startDate: result.rows[waveStart].authored_at,
      endDate: result.rows[result.rows.length - 1].authored_at,
      uncertaintyIndicator: 'Systematic restructuring indicates the original approach was reconsidered.',
      confidence: finalLength >= 5 ? 'high' : 'medium',
    });
  }

  return experiments;
}

/**
 * Detect prototype/experiment branches — branches with experiment-type
 * names that were created and either abandoned or partially merged.
 */
async function detectPrototypeBranches(productId: string): Promise<Experiment[]> {
  const result = await pool.query(
    `SELECT name, branch_type, created_at
     FROM see_branches
     WHERE product_id = $1 AND branch_type = 'experiment'`,
    [productId]
  );

  return result.rows.map((r: any) => ({
    experimentType: 'prototype_branch' as ExperimentType,
    title: `Experimental branch: ${r.name}`,
    description: `Branch "${r.name}" was created for experimental development, indicating a deliberate investigation of an alternative approach.`,
    evidenceCommits: [],
    startDate: r.created_at,
    endDate: null,
    uncertaintyIndicator: 'The creation of an experimental branch demonstrates that the engineering team was uncertain about the optimal approach and chose to investigate alternatives.',
    confidence: 'medium' as const,
  }));
}

/**
 * Detect rapid iteration — periods where the same files were modified
 * many times in quick succession (3+ commits to the same scope within 48 hours).
 */
async function detectRapidIteration(productId: string): Promise<Experiment[]> {
  // Look for commit message patterns suggesting iteration on the same topic
  const result = await pool.query(
    `SELECT
       DATE(authored_at) AS commit_date,
       COUNT(*) AS commit_count,
       array_agg(sha ORDER BY authored_at) AS shas,
       MIN(authored_at) AS first_commit,
       MAX(authored_at) AS last_commit,
       array_agg(DISTINCT classified_type) AS types
     FROM see_commits
     WHERE product_id = $1
     GROUP BY DATE(authored_at)
     HAVING COUNT(*) >= 5
     ORDER BY commit_date ASC`,
    [productId]
  );

  return result.rows.map((r: any) => ({
    experimentType: 'rapid_iteration' as ExperimentType,
    title: `Rapid iteration: ${r.commit_count} commits on ${new Date(r.commit_date).toLocaleDateString('en-GB')}`,
    description: `${r.commit_count} commits in a single day suggests intensive problem-solving, debugging, or iterative development. Commit types: ${(r.types || []).filter(Boolean).join(', ')}.`,
    evidenceCommits: (r.shas || []).slice(0, 10),
    startDate: r.first_commit,
    endDate: r.last_commit,
    uncertaintyIndicator: 'High commit frequency within a single day indicates the engineer was iterating through solutions, a hallmark of technological uncertainty.',
    confidence: (r.commit_count >= 10 ? 'high' : 'medium') as 'high' | 'medium',
  }));
}

/**
 * Detect high rewrite ratio periods — months where deletions exceeded
 * 50% of additions, indicating significant rework.
 */
async function detectHighRewritePeriods(productId: string): Promise<Experiment[]> {
  const result = await pool.query(
    `SELECT
       to_char(authored_at, 'YYYY-MM') AS month,
       SUM(additions) AS additions,
       SUM(deletions) AS deletions,
       COUNT(*) AS commit_count,
       array_agg(sha ORDER BY authored_at) AS shas
     FROM see_commits
     WHERE product_id = $1 AND additions > 0
     GROUP BY to_char(authored_at, 'YYYY-MM')
     HAVING SUM(deletions)::float / NULLIF(SUM(additions), 0) > 0.6
     ORDER BY month ASC`,
    [productId]
  );

  return result.rows.map((r: any) => {
    const adds = parseInt(r.additions) || 0;
    const dels = parseInt(r.deletions) || 0;
    const ratio = adds > 0 ? Math.round(dels / adds * 100) / 100 : 0;

    return {
      experimentType: 'algorithm_replacement' as ExperimentType,
      title: `High rewrite period: ${r.month} (${ratio}x rewrite ratio)`,
      description: `In ${r.month}, ${dels.toLocaleString()} lines were deleted against ${adds.toLocaleString()} additions across ${r.commit_count} commits. A rewrite ratio of ${ratio}x indicates substantial code replacement — approaches were tried and replaced.`,
      evidenceCommits: (r.shas || []).slice(0, 10),
      startDate: `${r.month}-01T00:00:00Z`,
      endDate: null,
      uncertaintyIndicator: 'A high rewrite ratio demonstrates that initial implementations were found inadequate and replaced, indicating technological uncertainty in the approach.',
      confidence: (ratio > 1.0 ? 'high' : 'medium') as 'high' | 'medium',
    };
  });
}

/**
 * Detect fix-after-feature patterns — features immediately followed
 * by multiple fixes, suggesting the initial approach had issues.
 */
async function detectFixAfterFeature(productId: string): Promise<Experiment[]> {
  const result = await pool.query(
    `WITH typed AS (
       SELECT sha, classified_type, authored_at, message_summary,
              LAG(classified_type) OVER (ORDER BY authored_at) AS prev_type
       FROM see_commits
       WHERE product_id = $1 AND classified_type IN ('feature', 'fix')
       ORDER BY authored_at
     )
     SELECT
       COUNT(*) FILTER (WHERE classified_type = 'fix' AND prev_type = 'feature') AS fix_after_feature_count,
       COUNT(*) FILTER (WHERE classified_type = 'feature') AS total_features,
       COUNT(*) FILTER (WHERE classified_type = 'fix') AS total_fixes
     FROM typed`,
    [productId]
  );

  const row = result.rows[0];
  const fixAfterFeature = parseInt(row?.fix_after_feature_count) || 0;
  const totalFeatures = parseInt(row?.total_features) || 0;
  const totalFixes = parseInt(row?.total_fixes) || 0;

  if (fixAfterFeature < 3 || totalFeatures < 5) return [];

  const ratio = totalFeatures > 0 ? Math.round(totalFixes / totalFeatures * 100) / 100 : 0;

  return [{
    experimentType: 'repeated_implementation',
    title: `Feature-fix cycle: ${ratio}x fix ratio across ${totalFeatures} features`,
    description: `${totalFixes} fix commits followed ${totalFeatures} feature commits, with ${fixAfterFeature} direct fix-after-feature sequences. This pattern indicates features required iterative correction, suggesting the solutions were not straightforward.`,
    evidenceCommits: [],
    startDate: null,
    endDate: null,
    uncertaintyIndicator: 'A high fix-to-feature ratio demonstrates that implemented features frequently required correction, indicating technological uncertainty in the initial approach.',
    confidence: ratio > 1.5 ? 'high' : 'medium',
  }];
}

// ─── Main Detection Orchestrator ────────────────────────────────────

export async function detectExperiments(productId: string): Promise<ExperimentDetectionResult> {
  logger.info(`[SEE] Running experiment detection for product ${productId}`);

  // Run all detectors
  const [refactoringWaves, prototypeBranches, rapidIteration, highRewrite, fixAfterFeature] = await Promise.all([
    detectRefactoringWaves(productId),
    detectPrototypeBranches(productId),
    detectRapidIteration(productId),
    detectHighRewritePeriods(productId),
    detectFixAfterFeature(productId),
  ]);

  const allExperiments = [
    ...refactoringWaves,
    ...prototypeBranches,
    ...rapidIteration,
    ...highRewrite,
    ...fixAfterFeature,
  ];

  // Sort by date
  allExperiments.sort((a, b) => {
    const da = a.startDate ? new Date(a.startDate).getTime() : 0;
    const db = b.startDate ? new Date(b.startDate).getTime() : 0;
    return da - db;
  });

  // Store experiments (clear previous and re-insert)
  await pool.query('DELETE FROM see_experiments WHERE product_id = $1', [productId]);

  for (const exp of allExperiments) {
    await pool.query(
      `INSERT INTO see_experiments (product_id, experiment_type, title, description, evidence_commits, start_date, end_date, uncertainty_indicator, confidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [productId, exp.experimentType, exp.title, exp.description,
       JSON.stringify(exp.evidenceCommits), exp.startDate, exp.endDate,
       exp.uncertaintyIndicator, exp.confidence]
    );
  }

  // Build summary
  const byType: Record<ExperimentType, number> = {
    repeated_implementation: 0, algorithm_replacement: 0, prototype_branch: 0,
    dependency_switching: 0, refactoring_wave: 0, architecture_change: 0, rapid_iteration: 0,
  };
  let highConf = 0, medConf = 0, lowConf = 0;

  for (const exp of allExperiments) {
    byType[exp.experimentType]++;
    if (exp.confidence === 'high') highConf++;
    else if (exp.confidence === 'medium') medConf++;
    else lowConf++;
  }

  logger.info(`[SEE] Detected ${allExperiments.length} experiments for product ${productId}`);

  return {
    productId,
    experiments: allExperiments,
    uncertaintySummary: {
      totalExperiments: allExperiments.length,
      byType,
      highConfidence: highConf,
      mediumConfidence: medConf,
      lowConfidence: lowConf,
    },
  };
}

export async function getExperiments(productId: string): Promise<ExperimentDetectionResult | null> {
  const result = await pool.query(
    `SELECT * FROM see_experiments WHERE product_id = $1 ORDER BY start_date ASC NULLS LAST`,
    [productId]
  );

  if (result.rows.length === 0) return null;

  const experiments: Experiment[] = result.rows.map((r: any) => ({
    id: r.id,
    experimentType: r.experiment_type,
    title: r.title,
    description: r.description,
    evidenceCommits: r.evidence_commits || [],
    startDate: r.start_date,
    endDate: r.end_date,
    uncertaintyIndicator: r.uncertainty_indicator,
    confidence: r.confidence,
  }));

  const byType: Record<ExperimentType, number> = {
    repeated_implementation: 0, algorithm_replacement: 0, prototype_branch: 0,
    dependency_switching: 0, refactoring_wave: 0, architecture_change: 0, rapid_iteration: 0,
  };
  let highConf = 0, medConf = 0, lowConf = 0;

  for (const exp of experiments) {
    byType[exp.experimentType]++;
    if (exp.confidence === 'high') highConf++;
    else if (exp.confidence === 'medium') medConf++;
    else lowConf++;
  }

  return {
    productId,
    experiments,
    uncertaintySummary: {
      totalExperiments: experiments.length,
      byType,
      highConfidence: highConf,
      mediumConfidence: medConf,
      lowConfidence: lowConf,
    },
  };
}

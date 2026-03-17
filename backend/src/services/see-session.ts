/**
 * SEE Session Capture Service — Phase H
 *
 * Manages development session recording: start/stop sessions,
 * record conversation turns, store transcripts in Forgejo,
 * and extract competence signals.
 */

import pool from '../db/pool.js';
import { logger } from '../utils/logger.js';

// ─── Types ──────────────────────────────────────────────────────────

export interface SessionInfo {
  id: string;
  productId: string;
  developerName: string;
  developerEmail: string;
  startedAt: string;
  endedAt: string | null;
  turnCount: number;
  status: string;
  domainsDemonstrated: string[];
  competenceLevel: string | null;
}

export interface SessionTurn {
  turnNumber: number;
  role: string;
  contentPreview: string;
  tokenCount: number;
  toolCalls: string[];
  createdAt: string;
}

export interface CompetenceProfile {
  productId: string;
  sessionsAnalysed: number;
  domainsDemonstrated: Record<string, number>;
  industryReferences: string[];
  decisionQuality: string;
  competenceLevel: string;
  totalTurns: number;
  totalTokens: number;
}

// ─── Competence Signal Detection ────────────────────────────────────

const DOMAIN_PATTERNS: Record<string, RegExp[]> = {
  'Security': [/\bsecurity\b/i, /\bvulnerab/i, /\bcve\b/i, /\bcvss\b/i, /\bcrypto/i, /\bencrypt/i, /\bowasp\b/i, /\bpenetration/i, /\bthreat\b/i],
  'Compliance': [/\bcompliance\b/i, /\bregulat/i, /\bcra\b/i, /\bnis2\b/i, /\bgdpr\b/i, /\bdora\b/i, /\bannex\b/i, /\barticle\s+\d/i, /\bobligation/i],
  'Architecture': [/\barchitect/i, /\bmicroservice/i, /\bmonolith/i, /\bscalab/i, /\bload\s+balanc/i, /\bdatabase\s+design/i, /\bgraph\s+database/i, /\bneo4j\b/i],
  'Frontend': [/\breact\b/i, /\bcomponent/i, /\bcss\b/i, /\bresponsive/i, /\bux\b/i, /\bui\b/i, /\bvite\b/i, /\btypescript\b/i],
  'Backend': [/\bexpress\b/i, /\bapi\b/i, /\bendpoint/i, /\bmiddleware/i, /\bpostgres/i, /\bdatabase/i, /\bquery\b/i, /\brest\b/i],
  'DevOps': [/\bdocker\b/i, /\bnginx\b/i, /\bci\/cd\b/i, /\bpipeline/i, /\bdeploy/i, /\bcontainer/i, /\bkubernetes/i],
  'Testing': [/\btest/i, /\bvitest\b/i, /\bjest\b/i, /\bplaywright\b/i, /\be2e\b/i, /\bunit\s+test/i, /\bcoverage/i],
  'Data Modelling': [/\bschema\b/i, /\bmigration/i, /\brelation/i, /\bgraph\s+model/i, /\bentity/i, /\bnormali[sz]/i],
  'AI/ML': [/\bai\b/i, /\bmachine\s+learn/i, /\bllm\b/i, /\bclaude\b/i, /\bcopilot\b/i, /\bprompt/i, /\btoken/i, /\bmodel\b/i],
  'Product Management': [/\buser\s+stor/i, /\brequirement/i, /\bstakeholder/i, /\broadmap/i, /\bprioritise/i, /\bbacklog/i, /\bscope\b/i],
};

const INDUSTRY_REFERENCE_PATTERNS = [
  /\biso\s*\d{4,5}/i, /\bnist\b/i, /\benisa\b/i, /\bowasp\b/i, /\bcwe-\d+/i,
  /\beidas\b/i, /\brfc\s*\d{3,4}/i, /\bfips\b/i, /\betsi\b/i,
  /\bcra\s+(art|article|annex)/i, /\bnis2\s+(art|directive)/i,
  /\bgdpr\s+(art|article)/i, /\bdora\s+(art|article)/i,
  /\bai\s+act/i, /\bcyber\s+resilience/i,
  /\bspdx\b/i, /\bcyclonedx\b/i, /\bsbom\b/i, /\boscal\b/i,
  /\bsoc\s*2\b/i, /\bpci\b/i, /\bhipaa\b/i,
];

function detectDomains(text: string): string[] {
  const found: string[] = [];
  for (const [domain, patterns] of Object.entries(DOMAIN_PATTERNS)) {
    if (patterns.some(p => p.test(text))) found.push(domain);
  }
  return found;
}

function detectIndustryRefs(text: string): string[] {
  const refs: string[] = [];
  for (const pattern of INDUSTRY_REFERENCE_PATTERNS) {
    const match = text.match(pattern);
    if (match) refs.push(match[0]);
  }
  return refs;
}

function assessDecisionQuality(turnCount: number, humanTurns: number, domains: string[]): string {
  if (humanTurns < 3) return 'insufficient_data';
  if (domains.length >= 5 && humanTurns >= 10) return 'senior';
  if (domains.length >= 3 && humanTurns >= 5) return 'experienced';
  if (domains.length >= 2) return 'competent';
  return 'developing';
}

function assessCompetenceLevel(
  totalSessions: number,
  totalDomains: number,
  industryRefCount: number,
  avgDecisionQuality: string,
): string {
  if (totalDomains >= 6 && industryRefCount >= 5 && avgDecisionQuality === 'senior') return 'senior_architect';
  if (totalDomains >= 4 && industryRefCount >= 3) return 'senior_engineer';
  if (totalDomains >= 3 && industryRefCount >= 1) return 'mid_engineer';
  if (totalDomains >= 2) return 'junior_engineer';
  return 'developing';
}

// ─── Session Management ─────────────────────────────────────────────

export async function startSession(
  productId: string,
  orgId: string,
  developerName: string,
  developerEmail: string,
): Promise<SessionInfo> {
  const result = await pool.query(
    `INSERT INTO see_sessions (product_id, org_id, developer_name, developer_email, status, consent_given)
     VALUES ($1, $2, $3, $4, 'active', true) RETURNING *`,
    [productId, orgId, developerName, developerEmail]
  );

  const row = result.rows[0];
  logger.info(`[SEE] Session started: ${row.id} for ${developerName} on product ${productId}`);

  return rowToSession(row);
}

export async function recordTurn(
  sessionId: string,
  role: string,
  content: string,
  toolCalls?: string[],
): Promise<{ turnNumber: number }> {
  // Get current turn count
  const session = await pool.query(
    `SELECT product_id, turn_count, status FROM see_sessions WHERE id = $1`,
    [sessionId]
  );

  if (session.rows.length === 0) throw new Error('Session not found');
  if (session.rows[0].status !== 'active') throw new Error('Session is not active');

  const turnNumber = (session.rows[0].turn_count || 0) + 1;

  // Store turn with a preview (first 500 chars) — full content goes to Forgejo later
  const preview = content.slice(0, 500);
  const tokenEstimate = Math.ceil(content.length / 4); // rough token estimate

  await pool.query(
    `INSERT INTO see_session_turns (session_id, turn_number, role, content_preview, token_count, tool_calls)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [sessionId, turnNumber, role, preview, tokenEstimate, JSON.stringify(toolCalls || [])]
  );

  // Update session turn count
  await pool.query(
    `UPDATE see_sessions SET turn_count = $2 WHERE id = $1`,
    [sessionId, turnNumber]
  );

  return { turnNumber };
}

export async function endSession(sessionId: string): Promise<SessionInfo> {
  // Get all turns for competence analysis
  const turns = await pool.query(
    `SELECT role, content_preview FROM see_session_turns WHERE session_id = $1 ORDER BY turn_number`,
    [sessionId]
  );

  // Analyse human turns for competence signals
  const humanContent = turns.rows
    .filter((t: any) => t.role === 'human')
    .map((t: any) => t.content_preview)
    .join(' ');

  const domains = detectDomains(humanContent);
  const industryRefs = detectIndustryRefs(humanContent);
  const humanTurnCount = turns.rows.filter((t: any) => t.role === 'human').length;
  const decisionQuality = assessDecisionQuality(turns.rows.length, humanTurnCount, domains);

  // Update session
  await pool.query(
    `UPDATE see_sessions SET
       status = 'completed', ended_at = NOW(),
       domains_demonstrated = $2, industry_refs = $3,
       decision_quality = $4
     WHERE id = $1`,
    [sessionId, JSON.stringify(domains), JSON.stringify(industryRefs), decisionQuality]
  );

  const result = await pool.query(`SELECT * FROM see_sessions WHERE id = $1`, [sessionId]);
  logger.info(`[SEE] Session ended: ${sessionId}, ${turns.rows.length} turns, domains: ${domains.join(', ')}`);

  return rowToSession(result.rows[0]);
}

// ─── Query Functions ────────────────────────────────────────────────

export async function listSessions(productId: string): Promise<SessionInfo[]> {
  const result = await pool.query(
    `SELECT * FROM see_sessions WHERE product_id = $1 ORDER BY started_at DESC LIMIT 50`,
    [productId]
  );
  return result.rows.map(rowToSession);
}

export async function getSessionTurns(sessionId: string): Promise<SessionTurn[]> {
  const result = await pool.query(
    `SELECT * FROM see_session_turns WHERE session_id = $1 ORDER BY turn_number`,
    [sessionId]
  );
  return result.rows.map((r: any) => ({
    turnNumber: r.turn_number,
    role: r.role,
    contentPreview: r.content_preview,
    tokenCount: r.token_count,
    toolCalls: r.tool_calls || [],
    createdAt: r.created_at,
  }));
}

export async function getCompetenceProfile(productId: string): Promise<CompetenceProfile> {
  const sessions = await pool.query(
    `SELECT * FROM see_sessions WHERE product_id = $1 AND status = 'completed'`,
    [productId]
  );

  const allDomains: Record<string, number> = {};
  const allRefs = new Set<string>();
  let totalTurns = 0;
  let totalTokens = 0;
  const qualities: string[] = [];

  for (const s of sessions.rows) {
    const domains = s.domains_demonstrated || [];
    for (const d of domains) {
      allDomains[d] = (allDomains[d] || 0) + 1;
    }
    const refs = s.industry_refs || [];
    for (const r of refs) allRefs.add(r);
    totalTurns += s.turn_count || 0;
    if (s.decision_quality) qualities.push(s.decision_quality);
  }

  // Get total tokens from turns
  const tokenResult = await pool.query(
    `SELECT SUM(st.token_count) AS total_tokens
     FROM see_session_turns st
     JOIN see_sessions s ON st.session_id = s.id
     WHERE s.product_id = $1`,
    [productId]
  );
  totalTokens = parseInt(tokenResult.rows[0]?.total_tokens) || 0;

  // Determine overall quality from most common quality
  const qualityCounts: Record<string, number> = {};
  for (const q of qualities) qualityCounts[q] = (qualityCounts[q] || 0) + 1;
  const avgQuality = Object.entries(qualityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'insufficient_data';

  const competenceLevel = assessCompetenceLevel(
    sessions.rows.length,
    Object.keys(allDomains).length,
    allRefs.size,
    avgQuality,
  );

  return {
    productId,
    sessionsAnalysed: sessions.rows.length,
    domainsDemonstrated: allDomains,
    industryReferences: Array.from(allRefs),
    decisionQuality: avgQuality,
    competenceLevel,
    totalTurns,
    totalTokens,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────

function rowToSession(row: any): SessionInfo {
  return {
    id: row.id,
    productId: row.product_id,
    developerName: row.developer_name || '',
    developerEmail: row.developer_email || '',
    startedAt: row.started_at,
    endedAt: row.ended_at,
    turnCount: row.turn_count || 0,
    status: row.status,
    domainsDemonstrated: row.domains_demonstrated || [],
    competenceLevel: row.competence_level || row.decision_quality || null,
  };
}

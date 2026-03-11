/**
 * AI Copilot — generates CRA compliance content suggestions using Claude.
 *
 * Non-streaming: returns full response as a string.
 * Never throws — logs errors and returns error message.
 */
import Anthropic from '@anthropic-ai/sdk';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { OBLIGATIONS } from './obligation-engine.js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = 'claude-sonnet-4-20250514';

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  return client;
}

export function isCopilotConfigured(): boolean {
  return ANTHROPIC_API_KEY.length > 0;
}

// ─── Context gathering ─────────────────────────────────────

export interface ProductContext {
  productName: string;
  productVersion: string | null;
  craCategory: string | null;
  repoUrl: string | null;
  sbom: { packageCount: number; isStale: boolean; topDeps: string[] } | null;
  vulns: { critical: number; high: number; medium: number; low: number; open: number } | null;
  obligations: { key: string; article: string; title: string; status: string }[];
  techFileSections: { key: string; title: string; status: string }[];
}

export async function gatherProductContext(productId: string, orgId: string): Promise<ProductContext> {
  // Product metadata from Neo4j
  const neo4jSession = getDriver().session();
  let productName = '';
  let productVersion: string | null = null;
  let craCategory: string | null = null;
  let repoUrl: string | null = null;
  try {
    const result = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p.name AS name, p.version AS version, p.craCategory AS cat, p.repoUrl AS repo`,
      { orgId, productId }
    );
    if (result.records.length > 0) {
      const r = result.records[0];
      productName = r.get('name') || '';
      productVersion = r.get('version') || null;
      craCategory = r.get('cat') || null;
      repoUrl = r.get('repo') || null;
    }
  } finally {
    await neo4jSession.close();
  }

  // SBOM summary
  let sbom: ProductContext['sbom'] = null;
  const sbomResult = await pool.query(
    `SELECT package_count, is_stale, spdx_json FROM product_sboms WHERE product_id = $1`,
    [productId]
  );
  if (sbomResult.rows.length > 0) {
    const row = sbomResult.rows[0];
    const topDeps: string[] = [];
    try {
      const spdx = typeof row.spdx_json === 'string' ? JSON.parse(row.spdx_json) : row.spdx_json;
      const pkgs = spdx?.packages || [];
      for (const pkg of pkgs.slice(0, 10)) {
        if (pkg.name) topDeps.push(pkg.name);
      }
    } catch { /* ignore parse errors */ }
    sbom = { packageCount: parseInt(row.package_count, 10) || 0, isStale: row.is_stale, topDeps };
  }

  // Vulnerability summary
  let vulns: ProductContext['vulns'] = null;
  const vulnResult = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE severity = 'critical') AS critical,
       COUNT(*) FILTER (WHERE severity = 'high') AS high,
       COUNT(*) FILTER (WHERE severity = 'medium') AS medium,
       COUNT(*) FILTER (WHERE severity = 'low') AS low,
       COUNT(*) FILTER (WHERE status IN ('open', 'acknowledged')) AS open
     FROM vulnerability_findings WHERE product_id = $1`,
    [productId]
  );
  if (vulnResult.rows.length > 0) {
    const r = vulnResult.rows[0];
    vulns = {
      critical: parseInt(r.critical, 10),
      high: parseInt(r.high, 10),
      medium: parseInt(r.medium, 10),
      low: parseInt(r.low, 10),
      open: parseInt(r.open, 10),
    };
  }

  // Obligation statuses
  const obResult = await pool.query(
    `SELECT obligation_key, status FROM obligations WHERE product_id = $1 AND org_id = $2`,
    [productId, orgId]
  );
  const obMap: Record<string, string> = {};
  for (const row of obResult.rows) obMap[row.obligation_key] = row.status;
  const obligations = OBLIGATIONS.map(o => ({
    key: o.key, article: o.article, title: o.title,
    status: obMap[o.key] || 'not_started',
  }));

  // Tech file section statuses
  const tfResult = await pool.query(
    `SELECT section_key, title, status FROM technical_file_sections WHERE product_id = $1`,
    [productId]
  );
  const techFileSections = tfResult.rows.map((r: any) => ({
    key: r.section_key, title: r.title, status: r.status,
  }));

  return { productName, productVersion, craCategory, repoUrl, sbom, vulns, obligations, techFileSections };
}

// ─── Tech file section field definitions ───────────────────

const SECTION_FIELDS: Record<string, string[]> = {
  product_description: ['intended_purpose', 'versions_affecting_compliance', 'market_availability', 'user_instructions_reference'],
  design_development: ['architecture_description', 'component_interactions', 'sdlc_process', 'production_monitoring'],
  vulnerability_handling: ['disclosure_policy_url', 'reporting_contact', 'update_distribution_mechanism', 'security_update_policy'],
  risk_assessment: ['methodology', 'threat_model', 'risk_register'],
  support_period: ['rationale', 'communication_plan'],
  declaration_of_conformity: ['assessment_module', 'notified_body', 'certificate_reference', 'declaration_text'],
};

const TECHFILE_GUIDANCE: Record<string, string> = {
  product_description: 'Describe the product\'s intended purpose, software versions affecting cybersecurity compliance, how it is made available on the market, and reference user instructions per Annex II. Satisfies Annex VII §1.',
  design_development: 'Document system architecture, how software components interact and integrate, and the SDLC process including production monitoring. Satisfies Annex VII §2(a).',
  vulnerability_handling: 'Document the coordinated vulnerability disclosure (CVD) policy, reporting contact, secure update distribution, and reference to the SBOM. Satisfies Annex VII §2(b).',
  risk_assessment: 'Perform and document a cybersecurity risk assessment considering intended and foreseeable use. Must address each Annex I Part I essential requirement. Satisfies Annex VII §3 and Article 13(2).',
  support_period: 'Determine and document the support period (minimum 5 years or expected product lifetime). Include rationale and communication plan. Satisfies Annex VII §4 and Article 13(8).',
  standards_applied: 'List harmonised standards (EU Official Journal), common specifications per Article 27(2), or EU cybersecurity certification schemes. Specify which parts are applied. Satisfies Annex VII §5.',
  test_reports: 'Attach penetration testing, static/dynamic analysis, vulnerability scan results, and any third-party audit reports demonstrating conformity with Annex I. Satisfies Annex VII §6.',
  declaration_of_conformity: 'The formal EU Declaration of Conformity per Article 28 and Annex VI. Specify the conformity assessment module (A, B+C, or H), notified body details if applicable, and CE marking date. Satisfies Annex VII §7.',
};

// ─── System prompt ─────────────────────────────────────────

const SYSTEM_PROMPT = `You are a CRA (EU Cyber Resilience Act) compliance expert embedded in the CRANIS2 compliance platform. Your role is to generate draft content for technical file sections and obligation evidence notes.

Rules:
1. Ground all suggestions in the product's actual data (SBOM, vulnerability findings, repo metadata, obligation statuses).
2. Write in a professional, factual tone suitable for regulatory documentation and auditors.
3. Be specific — reference actual dependency counts, vulnerability stats, and product details rather than using generic placeholders.
4. Where the product data is insufficient, note what information the user should add manually.
5. Use British English spelling throughout.
6. Never invent data that isn't provided in the context. If data is missing, say so clearly.
7. Keep content concise but thorough — aim for evidence-grade documentation.`;

// ─── DB-backed prompt loading ───────────────────────────────

// In-memory cache: prompt_key → { text, loadedAt }
const promptCache: Map<string, { text: string; qualityPreamble: string; loadedAt: number }> = new Map();
const PROMPT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Load a system prompt from the database, prepending the quality standard preamble.
 * Falls back to the hardcoded constant if the DB entry is missing.
 */
async function getSystemPrompt(promptKey: string, hardcodedFallback: string): Promise<string> {
  const cached = promptCache.get(promptKey);
  if (cached && Date.now() - cached.loadedAt < PROMPT_CACHE_TTL_MS) {
    return cached.qualityPreamble + '\n\n---\n\n' + cached.text;
  }

  try {
    // Load both the quality standard and the capability prompt in a single round-trip
    const result = await pool.query(
      `SELECT prompt_key, system_prompt FROM copilot_prompts WHERE prompt_key IN ($1, 'quality_standard') AND enabled = true`,
      [promptKey]
    );

    let qualityPreamble = '';
    let capabilityPrompt = hardcodedFallback;

    for (const row of result.rows) {
      if (row.prompt_key === 'quality_standard') {
        qualityPreamble = row.system_prompt;
      } else if (row.prompt_key === promptKey) {
        capabilityPrompt = row.system_prompt;
      }
    }

    promptCache.set(promptKey, {
      text: capabilityPrompt,
      qualityPreamble,
      loadedAt: Date.now(),
    });

    if (qualityPreamble) {
      return qualityPreamble + '\n\n---\n\n' + capabilityPrompt;
    }
    return capabilityPrompt;
  } catch (err) {
    console.error(`[COPILOT] Failed to load prompt "${promptKey}" from DB, using fallback:`, err);
    return hardcodedFallback;
  }
}

/**
 * Load model config (model, max_tokens) from DB for a prompt key.
 * Falls back to the module-level MODEL constant and provided default.
 */
async function getModelConfig(promptKey: string, defaultMaxTokens: number): Promise<{ model: string; maxTokens: number }> {
  try {
    const result = await pool.query(
      `SELECT model, max_tokens FROM copilot_prompts WHERE prompt_key = $1 AND enabled = true`,
      [promptKey]
    );
    if (result.rows.length > 0) {
      return {
        model: result.rows[0].model || MODEL,
        maxTokens: result.rows[0].max_tokens || defaultMaxTokens,
      };
    }
  } catch (err) {
    // fall through to defaults
  }
  return { model: MODEL, maxTokens: defaultMaxTokens };
}

// ─── Triage ─────────────────────────────────────────────────

export interface TriageFinding {
  id: string;
  title: string;
  severity: string;
  cvssScore: number | null;
  source: string;
  sourceId: string;
  dependencyName: string;
  dependencyVersion: string;
  dependencyEcosystem: string;
  fixedVersion: string | null;
  description: string;
  status: string;
}

export interface TriageSuggestion {
  findingId: string;
  suggestedAction: 'dismiss' | 'acknowledge' | 'escalate_mitigate';
  confidence: number;
  reasoning: string;
  dismissReason?: string;
  mitigationCommand?: string;
  automatable: boolean;
}

export interface TriageResult {
  suggestions: TriageSuggestion[];
  inputTokens: number;
  outputTokens: number;
  model: string;
}

const TRIAGE_SYSTEM_PROMPT = `You are a CRA (EU Cyber Resilience Act) vulnerability triage expert. Your task is to analyse vulnerability findings for a software product and suggest an appropriate action for each.

For each finding, suggest one of:
- "dismiss": The vulnerability is not exploitable in the product's context, is a false positive, affects only dev dependencies, or has negligible real-world risk.
- "acknowledge": The vulnerability is real but low priority — the team should track it but no immediate action is required.
- "escalate_mitigate": The vulnerability requires urgent attention — a fix, upgrade, or mitigation must be applied.

Rules:
1. Consider the product's CRA category when assessing risk. For "important_i", "important_ii", and "critical" categories, be significantly stricter — escalate more aggressively.
2. A fix being available (fixedVersion) should increase urgency to escalate.
3. Critical/high severity with a high CVSS score should almost always escalate unless clearly not applicable.
4. Low severity findings in dev-only dependencies are strong dismiss candidates.
5. Set confidence between 0 and 1. Be conservative — only use confidence >= 0.85 when the decision is clear-cut.
6. Set automatable to true ONLY when confidence >= 0.85 AND action is "dismiss".
7. Provide reasoning of 2-4 sentences explaining your assessment.
8. If dismissing, include a brief dismissReason suitable for an audit trail.
9. Use British English.

10. When the action is "acknowledge" or "escalate_mitigate" and a fix is available, include a mitigationCommand — the exact CLI command to resolve the issue (e.g. "npm install lodash@4.17.21", "pip install requests>=2.31.0", "composer require guzzlehttp/guzzle:^7.8"). Tailor the command to the dependency's ecosystem (npm, pip, maven, composer, cargo, go, nuget, gem, etc.). If no fix version is known, suggest the general upgrade command (e.g. "npm update lodash"). For dismiss actions, omit this field.

Return a JSON array of objects with these fields:
- findingId (string)
- suggestedAction ("dismiss" | "acknowledge" | "escalate_mitigate")
- confidence (number 0-1)
- reasoning (string)
- dismissReason (string, only when action is dismiss)
- mitigationCommand (string, only when action is acknowledge or escalate_mitigate)
- automatable (boolean)

Return ONLY the JSON array, no markdown fences, no additional text.`;

const TRIAGE_BATCH_SIZE = 20;

export async function generateTriageSuggestions(
  findings: TriageFinding[],
  productContext: ProductContext
): Promise<TriageResult> {
  const anthropic = getClient();
  const allSuggestions: TriageSuggestion[] = [];
  let totalInput = 0;
  let totalOutput = 0;
  const systemPrompt = await getSystemPrompt('vulnerability_triage', TRIAGE_SYSTEM_PROMPT);
  const config = await getModelConfig('vulnerability_triage', 4000);

  // Process in batches of TRIAGE_BATCH_SIZE
  for (let i = 0; i < findings.length; i += TRIAGE_BATCH_SIZE) {
    const batch = findings.slice(i, i + TRIAGE_BATCH_SIZE);

    const userPrompt = `Triage the following ${batch.length} vulnerability finding(s) for this product.

Product context:
- Name: ${productContext.productName}
- Version: ${productContext.productVersion || 'not set'}
- CRA Category: ${productContext.craCategory || 'default'}
- Repository: ${productContext.repoUrl || 'not connected'}
- SBOM: ${productContext.sbom ? `${productContext.sbom.packageCount} packages, top deps: ${productContext.sbom.topDeps.join(', ') || 'none parsed'}` : 'not available'}
- Vulnerability summary: ${productContext.vulns ? `${productContext.vulns.critical} critical, ${productContext.vulns.high} high, ${productContext.vulns.medium} medium, ${productContext.vulns.low} low (${productContext.vulns.open} open)` : 'unknown'}

Findings to triage:
${JSON.stringify(batch.map(f => ({
  findingId: f.id,
  title: f.title,
  severity: f.severity,
  cvssScore: f.cvssScore,
  source: f.source,
  sourceId: f.sourceId,
  dependency: `${f.dependencyName}@${f.dependencyVersion}`,
  ecosystem: f.dependencyEcosystem,
  fixAvailable: f.fixedVersion || null,
  description: f.description?.substring(0, 300),
})), null, 2)}`;

    const response = await anthropic.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    totalInput += response.usage?.input_tokens || 0;
    totalOutput += response.usage?.output_tokens || 0;

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    try {
      const parsed: TriageSuggestion[] = JSON.parse(text);
      // Validate and sanitise
      for (const s of parsed) {
        if (!s.findingId || !s.suggestedAction || typeof s.confidence !== 'number') continue;
        // Enforce automatable rules
        s.automatable = s.confidence >= 0.85 && s.suggestedAction === 'dismiss';
        allSuggestions.push(s);
      }
    } catch (parseErr) {
      console.error('[COPILOT] Failed to parse triage response:', parseErr, text);
    }
  }

  return {
    suggestions: allSuggestions,
    inputTokens: totalInput,
    outputTokens: totalOutput,
    model: MODEL,
  };
}

// ─── Risk assessment generation ─────────────────────────────

export interface EnrichedRiskContext extends ProductContext {
  topVulnerabilities: {
    sourceId: string;
    title: string;
    severity: string;
    cvssScore: number | null;
    dependencyName: string;
    dependencyVersion: string;
    dependencyEcosystem: string;
    fixedVersion: string | null;
    status: string;
  }[];
  licenceRisks: {
    dependencyName: string;
    licenseDeclared: string;
    riskLevel: string;
    riskReason: string;
  }[];
  ecosystemBreakdown: Record<string, number>;
}

export async function gatherEnrichedRiskContext(productId: string, orgId: string): Promise<EnrichedRiskContext> {
  const base = await gatherProductContext(productId, orgId);

  const [vulnRows, licenceRows, ecoRows] = await Promise.all([
    pool.query(
      `SELECT source_id, title, severity, cvss_score, dependency_name, dependency_version,
              dependency_ecosystem, fixed_version, status
       FROM vulnerability_findings
       WHERE product_id = $1 AND org_id = $2 AND status IN ('open', 'acknowledged')
       ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
                cvss_score DESC NULLS LAST
       LIMIT 20`,
      [productId, orgId]
    ),
    pool.query(
      `SELECT dependency_name, license_declared, risk_level, risk_reason
       FROM license_findings
       WHERE product_id = $1 AND org_id = $2 AND risk_level IN ('critical', 'warning')
       ORDER BY CASE risk_level WHEN 'critical' THEN 0 ELSE 1 END
       LIMIT 20`,
      [productId, orgId]
    ),
    pool.query(
      `SELECT dependency_ecosystem, COUNT(DISTINCT dependency_name)::int AS dep_count
       FROM vulnerability_findings
       WHERE product_id = $1
       GROUP BY dependency_ecosystem
       ORDER BY dep_count DESC`,
      [productId]
    ),
  ]);

  const topVulnerabilities = vulnRows.rows.map((r: any) => ({
    sourceId: r.source_id,
    title: r.title,
    severity: r.severity,
    cvssScore: r.cvss_score ? parseFloat(r.cvss_score) : null,
    dependencyName: r.dependency_name,
    dependencyVersion: r.dependency_version,
    dependencyEcosystem: r.dependency_ecosystem,
    fixedVersion: r.fixed_version,
    status: r.status,
  }));

  const licenceRisks = licenceRows.rows.map((r: any) => ({
    dependencyName: r.dependency_name,
    licenseDeclared: r.license_declared,
    riskLevel: r.risk_level,
    riskReason: r.risk_reason,
  }));

  const ecosystemBreakdown: Record<string, number> = {};
  for (const r of ecoRows.rows) {
    if (r.dependency_ecosystem) ecosystemBreakdown[r.dependency_ecosystem] = r.dep_count;
  }

  return { ...base, topVulnerabilities, licenceRisks, ecosystemBreakdown };
}

export interface RiskAssessmentResult {
  fields: {
    methodology: string;
    threat_model: string;
    risk_register: string;
  };
  annexIRequirements: {
    ref: string;
    title: string;
    applicable: boolean;
    justification: string;
    evidence: string;
  }[];
  inputTokens: number;
  outputTokens: number;
  model: string;
}

const RISK_ASSESSMENT_SYSTEM_PROMPT = `You are a CRA (EU Cyber Resilience Act) cybersecurity risk assessment expert. Your task is to generate a comprehensive cybersecurity risk assessment for a software product based on its actual data.

You will produce:
1. A methodology section describing the risk assessment approach used (2-4 paragraphs)
2. A threat model identifying threats, attack surfaces, and mitigations based on actual vulnerabilities and dependencies (2-4 paragraphs)
3. A risk register as a Markdown table with columns: #, Threat, Likelihood (Low/Medium/High), Impact (Low/Medium/High), Risk Level (Low/Medium/High/Critical), Mitigation, Status
4. For each of the 13 Annex I Part I essential cybersecurity requirements, an assessment of applicability, justification, and evidence

The 13 Annex I Part I requirements are:
- I(a): No known exploitable vulnerabilities
- I(b): Secure-by-default configuration
- I(c): Security update mechanism
- I(d): Access control & authentication
- I(e): Data confidentiality & encryption
- I(f): Data & command integrity
- I(g): Data minimisation
- I(h): Availability & resilience
- I(i): Minimise impact on other services
- I(j): Attack surface limitation
- I(k): Exploitation mitigation
- I(l): Security monitoring & logging
- I(m): Secure data erasure & transfer

Rules:
1. Ground ALL content in the product's actual data. Reference real CVE IDs, dependency names, and statistics.
2. Never invent vulnerabilities, dependencies, or data not provided in the context.
3. For the risk register, derive risks from actual vulnerability findings and licence issues provided.
4. If data is insufficient for a complete assessment, clearly note what information the user should add manually.
5. Use British English spelling throughout.
6. Write in a professional, factual tone suitable for regulatory auditors.
7. The risk register must be a valid Markdown table.
8. For Annex I requirements: if the product data supports a positive assessment, provide evidence. If data is missing, note what evidence is needed.

Return ONLY a JSON object (no markdown fences, no additional text) with this exact structure:
{
  "fields": {
    "methodology": "...",
    "threat_model": "...",
    "risk_register": "| # | Threat | Likelihood | Impact | Risk Level | Mitigation | Status |\\n|---|--------|-----------|--------|-----------|------------|--------|\\n| 1 | ... |"
  },
  "annexIRequirements": [
    { "ref": "I(a)", "title": "No known exploitable vulnerabilities", "applicable": true, "justification": "...", "evidence": "..." },
    ... (all 13 requirements, in order from I(a) to I(m))
  ]
}`;

export async function generateRiskAssessment(context: EnrichedRiskContext): Promise<RiskAssessmentResult> {
  const anthropic = getClient();
  const systemPrompt = await getSystemPrompt('risk_assessment', RISK_ASSESSMENT_SYSTEM_PROMPT);
  const config = await getModelConfig('risk_assessment', 6000);

  const ecoSummary = Object.entries(context.ecosystemBreakdown)
    .map(([eco, count]) => `${eco}: ${count} deps`)
    .join(', ') || 'no ecosystem data';

  const vulnDetails = context.topVulnerabilities.length > 0
    ? context.topVulnerabilities.map(v =>
        `- ${v.sourceId}: ${v.title} (${v.severity}, CVSS ${v.cvssScore ?? 'N/A'}) — ${v.dependencyName}@${v.dependencyVersion} [${v.dependencyEcosystem}]${v.fixedVersion ? ` → fix: ${v.fixedVersion}` : ''}`
      ).join('\n')
    : 'No open vulnerability findings.';

  const licenceDetails = context.licenceRisks.length > 0
    ? context.licenceRisks.map(l =>
        `- ${l.dependencyName}: ${l.licenseDeclared} (${l.riskLevel}) — ${l.riskReason}`
      ).join('\n')
    : 'No licence risk findings.';

  const userPrompt = `Generate a comprehensive cybersecurity risk assessment for this product.

Product context:
- Name: ${context.productName}
- Version: ${context.productVersion || 'not set'}
- CRA Category: ${context.craCategory || 'default'}
- Repository: ${context.repoUrl || 'not connected'}
- SBOM: ${context.sbom ? `${context.sbom.packageCount} packages${context.sbom.isStale ? ' (stale)' : ''}, top deps: ${context.sbom.topDeps.join(', ') || 'none parsed'}` : 'not available'}
- Vulnerability summary: ${context.vulns ? `${context.vulns.critical} critical, ${context.vulns.high} high, ${context.vulns.medium} medium, ${context.vulns.low} low (${context.vulns.open} open)` : 'no scans yet'}
- Ecosystems: ${ecoSummary}
- Obligations: ${context.obligations.map(o => `${o.article}: ${o.status}`).join(', ')}
- Tech file progress: ${context.techFileSections.map(s => `${s.key}: ${s.status}`).join(', ')}

Top vulnerability findings (open/acknowledged):
${vulnDetails}

Licence risk findings:
${licenceDetails}`;

  const response = await anthropic.messages.create({
    model: config.model,
    max_tokens: config.maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('\n');

  // Strip markdown fences if present
  const cleaned = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
  const parsed = JSON.parse(cleaned);

  return {
    fields: {
      methodology: parsed.fields?.methodology || '',
      threat_model: parsed.fields?.threat_model || '',
      risk_register: parsed.fields?.risk_register || '',
    },
    annexIRequirements: (parsed.annexIRequirements || []).map((r: any) => ({
      ref: r.ref || '',
      title: r.title || '',
      applicable: typeof r.applicable === 'boolean' ? r.applicable : true,
      justification: r.justification || '',
      evidence: r.evidence || '',
    })),
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
    model: MODEL,
  };
}

// ─── Incident report draft ──────────────────────────────────

export interface IncidentReportContext {
  productContext: ProductContext;
  report: {
    id: string;
    productId: string;
    reportType: 'vulnerability' | 'incident';
    status: string;
    awarenessAt: string | null;
    csirtCountry: string | null;
    memberStatesAffected: string[];
    sensitivityTlp: string;
    enisaReference: string | null;
  };
  linkedFinding: {
    title: string;
    severity: string;
    cvssScore: number | null;
    source: string;
    sourceId: string;
    dependencyName: string;
    dependencyVersion: string;
    fixedVersion: string | null;
    description: string;
  } | null;
  previousStages: Record<string, Record<string, any>>;
}

export interface IncidentReportDraftResult {
  fields: Record<string, string>;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

const REPORT_STAGE_FIELDS: Record<string, Record<string, string[]>> = {
  early_warning: {
    vulnerability: ['summary', 'memberStatesDetail', 'sensitivityNote'],
    incident: ['summary', 'suspectedMalicious', 'memberStatesDetail', 'sensitivityNote'],
  },
  notification: {
    vulnerability: ['vulnerabilityDetails', 'exploitNature', 'affectedComponent',
                     'correctiveMeasures', 'userMitigations', 'patchStatus'],
    incident: ['incidentNature', 'initialAssessment', 'correctiveMeasures', 'userMitigations'],
  },
  final_report: {
    vulnerability: ['detailedDescription', 'severityAssessment', 'rootCause',
                     'maliciousActorInfo', 'securityUpdates', 'preventiveMeasures',
                     'userNotificationStatus'],
    incident: ['detailedDescription', 'severityAssessment', 'threatType',
               'ongoingMitigation', 'preventiveMeasures'],
  },
};

const REPORT_DRAFT_SYSTEM_PROMPT = `You are a CRA (EU Cyber Resilience Act) incident and vulnerability reporting expert embedded in the CRANIS2 compliance platform. Your role is to draft content for ENISA Article 14 report stages.

Background: Under CRA Article 14, manufacturers must report actively exploited vulnerabilities and severe incidents to their designated CSIRT within strict deadlines:
- Early Warning: within 24 hours of awareness
- Notification: within 72 hours of awareness
- Final Report: within 14 days (vulnerabilities) or 1 month (incidents) of awareness

Rules:
1. Ground all content in the product's actual data (SBOM, vulnerability findings, linked finding details, repo metadata).
2. Write in a professional, factual tone suitable for CSIRT/ENISA regulatory submissions.
3. Be specific — reference actual CVE IDs, dependency names, versions, and statistics when available.
4. Where data is insufficient, note what the user should add manually with "[TO COMPLETE: ...]" placeholders.
5. Use British English spelling throughout.
6. Never invent data not provided in the context.
7. Keep content concise but thorough — these are regulatory submissions, not essays.
8. If previous stages have been submitted, maintain consistency with their content and build upon them.
9. For the suspectedMalicious field, use only "yes", "no", or "unknown".
10. For patchStatus, use only "available", "in_progress", or "planned".
11. For userNotificationStatus, use only "informed", "pending", or "not_required".

Return ONLY a JSON object with the requested fields as keys and string values. No markdown fences, no additional text.`;

export async function gatherIncidentReportContext(
  reportId: string,
  orgId: string
): Promise<IncidentReportContext> {
  // 1. Fetch report row (also validates org ownership)
  const reportResult = await pool.query(
    `SELECT id, product_id, report_type, status, awareness_at,
            csirt_country, member_states_affected, sensitivity_tlp,
            enisa_reference, linked_finding_id
     FROM cra_reports WHERE id = $1 AND org_id = $2`,
    [reportId, orgId]
  );
  if (reportResult.rows.length === 0) throw new Error('Report not found');
  const r = reportResult.rows[0];

  // 2. Gather product context + linked finding + previous stages in parallel
  const [productContext, findingResult, stagesResult] = await Promise.all([
    gatherProductContext(r.product_id, orgId),
    r.linked_finding_id
      ? pool.query(
          `SELECT title, severity, cvss_score, source, source_id,
                  dependency_name, dependency_version, fixed_version, description
           FROM vulnerability_findings WHERE id = $1`,
          [r.linked_finding_id]
        )
      : Promise.resolve({ rows: [] }),
    pool.query(
      `SELECT stage, content FROM cra_report_stages
       WHERE report_id = $1 ORDER BY submitted_at ASC`,
      [reportId]
    ),
  ]);

  // 3. Map linked finding
  let linkedFinding: IncidentReportContext['linkedFinding'] = null;
  if (findingResult.rows.length > 0) {
    const f = findingResult.rows[0];
    linkedFinding = {
      title: f.title,
      severity: f.severity,
      cvssScore: f.cvss_score ? parseFloat(f.cvss_score) : null,
      source: f.source,
      sourceId: f.source_id,
      dependencyName: f.dependency_name,
      dependencyVersion: f.dependency_version,
      fixedVersion: f.fixed_version,
      description: f.description,
    };
  }

  // 4. Map previous stages
  const previousStages: Record<string, Record<string, any>> = {};
  for (const s of stagesResult.rows) {
    previousStages[s.stage] = typeof s.content === 'string'
      ? JSON.parse(s.content) : s.content;
  }

  return {
    productContext,
    report: {
      id: r.id,
      productId: r.product_id,
      reportType: r.report_type,
      status: r.status,
      awarenessAt: r.awareness_at,
      csirtCountry: r.csirt_country,
      memberStatesAffected: r.member_states_affected || [],
      sensitivityTlp: r.sensitivity_tlp,
      enisaReference: r.enisa_reference,
    },
    linkedFinding,
    previousStages,
  };
}

export async function generateIncidentReportDraft(
  context: IncidentReportContext,
  stage: 'early_warning' | 'notification' | 'final_report'
): Promise<IncidentReportDraftResult> {
  const anthropic = getClient();
  const systemPrompt = await getSystemPrompt('incident_report_draft', REPORT_DRAFT_SYSTEM_PROMPT);
  const config = await getModelConfig('incident_report_draft', 3000);
  const { productContext: pc, report, linkedFinding, previousStages } = context;
  const reportType = report.reportType;

  const fields = REPORT_STAGE_FIELDS[stage]?.[reportType];
  if (!fields) throw new Error(`Unknown stage/type: ${stage}/${reportType}`);

  const findingBlock = linkedFinding
    ? `Linked vulnerability finding:
- Title: ${linkedFinding.title}
- Severity: ${linkedFinding.severity}${linkedFinding.cvssScore ? ` (CVSS ${linkedFinding.cvssScore})` : ''}
- Source: ${linkedFinding.source} — ${linkedFinding.sourceId}
- Affected: ${linkedFinding.dependencyName}@${linkedFinding.dependencyVersion}
- Fix: ${linkedFinding.fixedVersion || 'none available'}
- Description: ${linkedFinding.description?.substring(0, 500) || 'N/A'}`
    : 'No linked vulnerability finding.';

  const previousBlock = Object.keys(previousStages).length > 0
    ? `Previously submitted stages:\n${Object.entries(previousStages).map(([s, c]) =>
        `${s}:\n${JSON.stringify(c, null, 2)}`
      ).join('\n\n')}`
    : 'No previous stages submitted yet.';

  const stageLabel = stage === 'early_warning' ? 'Early Warning (24h)'
    : stage === 'notification' ? 'Notification (72h)'
    : 'Final Report (14d/1m)';

  const userPrompt = `Draft content for the ${stageLabel} stage of a CRA Article 14 ${reportType} report.

Report metadata:
- Report type: ${reportType}
- CSIRT country: ${report.csirtCountry || 'not set'}
- Member states affected: ${report.memberStatesAffected.length > 0 ? report.memberStatesAffected.join(', ') : 'not specified'}
- TLP classification: ${report.sensitivityTlp}
- Awareness date: ${report.awarenessAt || 'not set'}

Product context:
- Name: ${pc.productName}
- Version: ${pc.productVersion || 'not set'}
- CRA Category: ${pc.craCategory || 'default'}
- Repository: ${pc.repoUrl || 'not connected'}
- SBOM: ${pc.sbom ? `${pc.sbom.packageCount} packages${pc.sbom.isStale ? ' (stale)' : ''}, top deps: ${pc.sbom.topDeps.join(', ') || 'none parsed'}` : 'not available'}
- Vulnerabilities: ${pc.vulns ? `${pc.vulns.critical} critical, ${pc.vulns.high} high, ${pc.vulns.medium} medium, ${pc.vulns.low} low (${pc.vulns.open} open)` : 'no scans yet'}

${findingBlock}

${previousBlock}

Return a JSON object with these exact fields: ${JSON.stringify(fields)}
Each field value must be a string.`;

  const response = await anthropic.messages.create({
    model: config.model,
    max_tokens: config.maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('\n');

  const cleaned = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
  const parsed = JSON.parse(cleaned);

  // Validate all fields present, default to empty string
  const result: Record<string, string> = {};
  for (const f of fields) {
    result[f] = typeof parsed[f] === 'string' ? parsed[f] : '';
  }

  return {
    fields: result,
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
    model: MODEL,
  };
}

// ─── Generation ────────────────────────────────────────────

export interface SuggestionParams {
  sectionKey: string;
  type: 'technical_file' | 'obligation';
  productContext: ProductContext;
  existingContent?: string;
}

export interface SuggestionResult {
  suggestion: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export async function generateSuggestion(params: SuggestionParams): Promise<SuggestionResult> {
  const { sectionKey, type, productContext, existingContent } = params;

  // Build the user prompt
  let userPrompt = '';

  if (type === 'technical_file') {
    const guidance = TECHFILE_GUIDANCE[sectionKey] || '';
    const fields = SECTION_FIELDS[sectionKey];

    userPrompt = `Generate content for the "${sectionKey}" section of the CRA technical file.

CRA guidance for this section: ${guidance}

Product context:
- Name: ${productContext.productName}
- Version: ${productContext.productVersion || 'not set'}
- CRA Category: ${productContext.craCategory || 'default'}
- Repository: ${productContext.repoUrl || 'not connected'}
- SBOM: ${productContext.sbom ? `${productContext.sbom.packageCount} packages${productContext.sbom.isStale ? ' (stale)' : ''}, top deps: ${productContext.sbom.topDeps.join(', ') || 'none parsed'}` : 'not available'}
- Vulnerabilities: ${productContext.vulns ? `${productContext.vulns.critical} critical, ${productContext.vulns.high} high, ${productContext.vulns.medium} medium, ${productContext.vulns.low} low (${productContext.vulns.open} open)` : 'no scans yet'}
- Obligation statuses: ${productContext.obligations.map(o => `${o.article}: ${o.status}`).join(', ')}
- Tech file progress: ${productContext.techFileSections.map(s => `${s.key}: ${s.status}`).join(', ')}`;

    if (fields) {
      userPrompt += `\n\nReturn a JSON object with these fields: ${JSON.stringify(fields)}
Each field value should be a string of 2-5 sentences of substantive content.`;
    } else if (sectionKey === 'standards_applied') {
      userPrompt += `\n\nReturn a JSON object with a "standards" array. Each element: { "name": "standard name", "reference": "EN/ISO reference", "parts_applied": "which parts" }. Suggest appropriate standards based on the product's CRA category.`;
    } else if (sectionKey === 'test_reports') {
      userPrompt += `\n\nReturn a JSON object with a "reports" array. Each element: { "title": "report title", "type": "penetration_test|static_analysis|dynamic_analysis|third_party_audit", "date": "", "summary": "what should be tested" }. Suggest appropriate tests based on the product's data.`;
    }

    if (existingContent) {
      userPrompt += `\n\nExisting content (refine rather than replace): ${existingContent}`;
    }
  } else {
    // Obligation evidence
    const obligation = OBLIGATIONS.find(o => o.key === sectionKey);
    if (!obligation) {
      return { suggestion: `Unknown obligation: ${sectionKey}`, inputTokens: 0, outputTokens: 0, model: MODEL };
    }

    userPrompt = `Generate evidence/compliance notes for the following CRA obligation:

Obligation: ${obligation.article} — ${obligation.title}
Description: ${obligation.description}

Product context:
- Name: ${productContext.productName}
- Version: ${productContext.productVersion || 'not set'}
- CRA Category: ${productContext.craCategory || 'default'}
- SBOM: ${productContext.sbom ? `${productContext.sbom.packageCount} packages${productContext.sbom.isStale ? ' (stale)' : ''}` : 'not available'}
- Vulnerabilities: ${productContext.vulns ? `${productContext.vulns.critical} critical, ${productContext.vulns.high} high (${productContext.vulns.open} open)` : 'no scans yet'}
- Repository: ${productContext.repoUrl || 'not connected'}

Write 3-6 sentences of evidence notes documenting how this product meets (or is working towards meeting) this obligation. Reference actual data where available. If data is missing, note what evidence the user should gather.

Return plain text (not JSON).`;

    if (existingContent) {
      userPrompt += `\n\nExisting notes (refine rather than replace): ${existingContent}`;
    }
  }

  const anthropic = getClient();
  const systemPrompt = await getSystemPrompt('suggest', SYSTEM_PROMPT);
  const config = await getModelConfig('suggest', 2000);
  const response = await anthropic.messages.create({
    model: config.model,
    max_tokens: config.maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('\n');

  return {
    suggestion: text,
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
    model: MODEL,
  };
}

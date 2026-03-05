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
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
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

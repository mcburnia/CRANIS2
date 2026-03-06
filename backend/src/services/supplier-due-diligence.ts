/**
 * Supplier Due Diligence Service
 * Identifies risky third-party dependencies and generates AI-powered
 * due diligence questionnaires per CRA Art. 13(5).
 */

import Anthropic from '@anthropic-ai/sdk';
import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import type {
  RiskFlag,
  RiskyDependency,
  QuestionnaireContent,
  SupplierQuestionnaire,
} from '../types/supplier-due-diligence.js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = 'claude-sonnet-4-20250514';

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  return client;
}

// Copyleft licence families that trigger due diligence
const COPYLEFT_LICENSES = [
  'GPL', 'GPLv2', 'GPLv3', 'GPL-2.0', 'GPL-3.0',
  'LGPL', 'LGPLv2', 'LGPLv3', 'LGPL-2.0', 'LGPL-2.1', 'LGPL-3.0',
  'AGPL', 'AGPLv3', 'AGPL-3.0',
  'MPL', 'MPL-2.0',
  'EUPL', 'EUPL-1.1', 'EUPL-1.2',
  'CPAL', 'CPAL-1.0',
  'OSL', 'OSL-3.0',
];

function isCopyleftLicense(license: string | null): boolean {
  if (!license) return false;
  const upper = license.toUpperCase().replace(/-ONLY|-OR-LATER/g, '');
  return COPYLEFT_LICENSES.some(cl => upper.includes(cl.toUpperCase()));
}

/**
 * Identify dependencies with supply chain risk flags
 */
export async function identifyRiskyDependencies(
  productId: string,
  orgId: string
): Promise<RiskyDependency[]> {
  // Get dependencies from Neo4j
  const neo4jSession = getDriver().session();
  let deps: Array<{
    name: string;
    version: string | null;
    purl: string | null;
    ecosystem: string | null;
    license: string | null;
    supplier: string | null;
  }> = [];

  try {
    const result = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})-[:DEPENDS_ON]->(d:Dependency)
       RETURN d.name AS name, d.version AS version, d.purl AS purl,
              d.ecosystem AS ecosystem, d.license AS license, d.supplier AS supplier`,
      { orgId, productId }
    );
    deps = result.records.map(r => ({
      name: r.get('name'),
      version: r.get('version') || null,
      purl: r.get('purl') || null,
      ecosystem: r.get('ecosystem') || null,
      license: r.get('license') || null,
      supplier: r.get('supplier') || null,
    }));
  } finally {
    await neo4jSession.close();
  }

  if (deps.length === 0) return [];

  // Get vulnerability findings for these dependencies
  const vulnResult = await pool.query(
    `SELECT dependency_name, dependency_version, severity, COUNT(*) AS count
     FROM vulnerability_findings
     WHERE product_id = $1 AND status IN ('open', 'acknowledged')
     GROUP BY dependency_name, dependency_version, severity`,
    [productId]
  );

  // Build vuln lookup: depName -> { severity -> count }
  const vulnMap = new Map<string, Map<string, number>>();
  for (const row of vulnResult.rows) {
    const key = row.dependency_name;
    if (!vulnMap.has(key)) vulnMap.set(key, new Map());
    vulnMap.get(key)!.set(row.severity, parseInt(row.count));
  }

  // Flag risky dependencies
  const risky: RiskyDependency[] = [];

  for (const dep of deps) {
    const flags: RiskFlag[] = [];

    // Check copyleft licence
    if (isCopyleftLicense(dep.license)) {
      flags.push({
        type: 'copyleft_license',
        detail: `Copyleft licence detected: ${dep.license}`,
      });
    }

    // Check known vulnerabilities
    const depVulns = vulnMap.get(dep.name);
    if (depVulns) {
      const totalVulns = Array.from(depVulns.values()).reduce((a, b) => a + b, 0);
      const hasCriticalOrHigh = (depVulns.get('critical') || 0) + (depVulns.get('high') || 0) > 0;

      if (hasCriticalOrHigh) {
        flags.push({
          type: 'high_severity_vuln',
          detail: `${depVulns.get('critical') || 0} critical, ${depVulns.get('high') || 0} high severity vulnerabilities`,
        });
      } else if (totalVulns > 0) {
        flags.push({
          type: 'known_vulnerability',
          detail: `${totalVulns} open vulnerability finding(s)`,
        });
      }
    }

    // Check missing supplier info
    if (!dep.supplier || dep.supplier.trim() === '') {
      flags.push({
        type: 'no_supplier_info',
        detail: 'No supplier/maintainer information available',
      });
    }

    if (flags.length > 0) {
      const vulnSeverities = depVulns ? Array.from(depVulns.entries()) : [];
      const highestSev = vulnSeverities.length > 0
        ? (['critical', 'high', 'medium', 'low'].find(s => (depVulns?.get(s) || 0) > 0) || undefined)
        : undefined;

      risky.push({
        name: dep.name,
        version: dep.version,
        purl: dep.purl,
        ecosystem: dep.ecosystem,
        license: dep.license,
        supplier: dep.supplier,
        riskFlags: flags,
        vulnCount: depVulns ? Array.from(depVulns.values()).reduce((a, b) => a + b, 0) : 0,
        highestSeverity: highestSev,
      });
    }
  }

  // Sort by risk: high severity vulns first, then copyleft, then no supplier
  risky.sort((a, b) => {
    const severityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const aSev = severityOrder[a.highestSeverity || ''] || 0;
    const bSev = severityOrder[b.highestSeverity || ''] || 0;
    if (aSev !== bSev) return bSev - aSev;
    return b.riskFlags.length - a.riskFlags.length;
  });

  return risky;
}

/**
 * Generate an AI-powered due diligence questionnaire for a dependency
 */
export async function generateQuestionnaire(
  dep: RiskyDependency,
  productName: string,
  craCategory: string | null
): Promise<{ content: QuestionnaireContent; inputTokens: number; outputTokens: number }> {
  const flagSummary = dep.riskFlags.map(f => `- ${f.detail}`).join('\n');

  const userPrompt = `Generate a supplier due diligence questionnaire for the following third-party software component used in a product subject to the EU Cyber Resilience Act (CRA).

Product: ${productName}
CRA Category: ${craCategory || 'default'}

Dependency details:
- Name: ${dep.name}
- Version: ${dep.version || 'unknown'}
- Ecosystem: ${dep.ecosystem || 'unknown'}
- Licence: ${dep.license || 'unknown'}
- Supplier: ${dep.supplier || 'unknown'}

Risk flags identified:
${flagSummary}
${dep.vulnCount ? `- Total open vulnerabilities: ${dep.vulnCount} (highest severity: ${dep.highestSeverity})` : ''}

Generate a JSON response with this exact structure:
{
  "summary": "A 2-3 sentence summary of why due diligence is required for this component",
  "riskAssessment": "A 2-3 sentence risk assessment of this dependency in the CRA context",
  "questions": [
    {
      "id": "q1",
      "category": "one of: security_practices, vulnerability_management, licence_compliance, update_cadence, data_handling, supply_chain",
      "question": "The question to ask the supplier/maintainer",
      "rationale": "Why this question matters for CRA compliance",
      "craReference": "Relevant CRA article reference (e.g. Art. 13(5))"
    }
  ],
  "recommendedActions": ["Action items the product manufacturer should take regardless of supplier response"]
}

Generate 6-10 targeted questions based on the specific risk flags. Prioritise questions that address the identified risks. Include CRA article references where applicable.`;

  const systemPrompt = `You are a CRA (EU Cyber Resilience Act) supply chain compliance expert. You generate due diligence questionnaires for third-party software components.

Rules:
1. Questions must be specific to the component's identified risks, not generic.
2. Reference specific CRA articles (Art. 13(5) on known vulnerabilities, Art. 13(6) on component identification, Art. 13(3) on component currency).
3. Use professional language suitable for sending to a software supplier.
4. Be practical — questions should be answerable by a typical open-source maintainer or commercial vendor.
5. Use British English spelling throughout.
6. Return valid JSON only, no markdown fences.`;

  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('\n');

  let content: QuestionnaireContent;
  try {
    // Strip markdown fences if present
    const cleaned = text.replace(/^```json?\s*\n?/m, '').replace(/\n?```\s*$/m, '');
    content = JSON.parse(cleaned);
  } catch {
    content = {
      summary: text.slice(0, 500),
      riskAssessment: 'Unable to parse structured assessment',
      questions: [],
      recommendedActions: ['Review AI output manually and regenerate if needed'],
    };
  }

  return {
    content,
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
  };
}

/**
 * Store a questionnaire in the database
 */
export async function storeQuestionnaire(
  orgId: string,
  productId: string,
  userId: string,
  dep: RiskyDependency,
  content: QuestionnaireContent
): Promise<SupplierQuestionnaire> {
  const result = await pool.query(`
    INSERT INTO supplier_questionnaires (
      org_id, product_id, dependency_name, dependency_version, dependency_purl,
      dependency_ecosystem, dependency_license, dependency_supplier,
      risk_flags, questionnaire_content, status, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'generated', $11)
    RETURNING *
  `, [
    orgId, productId, dep.name, dep.version, dep.purl,
    dep.ecosystem, dep.license, dep.supplier,
    JSON.stringify(dep.riskFlags), JSON.stringify(content), userId,
  ]);

  return rowToQuestionnaire(result.rows[0]);
}

/**
 * List questionnaires for a product
 */
export async function listQuestionnaires(
  productId: string,
  orgId: string
): Promise<SupplierQuestionnaire[]> {
  const result = await pool.query(
    `SELECT * FROM supplier_questionnaires WHERE product_id = $1 AND org_id = $2 ORDER BY created_at DESC`,
    [productId, orgId]
  );
  return result.rows.map(rowToQuestionnaire);
}

/**
 * Get a single questionnaire
 */
export async function getQuestionnaire(
  id: string,
  orgId: string
): Promise<SupplierQuestionnaire | null> {
  const result = await pool.query(
    `SELECT * FROM supplier_questionnaires WHERE id = $1 AND org_id = $2`,
    [id, orgId]
  );
  return result.rows.length > 0 ? rowToQuestionnaire(result.rows[0]) : null;
}

/**
 * Update questionnaire status
 */
export async function updateQuestionnaireStatus(
  id: string,
  orgId: string,
  status: 'generated' | 'sent' | 'responded' | 'reviewed'
): Promise<SupplierQuestionnaire | null> {
  const result = await pool.query(
    `UPDATE supplier_questionnaires SET status = $3, updated_at = NOW() WHERE id = $1 AND org_id = $2 RETURNING *`,
    [id, orgId, status]
  );
  return result.rows.length > 0 ? rowToQuestionnaire(result.rows[0]) : null;
}

/**
 * Delete all questionnaires for a product (for regeneration)
 */
export async function deleteQuestionnaires(
  productId: string,
  orgId: string
): Promise<number> {
  const result = await pool.query(
    `DELETE FROM supplier_questionnaires WHERE product_id = $1 AND org_id = $2`,
    [productId, orgId]
  );
  return result.rowCount || 0;
}

function rowToQuestionnaire(row: any): SupplierQuestionnaire {
  return {
    id: row.id,
    orgId: row.org_id,
    productId: row.product_id,
    dependencyName: row.dependency_name,
    dependencyVersion: row.dependency_version,
    dependencyPurl: row.dependency_purl,
    dependencyEcosystem: row.dependency_ecosystem,
    dependencyLicense: row.dependency_license,
    dependencySupplier: row.dependency_supplier,
    riskFlags: typeof row.risk_flags === 'string' ? JSON.parse(row.risk_flags) : (row.risk_flags || []),
    questionnaireContent: typeof row.questionnaire_content === 'string'
      ? JSON.parse(row.questionnaire_content)
      : (row.questionnaire_content || {}),
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

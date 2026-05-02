/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

/**
 * Document Templates Service
 *
 * Provides CRA compliance document templates that users can download,
 * populate with their product-specific details, and upload to their Tech File.
 *
 * Templates use {{PLACEHOLDER}} syntax for user-replaceable values.
 * The generate flow auto-populates from product/org data and marks
 * remaining fields with [REVIEW] markers.
 */

import pool from '../db/pool.js';
import { getDriver } from '../db/neo4j.js';
import { VERSIONING_POLICY_TEMPLATE } from './document-templates/versioning-policy.js';
import { CVD_POLICY_TEMPLATE } from './document-templates/cvd-policy.js';
import { VULNERABILITY_HANDLING_TEMPLATE } from './document-templates/vulnerability-handling.js';
import { SECURITY_UPDATE_TEMPLATE } from './document-templates/security-update.js';
import { INCIDENT_RESPONSE_TEMPLATE } from './document-templates/incident-response.js';
import { END_OF_SUPPORT_TEMPLATE } from './document-templates/end-of-support.js';
import { SECURE_DEV_LIFECYCLE_TEMPLATE } from './document-templates/secure-dev-lifecycle.js';

export interface DocumentTemplate {
  id: string;
  title: string;
  craArticle: string;
  description: string;
  techFileSection: string;
  filename: string;
}

export interface GenerateContext {
  productId: string;
  orgId: string;
  /** Optional overrides from the user */
  versionFormat?: string;
  securitySuffix?: string;
}

interface PopulatedData {
  productName: string;
  orgName: string;
  distributionModel: string;
  version: string;
  stakeholders: Record<string, { name: string; email: string }>;
}

/** Template catalogue – metadata only (no content) */
export const TEMPLATE_CATALOGUE: DocumentTemplate[] = [
  {
    id: 'versioning-security-release-policy',
    title: 'Versioning & Security Release Policy',
    craArticle: 'Article 13(9)',
    description: 'Defines how your organisation separates security updates from feature releases. Covers versioning scheme, branching strategy, security release procedure, response timelines, user communication, and evidence retention. Required to demonstrate that security patches can be deployed independently of functionality changes.',
    techFileSection: 'Art. 13 – Security Properties',
    filename: 'versioning-and-security-release-policy.md',
  },
  {
    id: 'cvd-policy',
    title: 'Coordinated Vulnerability Disclosure Policy',
    craArticle: 'Article 13(6)',
    description: 'Public-facing policy describing how external security researchers can report vulnerabilities, what to expect during the handling process, response timelines, safe harbour provisions, and recognition. Required to demonstrate a documented and accessible CVD process aligned with ISO 29147.',
    techFileSection: 'Art. 13 – Security Properties',
    filename: 'coordinated-vulnerability-disclosure-policy.md',
  },
  {
    id: 'vulnerability-handling-process',
    title: 'Vulnerability Handling Process',
    craArticle: 'Article 13(5)',
    description: 'Internal process for managing the full vulnerability lifecycle: detection, triage, remediation, verification, and disclosure. Covers tooling integration, severity-based response timelines, and evidence retention. References CRANIS2 AI-assisted triage and IDE-based remediation via MCP tools.',
    techFileSection: 'Art. 13 – Security Properties',
    filename: 'vulnerability-handling-process.md',
  },
  {
    id: 'security-update-procedure',
    title: 'Security Update Procedure',
    craArticle: 'Article 13(8)',
    description: 'Defines how security updates are developed, tested, and deployed free of charge. Covers update types, development workflow, testing requirements, deployment procedures, and the CRA requirement to provide security updates without cost to the user.',
    techFileSection: 'Art. 13 – Security Properties',
    filename: 'security-update-procedure.md',
  },
  {
    id: 'incident-response-plan',
    title: 'Incident Response Plan',
    craArticle: 'Article 14',
    description: 'ENISA notification procedures for actively exploited vulnerabilities and severe incidents. Covers the three-stage reporting process (early warning, notification, final report), internal response procedures, stakeholder communication, and post-incident review.',
    techFileSection: 'Art. 14 – Incident Response',
    filename: 'incident-response-plan.md',
  },
  {
    id: 'end-of-support-policy',
    title: 'End-of-Support Policy',
    craArticle: 'Article 13(15)',
    description: 'Defines the support period commitment for your product, the obligations that apply during that period, the wind-down process, user notification procedures, and post-support responsibilities. Ensures transparent communication of the support lifecycle.',
    techFileSection: 'Art. 13 – Support & Maintenance',
    filename: 'end-of-support-policy.md',
  },
  {
    id: 'secure-development-lifecycle',
    title: 'Secure Development Lifecycle',
    craArticle: 'Annex I, Part I',
    description: 'Security-by-design practices covering threat modelling, secure coding standards, dependency management, SBOM generation, testing requirements, and compliance verification. Demonstrates that security is integrated throughout the product development process.',
    techFileSection: 'Annex I – Design & Development',
    filename: 'secure-development-lifecycle.md',
  },
];

/** Returns the full Markdown content for a given template ID */
export function getTemplateContent(id: string): string | null {
  const fn = templateContentMap[id];
  return fn ? fn() : null;
}

/** Generates a pre-filled template for a specific product */
export async function generateTemplateForProduct(id: string, ctx: GenerateContext): Promise<string | null> {
  const rawContent = getTemplateContent(id);
  if (!rawContent) return null;

  const data = await fetchProductData(ctx.productId, ctx.orgId);
  if (!data) return null;

  const today = new Date().toISOString().slice(0, 10);
  const deliveryModel = mapDistributionModel(data.distributionModel);
  const versionFormat = ctx.versionFormat || inferVersionFormat(data.version);
  const securitySuffix = ctx.securitySuffix || '-sec1';

  // Find the tech file section for this template (for the auto-gen notice)
  const templateMeta = TEMPLATE_CATALOGUE.find(t => t.id === id);
  const techSection = templateMeta?.techFileSection || 'the appropriate section';

  // Replace placeholders
  let content = rawContent
    .replace(/\{\{PRODUCT_NAME\}\}/g, data.productName)
    .replace(/\{\{ORG_NAME\}\}/g, data.orgName)
    .replace(/\{\{EFFECTIVE_DATE\}\}/g, today)
    .replace(/\{\{VERSION_FORMAT\}\}/g, versionFormat)
    .replace(/\{\{SECURITY_SUFFIX\}\}/g, securitySuffix)
    .replace(/\{\{DELIVERY_MODEL\}\}/g, deliveryModel);

  // Replace stakeholder placeholders
  const stakeholderPlaceholders: Record<string, string> = {
    'SECURITY_CONTACT': formatStakeholder(data.stakeholders['security_contact'], 'security contact'),
    'MANUFACTURER_CONTACT': formatStakeholder(data.stakeholders['manufacturer_contact'], 'manufacturer contact'),
    'COMPLIANCE_OFFICER': formatStakeholder(data.stakeholders['compliance_officer'], 'compliance officer'),
    'TECHNICAL_FILE_OWNER': formatStakeholder(data.stakeholders['technical_file_owner'], 'technical file owner'),
    'INCIDENT_RESPONSE_LEAD': formatStakeholder(data.stakeholders['incident_response_lead'], 'incident response lead'),
  };
  for (const [key, value] of Object.entries(stakeholderPlaceholders)) {
    content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  // Replace the generic roles table with populated version (versioning template)
  content = content.replace(
    /\| Role \| Responsibility \|[\s\S]*?\| \*\*Compliance Officer\*\* \|[^\n]*\n\n> \*\*Note:\*\* Adapt the roles above to match your actual team structure\./,
    buildRolesTable(data.stakeholders)
  );

  // Replace the instructions block generically (all templates use the same header)
  content = content.replace(
    /> \*\*INSTRUCTIONS – DELETE THIS SECTION BEFORE FINALISING\*\*[\s\S]*?\n\n---/,
    `> **REVIEW BEFORE FINALISING**
>
> This document was auto-generated by CRANIS2 from your product and
> organisation data. Fields marked with **[REVIEW]** need your attention.
>
> **Next steps:**
> 1. Review all sections, particularly timelines, roles, and process details
> 2. Adjust any [REVIEW] fields to match your actual process
> 3. Have the document reviewed and approved by the appropriate stakeholders
>
> **Where to store the completed document:**
> Paste the finalised content into your product's **Tech File** in
> CRANIS2 under the **${techSection}** section.

---`
  );

  // Select the correct delivery model section (for templates that include model-specific content)
  const modelLower = deliveryModel.toLowerCase();
  if (modelLower.includes('saas') || modelLower.includes('hosted')) {
    content = content.replace(
      /> \*\*Note:\*\* Complete this section based on your delivery model \([^)]*\)\.\n\n/g, ''
    );
    content = content.replace(
      /\*\*For on-premises \/ distributed products:\*\*\n(?:[^\n]*\n){1,3}\n/g, ''
    );
  } else if (modelLower.includes('on-premises') || modelLower.includes('binary') || modelLower.includes('embedded')) {
    content = content.replace(
      /> \*\*Note:\*\* Complete this section based on your delivery model \([^)]*\)\.\n\n/g, ''
    );
    content = content.replace(
      /\*\*For SaaS products:\*\*\n(?:[^\n]*\n){1,3}\n/g, ''
    );
  }

  return content;
}

function formatStakeholder(person: { name: string; email: string } | undefined, fallback: string): string {
  if (!person || (!person.name && !person.email)) return `[REVIEW: assign ${fallback}]`;
  if (person.name && person.email) return `${person.name} (${person.email})`;
  return person.name || person.email;
}

// ─── Data fetching ──────────────────────────────────────────────────────────────

async function fetchProductData(productId: string, orgId: string): Promise<PopulatedData | null> {
  const session = getDriver().session();
  try {
    // Fetch product and org from Neo4j
    const result = await session.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p.name AS productName, p.version AS version, p.distributionModel AS distributionModel,
              o.name AS orgName`,
      { orgId, productId }
    );
    if (result.records.length === 0) return null;

    const rec = result.records[0];

    // Fetch stakeholders from Postgres
    const stakeholderResult = await pool.query(
      `SELECT role_key, name, email FROM stakeholders
       WHERE org_id = $1 AND (product_id = $2 OR product_id IS NULL)
         AND email IS NOT NULL AND email != ''
       ORDER BY product_id DESC NULLS LAST`,
      [orgId, productId]
    );

    const stakeholders: Record<string, { name: string; email: string }> = {};
    for (const row of stakeholderResult.rows) {
      // Product-level overrides org-level (ordered by product_id DESC NULLS LAST)
      if (!stakeholders[row.role_key]) {
        stakeholders[row.role_key] = { name: row.name || '', email: row.email || '' };
      }
    }

    return {
      productName: rec.get('productName') || '',
      orgName: rec.get('orgName') || '',
      distributionModel: rec.get('distributionModel') || '',
      version: rec.get('version') || '',
      stakeholders,
    };
  } finally {
    await session.close();
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function mapDistributionModel(model: string): string {
  const map: Record<string, string> = {
    saas_hosted: 'SaaS (centrally hosted)',
    proprietary_binary: 'On-premises (distributed binary)',
    source_available: 'Source-available (distributed)',
    library_component: 'Library / component (distributed via package registry)',
    internal_only: 'Internal use only',
  };
  return map[model] || model || '[REVIEW: specify delivery model]';
}

function inferVersionFormat(version: string): string {
  if (!version) return '[REVIEW: e.g. MAJOR.MINOR.PATCH or YYYY.MM.DD.NNNN]';
  // Detect common patterns
  if (/^\d{4}\.\d{2}\.\d{2}/.test(version)) return 'YYYY.MM.DD.NNNN';
  if (/^\d+\.\d+\.\d+$/.test(version)) return 'MAJOR.MINOR.PATCH';
  if (/^\d+\.\d+$/.test(version)) return 'MAJOR.MINOR';
  return version + ' [REVIEW]';
}

function buildRolesTable(stakeholders: Record<string, { name: string; email: string }>): string {
  const sec = stakeholders['security_contact'];
  const mfr = stakeholders['manufacturer_contact'];
  const compliance = stakeholders['compliance_officer'];
  const techFile = stakeholders['technical_file_owner'];
  const incident = stakeholders['incident_response_lead'];

  function formatPerson(role: { name: string; email: string } | undefined, fallback: string): string {
    if (!role || (!role.name && !role.email)) return `[REVIEW: assign ${fallback}]`;
    if (role.name && role.email) return `${role.name} (${role.email})`;
    return role.name || role.email;
  }

  return `| Role | Assigned to | Responsibility |
|---|---|---|
| **Product Owner** | ${formatPerson(techFile, 'technical file owner')} | Classifies each release; approves mixed releases (exceptional cases only) |
| **Security Lead** | ${formatPerson(sec, 'security contact')} | Triages vulnerabilities; validates fix completeness; reviews security-only releases |
| **Engineering Team** | ${formatPerson(mfr, 'manufacturer contact')} | Develops fixes on isolated branches; ensures no feature code in security releases |
| **Incident Response** | ${formatPerson(incident, 'incident response lead')} | Coordinates response to actively exploited vulnerabilities; manages disclosure timeline |
| **Compliance Officer** | ${formatPerson(compliance, 'compliance officer')} | Verifies this policy is followed; maintains evidence for CRA technical file |`;
}

// ─── Template content generators ───────────────────────────────────────────────

const templateContentMap: Record<string, () => string> = {
  'versioning-security-release-policy': () => VERSIONING_POLICY_TEMPLATE,
  'cvd-policy': () => CVD_POLICY_TEMPLATE,
  'vulnerability-handling-process': () => VULNERABILITY_HANDLING_TEMPLATE,
  'security-update-procedure': () => SECURITY_UPDATE_TEMPLATE,
  'incident-response-plan': () => INCIDENT_RESPONSE_TEMPLATE,
  'end-of-support-policy': () => END_OF_SUPPORT_TEMPLATE,
  'secure-development-lifecycle': () => SECURE_DEV_LIFECYCLE_TEMPLATE,
};


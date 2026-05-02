/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import { Request, Response } from 'express';
import pool from '../../db/pool.js';
import { getDriver } from '../../db/neo4j.js';
import { verifySessionToken } from '../../utils/token.js';

// ─── Auth middleware ─────────────────────────────────────────
export async function requireAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) { res.status(401).json({ error: 'No token provided' }); return; }
  const token = authHeader.split(' ')[1];
  try {
    const payload = verifySessionToken(token);
    if (!payload) { res.status(401).json({ error: 'Invalid token' }); return; }
    (req as any).userId = payload.userId;
    (req as any).email = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export async function getUserOrgId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.org_id || null;
}

// ─── Default sections per CRA Annex VII ──────────────────────
export const DEFAULT_SECTIONS = [
  {
    section_key: 'product_description',
    title: 'Product Description',
    cra_reference: 'Annex VII §1',
    content: {
      guidance: 'Describe the product including its intended purpose, software versions affecting cybersecurity compliance, how it is made available on the market, and user information/instructions per Annex II.',
      fields: {
        intended_purpose: '',
        versions_affecting_compliance: '',
        market_availability: '',
        user_instructions_reference: '',
      }
    }
  },
  {
    section_key: 'design_development',
    title: 'Design & Development',
    cra_reference: 'Annex VII §2(a)',
    content: {
      guidance: 'Document the design and development process including system architecture drawings/schemes, how software components build on each other, and how they integrate into the overall processing. Include SDLC process description.',
      fields: {
        architecture_description: '',
        component_interactions: '',
        sdlc_process: '',
        production_monitoring: '',
      }
    }
  },
  {
    section_key: 'vulnerability_handling',
    title: 'Vulnerability Handling',
    cra_reference: 'Annex VII §2(b)',
    content: {
      guidance: 'Document vulnerability handling processes: coordinated vulnerability disclosure policy, reporting contact address, secure update distribution mechanism, and reference to the SBOM (managed in Dependencies tab).',
      fields: {
        disclosure_policy_url: '',
        reporting_contact: '',
        update_distribution_mechanism: '',
        security_update_policy: '',
        sbom_reference: 'See Dependencies tab – auto-generated from GitHub repository.',
      }
    }
  },
  {
    section_key: 'risk_assessment',
    title: 'Cybersecurity Risk Assessment',
    cra_reference: 'Annex VII §3, Article 13(2)',
    content: {
      guidance: 'Document the cybersecurity risk assessment considering intended purpose and foreseeable use. Must demonstrate how each Annex I Part I essential requirement is addressed, or justify why it is not applicable.',
      fields: {
        methodology: '',
        threat_model: '',
        risk_register: '',
      },
      annex_i_requirements: [
        { ref: 'I(a)', title: 'No known exploitable vulnerabilities', applicable: true, justification: '', evidence: '' },
        { ref: 'I(b)', title: 'Secure-by-default configuration', applicable: true, justification: '', evidence: '' },
        { ref: 'I(c)', title: 'Security update mechanism', applicable: true, justification: '', evidence: '' },
        { ref: 'I(d)', title: 'Access control & authentication', applicable: true, justification: '', evidence: '' },
        { ref: 'I(e)', title: 'Data confidentiality & encryption', applicable: true, justification: '', evidence: '' },
        { ref: 'I(f)', title: 'Data & command integrity', applicable: true, justification: '', evidence: '' },
        { ref: 'I(g)', title: 'Data minimisation', applicable: true, justification: '', evidence: '' },
        { ref: 'I(h)', title: 'Availability & resilience', applicable: true, justification: '', evidence: '' },
        { ref: 'I(i)', title: 'Minimise impact on other services', applicable: true, justification: '', evidence: '' },
        { ref: 'I(j)', title: 'Attack surface limitation', applicable: true, justification: '', evidence: '' },
        { ref: 'I(k)', title: 'Exploitation mitigation', applicable: true, justification: '', evidence: '' },
        { ref: 'I(l)', title: 'Security event logging & monitoring', applicable: true, justification: '', evidence: '' },
        { ref: 'I(m)', title: 'Secure data deletion & transfer', applicable: true, justification: '', evidence: '' },
      ]
    }
  },
  {
    section_key: 'standards_applied',
    title: 'Standards & Specifications Applied',
    cra_reference: 'Annex VII §4',
    content: {
      guidance: 'List harmonised standards, common specifications, or European cybersecurity certification schemes applied. If none exist yet, list any relevant standards (ISO 27001, IEC 62443, OWASP, etc.).',
      standards: [],
    }
  },
  {
    section_key: 'test_reports',
    title: 'Test Reports & Evidence',
    cra_reference: 'Annex VII §5',
    content: {
      guidance: 'Document all testing evidence: vulnerability scans, penetration tests, code audits, third-party assessments. Reference scan results from the Risk Findings tab.',
      reports: [],
    }
  },
  {
    section_key: 'declaration_of_conformity',
    title: 'EU Declaration of Conformity',
    cra_reference: 'Annex VII §6, Article 28',
    content: {
      guidance: 'The EU Declaration of Conformity states that the essential requirements in Annex I have been fulfilled. It must follow the structure specified in Annex V of the CRA. Complete the fields below to generate the DoC.',
      fields: {
        declaration_text: '',
        notified_body: '',
        certificate_reference: '',
        assessment_module: '',
        ce_marking_date: '',
      }
    }
  },
  {
    section_key: 'support_period',
    title: 'Support Period',
    cra_reference: 'Article 13(8), Annex II §7',
    content: {
      guidance: 'Specify the expected product lifetime and the support period during which vulnerability handling will be provided. CRA requires a minimum of 5 years. Must be indicated on the product and in the DoC.',
      fields: {
        end_date: '',
        justification: '',
        communication_plan: '',
      }
    }
  },
];

// ─── Helper: ensure sections exist for a product ─────────────
export async function ensureSections(productId: string): Promise<void> {
  const values: string[] = [];
  const params: any[] = [];
  let idx = 1;

  for (const section of DEFAULT_SECTIONS) {
    values.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4})`);
    params.push(productId, section.section_key, section.title, JSON.stringify(section.content), section.cra_reference);
    idx += 5;
  }

  await pool.query(
    `INSERT INTO technical_file_sections (product_id, section_key, title, content, cra_reference)
     VALUES ${values.join(', ')}
     ON CONFLICT (product_id, section_key) DO NOTHING`,
    params
  );
}

// ─── Helper: update Neo4j TechnicalFile node ─────────────────
export async function updateTechFileNode(productId: string): Promise<void> {
  const result = await pool.query(
    `SELECT status FROM technical_file_sections WHERE product_id = $1`,
    [productId]
  );
  const rows = result.rows;
  const total = rows.length;
  const completed = rows.filter((r: any) => r.status === 'completed').length;
  const inProgress = rows.filter((r: any) => r.status === 'in_progress').length;

  let overallStatus = 'not_started';
  if (completed === total && total > 0) overallStatus = 'completed';
  else if (completed > 0 || inProgress > 0) overallStatus = 'in_progress';

  const neo4jSession = getDriver().session();
  try {
    await neo4jSession.run(
      `MATCH (p:Product {id: $productId})
       MERGE (p)-[:HAS_TECHNICAL_FILE]->(tf:TechnicalFile {productId: $productId})
       SET tf.status = $status,
           tf.completedSections = $completed,
           tf.totalSections = $total,
           tf.updatedAt = datetime()`,
      { productId, status: overallStatus, completed, total }
    );
  } finally {
    await neo4jSession.close();
  }
}

export function formatCraCategory(cat: string | null): string {
  switch (cat) {
    case 'default': return 'Default';
    case 'important_i': return 'Important (Class I)';
    case 'important_ii': return 'Important (Class II)';
    case 'critical': return 'Critical';
    default: return cat || 'Unclassified';
  }
}

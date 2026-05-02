/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

import { Router, Request, Response } from 'express';
import { getDriver } from '../db/neo4j.js';
import pool from '../db/pool.js';
import { verifySessionToken } from '../utils/token.js';

const router = Router();

// ─── Auth middleware ─────────────────────────────────────────
async function requireAuth(req: Request, res: Response, next: Function) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) { res.status(401).json({ error: 'No token provided' }); return; }
  const token = authHeader.split(' ')[1];
  try {
    const payload = verifySessionToken(token);
    if (!payload) { res.status(401).json({ error: 'Invalid token' }); return; }
    (req as any).userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

async function getUserOrgId(userId: string): Promise<string | null> {
  const result = await pool.query('SELECT org_id FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.org_id || null;
}

// CRA compliance deadlines (fixed dates per Regulation (EU) 2024/2847)
export const DEADLINES = [
  {
    id: 'incident_reporting',
    label: 'Incident reporting obligations (Art. 14)',
    date: '2026-09-11',
  },
  {
    id: 'full_compliance',
    label: 'Full CRA compliance deadline',
    date: '2027-12-11',
  },
];

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── GET /api/products/:productId/compliance-checklist ────────
router.get('/:productId/compliance-checklist', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const orgId = await getUserOrgId(userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const productId = req.params.productId as string;

  // Verify product belongs to org and fetch product + org metadata from Neo4j
  const neo4jSession = getDriver().session();
  let productName: string;
  let craCategory: string | null;
  let repoUrl: string | null;
  let craRole: string;

  try {
    const result = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p.name AS name, p.craCategory AS craCategory, p.repoUrl AS repoUrl, o.craRole AS craRole`,
      { orgId, productId }
    );
    if (result.records.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const rec = result.records[0];
    productName = rec.get('name') || productId;
    craCategory = rec.get('craCategory') || null;
    repoUrl = rec.get('repoUrl') || null;
    craRole = rec.get('craRole') || 'manufacturer';
  } finally {
    await neo4jSession.close();
  }

  // Run all Postgres checks in parallel
  // Does this product require a notified body assessment?
  const requiresNb = craCategory === 'important_ii' || craCategory === 'critical';

  const requiresMs = craCategory === 'critical';

  const [
    sbomResult,
    scanResult,
    openFindingsResult,
    techSectionsResult,
    stakeholderResult,
    packageResult,
    nbAssessmentResult,
    msRegistrationResult,
  ] = await Promise.all([
    // Step 1: SBOM exists
    pool.query(`SELECT 1 FROM product_sboms WHERE product_id = $1 LIMIT 1`, [productId]),
    // Step 3: Completed scans
    pool.query(
      `SELECT COUNT(*)::int AS scan_count FROM vulnerability_scans WHERE product_id = $1 AND status = 'completed'`,
      [productId]
    ),
    // Step 3: Open findings
    pool.query(
      `SELECT COUNT(*)::int AS open_count FROM vulnerability_findings
       WHERE product_id = $1 AND org_id = $2 AND status = 'open'`,
      [productId, orgId]
    ),
    // Steps 4 + 6: Key technical file sections
    pool.query(
      `SELECT section_key, status FROM technical_file_sections
       WHERE product_id = $1 AND section_key IN ('product_description', 'vulnerability_handling', 'risk_assessment', 'declaration_of_conformity')`,
      [productId]
    ),
    // Step 5: Stakeholder contacts (org-level manufacturer + product-level security)
    pool.query(
      `SELECT role_key, email FROM stakeholders
       WHERE org_id = $1 AND role_key IN ('manufacturer_contact', 'security_contact')
       AND (product_id IS NULL OR product_id = $2)`,
      [orgId, productId]
    ),
    // Step 7: Compliance package ever downloaded
    pool.query(
      `SELECT 1 FROM user_events WHERE event_type = 'due_diligence_exported' AND metadata->>'productId' = $1 LIMIT 1`,
      [productId]
    ),
    // NB assessment status (only relevant for important_ii/critical)
    requiresNb
      ? pool.query(
          `SELECT status FROM notified_body_assessments WHERE org_id = $1 AND product_id = $2 LIMIT 1`,
          [orgId, productId]
        )
      : Promise.resolve({ rows: [] }),
    // MS registration status (only relevant for critical)
    requiresMs
      ? pool.query(
          `SELECT status FROM market_surveillance_registrations WHERE org_id = $1 AND product_id = $2 LIMIT 1`,
          [orgId, productId]
        )
      : Promise.resolve({ rows: [] }),
  ]);

  // Process results
  const hasSbom = sbomResult.rows.length > 0;
  const scanCount = scanResult.rows[0]?.scan_count || 0;
  const openFindings = openFindingsResult.rows[0]?.open_count || 0;

  const techSections: Record<string, string> = {};
  for (const row of techSectionsResult.rows) {
    techSections[row.section_key] = row.status;
  }

  const stakeholderEmails: Record<string, string> = {};
  for (const row of stakeholderResult.rows) {
    stakeholderEmails[row.role_key] = row.email || '';
  }

  const hasPackage = packageResult.rows.length > 0;
  const nbAssessmentStatus = nbAssessmentResult.rows[0]?.status || null;
  const hasNbApproved = nbAssessmentStatus === 'approved';
  const msRegistrationStatus = msRegistrationResult.rows[0]?.status || null;
  const hasMsRegistered = msRegistrationStatus === 'registered';

  // ── Step completion logic (shared) ──
  const hasCraCategory = !!craCategory;
  const hasScans = scanCount > 0 && openFindings === 0;
  const hasTechMin =
    (techSections['product_description'] ?? 'not_started') !== 'not_started' &&
    (techSections['vulnerability_handling'] ?? 'not_started') !== 'not_started' &&
    (techSections['risk_assessment'] ?? 'not_started') !== 'not_started';
  const hasStakeholders =
    (stakeholderEmails['manufacturer_contact'] ?? '').length > 0 &&
    (stakeholderEmails['security_contact'] ?? '').length > 0;
  const hasDoC = (techSections['declaration_of_conformity'] ?? 'not_started') !== 'not_started';

  // ── Role-specific steps ──
  const isImporter = craRole === 'importer';
  const isDistributor = craRole === 'distributor';

  let steps;

  if (isImporter) {
    steps = [
      {
        id: 'set_category',
        step: 1,
        title: 'Set your CRA product category',
        description: 'Classify the product as Default, Important (Class I/II), or Critical. This determines the conformity assessment route the manufacturer must follow.',
        complete: hasCraCategory,
        actionLabel: 'Edit product',
        actionTab: 'overview',
        actionPath: null,
      },
      {
        id: 'verify_manufacturer',
        step: 2,
        title: 'Verify manufacturer conformity (Art. 18(1))',
        description: 'Confirm that the manufacturer has carried out the appropriate conformity assessment and that the product bears the CE marking.',
        complete: hasDoC,
        actionLabel: 'Go to Technical File',
        actionTab: 'technical-file',
        actionPath: null,
      },
      {
        id: 'verify_documentation',
        step: 3,
        title: 'Verify technical documentation (Art. 18(2))',
        description: 'Ensure the manufacturer can make the EU Declaration of Conformity and technical documentation available to market surveillance authorities upon request.',
        complete: hasTechMin,
        actionLabel: 'Go to Technical File',
        actionTab: 'technical-file',
        actionPath: null,
      },
      {
        id: 'importer_contact',
        step: 4,
        title: 'Add importer contact details (Art. 18(6))',
        description: 'Your name, registered trade name or trademark, and postal/email address must appear on the product or its packaging.',
        complete: hasStakeholders,
        actionLabel: 'Go to Stakeholders',
        actionTab: null,
        actionPath: '/stakeholders',
      },
      {
        id: 'triage_findings',
        step: 5,
        title: 'Review vulnerability findings',
        description: 'As an importer, you must not place a product on the market if you have reason to believe it does not meet essential CRA requirements. Review any known vulnerability findings.',
        complete: hasScans,
        actionLabel: 'Go to Risk Findings',
        actionTab: 'risk-findings',
        actionPath: null,
      },
      {
        id: 'compliance_package',
        step: 6,
        title: 'Download your compliance package',
        description: 'Generate the compliance package with the EU Declaration of Conformity and supporting documentation. Retain for 10 years (Art. 18(8)).',
        complete: hasPackage,
        actionLabel: 'Technical Files',
        actionTab: null,
        actionPath: '/technical-files',
      },
    ];
  } else if (isDistributor) {
    steps = [
      {
        id: 'set_category',
        step: 1,
        title: 'Set your CRA product category',
        description: 'Classify the product as Default, Important (Class I/II), or Critical. This determines the conformity assessment route.',
        complete: hasCraCategory,
        actionLabel: 'Edit product',
        actionTab: 'overview',
        actionPath: null,
      },
      {
        id: 'verify_markings',
        step: 2,
        title: 'Verify CE marking and documentation (Art. 19(1))',
        description: 'Before making the product available, verify that it bears the CE marking, is accompanied by the EU Declaration of Conformity, and that manufacturer and importer details are present.',
        complete: hasDoC,
        actionLabel: 'Go to Technical File',
        actionTab: 'technical-file',
        actionPath: null,
      },
      {
        id: 'handling_conditions',
        step: 3,
        title: 'Ensure proper handling conditions (Art. 19(2))',
        description: 'Ensure that while the product is under your responsibility, storage or transport conditions do not jeopardise its compliance with essential requirements.',
        complete: hasTechMin,
        actionLabel: 'Go to Technical File',
        actionTab: 'technical-file',
        actionPath: null,
      },
      {
        id: 'triage_findings',
        step: 4,
        title: 'Review vulnerability findings',
        description: 'As a distributor, you must not make a product available if you have reason to believe it does not conform to CRA essential requirements.',
        complete: hasScans,
        actionLabel: 'Go to Risk Findings',
        actionTab: 'risk-findings',
        actionPath: null,
      },
      {
        id: 'compliance_package',
        step: 5,
        title: 'Download your compliance package',
        description: 'Generate the compliance package with the EU Declaration of Conformity and supporting documentation. Retain for 10 years (Art. 19(6)).',
        complete: hasPackage,
        actionLabel: 'Technical Files',
        actionTab: null,
        actionPath: '/technical-files',
      },
    ];
  } else {
    // Manufacturer / open source steward — original 7 steps
    steps = [
      {
        id: 'connect_repo',
        step: 1,
        title: 'Connect repository and sync SBOM',
        description: 'Connect your source repository and generate an SBOM. The SBOM is required under CRA Article 13(11) and must be kept up to date.',
        complete: !!repoUrl && hasSbom,
        actionLabel: 'Go to Dependencies',
        actionTab: 'dependencies',
        actionPath: null,
      },
      {
        id: 'set_category',
        step: 2,
        title: 'Set your CRA product category',
        description: 'Classify your product as Default, Important (Class I/II), or Critical. This determines your conformity assessment route and which obligations apply.',
        complete: hasCraCategory,
        actionLabel: 'Edit product',
        actionTab: 'overview',
        actionPath: null,
      },
      {
        id: 'triage_findings',
        step: 3,
        title: 'Run vulnerability scan and triage findings',
        description: 'CRA Article 13(5) requires no known exploitable vulnerabilities at market placement. Run a scan and resolve or acknowledge all open findings.',
        complete: hasScans,
        actionLabel: 'Go to Risk Findings',
        actionTab: 'risk-findings',
        actionPath: null,
      },
      {
        id: 'technical_file',
        step: 4,
        title: 'Complete minimum technical file',
        description: 'Start sections 1 (Product Description), 3 (Vulnerability Handling), and 4 (Risk Assessment) of your Technical File per CRA Annex VII.',
        complete: hasTechMin,
        actionLabel: 'Go to Technical File',
        actionTab: 'technical-file',
        actionPath: null,
      },
      {
        id: 'stakeholders',
        step: 5,
        title: 'Set up stakeholder contacts',
        description: 'Add a manufacturer contact (CRA Article 13) and a product security contact (CRA Article 11). These appear in your EU Declaration of Conformity.',
        complete: hasStakeholders,
        actionLabel: 'Go to Stakeholders',
        actionTab: null,
        actionPath: '/stakeholders',
      },
      {
        id: 'eu_doc',
        step: 6,
        title: 'Begin EU Declaration of Conformity',
        description: 'Complete section 8 of your Technical File to draw up the EU Declaration of Conformity required by CRA Article 16 before placing the product on the market.',
        complete: hasDoC,
        actionLabel: 'Go to Technical File',
        actionTab: 'technical-file',
        actionPath: null,
      },
    ];

    // Insert NB assessment step for important_ii/critical products (after DoC, before package)
    let nextStep = 7;
    if (requiresNb) {
      steps.push({
        id: 'nb_assessment',
        step: nextStep++,
        title: 'Complete notified body assessment',
        description: craCategory === 'critical'
          ? 'Critical products require Module H (full quality assurance) assessment by an EU notified body under CRA Article 32(3).'
          : 'Important Class II products require Module B+C (EU-type examination + conformity to type) assessment by an EU notified body under CRA Article 32(3).',
        complete: hasNbApproved,
        actionLabel: 'Go to Overview',
        actionTab: 'overview',
        actionPath: null,
      });
    }

    // Insert MS registration step for critical products only (CRA Art. 20)
    if (requiresMs) {
      steps.push({
        id: 'ms_registration',
        step: nextStep++,
        title: 'Register with market surveillance authority',
        description: 'Critical products must be registered with the relevant national market surveillance authority before being placed on the EU market (CRA Art. 20). Your registration package includes manufacturer details, product identification, and conformity assessment references.',
        complete: hasMsRegistered,
        actionLabel: 'Go to Overview',
        actionTab: 'overview',
        actionPath: null,
      });
    }

    steps.push({
        id: 'compliance_package',
        step: nextStep,
        title: 'Download your compliance package',
        description: 'Generate and download the Due Diligence compliance package – a ZIP containing your SBOM, vulnerability summary, technical file, and EU Declaration of Conformity.',
        complete: hasPackage,
        actionLabel: 'Technical Files',
        actionTab: null,
        actionPath: '/technical-files',
      },
    );
  }

  const stepsComplete = steps.filter(s => s.complete).length;

  res.json({
    craRole,
    productId,
    productName,
    stepsComplete,
    stepsTotal: steps.length,
    complete: stepsComplete === steps.length,
    deadlines: DEADLINES.map(d => ({ ...d, daysRemaining: daysUntil(d.date) })),
    steps,
  });
});

export default router;

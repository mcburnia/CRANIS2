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

  // Verify product belongs to org and fetch product metadata from Neo4j
  const neo4jSession = getDriver().session();
  let productName: string;
  let craCategory: string | null;
  let repoUrl: string | null;

  try {
    const result = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p.name AS name, p.craCategory AS craCategory, p.repoUrl AS repoUrl`,
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
  } finally {
    await neo4jSession.close();
  }

  // Run all Postgres checks in parallel
  const [
    sbomResult,
    scanResult,
    openFindingsResult,
    techSectionsResult,
    stakeholderResult,
    packageResult,
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

  // ── Step completion logic ──
  const step1Complete = !!repoUrl && hasSbom;
  const step2Complete = !!craCategory;
  const step3Complete = scanCount > 0 && openFindings === 0;
  const step4Complete =
    (techSections['product_description'] ?? 'not_started') !== 'not_started' &&
    (techSections['vulnerability_handling'] ?? 'not_started') !== 'not_started' &&
    (techSections['risk_assessment'] ?? 'not_started') !== 'not_started';
  const step5Complete =
    (stakeholderEmails['manufacturer_contact'] ?? '').length > 0 &&
    (stakeholderEmails['security_contact'] ?? '').length > 0;
  const step6Complete = (techSections['declaration_of_conformity'] ?? 'not_started') !== 'not_started';
  const step7Complete = hasPackage;

  const steps = [
    {
      id: 'connect_repo',
      step: 1,
      title: 'Connect repository and sync SBOM',
      description: 'Connect your source repository and generate an SBOM. The SBOM is required under CRA Article 13(11) and must be kept up to date.',
      complete: step1Complete,
      actionLabel: 'Go to Dependencies',
      actionTab: 'dependencies',
      actionPath: null,
    },
    {
      id: 'set_category',
      step: 2,
      title: 'Set your CRA product category',
      description: 'Classify your product as Default, Important (Class I/II), or Critical. This determines your conformity assessment route and which obligations apply.',
      complete: step2Complete,
      actionLabel: 'Edit product',
      actionTab: 'overview',
      actionPath: null,
    },
    {
      id: 'triage_findings',
      step: 3,
      title: 'Run vulnerability scan and triage findings',
      description: 'CRA Article 13(5) requires no known exploitable vulnerabilities at market placement. Run a scan and resolve or acknowledge all open findings.',
      complete: step3Complete,
      actionLabel: 'Go to Risk Findings',
      actionTab: 'risk-findings',
      actionPath: null,
    },
    {
      id: 'technical_file',
      step: 4,
      title: 'Complete minimum technical file',
      description: 'Start sections 1 (Product Description), 3 (Vulnerability Handling), and 4 (Risk Assessment) of your Technical File per CRA Annex VII.',
      complete: step4Complete,
      actionLabel: 'Go to Technical File',
      actionTab: 'technical-file',
      actionPath: null,
    },
    {
      id: 'stakeholders',
      step: 5,
      title: 'Set up stakeholder contacts',
      description: 'Add a manufacturer contact (CRA Article 13) and a product security contact (CRA Article 11). These appear in your EU Declaration of Conformity.',
      complete: step5Complete,
      actionLabel: 'Go to Stakeholders',
      actionTab: null,
      actionPath: '/stakeholders',
    },
    {
      id: 'eu_doc',
      step: 6,
      title: 'Begin EU Declaration of Conformity',
      description: 'Complete section 8 of your Technical File to draw up the EU Declaration of Conformity required by CRA Article 16 before placing the product on the market.',
      complete: step6Complete,
      actionLabel: 'Go to Technical File',
      actionTab: 'technical-file',
      actionPath: null,
    },
    {
      id: 'compliance_package',
      step: 7,
      title: 'Download your compliance package',
      description: 'Generate and download the Due Diligence compliance package – a ZIP containing your SBOM, vulnerability summary, technical file, and EU Declaration of Conformity.',
      complete: step7Complete,
      actionLabel: 'Technical Files',
      actionTab: null,
      actionPath: '/technical-files',
    },
  ];

  const stepsComplete = steps.filter(s => s.complete).length;

  res.json({
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

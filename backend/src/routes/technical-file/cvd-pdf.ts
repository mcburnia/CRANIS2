import { Router, Request, Response } from 'express';
import { getDriver } from '../../db/neo4j.js';
import pool from '../../db/pool.js';
import { requireAuth, getUserOrgId, ensureSections } from './shared.js';

const router = Router();

interface CvdData {
  productName: string;
  orgName: string;
  orgCountry: string | null;
  securityContactName: string;
  securityContactEmail: string;
  reportingContact: string;
  updateMechanism: string;
  supportPeriodEnd: string | null;
  isDraft: boolean;
  dateStr: string;
}

function generateCvdPolicyMarkdown(data: CvdData): string {
  const lines: string[] = [];

  lines.push('REGULATION (EU) 2024/2847 — CYBER RESILIENCE ACT');
  lines.push('');
  lines.push('# COORDINATED VULNERABILITY DISCLOSURE POLICY');
  lines.push('');

  if (data.isDraft) {
    lines.push('> **DRAFT — Not yet finalised**');
    lines.push('');
  }

  lines.push(`**${data.productName}** — ${data.orgName}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Section 1
  lines.push('## 1. Introduction');
  lines.push('');
  lines.push(
    `${data.orgName} is committed to the security of ${data.productName}. We welcome and encourage ` +
    `security researchers to report vulnerabilities they discover. This Coordinated Vulnerability ` +
    `Disclosure (CVD) policy describes how to report vulnerabilities to us, what to expect in ` +
    `return, and our commitment to responsible handling of reported issues.`
  );
  lines.push('');
  lines.push(
    `This policy is established in accordance with Article 13(6) and Annex I, Part II of the ` +
    `EU Cyber Resilience Act (Regulation (EU) 2024/2847).`
  );
  lines.push('');

  // Section 2
  lines.push('## 2. Scope');
  lines.push('');
  lines.push(
    `This policy applies to ${data.productName} and all associated components, libraries, ` +
    `and services distributed or maintained by ${data.orgName}.`
  );
  lines.push('');

  // Section 3
  lines.push('## 3. How to Report a Vulnerability');
  lines.push('');
  const contactInfo = data.securityContactEmail || data.reportingContact || '[security contact to be confirmed]';
  lines.push('Please report security vulnerabilities to:');
  lines.push('');
  lines.push(`> ${contactInfo}`);
  if (data.securityContactName) {
    lines.push(`> Contact: ${data.securityContactName}`);
  }
  lines.push('');
  lines.push('When reporting, please include:');
  lines.push('');
  lines.push(`- A description of the vulnerability and its potential impact`);
  lines.push(`- Step-by-step instructions to reproduce the issue`);
  lines.push(`- The affected version(s) of ${data.productName}`);
  lines.push(`- Any proof-of-concept code (if available)`);
  lines.push(`- Your preferred contact details for follow-up`);
  lines.push('');
  lines.push('Please do not report security vulnerabilities through public issue trackers.');
  lines.push('');

  // Section 4
  lines.push('## 4. What to Expect');
  lines.push('');
  lines.push('Upon receiving your report, we will:');
  lines.push('');
  lines.push('- Acknowledge receipt within 5 business days');
  lines.push('- Provide an initial assessment within 15 business days');
  lines.push('- Work with you to understand and validate the finding');
  lines.push('- Develop and test a fix');
  lines.push('- Coordinate public disclosure within 90 days of the initial report');
  lines.push('');
  lines.push(
    'We may adjust the 90-day disclosure timeline if the vulnerability is particularly complex ' +
    'or if a fix requires coordination with third parties. We will keep you informed of progress throughout.'
  );
  lines.push('');

  // Section 5
  lines.push('## 5. Our Commitment');
  lines.push('');
  lines.push('- We will not pursue legal action against researchers who report vulnerabilities in good faith and in accordance with this policy.');
  lines.push('- We will credit researchers in security advisories unless anonymity is requested.');
  lines.push('- We will provide timely security updates free of charge for the duration of the support period.');
  lines.push('- We will distribute security updates separately from feature updates where technically feasible.');
  lines.push('');

  // Section 6
  lines.push('## 6. Security Update Distribution');
  lines.push('');
  const mechanism = data.updateMechanism || 'Security updates will be distributed through the product\'s standard update channel.';
  lines.push(mechanism);
  lines.push('');

  // Section 7
  lines.push('## 7. Support Period');
  lines.push('');
  if (data.supportPeriodEnd) {
    lines.push(
      `${data.orgName} will provide security updates and vulnerability handling for ` +
      `${data.productName} until ${data.supportPeriodEnd}. After this date, the product ` +
      `will no longer receive security updates.`
    );
  } else {
    lines.push(
      `${data.orgName} will provide security updates and vulnerability handling for ` +
      `${data.productName} for a minimum of 5 years from the date of market placement, ` +
      `in accordance with CRA Article 13(6). The specific end date will be communicated ` +
      `in the product documentation.`
    );
  }
  lines.push('');

  // Section 8
  lines.push('## 8. Safe Harbour');
  lines.push('');
  lines.push(
    `${data.orgName} considers security research conducted in accordance with this policy ` +
    `to be authorised. We will not initiate or support legal proceedings against researchers ` +
    `who make a good-faith effort to comply with this policy.`
  );
  lines.push('');
  lines.push(
    `If legal action is initiated by a third party against a researcher for activities that ` +
    `were conducted in accordance with this policy, we will make this authorisation known.`
  );
  lines.push('');

  // Signature block
  lines.push('---');
  lines.push('');
  lines.push(`**Issued by:** ${data.orgName}`);
  if (data.orgCountry) lines.push(`${data.orgCountry}`);
  lines.push('');
  lines.push(`**Effective date:** ${data.dateStr}`);
  lines.push('');
  lines.push('');
  lines.push('_________________________');
  lines.push('Authorised signatory');
  lines.push('');
  lines.push('---');
  lines.push(`*CVD Policy — generated by CRANIS2 — ${new Date().toLocaleDateString('en-GB')}*`);

  return lines.join('\n');
}

// ─── GET /api/technical-file/:productId/cvd-policy/pdf ────────────
router.get('/:productId/cvd-policy/pdf', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const orgId = await getUserOrgId(userId);
  if (!orgId) { res.status(403).json({ error: 'No organisation found' }); return; }

  const productId = req.params.productId as string;

  // Verify product belongs to org and fetch product + org data
  const neo4jSession = getDriver().session();
  let productName: string;
  let orgName: string;
  let orgCountry: string | null;

  try {
    const result = await neo4jSession.run(
      `MATCH (o:Organisation {id: $orgId})<-[:BELONGS_TO]-(p:Product {id: $productId})
       RETURN p.name AS name, o.name AS orgName, o.country AS orgCountry`,
      { orgId, productId }
    );
    if (result.records.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const rec = result.records[0];
    productName = rec.get('name') || productId;
    orgName = rec.get('orgName') || 'Unknown Organisation';
    orgCountry = rec.get('orgCountry') || null;
  } finally {
    await neo4jSession.close();
  }

  // Fetch sections + stakeholders in parallel
  await ensureSections(productId);

  const [sectResult, stakeholderResult] = await Promise.all([
    pool.query(
      `SELECT section_key, content, status
       FROM technical_file_sections
       WHERE product_id = $1 AND section_key IN ('vulnerability_handling', 'support_period')`,
      [productId]
    ),
    pool.query(
      `SELECT role_key, name, email FROM stakeholders
       WHERE org_id = $1 AND (product_id = $2 OR product_id IS NULL)
         AND role_key IN ('security_contact', 'manufacturer_contact')
         AND email IS NOT NULL AND email != ''
       ORDER BY product_id DESC NULLS LAST`,
      [orgId, productId]
    ),
  ]);

  let reportingContact = '';
  let updateMechanism = '';
  let vulnHandlingStatus = 'not_started';
  let supportPeriodEnd: string | null = null;

  for (const row of sectResult.rows) {
    const content = typeof row.content === 'string' ? JSON.parse(row.content) : row.content;
    const fields = content.fields || content;
    if (row.section_key === 'vulnerability_handling') {
      reportingContact = fields.reporting_contact || '';
      updateMechanism = fields.update_distribution_mechanism || '';
      vulnHandlingStatus = row.status;
    } else if (row.section_key === 'support_period') {
      supportPeriodEnd = fields.end_date || null;
      if (supportPeriodEnd) {
        try {
          supportPeriodEnd = new Date(supportPeriodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        } catch { /* keep raw string */ }
      }
    }
  }

  // Find best security contact
  let securityContactName = '';
  let securityContactEmail = '';
  for (const row of stakeholderResult.rows) {
    if (row.role_key === 'security_contact') {
      securityContactName = row.name || '';
      securityContactEmail = row.email || '';
      break;
    }
  }
  // Fall back to manufacturer contact if no security contact
  if (!securityContactEmail) {
    for (const row of stakeholderResult.rows) {
      if (row.role_key === 'manufacturer_contact') {
        securityContactName = row.name || '';
        securityContactEmail = row.email || '';
        break;
      }
    }
  }

  const isDraft = vulnHandlingStatus !== 'completed';
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const safeName = productName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const filename = `cvd-policy-${safeName}-${new Date().toISOString().slice(0, 10)}.md`;

  try {
    const md = generateCvdPolicyMarkdown({
      productName, orgName, orgCountry,
      securityContactName, securityContactEmail,
      reportingContact, updateMechanism, supportPeriodEnd,
      isDraft, dateStr,
    });
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(md);
  } catch (err) {
    console.error('Failed to generate CVD policy:', err);
    res.status(500).json({ error: 'Failed to generate CVD policy' });
  }
});

export default router;

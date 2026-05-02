/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

/**
 * Non-Compliance Reporting Guide — Public Page Template
 *
 * Step-by-step guide for what to do when a manufacturer discovers
 * their product is non-compliant with the CRA, based on Art. 19(3)
 * and related obligations.
 */

function nonCompliancePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Non-Compliance Reporting Guide \u2013 CRA \u2013 CRANIS2</title>
<meta name="description" content="What to do when you discover your product is non-compliant with the CRA. Step-by-step guide covering assessment, corrective measures, authority notification, and documentation requirements.">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #111827; min-height: 100vh; }
  .page { max-width: 880px; margin: 0 auto; padding: 48px 20px 80px; }
  .brand { font-size: 13px; font-weight: 700; color: #a855f7; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
  .brand a { color: inherit; text-decoration: none; }
  h1 { font-size: 28px; font-weight: 700; color: #111827; margin-bottom: 8px; line-height: 1.3; }
  .subtitle { font-size: 15px; color: #6b7280; margin-bottom: 32px; line-height: 1.7; max-width: 700px; }
  .step-card { background: white; border-radius: 12px; border: 1px solid #e5e7eb; padding: 24px 28px; margin-bottom: 16px; position: relative; }
  .step-card::before { content: attr(data-step); position: absolute; left: -14px; top: 24px; width: 28px; height: 28px; border-radius: 50%; background: #a855f7; color: white; font-size: 13px; font-weight: 700; text-align: center; line-height: 28px; }
  .step-card h2 { font-size: 16px; font-weight: 700; margin-bottom: 8px; padding-left: 20px; }
  .step-card .ref { font-size: 11px; color: #a855f7; font-weight: 600; margin-bottom: 10px; padding-left: 20px; }
  .step-card p { font-size: 14px; color: #4b5563; line-height: 1.6; margin-bottom: 8px; }
  .step-card ul { font-size: 13px; color: #4b5563; line-height: 1.8; padding-left: 36px; margin-bottom: 8px; }
  .warning-box { background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; }
  .warning-box strong { color: #92400e; }
  .warning-box p { font-size: 13px; color: #92400e; line-height: 1.6; }
  .role-section { background: white; border-radius: 12px; border: 1px solid #e5e7eb; padding: 24px 28px; margin-bottom: 16px; }
  .role-section h2 { font-size: 16px; font-weight: 700; margin-bottom: 12px; }
  .role-tag { display: inline-block; padding: 2px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; }
  .role-tag.mfg { background: #ede9fe; color: #7c3aed; }
  .role-tag.imp { background: #dbeafe; color: #2563eb; }
  .role-tag.dist { background: #d1fae5; color: #059669; }
  .role-item { padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #4b5563; line-height: 1.6; }
  .role-item:last-child { border-bottom: none; }
  .cta-box { background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); border: 1px solid #ddd6fe; border-radius: 12px; padding: 28px 32px; margin-top: 32px; text-align: center; }
  .cta-box h3 { font-size: 18px; font-weight: 700; color: #5b21b6; margin-bottom: 8px; }
  .cta-box p { font-size: 14px; color: #6b7280; margin-bottom: 16px; line-height: 1.6; }
  .cta-btn { display: inline-block; padding: 12px 28px; border-radius: 8px; background: #a855f7; color: white; font-size: 15px; font-weight: 600; text-decoration: none; transition: background 0.15s; }
  .cta-btn:hover { background: #9333ea; }
  .back-link { margin-bottom: 24px; }
  .back-link a { font-size: 13px; color: #a855f7; text-decoration: none; }
  .back-link a:hover { text-decoration: underline; }
  .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #9ca3af; }
  .footer a { color: #a855f7; text-decoration: none; }
</style>
</head>
<body>
<div class="page">
  <div class="back-link"><a href="/conformity-assessment">\u2190 Back to all assessments</a></div>
  <div class="brand"><a href="/welcome">CRANIS2</a></div>
  <h1>Non-Compliance Reporting Guide</h1>
  <p class="subtitle">
    What to do when you discover your product does not conform to the essential
    cybersecurity requirements of the Cyber Resilience Act. This guide covers
    the steps required of manufacturers, importers, and distributors.
  </p>

  <div class="warning-box">
    <strong>Important:</strong>
    <p>Discovering non-compliance is not a failure \u2014 it is a normal part of
       product lifecycle management. The CRA requires prompt, structured action.
       The key obligations are to stop making the product available, take corrective
       measures, and inform the relevant authorities.</p>
  </div>

  <div class="step-card" data-step="1">
    <h2>Confirm the non-compliance</h2>
    <div class="ref">CRA Art. 13(2)</div>
    <p>Assess whether your product genuinely fails to meet one or more essential
       cybersecurity requirements set out in Annex I. Consider:</p>
    <ul>
      <li>Which specific requirement is not met?</li>
      <li>Is it a design flaw, implementation bug, or documentation gap?</li>
      <li>Does it affect products already on the market, or only pre-production units?</li>
      <li>What is the severity and scope of the non-compliance?</li>
    </ul>
  </div>

  <div class="step-card" data-step="2">
    <h2>Stop making the product available</h2>
    <div class="ref">CRA Art. 13(2), Art. 18(5), Art. 19(3)</div>
    <p>If the non-compliance presents a risk, you must not place the product on the
       market (or withdraw it if already available) until it has been brought into
       conformity. For software products, this may mean:</p>
    <ul>
      <li>Removing download links or disabling new installations</li>
      <li>Marking the affected version as deprecated</li>
      <li>Issuing a security advisory to existing users</li>
    </ul>
  </div>

  <div class="step-card" data-step="3">
    <h2>Take corrective measures</h2>
    <div class="ref">CRA Art. 13(9), Art. 13(6)</div>
    <p>Develop and deploy a fix, then verify it resolves the non-compliance:</p>
    <ul>
      <li>Develop a patch, configuration change, or updated version</li>
      <li>Provide the fix free of charge (Art.\u00a013(8))</li>
      <li>Distribute the fix separately from feature updates (Art.\u00a013(9))</li>
      <li>Verify the fix through testing and, where applicable, updated conformity assessment</li>
      <li>Notify all affected users of the corrective measure</li>
    </ul>
  </div>

  <div class="step-card" data-step="4">
    <h2>Notify market surveillance authorities</h2>
    <div class="ref">CRA Art. 13(2), Art. 18(5), Art. 19(3)</div>
    <p>Inform the market surveillance authorities of the member states where the
       product has been made available. Your notification should include:</p>
    <ul>
      <li>Product identification (name, version, unique identifiers)</li>
      <li>Description of the non-compliance and the risk it presents</li>
      <li>Corrective measures taken or planned</li>
      <li>The affected member states and estimated number of affected users</li>
      <li>Contact details for the responsible person</li>
    </ul>
  </div>

  <div class="step-card" data-step="5">
    <h2>If actively exploited \u2014 report to ENISA</h2>
    <div class="ref">CRA Art. 14</div>
    <p>If the non-compliance involves an actively exploited vulnerability or a
       severe incident, the ENISA reporting obligations under Art.\u00a014 apply
       in addition to the corrective measures above:</p>
    <ul>
      <li><strong>24 hours</strong> \u2014 Early warning to the designated CSIRT</li>
      <li><strong>72 hours</strong> \u2014 Notification with initial assessment</li>
      <li><strong>14 days</strong> (vulnerability) / <strong>1 month</strong> (incident) \u2014 Final report</li>
    </ul>
    <p><a href="/incident-readiness-checklist" style="color:#a855f7;">Check your incident response readiness \u2192</a></p>
  </div>

  <div class="step-card" data-step="6">
    <h2>Document everything</h2>
    <div class="ref">CRA Art. 13(10)</div>
    <p>Retain full documentation of the non-compliance event, corrective measures,
       and authority communications for at least 10 years. This forms part of your
       technical documentation and compliance audit trail.</p>
  </div>

  <!-- Role-specific obligations -->
  <div class="role-section">
    <h2>Role-specific obligations</h2>

    <div style="margin-bottom: 16px;">
      <span class="role-tag mfg">Manufacturer</span>
      <div class="role-item"><strong>Art. 13(2)</strong> \u2014 Take all necessary corrective measures to bring the product into conformity, withdraw it, or recall it.</div>
      <div class="role-item"><strong>Art. 13(9)</strong> \u2014 Provide corrective security updates free of charge and separately from feature updates.</div>
      <div class="role-item"><strong>Art. 14</strong> \u2014 Report to ENISA if the non-compliance involves an actively exploited vulnerability.</div>
    </div>

    <div style="margin-bottom: 16px;">
      <span class="role-tag imp">Importer</span>
      <div class="role-item"><strong>Art. 18(5)</strong> \u2014 Do not place or continue to make available a product you believe is non-compliant. Inform the manufacturer and market surveillance authorities.</div>
      <div class="role-item"><strong>Art. 18(7)</strong> \u2014 Report actively exploited vulnerabilities to ENISA within the same timelines as Art.\u00a014.</div>
    </div>

    <div>
      <span class="role-tag dist">Distributor</span>
      <div class="role-item"><strong>Art. 19(3)</strong> \u2014 Do not make available a product you believe is non-compliant. Inform the manufacturer or importer and market surveillance authorities.</div>
      <div class="role-item"><strong>Art. 19(4)</strong> \u2014 Report actively exploited vulnerabilities to ENISA within the same timelines as Art.\u00a014.</div>
    </div>
  </div>

  <div class="cta-box">
    <h3>Track non-compliance resolution</h3>
    <p>CRANIS2 tracks corrective actions, generates ENISA reports with AI-assisted
       drafting, and maintains the full audit trail \u2014 so you can demonstrate
       compliance to market surveillance authorities.</p>
    <a href="https://dev.cranis2.dev" class="cta-btn">Manage compliance in CRANIS2</a>
  </div>

  <div class="footer">
    <a href="/incident-readiness-checklist">Incident readiness</a> &middot;
    <a href="/market-surveillance-registration">Market surveillance</a> &middot;
    <a href="/conformity-assessment">Free compliance assessments</a> &middot;
    <a href="/welcome">Learn more about CRANIS2</a>
  </div>
</div>
</body>
</html>`;
}

module.exports = { nonCompliancePage };

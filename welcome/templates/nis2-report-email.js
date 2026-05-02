/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

const { SECTIONS, QUESTIONS, ENTITY_LABELS } = require('../data/nis2-questions');

function buildReportEmail(answers, scores, entityClass, entityDetails, recommendations, escapeHtml, getUnsubscribeUrl) {
  const entityLabel = ENTITY_LABELS[entityClass] || 'Not Determined';
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const sectionBars = SECTIONS.map(s => {
    const sc = scores.sections[s.id];
    const barColor = sc.pct >= 75 ? '#10b981' : sc.pct >= 50 ? '#f59e0b' : sc.pct >= 25 ? '#f97316' : '#ef4444';
    return `<tr>
      <td style="padding:6px 12px 6px 0;font-size:13px;color:#374151;white-space:nowrap;">${s.title}</td>
      <td style="padding:6px 0;width:100%;">
        <div style="background:#f3f4f6;border-radius:4px;height:20px;position:relative;">
          <div style="background:${barColor};border-radius:4px;height:20px;width:${sc.pct}%;min-width:${sc.pct > 0 ? '2px' : '0'};"></div>
        </div>
      </td>
      <td style="padding:6px 0 6px 12px;font-size:13px;color:#111827;font-weight:600;white-space:nowrap;">${sc.pct}%</td>
      <td style="padding:6px 0 6px 8px;font-size:11px;color:#6b7280;white-space:nowrap;">${sc.level}</td>
    </tr>`;
  }).join('\n');

  const questionDetails = SECTIONS.map(section => {
    const sectionQs = QUESTIONS.filter(q => SECTIONS[q.section].id === section.id);
    const rows = sectionQs.map(q => {
      const ansIdx = answers[q.id];
      const answered = ansIdx !== undefined && ansIdx !== null;
      const score = answered ? q.options[ansIdx].score : 0;
      const label = answered ? q.options[ansIdx].label : 'Not answered';
      const dots = [0,1,2,3].map(i =>
        `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:3px;background:${i <= score - 1 ? '#2563eb' : '#e5e7eb'};"></span>`
      ).join('');
      return `<tr>
        <td style="padding:6px 8px 6px 0;font-size:12px;color:#374151;vertical-align:top;">${q.question}</td>
        <td style="padding:6px 0;font-size:12px;color:#6b7280;vertical-align:top;white-space:nowrap;">${dots}</td>
      </tr>
      <tr><td colspan="2" style="padding:0 0 10px 0;font-size:11px;color:#9ca3af;">${label}</td></tr>`;
    }).join('\n');
    return `<tr><td colspan="2" style="padding:16px 0 6px 0;font-size:14px;font-weight:600;color:#111827;border-bottom:1px solid #e5e7eb;">${section.title}</td></tr>\n${rows}`;
  }).join('\n');

  const recRows = recommendations.map(r => {
    const priorityColor = r.priority === 'high' ? '#ef4444' : '#f59e0b';
    const priorityLabel = r.priority === 'high' ? 'HIGH' : 'MEDIUM';
    return `<tr>
      <td style="padding:8px 8px 8px 0;vertical-align:top;">
        <span style="font-size:10px;font-weight:700;color:${priorityColor};text-transform:uppercase;">${priorityLabel}</span>
      </td>
      <td style="padding:8px 0;font-size:13px;color:#374151;vertical-align:top;">
        <strong>${r.question}</strong><br>
        <span style="font-size:12px;color:#6b7280;">Next step: ${r.target}</span><br>
        <span style="font-size:11px;color:#a855f7;">${r.nis2_reference}</span>
      </td>
    </tr>`;
  }).join('\n');

  const overallColor = scores.overallPct >= 75 ? '#10b981' : scores.overallPct >= 50 ? '#f59e0b' : scores.overallPct >= 25 ? '#f97316' : '#ef4444';

  // Supervision colour
  const isInScope = entityClass !== 'not_in_scope';
  const isEssential = entityClass === 'essential' || entityClass === 'essential_critical';
  const supervisionColor = isEssential ? '#f59e0b' : isInScope ? '#3b82f6' : '#10b981';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;">
<div style="max-width:640px;margin:0 auto;padding:32px 20px;">

<!-- Header -->
<div style="text-align:center;margin-bottom:32px;">
  <div style="font-size:13px;font-weight:700;color:#a855f7;text-transform:uppercase;letter-spacing:0.05em;">CRANIS2</div>
  <h1 style="font-size:24px;color:#111827;margin:8px 0 4px;">NIS2 Readiness Assessment Report</h1>
  <p style="font-size:13px;color:#6b7280;">${date}</p>
</div>

<!-- Overall Score -->
<div style="background:white;border-radius:12px;border:1px solid #e5e7eb;padding:24px;margin-bottom:20px;text-align:center;">
  <div style="font-size:48px;font-weight:700;color:${overallColor};">${scores.overallPct}%</div>
  <div style="font-size:14px;color:#6b7280;margin-bottom:16px;">Overall NIS2 Readiness</div>

  <div style="display:inline-block;background:#f3f4f6;border-radius:8px;padding:12px 24px;margin-bottom:16px;">
    <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Entity Classification</div>
    <div style="font-size:16px;font-weight:700;color:#111827;">${entityLabel}</div>
  </div>

  <div style="margin-top:8px;">
    <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Supervision Regime</div>
    <div style="font-size:14px;font-weight:600;color:#111827;">${entityDetails.supervision}</div>
    <div style="font-size:12px;color:${supervisionColor};font-weight:600;margin-top:4px;">
      Maximum penalty: ${entityDetails.penalties}
    </div>
  </div>
</div>

<!-- Entity Classification Detail -->
<div style="background:white;border-radius:12px;border:1px solid #e5e7eb;padding:24px;margin-bottom:20px;">
  <h2 style="font-size:16px;color:#111827;margin:0 0 12px;">Your NIS2 Classification</h2>
  <p style="font-size:13px;color:#4b5563;line-height:1.6;margin:0 0 8px;">${entityDetails.description}</p>
  <p style="font-size:12px;color:#6b7280;font-style:italic;margin:0;">${entityDetails.regime}</p>
</div>

<!-- Section Breakdown -->
<div style="background:white;border-radius:12px;border:1px solid #e5e7eb;padding:24px;margin-bottom:20px;">
  <h2 style="font-size:16px;color:#111827;margin:0 0 16px;">Maturity Breakdown</h2>
  <table style="width:100%;border-collapse:collapse;">
    ${sectionBars}
  </table>
</div>

<!-- Detailed Answers -->
<div style="background:white;border-radius:12px;border:1px solid #e5e7eb;padding:24px;margin-bottom:20px;">
  <h2 style="font-size:16px;color:#111827;margin:0 0 8px;">Detailed Responses</h2>
  <table style="width:100%;border-collapse:collapse;">
    ${questionDetails}
  </table>
</div>

<!-- Recommendations -->
${recommendations.length > 0 ? `
<div style="background:white;border-radius:12px;border:1px solid #e5e7eb;padding:24px;margin-bottom:20px;">
  <h2 style="font-size:16px;color:#111827;margin:0 0 16px;">Priority Recommendations</h2>
  <p style="font-size:13px;color:#6b7280;margin:0 0 16px;">Based on your responses, these are the areas where action would have the most impact on your NIS2 readiness:</p>
  <table style="width:100%;border-collapse:collapse;">
    ${recRows}
  </table>
</div>
` : ''}

<!-- CTA -->
<div style="background:white;border-radius:12px;border:1px solid #e5e7eb;padding:28px;text-align:center;margin-bottom:20px;">
  <h2 style="font-size:18px;color:#111827;margin:0 0 8px;">CRANIS2 Is Coming Soon</h2>
  <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0 0 16px;">We\u2019re building a platform that helps you manage every aspect of cybersecurity compliance, from NIS2 governance and risk management to CRA product compliance, vulnerability scanning, and supply chain security.</p>
  <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0 0 16px;"><a href="https://dev.cranis2.dev/welcome" style="color:#a855f7;text-decoration:none;font-weight:600;">Learn more about CRANIS2 \u2192</a></p>
  <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0 0 20px;">Already assessed your products for CRA? Try our <a href="https://dev.cranis2.dev/cra-conformity-assessment" style="color:#a855f7;text-decoration:none;font-weight:600;">free CRA Readiness Assessment</a> too.</p>
</div>

<!-- Footer -->
<div style="text-align:center;font-size:11px;color:#9ca3af;margin-top:24px;">
  <p>This assessment is for guidance only and does not constitute legal advice. Consult with a qualified professional for specific compliance requirements.</p>
  <p style="margin-top:8px;">\u00a9 CRANIS2 ${new Date().getFullYear()} \u2013 EU Cybersecurity Compliance Platform</p>
</div>

</div>
</body>
</html>`;
}

module.exports = { buildReportEmail };

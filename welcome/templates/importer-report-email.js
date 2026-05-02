/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

const { SECTIONS, QUESTIONS } = require('../data/importer-questions');

function buildReportEmail(answers, scores, readiness, recommendations) {
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
    const priorityBadge = r.priority === 'high'
      ? '<span style="display:inline-block;background:#fef2f2;color:#dc2626;font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;margin-right:6px;">HIGH</span>'
      : '<span style="display:inline-block;background:#fffbeb;color:#d97706;font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;margin-right:6px;">MEDIUM</span>';
    return `<tr>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;vertical-align:top;">
        ${priorityBadge}
        <span style="font-size:12px;font-weight:600;color:#111827;">${r.question}</span><br>
        <span style="font-size:11px;color:#6b7280;margin-top:4px;display:inline-block;">${r.section} \u2022 ${r.cra_reference}</span><br>
        <span style="font-size:11px;color:#16a34a;margin-top:2px;display:inline-block;">\u2192 ${r.target}</span>
      </td>
    </tr>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
<tr><td align="center" style="padding:40px 20px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:12px;border:1px solid #e5e7eb;">

<!-- Header -->
<tr><td style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:32px 28px;border-radius:12px 12px 0 0;">
  <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.1em;">CRANIS2</div>
  <div style="font-size:22px;font-weight:700;color:white;margin-top:8px;">Importer Obligations Assessment</div>
  <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px;">${date}</div>
</td></tr>

<!-- Overall score -->
<tr><td style="padding:28px;">
  <div style="text-align:center;margin-bottom:20px;">
    <div style="font-size:56px;font-weight:700;color:${readiness.colour};line-height:1;">${scores.overallPct}%</div>
    <div style="font-size:14px;color:#6b7280;margin-top:4px;">Importer Readiness Score</div>
    <div style="margin-top:8px;display:inline-block;background:${readiness.colour}20;color:${readiness.colour};font-size:13px;font-weight:600;padding:4px 14px;border-radius:16px;">${readiness.level}</div>
  </div>
  <p style="font-size:13px;color:#6b7280;line-height:1.6;text-align:center;">${readiness.advice}</p>
</td></tr>

<!-- Section scores -->
<tr><td style="padding:0 28px 28px;">
  <h3 style="font-size:15px;font-weight:700;color:#111827;margin-bottom:12px;">Section Scores</h3>
  <table width="100%" cellpadding="0" cellspacing="0">${sectionBars}</table>
</td></tr>

<!-- Recommendations -->
${recommendations.length > 0 ? `<tr><td style="padding:0 28px 28px;">
  <h3 style="font-size:15px;font-weight:700;color:#111827;margin-bottom:12px;">Priority Actions</h3>
  <table width="100%" cellpadding="0" cellspacing="0">${recRows}</table>
</td></tr>` : ''}

<!-- Detail -->
<tr><td style="padding:0 28px 28px;">
  <h3 style="font-size:15px;font-weight:700;color:#111827;margin-bottom:12px;">Detailed Responses</h3>
  <table width="100%" cellpadding="0" cellspacing="0">${questionDetails}</table>
</td></tr>

<!-- CTA -->
<tr><td style="padding:0 28px 28px;text-align:center;">
  <div style="background:#f5f3ff;border-radius:8px;padding:20px;">
    <div style="font-size:14px;font-weight:600;color:#111827;margin-bottom:8px;">Track your importer obligations automatically</div>
    <div style="font-size:12px;color:#6b7280;margin-bottom:12px;">CRANIS2 helps importers verify manufacturer compliance, manage documentation retention, and report vulnerabilities to ENISA.</div>
    <a href="https://dev.cranis2.dev/signup" style="display:inline-block;background:#a855f7;color:white;font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none;">Start Free Trial</a>
  </div>
</td></tr>

<!-- Footer -->
<tr><td style="padding:20px 28px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;">
  This report was generated by the CRANIS2 Importer Obligations Assessment tool.<br>
  CRA Article 18 references are based on Regulation (EU) 2024/2847.
</td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

module.exports = { buildReportEmail };

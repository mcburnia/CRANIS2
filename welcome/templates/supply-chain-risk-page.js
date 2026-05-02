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
 * Supply Chain Risk Assessment — Public Page Template
 *
 * Self-contained HTML page with an interactive self-assessment
 * questionnaire covering supply chain security practices aligned
 * with CRA Art. 13(5) and NIS2 Art. 21.
 */

function supplyChainRiskPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Supply Chain Risk Assessment \u2013 CRA &amp; NIS2 \u2013 CRANIS2</title>
<meta name="description" content="Rate your supply chain risk. Free interactive assessment covering dependency management, vulnerability monitoring, supplier visibility, licence compliance, and incident readiness. Aligned with CRA Art. 13(5) and NIS2 Art. 21.">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f8fafc; color: #111827; min-height: 100vh;
  }
  .page { max-width: 880px; margin: 0 auto; padding: 48px 20px 80px; }
  .brand { font-size: 13px; font-weight: 700; color: #a855f7; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
  .brand a { color: inherit; text-decoration: none; }
  h1 { font-size: 28px; font-weight: 700; color: #111827; margin-bottom: 8px; line-height: 1.3; }
  .subtitle { font-size: 15px; color: #6b7280; margin-bottom: 32px; line-height: 1.7; max-width: 700px; }

  .q-card {
    background: white; border-radius: 12px; border: 1px solid #e5e7eb;
    padding: 24px 28px; margin-bottom: 16px;
  }
  .q-card h2 { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
  .q-card .q-desc { font-size: 13px; color: #6b7280; margin-bottom: 14px; line-height: 1.5; }
  .q-card .q-ref { font-size: 11px; color: #a855f7; font-weight: 600; margin-bottom: 12px; }

  .q-item {
    display: flex; align-items: flex-start; gap: 10px; padding: 10px 0;
    border-bottom: 1px solid #f3f4f6;
  }
  .q-item:last-child { border-bottom: none; }
  .q-label { font-size: 14px; color: #111827; line-height: 1.5; }
  .q-options { display: flex; gap: 6px; margin-top: 6px; }
  .q-opt {
    padding: 4px 14px; border-radius: 5px; border: 1px solid #e5e7eb;
    background: white; cursor: pointer; font-size: 12px; font-weight: 600;
    font-family: inherit; transition: all 0.15s;
  }
  .q-opt:hover { border-color: #a855f7; }
  .q-opt.selected { background: #a855f7; color: white; border-color: #a855f7; }
  .q-opt.yes { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
  .q-opt.partial { background: #fef3c7; color: #92400e; border-color: #fde68a; }
  .q-opt.no { background: #fee2e2; color: #991b1b; border-color: #fecaca; }

  .assess-btn {
    display: block; width: 100%; padding: 14px; border: none; border-radius: 8px;
    background: #a855f7; color: white; font-size: 16px; font-weight: 700;
    cursor: pointer; font-family: inherit; transition: background 0.15s; margin-top: 24px;
  }
  .assess-btn:hover { background: #9333ea; }

  .results-box {
    background: white; border-radius: 12px; border: 2px solid #e5e7eb;
    padding: 28px 32px; margin-top: 24px; display: none;
  }
  .results-box.show { display: block; }
  .results-box h2 { font-size: 20px; font-weight: 700; margin-bottom: 16px; }
  .score-bar-container { background: #f3f4f6; border-radius: 8px; height: 24px; margin-bottom: 16px; overflow: hidden; }
  .score-bar {
    height: 100%; border-radius: 8px; transition: width 0.5s ease;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; color: white; min-width: 40px;
  }
  .score-bar.high { background: #22c55e; }
  .score-bar.medium { background: #f59e0b; }
  .score-bar.low { background: #ef4444; }

  .area-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px 0; border-bottom: 1px solid #f3f4f6;
  }
  .area-row:last-child { border-bottom: none; }
  .area-name { font-size: 14px; font-weight: 500; }
  .area-badge { font-size: 12px; font-weight: 600; padding: 2px 10px; border-radius: 4px; }
  .area-badge.good { background: #dcfce7; color: #166534; }
  .area-badge.partial { background: #fef3c7; color: #92400e; }
  .area-badge.poor { background: #fee2e2; color: #991b1b; }

  .recs { margin-top: 20px; }
  .recs h3 { font-size: 15px; font-weight: 700; margin-bottom: 10px; }
  .rec-item {
    font-size: 13px; color: #4b5563; line-height: 1.6; padding: 6px 0 6px 16px;
    border-left: 3px solid #fde68a; margin-bottom: 4px;
  }

  .cta-box {
    background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
    border: 1px solid #ddd6fe; border-radius: 12px;
    padding: 28px 32px; margin-top: 32px; text-align: center;
  }
  .cta-box h3 { font-size: 18px; font-weight: 700; color: #5b21b6; margin-bottom: 8px; }
  .cta-box p { font-size: 14px; color: #6b7280; margin-bottom: 16px; line-height: 1.6; }
  .cta-btn {
    display: inline-block; padding: 12px 28px; border-radius: 8px;
    background: #a855f7; color: white; font-size: 15px; font-weight: 600;
    text-decoration: none; transition: background 0.15s;
  }
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
  <h1>Supply Chain Risk Assessment</h1>
  <p class="subtitle">
    How well do you manage third-party risk in your software supply chain?
    This self-assessment covers five key areas aligned with CRA Art.\u00a013(5)
    (component due diligence) and NIS2 Art.\u00a021 (supply chain security measures).
    Answer each question to receive a risk rating with actionable recommendations.
  </p>

  <div id="questions"></div>

  <button class="assess-btn" onclick="showResults()">Assess my supply chain risk</button>

  <div class="results-box" id="results"></div>

  <div class="cta-box">
    <h3>Automate your supply chain risk analysis</h3>
    <p>CRANIS2 automatically scores your supply chain risk from real SBOM data \u2014
       vulnerability exposure, licence compliance, supplier visibility, and concentration
       risk \u2014 all computed continuously from your connected repositories.</p>
    <a href="https://dev.cranis2.dev" class="cta-btn">Analyse your supply chain in CRANIS2</a>
  </div>

  <div class="footer">
    <a href="/incident-readiness-checklist">Incident readiness</a> &middot;
    <a href="/conformity-assessment">Free compliance assessments</a> &middot;
    <a href="/welcome">Learn more about CRANIS2</a>
  </div>
</div>

<script>
var SECTIONS = [
  {
    id: 'inventory', title: '1. Dependency Inventory',
    desc: 'Do you know what third-party components are in your products?',
    ref: 'CRA Art. 13(11) \u2014 SBOM Documentation',
    questions: [
      { id: 'inv1', text: 'You maintain a Software Bill of Materials (SBOM) for every product', points: 5 },
      { id: 'inv2', text: 'Your SBOM is automatically generated from the build/dependency system', points: 4 },
      { id: 'inv3', text: 'Your SBOM is refreshed at least monthly or on every release', points: 3 },
      { id: 'inv4', text: 'Transitive (indirect) dependencies are included in your SBOM', points: 3 },
    ]
  },
  {
    id: 'vulns', title: '2. Vulnerability Monitoring',
    desc: 'Do you actively monitor for new vulnerabilities in your dependency tree?',
    ref: 'CRA Art. 13(6) \u2014 Vulnerability Handling',
    questions: [
      { id: 'vul1', text: 'You use automated tools to scan dependencies for known CVEs', points: 5 },
      { id: 'vul2', text: 'Critical/high vulnerabilities trigger an alert within 24 hours', points: 4 },
      { id: 'vul3', text: 'You have a defined SLA for patching critical dependency vulnerabilities', points: 4 },
      { id: 'vul4', text: 'You track the remediation status of every flagged vulnerability', points: 3 },
    ]
  },
  {
    id: 'supplier', title: '3. Supplier Visibility',
    desc: 'Do you know who maintains the components you depend on?',
    ref: 'CRA Art. 13(5) \u2014 Third-Party Due Diligence',
    questions: [
      { id: 'sup1', text: 'You know the maintainer or organisation behind your key dependencies', points: 4 },
      { id: 'sup2', text: 'You assess new dependencies before adopting them (security posture, maintenance activity)', points: 4 },
      { id: 'sup3', text: 'You have a process for replacing abandoned or unmaintained dependencies', points: 3 },
      { id: 'sup4', text: 'You communicate vulnerability information to component suppliers (CRA Art. 13(7))', points: 3 },
    ]
  },
  {
    id: 'licence', title: '4. Licence Compliance',
    desc: 'Are you managing licence obligations across your dependency tree?',
    ref: 'CRA Annex II \u2014 Technical Documentation',
    questions: [
      { id: 'lic1', text: 'You scan all dependencies for licence declarations', points: 4 },
      { id: 'lic2', text: 'Copyleft licences (GPL, AGPL, EUPL) are reviewed before adoption', points: 4 },
      { id: 'lic3', text: 'Dependencies with no declared licence are flagged and investigated', points: 3 },
      { id: 'lic4', text: 'Licence compatibility is verified against your distribution model', points: 3 },
    ]
  },
  {
    id: 'resilience', title: '5. Supply Chain Resilience',
    desc: 'Can your supply chain withstand disruptions and incidents?',
    ref: 'NIS2 Art. 21 \u2014 Supply Chain Security Measures',
    questions: [
      { id: 'res1', text: 'You have a contingency plan for sudden loss of a critical dependency', points: 4 },
      { id: 'res2', text: 'You assess single-point-of-failure risk (single-maintainer dependencies)', points: 3 },
      { id: 'res3', text: 'Your CI/CD pipeline would detect a compromised dependency (integrity checks, signed packages)', points: 4 },
      { id: 'res4', text: 'You review the security practices of your most critical suppliers', points: 3 },
    ]
  },
];

var answers = {};

function renderQuestions() {
  var container = document.getElementById('questions');
  container.innerHTML = SECTIONS.map(function(s) {
    var items = s.questions.map(function(q) {
      return '<div class="q-item"><div>' +
        '<div class="q-label">' + q.text + '</div>' +
        '<div class="q-options">' +
          '<button class="q-opt" data-q="' + q.id + '" data-v="yes" onclick="answer(\\'' + q.id + '\\',\\'yes\\',this)">Yes</button>' +
          '<button class="q-opt" data-q="' + q.id + '" data-v="partial" onclick="answer(\\'' + q.id + '\\',\\'partial\\',this)">Partially</button>' +
          '<button class="q-opt" data-q="' + q.id + '" data-v="no" onclick="answer(\\'' + q.id + '\\',\\'no\\',this)">No</button>' +
        '</div>' +
      '</div></div>';
    }).join('');

    return '<div class="q-card">' +
      '<h2>' + s.title + '</h2>' +
      '<div class="q-ref">' + s.ref + '</div>' +
      '<div class="q-desc">' + s.desc + '</div>' +
      items +
    '</div>';
  }).join('');
}

function answer(qId, value, btn) {
  answers[qId] = value;
  var siblings = btn.parentElement.querySelectorAll('.q-opt');
  siblings.forEach(function(b) { b.className = 'q-opt'; });
  btn.className = 'q-opt selected ' + value;
}

function showResults() {
  var totalMax = 0;
  var totalEarned = 0;
  var areaResults = [];
  var recs = [];

  SECTIONS.forEach(function(s) {
    var sMax = 0;
    var sEarned = 0;
    s.questions.forEach(function(q) {
      sMax += q.points;
      var a = answers[q.id];
      if (a === 'yes') sEarned += q.points;
      else if (a === 'partial') sEarned += Math.round(q.points * 0.5);
      if (a === 'no' || !a) recs.push({ section: s.title, text: q.text });
    });
    totalMax += sMax;
    totalEarned += sEarned;
    var pct = Math.round((sEarned / sMax) * 100);
    areaResults.push({ name: s.title, pct: pct, earned: sEarned, max: sMax });
  });

  var overallPct = Math.round((totalEarned / totalMax) * 100);
  var barClass = overallPct >= 67 ? 'high' : overallPct >= 34 ? 'medium' : 'low';

  var level;
  if (overallPct >= 80) level = 'Your supply chain risk management is strong. Focus on maintaining visibility and monitoring.';
  else if (overallPct >= 50) level = 'You have a foundation in place but gaps remain. Prioritise the recommendations below before CRA enforcement.';
  else level = 'Significant supply chain risk exposure. Address the items below as a priority.';

  var areasHtml = areaResults.map(function(a) {
    var cls = a.pct >= 75 ? 'good' : a.pct >= 40 ? 'partial' : 'poor';
    return '<div class="area-row"><span class="area-name">' + a.name + '</span>' +
      '<span class="area-badge ' + cls + '">' + a.pct + '%</span></div>';
  }).join('');

  var recsHtml = '';
  if (recs.length > 0) {
    recsHtml = '<div class="recs"><h3>Recommendations (' + recs.length + ')</h3>' +
      recs.map(function(r) {
        return '<div class="rec-item"><strong>' + r.section + ':</strong> ' + r.text + '</div>';
      }).join('') + '</div>';
  }

  var el = document.getElementById('results');
  el.innerHTML = '<h2>Supply Chain Risk Score: ' + overallPct + '%</h2>' +
    '<div class="score-bar-container"><div class="score-bar ' + barClass + '" style="width:' + Math.max(overallPct, 5) + '%">' + overallPct + '%</div></div>' +
    '<p style="font-size:14px;color:#4b5563;margin-bottom:20px;line-height:1.6;">' + level + '</p>' +
    '<div>' + areasHtml + '</div>' + recsHtml;
  el.className = 'results-box show';
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.addEventListener('DOMContentLoaded', renderQuestions);
</script>
</div>
</body>
</html>`;
}

module.exports = { supplyChainRiskPage };

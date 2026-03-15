/**
 * Incident Readiness Checklist — Public Page Template
 *
 * Self-contained HTML page with an interactive checklist that assesses
 * whether an organisation's incident response process meets CRA Art. 14
 * requirements. Scores across 6 areas and provides a readiness result.
 */

function incidentReadinessPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Incident Response Readiness Checklist \u2013 CRA Art.\u00a014 \u2013 CRANIS2</title>
<meta name="description" content="Is your incident response process CRA-ready? Free interactive checklist covering detection, assessment, containment, remediation, recovery, and post-incident review. Aligned with CRA Article 14 and ENISA reporting requirements.">
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

  /* \u2500\u2500 Checklist sections \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  .section-card {
    background: white; border-radius: 12px; border: 1px solid #e5e7eb;
    padding: 24px 28px; margin-bottom: 16px;
  }
  .section-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 16px; cursor: pointer;
  }
  .section-header h2 { font-size: 16px; font-weight: 700; }
  .section-number {
    display: inline-block; width: 28px; height: 28px; border-radius: 50%;
    background: #f3f4f6; color: #6b7280; font-size: 13px; font-weight: 700;
    text-align: center; line-height: 28px; margin-right: 10px;
  }
  .section-number.complete { background: #dcfce7; color: #166534; }
  .section-score {
    font-size: 13px; font-weight: 600; color: #9ca3af;
  }
  .section-score.good { color: #166534; }
  .section-score.partial { color: #92400e; }
  .section-desc {
    font-size: 13px; color: #6b7280; line-height: 1.6; margin-bottom: 16px;
  }

  .check-item {
    display: flex; align-items: flex-start; gap: 10px; padding: 8px 0;
    border-bottom: 1px solid #f3f4f6;
  }
  .check-item:last-child { border-bottom: none; }
  .check-item input[type="checkbox"] {
    margin-top: 3px; width: 16px; height: 16px; accent-color: #a855f7; cursor: pointer;
  }
  .check-label { font-size: 14px; color: #111827; line-height: 1.5; cursor: pointer; }
  .check-hint { font-size: 12px; color: #9ca3af; margin-top: 2px; }

  /* \u2500\u2500 Results \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  .results-box {
    background: white; border-radius: 12px; border: 2px solid #e5e7eb;
    padding: 28px 32px; margin-top: 24px; display: none;
  }
  .results-box.show { display: block; }
  .results-box h2 { font-size: 20px; font-weight: 700; margin-bottom: 16px; }

  .score-bar-container {
    background: #f3f4f6; border-radius: 8px; height: 24px; margin-bottom: 16px; overflow: hidden;
  }
  .score-bar {
    height: 100%; border-radius: 8px; transition: width 0.5s ease;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; color: white; min-width: 40px;
  }
  .score-bar.high { background: #22c55e; }
  .score-bar.medium { background: #f59e0b; }
  .score-bar.low { background: #ef4444; }

  .area-scores { margin-bottom: 20px; }
  .area-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px 0; border-bottom: 1px solid #f3f4f6;
  }
  .area-row:last-child { border-bottom: none; }
  .area-name { font-size: 14px; font-weight: 500; }
  .area-badge {
    font-size: 12px; font-weight: 600; padding: 2px 10px; border-radius: 4px;
  }
  .area-badge.full { background: #dcfce7; color: #166534; }
  .area-badge.partial { background: #fef3c7; color: #92400e; }
  .area-badge.none { background: #fee2e2; color: #991b1b; }

  .gaps-list { margin-top: 16px; }
  .gaps-list h3 { font-size: 15px; font-weight: 700; margin-bottom: 8px; }
  .gap-item {
    font-size: 13px; color: #4b5563; line-height: 1.6; padding: 4px 0 4px 16px;
    border-left: 3px solid #fde68a;
  }
  .gap-item + .gap-item { margin-top: 6px; }

  .enisa-box {
    background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;
    padding: 16px 20px; margin-top: 20px;
  }
  .enisa-box h3 { font-size: 14px; font-weight: 700; color: #1e40af; margin-bottom: 6px; }
  .enisa-box p { font-size: 13px; color: #1e40af; line-height: 1.6; }
  .enisa-box ul { font-size: 13px; color: #1e40af; line-height: 1.8; padding-left: 20px; margin-top: 4px; }

  /* \u2500\u2500 CTA \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
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

  .assess-btn {
    display: block; width: 100%; padding: 14px; border: none; border-radius: 8px;
    background: #a855f7; color: white; font-size: 16px; font-weight: 700;
    cursor: pointer; font-family: inherit; transition: background 0.15s;
    margin-top: 24px;
  }
  .assess-btn:hover { background: #9333ea; }

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
  <h1>Incident Response Readiness Checklist</h1>
  <p class="subtitle">
    Is your incident response process ready for the Cyber Resilience Act?
    CRA Art.\u00a014 requires manufacturers to report actively exploited
    vulnerabilities and severe incidents to ENISA within strict deadlines.
    Use this checklist to assess your readiness across the six phases of
    an effective incident lifecycle.
  </p>

  <div id="checklist"></div>

  <button class="assess-btn" onclick="showResults()">Assess my readiness</button>

  <div class="results-box" id="results"></div>

  <!-- ENISA info -->
  <div class="enisa-box">
    <h3>CRA Art.\u00a014 ENISA Reporting Deadlines</h3>
    <p>When you become aware of an actively exploited vulnerability or severe incident:</p>
    <ul>
      <li><strong>24 hours</strong> \u2014 Early warning to the designated CSIRT</li>
      <li><strong>72 hours</strong> \u2014 Vulnerability/incident notification with initial assessment</li>
      <li><strong>14 days</strong> (vulnerability) / <strong>1 month</strong> (incident) \u2014 Final report with root cause, impact, and corrective measures</li>
    </ul>
  </div>

  <!-- CTA -->
  <div class="cta-box">
    <h3>Automate your incident workflow</h3>
    <p>CRANIS2 provides a structured incident lifecycle \u2014 from detection through
       post-incident review \u2014 with automatic ENISA escalation, deadline tracking,
       AI-assisted report drafting, and a full audit trail.</p>
    <a href="https://dev.cranis2.dev" class="cta-btn">Manage incidents in CRANIS2</a>
  </div>

  <div class="footer">
    <a href="/conformity-assessment">Free compliance assessments</a> &middot;
    <a href="/market-surveillance-registration">Market surveillance</a> &middot;
    <a href="/welcome">Learn more about CRANIS2</a>
  </div>
</div>

<script>
/* \u2500\u2500 Checklist data \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
var SECTIONS = [
  {
    id: 'detection',
    title: '1. Detection',
    description: 'Can your organisation detect vulnerabilities and security incidents in a timely manner?',
    items: [
      { id: 'd1', label: 'Automated vulnerability scanning is in place for all products', hint: 'SBOM-aware scanning, dependency monitoring, CVE feeds' },
      { id: 'd2', label: 'Security monitoring and alerting covers production systems', hint: 'Log analysis, intrusion detection, anomaly alerting' },
      { id: 'd3', label: 'There is a defined process for receiving external vulnerability reports', hint: 'Security contact, coordinated vulnerability disclosure (CVD) policy' },
      { id: 'd4', label: 'Staff know how to recognise and report potential incidents', hint: 'Security awareness training, incident reporting channels' },
    ]
  },
  {
    id: 'assessment',
    title: '2. Assessment',
    description: 'Can you quickly assess the severity and impact of a detected incident?',
    items: [
      { id: 'a1', label: 'A severity classification scheme is defined (e.g. P1\u2013P4)', hint: 'Critical/high/medium/low with clear criteria for each level' },
      { id: 'a2', label: 'Impact analysis considers affected products, users, and data', hint: 'Blast radius assessment, data sensitivity classification' },
      { id: 'a3', label: 'ENISA reporting thresholds are documented', hint: 'Clear criteria for when Art.\u00a014 reporting is triggered' },
      { id: 'a4', label: 'An incident lead is assigned within a defined timeframe', hint: 'On-call rotation or escalation matrix' },
    ]
  },
  {
    id: 'containment',
    title: '3. Containment',
    description: 'Can you isolate and contain an incident to prevent further damage?',
    items: [
      { id: 'c1', label: 'Procedures exist to isolate affected systems or components', hint: 'Network segmentation, service isolation, kill switches' },
      { id: 'c2', label: 'Rollback capability is available for critical deployments', hint: 'Versioned deployments, blue-green, canary releases' },
      { id: 'c3', label: 'Communication channels are established for incident coordination', hint: 'Dedicated Slack/Teams channel, war room procedure' },
    ]
  },
  {
    id: 'remediation',
    title: '4. Remediation',
    description: 'Can you develop, test, and deploy fixes for identified vulnerabilities?',
    items: [
      { id: 'r1', label: 'A fast-track process exists for emergency security patches', hint: 'Expedited review, testing, and deployment pipeline' },
      { id: 'r2', label: 'Patches are distributed to all affected users', hint: 'Automatic updates, notification of downstream users, advisory publication' },
      { id: 'r3', label: 'Security patches are provided free of charge (CRA Art.\u00a013(8))', hint: 'No paywall for security fixes during support period' },
      { id: 'r4', label: 'Security updates are identifiable separately from feature updates (CRA Art.\u00a013(9))', hint: 'Separate release channel or clear labelling' },
    ]
  },
  {
    id: 'recovery',
    title: '5. Recovery',
    description: 'Can you restore normal operations and verify the fix?',
    items: [
      { id: 'v1', label: 'Verification procedures confirm the fix resolves the vulnerability', hint: 'Regression testing, penetration testing, scan verification' },
      { id: 'v2', label: 'Affected users are notified of the resolution', hint: 'Security advisory update, email notification, changelog' },
      { id: 'v3', label: 'Monitoring is enhanced post-fix to detect recurrence', hint: 'Targeted alerting, log review, behavioural analysis' },
    ]
  },
  {
    id: 'review',
    title: '6. Post-Incident Review',
    description: 'Do you conduct structured reviews after incidents to prevent recurrence?',
    items: [
      { id: 'l1', label: 'A blameless post-incident review is conducted for every significant incident', hint: 'Root cause analysis, contributing factors, timeline reconstruction' },
      { id: 'l2', label: 'Lessons learned are documented and shared', hint: 'Written post-mortem, action items, knowledge base update' },
      { id: 'l3', label: 'Process improvements are tracked to completion', hint: 'Action items assigned, deadlines set, follow-up verified' },
      { id: 'l4', label: 'Incident documentation is retained for at least 10 years (CRA Art.\u00a013(10))', hint: 'Audit trail, timestamped records, compliance vault' },
    ]
  },
];

/* \u2500\u2500 Render checklist \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
function renderChecklist() {
  var container = document.getElementById('checklist');
  container.innerHTML = SECTIONS.map(function(s) {
    var items = s.items.map(function(item) {
      return '<div class="check-item">' +
        '<input type="checkbox" id="' + item.id + '" onchange="updateSectionScore(\\'' + s.id + '\\')">' +
        '<div>' +
          '<label class="check-label" for="' + item.id + '">' + item.label + '</label>' +
          '<div class="check-hint">' + item.hint + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    return '<div class="section-card" id="section-' + s.id + '">' +
      '<div class="section-header">' +
        '<div><span class="section-number" id="num-' + s.id + '">' + s.title.charAt(0) + '</span><span style="font-size:16px;font-weight:700;">' + s.title + '</span></div>' +
        '<span class="section-score" id="score-' + s.id + '">0/' + s.items.length + '</span>' +
      '</div>' +
      '<div class="section-desc">' + s.description + '</div>' +
      items +
    '</div>';
  }).join('');
}

function updateSectionScore(sectionId) {
  var section = SECTIONS.find(function(s) { return s.id === sectionId; });
  if (!section) return;
  var checked = 0;
  section.items.forEach(function(item) {
    if (document.getElementById(item.id).checked) checked++;
  });
  var scoreEl = document.getElementById('score-' + sectionId);
  var numEl = document.getElementById('num-' + sectionId);
  scoreEl.textContent = checked + '/' + section.items.length;
  if (checked === section.items.length) {
    scoreEl.className = 'section-score good';
    numEl.className = 'section-number complete';
  } else if (checked > 0) {
    scoreEl.className = 'section-score partial';
    numEl.className = 'section-number';
  } else {
    scoreEl.className = 'section-score';
    numEl.className = 'section-number';
  }
}

/* \u2500\u2500 Results \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
function showResults() {
  var totalItems = 0;
  var totalChecked = 0;
  var areaResults = [];
  var gaps = [];

  SECTIONS.forEach(function(s) {
    var checked = 0;
    s.items.forEach(function(item) {
      totalItems++;
      if (document.getElementById(item.id).checked) {
        checked++;
        totalChecked++;
      } else {
        gaps.push({ section: s.title, item: item.label });
      }
    });
    var pct = Math.round((checked / s.items.length) * 100);
    areaResults.push({
      name: s.title,
      checked: checked,
      total: s.items.length,
      pct: pct,
    });
  });

  var overallPct = Math.round((totalChecked / totalItems) * 100);
  var barClass = overallPct >= 67 ? 'high' : overallPct >= 34 ? 'medium' : 'low';

  var level;
  if (overallPct >= 80) level = 'Your incident response process is well prepared for CRA compliance.';
  else if (overallPct >= 50) level = 'Your process covers the basics but has gaps that need attention before CRA enforcement.';
  else level = 'Significant gaps exist in your incident response readiness. Prioritise the items below.';

  var areasHtml = areaResults.map(function(a) {
    var cls = a.pct === 100 ? 'full' : a.pct > 0 ? 'partial' : 'none';
    var label = a.pct === 100 ? 'Complete' : a.pct > 0 ? a.checked + '/' + a.total : 'Not started';
    return '<div class="area-row">' +
      '<span class="area-name">' + a.name + '</span>' +
      '<span class="area-badge ' + cls + '">' + label + '</span>' +
    '</div>';
  }).join('');

  var gapsHtml = '';
  if (gaps.length > 0) {
    gapsHtml = '<div class="gaps-list"><h3>Gaps to address (' + gaps.length + ')</h3>' +
      gaps.map(function(g) {
        return '<div class="gap-item"><strong>' + g.section + ':</strong> ' + g.item + '</div>';
      }).join('') +
    '</div>';
  }

  var resultsEl = document.getElementById('results');
  resultsEl.innerHTML = '<h2>Readiness Score: ' + overallPct + '%</h2>' +
    '<div class="score-bar-container"><div class="score-bar ' + barClass + '" style="width:' + Math.max(overallPct, 5) + '%">' + overallPct + '%</div></div>' +
    '<p style="font-size:14px;color:#4b5563;margin-bottom:20px;line-height:1.6;">' + level + '</p>' +
    '<div class="area-scores">' + areasHtml + '</div>' +
    gapsHtml;
  resultsEl.className = 'results-box show';
  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* \u2500\u2500 Init \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
document.addEventListener('DOMContentLoaded', renderChecklist);
</script>
</div>
</body>
</html>`;
}

module.exports = { incidentReadinessPage };

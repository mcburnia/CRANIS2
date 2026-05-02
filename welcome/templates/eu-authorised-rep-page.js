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
 * EU Authorised Representative — Public Page Template
 *
 * Interactive decision tree to determine whether a manufacturer needs
 * an EU Authorised Representative under CRA Art. 15.
 */

function euAuthorisedRepPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EU Authorised Representative \u2013 CRA Art.\u00a015 \u2013 CRANIS2</title>
<meta name="description" content="Do you need an EU Authorised Representative? Free decision tree for non-EU manufacturers under CRA Art. 15. Understand the requirements, responsibilities, and how to appoint one.">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #111827; min-height: 100vh; }
  .page { max-width: 880px; margin: 0 auto; padding: 48px 20px 80px; }
  .brand { font-size: 13px; font-weight: 700; color: #a855f7; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
  .brand a { color: inherit; text-decoration: none; }
  h1 { font-size: 28px; font-weight: 700; color: #111827; margin-bottom: 8px; line-height: 1.3; }
  .subtitle { font-size: 15px; color: #6b7280; margin-bottom: 32px; line-height: 1.7; max-width: 700px; }
  .card { background: white; border-radius: 12px; border: 1px solid #e5e7eb; padding: 28px 32px; margin-bottom: 16px; }
  .card h2 { font-size: 18px; font-weight: 700; margin-bottom: 12px; }
  .card p { font-size: 14px; color: #6b7280; line-height: 1.6; margin-bottom: 12px; }
  .step { margin-bottom: 20px; }
  .step-label { font-size: 13px; font-weight: 700; color: #a855f7; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
  .step-question { font-size: 15px; font-weight: 600; color: #111827; margin-bottom: 10px; }
  .option-group { display: flex; gap: 10px; flex-wrap: wrap; }
  .opt-btn { padding: 8px 18px; border-radius: 6px; border: 1px solid #e5e7eb; background: white; cursor: pointer; font-size: 13px; font-weight: 600; font-family: inherit; transition: all 0.15s; }
  .opt-btn:hover { border-color: #a855f7; }
  .opt-btn.active { background: #a855f7; color: white; border-color: #a855f7; }
  .result-box { display: none; padding: 20px 24px; border-radius: 8px; border: 1px solid #e5e7eb; margin-top: 16px; }
  .result-box.show { display: block; }
  .result-box.required { background: #fef3c7; border-color: #fde68a; }
  .result-box.not-required { background: #dcfce7; border-color: #bbf7d0; }
  .result-box h3 { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
  .result-box p { font-size: 13px; color: #4b5563; line-height: 1.6; margin-bottom: 6px; }
  .result-box ul { font-size: 13px; color: #4b5563; line-height: 1.8; padding-left: 20px; margin-top: 8px; }
  .duties-card { background: white; border-radius: 12px; border: 1px solid #e5e7eb; padding: 24px 28px; margin-top: 24px; }
  .duties-card h2 { font-size: 16px; font-weight: 700; margin-bottom: 12px; }
  .duty-item { padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #4b5563; line-height: 1.6; }
  .duty-item:last-child { border-bottom: none; }
  .duty-item strong { color: #111827; }
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
  <h1>EU Authorised Representative</h1>
  <p class="subtitle">
    Under CRA Art.\u00a015, non-EU manufacturers who place products with digital
    elements on the EU market must appoint an EU-based authorised representative.
    Use this decision tree to determine whether this requirement applies to you.
  </p>

  <div class="card">
    <h2>Do you need an EU Authorised Representative?</h2>

    <div class="step" id="step-1">
      <div class="step-label">Step 1 of 3</div>
      <div class="step-question">Is your organisation established in the EU or EEA?</div>
      <p style="font-size:13px;color:#6b7280;margin-bottom:10px;">
        If your company\u2019s registered office, central administration, or principal
        place of business is in an EU or EEA member state, you do not need an
        authorised representative.
      </p>
      <div class="option-group">
        <button class="opt-btn" onclick="answer1(true)">Yes, EU/EEA based</button>
        <button class="opt-btn" onclick="answer1(false)">No, outside the EU/EEA</button>
      </div>
    </div>

    <div class="step" id="step-2" style="display:none;">
      <div class="step-label">Step 2 of 3</div>
      <div class="step-question">Do you place products with digital elements on the EU market?</div>
      <p style="font-size:13px;color:#6b7280;margin-bottom:10px;">
        \u201CPlacing on the market\u201D means making a product available for the first time
        on the EU market. This includes selling, distributing, or making available
        for download within the EU.
      </p>
      <div class="option-group">
        <button class="opt-btn" onclick="answer2(true)">Yes, we sell/distribute in the EU</button>
        <button class="opt-btn" onclick="answer2(false)">No, we do not serve the EU market</button>
      </div>
    </div>

    <div class="step" id="step-3" style="display:none;">
      <div class="step-label">Step 3 of 3</div>
      <div class="step-question">Do you have an EU-based importer who handles market placement?</div>
      <p style="font-size:13px;color:#6b7280;margin-bottom:10px;">
        If you sell through an EU-based importer who takes on the CRA obligations
        under Art.\u00a018, they may fulfil some but not all of the functions of an
        authorised representative. An authorised representative is still recommended
        for direct regulatory contact.
      </p>
      <div class="option-group">
        <button class="opt-btn" onclick="answer3(true)">Yes, we have an EU importer</button>
        <button class="opt-btn" onclick="answer3(false)">No, we handle it directly</button>
      </div>
    </div>

    <div class="result-box" id="result"></div>
  </div>

  <div class="duties-card">
    <h2>What does an EU Authorised Representative do?</h2>
    <div class="duty-item"><strong>Regulatory contact point</strong> \u2014 Acts as the main contact for market surveillance authorities in the EU on behalf of the manufacturer.</div>
    <div class="duty-item"><strong>Documentation access</strong> \u2014 Ensures the EU Declaration of Conformity and technical documentation are available to authorities on request (Art.\u00a015(2)(a)).</div>
    <div class="duty-item"><strong>Cooperation with authorities</strong> \u2014 Provides information and documentation to demonstrate product conformity. Cooperates on corrective actions (Art.\u00a015(2)(b)).</div>
    <div class="duty-item"><strong>Notification of risks</strong> \u2014 Informs the manufacturer immediately if there are reasons to believe a product presents a risk (Art.\u00a015(2)(c)).</div>
    <div class="duty-item"><strong>Mandate termination</strong> \u2014 If the manufacturer does not comply with CRA obligations, the representative must terminate the mandate and inform the relevant market surveillance authority (Art.\u00a015(3)).</div>
    <div class="duty-item"><strong>Mandate duration</strong> \u2014 The written mandate must cover the entire expected product lifetime or the support period, whichever is longer.</div>
  </div>

  <div class="cta-box">
    <h3>Track your CRA obligations</h3>
    <p>CRANIS2 manages all 35 CRA obligations across manufacturer, importer, and
       distributor roles \u2014 including Art.\u00a015 authorised representative requirements.</p>
    <a href="https://dev.cranis2.dev" class="cta-btn">Manage obligations in CRANIS2</a>
  </div>

  <div class="footer">
    <a href="/importer-obligations-assessment">Importer obligations</a> &middot;
    <a href="/conformity-assessment">Free compliance assessments</a> &middot;
    <a href="/welcome">Learn more about CRANIS2</a>
  </div>
</div>

<script>
function setActive(step, btn) {
  step.querySelectorAll('.opt-btn').forEach(function(b) { b.className = 'opt-btn'; });
  btn.classList.add('active');
}

function answer1(euBased) {
  setActive(document.getElementById('step-1'), event.target);
  var resultEl = document.getElementById('result');
  if (euBased) {
    document.getElementById('step-2').style.display = 'none';
    document.getElementById('step-3').style.display = 'none';
    resultEl.className = 'result-box show not-required';
    resultEl.innerHTML = '<h3>Authorised representative not required</h3>' +
      '<p>Since your organisation is established in the EU/EEA, you act as your own ' +
      'point of contact for market surveillance authorities. CRA Art.\u00a015 applies ' +
      'only to manufacturers established outside the EU.</p>';
    return;
  }
  resultEl.className = 'result-box';
  document.getElementById('step-2').style.display = 'block';
  document.getElementById('step-3').style.display = 'none';
}

function answer2(placesOnMarket) {
  setActive(document.getElementById('step-2'), event.target);
  var resultEl = document.getElementById('result');
  if (!placesOnMarket) {
    document.getElementById('step-3').style.display = 'none';
    resultEl.className = 'result-box show not-required';
    resultEl.innerHTML = '<h3>Authorised representative not required</h3>' +
      '<p>If you do not place products on the EU market, CRA obligations ' +
      '(including Art.\u00a015) do not apply. However, if EU-based companies ' +
      'download or import your product independently, an importer or distributor ' +
      'would take on the relevant obligations.</p>';
    return;
  }
  resultEl.className = 'result-box';
  document.getElementById('step-3').style.display = 'block';
}

function answer3(hasImporter) {
  setActive(document.getElementById('step-3'), event.target);
  var resultEl = document.getElementById('result');
  if (hasImporter) {
    resultEl.className = 'result-box show required';
    resultEl.innerHTML = '<h3>Authorised representative recommended</h3>' +
      '<p>While your EU importer fulfils some obligations under Art.\u00a018, an ' +
      'authorised representative provides direct manufacturer\u2013authority communication ' +
      'and is required for full CRA compliance as a non-EU manufacturer.</p>' +
      '<p>Your authorised representative must:</p>' +
      '<ul>' +
        '<li>Be established in the EU/EEA</li>' +
        '<li>Have a written mandate from you covering the product lifetime</li>' +
        '<li>Have access to your technical documentation and EU Declaration of Conformity</li>' +
        '<li>Be empowered to cooperate with market surveillance authorities</li>' +
      '</ul>';
  } else {
    resultEl.className = 'result-box show required';
    resultEl.innerHTML = '<h3>Authorised representative required</h3>' +
      '<p><strong>You must appoint an EU Authorised Representative</strong> before placing ' +
      'your product on the EU market (CRA Art.\u00a015).</p>' +
      '<p>Without an EU importer or authorised representative, you have no legal ' +
      'entity in the EU that market surveillance authorities can contact, which means ' +
      'your product cannot lawfully be placed on the market.</p>' +
      '<p>Your authorised representative must:</p>' +
      '<ul>' +
        '<li>Be a natural or legal person established in the EU/EEA</li>' +
        '<li>Hold a written mandate covering the full product lifetime or support period</li>' +
        '<li>Keep the EU Declaration of Conformity and technical documentation available</li>' +
        '<li>Cooperate with market surveillance authorities on request</li>' +
        '<li>Inform you immediately if there are product risk concerns</li>' +
      '</ul>';
  }
}
</script>
</div>
</body>
</html>`;
}

module.exports = { euAuthorisedRepPage };

/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

const { escapeHtml } = require('../lib/auth');

function unsubscribePage(success, detail) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${success ? 'Unsubscribed' : 'Error'} – CRANIS2</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #111827; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .card { background: white; border-radius: 12px; border: 1px solid #e5e7eb; padding: 40px; max-width: 480px; text-align: center; }
  .brand { font-size: 13px; font-weight: 700; color: #a855f7; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; }
  h1 { font-size: 20px; font-weight: 700; margin-bottom: 12px; }
  p { font-size: 14px; color: #6b7280; line-height: 1.6; margin-bottom: 12px; }
  .check { font-size: 48px; margin-bottom: 16px; }
</style>
</head>
<body>
<div class="card">
  <div class="brand">CRANIS2</div>
  ${success
    ? `<div class="check">✓</div>
       <h1>You\u2019ve been unsubscribed</h1>
       <p><strong>${escapeHtml(detail)}</strong> has been removed from our launch notification list.</p>
       <p>You won\u2019t receive any further emails from us about the CRANIS2 launch. If you change your mind, you can always take the assessment again.</p>`
    : `<h1>Something went wrong</h1>
       <p>${escapeHtml(detail)}</p>`
  }
</div>
</body>
</html>`;
}

function loginPage(error) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CRANIS2 – Welcome</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0f0f14; color: #e4e4e7; min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
  }
  .login-card {
    background: #1a1a22; border: 1px solid #2a2a35; border-radius: 12px;
    padding: 2.5rem; width: 380px; max-width: 90vw;
  }
  .login-logo {
    font-size: 1.4rem; font-weight: 800; color: #a855f7; text-align: center;
    margin-bottom: 0.25rem; letter-spacing: -0.02em;
  }
  .login-subtitle {
    font-size: 0.82rem; color: #71717a; text-align: center; margin-bottom: 2rem;
  }
  .login-label {
    display: block; font-size: 0.78rem; font-weight: 600; color: #a1a1aa;
    margin-bottom: 0.35rem; text-transform: uppercase; letter-spacing: 0.04em;
  }
  .login-input {
    width: 100%; padding: 0.65rem 0.85rem; border: 1px solid #2a2a35;
    border-radius: 6px; background: #0f0f14; color: #e4e4e7;
    font-size: 0.9rem; font-family: inherit; margin-bottom: 1.25rem;
    outline: none; transition: border-color 0.15s;
  }
  .login-input:focus { border-color: #a855f7; }
  .login-btn {
    width: 100%; padding: 0.7rem; border: none; border-radius: 6px;
    background: #a855f7; color: white; font-size: 0.9rem; font-weight: 600;
    cursor: pointer; font-family: inherit; transition: background 0.15s;
  }
  .login-btn:hover { background: #9333ea; }
  .login-error {
    background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25);
    border-radius: 6px; padding: 0.6rem 0.85rem; margin-bottom: 1.25rem;
    font-size: 0.82rem; color: #f87171;
  }
</style>
</head>
<body>
<div class="login-card">
  <div class="login-logo">CRANIS2</div>
  <div class="login-subtitle">Strategy &amp; Ecosystem Context</div>
  ${error ? '<div class="login-error">Invalid credentials. Please try again.</div>' : ''}
  <form method="POST" action="/login">
    <label class="login-label" for="username">Username</label>
    <input class="login-input" type="text" id="username" name="username" autocomplete="username" required autofocus>
    <label class="login-label" for="password">Password</label>
    <input class="login-input" type="password" id="password" name="password" autocomplete="current-password" required>
    <button class="login-btn" type="submit">Sign In</button>
  </form>
</div>
</body>
</html>`;
}

function assessmentLandingPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Free Compliance Assessments – CRANIS2</title>
<meta name="description" content="Free EU cybersecurity compliance assessments. Check your readiness for the Cyber Resilience Act (CRA) and the Network and Information Security Directive 2 (NIS2).">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #111827; min-height: 100vh; }
  .page { max-width: 720px; margin: 0 auto; padding: 48px 20px 80px; }
  .brand { font-size: 13px; font-weight: 700; color: #a855f7; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
  h1 { font-size: 28px; font-weight: 700; color: #111827; margin-bottom: 8px; line-height: 1.3; }
  .subtitle { font-size: 15px; color: #6b7280; margin-bottom: 36px; line-height: 1.7; max-width: 600px; }
  .cards { display: grid; gap: 20px; }
  .card { background: white; border-radius: 12px; border: 1px solid #e5e7eb; padding: 32px; transition: border-color 0.2s, box-shadow 0.2s; text-decoration: none; color: inherit; display: block; }
  .card:hover { border-color: #a855f7; box-shadow: 0 4px 12px rgba(168,85,247,0.1); text-decoration: none; }
  .card-tag { display: inline-block; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 4px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
  .card-tag.cra { background: #f5f3ff; color: #7c3aed; }
  .card-tag.nis2 { background: #eff6ff; color: #2563eb; }
  .card-tag.pqc { background: #fef3c7; color: #92400e; }
  .card-tag.dir { background: #e0e7ff; color: #3730a3; }
  .card h2 { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 8px; }
  .card p { font-size: 14px; color: #6b7280; line-height: 1.6; margin-bottom: 16px; }
  .card-meta { display: flex; gap: 20px; font-size: 12px; color: #9ca3af; }
  .card-meta span { display: flex; align-items: center; gap: 4px; }
  .card-arrow { float: right; font-size: 20px; color: #a855f7; margin-top: -28px; }
  .info-box { background: white; border-radius: 12px; border: 1px solid #e5e7eb; padding: 24px; margin-top: 32px; }
  .info-box h3 { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
  .info-box p { font-size: 13px; color: #6b7280; line-height: 1.6; }
  .info-box ul { font-size: 13px; color: #6b7280; line-height: 1.8; padding-left: 20px; margin-top: 8px; }
  .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #9ca3af; }
  .footer a { color: #a855f7; text-decoration: none; }
</style>
</head>
<body>
<div class="page">
  <div class="brand">CRANIS2</div>
  <h1>Free Compliance Assessments</h1>
  <p class="subtitle">
    EU cybersecurity regulations and the quantum computing transition are reshaping how organisations build and operate digital products and services.
    Our free assessments help you understand where you stand and what you need to do next.
  </p>

  <div class="cards">
    <a href="/cra-conformity-assessment" class="card">
      <span class="card-tag cra">Product Compliance</span>
      <h2>CRA Readiness Assessment</h2>
      <p>For manufacturers and developers of products with digital elements. Determine your product\u2019s risk category, required conformity assessment module, and get a personalised maturity report covering vulnerability management, SBOMs, security by design, and technical documentation.</p>
      <div class="card-meta">
        <span>\u23F1 ~10 minutes</span>
        <span>\u2709 22 questions</span>
        <span>\u2728 6 areas assessed</span>
      </div>
      <div class="card-arrow">\u2192</div>
    </a>

    <a href="/importer-obligations-assessment" class="card">
      <span class="card-tag cra">Importer Obligations</span>
      <h2>Importer Obligations Assessment</h2>
      <p>For companies importing products with digital elements into the EU market. Check whether you meet your obligations under CRA Article 18, covering manufacturer verification, supply chain traceability, vulnerability reporting, and documentation retention.</p>
      <div class="card-meta">
        <span>\u23F1 ~5 minutes</span>
        <span>\u2709 10 questions</span>
        <span>\u2728 3 areas assessed</span>
      </div>
      <div class="card-arrow">\u2192</div>
    </a>

    <a href="/nis2-conformity-assessment" class="card">
      <span class="card-tag nis2">Organisation Compliance</span>
      <h2>NIS2 Readiness Assessment</h2>
      <p>For organisations in essential and important sectors. Determine your entity classification, supervision regime, and penalty exposure. Get a maturity assessment covering governance, risk management, incident reporting, supply chain security, business continuity, and technical measures.</p>
      <div class="card-meta">
        <span>\u23F1 ~12 minutes</span>
        <span>\u2709 25 questions</span>
        <span>\u2728 7 areas assessed</span>
      </div>
      <div class="card-arrow">\u2192</div>
    </a>

    <a href="/pqc-readiness-assessment" class="card">
      <span class="card-tag pqc">Quantum Readiness</span>
      <h2>PQC Readiness Assessment</h2>
      <p>For any organisation using cryptography. Assess your exposure to quantum computing threats across key types, rotation cycles, crypto agility, data sensitivity, and migration planning. Aligned with NIST FIPS 203/204/205 and CNSA 2.0 timelines.</p>
      <div class="card-meta">
        <span>\u23F1 ~8 minutes</span>
        <span>\u2709 18 questions</span>
        <span>\u2728 6 areas assessed</span>
      </div>
      <div class="card-arrow">\u2192</div>
    </a>

    <a href="/notified-body-directory" class="card">
      <span class="card-tag dir">Directory</span>
      <h2>EU Notified Body Directory</h2>
      <p>Find EU-designated conformity assessment bodies for the Cyber Resilience Act. Search by country, accredited module (B, C, H), and sector. Includes a decision tool to determine which conformity assessment module your product requires.</p>
      <div class="card-meta">
        <span>\uD83C\uDDEA\uD83C\uDDFA 12 countries</span>
        <span>\uD83C\uDFE2 16 bodies</span>
        <span>\uD83D\uDD0D Searchable</span>
      </div>
      <div class="card-arrow">\u2192</div>
    </a>

    <a href="/market-surveillance-registration" class="card">
      <span class="card-tag dir">Directory</span>
      <h2>Market Surveillance Registration</h2>
      <p>Critical product? Determine whether you need to register with a market surveillance authority under CRA Art.\u00a020 using our interactive decision tree. Searchable directory of national authorities across the EU and EEA.</p>
      <div class="card-meta">
        <span>\uD83C\uDDEA\uD83C\uDDFA 16 countries</span>
        <span>\uD83C\uDFE2 20 authorities</span>
        <span>\uD83C\uDF33 Decision tree</span>
      </div>
      <div class="card-arrow">\u2192</div>
    </a>

    <a href="/supply-chain-risk-assessment" class="card">
      <span class="card-tag assess">Assessment</span>
      <h2>Supply Chain Risk Assessment</h2>
      <p>Rate your supply chain risk across five key areas: dependency inventory, vulnerability monitoring, supplier visibility, licence compliance, and resilience. Aligned with CRA Art.\u00a013(5) and NIS2 Art.\u00a021.</p>
      <div class="card-meta">
        <span>\uD83D\uDD17 20 questions</span>
        <span>\uD83D\uDCCA 5 areas</span>
        <span>\u23F1 ~5 minutes</span>
      </div>
      <div class="card-arrow">\u2192</div>
    </a>

    <a href="/incident-readiness-checklist" class="card">
      <span class="card-tag assess">Checklist</span>
      <h2>Incident Response Readiness</h2>
      <p>Is your incident response process CRA-ready? Interactive checklist covering detection, assessment, containment, remediation, recovery, and post-incident review. Aligned with CRA Art.\u00a014 and ENISA reporting deadlines.</p>
      <div class="card-meta">
        <span>\u2705 22 checks</span>
        <span>\uD83D\uDCCB 6 areas</span>
        <span>\u23F1 ~5 minutes</span>
      </div>
      <div class="card-arrow">\u2192</div>
    </a>

    <a href="/end-of-life-calculator" class="card">
      <span class="card-tag assess">Calculator</span>
      <h2>End-of-Life Notification Calculator</h2>
      <p>When must you notify users before support ends? Enter your support end date to generate a CRA-compliant notification timeline with milestone dates and required actions.</p>
      <div class="card-meta">
        <span>\uD83D\uDCC5 Timeline generator</span>
        <span>\uD83D\uDD14 6 milestones</span>
        <span>\u23F1 ~2 minutes</span>
      </div>
      <div class="card-arrow">\u2192</div>
    </a>

    <a href="/eu-authorised-representative" class="card">
      <span class="card-tag assess">Decision Tree</span>
      <h2>EU Authorised Representative</h2>
      <p>Non-EU manufacturer? Determine whether you need to appoint an EU Authorised Representative under CRA Art.\u00a015. Includes responsibilities and appointment requirements.</p>
      <div class="card-meta">
        <span>\uD83C\uDDEA\uD83C\uDDFA 3 questions</span>
        <span>\uD83D\uDCCB Duties explained</span>
        <span>\u23F1 ~2 minutes</span>
      </div>
      <div class="card-arrow">\u2192</div>
    </a>

    <a href="/non-compliance-guide" class="card">
      <span class="card-tag assess">Guide</span>
      <h2>Non-Compliance Reporting Guide</h2>
      <p>What to do when you discover your product is non-compliant. Step-by-step process for manufacturers, importers, and distributors covering corrective measures and authority notification.</p>
      <div class="card-meta">
        <span>\uD83D\uDCDD 6 steps</span>
        <span>\uD83D\uDC65 3 roles</span>
        <span>\u23F1 ~3 minutes</span>
      </div>
      <div class="card-arrow">\u2192</div>
    </a>
  </div>

  <div class="info-box">
    <h3>What you get</h3>
    <p>All assessments are completely free and provide:</p>
    <ul>
      <li>A personalised readiness score with per-area maturity breakdown</li>
      <li>Classification of your product (CRA) or organisation (NIS2) under the regulation</li>
      <li>Priority recommendations with specific next steps and regulatory references</li>
      <li>A detailed report emailed to you that you can share with your team</li>
    </ul>
    <p style="margin-top:12px;">Your progress is saved automatically. You can pause and return at any time. We will never spam you or share your information.</p>
  </div>

  <div class="info-box" style="margin-top:16px;">
    <h3>Returning?</h3>
    <p>If you\u2019ve already started an assessment, just select the same one again and sign in with the same email address. Your progress will be restored automatically and you\u2019ll continue from where you left off.</p>
  </div>

  <div class="footer">
    <a href="/welcome">Learn more about CRANIS2</a> \u2013 EU Cybersecurity Compliance Platform
  </div>
</div>
</body>
</html>`;
}

module.exports = { assessmentLandingPage, unsubscribePage, loginPage };

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

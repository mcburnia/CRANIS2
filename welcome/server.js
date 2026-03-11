const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3004;
const WELCOME_USER = process.env.WELCOME_USER || 'CRANIS2';
const WELCOME_PASS = process.env.WELCOME_PASS || '(LetMeIn)';
const WELCOME_SECRET = process.env.WELCOME_SECRET || 'dev-secret-change-me';
const LOG_FILE = process.env.LOG_FILE || '/data/access.log';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser(WELCOME_SECRET));

// Ensure log directory exists
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function makeToken(username) {
  const payload = JSON.stringify({ u: username, t: Date.now() });
  const hmac = crypto.createHmac('sha256', WELCOME_SECRET).update(payload).digest('hex');
  return Buffer.from(payload).toString('base64') + '.' + hmac;
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const [b64, hmac] = token.split('.');
    const payload = Buffer.from(b64, 'base64').toString();
    const expected = crypto.createHmac('sha256', WELCOME_SECRET).update(payload).digest('hex');
    if (hmac !== expected) return null;
    const data = JSON.parse(payload);
    // Expire after 24 hours
    if (Date.now() - data.t > 24 * 60 * 60 * 1000) return null;
    return data.u;
  } catch {
    return null;
  }
}

function logAccess(req, event) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip,
    country: req.headers['cf-ipcountry'] || null,
    city: req.headers['cf-ipcity'] || null,
    userAgent: req.headers['user-agent'] || null,
    path: req.originalUrl,
  };
  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch (err) {
    console.error('Failed to write access log:', err.message);
  }
}

function isAuthenticated(req) {
  return verifyToken(req.cookies.welcome_auth) !== null;
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── Routes ──────────────────────────────────────────────────────────── */

app.get('/login', (req, res) => {
  const error = req.query.error === '1';
  logAccess(req, 'login_page');
  res.send(loginPage(error));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === WELCOME_USER && password === WELCOME_PASS) {
    const token = makeToken(username);
    res.cookie('welcome_auth', token, {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
    });
    logAccess(req, 'login_success');
    return res.redirect('/');
  }
  logAccess(req, 'login_failed');
  res.redirect('/login?error=1');
});

app.get('/logout', (req, res) => {
  logAccess(req, 'logout');
  res.clearCookie('welcome_auth');
  res.redirect('/login');
});

app.get('/access-log', (req, res) => {
  if (!isAuthenticated(req)) return res.redirect('/login');
  logAccess(req, 'view_log');
  try {
    const raw = fs.readFileSync(LOG_FILE, 'utf-8').trim();
    const entries = raw ? raw.split('\n').map(line => JSON.parse(line)) : [];
    res.json({ total: entries.length, entries: entries.reverse() });
  } catch {
    res.json({ total: 0, entries: [] });
  }
});

app.post('/contact', async (req, res) => {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'Unauthorised' });

  const { name, email, position } = req.body || {};
  if (!name || !email || !position) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  logAccess(req, 'contact_form');

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured — cannot send contact emails');
    return res.status(500).json({ error: 'Email service not configured.' });
  }

  try {
    // 1. Send thank-you email to the enquirer
    const thankYouRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'CRANIS2 <noreply@poste.cranis2.com>',
        to: [email],
        subject: 'Thank you for your interest in CRANIS2',
        html: `<p>Dear ${escapeHtml(name)},</p>
<p>Thank you for your interest in CRANIS2. We have received your enquiry and will be in touch shortly.</p>
<p>In the meantime, if you have any questions, feel free to reply to this email or contact us at <a href="mailto:info@cranis2.com">info@cranis2.com</a>.</p>
<p>Best regards,<br>The CRANIS2 Team</p>`
      })
    });
    if (!thankYouRes.ok) {
      const errBody = await thankYouRes.text();
      console.error('Resend thank-you email failed:', thankYouRes.status, errBody);
      return res.status(502).json({ error: 'Failed to send confirmation email. Please try again.' });
    }

    // 2. Send lead notification to info@cranis2.com
    const leadRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'CRANIS2 Welcome <noreply@poste.cranis2.com>',
        to: ['info@cranis2.com'],
        subject: `New CRANIS2 Enquiry — ${name} (${position})`,
        html: `<h3>New Enquiry from Welcome Page</h3>
<table style="border-collapse:collapse;">
<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Name</td><td>${escapeHtml(name)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Email</td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Position</td><td>${escapeHtml(position)}</td></tr>
</table>`
      })
    });
    if (!leadRes.ok) {
      const errBody = await leadRes.text();
      console.error('Resend lead notification failed:', leadRes.status, errBody);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Contact form email error:', err);
    res.status(500).json({ error: 'Failed to send email. Please try again.' });
  }
});

// ─── Public tools (no auth — lead generation) ──────────────────────────

app.get('/conformity-assessment', (req, res) => {
  logAccess(req, 'conformity_assessment_tool');
  res.send(conformityAssessmentPage());
});

app.get('/', (req, res) => {
  if (!isAuthenticated(req)) return res.redirect('/login');
  logAccess(req, 'page_view');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ── Login page HTML ─────────────────────────────────────────────────── */

function loginPage(error) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CRANIS2 — Welcome</title>
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

/* ── Conformity Assessment Tool (public, no auth) ────────────────────── */

function conformityAssessmentPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CRA Conformity Assessment Selector — CRANIS2</title>
<meta name="description" content="Find out which EU Cyber Resilience Act conformity assessment module applies to your product. Free interactive tool — Module A, B+C, or H.">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f8fafc; color: #111827; min-height: 100vh;
  }
  .ca-page { max-width: 700px; margin: 0 auto; padding: 48px 20px 80px; }
  .ca-brand { font-size: 13px; font-weight: 700; color: #a855f7; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
  .ca-page h1 { font-size: 28px; font-weight: 700; color: #111827; margin-bottom: 8px; line-height: 1.3; }
  .ca-page .subtitle { font-size: 15px; color: #6b7280; margin-bottom: 32px; line-height: 1.5; }

  .ca-form { background: white; border-radius: 12px; border: 1px solid #e5e7eb; padding: 28px; margin-bottom: 24px; }
  .ca-step { margin-bottom: 24px; }
  .ca-step:last-child { margin-bottom: 0; }
  .ca-step-label { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 4px; }
  .ca-step-help { font-size: 12px; color: #9ca3af; margin-bottom: 12px; }

  .ca-options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .ca-option {
    padding: 14px; border-radius: 8px; border: 2px solid #e5e7eb;
    cursor: pointer; transition: all 0.15s; background: white; text-align: left;
  }
  .ca-option:hover { border-color: #93c5fd; background: #f0f7ff; }
  .ca-option.selected { border-color: #2563eb; background: #eff6ff; }
  .ca-option h4 { font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 4px; }
  .ca-option p { font-size: 11px; color: #6b7280; line-height: 1.4; }

  .ca-toggle {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 14px; border-radius: 8px; background: #f9fafb;
    cursor: pointer; font-size: 13px; color: #374151;
  }
  .ca-toggle input[type="checkbox"] { width: 16px; height: 16px; accent-color: #2563eb; }

  .ca-submit {
    width: 100%; padding: 13px; border: none; border-radius: 8px;
    background: #2563eb; color: white; font-size: 14px; font-weight: 600;
    cursor: pointer; transition: background 0.15s; margin-top: 20px;
  }
  .ca-submit:hover { background: #1d4ed8; }
  .ca-submit:disabled { background: #93c5fd; cursor: not-allowed; }

  /* Result */
  .ca-result { display: none; animation: slideUp 0.3s ease-out; }
  .ca-result.visible { display: block; }
  @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

  .ca-result-card {
    background: white; border-radius: 12px; border: 1px solid #e5e7eb;
    overflow: hidden; margin-bottom: 20px;
  }
  .ca-result-card.ok { border-left: 4px solid #10b981; }
  .ca-result-card.warning { border-left: 4px solid #f59e0b; }

  .ca-result-header {
    padding: 18px 20px; display: flex; align-items: center; justify-content: space-between;
  }
  .ca-result-header h2 { font-size: 18px; font-weight: 700; color: #111827; }
  .ca-result-badge {
    font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 6px;
  }
  .ca-result-badge.ok { background: #ecfdf5; color: #065f46; }
  .ca-result-badge.warning { background: #fef3c7; color: #92400e; }

  .ca-result-body { padding: 0 20px 20px; }
  .ca-result-body p { font-size: 13px; color: #4b5563; line-height: 1.6; margin-bottom: 12px; }

  .ca-result-condition {
    font-size: 13px; padding: 10px 14px; border-radius: 8px;
    margin-bottom: 16px; line-height: 1.5;
  }
  .ca-result-condition.ok { background: #ecfdf5; color: #065f46; }
  .ca-result-condition.warning { background: #fffbeb; color: #92400e; }

  .ca-result-section { margin-bottom: 20px; }
  .ca-result-section h3 { font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px; }
  .ca-result-section ol, .ca-result-section ul { padding-left: 20px; font-size: 13px; color: #374151; line-height: 1.7; }
  .ca-result-section li { margin-bottom: 4px; }

  .ca-notes {
    background: #f9fafb; border-radius: 8px; padding: 14px; margin-top: 8px;
  }
  .ca-notes ul { padding-left: 18px; font-size: 12px; color: #6b7280; line-height: 1.7; }

  .ca-timeline {
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; color: #6b7280; margin-bottom: 16px;
  }
  .ca-timeline strong { color: #111827; }

  .ca-cta {
    background: white; border-radius: 12px; border: 1px solid #e5e7eb;
    padding: 28px; text-align: center;
  }
  .ca-cta h3 { font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 8px; }
  .ca-cta p { font-size: 13px; color: #6b7280; margin-bottom: 20px; line-height: 1.5; }
  .ca-cta-btn {
    display: inline-block; padding: 12px 28px; background: #a855f7;
    color: white; border-radius: 8px; text-decoration: none;
    font-size: 14px; font-weight: 600; transition: background 0.15s;
  }
  .ca-cta-btn:hover { background: #9333ea; }

  .ca-reset {
    background: none; border: 1px solid #e5e7eb; color: #6b7280;
    padding: 8px 16px; border-radius: 6px; font-size: 13px;
    cursor: pointer; margin-top: 12px;
  }
  .ca-reset:hover { background: #f9fafb; color: #374151; }

  .ca-footer { text-align: center; margin-top: 40px; font-size: 12px; color: #9ca3af; }
  .ca-footer a { color: #a855f7; text-decoration: none; }
</style>
</head>
<body>
<div class="ca-page">
  <div class="ca-brand">CRANIS2</div>
  <h1>Which CRA Conformity Assessment Do You Need?</h1>
  <p class="subtitle">
    The EU Cyber Resilience Act requires all products with digital elements to undergo a conformity assessment before market placement. The required procedure depends on your product's risk category. Select your category below to find out which module applies.
  </p>

  <!-- Form -->
  <div class="ca-form" id="ca-form">
    <div class="ca-step">
      <div class="ca-step-label">1. Select your CRA product category</div>
      <div class="ca-step-help">Not sure? Most software products fall under Default. Check CRA Annex III and IV for Important and Critical product lists.</div>
      <div class="ca-options">
        <div class="ca-option" data-cat="default" onclick="selectCategory(this)">
          <h4>Default</h4>
          <p>Standard cybersecurity requirements. Most software products.</p>
        </div>
        <div class="ca-option" data-cat="important_i" onclick="selectCategory(this)">
          <h4>Important Class I</h4>
          <p>Higher risk — identity management, VPNs, network monitoring tools, etc.</p>
        </div>
        <div class="ca-option" data-cat="important_ii" onclick="selectCategory(this)">
          <h4>Important Class II</h4>
          <p>Critical infrastructure — firewalls, IDS/IPS, hypervisors, OS kernels, etc.</p>
        </div>
        <div class="ca-option" data-cat="critical" onclick="selectCategory(this)">
          <h4>Critical</h4>
          <p>Highest risk — hardware security modules, smartcard readers, smart meters.</p>
        </div>
      </div>
    </div>

    <div class="ca-step" id="standards-step" style="display:none;">
      <div class="ca-step-label">2. Have you fully applied harmonised standards?</div>
      <div class="ca-step-help">Relevant for Important Class I only. Standards include EN 18031-1/2/3, ETSI EN 303 645, or ISO/IEC 15408.</div>
      <label class="ca-toggle">
        <input type="checkbox" id="standards-checkbox">
        Yes, I have fully applied all relevant harmonised standards
      </label>
    </div>

    <button class="ca-submit" id="ca-submit" disabled onclick="showResult()">
      Show My Assessment Module
    </button>
  </div>

  <!-- Result -->
  <div class="ca-result" id="ca-result"></div>

  <div class="ca-footer">
    Powered by <a href="https://dev.cranis2.dev">CRANIS2</a> — EU Cyber Resilience Act Compliance Platform
  </div>
</div>

<script>
let selectedCategory = null;

function selectCategory(el) {
  document.querySelectorAll('.ca-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  selectedCategory = el.dataset.cat;
  document.getElementById('ca-submit').disabled = false;

  // Show standards question for Important I
  const standardsStep = document.getElementById('standards-step');
  standardsStep.style.display = selectedCategory === 'important_i' ? 'block' : 'none';
}

const MODULES = {
  module_a: { name: 'Module A', fullName: 'Module A — Internal Control', nb: false },
  module_b: { name: 'Module B', fullName: 'Module B — EU-Type Examination', nb: true },
  module_c: { name: 'Module C', fullName: 'Module C — Conformity to Type', nb: false },
  module_h: { name: 'Module H', fullName: 'Module H — Full Quality Assurance', nb: true },
};

const ASSESSMENTS = {
  default: {
    modules: ['module_a'],
    primary: 'module_a',
    condition: null,
    requirements: [
      'Complete technical documentation per Annex VII',
      'Perform internal conformity assessment',
      'Draw up EU Declaration of Conformity per Annex VI',
      'Affix CE marking to the product'
    ],
    timeline: '2\\u20134 weeks (internal assessment)',
    notes: [
      'No notified body involvement required.',
      'The manufacturer bears full responsibility for conformity.',
      'Technical documentation must be retained for 10 years after market placement (Art. 13(10)).'
    ]
  },
  important_i_with_standards: {
    modules: ['module_a'],
    primary: 'module_a',
    condition: 'Harmonised standards fully applied \\u2014 self-assessment permitted.',
    requirements: [
      'Apply all relevant harmonised standards (EN 18031-1, EN 18031-2, EN 18031-3)',
      'Document which standards were applied and how each requirement is met',
      'Complete technical documentation per Annex VII',
      'Perform internal conformity assessment under Module A',
      'Draw up EU Declaration of Conformity referencing the applied standards',
      'Affix CE marking to the product'
    ],
    timeline: '4\\u20138 weeks (internal assessment with standards documentation)',
    notes: [
      'Self-assessment (Module A) is permitted because harmonised standards are fully applied.',
      'If harmonised standards are revised or withdrawn, the assessment may need to be repeated.',
      'The manufacturer must monitor the Official Journal for changes to referenced standards.'
    ]
  },
  important_i_without_standards: {
    modules: ['module_b', 'module_c'],
    primary: 'module_b',
    condition: 'Harmonised standards NOT fully applied \\u2014 third-party assessment required.',
    requirements: [
      'Engage a notified body for EU-type examination (Module B)',
      'Submit technical documentation to the notified body',
      'Obtain EU-type examination certificate',
      'Ensure production conformity to the certified type (Module C)',
      'Draw up EU Declaration of Conformity referencing the certificate',
      'Affix CE marking with notified body identification number'
    ],
    timeline: '3\\u20136 months (notified body examination)',
    notes: [
      'A notified body must examine the product type and issue a certificate.',
      'Alternatively, fully applying harmonised standards would allow Module A (self-assessment).',
      'The manufacturer should check if relevant harmonised standards exist \\u2014 this may reduce cost and time.'
    ]
  },
  important_ii: {
    modules: ['module_b', 'module_c', 'module_h'],
    primary: 'module_b',
    condition: 'Third-party conformity assessment is mandatory regardless of harmonised standards.',
    requirements: [
      'Engage a notified body for either EU-type examination (Module B+C) or full quality assurance (Module H)',
      'Submit technical documentation to the notified body',
      'For Module B+C: obtain EU-type examination certificate and maintain production conformity',
      'For Module H: implement and maintain a notified-body-approved quality assurance system',
      'Draw up EU Declaration of Conformity referencing the certificate or approval',
      'Affix CE marking with notified body identification number'
    ],
    timeline: '4\\u20139 months (notified body examination or quality system approval)',
    notes: [
      'Third-party assessment is mandatory \\u2014 self-assessment (Module A) is NOT permitted.',
      'The manufacturer may choose between Module B+C or Module H.',
      'Module H may be more efficient for manufacturers with multiple product variants.',
      'A European cybersecurity certification scheme may satisfy this requirement.'
    ]
  },
  critical: {
    modules: ['module_h'],
    primary: 'module_h',
    condition: 'Full quality assurance with notified body approval is mandatory.',
    requirements: [
      'Engage a notified body for full quality assurance system assessment (Module H)',
      'Implement a comprehensive quality management system covering design, production, testing, and post-market surveillance',
      'Submit quality system documentation and technical file to the notified body',
      'Obtain notified body approval of the quality assurance system',
      'Maintain the quality system under periodic notified body surveillance',
      'Draw up EU Declaration of Conformity referencing the approval',
      'Affix CE marking with notified body identification number',
      'Register with the relevant market surveillance authority (Art. 20)'
    ],
    timeline: '6\\u201312 months (quality system approval and ongoing surveillance)',
    notes: [
      'Module H (full quality assurance) is mandatory for Critical category products.',
      'The notified body conducts initial assessment AND periodic surveillance.',
      'A European cybersecurity certification scheme at assurance level \\"high\\" may be used as an alternative.',
      'Market surveillance registration (Art. 20) is also required.',
      'Quality system changes must be notified to the notified body for approval.'
    ]
  }
};

function showResult() {
  if (!selectedCategory) return;

  let key = selectedCategory;
  if (key === 'important_i') {
    const hasStandards = document.getElementById('standards-checkbox').checked;
    key = hasStandards ? 'important_i_with_standards' : 'important_i_without_standards';
  }

  const data = ASSESSMENTS[key];
  const primary = MODULES[data.primary];
  const needsNB = primary.nb;
  const statusClass = needsNB ? 'warning' : 'ok';

  const categoryLabels = {
    default: 'Default',
    important_i: 'Important Class I',
    important_ii: 'Important Class II',
    critical: 'Critical'
  };

  let html = '<div class="ca-result-card ' + statusClass + '">';
  html += '<div class="ca-result-header">';
  html += '<h2>' + primary.fullName + '</h2>';
  html += '<span class="ca-result-badge ' + statusClass + '">' + (needsNB ? 'Notified Body Required' : 'Self-Assessment') + '</span>';
  html += '</div>';
  html += '<div class="ca-result-body">';

  html += '<p>Based on your <strong>' + categoryLabels[selectedCategory] + '</strong> category product, the applicable conformity assessment procedure is <strong>' + primary.fullName + '</strong>.</p>';

  html += '<div class="ca-timeline"><strong>Estimated timeline:</strong> ' + data.timeline + '</div>';

  if (data.condition) {
    html += '<div class="ca-result-condition ' + statusClass + '">' + data.condition + '</div>';
  }

  html += '<div class="ca-result-section"><h3>What You Need to Do</h3><ol>';
  data.requirements.forEach(function(r) { html += '<li>' + r + '</li>'; });
  html += '</ol></div>';

  if (data.modules.length > 1) {
    html += '<div class="ca-result-section"><h3>Applicable Modules</h3><ul>';
    data.modules.forEach(function(m) {
      var mod = MODULES[m];
      html += '<li><strong>' + mod.fullName + '</strong>' + (mod.nb ? ' (notified body)' : '') + '</li>';
    });
    html += '</ul></div>';
  }

  html += '<div class="ca-notes"><h3 style="font-size:13px;font-weight:600;color:#374151;margin-bottom:8px;">Regulatory Notes</h3><ul>';
  data.notes.forEach(function(n) { html += '<li>' + n + '</li>'; });
  html += '</ul></div>';

  html += '</div></div>';

  // CTA
  html += '<div class="ca-cta">';
  html += '<h3>Ready to Prepare Your Technical File?</h3>';
  html += '<p>CRANIS2 guides you through every step of CRA compliance \\u2014 from SBOM management and vulnerability scanning to technical documentation and EU Declaration of Conformity generation.</p>';
  html += '<a class="ca-cta-btn" href="https://dev.cranis2.dev">Start Your Free Assessment</a>';
  html += '</div>';

  html += '<div style="text-align:center;margin-top:16px;"><button class="ca-reset" onclick="resetForm()">Try Another Category</button></div>';

  const resultDiv = document.getElementById('ca-result');
  resultDiv.innerHTML = html;
  resultDiv.classList.add('visible');
  document.getElementById('ca-form').style.display = 'none';
  resultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetForm() {
  document.getElementById('ca-result').classList.remove('visible');
  document.getElementById('ca-result').innerHTML = '';
  document.getElementById('ca-form').style.display = 'block';
  document.querySelectorAll('.ca-option').forEach(o => o.classList.remove('selected'));
  document.getElementById('standards-step').style.display = 'none';
  document.getElementById('standards-checkbox').checked = false;
  document.getElementById('ca-submit').disabled = true;
  selectedCategory = null;
}
</script>
</body>
</html>`;
}

/* ── Start ────────────────────────────────────────────────────────────── */

app.listen(PORT, () => {
  console.log(`CRANIS2 Welcome site running on port ${PORT}`);
});

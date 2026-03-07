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

/* ── Start ────────────────────────────────────────────────────────────── */

app.listen(PORT, () => {
  console.log(`CRANIS2 Welcome site running on port ${PORT}`);
});

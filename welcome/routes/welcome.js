const express = require('express');
const path = require('path');
const fs = require('fs');
const { WELCOME_USER, WELCOME_PASS, RESEND_API_KEY } = require('../config');
const { makeToken, isAuthenticated, escapeHtml } = require('../lib/auth');
const { logAccess } = require('../lib/logging');
const { sendEmail } = require('../lib/email');
const { assessmentLandingPage, loginPage } = require('../templates/landing-page');

const router = express.Router();

/* ── Login ──────────────────────────────────────────────────────────── */

router.get('/login', (req, res) => {
  const error = req.query.error === '1';
  logAccess(req, 'login_page');
  res.send(loginPage(error));
});

router.post('/login', (req, res) => {
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

router.get('/logout', (req, res) => {
  logAccess(req, 'logout');
  res.clearCookie('welcome_auth');
  res.redirect('/login');
});

/* ── Access log ─────────────────────────────────────────────────────── */

router.get('/access-log', (req, res) => {
  if (!isAuthenticated(req)) return res.redirect('/login');
  logAccess(req, 'view_log');
  try {
    const { LOG_FILE } = require('../config');
    const raw = fs.readFileSync(LOG_FILE, 'utf-8').trim();
    const entries = raw ? raw.split('\n').map(line => JSON.parse(line)) : [];
    res.json({ total: entries.length, entries: entries.reverse() });
  } catch {
    res.json({ total: 0, entries: [] });
  }
});

/* ── Contact form ───────────────────────────────────────────────────── */

router.post('/contact', async (req, res) => {
  const { name, email, position } = req.body || {};
  if (!name || !email || !position) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  logAccess(req, 'contact_form');

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return res.status(500).json({ error: 'Email service not configured.' });
  }

  try {
    const thankYouRes = await sendEmail({
      from: 'CRANIS2 <noreply@poste.cranis2.com>',
      to: email,
      subject: 'Thank you for your interest in CRANIS2',
      html: `<p>Dear ${escapeHtml(name)},</p>
<p>Thank you for your interest in CRANIS2. We have received your enquiry and will be in touch shortly.</p>
<p>Best regards,<br>The CRANIS2 Team</p>`,
    });
    if (!thankYouRes.ok) {
      return res.status(502).json({ error: 'Failed to send confirmation email.' });
    }

    await sendEmail({
      from: 'CRANIS2 Welcome <noreply@poste.cranis2.com>',
      to: 'info@cranis2.com',
      subject: `New CRANIS2 Enquiry \u2013 ${name} (${position})`,
      html: `<h3>New Enquiry from Welcome Page</h3>
<table style="border-collapse:collapse;">
<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Name</td><td>${escapeHtml(name)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Email</td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Position</td><td>${escapeHtml(position)}</td></tr>
</table>`,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Contact form email error:', err);
    res.status(500).json({ error: 'Failed to send email.' });
  }
});

/* ── Landing pages ──────────────────────────────────────────────────── */

router.get('/conformity-assessment', (req, res) => {
  logAccess(req, 'assessment_landing');
  res.send(assessmentLandingPage());
});

router.get('/welcome', (req, res) => {
  logAccess(req, 'page_view');
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

router.get('/', (req, res) => {
  logAccess(req, 'page_view');
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

module.exports = router;

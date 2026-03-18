const express = require('express');
const path = require('path');
const fs = require('fs');
const { WELCOME_USER, WELCOME_PASS, RESEND_API_KEY } = require('../config');
const { makeToken, isAuthenticated, escapeHtml, generateCode } = require('../lib/auth');
const { logAccess } = require('../lib/logging');
const { sendEmail, sendVerificationCode } = require('../lib/email');
const { getPool } = require('../lib/database');
const { isDisposableEmail, getEmailDomain } = require('../lib/disposable-domains');
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

/* ── Admin: contact submissions ────────────────────────────────────── */

router.get('/welcome-admin/contact-submissions', async (req, res) => {
  if (!isAuthenticated(req)) return res.redirect('/login');
  const pool = getPool();
  if (!pool) return res.json({ total: 0, submissions: [] });

  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, position, status, lead_notified, lead_notify_error,
              ip, country, created_at, verified_at, updated_at
       FROM contact_submissions
       ORDER BY created_at DESC
       LIMIT 200`
    );
    res.json({ total: rows.length, submissions: rows });
  } catch (err) {
    console.error('Admin contact submissions error:', err);
    res.status(500).json({ error: 'Failed to fetch submissions.' });
  }
});

/* ── Admin: disposable email log ──────────────────────────────────── */

router.get('/welcome-admin/disposable-emails', async (req, res) => {
  if (!isAuthenticated(req)) return res.redirect('/login');
  const pool = getPool();
  if (!pool) return res.json({ total: 0, entries: [] });

  try {
    const { rows } = await pool.query(
      `SELECT id, email, name, domain, ip, country, source, created_at
       FROM disposable_email_log
       ORDER BY created_at DESC
       LIMIT 200`
    );
    res.json({ total: rows.length, entries: rows });
  } catch (err) {
    console.error('Admin disposable email log error:', err);
    res.status(500).json({ error: 'Failed to fetch disposable email log.' });
  }
});

/* ── Contact form — Step 1: submit details & send verification code ── */

router.post('/contact', async (req, res) => {
  const { name, email, position } = req.body || {};
  const trimmedName = (name || '').trim();
  const trimmedEmail = (email || '').trim().toLowerCase();
  const trimmedPosition = (position || '').trim() || null;

  if (!trimmedName || !trimmedEmail) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const pool = getPool();
  const ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip;
  const country = req.headers['cf-ipcountry'] || null;
  const userAgent = req.headers['user-agent'] || null;

  logAccess(req, 'contact_form', { name: trimmedName, email: trimmedEmail, position: trimmedPosition });

  /* ── Disposable email honeypot: silent fake flow ────────────────── */
  if (isDisposableEmail(trimmedEmail)) {
    const domain = getEmailDomain(trimmedEmail);
    console.warn(`[HONEYPOT] Disposable email detected: ${domain} from ${ip}`);

    if (pool) {
      try {
        await pool.query(
          `INSERT INTO disposable_email_log (email, name, domain, ip, country, user_agent, source)
           VALUES ($1, $2, $3, $4, $5, $6, 'contact')`,
          [trimmedEmail, trimmedName, domain, ip, country, userAgent]
        );
      } catch (err) {
        console.error('Failed to log disposable email:', err.message);
      }
    }

    // Return success — indistinguishable from the real flow
    return res.json({ ok: true, step: 'verify' });
  }

  /* ── Real flow: persist submission & send verification code ─────── */
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return res.status(500).json({ error: 'Email service not configured.' });
  }
  if (!pool) {
    return res.status(503).json({ error: 'Service temporarily unavailable.' });
  }

  try {
    // Insert submission record
    const { rows } = await pool.query(
      `INSERT INTO contact_submissions (name, email, position, status, ip, country, user_agent)
       VALUES ($1, $2, $3, 'pending_verification', $4, $5, $6)
       RETURNING id`,
      [trimmedName, trimmedEmail, trimmedPosition, ip, country, userAgent]
    );
    const submissionId = rows[0].id;

    // Rate-limit: max 3 codes per email per hour
    const { rows: recent } = await pool.query(
      `SELECT COUNT(*) FROM cra_verification_codes
       WHERE email = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [trimmedEmail]
    );
    if (parseInt(recent[0].count, 10) >= 3) {
      return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    }

    // Generate and store verification code
    const code = generateCode();
    await pool.query(
      `INSERT INTO cra_verification_codes (email, code, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '10 minutes')`,
      [trimmedEmail, code]
    );

    // Send verification code email
    const codeRes = await sendVerificationCode(trimmedEmail, code, 'Contact');
    if (!codeRes.ok) {
      console.error(`[CONTACT] Failed to send verification code to ${trimmedEmail}:`, codeRes);
      return res.status(502).json({ error: 'Failed to send verification code. Please try again.' });
    }

    console.log(`[CONTACT] Verification code sent for submission ${submissionId}`);
    res.json({ ok: true, step: 'verify', submissionId });
  } catch (err) {
    console.error('Contact form error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

/* ── Contact form — Step 2: verify code & complete submission ──────── */

router.post('/contact/verify', async (req, res) => {
  const { email, code, submissionId } = req.body || {};
  const trimmedEmail = (email || '').trim().toLowerCase();
  const trimmedCode = (code || '').trim();

  if (!trimmedEmail || !trimmedCode) {
    return res.status(400).json({ error: 'Email and verification code are required.' });
  }

  /* ── Disposable email honeypot: accept any code silently ────────── */
  if (isDisposableEmail(trimmedEmail)) {
    return res.json({ ok: true });
  }

  const pool = getPool();
  if (!pool) return res.status(503).json({ error: 'Service temporarily unavailable.' });

  try {
    // Verify code
    const { rows } = await pool.query(
      `UPDATE cra_verification_codes
       SET used = TRUE
       WHERE email = $1 AND code = $2 AND used = FALSE AND expires_at > NOW()
       RETURNING id`,
      [trimmedEmail, trimmedCode]
    );
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired code. Please try again.' });
    }

    // Update submission status
    let subId = submissionId;
    if (subId) {
      await pool.query(
        `UPDATE contact_submissions SET status = 'verified', verified_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND email = $2`,
        [subId, trimmedEmail]
      );
    } else {
      // Fallback: find most recent pending submission for this email
      const { rows: subs } = await pool.query(
        `UPDATE contact_submissions SET status = 'verified', verified_at = NOW(), updated_at = NOW()
         WHERE id = (
           SELECT id FROM contact_submissions
           WHERE email = $1 AND status = 'pending_verification'
           ORDER BY created_at DESC LIMIT 1
         )
         RETURNING id, name, position`,
        [trimmedEmail]
      );
      if (subs.length > 0) subId = subs[0].id;
    }

    // Fetch submission details for emails
    const { rows: subRows } = await pool.query(
      `SELECT name, email, position FROM contact_submissions WHERE id = $1`,
      [subId]
    );
    if (subRows.length === 0) {
      return res.status(400).json({ error: 'Submission not found.' });
    }
    const sub = subRows[0];

    // Send thank-you email
    const thankYouRes = await sendEmail({
      from: 'CRANIS2 <noreply@poste.cranis2.com>',
      to: sub.email,
      subject: 'Thank you for your interest in CRANIS2',
      html: `<p>Dear ${escapeHtml(sub.name)},</p>
<p>Thank you for your interest in CRANIS2. We have received your enquiry and will be in touch shortly.</p>
<p>Best regards,<br>The CRANIS2 Team</p>`,
    });
    if (!thankYouRes.ok) {
      console.error(`[CONTACT] Failed to send thank-you email to ${sub.email}:`, thankYouRes);
    }

    // Send lead notification — check and log result
    const positionText = sub.position ? ` (${sub.position})` : '';
    const leadRes = await sendEmail({
      from: 'CRANIS2 Welcome <noreply@poste.cranis2.com>',
      to: 'info@cranis2.com',
      subject: `New CRANIS2 Enquiry \u2013 ${sub.name}${positionText}`,
      html: `<h3>New Enquiry from Welcome Page</h3>
<table style="border-collapse:collapse;">
<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Name</td><td>${escapeHtml(sub.name)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Email</td><td><a href="mailto:${escapeHtml(sub.email)}">${escapeHtml(sub.email)}</a></td></tr>
${sub.position ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Position</td><td>${escapeHtml(sub.position)}</td></tr>` : ''}
</table>`,
    });

    if (leadRes.ok) {
      await pool.query(
        `UPDATE contact_submissions SET lead_notified = TRUE, status = 'lead_notified', updated_at = NOW()
         WHERE id = $1`,
        [subId]
      );
      console.log(`[CONTACT] Lead notification sent for submission ${subId}`);
    } else {
      const errMsg = leadRes.body || leadRes.reason || 'unknown';
      await pool.query(
        `UPDATE contact_submissions SET lead_notified = FALSE, lead_notify_error = $2, status = 'lead_failed', updated_at = NOW()
         WHERE id = $1`,
        [subId, String(errMsg)]
      );
      console.error(`[CONTACT] Lead notification FAILED for submission ${subId}: ${errMsg}`);
    }

    logAccess(req, 'contact_verified', { email: sub.email, submissionId: subId });
    res.json({ ok: true });
  } catch (err) {
    console.error('Contact verify error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
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

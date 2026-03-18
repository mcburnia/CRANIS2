const express = require('express');
const { getPool } = require('../lib/database');
const { escapeHtml, verifyUnsubscribeToken, getUnsubscribeUrl, generateCode } = require('../lib/auth');
const { logAccess } = require('../lib/logging');
const { sendEmail, sendVerificationCode, isConfigured } = require('../lib/email');
const { isDisposableEmail, getEmailDomain } = require('../lib/disposable-domains');
const { unsubscribePage } = require('../templates/landing-page');

const router = express.Router();

/* ── Subscribe — Step 1: send verification code ────────────────────── */

router.post('/subscribe', async (req, res) => {
  const { email } = req.body || {};
  const trimmedEmail = (email || '').trim().toLowerCase();
  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return res.status(400).json({ error: 'Valid email address is required.' });
  }

  const pool = getPool();
  if (!pool) return res.status(503).json({ error: 'Database not available.' });

  const ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip;
  const country = req.headers['cf-ipcountry'] || null;
  const userAgent = req.headers['user-agent'] || null;

  logAccess(req, 'launch_subscribe_start', { email: trimmedEmail });

  /* ── Disposable email honeypot ──────────────────────────────────── */
  if (isDisposableEmail(trimmedEmail)) {
    const domain = getEmailDomain(trimmedEmail);
    console.warn(`[HONEYPOT] Disposable email on subscribe: ${domain} from ${ip}`);
    try {
      await pool.query(
        `INSERT INTO disposable_email_log (email, name, domain, ip, country, user_agent, source)
         VALUES ($1, NULL, $2, $3, $4, $5, 'subscribe')`,
        [trimmedEmail, domain, ip, country, userAgent]
      );
    } catch (err) {
      console.error('Failed to log disposable email:', err.message);
    }
    return res.json({ ok: true, step: 'verify' });
  }

  if (!isConfigured()) {
    return res.status(500).json({ error: 'Email service not configured.' });
  }

  try {
    // Rate-limit: max 3 codes per email per hour
    const { rows: recent } = await pool.query(
      `SELECT COUNT(*) FROM cra_verification_codes
       WHERE email = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [trimmedEmail]
    );
    if (parseInt(recent[0].count, 10) >= 3) {
      return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    }

    const code = generateCode();
    await pool.query(
      `INSERT INTO cra_verification_codes (email, code, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '10 minutes')`,
      [trimmedEmail, code]
    );

    const codeRes = await sendVerificationCode(trimmedEmail, code, 'Subscribe');
    if (!codeRes.ok) {
      console.error(`[SUBSCRIBE] Failed to send verification code to ${trimmedEmail}:`, codeRes);
      return res.status(502).json({ error: 'Failed to send verification code. Please try again.' });
    }

    console.log(`[SUBSCRIBE] Verification code sent to ${trimmedEmail}`);
    res.json({ ok: true, step: 'verify' });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ error: 'Failed to subscribe.' });
  }
});

/* ── Subscribe — Step 2: verify code & complete subscription ───────── */

router.post('/subscribe/verify', async (req, res) => {
  const { email, code } = req.body || {};
  const trimmedEmail = (email || '').trim().toLowerCase();
  const trimmedCode = (code || '').trim();

  if (!trimmedEmail || !trimmedCode) {
    return res.status(400).json({ error: 'Email and verification code are required.' });
  }

  /* ── Disposable email honeypot: accept any code ─────────────────── */
  if (isDisposableEmail(trimmedEmail)) {
    return res.json({ ok: true });
  }

  const pool = getPool();
  if (!pool) return res.status(503).json({ error: 'Database not available.' });

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

    // Add to subscriber list
    await pool.query(
      `INSERT INTO cra_launch_subscribers (email, source) VALUES ($1, 'assessment')
       ON CONFLICT (email) DO NOTHING`,
      [trimmedEmail]
    );

    // Send confirmation email
    if (isConfigured()) {
      const confirmRes = await sendEmail({
        from: 'CRANIS2 <noreply@poste.cranis2.com>',
        to: trimmedEmail,
        subject: 'You\u2019re on the CRANIS2 launch list',
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 20px;">
<div style="font-size:13px;font-weight:700;color:#a855f7;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:16px;">CRANIS2</div>
<h2 style="font-size:20px;color:#111827;margin-bottom:16px;">You\u2019re on the list</h2>
<p style="font-size:14px;color:#4b5563;line-height:1.6;margin-bottom:16px;">Thank you for your interest in CRANIS2. We\u2019ll notify you as soon as the platform is ready for launch \u2013 and not before.</p>
<p style="font-size:14px;color:#4b5563;line-height:1.6;margin-bottom:16px;">In the meantime, your CRA Readiness Assessment report is available in your inbox if you haven\u2019t already received it.</p>
<p style="font-size:14px;color:#4b5563;line-height:1.6;margin-bottom:24px;">Learn more about what CRANIS2 can do for your organisation: <a href="https://dev.cranis2.dev/welcome" style="color:#a855f7;font-weight:600;">dev.cranis2.dev/welcome</a></p>
<div style="background:#f9fafb;border-radius:8px;padding:16px;font-size:13px;color:#6b7280;line-height:1.6;">
<strong style="color:#374151;">Our promise:</strong> We will only use your email address to notify you of the CRANIS2 launch. We will never spam you or share your information with anyone.
</div>
<p style="font-size:12px;color:#9ca3af;margin-top:24px;"><a href="${getUnsubscribeUrl(trimmedEmail)}" style="color:#9ca3af;">Unsubscribe</a> &middot; \u00a9 CRANIS2 ${new Date().getFullYear()}</p>
</div>`,
      });
      if (!confirmRes.ok) {
        console.error(`[SUBSCRIBE] Confirmation email failed for ${trimmedEmail}:`, confirmRes);
      }

      // Lead notification — check and log result
      const leadRes = await sendEmail({
        from: 'CRANIS2 Launch List <noreply@poste.cranis2.com>',
        to: 'info@cranis2.com',
        subject: `New launch subscriber \u2013 ${trimmedEmail}`,
        html: `<p>New subscriber to the CRANIS2 launch notification list:</p><p><strong>${escapeHtml(trimmedEmail)}</strong></p><p>Source: Assessment page (verified)</p>`,
      });
      if (!leadRes.ok) {
        console.error(`[SUBSCRIBE] Lead notification FAILED for ${trimmedEmail}:`, leadRes.body || leadRes.reason);
      } else {
        console.log(`[SUBSCRIBE] Lead notification sent for ${trimmedEmail}`);
      }
    }

    logAccess(req, 'launch_subscribe_verified', { email: trimmedEmail });
    res.json({ ok: true });
  } catch (err) {
    console.error('Subscribe verify error:', err);
    res.status(500).json({ error: 'Failed to subscribe.' });
  }
});

/* ── Unsubscribe from launch list ───────────────────────────────────── */

router.get('/unsubscribe', async (req, res) => {
  const token = req.query.token;
  const email = verifyUnsubscribeToken(token);

  if (!email) {
    return res.status(400).send(unsubscribePage(false, 'Invalid or expired unsubscribe link.'));
  }

  const pool = getPool();
  if (!pool) {
    return res.status(503).send(unsubscribePage(false, 'Service temporarily unavailable.'));
  }

  try {
    await pool.query(
      `DELETE FROM cra_launch_subscribers WHERE email = $1 RETURNING id`,
      [email]
    );

    logAccess(req, 'launch_unsubscribe');
    return res.send(unsubscribePage(true, email));
  } catch (err) {
    console.error('Unsubscribe error:', err);
    return res.status(500).send(unsubscribePage(false, 'Something went wrong. Please try again.'));
  }
});

module.exports = router;

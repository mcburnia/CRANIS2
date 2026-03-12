const express = require('express');
const { getPool } = require('../lib/database');
const { escapeHtml, verifyUnsubscribeToken, getUnsubscribeUrl } = require('../lib/auth');
const { logAccess } = require('../lib/logging');
const { sendEmail, isConfigured } = require('../lib/email');
const { unsubscribePage } = require('../templates/landing-page');

const router = express.Router();

/* ── Subscribe to launch notifications ──────────────────────────────── */

router.post('/subscribe', async (req, res) => {
  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email address is required.' });
  }

  const pool = getPool();
  if (!pool) return res.status(503).json({ error: 'Database not available.' });

  try {
    await pool.query(
      `INSERT INTO cra_launch_subscribers (email, source) VALUES ($1, 'assessment')
       ON CONFLICT (email) DO NOTHING`,
      [email.toLowerCase()]
    );

    if (isConfigured()) {
      await sendEmail({
        from: 'CRANIS2 <noreply@poste.cranis2.com>',
        to: email,
        subject: 'You\u2019re on the CRANIS2 launch list',
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 20px;">
<div style="font-size:13px;font-weight:700;color:#a855f7;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:16px;">CRANIS2</div>
<h2 style="font-size:20px;color:#111827;margin-bottom:16px;">You\u2019re on the list</h2>
<p style="font-size:14px;color:#4b5563;line-height:1.6;margin-bottom:16px;">Thank you for your interest in CRANIS2. We\u2019ll notify you as soon as the platform is ready for launch \u2014 and not before.</p>
<p style="font-size:14px;color:#4b5563;line-height:1.6;margin-bottom:16px;">In the meantime, your CRA Readiness Assessment report is available in your inbox if you haven\u2019t already received it.</p>
<p style="font-size:14px;color:#4b5563;line-height:1.6;margin-bottom:24px;">Learn more about what CRANIS2 can do for your organisation: <a href="https://dev.cranis2.dev/welcome" style="color:#a855f7;font-weight:600;">dev.cranis2.dev/welcome</a></p>
<div style="background:#f9fafb;border-radius:8px;padding:16px;font-size:13px;color:#6b7280;line-height:1.6;">
<strong style="color:#374151;">Our promise:</strong> We will only use your email address to notify you of the CRANIS2 launch. We will never spam you or share your information with anyone.
</div>
<p style="font-size:12px;color:#9ca3af;margin-top:24px;"><a href="${getUnsubscribeUrl(email)}" style="color:#9ca3af;">Unsubscribe</a> &middot; \u00a9 CRANIS2 ${new Date().getFullYear()}</p>
</div>`,
      });

      await sendEmail({
        from: 'CRANIS2 Launch List <noreply@poste.cranis2.com>',
        to: 'info@cranis2.com',
        subject: `New launch subscriber \u2014 ${email}`,
        html: `<p>New subscriber to the CRANIS2 launch notification list:</p><p><strong>${escapeHtml(email)}</strong></p><p>Source: CRA Readiness Assessment</p>`,
      });
    }

    logAccess(req, 'launch_subscribe');
    res.json({ ok: true });
  } catch (err) {
    console.error('Subscribe error:', err);
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

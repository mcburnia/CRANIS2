/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

const { RESEND_API_KEY } = require('../config');

async function sendEmail({ from, to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.warn('[WELCOME] RESEND_API_KEY not set. Email not sent:', subject);
    return { ok: false, reason: 'no_api_key' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, html }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error('Resend email failed:', res.status, errBody);
    return { ok: false, status: res.status, body: errBody };
  }

  return { ok: true };
}

function sendVerificationCode(email, code, assessmentType = 'CRA') {
  return sendEmail({
    from: 'CRANIS2 <noreply@poste.cranis2.com>',
    to: email,
    subject: `Your CRANIS2 verification code: ${code}`,
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;">
<div style="font-size:13px;font-weight:700;color:#a855f7;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:16px;">CRANIS2</div>
<h2 style="font-size:20px;color:#111827;margin-bottom:16px;">Your verification code</h2>
<p style="font-size:14px;color:#4b5563;margin-bottom:24px;">Enter this code to access or resume your ${assessmentType} Readiness Assessment:</p>
<div style="background:#f3f4f6;border-radius:8px;padding:16px;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;color:#111827;margin-bottom:24px;">${code}</div>
<p style="font-size:12px;color:#9ca3af;">This code expires in 10 minutes. If you didn\u2019t request this, you can safely ignore this email.</p>
</div>`,
  });
}

function sendLeadNotification({ subject, html }) {
  return sendEmail({
    from: 'CRANIS2 Assessment <noreply@poste.cranis2.com>',
    to: 'info@cranis2.com',
    subject,
    html,
  }).catch(err => console.error('Lead notification failed:', err));
}

function isConfigured() {
  return !!RESEND_API_KEY;
}

module.exports = { sendEmail, sendVerificationCode, sendLeadNotification, isConfigured };

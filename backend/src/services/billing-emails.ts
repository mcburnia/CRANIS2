/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

import { Resend } from 'resend';

// When RESEND_API_KEY is unset (tests, or an unconfigured environment) email
// is disabled rather than throwing — so a lifecycle run never crashes on a
// missing key. The send-site API (`resend.emails.send`) is preserved.
const _resendClient = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const resend = {
  emails: {
    send: async (opts: any) => {
      if (!_resendClient) {
        console.log('[EMAIL] skipped (no RESEND_API_KEY):', opts?.subject);
        return;
      }
      return _resendClient.emails.send(opts);
    },
  },
};
const from = process.env.EMAIL_FROM || 'info@cranis2.com';
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';

interface OrgInfo {
  orgId: string;
  orgName: string;
  billingEmail?: string;
}

// ── Shared email template wrapper ──

function wrapEmail(title: string, body: string): string {
  return `
    <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 2rem; background: #0a0a0f; color: #e4e4e7;">
      <div style="margin-bottom: 1.5rem;">
        <span style="font-size: 1.25rem; font-weight: 800; color: #e4e4e7;">CRANIS</span><span style="font-size: 1.25rem; font-weight: 800; color: #a855f7;">2</span>
      </div>
      <h2 style="font-size: 1.2rem; color: #e4e4e7; margin-bottom: 1rem;">${title}</h2>
      ${body}
      <hr style="border: none; border-top: 1px solid #2a2d3a; margin: 2rem 0;" />
      <p style="color: #71717a; font-size: 0.75rem;">
        CRANIS2 – CRA Compliance Made Simple<br/>
        <a href="${frontendUrl}/billing" style="color: #a855f7; text-decoration: none;">Manage Billing</a>
      </p>
    </div>
  `;
}

function actionButton(label: string, url: string, color: string = '#3b82f6'): string {
  return `<a href="${url}" style="display: inline-block; background: ${color}; color: #fff; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.95rem; margin: 1rem 0;">${label}</a>`;
}

function textParagraph(text: string): string {
  return `<p style="color: #a1a1aa; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1rem;">${text}</p>`;
}

// ── Trial emails ──

export async function sendTrialExpiryWarning(org: OrgInfo, daysLeft: number): Promise<void> {
  const to = org.billingEmail;
  if (!to) return;

  await resend.emails.send({
    from: `CRANIS2 <${from}>`,
    to,
    subject: `Your CRANIS2 trial ends in ${daysLeft} days`,
    html: wrapEmail(
      `Your trial ends in ${daysLeft} days`,
      textParagraph(`Hi ${org.orgName},`) +
      textParagraph(`Your free trial of CRANIS2 will expire in <strong>${daysLeft} days</strong>. To continue using all features without interruption, upgrade to the Standard plan.`) +
      textParagraph('The Standard plan is just <strong>\u20ac6 per contributor per month</strong>, with automatic tax handling and no hidden fees.') +
      actionButton('Upgrade Now', `${frontendUrl}/billing`) +
      textParagraph('If you have any questions about pricing or need more time, just reply to this email.')
    ),
  });
}

export async function sendTrialExpired(org: OrgInfo): Promise<void> {
  const to = org.billingEmail;
  if (!to) return;

  await resend.emails.send({
    from: `CRANIS2 <${from}>`,
    to,
    subject: 'Your CRANIS2 trial has ended',
    html: wrapEmail(
      'Your trial has ended',
      textParagraph(`Hi ${org.orgName},`) +
      textParagraph('Your free trial of CRANIS2 has expired. You have a <strong>7-day grace period</strong> to subscribe before your account becomes read-only.') +
      textParagraph('During this grace period, all features remain fully accessible.') +
      actionButton('Subscribe Now', `${frontendUrl}/billing`) +
      textParagraph('If you need an extension or have any questions, please reply to this email.')
    ),
  });
}

export async function sendTrialGraceEnded(org: OrgInfo): Promise<void> {
  const to = org.billingEmail;
  if (!to) return;

  await resend.emails.send({
    from: `CRANIS2 <${from}>`,
    to,
    subject: 'Your CRANIS2 account is now read-only',
    html: wrapEmail(
      'Your account is now read-only',
      textParagraph(`Hi ${org.orgName},`) +
      textParagraph('Your trial grace period has ended. Your account is now in <strong>read-only mode</strong> \u2014 you can still view your data but cannot make changes.') +
      textParagraph('Subscribe to restore full access to all features immediately.') +
      actionButton('Subscribe Now', `${frontendUrl}/billing`, '#ef4444') +
      textParagraph('Your data will be retained for 12 months. If you need to export your data, you can still access it in read-only mode.')
    ),
  });
}

// ── Payment failure emails ──

export async function sendPaymentFailed(org: OrgInfo): Promise<void> {
  const to = org.billingEmail;
  if (!to) return;

  await resend.emails.send({
    from: `CRANIS2 <${from}>`,
    to,
    subject: 'Payment failed for your CRANIS2 subscription',
    html: wrapEmail(
      'Payment failed',
      textParagraph(`Hi ${org.orgName},`) +
      textParagraph('We were unable to process your latest payment. Please update your payment method to avoid any service interruption.') +
      textParagraph('You have a <strong>7-day grace period</strong> during which all features remain fully accessible.') +
      actionButton('Update Payment Method', `${frontendUrl}/billing`) +
      textParagraph('If this was unexpected, please check with your bank or try a different payment method.')
    ),
  });
}

export async function sendPaymentFailedUrgent(org: OrgInfo): Promise<void> {
  const to = org.billingEmail;
  if (!to) return;

  await resend.emails.send({
    from: `CRANIS2 <${from}>`,
    to,
    subject: '\u26a0\ufe0f Urgent: CRANIS2 account will be restricted in 2 days',
    html: wrapEmail(
      'Account restriction in 2 days',
      textParagraph(`Hi ${org.orgName},`) +
      textParagraph('Your payment is still outstanding and your grace period ends in <strong>2 days</strong>. After that, your account will become read-only.') +
      textParagraph('Please update your payment method immediately to avoid disruption.') +
      actionButton('Update Payment Method', `${frontendUrl}/billing`, '#ef4444') +
      textParagraph('If you\'re experiencing difficulties or extenuating circumstances, please reply to this email \u2014 we\'re here to help.')
    ),
  });
}

export async function sendAccessRestricted(org: OrgInfo): Promise<void> {
  const to = org.billingEmail;
  if (!to) return;

  await resend.emails.send({
    from: `CRANIS2 <${from}>`,
    to,
    subject: 'Your CRANIS2 account is now read-only',
    html: wrapEmail(
      'Account access restricted',
      textParagraph(`Hi ${org.orgName},`) +
      textParagraph('Due to an outstanding payment, your CRANIS2 account has been placed in <strong>read-only mode</strong>. You can still view your data but cannot make changes.') +
      textParagraph('Update your payment method to restore full access immediately.') +
      actionButton('Restore Access', `${frontendUrl}/billing`, '#ef4444') +
      textParagraph('If you\'re experiencing financial hardship or extenuating circumstances (holiday, illness, etc.), please reply to this email and we\'ll work with you.')
    ),
  });
}

// ── Cancellation emails ──

export async function sendSubscriptionCancelled(org: OrgInfo, accessUntil: string): Promise<void> {
  const to = org.billingEmail;
  if (!to) return;

  const formattedDate = new Date(accessUntil).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  await resend.emails.send({
    from: `CRANIS2 <${from}>`,
    to,
    subject: 'Your CRANIS2 subscription has been cancelled',
    html: wrapEmail(
      'Subscription cancelled',
      textParagraph(`Hi ${org.orgName},`) +
      textParagraph(`Your CRANIS2 subscription has been cancelled. You'll continue to have full access until <strong>${formattedDate}</strong>.`) +
      textParagraph('After that date, your account will become read-only. Your data will be retained for <strong>12 months</strong>, and you can export it at any time.') +
      textParagraph('Changed your mind? You can resubscribe at any time.') +
      actionButton('Resubscribe', `${frontendUrl}/billing`) +
      textParagraph('We\'d love to hear your feedback on why you cancelled \u2014 it helps us improve.')
    ),
  });
}

// ── Data retention emails ──

export async function sendDataArchiveWarning(org: OrgInfo): Promise<void> {
  const to = org.billingEmail;
  if (!to) return;

  await resend.emails.send({
    from: `CRANIS2 <${from}>`,
    to,
    subject: 'Your CRANIS2 data will be archived in 30 days',
    html: wrapEmail(
      'Data archive notice',
      textParagraph(`Hi ${org.orgName},`) +
      textParagraph('Your CRANIS2 account data will be archived and made available for download in <strong>30 days</strong>. After the archive is created, it will be available for 30 days before permanent deletion.') +
      textParagraph('If you\'d like to keep your account active, you can resubscribe at any time.') +
      actionButton('Resubscribe', `${frontendUrl}/billing`) +
      actionButton('View Account', `${frontendUrl}/billing`, '#71717a')
    ),
  });
}

export async function sendDataArchiveReady(org: OrgInfo, downloadUrl: string): Promise<void> {
  const to = org.billingEmail;
  if (!to) return;

  await resend.emails.send({
    from: `CRANIS2 <${from}>`,
    to,
    subject: 'Your CRANIS2 data archive is ready',
    html: wrapEmail(
      'Data archive ready for download',
      textParagraph(`Hi ${org.orgName},`) +
      textParagraph('Your CRANIS2 data archive is ready. This includes all your products, SBOMs, compliance documents, risk findings, and audit logs.') +
      textParagraph('This download link will be available for <strong>30 days</strong>. After that, all data will be permanently deleted.') +
      actionButton('Download Archive', downloadUrl, '#22c55e') +
      textParagraph('If you\'d like to keep your account active instead, you can resubscribe at any time.') +
      actionButton('Resubscribe', `${frontendUrl}/billing`, '#3b82f6')
    ),
  });
}

// ── Lifecycle emails (CRAN: trial → lapse → win-back) ──

// Footer with a one-click "forget me" link. Used on win-back emails so a
// retained-but-lapsed contact always has a frictionless GDPR opt-out.
function forgetMeFooter(forgetUrl: string): string {
  return `
    <hr style="border: none; border-top: 1px solid #2a2d3a; margin: 2rem 0;" />
    <p style="color: #71717a; font-size: 0.72rem; line-height: 1.5;">
      You're receiving this because you started a CRANIS2 trial. Don't want to hear from us again?
      <a href="${forgetUrl}" style="color: #a855f7; text-decoration: underline;">Forget me &amp; erase my data</a>.
      We'll permanently delete your personal data and stop all contact (a minimal anonymised
      record is retained only where EU law requires it).
    </p>
  `;
}

/**
 * "Last chance" — sent the day the trial expires, as the 7-day grace begins.
 * Replaces the old repeating "trial has ended" email.
 */
export async function sendTrialLastChance(org: OrgInfo): Promise<void> {
  const to = org.billingEmail;
  if (!to) return;

  await resend.emails.send({
    from: `CRANIS2 <${from}>`,
    to,
    subject: 'Last chance — your CRANIS2 trial has ended',
    html: wrapEmail(
      'Last chance to keep your access',
      textParagraph(`Hi ${org.orgName},`) +
      textParagraph('Your free trial of CRANIS2 has ended. You have a <strong>7-day grace period</strong> before your account becomes read-only — after that you\'ll keep view-only access but won\'t be able to make changes.') +
      textParagraph('Subscribe now to keep everything running without interruption. The Standard plan is just <strong>€6 per contributor per month</strong>.') +
      actionButton('Subscribe Now', `${frontendUrl}/billing`, '#ef4444') +
      textParagraph('Need more time or have questions? Just reply to this email — a real person reads them.')
    ),
  });
}

/**
 * "Sorry to see you go" — sent once, when access actually ends (grace expired
 * or the account was explicitly closed). Anchors the win-back schedule.
 */
export async function sendSorryToSeeYouGo(org: OrgInfo): Promise<void> {
  const to = org.billingEmail;
  if (!to) return;

  await resend.emails.send({
    from: `CRANIS2 <${from}>`,
    to,
    subject: 'Sorry to see you go',
    html: wrapEmail(
      'Sorry to see you go',
      textParagraph(`Hi ${org.orgName},`) +
      textParagraph('Your CRANIS2 account is now read-only. We\'re sorry to see you go — and grateful you gave us a try.') +
      textParagraph('Your data is safe. We\'ll keep it for <strong>12 months</strong>, so if you change your mind you can pick up exactly where you left off. You can export it any time.') +
      actionButton('Reactivate my account', `${frontendUrl}/billing`) +
      textParagraph('If something didn\'t work for you, we\'d genuinely love to know — just reply to this email.')
    ),
  });
}

/**
 * Win-back #1 — sent ~1 month after the account lapsed/closed.
 * Carries the "forget me" opt-out link.
 */
export async function sendWinbackOneMonth(org: OrgInfo, forgetUrl: string): Promise<void> {
  const to = org.billingEmail;
  if (!to) return;

  await resend.emails.send({
    from: `CRANIS2 <${from}>`,
    to,
    subject: 'Fancy giving CRANIS2 another try?',
    html: wrapEmail(
      'Would you like to give CRANIS2 another try?',
      textParagraph(`Hi ${org.orgName},`) +
      textParagraph('It\'s been about a month. The EU Cyber Resilience Act deadlines haven\'t gone anywhere — and we\'ve been busy making CRANIS2 better at handling them for you.') +
      textParagraph('Your data is still here, exactly as you left it. One click and you\'re back up and running.') +
      actionButton('Reactivate my account', `${frontendUrl}/billing`, '#22c55e') +
      textParagraph('No pressure — just an open door whenever the timing\'s right.')
    ) + forgetMeFooter(forgetUrl),
  });
}

/**
 * Win-back #2 — sent ~6 months after win-back #1. Final outreach.
 * Carries the "forget me" opt-out link.
 */
export async function sendWinbackSixMonth(org: OrgInfo, forgetUrl: string): Promise<void> {
  const to = org.billingEmail;
  if (!to) return;

  await resend.emails.send({
    from: `CRANIS2 <${from}>`,
    to,
    subject: 'Still here whenever you need CRA compliance sorted',
    html: wrapEmail(
      'Whenever you\'re ready, we\'re here',
      textParagraph(`Hi ${org.orgName},`) +
      textParagraph('It\'s been a while. This is the last time we\'ll reach out — we don\'t believe in nagging.') +
      textParagraph('If CRA compliance is back on your plate, CRANIS2 can take the heavy lifting off it. Your data is still recoverable for a little longer.') +
      actionButton('Pick up where I left off', `${frontendUrl}/billing`, '#22c55e') +
      textParagraph('Either way, thank you for giving us a look. We wish you the best with it.')
    ) + forgetMeFooter(forgetUrl),
  });
}

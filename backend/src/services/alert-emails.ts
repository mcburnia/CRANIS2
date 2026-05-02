/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

/**
 * Email alerts for critical compliance events.
 *
 * Each function sends branded HTML emails to the relevant stakeholders
 * when a compliance event occurs. All are non-blocking (catch + log).
 * Deduplication prevents the same alert being emailed more than once
 * per 24 hours.
 */
import { Resend } from 'resend';
import pool from '../db/pool.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const from = process.env.EMAIL_FROM || 'info@cranis2.com';
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3002';

/* ── Shared email template helpers ───────────────────────────────────── */

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
        <a href="${frontendUrl}/notifications" style="color: #a855f7; text-decoration: none;">View All Notifications</a>
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

function severityBadge(severity: string): string {
  const colours: Record<string, string> = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#3b82f6',
  };
  const colour = colours[severity] || '#71717a';
  return `<span style="display: inline-block; background: ${colour}; color: #fff; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">${severity}</span>`;
}

function roleFooter(roles: string[]): string {
  const roleLabels: Record<string, string> = {
    security_contact: 'Security Contact',
    incident_response_lead: 'Incident Response Lead',
    compliance_officer: 'Compliance Officer',
    manufacturer_contact: 'Manufacturer Contact',
    technical_file_owner: 'Technical File Owner',
  };
  const labels = roles.map(r => roleLabels[r] || r).join(' / ');
  return `<p style="color: #52525b; font-size: 0.78rem; margin-top: 1.5rem;">You're receiving this because you're listed as <strong>${labels}</strong> in CRANIS2.</p>`;
}

/* ── Recipient lookup ────────────────────────────────────────────────── */

/**
 * Get deduplicated stakeholder emails for given roles at product and/or org level.
 */
export async function getAlertRecipients(
  orgId: string,
  productId: string | null,
  roles: string[]
): Promise<string[]> {
  if (roles.length === 0) return [];

  const placeholders = roles.map((_, i) => `$${i + 3}`).join(', ');
  const result = await pool.query(
    `SELECT DISTINCT s.email FROM stakeholders s
     WHERE s.org_id = $1
       AND (s.product_id = $2 OR s.product_id IS NULL)
       AND s.role_key IN (${placeholders})
       AND s.email IS NOT NULL AND s.email != ''`,
    [orgId, productId, ...roles]
  );

  return result.rows.map((r: { email: string }) => r.email);
}

/* ── Deduplication ───────────────────────────────────────────────────── */

/**
 * Check if an alert email with this key was already sent in the last 24h.
 * If not, record it and return true (meaning: go ahead and send).
 */
async function shouldSendAlert(alertKey: string): Promise<boolean> {
  const recent = await pool.query(
    `SELECT id FROM notifications
     WHERE metadata->>'alertEmailKey' = $1
       AND created_at > NOW() - INTERVAL '24 hours'
     LIMIT 1`,
    [alertKey]
  );
  return recent.rows.length === 0;
}

async function recordAlertSent(orgId: string, alertKey: string, subject: string): Promise<void> {
  await pool.query(
    `INSERT INTO notifications (org_id, user_id, type, severity, title, body, metadata, is_read)
     VALUES ($1, NULL, 'alert_email_sent', 'info', $2, 'Email alert sent', $3, TRUE)`,
    [orgId, subject, JSON.stringify({ alertEmailKey: alertKey })]
  );
}

/* ── Alert email functions ───────────────────────────────────────────── */

/**
 * 1. Vulnerability alert – new critical/high findings detected.
 */
export async function sendVulnerabilityAlertEmail(
  orgId: string,
  productName: string,
  criticalCount: number,
  highCount: number,
  productId: string
): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const alertKey = `vuln:${productId}:${today}`;
    if (!(await shouldSendAlert(alertKey))) return;

    const recipients = await getAlertRecipients(orgId, productId, [
      'security_contact', 'incident_response_lead', 'compliance_officer',
    ]);
    if (recipients.length === 0) return;

    const parts: string[] = [];
    if (criticalCount > 0) parts.push(`${criticalCount} critical`);
    if (highCount > 0) parts.push(`${highCount} high`);
    const summary = parts.join(' and ');

    const subject = `CRANIS2: ${summary} vulnerabilities found in ${productName}`;
    const severity = criticalCount > 0 ? 'critical' : 'high';

    const html = wrapEmail(
      `Vulnerabilities Detected`,
      severityBadge(severity) +
      textParagraph(`A vulnerability scan of <strong>${productName}</strong> has found ${summary} severity vulnerabilities that require attention.`) +
      (criticalCount > 0
        ? textParagraph(`<strong style="color: #ef4444;">${criticalCount} critical</strong> vulnerabilities may be actively exploited. CRA Article 14 requires reporting of actively exploited vulnerabilities within 24 hours.`)
        : '') +
      (highCount > 0
        ? textParagraph(`<strong style="color: #f97316;">${highCount} high</strong> severity vulnerabilities should be reviewed and remediated promptly.`)
        : '') +
      actionButton('View Risk Findings', `${frontendUrl}/risk-findings`) +
      roleFooter(['security_contact', 'incident_response_lead', 'compliance_officer'])
    );

    await resend.emails.send({ from: `CRANIS2 <${from}>`, to: recipients, subject, html });
    await recordAlertSent(orgId, alertKey, subject);
    console.log(`[ALERT-EMAIL] Vulnerability alert sent to ${recipients.length} recipients for ${productName}`);
  } catch (err) {
    console.error('[ALERT-EMAIL] Failed to send vulnerability alert:', (err as Error).message);
  }
}

/**
 * 2. Scan failure – auto-sync or vulnerability scan failed.
 */
export async function sendScanFailedEmail(
  orgId: string,
  productName: string,
  errorSummary: string,
  productId: string
): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const alertKey = `scan-fail:${productId}:${today}`;
    if (!(await shouldSendAlert(alertKey))) return;

    const recipients = await getAlertRecipients(orgId, productId, [
      'security_contact', 'technical_file_owner', 'compliance_officer',
    ]);
    if (recipients.length === 0) return;

    const subject = `CRANIS2: Scan failed for ${productName}`;

    const html = wrapEmail(
      'Scan Failed',
      severityBadge('high') +
      textParagraph(`An automated scan of <strong>${productName}</strong> has failed. This means the vulnerability database and SBOM may not be up to date.`) +
      textParagraph(`<strong>Error:</strong> ${errorSummary}`) +
      textParagraph('If this persists, check that the repository connection is still valid and that access tokens have not expired.') +
      actionButton('View Product', `${frontendUrl}/products/${productId}`) +
      roleFooter(['security_contact', 'technical_file_owner', 'compliance_officer'])
    );

    await resend.emails.send({ from: `CRANIS2 <${from}>`, to: recipients, subject, html });
    await recordAlertSent(orgId, alertKey, subject);
    console.log(`[ALERT-EMAIL] Scan failed alert sent to ${recipients.length} recipients for ${productName}`);
  } catch (err) {
    console.error('[ALERT-EMAIL] Failed to send scan failed alert:', (err as Error).message);
  }
}

/**
 * 3. SBOM stale – repository has changed but SBOM not yet refreshed.
 */
export async function sendSbomStaleEmail(
  orgId: string,
  productName: string,
  productId: string
): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const alertKey = `sbom-stale:${productId}:${today}`;
    if (!(await shouldSendAlert(alertKey))) return;

    const recipients = await getAlertRecipients(orgId, productId, [
      'security_contact', 'compliance_officer',
    ]);
    if (recipients.length === 0) return;

    const subject = `CRANIS2: SBOM outdated for ${productName}`;

    const html = wrapEmail(
      'SBOM Outdated',
      severityBadge('medium') +
      textParagraph(`The repository for <strong>${productName}</strong> has been updated, but the SBOM has not yet been refreshed. The dependency inventory may be out of date.`) +
      textParagraph('The SBOM will be automatically refreshed during the next scheduled sync (2 AM UTC). You can also trigger a manual sync from the product page.') +
      actionButton('View Product', `${frontendUrl}/products/${productId}`) +
      roleFooter(['security_contact', 'compliance_officer'])
    );

    await resend.emails.send({ from: `CRANIS2 <${from}>`, to: recipients, subject, html });
    await recordAlertSent(orgId, alertKey, subject);
    console.log(`[ALERT-EMAIL] SBOM stale alert sent to ${recipients.length} recipients for ${productName}`);
  } catch (err) {
    console.error('[ALERT-EMAIL] Failed to send SBOM stale alert:', (err as Error).message);
  }
}

/**
 * 4. Compliance gap – significant proportion of dependencies have hash/metadata gaps.
 */
export async function sendComplianceGapEmail(
  orgId: string,
  productName: string,
  gapPercentage: number,
  totalDeps: number,
  productId: string
): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const alertKey = `gap:${productId}:${today}`;
    if (!(await shouldSendAlert(alertKey))) return;

    const recipients = await getAlertRecipients(orgId, productId, [
      'security_contact', 'compliance_officer',
    ]);
    if (recipients.length === 0) return;

    const severity = gapPercentage > 20 ? 'high' : 'medium';
    const subject = `CRANIS2: Compliance gaps detected in ${productName}`;

    const html = wrapEmail(
      'Compliance Gaps Detected',
      severityBadge(severity) +
      textParagraph(`<strong>${gapPercentage}%</strong> of the ${totalDeps} dependencies in <strong>${productName}</strong> have compliance gaps: missing versions, unsupported ecosystems, or registry lookup failures.`) +
      textParagraph('CRA Article 13 requires complete SBOMs with cryptographic hashes for all components. These gaps should be reviewed and resolved where possible.') +
      actionButton('View Dependencies', `${frontendUrl}/products/${productId}?tab=sbom`) +
      roleFooter(['security_contact', 'compliance_officer'])
    );

    await resend.emails.send({ from: `CRANIS2 <${from}>`, to: recipients, subject, html });
    await recordAlertSent(orgId, alertKey, subject);
    console.log(`[ALERT-EMAIL] Compliance gap alert sent to ${recipients.length} recipients for ${productName}`);
  } catch (err) {
    console.error('[ALERT-EMAIL] Failed to send compliance gap alert:', (err as Error).message);
  }
}

/**
 * 5. CRA deadline approaching – ENISA report deadline is imminent.
 */
export async function sendDeadlineAlertEmail(
  orgId: string,
  reportType: string,
  hoursRemaining: number,
  reportId: string
): Promise<void> {
  try {
    const alertKey = `deadline:${reportId}:${hoursRemaining}h`;
    if (!(await shouldSendAlert(alertKey))) return;

    const recipients = await getAlertRecipients(orgId, null, [
      'incident_response_lead', 'compliance_officer', 'manufacturer_contact',
    ]);
    if (recipients.length === 0) return;

    const urgency = hoursRemaining <= 1 ? 'critical' : 'high';
    const timeLabel = hoursRemaining <= 1 ? 'less than 1 hour' : `${hoursRemaining} hours`;
    const reportLabel = reportType.replace(/_/g, ' ');
    const subject = `CRANIS2: CRA deadline in ${timeLabel} – ${reportLabel}`;

    const html = wrapEmail(
      'CRA Deadline Approaching',
      severityBadge(urgency) +
      textParagraph(`A <strong>${reportLabel}</strong> deadline is due in <strong>${timeLabel}</strong>.`) +
      textParagraph('The Cyber Resilience Act requires timely submission of vulnerability and incident reports to ENISA. Missing this deadline may result in regulatory consequences.') +
      (hoursRemaining <= 1
        ? textParagraph('<strong style="color: #ef4444;">This is your final reminder. Immediate action is required.</strong>')
        : '') +
      actionButton('View CRA Reports', `${frontendUrl}/cra-reports`) +
      roleFooter(['incident_response_lead', 'compliance_officer', 'manufacturer_contact'])
    );

    await resend.emails.send({ from: `CRANIS2 <${from}>`, to: recipients, subject, html });
    await recordAlertSent(orgId, alertKey, subject);
    console.log(`[ALERT-EMAIL] Deadline alert sent to ${recipients.length} recipients (${hoursRemaining}h remaining)`);
  } catch (err) {
    console.error('[ALERT-EMAIL] Failed to send deadline alert:', (err as Error).message);
  }
}

/**
 * 6. Support period ending/ended – product approaching or past end-of-support.
 */
export async function sendSupportEndAlertEmail(
  orgId: string,
  productName: string,
  daysRemaining: number,
  productId: string
): Promise<void> {
  try {
    const threshold = daysRemaining <= 0 ? 0 : daysRemaining <= 7 ? 7 : daysRemaining <= 30 ? 30 : daysRemaining <= 60 ? 60 : 90;
    const alertKey = `support-end:${productId}:${threshold}d`;
    if (!(await shouldSendAlert(alertKey))) return;

    const recipients = await getAlertRecipients(orgId, productId, [
      'compliance_officer', 'manufacturer_contact', 'security_contact',
    ]);
    if (recipients.length === 0) return;

    const isExpired = daysRemaining <= 0;
    const severity = isExpired ? 'critical' : daysRemaining <= 7 ? 'high' : 'medium';
    const timeLabel = isExpired
      ? 'has ended'
      : daysRemaining === 0 ? 'ends today'
      : `ends in ${daysRemaining} days`;

    const subject = `CRANIS2: Support period ${timeLabel} for ${productName}`;

    const html = wrapEmail(
      isExpired ? 'Support Period Ended' : 'Support Period Ending Soon',
      severityBadge(severity) +
      textParagraph(`The support period for <strong>${productName}</strong> ${timeLabel}.`) +
      textParagraph(isExpired
        ? 'CRA Article 13(8) requires that security patches are provided free of charge for the duration of the support period. As support has ended, ensure all end-of-support communications have been made to users.'
        : 'CRA Article 13(8) requires security patches to be provided for the full support period. Plan your end-of-support communications to users.') +
      actionButton('View Product', `${frontendUrl}/products/${productId}?tab=technical-file`) +
      roleFooter(['compliance_officer', 'manufacturer_contact', 'security_contact'])
    );

    await resend.emails.send({ from: `CRANIS2 <${from}>`, to: recipients, subject, html });
    await recordAlertSent(orgId, alertKey, subject);
    console.log(`[ALERT-EMAIL] Support end alert sent to ${recipients.length} recipients (${productName}, ${daysRemaining}d remaining)`);
  } catch (err) {
    console.error('[ALERT-EMAIL] Failed to send support end alert:', (err as Error).message);
  }
}

/**
 * 7. CRA milestone approaching – organisation-wide regulatory deadline alert.
 */
export async function sendCraMilestoneAlertEmail(
  orgId: string,
  milestoneLabel: string,
  daysRemaining: number,
  milestoneId: string
): Promise<void> {
  try {
    const alertKey = `cra-milestone:${orgId}:${milestoneId}:${daysRemaining}d`;
    if (!(await shouldSendAlert(alertKey))) return;

    const recipients = await getAlertRecipients(orgId, null, [
      'compliance_officer', 'manufacturer_contact',
    ]);
    if (recipients.length === 0) return;

    const severity = daysRemaining <= 30 ? 'high' : daysRemaining <= 60 ? 'medium' : 'info';
    const subject = `CRANIS2: CRA milestone in ${daysRemaining} days – ${milestoneLabel}`;

    const html = wrapEmail(
      'CRA Milestone Approaching',
      severityBadge(severity) +
      textParagraph(`The <strong>${milestoneLabel}</strong> deadline is in <strong>${daysRemaining} days</strong>.`) +
      textParagraph(daysRemaining <= 30
        ? 'This deadline is approaching rapidly. Ensure all required compliance activities are completed before this date.'
        : 'Use this time to review your compliance readiness and address any outstanding gaps.') +
      textParagraph('The Cyber Resilience Act (EU 2024/2847) imposes mandatory deadlines. Non-compliance may result in enforcement action by market surveillance authorities.') +
      actionButton('View Compliance Checklist', `${frontendUrl}/products`) +
      roleFooter(['compliance_officer', 'manufacturer_contact'])
    );

    await resend.emails.send({ from: `CRANIS2 <${from}>`, to: recipients, subject, html });
    await recordAlertSent(orgId, alertKey, subject);
    console.log(`[ALERT-EMAIL] CRA milestone alert sent to ${recipients.length} recipients (${milestoneLabel}, ${daysRemaining}d remaining)`);
  } catch (err) {
    console.error('[ALERT-EMAIL] Failed to send CRA milestone alert:', (err as Error).message);
  }
}

/**
 * 8. Compliance stall – product compliance progress has stalled for >7 days.
 */
export async function sendComplianceStallAlertEmail(
  orgId: string,
  productName: string,
  daysSinceUpdate: number,
  readiness: number,
  productId: string
): Promise<void> {
  try {
    // Weekly deduplication: one alert per product per ISO week
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24) + startOfYear.getDay() + 1) / 7);
    const alertKey = `compliance-stall:${productId}:w${weekNumber}`;
    if (!(await shouldSendAlert(alertKey))) return;

    const recipients = await getAlertRecipients(orgId, productId, [
      'compliance_officer', 'technical_file_owner',
    ]);
    if (recipients.length === 0) return;

    const subject = `CRANIS2: Compliance progress stalled for ${productName}`;

    const html = wrapEmail(
      'Compliance Progress Stalled',
      severityBadge('medium') +
      textParagraph(`No obligation updates have been made for <strong>${productName}</strong> in the last <strong>${daysSinceUpdate} days</strong>. Current CRA readiness is <strong>${readiness}%</strong>.`) +
      textParagraph('Consistent progress on compliance obligations helps avoid last-minute scrambles before CRA deadlines. Review your outstanding obligations and update their status.') +
      actionButton('View Obligations', `${frontendUrl}/products/${productId}?tab=obligations`) +
      roleFooter(['compliance_officer', 'technical_file_owner'])
    );

    await resend.emails.send({ from: `CRANIS2 <${from}>`, to: recipients, subject, html });
    await recordAlertSent(orgId, alertKey, subject);
    console.log(`[ALERT-EMAIL] Compliance stall alert sent to ${recipients.length} recipients (${productName}, ${daysSinceUpdate}d stalled, ${readiness}% readiness)`);
  } catch (err) {
    console.error('[ALERT-EMAIL] Failed to send compliance stall alert:', (err as Error).message);
  }
}

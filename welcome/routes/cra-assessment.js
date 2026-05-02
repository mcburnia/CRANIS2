/*
 * Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi@mcburnie.com
 */

const express = require('express');
const { RESEND_API_KEY } = require('../config');
const { getPool } = require('../lib/database');
const { escapeHtml, generateCode } = require('../lib/auth');
const { logAccess } = require('../lib/logging');
const { isEmailVerified, markEmailVerified } = require('../lib/verified-emails');
const { sendVerificationCode, sendEmail, sendLeadNotification, isConfigured } = require('../lib/email');
const { SECTIONS, QUESTIONS, CATEGORY_LABELS } = require('../data/cra-questions');
const { computeScores, determineCategory, getConformityModule, getTopRecommendations } = require('../lib/cra-scoring');
const { buildReportEmail } = require('../templates/cra-report-email');
const { conformityAssessmentPage } = require('../templates/cra-page');

const router = express.Router();

/* ── Page ───────────────────────────────────────────────────────────── */

router.get('/', (req, res) => {
  logAccess(req, 'cra_assessment_tool');
  res.send(conformityAssessmentPage());
});

/* ── Send verification code ─────────────────────────────────────────── */

router.post('/send-code', async (req, res) => {
  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const pool = getPool();
  if (!pool) return res.status(503).json({ error: 'Database not available.' });

  try {
    // Skip verification if email was already verified (any flow, within 90 days)
    const { verified } = await isEmailVerified(email);
    if (verified) {
      return res.json({ ok: true, alreadyVerified: true });
    }

    const recentCodes = await pool.query(
      `SELECT COUNT(*) FROM cra_verification_codes
       WHERE email = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [email.toLowerCase()]
    );
    if (parseInt(recentCodes.rows[0].count) >= 3) {
      return res.status(429).json({ error: 'Too many verification attempts. Please try again later.' });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `INSERT INTO cra_verification_codes (email, code, expires_at) VALUES ($1, $2, $3)`,
      [email.toLowerCase(), code, expiresAt]
    );

    if (!isConfigured()) {
      console.log(`[DEV] Verification code for ${email}: ${code}`);
      return res.json({ ok: true, dev_code: code });
    }

    const emailRes = await sendVerificationCode(email, code, 'CRA');
    if (!emailRes.ok) {
      return res.status(502).json({ error: 'Failed to send verification email.' });
    }

    logAccess(req, 'assessment_code_sent');
    res.json({ ok: true });
  } catch (err) {
    console.error('Send code error:', err);
    res.status(500).json({ error: 'Failed to send verification code.' });
  }
});

/* ── Verify code ────────────────────────────────────────────────────── */

router.post('/verify', async (req, res) => {
  const { email, code, skipCode } = req.body || {};
  if (!email || (!code && !skipCode)) {
    return res.status(400).json({ error: 'Email and code are required.' });
  }

  const pool = getPool();
  if (!pool) return res.status(503).json({ error: 'Database not available.' });

  try {
    if (skipCode) {
      // Server-side re-validation — client cannot fabricate verified status
      const { verified } = await isEmailVerified(email);
      if (!verified) {
        return res.status(401).json({ error: 'Email verification required.' });
      }
    } else {
      const result = await pool.query(
        `SELECT id FROM cra_verification_codes
         WHERE email = $1 AND code = $2 AND used = FALSE AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [email.toLowerCase(), code]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid or expired code. Please request a new one.' });
      }

      await pool.query(`UPDATE cra_verification_codes SET used = TRUE WHERE id = $1`, [result.rows[0].id]);

      // Remember this email as verified for future flows
      await markEmailVerified(email, 'cra');
    }

    const existing = await pool.query(
      `SELECT id, answers, current_section, completed_at FROM cra_assessments
       WHERE email = $1 ORDER BY updated_at DESC LIMIT 1`,
      [email.toLowerCase()]
    );

    let assessment;
    let isNewAssessment = false;
    if (existing.rows.length > 0 && !existing.rows[0].completed_at) {
      assessment = existing.rows[0];
    } else {
      const newAssessment = await pool.query(
        `INSERT INTO cra_assessments (email) VALUES ($1) RETURNING id, answers, current_section`,
        [email.toLowerCase()]
      );
      assessment = newAssessment.rows[0];
      isNewAssessment = true;
    }

    if (isNewAssessment && isConfigured()) {
      sendLeadNotification({
        subject: `New CRA assessment started \u2013 ${email.toLowerCase()}`,
        html: `<p>A new user has started the CRA Readiness Assessment:</p><p><strong>${escapeHtml(email)}</strong></p><p>Assessment ID: ${assessment.id}</p><p>Time: ${new Date().toISOString()}</p>`,
      });
    }

    logAccess(req, 'assessment_verified');
    res.json({
      ok: true,
      assessmentId: assessment.id,
      answers: assessment.answers,
      currentSection: assessment.current_section,
    });
  } catch (err) {
    console.error('Verify code error:', err);
    res.status(500).json({ error: 'Verification failed.' });
  }
});

/* ── Save progress ──────────────────────────────────────────────────── */

router.post('/save-progress', async (req, res) => {
  const { assessmentId, answers, currentSection } = req.body || {};
  if (!assessmentId) {
    return res.status(400).json({ error: 'Assessment ID is required.' });
  }

  const pool = getPool();
  if (!pool) return res.status(503).json({ error: 'Database not available.' });

  try {
    await pool.query(
      `UPDATE cra_assessments SET answers = $1, current_section = $2, updated_at = NOW()
       WHERE id = $3 AND completed_at IS NULL`,
      [JSON.stringify(answers || {}), currentSection || 0, assessmentId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Save progress error:', err);
    res.status(500).json({ error: 'Failed to save progress.' });
  }
});

/* ── Complete assessment ────────────────────────────────────────────── */

router.post('/complete', async (req, res) => {
  const { assessmentId, answers } = req.body || {};
  if (!assessmentId) {
    return res.status(400).json({ error: 'Assessment ID is required.' });
  }

  const pool = getPool();
  if (!pool) return res.status(503).json({ error: 'Database not available.' });

  try {
    const scores = computeScores(answers || {});
    const category = determineCategory(answers || {});

    await pool.query(
      `UPDATE cra_assessments
       SET answers = $1, scores = $2, category = $3, completed_at = NOW(), updated_at = NOW(),
           current_section = $4
       WHERE id = $5`,
      [JSON.stringify(answers || {}), JSON.stringify(scores), category, SECTIONS.length, assessmentId]
    );

    logAccess(req, 'assessment_completed');
    res.json({ ok: true, scores, category });
  } catch (err) {
    console.error('Complete assessment error:', err);
    res.status(500).json({ error: 'Failed to complete assessment.' });
  }
});

/* ── Send report email ──────────────────────────────────────────────── */

router.post('/send-report', async (req, res) => {
  const { assessmentId, email: reportEmail } = req.body || {};
  if (!assessmentId) {
    return res.status(400).json({ error: 'Assessment ID is required.' });
  }
  if (!reportEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reportEmail)) {
    return res.status(400).json({ error: 'Valid email address is required.' });
  }

  const pool = getPool();
  if (!pool) return res.status(503).json({ error: 'Database not available.' });
  if (!isConfigured()) return res.status(503).json({ error: 'Email service not configured.' });

  try {
    const result = await pool.query(
      `SELECT answers, scores, category, email FROM cra_assessments WHERE id = $1`,
      [assessmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found.' });
    }

    const { answers, scores, category } = result.rows[0];
    const conformity = getConformityModule(category);
    const recommendations = getTopRecommendations(scores, answers);

    const reportHtml = buildReportEmail(answers, scores, category, conformity, recommendations);

    const emailRes = await sendEmail({
      from: 'CRANIS2 <noreply@poste.cranis2.com>',
      to: reportEmail,
      subject: `Your CRA Readiness Assessment Report \u2013 ${scores.overallPct}% Ready`,
      html: reportHtml,
    });

    if (!emailRes.ok) {
      return res.status(502).json({ error: 'Failed to send report email.' });
    }

    // Lead notification
    await sendEmail({
      from: 'CRANIS2 Assessment <noreply@poste.cranis2.com>',
      to: 'info@cranis2.com',
      subject: `CRA Assessment Completed \u2013 ${reportEmail} (${scores.overallPct}% ready, ${CATEGORY_LABELS[category]})`,
      html: `<h3>CRA Readiness Assessment Completed</h3>
<table style="border-collapse:collapse;font-family:sans-serif;">
<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Email</td><td>${escapeHtml(reportEmail)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Readiness</td><td>${scores.overallPct}%</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Category</td><td>${CATEGORY_LABELS[category]}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Conformity Module</td><td>${conformity.module}</td></tr>
</table>
<h4>Section Scores</h4>
<table style="border-collapse:collapse;font-family:sans-serif;">
${SECTIONS.map(s => `<tr><td style="padding:2px 12px 2px 0;">${s.title}</td><td>${scores.sections[s.id].pct}% (${scores.sections[s.id].level})</td></tr>`).join('\n')}
</table>`,
    });

    logAccess(req, 'assessment_report_sent');
    res.json({ ok: true });
  } catch (err) {
    console.error('Send report error:', err);
    res.status(500).json({ error: 'Failed to send report.' });
  }
});

module.exports = router;

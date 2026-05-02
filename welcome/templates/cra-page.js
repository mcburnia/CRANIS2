/*
 * Copyright © 2026 Andrew (Andi) MCBURNIE. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
 *
 * This file is part of CRANIS2 — a personally-owned, personally-funded
 * software product. Unauthorised copying, modification, distribution,
 * or commercial use is prohibited. For licence enquiries:
 * andi.mcburnie@gmail.com
 */

const { SECTIONS, QUESTIONS, CATEGORY_LABELS } = require('../data/cra-questions');

function conformityAssessmentPage() {
  // Embed questions and sections as JSON for client-side rendering
  const sectionsJson = JSON.stringify(SECTIONS);
  const questionsJson = JSON.stringify(QUESTIONS);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CRA Readiness Assessment – CRANIS2</title>
<meta name="description" content="Free CRA readiness assessment. Find out your product's risk category, required conformity assessment module, and get a personalised maturity report with recommendations.">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #111827; min-height: 100vh; }
  .page { max-width: 680px; margin: 0 auto; padding: 40px 20px 80px; }
  .brand { font-size: 13px; font-weight: 700; color: #a855f7; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
  h1 { font-size: 26px; font-weight: 700; color: #111827; margin-bottom: 8px; line-height: 1.3; }
  .subtitle { font-size: 14px; color: #6b7280; margin-bottom: 28px; line-height: 1.6; }

  /* Progress bar */
  .progress-wrap { margin-bottom: 28px; }
  .progress-bar-bg { background: #e5e7eb; border-radius: 4px; height: 6px; }
  .progress-bar { background: #a855f7; border-radius: 4px; height: 6px; transition: width 0.3s; }
  .progress-label { display: flex; justify-content: space-between; font-size: 12px; color: #9ca3af; margin-top: 6px; }

  /* Cards */
  .card { background: white; border-radius: 12px; border: 1px solid #e5e7eb; padding: 28px; margin-bottom: 20px; }

  /* Email verification */
  .email-input { width: 100%; padding: 12px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; font-family: inherit; outline: none; margin-bottom: 12px; }
  .email-input:focus { border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168,85,247,0.1); }
  .code-input { width: 180px; padding: 12px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 18px; font-family: inherit; outline: none; text-align: center; letter-spacing: 4px; }
  .code-input:focus { border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168,85,247,0.1); }

  /* Buttons */
  .btn { padding: 12px 24px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s; }
  .btn-primary { background: #a855f7; color: white; }
  .btn-primary:hover { background: #9333ea; }
  .btn-primary:disabled { background: #d8b4fe; cursor: not-allowed; }
  .btn-secondary { background: white; color: #374151; border: 1px solid #d1d5db; }
  .btn-secondary:hover { background: #f9fafb; }
  .btn-sm { padding: 8px 16px; font-size: 13px; }

  /* Section header */
  .section-header { margin-bottom: 20px; }
  .section-num { font-size: 12px; font-weight: 600; color: #a855f7; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
  .section-title { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 8px; }
  .section-desc { font-size: 13px; color: #6b7280; line-height: 1.6; }

  /* Question */
  .question-block { margin-bottom: 28px; padding-bottom: 28px; border-bottom: 1px solid #f3f4f6; }
  .question-block:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
  .question-text { font-size: 15px; font-weight: 600; color: #111827; margin-bottom: 8px; line-height: 1.4; }
  .question-explain { font-size: 12px; color: #6b7280; line-height: 1.6; margin-bottom: 4px; background: #f9fafb; border-radius: 8px; padding: 12px; }
  .question-ref { font-size: 11px; color: #a855f7; font-weight: 600; margin-bottom: 12px; display: inline-block; }
  .explain-toggle { font-size: 12px; color: #6b7280; cursor: pointer; margin-bottom: 12px; display: inline-block; }
  .explain-toggle:hover { color: #374151; }

  /* Options */
  .option { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 8px; cursor: pointer; transition: background 0.1s; margin-bottom: 4px; }
  .option:hover { background: #f9fafb; }
  .option.selected { background: #f5f3ff; }
  .option input[type="radio"] { margin-top: 2px; accent-color: #a855f7; width: 16px; height: 16px; flex-shrink: 0; }
  .option label { font-size: 13px; color: #374151; line-height: 1.5; cursor: pointer; }

  /* Navigation */
  .nav-row { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }

  /* Results */
  .result-score { text-align: center; margin-bottom: 20px; }
  .result-score .big-num { font-size: 56px; font-weight: 700; line-height: 1; }
  .result-score .big-label { font-size: 14px; color: #6b7280; margin-top: 4px; }

  .maturity-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
  .maturity-label { font-size: 13px; color: #374151; width: 160px; flex-shrink: 0; }
  .maturity-bar-bg { flex: 1; background: #f3f4f6; border-radius: 4px; height: 16px; }
  .maturity-bar { border-radius: 4px; height: 16px; transition: width 0.5s; }
  .maturity-pct { font-size: 13px; font-weight: 600; width: 40px; text-align: right; }
  .maturity-level { font-size: 11px; color: #6b7280; width: 80px; }

  .conformity-box { padding: 16px; border-radius: 8px; margin-bottom: 16px; }
  .conformity-box.ok { background: #ecfdf5; border: 1px solid #a7f3d0; }
  .conformity-box.warning { background: #fffbeb; border: 1px solid #fde68a; }
  .conformity-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
  .conformity-desc { font-size: 13px; line-height: 1.6; }
  .conformity-tag { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; margin-top: 8px; }
  .conformity-tag.ok { background: #d1fae5; color: #065f46; }
  .conformity-tag.warning { background: #fef3c7; color: #92400e; }

  .rec-item { padding: 12px; border-radius: 8px; background: #f9fafb; margin-bottom: 8px; }
  .rec-priority { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .rec-priority.high { color: #ef4444; }
  .rec-priority.medium { color: #f59e0b; }
  .rec-question { font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 2px; }
  .rec-next { font-size: 12px; color: #6b7280; }
  .rec-ref { font-size: 11px; color: #a855f7; }

  /* Report form */
  .report-form { display: flex; gap: 8px; align-items: flex-start; }
  .report-form .email-input { margin-bottom: 0; flex: 1; }

  /* Error/success messages */
  .msg { padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 12px; }
  .msg-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
  .msg-success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
  .msg-info { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }

  .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #9ca3af; }
  .footer a { color: #a855f7; text-decoration: none; }

  .hidden { display: none; }

  /* Loading spinner */
  .spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; vertical-align: middle; margin-right: 6px; }
  @keyframes spin { to { transform: rotate(360deg); } }

  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .animate-in { animation: fadeIn 0.3s ease-out; }
</style>
</head>
<body>
<div class="page">
  <a href="/conformity-assessment" style="font-size:13px;color:#6b7280;text-decoration:none;display:inline-block;margin-bottom:16px;">\u2190 All assessments</a>
  <div class="brand">CRANIS2</div>
  <h1>CRA Readiness Assessment</h1>
  <p class="subtitle">
    Find out how ready your product is for the EU Cyber Resilience Act. This free assessment covers
    22 questions across 6 key areas, determines your product\u2019s risk category, identifies the
    required conformity assessment module, and provides personalised recommendations.<br>
    <strong>Takes about 10 minutes.</strong> You can save your progress and return later.
  </p>

  <!-- Phase 1: Email verification -->
  <div id="phase-email" class="card">
    <h2 style="font-size:18px;margin-bottom:4px;">Enter your email to begin</h2>
    <p style="font-size:13px;color:#6b7280;margin-bottom:16px;">We\u2019ll send you a verification code. Your progress is saved automatically so you can return at any time.</p>
    <div id="email-msg"></div>
    <div id="email-step">
      <input type="email" class="email-input" id="email-input" placeholder="you@company.com" autocomplete="email">
      <button class="btn btn-primary" id="send-code-btn" onclick="sendCode()">Send Verification Code</button>
    </div>
    <div id="code-step" class="hidden">
      <p style="font-size:13px;color:#374151;margin-bottom:12px;">Enter the 6-digit code we sent to <strong id="code-email-display"></strong></p>
      <div style="display:flex;gap:12px;align-items:center;">
        <input type="text" class="code-input" id="code-input" maxlength="6" placeholder="000000" autocomplete="one-time-code">
        <button class="btn btn-primary" id="verify-btn" onclick="verifyCode()">Verify</button>
      </div>
      <button class="btn-link" style="background:none;border:none;color:#6b7280;font-size:12px;cursor:pointer;margin-top:8px;font-family:inherit;" onclick="resetEmail()">Use a different email</button>
    </div>
  </div>

  <!-- Phase 2: Questionnaire -->
  <div id="phase-questionnaire" class="hidden">
    <div class="progress-wrap">
      <div class="progress-bar-bg"><div class="progress-bar" id="progress-bar" style="width:0%"></div></div>
      <div class="progress-label">
        <span id="progress-section">Section 1 of 6</span>
        <span id="progress-pct">0%</span>
      </div>
    </div>
    <div class="card" id="question-card">
      <!-- Rendered by JS -->
    </div>
    <div class="nav-row">
      <button class="btn btn-secondary" id="prev-btn" onclick="prevSection()">Back</button>
      <button class="btn btn-primary" id="next-btn" onclick="nextSection()">Continue</button>
    </div>
  </div>

  <!-- Phase 3: Results -->
  <div id="phase-results" class="hidden animate-in">
    <!-- Rendered by JS -->
  </div>

  <div class="footer">
    Powered by <a href="https://dev.cranis2.dev/welcome">CRANIS2</a> \u2013 EU Cybersecurity Compliance Platform
    <br><a href="https://dev.cranis2.dev/nis2-conformity-assessment">Also try our NIS2 Readiness Assessment \u2192</a>
  </div>
</div>

<script>
const SECTIONS = ${sectionsJson};
const QUESTIONS = ${questionsJson};
const CATEGORY_LABELS = { default: 'Default', important_i: 'Important Class I', important_ii: 'Important Class II', critical: 'Critical' };

let assessmentId = null;
let sessionEmail = '';
let answers = {};
let currentSection = 0;

/* ── Email Verification ── */

async function sendCode() {
  const email = document.getElementById('email-input').value.trim();
  if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    showMsg('email-msg', 'Please enter a valid email address.', 'error');
    return;
  }
  const btn = document.getElementById('send-code-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Sending\u2026';
  showMsg('email-msg', '', '');

  try {
    const res = await fetch('/cra-conformity-assessment/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) {
      showMsg('email-msg', data.error || 'Failed to send code.', 'error');
      btn.disabled = false;
      btn.textContent = 'Send Verification Code';
      return;
    }
    sessionEmail = email;

    // If email was already verified, skip the code step entirely
    if (data.alreadyVerified) {
      btn.innerHTML = '<span class="spinner"></span>Verifying\u2026';
      const vRes = await fetch('/cra-conformity-assessment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sessionEmail, skipCode: true }),
      });
      const vData = await vRes.json();
      if (vRes.ok && vData.ok) {
        assessmentId = vData.assessmentId;
        answers = vData.answers || {};
        currentSection = vData.currentSection || 0;
        if (currentSection >= SECTIONS.length) { currentSection = 0; answers = {}; }
        startQuestionnaire();
        btn.disabled = false;
        btn.textContent = 'Send Verification Code';
        return;
      }
    }

    document.getElementById('code-email-display').textContent = email;
    document.getElementById('email-step').classList.add('hidden');
    document.getElementById('code-step').classList.remove('hidden');
    showMsg('email-msg', 'Verification code sent. Check your inbox.', 'success');
    document.getElementById('code-input').focus();
  } catch (err) {
    showMsg('email-msg', 'Network error. Please try again.', 'error');
  }
  btn.disabled = false;
  btn.textContent = 'Send Verification Code';
}

async function verifyCode() {
  const code = document.getElementById('code-input').value.trim();
  if (!code || code.length !== 6) {
    showMsg('email-msg', 'Please enter the 6-digit code.', 'error');
    return;
  }
  const btn = document.getElementById('verify-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Verifying\u2026';

  try {
    const res = await fetch('/cra-conformity-assessment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: sessionEmail, code }),
    });
    const data = await res.json();
    if (!res.ok) {
      showMsg('email-msg', data.error || 'Invalid code.', 'error');
      btn.disabled = false;
      btn.textContent = 'Verify';
      return;
    }
    assessmentId = data.assessmentId;
    answers = data.answers || {};
    currentSection = data.currentSection || 0;
    if (currentSection >= SECTIONS.length) {
      currentSection = 0;
      answers = {};
    }
    startQuestionnaire();
  } catch (err) {
    showMsg('email-msg', 'Network error. Please try again.', 'error');
    btn.disabled = false;
    btn.textContent = 'Verify';
  }
}

function resetEmail() {
  document.getElementById('email-step').classList.remove('hidden');
  document.getElementById('code-step').classList.add('hidden');
  document.getElementById('code-input').value = '';
  showMsg('email-msg', '', '');
  document.getElementById('email-input').focus();
}

/* ── Questionnaire ── */

function startQuestionnaire() {
  document.getElementById('phase-email').classList.add('hidden');
  document.getElementById('phase-questionnaire').classList.remove('hidden');
  renderSection();
}

function renderSection() {
  const section = SECTIONS[currentSection];
  const sectionQs = QUESTIONS.filter(q => q.section === currentSection);

  let html = '<div class="section-header">';
  html += '<div class="section-num">Section ' + (currentSection + 1) + ' of ' + SECTIONS.length + '</div>';
  html += '<div class="section-title">' + section.title + '</div>';
  html += '<div class="section-desc">' + section.description + '</div>';
  html += '</div>';

  sectionQs.forEach((q, qi) => {
    html += '<div class="question-block">';
    html += '<div class="question-text">' + q.question + '</div>';

    const explainId = 'explain-' + q.id;
    html += '<span class="explain-toggle" onclick="toggleExplain(\\'' + explainId + '\\')">Why does this matter? \u25BC</span>';
    html += '<div id="' + explainId + '" class="hidden">';
    html += '<div class="question-explain">' + q.explanation + '</div>';
    html += '<span class="question-ref">' + q.cra_reference + '</span>';
    html += '</div>';

    q.options.forEach((opt, oi) => {
      const checked = answers[q.id] === oi ? 'checked' : '';
      const selected = answers[q.id] === oi ? 'selected' : '';
      html += '<div class="option ' + selected + '" onclick="selectOption(\\'' + q.id + '\\', ' + oi + ', this)">';
      html += '<input type="radio" name="q_' + q.id + '" value="' + oi + '" ' + checked + ' id="q_' + q.id + '_' + oi + '">';
      html += '<label for="q_' + q.id + '_' + oi + '">' + opt.label + '</label>';
      html += '</div>';
    });

    html += '</div>';
  });

  document.getElementById('question-card').innerHTML = html;

  // Update progress
  const pct = Math.round(((currentSection) / SECTIONS.length) * 100);
  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('progress-section').textContent = 'Section ' + (currentSection + 1) + ' of ' + SECTIONS.length;
  document.getElementById('progress-pct').textContent = pct + '%';

  // Navigation buttons
  document.getElementById('prev-btn').style.visibility = currentSection > 0 ? 'visible' : 'hidden';
  const nextBtn = document.getElementById('next-btn');
  if (currentSection === SECTIONS.length - 1) {
    nextBtn.textContent = 'Complete Assessment';
  } else {
    nextBtn.textContent = 'Continue';
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleExplain(id) {
  const el = document.getElementById(id);
  el.classList.toggle('hidden');
}

function selectOption(qId, optionIndex, el) {
  answers[qId] = optionIndex;
  // Update visual state
  const parent = el.parentElement;
  parent.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  el.querySelector('input').checked = true;
  // Auto-save
  saveProgress();
}

async function saveProgress() {
  if (!assessmentId) return;
  try {
    await fetch('/cra-conformity-assessment/save-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentId, answers, currentSection }),
    });
  } catch (err) {
    console.error('Save failed:', err);
  }
}

function prevSection() {
  if (currentSection > 0) {
    currentSection--;
    saveProgress();
    renderSection();
  }
}

async function nextSection() {
  if (currentSection < SECTIONS.length - 1) {
    currentSection++;
    saveProgress();
    renderSection();
  } else {
    await completeAssessment();
  }
}

async function completeAssessment() {
  const btn = document.getElementById('next-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Calculating\u2026';

  try {
    const res = await fetch('/cra-conformity-assessment/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentId, answers }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to complete assessment.');
      btn.disabled = false;
      btn.textContent = 'Complete Assessment';
      return;
    }
    showResults(data.scores, data.category);
  } catch (err) {
    alert('Network error. Please try again.');
    btn.disabled = false;
    btn.textContent = 'Complete Assessment';
  }
}

/* ── Results ── */

function showResults(scores, category) {
  document.getElementById('phase-questionnaire').classList.add('hidden');
  const resultsDiv = document.getElementById('phase-results');
  resultsDiv.classList.remove('hidden');

  const catLabel = CATEGORY_LABELS[category] || 'Default';
  const conformity = getConformityModule(category);
  const recommendations = getTopRecommendations(scores, answers);
  const overallColor = scores.overallPct >= 75 ? '#10b981' : scores.overallPct >= 50 ? '#f59e0b' : scores.overallPct >= 25 ? '#f97316' : '#ef4444';

  let html = '';

  // Overall score
  html += '<div class="card" style="text-align:center;">';
  html += '<div class="result-score"><div class="big-num" style="color:' + overallColor + ';">' + scores.overallPct + '%</div>';
  html += '<div class="big-label">Overall CRA Readiness</div></div>';
  html += '<div style="display:inline-block;background:#f3f4f6;border-radius:8px;padding:10px 20px;margin-bottom:12px;">';
  html += '<div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Product Category</div>';
  html += '<div style="font-size:16px;font-weight:700;">' + catLabel + '</div></div>';
  html += '</div>';

  // Conformity assessment
  const confClass = conformity.needsNB ? 'warning' : 'ok';
  html += '<div class="card">';
  html += '<h2 style="font-size:16px;margin-bottom:12px;">Your Conformity Assessment Path</h2>';
  html += '<div class="conformity-box ' + confClass + '">';
  html += '<div class="conformity-title">' + conformity.fullName + '</div>';
  html += '<div class="conformity-desc">' + conformity.description + '</div>';
  html += '<span class="conformity-tag ' + confClass + '">' + (conformity.needsNB ? 'Notified Body Required' : 'Self-Assessment Permitted') + '</span>';
  html += '</div></div>';

  // Maturity breakdown
  html += '<div class="card">';
  html += '<h2 style="font-size:16px;margin-bottom:16px;">Maturity Breakdown</h2>';
  SECTIONS.forEach(function(s) {
    var sc = scores.sections[s.id];
    var barColor = sc.pct >= 75 ? '#10b981' : sc.pct >= 50 ? '#f59e0b' : sc.pct >= 25 ? '#f97316' : '#ef4444';
    html += '<div class="maturity-row">';
    html += '<div class="maturity-label">' + s.title + '</div>';
    html += '<div class="maturity-bar-bg"><div class="maturity-bar" style="width:' + sc.pct + '%;background:' + barColor + ';"></div></div>';
    html += '<div class="maturity-pct">' + sc.pct + '%</div>';
    html += '<div class="maturity-level">' + sc.level + '</div>';
    html += '</div>';
  });
  html += '</div>';

  // Recommendations
  if (recommendations.length > 0) {
    html += '<div class="card">';
    html += '<h2 style="font-size:16px;margin-bottom:8px;">Priority Recommendations</h2>';
    html += '<p style="font-size:13px;color:#6b7280;margin-bottom:16px;">Focus on these areas for the biggest improvement in your CRA readiness:</p>';
    recommendations.forEach(function(r) {
      html += '<div class="rec-item">';
      html += '<div class="rec-priority ' + r.priority + '">' + r.priority.toUpperCase() + ' PRIORITY</div>';
      html += '<div class="rec-question">' + r.question + '</div>';
      html += '<div class="rec-next">Next step: ' + r.target + '</div>';
      html += '<div class="rec-ref">' + r.cra_reference + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  // Send report
  html += '<div class="card" style="text-align:center;">';
  html += '<h2 style="font-size:18px;margin-bottom:4px;">Get Your Full Report</h2>';
  html += '<p style="font-size:13px;color:#6b7280;margin-bottom:16px;">We\u2019ll email you a detailed report with your complete assessment, maturity scores, conformity assessment path, and prioritised recommendations. Share it with your team.</p>';
  html += '<div id="report-msg"></div>';
  html += '<div class="report-form" id="report-form">';
  html += '<input type="email" class="email-input" id="report-email" value="' + escapeHtmlJS(sessionEmail) + '" placeholder="you@company.com">';
  html += '<button class="btn btn-primary" id="send-report-btn" onclick="sendReport()">Send Report</button>';
  html += '</div>';
  html += '</div>';

  // Coming soon: launch list
  html += '<div class="card" style="text-align:center;">';
  html += '<h2 style="font-size:18px;margin-bottom:4px;">CRANIS2 Is Coming Soon</h2>';
  html += '<p style="font-size:13px;color:#6b7280;margin-bottom:16px;">We\u2019re building a platform that helps you manage every aspect of CRA compliance, from SBOM management and vulnerability scanning to technical documentation and conformity assessment tracking.</p>';
  html += '<p style="font-size:13px;color:#6b7280;margin-bottom:16px;">Join our launch list and we\u2019ll let you know when it\u2019s ready.</p>';
  html += '<div id="subscribe-msg"></div>';
  html += '<div class="report-form" id="subscribe-form">';
  html += '<input type="email" class="email-input" id="subscribe-email" value="' + escapeHtmlJS(sessionEmail) + '" placeholder="you@company.com">';
  html += '<button class="btn btn-primary" id="subscribe-btn" onclick="subscribeLaunch()">Notify Me at Launch</button>';
  html += '</div>';
  html += '<div class="report-form hidden" id="subscribe-verify-form" style="margin-top:12px;">';
  html += '<p style="font-size:13px;color:#6b7280;margin-bottom:8px;">We\\u2019ve sent a 6-digit code to your email. Enter it below:</p>';
  html += '<input type="text" class="email-input" id="subscribe-code" placeholder="123456" maxlength="6" pattern="[0-9]{6}" inputmode="numeric" style="font-size:1.2rem;letter-spacing:0.3em;text-align:center;max-width:180px;">';
  html += '<button class="btn btn-primary" id="subscribe-verify-btn" onclick="verifySubscribe()">Verify</button>';
  html += '</div>';
  html += '<p style="font-size:11px;color:#9ca3af;margin-top:12px;line-height:1.5;">We will only use your email to notify you when CRANIS2 launches.<br>No spam, no sharing your information. Ever.</p>';
  html += '</div>';

  // Start over
  html += '<div style="text-align:center;margin-top:12px;">';
  html += '<button class="btn btn-secondary btn-sm" onclick="startOver()">Start a New Assessment</button>';
  html += '</div>';

  resultsDiv.innerHTML = html;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getConformityModule(category) {
  switch (category) {
    case 'critical':
      return { module: 'Module H', fullName: 'Module H \u2013 Full Quality Assurance', needsNB: true,
        description: 'Your product requires the most rigorous assessment procedure. A notified body must approve your quality assurance system covering design, production, and post-market surveillance, with periodic inspections.' };
    case 'important_ii':
      return { module: 'Module B+C or H', fullName: 'Module B+C (EU-Type Examination) or Module H (Full QA)', needsNB: true,
        description: 'Your product requires third-party assessment regardless of whether harmonised standards are applied. You may choose between EU-type examination (Module B+C) or full quality assurance (Module H).' };
    case 'important_i':
      return { module: 'Module A or B+C', fullName: 'Module A (Self-Assessment) or Module B+C', needsNB: false,
        description: 'If you have fully applied relevant harmonised standards (EN 18031), you can self-assess under Module A. Otherwise, you\\u2019ll need EU-type examination (Module B+C) from a notified body.' };
    default:
      return { module: 'Module A', fullName: 'Module A \u2013 Internal Control', needsNB: false,
        description: 'Your product qualifies for self-assessment. You perform the conformity assessment internally, prepare your technical documentation and EU Declaration of Conformity, and affix the CE marking yourself. No notified body involvement required.' };
  }
}

function getTopRecommendations(scores, answers) {
  var recs = [];
  SECTIONS.forEach(function(section, idx) {
    if (section.id === 'classification') return;
    var sc = scores.sections[section.id];
    if (sc.pct >= 75) return;
    var sectionQs = QUESTIONS.filter(function(q) { return q.section === idx; });
    var weak = sectionQs.filter(function(q) {
      var a = answers[q.id];
      return a === undefined || a === null || q.options[a].score < 2;
    }).slice(0, 2);
    weak.forEach(function(q) {
      var a = answers[q.id];
      var currentScore = (a !== undefined && a !== null) ? q.options[a].score : 0;
      var nextLevel = q.options[Math.min(currentScore + 1, 3)];
      recs.push({
        section: section.title,
        question: q.question,
        target: nextLevel.label,
        cra_reference: q.cra_reference,
        priority: currentScore === 0 ? 'high' : 'medium',
      });
    });
  });
  recs.sort(function(a, b) {
    if (a.priority === 'high' && b.priority !== 'high') return -1;
    if (a.priority !== 'high' && b.priority === 'high') return 1;
    return 0;
  });
  return recs.slice(0, 6);
}

async function sendReport() {
  var email = document.getElementById('report-email').value.trim();
  if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    showMsg('report-msg', 'Please enter a valid email address.', 'error');
    return;
  }
  var btn = document.getElementById('send-report-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Sending\u2026';
  showMsg('report-msg', '', '');

  try {
    var res = await fetch('/cra-conformity-assessment/send-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentId: assessmentId, email: email }),
    });
    var data = await res.json();
    if (!res.ok) {
      showMsg('report-msg', data.error || 'Failed to send report.', 'error');
      btn.disabled = false;
      btn.textContent = 'Send Report';
      return;
    }
    showMsg('report-msg', 'Report sent! Check your inbox.', 'success');
    document.getElementById('report-form').classList.add('hidden');
  } catch (err) {
    showMsg('report-msg', 'Network error. Please try again.', 'error');
    btn.disabled = false;
    btn.textContent = 'Send Report';
  }
}

var subscribeEmail = '';

async function subscribeLaunch() {
  var email = document.getElementById('subscribe-email').value.trim();
  if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    showMsg('subscribe-msg', 'Please enter a valid email address.', 'error');
    return;
  }
  subscribeEmail = email;
  var btn = document.getElementById('subscribe-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Sending code\u2026';
  showMsg('subscribe-msg', '', '');

  try {
    var res = await fetch('/conformity-assessment/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email }),
    });
    var data = await res.json();
    if (!res.ok) {
      showMsg('subscribe-msg', data.error || 'Failed to subscribe.', 'error');
      btn.disabled = false;
      btn.textContent = 'Notify Me at Launch';
      return;
    }
    if (data.alreadyVerified) {
      btn.innerHTML = '<span class="spinner"></span>Subscribing\u2026';
      var vRes = await fetch('/conformity-assessment/subscribe/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: subscribeEmail, skipCode: true }),
      });
      var vData = await vRes.json();
      if (vRes.ok && vData.ok) {
        showMsg('subscribe-msg', 'You\\u2019re on the list! We\\u2019ll be in touch when CRANIS2 launches.', 'success');
        document.getElementById('subscribe-form').classList.add('hidden');
        btn.disabled = false;
        btn.textContent = 'Notify Me at Launch';
        return;
      }
    }
    document.getElementById('subscribe-form').classList.add('hidden');
    document.getElementById('subscribe-verify-form').classList.remove('hidden');
    document.getElementById('subscribe-code').focus();
  } catch (err) {
    showMsg('subscribe-msg', 'Network error. Please try again.', 'error');
    btn.disabled = false;
    btn.textContent = 'Notify Me at Launch';
  }
}

async function verifySubscribe() {
  var code = document.getElementById('subscribe-code').value.trim();
  if (!code || code.length !== 6) {
    showMsg('subscribe-msg', 'Please enter the 6-digit code from your email.', 'error');
    return;
  }
  var btn = document.getElementById('subscribe-verify-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Verifying\u2026';
  showMsg('subscribe-msg', '', '');

  try {
    var res = await fetch('/conformity-assessment/subscribe/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: subscribeEmail, code: code }),
    });
    var data = await res.json();
    if (!res.ok) {
      showMsg('subscribe-msg', data.error || 'Invalid code. Please try again.', 'error');
      btn.disabled = false;
      btn.textContent = 'Verify';
      return;
    }
    showMsg('subscribe-msg', 'You\\u2019re on the list! We\\u2019ll be in touch when CRANIS2 launches.', 'success');
    document.getElementById('subscribe-verify-form').classList.add('hidden');
  } catch (err) {
    showMsg('subscribe-msg', 'Network error. Please try again.', 'error');
    btn.disabled = false;
    btn.textContent = 'Verify';
  }
}

function startOver() {
  assessmentId = null;
  answers = {};
  currentSection = 0;
  document.getElementById('phase-results').classList.add('hidden');
  document.getElementById('phase-results').innerHTML = '';
  document.getElementById('phase-email').classList.remove('hidden');
  document.getElementById('email-step').classList.remove('hidden');
  document.getElementById('code-step').classList.add('hidden');
  document.getElementById('email-input').value = sessionEmail;
  document.getElementById('code-input').value = '';
  showMsg('email-msg', '', '');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Helpers ── */

function showMsg(containerId, text, type) {
  var el = document.getElementById(containerId);
  if (!text) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="msg msg-' + type + '">' + text + '</div>';
}

function escapeHtmlJS(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
</script>
</body>
</html>`;
}

module.exports = { conformityAssessmentPage };

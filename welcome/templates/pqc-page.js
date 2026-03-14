const { SECTIONS, QUESTIONS, READINESS_LABELS } = require('../data/pqc-questions');

function assessmentPage() {
  const sectionsJson = JSON.stringify(SECTIONS);
  const questionsJson = JSON.stringify(QUESTIONS);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Post-Quantum Cryptography Readiness Assessment \u2013 CRANIS2</title>
<meta name="description" content="Free PQC readiness assessment. Determine how prepared your organisation is for the post-quantum cryptography transition. Covers key types, rotation, crypto agility, data sensitivity, and migration planning.">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #111827; min-height: 100vh; }
  .page { max-width: 680px; margin: 0 auto; padding: 40px 20px 80px; }
  .brand { font-size: 13px; font-weight: 700; color: #a855f7; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
  h1 { font-size: 26px; font-weight: 700; color: #111827; margin-bottom: 8px; line-height: 1.3; }
  .subtitle { font-size: 14px; color: #6b7280; margin-bottom: 28px; line-height: 1.6; }
  .progress-wrap { margin-bottom: 28px; }
  .progress-bar-bg { background: #e5e7eb; border-radius: 4px; height: 6px; }
  .progress-bar { background: #a855f7; border-radius: 4px; height: 6px; transition: width 0.3s; }
  .progress-label { display: flex; justify-content: space-between; font-size: 12px; color: #9ca3af; margin-top: 6px; }
  .card { background: white; border-radius: 12px; border: 1px solid #e5e7eb; padding: 28px; margin-bottom: 20px; }
  .email-input { width: 100%; padding: 12px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; font-family: inherit; outline: none; margin-bottom: 12px; }
  .email-input:focus { border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168,85,247,0.1); }
  .code-input { width: 180px; padding: 12px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 18px; font-family: inherit; outline: none; text-align: center; letter-spacing: 4px; }
  .code-input:focus { border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168,85,247,0.1); }
  .btn { padding: 12px 24px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s; }
  .btn-primary { background: #a855f7; color: white; }
  .btn-primary:hover { background: #9333ea; }
  .btn-primary:disabled { background: #d8b4fe; cursor: not-allowed; }
  .btn-secondary { background: white; color: #374151; border: 1px solid #d1d5db; }
  .btn-secondary:hover { background: #f9fafb; }
  .btn-sm { padding: 8px 16px; font-size: 13px; }
  .section-header { margin-bottom: 20px; }
  .section-num { font-size: 12px; font-weight: 600; color: #a855f7; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
  .section-title { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 8px; }
  .section-desc { font-size: 13px; color: #6b7280; line-height: 1.6; }
  .question-block { margin-bottom: 28px; padding-bottom: 28px; border-bottom: 1px solid #f3f4f6; }
  .question-block:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
  .question-text { font-size: 15px; font-weight: 600; color: #111827; margin-bottom: 8px; line-height: 1.4; }
  .question-explain { font-size: 12px; color: #6b7280; line-height: 1.6; margin-bottom: 4px; background: #f9fafb; border-radius: 8px; padding: 12px; }
  .question-ref { font-size: 11px; color: #a855f7; font-weight: 600; margin-bottom: 12px; display: inline-block; }
  .explain-toggle { font-size: 12px; color: #6b7280; cursor: pointer; margin-bottom: 12px; display: inline-block; }
  .explain-toggle:hover { color: #374151; }
  .option { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 8px; cursor: pointer; transition: background 0.1s; margin-bottom: 4px; }
  .option:hover { background: #f9fafb; }
  .option.selected { background: #f5f3ff; }
  .option input[type="radio"] { margin-top: 2px; accent-color: #a855f7; width: 16px; height: 16px; flex-shrink: 0; }
  .option label { font-size: 13px; color: #374151; line-height: 1.5; cursor: pointer; }
  .nav-row { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
  .result-score { text-align: center; margin-bottom: 20px; }
  .result-score .big-num { font-size: 56px; font-weight: 700; line-height: 1; }
  .result-score .big-label { font-size: 14px; color: #6b7280; margin-top: 4px; }
  .maturity-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
  .maturity-label { font-size: 13px; color: #374151; width: 180px; flex-shrink: 0; }
  .maturity-bar-bg { flex: 1; background: #f3f4f6; border-radius: 4px; height: 16px; }
  .maturity-bar { border-radius: 4px; height: 16px; transition: width 0.5s; }
  .maturity-pct { font-size: 13px; font-weight: 600; width: 40px; text-align: right; }
  .maturity-level { font-size: 11px; color: #6b7280; width: 90px; }
  .conformity-box { padding: 16px; border-radius: 8px; margin-bottom: 16px; }
  .conformity-box.ok { background: #ecfdf5; border: 1px solid #a7f3d0; }
  .conformity-box.warning { background: #fffbeb; border: 1px solid #fde68a; }
  .conformity-box.danger { background: #fef2f2; border: 1px solid #fecaca; }
  .conformity-box.info { background: #eff6ff; border: 1px solid #bfdbfe; }
  .conformity-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
  .conformity-desc { font-size: 13px; line-height: 1.6; }
  .conformity-tag { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; margin-top: 8px; }
  .conformity-tag.ok { background: #d1fae5; color: #065f46; }
  .conformity-tag.warning { background: #fef3c7; color: #92400e; }
  .conformity-tag.danger { background: #fee2e2; color: #991b1b; }
  .conformity-tag.info { background: #dbeafe; color: #1e40af; }
  .rec-item { padding: 12px; border-radius: 8px; background: #f9fafb; margin-bottom: 8px; }
  .rec-priority { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .rec-priority.high { color: #ef4444; }
  .rec-priority.medium { color: #f59e0b; }
  .rec-question { font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 2px; }
  .rec-next { font-size: 12px; color: #6b7280; }
  .rec-ref { font-size: 11px; color: #a855f7; }
  .report-form { display: flex; gap: 8px; align-items: flex-start; }
  .report-form .email-input { margin-bottom: 0; flex: 1; }
  .msg { padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 12px; }
  .msg-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
  .msg-success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
  .msg-info { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
  .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #9ca3af; }
  .footer a { color: #a855f7; text-decoration: none; }
  .hidden { display: none; }
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
  <h1>Post-Quantum Cryptography Readiness Assessment</h1>
  <p class="subtitle">
    Quantum computers will break the asymmetric cryptography that secures TLS, code signing, and key exchange.
    NIST has published post-quantum standards (FIPS 203/204/205). This free assessment evaluates your readiness
    across 18 questions in 6 key areas, from key types and rotation to crypto agility and migration planning.<br>
    <strong>Takes about 8 minutes.</strong> You can save your progress and return later.
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
    <div class="card" id="question-card"></div>
    <div class="nav-row">
      <button class="btn btn-secondary" id="prev-btn" onclick="prevSection()">Back</button>
      <button class="btn btn-primary" id="next-btn" onclick="nextSection()">Continue</button>
    </div>
  </div>

  <!-- Phase 3: Results -->
  <div id="phase-results" class="hidden animate-in"></div>

  <div class="footer">
    Powered by <a href="https://dev.cranis2.dev/welcome">CRANIS2</a> \u2013 EU Cybersecurity Compliance Platform
    <br><a href="https://dev.cranis2.dev/cra-conformity-assessment">Also try our CRA Readiness Assessment \u2192</a>
  </div>
</div>

<script>
const SECTIONS = ${sectionsJson};
const QUESTIONS = ${questionsJson};
const READINESS_LABELS = ${JSON.stringify(READINESS_LABELS)};

let assessmentId = null;
let sessionEmail = '';
let answers = {};
let currentSection = 0;

/* \u2500\u2500 Email Verification \u2500\u2500 */

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
    const res = await fetch('/pqc-readiness-assessment/send-code', {
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
    const res = await fetch('/pqc-readiness-assessment/verify', {
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

/* \u2500\u2500 Questionnaire \u2500\u2500 */

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
    html += '<span class="question-ref">' + q.pqc_reference + '</span>';
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

  const pct = Math.round(((currentSection) / SECTIONS.length) * 100);
  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('progress-section').textContent = 'Section ' + (currentSection + 1) + ' of ' + SECTIONS.length;
  document.getElementById('progress-pct').textContent = pct + '%';

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
  document.getElementById(id).classList.toggle('hidden');
}

function selectOption(qId, optionIndex, el) {
  answers[qId] = optionIndex;
  const parent = el.parentElement;
  parent.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  el.querySelector('input').checked = true;
  saveProgress();
}

async function saveProgress() {
  if (!assessmentId) return;
  try {
    await fetch('/pqc-readiness-assessment/save-progress', {
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
    const res = await fetch('/pqc-readiness-assessment/complete', {
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
    showResults(data.scores, data.readinessLevel);
  } catch (err) {
    alert('Network error. Please try again.');
    btn.disabled = false;
    btn.textContent = 'Complete Assessment';
  }
}

/* \u2500\u2500 Results \u2500\u2500 */

function showResults(scores, readinessLevel) {
  document.getElementById('phase-questionnaire').classList.add('hidden');
  const resultsDiv = document.getElementById('phase-results');
  resultsDiv.classList.remove('hidden');

  const readinessLabel = READINESS_LABELS[readinessLevel] || 'Not Determined';
  const details = getReadinessDetails(readinessLevel);
  const recommendations = getTopRecommendations(scores, answers);
  const overallColor = details.colour;

  let html = '';

  // Overall score
  html += '<div class="card" style="text-align:center;">';
  html += '<div class="result-score"><div class="big-num" style="color:' + overallColor + ';">' + scores.overallPct + '%</div>';
  html += '<div class="big-label">Post-Quantum Cryptography Readiness</div></div>';
  html += '<div style="display:inline-block;background:#f3f4f6;border-radius:8px;padding:10px 20px;margin-bottom:12px;">';
  html += '<div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Readiness Level</div>';
  html += '<div style="font-size:16px;font-weight:700;color:' + overallColor + ';">' + details.headline + '</div></div>';
  html += '</div>';

  // Readiness details
  var confClass = readinessLevel === 'quantum_ready' ? 'ok' : readinessLevel === 'partially_ready' ? 'warning' : 'danger';
  html += '<div class="card">';
  html += '<h2 style="font-size:16px;margin-bottom:12px;">Your Quantum Readiness</h2>';
  html += '<div class="conformity-box ' + confClass + '">';
  html += '<div class="conformity-title">' + readinessLabel + '</div>';
  html += '<div class="conformity-desc">' + details.description + '</div>';
  html += '<span class="conformity-tag ' + confClass + '">' + details.urgency + '</span>';
  html += '</div>';
  html += '</div>';

  // Maturity breakdown
  html += '<div class="card">';
  html += '<h2 style="font-size:16px;margin-bottom:16px;">Area Breakdown</h2>';
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
    html += '<p style="font-size:13px;color:#6b7280;margin-bottom:16px;">Focus on these areas for the biggest improvement in your quantum readiness:</p>';
    recommendations.forEach(function(r) {
      html += '<div class="rec-item">';
      html += '<div class="rec-priority ' + r.priority + '">' + r.priority.toUpperCase() + ' PRIORITY</div>';
      html += '<div class="rec-question">' + r.question + '</div>';
      html += '<div class="rec-next">Next step: ' + r.target + '</div>';
      html += '<div class="rec-ref">' + r.pqc_reference + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  // NIST PQC timeline
  html += '<div class="card">';
  html += '<h2 style="font-size:16px;margin-bottom:12px;">Key PQC Milestones</h2>';
  html += '<div style="font-size:13px;color:#374151;line-height:1.8;">';
  html += '<div style="display:flex;gap:12px;margin-bottom:6px;"><span style="font-weight:600;color:#a855f7;min-width:50px;">2024</span><span>NIST finalises FIPS 203 (ML-KEM), FIPS 204 (ML-DSA), FIPS 205 (SLH-DSA)</span></div>';
  html += '<div style="display:flex;gap:12px;margin-bottom:6px;"><span style="font-weight:600;color:#a855f7;min-width:50px;">2025</span><span>CNSA 2.0 recommends hybrid PQC for new systems; browsers ship ML-KEM key exchange</span></div>';
  html += '<div style="display:flex;gap:12px;margin-bottom:6px;"><span style="font-weight:600;color:#a855f7;min-width:50px;">2027</span><span>EU CRA enforcement begins \u2014 state-of-the-art cryptography required (Annex I \u00a73)</span></div>';
  html += '<div style="display:flex;gap:12px;margin-bottom:6px;"><span style="font-weight:600;color:#a855f7;min-width:50px;">2030</span><span>CNSA 2.0 mandates PQC for all US national security systems</span></div>';
  html += '<div style="display:flex;gap:12px;"><span style="font-weight:600;color:#a855f7;min-width:50px;">2035</span><span>CNSA 2.0 prohibits classical-only cryptography in national security systems</span></div>';
  html += '</div>';
  html += '</div>';

  // Send report
  html += '<div class="card" style="text-align:center;">';
  html += '<h2 style="font-size:18px;margin-bottom:4px;">Get Your Full Report</h2>';
  html += '<p style="font-size:13px;color:#6b7280;margin-bottom:16px;">We\\u2019ll email you a detailed report with your complete assessment, readiness scores, and prioritised recommendations. Share it with your security team.</p>';
  html += '<div id="report-msg"></div>';
  html += '<div class="report-form" id="report-form">';
  html += '<input type="email" class="email-input" id="report-email" value="' + escapeHtmlJS(sessionEmail) + '" placeholder="you@company.com">';
  html += '<button class="btn btn-primary" id="send-report-btn" onclick="sendReport()">Send Report</button>';
  html += '</div>';
  html += '</div>';

  // CTA: CRANIS2
  html += '<div class="card" style="text-align:center;">';
  html += '<h2 style="font-size:18px;margin-bottom:4px;">Track Your Crypto Posture with CRANIS2</h2>';
  html += '<p style="font-size:13px;color:#6b7280;margin-bottom:16px;">CRANIS2 automatically scans your product dependencies against a curated registry of 45+ cryptographic libraries across 8 ecosystems. It classifies every algorithm as broken, quantum-vulnerable, or quantum-safe, and provides remediation guidance aligned with NIST PQC standards.</p>';
  html += '<p style="font-size:13px;color:#6b7280;margin-bottom:16px;">Join our launch list and we\\u2019ll let you know when it\\u2019s ready.</p>';
  html += '<div id="subscribe-msg"></div>';
  html += '<div class="report-form" id="subscribe-form">';
  html += '<input type="email" class="email-input" id="subscribe-email" value="' + escapeHtmlJS(sessionEmail) + '" placeholder="you@company.com">';
  html += '<button class="btn btn-primary" id="subscribe-btn" onclick="subscribeLaunch()">Notify Me at Launch</button>';
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

function getReadinessDetails(level) {
  switch (level) {
    case 'quantum_ready':
      return { headline: 'Well Prepared', colour: '#10b981',
        description: 'Your organisation demonstrates strong quantum readiness across most areas. You are using or actively migrating to quantum-safe algorithms, have good key management practices, and are tracking relevant standards.',
        urgency: 'Maintain your current trajectory and review annually' };
    case 'partially_ready':
      return { headline: 'Good Progress, Gaps Remain', colour: '#f59e0b',
        description: 'You have made meaningful progress on quantum readiness but significant gaps remain. Some areas are well positioned while others need attention.',
        urgency: 'Address gaps within 12\u201318 months' };
    case 'at_risk':
      return { headline: 'Significant Gaps', colour: '#f97316',
        description: 'Your organisation has significant exposure to quantum threats. Multiple areas rely on quantum-vulnerable algorithms without clear migration paths. The harvest-now, decrypt-later threat means sensitive data encrypted today may be compromised in the future.',
        urgency: 'Begin crypto inventory and PQC planning within 6 months' };
    default:
      return { headline: 'Immediate Action Required', colour: '#ef4444',
        description: 'Your organisation has critical exposure to both classical and quantum cryptographic threats. Multiple systems are using broken or quantum-vulnerable algorithms without inventory, rotation, or migration plans.',
        urgency: 'Start immediately: inventory, eliminate broken algorithms, begin PQC planning' };
  }
}

function getTopRecommendations(scores, answers) {
  var recs = [];
  SECTIONS.forEach(function(section, idx) {
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
        pqc_reference: q.pqc_reference,
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
    var res = await fetch('/pqc-readiness-assessment/send-report', {
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

async function subscribeLaunch() {
  var email = document.getElementById('subscribe-email').value.trim();
  if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    showMsg('subscribe-msg', 'Please enter a valid email address.', 'error');
    return;
  }
  var btn = document.getElementById('subscribe-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Subscribing\u2026';
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
    showMsg('subscribe-msg', 'You\\u2019re on the list! We\\u2019ll be in touch when CRANIS2 launches.', 'success');
    document.getElementById('subscribe-form').classList.add('hidden');
  } catch (err) {
    showMsg('subscribe-msg', 'Network error. Please try again.', 'error');
    btn.disabled = false;
    btn.textContent = 'Notify Me at Launch';
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

module.exports = { assessmentPage };

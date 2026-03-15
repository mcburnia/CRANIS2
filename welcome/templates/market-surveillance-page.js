/**
 * Market Surveillance Registration — Public Page Template
 *
 * Self-contained HTML page with:
 *  1. Interactive "Do I need to register?" decision tree
 *  2. Searchable directory of national market surveillance authorities
 *
 * Calls backend /api/market-surveillance-authorities endpoints.
 */

function marketSurveillancePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Market Surveillance Registration \u2013 CRA Art.\u00a020 \u2013 CRANIS2</title>
<meta name="description" content="Do you need to register with a market surveillance authority under the Cyber Resilience Act? Free decision tree and searchable directory of EU national authorities for manufacturers of critical products with digital elements.">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f8fafc; color: #111827; min-height: 100vh;
  }
  .page { max-width: 880px; margin: 0 auto; padding: 48px 20px 80px; }
  .brand { font-size: 13px; font-weight: 700; color: #a855f7; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
  .brand a { color: inherit; text-decoration: none; }
  h1 { font-size: 28px; font-weight: 700; color: #111827; margin-bottom: 8px; line-height: 1.3; }
  .subtitle { font-size: 15px; color: #6b7280; margin-bottom: 32px; line-height: 1.7; max-width: 700px; }

  /* \u2500\u2500 Decision tree \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  .decision-tree {
    background: white; border-radius: 12px; border: 1px solid #e5e7eb;
    padding: 28px 32px; margin-bottom: 32px;
  }
  .decision-tree h2 { font-size: 18px; font-weight: 700; margin-bottom: 12px; }
  .decision-tree p { font-size: 14px; color: #6b7280; line-height: 1.6; margin-bottom: 16px; }
  .step { margin-bottom: 20px; }
  .step-label {
    font-size: 13px; font-weight: 700; color: #a855f7; text-transform: uppercase;
    letter-spacing: 0.05em; margin-bottom: 8px;
  }
  .step-question { font-size: 15px; font-weight: 600; color: #111827; margin-bottom: 10px; }
  .option-group { display: flex; gap: 10px; flex-wrap: wrap; }
  .opt-btn {
    padding: 8px 18px; border-radius: 6px; border: 1px solid #e5e7eb;
    background: white; cursor: pointer; font-size: 13px; font-weight: 600;
    font-family: inherit; transition: all 0.15s;
  }
  .opt-btn:hover { border-color: #a855f7; }
  .opt-btn.active { background: #a855f7; color: white; border-color: #a855f7; }
  .opt-btn.positive { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
  .opt-btn.negative { background: #fee2e2; color: #991b1b; border-color: #fecaca; }

  .result-box {
    display: none; padding: 20px 24px; border-radius: 8px;
    border: 1px solid #e5e7eb; margin-top: 16px;
  }
  .result-box.show { display: block; }
  .result-box.required { background: #fef3c7; border-color: #fde68a; }
  .result-box.not-required { background: #dcfce7; border-color: #bbf7d0; }
  .result-box h3 { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
  .result-box p { font-size: 13px; color: #4b5563; line-height: 1.6; margin-bottom: 6px; }
  .result-box ul { font-size: 13px; color: #4b5563; line-height: 1.8; padding-left: 20px; margin-top: 8px; }

  /* \u2500\u2500 Search / filters \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  .filters {
    background: white; border-radius: 12px; border: 1px solid #e5e7eb;
    padding: 20px 24px; margin-bottom: 24px;
    display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end;
  }
  .filter-group { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 160px; }
  .filter-group label {
    font-size: 11px; font-weight: 600; color: #6b7280;
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .filter-group select, .filter-group input {
    padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 6px;
    font-size: 14px; font-family: inherit; background: white; color: #111827;
    outline: none; transition: border-color 0.15s;
  }
  .filter-group select:focus, .filter-group input:focus { border-color: #a855f7; }
  .filter-btn {
    padding: 8px 20px; border: none; border-radius: 6px;
    background: #a855f7; color: white; font-size: 14px; font-weight: 600;
    cursor: pointer; font-family: inherit; transition: background 0.15s;
    align-self: flex-end;
  }
  .filter-btn:hover { background: #9333ea; }
  .clear-btn {
    padding: 8px 16px; border: 1px solid #e5e7eb; border-radius: 6px;
    background: white; color: #6b7280; font-size: 14px; font-weight: 500;
    cursor: pointer; font-family: inherit; transition: all 0.15s;
    align-self: flex-end;
  }
  .clear-btn:hover { border-color: #a855f7; color: #a855f7; }

  /* \u2500\u2500 Results \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  .results-count { font-size: 13px; color: #6b7280; margin-bottom: 16px; }
  .auth-card {
    background: white; border-radius: 12px; border: 1px solid #e5e7eb;
    padding: 24px 28px; margin-bottom: 12px;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .auth-card:hover { border-color: #a855f7; box-shadow: 0 2px 8px rgba(168,85,247,0.08); }
  .auth-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
  .auth-name { font-size: 16px; font-weight: 700; color: #111827; margin-bottom: 4px; }
  .auth-country { font-size: 13px; color: #6b7280; }
  .auth-designated {
    display: inline-block; padding: 3px 10px; border-radius: 4px;
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .auth-designated.yes { background: #dcfce7; color: #166534; }
  .auth-designated.no { background: #f3f4f6; color: #6b7280; }
  .auth-areas { margin-bottom: 8px; }
  .area-badge {
    display: inline-block; padding: 2px 8px; border-radius: 3px;
    background: #f3f4f6; font-size: 12px; color: #4b5563;
    margin-right: 4px; margin-bottom: 4px;
  }
  .auth-contact { font-size: 13px; color: #4b5563; line-height: 1.7; }
  .auth-contact a { color: #a855f7; text-decoration: none; }
  .auth-contact a:hover { text-decoration: underline; }
  .auth-notes {
    font-size: 12px; color: #9ca3af; margin-top: 10px; line-height: 1.5;
    border-top: 1px solid #f3f4f6; padding-top: 10px;
  }
  .portal-link {
    display: inline-block; margin-top: 8px; padding: 4px 12px;
    border-radius: 4px; background: #ede9fe; color: #7c3aed;
    font-size: 12px; font-weight: 600; text-decoration: none;
  }
  .portal-link:hover { background: #ddd6fe; }

  .no-results { text-align: center; padding: 48px 20px; color: #9ca3af; }
  .no-results h3 { font-size: 18px; margin-bottom: 8px; color: #6b7280; }
  .no-results p { font-size: 14px; }
  .loading { text-align: center; padding: 48px 20px; color: #9ca3af; }

  /* \u2500\u2500 CTA \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  .cta-box {
    background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
    border: 1px solid #ddd6fe; border-radius: 12px;
    padding: 28px 32px; margin-top: 32px; text-align: center;
  }
  .cta-box h3 { font-size: 18px; font-weight: 700; color: #5b21b6; margin-bottom: 8px; }
  .cta-box p { font-size: 14px; color: #6b7280; margin-bottom: 16px; line-height: 1.6; }
  .cta-btn {
    display: inline-block; padding: 12px 28px; border-radius: 8px;
    background: #a855f7; color: white; font-size: 15px; font-weight: 600;
    text-decoration: none; transition: background 0.15s;
  }
  .cta-btn:hover { background: #9333ea; }

  .back-link { margin-bottom: 24px; }
  .back-link a { font-size: 13px; color: #a855f7; text-decoration: none; }
  .back-link a:hover { text-decoration: underline; }
  .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #9ca3af; }
  .footer a { color: #a855f7; text-decoration: none; }

  /* \u2500\u2500 Info callout \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  .info-callout {
    background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;
    padding: 16px 20px; margin-bottom: 24px; font-size: 13px; color: #1e40af; line-height: 1.6;
  }
  .info-callout strong { font-weight: 700; }
</style>
</head>
<body>
<div class="page">
  <div class="back-link"><a href="/conformity-assessment">\u2190 Back to all assessments</a></div>
  <div class="brand"><a href="/welcome">CRANIS2</a></div>
  <h1>Market Surveillance Registration</h1>
  <p class="subtitle">
    Under CRA Art.\u00a020, manufacturers of <strong>critical</strong> products with digital elements
    must notify the relevant national market surveillance authority before placing
    their product on the EU market. Use the decision tree below to determine whether
    your product requires registration, then find the right authority in the directory.
  </p>

  <!-- Decision tree -->
  <div class="decision-tree">
    <h2>Do I need to register with a market surveillance authority?</h2>
    <p>Answer the following questions to determine whether your product requires market surveillance registration under the CRA.</p>

    <div class="step" id="step-1">
      <div class="step-label">Step 1 of 3</div>
      <div class="step-question">Is your product a \u201Cproduct with digital elements\u201D?</div>
      <p style="font-size:13px; color:#6b7280; margin-bottom:10px;">
        A product with digital elements is any software or hardware product with a data connection
        that is made available on the EU market. This includes firmware, operating systems,
        applications, IoT devices, and connected industrial equipment.
      </p>
      <div class="option-group">
        <button class="opt-btn" onclick="answerStep1(true)">Yes, it is</button>
        <button class="opt-btn" onclick="answerStep1(false)">No / Unsure</button>
      </div>
    </div>

    <div class="step" id="step-2" style="display:none;">
      <div class="step-label">Step 2 of 3</div>
      <div class="step-question">Are you a manufacturer (or open-source steward)?</div>
      <p style="font-size:13px; color:#6b7280; margin-bottom:10px;">
        Market surveillance registration applies to manufacturers and open-source software stewards.
        Importers and distributors have separate obligations under Art.\u00a018 and Art.\u00a019.
      </p>
      <div class="option-group">
        <button class="opt-btn" onclick="answerStep2(true)">Yes, manufacturer or steward</button>
        <button class="opt-btn" onclick="answerStep2(false)">No, importer or distributor</button>
      </div>
    </div>

    <div class="step" id="step-3" style="display:none;">
      <div class="step-label">Step 3 of 3</div>
      <div class="step-question">What is your product\u2019s CRA risk category?</div>
      <p style="font-size:13px; color:#6b7280; margin-bottom:10px;">
        The CRA classifies products into four risk categories. Only <strong>critical</strong> products
        require market surveillance registration. Not sure of your category?
        <a href="/cra-conformity-assessment" style="color:#a855f7;">Take the CRA Readiness Assessment</a>.
      </p>
      <div class="option-group">
        <button class="opt-btn" onclick="answerStep3('default')">Default</button>
        <button class="opt-btn" onclick="answerStep3('important_i')">Important I</button>
        <button class="opt-btn" onclick="answerStep3('important_ii')">Important II</button>
        <button class="opt-btn" onclick="answerStep3('critical')">Critical</button>
      </div>
    </div>

    <div class="result-box" id="decision-result"></div>
  </div>

  <div class="info-callout">
    <strong>What information do you need to register?</strong>
    Your registration package typically includes: manufacturer name and address, product
    identification, CRA category classification, the applicable conformity assessment module,
    notified body certificate reference (if applicable), and the EU Declaration of Conformity.
    CRANIS2 can prepare this package automatically from your compliance data.
  </div>

  <!-- Filters -->
  <div class="filters">
    <div class="filter-group">
      <label>Country</label>
      <select id="f-country">
        <option value="">All countries</option>
      </select>
    </div>
    <div class="filter-group">
      <label>Competence Area</label>
      <select id="f-area">
        <option value="">All areas</option>
        <option value="cybersecurity">Cybersecurity</option>
        <option value="consumer_electronics">Consumer Electronics</option>
        <option value="industrial">Industrial</option>
        <option value="iot">IoT</option>
        <option value="medical">Medical</option>
        <option value="automotive">Automotive</option>
        <option value="energy">Energy</option>
        <option value="financial">Financial</option>
        <option value="telecoms">Telecoms</option>
        <option value="networking">Networking</option>
        <option value="general">General</option>
      </select>
    </div>
    <div class="filter-group">
      <label>Search</label>
      <input type="text" id="f-search" placeholder="Authority name\u2026">
    </div>
    <button class="filter-btn" onclick="applyFilters()">Search</button>
    <button class="clear-btn" onclick="clearFilters()">Clear</button>
  </div>

  <!-- Results -->
  <div class="results-count" id="results-count"></div>
  <div id="results">
    <div class="loading">Loading market surveillance authorities\u2026</div>
  </div>

  <!-- CTA -->
  <div class="cta-box">
    <h3>Need to register a critical product?</h3>
    <p>CRANIS2 tracks your market surveillance registration status, prepares the
       registration package from your compliance data, and sends you renewal reminders
       \u2014 all integrated with your CRA obligations dashboard.</p>
    <a href="https://dev.cranis2.dev" class="cta-btn">Track your registration in CRANIS2</a>
  </div>

  <div class="footer">
    <a href="/notified-body-directory">Notified body directory</a> &middot;
    <a href="/conformity-assessment">Free compliance assessments</a> &middot;
    <a href="/welcome">Learn more about CRANIS2</a>
  </div>
</div>

<script>
/* \u2500\u2500 Country names \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
var COUNTRY_NAMES = {
  AT: 'Austria', BE: 'Belgium', BG: 'Bulgaria', HR: 'Croatia', CY: 'Cyprus',
  CZ: 'Czech Republic', DK: 'Denmark', EE: 'Estonia', FI: 'Finland', FR: 'France',
  DE: 'Germany', GR: 'Greece', HU: 'Hungary', IE: 'Ireland', IT: 'Italy',
  LV: 'Latvia', LT: 'Lithuania', LU: 'Luxembourg', MT: 'Malta', NL: 'Netherlands',
  PL: 'Poland', PT: 'Portugal', RO: 'Romania', SK: 'Slovakia', SI: 'Slovenia',
  ES: 'Spain', SE: 'Sweden', IS: 'Iceland', LI: 'Liechtenstein', NO: 'Norway',
};

var COUNTRY_FLAGS = {
  AT: '\uD83C\uDDE6\uD83C\uDDF9', BE: '\uD83C\uDDE7\uD83C\uDDEA', BG: '\uD83C\uDDE7\uD83C\uDDEC', HR: '\uD83C\uDDED\uD83C\uDDF7',
  CY: '\uD83C\uDDE8\uD83C\uDDFE', CZ: '\uD83C\uDDE8\uD83C\uDDFF', DK: '\uD83C\uDDE9\uD83C\uDDF0', EE: '\uD83C\uDDEA\uD83C\uDDEA',
  FI: '\uD83C\uDDEB\uD83C\uDDEE', FR: '\uD83C\uDDEB\uD83C\uDDF7', DE: '\uD83C\uDDE9\uD83C\uDDEA', GR: '\uD83C\uDDEC\uD83C\uDDF7',
  HU: '\uD83C\uDDED\uD83C\uDDFA', IE: '\uD83C\uDDEE\uD83C\uDDEA', IT: '\uD83C\uDDEE\uD83C\uDDF9', LV: '\uD83C\uDDF1\uD83C\uDDFB',
  LT: '\uD83C\uDDF1\uD83C\uDDF9', LU: '\uD83C\uDDF1\uD83C\uDDFA', MT: '\uD83C\uDDF2\uD83C\uDDF9', NL: '\uD83C\uDDF3\uD83C\uDDF1',
  PL: '\uD83C\uDDF5\uD83C\uDDF1', PT: '\uD83C\uDDF5\uD83C\uDDF9', RO: '\uD83C\uDDF7\uD83C\uDDF4', SK: '\uD83C\uDDF8\uD83C\uDDF0',
  SI: '\uD83C\uDDF8\uD83C\uDDEE', ES: '\uD83C\uDDEA\uD83C\uDDF8', SE: '\uD83C\uDDF8\uD83C\uDDEA', IS: '\uD83C\uDDEE\uD83C\uDDF8',
  LI: '\uD83C\uDDF1\uD83C\uDDEE', NO: '\uD83C\uDDF3\uD83C\uDDF4',
};

var AREA_LABELS = {
  cybersecurity: 'Cybersecurity', consumer_electronics: 'Consumer Electronics',
  industrial: 'Industrial', iot: 'IoT', medical: 'Medical', automotive: 'Automotive',
  energy: 'Energy', financial: 'Financial', telecoms: 'Telecoms',
  networking: 'Networking', general: 'General',
};

/* \u2500\u2500 Decision tree logic \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
function setActive(container, btn) {
  container.querySelectorAll('.opt-btn').forEach(function(b) {
    b.classList.remove('active', 'positive', 'negative');
  });
  btn.classList.add('active');
}

function answerStep1(yes) {
  setActive(document.getElementById('step-1'), event.target);
  var resultEl = document.getElementById('decision-result');
  if (!yes) {
    document.getElementById('step-2').style.display = 'none';
    document.getElementById('step-3').style.display = 'none';
    resultEl.className = 'result-box show not-required';
    resultEl.innerHTML = '<h3>Registration not required</h3>' +
      '<p>Products that do not have digital elements, or that are not placed on the EU market, ' +
      'fall outside the scope of the CRA. Market surveillance registration does not apply.</p>' +
      '<p>If you are unsure whether your product qualifies, ' +
      '<a href="/cra-conformity-assessment" style="color:#a855f7;">take the CRA Readiness Assessment</a> for a detailed classification.</p>';
    return;
  }
  resultEl.className = 'result-box';
  document.getElementById('step-2').style.display = 'block';
  document.getElementById('step-3').style.display = 'none';
}

function answerStep2(yes) {
  setActive(document.getElementById('step-2'), event.target);
  var resultEl = document.getElementById('decision-result');
  if (!yes) {
    document.getElementById('step-3').style.display = 'none';
    resultEl.className = 'result-box show not-required';
    resultEl.innerHTML = '<h3>Registration not required for importers/distributors</h3>' +
      '<p>Market surveillance registration under Art.\u00a020 applies to manufacturers and open-source stewards only. ' +
      'As an importer or distributor, you have separate obligations under Art.\u00a018 and Art.\u00a019.</p>' +
      '<p><a href="/importer-obligations-assessment" style="color:#a855f7;">Check your importer/distributor obligations \u2192</a></p>';
    return;
  }
  resultEl.className = 'result-box';
  document.getElementById('step-3').style.display = 'block';
}

function answerStep3(category) {
  setActive(document.getElementById('step-3'), event.target);
  var resultEl = document.getElementById('decision-result');

  if (category === 'critical') {
    resultEl.className = 'result-box show required';
    resultEl.innerHTML = '<h3>Registration required</h3>' +
      '<p><strong>Critical products must be registered</strong> with the relevant national market surveillance ' +
      'authority before being placed on the EU market (CRA Art.\u00a020).</p>' +
      '<p>Your registration package should include:</p>' +
      '<ul>' +
        '<li>Manufacturer name and registered address</li>' +
        '<li>Product identification (name, type, version, unique identifiers)</li>' +
        '<li>CRA category classification and applicable conformity assessment module</li>' +
        '<li>Reference to the notified body certificate (Module H)</li>' +
        '<li>EU Declaration of Conformity reference</li>' +
        '<li>Contact details for a responsible person in the EU</li>' +
      '</ul>' +
      '<p style="margin-top:12px;">Use the directory below to find the right authority for your product\u2019s market and sector.</p>';
    return;
  }

  var catLabel = { default: 'Default', important_i: 'Important I', important_ii: 'Important II' }[category];
  resultEl.className = 'result-box show not-required';
  resultEl.innerHTML = '<h3>Registration not required (' + catLabel + ')</h3>' +
    '<p>Market surveillance registration under Art.\u00a020 applies only to <strong>critical</strong> products ' +
    'with digital elements. Your product is classified as <strong>' + catLabel + '</strong>, so this ' +
    'obligation does not apply.</p>' +
    '<p>You still need to comply with the other CRA obligations for your category. ' +
    '<a href="/cra-conformity-assessment" style="color:#a855f7;">Check your full CRA readiness \u2192</a></p>';
}

/* \u2500\u2500 API calls \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
var API_BASE = '/api';

function fetchAuthorities(params) {
  var qs = new URLSearchParams();
  if (params.country) qs.set('country', params.country);
  if (params.competence_area) qs.set('competence_area', params.competence_area);
  if (params.search) qs.set('search', params.search);
  qs.set('cra_designated', 'true');
  var url = API_BASE + '/market-surveillance-authorities' + (qs.toString() ? '?' + qs.toString() : '');
  return fetch(url).then(function(r) { return r.json(); });
}

function fetchCountries() {
  return fetch(API_BASE + '/market-surveillance-authorities/countries').then(function(r) { return r.json(); });
}

/* \u2500\u2500 Rendering \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
function esc(s) {
  if (!s) return '';
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function renderAuthority(a) {
  var flag = COUNTRY_FLAGS[a.country] || '';
  var countryName = COUNTRY_NAMES[a.country] || a.country;
  var designated = a.cra_designated
    ? '<span class="auth-designated yes">CRA Designated</span>'
    : '<span class="auth-designated no">Pending</span>';

  var areas = (a.competence_areas || []).map(function(area) {
    var label = AREA_LABELS[area] || area;
    return '<span class="area-badge">' + esc(label) + '</span>';
  }).join('');

  var contact = '';
  if (a.website) contact += '<a href="' + esc(a.website) + '" target="_blank" rel="noopener">' + esc(a.website) + '</a><br>';
  if (a.email) contact += 'Email: <a href="mailto:' + esc(a.email) + '">' + esc(a.email) + '</a><br>';
  if (a.phone) contact += 'Phone: ' + esc(a.phone) + '<br>';
  if (a.address) contact += esc(a.address);

  var portal = a.contact_portal_url
    ? '<a href="' + esc(a.contact_portal_url) + '" class="portal-link" target="_blank" rel="noopener">Registration Portal \u2192</a>'
    : '';

  var notes = a.notes ? '<div class="auth-notes">' + esc(a.notes) + '</div>' : '';

  return '<div class="auth-card">' +
    '<div class="auth-header">' +
      '<div>' +
        '<div class="auth-name">' + esc(a.name) + '</div>' +
        '<div class="auth-country">' + flag + ' ' + esc(countryName) + '</div>' +
      '</div>' +
      designated +
    '</div>' +
    (areas ? '<div class="auth-areas">' + areas + '</div>' : '') +
    (contact ? '<div class="auth-contact">' + contact + '</div>' : '') +
    portal +
    notes +
  '</div>';
}

function renderResults(data) {
  var el = document.getElementById('results');
  var countEl = document.getElementById('results-count');

  if (!data.authorities || data.authorities.length === 0) {
    countEl.textContent = '';
    el.innerHTML = '<div class="no-results"><h3>No authorities found</h3><p>Try adjusting your filters or clearing the search.</p></div>';
    return;
  }

  countEl.textContent = data.total + ' ' + (data.total === 1 ? 'authority' : 'authorities') + ' found';
  el.innerHTML = data.authorities.map(renderAuthority).join('');
}

/* \u2500\u2500 Filter controls \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
function applyFilters() {
  var params = {
    country: document.getElementById('f-country').value,
    competence_area: document.getElementById('f-area').value,
    search: document.getElementById('f-search').value.trim(),
  };
  document.getElementById('results').innerHTML = '<div class="loading">Searching\u2026</div>';
  fetchAuthorities(params).then(renderResults).catch(function() {
    document.getElementById('results').innerHTML = '<div class="no-results"><h3>Error</h3><p>Could not load authorities. Please try again.</p></div>';
  });
}

function clearFilters() {
  document.getElementById('f-country').value = '';
  document.getElementById('f-area').value = '';
  document.getElementById('f-search').value = '';
  applyFilters();
}

/* \u2500\u2500 Initialise \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
document.addEventListener('DOMContentLoaded', function() {
  fetchCountries().then(function(data) {
    var sel = document.getElementById('f-country');
    (data.countries || []).forEach(function(c) {
      var opt = document.createElement('option');
      opt.value = c.country;
      var flag = COUNTRY_FLAGS[c.country] || '';
      var name = COUNTRY_NAMES[c.country] || c.country;
      opt.textContent = flag + ' ' + name + ' (' + c.count + ')';
      sel.appendChild(opt);
    });
  });

  applyFilters();

  document.getElementById('f-search').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') applyFilters();
  });
});
</script>
</div>
</body>
</html>`;
}

module.exports = { marketSurveillancePage };

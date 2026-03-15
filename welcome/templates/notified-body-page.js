/**
 * Notified Body Directory — Public Page Template
 *
 * Self-contained HTML page with inline JavaScript that calls the
 * backend /api/notified-bodies endpoints for search and filtering.
 */

function notifiedBodyDirectoryPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EU Notified Body Directory \u2013 CRA Conformity Assessment \u2013 CRANIS2</title>
<meta name="description" content="Find EU-notified bodies for CRA conformity assessments. Search by country, accredited module (B, C, H), and sector. Free directory for manufacturers of products with digital elements.">
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

  /* ── Module helper ────────────────────────────────────── */
  .module-helper {
    background: white; border-radius: 12px; border: 1px solid #e5e7eb;
    padding: 28px 32px; margin-bottom: 32px;
  }
  .module-helper h2 { font-size: 18px; font-weight: 700; margin-bottom: 12px; }
  .module-helper p { font-size: 14px; color: #6b7280; line-height: 1.6; margin-bottom: 16px; }
  .category-select {
    display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px;
  }
  .cat-btn {
    padding: 8px 18px; border-radius: 6px; border: 1px solid #e5e7eb;
    background: white; cursor: pointer; font-size: 13px; font-weight: 600;
    font-family: inherit; transition: all 0.15s;
  }
  .cat-btn:hover { border-color: #a855f7; }
  .cat-btn.active { background: #a855f7; color: white; border-color: #a855f7; }
  .module-result {
    display: none; padding: 16px 20px; border-radius: 8px;
    border: 1px solid #e5e7eb; background: #fafafa; margin-top: 12px;
  }
  .module-result.show { display: block; }
  .module-result h3 { font-size: 15px; font-weight: 700; margin-bottom: 8px; }
  .module-result p { font-size: 13px; color: #4b5563; line-height: 1.6; margin-bottom: 6px; }
  .module-badge {
    display: inline-block; padding: 3px 10px; border-radius: 4px;
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.04em; margin-right: 6px;
  }
  .module-badge.self { background: #dcfce7; color: #166534; }
  .module-badge.nb { background: #fef3c7; color: #92400e; }
  .module-badge.full { background: #fee2e2; color: #991b1b; }

  /* ── Search / filters ─────────────────────────────────── */
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

  /* ── Results ──────────────────────────────────────────── */
  .results-count {
    font-size: 13px; color: #6b7280; margin-bottom: 16px;
  }
  .body-card {
    background: white; border-radius: 12px; border: 1px solid #e5e7eb;
    padding: 24px 28px; margin-bottom: 12px;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .body-card:hover { border-color: #a855f7; box-shadow: 0 2px 8px rgba(168,85,247,0.08); }
  .body-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
  .body-name { font-size: 16px; font-weight: 700; color: #111827; margin-bottom: 4px; }
  .body-country { font-size: 13px; color: #6b7280; }
  .body-status {
    display: inline-block; padding: 3px 10px; border-radius: 4px;
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .body-status.active { background: #dcfce7; color: #166534; }
  .body-status.suspended { background: #fef3c7; color: #92400e; }
  .body-status.withdrawn { background: #fee2e2; color: #991b1b; }
  .body-modules { margin-bottom: 8px; }
  .body-sectors { font-size: 12px; color: #9ca3af; margin-bottom: 12px; }
  .body-sectors span {
    display: inline-block; padding: 2px 8px; border-radius: 3px;
    background: #f3f4f6; margin-right: 4px; margin-bottom: 4px;
  }
  .body-contact { font-size: 13px; color: #4b5563; line-height: 1.7; }
  .body-contact a { color: #a855f7; text-decoration: none; }
  .body-contact a:hover { text-decoration: underline; }
  .body-notes {
    font-size: 12px; color: #9ca3af; margin-top: 10px; line-height: 1.5;
    border-top: 1px solid #f3f4f6; padding-top: 10px;
  }

  .no-results {
    text-align: center; padding: 48px 20px; color: #9ca3af;
  }
  .no-results h3 { font-size: 18px; margin-bottom: 8px; color: #6b7280; }
  .no-results p { font-size: 14px; }

  .loading { text-align: center; padding: 48px 20px; color: #9ca3af; }

  /* ── CTA ──────────────────────────────────────────────── */
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
</style>
</head>
<body>
<div class="page">
  <div class="back-link"><a href="/conformity-assessment">\u2190 Back to all assessments</a></div>
  <div class="brand"><a href="/welcome">CRANIS2</a></div>
  <h1>EU Notified Body Directory</h1>
  <p class="subtitle">
    Find EU-designated conformity assessment bodies for the Cyber Resilience Act.
    Products classified as Important II or Critical require third-party assessment
    by a notified body. Use this directory to identify bodies accredited for your
    product\u2019s conformity assessment module.
  </p>

  <!-- Which module do I need? -->
  <div class="module-helper">
    <h2>Which conformity assessment module do I need?</h2>
    <p>The CRA requires different levels of assessment depending on your product\u2019s risk category. Select your category to see which modules apply and whether a notified body is required.</p>
    <div class="category-select">
      <button class="cat-btn" onclick="showModule('default')">Default</button>
      <button class="cat-btn" onclick="showModule('important_i')">Important I</button>
      <button class="cat-btn" onclick="showModule('important_ii')">Important II</button>
      <button class="cat-btn" onclick="showModule('critical')">Critical</button>
    </div>
    <div class="module-result" id="module-result"></div>
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
      <label>Accredited Module</label>
      <select id="f-module">
        <option value="">All modules</option>
        <option value="B">Module B \u2013 EU-Type Examination</option>
        <option value="C">Module C \u2013 Conformity to Type</option>
        <option value="H">Module H \u2013 Full Quality Assurance</option>
      </select>
    </div>
    <div class="filter-group">
      <label>Sector</label>
      <select id="f-sector">
        <option value="">All sectors</option>
        <option value="general">General</option>
        <option value="networking">Networking</option>
        <option value="industrial">Industrial</option>
        <option value="iot">IoT</option>
        <option value="medical">Medical</option>
        <option value="automotive">Automotive</option>
        <option value="energy">Energy</option>
        <option value="financial">Financial</option>
        <option value="telecoms">Telecoms</option>
      </select>
    </div>
    <div class="filter-group">
      <label>Search</label>
      <input type="text" id="f-search" placeholder="Name or NANDO number\u2026">
    </div>
    <button class="filter-btn" onclick="applyFilters()">Search</button>
    <button class="clear-btn" onclick="clearFilters()">Clear</button>
  </div>

  <!-- Results -->
  <div class="results-count" id="results-count"></div>
  <div id="results">
    <div class="loading">Loading notified bodies\u2026</div>
  </div>

  <!-- CTA -->
  <div class="cta-box">
    <h3>Already know your module?</h3>
    <p>CRANIS2 helps you prepare your technical file, track your notified body assessment,
       and manage the full conformity assessment lifecycle \u2014 from submission to certificate.</p>
    <a href="https://dev.cranis2.dev" class="cta-btn">Track your assessment in CRANIS2</a>
  </div>

  <div class="footer">
    <a href="/market-surveillance-registration">Market surveillance registration</a> &middot;
    <a href="/conformity-assessment">Free compliance assessments</a> &middot;
    <a href="/welcome">Learn more about CRANIS2</a>
  </div>
</div>

<script>
/* ── Country names ──────────────────────────────────── */
const COUNTRY_NAMES = {
  AT: 'Austria', BE: 'Belgium', BG: 'Bulgaria', HR: 'Croatia', CY: 'Cyprus',
  CZ: 'Czech Republic', DK: 'Denmark', EE: 'Estonia', FI: 'Finland', FR: 'France',
  DE: 'Germany', GR: 'Greece', HU: 'Hungary', IE: 'Ireland', IT: 'Italy',
  LV: 'Latvia', LT: 'Lithuania', LU: 'Luxembourg', MT: 'Malta', NL: 'Netherlands',
  PL: 'Poland', PT: 'Portugal', RO: 'Romania', SK: 'Slovakia', SI: 'Slovenia',
  ES: 'Spain', SE: 'Sweden', IS: 'Iceland', LI: 'Liechtenstein', NO: 'Norway',
};

const COUNTRY_FLAGS = {
  AT: '\uD83C\uDDE6\uD83C\uDDF9', BE: '\uD83C\uDDE7\uD83C\uDDEA', BG: '\uD83C\uDDE7\uD83C\uDDEC', HR: '\uD83C\uDDED\uD83C\uDDF7',
  CY: '\uD83C\uDDE8\uD83C\uDDFE', CZ: '\uD83C\uDDE8\uD83C\uDDFF', DK: '\uD83C\uDDE9\uD83C\uDDF0', EE: '\uD83C\uDDEA\uD83C\uDDEA',
  FI: '\uD83C\uDDEB\uD83C\uDDEE', FR: '\uD83C\uDDEB\uD83C\uDDF7', DE: '\uD83C\uDDE9\uD83C\uDDEA', GR: '\uD83C\uDDEC\uD83C\uDDF7',
  HU: '\uD83C\uDDED\uD83C\uDDFA', IE: '\uD83C\uDDEE\uD83C\uDDEA', IT: '\uD83C\uDDEE\uD83C\uDDF9', LV: '\uD83C\uDDF1\uD83C\uDDFB',
  LT: '\uD83C\uDDF1\uD83C\uDDF9', LU: '\uD83C\uDDF1\uD83C\uDDFA', MT: '\uD83C\uDDF2\uD83C\uDDF9', NL: '\uD83C\uDDF3\uD83C\uDDF1',
  PL: '\uD83C\uDDF5\uD83C\uDDF1', PT: '\uD83C\uDDF5\uD83C\uDDF9', RO: '\uD83C\uDDF7\uD83C\uDDF4', SK: '\uD83C\uDDF8\uD83C\uDDF0',
  SI: '\uD83C\uDDF8\uD83C\uDDEE', ES: '\uD83C\uDDEA\uD83C\uDDF8', SE: '\uD83C\uDDF8\uD83C\uDDEA', IS: '\uD83C\uDDEE\uD83C\uDDF8',
  LI: '\uD83C\uDDF1\uD83C\uDDEE', NO: '\uD83C\uDDF3\uD83C\uDDF4',
};

/* ── Module helper ──────────────────────────────────── */
const MODULE_INFO = {
  default: {
    title: 'Default \u2014 Module A (Self-Assessment)',
    html: '<p><span class="module-badge self">Module A</span> <strong>No notified body required.</strong></p>' +
      '<p>You carry out an internal assessment of conformity. Draw up the technical documentation, ensure your manufacturing process complies with the essential requirements, and issue the EU Declaration of Conformity.</p>'
  },
  important_i: {
    title: 'Important I \u2014 Module A or B+C',
    html: '<p><span class="module-badge self">Module A</span> <strong>Self-assessment is sufficient</strong> if you have fully applied relevant harmonised standards covering all essential requirements.</p>' +
      '<p><span class="module-badge nb">Module B+C</span> <strong>Notified body required</strong> if harmonised standards are not fully applied, not available, or you choose third-party assessment voluntarily.</p>' +
      '<p>Check the <a href="/cra-conformity-assessment" style="color:#a855f7;">CRA Readiness Assessment</a> to determine your standards coverage.</p>'
  },
  important_ii: {
    title: 'Important II \u2014 Module B+C (Mandatory)',
    html: '<p><span class="module-badge nb">Module B</span> <strong>Notified body examines your product type</strong> (EU-Type Examination). Results in an EU-type examination certificate.</p>' +
      '<p><span class="module-badge nb">Module C</span> You ensure each product conforms to the examined type. Used in combination with Module B.</p>' +
      '<p><strong>Third-party assessment is mandatory for Important II products.</strong> Use the directory below to find accredited bodies.</p>'
  },
  critical: {
    title: 'Critical \u2014 Module H (Mandatory)',
    html: '<p><span class="module-badge full">Module H</span> <strong>Full quality assurance by a notified body.</strong> The body assesses and approves your complete quality system for design, production, and testing.</p>' +
      '<p>This is the most rigorous assessment path. Alternatively, an EU cybersecurity certification scheme (per Art. 32(3)) may be used if available.</p>' +
      '<p><strong>Third-party assessment is mandatory for Critical products.</strong> Use the directory below to find accredited bodies.</p>'
  },
};

function showModule(category) {
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  const el = document.getElementById('module-result');
  const info = MODULE_INFO[category];
  el.innerHTML = '<h3>' + info.title + '</h3>' + info.html;
  el.classList.add('show');
}

/* ── API calls ──────────────────────────────────────── */
const API_BASE = '/api';

async function fetchBodies(params) {
  const qs = new URLSearchParams();
  if (params.country) qs.set('country', params.country);
  if (params.module) qs.set('module', params.module);
  if (params.sector) qs.set('sector', params.sector);
  if (params.search) qs.set('search', params.search);
  const url = API_BASE + '/notified-bodies' + (qs.toString() ? '?' + qs.toString() : '');
  const res = await fetch(url);
  return res.json();
}

async function fetchCountries() {
  const res = await fetch(API_BASE + '/notified-bodies/countries');
  return res.json();
}

/* ── Rendering ──────────────────────────────────────── */
function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function renderBody(b) {
  const flag = COUNTRY_FLAGS[b.country] || '';
  const countryName = COUNTRY_NAMES[b.country] || b.country;
  const modules = (b.cra_modules || []).map(function(m) {
    var cls = m === 'H' ? 'full' : 'nb';
    return '<span class="module-badge ' + cls + '">Module ' + esc(m) + '</span>';
  }).join('');
  const sectors = (b.sectors || []).map(function(s) {
    return '<span>' + esc(s) + '</span>';
  }).join('');

  var contact = '';
  if (b.website) contact += '<a href="' + esc(b.website) + '" target="_blank" rel="noopener">' + esc(b.website) + '</a><br>';
  if (b.email) contact += 'Email: <a href="mailto:' + esc(b.email) + '">' + esc(b.email) + '</a><br>';
  if (b.phone) contact += 'Phone: ' + esc(b.phone) + '<br>';
  if (b.address) contact += esc(b.address);
  if (b.nando_number) contact += (contact ? '<br>' : '') + 'NANDO: ' + esc(b.nando_number);

  var notes = b.notes ? '<div class="body-notes">' + esc(b.notes) + '</div>' : '';

  return '<div class="body-card">' +
    '<div class="body-header">' +
      '<div>' +
        '<div class="body-name">' + esc(b.name) + '</div>' +
        '<div class="body-country">' + flag + ' ' + esc(countryName) + '</div>' +
      '</div>' +
      '<span class="body-status ' + esc(b.accreditation_status) + '">' + esc(b.accreditation_status) + '</span>' +
    '</div>' +
    '<div class="body-modules">' + modules + '</div>' +
    (sectors ? '<div class="body-sectors">' + sectors + '</div>' : '') +
    (contact ? '<div class="body-contact">' + contact + '</div>' : '') +
    notes +
  '</div>';
}

function renderResults(data) {
  var el = document.getElementById('results');
  var countEl = document.getElementById('results-count');

  if (!data.bodies || data.bodies.length === 0) {
    countEl.textContent = '';
    el.innerHTML = '<div class="no-results"><h3>No notified bodies found</h3><p>Try adjusting your filters or clearing the search.</p></div>';
    return;
  }

  countEl.textContent = data.total + ' notified ' + (data.total === 1 ? 'body' : 'bodies') + ' found';
  el.innerHTML = data.bodies.map(renderBody).join('');
}

/* ── Filter controls ────────────────────────────────── */
function applyFilters() {
  var params = {
    country: document.getElementById('f-country').value,
    module: document.getElementById('f-module').value,
    sector: document.getElementById('f-sector').value,
    search: document.getElementById('f-search').value.trim(),
  };
  document.getElementById('results').innerHTML = '<div class="loading">Searching\u2026</div>';
  fetchBodies(params).then(renderResults).catch(function() {
    document.getElementById('results').innerHTML = '<div class="no-results"><h3>Error</h3><p>Could not load notified bodies. Please try again.</p></div>';
  });
}

function clearFilters() {
  document.getElementById('f-country').value = '';
  document.getElementById('f-module').value = '';
  document.getElementById('f-sector').value = '';
  document.getElementById('f-search').value = '';
  applyFilters();
}

/* ── Initialise ─────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  // Populate country dropdown
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

  // Load all bodies
  applyFilters();

  // Allow Enter key in search field
  document.getElementById('f-search').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') applyFilters();
  });
});
</script>
</div>
</body>
</html>`;
}

module.exports = { notifiedBodyDirectoryPage };

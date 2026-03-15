/**
 * End-of-Life Notification Calculator — Public Page Template
 *
 * Interactive tool that calculates when and how to notify downstream
 * users before support ends, based on CRA Art. 13(15).
 */

function endOfLifePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>End-of-Life Notification Calculator \u2013 CRA Art.\u00a013(15) \u2013 CRANIS2</title>
<meta name="description" content="When must you notify users before support ends? Free calculator for CRA Art. 13(15) end-of-life obligations. Plan your wind-down timeline and notification schedule.">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #111827; min-height: 100vh; }
  .page { max-width: 880px; margin: 0 auto; padding: 48px 20px 80px; }
  .brand { font-size: 13px; font-weight: 700; color: #a855f7; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
  .brand a { color: inherit; text-decoration: none; }
  h1 { font-size: 28px; font-weight: 700; color: #111827; margin-bottom: 8px; line-height: 1.3; }
  .subtitle { font-size: 15px; color: #6b7280; margin-bottom: 32px; line-height: 1.7; max-width: 700px; }
  .card { background: white; border-radius: 12px; border: 1px solid #e5e7eb; padding: 24px 28px; margin-bottom: 16px; }
  .card h2 { font-size: 16px; font-weight: 700; margin-bottom: 12px; }
  .card p { font-size: 14px; color: #6b7280; line-height: 1.6; margin-bottom: 12px; }
  .form-row { margin-bottom: 16px; }
  .form-row label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 4px; }
  .form-row input { width: 100%; padding: 10px 14px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 14px; font-family: inherit; }
  .form-row input:focus { outline: none; border-color: #a855f7; }
  .calc-btn { display: block; width: 100%; padding: 14px; border: none; border-radius: 8px; background: #a855f7; color: white; font-size: 16px; font-weight: 700; cursor: pointer; font-family: inherit; transition: background 0.15s; }
  .calc-btn:hover { background: #9333ea; }
  .result { display: none; background: white; border-radius: 12px; border: 2px solid #e5e7eb; padding: 28px 32px; margin-top: 24px; }
  .result.show { display: block; }
  .result h2 { font-size: 20px; font-weight: 700; margin-bottom: 16px; }
  .timeline-item { display: flex; gap: 16px; padding: 12px 0; border-bottom: 1px solid #f3f4f6; }
  .timeline-item:last-child { border-bottom: none; }
  .tl-date { min-width: 100px; font-size: 13px; font-weight: 700; color: #a855f7; }
  .tl-date.past { color: #ef4444; }
  .tl-date.soon { color: #f59e0b; }
  .tl-date.future { color: #22c55e; }
  .tl-body { font-size: 13px; color: #4b5563; line-height: 1.5; }
  .tl-body strong { color: #111827; }
  .info-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px 20px; margin-top: 20px; font-size: 13px; color: #1e40af; line-height: 1.6; }
  .info-box strong { font-weight: 700; }
  .cta-box { background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); border: 1px solid #ddd6fe; border-radius: 12px; padding: 28px 32px; margin-top: 32px; text-align: center; }
  .cta-box h3 { font-size: 18px; font-weight: 700; color: #5b21b6; margin-bottom: 8px; }
  .cta-box p { font-size: 14px; color: #6b7280; margin-bottom: 16px; line-height: 1.6; }
  .cta-btn { display: inline-block; padding: 12px 28px; border-radius: 8px; background: #a855f7; color: white; font-size: 15px; font-weight: 600; text-decoration: none; transition: background 0.15s; }
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
  <h1>End-of-Life Notification Calculator</h1>
  <p class="subtitle">
    CRA Art.\u00a013(15) requires manufacturers to clearly communicate the expected
    support period and notify downstream users before support ends. Enter your
    support end date to generate a recommended notification timeline.
  </p>

  <div class="card">
    <h2>When does support end?</h2>
    <p>Enter the planned end-of-support date for your product. The CRA requires
       a minimum 5-year support period from the date of market placement.</p>
    <div class="form-row">
      <label>Support end date</label>
      <input type="date" id="end-date" />
    </div>
    <div class="form-row">
      <label>Product name (optional)</label>
      <input type="text" id="product-name" placeholder="e.g. MyProduct v3.x" />
    </div>
    <button class="calc-btn" onclick="calculate()">Generate notification timeline</button>
  </div>

  <div class="result" id="result"></div>

  <div class="info-box">
    <strong>CRA Art.\u00a013(15) \u2014 Support Period Communication</strong><br>
    Manufacturers must clearly indicate the expected product lifetime and support period
    at the time of purchase. Users must be informed before support ends so they can plan
    migration, replacement, or accept the risk of continued use without security updates.
    Documentation must be retained for at least 10 years.
  </div>

  <div class="cta-box">
    <h3>Automate end-of-life communications</h3>
    <p>CRANIS2 tracks your support periods, sends automated alerts at 90, 60, 30, and
       7 days before expiry, and generates end-of-support documentation \u2014 all integrated
       with your CRA obligations dashboard.</p>
    <a href="https://dev.cranis2.dev" class="cta-btn">Track support periods in CRANIS2</a>
  </div>

  <div class="footer">
    <a href="/conformity-assessment">Free compliance assessments</a> &middot;
    <a href="/welcome">Learn more about CRANIS2</a>
  </div>
</div>

<script>
function calculate() {
  var dateInput = document.getElementById('end-date').value;
  if (!dateInput) { alert('Please enter a support end date.'); return; }

  var endDate = new Date(dateInput);
  var now = new Date();
  var productName = document.getElementById('product-name').value || 'Your product';
  var daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

  var milestones = [
    { months: 12, label: '12 months before', action: 'Initial end-of-support announcement', desc: 'Publish advisory on website, send email to registered users, update product documentation. Begin planning migration guidance.' },
    { months: 6, label: '6 months before', action: 'Migration guidance publication', desc: 'Provide detailed migration paths, recommend replacement products or versions. Intensify communication to enterprise customers.' },
    { months: 3, label: '3 months before', action: 'Final reminder wave', desc: 'Send prominent in-app notifications, email reminders, and social media announcements. Offer migration support.' },
    { months: 1, label: '1 month before', action: 'Last-call notification', desc: 'Final email and in-app alert. Confirm the exact date. Document the post-support CVD policy (vulnerability disclosure channel remains open for 6 months).' },
    { months: 0, label: 'End of support', action: 'Support period ends', desc: 'No further security updates. Publish final security advisory. CVD channel remains open for 6 months. Begin 10-year documentation retention period.' },
    { months: -6, label: '6 months after', action: 'CVD channel closes', desc: 'Coordinated vulnerability disclosure channel closes. Product is fully end-of-life. Documentation retention continues.' },
  ];

  var html = '<h2>Notification Timeline for ' + esc(productName) + '</h2>';
  html += '<p style="font-size:14px;color:#6b7280;margin-bottom:20px;">';
  if (daysRemaining > 0) {
    html += '<strong>' + daysRemaining + ' days</strong> remaining until end of support (' + endDate.toLocaleDateString() + ').';
  } else {
    html += '<strong style="color:#ef4444;">Support has already ended</strong> (' + endDate.toLocaleDateString() + ', ' + Math.abs(daysRemaining) + ' days ago).';
  }
  html += '</p>';

  milestones.forEach(function(m) {
    var d = new Date(endDate);
    d.setMonth(d.getMonth() - m.months);
    var isPast = d < now;
    var isSoon = !isPast && ((d - now) / (1000 * 60 * 60 * 24)) < 30;
    var cls = isPast ? 'past' : isSoon ? 'soon' : 'future';
    var status = isPast ? ' (past)' : isSoon ? ' (upcoming)' : '';

    html += '<div class="timeline-item">' +
      '<div class="tl-date ' + cls + '">' + d.toLocaleDateString() + status + '</div>' +
      '<div class="tl-body"><strong>' + m.action + '</strong><br>' + m.desc + '</div>' +
    '</div>';
  });

  var el = document.getElementById('result');
  el.innerHTML = html;
  el.className = 'result show';
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function esc(s) {
  if (!s) return '';
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
</script>
</div>
</body>
</html>`;
}

module.exports = { endOfLifePage };

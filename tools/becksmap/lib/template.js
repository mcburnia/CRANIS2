/**
 * HTML Page Template
 *
 * Wraps a generated SVG and station content into a complete
 * self-contained HTML help page.
 */

import { generateSVG } from './generator.js';

/**
 * Generate a complete HTML help page from a map definition.
 */
export function generatePage(def) {
  const svg = generateSVG(def);
  const stationsJS = generateStationsJS(def);
  const allIds = generateAllIds(def);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(def.title)} — CRANIS2 Help</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Source+Serif+4:wght@400;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
${CSS}
</style>
</head>
<body>
<header>
  <div class="logo">CRANIS<span>2</span></div>
  <div class="sep"></div>
  <div class="breadcrumb">
    <span>${escapeHtml(def.chapter || '')}</span>
    <span>\\u203a</span>
    <strong>${escapeHtml(def.title)}</strong>
  </div>
  <div class="audience-tags">${(def.audienceTags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
</header>
<div class="map-section">
  <div class="map-header">
    <h1>${escapeHtml(def.title)}</h1>
    <p>${escapeHtml(def.subtitle || '')}</p>
  </div>
  <div class="map-wrap">
    ${svg}
  </div>
  <div class="map-hint" id="map-hint"><div class="hint-dot"></div>Click any station on the map to read step-by-step guidance<button class="hint-close" onclick="dismissHint()" aria-label="Dismiss">\u00d7</button></div>
</div>
<div class="instructions-wrap">
  <div class="prompt-state" id="prompt">
    <div class="prompt-icon">\\ud83d\\uddfa\\ufe0f</div>
    <h2>Select a station to begin</h2>
    <p>Click any station on the map above to read the instructions for that step.</p>
  </div>
  <div class="instruction-card" id="instruction-card">
    <div class="card-header">
      <div class="card-icon" id="card-icon"></div>
      <div class="card-header-text">
        <h2 id="card-title"></h2>
        <div class="card-sub" id="card-sub"></div>
      </div>
    </div>
    <div class="card-body" id="card-body"></div>
  </div>
</div>
<footer>
  <span>CRANIS2 User Guide</span>
</footer>
<script>
const stations = ${stationsJS};
const allIds = ${allIds};
function dismissHint(){var h=document.getElementById('map-hint');if(h)h.style.display='none';try{localStorage.setItem('cranis2-beck-hint-dismissed','1')}catch(e){}}
if(localStorage.getItem('cranis2-beck-hint-dismissed')==='1'){var _h=document.getElementById('map-hint');if(_h)_h.style.display='none';}
function show(id) {
  const s = stations[id];
  if (!s) return;
  allIds.forEach(k => {
    const el = document.getElementById('ms-' + k);
    if (!el) return;
    el.classList.remove('active');
    el.querySelectorAll('circle,rect').forEach(c => { c.style.filter = ''; });
  });
  const active = document.getElementById('ms-' + id);
  if (active) {
    active.classList.add('active');
  }
  document.getElementById('card-icon').textContent = s.icon;
  document.getElementById('card-icon').style.background = s.iconBg;
  document.getElementById('card-title').innerHTML = s.title + '<span class="line-badge ' + s.badgeClass + '">' + s.badge + '</span>';
  document.getElementById('card-sub').textContent = s.sub;
  document.getElementById('card-body').innerHTML = s.body;
  document.getElementById('prompt').style.display = 'none';
  const card = document.getElementById('instruction-card');
  card.classList.remove('visible');
  void card.offsetWidth;
  card.classList.add('visible');
}
</script>
</body>
</html>`;
}

/**
 * Generate the stations JavaScript object from station content definitions.
 */
function generateStationsJS(def) {
  const allStations = {};

  // Main-line stations
  for (const stn of (def.mainLine || [])) {
    const content = (def.stations || {})[stn.id];
    if (content) {
      allStations[stn.id] = {
        icon: content.icon || '📍',
        iconBg: content.iconBg || '#E1F5EE',
        badge: content.badge || '',
        badgeClass: content.badgeClass || 'badge-teal',
        title: content.title || stn.label,
        sub: content.sub || stn.sub,
        body: content.body || '',
      };
    }
  }

  // Feeder stations
  for (const f of (def.feeders || [])) {
    const content = (def.stations || {})[f.id];
    if (content) {
      allStations[f.id] = {
        icon: content.icon || '⭐',
        iconBg: content.iconBg || '#FAEEDA',
        badge: content.badge || 'Feeder',
        badgeClass: content.badgeClass || 'badge-amber',
        title: content.title || f.label,
        sub: content.sub || f.sub,
        body: content.body || '',
      };
    }
  }

  // Branch stations
  for (const branch of [...(def.branches?.above || []), ...(def.branches?.below || [])]) {
    for (const stn of (branch.stations || [])) {
      const content = (def.stations || {})[stn.id];
      if (content) {
        allStations[stn.id] = {
          icon: content.icon || '🔀',
          iconBg: content.iconBg || '#EEEDFE',
          badge: content.badge || 'Branch',
          badgeClass: content.badgeClass || 'badge-purple',
          title: content.title || stn.label,
          sub: content.sub || stn.sub,
          body: content.body || '',
        };
      }
    }
  }

  return JSON.stringify(allStations, null, 2);
}

/**
 * Generate the allIds array for the show() function.
 */
function generateAllIds(def) {
  const ids = [];

  // Main-line stations first
  for (const stn of (def.mainLine || [])) {
    ids.push(stn.id);
  }

  // Feeder stations
  for (const f of (def.feeders || [])) {
    ids.push(f.id);
  }

  // Branch stations
  for (const branch of [...(def.branches?.above || []), ...(def.branches?.below || [])]) {
    for (const stn of (branch.stations || [])) {
      ids.push(stn.id);
    }
  }

  return JSON.stringify(ids);
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const CSS = `  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{
    --navy:#1C2B3A;--teal:#1D9E75;--teal-lt:#E1F5EE;--teal-dk:#085041;
    --purple:#534AB7;--purple-lt:#EEEDFE;--coral:#D85A30;--coral-lt:#FAECE7;
    --amber:#BA7517;--amber-lt:#FAEEDA;--green-lt:#EAF3DE;--green-dk:#173404;
    --gray-lt:#F1EFE8;--bg:#F4F2EE;--surface:#FFFFFF;--border:#E2DDD4;
    --text:#1A1A18;--text-2:#5A5854;--text-3:#8C8A84;
    --shadow:0 2px 8px rgba(0,0,0,.07),0 8px 24px rgba(0,0,0,.05);
  }
  html,body{font-family:'Source Serif 4',Georgia,serif;background:var(--bg);color:var(--text);}
  header{background:var(--navy);padding:0 28px;display:flex;align-items:center;gap:16px;height:52px;position:sticky;top:0;z-index:100;}
  .logo{font-family:'Outfit',sans-serif;font-weight:700;font-size:17px;color:#fff;letter-spacing:-.3px;}
  .logo span{color:var(--teal)}
  .sep{width:1px;height:20px;background:rgba(255,255,255,.2)}
  .breadcrumb{font-family:'Outfit',sans-serif;font-size:13px;color:rgba(255,255,255,.5);display:flex;align-items:center;gap:7px;}
  .breadcrumb strong{color:rgba(255,255,255,.9);font-weight:500}
  .audience-tags{margin-left:auto;display:flex;gap:6px}
  .tag{font-family:'Outfit',sans-serif;font-size:10px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;padding:3px 8px;border-radius:4px;border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.6)}
  .map-section{background:var(--surface);border-bottom:2px solid var(--border);padding:24px 24px 16px}
  .map-header{display:flex;align-items:baseline;gap:12px;margin-bottom:18px}
  .map-header h1{font-family:'Outfit',sans-serif;font-size:20px;font-weight:700;color:var(--text);letter-spacing:-.3px}
  .map-header p{font-family:'Outfit',sans-serif;font-size:13px;color:var(--text-3)}
  .map-wrap{overflow-x:auto;padding-bottom:4px}
  .map-wrap svg{display:block;min-width:700px}
  .map-hint{font-family:'Outfit',sans-serif;font-size:12px;color:var(--text-3);display:flex;align-items:center;justify-content:center;gap:7px;margin-top:10px}
  .hint-dot{width:6px;height:6px;border-radius:50%;background:var(--teal);animation:pulse 2s ease-in-out infinite}
  .hint-close{background:none;border:none;font-size:18px;color:var(--text-3);cursor:pointer;padding:0 0 0 10px;line-height:1;opacity:.6}
  .hint-close:hover{opacity:1}
  @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.8)}}
  .stn{cursor:pointer;transition:opacity .15s}.stn:hover{opacity:.75}
  .stn.active circle,.stn.active rect{animation:station-glow 2s ease-in-out infinite}
  @keyframes station-glow{0%,100%{filter:drop-shadow(0 0 6px rgba(29,158,117,.5)) drop-shadow(0 0 2px rgba(29,158,117,.3))}50%{filter:drop-shadow(0 0 14px rgba(29,158,117,.9)) drop-shadow(0 0 4px rgba(29,158,117,.6))}}
  .stn .lbl,.stn .lbl-sub{transition:font-size .15s ease,font-weight .15s ease}
  .stn:hover .lbl{font-size:15px;font-weight:700}
  .stn:hover .lbl-sub{font-size:13px;font-weight:500}
  .instructions-wrap{max-width:820px;margin:0 auto;padding:36px 28px 80px}
  .prompt-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:56px 24px;text-align:center;gap:14px}
  .prompt-icon{width:48px;height:48px;border-radius:50%;background:var(--teal-lt);display:flex;align-items:center;justify-content:center;font-size:22px}
  .prompt-state h2{font-family:'Outfit',sans-serif;font-size:17px;font-weight:600;color:var(--text)}
  .prompt-state p{font-family:'Outfit',sans-serif;font-size:14px;color:var(--text-3);max-width:340px;line-height:1.6}
  .instruction-card{background:var(--surface);border-radius:12px;box-shadow:var(--shadow);border:1px solid var(--border);overflow:hidden;display:none;animation:fadeUp .22s ease both}
  .instruction-card.visible{display:block}
  @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  .card-header{padding:18px 24px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:14px}
  .card-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
  .card-header-text h2{font-family:'Outfit',sans-serif;font-size:17px;font-weight:700;color:var(--text);letter-spacing:-.15px}
  .card-header-text .card-sub{font-family:'Outfit',sans-serif;font-size:12px;color:var(--text-3);margin-top:2px}
  .line-badge{display:inline-block;font-family:'Outfit',sans-serif;font-size:10px;font-weight:600;letter-spacing:.04em;padding:2px 8px;border-radius:4px;margin-left:8px;vertical-align:middle}
  .badge-teal{background:var(--teal-lt);color:var(--teal-dk)}.badge-coral{background:var(--coral-lt);color:#711E08}
  .badge-purple{background:var(--purple-lt);color:#26215C}.badge-amber{background:var(--amber-lt);color:#412402}
  .badge-blue{background:#E6F1FB;color:#042C53}.badge-green{background:var(--green-lt);color:var(--green-dk)}
  .badge-gray{background:var(--gray-lt);color:#2C2C2A}
  .card-body{padding:22px 24px 26px;display:flex;flex-direction:column;gap:14px}
  .card-body p{font-size:15px;line-height:1.72;color:var(--text-2)}
  .card-body strong{color:var(--text);font-weight:600}
  .detail-list{list-style:none;display:flex;flex-direction:column;gap:7px;padding-left:2px}
  .detail-list li{font-family:'Outfit',sans-serif;font-size:14px;color:var(--text-2);display:flex;align-items:flex-start;gap:10px;line-height:1.55}
  .detail-list li::before{content:'';width:5px;height:5px;border-radius:50%;background:var(--teal);margin-top:7px;flex-shrink:0}
  .tip{background:var(--teal-lt);border-left:3px solid var(--teal);border-radius:0 8px 8px 0;padding:11px 16px;font-family:'Outfit',sans-serif;font-size:14px;color:var(--teal-dk);line-height:1.55}
  .warn{background:var(--amber-lt);border-left:3px solid var(--amber);border-radius:0 8px 8px 0;padding:11px 16px;font-family:'Outfit',sans-serif;font-size:14px;color:#412402;line-height:1.55}
  .info{background:#E6F1FB;border-left:3px solid #185FA5;border-radius:0 8px 8px 0;padding:11px 16px;font-family:'Outfit',sans-serif;font-size:14px;color:#042C53;line-height:1.55}
  .code{font-family:'DM Mono',monospace;font-size:12.5px;background:var(--gray-lt);border:1px solid var(--border);border-radius:4px;padding:1px 6px;color:var(--text)}
  footer{background:var(--surface);border-top:1px solid var(--border);padding:10px 28px;display:flex;align-items:center;position:sticky;bottom:0;z-index:100}
  footer span{font-family:'Outfit',sans-serif;font-size:11.5px;color:var(--text-3)}`;

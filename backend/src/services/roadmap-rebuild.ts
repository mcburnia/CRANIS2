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
 * roadmap-rebuild — regenerate the three Beck-map roadmap pages
 * (/roadmap, /by-period, /left-to-do) from live Jira CRAN data and write them
 * into the served web root.
 *
 * Jira is the single source of truth; placement is deterministic:
 *   due date     -> period      (/by-period)
 *   discipline:* -> discipline  (/left-to-do)
 *   parent       -> epic
 *   status       -> done / to-do
 *
 * This replaces the former host pipeline (staging/build_*.py +
 * rebuild-roadmaps.sh + the 06:15 crontab). It is now driven by
 * scheduler.ts -> runDailyRoadmapRebuild() so the schedule lives in the repo
 * alongside every other scheduled job.
 *
 * The hand-authored overview source is becksmap/roadmap-overview.ts; the
 * renderer is vendored under becksmap/ (source of truth: tools/becksmap/lib).
 */

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { generatePage } from './becksmap/template.js';
import { ROADMAP_OVERVIEW } from './becksmap/roadmap-overview.js';
import { logger } from '../utils/logger.js';

const JIRA_SITE = process.env.JIRA_SITE || 'https://andimcburnie.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL || 'andi.mcburnie@gmail.com';
// Where the generated pages land. DIST is what nginx serves (host bind-mount);
// PUBLIC survives a frontend rebuild (Vite copies public/ -> dist/ on build).
const DIST_DIR = process.env.ROADMAP_DIST_DIR || '/app/webroot/dist';
const PUBLIC_DIR = process.env.ROADMAP_PUBLIC_DIR || '/app/webroot/public';

function authHeader(): string {
  const token = process.env.JIRA_API_TOKEN;
  if (!token) throw new Error('JIRA_API_TOKEN is not set — cannot reach Jira');
  return 'Basic ' + Buffer.from(`${JIRA_EMAIL}:${token}`).toString('base64');
}

interface Issue { key: string; fields: any }

/** Paginated enhanced-JQL search (the new endpoint uses nextPageToken/isLast). */
async function jiraSearch(jql: string, fields: string): Promise<Issue[]> {
  const out: Issue[] = [];
  let token: string | undefined;
  do {
    const params = new URLSearchParams({ jql, maxResults: '100', fields });
    if (token) params.set('nextPageToken', token);
    const res = await fetch(`${JIRA_SITE}/rest/api/3/search/jql?${params.toString()}`, {
      headers: { Authorization: authHeader(), Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Jira search ${res.status}: ${await res.text()}`);
    const data: any = await res.json();
    out.push(...((data.issues as Issue[]) || []));
    token = data.isLast ? undefined : data.nextPageToken;
  } while (token);
  return out;
}

/** Approximate count (the enhanced search endpoint dropped `total`). */
async function jiraCount(jql: string): Promise<number> {
  const res = await fetch(`${JIRA_SITE}/rest/api/3/search/approximate-count`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ jql }),
  });
  if (!res.ok) throw new Error(`Jira count ${res.status}: ${await res.text()}`);
  const data: any = await res.json();
  return data.count ?? 0;
}

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function keynum(key: string): number { return parseInt(key.split('-')[1], 10); }

// ── /by-period ────────────────────────────────────────────────────────────
// Stations = delivery periods; each card lists every forward epic due in that
// window (bucketed by epic due-date) with child stories/spikes nested beneath.
async function buildByPeriod(): Promise<any> {
  const issues = await jiraSearch(
    'project=CRAN AND statusCategory != Done ORDER BY key ASC',
    'summary,issuetype,parent,duedate,status',
  );
  const epics: Record<string, { key: string; summary: string; due: string | null }> = {};
  const kids: Record<string, Array<{ key: string; summary: string }>> = {};
  for (const i of issues) {
    const f = i.fields;
    if (f.issuetype.name === 'Epic') {
      epics[i.key] = { key: i.key, summary: f.summary, due: f.duedate || null };
    } else {
      const p = f.parent?.key;
      if (p) (kids[p] ||= []).push({ key: i.key, summary: f.summary });
    }
  }

  // id, label, range, lo, hi, icon, bg, badgeClass, colour, labelPos
  const PERIODS: Array<[string, string, string, string, string, string, string, string, string, string]> = [
    ['now',   'Now',     'Jun – Sep 2026', '0000',       '2026-09-30', '📍', '#FAEEDA', 'badge-amber',  'next',  'below'],
    ['q4',    'Q4 2026', 'Oct – Dec 2026', '2026-10-01', '2026-12-31', '📈', '#EEEDFE', 'badge-purple', 'next',  'above'],
    ['q1',    'Q1 2027', 'Jan – Mar 2027', '2027-01-01', '2027-03-31', '🔁', '#E6F1FB', 'badge-blue',   'blue',  'below'],
    ['q2',    'Q2 2027', 'Apr – Jun 2027', '2027-04-01', '2027-06-30', '🌍', '#E6F1FB', 'badge-blue',   'blue',  'above'],
    ['q3_27', 'Q3 2027', 'Jul – Sep 2027', '2027-07-01', '2027-09-30', '🧩', '#EAF3DE', 'badge-green',  'green', 'below'],
    ['q4_27', 'Q4 2027', 'Oct – Dec 2027', '2027-10-01', '2027-12-31', '🏁', '#EAF3DE', 'badge-green',  'green', 'above'],
  ];

  const mainLine: any[] = [];
  const stations: Record<string, any> = {};
  PERIODS.forEach(([sid, name, rng, lo, hi, icon, bg, badge, colour, lpos], idx) => {
    const bucket = Object.values(epics)
      .filter(e => e.due && e.due >= lo && e.due <= hi)
      .sort((a, b) => keynum(a.key) - keynum(b.key));
    let nstories = 0;
    const body: string[] = [];
    for (const ep of bucket) {
      const ek = (kids[ep.key] || []).slice().sort((a, b) => keynum(a.key) - keynum(b.key));
      nstories += ek.length;
      body.push(`<p style="margin-top:12px;margin-bottom:2px;"><strong>${ep.key} — ${esc(ep.summary)}</strong></p>`);
      if (ek.length) {
        body.push('<ul class="acro-list">' + ek.map(k => `<li>${k.key} — ${esc(k.summary)}</li>`).join('') + '</ul>');
      }
    }
    const sub = `${bucket.length} epics · ${nstories} stories`;
    const st: any = { id: sid, label: name, sub: rng, labelPos: lpos, colour };
    if (idx === 0) st.type = 'interchange';
    else if (idx === PERIODS.length - 1) { st.type = 'endpoint'; st.endColour = 'green'; delete st.colour; }
    mainLine.push(st);
    stations[sid] = {
      icon, iconBg: bg, badge: rng, badgeClass: badge,
      title: `${name} — what's left to deliver`,
      sub: `${rng} · ${sub}`,
      body: `<p>Every forward epic due in <strong>${rng}</strong> (${sub}), with child stories &amp; spikes beneath:</p>`
        + (body.join('') || '<p>(nothing scheduled in this window)</p>'),
    };
  });

  return {
    title: 'CRANIS2 — Left to Do, by Timeline',
    subtitle: 'Every forward epic by delivery period — click a period to see its epics, stories and spikes (live from Jira)',
    chapter: 'Roadmap · Detailed plan (by timeline)',
    audienceTags: ['Founder', 'Team'],
    labelGap: 9,
    youAreHere: 'now',
    preselectFirst: true,
    links: [{ label: '← Roadmap', href: '/roadmap' }, { label: 'By discipline →', href: '/left-to-do' }],
    mainLine,
    feeders: [],
    branches: { above: [], below: [] },
    stations,
  };
}

// ── /left-to-do ─────────────────────────────────────────────────────────────
// Stations = business disciplines; each card lists that discipline's forward
// epics + their stories/spikes (matched on the discipline:* label).
async function buildLeftToDo(): Promise<any> {
  const DISC = ['discipline:marketing', 'discipline:sales', 'discipline:qa', 'discipline:legal', 'discipline:ops'];
  const q = 'project=CRAN AND labels in (' + DISC.map(d => `"${d}"`).join(',') + ') ORDER BY key ASC';
  const issues = await jiraSearch(q, 'summary,issuetype,parent,status,labels');
  const byId: Record<string, any> = {};
  for (const i of issues) {
    const f = i.fields;
    byId[i.key] = {
      key: i.key, type: f.issuetype.name, summary: f.summary,
      parent: f.parent?.key ?? null, labels: f.labels || [], status: f.status.name,
    };
  }

  // label, id, name, icon, bg, badgeClass, type, colour, labelPos
  const DISCIPLINES: Array<[string, string, string, string, string, string, string | null, string, string]> = [
    ['discipline:marketing', 'marketing', 'Marketing',          '🚀', '#EEEDFE', 'badge-purple', 'terminus', 'next',   'above'],
    ['discipline:sales',     'sales',     'Sales',              '💼', '#E6F1FB', 'badge-blue',   null,       'blue',   'below'],
    ['discipline:qa',        'qa',        'Quality & Testing',  '🧪', '#EAF3DE', 'badge-green',  null,       'green',  'above'],
    ['discipline:legal',     'legal',     'Legal & Corporate',  '⚖️', '#FAECE7', 'badge-coral',  null,       'error',  'below'],
    ['discipline:ops',       'ops',       'Ops & Finance',      '📊', '#FAEEDA', 'badge-amber',  'endpoint', 'feeder', 'above'],
  ];

  const mainLine: any[] = [];
  const stations: Record<string, any> = {};
  for (const [label, sid, name, icon, bg, badge, typ, colour, lpos] of DISCIPLINES) {
    const epics = Object.values(byId)
      .filter((v: any) => v.type === 'Epic' && v.labels.includes(label))
      .sort((a: any, b: any) => keynum(a.key) - keynum(b.key));
    let nstories = 0;
    const body: string[] = [];
    for (const ep of epics) {
      const kids = Object.values(byId)
        .filter((v: any) => v.parent === ep.key)
        .sort((a: any, b: any) => keynum(a.key) - keynum(b.key));
      nstories += kids.length;
      body.push(`<p style="margin-top:12px;margin-bottom:2px;"><strong>${ep.key} — ${esc(ep.summary)}</strong></p>`);
      if (kids.length) {
        body.push('<ul class="acro-list">' + kids.map((k: any) => `<li>${k.key} — ${esc(k.summary)}</li>`).join('') + '</ul>');
      } else {
        body.push('<p style="font-size:12px;color:#8C8A84;margin-left:16px;">(no stories broken out yet)</p>');
      }
    }
    const sub = `${epics.length} epic${epics.length !== 1 ? 's' : ''} · ${nstories} stories`;
    const st: any = { id: sid, label: name, sub, labelPos: lpos };
    if (typ === 'terminus') { st.type = 'terminus'; st.colour = colour; }
    else if (typ === 'endpoint') { st.type = 'endpoint'; st.endColour = colour; }
    else st.colour = colour;
    mainLine.push(st);
    stations[sid] = {
      icon, iconBg: bg, badge: name, badgeClass: badge,
      title: `${name} — what's left to do`,
      sub,
      body: `<p>The <strong>${name.toLowerCase()}</strong> epics still to deliver, each with its stories beneath:</p>` + body.join(''),
    };
  }

  return {
    title: 'CRANIS2 — Left to Do',
    subtitle: 'The forward business epics by discipline — click a discipline to see its epics, stories and spikes (live from Jira)',
    chapter: 'Roadmap · Detailed plan',
    audienceTags: ['Founder', 'Team'],
    labelGap: 9,
    preselectFirst: true,
    links: [{ label: '← Roadmap', href: '/roadmap' }, { label: 'By timeline →', href: '/by-period' }],
    mainLine,
    feeders: [],
    branches: { above: [], below: [] },
    stations,
  };
}

// ── /roadmap (overview) ──────────────────────────────────────────────────────
// Hand-authored station copy lives in roadmap-overview.ts; here we inject the
// live "shipped" counts and lint forward epics for a missing due date (which
// would silently drop them off /by-period).
async function buildOverview(): Promise<{ def: any; lint: string[]; sentence: string }> {
  const [e, s, sp, t] = await Promise.all([
    jiraCount('project=CRAN AND statusCategory=Done AND issuetype=Epic'),
    jiraCount('project=CRAN AND statusCategory=Done AND issuetype=Story'),
    jiraCount('project=CRAN AND statusCategory=Done AND issuetype=Task'),
    jiraCount('project=CRAN AND statusCategory=Done'),
  ]);
  const sentence = `${e} epics, ${s} stories and ${sp} discovery spikes delivered — ${t} items in total.`;
  const def = JSON.parse(JSON.stringify(ROADMAP_OVERVIEW));
  def.stations.shipped.body = String(def.stations.shipped.body).replace('__SHIPPED_COUNTS__', sentence);

  const fwd = await jiraSearch('project=CRAN AND issuetype=Epic AND statusCategory != Done', 'duedate,labels,summary');
  const lint = fwd
    .filter(i => !i.fields.duedate && !((i.fields.labels || []) as string[]).includes('cancelled'))
    .map(i => `${i.key} — ${i.fields.summary}`);
  return { def, lint, sentence };
}

/** Port of becksmap's CLI validator — fail loudly on a malformed definition. */
function validateDefinition(def: any): string[] {
  const errors: string[] = [];
  if (!def.title) errors.push('Missing required field: title');
  if (!def.mainLine || !Array.isArray(def.mainLine)) errors.push('Missing or invalid: mainLine');
  const ids = new Set<string>();
  for (const stn of (def.mainLine || [])) {
    if (!stn.id) errors.push('Main-line station missing id');
    if (!stn.label) errors.push(`Station ${stn.id || '?'} missing label`);
    if (ids.has(stn.id)) errors.push(`Duplicate station id: ${stn.id}`);
    ids.add(stn.id);
  }
  for (const f of (def.feeders || [])) {
    if (f.target && !ids.has(f.target)) errors.push(`Feeder target '${f.target}' not found`);
    ids.add(f.id);
  }
  const content = def.stations || {};
  for (const id of ids) if (!content[id]) errors.push(`Missing station content for '${id}'`);
  return errors;
}

async function writePage(slug: string, def: any): Promise<void> {
  const errors = validateDefinition(def);
  if (errors.length) throw new Error(`becksmap definition for /${slug} is invalid: ${errors.join('; ')}`);
  const html = generatePage(def);
  for (const base of [DIST_DIR, PUBLIC_DIR]) {
    const dir = join(base, slug);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'index.html'), html, 'utf-8');
  }
}

/**
 * Regenerate all three roadmap pages from live Jira and write them to the web
 * root. Safe to call ad hoc (e.g. for verification) or from the scheduler.
 */
export async function rebuildRoadmaps(): Promise<{ ok: true; counts: string; lint: string[] }> {
  const [byPeriod, leftToDo, overview] = await Promise.all([
    buildByPeriod(),
    buildLeftToDo(),
    buildOverview(),
  ]);
  await writePage('roadmap', overview.def);
  await writePage('by-period', byPeriod);
  await writePage('left-to-do', leftToDo);
  if (overview.lint.length) {
    logger.warn(`[ROADMAP] ${overview.lint.length} forward epic(s) missing a due date (won't appear on /by-period): ${overview.lint.join(', ')}`);
  }
  logger.info(`[ROADMAP] Rebuilt /roadmap /by-period /left-to-do — ${overview.sentence}`);
  return { ok: true, counts: overview.sentence, lint: overview.lint };
}

#!/usr/bin/env python3
"""Build by-period.json: a Beck map whose stations are the roadmap periods
(Now / Q4 / Q1 / Q2 / H2). Each period's card lists EVERY forward epic due in
that window (product + business), with child stories/spikes nested. Buckets by
the epic due-dates already set in Jira CRAN. Reads JIRA_API_TOKEN (+ JIRA_EMAIL)."""
import os, json, base64, urllib.request, urllib.parse, html

SITE = "https://andimcburnie.atlassian.net"
EMAIL = os.environ.get("JIRA_EMAIL", "andi.mcburnie@gmail.com")
TOKEN = os.environ["JIRA_API_TOKEN"]
AUTH = base64.b64encode(f"{EMAIL}:{TOKEN}".encode()).decode()

def jql(q, fields):
    token, out = None, []
    while True:
        p = {"jql": q, "maxResults": "100", "fields": fields}
        if token: p["nextPageToken"] = token
        r = urllib.request.Request(SITE + "/rest/api/3/search/jql?" + urllib.parse.urlencode(p))
        r.add_header("Authorization", "Basic " + AUTH); r.add_header("Accept", "application/json")
        d = json.loads(urllib.request.urlopen(r).read().decode())
        out += d.get("issues", [])
        token = d.get("nextPageToken")
        if not token or d.get("isLast"): break
    return out

def esc(s): return html.escape(s or "")

issues = jql("project=CRAN AND statusCategory != Done ORDER BY key ASC",
             "summary,issuetype,parent,duedate,status")
epics, kids = {}, {}
for i in issues:
    f = i["fields"]; t = f["issuetype"]["name"]
    if t == "Epic":
        epics[i["key"]] = {"key": i["key"], "summary": f["summary"], "due": f.get("duedate")}
    else:
        p = (f.get("parent") or {}).get("key")
        if p: kids.setdefault(p, []).append({"key": i["key"], "summary": f["summary"]})

# (id, label, dateRange, lo, hi, icon, bg, badgeClass, colour, labelPos)
PERIODS = [
    ("now", "Now", "Jun – Sep 2026", "0000", "2026-09-30", "📍", "#FAEEDA", "badge-amber", "next",  "below"),
    ("q4",  "Q4 2026", "Oct – Dec 2026", "2026-10-01", "2026-12-31", "📈", "#EEEDFE", "badge-purple", "next", "above"),
    ("q1",  "Q1 2027", "Jan – Mar 2027", "2027-01-01", "2027-03-31", "🔁", "#E6F1FB", "badge-blue", "blue", "below"),
    ("q2",  "Q2 2027", "Apr – Jun 2027", "2027-04-01", "2027-06-30", "🌍", "#E6F1FB", "badge-blue", "blue", "above"),
    ("q3_27", "Q3 2027", "Jul – Sep 2027", "2027-07-01", "2027-09-30", "🧩", "#EAF3DE", "badge-green", "green", "below"),
    ("q4_27", "Q4 2027", "Oct – Dec 2027", "2027-10-01", "2027-12-31", "🏁", "#EAF3DE", "badge-green", "green", "above"),
]

def keynum(k): return int(k.split("-")[1])

mainLine, stations = [], {}
for idx, (sid, name, rng, lo, hi, icon, bg, badge, colour, lpos) in enumerate(PERIODS):
    bucket = sorted([e for e in epics.values() if e["due"] and lo <= e["due"] <= hi], key=lambda x: keynum(x["key"]))
    nstories = 0
    body = []
    for ep in bucket:
        ek = kids.get(ep["key"], [])
        nstories += len(ek)
        body.append(f'<p style="margin-top:12px;margin-bottom:2px;"><strong>{ep["key"]} — {esc(ep["summary"])}</strong></p>')
        if ek:
            body.append('<ul class="acro-list">' + "".join(
                f'<li>{k["key"]} — {esc(k["summary"])}</li>' for k in sorted(ek, key=lambda x: keynum(x["key"]))) + '</ul>')
    sub = f'{len(bucket)} epics · {nstories} stories'
    st = {"id": sid, "label": name, "sub": rng, "labelPos": lpos, "colour": colour}
    if idx == 0: st["type"] = "interchange"
    elif idx == len(PERIODS) - 1: st["type"] = "endpoint"; st["endColour"] = "green"; st.pop("colour", None)
    mainLine.append(st)
    stations[sid] = {
        "icon": icon, "iconBg": bg, "badge": rng, "badgeClass": badge,
        "title": f"{name} — what's left to deliver",
        "sub": f"{rng} · {sub}",
        "body": f"<p>Every forward epic due in <strong>{rng}</strong> ({sub}), with child stories &amp; spikes beneath:</p>" + ("".join(body) or "<p>(nothing scheduled in this window)</p>"),
    }

definition = {
    "title": "CRANIS2 — Left to Do, by Timeline",
    "subtitle": "Every forward epic by delivery period — click a period to see its epics, stories and spikes (live from Jira)",
    "chapter": "Roadmap · Detailed plan (by timeline)",
    "audienceTags": ["Founder", "Team"],
    "labelGap": 9,
    "youAreHere": "now",
    "preselectFirst": True,
    "links": [{"label": "← Roadmap", "href": "/roadmap"}, {"label": "By discipline →", "href": "/left-to-do"}],
    "mainLine": mainLine,
    "feeders": [],
    "branches": {"above": [], "below": []},
    "stations": stations,
}
with open("/home/mcburnia/cranis2/staging/by-period.json", "w", encoding="utf-8") as fh:
    json.dump(definition, fh, indent=1, ensure_ascii=False)
print("wrote by-period.json")
for sid, name, rng, lo, hi, *_ in PERIODS:
    b = [e for e in epics.values() if e["due"] and lo <= e["due"] <= hi]
    s = sum(len(kids.get(e["key"], [])) for e in b)
    print(f"  {name:8} ({rng:14}) {len(b):2} epics, {s} stories")
undated = [e["key"] for e in epics.values() if not e["due"]]
print(f"  (undated forward epics, excluded: {undated})")

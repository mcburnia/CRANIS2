#!/usr/bin/env python3
"""Build left-to-do.json: a per-discipline Beck map of the forward business
epics, each station card listing that discipline's epics + their stories/spikes,
pulled live from Jira CRAN. Reads JIRA_API_TOKEN (+ JIRA_EMAIL) from env."""
import os, json, base64, urllib.request, urllib.parse, urllib.error, html

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

# pull every discipline-labelled issue (epics + their stories)
DISC = ["discipline:marketing", "discipline:sales", "discipline:qa", "discipline:legal", "discipline:ops"]
q = "project=CRAN AND labels in (" + ",".join(f'"{d}"' for d in DISC) + ") ORDER BY key ASC"
issues = jql(q, "summary,issuetype,parent,status,labels")

def esc(s): return html.escape(s or "")

# index
by_id = {}
for i in issues:
    f = i["fields"]
    by_id[i["key"]] = {"key": i["key"], "type": f["issuetype"]["name"], "summary": f["summary"],
                       "parent": (f.get("parent") or {}).get("key"), "labels": f.get("labels", []),
                       "status": f["status"]["name"]}

DISCIPLINES = [
    ("discipline:marketing", "marketing", "Marketing", "🚀", "#EEEDFE", "badge-purple", "terminus", "next", "above"),
    ("discipline:sales",     "sales",     "Sales",     "💼", "#E6F1FB", "badge-blue",   None,       "blue",  "below"),
    ("discipline:qa",        "qa",        "Quality & Testing", "🧪", "#EAF3DE", "badge-green", None,  "green", "above"),
    ("discipline:legal",     "legal",     "Legal & Corporate", "⚖️", "#FAECE7", "badge-coral", None,  "error", "below"),
    ("discipline:ops",       "ops",       "Ops & Finance", "📊", "#FAEEDA", "badge-amber", "endpoint", "feeder", "above"),
]

mainLine, stations = [], {}
for label, sid, name, icon, bg, badge, typ, colour, lpos in DISCIPLINES:
    epics = sorted([v for v in by_id.values() if v["type"] == "Epic" and label in v["labels"]], key=lambda x: int(x["key"].split("-")[1]))
    nstories = 0
    body = []
    for ep in epics:
        kids = sorted([v for v in by_id.values() if v["parent"] == ep["key"]], key=lambda x: int(x["key"].split("-")[1]))
        nstories += len(kids)
        body.append(f'<p style="margin-top:12px;margin-bottom:2px;"><strong>{ep["key"]} — {esc(ep["summary"])}</strong></p>')
        if kids:
            body.append('<ul class="acro-list">' + "".join(
                f'<li>{k["key"]} — {esc(k["summary"])}</li>' for k in kids) + '</ul>')
        else:
            body.append('<p style="font-size:12px;color:#8C8A84;margin-left:16px;">(no stories broken out yet)</p>')
    sub = f'{len(epics)} epic{"s" if len(epics)!=1 else ""} · {nstories} stories'
    st = {"id": sid, "label": name, "sub": sub, "labelPos": lpos}
    if typ == "terminus": st["type"] = "terminus"; st["colour"] = colour
    elif typ == "endpoint": st["type"] = "endpoint"; st["endColour"] = colour
    else: st["colour"] = colour
    mainLine.append(st)
    stations[sid] = {
        "icon": icon, "iconBg": bg, "badge": name, "badgeClass": badge,
        "title": f"{name} — what's left to do",
        "sub": sub,
        "body": f"<p>The <strong>{name.lower()}</strong> epics still to deliver, each with its stories beneath:</p>" + "".join(body),
    }

definition = {
    "title": "CRANIS2 — Left to Do",
    "subtitle": "The forward business epics by discipline — click a discipline to see its epics, stories and spikes (live from Jira)",
    "chapter": "Roadmap · Detailed plan",
    "audienceTags": ["Founder", "Team"],
    "labelGap": 9,
    "preselectFirst": True,
    "links": [{"label": "← Roadmap", "href": "/roadmap"}, {"label": "By timeline →", "href": "/by-period"}],
    "mainLine": mainLine,
    "feeders": [],
    "branches": {"above": [], "below": []},
    "stations": stations,
}

with open("/home/mcburnia/cranis2/staging/left-to-do.json", "w", encoding="utf-8") as fh:
    json.dump(definition, fh, indent=1, ensure_ascii=False)
print("wrote left-to-do.json")
for label, sid, name, *_ in DISCIPLINES:
    e = [v for v in by_id.values() if v["type"] == "Epic" and label in v["labels"]]
    s = sum(1 for v in by_id.values() if v["parent"] in {x["key"] for x in e})
    print(f"  {name:20} {len(e)} epics, {s} stories")

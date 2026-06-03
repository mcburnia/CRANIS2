#!/usr/bin/env python3
"""Build the overview roadmap: inject live shipped-counts into roadmap.json and
write roadmap.generated.json. Also lint forward epics for a missing due date
(which would silently drop them off /by-period). Reads JIRA_API_TOKEN (+EMAIL)."""
import os, json, base64, urllib.request, urllib.parse

SITE = "https://andimcburnie.atlassian.net"
EMAIL = os.environ.get("JIRA_EMAIL", "andi.mcburnie@gmail.com")
TOKEN = os.environ["JIRA_API_TOKEN"]
AUTH = base64.b64encode(f"{EMAIL}:{TOKEN}".encode()).decode()
BASE = "/home/mcburnia/cranis2"

def count(q):
    r = urllib.request.Request(SITE + "/rest/api/3/search/approximate-count",
        data=json.dumps({"jql": q}).encode(), method="POST")
    r.add_header("Authorization", "Basic " + AUTH); r.add_header("Accept", "application/json")
    r.add_header("Content-Type", "application/json")
    return json.loads(urllib.request.urlopen(r).read().decode()).get("count")

def listq(q, fields):
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

e = count("project=CRAN AND statusCategory=Done AND issuetype=Epic")
s = count("project=CRAN AND statusCategory=Done AND issuetype=Story")
sp = count("project=CRAN AND statusCategory=Done AND issuetype=Task")
t = count("project=CRAN AND statusCategory=Done")
sentence = f"{e} epics, {s} stories and {sp} discovery spikes delivered — {t} items in total."

src = open(f"{BASE}/staging/roadmap.json", encoding="utf-8").read()
src = src.replace("__SHIPPED_COUNTS__", sentence)
open(f"{BASE}/staging/roadmap.generated.json", "w", encoding="utf-8").write(src)
print(f"shipped counts: {sentence}")

# lint: forward (To Do) epics with no due date and not cancelled won't show on /by-period
fwd = listq("project=CRAN AND issuetype=Epic AND statusCategory != Done", "duedate,labels,summary")
missing = [i for i in fwd if not i["fields"].get("duedate") and "cancelled" not in (i["fields"].get("labels") or [])]
if missing:
    print(f"LINT WARNING: {len(missing)} forward epic(s) missing a due date (won't appear on /by-period):")
    for i in missing:
        print(f"  - {i['key']} — {i['fields']['summary']}")
else:
    print("lint OK: every forward epic has a due date (cancelled epics excluded by design).")
